import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Plus, Pencil, Copy, Eye, Percent } from 'lucide-react'
import { listEvents, saveEvent } from '../lib/data.js'
import { CATEGORY_PLURAL, enabledCategories, describeDiscount } from '../lib/pricing.js'
import { fmtDateRange, rupees } from '../lib/format.js'
import { RequireRole } from './AdminLayout.jsx'
import { SeatBar, STATE_LABEL } from './Dashboard.jsx'
import { useToast } from '../components/ui.jsx'

function feeText(e) {
  return enabledCategories(e)
    .map((c) => `${CATEGORY_PLURAL[c]} ${Number(e.categories[c].fee) ? rupees(e.categories[c].fee) : 'free'}`)
    .join(', ')
}

function EventsInner() {
  const nav = useNavigate()
  const toast = useToast()
  const [events, setEvents] = useState(null)
  const [tab, setTab] = useState('upcoming')
  const [q, setQ] = useState('')
  const load = () => listEvents().then(setEvents)
  useEffect(() => {
    document.title = 'Events | Event admin'
    load()
  }, [])

  const lists = useMemo(() => {
    const all = events || []
    const term = q.trim().toLowerCase()
    const m = (e) => !term || [e.title, e.venue, e.code, String(e.id)].join(' ').toLowerCase().includes(term)
    return {
      upcoming: all.filter((e) => !e.ended && m(e)),
      past: all.filter((e) => e.ended && m(e)).reverse(),
      all: all.filter(m),
    }
  }, [events, q])

  const duplicate = async (e) => {
    const copy = { ...e, id: undefined, code: undefined, title: `${e.title} (copy)`, status: 'paused', imageChange: e.imageUrl || undefined, imageCopyFrom: e.imageUrl ? e.id : undefined }
    const saved = await saveEvent(copy)
    toast('Copy made. It stays paused until you open it.')
    nav(`/admin/events/${saved.id}`)
  }

  const rows = lists[tab]
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Events</h1>
          <p>Add events, change fees and seats, and set group discounts.</p>
        </div>
        <div className="actions">
          <Link className="btn btn-primary" to="/admin/events/new">
            <Plus size={18} /> Add an event
          </Link>
        </div>
      </div>
      <div className="panel">
        <div className="tabs" role="tablist">
          {[
            ['upcoming', 'Upcoming'],
            ['past', 'Past'],
            ['all', 'All'],
          ].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {l}
              <span className="count">{lists[k].length}</span>
            </button>
          ))}
        </div>
        <div className="filters">
          <label className="search">
            <Search size={18} color="#56627A" />
            <span className="sr-only">Search events</span>
            <input type="search" placeholder="Search by name, venue or event number" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        <div className="tbl-wrap">
          <table className="tbl stack">
            <thead>
              <tr>
                <th>Date</th>
                <th>Event</th>
                <th className="hide-lg">Fees (before GST)</th>
                <th>Seats</th>
                <th>Status</th>
                <th className="num">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!events && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    Loading...
                  </td>
                </tr>
              )}
              {events && !rows.length && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No events here.
                  </td>
                </tr>
              )}
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap c-a">{fmtDateRange(e.startDate, e.endDate).replace(/^\w+, /, '')}</td>
                  <td className="c-main">
                    <div className="t-name with-thumb">
                      {e.imageUrl ? <img className="tbl-thumb" src={e.imageUrl} alt="" /> : <span className="tbl-thumb empty" title="No image yet" />}
                      <Link to={`/admin/events/${e.id}`}>{e.title}</Link>
                    </div>
                    <div className="sub">
                      No. {e.code}, max {e.maxPerBooking} per booking
                      {e.bulk?.enabled && (
                        <>
                          {' '}
                          <span className="chip chip-saffron" style={{ fontSize: 12, padding: '0 8px' }}>
                            <Percent size={11} /> {describeDiscount(e.bulk)}
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="hide-lg">{feeText(e)}</td>
                  <td className="c-c">
                    <SeatBar e={e} />
                  </td>
                  <td className="c-b">
                    <span className={`pill ${e.state}`}>{STATE_LABEL[e.state]}</span>
                  </td>
                  <td className="c-d">
                    <div className="row-actions">
                      <Link className="btn btn-ghost btn-sm" to={`/admin/events/${e.id}`} aria-label={`Edit ${e.title}`}>
                        <Pencil size={15} />
                        <span className="hide-md">Edit</span>
                      </Link>
                      <button className="btn btn-ghost btn-sm" onClick={() => duplicate(e)} aria-label={`Make a copy of ${e.title}`} title="Make a copy">
                        <Copy size={15} />
                      </button>
                      <a className="btn btn-ghost btn-sm" href={`#/event/${e.id}`} target="_blank" rel="noreferrer" aria-label={`View ${e.title} on the portal`} title="View on the portal">
                        <Eye size={15} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default function AdminEvents() {
  return (
    <RequireRole role="admin">
      <EventsInner />
    </RequireRole>
  )
}
