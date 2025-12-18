@echo off
echo ========================================
echo AI Book Generator - Local Setup
echo ========================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.11+
    pause
    exit /b 1
)
echo [OK] Python installed

REM Check PostgreSQL
psql --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [!] PostgreSQL not found
    echo.
    echo Please install PostgreSQL manually:
    echo 1. Download from: https://www.postgresql.org/download/windows/
    echo 2. Run the installer as Administrator
    echo 3. During install, set password: postgres
    echo 4. Keep default port: 5432
    echo 5. After install, run this script again
    echo.
    pause
    exit /b 1
)
echo [OK] PostgreSQL installed

REM Install Python dependencies
echo.
echo Installing Python packages...
python -m pip install --upgrade pip
pip install -r requirements_postgres.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed

REM Check if .env exists
if not exist .env (
    echo.
    echo Creating .env file...
    copy .env.example .env
    echo [!] Please edit .env and add your API keys:
    echo     - ANTHROPIC_API_KEY
    echo     - GUMROAD_ACCESS_TOKEN
    echo.
    notepad .env
)

REM Create database
echo.
echo Creating database...
psql -U postgres -c "CREATE DATABASE aibook_dev;" 2>nul
if errorlevel 1 (
    echo [!] Database may already exist (this is OK)
) else (
    echo [OK] Database created
)

REM Initialize database tables
echo.
echo Initializing database tables...
python -c "from database.connection import initialize_database; db = initialize_database(); db.create_tables(); print('[OK] Database tables created')"
if errorlevel 1 (
    echo ERROR: Failed to initialize database
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo To start the backend:
echo   uvicorn main_postgres:app --reload
echo.
echo To start the frontend:
echo   cd frontend
echo   python -m http.server 3000
echo.
echo Then open: http://localhost:3000
echo.
pause
