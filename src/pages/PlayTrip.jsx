import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { useQuest } from '../store/QuestContext'
import { useJourney } from '../store/JourneyContext'
import MapCanvas from '../map'
import WalkingPet from '../components/WalkingPet'
import { Modal } from '../components/ui'
import { TripTasksPanel } from '../components/Vh02TaskPanels'
import { getAttraction, getGeo } from '../data/attractions'
import { getPet } from '../data/pets'
import { boundsOf, centerOf, zoomForBounds } from '../lib/geo'
import { BACKEND_ENABLED } from '../services/backendClient'

export default function PlayTrip() {
  const { tripId } = useParams(); const navigate = useNavigate()
  const { savedTrips, user, profile, toast, requireLogin } = useApp()
  const { petCatalog, itineraryTaskRecords } = useQuest(); const { active, start, end, addDemoFriend, ready, error } = useJourney()
  const [inviteOpen, setInviteOpen] = useState(false); const [endOpen, setEndOpen] = useState(false); const [selected, setSelected] = useState(null)
  const ownPet = petCatalog.find(p => p.active && p.unlocked); const saved = savedTrips.find(t => t.id === tripId); const session = active?.trip.id === tripId ? active : null
  useEffect(() => { if (!saved || active || !user || !ready || error) return; start(saved, [{ id: user.id, name: profile.name || user.name, petId: ownPet?.id ?? null, loadout: ownPet?.loadout ?? {}, level: ownPet?.level ?? 1 }], itineraryTaskRecords.map(r => r.taskId)) }, [saved, active, user, ready, error])
  if (!user) return <div className="container card card-pad"><h1>登录后开始游玩</h1><button className="btn btn-primary" onClick={() => requireLogin('登录后保存游玩记录')}>登录</button></div>
  if (!ready) return <p className="container">正在同步游玩记录…</p>
  if (error && !session) return <div className="container card card-pad"><p role="alert">{error}</p><Link to="/itinerary">返回行程检查保存状态</Link></div>
  if (!saved && !session) return <div className="container card card-pad"><h1>这份行程已不存在</h1><Link to="/itinerary">返回行程重新选择</Link></div>
  if (active && !session) return <div className="container card card-pad"><h1>你还有一段游玩正在进行</h1><Link className="btn btn-primary" to={`/play/${active.trip.id}`}>继续当前游玩</Link></div>
  if (!session) return <p className="container">正在准备行程…</p>
  const trip = session.trip; const members = session.members
  const points = trip.days.flatMap(d => d.items).map((item, i) => { const g = getGeo(item.attractionId), a = getAttraction(item.attractionId); return g && a ? { ...g, id: item.id, name: a.name, badge: String(i + 1), color: '#b2372e' } : null }).filter(Boolean)
  const finish = async () => { if (await end(session.id, itineraryTaskRecords)) { toast('游玩记录已保存', 'success'); navigate('/profile?tab=playRecords') } }
  return <div className="page"><div className="container play-trip-page">
    <header className="rpg-banner play-trip-head row-between wrap row-3"><div><Link to="/itinerary">‹ 返回行程</Link><p className="rpg-eyebrow">长安行旅 · 伙伴同行</p><h1>{trip.title}</h1><p>{trip.startDate} · {trip.days.length} 天 · {points.length} 个景点</p></div><button className="btn btn-secondary" onClick={() => setEndOpen(true)}>取消游玩</button></header>
    <section className="card card-pad play-map-panel"><h2 className="card-title">行旅地图</h2><MapCanvas className="map-canvas-lg" points={points} interactive activeId={selected} onSelect={setSelected} center={centerOf(points) || { lat: 34.26, lng: 108.95 }} zoom={points.length > 1 ? zoomForBounds(boundsOf(points), { width: 900, height: 360, padding: 50 }) : 13} polylines={points.length > 1 ? [{ id: 'trip-route', color: '#b2372e', path: points.map(({lat,lng}) => ({lat,lng})) }] : []} notice="高德地图 · 连线表示游玩顺序，不代表导航路线" ariaLabel="游玩路线地图" /><div className="pet-controls">{points.map(p => <button key={p.id} className={`btn btn-sm ${p.id === selected ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSelected(p.id)}>{p.badge}. {p.name}</button>)}</div></section>
    <div className="play-trip-grid"><section className="card card-pad"><div className="row-between"><h2 className="card-title">同行小队</h2><span className="tag tag-gold">{members.length} 人</span></div><div className="play-team-list stack stack-2">{members.map(m => <div className="play-team-member" key={m.id}><span className="avatar-dot">{m.name.slice(0,1)}</span><strong className="grow">{m.name}</strong><span className="xs muted">{getPet(m.petId)?.name ?? '暂无萌宠'}</span></div>)}</div><button className="btn btn-secondary" onClick={() => setInviteOpen(true)}>邀请好友</button><p className="xs muted mt-4">{BACKEND_ENABLED ? '使用邀请码加入真实小队，进度约每 5 秒同步；金币只发给实际完成者。' : '当前为本机演示小队。'}</p></section><section className="card card-pad"><h2 className="card-title">同行萌宠</h2><div className="play-pet-roster">{members.map(m => { const pet = m.id === user.id ? ownPet : { ...getPet(m.petId), loadout: m.loadout, level: m.level, items: [] }; return pet?.id ? <WalkingPet key={`${m.id}-${pet.id}`} pet={pet} owner={m.id === user.id ? '我' : m.name} storageId={`${user.id}-${session.id}-${m.id}`} /> : <p key={m.id} className="muted">{m.name}还没有同行萌宠。<Link to="/pets">查看萌宠获取指南</Link></p> })}</div></section></div>
    <section className="play-task-panel"><h2>景点任务册</h2><p className="small muted">任务自愿参与，照片留在本机；按行程日期完成即可。</p><TripTasksPanel itinerary={trip} detailed sharedRecords={session.sharedTasks??[]} /></section>
    {inviteOpen && (BACKEND_ENABLED ? <Modal title="邀请好友一起走" onClose={()=>setInviteOpen(false)}><p>把邀请码发给好友，对方登录后在“行程”页输入即可加入。请仅分享给信任的朋友。</p><p style={{fontSize:28,fontWeight:700,letterSpacing:3}}>{session.inviteCode}</p><button className="btn btn-primary" onClick={async()=>{try{await navigator.clipboard.writeText(session.inviteCode);toast('邀请码已复制')}catch{toast('请手动复制邀请码','info')}}}>复制邀请码</button><p className="small muted mt-4">最多 8 人，进度约每 5 秒同步。队员共享行程任务进度；金币只发给实际完成者，核心萌宠任务仍需各自完成。</p></Modal> : <Modal title="邀请好友" onClose={() => setInviteOpen(false)} footer={<button className="btn btn-primary" disabled={members.some(m => m.id === 'demo-friend')} onClick={() => { addDemoFriend(); setInviteOpen(false) }}>{members.some(m => m.id === 'demo-friend') ? '演示好友已加入' : '加入一位演示好友'}</button>}><p>演示好友仅在本浏览器展示，不会发送真实邀请。</p></Modal>)}
    {endOpen && <Modal title="确定取消本次游玩？" onClose={() => setEndOpen(false)} footer={<><button autoFocus className="btn btn-secondary" onClick={() => setEndOpen(false)}>继续游玩</button><button className="btn btn-primary" onClick={finish}>结束并保存记录</button></>}><p>本次游玩时间、行程、同行伙伴和新完成的任务会保存到个人中心的“游玩记录”。未完成任务不扣金币。</p>{BACKEND_ENABLED && <p>{session.ownerId===user.id?'你是发起人，确认后将结束整队游玩。':'你将退出小队，不会结束其他伙伴的游玩。'}</p>}</Modal>}
  </div></div>
}
