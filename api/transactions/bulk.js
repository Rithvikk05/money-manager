import { connectDB } from '../_lib/db.js';
import { Transaction } from '../_lib/models.js';
import { verifyToken } from '../_lib/auth.js';
import { handleOptions } from '../_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'PUT') {
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
    const { transactionIds, updates } = req.body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ error: 'transactionIds array is required and must not be empty' });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'updates object is required' });
    }

    const safeUpdates = {};
    const stringFields = ['date', 'time', 'account', 'category', 'subcategory', 'note', 'currency', 'type', 'description'];

    for (const field of stringFields) {
      if (updates[field] !== undefined && updates[field] !== '') {
        safeUpdates[field] = String(updates[field]);
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    await Transaction.updateMany(
      { _id: { $in: transactionIds }, userId },
      { $set: safeUpdates }
    );

    return res.status(200).json({ message: 'Transactions updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
