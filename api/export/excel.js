import { connectDB } from '../_lib/db.js';
import { Transaction } from '../_lib/models.js';
import { verifyToken } from '../_lib/auth.js';
import { handleOptions } from '../_lib/http.js';
import XLSX from 'xlsx';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
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
    const transactions = await Transaction.find({ userId }).sort({ date: -1 });

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
    return res.status(500).json({ error: err.message });
  }
}
