# Quick Start Guide - Testing the Fixes

## Prerequisites
- Node.js installed
- MongoDB URI set in `.env.local`

> [!CAUTION]
> **SECURITY WARNING:** NEVER commit your `.env` or `.env.local` file to version control. Do not hardcode real database credentials or JWT secrets into your application code, test scripts, or documentation.

## Setup Steps

### 1. Unified Full-Stack Setup
```bash
npm install
npm run dev  # Starts the Vite server and proxies /api to serverless functions
```

You should see the Vite development server running (typically on `http://localhost:3000`).

## Testing the Fixes

### Test 1: Excel Import ✅
**Steps:**
1. Open http://localhost:3000
2. Register a new account
3. Login with your account
4. Go to "Import/Export" tab
5. Upload an Excel file

**Expected Result:**
✅ Transactions imported successfully!

### Test 2: User Registration ✅
**Steps:**
1. Click "Register" tab
2. Fill in details and click Register

**Expected Result:**
✅ User registered successfully and automatically logged in.

**Test Invalid Cases:**
- Try registering with same username → Should show "Username or email already exists"
- Try mismatched passwords → Should show "Passwords do not match"

### Test 3: User Login ✅
**Steps:**
1. Click Logout button
2. On login page, enter username and password
3. Click Login

**Expected Result:**
✅ Login successful

### Test 4: Session Persistence ✅
**Steps:**
1. Login successfully
2. Refresh the browser page

**Expected Result:**
[Should automatically keep you logged in and load your transactions]

## Database Verification

To verify changes directly in MongoDB Atlas:
1. Log into your [MongoDB Atlas Dashboard](https://cloud.mongodb.com/).
2. Browse Collections in your Cluster.
3. Check the `users` and `transactions` collections.

## Troubleshooting

### Issue: "No file uploaded" error
- Check file is actually selected
- File should be .xlsx format

### Issue: Login fails with valid credentials
- Check browser console for errors
- Verify `MONGODB_URI` and `JWT_SECRET` are correctly set in `.env.local`.

### Issue: Transactions not loading after login
- Check network tab for 401 errors
- Verify token is in localStorage
- Try logging out and back in

## API Testing with curl (Optional)

### Register
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username":"testuser",
    "email":"test@example.com",
    "password":"test123",
    "confirmPassword":"test123"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'
```

---

**Need help?** Check `AUTHENTICATION.md` for complete technical documentation.
