import fs from 'fs';
import path from 'path';
import config from '../config/database.js';
import db from '../db/index.js';

/**
 * Automatic database backups, kept next to the database (data/backups):
 * - daily-YYYY-MM-DD.db: one per day, the newest BACKUP_KEEP_DAYS (default 14) are kept;
 * - before-<action>-YYYY-MM-DDTHH-MM-SS.db: taken right before restore, reset or a
 *   replacing HomeBank import, the newest 10 are kept.
 * Snapshots use VACUUM INTO, which gives a consistent copy while the app is running.
 */
export const BACKUP_DIR = path.join(path.dirname(config.dbPath), 'backups');
const KEEP_DAILY = Math.max(1, parseInt(process.env.BACKUP_KEEP_DAYS, 10) || 14);
const KEEP_SAFETY = 10;
const NAME_RE = /^(daily-\d{4}-\d{2}-\d{2}|before-[a-z]+-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.db$/;
const CHECK_EVERY_MS = 60 * 60 * 1000;

const pad = n => String(n).padStart(2, '0');
const localDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localStamp = d => `${localDate(d)}T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;

const ensureDir = () => fs.mkdirSync(BACKUP_DIR, { recursive: true });

async function snapshot(fileName) {
  ensureDir();
  const target = path.join(BACKUP_DIR, fileName);
  if (fs.existsSync(target)) return target;
  const tmp = `${target}.tmp`;
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  await db.run('VACUUM INTO ?', tmp);
  fs.renameSync(tmp, target); // a half-written copy never looks like a backup
  return target;
}

function prune() {
  // Newest first; the date / timestamp is the part after the prefix
  const stamp = n => n.match(/(\d{4}-\d{2}-\d{2}(T[\d-]+)?)\.db$/)[1];
  const names = fs.readdirSync(BACKUP_DIR).filter(n => NAME_RE.test(n))
    .sort((a, b) => stamp(b).localeCompare(stamp(a)));
  const daily = names.filter(n => n.startsWith('daily-'));
  const safety = names.filter(n => n.startsWith('before-'));
  for (const n of [...daily.slice(KEEP_DAILY), ...safety.slice(KEEP_SAFETY)]) {
    fs.unlinkSync(path.join(BACKUP_DIR, n));
  }
}

/** Today's daily backup, if it does not exist yet. */
export async function ensureDailyBackup() {
  const name = `daily-${localDate(new Date())}.db`;
  if (fs.existsSync(path.join(BACKUP_DIR, name))) return null;
  const file = await snapshot(name);
  prune();
  console.log(`💾 Daily backup saved: ${name}`);
  return file;
}

/** Snapshot taken right before a destructive action (restore, reset, import). */
export async function safetyBackup(action) {
  const name = `before-${action}-${localStamp(new Date())}.db`;
  const file = await snapshot(name);
  prune();
  console.log(`💾 Safety backup saved: ${name}`);
  return file;
}

export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(n => NAME_RE.test(n))
    .map(name => {
      const st = fs.statSync(path.join(BACKUP_DIR, name));
      return {
        name,
        kind: name.startsWith('daily-') ? 'daily' : 'safety',
        action: name.startsWith('before-') ? name.split('-')[1] : null,
        size: st.size,
        createdAt: st.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Full path of a stored backup, or null for an unknown or unsafe name. */
export function backupPath(name) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) return null;
  const file = path.join(BACKUP_DIR, name);
  return fs.existsSync(file) ? file : null;
}

/** Daily backup now (if missing) and then once an hour. */
export function startAutoBackup() {
  const run = () => ensureDailyBackup().catch(err => console.error('Automatic backup failed:', err.message));
  run();
  setInterval(run, CHECK_EVERY_MS).unref();
}
