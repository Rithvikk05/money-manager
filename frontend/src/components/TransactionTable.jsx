import { useState, useMemo, useCallback, useEffect, useRef } from 'react'

const ITEMS_PER_PAGE = 50

export default function TransactionTable({ transactions, onDelete, onEdit }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterAccountType, setFilterAccountType] = useState('All')
  const [sortBy, setSortBy] = useState('date-desc')
  const [currentPage, setCurrentPage] = useState(1)
  const searchTimeout = useRef(null)

  // Debounce search input to reduce filtering frequency
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1) // Reset to first page on new search
    }, 300)
    return () => clearTimeout(searchTimeout.current)
  }, [searchTerm])

  // Memoize date parsing to avoid recomputation
  const parseDate = useCallback((dateString) => {
    try {
      if (!dateString) return new Date(NaN)
      let date = new Date(dateString)
      if (isNaN(date.getTime())) {
        const numDate = parseFloat(dateString)
        if (!isNaN(numDate) && numDate > 0) {
          date = new Date((numDate - 25569) * 86400 * 1000)
        } else {
          const parts = dateString.split('/')
          if (parts.length === 3) {
            date = new Date(parts[2], parts[1] - 1, parts[0])
          } else {
            date = new Date(dateString.replace(/-/g, '/'))
          }
        }
      }
      return date
    } catch (e) {
      return new Date(NaN)
    }
  }, [])

  // Memoize date formatting
  const formatDate = useCallback((dateString) => {
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
          } else {
            date = new Date(dateString.replace(/-/g, '/'))
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
  }, [])

  // Memoize categories and accounts - only compute when transactions change
  const { categories, uniqueAccounts } = useMemo(() => {
    return {
      categories: ['All', ...new Set(transactions.map((t) => t.category).filter(Boolean))],
      uniqueAccounts: ['All', ...new Set(transactions.map((t) => t.account).filter(Boolean))]
    }
  }, [transactions])

  // Memoize filtering and sorting - only recompute when necessary
  const { filtered, totalCount } = useMemo(() => {
    const displayTransactions = Array.isArray(transactions) ? transactions : []

    let result = displayTransactions.filter((t) => {
      const matchesSearch =
        !debouncedSearch ||
        t.note?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        t.category?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        t.description?.toLowerCase().includes(debouncedSearch.toLowerCase())

      const matchesType = filterType === 'All' || t.type === filterType
      const matchesCategory = filterCategory === 'All' || t.category === filterCategory
      const matchesAccountType = filterAccountType === 'All' || t.account === filterAccountType

      return matchesSearch && matchesType && matchesCategory && matchesAccountType
    })

    // Sort transactions
    result = result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc': {
          const ta = parseDate(a.date).getTime() || 0
          const tb = parseDate(b.date).getTime() || 0
          return tb - ta
        }
        case 'date-asc': {
          const ta = parseDate(a.date).getTime() || 0
          const tb = parseDate(b.date).getTime() || 0
          return ta - tb
        }
        case 'amount-desc':
          return (b.amount || 0) - (a.amount || 0)
        case 'amount-asc':
          return (a.amount || 0) - (b.amount || 0)
        default:
          return 0
      }
    })

    return {
      filtered: result,
      totalCount: result.length
    }
  }, [transactions, debouncedSearch, filterType, filterCategory, filterAccountType, sortBy, parseDate])

  // Pagination logic - only compute visible items
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return filtered.slice(startIndex, endIndex)
  }, [filtered, currentPage])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  return (
    <div className="space-y-6">
      {/* Monthly grouping removed: show all transactions in the table below */}

      {/* Filters */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">🔍 Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">Account Type</label>
            <select value={filterAccountType} onChange={(e) => setFilterAccountType(e.target.value)} className="input-field">
              {uniqueAccounts.map(acc => (
                <option key={acc} value={acc}>{acc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-field">
              <option>All</option>
              <option>Income</option>
              <option>Expense</option>
              <option>Transfer-In</option>
              <option>Transfer-Out</option>
              <option>Balance-In</option>
              <option>Balance-Out</option>
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">📋 Transactions</h2>
          <div className="text-sm text-gray-600">
            {totalCount > 0 ? (
              <>
                Showing <strong>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to <strong>{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}</strong> of <strong>{totalCount}</strong>
              </>
            ) : (
              <span>0 transactions</span>
            )}
          </div>
        </div>

        {paginatedData.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Date & Time</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Account</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Category</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Note</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Amount</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">Type</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((transaction, index) => (
                    <tr key={transaction.id} className={`border-b transition-colors ${transaction.isVirtual ? 'bg-gray-100 italic' : (index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100')}`}>
                      <td className="px-4 py-3 text-gray-700 font-medium">
                        {formatDate(transaction.date)}
                        {transaction.time && <div className="text-xs text-gray-400">{transaction.time}</div>}
                      </td>
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
                              : transaction.type === 'Transfer-In'
                                ? 'bg-teal-100 text-teal-800'
                                : transaction.type === 'Transfer-Out'
                                  ? 'bg-orange-100 text-orange-800'
                                  : transaction.type === 'Balance-In'
                                    ? 'bg-purple-100 text-purple-800'
                                    : transaction.type === 'Balance-Out'
                                      ? 'bg-gray-200 text-gray-800'
                                      : 'bg-blue-100 text-blue-800'
                        }`}>
                          {transaction.isVirtual ? 'Auto-Balance' : transaction.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center flex gap-2 justify-center">
                        {!transaction.isVirtual && (
                          <>
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
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                >
                  ← Previous
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No transactions found</p>
          </div>
        )}
      </div>
    </div>
  )
}
