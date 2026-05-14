import axios from 'axios'

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

  const handleExportExcel = async () => {
    try {
      const response = await axios.get(`${API_BASE}/export/excel`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      alert('✅ Excel file downloaded successfully!')
    } catch (error) {
      alert('❌ Error exporting file: ' + error.message)
    }
  }

  const handleExportHTML = async () => {
    try {
      const response = await axios.get(`${API_BASE}/transactions`)
      const transactions = response.data

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

      const totalIncome = transactions
        .filter((t) => t.type === 'Income')
        .reduce((sum, t) => sum + (t.amount || 0), 0)
      const totalExpense = transactions
        .filter((t) => t.type === 'Expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0)
      const balance = totalIncome - totalExpense

      html += `
            <div class="summary">
              <div class="summary-card income-card">
                <h3>Total Income</h3>
                <p style="font-size: 24px; margin: 10px 0;">₹${totalIncome.toLocaleString('en-IN')}</p>
              </div>
              <div class="summary-card expense-card">
                <h3>Total Expense</h3>
                <p style="font-size: 24px; margin: 10px 0;">₹${totalExpense.toLocaleString('en-IN')}</p>
              </div>
              <div class="summary-card balance-card">
                <h3>Balance</h3>
                <p style="font-size: 24px; margin: 10px 0;">₹${balance.toLocaleString('en-IN')}</p>
              </div>
            </div>

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
            <td>${new Date(t.date).toLocaleDateString('en-IN')}</td>
            <td>${t.account}</td>
            <td>${t.category}</td>
            <td>${t.note}</td>
            <td class="${typeClass}">₹${(t.amount || 0).toLocaleString('en-IN')}</td>
            <td>${t.type}</td>
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
      <div className="card">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">📤 Export Transactions</h2>
        <p className="text-gray-600 mb-6">Export your transactions in different formats:</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={handleExportExcel} className="btn-primary flex items-center justify-center gap-2 h-16">
            <span>📊</span>
            <span>Export to Excel</span>
          </button>

          <button onClick={handleExportHTML} className="btn-secondary flex items-center justify-center gap-2 h-16">
            <span>🌐</span>
            <span>Export to HTML</span>
          </button>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>💡 Tip:</strong> Use Excel export for data analysis and manipulation. Use HTML export for
            viewing in a browser or printing to PDF.
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
