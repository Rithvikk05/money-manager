import { connectDB } from '../_lib/db.js';
import { Transaction, DeletedTransaction } from '../_lib/models.js';
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
    const { transactionIds, hardDelete } = req.body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ error: 'transactionIds array is required and must not be empty' });
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

    return res.status(200).json({ message: 'Transactions deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
