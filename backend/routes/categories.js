import express from 'express';
import { body, param } from 'express-validator';
import db from '../db/index.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

// GET /api/categories - Get hierarchical categories
router.get('/', async (req, res, next) => {
  try {
    const allCategories = await db.all(`
      SELECT 
        c.id, c.name, c.type, c.parent_id,
        (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) as usage_count,
        (SELECT SUM(amount) FROM transactions t WHERE t.category_id = c.id) as total_amount
      FROM categories c
      ORDER BY c.parent_id ASC, c.name ASC
    `);

    // Build hierarchy
    const categoryMap = new Map();
    const rootCategories = [];

    allCategories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    allCategories.forEach(cat => {
      const category = categoryMap.get(cat.id);
      if (cat.parent_id === null) {
        rootCategories.push(category);
      } else {
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          parent.children.push(category);
        } else {
          // Orphan categories go to root
          rootCategories.push(category);
        }
      }
    });

    res.json(rootCategories);
  } catch (err) {
    next(err);
  }
});

// POST /api/categories - Create category
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Category name is required'),
    body('type').isIn(['+', '-', ' ']).withMessage('Invalid category type'),
    body('parentId').optional().isInt(),
    validate
  ],
  async (req, res, next) => {
    try {
      const { name, type, parentId = null } = req.body;

      const result = await db.run(`
        INSERT INTO categories (name, type, parent_id)
        VALUES (?, ?, ?)
      `, name, type, parentId);

      res.status(201).json({ id: result.lastID });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/categories/:id - Update category
router.put('/:id',
  [
    param('id').isInt(),
    body('name').optional().trim().notEmpty(),
    body('type').optional().isIn(['+', '-', ' ']),
    body('parentId').optional(),
    validate
  ],
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, type, parentId } = req.body;

      const category = await db.get('SELECT id FROM categories WHERE id = ?', id);
      if (!category) {
        const err = new Error('Category not found');
        err.status = 404;
        throw err;
      }

      const updates = [];
      const values = [];

      if (name !== undefined) { updates.push('name = ?'); values.push(name); }
      if (type !== undefined) { updates.push('type = ?'); values.push(type); }
      if (parentId !== undefined) { updates.push('parent_id = ?'); values.push(parentId); }

      if (updates.length > 0) {
        values.push(id);
        await db.run(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`, ...values);
      }

      res.json({ message: 'Category updated successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/categories/:id - Delete category
router.delete('/:id',
  [
    param('id').isInt(),
    validate
  ],
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const category = await db.get('SELECT id FROM categories WHERE id = ?', id);
      if (!category) {
        const err = new Error('Category not found');
        err.status = 404;
        throw err;
      }

      // Update children to root level
      await db.run('UPDATE categories SET parent_id = NULL WHERE parent_id = ?', id);
      // Unassign from transactions
      await db.run('UPDATE transactions SET category_id = NULL WHERE category_id = ?', id);
      // Unassign from payees
      await db.run('UPDATE payees SET default_category_id = NULL WHERE default_category_id = ?', id);
      // Delete category
      await db.run('DELETE FROM categories WHERE id = ?', id);

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/categories/export - Export categories to CSV
router.get('/export', async (req, res, next) => {
  try {
    const allCategories = await db.all(`
      SELECT id, name, type, parent_id
      FROM categories
      ORDER BY name ASC
    `);

    // Build hierarchy for sorting
    const categoryMap = new Map();
    const roots = [];

    allCategories.forEach(cat => {
      // HomeBank expects type '+' (Income) or '-' (Expense)
      const cleanType = (cat.type === '+') ? '+' : '-';
      const node = { ...cat, type: cleanType, children: [] };
      categoryMap.set(cat.id, node);
    });

    allCategories.forEach(cat => {
      const node = categoryMap.get(cat.id);
      if (cat.parent_id === null) {
        roots.push(node);
      } else {
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      }
    });

    const csvLines = [];
    const traverse = (nodes, level) => {
      nodes.forEach(node => {
        csvLines.push(`${level};${node.type};${node.name}`);
        if (node.children.length > 0) {
          traverse(node.children, level + 1);
        }
      });
    };

    traverse(roots, 1);
    const csv = csvLines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=categories.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// POST /api/categories/import - Import categories from CSV
router.post('/import',
  express.text({ type: 'text/csv' }),
  async (req, res, next) => {
    try {
      const csvData = req.body;
      const lines = csvData.split('\n').filter(l => l.trim());

      let lastPId = null;

      for (const line of lines) {
        // Skip header
        if (line.toLowerCase().startsWith('level;')) continue;
        if (line.toLowerCase().startsWith('lvl;')) continue; // specific to user's file if needed

        const [level, type, name] = line.split(';').map(s => s.trim());

        if (level === '1') {
          const result = await db.run(`
            INSERT INTO categories (name, type, parent_id) VALUES (?, ?, NULL)
          `, name, type);

          lastPId = result.lastID;
        } else if (level === '2' && lastPId !== null) {
          await db.run(`
            INSERT INTO categories (name, type, parent_id) VALUES (?, ?, ?)
          `, name, type, lastPId);
        }
      }

      res.status(201).json({ message: 'Categories imported successfully', count: lines.length });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
