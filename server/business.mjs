import * as quest from '../src/services/questApi.js'
import * as tasks from '../src/services/vh02Api.js'
import { upgradePet, upgradeCostume } from '../src/services/petUpgrade.js'
import { addCompanionGrowth, changeAppearance } from '../src/services/petGrowth.js'
import { defaultQuestState } from '../src/store/questStore.js'
import { CORE_CHAINS, ACTIVITY_TASKS, VH02_POLICY, SCENIC_COSTUMES } from '../src/data/vh02Config.js'
import { PETS, PET_ITEMS } from '../src/data/pets.js'
import { getAttraction } from '../src/data/attractions.js'
import { balanceOf, dateKey } from '../src/store/questEngine.js'
import { getDocument, putDocument } from './database.mjs'
import { insist, id } from './security.mjs'

export const defaults = { coreChains: CORE_CHAINS, activityTasks: ACTIVITY_TASKS, officialTaskConfig: {
  version: 'vh0.2', enabled: true, maxRemindersPerDay: 2, quietHours: [22, 8], privateTaskDailyRewardLimit: 2,
  publicCreatorMilestones: VH02_POLICY.publicCreatorMilestones,
} }
export function config(db) {
  const values = Object.fromEntries(Object.entries(defaults).map(([key,value]) => {
    const row = db.prepare('SELECT body FROM official_config WHERE key=?').get(key)
    return [key, row ? JSON.parse(row.body) : value]
  }))
  return { version: 'vh0.2', policy: VH02_POLICY, petDefinitions: PETS, costumeDefinitions: PET_ITEMS,
    scenicCostumeCount: SCENIC_COSTUMES.length, ...values }
}
const short = (s, max = 120) => typeof s === 'string' && s.length > 0 && s.length <= max
const date = s => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s ?? '') && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s
export function validateConfig(key, value) {
  insist(Object.hasOwn(defaults, key), 404, '没有这项配置')
  if (key === 'coreChains') {
    insist(Array.isArray(value) && value.length === 4 && new Set(value.map(x=>x.petId)).size === 4, 400, '必须保留四种萌宠')
    const stepIds = new Set(), chainIds = new Set()
    for (const c of value) {
      insist(short(c.id) && !chainIds.has(c.id) && PETS.some(p=>p.id===c.petId) &&
        PET_ITEMS.some(i=>i.id===c.rewardCostumeId && i.petId===c.petId && i.acquisition==='core') &&
        Array.isArray(c.steps) && c.steps.length >= 3 && c.steps.length <= 5, 400, '任务链或专属奖励不合规则')
      chainIds.add(c.id)
      for (const s of c.steps) {
        insist(short(s.id) && !stepIds.has(s.id) && short(s.title) && s.optional === true && s.skippable === true &&
          getAttraction(s.attractionId) && ['checkin','photo','observe','answer'].includes(s.type), 400, '任务需有独立编号、有效景点，并且非强制可跳过')
        stepIds.add(s.id)
      }
    }
  } else if (key === 'activityTasks') {
    insist(Array.isArray(value) && value.length <= 200 && new Set(value.map(x=>x.id)).size === value.length, 400, '活动配置格式不正确')
    for (const t of value) insist(short(t.id) && short(t.title) && getAttraction(t.attractionId) &&
      ['checkin','photo','observe','answer'].includes(t.type) && PET_ITEMS.some(i=>i.id===t.costumeId && i.acquisition==='activity'), 400, '活动仅能奖励活动限定服饰')
  } else {
    insist(value && value.version === 'vh0.2' && typeof value.enabled === 'boolean' &&
      Number.isInteger(value.maxRemindersPerDay) && value.maxRemindersPerDay >= 0 && value.maxRemindersPerDay <= 5 &&
      Number.isInteger(value.privateTaskDailyRewardLimit) && value.privateTaskDailyRewardLimit >= 0 && value.privateTaskDailyRewardLimit <= 5 &&
      Array.isArray(value.quietHours) && value.quietHours.length === 2 && value.quietHours.every(x=>Number.isInteger(x)&&x>=0&&x<=23), 400, '提醒频率、免打扰或每日奖励上限不正确')
  }
  if (key==='officialTaskConfig') {
    const milestones=value.publicCreatorMilestones??VH02_POLICY.publicCreatorMilestones
    insist(Array.isArray(milestones)&&milestones.length<=5&&milestones.every(m=>Number.isInteger(m.completions)&&m.completions>=5&&Number.isInteger(m.coins)&&m.coins>=0&&m.coins<=20)&&new Set(milestones.map(m=>m.completions)).size===milestones.length,400,'创作者奖励需为不重复的完成量门槛，每档最多 20 金币')
  }
  insist(JSON.stringify(value).length <= 180000, 400, '配置过大')
  return value
}

export function validateTrip(trip) {
  insist(trip && short(trip.id) && short(trip.title, 80) && date(trip.startDate) && Array.isArray(trip.days) && trip.days.length >= 1 && trip.days.length <= 30, 400, '行程需填写标题、日期，最多安排 30 天')
  const dayKeys = new Set()
  for (const d of trip.days) {
    insist(date(d.date) && !dayKeys.has(d.date) && Array.isArray(d.items) && d.items.length <= 30, 400, '行程日期不能重复，每天最多安排 30 个景点')
    dayKeys.add(d.date)
    for (const item of d.items) insist(short(item.id) && getAttraction(item.attractionId) &&
      (item.note == null || typeof item.note === 'string' && item.note.length <= 1000) &&
      (item.time == null || item.time === '' || /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(item.time)), 400, '行程景点、时间或备注不正确')
  }
  return { id: trip.id, title: trip.title, startDate: trip.startDate, companions: ['solo','couple','family','friends'].includes(trip.companions) ? trip.companions : 'solo',
    days: trip.days.map(d=>({date:d.date,items:d.items.map(i=>({id:i.id,attractionId:i.attractionId,time:i.time??'09:00',note:i.note??''}))})),
    updatedAt: new Date().toISOString(), ...(trip.createdAt ? {createdAt:trip.createdAt} : {}) }
}
export function cleanAppDocument(body) {
  const p = body.profile ?? {}
  const profile = { name: String(p.name ?? '').trim().slice(0,32), bio: String(p.bio ?? '').slice(0,500), region: String(p.region ?? '西安').slice(0,50) }
  // Existing custom avatar editor uses inline JPEG data; never allow arbitrary URLs or SVG.
  if (p.avatarImage != null) {
    insist(p.avatarImage === '' || new RegExp('^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$').test(p.avatarImage) && p.avatarImage.length <= 250000, 400, '头像仅支持压缩后的 JPEG、PNG 或 WebP 图片')
    profile.avatarImage = p.avatarImage
  }
  const list = key => { insist(Array.isArray(body[key] ?? []) && (body[key]??[]).length <= 300, 400, '收藏列表过长'); return [...new Set((body[key]??[]).filter(x=>short(x)))] }
  const trips = body.savedTrips ?? []
  insist(Array.isArray(trips) && trips.length <= 50 && new Set(trips.map(t=>t.id)).size === trips.length, 400, '最多保存 50 份不重复的行程')
  let avatarId = /^av-([1-9]|[12][0-9]|30)$/.test(body.avatarId ?? '') ? body.avatarId : 'av-1'
  if (body.avatarId && typeof body.avatarId === 'object') {
    const a = body.avatarId
    if(a.photoDataUrl) {
      insist(typeof a.photoDataUrl==='string' && a.photoDataUrl.length<=250000 && new RegExp('^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$').test(a.photoDataUrl),400,'请选择压缩后的图片头像')
      avatarId={photoDataUrl:a.photoDataUrl,photo:true}
    } else {
      insist(['hat','armor','face','color'].every(k=>typeof a[k]==='string'&&a[k].length<=32),400,'自定义形象参数不正确')
      avatarId={hat:a.hat,armor:a.armor,face:a.face,color:a.color}
    }
  }
  return { profile, avatarId,
    savedAttractions: list('savedAttractions').filter(getAttraction), savedPosts: list('savedPosts'), likedPosts: list('likedPosts'),
    itinerary: body.itinerary ? validateTrip(body.itinerary) : null, savedTrips: trips.map(validateTrip) }
}

export function questState(db, userId) {
  return { ...getDocument(db,userId,'quest',defaultQuestState()).data, officialConfig: config(db) }
}
export function saveQuest(db, userId, state) {
  insist(Number.isSafeInteger(balanceOf(state.coinLedger)) && balanceOf(state.coinLedger) >= 0, 409, '金币校验失败，请重试')
  for (const entry of state.coinLedger) {
    insist(Number.isSafeInteger(entry.delta), 409, '金币记录无效')
    const ref = entry.idempotencyKey || entry.id
    db.prepare('INSERT OR IGNORE INTO coin_ledger VALUES (?,?,?,?,?,?)').run(userId,entry.id,entry.delta,ref,JSON.stringify(entry),entry.createdAt)
  }
  const total = db.prepare('SELECT COALESCE(SUM(delta),0) AS n FROM coin_ledger WHERE user_id=?').get(userId).n
  insist(total === balanceOf(state.coinLedger), 409, '金币重复结算已拦截')
  for (const task of state.customTasks) {
    db.prepare('INSERT INTO task_submissions VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,body=excluded.body,updated_at=excluded.updated_at')
      .run(task.id,userId,task.deletedAt ? 'deleted' : task.status,JSON.stringify(task),new Date().toISOString())
  }
  const stored = {...state, officialConfig:null}
  putDocument(db,userId,'quest',stored)
}

const actions = {
  createPreItem: quest.createPreItem, updatePreItem: quest.updatePreItem, deletePreItem: quest.deletePreItem,
  nextTask: quest.nextTask, completeTask: quest.completeTask, snoozeTask: quest.snoozeTask, dismissToday: quest.dismissToday,
  notInterested: quest.notInterested, skipTask: quest.skipTask, restoreMuted: quest.restoreMuted, updatePrefs: quest.updatePrefs, updateScene: quest.updateScene,
  unlockPet: quest.unlockPet, activatePet: quest.activatePet, buyItem: quest.buyItem, equipItem: quest.equipItem, unequipSlot: quest.unequipSlot,
  completeCoreStep: tasks.completeCoreStep, setCoreTaskAction: tasks.setCoreTaskAction, completeActivityTask: tasks.completeActivityTask,
  completeItineraryTask: tasks.completeItineraryTask, createCustomTask: tasks.createCustomTask, completeCustomTask: tasks.completeCustomTask,
  deleteCustomTask: tasks.deleteCustomTask, reviseCustomTask: tasks.reviseCustomTask, upgradePet, upgradeCostume, changeAppearance,
}
const pick = (source, keys) => Object.fromEntries(keys.filter(k=>Object.hasOwn(source??{},k)).map(k=>[k,source[k]]))
const allowedScene = ['atAttractionId','region','weather','queueKey','queueWaitMin','visitMinutes','companions']
function evidence(e = {}) {
  insist(typeof e === 'object' && !Array.isArray(e),400,'完成信息格式不正确')
  const result = {answer:String(e.answer??'').slice(0,500),photoSelected:e.photoSelected===true,publish:e.publish===true}
  if (e.coords) {
    insist(Number.isFinite(e.coords.lat)&&Math.abs(e.coords.lat)<=90&&Number.isFinite(e.coords.lng)&&Math.abs(e.coords.lng)<=180,400,'定位数据无效')
    result.coords={lat:e.coords.lat,lng:e.coords.lng}
  }
  // photoSelected is a voluntary self-report, not a verified upload. No photo is required to leave the device.
  return result
}
export function completePublicTask(db,userId,taskId,input={}) {
  const row=db.prepare('SELECT * FROM task_submissions WHERE id=? AND status=?').get(taskId,'approved')
  insist(row,404,'这项任务尚未公开或已经下线')
  insist(row.user_id!==userId,400,'自己的任务请在自建任务列表完成，不计入大众完成度')
  const current=questState(db,userId), policy=current.officialConfig.officialTaskConfig
  insist(policy.enabled,409,'任务暂未开放')
  if(db.prepare('SELECT 1 FROM public_task_completions WHERE task_id=? AND user_id=?').get(taskId,userId))return {code:0,message:'已经记录过这项任务',state:current,data:{already:true}}
  const task=JSON.parse(row.body),proof=evidence(input.evidence),error=tasks.verifyStep(task,proof)
  insist(!error,400,error)
  const today=dateKey(new Date()),paid=current.customTaskRecords.filter(r=>r.day===today&&r.coins>0).length
  const coins=paid<policy.privateTaskDailyRewardLimit?2:0,createdAt=new Date().toISOString()
  const grant=(state,owner,delta,key,reason)=>{
    if(!delta||state.coinLedger.some(e=>e.idempotencyKey===key))return
    state.coinLedger.push({id:id('coin-'),userId:owner,delta,balanceAfter:balanceOf(state.coinLedger)+delta,idempotencyKey:key,refId:taskId,refType:'task',reason,createdAt})
  }
  const before=structuredClone(current)
  current.customTaskRecords.push({taskId,userId,day:today,coins,completedAt:createdAt,attractionId:task.attractionId,source:'public_task',verifyMethod:task.type==='checkin'?'location':'manual_photo_confirmation'})
  grant(current,userId,coins,'public-complete:'+taskId,'public_task_completion')
  db.prepare('INSERT INTO public_task_completions VALUES (?,?,?)').run(taskId,userId,createdAt)
  const count=db.prepare('SELECT COUNT(*) AS n FROM public_task_completions WHERE task_id=?').get(taskId).n
  const creator=questState(db,row.user_id),entry=creator.customTasks.find(t=>t.id===taskId)
  insist(entry&&!entry.deletedAt,409,'作者已经删除任务')
  entry.publicVerifiedCompletions=count;entry.creatorMilestonesPaid??=[]
  for(const m of policy.publicCreatorMilestones??VH02_POLICY.publicCreatorMilestones) {
    if(count>=m.completions&&!entry.creatorMilestonesPaid.includes(m.completions)){
      grant(creator,row.user_id,m.coins,'creator:'+taskId+':'+m.completions,'public_creator_milestone');entry.creatorMilestonesPaid.push(m.completions)
    }
  }
  const grown=addCompanionGrowth(before,current,userId)
  saveQuest(db,userId,grown);saveQuest(db,row.user_id,creator)
  return {code:0,message:coins?'任务已记录，获得 2 金币':'任务已记录，今天的奖励额度已用完',state:grown,data:{coins,completions:count}}
}
export async function executeQuest(db, userId, action, input = {}) {
  insist(Object.hasOwn(actions,action),404,'没有这项任务操作')
  insist(input && typeof input==='object' && !Array.isArray(input),400,'操作参数无效')
  for (const field of ['state','coinLedger','userPets','ownedItems','templates','reward','coins','isInternalTest']) insist(!(field in input),400,'奖励与身份只能由服务器确定')
  const before=questState(db,userId)
  const body={...pick(input,['id','name','attractionId','poiId','category','priority','timeSlot','note','remindEnabled','taskId','minutes','scope','templateId','petId','itemId','slot','chainId','stepId','action','title','type','kind','level']),userId}
  if (input.evidence) body.evidence=evidence(input.evidence)
  if (action==='createPreItem') insist(before.preItems.length<200,400,'预录项目已达上限，请先整理')
  if (action==='createCustomTask') insist(before.customTasks.filter(t=>!t.deletedAt).length<300,400,'自建任务已达上限，请先整理')
  if (action==='updatePreItem') body.patch=pick(input.patch,['name','category','priority','timeSlot','note','remindEnabled'])
  if (action==='updateScene') { body.patch=pick(input.patch,allowedScene); body.patch.demoHour=null }
  if (action==='nextTask') {
    body.now=new Date(); body.scene={...before.scene,demoHour:null}
    before.questPrefs.maxPerDay=Math.min(Number(before.questPrefs.maxPerDay)||0,before.officialConfig.officialTaskConfig.maxRemindersPerDay)
    insist(before.officialConfig.officialTaskConfig.enabled,409,'任务暂未开放，仍可自由游览')
  }
  if (action==='updatePrefs') {
    body.patch=pick(input.patch,['featureEnabled','remindEnabled','allowLocation','showSafetyTip','maxPerDay','cooldownMin','quietHours','mutedCategories','mutedTemplates','maxSurfacesPerTemplate'])
    for (const k of ['featureEnabled','remindEnabled','allowLocation','showSafetyTip']) if (k in body.patch) insist(typeof body.patch[k]==='boolean',400,'开关格式不正确')
    for (const k of ['maxPerDay','cooldownMin','maxSurfacesPerTemplate']) if (k in body.patch) insist(Number.isInteger(body.patch[k]) && body.patch[k]>=0 && body.patch[k]<=1440,400,'提醒频率不正确')
    if ('maxPerDay' in body.patch) body.patch.maxPerDay=Math.min(body.patch.maxPerDay,before.officialConfig.officialTaskConfig.maxRemindersPerDay)
    if ('quietHours' in body.patch) insist(Array.isArray(body.patch.quietHours)&&body.patch.quietHours.length===2&&body.patch.quietHours.every(v=>Number.isInteger(v)&&v>=0&&v<=23),400,'免打扰时间不正确')
    for (const k of ['mutedCategories','mutedTemplates']) if (k in body.patch) insist(Array.isArray(body.patch[k])&&body.patch[k].length<=200&&body.patch[k].every(v=>short(v)),400,'屏蔽列表不正确')
  }
  if (action==='snoozeTask') body.minutes=Math.max(5,Math.min(1440,Number(input.minutes)||30))
  if (action==='completeTask') {
    const record=before.taskRecords.find(r=>r.id===body.taskId)
    insist(record?.dateKey===dateKey(new Date()),409,'这张任务卡已过期，请领取今天的任务')
    body.verifyMethod='manual' // Never trust a client-provided location/scan verification label.
  }
  if (action==='completeItineraryTask') {
    const doc=getDocument(db,userId,'app').data
    const tripId=input.itinerary?.id || input.tripId
    body.itinerary=(doc.savedTrips??[]).find(t=>t.id===tripId)
    const active=db.prepare(`SELECT j.body FROM journeys j JOIN journey_members m ON m.journey_id=j.id WHERE m.user_id=? AND j.status='active'`).get(userId)
    if (active && JSON.parse(active.body).trip.id===tripId) body.itinerary=JSON.parse(active.body).trip
    insist(body.itinerary,404,'请先保存行程或加入同行小队，再完成任务')
  }
  const result=await actions[action](before,body)
  if (result.code===0 && result.state) {
    result.state=addCompanionGrowth(before,result.state,userId)
    saveQuest(db,userId,result.state)
  }
  return result
}
