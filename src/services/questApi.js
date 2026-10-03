/* ==========================================================================
   任务功能 · 接口层（API 契约的本地实现）
   --------------------------------------------------------------------------
   这一层是「契约」，不是「界面」，也不是「存储」：
   - 每个函数对应 docs/quest/API.md 里的一个端点，参数与返回结构完全一致；
   - 统一返回格式 { code, message, data }，code = 0 表示成功；
   - 全部是 async 的纯函数：入参是当前状态 + 请求体，出参是新状态 + 数据。
     这样将来换成 fetch 时，调用方（QuestContext）一行都不用改，
     只需把 `questApi.xxx(state, body)` 换成 `request('/api/quest/xxx', body)`。

   注意：本地适配器额外返回 `state`（新状态），服务端版本不需要这个字段。
   ========================================================================== */

import {
  balanceOf,
  buildContext,
  coinsFor,
  dateKey,
  idempotencyKey,
  alreadyGranted,
  pickNextTask,
  validateText,
} from '../store/questEngine.js'
import { DEFAULT_PREFS, TASK_TEMPLATES } from '../data/questConfig.js'
import { PETS, getPet, getPetItem, itemsForPet, petLine, DEFAULT_PET_ID } from '../data/pets.js'

/* ==========================================================================
   统一返回格式与错误码
   ========================================================================== */

export const CODE = {
  OK: 0,
  BAD_REQUEST: 40001, // 参数不合法或被词表拦截
  UNAUTHORIZED: 40301, // 未登录
  NOT_FOUND: 40401, // 记录不存在
  CONFLICT: 40901, // 重复提交（幂等命中）
  INSUFFICIENT_COINS: 40201, // 金币不足
}

const ok = (state, data = null, message = 'ok') => ({ code: 0, message, data, state })
const fail = (code, message, state = null) => ({ code, message, data: null, state })

const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

/* 新状态里清掉 activeTask（用于所有会结束/关闭任务卡的操作） */
const withoutActive = (state) => ({ ...state, activeTask: null })

/* ==========================================================================
   埋点（对应 docs/quest/EVENTS.md）
   ========================================================================== */

export const EVENTS = {
  TASK_SURFACED: 'quest_task_surfaced',
  TASK_COMPLETED: 'quest_task_completed',
  TASK_SKIPPED: 'quest_task_skipped',
  TASK_SNOOZED: 'quest_task_snoozed',
  TASK_DISMISSED_TODAY: 'quest_task_dismissed_today',
  TASK_NOT_INTERESTED: 'quest_task_not_interested',
  PRE_ITEM_CREATED: 'quest_pre_item_created',
  PRE_ITEM_UPDATED: 'quest_pre_item_updated',
  PRE_ITEM_DELETED: 'quest_pre_item_deleted',
  COIN_GRANTED: 'quest_coin_granted',
  COIN_SPENT: 'quest_coin_spent',
  PET_UNLOCKED: 'quest_pet_unlocked',
  PET_ACTIVATED: 'quest_pet_activated',
  ITEM_BOUGHT: 'quest_item_bought',
  ITEM_EQUIPPED: 'quest_item_equipped',
  PREFS_UPDATED: 'quest_prefs_updated',
}

const MAX_EVENTS = 200

function withEvent(state, event, payload = {}) {
  const entry = { id: uid('ev'), event, payload, at: new Date().toISOString() }
  const events = [entry, ...(state.events ?? [])].slice(0, MAX_EVENTS)
  return { ...state, events }
}

/* ==========================================================================
   一、用户预录项目 CRUD
   ========================================================================== */

export async function listPreItems(state, { attractionId = null } = {}) {
  const list = attractionId
    ? state.preItems.filter((x) => x.attractionId === attractionId)
    : state.preItems
  return ok(state, list)
}

export async function createPreItem(state, body = {}) {
  const { userId, attractionId, poiId = null, name, category = 'spot', expectedTime = '不限', priority = 'mid', remindEnabled = true, note = '' } = body

  if (!userId) return fail(CODE.UNAUTHORIZED, '请先登录再记录想玩的项目')
  if (!name || !String(name).trim()) return fail(CODE.BAD_REQUEST, '项目名称不能为空')
  if (!attractionId) return fail(CODE.BAD_REQUEST, '缺少景点信息')

  const check = validateText(name)
  if (!check.ok) return fail(CODE.BAD_REQUEST, `名称里有不适合的词「${check.hit}」，换一个说法吧`)

  const dup = state.preItems.find(
    (x) => x.attractionId === attractionId && x.name === String(name).trim() && x.category === category
  )
  if (dup) return ok(state, dup, '这个项目已经在清单里了')

  const now = new Date().toISOString()
  const item = {
    id: uid('pi'),
    userId,
    attractionId,
    poiId,
    name: String(name).trim(),
    category,
    expectedTime,
    priority,
    remindEnabled: !!remindEnabled,
    note,
    status: 'want',
    createdAt: now,
    updatedAt: now,
  }

  let next = { ...state, preItems: [item, ...state.preItems] }
  next = withEvent(next, EVENTS.PRE_ITEM_CREATED, { id: item.id, attractionId, category })
  return ok(next, item, '已记入清单')
}

export async function updatePreItem(state, body = {}) {
  const { userId, id, patch = {} } = body
  if (!userId) return fail(CODE.UNAUTHORIZED, '请先登录')
  const idx = state.preItems.findIndex((x) => x.id === id)
  if (idx < 0) return fail(CODE.NOT_FOUND, '找不到这条记录', state)

  if (patch.name) {
    const check = validateText(patch.name)
    if (!check.ok) return fail(CODE.BAD_REQUEST, `名称里有不适合的词「${check.hit}」，换一个说法吧`)
  }

  const allowed = ['name', 'category', 'expectedTime', 'priority', 'remindEnabled', 'note', 'status']
  const clean = {}
  for (const k of allowed) if (k in patch) clean[k] = patch[k]

  const updated = { ...state.preItems[idx], ...clean, updatedAt: new Date().toISOString() }
  const preItems = state.preItems.map((x, i) => (i === idx ? updated : x))
  let next = { ...state, preItems }
  next = withEvent(next, EVENTS.PRE_ITEM_UPDATED, { id, keys: Object.keys(clean) })
  return ok(next, updated, '已更新')
}

export async function deletePreItem(state, body = {}) {
  const { userId, id } = body
  if (!userId) return fail(CODE.UNAUTHORIZED, '请先登录')
  const exists = state.preItems.some((x) => x.id === id)
  if (!exists) return fail(CODE.NOT_FOUND, '这条记录已经不在了', state)

  const preItems = state.preItems.filter((x) => x.id !== id)
  let next = { ...state, preItems }
  next = withEvent(next, EVENTS.PRE_ITEM_DELETED, { id })
  return ok(next, { id }, '已从清单移除')
}

/* ==========================================================================
   二、任务生成与下发
   ========================================================================== */

export async function nextTask(state, body = {}) {
  const { userId, scene = {}, now = new Date(), templates = TASK_TEMPLATES } = body
  const pet = getPet(state.activePetId) ?? getPet(DEFAULT_PET_ID)
  const prefs = { ...DEFAULT_PREFS, ...state.questPrefs }

  /* 关掉总开关/提醒时，顺手收掉正在展示的卡片，绝不「明明关了还弹」 */
  if (!prefs.featureEnabled) return ok(withoutActive(state), { task: null, reason: 'feature-off' })
  if (!prefs.remindEnabled) return ok(withoutActive(state), { task: null, reason: 'remind-off' })

  /* 已经有一张卡在处理中：直接把它交回去，不再过闸门、不再计数（幂等） */
  if (state.activeTask) {
    return ok(state, {
      task: state.activeTask,
      reason: 'already-active',
      petLine: petLine(state.activePetId, state.activeTask.petLineKey),
    })
  }

  const ctx = buildContext({ now, scene })

  const picked = pickNextTask({
    templates,
    preItems: state.preItems.filter((x) => !userId || x.userId === userId),
    records: state.taskRecords,
    prefs: state.questPrefs,
    ctx,
    pet,
  })

  if (!picked.template) return ok(state, { task: null, reason: picked.reason })

  const key = idempotencyKey(userId || 'guest', picked.template.id, ctx.dateKey)
  const record = {
    id: uid('tr'),
    userId: userId || 'guest',
    templateId: picked.template.id,
    preItemId: picked.preItem?.id ?? null,
    attractionId: picked.preItem?.attractionId ?? null,
    dateKey: ctx.dateKey,
    state: 'surfaced',
    verifyMethod: null,
    coinsGranted: 0,
    idempotencyKey: key,
    surfacedAt: ctx.now.toISOString(),
    completedAt: null,
    snoozeUntil: null,
    context: {
      slot: ctx.slot,
      weather: ctx.weather,
      queueWaitMin: ctx.queueWaitMin,
      visitMinutes: ctx.visitMinutes,
      simulated: true,
    },
  }

  const surfaceCounts = {
    ...(state.questPrefs.surfaceCounts ?? {}),
    [picked.template.id]: ((state.questPrefs.surfaceCounts ?? {})[picked.template.id] ?? 0) + 1,
  }

  const task = {
    id: record.id,
    templateId: picked.template.id,
    title: picked.template.title,
    desc: picked.template.desc,
    steps: picked.template.steps,
    condition: picked.template.condition,
    difficulty: picked.template.difficulty,
    coins: picked.coins,
    verify: picked.template.verify,
    petLineKey: picked.template.petLineKey,
    safetyTip: picked.template.safetyTip,
    category: picked.template.category,
    preItemName: picked.preItem?.name ?? null,
    attractionId: picked.preItem?.attractionId ?? null,
    dateKey: ctx.dateKey,
  }

  let next = {
    ...state,
    taskRecords: [record, ...state.taskRecords],
    questPrefs: { ...state.questPrefs, surfaceCounts, lastSurfacedAt: record.surfacedAt },
    activeTask: task,
  }
  next = withEvent(next, EVENTS.TASK_SURFACED, {
    templateId: task.templateId,
    preItemId: record.preItemId,
    simulated: true,
  })

  return ok(next, {
    task,
    reason: 'ok',
    petLine: petLine(state.activePetId, task.petLineKey),
  })
}

/* 找到当前卡片对应的记录 */
function findRecord(state, taskId) {
  return state.taskRecords.find((r) => r.id === taskId) ?? null
}

function patchRecord(state, taskId, patch) {
  return {
    ...state,
    taskRecords: state.taskRecords.map((r) => (r.id === taskId ? { ...r, ...patch } : r)),
  }
}

export async function completeTask(state, body = {}) {
  const { userId, taskId, verifyMethod = 'manual' } = body
  if (!userId) return fail(CODE.UNAUTHORIZED, '请先登录再完成任务')

  const rec = findRecord(state, taskId)
  if (!rec) return fail(CODE.NOT_FOUND, '这张任务卡已经过期了', state)
  if (rec.state === 'completed') return fail(CODE.CONFLICT, '这个任务今天已经完成过了', state)

  const tpl = TASK_TEMPLATES.find((t) => t.id === rec.templateId)
  const coins = coinsFor(tpl)

  /* 幂等：同一天同一模板只发一次 */
  if (alreadyGranted(state.coinLedger, rec.idempotencyKey)) {
    const done = patchRecord(withoutActive(state), taskId, {
      state: 'completed',
      completedAt: new Date().toISOString(),
    })
    return ok(done, { granted: 0, balance: balanceOf(done.coinLedger), duplicated: true }, '这个任务今天已经记过了')
  }

  const balance = balanceOf(state.coinLedger) + coins
  const ledgerEntry = {
    id: uid('coin'),
    userId,
    delta: coins,
    balanceAfter: balance,
    reason: 'complete',
    refType: 'task',
    refId: rec.id,
    templateId: rec.templateId,
    idempotencyKey: rec.idempotencyKey,
    createdAt: new Date().toISOString(),
  }

  /* 校验方式的降级要如实记录：演示环境没有真实定位与扫码 */
  const downgraded = tpl?.verify !== 'manual' && verifyMethod === 'manual'

  let next = patchRecord(state, taskId, {
    state: 'completed',
    completedAt: new Date().toISOString(),
    verifyMethod,
    verifyDowngraded: !!downgraded,
    coinsGranted: coins,
  })
  next = { ...next, coinLedger: [ledgerEntry, ...next.coinLedger] }
  next = withoutActive(next)
  next = withEvent(next, EVENTS.TASK_COMPLETED, { taskId, templateId: rec.templateId, coins, verifyMethod, downgraded: !!downgraded })
  next = withEvent(next, EVENTS.COIN_GRANTED, { coins, balance, refId: rec.id })

  return ok(next, { granted: coins, balance, duplicated: false, downgraded: !!downgraded }, `完成，获得 ${coins} 金币`)
}

export async function snoozeTask(state, body = {}) {
  const { taskId, minutes = 30 } = body
  const rec = findRecord(state, taskId)
  if (!rec) return fail(CODE.NOT_FOUND, '这张任务卡已经过期了', state)

  const until = new Date(Date.now() + minutes * 60000).toISOString()
  let next = patchRecord(state, taskId, { state: 'snoozed', snoozeUntil: until })
  next = withoutActive(next)
  next = withEvent(next, EVENTS.TASK_SNOOZED, { taskId, minutes })
  return ok(next, { snoozeUntil: until }, `${minutes} 分钟后再提醒`)
}

export async function dismissToday(state, body = {}) {
  const { taskId } = body
  const rec = findRecord(state, taskId)
  if (!rec) return fail(CODE.NOT_FOUND, '这张任务卡已经过期了', state)

  let next = patchRecord(state, taskId, { state: 'dismissedToday' })
  next = withoutActive(next)
  next = withEvent(next, EVENTS.TASK_DISMISSED_TODAY, { taskId, templateId: rec.templateId })
  return ok(next, { taskId }, '今天不再提这件事')
}

export async function notInterested(state, body = {}) {
  const { taskId, scope = 'template' } = body
  const rec = findRecord(state, taskId)
  if (!rec) return fail(CODE.NOT_FOUND, '这张任务卡已经过期了', state)

  const tpl = TASK_TEMPLATES.find((t) => t.id === rec.templateId)
  const prefs = { ...state.questPrefs }

  if (scope === 'category' && tpl) {
    prefs.mutedCategories = Array.from(new Set([...(prefs.mutedCategories ?? []), tpl.category]))
  } else {
    prefs.mutedTemplates = Array.from(new Set([...(prefs.mutedTemplates ?? []), rec.templateId]))
  }

  let next = patchRecord(state, taskId, { state: 'notInterested' })
  next = { ...next, questPrefs: prefs }
  next = withoutActive(next)
  next = withEvent(next, EVENTS.TASK_NOT_INTERESTED, { taskId, scope, templateId: rec.templateId, category: tpl?.category ?? null })
  return ok(next, { scope }, scope === 'category' ? '这类提醒以后减少' : '这类提醒以后不再出现')
}

export async function skipTask(state, body = {}) {
  const { taskId } = body
  const rec = findRecord(state, taskId)

  /* 跳过不写失败、不扣币、不降权：只标记状态并收卡 */
  const next = withEvent(
    withoutActive(rec ? patchRecord(state, taskId, { state: 'skipped' }) : state),
    EVENTS.TASK_SKIPPED,
    { taskId, templateId: rec?.templateId ?? null }
  )
  return ok(next, { taskId }, '好，跳过')
}

export async function listTaskRecords(state, body = {}) {
  const { userId = null } = body
  const list = userId ? state.taskRecords.filter((r) => r.userId === userId) : state.taskRecords
  return ok(state, list)
}

/* 撤销「不感兴趣」，让用户随时能反悔 */
export async function restoreMuted(state, body = {}) {
  const { templateId = null, category = null } = body
  const prefs = { ...state.questPrefs }
  if (templateId) prefs.mutedTemplates = (prefs.mutedTemplates ?? []).filter((x) => x !== templateId)
  if (category) prefs.mutedCategories = (prefs.mutedCategories ?? []).filter((x) => x !== category)
  const next = withEvent({ ...state, questPrefs: prefs }, EVENTS.PREFS_UPDATED, { restore: templateId ?? category })
  return ok(next, { templateId, category }, '已恢复这类提醒')
}

/* ==========================================================================
   三、金币
   ========================================================================== */

export async function getCoins(state) {
  return ok(state, { balance: balanceOf(state.coinLedger), ledger: state.coinLedger })
}

/* 扣币的唯一入口；余额不足直接拒绝，不做透支 */
function spendCoins(state, { userId, amount, reason, refType, refId, idempotencyKey: key }) {
  const balance = balanceOf(state.coinLedger)
  if (amount <= 0) return { error: fail(CODE.BAD_REQUEST, '金额不合法', state) }
  if (balance < amount) return { error: fail(CODE.INSUFFICIENT_COINS, `金币不足，还差 ${amount - balance} 枚`, state) }
  if (key && state.coinLedger.some((e) => e.idempotencyKey === key)) {
    return { error: fail(CODE.CONFLICT, '这笔已经记过了', state) }
  }

  const entry = {
    id: uid('coin'),
    userId,
    delta: -amount,
    balanceAfter: balance - amount,
    reason,
    refType,
    refId,
    idempotencyKey: key ?? null,
    createdAt: new Date().toISOString(),
  }
  const next = { ...state, coinLedger: [entry, ...state.coinLedger] }
  return { entry, state: next }
}

/* ==========================================================================
   四、萌宠与装扮
   ========================================================================== */

export async function listPets(state) {
  const unlocked = new Set(state.userPets.map((p) => p.petId))
  const data = PETS.map((p) => ({
    ...p,
    unlocked: unlocked.has(p.id),
    active: state.activePetId === p.id,
    loadout: state.loadouts?.[p.id] ?? {},
    items: itemsForPet(p.id).map((i) => ({
      ...i,
      owned: i.price === 0 || state.ownedItems.includes(i.id),
      equipped: (state.loadouts?.[p.id] ?? {})[i.slot] === i.id,
    })),
  }))
  return ok(state, { pets: data, activePetId: state.activePetId, balance: balanceOf(state.coinLedger) })
}

export async function unlockPet(state) {
  return fail(CODE.BAD_REQUEST, '宠物只能通过官方核心任务链解锁，不能使用金币', state)
}

export async function activatePet(state, body = {}) {
  const { petId } = body
  if (!state.userPets.some((p) => p.petId === petId)) {
    return fail(CODE.BAD_REQUEST, '还没有解锁这只萌宠', state)
  }
  let next = { ...state, activePetId: petId }
  next = withEvent(next, EVENTS.PET_ACTIVATED, { petId })
  return ok(next, { petId }, '已切换')
}

export async function buyItem(state, body = {}) {
  const { userId, itemId } = body
  if (!userId) return fail(CODE.UNAUTHORIZED, '请先登录再购买装扮')
  const item = getPetItem(itemId)
  if (!item) return fail(CODE.NOT_FOUND, '没有这件装扮', state)
  if (item.petId !== null || !Number.isFinite(item.price) || item.price <= 0) {
    return fail(CODE.BAD_REQUEST, '金币只能购买通用服饰', state)
  }
  if (state.ownedItems.includes(itemId)) return ok(state, { itemId, already: true }, '已经拥有了')

  const spent = spendCoins(state, {
    userId,
    amount: item.price,
    reason: 'buy',
    refType: 'item',
    refId: itemId,
    idempotencyKey: `item:${userId}:${itemId}`,
  })
  if (spent.error) return spent.error

  let next = { ...spent.state, ownedItems: [...spent.state.ownedItems, itemId] }
  next = withEvent(next, EVENTS.ITEM_BOUGHT, { itemId, price: item.price })
  next = withEvent(next, EVENTS.COIN_SPENT, { amount: item.price, refId: itemId })
  return ok(next, { itemId, already: false, balance: balanceOf(next.coinLedger) }, `买到了${item.name}`)
}

/* itemId 传 null 表示卸下该槽位 */
export async function equipItem(state, body = {}) {
  const { userId, petId, itemId } = body
  if (!userId) return fail(CODE.UNAUTHORIZED, '请先登录再更换装扮')
  if (!state.userPets.some((p) => p.petId === petId)) return fail(CODE.BAD_REQUEST, '还没有解锁这只萌宠', state)

  const loadout = { ...(state.loadouts?.[petId] ?? {}) }

  if (itemId === null) {
    return ok(state, { petId }, '已卸下')
  }

  const item = getPetItem(itemId)
  if (!item) return fail(CODE.NOT_FOUND, '没有这件装扮', state)
  if (item.petId && item.petId !== petId) return fail(CODE.BAD_REQUEST, '这件装扮不适合它', state)
  if (!state.ownedItems.includes(itemId)) return fail(CODE.BAD_REQUEST, '还没有这件装扮', state)

  loadout[item.slot] = itemId
  let next = { ...state, loadouts: { ...(state.loadouts ?? {}), [petId]: loadout } }
  next = withEvent(next, EVENTS.ITEM_EQUIPPED, { petId, itemId, slot: item.slot })
  return ok(next, { petId, loadout }, `穿上了${item.name}`)
}

export async function unequipSlot(state, body = {}) {
  const { userId, petId, slot } = body
  if (!userId) return fail(CODE.UNAUTHORIZED, '请先登录再更换装扮')
  const loadout = { ...(state.loadouts?.[petId] ?? {}) }
  delete loadout[slot]
  let next = { ...state, loadouts: { ...(state.loadouts ?? {}), [petId]: loadout } }
  next = withEvent(next, EVENTS.ITEM_EQUIPPED, { petId, itemId: null, slot })
  return ok(next, { petId, loadout }, '已卸下')
}

/* ==========================================================================
   五、偏好与开关
   ========================================================================== */

export async function getPrefs(state) {
  return ok(state, { ...DEFAULT_PREFS, ...state.questPrefs })
}

export async function updatePrefs(state, body = {}) {
  const { patch = {} } = body
  const allowed = [
    'featureEnabled',
    'remindEnabled',
    'maxPerDay',
    'cooldownMin',
    'quietHours',
    'mutedCategories',
    'mutedTemplates',
    'maxSurfacesPerTemplate',
    'allowLocation',
    'showSafetyTip',
  ]
  const clean = {}
  for (const k of allowed) if (k in patch) clean[k] = patch[k]

  const prefs = { ...state.questPrefs, ...clean }
  let next = { ...state, questPrefs: prefs }

  /* 关掉提醒时顺手收掉正在展示的卡片，避免「明明关了还弹」 */
  if (clean.featureEnabled === false || clean.remindEnabled === false) {
    next = withoutActive(next)
  }

  next = withEvent(next, EVENTS.PREFS_UPDATED, { keys: Object.keys(clean) })
  return ok(next, { prefs }, '设置已保存')
}

/* ==========================================================================
   六、场景模拟器（演示用；接真实数据后由服务端上下文替代）
   ========================================================================== */

export async function updateScene(state, body = {}) {
  const { patch = {} } = body
  const next = { ...state, scene: { ...state.scene, ...patch } }
  return ok(next, { scene: next.scene })
}

/* ==========================================================================
   七、埋点查询（演示版把事件存在本地，便于验收与自查）
   ========================================================================== */

export async function listEvents(state, body = {}) {
  const { event = null, limit = 50 } = body
  const list = (state.events ?? []).filter((e) => !event || e.event === event).slice(0, limit)
  return ok(state, list)
}

/* 供界面直接取「今天」用，避免各处重复算本地日期 */
export const todayKey = () => dateKey()
