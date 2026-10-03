import { useEffect, useRef, useState } from 'react'
import { Modal } from './ui'
import Pet from './Pet'
import { useQuest } from '../store/QuestContext'
import { GROWTH_POLICY, PET_EFFECTS, GEAR_EFFECTS } from '../services/petGrowth'

export default function PetUpgradeModal({ petId, itemId, onClose }) {
  const { petCatalog, balance, upgradePet, upgradeItem, setAppearance } = useQuest()
  const pet=petCatalog.find(p=>p.id===petId), item=itemId ? pet?.items.find(i=>i.id===itemId) : null
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[action,setAction]=useState({name:'idle',tick:0})
  const lock=useRef(false), timer=useRef(null)
  useEffect(()=>()=>clearTimeout(timer.current),[])
  if(!pet || (itemId && !item)) return null
  const current=item?.level ?? pet.level, next=Math.min(3,current+1), cost=item ? (current===1?40:80) : 0
  const growth=pet.growth ?? 0, needed=GROWTH_POLICY.thresholds[next-1]
  const owned=pet.unlocked && (!item || item.owned), eligible=owned && current<3 && (item ? balance>=cost : growth>=needed)
  const effects=item?GEAR_EFFECTS:PET_EFFECTS
  const loadout=item?{...pet.loadout,[item.slot]:item.id}:pet.loadout
  const levels=Object.fromEntries(pet.items.map(i=>[i.id,i.appearanceLevel ?? i.level]))
  const act=name=>{clearTimeout(timer.current);setAction(a=>({name,tick:a.tick+1}));timer.current=setTimeout(()=>setAction(a=>({...a,name:'idle'})),name==='wave'?2050:1250)}
  const confirm=async()=>{
    if(lock.current || !eligible)return
    lock.current=true;setBusy(true)
    try{const result=await(item?upgradeItem(item.id):upgradePet(pet.id));setMessage(result?.message ?? '请重试')}
    catch{setMessage('这次没能保存，请稍后再试')}finally{lock.current=false;setBusy(false)}
  }
  return <Modal title={item?item.name+' · 外观升级':pet.name+' · 陪伴成长'} onClose={busy?()=>{}:onClose} footer={<><button className="btn btn-secondary" disabled={busy} onClick={onClose}>关闭</button><button className="btn btn-primary" disabled={busy||!eligible} onClick={confirm}>{busy?'正在保存…':current>=3?'已达最高等级':item?'确认升级 · '+cost+' 金币':growth>=needed?'领取成长等级':'再一起逛逛吧'}</button></>}>
    <p className="small muted">{item?'金币余额 '+balance+' · 升级必定成功，只改变外观。':'完成任务为当前同行萌宠积累陪伴值，不花金币、不连续签到、不做也不扣。'}</p>
    {!item&&<><p>陪伴值 {growth} / {current>=3?15:needed} · 每完成一项任务 +1，每个账号每天最多 +3。</p><progress className="upgrade-progress" max={current>=3?15:needed} value={growth}/><p className="xs muted">累计 5 点可升至 Lv.2，15 点可升至 Lv.3；不回算旧任务，原有等级保留。</p></>}
    <div className="upgrade-compare">{[current,next].map((lv,index)=><div className="upgrade-stage" key={index}><p>{index?'升级后预览':'当前等级'} · Lv.{lv}</p><div key={action.tick} className={'pet-action pet-action-'+action.name}><Pet petId={pet.id} loadout={loadout} itemLevels={item?{...levels,[item.id]:lv}:levels} petLevel={item?pet.appearanceLevel:lv} size={180} mood={action.name==='pat'?'happy':'idle'}/></div><p className="xs">{effects[lv-1]}</p></div>)}</div>
    <div className="upgrade-actions">{[['wave','挥手预览'],['pat','摸摸头'],['highfive','击掌预览']].map(([name,label])=><button className="btn btn-secondary btn-sm" key={name} onClick={()=>act(name)}>{label}</button>)}</div>
    <label className="pet-appearance-select">使用外观<select aria-label="使用外观等级" disabled={busy||!owned} value={item?.appearanceLevel ?? pet.appearanceLevel ?? current} onChange={async e=>{const r=await setAppearance(item?'item':'pet',item?.id ?? pet.id,Number(e.target.value));setMessage(r?.message ?? '')}}>{Array.from({length:current},(_,i)=><option key={i+1} value={i+1}>Lv.{i+1} · {effects[i].split('：')[0]}</option>)}</select></label>
    <p className="xs muted">可切换回已解锁的低等级外观；不会降低实际等级，也不退回升级费用。</p>
    {item&&current<3&&balance<cost&&<p>还差 {cost-balance} 枚金币，先去做自己喜欢的任务吧。</p>}
    {!owned&&<p>先通过任务获得萌宠或服饰，再来升级吧。</p>}
    <p className="upgrade-status" role="status">{message}</p>
  </Modal>
}
