/* ==========================================================================
   任务功能 · 零依赖自测脚本
   --------------------------------------------------------------------------
   跑法（在项目根目录）：
     node tools/quest-selftest.mjs
   不引入任何测试框架，用 node 内置的 assert。
   覆盖：引擎闸门与打分、金币幂等、非强迫原则（跳过不扣币）、
         萌宠解锁与装扮、词表拦截、迁移函数。

   为什么可以直接 node 跑：questEngine.js / questApi.js / questStore.js 的
   相对导入都带 .js 后缀，且不依赖 React、不依赖 DOM（questStore 只在函数
   内部访问 localStorage，import 阶段不触碰）。
   ========================================================================== */

import assert from 'node:assert/strict'

import {
  buildContext,
  dateKey,
  inQuietHours,
  slotOfHour,
  gateReason,
  pickNextTask,
  coinsFor,
  balanceOf,
  idempotencyKey,
  alreadyGranted,
  validateText,
  derivePois,
} from '../src/store/questEngine.js'
import { defaultQuestState, migrateQuestState } from '../src/store/questStore.js'
import * as api from '../src/services/questApi.js'
import * as vh02 from '../src/services/vh02Api.js'
import { CORE_CHAINS, ACTIVITY_TASKS, SCENIC_COSTUMES } from '../src/data/vh02Config.js'
import { TASK_TEMPLATES, DIFFICULTY_COINS } from '../src/data/questConfig.js'
import { PETS, getPet, itemsForPet } from '../src/data/pets.js'
import { attractions, getAttraction } from '../src/data/attractions.js'

/* ---------------------------------------------------------------- 迷你测试台 */

let passed = 0
const failures = []

async function test(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failures.push({ name, err })
    console.log(`  ✗ ${name}\n      ${err.message}`)
  }
}

function group(title) {
  console.log(`\n${title}`)
}

const at = (h, m = 0) => new Date(2026, 7, 15, h, m, 0) // 2026-08-15 本地时间

const preItem = (over = {}) => ({
  id: 'pi-1',
  userId: 'me',
  attractionId: 'a1',
  poiId: null,
  name: '一号坑军阵全景',
  category: 'photo',
  expectedTime: '上午',
  priority: 'high',
  remindEnabled: true,
  note: '',
  status: 'want',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...over,
})

const baseState = () => defaultQuestState()

/* ================================================================ 一、时间工具 */

group('一、时间工具（本地时区）')

await test('dateKey 用本地日期，不受 UTC 影响', () => {
  assert.equal(dateKey(at(23, 30)), '2026-08-15')
  assert.equal(dateKey(at(0, 30)), '2026-08-15')
})

await test('安静时段 22:00–08:00 跨零点判断正确', () => {
  assert.equal(inQuietHours(22 * 60), true)
  assert.equal(inQuietHours(23 * 60 + 30), true)
  assert.equal(inQuietHours(3 * 60), true)
  assert.equal(inQuietHours(7 * 60 + 59), true)
  assert.equal(inQuietHours(8 * 60), false)
  assert.equal(inQuietHours(12 * 60), false)
  assert.equal(inQuietHours(21 * 60 + 59), false)
})

await test('时段映射', () => {
  assert.equal(slotOfHour(9), '上午')
  assert.equal(slotOfHour(12), '中午')
  assert.equal(slotOfHour(15), '下午')
  assert.equal(slotOfHour(18), '傍晚')
  assert.equal(slotOfHour(20), '夜晚')
  assert.equal(slotOfHour(6), null)
})

/* ================================================================ 二、闸门 */

group('二、打扰闸门（依次判断，命中即安静）')

const ctxAt = (over = {}) =>
  buildContext({ now: at(9, 30), scene: { atAttractionId: 'a1', weather: '晴', queueWaitMin: 0, visitMinutes: 0, ...over } })

await test('总开关关闭 → feature-off', () => {
  const s = baseState()
  s.questPrefs = { ...s.questPrefs, featureEnabled: false }
  assert.equal(gateReason({ prefs: s.questPrefs, records: [], preItems: [preItem()], ctx: ctxAt() }), 'feature-off')
})

await test('提醒开关关闭 → remind-off', () => {
  const s = baseState()
  s.questPrefs = { ...s.questPrefs, remindEnabled: false }
  assert.equal(gateReason({ prefs: s.questPrefs, records: [], preItems: [preItem()], ctx: ctxAt() }), 'remind-off')
})

await test('清单为空 → no-pre-items（没有由头就不打扰）', () => {
  const s = baseState()
  assert.equal(gateReason({ prefs: s.questPrefs, records: [], preItems: [], ctx: ctxAt() }), 'no-pre-items')
})

await test('安静时段 → quiet-hours', () => {
  const s = baseState()
  const ctx = buildContext({ now: at(23, 0), scene: { atAttractionId: 'a1' } })
  assert.equal(gateReason({ prefs: s.questPrefs, records: [], preItems: [preItem()], ctx }), 'quiet-hours')
})

await test('每日上限 → daily-limit', () => {
  const s = baseState()
  const ctx = ctxAt()
  const records = [
    { id: 'r1', dateKey: ctx.dateKey, surfacedAt: at(9).toISOString(), state: 'completed', templateId: 't-first-look' },
    { id: 'r2', dateKey: ctx.dateKey, surfacedAt: at(9, 10).toISOString(), state: 'skipped', templateId: 't-one-detail' },
  ]
  assert.equal(gateReason({ prefs: s.questPrefs, records, preItems: [preItem()], ctx }), 'daily-limit')
})

await test('冷却期内 → cooldown', () => {
  const s = baseState()
  const ctx = ctxAt({})
  const records = [{ id: 'r1', dateKey: ctx.dateKey, surfacedAt: at(9, 20).toISOString(), state: 'skipped', templateId: 't-one-detail' }]
  assert.equal(gateReason({ prefs: s.questPrefs, records, preItems: [preItem()], ctx }), 'cooldown')
})

await test('冷却期过后放行', () => {
  const s = baseState()
  const ctx = ctxAt()
  const records = [{ id: 'r1', dateKey: ctx.dateKey, surfacedAt: at(7, 30).toISOString(), state: 'skipped', templateId: 't-one-detail' }]
  assert.equal(gateReason({ prefs: s.questPrefs, records, preItems: [preItem()], ctx }), null)
})

/* ================================================================ 三、挑选 */

group('三、每次最多 1 个主任务')

await test('在景点且有拍照项目时，能选中一个任务', () => {
  const picked = pickNextTask({
    templates: TASK_TEMPLATES,
    preItems: [preItem({ category: 'photo' })],
    records: [],
    prefs: defaultQuestState().questPrefs,
    ctx: ctxAt(),
    pet: getPet('pet-zhuhuan'),
  })
  assert.ok(picked.template, '应能选出任务')
  assert.equal(picked.reason, 'ok')
  assert.ok(picked.coins > 0)
})

await test('返回值只有一个任务对象（结构上不可能一次给多个）', () => {
  const picked = pickNextTask({
    templates: TASK_TEMPLATES,
    preItems: [preItem()],
    records: [],
    prefs: defaultQuestState().questPrefs,
    ctx: ctxAt(),
  })
  assert.equal(typeof picked.template, 'object')
  assert.equal(Array.isArray(picked.template), false)
})

await test('用户对单个项目关掉提醒后，它不参与触发', () => {
  const picked = pickNextTask({
    templates: TASK_TEMPLATES.filter((t) => t.trigger.type === 'location'),
    preItems: [preItem({ remindEnabled: false })],
    records: [],
    prefs: defaultQuestState().questPrefs,
    ctx: ctxAt(),
    pet: null,
  })
  assert.equal(picked.template, null)
})

await test('同一模板当天已「今天不再提醒」→ 不再出现', () => {
  const ctx = ctxAt()
  const records = [
    { id: 'r1', dateKey: ctx.dateKey, templateId: 't-photo-spot', state: 'dismissedToday', surfacedAt: at(9).toISOString() },
  ]
  const picked = pickNextTask({
    templates: TASK_TEMPLATES.filter((t) => t.id === 't-photo-spot'),
    preItems: [preItem()],
    records,
    prefs: { ...defaultQuestState().questPrefs, maxPerDay: 9, cooldownMin: 0 },
    ctx,
  })
  assert.equal(picked.template, null)
})

await test('出现次数达到上限后自动静音', () => {
  const ctx = ctxAt()
  const prefs = { ...defaultQuestState().questPrefs, maxPerDay: 9, cooldownMin: 0, surfaceCounts: { 't-photo-spot': 3 } }
  const picked = pickNextTask({
    templates: TASK_TEMPLATES.filter((t) => t.id === 't-photo-spot'),
    preItems: [preItem()],
    records: [],
    prefs,
    ctx,
  })
  assert.equal(picked.template, null)
})

await test('不感兴趣的类别会被整类屏蔽，且可撤销', () => {
  const ctx = ctxAt()
  const prefs = { ...defaultQuestState().questPrefs, maxPerDay: 9, cooldownMin: 0, mutedCategories: ['photo'] }
  const picked = pickNextTask({
    templates: TASK_TEMPLATES.filter((t) => t.category === 'photo'),
    preItems: [preItem()],
    records: [],
    prefs,
    ctx,
  })
  assert.equal(picked.template, null)
})

await test('萌宠擅长方向只影响排序，不改变闸门', () => {
  const ctx = ctxAt()
  const a = pickNextTask({ templates: TASK_TEMPLATES, preItems: [preItem()], records: [], prefs: defaultQuestState().questPrefs, ctx, pet: getPet('pet-zhuhuan') })
  const b = pickNextTask({ templates: TASK_TEMPLATES, preItems: [preItem()], records: [], prefs: defaultQuestState().questPrefs, ctx, pet: null })
  assert.ok(a.template && b.template)
})

/* ================================================================ 四、金币 */

group('四、金币：只增于任务、幂等、不可透支')

await test('难度对应固定金币数', () => {
  assert.equal(coinsFor({ difficulty: 'easy' }), DIFFICULTY_COINS.easy)
  assert.equal(coinsFor({ difficulty: 'hard' }), DIFFICULTY_COINS.hard)
  assert.equal(coinsFor({}), DIFFICULTY_COINS.easy)
})

await test('流水平衡与幂等键', () => {
  assert.equal(balanceOf([]), 0)
  assert.equal(balanceOf([{ delta: 10 }, { delta: 20 }, { delta: -5 }]), 25)
  const key = idempotencyKey('me', 't-photo-spot', '2026-08-15')
  assert.equal(key, 'task:me:t-photo-spot:2026-08-15')
  assert.equal(alreadyGranted([{ idempotencyKey: key }], key), true)
})

/* ================================================================ 五、端到端 */

group('五、端到端：预录 → 下发 → 完成 → 金币')

async function flow() {
  let s = baseState()

  const created = await api.createPreItem(s, {
    userId: 'me',
    attractionId: 'a1',
    name: '一号坑军阵全景',
    category: 'photo',
    expectedTime: '上午',
    priority: 'high',
  })
  assert.equal(created.code, 0, created.message)
  s = created.state
  assert.equal(s.preItems.length, 1)

  const surfaced = await api.nextTask(s, { userId: 'me', scene: { atAttractionId: 'a1' }, now: at(9, 30) })
  assert.equal(surfaced.code, 0)
  assert.ok(surfaced.data.task, '应下发一张任务卡')
  s = surfaced.state

  /* 叠卡保护：未处理完不再生成第二张 */
  const again = await api.nextTask(s, { userId: 'me', scene: { atAttractionId: 'a1' }, now: at(9, 40) })
  assert.equal(again.data.reason, 'already-active')
  assert.equal(again.data.task.id, surfaced.data.task.id)

  const taskId = surfaced.data.task.id
  const done = await api.completeTask(s, { userId: 'me', taskId, verifyMethod: 'manual' })
  assert.equal(done.code, 0)
  assert.ok(done.data.granted > 0)
  s = done.state
  assert.equal(balanceOf(s.coinLedger), done.data.granted)
  assert.equal(s.activeTask, null)

  /* 重复完成 → 冲突码，且不再发币 */
  const dup = await api.completeTask(s, { userId: 'me', taskId })
  assert.equal(dup.code, api.CODE.CONFLICT)
  assert.equal(balanceOf(s.coinLedger), done.data.granted)

  /* 派生数据与埋点 */
  assert.ok(s.events.some((e) => e.event === api.EVENTS.TASK_COMPLETED))
  assert.ok(s.events.some((e) => e.event === api.EVENTS.COIN_GRANTED))

  return { s, taskId, earned: done.data.granted }
}

await test('完整链路可跑通且金币只发一次', async () => {
  await flow()
})

await test('未登录不能预录、不能完成', async () => {
  const s = baseState()
  const a = await api.createPreItem(s, { attractionId: 'a1', name: '测试' })
  assert.equal(a.code, api.CODE.UNAUTHORIZED)
  const b = await api.completeTask(s, { taskId: 'x' })
  assert.equal(b.code, api.CODE.UNAUTHORIZED)
})

await test('名称命中词表被拦截；空名称被拒', async () => {
  const s = baseState()
  const bad = await api.createPreItem(s, { userId: 'me', attractionId: 'a1', name: '限时抢购赶紧来' })
  assert.equal(bad.code, api.CODE.BAD_REQUEST)
  const empty = await api.createPreItem(s, { userId: 'me', attractionId: 'a1', name: '   ' })
  assert.equal(empty.code, api.CODE.BAD_REQUEST)
})

await test('重复添加同一项目给出友好提示而不是报错', async () => {
  const s = baseState()
  const one = await api.createPreItem(s, { userId: 'me', attractionId: 'a1', name: '铜车马展厅' })
  const two = await api.createPreItem(one.state, { userId: 'me', attractionId: 'a1', name: '铜车马展厅' })
  assert.equal(two.code, 0)
  assert.equal(two.state.preItems.length, 1)
})

/* ================================================================ 六、非强迫 */

group('六、非强迫原则（结构上无负反馈）')

async function surfacedState() {
  let s = baseState()
  const c = await api.createPreItem(s, { userId: 'me', attractionId: 'a1', name: '一号坑军阵全景', category: 'photo' })
  s = c.state
  const r = await api.nextTask(s, { userId: 'me', scene: { atAttractionId: 'a1' }, now: at(9, 30) })
  return { s: r.state, taskId: r.data.task.id, templateId: r.data.task.templateId, category: r.data.task.category }
}

await test('跳过：不扣币、不产生负数流水、不记失败', async () => {
  const { s, taskId } = await surfacedState()
  const res = await api.skipTask(s, { taskId })
  assert.equal(res.code, 0)
  assert.equal(balanceOf(res.state.coinLedger), 0)
  assert.equal(res.state.coinLedger.length, 0)
  const rec = res.state.taskRecords.find((r) => r.id === taskId)
  assert.equal(rec.state, 'skipped')
  assert.equal('failed' in rec, false)
})

await test('稍后提醒：写入 snoozeUntil 且当场收卡', async () => {
  const { s, taskId } = await surfacedState()
  const res = await api.snoozeTask(s, { taskId, minutes: 30 })
  assert.equal(res.code, 0)
  const rec = res.state.taskRecords.find((r) => r.id === taskId)
  assert.equal(rec.state, 'snoozed')
  assert.ok(new Date(rec.snoozeUntil) > new Date())
  assert.equal(res.state.activeTask, null)
})

await test('今天不再提醒：当天该模板被静音', async () => {
  const { s, taskId, templateId } = await surfacedState()
  const res = await api.dismissToday(s, { taskId })
  const picked = pickNextTask({
    templates: TASK_TEMPLATES.filter((t) => t.id === templateId),
    preItems: res.state.preItems,
    records: res.state.taskRecords,
    prefs: { ...res.state.questPrefs, cooldownMin: 0, maxPerDay: 9 },
    ctx: ctxAt(),
  })
  assert.equal(picked.template, null)
})

await test('不感兴趣：可整类屏蔽并撤销', async () => {
  const { s, taskId, category } = await surfacedState()
  const res = await api.notInterested(s, { taskId, scope: 'category' })
  assert.equal(res.code, 0)
  assert.ok(res.state.questPrefs.mutedCategories.includes(category))

  const back = await api.restoreMuted(res.state, { category })
  assert.equal(back.code, 0)
  assert.equal(back.state.questPrefs.mutedCategories.includes(category), false)
})

await test('关闭总开关会顺手收掉正在展示的卡片', async () => {
  const { s } = await surfacedState()
  assert.ok(s.activeTask)
  const res = await api.updatePrefs(s, { patch: { featureEnabled: false } })
  assert.equal(res.code, 0)
  assert.equal(res.state.activeTask, null)
  assert.equal(
    gateReason({ prefs: res.state.questPrefs, records: [], preItems: res.state.preItems, ctx: ctxAt() }),
    'feature-off'
  )
})

/* ================================================================ 七、萌宠 */

group('七、萌宠与装扮（官方任务链解锁）')

await test('四只萌宠齐备，新用户未默认领取', () => {
  assert.equal(PETS.length, 4)
  const s = baseState()
  assert.deepEqual(s.userPets, [])
  assert.equal(s.activePetId, null)
})

await test('金币不能购买宠物或专属装扮', async () => {
  const s = { ...baseState(), coinLedger: [{ delta: 500, balanceAfter: 500 }] }
  assert.equal((await api.unlockPet(s, { userId: 'me', petId: 'pet-qizai' })).code, api.CODE.BAD_REQUEST)
  assert.equal((await api.buyItem(s, { userId: 'me', itemId: 'it-bamboo-back' })).code, api.CODE.BAD_REQUEST)
  assert.equal(balanceOf(s.coinLedger), 500)
})

await test('通用服饰可用任务金币购买，未拥有宠物不能穿', async () => {
  const s = { ...baseState(), coinLedger: [{ delta: 100, balanceAfter: 100 }] }
  const bought = await api.buyItem(s, { userId: 'me', itemId: 'it-tang' })
  assert.equal(bought.code, 0)
  assert.equal(balanceOf(bought.state.coinLedger), 60)
  assert.equal((await api.equipItem(bought.state, { userId: 'me', petId: 'pet-qizai', itemId: 'it-tang' })).code, api.CODE.BAD_REQUEST)
})

await test('历史解锁的宠物与专属服饰继续可用', async () => {
  const s = { ...baseState(), userPets: [{ petId: 'pet-qizai' }, { petId: 'pet-zhuhuan' }], ownedItems: ['it-bamboo-back'] }
  const worn = await api.equipItem(s, { userId: 'me', petId: 'pet-qizai', itemId: 'it-bamboo-back' })
  assert.equal(worn.code, 0)
  assert.equal((await api.equipItem(s, { userId: 'me', petId: 'pet-zhuhuan', itemId: 'it-bamboo-back' })).code, api.CODE.BAD_REQUEST)
})

await test('官方链需顺序与现场定位，完成后只发一次宠物和专属服饰', async () => {
  const chain = CORE_CHAINS[0]
  const loc = getAttraction(chain.steps[0].attractionId).geo
  let s = baseState()
  assert.notEqual((await vh02.completeCoreStep(s, { userId: 'me', chainId: chain.id, stepId: chain.steps[1].id, evidence: { answer: '砖纹' } })).code, 0)
  for (let i = 0; i < 3; i++) {
    const step = chain.steps[i]
    const res = await vh02.completeCoreStep(s, { userId: 'me', chainId: chain.id, stepId: step.id, evidence: step.type === 'checkin' ? { coords: getAttraction(step.attractionId).geo } : { answer: '我喜欢这里的线条' } })
    assert.equal(res.code, 0)
    s = res.state
  }
  const last = chain.steps[3]
  assert.notEqual((await vh02.completeCoreStep(s, { userId: 'me', chainId: chain.id, stepId: last.id, evidence: { answer: '西安很好看' } })).code, 0)
  s = { ...s, coreProgress: s.coreProgress.map((x) => ({ ...x, day: '2026-09-30' })) }
  const done = await vh02.completeCoreStep(s, { userId: 'me', chainId: chain.id, stepId: last.id, evidence: { answer: '西安很好看' } })
  assert.equal(done.code, 0)
  assert.ok(done.state.userPets.some((x) => x.petId === chain.petId))
  assert.ok(done.state.ownedItems.includes(chain.rewardCostumeId))
  assert.equal((await vh02.completeCoreStep(done.state, { userId: 'me', chainId: chain.id, stepId: last.id })).state.userPets.length, 1)
})

await test('行程任务只在当天，首次完成发四款景点服饰且幂等', async () => {
  const today = dateKey(new Date())
  const trip = { days: [{ date: today, items: [{ attractionId: 'a6' }] }] }
  const task = vh02.tasksForItinerary(trip).find((x) => x.type === 'photo')
  let res = await vh02.completeItineraryTask(baseState(), { userId: 'me', itinerary: trip, taskId: task.id, evidence: { photoSelected: true } })
  assert.equal(res.code, 0)
  assert.equal(balanceOf(res.state.coinLedger), 3)
  assert.equal(res.state.ownedItems.filter((x) => x.startsWith('scenic-a6-')).length, 4)
  res = await vh02.completeItineraryTask(res.state, { userId: 'me', itinerary: trip, taskId: task.id, evidence: { photoSelected: true } })
  assert.equal(balanceOf(res.state.coinLedger), 3)
})

await test('自建任务先私有记录，完成时可公开并进入审核', async () => {
  let s = baseState()
  for (let i = 0; i < 3; i++) {
    const made = await vh02.createCustomTask(s, { userId: 'me', attractionId: 'a6', title: '观察街边灯影' + i, type: 'photo' })
    assert.equal(made.code, 0)
    assert.equal(made.data.visibility, 'private')
    s = (await vh02.completeCustomTask(made.state, { userId: 'me', taskId: made.data.id, evidence: { photoSelected: true } })).state
  }
  assert.equal(balanceOf(s.coinLedger), 4)
  const publicTask = await vh02.createCustomTask(s, { userId: 'me', attractionId: 'a6', title: '记录夜景光影', type: 'photo' })
  assert.equal(publicTask.data.status, 'private')
  const completed = await vh02.completeCustomTask(publicTask.state, { userId: 'me', taskId: publicTask.data.id, evidence: { photoSelected: true, publish: true } })
  assert.equal(completed.data.pendingReview, true)
  assert.equal(completed.state.customTasks.find(t => t.id === publicTask.data.id).status, 'pending_review')
  assert.equal(balanceOf(completed.state.coinLedger), 4)
  const repeated = await vh02.completeCustomTask(completed.state, { userId: 'me', taskId: publicTask.data.id, evidence: { photoSelected: true, publish: true } })
  assert.equal(balanceOf(repeated.state.coinLedger), 4)
})

await test('额度内公开完成奖励五币；删除、重试、审核均不重复发币', async () => {
  const made = await vh02.createCustomTask(baseState(), { userId: 'me', attractionId: 'a6', title: '记录长安屋檐', type: 'photo' })
  const request = { userId: 'me', taskId: made.data.id, evidence: { photoSelected: true, publish: true } }
  const missingPhoto = await vh02.completeCustomTask(made.state, { ...request, evidence: { publish: true } })
  assert.notEqual(missingPhoto.code, 0)
  const done = await vh02.completeCustomTask(made.state, request)
  assert.equal(done.data.coins, 2)
  assert.equal(done.data.bonus, 3)
  assert.equal(balanceOf(done.state.coinLedger), 5)
  const repeated = await vh02.completeCustomTask(done.state, request)
  assert.equal(balanceOf(repeated.state.coinLedger), 5)
  assert.notEqual((await vh02.reviewCustomTask(done.state, { reviewerId: 'me', taskId: made.data.id, approved: true })).code, 0)
  const reviewed = await vh02.reviewCustomTask(done.state, { reviewerId: 'tester', isInternalTest: true, taskId: made.data.id, approved: true })
  assert.equal(reviewed.state.customTasks[0].status, 'approved')
  assert.equal(balanceOf(reviewed.state.coinLedger), 5)
  assert.notEqual((await vh02.deleteCustomTask(reviewed.state, { userId: 'other', taskId: made.data.id })).code, 0)
  const deleted = await vh02.deleteCustomTask(reviewed.state, { userId: 'me', taskId: made.data.id })
  assert.ok(deleted.state.customTasks[0].deletedAt)
  assert.equal(deleted.state.customTaskRecords.length, 1)
  assert.equal(balanceOf(deleted.state.coinLedger), 5)
  assert.notEqual((await vh02.completeCustomTask(deleted.state, request)).code, 0)
})

await test('四只宠物在二十四个景点各有专属服饰', () => {
  assert.equal(SCENIC_COSTUMES.length, 96)
  assert.equal(new Set(SCENIC_COSTUMES.map((x) => x.id)).size, 96)
  assert.ok(SCENIC_COSTUMES.every((x) => x.petId && x.attractionId && x.price === null))
})

await test('活动限定服饰只能完成现场活动任务领取', async () => {
  const task = ACTIVITY_TASKS[0]
  const s = baseState()
  assert.equal((await api.buyItem(s, { userId: 'me', itemId: task.costumeId })).code, api.CODE.BAD_REQUEST)
  const wrong = await vh02.completeActivityTask(s, { userId: 'me', taskId: task.id, evidence: { photoSelected: true } })
  assert.notEqual(wrong.code, 0)
  const done = await vh02.completeActivityTask(s, { userId: 'me', taskId: task.id, evidence: { photoSelected: true, coords: getAttraction(task.attractionId).geo } })
  assert.equal(done.code, 0)
  assert.ok(done.state.ownedItems.includes(task.costumeId))
  assert.equal((await vh02.completeActivityTask(done.state, { userId: 'me', taskId: task.id })).state.ownedItems.length, 1)
})

await test('核心任务的稍后、跳过、不感兴趣可恢复且不扣币', async () => {
  let s = baseState()
  for (const action of ['snooze', 'skip', 'not_interested', 'dismiss_today']) {
    const changed = await vh02.setCoreTaskAction(s, { userId: 'me', stepId: 'qz-1', action })
    assert.equal(changed.code, 0)
    assert.equal(balanceOf(changed.state.coinLedger), 0)
    const restored = await vh02.setCoreTaskAction(changed.state, { userId: 'me', stepId: 'qz-1', action: 'restore' })
    assert.equal(restored.state.coreTaskActions.length, 0)
    s = restored.state
  }
})

/* ================================================================ 八、词表 */

group('八、文案词表（防焦虑、防导流）')

await test('拦截焦虑词与导流词', () => {
  for (const bad of ['最后机会快来', '再不决定就过期作废', '加微信详聊', '支持返现']) {
    assert.equal(validateText(bad).ok, false, bad)
  }
})

await test('正常文案放行', () => {
  for (const good of ['一号坑军阵全景', '傍晚在城墙上看落日', '找一家开得久的小馆子']) {
    assert.equal(validateText(good).ok, true, good)
  }
})

await test('任务模板的标题与步骤本身不含被拦词', () => {
  for (const t of TASK_TEMPLATES) {
    assert.equal(validateText(t.title).ok, true, t.title)
    for (const s of t.steps) assert.equal(validateText(s).ok, true, s)
  }
})

/* ================================================================ 九、POI 派生 */

group('九、POI 派生（现有景点数据没有结构化 POI，需要兜底）')

await test('有 pois 字段的景点直接用自带数据', () => {
  const a = { id: 'x1', pois: [{ id: 'p1', name: '机位A', category: 'photo' }] }
  const list = derivePois(a)
  assert.equal(list.length, 1)
  assert.equal(list[0].source, 'curated')
})

await test('没有 pois 的景点能从亮点派生，且至少给出可选项目', () => {
  const list = derivePois(getAttraction('a1'))
  assert.ok(list.length > 0)
  assert.ok(list.every((x) => x.id && x.name && x.category))
})

await test('24 个景点都能派生（不会出现空清单的景点）', () => {
  const empty = attractions.filter((a) => derivePois(a).length === 0).map((a) => a.id)
  assert.deepEqual(empty, [])
})

/* ================================================================ 十、迁移 */

group('十、本地数据迁移')

await test('无数据时给出完整默认结构', () => {
  const s = migrateQuestState(null)
  assert.equal(s.schemaVersion, 4)
  assert.equal(s.preItems.length, 0)
  assert.ok(s.questPrefs.featureEnabled)
})

await test('旧数据（无 schemaVersion）可迁移并保留用户内容', () => {
  const old = { preItems: [preItem()], coinLedger: [{ delta: 30 }], userPets: [{ petId: 'pet-qizai' }] }
  const s = migrateQuestState(old)
  assert.equal(s.schemaVersion, 4)
  assert.equal(s.preItems.length, 1)
  assert.equal(balanceOf(s.coinLedger), 30)
  assert.deepEqual(s.userPets, [{ petId: 'pet-qizai' }])
  assert.equal(s.petLevels['pet-qizai'], undefined)
  assert.deepEqual(s.itemLevels, {})
})

await test('损坏数据不会让界面崩掉', () => {
  const s = migrateQuestState('这不是对象')
  assert.equal(s.preItems.length, 0)
})

/* ================================================================ 汇总 */

console.log(`\n${'─'.repeat(56)}`)
console.log(`通过 ${passed} 项，失败 ${failures.length} 项`)
if (failures.length) {
  console.log('\n失败明细：')
  for (const f of failures) console.log(`  · ${f.name}\n    ${f.err.stack?.split('\n')[1]?.trim() ?? f.err.message}`)
  process.exitCode = 1
} else {
  console.log('全部通过。')
}
