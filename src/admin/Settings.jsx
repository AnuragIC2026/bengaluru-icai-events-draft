import { useEffect, useState } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { getSettings, saveSettings, resetDemo } from '../lib/store.js'
import { RequireRole } from './AdminLayout.jsx'
import { Field, TextInput, Modal, useToast } from '../components/ui.jsx'

function Inner() {
  const toast = useToast()
  const [s, setS] = useState(null)
  const [err, setErr] = useState({})
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    document.title = 'Settings | Event admin'
    getSettings().then(setS)
  }, [])
  if (!s) return <p>Loading...</p>
  const set = (path, v) =>
    setS((x) => {
      const n = structuredClone(x)
      const keys = path.split('.')
      let o = n
      keys.slice(0, -1).forEach((k) => (o = o[k]))
      o[keys.at(-1)] = v
      return n
    })
  const save = async () => {
    const e = {}
    const g = Number(s.gstRate)
    if (!(g >= 0 && g <= 28)) e.gstRate = 'Between 0 and 28'
    if (!/^[A-Z]{2,10}$/.test(s.bookingPrefix)) e.bookingPrefix = '2 to 10 capital letters'
    setErr(e)
    if (Object.keys(e).length) return
    await saveSettings({ ...s, gstRate: g })
    toast('Settings saved')
  }
  const reset = async () => {
    await resetDemo()
    setConfirm(false)
    getSettings().then(setS)
    toast('Test data reset')
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Applies to every event on the portal.</p>
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 820 }}>
        <section className="ed-section">
          <h2>Tax and booking numbers</h2>
          <p>GST applies to member and non-member fees. Student fees never carry GST.</p>
          <div className="grid-2">
            <Field label="GST rate" id="s-gst" error={err.gstRate}>
              <div className="money">
                <input id="s-gst" type="number" min="0" max="28" value={s.gstRate} onChange={(e) => set('gstRate', e.target.value)} />
                <span className="after">%</span>
              </div>
            </Field>
            <Field label="Booking number prefix" id="s-prefix" error={err.bookingPrefix} help="The old portal used EICAI, so numbers carry on from there.">
              <TextInput id="s-prefix" value={s.bookingPrefix} onChange={(v) => set('bookingPrefix', v.toUpperCase())} />
            </Field>
          </div>
        </section>
        <section className="ed-section">
          <h2>Help contacts on event pages</h2>
          <p>Member events show the registrations desk. Student only events show the SICASA desk.</p>
          <div className="grid-2">
            <Field label="Registrations desk phone" id="s-mp">
              <TextInput id="s-mp" value={s.memberContact.phone} onChange={(v) => set('memberContact.phone', v)} />
            </Field>
            <Field label="Registrations desk email" id="s-me">
              <TextInput id="s-me" value={s.memberContact.email} onChange={(v) => set('memberContact.email', v)} />
            </Field>
            <Field label="SICASA desk phone" id="s-sp">
              <TextInput id="s-sp" value={s.studentContact.phone} onChange={(v) => set('studentContact.phone', v)} />
            </Field>
            <Field label="SICASA desk email" id="s-se">
              <TextInput id="s-se" value={s.studentContact.email} onChange={(v) => set('studentContact.email', v)} />
            </Field>
          </div>
        </section>
        <section className="ed-section" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={save}>
            <Save size={18} /> Save settings
          </button>
        </section>
      </div>
      <div className="panel" style={{ maxWidth: 820, marginTop: 18 }}>
        <section className="ed-section">
          <h2>Test data</h2>
          <p>Puts the 22 events and their sample images back as they were and clears all test bookings in this browser.</p>
          <button className="btn btn-danger" onClick={() => setConfirm(true)}>
            <RotateCcw size={17} /> Reset test data
          </button>
        </section>
      </div>
      {confirm && (
        <Modal title="Reset test data?" onClose={() => setConfirm(false)}>
          <p>All test bookings, interest entries and event changes in this browser will be cleared.</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={reset}>
              Reset
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

export default function Settings() {
  return (
    <RequireRole role="admin">
      <Inner />
    </RequireRole>
  )
}
