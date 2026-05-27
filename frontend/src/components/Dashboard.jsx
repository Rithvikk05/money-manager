import { useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getMonthlyBalanceSummaries, getAccountMonthlyBalanceSummaries, isCarryTransaction, monthLabel } from '../utils/monthlyBalances'

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

// Determine if an account belongs to Bank (Card) or Cash
const isBankAccount = (account) => {
  if (!account) return false
  if (account === 'Cash') return false
  // Bank accounts contain "Bank" or the bank emoji
  return account.includes('Bank') || account.includes('🏦')
}

const isCashAccount = (account) => {
  return account === 'Cash'
}

export default function Dashboard({ transactions, stats }) {
  const monthlySummaries = useMemo(() => getMonthlyBalanceSummaries(transactions), [transactions])

  const totalIncome = monthlySummaries.reduce((sum, month) => sum + month.income, 0)
  const totalExpense = monthlySummaries.reduce((sum, month) => sum + month.expense, 0)
  const balance = monthlySummaries.length > 0 ? monthlySummaries[monthlySummaries.length - 1].closing : 0

  // ---- Monthly balance summaries per account type (with carry-forward) ----
  const bankMonthlySummaries = useMemo(
    () => getAccountMonthlyBalanceSummaries(transactions, isBankAccount),
    [transactions]
  )
  const cashMonthlySummaries = useMemo(
    () => getAccountMonthlyBalanceSummaries(transactions, isCashAccount),
    [transactions]
  )

  // Get current month only (no carry-forward from past months)
  const bankCurrentMonth = bankMonthlySummaries.length > 0 ? bankMonthlySummaries[bankMonthlySummaries.length - 1] : null
  const cashCurrentMonth = cashMonthlySummaries.length > 0 ? cashMonthlySummaries[cashMonthlySummaries.length - 1] : null

  // Current actual balance = only this month's net activity (income - expense + transfers)
  const bankBalance = bankCurrentMonth ? (bankCurrentMonth.income - bankCurrentMonth.expense + bankCurrentMonth.transferIn - bankCurrentMonth.transferOut) : 0
  const cashBalance = cashCurrentMonth ? (cashCurrentMonth.income - cashCurrentMonth.expense + cashCurrentMonth.transferIn - cashCurrentMonth.transferOut) : 0

  // ---- Per-bank-account breakdown ----
  const bankAccounts = {}
  transactions.forEach((t) => {
    if (isCarryTransaction(t) || !isBankAccount(t.account)) return
    const acc = t.account
    if (!bankAccounts[acc]) bankAccounts[acc] = 0
    if (t.type === 'Income' || t.type === 'Transfer-In') {
      bankAccounts[acc] += t.amount || 0
    } else if (t.type === 'Expense' || t.type === 'Transfer-Out') {
      bankAccounts[acc] -= t.amount || 0
    }
  })

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
  const monthlyArray = monthlySummaries.map(({ month, income, expense }) => ({
    month,
    income,
    expense,
  }))

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
          <p className="text-gray-600 text-sm font-semibold uppercase">Net Balance</p>
          <p className={`text-3xl font-bold mt-2 ${balance >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
            ₹{balance.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Balance by Account Type — with monthly carry-forward */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bank Balance Card */}
        <div className="card bg-gradient-to-br from-indigo-50 to-blue-50 border-l-4 border-indigo-500">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-700 text-sm font-semibold uppercase flex items-center gap-2">
              🏦 Bank (Card) Balance
            </p>
            <span className={`text-2xl font-bold ${bankBalance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
              ₹{bankBalance.toLocaleString('en-IN')}
            </span>
          </div>
          {/* Current month activity only (no opening balance from past) */}
          {bankCurrentMonth && (
            <div className="mt-2 space-y-1 border-t border-indigo-100 pt-3 text-xs">
              <p className="text-gray-500 font-semibold mb-1">{monthLabel(bankCurrentMonth.month)} Activity</p>
              {bankCurrentMonth.income > 0 && <div className="flex justify-between"><span className="text-green-600">+ Income</span><span className="font-semibold text-green-600">₹{bankCurrentMonth.income.toLocaleString('en-IN')}</span></div>}
              {bankCurrentMonth.expense > 0 && <div className="flex justify-between"><span className="text-red-500">− Expense</span><span className="font-semibold text-red-500">₹{bankCurrentMonth.expense.toLocaleString('en-IN')}</span></div>}
              {bankCurrentMonth.transferIn > 0 && <div className="flex justify-between"><span className="text-teal-600">+ Transfer In</span><span className="font-semibold text-teal-600">₹{bankCurrentMonth.transferIn.toLocaleString('en-IN')}</span></div>}
              {bankCurrentMonth.transferOut > 0 && <div className="flex justify-between"><span className="text-orange-500">− Transfer Out</span><span className="font-semibold text-orange-500">₹{bankCurrentMonth.transferOut.toLocaleString('en-IN')}</span></div>}
              {(bankCurrentMonth.income > 0 || bankCurrentMonth.expense > 0) && <p className="text-gray-500 text-xs mt-1">↓ Current available balance shown above ↑</p>}
            </div>
          )}
          {/* Per-bank breakdown */}
          {Object.keys(bankAccounts).length > 0 && (
            <div className="mt-3 space-y-2 border-t border-indigo-100 pt-3">
              <p className="text-xs text-gray-500 font-semibold">Per Account</p>
              {Object.entries(bankAccounts).map(([acc, bal]) => (
                <div key={acc} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{acc}</span>
                  <span className={`font-semibold ${bal >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                    ₹{bal.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cash Balance Card */}
        <div className="card bg-gradient-to-br from-emerald-50 to-green-50 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-700 text-sm font-semibold uppercase flex items-center gap-2">
              💵 Cash Balance
            </p>
            <span className={`text-2xl font-bold ${cashBalance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              ₹{cashBalance.toLocaleString('en-IN')}
            </span>
          </div>
          {/* Current month activity only (no opening balance from past) */}
          {cashCurrentMonth && (
            <div className="mt-2 space-y-1 border-t border-emerald-100 pt-3 text-xs">
              <p className="text-gray-500 font-semibold mb-1">{monthLabel(cashCurrentMonth.month)} Activity</p>
              {cashCurrentMonth.income > 0 && <div className="flex justify-between"><span className="text-green-600">+ Income</span><span className="font-semibold text-green-600">₹{cashCurrentMonth.income.toLocaleString('en-IN')}</span></div>}
              {cashCurrentMonth.expense > 0 && <div className="flex justify-between"><span className="text-red-500">− Expense</span><span className="font-semibold text-red-500">₹{cashCurrentMonth.expense.toLocaleString('en-IN')}</span></div>}
              {cashCurrentMonth.transferIn > 0 && <div className="flex justify-between"><span className="text-teal-600">+ Transfer In</span><span className="font-semibold text-teal-600">₹{cashCurrentMonth.transferIn.toLocaleString('en-IN')}</span></div>}
              {cashCurrentMonth.transferOut > 0 && <div className="flex justify-between"><span className="text-orange-500">− Transfer Out</span><span className="font-semibold text-orange-500">₹{cashCurrentMonth.transferOut.toLocaleString('en-IN')}</span></div>}
              {(cashCurrentMonth.income > 0 || cashCurrentMonth.expense > 0) && <p className="text-gray-500 text-xs mt-1">↓ Current available balance shown above ↑</p>}
            </div>
          )}
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
                <th className="text-left px-4 py-2">Account</th>
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
                  <td className="px-4 py-2 text-gray-600">{t.account}</td>
                  <td className="px-4 py-2">{t.category}</td>
                  <td className="px-4 py-2 text-gray-600">{t.note}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${
                    t.type === 'Income' || t.type === 'Transfer-In' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ₹{(t.amount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      t.type === 'Income' ? 'bg-green-100 text-green-800' 
                        : t.type === 'Expense' ? 'bg-red-100 text-red-800'
                        : t.type === 'Transfer-In' ? 'bg-teal-100 text-teal-800'
                        : t.type === 'Transfer-Out' ? 'bg-orange-100 text-orange-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
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
