import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  // Database path (outside repo, gitignored)
  dbPath: path.join(__dirname, '../data/data.db'),
  
  // SQLite pragmas for production
  pragmas: {
    journal_mode: 'WAL',        // Write-Ahead Logging for concurrency
    busy_timeout: 5000,         // 5s timeout for lock resolution
    synchronous: 'NORMAL',      // Balance safety/performance
    foreign_keys: 'ON',         // Enforce FK constraints
    temp_store: 'MEMORY'        // Temp tables in RAM
  }
};
