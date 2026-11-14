"""The wellbeing hub behind the Community tab: weekly challenges, the wellbeing score, the article library and interest groups."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import get_db
from app.models.explore import ArticleRead, ArticleSave, GroupMember
from app.models.user import User
from app.services import library_content as lib
from app.services import participant_service as ps
from app.services import wellbeing_hub as wh

router = APIRouter(prefix="/explore", tags=["explore"])


def _challenge(key: str) -> str:
    if key not in wh.CHALLENGES:
        raise HTTPException(404, "Challenge not found")
    return key


# ------------------------------------------------------------------ challenges
@router.get("/challenges")
def challenges(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return wh.list_challenges(db, user)


@router.get("/challenges/{key}")
def challenge(key: str, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    _challenge(key)
    card = next(c for c in wh.list_challenges(db, user)["items"] if c["key"] == key)
    return {"challenge": card, "board": wh.challenge_board(db, user, key)}


@router.post("/challenges/{key}/join")
def join_challenge(key: str, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    wh.join_challenge(db, user, _challenge(key))
    return wh.list_challenges(db, user)


@router.post("/challenges/{key}/leave")
def leave_challenge(key: str, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    wh.leave_challenge(db, user, _challenge(key))
    return wh.list_challenges(db, user)


# ------------------------------------------------------------------ wellbeing score
@router.get("/score")
def score(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return wh.compute_score(db, user)


# ------------------------------------------------------------------ library
@router.get("/library")
def library(category: Optional[str] = None, q: str = "", db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    read = {r.article_key for r in db.query(ArticleRead).filter_by(user_id=user.id).all()}
    saved = {s.article_key for s in db.query(ArticleSave).filter_by(user_id=user.id).all()}
    needle = q.strip().lower()[:60]
    items = []
    for a in lib.ARTICLES:
        if category and a["category"] != category:
            continue
        if needle and needle not in (a["title"] + " " + a["summary"]).lower():
            continue
        items.append({**lib.listing(a), "read": a["key"] in read, "saved": a["key"] in saved})
    return {"categories": [{"key": k, "label": v} for k, v in lib.CATEGORIES.items()], "items": items, "notice": lib.NOTICE}


@router.get("/library/{key}")
def article(key: str, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    a = lib.by_key(key)
    if not a:
        raise HTTPException(404, "Article not found")
    return {**lib.listing(a), "body": a["body"], "notice": lib.NOTICE,
            "read": db.query(ArticleRead).filter_by(user_id=user.id, article_key=key).first() is not None,
            "saved": db.query(ArticleSave).filter_by(user_id=user.id, article_key=key).first() is not None}


@router.post("/library/{key}/read")
def mark_read(key: str, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if not lib.by_key(key):
        raise HTTPException(404, "Article not found")
    if not db.query(ArticleRead).filter_by(user_id=user.id, article_key=key).first():      # once per article, so reading it again changes nothing
        db.add(ArticleRead(user_id=user.id, article_key=key))
        db.commit()
    return {"read": True}


@router.post("/library/{key}/save")
def toggle_save(key: str, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if not lib.by_key(key):
        raise HTTPException(404, "Article not found")
    row = db.query(ArticleSave).filter_by(user_id=user.id, article_key=key).first()
    if row:
        db.delete(row)
    else:
        db.add(ArticleSave(user_id=user.id, article_key=key))
    db.commit()
    return {"saved": row is None}


# ------------------------------------------------------------------ interest groups
@router.get("/groups")
def groups(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return {"items": wh.list_groups(db, user)}


@router.post("/groups/{key}/join")
def join_group(key: str, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if key not in wh.GROUPS:
        raise HTTPException(404, "Group not found")
    ps.require(db, user)                                   # same rules and display name as the rest of the community
    if not db.query(GroupMember).filter_by(user_id=user.id, group_key=key).first():
        db.add(GroupMember(user_id=user.id, group_key=key))
        db.commit()
    return {"items": wh.list_groups(db, user)}


@router.post("/groups/{key}/leave")
def leave_group(key: str, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    db.query(GroupMember).filter_by(user_id=user.id, group_key=key).delete()
    db.commit()
    return {"items": wh.list_groups(db, user)}
