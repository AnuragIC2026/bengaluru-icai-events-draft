import { CATEGORY_LABELS } from './pricing.js'
import { fmtDateTime } from './format.js'
import { displayStatus, STATUS_LABELS, unpaidReason, codeMessage } from './bookingStatus.js'

const statusOf = (b) => STATUS_LABELS[displayStatus(b)]
const head = (labels) => labels.map((value) => ({ value, fontWeight: 'bold' }))
const safeName = (s) => (s || 'all-events').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40)

// Two sheets: one row per booking, and one row per participant.
export async function exportBookings(bookings, eventName, prefix = 'registrations') {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const b1 = [
    head(['Booking no.', 'Booked on', 'Event', 'Category', 'Participants', 'Fee', 'Discount', 'Taxable', 'GST', 'Total', 'Status', 'Reason not paid', 'Gateway', 'Payment mode', 'Bank reference', 'Bank response', 'Amount from bank', 'Reply received', 'Firm', 'Address', 'City', 'Pincode', 'State', 'Contact number', 'Email', 'GSTIN', 'PAN']),
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
      statusOf(b),
      unpaidReason(b),
      b.payment?.method || '',
      b.payment?.mode || '',
      b.payment?.ref || '',
      b.payment?.code ? `${b.payment.code} ${codeMessage(b.payment.code)}` : '',
      b.payment?.amount != null && b.payment?.amount !== '' ? Number(b.payment.amount) : '',
      b.payment?.at ? fmtDateTime(b.payment.at) : '',
      b.contact.firm,
      b.contact.address,
      b.contact.city,
      b.contact.pincode,
      b.contact.state,
      b.contact.phone,
      b.contact.email,
      b.contact.gstin || '',
      b.contact.pan || '',
    ]),
  ]
  const b2 = [
    head(['Booking no.', 'Event', 'Status', 'Category', 'Membership or registration no.', 'Name', 'Gender', 'Email', 'Mobile', 'Firm']),
    ...bookings.flatMap((b) =>
      b.participants.map((p) => [b.id, b.eventTitle, statusOf(b), CATEGORY_LABELS[b.category], p.idNumber || '', p.name, p.gender, p.email, p.mobile, b.contact.firm]),
    ),
  ]
  const widths = (n, w) => Array.from({ length: n }, (_, i) => ({ width: w[i] || 16 }))
  await writeExcelFile([
    { data: b1, sheet: 'Bookings', columns: widths(28, [16, 20, 36, 12, 12, 12, 12, 12, 12, 14, 30, 16, 14, 18, 26, 14, 20]), stickyRowsCount: 1 },
    { data: b2, sheet: 'Participants', columns: widths(10, [16, 36, 10, 12, 22, 26, 10, 30, 14, 30]), stickyRowsCount: 1 },
  ]).toFile(`${prefix}-${safeName(eventName)}.xlsx`)
}

export async function exportInterest(rows) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const data = [head(['Event', 'Name', 'Email', 'Mobile', 'Added on']), ...rows.map((r) => [r.eventTitle, r.name, r.email, r.mobile, fmtDateTime(r.createdAt)])]
  await writeExcelFile(data, { columns: [{ width: 40 }, { width: 26 }, { width: 30 }, { width: 14 }, { width: 22 }], stickyRowsCount: 1 }).toFile('interest-list.xlsx')
}
