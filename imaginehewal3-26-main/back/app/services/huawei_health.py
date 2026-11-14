"""HUAWEI Health, connected directly through Huawei's Health Kit cloud (REST) API.

How it works (this is Huawei's documented "cloud" flow, the only one that works for an iPhone app):
  1. The person taps Connect in HEWAL3. We send them to Huawei's sign-in page with our app's client id and the scopes we need.
  2. They sign in with their HUAWEI ID and approve. Huawei redirects to OUR server (/huawei/callback) with a one-time code.
  3. We exchange the code for an access token and a refresh token and keep both, encrypted, linked to that one person.
  4. We ask Huawei's Health Kit for today's steps, distance and calories and the latest heart rate, blood pressure and oxygen, and feed
     them through the same ingestion path as every other device, so alerts, caregivers and doctors see them identically.

What must exist before any of this can work (none of it can be done in code): a HUAWEI Developer account, an app with the HUAWEI ID
service and Health Kit enabled in AppGallery Connect, the redirect URL registered there, and the Health Kit scopes granted by Huawei.
See docs/HUAWEI_HEALTH_SETUP.md. Until then `configured()` is False and the app says so plainly.

The scope names and data type names below follow Huawei's documentation but are kept in one place, and overridable with environment
variables, because Huawei is the authority on them. Every failure from Huawei is kept (without secrets) and shown to the person, so a
wrong name is found in one attempt instead of silently returning nothing.
"""
import logging
import os
import secrets
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote, urlencode

import requests
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.models.huawei import HuaweiLink
from app.services.secret_box import seal, unseal

logger = logging.getLogger(__name__)

AUTH_URL = os.getenv("HUAWEI_AUTH_URL", "https://oauth-login.cloud.huawei.com/oauth2/v3/authorize")
TOKEN_URL = os.getenv("HUAWEI_TOKEN_URL", "https://oauth-login.cloud.huawei.com/oauth2/v3/token")
API_BASE = os.getenv("HUAWEI_API_BASE", "https://health-api.cloud.huawei.com/healthkit/v1").rstrip("/")
SCOPE_PREFIX = "https://www.huawei.com/healthkit/"
DEFAULT_SCOPES = [SCOPE_PREFIX + s for s in ("step.read", "distance.read", "calories.read", "heartrate.read", "bloodpressure.read", "oxygensaturation.read")]

# Huawei data type names (Health Kit "atomic data types")
T_STEPS = os.getenv("HUAWEI_TYPE_STEPS", "com.huawei.continuous.steps.delta")
T_DISTANCE = os.getenv("HUAWEI_TYPE_DISTANCE", "com.huawei.continuous.distance.delta")
T_CALORIES = os.getenv("HUAWEI_TYPE_CALORIES", "com.huawei.continuous.calories.burnt")
T_HR = os.getenv("HUAWEI_TYPE_HR", "com.huawei.instantaneous.heart_rate")
T_BP = os.getenv("HUAWEI_TYPE_BP", "com.huawei.instantaneous.blood_pressure")
T_SPO2 = os.getenv("HUAWEI_TYPE_SPO2", "com.huawei.instantaneous.spo2")

SOURCE_LABEL = "HUAWEI Health (direct)"
TIMEOUT = 20


class HuaweiError(Exception):
    def __init__(self, message: str, status: Optional[int] = None):
        super().__init__(message)
        self.message, self.status = message, status


class HuaweiAuthError(HuaweiError):
    """The token is no longer accepted: the person has to connect again."""


# ------------------------------------------------------------------ configuration
def client_id() -> str:
    return os.getenv("HUAWEI_CLIENT_ID", "").strip()


def client_secret() -> str:
    return os.getenv("HUAWEI_CLIENT_SECRET", "").strip()


def configured() -> bool:
    return bool(client_id() and client_secret())


def redirect_uri() -> str:
    return os.getenv("HUAWEI_REDIRECT_URI", "").strip() or settings.BASE_URL.rstrip("/") + "/huawei/callback"


def scopes() -> List[str]:
    raw = os.getenv("HUAWEI_SCOPES", "").split()
    return raw or DEFAULT_SCOPES


# ------------------------------------------------------------------ sign-in
STATE_MINUTES = 10


def make_state(user_id: int) -> str:
    """Ties the sign-in to the person who started it and stops anyone else's link being attached to an account (CSRF)."""
    exp = datetime.now(timezone.utc) + timedelta(minutes=STATE_MINUTES)
    return jwt.encode({"sub": str(user_id), "purpose": "huawei-link", "n": secrets.token_urlsafe(8), "exp": exp}, settings.SECRET_KEY, algorithm="HS256")


def read_state(state: str) -> int:
    try:
        data = jwt.decode(state, settings.SECRET_KEY, algorithms=["HS256"])
        if data.get("purpose") != "huawei-link":
            raise ValueError("wrong purpose")
        return int(data["sub"])
    except (JWTError, ValueError, KeyError):
        raise HuaweiError("This sign-in link has expired or is not valid. Start again from HEWAL3.")


def authorize_url(user_id: int) -> str:
    if not configured():
        raise HuaweiError("HUAWEI Health is not set up on this server yet.")
    q = {"response_type": "code", "access_type": "offline", "client_id": client_id(), "redirect_uri": redirect_uri(),
         "scope": " ".join(scopes()), "state": make_state(user_id)}
    return AUTH_URL + "?" + urlencode(q, quote_via=quote)


def _oauth(form: Dict[str, str]) -> Dict[str, Any]:
    try:
        r = requests.post(TOKEN_URL, data=form, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise HuaweiError(f"Could not reach HUAWEI ({type(e).__name__}).")
    try:
        body = r.json()
    except ValueError:
        body = {}
    if r.status_code >= 400 or "access_token" not in body:
        reason = body.get("error_description") or body.get("error") or f"HTTP {r.status_code}"
        logger.warning("Huawei token request failed: %s", reason)
        raise HuaweiAuthError(f"HUAWEI refused the sign-in: {reason}", r.status_code)
    return body


def exchange_code(code: str) -> Dict[str, Any]:
    return _oauth({"grant_type": "authorization_code", "code": code, "client_id": client_id(), "client_secret": client_secret(), "redirect_uri": redirect_uri()})


def _store(link: HuaweiLink, tok: Dict[str, Any]) -> None:
    link.access_token_enc = seal(tok["access_token"])
    if tok.get("refresh_token"):
        link.refresh_token_enc = seal(tok["refresh_token"])
    link.expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(tok.get("expires_in") or 3600))
    link.scopes = tok.get("scope") or link.scopes


def save_link(db: Session, user_id: int, tok: Dict[str, Any]) -> HuaweiLink:
    link = db.query(HuaweiLink).filter_by(user_id=user_id).first()
    if not link:
        link = HuaweiLink(user_id=user_id, access_token_enc="")
        db.add(link)
    _store(link, tok)
    link.last_error = None
    db.commit()
    db.refresh(link)
    return link


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    return None if dt is None else (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc))


def valid_token(db: Session, link: HuaweiLink) -> str:
    """The access token, refreshed first if it has expired or is about to."""
    exp = _aware(link.expires_at)
    if exp is None or exp - timedelta(seconds=60) <= datetime.now(timezone.utc):
        if not link.refresh_token_enc:
            raise HuaweiAuthError("The HUAWEI sign-in has expired. Connect again.")
        try:
            tok = _oauth({"grant_type": "refresh_token", "refresh_token": unseal(link.refresh_token_enc), "client_id": client_id(), "client_secret": client_secret()})
        except HuaweiAuthError:
            link.last_error = "The HUAWEI sign-in has expired. Connect again."
            db.commit()
            raise
        _store(link, tok)
        db.commit()
    return unseal(link.access_token_enc)


# ------------------------------------------------------------------ reading data
def _headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "x-client-id": client_id(), "Content-Type": "application/json"}


def _call(method: str, path: str, token: str, **kw) -> Dict[str, Any]:
    try:
        r = requests.request(method, API_BASE + path, headers=_headers(token), timeout=TIMEOUT, **kw)
    except requests.RequestException as e:
        raise HuaweiError(f"Could not reach HUAWEI Health ({type(e).__name__}).")
    try:
        body = r.json() if r.content else {}
    except ValueError:
        body = {}
    if r.status_code == 401:
        raise HuaweiAuthError("HUAWEI no longer accepts this sign-in. Connect again.", 401)
    if r.status_code >= 400:
        msg = (body.get("error") or {}).get("message") if isinstance(body.get("error"), dict) else None
        msg = msg or body.get("message") or body.get("error_description") or body.get("error") or f"HTTP {r.status_code}"
        logger.warning("Huawei Health %s %s -> %s: %s", method, path.split("?")[0], r.status_code, str(msg)[:160])
        raise HuaweiError(str(msg)[:200], r.status_code)
    return body


def _to_dt(t: Any) -> Optional[datetime]:
    """Huawei reports times in different units depending on the call (seconds, milliseconds or nanoseconds); this accepts any."""
    try:
        x = float(t)
    except (TypeError, ValueError):
        return None
    if x > 1e17:
        x /= 1e9
    elif x > 1e11:
        x /= 1e3
    return datetime.fromtimestamp(x, tz=timezone.utc) if x > 0 else None


def _points(obj: Any) -> List[dict]:
    """Every sample point anywhere in a response: any dict that carries a list called 'value'."""
    out: List[dict] = []
    if isinstance(obj, dict):
        if isinstance(obj.get("value"), list):
            out.append(obj)
        for v in obj.values():
            if isinstance(v, (dict, list)):
                out.extend(_points(v))
    elif isinstance(obj, list):
        for v in obj:
            out.extend(_points(v))
    return out


def _numbers(point: dict) -> Dict[str, float]:
    nums: Dict[str, float] = {}
    for v in point.get("value") or []:
        for key in ("floatValue", "integerValue", "longValue", "doubleValue"):
            if isinstance(v, dict) and v.get(key) is not None:
                try:
                    nums[str(v.get("fieldName") or f"f{len(nums)}")] = float(v[key])
                except (TypeError, ValueError):
                    pass
                break
    return nums


def _field(nums: Dict[str, float], *hints: str) -> Optional[float]:
    for h in hints:
        for k, v in nums.items():
            if h in k.lower():
                return v
    return next(iter(nums.values()), None) if len(nums) == 1 else None


def day_total(token: str, data_type: str, start_ms: int, end_ms: int, *hints: str) -> Optional[float]:
    body = {"polymerizeWith": [{"dataTypeName": data_type}], "startTime": start_ms, "endTime": end_ms}
    pts = _points(_call("POST", "/sampleSet:polymerize", token, json=body))
    vals = [v for v in (_field(_numbers(p), *hints) for p in pts) if v is not None]
    return sum(vals) if vals else None


def latest(token: str, data_type: str) -> Optional[Tuple[Dict[str, float], datetime]]:
    pts = _points(_call("GET", f"/sampleSets/latestSamplePoint?dataType={quote(data_type)}", token))
    best: Optional[Tuple[Dict[str, float], datetime]] = None
    for p in pts:
        at = _to_dt(p.get("endTime") or p.get("startTime") or p.get("samplingTime"))
        nums = _numbers(p)
        if nums and at and (best is None or at > best[1]):
            best = (nums, at)
    return best


def fetch_today(token: str, now: Optional[datetime] = None) -> Dict[str, Any]:
    """What Huawei holds for today. Each item is read on its own: a metric the scopes do not allow is reported, never fatal."""
    now = now or datetime.now(timezone.utc)
    midnight = datetime.combine(datetime.now().date(), datetime.min.time()).astimezone(timezone.utc)
    s_ms, e_ms = int(midnight.timestamp() * 1000), int(now.timestamp() * 1000)
    out: Dict[str, Any] = {"errors": []}

    def run(name, fn):
        try:
            return name, fn(), None
        except HuaweiAuthError:
            raise
        except HuaweiError as e:
            return name, None, e.message

    jobs = [("steps", lambda: day_total(token, T_STEPS, s_ms, e_ms, "step")),
            ("distance", lambda: day_total(token, T_DISTANCE, s_ms, e_ms, "distance")),
            ("calories", lambda: day_total(token, T_CALORIES, s_ms, e_ms, "calor")),
            ("hr", lambda: latest(token, T_HR)), ("bp", lambda: latest(token, T_BP)), ("spo2", lambda: latest(token, T_SPO2))]
    with ThreadPoolExecutor(max_workers=6) as ex:
        results = [f.result() for f in [ex.submit(run, n, f) for n, f in jobs]]
    for name, value, err in results:
        if err:
            out["errors"].append(f"{name}: {err}")
        out[name] = value
    return out


# ------------------------------------------------------------------ into the same pipeline as every other device
def ingest_today(db: Session, user, data: Dict[str, Any]) -> Dict[str, Any]:
    """Feeds what Huawei returned through the normal ingestion (alerts, caregivers, doctors, realtime, day totals that only grow)."""
    from pydantic import ValidationError
    from app.routers.live_vitals import VitalIn, ingest

    sent: Dict[str, Any] = {}

    def push(label: str, **fields) -> None:
        try:
            ingest(VitalIn(device_id="huawei-health", device_name="HUAWEI Health", **fields), db, user)
            sent[label] = True
        except (ValidationError, Exception) as e:  # one bad value must not stop the others
            db.rollback()
            if getattr(e, "status_code", None) == 400:
                return
            logger.warning("Huawei value for %s was not accepted: %s", label, type(e).__name__)

    totals: Dict[str, Any] = {}
    if data.get("steps") is not None:
        totals["steps"] = max(0, int(round(data["steps"])))
        totals["steps_source"] = SOURCE_LABEL
    if data.get("calories") is not None:
        totals["calories"] = max(0, int(round(data["calories"])))
    if data.get("distance") is not None:
        totals["distance_m"] = max(0, int(round(data["distance"])))
    if totals:
        push("totals", **totals)
    if data.get("hr"):
        nums, at = data["hr"]
        v = _field(nums, "bpm", "heart")
        if v:
            push("heart_rate", heart_rate=int(round(v)), measured_at=at)
    if data.get("bp"):
        nums, at = data["bp"]
        sys_, dia = _field(nums, "systolic"), _field(nums, "diastolic")
        if sys_ and dia:
            push("blood_pressure", blood_pressure_systolic=int(round(sys_)), blood_pressure_diastolic=int(round(dia)), measured_at=at)
    if data.get("spo2"):
        nums, at = data["spo2"]
        v = _field(nums, "satur", "spo2", "oxygen")
        if v:
            push("blood_oxygen", blood_oxygen=round(v * 100 if v <= 1.0 else v, 1), measured_at=at)
    return sent


def sync_user(db: Session, user, link: HuaweiLink) -> Dict[str, Any]:
    """Pull and store now. Returns what was found and anything Huawei refused, so the screen can say exactly what happened."""
    try:
        token = valid_token(db, link)
        data = fetch_today(token)
    except HuaweiAuthError as e:
        link.last_error = e.message
        db.commit()
        raise
    stored = ingest_today(db, user, data)
    link.last_sync_at = datetime.now(timezone.utc)
    link.last_error = ("; ".join(data["errors"])[:240]) if data["errors"] else None
    db.commit()
    return {"steps": data.get("steps"), "distance_m": data.get("distance"), "calories": data.get("calories"),
            "heart_rate": data["hr"][0] if data.get("hr") else None, "blood_pressure": data["bp"][0] if data.get("bp") else None,
            "oxygen": data["spo2"][0] if data.get("spo2") else None, "errors": data["errors"], "stored": sorted(stored)}


def best_effort_revoke(link: HuaweiLink) -> None:
    """Asks Huawei to drop the consent. Failure is fine: the tokens are deleted on our side regardless, and the person can also
    remove HEWAL3's access in the HUAWEI Health app."""
    try:
        token = unseal(link.access_token_enc)
        requests.delete(f"{API_BASE.replace('/v1', '/v2')}/consents/{client_id()}", headers=_headers(token), timeout=8)
    except Exception:
        pass
