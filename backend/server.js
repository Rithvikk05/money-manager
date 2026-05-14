import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import multer from 'multer';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const useMongo = !!process.env.MONGODB_URI;
let db; // SQLite database reference

// Define Mongoose Schema & Model
const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  account: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String, default: '' },
  note: { type: String, default: '' },
  amount: { type: Number, required: true },
  inr: { type: Number },
  currency: { type: String, default: 'INR' },
  type: { type: String, required: true },
  description: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

// Ensure virtual `id` is included when converting to JSON/Object to match SQLite frontend expectations
transactionSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// Define User Schema & Model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password; // Never expose password
    return ret;
  }
});

const User = mongoose.model('User', userSchema);

if (useMongo) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB database'))
    .catch((err) => console.error('MongoDB connection error:', err));
} else {
  // Database setup for SQLite
  db = new sqlite3.Database(path.join(__dirname, 'money_manager.db'), (err) => {
    if (err) console.error('Database connection error:', err);
    else console.log('Connected to SQLite database');
  });

  // Initialize tables
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        account TEXT NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT,
        note TEXT,
        amount REAL NOT NULL,
        inr REAL,
        currency TEXT DEFAULT 'INR',
        type TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
}

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Helper function to hash password
const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

// Helper function to compare password
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Promise wrapper for SQLite db.get
const dbGet = (database, sql, params) => {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Promise wrapper for SQLite db.run
const dbRun = (database, sql, params) => {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

// Promise wrapper for SQLite db.all
const dbAll = (database, sql, params) => {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// Seed Demo User credentials if not exists
const seedDemoUser = async () => {
  try {
    const hashedDemoPassword = await hashPassword('demo123');
    if (useMongo) {
      // Wait briefly for connection to establish if needed
      setTimeout(async () => {
        try {
          const existingDemo = await User.findOne({ username: 'demo' });
          if (!existingDemo) {
            const demoUser = new User({
              username: 'demo',
              email: 'demo@example.com',
              password: hashedDemoPassword
            });
            await demoUser.save();
            console.log('Seeded demo user in MongoDB');
          } else {
            console.log('Demo user already exists in MongoDB');
          }
        } catch (err) {
          console.error('Error seeding demo user in MongoDB:', err.message);
        }
      }, 2000);
    } else {
      // For SQLite, wait a bit to ensure table creation completes
      setTimeout(async () => {
        try {
          const existingDemo = await dbGet(db, 'SELECT * FROM users WHERE username = ?', ['demo']);
          if (!existingDemo) {
            await dbRun(db, 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)', ['demo', 'demo@example.com', hashedDemoPassword]);
            console.log('Seeded demo user in SQLite');
          } else {
            console.log('Demo user already exists in SQLite');
          }
        } catch (err) {
          console.error('Error seeding demo user in SQLite:', err.message);
        }
      }, 2000);
    }
  } catch (err) {
    console.error('Error seeding demo user:', err.message);
  }
};

seedDemoUser();

// Routes

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Money Manager API', 
    version: '2.0.0',
    status: 'running',
    database: useMongo ? 'MongoDB' : 'SQLite',
    endpoints: {
      auth: ['/api/auth/register', '/api/auth/login'],
      transactions: ['/api/transactions', '/api/statistics'],
      import_export: ['/api/import/excel', '/api/export/excel'],
      health: '/api/health'
    }
  });
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (useMongo) {
      // Check if user exists
      const existingUser = await User.findOne({
        $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const user = new User({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password: hashedPassword
      });

      await user.save();

      // Generate token
      const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, {
        expiresIn: '7d'
      });

      res.json({
        message: 'User registered successfully',
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } else {
      // SQLite version
      const existingUser = await dbGet(
        db,
        'SELECT * FROM users WHERE username = ? OR email = ?',
        [username.toLowerCase(), email.toLowerCase()]
      );

      if (existingUser) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }

      const hashedPassword = await hashPassword(password);

      const lastId = await dbRun(
        db,
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username.toLowerCase(), email.toLowerCase(), hashedPassword]
      );

      const newUser = await dbGet(
        db,
        'SELECT id, username, email FROM users WHERE id = ?',
        [lastId]
      );

      const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, {
        expiresIn: '7d'
      });

      res.json({
        message: 'User registered successfully',
        token,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email
        }
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (useMongo) {
      const user = await User.findOne({ username: username.toLowerCase() });

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const isPasswordValid = await comparePassword(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, {
        expiresIn: '7d'
      });

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } else {
      // SQLite version
      const user = await dbGet(
        db,
        'SELECT * FROM users WHERE username = ?',
        [username.toLowerCase()]
      );

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const isPasswordValid = await comparePassword(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
        expiresIn: '7d'
      });

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all transactions (protected - per user)
app.get('/api/transactions', verifyToken, async (req, res) => {
  try {
    if (useMongo) {
      const transactions = await Transaction.find({ userId: req.userId }).sort({ date: -1 });
      res.json(transactions);
    } else {
      const rows = await dbAll(db, 'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC', [req.userId]);
      res.json(rows);
    }
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add transaction (protected - per user)
app.post('/api/transactions', verifyToken, async (req, res) => {
  try {
    const { date, account, category, subcategory, note, amount, currency, type, description } = req.body;
    
    if (useMongo) {
      const newTx = new Transaction({
        userId: req.userId,
        date,
        account,
        category,
        subcategory: subcategory || '',
        note: note || '',
        amount,
        inr: amount,
        currency: currency || 'INR',
        type,
        description: description || ''
      });
      await newTx.save();
      res.json({ id: newTx._id, message: 'Transaction added successfully' });
    } else {
      const lastId = await dbRun(
        db,
        `INSERT INTO transactions (user_id, date, account, category, subcategory, note, amount, inr, currency, type, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.userId, date, account, category, subcategory, note, amount, amount, currency, type, description]
      );
      res.json({ id: lastId, message: 'Transaction added successfully' });
    }
  } catch (err) {
    console.error('Error adding transaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update transaction (protected - per user)
app.put('/api/transactions/:id', verifyToken, async (req, res) => {
  try {
    const { date, account, category, subcategory, note, amount, currency, type, description } = req.body;
    
    if (useMongo) {
      const tx = await Transaction.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        { date, account, category, subcategory: subcategory || '', note: note || '', amount, inr: amount, currency: currency || 'INR', type, description: description || '' }
      );
      if (!tx) return res.status(404).json({ error: 'Transaction not found' });
      res.json({ message: 'Transaction updated successfully' });
    } else {
      await dbRun(
        db,
        `UPDATE transactions 
         SET date=?, account=?, category=?, subcategory=?, note=?, amount=?, inr=?, currency=?, type=?, description=?
         WHERE id=? AND user_id=?`,
        [date, account, category, subcategory, note, amount, amount, currency, type, description, req.params.id, req.userId]
      );
      res.json({ message: 'Transaction updated successfully' });
    }
  } catch (err) {
    console.error('Error updating transaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete transaction (protected - per user)
app.delete('/api/transactions/:id', verifyToken, async (req, res) => {
  try {
    if (useMongo) {
      const tx = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.userId });
      if (!tx) return res.status(404).json({ error: 'Transaction not found' });
      res.json({ message: 'Transaction deleted successfully' });
    } else {
      await dbRun(db, 'DELETE FROM transactions WHERE id=? AND user_id=?', [req.params.id, req.userId]);
      res.json({ message: 'Transaction deleted successfully' });
    }
  } catch (err) {
    console.error('Error deleting transaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get statistics (protected - per user)
app.get('/api/statistics', verifyToken, async (req, res) => {
  try {
    if (useMongo) {
      const stats = await Transaction.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.userId) } },
        {
          $group: {
            _id: { type: '$type', category: '$category' },
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            type: '$_id.type',
            category: '$_id.category',
            total: 1,
            count: 1
          }
        },
        { $sort: { type: -1, total: -1 } }
      ]);
      res.json(stats);
    } else {
      const rows = await dbAll(
        db,
        `SELECT type, category, SUM(amount) as total, COUNT(*) as count
         FROM transactions WHERE user_id = ?
         GROUP BY type, category ORDER BY type DESC, total DESC`,
        [req.userId]
      );
      res.json(rows);
    }
  } catch (err) {
    console.error('Error fetching statistics:', err);
    res.status(500).json({ error: err.message });
  }
});

// Export to Excel (protected - per user)
app.get('/api/export/excel', verifyToken, async (req, res) => {
  try {
    const processExport = (rows) => {
      const cleanRows = rows.map((r) => {
        const item = r.toJSON ? r.toJSON() : r;
        return {
          date: item.date,
          account: item.account,
          category: item.category,
          subcategory: item.subcategory,
          note: item.note,
          amount: item.amount,
          inr: item.inr,
          currency: item.currency,
          type: item.type,
          description: item.description,
          created_at: item.created_at
        };
      });

      const ws = XLSX.utils.json_to_sheet(cleanRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

      const fileName = `transactions_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      res.send(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
    };

    if (useMongo) {
      const rows = await Transaction.find({ userId: req.userId }).sort({ date: -1 });
      processExport(rows);
    } else {
      const rows = await dbAll(db, 'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC', [req.userId]);
      processExport(rows);
    }
  } catch (err) {
    console.error('Error exporting:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function to convert Excel date serial number to ISO date string
const excelDateToISO = (excelDate) => {
  if (!excelDate) return new Date().toISOString().split('T')[0];

  // If it's already a string in YYYY-MM-DD format, return it
  if (typeof excelDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(excelDate)) {
    return excelDate;
  }

  // If it's an Excel serial number
  const numDate = parseFloat(excelDate);
  if (!isNaN(numDate) && numDate > 0) {
    // Excel date serial starts at 1900-01-01
    const date = new Date((numDate - 25569) * 86400 * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Try to parse as regular date
  try {
    const parsed = new Date(excelDate);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch (e) {
    // Ignore
  }

  return new Date().toISOString().split('T')[0];
};

// Helper function to process row data
const processRowData = (row) => {
  const cleanRow = {};
  for (const key of Object.keys(row)) {
    const cleanKey = key.trim().toLowerCase().replace(/[\s/_-]+/g, '');
    cleanRow[cleanKey] = row[key];
  }

  const rawAmount = cleanRow.amount !== undefined ? cleanRow.amount : 0;
  let amountVal = parseFloat(rawAmount);
  if (isNaN(amountVal)) amountVal = 0;

  const rawInr = cleanRow.inr !== undefined ? cleanRow.inr : rawAmount;
  let inrVal = parseFloat(rawInr);
  if (isNaN(inrVal)) inrVal = amountVal;

  const rawDate = cleanRow.date !== undefined ? cleanRow.date : new Date().toISOString().split('T')[0];
  const resolvedType = cleanRow.incomeexpense || cleanRow.type || 'Expense';

  return {
    date: excelDateToISO(rawDate),
    account: String(cleanRow.account || 'Cash').trim(),
    category: String(cleanRow.category || 'Other').trim(),
    subcategory: String(cleanRow.subcategory || '').trim(),
    note: String(cleanRow.note || '').trim(),
    amount: amountVal,
    inr: inrVal,
    currency: String(cleanRow.currency || 'INR').trim(),
    type: String(resolvedType).trim(),
    description: String(cleanRow.description || '').trim()
  };
};

// Import from Excel (protected - per user)
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/api/import/excel', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ imported: 0, message: 'No file uploaded' });
    }

    console.log('Starting Excel import for user:', req.userId);
    console.log('File size:', req.file.size);

    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } catch (parseError) {
      console.error('Excel parsing error:', parseError);
      return res.status(400).json({ error: 'Invalid Excel file format' });
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return res.status(400).json({ error: 'Excel file has no sheets' });
    }

    const sheetName = workbook.SheetNames[0];
    console.log('Reading sheet:', sheetName);

    let data;
    try {
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } catch (sheetError) {
      console.error('Sheet reading error:', sheetError);
      return res.status(400).json({ error: 'Could not read Excel sheet data' });
    }

    if (data.length === 0) {
      return res.json({ imported: 0, message: 'No data found in Excel file' });
    }

    console.log('Found', data.length, 'rows to import');

    if (useMongo) {
      try {
        const docsToInsert = data.map(row => ({
          ...processRowData(row),
          userId: new mongoose.Types.ObjectId(req.userId)
        }));
        await Transaction.insertMany(docsToInsert);
        console.log('Successfully imported', docsToInsert.length, 'transactions to MongoDB');
        return res.json({ imported: docsToInsert.length, message: `${docsToInsert.length} transactions imported successfully` });
      } catch (mongoError) {
        console.error('MongoDB insertion error:', mongoError);
        return res.status(500).json({ error: 'Database error: ' + mongoError.message });
      }
    } else {
      // SQLite with proper async handling
      try {
        let imported = 0;
        for (const row of data) {
          try {
            const processedRow = processRowData(row);
            await dbRun(
              db,
              `INSERT INTO transactions (user_id, date, account, category, subcategory, note, amount, inr, currency, type, description)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                req.userId,
                processedRow.date,
                processedRow.account,
                processedRow.category,
                processedRow.subcategory,
                processedRow.note,
                processedRow.amount,
                processedRow.inr,
                processedRow.currency,
                processedRow.type,
                processedRow.description
              ]
            );
            imported++;
          } catch (rowError) {
            console.error('Error importing row:', rowError);
            // Continue with next row instead of failing entirely
          }
        }
        console.log('Successfully imported', imported, 'transactions to SQLite');
        return res.json({ imported, message: `${imported} transactions imported successfully` });
      } catch (sqliteError) {
        console.error('SQLite error:', sqliteError);
        return res.status(500).json({ error: 'Database error: ' + sqliteError.message });
      }
    }
  } catch (error) {
    console.error('Unexpected import error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Import failed: ' + errorMessage });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: `Money Manager API is running using ${useMongo ? 'MongoDB' : 'SQLite'}` });
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    requested: `${req.method} ${req.path}`,
    message: 'Please use one of the valid API endpoints. Visit / for more info'
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port} with ${useMongo ? 'MongoDB' : 'SQLite'}`);
});
