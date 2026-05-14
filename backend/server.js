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

// Define Mongoose Schema & Model
const transactionSchema = new mongoose.Schema({
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
const dbGet = (db, sql, params) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Promise wrapper for SQLite db.run
const dbRun = (db, sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
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
      try {
        const existingUser = await dbGet(
          db,
          'SELECT * FROM users WHERE username = ? OR email = ?',
          [username.toLowerCase(), email.toLowerCase()]
        );

        if (existingUser) {
          return res.status(400).json({ error: 'Username or email already exists' });
        }

        const hashedPassword = await hashPassword(password);

        await dbRun(
          db,
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          [username.toLowerCase(), email.toLowerCase(), hashedPassword]
        );

        const newUser = await dbGet(
          db,
          'SELECT id, username, email FROM users WHERE username = ?',
          [username.toLowerCase()]
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
      } catch (error) {
        console.error('Registration error (SQLite):', error);
        res.status(500).json({ error: error.message });
      }
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
      try {
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
      } catch (error) {
        console.error('Login error (SQLite):', error);
        res.status(500).json({ error: error.message });
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all transactions
app.get('/api/transactions', async (req, res) => {
  if (useMongo) {
    try {
      const transactions = await Transaction.find().sort({ date: -1 });
      res.json(transactions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    db.all('SELECT * FROM transactions ORDER BY date DESC', [], (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows || []);
      }
    });
  }
});

// Add transaction
app.post('/api/transactions', async (req, res) => {
  const { date, account, category, subcategory, note, amount, currency, type, description } = req.body;
  console.log('POST /api/transactions body:', { date, account, category, subcategory, note, amount, currency, type, description });
  
  if (useMongo) {
    try {
      const newTx = new Transaction({
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
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    db.run(
      `INSERT INTO transactions (date, account, category, subcategory, note, amount, inr, currency, type, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [date, account, category, subcategory, note, amount, amount, currency, type, description],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ id: this.lastID, message: 'Transaction added successfully' });
        }
      }
    );
  }
});

// Update transaction
app.put('/api/transactions/:id', async (req, res) => {
  const { date, account, category, subcategory, note, amount, currency, type, description } = req.body;
  
  if (useMongo) {
    try {
      await Transaction.findByIdAndUpdate(req.params.id, {
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
      res.json({ message: 'Transaction updated successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    db.run(
      `UPDATE transactions 
       SET date=?, account=?, category=?, subcategory=?, note=?, amount=?, inr=?, currency=?, type=?, description=?
       WHERE id=?`,
      [date, account, category, subcategory, note, amount, amount, currency, type, description, req.params.id],
      (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ message: 'Transaction updated successfully' });
        }
      }
    );
  }
});

// Delete transaction
app.delete('/api/transactions/:id', async (req, res) => {
  if (useMongo) {
    try {
      await Transaction.findByIdAndDelete(req.params.id);
      res.json({ message: 'Transaction deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    db.run('DELETE FROM transactions WHERE id=?', [req.params.id], (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ message: 'Transaction deleted successfully' });
      }
    });
  }
});

// Get statistics
app.get('/api/statistics', async (req, res) => {
  if (useMongo) {
    try {
      const stats = await Transaction.aggregate([
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
        {
          $sort: { type: -1, total: -1 }
        }
      ]);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    db.all(
      `SELECT 
        type,
        category,
        SUM(amount) as total,
        COUNT(*) as count
       FROM transactions
       GROUP BY type, category
       ORDER BY type DESC, total DESC`,
      [],
      (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json(rows || []);
        }
      }
    );
  }
});

// Export to Excel
app.get('/api/export/excel', async (req, res) => {
  const processExport = (rows) => {
    // Map objects to regular JS objects if they are Mongoose documents
    const cleanRows = rows.map((r) => {
      const item = r.toJSON ? r.toJSON() : r;
      return {
        id: item.id,
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
    try {
      const rows = await Transaction.find().sort({ date: -1 });
      processExport(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    db.all('SELECT * FROM transactions ORDER BY date DESC', [], (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        processExport(rows || []);
      }
    });
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

// Import from Excel
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/api/import/excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ imported: 0, message: 'No file uploaded' });
    }

    console.log('Starting Excel import...');
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
        const docsToInsert = data.map(row => processRowData(row));
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
              `INSERT INTO transactions (date, account, category, subcategory, note, amount, inr, currency, type, description)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
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
    message: 'Please use one of the valid API endpoints. Visit http://localhost:5000 for more info'
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port} with ${useMongo ? 'MongoDB' : 'SQLite'}`);
});
