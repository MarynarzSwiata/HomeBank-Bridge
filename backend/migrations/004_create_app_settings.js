export const up = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Default settings
    INSERT OR IGNORE INTO app_settings (key, value) VALUES ('allow_registration', 'false');
    INSERT OR IGNORE INTO app_settings (key, value) VALUES ('privacy_mode', 'true');
    INSERT OR IGNORE INTO app_settings (key, value) VALUES ('date_format', 'DD-MM-YYYY');
  `);
};

export const down = async (db) => {
  await db.exec(`
    DROP TABLE IF EXISTS app_settings;
  `);
};
