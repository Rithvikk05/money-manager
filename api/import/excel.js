import { connectDB } from '../_lib/db.js';
import { Transaction } from '../_lib/models.js';
import { verifyToken } from '../_lib/auth.js';
import { handleOptions } from '../_lib/http.js';
import Busboy from 'busboy';
import XLSX from 'xlsx';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing for file upload
  },
};

const excelDateToISO = (excelDate) => {
  if (!excelDate) return new Date().toISOString().split('T')[0];
  if (typeof excelDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(excelDate)) return excelDate;
  const numDate = parseFloat(excelDate);
  if (!isNaN(numDate) && numDate > 0) {
    const date = new Date((numDate - 25569) * 86400 * 1000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  try {
    const parsed = new Date(excelDate);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  } catch (e) {}
  return new Date().toISOString().split('T')[0];
};

const processRowData = (row) => {
  const cleanRow = {};
  for (const key of Object.keys(row)) {
    cleanRow[key.trim().toLowerCase().replace(/[\s/_-]+/g, '')] = row[key];
  }
  const rawAmount = cleanRow.amount !== undefined ? cleanRow.amount : 0;
  let amountVal = parseFloat(rawAmount);
  if (isNaN(amountVal)) amountVal = 0;
  const rawInr = cleanRow.inr !== undefined ? cleanRow.inr : rawAmount;
  let inrVal = parseFloat(rawInr);
  if (isNaN(inrVal)) inrVal = amountVal;
  return {
    date: excelDateToISO(cleanRow.date || new Date().toISOString().split('T')[0]),
    account: String(cleanRow.account || 'Cash').trim(),
    category: String(cleanRow.category || 'Other').trim(),
    subcategory: String(cleanRow.subcategory || '').trim(),
    note: String(cleanRow.note || '').trim(),
    amount: amountVal,
    inr: inrVal,
    currency: String(cleanRow.currency || 'INR').trim(),
    type: String(cleanRow.incomeexpense || cleanRow.type || 'Expense').trim(),
    description: String(cleanRow.description || '').trim(),
  };
};

function parseMultipartFile(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const chunks = [];

    busboy.on('file', (fieldname, file) => {
      file.on('data', (data) => {
        chunks.push(data);
      });
      file.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    busboy.on('error', (err) => {
      reject(err);
    });

    busboy.on('finish', () => {
      if (chunks.length === 0) {
        reject(new Error('No file uploaded'));
      }
    });

    req.pipe(busboy);
  });
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let userId;
  try {
    userId = verifyToken(req);
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }

  await connectDB();

  try {
    const fileBuffer = await parseMultipartFile(req);

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'No data found in the uploaded file' });
    }

    const transactions = rows.map((row) => {
      const processed = processRowData(row);
      return { ...processed, userId };
    });

    const result = await Transaction.insertMany(transactions);

    return res.status(200).json({
      imported: result.length,
      message: `${result.length} transactions imported successfully`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
