import { useEffect, useState, useMemo, Fragment } from 'react'
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

  // Calculate totals dynamically for each unique account found across all months
  const accountTotals = useMemo(() => {
    if (unifiedSummaries.length === 0) return {};
    
    // Find all unique accounts across all months
    const allAccounts = new Set();
    unifiedSummaries.forEach(s => {
      if (s.accounts) {
        Object.keys(s.accounts).forEach(acc => allAccounts.add(acc));
      }
    });

    const totals = {};
    allAccounts.forEach(acc => {
      totals[acc] = {
        opening: unifiedSummaries[0]?.accounts[acc]?.opening || 0,
        income: unifiedSummaries.reduce((sum, s) => sum + (s.accounts[acc]?.income || 0), 0),
        expense: unifiedSummaries.reduce((sum, s) => sum + (s.accounts[acc]?.expense || 0), 0),
        netTransfers: unifiedSummaries.reduce((sum, s) => sum + ((s.accounts[acc]?.transferIn || 0) - (s.accounts[acc]?.transferOut || 0)), 0),
        closing: unifiedSummaries[unifiedSummaries.length - 1]?.accounts[acc]?.closing || 0
      };
    });
    return totals;
  }, [unifiedSummaries]);

  const overallTotals = useMemo(() => {
    if (unifiedSummaries.length === 0) return { opening: 0, income: 0, expense: 0, netTransfers: 0, closing: 0 };
    return {
      opening: unifiedSummaries[0]?.total.opening || 0,
      income: unifiedSummaries.reduce((sum, s) => sum + (s.total.income || 0), 0),
      expense: unifiedSummaries.reduce((sum, s) => sum + (s.total.expense || 0), 0),
      netTransfers: unifiedSummaries.reduce((sum, s) => sum + ((s.total.transferIn || 0) - (s.total.transferOut || 0)), 0),
      closing: unifiedSummaries[unifiedSummaries.length - 1]?.total.closing || 0
    };
  }, [unifiedSummaries]);

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
              <h2 className="text-3xl font-bold text-gray-800 dark:text-slate-100">📈 Monthly Summary</h2>
              {isLoading && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
                  Syncing...
                </span>
              )}
            </div>
            <p className="text-gray-600 dark:text-slate-300 mt-2">Track and compare your monthly balance, income, expenses and transfers by account type side-by-side</p>
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
          <p className="text-gray-500 dark:text-slate-400 text-center py-12 text-lg">No transactions available to generate monthly summary.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gradient-to-r from-blue-100 to-blue-50 border-b-2 border-blue-300 dark:border-blue-600">
                <tr>
                  <th className="px-6 py-4 text-center font-bold text-gray-700 dark:text-slate-200 border-r border-blue-200 dark:border-blue-700">Month</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-700 dark:text-slate-200">Account</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700 dark:text-slate-200">Opening (B/D)</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700 dark:text-slate-200">Monthly Income</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700 dark:text-slate-200">Monthly Expenses</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700 dark:text-slate-200">Net Transfers</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-700 dark:text-slate-200">Closing (C/F)</th>
                </tr>
              </thead>
              <tbody>
                {unifiedSummaries.map((summary, idx) => {
                  const isEven = idx % 2 === 0
                  const monthBg = isEven ? 'bg-slate-50' : 'bg-white dark:bg-slate-800'
                  const accountNames = Object.keys(summary.accounts || {}).sort((a, b) => a.localeCompare(b))
                  const rowCount = accountNames.length + 1 // +1 for the Total row
                  
                  return (
                    <Fragment key={summary.month}>
                      {accountNames.map((accName, accIdx) => {
                        const accData = summary.accounts[accName]
                        const isCash = accName.toLowerCase().includes('cash')
                        const icon = isCash ? '💵' : '🏦'
                        const colorTheme = isCash ? 'text-emerald-600' : 'text-blue-600'
                        
                        return (
                          <tr key={`${summary.month}-${accName}`} className={`${monthBg} hover:bg-blue-50 dark:bg-blue-900/30/40 transition-colors`}>
                            {accIdx === 0 && (
                              <td 
                                rowSpan={rowCount} 
                                className="px-6 py-4 font-bold text-gray-800 dark:text-slate-100 border-r border-gray-200 dark:border-slate-700 text-center align-middle bg-gradient-to-b from-gray-50/30 to-gray-100/30 text-base"
                              >
                                {monthLabel(summary.month)}
                              </td>
                            )}
                            <td className="px-6 py-4 font-medium text-gray-700 dark:text-slate-200">
                              <span className="mr-2">{icon}</span> {accName}
                            </td>
                            <td className={`px-6 py-4 text-right font-semibold ${colorTheme}`}>
                              ₹{(accData.opening || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-green-600">
                              ₹{(accData.income || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-red-600">
                              ₹{(accData.expense || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold">
                              <span className={((accData.transferIn || 0) - (accData.transferOut || 0)) >= 0 ? 'text-teal-600' : 'text-orange-500'}>
                                {((accData.transferIn || 0) - (accData.transferOut || 0)) >= 0 ? '+' : ''}₹{((accData.transferIn || 0) - (accData.transferOut || 0)).toLocaleString('en-IN')}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-gray-700 dark:text-slate-200">
                              ₹{(accData.closing || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        )
                      })}

                      {/* Combined Total Row for the Month */}
                      <tr className="bg-indigo-50 dark:bg-indigo-900/30/40 hover:bg-indigo-50 dark:bg-indigo-900/30/80 font-semibold border-b-2 border-indigo-200">
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
                {Object.keys(accountTotals).sort((a, b) => a.localeCompare(b)).map((accName) => {
                  const totals = accountTotals[accName]
                  const isCash = accName.toLowerCase().includes('cash')
                  const icon = isCash ? '💵' : '🏦'
                  return (
                    <tr key={`grand-total-${accName}`} className="bg-slate-100 font-bold border-t border-slate-200 hover:bg-slate-200 transition-colors">
                      <td className="px-6 py-4 text-gray-800 dark:text-slate-100 text-center" colSpan={2}>
                        <span className="mr-2">{icon}</span> Grand Total - {accName}
                      </td>
                      <td className="px-6 py-4 text-right text-blue-700">₹{totals.opening.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 text-right text-green-700">₹{totals.income.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 text-right text-red-700">₹{totals.expense.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={totals.netTransfers >= 0 ? 'text-teal-700' : 'text-orange-600'}>
                          {totals.netTransfers >= 0 ? '+' : ''}₹{totals.netTransfers.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-800 dark:text-slate-100">₹{totals.closing.toLocaleString('en-IN')}</td>
                    </tr>
                  )
                })}

                {/* Grand Total Overall */}
                <tr className="bg-gradient-to-r from-indigo-100 to-purple-100 font-black text-indigo-950 border-t-4 border-indigo-300 hover:from-indigo-200 hover:to-purple-200 transition-colors shadow-inner">
                  <td className="px-6 py-4 text-center text-indigo-950" colSpan={2}>
                    <span className="mr-2">🌍</span> Grand Total - Overall
                  </td>
                  <td className="px-6 py-4 text-right text-indigo-900">₹{overallTotals.opening.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right text-green-800">₹{overallTotals.income.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right text-red-800">₹{overallTotals.expense.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={overallTotals.netTransfers >= 0 ? 'text-teal-800' : 'text-orange-700'}>
                      {overallTotals.netTransfers >= 0 ? '+' : ''}₹{overallTotals.netTransfers.toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-indigo-950 text-xl shadow-sm">₹{overallTotals.closing.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {bankAccountSummaries.length > 0 && (
        <div className="card overflow-hidden">
          <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 px-6 py-4 border-b bg-gray-50 dark:bg-slate-900">🏦 Bank/Card Monthly Summary (Account-wise)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-indigo-100 to-blue-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-slate-200">Account</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-slate-200">Month</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-slate-200">Opening (B/D)</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-slate-200">Income</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-slate-200">Expense</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-slate-200">Closing (C/F)</th>
                </tr>
              </thead>
              <tbody>
                {bankAccountSummaries.flatMap(({ account, summaries }) =>
                  summaries.map((summary, index) => (
                    <tr key={`${account}-${summary.month}`} className="border-b hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-900">
                      <td className="px-4 py-3 text-gray-800 dark:text-slate-100 font-semibold">{index === 0 ? account : ''}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-slate-200">{monthLabel(summary.month)}</td>
                      <td className="px-4 py-3 text-right text-blue-700">₹{(summary.opening || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-green-700">₹{(summary.income || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-red-700">₹{(summary.expense || 0).toLocaleString('en-IN')}</td>
                      <td className={`px-4 py-3 text-right font-bold ${(summary.closing || 0) >= 0 ? 'text-gray-800 dark:text-slate-100' : 'text-red-700'}`}>₹{(summary.closing || 0).toLocaleString('en-IN')}</td>
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
