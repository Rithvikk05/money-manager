# 💰 Money Manager

A modern, full-stack web application for personal money management with comprehensive financial tracking, data visualization, and import/export capabilities.

## 🌟 Features

- **📊 Interactive Dashboard**: Visual charts and statistics with monthly trends and category breakdowns
- **💳 Transaction Management**: Add, edit, and delete transactions with detailed information
- **📋 Advanced Filtering**: Filter by type, category, amount, and search functionality
- **📁 Import/Export**: Upload Excel files or export transactions as Excel/HTML
- **📈 Real-time Analytics**: Track income, expenses, and balance
- **🎯 Category Tracking**: Organized spending by predefined categories
- **💾 Data Persistence**: SQLite database for reliable data storage
- **🔄 RESTful API**: Complete backend API for all operations

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Rithvikk05/money-manager.git
   cd money-manager
   ```

2. **Install dependencies**
   ```bash
   npm run setup
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```

   This will start:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

## 📱 Project Structure

```
money-manager/
├── frontend/                 # React + Vite application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── App.jsx          # Main app component
│   │   └── index.css        # Global styles (Tailwind)
│   ├── package.json
│   └── vite.config.js
├── backend/                  # Node.js/Express API
│   ├── server.js            # Main server file
│   ├── package.json
│   └── money_manager.db     # SQLite database
├── package.json             # Root package.json
└── README.md
```

## 🔧 API Endpoints

### Transactions
- `GET /api/transactions` - Get all transactions
- `POST /api/transactions` - Add new transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Statistics
- `GET /api/statistics` - Get statistics by type and category

### Import/Export
- `GET /api/export/excel` - Export to Excel
- `POST /api/import/excel` - Import from Excel

### Health
- `GET /api/health` - Check API status

## 💻 Frontend Features

### Dashboard Tab
- Summary cards showing total income, expense, and balance
- Monthly trend chart (Line chart)
- Category breakdown (Pie chart)
- Recent transactions list

### Add Transaction Tab
- Form with all transaction details
- Date, Account, Category, Type selection
- Amount input with currency support
- Notes and description fields
- Edit existing transactions

### All Transactions Tab
- Comprehensive transaction table
- Real-time search functionality
- Filter by type and category
- Sort by date or amount
- Edit and delete buttons

### Import/Export Tab
- Upload Excel files with transaction data
- Export to Excel format
- Export to HTML for viewing/printing
- Format guide and instructions

## 📊 Data Schema

### Transactions Table
```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  account TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  note TEXT,
  amount REAL NOT NULL,
  inr REAL,
  currency TEXT DEFAULT 'INR',
  type TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## 🎯 Categories

- 🍜 Food
- 🚖 Transport
- 🧘🏼 Health
- 🪑 Household
- Office Work
- Other

## 🌐 Deployment

### Deploy Frontend to Vercel

1. Push code to GitHub
2. Go to [Vercel.com](https://vercel.com)
3. Click "New Project"
4. Select your GitHub repository
5. Set build command: `npm run build --prefix frontend`
6. Set output directory: `frontend/dist`
7. Deploy!

### Deploy Backend to Heroku/Railway

1. Create account on hosting platform
2. Connect GitHub repository
3. Set environment variables (PORT, etc.)
4. Deploy!

## 🛠️ Technology Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- Recharts (for charts)
- Axios (for API calls)
- PapaParse (for CSV)

### Backend
- Node.js
- Express.js
- SQLite3
- Multer (for file uploads)
- XLSX (for Excel)

## 📝 License

MIT License - feel free to use for personal or commercial projects

## 👨‍💻 Developer

Created with ❤️ by Rithvikk05 & AI Assistance

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues or questions, please open an issue on GitHub.

---

**Happy Money Managing! 💰**
