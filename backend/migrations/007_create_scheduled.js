// Scheduled (recurring) transactions, as in HomeBank.
// Every `every` units (day/week/month/year) starting at next_date; anchor_day keeps
// e.g. "31st of the month" stable across short months. end_date is optional.
export const up = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income', 'transfer')),
      account_id INTEGER NOT NULL,
      target_account_id INTEGER,
      amount REAL NOT NULL CHECK(amount >= 0),
      target_amount REAL,
      payee TEXT,
      category_id INTEGER,
      payment_type INTEGER,
      memo TEXT,
      every INTEGER NOT NULL DEFAULT 1 CHECK(every >= 1),
      unit TEXT NOT NULL CHECK(unit IN ('day', 'week', 'month', 'year')),
      next_date TEXT NOT NULL,
      anchor_day INTEGER NOT NULL,
      end_date TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (target_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scheduled_next ON scheduled(next_date);
  `);
};

export const down = async (db) => {
  await db.exec(`DROP TABLE IF EXISTS scheduled;`);
};
