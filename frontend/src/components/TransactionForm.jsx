import { useState } from 'react'

const ACCOUNTS = ['Accounts', 'Cash', 'Card']
const CATEGORIES = [
  '🍜 Food',
  '🚖 Transport',
  '🧘🏼 Health',
  '🪑 Household',
  'Office Work',
  'Other',
  'Cash',
]
const TYPES = ['Income', 'Expense', 'Transfer-Out', 'Transfer-In']

export default function TransactionForm({ onSubmit, editData, onCancel }) {
  const [formData, setFormData] = useState(
    editData || {
      date: new Date().toISOString().split('T')[0],
      account: '',
      category: '',
      subcategory: '',
      note: '',
      amount: '',
      currency: 'INR',
      type: 'Expense',
      description: '',
    }
  )

  const [errors, setErrors] = useState({})

  const validateForm = () => {
    const newErrors = {}
    if (!formData.date) newErrors.date = 'Date is required'
    if (!formData.account) newErrors.account = 'Account is required'
    if (!formData.category) newErrors.category = 'Category is required'
    if (!formData.amount || formData.amount <= 0) newErrors.amount = 'Amount must be greater than 0'
    if (!formData.type) newErrors.type = 'Type is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validateForm()) {
      onSubmit(formData)
      setFormData({
        date: new Date().toISOString().split('T')[0],
        account: '',
        category: '',
        subcategory: '',
        note: '',
        amount: '',
        currency: 'INR',
        type: 'Expense',
        description: '',
      })
      alert(editData ? 'Transaction updated!' : 'Transaction added successfully!')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {editData ? '✏️ Edit Transaction' : '➕ Add New Transaction'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="input-field"
              />
              {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
              <select name="type" value={formData.type} onChange={handleChange} className="input-field">
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type}</p>}
            </div>

            {/* Account */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Account</label>
              <select
                name="account"
                value={formData.account}
                onChange={handleChange}
                className="input-field"
              >
                <option value="">Select Account</option>
                {ACCOUNTS.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
              {errors.account && <p className="text-red-500 text-sm mt-1">{errors.account}</p>}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="input-field"
              >
                <option value="">Select Category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category}</p>}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                className="input-field"
              />
              {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Currency</label>
              <input
                type="text"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="input-field"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Note / Description</label>
            <input
              type="text"
              name="note"
              value={formData.note}
              onChange={handleChange}
              placeholder="e.g., Petrol, Lunch, etc."
              className="input-field"
            />
          </div>

          {/* Full Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Details</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Additional details..."
              rows="3"
              className="input-field"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-4">
            <button type="submit" className="btn-primary flex-1">
              {editData ? '💾 Update Transaction' : '➕ Add Transaction'}
            </button>
            {editData && (
              <button type="button" onClick={onCancel} className="btn-secondary flex-1">
                ❌ Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
