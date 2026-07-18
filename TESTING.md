# Quick Start Guide - Testing the Fixes

## Prerequisites
- Node.js installed
- MongoDB URI or using SQLite (default)

> [!CAUTION]
> **SECURITY WARNING:** NEVER commit your `.env` or `.env.local` file to version control. Do not hardcode real database credentials or JWT secrets into your application code, test scripts, or documentation.

## Setup Steps

### 1. Backend Setup
```bash
cd backend
npm install  # Install new dependencies
npm run dev  # Start backend on port 5000
```

You should see:
```
Connected to SQLite database
Server running on http://localhost:5000 with SQLite
```

### 2. Frontend Setup (in another terminal)
```bash
cd frontend
npm install
npm run dev  # Start the full local stack on port 3000
```

If you only want the React app without API routes, use `npm run dev:frontend`.

## Testing the Fixes

### Test 1: Excel Import ✅

**Steps:**
1. Open http://localhost:3000
2. Register a new account (username: `testuser`, email: `test@test.com`, password: `test123`)
3. Login with your account
4. Go to "Import/Export" tab
5. Upload the Excel file (Money Manager_13-05-26.xlsx)

**Expected Result:**
```
✅ N transactions imported successfully!
```

**What was fixed:**
- No more "Request failed with status code 500"
- Proper error messages if import fails
- Detailed logging in backend console

### Test 2: User Registration ✅

**Steps:**
1. Open http://localhost:3000
2. Click "Register" tab
3. Fill in details:
   - Username: `newuser`
   - Email: `newuser@example.com`
   - Password: `password123`
   - Confirm: `password123`
4. Click Register

**Expected Result:**
```
✅ User registered successfully
[App automatically logs you in]
```

**Test Invalid Cases:**
- Try registering with same username → Should show "Username or email already exists"
- Try mismatched passwords → Should show "Passwords do not match"
- Try password < 6 chars → Should show "Password must be at least 6 characters"

### Test 3: User Login ✅

**Steps:**
1. Click Logout button (top-right)
2. On login page, enter username and password
3. Click Login

**Expected Result:**
```
✅ Login successful
[Redirected to Dashboard]
```

**Test Invalid Cases:**
- Wrong username → Should show "Invalid username or password"
- Wrong password → Should show "Invalid username or password"

### Test 4: Session Persistence ✅

**Steps:**
1. Login successfully
2. Close browser tab
3. Open http://localhost:3000 in new tab

**Expected Result:**
```
[Should automatically log you in, no login page shown]
[Your transactions should load]
```

### Test 5: Logout ✅

**Steps:**
1. While logged in, click "Logout" button (top-right)
2. Confirm logout

**Expected Result:**
```
✅ Session cleared
[Redirected to login page]
```

## Backend Logs - What to Look For

When importing Excel file, you should see:
```
Starting Excel import...
File size: 12345
Reading sheet: Sheet1
Found N rows to import
Successfully imported N transactions to SQLite
```

If there's an error during import:
```
Excel parsing error: [specific error]
Sheet reading error: [specific error]
Error importing row: [specific error]
```

## Database Verification

### SQLite
```bash
sqlite3 backend/money_manager.db
SELECT * FROM users;
SELECT * FROM transactions;
```

### MongoDB
```javascript
db.users.find()
db.transactions.find()
```

## Troubleshooting

### Issue: "No file uploaded" error
- Check file is actually selected
- File should be .xlsx format
- File size should be < 50MB

### Issue: "Invalid Excel file format"
- Verify Excel file is not corrupted
- Try with a fresh export from the app
- Check file is actual .xlsx, not CSV renamed

### Issue: Login fails with valid credentials
- Check browser console for errors
- Verify backend is running
- Check JWT_SECRET env var (should use default if not set)

### Issue: Transactions not loading after login
- Check network tab for 401 errors
- Verify token is in localStorage
- Try logging out and back in

## Demo Account (Optional)

The Auth component shows demo credentials that you can reference, but they won't work unless manually created in database.

To create one:
```bash
sqlite3 backend/money_manager.db
INSERT INTO users (username, email, password) VALUES 
('demo', 'demo@example.com', '$2a$10$...');
```

(Use bcryptjs to hash 'demo123' password)

## API Testing with curl

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
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
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'
```

### Use Token
```bash
curl http://localhost:5000/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Next Steps

After testing:
1. ✅ Verify Excel import works
2. ✅ Verify user registration/login works
3. ✅ Verify session persistence works
4. ✅ Test all transaction operations (add, edit, delete)
5. ✅ Test import/export functionality
6. ✅ Check browser console for any errors

---

**Need help?** Check AUTHENTICATION.md for complete technical documentation.
