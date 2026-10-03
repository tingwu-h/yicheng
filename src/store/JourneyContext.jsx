import { createContext, useContext, useRef, useState, useEffect } from 'react'
import { useApp } from './AppContext'
import { loadJourneys, startJourney, finishJourney } from '../services/journey'
import { BACKEND_ENABLED, apiRequest, accountEpoch } from '../services/backendClient'

const Context = createContext(null)
export const useJourney = () => useContext(Context)
export function JourneyProvider({ children }) {
  const { user, toast, flushAccount } = useApp()
  const [state, setState] = useState(() => BACKEND_ENABLED ? {active:null,records:[]} : loadJourneys(localStorage))
  const [ready,setReady]=useState(!BACKEND_ENABLED)
  const [error,setError]=useState('')
  const busy=useRef(false)
  const ref = useRef(state)
  const commit = next => {
    if(BACKEND_ENABLED){ref.current=next;setState(next);return true}
    try { localStorage.setItem('changan-journeys-vh05', JSON.stringify(next)) }
    catch { toast('本机存储空间不足，请清理空间后重试', 'warning'); return false }
    ref.current = next; setState(next); return true
  }
  useEffect(()=>{
    if(!BACKEND_ENABLED)return
    let stopped=false
    commit({active:null,records:[]});setReady(!user);setError('')
    const refresh=async()=>{
      if(!user||busy.current||document.visibilityState==='hidden')return
      const epoch=accountEpoch()
      try{const next=await apiRequest('/api/journeys');if(!stopped&&epoch===accountEpoch()&&!busy.current){commit(next);setReady(true);setError('')}}
      catch(e){if(!stopped){setReady(true);setError(e.message)}}
    }
    refresh();const timer=setInterval(refresh,5000)
    return()=>{stopped=true;clearInterval(timer)}
  },[user?.id])
  const start = async (trip, members, baselineIds) => {
    if(BACKEND_ENABLED){
      if(busy.current||!ready||!user)return null
      busy.current=true;const epoch=accountEpoch()
      try{
        if(!await flushAccount())throw new Error('行程尚未保存到服务器，请返回行程页面重试保存')
        const {active}=await apiRequest('/api/journeys/start',{method:'POST',body:{tripId:trip.id}})
        if(epoch!==accountEpoch())return null
        commit({...ref.current,active});setError('');return active
      }catch(e){setError(e.message);toast(e.message,'warning');return null}finally{busy.current=false}
    }
    const next = startJourney(ref.current, { trip, userId: user?.id, members, baselineIds })
    if (next === ref.current && next.active?.trip.id !== trip.id) { toast('请先结束正在进行的游玩', 'warning'); return null }
    return commit(next) ? next.active : null
  }
  const end = async (sessionId, records) => {
    if(BACKEND_ENABLED){
      if(busy.current)return false
      busy.current=true;const epoch=accountEpoch()
      try{const next=await apiRequest('/api/journeys/finish',{method:'POST',body:{sessionId}});if(epoch!==accountEpoch())return false;commit(next);return true}
      catch(e){toast(e.message,'warning');return false}finally{busy.current=false}
    }
    const next = finishJourney(ref.current, { sessionId, userId: user?.id, records })
    return next !== ref.current && commit(next)
  }
  const addDemoFriend = () => {
    if(BACKEND_ENABLED){toast('线上小队请使用邀请码加入，不会伪造好友账号','info');return}
    const active = ref.current.active
    if (!active || active.userId !== user?.id || active.members.some(m => m.id === 'demo-friend')) return
    commit({ ...ref.current, active: { ...active, members: [...active.members, { id: 'demo-friend', name: '同行好友（演示）', petId: 'pet-zhuhuan', loadout: {}, level: 1 }] } })
  }
  const join = async code => {
    if(!BACKEND_ENABLED||!user||busy.current)return null
    busy.current=true;const epoch=accountEpoch()
    try{const {active}=await apiRequest('/api/journeys/join',{method:'POST',body:{code}});if(epoch!==accountEpoch())return null;commit({...ref.current,active});setError('');return active}
    catch(e){toast(e.message,'warning');return null}finally{busy.current=false}
  }
  return <Context.Provider value={{ active: state.active?.userId === user?.id ? state.active : null,
    records: state.records.filter(r => r.userId === user?.id), start, end, addDemoFriend, join, ready, error }}>{children}</Context.Provider>
}
