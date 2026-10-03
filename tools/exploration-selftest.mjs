import assert from 'node:assert/strict'
import { attractions } from '../src/data/attractions.js'
import { collectDiscovery, explorationTitle, normalizeDiscoveries, parseDiscoveries } from '../src/lib/exploration.js'

assert.equal(attractions.length, 24)
assert.deepEqual(normalizeDiscoveries(['a1', 'a1', 'a404', 'a2']), ['a1', 'a2'])
assert.deepEqual(collectDiscovery(['a1'], 'a1'), ['a1'])
assert.deepEqual(collectDiscovery(['a1'], 'a2'), ['a1', 'a2'])
assert.deepEqual(parseDiscoveries('{broken json'), [])
assert.deepEqual(parseDiscoveries(JSON.stringify(['a1', 'unknown', 'a3', 'a3'])), ['a1', 'a3'])
assert.equal(explorationTitle([]).name, '执笔初识')
assert.equal(explorationTitle(['a1']).name, '长安拾景')
assert.equal(explorationTitle(['a1', 'a2', 'a3', 'a4', 'a5', 'a6']).name, '巷陌寻章')
assert.equal(explorationTitle(Array.from({ length: 12 }, (_, i) => `a${i + 1}`)).name, '古都知音')
assert.equal(explorationTitle(attractions.map((a) => a.id)).name, '长安图鉴')
console.log('exploration-selftest: ok (dedupe, unknown ids, corrupt JSON, title thresholds)')
