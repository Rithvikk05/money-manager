# Deployment Guide

Money Manager is built to be deployed seamlessly as a single full-stack application on **Vercel**, utilizing **Serverless API Routes** and a **MongoDB Atlas** database.

## Vercel Deployment (Full Stack)

### Step 1: Connect GitHub to Vercel
1. Go to https://vercel.com
2. Sign in with your GitHub account.
3. Click "Add New..." and select "Project".
4. Select your `money-manager` repository from the list.

### Step 2: Configure Build Settings
Since the project is now a unified full-stack Vercel app, the default settings work perfectly:
- **Framework Preset**: Vite
- **Root Directory**: `./` (Leave default)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 3: Environment Variables
Before clicking deploy, expand the **Environment Variables** section and add the following keys:

```
MONGODB_URI=mongodb+srv://your_user:your_password@cluster0.example.mongodb.net/money_manager?appName=Cluster0
JWT_SECRET=replace_with_a_long_random_secret
```

> [!CAUTION]
> **SECURITY WARNING:** NEVER commit real credentials to GitHub. Your `.env.local` is ignored by git for this reason. Ensure you only input real database passwords directly into the Vercel dashboard.

### Step 4: Deploy
Click **Deploy**! 

Vercel will now automatically:
1. Build your Vite React frontend.
2. Configure your serverless backend endpoints located in the `api/` folder.
3. Set up the routes based on your `vercel.json` configuration.

Vercel will automatically redeploy whenever you push changes to your `main` branch.

Your Money Manager is now live! 🚀

## Custom Domain (Optional)

1. Purchase a domain from your preferred registrar (Namecheap, GoDaddy, etc.).
2. Go to your Vercel Project Settings > Domains.
3. Enter your domain name and click Add.
4. Follow the DNS configuration instructions provided by Vercel to point your domain to their servers.
5. Vercel will automatically provision a free SSL certificate for you.
