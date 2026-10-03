import { Component, Suspense, lazy, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  attractions,
  REGIONS,
  getAttraction,
  getRegion,
  regionColor,
  regionName,
} from '../data/attractions'
import { useApp } from '../store/AppContext'
import { Breadcrumb, Notice, Thumb, EmptyState } from '../components/ui'
import {
  XIAN_VIEWPORT,
  toLatLng,
  boundsOf,
  centerOf,
  zoomForBounds,
  haversine,
  formatDistance,
  routeStats,
} from '../lib/geo'

/* ==========================================================================
   地图 / 地理视图
   西安的景点分布是强地理概念：城墙内、曲江、临潼、高新、秦岭北麓彼此距离很远。
   本页接入真实地图（高德栅格瓦片 / 高德 JS SDK / 离线自绘底图降级），
   提供地图总览、按片区聚类与视野定位，并用真实坐标分析行程中单日的「是否顺路」。

   合规说明：底图由高德地图提供，仅供位置参考；
   平台不提供实时路况、导航与测距，页面中的距离均为直线距离。
   ========================================================================== */

/* 引擎按需加载：首屏只渲染页面骨架；命名导出 / 默认导出两种写法都兼容 */
const MapCanvas = lazy(() =>
  import('../map').then((m) => ({ default: m.MapCanvas ?? m.default }))
)

const REGION_PREFIX = 'region:'

/* 超过这个直线距离，逐段里程用警示色（与行程页阈值一致） */
const LONG_LEG_METERS = 15000

/* 契约 A：REGIONS[].geo —— 统一转成 {lat,lng}，无坐标返回 null。
   命名上避开 T1 在 ../data/attractions 里新增的导出（getGeo / pointsForIds / regionGeo），
   防止将来改成具名 import 时同名函数冲突。 */
const regionGeoOf = (key) => toLatLng(getRegion(key)?.geo)

export default function MapView() {
  const { itinerary, addToItinerary, activeDay, isLoggedIn, toast } = useApp()

  const days = itinerary?.days ?? []

  const [activeRegion, setActiveRegion] = useState(null) // 当前视野已定位的片区
  const [selectedId, setSelectedId] = useState(null) // 当前选中的景点（信息卡）
  const [view, setView] = useState({
    center: { ...XIAN_VIEWPORT.center },
    zoom: XIAN_VIEWPORT.zoom,
  })
  const mapBoxRef = useRef(null)

  /* ---------- 按片区聚类 ---------- */
  const byRegion = useMemo(
    () =>
      REGIONS.map((r) => ({
        ...r,
        items: attractions.filter((a) => a.region === r.key),
      })),
    []
  )

  /* ---------- 地图标记：5 个片区 + 24 个景点 ---------- */
  const mapPoints = useMemo(() => {
    const regionPoints = byRegion
      .map((r) => {
        const g = regionGeoOf(r.key)
        if (!g) return null
        return {
          id: `${REGION_PREFIX}${r.key}`,
          name: r.name,
          kind: 'region',
          lat: g.lat,
          lng: g.lng,
          color: r.color,
          /* 不设 sub：数量已由 badge 徽标承载，避免标签里出现两次数字 */
          badge: String(r.items.length),
        }
      })
      .filter(Boolean)

    const attractionPoints = attractions
      .map((a) => {
        const g = toLatLng(a.geo)
        if (!g) return null
        return {
          id: a.id,
          name: a.name,
          kind: 'attraction',
          lat: g.lat,
          lng: g.lng,
          color: regionColor(a.region),
          sub: regionName(a.region),
        }
      })
      .filter(Boolean)

    return [...regionPoints, ...attractionPoints]
  }, [byRegion])

  const mapReady = mapPoints.length > 0

  /* ---------- 片区视野定位（boundsOf + zoomForBounds） ---------- */
  const resetView = () => {
    setActiveRegion(null)
    setSelectedId(null)
    setView({ center: { ...XIAN_VIEWPORT.center }, zoom: XIAN_VIEWPORT.zoom })
  }

  const fitToRegion = (key) => {
    /* 再次点击同一片区 = 取消定位，回到全市视野 */
    if (!key || key === activeRegion) {
      resetView()
      return
    }

    const region = getRegion(key)
    const pts = [
      regionGeoOf(key),
      ...attractions.filter((a) => a.region === key).map((a) => toLatLng(a.geo)),
    ].filter(Boolean)

    const bounds = boundsOf(pts)
    const box = mapBoxRef.current
    const width = box?.clientWidth || 880
    const height = box?.clientHeight || 460

    const center =
      (bounds ? centerOf(pts) : regionGeoOf(key)) ?? { ...XIAN_VIEWPORT.center }
    const zoom = bounds
      ? zoomForBounds(bounds, { width, height, padding: 64 })
      : region?.defaultZoom ?? 12

    setActiveRegion(key)
    setSelectedId(null)
    setView({ center, zoom })
  }

  /* ---------- marker 交互 ----------
     MapCanvas 点击同一标记会回调 null（切换语义）：
     · 已选中景点 → 关闭信息卡；· 已定位片区 → 取消定位回到全市视野。 */
  const handleSelect = (pointId) => {
    if (!pointId) {
      if (selectedId) {
        setSelectedId(null)
        return
      }
      if (activeRegion) resetView()
      return
    }
    if (String(pointId).startsWith(REGION_PREFIX)) {
      fitToRegion(String(pointId).slice(REGION_PREFIX.length))
      return
    }
    setSelectedId(pointId)
  }

  const selected = selectedId ? getAttraction(selectedId) : null
  const selectedRegion = selected ? getRegion(selected.region) : null

  /* ---------- 加入行程：走 store 既有 action，并保证有即时反馈 ---------- */
  const addToTrip = (a) => {
    if (!days.length) {
      toast('行程里还没有日期，请先在行程页添加一天', 'warning')
      return
    }
    const dayIndex = Math.min(Math.max(activeDay ?? 0, 0), days.length - 1)
    if (!isLoggedIn) toast('登录后即可把景点加入行程', 'info')
    addToItinerary(a.id, dayIndex)
  }

  /* ---------- 单日「是否顺路」：真实直线里程 + 逐段里程 ---------- */
  const dayAnalysis = days.map((d, i) => {
    const items = d.items ?? []
    const stops = items
      .map((it) => {
        const a = getAttraction(it.attractionId)
        if (!a) return null
        return {
          id: a.id,
          name: a.name,
          region: a.region,
          geo: toLatLng(a.geo),
        }
      })
      .filter(Boolean)

    const regions = [...new Set(stops.map((s) => s.region).filter(Boolean))]
    const located = stops.filter((s) => s.geo)
    const stats = located.length >= 2 ? routeStats(located.map((s) => s.geo)) : null

    return {
      index: i,
      count: items.length,
      regions,
      names: regions.map(regionName),
      located,
      stats,
      missing: items.length - located.length,
    }
  })

  const spreadDays = dayAnalysis.filter((d) => d.regions.length >= 2)

  /* ---------- 片区距离参考：按真实坐标动态计算 ---------- */
  const distanceRows = [
    { key: 'qujiang', label: '曲江' },
    { key: 'lintong', label: '临潼' },
    { key: 'qinling', label: '秦岭北麓' },
  ].map((row) => {
    const from = regionGeoOf('citywall')
    const to = regionGeoOf(row.key)
    const meters = from && to ? haversine(from, to) : null
    return {
      ...row,
      name: getRegion(row.key)?.name ?? row.label,
      text: Number.isFinite(meters) ? formatDistance(meters) : null,
    }
  })

  return (
    <div className="page">
      <div className="container">
        <Breadcrumb items={[{ label: '地图总览' }]} />

        <div className="row-between wrap row-4" style={{ marginTop: 'var(--sp-6)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--fs-h1)' }}>地图总览</h1>
            <p className="muted small" style={{ marginTop: 8 }}>
              按区域看景点分布 · 同一片区适合排在同一天，跨片区要留足交通时间
            </p>
          </div>
          <Link className="btn btn-secondary" to="/itinerary">
            去行程页安排
          </Link>
        </div>

        <div className="map-layout">
          {/* ---------------- 真实地图 ---------------- */}
          <div>
            {/* map-block 只用于测量地图容器宽高（zoomForBounds 需要），信息卡已移入 MapCanvas 内部 */}
            <div className="map-block" ref={mapBoxRef}>
              <MapErrorBoundary className="map-canvas-lg">
                <Suspense
                  fallback={
                    <div className="map-shell map-canvas-lg">
                      <div className="map-loading">正在加载地图…</div>
                    </div>
                  }
                >
                  <MapCanvas
                    points={mapPoints}
                    center={view.center}
                    zoom={view.zoom}
                    activeId={
                      selectedId ??
                      (activeRegion ? `${REGION_PREFIX}${activeRegion}` : null)
                    }
                    onSelect={handleSelect}
                    className="map-canvas-lg"
                    notice="底图由高德地图提供，仅供位置参考；不提供导航与测距"
                    ariaLabel="西安景点分布地图"
                  >
                    {/* 标记信息卡：渲染进 .map-shell 内部，随地图容器定位并被圆角裁切 */}
                    {selected && (
                      <div
                        className="map-info-card"
                        role="dialog"
                        aria-label={`${selected.name} 信息卡`}
                      >
                        <div className="map-info-head">
                          <div className="grow" style={{ minWidth: 0 }}>
                            <h3 className="map-info-title">{selected.name}</h3>
                            <p className="map-info-meta">
                              {selectedRegion?.name ?? regionName(selected.region)} ·{' '}
                              {selected.type}
                              {selected.alias ? ` · 又称「${selected.alias}」` : ''}
                            </p>
                          </div>
                          <button
                            className="map-info-close"
                            onClick={() => setSelectedId(null)}
                            aria-label="关闭信息卡"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="map-info-facts">
                          <span className="tag tag-outline">
                            票价 {ticketText(selected.ticket)}
                          </span>
                          <span className="tag tag-outline">★ {selected.rating}</span>
                          <span className="tag tag-outline">建议 {selected.duration}</span>
                        </div>

                        <div className="map-info-actions">
                          <Link
                            className="btn btn-primary btn-sm"
                            to={`/attraction/${selected.id}`}
                          >
                            查看详情
                          </Link>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => addToTrip(selected)}
                          >
                            ＋ 加入行程
                          </button>
                        </div>
                      </div>
                    )}
                  </MapCanvas>
                </Suspense>
              </MapErrorBoundary>
            </div>

            {!mapReady && (
              <Notice kind="quiet" className="mt-4">
                景点坐标数据尚未就绪，地图上暂时没有标记；下方片区列表与行程分析仍可使用。
              </Notice>
            )}

            <Notice kind="warn" className="mt-4">
              <strong>地图合规说明：</strong>
              底图由高德地图提供，仅供位置参考；
              平台不提供实时路况、导航与测距，地图中展示的距离均为直线距离。
              实际出行请以官方地图服务与现场指引为准。
            </Notice>

            {/* 景点列表 */}
            <div className="section" style={{ marginTop: 'var(--sp-8)' }}>
              <h2 className="section-title" style={{ fontSize: 'var(--fs-h2)' }}>
                {activeRegion ? getRegion(activeRegion).name : '全部片区'}
              </h2>
              <p className="section-sub">
                {activeRegion
                  ? `该片区共 ${
                      byRegion.find((r) => r.key === activeRegion)?.items.length ?? 0
                    } 个景点`
                  : '点击地图上的标记或右侧片区列表，查看片区内的景点'}
              </p>

              <div className="stack stack-3" style={{ marginTop: 'var(--sp-4)' }}>
                {(activeRegion
                  ? attractions.filter((a) => a.region === activeRegion)
                  : attractions
                ).map((a) => (
                  <Link key={a.id} to={`/attraction/${a.id}`} className="record-row">
                    <span className="record-thumb">
                      <Thumb src={a.image} alt={a.name} tone={a.tone} label="" />
                    </span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700, display: 'block' }}>{a.name}</span>
                      <span className="xs muted">
                        {regionName(a.region)} · {a.type} · {a.duration}
                      </span>
                    </span>
                    <span className="tag tag-outline">{ticketText(a.ticket)}</span>
                  </Link>
                ))}
              </div>

              {attractions.length === 0 && (
                <EmptyState
                  icon="🗺"
                  title="还没有收录景点"
                  desc="景点库为空，地图与列表暂时没有内容。"
                />
              )}
            </div>
          </div>

          {/* ---------------- 侧栏 ---------------- */}
          <aside className="detail-aside">
            <div className="card card-pad">
              <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-4)' }}>
                按片区聚类
              </h3>
              <div className="stack stack-2">
                {byRegion.map((r) => (
                  <button
                    key={r.key}
                    className={`region-card ${activeRegion === r.key ? 'on' : ''}`}
                    onClick={() => fitToRegion(r.key)}
                  >
                    <span className="region-swatch" style={{ background: r.color }} />
                    <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                      <span
                        style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', display: 'block' }}
                      >
                        {r.name}
                      </span>
                      <span className="xs muted clamp-1">{regionHint(r.key)}</span>
                      {activeRegion === r.key && (
                        <span className="region-fit">当前视野已定位</span>
                      )}
                    </span>
                    <span className="tag tag-outline">{r.items.length}</span>
                  </button>
                ))}
              </div>
              <Notice kind="quiet" className="mt-4">
                点击片区即可把地图视野定位到该片区，再次点击取消定位。
              </Notice>
              {activeRegion && (
                <button
                  className="btn btn-ghost btn-sm btn-block"
                  style={{ marginTop: 'var(--sp-3)' }}
                  onClick={resetView}
                >
                  重置视野 · 显示全部片区
                </button>
              )}
            </div>

            {/* 顺路分析 */}
            <div className="card card-pad">
              <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-3)' }}>
                这一天的点位是否顺路
              </h3>

              {days.every((d) => (d.items ?? []).length === 0) ? (
                <EmptyState
                  icon="🗺"
                  title="行程还是空的"
                  desc="在行程页加入景点后，这里会按真实坐标算出每天的直线里程与片区跨度。"
                  actions={
                    <Link className="btn btn-primary btn-sm" to="/itinerary">
                      去安排行程
                    </Link>
                  }
                />
              ) : (
                <div className="stack stack-3">
                  {dayAnalysis.map((d) => {
                    if (d.count === 0)
                      return (
                        <div key={d.index} className="row row-3">
                          <span className="day-badge">D{d.index + 1}</span>
                          <span className="grow xs muted">当天没有安排</span>
                        </div>
                      )

                    const good = d.regions.length <= 1
                    const noRegion = d.regions.length === 0
                    const total = d.stats?.totalMeters

                    return (
                      <div key={d.index}>
                        <div className="row row-3">
                          <span className="day-badge">D{d.index + 1}</span>
                          <span className="grow small">
                            {d.count} 个点位
                            {d.names.length > 0 ? ` · ${d.names.join(' + ')}` : ''}
                          </span>
                        </div>
                        <p
                          className="xs"
                          style={{
                            marginTop: 6,
                            marginLeft: 46,
                            color: noRegion
                              ? 'var(--ink-400)'
                              : good
                                ? 'var(--success-600)'
                                : 'var(--warning-600)',
                            fontWeight: 600,
                          }}
                        >
                          {noRegion
                            ? '· 当天点位未匹配到收录景点，暂无片区与里程信息'
                            : good
                              ? '✓ 同一片区，比较顺路'
                              : `⚠ 跨 ${d.regions.length} 个片区，需留足交通时间`}
                          {!noRegion && Number.isFinite(total) && total > 0
                            ? ` · 直线移动约 ${formatDistance(total)}`
                            : ''}
                        </p>

                        {d.missing > 0 && (
                          <p
                            className="xs muted"
                            style={{ marginTop: 4, marginLeft: 46 }}
                          >
                            其中 {d.missing} 个点位暂无坐标，未计入里程
                          </p>
                        )}

                        {d.stats?.legs?.length > 0 && (
                          <div className="day-route-legs" style={{ marginLeft: 46 }}>
                            {d.stats.legs.map((leg, li) => {
                              const from = d.located[li]
                              const to = d.located[li + 1]
                              const meters = Number(leg?.meters)
                              if (!from || !to || !Number.isFinite(meters)) return null
                              return (
                                <span
                                  key={`${from.id}-${to.id}-${li}`}
                                  className={`day-route-leg ${
                                    meters >= LONG_LEG_METERS ? 'is-long' : ''
                                  }`}
                                >
                                  <span className="leg-idx">
                                    {li + 1}→{li + 2}
                                  </span>
                                  <span>
                                    {from.name} → {to.name}
                                  </span>
                                  <span className="leg-m">
                                    {formatDistance(meters)}
                                  </span>
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {spreadDays.length > 0 && (
                    <Notice kind="warn">
                      有 {spreadDays.length} 天跨了多个片区。西安片区之间距离较远，
                      一天跨两三个片区容易把时间耗在路上，建议拆分到不同日期。
                    </Notice>
                  )}
                </div>
              )}
            </div>

            <div className="card card-pad">
              <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-3)' }}>
                片区距离参考
              </h3>
              <dl className="info-list">
                {distanceRows.map((r) => (
                  <div className="info-row" key={r.key}>
                    <dt>城墙内 → {r.name}</dt>
                    <dd>{r.text ? `直线距离约 ${r.text}` : '坐标待补充'}</dd>
                  </div>
                ))}
              </dl>
              <Notice kind="quiet" className="mt-4">
                以上为按真实坐标计算的<strong>直线距离</strong>，不含道路绕行与实际耗时。
                平台不提供路线计算与实时交通，实际出行请以地图应用为准。
              </Notice>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   地图兜底
   引擎加载失败时页面其余部分（片区列表、行程分析）仍然可用，不白屏。
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
            <p>地图组件加载失败，下方片区列表与行程分析仍可正常使用。</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

/* 票价展示：免费 / ¥价格 / 详见官方信息 */
function ticketText(ticket) {
  if (!ticket) return '详见官方信息'
  if (ticket.kind === 'free') return '免费'
  return Number.isFinite(Number(ticket.price)) ? `¥${ticket.price}` : '详见官方信息'
}

function regionHint(key) {
  return {
    citywall: '钟楼、城墙、碑林、回民街',
    qujiang: '大雁塔、陕博、不夜城、芙蓉园',
    lintong: '兵马俑、华清宫，需单独一天',
    gaoxin: '汉城湖等休闲向点位',
    qinling: '翠华山、南五台、动物园',
  }[key]
}
