import os

os.environ.setdefault("AUTH_USER_CACHE_SECONDS", "0")   # a remembered user row would leak between tests that reuse ids
os.environ.setdefault("AI_PROVIDER", "off")                   # tests never call a real AI service (your keys stay in .env and your quota untouched)

# A test database file made before a column existed must gain it, exactly as a real start-up adds it to an existing database.
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_ac.db")
import app.main  # noqa: E402,F401  (registers every model)
from app.database import Base, _ensure_columns, engine  # noqa: E402

Base.metadata.create_all(bind=engine)
_ensure_columns()
