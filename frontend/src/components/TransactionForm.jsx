import { useState, useEffect } from 'react'

const ACCOUNTS = {
  'Cash': ['Cash'],
  'Bank (Card)': ['🏦 Kotak Bank', '🏦 Union Bank', '🏦 Other Bank']
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

// Derive accountType from a saved account value
const deriveAccountType = (account) => {
  if (!account) return ''
  if (account === 'Cash') return 'Cash'
  // Check if the account belongs to a Bank (Card) account
  if (ACCOUNTS['Bank (Card)'].includes(account)) return 'Bank (Card)'
  // Legacy support: check old 'Card' key name
  if (account.includes('Bank') || account.includes('🏦')) return 'Bank (Card)'
  return ''
}

export default function TransactionForm({ onSubmit, editData, onCancel, initialData, onDelete }) {
  const defaultData = {
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
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

  // Determine initial accountType from editData
  const buildInitialFormData = () => {
    if (editData) {
      return {
        ...editData,
        accountType: editData.accountType || deriveAccountType(editData.account),
      }
    }
    if (initialData) {
      return { ...defaultData, ...initialData }
    }
    return defaultData
  }

  const [formData, setFormData] = useState(buildInitialFormData)
  const [errors, setErrors] = useState({})
  const [useCustomCategory, setUseCustomCategory] = useState(false)
  const [showTransferMode, setShowTransferMode] = useState(false)
  const [transferDirection, setTransferDirection] = useState('bank-to-cash') // 'bank-to-cash', 'cash-to-bank', or 'bank-to-bank'
  const [transferFromAccount, setTransferFromAccount] = useState('')
  const [transferToAccount, setTransferToAccount] = useState('') // For bank-to-bank
  const [showTypeInfo, setShowTypeInfo] = useState(false)

  // Update form when editData or initialData change
  useEffect(() => {
    if (editData) {
      setFormData({
        ...editData,
        accountType: editData.accountType || deriveAccountType(editData.account),
      })
    } else if (initialData) {
      setFormData((prev) => ({ ...defaultData, ...initialData }))
    }
  }, [editData, initialData])

  const validateForm = () => {
    const newErrors = {}
    if (showTransferMode) {
      if (!formData.amount || formData.amount <= 0) newErrors.amount = 'Amount must be greater than 0'
      if (transferDirection === 'bank-to-cash' && !transferFromAccount) newErrors.transferFrom = 'Select a bank account'
      if (transferDirection === 'cash-to-bank' && !transferFromAccount) newErrors.transferFrom = 'Select a bank account'
      if (transferDirection === 'bank-to-bank') {
        if (!transferFromAccount) newErrors.transferFrom = 'Select source bank account'
        if (!transferToAccount) newErrors.transferTo = 'Select destination bank account'
        if (transferFromAccount && transferToAccount && transferFromAccount === transferToAccount) {
          newErrors.transferTo = 'Source and destination must be different'
        }
      }
    } else {
      if (!formData.date) newErrors.date = 'Date is required'
      if (!formData.accountType) newErrors.accountType = 'Account Type is required'
      if (!formData.account) newErrors.account = 'Account is required'
      if (!formData.category && !useCustomCategory) newErrors.category = 'Category is required'
      if (useCustomCategory && !formData.customCategory) newErrors.customCategory = 'Custom category is required'
      if (!formData.amount || formData.amount <= 0) newErrors.amount = 'Amount must be greater than 0'
      if (!formData.type) newErrors.type = 'Type is required'
    }
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

  const handleTransferSubmit = (e) => {
    e.preventDefault()
    if (!validateForm()) return

    const amount = parseFloat(formData.amount)
    const date = formData.date || new Date().toISOString().split('T')[0]
    const time = formData.time || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const directionLabel = transferDirection === 'bank-to-cash' ? 'Bank → Cash' 
      : transferDirection === 'cash-to-bank' ? 'Cash → Bank' 
      : `${transferFromAccount} → ${transferToAccount}`
    const note = formData.note || `Transfer ${directionLabel}`

    if (transferDirection === 'bank-to-cash') {
      // Transfer-Out from Bank
      onSubmit({
        date,
        accountType: 'Bank (Card)',
        account: transferFromAccount,
        category: '🔄 Transfer',
        note,
        amount,
        currency: formData.currency || 'INR',
        type: 'Transfer-Out',
        description: `Withdrawal: ${transferFromAccount} → Cash`,
        time,
      })
      // Transfer-In to Cash
      setTimeout(() => {
        onSubmit({
          date,
          accountType: 'Cash',
          account: 'Cash',
          category: '🔄 Transfer',
          note,
          amount,
          currency: formData.currency || 'INR',
          type: 'Transfer-In',
          description: `Deposit: ${transferFromAccount} → Cash`,
          time,
        })
      }, 300)
    } else if (transferDirection === 'cash-to-bank') {
      // Transfer-Out from Cash
      onSubmit({
        date,
        accountType: 'Cash',
        account: 'Cash',
        category: '🔄 Transfer',
        note,
        amount,
        currency: formData.currency || 'INR',
        type: 'Transfer-Out',
        description: `Withdrawal: Cash → ${transferFromAccount}`,
        time,
      })
      // Transfer-In to Bank
      setTimeout(() => {
        onSubmit({
          date,
          accountType: 'Bank (Card)',
          account: transferFromAccount,
          category: '🔄 Transfer',
          note,
          amount,
          currency: formData.currency || 'INR',
          type: 'Transfer-In',
          description: `Deposit: Cash → ${transferFromAccount}`,
          time,
        })
      }, 300)
    } else if (transferDirection === 'bank-to-bank') {
      // Transfer-Out from Source Bank
      onSubmit({
        date,
        accountType: 'Bank (Card)',
        account: transferFromAccount,
        category: '🔄 Transfer',
        note,
        amount,
        currency: formData.currency || 'INR',
        type: 'Transfer-Out',
        description: `Bank Transfer: ${transferFromAccount} → ${transferToAccount}`,
        time,
      })
      // Transfer-In to Destination Bank
      setTimeout(() => {
        onSubmit({
          date,
          accountType: 'Bank (Card)',
          account: transferToAccount,
          category: '🔄 Transfer',
          note,
          amount,
          currency: formData.currency || 'INR',
          type: 'Transfer-In',
          description: `Bank Transfer: ${transferFromAccount} → ${transferToAccount}`,
          time,
        })
      }, 300)
    }

    // Reset
    setFormData(defaultData)
    setTransferFromAccount('')
    setTransferToAccount('')
    setShowTransferMode(false)
    alert('Transfer recorded successfully! Two paired transactions created.')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {editData ? '✏️ Edit Transaction' : showTransferMode ? '🔄 Transfer Money' : '➕ Add New Transaction'}
          </h2>
          {!editData && (
            <button
              type="button"
              onClick={() => setShowTransferMode(!showTransferMode)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                showTransferMode
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-md'
              }`}
            >
              {showTransferMode ? '← Back to Normal' : '🔄 Transfer Money'}
            </button>
          )}
        </div>

        {/* Transfer Mode */}
        {showTransferMode && !editData ? (
          <form onSubmit={handleTransferSubmit} className="space-y-4">
            {/* Info banner */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800 font-medium">
                💡 <strong>Transfer Mode</strong> — Move money between your accounts.
                This creates <strong>two paired transactions</strong>: a <span className="text-red-600 font-bold">Transfer-Out</span> from the source 
                and a <span className="text-green-600 font-bold">Transfer-In</span> to the destination, keeping your balances accurate.
              </p>
            </div>

            {/* Direction */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Transfer Direction</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => { setTransferDirection('bank-to-cash'); setTransferFromAccount(''); setTransferToAccount(''); }}
                  className={`p-4 rounded-xl border-2 text-center font-semibold transition-all duration-200 ${
                    transferDirection === 'bank-to-cash'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl block mb-1">🏦 → 💵</span>
                  <span className="text-xs">Bank → Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setTransferDirection('cash-to-bank'); setTransferFromAccount(''); setTransferToAccount(''); }}
                  className={`p-4 rounded-xl border-2 text-center font-semibold transition-all duration-200 ${
                    transferDirection === 'cash-to-bank'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl block mb-1">💵 → 🏦</span>
                  <span className="text-xs">Cash → Bank</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setTransferDirection('bank-to-bank'); setTransferFromAccount(''); setTransferToAccount(''); }}
                  className={`p-4 rounded-xl border-2 text-center font-semibold transition-all duration-200 ${
                    transferDirection === 'bank-to-bank'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl block mb-1">🏦 → 🏦</span>
                  <span className="text-xs">Bank → Bank</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Time</label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleChange}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Bank Account - Source */}
              {transferDirection !== 'cash-to-bank' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {transferDirection === 'bank-to-bank' ? 'From Bank Account' : 'From Bank Account'}
                  </label>
                  <select
                    value={transferFromAccount}
                    onChange={(e) => setTransferFromAccount(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select Bank Account</option>
                    {ACCOUNTS['Bank (Card)'].map((acc) => (
                      <option key={acc} value={acc}>{acc}</option>
                    ))}
                  </select>
                  {errors.transferFrom && <p className="text-red-500 text-sm mt-1">{errors.transferFrom}</p>}
                </div>
              )}

              {/* Bank Account - For cash-to-bank (destination) */}
              {transferDirection === 'cash-to-bank' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">To Bank Account</label>
                  <select
                    value={transferFromAccount}
                    onChange={(e) => setTransferFromAccount(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select Bank Account</option>
                    {ACCOUNTS['Bank (Card)'].map((acc) => (
                      <option key={acc} value={acc}>{acc}</option>
                    ))}
                  </select>
                  {errors.transferFrom && <p className="text-red-500 text-sm mt-1">{errors.transferFrom}</p>}
                </div>
              )}

              {/* Bank Account - Destination (only for bank-to-bank) */}
              {transferDirection === 'bank-to-bank' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">To Bank Account</label>
                  <select
                    value={transferToAccount}
                    onChange={(e) => setTransferToAccount(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select Destination Bank</option>
                    {ACCOUNTS['Bank (Card)'].filter(acc => acc !== transferFromAccount).map((acc) => (
                      <option key={acc} value={acc}>{acc}</option>
                    ))}
                  </select>
                  {errors.transferTo && <p className="text-red-500 text-sm mt-1">{errors.transferTo}</p>}
                </div>
              )}

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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Note (optional)</label>
              <input
                type="text"
                name="note"
                value={formData.note}
                onChange={handleChange}
                placeholder="e.g., ATM Withdrawal, Cash Deposit..."
                className="input-field"
              />
            </div>

            {/* Visual summary */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-sm text-gray-500 font-medium mb-2">Transfer Summary</p>
              <div className="flex items-center justify-center gap-4 text-lg font-bold">
                <span className="text-red-500">
                  {transferDirection === 'bank-to-cash' 
                    ? (transferFromAccount || '🏦 Bank')
                    : transferDirection === 'cash-to-bank'
                      ? '💵 Cash'
                      : (transferFromAccount || '🏦 From Bank')}
                </span>
                <span className="text-gray-400 text-2xl">→</span>
                <span className="text-green-500">
                  {transferDirection === 'bank-to-cash' 
                    ? '💵 Cash' 
                    : transferDirection === 'cash-to-bank'
                      ? (transferFromAccount || '🏦 Bank')
                      : (transferToAccount || '🏦 To Bank')}
                </span>
              </div>
              {formData.amount && (
                <p className="text-center text-xl font-bold text-indigo-600 mt-2">
                  ₹{parseFloat(formData.amount).toLocaleString('en-IN')}
                </p>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <button type="submit" className="btn-primary flex-1">
                🔄 Complete Transfer
              </button>
              <button
                type="button"
                onClick={() => setShowTransferMode(false)}
                className="btn-secondary flex-1"
              >
                ❌ Cancel
              </button>
            </div>
          </form>
        ) : (
          /* Normal Transaction Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-2">
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
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Time</label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleChange}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Type
                  <button
                    type="button"
                    onClick={() => setShowTypeInfo(!showTypeInfo)}
                    className="ml-2 text-blue-500 hover:text-blue-700 text-xs font-normal"
                    title="What do these types mean?"
                  >
                    ℹ️ What are these?
                  </button>
                </label>
                <select name="type" value={formData.type} onChange={handleChange} className="input-field">
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type}</p>}
                {showTypeInfo && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                    <p><strong>Income</strong> — Money received (salary, freelance, gifts)</p>
                    <p><strong>Expense</strong> — Money spent (food, rent, bills)</p>
                    <p><strong>Transfer-Out</strong> — Money leaving an account (e.g., bank withdrawal). Does <em>not</em> count as an expense — it's just moving money elsewhere.</p>
                    <p><strong>Transfer-In</strong> — Money arriving into an account (e.g., cash deposited to bank). Does <em>not</em> count as income — it's just receiving moved money.</p>
                    <p className="text-blue-600 font-medium pt-1">💡 Tip: Use the "Bank ↔ Cash Transfer" button above for automatic paired transfers!</p>
                  </div>
                )}
              </div>

              {/* Account Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                <select
                  name="accountType"
                  value={formData.accountType}
                  onChange={handleAccountTypeChange}
                  className="input-field"
                >
                  <option value="">Select Type</option>
                  {Object.keys(ACCOUNTS).map((type) => (
                    <option key={type} value={type}>
                      {type === 'Bank (Card)' ? '🏦 Bank (Card)' : '💵 Cash'}
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
                    {formData.accountType && ACCOUNTS[formData.accountType] && ACCOUNTS[formData.accountType].map((acc) => (
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
                <>
                  <button type="button" onClick={onCancel} className="btn-secondary flex-1">
                    ❌ Cancel
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (window.confirm('Delete this transaction?')) {
                        onDelete(editData.id)
                      }
                    }} 
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                  >
                    🗑️ Delete
                  </button>
                </>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
