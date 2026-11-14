"""Checks the SendGrid setup and sends a REAL test email, so you find out now and not when a patient tries to reset a password.

    python scripts/send_test_email.py you@example.com            # one test email to that address
    python scripts/send_test_email.py you@example.com --all      # also the verification, reset, sign-in code and password-changed emails (with fake codes)
    python scripts/send_test_email.py --check                    # only look at the settings, send nothing

If SendGrid refuses, the reason is printed in plain words (wrong key, unverified sender, quota).
"""
import os
import sys
from urllib.parse import urlparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except Exception:
    pass

from app.services.email_service import EmailService, esc, mask, shell  # noqa: E402


def check(svc: EmailService) -> bool:
    ok = True
    print("SENDGRID_API_KEY :", "set" if svc.api_key else "MISSING", "(starts with SG.)" if svc.api_key.startswith("SG.") else "(does NOT start with SG.: check it)" if svc.api_key else "")
    if not svc.api_key.startswith("SG."):
        ok = False
    print("FROM_EMAIL       :", mask(svc.from_email) if svc.from_email else "MISSING")
    if svc.from_email.lower().endswith(("@gmail.com", "@yahoo.com", "@outlook.com", "@hotmail.com")):
        print("   NOTE: a free-mail sender works only after 'Single Sender Verification' in SendGrid, and many mailboxes will put these emails in spam.")
        print("         For real users, authenticate your own domain in SendGrid (Settings > Sender Authentication) and use an address on it.")
    host = (urlparse(svc.base_url).hostname or "")
    print("BASE_URL         :", svc.base_url)
    if host in ("localhost", "127.0.0.1") or host.startswith("192.168."):
        print("   PROBLEM: links in emails will not open on a phone. Set BASE_URL to this backend's public https address (for example your ngrok URL).")
        ok = False
    elif "ngrok" in host:
        print("   NOTE: the free ngrok address shows a warning page before the link opens, and changes when ngrok restarts. The 6-digit codes work regardless.")
    return ok and bool(svc.api_key and svc.from_email)


def main() -> None:
    svc = EmailService()
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    ready = check(svc)
    if "--check" in sys.argv:
        sys.exit(0 if ready else 1)
    if not args:
        sys.exit("Give the address to send to, for example: python scripts/send_test_email.py you@example.com")
    to = args[0]
    body = ("<p>This is a test email from the HEWAL3 backend.</p><p>If you can read it, SendGrid is set up and real emails (verification, password reset, "
            "sign-in codes) will reach people.</p>")
    sent = svc.send_email(to, "HEWAL3 email test", shell("Email is working", "HEWAL3 test email", body), "HEWAL3 email test: SendGrid is working.", "test")
    print(f"test email to {mask(to)}:", "ACCEPTED by SendGrid (check the inbox and the spam folder)" if sent else f"FAILED: {svc.last_error}")
    if sent and "--all" in sys.argv:
        print("verification  :", svc.send_welcome_email(to, "Test", "sample-token-123", "123456"))
        print("password reset:", svc.send_password_reset_email(to, "sample-token-123", "654321"))
        print("sign-in code  :", svc.send_otp_email(to, "Test", "246810"))
        print("pw changed    :", svc.send_password_changed_email(to, "Test"))
        print("(the codes in these samples are fake and do not work)")
    sys.exit(0 if sent else 1)


if __name__ == "__main__":
    main()
