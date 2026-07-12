import { connectDB } from '../_lib/db.js';
import { DeletedTransaction } from '../_lib/models.js';
import { verifyToken } from '../_lib/auth.js';
import { handleOptions } from '../_lib/http.js';

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
    const deletedTransactions = await DeletedTransaction.find({ userId }).sort({ deleted_at: -1 });
    return res.status(200).json(deletedTransactions);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
