import express from 'express';
import cors from 'cors';
import session from 'express-session';
import connectSqlite3 from 'connect-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import runMigrations from './db/migrate.js';
import config from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth, requireAdmin } from './middleware/requireAuth.js';

// Route imports
import authRouter from './routes/auth.js';
import accountsRouter from './routes/accounts.js';
import transactionsRouter from './routes/transactions.js';
import categoriesRouter from './routes/categories.js';
import payeesRouter from './routes/payees.js';
import exportLogRouter from './routes/export-log.js';
import systemRouter from './routes/system.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable trust proxy for reverse proxy deployments (Coolify, Traefik, etc.)
// Required for secure cookies to work behind a proxy
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;

// Security & Parsing
app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Management
const SQLiteStore = connectSqlite3(session);
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.dirname(config.dbPath),
    table: 'sessions',
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-do-not-use-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Clean up temporary uploads on startup
const uploadsDir = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsDir)) {
  const files = fs.readdirSync(uploadsDir);
  for (const file of files) {
    try {
      fs.unlinkSync(path.join(uploadsDir, file));
    } catch (err) {
      console.warn(`Could not clean up temp file ${file}: `, err.message);
    }
  }
}

// Run migrations on startup
await runMigrations();

// Log all requests
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production' || req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// APIs
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/auth', authRouter);
app.use('/api/accounts', requireAuth, accountsRouter);
app.use('/api/transactions', requireAuth, transactionsRouter);
app.use('/api/categories', requireAuth, categoriesRouter);
app.use('/api/payees', requireAuth, payeesRouter);
app.use('/api/export-log', requireAuth, exportLogRouter);
app.use('/api/system', requireAdmin, systemRouter);

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));

  // SPA fallback
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicPath, 'index.html'), (err) => {
      if (err) {
        if (!res.headersSent) {
          res.status(500).send('ERROR: Could not load index.html');
        }
      }
    });
  });
}

// Error handling (must be last)
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HomeBank Bridge API server running on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
  console.log(`📌 Data directory: ${path.dirname(config.dbPath)}`);
});
