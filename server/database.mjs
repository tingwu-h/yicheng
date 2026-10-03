import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const serverDir = dirname(fileURLToPath(import.meta.url))
export function openDatabase(path = resolve(serverDir, '../data/backend.sqlite')) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path, { timeout: 5000 })
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;')
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)')
  for (const name of readdirSync(resolve(serverDir, 'migrations')).filter(n => n.endsWith('.sql')).sort()) {
    if (db.prepare('SELECT 1 FROM schema_migrations WHERE name=?').get(name)) continue
    db.exec('BEGIN IMMEDIATE')
    try {
      db.exec(readFileSync(resolve(serverDir, 'migrations', name), 'utf8'))
      db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(name, new Date().toISOString())
      db.exec('COMMIT')
    } catch (e) { db.exec('ROLLBACK'); throw e }
  }
  return db
}

export function getDocument(db, userId, kind, fallback = {}) {
  const row = db.prepare('SELECT body,revision FROM user_documents WHERE user_id=? AND kind=?').get(userId, kind)
  return { data: row ? JSON.parse(row.body) : fallback, revision: row?.revision ?? 0 }
}
export function putDocument(db, userId, kind, data) {
  db.prepare(`INSERT INTO user_documents VALUES (?,?,?,1,?)
    ON CONFLICT(user_id,kind) DO UPDATE SET body=excluded.body,revision=user_documents.revision+1,updated_at=excluded.updated_at`)
    .run(userId, kind, JSON.stringify(data), new Date().toISOString())
  return getDocument(db, userId, kind)
}
// Serialize read-modify-write actions, including legacy async pure business functions.
// No network or password hashing may run inside this queue / transaction.
export function transactionQueue(db) {
  let tail = Promise.resolve()
  return fn => {
    const job = tail.then(async () => {
      db.exec('BEGIN IMMEDIATE')
      try { const value = await fn(); db.exec('COMMIT'); return value }
      catch (e) { db.exec('ROLLBACK'); throw e }
    })
    tail = job.catch(() => {})
    return job
  }
}
