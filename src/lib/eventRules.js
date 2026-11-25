// Checks an event before it is saved. Used by the admin form and by the server, so both give the same messages.
import { CATEGORY_ORDER } from './pricing.js'
import { rupees } from './format.js'

export function checkEvent(f, bookedHere = 0) {
  const e = {}
  if (!String(f.title || '').trim()) e.title = 'Give the event a name'
  if (!String(f.venue || '').trim()) e.venue = 'Add the venue, or "To be confirmed"'
  if (!f.startDate) e.startDate = 'Pick the start date'
  if (f.endDate && f.startDate && f.endDate < f.startDate) e.endDate = 'End date is before the start date'
  if (!f.startTime) e.startTime = 'Pick the start time'
  if (f.endTime && f.startTime && (!f.endDate || f.endDate === f.startDate) && f.endTime <= f.startTime) e.endTime = 'End time is before the start time'
  const cats = CATEGORY_ORDER.filter((c) => f.categories[c].enabled)
  if (!cats.length) e.categories = 'Tick at least one category'
  cats.forEach((c) => {
    const v = Number(f.categories[c].fee)
    if (!(v >= 0) || f.categories[c].fee === '') e[`fee.${c}`] = 'Enter a fee, or 0 if free'
  })
  const seats = Number(f.seats)
  if (!Number.isInteger(seats) || seats < 1) e.seats = 'Enter the number of seats'
  else if (seats < (f.bookedBefore || 0) + bookedHere) e.seats = `${(f.bookedBefore || 0) + bookedHere} seats are already booked`
  const max = Number(f.maxPerBooking)
  if (!Number.isInteger(max) || max < 1 || max > 50) e.maxPerBooking = 'Between 1 and 50'
  if (f.bulk.enabled) {
    const mq = Number(f.bulk.minQty)
    const val = Number(f.bulk.value)
    if (!Number.isInteger(mq) || mq < 2) e['bulk.minQty'] = 'At least 2 people'
    else if (mq > max) e['bulk.minQty'] = `Can't be more than the limit of ${max} per booking`
    if (!(val > 0)) e['bulk.value'] = 'Enter the discount'
    else if (f.bulk.type === 'percent' && val > 100) e['bulk.value'] = 'Can\'t be more than 100%'
    else if (f.bulk.type === 'amount') {
      const fees = cats.map((c) => Number(f.categories[c].fee)).filter((x) => x > 0)
      if (fees.length && val >= Math.min(...fees)) e['bulk.value'] = `Must be less than the lowest fee (${rupees(Math.min(...fees))})`
    }
    if (!cats.some((c) => Number(f.categories[c].fee) > 0)) e['bulk.value'] = 'This event is free, so a discount does not apply'
  }
  if (f.bookingOpens && f.startDate && f.bookingOpens > f.startDate) e.bookingOpens = 'Booking should open before the event'
  return e
}
