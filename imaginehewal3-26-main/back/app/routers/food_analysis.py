from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
import uuid
import os
from datetime import datetime
import tempfile
import logging
import json

from app.database import get_db
from app.auth.security import get_current_active_user
from app.models.user import User, UserProfile
from app.models.health import FoodLog
from app.services.azure_ai import azure_ai_service
from app.services.openai_service import OpenAIService

logger = logging.getLogger(__name__)

# Initialize services
openai_service = OpenAIService()

router = APIRouter(prefix="/api", tags=["food_analysis"])

@router.post("/analyze-meal", response_model=dict)
async def analyze_meal(
    meal_type: str = Form(..., description="Type of meal: breakfast, lunch, dinner, snack"),
    file: UploadFile = File(..., description="Image of the meal"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Analyse a meal photo with Gemini for THIS person (their conditions and age), then save it to their food log.
    The photo is analysed in memory and is not stored."""
    from app.services import ai_features, gemini_service
    from app.services.meal_coach import coach_tip
    from app.services.care_snapshot import latest_vitals

    data = await file.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large. Maximum size is 10MB")
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    conds = [str(c) for c in ((profile.chronic_conditions if profile else None) or [])] if profile else []
    try:
        ai = ai_features.analyze_meal_photo(data, conds, profile.age if profile else None)
    except ValueError as e:
        if str(e) == "not_food":
            raise HTTPException(422, "That does not look like a meal. Try again with the food in the middle of the photo.")
        raise HTTPException(400, "Please attach a JPEG, PNG or WebP photo.")
    except gemini_service.GeminiError:
        raise HTTPException(503, "Photo analysis is unavailable right now. You can log the meal from the list instead.")

    n = ai["nutrients"]
    coach = coach_tip(latest_vitals(db, current_user.id), {"kcal": n["calories"], "carbs": n["carbs"], "sodium_mg": n["sodium_mg"]},
                      {"advice": ai["healthier_alternative"], "concerns": [ai["chronic_disease_impact"]]}, ai["detected_food"], conds)
    response = {
        "analysis_id": f"meal_{datetime.now().timestamp()}", "meal_type": meal_type, "detected_food": ai["detected_food"],
        "description": ai["description"], "tags": [], "nutrients": {**n, "fats": n["fat"]}, "confidence": ai["confidence"], "diet_score": ai["diet_score"],
        "primary_recommendation": ai["immediate_recommendation"], "secondary_recommendation": ai["balancing_advice"],
        "detailed_analysis": {"chronic_disease_impact": ai["chronic_disease_impact"], "portion_guidance": ai["portion_guidance"],
                              "healthier_alternative": ai["healthier_alternative"], "warning_level": ai["warning_level"],
                              "key_nutrients_to_watch": ai["key_nutrients_to_watch"]},
        "coach": coach, "is_balanced": ai["is_balanced"], "analysis_source": "gemini", "timestamp": datetime.now().isoformat(), "category": "meal",
    }
    food_log = FoodLog(user_id=current_user.id, meal_type=meal_type, food_image_url=None, ai_analysis=response, diet_score=ai["diet_score"],
                       nutrients=response["nutrients"], created_at=datetime.now())
    db.add(food_log)
    db.commit()
    db.refresh(food_log)
    response["analysis_id"] = food_log.id
    return response


@router.get("/daily-tip")
def get_daily_tip(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """One practical tip for today, written by AI for this person's conditions and today's readings. Same tip all day (remembered), so the
    screen is instant and the free quota is not used on every visit."""
    from datetime import date as _date
    from app.services import ai_features, gemini_service as g
    from app.services.care_snapshot import latest_vitals
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    conds = [str(c) for c in ((profile.chronic_conditions if profile else None) or [])] if profile else []
    uid = current_user.id
    vit = latest_vitals(db, uid)

    def make():
        if g.available():
            facts = [f"conditions: {', '.join(conds)}" if conds else "no recorded conditions"]
            if vit.get("systolic") and vit.get("diastolic"):
                facts.append(f"latest blood pressure {vit['systolic']}/{vit['diastolic']}")
            if vit.get("heart_rate") is not None:
                facts.append(f"latest heart rate {vit['heart_rate']} bpm")
            if vit.get("steps") is not None:
                facts.append(f"steps today {vit['steps']}")
            try:
                tip = g.generate("You are a kind health coach in Ghana. Write ONE practical tip for today in at most 2 short sentences, plain words, "
                                 "no markdown, no emoji. Use the facts only if relevant; never invent numbers; never advise changing a medicine.",
                                 [g.text_content("user", "Facts: " + "; ".join(facts))], temperature=0.7, max_tokens=120, timeout=15)
                if tip:
                    return {"tip": tip.strip()[:300], "ai": True}
            except g.GeminiError:
                pass
        import random
        return {"tip": random.choice([
            "Drink water through the day and add a vegetable to every meal.", "Take a 10 to 15 minute walk after your biggest meal.",
            "Check your blood pressure at the same time each day and write it down.", "Take your medicines at the same time every day, with a reminder."]), "ai": False}

    out = ai_features.cached(("tip", uid, _date.today().isoformat()), 20 * 3600, make)
    return {"success": True, "tip": out["tip"], "personalized": bool(conds) or out["ai"], "timestamp": datetime.now().isoformat()}


@router.get("/recent-meals", response_model=list)
def get_recent_meals(
    skip: int = 0,
    limit: int = 10,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user's recent meal analyses"""
    meals = db.query(FoodLog).filter(
        FoodLog.user_id == current_user.id
    ).order_by(FoodLog.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for meal in meals:
        # Handle potential missing keys safely
        analysis = meal.ai_analysis or {}
        result.append({
            "id": meal.id,
            "meal_type": meal.meal_type,
            "detected_food": analysis.get('detected_food', 'Unknown'),
            "diet_score": meal.diet_score,
            "nutrients": meal.nutrients or {},
            "created_at": meal.created_at.isoformat(),
            "primary_recommendation": analysis.get('primary_recommendation', analysis.get('recommendation', ''))
        })
    
    return result

@router.post("/log-meal-manual")
def log_meal_manual(
    meal_type: str,
    food_name: str,
    calories: int,
    carbs: int,
    protein: int,
    fats: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Manual meal logging"""
    
    # Construct analysis result
    analysis_result = {
        "detected_food": food_name,
        "description": f"Manually logged: {food_name}",
        "tags": ["manual_log", food_name.lower()],
        "nutrients": {
            "calories": calories,
            "carbs": carbs,
            "protein": protein,
            "fat": fats,
            "type": "manual_entry"
        },
        "confidence": 1.0,
        "analysis_source": "manual"
    }
    
    # Get user profile for scoring
    user_profile = db.query(UserProfile).filter(
        UserProfile.user_id == current_user.id
    ).first()
    
    user_data = {}
    if user_profile:
        user_data = {
            'age': getattr(user_profile, 'age', None),
            'chronic_conditions': getattr(user_profile, 'chronic_conditions', []) or [],
            'gender': getattr(user_profile, 'gender', 'unknown')
        }
    
    # Calculate score
    diet_score = calculate_diet_score(analysis_result, user_data)
    analysis_result["diet_score"] = diet_score
    
    food_log = FoodLog(
        user_id=current_user.id,
        meal_type=meal_type,
        ai_analysis=analysis_result,
        diet_score=diet_score,
        nutrients=analysis_result['nutrients'],
        created_at=datetime.now()
    )
    
    db.add(food_log)
    db.commit()
    
    return {
        "message": "Meal logged successfully",
        "meal_id": food_log.id,
        "food_name": food_name,
        "diet_score": diet_score
    }

def calculate_diet_score(analysis_result: dict, user_data: dict) -> int:
    """Calculate a diet score from 0-100 based on analysis and user health"""
    
    base_score = 70  
    
    nutrients = analysis_result.get('nutrients', {})
    
    if nutrients.get('calories', 0) > 500:
        base_score -= 15
    elif nutrients.get('calories', 0) < 200:
        base_score += 10
    
    if nutrients.get('protein', 0) > 20:
        base_score += 10
    
    if nutrients.get('carbs', 0) > 60:
        base_score -= 10
    
    chronic_conditions = user_data.get('chronic_conditions', [])
    
    # Check for diabetes
    if any('diabet' in str(c).lower() for c in chronic_conditions) and nutrients.get('carbs', 0) > 40:
        base_score -= 20
    
    # Check for hypertension
    if any('hypertens' in str(c).lower() for c in chronic_conditions) and nutrients.get('type') == 'high_sodium':
        base_score -= 15
    
    food_type = nutrients.get('type', '')
    if food_type in ['vegetable', 'fruit']:
        base_score += 15
    elif food_type in ['starch', 'grain']:
        base_score -= 5
    
    return max(0, min(100, base_score))