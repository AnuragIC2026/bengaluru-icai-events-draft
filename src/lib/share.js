// "Share on WhatsApp" for an event. No browser or server code here, so the server's share page can use it too.
import { enabledCategories, priceWithGst } from './pricing.js'
import { fmtDateRange, fmtTimeRange, rupees } from './format.js'

export const BRANCH = 'ICAI Bengaluru Branch (SIRC)'

export function fromPrice(e, gstRate) {
  const prices = enabledCategories(e).map((c) => priceWithGst(Number(e.categories[c].fee), c, gstRate))
  if (!prices.length) return null
  return Math.min(...prices)
}

// Only worth sharing while people can still book, or soon will.
export const canShare = (e) => !e.ended && (e.state === 'open' || e.state === 'soon')

// Where the shared link points.
// With the backend: its /share page, which gives WhatsApp the event's own title, details and image for the preview,
// then sends the visitor on to the event page. Without it: the event page itself.
export function eventShareUrl(e, { apiUrl = '', siteUrl = '' } = {}) {
  if (apiUrl) return `${apiUrl.replace(/\/$/, '')}/share/event/${encodeURIComponent(e.id)}`
  return `${siteUrl.replace(/#.*$/, '')}#/event/${encodeURIComponent(e.id)}`
}

// One line on the price, for the message and the preview.
export function priceLine(e, gstRate) {
  const p = fromPrice(e, gstRate)
  if (p === null) return ''
  if (p === 0) return 'Free'
  const many = enabledCategories(e).filter((c) => Number(e.categories[c].fee) > 0).length > 1
  return `${many ? 'From ' : ''}${rupees(p)} per person`
}

// The WhatsApp message: bold title, when, where, fee, link. Plain lines so it reads well on any phone.
export function shareText(e, gstRate, url) {
  const when = `${fmtDateRange(e.startDate, e.endDate)}, ${fmtTimeRange(e.startTime, e.endTime)}`
  return [
    `*${e.title}*`,
    BRANCH,
    '',
    `Date: ${when}`,
    e.venue ? `Venue: ${e.venue}` : '',
    priceLine(e, gstRate) ? `Fee: ${priceLine(e, gstRate)}` : '',
    '',
    `Register here: ${url}`,
  ]
    .filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i > 0))
    .join('\n')
}

export function whatsappUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
