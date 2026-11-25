// Colour coded status lines for an event.
// red: act now (few seats, closing today or tomorrow, full)
// amber: soon (filling fast, closing in 2 or 3 days, paused)
// green: fine (seats available, discount, free)
// grey: over (closed)
import { eventCloseAt } from './eventState.js'
import { fmtDateShort, fmtTime, todayIST } from './format.js'

function istParts(d) {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000)
  return { date: ist.toISOString().slice(0, 10), time: ist.toISOString().slice(11, 16) }
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
}

export function seatsIndicator(e) {
  const left = e.seatsLeft
  if (left <= 0) return { tone: 'red', label: 'Fully booked' }
  if (left <= 10 || left / e.seats <= 0.1) return { tone: 'red', label: `Only ${left} ${left === 1 ? 'seat' : 'seats'} left` }
  if (left / e.seats <= 0.25) return { tone: 'amber', label: `Filling fast, ${left} seats left` }
  return { tone: 'green', label: `${left} seats left` }
}

export function closingIndicator(e, now = new Date()) {
  if (e.state !== 'open') return null
  const close = istParts(eventCloseAt(e))
  const days = daysBetween(todayIST(), close.date)
  if (days <= 0) return { tone: 'red', label: `Closes today, ${fmtTime(close.time)}` }
  if (days === 1) return { tone: 'red', label: 'Closes tomorrow' }
  if (days <= 3) return { tone: 'amber', label: `Closes in ${days} days` }
  return null
}

export function stateIndicator(e) {
  switch (e.state) {
    case 'closed':
      return { tone: 'grey', label: 'Registration closed' }
    case 'paused':
      return { tone: 'amber', label: 'Bookings paused' }
    case 'soon':
      return { tone: 'blue', label: `Opens ${fmtDateShort(e.bookingOpens)}` }
    case 'full':
      return { tone: 'red', label: 'Fully booked' }
    default:
      return null
  }
}

export function Ind({ tone, label, as: Tag = 'span' }) {
  return <Tag className={`ind ind-${tone}`}>{label}</Tag>
}
