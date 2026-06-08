import React, { useEffect, useMemo, useState } from 'react'
import {
  getMonthlyBalanceSummaries,
  getAccountMonthlyBalanceSummaries,
  monthLabel,
  parseTransactionDate,
  toYearMonth,
} from '../utils/monthlyBalances'

export default function CalendarView({ transactions = [], onEdit, onAddDate, onCalculateBalances }) {
  const formatMoney = (amount) => {
    const value = Number(amount) || 0
    const abs = Math.abs(value).toLocaleString('en-IN')
    return value < 0 ? `-₹${abs}` : `₹${abs}`
  }
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
    const sortedYears = Array.from(years).sort((a, b) => b - a) // descending years
    for (const year of sortedYears) {
      for (let m = 12; m >= 1; m -= 1) {
        const mm = String(m).padStart(2, '0')
        list.push(`${year}-${mm}`)
      }
    }
    return list
  }, [transactionList])

  // Persist autoSync preference to localStorage
  useEffect(() => {
    localStorage.setItem('calendarAutoSync', JSON.stringify(autoSync))
  }, [autoSync])

  // Auto-sync when month changes
  useEffect(() => {
    if (autoSync && selectedMonth && typeof onCalculateBalances === 'function') {
      onCalculateBalances(selectedMonth)
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

  const monthlyBalances = useMemo(() => {
    return getMonthlyBalanceSummaries(transactionList, monthsList).reduce((result, summary) => {
      result[summary.month] = summary
      return result
    }, {})
  }, [monthsList, transactionList])

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
      for (const transaction of txs.slice(0, 3)) {
        preview.push(`${transaction.note || ''} ₹${transaction.amount || 0}`.trim())
      }

      const dayLabel = preview.join('\n')
      dayCells.push(
        <div
          key={day}
          className="p-2 border rounded min-h-[64px] cursor-pointer"
          title={dayLabel}
          onClick={() => setSelectedDay(day)}
        >
          <div className="flex justify-between items-start">
            <span className="font-medium">{day}</span>
            {txs.length > 0 && <span className="text-xs bg-blue-100 text-blue-800 px-2 rounded">{txs.length}</span>}
          </div>
          <div className="mt-2 space-y-1 text-xs">
            {(() => {
              const nodes = []
              for (const transaction of txs.slice(0, 3)) {
                nodes.push(
                  <div key={transaction.id} className="truncate">
                    <span className={`mr-1 ${
                      transaction.isVirtual ? 'text-purple-500 font-bold italic' :
                      String(transaction.type || '').toLowerCase() === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ₹{(Number(transaction.amount) || 0).toLocaleString('en-IN')}
                    </span>
                    <span className={`${transaction.isVirtual ? 'text-purple-400 italic' : 'text-gray-700'}`}>
                      {transaction.isVirtual ? transaction.category : (transaction.category || '—')}
                    </span>
                  </div>
                )
              }
              return nodes
            })()}
            {txs.length > 3 && <div className="text-gray-400">+{txs.length - 3} more</div>}
          </div>
        </div>
      )
    }
  }

  const selectedDayTransactions = selectedDay && Array.isArray(daysMap[selectedDay]) ? daysMap[selectedDay] : []
  const selectedMonthSummary = selectedMonth ? monthlyBalances[selectedMonth] : null
  const selectedMonthAccountSummaries = useMemo(() => {
    if (!selectedMonth) return []
    const accounts = Array.from(new Set(transactionList.map((t) => t?.account).filter(Boolean))).sort((a, b) => a.localeCompare(b))
    return accounts
      .map((account) => {
        const byMonth = getAccountMonthlyBalanceSummaries(transactionList, (name) => String(name) === String(account))
        const summary = byMonth.find((item) => item.month === selectedMonth)
        return summary ? { account, ...summary } : null
      })
      .filter(Boolean)
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
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
            <p className="text-sm text-gray-500 mt-3">Closing is carried forward to the next month as opening.</p>
            {selectedMonthAccountSummaries.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Account-wise</p>
                <div className="space-y-1 text-sm">
                  {selectedMonthAccountSummaries.map((item) => (
                    <div key={item.account} className="flex justify-between gap-2">
                      <span className="truncate">{item.account}</span>
                      <strong className={item.closing >= 0 ? 'text-gray-700' : 'text-red-600'}>{formatMoney(item.closing)}</strong>
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
        <div className="text-center py-12 text-gray-500">No months available</div>
      )}

      {selectedDay && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg max-w-2xl w-full p-4">
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
              {selectedDayTransactions.map((transaction) => (
                <div key={transaction.id} className={`p-2 border rounded flex justify-between items-center ${transaction.isVirtual ? 'bg-purple-50 border-purple-200' : ''}`}>
                  <div>
                    <div className={`font-medium ${transaction.isVirtual ? 'text-purple-700 italic' : ''}`}>
                      {transaction.time && <span className={`mr-2 text-xs px-1 rounded ${transaction.isVirtual ? 'bg-purple-200 text-purple-800' : 'bg-gray-100 text-gray-500'}`}>{transaction.time}</span>}
                      {transaction.note || transaction.category || '—'}
                    </div>
                    <div className={`text-sm ${transaction.isVirtual ? 'text-purple-600' : 'text-gray-600'}`}>
                      {transaction.category} • ₹{(Number(transaction.amount) || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  {!transaction.isVirtual && (
                  <button
                    onClick={() => {
                      if (typeof onEdit === 'function') onEdit(transaction)
                    }}
                    className="px-3 py-1 bg-blue-500 text-white rounded"
                  >
                      Edit
                    </button>
                  )}
                </div>
              ))}
              {selectedDayTransactions.length === 0 && <div className="text-center text-gray-500 p-6">No transactions</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
