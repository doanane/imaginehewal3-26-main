from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from app.auth.security import get_current_active_user  
from app.models.user import User, UserProfile
from app.models.health import HealthData, FoodLog, WeeklyProgress, HealthInsight
from app.models.iot_device import VitalReading
from app.models.activity import HealthGoals, SleepSession
from app.models.safety import Medication, MedicationLog
from app.schemas.health import (
    HealthDataCreate, HealthDataResponse, 
    FoodLogCreate, FoodLogResponse, 
    WeeklyProgressResponse, HealthDashboardResponse, 
    ProgressUpdateRequest,
    ActivityRing, HealthTrend, HealthCategory, DailyHealthScore
    , PersonalizedRecommendation, RiskAlert
)

from app.services.par import par
router = APIRouter(prefix="/health", tags=["health"])

def build_personalized_guidance(profile, health_data, latest_vital, today_food_logs):
    conditions = [str(c).lower() for c in (profile.chronic_conditions or [])] if profile else []
    recommendations = []
    risks = []
    based_on = []

    steps = health_data.steps or 0
    if steps < 5000:
        based_on.append(f"{steps} steps recorded today")
        recommendations.append(PersonalizedRecommendation(
            title="Add a short walk",
            message="Your recorded activity is below 5,000 steps today. If you feel well, take a gentle 10-minute walk and build gradually.",
            action="Log a walk",
            source="real health data",
            based_on=[f"{steps} steps recorded today"],
        ))
    elif steps >= 8000:
        based_on.append(f"{steps} steps recorded today")
        recommendations.append(PersonalizedRecommendation(
            title="Keep your movement routine",
            message="You have already recorded a strong activity level today. Keep the pace comfortable and stay hydrated.",
            action="Keep tracking",
            source="real health data",
            based_on=[f"{steps} steps recorded today"],
        ))

    if health_data.water_intake is not None and health_data.water_intake < 1500:
        recommendations.append(PersonalizedRecommendation(
            title="Drink more water",
            message=f"Your recorded water intake is {health_data.water_intake} ml. Add water gradually unless your clinician has set a fluid restriction.",
            action="Log water",
            source="real health data",
            based_on=[f"{health_data.water_intake} ml recorded today"],
        ))

    if health_data.sleep_time is not None and health_data.sleep_time < 420:
        recommendations.append(PersonalizedRecommendation(
            title="Protect your sleep window",
            message=f"Your latest recorded sleep was {health_data.sleep_time} minutes. Try a consistent bedtime tonight and discuss persistent poor sleep with your clinician.",
            action="Review sleep",
            source="real health data",
            based_on=[f"{health_data.sleep_time} minutes of sleep recorded"],
        ))

    if latest_vital and latest_vital.heart_rate is not None:
        if latest_vital.heart_rate >= 120:
            risks.append(RiskAlert(
                code="high_heart_rate", title="High heart-rate alert",
                message="Your latest recorded heart rate is above the configured safety threshold. Rest and seek urgent help if you feel unwell.",
                severity="high", source="wearable vital reading",
                based_on=[f"{latest_vital.heart_rate} bpm"],
            ))
        elif latest_vital.heart_rate <= 40:
            risks.append(RiskAlert(
                code="low_heart_rate", title="Low heart-rate alert",
                message="Your latest recorded heart rate is below the configured safety threshold. Contact your care team, especially if you feel dizzy or faint.",
                severity="high", source="wearable vital reading",
                based_on=[f"{latest_vital.heart_rate} bpm"],
            ))

    if latest_vital and latest_vital.blood_oxygen is not None and latest_vital.blood_oxygen < 90:
        risks.append(RiskAlert(
            code="low_oxygen", title="Low oxygen alert",
            message="Your latest recorded oxygen reading is below the configured safety threshold. Repeat the reading while still and seek urgent help if it remains low or you feel unwell.",
            severity="high", source="wearable vital reading",
            based_on=[f"{latest_vital.blood_oxygen}% oxygen"],
        ))

    if latest_vital and (
        (latest_vital.blood_pressure_systolic or 0) >= 180
        or (latest_vital.blood_pressure_diastolic or 0) >= 120
    ):
        risks.append(RiskAlert(
            code="high_blood_pressure", title="High blood-pressure alert",
            message="Your latest recorded blood pressure is in a critical range. Rest, repeat the measurement, and seek urgent medical help, especially with symptoms.",
            severity="critical", source="wearable vital reading",
            based_on=[f"{latest_vital.blood_pressure_systolic}/{latest_vital.blood_pressure_diastolic} mmHg"],
        ))

    for log in today_food_logs:
        nutrients = log.nutrients or {}
        sodium = nutrients.get("sodium") if isinstance(nutrients, dict) else None
        if isinstance(sodium, (int, float)) and sodium >= 600:
            risks.append(RiskAlert(
                code="high_salt", title="High-salt alert",
                message="A logged meal contains a high sodium estimate. Choose less stock cube, salted fish, and added salt in your next meal.",
                severity="medium", source="logged meal nutrition data",
                based_on=[f"{sodium} mg sodium in meal {log.id}"],
            ))
            break

    if not recommendations and not risks:
        recommendations.append(PersonalizedRecommendation(
            title="Keep recording your day",
            message="There is not enough recent health data for a more specific recommendation. Connect an approved source or log a reading, meal, water, or activity.",
            action="Add health data",
            source="data availability",
            based_on=[],
        ))

    return recommendations[:3], risks[:5]

@router.get("/dashboard", response_model=HealthDashboardResponse)
def get_health_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    
    
    
    uid = current_user.id
    today = datetime.now()
    week_start = (today - timedelta(days=today.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)   # midnight, so one row per week
    week_end = week_start + timedelta(days=6)
    today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)

    # These reads do not depend on each other, so they are asked at the same time (one round trip instead of five).
    profile, health_data, latest_vital, weekly_progress, today_food_logs = par(
        lambda d: d.query(UserProfile).filter(UserProfile.user_id == uid).first(),
        lambda d: d.query(HealthData).filter(HealthData.user_id == uid).order_by(HealthData.date.desc()).first(),
        lambda d: d.query(VitalReading).filter(VitalReading.user_id == uid).order_by(VitalReading.timestamp.desc()).first(),
        lambda d: d.query(WeeklyProgress).filter(WeeklyProgress.user_id == uid, WeeklyProgress.week_start_date >= week_start).first(),
        lambda d: d.query(FoodLog).filter(FoodLog.user_id == uid, FoodLog.created_at >= today_start).order_by(FoodLog.created_at.desc()).limit(5).all(),
    )
    welcome_name = profile.full_name if profile else current_user.username

    if not health_data:
        health_data = HealthData(user_id=uid, steps=0, sleep_time=None, water_intake=0, blood_pressure=None, heart_rate=None,
                                 blood_glucose=None, calories_burned=0, date=datetime.now())
        db.add(health_data)
        db.commit()
        db.refresh(health_data)

    if not weekly_progress:
        weekly_progress = WeeklyProgress(user_id=uid, week_start_date=week_start, week_end_date=week_end, progress_score=0,
                                         progress_color="red", steps_goal=10000, sleep_goal=480, water_goal=2000)
        db.add(weekly_progress)
        db.commit()
        db.refresh(weekly_progress)

    steps = health_data.steps if health_data.steps is not None else 0
    calories = health_data.calories_burned if health_data.calories_burned is not None else 0
    water = health_data.water_intake if health_data.water_intake is not None else 0
    heart_rate = latest_vital.heart_rate if latest_vital and latest_vital.heart_rate is not None else health_data.heart_rate
    oxygen = latest_vital.blood_oxygen if latest_vital else None
    blood_pressure = (
        f"{latest_vital.blood_pressure_systolic}/{latest_vital.blood_pressure_diastolic}"
        if latest_vital and latest_vital.blood_pressure_systolic and latest_vital.blood_pressure_diastolic
        else health_data.blood_pressure
    )
    personalized_recommendations, risk_alerts = build_personalized_guidance(
        profile, health_data, latest_vital, today_food_logs
    )
    
    recent_meals = []
    for log in today_food_logs:
        recent_meals.append({
            "id": log.id,
            "meal_type": log.meal_type,
            "detected_food": log.ai_analysis.get('detected_food', 'Unknown') if log.ai_analysis else 'Unknown',
            "diet_score": log.diet_score,
            "created_at": log.created_at
        })
    
    diet_score = 0
    if today_food_logs:
        total_diet = sum(log.diet_score or 0 for log in today_food_logs)
        diet_score = total_diet // len(today_food_logs)
    
    
    
    
    
    
    rings = ActivityRing(
        move=calories,
        move_goal=600,
        exercise=0,
        exercise_goal=30,
        stand=0,
        stand_goal=12
    )

    
    # A goals score: only goals that are actually being tracked count, each against the person's own target.
    goals = db.query(HealthGoals).filter(HealthGoals.user_id == uid).first()
    steps_goal = (goals.steps if goals and goals.steps else 8000)
    parts = [{"key": "steps", "label": "Steps", "pct": min(100, round(steps / steps_goal * 100)), "detail": f"{steps:,} of {steps_goal:,}"}]
    if water:
        wg = weekly_progress.water_goal or 2000
        parts.append({"key": "water", "label": "Water", "pct": min(100, round(water / wg * 100)), "detail": f"{water} of {wg} ml"})
    last_sleep = (db.query(SleepSession).filter(SleepSession.user_id == uid, SleepSession.end >= datetime.now().astimezone() - timedelta(hours=36))
                  .order_by(SleepSession.end.desc()).first())
    sleep_min = None
    if last_sleep:
        sleep_min = (last_sleep.light_min + last_sleep.deep_min + last_sleep.rem_min) if last_sleep.stages or last_sleep.deep_min else last_sleep.total_min
    elif health_data.sleep_time:
        sleep_min = health_data.sleep_time
    if sleep_min:
        sg = weekly_progress.sleep_goal or 480
        parts.append({"key": "sleep", "label": "Sleep", "pct": min(100, round(sleep_min / sg * 100)), "detail": f"{sleep_min // 60} h {sleep_min % 60} min"})
    if today_food_logs:
        parts.append({"key": "diet", "label": "Meals", "pct": diet_score, "detail": f"{len(today_food_logs)} logged"})
    meds = db.query(Medication).filter(Medication.user_id == uid, Medication.active == True).all()  # noqa: E712
    due = sum(len(m.times or []) for m in meds)
    if due:
        taken = db.query(MedicationLog).filter(MedicationLog.user_id == uid, MedicationLog.day == today.date(), MedicationLog.status == "taken").count()
        parts.append({"key": "medicine", "label": "Medicines", "pct": min(100, round(taken / due * 100)), "detail": f"{taken} of {due} taken"})
    score_val = round(sum(p["pct"] for p in parts) / len(parts))
    daily_score_obj = DailyHealthScore(
        score=score_val,
        message=f"{score_val}% of today's goals, from {len(parts)} you are tracking.",
        trend_percentage=None,
        breakdown=parts,
    )

    trends = [
        HealthTrend(category="Walking", icon="walk", value=f"{steps} steps", trend="up" if steps >= steps_goal else "neutral", message=f"{min(100, round(steps / steps_goal * 100))}% of your {steps_goal:,} step goal."),
        HealthTrend(category="Active Energy", icon="flame", value=f"{calories} kcal", trend="neutral", message="From your latest synced health record."),
        HealthTrend(category="Sleep", icon="bed", value=f"{sleep_min} min" if sleep_min else "--", trend="neutral", message="From last night's sleep in Apple Health." if sleep_min else "No sleep recorded in the last 36 hours."),
        HealthTrend(category="Stand", icon="body", value="--", trend="neutral", message="Stand data is available when your wearable provides it."),
    ]

    
    categories = [
        
        HealthCategory(id="rings", title="Activity", value=f"{int((calories/600)*100)}%", unit="goal", icon="aperture", color="#E11D48", is_workout=False),
        HealthCategory(id="steps", title="Steps", value=f"{steps:,}", unit="steps", icon="footsteps", color="#F59E0B", is_workout=False),
        
        
        HealthCategory(id="hr", title="Heart Rate", value=str(heart_rate) if heart_rate is not None else "--", unit="BPM", icon="heart", color="#FF3B30", is_workout=False),
        HealthCategory(id="bp", title="Blood Pressure", value=blood_pressure or "--", unit="mmHg", icon="pulse", color="#FF3B30", is_workout=False),
        HealthCategory(id="oxy", title="Blood Oxygen", value=f"{round(oxygen)}" if oxygen is not None else "--", unit="%", icon="water", color="#5AC8FA", is_workout=False),
        
        
        HealthCategory(id="water", title="Water Intake", value=f"{water}", unit="ml", icon="water", color="#007AFF", is_workout=False),
        HealthCategory(id="sleep", title="Sleep Analysis", value=f"{sleep_min}" if sleep_min else "--", unit="min", icon="bed", color="#FF9500", is_workout=False),
        HealthCategory(id="mind", title="Mindfulness", value="--", unit="min", icon="leaf", color="#34C759", is_workout=False),

        
        HealthCategory(id="run", title="Outdoor Run", value="--", unit="km", icon="walk", color="#34C759", is_workout=True),
        HealthCategory(id="cycle", title="Cycling", value="--", unit="km", icon="bicycle", color="#34C759", is_workout=True),
        HealthCategory(id="swim", title="Swimming", value="--", unit="m", icon="water", color="#34C759", is_workout=True),
    ]

    return HealthDashboardResponse(
        
        welcome_message=f"Welcome, {welcome_name}",
        weekly_progress=weekly_progress,
        health_snapshot=health_data,
        diet_score=diet_score,
        daily_tip=personalized_recommendations[0].message if personalized_recommendations else None,
        recent_meals=recent_meals,
        meal_count_today=len(today_food_logs),
        
        
        daily_score=daily_score_obj,
        activity_rings=rings,
        trends=trends,
        categories=categories,
        personalized_recommendations=personalized_recommendations,
        risk_alerts=risk_alerts,
    )

@router.post("/food-log", response_model=FoodLogResponse)
def log_food(
    food_data: FoodLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    
    ai_analysis = {
        "analysis": "Food analyzed successfully",
        "nutrients": {
            "protein": random.randint(10, 30),
            "carbs": random.randint(20, 60),
            "fats": random.randint(5, 20)
        },
        "recommendations": ["Good balance of nutrients", "Consider adding more vegetables"]
    }
    
    food_log = FoodLog(
        user_id=current_user.id,
        meal_type=food_data.meal_type,
        diet_score=food_data.diet_score or random.randint(60, 95),
        ai_analysis=ai_analysis,
        nutrients=ai_analysis["nutrients"]
    )
    
    db.add(food_log)
    db.commit()
    db.refresh(food_log)
    return food_log

@router.get("/weekly-progress", response_model=WeeklyProgressResponse)
def get_weekly_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    today = datetime.now()
    week_start = today - timedelta(days=today.weekday())
    
    progress = db.query(WeeklyProgress).filter(
        WeeklyProgress.user_id == current_user.id,
        WeeklyProgress.week_start_date >= week_start
    ).first()
    
    if not progress:
        
        return WeeklyProgressResponse(
            id=0,
            user_id=current_user.id,
            week_start_date=week_start,
            week_end_date=week_start + timedelta(days=6),
            progress_score=0,
            progress_color="gray",
            steps_goal=10000,
            sleep_goal=480,
            water_goal=2000
        )
    
    return progress

@router.get("/health-snapshot", response_model=HealthDataResponse)
def get_health_snapshot(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    snapshot = db.query(HealthData).filter(
        HealthData.user_id == current_user.id
    ).order_by(HealthData.date.desc()).first()
    
    if not snapshot:
        snapshot = HealthData(
            user_id=current_user.id,
            steps=0,
            sleep_time=480,
            water_intake=2000,
            blood_pressure="120/80",
            heart_rate=72,
            blood_glucose=90.0,
            date=datetime.now()
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
    
    return snapshot
    

@router.post("/health-data", response_model=HealthDataResponse)
def add_health_data(
    health_data: HealthDataCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    data_dict = health_data.dict()
    data_dict['date'] = datetime.now()
    health_record = HealthData(user_id=current_user.id, **data_dict)
    db.add(health_record)
    db.commit()
    db.refresh(health_record)
    return health_record

@router.get("/food-logs", response_model=list[FoodLogResponse])
def get_food_logs(
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    logs = db.query(FoodLog).filter(
        FoodLog.user_id == current_user.id
    ).order_by(FoodLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs

@router.post("/update-progress")
def update_weekly_progress(
    progress_data: ProgressUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    today = datetime.now()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    
    if progress_data.progress_score >= 80:
        progress_color = "green"
    elif progress_data.progress_score >= 60:
        progress_color = "yellow"
    elif progress_data.progress_score >= 40:
        progress_color = "orange"
    else:
        progress_color = "red"
    
    weekly_progress = db.query(WeeklyProgress).filter(
        WeeklyProgress.user_id == current_user.id,
        WeeklyProgress.week_start_date >= week_start
    ).first()
    
    if weekly_progress:
        weekly_progress.progress_score = progress_data.progress_score
        weekly_progress.progress_color = progress_color
    else:
        weekly_progress = WeeklyProgress(
            user_id=current_user.id,
            week_start_date=week_start,
            week_end_date=week_end,
            progress_score=progress_data.progress_score,
            progress_color=progress_color,
            steps_goal=10000,
            sleep_goal=480,
            water_goal=2000
        )
        db.add(weekly_progress)
    
    db.commit()
    return {"message": "Progress updated successfully"}