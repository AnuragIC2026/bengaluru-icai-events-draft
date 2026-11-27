import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Lock, Landmark } from 'lucide-react'
import { getBooking, completePayment } from '../lib/data.js'
import { rupees } from '../lib/format.js'
import { CATEGORY_LABELS } from '../lib/pricing.js'

// Stand-in for the hand-off to ICICI Bank Eazypay. In the live build the server
// signs the request, the browser goes to Eazypay, and Eazypay calls the server back.
export default function Pay() {
  const { id } = useParams()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const key = sp.get('k') || ''
  const [b, setB] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [msg, alertMsg] = useState('')

  useEffect(() => {
    document.title = 'Payment | ICAI Bengaluru Branch (SIRC)'
    getBooking(id, key).then((x) => {
      if (x && x.status !== 'pending') nav(`/booking/${x.id}?k=${encodeURIComponent(key)}`, { replace: true })
      setB(x)
    })
  }, [id, key, nav])

  if (b === undefined) return <div className="narrow">Loading...</div>
  if (!b)
    return (
      <div className="narrow">
        <div className="empty">
          <h3>Booking not found</h3>
          <p>
            <Link to="/">Back to events</Link>
          </p>
        </div>
      </div>
    )

  const finish = async (ok) => {
    setBusy(true)
    try {
      const done = await completePayment(b.id, ok, key)
      nav(`/booking/${done.id}?k=${encodeURIComponent(key)}`, { replace: true })
    } catch (x) {
      setBusy(false)
      alertMsg(x.message)
    }
  }

  return (
    <div className="narrow">
      <div className="card pay-card">
        <div className="round-ico">
          <Landmark size={30} />
        </div>
        <h1>Payment</h1>
        <p className="muted">On the live portal, this step opens ICICI Bank Eazypay to pay by UPI, card or net banking.</p>
        <p className="pay-amount">{rupees(b.price.total)}</p>
        <p className="muted" style={{ fontSize: 14 }}>
          including {b.price.gstRate ? `GST of ${rupees(b.price.gst)}` : 'no GST'}
        </p>
        <div className="pay-rows">
          <div>
            <span>Booking number</span>
            <b>{b.id}</b>
          </div>
          <div>
            <span>Event</span>
            <b style={{ textAlign: 'right' }}>{b.eventTitle}</b>
          </div>
          <div>
            <span>Participants</span>
            <b>
              {b.participants.length} {CATEGORY_LABELS[b.category].toLowerCase()}
              {b.participants.length > 1 ? 's' : ''}
            </b>
          </div>
          <div>
            <span>Billed to</span>
            <b style={{ textAlign: 'right' }}>{b.contact.firm}</b>
          </div>
        </div>
        <div className="notice warn" style={{ textAlign: 'left', marginBottom: 18 }}>
          <Lock size={18} />
          <div>
            <b>Test version</b>
            No money moves here. Choose what the bank would send back.
          </div>
        </div>
        {msg && (
          <div className="notice err" style={{ textAlign: 'left', marginBottom: 12 }} role="alert">
            {msg}
          </div>
        )}
        <div className="pay-actions">
          <button className="btn btn-success btn-lg" disabled={busy} onClick={() => finish(true)}>
            Simulate a successful payment
          </button>
          <button className="btn btn-danger" disabled={busy} onClick={() => finish(false)}>
            Simulate a failed payment
          </button>
        </div>
      </div>
    </div>
  )
}
