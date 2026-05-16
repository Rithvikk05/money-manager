import { useState } from 'react'

const formatDate = (dateString) => {
  try {
    if (!dateString) return 'N/A'
    
    let date = new Date(dateString)
    if (isNaN(date.getTime())) {
      const numDate = parseFloat(dateString)
      if (!isNaN(numDate) && numDate > 0) {
        date = new Date((numDate - 25569) * 86400 * 1000)
      } else {
        const parts = dateString.split('/')
        if (parts.length === 3) {
          date = new Date(parts[2], parts[1] - 1, parts[0])
        }
      }
    }
    
    if (isNaN(date.getTime())) {
      return dateString
    }
    
    return date.toLocaleDateString('en-IN')
  } catch (e) {
    return dateString
  }
}

export default function DeletedTransactions({ deletedTransactions, onRestore, onPermanentlyDelete }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterCategory, setFilterCategory] = useState('All')

  // Get unique categories
  const categories = ['All', ...new Set(deletedTransactions.map((t) => t.category).filter(Boolean))]

  // Filter transactions
  let filtered = deletedTransactions.filter((t) => {
    const matchesSearch =
      !searchTerm ||
      t.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === 'All' || t.type === filterType
    const matchesCategory = filterCategory === 'All' || t.category === filterCategory

    return matchesSearch && matchesType && matchesCategory
  })

  const formatDeletedDate = (dateString) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-IN') + ' ' + date.toLocaleTimeString('en-IN')
    } catch (e) {
      return dateString
    }
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-gray-700">🔍 Search & Filter</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <input
              type="text"
              placeholder="Search by note, category, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input-field"
            >
              <option value="All">All Types</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
              <option value="Transfer-Out">Transfer-Out</option>
              <option value="Transfer-In">Transfer-In</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="input-field"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length > 0 && (
          <p className="text-sm text-gray-600">
            Showing {filtered.length} of {deletedTransactions.length} deleted transactions
          </p>
        )}
      </div>

      {/* Deleted Transactions Table */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 text-lg">✨ No deleted transactions found</p>
          <p className="text-gray-400 text-sm mt-2">Your deleted transactions will appear here</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Account</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Category</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Note</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Deleted On</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((transaction, index) => (
                <tr
                  key={transaction.id}
                  className={`border-b border-gray-200 hover:bg-gray-50 transition ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <td className="px-6 py-4 text-sm text-gray-800 font-medium">{formatDate(transaction.date)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{transaction.account}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{transaction.category}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        transaction.type === 'Income'
                          ? 'bg-green-100 text-green-800'
                          : transaction.type === 'Expense'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                    ₹{transaction.amount?.toLocaleString('en-IN') || '0'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={transaction.note}>
                    {transaction.note || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDeletedDate(transaction.deleted_at)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => onRestore(transaction.id)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition"
                        title="Restore this transaction"
                      >
                        ↩️ Restore
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Permanently delete this transaction?')) {
                            onPermanentlyDelete(transaction.id)
                          }
                        }}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition"
                        title="Permanently delete"
                      >
                        ❌ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
