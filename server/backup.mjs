import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function backupDatabase(source = process.env.DATABASE_PATH || resolve(root, 'data/backend.sqlite'), outputDir = resolve(root, 'data/backups')) {
  const input = resolve(source)
  if (!existsSync(input)) throw new Error('数据库尚未创建，请先启动后端')
  mkdirSync(outputDir, {recursive:true})
  const target = resolve(outputDir, 'backend-' + new Date().toISOString().replaceAll(':','-') + '-' + randomUUID().slice(0,8) + '.sqlite')
  const db = new DatabaseSync(input, {readOnly:true})
  try {
    db.exec('PRAGMA busy_timeout=5000')
    // Creates a consistent snapshot including committed WAL data. Never copy a live .sqlite alone.
    db.prepare('VACUUM INTO ?').run(target)
  } finally { db.close() }
  const check = new DatabaseSync(target, {readOnly:true})
  try {
    if (Object.values(check.prepare('PRAGMA integrity_check').get())[0] !== 'ok') throw new Error('备份完整性检查未通过')
  } finally { check.close() }
  return target
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log('完整备份已保存：' + backupDatabase()) }
  catch(error) { console.error(error.message); process.exitCode=1 }
}
