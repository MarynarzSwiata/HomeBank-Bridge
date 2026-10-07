import express from 'express';
import { body, param } from 'express-validator';
import db from '../db/index.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

// GET /api/budget - All budget rows: [{ category_id, month, amount }]
router.get('/', async (req, res, next) => {
  try {
    const rows = await db.all('SELECT category_id, month, amount FROM budgets ORDER BY category_id, month');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PUT /api/budget/:categoryId - Replace the budget of one category
// Body: { mode: 'none' } | { mode: 'same', amount } | { mode: 'monthly', months: [12 numbers] }
router.put('/:categoryId',
  [
    param('categoryId').isInt(),
    body('mode').isIn(['none', 'same', 'monthly']).withMessage('Invalid budget mode'),
    body('amount').if(body('mode').equals('same')).isFloat({ min: 0 }).withMessage('Amount must be >= 0'),
    body('months').if(body('mode').equals('monthly')).isArray({ min: 12, max: 12 }).withMessage('months must have 12 values'),
    body('months.*').optional().isFloat({ min: 0 }).withMessage('Monthly amounts must be >= 0'),
    validate
  ],
  async (req, res, next) => {
    const { categoryId } = req.params;
    const { mode, amount, months } = req.body;
    try {
      const category = await db.get('SELECT id FROM categories WHERE id = ?', categoryId);
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      await db.exec('BEGIN TRANSACTION');
      try {
        await db.run('DELETE FROM budgets WHERE category_id = ?', categoryId);
        if (mode === 'same' && Number(amount) > 0) {
          await db.run('INSERT INTO budgets (category_id, month, amount) VALUES (?, 0, ?)', categoryId, Number(amount));
        }
        if (mode === 'monthly') {
          for (let m = 1; m <= 12; m++) {
            const value = Number(months[m - 1]) || 0;
            if (value > 0) {
              await db.run('INSERT INTO budgets (category_id, month, amount) VALUES (?, ?, ?)', categoryId, m, value);
            }
          }
        }
        await db.exec('COMMIT');
      } catch (err) {
        await db.exec('ROLLBACK');
        throw err;
      }

      res.json({ message: 'Budget saved' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
