import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import multer from 'multer';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'money_manager.db'), (err) => {
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

// Routes

// Get all transactions
app.get('/api/transactions', (req, res) => {
  db.all('SELECT * FROM transactions ORDER BY date DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

// Add transaction
app.post('/api/transactions', (req, res) => {
  const { date, account, category, subcategory, note, amount, currency, type, description } = req.body;
  
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
});

// Update transaction
app.put('/api/transactions/:id', (req, res) => {
  const { date, account, category, subcategory, note, amount, currency, type, description } = req.body;
  
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
});

// Delete transaction
app.delete('/api/transactions/:id', (req, res) => {
  db.run('DELETE FROM transactions WHERE id=?', [req.params.id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ message: 'Transaction deleted successfully' });
    }
  });
});

// Get statistics
app.get('/api/statistics', (req, res) => {
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
});

// Export to Excel
app.get('/api/export/excel', (req, res) => {
  db.all('SELECT * FROM transactions ORDER BY date DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
      
      const fileName = `transactions_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      res.send(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
    }
  });
});

// Import from Excel
const upload = multer({ dest: 'uploads/' });
app.post('/api/import/excel', upload.single('file'), (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    let imported = 0;
    data.forEach((row) => {
      db.run(
        `INSERT INTO transactions (date, account, category, subcategory, note, amount, inr, currency, type, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.Date || row.date,
          row.Account || row.account,
          row.Category || row.category,
          row.Subcategory || row.subcategory,
          row.Note || row.note,
          row.Amount || row.amount,
          row.INR || row.inr || row.Amount || row.amount,
          row.Currency || row.currency || 'INR',
          row['Income/Expense'] || row.type || 'Expense',
          row.Description || row.description
        ],
        (err) => {
          if (!err) imported++;
        }
      );
    });
    
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('File deletion error:', err);
    });
    
    res.json({ imported, message: `${imported} transactions imported successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Money Manager API is running' });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
