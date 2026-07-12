import { connectDB } from '../_lib/db.js';
import { Transaction, DeletedTransaction } from '../_lib/models.js';
import { verifyToken } from '../_lib/auth.js';
import { handleOptions } from '../_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  let userId;
  try {
    userId = verifyToken(req);
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }
  await connectDB();

  const { id } = req.query;

  if (req.method === 'PUT') {
    try {
      const { date, time, account, category, subcategory, note, amount, currency, type, description } = req.body;

      const safeTx = {};
      if (date !== undefined) safeTx.date = String(date);
      if (time !== undefined) safeTx.time = String(time);
      if (account !== undefined) safeTx.account = String(account);
      if (category !== undefined) safeTx.category = String(category);
      if (subcategory !== undefined) safeTx.subcategory = String(subcategory);
      if (note !== undefined) safeTx.note = String(note);
      if (amount !== undefined) { safeTx.amount = Number(amount) || 0; safeTx.inr = Number(amount) || 0; }
      if (currency !== undefined) safeTx.currency = String(currency);
      if (type !== undefined) safeTx.type = String(type);
      if (description !== undefined) safeTx.description = String(description);

      const updated = await Transaction.findOneAndUpdate(
        { _id: id, userId },
        safeTx,
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      return res.status(200).json({ message: 'Transaction updated successfully', transaction: updated });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const transaction = await Transaction.findOne({ _id: id, userId });

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
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

      return res.status(200).json({ message: 'Transaction deleted successfully' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
