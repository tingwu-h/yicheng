import assert from 'node:assert/strict'
import { addCalendarDays, appendTripDay, formatCalendarDate, localTodayISO, normalizeTripDates, removeTripDay } from '../src/lib/calendarDates.js'

assert.equal(addCalendarDays('2026-10-03', 1), '2026-10-04')
assert.equal(addCalendarDays('2026-10-31', 1), '2026-11-01')
assert.equal(addCalendarDays('2028-02-28', 1), '2028-02-29')
assert.equal(formatCalendarDate('2026-10-01'), '10月1日 周四')

const original = {
  startDate: '2026-10-01',
  days: [
    { date: '2026-09-30', items: [{ id: 'one' }] },
    { date: '2026-10-01', items: [{ id: 'two' }] },
  ],
}
const fixed = normalizeTripDates(original)
assert.deepEqual(fixed.days.map((day) => day.date), ['2026-10-01', '2026-10-02'])
assert.deepEqual(fixed.days.map((day) => day.items[0].id), ['one', 'two'])
assert.equal(original.days[0].date, '2026-09-30')
const extended = appendTripDay(fixed)
assert.deepEqual(extended.days.map((day) => day.date), ['2026-10-01', '2026-10-02', '2026-10-03'])
assert.deepEqual(extended.days[2].items, [])
const withoutLast = removeTripDay(extended, 2)
assert.deepEqual(withoutLast.days.map((day) => day.date), ['2026-10-01', '2026-10-02'])
const withoutFirst = removeTripDay(extended, 0)
assert.equal(withoutFirst.startDate, '2026-10-02')
assert.deepEqual(withoutFirst.days.map((day) => day.items[0]?.id), ['two', undefined])
assert.equal(removeTripDay({ ...fixed, days: [fixed.days[0]] }, 0).days.length, 1)

process.env.TZ = 'Asia/Shanghai'
assert.equal(localTodayISO(new Date('2026-09-30T16:30:00Z')), '2026-10-01')
assert.equal(addCalendarDays('2026-10-03', 1), '2026-10-04')
process.env.TZ = 'America/New_York'
assert.equal(addCalendarDays('2026-11-01', 1), '2026-11-02')

console.log('行程日期回归测试通过（跨月、闰年、时区、旧数据修复、增删天数）。')
