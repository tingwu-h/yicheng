import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext.jsx'
import { CORE_CHAINS, ACTIVITY_TASKS } from '../data/vh02Config.js'
import { getAttraction, attractions } from '../data/attractions.js'
import { tasksForItinerary } from '../services/vh02Api.js'
import { useQuest } from '../store/QuestContext.jsx'
import { dateKey } from '../store/questEngine.js'
import { Modal } from './ui.jsx'

const locate = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) return reject(new Error('浏览器不支持定位'))
  navigator.geolocation.getCurrentPosition(
    (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => reject(new Error('定位不可用；请在现场开启定位后重试')),
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
  )
})

export function PhotoPicker({ onSelect }) {
  const [preview, setPreview] = useState(null)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const choose = (file) => {
    if (preview) URL.revokeObjectURL(preview)
    const url = file?.type?.startsWith('image/') ? URL.createObjectURL(file) : null
    setPreview(url)
    onSelect(!!url)
  }
  return <div className="stack stack-2">
    <label className="small">选择照片（仅本机预览，不自动上传）<input type="file" accept="image/*" onChange={(e) => choose(e.target.files?.[0])} /></label>
    {preview && <img src={preview} alt="任务照片本机预览" style={{ maxWidth: 180, maxHeight: 120, objectFit: 'cover', borderRadius: 8 }} />}
    <span className="xs muted">照片仅在本机预览，不会自动上传或公开。选择照片属于本人确认，不等于图片已被人工审核。</span>
  </div>
}

export function CoreChainsPanel({ petId = null }) {
  const { coreProgress, coreTaskActions, petCatalog, completeCoreStep, setCoreTaskAction, officialConfig } = useQuest()
  const [answers, setAnswers] = useState({})
  const [photos, setPhotos] = useState({})
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const configuredChains = officialConfig?.coreChains ?? CORE_CHAINS
  const chains = petId ? configuredChains.filter((x) => x.petId === petId) : configuredChains
  const submit = async (chain, step) => {
    setBusy(step.id); setError('')
    try {
      const evidence = { answer: answers[step.id], photoSelected: !!photos[step.id] }
      if (step.type === 'checkin') evidence.coords = await locate()
      const result = await completeCoreStep(chain.id, step.id, evidence)
      if (result?.code !== 0) setError(result?.message ?? '暂未完成')
    } catch (e) { setError(e.message) }
    setBusy(null)
  }
  return <section className="stack stack-4" aria-label="萌宠获取指南">
        <div><h2 style={{ fontSize: 'var(--fs-h2)' }}>萌宠获取指南</h2><p className="small muted">跟着每只萌宠完成四个轻松步骤即可认识它；非强制、可跳过、不扣金币、不催促。景点打卡需要现场定位，精确位置不保存。</p></div>
    {error && <p role="alert" className="small" style={{ color: 'var(--cinnabar-700)' }}>{error}</p>}
    {chains.map((chain) => {
      const pet = petCatalog.find((x) => x.id === chain.petId)
      const count = chain.steps.filter((x) => coreProgress.some((r) => r.stepId === x.id && r.status === 'completed')).length
      return <div className="card card-pad" key={chain.id}>
        <h3 className="card-title">{chain.title} · {count}/{chain.steps.length} {pet?.unlocked ? '· 宠物已拥有' : ''}</h3>
        <p className="xs muted">奖励：{pet?.name}与专属服饰。每步可选择稍后或跳过；跳过仅停止本次，不计完成。</p>
        <div className="stack stack-3" style={{ marginTop: 14 }}>
          {chain.steps.map((step, i) => {
            const done = coreProgress.some((r) => r.stepId === step.id && r.status === 'completed')
            const previous = i === 0 || coreProgress.some((r) => r.stepId === chain.steps[i - 1].id && r.status === 'completed')
            const action = coreTaskActions.find((x) => x.stepId === step.id &&
              (x.action === 'snooze' ? new Date(x.until) > new Date() : x.action === 'dismiss_today' ? x.day === dateKey(new Date()) : true))
            return <div key={step.id} className="item-row">
              <div className="grow"><strong>{i + 1}. {step.title}</strong> <span className="xs muted">{getAttraction(step.attractionId)?.name}</span><p className="small muted">{step.instruction}</p>
                {!done && previous && action && <p className="xs muted">{({ snooze: '稍后再说', skip: '已跳过本次', not_interested: '已标记不感兴趣', dismiss_today: '今天不再提醒' })[action.action]} · <button className="btn btn-ghost btn-sm" onClick={() => setCoreTaskAction(step.id, 'restore')}>恢复</button></p>}
                {!done && previous && ['observe', 'answer'].includes(step.type) && <input aria-label={step.title + '的观察'} placeholder="写一句即可" value={answers[step.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [step.id]: e.target.value })} />}
                {!done && previous && step.type === 'photo' && <PhotoPicker onSelect={(yes) => setPhotos((old) => ({ ...old, [step.id]: yes }))} />}
                {!done && previous && !action && <div className="row row-2 wrap" style={{ marginTop: 6 }}>{[['snooze', '稍后'], ['skip', '跳过'], ['not_interested', '不感兴趣'], ['dismiss_today', '今天不再提醒']].map(([key, label]) => <button key={key} className="btn btn-ghost btn-sm" onClick={() => setCoreTaskAction(step.id, key)}>{label}</button>)}</div>}
              </div>
              {done ? <span className="tag tag-gold">完成</span> : <button className="btn btn-secondary btn-sm" disabled={!previous || !!action || busy === step.id} onClick={() => submit(chain, step)}>{step.type === 'checkin' ? '现场打卡' : '完成这一步'}</button>}
            </div>
          })}
        </div>
      </div>
    })}
  </section>
}

export function TripTasksPanel({ itinerary, attractionId = null, dayIndex = null, detailed = false, sharedRecords = [] }) {
  const { itineraryTaskRecords, completeItineraryTask } = useQuest()
  const [photos, setPhotos] = useState({})
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const tasks = tasksForItinerary(itinerary).filter((x) => (!attractionId || x.attractionId === attractionId) && (dayIndex === null || x.dayIndex === dayIndex))
  const submit = async (task) => {
    setBusy(task.id); setError('')
    try {
      const evidence = { photoSelected: !!photos[task.id] }
      if (task.type === 'checkin') evidence.coords = await locate()
      const result = await completeItineraryTask(itinerary, task.id, evidence)
      if (result?.code !== 0) setError(result?.message ?? '暂未完成')
    } catch (e) { setError(e.message) }
    setBusy(null)
  }
  const today = dateKey()
  return <section className="card card-pad" style={{ marginTop: 'var(--sp-5)' }}>
    <h3 className="card-title">行程内自愿任务</h3>
    <p className="small muted">按行程景点自动生成打卡、拍照任务；只在行程当天完成。同一任务一次，拍照默认不上传。首次完成该景点任务确定性获得四款对应景点服饰，宠物解锁后即可穿戴。</p>
    {error && <p role="alert" style={{ color: 'var(--cinnabar-700)' }}>{error}</p>}
    {!tasks.length && <p className="small muted">先在行程中加入景点，就会在这里看到任务。</p>}
    <div className="stack stack-3" style={{ marginTop: 12 }}>{tasks.map((task) => {
      const done = itineraryTaskRecords.some((r) => r.taskId === task.id) || sharedRecords.some(r=>r.taskId===task.id)
      const available = task.date === today
      return <div key={task.id} className={`item-row ${detailed ? 'task-detail-row' : ''}`}><div className="grow"><strong>{task.title}</strong><p className="xs muted">{task.date} · {task.coins} 金币 · 非强制 · {task.coordinateAccuracy}</p>
        {detailed && <p className="small muted">{task.type === 'checkin' ? '完成条件：行程当天到达景点附近，允许浏览器定位后现场打卡。定位只用于即时校验。' : '完成条件：行程当天选择一张本地照片并确认；默认仅在本机预览，不自动上传或公开。'} 每项仅能完成一次，可不做。</p>}
        {!done && available && task.type === 'photo' && <PhotoPicker onSelect={(yes) => setPhotos((old) => ({ ...old, [task.id]: yes }))} />}
      </div>{done ? <span className="tag tag-gold">已完成</span> : <button className="btn btn-secondary btn-sm" disabled={busy === task.id || !available} onClick={() => submit(task)}>{available ? (task.type === 'checkin' ? '现场打卡' : '确认完成') : task.date < today ? '已过安排日' : '当天可完成'}</button>}</div>
    })}</div>
  </section>
}

export function ActivityTasksPanel() {
  const { activityProgress, completeActivityTask, officialConfig } = useQuest()
  const [answers, setAnswers] = useState({})
  const [photos, setPhotos] = useState({})
  const [error, setError] = useState('')
  const submit = async (task) => {
    try {
      const coords = await locate()
      const result = await completeActivityTask(task.id, { coords, answer: answers[task.id], photoSelected: !!photos[task.id] })
      setError(result?.code === 0 ? '' : result?.message ?? '暂未完成')
    } catch (e) { setError(e.message) }
  }
  return <section className="card card-pad" style={{ marginTop: 'var(--sp-5)' }}>
    <h2 className="card-title">活动限定服饰</h2>
    <p className="small muted">在对应景点附近自愿观察或拍照，现场定位后领取秦岭主题冠饰；不加属性，不可金币购买。照片不会自动上传。</p>
    {error && <p role="alert" style={{ color: 'var(--cinnabar-700)' }}>{error}</p>}
    <div className="stack stack-3" style={{ marginTop: 12 }}>{(officialConfig?.activityTasks ?? ACTIVITY_TASKS).map((task) => {
      const done = activityProgress.some((x) => x.taskId === task.id)
      return <div className="item-row" key={task.id}><div className="grow"><strong>{task.title}</strong><p className="xs muted">{getAttraction(task.attractionId)?.name} · {task.instruction}</p>
        {!done && task.type === 'photo' && <PhotoPicker onSelect={(yes) => setPhotos((old) => ({ ...old, [task.id]: yes }))} />}
        {!done && task.type === 'observe' && <input aria-label={task.title + '观察'} placeholder="写一句即可" value={answers[task.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [task.id]: e.target.value })} />}
      </div>{done ? <span className="tag tag-gold">已领取</span> : <button className="btn btn-secondary btn-sm" onClick={() => submit(task)}>领取服饰</button>}</div>
    })}</div>
  </section>
}

export function CustomTasksPanel({ attractionId = null }) {
  const { user } = useApp()
  const navigate = useNavigate()
  const { customTasks, customTaskRecords, createCustomTask, completeCustomTask, deleteCustomTask } = useQuest()
  const [place, setPlace] = useState(attractionId ?? attractions[0].id)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('checkin')
  const [photos, setPhotos] = useState({})
  const [error, setError] = useState('')
  const [publishTask, setPublishTask] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const save = async (e) => {
    e.preventDefault(); setError('')
    const result = await createCustomTask({ attractionId: attractionId ?? place, title, type })
    if (result?.code === 0) setTitle('')
    else setError(result?.message ?? '保存失败')
  }
  const submit = async (task, publish) => {
    setError(''); setBusy(true)
    try {
      const evidence = { photoSelected: !!photos[task.id] }
      if (task.type === 'checkin') evidence.coords = await locate()
      const result = await completeCustomTask(task.id, { ...evidence, publish })
      if (result?.code !== 0) setError(result?.message ?? '暂未完成')
      else { setPublishTask(null); if (publish) navigate('/tasks?tab=review') }
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <section className="card card-pad" style={{ marginTop: 'var(--sp-5)' }}>
    <h3 className="card-title">自建任务</h3>
    <p className="small muted">先记下自己的小任务，完成时再决定是否公开。每日前两项完成奖励 2 金币，选择公开再加 3 金币；超出后仍可记录。只公开任务文字，不上传照片。</p>
    <form onSubmit={save} className="row row-2 wrap" style={{ marginTop: 12 }}>
      {!attractionId && <select aria-label="任务景点" value={place} onChange={(e) => setPlace(e.target.value)}>{attractions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
      <input aria-label="自建任务标题" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：寻找一处喜欢的屋檐" minLength={4} maxLength={60} required />
      <select aria-label="任务类型" value={type} onChange={(e) => setType(e.target.value)}><option value="checkin">现场打卡</option><option value="photo">拍照</option></select>
      <button className="btn btn-primary btn-sm" type="submit">保存任务</button>
    </form>
    {error && <p role="alert" style={{ color: 'var(--cinnabar-700)' }}>{error}</p>}
    <div className="stack stack-2 custom-task-list" style={{ marginTop: 14 }}>{customTasks.filter((x) => x.userId === user?.id && !x.deletedAt && (!attractionId || x.attractionId === attractionId)).map((task) => {
      const done = customTaskRecords.some((x) => x.taskId === task.id)
      return <div className="item-row" key={task.id}><div className="grow"><strong>{task.title}</strong><p className="xs muted">{getAttraction(task.attractionId)?.name} · {task.status === 'pending_review' ? '审核中' : task.status === 'approved' ? '已公开' : '私有'}</p>
        {!done && task.type === 'photo' && <PhotoPicker onSelect={(yes) => setPhotos((old) => ({ ...old, [task.id]: yes }))} />}
      </div><div className="task-review-actions">{done ? <span className="tag tag-gold">已记录</span> : <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setPublishTask(task) }}>完成</button>}<button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => setDeleting(task)}>删除</button></div></div>
    })}</div>
    <Link className="xs" to="/pets">查看景点专属服饰 →</Link>
    {publishTask && <Modal title="完成后愿意公开这条任务吗？" onClose={() => !busy && setPublishTask(null)} footer={<><button disabled={busy} className="btn btn-secondary" onClick={() => submit(publishTask, false)}>仅自己记录</button><button disabled={busy} className="btn btn-primary" onClick={() => submit(publishTask, true)}>{busy ? '正在校验…' : '愿意公开并提交审核'}</button></>}><div className="review-choice"><strong>{publishTask.title}</strong><p className="small">校验完成条件后记录任务。每日奖励额度内，公开提交额外获得 3 金币；通过审核后才展示任务文字。照片保持私有。</p></div>{error && <p role="alert">{error}</p>}</Modal>}
    {deleting && <Modal title="确定删除这条自建任务？" onClose={() => setDeleting(null)} footer={<><button className="btn btn-secondary" onClick={() => setDeleting(null)}>取消</button><button className="btn btn-primary" onClick={async () => { await deleteCustomTask(deleting.id); setDeleting(null) }}>确定删除</button></>}><p>{deleting.title}</p><p className="small muted">已获得的金币和完成流水保留，删除不会重置每日奖励额度。</p></Modal>}
  </section>
}
