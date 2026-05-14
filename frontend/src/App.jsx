import { useState, useEffect } from 'react'
import axios from 'axios'
import Dashboard from './components/Dashboard'
import TransactionForm from './components/TransactionForm'
import TransactionTable from './components/TransactionTable'
import CalendarView from './components/CalendarView'
import Statistics from './components/Statistics'
import ImportExport from './components/ImportExport'
import Auth from './components/Auth'

const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:5000/api' 
  : (import.meta.env.VITE_API_BASE 
      ? (import.meta.env.VITE_API_BASE.startsWith('http') ? import.meta.env.VITE_API_BASE : `https://${import.meta.env.VITE_API_BASE}`)
      : 'http://localhost:5000/api')

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
        fetchStats()
      } catch (error) {
        console.error('Error deleting transaction:', error)
      }
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

  const handleImportSuccess = () => {
    fetchTransactions()
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
          <CalendarView transactions={transactions} onEdit={handleEdit} onAddDate={openAddWithDate} />
        )}

        {!loading && activeTab === 'import-export' && (
          <ImportExport onImportSuccess={handleImportSuccess} />
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
