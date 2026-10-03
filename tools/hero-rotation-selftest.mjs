import assert from 'node:assert/strict'
import { HERO_INTERVAL_MS, startHeroRotation } from '../src/lib/heroRotation.js'

function createClock() {
  let now = 0, sequence = 0
  const jobs = new Map()
  return {
    setInterval(run, every) { const id = ++sequence; jobs.set(id, { run, every, at: now + every }); return id },
    clearInterval(id) { jobs.delete(id) },
    advance(ms) {
      const end = now + ms
      while (true) {
        const next = [...jobs.values()].sort((a, b) => a.at - b.at)[0]
        if (!next || next.at > end) break
        now = next.at; next.at += next.every; next.run()
      }
      now = end
    },
    get pending() { return jobs.size },
  }
}
assert.equal(HERO_INTERVAL_MS, 3000)
for (const reducedMotion of [false, true]) {
  const clock = createClock(), changes = []
  const stop = startHeroRotation({ paused: false, visible: true, nextIndex: 1, reducedMotion, clock, isReady: () => true, advance: index => changes.push(index) })
  clock.advance(2999); assert.deepEqual(changes, [])
  clock.advance(1); assert.deepEqual(changes, [1])
  clock.advance(3000); assert.deepEqual(changes, [1, 1])
  stop(); assert.equal(clock.pending, 0)
  clock.advance(9000); assert.equal(changes.length, 2)
}
for (const options of [{ paused: true, visible: true, nextIndex: 1 }, { paused: false, visible: false, nextIndex: 1 }, { paused: false, visible: true, nextIndex: undefined }]) {
  const clock = createClock()
  startHeroRotation({ ...options, clock, isReady: () => true, advance: () => assert.fail('Rotation should be paused') })
  assert.equal(clock.pending, 0)
}
const clock = createClock(), changes = []
let ready = false
const stop = startHeroRotation({ paused: false, visible: true, nextIndex: 0, clock, isReady: () => ready, advance: index => changes.push(index) })
clock.advance(3000); assert.deepEqual(changes, [])
ready = true; clock.advance(3000); assert.deepEqual(changes, [0])
stop()
console.log('hero-rotation-selftest: passed (2999/3000/6000ms, reduced motion, pause, hidden tab, readiness, index zero, cleanup)')
