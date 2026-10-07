import db from '../db/index.js';
import { normalizeTags } from './tags.js';

const badRequest = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

/**
 * Insert an expense, income or transfer (two linked rows).
 * Shared by POST /api/transactions and posting of scheduled transactions.
 *
 * @param data { type, accountId, targetAccountId, amount (positive), date, payee, memo,
 *               categoryId, paymentType, targetAmount, status, tags }
 * @param options.useDbTransaction false when the caller already opened BEGIN/COMMIT
 * @returns { id } for single entries, { transferId } for transfers
 */
export async function createTransaction(data, { useDbTransaction = true } = {}) {
  const { type, accountId, targetAccountId, amount, date, payee, memo, categoryId, paymentType, targetAmount, status = 0 } = data;
  const tags = normalizeTags(data.tags);

  if (type === 'transfer') {
    if (!targetAccountId) {
      throw badRequest('Target account required for transfers');
    }
    if (Number(accountId) === Number(targetAccountId)) {
      throw badRequest('Cannot transfer to the same account');
    }

    // ATOMIC TRANSACTION for dual-record transfer
    if (useDbTransaction) await db.exec('BEGIN TRANSACTION');
    try {
      const uuid = `tr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const destination = await db.get('SELECT name FROM accounts WHERE id = ?', targetAccountId);
      const source = await db.get('SELECT name FROM accounts WHERE id = ?', accountId);

      const transferCategoryResult = await db.get("SELECT id FROM categories WHERE name='Internal Transfer' LIMIT 1");
      const transferCategoryId = transferCategoryResult?.id || null;

      await db.run(`
        INSERT INTO transactions (account_id, date, payee, amount, category_id, payment_type, transfer_id, memo, status, tags)
        VALUES (?, ?, ?, ?, ?, 4, ?, ?, ?, ?)
      `, accountId, date, `Transfer to ${destination?.name || 'Account'}`, -amount, transferCategoryId, uuid, memo || '', status, tags);

      await db.run(`
        INSERT INTO transactions (account_id, date, payee, amount, category_id, payment_type, transfer_id, memo, status, tags)
        VALUES (?, ?, ?, ?, ?, 4, ?, ?, ?, ?)
      `, targetAccountId, date, `Transfer from ${source?.name || 'Account'}`, targetAmount || amount, transferCategoryId, uuid, memo || '', status, tags);

      if (useDbTransaction) await db.exec('COMMIT');
      return { transferId: uuid };
    } catch (err) {
      if (useDbTransaction) await db.exec('ROLLBACK');
      throw err;
    }
  }

  // Single transaction
  const finalAmount = type === 'expense' ? -amount : amount;
  const result = await db.run(`
    INSERT INTO transactions (account_id, date, payee, amount, category_id, payment_type, memo, status, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, accountId, date, payee || '', finalAmount, categoryId || null, paymentType || 0, memo || '', status, tags);

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

  return { id: result.lastID };
}
