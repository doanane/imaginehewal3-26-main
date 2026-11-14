import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_database_url():
    """Get database URL with fallbacks"""
    db_url = settings.DATABASE_URL
    
    if db_url:
        # Mask password for logging
        masked_url = db_url.split('@')[-1] if '@' in db_url else db_url
        logger.info(f"Attempting to connect to: ...@{masked_url}")
    else:
        logger.warning("No DATABASE_URL found in environment!")

    # If Azure URL provided, use it
    if db_url and "azure" in db_url.lower():
        logger.info("Using Azure PostgreSQL connection")
        return db_url
    
    # Otherwise use local PostgreSQL
    if db_url:
        logger.info("Using configured database URL")
        return db_url
        
    return "sqlite:///./hewal3.db"

# Get database URL
db_url = get_database_url()

# Create engine
try:
    if "sqlite" in db_url:
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
    else:
        # A remote database costs one network round trip per query, so every extra query is felt.
        # pool_pre_ping would add a whole extra round trip to EVERY request; instead we ping only a connection that sat idle
        # long enough for the server or pooler to have dropped it (see _ping_when_idle below).
        engine = create_engine(
            db_url,
            echo=False,
            pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
            max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "20")),
            pool_pre_ping=False,
            pool_recycle=240,
            pool_use_lifo=True,                       # reuse the warmest connection
            connect_args={
                'connect_timeout': 10,
                'keepalives': 1, 'keepalives_idle': 30, 'keepalives_interval': 10, 'keepalives_count': 3,
            },
        )
    
    # Test connection. Retry once: switching Wi-Fi/hotspot briefly drops outbound connections.
    import time
    for _attempt in (1, 2):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            break
        except Exception as _err:
            if _attempt == 2:
                raise
            logger.warning(f"Database not reachable (attempt 1): {str(_err)[:120]}. Retrying in 3s...")
            time.sleep(3)
    logger.info("Database connection successful")
    
except Exception as e:
    logger.error(f"Database connection failed: {e}")

    # With a real DATABASE_URL configured, never silently fall back: that would hide an outage
    # and quietly write data to a throwaway local file. Set DB_ALLOW_SQLITE_FALLBACK=1 to allow.
    if db_url and "sqlite" not in db_url and os.getenv("DB_ALLOW_SQLITE_FALLBACK", "0") != "1":
        raise RuntimeError(f"Cannot connect to configured database: {e}") from e

    # Fallback to SQLite
    logger.info("Falling back to SQLite...")
    engine = create_engine("sqlite:///./hewal3.db", 
                          connect_args={"check_same_thread": False},
                          echo=True)
    logger.info("Using SQLite database")

if engine.dialect.name != "sqlite":
    import time as _time
    from sqlalchemy import event as _event, exc as _exc

    IDLE_PING_AFTER = 20  # seconds

    @_event.listens_for(engine, "checkout")
    def _ping_when_idle(dbapi_conn, record, proxy):
        idle = _time.time() - record.info.get("last_used", 0)
        if idle > IDLE_PING_AFTER:
            try:
                cur = dbapi_conn.cursor()
                cur.execute("SELECT 1")
                cur.close()
            except Exception:
                raise _exc.DisconnectionError()      # the pool discards it and opens a fresh one

    @_event.listens_for(engine, "checkin")
    def _remember_use(dbapi_conn, record):
        record.info["last_used"] = _time.time()


def warm_pool(n: int = 4) -> None:
    """Open a few connections at start-up so the first requests do not each pay the connection set-up cost."""
    if engine.dialect.name == "sqlite":
        return
    import concurrent.futures

    def _one(_):
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=n) as ex:
            list(ex.map(_one, range(n)))
    except Exception as e:
        logger.warning(f"Pool warm-up skipped: {e}")


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables(preserve_data: bool = True):
    """Create database tables with option to preserve data"""
    try:
        # SQLite fallback: just create tables if they don't exist
        if engine.dialect.name == "sqlite":
            logger.info("SQLite detected – ensuring tables exist")
            Base.metadata.create_all(bind=engine)
        else:
            if not preserve_data and settings.ENVIRONMENT == "development":
                logger.warning("Dropping tables (data will be lost!)")
                Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
        _ensure_columns()

    except Exception as e:
        logger.error(f"Error creating tables: {e}")
        raise


def _ensure_columns():
    """create_all never alters existing tables, so add columns introduced after a database was first created."""
    from sqlalchemy import inspect, text
    wanted = {"doctors": [("hashed_password", "VARCHAR")],
              "health_data": [("active_minutes", "INTEGER"), ("distance_m", "INTEGER"), ("steps_source", "VARCHAR")]}
    insp = inspect(engine)
    for table, cols in wanted.items():
        if not insp.has_table(table):
            continue
        have = {c["name"] for c in insp.get_columns(table)}
        for name, ddl in cols:
            if name not in have:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
                logger.info("Added column %s.%s", table, name)
