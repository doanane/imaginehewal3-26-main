"""Regional setting: the week, Ramadan, prayer times, heat and emergency numbers. Pure functions, no network, fully tested.

Honesty rules (the app says these things to the person, so they must be true):
  * Ramadan dates come from the tabular Islamic calendar. Real Ramadan starts when the moon is sighted, so this can be one day off.
  * Prayer times are calculated for Abu Dhabi (the UAE authority method uses Fajr 18.2 degrees). They are approximate, within a few minutes,
    and used ONLY to avoid sending a message at prayer time. They are never shown as the official time.
  * Heat is by SEASON, not live weather. It is never presented as a forecast.
"""
import math
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Optional, Tuple

# weekend: Python weekday numbers (Mon=0). The UAE federal weekend is Saturday and Sunday since 2022, with a short Friday.
REGIONS: Dict[str, dict] = {
    "gh": {"label": "Ghana", "utc_offset": 0, "weekend": (5, 6), "short_friday": False, "city": None,
           "emergency": {"all": "112", "ambulance": "193", "police": "191", "fire": "192"}},
    "ae": {"label": "United Arab Emirates", "utc_offset": 4, "weekend": (5, 6), "short_friday": True, "city": (24.4539, 54.3773),   # Abu Dhabi
           "emergency": {"ambulance": "998", "police": "999", "fire": "997"}},
}
DEFAULT_REGION = "gh"
CHOICES = tuple(REGIONS)


def region_info(region: Optional[str]) -> dict:
    return REGIONS.get(region or DEFAULT_REGION, REGIONS[DEFAULT_REGION])


def emergency_numbers(region: Optional[str]) -> dict:
    return dict(region_info(region)["emergency"])


def local_now(now: datetime, region: Optional[str]) -> datetime:
    """The person's wall-clock time in their region (fixed offsets: neither Ghana nor the UAE uses daylight saving)."""
    now = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
    return now.astimezone(timezone(timedelta(hours=region_info(region)["utc_offset"])))


def day_kind(d: date, region: Optional[str]) -> str:
    """weekend | short_friday | workday"""
    info = region_info(region)
    if d.weekday() in info["weekend"]:
        return "weekend"
    if info["short_friday"] and d.weekday() == 4:
        return "short_friday"
    return "workday"


# ---------- Islamic calendar (tabular, +-1 day) ----------
def hijri(d: date) -> Tuple[int, int, int]:
    """(year, month, day) in the tabular Islamic calendar."""
    jd = d.toordinal() + 1721425
    l = jd - 1948440 + 10632
    n = (l - 1) // 10631
    l = l - 10631 * n + 354
    j = ((10985 - l) // 5316) * ((50 * l) // 17719) + (l // 5670) * ((43 * l) // 15238)
    l = l - ((30 - j) // 15) * ((17719 * j) // 50) - (j // 16) * ((15238 * j) // 43) + 29
    m = (24 * l) // 709
    return 30 * n + j - 30, m, l - (709 * m) // 24


def ramadan(d: date) -> dict:
    y, m, day = hijri(d)
    return {"is_ramadan": m == 9, "day": day if m == 9 else None, "hijri_year": y,
            "last_ten_nights": m == 9 and day >= 21, "approximate": True}


# ---------- prayer times (approximate) ----------
def _sun(d: date) -> Tuple[float, float]:
    """(declination in degrees, equation of time in hours), standard low-precision solar formulas."""
    n = d.timetuple().tm_yday
    g = math.radians((357.529 + 0.98560028 * (n - 1)) % 360)
    q = (280.459 + 0.98564736 * (n - 1)) % 360
    L = math.radians((q + 1.915 * math.sin(g) + 0.020 * math.sin(2 * g)) % 360)
    e = math.radians(23.439 - 0.00000036 * (n - 1))
    dec = math.degrees(math.asin(math.sin(e) * math.sin(L)))
    ra = math.degrees(math.atan2(math.cos(e) * math.sin(L), math.cos(L))) / 15.0
    eqt = q / 15.0 - ((ra + 24) % 24)
    if eqt > 12:
        eqt -= 24
    if eqt < -12:
        eqt += 24
    return dec, eqt


def _hour_angle(lat: float, dec: float, angle_deg: float) -> Optional[float]:
    lat_r, dec_r = math.radians(lat), math.radians(dec)
    c = (math.sin(math.radians(angle_deg)) - math.sin(lat_r) * math.sin(dec_r)) / (math.cos(lat_r) * math.cos(dec_r))
    return None if abs(c) > 1 else math.degrees(math.acos(c)) / 15.0


def prayer_times(d: date, region: Optional[str]) -> Optional[Dict[str, float]]:
    """Local clock hours (e.g. 5.25 = 05:15) for fajr, sunrise, dhuhr, asr, maghrib, isha. None where we have no city for the region."""
    info = region_info(region)
    if not info["city"]:
        return None
    lat, lng = info["city"]
    dec, eqt = _sun(d)
    noon = 12 + info["utc_offset"] - lng / 15.0 - eqt
    out = {"dhuhr": noon + 2 / 60.0}                                  # a small safety margin after the sun passes the middle of the sky
    for name, angle, sign in (("fajr", -18.2, -1), ("sunrise", -0.833, -1), ("maghrib", -0.833, 1)):
        h = _hour_angle(lat, dec, angle)
        if h is None:
            return None
        out[name] = noon + sign * h
    asr_angle = math.degrees(math.atan(1.0 / (1.0 + math.tan(math.radians(abs(lat - dec))))))   # shadow length = object length + noon shadow
    h = _hour_angle(lat, dec, asr_angle)
    out["asr"] = noon + h if h is not None else noon + 3.5
    out["isha"] = out["maghrib"] + 1.5                               # UAE: 90 minutes after sunset
    return out


def hhmm(h: float) -> str:
    m = int(round(h * 60))
    return f"{(m // 60) % 24:02d}:{m % 60:02d}"


def in_prayer_window(local: datetime, region: Optional[str], minutes: int = 20) -> Optional[str]:
    """The prayer whose time is within `minutes` either side of now, or None. Friday midday is the congregational prayer: a longer window."""
    pt = prayer_times(local.date(), region)
    if not pt:
        return None
    now_h = local.hour + local.minute / 60.0
    for name in ("fajr", "dhuhr", "asr", "maghrib", "isha"):
        span = minutes / 60.0
        if name == "dhuhr" and local.weekday() == 4:
            span = 1.0
        if abs(now_h - pt[name]) <= span:
            return name
    return None


def nudge_gate(now: datetime, region: Optional[str], respect_prayer: bool = True, quiet_start: int = 21) -> Optional[str]:
    """Why a message should NOT be sent right now for regional reasons, or None when it is fine. Never blocks in a region without rules."""
    if region_info(region)["city"] is None or not respect_prayer:
        return None
    local = local_now(now, region)
    p = in_prayer_window(local, region)
    if p:
        return f"prayer time ({p})"
    if ramadan(local.date())["is_ramadan"]:
        pt = prayer_times(local.date(), region)
        h = local.hour + local.minute / 60.0
        if pt and pt["fajr"] <= h < pt["maghrib"] + 0.5:
            return "Ramadan fasting hours: we message after iftar"
    return None


# ---------- heat ----------
def heat_level(d: date, region: Optional[str]) -> str:
    """extreme | hot | mild, by season only. Gulf summer: June to September is extreme, May and October hot."""
    if region_info(region)["city"] is None:
        return "mild"
    return "extreme" if d.month in (6, 7, 8, 9) else "hot" if d.month in (5, 10) else "mild"


def movement_window(d: date, region: Optional[str]) -> Optional[str]:
    """A plain description of the safest time for outdoor movement, or None when nothing special applies."""
    h = heat_level(d, region)
    if ramadan(d)["is_ramadan"] and region_info(region)["city"]:
        return "after_iftar"
    return {"extreme": "indoors_or_night", "hot": "early_or_evening"}.get(h)


def context(now: datetime, region: Optional[str]) -> dict:
    """Everything the screens and the engine need to know about today, in one call."""
    local = local_now(now, region)
    d = local.date()
    pt = prayer_times(d, region)
    return {"region": region if region in REGIONS else DEFAULT_REGION, "label": region_info(region)["label"], "date": d.isoformat(),
            "day_kind": day_kind(d, region), "ramadan": ramadan(d), "heat": heat_level(d, region), "movement_window": movement_window(d, region),
            "prayer_times": {k: hhmm(v) for k, v in pt.items()} if pt else None,
            "emergency": emergency_numbers(region),
            "notes": {"ramadan": "Estimated from the Islamic calendar; the real start depends on the moon and can differ by a day.",
                      "prayer": "Calculated for Abu Dhabi, approximate. Used only to avoid messaging you at prayer time.",
                      "heat": "By season, not live weather."}}
