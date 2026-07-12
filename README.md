# 💰 Money Manager

A modern, full-stack web application for personal money management with comprehensive financial tracking, data visualization, and import/export capabilities. 

**Now powered entirely by Vercel Serverless Functions and MongoDB!**

## 🌟 Features

- **📊 Interactive Dashboard**: Visual charts and statistics with monthly trends and category breakdowns
- **💳 Transaction Management**: Add, edit, and delete transactions with detailed information
- **📋 Advanced Filtering**: Filter by type, category, amount, and search functionality
- **📁 Import/Export**: Upload Excel files or export transactions as Excel/HTML
- **📈 Real-time Analytics**: Track income, expenses, and balance
- **🎯 Category Tracking**: Organized spending by predefined categories
- **🔒 Authentication**: Secure user registration and login with JWT
- **☁️ Cloud Database**: MongoDB Atlas for reliable and scalable data storage
- **⚡ Serverless API**: Highly available backend powered by Vercel Serverless Functions

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Git
- A MongoDB Atlas cluster (free tier works great)
- [Vercel CLI](https://vercel.com/docs/cli) (optional, for local serverless development)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Rithvikk05/money-manager.git
   cd money-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env.local` file in the root directory:
   ```env
   # MongoDB Atlas connection string
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/money_manager?appName=Cluster0
   
   # JWT Secret for signing auth tokens
   JWT_SECRET=your_super_secret_jwt_key_here
   ```

4. **Start development server**
   
   **Option A: Full Local Stack (Recommended)**
   This runs both the React frontend and the API routes in one local server.
   ```bash
   npm run dev
   ```

   **Option B: Frontend Only**
   If you only want to work on the React app (API calls will fail unless pointing to a remote server):
   ```bash
   npm run dev:frontend
   ```

## 📱 Project Structure

```
money-manager/
├── api/                        # Vercel Serverless Functions (Backend)
│   ├── _lib/                   # Shared DB, Models, and Auth utilities
│   ├── auth/                   # Registration & Login endpoints
│   ├── transactions/           # CRUD endpoints for transactions
│   ├── deleted-transactions/   # Soft-delete management
│   ├── export/                 # Excel export endpoints
│   └── import/                 # Excel import endpoints
├── src/                        # React + Vite application (Frontend)
│   ├── components/             # React components
│   ├── utils/                  # Utility functions
│   ├── App.jsx                 # Main app component
│   ├── main.jsx                # React entry point
│   └── index.css               # Global styles (Tailwind)
├── public/                     # Static assets
├── index.html                  # Main HTML template
├── package.json                # Unified project dependencies
├── vercel.json                 # Vercel routing configuration
└── vite.config.js              # Vite bundler configuration
```

## 🔧 API Endpoints

All endpoints are prefixed with `/api` and run as Vercel Serverless Functions.

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Transactions (Protected)
- `GET /api/transactions` - Get all transactions
- `POST /api/transactions` - Add new transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Soft delete transaction
- `PUT /api/transactions/bulk` - Bulk update
- `POST /api/transactions/bulk-create` - Bulk create
- `POST /api/transactions/bulk-delete` - Bulk delete

### Deleted Transactions (Protected)
- `GET /api/deleted-transactions` - Get soft-deleted transactions
- `POST /api/deleted-transactions/:id/restore` - Restore transaction
- `DELETE /api/deleted-transactions/:id` - Permanently delete

### Statistics (Protected)
- `GET /api/statistics` - Get aggregated statistics by type and category

### Import/Export (Protected)
- `GET /api/export/excel` - Export data to Excel
- `POST /api/import/excel` - Import data from Excel

### Health
- `GET /api/health` - Check API status

## 🌐 Deployment (Vercel)

The entire application (Frontend + API) is designed to be deployed seamlessly on **Vercel** as a single project.

1. Push your code to a GitHub repository.
2. Go to [Vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Vercel will automatically detect the Vite framework and configure the build settings (`npm run build`, output: `dist`).
5. Open the **Environment Variables** section and add:
   - `MONGODB_URI`: Your MongoDB connection string.
   - `JWT_SECRET`: A secure random string for JWT signing.
   - If you run a separate frontend against another backend, optionally add `VITE_API_BASE` too.
6. Click **Deploy**!

Vercel will build the React frontend into static files and serve the backend through a consolidated serverless router in `api/`, which keeps the deployment within the Hobby plan function limit.

## 🛠️ Technology Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- Recharts (for charts)
- Axios (for API calls)
- ExcelJS & file-saver (for client-side exports)

### Backend (Serverless)
- Vercel Serverless Functions (Node.js 18+)
- MongoDB Atlas & Mongoose
- JSON Web Tokens (JWT) & bcryptjs
- Busboy (for multipart Excel uploads)
- XLSX (for Excel parsing)

## 📝 License

MIT License - feel free to use for personal or commercial projects.

## 👨‍💻 Developer

Created with ❤️ by Rithvikk05 & AI Assistance.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues or questions, please open an issue on GitHub.

---

**Happy Money Managing! 💰**
