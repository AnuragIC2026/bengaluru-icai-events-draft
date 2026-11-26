import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Receipt, Users, IndianRupee } from 'lucide-react'
import { listEvents, listBookings } from '../lib/data.js'
import { CATEGORY_LABELS } from '../lib/pricing.js'
import { fmtDateShort, rupees, fmtDateTime } from '../lib/format.js'
import { useAdmin } from './AdminLayout.jsx'

export const STATE_LABEL = { open: 'Open', soon: 'Opens soon', paused: 'Paused', full: 'Full', closed: 'Closed' }

export function SeatBar({ e }) {
  const pct = Math.min(100, Math.round((e.booked / Math.max(1, e.seats)) * 100))
  return (
    <>
      <span>
        {e.booked} / {e.seats}
      </span>
      <div className={`bar ${pct >= 90 ? 'red' : pct >= 75 ? 'amber' : ''}`} aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>
    </>
  )
}

export default function Dashboard() {
  const { user } = useAdmin()
  const [events, setEvents] = useState([])
  const [bookings, setBookings] = useState([])
  useEffect(() => {
    document.title = 'Dashboard | Event admin'
    listEvents().then(setEvents)
    listBookings().then(setBookings)
  }, [])

  const s = useMemo(() => {
    const paid = bookings.filter((b) => b.status === 'paid')
    return {
      open: events.filter((e) => e.state === 'open').length,
      upcoming: events.filter((e) => !e.ended),
      paid: paid.length,
      failed: bookings.filter((b) => b.status === 'failed').length,
      people: paid.reduce((n, b) => n + b.participants.length, 0),
      amount: paid.reduce((n, b) => n + b.price.total, 0),
      gst: paid.reduce((n, b) => n + b.price.gst, 0),
    }
  }, [events, bookings])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hello, {user.name}</h1>
          <p>Here is how registrations are going.</p>
        </div>
        {user.role === 'admin' && (
          <div className="actions">
            <Link className="btn btn-primary" to="/admin/events/new">
              Add an event
            </Link>
          </div>
        )}
      </div>
      <div className="stats">
        <div className="stat">
          <small>
            <CalendarDays size={15} /> Open for booking
          </small>
          <strong>{s.open}</strong>
          <span>{s.upcoming.length} upcoming in all</span>
        </div>
        <div className="stat">
          <small>
            <Receipt size={15} /> Paid bookings
          </small>
          <strong>{s.paid}</strong>
          <span className={s.failed ? 'tone-red' : ''}>
            {s.failed} failed {s.failed === 1 ? 'payment' : 'payments'}
          </span>
        </div>
        <div className="stat">
          <small>
            <Users size={15} /> Participants
          </small>
          <strong>{s.people}</strong>
          <span>in paid bookings</span>
        </div>
        <div className="stat">
          <small>
            <IndianRupee size={15} /> Collected
          </small>
          <strong>{rupees(s.amount)}</strong>
          <span>includes {rupees(s.gst)} GST</span>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 14, margin: '-8px 0 18px' }}>
        Counts above cover bookings made on this new portal. Seat counts also include the paid seats already sold on the old portal.
      </p>

      <div className="panel">
        <div className="panel-head">
          <h2>Upcoming events</h2>
          {user.role === 'admin' && <Link to="/admin/events">Manage events</Link>}
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Event</th>
                <th>Seats booked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {s.upcoming.slice(0, 8).map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">{fmtDateShort(e.startDate)}</td>
                  <td className="t-name">{user.role === 'admin' ? <Link to={`/admin/events/${e.id}`}>{e.title}</Link> : e.title}</td>
                  <td>
                    <SeatBar e={e} />
                  </td>
                  <td>
                    <span className={`pill ${e.state}`}>{STATE_LABEL[e.state]}</span>
                  </td>
                </tr>
              ))}
              {!s.upcoming.length && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No upcoming events.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Latest bookings</h2>
          <Link to="/admin/registrations">See all</Link>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Event</th>
                <th className="hide-md">Category</th>
                <th className="num">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.slice(0, 6).map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="t-name">{b.id}</div>
                    <div className="sub">{fmtDateTime(b.createdAt)}</div>
                  </td>
                  <td>{b.eventTitle}</td>
                  <td className="hide-md">
                    {CATEGORY_LABELS[b.category]} × {b.participants.length}
                  </td>
                  <td className="num">{rupees(b.price.total)}</td>
                  <td>
                    <span className={`pill ${b.status}`}>{b.status === 'paid' ? 'Paid' : b.status === 'failed' ? 'Failed' : 'Pending'}</span>
                  </td>
                </tr>
              ))}
              {!bookings.length && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No bookings yet. Book an event on the public portal and it will show up here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
