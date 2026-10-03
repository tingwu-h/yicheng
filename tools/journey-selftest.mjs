import assert from 'node:assert/strict'
import { ROUTE_DAYS, routeTrip, startJourney, finishJourney, emptyJourneys } from '../src/services/journey.js'

const trip = routeTrip('r1', '2026-10-01')
assert.equal(trip.days.length, 3)
assert.deepEqual(trip.days.map(d => d.items.map(i => i.attractionId)), ROUTE_DAYS.r1)

let state = emptyJourneys()
state = startJourney(state, { trip, userId: 'me', members: [{ id: 'me', petId: 'pet-qizai' }], now: '2026-10-01T09:00:00.000Z' })
assert.ok(state.active?.id)
const sessionId = state.active.id
const blocked = startJourney(state, { trip: routeTrip('r2', '2026-10-01'), userId: 'me', members: [] })
assert.equal(blocked.active.id, sessionId)
state = finishJourney(state, { sessionId, userId: 'me', records: [], now: '2026-10-01T11:00:00.000Z' })
assert.equal(state.active, null)
assert.equal(state.records[0].durationSeconds, 7200)
assert.equal(finishJourney(state, { sessionId, userId: 'me' }).records.length, 1)
console.log('journey self-test passed')
