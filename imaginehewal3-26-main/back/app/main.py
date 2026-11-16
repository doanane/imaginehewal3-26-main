from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import logging
from app.database import create_tables, engine
from app.config import settings         
from fastapi.responses import RedirectResponse, HTMLResponse, JSONResponse
from fastapi.exceptions import RequestValidationError

from app.seed import seed_db

from app.routers.iot import router as iot_router
# --- IMPORT ROUTERS ---
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.health import router as health_router
from app.routers.notifications import router as notifications_router
from app.routers.caregivers import router as caregivers_router
from app.routers.doctors import router as doctors_router
from app.routers.admin import router as admin_router
from app.routers.food_analysis import router as food_analysis_router
from app.routers.superadmin import router as superadmin_router
from app.routers.google_auth import router as google_auth_router
from app.routers.leaderboard import router as leaderboard_router

from app.routers.caregiver_dashboard import router as caregiver_dashboard_router
from app.routers.caregiver_tasks import router as caregiver_tasks_router
from app.routers.caregiver_schedule import router as caregiver_schedule_router
from app.routers.caregiver_analytics import router as caregiver_analytics_router
from app.routers.messages import router as messages_router
from app.routers.behavior import router as behavior_router
from app.routers.live_vitals import router as live_vitals_router
from app.routers.realtime import router as realtime_router
from app.routers.behavior_support import router as behavior_support_router, doctor_router as behavior_doctor_router
from app.routers.care_plan import doctor_router as care_plan_doctor_router, patient_router as care_plan_patient_router, misc_router as care_plan_misc_router
from app.routers.assistant import router as assistant_router
from app.routers.emergency import router as emergency_router
from app.routers.risk import router as risk_router
from app.routers.meals import router as meals_router
from app.routers.medications import router as medications_router
from app.routers.privacy import router as privacy_router
from app.routers.wellbeing import router as wellbeing_router
from app.routers.reports import router as reports_router
from app.routers.activity import router as activity_router
from app.routers.competition import router as competition_router
from app.routers.community import router as community_router
from app.routers.explore import router as explore_router
from app.routers.auth_pages import router as auth_pages_router
from app.routers.clinic import router as clinic_router, public_router as clinic_public_router
from app.routers.guest import router as guest_router
from app.routers.interop import router as interop_router
from app.routers.doctor_portal import router as doctor_portal_router, patient_router as my_doctor_router
from app.routers.ai import router as ai_router
from app.routers.huawei import router as huawei_router, huawei_worker
from app.routers.accessibility import router as accessibility_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_DOCS_ON = settings.ENVIRONMENT == "development" or os.getenv("ENABLE_DOCS") == "1"   # ENABLE_DOCS=1 shows /docs on a production server without switching to development mode

app = FastAPI(
    title="HEWAL3 Health API",
    description="AI-powered health management system with emergency response",
    version="3.0.0",
    docs_url="/docs" if _DOCS_ON else None,
    redoc_url="/redoc" if _DOCS_ON else None,
    openapi_url="/openapi.json" if _DOCS_ON else None,
)

allowed_origins = [
    "http://localhost:8081",
    "http://localhost:3000",
    "http://localhost:8000",
    "https://kwanpa-health-hub-six.vercel.app",
]

if settings.ENVIRONMENT == "development":
    allowed_origins.extend([
        "http://localhost:*",
        "http://127.0.0.1:*",
    ])

# In development, also accept browsers on the local network (phone testing over Wi-Fi/hotspot).
_lan_origin_regex = (
    r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+"
    r"|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$"
    if settings.ENVIRONMENT == "development" else None
)

from starlette.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=800)   # smaller responses over a slow link

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=_lan_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

os.makedirs("uploads", exist_ok=True)
os.makedirs("uploads/profile_images", exist_ok=True)
os.makedirs("uploads/profile_photos", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.include_router(accessibility_router)

@app.on_event("startup")
async def start_escalation_worker():
    import asyncio
    from app.services.emergency_service import escalation_worker
    app.state.escalation_task = asyncio.create_task(escalation_worker())


@app.on_event("startup")
async def start_huawei_worker():
    import asyncio
    app.state.huawei_task = asyncio.create_task(huawei_worker())     # does nothing until HUAWEI credentials are configured


@app.on_event("startup")
async def start_reengagement_worker():
    import asyncio
    from app.services.reengagement import reengagement_worker
    app.state.reengagement_task = asyncio.create_task(reengagement_worker())     # gentle outreach after a gap; see services/reengagement.py


@app.on_event("startup")
def warm_database_pool():
    import threading
    from app.database import warm_pool
    threading.Thread(target=warm_pool, daemon=True).start()


@app.on_event("startup")
def startup_event():
    try:
        create_tables()
        seed_db()
        logger.info("Database setup and seeding completed")
    except Exception as e:
        logger.warning(f"Database setup warning: {e}")

try:
    from app.routers.system import router as system_router
    app.include_router(system_router)
except ImportError:
    pass

app.include_router(auth_router)
app.include_router(iot_router) 
app.include_router(users_router)
app.include_router(health_router)
app.include_router(notifications_router)
app.include_router(caregivers_router)
app.include_router(doctors_router)
app.include_router(admin_router)
app.include_router(food_analysis_router)
app.include_router(superadmin_router)
app.include_router(google_auth_router)
app.include_router(leaderboard_router)

app.include_router(caregiver_dashboard_router)
app.include_router(caregiver_tasks_router)
app.include_router(caregiver_schedule_router)
app.include_router(caregiver_analytics_router)
app.include_router(messages_router)
app.include_router(behavior_router)
app.include_router(live_vitals_router)
app.include_router(realtime_router)
app.include_router(assistant_router)
app.include_router(emergency_router)
app.include_router(risk_router)
app.include_router(meals_router)
app.include_router(medications_router)
app.include_router(privacy_router)
app.include_router(wellbeing_router)
app.include_router(reports_router)
app.include_router(activity_router)
app.include_router(competition_router)
app.include_router(community_router)
app.include_router(explore_router)
app.include_router(auth_pages_router)
app.include_router(clinic_router)
app.include_router(guest_router)
app.include_router(clinic_public_router)
app.include_router(interop_router)
app.include_router(doctor_portal_router)
app.include_router(ai_router)
app.include_router(huawei_router)
app.include_router(my_doctor_router)
app.include_router(care_plan_doctor_router)
app.include_router(care_plan_patient_router)
app.include_router(care_plan_misc_router)
app.include_router(behavior_support_router)
app.include_router(behavior_doctor_router)

# Doctor website (plain HTML/JS, same origin as the API so no CORS or build step): http://<host>:8000/doctor/
_doctor_site = os.path.join(os.path.dirname(__file__), "static", "doctor")
if os.path.isdir(_doctor_site):
    app.mount("/doctor", StaticFiles(directory=_doctor_site, html=True), name="doctor-site")

@app.get("/")
def read_root():
    return {
        "message": "Welcome to HEWAL3 Health API",
        "docs": "/docs",
        "status": "online",
    }

@app.get("/ping")
def ping():
    """For uptime pingers and the host's health check: answers at once and never touches the database, so it keeps a free server awake without keeping a free database awake."""
    return {"ok": True}


@app.get("/health")
async def health_check():
    try:
        with engine.connect():
            db_status = "connected"
    except Exception as e:
        logger.error(f"Health check DB error: {e}")
        db_status = "disconnected"
    
    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "HEWAL3 API", 
        "database": db_status,
        "database_type": engine.dialect.name,
        "environment": settings.ENVIRONMENT
    }

@app.options("/{full_path:path}", include_in_schema=False)
async def options_handler(full_path: str):
    """Handle preflight requests"""
    return {"status": "ok"}

@app.get("/oauth/callback", response_class=HTMLResponse, include_in_schema=False)
async def oauth_callback_page():
    """HTML page for OAuth callback handling"""
    path = "app/templates/oauth_callback.html"
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>OAuth Callback</h1><p>Processing authentication...</p>")

@app.get("/verify-email/{token}", include_in_schema=False)
async def redirect_verify_email(token: str):
    """Redirect old verification links"""
    return RedirectResponse(url=f"/auth/verify-email-page/{token}")

@app.get("/reset-password", include_in_schema=False)
async def redirect_reset_password(token: str = None):
    """Redirect old reset password links"""
    if token:
        return RedirectResponse(url=f"/auth/reset-password-page?token={token}")
    return RedirectResponse(url="/auth/reset-password-page")

@app.get("/welcome", response_class=HTMLResponse)
async def welcome_page():
    """Welcome page for new users"""
    return """
    <html>
        <head>
            <title>HEWAL3 Health System</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .container { max-width: 800px; margin: 0 auto; }
                .logo { color: #4CAF50; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
                .button { 
                    display: inline-block; 
                    padding: 12px 24px; 
                    margin: 10px;
                    background-color: #4CAF50;
                    color: white; 
                    text-decoration: none; 
                    border-radius: 5px; 
                }
                .api-button { background-color: #2196F3; }
                .section { margin: 40px 0; padding: 20px; background: #f5f5f5; border-radius: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">HEWAL3</div>
                <h1>Health Management System</h1>
                <p>AI-powered health tracking and caregiver coordination</p>
                
                <div class="section">
                    <h2>Get Started</h2>
                    <a href="/docs" class="button api-button">API Documentation</a>
                </div>
                
                <div class="section">
                    <h2>Features</h2>
                    <p>• Health Data Tracking • AI Food Analysis • Emergency Alerts</p>
                    <p>• Caregiver Portal • Doctor Dashboard • Progress Monitoring</p>
                </div>
            </div>
        </body>
    </html>
    """

@app.middleware("http")
async def guest_guard(request, call_next):
    """A guest (reviewer sandbox) may look around and try the app, but never reach a real person, phone or account."""
    auth = request.headers.get("authorization", "")
    if request.method not in ("GET", "HEAD", "OPTIONS") and auth.lower().startswith("bearer "):
        from app.services import guest_sandbox as _sb
        if _sb.blocked(request.method, request.url.path):
            try:
                from jose import jwt as _jwt
                if _jwt.get_unverified_claims(auth[7:]).get("guest"):
                    from fastapi.responses import JSONResponse
                    return JSONResponse({"detail": "This is a demo. That action is turned off for guests."}, status_code=403)
            except Exception:
                pass
    return await call_next(request)
