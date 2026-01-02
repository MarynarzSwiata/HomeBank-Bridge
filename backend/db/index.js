import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import config from '../config/database.js';
import fs from 'fs';
import path from 'path';

// Ensure data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

export async function initDb() {
  // Initialize database with WAL mode
  db = await open({
    filename: config.dbPath,
    driver: sqlite3.Database
  });

  // Apply pragmas
  for (const [key, value] of Object.entries(config.pragmas)) {
    await db.exec(`PRAGMA ${key} = ${value}`);
  }

  // Migrations table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  return db;
}

export async function closeDb() {
  if (db) {
    await db.close();
    db = null;
  }
}

// Initial session start
await initDb();

// Use a proxy or getter if needed, but for this structure we'll use a dynamic export
// or just export the variable which will be updated by initDb.
export default {
  // Proxy methods to the current db instance
  run: (...args) => db.run(...args),
  get: (...args) => db.get(...args),
  all: (...args) => db.all(...args),
  exec: (...args) => db.exec(...args)
};
