// Tags on transactions (space-separated, as in HomeBank CSV) and assignment rules.
export const up = async (db) => {
  await db.exec(`
    ALTER TABLE transactions ADD COLUMN tags TEXT NOT NULL DEFAULT '';

    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      field TEXT NOT NULL DEFAULT 'payee' CHECK(field IN ('payee', 'memo', 'any')),
      match_type TEXT NOT NULL DEFAULT 'contains' CHECK(match_type IN ('contains', 'exact')),
      pattern TEXT NOT NULL,
      category_id INTEGER,
      payment_type INTEGER,
      tags TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
  `);
};

export const down = async (db) => {
  await db.exec(`
    DROP TABLE IF EXISTS rules;
    ALTER TABLE transactions DROP COLUMN tags;
  `);
};
