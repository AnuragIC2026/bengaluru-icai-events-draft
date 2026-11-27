import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, FileSpreadsheet, FileText, X } from 'lucide-react'
import { listBookings, listEvents } from '../lib/data.js'
import { CATEGORY_LABELS } from '../lib/pricing.js'
import { rupees, fmtDateTime } from '../lib/format.js'
import { exportBookings } from '../lib/excel.js'
import { displayStatus, STATUS_LABELS, isUnpaid, unpaidReason, codeMessage } from '../lib/bookingStatus.js'


function Drawer({ b, onClose }) {
  const key = displayStatus(b)
  const pay = b.payment || {}
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <>
      <div className="drawer-back" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Booking ${b.id}`}>
        <div className="modal-head">
          <div>
            <h2>{b.id}</h2>
            <span className={`pill ${key}`}>{STATUS_LABELS[key]}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close" autoFocus>
            <X size={20} />
          </button>
        </div>
        <dl className="kv">
          <dt>Event</dt>
          <dd>{b.eventTitle}</dd>
          <dt>Booked on</dt>
          <dd>{fmtDateTime(b.createdAt)}</dd>
          <dt>Category</dt>
          <dd>
            {CATEGORY_LABELS[b.category]} × {b.participants.length}
          </dd>
          <dt>Fee</dt>
          <dd>{rupees(b.price.subtotal)}</dd>
          {b.price.discount > 0 && (
            <>
              <dt>Group discount</dt>
              <dd>-{rupees(b.price.discount)}</dd>
            </>
          )}
          <dt>GST</dt>
          <dd>{b.price.gstRate ? `${rupees(b.price.gst)} (${b.price.gstRate}%)` : 'Not applicable'}</dd>
          <dt>Total</dt>
          <dd>
            <b>{rupees(b.price.total)}</b>
          </dd>
        </dl>
        <h3 style={{ fontSize: 17, margin: '22px 0 6px' }}>Payment</h3>
        <dl className="kv" style={{ marginTop: 6 }}>
          <dt>Status</dt>
          <dd>
            {STATUS_LABELS[key]}
            {isUnpaid(key) && <div className="tone-red">{unpaidReason(b, key)}</div>}
          </dd>
          <dt>Gateway</dt>
          <dd>{pay.method || (b.price.total ? 'Not reached' : 'Free event')}</dd>
          {pay.mode && (
            <>
              <dt>Payment mode</dt>
              <dd>{pay.mode}</dd>
            </>
          )}
          {pay.ref && (
            <>
              <dt>Bank reference</dt>
              <dd>{pay.ref}</dd>
            </>
          )}
          {pay.code && (
            <>
              <dt>Bank response</dt>
              <dd>
                {pay.code}, {codeMessage(pay.code)}
              </dd>
            </>
          )}
          {pay.amount != null && pay.amount !== '' && (
            <>
              <dt>Amount from bank</dt>
              <dd>{rupees(Number(pay.amount))}</dd>
            </>
          )}
          {pay.at && (
            <>
              <dt>Reply received</dt>
              <dd>{fmtDateTime(pay.at)}</dd>
            </>
          )}
          {pay.note && pay.note !== unpaidReason(b, key) && (
            <>
              <dt>Note</dt>
              <dd>{pay.note}</dd>
            </>
          )}
        </dl>
        <h3 style={{ fontSize: 17, margin: '22px 0 6px' }}>Billing</h3>
        <dl className="kv" style={{ marginTop: 6 }}>
          <dt>Firm</dt>
          <dd>{b.contact.firm}</dd>
          <dt>Address</dt>
          <dd>
            {b.contact.address}, {b.contact.city} {b.contact.pincode}, {b.contact.state}
          </dd>
          <dt>Contact</dt>
          <dd>
            {b.contact.phone}, {b.contact.email}
          </dd>
          {b.contact.gstin && (
            <>
              <dt>GSTIN</dt>
              <dd>{b.contact.gstin}</dd>
            </>
          )}
          {b.contact.pan && (
            <>
              <dt>PAN</dt>
              <dd>{b.contact.pan}</dd>
            </>
          )}
        </dl>
        <h3 style={{ fontSize: 17, margin: '22px 0 6px' }}>Participants</h3>
        <table className="people">
          <thead>
            <tr>
              <th>Name</th>
              {b.category !== 'nonMember' && <th>Number</th>}
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>
            {b.participants.map((p, i) => (
              <tr key={i}>
                <td>
                  {p.name}
                  <div className="sub muted" style={{ fontSize: 13 }}>
                    {p.gender}
                  </div>
                </td>
                {b.category !== 'nonMember' && <td>{p.idNumber}</td>}
                <td>
                  {p.mobile}
                  <div className="muted" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>
                    {p.email}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </aside>
    </>
  )
}

// failedOnly: the "Failed registrations" page. Same list, limited to bookings that were not paid.
export default function Registrations({ failedOnly = false }) {
  const [bookings, setBookings] = useState(null)
  const [events, setEvents] = useState([])
  const [q, setQ] = useState('')
  const [ev, setEv] = useState('')
  const [params, setParams] = useSearchParams()
  const [st, setStRaw] = useState(params.get('status') || (failedOnly ? 'unpaid' : ''))
  useEffect(() => {
    setStRaw(params.get('status') || (failedOnly ? 'unpaid' : ''))
  }, [failedOnly]) // eslint-disable-line react-hooks/exhaustive-deps
  const setSt = (v) => {
    setStRaw(v)
    setParams(v ? { status: v } : {}, { replace: true })
  }
  const [cat, setCat] = useState('')
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = `${failedOnly ? 'Failed registrations' : 'Registrations'} | Event admin`
    listBookings().then(setBookings)
    listEvents().then(setEvents)
  }, [failedOnly])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (bookings || []).filter((b) => {
      if (ev && String(b.eventId) !== ev) return false
      const key = displayStatus(b)
      if (st === 'unpaid' ? !isUnpaid(key) : st && key !== st) return false
      if (cat && b.category !== cat) return false
      if (!term) return true
      const hay = [b.id, b.contact.firm, b.contact.email, b.contact.phone, b.contact.gstin, b.contact.pan, ...b.participants.flatMap((p) => [p.name, p.email, p.mobile, p.idNumber])].join(' ').toLowerCase()
      return hay.includes(term)
    })
  }, [bookings, q, ev, st, cat])

  const totals = useMemo(() => {
    const paid = rows.filter((b) => b.status === 'paid')
    const unpaid = rows.filter((b) => isUnpaid(displayStatus(b))).length
    return { n: paid.length, unpaid, people: paid.reduce((s, b) => s + b.participants.length, 0), amt: paid.reduce((s, b) => s + b.price.total, 0) }
  }, [rows])

  const STATUS_FILTER = { paid: 'Paid', unpaid: 'Failed or not completed', failed: 'Failed', notCompleted: 'Not completed', pending: 'In progress' }
  const doExport = async (kind) => {
    setBusy(kind)
    const evName = ev ? events.find((e) => String(e.id) === ev)?.title : ''
    try {
      if (kind === 'pdf') {
        const { exportBookingsPdf } = await import('../lib/pdf.js')
        await exportBookingsPdf(rows, { title: failedOnly ? 'Failed registrations' : 'Registrations', eventName: evName, statusLabel: STATUS_FILTER[st] || '', failedOnly })
      } else await exportBookings(rows, evName, failedOnly ? 'failed-registrations' : 'registrations')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{failedOnly ? 'Failed registrations' : 'Registrations'}</h1>
          <p>
            {['unpaid', 'failed', 'notCompleted'].includes(st)
              ? `${rows.length} ${rows.length === 1 ? 'booking' : 'bookings'} not paid in this view. Each one keeps the full form details and the bank's reply.`
              : `${totals.n} paid ${totals.n === 1 ? 'booking' : 'bookings'}, ${totals.people} participants, ${rupees(totals.amt)} collected in this view.`}
            {!failedOnly && totals.unpaid > 0 && st !== 'unpaid' && (
              <>
                {' '}
                <Link className="tone-red" to="/admin/failed">
                  {totals.unpaid} failed or not completed
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-soft" onClick={() => doExport('pdf')} disabled={!rows.length || !!busy}>
            <FileText size={18} /> {busy === 'pdf' ? 'Preparing...' : 'Download PDF'}
          </button>
          <button className="btn btn-primary" onClick={() => doExport('xlsx')} disabled={!rows.length || !!busy}>
            <FileSpreadsheet size={18} /> {busy === 'xlsx' ? 'Preparing...' : 'Download Excel'}
          </button>
        </div>
      </div>
      <div className="panel">
        <div className="filters">
          <label className="search">
            <Search size={18} color="#56627A" />
            <span className="sr-only">Search registrations</span>
            <input type="search" placeholder="Booking no., name, email, mobile, GSTIN, PAN" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label>
            <span className="sr-only">Event</span>
            <select value={ev} onChange={(e) => setEv(e.target.value)}>
              <option value="">All events</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.startDate.slice(8)}/{e.startDate.slice(5, 7)} {e.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Payment status</span>
            <select value={st} onChange={(e) => setSt(e.target.value)}>
              {!failedOnly && <option value="">Any status</option>}
              {!failedOnly && <option value="paid">Paid</option>}
              <option value="unpaid">Failed or not completed</option>
              <option value="failed">Failed</option>
              <option value="notCompleted">Not completed</option>
              {!failedOnly && <option value="pending">In progress</option>}
            </select>
          </label>
          <label>
            <span className="sr-only">Category</span>
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Any category</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="tbl-wrap">
          <table className="tbl stack">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Event</th>
                <th className="hide-md">Billed to</th>
                <th className="hide-md">Category</th>
                <th className="num">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!bookings && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    Loading...
                  </td>
                </tr>
              )}
              {bookings && !rows.length && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    {failedOnly ? 'No failed or unfinished registrations here.' : bookings.length ? 'No bookings match these filters.' : 'No bookings yet. Book an event on the public portal and it will show up here.'}
                  </td>
                </tr>
              )}
              {rows.map((b) => (
                <tr key={b.id}>
                  <td className="c-a">
                    <button className="row-link" onClick={() => setOpen(b)}>
                      {b.id}
                    </button>
                    <div className="sub">{fmtDateTime(b.createdAt)}</div>
                  </td>
                  <td className="c-main">{b.eventTitle}</td>
                  <td className="hide-md">
                    {b.contact.firm}
                    <div className="sub">{b.contact.email}</div>
                  </td>
                  <td className="hide-md">
                    {CATEGORY_LABELS[b.category]} × {b.participants.length}
                  </td>
                  <td className="num c-c">
                    {rupees(b.price.total)}
                    {b.price.discount > 0 && <div className="sub">-{rupees(b.price.discount)} discount</div>}
                  </td>
                  <td className="c-b">
                    <span className={`pill ${displayStatus(b)}`}>{STATUS_LABELS[displayStatus(b)]}</span>
                    {isUnpaid(displayStatus(b)) && <div className="sub reason">{unpaidReason(b)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && <Drawer b={open} onClose={() => setOpen(null)} />}
    </>
  )
}
