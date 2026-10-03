import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Pet from './Pet'
import { attractions } from '../data/attractions'

const SIZE = 136
const PERSONALITY = {
  'pet-qizai': { effect: '🍃', lines: ['咱慢慢逛，风景又不会跑。', '竹子没带，陪伴管够！'], idle: ['怎么这么久不来看看我？', '我在这儿等你呢，回来坐会儿。'] },
  'pet-zhuhuan': { effect: '🪶', lines: ['这片光影，值得多看一眼。', '我把今天的好心情藏在羽毛里了。'], idle: ['好一会儿没见你啦，要不要回来看看？', '我替你守着这片风景，等你回来。'] },
  'pet-jinsihou': { effect: '✨', lines: ['发现好玩的，记得叫上我！', '我先伸个懒腰，你慢慢选。'], idle: ['喂，探险家，怎么把我晾在这儿啦？', '快回来，我又发现一个好玩的！'] },
  'pet-lingniu': { effect: '🌼', lines: ['累了就歇歇，我陪着你。', '别看我块头大，逛街可细心了。'], idle: ['走累了吗？我在原地等你。', '这么久没点我，我都快睡着啦。'] },
}
const SCENIC_LINES = {
  'pet-qizai': (name) => [`到${name}啦，咱先慢慢绕一圈。`, `${name}适合放慢脚步，咱不赶。`, `在${name}找个舒服角度，再拍也不迟。`, `逛完${name}记得坐会儿，脚也要休息。`],
  'pet-zhuhuan': (name) => [`${name}今天的光线很温柔，先观察一下。`, `到${name}可以留意屋檐、树影和人群的空隙。`, `在${name}拍照别急，等光线落下来会更好。`, `我很喜欢${name}的细节，你发现了吗？`],
  'pet-jinsihou': (name) => [`${name}到了！先找一个最想探索的角落。`, `在${name}转个弯，说不定就有新发现。`, `${name}的好玩点不只一个，咱多走两步！`, `来${name}打卡，记得给我留个镜头。`],
  'pet-lingniu': (name) => [`到${name}先看看休息点，慢慢逛更舒服。`, `${name}人多时咱往旁边走走，别挤在一起。`, `逛${name}可以分成几段，累了随时歇。`, `在${name}看见喜欢的地方就停一停。`],
}
const scenicLinesFor = petId => attractions.flatMap(({ name }) => SCENIC_LINES[petId]?.(name) ?? SCENIC_LINES['pet-qizai'](name))
const clamp = (x, min, max) => Math.min(Math.max(min, max), Math.max(min, x))
export default function WalkingPet({ pet, owner, storageId }) {
  const home = useRef(null)
  const drag = useRef(null)
  const timer = useRef(null)
  const bubbleTimer = useRef(null)
  const lastChat = useRef(0)
  const lastActivity = useRef(Date.now())
  const idleBubbleShown = useRef(false)
  const displayRef = useRef(null)
  const lastIdleLine = useRef('')
  const lastChatLine = useRef('')
  const [bubble, setBubble] = useState('')
  const personality = PERSONALITY[pet.id] ?? PERSONALITY['pet-qizai']
  const maybeChat = (force = false) => {
    if ((!force && Date.now() - lastChat.current < 15000) || (!force && Math.random() >= .3)) return
    lastChat.current = Date.now()
    const lines = force ? personality.idle : [...personality.lines, ...scenicLinesFor(pet.id)]
    const choices = lines.filter(line => line !== (force ? lastIdleLine.current : lastChatLine.current))
    const line = choices[Math.floor(Math.random() * choices.length)]
    if (force) lastIdleLine.current = line
    else lastChatLine.current = line
    setBubble(line)
    clearTimeout(bubbleTimer.current)
    bubbleTimer.current = setTimeout(() => setBubble(''), 4000)
  }
  const key = `vh05-pet-${storageId}-${pet.id}`
  const [display, setDisplay] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem(key)); if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) return { ...v, mode: ['fixed','free','manual'].includes(v.mode) ? v.mode : 'manual' } } catch {}
    return { x: 0, y: 0, away: false, mode: 'manual' }
  })
  const [action, setAction] = useState({ name: 'idle', tick: 0 })
  displayRef.current = display
  const [returning, setReturning] = useState(false)
  const [held, setHeld] = useState(false)
  const bound = (x, y) => ({ x: clamp(x, 4, innerWidth - SIZE - 4), y: clamp(y, 64, innerHeight - SIZE - 30) })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(display)) } catch {} }, [key, display])
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(bubbleTimer.current) }, [])
  useEffect(() => {
    const react = event => {
      lastActivity.current = Date.now(); idleBubbleShown.current = false
      if (document.hidden || document.querySelector('[role="dialog"]')) return
      if (!event.target.closest('main button, main a, main select') || event.target.closest('.walking-pet-cell')) return
      maybeChat()
    }
    document.addEventListener('click', react)
    const active = () => { lastActivity.current = Date.now(); idleBubbleShown.current = false }
    const events = ['pointerdown', 'keydown', 'input', 'wheel']
    events.forEach(type => document.addEventListener(type, active, { passive: true }))
    return () => { document.removeEventListener('click', react); events.forEach(type => document.removeEventListener(type, active)) }
  }, [pet.id])
  useEffect(() => {
    const checkIdle = () => {
      const quiet = Date.now() - lastActivity.current
      if (quiet >= 15000 && !idleBubbleShown.current && !document.hidden && !document.querySelector('[role="dialog"]')) {
        idleBubbleShown.current = true
        maybeChat(true)
      }
      if (quiet >= 8 * 60 * 1000 && !returning) {
        if (displayRef.current.away) backHome(true)
        else if (displayRef.current.mode === 'free') setDisplay(p => ({ ...p, mode: 'manual' }))
      }
    }
    const timerId = setInterval(checkIdle, 1000)
    return () => clearInterval(timerId)
  }, [returning, pet.id])
  useEffect(() => {
    const resize = () => setDisplay(p => ({ ...p, ...bound(p.x, p.y) }))
    addEventListener('resize', resize); return () => removeEventListener('resize', resize)
  }, [])
  const interact = name => {
    if (returning) return
    clearTimeout(timer.current); setAction(p => ({ name, tick: p.tick + 1 }))
    maybeChat()
    // Allow the two-second wave to finish lowering the arm before returning to idle.
    timer.current = setTimeout(() => setAction(p => ({ ...p, name: 'idle' })), name === 'wave' ? 2050 : 1250)
  }
  const backHome = (automatic = false) => {
    if (!displayRef.current.away) { interact('wave'); return }
    const rect = home.current.getBoundingClientRect()
    if (automatic !== true && (rect.top < 70 || rect.bottom > innerHeight)) home.current.scrollIntoView({ block: 'center', behavior: 'instant' })
    const target = home.current.getBoundingClientRect()
    clearTimeout(timer.current); setReturning(true); setAction(p => ({ name: 'walk', tick: p.tick + 1 }))
    setDisplay(p => ({ ...p, mode: 'manual', x: target.left, y: target.top }))
    timer.current = setTimeout(() => {
      setDisplay(p => ({ ...p, away: false })); setReturning(false); setAction(p => ({ ...p, name: 'idle' }))
    }, 2700)
  }
  useEffect(() => {
    if (display.mode !== 'free' || returning || held || !['idle', 'walk'].includes(action.name)) return
    const interval = setInterval(() => {
      if (document.hidden || document.querySelector('[role="dialog"]')) return
      const rect = home.current?.getBoundingClientRect()
      if (!rect || rect.bottom < 70 || rect.top > innerHeight) return
      setDisplay(p => ({ ...p, away: true, ...bound((p.away ? p.x : rect.left) + (Math.random() - .5) * 640, (p.away ? p.y : rect.top) + (Math.random() - .5) * 360) }))
      setAction(p => ({ name: 'walk', tick: p.tick + 1 }))
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setAction(p => ({ ...p, name: 'idle' })), 2600)
    }, 3600)
    return () => clearInterval(interval)
  }, [display.mode, returning, held, action.name])
  const down = e => {
    if (e.button !== 0 || returning) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const r = e.currentTarget.getBoundingClientRect()
    drag.current = { x: e.clientX, y: e.clientY, left: r.left, top: r.top, moved: false }
    setHeld(true)
  }
  const move = e => {
    const d = drag.current
    if (!d || display.mode === 'fixed') return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (Math.hypot(dx, dy) < 5 && !d.moved) return
    d.moved = true
    setDisplay(p => ({ ...p, away: true, mode: 'manual', ...bound(d.left + dx, d.top + dy) }))
  }
  const up = e => {
    if (!drag.current) return
    const clicked = !drag.current.moved
    drag.current = null; setHeld(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (clicked && e.type !== 'pointercancel') interact('pat')
  }
  // Keep the draggable node mounted in one portal: pointer capture survives leaving the home panel.
  const [homePoint, setHomePoint] = useState(null)
  useEffect(() => {
    const sync = () => { const r = home.current?.getBoundingClientRect(); if (r) setHomePoint({ x: r.left, y: r.top, visible: r.bottom > 70 && r.top < innerHeight }) }
    sync(); addEventListener('scroll', sync, true); addEventListener('resize', sync)
    const observer = new ResizeObserver(sync); if (home.current) observer.observe(home.current)
    return () => { removeEventListener('scroll', sync, true); removeEventListener('resize', sync); observer.disconnect() }
  }, [])
  const point = display.away ? display : homePoint
  return <div className="walking-pet-cell">
    <div ref={home} className="pet-home" style={{ width: SIZE, height: SIZE }}><span className="pet-home-label">{display.away ? '外出探索中' : ''}</span></div>
    {point && (display.away || homePoint?.visible) && createPortal(<button type="button"
      className={`walking-pet ${held ? 'is-held' : ''} ${returning || display.mode === 'free' ? 'is-walking' : ''}`}
      style={{ left: point.x, top: point.y, width: SIZE, height: SIZE }}
      aria-label={`${owner}的${pet.name ?? '萌宠'}，拖动或点击互动`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); interact('pat') }
        if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && display.mode !== 'fixed') { e.preventDefault(); setDisplay(p => ({ ...p, away: true, ...bound(point.x + (e.key === 'ArrowRight' ? 16 : e.key === 'ArrowLeft' ? -16 : 0), point.y + (e.key === 'ArrowDown' ? 16 : e.key === 'ArrowUp' ? -16 : 0)) })) } }}>
      {bubble && <span className="pet-chat-bubble" role="status">{bubble}</span>}
      <div key={action.tick} className={`pet-action pet-action-${action.name} species-${pet.id}`}>
        <Pet petId={pet.id} loadout={pet.loadout ?? {}} petLevel={pet.appearanceLevel ?? pet.level ?? 1} itemLevels={Object.fromEntries((pet.items ?? []).map(i => [i.id, i.appearanceLevel ?? i.level]))} size={SIZE} mood={['pat','highfive'].includes(action.name) ? 'happy' : 'idle'} />
        {action.name === 'pat' && <span className="pet-hand pet-hand-pat">✋</span>}
        {action.name === 'pat' && (pet.appearanceLevel ?? pet.level ?? 1) >= 3 && <span className="pet-personality-effect" aria-hidden="true">{personality.effect}</span>}
      </div>
    </button>, document.body)}
    <strong className={(pet.appearanceLevel ?? pet.level ?? 1) >= 3 ? "pet-name-level-3" : ""}>{owner} · {pet.name}</strong>
    <span className="pet-action-caption" role="status">{({ wave: '挥挥手，出发啦！', pat: '摸摸头，好舒服～', highfive: '击掌！一起去逛长安', walk: returning ? '走回伙伴身边…' : '散步中', idle: '按住可拖动到页面任意位置' })[action.name]}</span>
    <div className="pet-controls">{[['wave','挥手'],['pat','摸摸头'],['highfive','击掌']].map(([id,label]) => <button className="btn btn-secondary btn-sm" key={id} onClick={() => interact(id)}>{label}</button>)}</div>
    <div className="pet-controls"><button className="btn btn-ghost btn-sm" onClick={backHome} disabled={returning}>回到原位</button>
      <button className="btn btn-ghost btn-sm" onClick={() => { setDisplay(p => ({ ...p, mode: p.mode === 'fixed' ? 'manual' : 'fixed' })); setAction(p => ({ ...p, name: 'idle' })) }}>{display.mode === 'fixed' ? '解除固定' : '固定位置'}</button>
      <button className="btn btn-ghost btn-sm" onClick={() => { setDisplay(p => ({ ...p, mode: p.mode === 'free' ? 'manual' : 'free' })); setAction(p => ({ ...p, name: 'idle' })) }}>{display.mode === 'free' ? '停止散步' : '自由走动'}</button></div>
  </div>
}
