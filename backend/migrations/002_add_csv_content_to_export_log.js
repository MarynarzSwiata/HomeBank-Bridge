export const up = async (db) => {
  await db.exec(`
    ALTER TABLE export_log ADD COLUMN csv_content TEXT;
  `);
};

export const down = async (db) => {
  // SQLite doesn't support DROP COLUMN easily, but we can recreate or just leave it.
  // For simplicity in this POC, we'll just not revert.
};
