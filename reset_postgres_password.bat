@echo off
echo ========================================
echo Reset PostgreSQL Password
echo ========================================
echo.
echo This will reset the postgres user password to: postgres
echo.
pause

REM Find PostgreSQL data directory
set PGDATA=C:\Program Files\PostgreSQL\16\data

REM Stop PostgreSQL service
echo Stopping PostgreSQL service...
net stop postgresql-x64-16

REM Edit pg_hba.conf to allow trust authentication temporarily
echo Backing up pg_hba.conf...
copy "%PGDATA%\pg_hba.conf" "%PGDATA%\pg_hba.conf.backup"

REM Replace md5 with trust for local connections
powershell -Command "(Get-Content '%PGDATA%\pg_hba.conf') -replace 'md5', 'trust' | Set-Content '%PGDATA%\pg_hba.conf'"

REM Start PostgreSQL service
echo Starting PostgreSQL service...
net start postgresql-x64-16

REM Wait for service to start
timeout /t 3

REM Reset password
echo Resetting password...
psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"

REM Restore pg_hba.conf
echo Restoring pg_hba.conf...
copy "%PGDATA%\pg_hba.conf.backup" "%PGDATA%\pg_hba.conf"

REM Restart PostgreSQL
echo Restarting PostgreSQL...
net stop postgresql-x64-16
net start postgresql-x64-16

echo.
echo ========================================
echo Password reset complete!
echo New password: postgres
echo ========================================
echo.
pause
