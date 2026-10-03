/* ==========================================================================
   高德地图 JS API 提供方（amap-provider）
   ─────────────────────────────────────────────────────────────────────────
   本文件负责「把高德 Web 端 JS API 加载进来」这一件事，是唯一接触高德细节的地方；
   页面层只认 { lat, lng }，高德内部的 [lng, lat] 顺序在本文件内完成转换。

   ── 怎么申请高德 Key（Web 端 JS API）────────────────────────────────────
     1. 打开 https://console.amap.com/dev/key/app 登录高德开放平台；
     2. 「应用管理 → 我的应用 → 创建新应用」（名称随意）；
     3. 在该应用下「添加 Key」，服务平台必须选 **Web端(JS API)**；
     4. 复制 32 位 Key；若控制台同时给出「安全密钥 securityJsCode」也要一并记下。

   ── Key 填到哪里（二选一）──────────────────────────────────────────────
     A. 推荐：项目根目录 `.env.local`（已在 .gitignore 中，不会进仓库）
            VITE_AMAP_KEY=你的Key
            VITE_AMAP_SECURITY=你的安全密钥
        改完需要重启 `npm run dev`（Vite 只在启动时读 .env 文件）。
     B. 或直接改 `src/config/mapConfig.js` 的 AMAP_KEY / AMAP_SECURITY（会被提交，慎用）。
     优先级：VITE_AMAP_KEY > mapConfig.AMAP_KEY。

   ── 没配置会怎样 ───────────────────────────────────────────────────────
     系统**不会报错**，会自动降级为「无需 Key 的栅格瓦片底图」；
     若瓦片也连不上，再降级为自绘示意底图。也就是说：不填 Key 也能正常看到地图。
     本文件的所有导出都保证「失败只返回 null，不抛错」，由地图引擎决定回退策略。

   ── 约束提醒 ───────────────────────────────────────────────────────────
     · 无 Key 时不注入任何 <script>（不产生无用网络请求）。
     · 并发调用 loadAmap() 只注入一次脚本（模块级 promise 缓存）。
     · 8 秒超时 / 脚本 onerror → resolve(null)，并清理定时器与脚本标签。
     · SDK 未就绪前不会使用 window.AMap 的任何能力。
   ========================================================================== */

import { AMAP_KEY, AMAP_SECURITY, DEFAULT_CENTER, DEFAULT_ZOOM } from '../config/mapConfig'

/* ===== 常量 ===== */

/* 动态注入的 script 标签 id，便于「已存在则复用」与失败时清理。 */
const SCRIPT_ID = 'amap-jsapi-script'
/* 高德 JS API 2.0 脚本地址前缀；完整地址见 buildScriptUrl()。 */
const SCRIPT_URL_BASE = 'https://webapi.amap.com/maps?v=2.0'
/* 加载超时（毫秒）：超过即认为不可用，回退栅格底图。 */
const LOAD_TIMEOUT_MS = 8000

/* ===== 模块级状态 ===== */

/* 进行中 / 已完成的加载 promise，用于并发去重；
   加载失败后会置回 null，允许后续（网络恢复、补填 Key）重试。 */
let amapPromise = null

/* ===== 运行环境安全取值 ===== */

function getWindow() {
  if (typeof window !== 'undefined' && window) return window
  if (typeof globalThis !== 'undefined' && globalThis) return globalThis
  return null
}

function getDocument() {
  if (typeof document !== 'undefined' && document) return document
  return null
}

/* 读取 .env.local 里的 VITE_AMAP_KEY。
   import.meta.env 只在 Vite 环境存在，这里用 typeof / 短路做保护，
   即便在没有 Vite 的裸 ESM 环境（如 node 单测脚本）调用也不会抛错。 */
function readEnvKey() {
  try {
    if (typeof import.meta === 'undefined') return ''
    const env = import.meta.env
    if (env && typeof env.VITE_AMAP_KEY === 'string') return env.VITE_AMAP_KEY.trim()
  } catch (e) {
    /* 忽略：非 Vite 环境没有 import.meta.env */
  }
  return ''
}

/* 同上，读取安全密钥 VITE_AMAP_SECURITY。 */
function readEnvSecurity() {
  try {
    if (typeof import.meta === 'undefined') return ''
    const env = import.meta.env
    if (env && typeof env.VITE_AMAP_SECURITY === 'string') return env.VITE_AMAP_SECURITY.trim()
  } catch (e) {
    /* 忽略 */
  }
  return ''
}

function readConfigSecurity() {
  return typeof AMAP_SECURITY === 'string' ? AMAP_SECURITY.trim() : ''
}

/* ===== 坐标与数值工具（全部内部使用） ===== */

/* 把对外统一的 { lat, lng }（或高德风格的 [lng, lat]、AMap.LngLat 实例）转成 { lat, lng }；
   非法输入一律返回 null。 */
function toLatLng(input) {
  if (!input) return null
  if (typeof input.getLat === 'function' && typeof input.getLng === 'function') {
    const lat = Number(input.getLat())
    const lng = Number(input.getLng())
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  }
  if (Array.isArray(input)) {
    // 高德内部顺序：[经度, 纬度]
    const lng = Number(input[0])
    const lat = Number(input[1])
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  }
  if (typeof input === 'object') {
    const lat = Number(input.lat)
    const lng = Number(input.lng)
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  }
  return null
}

/* { lat, lng } → 高德内部 [lng, lat]。 */
function toAmapPosition(latLng) {
  return [latLng.lng, latLng.lat]
}

function toZoom(value, fallback) {
  const zoom = Number(value)
  if (!Number.isFinite(zoom)) return fallback
  return Math.min(18, Math.max(3, zoom))
}

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/

function safeColor(color, fallback) {
  return typeof color === 'string' && HEX_COLOR.test(color.trim()) ? color.trim() : fallback
}

/* ===== 公开 API · Key ===== */

/* 读取高德 Key：import.meta.env.VITE_AMAP_KEY 优先，其次 src/config/mapConfig 的 AMAP_KEY；
   都没有 → ''（调用方据此走栅格降级）。永不抛错。 */
export function getAmapKey() {
  const envKey = readEnvKey()
  if (envKey) return envKey
  const configKey = typeof AMAP_KEY === 'string' ? AMAP_KEY.trim() : ''
  return configKey || ''
}

/* ===== 公开 API · 加载 SDK ===== */

function buildScriptUrl(key) {
  // 契约地址：https://webapi.amap.com/maps?v=2.0&key=<key>
  // 如需官方控件/插件，可在此追加 &plugin=AMap.Scale,AMap.ToolBar
  return SCRIPT_URL_BASE + '&key=' + encodeURIComponent(key)
}

/* 页面上是否已经存在高德脚本（例如 index.html 手工引入，或上一次注入残留）。 */
function findExistingScript(doc) {
  try {
    const byId = doc.getElementById(SCRIPT_ID)
    if (byId) return byId
    const scripts = doc.getElementsByTagName('script')
    for (let i = 0; scripts && i < scripts.length; i++) {
      const node = scripts[i]
      if (node && typeof node.src === 'string' && node.src.indexOf('webapi.amap.com/maps') !== -1) return node
    }
  } catch (e) {
    /* 忽略：拿不到就当作不存在 */
  }
  return null
}

/* 注入 script 并等待就绪。始终保持 resolve：成功 → window.AMap，失败 → null。
   成功时保留标签，失败时移除自己注入的标签并清理定时器。 */
function loadScript(key) {
  return new Promise(function (resolve) {
    let settled = false
    let timer = null
    let script = null
    let owned = false // 只有自己注入的标签才允许移除

    const safeResolve = function (value) {
      if (settled) return
      settled = true
      resolve(value)
    }

    const cleanup = function (removeTag) {
      if (timer !== null) {
        try {
          clearTimeout(timer)
        } catch (e) {
          /* 忽略 */
        }
        timer = null
      }
      if (script) {
        try {
          script.onload = null
          script.onerror = null
        } catch (e) {
          /* 忽略 */
        }
        if (removeTag && owned && script.parentNode) {
          try {
            script.parentNode.removeChild(script)
          } catch (e) {
            /* 忽略 */
          }
        }
      }
    }

    const finish = function (ok) {
      if (settled) return
      const win = getWindow()
      cleanup(!ok && owned)
      safeResolve(ok && win && win.AMap ? win.AMap : null)
    }

    try {
      const doc = getDocument()
      const win = getWindow()
      if (!doc || !win) {
        safeResolve(null)
        return
      }

      // 安全密钥必须在 SDK 脚本执行前设置好，否则高德会判定为非法调用
      const security = readEnvSecurity() || readConfigSecurity()
      if (security) win._AMapSecurityConfig = { securityJsCode: security }

      script = findExistingScript(doc)
      if (script) {
        owned = false
      } else {
        if (typeof doc.createElement !== 'function') {
          finish(false)
          return
        }
        script = doc.createElement('script')
        owned = true
        script.id = SCRIPT_ID
        script.async = true
        script.defer = true
        script.src = buildScriptUrl(key)
        try {
          script.setAttribute('data-amap-jsapi', '1')
        } catch (e) {
          /* 忽略 */
        }
      }

      script.onload = function () {
        finish(true)
      }
      script.onerror = function () {
        finish(false)
      }

      if (owned) {
        const head = doc.head || (typeof doc.getElementsByTagName === 'function' ? doc.getElementsByTagName('head')[0] : null) || doc.documentElement
        if (!head || typeof head.appendChild !== 'function') {
          finish(false)
          return
        }
        head.appendChild(script)
      }

      timer = setTimeout(function () {
        finish(false)
      }, LOAD_TIMEOUT_MS)
      // 极端情况：脚本在 appendChild 时同步触发 onload/onerror，
      // 此时上面的 finish 已经结算过，这里补一次清理，避免留下野定时器。
      if (settled && timer !== null) {
        try {
          clearTimeout(timer)
        } catch (e) {
          /* 忽略 */
        }
        timer = null
      }
    } catch (e) {
      finish(false)
    }
  })
}

/* 加载高德 JS API。
   返回 Promise<AMap|null>，**永不 reject**：
     · 无 Key            → resolve(null)，且不注入 script；
     · window.AMap 已存在 → 立即复用，不重复注入；
     · 并发调用          → 共享同一个注入过程（模块级 promise 缓存）；
     · 8 秒超时 / onerror / 环境异常 → resolve(null)，并清理脚本与定时器。 */
export function loadAmap() {
  const win = getWindow()
  const ready = win && win.AMap ? win.AMap : null
  if (ready) return Promise.resolve(ready)
  if (amapPromise) return amapPromise

  const key = getAmapKey()
  if (!key) return Promise.resolve(null)

  const pending = loadScript(key).then(
    function (sdk) {
      if (!sdk && amapPromise === pending) amapPromise = null // 失败不缓存，允许重试
      return sdk || null
    },
    function () {
      if (amapPromise === pending) amapPromise = null
      return null
    },
  )
  amapPromise = pending
  return pending
}

/* ===== 公开 API · 创建地图实例 ===== */

/* 创建高德地图实例。
   createAmapMap(container, { center, zoom, onViewChange })
     center         { lat, lng }（默认取 mapConfig.DEFAULT_CENTER）
     zoom           number（默认取 mapConfig.DEFAULT_ZOOM）
     onViewChange   ({ lat, lng, zoom }) => void  拖拽/缩放结束后回调
   返回 { map, setView, addOverlays, destroy, project, unproject }；任一环节失败 → null，不抛错。 */
export async function createAmapMap(container, options) {
  const opts = options || {}
  try {
    if (!container) return null

    const AMap = await loadAmap()
    if (!AMap || typeof AMap.Map !== 'function') return null

    const center = toLatLng(opts.center) || { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng }
    const zoom = toZoom(opts.zoom, DEFAULT_ZOOM)
    const onViewChange = typeof opts.onViewChange === 'function' ? opts.onViewChange : null

    let map = null
    try {
      map = new AMap.Map(container, {
        center: toAmapPosition(center),
        zoom: zoom,
        viewMode: '2D',
        resizeEnable: true,
      })
    } catch (e) {
      return null
    }
    if (!map) return null

    let destroyed = false
    let viewHandler = null
    let overlays = []

    /* 读取当前视野（高德 LngLat → 对外 { lat, lng }） */
    const readView = function () {
      const view = { lat: center.lat, lng: center.lng, zoom: zoom }
      try {
        if (typeof map.getCenter === 'function') {
          const c = toLatLng(map.getCenter())
          if (c) {
            view.lat = c.lat
            view.lng = c.lng
          }
        }
        if (typeof map.getZoom === 'function') {
          const z = Number(map.getZoom())
          if (Number.isFinite(z)) view.zoom = z
        }
      } catch (e) {
        /* 忽略：读数失败就退回已知中心 */
      }
      return view
    }

    if (onViewChange) {
      viewHandler = function () {
        if (destroyed) return
        try {
          onViewChange(readView())
        } catch (e) {
          /* 忽略：回调里的错误不影响地图本身 */
        }
      }
      try {
        if (typeof map.on === 'function') {
          map.on('moveend', viewHandler)
          map.on('zoomend', viewHandler)
        }
      } catch (e) {
        viewHandler = null
      }
    }

    /* 设置视野：支持只给 center、只给 zoom，或两者同时给。返回是否成功。 */
    const setView = function (next) {
      if (destroyed) return false
      const input = next || {}
      const target = toLatLng(input)
      const hasZoom = Number.isFinite(Number(input.zoom))
      try {
        if (target && hasZoom && typeof map.setZoomAndCenter === 'function') {
          map.setZoomAndCenter(toZoom(input.zoom, zoom), toAmapPosition(target))
        } else {
          if (target && typeof map.setCenter === 'function') map.setCenter(toAmapPosition(target))
          else if (target && typeof map.setZoomAndCenter === 'function') map.setZoomAndCenter(zoom, toAmapPosition(target))
          if (hasZoom && typeof map.setZoom === 'function') map.setZoom(toZoom(input.zoom, zoom))
        }
        return Boolean(target || hasZoom)
      } catch (e) {
        return false
      }
    }

    /* 批量添加覆盖物。markers:[{id,name,lat,lng,color,onClick?}]，polylines:[{id,path:[{lat,lng}],color,dashed?}]。
       返回已创建的覆盖物数组（供调用方留存）。 */
    const addOverlays = function (payload) {
      const data = payload || {}
      const created = []
      if (destroyed) return created

      const markers = Array.isArray(data.markers) ? data.markers : []
      const polylines = Array.isArray(data.polylines) ? data.polylines : []

      for (let i = 0; i < markers.length; i++) {
        const item = markers[i]
        const latLng = toLatLng(item)
        if (!latLng) continue
        try {
          if (typeof AMap.Marker !== 'function') break
          const markerOptions = {
            position: toAmapPosition(latLng),
            title: item.name || item.title || '',
            zIndex: 100,
          }
          const color = item.color ? safeColor(item.color, '') : ''
          if (color) {
            // 用自定义 HTML 让片区分色与页面配色一致
            markerOptions.content =
              '<div style="width:14px;height:14px;border-radius:50%;background:' +
              color +
              ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);"></div>'
            markerOptions.anchor = 'center'
          } else {
            markerOptions.anchor = 'bottom-center'
          }
          const marker = new AMap.Marker(markerOptions)
          if (typeof item.onClick === 'function' && typeof marker.on === 'function') {
            marker.on('click', function () {
              try {
                item.onClick(item.id)
              } catch (e) {
                /* 忽略 */
              }
            })
          }
          if (typeof map.add === 'function') map.add(marker)
          overlays.push(marker)
          created.push(marker)
        } catch (e) {
          /* 单个点失败不影响其他点 */
        }
      }

      for (let i = 0; i < polylines.length; i++) {
        const item = polylines[i]
        const path = Array.isArray(item && item.path) ? item.path : []
        const positions = []
        for (let j = 0; j < path.length; j++) {
          const latLng = toLatLng(path[j])
          if (latLng) positions.push(toAmapPosition(latLng))
        }
        if (positions.length < 2) continue
        try {
          if (typeof AMap.Polyline !== 'function') break
          const line = new AMap.Polyline({
            path: positions,
            strokeColor: safeColor(item.color, '#B2372E'),
            strokeWeight: 4,
            strokeStyle: item.dashed ? 'dashed' : 'solid',
            lineJoin: 'round',
            zIndex: 50,
          })
          if (typeof map.add === 'function') map.add(line)
          overlays.push(line)
          created.push(line)
        } catch (e) {
          /* 忽略单条线失败 */
        }
      }

      return created
    }

    /* 经纬度 → 容器像素坐标；对外 { lat, lng } → { x, y }。 */
    const project = function (latLng) {
      const point = toLatLng(latLng)
      if (!point || destroyed) return null
      try {
        const amapPoint = typeof AMap.LngLat === 'function' ? new AMap.LngLat(point.lng, point.lat) : toAmapPosition(point)
        let px = null
        if (typeof map.lngLatToContainer === 'function') px = map.lngLatToContainer(amapPoint)
        else if (typeof map.lngLatToPixel === 'function') px = map.lngLatToPixel(amapPoint)
        if (!px) return null
        const x = typeof px.getX === 'function' ? px.getX() : px.x
        const y = typeof px.getY === 'function' ? px.getY() : px.y
        return Number.isFinite(Number(x)) && Number.isFinite(Number(y)) ? { x: Number(x), y: Number(y) } : null
      } catch (e) {
        return null
      }
    }

    /* 容器像素坐标 → { lat, lng }。 */
    const unproject = function (point) {
      if (!point || destroyed) return null
      const x = Number(point.x)
      const y = Number(point.y)
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null
      try {
        const amapPixel = typeof AMap.Pixel === 'function' ? new AMap.Pixel(x, y) : { x: x, y: y }
        let lngLat = null
        if (typeof map.containerToLngLat === 'function') lngLat = map.containerToLngLat(amapPixel)
        else if (typeof map.pixelToLngLat === 'function') lngLat = map.pixelToLngLat(amapPixel)
        return toLatLng(lngLat)
      } catch (e) {
        return null
      }
    }

    /* 销毁：先解绑事件，再清理覆盖物，最后 map.destroy()。可重复调用。 */
    const destroy = function () {
      if (destroyed) return
      destroyed = true
      try {
        if (viewHandler && typeof map.off === 'function') {
          map.off('moveend', viewHandler)
          map.off('zoomend', viewHandler)
        }
      } catch (e) {
        /* 忽略 */
      }
      viewHandler = null
      try {
        if (overlays.length && typeof map.remove === 'function') map.remove(overlays)
      } catch (e) {
        /* 忽略 */
      }
      overlays = []
      try {
        if (typeof map.clearMap === 'function') map.clearMap()
      } catch (e) {
        /* 忽略 */
      }
      try {
        if (typeof map.destroy === 'function') map.destroy()
      } catch (e) {
        /* 忽略 */
      }
    }

    return {
      map: map,
      setView: setView,
      addOverlays: addOverlays,
      destroy: destroy,
      project: project,
      unproject: unproject,
    }
  } catch (e) {
    return null
  }
}
