import { connectDB } from '../../_lib/db.js';
import { Transaction, DeletedTransaction } from '../../_lib/models.js';
import { verifyToken } from '../../_lib/auth.js';

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
    const { id } = req.query;

    const deletedTx = await DeletedTransaction.findOne({ _id: id, userId });
    if (!deletedTx) {
      return res.status(404).json({ error: 'Deleted transaction not found' });
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

    return res.status(200).json({ message: 'Transaction restored successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
