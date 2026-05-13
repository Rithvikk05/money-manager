# Deployment Guide

## Vercel Deployment (Frontend)

### Step 1: Connect GitHub to Vercel
1. Go to https://vercel.com
2. Sign in with GitHub
3. Click "New Project"
4. Select your `money-manager` repository

### Step 2: Configure Build Settings
- **Build Command**: `npm run build --prefix frontend`
- **Output Directory**: `frontend/dist`
- **Install Command**: `npm install`

### Step 3: Environment Variables
Add in Vercel dashboard:
```
VITE_API_BASE=https://your-backend-url/api
```

### Step 4: Deploy
Click "Deploy" - Vercel will automatically deploy on every push to main!

## Backend Deployment Options

### Option 1: Railway (Recommended)
1. Go to https://railway.app
2. Create new project
3. Connect GitHub
4. Select money-manager repo
5. Select `backend` as root directory
6. Add environment variables (PORT, etc.)
7. Deploy!

### Option 2: Heroku
1. Install Heroku CLI
2. Run: `heroku create money-manager-api`
3. Push to Heroku: `git push heroku main`
4. View logs: `heroku logs --tail`

### Option 3: Render
1. Go to https://render.com
2. Create new Web Service
3. Connect GitHub
4. Select repository
5. Build: `npm install`
6. Start: `npm start`
7. Deploy!

## Database Considerations

- SQLite works for small deployments
- For production, consider:
  - PostgreSQL
  - MongoDB
  - Firebase Firestore

## Update Backend URL in Frontend

After deploying backend, update in `frontend/src/App.jsx`:

```javascript
const API_BASE = 'https://your-backend-url/api'
```

Or use environment variable:

```javascript
const API_BASE = import.meta.env.VITE_API_BASE
```

## Custom Domain

1. Purchase domain (Namecheap, GoDaddy, etc.)
2. In Vercel: Add domain in project settings
3. Follow DNS configuration instructions
4. Wait for SSL certificate (usually instant)

---

**You're all set! Your Money Manager is live! 🚀**
