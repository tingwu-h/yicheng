/* ==========================================================================
   任务功能 · 全局状态
   --------------------------------------------------------------------------
   为什么单独一个 Provider：现有 AppContext 已经承担了登录/收藏/行程/发布/消息
   五块职责，把任务与萌宠继续塞进去会让它变成一个危险的巨型文件。
   这里独立成 QuestProvider，只做三件事：
     1. 持有 quest 状态并持久化（questStore）；
     2. 把 questApi 的纯函数调用包成「改状态 + 提示 + 登录引导」的动作；
     3. 按配置在合适的时机问一次引擎「要不要提醒」，最多拿回一张任务卡。

   非强迫原则在这一层的体现：
     - 未登录不产生任何卡片；
     - 关掉总开关后，连定时器都不再问引擎（不是靠界面隐藏）；
     - 出卡是「静默的」：只写一条站内消息，不弹 Toast、不抢占焦点。
   ========================================================================== */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import { useApp } from './AppContext'
import {
  INTERNAL_TEST_QUEST_LS_KEY,
  QUEST_LS_KEY,
  loadInternalTestQuestState,
  loadQuestState,
  saveQuestState,
  resetQuestState,
} from './questStore'
import * as localApi from '../services/questApi'
import * as localVh02 from '../services/vh02Api'
import { BACKEND_ENABLED, apiRequest, remoteActions, accountEpoch } from '../services/backendClient'
import { defaultQuestState } from './questStore'
import { DEFAULT_PREFS, QUEST_COPY, TASK_TEMPLATES } from '../data/questConfig'
import { PETS, getPet, petLine, itemsForPet, DEFAULT_PET_ID } from '../data/pets'
import { balanceOf, derivePois, dateKey } from './questEngine'
import { upgradePet as upgradePetState, upgradeCostume } from '../services/petUpgrade.js'

import { addCompanionGrowth, changeAppearance, levelOf } from '../services/petGrowth'
const api = remoteActions(localApi)
const vh02 = remoteActions(localVh02)
const growthApi = remoteActions({ upgradePet: upgradePetState, upgradeCostume, changeAppearance })

const QuestContext = createContext(null)

export const useQuest = () => {
  const ctx = useContext(QuestContext)
  if (!ctx) throw new Error('useQuest 必须在 QuestProvider 内使用')
  return ctx
}

/* 自动问引擎的间隔：一分钟一次，且只在页面可见、开关打开、已登录时进行 */
const TICK_MS = 60 * 1000

export function QuestProvider({ children }) {
  const { isLoggedIn, user, toast, requireLogin, pushNotif } = useApp()

  const storageKey = user?.isInternalTest ? INTERNAL_TEST_QUEST_LS_KEY : QUEST_LS_KEY
  const [quest, setQuest] = useState(() => BACKEND_ENABLED ? defaultQuestState() : user?.isInternalTest ? loadInternalTestQuestState() : loadQuestState())
  const [serverReady, setServerReady] = useState(!BACKEND_ENABLED)
  const [loadedStorageKey, setLoadedStorageKey] = useState(storageKey)
  const ref = useRef(quest)
  const busyRef = useRef(false)
  const transactionRef = useRef(Promise.resolve())

  const applyState = useCallback((next) => {
    ref.current = next
    setQuest(next)
  }, [])

  /* 切换本地演示身份时，任务库存按账号隔离，避免内测解锁污染普通演示数据。 */
  useEffect(() => {
    if (BACKEND_ENABLED) return
    if (loadedStorageKey === storageKey) return
    const next = user?.isInternalTest ? loadInternalTestQuestState() : loadQuestState(storageKey)
    ref.current = next
    setQuest(next)
    setLoadedStorageKey(storageKey)
  }, [loadedStorageKey, storageKey, user?.isInternalTest])

  /* 持久化：与 AppContext 相同策略，写失败不抛 */
  useEffect(() => {
    ref.current = quest
    if (!BACKEND_ENABLED && loadedStorageKey === storageKey) saveQuestState(quest, storageKey)
  }, [quest, loadedStorageKey, storageKey])

  useEffect(() => {
    if(!BACKEND_ENABLED) return
    let cancelled=false
    setServerReady(false); applyState(defaultQuestState())
    const refresh=async()=>{
      if(!user?.id) return
      try {
        const job=transactionRef.current.then(async()=>{
          if(cancelled) return
          const res=await apiRequest('/api/me/quest')
          if(!cancelled){applyState(res.state);setServerReady(true)}
        })
        transactionRef.current=job.catch(()=>{})
        await job
      }
      catch(e){if(!cancelled) toast(e.message,'warning')}
    }
    refresh()
    const onFocus=()=>{ if(!busyRef.current) refresh() }
    window.addEventListener('focus',onFocus)
    return ()=>{cancelled=true;window.removeEventListener('focus',onFocus)}
  },[user?.id,applyState,toast])

  /* 可选后台下发配置；后台未启动时使用随包静态配置，避免影响离线浏览。 */
  useEffect(() => {
    let cancelled = false
    fetch('/api/vh02/config').then((r) => r.ok ? r.json() : null).then((config) => {
      if (!cancelled && config?.version === 'vh0.2' && Array.isArray(config.coreChains)) {
        const cap = Number(config.officialTaskConfig?.maxRemindersPerDay)
        const hours = config.officialTaskConfig?.quietHours
        applyState({ ...ref.current, officialConfig: config, questPrefs: {
          ...ref.current.questPrefs,
          maxPerDay: Number.isInteger(cap) ? Math.min(ref.current.questPrefs.maxPerDay, cap) : ref.current.questPrefs.maxPerDay,
          quietHours: Array.isArray(hours) && hours.length === 2 ? hours : ref.current.questPrefs.quietHours,
        } })
      }
      else if (!cancelled && ref.current.officialConfig) applyState({ ...ref.current, officialConfig: null })
    }).catch(() => { if (!cancelled && ref.current.officialConfig) applyState({ ...ref.current, officialConfig: null }) })
    return () => { cancelled = true }
  }, [applyState])

  /* 跨天清理：上次留下的任务卡属于昨天时，静默丢弃，不在新的一天里突然冒出来 */
  useEffect(() => {
    const today = dateKey(new Date())
    if (ref.current.activeTask && ref.current.activeTask.dateKey !== today) {
      applyState({ ...ref.current, activeTask: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const prefs = useMemo(() => ({ ...DEFAULT_PREFS, ...quest.questPrefs }), [quest.questPrefs])

  /* ======================================================================
     统一调用包装：一次改动 = 一次状态替换 + 可选提示
     ====================================================================== */

  const call = useCallback(
    async (fn, { okToast = false, errToast = true } = {}) => {
      const epoch = accountEpoch()
      const execute = async () => {
      if(BACKEND_ENABLED && (!user?.id || !serverReady || epoch !== accountEpoch())) {
        const res={code:401,message:user?.id?'账号数据仍在加载，请稍后重试':'登录后才能保存任务和领取奖励'}
        if(errToast) toast(res.message,'warning')
        return res
      }
      const before = ref.current
      const res = await fn(before)
      if(BACKEND_ENABLED && epoch !== accountEpoch()) return {code:409,message:'账号已切换，请重新操作'}
      if (res.state) {
        if (!BACKEND_ENABLED && res.code === 0) res.state = addCompanionGrowth(before, res.state, user?.id)
        applyState(res.state)
      }
      if (res.code !== 0) {
        if (errToast) toast(res.message, 'warning')
        return res
      }
      if (okToast && res.message && res.message !== 'ok') toast(res.message, 'success')
      return res
      }
      const pending = transactionRef.current.then(execute, execute)
      transactionRef.current = pending.catch(() => {})
      return pending
    },
    [applyState, toast, user?.id, serverReady]
  )

  /* ======================================================================
     一、用户预录项目
     ====================================================================== */

  const preItems = quest.preItems
  const userId = user?.id ?? null

  const preItemsOf = useCallback(
    (attractionId) => preItems.filter((x) => x.attractionId === attractionId),
    [preItems]
  )

  const addPreItem = useCallback(
    async (attractionId, payload) => {
      if (!requireLogin('登录后可记录想玩的项目，并在合适的时间收到提醒')) return null
      const res = await call(
        (s) => api.createPreItem(s, { userId, attractionId, ...payload }),
        { okToast: true }
      )
      return res.code === 0 ? res.data : null
    },
    [call, requireLogin, userId]
  )

  const updatePreItem = useCallback(
    (id, patch) => call((s) => api.updatePreItem(s, { userId, id, patch }), { okToast: true }),
    [call, userId]
  )

  const removePreItem = useCallback(
    (id) => call((s) => api.deletePreItem(s, { userId, id }), { okToast: true }),
    [call, userId]
  )

  const togglePreItemRemind = useCallback(
    (id, remindEnabled) => call((s) => api.updatePreItem(s, { userId, id, patch: { remindEnabled } })),
    [call, userId]
  )

  /* 景点可选项目：优先用景点自带的 pois，否则从亮点派生 */
  const poisFor = useCallback((attraction) => derivePois(attraction), [])

  /* ======================================================================
     二、任务卡
     ====================================================================== */

  const activeTask = quest.activeTask

  const completeTask = useCallback(
    async (taskId, verifyMethod = 'manual') => {
      const res = await call((s) => api.completeTask(s, { userId, taskId, verifyMethod }), {
        okToast: true,
      })
      return res
    },
    [call, userId]
  )

  const snoozeTask = useCallback(
    (taskId, minutes = 30) => call((s) => api.snoozeTask(s, { taskId, minutes }), { okToast: true }),
    [call]
  )

  const dismissToday = useCallback(
    (taskId) => call((s) => api.dismissToday(s, { taskId }), { okToast: true }),
    [call]
  )

  const notInterested = useCallback(
    (taskId, scope = 'template') => call((s) => api.notInterested(s, { taskId, scope }), { okToast: true }),
    [call]
  )

  const skipTask = useCallback((taskId) => call((s) => api.skipTask(s, { taskId }), { okToast: true }), [call])

  const restoreMuted = useCallback(
    (payload) => call((s) => api.restoreMuted(s, payload), { okToast: true }),
    [call]
  )

  /* 手动问一次：用于「现在给我一个建议」按钮与场景模拟器。
     允许传入一个时间（演示用），不传则用真实系统时间。 */
  const requestTask = useCallback(
    (now = new Date()) =>
      call((s) => api.nextTask(s, { userId, scene: ref.current.scene, now })),
    [call, userId]
  )

  /* ======================================================================
     三、偏好与开关
     ====================================================================== */

  const updatePrefs = useCallback(
    (patch) => call((s) => api.updatePrefs(s, { patch }), { okToast: true }),
    [call]
  )

  const scene = quest.scene
  const setScene = useCallback((patch) => call((s) => api.updateScene(s, { patch })), [call])

  /* ======================================================================
     四、金币
     ====================================================================== */

  const balance = useMemo(() => balanceOf(quest.coinLedger), [quest.coinLedger])
  const ledger = quest.coinLedger

  /* ======================================================================
     五、萌宠与装扮
     ====================================================================== */

  const activePet = useMemo(
    () => quest.userPets.some((p) => p.petId === quest.activePetId)
      ? getPet(quest.activePetId)
      : { id: null, name: '尚未解锁', species: '秦岭四宝', personality: '自由探索', skillLabel: '任务自愿参与', lines: { greet: '按自己的节奏逛西安。' } },
    [quest.activePetId, quest.userPets]
  )

  const unlockedPetIds = useMemo(() => quest.userPets.map((p) => p.petId), [quest.userPets])

  /* 界面渲染用的萌宠视图：解锁状态、拥有与穿戴情况都算好 */
  const petCatalog = useMemo(
    () =>
      PETS.map((p) => ({
        ...p,
        unlocked: unlockedPetIds.includes(p.id),
        active: quest.activePetId === p.id,
        loadout: quest.loadouts?.[p.id] ?? {},
        level: Math.max(1, Math.min(3, Number(quest.petLevels?.[p.id] ?? 1))),
        growth: Number(quest.petGrowth?.[p.id]) || 0,
        appearanceLevel: Math.min(levelOf(quest.petAppearanceLevels?.[p.id] ?? quest.petLevels?.[p.id]), levelOf(quest.petLevels?.[p.id])),
        levelInfo: p.upgradeLevels?.[Math.max(1, Math.min(3, Number(quest.petLevels?.[p.id] ?? 1))) - 1],
        items: itemsForPet(p.id).map((i) => ({
          ...i,
          owned: quest.ownedItems.includes(i.id),
          level: Math.max(1, Math.min(3, Number(quest.itemLevels?.[i.id] ?? 1))),
          appearanceLevel: Math.min(levelOf(quest.itemAppearanceLevels?.[i.id] ?? quest.itemLevels?.[i.id]), levelOf(quest.itemLevels?.[i.id])),
          equipped: (quest.loadouts?.[p.id] ?? {})[i.slot] === i.id,
        })),
      })),
    [unlockedPetIds, quest.activePetId, quest.loadouts, quest.ownedItems, quest.petLevels, quest.itemLevels, quest.petGrowth, quest.petAppearanceLevels, quest.itemAppearanceLevels]
  )

  const setAppearance = useCallback((kind,id,level) => call(s => growthApi.changeAppearance(s,{userId,kind,id,level}), {okToast:true}),[call,userId])

  const upgradePet = useCallback((petId) => call((s) => growthApi.upgradePet(s, { userId, petId }), { okToast: true }), [call, userId])

  const upgradeItem = useCallback((itemId) => call((s) => growthApi.upgradeCostume(s, { userId, itemId }), { okToast: true }), [call, userId])

  const unlockPet = useCallback(
    (petId) => call((s) => api.unlockPet(s, { userId, petId }), { okToast: true }),
    [call, userId]
  )

  const completeCoreStep = useCallback(
    (chainId, stepId, evidence) => call((s) => vh02.completeCoreStep(s, { userId, chainId, stepId, evidence }), { okToast: true }),
    [call, userId]
  )

  const setCoreTaskAction = useCallback(
    (stepId, action) => call((s) => vh02.setCoreTaskAction(s, { userId, stepId, action }), { okToast: true }),
    [call, userId]
  )

  const completeActivityTask = useCallback(
    (taskId, evidence) => call((s) => vh02.completeActivityTask(s, { userId, taskId, evidence }), { okToast: true }),
    [call, userId]
  )

  const completeItineraryTask = useCallback(
    (itinerary, taskId, evidence) => call((s) => vh02.completeItineraryTask(s, { userId, itinerary, taskId, evidence }), { okToast: true }),
    [call, userId]
  )

  const createCustomTask = useCallback(
    (payload) => call((s) => vh02.createCustomTask(s, { userId, ...payload }), { okToast: true }),
    [call, userId]
  )

  const completeCustomTask = useCallback(
    (taskId, evidence) => call((s) => vh02.completeCustomTask(s, { userId, taskId, evidence }), { okToast: true }),
    [call, userId]
  )

  const deleteCustomTask = useCallback(taskId => call(s => vh02.deleteCustomTask(s, { userId, taskId }), { okToast: true }), [call, userId])
  const completePublicTask = useCallback((taskId,evidence)=>call(async()=>{
    const epoch=accountEpoch()
    try{const result=await apiRequest('/api/tasks/public/complete',{method:'POST',body:{taskId,evidence}});return epoch===accountEpoch()?result:{code:409,message:'账号已切换'}}
    catch(e){return {code:e.status||503,message:e.message}}
  },{okToast:true}),[call])
  const reviewCustomTask = useCallback((taskId, approved, reason) => call(s => vh02.reviewCustomTask(s, { reviewerId: userId, isInternalTest: !!user?.isInternalTest, taskId, approved, reason }), { okToast: true }), [call, userId, user?.isInternalTest])
  const reviseCustomTask = useCallback((taskId, title) => call(s => vh02.reviseCustomTask(s, { userId, taskId, title }), { okToast: true }), [call, userId])

  const activatePet = useCallback(
    (petId) => call((s) => api.activatePet(s, { petId }), { okToast: true }),
    [call]
  )

  const buyItem = useCallback(
    (itemId) => call((s) => api.buyItem(s, { userId, itemId }), { okToast: true }),
    [call, userId]
  )

  const equipItem = useCallback(
    (petId, itemId) => call((s) => api.equipItem(s, { userId, petId, itemId }), { okToast: true }),
    [call, userId]
  )

  const unequipSlot = useCallback(
    (petId, slot) => call((s) => api.unequipSlot(s, { userId, petId, slot }), { okToast: true }),
    [call, userId]
  )

  /* 当前萌宠的话术 */
  const line = useCallback((key) => petLine(quest.activePetId, key), [quest.activePetId])

  /* ======================================================================
     六、自动提醒调度
     ----------------------------------------------------------------------
     只在「已登录 + 总开关开 + 提醒开 + 有清单项目」时问引擎；
     引擎自己还有安静时段、每日上限、冷却三道闸门。
     出卡后只推一条站内消息（静默），不弹窗、不抢焦点。
     ====================================================================== */

  const notifyTask = useCallback(
    (task, petLineText) => {
      pushNotif({
        kind: 'task',
        actor: null,
        text: petLineText || line(task.petLineKey),
        targetTitle: task.title,
        preview: task.condition,
        target: task.attractionId,
        to: '/tasks',
      })
    },
    [pushNotif, line]
  )

  const autoEnabled = isLoggedIn && serverReady && prefs.featureEnabled && prefs.remindEnabled && preItems.length > 0 && quest.officialConfig?.officialTaskConfig?.enabled !== false

  useEffect(() => {
    if (!autoEnabled) return undefined

    let cancelled = false

    const tick = async () => {
      if (cancelled) return
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (busyRef.current) return
      if (ref.current.activeTask) return

      busyRef.current = true
      try {
        const res = await call(s => api.nextTask(s, {
          userId: user?.id ?? null,
          scene: ref.current.scene,
          now: new Date(),
        }), {errToast:false})
        if (cancelled) return
        if (res.code === 0 && res.data?.reason === 'ok' && res.data.task) {
          notifyTask(res.data.task, res.data.petLine)
        }
      } catch {
        /* 调度失败静默处理：提醒功能不应该影响主流程 */
      } finally {
        busyRef.current = false
      }
    }

    tick()
    const id = setInterval(tick, TICK_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [autoEnabled, user?.id, call, notifyTask])

  /* ======================================================================
     七、维护动作
     ====================================================================== */

  const resetAll = useCallback(() => {
    if(BACKEND_ENABLED) {toast('线上金币和成长记录不可在浏览器重置','info');return}
    const fresh = resetQuestState(storageKey)
    applyState(fresh)
    toast('任务数据已重置（收藏、行程、账号不受影响）', 'info')
  }, [applyState, storageKey, toast])

  const value = useMemo(
    () => ({
      /* 状态 */
      quest,
      officialConfig: quest.officialConfig,
      prefs,
      scene,
      activeTask,
      balance,
      ledger,
      activePet,
      petCatalog,
      unlockedPetIds,
      events: quest.events,
      taskRecords: quest.taskRecords,
      coreProgress: quest.coreProgress,
      coreTaskActions: quest.coreTaskActions,
      activityProgress: quest.activityProgress,
      scenicStamps: quest.scenicStamps,
      itineraryTaskRecords: quest.itineraryTaskRecords,
      customTasks: quest.customTasks,
      customTaskRecords: quest.customTaskRecords,

      /* 预录项目 */
      preItems,
      preItemsOf,
      addPreItem,
      updatePreItem,
      removePreItem,
      togglePreItemRemind,
      poisFor,

      /* 任务 */
      requestTask,
      completeTask,
      snoozeTask,
      dismissToday,
      notInterested,
      skipTask,
      restoreMuted,
      updatePrefs,
      setScene,

      /* 萌宠 */
      unlockPet,
      completeCoreStep,
      setCoreTaskAction,
      completeActivityTask,
      completeItineraryTask,
      createCustomTask,
      completeCustomTask,
      deleteCustomTask,
      completePublicTask,
      reviewCustomTask,
      reviseCustomTask,
      activatePet,
      setAppearance,
      upgradePet,
      upgradeItem,
      buyItem,
      equipItem,
      unequipSlot,
      line,

      /* 维护 */
      resetAll,
    }),
    [
      quest,
      prefs,
      scene,
      activeTask,
      balance,
      ledger,
      activePet,
      petCatalog,
      unlockedPetIds,
      preItems,
      preItemsOf,
      addPreItem,
      updatePreItem,
      removePreItem,
      togglePreItemRemind,
      poisFor,
      requestTask,
      completeTask,
      snoozeTask,
      dismissToday,
      notInterested,
      skipTask,
      restoreMuted,
      updatePrefs,
      setScene,
      unlockPet,
      completeCoreStep,
      setCoreTaskAction,
      completeActivityTask,
      completeItineraryTask,
      createCustomTask,
      completeCustomTask,
      deleteCustomTask,
      completePublicTask,
      reviewCustomTask,
      reviseCustomTask,
      activatePet,
      setAppearance,
      upgradePet,
      upgradeItem,
      buyItem,
      equipItem,
      unequipSlot,
      line,
      resetAll,
    ]
  )

  return <QuestContext.Provider value={value}>{children}</QuestContext.Provider>
}

/* ==========================================================================
   小工具：给界面用的文案
   ========================================================================== */

/* 引擎不提醒的原因 → 一句人话（界面要如实告诉用户为什么安静） */
export const QUIET_REASON_TEXT = {
  'feature-off': '提醒功能已关闭',
  'remind-off': '提醒已暂停，清单与金币都还在',
  'no-pre-items': '清单还是空的，先记几个想玩的项目',
  'quiet-hours': '现在是安静时段（默认 22:00–08:00）',
  'daily-limit': '今天提醒的次数已经用完了',
  cooldown: '刚提醒过不久，过一会儿再说',
  'off-hours': '这个时间点暂不提醒',
  'no-candidate': '按当前场景，没有合适的提醒',
  'already-active': '有一张任务卡正在等你处理',
}

export const quietReasonText = (reason) => QUIET_REASON_TEXT[reason] ?? '暂时没有要提醒的'

export { QUEST_COPY, TASK_TEMPLATES }
