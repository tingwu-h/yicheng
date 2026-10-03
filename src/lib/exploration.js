import { attractions } from '../data/attractions.js'

// A browser-only notebook, deliberately independent of quests, visits and currency.
export const EXPLORATION_KEY = 'changan.exploration.notebook.v1'
const knownIds = new Set(attractions.map((item) => item.id))
export const EXPLORATION_TITLES = Object.freeze([
  { threshold: 0, name: '执笔初识' },
  { threshold: 1, name: '长安拾景' },
  { threshold: 6, name: '巷陌寻章' },
  { threshold: 12, name: '古都知音' },
  { threshold: 24, name: '长安图鉴' },
])
export function normalizeDiscoveries(ids) {
  return Array.isArray(ids) ? [...new Set(ids.filter((id) => knownIds.has(id)))] : []
}
export function parseDiscoveries(raw) {
  try { return normalizeDiscoveries(JSON.parse(raw)) } catch { return [] }
}
export function collectDiscovery(ids, id) {
  return normalizeDiscoveries([...normalizeDiscoveries(ids), id])
}
export function explorationTitle(ids) {
  const count = normalizeDiscoveries(ids).length
  return EXPLORATION_TITLES.filter((title) => count >= title.threshold).at(-1)
}
export function loadDiscoveries(storage) {
  try { return parseDiscoveries(storage.getItem(EXPLORATION_KEY)) } catch { return [] }
}
export function saveDiscoveries(storage, ids) {
  try {
    storage.setItem(EXPLORATION_KEY, JSON.stringify(normalizeDiscoveries(ids)))
    return true
  } catch { return false }
}
