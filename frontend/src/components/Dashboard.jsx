import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const formatDate = (dateString) => {
  try {
    if (!dateString) return 'N/A'
    
    // Try parsing as ISO date (YYYY-MM-DD)
    let date = new Date(dateString)
    
    // If invalid, check if it's an Excel serial number
    if (isNaN(date.getTime())) {
      const numDate = parseFloat(dateString)
      if (!isNaN(numDate) && numDate > 0) {
        // Convert Excel serial number to date
        date = new Date((numDate - 25569) * 86400 * 1000)
      } else {
        // Try DD/MM/YYYY format
        const parts = dateString.split('/')
        if (parts.length === 3) {
          date = new Date(parts[2], parts[1] - 1, parts[0])
        } else {
          // Try MM/DD/YYYY format
          date = new Date(dateString.replace(/-/g, '/'))
        }
      }
    }
    
    if (isNaN(date.getTime())) {
      return dateString // Return original string if parsing fails
    }
    
    return date.toLocaleDateString('en-IN')
  } catch (e) {
    return dateString
  }
}

export default function Dashboard({ transactions, stats }) {
  const isCarryTransaction = (t) => {
    const text = ((t.category || '') + ' ' + (t.note || '') + ' ' + (t.description || '')).toLowerCase()
    return /\b(b\/d|c\/f|balance\s*b|balance\s*c|brought\s+down|carried\s+forward)\b/.test(text)
  }

  const totalIncome = transactions
    .filter((t) => t.type === 'Income' && !isCarryTransaction(t))
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  const totalExpense = transactions
    .filter((t) => t.type === 'Expense' && !isCarryTransaction(t))
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  // Balance shown in dashboard excludes explicit carry-forward / brought-down balance entries
  const balance = totalIncome - totalExpense

  // Category breakdown
  const expenseByCategory = transactions
    .filter((t) => t.type === 'Expense' && !isCarryTransaction(t))
    .reduce((acc, t) => {
      const cat = t.category || 'Other'
      acc[cat] = (acc[cat] || 0) + (t.amount || 0)
      return acc
    }, {})

  const categoryData = Object.entries(expenseByCategory).map(([name, value]) => ({
    name,
    value,
  }))

  // Monthly breakdown
  const monthlyData = {}
  transactions.forEach((t) => {
    if (t.date) {
      const month = t.date.substring(0, 7) // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { month, income: 0, expense: 0 }
      }
      if (t.type === 'Income') {
        monthlyData[month].income += t.amount || 0
      } else if (t.type === 'Expense') {
        monthlyData[month].expense += t.amount || 0
      }
    }
  })

  const monthlyArray = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month))

  const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b', '#fa709a', '#fee140']

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="income-card">
          <p className="text-gray-600 text-sm font-semibold uppercase">Total Income</p>
          <p className="text-3xl font-bold text-green-600 mt-2">₹{totalIncome.toLocaleString('en-IN')}</p>
        </div>
        <div className="expense-card">
          <p className="text-gray-600 text-sm font-semibold uppercase">Total Expense</p>
          <p className="text-3xl font-bold text-red-600 mt-2">₹{totalExpense.toLocaleString('en-IN')}</p>
        </div>
        <div className={`stat-card ${balance >= 0 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-600' : 'bg-gradient-to-br from-orange-50 to-red-50 border-l-4 border-orange-600'}`}>
          <p className="text-gray-600 text-sm font-semibold uppercase">Balance</p>
          <p className={`text-3xl font-bold mt-2 ${balance >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
            ₹{balance.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="card">
          <h3 className="text-xl font-bold text-gray-800 mb-4">📈 Monthly Trend</h3>
          {monthlyArray.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyArray}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#22c55e" name="Income" />
                <Line type="monotone" dataKey="expense" stroke="#ef4444" name="Expense" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500">No data available</p>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <h3 className="text-xl font-bold text-gray-800 mb-4">🎯 Expenses by Category</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ₹${(value).toLocaleString('en-IN')}`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500">No data available</p>
          )}
        </div>
      </div>

      {/* Top Transactions */}
      <div className="card">
        <h3 className="text-xl font-bold text-gray-800 mb-4">💳 Recent Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Category</th>
                <th className="text-left px-4 py-2">Description</th>
                <th className="text-right px-4 py-2">Amount</th>
                <th className="text-center px-4 py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map((t) => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{formatDate(t.date)}</td>
                  <td className="px-4 py-2">{t.category}</td>
                  <td className="px-4 py-2 text-gray-600">{t.note}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{(t.amount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${t.type === 'Income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {t.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
