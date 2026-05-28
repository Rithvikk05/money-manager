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

  const openAddWithDate = (isoDate) => {
    setEditingId(null)
    setEditData(null)
    setInitialData({ date: isoDate })
    setActiveTab('add')
  }

  const handleCalculateBalances = async (month) => {
    setLoading(true)
    try {
      // 1. Identify existing carry transactions in the database for this month
      const toDelete = transactions.filter(t => 
        toYearMonth(t.date) === month && 
        isCarryTransaction(t) && 
        !t.isVirtual
      )
      
      // 2. Delete them from the database
      for (const t of toDelete) {
        await axios.delete(`${API_BASE}/transactions/${t.id}`)
      }
      
      // We need the updated list of transactions (without the deleted carry transactions)
      // to calculate the correct balances.
      const freshRes = await axios.get(`${API_BASE}/transactions`)
      const freshTxs = freshRes.data
      
      // 3. Group accounts for carry statements:
      // Cash stays separate, all non-cash accounts are merged.
      const accountGroups = ['Cash', 'Bank / Card / Account']
      
      // 4. For each account, calculate B/D and C/D
      const toAdd = []
      const [yearStr, monthStr] = month.split('-')
      const year = parseInt(yearStr, 10)
      const monthNum = parseInt(monthStr, 10)
      const lastDay = new Date(year, monthNum, 0).getDate()
      const lastDayStr = String(lastDay).padStart(2, '0')
      
      for (const account of accountGroups) {
        const isCashGroup = account === 'Cash'
        const isInGroup = (name = '') => {
          const lower = String(name).toLowerCase()
          return isCashGroup ? lower.includes('cash') : !lower.includes('cash')
        }

        // Calculate opening balance (closing of previous months)
        const pastTxs = freshTxs.filter(t =>
          isInGroup(t.account) &&
          toYearMonth(t.date) < month
        )
        const pastSummaries = getAccountMonthlyBalanceSummaries(pastTxs, isInGroup)
        const openingBalance = pastSummaries.length > 0 ? pastSummaries[pastSummaries.length - 1].closing : 0
        
        // Calculate closing balance of the month
        const monthTxs = freshTxs.filter(t => 
          isInGroup(t.account) && 
          toYearMonth(t.date) === month &&
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
            date: `${month}-01`,
            time: '00:00',
            account,
            category: 'Balance B/D',
            note: 'Opening balance (B/D)',
            amount: openingBalance,
            type: openingBalance >= 0 ? 'Balance-In' : 'Balance-Out',
            description: 'Auto-calculated opening balance carried forward.'
          })
        }
        
        // Prepare C/D transaction if non-zero
        if (closingBalance !== 0) {
          toAdd.push({
            date: `${month}-${lastDayStr}`,
            time: '23:59',
            account,
            category: 'Balance C/D',
            note: 'Closing balance (C/D)',
            amount: closingBalance,
            type: closingBalance >= 0 ? 'Balance-Out' : 'Balance-In',
            description: 'Auto-calculated closing balance to carry forward.'
          })
        }
      }
      
      // 5. Post the new transactions
      for (const tx of toAdd) {
        await axios.post(`${API_BASE}/transactions`, tx)
      }
      
      // 6. Refresh state
      await fetchTransactions()
      await fetchStats()
      alert(`Successfully calculated and updated balances for ${monthLabel(month)}!`)
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
            onEdit={handleEdit}
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

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>© 2026 Money Manager - Personal Finance Dashboard</p>
          <p className="text-gray-400 text-sm mt-2">Track, manage and optimize your expenses</p>
        </div>
      </footer>
    </div>
  )
}
