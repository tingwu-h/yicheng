/* ==========================================================================
   地图引擎 · Web Mercator 投影 + 栅格瓦片
   - 256px 标准 XYZ 瓦片，默认走高德栅格瓦片（webrd01~04，无需 API Key）
   - 纯计算 + 轻量状态缓存，不依赖 React / DOM，可直接在 node 里导入做自检
   - 布局模型：容器不加 transform，瓦片/标记全部用绝对定位的 left/top 摆放
   ========================================================================== */

/* ---------- 常量 ---------- */
export const TILE_SIZE = 256
export const MIN_ZOOM = 3
export const MAX_ZOOM = 18
export const MAX_TILE_CACHE = 300
export const DEFAULT_TILE_TEMPLATE =
  'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'
export const DEFAULT_SUBDOMAINS = ['1', '2', '3', '4']
export const DEFAULT_CENTER = { lat: 34.26, lng: 108.94 }
export const DEFAULT_ZOOM = 11

/* Web Mercator 的纬度上限（±85.0511°） */
const MAX_MERCATOR_LAT = 85.05112877980659

/* ---------- 基础工具 ---------- */

/** 缩放级钳制到 [MIN_ZOOM, MAX_ZOOM]，非法值回落到默认级 */
export function clampZoom(zoom) {
  const z = Number(zoom)
  if (!Number.isFinite(z)) return DEFAULT_ZOOM
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

/** 指定缩放级下的世界像素边长（256 * 2^zoom） */
export function worldSize(zoom) {
  return TILE_SIZE * Math.pow(2, clampZoom(zoom))
}

/** 数字化：null / undefined / '' 一律视为缺失（避免 Number(null) === 0 的陷阱） */
function toNumber(value) {
  if (value === null || value === undefined || value === '') return NaN
  return Number(value)
}

/** 读取坐标：接受 {lat,lng} 或 [lng,lat]，非法/空返回 null */
export function readLatLng(value) {
  if (!value) return null
  if (Array.isArray(value)) {
    const lng = toNumber(value[0])
    const lat = toNumber(value[1])
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  }
  const lat = toNumber(value.lat)
  const lng = toNumber(value.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

/* ---------- 投影：经纬度 ←→ 世界像素 ---------- */

/** 经纬度 → 世界像素（256 基准，原点在西北角） */
export function project(lngLat, zoom) {
  const ll = readLatLng(lngLat)
  if (!ll) return null
  const size = TILE_SIZE * Math.pow(2, clampZoom(zoom))
  const lat = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, ll.lat))
  const sin = Math.sin((lat * Math.PI) / 180)
  return {
    x: ((ll.lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  }
}

/** 世界像素 → 经纬度（经度归一化到 [-180,180)，纬度由墨卡托反解自然落在 ±85.05° 内） */
export function unproject(xy, zoom) {
  const x = Number(xy && xy.x)
  const y = Number(xy && xy.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const size = TILE_SIZE * Math.pow(2, clampZoom(zoom))
  const rawLng = (x / size) * 360 - 180
  const lng = ((((rawLng + 180) % 360) + 360) % 360) - 180
  const n = Math.PI - (2 * Math.PI * y) / size
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n))
  return { lng, lat }
}

/* ---------- 屏幕像素 ←→ 经纬度（视图 = {center, zoom, width, height}） ---------- */

/** 经纬度 → 容器内屏幕像素（left/top，容器中心对齐视图中心） */
export function screenPoint(lngLat, view) {
  const ll = readLatLng(lngLat)
  if (!ll || !view) return null
  const p = project(ll, view.zoom)
  const c = project(view.center, view.zoom)
  if (!p || !c) return null
  return {
    x: p.x - c.x + (Number(view.width) || 0) / 2,
    y: p.y - c.y + (Number(view.height) || 0) / 2,
  }
}

/** 容器内屏幕像素 → 经纬度 */
export function viewLngLat(xy, view) {
  if (!view || !xy) return null
  const c = project(view.center, view.zoom)
  if (!c) return null
  return unproject(
    {
      x: c.x + Number(xy.x) - (Number(view.width) || 0) / 2,
      y: c.y + Number(xy.y) - (Number(view.height) || 0) / 2,
    },
    view.zoom,
  )
}

/** 内容在屏幕上平移 (dx, dy) 像素后的新中心（拖拽用） */
export function panCenter(center, zoom, dx, dy) {
  const c = project(center, zoom)
  if (!c) return null
  return unproject({ x: c.x - Number(dx || 0), y: c.y - Number(dy || 0) }, zoom)
}

/** 以屏幕锚点 anchor 为不动点缩放到 nextZoom，返回新中心（锚点缺省为容器中心） */
export function zoomCenterAt(center, zoom, nextZoom, anchor, size = {}) {
  const width = Number(size.width) || 0
  const height = Number(size.height) || 0
  const ax = Number.isFinite(anchor && anchor.x) ? Number(anchor.x) : width / 2
  const ay = Number.isFinite(anchor && anchor.y) ? Number(anchor.y) : height / 2
  const nz = clampZoom(nextZoom)
  const ll = viewLngLat({ x: ax, y: ay }, { center, zoom, width, height })
  const p = ll && project(ll, nz)
  if (!p) return null
  return unproject({ x: p.x - (ax - width / 2), y: p.y - (ay - height / 2) }, nz)
}

/* ---------- 高德静态图（可选场景，需要 Key 才能取到图） ---------- */
export function staticMapUrl({ lng, lat, zoom = DEFAULT_ZOOM, width = 640, height = 420, key = '', scale = 2, style = '8' } = {}) {
  const ll = readLatLng({ lat, lng })
  if (!ll) return ''
  const w = Math.max(64, Math.min(1024, Math.round(Number(width) || 640)))
  const h = Math.max(64, Math.min(1024, Math.round(Number(height) || 420)))
  const params = [
    `location=${ll.lng.toFixed(6)},${ll.lat.toFixed(6)}`,
    `zoom=${clampZoom(zoom)}`,
    `size=${w}*${h}`,
    `scale=${Number(scale) || 1}`,
    `style=${style}`,
  ]
  if (key) params.push(`key=${encodeURIComponent(key)}`)
  return `https://restapi.amap.com/v3/staticmap?${params.join('&')}`
}

/* ==========================================================================
   栅格瓦片引擎
   负责：瓦片 URL、可见瓦片计算与屏幕定位、加载成败状态、已加载瓦片的 LRU
   ========================================================================== */
export class RasterTileEngine {
  constructor({ template = DEFAULT_TILE_TEMPLATE, subdomains = DEFAULT_SUBDOMAINS, maxCache = MAX_TILE_CACHE } = {}) {
    this.template = template
    this.subdomains = Array.isArray(subdomains) && subdomains.length ? subdomains : DEFAULT_SUBDOMAINS
    this.maxCache = maxCache
    this.states = new Map() // key → 'loading' | 'loaded' | 'error'
    this.order = [] // 已成功加载的 key，按时间先后（LRU）
    this.listeners = new Set()
    this.errorStreak = 0 // 连续失败数，成功一张即归零
  }

  /* ---------- 瓦片标识与 URL ---------- */

  tileKey(x, y, z) {
    return `${z}/${x}/${y}`
  }

  /** 瓦片 x 在 0..2^z-1 之间环绕（跨 180° 经线时不出现空洞） */
  wrapX(x, z) {
    const n = Math.pow(2, Math.round(z))
    return ((x % n) + n) % n
  }

  /** 瓦片层级取最近的整数级；缩放级可为小数，用 scale 缩放瓦片尺寸 */
  tileZoom(zoom) {
    return Math.round(clampZoom(zoom))
  }

  tileUrl(x, y, z) {
    const s = this.subdomains[Math.abs(x * 7 + y * 13) % this.subdomains.length]
    return this.template
      .replace('{s}', String(s))
      .replace('{x}', String(x))
      .replace('{y}', String(y))
      .replace('{z}', String(z))
  }

  /* ---------- 加载状态 ---------- */

  statusOf(key) {
    return this.states.get(key) || 'idle'
  }

  hasLoaded(key) {
    return this.states.get(key) === 'loaded'
  }

  get loadedCount() {
    return this.order.length
  }

  noteRequest(key) {
    if (!this.states.has(key)) this.states.set(key, 'loading')
  }

  noteLoad(key) {
    this.errorStreak = 0
    if (this.states.get(key) === 'loaded') return
    this.states.set(key, 'loaded')
    this.order.push(key)
    this.evict()
    this.emit()
  }

  noteError(key) {
    this.states.set(key, 'error')
    this.errorStreak += 1
    this.emit()
  }

  evict() {
    while (this.order.length > this.maxCache) {
      const key = this.order.shift()
      if (this.states.get(key) === 'loaded') this.states.delete(key)
    }
  }

  /* ---------- 订阅（引擎状态变化 → 画布重渲） ---------- */

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit() {
    this.listeners.forEach((listener) => {
      try {
        listener(this)
      } catch (err) {
        /* 监听器异常不得影响地图渲染，也不得冒泡成未捕获异常 */
        if (typeof console !== 'undefined') console.warn('[map] tile listener failed', err)
      }
    })
  }

  reset() {
    this.states.clear()
    this.order.length = 0
    this.errorStreak = 0
    this.emit()
  }

  /* ---------- 可见瓦片计算 ---------- */
  /**
   * 返回视口内（含 buffer 圈）的瓦片列表，每项含左上角的容器内像素坐标：
   *   left = 瓦片世界像素.x - 视图中心世界像素.x + 容器宽/2
   *   top  = 瓦片世界像素.y - 视图中心世界像素.y + 容器高/2
   * 其中瓦片世界像素取该瓦片左上角 project(瓦片左上角经纬度, zoom)
   */
  viewTiles({ center, zoom, width, height, buffer = 1 } = {}) {
    const z = clampZoom(zoom)
    const tz = this.tileZoom(z)
    const scale = Math.pow(2, z - tz)
    const size = TILE_SIZE * scale
    const w = Number(width) || 0
    const h = Number(height) || 0
    const empty = { zoom: z, tileZoom: tz, scale, size, tiles: [], count: 0 }
    if (w <= 0 || h <= 0) return empty

    const centerWorld = project(center, z) || project(DEFAULT_CENTER, z)
    const n = Math.pow(2, tz)
    const halfW = w / 2
    const halfH = h / 2
    const pad = Math.max(0, Math.round(Number(buffer) || 0))

    const minX = Math.floor((centerWorld.x - halfW) / size) - pad
    const maxX = Math.floor((centerWorld.x + halfW) / size) + pad
    const minY = Math.max(0, Math.floor((centerWorld.y - halfH) / size) - pad)
    const maxY = Math.min(n - 1, Math.floor((centerWorld.y + halfH) / size) + pad)

    const tiles = []
    for (let ty = minY; ty <= maxY; ty += 1) {
      for (let tx = minX; tx <= maxX; tx += 1) {
        const wx = this.wrapX(tx, tz)
        const key = this.tileKey(wx, ty, tz)
        tiles.push({
          key,
          x: wx,
          y: ty,
          z: tz,
          url: this.tileUrl(wx, ty, tz),
          state: this.states.get(key) || 'idle',
          left: tx * size - centerWorld.x + halfW,
          top: ty * size - centerWorld.y + halfH,
          size,
        })
      }
    }
    return { zoom: z, tileZoom: tz, scale, size, tiles, count: tiles.length }
  }
}

/** 便捷工厂：多数场景直接 new RasterTileEngine() 即可 */
export function createTileEngine(options) {
  return new RasterTileEngine(options)
}
