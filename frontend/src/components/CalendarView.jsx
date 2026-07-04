import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  getMonthlyBalanceSummaries,
  getAccountMonthlyBalanceSummaries,
  monthLabel,
  parseTransactionDate,
  toYearMonth,
} from '../utils/monthlyBalances'

const NEARBY_MONTHS = 2 // Load current month ± 2 months for smoother experience

export default function CalendarView({ transactions = [], onEdit, onAddDate, onCalculateBalances }) {
  const formatMoney = useCallback((amount) => {
    const value = Number(amount) || 0
    const abs = Math.abs(value).toLocaleString('en-IN')
    return value < 0 ? `-₹${abs}` : `₹${abs}`
  }, [])

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedDay, setSelectedDay] = useState(null)
  const [autoSync, setAutoSync] = useState(() => {
    const saved = localStorage.getItem('calendarAutoSync')
    return saved ? JSON.parse(saved) : false
  })

  const transactionList = Array.isArray(transactions) ? transactions : []

  const monthMap = useMemo(() => {
    const grouped = {}
    for (const transaction of transactionList) {
      if (!transaction || !transaction.date) continue
      const ym = toYearMonth(transaction.date)
      if (!ym) continue
      if (!Array.isArray(grouped[ym])) grouped[ym] = []
      grouped[ym].push(transaction)
    }
    return grouped
  }, [transactionList])

  const monthsList = useMemo(() => {
    const years = new Set([new Date().getFullYear()])
    for (const transaction of transactionList) {
      if (!transaction || !transaction.date) continue
      const date = parseTransactionDate(transaction.date)
      if (!Number.isNaN(date.getTime())) {
        years.add(date.getFullYear())
      }
    }
    const list = []
    const sortedYears = Array.from(years).sort((a, b) => b - a)
    for (const year of sortedYears) {
      for (let m = 12; m >= 1; m -= 1) {
        const mm = String(m).padStart(2, '0')
        list.push(`${year}-${mm}`)
      }
    }
    return list
  }, [transactionList])

  // Get nearby months to load (current ± NEARBY_MONTHS)
  const nearbyMonths = useMemo(() => {
    if (!selectedMonth || monthsList.length === 0) return []
    const currentIndex = monthsList.indexOf(selectedMonth)
    if (currentIndex === -1) return [selectedMonth]
    
    const start = Math.max(0, currentIndex - NEARBY_MONTHS)
    const end = Math.min(monthsList.length, currentIndex + NEARBY_MONTHS + 1)
    return monthsList.slice(start, end)
  }, [selectedMonth, monthsList])

  // Optimize: Only calculate balances for selected month and nearby months
  const monthlyBalances = useMemo(() => {
    return getMonthlyBalanceSummaries(transactionList, nearbyMonths).reduce((result, summary) => {
      result[summary.month] = summary
      return result
    }, {})
  }, [transactionList, nearbyMonths])

  // Persist autoSync preference to localStorage
  useEffect(() => {
    localStorage.setItem('calendarAutoSync', JSON.stringify(autoSync))
  }, [autoSync])

  // Auto-sync when month changes (with debounce to avoid rapid calls)
  useEffect(() => {
    if (autoSync && selectedMonth && typeof onCalculateBalances === 'function') {
      const timer = setTimeout(() => {
        onCalculateBalances(selectedMonth)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [selectedMonth, autoSync, onCalculateBalances])

  useEffect(() => {
    if (!selectedMonth && monthsList.length > 0) {
      setSelectedMonth(monthsList[0])
    }
  }, [monthsList, selectedMonth])

  useEffect(() => {
    if (selectedMonth && !monthsList.includes(selectedMonth) && monthsList.length > 0) {
      setSelectedMonth(monthsList[0])
    }
  }, [monthsList, selectedMonth])

  const daysMap = useMemo(() => {
    const grouped = {}
    const txs = selectedMonth && Array.isArray(monthMap[selectedMonth]) ? monthMap[selectedMonth] : []

    for (const transaction of txs) {
      const date = parseTransactionDate(transaction.date)
      if (Number.isNaN(date.getTime())) continue
      const day = date.getDate()
      if (!Array.isArray(grouped[day])) grouped[day] = []
      grouped[day].push(transaction)
    }

    return grouped
  }, [monthMap, selectedMonth])

  const monthOptions = []
  for (const ym of monthsList) {
    monthOptions.push(
      <option key={ym} value={ym}>
        {monthLabel(ym)}
      </option>
    )
  }

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weekdayNodes = []
  for (const weekday of weekdayLabels) {
    weekdayNodes.push(
      <div key={weekday} className="text-center font-semibold">
        {weekday}
      </div>
    )
  }

  const dayCells = []
  if (selectedMonth) {
    const first = new Date(`${selectedMonth}-01`)
    const year = first.getFullYear()
    const month = first.getMonth()
    const startingDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    for (let i = 0; i < startingDay; i += 1) {
      dayCells.push(<div key={`empty-${i}`} />)
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const txs = Array.isArray(daysMap[day]) ? daysMap[day] : []
      const preview = []
      
      // Calculate income and expense totals for the day
      let dayIncome = 0
      let dayExpense = 0
      
      for (const transaction of txs) {
        const amount = Number(transaction.amount) || 0
        const type = String(transaction.type || '').toLowerCase()
        if (type === 'income' || type === 'transfer-in') {
          dayIncome += amount
        } else if (type === 'expense' || type === 'transfer-out') {
          dayExpense += amount
        }
      }
      
      // Determine border color based on income/expense
      let borderColor = 'border-gray-200 dark:border-slate-700'
      if (dayIncome > 0 && dayExpense === 0) {
        borderColor = 'border-green-500 border-2'
      } else if (dayExpense > 0 && dayIncome === 0) {
        borderColor = 'border-red-500 border-2'
      } else if (dayIncome > 0 && dayExpense > 0) {
        borderColor = 'border-blue-500 border-2'
      }
      
      for (const transaction of txs.slice(0, 3)) {
        preview.push(`${transaction.note || ''} ₹${transaction.amount || 0}`.trim())
      }

      const dayLabel = preview.join('\n')
      dayCells.push(
        <div
          key={day}
          className={`p-2 rounded min-h-[64px] cursor-pointer border transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 ${borderColor}`}
          title={dayLabel}
          onClick={() => setSelectedDay(day)}
        >
          <div className="flex justify-between items-start">
            <span className="font-medium">{day}</span>
            {txs.length > 0 && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 rounded">{txs.length}</span>}
          </div>
          <div className="mt-2 space-y-1 text-xs">
            {(() => {
              const nodes = []
              for (const transaction of txs.slice(0, 3)) {
                nodes.push(
                  <div key={transaction.id} className="truncate">
                    <span className={`mr-1 ${
                      transaction.isVirtual ? 'text-purple-500 font-bold italic' :
                      String(transaction.type || '').toLowerCase() === 'income' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'
                    }`}>
                      ₹{(Number(transaction.amount) || 0).toLocaleString('en-IN')}
                    </span>
                    <span className={`${transaction.isVirtual ? 'text-purple-400 italic' : 'text-gray-700 dark:text-slate-300'}`}>
                      {transaction.isVirtual ? transaction.category : (transaction.category || '—')}
                    </span>
                  </div>
                )
              }
              return nodes
            })()}
            {txs.length > 3 && <div className="text-gray-400 dark:text-slate-500">+{txs.length - 3} more</div>}
          </div>
        </div>
      )
    }
  }

  const selectedDayTransactions = selectedDay && Array.isArray(daysMap[selectedDay]) ? daysMap[selectedDay] : []
  const selectedMonthSummary = selectedMonth ? monthlyBalances[selectedMonth] : null
  
  // Optimize: Only calculate account summaries for selected month, with lazy initialization
  const selectedMonthAccountSummaries = useMemo(() => {
    if (!selectedMonth) return []
    
    const accounts = Array.from(new Set(transactionList.map((t) => t?.account).filter(Boolean))).sort((a, b) => a.localeCompare(b))
    const summaries = []
    
    for (const account of accounts) {
      // Only calculate for this specific account
      const monthTxs = transactionList.filter(t => String(t?.account) === String(account))
      if (monthTxs.length === 0) continue
      
      const byMonth = getAccountMonthlyBalanceSummaries(monthTxs, () => true)
      const summary = byMonth.find((item) => item.month === selectedMonth)
      
      if (summary) {
        summaries.push({ account, ...summary })
      }
    }
    
    return summaries
  }, [selectedMonth, transactionList])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">🗓️ Transactions Calendar</h2>
        <div className="flex gap-2 items-center">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="input-field">
            {monthOptions}
          </select>
          <button
            onClick={() => setAutoSync(!autoSync)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
              autoSync
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md'
                : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-600'
            }`}
            title={autoSync ? 'Auto sync is ON - balances will update when you change months' : 'Click to enable auto sync'}
          >
            {autoSync ? '✅ Auto Sync ON' : '⏸️ Auto Sync OFF'}
          </button>
          {typeof onCalculateBalances === 'function' && (
            <>
              <button
                onClick={() => onCalculateBalances(selectedMonth)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform active:scale-95 transition-all duration-150 flex items-center gap-2"
              >
                🔄 Calculate This Month
              </button>
              <button
                onClick={() => onCalculateBalances('all')}
                className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform active:scale-95 transition-all duration-150 flex items-center gap-2"
                title="Calculate and update balances for all months"
              >
                🔄 Calculate All Months
              </button>
            </>
          )}
        </div>
      </div>

      {selectedMonth ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-4">
            <h3 className="text-lg font-semibold mb-2">Summary — {monthLabel(selectedMonth)}</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Opening (B/D)</span>
                <strong>{formatMoney(selectedMonthSummary?.opening || 0)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Total Income</span>
                <strong className="text-green-600">{formatMoney(selectedMonthSummary?.income || 0)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Total Expense</span>
                <strong className="text-red-600">{formatMoney(selectedMonthSummary?.expense || 0)}</strong>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span>Closing (C/F)</span>
                <strong>{formatMoney(selectedMonthSummary?.closing || 0)}</strong>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-3">Closing is carried forward to the next month as opening.</p>
            {selectedMonthAccountSummaries.length > 0 && (
              <div className="mt-4 border-t border-gray-200 dark:border-slate-700 pt-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-3 tracking-wider">Account-wise Breakdown</p>
                <div className="space-y-4 text-sm">
                  {selectedMonthAccountSummaries.map((item) => (
                    <div key={item.account} className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg border border-gray-100 dark:border-slate-700 shadow-sm">
                      <div className="font-semibold text-gray-800 dark:text-slate-100 mb-2 pb-1 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
                        {item.account.toLowerCase().includes('cash') ? '💵' : '🏦'} {item.account}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-gray-600 dark:text-slate-300">
                          <span>Opening (B/D)</span>
                          <span className="font-medium text-blue-700 dark:text-blue-400">{formatMoney(item.opening)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600 dark:text-slate-300">
                          <span>Income</span>
                          <span className="font-medium text-green-600">{formatMoney(item.income)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600 dark:text-slate-300">
                          <span>Expense</span>
                          <span className="font-medium text-red-600">{formatMoney(item.expense)}</span>
                        </div>
                        <div className="flex justify-between pt-1 mt-1 border-t border-gray-200 dark:border-slate-700">
                          <span className="font-semibold text-gray-700 dark:text-slate-300">Closing (C/F)</span>
                          <strong className={item.closing >= 0 ? 'text-gray-900 dark:text-slate-100' : 'text-red-700 dark:text-red-400'}>{formatMoney(item.closing)}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card p-4 md:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Calendar View</h3>
            <div className="grid grid-cols-7 gap-2 text-sm">
              {weekdayNodes}
              {dayCells}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-slate-400">No months available</div>
      )}

      {selectedDay && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded shadow-lg max-w-2xl w-full p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Transactions for {monthLabel(selectedMonth)} - {selectedDay}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const iso = `${selectedMonth}-${String(selectedDay).padStart(2, '0')}`
                    if (typeof onAddDate === 'function') onAddDate(iso)
                  }}
                  className="btn-primary"
                >
                  ➕ Add Transaction
                </button>
                <button onClick={() => setSelectedDay(null)} className="btn-secondary">
                  Close
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {selectedDayTransactions.map((transaction) => {
                const isIncome = String(transaction.type || '').toLowerCase() === 'income' || String(transaction.type || '').toLowerCase() === 'transfer-in'
                const isExpense = String(transaction.type || '').toLowerCase() === 'expense' || String(transaction.type || '').toLowerCase() === 'transfer-out'
                
                let cardBgColor = 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                let badgeColor = 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-100'
                
                if (transaction.isVirtual) {
                  cardBgColor = 'bg-purple-50 border-purple-200'
                  badgeColor = 'bg-purple-200 text-purple-800'
                } else if (isIncome) {
                  cardBgColor = 'bg-green-50 border-green-300 border-l-4 border-l-green-500'
                  badgeColor = 'bg-green-200 text-green-800'
                } else if (isExpense) {
                  cardBgColor = 'bg-red-50 border-red-300 border-l-4 border-l-red-500'
                  badgeColor = 'bg-red-200 text-red-800'
                }
                
                return (
                  <div key={transaction.id} className={`p-3 border rounded-lg flex justify-between items-center transition-colors ${cardBgColor}`}>
                    <div className="flex-1">
                      <div className={`font-semibold flex items-center gap-2 ${transaction.isVirtual ? 'text-purple-700 italic' : isIncome ? 'text-green-700' : isExpense ? 'text-red-700' : 'text-gray-700 dark:text-slate-300'}`}>
                        {transaction.time && <span className={`text-xs px-2 py-1 rounded font-medium ${badgeColor}`}>{transaction.time}</span>}
                        <span>{transaction.note || transaction.category || '—'}</span>
                      </div>
                      <div className={`text-sm mt-1 ${transaction.isVirtual ? 'text-purple-600' : 'text-gray-600 dark:text-slate-300'}`}>
                        {transaction.category} • {transaction.account || ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <div className="text-right">
                        <div className={`text-lg font-bold ${isIncome ? 'text-green-600' : isExpense ? 'text-red-600' : 'text-gray-700 dark:text-slate-300'}`}>
                          {isIncome ? '+' : isExpense ? '−' : ''}₹{(Number(transaction.amount) || 0).toLocaleString('en-IN')}
                        </div>
                        <div className={`text-xs font-semibold px-2 py-1 rounded mt-1 ${
                          transaction.isVirtual ? 'bg-purple-100 text-purple-800' :
                          isIncome ? 'bg-green-100 text-green-800' :
                          isExpense ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-100'
                        }`}>
                          {transaction.isVirtual ? 'Auto' : isIncome ? 'Income' : isExpense ? 'Expense' : 'Transfer'}
                        </div>
                      </div>
                      {!transaction.isVirtual && (
                        <button
                          onClick={() => {
                            if (typeof onEdit === 'function') onEdit(transaction)
                          }}
                          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
                        >
                          ✏️ Edit
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {selectedDayTransactions.length === 0 && <div className="text-center text-gray-500 dark:text-slate-400 p-6">No transactions</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
