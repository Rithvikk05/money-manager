import { useState } from 'react'

export default function TransactionTable({ transactions, onDelete, onEdit }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterCategory, setFilterCategory] = useState('All')
  const [sortBy, setSortBy] = useState('date-desc')

  // Get unique categories
  const categories = ['All', ...new Set(transactions.map((t) => t.category))]

  // Filter transactions
  let filtered = transactions.filter((t) => {
    const matchesSearch =
      !searchTerm ||
      t.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === 'All' || t.type === filterType
    const matchesCategory = filterCategory === 'All' || t.category === filterCategory

    return matchesSearch && matchesType && matchesCategory
  })

  // Sort transactions
  filtered = filtered.sort((a, b) => {
    switch (sortBy) {
      case 'date-desc':
        return new Date(b.date) - new Date(a.date)
      case 'date-asc':
        return new Date(a.date) - new Date(b.date)
      case 'amount-desc':
        return (b.amount || 0) - (a.amount || 0)
      case 'amount-asc':
        return (a.amount || 0) - (b.amount || 0)
      default:
        return 0
    }
  })

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">🔍 Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-field">
              <option>All</option>
              <option>Income</option>
              <option>Expense</option>
              <option>Transfer-In</option>
              <option>Transfer-Out</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input-field">
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Sort By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input-field">
              <option value="date-desc">Date (Newest)</option>
              <option value="date-asc">Date (Oldest)</option>
              <option value="amount-desc">Amount (High to Low)</option>
              <option value="amount-asc">Amount (Low to High)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card overflow-x-auto">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">📋 Transactions ({filtered.length})</h2>

        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Account</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Note</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Amount</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Type</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((transaction, index) => (
                  <tr key={transaction.id} className={`border-b hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-4 py-3 text-gray-700 font-medium">{new Date(transaction.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3 text-gray-600">{transaction.account}</td>
                    <td className="px-4 py-3">{transaction.category}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{transaction.note}</td>
                    <td className={`px-4 py-3 text-right font-bold ${transaction.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{(transaction.amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        transaction.type === 'Income'
                          ? 'bg-green-100 text-green-800'
                          : transaction.type === 'Expense'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center flex gap-2 justify-center">
                      <button
                        onClick={() => onEdit(transaction)}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onDelete(transaction.id)}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No transactions found</p>
          </div>
        )}
      </div>
    </div>
  )
}
