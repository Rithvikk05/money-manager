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
  return /\b(brought\s+down|b\/d|balance\s+b|balance\s+brought)\b/.test(text)
}

export function isExplicitClosing(transaction = {}) {
  const text = `${transaction.category || ''} ${transaction.note || ''} ${transaction.description || ''}`.toLowerCase()
  return /\b(carried\s+forward|c\/f|balance\s+c|balance\s+carried)\b/.test(text)
}

export function isCarryTransaction(transaction = {}) {
  return isExplicitOpening(transaction) || isExplicitClosing(transaction)
}

export function getMonthlyBalanceSummaries(transactions = [], orderedMonths) {
  const monthMap = {}

  for (const transaction of Array.isArray(transactions) ? transactions : []) {
    if (!transaction || !transaction.date) continue
    const ym = toYearMonth(transaction.date)
    if (!ym) continue
    if (!Array.isArray(monthMap[ym])) monthMap[ym] = []
    monthMap[ym].push(transaction)
  }

  const months = Array.isArray(orderedMonths) && orderedMonths.length > 0
    ? [...orderedMonths]
    : Object.keys(monthMap)

  const summaries = []
  let previousClosing = 0

  for (const ym of [...months].sort()) {
    const monthTransactions = Array.isArray(monthMap[ym]) ? monthMap[ym] : []
    let income = 0
    let expense = 0
    let opening = null
    let closing = null

    for (const transaction of monthTransactions) {
      const amount = Number(transaction.amount) || 0

      if (isExplicitOpening(transaction)) {
        opening = (opening || 0) + amount
        continue
      }

      if (isExplicitClosing(transaction)) {
        closing = (closing || 0) + amount
        continue
      }

      if ((transaction.type || '').toLowerCase() === 'income') {
        income += amount
      } else if ((transaction.type || '').toLowerCase() === 'expense') {
        expense += amount
      }
    }

    const resolvedOpening = opening !== null ? opening : previousClosing
    const resolvedClosing = closing !== null ? closing : resolvedOpening + income - expense

    summaries.push({
      month: ym,
      opening: resolvedOpening,
      income,
      expense,
      closing: resolvedClosing,
    })

    previousClosing = resolvedClosing
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
    if (!t || !t.date) continue
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
        opening = (opening || 0) + amount
        continue
      }

      if (isExplicitClosing(t)) {
        closing = (closing || 0) + amount
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
