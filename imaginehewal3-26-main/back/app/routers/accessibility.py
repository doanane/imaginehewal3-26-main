from typing import Any, Dict, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import get_db
from app.models.accessibility import AccessibilityPreference
from app.models.user import User
from app.realtime import hub

router = APIRouter(prefix="/accessibility", tags=["accessibility"])


class AccessibilitySettings(BaseModel):
    fontSize: int = Field(0, ge=-2, le=4)
    contrast: Literal["default", "dark", "high", "yellow", "sepia"] = "default"
    colorBlind: Literal["none", "deuteranopia", "protanopia", "tritanopia"] = "none"
    grayscale: bool = False
    saturation: int = Field(0, ge=0, le=2)
    dimmer: int = Field(0, ge=0, le=3)
    zoom: int = Field(0, ge=-2, le=2)
    hideImages: bool = False
    boldText: bool = False
    underlineLinks: bool = False
    highlightLinks: bool = False
    stopAnimations: bool = False
    readingGuide: bool = False
    keyboardNavigation: bool = False
    screenReader: bool = False
    language: Literal["en", "fr", "ar", "tw", "ee", "ha", "gaa"] = "en"          # the same codes the app offers (front-sdk58/i18n)


class AccessibilityResponse(BaseModel):
    settings: Dict[str, Any]


@router.get("/preferences", response_model=AccessibilityResponse)
def get_accessibility_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    preference = db.query(AccessibilityPreference).filter(
        AccessibilityPreference.user_id == current_user.id
    ).first()
    return {"settings": preference.settings if preference else AccessibilitySettings().model_dump()}


@router.put("/preferences", response_model=AccessibilityResponse)
def update_accessibility_preferences(
    settings: AccessibilitySettings,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    preference = db.query(AccessibilityPreference).filter(
        AccessibilityPreference.user_id == current_user.id
    ).first()
    if preference is None:
        preference = AccessibilityPreference(user_id=current_user.id, settings=settings.model_dump())
        db.add(preference)
    else:
        preference.settings = settings.model_dump()
    db.commit()
    db.refresh(preference)
    # the same account on another phone or tab changes its look at once
    hub.send_from_thread(current_user.id, {"type": "accessibility.update", "settings": preference.settings})
    return {"settings": preference.settings}
