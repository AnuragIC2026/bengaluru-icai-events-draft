import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Clock, MapPin, Percent, ChevronDown, ChevronUp } from 'lucide-react'
import { listEvents, getSettings } from '../lib/data.js'
import { enabledCategories, priceWithGst, describeDiscount } from '../lib/pricing.js'
import { dayNum, monShort, dowShort, monthKey, fmtTimeRange, fmtDateShort, rupees } from '../lib/format.js'
import { AudienceChips, isStudentEvent } from '../components/ui.jsx'
import Skyline from '../components/Skyline.jsx'
import { seatsIndicator, closingIndicator, stateIndicator, Ind } from '../lib/availability.jsx'

function fromPrice(e, gstRate) {
  const prices = enabledCategories(e).map((c) => priceWithGst(Number(e.categories[c].fee), c, gstRate))
  if (!prices.length) return null
  return Math.min(...prices)
}

function topic(e) {
  const first = (e.description || '').split('\n')[0]
  return first.replace(/^Topic:\s*/i, '')
}

export function EventTicket({ e, gstRate }) {
  const student = isStudentEvent(e)
  const closed = e.state === 'closed'
  const open = e.state === 'open'
  const p = fromPrice(e, gstRate)
  const cats = enabledCategories(e)
  const many = cats.filter((c) => Number(e.categories[c].fee) > 0).length > 1
  const multiDay = e.endDate && e.endDate !== e.startDate
  const t = topic(e)
  const stateInd = stateIndicator(e)
  const closing = closingIndicator(e)
  const seats = open ? seatsIndicator(e) : null
  return (
    <article className={`ticket ${student ? 'is-student' : ''} ${closed ? 'is-closed' : ''} ${e.imageUrl ? 'has-thumb' : ''}`}>
      <div className="stub" aria-hidden="true">
        <span className="d">{dayNum(e.startDate)}</span>
        <span className="m">{monShort(e.startDate)}</span>
        <span className="w">{dowShort(e.startDate)}</span>
        {multiDay && <span className="range">to {fmtDateShort(e.endDate)}</span>}
      </div>
      <div className="t-body">
        {e.imageUrl && (
          <div className="t-thumb">
            <img src={e.imageUrl} alt="" loading="lazy" />
          </div>
        )}
        <div className="t-text">
          <div className="chips">
            <AudienceChips event={e} />
            {e.bulk?.enabled && !closed && (
              <span className="chip chip-green">
                <Percent size={12} /> {describeDiscount(e.bulk, true)}
              </span>
            )}
            {stateInd && <Ind {...stateInd} />}
            {closing && <Ind {...closing} />}
            {seats && seats.tone !== 'green' && <Ind {...seats} />}
          </div>
          <h3 className="t-title">
            <Link to={`/event/${e.id}`}>
              <span className="sr-only">
                {dayNum(e.startDate)} {monShort(e.startDate)},{' '}
              </span>
              {e.title}
            </Link>
          </h3>
          {t && t !== e.title && <p className="t-topic">{t}</p>}
          <div className="meta">
            <span>
              <Clock size={14} /> {fmtTimeRange(e.startTime, e.endTime)}
            </span>
            <span>
              <MapPin size={14} /> {e.venue}
            </span>
            {seats && seats.tone === 'green' && <span className="tone-green">{seats.label}</span>}
          </div>
        </div>
      </div>
      <div className="t-side">
        <div className="price">
          {p === null ? null : p === 0 ? (
            <strong className="free">Free</strong>
          ) : (
            <>
              <strong>
                {many && <small style={{ fontSize: 13, fontWeight: 600 }}>from </small>}
                {rupees(p)}
              </strong>
              <small>{cats.every((c) => c === 'student') ? 'per person' : 'per person, with GST'}</small>
            </>
          )}
        </div>
        <Link to={`/event/${e.id}`} className={`btn btn-sm ${open ? 'btn-primary' : 'btn-ghost'}`} aria-label={`${open ? 'Register for' : 'View'} ${e.title}`}>
          {open ? 'Register' : 'View details'}
        </Link>
      </div>
    </article>
  )
}

const FILTERS = [
  { key: 'members', label: 'Members' },
  { key: 'students', label: 'Students' },
  { key: 'all', label: 'All events' },
]

export default function EventList() {
  const [events, setEvents] = useState(null)
  const [gstRate, setGstRate] = useState(18)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [showClosed, setShowClosed] = useState(false)

  useEffect(() => {
    document.title = 'Event registration | Bengaluru ICAI'
    listEvents().then(setEvents)
    getSettings().then((s) => setGstRate(s.gstRate))
  }, [])

  const { upcoming, closed } = useMemo(() => {
    if (!events) return { upcoming: [], closed: [] }
    const term = q.trim().toLowerCase()
    const match = (e) => {
      const cats = enabledCategories(e)
      if (filter === 'members' && !cats.some((c) => c !== 'student')) return false
      if (filter === 'students' && !cats.includes('student')) return false
      if (!term) return true
      return [e.title, e.description, e.venue].join(' ').toLowerCase().includes(term)
    }
    const list = events.filter(match)
    return {
      upcoming: list.filter((e) => e.state !== 'closed'),
      closed: list.filter((e) => e.state === 'closed').reverse(),
    }
  }, [events, q, filter])

  const groups = useMemo(() => {
    const m = new Map()
    for (const e of upcoming) {
      const k = monthKey(e.startDate)
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(e)
    }
    return [...m.entries()]
  }, [upcoming])

  const openCount = events ? events.filter((e) => e.state === 'open').length : 0

  return (
    <>
      <section className="hero">
        <div className="wrap hero-text">
          <p className="hero-kicker">ICAI Bengaluru Branch (SIRC)</p>
          <h1>Register for branch events</h1>
          <p className="hero-sub">Seminars, study circles and SICASA events. Book for yourself or your whole team in one go.</p>
        </div>
        <Skyline variant="retro" />
      </section>

      <div className="wrap">
        <div className="toolbar" role="search">
          <label className="search">
            <Search size={19} color="#56627A" />
            <span className="sr-only">Search events</span>
            <input type="search" placeholder="Search by event, topic or venue" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="seg" role="group" aria-label="Show events for">
            {FILTERS.map((f) => (
              <button key={f.key} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <section className="list-section" aria-live="polite">
          {!events ? (
            <p className="muted">Loading events...</p>
          ) : (
            <>
              <p className="open-count">
                <span className="ind ind-green">
                  {openCount} {openCount === 1 ? 'event' : 'events'} open for registration
                </span>
              </p>
              {groups.length === 0 && (
                <div className="empty" style={{ marginTop: 20 }}>
                  <h3>No upcoming events match</h3>
                  <p>Try another search, or switch to All events.</p>
                </div>
              )}
              {groups.map(([month, list]) => (
                <div key={month}>
                  <div className="month-head">
                    <h2>{month}</h2>
                    <span className="rule" aria-hidden="true" />
                    <span className="count">
                      {list.length} {list.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>
                  <div className="events">
                    {list.map((e) => (
                      <EventTicket key={e.id} e={e} gstRate={gstRate} />
                    ))}
                  </div>
                </div>
              ))}

              {closed.length > 0 && (
                <>
                  <div className="closed-toggle">
                    <h2>Recently closed</h2>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowClosed((s) => !s)} aria-expanded={showClosed}>
                      {showClosed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      {showClosed ? 'Hide' : `Show ${closed.length}`}
                    </button>
                  </div>
                  {showClosed && (
                    <div className="events">
                      {closed.map((e) => (
                        <EventTicket key={e.id} e={e} gstRate={gstRate} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </>
  )
}
