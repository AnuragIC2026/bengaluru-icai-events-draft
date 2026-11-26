// Event status rules shared by the browser demo and the server. No browser or server code in here.
import { istDate } from './format.js'

export function eventStart(e) {
  return istDate(e.startDate, e.startTime)
}

export function eventCloseAt(e) {
  return e.closesAt ? new Date(`${e.closesAt}:00+05:30`) : eventStart(e)
}

// When the event itself is over: the end date at the end time, or the end of the day if no end time.
// An event stays in the upcoming list until then, even after registration closes.
export function eventEnd(e) {
  return istDate(e.endDate || e.startDate, e.endTime || '23:59')
}

export function eventEnded(e, now = new Date()) {
  return now >= eventEnd(e)
}

// open | soon | paused | full | closed
export function eventState(e, now = new Date()) {
  if (e.status === 'closed' || now >= eventCloseAt(e)) return 'closed'
  if (e.status === 'paused') return 'paused'
  if (e.bookingOpens && now < istDate(e.bookingOpens)) return 'soon'
  if (e.seatsLeft <= 0) return 'full'
  return 'open'
}

// paidHere: participants in paid bookings made on this portal
export function decorateEvent(e, paidHere = 0, now = new Date()) {
  const booked = (e.bookedBefore || 0) + paidHere
  const out = { ...e, booked, seatsLeft: Math.max(0, e.seats - booked) }
  out.state = eventState(out, now)
  out.ended = eventEnded(out, now)
  out.maxNow = Math.max(0, Math.min(e.maxPerBooking, out.seatsLeft))
  return out
}
