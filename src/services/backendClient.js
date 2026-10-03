export const BACKEND_ENABLED = typeof window !== 'undefined' && import.meta.env?.SSR !== true && import.meta.env?.VITE_APP_MODE !== 'demo'
let identityEpoch = 0
export const accountEpoch = () => identityEpoch
export const changeAccountEpoch = () => ++identityEpoch
export async function apiRequest(path, { method = 'GET', body, ...options } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Yicheng-Request': '1' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...options })
    const data = await response.json().catch(() => ({ message: '后端暂未连接，请确认服务已经启动' }))
    if (!response.ok) {
      if (response.status === 401 && !path.startsWith('/api/auth/')) window.dispatchEvent(new Event('yicheng:session-expired'))
      const error = new Error(data.message || '请求未完成，请重试'); error.status = response.status; throw error
    }
    return data
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('连接超时，请稍后重试；不会改成本机发放奖励')
    if (error instanceof TypeError) throw new Error('暂时连不上服务，请检查网络或启动后端')
    throw error
  } finally { clearTimeout(timeout) }
}
export function remoteActions(local) {
  if (!BACKEND_ENABLED) return local
  return new Proxy(local, { get(target, name) {
    if (typeof target[name] !== 'function') return target[name]
    return async (_state, input = {}) => {
      const epoch = accountEpoch()
      const { userId, now, scene, isInternalTest, reviewerId, ...body } = input
      try {
        const result = await apiRequest('/api/quest/actions/' + name, { method: 'POST', body })
        if(epoch !== accountEpoch()) return {code:409,message:'账号已切换，请重新操作'}
        return result
      } catch(e) { return {code:e.status||503,message:e.message,state:null,data:null} }
    }
  } })
}
