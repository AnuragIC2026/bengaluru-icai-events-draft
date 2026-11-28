// PDF exports for the admin: the registrations list (all, or failed and not completed) and the interest list.
// Loaded only when someone clicks "Download PDF", so the PDF library and fonts stay out of the main page.
import { CATEGORY_LABELS } from './pricing.js'
import { fmtDateTime, rupees } from './format.js'
import { displayStatus, STATUS_LABELS, isUnpaid, unpaidReason } from './bookingStatus.js'
import logoUrl from '../assets/icai-emblem.png'
import font400 from '../assets/fonts/pdf/manrope-400.ttf?url'
import font700 from '../assets/fonts/pdf/manrope-700.ttf?url'
import font800 from '../assets/fonts/pdf/manrope-800.ttf?url'

const BLUE = [44, 58, 146]
const ORANGE = [179, 99, 13]
const INK = [23, 28, 59]
const MUTED = [86, 98, 122]
const RED = [180, 35, 24]
const GREEN = [30, 138, 76]
const BRANCH = 'ICAI Bengaluru Branch (SIRC)'

const safeName = (s) => (s || 'all-events').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40)

async function asBase64(url) {
  const buf = await (await fetch(url)).arrayBuffer()
  let s = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

async function newDoc() {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const fonts = await Promise.all([font400, font700, font800].map(asBase64))
  ;[['manrope-400.ttf', 'normal'], ['manrope-700.ttf', 'bold'], ['manrope-800.ttf', 'heavy']].forEach(([file, style], i) => {
    doc.addFileToVFS(file, fonts[i])
    doc.addFont(file, 'Manrope', style)
  })
  doc.setFont('Manrope', 'normal')
  const logo = await asBase64(logoUrl)
  return { doc, autoTable, logo }
}

// Branch name on top, highlighted, then the report title and what the list covers.
function header(doc, logo, title, lines) {
  const W = doc.internal.pageSize.getWidth()
  doc.addImage('data:image/png;base64,' + logo, 'PNG', 25, 9.5, 19, 18.5)
  doc.setDrawColor(...ORANGE)
  doc.setLineWidth(0.4)
  doc.line(50, 10.5, 50, 28)
  doc.setFont('Manrope', 'heavy')
  doc.setFontSize(17)
  doc.setTextColor(...ORANGE)
  doc.text(BRANCH, 54, 16)
  // the full ICAI name, large, as in the branch logo
  doc.setFont('Manrope', 'heavy')
  doc.setFontSize(12.5)
  doc.setTextColor(...BLUE)
  doc.text('The Institute of Chartered Accountants of India', 54, 22)
  doc.setFont('Manrope', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...INK)
  doc.text(title, 54, 27.5)
  doc.setFont('Manrope', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(`Downloaded ${fmtDateTime(new Date().toISOString())}`, W - 14, 17, { align: 'right' })
  let y = 35
  doc.setFontSize(9.5)
  for (const l of lines.filter(Boolean)) {
    doc.setTextColor(...INK)
    doc.text(l, 14, y)
    y += 5
  }
  return y + 1
}

function footer(doc) {
  const n = doc.getNumberOfPages()
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFont('Manrope', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`${BRANCH}, event registration portal`, 14, H - 8)
    doc.text(`Page ${i} of ${n}`, W - 14, H - 8, { align: 'right' })
  }
}

const tableStyle = {
  theme: 'grid',
  styles: { font: 'Manrope', fontSize: 8, cellPadding: 1.8, textColor: INK, lineColor: [222, 226, 238], lineWidth: 0.2, valign: 'top' },
  headStyles: { font: 'Manrope', fontStyle: 'bold', fillColor: BLUE, textColor: 255, fontSize: 8.5 },
  alternateRowStyles: { fillColor: [247, 248, 252] },
  margin: { left: 14, right: 14, bottom: 14 },
}

export async function exportBookingsPdf(bookings, { title = 'Registrations', eventName = '', statusLabel = '', failedOnly = false } = {}) {
  const { doc, autoTable, logo } = await newDoc()
  const paid = bookings.filter((b) => b.status === 'paid')
  const unpaid = bookings.filter((b) => isUnpaid(displayStatus(b))).length
  const people = paid.reduce((n, b) => n + b.participants.length, 0)
  const amount = paid.reduce((n, b) => n + b.price.total, 0)
  const startY = header(doc, logo, title, [
    `Event: ${eventName || 'All events'}${statusLabel ? `    Status: ${statusLabel}` : ''}`,
    failedOnly
      ? `${bookings.length} ${bookings.length === 1 ? 'booking was' : 'bookings were'} not paid. Each keeps the full form details and the bank's reply.`
      : `${bookings.length} ${bookings.length === 1 ? 'booking' : 'bookings'}: ${paid.length} paid (${people} ${people === 1 ? 'participant' : 'participants'}, ${rupees(amount)} collected), ${unpaid} failed or not completed`,
  ])
  const statusColour = {}
  const body = bookings.map((b, i) => {
    const key = displayStatus(b)
    statusColour[i] = key === 'paid' ? GREEN : isUnpaid(key) ? RED : MUTED
    const c = b.contact
    const status = [STATUS_LABELS[key], unpaidReason(b, key), b.payment?.ref ? `Bank ref ${b.payment.ref}` : '', b.payment?.mode ? `Mode ${b.payment.mode}` : ''].filter(Boolean).join('\n')
    return [
      `${b.id}\n${fmtDateTime(b.createdAt)}`,
      b.eventTitle,
      `${CATEGORY_LABELS[b.category]} x ${b.participants.length}`,
      b.participants.map((p) => `${p.name}${p.idNumber ? ` (${p.idNumber})` : ''}\n${p.mobile}, ${p.email}`).join('\n'),
      [c.firm, `${c.phone}, ${c.email}`, `${c.city}, ${c.state}`, c.gstin ? `GSTIN ${c.gstin}` : '', c.pan ? `PAN ${c.pan}` : ''].filter(Boolean).join('\n'),
      `${rupees(b.price.total)}${b.price.discount > 0 ? `\n-${rupees(b.price.discount)} discount` : ''}${b.price.gst ? `\nGST ${rupees(b.price.gst)}` : ''}`,
      status,
    ]
  })
  autoTable(doc, {
    ...tableStyle,
    startY,
    head: [['Booking', 'Event', 'Category', 'Participants', 'Billed to', 'Amount', 'Status']],
    body: body.length ? body : [['No bookings in this view.', '', '', '', '', '', '']],
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 42 }, 2: { cellWidth: 24 }, 3: { cellWidth: 62 }, 4: { cellWidth: 52 }, 5: { cellWidth: 25, halign: 'right' }, 6: { cellWidth: 34 } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 6 && statusColour[d.row.index]) d.cell.styles.textColor = statusColour[d.row.index]
      if (d.section === 'body' && d.column.index === 0) d.cell.styles.fontStyle = 'bold'
    },
  })
  footer(doc)
  doc.save(`${safeName(title)}-${safeName(eventName)}.pdf`)
}

export async function exportInterestPdf(rows) {
  const { doc, autoTable, logo } = await newDoc()
  const startY = header(doc, logo, 'Interest list', [`${rows.length} ${rows.length === 1 ? 'person' : 'people'} asked to hear about events that were closed or full.`])
  autoTable(doc, {
    ...tableStyle,
    startY,
    head: [['Event', 'Name', 'Email', 'Mobile', 'Added on']],
    body: rows.length ? rows.map((r) => [r.eventTitle, r.name, r.email, r.mobile, fmtDateTime(r.createdAt)]) : [['No one yet.', '', '', '', '']],
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 50 }, 2: { cellWidth: 65 }, 3: { cellWidth: 30 }, 4: { cellWidth: 34 } },
  })
  footer(doc)
  doc.save('interest-list.pdf')
}
