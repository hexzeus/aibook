# Windows Setup Guide - AI Book Generator v2.0

## Step 1: Install PostgreSQL

Since you need admin rights for automatic install, here's how to install manually:

### Option A: Download Installer (Recommended)
1. Download from: https://www.postgresql.org/download/windows/
2. Run the installer **as Administrator**
3. During installation:
   - PostgreSQL Version: 16.x
   - Password: `postgres` (or remember what you set)
   - Port: `5432` (default)
   - Components: PostgreSQL Server, pgAdmin, Command Line Tools
4. Let it finish installing

### Option B: Using Chocolatey (If you have admin PowerShell)
```powershell
# Run PowerShell as Administrator
choco install postgresql16 -y
```

### Verify Installation
Open a **new** Command Prompt and run:
```cmd
psql --version
```
Should output: `psql (PostgreSQL) 16.x`

## Step 2: Run Setup Script

Once PostgreSQL is installed, run the setup script:

```cmd
cd C:\Users\ives0\OneDrive\Desktop\aibook
setup_local.bat
```

This script will:
- ✅ Check Python and PostgreSQL
- ✅ Install Python dependencies
- ✅ Create `.env` file from template
- ✅ Create `aibook_dev` database
- ✅ Initialize all tables

## Step 3: Configure Environment

Edit the `.env` file and add your keys:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aibook_dev
ANTHROPIC_API_KEY=your_key_here
GUMROAD_ACCESS_TOKEN=your_token_here
```

## Step 4: Start the Backend

```cmd
uvicorn main_postgres:app --reload
```

Backend runs at: http://localhost:8000

## Step 5: Start the Frontend

Open a **new** Command Prompt:

```cmd
cd C:\Users\ives0\OneDrive\Desktop\aibook\frontend
python -m http.server 3000
```

Frontend runs at: http://localhost:3000

## Troubleshooting

### "psql: command not found"
PostgreSQL not in PATH. Add it manually:
1. Find PostgreSQL bin folder: `C:\Program Files\PostgreSQL\16\bin`
2. Add to PATH:
   - Search "Environment Variables" in Windows
   - Edit System PATH
   - Add PostgreSQL bin folder
   - Restart Command Prompt

### "peer authentication failed"
Edit `pg_hba.conf`:
1. Find file: `C:\Program Files\PostgreSQL\16\data\pg_hba.conf`
2. Change `METHOD` from `peer` to `md5` or `trust`
3. Restart PostgreSQL service

### "could not connect to server"
Start PostgreSQL service:
```cmd
net start postgresql-x64-16
```

Or use Services app (services.msc) to start "postgresql-x64-16"

### "database already exists"
That's fine! It means database is already created. Continue with setup.

### Python dependencies fail
Update pip first:
```cmd
python -m pip install --upgrade pip
pip install -r requirements_postgres.txt
```

## Quick Test

Once everything is running:

1. Open http://localhost:3000
2. Enter a test license key
3. Backend will validate with Gumroad
4. If valid, you should see the main app

## Next: Deploy to Production

See [DEPLOYMENT.md](DEPLOYMENT.md) for deploying to Render.com
