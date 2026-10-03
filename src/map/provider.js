/* ==========================================================================
   底图提供方判定
   - 有 Key 且高德 SDK 加载成功 → 'amap'；否则 → 'raster'（栅格瓦片，默认可用）
   - 任何失败（无 Key / 模块缺失 / 脚本 404 / 超时）都不得抛错
   - 这里同时提供地图状态上下文，供 MapProviderBadge 读取降级状态
   ========================================================================== */
import { createContext, useContext } from 'react'

/* 地图状态：MapCanvas 写入，徽标/页面读取 */
export const MapStatusContext = createContext({
  provider: 'raster',
  degraded: false,
  offline: false,
  tilesLoaded: false,
})

export function useMapStatus() {
  return useContext(MapStatusContext)
}

export function providerLabel(provider, degraded) {
  if (degraded) return '离线底图'
  return provider === 'amap' ? '高德地图' : '栅格底图'
}

/* ---------- 配置读取 ---------- */
/* mapConfig.js 由 amap-provider 产出；用 glob 引用，文件缺失时安静降级为「无 Key」 */
const configModules = import.meta.glob('../config/mapConfig.js', { eager: true })
const mapConfig = configModules['../config/mapConfig.js'] || {}

export function getAmapKey() {
  try {
    const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}
    const key = env.VITE_AMAP_KEY || mapConfig.AMAP_KEY || ''
    return String(key).trim()
  } catch (err) {
    return String(mapConfig.AMAP_KEY || '').trim()
  }
}

/* ---------- 高德 SDK 惰性加载 ---------- */
/* amap.js 由 amap-provider 产出；缺文件/加载失败一律回退栅格，不抛错 */
const amapModules = import.meta.glob('./amap.js')
let amapModulePromise = null

function loadAmapModule() {
  if (!amapModulePromise) {
    const load = amapModules['./amap.js']
    amapModulePromise = typeof load === 'function' ? load().catch(() => null) : Promise.resolve(null)
  }
  return amapModulePromise
}

/** 解析当前可用的底图提供方：'amap' | 'raster'，永不 reject */
export async function resolveProvider() {
  try {
    if (!getAmapKey()) return 'raster'
    const mod = await loadAmapModule()
    if (!mod || typeof mod.loadAmap !== 'function') return 'raster'
    const amap = await mod.loadAmap()
    return amap ? 'amap' : 'raster'
  } catch (err) {
    return 'raster'
  }
}
