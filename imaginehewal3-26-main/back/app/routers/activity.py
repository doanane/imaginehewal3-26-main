"""Activity: daily rings, step sync, run/walk/cycle workouts, weight reports, sleep stages and health knowledge."""
import statistics
from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import get_db
from app.models.activity import HealthGoals, SleepSession, Workout, WeightLog
from app.models.health import HealthData
from app.models.iot_device import IoTDevice, VitalReading
from app.models.user import User, UserProfile
from app.services import activity_data as ad
from app.services import activity_service as svc
from app.services import competition_service as comp
from app.services.par import par

router = APIRouter(prefix="/activity", tags=["activity"])


def _utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _goals(db: Session, user: User) -> HealthGoals:
    g = db.query(HealthGoals).filter_by(user_id=user.id).first()
    if not g:
        g = HealthGoals(user_id=user.id)
        db.add(g)
        db.commit()
        db.refresh(g)
    return g


def _kg(db: Session, user: User) -> Optional[float]:
    w = db.query(WeightLog).filter_by(user_id=user.id).order_by(WeightLog.at.desc()).first()
    if w:
        return w.kg
    p = db.query(UserProfile).filter_by(user_id=user.id).first()
    return float(p.weight) if p and p.weight else None


# ------------------------------------------------------------------ goals and today
class GoalsIn(BaseModel):
    steps: Optional[int] = Field(None, ge=1000, le=60000)
    calories: Optional[int] = Field(None, ge=50, le=3000)
    active_minutes: Optional[int] = Field(None, ge=5, le=300)
    target_weight_kg: Optional[float] = Field(None, ge=25, le=300)


def _goals_dict(g: HealthGoals) -> dict:
    return {"steps": g.steps, "calories": g.calories, "active_minutes": g.active_minutes, "target_weight_kg": g.target_weight_kg}


@router.get("/goals")
def get_goals(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return _goals_dict(_goals(db, user))


@router.put("/goals")
def set_goals(body: GoalsIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    g = _goals(db, user)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(g, k, v)
    db.commit()
    return _goals_dict(g)


def _workout_brief(w: Workout) -> dict:
    return {"id": w.id, "kind": w.kind, "started_at": _utc(w.started_at).isoformat(), "duration_s": w.duration_s,
            "distance_m": round(w.distance_m), "calories": w.calories, "avg_pace_s_km": w.avg_pace_s_km, "steps": w.steps, "flagged": bool(w.flagged)}


@router.get("/summary")
def summary(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    today = date.today()
    uid = user.id
    # These questions do not depend on each other, so they are asked at the same time.
    g, metrics, wos, weight, profile, latest, hr, sleep, streak, apple = par(
        lambda d: _goals(d, user),
        lambda d: ad.today_metrics(d, uid, today),
        lambda d: ad.workouts_between(d, [uid], today, today, include_flagged=True)[uid],
        lambda d: d.query(WeightLog).filter_by(user_id=uid).order_by(WeightLog.at.desc()).first(),
        lambda d: d.query(UserProfile).filter_by(user_id=uid).first(),
        lambda d: d.query(Workout).filter_by(user_id=uid).order_by(Workout.started_at.desc()).first(),
        lambda d: d.query(VitalReading).filter(VitalReading.user_id == uid, VitalReading.heart_rate.isnot(None)).order_by(VitalReading.timestamp.desc()).first(),
        lambda d: d.query(SleepSession).filter_by(user_id=uid).order_by(SleepSession.end.desc()).first(),
        lambda d: ad.streak_days(d, uid, today),
        lambda d: d.query(IoTDevice).filter_by(user_id=uid, device_id="apple-health").first(),
    )
    steps = metrics["steps"]
    kg = (weight.kg if weight else (float(profile.weight) if profile and profile.weight else None)) or svc.DEFAULT_KG
    wo_cal, wo_min = sum(w.calories or 0 for w in wos), sum(w.duration_s for w in wos) // 60
    outside = max(0, steps - sum(w.steps or 0 for w in wos))
    # Calories and minutes are the watch's own figures when it reported them. Only when it did not are they estimated from steps, and
    # the app is told so it can say "estimated" instead of presenting a guess as a measurement.
    if metrics["calories"]:
        cal, cal_est = max(metrics["calories"], wo_cal), False
    else:
        cal, cal_est = wo_cal + round(outside * 0.04 * (kg / 70.0)), True               # about 0.04 kcal per step at 70 kg
    if metrics["active_minutes"]:
        minutes, min_est = max(metrics["active_minutes"], wo_min), False
    else:
        minutes, min_est = wo_min + round(outside / 130), True                          # about 130 steps a minute when briskly walking
    return {
        "date": today.isoformat(),
        "rings": {"steps": {"value": steps, "goal": g.steps}, "calories": {"value": cal, "goal": g.calories, "estimated": cal_est},
                  "minutes": {"value": int(minutes), "goal": g.active_minutes, "estimated": min_est}},
        "distance_m": metrics["distance_m"],
        "steps_source": metrics["steps_source"],
        "apple_health_synced_at": _utc(apple.last_sync).isoformat() if apple and apple.last_sync else None,
        "streak_days": streak,
        "latest_workout": _workout_brief(latest) if latest else None,
        "weight": {"kg": weight.kg, "at": _utc(weight.at).isoformat(), "target_kg": g.target_weight_kg} if weight else None,
        "heart_rate": {"bpm": hr.heart_rate, "at": _utc(hr.timestamp).isoformat()} if hr else None,
        "sleep": {"total_min": sleep.total_min, "score": sleep.score, "end": _utc(sleep.end).isoformat()} if sleep else None,
        "estimates_note": "Steps, calories and active minutes come from your watch or phone when they report them. Anything marked estimated is worked out from your steps.",
    }


# ------------------------------------------------------------------ steps
class StepsIn(BaseModel):
    steps: int = Field(..., ge=0, le=100000)
    day: Optional[date] = Field(None, alias="date")      # the public name stays "date"; a field called date would shadow its own type


@router.post("/steps")
def sync_steps(body: StepsIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """The phone sends its running total for the day. The stored value only ever goes up within a day."""
    day = body.day or date.today()
    if day > date.today() or day < date.today() - timedelta(days=7):
        raise HTTPException(400, "You can sync steps for today or the last 7 days")
    lo, hi = ad.day_bounds(day)
    rows = db.query(HealthData).filter(HealthData.user_id == user.id, HealthData.date >= lo, HealthData.date < hi).order_by(HealthData.id).all()
    if rows:
        best = max(rows, key=lambda r: r.steps or 0)
        best.steps = max(best.steps or 0, body.steps)
        total = best.steps
    else:
        db.add(HealthData(user_id=user.id, date=lo + timedelta(hours=12), steps=body.steps))
        total = body.steps
    db.commit()
    new = comp.evaluate(db, user)
    comp.notify_changed(db, user)
    return {"steps": total, "new_achievements": new}


# ------------------------------------------------------------------ workouts
class WorkoutIn(BaseModel):
    kind: str = Field(..., pattern="^(run|walk|cycle)$")
    started_at: datetime
    duration_s: int = Field(..., ge=30, le=86400)
    distance_m: Optional[float] = Field(None, ge=0, le=300000)
    steps: Optional[int] = Field(None, ge=0, le=200000)
    avg_hr: Optional[int] = Field(None, ge=25, le=230)
    max_hr: Optional[int] = Field(None, ge=25, le=250)
    route: Optional[List[List[float]]] = Field(None, max_length=4000)
    source: str = Field("phone", pattern="^(phone|watch|manual)$")

    @field_validator("route")
    @classmethod
    def _route(cls, v):
        if not v:
            return v
        last_t = -1.0
        for p in v:
            if len(p) != 3 or not (-90 <= p[0] <= 90) or not (-180 <= p[1] <= 180) or p[2] < last_t or p[2] > 86400:
                raise ValueError("route points must be [lat, lng, seconds] in time order")
            last_t = p[2]
        return v


def _workout_full(w: Workout) -> dict:
    return {**_workout_brief(w), "avg_hr": w.avg_hr, "max_hr": w.max_hr, "fastest_pace_s_km": w.fastest_pace_s_km,
            "route": w.route, "splits": w.splits, "source": w.source,
            "flag_note": "We could not verify the speed of this activity, so it does not count on leaderboards." if w.flagged else None}


STRIDE = {"walk": 0.415, "run": 0.50}     # metres of stride per metre of height: common anthropometric ratios, used only for a labelled estimate


def _with_extras(db: Session, user: User, w: Workout) -> dict:
    """The saved workout plus two things worked out at read time, each labelled with where it came from:
    heart rate from real readings taken during the workout (only when the workout has none of its own), and, when GPS recorded no distance,
    a steps based distance estimate that the app must show as an estimate."""
    out = _workout_full(w)
    start = _utc(w.started_at)
    end = start + timedelta(seconds=w.duration_s)
    hr_source = "workout" if w.avg_hr else None
    if not w.avg_hr:
        rows = db.query(VitalReading.heart_rate).filter(VitalReading.user_id == user.id, VitalReading.heart_rate.isnot(None),
                                                       VitalReading.timestamp >= start, VitalReading.timestamp <= end).all()
        beats = [r[0] for r in rows if r[0] and 30 <= r[0] <= 230]
        if len(beats) >= 2:
            out["avg_hr"], out["max_hr"], hr_source = round(sum(beats) / len(beats)), max(beats), "vitals"
    out["hr_source"] = hr_source
    est = None
    if (w.distance_m or 0) < 20 and (w.steps or 0) >= 20 and w.kind in STRIDE:
        prof = db.query(UserProfile).filter_by(user_id=user.id).first()
        try:
            height_m = float(prof.height) / 100.0 if prof and prof.height and 100 <= float(prof.height) <= 230 else 1.70
        except (TypeError, ValueError):
            height_m = 1.70
        est = {"distance_m": round(w.steps * STRIDE[w.kind] * height_m), "basis": "steps and your height"}
        est["avg_pace_s_km"] = svc.pace_s_km(est["distance_m"], w.duration_s) if est["distance_m"] >= 50 else None
    out["estimate"] = est
    out["cadence_spm"] = round(w.steps / (w.duration_s / 60.0)) if w.steps and w.duration_s >= 30 else None
    return out


@router.post("/workouts")
def create_workout(body: WorkoutIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    started = _utc(body.started_at)
    if started > datetime.now(timezone.utc) + timedelta(minutes=5):
        raise HTTPException(400, "A workout cannot start in the future")
    splits = fastest = None
    if body.route and len(body.route) >= 2:
        a = svc.analyze_route(body.route, body.kind)
        distance, splits, fastest, plausible = a["distance_m"], a["splits"], a["fastest_pace_s_km"], a["plausible"]
    else:
        distance = body.distance_m or 0.0
        plausible = svc.plausible_without_route(body.kind, distance, body.duration_s, body.steps)
    w = Workout(user_id=user.id, kind=body.kind, started_at=started, duration_s=body.duration_s, distance_m=distance, steps=body.steps,
                calories=svc.calories(body.kind, _kg(db, user), body.duration_s), avg_pace_s_km=svc.pace_s_km(distance, body.duration_s),
                fastest_pace_s_km=fastest, avg_hr=body.avg_hr, max_hr=body.max_hr, route=body.route, splits=splits, source=body.source,
                flagged=not plausible)
    db.add(w)
    db.commit()
    db.refresh(w)
    new = [] if w.flagged else comp.evaluate(db, user)
    if not w.flagged:
        comp.notify_changed(db, user)
    return {**_workout_full(w), "new_achievements": new}


@router.get("/workouts")
def list_workouts(limit: int = 20, kind: Optional[str] = None, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    q = db.query(Workout).filter_by(user_id=user.id)
    if kind in svc.KINDS:
        q = q.filter(Workout.kind == kind)
    return [_workout_brief(w) for w in q.order_by(Workout.started_at.desc()).limit(max(1, min(limit, 100))).all()]


@router.get("/workouts/{workout_id}")
def get_workout(workout_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    w = db.query(Workout).filter_by(id=workout_id, user_id=user.id).first()
    if not w:
        raise HTTPException(404, "Workout not found")
    return _with_extras(db, user, w)


@router.delete("/workouts/{workout_id}")
def delete_workout(workout_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    w = db.query(Workout).filter_by(id=workout_id, user_id=user.id).first()
    if not w:
        raise HTTPException(404, "Workout not found")
    db.delete(w)
    db.commit()
    return {"deleted": True}


# ------------------------------------------------------------------ weight
class WeightIn(BaseModel):
    kg: float = Field(..., ge=20, le=400)


@router.post("/weight")
def add_weight(body: WeightIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    row = WeightLog(user_id=user.id, kg=round(body.kg, 1))
    db.add(row)
    db.commit()
    return {"id": row.id, "kg": row.kg}


@router.delete("/weight/{log_id}")
def delete_weight(log_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    row = db.query(WeightLog).filter_by(id=log_id, user_id=user.id).first()
    if not row:
        raise HTTPException(404, "Not found")
    db.delete(row)
    db.commit()
    return {"deleted": True}


@router.get("/weight")
def weight_report(report: str = "weekly", db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """weekly = last 8 weeks, monthly = last 12 months. Includes points, averages per week or month, trend and notes."""
    monthly = report == "monthly"
    since = datetime.now(timezone.utc) - timedelta(days=365 if monthly else 56)
    rows = db.query(WeightLog).filter(WeightLog.user_id == user.id, WeightLog.at >= since).order_by(WeightLog.at).all()
    pts = [(_utc(r.at), r.kg) for r in rows]
    prof = db.query(UserProfile).filter_by(user_id=user.id).first()
    g = _goals(db, user)
    return {"report": "monthly" if monthly else "weekly", "points": [{"id": r.id, "at": _utc(r.at).isoformat(), "kg": r.kg} for r in rows],
            "buckets": svc.bucket_weight(pts, "month" if monthly else "week"),
            "stats": svc.weight_stats(pts, float(prof.height) if prof and prof.height else None, g.target_weight_kg)}


# ------------------------------------------------------------------ sleep
class StageIn(BaseModel):
    stage: str = Field(..., pattern="^(awake|light|deep|rem)$")
    start: datetime
    end: datetime


class SleepIn(BaseModel):
    start: datetime
    end: datetime
    stages: Optional[List[StageIn]] = Field(None, max_length=600)
    source: str = Field("manual", pattern="^(manual|apple_health|watch)$")


def _sleep_dict(s: SleepSession) -> dict:
    asleep = s.light_min + s.deep_min + s.rem_min if s.stages else s.total_min
    return {"id": s.id, "start": _utc(s.start).isoformat(), "end": _utc(s.end).isoformat(), "total_min": s.total_min, "asleep_min": asleep,
            "awake_min": s.awake_min, "light_min": s.light_min, "deep_min": s.deep_min, "rem_min": s.rem_min, "score": s.score,
            "stages": s.stages, "has_stages": bool(s.stages), "source": s.source}


@router.post("/sleep")
def log_sleep(body: SleepIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    start, end = _utc(body.start), _utc(body.end)
    mins = (end - start).total_seconds() / 60
    if mins < 30 or mins > 16 * 60:
        raise HTTPException(422, "Sleep must be between 30 minutes and 16 hours")
    if end > datetime.now(timezone.utc) + timedelta(minutes=5):
        raise HTTPException(400, "Sleep cannot end in the future")
    segs = None
    if body.stages:
        segs = []
        for st in body.stages:
            a, b = _utc(st.start), _utc(st.end)
            if b <= a or a < start - timedelta(minutes=1) or b > end + timedelta(minutes=1):
                raise HTTPException(422, "Sleep stages must be inside the sleep period and in order")
            segs.append({"stage": st.stage, "start": a, "end": b})
        segs.sort(key=lambda s: s["start"])
    sm = svc.sleep_summary(start, end, segs)
    score, _ = svc.sleep_score(sm["asleep_min"], sm["deep_min"], sm["rem_min"], sm["awake_min"], bool(segs))
    row = SleepSession(user_id=user.id, start=start, end=end, total_min=sm["total_min"], awake_min=sm["awake_min"], light_min=sm["light_min"],
                       deep_min=sm["deep_min"], rem_min=sm["rem_min"], score=score, source=body.source,
                       stages=[{"stage": s["stage"], "start": s["start"].isoformat(), "end": s["end"].isoformat()} for s in segs] if segs else None)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _sleep_dict(row)


@router.get("/sleep")
def sleep_report(days: int = 14, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    since = datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 90)))
    rows = db.query(SleepSession).filter(SleepSession.user_id == user.id, SleepSession.end >= since).order_by(SleepSession.end.desc()).all()
    nights = [_sleep_dict(r) for r in rows]
    recent = rows[:7]
    avg_h = round(statistics.mean(r.total_min if not r.stages else r.light_min + r.deep_min + r.rem_min for r in recent) / 60, 1) if recent else None
    staged = [r for r in recent if r.stages]
    deep_pct = round(100 * statistics.mean(r.deep_min / max(1, r.light_min + r.deep_min + r.rem_min) for r in staged), 1) if staged else None
    awake_pct = round(100 * statistics.mean(r.awake_min / max(1, r.total_min) for r in staged), 1) if staged else None
    spread = None
    if len(recent) >= 3:
        mins = [((_utc(r.start).hour * 60 + _utc(r.start).minute) + (1440 if _utc(r.start).hour < 12 else 0)) for r in recent]
        spread = round(statistics.pstdev(mins), 1)
    return {"nights": nights, "last": nights[0] if nights else None, "avg_hours": avg_h, "avg_deep_pct": deep_pct, "avg_awake_pct": awake_pct,
            "bedtime_spread_min": spread, "advice": svc.sleep_advice(avg_h, deep_pct, awake_pct, spread) if recent else [],
            "stage_note": None if staged or not recent else "Connect a smartwatch or Apple Health to see awake, light, deep and REM sleep."}


# ------------------------------------------------------------------ knowledge
KNOWLEDGE = [
    {"id": "activity", "title": "How much activity is enough?", "topic": "Activity", "summary": "Adults benefit from 150 to 300 minutes of moderate activity a week.",
     "body": ["The World Health Organization advises adults to do 150 to 300 minutes of moderate activity, or 75 to 150 minutes of vigorous activity, each week.",
              "Moderate means you can talk but not sing, such as brisk walking. Every bit counts, and short walks add up.", "Start small and add 10 minutes a week. If you have a heart condition, ask your clinician before increasing."]},
    {"id": "steps", "title": "What about 10,000 steps?", "topic": "Activity", "summary": "More steps are linked to better health, and benefits start well below 10,000.",
     "body": ["Studies link more daily steps to a lower risk of early death, with big gains from the first 4,000 to 8,000 steps a day.", "Choose a goal you can reach most days, then raise it slowly."]},
    {"id": "heart_rate", "title": "Understanding your heart rate", "topic": "Heart rate", "summary": "A normal resting heart rate for adults is 60 to 100 beats a minute.",
     "body": ["Resting heart rate is best measured after sitting quietly for five minutes. Fit people can have a rate in the 50s.", "During exercise your rate rises. A rough maximum is 220 minus your age. Moderate effort is about 50 to 70 percent of that.",
              "A rate that stays above 100 at rest, or any fast heartbeat with chest pain, dizziness or breathlessness, needs medical attention."]},
    {"id": "weight", "title": "Healthy weight change", "topic": "Weight", "summary": "Losing 0.5 to 1 kg a week is a safe pace for most people.",
     "body": ["Weigh yourself at the same time of day, on the same scale, ideally once a week. Daily weight moves up and down with water.", "A body mass index of 18.5 to 24.9 is the healthy range for most adults. It does not measure fat directly.",
              "Fast loss is hard to keep off. Smaller portions of starchy foods, more vegetables and regular movement work better than strict diets."]},
    {"id": "sleep", "title": "How sleep works", "topic": "Sleep", "summary": "Adults need 7 to 9 hours, moving through light, deep and REM sleep.",
     "body": ["Light sleep makes up about half the night. Deep sleep repairs the body and is most common early in the night. REM sleep supports memory and mood.",
              "A regular bedtime, a dark cool room, and no caffeine or large meals late in the day help. Screens in the last 30 minutes before bed delay sleep."]},
    {"id": "salt", "title": "Salt and blood pressure", "topic": "Blood pressure", "summary": "Eating less salt is one of the most effective ways to lower blood pressure.",
     "body": ["The World Health Organization recommends under 5 grams of salt a day, about one level teaspoon, including salt hidden in stock cubes, salted fish and shito.", "Season with pepper, ginger, onion and herbs instead, and check food labels."]},
]


@router.get("/knowledge")
def knowledge(user: User = Depends(get_current_active_user)):
    return {"items": KNOWLEDGE, "note": "General health information, not personal medical advice."}


# ---------------------------------------------------------------- imports from Apple Health (so nobody types them in every day)
class WeightImportItem(BaseModel):
    kg: float = Field(..., ge=20, le=400)
    at: datetime


class WeightImport(BaseModel):
    entries: List[WeightImportItem] = Field(..., max_length=200)


@router.post("/weight/import")
def import_weight(body: WeightImport, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Weigh-ins read from Apple Health. Safe to send again: one with the same time and weight is stored once."""
    now = datetime.now(timezone.utc)
    have = {(_utc(r.at).replace(microsecond=0), round(r.kg, 1)) for r in db.query(WeightLog).filter(WeightLog.user_id == user.id).all()}
    added = 0
    for e in body.entries:
        at = _utc(e.at).replace(microsecond=0)
        if at > now + timedelta(minutes=5):
            continue
        key = (at, round(e.kg, 1))
        if key in have:
            continue
        have.add(key)
        db.add(WeightLog(user_id=user.id, kg=round(e.kg, 1), at=at))
        added += 1
    db.commit()
    return {"added": added}


class SleepImportItem(BaseModel):
    start: datetime
    end: datetime
    asleep_min: int = Field(..., ge=0, le=960)
    awake_min: int = Field(0, ge=0, le=960)
    deep_min: int = Field(0, ge=0, le=960)
    rem_min: int = Field(0, ge=0, le=960)
    light_min: int = Field(0, ge=0, le=960)
    stages: Optional[List[StageIn]] = Field(None, max_length=600)


class SleepImport(BaseModel):
    sessions: List[SleepImportItem] = Field(..., max_length=60)


@router.post("/sleep/import")
def import_sleep(body: SleepImport, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Nights read from Apple Health (a watch or the iPhone's own sleep tracking). One night is stored once, whatever number of times it is sent."""
    now = datetime.now(timezone.utc)
    have = {_utc(r.start).replace(microsecond=0) for r in db.query(SleepSession).filter(SleepSession.user_id == user.id, SleepSession.source == "apple_health").all()}
    added = 0
    for s in body.sessions:
        start, end = _utc(s.start).replace(microsecond=0), _utc(s.end).replace(microsecond=0)
        mins = (end - start).total_seconds() / 60
        if mins < 30 or mins > 16 * 60 or end > now + timedelta(minutes=5) or start in have or s.asleep_min < 30:
            continue
        have.add(start)
        segs = None
        if s.stages:
            segs = []
            for st in s.stages:
                x, y = _utc(st.start), _utc(st.end)
                if y <= x or x < start - timedelta(minutes=1) or y > end + timedelta(minutes=1):
                    continue                                     # a stray stage outside the night is ignored, not a reason to drop the night
                segs.append({"stage": st.stage, "start": x, "end": y})
            segs.sort(key=lambda g: g["start"])
        if segs:
            sm = svc.sleep_summary(start, end, segs)
            score, _ = svc.sleep_score(sm["asleep_min"], sm["deep_min"], sm["rem_min"], sm["awake_min"], True)
            db.add(SleepSession(user_id=user.id, start=start, end=end, total_min=sm["total_min"], awake_min=sm["awake_min"], light_min=sm["light_min"],
                                deep_min=sm["deep_min"], rem_min=sm["rem_min"], score=score, source="apple_health",
                                stages=[{"stage": g["stage"], "start": g["start"].isoformat(), "end": g["end"].isoformat()} for g in segs]))
        else:
            score, _ = svc.sleep_score(s.asleep_min, s.deep_min, s.rem_min, s.awake_min, bool(s.deep_min or s.rem_min))
            db.add(SleepSession(user_id=user.id, start=start, end=end, total_min=s.asleep_min, awake_min=s.awake_min, light_min=s.light_min,
                                deep_min=s.deep_min, rem_min=s.rem_min, score=score, source="apple_health", stages=None))
        added += 1
    db.commit()
    return {"added": added}
