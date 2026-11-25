import { CATEGORY_LABELS } from './pricing.js'
import { fmtDateTime } from './format.js'

const STATUS = { paid: 'Paid', pending: 'Pending', failed: 'Failed' }
const head = (labels) => labels.map((value) => ({ value, fontWeight: 'bold' }))
const safeName = (s) => (s || 'all-events').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40)

// Two sheets: one row per booking, and one row per participant.
export async function exportBookings(bookings, eventName) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const b1 = [
    head(['Booking no.', 'Booked on', 'Event', 'Category', 'Participants', 'Fee', 'Discount', 'Taxable', 'GST', 'Total', 'Status', 'Payment ref', 'Firm', 'Address', 'City', 'Pincode', 'State', 'Contact number', 'Email', 'GSTIN']),
    ...bookings.map((b) => [
      b.id,
      fmtDateTime(b.createdAt),
      b.eventTitle,
      CATEGORY_LABELS[b.category],
      b.participants.length,
      b.price.subtotal,
      b.price.discount,
      b.price.taxable,
      b.price.gst,
      b.price.total,
      STATUS[b.status],
      b.payment?.ref || '',
      b.contact.firm,
      b.contact.address,
      b.contact.city,
      b.contact.pincode,
      b.contact.state,
      b.contact.phone,
      b.contact.email,
      b.contact.gstin || '',
    ]),
  ]
  const b2 = [
    head(['Booking no.', 'Event', 'Status', 'Category', 'Membership or registration no.', 'Name', 'Gender', 'Email', 'Mobile', 'Firm']),
    ...bookings.flatMap((b) =>
      b.participants.map((p) => [b.id, b.eventTitle, STATUS[b.status], CATEGORY_LABELS[b.category], p.idNumber || '', p.name, p.gender, p.email, p.mobile, b.contact.firm]),
    ),
  ]
  const widths = (n, w) => Array.from({ length: n }, (_, i) => ({ width: w[i] || 16 }))
  await writeExcelFile([
    { data: b1, sheet: 'Bookings', columns: widths(20, [16, 20, 36, 12, 12]), stickyRowsCount: 1 },
    { data: b2, sheet: 'Participants', columns: widths(10, [16, 36, 10, 12, 22, 26, 10, 30, 14, 30]), stickyRowsCount: 1 },
  ]).toFile(`registrations-${safeName(eventName)}.xlsx`)
}

export async function exportInterest(rows) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const data = [head(['Event', 'Name', 'Email', 'Mobile', 'Added on']), ...rows.map((r) => [r.eventTitle, r.name, r.email, r.mobile, fmtDateTime(r.createdAt)])]
  await writeExcelFile(data, { columns: [{ width: 40 }, { width: 26 }, { width: 30 }, { width: 14 }, { width: 22 }], stickyRowsCount: 1 }).toFile('interest-list.xlsx')
}
