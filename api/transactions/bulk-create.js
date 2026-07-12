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
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'Transactions array is required and must not be empty' });
    }

    const txs = transactions.map((tx) => ({
      userId,
      date: tx.date ? String(tx.date) : undefined,
      time: tx.time ? String(tx.time) : undefined,
      account: tx.account ? String(tx.account) : undefined,
      category: tx.category ? String(tx.category) : undefined,
      subcategory: tx.subcategory ? String(tx.subcategory) : undefined,
      note: tx.note ? String(tx.note) : undefined,
      amount: Number(tx.amount) || 0,
      currency: tx.currency ? String(tx.currency) : 'INR',
      type: tx.type ? String(tx.type) : undefined,
      description: tx.description ? String(tx.description) : undefined,
      inr: Number(tx.amount) || 0,
    }));

    await Transaction.insertMany(txs);

    return res.status(201).json({ message: 'Transactions added successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
