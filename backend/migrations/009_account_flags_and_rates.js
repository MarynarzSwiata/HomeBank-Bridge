// HomeBank account options (exclude from summary / budget / reports) and exchange rates.
// rate = how many units of the currency equal 1 unit of the base currency (HomeBank convention).
export const up = async (db) => {
  await db.exec(`
    ALTER TABLE accounts ADD COLUMN no_summary INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE accounts ADD COLUMN no_budget INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE accounts ADD COLUMN no_report INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS currency_rates (
      code TEXT PRIMARY KEY,
      rate REAL NOT NULL CHECK(rate > 0)
    );
    INSERT OR IGNORE INTO app_settings (key, value) VALUES ('base_currency', '');
  `);
};

export const down = async (db) => {
  await db.exec(`
    DROP TABLE IF EXISTS currency_rates;
    ALTER TABLE accounts DROP COLUMN no_report;
    ALTER TABLE accounts DROP COLUMN no_budget;
    ALTER TABLE accounts DROP COLUMN no_summary;
  `);
};
