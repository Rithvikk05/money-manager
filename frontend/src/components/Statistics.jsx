export default function Statistics({ stats }) {
  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">📊 Detailed Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <div key={index} className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
              <p className="text-gray-600 text-sm font-semibold uppercase">{stat.type} - {stat.category}</p>
              <p className="text-2xl font-bold text-gray-800 mt-2">₹{(stat.total || 0).toLocaleString('en-IN')}</p>
              <p className="text-gray-500 text-xs mt-2">{stat.count} transactions</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
