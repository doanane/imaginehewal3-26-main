"""Meals: identify from a photo (free providers, always confirmed by the user), search, log, and daily totals."""
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import get_db
from app.models.health import FoodLog
from app.models.user import User, UserProfile
from app.services import ghana_foods as gf
from app.services import vision_service

from app.services.image_check import sniff_image
from app.services.care_snapshot import latest_vitals
from app.services.meal_coach import coach_tip
router = APIRouter(prefix="/meals", tags=["meals"])

MAX_IMAGE_BYTES = 8 * 1024 * 1024
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
DAILY_TARGET_KCAL = 2000   # general adult reference; a clinician can personalise this later


class LogIn(BaseModel):
    dish_id: str = Field(..., max_length=64)
    portion: str = Field("regular", pattern="^(small|regular|large|extra)$")
    meal_type: str = Field("lunch", pattern="^(breakfast|lunch|dinner|snack)$")


def _conditions(db: Session, user: User) -> list:
    p = db.query(UserProfile).filter_by(user_id=user.id).first()
    c = p.chronic_conditions if p else []
    return [str(x) for x in c] if isinstance(c, list) else []


@router.get("/foods")
def foods(q: str = "", limit: int = 12, user: User = Depends(get_current_active_user)):
    return {"items": gf.search(q, max(1, min(limit, 40))), "portions": list(gf.PORTIONS), "note": "Nutrition values are estimates for a typical serving."}


@router.get("/foods/{dish_id}")
def food(dish_id: str, portion: str = "regular", db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    f = gf.FOODS.get(dish_id)
    if not f or portion not in gf.PORTIONS:
        raise HTTPException(404, "Dish not found")
    mult = gf.PORTIONS[portion]
    conds = _conditions(db, user)
    nutrients, assessment = gf.scale(f, mult), gf.assess(f, mult, conds)
    coach = coach_tip(latest_vitals(db, user.id), nutrients, assessment, f["name"], conds)      # the dish joined with this person's live readings
    return {**gf.public(f), "portion": portion, "nutrients": nutrients, "assessment": assessment, "coach": coach}


@router.post("/identify")
async def identify(file: UploadFile = File(...), user: User = Depends(get_current_active_user)):
    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Photo is too large (8 MB maximum)")
    kind = sniff_image(data)                           # judged by the file itself, not by the label the phone put on it
    if kind not in ALLOWED_MIME:
        raise HTTPException(400, "Please upload a JPEG, PNG or WebP photo")
    result = vision_service.identify(data, kind)   # image is analysed in memory and never stored
    result["suggestions"] = gf.search("", 8) if not result["candidates"] else []
    result["notice"] = ("Your photo was analysed by an external service and was not saved." if result["provider"] != "none" else "")
    return result


@router.post("/log")
def log_meal(body: LogIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    f = gf.FOODS.get(body.dish_id)
    if not f:
        raise HTTPException(404, "Dish not found")
    mult = gf.PORTIONS[body.portion]
    nutrients, assessment = gf.scale(f, mult), gf.assess(f, mult, _conditions(db, user))
    analysis = {"detected_food": f["name"], "dish_id": f["id"], "portion": body.portion, "nutrients": nutrients,
                "assessment": assessment, "analysis_source": "local_database"}
    row = FoodLog(user_id=user.id, meal_type=body.meal_type, ai_analysis=analysis, diet_score=assessment["diet_score"], nutrients=nutrients)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "dish": gf.public(f), "portion": body.portion, "meal_type": body.meal_type, "nutrients": nutrients,
            "assessment": assessment, "today": _today(db, user)}


def _today(db: Session, user: User) -> dict:
    start = datetime.combine(date.today(), datetime.min.time())
    rows = db.query(FoodLog).filter(FoodLog.user_id == user.id, FoodLog.created_at >= start).order_by(FoodLog.id.desc()).all()
    kcal = sum((r.nutrients or {}).get("calories", 0) or 0 for r in rows)
    meals = [{"id": r.id, "meal_type": r.meal_type, "name": (r.ai_analysis or {}).get("detected_food", "Meal"),
              "calories": (r.nutrients or {}).get("calories", 0), "diet_score": r.diet_score} for r in rows]
    num = lambda key: round(sum(float((r.nutrients or {}).get(key) or 0) for r in rows), 1)
    carbs, protein, fat = num("carbs"), num("protein"), num("fat")
    macros = {"carbs_g": carbs, "protein_g": protein, "fat_g": fat, "fibre_g": num("fibre"), "sodium_mg": num("sodium_mg"),
              "kcal_from": {"carbs": round(carbs * 4), "protein": round(protein * 4), "fat": round(fat * 9)}}   # 4, 4 and 9 kcal per gram
    return {"meals": meals, "calories": kcal, "target": DAILY_TARGET_KCAL, "macros": macros,
            "percent": min(100, round(100 * kcal / DAILY_TARGET_KCAL)) if DAILY_TARGET_KCAL else 0}


@router.get("/today")
def today(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return _today(db, user)
