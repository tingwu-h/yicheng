/* ==========================================================================
   任务触发引擎（纯逻辑，无副作用）
   --------------------------------------------------------------------------
   为什么单独一层：本项目无后端，将来接后端时这套规则要么整体搬到服务端，
   要么保留在前端。做成纯函数的好处是——
   1. 所有规则的输入输出都在参数里，可以直接用 node 跑断言（见 tools/quest-selftest.mjs）；
   2. 不依赖 React、不依赖 localStorage，搬迁成本低。

   本文件内的相对导入带 .js 后缀，是为了同时兼容 Vite 与 node 直接执行；
   项目其余文件沿用既有的无后缀写法，未做统一改动。

   一条硬规则贯穿全文件：引擎只负责「要不要提醒」和「提醒哪一个」，
   永远不产生任何负向结果（不扣币、不降权、不记录失败）。
   ========================================================================== */

import {
  DEFAULT_PREFS,
  DIFFICULTY_COINS,
  PRIORITIES,
  TIME_SLOT_HOURS,
  findBlockedWord,
} from '../data/questConfig.js'

/* ==========================================================================
   一、时间工具（统一用本地时区，不用 toISOString 的 UTC 日期）
   ========================================================================== */

const pad2 = (n) => String(n).padStart(2, '0')

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function minutesOfDay(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes()
}

/* 22:00–08:00 这类跨零点区间的判断 */
export function inQuietHours(minutes, quietHours = DEFAULT_PREFS.quietHours) {
  const [start, end] = quietHours
  const s = start * 60
  const e = end * 60
  if (s === e) return false
  return s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e
}

/* 小时 → 时段名；返回 null 表示不在可提醒的白天/夜间时段内 */
export function slotOfHour(hour) {
  const found = Object.entries(TIME_SLOT_HOURS).find(
    ([, [from, to]]) => hour >= from && hour < to
  )
  return found ? found[0] : null
}

/* ==========================================================================
   二、场景上下文
   --------------------------------------------------------------------------
   演示环境没有真实定位与排队数据，上下文由「场景模拟器」给出（见 Quests 页）。
   将来接入真实数据时，只需换成同一形状的对象即可，引擎无需改动。
   ========================================================================== */

export function buildContext({ now = new Date(), scene = {} } = {}) {
  const minutes = minutesOfDay(now)
  const hour = now.getHours()
  return {
    now,
    dateKey: dateKey(now),
    minutes,
    hour,
    slot: slotOfHour(hour),
    /* 以下三项来自场景模拟器 */
    atAttractionId: scene.atAttractionId ?? null,
    region: scene.region ?? null,
    weather: scene.weather ?? '晴',
    queueWaitMin: scene.queueWaitMin ?? 0,
    visitMinutes: scene.visitMinutes ?? 0,
    companions: scene.companions ?? null,
    /* 模拟位置标记：界面上必须如实标注，不能暗示这是真实定位 */
    simulated: true,
  }
}

/* ==========================================================================
   三、触发条件匹配
   ========================================================================== */

export function triggerMatches(tpl, ctx, preItem) {
  const t = tpl.trigger
  if (!t) return false
  const p = t.params ?? {}

  switch (t.type) {
    case 'time':
      if (!ctx.slot) return false
      return (p.slots ?? []).includes(ctx.slot)

    case 'location':
      /* 需要「人已经到了这个景点」，且该预录项目属于这个景点 */
      if (!ctx.atAttractionId || !preItem) return false
      return preItem.attractionId === ctx.atAttractionId

    case 'weather':
      return (p.kinds ?? []).includes(ctx.weather)

    case 'queue':
      return ctx.queueWaitMin >= (p.minWaitMin ?? 0)

    case 'duration':
      return ctx.visitMinutes >= (p.minMinutes ?? 0)

    default:
      return false
  }
}

/* 该模板能不能匹配到这个预录项目上 */
function templateFitsPreItem(tpl, preItem) {
  const cats = tpl.preCategories ?? []
  if (!cats.length) return true // 通用任务：不依赖具体项目
  if (!preItem) return false
  return cats.includes(preItem.category)
}

/* ==========================================================================
   四、打扰闸门
   --------------------------------------------------------------------------
   依次判断，命中任何一条都不再生成任务卡。
   返回 null 表示放行；返回字符串是「为什么安静」的原因，用于界面说明。
   ========================================================================== */

export function gateReason({ prefs = {}, records = [], preItems = [], ctx }) {
  const p = { ...DEFAULT_PREFS, ...prefs }

  if (!p.featureEnabled) return 'feature-off'
  if (!p.remindEnabled) return 'remind-off'
  if (!preItems.length) return 'no-pre-items'
  if (inQuietHours(ctx.minutes, p.quietHours)) return 'quiet-hours'

  const today = records.filter((r) => r.dateKey === ctx.dateKey)
  const served = today.filter((r) => r.surfacedAt && r.state !== 'notInterested')
  if (served.length >= p.maxPerDay) return 'daily-limit'

  if (p.cooldownMin > 0) {
    const last = records
      .filter((r) => r.surfacedAt)
      .sort((a, b) => (a.surfacedAt < b.surfacedAt ? 1 : -1))[0]
    if (last?.surfacedAt) {
      const gap = (ctx.now.getTime() - new Date(last.surfacedAt).getTime()) / 60000
      if (gap >= 0 && gap < p.cooldownMin) return 'cooldown'
    }
  }

  if (!ctx.slot) return 'off-hours'
  return null
}

/* ==========================================================================
   五、打分与挑选（每次最多 1 个主任务）
   ========================================================================== */

const TRIGGER_WEIGHT = { location: 8, queue: 7, weather: 7, duration: 5, time: 3 }

/* 萌宠擅长方向与任务类别的对应，命中加一点权重（不做强制） */
const PET_SKILL_MATCH = {
  photo: ['photo'],
  游玩: ['sight', 'activity'],
  休息与吃食: ['rest', 'food'],
  鼓励: ['sight', 'record', 'prepare'],
}

function scoreOf(tpl, ctx, preItem, prefs, pet) {
  const prio = PRIORITIES.find((x) => x.key === (preItem?.priority ?? 'mid'))
  let score = (prio?.weight ?? 2) * 10

  score += TRIGGER_WEIGHT[tpl.trigger?.type] ?? 1

  const petCats = PET_SKILL_MATCH[pet?.skill] ?? []
  if (petCats.includes(tpl.category)) score += 4

  const surfaces = (prefs.surfaceCounts ?? {})[tpl.id] ?? 0
  score -= surfaces * 3

  if (preItem?.remindEnabled === false) score -= 20

  return score
}

/* 同一模板在当天/历史上是否已经出现过、完成过、被拒绝过 */
function templateBlocked(tpl, records, ctx, prefs) {
  const p = { ...DEFAULT_PREFS, ...prefs }
  if (!tpl.enabled) return true
  if ((p.mutedTemplates ?? []).includes(tpl.id)) return true
  if ((p.mutedCategories ?? []).includes(tpl.category)) return true

  const surfaces = (p.surfaceCounts ?? {})[tpl.id] ?? 0
  if (surfaces >= p.maxSurfacesPerTemplate) return true

  const sameDay = records.filter((r) => r.templateId === tpl.id && r.dateKey === ctx.dateKey)
  if (sameDay.some((r) => r.state === 'dismissedToday')) return true
  if (sameDay.some((r) => r.state === 'completed')) return true
  if (sameDay.some((r) => r.state === 'snoozed' && r.snoozeUntil && new Date(r.snoozeUntil) > ctx.now))
    return true
  return false
}

/**
 * 挑选下一个任务卡。
 * @returns {{template, preItem, score, coins, petLineKey, reason}} | null
 */
export function pickNextTask({
  templates = [],
  preItems = [],
  records = [],
  prefs = {},
  ctx,
  pet = null,
} = {}) {
  const p = { ...DEFAULT_PREFS, ...prefs }
  const blocked = gateReason({ prefs: p, records, preItems, ctx })
  if (blocked) return { template: null, reason: blocked }

  const candidates = []

  for (const tpl of templates) {
    if (templateBlocked(tpl, records, ctx, p)) continue

    const fits = preItems
      /* 用户对单个项目关掉提醒后，它就不参与触发（不是降权，是直接不打扰） */
      .filter((it) => templateFitsPreItem(tpl, it) && it.remindEnabled !== false)
      .sort((a, b) => {
        const wa = PRIORITIES.find((x) => x.key === a.priority)?.weight ?? 2
        const wb = PRIORITIES.find((x) => x.key === b.priority)?.weight ?? 2
        return wb - wa
      })

    /* 通用任务（preCategories 为空）不需要匹配具体项目；其余必须匹配上 */
    const needsItem = (tpl.preCategories ?? []).length > 0
    if (needsItem && !fits.length) continue

    const fallbackItems = needsItem ? fits : [null, ...fits]
    let matched = null
    for (const it of fallbackItems) {
      if (triggerMatches(tpl, ctx, it)) {
        matched = it
        break
      }
    }
    if (!matched && needsItem) continue
    if (!matched && !needsItem && !triggerMatches(tpl, ctx, null)) continue

    candidates.push({
      template: tpl,
      preItem: matched,
      score: scoreOf(tpl, ctx, matched, p, pet),
    })
  }

  if (!candidates.length) return { template: null, reason: 'no-candidate' }

  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]

  return {
    template: best.template,
    preItem: best.preItem,
    score: best.score,
    coins: coinsFor(best.template),
    petLineKey: best.template.petLineKey,
    reason: 'ok',
  }
}

/* ==========================================================================
   六、金币
   ========================================================================== */

export function coinsFor(tpl) {
  return DIFFICULTY_COINS[tpl?.difficulty] ?? DIFFICULTY_COINS.easy
}

export function balanceOf(ledger = []) {
  return ledger.reduce((sum, e) => sum + (e.delta ?? 0), 0)
}

/* 幂等键：同一用户 + 同一模板 + 同一天，只能发一次币 */
export function idempotencyKey(userId, templateId, dateKeyStr) {
  return `task:${userId}:${templateId}:${dateKeyStr}`
}

export function alreadyGranted(ledger, key) {
  return ledger.some((e) => e.idempotencyKey === key)
}

/* ==========================================================================
   七、文本校验
   --------------------------------------------------------------------------
   用于预录项目的自定义名称、以及任务卡话术出卡前的兜底检查：
   命中焦虑词/导流词一律拦截，避免出现「限时」「赶紧」「加微信」这类内容。
   ========================================================================== */

export function validateText(text) {
  const hit = findBlockedWord(text)
  return hit ? { ok: false, hit } : { ok: true, hit: null }
}

/* ==========================================================================
   八、POI 派生
   --------------------------------------------------------------------------
   现有 24 个景点的数据里没有结构化的 POI 子项，只有 highlights / tips 文本。
   为了避免「预录项目无从选择」，这里做一次启发式派生：
   - 景点若自带了 pois 字段（试点景点已补），直接用；
   - 否则从 highlights 派生「想玩/想拍」，从 tips / bestTime 派生「想体验」；
   派生结果只作为可选建议，用户在界面上可以自己改名。
   ========================================================================== */

const PHOTO_HINT = /(拍|机位|视角|全景|光|景|倒影|日落|夜景)/
const ACTIVITY_HINT = /(演出|讲解|体验|导览|手作|拓印|索道|乘|船|骑行|表演|温泉)/
const FOOD_HINT = /(吃|食|面|泡馍|凉皮|肉夹|小吃|茶|甜品|餐)/

export function derivePois(attraction) {
  if (!attraction) return []
  if (Array.isArray(attraction.pois) && attraction.pois.length) {
    return attraction.pois.map((p, i) => ({
      id: p.id ?? `${attraction.id}-poi-${i + 1}`,
      name: p.name,
      category: p.category ?? 'spot',
      note: p.note ?? '',
      source: 'curated',
    }))
  }

  const out = []
  const push = (name, category, note) => {
    const id = `${attraction.id}-d${out.length + 1}`
    if (out.some((x) => x.name === name)) return
    out.push({ id, name, category, note, source: 'derived' })
  }

  for (const h of attraction.highlights ?? []) {
    if (PHOTO_HINT.test(h)) push(h, 'photo', '来自景点亮点的拍照建议')
    else if (ACTIVITY_HINT.test(h)) push(h, 'activity', '来自景点亮点的体验建议')
    else if (FOOD_HINT.test(h)) push(h, 'food', '来自景点亮点的吃食建议')
    else push(h, 'spot', '来自景点亮点')
  }

  for (const t of attraction.tips ?? []) {
    if (ACTIVITY_HINT.test(t)) push(t, 'activity', '来自实用提醒')
    else if (FOOD_HINT.test(t)) push(t, 'food', '来自实用提醒')
  }

  if (attraction.bestTime) push(attraction.bestTime, 'photo', '来自最佳时段建议')

  return out
}
