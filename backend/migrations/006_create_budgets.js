// Monthly budget per category, as in HomeBank.
// month = 0 means "same amount every month"; 1-12 override a specific month.
// amount is always positive: planned spending (expense categories) or planned income (income categories).
export const up = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
      category_id INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK(month BETWEEN 0 AND 12),
      amount REAL NOT NULL CHECK(amount >= 0),
      PRIMARY KEY (category_id, month),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );
  `);
};

export const down = async (db) => {
  await db.exec(`DROP TABLE IF EXISTS budgets;`);
};
