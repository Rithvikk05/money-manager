import { useState, useEffect } from 'react'
import axios from 'axios'
import Dashboard from './components/Dashboard'
import TransactionForm from './components/TransactionForm'
import TransactionTable from './components/TransactionTable'
import CalendarView from './components/CalendarView'
import Statistics from './components/Statistics'
import ImportExport from './components/ImportExport'
import DeletedTransactions from './components/DeletedTransactions'
import MonthlySummary from './components/MonthlySummary'
import Auth from './components/Auth'
import BulkEditModal from './components/BulkEditModal'
import {
  toYearMonth,
  isCarryTransaction,
  monthLabel,
  getAccountMonthlyBalanceSummaries,
} from './utils/monthlyBalances'

const API_BASE = '/api'

// Add JWT token to all requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [deletedTransactions, setDeletedTransactions] = useState([])
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState(null)
  const [initialData, setInitialData] = useState(null)
  const [editingInModal, setEditingInModal] = useState(false)
  const [bulkEditTransactions, setBulkEditTransactions] = useState([])
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })
  const [transactionsFilter, setTransactionsFilter] = useState(null)

  // Apply dark mode class to html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      setIsLoggedIn(true)
      setUser(JSON.parse(userData))
      fetchTransactions()
      fetchDeletedTransactions()
      fetchStats()
    }
  }, [])

  const handleLoginSuccess = () => {
    const userData = localStorage.getItem('user')
    setUser(JSON.parse(userData))
    setIsLoggedIn(true)
    fetchTransactions()
    fetchStats()
  }

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setIsLoggedIn(false)
      setUser(null)
      setTransactions([])
      setStats([])
    }
  }

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_BASE}/transactions`)
      if (Array.isArray(response.data)) {
        setTransactions(response.data)
      } else {
        console.error('Expected array for transactions, got:', typeof response.data)
        setTransactions([])
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/statistics`)
      if (Array.isArray(response.data)) {
        setStats(response.data)
      } else {
        console.error('Expected array for stats, got:', typeof response.data)
        setStats([])
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
      setStats([])
    }
  }

  const fetchDeletedTransactions = async () => {
    try {
      const response = await axios.get(`${API_BASE}/deleted-transactions`)
      setDeletedTransactions(response.data)
    } catch (error) {
      console.error('Error fetching deleted transactions:', error)
    }
  }

  const handleAddTransaction = async (data) => {
    try {
      if (editingId) {
        await axios.put(`${API_BASE}/transactions/${editingId}`, data)
        setEditingId(null)
        setEditData(null)
      } else {
        await axios.post(`${API_BASE}/transactions`, data)
      }
      fetchTransactions()
      fetchStats()
    } catch (error) {
      console.error('Error saving transaction:', error)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await axios.delete(`${API_BASE}/transactions/${id}`)
        fetchTransactions()
        fetchDeletedTransactions()
        fetchStats()
      } catch (error) {
        console.error('Error deleting transaction:', error)
      }
    }
  }

  const handleRestoreTransaction = async (id) => {
    try {
      await axios.post(`${API_BASE}/deleted-transactions/${id}/restore`)
      fetchTransactions()
      fetchDeletedTransactions()
      fetchStats()
      alert('Transaction restored successfully!')
    } catch (error) {
      console.error('Error restoring transaction:', error)
      alert('Failed to restore transaction')
    }
  }

  const handlePermanentlyDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE}/deleted-transactions/${id}`)
      fetchDeletedTransactions()
      alert('Transaction permanently deleted!')
    } catch (error) {
      console.error('Error permanently deleting transaction:', error)
      alert('Failed to permanently delete transaction')
    }
  }

  const handleEdit = (transaction) => {
    setEditingId(transaction.id)
    setEditData(transaction)
    setActiveTab('add')
  }

  const handleEditInModal = (transaction) => {
    setEditingId(transaction.id)
    setEditData(transaction)
    setEditingInModal(true)
  }

  const handleCloseModal = () => {
    setEditingInModal(false)
    setEditingId(null)
    setEditData(null)
  }

  const handleSaveFromModal = async (data) => {
    try {
      if (editingId) {
        await axios.put(`${API_BASE}/transactions/${editingId}`, data)
        setEditingId(null)
        setEditData(null)
      } else {
        await axios.post(`${API_BASE}/transactions`, data)
      }
      fetchTransactions()
      fetchStats()
      handleCloseModal()
    } catch (error) {
      console.error('Error saving transaction:', error)
    }
  }

  const handleBulkEditClick = (transactions) => {
    setBulkEditTransactions(transactions)
    setShowBulkEditModal(true)
  }

  const handleBulkEditSave = async (updates) => {
    try {
      const transactionIds = bulkEditTransactions.map(t => t.id)
      await axios.put(`${API_BASE}/transactions/bulk`, {
        transactionIds,
        updates
      })
      setShowBulkEditModal(false)
      setBulkEditTransactions([])
      fetchTransactions()
      fetchStats()
    } catch (error) {
      console.error('Error in bulk edit:', error)
      alert('Failed to update transactions')
    }
  }

  const openAddWithDate = (isoDate) => {
    setEditingId(null)
    setEditData(null)
    setInitialData({ date: isoDate })
    setActiveTab('add')
  }

  const handleCalculateBalances = async (month) => {
    setLoading(true)
    try {
      // Get all transactions fresh from database
      const freshRes = await axios.get(`${API_BASE}/transactions`)
      const freshTxs = freshRes.data

      // Determine which months to process
      let monthsToProcess = []
      if (month === 'all') {
        // Get all unique months from transactions
        const uniqueMonths = new Set(freshTxs.map(t => toYearMonth(t.date)).filter(Boolean))
        monthsToProcess = Array.from(uniqueMonths).sort()
      } else {
        monthsToProcess = [month]
      }

      // Process each month
      const toDeleteIds = []
      for (const targetMonth of monthsToProcess) {
        // 1. Identify existing carry transactions in the database for this month
        const toDelete = freshTxs.filter(t => 
          toYearMonth(t.date) === targetMonth && 
          isCarryTransaction(t) && 
          !t.isVirtual
        )
        toDeleteIds.push(...toDelete.map(t => t.id))
      }

      // 2. Delete them from the database in bulk (hard delete for carry transactions)
      if (toDeleteIds.length > 0) {
        await axios.post(`${API_BASE}/transactions/bulk-delete`, {
          transactionIds: toDeleteIds,
          hardDelete: true
        })
      }

      // Re-fetch after deleting old carry transactions
      const refetchRes = await axios.get(`${API_BASE}/transactions`)
      const allTxs = refetchRes.data
      
      // 3. Identify all unique accounts from transactions (excluding carry transactions)
      const allAccounts = Array.from(new Set(allTxs.filter(t => !isCarryTransaction(t)).map(t => t.account).filter(Boolean)))
      
      // 4. For each month and account, calculate B/D and C/D
      const toAdd = []

      for (const targetMonth of monthsToProcess) {
        const [yearStr, monthStr] = targetMonth.split('-')
        const year = parseInt(yearStr, 10)
        const monthNum = parseInt(monthStr, 10)
        const lastDay = new Date(year, monthNum, 0).getDate()
        const lastDayStr = String(lastDay).padStart(2, '0')
        
        for (const account of allAccounts) {
          const isThisAccount = (name = '') => String(name) === String(account)

          // Calculate opening balance (closing of previous months)
          const pastTxs = allTxs.filter(t =>
            isThisAccount(t.account) &&
            toYearMonth(t.date) < targetMonth
          )
          const pastSummaries = getAccountMonthlyBalanceSummaries(pastTxs, isThisAccount)
          const openingBalance = pastSummaries.length > 0 ? pastSummaries[pastSummaries.length - 1].closing : 0
          
          // Calculate closing balance of the month
          const monthTxs = allTxs.filter(t => 
            isThisAccount(t.account) && 
            toYearMonth(t.date) === targetMonth &&
            !isCarryTransaction(t)
          )
          
          let income = 0
          let expense = 0
          let transferIn = 0
          let transferOut = 0
          
          for (const t of monthTxs) {
            const amount = Number(t.amount) || 0
            const type = (t.type || '').toLowerCase()
            if (type === 'income') income += amount
            else if (type === 'expense') expense += amount
            else if (type === 'transfer-in') transferIn += amount
            else if (type === 'transfer-out') transferOut += amount
          }
          
          const closingBalance = openingBalance + income - expense + transferIn - transferOut
          
          // Prepare B/D transaction if non-zero
          if (openingBalance !== 0) {
            toAdd.push({
              date: `${targetMonth}-01`,
              time: '00:00',
              account,
              category: 'Balance B/D',
              note: 'Opening balance (B/D)',
              amount: Math.abs(openingBalance),
              type: openingBalance >= 0 ? 'Balance-In' : 'Balance-Out',
              description: 'Auto-calculated opening balance carried forward.'
            })
          }
          
          // Prepare C/D transaction if non-zero
          if (closingBalance !== 0) {
            toAdd.push({
              date: `${targetMonth}-${lastDayStr}`,
              time: '23:59',
              account,
              category: 'Balance C/D',
              note: 'Closing balance (C/D)',
              amount: Math.abs(closingBalance),
              type: closingBalance >= 0 ? 'Balance-Out' : 'Balance-In',
              description: 'Auto-calculated closing balance to carry forward.'
            })
          }
        }
      }
      
      // 5. Post the new transactions in bulk
      if (toAdd.length > 0) {
        await axios.post(`${API_BASE}/transactions/bulk-create`, { transactions: toAdd })
      }
      
      // 6. Refresh state
      await fetchTransactions()
      await fetchStats()
      
      const message = month === 'all' 
        ? `Successfully calculated and updated balances for all ${monthsToProcess.length} months!`
        : `Successfully calculated and updated balances for ${monthLabel(month)}!`
      alert(message)
    } catch (error) {
      console.error('Error calculating balances:', error)
      alert('Failed to calculate and update balances.')
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryClick = (category) => {
    setTransactionsFilter({ category, sortBy: 'date-desc' })
    setActiveTab('transactions')
  }

  const handleImportSuccess = () => {
    fetchTransactions()
    fetchDeletedTransactions()
    fetchStats()
  }

  // Show Auth page if not logged in
  if (!isLoggedIn) {
    return <Auth onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-[#0B1120]' : 'bg-[#F0F4FF]'}`}>
      {/* Header */}
      <header className="gradient-primary text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-5 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">💰 Money Manager</h1>
            <p className="text-blue-200 mt-1 text-sm font-medium">Manage your finances with ease</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`theme-toggle ${darkMode ? 'dark-active' : ''}`}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              <div className="toggle-dot flex items-center justify-center text-xs">
                {darkMode ? '🌙' : '☀️'}
              </div>
            </button>
            <div className="text-right">
              <p className="text-sm font-semibold text-blue-100">Welcome, {user?.username}!</p>
              <button
                onClick={handleLogout}
                className="mt-1 bg-red-500/20 hover:bg-red-500/40 border border-red-400/30 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className={`sticky top-0 z-50 shadow-md backdrop-blur-lg transition-colors duration-300 ${darkMode ? 'bg-slate-900/95 border-b border-slate-700/50' : 'bg-white/95 border-b border-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {[
            { id: 'dashboard', icon: '📊', label: 'Dashboard' },
            { id: 'add', icon: '➕', label: 'Add Transaction' },
            { id: 'transactions', icon: '📋', label: 'All Transactions' },
            { id: 'import-export', icon: '📤', label: 'Import/Export' },
            { id: 'calendar', icon: '🗓️', label: 'Calendar' },
            { id: 'monthly-summary', icon: '📈', label: 'Monthly Summary' },
            { id: 'deleted', icon: '🗑️', label: 'Deleted' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-all duration-200 relative ${
                activeTab === tab.id
                  ? `${darkMode ? 'text-blue-400' : 'text-blue-600'} tab-active`
                  : `${darkMode ? 'text-slate-400 hover:text-blue-400' : 'text-gray-500 hover:text-blue-600'}`
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading && (
          <div className={`mb-6 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm ${darkMode ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-blue-100 bg-blue-50 text-blue-800'}`}>
            Loading data...
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div key="dashboard" className="page-transition">
            <Dashboard transactions={transactions} stats={stats} onCategoryClick={handleCategoryClick} />
          </div>
        )}

        {activeTab === 'add' && (
          <TransactionForm
            onSubmit={handleAddTransaction}
            editData={editData}
            initialData={initialData}
            onDelete={handleDelete}
            transactions={transactions}
            onCancel={() => {
              setEditingId(null)
              setEditData(null)
              setActiveTab('dashboard')
            }}
          />
        )}

        {activeTab === 'transactions' && (
          <div key="transactions" className="page-transition">
            <TransactionTable
              transactions={transactions}
              onDelete={handleDelete}
              onEdit={handleEditInModal}
              onBulkEdit={handleBulkEditClick}
              initialFilter={transactionsFilter}
            />
          </div>
        )}
        
        {activeTab === 'calendar' && (
          <CalendarView transactions={transactions} onEdit={handleEdit} onAddDate={openAddWithDate} onCalculateBalances={handleCalculateBalances} />
        )}

        {activeTab === 'monthly-summary' && (
          <MonthlySummary
            transactions={transactions}
            onRefresh={fetchTransactions}
            isLoading={loading}
          />
        )}

        {activeTab === 'import-export' && (
          <ImportExport onImportSuccess={handleImportSuccess} />
        )}

        {activeTab === 'deleted' && (
          <DeletedTransactions
            deletedTransactions={deletedTransactions}
            onRestore={handleRestoreTransaction}
            onPermanentlyDelete={handlePermanentlyDelete}
          />
        )}
      </main>

      {/* Edit Modal */}
      {editingInModal && (
        <div className="fixed inset-0 bg-black/50 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`sticky top-0 border-b p-4 flex justify-between items-center rounded-t-xl ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>✏️ Edit Transaction</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <TransactionForm
                onSubmit={handleSaveFromModal}
                editData={editData}
                onDelete={handleDelete}
                onCancel={handleCloseModal}
                transactions={transactions}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <BulkEditModal
          selectedCount={bulkEditTransactions.length}
          onSave={handleBulkEditSave}
          onClose={() => setShowBulkEditModal(false)}
        />
      )}

      {/* Footer */}
      <footer className={`border-t mt-12 py-6 text-center transition-colors duration-300 ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-gray-100 text-gray-500'}`}>
        <p>&copy; {new Date().getFullYear()} Money Manager. All rights reserved.</p>
      </footer>
    </div>
  )
}
