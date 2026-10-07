# 🌉 HomeBank Bridge

> **A High-Performance, Minimalist Financial Logging Engine**
> Fully compliant CSV bridge for the HomeBank ecosystem, built with React 19 and SQLite WASM.

---

### [🖼️ Screenshots](#screenshots) | [✨ Features](#key-features) | [🛠️ Stack](#tech-stack) | [⚙️ Setup](#development--build) | [🚀 Deployment](#deployment) | [📜 Changelog](#changelog)

---

## 🖼️ Screenshots
<img width="916" height="1169" alt="img (7)" src="https://github.com/user-attachments/assets/31649b44-59b8-4a60-bc06-43d476cdb55a" />
<img width="3144" height="283" alt="img (6)" src="https://github.com/user-attachments/assets/8217ffa5-907d-46cf-93a7-b0aca3233a1a" />
<img width="888" height="720" alt="img (5)" src="https://github.com/user-attachments/assets/d9df532a-1fa2-472a-8ce2-20f1a9ed4019" />
<img width="866" height="429" alt="img (4)" src="https://github.com/user-attachments/assets/32fb5f9c-f924-44d6-b090-f1167f631954" />
<img width="868" height="420" alt="img (3)" src="https://github.com/user-attachments/assets/76eddf7f-ce0e-4dd6-8a17-621cd4e50fc8" />
<img width="1080" height="610" alt="img (2)" src="https://github.com/user-attachments/assets/0ae0acda-7a5c-468b-bd2d-ca95da17f0d3" />
<img width="2293" height="1208" alt="img (1)" src="https://github.com/user-attachments/assets/5e792502-cd0b-411e-b68c-f0ae84ceec1b" />


---

## 🚀 The Vision

**HomeBank Bridge** is a technical design and implementation blueprint for a minimalist financial logging application. It serves as a high-efficiency entry point for tracking personal finances (Income, Expenses, Transfers) with multi-account support, designed specifically for seamless export to **HomeBank**.

This project eliminates the friction of manual CSV editing by providing a mobile-friendly, synchronized interface that bridges the gap between daily spending and long-term financial management.

---

## ✨ Key Features

- **🧠 Smart Entry Engine**: Intelligent autofill that learns from your history. Once you log a payee (e.g., "Mercadona"), the Bridge automatically suggests the correct Category and Payment Type for the next time.
- **🔄 Dual-Record Transfer**: A unified form logic that atomically creates two linked transactions (Debit/Credit) for internal transfers, maintaining absolute balance integrity.
- **📥 Advanced Import Logic**: Resilient CSV processing with dynamic date parsing, decimal separator normalization, and case-insensitive category matching. Automatically detects and skips duplicates.
- **📈 Strict Compliance Export**: High-fidelity CSV generation for Transactions, Accounts, Categories, and Payees. Features "Smart Grouping" to handle multi-account datasets.
- **📜 Export Archives**: Secure history of all generated manifests with instant re-download and preview.
- **🛠️ System Resilience**: Built-in database management including snapshots, factory reset, and restoration with lock handling.
- **📱 Mobile-First UI**: Adaptive layout engine that switches from desktop tables to touch-optimized cards. Includes an ergonomic bottom navigation bar.
- **🛡️ Privacy Mode (Anonymizer)**: Integrated global toggle that instantly hides sensitive financial data for secure use in public.
- **🌍 Localization**: Dynamic support for custom date formats and decimal separators.
- **🛡️ Secure-by-Design**: Hardened API endpoints with payload limits, rate limiting, and strict sanitization.

---

## 🛠 Tech Stack

| Layer          | Technology                                                         |
| :------------- | :----------------------------------------------------------------- |
| **Frontend**   | [React 19](https://react.dev/)                                     |
| **Backend**    | [Node.js](https://nodejs.org/) / [Express](https://expressjs.com/) |
| **Build Tool** | [Vite](https://vitejs.dev/)                                        |
| **Database**   | [SQLite](https://sqlite.org/)                                      |
| **Styling**    | [Tailwind CSS](https://tailwindcss.com/) (PostCSS Build)           |
| **Language**   | [TypeScript](https://www.typescriptlang.org/)                      |

---

## ⚙️ Development & Build

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/MarynarzSwiata/HomeBank-Bridge.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
4. Run developmental server:
   ```bash
   npm run dev
   ```

### Production Build
To create an optimized production bundle:
```bash
npm run build
```

---

## 🔐 Authentication

HomeBank Bridge includes a local authentication system:
- **Single-Admin Mode**: The first registered user becomes the administrator.
- **Session-Based Auth**: Uses secure `httpOnly` cookies (7-day expiry).
- **Rate Limiting**: Brute-force protection on login.

| Variable             | Description                                                | Default          |
| -------------------- | ---------------------------------------------------------- | ---------------- |
| `SESSION_SECRET`     | Secret key for session encryption (required in production) | `dev-secret-...` |
| `ALLOW_REGISTRATION` | Toggle: set to `true` to allow additional users            | `false`          |

---

## 🚀 Deployment

### 1. Docker Deployment (Standard)

```bash
docker build -t homebank-bridge .

docker run -d \
  -p 3000:3000 \
  -v ./hb-data:/app/backend/data \
  -e SESSION_SECRET="your-secure-secret" \
  -e FRONTEND_URL="https://your-domain.com" \
  --name homebank-bridge \
  homebank-bridge
```

### 2. Coolify Deployment (Recommended)

1.  **Source**: Add a new resource from **Git Repository**.
2.  **Build Pack**: Select **Dockerfile**.
3.  **Network**:
    *   **Exposed Port**: `3000`
    *   **Port Mapping**: Set `3005:3000` if using an external proxy.
4.  **Environment Variables**: Set `SESSION_SECRET`, `FRONTEND_URL`, and `ALLOW_REGISTRATION`.
5.  **Persistent Storage**: Mount path `/app/backend/data`.
6.  **Deploy**: Click "Deploy".

---

## 📊 HomeBank Compatibility

The Bridge is strictly configured to satisfy the HomeBank CSV import parser:
- **Date Format**: Customizable (`DD-MM-YYYY`, `MM-DD-YYYY`, `YYYY-MM-DD`).
- **Decimal Separator**: Customizable (`.`, `,`).
- **Field Separator**: `;` (Semicolon).
- **Hierarchical Categories**: Parent:Child path resolution.

---

## 📜 Changelog

### Unreleased
- **📋 Templates**: The Scheduled tab is now "Templates": plain templates (pick one in the entry form to fill it in) and scheduled items. HomeBank import brings all templates and recognises HomeBank 5.9+ scheduled items (`recflg`), which were previously skipped.
- **🏦 Account options & converted totals**: Exclude accounts from summary / budget / reports (imported from HomeBank) and see group and grand totals in your base currency using the exchange rates in Options.
- **📂 Import from HomeBank (.xhb)**: Options → Import from HomeBank reads your desktop file and moves accounts (types, closed state, currencies), categories, payees, transactions (status, tags, info), transfers, budgets, scheduled transactions and assignment rules. A preview shows what will be imported first; replacing existing data needs explicit confirmation and offers a backup download. Split transactions become one entry per part (tag `split`); void entries and regex rules are skipped.
- **🛡️ Safer "Post all due"**: Shows how many transactions will be created before posting, with a warning when old schedules would create many entries.
- **🏷️ Tags**: Add tags to any entry (space-separated, exported in the HomeBank CSV `tags` column and read back on import). Click a tag to filter the ledger; Reports can group by tag.
- **⚡ Assignment Rules**: "If payee/memo contains X → set category, payment type and tags." Rules fill the entry form as you type, run automatically on CSV import for rows without a category, and can be applied on demand to existing uncategorised entries (with a preview count first).
- **🔁 Scheduled Transactions**: Recurring expenses, income and transfers (every N days / weeks / months / years, optional end date). Due items are shown on Home and in the Scheduled tab; post or skip them one by one, or post all due at once. Nothing is posted automatically, so using the app on several computers never creates duplicates. Monthly items keep their day (e.g. the 31st falls back to the 30th/28th in shorter months).
- **🎯 Monthly Budget**: Set a budget per category — the same amount every month or a different amount per month. The Budget tab shows budget vs actual, remaining amount and an "over budget" warning for any month; parent categories include their subcategories.
- **📈 Reports**: Expense or income totals grouped by category, subcategory, payee or month, for any period (presets or a custom range), per account or currency, with CSV export.
- **🏠 Home Dashboard**: New start screen like HomeBank's main window — income / expense / balance for a chosen period (this month, last month, last 30 days, this year, last 12 months), top spending by category, income vs expense for the last 6 months, and an account summary with per-currency totals. Transfers between own accounts are not counted as income or spending.
- **✅ Transaction Status (HomeBank-style)**: Each entry can be *None*, *Cleared (C)* or *Reconciled (R)*. Click the badge to change it, or mark many entries at once. New status filter in the ledger.
- **🏦 Account Types & Closing**: Accounts now have a type (Bank, Checking, Savings, Cash, Credit Card, Asset, Liability) and can be closed — closed accounts are hidden from lists and new entries, history is kept.
- **📊 HomeBank Balances**: Account list shows *Reconciled*, *Today* and *Future* balances, grouped by account type.
- **📒 Running Balance**: When the ledger is filtered to one account, each entry shows the account balance after it.
- **🛠️ Restore Upgrade**: Restoring an older database backup now applies pending schema migrations automatically.

### Version 1.0.3 (2026-01-15)
- **🔔 Interactive Notifications**: Implemented a global toast system for instant feedback on all data operations (success and errors).
- **👯 Transaction Duplication**: Added a "Duplicate" button in ledger actions to quickly clone existing records.
- **🔄 Save & Repeat Mode**: Added a "Finalize & Repeat" button to the transaction form to streamline bulk data entries.
- **💾 Persistent UX**: Key settings like "Privacy Mode" and "Date Format" are now synchronized with the backend database for a persistent cross-device experience.
- **🛠️ Bugfix: Category Engine**: Resolved a critical validation error that caused UI crashes during category creation with null parent IDs.
- **📊 Export State Tracking**: Transactions are now visually marked and tracked when included in CSV manifests.

### Version 1.0.2 (2026-01-15)
- **🛡️ Registration Shield**: Hardened backend API to strictly enforce registration toggle settings, preventing unauthorized account creation.
- **🛠️ IDE Stability**: Resolved critical TypeScript definition errors for Node.js and Vite.
- **📦 Ecosystem Sync**: Fixed missing `node_modules` states across root and backend directories.

### Version 1.0.1 (2025-12-30)
- **📈 Taxonomy Balances**: Integrated recursive balance calculations for hierarchical categories.
- **🚀 Import Engine XL**: Batch processing for massive CSV files and enhanced duplicate detection.
- **🐳 Docker Health**: Integrated container health checks for zero-downtime deployments.

### Version 1.0.0 (2025-12-20)
- **🎉 Initial Release**: Core transaction engine, multi-account support, and HomeBank CSV compliance.

---

## 🤝 Contributing

This is an open-source project evolving towards a production-ready financial tool. Contributions and technical discussions are welcome via GitHub Issues.

---

## ☕ Support

If you find this tool useful, feel free to support its development!

[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://paypal.me/newbes)
