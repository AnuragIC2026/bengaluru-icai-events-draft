import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CircleCheck, CircleX, Printer, CalendarPlus, ArrowLeft, RotateCcw, Clock } from 'lucide-react'
import { getBooking, getEvent, getSettings, IS_DEMO } from '../lib/data.js'
import { CATEGORY_LABELS } from '../lib/pricing.js'
import { fmtDateRange, fmtTimeRange, rupees, fmtDateTime } from '../lib/format.js'
import { isStudentEvent } from '../components/ui.jsx'
import ShareWhatsApp from '../components/ShareWhatsApp.jsx'
import { canShare } from '../lib/share.js'

function icsFor(e, b) {
  const stamp = (d, t) => `${d.replace(/-/g, '')}T${t.replace(':', '')}00`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ICAI Bengaluru Branch (SIRC)//Events//EN',
    'BEGIN:VEVENT',
    `UID:${b.id}@bangaloreicai.org`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;TZID=Asia/Kolkata:${stamp(e.startDate, e.startTime)}`,
    `DTEND;TZID=Asia/Kolkata:${stamp(e.endDate || e.startDate, e.endTime || e.startTime)}`,
    `SUMMARY:${e.title.replace(/[,;]/g, ' ')}`,
    `LOCATION:${e.venue.replace(/[,;]/g, ' ')}`,
    `DESCRIPTION:Booking ${b.id}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${b.id}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function BookingPass({ b, e }) {
  const paid = b.status === 'paid'
  const student = e && isStudentEvent(e)
  return (
    <div className={`pass ${student ? 'is-student' : ''}`}>
      <div className="pass-top">
        <div>
          <small>Booking number</small>
          <div className="pass-id">{b.id}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <small>{paid ? 'Amount paid' : 'Amount'}</small>
          <div className="pass-id">{rupees(b.price.total)}</div>
        </div>
      </div>
      <div className="pass-body">
        <h2>{b.eventTitle}</h2>
        {e && (
          <div className="meta" style={{ fontSize: 15 }}>
            <span>{fmtDateRange(e.startDate, e.endDate)}</span>
            <span>{fmtTimeRange(e.startTime, e.endTime)}</span>
            <span>{e.venue}</span>
          </div>
        )}
        <table className="people">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              {b.category !== 'nonMember' && <th>{b.category === 'member' ? 'Membership no.' : 'Registration no.'}</th>}
              <th className="hide-sm">Email</th>
            </tr>
          </thead>
          <tbody>
            {b.participants.map((p, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{p.name}</td>
                {b.category !== 'nonMember' && <td>{p.idNumber}</td>}
                <td className="hide-sm">{p.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pass-tear" aria-hidden="true" />
      <div className="pass-body">
        <div className="lines" style={{ maxWidth: 420 }}>
          <div className="row">
            <span>
              {CATEGORY_LABELS[b.category]} fee × {b.price.qty}
            </span>
            <span>{rupees(b.price.subtotal)}</span>
          </div>
          {b.price.discount > 0 && (
            <div className="row disc">
              <span>Group discount</span>
              <span>-{rupees(b.price.discount)}</span>
            </div>
          )}
          <div className="row">
            <span>GST {b.price.gstRate ? `${b.price.gstRate}%` : ''}</span>
            <span>{b.price.gstRate ? rupees(b.price.gst) : 'Not applicable'}</span>
          </div>
          <div className="row total">
            <span>Total</span>
            <span>{rupees(b.price.total)}</span>
          </div>
        </div>
        <div className="grid-2" style={{ marginTop: 20, fontSize: 14.5 }}>
          <div>
            <span className="muted">Billed to</span>
            <div>
              <b>{b.contact.firm}</b>
            </div>
            <div>
              {b.contact.address}, {b.contact.city} {b.contact.pincode}, {b.contact.state}
            </div>
            {b.contact.gstin && <div>GSTIN {b.contact.gstin}</div>}
          </div>
          <div>
            <span className="muted">Payment</span>
            <div>
              <b>{paid ? 'Paid' : b.status === 'failed' ? 'Not paid' : 'Waiting for payment'}</b>
            </div>
            {b.payment?.method && <div>{b.payment.method}</div>}
            {b.payment?.ref && <div>Reference {b.payment.ref}</div>}
            <div>Booked on {fmtDateTime(b.createdAt)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Booking() {
  const { id } = useParams()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const key = sp.get('k') || ''
  const [emailOn, setEmailOn] = useState(false)
  const [gstRate, setGstRate] = useState(null)
  useEffect(() => {
    getSettings()
      .then((s) => {
        setGstRate(s.gstRate)
        if (!IS_DEMO) setEmailOn(!!s.emailEnabled)
      })
      .catch(() => {})
  }, [])
  const [b, setB] = useState(undefined)
  const [e, setE] = useState(null)
  useEffect(() => {
    document.title = 'Your booking | ICAI Bengaluru Branch (SIRC)'
    getBooking(id, key).then((x) => {
      setB(x)
      if (x) getEvent(x.eventId).then(setE)
    })
  }, [id, key])

  if (b === undefined) return <div className="narrow">Loading...</div>
  if (!b)
    return (
      <div className="narrow">
        <div className="empty">
          <h3>Booking not found</h3>
          <p>
            Check the number, or <Link to="/find">search for your booking</Link>.
          </p>
        </div>
      </div>
    )

  const paid = b.status === 'paid'
  const failed = b.status === 'failed'
  return (
    <div className="narrow" style={{ maxWidth: 760 }}>
      <div className="crumb no-print" style={{ paddingTop: 0 }}>
        <Link to="/">
          <ArrowLeft size={17} /> All events
        </Link>
      </div>
      <div className={`notice ${paid ? 'ok' : failed ? 'err' : 'warn'} no-print`} style={{ marginBottom: 18 }} role="status">
        {paid ? <CircleCheck size={22} /> : failed ? <CircleX size={22} /> : <Clock size={22} />}
        <div>
          {paid ? (
            <>
              <b>You are registered.</b>
              {b.price.total > 0 ? 'Payment received. ' : ''}
              {IS_DEMO
                ? `On the live portal, a receipt goes to ${b.contact.email} and each participant gets a confirmation.`
                : emailOn
                  ? `A receipt has been emailed to ${b.contact.email}, and each participant gets a confirmation.`
                  : 'Keep your booking number for reference.'}
            </>
          ) : failed ? (
            <>
              <b>Payment did not go through.</b>
              {b.payment?.note || 'Nothing was charged.'} Your seats are not held, so please book again.
            </>
          ) : (
            <>
              <b>Waiting for payment.</b>
              This booking is not confirmed until payment is complete.
            </>
          )}
        </div>
      </div>
      <BookingPass b={b} e={e} />
      <div className="pass-actions">
        {paid && (
          <>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={18} /> Print receipt
            </button>
            {e && (
              <button className="btn btn-ghost" onClick={() => icsFor(e, b)}>
                <CalendarPlus size={18} /> Add to calendar
              </button>
            )}
            {e && gstRate != null && canShare(e) && <ShareWhatsApp event={e} gstRate={gstRate} label="Tell colleagues on WhatsApp" />}
          </>
        )}
        {b.status === 'pending' && (
          <button className="btn btn-primary" onClick={() => nav(`/pay/${b.id}?k=${encodeURIComponent(key)}`)}>
            Complete payment
          </button>
        )}
        {failed && e && (
          <Link className="btn btn-primary" to={`/event/${e.id}`}>
            <RotateCcw size={18} /> Book again
          </Link>
        )}
        <Link className="btn btn-ghost" to="/">
          See other events
        </Link>
      </div>
    </div>
  )
}
