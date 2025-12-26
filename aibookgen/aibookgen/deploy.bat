@echo off
REM Quick deployment script for Netlify

echo ==========================================
echo   AI Book Generator - Netlify Deployment
echo ==========================================
echo.

echo Step 1: Building the application...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    exit /b 1
)
echo Build complete!
echo.

echo Step 2: Deploying to Netlify...
echo.
echo Choose deployment option:
echo 1. Deploy to production (recommended)
echo 2. Deploy as draft preview
echo.
set /p choice="Enter your choice (1 or 2): "

if "%choice%"=="1" (
    echo Deploying to production...
    call netlify deploy --prod --dir=dist
) else if "%choice%"=="2" (
    echo Deploying as draft...
    call netlify deploy --dir=dist
) else (
    echo Invalid choice!
    exit /b 1
)

echo.
echo ==========================================
echo   Deployment Complete!
echo ==========================================
echo.
echo Don't forget to set environment variables in Netlify dashboard:
echo   VITE_API_URL = https://aibook-yzpk.onrender.com
echo.
pause
