/* ==========================================================================
   src/map 统一出口
   页面只从这里 import：import MapCanvas from '../map'
   （不要直接 import amap-provider 的实现）
   ========================================================================== */
import MapCanvas from './MapCanvas.jsx'

export default MapCanvas
export { default as MapCanvas } from './MapCanvas.jsx'
export { default as MapProviderBadge } from './MapProviderBadge.jsx'
export {
  resolveProvider,
  getAmapKey,
  providerLabel,
  useMapStatus,
  MapStatusContext,
} from './provider.js'
export * from './engine.js'
