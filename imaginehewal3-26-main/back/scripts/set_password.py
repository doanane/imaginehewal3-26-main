"""Set one person's password directly in the database (for when you are locked out of your own test account).

    python scripts/set_password.py patient@gmail.com StrongPass1          (asks you to type yes)
    python scripts/set_password.py patient@gmail.com StrongPass1 --yes    (no question)

It writes to whatever DATABASE_URL points at (the live Neon database when back/.env is loaded), so it prints the database host and the account
first and asks you to type yes. It changes only that one account, only its password and its failed-login counter, and prints nothing secret.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from sqlalchemy import create_engine, text  # noqa: E402

from app.auth.hashing import get_password_hash, verify_password  # noqa: E402


def main(email: str, password: str, assume_yes: bool = False) -> None:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise SystemExit("DATABASE_URL is not set.")
    engine = create_engine(url)
    email = email.lower().strip()
    with engine.connect() as c:
        row = c.execute(text("select id, email, is_caregiver from users where lower(email) = :e"), {"e": email}).mappings().first()
    if not row:
        raise SystemExit(f"No account with the email {email}.")
    print("Database host:", url.split("@")[-1].split("/")[0])
    print(f"Account: id {row['id']}, {row['email']}, {'caregiver' if row['is_caregiver'] else 'patient'}")
    if not assume_yes and input("Set a new password for this account? Type yes: ").strip().lower() != "yes":
        raise SystemExit("Cancelled. Nothing was changed.")
    with engine.begin() as c:
        c.execute(text("update users set hashed_password = :h where id = :i"), {"h": get_password_hash(password), "i": row["id"]})
    with engine.connect() as c:
        stored = c.execute(text("select hashed_password from users where id = :i"), {"i": row["id"]}).scalar()
    print("Done. The new password works:", verify_password(password, stored))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--yes"]
    if len(args) != 2:
        raise SystemExit(__doc__)
    main(args[0], args[1], assume_yes="--yes" in sys.argv)
