"""Wellbeing check-in with validated screeners and human-led support.

Questionnaires: PHQ-2 (low mood) and GAD-2 (anxiety). Both are short, widely validated screeners that are free to use.
A total of 3 or more on either is the standard cut-off for "screen positive", which means "worth talking to a professional",
not "has a condition". This service never diagnoses, never replaces care, and never shares answers with anyone by itself.

Safety: a separate yes/no safety question is NOT scored. A "yes" shows emergency guidance and offers (never forces) ways
to reach a person. A person always makes the final decision about care.
English wording is the validated wording. Validated French, Arabic and local-language versions are needed before clinical use.
"""
import math
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.caregiver import CaregiverRelationship
from app.models.health import HealthData
from app.models.notification import Notification
from app.models.trust import WellbeingCheckin
from app.models.user import User
from app.realtime import hub

STEM = "Over the last 2 weeks, how often have you been bothered by the following problems?"
ITEMS = [
    {"id": "phq_interest", "scale": "PHQ-2", "text": "Little interest or pleasure in doing things"},
    {"id": "phq_mood", "scale": "PHQ-2", "text": "Feeling down, depressed or hopeless"},
    {"id": "gad_nervous", "scale": "GAD-2", "text": "Feeling nervous, anxious or on edge"},
    {"id": "gad_worry", "scale": "GAD-2", "text": "Not being able to stop or control worrying"},
]
OPTIONS = [{"value": 0, "label": "Not at all"}, {"value": 1, "label": "Several days"},
           {"value": 2, "label": "More than half the days"}, {"value": 3, "label": "Nearly every day"}]
SAFETY = "In the last 2 weeks, have you had thoughts of harming yourself, or that you would be better off not alive?"
CUTOFF = 3


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def questionnaire() -> dict:
    return {"stem": STEM, "items": ITEMS, "options": OPTIONS, "safety_question": SAFETY, "cutoff": CUTOFF,
            "note": "This is a short screening questionnaire, not a diagnosis. Your answers are private to you."}


def score(answers: List[int]) -> dict:
    if len(answers) != 4 or any((not isinstance(a, int)) or a < 0 or a > 3 for a in answers):
        raise ValueError("answers must be four whole numbers from 0 to 3")
    return {"phq2": answers[0] + answers[1], "gad2": answers[2] + answers[3]}


def assess(phq2: int, gad2: int, safety: bool, emergency_number: str = "112") -> dict:
    worst = max(phq2, gad2)
    positive = phq2 >= CUTOFF or gad2 >= CUTOFF
    # both screens positive together (low mood AND anxiety) is treated as the higher band, as is a score of 5 or more on either
    band = "low" if not positive else ("high" if (worst >= 5 or (phq2 >= CUTOFF and gad2 >= CUTOFF)) else "elevated")
    steps: List[dict] = []
    if safety:
        steps.append({"level": "urgent", "title": "Get help now",
                      "text": f"You deserve support right now. Call {emergency_number} or go to the nearest hospital. Please do not stay alone: tell someone you trust how you feel.",
                      "eligibility": "You answered yes to the safety question."})
    if positive:
        when = "this week" if band == "high" else "in the next one to two weeks"
        steps.append({"level": "primary_care", "title": "Talk to a clinician or counsellor",
                      "text": f"A professional conversation {when} would help. If getting to a clinic is hard, ask your clinic whether phone or video appointments are possible.",
                      "eligibility": f"A score of {CUTOFF} or more on either questionnaire is the standard sign that talking to a professional is worthwhile."})
        steps.append({"level": "community", "title": "Lean on people near you",
                      "text": "Tell a family member, friend or faith leader how you have been feeling, and ask your care team to check in on you.",
                      "eligibility": "Suggested with any positive screen."})
    steps.append({"level": "self_help", "title": "Small steps that help",
                  "text": "A short walk, a regular bedtime, eating regular meals, and doing one small thing you enjoy each day all help mood and worry.",
                  "eligibility": "Everyone."})
    titles = {"low": "Your answers do not suggest a problem right now",
              "elevated": "Your answers suggest it is worth talking to someone",
              "high": "Your answers suggest you would benefit from support soon"}
    return {"band": band, "screen_positive": positive, "crisis": bool(safety), "headline": titles[band], "next_steps": steps,
            "disclaimer": "This is a screening questionnaire, not a diagnosis. A health professional makes any decision about care."}


def _pearson(xs: List[float], ys: List[float]) -> Optional[float]:
    n = len(xs)
    if n < 6:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs)); sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if sx == 0 or sy == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (sx * sy)


def summary(db: Session, user: User) -> dict:
    rows = db.query(WellbeingCheckin).filter_by(user_id=user.id).order_by(WellbeingCheckin.id.desc()).limit(12).all()
    rows = list(reversed(rows))
    history = [{"id": r.id, "at": _utc(r.created_at).isoformat() if r.created_at else None, "phq2": r.phq2, "gad2": r.gad2,
                "total": r.phq2 + r.gad2} for r in rows]
    trend = None
    if len(rows) >= 2:
        latest = history[-1]["total"]
        prev = history[:-1][-3:]
        mean_prev = sum(h["total"] for h in prev) / len(prev)
        trend = "improving" if latest <= mean_prev - 1 else "worsening" if latest >= mean_prev + 1 else "steady"
    link = None
    xs, ys = [], []
    for r in rows:
        if not r.created_at:
            continue
        end = _utc(r.created_at)
        steps = [h.steps for h in db.query(HealthData).filter(HealthData.user_id == user.id, HealthData.date >= end - timedelta(days=7), HealthData.date <= end).all() if h.steps]
        if steps:
            xs.append(sum(steps) / len(steps)); ys.append(r.phq2 + r.gad2)
    r_val = _pearson(xs, ys)
    if r_val is not None and r_val <= -0.4:
        link = "In the weeks you moved more, your wellbeing scores tended to be lower (better). This is an association, not proof."
    return {"history": history, "trend": trend, "link": link, "count": len(rows)}


def due(db: Session, user: User) -> dict:
    last = db.query(WellbeingCheckin).filter_by(user_id=user.id).order_by(WellbeingCheckin.id.desc()).first()
    if not last or not last.created_at:
        return {"due": True, "last_at": None}
    age = _now() - _utc(last.created_at)
    return {"due": age >= timedelta(days=7), "last_at": _utc(last.created_at).isoformat()}


def ask_for_support(db: Session, user: User) -> int:
    """The user chose to ask their care team to check in. No scores and no answers are shared."""
    rels = db.query(CaregiverRelationship).filter(CaregiverRelationship.patient_id == user.id, CaregiverRelationship.status == "approved").all()
    name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username or "Someone you care for"
    for r in rels:
        db.add(Notification(user_id=r.caregiver_id, notification_type="support_request", title=f"{name} would like some support",
                            message="They asked you to check in on them. Please give them a call or send a message.", sender_type="system"))
        hub.send_from_thread(r.caregiver_id, {"type": "alert", "kind": "support_request", "message": f"{name} would like some support. Please check in on them."})
    db.commit()
    return len(rels)
