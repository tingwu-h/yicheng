import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { apiRequest, BACKEND_ENABLED } from '../services/backendClient'

export default function Admin(){
  const {user,accountReady}=useApp()
  const [overview,setOverview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const [key,setKey]=useState('officialTaskConfig'),[draft,setDraft]=useState(''),[selected,setSelected]=useState(null),[reason,setReason]=useState('')
  const load=async()=>{try{const data=await apiRequest('/api/admin/overview');setOverview(data);setDraft(JSON.stringify(data.config[key],null,2));setError('')}catch(e){setError(e.message)}}
  useEffect(()=>{if(BACKEND_ENABLED&&user?.role==='admin')load()},[user?.id,user?.role])
  if(!accountReady)return <p className="container">正在确认账号…</p>
  if(!BACKEND_ENABLED||user?.role!=='admin')return <div className="container card card-pad"><h1>管理后台</h1><p>此页需要管理员账号。普通账号无法访问审核队列和其他用户记录。</p><Link to="/profile">返回个人中心</Link></div>
  const run=async job=>{setBusy(true);setError('');try{await job();await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <div className="container stack stack-4"><header className="rpg-banner"><h1>驿程管理后台</h1><p>比赛内测 · 配置调整、任务审核、账号进度</p></header>
    {error&&<p role="alert" className="field-error">{error}</p>}<button className="btn btn-secondary" disabled={busy} onClick={load}>刷新后台数据</button>
    <section className="card card-pad"><h2>待审核任务</h2><p className="small muted">仅审核公开提交的任务文字。私有照片不会展示给审核人，审核操作不会重复发放奖励。</p>
      {overview?.submissions.length===0&&<p>目前没有待审核任务。</p>}
      {(overview?.submissions??[]).map(t=><article className="item-row" key={t.id}><div className="grow"><strong>{t.body.title}</strong><p className="small muted">景点 {t.body.attractionId} · {t.body.type==='photo'?'拍照':'打卡'}</p></div><button className="btn btn-secondary" disabled={busy} onClick={()=>run(()=>apiRequest('/api/admin/review',{method:'POST',body:{taskId:t.id,approved:true}}))}>通过</button><button className="btn btn-ghost" disabled={busy||!reason.trim()} onClick={()=>run(()=>apiRequest('/api/admin/review',{method:'POST',body:{taskId:t.id,approved:false,reason}}))}>退回</button></article>)}
      <label>退回说明<input className="input" value={reason} maxLength={500} onChange={e=>setReason(e.target.value)} placeholder="给作者一句具体的修改建议"/></label>
    </section>
    <section className="card card-pad"><h2>任务与提醒配置</h2><p className="small muted">保存前会校验四种萌宠、专属奖励、可跳过要求和提醒上限。任务停用不会扣除用户已经获得的奖励。</p>
      <label>配置项<select className="input" value={key} onChange={e=>{setKey(e.target.value);setDraft(JSON.stringify(overview?.config[e.target.value],null,2))}}><option value="officialTaskConfig">总开关、提醒与奖励额度</option><option value="coreChains">萌宠获取指南</option><option value="activityTasks">活动任务与限定服饰</option></select></label>
      <textarea className="input" aria-label="配置 JSON" rows={16} spellCheck={false} value={draft} onChange={e=>setDraft(e.target.value)} style={{fontFamily:'monospace',marginTop:12}}/>
      <button className="btn btn-primary" disabled={busy||!overview} onClick={()=>{if(window.confirm('确认保存这项配置？将影响之后的任务请求。'))run(()=>apiRequest('/api/admin/config/'+key,{method:'PUT',body:{value:JSON.parse(draft)}}))}}>校验并保存配置</button>
    </section>
    <section className="card card-pad"><h2>账号进度</h2><p className="small muted">最多展示最近 100 个账号；只读查询，不提供手动加金币或直接解锁宠物。</p>
      {(overview?.users??[]).map(u=><div key={u.id} className="item-row"><span className="grow">{u.name} · {u.account} · {u.role==='admin'?'管理员':'用户'}</span><button className="btn btn-secondary btn-sm" onClick={async()=>{try{setSelected({name:u.name,...await apiRequest('/api/admin/users/'+u.id)})}catch(e){setError(e.message)}}}>查看记录</button></div>)}
      {selected&&<details open className="mt-4"><summary>{selected.name}的记录</summary><p>金币 {selected.state.coinLedger.reduce((n,r)=>n+r.delta,0)} · 萌宠 {selected.state.userPets.length}/4 · 服饰 {selected.state.ownedItems.length} · 核心步骤 {selected.state.coreProgress.length}</p><h3>最近 30 笔金币流水</h3>{selected.state.coinLedger.slice(-30).map(e=><p className="small" key={e.id}>{e.createdAt} · {e.reason} · {e.delta>0?'+':''}{e.delta}</p>)}</details>}
    </section>
    <section className="card card-pad"><h2>最近操作</h2>{(overview?.audit??[]).slice(0,20).map(a=><p className="small muted" key={a.id}>{a.created_at} · {a.action} · {a.target}</p>)}</section>
  </div>
}
