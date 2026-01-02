import express from 'express';
import db from '../db/index.js';

const router = express.Router();

// GET /api/export-log - Get export history
router.get('/', async (req, res, next) => {
  try {
    const logs = await db.all(`
      SELECT id, timestamp, filename, count
      FROM export_log
      ORDER BY id DESC
    `);

    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// POST /api/export-log - Create a new log entry
router.post('/', async (req, res, next) => {
  try {
    const { filename, count, csv_content } = req.body;

    // Basic validation
    if (!filename || count === undefined || csv_content === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Security check: Limit CSV content size (e.g., 10MB) to prevent DoS
    if (csv_content.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'Payload too large (max 10MB)' });
    }

    const { lastID } = await db.run(
      'INSERT INTO export_log (filename, count, csv_content) VALUES (?, ?, ?)',
      filename,
      count,
      csv_content
    );
    res.json({ id: lastID });
  } catch (err) {
    next(err);
  }
});

// GET /api/export-log/:id/download - Download CSV from log
router.get('/:id/download', async (req, res, next) => {
  try {
    const log = await db.get('SELECT filename, csv_content FROM export_log WHERE id = ?', req.params.id);
    if (!log) return res.status(404).json({ error: 'Log not found' });

    // Security: Sanitize filename for Content-Disposition header
    // Stricter sanitization: remove CR/LF and everything that's not alphanumeric, dot, dash, or underscore
    // This prevents header injection even if " is bypassed
    const safeFilename = log.filename
      .replace(/[\r\n]/g, '') // Strip CR/LF entirely
      .replace(/[^a-zA-Z0-9._-]/g, '_'); // Replace other unsafe characters with underscore
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.send(log.csv_content);
  } catch (err) {
    next(err);
  }
});

// GET /api/export-log/:id/preview - Preview previously exported CSV (as JSON)
router.get('/:id/preview', async (req, res, next) => {
  try {
    const log = await db.get('SELECT csv_content FROM export_log WHERE id = ?', req.params.id);
    if (!log) return res.status(404).json({ error: 'Log not found' });
    res.json({ content: log.csv_content });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/export-log/:id - Delete a log entry
router.delete('/:id', async (req, res, next) => {
  try {
    await db.run('DELETE FROM export_log WHERE id = ?', req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/export-log - Delete all log entries
router.delete('/', async (req, res, next) => {
  try {
    await db.run('DELETE FROM export_log');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
