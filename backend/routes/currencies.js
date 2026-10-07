import express from 'express';
import { body } from 'express-validator';
import db from '../db/index.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

// GET /api/currencies - base currency and exchange rates ({ base, rates: { USD: 1.17, ... } })
router.get('/', async (req, res, next) => {
  try {
    const base = await db.get("SELECT value FROM app_settings WHERE key = 'base_currency'");
    const rows = await db.all('SELECT code, rate FROM currency_rates ORDER BY code');
    res.json({ base: base?.value || '', rates: Object.fromEntries(rows.map(r => [r.code, r.rate])) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/currencies - replace base currency and rates. Body: { base, rates: { CODE: number > 0 } }
router.put('/',
  [
    body('base').isString().trim().isLength({ max: 10 }),
    body('rates').isObject().withMessage('rates must be an object'),
    validate
  ],
  async (req, res, next) => {
    const base = req.body.base.trim();
    const entries = Object.entries(req.body.rates);
    if (entries.length > 200) return res.status(400).json({ error: 'Too many currencies' });
    for (const [code, rate] of entries) {
      if (!/^[\p{L}\p{N} ._-]{1,10}$/u.test(code)) return res.status(400).json({ error: `Invalid currency code: ${code}` });
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return res.status(400).json({ error: `Rate for ${code} must be greater than 0` });
    }
    try {
      await db.exec('BEGIN TRANSACTION');
      try {
        await db.run("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('base_currency', ?)", base);
        await db.run('DELETE FROM currency_rates');
        for (const [code, rate] of entries) {
          if (code !== base) await db.run('INSERT INTO currency_rates (code, rate) VALUES (?, ?)', code, rate);
        }
        await db.exec('COMMIT');
      } catch (err) {
        await db.exec('ROLLBACK');
        throw err;
      }
      res.json({ message: 'Exchange rates saved' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
