/* ==========================================================================
   地图画布（契约 C2）
   默认走高德栅格瓦片（无需 Key）：容器本身不加 transform，瓦片 / 标记 / 折线
   全部用容器内屏幕像素的 left/top 绝对定位；瓦片连续失败或超时无加载时自动
   降级为自绘示意底图，角落显示「离线底图」。
   交互：拖拽平移、滚轮以光标为锚点缩放、双击放大、＋/−/⌖ 控件、键盘可达。
   ========================================================================== */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import MapProviderBadge from './MapProviderBadge.jsx'
import { MapStatusContext } from './provider.js'
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  RasterTileEngine,
  TILE_SIZE,
  clampZoom,
  panCenter,
  readLatLng,
  screenPoint,
  zoomCenterAt,
} from './engine.js'

/* ---------- 行为常量 ---------- */
const VIEW_THROTTLE_MS = 120 // onViewChange 节流间隔（拖拽结束立即同步一次）
const DEGRADE_ERRORS = 4 // 连续瓦片失败阈值
const DEGRADE_TIMEOUT_MS = 10000 // 挂载后始终没有瓦片成功加载的超时
const LABEL_ALL_MIN_ZOOM = 14 // ≥ 该层级显示全部标签（再按重叠去重）
const KEY_PAN_STEP = 60 // 键盘平移步长（像素）
const DRAG_THRESHOLD = 4 // 超过该位移认定是拖拽而非点击
const CULL_MARGIN = 48 // 视口外标记剔除余量

const EMPTY_LIST = []

/* ---------- 小工具 ---------- */
function sameLngLat(a, b) {
  return !!a && !!b && Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lng - b.lng) < 1e-9
}

function safeCall(fn, arg) {
  try {
    fn(arg)
  } catch (err) {
    /* 页面回调异常不得破坏地图，也不得变成未捕获异常 */
    if (typeof console !== 'undefined') console.warn('[map] onViewChange failed', err)
  }
}

/** 点位坐标容错：{lat,lng} → 也接受 {geo:{lat,lng}} / {center:{lat,lng}} */
function pointLatLng(point) {
  if (!point) return null
  return readLatLng(point) || readLatLng(point.geo) || readLatLng(point.center)
}

function detachDrag(listeners) {
  if (!listeners || typeof window === 'undefined') return
  window.removeEventListener('pointermove', listeners.move)
  window.removeEventListener('pointerup', listeners.end)
  window.removeEventListener('pointercancel', listeners.end)
}

/* ---------- 标签去重（不做聚合，只按优先级丢弃压盖的低优先级标签） ---------- */

/** 估算标签胶囊宽度（与 CSS 对齐：中文 12.5/13.5px 字宽 + 左右内边距与描边） */
function estimateLabelWidth(text, isRegion) {
  let width = isRegion ? 22 : 18
  const perChar = isRegion ? 13.5 : 12.5
  for (const ch of String(text)) width += /[\u4e00-\u9fff]/.test(ch) ? perChar : 7.5
  return width
}

/** 标签盒（与 CSS 一致：水平居中于锚点、垂直贴在圆点下方） */
function labelBox(pos, text, isRegion) {
  const width = estimateLabelWidth(text, isRegion)
  const top = pos.y + (isRegion ? 15 : 12)
  return { left: pos.x - width / 2, top, right: pos.x + width / 2, bottom: top + (isRegion ? 29 : 25) }
}

function boxesOverlap(a, b, pad = 1) {
  return !(a.right + pad < b.left || b.right + pad < a.left || a.bottom + pad < b.top || b.bottom + pad < a.top)
}

/* 命中「页面 UI」的判定：这些区域不参与拖拽，避免指针捕获吞掉子元素 click */
const UI_SELECTOR = '.map-controls, .map-badge, .map-notice, .map-attrib, .map-info-card, button, a, input, select, textarea'

export default function MapCanvas({
  points,
  polylines,
  center,
  zoom,
  onSelect,
  onViewChange,
  activeId = null,
  interactive = true,
  lockCenter = false,
  className = '',
  notice,
  ariaLabel = '地图',
  children,
}) {
  const shellRef = useRef(null)
  const stageRef = useRef(null)
  const engineRef = useRef(null)
  if (!engineRef.current) engineRef.current = new RasterTileEngine()

  const pointList = Array.isArray(points) ? points : EMPTY_LIST
  const lineList = Array.isArray(polylines) ? polylines : EMPTY_LIST

  const [size, setSize] = useState({ width: 0, height: 0 })
  const [view, setView] = useState(() => ({
    center: readLatLng(center) || DEFAULT_CENTER,
    zoom: clampZoom(zoom === undefined || zoom === null ? DEFAULT_ZOOM : zoom),
  }))
  const [version, setVersion] = useState(0) // 引擎瓦片状态版本号，用于刷新失败态
  const [degraded, setDegraded] = useState(false)
  const [tilesLoaded, setTilesLoaded] = useState(false)
  const [hoverId, setHoverId] = useState(null) // 悬停的标记（低缩放下临时显示其标签）

  /* refs：交互回调始终读到最新值，避免高频重建监听 */
  const viewRef = useRef(view)
  const sizeRef = useRef(size)
  const propsRef = useRef({})
  const emitRef = useRef({ timer: null, pending: null })
  const loadedRef = useRef(false)
  const movedRef = useRef(false)
  const dragRef = useRef(null)
  const dragListenersRef = useRef(null)
  const initialRef = useRef(null)
  if (!initialRef.current) {
    initialRef.current = {
      center: readLatLng(center) || DEFAULT_CENTER,
      zoom: clampZoom(zoom === undefined || zoom === null ? DEFAULT_ZOOM : zoom),
    }
  }

  useLayoutEffect(() => {
    viewRef.current = view
    sizeRef.current = size
  })

  useLayoutEffect(() => {
    propsRef.current = { interactive, lockCenter, onSelect, onViewChange, activeId }
  })

  /* ---------- 视图提交：内部 state + 节流后的外部回调 ---------- */
  const emitView = useCallback((next, immediate) => {
    const callback = propsRef.current.onViewChange
    if (typeof callback !== 'function') return
    const box = emitRef.current
    box.pending = { center: next.center, zoom: next.zoom }
    if (immediate) {
      if (box.timer) {
        clearTimeout(box.timer)
        box.timer = null
      }
      const payload = box.pending
      box.pending = null
      if (payload) safeCall(callback, payload)
      return
    }
    if (!box.timer) {
      box.timer = setTimeout(() => {
        box.timer = null
        const payload = box.pending
        box.pending = null
        if (payload) safeCall(callback, payload)
      }, VIEW_THROTTLE_MS)
    }
  }, [])

  const applyView = useCallback(
    (nextCenter, nextZoom, immediate) => {
      const prev = viewRef.current
      const ll = readLatLng(nextCenter) || prev.center
      const nz = clampZoom(nextZoom === undefined || nextZoom === null ? prev.zoom : nextZoom)
      if (sameLngLat(prev.center, ll) && Math.abs(prev.zoom - nz) < 1e-9) return
      const next = { center: { lat: ll.lat, lng: ll.lng }, zoom: nz }
      viewRef.current = next
      setView(next)
      emitView(next, !!immediate)
    },
    [emitView],
  )

  /* ---------- 受控 props 同步（比较数值，避免来回抖动/死循环） ---------- */
  const propCenter = readLatLng(center)
  const propLat = propCenter ? propCenter.lat : null
  const propLng = propCenter ? propCenter.lng : null
  const propZoom =
    zoom === undefined || zoom === null || zoom === '' || !Number.isFinite(Number(zoom)) ? null : Number(zoom)

  useEffect(() => {
    const prev = viewRef.current
    const ll = propLat !== null && propLng !== null ? { lat: propLat, lng: propLng } : prev.center
    const nz = propZoom !== null ? clampZoom(propZoom) : prev.zoom
    if (sameLngLat(prev.center, ll) && Math.abs(prev.zoom - nz) < 1e-9) return
    const next = { center: { lat: ll.lat, lng: ll.lng }, zoom: nz }
    viewRef.current = next
    setView(next)
  }, [propLat, propLng, propZoom])

  /* ---------- 尺寸观测（ResizeObserver，0 宽高时不渲染瓦片） ---------- */
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const measure = () => {
      const width = stage.clientWidth || 0
      const height = stage.clientHeight || 0
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      if (typeof window === 'undefined') return undefined
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  /* ---------- 引擎状态订阅 + 卸载清理 ---------- */
  useEffect(() => engineRef.current.subscribe(() => setVersion((v) => v + 1)), [])

  useEffect(
    () => () => {
      const box = emitRef.current
      if (box.timer) {
        clearTimeout(box.timer)
        box.timer = null
      }
      detachDrag(dragListenersRef.current)
      dragListenersRef.current = null
    },
    [],
  )

  /* ---------- 瓦片加载成败 ---------- */
  const handleTileLoad = useCallback((key) => {
    engineRef.current.noteLoad(key)
    if (!loadedRef.current) {
      loadedRef.current = true
      setTilesLoaded(true)
    }
  }, [])

  const handleTileError = useCallback((key) => {
    const engine = engineRef.current
    engine.noteError(key)
    if (engine.errorStreak >= DEGRADE_ERRORS) setDegraded(true)
  }, [])

  /* ---------- 视口与瓦片 ---------- */
  const width = size.width
  const height = size.height
  const hasViewport = width > 0 && height > 0

  const viewport = useMemo(
    () => ({ center: view.center, zoom: view.zoom, width, height }),
    [view.center, view.zoom, width, height],
  )

  const grid = useMemo(() => {
    if (degraded) return { tiles: [], count: 0, size: TILE_SIZE }
    return engineRef.current.viewTiles({
      center: view.center,
      zoom: view.zoom,
      width,
      height,
      buffer: 1,
    })
  }, [degraded, view.center, view.zoom, width, height, version])

  /* 挂载后 10s 内没有任何瓦片成功加载 → 降级（只在确实发过瓦片请求时计时） */
  useEffect(() => {
    if (degraded || tilesLoaded) return undefined
    if (!hasViewport || grid.count === 0) return undefined
    const timer = setTimeout(() => {
      if (!loadedRef.current) setDegraded(true)
    }, DEGRADE_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [degraded, tilesLoaded, hasViewport, grid.count])

  /* ---------- 缩放 / 平移 / 复位 ---------- */
  const zoomAt = useCallback(
    (anchor, nextZoom, immediate = true) => {
      const current = viewRef.current
      const nextCenter = zoomCenterAt(current.center, current.zoom, nextZoom, anchor, sizeRef.current)
      if (!nextCenter) return
      applyView(nextCenter, clampZoom(nextZoom), immediate)
    },
    [applyView],
  )

  const panBy = useCallback(
    (dx, dy) => {
      if (propsRef.current.lockCenter) return
      const current = viewRef.current
      const nextCenter = panCenter(current.center, current.zoom, dx, dy)
      if (!nextCenter) return
      applyView(nextCenter, current.zoom, false)
    },
    [applyView],
  )

  const resetView = useCallback(() => {
    const init = initialRef.current
    applyView(init.center, init.zoom, true)
  }, [applyView])

  const zoomIn = useCallback(() => zoomAt(null, viewRef.current.zoom + 1, true), [zoomAt])
  const zoomOut = useCallback(() => zoomAt(null, viewRef.current.zoom - 1, true), [zoomAt])

  /* ---------- 拖拽平移（pointer 事件；起点在 marker 上时不夺取指针捕获） ---------- */
  const onPointerDown = useCallback(
    (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const stage = stageRef.current
      if (!stage) return
      movedRef.current = false

      const target = event.target
      const inMarker = !!(target && target.closest && target.closest('.map-marker'))
      const inUi = !!(target && target.closest && target.closest(UI_SELECTOR))
      const canPan = propsRef.current.interactive !== false && propsRef.current.lockCenter !== true && !(inUi && !inMarker)

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        center: { ...viewRef.current.center },
        zoom: viewRef.current.zoom,
        canPan,
      }
      if (!canPan) return

      if (!inMarker && typeof stage.setPointerCapture === 'function') {
        try {
          stage.setPointerCapture(event.pointerId)
        } catch (err) {
          /* 捕获失败不影响拖拽（window 监听兜底） */
        }
      }

      const onMove = (ev) => {
        const drag = dragRef.current
        if (!drag || !drag.canPan) return
        const dx = ev.clientX - drag.startX
        const dy = ev.clientY - drag.startY
        if (!movedRef.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
        movedRef.current = true
        const nextCenter = panCenter(drag.center, drag.zoom, dx, dy)
        if (nextCenter) applyView(nextCenter, drag.zoom, false)
      }

      const onEnd = (ev) => {
        detachDrag(dragListenersRef.current)
        dragListenersRef.current = null
        dragRef.current = null
        if (
          typeof stage.releasePointerCapture === 'function' &&
          typeof stage.hasPointerCapture === 'function' &&
          stage.hasPointerCapture(ev.pointerId)
        ) {
          try {
            stage.releasePointerCapture(ev.pointerId)
          } catch (err) {
            /* 忽略 */
          }
        }
        /* 拖拽结束立即同步一次视图，避免最后一次节流丢失 */
        if (movedRef.current) emitView(viewRef.current, true)
      }

      detachDrag(dragListenersRef.current)
      dragListenersRef.current = { move: onMove, end: onEnd }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onEnd)
      window.addEventListener('pointercancel', onEnd)
    },
    [applyView, emitView],
  )

  /* ---------- 滚轮缩放：必须用非 passive 监听，否则 preventDefault 无效并报错 ---------- */
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || interactive === false) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      const rect = stage.getBoundingClientRect()
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const current = viewRef.current
      zoomAt(anchor, current.zoom + (event.deltaY > 0 ? -1 : 1), true)
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [interactive, zoomAt])

  /* ---------- 双击放大（以光标为锚点） ---------- */
  const onDoubleClick = useCallback(
    (event) => {
      if (propsRef.current.interactive === false) return
      const stage = stageRef.current
      if (!stage) return
      const rect = stage.getBoundingClientRect()
      zoomAt({ x: event.clientX - rect.left, y: event.clientY - rect.top }, viewRef.current.zoom + 1, true)
    },
    [zoomAt],
  )

  /* ---------- 键盘可达：方向键平移、+/- 缩放、0 复位 ---------- */
  const onKeyDown = useCallback(
    (event) => {
      if (propsRef.current.interactive === false) return
      const step = event.shiftKey ? KEY_PAN_STEP * 2.5 : KEY_PAN_STEP
      let handled = true
      switch (event.key) {
        case 'ArrowLeft':
          panBy(step, 0)
          break
        case 'ArrowRight':
          panBy(-step, 0)
          break
        case 'ArrowUp':
          panBy(0, step)
          break
        case 'ArrowDown':
          panBy(0, -step)
          break
        case '+':
        case '=':
          zoomAt(null, viewRef.current.zoom + 1, false)
          break
        case '-':
        case '_':
          zoomAt(null, viewRef.current.zoom - 1, false)
          break
        case '0':
          resetView()
          break
        default:
          handled = false
      }
      if (handled) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
    [panBy, resetView, zoomAt],
  )

  /* ---------- marker 选中（指针拖拽后的 click 不触发选中；键盘激活不受影响） ---------- */
  const activate = useCallback((point, fromPointer) => {
    const callback = propsRef.current.onSelect
    if (typeof callback !== 'function') return
    if (fromPointer && movedRef.current) return
    const current = propsRef.current.activeId
    callback(current !== null && current !== undefined && String(current) === String(point.id) ? null : point.id)
  }, [])

  /* ---------- 标记 ---------- */
  const markers = useMemo(() => {
    if (!hasViewport) return null

    /* 1) 先算屏幕位置与优先级 */
    const drafts = []
    pointList.forEach((point) => {
      const ll = pointLatLng(point)
      if (!ll || point.id === undefined || point.id === null) return
      const pos = screenPoint(ll, viewport)
      if (!pos) return
      if (
        pos.x < -CULL_MARGIN ||
        pos.y < -CULL_MARGIN ||
        pos.x > width + CULL_MARGIN ||
        pos.y > height + CULL_MARGIN
      ) {
        return
      }
      const isRegion = point.kind === 'region'
      const isActive = activeId !== null && activeId !== undefined && String(activeId) === String(point.id)
      const isHovered = hoverId !== null && hoverId !== undefined && String(hoverId) === String(point.id)
      const hasBadge = point.badge !== undefined && point.badge !== null && point.badge !== ''
      drafts.push({
        point,
        pos,
        isRegion,
        isActive,
        isHovered,
        hasBadge,
        text: point.sub ? `${point.name} · ${point.sub}` : point.name,
        /* 优先级：选中/悬停 > 片区 > 景点 */
        rank: isActive || isHovered ? 3 : isRegion ? 2 : 1,
      })
    })

    /* 2) 标签可见性：按缩放分级（选中/悬停任何缩放都显示），再做重叠去重 */
    const labelIds = new Set()
    const accepted = []
    drafts
      .slice()
      .sort((a, b) => b.rank - a.rank)
      .forEach((item) => {
        if (!item.point.name) return
        const forced = item.isActive || item.isHovered
        /* ≤13 只显示片区标签与选中/悬停标签；≥14 全部显示 */
        if (!forced && !item.isRegion && view.zoom < LABEL_ALL_MIN_ZOOM) return
        const box = labelBox(item.pos, item.text, item.isRegion)
        /* 片区标签是主信息，永不因压盖丢弃；景点标签让位于已接受的标签 */
        if (!forced && !item.isRegion && accepted.some((other) => boxesOverlap(other, box))) return
        accepted.push(box)
        labelIds.add(item.point.id)
      })

    /* 3) 渲染：低优先级先画，选中/悬停最后画（保证压在最上层） */
    return drafts
      .sort((a, b) => a.rank - b.rank)
      .map((item) => {
        const { point, pos, isRegion, isActive, isHovered, hasBadge, text } = item
        const showLabel = labelIds.has(point.id)
        /* is-dot-only 会连带隐藏 badge，故只对没有 badge 的点使用 */
        const dotOnly = !showLabel && !hasBadge
        return (
          <div
            key={point.id}
            className={[
              'map-marker',
              isRegion ? 'is-region' : 'is-attraction',
              isActive ? 'is-active' : '',
              dotOnly ? 'is-dot-only' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: `${pos.x.toFixed(1)}px`, top: `${pos.y.toFixed(1)}px` }}
            role="button"
            tabIndex={0}
            aria-label={text || '地图标记'}
            title={text || undefined}
            onClick={() => activate(point, true)}
            onPointerEnter={() => setHoverId(point.id)}
            onPointerLeave={() => setHoverId((current) => (String(current) === String(point.id) ? null : current))}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                event.stopPropagation()
                activate(point, false)
              }
            }}
          >
            <span className="map-marker-dot" style={point.color ? { background: point.color } : undefined} />
            {point.name && showLabel ? <span className="map-marker-label">{text}</span> : null}
            {hasBadge ? <span className="map-marker-badge">{point.badge}</span> : null}
          </div>
        )
      })
  }, [pointList, viewport, view.zoom, width, height, hasViewport, activeId, hoverId, activate])

  /* ---------- 折线（同一屏幕像素坐标系，直接画在 overlay 的 svg 上） ---------- */
  const polylineNodes = useMemo(() => {
    if (!hasViewport || lineList.length === 0) return null
    return (
      <svg aria-hidden="true" focusable="false">
        {lineList.map((line) => {
          const path = line && Array.isArray(line.path) ? line.path : []
          const coords = path.map((item) => screenPoint(item, viewport)).filter(Boolean)
          if (coords.length < 2) return null
          return (
            <polyline
              key={line.id}
              className={['map-polyline', line.dashed ? 'is-dashed' : '', line.dim ? 'is-dim' : '']
                .filter(Boolean)
                .join(' ')}
              points={coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')}
              stroke={line.color || '#b2372e'}
            />
          )
        })}
      </svg>
    )
  }, [lineList, viewport, hasViewport])

  const isEmpty = pointList.length === 0 && lineList.length === 0
  const showLoading = !degraded && !tilesLoaded && hasViewport && grid.count > 0 && !isEmpty

  const statusValue = useMemo(
    () => ({ provider: 'raster', degraded, offline: degraded, tilesLoaded }),
    [degraded, tilesLoaded],
  )

  return (
    <MapStatusContext.Provider value={statusValue}>
      <div
        ref={shellRef}
        className={[
          'map-shell',
          className,
          lockCenter ? 'is-locked' : '',
          interactive === false ? 'is-static' : '',
          notice ? 'has-notice' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          ref={stageRef}
          className="map-stage"
          role="application"
          aria-label={ariaLabel || '地图'}
          tabIndex={interactive === false ? -1 : 0}
          onPointerDown={onPointerDown}
          onDoubleClick={onDoubleClick}
          onKeyDown={onKeyDown}
        >
          {/* 瓦片层：每张瓦片左上角的容器内像素 = 瓦片世界像素 − 视图中心世界像素 + 容器尺寸/2 */}
          {!degraded && hasViewport ? (
            <div className="map-engine-layer">
              {grid.tiles.map((tile) => (
                <img
                  key={tile.key}
                  className={`map-tile${tile.state === 'error' ? ' is-failed' : ''}`}
                  src={tile.url}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  decoding="async"
                  loading="eager"
                  referrerPolicy="no-referrer"
                  style={{ left: `${tile.left.toFixed(1)}px`, top: `${tile.top.toFixed(1)}px`, width: `${tile.size.toFixed(1)}px`, height: `${tile.size.toFixed(1)}px` }}
                  onLoad={() => handleTileLoad(tile.key)}
                  onError={() => handleTileError(tile.key)}
                />
              ))}
            </div>
          ) : null}

          {/* 降级：自绘示意底图（造型沿用原 MapView，方位只是示意） */}
          {degraded ? <FallbackBasemap /> : null}

          {/* overlay：折线 svg + 标记，均为绝对定位的屏幕像素 */}
          <div className="map-overlay">
            {polylineNodes}
            {markers}
          </div>

          {interactive !== false ? (
            <div className="map-controls">
              <button
                type="button"
                className="map-ctl-btn"
                onClick={zoomIn}
                disabled={view.zoom >= MAX_ZOOM}
                aria-label="放大"
                title="放大"
              >
                +
              </button>
              <button
                type="button"
                className="map-ctl-btn"
                onClick={zoomOut}
                disabled={view.zoom <= MIN_ZOOM}
                aria-label="缩小"
                title="缩小"
              >
                −
              </button>
              <button type="button" className="map-ctl-btn" onClick={resetView} aria-label="复位视图" title="复位视图">
                ⌖
              </button>
            </div>
          ) : null}

          {!degraded ? <span className="map-attrib">© 高德地图</span> : null}
          {notice ? <div className="map-notice">{notice}</div> : null}
          <MapProviderBadge />
          {showLoading ? (
            <div className="map-loading" role="status">
              地图加载中…
            </div>
          ) : null}
          {isEmpty ? <div className="map-empty">暂无点位</div> : null}
        </div>

        {/* 页面塞进来的信息卡等浮层，直接留在 .map-shell 内，z-index 高于瓦片层 */}
        {children}
      </div>
    </MapStatusContext.Provider>
  )
}

/* ==========================================================================
   自绘示意底图（离线降级）
   沿用原 MapView 的秦岭山带 / 渭河水系 / 明城墙造型与配色；
   标记仍按 Web Mercator 投影摆放，方位与真实经纬度一致。
   ========================================================================== */
function FallbackBasemap() {
  const rawId = useId()
  const backgroundId = `map-fallback-bg-${String(rawId).replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <div className="map-fallback" aria-hidden="true">
      <svg viewBox="0 0 100 75" preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id={backgroundId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f7f2e8" />
            <stop offset="100%" stopColor="#eae0cf" />
          </linearGradient>
        </defs>
        <rect width="100" height="75" fill={`url(#${backgroundId})`} />
        {/* 秦岭山带（南侧） */}
        <path d="M0 62 L14 55 L26 60 L38 52 L52 58 L66 50 L80 56 L100 48 L100 75 L0 75 Z" fill="#cfd8c6" opacity="0.7" />
        {/* 渭河水系（北侧） */}
        <path d="M0 12 C18 16 32 8 50 12 C68 16 82 9 100 13" stroke="#b9cdd4" strokeWidth="2.4" fill="none" opacity="0.75" />
        {/* 明城墙轮廓 */}
        <rect x="42" y="38" width="16" height="13" rx="1.4" fill="none" stroke="#B2372E" strokeWidth="1" strokeDasharray="2.5 1.6" opacity="0.6" />
      </svg>
    </div>
  )
}
