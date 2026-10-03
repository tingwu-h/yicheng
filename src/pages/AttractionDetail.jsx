import { Component, lazy, Suspense, useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  getAttraction,
  regionName,
  getRegion,
  attractions,
} from '../data/attractions'
import { useApp } from '../store/AppContext'
import { useQuest } from '../store/QuestContext'
import PreItemPicker from '../components/PreItemPicker'
import { TripTasksPanel, CustomTasksPanel } from '../components/Vh02TaskPanels'
import {
  Thumb,
  Breadcrumb,
  Modal,
  Notice,
  SourceNote,
  EmptyState,
} from '../components/ui'
import { formatDate } from '../store/AppContext'
import { posts as seedPosts, topicName } from '../data/community'
import { PRE_ITEM_CATEGORIES } from '../data/questConfig'
import { attractionModels } from '../data/attractionModels'
import { toLatLng, haversine, formatDistance, bearingHint } from '../lib/geo'

const AttractionModel = lazy(() => import('../components/AttractionModel'))

/* 位置小地图：复用 ../map 的 MapCanvas，按需加载，失败有兜底 */
const MapCanvas = lazy(() =>
  import('../map').then((m) => ({ default: m.MapCanvas ?? m.default }))
)

/* 钟楼 —— 「距钟楼直线距离」的参照点 */
const CLOCK_TOWER = { lat: 34.261, lng: 108.945 }

/* 小地图初始缩放：单点高亮 + 同片区邻近点位 */
const MINI_ZOOM = 13

/* 小地图最多淡显的同片区邻近点数 */
const MINI_NEARBY_MAX = 6

/* ==========================================================================
   景点详情
   信息按「基本信息 / 怎么去 / 怎么玩 / 游客经验」分组呈现，
   重要信息标注更新时间与核实提示。
   ========================================================================== */

const TABS = [
  { key: 'basic', label: '基本信息' },
  { key: 'model', label: '3D 模型' },
  { key: 'howto', label: '怎么去' },
  { key: 'tasks', label: '景点任务' },
  { key: 'play', label: '怎么玩' },
  { key: 'exp', label: '游客经验' },
]

export default function AttractionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const a = getAttraction(id)
  const model = attractionModels[id]

  const {
    isAttractionSaved,
    toggleSaveAttraction,
    addToItinerary,
    itinerary,
    pushHistory,
    toast,
  } = useApp()

  const [tab, setTab] = useState('basic')
  const [dayOpen, setDayOpen] = useState(false)
  const [expSort, setExpSort] = useState('hot')
  const [pickerOpen, setPickerOpen] = useState(false)

  /* 预录项目（「想玩 / 想拍 / 想体验」） */
  const { preItemsOf, removePreItem, togglePreItemRemind, prefs: questPrefs } = useQuest()

  useEffect(() => {
    setTab('basic')
  }, [id])

  /* 记录浏览历史 */
  useEffect(() => {
    if (a) {
      pushHistory({ type: 'attraction', id: a.id, title: a.name, tone: a.tone })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!a) {
    return (
      <div className="container page">
        <EmptyState
          icon="?"
          title="没有找到这个景点"
          desc="它可能已被移除，或者链接不正确。"
          actions={
            <Link className="btn btn-primary" to="/attractions">
              返回景点库
            </Link>
          }
        />
      </div>
    )
  }

  const saved = isAttractionSaved(a.id)
  const region = getRegion(a.region)
  const free = a.ticket?.kind === 'free'
  const myItems = preItemsOf(a.id)

  const relatedPosts = seedPosts
    .filter((p) => p.attraction === a.id)
    .sort((x, y) => (expSort === 'hot' ? y.likes - x.likes : (y.createdAt > x.createdAt ? 1 : -1)))

  const nearby = attractions
    .filter((x) => x.region === a.region && x.id !== a.id)
    .slice(0, 3)

  /* ---------- 位置参考：真实坐标衍生信息（无坐标时整块不渲染） ---------- */
  const selfGeo = toLatLng(a.geo)
  const regionCenter = toLatLng(region?.geo)
  const clockTower = toLatLng(CLOCK_TOWER)
  const regionTint = typeof region?.color === 'string' ? region.color : '#B2372E'

  const nearbyWithGeo = selfGeo
    ? attractions
        .filter((x) => x.region === a.region && x.id !== a.id)
        .map((x) => ({ item: x, geo: toLatLng(x.geo) }))
        .filter((r) => r.geo)
        .map((r) => ({ ...r, meters: haversine(selfGeo, r.geo) }))
        .sort((p, q) => p.meters - q.meters)
        .slice(0, MINI_NEARBY_MAX)
    : []

  const miniPoints = selfGeo
    ? [
        {
          id: a.id,
          name: itinerary.days.some((d) => d.items.some((it) => it.attractionId === a.id)) ? a.name + ' · 行程打卡参考点' : a.name,
          kind: 'attraction',
          lat: selfGeo.lat,
          lng: selfGeo.lng,
          color: regionTint,
          badge: '★',
        },
        ...nearbyWithGeo.map((r) => ({
          id: r.item.id,
          name: r.item.name,
          kind: 'attraction',
          lat: r.geo.lat,
          lng: r.geo.lng,
          /* 8 位十六进制 = 在片区色上叠透明度，用于「同片区邻近点位淡显」 */
          color: `${regionTint}66`,
          sub: formatDistance(r.meters),
        })),
      ]
    : []

  const metersToClockTower =
    selfGeo && clockTower ? haversine(selfGeo, clockTower) : null
  const bearingFromRegion =
    selfGeo && regionCenter ? bearingHint(regionCenter, selfGeo) : null

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast('链接已复制到剪贴板', 'success')
    } catch {
      toast('复制失败，请手动复制地址栏链接', 'warning')
    }
  }

  return (
    <div className="page">
      <div className="container">
        <Breadcrumb
          items={[
            { label: '景点库', to: '/attractions' },
            { label: region.name, to: `/attractions?region=${a.region}` },
            { label: a.name },
          ]}
        />

        <button className="back-link" onClick={() => navigate(-1)}>
          ← 返回上一页
        </button>

        {/* ---------------- 头图 ---------------- */}
        <div className="detail-hero">
          <Thumb src={a.image} alt={a.name} tone={a.tone} label={a.name.slice(0, 4)} />
          <div className="detail-hero-mask">
            <div className="row row-2 wrap" style={{ marginBottom: 'var(--sp-3)' }}>
              <span className="tag" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>
                {region.name}
              </span>
              <span className="tag" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>
                {a.type}
              </span>
              {a.seasons.slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="tag"
                  style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}
                >
                  {s}
                </span>
              ))}
            </div>

            <h1 className="detail-title">{a.name}</h1>
            {a.alias && (
              <p style={{ color: 'rgba(255,255,255,.75)', marginTop: 6 }}>又称「{a.alias}」</p>
            )}

            <div className="detail-meta">
              <span>★ {a.rating}（{a.reviews} 条点评）</span>
              <span>{a.favorites} 人收藏</span>
              <span>{a.duration}</span>
            </div>
          </div>
        </div>

        <div className="detail-layout">
          {/* ---------------- 主内容 ---------------- */}
          <div>
            <div className="action-bar" style={{ marginBottom: 'var(--sp-6)' }}>
              <button
                className={`btn ${saved ? 'btn-gold' : 'btn-primary'}`}
                onClick={() => toggleSaveAttraction(a.id, a.name)}
              >
                {saved ? '★ 已收藏' : '☆ 收藏景点'}
              </button>
              <button className="btn btn-secondary" onClick={() => setDayOpen(true)}>
                ＋ 加入行程
              </button>
              <button className="btn btn-secondary" onClick={share}>
                分享
              </button>
            </div>

            {/* ---------------- 我的清单（预录项目） ---------------- */}
            <section className="pre-block">
              <div className="row-between wrap row-2">
                <div>
                  <h3 className="pre-block-title">
                    想玩的项目
                    {myItems.length > 0 && <span className="tag tag-outline" style={{ marginLeft: 8 }}>{myItems.length}</span>}
                  </h3>
                  <p className="xs muted">
                    先记下来，到了地方再由你决定做不做。不记录也不影响收藏与行程。
                  </p>
                </div>

                <div className="row row-2">
                  {myItems.length > 0 && (
                    <Link className="btn btn-ghost btn-sm" to="/tasks">
                      去任务中心
                    </Link>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => setPickerOpen(true)}>
                    ＋ 记录想玩的项目
                  </button>
                </div>
              </div>

              {myItems.length > 0 && (
                <div className="stack stack-2" style={{ marginTop: 'var(--sp-4)' }}>
                  {myItems.map((it) => {
                    const cat = PRE_ITEM_CATEGORIES.find((c) => c.key === it.category) ?? PRE_ITEM_CATEGORIES[0]
                    return (
                      <div key={it.id} className="pre-item">
                        <span className="poi-icon" aria-hidden="true">
                          {cat.icon}
                        </span>
                        <div className="grow" style={{ minWidth: 0 }}>
                          <p className="small clamp-2" style={{ fontWeight: 700 }}>
                            {it.name}
                          </p>
                          <p className="xs muted">
                            {cat.label} · 期望 {it.expectedTime}
                          </p>
                        </div>
                        <label className="check" title="是否允许提醒这一项">
                          <input
                            type="checkbox"
                            checked={it.remindEnabled !== false}
                            onChange={(e) => togglePreItemRemind(it.id, e.target.checked)}
                            aria-label={`提醒开关：${it.name}`}
                          />
                          <span className="xs">{it.remindEnabled !== false ? '提醒' : '静默'}</span>
                        </label>
                        <button className="btn btn-ghost btn-sm" onClick={() => removePreItem(it.id)}>
                          移除
                        </button>
                      </div>
                    )
                  })}

                  {(!questPrefs.featureEnabled || !questPrefs.remindEnabled) && (
                    <p className="xs muted">
                      提醒当前是关闭状态，这些项目不会触发任何任务卡。
                      <Link to="/tasks?tab=prefs" style={{ color: 'var(--cinnabar-700)', marginLeft: 6 }}>
                        去打开
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </section>

            <div className="tabs" role="tablist">
              {TABS.filter((t) => t.key !== 'model' || model).map((t) => (
                <button
                  key={t.key}
                  className={`tab ${tab === t.key ? 'on' : ''}`}
                  onClick={() => setTab(t.key)}
                  role="tab"
                  aria-selected={tab === t.key}
                >
                  {t.label}
                  {t.key === 'exp' && relatedPosts.length > 0 && (
                    <span className="tag tag-outline" style={{ marginLeft: 6 }}>
                      {relatedPosts.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* 基本信息 */}
            {tab === 'basic' && (
              <div>
                <div className="info-block">
                  <h3>景点介绍</h3>
                  {a.intro.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>

                <div className="info-block">
                  <h3>实用信息</h3>
                  <div className="info-row-cards">
                    <div className="info-tile">
                      <div className="k">开放时间</div>
                      <div className="v">{a.hours}</div>
                    </div>
                    <div className="info-tile">
                      <div className="k">门票</div>
                      <div className="v" style={{ color: free ? 'var(--success-600)' : 'var(--cinnabar-700)' }}>
                        {free ? '免费' : `¥${a.ticket.price}`}
                      </div>
                    </div>
                    <div className="info-tile">
                      <div className="k">建议游玩时长</div>
                      <div className="v">{a.duration}</div>
                    </div>
                    <div className="info-tile">
                      <div className="k">最佳时段</div>
                      <div className="v">{a.bestTime}</div>
                    </div>
                  </div>
                  {a.ticket?.note && (
                    <p className="small muted" style={{ marginTop: 'var(--sp-3)' }}>
                      票务说明：{a.ticket.note}
                    </p>
                  )}
                </div>

                <div className="info-block">
                  <h3>特色看点</h3>
                  <ul className="tips">
                    {a.highlights.map((h, i) => (
                      <li className="tip-item" key={i}>
                        <span className="ti">◆</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <SourceNote updatedAt={a.updatedAt} source="平台整理自公开信息" />
              </div>
            )}

            {tab === 'model' && model && (
              <Suspense fallback={<p className="small muted">正在准备 3D 查看器…</p>}>
                <AttractionModel key={a.id} name={a.name} model={model} />
              </Suspense>
            )}

            {/* 怎么去 */}
            {tab === 'howto' && (
              <div>
                <div className="info-block">
                  <h3>地址</h3>
                  <p>{a.address}</p>
                </div>

                <div className="info-block">
                  <h3>交通方式</h3>
                  <p>{a.transport}</p>
                  <Notice kind="warn" className="mt-4">
                    本页不提供实时交通与路线计算，以上为一般性出行参考。
                    实际耗时受路况影响，请以地图应用与现场指引为准。
                  </Notice>
                </div>

                {/* 位置小地图：无坐标的景点整块不渲染，不留空白容器 */}
                {selfGeo && (
                  <div className="info-block">
                    <h3>位置小地图</h3>
                    <p className="small muted" style={{ marginBottom: 'var(--sp-4)' }}>
                      ★ 为景点中心参考点；加入行程后也是任务打卡的位置示意，不代表景区内部精确机位。
                      同片区邻近点位淡显（最多 {MINI_NEARBY_MAX} 个），地图可缩放查看。
                    </p>

                    <MapErrorBoundary className="map-canvas-mini">
                      <Suspense
                        fallback={
                          <div className="map-shell map-canvas-mini">
                            <div className="map-loading">正在加载位置地图…</div>
                          </div>
                        }
                      >
                        <MapCanvas
                          points={miniPoints}
                          center={selfGeo}
                          zoom={MINI_ZOOM}
                          activeId={a.id}
                          lockCenter
                          className="map-canvas-mini"
                          notice="底图由高德地图提供，仅供位置参考"
                          ariaLabel={`${a.name} 位置示意图`}
                        />
                      </Suspense>
                    </MapErrorBoundary>

                    <ul className="tips" style={{ marginTop: 'var(--sp-4)' }}>
                      {Number.isFinite(metersToClockTower) && (
                        <li className="tip-item">
                          <span className="ti">◆</span>
                          <span>
                            距钟楼直线距离约 {formatDistance(metersToClockTower)}
                            （直线距离，非实际路程）
                          </span>
                        </li>
                      )}
                      {bearingFromRegion && (
                        <li className="tip-item">
                          <span className="ti">◆</span>
                          <span>
                            位于「{region.name}」片区中心的{bearingFromRegion}方向
                            （直线距离，非实际路程）
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="info-block">
                  <h3>同片区顺路点位</h3>
                  <p className="small muted" style={{ marginBottom: 'var(--sp-4)' }}>
                    以下景点与「{a.name}」同属 {region.name} 片区，距离相对较近，适合安排在同一天。
                  </p>
                  <div className="stack stack-3">
                    {nearby.map((n) => (
                      <Link key={n.id} to={`/attraction/${n.id}`} className="record-row">
                        <span className="record-thumb">
                          <Thumb src={n.image} alt={n.name} tone={n.tone} label="" />
                        </span>
                        <span className="grow">
                          <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', display: 'block' }}>
                            {n.name}
                          </span>
                          <span className="xs muted">
                            {n.type} · {n.duration}
                          </span>
                        </span>
                        <span className="tag tag-outline">{n.ticket?.kind === 'free' ? '免费' : `¥${n.ticket.price}`}</span>
                      </Link>
                    ))}
                    {nearby.length === 0 && (
                      <p className="small muted">该片区暂无其他收录景点。</p>
                    )}
                  </div>
                </div>

                <SourceNote updatedAt={a.updatedAt} source="平台整理自公开信息" />
              </div>
            )}

            {tab === 'tasks' && (
              <div className="attraction-task-detail">
                <div className="card card-pad">
                  <h3 className="card-title">{a.name} · 任务明细</h3>
                  <p className="small muted">完成任务完全自愿，不完成没有惩罚。行程打卡和拍照任务只有加入行程后才会生成，并在安排的当天开放。</p>
                  <div className="task-detail-summary">
                    <span><strong>现场打卡</strong> · 2 金币</span>
                    <span><strong>风景拍照</strong> · 3 金币</span>
                    <span><strong>首次完成</strong> · 景点纪念服饰</span>
                  </div>
                  {!itinerary.days.some((day) => day.items.some((item) => item.attractionId === a.id)) && (
                    <button className="btn btn-primary btn-sm" onClick={() => setDayOpen(true)}>加入行程后查看可完成日期</button>
                  )}
                </div>
                <TripTasksPanel itinerary={itinerary} attractionId={a.id} detailed />
                <CustomTasksPanel attractionId={a.id} />
                <p className="small muted">位置以“怎么去”页签里的二维地图标记为参考，不代表景区内部精确拍摄机位。</p>
              </div>
            )}

            {/* 怎么玩 */}
            {tab === 'play' && (
              <div>
                <div className="info-block">
                  <h3>游玩建议</h3>
                  <div className="info-row-cards">
                    <div className="info-tile">
                      <div className="k">建议时长</div>
                      <div className="v">{a.duration}</div>
                    </div>
                    <div className="info-tile">
                      <div className="k">推荐时段</div>
                      <div className="v">{a.bestTime}</div>
                    </div>
                  </div>
                </div>

                <div className="info-block">
                  <h3>实用提醒</h3>
                  <ul className="tips">
                    {a.tips.map((t, i) => (
                      <li className="tip-item" key={i}>
                        <span className="ti">·</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Notice kind="info">
                  以上建议由平台与游客经验综合整理，属于参考信息。
                  开放时间、票价与交通随时可能调整，出行前请以官方渠道为准。
                </Notice>
              </div>
            )}

            {/* 游客经验 */}
            {tab === 'exp' && (
              <div>
                <div className="row-between wrap row-3" style={{ marginBottom: 'var(--sp-5)' }}>
                  <p className="small muted">
                    以下为用户个人经验分享，不代表官方信息
                  </p>
                  <div className="segment">
                    <button
                      className={expSort === 'hot' ? 'on' : ''}
                      onClick={() => setExpSort('hot')}
                    >
                      按有用程度
                    </button>
                    <button
                      className={expSort === 'new' ? 'on' : ''}
                      onClick={() => setExpSort('new')}
                    >
                      按时间
                    </button>
                  </div>
                </div>

                {relatedPosts.length === 0 ? (
                  <EmptyState
                    icon="✎"
                    title="还没有关于这个景点的游记"
                    desc="你可以成为第一个分享经验的人，也可以先去社区看看其他景点。"
                    tone="info"
                    actions={
                      <>
                        <Link className="btn btn-primary" to="/publish">
                          写一篇游记
                        </Link>
                        <Link className="btn btn-secondary" to="/community">
                          逛社区
                        </Link>
                      </>
                    }
                  />
                ) : (
                  <div className="stack stack-5">
                    {relatedPosts.map((p) => (
                      <Link
                        key={p.id}
                        to={`/post/${p.id}`}
                        className="card card-pad card-hover"
                        style={{ display: 'block' }}
                      >
                        <div className="row row-2" style={{ marginBottom: 10 }}>
                          <span className="tag tag-cinnabar">{topicName(p.topic)}</span>
                          <span className="xs muted">{p.createdAt}</span>
                        </div>
                        <h3 className="card-title clamp-2">{p.title}</h3>
                        <p className="small muted clamp-2" style={{ marginTop: 8 }}>
                          {p.excerpt}
                        </p>
                        <div className="meta" style={{ marginTop: 12 }}>
                          <span>♥ {p.likes}</span>
                          <span className="dot-sep">💬 {p.comments}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ---------------- 侧栏 ---------------- */}
          <aside className="detail-aside">
            <div className="card card-pad">
              <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-4)' }}>
                实用信息
              </h3>
              <dl className="info-list">
                <div className="info-row">
                  <dt>开放时间</dt>
                  <dd>{a.hours}</dd>
                </div>
                <div className="info-row">
                  <dt>门票</dt>
                  <dd style={{ color: free ? 'var(--success-600)' : 'var(--cinnabar-700)', fontWeight: 700 }}>
                    {free ? '免费开放' : `¥${a.ticket.price}`}
                  </dd>
                </div>
                <div className="info-row">
                  <dt>建议时长</dt>
                  <dd>{a.duration}</dd>
                </div>
                <div className="info-row">
                  <dt>所在区域</dt>
                  <dd>
                    <Link to={`/attractions?region=${a.region}`} style={{ color: 'var(--cinnabar-700)' }}>
                      {region.name}
                    </Link>
                  </dd>
                </div>
                <div className="info-row">
                  <dt>地址</dt>
                  <dd>{a.address}</dd>
                </div>
              </dl>
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <SourceNote updatedAt={a.updatedAt} />
              </div>
            </div>

            <div className="card card-pad">
              <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-4)' }}>
                大家的评价
              </h3>
              <div className="row row-3" style={{ alignItems: 'baseline' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 34,
                    fontWeight: 700,
                    color: 'var(--cinnabar-700)',
                    lineHeight: 1,
                  }}
                >
                  {a.rating}
                </span>
                <span className="small muted">/ 5.0 · {a.reviews} 条点评</span>
              </div>
              <div className="divider" style={{ margin: 'var(--sp-4) 0' }} />
              <p className="xs muted">
                评分来自游客分享内容与平台整理，仅作参考，不构成对景点的质量承诺。
              </p>
            </div>

            <div className="card card-pad">
              <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-3)' }}>
                准备好出发了吗
              </h3>
              <p className="small muted" style={{ marginBottom: 'var(--sp-4)' }}>
                把「{a.name}」加入你的行程，按日期整理成可执行的安排。
              </p>
              <div className="stack stack-2">
                <button className="btn btn-primary btn-block" onClick={() => setDayOpen(true)}>
                  ＋ 加入行程
                </button>
                <button
                  className="btn btn-secondary btn-block"
                  onClick={() => toggleSaveAttraction(a.id, a.name)}
                >
                  {saved ? '★ 已收藏' : '☆ 先收藏起来'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ---------------- 加入行程：选择日期 ---------------- */}
      {dayOpen && (
        <Modal
          title="加入行程"
          desc="选择要把这个景点安排到哪一天。加入后仍可在行程页调整顺序或移除。"
          onClose={() => setDayOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setDayOpen(false)}>
                取消
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setDayOpen(false)
                  navigate('/itinerary')
                }}
              >
                去行程页看看
              </button>
            </>
          }
        >
          <div className="stack stack-3">
            {itinerary.days.map((d, i) => {
              const already = d.items.some((x) => x.attractionId === a.id)
              return (
                <button
                  key={i}
                  className={`region-card ${already ? 'on' : ''}`}
                  onClick={() => {
                    if (already) {
                      toast(`「${a.name}」已在这一天里`, 'warning')
                      return
                    }
                    addToItinerary(a.id, i)
                    setDayOpen(false)
                  }}
                >
                  <span className="day-badge">D{i + 1}</span>
                  <span className="grow">
                    <span style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', display: 'block' }}>
                      {formatDate(d.date)}
                    </span>
                    <span className="xs muted">
                      {d.items.length === 0
                        ? '当天还没有安排'
                        : `已有 ${d.items.length} 个点位`}
                    </span>
                  </span>
                  <span className="tag tag-outline">
                    {already ? '已在行程中' : '加入这天'}
                  </span>
                </button>
              )
            })}
          </div>

          <Notice kind="quiet" className="mt-4">
            行程中的交通与开放时间提示为参考信息，平台暂不提供路线计算与实时交通。
          </Notice>
        </Modal>
      )}

      {/* 预录项目选择器 */}
      {pickerOpen && <PreItemPicker attraction={a} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}

/* ==========================================================================
   位置小地图兜底
   引擎加载失败时只影响小地图本身，页面其余信息照常显示。
   ========================================================================== */
class MapErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className={`map-shell ${this.props.className ?? ''}`}>
          <div className="map-empty">
            <p>位置地图加载失败，地址与交通信息仍可正常查看。</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
