import express from 'express';
import cors from 'cors';
import session from 'express-session';
import connectSqlite3 from 'connect-sqlite3';
import fs from 'fs';
import path from 'path';
import runMigrations from './db/migrate.js';
import config from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth, requireAdmin } from './middleware/requireAuth.js';
import authRouter from './routes/auth.js';
import accountsRouter from './routes/accounts.js';
import transactionsRouter from './routes/transactions.js';
import categoriesRouter from './routes/categories.js';
import payeesRouter from './routes/payees.js';
import exportLogRouter from './routes/export-log.js';
import systemRouter from './routes/system.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow any origin (for network testing)
    const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:5173'];
    
    // Check if origin matches allowed list or is a local network IP
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://192.168.') || origin.startsWith('http://localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body parsing
app.use(express.json());

// Session secret validation
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ FATAL: SESSION_SECRET environment variable is required in production');
    process.exit(1);
  } else {
    console.warn('⚠️  WARNING: SESSION_SECRET not set. Using insecure default for development only.');
  }
}

// Session configuration with SQLite store
const SQLiteStore = connectSqlite3(session);
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.dirname(config.dbPath),
    table: 'sessions',
  }),
  secret: sessionSecret || 'dev-secret-do-not-use-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Cleanup temporary uploads on startup
const uploadsDir = path.join(process.cwd(), 'uploads');
if (fs.existsSync(uploadsDir)) {
  const files = fs.readdirSync(uploadsDir);
  for (const file of files) {
    try {
      fs.unlinkSync(path.join(uploadsDir, file));
    } catch (err) {
      console.warn(`Could not clean up temp file ${file}:`, err.message);
    }
  }
}

// Run migrations on startup
await runMigrations();

// Health check (public)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (public)
app.use('/api/auth', authRouter);

// Protected API Routes
app.use('/api/accounts', requireAuth, accountsRouter);
app.use('/api/transactions', requireAuth, transactionsRouter);
app.use('/api/categories', requireAuth, categoriesRouter);
app.use('/api/payees', requireAuth, payeesRouter);
app.use('/api/export-log', requireAuth, exportLogRouter);

// Admin-only routes (backup, reset, restore)
app.use('/api/system', requireAdmin, systemRouter);

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(process.cwd(), 'public');
  app.use(express.static(publicPath));
  
  // SPA fallback
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Error handling (must be last)
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HomeBank Bridge API server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Database: WAL mode enabled with 5s busy_timeout`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Authentication: enabled`);
});
