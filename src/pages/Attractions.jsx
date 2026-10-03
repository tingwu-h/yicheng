import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  attractions,
  REGIONS,
  TYPES,
  SEASON_TAGS,
  regionName,
} from '../data/attractions'
import { AttractionGrid } from '../components/cards'
import {
  Breadcrumb,
  LoadingState,
  EmptyState,
  ErrorState,
  Pager,
  Notice,
} from '../components/ui'

/* ==========================================================================
   景点库
   支持按行政区域、景点类型、适游主题筛选，支持关键词搜索、排序与清除筛选。
   提供加载 / 空结果 / 加载失败重试状态，筛选条件始终可见。
   ========================================================================== */

const SORTS = [
  { key: 'hot', label: '按热度' },
  { key: 'rating', label: '按评分' },
  { key: 'price', label: '按票价从低到高' },
  { key: 'name', label: '按名称' },
]

const PAGE_SIZE = 9

export default function Attractions() {
  const [params, setParams] = useSearchParams()

  const [kw, setKw] = useState(params.get('kw') || '')
  const [region, setRegion] = useState(params.get('region') || '')
  const [type, setType] = useState(params.get('type') || '')
  const [season, setSeason] = useState(params.get('season') || '')
  const [sort, setSort] = useState(params.get('sort') || 'hot')
  const [page, setPage] = useState(1)

  /* 加载状态：模拟数据请求，便于演示加载 / 失败 / 重试 */
  const [status, setStatus] = useState('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const forceError = params.get('demo') === 'error'

  useEffect(() => {
    setStatus('loading')
    const t = setTimeout(() => {
      setStatus(forceError ? 'error' : 'ready')
    }, forceError ? 400 : 420)
    return () => clearTimeout(t)
  }, [region, type, season, sort, kw, reloadKey, forceError])

  /* 筛选条件同步到地址栏，便于分享与返回时保留 */
  useEffect(() => {
    const next = {}
    if (kw) next.kw = kw
    if (region) next.region = region
    if (type) next.type = type
    if (season) next.season = season
    if (sort && sort !== 'hot') next.sort = sort
    setParams(next, { replace: true })
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kw, region, type, season, sort])

  /* ---------- 筛选 + 排序 ---------- */
  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase()
    let list = attractions.filter((a) => {
      if (region && a.region !== region) return false
      if (type && a.type !== type) return false
      if (season && !a.seasons.includes(season)) return false
      if (k) {
        const hay = [a.name, a.alias, a.summary, a.type, regionName(a.region), ...a.seasons]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(k)) return false
      }
      return true
    })

    list = [...list].sort((a, b) => {
      if (sort === 'rating') return b.rating - a.rating
      if (sort === 'name') return a.name.localeCompare(b.name, 'zh-Hans-CN')
      if (sort === 'price') {
        const pa = a.ticket?.kind === 'free' ? 0 : a.ticket?.price ?? 999
        const pb = b.ticket?.kind === 'free' ? 0 : b.ticket?.price ?? 999
        return pa - pb
      }
      return b.favorites - a.favorites
    })

    return list
  }, [kw, region, type, season, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  /* ---------- 已选条件 ---------- */
  const activeChips = [
    kw && { key: 'kw', label: `关键词：${kw}`, clear: () => setKw('') },
    region && { key: 'region', label: `区域：${regionName(region)}`, clear: () => setRegion('') },
    type && { key: 'type', label: `类型：${type}`, clear: () => setType('') },
    season && { key: 'season', label: `主题：${season}`, clear: () => setSeason('') },
  ].filter(Boolean)

  const clearAll = () => {
    setKw('')
    setRegion('')
    setType('')
    setSeason('')
    setSort('hot')
  }

  /* 从卡片标签点进来时直接追加筛选条件 */
  const handleTagClick = (kind, value) => {
    if (kind === 'type') setType(value)
    if (kind === 'season') setSeason(value)
  }

  return (
    <div className="page">
      <div className="container">
        <Breadcrumb items={[{ label: '景点库' }]} />

        <div className="row-between wrap row-4" style={{ marginTop: 'var(--sp-6)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--fs-h1)' }}>景点库</h1>
            <p className="muted small" style={{ marginTop: 8 }}>
              集中展示西安及周边景点，可按区域、类型与适游主题筛选
            </p>
          </div>
          <Link className="btn btn-secondary" to="/map">
            在地图上看分布
          </Link>
        </div>

        {/* ---------------- 筛选工具条 ---------------- */}
        <div className="filter-bar" style={{ marginTop: 'var(--sp-6)' }}>
          <div className="filter-group grow" style={{ minWidth: 220 }}>
            <input
              className="input"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜索景点名称、别名或关键词"
              aria-label="搜索景点"
            />
          </div>

          <div className="filter-group">
            <span className="filter-label">排序</span>
            <select
              className="select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="排序方式"
              style={{ width: 170 }}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={clearAll}
            disabled={!activeChips.length && sort === 'hot'}
          >
            清除筛选
          </button>
        </div>

        <div className="stack stack-3" style={{ marginTop: 'var(--sp-4)' }}>
          <FilterRow
            label="行政区域"
            options={REGIONS.map((r) => ({ key: r.key, label: r.name }))}
            value={region}
            onChange={(v) => setRegion(v === region ? '' : v)}
          />
          <FilterRow
            label="景点类型"
            options={TYPES.map((t) => ({ key: t, label: t }))}
            value={type}
            onChange={(v) => setType(v === type ? '' : v)}
          />
          <FilterRow
            label="适游主题"
            options={SEASON_TAGS.map((t) => ({ key: t, label: t }))}
            value={season}
            onChange={(v) => setSeason(v === season ? '' : v)}
          />
        </div>

        {/* 已选条件始终可见 */}
        {activeChips.length > 0 && (
          <div className="active-filters">
            <span>已选条件：</span>
            {activeChips.map((c) => (
              <span className="filter-pill" key={c.key}>
                {c.label}
                <button onClick={c.clear} aria-label={`移除条件 ${c.label}`}>
                  ✕
                </button>
              </span>
            ))}
            <button
              className="btn btn-ghost btn-sm"
              onClick={clearAll}
              style={{ marginLeft: 4 }}
            >
              全部清除
            </button>
          </div>
        )}

        {/* ---------------- 结果 ---------------- */}
        <section style={{ marginTop: 'var(--sp-6)' }}>
          {status === 'loading' && <LoadingState rows={6} />}

          {status === 'error' && (
            <ErrorState
              desc="景点列表加载失败。你当前的筛选条件已保留，可以直接重新加载。"
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          )}

          {status === 'ready' && (
            <>
              <div className="row-between wrap row-3" style={{ marginBottom: 'var(--sp-5)' }}>
                <p className="small muted">
                  共找到 <strong style={{ color: 'var(--ink-800)' }}>{filtered.length}</strong> 个景点
                  {filtered.length > PAGE_SIZE && (
                    <>
                      {' '}
                      · 第 {page} / {totalPages} 页
                    </>
                  )}
                </p>
                <p className="xs muted">信息由平台整理，出行前请核实官方渠道</p>
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  icon="?"
                  title="没有符合当前条件的景点"
                  desc="试试减少筛选条件，或改用景点名称、区域与主题搜索。"
                  actions={
                    <>
                      <button className="btn btn-primary" onClick={clearAll}>
                        清除全部筛选
                      </button>
                      <Link className="btn btn-secondary" to="/attractions">
                        返回完整景点库
                      </Link>
                    </>
                  }
                />
              ) : (
                <>
                  <AttractionGrid items={pageItems} onTagClick={handleTagClick} />
                  <Pager page={page} total={totalPages} onChange={setPage} />
                </>
              )}
            </>
          )}
        </section>

        <Notice kind="quiet" className="mt-8">
          开放时间、票价与交通信息会随季节和临时安排调整。
          页面已标注信息更新时间，出行前请通过官方渠道再次核实，不要仅依赖本页信息安排行程。
        </Notice>
      </div>
    </div>
  )
}

/* ---------- 单行筛选 ---------- */
function FilterRow({ label, options, value, onChange }) {
  return (
    <div className="filter-group wrap">
      <span className="filter-label" style={{ minWidth: 64 }}>
        {label}
      </span>
      <div className="filter-chips">
        <button className={`chip ${!value ? 'on' : ''}`} onClick={() => onChange('')}>
          全部
        </button>
        {options.map((o) => (
          <button
            key={o.key}
            className={`chip ${value === o.key ? 'on' : ''}`}
            onClick={() => onChange(o.key)}
            aria-pressed={value === o.key}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
