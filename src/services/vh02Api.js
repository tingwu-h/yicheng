import { CORE_CHAINS, ACTIVITY_TASKS, SCENIC_COSTUMES, VH02_POLICY } from '../data/vh02Config.js'
import { getAttraction } from '../data/attractions.js'
import { balanceOf, dateKey, validateText } from '../store/questEngine.js'

const ok = (state, data = null, message = 'ok') => ({ code: 0, message, data, state })
const fail = (message, state) => ({ code: 40001, message, data: null, state })
const iso = () => new Date().toISOString()
const key = () => Math.random().toString(36).slice(2, 10)
const reached = (records, id) => records.some((r) => r.stepId === id && r.status === 'completed')
const chainsOf = (state) => state.officialConfig?.coreChains ?? CORE_CHAINS
const activitiesOf = (state) => state.officialConfig?.activityTasks ?? ACTIVITY_TASKS
const enabled = (state) => state.officialConfig?.officialTaskConfig?.enabled !== false
const checkinRadius = (id) => ({ a3: 2200, a6: 1300, a15: 3000, a16: 3000, a23: 3000 }[id] ?? 1000)

function distanceMeters(a, b) {
  const rad = Math.PI / 180
  const dLat = (a.lat - b.lat) * rad
  const dLng = (a.lng - b.lng) * rad
  const z = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 12742000 * Math.asin(Math.sqrt(z))
}

export function verifyStep(step, evidence) {
  if (step.type === 'checkin') {
    const target = getAttraction(step.attractionId)?.geo
    const coords = evidence?.coords
    if (!target || !Number.isFinite(coords?.lat) || !Number.isFinite(coords?.lng)) return '到达任务需要允许定位；定位仅用于本次校验，不保存精确坐标'
    if (distanceMeters(target, coords) > checkinRadius(step.attractionId)) return '距离景点参考中心较远；请在安全开放区域重试'
  }
  if (step.type === 'photo' && evidence?.photoSelected !== true) return '请先选择照片预览；是否上传由你另行决定'
  if (['observe', 'answer'].includes(step.type) && !String(evidence?.answer ?? '').trim()) return '写一句自己的观察即可'
  return null
}

export async function completeCoreStep(state, { userId, chainId, stepId, evidence = {} } = {}) {
  if (!userId) return fail('请先登录', state)
  if (!enabled(state)) return fail('官方任务暂未开放，原有行程不受影响', state)
  const chain = chainsOf(state).find((x) => x.id === chainId)
  const index = chain?.steps.findIndex((x) => x.id === stepId) ?? -1
  if (index < 0) return fail('没有这项官方任务', state)
  if (reached(state.coreProgress, stepId)) return ok(state, { already: true }, '这一步已完成')
  if (index && !reached(state.coreProgress, chain.steps[index - 1].id)) return fail('先按顺序完成上一小步；也可以随时跳过整条任务链', state)
  const step = chain.steps[index]
  const error = verifyStep(step, evidence)
  if (error) return fail(error, state)
  const completedDays = new Set(state.coreProgress.filter((r) => chain.steps.some((x) => x.id === r.stepId) && r.status === 'completed').map((r) => r.day))
  if (index === chain.steps.length - 1 && completedDays.size === 1 && completedDays.has(dateKey(new Date()))) {
    return fail('这条任务链需分两天轻松完成；今天先到这里，之后再来即可', state)
  }
  const record = { stepId, chainId, status: 'completed', day: dateKey(new Date()), completedAt: iso(), verifyMethod: step.type === 'checkin' ? 'location' : step.type === 'photo' ? 'local_photo' : 'manual' }
  const coreProgress = [...state.coreProgress, record]
  const done = chain.steps.every((x) => reached(coreProgress, x.id))
  const alreadyOwned = state.userPets.some((x) => x.petId === chain.petId)
  const userPets = done && !alreadyOwned ? [...state.userPets, { petId: chain.petId, unlockedAt: iso(), source: chainId }] : state.userPets
  const ownedItems = done && !state.ownedItems.includes(chain.rewardCostumeId) ? [...state.ownedItems, chain.rewardCostumeId] : state.ownedItems
  const next = { ...state, coreProgress, userPets, ownedItems, activePetId: state.activePetId ?? (done ? chain.petId : null) }
  return ok(next, { done, petId: done ? chain.petId : null, costumeId: done ? chain.rewardCostumeId : null }, done ? '官方任务链完成，宠物与专属服饰已解锁' : '已记录这一步；不赶时间')
}

export async function setCoreTaskAction(state, { userId, stepId, action } = {}) {
  if (!userId) return fail('请先登录', state)
  if (!chainsOf(state).some((x) => x.steps.some((s) => s.id === stepId))) return fail('没有这项核心任务', state)
  if (!['snooze', 'skip', 'not_interested', 'dismiss_today', 'restore'].includes(action)) return fail('操作无效', state)
  const filtered = state.coreTaskActions.filter((x) => x.stepId !== stepId)
  const actions = action === 'restore' ? filtered : [...filtered, { stepId, action, at: iso(), until: action === 'snooze' ? new Date(Date.now() + 30 * 60000).toISOString() : null, day: dateKey(new Date()) }]
  return ok({ ...state, coreTaskActions: actions }, { stepId, action }, action === 'restore' ? '已恢复，随时可以继续' : '已记下你的选择，不会催促')
}

export async function completeActivityTask(state, { userId, taskId, evidence = {} } = {}) {
  if (!userId) return fail('请先登录', state)
  if (!enabled(state)) return fail('活动任务暂未开放', state)
  const task = activitiesOf(state).find((x) => x.id === taskId)
  if (!task) return fail('活动任务不存在', state)
  if (state.activityProgress.some((x) => x.taskId === taskId)) return ok(state, { already: true }, '活动任务已记录')
  const placeError = verifyStep({ type: 'checkin', attractionId: task.attractionId }, evidence)
  if (placeError) return fail(placeError, state)
  const error = verifyStep(task, evidence)
  if (error) return fail(error, state)
  return ok({ ...state,
    activityProgress: [...state.activityProgress, { taskId, completedAt: iso() }],
    ownedItems: [...new Set([...state.ownedItems, task.costumeId])],
  }, { costumeId: task.costumeId }, '活动完成，限定服饰已入图鉴')
}

/* 行程自动派生任务；不写入旧行程结构，删除景点即自然撤下未完成任务。 */
export function tasksForItinerary(itinerary) {
  return (itinerary?.days ?? []).flatMap((day, dayIndex) => (day.items ?? []).flatMap((item) => {
    const attraction = getAttraction(item.attractionId)
    if (!attraction) return []
    return ['checkin', 'photo'].map((type) => ({
      id: 'trip-' + day.date + '-' + attraction.id + '-' + type,
      dayIndex, date: day.date, attractionId: attraction.id, attractionName: attraction.name,
      type, title: type === 'checkin' ? '到达' + attraction.name : '拍一张' + attraction.name + '的风景',
      optional: true, skippable: true, coins: type === 'checkin' ? 2 : 3,
      coordinate: attraction.geo ?? null, coordinateAccuracy: '景点中心参考点，非内部精确打卡位',
    }))
  }))
}

function grantCoins(state, { userId, amount, reason, refId }) {
  if (state.coinLedger.some((x) => x.idempotencyKey === refId)) return state
  const entry = { id: 'coin-' + key(), userId, delta: amount, balanceAfter: balanceOf(state.coinLedger) + amount, reason, refType: 'task', refId, idempotencyKey: refId, createdAt: iso() }
  return { ...state, coinLedger: [entry, ...state.coinLedger] }
}

export async function completeItineraryTask(state, { userId, itinerary, taskId, evidence = {} } = {}) {
  if (!userId) return fail('请先登录', state)
  if (!enabled(state)) return fail('行程任务暂未开放', state)
  const task = tasksForItinerary(itinerary).find((x) => x.id === taskId)
  if (!task) return fail('该任务不在当前行程里', state)
  if (state.itineraryTaskRecords.some((x) => x.taskId === taskId)) return ok(state, { already: true }, '这项任务已经记录过')
  if (task.date !== dateKey(new Date())) return fail('请在行程当天完成；日期可在行程设置里调整', state)
  const error = verifyStep(task, evidence)
  if (error) return fail(error, state)
  const record = { taskId, attractionId: task.attractionId, type: task.type, completedAt: iso(), photoUploaded: false, visibility: 'private', verifyMethod: task.type === 'checkin' ? 'location' : 'local_photo' }
  let next = { ...state, itineraryTaskRecords: [...state.itineraryTaskRecords, record] }
  next = grantCoins(next, { userId, amount: task.coins, reason: 'itinerary_task', refId: taskId })
  /* 首次景点打卡确定性发放四只宠物的景点专属外观；未解锁宠物暂不能穿。 */
  if (!next.scenicStamps.includes(task.attractionId)) {
    const drops = SCENIC_COSTUMES.filter((x) => x.attractionId === task.attractionId).map((x) => x.id)
    next = { ...next, scenicStamps: [...next.scenicStamps, task.attractionId], ownedItems: [...new Set([...next.ownedItems, ...drops])] }
  }
  return ok(next, { coins: task.coins, scenicDrop: task.attractionId }, '任务完成，获得金币与景点纪念服饰')
}

export async function createCustomTask(state, { userId, attractionId, title, type = 'checkin' } = {}) {
  if (!userId) return fail('请先登录', state)
  if (!enabled(state)) return fail('自建任务暂未开放', state)
  if (!getAttraction(attractionId)) return fail('请选择项目内景点', state)
  if (!['checkin', 'photo'].includes(type)) return fail('任务类型无效', state)
  if (String(title ?? '').trim().length < 4 || String(title).trim().length > 60 || !validateText(title).ok) return fail('请填写 4–60 字的合适标题', state)
  const task = { id: 'custom-' + key(), userId, attractionId, title: String(title).trim(), type, visibility: 'private', status: 'private', createdAt: iso(), publicVerifiedCompletions: 0, creatorMilestonesPaid: [] }
  return ok({ ...state, customTasks: [...state.customTasks, task] }, task, '私有任务已保存，完成时可选择公开')
}

export async function completeCustomTask(state, { userId, taskId, evidence = {} } = {}) {
  if (!userId) return fail('请先登录', state)
  if (!enabled(state)) return fail('自建任务暂未开放', state)
  const task = state.customTasks.find((x) => x.id === taskId && x.userId === userId && !x.deletedAt)
  if (!task) return fail('未找到自己的任务', state)
  if (state.customTaskRecords.some((x) => x.taskId === taskId)) return ok(state, { already: true }, '任务已记录')
  if (task.type === 'photo' && !evidence.photoSelected) return fail('请先选择一张照片预览', state)
  if (task.type === 'checkin') {
    const error = verifyStep({ type: 'checkin', attractionId: task.attractionId }, evidence)
    if (error) return fail(error, state)
  }
  const today = dateKey(new Date())
  const privatePaidToday = state.customTaskRecords.filter((x) => x.day === today && x.coins > 0 && (!x.userId || x.userId === userId)).length
  const dailyLimit = state.officialConfig?.officialTaskConfig?.privateTaskDailyRewardLimit ?? VH02_POLICY.privateTaskDailyRewardLimit
  const coins = task.visibility === 'private' && privatePaidToday < dailyLimit ? 2 : 0
  const publish = evidence.publish === true
  const bonus = publish && coins > 0 ? 3 : 0
  const rec = { taskId, userId, day: today, completedAt: iso(), visibility: publish ? 'public' : task.visibility, coins, publicBonus: bonus, photoUploaded: false }
  let next = { ...state, customTaskRecords: [...state.customTaskRecords, rec] }
  if (coins) next = grantCoins(next, { userId, amount: coins, reason: 'private_custom_task', refId: taskId })
  if (publish) next = { ...next, customTasks: next.customTasks.map(t => t.id === taskId ? { ...t, visibility: 'public', status: 'pending_review', submittedAt: iso() } : t) }
  if (bonus) next = grantCoins(next, { userId, amount: bonus, reason: 'public_submission_bonus', refId: taskId + '-public-bonus' })
  if (publish) return ok(next, { coins, bonus, pendingReview: true }, `任务完成，已加入审核队列；获得 ${coins + bonus} 金币`)
  return ok(next, { coins }, coins ? '私有任务完成，获得 2 金币' : '任务已记录；公开任务奖励须通过审核与真实完成度结算')
}

export async function deleteCustomTask(state, { userId, taskId } = {}) {
  if (!userId) return fail('请先登录', state)
  const task = state.customTasks.find(t => t.id === taskId && t.userId === userId && !t.deletedAt)
  if (!task) return fail('未找到自己的任务', state)
  // Keep reward records and a tombstone so deleting never resets daily caps or idempotency.
  return ok({ ...state, customTasks: state.customTasks.map(t => t.id === taskId ? { ...t, deletedAt: iso() } : t) }, null, '任务已删除，历史金币记录保留')
}

export async function reviewCustomTask(state, { reviewerId, isInternalTest, taskId, approved, reason = '' } = {}) {
  if (!isInternalTest || !reviewerId) return fail('仅内测账号可以操作本机审核演示', state)
  const task = state.customTasks.find(t => t.id === taskId && t.status === 'pending_review' && !t.deletedAt)
  if (!task) return fail('没有待审核的任务', state)
  if (!approved && !reason.trim()) return fail('请填写未通过原因', state)
  return ok({ ...state, customTasks: state.customTasks.map(t => t.id === taskId ? { ...t, status: approved ? 'approved' : 'rejected', reviewReason: reason.trim(), reviewedBy: reviewerId, reviewedAt: iso() } : t) }, null, approved ? '本机审核通过' : '已记录未通过原因')
}

export async function reviseCustomTask(state, { userId, taskId, title } = {}) {
  const task = state.customTasks.find(t => t.id === taskId && t.userId === userId && t.status === 'rejected' && !t.deletedAt)
  if (!userId || !task) return fail('只能修改自己的未通过任务', state)
  if (String(title).trim().length < 4 || String(title).trim().length > 60 || !validateText(title).ok) return fail('请填写 4–60 字的合适标题', state)
  return ok({ ...state, customTasks: state.customTasks.map(t => t.id === taskId ? { ...t, title: title.trim(), status: 'pending_review', submittedAt: iso(), reviewReason: '' } : t) }, null, '已重新提交审核；不会重复发放金币')
}
