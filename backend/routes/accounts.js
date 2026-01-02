import express from 'express';
import { body, param } from 'express-validator';
import db from '../db/index.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

// GET /api/accounts - List all accounts with current balance
router.get('/', async (req, res, next) => {
  try {
    const accounts = await db.all(`
      SELECT 
        a.id,
        a.name,
        a.currency,
        a.initial_balance,
        a.initial_balance + IFNULL(SUM(t.amount), 0) as current_balance
      FROM accounts a
      LEFT JOIN transactions t ON a.id = t.account_id
      GROUP BY a.id
      ORDER BY a.name
    `);

    res.json(accounts);
  } catch (err) {
    next(err);
  }
});

// POST /api/accounts - Create new account
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Account name is required'),
    body('currency').trim().notEmpty().withMessage('Currency is required'),
    body('initialBalance').optional().isFloat().withMessage('Initial balance must be a number'),
    validate
  ],
  async (req, res, next) => {
    try {
      const { name, currency, initialBalance = 0 } = req.body;
      
      const result = await db.run(`
        INSERT INTO accounts (name, currency, initial_balance)
        VALUES (?, ?, ?)
      `, name, currency, initialBalance);

      res.status(201).json({ id: result.lastID });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/accounts/:id - Update account
router.put('/:id',
  [
    param('id').isInt().withMessage('Invalid account ID'),
    body('name').optional().trim().notEmpty(),
    body('currency').optional().trim().notEmpty(),
    body('initialBalance').optional().isFloat(),
    validate
  ],
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, currency, initialBalance } = req.body;

      const account = await db.get('SELECT id FROM accounts WHERE id = ?', id);
      if (!account) {
        const err = new Error('Account not found');
        err.status = 404;
        throw err;
      }

      const updates = [];
      const values = [];

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (currency !== undefined) {
        updates.push('currency = ?');
        values.push(currency);
      }
      if (initialBalance !== undefined) {
        updates.push('initial_balance = ?');
        values.push(initialBalance);
      }

      if (updates.length > 0) {
        values.push(id);
        await db.run(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`, ...values);
      }

      res.json({ message: 'Account updated successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/accounts/rename-currency - Bulk update currency code
router.post('/rename-currency',
  [
    body('oldCode').trim().notEmpty(),
    body('newCode').trim().notEmpty().isLength({ min: 2, max: 10 }),
    validate
  ],
  async (req, res, next) => {
    const { oldCode, newCode } = req.body;
    console.log(`💱 POST /api/accounts/rename-currency - Renaming ${oldCode} to ${newCode}`);
    try {

      await db.run('BEGIN TRANSACTION');
      
      // Update accounts
      await db.run('UPDATE accounts SET currency = ? WHERE currency = ?', newCode, oldCode);
      
      // Update linked transactions if any (not strictly needed if transactions don't store currency, 
      // but good for completeness if schema changes)
      
      await db.run('COMMIT');
      
      res.json({ message: `Currency ${oldCode} renamed to ${newCode} successfully` });
    } catch (err) {
      await db.run('ROLLBACK');
      next(err);
    }
  }
);

// DELETE /api/accounts/:id - Delete account
router.delete('/:id',
  [
    param('id').isInt().withMessage('Invalid account ID'),
    validate
  ],
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const account = await db.get('SELECT id FROM accounts WHERE id = ?', id);
      if (!account) {
        const err = new Error('Account not found');
        err.status = 404;
        throw err;
      }

      await db.run('DELETE FROM accounts WHERE id = ?', id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
