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
      createSummarySheet(wb, 'Cash Summary', summaries.cash, transactions.filter((t) => t.account && t.account.toLowerCase().includes('cash')), XLSX)
      createSummarySheet(wb, 'Bank Summary', summaries.bank, transactions.filter((t) => t.account && (t.account.toLowerCase().includes('bank') || t.account.toLowerCase().includes('card'))), XLSX)
      createDashboardSheet(wb, summaries.cash, summaries.bank, XLSX)
    } else if (accountType === 'cash') {
      createDashboardSheet(wb, summaries, [], XLSX)
      createSummarySheet(wb, 'Monthly Summary', summaries, transactions, XLSX)
    } else if (accountType === 'bank') {
      createDashboardSheet(wb, [], summaries, XLSX)
      createSummarySheet(wb, 'Monthly Summary', summaries, transactions, XLSX)
    }

    // Set column widths
    Object.values(wb.Sheets).forEach((sheet) => {
      sheet['!cols'] = [
        { wch: 20 }, // Month
        { wch: 18 }, // Opening/Total
        { wch: 18 }, // Income
        { wch: 18 }, // Expenses
        { wch: 18 }, // Closing/Balance
      ]
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
