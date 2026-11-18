import os
from fastapi import FastAPI

def add_security_headers(app: FastAPI):
    @app.middleware("http")
    async def security_headers_middleware(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers.setdefault("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob: https://res.cloudinary.com")          # a page may set a stricter or specific one itself
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response