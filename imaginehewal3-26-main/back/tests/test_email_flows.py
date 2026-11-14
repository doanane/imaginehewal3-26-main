"""Real email through SendGrid, tested without sending anything: the SendGrid call is intercepted and the message it would carry is checked.

Covers the sender (payload, errors, retries), signup verification (code and link), password reset (code and link), the sign-in code, the
"password changed" notice, change password, rate limits and guess limits, the two web pages, and that nothing leaks whether an address has an account.
"""
import os
import re
import uuid

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

import pytest
import requests
from fastapi.testclient import TestClient

PASSWORD = "TestPassword123!"
NEW_PASSWORD = "BrandNewPass456!"


class FakeSendGrid:
    def __init__(self):
        self.calls = []
        self.status = 202
        self.body = {}
        self.raise_error = None

    def post(self, url, headers=None, data=None, timeout=None, **kw):
        import json
        if self.raise_error:
            raise self.raise_error
        self.calls.append({"url": url, "headers": headers, "json": json.loads(data), "timeout": timeout})
        resp = requests.Response()
        resp.status_code = self.status
        resp._content = __import__("json").dumps(self.body).encode()
        return resp

    def to(self, address):
        return [c["json"] for c in self.calls if c["json"]["personalizations"][0]["to"][0]["email"].lower() == address.lower()]

    def last_text(self, address):
        return self.to(address)[-1]["content"][0]["value"]


@pytest.fixture()
def sg(monkeypatch):
    fake = FakeSendGrid()
    monkeypatch.setenv("SENDGRID_API_KEY", "SG.test-key")
    monkeypatch.setenv("FROM_EMAIL", "noreply@example.com")
    monkeypatch.setenv("EMAIL_ENABLED", "1")
    monkeypatch.setenv("EMAIL_SANDBOX", "0")
    monkeypatch.setattr("app.services.email_service.requests.post", fake.post)
    monkeypatch.setattr("app.services.email_service.time.sleep", lambda s: None)
    from app.services import simple_limiter
    simple_limiter.reset()
    return fake


@pytest.fixture(scope="module")
def client():
    from app.main import app
    return TestClient(app)


def _code(text: str) -> str:
    return re.search(r"Your code: (\d{6})", text).group(1)


def _link_token(text: str, marker: str) -> str:
    return re.search(marker + r"([A-Za-z0-9_\-]+)", text).group(1)


def _signup(client, name=None):
    t = uuid.uuid4().hex[:10]
    body = {"email": f"mail_{t}@example.com", "password": PASSWORD, "username": name or f"mail_{t}", "phone_number": "+233200000000"}
    r = client.post("/auth/signup", json=body)
    assert r.status_code == 200, r.text
    return {**body, **r.json()}


def _login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password})


# ------------------------------------------------------------------ the sender
def test_the_message_sent_to_sendgrid_is_correct(sg):
    from app.services.email_service import EmailService
    svc = EmailService()
    assert svc.send_email("ama@example.com", "Hello", "<p>Hi <b>there</b></p>", category="test") is True
    c = sg.calls[0]
    assert c["url"] == "https://api.sendgrid.com/v3/mail/send" and c["headers"]["Authorization"] == "Bearer SG.test-key"
    m = c["json"]
    assert m["from"] == {"email": "noreply@example.com", "name": "HEWAL3"} and m["reply_to"]["email"]
    assert m["categories"] == ["test"] and m["subject"] == "Hello"
    assert [x["type"] for x in m["content"]] == ["text/plain", "text/html"] and "Hi there" in m["content"][0]["value"]
    assert m["tracking_settings"]["click_tracking"]["enable"] is False and m["tracking_settings"]["open_tracking"]["enable"] is False
    assert "mail_settings" not in m


def test_sandbox_mode_asks_sendgrid_not_to_deliver(sg, monkeypatch):
    from app.services.email_service import EmailService
    monkeypatch.setenv("EMAIL_SANDBOX", "1")
    EmailService().send_email("a@example.com", "s", "<p>x</p>")
    assert sg.calls[0]["json"]["mail_settings"]["sandbox_mode"]["enable"] is True


def test_an_unverified_sender_is_explained_and_not_retried(sg):
    from app.services.email_service import EmailService
    sg.status, sg.body = 403, {"errors": [{"message": "The from address does not match a verified Sender Identity."}]}
    svc = EmailService()
    assert svc.send_email("a@example.com", "s", "<p>x</p>") is False
    assert len(sg.calls) == 1                                                   # a 4xx cannot be fixed by trying again
    assert "Verify FROM_EMAIL" in svc.last_error and "verified Sender Identity" in svc.last_error


def test_a_wrong_api_key_is_explained(sg):
    from app.services.email_service import EmailService
    sg.status = 401
    svc = EmailService()
    assert svc.send_email("a@example.com", "s", "<p>x</p>") is False and "API key" in svc.last_error


def test_temporary_failures_are_retried_then_given_up(sg):
    from app.services.email_service import EmailService
    sg.status = 503
    svc = EmailService()
    assert svc.send_email("a@example.com", "s", "<p>x</p>") is False and len(sg.calls) == 3
    sg.calls.clear(); sg.raise_error = requests.ConnectionError("down")
    assert EmailService().send_email("a@example.com", "s", "<p>x</p>") is False


def test_nothing_is_sent_and_nothing_breaks_when_email_is_not_configured(sg, monkeypatch):
    from app.services.email_service import EmailService
    monkeypatch.setenv("SENDGRID_API_KEY", "")
    monkeypatch.setattr("app.config.settings.SENDGRID_API_KEY", "")
    svc = EmailService()
    assert svc.configured is False and svc.send_email("a@example.com", "s", "<p>x</p>") is False and sg.calls == []


def test_user_text_in_an_email_is_escaped(sg):
    from app.services.email_service import EmailService
    EmailService().send_otp_email("a@example.com", "<script>alert(1)</script>", "123456")
    html = sg.calls[0]["json"]["content"][1]["value"]
    assert "<script>alert(1)</script>" not in html and "&lt;script&gt;" in html


# ------------------------------------------------------------------ verify email
def test_signup_emails_a_code_and_a_link_and_the_code_verifies(client, sg):
    u = _signup(client)
    mails = sg.to(u["email"])
    assert len(mails) == 1 and mails[0]["categories"] == ["verify_email"]
    text = sg.last_text(u["email"])
    code = _code(text)
    assert "/auth/verify-email-page/" in text
    from app.database import SessionLocal
    from app.models.auth import EmailVerificationToken
    from app.models.user import User
    db = SessionLocal()
    uid = db.query(User).filter_by(email=u["email"]).first().id
    stored = [r.token for r in db.query(EmailVerificationToken).filter_by(user_id=uid).all()]
    assert len(stored) == 2 and code not in stored and not any(t in text for t in stored)        # nothing usable is kept in plain text
    assert client.post("/auth/verify-email-code", json={"email": u["email"].upper(), "code": code}).status_code == 200      # any letter case
    assert db.query(User).filter_by(id=uid).first().is_email_verified is True
    assert client.post("/auth/verify-email-code", json={"email": u["email"], "code": code}).status_code == 400            # a code works once
    db.close()


def test_the_link_token_verifies_too(client, sg):
    u = _signup(client)
    token = _link_token(sg.last_text(u["email"]), "/auth/verify-email-page/")
    assert client.post("/auth/verify-email", json={"token": token}).status_code == 200
    assert client.post("/auth/verify-email", json={"token": token}).status_code == 400


def test_wrong_codes_are_limited_and_then_destroy_the_code(client, sg):
    u = _signup(client)
    good = _code(sg.last_text(u["email"]))
    wrong = "000000" if good != "000000" else "111111"
    for _ in range(5):
        assert client.post("/auth/verify-email-code", json={"email": u["email"], "code": wrong}).status_code == 400
    r = client.post("/auth/verify-email-code", json={"email": u["email"], "code": good})
    assert r.status_code == 429                                  # five misses: even the right code no longer works
    assert client.post("/auth/resend-verification", json={"email": u["email"]}).status_code == 200
    fresh = _code(sg.last_text(u["email"]))
    from app.services import simple_limiter
    simple_limiter.reset()
    assert client.post("/auth/verify-email-code", json={"email": u["email"], "code": fresh}).status_code == 200


def test_resend_gives_the_same_answer_for_every_address_and_is_limited(client, sg):
    u = _signup(client)
    a = client.post("/auth/resend-verification", json={"email": u["email"]})
    b = client.post("/auth/resend-verification", json={"email": "nobody_here@example.com"})
    assert a.status_code == b.status_code == 200 and a.json() == b.json()
    assert sg.to("nobody_here@example.com") == []
    for _ in range(2):
        assert client.post("/auth/resend-verification", json={"email": u["email"]}).status_code == 200      # the 2nd and 3rd are allowed
    assert client.post("/auth/resend-verification", json={"email": u["email"]}).status_code == 429          # 3 an hour per address


def test_a_caregiver_gets_a_welcome_with_their_id(client, sg):
    t = uuid.uuid4().hex[:10]
    body = {"first_name": "Kojo", "last_name": "Mensah", "email": f"cg_{t}@example.com", "password": PASSWORD, "phone_number": "+233200000001",
            "caregiver_type": "professional", "agree_to_terms": True}
    r = client.post("/auth/signup/caregiver", json=body)
    assert r.status_code == 200, r.text
    mail = sg.to(body["email"])[0]
    assert mail["categories"] == ["caregiver_welcome"] and r.json()["caregiver_id"] in mail["content"][0]["value"] and _code(mail["content"][0]["value"])


# ------------------------------------------------------------------ reset password
def test_reset_by_code_changes_the_password_signs_out_and_tells_the_person(client, sg):
    u = _signup(client)
    assert client.post("/auth/forgot-password", json={"email": u["email"].upper()}).status_code == 200
    text = sg.last_text(u["email"])
    assert sg.to(u["email"])[-1]["categories"] == ["password_reset"] and "/auth/reset-password-page?token=" in text
    code = _code(text)
    short = client.post("/auth/reset-password-code", json={"email": u["email"], "code": code, "new_password": "short"})
    assert short.status_code == 422
    assert client.post("/auth/reset-password-code", json={"email": u["email"], "code": code, "new_password": NEW_PASSWORD}).status_code == 200
    assert _login(client, u["email"], NEW_PASSWORD).status_code == 200 and _login(client, u["email"], PASSWORD).status_code in (400, 401)
    assert sg.to(u["email"])[-1]["categories"] == ["password_changed"]                           # a security notice follows
    assert client.post("/auth/reset-password-code", json={"email": u["email"], "code": code, "new_password": "AnotherOne789!"}).status_code == 400   # once only


def test_reset_by_link_token_works_once(client, sg):
    u = _signup(client)
    client.post("/auth/forgot-password", json={"email": u["email"]})
    token = _link_token(sg.last_text(u["email"]), "token=")
    assert client.post("/auth/reset-password", json={"token": token, "new_password": NEW_PASSWORD}).status_code == 200
    assert client.post("/auth/reset-password", json={"token": token, "new_password": "AnotherOne789!"}).status_code == 400
    assert _login(client, u["email"], NEW_PASSWORD).status_code == 200


def test_forgot_password_does_not_reveal_whether_an_account_exists(client, sg):
    u = _signup(client)
    known = client.post("/auth/forgot-password", json={"email": u["email"]})
    unknown = client.post("/auth/forgot-password", json={"email": "no_account_x@example.com"})
    assert known.status_code == unknown.status_code == 200 and known.json() == unknown.json()
    assert sg.to("no_account_x@example.com") == []


def test_asking_for_reset_emails_is_limited(client, sg):
    u = _signup(client)
    for _ in range(3):
        assert client.post("/auth/forgot-password", json={"email": u["email"]}).status_code == 200
    assert client.post("/auth/forgot-password", json={"email": u["email"]}).status_code == 429


def test_five_wrong_reset_codes_block_the_right_one(client, sg):
    u = _signup(client)
    client.post("/auth/forgot-password", json={"email": u["email"]})
    good = _code(sg.last_text(u["email"]))
    wrong = "000000" if good != "000000" else "111111"
    for _ in range(5):
        assert client.post("/auth/reset-password-code", json={"email": u["email"], "code": wrong, "new_password": NEW_PASSWORD}).status_code == 400
    assert client.post("/auth/reset-password-code", json={"email": u["email"], "code": good, "new_password": NEW_PASSWORD}).status_code == 429
    assert _login(client, u["email"], PASSWORD).status_code == 200                              # the password was not changed


# ------------------------------------------------------------------ sign-in code
def test_otp_login_emails_a_code_that_works_once_and_proves_the_email(client, sg):
    u = _signup(client)
    sg.calls.clear()
    r = client.post("/auth/login/otp/request", json={"email": u["email"]})
    assert r.status_code == 200 and "email" not in r.json()                                   # does not echo even a masked address
    mail = sg.to(u["email"])[-1]
    assert mail["categories"] == ["login_code"]
    code = re.search(r"sign-in code: (\d{6})", mail["content"][0]["value"]).group(1)
    ok = client.post("/auth/login/otp/verify", json={"email": u["email"].upper(), "otp": code})
    assert ok.status_code == 200 and ok.json()["access_token"] and ok.json()["is_email_verified"] is True
    assert ok.json()["user_type"] == "patient" and ok.json()["user_id"]                           # the same shape as a password sign-in
    me = client.get("/auth/me", headers={"Authorization": "Bearer " + ok.json()["access_token"]})
    assert me.status_code == 200 and me.json()["email"] == u["email"]                           # and the token really works
    assert client.post("/auth/login/otp/verify", json={"email": u["email"], "otp": code}).status_code == 400


def test_otp_request_is_the_same_for_unknown_addresses_and_limited(client, sg):
    u = _signup(client)
    a = client.post("/auth/login/otp/request", json={"email": u["email"]})
    b = client.post("/auth/login/otp/request", json={"email": "ghost_user@example.com"})
    assert a.json() == b.json() and sg.to("ghost_user@example.com") == []
    client.post("/auth/login/otp/request", json={"email": u["email"]})
    client.post("/auth/login/otp/request", json={"email": u["email"]})
    assert client.post("/auth/login/otp/request", json={"email": u["email"]}).status_code == 429


def test_five_wrong_sign_in_codes_block_the_right_one(client, sg):
    u = _signup(client)
    client.post("/auth/login/otp/request", json={"email": u["email"]})
    good = re.search(r"sign-in code: (\d{6})", sg.to(u["email"])[-1]["content"][0]["value"]).group(1)
    wrong = "000000" if good != "000000" else "111111"
    for _ in range(5):
        assert client.post("/auth/login/otp/verify", json={"email": u["email"], "otp": wrong}).status_code == 400
    assert client.post("/auth/login/otp/verify", json={"email": u["email"], "otp": good}).status_code == 429


# ------------------------------------------------------------------ change password
def test_change_password_checks_tells_and_signs_out(client, sg):
    u = _signup(client)
    h = {"Authorization": f"Bearer {u['access_token']}"}
    bad = client.post("/auth/change-password", headers=h, json={"current_password": "wrong-one-123", "new_password": NEW_PASSWORD})
    assert bad.status_code == 400 and "current password" in bad.json()["detail"].lower()
    same = client.post("/auth/change-password", headers=h, json={"current_password": PASSWORD, "new_password": PASSWORD})
    assert same.status_code == 400 and "different" in same.json()["detail"]
    assert client.post("/auth/change-password", headers=h, json={"current_password": PASSWORD, "new_password": "short"}).status_code == 422
    sg.calls.clear()
    ok = client.post("/auth/change-password", headers=h, json={"current_password": PASSWORD, "new_password": NEW_PASSWORD})
    assert ok.status_code == 200
    assert [m["categories"] for m in sg.to(u["email"])] == [["password_changed"]]
    assert _login(client, u["email"], NEW_PASSWORD).status_code == 200 and _login(client, u["email"], PASSWORD).status_code in (400, 401)


# ------------------------------------------------------------------ the web pages
def test_the_verification_page_works_under_the_security_policy_and_is_safe(client):
    r = client.get("/auth/verify-email-page/abc123")
    assert r.status_code == 200 and "script-src 'self'" in r.headers["content-security-policy"] and "res.cloudinary.com" in r.headers["content-security-policy"]
    assert "<script>" not in r.text and "style=" not in r.text and "/auth/pages/verify.js" in r.text and 'data-token="abc123"' in r.text
    assert client.get("/auth/pages/verify.js").headers["content-type"].startswith("application/javascript")
    assert client.get("/auth/pages/pages.css").headers["content-type"].startswith("text/css")
    evil = client.get('/auth/reset-password-page?token="><script>alert(1)</script>')
    assert "<script>alert(1)</script>" not in evil.text                                       # the token is escaped, never trusted


def test_the_reset_page_has_a_form_and_missing_tokens_are_explained(client):
    ok = client.get("/auth/reset-password-page?token=tok123")
    assert 'id="f"' in ok.text and 'data-token="tok123"' in ok.text and "/auth/pages/reset.js" in ok.text
    assert "not complete" in client.get("/auth/reset-password-page").text
    assert "token" in client.get("/auth/pages/reset.js").text and "/auth/reset-password" in client.get("/auth/pages/reset.js").text


def test_deleting_an_account_sends_a_confirmation(client, sg):
    u = _signup(client)
    h = {"Authorization": f"Bearer {u['access_token']}"}
    sg.calls.clear()
    r = client.post("/privacy/delete-account", headers=h, json={"password": PASSWORD, "confirm": "DELETE"})
    assert r.status_code == 200, r.text
    assert [m["categories"] for m in sg.to(u["email"])] == [["account_deleted"]]


# ------------------------------------------------------------------ SMTP fallback and plain explanations
class FakeSMTP:
    sent = []
    fail_login = False

    def __init__(self, host, port, timeout=None, context=None):
        self.host, self.port = host, port

    def __enter__(self): return self
    def __exit__(self, *a): return False
    def starttls(self, context=None): pass

    def login(self, user, password):
        if FakeSMTP.fail_login:
            import smtplib
            raise smtplib.SMTPAuthenticationError(535, b"bad credentials")
        self.user = user

    def send_message(self, msg): FakeSMTP.sent.append(msg)


@pytest.fixture()
def smtp(monkeypatch):
    FakeSMTP.sent, FakeSMTP.fail_login = [], False
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com"); monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "me@example.com"); monkeypatch.setenv("SMTP_PASSWORD", "app-password")
    monkeypatch.setattr("app.services.email_service.smtplib.SMTP", FakeSMTP)
    return FakeSMTP


def test_no_credits_is_explained_as_such_not_as_a_wrong_key(sg):
    from app.services.email_service import EmailService
    sg.status, sg.body = 401, {"errors": [{"message": "Maximum credits exceeded"}]}
    svc = EmailService()
    assert svc.send_email("a@example.com", "s", "<p>x</p>") is False
    assert "no sending credits" in svc.last_error and "Maximum credits exceeded" in svc.last_error and "wrong" not in svc.last_error.lower()


def test_smtp_takes_over_when_sendgrid_cannot_send(sg, smtp):
    from app.services.email_service import EmailService
    sg.status, sg.body = 401, {"errors": [{"message": "Maximum credits exceeded"}]}
    assert EmailService().send_email("ama@example.com", "Hello", "<p>Hi</p>") is True
    m = smtp.sent[0]
    assert m["To"] == "ama@example.com" and m["Subject"] == "Hello" and "HEWAL3" in m["From"] and m.get_body(("html",)) is not None


def test_smtp_alone_is_enough_and_a_bad_password_is_explained(monkeypatch, smtp):
    from app.services.email_service import EmailService
    monkeypatch.setenv("SENDGRID_API_KEY", ""); monkeypatch.setattr("app.config.settings.SENDGRID_API_KEY", "")
    svc = EmailService()
    assert svc.sendgrid_configured is False and svc.smtp_configured is True and svc.configured is True
    assert svc.send_email("a@example.com", "s", "<p>x</p>") is True
    smtp.fail_login = True
    assert svc.send_email("a@example.com", "s", "<p>x</p>") is False and "App Password" in svc.last_error


def test_the_whole_signup_flow_works_over_smtp(client, monkeypatch, smtp):
    monkeypatch.setenv("SENDGRID_API_KEY", ""); monkeypatch.setattr("app.config.settings.SENDGRID_API_KEY", "")
    from app.services import simple_limiter
    simple_limiter.reset()
    u = _signup(client)
    assert len(smtp.sent) == 1 and re.search(r"Your code: \d{6}", smtp.sent[0].get_body(("plain",)).get_content())
