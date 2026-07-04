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

const getApiBase = () => {
  if (import.meta.env.DEV) return 'http://localhost:5000/api'
  if (!import.meta.env.VITE_API_BASE) return 'http://localhost:5000/api'
  let base = import.meta.env.VITE_API_BASE.trim()
  if (!base.startsWith('http')) base = `https://${base}`
  if (base.endsWith('/')) base = base.slice(0, -1)
  if (!base.endsWith('/api')) base = `${base}/api`
  return base
}
const API_BASE = getApiBase()

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
      setTransactions(response.data)
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/statistics`)
      setStats(response.data)
    } catch (error) {
      console.error('Error fetching stats:', error)
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="gradient-primary text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold">💰 Money Manager</h1>
            <p className="text-gray-100 mt-2">Manage your finances with ease</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">Welcome, {user?.username}!</p>
            <button
              onClick={handleLogout}
              className="mt-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-3 font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'dashboard'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-4 py-3 font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'add'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            ➕ Add Transaction
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-3 font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'transactions'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            📋 All Transactions
          </button>
          <button
            onClick={() => setActiveTab('import-export')}
            className={`px-4 py-3 font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'import-export'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            📤 Import/Export
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-3 font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'calendar'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            🗓️ Calendar
          </button>
          <button
            onClick={() => setActiveTab('monthly-summary')}
            className={`px-4 py-3 font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'monthly-summary'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            📈 Monthly Summary
          </button>
          <button
            onClick={() => setActiveTab('deleted')}
            className={`px-4 py-3 font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'deleted'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            🗑️ Deleted Transactions
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading && <div className="text-center py-8 text-gray-500">Loading...</div>}

        {!loading && activeTab === 'dashboard' && (
          <Dashboard transactions={transactions} stats={stats} />
        )}

        {!loading && activeTab === 'add' && (
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

        {!loading && activeTab === 'transactions' && (
          <TransactionTable
            transactions={transactions}
            onDelete={handleDelete}
            onEdit={handleEditInModal}
            onBulkEdit={handleBulkEditClick}
          />
        )}

        {!loading && activeTab === 'calendar' && (
          <CalendarView transactions={transactions} onEdit={handleEdit} onAddDate={openAddWithDate} onCalculateBalances={handleCalculateBalances} />
        )}

        {activeTab === 'monthly-summary' && (
          <MonthlySummary
            transactions={transactions}
            onRefresh={fetchTransactions}
            isLoading={loading}
          />
        )}

        {!loading && activeTab === 'import-export' && (
          <ImportExport onImportSuccess={handleImportSuccess} />
        )}

        {!loading && activeTab === 'deleted' && (
          <DeletedTransactions
            deletedTransactions={deletedTransactions}
            onRestore={handleRestoreTransaction}
            onPermanentlyDelete={handlePermanentlyDelete}
          />
        )}
      </main>

      {/* Edit Modal */}
      {editingInModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">✏️ Edit Transaction</h2>
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
      <footer className="bg-white border-t mt-12 py-6 text-center text-gray-500">
        <p>&copy; {new Date().getFullYear()} Money Manager. All rights reserved.</p>
      </footer>
    </div>
  )
}
