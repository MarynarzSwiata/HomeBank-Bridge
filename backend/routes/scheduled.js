import express from 'express';
import { body, param } from 'express-validator';
import db from '../db/index.js';
import { validate } from '../middleware/validation.js';
import { createTransaction } from '../services/transactionWriter.js';

const router = express.Router();

const MAX_POSTS_PER_ITEM = 400; // safety cap when catching up on many missed occurrences

const daysInMonth = (year, month0) => new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
const toISO = (d) => d.toISOString().slice(0, 10);

/** Next occurrence after `iso` (YYYY-MM-DD). Month/year steps keep the anchor day, clamped to month length. */
export function advanceDate(iso, every, unit, anchorDay) {
  const [y, m, d] = iso.split('-').map(Number);
  if (unit === 'day' || unit === 'week') {
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + every * (unit === 'week' ? 7 : 1));
    return toISO(date);
  }
  const totalMonths = (m - 1) + every * (unit === 'year' ? 12 : 1);
  const year = y + Math.floor(totalMonths / 12);
  const month0 = totalMonths % 12;
  const day = Math.min(anchorDay, daysInMonth(year, month0));
  return toISO(new Date(Date.UTC(year, month0, day)));
}

const isFinished = (row) => !!row.end_date && row.next_date > row.end_date;

const scheduledValidators = [
  body('type').isIn(['expense', 'income', 'transfer']).withMessage('Invalid type'),
  body('accountId').isInt().withMessage('Account is required'),
  body('targetAccountId').optional({ nullable: true }).isInt(),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('targetAmount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('payee').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('categoryId').optional({ nullable: true }).isInt(),
  body('paymentType').optional({ nullable: true }).isInt(),
  body('memo').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('every').isInt({ min: 1, max: 366 }).withMessage('Repeat interval must be 1-366'),
  body('unit').isIn(['day', 'week', 'month', 'year']).withMessage('Invalid unit'),
  body('nextDate').isISO8601({ strict: true }).withMessage('Invalid next date'),
  body('endDate').optional({ nullable: true, checkFalsy: true }).isISO8601({ strict: true }).withMessage('Invalid end date'),
  validate
];

const checkTransfer = (b) => {
  if (b.type !== 'transfer') return null;
  if (!b.targetAccountId) return 'Target account required for transfers';
  if (Number(b.targetAccountId) === Number(b.accountId)) return 'Cannot transfer to the same account';
  return null;
};

const rowValues = (b) => {
  const nextDate = b.nextDate.slice(0, 10);
  return [
    b.type,
    b.accountId,
    b.type === 'transfer' ? b.targetAccountId : null,
    b.amount,
    b.type === 'transfer' ? (b.targetAmount || null) : null,
    b.type === 'transfer' ? '' : (b.payee || ''),
    b.type === 'transfer' ? null : (b.categoryId || null),
    b.paymentType || 0,
    b.memo || '',
    b.every,
    b.unit,
    nextDate,
    Number(nextDate.slice(8, 10)),
    b.endDate ? b.endDate.slice(0, 10) : null,
  ];
};

// GET /api/scheduled - All scheduled items, soonest first
router.get('/', async (req, res, next) => {
  try {
    const rows = await db.all(`
      SELECT s.*, a.name AS account_name, a.currency AS currency,
             ta.name AS target_account_name, c.name AS category_name
      FROM scheduled s
      LEFT JOIN accounts a ON a.id = s.account_id
      LEFT JOIN accounts ta ON ta.id = s.target_account_id
      LEFT JOIN categories c ON c.id = s.category_id
      ORDER BY s.next_date, s.id
    `);
    res.json(rows.map(r => ({ ...r, finished: isFinished(r) })));
  } catch (err) {
    next(err);
  }
});

// POST /api/scheduled - Create
router.post('/', scheduledValidators, async (req, res, next) => {
  try {
    const problem = checkTransfer(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const result = await db.run(`
      INSERT INTO scheduled (type, account_id, target_account_id, amount, target_amount, payee, category_id,
                             payment_type, memo, every, unit, next_date, anchor_day, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ...rowValues(req.body));
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    next(err);
  }
});

// PUT /api/scheduled/:id - Replace
router.put('/:id', [param('id').isInt(), ...scheduledValidators], async (req, res, next) => {
  try {
    const problem = checkTransfer(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const result = await db.run(`
      UPDATE scheduled SET type = ?, account_id = ?, target_account_id = ?, amount = ?, target_amount = ?, payee = ?,
        category_id = ?, payment_type = ?, memo = ?, every = ?, unit = ?, next_date = ?, anchor_day = ?, end_date = ?
      WHERE id = ?
    `, ...rowValues(req.body), req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Scheduled transaction not found' });
    res.json({ message: 'Scheduled transaction updated' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/scheduled/:id
router.delete('/:id', [param('id').isInt(), validate], async (req, res, next) => {
  try {
    const result = await db.run('DELETE FROM scheduled WHERE id = ?', req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Scheduled transaction not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const postOccurrence = (row) => createTransaction({
  type: row.type,
  accountId: row.account_id,
  targetAccountId: row.target_account_id,
  amount: row.amount,
  targetAmount: row.target_amount,
  date: row.next_date,
  payee: row.payee,
  memo: row.memo,
  categoryId: row.category_id,
  paymentType: row.payment_type,
}, { useDbTransaction: false });

/**
 * Post (count = 'one') or skip the next occurrence, or post every occurrence up to `until`.
 * Inserting the transaction and moving next_date happen in one DB transaction,
 * so an occurrence is never posted twice.
 */
async function processItem(id, { post, until }) {
  const row = await db.get('SELECT * FROM scheduled WHERE id = ?', id);
  if (!row) {
    const err = new Error('Scheduled transaction not found');
    err.status = 404;
    throw err;
  }
  if (isFinished(row)) {
    const err = new Error('This schedule has ended');
    err.status = 400;
    throw err;
  }
  let posted = 0;
  await db.exec('BEGIN TRANSACTION');
  try {
    do {
      if (post) {
        await postOccurrence(row);
        posted += 1;
      }
      row.next_date = advanceDate(row.next_date, row.every, row.unit, row.anchor_day);
    } while (until && row.next_date <= until && !isFinished(row) && posted < MAX_POSTS_PER_ITEM);
    await db.run('UPDATE scheduled SET next_date = ? WHERE id = ?', row.next_date, id);
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
  return { posted, nextDate: row.next_date, finished: isFinished(row) };
}

const sendError = (res, next, err) => {
  if (err.status === 400 || err.status === 404) return res.status(err.status).json({ error: err.message });
  next(err);
};

// POST /api/scheduled/:id/post - Create the next occurrence as a real transaction
router.post('/:id/post', [param('id').isInt(), validate], async (req, res, next) => {
  try {
    res.json(await processItem(req.params.id, { post: true }));
  } catch (err) {
    sendError(res, next, err);
  }
});

// POST /api/scheduled/:id/skip - Move to the next occurrence without posting
router.post('/:id/skip', [param('id').isInt(), validate], async (req, res, next) => {
  try {
    res.json(await processItem(req.params.id, { post: false }));
  } catch (err) {
    sendError(res, next, err);
  }
});

/** Number of occurrences dated up to `until` that post-due would create for one item */
function countDue(row, until) {
  let count = 0;
  let next = row.next_date;
  while (next <= until && !(row.end_date && next > row.end_date) && count < MAX_POSTS_PER_ITEM) {
    count += 1;
    next = advanceDate(next, row.every, row.unit, row.anchor_day);
  }
  return count;
}

// POST /api/scheduled/post-due - Post every occurrence dated up to `until` (the client's "today").
// With dryRun: true nothing is written; returns how many transactions would be created.
router.post('/post-due',
  [body('until').isISO8601({ strict: true }).withMessage('Invalid date'), body('dryRun').optional().isBoolean(), validate],
  async (req, res, next) => {
    try {
      const until = req.body.until.slice(0, 10);
      const due = await db.all('SELECT * FROM scheduled WHERE next_date <= ? ORDER BY next_date, id', until);
      if (req.body.dryRun === true) {
        return res.json({ wouldPost: due.reduce((sum, row) => sum + countDue(row, until), 0), items: due.length });
      }
      let posted = 0;
      for (const row of due) {
        if (isFinished(row)) continue;
        posted += (await processItem(row.id, { post: true, until })).posted;
      }
      res.json({ posted });
    } catch (err) {
      sendError(res, next, err);
    }
  }
);

export default router;
