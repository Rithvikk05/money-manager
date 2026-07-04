import { useMemo, useState, useEffect, useRef } from 'react'
import { ComposedChart, BarChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
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
  return !account.toLowerCase().includes('cash')
}

const isCashAccount = (account) => {
  return account === 'Cash'
}

export default function Dashboard({ transactions, stats }) {
  const [displayCount, setDisplayCount] = useState(10)
  const dashboardRef = useRef(null)

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
  
  // ---- Per-account breakdown with current month balance ----
  const uniqueAccounts = useMemo(() => {
    return [...new Set(transactions.map(t => t.account).filter(Boolean))]
  }, [transactions])

  const accountSummaries = {}
  uniqueAccounts.forEach(acc => {
    const accTxs = transactions.filter(t => t.account === acc)
    const summaries = getAccountMonthlyBalanceSummaries(accTxs, (a) => a === acc)
    accountSummaries[acc] = summaries.length > 0 ? summaries[summaries.length - 1] : null
  })

  const accountTotals = {}
  
  transactions.forEach((t) => {
    const acc = t.account
    if (!acc) return
    
    if (!accountTotals[acc]) accountTotals[acc] = 0
    
    // Skip carry transactions for account totals
    if (isCarryTransaction(t)) return
    
    const amount = Number(t.amount) || 0
    const type = (t.type || '').toLowerCase()
    
    // Overall account balance
    if (type === 'income' || type === 'transfer-in') {
      accountTotals[acc] += amount
    } else if (type === 'expense' || type === 'transfer-out') {
      accountTotals[acc] -= amount
    }
  })

  // Category breakdown - memoized for performance
  const expenseByCategory = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'Expense' && !isCarryTransaction(t))
      .reduce((acc, t) => {
        const cat = t.category || 'Other'
        acc[cat] = (acc[cat] || 0) + (t.amount || 0)
        return acc
      }, {})
  }, [transactions])

  const categoryData = useMemo(() => {
    return Object.entries(expenseByCategory).map(([name, value]) => ({
      name,
      value,
    }))
  }, [expenseByCategory])

  // Monthly breakdown - memoized for performance
  const monthlyArray = useMemo(() => {
    return monthlySummaries.map(({ month, income, expense }) => ({
      month,
      income,
      expense,
    }))
  }, [monthlySummaries])

  const displayTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const ta = new Date(b.date).getTime() || 0
      const tb = new Date(a.date).getTime() || 0
      return ta - tb
    })
  }, [transactions])

  const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b', '#fa709a', '#fee140']

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="income-card">
          <p className="text-gray-600 dark:text-slate-400 text-sm font-semibold uppercase">Total Income</p>
          <p className="text-3xl font-bold text-green-600 mt-2">₹{totalIncome.toLocaleString('en-IN')}</p>
        </div>
        <div className="expense-card">
          <p className="text-gray-600 dark:text-slate-400 text-sm font-semibold uppercase">Total Expense</p>
          <p className="text-3xl font-bold text-red-600 mt-2">₹{totalExpense.toLocaleString('en-IN')}</p>
        </div>
        <div className={`stat-card ${balance >= 0 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-600' : 'bg-gradient-to-br from-orange-50 to-red-50 border-l-4 border-orange-600'}`}>
          <p className="text-gray-600 dark:text-slate-400 text-sm font-semibold uppercase">Net Balance</p>
          <p className={`text-3xl font-bold mt-2 ${balance >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
            ₹{balance.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Balance by Account Type — Individual Accounts */}
      <div className="space-y-6">
        {uniqueAccounts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {uniqueAccounts.map((accName) => {
              const currentMonth = accountSummaries[accName]
              const currentBalance = currentMonth ? currentMonth.closing : 0
              
              // Helper to decide card colors based on account name
              const isCash = accName.toLowerCase().includes('cash')
              const colorTheme = isCash 
                ? 'from-emerald-50 to-green-50 border-emerald-500 text-emerald-600'
                : 'from-indigo-50 to-blue-50 border-indigo-500 text-indigo-600'
              const textTheme = isCash ? 'text-emerald-600' : 'text-indigo-600'
              
              return (
                <div key={accName} className={`card bg-gradient-to-br border-l-4 ${colorTheme}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-gray-700 dark:text-slate-200 text-sm font-semibold uppercase">{accName}</p>
                    <span className={`text-2xl font-bold ${currentBalance >= 0 ? textTheme : 'text-red-500'}`}>
                      ₹{currentBalance.toLocaleString('en-IN')}
                    </span>
                  </div>
                  {/* Current month activity */}
                  {currentMonth && (
                    <div className={`mt-2 space-y-1 border-t pt-3 text-xs ${isCash ? 'border-emerald-100' : 'border-indigo-100'}`}>
                      <p className="text-gray-500 dark:text-slate-400 font-semibold mb-1">{monthLabel(currentMonth.month)} Activity</p>
                      {currentMonth.opening !== 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-slate-400">{currentMonth.opening >= 0 ? 'Opening Balance' : 'Opening Debt'}</span>
                          <span className={`font-semibold ${currentMonth.opening >= 0 ? 'text-gray-700 dark:text-slate-200' : 'text-red-600'}`}>
                            {currentMonth.opening >= 0 ? '' : '-'}₹{Math.abs(currentMonth.opening).toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                      {currentMonth.income > 0 && <div className="flex justify-between"><span className="text-green-600">+ Income</span><span className="font-semibold text-green-600">₹{currentMonth.income.toLocaleString('en-IN')}</span></div>}
                      {currentMonth.expense > 0 && <div className="flex justify-between"><span className="text-red-500">− Expense</span><span className="font-semibold text-red-500">₹{currentMonth.expense.toLocaleString('en-IN')}</span></div>}
                      {currentMonth.transferIn > 0 && <div className="flex justify-between"><span className="text-teal-600">+ Transfer In</span><span className="font-semibold text-teal-600">₹{currentMonth.transferIn.toLocaleString('en-IN')}</span></div>}
                      {currentMonth.transferOut > 0 && <div className="flex justify-between"><span className="text-orange-500">− Transfer Out</span><span className="font-semibold text-orange-500">₹{currentMonth.transferOut.toLocaleString('en-IN')}</span></div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="card">
          <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-4">📈 Monthly Trend</h3>
          {monthlyArray.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={monthlyArray}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip 
                  formatter={(value) => `₹${value.toLocaleString('en-IN')}`} 
                  cursor={{fill: 'rgba(200, 200, 200, 0.2)'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar 
                  dataKey="expense" 
                  name="Expense" 
                  fill="#ef4444" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40} 
                  opacity={0.8}
                />
                <Line 
                  type="monotone" 
                  dataKey="income" 
                  name="Income" 
                  stroke="#22c55e" 
                  strokeWidth={3} 
                  dot={{ r: 4, strokeWidth: 2 }} 
                  activeDot={{ r: 6 }} 
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 dark:text-slate-400">No data available</p>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-4">🎯 Expenses by Category</h3>
          {categoryData.length > 0 ? (
            <div className="flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={categoryData.length > 5 ? categoryData.length * 50 : 300}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(value) => `₹${(value/1000)}k`} />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                  <Tooltip 
                    formatter={(value) => `₹${value.toLocaleString('en-IN')}`} 
                    cursor={{fill: 'rgba(200, 200, 200, 0.2)'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-slate-400">No data available</p>
          )}
        </div>
      </div>

      {/* Top Transactions */}
      <div className="card">
        <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-4">💳 Recent Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-slate-700 border-b dark:border-slate-700">
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
              {displayTransactions.slice(0, displayCount).map((t) => (
                <tr key={t.id} className={`border-b dark:border-slate-700 transition-colors ${t.isVirtual ? 'bg-gray-100 dark:bg-slate-700 italic' : 'hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700'}`}>
                  <td className="px-4 py-2 text-gray-700 dark:text-slate-200">{formatDate(t.date)}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-slate-400">{t.account}</td>
                  <td className="px-4 py-2">{t.category}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-slate-400">{t.note}</td>
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
                        : t.type === 'Balance-In' ? 'bg-purple-100 text-purple-800'
                        : t.type === 'Balance-Out' ? 'bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-slate-100'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800'
                    }`}>
                      {t.isVirtual ? 'Auto-Balance' : t.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {displayTransactions.length > displayCount && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setDisplayCount(prev => Math.min(prev + 10, displayTransactions.length))}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
            >
              Load More ({displayCount} of {displayTransactions.length})
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
