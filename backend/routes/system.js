import express from 'express';
import fs from 'fs';
import path from 'path';
import config from '../config/database.js';
import db, { initDb, closeDb } from '../db/index.js';

import multer from 'multer';

const router = express.Router();

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

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

// Restore database
router.post('/restore', upload.single('database'), async (req, res) => {
  console.log('📥 POST /api/system/restore - Restore requested');
  let tempPath;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const dbPath = config.dbPath;
    tempPath = req.file.path;

    // Validate if it's a valid SQLite file
    const buffer = fs.readFileSync(tempPath, { encoding: null, flag: 'r' });
    const header = buffer.toString('utf8', 0, 15);
    if (!header.startsWith('SQLite format 3')) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return res.status(400).json({ error: 'Invalid database file format' });
    }

    // Step 1: Close current DB connection to release file locks (CRITICAL for Windows)
    console.log('🔒 Closing database connection for restore...');
    await closeDb();

    // Backup current one locally just in case
    const backupPath = `${dbPath}.bak`;
    try {
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
      }

      // Step 2: Replace file
      fs.copyFileSync(tempPath, dbPath);
      
      // Step 3: Clean up stale WAL/SHM files
      const walFile = `${dbPath}-wal`;
      const shmFile = `${dbPath}-shm`;
      if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
      if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
      
      console.log('✅ Database files replaced. Re-initializing connection...');
    } catch (fsErr) {
      console.error('File operation failed during restore:', fsErr);
      // Attempt to restore from .bak if it went wrong halfway
      if (fs.existsSync(backupPath)) fs.copyFileSync(backupPath, dbPath);
      throw fsErr;
    } finally {
      // Step 4: Re-open connection
      await initDb();
      if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }

    console.log('🎉 Database restored successfully');
    res.json({ message: 'Database restored successfully.' });
  } catch (err) {
    console.error('Restore failed:', err);
    res.status(500).json({ error: 'Restore failed: ' + err.message });
  }
});

// Hard Reset
router.post('/reset', async (req, res) => {
  console.log('💣 POST /api/system/reset - Hard Reset requested');
  try {
    // We execute individual DELETEs in the right order of dependencies
    await db.run('PRAGMA foreign_keys = OFF');
    
    await db.run('BEGIN TRANSACTION');
    
    // Order: Children first
    // 1. Transactions (child of accounts, categories)
    // 2. Payees (child of categories)
    // 3. Accounts
    // 4. Categories (self-referencing parent_id handles via Order if needed, but DELETE ALL is fine)
    // 5. Export Logs
    const tables = ['transactions', 'payees', 'accounts', 'categories', 'export_log'];
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

