import { useEffect, useState, Fragment } from 'react'
import { getUnifiedMonthlySummaries, getAccountMonthlyBalanceSummaries, monthLabel } from '../utils/monthlyBalances'
import { exportToExcel } from '../utils/excelExport'

export default function MonthlySummary({ transactions, onRefresh, isLoading }) {
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (onRefresh) {
      onRefresh()
    }
  }, [])

  const unifiedSummaries = getUnifiedMonthlySummaries(transactions)
  const bankAccountSummaries = Array.from(new Set((transactions || [])
    .map((t) => t?.account)
    .filter((name) => name && !String(name).toLowerCase().includes('cash'))))
    .sort((a, b) => a.localeCompare(b))
    .map((account) => ({
      account,
      summaries: getAccountMonthlyBalanceSummaries(transactions, (name) => String(name) === String(account)),
    }))

  const handleExportSummary = async () => {
    setExporting(true)
    try {
      await exportToExcel('summary', unifiedSummaries, transactions)
    } finally {
      setExporting(false)
    }
  }

  const handleExportAll = async () => {
    setExporting(true)
    try {
      await exportToExcel('all', unifiedSummaries, transactions)
    } finally {
      setExporting(false)
    }
  }

  // Calculate totals
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

  return (
    <div className="space-y-8">
      {/* Header card */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border-l-4 border-purple-500 shadow-sm relative overflow-hidden">
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 animate-pulse" />
        )}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold text-gray-800">📈 Monthly Summary</h2>
              {isLoading && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
                  Syncing...
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-2">Track and compare your monthly balance, income, expenses and transfers by account type side-by-side</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onRefresh}
              disabled={isLoading || exporting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 shadow-sm"
            >
              {isLoading ? '⏳ Syncing...' : '🔄 Refresh Data'}
            </button>
            <button
              onClick={handleExportSummary}
              disabled={isLoading || exporting || unifiedSummaries.length === 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 shadow-sm"
            >
              {exporting ? '⏳ Exporting...' : '📊 Export Summary'}
            </button>
            <button
              onClick={handleExportAll}
              disabled={isLoading || exporting || unifiedSummaries.length === 0}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 shadow-sm"
            >
              {exporting ? '⏳ Exporting...' : '💾 Export All'}
            </button>
          </div>
        </div>
      </div>

      {/* Unified Table */}
      <div className="card overflow-hidden">
        {unifiedSummaries.length === 0 ? (
          <p className="text-gray-500 text-center py-12 text-lg">No transactions available to generate monthly summary.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gradient-to-r from-blue-100 to-blue-50 border-b-2 border-blue-300">
                <tr>
                  <th className="px-6 py-4 text-center font-bold text-gray-700 border-r border-blue-200">Month</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-700">Account</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700">Opening (B/D)</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700">Monthly Income</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700">Monthly Expenses</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700">Net Transfers</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700">Closing (C/F)</th>
                </tr>
              </thead>
              <tbody>
                {unifiedSummaries.map((summary, idx) => {
                  const isEven = idx % 2 === 0
                  const monthBg = isEven ? 'bg-slate-50' : 'bg-white'
                  return (
                    <Fragment key={summary.month}>
                      {/* Cash Row */}
                      <tr className={`${monthBg} hover:bg-blue-50/40 transition-colors`}>
                        <td 
                          rowSpan={3} 
                          className="px-6 py-4 font-bold text-gray-800 border-r border-gray-200 text-center align-middle bg-gradient-to-b from-gray-50/30 to-gray-100/30 text-base"
                        >
                          {monthLabel(summary.month)}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-700">
                          <span className="mr-2">💵</span> Cash
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-blue-600">
                          ₹{(summary.cash.opening || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-green-600">
                          ₹{(summary.cash.income || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-red-600">
                          ₹{(summary.cash.expense || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">
                          <span className={((summary.cash.transferIn || 0) - (summary.cash.transferOut || 0)) >= 0 ? 'text-teal-600' : 'text-orange-500'}>
                            {((summary.cash.transferIn || 0) - (summary.cash.transferOut || 0)) >= 0 ? '+' : ''}₹{((summary.cash.transferIn || 0) - (summary.cash.transferOut || 0)).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-700">
                          ₹{(summary.cash.closing || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>

                      {/* Bank & Card Row */}
                      <tr className={`${monthBg} hover:bg-blue-50/40 transition-colors`}>
                        <td className="px-6 py-4 font-medium text-gray-700">
                          <span className="mr-2">🏦</span> Bank & Card
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-blue-600">
                          ₹{(summary.bank.opening || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-green-600">
                          ₹{(summary.bank.income || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-red-600">
                          ₹{(summary.bank.expense || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">
                          <span className={((summary.bank.transferIn || 0) - (summary.bank.transferOut || 0)) >= 0 ? 'text-teal-600' : 'text-orange-500'}>
                            {((summary.bank.transferIn || 0) - (summary.bank.transferOut || 0)) >= 0 ? '+' : ''}₹{((summary.bank.transferIn || 0) - (summary.bank.transferOut || 0)).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-700">
                          ₹{(summary.bank.closing || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>

                      {/* Combined Total Row */}
                      <tr className="bg-blue-50/30 hover:bg-blue-50/60 font-semibold border-b-2 border-gray-300">
                        <td className="px-6 py-4 font-bold text-indigo-900">
                          <span className="mr-2">💼</span> Total
                        </td>
                        <td className="px-6 py-4 text-right text-indigo-900">
                          ₹{(summary.total.opening || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right text-green-700">
                          ₹{(summary.total.income || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right text-red-700">
                          ₹{(summary.total.expense || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right text-teal-700">
                          <span className={((summary.total.transferIn || 0) - (summary.total.transferOut || 0)) >= 0 ? 'text-teal-700' : 'text-orange-600'}>
                            {((summary.total.transferIn || 0) - (summary.total.transferOut || 0)) >= 0 ? '+' : ''}₹{((summary.total.transferIn || 0) - (summary.total.transferOut || 0)).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-right font-black text-lg ${summary.total.closing >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                          ₹{(summary.total.closing || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}

                {/* Grand Totals */}
                {/* Grand Total Cash */}
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 hover:bg-slate-200 transition-colors">
                  <td className="px-6 py-4 text-gray-800 text-center" colSpan={2}>
                    <span className="mr-2">💵</span> Grand Total - Cash
                  </td>
                  <td className="px-6 py-4 text-right text-blue-700">₹{cashTotals.opening.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right text-green-700">₹{cashTotals.income.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right text-red-700">₹{cashTotals.expense.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={cashTotals.netTransfers >= 0 ? 'text-teal-700' : 'text-orange-600'}>
                      {cashTotals.netTransfers >= 0 ? '+' : ''}₹{cashTotals.netTransfers.toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-800">₹{cashTotals.closing.toLocaleString('en-IN')}</td>
                </tr>

                {/* Grand Total Bank */}
                <tr className="bg-slate-100 font-bold hover:bg-slate-200 transition-colors">
                  <td className="px-6 py-4 text-gray-800 text-center" colSpan={2}>
                    <span className="mr-2">🏦</span> Grand Total - Bank & Card
                  </td>
                  <td className="px-6 py-4 text-right text-blue-700">₹{bankTotals.opening.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right text-green-700">₹{bankTotals.income.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right text-red-700">₹{bankTotals.expense.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={bankTotals.netTransfers >= 0 ? 'text-teal-700' : 'text-orange-600'}>
                      {bankTotals.netTransfers >= 0 ? '+' : ''}₹{bankTotals.netTransfers.toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-800">₹{bankTotals.closing.toLocaleString('en-IN')}</td>
                </tr>

                {/* Grand Total Overall */}
                <tr className="bg-gradient-to-r from-blue-100 to-indigo-50 font-black text-indigo-950 border-t-2 border-b-2 border-indigo-300 hover:from-blue-150 hover:to-indigo-100 transition-colors">
                  <td className="px-6 py-4 text-center text-indigo-950" colSpan={2}>
                    <span className="mr-2">💼</span> Grand Total - Overall
                  </td>
                  <td className="px-6 py-4 text-right text-blue-900">₹{overallTotals.opening.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right text-green-800">₹{overallTotals.income.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right text-red-800">₹{overallTotals.expense.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={overallTotals.netTransfers >= 0 ? 'text-teal-800' : 'text-orange-700'}>
                      {overallTotals.netTransfers >= 0 ? '+' : ''}₹{overallTotals.netTransfers.toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-indigo-950 text-base">₹{overallTotals.closing.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {bankAccountSummaries.length > 0 && (
        <div className="card overflow-hidden">
          <h3 className="text-xl font-bold text-gray-800 px-6 py-4 border-b bg-gray-50">🏦 Bank/Card Monthly Summary (Account-wise)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-indigo-100 to-blue-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Account</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Month</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Opening (B/D)</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Income</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Expense</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Closing (C/F)</th>
                </tr>
              </thead>
              <tbody>
                {bankAccountSummaries.flatMap(({ account, summaries }) =>
                  summaries.map((summary, index) => (
                    <tr key={`${account}-${summary.month}`} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800 font-semibold">{index === 0 ? account : ''}</td>
                      <td className="px-4 py-3 text-gray-700">{monthLabel(summary.month)}</td>
                      <td className="px-4 py-3 text-right text-blue-700">₹{(summary.opening || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-green-700">₹{(summary.income || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-red-700">₹{(summary.expense || 0).toLocaleString('en-IN')}</td>
                      <td className={`px-4 py-3 text-right font-bold ${(summary.closing || 0) >= 0 ? 'text-gray-800' : 'text-red-700'}`}>₹{(summary.closing || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
