export function parseTransactionDate(value) {
  if (!value) return new Date(NaN)
  const trimmed = String(value).trim()
  const asNum = Number(trimmed)
  if (!Number.isNaN(asNum) && /^\d+(\.\d+)?$/.test(trimmed)) {
    return new Date((asNum - 25569) * 86400 * 1000)
  }

  const isoDate = new Date(trimmed)
  if (!Number.isNaN(isoDate.getTime())) return isoDate

  const parts = trimmed.split('/')
  if (parts.length === 3) {
    const day = Number(parts[0])
    const month = Number(parts[1]) - 1
    const year = Number(parts[2])
    const dmy = new Date(year, month, day)
    if (!Number.isNaN(dmy.getTime())) return dmy
  }

  return new Date(value)
}

export function toYearMonth(value) {
  const date = parseTransactionDate(value)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function monthLabel(ym) {
  return new Date(`${ym}-01`).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
  })
}

export function isExplicitOpening(transaction = {}) {
  const text = `${transaction.category || ''} ${transaction.note || ''} ${transaction.description || ''}`.toLowerCase()
  return /\b(brought\s+down|b[\/.\-]?d|balance\s+b|balance\s+brought)\b/.test(text)
}

export function isExplicitClosing(transaction = {}) {
  const text = `${transaction.category || ''} ${transaction.note || ''} ${transaction.description || ''}`.toLowerCase()
  return /\b(carried\s+(forward|down)|c[\/.\-]?(f|d)|balance\s+c|balance\s+carried)\b/.test(text)
}

export function isCarryTransaction(transaction = {}) {
  return isExplicitOpening(transaction) || isExplicitClosing(transaction)
}

export function getMonthlyBalanceSummaries(transactions = [], orderedMonths) {
  const monthMap = {}

  for (const transaction of Array.isArray(transactions) ? transactions : []) {
    if (!transaction || !transaction.date || transaction.isVirtual) continue
    const ym = toYearMonth(transaction.date)
    if (!ym) continue
    if (!Array.isArray(monthMap[ym])) monthMap[ym] = []
    monthMap[ym].push(transaction)
  }

  const months = Array.isArray(orderedMonths) && orderedMonths.length > 0
    ? [...orderedMonths]
    : Object.keys(monthMap)

  // Get account specific summaries to correctly handle C/F per account
  const uniqueAccounts = [...new Set((Array.isArray(transactions) ? transactions : []).map(t => t.account).filter(Boolean))]
  const accountSummaries = uniqueAccounts.map(acc => 
    getAccountMonthlyBalanceSummaries(transactions, a => a === acc)
  )

  const summaries = []

  for (const ym of [...months].sort()) {
    const monthTransactions = Array.isArray(monthMap[ym]) ? monthMap[ym] : []
    let income = 0
    let expense = 0

    let opening = 0
    let closing = 0

    // Sum up the opening and closing balances from all accounts for this month
    for (const accSummaryList of accountSummaries) {
      const accMonth = accSummaryList.find(s => s.month === ym)
      if (accMonth) {
        opening += accMonth.opening
        closing += accMonth.closing
      } else {
        // If account had no activity this month, its balance carries over from the last active month
        const pastMonths = accSummaryList.filter(s => s.month <= ym)
        if (pastMonths.length > 0) {
          const last = pastMonths[pastMonths.length - 1]
          opening += last.closing
          closing += last.closing
        }
      }
    }

    for (const transaction of monthTransactions) {
      const amount = Number(transaction.amount) || 0

      // Skip explicit carry-forwards as they are already handled by account summaries
      if (isCarryTransaction(transaction)) continue

      if ((transaction.type || '').toLowerCase() === 'income') {
        income += amount
      } else if ((transaction.type || '').toLowerCase() === 'expense') {
        expense += amount
      }
    }

    summaries.push({
      month: ym,
      opening: opening,
      income,
      expense,
      closing: closing,
    })
  }

  return summaries
}

/**
 * Compute monthly balance summaries for a specific account type (e.g. Bank or Cash).
 * Like getMonthlyBalanceSummaries but filters by account and also tracks transfers.
 * Explicit b/d and c/f entries scoped to the given account type are honoured.
 *
 * @param {Array} transactions - All transactions
 * @param {Function} accountFilter - (account: string) => boolean
 * @returns {Array} Monthly summaries with { month, opening, income, expense, transferIn, transferOut, closing }
 */
export function getAccountMonthlyBalanceSummaries(transactions = [], accountFilter) {
  const monthMap = {}

  for (const t of Array.isArray(transactions) ? transactions : []) {
    if (!t || !t.date || t.isVirtual) continue
    if (!accountFilter(t.account)) continue
    const ym = toYearMonth(t.date)
    if (!ym) continue
    if (!Array.isArray(monthMap[ym])) monthMap[ym] = []
    monthMap[ym].push(t)
  }

  const months = Object.keys(monthMap)
  const summaries = []
  let previousClosing = 0

  for (const ym of [...months].sort()) {
    const monthTxs = Array.isArray(monthMap[ym]) ? monthMap[ym] : []
    let income = 0
    let expense = 0
    let transferIn = 0
    let transferOut = 0
    let opening = null
    let closing = null

    for (const t of monthTxs) {
      const amount = Number(t.amount) || 0

      if (isExplicitOpening(t)) {
        let signedAmount = amount;
        const typeStr = (t.type || '').toLowerCase();
        if (typeStr === 'expense' || typeStr === 'transfer-out' || typeStr === 'balance-out') {
          signedAmount = -Math.abs(amount);
        } else if (typeStr === 'income' || typeStr === 'transfer-in' || typeStr === 'balance-in') {
          signedAmount = Math.abs(amount);
        }
        opening = (opening || 0) + signedAmount
        continue
      }

      if (isExplicitClosing(t)) {
        let signedAmount = amount;
        const typeStr = (t.type || '').toLowerCase();
        // For Closing (C/D), 'Balance-Out' is used for positive balances (carrying out)
        // 'Balance-In' is used for negative balances (carrying in)
        // Normal Income/Expense map naturally: Income = positive closing, Expense = negative closing
        if (typeStr === 'balance-out' || typeStr === 'income' || typeStr === 'transfer-in') {
          signedAmount = Math.abs(amount);
        } else if (typeStr === 'balance-in' || typeStr === 'expense' || typeStr === 'transfer-out') {
          signedAmount = -Math.abs(amount);
        }
        closing = (closing || 0) + signedAmount
        continue
      }

      const type = (t.type || '').toLowerCase()
      if (type === 'income') income += amount
      else if (type === 'expense') expense += amount
      else if (type === 'transfer-in') transferIn += amount
      else if (type === 'transfer-out') transferOut += amount
    }

    const resolvedOpening = opening !== null ? opening : previousClosing
    const resolvedClosing = closing !== null
      ? closing
      : resolvedOpening + income - expense + transferIn - transferOut

    summaries.push({
      month: ym,
      opening: resolvedOpening,
      income,
      expense,
      transferIn,
      transferOut,
      closing: resolvedClosing,
    })

    previousClosing = resolvedClosing
  }

  return summaries
}

/**
 * Injects virtual "Balance B/D" and "Balance C/D" transactions into the list
 * for display purposes without altering the database.
 */
export function injectVirtualCarryTransactions(transactions = []) {
  if (!transactions || transactions.length === 0) return []
  
  const result = [...transactions]
  const uniqueAccounts = [...new Set(transactions.map(t => t.account).filter(Boolean))]
  
  for (const account of uniqueAccounts) {
    const accTxs = transactions.filter(t => t.account === account)
    const summaries = getAccountMonthlyBalanceSummaries(accTxs, a => a === account)
    
    for (let i = 0; i < summaries.length; i++) {
      const summary = summaries[i]
      const ym = summary.month
      const [yearStr, monthStr] = ym.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)
      
      // Inject B/D on the 1st of the month if there's an opening balance
      // We skip if it's the very first month of activity and opening is 0
      const hasExplicitOpening = accTxs.some(t => toYearMonth(t.date) === ym && isExplicitOpening(t))
      if (!hasExplicitOpening && summary.opening !== 0) {
        result.push({
          id: `virtual-bd-${account}-${ym}`,
          isVirtual: true,
          date: `${yearStr}-${monthStr}-01`,
          time: '00:00',
          account: account,
          category: 'Balance B/D',
          note: 'Opening balance',
          amount: Math.abs(summary.opening),
          type: summary.opening >= 0 ? 'Balance-In' : 'Balance-Out', // Custom type
        })
      }
      
      // Inject C/D on the last day of the month
      const hasExplicitClosing = accTxs.some(t => toYearMonth(t.date) === ym && isExplicitClosing(t))
      if (!hasExplicitClosing && summary.closing !== 0) {
        const lastDay = new Date(year, month, 0).getDate()
        result.push({
          id: `virtual-cd-${account}-${ym}`,
          isVirtual: true,
          date: `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
          time: '23:59',
          account: account,
          category: 'Balance C/D',
          note: 'Closing balance',
          amount: Math.abs(summary.closing),
          type: summary.closing >= 0 ? 'Balance-Out' : 'Balance-In', // Accounting style: positive closing balances the expense side
        })
      }
    }
  }
  
  return result
}

export function getUnifiedMonthlySummaries(transactions = []) {
  const uniqueAccounts = [...new Set((transactions || []).map(t => t.account).filter(Boolean))]
  
  // Calculate summaries for each individual account
  const accountSummaries = {}
  uniqueAccounts.forEach(acc => {
    accountSummaries[acc] = getAccountMonthlyBalanceSummaries(transactions, a => a === acc)
  })

  // Collect all unique months
  const monthSet = new Set()
  Object.values(accountSummaries).forEach(list => list.forEach(s => monthSet.add(s.month)))
  const allMonths = Array.from(monthSet).sort()

  const unified = []
  
  // Track previous closing balances for all accounts
  const prevClosing = {}
  uniqueAccounts.forEach(acc => prevClosing[acc] = 0)

  for (const ym of allMonths) {
    const monthAccounts = {}
    let totalOpening = 0
    let totalIncome = 0
    let totalExpense = 0
    let totalTransferIn = 0
    let totalTransferOut = 0
    let totalClosing = 0

    for (const acc of uniqueAccounts) {
      let accData = accountSummaries[acc].find(s => s.month === ym)
      if (!accData) {
        accData = {
          month: ym,
          opening: prevClosing[acc],
          income: 0,
          expense: 0,
          transferIn: 0,
          transferOut: 0,
          closing: prevClosing[acc]
        }
      } else {
        prevClosing[acc] = accData.closing
      }
      
      monthAccounts[acc] = accData
      
      totalOpening += accData.opening
      totalIncome += accData.income
      totalExpense += accData.expense
      totalTransferIn += accData.transferIn
      totalTransferOut += accData.transferOut
      totalClosing += accData.closing
    }

    const total = {
      month: ym,
      opening: totalOpening,
      income: totalIncome,
      expense: totalExpense,
      transferIn: totalTransferIn,
      transferOut: totalTransferOut,
      closing: totalClosing
    }

    unified.push({
      month: ym,
      accounts: monthAccounts,
      total
    })
  }

  return unified
}

