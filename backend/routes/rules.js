import express from 'express';
import { body, param } from 'express-validator';
import db from '../db/index.js';
import { validate } from '../middleware/validation.js';
import { normalizeTags, mergeTags } from '../services/tags.js';
import { loadRules, findRule } from '../services/rules.js';

const router = express.Router();

const ruleValidators = [
  body('field').isIn(['payee', 'memo', 'any']).withMessage('Invalid field'),
  body('matchType').isIn(['contains', 'exact']).withMessage('Invalid match type'),
  body('pattern').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Text to match is required'),
  body('categoryId').optional({ nullable: true }).isInt(),
  body('paymentType').optional({ nullable: true }).isInt(),
  body('tags').optional({ nullable: true }).isString().isLength({ max: 1000 }),
  body('position').optional().isInt({ min: 0, max: 100000 }),
  validate
];

// A rule must change something, otherwise it is pointless
const checkEffect = (b) =>
  b.categoryId || b.paymentType || normalizeTags(b.tags) ? null : 'Choose a category, payment type or tags to assign';

const values = (b) => [
  b.field,
  b.matchType,
  b.pattern.trim(),
  b.categoryId || null,
  b.paymentType || null,
  normalizeTags(b.tags),
  b.position ?? 0,
];

// GET /api/rules
router.get('/', async (req, res, next) => {
  try {
    const rules = await db.all(`
      SELECT r.*, c.name AS category_name, pc.name AS parent_category_name
      FROM rules r
      LEFT JOIN categories c ON c.id = r.category_id
      LEFT JOIN categories pc ON pc.id = c.parent_id
      ORDER BY r.position, r.id
    `);
    res.json(rules);
  } catch (err) {
    next(err);
  }
});

// POST /api/rules
router.post('/', ruleValidators, async (req, res, next) => {
  try {
    const problem = checkEffect(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const result = await db.run(
      'INSERT INTO rules (field, match_type, pattern, category_id, payment_type, tags, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ...values(req.body)
    );
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    next(err);
  }
});

// PUT /api/rules/:id
router.put('/:id', [param('id').isInt(), ...ruleValidators], async (req, res, next) => {
  try {
    const problem = checkEffect(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const result = await db.run(
      'UPDATE rules SET field = ?, match_type = ?, pattern = ?, category_id = ?, payment_type = ?, tags = ?, position = ? WHERE id = ?',
      ...values(req.body), req.params.id
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ message: 'Rule updated' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/rules/:id
router.delete('/:id', [param('id').isInt(), validate], async (req, res, next) => {
  try {
    const result = await db.run('DELETE FROM rules WHERE id = ?', req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Rule not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/rules/apply - Apply rules to existing transactions without a category (transfers excluded).
// Body: { dryRun?: boolean } - dryRun only counts what would change.
router.post('/apply', [body('dryRun').optional().isBoolean(), validate], async (req, res, next) => {
  try {
    const dryRun = req.body.dryRun === true;
    const rules = await loadRules();
    const candidates = await db.all(
      'SELECT id, payee, memo, payment_type, tags FROM transactions WHERE category_id IS NULL AND transfer_id IS NULL'
    );
    const changes = [];
    for (const t of candidates) {
      const rule = findRule(rules, t);
      if (!rule) continue;
      changes.push({
        id: t.id,
        categoryId: rule.category_id || null,
        paymentType: !t.payment_type && rule.payment_type ? rule.payment_type : t.payment_type,
        tags: mergeTags(t.tags, rule.tags),
      });
    }
    if (!dryRun && changes.length > 0) {
      await db.exec('BEGIN TRANSACTION');
      try {
        for (const c of changes) {
          await db.run('UPDATE transactions SET category_id = ?, payment_type = ?, tags = ? WHERE id = ?', c.categoryId, c.paymentType, c.tags, c.id);
        }
        await db.exec('COMMIT');
      } catch (err) {
        await db.exec('ROLLBACK');
        throw err;
      }
    }
    res.json({ matched: changes.length, updated: dryRun ? 0 : changes.length });
  } catch (err) {
    next(err);
  }
});

export default router;
