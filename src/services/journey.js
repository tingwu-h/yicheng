import { ROUTES } from '../data/community.js'
import { addCalendarDays, localTodayISO } from '../lib/calendarDates.js'

export const ROUTE_DAYS = {
  r1: [['a1', 'a2'], ['a4', 'a5', 'a6'], ['a3']],
  r2: [['a4', 'a10', 'a11', 'a18'], ['a1']],
  r3: [['a16'], ['a23', 'a15']],
}
export function routeTrip(routeId, startDate = localTodayISO()) {
  const route = ROUTES.find(r => r.id === routeId)
  if (!route) return null
  return { id: `draft-${routeId}-${Date.now()}`, title: route.name, startDate, companions: 'friends', routeId,
    description: route.desc, days: ROUTE_DAYS[routeId].map((ids, i) => ({ date: addCalendarDays(startDate, i),
      items: ids.map((attractionId, j) => ({ id: `${routeId}-${i}-${j}`, attractionId,
        time: ['09:00', '12:30', '15:00', '17:00'][j], note: '参考安排，可按体力与预约情况调整' })) })) }
}

export function startJourney(state, { trip, userId, members, baselineIds = [], now = new Date().toISOString() }) {
  if (!userId || !trip?.days?.some(d => d.items.length)) return state
  if (state.active?.userId === userId && state.active.trip.id === trip.id) return state
  // A different active trip must be finished explicitly first.
  if (state.active) return state
  return { ...state, active: { id: `play-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, userId,
    trip: structuredClone(trip), members: structuredClone(members), startedAt: now, baselineIds } }
}

export function finishJourney(state, { sessionId, userId, records = [], now = new Date().toISOString() }) {
  const active = state.active
  if (!active || active.id !== sessionId || active.userId !== userId) return state
  const valid = new Set(active.trip.days.flatMap(d => d.items.flatMap(item =>
    ['checkin', 'photo'].map(type => `trip-${d.date}-${item.attractionId}-${type}`))))
  const completedTasks = records.filter(r => valid.has(r.taskId) && !active.baselineIds.includes(r.taskId))
  const history = { ...active, endedAt: now, status: 'ended', completedTasks,
    durationSeconds: Math.max(0, Math.floor((new Date(now) - new Date(active.startedAt)) / 1000)) }
  return { ...state, active: null, records: [history, ...state.records.filter(r => r.id !== sessionId)] }
}

export const emptyJourneys = () => ({ version: 1, active: null, records: [] })
export function loadJourneys(storage) {
  try { const data = JSON.parse(storage.getItem('changan-journeys-vh05')); return data && Array.isArray(data.records) ? data : emptyJourneys() }
  catch { return emptyJourneys() }
}
