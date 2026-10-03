/* ==========================================================================
   行程 · 顺路判断与里程计算
   把「是否顺路」从片区数量升级为真实直线距离：
   同一天的点位串联成一条路线，逐段给出公里数与出行建议。
   注意：全部为直线距离（haversine），不是实际路程，也不含实时路况。
   ========================================================================== */

import { regionName } from '../data/attractions'
import { haversine, toLatLng, formatDistance } from './geo'

/* 直线距离分档（米）——低于步行阈值认为可以串联，超过换乘阈值提示需要交通时间 */
export const WALK_LIMIT = 4000
export const TRANSIT_LIMIT = 15000

/* 保留旧名，避免调用方 import { formatMeters } 时失效 */
export const formatMeters = formatDistance

/* --------------------------------------------------------------------------
   单日路线：点位 → 有坐标的点位序列 → 逐段里程
   -------------------------------------------------------------------------- */
export function buildDayRoute(items, geoOf) {
  const stops = (items || [])
    .map((it, index) => {
      const geo = toLatLng(geoOf(it.attractionId))
      return geo ? { index, attractionId: it.attractionId, lat: geo.lat, lng: geo.lng } : null
    })
    .filter(Boolean)

  const legs = []
  let totalMeters = 0
  for (let i = 1; i < stops.length; i += 1) {
    const meters = haversine(stops[i - 1], stops[i])
    if (meters == null) continue
    legs.push({ from: stops[i - 1].attractionId, to: stops[i].attractionId, meters })
    totalMeters += meters
  }

  return { stops, legs, totalMeters, maxLeg: legs.reduce((m, l) => Math.max(m, l.meters), 0) }
}

/* --------------------------------------------------------------------------
   顺路结论：片区跨度 + 真实里程
   -------------------------------------------------------------------------- */
export function routeHintFor(items, geoOf, regionOf) {
  if (!items || items.length < 2) return null

  const regions = [
    ...new Set((items || []).map((i) => regionOf(i.attractionId)).filter(Boolean)),
  ]
  const route = buildDayRoute(items, geoOf)
  const names = regions.map(regionName).join('、')
  const km = route.totalMeters / 1000
  const measured = route.legs.length > 0

  /* 全部在同一片区 */
  if (regions.length <= 1) {
    const tail = measured
      ? `点位之间直线移动约 ${route.totalMeters >= 1000 ? km.toFixed(1) : (route.totalMeters / 1000).toFixed(2)} 公里，${
          route.maxLeg <= WALK_LIMIT ? '多数可以步行或短途公交串联。' : '个别点位之间距离偏大，建议搭配地铁或打车。'
        }`
      : '这些点位彼此距离较近，可以靠步行或短途交通串联。'
    return {
      kind: 'good',
      title: '这天点位都在同一片区，比较顺路',
      desc: `${regionName(regions[0])} 内的${tail}`,
      totalMeters: route.totalMeters,
      legs: route.legs,
    }
  }

  /* 跨片区 */
  const measuredTail = measured ? `点位之间直线移动约 ${km.toFixed(1)} 公里。` : ''
  if (regions.length === 2) {
    return {
      kind: 'warn',
      title: `这天跨了 ${regions.length} 个片区`,
      desc: `涉及 ${names}。${measuredTail}两个片区之间通常需要 30 分钟以上交通时间，建议确认当天时间是否充裕。`,
      totalMeters: route.totalMeters,
      legs: route.legs,
    }
  }

  return {
    kind: 'warn',
    title: `这天跨了 ${regions.length} 个片区，行程偏满`,
    desc: `涉及 ${names}。${measuredTail}西安片区之间距离较远，一天跨三个及以上片区大概率把时间耗在路上，建议拆分到不同日期。`,
    totalMeters: route.totalMeters,
    legs: route.legs,
  }
}

/* --------------------------------------------------------------------------
   整段行程求和（用于概览面板）
   -------------------------------------------------------------------------- */
export function tripRouteSummary(days, geoOf, regionOf) {
  let totalMeters = 0
  let stopCount = 0
  let unroutable = 0
  let spreadDays = 0

  ;(days || []).forEach((d) => {
    const route = buildDayRoute(d.items, geoOf)
    totalMeters += route.totalMeters
    stopCount += d.items.length
    unroutable += d.items.length - route.stops.length
    const regions = new Set((d.items || []).map((i) => regionOf(i.attractionId)).filter(Boolean))
    if (regions.size >= 2) spreadDays += 1
  })

  return { totalMeters, stopCount, unroutable, spreadDays }
}
