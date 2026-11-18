"""Sample people carry no "(demo)" in their names, and rows saved with the label earlier are cleaned when the server starts. Offline."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from test_doctor_portal import env, login  # noqa: F401,E402


def test_old_labels_are_removed_from_names_and_other_text(env):
    from app.database import SessionLocal, _strip_demo_labels
    from app.models.caregiver import Doctor
    from app.models.user import User, UserProfile
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.id == env["pat"]).first()
        p = db.query(UserProfile).filter(UserProfile.user_id == env["pat"]).first()
        u.first_name, u.last_name, p.full_name = "Efua", "Sarpong (demo)", "Efua Sarpong (demo)"
        d = db.query(Doctor).filter(Doctor.doctor_id == "DPT0001A").first()
        d.full_name = "Dr. Test (demo)"
        db.commit()
    finally:
        db.close()

    _strip_demo_labels()

    db = SessionLocal()
    try:
        u = db.query(User).filter(User.id == env["pat"]).first()
        p = db.query(UserProfile).filter(UserProfile.user_id == env["pat"]).first()
        d = db.query(Doctor).filter(Doctor.doctor_id == "DPT0001A").first()
        assert (u.first_name, u.last_name, p.full_name, d.full_name) == ("Efua", "Sarpong", "Efua Sarpong", "Dr. Test")
    finally:
        db.close()
    _, hd = login(env["client"])
    names = [x["name"] for x in env["client"].get("/doctor-portal/overview", headers=hd).json()["patients"]]
    assert not any("(demo)" in n for n in names)
