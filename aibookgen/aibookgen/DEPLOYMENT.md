# Deployment Guide

## Backend Deployment (Render)

✅ **Already Deployed**: https://aibook-yzpk.onrender.com

The backend is healthy and running. If you need to redeploy:

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Find your service `aibook-api-v2`
3. Click "Manual Deploy" → "Deploy latest commit"

**Important**: Make sure these environment variables are set in Render:
- `DATABASE_URL` (from PostgreSQL database)
- `ANTHROPIC_API_KEY` (your Claude API key)
- `GUMROAD_ACCESS_TOKEN` (your Gumroad API token)

## Frontend Deployment (Netlify)

### Option 1: Deploy via Netlify CLI

```bash
# Install Netlify CLI (if not already installed)
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy to production
cd aibookgen/aibookgen
netlify deploy --prod
```

### Option 2: Deploy via Netlify Dashboard

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Click "Add new site" → "Deploy manually"
3. Drag and drop the `dist` folder
4. **Set environment variable**:
   - Go to Site settings → Environment variables
   - Add: `VITE_API_URL` = `https://aibook-yzpk.onrender.com`
5. Redeploy the site

### Option 3: Connect GitHub Repository

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Click "Add new site" → "Import an existing project"
3. Choose GitHub and select your repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `aibookgen/aibookgen/dist`
   - **Base directory**: `aibookgen/aibookgen`
5. Add environment variable:
   - `VITE_API_URL` = `https://aibook-yzpk.onrender.com`
6. Deploy

## Current Status

✅ Backend: https://aibook-yzpk.onrender.com (Healthy)
✅ Frontend Build: Complete (dist folder ready)
⏳ Frontend Deployment: Needs redeployment with correct API URL

## What Changed

The `.env` file was updated with the correct backend URL:
```
VITE_API_URL=https://aibook-yzpk.onrender.com
```

A fresh build was created with this correct URL. You need to redeploy the frontend to Netlify.

## Testing After Deployment

1. Visit your Netlify URL
2. Try to create a book with a valid license key
3. Check browser console for any API errors
4. Verify credits are loading correctly

## Troubleshooting

### "Invalid license key" error
- This is expected if you're using a test key
- Use a real Gumroad license key from your product

### CORS errors
- The backend is configured to accept requests from any origin
- If you still see CORS errors, check that the API URL is correct

### Backend "no-server" error
- This means Render service is down or sleeping (free tier)
- Wait 30-60 seconds for it to wake up
- Or upgrade to a paid plan for always-on service
