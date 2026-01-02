export const up = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      currency TEXT NOT NULL,
      initial_balance REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('+', '-', ' ')),
      parent_id INTEGER,
      FOREIGN KEY (parent_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS payees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      default_category_id INTEGER,
      default_payment_type INTEGER,
      FOREIGN KEY (default_category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      payee TEXT,
      amount REAL NOT NULL,
      category_id INTEGER,
      payment_type INTEGER,
      memo TEXT,
      transfer_id TEXT,
      exported INTEGER DEFAULT 0,
      export_log_id INTEGER,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS export_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      filename TEXT NOT NULL,
      count INTEGER NOT NULL
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_transfer ON transactions(transfer_id);
  `);
};

export const down = async (db) => {
  await db.exec(`
    DROP TABLE IF EXISTS export_log;
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS payees;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS accounts;
  `);
};
