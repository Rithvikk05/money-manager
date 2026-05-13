import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
    },
    account: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    subcategory: {
      type: String,
      default: '',
    },
    note: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      required: true,
    },
    inr: {
      type: Number,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    type: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
