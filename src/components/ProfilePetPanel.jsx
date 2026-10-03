import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import WalkingPet from './WalkingPet'
import PetUpgradeModal from './PetUpgradeModal'
export default function ProfilePetPanel({ pet }) {
  const { user }=useApp(); const [target,setTarget]=useState(null)
  if (!pet?.unlocked) return <aside className="card card-pad"><h2>我的萌宠</h2><p>解锁后就能一起逛长安。</p><Link to="/pets">萌宠获取指南 →</Link></aside>
  return <aside className="profile-pet-panel card card-pad"><div className="row-between"><h2 className="card-title">我的萌宠</h2><button className="btn btn-ghost btn-sm" onClick={()=>setTarget({petId:pet.id})}>陪伴成长 · Lv.{pet.level}</button></div>
    <WalkingPet key={pet.id} pet={pet} owner="我" storageId={'profile-'+user?.id}/>
    <div className="profile-pet-slots">{[['hat','冠饰'],['back','披风'],['outfit','外袍']].map(([slot,label])=>{const item=pet.items.find(i=>i.id===pet.loadout?.[slot]);return <button className="profile-pet-slot" key={slot} disabled={!item} onClick={()=>setTarget({petId:pet.id,itemId:item.id})}><span className="xs muted">{label}</span><strong>{item?.name ?? '未穿戴'}</strong>{item&&<span className="xs muted">Lv.{item.level} · 查看外观与升级</span>}</button>})}</div><Link className="btn btn-ghost btn-sm" to="/pets">切换萌宠与服饰 →</Link>
    {target&&<PetUpgradeModal {...target} onClose={()=>setTarget(null)}/>}
  </aside>
}
