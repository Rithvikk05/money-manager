import { useState, useEffect } from 'react'

const ACCOUNTS = {
  'Cash': ['Cash'],
  'Card': ['🏦 Kotak Bank', '🏦 Union Bank', '🏦 Other Bank']
}

const CATEGORIES = [
  '🍜 Food',
  '🚖 Transport',
  '🧘🏼 Health',
  '🪑 Household',
  '💼 Office Work',
  '🎉 Entertainment',
  '📚 Education',
  '🛒 Shopping',
  '💊 Medicine',
  '🏠 Rent',
  '⚡ Utilities',
  'Other',
]
const TYPES = ['Income', 'Expense', 'Transfer-Out', 'Transfer-In']

export default function TransactionForm({ onSubmit, editData, onCancel, initialData }) {
  const defaultData = {
    date: new Date().toISOString().split('T')[0],
    accountType: '',
    account: '',
    category: '',
    customCategory: '',
    note: '',
    amount: '',
    currency: 'INR',
    type: 'Expense',
    description: '',
  }

  const [formData, setFormData] = useState(editData || (initialData ? { ...defaultData, ...initialData } : defaultData))

  const [errors, setErrors] = useState({})
  const [useCustomCategory, setUseCustomCategory] = useState(false)

  // Update form when editData or initialData change
  useEffect(() => {
    if (editData) setFormData(editData)
    else if (initialData) setFormData((prev) => ({ ...defaultData, ...initialData }))
  }, [editData, initialData])

  const validateForm = () => {
    const newErrors = {}
    if (!formData.date) newErrors.date = 'Date is required'
    if (!formData.accountType) newErrors.accountType = 'Account Type is required'
    if (!formData.account) newErrors.account = 'Account is required'
    if (!formData.category && !useCustomCategory) newErrors.category = 'Category is required'
    if (useCustomCategory && !formData.customCategory) newErrors.customCategory = 'Custom category is required'
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

  const handleAccountTypeChange = (e) => {
    const { value } = e.target
    setFormData((prev) => ({
      ...prev,
      accountType: value,
      account: value === 'Cash' ? 'Cash' : '',
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validateForm()) {
      const finalData = {
        ...formData,
        category: useCustomCategory ? formData.customCategory : formData.category,
      }
      onSubmit(finalData)
      setFormData(initialData ? { ...defaultData, ...initialData } : defaultData)
      setUseCustomCategory(false)
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

            {/* Account Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Account Type</label>
              <select
                name="accountType"
                value={formData.accountType}
                onChange={handleAccountTypeChange}
                className="input-field"
              >
                <option value="">Select Type</option>
                {Object.keys(ACCOUNTS).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {errors.accountType && <p className="text-red-500 text-sm mt-1">{errors.accountType}</p>}
            </div>

            {/* Account */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Account</label>
              {formData.accountType === 'Cash' ? (
                <input type="text" readOnly value="Cash" className="input-field bg-gray-100" />
              ) : (
                <select
                  name="account"
                  value={formData.account}
                  onChange={handleChange}
                  disabled={!formData.accountType}
                  className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select Account</option>
                  {formData.accountType && ACCOUNTS[formData.accountType].map((acc) => (
                    <option key={acc} value={acc}>
                      {acc}
                    </option>
                  ))}
                </select>
              )}
              {errors.account && <p className="text-red-500 text-sm mt-1">{errors.account}</p>}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
              {!useCustomCategory ? (
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
              ) : (
                <input
                  type="text"
                  name="customCategory"
                  value={formData.customCategory}
                  onChange={handleChange}
                  placeholder="Enter custom category..."
                  className="input-field"
                />
              )}
              <button
                type="button"
                onClick={() => setUseCustomCategory(!useCustomCategory)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-semibold"
              >
                {useCustomCategory ? '📋 Use Predefined' : '✏️ Add Custom'}
              </button>
              {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category}</p>}
              {errors.customCategory && <p className="text-red-500 text-sm mt-1">{errors.customCategory}</p>}
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
