import { useEffect, useMemo, useState } from 'react'
import { Search, FileSpreadsheet, X } from 'lucide-react'
import { listBookings, listEvents } from '../lib/data.js'
import { CATEGORY_LABELS } from '../lib/pricing.js'
import { rupees, fmtDateTime } from '../lib/format.js'
import { exportBookings } from '../lib/excel.js'

const STATUS = { paid: 'Paid', pending: 'Pending', failed: 'Failed' }

function Drawer({ b, onClose }) {
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
            <span className={`pill ${b.status}`}>{STATUS[b.status]}</span>
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
          <dt>Payment</dt>
          <dd>
            {b.payment ? `${b.payment.method}${b.payment.ref ? `, ref ${b.payment.ref}` : ''}` : 'Not started'}
            {b.payment?.note && <div className="muted">{b.payment.note}</div>}
          </dd>
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

export default function Registrations() {
  const [bookings, setBookings] = useState(null)
  const [events, setEvents] = useState([])
  const [q, setQ] = useState('')
  const [ev, setEv] = useState('')
  const [st, setSt] = useState('')
  const [cat, setCat] = useState('')
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Registrations | Event admin'
    listBookings().then(setBookings)
    listEvents().then(setEvents)
  }, [])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (bookings || []).filter((b) => {
      if (ev && String(b.eventId) !== ev) return false
      if (st && b.status !== st) return false
      if (cat && b.category !== cat) return false
      if (!term) return true
      const hay = [b.id, b.contact.firm, b.contact.email, b.contact.phone, b.contact.gstin, ...b.participants.flatMap((p) => [p.name, p.email, p.mobile, p.idNumber])].join(' ').toLowerCase()
      return hay.includes(term)
    })
  }, [bookings, q, ev, st, cat])

  const totals = useMemo(() => {
    const paid = rows.filter((b) => b.status === 'paid')
    return { n: paid.length, people: paid.reduce((s, b) => s + b.participants.length, 0), amt: paid.reduce((s, b) => s + b.price.total, 0) }
  }, [rows])

  const doExport = async () => {
    setBusy(true)
    const evName = ev ? events.find((e) => String(e.id) === ev)?.title : ''
    await exportBookings(rows, evName)
    setBusy(false)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Registrations</h1>
          <p>
            {totals.n} paid {totals.n === 1 ? 'booking' : 'bookings'}, {totals.people} participants, {rupees(totals.amt)} collected in this view.
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={doExport} disabled={!rows.length || busy}>
            <FileSpreadsheet size={18} /> {busy ? 'Preparing...' : 'Download Excel'}
          </button>
        </div>
      </div>
      <div className="panel">
        <div className="filters">
          <label className="search">
            <Search size={18} color="#56627A" />
            <span className="sr-only">Search registrations</span>
            <input type="search" placeholder="Booking no., name, email, mobile, GSTIN" value={q} onChange={(e) => setQ(e.target.value)} />
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
              <option value="">Any status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
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
                    {bookings.length ? 'No bookings match these filters.' : 'No bookings yet. Book an event on the public portal and it will show up here.'}
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
                    <span className={`pill ${b.status}`}>{STATUS[b.status]}</span>
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
