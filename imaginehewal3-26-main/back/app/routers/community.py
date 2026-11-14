"""Community: discussions, tips and a health-only marketplace, with images, comments, likes and reporting.

Safety by design: members have a display name (never an email), the marketplace allows only health and fitness items
(medicines, alcohol, tobacco and anything illegal are refused), posts and comments are rate limited, any member can report,
and three reports from different people hide a post until it is reviewed.
"""
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import get_db
from app.models.activity import CommunityPost, Participant, PostComment, PostLike, PostReport
from app.models.community_review import CommunityReview
from app.models.user import User
from app.realtime import hub
from app.services import assistant_service, participant_service as ps, simple_limiter
from app.services.storage_service import storage_service

from app.services.image_check import EXT, sniff_image
router = APIRouter(prefix="/community", tags=["community"])

CATEGORIES = ("discussion", "tip", "marketplace")
PRODUCT_CATEGORIES = ["Smart watch or band", "Blood pressure monitor", "Glucose meter and strips", "Weighing scale", "Fitness gear",
                      "Healthy food and ingredients", "Books and guides", "Mobility and support aids", "Other health device"]
REPORT_REASONS = ("spam", "unsafe_advice", "selling_medicine", "harassment", "other")
HIDE_AFTER_REPORTS = 3
MAX_IMAGE = 5 * 1024 * 1024
MAX_IMAGES_SELLING = 5                     # a listing can show up to five pictures; any other post, one
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
BLOCKED_SALE = re.compile(r"\b(tramadol|codeine|morphine|diazepam|viagra|sildenafil|antibiotics?|amoxicillin|ciprofloxacin|insulin|prescription|pills?|capsules?|syrup|injection|"
                          r"herbal cure|miracle cure|cure for|alcohol|whisky|vodka|cigarettes?|tobacco|cannabis|weed|guns?|weapons?)\b", re.I)
SELLING_TALK = re.compile(r"(for sale|selling|sell my|\bGHS\s?\d|GH₵\s?\d|\bcedis?\b)", re.I)
URLS = re.compile(r"https?://|www\.", re.I)
DISCLAIMER = "Advice here is from other members, not from clinicians. Talk to your clinician before changing treatment."
CRISIS_NOTICE = "If you are in danger or thinking about harming yourself, please call your emergency number now (112 in Ghana, 998 in the UAE) or tell someone you trust."


class JoinIn(BaseModel):
    display_name: Optional[str] = Field(None, max_length=24)
    accept_rules: bool = False


class CommentIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=800)


class ReportIn(BaseModel):
    reason: str


class ReviewIn(BaseModel):
    title: str = Field(..., min_length=2, max_length=80)
    body: str = Field(..., min_length=10, max_length=800)
    rating: int = Field(5, ge=1, le=5)


def _me(db: Session, user: User) -> dict:
    p = ps.get(db, user)
    return {"joined": bool(p), "display_name": p.display_name if p else None, "suggested_name": ps.suggest_name(user), "rules": ps.RULES,
            "product_categories": PRODUCT_CATEGORIES, "disclaimer": DISCLAIMER}


@router.get("/me")
def me(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return _me(db, user)


@router.post("/join")
def join(body: JoinIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if not body.accept_rules:
        raise HTTPException(400, "Please accept the community rules to join")
    ps.join(db, user, body.display_name)
    return _me(db, user)


def _review_dict(db: Session, row: CommunityReview, me_id: int, names: dict) -> dict:
    return {"id": row.id, "title": row.title, "body": row.body, "rating": row.rating, "author": _name(db, row.user_id, names), "mine": row.user_id == me_id,
            "created_at": row.created_at.isoformat() if row.created_at else None, "edited": bool(row.updated_at)}


def _check_review(body: ReviewIn) -> None:
    text = f"{body.title} {body.body}"
    if URLS.search(text):
        raise HTTPException(422, "Reviews cannot contain links")
    if SELLING_TALK.search(text):
        raise HTTPException(422, "Reviews are for sharing your experience of the app, not for selling")


@router.get("/reviews")
def reviews(limit: int = 20, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Reviews written by members of the app. The average and the spread count every approved review, not only the ones shown."""
    limit = max(1, min(limit, 50))
    base = db.query(CommunityReview).filter(CommunityReview.approved.is_(True))
    dist = {r: n for r, n in db.query(CommunityReview.rating, func.count(CommunityReview.id)).filter(CommunityReview.approved.is_(True)).group_by(CommunityReview.rating).all()}
    count = sum(dist.values())
    rows = base.order_by(CommunityReview.created_at.desc()).limit(limit).all()
    mine = db.query(CommunityReview).filter_by(user_id=user.id).first()
    names: dict = {}
    return {"items": [_review_dict(db, r, user.id, names) for r in rows], "count": count,
            "average": round(sum(k * v for k, v in dist.items()) / count, 1) if count else None,
            "distribution": {str(k): int(dist.get(k, 0)) for k in (5, 4, 3, 2, 1)},
            "mine": _review_dict(db, mine, user.id, names) if mine else None}


@router.post("/reviews")
def create_review(body: ReviewIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """One review per member. Writing again edits it, so one person cannot raise or lower the average by posting many times."""
    from datetime import datetime, timezone
    ps.require(db, user)
    _check_review(body)
    row = db.query(CommunityReview).filter_by(user_id=user.id).first()
    if row:
        row.title, row.body, row.rating, row.updated_at = body.title.strip(), body.body.strip(), body.rating, datetime.now(timezone.utc)
    else:
        row = CommunityReview(user_id=user.id, title=body.title.strip(), body=body.body.strip(), rating=body.rating)
        db.add(row)
    db.commit()
    db.refresh(row)
    return _review_dict(db, row, user.id, {})


@router.delete("/reviews/mine")
def delete_review(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    db.query(CommunityReview).filter_by(user_id=user.id).delete()
    db.commit()
    return {"deleted": True}


def _name(db: Session, uid: int, cache: dict) -> str:
    if uid not in cache:
        p = db.query(Participant).filter_by(user_id=uid).first()
        cache[uid] = p.display_name if p else "Former member"
    return cache[uid]


def _post_dict(db: Session, p: CommunityPost, me_id: int, counts: dict, liked: set, names: dict) -> dict:
    likes, comments = counts.get(p.id, (0, 0))
    return {"id": p.id, "category": p.category, "title": p.title, "body": p.body, "image_url": p.image_url, "image_urls": p.image_urls or ([p.image_url] if p.image_url else []),
            "product_category": p.product_category, "price": p.price, "currency": p.currency, "contact_phone": p.contact_phone,
            "author": _name(db, p.user_id, names), "mine": p.user_id == me_id, "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None, "likes": likes, "comments": comments, "liked": p.id in liked}


def _counts(db: Session, ids: List[int]) -> dict:
    if not ids:
        return {}
    likes = dict(db.query(PostLike.post_id, func.count(PostLike.id)).filter(PostLike.post_id.in_(ids)).group_by(PostLike.post_id).all())
    comments = dict(db.query(PostComment.post_id, func.count(PostComment.id)).filter(PostComment.post_id.in_(ids)).group_by(PostComment.post_id).all())
    return {i: (likes.get(i, 0), comments.get(i, 0)) for i in ids}


@router.get("/posts")
def feed(category: Optional[str] = None, group: Optional[str] = None, before_id: Optional[int] = None, limit: int = 20, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    limit = max(1, min(limit, 50))
    q = db.query(CommunityPost).filter((CommunityPost.status == "visible") | ((CommunityPost.user_id == user.id) & (CommunityPost.status == "hidden")))
    if category in CATEGORIES:
        q = q.filter(CommunityPost.category == category)
    q = q.filter(CommunityPost.group_key == group) if group else q.filter(CommunityPost.group_key.is_(None))      # the general feed never mixes in group posts
    if before_id:
        q = q.filter(CommunityPost.id < before_id)
    rows = q.order_by(CommunityPost.id.desc()).limit(limit + 1).all()
    more = len(rows) > limit
    rows = rows[:limit]
    ids = [r.id for r in rows]
    liked = {x.post_id for x in db.query(PostLike).filter(PostLike.user_id == user.id, PostLike.post_id.in_(ids)).all()} if ids else set()
    counts, names = _counts(db, ids), {}
    return {"items": [_post_dict(db, r, user.id, counts, liked, names) for r in rows], "next_before_id": rows[-1].id if more and rows else None,
            "disclaimer": DISCLAIMER}


@router.post("/posts")
async def create_post(category: str = Form(...), body: str = Form(...), title: Optional[str] = Form(None), product_category: Optional[str] = Form(None), group_key: Optional[str] = Form(None),
                      price: Optional[float] = Form(None), contact_phone: Optional[str] = Form(None), file: Optional[UploadFile] = File(None), files: Optional[List[UploadFile]] = File(None),
                      db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    ps.require(db, user)
    if group_key:
        from app.models.explore import GroupMember
        from app.services.wellbeing_hub import GROUPS
        if group_key not in GROUPS or not db.query(GroupMember).filter_by(user_id=user.id, group_key=group_key).first():
            raise HTTPException(403, "Join this group to post in it")
        if category == "marketplace":
            raise HTTPException(422, "The marketplace is not part of interest groups")
    simple_limiter.check(f"post:{user.id}", 5, 3600, "You can post 5 times an hour. Please try again later.")
    body, title = body.strip(), (title or "").strip() or None
    if category not in CATEGORIES:
        raise HTTPException(422, "Category must be discussion, tip or marketplace")
    if not (1 <= len(body) <= 2000) or (title and len(title) > 120):
        raise HTTPException(422, "Write between 1 and 2000 characters (title up to 120)")
    text = f"{title or ''} {body}"
    if len(URLS.findall(text)) > 1:
        raise HTTPException(422, "Please include at most one link")
    if category == "marketplace":
        if product_category not in PRODUCT_CATEGORIES:
            raise HTTPException(422, "Choose a health or fitness product category")
        if price is None or price < 0 or price > 100000:
            raise HTTPException(422, "Enter a price between 0 and 100,000")
        if BLOCKED_SALE.search(text):
            raise HTTPException(422, "Medicines, alcohol, tobacco and other restricted items cannot be sold here")
        phone = None
        if contact_phone:
            digits = re.sub(r"[^\d+]", "", contact_phone)
            if not re.fullmatch(r"\+?\d{8,15}", digits):
                raise HTTPException(422, "Enter a valid phone number or leave it empty")
            phone = digits
    else:
        phone, price, product_category = None, None, None
        if SELLING_TALK.search(text):
            raise HTTPException(422, "To sell something, post it in the Marketplace")
    pictures = ([file] if file is not None else []) + [f for f in (files or []) if f is not None and f.filename]
    limit = MAX_IMAGES_SELLING if category == "marketplace" else 1
    if len(pictures) > limit:
        raise HTTPException(422, f"You can add up to {MAX_IMAGES_SELLING} photos to something you sell" if category == "marketplace" else "A post can have one photo. To show more, post it as a listing in the Marketplace")
    urls = []
    for pic in pictures:
        data = await pic.read(MAX_IMAGE + 1)
        if len(data) > MAX_IMAGE:
            raise HTTPException(400, "A photo is too large (5 MB maximum)")
        kind = sniff_image(data)                       # judged by the file itself, not by the label the phone put on it
        if kind not in IMAGE_TYPES:
            raise HTTPException(400, "Please attach JPEG, PNG or WebP images")
        pic.filename = f"post.{EXT[kind]}"
        await pic.seek(0)
        urls.append(await storage_service.upload_file(pic, folder="community"))
    image_url = urls[0] if urls else None
    post = CommunityPost(user_id=user.id, category=category, title=title, body=body, image_url=image_url, image_urls=urls or None, product_category=product_category,
                         price=price, contact_phone=phone, group_key=group_key or None)
    db.add(post)
    db.commit()
    db.refresh(post)
    simple_limiter.record(f"post:{user.id}")
    await hub.broadcast({"type": "community.new", "post_id": post.id, "category": category})
    out = _post_dict(db, post, user.id, {}, set(), {})
    if category != "marketplace" and assistant_service.is_emergency(text):
        out["support_notice"] = CRISIS_NOTICE                  # shown to the author, never blocks the post
    return out


def _visible_post(db: Session, user: User, post_id: int) -> CommunityPost:
    p = db.query(CommunityPost).filter_by(id=post_id).first()
    if not p or p.status == "removed" or (p.status == "hidden" and p.user_id != user.id):
        raise HTTPException(404, "Post not found")
    return p


@router.get("/posts/{post_id}")
def detail(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    p = _visible_post(db, user, post_id)
    names: dict = {}
    liked = {x.post_id for x in db.query(PostLike).filter_by(post_id=p.id, user_id=user.id).all()}
    out = _post_dict(db, p, user.id, _counts(db, [p.id]), liked, names)
    cs = db.query(PostComment).filter_by(post_id=p.id).order_by(PostComment.id.asc()).limit(300).all()
    out["comment_list"] = [{"id": c.id, "body": c.body, "author": _name(db, c.user_id, names), "mine": c.user_id == user.id,
                            "created_at": c.created_at.isoformat() if c.created_at else None} for c in cs]
    return out


@router.post("/posts/{post_id}/comments")
def comment(post_id: int, body: CommentIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    ps.require(db, user)
    p = _visible_post(db, user, post_id)
    simple_limiter.check(f"comment:{user.id}", 30, 3600, "You are commenting very quickly. Please slow down.")
    text = body.body.strip()
    if not text:
        raise HTTPException(422, "Write a comment")
    if len(URLS.findall(text)) > 1:
        raise HTTPException(422, "Please include at most one link")
    c = PostComment(post_id=p.id, user_id=user.id, body=text)
    db.add(c)
    db.commit()
    db.refresh(c)
    simple_limiter.record(f"comment:{user.id}")
    out = {"id": c.id, "body": c.body, "author": _name(db, user.id, {}), "mine": True, "created_at": c.created_at.isoformat() if c.created_at else None}
    if assistant_service.is_emergency(text):
        out["support_notice"] = CRISIS_NOTICE
    return out


@router.post("/posts/{post_id}/like")
def like(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    ps.require(db, user)
    p = _visible_post(db, user, post_id)
    existing = db.query(PostLike).filter_by(post_id=p.id, user_id=user.id).first()
    if existing:
        db.delete(existing)
    else:
        db.add(PostLike(post_id=p.id, user_id=user.id))
    db.commit()
    return {"liked": not existing, "likes": db.query(func.count(PostLike.id)).filter_by(post_id=p.id).scalar()}


@router.delete("/posts/{post_id}")
def delete_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    p = db.query(CommunityPost).filter_by(id=post_id, user_id=user.id).first()
    if not p or p.status == "removed":
        raise HTTPException(404, "Post not found")
    p.status = "removed"
    db.commit()
    return {"deleted": True}


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    c = db.query(PostComment).filter_by(id=comment_id, user_id=user.id).first()
    if not c:
        raise HTTPException(404, "Comment not found")
    db.delete(c)
    db.commit()
    return {"deleted": True}


@router.post("/posts/{post_id}/report")
def report(post_id: int, body: ReportIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if body.reason not in REPORT_REASONS:
        raise HTTPException(422, f"Reason must be one of {list(REPORT_REASONS)}")
    p = _visible_post(db, user, post_id)
    if p.user_id == user.id:
        raise HTTPException(400, "You cannot report your own post. You can delete it instead")
    if db.query(PostReport).filter_by(post_id=p.id, reporter_id=user.id).first():
        return {"reported": True, "hidden": p.status == "hidden"}
    db.add(PostReport(post_id=p.id, reporter_id=user.id, reason=body.reason))
    p.report_count = (p.report_count or 0) + 1
    if p.report_count >= HIDE_AFTER_REPORTS and p.status == "visible":
        p.status = "hidden"                                   # hidden until a moderator reviews it
    db.commit()
    return {"reported": True, "hidden": p.status == "hidden"}
