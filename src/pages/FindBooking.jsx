import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { findBooking } from '../lib/store.js'
import { Field, TextInput } from '../components/ui.jsx'

export default function FindBooking() {
  const nav = useNavigate()
  const [id, setId] = useState('')
  const [who, setWho] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    document.title = 'Find a booking | Bengaluru ICAI'
  }, [])
  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!id.trim() || !who.trim()) return setMsg('Enter both the booking number and the email or mobile used.')
    const b = await findBooking(id, who)
    if (b) nav(`/booking/${b.id}`)
    else setMsg('We could not find a booking with those details. Check the number on your receipt.')
  }
  return (
    <div className="narrow">
      <form className="card card-pad" onSubmit={submit} noValidate>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>Find a booking</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          See your receipt again or finish a payment.
        </p>
        <div style={{ display: 'grid', gap: 16 }}>
          <Field label="Booking number" id="f-id" help="For example EICAI00158187">
            <TextInput id="f-id" value={id} onChange={(v) => setId(v.toUpperCase())} />
          </Field>
          <Field label="Email or mobile used for billing" id="f-who">
            <TextInput id="f-who" value={who} onChange={setWho} />
          </Field>
        </div>
        {msg && (
          <div className="notice err" style={{ marginTop: 16 }} role="alert">
            {msg}
          </div>
        )}
        <button className="btn btn-primary btn-lg" style={{ marginTop: 20 }}>
          <Search size={18} /> Find booking
        </button>
      </form>
    </div>
  )
}
