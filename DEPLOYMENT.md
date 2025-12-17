# Deployment Guide - AI Book Generator v2.0

## Quick Start

### 1. Set Up PostgreSQL on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "PostgreSQL"
3. Configure:
   - Name: `aibook-postgres`
   - Database: `aibook_production`
   - Region: Oregon (or closest to your users)
   - Plan: Starter ($7/month)
4. Click "Create Database"
5. Copy the **Internal Database URL** (starts with `postgresql://`)

### 2. Deploy Backend API

1. In Render Dashboard: Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - Name: `aibook-api-v2`
   - Runtime: Python 3
   - Build Command: `pip install -r requirements_postgres.txt`
   - Start Command: `uvicorn main_postgres:app --host 0.0.0.0 --port $PORT`
   - Plan: Starter ($7/month)
4. Environment Variables:
   ```
   DATABASE_URL=[paste Internal Database URL from step 1]
   ANTHROPIC_API_KEY=[your Anthropic API key]
   GUMROAD_ACCESS_TOKEN=[your Gumroad access token]
   GUMROAD_PRODUCT_ID_STARTER=aibook-starter-1k
   GUMROAD_PRODUCT_ID_PRO=aibook-pro-3k
   GUMROAD_PRODUCT_ID_BUSINESS=aibook-business-7k
   GUMROAD_PRODUCT_ID_ENTERPRISE=aibook-enterprise-17k
   ```
5. Click "Create Web Service"

### 3. Initialize Database

Once deployed, open Render Shell for your web service:

```bash
python -c "from database.connection import initialize_database; db = initialize_database(); db.create_tables(); print('✅ Database initialized')"
```

### 4. Deploy Frontend

**Option A: Render Static Site**
1. Click "New +" → "Static Site"
2. Connect repository
3. Configure:
   - Name: `aibook-frontend-v2`
   - Root Directory: `frontend`
   - Publish Directory: `.`
4. Update `frontend/js/config.js`:
   ```javascript
   API_BASE_URL: 'https://aibook-api-v2.onrender.com'
   ```

**Option B: CDN (Cloudflare Pages, Netlify, Vercel)**
- Simpler and faster
- Upload `frontend` folder
- Update API URL in config

### 5. Test Everything

1. Visit your frontend URL
2. Enter a test license key
3. Try creating a book
4. Generate a few pages
5. Export to EPUB
6. Verify credits are deducted

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `ANTHROPIC_API_KEY` - Claude API key
- `GUMROAD_ACCESS_TOKEN` - Gumroad API token

### Gumroad Products
- `GUMROAD_PRODUCT_ID_STARTER` - Starter package product ID
- `GUMROAD_PRODUCT_ID_PRO` - Professional package
- `GUMROAD_PRODUCT_ID_BUSINESS` - Business package
- `GUMROAD_PRODUCT_ID_ENTERPRISE` - Enterprise package

## Database Migrations

### Initial Setup
```bash
# Create tables
python -c "from database.connection import initialize_database; db = initialize_database(); db.create_tables()"
```

### Future Migrations (with Alembic)
```bash
# Install alembic
pip install alembic

# Initialize
alembic init migrations

# Create migration
alembic revision --autogenerate -m "description"

# Apply migration
alembic upgrade head
```

## Monitoring

### Health Check
```
GET https://your-api.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "version": "2.0.0"
}
```

### Database Health
```bash
# In Render Shell
python -c "from database.connection import initialize_database; db = initialize_database(); print('✅ Connected' if db.health_check() else '❌ Failed')"
```

## Scaling

### Database
- Starter: 256 MB RAM, 1 GB storage
- Standard: 4 GB RAM, 50 GB storage
- Pro: 16 GB RAM, 512 GB storage

### API
- Starter: 512 MB RAM, 0.5 CPU
- Standard: 2 GB RAM, 1 CPU
- Pro: 4 GB RAM, 2 CPU

### When to Scale
- Monitor response times in Render dashboard
- Watch database connection pool usage
- Check memory usage
- Scale when consistently above 70% utilization

## Backup

### Database Backups
Render automatically backs up PostgreSQL:
- Starter: Daily backups, 7-day retention
- Standard: Daily backups, 30-day retention
- Pro: Continuous backups, point-in-time recovery

### Manual Backup
```bash
# Download database dump
pg_dump $DATABASE_URL > backup.sql

# Restore from backup
psql $DATABASE_URL < backup.sql
```

## Troubleshooting

### "Database not found"
- Check `DATABASE_URL` is set correctly
- Verify database exists in Render dashboard
- Run `db.create_tables()` to initialize

### "Insufficient credits"
- User needs to purchase more credits
- Check license key is valid in Gumroad
- Verify tier detection in `gumroad_v2.py`

### "CORS errors"
- Update CORS origins in `main_postgres.py`
- Or use same domain for frontend and API

### "Slow API responses"
- Check database connection pool size
- Monitor Anthropic API latency
- Consider upgrading Render plan

## Cost Estimate

### Monthly Costs
- Database (Starter): $7
- API (Starter): $7
- Frontend (Static): Free
- **Total: $14/month**

### Plus Usage
- Anthropic API: ~$0.015 per generation
- At 10,000 generations/month: ~$150
- **Revenue: $500+ (at $0.05 effective rate)**
- **Profit margin: ~70%**

## Security

### API Keys
- Never commit `.env` file
- Use Render environment variables
- Rotate keys periodically

### Database
- Uses SSL by default (Render)
- Connection pooling prevents exhaustion
- No public database access

### Frontend
- API URL configurable per environment
- License keys validated server-side
- No sensitive data in localStorage (except license key)

## Support

### Logs
View logs in Render dashboard:
- API logs: Real-time request/response
- Database logs: Connection and query issues
- Error tracking: Set up Sentry (optional)

### Monitoring
- Render built-in metrics
- Health check endpoint
- Custom analytics in `usage_logs` table
