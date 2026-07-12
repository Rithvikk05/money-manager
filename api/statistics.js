import { connectDB } from './_lib/db.js';
import { Transaction } from './_lib/models.js';
import { verifyToken } from './_lib/auth.js';
import { handleOptions } from './_lib/http.js';

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
                { $ifNull: ['$description', ''] }
              ]
            }
          }
        }
      },
      { $match: { carryText: { $not: carryRegex } } },
      {
        $group: {
          _id: { type: '$type', category: '$category' },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          type: '$_id.type',
          category: '$_id.category',
          total: 1,
          count: 1
        }
      },
      { $sort: { type: -1, total: -1 } }
    ]);

    return res.status(200).json(stats);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
