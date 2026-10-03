import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Breadcrumb, Modal } from '../components/ui'
import { attractions, getAttraction } from '../data/attractions'
import { CORE_CHAINS, ACTIVITY_TASKS } from '../data/vh02Config'
import { TASK_TEMPLATES } from '../data/questConfig'
import { useQuest } from '../store/QuestContext'
import { useApp } from '../store/AppContext'
import { CustomTasksPanel, CoreChainsPanel, ActivityTasksPanel, PhotoPicker } from '../components/Vh02TaskPanels'
import { BACKEND_ENABLED, apiRequest } from '../services/backendClient'
const labels = { private: '仅自己', pending_review: '审核中', approved: '已公开', rejected: '未通过' }

export default function TaskCenter() {
  const { customTasks, coreProgress, activityProgress, itineraryTaskRecords, customTaskRecords, taskRecords, officialConfig, prefs, updatePrefs, reviewCustomTask, reviseCustomTask, completePublicTask } = useQuest()
  const { user, requireLogin } = useApp()
  const [publicSelected,setPublicSelected]=useState(null),[photoSelected,setPhotoSelected]=useState(false),[publicBusy,setPublicBusy]=useState(false),[publicError,setPublicError]=useState('')
  const finishPublic=async()=>{
    setPublicBusy(true);setPublicError('')
    try{
      const evidence={photoSelected}
      if(publicSelected.type==='checkin') evidence.coords=await new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error('浏览器不支持定位'));navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),()=>reject(new Error('定位不可用，可以稍后再做')),{timeout:12000})})
      const result=await completePublicTask(publicSelected.id,evidence);if(result.code===0)setPublicSelected(null);else setPublicError(result.message)
    }catch(e){setPublicError(e.message)}finally{setPublicBusy(false)}
  }
  const [publicTasks,setPublicTasks]=useState([])
  useEffect(()=>{if(!BACKEND_ENABLED)return;let alive=true;apiRequest('/api/tasks/public').then(r=>{if(alive)setPublicTasks(r.tasks)}).catch(()=>{});return()=>{alive=false}},[customTasks])
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'system'
  const [place, setPlace] = useState('all'), [query, setQuery] = useState(''), [review, setReview] = useState(null), [reason, setReason] = useState(''), [edit, setEdit] = useState(null), [title, setTitle] = useState('')
  const chains = officialConfig?.coreChains ?? CORE_CHAINS, activities = officialConfig?.activityTasks ?? ACTIVITY_TASKS
  const system = [
    ...attractions.flatMap(a => ['checkin','photo'].map(type => ({ id: `${a.id}-${type}`, title: type === 'photo' ? `拍一张${a.name}的风景` : `到达${a.name}`, attractionId: a.id, reward: type === 'photo' ? '3 金币 + 景点纪念服饰（首次）' : '2 金币 + 景点纪念服饰（首次）', detail: type === 'photo' ? '加入行程，在安排当天选择本机照片确认完成。' : '加入行程，在安排当天到景点附近定位打卡。', to: `/attraction/${a.id}`, state: itineraryTaskRecords.some(r => r.attractionId === a.id && r.type === type) ? '已有完成记录' : '可加入行程' }))),
    ...chains.flatMap(c => c.steps.map(s => ({ ...s, reward: '顺序完成整条指南：萌宠与专属服饰', detail: s.instruction, to: '/tasks?tab=guide', state: coreProgress.some(r => r.stepId === s.id && r.status === 'completed') ? '已完成' : '萌宠获取指南' }))),
    ...activities.map(s => ({ ...s, reward: '限定服饰', detail: s.instruction, to: '/tasks?tab=activity', state: activityProgress.some(r => r.taskId === s.id) ? '已完成' : '活动任务' })),
    ...TASK_TEMPLATES.filter(t => t.enabled).map(t => ({ ...t, reward: '按任务难度结算金币', detail: `${t.desc} 完成条件：${t.condition}`, state: '游玩提醒模板', to: '/tasks?tab=prefs' })),
  ]
  const visible = [...customTasks,...publicTasks.filter(p=>!customTasks.some(t=>t.id===p.id))].filter(t => !t.deletedAt && (t.userId === user?.id || t.status === 'approved'))
  const queue = customTasks.filter(t => !t.deletedAt && t.visibility === 'public' && (t.userId === user?.id || user?.isInternalTest))
  const filtered = (tab === 'users' ? visible : system).filter(t => (place === 'all' || !t.attractionId || t.attractionId === place) && t.title.includes(query.trim()))
  return <div className="page"><div className="container task-center-page"><Breadcrumb items={[{label:'任务中心'}]} />
    <header className="rpg-banner task-center-head"><p className="rpg-eyebrow">长安任务册 · 随心探索</p><h1>任务中心</h1><p>发现西安的每一处小惊喜，任务可做可不做。</p></header>
    <div className="pet-controls">{[['system','系统任务'],['users','用户自建任务'],['create','创建我的任务'],['review','公开审核'],['guide','萌宠获取指南'],['activity','活动任务'],['records','任务记录'],['prefs','提醒设置']].map(([key,label]) => <button className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-secondary'}`} key={key} onClick={() => setParams({tab:key})}>{label}</button>)}</div>
    {['system','users'].includes(tab) && <><div className="card card-pad task-center-filters"><select className="input" aria-label="按景点筛选" value={place} onChange={e=>setPlace(e.target.value)}><option value="all">全部 {attractions.length} 个景点</option>{attractions.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><input className="input" aria-label="搜索任务" placeholder="搜索任务名称" value={query} onChange={e=>setQuery(e.target.value)} /><span>{filtered.length} 项</span></div>
      <div className="task-center-grid">{filtered.map(t=><article key={t.id} className="card card-pad task-center-card"><span className="tag tag-gold">{t.status ? labels[t.status] : t.state}</span><h2 className="card-title">{t.title}</h2><p className="small muted">{getAttraction(t.attractionId)?.name ?? '按场景适用'} · {t.detail ?? (t.type === 'photo' ? '本机照片确认' : '现场定位打卡')}</p><p className="small">{t.reward ?? '自己的任务完成得 2 金币，公开提交可额外得 3 金币；每日前两项有奖。'}</p>{BACKEND_ENABLED && t.status==='approved' && t.userId!==user?.id ? <button className="btn btn-secondary btn-sm" onClick={()=>{if(requireLogin('登录后记录你的探索')){setPublicSelected(t);setPhotoSelected(false);setPublicError('')}}}>参与任务</button> : <Link className="btn btn-secondary btn-sm" to={t.to ?? `/attraction/${t.attractionId}`}>查看任务</Link>}</article>)}</div>{!filtered.length && <p className="card card-pad">暂时没有符合条件的任务。</p>}</>}
    {tab === 'create' && <CustomTasksPanel />}
    {tab === 'guide' && <div className="mt-4"><CoreChainsPanel /></div>}
    {tab === 'activity' && <ActivityTasksPanel />}
    {tab === 'review' && <section className="card card-pad mt-4"><h2>公开审核</h2><p className="small muted">{BACKEND_ENABLED ? '提交后由管理员审核，通过才会向其他游客展示；自己的审核进度会保存在账号中。' : '本机审核队列：内测账号可以体验审核通过或退回。'}{user?.role==='admin' && <Link to="/admin">打开管理后台</Link>}</p>{!queue.length && <p>还没有公开提交。</p>}{queue.map(t=><article className="card card-pad mt-4" key={t.id}><strong>{t.title}</strong><p>{getAttraction(t.attractionId)?.name} · {labels[t.status]} {t.reviewReason && `· ${t.reviewReason}`}</p>{user?.isInternalTest && t.status === 'pending_review' && <button className="btn btn-secondary btn-sm" onClick={()=>{setReview(t);setReason('')}}>审核此任务</button>}{t.userId === user?.id && t.status === 'rejected' && <button className="btn btn-secondary btn-sm" onClick={()=>{setEdit(t);setTitle(t.title)}}>修改并重新提交</button>}</article>)}</section>}
    {tab === 'records' && <section className="card card-pad mt-4"><h2>任务记录</h2>{[...itineraryTaskRecords,...customTaskRecords,...taskRecords].length === 0 && <p>完成任务后会在这里留下记录。</p>}{[...itineraryTaskRecords,...customTaskRecords,...taskRecords].map((r,i)=><p key={i}>{getAttraction(r.attractionId)?.name ?? customTasks.find(t=>t.id===r.taskId)?.title ?? '游玩任务'} · {r.completedAt ? new Date(r.completedAt).toLocaleString('zh-CN') : '已记录'}</p>)}</section>}
    {tab === 'prefs' && <section className="card card-pad mt-4"><h2>提醒设置</h2><label className="check"><input type="checkbox" checked={prefs.remindEnabled} onChange={e=>updatePrefs({remindEnabled:e.target.checked})}/>开启游玩提醒</label><p className="small muted">关闭后仍可主动查看任务。</p><label>每天最多提醒 <select value={prefs.maxPerDay} onChange={e=>updatePrefs({maxPerDay:Number(e.target.value)})}>{[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n} 次</option>)}</select></label></section>}
    {publicSelected && <Modal title={publicSelected.title} onClose={()=>!publicBusy&&setPublicSelected(null)} footer={<button disabled={publicBusy||(publicSelected.type==='photo'&&!photoSelected)} className="btn btn-primary" onClick={finishPublic}>{publicBusy?'正在记录…':'确认完成'}</button>}><p>{getAttraction(publicSelected.attractionId)?.name} · {publicSelected.type==='checkin'?'到现场后允许定位即可打卡':'选择一张本机照片并确认即可'}。任务可不做，照片不上传。与私有任务共用每日金币额度；同一账号同一任务只计一次。</p>{publicSelected.type==='photo'&&<PhotoPicker onSelect={setPhotoSelected}/>}<p className="small muted">作者根据不同账号的完成数量获得阶段奖励，自己完成自己的任务不计数。</p>{publicError&&<p role="alert">{publicError}</p>}</Modal>}
    {review && <Modal title="本机任务审核" onClose={()=>setReview(null)} footer={<><button className="btn btn-secondary" disabled={!reason.trim()} onClick={async()=>{const r=await reviewCustomTask(review.id,false,reason);if(r.code===0)setReview(null)}}>退回修改</button><button className="btn btn-primary" onClick={async()=>{const r=await reviewCustomTask(review.id,true,'');if(r.code===0)setReview(null)}}>审核通过</button></>}><p>{review.title}</p><label>未通过原因<input className="input" value={reason} onChange={e=>setReason(e.target.value)} /></label><p className="small muted">审核操作不重复发放金币。</p></Modal>}
    {edit && <Modal title="修改任务并重新提交" onClose={()=>setEdit(null)} footer={<button className="btn btn-primary" onClick={async()=>{const r=await reviseCustomTask(edit.id,title);if(r.code===0)setEdit(null)}}>重新提交</button>}><input className="input" aria-label="修改任务标题" value={title} onChange={e=>setTitle(e.target.value)} maxLength={60}/></Modal>}
  </div></div>
}
