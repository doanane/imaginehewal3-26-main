"""Uploads the Explore pictures to Cloudinary and adds a few starter posts written by the HEWAL3 team.

    python scripts/seed_explore.py            # upload any picture not uploaded yet, write app/data/explore_media.json, add the starter posts
    python scripts/seed_explore.py --force    # upload every picture again

Pictures are free-to-use photos from Unsplash (Unsplash License: free for commercial use). Each one is copied to our own Cloudinary account
(folder hewal3/explore) so the app never depends on a third party for images; the Cloudinary links and the photographer credits go in
app/data/explore_media.json. The starter posts are signed "HEWAL3 Team" (a real editorial account, never presented as a member) so the
community is not empty on day one. Re-running changes nothing that already exists.
"""
import hashlib
import json
import os
import secrets
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except Exception:                                  # the variables may already be in the environment
    pass

import requests  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "app", "data", "explore_media.json")
Q = "?w=1400&q=75&auto=format&fit=crop"
# key -> (Unsplash photo id on the CDN, photographer)
PICTURES = {
    "steps": ("photo-1477332552946-cfb384aeaf1c", "Emma Simpson"),
    "active": ("photo-1741156229623-da94e6d7977d", "Jakub Zerdzicki"),
    "sleep": ("photo-1762845872088-12c352bbb119", "Bobby Thapa"),
    "meals": ("photo-1707529172036-fb5ffbc70bf8", "Inna Safa"),
    "meds": ("photo-1789983361946-1dd2258c7470", "Miles Burke"),
    "mind": ("photo-1506126613408-eca07ce68773", "Jared Rice"),
    "learn": ("photo-1728931710024-c015ea8f4414", "Kelly Sikkema"),
    "g_walking": ("photo-1667781838690-5f32ea0ccea6", "Tong Su"),
    "g_heart": ("photo-1615486511484-92e172cc4fe0", "Mockup Graphics"),
    "g_diabetes": ("photo-1592578630143-fac65cda7a67", "Ravi Sharma"),
    "g_eating": ("photo-1734866675564-34463f5dce1e", "Ingeborg Korme"),
    "g_sleep": ("photo-1714175247782-64c19c77c705", "Nicole Bomar"),
    "g_peer": ("photo-1758275557348-23950a3ddeae", "Vitaly Gariev"),
    "g_carers": ("photo-1773227055624-07b515ba87c5", "Age Cymru"),
}


def upload(key: str, photo: str) -> str:
    cloud, api_key, secret = os.getenv("CLOUDINARY_CLOUD_NAME"), os.getenv("CLOUDINARY_API_KEY"), os.getenv("CLOUDINARY_API_SECRET")
    if not (cloud and api_key and secret):
        sys.exit("Cloudinary is not configured (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in back/.env)")
    params = {"public_id": f"hewal3/explore/{key}", "overwrite": "true", "timestamp": str(int(time.time()))}
    to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params)) + secret
    body = {**params, "api_key": api_key, "signature": hashlib.sha1(to_sign.encode()).hexdigest(), "file": f"https://images.unsplash.com/{photo}{Q}"}
    r = requests.post(f"https://api.cloudinary.com/v1_1/{cloud}/image/upload", data=body, timeout=90)
    if r.status_code != 200:
        sys.exit(f"Cloudinary refused {key}: {r.status_code} {r.text[:200]}")
    return r.json()["secure_url"]


def pictures(force: bool) -> dict:
    have = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
    for key, (photo, who) in PICTURES.items():
        if key in have and not force:
            continue
        have[key] = {"url": upload(key, photo), "credit": f"{who} on Unsplash"}
        print("uploaded", key)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(have, open(OUT, "w", encoding="utf-8"), indent=1)
    return have


POSTS = [
    (None, "discussion", "Welcome to the HEWAL3 community", "This is a place to build healthy habits together. Join a weekly challenge, find an interest community, and share what is working for you. Advice here comes from members and our team, not from your clinician, so check with them before you change any treatment. Be kind, and keep each other's details private.", None),
    (None, "tip", "One small change this week", "Pick one thing, not five. Walk for ten minutes after one meal a day, or swap one sugary drink for water. Do it for seven days, then add the next thing. Small changes you keep beat big ones you drop.", "steps"),
    ("walking", "tip", "Start where you are", "Look at your average steps this week and add about 500 a day to it, not 5,000. A walk after dinner, getting off one stop early, taking the stairs. When 500 feels easy, add another 500.", "g_walking"),
    ("heart", "tip", "Measure blood pressure the same way every time", "Sit quietly for five minutes with your back supported and your arm resting at heart height. No caffeine or exercise in the 30 minutes before. Take two readings a minute apart, and write down the time. The same routine makes your trend more meaningful. Share any high readings with your clinician.", "g_heart"),
    ("diabetes", "tip", "Plan your plate", "A simple plate: half vegetables, a quarter protein such as fish, eggs or beans, a quarter starchy food such as brown rice, yam or millet. Water instead of sugary drinks. If you take medicine for diabetes, follow the plan your clinician gave you.", "g_diabetes"),
    ("eating", "tip", "Swap one sugary drink for water", "Many soft drinks and juices hold several teaspoons of sugar. This week, replace one a day with water, or water with a squeeze of lemon. Also taste your food before you add salt or stock cubes, since a lot of our salt comes from seasoning.", "g_eating"),
    ("sleep", "tip", "A wake-up time you can keep", "The most useful sleep habit is a steady wake-up time, even at weekends. Get daylight soon after you wake. Keep screens dim in the last half hour before bed. Most adults need seven to nine hours.", "g_sleep"),
    ("peer", "discussion", "How are you really feeling this week?", "You do not have to be fine. If you want to, tell us one thing that has been weighing on you, or one thing that has helped. Please do not share details that identify other people. If you are in danger or thinking about harming yourself, call your emergency number now (112 in Ghana) or tell someone you trust.", "g_peer"),
    ("carers", "tip", "Looking after yourself while you look after someone", "Caring is tiring, and your health matters too. Ask one person for one specific piece of help this week. Keep your own appointments. Take ten minutes a day that is only yours, and tell your care team if you feel overwhelmed.", "g_carers"),
]


def starter_posts(media: dict) -> None:
    from app.auth.hashing import get_password_hash
    from app.database import SessionLocal
    import app.main  # noqa: F401  (registers every model)
    from app.models.activity import CommunityPost, Participant
    from app.models.user import User

    db = SessionLocal()
    try:
        team = db.query(User).filter_by(email="team@hewal3.app").first()
        if not team:
            # an editorial account nobody can sign in to: the password is random and thrown away
            team = User(email="team@hewal3.app", username="hewal3_team", first_name="HEWAL3", last_name="Team", is_active=True,
                        hashed_password=get_password_hash(secrets.token_urlsafe(40)))
            db.add(team); db.commit(); db.refresh(team)
        if not db.query(Participant).filter_by(user_id=team.id).first():
            db.add(Participant(user_id=team.id, display_name="HEWAL3 Team", leaderboard_opt_in=False)); db.commit()
        added = 0
        for group, cat, title, body, pic in POSTS:
            if db.query(CommunityPost).filter_by(user_id=team.id, title=title).first():
                continue
            db.add(CommunityPost(user_id=team.id, category=cat, title=title, body=body, group_key=group, image_url=media[pic]["url"] if pic else None))
            added += 1
        db.commit()
        print(f"starter posts added: {added}")
    finally:
        db.close()


if __name__ == "__main__":
    media = pictures("--force" in sys.argv)
    starter_posts(media)
