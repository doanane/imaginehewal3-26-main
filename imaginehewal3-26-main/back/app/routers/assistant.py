"""Health assistant endpoints. Authenticated, rate limited, history stored server-side, answers streamed as they are written."""
import json
import threading
import time
from collections import defaultdict, deque
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import SessionLocal, get_db
from app.models.assistant import AssistantMessage
from app.models.behavior import BehaviorPlan, BehaviorSettings
from app.models.caregiver import CaregiverRelationship, Doctor
from app.models.health import FoodLog
from app.models.safety import Medication
from app.models.user import User, UserProfile
from app.realtime import hub
from app.services import assistant_service as svc
from app.services import gemini_service as gemini
from app.services.care_snapshot import snapshot
from app.services.par import par

router = APIRouter(prefix="/assistant", tags=["assistant"])

RATE_LIMIT = 20          # messages
RATE_WINDOW_S = 60
_hits = defaultdict(deque)
_lock = threading.Lock()


class MessageIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


def _check_rate(user_id: int) -> None:
    now = time.time()
    with _lock:
        q = _hits[user_id]
        while q and now - q[0] > RATE_WINDOW_S:
            q.popleft()
        if len(q) >= RATE_LIMIT:
            raise HTTPException(status_code=429, detail="You are sending messages too quickly. Please wait a moment.",
                                headers={"Retry-After": str(RATE_WINDOW_S)})
        q.append(now)


# ------------------------------------------------------------------ what the assistant knows about the person
_ctx_cache: dict = {}
CTX_TTL = 30.0


def _ago(iso: Optional[str]) -> str:
    if not iso:
        return "recent"
    s = max(0, int((datetime.now(timezone.utc) - datetime.fromisoformat(iso)).total_seconds()))
    return "just now" if s < 90 else f"{s // 60} min ago" if s < 5400 else f"{s // 3600} h ago" if s < 129600 else f"{s // 86400} days ago"


def build_context(user: User) -> dict:
    """Real data only, asked for in parallel (the database is a network round trip away). Remembered for 30 s so a chat feels instant."""
    hit = _ctx_cache.get(user.id)
    if hit and time.monotonic() - hit[0] < CTX_TTL:
        return hit[1]
    uid = user.id
    start = datetime.combine(date.today(), datetime.min.time())

    def snap(d):
        prof = d.query(UserProfile).filter_by(user_id=uid).first()
        return prof, snapshot(d, user, prof)
    (prof, snap_), meds, meals, plans = par(
        snap,
        lambda d: d.query(Medication).filter_by(user_id=uid, active=True).limit(12).all(),
        lambda d: d.query(FoodLog).filter(FoodLog.user_id == uid, FoodLog.created_at >= start).order_by(FoodLog.created_at.desc()).limit(4).all(),
        lambda d: [p.behavior for p in d.query(BehaviorPlan).filter_by(user_id=uid, active=True).all()],
    )
    ctx: dict = {"vitals": {}, "plans": plans}
    if prof:
        conds = prof.chronic_conditions or []
        ctx.update(age=prof.age, gender=prof.gender, conditions=[str(c) for c in conds][:8] if isinstance(conds, list) else [])
        if prof.weight and prof.height:
            ctx.update(weight_kg=prof.weight, height_cm=prof.height, bmi=round(prof.weight / ((prof.height / 100) ** 2), 1))
        if prof.doctor_id:
            doc = None
            with SessionLocal() as d2:
                doc = d2.query(Doctor.full_name).filter(Doctor.doctor_id == prof.doctor_id).first()
            ctx["doctor"] = doc[0] if doc else None
    vit = snap_["vitals"]
    ctx["vitals"] = {**vit, "age_text": _ago(vit.get("at"))}
    ctx.update(status=snap_["status"], reasons=snap_["reasons"], steps=vit.get("steps"), adherence=snap_["adherence"])
    ctx["medications"] = [f"{m.name}{' ' + m.dose if m.dose else ''} at {', '.join(m.times or [])}" for m in meds]
    ctx["meals"] = [f"{(m.meal_type or 'meal')}: {((m.ai_analysis or {}).get('detected_food') if isinstance(m.ai_analysis, dict) else None) or 'logged'}"
                    f"{' (score ' + str(m.diet_score) + ')' if m.diet_score is not None else ''}" for m in meals]
    _ctx_cache[user.id] = (time.monotonic(), ctx)
    return ctx


def _lang(db: Session, user: User) -> str:
    s = db.query(BehaviorSettings).filter_by(user_id=user.id).first()
    return s.language if s and s.language in svc.LANG_NAMES else "en"


def _out(m: AssistantMessage) -> dict:
    return {"id": m.id, "role": m.role, "content": m.content, "emergency": bool(m.emergency),
            "source": m.source, "created_at": m.created_at.isoformat() if m.created_at else None}


def _history(db: Session, user_id: int) -> List[dict]:
    rows = (db.query(AssistantMessage).filter_by(user_id=user_id).order_by(AssistantMessage.id.desc()).limit(svc.MAX_HISTORY_TURNS).all())
    history = [{"role": r.role, "content": r.content} for r in reversed(rows)]
    while history and history[0]["role"] != "user":
        history.pop(0)
    return history


def _tell_caregivers(db: Session, user: User) -> None:
    """Approved caregivers learn that emergency guidance was shown. The message text itself is NOT shared."""
    rels = db.query(CaregiverRelationship).filter(CaregiverRelationship.patient_id == user.id, CaregiverRelationship.status == "approved").all()
    for r in rels:
        hub.send_from_thread(r.caregiver_id, {"type": "alert", "kind": "assistant.emergency", "patient_id": user.id,
                                              "message": "Your patient was shown emergency guidance. Please check on them."})


def _save(user_id: int, role: str, content: str, emergency: bool = False, source: str = "model") -> dict:
    with SessionLocal() as d:                      # its own session: a streamed response outlives the request's session
        m = AssistantMessage(user_id=user_id, role=role, content=content, emergency=emergency, source=source)
        d.add(m)
        d.commit()
        d.refresh(m)
        return _out(m)


# ------------------------------------------------------------------ suggestions built from real data (instant, no model call)
def suggestions_for(ctx: dict) -> List[str]:
    v, conds = ctx.get("vitals") or {}, " ".join(ctx.get("conditions") or []).lower()
    out: List[str] = []
    if v.get("systolic") and v.get("diastolic") and (v["systolic"] >= 130 or v["diastolic"] >= 80):
        out.append(f"My blood pressure was {v['systolic']}/{v['diastolic']}. What does it mean?")
    if v.get("heart_rate") and v["heart_rate"] > 100:
        out.append(f"Why is my heart rate {v['heart_rate']}?")
    if ctx.get("adherence") is not None and ctx["adherence"] < 80:
        out.append("How can I stop forgetting my medicine?")
    if ctx.get("steps") is not None and ctx["steps"] < 3000:
        out.append("Give me an easy walking plan for today")
    if "hypertens" in conds:
        out.append("Plan a low-salt dinner with Ghanaian food")
    if "diabet" in conds:
        out.append("How do I keep blood sugar steady after meals?")
    if ctx.get("meals"):
        out.append("Was my last meal a good choice for me?")
    out += ["What should I eat to feel healthier?", "Help me prepare questions for my clinic visit", "How can I sleep better?", "What does my health score mean?"]
    seen, final = set(), []
    for s in out:
        if s not in seen:
            seen.add(s)
            final.append(s)
    return final[:4]


@router.get("/suggestions")
def suggestions(user: User = Depends(get_current_active_user)):
    return {"suggestions": suggestions_for(build_context(user)), "ai": gemini.available()}


# ------------------------------------------------------------------ chat
@router.post("/message")
def send(body: MessageIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """The whole answer at once. The app prefers /stream; this is the fallback and what simple clients use."""
    _check_rate(user.id)
    text = body.content.strip()
    if not text:
        raise HTTPException(400, "Message is empty")
    lang = _lang(db, user)
    user_msg = AssistantMessage(user_id=user.id, role="user", content=text)
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    ideas: List[str] = []
    if svc.is_emergency(text):
        reply, source, emergency = svc.emergency_reply(lang), "triage", True
        _tell_caregivers(db, user)
    else:
        reply, source = svc.generate_reply(_history(db, user.id), build_context(user), lang)
        reply, ideas = svc.split_suggestions(reply)
        emergency = False

    bot = AssistantMessage(user_id=user.id, role="assistant", content=reply, emergency=emergency, source=source)
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return {"user": _out(user_msg), "assistant": _out(bot), "suggestions": ideas}


def _sse(event: dict) -> str:
    return "data: " + json.dumps(event, ensure_ascii=False) + "\n\n"


@router.post("/stream")
def stream(body: MessageIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Server-sent events: {type:"meta"} then {type:"token"} as words are written, then {type:"done"} with the saved message and ideas."""
    _check_rate(user.id)
    text = body.content.strip()
    if not text:
        raise HTTPException(400, "Message is empty")
    lang = _lang(db, user)
    user_msg = AssistantMessage(user_id=user.id, role="user", content=text)
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)
    user_out, uid = _out(user_msg), user.id
    emergency = svc.is_emergency(text)
    if emergency:
        _tell_caregivers(db, user)
        history, ctx = [], {}
    else:
        history = _history(db, uid)
        ctx = build_context(user)

    def events():
        yield _sse({"type": "meta", "user": user_out})
        if emergency:                                                    # instant, written by us, never by the model
            reply = svc.emergency_reply(lang)
            yield _sse({"type": "token", "text": reply})
            yield _sse({"type": "done", "assistant": _save(uid, "assistant", reply, True, "triage"), "suggestions": []})
            return
        full, sent, source = "", 0, "gemini"
        try:
            for delta in svc.stream_reply(history, ctx, lang):
                full += delta
                cut = full.find("[[")
                # hold back from the start of the [[suggestions]] line (or a lone "[" that may begin it) so it is never shown
                safe = cut if cut != -1 else len(full) - (1 if full.endswith("[") else 0)
                if safe > sent:
                    yield _sse({"type": "token", "text": full[sent:safe]})
                    sent = safe
        except gemini.GeminiError:
            if not full:                                                 # could not start: second choice, then offline guidance
                full, source = svc.generate_reply(history, ctx, lang)
                clean, _ = svc.split_suggestions(full)
                yield _sse({"type": "token", "text": clean})
                sent = len(clean)
        clean, ideas = svc.split_suggestions(full)           # the saved message replaces the streamed text on the phone, so nothing is lost
        if not clean:
            clean, source = svc.offline_reply(text), "offline"
            yield _sse({"type": "token", "text": clean})
        yield _sse({"type": "done", "assistant": _save(uid, "assistant", clean, False, source), "suggestions": ideas})

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"})


@router.get("/history")
def history(limit: int = 50, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    limit = max(1, min(limit, 200))
    rows = (db.query(AssistantMessage).filter_by(user_id=user.id).order_by(AssistantMessage.id.desc()).limit(limit).all())
    return [_out(r) for r in reversed(rows)]


@router.delete("/history")
def clear_history(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    n = db.query(AssistantMessage).filter_by(user_id=user.id).delete()
    db.commit()
    return {"deleted": n}
