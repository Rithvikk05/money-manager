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
      workbook.creator = 'Money Manager Pro'
      workbook.created = new Date()

      // ── Compute all metrics ──
      const monthlySummaries = getMonthlyBalanceSummaries(transactions)
      const totalIncome = monthlySummaries.reduce((s, m) => s + m.income, 0)
      const totalExpense = monthlySummaries.reduce((s, m) => s + m.expense, 0)
      const netBalance = monthlySummaries.length > 0 ? monthlySummaries[monthlySummaries.length - 1].closing : 0
      const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : '0.0'
      const txCount = transactions.filter(t => !t.isVirtual).length

      // Per-account final balances
      const uniqueAccounts = [...new Set(transactions.map(t => t.account).filter(Boolean))].sort()
      const accountFinalBalances = uniqueAccounts.map(acc => {
        const accSummaries = getAccountMonthlyBalanceSummaries(transactions, a => a === acc)
        const last = accSummaries.length > 0 ? accSummaries[accSummaries.length - 1] : null
        return { account: acc, balance: last ? last.closing : 0 }
      })

      // Category breakdown (expenses only, sorted descending)
      const catMap = {}
      transactions.forEach(t => {
        if ((t.type || '').toLowerCase() === 'expense' && t.category && !t.isVirtual) {
          const cat = t.category
          catMap[cat] = (catMap[cat] || 0) + (Number(t.amount) || 0)
        }
      })
      const categoryData = Object.entries(catMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)

      // Top 10 biggest single expenses
      const topExpenses = transactions
        .filter(t => (t.type || '').toLowerCase() === 'expense' && !t.isVirtual)
        .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
        .slice(0, 10)

      // ── Reusable style helpers ──
      const DARK_BG = 'FF1B2A4A'
      const ACCENT_BLUE = 'FF4A90D9'
      const ACCENT_GREEN = 'FF27AE60'
      const ACCENT_RED = 'FFE74C3C'
      const ACCENT_GOLD = 'FFF39C12'
      const LIGHT_BG = 'FFF8F9FA'
      const WHITE = 'FFFFFFFF'
      const DARK_TEXT = 'FF2C3E50'
      const SUBTLE_TEXT = 'FF7F8C8D'
      const BORDER_COLOR = 'FFE0E0E0'

      const thinBorder = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } }
      }

      const sectionHeader = (ws, row, col, endCol, title) => {
        ws.mergeCells(row, col, row, endCol)
        const cell = ws.getCell(row, col)
        cell.value = title
        cell.font = { size: 13, bold: true, color: { argb: WHITE } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } }
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
        for (let c = col; c <= endCol; c++) {
          const cl = ws.getCell(row, c)
          cl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } }
        }
        ws.getRow(row).height = 30
      }

      const tableHeader = (ws, row, headers, startCol) => {
        headers.forEach((h, i) => {
          const cell = ws.getCell(row, startCol + i)
          cell.value = h
          cell.font = { size: 10, bold: true, color: { argb: WHITE } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT_BLUE } }
          cell.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle', indent: i === 0 ? 1 : 0 }
          cell.border = thinBorder
        })
        ws.getRow(row).height = 24
      }

      // ═══════════════════════════════════════
      //  SHEET 1 — DASHBOARD
      // ═══════════════════════════════════════
      const dash = workbook.addWorksheet('📊 Dashboard', { properties: { tabColor: { argb: ACCENT_BLUE } } })
      dash.views = [{ showGridLines: false, zoomScale: 90 }]

      // Set column widths for dashboard
      dash.getColumn(1).width = 3  // margin
      dash.getColumn(2).width = 22
      dash.getColumn(3).width = 18
      dash.getColumn(4).width = 18
      dash.getColumn(5).width = 18
      dash.getColumn(6).width = 18
      dash.getColumn(7).width = 18
      dash.getColumn(8).width = 18
      dash.getColumn(9).width = 3  // margin

      // ── Header banner ──
      for (let c = 2; c <= 8; c++) {
        for (let r = 2; r <= 4; r++) {
          const cell = dash.getCell(r, c)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } }
        }
      }
      dash.mergeCells('B2:H2')
      const titleCell = dash.getCell('B2')
      titleCell.value = '💰 MONEY MANAGER PRO'
      titleCell.font = { size: 22, bold: true, color: { argb: WHITE } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      dash.getRow(2).height = 40

      dash.mergeCells('B3:H3')
      const subtitleCell = dash.getCell('B3')
      subtitleCell.value = `Financial Dashboard  •  Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
      subtitleCell.font = { size: 11, italic: true, color: { argb: 'FFB0BEC5' } }
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' }

      dash.mergeCells('B4:H4')
      const periodCell = dash.getCell('B4')
      const firstMonth = monthlySummaries.length > 0 ? monthLabel(monthlySummaries[0].month) : 'N/A'
      const lastMonth = monthlySummaries.length > 0 ? monthLabel(monthlySummaries[monthlySummaries.length - 1].month) : 'N/A'
      periodCell.value = `Period: ${firstMonth} — ${lastMonth}  |  ${txCount} Transactions`
      periodCell.font = { size: 10, color: { argb: 'FF90A4AE' } }
      periodCell.alignment = { horizontal: 'center', vertical: 'middle' }

      // ── KPI Cards (Row 6-8) ──
      const kpiRow = 6
      const kpiDefs = [
        { label: 'TOTAL INCOME', value: totalIncome, color: ACCENT_GREEN, bg: 'FFE8F5E9', icon: '📈', cols: [2, 3] },
        { label: 'TOTAL EXPENSE', value: totalExpense, color: ACCENT_RED, bg: 'FFFFEBEE', icon: '📉', cols: [4, 5] },
        { label: 'NET BALANCE', value: netBalance, color: ACCENT_BLUE, bg: 'FFE3F2FD', icon: '💎', cols: [6, 7] },
      ]

      kpiDefs.forEach(kpi => {
        const [c1, c2] = kpi.cols
        // Label row
        dash.mergeCells(kpiRow, c1, kpiRow, c2)
        const labelCell = dash.getCell(kpiRow, c1)
        labelCell.value = `${kpi.icon}  ${kpi.label}`
        labelCell.font = { size: 9, bold: true, color: { argb: SUBTLE_TEXT } }
        labelCell.alignment = { horizontal: 'center', vertical: 'bottom' }

        // Value row
        dash.mergeCells(kpiRow + 1, c1, kpiRow + 1, c2)
        const valCell = dash.getCell(kpiRow + 1, c1)
        valCell.value = kpi.value
        valCell.numFmt = '"₹"#,##0'
        valCell.font = { size: 20, bold: true, color: { argb: kpi.color } }
        valCell.alignment = { horizontal: 'center', vertical: 'middle' }

        // Sub-info row
        dash.mergeCells(kpiRow + 2, c1, kpiRow + 2, c2)

        // Paint background and borders
        for (let r = kpiRow; r <= kpiRow + 2; r++) {
          for (let c = c1; c <= c2; c++) {
            const cell = dash.getCell(r, c)
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bg } }
            cell.border = {
              top: { style: r === kpiRow ? 'medium' : 'thin', color: { argb: kpi.color } },
              bottom: { style: r === kpiRow + 2 ? 'medium' : 'thin', color: { argb: kpi.color } },
              left: { style: c === c1 ? 'medium' : 'thin', color: { argb: kpi.color } },
              right: { style: c === c2 ? 'medium' : 'thin', color: { argb: kpi.color } },
            }
          }
        }
      })
      dash.getRow(kpiRow).height = 22
      dash.getRow(kpiRow + 1).height = 38
      dash.getRow(kpiRow + 2).height = 10

      // Savings Rate badge in row 8 col H
      const srCell = dash.getCell(kpiRow, 8)
      srCell.value = 'SAVINGS'
      srCell.font = { size: 8, bold: true, color: { argb: SUBTLE_TEXT } }
      srCell.alignment = { horizontal: 'center', vertical: 'bottom' }
      srCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } }
      srCell.border = { top: { style: 'medium', color: { argb: ACCENT_GOLD } }, left: { style: 'medium', color: { argb: ACCENT_GOLD } }, right: { style: 'medium', color: { argb: ACCENT_GOLD } }, bottom: { style: 'thin', color: { argb: ACCENT_GOLD } } }

      const srValCell = dash.getCell(kpiRow + 1, 8)
      srValCell.value = `${savingsRate}%`
      srValCell.font = { size: 18, bold: true, color: { argb: ACCENT_GOLD } }
      srValCell.alignment = { horizontal: 'center', vertical: 'middle' }
      srValCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } }
      srValCell.border = { left: { style: 'medium', color: { argb: ACCENT_GOLD } }, right: { style: 'medium', color: { argb: ACCENT_GOLD } }, bottom: { style: 'thin', color: { argb: ACCENT_GOLD } } }

      const srBottomCell = dash.getCell(kpiRow + 2, 8)
      srBottomCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } }
      srBottomCell.border = { left: { style: 'medium', color: { argb: ACCENT_GOLD } }, right: { style: 'medium', color: { argb: ACCENT_GOLD } }, bottom: { style: 'medium', color: { argb: ACCENT_GOLD } } }

      // ── Account Balances Section (Row 11+) ──
      let curRow = 11
      sectionHeader(dash, curRow, 2, 5, '🏦  ACCOUNT BALANCES')
      curRow++
      tableHeader(dash, curRow, ['Account', 'Type', 'Current Balance', 'Status'], 2)
      curRow++

      accountFinalBalances.forEach((acc, idx) => {
        const isCash = acc.account.toLowerCase().includes('cash')
        const row = dash.getRow(curRow)
        const bgColor = idx % 2 === 0 ? WHITE : LIGHT_BG

        const nameCell = dash.getCell(curRow, 2)
        nameCell.value = `  ${isCash ? '💵' : '🏦'}  ${acc.account}`
        nameCell.font = { size: 10, bold: true, color: { argb: DARK_TEXT } }
        nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        nameCell.border = thinBorder

        const typeCell = dash.getCell(curRow, 3)
        typeCell.value = isCash ? 'Cash' : 'Bank'
        typeCell.font = { size: 10, color: { argb: SUBTLE_TEXT } }
        typeCell.alignment = { horizontal: 'center' }
        typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        typeCell.border = thinBorder

        const balCell = dash.getCell(curRow, 4)
        balCell.value = acc.balance
        balCell.numFmt = '"₹"#,##0.00;[Red]"-₹"#,##0.00'
        balCell.font = { size: 11, bold: true, color: { argb: acc.balance >= 0 ? ACCENT_GREEN : ACCENT_RED } }
        balCell.alignment = { horizontal: 'center' }
        balCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        balCell.border = thinBorder

        const statusCell = dash.getCell(curRow, 5)
        statusCell.value = acc.balance >= 0 ? '✅ Healthy' : '⚠️ Negative'
        statusCell.font = { size: 10, color: { argb: acc.balance >= 0 ? ACCENT_GREEN : ACCENT_RED } }
        statusCell.alignment = { horizontal: 'center' }
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        statusCell.border = thinBorder

        row.height = 22
        curRow++
      })

      // ── Category Breakdown Section (beside Account Balances) ──
      let catRow = 11
      sectionHeader(dash, catRow, 6, 8, '🎯  EXPENSE CATEGORIES')
      catRow++
      tableHeader(dash, catRow, ['Category', 'Amount', '% Share'], 6)
      catRow++

      categoryData.slice(0, 10).forEach((cat, idx) => {
        const bgColor = idx % 2 === 0 ? WHITE : LIGHT_BG
        const pct = totalExpense > 0 ? (cat.value / totalExpense * 100).toFixed(1) : '0.0'

        const catNameCell = dash.getCell(catRow, 6)
        catNameCell.value = `  ${cat.name}`
        catNameCell.font = { size: 10, color: { argb: DARK_TEXT } }
        catNameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        catNameCell.border = thinBorder

        const catAmtCell = dash.getCell(catRow, 7)
        catAmtCell.value = cat.value
        catAmtCell.numFmt = '"₹"#,##0'
        catAmtCell.font = { size: 10, bold: true, color: { argb: ACCENT_RED } }
        catAmtCell.alignment = { horizontal: 'center' }
        catAmtCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        catAmtCell.border = thinBorder

        const catPctCell = dash.getCell(catRow, 8)
        catPctCell.value = `${pct}%`
        catPctCell.font = { size: 10, color: { argb: SUBTLE_TEXT } }
        catPctCell.alignment = { horizontal: 'center' }
        catPctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        catPctCell.border = thinBorder

        dash.getRow(catRow).height = 22
        catRow++
      })

      // ── Top Expenses Section ──
      const topRow = Math.max(curRow, catRow) + 2
      sectionHeader(dash, topRow, 2, 8, '🔝  TOP 10 BIGGEST EXPENSES')
      let topDataRow = topRow + 1
      tableHeader(dash, topDataRow, ['#', 'Date', 'Account', 'Category', 'Description', 'Amount', ''], 2)
      topDataRow++

      topExpenses.forEach((t, idx) => {
        const bgColor = idx % 2 === 0 ? WHITE : LIGHT_BG
        const cols = [
          { val: idx + 1, fmt: null, align: 'center', fontColor: SUBTLE_TEXT, bold: false },
          { val: formatDisplayDate(t.date), fmt: null, align: 'center', fontColor: DARK_TEXT, bold: false },
          { val: t.account, fmt: null, align: 'center', fontColor: DARK_TEXT, bold: false },
          { val: t.category, fmt: null, align: 'left', fontColor: DARK_TEXT, bold: false },
          { val: t.note || t.description || '', fmt: null, align: 'left', fontColor: SUBTLE_TEXT, bold: false },
          { val: Number(t.amount) || 0, fmt: '"₹"#,##0', align: 'center', fontColor: ACCENT_RED, bold: true },
          { val: '', fmt: null, align: 'center', fontColor: SUBTLE_TEXT, bold: false },
        ]
        cols.forEach((col, ci) => {
          const cell = dash.getCell(topDataRow, 2 + ci)
          cell.value = col.val
          if (col.fmt) cell.numFmt = col.fmt
          cell.font = { size: 10, bold: col.bold, color: { argb: col.fontColor } }
          cell.alignment = { horizontal: col.align, vertical: 'middle' }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
          cell.border = thinBorder
        })
        dash.getRow(topDataRow).height = 22
        topDataRow++
      })

      // Footer
      const footerRow = topDataRow + 2
      dash.mergeCells(footerRow, 2, footerRow, 8)
      const footerCell = dash.getCell(footerRow, 2)
      footerCell.value = '© Money Manager Pro  •  Confidential  •  Auto-generated report'
      footerCell.font = { size: 9, italic: true, color: { argb: 'FFB0BEC5' } }
      footerCell.alignment = { horizontal: 'center' }

      // Print setup
      dash.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }

      // ═══════════════════════════════════════
      //  SHEET 2 — MONTHLY TREND
      // ═══════════════════════════════════════
      const trend = workbook.addWorksheet('📈 Monthly Trend', { properties: { tabColor: { argb: ACCENT_GREEN } } })
      trend.views = [{ showGridLines: false }]

      trend.getColumn(1).width = 3
      trend.getColumn(2).width = 22
      trend.getColumn(3).width = 18
      trend.getColumn(4).width = 18
      trend.getColumn(5).width = 18
      trend.getColumn(6).width = 18
      trend.getColumn(7).width = 18

      // Title
      trend.mergeCells('B2:G2')
      const trendTitle = trend.getCell('B2')
      trendTitle.value = '📈 Monthly Performance Overview'
      trendTitle.font = { size: 16, bold: true, color: { argb: DARK_TEXT } }
      trendTitle.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      trend.getRow(2).height = 35

      // Headers
      const tHeaders = ['Month', 'Opening (B/D)', 'Income', 'Expense', 'Net Change', 'Closing (C/F)']
      tableHeader(trend, 4, tHeaders, 2)

      monthlySummaries.forEach((m, idx) => {
        const r = 5 + idx
        const bgColor = idx % 2 === 0 ? WHITE : LIGHT_BG
        const netChange = m.income - m.expense

        const vals = [
          { v: monthLabel(m.month), fmt: null, color: DARK_TEXT, bold: true },
          { v: m.opening, fmt: '"₹"#,##0', color: ACCENT_BLUE, bold: false },
          { v: m.income, fmt: '"₹"#,##0', color: ACCENT_GREEN, bold: false },
          { v: m.expense, fmt: '"₹"#,##0', color: ACCENT_RED, bold: false },
          { v: netChange, fmt: '"₹"#,##0;[Red]"-₹"#,##0', color: netChange >= 0 ? ACCENT_GREEN : ACCENT_RED, bold: true },
          { v: m.closing, fmt: '"₹"#,##0', color: DARK_TEXT, bold: true },
        ]

        vals.forEach((col, ci) => {
          const cell = trend.getCell(r, 2 + ci)
          cell.value = col.v
          if (col.fmt) cell.numFmt = col.fmt
          cell.font = { size: 10, bold: col.bold, color: { argb: col.color } }
          cell.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle', indent: ci === 0 ? 1 : 0 }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
          cell.border = thinBorder
        })
        trend.getRow(r).height = 24
      })

      // Totals row
      if (monthlySummaries.length > 0) {
        const totRow = 5 + monthlySummaries.length
        const totNetChange = totalIncome - totalExpense
        const totVals = [
          { v: 'GRAND TOTAL', fmt: null, color: WHITE, bold: true },
          { v: '', fmt: null, color: WHITE, bold: false },
          { v: totalIncome, fmt: '"₹"#,##0', color: WHITE, bold: true },
          { v: totalExpense, fmt: '"₹"#,##0', color: WHITE, bold: true },
          { v: totNetChange, fmt: '"₹"#,##0', color: WHITE, bold: true },
          { v: netBalance, fmt: '"₹"#,##0', color: WHITE, bold: true },
        ]
        totVals.forEach((col, ci) => {
          const cell = trend.getCell(totRow, 2 + ci)
          cell.value = col.v
          if (col.fmt) cell.numFmt = col.fmt
          cell.font = { size: 11, bold: col.bold, color: { argb: col.color } }
          cell.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle', indent: ci === 0 ? 1 : 0 }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } }
          cell.border = thinBorder
        })
        trend.getRow(totRow).height = 28
      }

      // AutoFilter on headers
      trend.autoFilter = { from: { row: 4, column: 2 }, to: { row: 4 + monthlySummaries.length, column: 7 } }
      trend.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }

      // ═══════════════════════════════════════
      //  SHEET 3 — ALL TRANSACTIONS
      // ═══════════════════════════════════════
      const txSheet = workbook.addWorksheet('📋 Transactions', { properties: { tabColor: { argb: 'FF00B0F0' } } })
      txSheet.views = [{ state: 'frozen', ySplit: 1 }]

      txSheet.columns = [
        { header: '#', key: 'sno', width: 6 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Account', key: 'account', width: 18 },
        { header: 'Category', key: 'category', width: 18 },
        { header: 'Note', key: 'note', width: 35 },
        { header: 'Amount (₹)', key: 'amount', width: 16 },
        { header: 'Type', key: 'type', width: 12 },
      ]

      // Header styling
      const txHeaderRow = txSheet.getRow(1)
      txHeaderRow.font = { size: 10, bold: true, color: { argb: WHITE } }
      txHeaderRow.height = 26
      txHeaderRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = thinBorder
      })

      // Data rows
      transactions.filter(t => !t.isVirtual).forEach((t, idx) => {
        const row = txSheet.addRow({
          sno: idx + 1,
          date: formatDisplayDate(t.date),
          account: t.account,
          category: t.category,
          note: t.note || '',
          amount: Number(t.amount) || 0,
          type: t.type,
        })

        const bgColor = idx % 2 === 0 ? WHITE : LIGHT_BG
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
          cell.border = thinBorder
          cell.font = { size: 10, color: { argb: DARK_TEXT } }
          cell.alignment = { vertical: 'middle' }
        })

        row.getCell('sno').alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell('date').alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell('account').alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell('amount').numFmt = '#,##0.00'
        row.getCell('amount').alignment = { horizontal: 'right', vertical: 'middle' }
        row.getCell('type').alignment = { horizontal: 'center', vertical: 'middle' }

        const typeVal = (t.type || '').toLowerCase()
        if (typeVal === 'income') {
          row.getCell('type').font = { size: 10, bold: true, color: { argb: ACCENT_GREEN } }
          row.getCell('amount').font = { size: 10, bold: true, color: { argb: ACCENT_GREEN } }
        } else if (typeVal === 'expense') {
          row.getCell('type').font = { size: 10, bold: true, color: { argb: ACCENT_RED } }
          row.getCell('amount').font = { size: 10, bold: true, color: { argb: ACCENT_RED } }
        }

        row.height = 20
      })

      // AutoFilter and freeze
      if (txCount > 0) {
        txSheet.autoFilter = { from: 'A1', to: `G${txCount + 1}` }
      }
      txSheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }

      // ═══════════════════════════════════════
      //  SHEET 4 — ACCOUNT WISE BREAKDOWN
      // ═══════════════════════════════════════
      const accSheet = workbook.addWorksheet('🏦 Account Wise', { properties: { tabColor: { argb: ACCENT_GOLD } } })
      accSheet.views = [{ showGridLines: false }]

      accSheet.getColumn(1).width = 3
      accSheet.getColumn(2).width = 22
      accSheet.getColumn(3).width = 18
      accSheet.getColumn(4).width = 18
      accSheet.getColumn(5).width = 18
      accSheet.getColumn(6).width = 18
      accSheet.getColumn(7).width = 18

      let accRow = 2
      uniqueAccounts.forEach(accName => {
        const accSummaries = getAccountMonthlyBalanceSummaries(transactions, a => a === accName)
        if (accSummaries.length === 0) return

        // Account title
        const isCash = accName.toLowerCase().includes('cash')
        accSheet.mergeCells(accRow, 2, accRow, 7)
        const accTitleCell = accSheet.getCell(accRow, 2)
        accTitleCell.value = `${isCash ? '💵' : '🏦'}  ${accName}`
        accTitleCell.font = { size: 14, bold: true, color: { argb: WHITE } }
        accTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isCash ? ACCENT_GREEN : ACCENT_BLUE } }
        accTitleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
        for (let c = 2; c <= 7; c++) {
          dash.getCell(accRow, c)
          accSheet.getCell(accRow, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isCash ? ACCENT_GREEN : ACCENT_BLUE } }
        }
        accSheet.getRow(accRow).height = 30
        accRow++

        // Headers
        tableHeader(accSheet, accRow, ['Month', 'Opening', 'Income', 'Expense', 'Transfers', 'Closing'], 2)
        accRow++

        accSummaries.forEach((s, idx) => {
          const bgColor = idx % 2 === 0 ? WHITE : LIGHT_BG
          const netTransfer = (s.transferIn || 0) - (s.transferOut || 0)

          const vals = [
            { v: monthLabel(s.month), fmt: null, color: DARK_TEXT, bold: false },
            { v: s.opening, fmt: '"₹"#,##0', color: ACCENT_BLUE, bold: false },
            { v: s.income, fmt: '"₹"#,##0', color: ACCENT_GREEN, bold: false },
            { v: s.expense, fmt: '"₹"#,##0', color: ACCENT_RED, bold: false },
            { v: netTransfer, fmt: '"₹"#,##0;"-₹"#,##0', color: netTransfer >= 0 ? ACCENT_GREEN : ACCENT_RED, bold: false },
            { v: s.closing, fmt: '"₹"#,##0;[Red]"-₹"#,##0', color: DARK_TEXT, bold: true },
          ]

          vals.forEach((col, ci) => {
            const cell = accSheet.getCell(accRow, 2 + ci)
            cell.value = col.v
            if (col.fmt) cell.numFmt = col.fmt
            cell.font = { size: 10, bold: col.bold, color: { argb: col.color } }
            cell.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle', indent: ci === 0 ? 1 : 0 }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
            cell.border = thinBorder
          })
          accSheet.getRow(accRow).height = 22
          accRow++
        })

        accRow += 2 // gap between accounts
      })

      accSheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }

      // ═══════════════════════════════════════
      //  GENERATE FILE
      // ═══════════════════════════════════════
      const buffer = await workbook.xlsx.writeBuffer()
      saveAs(new Blob([buffer]), `money_manager_dashboard_${new Date().toISOString().split('T')[0]}.xlsx`)
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
