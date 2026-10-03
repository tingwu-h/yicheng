/* ==========================================================================
   几何工具库（契约 B · geo-utils）
   纯函数、无副作用：不依赖 React，不 import 任何数据文件，不新增 npm 依赖。
   坐标约定：对外统一 { lat, lng }（WGS84 近似，单位：度）。
   高德 SDK 的 [lng, lat] 数组形式仅在本文件入口 toLatLng 处兼容转换，页面层不感知。
   距离一律为「直线距离」（haversine），不是实际路程，也不含实时路况。
   ========================================================================== */

/* 地球平均半径（米）：与契约 B / routeHints 保持同一常量 */
const EARTH_RADIUS = 6371008.8
/* Web Mercator 基准瓦片边长（像素） */
const TILE_SIZE = 256
/* Web Mercator 纬度上限（±85.05112878°），超出后投影发散 */
const MAX_MERCATOR_LAT = 85.05112878
/* 缩放夹取区间与退化默认值 */
const MIN_ZOOM = 1
const MAX_ZOOM = 18
const DEGENERATE_ZOOM = 14
/* 视图尺寸默认值（契约 B 的 opts 缺省） */
const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 600
const DEFAULT_PADDING = 48

/* --------------------------------------------------------------------------
   内部小工具（不导出，避免污染契约 B 的导出清单）
   -------------------------------------------------------------------------- */

/* 把任意输入转成有限数字；null / undefined / 空串 / 布尔 / 非法值 → NaN */
function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : NaN
  }
  return NaN
}

/* 经纬度合法性：必须是有限数字且落在范围内（NaN 的比较恒为 false，天然被排除） */
function isValidLat(lat) {
  return lat >= -90 && lat <= 90
}
function isValidLng(lng) {
  return lng >= -180 && lng <= 180
}

/* 数值夹取 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/* 经度 → Web Mercator 归一化 x（0..1） */
function lngToNorm(lng) {
  return (clamp(lng, -180, 180) + 180) / 360
}

/* 纬度 → Web Mercator 归一化 y（0..1，向北递减） */
function latToNorm(lat) {
  const phi = clamp(lat, -MAX_MERCATOR_LAT, MAX_MERCATOR_LAT) * (Math.PI / 180)
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI)
}

/* 角度转弧度 */
function toRad(deg) {
  return deg * (Math.PI / 180)
}

/* ==========================================================================
   坐标归一化
   ========================================================================== */

/**
 * 把任意坐标写法归一化为 { lat, lng }。
 * 支持 { lat, lng } 与 [lng, lat] 数组；null / undefined / NaN / 越界
 * （lat∉[-90,90] 或 lng∉[-180,180]）一律返回 null，绝不抛错。
 * @param {{lat:number,lng:number}|[number,number]|null|undefined} geo 原始坐标
 * @returns {{lat:number,lng:number}|null} 归一化坐标；无效时为 null
 */
export function toLatLng(geo) {
  if (!geo) return null

  let lat
  let lng
  if (Array.isArray(geo)) {
    /* 数组按契约 C 的 [lng, lat] 顺序解读 */
    lng = toNumber(geo[0])
    lat = toNumber(geo[1])
  } else if (typeof geo === 'object') {
    lat = toNumber(geo.lat)
    lng = toNumber(geo.lng)
  } else {
    return null
  }

  if (!isValidLat(lat) || !isValidLng(lng)) return null
  return { lat, lng }
}

/* ==========================================================================
   距离与方位
   ========================================================================== */

/**
 * 两点间球面直线距离（haversine，米）。任一点无效则返回 null。
 * @param {{lat:number,lng:number}|[number,number]} a 起点
 * @param {{lat:number,lng:number}|[number,number]} b 终点
 * @returns {number|null} 距离（米）；无效输入为 null
 */
export function haversine(a, b) {
  const p = toLatLng(a)
  const q = toLatLng(b)
  if (!p || !q) return null

  const phi1 = toRad(p.lat)
  const phi2 = toRad(q.lat)
  const dPhi = phi2 - phi1
  const dLambda = toRad(q.lng - p.lng)
  const s =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2
  /* 夹到 1，规避浮点误差导致的 asin 域外 */
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(s)))
}

/**
 * 距离文案：小于 1000 米时四舍五入到 10 米（如 820 米），否则保留 1 位小数公里（如 12.4 公里）。
 * 单位阈值按「原始米数」判断：999 米 → 四舍五入得 1000 → 显示「1000 米」，
 * 与项目内 src/lib/routeHints.js 的 formatMeters 口径一致。
 * 公里值用 Math.round 显式半进位到 0.1 公里（12350 → 12.4 公里），避免 toFixed 的浮点截断。
 * null / undefined / NaN / Infinity / 非数字 → 空字符串；负数按 0 处理。
 * @param {number} meters 距离（米）
 * @returns {string} 展示文案，如 '820 米' / '12.4 公里'；无效输入为 ''
 */
export function formatDistance(meters) {
  const m = toNumber(meters)
  if (!Number.isFinite(m)) return ''

  const value = Math.max(0, m)
  if (value < 1000) return `${Math.round(value / 10) * 10} 米`
  /* 先半进位到 0.1 公里再定点输出，规避 (12.35).toFixed(1) === '12.3' 的浮点截断 */
  return `${(Math.round(value / 100) / 10).toFixed(1)} 公里`
}

/**
 * 方位提示（8 方位，从 a 指向 b），用于「在 A 的东北方向 12 公里」。
 * 任一点无效、或两点重合（方位无意义）时返回空字符串。
 * @param {{lat:number,lng:number}} a 起点
 * @param {{lat:number,lng:number}} b 终点
 * @returns {'北'|'东北'|'东'|'东南'|'南'|'西南'|'西'|'西北'|''} 方位名
 */
export function bearingHint(a, b) {
  const p = toLatLng(a)
  const q = toLatLng(b)
  if (!p || !q) return ''

  const phi1 = toRad(p.lat)
  const phi2 = toRad(q.lat)
  const dLambda = toRad(q.lng - p.lng)
  if (phi1 === phi2 && dLambda === 0) return '' /* 两点重合，方位无意义 */

  const y = Math.sin(dLambda) * Math.cos(phi2)
  const x =
    Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda)
  const deg = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360

  const names = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  return names[Math.round(deg / 45) % 8]
}

/* ==========================================================================
   包围盒与视野
   ========================================================================== */

/**
 * 计算点集的最小包围盒；非法点被跳过，空数组或全部无效返回 null。
 * 只有一个有效点时返回退化包围盒（min 与 max 相等）。
 * @param {Array<{lat:number,lng:number}|[number,number]>} points 点集
 * @returns {{minLat:number,maxLat:number,minLng:number,maxLng:number}|null} 包围盒
 */
export function boundsOf(points) {
  if (!Array.isArray(points) || points.length === 0) return null

  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  let found = false

  for (const point of points) {
    const geo = toLatLng(point)
    if (!geo) continue
    found = true
    if (geo.lat < minLat) minLat = geo.lat
    if (geo.lat > maxLat) maxLat = geo.lat
    if (geo.lng < minLng) minLng = geo.lng
    if (geo.lng > maxLng) maxLng = geo.lng
  }

  if (!found) return null
  return { minLat, maxLat, minLng, maxLng }
}

/**
 * 点集中心：取包围盒的几何中点（对离群点比平均值更稳，适合作为地图中心）。
 * 空数组或全部无效返回 null；单点返回该点本身。
 * @param {Array<{lat:number,lng:number}|[number,number]>} points 点集
 * @returns {{lat:number,lng:number}|null} 中心坐标
 */
export function centerOf(points) {
  const bounds = boundsOf(points)
  if (!bounds) return null
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  }
}

/**
 * 由包围盒反算合适的 Web Mercator 缩放级别（256 像素基准瓦片）。
 * 公式：zoom = log2(可用像素 / (256 × 归一化跨度))，取水平/垂直需求的较小值并向下取整，
 * 最后夹到 [1, 18]；bounds 为 null / 字段非法 / 退化成单点时返回 14。
 * @param {{minLat:number,maxLat:number,minLng:number,maxLng:number}|null} bounds 包围盒
 * @param {{width?:number,height?:number,padding?:number}} [opts] 视图尺寸与内边距（像素）
 * @returns {number} 缩放级别，1..18 的整数
 */
export function zoomForBounds(bounds, opts) {
  const options = opts && typeof opts === 'object' ? opts : {}
  const rawWidth = toNumber(options.width)
  const rawHeight = toNumber(options.height)
  const width = rawWidth > 0 ? rawWidth : DEFAULT_WIDTH
  const height = rawHeight > 0 ? rawHeight : DEFAULT_HEIGHT
  const rawPadding = toNumber(options.padding)
  const padding = Number.isFinite(rawPadding) && rawPadding >= 0 ? rawPadding : DEFAULT_PADDING

  if (!bounds || typeof bounds !== 'object') return DEGENERATE_ZOOM

  const minLat = toNumber(bounds.minLat)
  const maxLat = toNumber(bounds.maxLat)
  const minLng = toNumber(bounds.minLng)
  const maxLng = toNumber(bounds.maxLng)
  if (![minLat, maxLat, minLng, maxLng].every((v) => Number.isFinite(v))) return DEGENERATE_ZOOM

  const north = Math.max(minLat, maxLat)
  const south = Math.min(minLat, maxLat)
  const west = Math.min(minLng, maxLng)
  const east = Math.max(minLng, maxLng)

  const dx = Math.abs(lngToNorm(east) - lngToNorm(west))
  const dy = Math.abs(latToNorm(south) - latToNorm(north))
  /* 完全退化成单点（经纬跨度都为 0）→ 默认级别 */
  if (!(dx > 0) && !(dy > 0)) return DEGENERATE_ZOOM

  const availW = Math.max(1, width - 2 * padding)
  const availH = Math.max(1, height - 2 * padding)
  const zoomX = dx > 0 ? Math.log2(availW / (TILE_SIZE * dx)) : Infinity
  const zoomY = dy > 0 ? Math.log2(availH / (TILE_SIZE * dy)) : Infinity
  const zoom = Math.min(zoomX, zoomY)
  if (!Number.isFinite(zoom)) return DEGENERATE_ZOOM

  return clamp(Math.floor(zoom), MIN_ZOOM, MAX_ZOOM)
}

/* ==========================================================================
   路线次序与里程
   ========================================================================== */

/**
 * 最近邻贪心排序：从第一个有效点出发，每次选取距当前点最近且未访问的点。
 * 返回新数组，绝不修改入参（元素引用沿用原数组，不深拷贝）。
 * 无效坐标点不参与排序，按原相对顺序追加到结果末尾，保证长度与内容不丢失。
 * @param {Array<{lat:number,lng:number}|[number,number]>} points 点集
 * @returns {Array} 新数组（排序后的点）；非数组或空数组返回 []
 */
export function nearestOrder(points) {
  if (!Array.isArray(points) || points.length === 0) return []

  const valid = []
  const invalid = []
  for (const point of points) {
    const geo = toLatLng(point)
    if (geo) valid.push({ geo, point })
    else invalid.push(point)
  }
  if (valid.length <= 1) return [...valid.map((v) => v.point), ...invalid]

  const remaining = valid.slice(1)
  const ordered = [valid[0]]

  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1].geo
    let bestIndex = 0
    let bestMeters = Infinity
    for (let i = 0; i < remaining.length; i += 1) {
      const meters = haversine(last, remaining[i].geo)
      if (meters != null && meters < bestMeters) {
        bestMeters = meters
        bestIndex = i
      }
    }
    ordered.push(remaining[bestIndex])
    remaining.splice(bestIndex, 1)
  }

  return [...ordered.map((v) => v.point), ...invalid]
}

/**
 * 路线里程统计：按给定顺序逐段求和。
 * 少于 2 个点 → { totalMeters: 0, legs: [] }；无法定位的段 meters 为 null 且不计入总里程。
 * legs 的 from / to 为归一化后的 { lat, lng }（无效点为 null），下标与入参顺序一一对应。
 * @param {Array<{lat:number,lng:number}|[number,number]>} points 点集（已排序）
 * @returns {{totalMeters:number,legs:Array<{from:{lat:number,lng:number}|null,to:{lat:number,lng:number}|null,meters:number|null}>}} 里程统计
 */
export function routeStats(points) {
  if (!Array.isArray(points) || points.length < 2) return { totalMeters: 0, legs: [] }

  const legs = []
  let totalMeters = 0
  for (let i = 1; i < points.length; i += 1) {
    const from = toLatLng(points[i - 1])
    const to = toLatLng(points[i])
    const meters = from && to ? haversine(from, to) : null
    if (Number.isFinite(meters)) totalMeters += meters
    legs.push({ from, to, meters })
  }

  return { totalMeters, legs }
}

/* ==========================================================================
   默认视野常量
   ========================================================================== */

/**
 * 西安全域默认视野（钟楼附近为城市中心，缩放 11 大致覆盖主城区）。
 * 冻结常量，避免调用方误改导致全局视野被污染。
 */
export const XIAN_VIEWPORT = Object.freeze({
  center: Object.freeze({ lat: 34.26, lng: 108.94 }),
  zoom: 11,
})
