import { PETS, PET_ITEMS } from '../data/pets.js'

// Local demo rules; companion growth never spends coins or unlocks pets.
export const GROWTH_POLICY = { dailyLimit: 3, thresholds: [0, 5, 15] }
export const levelOf = value => Math.max(1, Math.min(3, Math.floor(Number(value) || 1)))
export const PET_EFFECTS = ['初见：基础形象与全部基础互动', '熟悉：亮眼细节、专属亲昵动作', '默契：精致名牌、互动时专属小特效']
export const GEAR_EFFECTS = ['基础款：主题纹样', '精致款：细绣、滚边与流苏', '珍藏款：完整刺绣、互动时轻摆与短暂星点']
const collections = ['taskRecords', 'coreProgress', 'activityProgress', 'itineraryTaskRecords', 'customTaskRecords']
const completed = (field, row) => field === 'taskRecords' ? row.state === 'completed' : field === 'coreProgress' ? row.status === 'completed' : !!row.completedAt
const keyOf = (field, row) => `${field}:${row.id ?? row.stepId ?? row.taskId}`
const localDay = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

export function addCompanionGrowth(before, after, userId, now = new Date()) {
  const petId = before.activePetId
  if (!userId || !PETS.some(p => p.id === petId) || !before.userPets?.some(p => p.petId === petId)) return after
  const day = localDay(now), ledger = [...(after.petGrowthLedger ?? [])]
  const seen = new Set(ledger.map(e => e.key))
  let remaining = GROWTH_POLICY.dailyLimit - ledger.filter(e => e.day === day && e.userId === userId).reduce((n,e) => n + e.points, 0)
  let added = 0
  for (const field of collections) {
    const prior = new Set((before[field] ?? []).filter(r => completed(field,r)).map(r => keyOf(field,r)))
    for (const row of after[field] ?? []) {
      const key = keyOf(field,row)
      if (!completed(field,row) || prior.has(key) || seen.has(key) || (row.userId && row.userId !== userId)) continue
      const points = remaining > 0 ? 1 : 0
      ledger.push({ key, userId, petId, day, points, createdAt: now.toISOString() })
      seen.add(key); remaining -= points; added += points
    }
  }
  if (ledger.length === (after.petGrowthLedger ?? []).length) return after
  return { ...after, petGrowthLedger: ledger, petGrowth: { ...after.petGrowth, [petId]: (Number(after.petGrowth?.[petId]) || 0) + added } }
}

export function changeAppearance(state, { userId, kind, id, level }) {
  const bad = message => ({ code: 1, state, message })
  if (!userId || !['pet','item'].includes(kind) || !Number.isInteger(level) || level < 1 || level > 3) return bad('请选择已解锁的外观等级')
  const pet = kind === 'pet'
  const owned = pet ? PETS.some(p => p.id === id) && state.userPets.some(p => p.petId === id) : PET_ITEMS.some(i => i.id === id) && state.ownedItems.includes(id)
  if (!owned || level > levelOf((pet ? state.petLevels : state.itemLevels)?.[id])) return bad('先获得并升级后，才能使用这个外观')
  const key = pet ? 'petAppearanceLevels' : 'itemAppearanceLevels'
  return { code: 0, message: '外观已切换，成长等级不变', state: { ...state, [key]: { ...state[key], [id]: level } } }
}
