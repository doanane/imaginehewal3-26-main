@echo off
rem Starts the HEWAL3 API on all network interfaces so a phone on the same Wi-Fi can reach it.
rem   run-lan.cmd          -> uses Neon (DATABASE_URL in .env)
rem   run-lan.cmd offline  -> local SQLite file, for when the network blocks Neon (data is NOT in Neon)
cd /d "%~dp0"
python -m pip install -q psycopg2-binary bcrypt==4.0.1
if /I "%~1"=="offline" (
  set DATABASE_URL=sqlite:///./hewal3.db
  set DB_ALLOW_SQLITE_FALLBACK=1
  echo [OFFLINE MODE] Using local SQLite. Nothing is saved to Neon.
)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
