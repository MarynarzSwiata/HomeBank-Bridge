import db from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '../migrations');

async function runMigrations() {
  console.log('🔄 Running database migrations...');

  // Get all migration files
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split('_')[0]);
    
    // Check if migration already applied
    const applied = await db.get('SELECT version FROM schema_migrations WHERE version = ?', version);
    
    if (applied) {
      console.log(`✓ Migration ${version} already applied, skipping`);
      continue;
    }

    console.log(`▶ Applying migration ${version}: ${file}`);
    
    try {
      const migrationPath = path.join(migrationsDir, file);
      const migrationUrl = pathToFileURL(migrationPath).href;
      const migration = await import(migrationUrl);
      
      // Run migration (sqlite library handles transactions via exec if needed)
      await migration.up(db);
      await db.run('INSERT INTO schema_migrations (version) VALUES (?)', version);
      
      console.log(`✓ Migration ${version} applied successfully`);
    } catch (err) {
      console.error(`✗ Migration ${version} failed:`, err);
      process.exit(1);
    }
  }

  console.log('✅ All migrations completed');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Migration error:', err);
      process.exit(1);
    });
}

export default runMigrations;
