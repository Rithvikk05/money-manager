import { connectDB } from '../_lib/db.js';
import { Transaction } from '../_lib/models.js';
import { verifyToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let userId;
  try {
    userId = verifyToken(req);
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }
  await connectDB();

  if (req.method === 'GET') {
    try {
      const transactions = await Transaction.find({ userId }).sort({ date: -1 });
      return res.status(200).json(transactions);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { date, time, account, category, subcategory, note, amount, currency, type, description } = req.body;

      const newTx = await Transaction.create({
        userId,
        date: date ? String(date) : undefined,
        time: time ? String(time) : undefined,
        account: account ? String(account) : undefined,
        category: category ? String(category) : undefined,
        subcategory: subcategory ? String(subcategory) : undefined,
        note: note ? String(note) : undefined,
        amount: Number(amount) || 0,
        currency: currency ? String(currency) : 'INR',
        type: type ? String(type) : undefined,
        description: description ? String(description) : undefined,
        inr: Number(amount) || 0,
      });

      return res.status(201).json({ id: newTx._id, message: 'Transaction added successfully' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
