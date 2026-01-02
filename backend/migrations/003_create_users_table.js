export const up = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `);
};

export const down = async (db) => {
  await db.exec(`
    DROP INDEX IF EXISTS idx_users_username;
    DROP TABLE IF EXISTS users;
  `);
};
