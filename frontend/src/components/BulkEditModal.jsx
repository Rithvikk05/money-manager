import { useState } from 'react'

const ACCOUNTS = {
  'Cash': ['Cash'],
  'Bank (Card)': ['🏦 Kotak Bank', '🏦 Union Bank', '🏦 Other Bank']
}

const CATEGORIES = [
  '🍜 Food',
  '🚖 Transport',
  '🧘🏼 Health',
  '🪑 Household',
  '💼 Office Work',
  '🎉 Entertainment',
  '📚 Education',
  '🛒 Shopping',
  '💊 Medicine',
  '🏠 Rent',
  '⚡ Utilities',
  'Other',
]

const TYPES = ['Income', 'Expense', 'Transfer-Out', 'Transfer-In']

export default function BulkEditModal({ selectedCount, onSave, onClose }) {
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    account: '',
    category: '',
    type: '',
    note: '',
    description: '',
  })

  const [useCustomCategory, setUseCustomCategory] = useState(false)
  const [customCategory, setCustomCategory] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'category' && value === 'Other') {
      setUseCustomCategory(true)
      setFormData(prev => ({ ...prev, category: '' }))
    } else if (name === 'category' && value !== 'Other') {
      setUseCustomCategory(false)
      setFormData(prev => ({ ...prev, category: value }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    const finalData = { ...formData }
    if (useCustomCategory && customCategory.trim()) {
      finalData.category = customCategory.trim()
    }
    
    // Filter out empty fields
    const updates = {}
    for (const [key, val] of Object.entries(finalData)) {
      if (val !== undefined && val !== '') {
        updates[key] = val
      }
    }
    
    if (Object.keys(updates).length === 0) {
      alert('Please fill at least one field to update')
      return
    }
    
    onSave(updates)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h2 className="text-xl font-bold text-gray-800">Bulk Edit {selectedCount} Transactions</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 font-bold text-xl">&times;</button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="mb-4 text-sm text-blue-800 bg-blue-50 p-3 rounded border border-blue-200">
            <strong>Note:</strong> Leave a field blank if you do not want to change it. Amount cannot be changed in bulk edit.
          </div>
          
          <form id="bulk-edit-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- No Change --</option>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Account</label>
              <select
                name="account"
                value={formData.account}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- No Change --</option>
                <optgroup label="Cash">
                  {ACCOUNTS['Cash'].map((acc) => (
                    <option key={acc} value={acc}>{acc}</option>
                  ))}
                </optgroup>
                <optgroup label="Bank / Card">
                  {ACCOUNTS['Bank (Card)'].map((acc) => (
                    <option key={acc} value={acc}>{acc}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
              <select
                name="category"
                value={useCustomCategory ? 'Other' : formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- No Change --</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {useCustomCategory && (
                <input
                  type="text"
                  placeholder="Enter custom category"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="mt-2 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Note (Short Title)</label>
              <input
                type="text"
                name="note"
                value={formData.note}
                onChange={handleChange}
                placeholder="-- No Change --"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="-- No Change --"
                rows="2"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>
          </form>
        </div>
        
        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium">
            Cancel
          </button>
          <button type="submit" form="bulk-edit-form" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm font-medium">
            Update All {selectedCount}
          </button>
        </div>
      </div>
    </div>
  )
}
