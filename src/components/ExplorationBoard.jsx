import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { attractions, REGIONS } from '../data/attractions'
import { EXPLORATION_KEY, EXPLORATION_TITLES, collectDiscovery, explorationTitle, loadDiscoveries, parseDiscoveries, saveDiscoveries } from '../lib/exploration'
import '../styles/exploration.css'

const REGION_LORE = {
  citywall: ['城阙拾光', '沿城垣展开一页长安，听钟鼓与街巷的回声。'],
  qujiang: ['曲水寻章', '塔影、湖光与夜色，在这一卷相逢。'],
  lintong: ['骊山问古', '从秦俑到唐宫，翻开山麓的千年故事。'],
  gaoxin: ['湖畔闲游', '暂别喧闹，在城市水岸留一笔清闲。'],
  qinling: ['终南望青', '把山色装进手札，再慢慢筹划远行。'],
}

export default function ExplorationBoard() {
  const [regionKey, setRegionKey] = useState(REGIONS[0].key)
  const [selectedId, setSelectedId] = useState(attractions.find((a) => a.region === REGIONS[0].key).id)
  const [discovered, setDiscovered] = useState(() => {
    try { return loadDiscoveries(window.localStorage) } catch { return [] }
  })
  const [message, setMessage] = useState('点亮兴趣，再亲手收录一页。')
  const [confirmReset, setConfirmReset] = useState(false)
  const resetRef = useRef(null)
  const cancelRef = useRef(null)
  const region = REGIONS.find((r) => r.key === regionKey)
  const points = attractions.filter((a) => a.region === regionKey)
  const selected = points.find((a) => a.id === selectedId) || points[0]
  const title = explorationTitle(discovered)
  const nextTitle = EXPLORATION_TITLES.find((t) => t.threshold > discovered.length)
  const collected = discovered.includes(selected.id)

  useEffect(() => {
    const sync = (event) => {
      if (event.key === EXPLORATION_KEY || event.key === null) setDiscovered(parseDiscoveries(event.newValue))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  useEffect(() => { if (confirmReset) cancelRef.current?.focus() }, [confirmReset])

  const persist = (ids, success) => {
    setDiscovered(ids)
    let saved = false
    try { saved = saveDiscoveries(window.localStorage, ids) } catch { /* blocked browser storage */ }
    setMessage(saved ? success : '浏览器无法保存手札；本次可继续探索，但刷新后可能丢失。')
  }
  const closeReset = () => { setConfirmReset(false); resetRef.current?.focus() }

  return (
    <section className="exploration-board" id="exploration-notebook" aria-labelledby="exploration-heading">
      <header className="exploration-header">
        <div>
          <span className="exploration-kicker">驿程 / 网页探索篇</span>
          <h1 id="exploration-heading">手札</h1>
          <p>以一卷山河，开启你的长安故事。选择景点查看资料，按「收录手札」记下网页发现。</p>
        </div>
        <div className="exploration-seal" aria-label={`当前称号：${title.name}`}><span aria-hidden="true">章</span><strong>{title.name}</strong></div>
      </header>
      <div className="exploration-progress">
        <div><strong>已收录 {discovered.length} / {attractions.length}</strong><span>仅为此浏览器的网页探索记录，不代表实际到访，不发放金币。</span></div>
        <progress value={discovered.length} max={attractions.length} aria-label="网页景点收录进度" />
        <p>{nextTitle ? `再收录 ${nextTitle.threshold - discovered.length} 个，解锁「${nextTitle.name}」` : '二十四景已成卷 · 长安图鉴章已解锁'}</p>
      </div>
      <div className="exploration-chapters" role="group" aria-label="选择探索片区">
        {REGIONS.map((r, index) => (
          <button type="button" key={r.key} aria-pressed={r.key === regionKey} onClick={() => {
            setRegionKey(r.key)
            setSelectedId(attractions.find((a) => a.region === r.key).id)
          }}><span aria-hidden="true">0{index + 1}</span> {r.name}<small>{attractions.filter((a) => a.region === r.key && discovered.includes(a.id)).length}/{attractions.filter((a) => a.region === r.key).length}</small></button>
        ))}
      </div>
      <div className="exploration-layout">
        <div className="exploration-map">
          <div className="exploration-map-heading"><span>山河绘卷</span><strong>{REGION_LORE[regionKey][0]}</strong><p>{REGION_LORE[regionKey][1]}</p></div>
          <div className="exploration-map-art" aria-hidden="true">
            <svg viewBox="0 0 600 180" preserveAspectRatio="none"><path d="M0 135L65 72 105 102 162 30 218 102 260 60 320 130 380 72 430 100 488 40 555 100 600 68V180H0Z" fill="currentColor"/><path d="M0 155 Q150 95 300 155 T600 145" fill="none" stroke="currentColor" strokeWidth="3"/></svg>
            <span>長安</span>
          </div>
          <div className="exploration-points" role="group" aria-label={`${region.name}景点示意点位`}>
            {points.map((a, index) => (
              <button type="button" key={a.id} className="exploration-point" aria-pressed={a.id === selected.id} aria-controls="exploration-detail" onClick={() => setSelectedId(a.id)}>
                <span className="exploration-point-mark" aria-hidden="true">{discovered.includes(a.id) ? '✓' : String(index + 1).padStart(2, '0')}</span>
                <span>{a.alias || a.name}<small>{discovered.includes(a.id) ? '网页已发现' : '待收录'}</small></span>
              </button>
            ))}
          </div>
          <p className="exploration-map-note">※ 非导航示意图：点位按片区编排，不表示真实位置、距离或路线。出行请查看<Link to="/map">现有地图</Link>。</p>
        </div>
        <article className="exploration-detail" id="exploration-detail" aria-labelledby="exploration-detail-name">
          <div className="exploration-photo"><img src={selected.image} alt={selected.name} loading="lazy" /><span>{region.name} · {selected.type}</span></div>
          <div className="exploration-detail-body">
            <span className="exploration-kicker">当前拾景 / {collected ? '已入手札' : '尚未收录'}</span>
            <h3 id="exploration-detail-name">{selected.name}</h3>
            <p>{selected.summary}</p>
            <dl><div><dt>建议游玩</dt><dd>{selected.duration}</dd></div><div><dt>适合时段</dt><dd>{selected.bestTime}</dd></div></dl>
            <div className="exploration-actions"><button type="button" disabled={collected} onClick={() => persist(collectDiscovery(discovered, selected.id), `已将「${selected.name}」收录手札。`)}>{collected ? '已收录手札 ✓' : '收录手札 ＋'}</button><Link to={`/attraction/${selected.id}`}>查看景点详情 →</Link></div>
            <p className="exploration-detail-note">查看与切换不会自动收录。实际开放、预约及交通信息请出行前核实。</p>
          </div>
        </article>
      </div>
      <ul className="exploration-badges" aria-label="网页探索称号解锁条件">{EXPLORATION_TITLES.filter((t) => t.threshold > 0).map((t) => <li key={t.name} className={discovered.length >= t.threshold ? 'is-unlocked' : ''}><span aria-hidden="true">◇</span><strong>{t.name}</strong><small>{t.threshold} 景 · {discovered.length >= t.threshold ? '已解锁' : '未解锁'}</small></li>)}</ul>
      <footer className="exploration-footer"><nav aria-label="继续长安之旅"><Link to="/tasks?tab=guide">萌宠获取指南 →</Link><Link to="/map">出行地图 →</Link><Link to="/pets">我的旅伴 →</Link></nav><button ref={resetRef} type="button" className="exploration-reset" disabled={!discovered.length} onClick={() => setConfirmReset(true)}>重置网页手札</button></footer>
      <p className="exploration-status" role="status" aria-live="polite">{message}</p>
      {confirmReset && <div className="exploration-confirm" role="group" aria-labelledby="exploration-reset-title" onKeyDown={(e) => { if (e.key === 'Escape') closeReset() }}><strong id="exploration-reset-title">确定清空网页手札？</strong><p>仅清空本浏览器的探索记录，不影响任务、金币、收藏或旅伴。</p><div><button type="button" ref={cancelRef} onClick={closeReset}>保留手札</button><button type="button" onClick={() => { persist([], '网页手札已重置，重新执笔吧。'); closeReset() }}>确认清空</button></div></div>}
    </section>
  )
}
