import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Eye, ImagePlus, RefreshCw, X } from 'lucide-react'
import { getEvent, saveEvent, deleteEvent, getSettings, listBookings } from '../lib/data.js'
import { prepareImage } from '../lib/images.js'
import { CATEGORY_ORDER, CATEGORY_PLURAL, calcPrice } from '../lib/pricing.js'
import { rupees, fmtDateTime } from '../lib/format.js'
import { RequireRole } from './AdminLayout.jsx'
import { checkEvent as check } from '../lib/eventRules.js'
import { Field, TextInput, Modal, useToast } from '../components/ui.jsx'

const BLANK = {
  title: '',
  description: '',
  venue: 'ICAI Bhawan, Vasanthnagar Branch Premises, Bengaluru',
  startDate: '',
  endDate: '',
  startTime: '10:00',
  endTime: '13:00',
  categories: { member: { enabled: true, fee: 0 }, nonMember: { enabled: true, fee: 0 }, student: { enabled: false, fee: 0 } },
  seats: 200,
  bookedBefore: 0,
  maxPerBooking: 5,
  bulk: { enabled: false, minQty: 5, type: 'percent', value: 10 },
  bookingOpens: '',
  closesAt: '',
  status: 'open',
  cpeHours: '',
  speakers: '',
}

function Money({ id, value, onChange, disabled, prefix = '₹', suffix, error }) {
  return (
    <div className={`money ${disabled ? 'disabled' : ''}`}>
      {prefix && <span>{prefix}</span>}
      <input id={id} type="number" min="0" step="1" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={error ? 'true' : undefined} />
      {suffix && <span className="after">{suffix}</span>}
    </div>
  )
}

function ImageField({ url, onPick, onRemove }) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const take = async (file) => {
    setErr('')
    setBusy(true)
    try {
      const { dataUrl } = await prepareImage(file)
      onPick(dataUrl)
    } catch (x) {
      setErr(x.message)
    }
    setBusy(false)
  }
  const input = (
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="sr-only"
      onChange={(e) => {
        take(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )
  return (
    <div>
      {url ? (
        <div className="img-current">
          <div className="img-frame">
            <img src={url} alt="Current event image" />
          </div>
          <div className="img-actions">
            <label className="btn btn-ghost btn-sm">
              <RefreshCw size={15} /> Replace image
              {input}
            </label>
            <button type="button" className="btn btn-danger btn-sm" onClick={onRemove}>
              <X size={15} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          className={`img-drop ${drag ? 'is-drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            take(e.dataTransfer.files?.[0])
          }}
        >
          <ImagePlus size={26} />
          <b>{busy ? 'Preparing image...' : 'Add an image'}</b>
          <span>Click to choose, or drop a file here. JPG, PNG or WebP up to 8 MB.</span>
          {input}
        </label>
      )}
      {err && (
        <p className="err-text" style={{ marginTop: 8 }} role="alert">
          {err}
        </p>
      )}
    </div>
  )
}

function Editor() {
  const { id } = useParams()
  const isNew = !id
  const nav = useNavigate()
  const toast = useToast()
  const [f, setF] = useState(null)
  const [bookedHere, setBookedHere] = useState(0)
  const [hasBookings, setHasBookings] = useState(false)
  const [gstRate, setGstRate] = useState(18)
  const [errors, setErrors] = useState({})
  const [tried, setTried] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [delErr, setDelErr] = useState('')

  useEffect(() => {
    getSettings().then((s) => setGstRate(s.gstRate))
    if (isNew) {
      setF(structuredClone(BLANK))
      document.title = 'New event | Event admin'
      return
    }
    getEvent(id).then((e) => {
      if (!e) return setF(false)
      document.title = `${e.title} | Event admin`
      setF({ ...structuredClone(BLANK), ...e, bulk: { ...BLANK.bulk, ...e.bulk } })
    })
    listBookings().then((bs) => {
      const mine = bs.filter((b) => String(b.eventId) === String(id))
      setHasBookings(mine.length > 0)
      setBookedHere(mine.filter((b) => b.status === 'paid').reduce((n, b) => n + b.participants.length, 0))
    })
  }, [id, isNew])

  useEffect(() => {
    if (tried && f) setErrors(check(f, bookedHere))
  }, [f, tried, bookedHere])

  const example = useMemo(() => {
    if (!f?.bulk.enabled) return null
    const c = CATEGORY_ORDER.find((k) => f.categories[k].enabled && Number(f.categories[k].fee) > 0)
    const mq = Number(f.bulk.minQty)
    if (!c || !(mq >= 2) || !(Number(f.bulk.value) > 0)) return null
    const ev = { ...f, categories: { ...f.categories, [c]: { ...f.categories[c], fee: Number(f.categories[c].fee) } }, bulk: { ...f.bulk, minQty: mq, value: Number(f.bulk.value) } }
    const below = calcPrice(ev, c, Math.max(1, mq - 1), gstRate)
    const at = calcPrice(ev, c, mq, gstRate)
    return { c, mq, below, at }
  }, [f, gstRate])

  if (f === null) return <p>Loading...</p>
  if (f === false)
    return (
      <div className="empty">
        <h3>Event not found</h3>
        <Link to="/admin/events">Back to events</Link>
      </div>
    )

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const setCat = (c, k, v) => setF((x) => ({ ...x, categories: { ...x.categories, [c]: { ...x.categories[c], [k]: v } } }))
  const setBulk = (k, v) => setF((x) => ({ ...x, bulk: { ...x.bulk, [k]: v } }))
  const er = (k) => errors[k]

  const save = async () => {
    setTried(true)
    const e = check(f, bookedHere)
    setErrors(e)
    if (Object.keys(e).length) {
      document.querySelector('.form-errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    const out = {
      ...f,
      title: f.title.trim(),
      venue: f.venue.trim(),
      endDate: f.endDate || f.startDate,
      seats: Number(f.seats),
      maxPerBooking: Number(f.maxPerBooking),
      categories: Object.fromEntries(CATEGORY_ORDER.map((c) => [c, { enabled: f.categories[c].enabled, fee: Number(f.categories[c].fee) || 0 }])),
      bulk: { ...f.bulk, minQty: Number(f.bulk.minQty), value: Number(f.bulk.value) },
    }
    let saved
    try {
      setSaveErr('')
      saved = await saveEvent(out)
    } catch (x) {
      if (x.fields) setErrors(x.fields)
      setSaveErr(x.message)
      return
    }
    if (f.imageChange !== undefined) setF((x) => ({ ...x, imageUrl: x.imageChange, imageChange: undefined }))
    toast(isNew ? 'Event added' : 'Changes saved')
    if (isNew) nav(`/admin/events/${saved.id}`, { replace: true })
  }

  const remove = async () => {
    try {
      await deleteEvent(f.id)
      toast('Event deleted')
      nav('/admin/events')
    } catch (x) {
      setDelErr(x.message)
    }
  }

  const errCount = Object.keys(errors).length
  const booked = (f.bookedBefore || 0) + bookedHere

  return (
    <>
      <div className="crumb" style={{ paddingTop: 0 }}>
        <Link to="/admin/events">
          <ArrowLeft size={17} /> Events
        </Link>
      </div>
      <div className="page-head">
        <div>
          <h1>{isNew ? 'Add an event' : 'Edit event'}</h1>
          {!isNew && (
            <p>
              Event no. {f.code}, last changed {fmtDateTime(f.updatedAt)}
            </p>
          )}
        </div>
      </div>
      <div className="editor">
        <div className="panel">
          <section className="ed-section">
            <h2>Basics</h2>
            <p>What people see on the event list and event page.</p>
            <div style={{ display: 'grid', gap: 16 }}>
              <Field label="Event name" id="e-title" error={er('title')}>
                <TextInput id="e-title" value={f.title} onChange={(v) => set('title', v)} error={er('title')} />
              </Field>
              <Field label="Description" optional id="e-desc" help="Topic, early bird notes, what's included. Each new line becomes a paragraph.">
                <textarea id="e-desc" value={f.description} onChange={(e) => set('description', e.target.value)} rows={4} />
              </Field>
              <Field label="Venue" id="e-venue" error={er('venue')}>
                <TextInput id="e-venue" value={f.venue} onChange={(v) => set('venue', v)} error={er('venue')} />
              </Field>
              <div className="grid-2">
                <Field label="CPE hours" optional id="e-cpe" help="Shown on the event page when filled in.">
                  <TextInput id="e-cpe" value={f.cpeHours} onChange={(v) => set('cpeHours', v)} placeholder="For example 3 hours" />
                </Field>
                <Field label="Speakers" optional id="e-spk">
                  <TextInput id="e-spk" value={f.speakers} onChange={(v) => set('speakers', v)} placeholder="For example CA. A Kumar" />
                </Field>
              </div>
            </div>
          </section>

          <section className="ed-section">
            <h2>Event image</h2>
            <p>Shown on the event list and the event page. Any shape works, the whole image is always shown. Large images are made smaller automatically.</p>
            <ImageField url={f.imageChange === undefined ? f.imageUrl : f.imageChange} onPick={(d) => set('imageChange', d)} onRemove={() => set('imageChange', null)} />
          </section>

          <section className="ed-section">
            <h2>Date and time</h2>
            <p>Bengaluru time. Leave the end date blank for one day events.</p>
            <div className="grid-2">
              <Field label="Start date" id="e-sd" error={er('startDate')}>
                <TextInput id="e-sd" type="date" value={f.startDate} onChange={(v) => set('startDate', v)} error={er('startDate')} />
              </Field>
              <Field label="End date" optional id="e-ed" error={er('endDate')}>
                <TextInput id="e-ed" type="date" value={f.endDate === f.startDate ? '' : f.endDate} onChange={(v) => set('endDate', v)} error={er('endDate')} />
              </Field>
              <Field label="Start time" id="e-st" error={er('startTime')}>
                <TextInput id="e-st" type="time" value={f.startTime} onChange={(v) => set('startTime', v)} error={er('startTime')} />
              </Field>
              <Field label="End time" id="e-et" error={er('endTime')}>
                <TextInput id="e-et" type="time" value={f.endTime} onChange={(v) => set('endTime', v)} error={er('endTime')} />
              </Field>
            </div>
          </section>

          <section className="ed-section">
            <h2>Who can attend and fees</h2>
            <p>
              Enter fees before GST. GST of {gstRate}% is added for members and non-members. Students pay no GST.
            </p>
            {er('categories') && <p className="err-text">{er('categories')}</p>}
            {CATEGORY_ORDER.map((c) => (
              <div className="cat-row" key={c}>
                <label className="switch">
                  <input type="checkbox" checked={f.categories[c].enabled} onChange={(e) => setCat(c, 'enabled', e.target.checked)} />
                  {CATEGORY_PLURAL[c]}
                </label>
                <div className={`field ${er(`fee.${c}`) ? 'has-err' : ''}`}>
                  <label className="sr-only" htmlFor={`fee-${c}`}>
                    Fee for {CATEGORY_PLURAL[c].toLowerCase()}
                  </label>
                  <Money id={`fee-${c}`} value={f.categories[c].fee} onChange={(v) => setCat(c, 'fee', v)} disabled={!f.categories[c].enabled} suffix={c === 'student' ? 'no GST' : `+ ${gstRate}% GST`} error={er(`fee.${c}`)} />
                  {er(`fee.${c}`) && <span className="err-text">{er(`fee.${c}`)}</span>}
                </div>
              </div>
            ))}
          </section>

          <section className="ed-section">
            <h2>Seats and booking limits</h2>
            <p>Booked so far: {booked} seats{f.bookedBefore ? `, of which ${f.bookedBefore} were sold on the old portal` : ''}.</p>
            <div className="grid-2">
              <Field label="Total seats" id="e-seats" error={er('seats')}>
                <TextInput id="e-seats" type="number" min="1" inputMode="numeric" value={f.seats} onChange={(v) => set('seats', v)} error={er('seats')} />
              </Field>
              <Field label="Most people in one booking" id="e-max" error={er('maxPerBooking')} help="The old portal allowed 5.">
                <TextInput id="e-max" type="number" min="1" max="50" inputMode="numeric" value={f.maxPerBooking} onChange={(v) => set('maxPerBooking', v)} error={er('maxPerBooking')} />
              </Field>
            </div>
          </section>

          <section className="ed-section">
            <h2>Group discount</h2>
            <p>Reward firms that book several people at once. The discount comes off each person's fee, before GST.</p>
            <label className="switch">
              <input type="checkbox" checked={f.bulk.enabled} onChange={(e) => setBulk('enabled', e.target.checked)} />
              Offer a group discount on this event
            </label>
            {f.bulk.enabled && (
              <div className="disc-box">
                <div className="grid-3">
                  <Field label="Applies from" id="b-min" error={er('bulk.minQty')}>
                    <Money id="b-min" prefix={null} suffix="people" value={f.bulk.minQty} onChange={(v) => setBulk('minQty', v)} error={er('bulk.minQty')} />
                  </Field>
                  <div className="field">
                    <span className="label" id="b-type-l">
                      Discount type
                    </span>
                    <div className="seg" role="group" aria-labelledby="b-type-l" style={{ background: '#fff' }}>
                      <button type="button" aria-pressed={f.bulk.type === 'percent'} onClick={() => setBulk('type', 'percent')}>
                        Percentage
                      </button>
                      <button type="button" aria-pressed={f.bulk.type === 'amount'} onClick={() => setBulk('type', 'amount')}>
                        Amount
                      </button>
                    </div>
                  </div>
                  <Field label={f.bulk.type === 'percent' ? 'Discount per person' : 'Off each person'} id="b-val" error={er('bulk.value')}>
                    <Money id="b-val" prefix={f.bulk.type === 'amount' ? '₹' : null} suffix={f.bulk.type === 'percent' ? '%' : null} value={f.bulk.value} onChange={(v) => setBulk('value', v)} error={er('bulk.value')} />
                  </Field>
                </div>
                {example && (
                  <div className="example" aria-live="polite">
                    <b>Example for {CATEGORY_PLURAL[example.c].toLowerCase()}</b>
                    <table>
                      <tbody>
                        <tr>
                          <td>
                            {example.below.qty} {example.below.qty === 1 ? 'person' : 'people'}, no discount
                          </td>
                          <td>{rupees(example.below.total)}</td>
                        </tr>
                        <tr>
                          <td>
                            {example.mq} people, {rupees(example.at.netPerPerson)} each instead of {rupees(example.at.fee)}
                          </td>
                          <td>
                            <b>{rupees(example.at.total)}</b>
                          </td>
                        </tr>
                        <tr>
                          <td className="muted">They save</td>
                          <td style={{ color: '#1E8A4C', fontWeight: 700 }}>{rupees(calcPrice({ ...f, bulk: null, categories: { ...f.categories, [example.c]: { enabled: true, fee: Number(f.categories[example.c].fee) } } }, example.c, example.mq, gstRate).total - example.at.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <span className="muted" style={{ fontSize: 13 }}>
                      Totals include GST where it applies.
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="ed-section">
            <h2>Booking window</h2>
            <p>Registration closes when the event starts unless you set an earlier time.</p>
            <div className="grid-2">
              <Field label="Booking opens on" optional id="e-open" error={er('bookingOpens')}>
                <TextInput id="e-open" type="date" value={f.bookingOpens} onChange={(v) => set('bookingOpens', v)} error={er('bookingOpens')} />
              </Field>
              <Field label="Close bookings at" optional id="e-close" help="Leave blank to close at the start time.">
                <TextInput id="e-close" type="datetime-local" value={f.closesAt} onChange={(v) => set('closesAt', v)} />
              </Field>
            </div>
          </section>
        </div>

        <aside className="ed-side">
          <div className="panel">
            <h3>Status</h3>
            <div className="status-opts">
              {[
                ['open', 'Open', 'People can book until it closes'],
                ['paused', 'Paused', 'Shown, but no new bookings'],
                ['closed', 'Closed', 'Registration closed now'],
              ].map(([k, l, d]) => (
                <label key={k}>
                  <input type="radio" name="status" checked={f.status === k} onChange={() => set('status', k)} />
                  <span>
                    <b>{l}</b>
                    <span>{d}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {tried && errCount > 0 && (
            <div className="form-errors" role="alert">
              <b>
                {errCount} {errCount === 1 ? 'thing needs' : 'things need'} fixing before saving
              </b>
              <ul>
                {Object.values(errors)
                  .slice(0, 6)
                  .map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
              </ul>
            </div>
          )}
          {saveErr && (
            <div className="form-errors" role="alert">
              {saveErr}
            </div>
          )}
          <div className="panel" style={{ display: 'grid', gap: 10 }}>
            <button className="btn btn-primary btn-lg" onClick={save}>
              <Save size={18} /> {isNew ? 'Add event' : 'Save changes'}
            </button>
            {!isNew && (
              <a className="btn btn-ghost" href={`#/event/${f.id}`} target="_blank" rel="noreferrer">
                <Eye size={17} /> View on the portal
              </a>
            )}
            {!isNew && !hasBookings && (
              <button className="btn btn-danger" onClick={() => setConfirmDel(true)}>
                <Trash2 size={17} /> Delete event
              </button>
            )}
            {!isNew && hasBookings && <p className="muted" style={{ fontSize: 13.5 }}>Events with bookings can be closed but not deleted.</p>}
          </div>
        </aside>
      </div>
      {confirmDel && (
        <Modal title="Delete this event?" onClose={() => setConfirmDel(false)}>
          <p>
            <b>{f.title}</b> will be removed from the portal and the admin. This can't be undone.
          </p>
          {delErr && (
            <div className="notice err" style={{ marginTop: 12 }}>
              {delErr}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setConfirmDel(false)}>
              Keep it
            </button>
            <button className="btn btn-danger" onClick={remove}>
              <Trash2 size={17} /> Delete event
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

export default function EventEditor() {
  const { id } = useParams()
  return (
    <RequireRole role="admin">
      <Editor key={id || 'new'} />
    </RequireRole>
  )
}
