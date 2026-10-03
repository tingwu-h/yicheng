/* ==========================================================================
   底图来源徽标
   正常栅格地图不显示技术标签；仍保留离线提示和显式自定义标签。
   状态默认可从 MapCanvas 写入的 MapStatusContext 读取，也支持显式 props 覆盖
   ========================================================================== */
import { useContext } from 'react'
import { MapStatusContext, providerLabel } from './provider.js'

export default function MapProviderBadge({ provider, degraded, className = '', label, title }) {
  const status = useContext(MapStatusContext) || {}
  const finalProvider = provider || status.provider || 'raster'
  const isOffline = degraded === undefined || degraded === null ? !!status.degraded : !!degraded

  const text = label || providerLabel(finalProvider, isOffline)
  if (text === '栅格底图') return null

  return (
    <span
      className={['map-badge', isOffline ? 'is-offline' : '', className].filter(Boolean).join(' ')}
      role="status"
      title={title || text}
    >
      {text}
    </span>
  )
}
