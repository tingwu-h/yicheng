/* ==========================================================================
   任务功能 · 本地持久化层
   --------------------------------------------------------------------------
   对应 docs/quest/SCHEMA.md 里的 8 个集合与 docs/quest/migrations/001_quest.sql。
   本项目无数据库，这里用 localStorage 承担「一张库」的角色：
   - 独立于 AppContext 的键（changan-banlv-quest-v1），不动既有的
     changan-banlv-state-v1，避免破坏现有收藏/行程/草稿数据；
   - 带 schemaVersion 与 migrate()，将来接后端时这一层整体换成 fetch 即可。

   注意：这里只做读写与版本迁移，不含业务规则（规则在 questEngine.js）。
   ========================================================================== */

import { DEFAULT_PREFS, QUEST_CONFIG_VERSION } from '../data/questConfig.js'
import { PETS, PET_ITEMS } from '../data/pets.js'
import { ACTIVITY_TASKS, CORE_CHAINS } from '../data/vh02Config.js'

export const QUEST_LS_KEY = 'changan-banlv-quest-v1'
export const INTERNAL_TEST_QUEST_LS_KEY = 'changan-banlv-quest-internal-test-vh03'
export const INTERNAL_TEST_FIXTURE_VERSION = 'vh0.3-full-inventory-2'
export const QUEST_SCHEMA_VERSION = 4

/* 全新用户无默认宠物；旧用户已有宠物在 v1 → v2 迁移中保留。 */
export function defaultQuestState() {
  return {
    schemaVersion: QUEST_SCHEMA_VERSION,
    configVersion: QUEST_CONFIG_VERSION,
    officialConfig: null,

    /* 用户预录项目 */
    preItems: [],

    /* 任务记录（下发与完成都记在这里） */
    taskRecords: [],

    /* 金币流水（只有任务完成是正向来源） */
    coinLedger: [],

    /* 已解锁萌宠 */
    userPets: [],
    petLevels: {},
    petGrowth: {},
    petGrowthLedger: [],
    petAppearanceLevels: {},
    itemAppearanceLevels: {},
    itemLevels: {},
    activePetId: null,
    coreProgress: [],
    coreTaskActions: [],
    activityProgress: [],
    scenicStamps: [],
    itineraryTaskRecords: [],
    customTasks: [],
    customTaskRecords: [],

    /* 已购买装扮与各萌宠的穿搭 */
    ownedItems: [],
    loadouts: {},

    /* 偏好与开关 */
    questPrefs: { ...DEFAULT_PREFS, surfaceCounts: {} },

    /* 埋点事件（演示版只落地在本地，见 docs/quest/EVENTS.md） */
    events: [],

    /* 场景模拟器的最近一次设置，便于演示连续 */
    scene: {
      atAttractionId: null,
      region: null,
      weather: '晴',
      queueKey: 'normal',
      queueWaitMin: 15,
      visitMinutes: 0,
      companions: null,
      demoHour: null, // 演示用时间，仅手动请求时生效
    },

    /* 当前正在展示的任务卡（持久化可避免刷新后重复计数） */
    activeTask: null,
  }
}

/* 补齐缺失字段：老数据、手工改过的数据都能读起来 */
function withDefaults(raw) {
  const base = defaultQuestState()
  if (!raw || typeof raw !== 'object') return base
  return {
    ...base,
    ...raw,
    questPrefs: {
      ...base.questPrefs,
      ...(raw.questPrefs ?? {}),
      surfaceCounts: { ...(raw.questPrefs?.surfaceCounts ?? {}) },
    },
    scene: { ...base.scene, ...(raw.scene ?? {}) },
    officialConfig: raw.officialConfig && typeof raw.officialConfig === 'object' ? raw.officialConfig : null,
    preItems: Array.isArray(raw.preItems) ? raw.preItems : [],
    taskRecords: Array.isArray(raw.taskRecords) ? raw.taskRecords : [],
    coinLedger: Array.isArray(raw.coinLedger) ? raw.coinLedger : [],
    userPets: Array.isArray(raw.userPets) ? raw.userPets : base.userPets,
    petLevels: raw.petLevels && typeof raw.petLevels === 'object' ? raw.petLevels : {},
    itemLevels: raw.itemLevels && typeof raw.itemLevels === 'object' ? raw.itemLevels : {},
    petGrowth: raw.petGrowth && typeof raw.petGrowth === 'object' ? raw.petGrowth : {},
    petGrowthLedger: Array.isArray(raw.petGrowthLedger) ? raw.petGrowthLedger : [],
    petAppearanceLevels: raw.petAppearanceLevels && typeof raw.petAppearanceLevels === 'object' ? raw.petAppearanceLevels : {},
    itemAppearanceLevels: raw.itemAppearanceLevels && typeof raw.itemAppearanceLevels === 'object' ? raw.itemAppearanceLevels : {},
    coreProgress: Array.isArray(raw.coreProgress) ? raw.coreProgress : [],
    coreTaskActions: Array.isArray(raw.coreTaskActions) ? raw.coreTaskActions : [],
    activityProgress: Array.isArray(raw.activityProgress) ? raw.activityProgress : [],
    scenicStamps: Array.isArray(raw.scenicStamps) ? raw.scenicStamps : [],
    itineraryTaskRecords: Array.isArray(raw.itineraryTaskRecords) ? raw.itineraryTaskRecords : [],
    customTasks: Array.isArray(raw.customTasks) ? raw.customTasks : [],
    customTaskRecords: Array.isArray(raw.customTaskRecords) ? raw.customTaskRecords : [],
    ownedItems: Array.isArray(raw.ownedItems) ? raw.ownedItems : [],
    loadouts: raw.loadouts && typeof raw.loadouts === 'object' ? raw.loadouts : {},
    events: Array.isArray(raw.events) ? raw.events : [],
  }
}

/**
 * 版本迁移。
 * v0 → v1 保留原始数据；v1 → v2 补齐核心链、景点印章与自建任务字段；
 * v2 → v3 增加宠物与服饰等级，不覆盖既有库存、任务或金币流水。
 * 将来加字段时在这里追加分支，不要直接改上面的默认值结构。
 */
export function migrateQuestState(raw) {
  if (!raw || typeof raw !== 'object') return defaultQuestState()

  let state = raw
  const from = Number(state.schemaVersion ?? 0)

  if (from < 1) {
    state = withDefaults({ ...state, schemaVersion: 1 })
  }

  if (from < 2) state = withDefaults({ ...state, schemaVersion: 2 })

  if (from < 3) state = withDefaults({ ...state, schemaVersion: 3 })

  if (from < 4) state = withDefaults({ ...state, schemaVersion: 4 })

  /* 版本高于当前代码时不做降级，只补缺字段，保证不丢用户数据 */
  state = withDefaults(state)
  state.schemaVersion = Math.max(from, QUEST_SCHEMA_VERSION)
  state.configVersion = QUEST_CONFIG_VERSION
  return state
}

export function loadQuestState(storageKey = QUEST_LS_KEY) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return defaultQuestState()
    return migrateQuestState(JSON.parse(raw))
  } catch {
    /* 隐私模式或数据损坏：退回默认值，保证界面可用 */
    return defaultQuestState()
  }
}

export function saveQuestState(state, storageKey = QUEST_LS_KEY) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    /* 写入失败不抛出：与 AppContext 的既有处理保持一致 */
  }
}

/* 仅用于设置页的「重置任务数据」，需要用户二次确认 */
export function resetQuestState(storageKey = QUEST_LS_KEY) {
  try {
    localStorage.removeItem(storageKey)
  } catch {
    /* 忽略 */
  }
  return defaultQuestState()
}

export function makeInternalTestQuestState() {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const previousDay = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  const timestamp = now.toISOString()
  const loadouts = Object.fromEntries(PETS.map((pet) => {
    const hat = PET_ITEMS.find((item) => item.petId === pet.id && item.slot === 'hat')
    const back = PET_ITEMS.find((item) => item.petId === pet.id && item.acquisition === 'core')
    return [pet.id, {
      outfit: 'it-tang',
      ...(hat ? { hat: hat.id } : {}),
      ...(back ? { back: back.id } : {}),
    }]
  }))

  return {
    ...defaultQuestState(),
    testFixtureVersion: INTERNAL_TEST_FIXTURE_VERSION,
    userPets: PETS.map((pet) => ({ petId: pet.id, unlockedAt: timestamp, source: 'internal_test_fixture' })),
    activePetId: PETS[0]?.id ?? null,
    coreProgress: CORE_CHAINS.flatMap((chain) => chain.steps.map((step, index) => ({
      stepId: step.id,
      chainId: chain.id,
      status: 'completed',
      day: index < 2 ? previousDay : today,
      completedAt: timestamp,
      verifyMethod: 'internal_test_fixture',
    }))),
    activityProgress: ACTIVITY_TASKS.map((task) => ({ taskId: task.id, completedAt: timestamp })),
    scenicStamps: [...new Set(PET_ITEMS.filter((item) => item.attractionId).map((item) => item.attractionId))],
    ownedItems: PET_ITEMS.map((item) => item.id),
    petLevels: Object.fromEntries(PETS.map((pet) => [pet.id, 3])),
    itemLevels: Object.fromEntries(PET_ITEMS.map((item) => [item.id, 3])),
    loadouts,
    coinLedger: [{
      id: 'internal-test-balance-vh03',
      userId: 'internal-test-vh03',
      delta: 9999,
      balanceAfter: 9999,
      reason: '内测账号测试余额（非真实金币）',
      refType: 'test_fixture',
      refId: INTERNAL_TEST_FIXTURE_VERSION,
      idempotencyKey: INTERNAL_TEST_FIXTURE_VERSION,
      createdAt: timestamp,
    }],
  }
}

export function loadInternalTestQuestState() {
  const state = loadQuestState(INTERNAL_TEST_QUEST_LS_KEY)
  if (state.testFixtureVersion === INTERNAL_TEST_FIXTURE_VERSION) return state
  const fixture = makeInternalTestQuestState()
  saveQuestState(fixture, INTERNAL_TEST_QUEST_LS_KEY)
  return fixture
}
