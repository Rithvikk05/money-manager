import mongoose from 'mongoose';

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  account: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String, default: '' },
  note: { type: String, default: '' },
  amount: { type: Number, required: true },
  inr: { type: Number },
  currency: { type: String, default: 'INR' },
  type: { type: String, required: true },
  description: { type: String, default: '' },
  time: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
});

transactionSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

// DeletedTransaction Schema
const deletedTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  transactionId: mongoose.Schema.Types.Mixed,
  date: { type: String, required: true },
  account: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String, default: '' },
  note: { type: String, default: '' },
  amount: { type: Number, required: true },
  inr: { type: Number },
  currency: { type: String, default: 'INR' },
  type: { type: String, required: true },
  description: { type: String, default: '' },
  time: { type: String, default: '' },
  deleted_at: { type: Date, default: Date.now },
  original_created_at: { type: Date },
});

deletedTransactionSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});

userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
  },
});

// Use existing models if already registered (serverless re-invocation safety)
export const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
export const DeletedTransaction = mongoose.models.DeletedTransaction || mongoose.model('DeletedTransaction', deletedTransactionSchema);
export const User = mongoose.models.User || mongoose.model('User', userSchema);
