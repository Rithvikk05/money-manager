import Busboy from 'busboy';
import XLSX from 'xlsx';
import { connectDB } from './_lib/db.js';
import { Transaction, DeletedTransaction, User } from './_lib/models.js';
import { generateToken, hashPassword, comparePassword, verifyToken } from './_lib/auth.js';
import { handleOptions } from './_lib/http.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function getRouteParts(req) {
  const requestUrl = req.url || '/';

  try {
    const parsedUrl = new URL(requestUrl, 'http://localhost');
    const pathname = parsedUrl.pathname || '/';

    if (pathname === '/api' || pathname === '/api/') {
      return [];
    }

    if (pathname.startsWith('/api/')) {
      return pathname.slice('/api/'.length).split('/').filter(Boolean);
    }
  } catch {
    // Fall through to req.query below.
  }

  const { path } = req.query || {};

  if (Array.isArray(path)) {
    return path.filter(Boolean);
  }

  if (typeof path === 'string' && path) {
    return [path];
  }

  return [];
}

function sendJson(res, statusCode, payload) {
  return res.status(statusCode).json(payload);
}

async function getJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  return await new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += chunk;
    });

    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

function parseMultipartFile(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const chunks = [];
    let fileFound = false;

    busboy.on('file', (fieldname, file) => {
      fileFound = true;

      file.on('data', (data) => {
        chunks.push(data);
      });

      file.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    busboy.on('error', reject);

    busboy.on('finish', () => {
      if (!fileFound) {
        reject(new Error('No file uploaded'));
      }
    });

    req.pipe(busboy);
  });
}

function requireUserId(req, res) {
  try {
    return verifyToken(req);
  } catch (err) {
    sendJson(res, 401, { error: err.message });
    return null;
  }
}

function toStringOrUndefined(value) {
  return value === undefined || value === null ? undefined : String(value);
}

function toSafeTransactionInput(input = {}) {
  const safeTx = {};

  if (input.date !== undefined) safeTx.date = toStringOrUndefined(input.date);
  if (input.time !== undefined) safeTx.time = toStringOrUndefined(input.time);
  if (input.account !== undefined) safeTx.account = toStringOrUndefined(input.account);
  if (input.category !== undefined) safeTx.category = toStringOrUndefined(input.category);
  if (input.subcategory !== undefined) safeTx.subcategory = toStringOrUndefined(input.subcategory);
  if (input.note !== undefined) safeTx.note = toStringOrUndefined(input.note);
  if (input.amount !== undefined) {
    safeTx.amount = Number(input.amount) || 0;
    safeTx.inr = Number(input.amount) || 0;
  }
  if (input.currency !== undefined) safeTx.currency = toStringOrUndefined(input.currency);
  if (input.type !== undefined) safeTx.type = toStringOrUndefined(input.type);
  if (input.description !== undefined) safeTx.description = toStringOrUndefined(input.description);

  return safeTx;
}

async function handleHealth(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  return sendJson(res, 200, { status: 'OK', message: 'Money Manager API is running on Vercel with MongoDB' });
}

async function handleLogin(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { username, password } = await getJsonBody(req);

    if (!username || !password) {
      return sendJson(res, 400, { error: 'Username and password are required' });
    }

    await connectDB();

    const user = await User.findOne({ username: String(username).toLowerCase() });
    if (!user) {
      return sendJson(res, 401, { error: 'Invalid username or password' });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return sendJson(res, 401, { error: 'Invalid username or password' });
    }

    const token = generateToken(user._id, user.username);

    return sendJson(res, 200, {
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return sendJson(res, 500, { error: 'Server error during login' });
  }
}

async function handleRegister(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { username, email, password, confirmPassword } = await getJsonBody(req);

    if (!username || !email || !password || !confirmPassword) {
      return sendJson(res, 400, { error: 'All fields are required' });
    }

    if (password.length < 6) {
      return sendJson(res, 400, { error: 'Password must be at least 6 characters long' });
    }

    if (password !== confirmPassword) {
      return sendJson(res, 400, { error: 'Passwords do not match' });
    }

    await connectDB();

    const lowerUsername = String(username).toLowerCase();
    const lowerEmail = String(email).toLowerCase();
    const existingUser = await User.findOne({
      $or: [{ username: lowerUsername }, { email: lowerEmail }],
    });

    if (existingUser) {
      if (existingUser.username === lowerUsername) {
        return sendJson(res, 400, { error: 'Username already exists' });
      }

      return sendJson(res, 400, { error: 'Email already exists' });
    }

    const hashedPassword = await hashPassword(password);
    const user = await User.create({
      username: lowerUsername,
      email: lowerEmail,
      password: hashedPassword,
    });

    const token = generateToken(user._id, user.username);

    return sendJson(res, 201, {
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return sendJson(res, 500, { error: 'Server error during registration' });
  }
}

async function handleStatistics(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  await connectDB();

  try {
    const mongoose = (await import('mongoose')).default;

    const carryRegex = /(brought\s+down|b[\/\.\-]?d|balance\s+b|balance\s+brought|carried\s+(forward|down)|c[\/\.\-]?(f|d)|balance\s+c|balance\s+carried)/i;

    const stats = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $addFields: {
          carryText: {
            $toLower: {
              $concat: [
                { $ifNull: ['$category', ''] },
                ' ',
                { $ifNull: ['$note', ''] },
                ' ',
                { $ifNull: ['$description', ''] },
              ],
            },
          },
        },
      },
      { $match: { carryText: { $not: carryRegex } } },
      {
        $group: {
          _id: { type: '$type', category: '$category' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          type: '$_id.type',
          category: '$_id.category',
          total: 1,
          count: 1,
        },
      },
      { $sort: { type: -1, total: -1 } },
    ]);

    return sendJson(res, 200, stats);
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}

async function handleTransactions(req, res) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  await connectDB();

  if (req.method === 'GET') {
    try {
      const transactions = await Transaction.find({ userId }).sort({ date: -1 });
      return sendJson(res, 200, transactions);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await getJsonBody(req);
      const newTx = await Transaction.create({
        userId,
        ...toSafeTransactionInput(body),
      });

      return sendJson(res, 201, { id: newTx._id, message: 'Transaction added successfully' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}

async function handleTransactionById(req, res, id) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  await connectDB();

  if (req.method === 'PUT') {
    try {
      const body = await getJsonBody(req);
      const updated = await Transaction.findOneAndUpdate(
        { _id: id, userId },
        toSafeTransactionInput(body),
        { new: true }
      );

      if (!updated) {
        return sendJson(res, 404, { error: 'Transaction not found' });
      }

      return sendJson(res, 200, { message: 'Transaction updated successfully', transaction: updated });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const transaction = await Transaction.findOne({ _id: id, userId });

      if (!transaction) {
        return sendJson(res, 404, { error: 'Transaction not found' });
      }

      await DeletedTransaction.create({
        userId,
        transactionId: transaction._id,
        date: transaction.date,
        account: transaction.account,
        category: transaction.category,
        subcategory: transaction.subcategory,
        note: transaction.note,
        amount: transaction.amount,
        inr: transaction.inr,
        currency: transaction.currency,
        type: transaction.type,
        description: transaction.description,
        time: transaction.time,
        original_created_at: transaction.created_at,
      });

      await Transaction.deleteOne({ _id: id, userId });

      return sendJson(res, 200, { message: 'Transaction deleted successfully' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}

async function handleTransactionsBulk(req, res) {
  if (req.method !== 'PUT') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  await connectDB();

  try {
    const body = await getJsonBody(req);
    const { transactionIds, updates } = body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return sendJson(res, 400, { error: 'transactionIds array is required and must not be empty' });
    }

    if (!updates || typeof updates !== 'object') {
      return sendJson(res, 400, { error: 'updates object is required' });
    }

    const safeUpdates = {};
    const stringFields = ['date', 'time', 'account', 'category', 'subcategory', 'note', 'currency', 'type', 'description'];

    for (const field of stringFields) {
      if (updates[field] !== undefined && updates[field] !== '') {
        safeUpdates[field] = String(updates[field]);
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return sendJson(res, 400, { error: 'No valid fields to update' });
    }

    await Transaction.updateMany(
      { _id: { $in: transactionIds }, userId },
      { $set: safeUpdates }
    );

    return sendJson(res, 200, { message: 'Transactions updated successfully' });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}

async function handleTransactionsBulkCreate(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  await connectDB();

  try {
    const body = await getJsonBody(req);
    const { transactions } = body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return sendJson(res, 400, { error: 'Transactions array is required and must not be empty' });
    }

    const txs = transactions.map((tx) => ({
      userId,
      ...toSafeTransactionInput(tx),
    }));

    await Transaction.insertMany(txs);

    return sendJson(res, 201, { message: 'Transactions added successfully' });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}

async function handleTransactionsBulkDelete(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  await connectDB();

  try {
    const body = await getJsonBody(req);
    const { transactionIds, hardDelete } = body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return sendJson(res, 400, { error: 'transactionIds array is required and must not be empty' });
    }

    if (hardDelete) {
      await Transaction.deleteMany({ _id: { $in: transactionIds }, userId });
    } else {
      const transactions = await Transaction.find({ _id: { $in: transactionIds }, userId });

      if (transactions.length > 0) {
        const deletedEntries = transactions.map((tx) => {
          const txObj = tx.toObject();
          return {
            ...txObj,
            _id: undefined,
            original_created_at: txObj.createdAt || txObj.created_at || new Date(),
          };
        });

        await DeletedTransaction.insertMany(deletedEntries);
      }

      await Transaction.deleteMany({ _id: { $in: transactionIds }, userId });
    }

    return sendJson(res, 200, { message: 'Transactions deleted successfully' });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}

async function handleDeletedTransactions(req, res) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  await connectDB();

  if (req.method === 'GET') {
    try {
      const deletedTransactions = await DeletedTransaction.find({ userId }).sort({ deleted_at: -1 });
      return sendJson(res, 200, deletedTransactions);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}

async function handleDeletedTransactionById(req, res, id) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  await connectDB();

  if (req.method === 'DELETE') {
    try {
      const existing = await DeletedTransaction.findOne({ _id: id, userId });
      if (!existing) {
        return sendJson(res, 404, { error: 'Deleted transaction not found' });
      }

      await DeletedTransaction.findOneAndDelete({ _id: id, userId });
      return sendJson(res, 200, { message: 'Transaction permanently deleted' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}

async function handleRestoreDeletedTransaction(req, res, id) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  await connectDB();

  if (req.method === 'POST') {
    try {
      const deletedTx = await DeletedTransaction.findOne({ _id: id, userId });
      if (!deletedTx) {
        return sendJson(res, 404, { error: 'Deleted transaction not found' });
      }

      await Transaction.create({
        userId: deletedTx.userId,
        date: deletedTx.date,
        account: deletedTx.account,
        category: deletedTx.category,
        subcategory: deletedTx.subcategory,
        note: deletedTx.note,
        amount: deletedTx.amount,
        inr: deletedTx.inr,
        currency: deletedTx.currency,
        type: deletedTx.type,
        description: deletedTx.description,
        time: deletedTx.time,
        created_at: deletedTx.original_created_at,
      });

      await DeletedTransaction.findOneAndDelete({ _id: id, userId });

      return sendJson(res, 200, { message: 'Transaction restored successfully' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}

async function handleExportExcel(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  await connectDB();

  try {
    const { category } = req.query || {};
    const query = { userId };
    if (category && category !== 'All') {
      query.category = category;
    }
    const transactions = await Transaction.find(query).sort({ date: -1 });

    const rows = transactions.map((tx) => ({
      date: tx.date,
      account: tx.account,
      category: tx.category,
      subcategory: tx.subcategory,
      note: tx.note,
      amount: tx.amount,
      inr: tx.inr,
      currency: tx.currency,
      type: tx.type,
      description: tx.description,
      time: tx.time,
      created_at: tx.created_at,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="transactions.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.status(200).send(buffer);
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}

async function handleImportExcel(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  await connectDB();

  try {
    const fileBuffer = await parseMultipartFile(req);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    if (!rows || rows.length === 0) {
      return sendJson(res, 400, { error: 'No data found in the uploaded file' });
    }

    const excelDateToISO = (excelDate) => {
      if (!excelDate) return new Date().toISOString().split('T')[0];
      if (typeof excelDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(excelDate)) return excelDate;
      const numDate = parseFloat(excelDate);
      if (!Number.isNaN(numDate) && numDate > 0) {
        const date = new Date((numDate - 25569) * 86400 * 1000);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }

      try {
        const parsed = new Date(excelDate);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
      } catch {}

      return new Date().toISOString().split('T')[0];
    };

    const processRowData = (row) => {
      const cleanRow = {};
      for (const key of Object.keys(row)) {
        cleanRow[key.trim().toLowerCase().replace(/[\s/_-]+/g, '')] = row[key];
      }

      const rawAmount = cleanRow.amount !== undefined ? cleanRow.amount : 0;
      let amountVal = parseFloat(rawAmount);
      if (Number.isNaN(amountVal)) amountVal = 0;

      const rawInr = cleanRow.inr !== undefined ? cleanRow.inr : rawAmount;
      let inrVal = parseFloat(rawInr);
      if (Number.isNaN(inrVal)) inrVal = amountVal;

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

    const transactions = rows.map((row) => ({
      userId,
      ...processRowData(row),
    }));

    const result = await Transaction.insertMany(transactions);

    return sendJson(res, 200, {
      imported: result.length,
      message: `${result.length} transactions imported successfully`,
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  const routeParts = getRouteParts(req);
  const [section, action, detail] = routeParts;

  if (routeParts.length === 0 || section === 'health') {
    return handleHealth(req, res);
  }

  if (section === 'auth' && action === 'login') {
    return handleLogin(req, res);
  }

  if (section === 'auth' && action === 'register') {
    return handleRegister(req, res);
  }

  if (section === 'statistics') {
    return handleStatistics(req, res);
  }

  if (section === 'transactions' && !action) {
    return handleTransactions(req, res);
  }

  if (section === 'transactions' && action === 'bulk') {
    return handleTransactionsBulk(req, res);
  }

  if (section === 'transactions' && action === 'bulk-create') {
    return handleTransactionsBulkCreate(req, res);
  }

  if (section === 'transactions' && action === 'bulk-delete') {
    return handleTransactionsBulkDelete(req, res);
  }

  if (section === 'transactions' && action) {
    return handleTransactionById(req, res, action);
  }

  if (section === 'deleted-transactions' && !action) {
    return handleDeletedTransactions(req, res);
  }

  if (section === 'deleted-transactions' && action && detail === 'restore') {
    return handleRestoreDeletedTransaction(req, res, action);
  }

  if (section === 'deleted-transactions' && action) {
    return handleDeletedTransactionById(req, res, action);
  }

  if (section === 'export' && action === 'excel') {
    return handleExportExcel(req, res);
  }

  if (section === 'import' && action === 'excel') {
    return handleImportExcel(req, res);
  }

  return sendJson(res, 404, { error: 'Not found' });
}