// Templates (HomeBank "favourites"): a scheduled row with is_scheduled = 0 is a plain template
// used to pre-fill new entries; is_scheduled = 1 keeps the recurring behaviour.
export const up = async (db) => {
  await db.exec(`
    ALTER TABLE scheduled ADD COLUMN is_scheduled INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE scheduled ADD COLUMN name TEXT NOT NULL DEFAULT '';
    ALTER TABLE scheduled ADD COLUMN tags TEXT NOT NULL DEFAULT '';
  `);
};

export const down = async (db) => {
  await db.exec(`
    ALTER TABLE scheduled DROP COLUMN tags;
    ALTER TABLE scheduled DROP COLUMN name;
    ALTER TABLE scheduled DROP COLUMN is_scheduled;
  `);
};
