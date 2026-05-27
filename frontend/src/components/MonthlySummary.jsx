import { useState } from 'react'
import { getAccountMonthlyBalanceSummaries, monthLabel } from '../utils/monthlyBalances'
import { exportToExcel } from '../utils/excelExport'

export default function MonthlySummary({ transactions }) {
  const [exportingAccount, setExportingAccount] = useState(null)
  const [exportingAll, setExportingAll] = useState(false)

  // Separate transactions by account type
  const cashSummaries = getAccountMonthlyBalanceSummaries(
    transactions,
    (account) => account && account.toLowerCase().includes('cash')
  )

  const bankSummaries = getAccountMonthlyBalanceSummaries(
    transactions,
    (account) => account && (account.toLowerCase().includes('bank') || account.toLowerCase().includes('card'))
  )

  const handleExportCash = async () => {
    setExportingAccount('cash')
    try {
      await exportToExcel(
        'cash',
        cashSummaries,
        transactions.filter((t) => t.account && t.account.toLowerCase().includes('cash'))
      )
    } finally {
      setExportingAccount(null)
    }
  }

  const handleExportBank = async () => {
    setExportingAccount('bank')
    try {
      await exportToExcel(
        'bank',
        bankSummaries,
        transactions.filter((t) => t.account && (t.account.toLowerCase().includes('bank') || t.account.toLowerCase().includes('card')))
      )
    } finally {
      setExportingAccount(null)
    }
  }

  const handleExportAll = async () => {
    setExportingAll(true)
    try {
      await exportToExcel('all', { cash: cashSummaries, bank: bankSummaries }, transactions)
    } finally {
      setExportingAll(false)
    }
  }

  const SummaryTable = ({ summaries, title, accountType, onExport, isExporting }) => (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-gray-800">{title}</h3>
        <button
          onClick={onExport}
          disabled={isExporting}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold transition"
        >
          {isExporting ? '⏳ Exporting...' : '📊 Export to Excel'}
        </button>
      </div>

      {summaries.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No transactions for this account type</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-blue-100 to-blue-50 border-b-2 border-blue-300">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-gray-700">Month</th>
                <th className="px-6 py-3 text-right font-bold text-gray-700">Opening (B/D)</th>
                <th className="px-6 py-3 text-right font-bold text-gray-700">Monthly Income</th>
                <th className="px-6 py-3 text-right font-bold text-gray-700">Monthly Expenses</th>
                <th className="px-6 py-3 text-right font-bold text-gray-700">Net Transfers</th>
                <th className="px-6 py-3 text-right font-bold text-gray-700">Closing (C/F)</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary, index) => (
                <tr
                  key={summary.month}
                  className={`border-b transition-colors ${
                    index % 2 === 0 ? 'bg-gray-50 hover:bg-blue-50' : 'bg-white hover:bg-blue-50'
                  }`}
                >
                  <td className="px-6 py-4 font-semibold text-gray-800">{monthLabel(summary.month)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-blue-600">₹{(summary.opening || 0).toLocaleString('en-IN')}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-green-600">₹{(summary.income || 0).toLocaleString('en-IN')}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-red-600">₹{(summary.expense || 0).toLocaleString('en-IN')}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-semibold ${((summary.transferIn || 0) - (summary.transferOut || 0)) >= 0 ? 'text-teal-600' : 'text-orange-500'}`}>
                      {((summary.transferIn || 0) - (summary.transferOut || 0)) >= 0 ? '+' : ''}₹{((summary.transferIn || 0) - (summary.transferOut || 0)).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold text-lg ${summary.closing >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      ₹{(summary.closing || 0).toLocaleString('en-IN')}
                    </span>
                  </td>
                </tr>
              ))}
              {/* Summary Row */}
              <tr className="bg-gradient-to-r from-blue-200 to-blue-100 font-bold border-t-2 border-blue-400">
                <td className="px-6 py-4 text-gray-800">TOTAL</td>
                <td className="px-6 py-4 text-right text-gray-800">
                  ₹{(summaries[0]?.opening || 0).toLocaleString('en-IN')}
                </td>
                <td className="px-6 py-4 text-right text-green-700">
                  ₹{summaries.reduce((sum, s) => sum + (s.income || 0), 0).toLocaleString('en-IN')}
                </td>
                <td className="px-6 py-4 text-right text-red-700">
                  ₹{summaries.reduce((sum, s) => sum + (s.expense || 0), 0).toLocaleString('en-IN')}
                </td>
                <td className="px-6 py-4 text-right text-teal-700">
                  ₹{summaries.reduce((sum, s) => sum + ((s.transferIn || 0) - (s.transferOut || 0)), 0).toLocaleString('en-IN')}
                </td>
                <td className="px-6 py-4 text-right text-blue-800">
                  ₹{(summaries[summaries.length - 1]?.closing || 0).toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border-l-4 border-purple-500">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">📈 Monthly Summary</h2>
            <p className="text-gray-600 mt-2">Track your monthly balance, income, and expenses by account type</p>
          </div>
          <button
            onClick={handleExportAll}
            disabled={exportingAll}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition text-lg"
          >
            {exportingAll ? '⏳ Exporting...' : '💾 Export All to Excel'}
          </button>
        </div>
      </div>

      {/* Cash Summary */}
      <SummaryTable
        summaries={cashSummaries}
        title="💵 Cash Account Summary"
        accountType="cash"
        onExport={handleExportCash}
        isExporting={exportingAccount === 'cash'}
      />

      {/* Bank/Card Summary */}
      <SummaryTable
        summaries={bankSummaries}
        title="🏦 Bank & Card Account Summary"
        accountType="bank"
        onExport={handleExportBank}
        isExporting={exportingAccount === 'bank'}
      />
    </div>
  )
}
