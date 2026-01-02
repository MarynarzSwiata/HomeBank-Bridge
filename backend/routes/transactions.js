import express from 'express';
import { body, param, query } from 'express-validator';
import db from '../db/index.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

// GET /api/transactions - List transactions with filters
router.get('/', 
  [
    query('accountId').optional().isInt(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    validate
  ],
  async (req, res, next) => {
    try {
      const { accountId, from, to } = req.query;

      let sql = `
        SELECT 
          t.id,
          t.date,
          t.payee,
          t.amount,
          c.name as category_name,
          a.name as account_name,
          t.payment_type,
          t.memo,
          t.category_id,
          t.account_id,
          t.transfer_id,
          t.exported,
          t.export_log_id
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE 1=1
      `;

      const params = [];

      if (accountId) {
        sql += ' AND t.account_id = ?';
        params.push(accountId);
      }
      if (from) {
        sql += ' AND t.date >= ?';
        params.push(from);
      }
      if (to) {
        sql += ' AND t.date <= ?';
        params.push(to);
      }

      sql += ' ORDER BY t.date DESC, t.id DESC';

      const transactions = await db.all(sql, ...params);
      res.json(transactions);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/transactions - Create transaction (supports transfers)
router.post('/',
  [
    body('type').isIn(['expense', 'income', 'transfer']).withMessage('Invalid transaction type'),
    body('accountId').isInt().withMessage('Account ID is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('date').isISO8601().withMessage('Invalid date format'),
    body('payee').optional().trim(),
    body('memo').optional().trim(),
    body('categoryId').optional().isInt(),
    body('paymentType').optional().isInt(),
    body('targetAccountId').optional().isInt(),
    body('targetAmount').optional().isFloat({ min: 0 }),
    validate
  ],
  async (req, res, next) => {
    try {
      const { type, accountId, targetAccountId, amount, date, payee, memo, categoryId, paymentType, targetAmount } = req.body;

      if (type === 'transfer') {
        if (!targetAccountId) {
          return res.status(400).json({ error: 'Target account required for transfers' });
        }
        if (accountId === targetAccountId) {
          return res.status(400).json({ error: 'Cannot transfer to the same account' });
        }

        // ATOMIC TRANSACTION for dual-record transfer
        await db.exec('BEGIN TRANSACTION');
        try {
          const uuid = `tr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const sourceAccount = await db.get('SELECT name FROM accounts WHERE id = ?', targetAccountId);
          const targetAccount = await db.get('SELECT name FROM accounts WHERE id = ?', accountId);

          const transferCategoryResult = await db.get("SELECT id FROM categories WHERE name='Internal Transfer' LIMIT 1");
          const transferCategoryId = transferCategoryResult?.id || null;

          await db.run(`
            INSERT INTO transactions (account_id, date, payee, amount, category_id, payment_type, transfer_id, memo)
            VALUES (?, ?, ?, ?, ?, 4, ?, ?)
          `, accountId, date, `Transfer to ${sourceAccount?.name || 'Account'}`, -amount, transferCategoryId, uuid, memo || '');

          await db.run(`
            INSERT INTO transactions (account_id, date, payee, amount, category_id, payment_type, transfer_id, memo)
            VALUES (?, ?, ?, ?, ?, 4, ?, ?)
          `, targetAccountId, date, `Transfer from ${targetAccount?.name || 'Account'}`, targetAmount || amount, transferCategoryId, uuid, memo || '');

          await db.exec('COMMIT');

          res.status(201).json({ message: 'Transfer created', transferId: uuid });
        } catch (err) {
          await db.exec('ROLLBACK');
          throw err;
        }
      } else {
        // Single transaction
        const finalAmount = type === 'expense' ? -amount : amount;
        const result = await db.run(`
          INSERT INTO transactions (account_id, date, payee, amount, category_id, payment_type, memo)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, accountId, date, payee || '', finalAmount, categoryId || null, paymentType || 0, memo || '');

        // Auto-create/update payee if provided
        if (payee && categoryId) {
          const existingPayee = await db.get('SELECT id FROM payees WHERE name = ?', payee);
          if (existingPayee) {
            await db.run(`
              UPDATE payees SET default_category_id = ?, default_payment_type = ?
              WHERE name = ?
            `, categoryId, paymentType || null, payee);
          } else {
            await db.run(`
              INSERT INTO payees (name, default_category_id, default_payment_type)
              VALUES (?, ?, ?)
            `, payee, categoryId, paymentType || null);
          }
        }

        res.status(201).json({ id: result.lastID });
      }
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/transactions/:id - Update transaction
router.put('/:id',
  [
    param('id').isInt(),
    body('date').optional().isISO8601(),
    body('payee').optional().trim(),
    body('amount').optional().isFloat(),
    body('categoryId').optional().isInt(),
    body('paymentType').optional().isInt(),
    body('memo').optional().trim(),
    body('accountId').optional().isInt(),
    validate
  ],
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { date, payee, amount, categoryId, paymentType, memo, accountId, targetAccountId, targetAmount } = req.body;

      const transaction = await db.get('SELECT * FROM transactions WHERE id = ?', id);
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // If it's a transfer, handle atomic update of both sides
      if (transaction.transfer_id) {
        const otherTransaction = await db.get(
          'SELECT * FROM transactions WHERE transfer_id = ? AND id != ?',
          transaction.transfer_id, id
        );

        if (otherTransaction) {
          // Identify which side we are updating. Usually id is the expense/source
          // but we follow what the form says.
          
          // Update primary record
          const pUpdates = [];
          const pValues = [];
          
          if (date !== undefined) { pUpdates.push('date = ?'); pValues.push(date); }
          if (memo !== undefined) { pUpdates.push('memo = ?'); pValues.push(memo); }
          if (accountId !== undefined) { pUpdates.push('account_id = ?'); pValues.push(accountId); }
          if (amount !== undefined) { 
            pUpdates.push('amount = ?'); 
            // In transfers, the source is negative
            pValues.push(-Math.abs(amount)); 
          }

          if (pUpdates.length > 0) {
            pValues.push(id);
            await db.run(`UPDATE transactions SET ${pUpdates.join(', ')} WHERE id = ?`, ...pValues);
          }

          // Update secondary record
          const sUpdates = [];
          const sValues = [];
          if (date !== undefined) { sUpdates.push('date = ?'); sValues.push(date); }
          if (memo !== undefined) { sUpdates.push('memo = ?'); sValues.push(memo); }
          if (targetAccountId !== undefined) { sUpdates.push('account_id = ?'); sValues.push(targetAccountId); }
          
          if (targetAmount !== undefined || amount !== undefined) {
             sUpdates.push('amount = ?');
             sValues.push(Math.abs(targetAmount !== undefined ? targetAmount : amount));
          }

          if (sUpdates.length > 0) {
            sValues.push(otherTransaction.id);
            await db.run(`UPDATE transactions SET ${sUpdates.join(', ')} WHERE id = ?`, ...sValues);
          }

          return res.json({ message: 'Transfer updated successfully' });
        }
      }

      const updates = [];
      const values = [];

      if (date !== undefined) { updates.push('date = ?'); values.push(date); }
      if (payee !== undefined) { updates.push('payee = ?'); values.push(payee); }
      if (amount !== undefined) { updates.push('amount = ?'); values.push(amount); }
      if (categoryId !== undefined) { updates.push('category_id = ?'); values.push(categoryId); }
      if (paymentType !== undefined) { updates.push('payment_type = ?'); values.push(paymentType); }
      if (memo !== undefined) { updates.push('memo = ?'); values.push(memo); }
      if (accountId !== undefined) { updates.push('account_id = ?'); values.push(accountId); }

      if (updates.length > 0) {
        values.push(id);
        await db.run(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`, ...values);
      }

      res.json({ message: 'Transaction updated successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/transactions/:id - Delete transaction
router.delete('/:id',
  [
    param('id').isInt(),
    validate
  ],
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const transaction = await db.get('SELECT id FROM transactions WHERE id = ?', id);
      if (!transaction) {
        const err = new Error('Transaction not found');
        err.status = 404;
        throw err;
      }

      await db.run('DELETE FROM transactions WHERE id = ?', id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/transactions/import-check - Check for potential duplicates
router.post('/import-check', async (req, res, next) => {
  try {
    const { candidates } = req.body; // Array of { date, payee, amount }
    if (!Array.isArray(candidates)) {
      return res.status(400).json({ error: 'Invalid candidates list' });
    }

    const duplicates = [];
    for (const entry of candidates) {
      const existing = await db.get(`
        SELECT id, date, payee, amount, memo 
        FROM transactions 
        WHERE date = ? AND payee = ? AND ABS(amount - ?) < 0.001
        LIMIT 1
      `, entry.date, entry.payee, entry.amount);
      
      if (existing) {
        duplicates.push(entry);
      }
    }

    res.json({ duplicates });
  } catch (err) {
    next(err);
  }
});

// POST /api/transactions/import - Import transactions from CSV
router.post('/import',
  express.json(),
  async (req, res, next) => {
    try {
      const { csvData, accountId, skipDuplicates, dateFormat } = req.body;
      if (!csvData) return res.status(400).json({ error: 'No CSV data provided' });
      if (!accountId) return res.status(400).json({ error: 'No account ID provided' });

      const lines = csvData.split(/\r?\n/).filter(l => l.trim());
      let importedCount = 0;

      const targetAcc = await db.get('SELECT id FROM accounts WHERE id = ?', accountId);
      if (!targetAcc) {
        return res.status(404).json({ error: 'Target account not found' });
      }

      await db.exec('BEGIN TRANSACTION');
      try {
        for (const line of lines) {
          // Skip header if present
          if (line.toLowerCase().startsWith('date;') || line.toLowerCase().startsWith('data;')) continue;

          // Expected HomeBank CSV: date;payMode;info;payee;memo;amount;category;tags
          const parts = line.split(';');
          if (parts.length < 5) continue;

          const [dateStr, payType, num, payee, memo, amountStr, catName] = parts.map(s => s.trim());
          
          // Improved Date Parsing with dynamic format support
          let date = dateStr;
          const cleanDate = dateStr.replace(/\./g, '-');
          const dparts = cleanDate.split('-');
          
          if (dparts.length === 3) {
            // Try to guess or use provided format
            if (dparts[0].length === 4) { // YYYY-MM-DD
                date = `${dparts[0]}-${dparts[1].padStart(2, '0')}-${dparts[2].padStart(2, '0')}`;
            } else if (dparts[2].length === 4) { // DD-MM-YYYY or MM-DD-YYYY
                if (dateFormat === 'MM-DD-YYYY') {
                    date = `${dparts[2]}-${dparts[0].padStart(2, '0')}-${dparts[1].padStart(2, '0')}`;
                } else {
                    date = `${dparts[2]}-${dparts[1].padStart(2, '0')}-${dparts[0].padStart(2, '0')}`;
                }
            }
          }

          // Robust amount parsing
          let amount = parseFloat(amountStr?.replace(',', '.') || '0');
          if (isNaN(amount)) continue;

          if (skipDuplicates) {
            const existing = await db.get(`
                SELECT id FROM transactions 
                WHERE date = ? AND payee = ? AND ABS(amount - ?) < 0.001
                LIMIT 1
            `, date, payee, amount);
            if (existing) continue;
          }

          // Resolve Category ID Hierarchically
          let categoryId = null;
          if (catName) {
            const catParts = catName.split(':').map(p => p.trim()).filter(Boolean);
            let parentId = null;
            
            for (const name of catParts) {
              let category = await db.get(
                'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL)) LIMIT 1',
                name, parentId, parentId
              );
              
              if (!category) {
                // Determine type based on amount
                const type = amount < 0 ? '-' : '+';
                const result = await db.run(
                  'INSERT INTO categories (name, type, parent_id) VALUES (?, ?, ?)',
                  name, type, parentId
                );
                categoryId = result.lastID;
              } else {
                categoryId = category.id;
              }
              parentId = categoryId;
            }
          }

          // Resolve Payment Type
          const paymentType = parseInt(payType) || 0;

          await db.run(`
            INSERT INTO transactions (date, payee, amount, category_id, payment_type, memo, account_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, date, payee, amount, categoryId, paymentType, memo, targetAcc.id); 
          
          importedCount++;
        }

        await db.exec('COMMIT');
        res.status(201).json({ message: 'Transactions imported successfully', count: importedCount });
      } catch (err) {
        await db.exec('ROLLBACK');
        console.error('Import Error Trace:', err);
        throw err;
      }
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/transactions/export - Export transactions to CSV with filters and selection
router.post('/export',
  [
    body('ids').optional().isArray(),
    body('accountId').optional().isInt(),
    body('from').optional().isISO8601(),
    body('to').optional().isISO8601(),
    body('categoryId').optional().isInt(),
    body('payee').optional().trim(),
    body('grouped').optional().isBoolean(),
    body('dateFormat').optional().isString(),
    body('decimalSeparator').optional().isString(),
    validate
  ],
  async (req, res, next) => {
    try {
      const { ids, accountId, from, to, categoryId, payee, grouped, dateFormat, decimalSeparator } = req.body;

      let sql = `
        SELECT 
          t.date,
          t.payment_type,
          t.payee,
          t.memo,
          t.amount,
          t.account_id,
          a.name as account_name,
          c.name as category_name,
          pc.name as parent_category_name
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN categories pc ON c.parent_id = pc.id
        WHERE 1=1
      `;

      const params = [];

      if (ids && ids.length > 0) {
        sql += ` AND t.id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
      if (accountId) {
        sql += ' AND t.account_id = ?';
        params.push(accountId);
      }
      if (from) {
        sql += ' AND t.date >= ?';
        params.push(from);
      }
      if (to) {
        sql += ' AND t.date <= ?';
        params.push(to);
      }
      if (categoryId) {
        sql += ' AND (t.category_id = ? OR c.parent_id = ?)';
        params.push(categoryId, categoryId);
      }
      if (payee) {
        sql += ' AND LOWER(t.payee) LIKE LOWER(?)';
        params.push(`%${payee}%`);
      }

      sql += ' ORDER BY a.name ASC, t.date DESC, t.id DESC';

      const transactions = await db.all(sql, ...params);

      const dSep = decimalSeparator || ',';
      const dFormat = dateFormat || 'DD-MM-YYYY';

      // --- CSV Generation ---
      const escapeCSV = (val) => {
        if (val === null || val === undefined) return '';
        const s = String(val);
        if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const formatRow = (t) => {
        // Date;Payment;Number;Payee;Memo;Amount;Category;Tags
        
        // 1. Date
        let dateFormatted = t.date || '';
        if (t.date && t.date.includes('-')) {
            const dateOnly = t.date.substring(0, 10);
            const [y, m, d] = dateOnly.split('-');
            if (dFormat === 'DD-MM-YYYY') dateFormatted = `${d}-${m}-${y}`;
            else if (dFormat === 'MM-DD-YYYY') dateFormatted = `${m}-${d}-${y}`;
            else if (dFormat === 'YYYY-MM-DD') dateFormatted = `${y}-${m}-${d}`;
            else dateFormatted = `${d}-${m}-${y}`;
        }

        // 2. Payment
        const paymentType = t.payment_type || 0;

        // 3. Number (Empty placeholder)
        const number = '';

        // 4. Payee
        const payeeVal = escapeCSV(t.payee);

        // 5. Memo
        const memoVal = escapeCSV(t.memo);

        // 6. Amount (Custom decimal separator)
        const amountVal = (t.amount || 0).toFixed(2).replace('.', dSep);

        // 7. Category (Parent:Child)
        const fullCategory = t.parent_category_name 
            ? `${t.parent_category_name}:${t.category_name}` 
            : (t.category_name || '');
        const categoryVal = escapeCSV(fullCategory);

        // 8. Tags
        const tags = '';

        return `${dateFormatted};${paymentType};${number};${payeeVal};${memoVal};${amountVal};${categoryVal};${tags}`;
      };

      if (grouped) {
        const groups = {};
        transactions.forEach(t => {
          if (!groups[t.account_id]) {
            groups[t.account_id] = {
              name: t.account_name,
              rows: []
            };
          }
          groups[t.account_id].rows.push(formatRow(t));
        });

        const result = {};
        Object.entries(groups).forEach(([id, data]) => {
          result[id] = {
            name: data.name,
            csv: data.rows.join('\r\n'),
            count: data.rows.length
          };
        });

        return res.json(result);
      }

      const csvContent = transactions.map(formatRow).join('\r\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
      res.send(csvContent);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
