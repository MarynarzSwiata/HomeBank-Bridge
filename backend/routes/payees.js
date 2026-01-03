import express from 'express';
import { body, param } from 'express-validator';
import db from '../db/index.js';
import { validate } from '../middleware/validation.js';

const PAYMENT_LEXICON = {
    0: { name: "None" },
    1: { name: "Credit Card" },
    2: { name: "Check" },
    3: { name: "Cash" },
    4: { name: "Bank Transfer (Internal)" },
    6: { name: "Debit Card" },
    7: { name: "Standing Order" },
    8: { name: "Electronic Payment" },
    9: { name: "Deposit" },
    10: { name: "Fee" },
    11: { name: "Direct Debit" },
};

const router = express.Router();

// GET /api/payees - List all payees
router.get('/', async (req, res, next) => {
  try {
    const payees = await db.all(`
      SELECT 
        p.id,
        p.name,
        p.default_category_id,
        c.name as category_name,
        p.default_payment_type,
        (SELECT COUNT(*) FROM transactions t WHERE t.payee = p.name) as usage_count,
        (SELECT SUM(t.amount) FROM transactions t WHERE t.payee = p.name) as total_amount
      FROM payees p
      LEFT JOIN categories c ON p.default_category_id = c.id
      ORDER BY p.name ASC
    `);

    res.json(payees);
  } catch (err) {
    next(err);
  }
});

// POST /api/payees - Create payee
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Payee name is required'),
    body('defaultCategoryId').optional().isInt(),
    body('defaultPaymentType').optional().isInt(),
    validate
  ],
  async (req, res, next) => {
    try {
      const { name, defaultCategoryId = null, defaultPaymentType = null } = req.body;

      const result = await db.run(`
        INSERT INTO payees (name, default_category_id, default_payment_type)
        VALUES (?, ?, ?)
      `, name, defaultCategoryId, defaultPaymentType);

      res.status(201).json({ id: result.lastID });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/payees/:id - Update payee
router.put('/:id',
  [
    param('id').isInt(),
    body('name').optional().trim().notEmpty(),
    body('defaultCategoryId').optional(),
    body('defaultPaymentType').optional(),
    validate
  ],
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, defaultCategoryId, defaultPaymentType } = req.body;

      const payee = await db.get('SELECT id FROM payees WHERE id = ?', id);
      if (!payee) {
        const err = new Error('Payee not found');
        err.status = 404;
        throw err;
      }

      const updates = [];
      const values = [];

      if (name !== undefined) { updates.push('name = ?'); values.push(name); }
      if (defaultCategoryId !== undefined) { updates.push('default_category_id = ?'); values.push(defaultCategoryId); }
      if (defaultPaymentType !== undefined) { updates.push('default_payment_type = ?'); values.push(defaultPaymentType); }

      if (updates.length > 0) {
        values.push(id);
        await db.run(`UPDATE payees SET ${updates.join(', ')} WHERE id = ?`, ...values);
      }

      res.json({ message: 'Payee updated successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/payees/:id - Delete payee
router.delete('/:id',
  [
    param('id').isInt(),
    validate
  ],
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const payee = await db.get('SELECT id FROM payees WHERE id = ?', id);
      if (!payee) {
        const err = new Error('Payee not found');
        err.status = 404;
        throw err;
      }

      await db.run('DELETE FROM payees WHERE id = ?', id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/payees/export - Export payees to CSV
router.get('/export', async (req, res, next) => {
  try {
    const payees = await db.all(`
      SELECT 
        p.name,
        c.name as category_name,
        pc.name as parent_category_name
      FROM payees p
      LEFT JOIN categories c ON p.default_category_id = c.id
      LEFT JOIN categories pc ON c.parent_id = pc.id
      ORDER BY p.name
    `);

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvLines = payees.map(p => {
      const fullCategory = p.parent_category_name 
        ? `${p.parent_category_name}:${p.category_name}` 
        : (p.category_name || '');
      
      const paymentMode = p.default_payment_type !== null ? PAYMENT_LEXICON[p.default_payment_type]?.name || '' : '';
      
      return `${escapeCSV(p.name)};${escapeCSV(fullCategory)};${escapeCSV(paymentMode)}`;
    });

    const csv = csvLines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payees.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// POST /api/payees/import - Import payees from CSV
router.post('/import',
  express.json(),
  async (req, res, next) => {
    try {
      const { csvData, skipDuplicates } = req.body;
      if (!csvData) return res.status(400).json({ error: 'No CSV data provided' });

      const lines = csvData.split('\n').filter(l => l.trim());
      let importedCount = 0;

      for (const line of lines) {
        // Skip header
        if (line.toLowerCase().startsWith('name;') || line.toLowerCase().startsWith('payee;')) continue;

        const [name, categoryName, payModeName] = line.split(';').map(s => s.trim());
        if (!name) continue;

        let categoryId = null;
        if (categoryName) {
          // Handle hierarchical categories (e.g. "Main:Sub")
          const parts = categoryName.split(':').map(s => s.trim());
          let parentId = null;
          for (const part of parts) {
            let cat = await db.get('SELECT id FROM categories WHERE name = ? AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))', part, parentId, parentId);
            if (!cat) {
              const res = await db.run('INSERT INTO categories (name, parent_id, type) VALUES (?, ?, ?)', part, parentId, '-');
              cat = { id: res.lastID };
            }
            parentId = cat.id;
          }
          categoryId = parentId;
        }

        let paymentType = null;
        if (payModeName) {
            const entry = Object.entries(PAYMENT_LEXICON).find(([_, val]) => val.name.toLowerCase() === payModeName.toLowerCase());
            if (entry) paymentType = parseInt(entry[0]);
        }

        const existing = await db.get('SELECT id FROM payees WHERE name = ?', name);
        if (existing) {
          if (skipDuplicates) {
            continue; // Skip it
          }
          await db.run(`
            UPDATE payees SET default_category_id = ?, default_payment_type = ? WHERE name = ?
          `, categoryId, paymentType, name);
        } else {
          await db.run(`
            INSERT INTO payees (name, default_category_id, default_payment_type)
            VALUES (?, ?, ?)
          `, name, categoryId, paymentType);
        }
        importedCount++;
      }

      res.status(201).json({ message: 'Payees imported successfully', count: importedCount });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/payees/import-check - Check for duplicate payee names
router.post('/import-check', async (req, res, next) => {
  try {
    const { candidates } = req.body; // Array of { name }
    if (!Array.isArray(candidates)) {
      return res.status(400).json({ error: 'Invalid candidates list' });
    }

    const duplicates = [];
    for (const entry of candidates) {
      const existing = await db.get('SELECT id FROM payees WHERE name = ?', entry.name);
      if (existing) {
        duplicates.push(entry);
      }
    }

    res.json({ duplicates });
  } catch (err) {
    next(err);
  }
});

export default router;
