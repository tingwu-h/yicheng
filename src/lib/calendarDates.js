// Treat trip dates as calendar days, never as local-midnight timestamps.
export function localTodayISO(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addCalendarDays(iso, amount) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function formatCalendarDate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日 ${weekdays[date.getUTCDay()]}`
}

export function normalizeTripDates(trip) {
  if (!trip || !Array.isArray(trip.days)) return trip
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(trip.startDate ?? '')
    ? trip.startDate
    : trip.days[0]?.date ?? localTodayISO()
  return {
    ...trip,
    startDate,
    days: trip.days.map((day, index) => ({ ...day, date: addCalendarDays(startDate, index) })),
  }
}

export function appendTripDay(trip) {
  const current = normalizeTripDates(trip)
  const date = addCalendarDays(current.startDate, current.days.length)
  return { ...current, days: [...current.days, { date, items: [] }] }
}

export function removeTripDay(trip, dayIndex) {
  if (trip.days.length <= 1 || dayIndex < 0 || dayIndex >= trip.days.length) return trip
  const days = trip.days.filter((_, index) => index !== dayIndex)
  const startDate = dayIndex === 0 ? addCalendarDays(trip.startDate, 1) : trip.startDate
  return normalizeTripDates({ ...trip, startDate, days })
}
