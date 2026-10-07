// HomeBank-like account types, closed accounts and transaction status.
// status: 0 = none, 1 = cleared, 2 = reconciled (same meaning as in HomeBank)
export const up = async (db) => {
  await db.exec(`
    ALTER TABLE accounts ADD COLUMN type TEXT NOT NULL DEFAULT 'bank';
    ALTER TABLE accounts ADD COLUMN closed INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE transactions ADD COLUMN status INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
  `);
};

export const down = async (db) => {
  await db.exec(`
    DROP INDEX IF EXISTS idx_transactions_status;
    ALTER TABLE transactions DROP COLUMN status;
    ALTER TABLE accounts DROP COLUMN closed;
    ALTER TABLE accounts DROP COLUMN type;
  `);
};
