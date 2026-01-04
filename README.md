# 🌉 HomeBank Bridge

> **A High-Performance, Minimalist Financial Logging Engine**
> Fully compliant CSV bridge for the HomeBank ecosystem, built with React 19 and SQLite WASM.

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

HomeBank Bridge supports **two main deployment options**:

1. **Traditional Web Server** (VPS with Node.js)
2. **Containerized Deployment** (Docker, Coolify)

📖 **For detailed deployment instructions, see:**
- 🇬🇧 [DEPLOYMENT.md](DEPLOYMENT.md) - Complete deployment guide (English)
- 🇵🇱 [DEPLOYMENT-PL.md](DEPLOYMENT-PL.md) - Pełny przewodnik wdrożenia (Polski)

### Quick Start: Docker Deployment

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

### Quick Start: Traditional Server

```bash
# Install dependencies
npm install
cd backend && npm install && cd ..

# Build frontend
npm run build

# Copy and configure environment
cp .env.example .env
nano .env  # Edit configuration

# Run with PM2
cd backend
npm install -g pm2
pm2 start server.js --name homebank-bridge
```

### Coolify Deployment

1.  **Source**: Add a new resource from **Git Repository**.
2.  **Build Pack**: Select **Dockerfile**.
3.  **Network**:
    *   **Exposed Port**: `3000`
    *   **Port Mapping**: Set `3005:3000` if using an external proxy.
4.  **Environment Variables**: Set `SESSION_SECRET`, `FRONTEND_URL`, and `ALLOW_REGISTRATION`.
5.  **Persistent Storage**: Mount path `/app/backend/data`.
6.  **Deploy**: Click "Deploy".

---

## ❓ Deployment FAQ

### Can I run this on a regular web server?
**Yes!** HomeBank Bridge can run on any VPS or server with Node.js 18+. You don't need Docker - a traditional server setup works perfectly. See [DEPLOYMENT.md](DEPLOYMENT.md) for details.

### Do I need a separate database server?
**No!** The application uses SQLite, a file-based database. No MySQL, PostgreSQL, or other database server is required.

### What are my deployment options?
- **Traditional Server**: Direct Node.js installation on VPS/dedicated server
- **Docker**: Containerized deployment for easier management
- **Coolify/PaaS**: Managed deployment platforms

See the comprehensive guides:
- [DEPLOYMENT.md](DEPLOYMENT.md) (English)
- [DEPLOYMENT-PL.md](DEPLOYMENT-PL.md) (Polish)

---

## 📊 HomeBank Compatibility

The Bridge is strictly configured to satisfy the HomeBank CSV import parser:
- **Date Format**: Customizable (`DD-MM-YYYY`, `MM-DD-YYYY`, `YYYY-MM-DD`).
- **Decimal Separator**: Customizable (`.`, `,`).
- **Field Separator**: `;` (Semicolon).
- **Hierarchical Categories**: Parent:Child path resolution.

---

## 🤝 Contributing

This is an open-source project evolving towards a production-ready financial tool. Contributions and technical discussions are welcome via GitHub Issues.

---

## ☕ Support

If you find this tool useful, feel free to support its development!

[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://paypal.me/newbes)
