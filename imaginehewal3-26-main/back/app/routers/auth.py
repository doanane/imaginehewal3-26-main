from app.auth import lockout
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request

from app.schemas.caregiver_signup import CaregiverSignupRequest, CaregiverSignupResponse

from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timedelta
import hmac
import secrets
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request, Query
import string
from typing import Optional, Union
import jwt
import logging
from app.database import get_db
from app.auth.security import create_access_token, verify_password, get_password_hash, get_current_user,    get_current_admin, get_current_user_or_admin,get_current_active_user_or_admin 
from app.auth.hashing import verify_password as verify_pass, get_password_hash as get_pass_hash
from app.models.user import User
from app.models.auth import PasswordResetToken, EmailVerificationToken, LoginOTP, RefreshToken, UserSession
from app.services import auth_mail, simple_limiter
from app.services.email_service import email_service
from app.services.sms_service import sms_service
from app.config import settings
from pydantic import BaseModel, EmailStr, Field, validator
import uuid
from fastapi.responses import HTMLResponse, RedirectResponse
import os
from app.models.admin import Admin

router = APIRouter(prefix="/auth", tags=["authentication"])
logger = logging.getLogger(__name__)


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    username: Optional[str] = None
    phone_number: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

class VerifyEmailRequest(BaseModel):
    token: str

class RequestOTPLogin(BaseModel):
    email: EmailStr

class VerifyOTPLogin(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_type: str
    user_id: int
    email: str
    is_email_verified: bool
    is_caregiver: bool = False 
    caregiver_id: Optional[str] = None 
    username: Optional[str] = None
    profile_image: Optional[str] = None

class PatientSignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    username: str
    phone_number: Optional[str] = None
def create_session_log(db: Session, user_id: int, request: Request):
    session_token = secrets.token_urlsafe(32)
    device_info = request.headers.get("User-Agent", "Unknown")
    ip_address = request.client.host if request.client else "Unknown"
    
    session = UserSession(
        user_id=user_id,
        session_token=session_token,
        device_info=device_info,
        ip_address=ip_address,
        expires_at=datetime.utcnow() + timedelta(days=30)
    )
    db.add(session)
    db.commit()

def create_auth_tokens(user: User, db: Session):
    access_token = create_access_token(
        data={"sub": str(user.id), "type": "caregiver" if user.is_caregiver else "patient"},
        user_type="caregiver" if user.is_caregiver else "patient"
    )
    
    refresh_token_str = secrets.token_urlsafe(32)
    refresh_token_db = RefreshToken(
        user_id=user.id,
        token=refresh_token_str,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(refresh_token_db)
    db.commit()
    
    return access_token, refresh_token_str
def generate_otp(length=6):
    """Generate numeric OTP"""
    return ''.join(secrets.choice(string.digits) for _ in range(length))

def generate_token(length=32):
    """Generate random token"""
    return secrets.token_urlsafe(length)

def _photo(db: Session, user) -> Optional[str]:
    """The saved profile photo lives on the profile row, not on the user row; without this lookup every sign in came back with no photo."""
    from app.models.user import UserProfile
    try:
        p = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        return getattr(p, "profile_image_url", None) if p else None
    except Exception:
        return None


def create_refresh_token(user_id: int, db: Session):
    """Create refresh token"""
    token = generate_token()
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    refresh_token = RefreshToken(
        user_id=user_id,
        token=token,
        expires_at=expires_at
    )
    
    db.add(refresh_token)
    db.commit()
    return token




    
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token,
        PasswordResetToken.is_used == False,
        PasswordResetToken.expires_at > datetime.utcnow()
    ).first()
    
    if not reset_token:
        return HTMLResponse(content="""
        <html>
            <body>
                <h1 class="error">Invalid or Expired Token</h1>
                <p>The password reset token is invalid or has expired.</p>
                <p>Please request a new password reset.</p>
                <p><a href="/docs#/authentication/forgot_password">Request New Password Reset</a></p>
            </body>
        </html>
        """)
    
    
    return HTMLResponse(content=f"""
    <html>
        <head>
            <title>Reset Password</title>
            <style>
                body {{ font-family: Arial, sans-serif; padding: 50px; max-width: 500px; margin: 0 auto; }}
                .form-group {{ margin-bottom: 20px; }}
                label {{ display: block; margin-bottom: 5px; }}
                input {{ width: 100%; padding: 10px; box-sizing: border-box; }}
                button {{ padding: 12px 24px; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; }}
                .error {{ color: red; }}
                .success {{ color: green; }}
            </style>
        </head>
        <body>
            <h1>Set New Password</h1>
            <p>Please enter your new password.</p>
            <form id="resetForm">
                <input type="hidden" id="token" value="{token}">
                <div class="form-group">
                    <label for="password">New Password (min 8 characters):</label>
                    <input type="password" id="password" name="password" minlength="8" required>
                </div>
                <div class="form-group">
                    <label for="confirm_password">Confirm Password:</label>
                    <input type="password" id="confirm_password" name="confirm_password" minlength="8" required>
                </div>
                <button type="submit">Reset Password</button>
            </form>
            <div id="message"></div>
            <script>
                document.getElementById('resetForm').addEventListener('submit', async (e) => {{
                    e.preventDefault();
                    const token = document.getElementById('token').value;
                    const password = document.getElementById('password').value;
                    const confirmPassword = document.getElementById('confirm_password').value;
                    
                    if (password !== confirmPassword) {{
                        document.getElementById('message').innerHTML = '<p class="error">Passwords do not match</p>';
                        return;
                    }}
                    
                    const response = await fetch('/auth/reset-password', {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify({{ token, new_password: password }})
                    }});
                    
                    const result = await response.json();
                    const messageDiv = document.getElementById('message');
                    
                    if (response.ok) {{
                        messageDiv.innerHTML = '<p class="success">' + result.message + '</p>';
                        messageDiv.innerHTML += '<p>You can now <a href="/docs#/authentication/login">login</a> with your new password.</p>';
                    }} else {{
                        messageDiv.innerHTML = '<p class="error">' + (result.detail || 'Error resetting password') + '</p>';
                    }}
                }});
            </script>
        </body>
    </html>
    """)



    
    
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token,
        PasswordResetToken.is_used == False,
        PasswordResetToken.expires_at > datetime.utcnow()
    ).first()
    
    if not reset_token:
        return """
        <html>
            <body>
                <h1 class="error">Invalid or Expired Token</h1>
                <p>The password reset token is invalid or has expired.</p>
                <p>Please request a new password reset.</p>
            </body>
        </html>
        """
    
    
    return f"""
    <html>
        <head>
            <title>Reset Password</title>
            <style>
                body {{ font-family: Arial, sans-serif; padding: 50px; max-width: 500px; margin: 0 auto; }}
                .form-group {{ margin-bottom: 20px; }}
                label {{ display: block; margin-bottom: 5px; }}
                input {{ width: 100%; padding: 10px; box-sizing: border-box; }}
                button {{ padding: 12px 24px; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; }}
                .error {{ color: red; }}
                .success {{ color: green; }}
            </style>
        </head>
        <body>
            <h1>Set New Password</h1>
            <p>Please enter your new password.</p>
            <form id="resetForm">
                <input type="hidden" id="token" value="{token}">
                <div class="form-group">
                    <label for="password">New Password (min 8 characters):</label>
                    <input type="password" id="password" name="password" minlength="8" required>
                </div>
                <div class="form-group">
                    <label for="confirm_password">Confirm Password:</label>
                    <input type="password" id="confirm_password" name="confirm_password" minlength="8" required>
                </div>
                <button type="submit">Reset Password</button>
            </form>
            <div id="message"></div>
            <script>
                document.getElementById('resetForm').addEventListener('submit', async (e) => {{
                    e.preventDefault();
                    const token = document.getElementById('token').value;
                    const password = document.getElementById('password').value;
                    const confirmPassword = document.getElementById('confirm_password').value;
                    
                    if (password !== confirmPassword) {{
                        document.getElementById('message').innerHTML = '<p class="error">Passwords do not match</p>';
                        return;
                    }}
                    
                    const response = await fetch('/auth/reset-password', {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify({{ token, new_password: password }})
                    }});
                    
                    const result = await response.json();
                    const messageDiv = document.getElementById('message');
                    
                    if (response.ok) {{
                        messageDiv.innerHTML = `<p class="success">${{result.message}}</p>`;
                        messageDiv.innerHTML += '<p>You can now <a href="/docs#/authentication/login">login</a> with your new password.</p>';
                    }} else {{
                        messageDiv.innerHTML = `<p class="error">${{result.detail || 'Error resetting password'}}</p>`;
                    }}
                }});
            </script>
        </body>
    </html>
    """




@router.post("/signup", response_model=TokenResponse)
def signup(
    user_data: PatientSignupRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Register a new patient user"""
    
    # Normalize email to lowercase
    email = user_data.email.lower().strip()
    logger.info(f"Signup attempt for email: {email}, username: {user_data.username}")
    
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        logger.warning(f"Signup failed: Email already registered {email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    if user_data.username:
        existing_user = db.query(User).filter(User.username == user_data.username).first()
        if existing_user:
            logger.warning(f"Signup failed: Username already taken {user_data.username}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
    
    # Create new user with proper fields
    hashed_password = get_pass_hash(user_data.password)
    logger.info(f"Password hashed for {email}")
    
    user = User(
        email=email,
        username=user_data.username,
        hashed_password=hashed_password,
        phone_number=user_data.phone_number,
        is_caregiver=False,
        is_email_verified=False
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"User created successfully: ID {user.id}, email: {user.email}")
    
    # Verification: a 6-digit code (typed in the app) and a link, both emailed
    send_verification(db, user, background_tasks)

    # Patient signup defaults to patient user_type for downstream auth checks
    user_type = "patient"

    access_token, refresh_token = create_auth_tokens(user, db)
    logger.info(f"Auth tokens generated for user {user.id}")

    # Create session log
    session_token = generate_token()
    session = UserSession(
        user_id=user.id,
        session_token=session_token,
        expires_at=datetime.utcnow() + timedelta(days=30)
    )
    
    db.add(session)
    db.commit()
    logger.info(f"Session created for user {user.id}")
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user_type=user_type,
        user_id=user.id,
        email=user.email,
        is_email_verified=user.is_email_verified,
        username=user.username,
        is_caregiver=False,
        caregiver_id=None,
        profile_image=None
    )

@router.post("/login", response_model=TokenResponse)
def login_patient(
    login_data: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
):
    # Normalize email to lowercase
    email = login_data.email.lower().strip()
    client_ip = request.client.host if request.client else "unknown"
    lockout.check(email, client_ip)
    logger.info(f"Login attempt for email: {email}")
    
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        logger.warning(f"Login failed: User not found with email {email}")
        lockout.record_failure(email, client_ip)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    logger.info(f"User found: {user.id}, is_caregiver: {user.is_caregiver}")
    
    password_valid = verify_pass(login_data.password, user.hashed_password)
    logger.info(f"Password verification result: {password_valid}")
    
    if not password_valid:
        logger.warning(f"Login failed: Invalid password for user {user.id}")
        lockout.record_failure(email, client_ip)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    lockout.clear(email, client_ip)
    user.last_login = datetime.utcnow()
    db.commit()
    logger.info(f"Login successful for user {user.id}")

    access_token, refresh_token = create_auth_tokens(user, db)
    create_session_log(db, user.id, request)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user_type="caregiver" if user.is_caregiver else "patient",
        user_id=user.id,
        caregiver_id=user.caregiver_id if user.is_caregiver else None,
        email=user.email,
        username=user.username,
        is_email_verified=user.is_email_verified,
        is_caregiver=user.is_caregiver,
        profile_image=_photo(db, user)
    )

@router.post("/signup/caregiver", response_model=CaregiverSignupResponse)
def signup_caregiver(
    caregiver_data: CaregiverSignupRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # Normalize email to lowercase
    email = caregiver_data.email.lower().strip()
    logger.info(f"Caregiver signup attempt for email: {email}")
    
    if not caregiver_data.agree_to_terms:
        logger.warning(f"Caregiver signup failed: User did not agree to terms")
        raise HTTPException(status_code=400, detail="You must agree to the terms")

    if db.query(User).filter(User.email == email).first():
        logger.warning(f"Caregiver signup failed: Email already registered {email}")
        raise HTTPException(status_code=400, detail="Email already registered")

    caregiver_id = f"CG{uuid.uuid4().hex[:8].upper()}"
    username = f"{caregiver_data.first_name.lower()}.{caregiver_data.last_name.lower()}"
    
    count = 1
    original_username = username
    while db.query(User).filter(User.username == username).first():
        username = f"{original_username}{count}"
        count += 1

    logger.info(f"Creating caregiver user with ID: {caregiver_id}, username: {username}")

    new_user = User(
        email=email,
        username=username,
        hashed_password=get_pass_hash(caregiver_data.password),
        first_name=caregiver_data.first_name,
        last_name=caregiver_data.last_name,
        phone_number=caregiver_data.phone_number,
        is_caregiver=True,
        caregiver_id=caregiver_id,
        caregiver_type=caregiver_data.caregiver_type,
        is_email_verified=False
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    logger.info(f"Caregiver created successfully: ID {new_user.id}, caregiver_id: {caregiver_id}")

    send_verification(db, new_user, background_tasks)

    access_token, refresh_token = create_auth_tokens(new_user, db)
    logger.info(f"Auth tokens generated for caregiver {new_user.id}")

    return {
        "user_type": "caregiver",
        "caregiver_id": caregiver_id,
        "email": new_user.email,
        "first_name": new_user.first_name,
        "last_name": new_user.last_name,
        "caregiver_type": new_user.caregiver_type,
        "message": "Caregiver account created successfully",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user_id": new_user.id,
        "username": new_user.username
    }


class VerifyEmailCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)


class ResetPasswordCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)


GENERIC_RESET = "If an account exists for that address, we have sent a code and a link to reset the password."
GENERIC_VERIFY = "If that account exists and is not verified yet, we have sent a new code and link."
GENERIC_OTP = "If an account exists for that address, a sign-in code has been sent."


def _finish_reset(db: Session, email: str, new_password: str, background_tasks: BackgroundTasks) -> None:
    """Set the new password, cancel every pending reset, sign the person out everywhere else, and tell them by email."""
    user = auth_mail.user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")
    user.hashed_password = get_pass_hash(new_password)
    db.query(PasswordResetToken).filter(func.lower(PasswordResetToken.email) == auth_mail.norm(email)).delete(synchronize_session=False)
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({"is_revoked": True})
    db.query(UserSession).filter(UserSession.user_id == user.id).update({"is_active": False})
    db.commit()
    background_tasks.add_task(email_service.send_password_changed_email, user.email, auth_mail.display_name(user))


@router.post("/forgot-password")
def forgot_password(request_data: ForgotPasswordRequest, background_tasks: BackgroundTasks, request: Request, db: Session = Depends(get_db)):
    """Email a 6-digit code and a link. The answer is the same whether or not the address has an account."""
    email = auth_mail.norm(request_data.email)
    auth_mail.limit_requests("reset", email, request, 3, 3600)
    user = auth_mail.user_by_email(db, email)
    if user:
        raw, code = auth_mail.issue_reset(db, email)
        background_tasks.add_task(email_service.send_password_reset_email, user.email, raw, code)
    return {"message": GENERIC_RESET}


@router.post("/reset-password")
def reset_password(request_data: ResetPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Reset with the link token (the web page uses this)."""
    row = auth_mail.reset_by_token(db, request_data.token)
    if not row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    _finish_reset(db, row.email, request_data.new_password, background_tasks)
    return {"message": "Password reset successfully"}


@router.post("/reset-password-code")
def reset_password_code(request_data: ResetPasswordCodeRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Reset with the 6-digit code from the email (the app uses this)."""
    email = auth_mail.norm(request_data.email)
    auth_mail.guard_codes(db, "reset", email)
    row = auth_mail.reset_by_code(db, email, request_data.code)
    if not row:
        auth_mail.wrong_code("reset", email)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code is wrong or has expired")
    _finish_reset(db, email, request_data.new_password, background_tasks)
    return {"message": "Password reset successfully"}


@router.post("/verify-email")
def verify_email(request_data: VerifyEmailRequest, db: Session = Depends(get_db)):
    """Verify with the link token."""
    row = auth_mail.verification_by_token(db, request_data.token)
    user = db.query(User).filter(User.id == row.user_id).first() if row else None
    if not row or not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")
    auth_mail.mark_verified(db, user)
    return {"message": "Email verified successfully"}


@router.post("/verify-email-code")
def verify_email_code(request_data: VerifyEmailCodeRequest, db: Session = Depends(get_db)):
    """Verify with the 6-digit code from the email (the app uses this)."""
    email = auth_mail.norm(request_data.email)
    auth_mail.guard_codes(db, "verify", email)
    user = auth_mail.user_by_email(db, email)
    row = auth_mail.verification_by_code(db, user, request_data.code) if user else None
    if not row:
        auth_mail.wrong_code("verify", email)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code is wrong or has expired")
    auth_mail.mark_verified(db, user)
    return {"message": "Email verified successfully"}


def send_verification(db: Session, user: User, background_tasks: BackgroundTasks) -> None:
    raw, code = auth_mail.issue_verification(db, user)
    if user.is_caregiver and user.caregiver_id:
        background_tasks.add_task(email_service.send_caregiver_welcome_email, user.email, auth_mail.display_name(user), user.caregiver_id, raw, code)
    else:
        background_tasks.add_task(email_service.send_welcome_email, user.email, auth_mail.display_name(user), raw, code)


@router.post("/resend-verification")
def resend_verification(request_data: ForgotPasswordRequest, background_tasks: BackgroundTasks, request: Request, db: Session = Depends(get_db)):
    email = auth_mail.norm(request_data.email)
    auth_mail.limit_requests("verify", email, request, 3, 3600)
    user = auth_mail.user_by_email(db, email)
    if user and not user.is_email_verified:
        send_verification(db, user, background_tasks)
    return {"message": GENERIC_VERIFY}


@router.post("/login/otp/request")
def request_otp_login(request_data: RequestOTPLogin, background_tasks: BackgroundTasks, request: Request, db: Session = Depends(get_db)):
    """Email a one-time sign-in code. Same answer whether or not the address has an account."""
    email = auth_mail.norm(request_data.email)
    auth_mail.limit_requests("otp", email, request, 3, 600)
    user = auth_mail.user_by_email(db, email)
    if user:
        otp = generate_otp()
        # an earlier code stays valid until its own 10 minutes are over, so asking again never breaks the email you already have
        db.add(LoginOTP(email=email, otp=otp, expires_at=datetime.utcnow() + timedelta(minutes=auth_mail.CODE_MINUTES)))
        db.commit()
        background_tasks.add_task(email_service.send_otp_email, user.email, auth_mail.display_name(user), otp)
    return {"message": GENERIC_OTP, "delivery_method": "email"}


@router.post("/login/otp/verify")
def verify_otp_login(request_data: VerifyOTPLogin, request: Request, db: Session = Depends(get_db)):
    """Sign in with the emailed code. 5 wrong tries destroy it, it works once, and only for 10 minutes."""
    email = auth_mail.norm(request_data.email)
    try:
        simple_limiter.check(f"wrong:otp:{email}", 5, 900, "Too many wrong codes. Please ask for a new code.")
    except HTTPException:
        db.query(LoginOTP).filter(func.lower(LoginOTP.email) == email, LoginOTP.is_used == False).update({"is_used": True}, synchronize_session=False)  # noqa: E712
        db.commit()
        raise
    live = (db.query(LoginOTP).filter(func.lower(LoginOTP.email) == email, LoginOTP.is_used == False, LoginOTP.expires_at > datetime.utcnow())  # noqa: E712
            .order_by(LoginOTP.id.desc()).all())
    login_otp = next((o for o in live if hmac.compare_digest(str(o.otp or ""), request_data.otp)), None)
    if not login_otp:
        simple_limiter.record(f"wrong:otp:{email}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code is wrong or has expired")
    user = auth_mail.user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code is wrong or has expired")

    login_otp.is_used = True
    user.last_login = datetime.utcnow()
    user.is_email_verified = True                      # only the owner of the mailbox can have read the code
    db.commit()

    access_token, refresh_token = create_auth_tokens(user, db)          # exactly what a password sign-in produces
    create_session_log(db, user.id, request)
    return TokenResponse(
        access_token=access_token, refresh_token=refresh_token, token_type="bearer",
        user_type="caregiver" if user.is_caregiver else "patient", user_id=user.id,
        caregiver_id=user.caregiver_id if user.is_caregiver else None, email=user.email, username=user.username,
        is_email_verified=user.is_email_verified, is_caregiver=user.is_caregiver, profile_image=_photo(db, user),
    )


@router.post("/change-password")
def change_password(
    request_data: ChangePasswordRequest,
    background_tasks: BackgroundTasks,
    current: Union[User, Admin] = Depends(get_current_user_or_admin),
    db: Session = Depends(get_db)
):
    """Change password (works for both users and admins). The person is told by email, and signed out of their other devices."""
    from app.auth.hashing import verify_password as verify_pass

    if not verify_pass(request_data.current_password, current.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your current password is not correct")
    if verify_pass(request_data.new_password, current.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a password that is different from your current one")
    current.hashed_password = get_pass_hash(request_data.new_password)
    if not isinstance(current, Admin):
        db.query(RefreshToken).filter(RefreshToken.user_id == current.id).update({"is_revoked": True})
    db.commit()
    if not isinstance(current, Admin) and current.email:
        background_tasks.add_task(email_service.send_password_changed_email, current.email, auth_mail.display_name(current))
    return {"message": "Password changed successfully"}

class RefreshIn(BaseModel):
    refresh_token: Optional[str] = None


@router.post("/token/refresh")
def refresh_token(
    body: Optional[RefreshIn] = None,
    refresh_token: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Renew the access token. The app sends the refresh token in the JSON body; the older form (a query parameter) still works."""
    refresh_token = (body.refresh_token if body else None) or refresh_token
    if not refresh_token:
        raise HTTPException(status_code=422, detail="refresh_token is required")
    token_record = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_token,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at > datetime.utcnow()
    ).first()
    
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user = db.query(User).filter(User.id == token_record.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    
    kind = "caregiver" if user.is_caregiver else "patient"          # the live connection only accepts these two kinds
    access_token = create_access_token(
        data={"sub": str(user.id)},
        user_type=kind
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_type": kind
    }

@router.post("/logout")
def logout(
    current: Union[User, Admin] = Depends(get_current_user_or_admin),  
    db: Session = Depends(get_db)
):
    """Logout user or admin"""
    if isinstance(current, Admin):
        
        return {"message": "Admin logged out successfully"}
    
    
    db.query(RefreshToken).filter(RefreshToken.user_id == current.id).update({"is_revoked": True})
    db.query(UserSession).filter(UserSession.user_id == current.id).update({"is_active": False})
    db.commit()
    
    return {"message": "Logged out successfully"}


@router.get("/me")
def get_current_user_info(
    current: Union[User, Admin] = Depends(get_current_user_or_admin)  
):
    """Get current user or admin information"""
    if isinstance(current, Admin):
        
        return {
            "id": current.id,
            "email": current.email,
            "full_name": current.full_name,
            "is_superadmin": current.is_superadmin,
            "is_active": current.is_active,
            "user_type": "admin",
            "last_login": current.last_login,
            "created_at": current.created_at
        }
    else:
        
        return {
            "id": current.id,
            "email": current.email,
            "username": current.username,
            "patient_id": current.patient_id,
            "is_email_verified": current.is_email_verified,
            "is_active": current.is_active,
            "is_caregiver": current.is_caregiver,
            "phone_number": current.phone_number,
            "last_login": current.last_login,
            "created_at": current.created_at,
            "user_type": "user"
        }

@router.get("/sessions")
def get_user_sessions(
    current: Union[User, Admin] = Depends(get_current_user_or_admin),  
    db: Session = Depends(get_db)
):
    """Get user's active sessions (also works for admin)"""
    
    
    if isinstance(current, Admin):
        
        
        return {
            "message": "Admin sessions are managed separately",
            "admin_id": current.id,
            "sessions": []
        }
    
    
    sessions = db.query(UserSession).filter(
        UserSession.user_id == current.id,
        UserSession.is_active == True,
        UserSession.expires_at > datetime.utcnow()
    ).order_by(UserSession.last_activity.desc()).all()
    
    return [
        {
            "id": session.id,
            "device_info": session.device_info,
            "ip_address": session.ip_address,
            "last_activity": session.last_activity,
            "created_at": session.created_at
        }
        for session in sessions
    ]

from fastapi.responses import HTMLResponse, RedirectResponse


@router.delete("/sessions/{session_id}")
def revoke_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke a specific session"""
    session = db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    session.is_active = False
    db.commit()
    
    return {"message": "Session revoked"}