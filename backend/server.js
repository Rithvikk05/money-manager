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

let db;

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

// Routes

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

// Import from Excel
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/api/import/excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ imported: 0, message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let imported = 0;
    let completed = 0;

    if (data.length === 0) {
      return res.json({ imported: 0, message: 'No data found in Excel file' });
    }

    if (useMongo) {
      const docsToInsert = data.map((row) => {
        const amountVal = parseFloat(row.Amount || row.amount || 0);
        return {
          date: excelDateToISO(row.Date || row.date),
          account: row.Account || row.account || 'Cash',
          category: row.Category || row.category || 'Other',
          subcategory: row.Subcategory || row.subcategory || '',
          note: row.Note || row.note || '',
          amount: amountVal,
          inr: parseFloat(row.INR || row.inr || row.Amount || row.amount || 0),
          currency: row.Currency || row.currency || 'INR',
          type: row['Income/Expense'] || row.type || 'Expense',
          description: row.Description || row.description || ''
        };
      });

      await Transaction.insertMany(docsToInsert);
      imported = docsToInsert.length;

      return res.json({ imported, message: `${imported} transactions imported successfully` });
    } else {
      data.forEach((row, index) => {
        db.run(
          `INSERT INTO transactions (date, account, category, subcategory, note, amount, inr, currency, type, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            excelDateToISO(row.Date || row.date),
            row.Account || row.account || 'Cash',
            row.Category || row.category || 'Other',
            row.Subcategory || row.subcategory || '',
            row.Note || row.note || '',
            parseFloat(row.Amount || row.amount || 0),
            parseFloat(row.INR || row.inr || row.Amount || row.amount || 0),
            row.Currency || row.currency || 'INR',
            row['Income/Expense'] || row.type || 'Expense',
            row.Description || row.description || ''
          ],
          (err) => {
            if (!err) imported++;
            completed++;

            // Send response after all operations complete
            if (completed === data.length) {
              res.json({ imported, message: `${imported} transactions imported successfully` });
            }
          }
        );
      });
    }
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: `Money Manager API is running using ${useMongo ? 'MongoDB' : 'SQLite'}` });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port} with ${useMongo ? 'MongoDB' : 'SQLite'}`);
});
