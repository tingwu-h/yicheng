/* vh0.2 可选后台配置服务。Node 24+；不代替正式用户认证/图片审核服务。 */
import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { CORE_CHAINS, ACTIVITY_TASKS, VH02_POLICY, SCENIC_COSTUMES } from '../src/data/vh02Config.js'
import { getAttraction } from '../src/data/attractions.js'
import { PETS, PET_ITEMS } from '../src/data/pets.js'

const token = process.env.VH02_ADMIN_TOKEN
if (!token || token.length < 16) throw new Error('启动前请设置至少 16 位的 VH02_ADMIN_TOKEN')
const file = resolve(dirname(fileURLToPath(import.meta.url)), '../data/vh02-config.sqlite')
mkdirSync(dirname(file), { recursive: true })
const db = new DatabaseSync(file)
db.exec('CREATE TABLE IF NOT EXISTS official_config (key TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at TEXT NOT NULL)')
const get = db.prepare('SELECT body FROM official_config WHERE key = ?')
const put = db.prepare('INSERT INTO official_config(key,body,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at')
const defaults = { coreChains: CORE_CHAINS, activityTasks: ACTIVITY_TASKS, officialTaskConfig: {
  version: 'vh0.2', enabled: true, maxRemindersPerDay: 2, quietHours: [22, 8],
  privateTaskDailyRewardLimit: 2, publicCreatorMilestones: VH02_POLICY.publicCreatorMilestones,
} }
const keys = Object.keys(defaults)
const current = (key) => {
  const row = get.get(key)
  return row ? JSON.parse(row.body) : defaults[key]
}
const write = (res, status, data) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  res.end(JSON.stringify(data))
}
const readBody = async (req) => {
  let source = ''
  for await (const chunk of req) {
    source += chunk
    if (source.length > 200000) throw new Error('请求体过大')
  }
  return JSON.parse(source)
}
const valid = (key, body) => {
  if (key === 'coreChains') return Array.isArray(body) && body.length === 4 &&
    new Set(body.map((x) => x.petId)).size === 4 &&
    body.every((x) => PETS.some((p) => p.id === x.petId) && PET_ITEMS.some((i) => i.id === x.rewardCostumeId && i.petId === x.petId && i.acquisition === 'core') &&
      Array.isArray(x.steps) && x.steps.length >= 3 && x.steps.length <= 5 &&
      x.steps.every((s) => s.optional === true && s.skippable === true && getAttraction(s.attractionId) && s.title && ['checkin','observe','answer','photo'].includes(s.type)))
  if (key === 'activityTasks') return Array.isArray(body) && body.every((x) => getAttraction(x.attractionId) && x.title && PET_ITEMS.some((i) => i.id === x.costumeId && i.acquisition === 'activity'))
  return body && typeof body === 'object' && body.version === 'vh0.2' && typeof body.enabled === 'boolean' &&
    Number.isInteger(body.maxRemindersPerDay) && body.maxRemindersPerDay >= 0 && body.maxRemindersPerDay <= 5 &&
    Number.isInteger(body.privateTaskDailyRewardLimit) && body.privateTaskDailyRewardLimit >= 0 && body.privateTaskDailyRewardLimit <= 5 &&
    Array.isArray(body.quietHours) && body.quietHours.length === 2 && body.quietHours.every((x) => Number.isInteger(x) && x >= 0 && x <= 23)
}

const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname
    if (req.method === 'GET' && path === '/api/vh02/config') {
      return write(res, 200, { version: 'vh0.2', policy: VH02_POLICY, petDefinitions: PETS, costumeDefinitions: PET_ITEMS,
        scenicCostumeCount: SCENIC_COSTUMES.length, coreChains: current('coreChains'), activityTasks: current('activityTasks'),
        officialTaskConfig: current('officialTaskConfig') })
    }
    if (path.startsWith('/api/vh02/admin/')) {
      if (req.headers.authorization !== 'Bearer ' + token) return write(res, 401, { error: '需要后台令牌' })
      const key = path.slice('/api/vh02/admin/'.length)
      if (!keys.includes(key)) return write(res, 404, { error: '未知配置项' })
      if (req.method === 'GET') return write(res, 200, { key, value: current(key) })
      if (req.method === 'PUT') {
        const body = await readBody(req)
        if (!valid(key, body)) return write(res, 400, { error: '配置不符合 vh0.2 约束：四宠、3–5 步、全部可跳过' })
        put.run(key, JSON.stringify(body), new Date().toISOString())
        return write(res, 200, { key, saved: true })
      }
    }
    return write(res, 404, { error: '未找到接口' })
  } catch (error) { return write(res, 400, { error: error.message }) }
})

const port = Number(process.env.VH02_API_PORT ?? 5174)
server.listen(port, '127.0.0.1', () => console.log('vh0.2 配置服务已启动：127.0.0.1:' + port))
