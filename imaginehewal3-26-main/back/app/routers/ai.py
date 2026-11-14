"""AI summaries for the signed-in person. The chat is in assistant.py; meal photos are in food_analysis.py and meals.py."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.auth.security import get_current_active_user
from app.models.user import User
from app.services import ai_features, gemini_service
from app.services.week_data import collect_week

router = APIRouter(prefix="/ai", tags=["ai"])
INSIGHT_TTL = 3 * 3600


@router.get("/status")
def status(user: User = Depends(get_current_active_user)):
    return {"ai": gemini_service.available(), "model": gemini_service.model_name() if gemini_service.available() else None}


@router.get("/insights")
def insights(refresh: bool = False, user: User = Depends(get_current_active_user)):
    """Your week in a few honest sentences, from your real readings. Remembered for 3 hours; pull to refresh asks again."""
    if refresh:
        ai_features.forget("insights", user.id)
    def make():
        out = ai_features.weekly_insights(collect_week(user))
        out["generated_at"] = datetime.now(timezone.utc).isoformat()
        return out
    return ai_features.cached(("insights", user.id), INSIGHT_TTL, make)
