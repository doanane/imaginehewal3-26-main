"""Real email through SendGrid (HTTPS API v3, no SDK needed, so nothing can be "not installed").

What this sends: the signup verification (a 6-digit code and a link), the password reset (code and link), the sign-in code, the "your password
was changed" notice, the caregiver welcome and an admin invitation. Doctor-portal emails also use `send_email`.

Rules that keep it safe and reliable:
- Never raises: a failed email is logged (with SendGrid's own reason) and the app carries on. Callers run it in a background task.
- Retries twice on a network error, a 429 or a 5xx; never on a 4xx that retrying cannot fix (bad key, unverified sender).
- Click and open tracking are OFF: SendGrid rewrites links when tracking is on, which breaks reset and verification links and looks like phishing.
- Everything shown from user input is HTML-escaped. Secrets (the key, the codes) are never logged. Addresses are masked in logs.
- If SendGrid cannot send (no credits, rejected key, unverified sender) and SMTP_HOST is set, the email goes by SMTP instead (for example Gmail with an
  app password, or Brevo). SMTP alone also works when there is no SendGrid key.
- The sender (FROM_EMAIL) must be verified in SendGrid (Settings > Sender Authentication). Until it is, SendGrid answers 403 and we log exactly that.
"""
import html
import json
import logging
import os
import smtplib
import ssl
import time
from email.message import EmailMessage
from email.utils import formataddr
from datetime import datetime, timezone
from typing import Dict, Optional

import requests

from app.config import settings

logger = logging.getLogger(__name__)

API = "https://api.sendgrid.com/v3/mail/send"
TEAL, INK, MUTED, PAGE, LINE = "#0B6E6E", "#1B2733", "#5B6B7A", "#F4F7FA", "#E3E9EF"

_SENDGRID_REASONS = {
    401: "SendGrid rejected the API key (SENDGRID_API_KEY is wrong, revoked or lacks 'Mail Send' permission).",
    403: "SendGrid refused the sender address. Verify FROM_EMAIL in SendGrid: Settings > Sender Authentication > Single Sender Verification (or authenticate your domain).",
    429: "SendGrid rate limit or free-plan daily quota reached.",
}


def mask(addr: str) -> str:
    try:
        name, domain = addr.split("@", 1)
        return f"{name[:1]}***@{domain}"
    except ValueError:
        return "***"


def _logo_url() -> Optional[str]:
    try:
        with open(os.path.join(os.path.dirname(__file__), "..", "data", "brand.json"), encoding="utf-8") as f:
            return json.load(f).get("logo_url")
    except Exception:
        return None


def esc(s: object) -> str:
    return html.escape(str(s if s is not None else ""), quote=True)


def code_box(code: str) -> str:
    spaced = "&nbsp;".join(esc(code))
    return (f'<div style="margin:22px 0;padding:18px 12px;text-align:center;background:#E8F3F2;border:1px solid #CFE6E3;border-radius:14px;">'
            f'<div style="font-family:Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:6px;color:{TEAL};">{spaced}</div></div>')


def button(label: str, url: str) -> str:
    return (f'<p style="text-align:center;margin:26px 0;"><a href="{esc(url)}" style="display:inline-block;background:{TEAL};color:#ffffff;'
            f'text-decoration:none;font-weight:600;font-size:16px;padding:14px 28px;border-radius:12px;">{esc(label)}</a></p>'
            f'<p style="font-size:13px;color:{MUTED};word-break:break-all;">If the button does not open, copy this link into your browser:<br>{esc(url)}</p>')


def shell(title: str, preheader: str, body: str, footer_note: str = "") -> str:
    logo = _logo_url()
    head = (f'<img src="{esc(logo)}" width="120" height="120" alt="HEWAL3" style="display:block;margin:0 auto;border:0;">' if logo
            else f'<div style="font-size:28px;font-weight:800;letter-spacing:2px;color:{TEAL};text-align:center;">HEWAL3</div>')
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)}</title></head>
<body style="margin:0;padding:0;background:{PAGE};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:{INK};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAGE};padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;border:1px solid {LINE};overflow:hidden;">
<tr><td style="height:6px;background:{TEAL};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:22px 24px 0;">{head}</td></tr>
<tr><td style="padding:8px 28px 28px;font-size:16px;line-height:1.6;">
<h1 style="font-size:22px;line-height:1.3;margin:12px 0 14px;color:{INK};">{esc(title)}</h1>
{body}
</td></tr>
<tr><td style="padding:18px 28px 24px;border-top:1px solid {LINE};font-size:12px;line-height:1.6;color:{MUTED};">
{footer_note}
HEWAL3 supports your care and does not replace your clinician. Questions? Write to {esc(settings.HEWAL3_SUPPORT_EMAIL)}.
</td></tr></table></td></tr></table></body></html>"""


class EmailService:
    def __init__(self):
        self.last_error: Optional[str] = None
        self.last_status: Optional[int] = None
        if not self.configured:
            logger.warning("Email is NOT configured: set SENDGRID_API_KEY and FROM_EMAIL in back/.env. Emails will only be logged.")
        else:
            logger.info("Email via SendGrid is configured (sender %s)", mask(self.from_email))
        base = (self.base_url or "").lower()
        if base.startswith("http://localhost") or base.startswith("http://127."):
            logger.warning("BASE_URL is %s: the links in emails will not open on a phone. Set BASE_URL to the public https address of this backend.", self.base_url)

    # ---- settings are read at send time so a changed .env or a test can take effect
    @property
    def api_key(self) -> str:
        return (os.getenv("SENDGRID_API_KEY") or settings.SENDGRID_API_KEY or "").strip()

    @property
    def from_email(self) -> str:
        return (os.getenv("FROM_EMAIL") or settings.FROM_EMAIL or "").strip()

    @property
    def from_name(self) -> str:
        return os.getenv("EMAIL_FROM_NAME", "HEWAL3")

    @property
    def support_email(self) -> str:
        return settings.HEWAL3_SUPPORT_EMAIL

    @property
    def base_url(self) -> str:
        return (os.getenv("BASE_URL") or settings.BASE_URL or "").rstrip("/")

    @property
    def sendgrid_configured(self) -> bool:
        return bool(self.api_key and self.from_email and os.getenv("EMAIL_ENABLED", "1") != "0")

    @property
    def smtp_configured(self) -> bool:
        return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD") and os.getenv("EMAIL_ENABLED", "1") != "0")

    @property
    def configured(self) -> bool:
        return self.sendgrid_configured or self.smtp_configured

    @property
    def sandbox(self) -> bool:
        return os.getenv("EMAIL_SANDBOX", "0") == "1"             # SendGrid accepts and validates the message but delivers nothing

    # ------------------------------------------------------------------ sending
    def send_email(self, to_email: str, subject: str, html_content: str, text_content: Optional[str] = None, category: str = "app") -> bool:
        """True when SendGrid accepted the message (HTTP 202). Never raises."""
        self.last_error, self.last_status = None, None
        if not to_email or "@" not in to_email:
            self.last_error = "no recipient address"
            return False
        if not self.configured:
            self.last_error = "email is not configured"
            logger.info("Email NOT sent (not configured) to %s: %s", mask(to_email), subject if settings.ENVIRONMENT == "development" else "(subject hidden)")
            return False
        text = text_content or html.unescape(_strip_tags(html_content))
        if self.sendgrid_configured and self._send_sendgrid(to_email, subject, html_content, text, category):
            return True
        if self.smtp_configured:
            first = self.last_error
            if self._send_smtp(to_email, subject, html_content, text):
                return True
            self.last_error = f"{first + ' | ' if first else ''}SMTP: {self.last_error}"
        return False

    def _send_sendgrid(self, to_email: str, subject: str, html_content: str, text: str, category: str) -> bool:
        payload: Dict = {
            "personalizations": [{"to": [{"email": to_email}]}],
            "from": {"email": self.from_email, "name": self.from_name},
            "reply_to": {"email": self.support_email},
            "subject": subject,
            "content": [{"type": "text/plain", "value": text}, {"type": "text/html", "value": html_content}],
            "categories": [category],
            "tracking_settings": {"click_tracking": {"enable": False, "enable_text": False}, "open_tracking": {"enable": False}},
        }
        if self.sandbox:
            payload["mail_settings"] = {"sandbox_mode": {"enable": True}}
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        for attempt in range(3):
            try:
                r = requests.post(API, headers=headers, data=json.dumps(payload), timeout=15)
            except requests.RequestException as e:
                self.last_error = f"network error: {e.__class__.__name__}"
                logger.warning("Email to %s: %s (attempt %d)", mask(to_email), self.last_error, attempt + 1)
                time.sleep(1.5 * (attempt + 1))
                continue
            self.last_status = r.status_code
            if r.status_code in (200, 201, 202):
                logger.info("Email sent to %s [%s] %s", mask(to_email), category, "(sandbox, not delivered)" if self.sandbox else "")
                return True
            detail = _reason(r)
            base = _SENDGRID_REASONS.get(r.status_code, f"SendGrid answered {r.status_code}")
            if "credit" in detail.lower() or "quota" in detail.lower():
                base = "Your SendGrid account has no sending credits left (free quota or trial used up). Check Settings > Account Details > Plan in SendGrid, upgrade, or use SMTP."
            self.last_error = base + (f" SendGrid says: {detail}" if detail else "")
            if r.status_code == 429 or r.status_code >= 500:
                logger.warning("Email to %s: %s (attempt %d)", mask(to_email), self.last_error, attempt + 1)
                time.sleep(1.5 * (attempt + 1))
                continue
            logger.error("Email to %s FAILED via SendGrid: %s", mask(to_email), self.last_error)          # a 4xx cannot be fixed by trying again
            return False
        logger.error("Email to %s FAILED via SendGrid after retries: %s", mask(to_email), self.last_error)
        return False

    def _send_smtp(self, to_email: str, subject: str, html_content: str, text: str) -> bool:
        """Plain SMTP with TLS: Gmail (smtp.gmail.com, an app password), Brevo, Zoho, your own server. The sender must be allowed by that server."""
        host, port = os.getenv("SMTP_HOST", ""), int(os.getenv("SMTP_PORT", "587"))
        user, password = os.getenv("SMTP_USER", ""), os.getenv("SMTP_PASSWORD", "")
        sender = os.getenv("SMTP_FROM") or self.from_email or user
        msg = EmailMessage()
        msg["Subject"], msg["From"], msg["To"], msg["Reply-To"] = subject, formataddr((self.from_name, sender)), to_email, self.support_email
        msg.set_content(text)
        msg.add_alternative(html_content, subtype="html")
        try:
            ctx = ssl.create_default_context()
            if port == 465:
                with smtplib.SMTP_SSL(host, port, context=ctx, timeout=20) as srv:
                    srv.login(user, password)
                    srv.send_message(msg)
            else:
                with smtplib.SMTP(host, port, timeout=20) as srv:
                    srv.starttls(context=ctx)
                    srv.login(user, password)
                    srv.send_message(msg)
        except smtplib.SMTPAuthenticationError:
            self.last_error = "the SMTP server refused the user name or password (for Gmail use an App Password, not your normal password)"
        except Exception as e:
            self.last_error = f"{e.__class__.__name__}: {str(e)[:150]}"
        else:
            logger.info("Email sent to %s by SMTP", mask(to_email))
            return True
        logger.error("Email to %s FAILED via SMTP: %s", mask(to_email), self.last_error)
        return False

    # ------------------------------------------------------------------ the emails
    def send_welcome_email(self, user_email: str, user_name: str, verification_token: str, code: Optional[str] = None) -> bool:
        """Signup verification: the 6-digit code to type in the app, and a link that works in any browser."""
        link = f"{self.base_url}/auth/verify-email-page/{verification_token}"
        body = (f"<p>Hello {esc(user_name)},</p><p>Welcome to HEWAL3. Please confirm this email address so we can reach you about your account.</p>"
                + (f"<p>Enter this code in the app:</p>{code_box(code)}<p style=\"color:{MUTED};font-size:14px;\">Or open the link below on any device.</p>" if code else "")
                + button("Verify my email", link)
                + f'<p style="font-size:14px;color:{MUTED};">The code and link work for 24 hours. If you did not create a HEWAL3 account, you can ignore this email.</p>')
        text = (f"Hello {user_name},\n\nWelcome to HEWAL3. Confirm your email address.\n" + (f"\nYour code: {code}\n" if code else "")
                + f"\nOr open: {link}\n\nThe code and link work for 24 hours. If you did not create an account, ignore this email.\n")
        return self.send_email(user_email, "Verify your HEWAL3 email" if not code else f"Your HEWAL3 verification code: {code}",
                               shell("Confirm your email", "Your HEWAL3 verification code and link", body), text, "verify_email")

    def send_password_reset_email(self, user_email: str, reset_token: str, code: Optional[str] = None) -> bool:
        link = f"{self.base_url}/auth/reset-password-page?token={reset_token}"
        body = ("<p>We received a request to reset the password of your HEWAL3 account.</p>"
                + (f"<p>Enter this code in the app, then choose a new password:</p>{code_box(code)}<p style=\"color:{MUTED};font-size:14px;\">Or use the link below.</p>" if code else "")
                + button("Choose a new password", link)
                + f'<p style="font-size:14px;color:{MUTED};"><strong>This code and link work for 1 hour.</strong> If you did not ask for this, ignore this email: your password has not changed. '
                  'Never share this code with anyone, including HEWAL3 staff.</p>')
        text = ("We received a request to reset your HEWAL3 password.\n" + (f"\nYour code: {code}\n" if code else "")
                + f"\nOr open: {link}\n\nWorks for 1 hour. If you did not ask for this, ignore this email. Never share this code.\n")
        return self.send_email(user_email, "Reset your HEWAL3 password" if not code else f"Your HEWAL3 password reset code: {code}",
                               shell("Reset your password", "Your HEWAL3 password reset code and link", body), text, "password_reset")

    def send_otp_email(self, user_email: str, user_name: str, otp: str) -> bool:
        body = (f"<p>Hello {esc(user_name)},</p><p>Use this code to sign in to HEWAL3:</p>{code_box(otp)}"
                f'<p style="font-size:14px;color:{MUTED};"><strong>It works for 10 minutes and only once.</strong> If you did not try to sign in, someone may know your email address: '
                'ignore this message and consider changing your password. Never share this code.</p>')
        text = f"Hello {user_name},\n\nYour HEWAL3 sign-in code: {otp}\n\nIt works for 10 minutes and only once. Never share it. If you did not try to sign in, ignore this email.\n"
        return self.send_email(user_email, f"Your HEWAL3 sign-in code: {otp}", shell("Your sign-in code", f"Your HEWAL3 sign-in code is {otp}", body), text, "login_code")

    def send_password_changed_email(self, user_email: str, user_name: str) -> bool:
        when = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
        reset = f"{self.base_url}/auth/reset-password-page"
        body = (f"<p>Hello {esc(user_name)},</p><p>The password of your HEWAL3 account was changed on <strong>{esc(when)}</strong>. You were signed out of your other devices.</p>"
                f'<p style="background:#FFF4E5;border:1px solid #F5D9A8;border-radius:12px;padding:12px 14px;font-size:15px;"><strong>Was this not you?</strong> '
                f'Reset your password straight away from the sign-in screen (Forgot password), and write to {esc(self.support_email)}.</p>')
        text = f"Hello {user_name},\n\nYour HEWAL3 password was changed on {when}. You were signed out of your other devices.\n\nWas this not you? Use Forgot password on the sign-in screen now, and write to {self.support_email}.\n"
        return self.send_email(user_email, "Your HEWAL3 password was changed", shell("Your password was changed", "Your HEWAL3 password was changed", body), text, "password_changed")

    def send_caregiver_welcome_email(self, to_email: str, full_name: str, caregiver_id: str, verification_token: str, code: Optional[str] = None) -> bool:
        link = f"{self.base_url}/auth/verify-email-page/{verification_token}"
        body = (f"<p>Hello {esc(full_name)},</p><p>Thank you for registering as a caregiver on HEWAL3. Patients connect with you using your Caregiver ID:</p>"
                f'<p style="text-align:center;font-size:22px;font-weight:700;letter-spacing:1px;color:{TEAL};">{esc(caregiver_id)}</p>'
                + (f"<p>Please confirm your email with this code in the app:</p>{code_box(code)}" if code else "")
                + button("Verify my email", link)
                + f'<p style="font-size:14px;color:{MUTED};">You only see a patient\'s health information after that patient approves your request.</p>')
        text = (f"Hello {full_name},\n\nWelcome to HEWAL3 as a caregiver. Your Caregiver ID: {caregiver_id}\n" + (f"\nYour code: {code}\n" if code else "")
                + f"\nOr verify here: {link}\n")
        return self.send_email(to_email, "Welcome to HEWAL3 for caregivers", shell("Welcome, caregiver", f"Your Caregiver ID is {caregiver_id}", body), text, "caregiver_welcome")

    def send_user_invitation(self, email: str, temp_password: str, role: str) -> bool:
        body = (f"<p>An administrator created a HEWAL3 <strong>{esc(role)}</strong> account for you.</p><p>Your temporary password:</p>{code_box(temp_password)}"
                '<p style="font-size:14px;color:#5B6B7A;">Sign in with this email address and the temporary password, then change it straight away in your profile (Change password).</p>')
        return self.send_email(email, "You have been invited to HEWAL3", shell("You are invited", "Your HEWAL3 account is ready", body),
                               f"An administrator created a HEWAL3 {role} account for you.\nTemporary password: {temp_password}\nSign in and change it straight away.\n", "invitation")

    def send_account_deleted_email(self, user_email: str, user_name: str) -> bool:
        body = (f"<p>Hello {esc(user_name)},</p><p>As you asked, your HEWAL3 account and the information linked to it have been permanently deleted. We cannot restore it.</p>"
                f'<p style="font-size:14px;color:{MUTED};">If you did not ask for this, write to {esc(self.support_email)} at once.</p>')
        return self.send_email(user_email, "Your HEWAL3 account was deleted", shell("Your account was deleted", "Your HEWAL3 account was deleted", body),
                               f"Hello {user_name},\n\nYour HEWAL3 account and linked information were permanently deleted at your request.\nIf this was not you, write to {self.support_email} at once.\n", "account_deleted")


def _strip_tags(s: str) -> str:
    import re
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()


def _reason(r: requests.Response) -> str:
    try:
        errs = r.json().get("errors") or []
        return "; ".join(str(e.get("message", "")) for e in errs)[:300]
    except Exception:
        return (r.text or "")[:200]


email_service = EmailService()
