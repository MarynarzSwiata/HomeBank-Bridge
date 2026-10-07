import express from 'express';
import fs from 'fs';
import path from 'path';
import config from '../config/database.js';
import db, { initDb, closeDb } from '../db/index.js';
import runMigrations from '../db/migrate.js';
import { parseXhb, buildPlan, planSummary, applyPlan, hasExistingData } from '../services/xhbImport.js';
import { buildXhb } from '../services/xhbExport.js';
import { advanceDate } from './scheduled.js';
import { safetyBackup, listBackups, backupPath } from '../services/backups.js';

import multer from 'multer';

const router = express.Router();

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });
// HomeBank files are read in memory (never written to disk)
const xhbUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 } });

// Backup database
router.get('/backup', async (req, res) => {
  console.log('📬 GET /api/system/backup - Starting backup');
  try {
    const dbPath = config.dbPath;
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Database file not found' });
    }

    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const filename = `database-${day}-${month}-${year}.db`;
    
    console.log(`📦 Generating backup: ${filename}`);
    res.download(dbPath, filename, (err) => {
      if (err) {
        console.error('Backup download failed:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
      }
    });
  } catch (err) {
    console.error('Backup failed:', err);
    res.status(500).json({ error: 'Backup failed' });
  }
});

const isSqliteFile = (file) => {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    return buf.toString('utf8', 0, 15) === 'SQLite format 3';
  } finally {
    fs.closeSync(fd);
  }
};

/**
 * Replace the live database with a copy of `srcPath`, then reopen it and apply
 * pending migrations (older backups may predate them).
 */
async function replaceDatabase(srcPath) {
  const dbPath = config.dbPath;

  // Close current DB connection to release file locks (CRITICAL for Windows)
  console.log('🔒 Closing database connection for restore...');
  await closeDb();

  // Keep the current file in case copying fails halfway
  const backupPath = `${dbPath}.bak`;
  try {
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }
    fs.copyFileSync(srcPath, dbPath);

    // Clean up stale WAL/SHM files
    const walFile = `${dbPath}-wal`;
    const shmFile = `${dbPath}-shm`;
    if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);

    console.log('✅ Database files replaced. Re-initializing connection...');
  } catch (fsErr) {
    console.error('File operation failed during restore:', fsErr);
    if (fs.existsSync(backupPath)) fs.copyFileSync(backupPath, dbPath);
    throw fsErr;
  } finally {
    await initDb();
  }

  await runMigrations();
}

// Restore database from an uploaded file
router.post('/restore', upload.single('database'), async (req, res) => {
  console.log('📥 POST /api/system/restore - Restore requested');
  const tempPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!isSqliteFile(tempPath)) {
      return res.status(400).json({ error: 'Invalid database file format' });
    }

    await safetyBackup('restore');
    await replaceDatabase(tempPath);

    console.log('🎉 Database restored successfully');
    res.json({ message: 'Database restored successfully.' });
  } catch (err) {
    console.error('Restore failed:', err);
    res.status(500).json({ error: 'Restore failed: ' + err.message });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
});

// GET /api/system/backups - Automatic and safety backups stored on the server
router.get('/backups', (req, res, next) => {
  try {
    res.json(listBackups());
  } catch (err) {
    next(err);
  }
});

// GET /api/system/backups/:name - Download one stored backup
router.get('/backups/:name', (req, res) => {
  const file = backupPath(req.params.name);
  if (!file) return res.status(404).json({ error: 'Backup not found' });
  res.download(file, req.params.name);
});

// POST /api/system/backups/:name/restore - Replace current data with a stored backup
router.post('/backups/:name/restore', async (req, res) => {
  const file = backupPath(req.params.name);
  if (!file) return res.status(404).json({ error: 'Backup not found' });
  try {
    if (!isSqliteFile(file)) return res.status(400).json({ error: 'Invalid database file format' });
    // Safety copy first, so this restore can be undone too
    await safetyBackup('restore');
    await replaceDatabase(file);
    console.log(`🎉 Database restored from backup ${req.params.name}`);
    res.json({ message: 'Database restored successfully.' });
  } catch (err) {
    console.error('Restore from backup failed:', err);
    res.status(500).json({ error: 'Restore failed: ' + err.message });
  }
});

// Hard Reset
router.post('/reset', async (req, res) => {
  console.log('💣 POST /api/system/reset - Hard Reset requested');
  try {
    await safetyBackup('reset');

    // We execute individual DELETEs in the right order of dependencies
    await db.run('PRAGMA foreign_keys = OFF');
    
    await db.run('BEGIN TRANSACTION');
    
    // Order: Children first
    // 1. Transactions (child of accounts, categories)
    // 2. Payees (child of categories)
    // 3. Accounts
    // 4. Categories (self-referencing parent_id handles via Order if needed, but DELETE ALL is fine)
    // 5. Export Logs
    const tables = ['transactions', 'payees', 'budgets', 'scheduled', 'rules', 'accounts', 'categories', 'currency_rates', 'export_log'];
    for (const table of tables) {
      await db.run(`DELETE FROM ${table}`);
      try {
        await db.run(`DELETE FROM sqlite_sequence WHERE name = ?`, table);
      } catch (seqErr) {
        // Ignore
      }
    }
    
    await db.run('COMMIT');
    await db.run('PRAGMA foreign_keys = ON');
    
    console.log('⚠️ System Hard Reset executed successfully');
    res.json({ message: 'Database reset successfully' });
  } catch (err) {
    try { await db.run('ROLLBACK'); } catch (e) {}
    console.error('Reset failed:', err);
    res.status(500).json({ error: 'Reset failed: ' + err.message });
  }
});

// POST /api/system/import-xhb - Import a HomeBank .xhb file
// Form fields: file (the .xhb), mode = 'preview' | 'import', replace = 'true' to wipe existing finance data first.
// Preview only parses and counts. Import runs in one DB transaction (all or nothing).
router.post('/import-xhb', (req, res, next) => {
  xhbUpload.single('file')(req, res, (uploadErr) => {
    if (uploadErr) {
      const msg = uploadErr.code === 'LIMIT_FILE_SIZE' ? 'The file is too large (max 20 MB)' : 'Upload failed';
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const mode = req.body.mode === 'import' ? 'import' : 'preview';
    const replace = req.body.replace === 'true';

    const text = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    const plan = buildPlan(parseXhb(text));
    const summary = planSummary(plan);
    const existing = await hasExistingData();

    if (mode === 'preview') {
      return res.json({ summary, hasExistingData: existing });
    }
    if (existing && !replace) {
      return res.status(409).json({ error: 'The app already contains data. Confirm replacing it to import.' });
    }

    if (existing) await safetyBackup('import');
    await applyPlan(plan, { replace });
    console.log(`📥 HomeBank import: ${summary.accounts} accounts, ${summary.transactions} transactions`);
    res.json({ message: 'HomeBank file imported', summary });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

// GET /api/system/export-xhb - Download all data as a HomeBank .xhb file
router.get('/export-xhb', async (req, res, next) => {
  try {
    const xml = await buildXhb({ advanceDate });
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="homebank-bridge-${date}.xhb"`);
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

// Get app settings
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await db.all('SELECT key, value FROM app_settings');
    const result = {};
    settings.forEach(s => {
      result[s.key] = s.value;
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Update app setting
router.put('/settings/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    // Whitelist of allowed settings
    const allowedSettings = ['allow_registration', 'privacy_mode', 'date_format'];
    if (!allowedSettings.includes(key)) {
      return res.status(400).json({ error: 'Invalid setting key' });
    }
    
    // Validate value
    if (typeof value !== 'string') {
      return res.status(400).json({ error: 'Value must be a string' });
    }
    
    await db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [key, value]
    );
    
    console.log(`⚙️ Setting updated: ${key} = ${value}`);
    res.json({ key, value });
  } catch (err) {
    next(err);
  }
});

export default router;

