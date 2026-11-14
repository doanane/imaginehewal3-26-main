"""Uploads the HEWAL3 logo to Cloudinary (hewal3/brand/logo) and writes its link to app/data/brand.json, which the emails use in their header.

    python scripts/upload_brand_logo.py [path-to-logo.png]
"""
import hashlib
import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except Exception:
    pass

import requests  # noqa: E402

HERE = os.path.dirname(__file__)
DEFAULT = os.path.join(HERE, "..", "..", "front-sdk58", "assets", "images", "logo.png")
OUT = os.path.join(HERE, "..", "app", "data", "brand.json")


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    cloud, key, secret = os.getenv("CLOUDINARY_CLOUD_NAME"), os.getenv("CLOUDINARY_API_KEY"), os.getenv("CLOUDINARY_API_SECRET")
    if not (cloud and key and secret):
        sys.exit("Cloudinary is not configured in back/.env")
    params = {"public_id": "hewal3/brand/logo", "overwrite": "true", "timestamp": str(int(time.time()))}
    to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params)) + secret
    data = {**params, "api_key": key, "signature": hashlib.sha1(to_sign.encode()).hexdigest()}
    with open(path, "rb") as f:
        r = requests.post(f"https://api.cloudinary.com/v1_1/{cloud}/image/upload", data=data, files={"file": ("logo.png", f)}, timeout=60)
    if r.status_code != 200:
        sys.exit(f"Cloudinary refused the logo: {r.status_code} {r.text[:200]}")
    url = r.json()["secure_url"]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"logo_url": url}, open(OUT, "w", encoding="utf-8"), indent=1)
    print("logo uploaded:", url)


if __name__ == "__main__":
    main()
