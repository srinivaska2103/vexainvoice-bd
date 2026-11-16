# VEXA Invoice - Database & Backend Engine

VEXA Invoice is a production-ready business management and billing system designed for Retail, Wholesale, Garment, and Textile businesses.

## Tech Stack
- **Node.js & Express.js** (CommonJS)
- **PostgreSQL Database**
- **Prisma ORM**
- **JWT & bcryptjs**
- **Zod Schema Validation**
- **Helmet, CORS, Express Rate Limit**

## Getting Started

1. **Environment Setup**
Ensure `.env` contains valid `DATABASE_URL` and `JWT_SECRET`.

2. **Database Introspection & Client Generation**
```bash
npx prisma generate
```

3. **Start Development Server**
```bash
npm run dev
```

4. **Health Check**
`GET http://localhost:5000/api/health`

## Core API Endpoints
- `/api/auth` (register, login, me, logout)
- `/api/products` (product CRUD, barcode/sku lookup, garment variants)
- `/api/customers` (customer CRUD, ledger, outstanding)
- `/api/suppliers` (supplier CRUD, ledger)
- `/api/sales` (create sale, invoice generation, returns)
- `/api/purchases` (purchases, stock addition, returns)
- `/api/stock` (stock lookup, low stock, out of stock, adjustments)
- `/api/payments` (direct customer & supplier payments)
- `/api/quotations` (quotations, convert-to-sale)
- `/api/reports` (dashboard, sales, purchases, stock valuation, outstanding)
