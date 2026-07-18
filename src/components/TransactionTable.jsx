import { useState, useMemo, useCallback, useEffect, useRef } from 'react'

const ITEMS_PER_PAGE = 50

export default function TransactionTable({ transactions, onDelete, onEdit, onBulkEdit, initialFilter }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterAccountType, setFilterAccountType] = useState('All')
  const [sortBy, setSortBy] = useState('date-desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState(new Set())
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

  useEffect(() => {
    if (initialFilter) {
      if (initialFilter.category) setFilterCategory(initialFilter.category)
      if (initialFilter.sortBy) setSortBy(initialFilter.sortBy)
      setFilterType('All')
      setFilterAccountType('All')
      setSearchTerm('')
    }
  }, [initialFilter])

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

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const newSelected = new Set(selectedIds)
      paginatedData.forEach(t => {
        if (!t.isVirtual) newSelected.add(t.id)
      })
      setSelectedIds(newSelected)
    } else {
      const newSelected = new Set(selectedIds)
      paginatedData.forEach(t => newSelected.delete(t.id))
      setSelectedIds(newSelected)
    }
  }

  const handleSelectOne = (e, id) => {
    const newSelected = new Set(selectedIds)
    if (e.target.checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  const isAllSelected = paginatedData.length > 0 && paginatedData.filter(t => !t.isVirtual).every(t => selectedIds.has(t.id))

  return (
    <div className="space-y-6">
      {/* Monthly grouping removed: show all transactions in the table below */}

      {/* Filters */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-slate-100">🔍 Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Account Type</label>
            <select value={filterAccountType} onChange={(e) => setFilterAccountType(e.target.value)} className="input-field">
              {uniqueAccounts.map(acc => (
                <option key={acc} value={acc}>{acc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Type</label>
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
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Category</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input-field">
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Sort By</label>
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
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">📋 Transactions</h2>
            {selectedIds.size > 0 && typeof onBulkEdit === 'function' && (
              <button 
                onClick={() => {
                  const selectedTxs = transactions.filter(t => selectedIds.has(t.id));
                  onBulkEdit(selectedTxs);
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors shadow-sm text-sm"
              >
                ✏️ Bulk Edit ({selectedIds.size})
              </button>
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-slate-300">
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
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-700 border-b-2 border-blue-200 dark:border-blue-700 dark:border-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-slate-300">Date & Time</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-slate-300">Account</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-slate-300">Category</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-slate-300">Note</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-slate-300">Amount</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-slate-300">Type</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((transaction, index) => (
                    <tr key={transaction.id} className={`border-b dark:border-slate-700 transition-colors ${transaction.isVirtual ? 'bg-gray-100 dark:bg-slate-700 italic' : (index % 2 === 0 ? 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700/50' : 'bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700/50')} ${selectedIds.has(transaction.id) ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}>
                      <td className="px-4 py-3 text-center">
                        {!transaction.isVirtual && (
                          <input 
                            type="checkbox"
                            checked={selectedIds.has(transaction.id)}
                            onChange={(e) => handleSelectOne(e, transaction.id)}
                            className="rounded border-gray-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-slate-300 font-medium">
                        {formatDate(transaction.date)}
                        {transaction.time && <div className="text-xs text-gray-400">{transaction.time}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{transaction.account}</td>
                      <td className="px-4 py-3">{transaction.category}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300 max-w-xs truncate">{transaction.note}</td>
                      <td className={`px-4 py-3 text-right font-bold ${transaction.type === 'Income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        ₹{(transaction.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          transaction.type === 'Income'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800'
                            : transaction.type === 'Expense'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-800'
                              : transaction.type === 'Transfer-In'
                                ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-800'
                                : transaction.type === 'Transfer-Out'
                                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800'
                                  : transaction.type === 'Balance-In'
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800'
                                    : transaction.type === 'Balance-Out'
                                      ? 'bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-slate-100 dark:bg-slate-600 dark:text-slate-100'
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
                  className="px-3 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
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
                          : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-slate-400 text-lg">No transactions found</p>
          </div>
        )}
      </div>
    </div>
  )
}
