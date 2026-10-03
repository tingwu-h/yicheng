import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
const derive = promisify(scrypt)
export const id = (prefix = '') => prefix + randomBytes(18).toString('hex')
export const hash = value => createHash('sha256').update(value).digest('hex')
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
export function insist(condition, status, message) { if (!condition) throw new HttpError(status, message) }
export async function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  const result = await derive(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 })
  return `scrypt:${salt}:${result.toString('hex')}`
}
export async function passwordMatches(password, encoded) {
  const [, salt, digest] = encoded.split(':')
  const actual = await passwordHash(password, salt)
  return timingSafeEqual(Buffer.from(actual.split(':')[2], 'hex'), Buffer.from(digest, 'hex'))
}
export function validateCredentials(body) {
  const account = String(body.account ?? '').trim().toLowerCase()
  insist(/^[a-z0-9._%+-]+@[a-z0-9.-]+[.][a-z]{2,}$/.test(account) && account.length <= 120, 400, '请填写有效邮箱作为账号')
  insist(typeof body.password === 'string' && body.password.length >= 8 && body.password.length <= 128, 400, '密码需要 8–128 位')
  return account
}
export function sessionCookie(token, secure, remember = true) {
  return `yicheng_session=${token}; Path=/; HttpOnly; SameSite=Lax${remember ? '; Max-Age=604800' : ''}${secure ? '; Secure' : ''}`
}
export function currentUser(db, req) {
  const token = /(?:^|; *)yicheng_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1]
  if (!token) return null
  return db.prepare(`SELECT u.id,u.account,u.name,u.role FROM users u JOIN sessions s ON s.user_id=u.id
    WHERE s.token_hash=? AND s.expires_at>?`).get(hash(token), Date.now()) ?? null
}
export function publicUser(user) { return user ? { id: user.id, email: user.account, name: user.name, role: user.role, isInternalTest: false } : null }
export async function readBody(req, limit = 1024 * 1024) {
  const chunks = []; let size = 0
  for await (const part of req) { size += part.length; insist(size <= limit, 413, '提交内容太大，请压缩后再试'); chunks.push(part) }
  return Buffer.concat(chunks)
}
export async function readJson(req) {
  insist((req.headers['content-type'] ?? '').split(';')[0] === 'application/json', 415, '请使用 JSON 请求')
  try {
    const body = JSON.parse((await readBody(req)).toString('utf8'))
    insist(body && typeof body === 'object' && !Array.isArray(body), 400, '请求格式不正确')
    return body
  } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, '请求内容不是有效 JSON') }
}
export function rateLimiter() {
  const buckets = new Map()
  return (key, limit, windowMs = 60000) => {
    const now = Date.now()
    if (buckets.size > 10000) for (const [k,v] of buckets) if (v.until <= now) buckets.delete(k)
    insist(buckets.size < 20000 || buckets.has(key), 429, '请求较多，请稍后再试')
    const b = buckets.get(key)
    if (!b || b.until <= now) { buckets.set(key, { count: 1, until: now + windowMs }); return }
    insist(++b.count <= limit, 429, '操作有点频繁，请稍后再试')
  }
}
