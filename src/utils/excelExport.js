import { monthLabel } from './monthlyBalances'

/**
 * Generate and download an Excel file with monthly summaries
 * @param {string} accountType - 'cash', 'bank', or 'all'
 * @param {Array|Object} summaries - Monthly summary data
 * @param {Array} transactions - All transactions for the account
 */
export async function exportToExcel(accountType, summaries, transactions) {
  try {
    // Dynamically import XLSX for Vite compatibility
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    if (accountType === 'all') {
      // Export all accounts
      const cashTxs = transactions.filter((t) => t.account && t.account.toLowerCase().includes('cash'))
      const bankTxs = transactions.filter((t) => t.account && (t.account.toLowerCase().includes('bank') || t.account.toLowerCase().includes('card')))
      
      const cashSummaries = summaries.map(s => s.cash)
      const bankSummaries = summaries.map(s => s.bank)

      createDashboardSheet(wb, cashSummaries, bankSummaries, XLSX)
      createTransactionSheet(wb, 'Cash Transactions', cashTxs, XLSX)
      createTransactionSheet(wb, 'Bank Transactions', bankTxs, XLSX)
      createUnifiedSummarySheet(wb, 'Monthly Summary', summaries, XLSX)
    } else if (accountType === 'summary') {
      createUnifiedSummarySheet(wb, 'Monthly Summary', summaries, XLSX)
    }

    // Set column widths if not already defined by the sheet builder
    Object.values(wb.Sheets).forEach((sheet) => {
      if (!sheet['!cols']) {
        sheet['!cols'] = [
          { wch: 15 }, // Date
          { wch: 20 }, // Account
          { wch: 15 }, // Category
          { wch: 15 }, // Type
          { wch: 15 }, // Amount
          { wch: 25 }, // Note/Description
        ]
      }
    })

    // Generate filename with timestamp
    const timestamp = new Date().toLocaleDateString('en-IN').replace(/\//g, '-')
    const filename = `MoneyManager_${accountType.toUpperCase()}_${timestamp}.xlsx`

    // Write file
    XLSX.writeFile(wb, filename)
  } catch (error) {
    console.error('Error exporting to Excel:', error)
    throw new Error('Failed to export to Excel. Please ensure xlsx library is installed.')
  }
}

/**
 * Create a summary sheet with monthly data
 */
function createSummarySheet(wb, sheetName, summaries, transactions, XLSX) {
  const data = [
    ['Monthly Summary Report'],
    ['Generated on:', new Date().toLocaleString('en-IN')],
    [''],
    ['Month', 'Opening Balance', 'Monthly Income', 'Monthly Expenses', 'Closing Balance'],
    ...summaries.map((summary) => [
      monthLabel(summary.month),
      summary.opening || 0,
      summary.income || 0,
      summary.expense || 0,
      summary.closing || 0,
    ]),
    [''],
    ['TOTALS', summaries[0]?.opening || 0, summaries.reduce((sum, s) => sum + (s.income || 0), 0), summaries.reduce((sum, s) => sum + (s.expense || 0), 0), summaries[summaries.length - 1]?.closing || 0],
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Apply styling (basic formatting)
  const style = {
    font: { bold: true },
    alignment: { horizontal: 'center' },
    fill: { fgColor: { rgb: 'FFD3D3D3' } },
  }

  // Style header row
  for (let i = 0; i < 5; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 3, c: i })
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: 'FF4472C4' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }
  }

  // Format numbers as currency
  for (let row = 4; row < 4 + summaries.length; row++) {
    for (let col = 1; col < 5; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
      const cell = ws[cellRef]
      if (cell) {
        cell.z = '#,##0.00'
      }
    }
  }

  // Style totals row
  const totalRow = 4 + summaries.length + 1
  for (let i = 0; i < 5; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: totalRow, c: i })
    const cell = ws[cellRef]
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: 'FF70AD47' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName)
}

/**
 * Create a detailed transactions sheet
 */
function createTransactionSheet(wb, sheetName, transactions, XLSX) {
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr)
      if (Number.isNaN(date.getTime())) return dateStr
      return date.toLocaleDateString('en-IN')
    } catch {
      return dateStr
    }
  }

  const data = [
    ['Transaction Details Report'],
    ['Generated on:', new Date().toLocaleString('en-IN')],
    [''],
    ['Date', 'Account', 'Category', 'Type', 'Amount (₹)', 'Note/Description'],
    ...transactions
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((t) => [
        formatDate(t.date),
        t.account || '',
        t.category || '',
        t.type || '',
        t.amount || 0,
        t.note || t.description || '',
      ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Style header row (row 3)
  for (let i = 0; i < 6; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 3, c: i })
    if (ws[cellRef]) {
      ws[cellRef].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: 'FF4472C4' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      }
    }
  }

  // Format amount columns and alternate row colors
  for (let row = 4; row < 4 + transactions.length; row++) {
    // Amount formatting
    const amountCellRef = XLSX.utils.encode_cell({ r: row, c: 4 })
    if (ws[amountCellRef]) {
      ws[amountCellRef].z = '#,##0.00'
      ws[amountCellRef].s = {
        alignment: { horizontal: 'right' },
        ...(row % 2 === 0 && { fill: { fgColor: { rgb: 'FFF2F2F2' } } }),
      }
    }

    // Alternate row background color
    if (row % 2 === 0) {
      for (let col = 0; col < 6; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
        if (ws[cellRef] && col !== 4) {
          ws[cellRef].s = {
            fill: { fgColor: { rgb: 'FFF2F2F2' } },
            alignment: { horizontal: col === 4 ? 'right' : 'left' },
          }
        }
      }
    }
  }

  // Set proper column widths for transactions
  ws['!cols'] = [
    { wch: 15 }, // Date
    { wch: 18 }, // Account
    { wch: 16 }, // Category
    { wch: 14 }, // Type
    { wch: 16 }, // Amount
    { wch: 30 }, // Note/Description
  ]

  XLSX.utils.book_append_sheet(wb, ws, sheetName)
}

/**
 * Create a dashboard sheet with key metrics
 */
function createDashboardSheet(wb, cashSummaries, bankSummaries, XLSX) {
  const cashData = cashSummaries.length > 0
  const bankData = bankSummaries.length > 0

  const data = [
    ['💰 Money Manager - Dashboard'],
    ['Report Generated:', new Date().toLocaleString('en-IN')],
    [''],
  ]

  // Add summary statistics
  if (cashData) {
    const lastCash = cashSummaries[cashSummaries.length - 1]
    const totalCashIncome = cashSummaries.reduce((sum, s) => sum + (s.income || 0), 0)
    const totalCashExpense = cashSummaries.reduce((sum, s) => sum + (s.expense || 0), 0)

    data.push(
      ['CASH ACCOUNT SUMMARY'],
      ['Current Balance', lastCash?.closing || 0],
      ['Total Income', totalCashIncome],
      ['Total Expenses', totalCashExpense],
      ['Net', totalCashIncome - totalCashExpense],
      [''],
    )
  }

  if (bankData) {
    const lastBank = bankSummaries[bankSummaries.length - 1]
    const totalBankIncome = bankSummaries.reduce((sum, s) => sum + (s.income || 0), 0)
    const totalBankExpense = bankSummaries.reduce((sum, s) => sum + (s.expense || 0), 0)

    data.push(
      ['BANK/CARD ACCOUNT SUMMARY'],
      ['Current Balance', lastBank?.closing || 0],
      ['Total Income', totalBankIncome],
      ['Total Expenses', totalBankExpense],
      ['Net', totalBankIncome - totalBankExpense],
      [''],
    )
  }

  if (cashData && bankData) {
    const totalBalance = (cashSummaries[cashSummaries.length - 1]?.closing || 0) + (bankSummaries[bankSummaries.length - 1]?.closing || 0)
    const totalIncome = cashSummaries.reduce((sum, s) => sum + (s.income || 0), 0) + bankSummaries.reduce((sum, s) => sum + (s.income || 0), 0)
    const totalExpense = cashSummaries.reduce((sum, s) => sum + (s.expense || 0), 0) + bankSummaries.reduce((sum, s) => sum + (s.expense || 0), 0)

    data.push(
      ['OVERALL SUMMARY'],
      ['Total Balance', totalBalance],
      ['Total Income', totalIncome],
      ['Total Expenses', totalExpense],
      ['Net Savings', totalIncome - totalExpense],
    )
  }

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Set column widths for dashboard
  ws['!cols'] = [{ wch: 30 }, { wch: 20 }]

  // Style title
  const titleCell = ws['A1']
  if (titleCell) {
    titleCell.s = {
      font: { bold: true, size: 16, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: 'FF4472C4' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Dashboard', 0) // Insert at beginning
}

/**
 * Create a unified monthly summary sheet in Excel
 */
function createUnifiedSummarySheet(wb, sheetName, unifiedSummaries, XLSX) {
  const cashTotals = {
    opening: unifiedSummaries[0]?.cash.opening || 0,
    income: unifiedSummaries.reduce((sum, s) => sum + (s.cash.income || 0), 0),
    expense: unifiedSummaries.reduce((sum, s) => sum + (s.cash.expense || 0), 0),
    netTransfers: unifiedSummaries.reduce((sum, s) => sum + ((s.cash.transferIn || 0) - (s.cash.transferOut || 0)), 0),
    closing: unifiedSummaries[unifiedSummaries.length - 1]?.cash.closing || 0
  }

  const bankTotals = {
    opening: unifiedSummaries[0]?.bank.opening || 0,
    income: unifiedSummaries.reduce((sum, s) => sum + (s.bank.income || 0), 0),
    expense: unifiedSummaries.reduce((sum, s) => sum + (s.bank.expense || 0), 0),
    netTransfers: unifiedSummaries.reduce((sum, s) => sum + ((s.bank.transferIn || 0) - (s.bank.transferOut || 0)), 0),
    closing: unifiedSummaries[unifiedSummaries.length - 1]?.bank.closing || 0
  }

  const overallTotals = {
    opening: unifiedSummaries[0]?.total.opening || 0,
    income: unifiedSummaries.reduce((sum, s) => sum + (s.total.income || 0), 0),
    expense: unifiedSummaries.reduce((sum, s) => sum + (s.total.expense || 0), 0),
    netTransfers: unifiedSummaries.reduce((sum, s) => sum + ((s.total.transferIn || 0) - (s.total.transferOut || 0)), 0),
    closing: unifiedSummaries[unifiedSummaries.length - 1]?.total.closing || 0
  }

  const data = [
    ['Monthly Summary Report'],
    ['Generated on:', new Date().toLocaleString('en-IN')],
    [''],
    ['Month', 'Account', 'Opening Balance', 'Monthly Income', 'Monthly Expenses', 'Net Transfers', 'Closing Balance'],
  ]

  for (const s of unifiedSummaries) {
    data.push([
      monthLabel(s.month),
      'Cash',
      s.cash.opening || 0,
      s.cash.income || 0,
      s.cash.expense || 0,
      (s.cash.transferIn || 0) - (s.cash.transferOut || 0),
      s.cash.closing || 0,
    ])
    data.push([
      '',
      'Bank & Card',
      s.bank.opening || 0,
      s.bank.income || 0,
      s.bank.expense || 0,
      (s.bank.transferIn || 0) - (s.bank.transferOut || 0),
      s.bank.closing || 0,
    ])
    data.push([
      '',
      'Total',
      s.total.opening || 0,
      s.total.income || 0,
      s.total.expense || 0,
      (s.total.transferIn || 0) - (s.total.transferOut || 0),
      s.total.closing || 0,
    ])
  }

  data.push([''])
  data.push(['Grand Total - Cash', '', cashTotals.opening, cashTotals.income, cashTotals.expense, cashTotals.netTransfers, cashTotals.closing])
  data.push(['Grand Total - Bank & Card', '', bankTotals.opening, bankTotals.income, bankTotals.expense, bankTotals.netTransfers, bankTotals.closing])
  data.push(['Grand Total - Overall', '', overallTotals.opening, overallTotals.income, overallTotals.expense, overallTotals.netTransfers, overallTotals.closing])

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Set column widths
  ws['!cols'] = [
    { wch: 18 }, // Month
    { wch: 15 }, // Account
    { wch: 18 }, // Opening Balance
    { wch: 18 }, // Monthly Income
    { wch: 18 }, // Monthly Expenses
    { wch: 18 }, // Net Transfers
    { wch: 18 }, // Closing Balance
  ]

  // Style header row (row 3, index 3)
  for (let i = 0; i < 7; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 3, c: i })
    if (ws[cellRef]) {
      ws[cellRef].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: 'FF4472C4' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      }
    }
  }

  // Format numbers as currency in data rows
  const numMonths = unifiedSummaries.length
  for (let row = 4; row < 4 + (numMonths * 3); row++) {
    for (let col = 2; col < 7; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
      const cell = ws[cellRef]
      if (cell) {
        cell.z = '#,##0.00'
      }
    }
  }

  // Format grand totals rows (the last three rows after the empty line)
  const totalsStartRow = 4 + (numMonths * 3) + 1
  for (let row = totalsStartRow; row < totalsStartRow + 3; row++) {
    for (let col = 2; col < 7; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
      const cell = ws[cellRef]
      if (cell) {
        cell.z = '#,##0.00'
      }
    }

    // Apply color to the overall grand total row (last row)
    if (row === totalsStartRow + 2) {
      for (let col = 0; col < 7; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
        const cell = ws[cellRef]
        if (cell) {
          cell.s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: 'FF70AD47' } },
          }
        }
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName)
}

