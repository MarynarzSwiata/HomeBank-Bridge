# 🌉 HomeBank Bridge

> **A High-Performance, Minimalist Financial Logging Engine**
> Fully compliant CSV bridge for the HomeBank ecosystem, built with React 19 and SQLite WASM.

---

## 🚀 The Vision

**HomeBank Bridge** is a technical design and implementation blueprint for a minimalist financial logging application. It serves as a high-efficiency entry point for tracking personal finances (Income, Expenses, Transfers) with multi-account support, designed specifically for seamless export to **HomeBank**.

This project eliminates the friction of manual CSV editing by providing a mobile-friendly, synchronized interface that bridges the gap between daily spending and long-term financial management.

---

## ✨ Key Features

- **🧠 Smart Entry Engine**: Intelligent autofill that learns from your history. Once you log a payee (e.g., "Mercadona"), the Bridge automatically suggests the correct Category and Payment Type for the next time.
- **🔄 Dual-Record Transfer**: A unified form logic that atomically creates two linked transactions (Debit/Credit) for internal transfers, maintaining absolute balance integrity.
- **📥 Advanced Import Logic**: Resilient CSV processing with resilient date parsing (supporting multiple formats), decimal separator normalization, and case-insensitive category matching. Automatically detects and skips duplicates based on date, payee, and amount.
- **📈 Strict Compliance Export**: High-fidelity CSV generation for Transactions, Accounts, Categories, and Payees. Features "Smart Grouping" to handle multi-account datasets and hierarchical category path resolution.
- **📜 Export Archives (Archives)**: Secure history of all generated manifests. Supports instant CSV re-download, in-app content preview, and manual history management.
- **🛠️ System Resilience (Options)**: Built-in database management including full factory reset, backup snapshots (`database-DD-MM-YYYY.db`), and database restoration with automatic SQLite lock handling.
- **✨ Animated Identity**: Integrated animated SVG favicon and UI components providing a premium, reactive visual experience.
- **🔔 Premium Notifications**: Global non-blocking Toast notification system replacing browser alerts for all system events and data mutations.
- **📱 Mobile-First UI**: Adaptive layout engine that automatically switches from high-density data tables on desktop to touch-optimized card views on small screens (640px/768px). Includes a dedicated bottom navigation bar for ergonomic one-handed use.
- **🛡️ Privacy Mode (Anonymizer)**: Integrated global toggle in the Action Bar that instantly hides/filters sensitive financial data (amounts, balances) for secure use in public environments.
- **🌍 Localization & Regional Settings**: Dynamic support for custom date formats (`DD-MM-YYYY`, `YYYY-MM-DD`, etc.) and decimal separators (`.`, `,`) affecting both import parsing and export generation.
- **🛡️ Secure-by-Design**: Hardened API endpoints with payload size limits (10MB), rate limiting (5 req/5min), and strict filename sanitization to prevent Header Injection and DoS attacks.

---

## 🛠 Tech Stack

| Layer          | Technology                                                         |
| :------------- | :----------------------------------------------------------------- |
| **Frontend**   | [React 19](https://react.dev/)                                     |
| **Backend**    | [Node.js](https://nodejs.org/) / [Express](https://expressjs.com/) |
| **Build Tool** | [Vite](https://vitejs.dev/)                                        |
| **Database**   | [SQLite](https://sqlite.org/)                                      |
| **Styling**    | [Tailwind CSS](https://tailwindcss.com/)                           |
| **Language**   | [TypeScript](https://www.typescriptlang.org/)                      |

---

## ⚙️ Development & Build

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

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
   Edit `.env` and set:
   - `SESSION_SECRET` - A secure random string (min 32 characters)
   - `ALLOW_REGISTRATION` - Set to `true` to allow multiple users (default: `false`)

4. Run developmental server:
   ```bash
   npm run dev
   ```

---

## 🔐 Authentication

HomeBank Bridge includes a local authentication system:

- **Single-Admin Mode**: The first registered user becomes the administrator. After this, registration is disabled by default.
- **Session-Based Auth**: Uses `httpOnly` cookies for secure session management (7-day expiry).
- **Rate Limiting**: Login attempts are limited to 5 per 5 minutes per IP to prevent brute-force attacks.
- **Admin Controls**: System operations (backup, restore, reset) are restricted to administrators only.

### Environment Variables

| Variable             | Description                                                | Default          |
| -------------------- | ---------------------------------------------------------- | ---------------- |
| `SESSION_SECRET`     | Secret key for session encryption (required in production) | `dev-secret-...` |
| `ALLOW_REGISTRATION` | Override: set to `true` to force-enable registration       | `false`          |

### Opening Registration

To allow additional users after the admin account is created:

**Option A - Admin UI Toggle (Recommended):**
1. Log in as administrator
2. Go to **Options** → **User Management**
3. Toggle "Allow Registration" to enable

**Option B - Environment Variable Override:**
1. Set `ALLOW_REGISTRATION=true` in your `.env` file
2. Restart the backend server

New users registered will not have admin privileges.

### Production Build
To create an optimized production bundle:
```bash
npm run build
```

---

## � Deployment

### Docker (Generic)

This project is container-ready. To run it using Docker:

1.  **Build and Run**:
    ```bash
    docker build -t homebank-bridge .
    docker run -d \
      -p 3000:3000 \
      -v hbb-data:/app/backend/data \
      -e SESSION_SECRET="your-secure-secret" \
      --name homebank-bridge \
      homebank-bridge
    ```
2.  **Access**: Open `http://localhost:3000`

### Coolify (Recommended)

HomeBank Bridge is optimized for Coolify. Follow these steps:

1.  **Source**: Add a new resource from **Git Repository**.
2.  **Build Pack**: Select **Docker Compose** or **Dockerfile** (it will auto-detect the `Dockerfile` in root).
3.  **Environment Variables**:
    *   `SESSION_SECRET`: Generates a long random string (Required).
    *   `ALLOW_REGISTRATION`: Set to `true` for the initial setup, then switch to `false`.
    *   `PORT`: `3000` (Container internal port).
4.  **Persistent Storage (Critical)**:
    *   Go to **Storage** tab.
    *   Add a new volume mount:
        *   **Mount Path**: `/app/backend/data`
        *   This ensures your `data.db` (transactions) and `sessions.db` (login states) survive deployments.
5.  **Deploy**: Click "Deploy".
6.  **SSL**: Coolify handles SSL automatically. Ensure your domain points to the service.

**Note on First Run**: The database is initialized empty. The first registered user automatically becomes the Admin.

---

## �📊 HomeBank Compatibility

The Bridge is strictly configured to satisfy the HomeBank CSV import parser:
- **Date Format**: `DD-MM-YYYY` (customizable in UI)
- **Decimal Separator**: `,` (Comma)
- **Field Separator**: `;` (Semicolon)
- **Payment Mapping**: Full mapping of HomeBank payment types (0=None, 1=Credit Card, 3=Cash, 6=Debit Card, etc.)

---

## 📂 Project Structure

- `src/components/` - View-specific components (Transactions, Accounts, etc.) and shared UI.
- `src/hooks/` - Data management and business logic extraction.
- `src/api/` - Backend communication adapters and fetch services.
- `backend/` - Node.js Express server, SQLite database, and API routes.
- `App.tsx` - Application layout and navigation.
- `types/` - Centralized TypeScript definitions.

---

## 📊 HomeBank Compatibility

The Bridge is strictly configured to satisfy the HomeBank CSV import parser:
- **Date Format**: Customizable (`DD-MM-YYYY`, `MM-DD-YYYY`, `YYYY-MM-DD`).
- **Decimal Separator**: Customizable (`.`, `,`).
- **Field Separator**: `;` (Semicolon) - Hardcoded for maximum reliability.
- **Hierarchical Categories**: Parent:Child path resolution for Payees and Transactions.
- **Export Control**: "Only Selected" policy ensures precision in data transfer.
- **Duplicate Protection**: Integrated date/payee/amount verification during import.

---

## 🤝 Contributing

This is a private project evolving towards a production-ready PWA. Technical discussions are welcome via GitHub Issues.

---


## 🚀 Deployment

This application is designed to be easily deployed using **Docker** or platforms like **Coolify**.

### 1. Docker Deployment (Standard)

The project includes a multi-stage `Dockerfile` that builds the frontend and serves it via the backend.

```bash
# Build the image
docker build -t homebank-bridge .

# Run the container
docker run -d \
  -p 3000:3000 \
  -v ./hb-data:/app/backend/data \
  -e SESSION_SECRET="your-secure-secret" \
  -e FRONTEND_URL="https://your-domain.com" \
  --name homebank-bridge \
  homebank-bridge
```

### 2. Coolify Deployment (Recommended)

1.  **Create New Resource**: Choose "Public Repository" and point to your fork.
2.  **Build Pack**: Select **Dockerfile**.
3.  **Network Configuration**:
    *   **Ports Exposes**: `3000`
    *   **Ports Mappings**: If you are using an external proxy (like Nginx Proxy Manager), set this to `3005:3000` (or any free port on your host). If you let Coolify handle the domain, leave this empty.
4.  **Environment Variables**:
    *   `SESSION_SECRET`: Generate a long random string.
    *   `FRONTEND_URL`: Your full domain (e.g., `https://finance.example.com`).
    *   `ALLOW_REGISTRATION`: `true` (recommended to set to `false` after creating your first user).
5.  **Persistent Storage**:
    *   Add a Volume: `Destination Path: /app/backend/data`. This ensures your database and sessions survive restarts.
6.  **Proxy Setting**: Ensure `trust proxy` is enabled (it's built-in in this repo) to allow secure session cookies behind Traefik/Caddy.

### 🛡️ Security Note
After successful registration of the first account, it is highly recommended to set the `ALLOW_REGISTRATION` environment variable to `false` and redeploy to prevent unauthorized access.

## ☕ Support

If you find this tool useful and would like to support its ongoing development, server costs, or just buy me a coffee, you can donate via PayPal. Every contribution is greatly appreciated and helps keep the bridge strong!

[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://paypal.me/newbes)
