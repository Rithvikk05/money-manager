import axios from 'axios'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { getMonthlyBalanceSummaries, getAccountMonthlyBalanceSummaries, monthLabel, parseTransactionDate } from '../utils/monthlyBalances'

const getApiBase = () => {
  if (import.meta.env.DEV) return 'http://localhost:5000/api'
  if (!import.meta.env.VITE_API_BASE) return 'http://localhost:5000/api'
  let base = import.meta.env.VITE_API_BASE.trim()
  if (!base.startsWith('http')) base = `https://${base}`
  if (base.endsWith('/')) base = base.slice(0, -1)
  if (!base.endsWith('/api')) base = `${base}/api`
  return base
}
const API_BASE = getApiBase()

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const formatAmount = (value) => {
  const amount = Number(value) || 0
  const abs = Math.abs(amount).toLocaleString('en-IN')
  return amount < 0 ? `-₹${abs}` : `₹${abs}`
}

const formatDisplayDate = (value) => {
  const date = parseTransactionDate(value)
  if (Number.isNaN(date.getTime())) return escapeHtml(value)
  return escapeHtml(date.toLocaleDateString('en-IN'))
}

export default function ImportExport({ onImportSuccess }) {
  const handleImportFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post(`${API_BASE}/import/excel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      alert(`✅ ${response.data.imported} transactions imported successfully!`)
      onImportSuccess()
      e.target.value = '' // Reset input
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message
      alert('❌ Error importing file: ' + errMsg)
    }
  }

  const handleExportBackup = async () => {
    try {
      const response = await axios.get(`${API_BASE}/export/excel`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `transactions_backup_${new Date().toISOString().split('T')[0]}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      alert('✅ Backup Excel file downloaded successfully!')
    } catch (error) {
      alert('❌ Error exporting backup: ' + error.message)
    }
  }

  const handleExportPresentation = async () => {
    try {
      const response = await axios.get(`${API_BASE}/transactions`)
      const transactions = Array.isArray(response.data) ? response.data : []
      
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Money Manager'
      
      // Calculate metrics
      const monthlySummaries = getMonthlyBalanceSummaries(transactions)
      const totalIncome = monthlySummaries.reduce((sum, month) => sum + month.income, 0)
      const totalExpense = monthlySummaries.reduce((sum, month) => sum + month.expense, 0)
      const balance = monthlySummaries.length > 0 ? monthlySummaries[monthlySummaries.length - 1].closing : 0

      // 1. Dashboard Sheet
      const dashboard = workbook.addWorksheet('Dashboard', { properties: { tabColor: { argb: 'FF4F81BD' } } })
      dashboard.views = [{ showGridLines: false }]
      
      // Title
      dashboard.mergeCells('B2:H3')
      const titleCell = dashboard.getCell('B2')
      titleCell.value = 'Money Manager Pro Dashboard'
      titleCell.font = { size: 24, bold: true, color: { argb: 'FF4F81BD' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

      // KPI Cards
      const kpiRow = 6
      
      // Income KPI
      dashboard.mergeCells(`B${kpiRow}:C${kpiRow+2}`)
      const incomeCard = dashboard.getCell(`B${kpiRow}`)
      incomeCard.value = `Total Income\n\n₹${totalIncome.toLocaleString('en-IN')}`
      incomeCard.font = { size: 14, bold: true, color: { argb: 'FF00B050' } }
      incomeCard.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      
      for(let r=0; r<=2; r++) {
        for(let c=2; c<=3; c++) {
          const cell = dashboard.getCell(kpiRow+r, c)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF1DE' } }
          cell.border = { top: {style:'thin', color:{argb:'FF00B050'}}, left: {style:'thin', color:{argb:'FF00B050'}}, bottom: {style:'thin', color:{argb:'FF00B050'}}, right: {style:'thin', color:{argb:'FF00B050'}} }
        }
      }
      
      // Expense KPI
      dashboard.mergeCells(`D${kpiRow}:E${kpiRow+2}`)
      const expenseCard = dashboard.getCell(`D${kpiRow}`)
      expenseCard.value = `Total Expense\n\n₹${totalExpense.toLocaleString('en-IN')}`
      expenseCard.font = { size: 14, bold: true, color: { argb: 'FFFF0000' } }
      expenseCard.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      
      for(let r=0; r<=2; r++) {
        for(let c=4; c<=5; c++) {
          const cell = dashboard.getCell(kpiRow+r, c)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2DCDB' } }
          cell.border = { top: {style:'thin', color:{argb:'FFFF0000'}}, left: {style:'thin', color:{argb:'FFFF0000'}}, bottom: {style:'thin', color:{argb:'FFFF0000'}}, right: {style:'thin', color:{argb:'FFFF0000'}} }
        }
      }
      
      // Balance KPI
      dashboard.mergeCells(`F${kpiRow}:G${kpiRow+2}`)
      const balanceCard = dashboard.getCell(`F${kpiRow}`)
      balanceCard.value = `Net Balance\n\n₹${balance.toLocaleString('en-IN')}`
      balanceCard.font = { size: 14, bold: true, color: { argb: 'FF0070C0' } }
      balanceCard.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      
      for(let r=0; r<=2; r++) {
        for(let c=6; c<=7; c++) {
          const cell = dashboard.getCell(kpiRow+r, c)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } }
          cell.border = { top: {style:'thin', color:{argb:'FF0070C0'}}, left: {style:'thin', color:{argb:'FF0070C0'}}, bottom: {style:'thin', color:{argb:'FF0070C0'}}, right: {style:'thin', color:{argb:'FF0070C0'}} }
        }
      }

      // 2. Transactions Sheet
      const sheet1 = workbook.addWorksheet('All Transactions', { properties: { tabColor: { argb: 'FF00B0F0' } } })
      sheet1.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Account', key: 'account', width: 20 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Note', key: 'note', width: 35 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Type', key: 'type', width: 15 }
      ]
      
      sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sheet1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } }
      
      transactions.forEach(t => {
        const row = sheet1.addRow({
          date: formatDisplayDate(t.date),
          account: t.account,
          category: t.category,
          note: t.note,
          amount: t.amount,
          type: t.type
        })
        row.getCell('amount').numFmt = '"₹"#,##0.00;[Red]\-"₹"#,##0.00'
        if (t.type === 'Income') row.getCell('type').font = { color: { argb: 'FF00B050' }, bold: true }
        if (t.type === 'Expense') row.getCell('type').font = { color: { argb: 'FFFF0000' }, bold: true }
      })
      
      // 3. Summary Sheet
      const sheet2 = workbook.addWorksheet('Monthly Summary', { properties: { tabColor: { argb: 'FF92D050' } } })
      
      sheet2.columns = [
        { header: 'Month', key: 'month', width: 20 },
        { header: 'Income', key: 'income', width: 20 },
        { header: 'Expense', key: 'expense', width: 20 },
        { header: 'Closing Balance', key: 'closing', width: 20 }
      ]
      
      sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B050' } }
      
      monthlySummaries.forEach(m => {
        const row = sheet2.addRow({
          month: monthLabel(m.month),
          income: m.income,
          expense: m.expense,
          closing: m.closing
        })
        row.getCell('income').numFmt = '"₹"#,##0.00'
        row.getCell('expense').numFmt = '"₹"#,##0.00'
        row.getCell('closing').numFmt = '"₹"#,##0.00'
        row.getCell('closing').font = { bold: true }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      saveAs(new Blob([buffer]), \`money_manager_dashboard_\${new Date().toISOString().split('T')[0]}.xlsx\`)
      alert('✅ Professional Dashboard Excel exported successfully!')
    } catch (error) {
      console.error(error)
      alert('❌ Error exporting presentation: ' + error.message)
    }
  }

  const handleExportHTML = async () => {
    try {
      const response = await axios.get(`${API_BASE}/transactions`)
      const transactions = Array.isArray(response.data) ? response.data : []
      const monthlySummaries = getMonthlyBalanceSummaries(transactions)
      const accountMonthlySummaries = Array.from(new Set(transactions.map((t) => t?.account).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map((account) => ({
          account,
          summaries: getAccountMonthlyBalanceSummaries(transactions, (name) => String(name) === String(account)),
        }))
      const totalIncome = monthlySummaries.reduce((sum, month) => sum + month.income, 0)
      const totalExpense = monthlySummaries.reduce((sum, month) => sum + month.expense, 0)
      const balance = monthlySummaries.length > 0 ? monthlySummaries[monthlySummaries.length - 1].closing : 0

      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Money Manager - Transactions Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
            h1 { color: #333; text-align: center; }
            .summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin: 20px 0; }
            .summary-card { padding: 15px; border-radius: 8px; text-align: center; }
            .income-card { background: #d4edda; color: #155724; }
            .expense-card { background: #f8d7da; color: #721c24; }
            .balance-card { background: #d1ecf1; color: #0c5460; }
            .summary-note { margin: 0 0 20px; color: #666; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #667eea; color: white; padding: 12px; text-align: left; }
            td { padding: 10px; border-bottom: 1px solid #ddd; }
            tr:nth-child(even) { background: #f9f9f9; }
            .income { color: #28a745; font-weight: bold; }
            .expense { color: #dc3545; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>💰 Money Manager - Transactions Report</h1>
            <p style="text-align: center; color: #666;">Generated on ${new Date().toLocaleDateString('en-IN')}</p>
      `

      html += `
            <div class="summary">
              <div class="summary-card income-card">
                <h3>Total Income</h3>
                <p style="font-size: 24px; margin: 10px 0;">${formatAmount(totalIncome)}</p>
              </div>
              <div class="summary-card expense-card">
                <h3>Total Expense</h3>
                <p style="font-size: 24px; margin: 10px 0;">${formatAmount(totalExpense)}</p>
              </div>
              <div class="summary-card balance-card">
                <h3>Current Balance</h3>
                <p style="font-size: 24px; margin: 10px 0;">${formatAmount(balance)}</p>
              </div>
            </div>
            <p class="summary-note">Monthly totals exclude explicit B/D and C/F entries. Closing balance is carried forward as the next month's opening balance.</p>

            <h2>Monthly Summary</h2>
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Month</th>
                  <th>Opening (B/D)</th>
                  <th>Total Income</th>
                  <th>Total Expense</th>
                  <th>Closing (C/F)</th>
                </tr>
              </thead>
              <tbody>
      `

      accountMonthlySummaries.forEach(({ account, summaries }) => {
        summaries.forEach((summary, index) => {
          html += `
            <tr>
              <td>${index === 0 ? escapeHtml(account) : ''}</td>
              <td>${escapeHtml(monthLabel(summary.month))}</td>
              <td>${formatAmount(summary.opening)}</td>
              <td class="income">${formatAmount(summary.income)}</td>
              <td class="expense">${formatAmount(summary.expense)}</td>
              <td>${formatAmount(summary.closing)}</td>
            </tr>
          `
        })
      })

      if (accountMonthlySummaries.length === 0) {
        html += `
          <tr>
            <td colspan="6" style="text-align: center; color: #666;">No monthly summary available</td>
          </tr>
        `
      }

      html += `
              </tbody>
            </table>

            <h2>Transaction Details</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Category</th>
                  <th>Note</th>
                  <th>Amount</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
      `

      transactions.forEach((t) => {
        const typeClass = t.type === 'Income' ? 'income' : 'expense'
        html += `
          <tr>
            <td>${formatDisplayDate(t.date)}</td>
            <td>${escapeHtml(t.account)}</td>
            <td>${escapeHtml(t.category)}</td>
            <td>${escapeHtml(t.note)}</td>
            <td class="${typeClass}">${formatAmount(t.amount)}</td>
            <td>${escapeHtml(t.type)}</td>
          </tr>
        `
      })

      html += `
              </tbody>
            </table>
            <div class="footer">
              <p>© 2026 Money Manager - Personal Finance Dashboard</p>
            </div>
          </div>
        </body>
        </html>
      `

      const blob = new Blob([html], { type: 'text/html' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.html`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      alert('✅ HTML file downloaded successfully!')
    } catch (error) {
      alert('❌ Error exporting file: ' + error.message)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Import Section */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">📥 Import Transactions</h2>
        <p className="text-gray-600 mb-4">
          Upload an Excel file (.xlsx) with your transaction data. Make sure it has columns: Date, Account,
          Category, Note, Amount, Type (Income/Expense)
        </p>
        <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors bg-blue-50">
          <div className="text-center">
            <p className="text-2xl mb-2">📤</p>
            <p className="font-semibold text-gray-700">Click to select Excel file</p>
            <p className="text-sm text-gray-500 mt-1">or drag and drop</p>
          </div>
          <input type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />
        </label>
      </div>

      {/* Export Section */}
      <div className="card shadow-md">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">📤 Export Transactions</h2>
        <p className="text-gray-600 mb-6">Export your transactions in different formats depending on your needs:</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={handleExportBackup} className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transform active:scale-95 transition-all duration-150 flex flex-col items-center justify-center gap-1 h-24 p-2">
            <span className="text-2xl">💾</span>
            <span className="text-sm">Raw Backup (Excel)</span>
          </button>

          <button onClick={handleExportPresentation} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transform active:scale-95 transition-all duration-150 flex flex-col items-center justify-center gap-1 h-24 p-2 relative overflow-hidden">
            <span className="absolute -right-4 -top-4 text-white/20 text-6xl">📊</span>
            <span className="text-2xl">✨</span>
            <span className="text-sm z-10">Pro Dashboard (Excel)</span>
          </button>

          <button onClick={handleExportHTML} className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transform active:scale-95 transition-all duration-150 flex flex-col items-center justify-center gap-1 h-24 p-2">
            <span className="text-2xl">🌐</span>
            <span className="text-sm">Printable Report (HTML)</span>
          </button>
        </div>

        <div className="mt-6 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>💡 Tip:</strong> Use <strong>Raw Backup</strong> for safekeeping or moving to another app. Use <strong>Pro Dashboard</strong> for a beautifully formatted spreadsheet ready for presentations.
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">📋 Import Format Guide</h2>
        <div className="space-y-3 text-sm">
          <p>
            <strong>Required Columns:</strong>
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>
              <strong>Date:</strong> Transaction date (YYYY-MM-DD format)
            </li>
            <li>
              <strong>Account:</strong> Accounts, Cash, or Card
            </li>
            <li>
              <strong>Category:</strong> Food, Transport, Health, etc.
            </li>
            <li>
              <strong>Note:</strong> Description of transaction
            </li>
            <li>
              <strong>Amount:</strong> Transaction amount (number)
            </li>
            <li>
              <strong>Type:</strong> Income or Expense
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
