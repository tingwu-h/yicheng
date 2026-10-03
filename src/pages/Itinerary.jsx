import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useJourney } from '../store/JourneyContext'
import { BACKEND_ENABLED } from '../services/backendClient'
import { ROUTES } from '../data/community'
import { routeTrip } from '../services/journey'
import { useApp, formatDate } from '../store/AppContext'
import { useQuest } from '../store/QuestContext'
import { QUEST_COPY } from '../data/questConfig'
import { attractions, getAttraction, getRegion, regionName, REGIONS, getGeo } from '../data/attractions'
import MapCanvas from '../map'
import { TripTasksPanel } from '../components/Vh02TaskPanels'
import { addCalendarDays, localTodayISO } from '../lib/calendarDates'
import {
  boundsOf,
  centerOf,
  zoomForBounds,
  formatDistance,
  XIAN_VIEWPORT,
} from '../lib/geo'
import {
  buildDayRoute,
  routeHintFor,
  tripRouteSummary,
  TRANSIT_LIMIT,
} from '../lib/routeHints'
import {
  Breadcrumb,
  Modal,
  Notice,
  Thumb,
  EmptyState,
} from '../components/ui'

/* 单日路线地图的折线色 */
const ROUTE_COLOR = '#b2372e'

const regionOfId = (id) => getAttraction(id)?.region

/* ==========================================================================
   行程规划
   把分散的景点信息整理成按日期排列的计划。
   支持创建行程、设置日期与同行偏好，调整顺序、移除项目、补充备注。
   概览显示日期、景点数量与地点分布，并对单日点位给出「是否顺路」提示。
   ========================================================================== */

const COMPANIONS = [
  { key: 'solo', label: '独自出行', hint: '节奏可以排得紧凑一些' },
  { key: 'couple', label: '两人同行', hint: '适合穿插拍照与休息点' },
  { key: 'family', label: '带长辈 / 亲子', hint: '建议一天一个大点，减少步行强度' },
  { key: 'friends', label: '朋友结伴', hint: '可加入夜景与街区安排' },
]

function weekendISO(today) {
  const [year, month, day] = today.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return addCalendarDays(today, (6 - weekday + 7) % 7)
}

export default function Itinerary() {
  const { join } = useJourney()
  const navigate = useNavigate()
  const [inviteCode,setInviteCode]=useState('')
  const [joining,setJoining]=useState(false)
  const [params, setParams] = useSearchParams()
  const route = ROUTES.find(r => r.id === params.get('route'))
  const preview = route ? routeTrip(route.id) : null
  const [deleteTripId, setDeleteTripId] = useState(null)
  const {
    itinerary,
    activeDay,
    setActiveDay,
    removeFromItinerary,
    moveItem,
    setItemNote,
    setItemTime,
    updateTrip,
    savedTrips,
    saveItinerary,
    loadSavedTrip,
    deleteSavedTrip,
    addDay,
    removeDay,
    clearDay,
    addToItinerary,
    isLoggedIn,
    setAuthModal,
    toast,
    savedAttractions,
  } = useApp()

  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteDayIndex, setDeleteDayIndex] = useState(null)

  const requestRemoveDay = (dayIndex) => setDeleteDayIndex(dayIndex)

  const confirmRemoveDay = () => {
    if (deleteDayIndex === null) return
    removeDay(deleteDayIndex)
    setDeleteDayIndex(null)
  }

  const openSettings = () => {
    setSettingsDraft({
      title: itinerary.title,
      startDate: itinerary.startDate,
      companions: itinerary.companions,
    })
    setSettingsOpen(true)
  }

  const saveSettings = () => {
    if (!settingsDraft?.startDate) return
    updateTrip({ ...settingsDraft, title: settingsDraft.title.trim() || itinerary.title })
    setSettingsOpen(false)
    toast('行程设置已保存', 'success')
  }

  const day = itinerary.days[activeDay]

  /* ---------- 行前清单（只读汇总，不影响行程本身的逻辑） ---------- */
  const { preItems, balance: questBalance } = useQuest()
  const tripAttractionIds = new Set(itinerary.days.flatMap((d) => d.items.map((x) => x.attractionId)))
  const tripPreItems = preItems.filter((x) => tripAttractionIds.has(x.attractionId))

  /* ---------- 行程整体统计 ---------- */
  const allItems = itinerary.days.flatMap((d) => d.items)
  const totalStops = allItems.length

  const distMap = {}
  itinerary.days.forEach((d) => {
    d.items.forEach((it) => {
      const a = getAttraction(it.attractionId)
      if (!a) return
      distMap[a.region] = (distMap[a.region] || 0) + 1
    })
  })
  const distTotal = Object.values(distMap).reduce((x, y) => x + y, 0)

  /* ---------- 全程直线里程（按天分别串联后求和） ---------- */
  const tripRoute = tripRouteSummary(itinerary.days, getGeo, regionOfId)

  /* ---------- 单日顺路判断（基于真实直线距离） ----------
     原实现只看片区数量，这里接入经纬度后给出逐段里程与总里程，
     结论文案与分档见 src/lib/routeHints.js（纯逻辑，便于单独校验）。 */
  const hint = day ? routeHintFor(day.items, getGeo, regionOfId) : null

  /* 当日路线：用于地图折线与逐段里程 */
  const dayRoute = day ? buildDayRoute(day.items, getGeo) : null

  /* 点位缺失坐标时的兜底视野：用当天片区的地理中心取平均 */
  const dayFallbackCenter = (() => {
    if (!day || !day.items.length) return XIAN_VIEWPORT.center
    const centers = day.items
      .map((it) => getRegion(getAttraction(it.attractionId)?.region)?.geo)
      .filter(Boolean)
    return centerOf(centers) || XIAN_VIEWPORT.center
  })()

  /* ---------- 单日时间与开放时间提醒 ---------- */
  function dayWarnings(items) {
    const warns = []
    const undated = items.filter((i) => !i.time)
    if (undated.length)
      warns.push(`有 ${undated.length} 个点位还没有填时间，建议补上以便按顺序执行。`)

    const closedRisk = items
      .map((i) => getAttraction(i.attractionId))
      .filter((a) => a && (a.hours.includes('周一闭馆') || a.hours.includes('周二闭馆')))
    if (closedRisk.length) {
      warns.push(
        `${closedRisk.map((a) => a.name).join('、')} 有固定闭馆日，请核对当天是否为闭馆日。`
      )
    }
    return warns
  }

  const warns = day ? dayWarnings(day.items) : []

  /* ---------- 分享摘要 ---------- */
  const summaryText = () => {
    const lines = [`【${itinerary.title}】`, `出发日期：${itinerary.startDate}`, '']
    itinerary.days.forEach((d, i) => {
      lines.push(`第 ${i + 1} 天 · ${formatDate(d.date)}`)
      if (!d.items.length) {
        lines.push('  （暂无安排）')
      } else {
        d.items.forEach((it) => {
          const a = getAttraction(it.attractionId)
          lines.push(`  ${it.time || '--:--'} ${a?.name ?? ''}${it.note ? ` · ${it.note}` : ''}`)
        })
      }
      lines.push('')
    })
    lines.push('由「驿程」生成，交通与开放时间信息仅供参考，出行前请核实。')
    return lines.join('\n')
  }

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText())
      toast('行程摘要已复制，可直接粘贴分享', 'success')
    } catch {
      toast('复制失败，请手动选择文本复制', 'warning')
    }
  }

  return (
    <div className="page">
      <div className="container">
        <Breadcrumb items={[{ label: '行程规划' }]} />
        {BACKEND_ENABLED && <form className="card card-pad row row-3 wrap" style={{marginTop:16}} onSubmit={async e=>{e.preventDefault();if(!isLoggedIn){setAuthModal('login');return}setJoining(true);const session=await join(inviteCode);setJoining(false);if(session)navigate('/play/'+session.trip.id)}}><label htmlFor="team-code">和朋友一起走</label><input id="team-code" className="input" style={{maxWidth:260}} placeholder="输入好友的邀请码" value={inviteCode} maxLength={12} onChange={e=>setInviteCode(e.target.value.toUpperCase())}/><button className="btn btn-secondary" disabled={joining||!inviteCode.trim()}>{joining?'正在加入…':'加入小队'}</button></form>}
        {preview && <section className="card card-pad route-preview">
          <span className="tag tag-gold">长安行旅 · 推荐路线</span>
          <h2>{route.name}</h2><p>{route.desc}</p>
          <p className="small muted">{route.theme} · {route.days} 天 · 出发日可调整。时间为参考，入馆前请确认预约；山间路线可按体力删减景点。</p>
          {preview.days.map((d, i) => <div className="route-preview-day" key={i}><strong>第 {i + 1} 天</strong>
            {d.items.map(item => <p key={item.id}>{item.time}　{getAttraction(item.attractionId)?.name} <span className="muted small">· 建议 {getAttraction(item.attractionId)?.duration}</span></p>)}</div>)}
          <div className="row row-2 wrap"><button className="btn btn-primary" onClick={() => {
            loadSavedTrip(preview); setParams({});
          }}>使用此路线并编辑</button><button className="btn btn-secondary" onClick={() => setParams({})}>保留原行程</button></div>
          <p className="xs muted">使用后替换当前编辑草稿，已保存的行程会保留。</p>
        </section>}

        <div className="row-between wrap row-4" style={{ marginTop: 'var(--sp-6)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--fs-h1)' }}>{itinerary.title}</h1>
            <p className="muted small" style={{ marginTop: 8 }}>
              {itinerary.startDate} 出发 · 共 {itinerary.days.length} 天 · {totalStops} 个点位
              {' · '}
              {COMPANIONS.find((c) => c.key === itinerary.companions)?.label}
            </p>
          </div>

          <div className="row row-2 wrap">
            <button className="btn btn-primary" onClick={saveItinerary}>
              保存行程
            </button>
            <button className="btn btn-secondary" onClick={openSettings}>
              行程设置
            </button>
            <button className="btn btn-secondary" onClick={() => setShareOpen(true)}>
              分享摘要
            </button>
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
              ＋ 添加景点
            </button>
          </div>
        </div>

        {!isLoggedIn && (
          <Notice kind="brand" className="mt-5">
            <div className="row-between wrap row-4">
              <span>
                你现在可以自由体验规划。<strong>登录后</strong>
                行程会被保存，可在不同设备继续编辑与管理。
              </span>
              <button className="btn btn-primary btn-sm" onClick={() => setAuthModal('login')}>
                登录以保存
              </button>
            </div>
          </Notice>
        )}

        <div className="trip-start-strip">
          <div><span className="xs muted">行程从这里开始</span><strong>{formatDate(itinerary.startDate)} 出发</strong></div>
          <button className="btn btn-secondary btn-sm" onClick={openSettings}>更改出发日</button>
        </div>

        <div className="itinerary-layout">
          {/* ---------------- 日期导航 ---------------- */}
          <nav className="day-nav" aria-label="按天浏览">
            {itinerary.days.map((d, i) => (
              <div className="day-nav-row" key={i}>
                <button
                  className={`day-nav-item ${activeDay === i ? 'on' : ''}`}
                  onClick={() => setActiveDay(i)}
                  aria-current={activeDay === i ? 'true' : undefined}
                >
                  <span className="day-badge">D{i + 1}</span>
                  <span className="day-info">
                    <span className="d1" style={{ display: 'block' }}>
                      {formatDate(d.date).split(' ')[0]}
                    </span>
                    <span className="d2">
                      {d.items.length} 个点位
                    </span>
                  </span>
                </button>
                <button
                  className="day-nav-delete"
                  onClick={() => requestRemoveDay(i)}
                  disabled={itinerary.days.length <= 1}
                  aria-label={`删除第 ${i + 1} 天`}
                >
                  删除
                </button>
              </div>
            ))}
            <button className="day-nav-item" onClick={addDay} style={{ justifyContent: 'center' }}>
              <span className="day-badge">＋</span>
              <span className="day-info">
                <span className="d1">添加一天</span>
              </span>
            </button>
          </nav>

          {/* ---------------- 单日详情 ---------------- */}
          <div>
            {day && (
              <>
                <div className="row-between wrap row-3" style={{ marginBottom: 'var(--sp-5)' }}>
                  <div>
                    <h2 style={{ fontSize: 'var(--fs-h2)' }}>
                      第 {activeDay + 1} 天
                    </h2>
                    <div className="itinerary-day-meta">
                      <p className="small muted" style={{ marginTop: 4 }}>
                        {formatDate(day.date)} · {day.items.length} 个点位
                      </p>
                    </div>
                  </div>
                  <div className="row row-2">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => clearDay(activeDay)}
                      disabled={!day.items.length}
                    >
                      清空当天
                    </button>
                  </div>
                </div>

                {/* 顺路提示 */}
                {hint && (
                  <div className={`route-hint ${hint.kind}`}>
                    <span>{hint.kind === 'good' ? '✓' : '⚠'}</span>
                    <div>
                      <strong>{hint.title}</strong>
                      <br />
                      {hint.desc}
                    </div>
                  </div>
                )}

                {/* 时间与开放时间提醒 */}
                {warns.length > 0 && (
                  <div className="stack stack-2" style={{ marginBottom: 'var(--sp-5)' }}>
                    {warns.map((w, i) => (
                      <Notice key={i} kind="warn">
                        {w}
                      </Notice>
                    ))}
                  </div>
                )}

                {/* 当日路线地图：真实底图 + 点位顺序 + 逐段直线里程 */}
                {day.items.length > 0 && (
                  <div className="card card-pad day-route-card">
                    <div className="day-route-head">
                      <div>
                        <p className="day-route-title">当日路线</p>
                        <p className="day-route-sum">
                          {(() => {
                            /* 判据必须用 stops（有坐标的点位）而不是 legs：
                               只有 1 个点位时 legs 为 0，但它确实有坐标，
                               用 legs 判断会误报「点位还没有坐标」。 */
                            const stops = dayRoute?.stops.length ?? 0
                            if (stops === 0) return '这些点位还没有坐标，暂时只能按片区估算'
                            if (stops === 1) return '1 个可定位点位 · 只有一个点位，无需计算移动距离'
                            return `${stops} 个可定位点位 · 直线移动约 ${formatDistance(
                              dayRoute.totalMeters
                            )}`
                          })()}
                        </p>
                      </div>
                      <Link className="btn btn-ghost btn-sm" to="/map">
                        在地图上细看
                      </Link>
                    </div>

                    <MapCanvas
                      className="map-canvas-day"
                      interactive
                      points={day.items
                        .map((it, idx) => {
                          const a = getAttraction(it.attractionId)
                          const g = getGeo(it.attractionId)
                          if (!a || !g) return null
                          const { lat, lng } = g
                          return {
                            id: it.id,
                            name: a.name,
                            lat,
                            lng,
                            color: getRegion(a.region)?.color || ROUTE_COLOR,
                            kind: 'attraction',
                            badge: String(idx + 1),
                            sub: a.duration,
                          }
                        })
                        .filter(Boolean)}
                      polylines={
                        dayRoute && dayRoute.stops.length > 1
                          ? [
                              {
                                id: 'day-route',
                                color: ROUTE_COLOR,
                                path: dayRoute.stops.map(({ lat, lng }) => ({ lat, lng })),
                              },
                            ]
                          : []
                      }
                      center={
                        dayRoute && dayRoute.stops.length
                          ? centerOf(dayRoute.stops) || dayFallbackCenter
                          : dayFallbackCenter
                      }
                      zoom={
                        dayRoute && dayRoute.stops.length > 1
                          ? zoomForBounds(boundsOf(dayRoute.stops), {
                              width: 820,
                              height: 380,
                              padding: 64,
                            })
                          : 13
                      }
                      notice="点位之间为直线距离，不代表实际路程；底图与路况请以官方地图服务为准。"
                      ariaLabel={`第 ${activeDay + 1} 天路线图`}
                    />

                    {dayRoute && dayRoute.legs.length > 0 && (
                      <div className="day-route-legs">
                        {dayRoute.legs.map((leg, i) => {
                          const to = getAttraction(leg.to)
                          return (
                            <span
                              className={`day-route-leg ${leg.meters > TRANSIT_LIMIT ? 'is-long' : ''}`}
                              key={`${leg.from}-${leg.to}-${i}`}
                            >
                              <span className="leg-idx">{i + 1}→{i + 2}</span>
                              <span>{to?.name ?? '下一点'}</span>
                              <span className="leg-m">{formatDistance(leg.meters)}</span>
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 时间轴 */}
                {day.items.length === 0 ? (
                  <div className="empty-day">
                    <p style={{ fontSize: 30, marginBottom: 12, color: 'var(--ink-300)' }}>◌</p>
                    <p style={{ fontWeight: 600, marginBottom: 6 }}>这一天还没有安排</p>
                    <p className="small" style={{ marginBottom: 20 }}>
                      从收藏的景点里挑几个，或者去景点库找找。
                    </p>
                    <div className="row row-2" style={{ justifyContent: 'center' }}>
                      <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
                        ＋ 添加景点
                      </button>
                      <Link className="btn btn-secondary" to="/attractions">
                        去景点库
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="timeline">
                    {day.items.map((it, idx) => {
                      const a = getAttraction(it.attractionId)
                      if (!a) return null
                      return (
                        <div className="timeline-item" key={it.id}>
                          <span className="timeline-dot" />
                          <span className="timeline-time">
                            <input
                              className="note-input"
                              style={{ width: 58, padding: '4px 6px', textAlign: 'center' }}
                              value={it.time}
                              onChange={(e) => setItemTime(activeDay, it.id, e.target.value)}
                              placeholder="--:--"
                              aria-label={`第 ${idx + 1} 个点位的时间`}
                            />
                          </span>

                          <div className="timeline-main">
                            <div className="row row-2 wrap">
                              <Link
                                to={`/attraction/${a.id}`}
                                className="timeline-name"
                                style={{ color: 'var(--ink-900)' }}
                              >
                                {a.name}
                              </Link>
                              <span className="tag tag-outline">{regionName(a.region)}</span>
                              <span className="tag tag-outline">{a.duration}</span>
                            </div>

                            <p className="xs muted" style={{ marginTop: 6 }}>
                              {a.hours} ·{' '}
                              {a.ticket?.kind === 'free' ? '免费' : `¥${a.ticket.price}`}
                            </p>

                            <input
                              className="note-input"
                              value={it.note}
                              onChange={(e) => setItemNote(activeDay, it.id, e.target.value)}
                              placeholder="补充备注，如「提前预约」「门口集合」…"
                              aria-label={`${a.name} 的备注`}
                            />
                          </div>

                          <div className="timeline-actions">
                            <button
                              className="order-btn"
                              onClick={() => moveItem(activeDay, it.id, -1)}
                              disabled={idx === 0}
                              aria-label="上移"
                              title="上移"
                            >
                              ▲
                            </button>
                            <button
                              className="order-btn"
                              onClick={() => moveItem(activeDay, it.id, 1)}
                              disabled={idx === day.items.length - 1}
                              aria-label="下移"
                              title="下移"
                            >
                              ▼
                            </button>
                            <button
                              className="order-btn"
                              onClick={() => removeFromItinerary(activeDay, it.id)}
                              aria-label="移除"
                              title="移除"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <details className="trip-tasks-disclosure">
                  <summary>查看第 {activeDay + 1} 天的自愿任务 · {day.items.length * 2} 项</summary>
                  <TripTasksPanel itinerary={itinerary} dayIndex={activeDay} />
                </details>
              </>
            )}
          </div>

          {/* ---------------- 概览侧栏 ---------------- */}
          <aside className="detail-aside">
            <div className="card card-pad saved-trip-card" style={{ marginBottom: 'var(--sp-5)' }}>
              <div className="row-between row-2">
                <h3 style={{ fontSize: 'var(--fs-body-lg)' }}>已保存行程</h3>
                <span className="tag tag-outline">{savedTrips.length}</span>
              </div>
              {savedTrips.length === 0 ? (
                <p className="xs muted" style={{ marginTop: 'var(--sp-3)', lineHeight: 1.8 }}>
                  设置好景点后点击“保存行程”，计划会显示在这里。
                </p>
              ) : savedTrips.map((trip) => (
                <div key={trip.id} className="saved-trip-entry">
                  <button className="saved-trip-summary" onClick={() => loadSavedTrip(trip)}>
                    <strong>{trip.title}</strong>
                    <span>{formatDate(trip.startDate)} · {trip.days.length} 天 · {trip.days.reduce((n, d) => n + d.items.length, 0)} 个点位</span>
                  </button>
                  <div className="row row-2 wrap">
                    <Link className="btn btn-primary btn-sm" to={`/play/${trip.id}`}>开始游玩</Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTripId(trip.id)}>删除</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="card card-pad">
              <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-4)' }}>
                行程概览
              </h3>

              <div className="stack stack-3">
                <div className="row-between small">
                  <span className="muted">出发日期</span>
                  <strong>{itinerary.startDate}</strong>
                </div>
                <div className="row-between small">
                  <span className="muted">天数</span>
                  <strong>{itinerary.days.length} 天</strong>
                </div>
                <div className="row-between small">
                  <span className="muted">点位总数</span>
                  <strong>{totalStops} 个</strong>
                </div>
                {tripRoute.totalMeters > 0 && (
                  <div className="row-between small">
                    <span className="muted">直线移动合计</span>
                    <strong>{formatDistance(tripRoute.totalMeters)}</strong>
                  </div>
                )}
                {tripRoute.spreadDays > 0 && (
                  <div className="row-between small">
                    <span className="muted">跨片区天数</span>
                    <strong style={{ color: 'var(--warning-600)' }}>
                      {tripRoute.spreadDays} 天
                    </strong>
                  </div>
                )}
                <div className="row-between small">
                  <span className="muted">同行偏好</span>
                  <strong>{COMPANIONS.find((c) => c.key === itinerary.companions)?.label}</strong>
                </div>
              </div>

              <div className="divider" style={{ margin: 'var(--sp-4) 0' }} />

              <p className="label" style={{ marginBottom: 'var(--sp-2)' }}>
                地点分布
              </p>
              {distTotal === 0 ? (
                <p className="xs muted">还没有添加点位，分布会显示在这里。</p>
              ) : (
                <>
                  <div className="dist-bar">
                    {REGIONS.filter((r) => distMap[r.key]).map((r) => (
                      <span
                        key={r.key}
                        className="dist-seg"
                        style={{
                          width: `${(distMap[r.key] / distTotal) * 100}%`,
                          background: r.color,
                        }}
                        title={`${r.name} ${distMap[r.key]} 个`}
                      />
                    ))}
                  </div>
                  <div className="dist-legend">
                    {REGIONS.filter((r) => distMap[r.key]).map((r) => (
                      <span className="dist-legend-item" key={r.key}>
                        <span className="sw" style={{ background: r.color }} />
                        {r.name}
                        <span className="ct">{distMap[r.key]}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}

              <Link
                className="btn btn-secondary btn-block btn-sm"
                to="/map"
                style={{ marginTop: 'var(--sp-4)' }}
              >
                在地图上看分布
              </Link>
            </div>

            <div className="card card-pad">
              <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-3)' }}>
                收藏的景点
              </h3>
              {savedAttractions.length === 0 ? (
                <p className="xs muted">
                  还没有收藏景点。在景点页点击 ☆ 即可收藏，之后可快速加入行程。
                </p>
              ) : (
                <div className="stack stack-2">
                  {savedAttractions.slice(0, 6).map((id) => {
                    const a = getAttraction(id)
                    if (!a) return null
                    return (
                      <div key={id} className="row row-2">
                        <Link
                          to={`/attraction/${a.id}`}
                          className="grow small clamp-1"
                          style={{ fontWeight: 600 }}
                        >
                          {a.name}
                        </Link>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => addToItinerary(a.id, activeDay)}
                          title={`加入第 ${activeDay + 1} 天`}
                        >
                          ＋
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <Notice kind="quiet">
              行程中的交通与开放时间提示为<strong>参考信息</strong>，
              平台暂不提供路线计算与实时交通，请以地图应用与官方公告为准。
            </Notice>
          </aside>
        </div>
      </div>

      {/* ---------------- 添加景点 ---------------- */}
      {addOpen && (
        <AddAttractionModal
          onClose={() => setAddOpen(false)}
          savedAttractions={savedAttractions}
          onAdd={(aid) => {
            addToItinerary(aid, activeDay)
            setAddOpen(false)
          }}
        />
      )}

      {/* ---------------- 行程设置 ---------------- */}
      {settingsOpen && settingsDraft && (
        <Modal
          title="行程设置"
          desc="调整行程名称、出发日期与同行偏好。"
          onClose={() => setSettingsOpen(false)}
          footer={
            <div className="row row-2">
              <button className="btn btn-secondary" onClick={() => setSettingsOpen(false)}>取消</button>
              <button className="btn btn-primary" onClick={saveSettings}>保存设置</button>
            </div>
          }
        >
          <div className="stack stack-4">
            <div className="field">
              <label className="label" htmlFor="tripTitle">
                行程名称
              </label>
              <input
                id="tripTitle"
                className="input"
                value={settingsDraft.title}
                onChange={(e) => setSettingsDraft((draft) => ({ ...draft, title: e.target.value }))}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="startDate">
                出发日期
              </label>
              <input
                id="startDate"
                type="date"
                className="input"
                value={settingsDraft.startDate}
                onChange={(e) => {
                  const v = e.target.value
                  if (!v) return
                  setSettingsDraft((draft) => ({ ...draft, startDate: v }))
                }}
              />
              <div className="date-quick-actions" aria-label="快速选择出发日">
                {[['今天', localTodayISO()], ['明天', addCalendarDays(localTodayISO(), 1)], ['本周末', weekendISO(localTodayISO())]].map(([label, date]) => (
                  <button key={label} type="button" className={`btn btn-sm ${settingsDraft.startDate === date ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSettingsDraft((draft) => ({ ...draft, startDate: date }))}>{label}</button>
                ))}
              </div>
              <p className="field-hint">保存后第 1 天从 {formatDate(settingsDraft.startDate)} 开始，现有景点随日期一起顺延。</p>
            </div>

            <div className="field">
              <label className="label">同行偏好</label>
              <div className="companion-options">
                {COMPANIONS.map((c) => (
                  <label
                    key={c.key}
                    className="check"
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--border-subtle)',
                      background:
                        settingsDraft.companions === c.key ? 'var(--cinnabar-50)' : 'var(--paper-0)',
                    }}
                  >
                    <input
                      type="radio"
                      name="companions"
                      checked={settingsDraft.companions === c.key}
                      onChange={() => setSettingsDraft((draft) => ({ ...draft, companions: c.key }))}
                    />
                    <span>
                      <strong>{c.label}</strong>
                      <br />
                      <span className="xs muted">{c.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {deleteDayIndex !== null && itinerary.days[deleteDayIndex] && (
        <Modal
          title={`确定删除第 ${deleteDayIndex + 1} 天吗？`}
          desc={`这一天有 ${itinerary.days[deleteDayIndex].items.length} 个点位，删除后当天安排会一并移除。`}
          onClose={() => setDeleteDayIndex(null)}
          footer={
            <div className="row row-2">
              <button className="btn btn-secondary" onClick={() => setDeleteDayIndex(null)}>
                取消
              </button>
              <button className="btn btn-primary btn-confirm-danger" onClick={confirmRemoveDay}>
                确定删除
              </button>
            </div>
          }
        >
          <Notice kind="warn">
            删除后，后面的日期会自动顺延。这个操作无法撤销。
          </Notice>
        </Modal>
      )}

      {deleteTripId && <Modal title="删除这份已保存行程？" onClose={() => setDeleteTripId(null)} footer={<><button className="btn btn-secondary" onClick={() => setDeleteTripId(null)}>取消</button><button className="btn btn-primary" onClick={() => { deleteSavedTrip(deleteTripId); setDeleteTripId(null) }}>确定删除</button></>}><p>历史游玩记录仍会保留。</p></Modal>}
      {/* ---------------- 分享摘要 ---------------- */}
      {shareOpen && (
        <Modal
          title="分享行程摘要"
          desc="把行程整理成一段文字，方便发给自己或同行的人。"
          onClose={() => setShareOpen(false)}
          size="modal-lg"
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShareOpen(false)}>
                关闭
              </button>
              <button className="btn btn-primary" onClick={copySummary}>
                复制摘要
              </button>
            </>
          }
        >
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--fs-sm)',
              lineHeight: 1.8,
              padding: 'var(--sp-5)',
              background: 'var(--paper-100)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--r-md)',
              maxHeight: 340,
              overflowY: 'auto',
              margin: 0,
            }}
          >
            {summaryText()}
          </pre>
          <Notice kind="quiet" className="mt-4">
            摘要中的门票与开放时间信息为平台整理的参考值，请以官方渠道为准。
          </Notice>
        </Modal>
      )}
    </div>
  )
}

/* ==========================================================================
   添加景点弹窗：按区域与搜索快速定位
   ========================================================================== */
function AddAttractionModal({ onClose, onAdd, savedAttractions }) {
  const [kw, setKw] = useState('')
  const [region, setRegion] = useState('')

  const list = attractions.filter((a) => {
    if (region && a.region !== region) return false
    if (kw.trim()) {
      const k = kw.trim().toLowerCase()
      return (a.name + a.type + a.summary + regionName(a.region)).toLowerCase().includes(k)
    }
    return true
  })

  return (
    <Modal
      title="添加景点到行程"
      desc="可以从收藏里快速添加，也可以按区域或关键词搜索。"
      onClose={onClose}
      size="modal-lg"
      footer={
        <button className="btn btn-secondary" onClick={onClose}>
          完成
        </button>
      }
    >
      {savedAttractions.length > 0 && (
        <div style={{ marginBottom: 'var(--sp-5)' }}>
          <p className="label" style={{ marginBottom: 'var(--sp-3)' }}>
            我的收藏
          </p>
          <div className="filter-chips">
            {savedAttractions.map((id) => {
              const a = getAttraction(id)
              if (!a) return null
              return (
                <button key={id} className="chip" onClick={() => onAdd(id)}>
                  ＋ {a.name}
                </button>
              )
            })}
          </div>
          <div className="divider" style={{ margin: 'var(--sp-5) 0' }} />
        </div>
      )}

      <div className="stack stack-3">
        <input
          className="input"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="搜索景点名称或关键词"
          aria-label="搜索景点"
        />

        <div className="filter-chips">
          <button className={`chip ${!region ? 'on' : ''}`} onClick={() => setRegion('')}>
            全部区域
          </button>
          {REGIONS.map((r) => (
            <button
              key={r.key}
              className={`chip ${region === r.key ? 'on' : ''}`}
              onClick={() => setRegion(r.key)}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      <div className="stack stack-2" style={{ marginTop: 'var(--sp-4)', maxHeight: 300, overflowY: 'auto' }}>
        {list.length === 0 ? (
          <EmptyState
            icon="?"
            title="没有匹配的景点"
            desc="换个关键词，或者切换区域试试。"
            actions={null}
          />
        ) : (
          list.map((a) => (
            <button key={a.id} className="region-card" onClick={() => onAdd(a.id)}>
              <span className="record-thumb" style={{ width: 42, height: 42 }}>
                <Thumb tone={a.tone} label="" />
              </span>
              <span className="grow" style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', display: 'block' }}>
                  {a.name}
                </span>
                <span className="xs muted">
                  {regionName(a.region)} · {a.type} · {a.duration}
                </span>
              </span>
              <span className="tag tag-outline">
                {a.ticket?.kind === 'free' ? '免费' : `¥${a.ticket.price}`}
              </span>
            </button>
          ))
        )}
      </div>
    </Modal>
  )
}
