import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Clock, MapPin, Users, Percent, Minus, Plus, Lock, Phone, Mail, Award, Mic, Info, CircleCheck, Check, ChevronDown, Expand } from 'lucide-react'
import { getEvent, getSettings, createBooking, addInterest } from '../lib/data.js'
import { CATEGORY_LABELS, CATEGORY_PLURAL, enabledCategories, calcPrice, gstAppliesTo, describeDiscount } from '../lib/pricing.js'
import { fmtDateRange, fmtTimeRange, rupees, fmtDate } from '../lib/format.js'
import { rules, STATES } from '../lib/validate.js'
import { FloatInput, FloatSelect, FloatChoice, AudienceChips, RichText, isStudentEvent, Modal } from '../components/ui.jsx'
import Skyline from '../components/Skyline.jsx'
import { seatsIndicator, closingIndicator, stateIndicator, Ind } from '../lib/availability.jsx'
import { PolicyModal } from '../components/Layout.jsx'

const emptyPerson = () => ({ memberId: '', studentId: '', name: '', email: '', mobile: '', gender: '' })
const emptyContact = { firm: '', address: '', city: '', pincode: '', state: 'Karnataka', phone: '', email: '', gstin: '' }

function personErrors(category, p) {
  const e = {}
  if (category === 'member') e.memberId = rules.memberId(p.memberId)
  if (category === 'student') e.studentId = rules.studentId(p.studentId)
  e.name = rules.name(p.name)
  e.email = rules.email(p.email)
  e.mobile = rules.mobile(p.mobile)
  e.gender = rules.gender(p.gender)
  Object.keys(e).forEach((k) => !e[k] && delete e[k])
  return e
}

function validate(category, people, contact, agree) {
  const err = {}
  people.forEach((p, i) => {
    for (const [k, v] of Object.entries(personErrors(category, p))) err[`p${i}.${k}`] = v
  })
  // Same member or student number twice in one booking is almost always a typo.
  const idKey = category === 'member' ? 'memberId' : category === 'student' ? 'studentId' : null
  if (idKey) {
    const seen = {}
    people.forEach((p, i) => {
      const v = p[idKey].trim().toUpperCase()
      if (!v) return
      if (seen[v] !== undefined && !err[`p${i}.${idKey}`]) err[`p${i}.${idKey}`] = `Same number as participant ${seen[v] + 1}`
      else seen[v] = i
    })
  }
  err['c.firm'] = rules.required(contact.firm)
  err['c.address'] = rules.required(contact.address)
  err['c.city'] = rules.required(contact.city)
  err['c.pincode'] = rules.pincode(contact.pincode)
  err['c.state'] = rules.required(contact.state)
  err['c.phone'] = rules.mobile(contact.phone)
  err['c.email'] = rules.email(contact.email)
  if (gstAppliesTo(category)) err['c.gstin'] = rules.gstin(contact.gstin)
  err['agree'] = agree ? '' : 'Please accept the policies to continue'
  Object.keys(err).forEach((k) => !err[k] && delete err[k])
  return err
}

function InterestForm({ event, title }) {
  const [f, setF] = useState({ name: '', email: '', mobile: '' })
  const [err, setErr] = useState({})
  const [done, setDone] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    const x = { name: rules.name(f.name), email: rules.email(f.email), mobile: rules.mobile(f.mobile) }
    Object.keys(x).forEach((k) => !x[k] && delete x[k])
    setErr(x)
    if (Object.keys(x).length) return
    await addInterest({ eventId: event.id, eventTitle: event.title, ...f })
    setDone(true)
  }
  if (done)
    return (
      <div className="notice ok" style={{ marginTop: 16 }}>
        <CircleCheck size={20} />
        <div>
          <b>Thanks, we have your details.</b>
          The branch will get in touch if this event runs again.
        </div>
      </div>
    )
  return (
    <form onSubmit={submit} noValidate style={{ marginTop: 18 }}>
      <h3 style={{ fontSize: 18, marginBottom: 4 }}>{title}</h3>
      <p className="muted" style={{ fontSize: 15, marginBottom: 14 }}>
        Leave your details and the branch will let you know if it runs again.
      </p>
      <div className="grid-3">
        <FloatInput id="i-name" label="Name" value={f.name} onChange={(v) => setF({ ...f, name: v })} autoComplete="name" error={err.name} />
        <FloatInput id="i-email" label="Email" type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} autoComplete="email" error={err.email} />
        <FloatInput id="i-mobile" label="Mobile" inputMode="numeric" value={f.mobile} onChange={(v) => setF({ ...f, mobile: v })} autoComplete="tel-national" error={err.mobile} />
      </div>
      <button className="btn btn-primary" style={{ marginTop: 14 }}>
        Notify me
      </button>
    </form>
  )
}

export default function EventPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [event, setEvent] = useState(undefined)
  const [settings, setSettings] = useState(null)
  const [category, setCategory] = useState('')
  const [people, setPeople] = useState([emptyPerson()])
  const [openP, setOpenP] = useState([0])
  const [contact, setContact] = useState(emptyContact)
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState({})
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [policy, setPolicy] = useState(null)
  const [zoom, setZoom] = useState(false)
  const formRef = useRef(null)

  useEffect(() => {
    getSettings().then(setSettings)
    getEvent(id).then((e) => {
      setEvent(e)
      if (e) {
        document.title = `${e.title} | Bengaluru ICAI`
        setCategory(enabledCategories(e)[0] || '')
      }
    })
  }, [id])

  const qty = people.length
  const price = useMemo(() => (event && category && settings ? calcPrice(event, category, qty, settings.gstRate) : null), [event, category, qty, settings])

  useEffect(() => {
    if (tried) setErrors(validate(category, people, contact, agree))
  }, [tried, category, people, contact, agree])

  if (event === undefined || !settings) return <div className="wrap" style={{ padding: '40px 24px' }}>Loading...</div>
  if (event === null)
    return (
      <div className="narrow">
        <div className="empty">
          <h3>We could not find that event</h3>
          <p>
            It may have been removed. <Link to="/">See all events</Link>
          </p>
        </div>
      </div>
    )

  const cats = enabledCategories(event)
  const student = isStudentEvent(event)
  const open = event.state === 'open'
  const contactInfo = student ? settings.studentContact : settings.memberContact
  const b = event.bulk
  const discountReachable = b?.enabled && b.minQty <= event.maxNow
  const stateInd = stateIndicator(event)
  const closing = closingIndicator(event)
  const seatInd = event.state === 'open' || event.state === 'full' ? seatsIndicator(event) : null

  const setQty = (n) => {
    const next = Math.max(1, Math.min(event.maxNow, n))
    if (next > qty) setOpenP([next - 1])
    else setOpenP((o) => o.filter((i) => i < next))
    setPeople((p) => (next > p.length ? [...p, ...Array.from({ length: next - p.length }, emptyPerson)] : p.slice(0, next)))
  }
  const toggleOpen = (i) => setOpenP((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]))
  const removePerson = (i) => {
    setPeople((x) => x.filter((_, j) => j !== i))
    setOpenP([])
  }
  const setPerson = (i, field, v) => setPeople((p) => p.map((x, j) => (j === i ? { ...x, [field]: v } : x)))
  const setC = (field, v) => setContact((c) => ({ ...c, [field]: v }))

  const submit = async (e) => {
    e?.preventDefault()
    setTried(true)
    setFormError('')
    const err = validate(category, people, contact, agree)
    setErrors(err)
    const keys = Object.keys(err)
    if (keys.length) {
      const bad = [...new Set(keys.filter((k) => k.startsWith('p')).map((k) => Number(k.slice(1).split('.')[0])))]
      if (bad.length) setOpenP(bad)
      const first = keys[0] === 'agree' ? 'agree' : keys[0].replace('.', '-')
      setTimeout(() => {
        const el = document.getElementById(first) || document.querySelector(`[name="${first}"]`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => el?.focus?.({ preventScroll: true }), 300)
      }, 30)
      return
    }
    setBusy(true)
    try {
      const clean = people.map((p) => ({
        name: p.name.trim(),
        email: p.email.trim().toLowerCase(),
        mobile: p.mobile.replace(/\D/g, '').slice(-10),
        gender: p.gender,
        idNumber: category === 'member' ? p.memberId.trim() : category === 'student' ? p.studentId.trim().toUpperCase() : '',
      }))
      const { booking, payment } = await createBooking({
        eventId: event.id,
        category,
        participants: clean,
        contact: { ...contact, gstin: gstAppliesTo(category) ? contact.gstin.trim().toUpperCase() : '', email: contact.email.trim().toLowerCase() },
      })
      const k = encodeURIComponent(booking.accessKey || '')
      if (payment?.mode === 'eazypay' && payment.url) {
        window.location.assign(payment.url)
        return
      }
      nav(booking.status === 'pending' ? `/pay/${booking.id}?k=${k}` : `/booking/${booking.id}?k=${k}`)
    } catch (x) {
      if (x.fields) {
        const mapped = {}
        for (const [key, msg] of Object.entries(x.fields)) mapped[key.replace('.idNumber', category === 'student' ? '.studentId' : '.memberId')] = msg
        setErrors(mapped)
        const bad = [...new Set(Object.keys(mapped).filter((key) => key.startsWith('p')).map((key) => Number(key.slice(1).split('.')[0])))]
        if (bad.length) setOpenP(bad)
      }
      setFormError(x.message)
      setBusy(false)
    }
  }

  const err = (k) => errors[k]
  const payLabel = price && price.total > 0 ? `Pay ${rupees(price.total)}` : 'Confirm registration'

  return (
    <div className={`${student ? 'is-student-page' : ''} ${open ? 'has-mobile-pay' : ''}`}>
      <section className="ev-band">
        <div className="wrap ev-band-in">
          <Link to="/" className="back">
            <ArrowLeft size={17} /> All events
          </Link>
          <div className="chips">
            <AudienceChips event={event} />
            {stateInd && <Ind {...stateInd} />}
            {closing && <Ind {...closing} />}
          </div>
          <h1>{event.title}</h1>
        </div>
        <Skyline variant="retro" />
      </section>
      <div className="wrap">
          <div className="facts facts-panel">
            <div className="fact">
              <span className="ico">
                <CalendarDays size={20} />
              </span>
              <span>
                <small>Date</small>
                <b>{fmtDateRange(event.startDate, event.endDate)}</b>
              </span>
            </div>
            <div className="fact">
              <span className="ico">
                <Clock size={20} />
              </span>
              <span>
                <small>Time</small>
                <b>{fmtTimeRange(event.startTime, event.endTime)}</b>
              </span>
            </div>
            <div className="fact">
              <span className="ico">
                <MapPin size={20} />
              </span>
              <span>
                <small>Venue</small>
                <b>{event.venue}</b>
              </span>
            </div>
            <div className="fact">
              <span className={`ico ${seatInd ? `ico-${seatInd.tone}` : ''}`}>
                <Users size={20} />
              </span>
              <span>
                <small>Seats</small>
                <b className={seatInd ? `tone-${seatInd.tone}` : ''}>{seatInd ? seatInd.label : `${event.seats} seats`}</b>
              </span>
            </div>
            {event.cpeHours && (
              <div className="fact">
                <span className="ico">
                  <Award size={20} />
                </span>
                <span>
                  <small>CPE hours</small>
                  <b>{event.cpeHours}</b>
                </span>
              </div>
            )}
            {event.speakers && (
              <div className="fact">
                <span className="ico">
                  <Mic size={20} />
                </span>
                <span>
                  <small>Speakers</small>
                  <b>{event.speakers}</b>
                </span>
              </div>
            )}
          </div>
      </div>
      <div className="wrap event-layout">
        <div>
          <section className="card event-hero">
            {(event.description || event.imageUrl) && (
              <div className={`desc about ${event.imageUrl ? 'has-img' : ''}`}>
                {event.imageUrl && (
                  <button type="button" className="about-img" onClick={() => setZoom(true)} aria-label="View the event image full size">
                    <img src={event.imageUrl} alt={`${event.title} poster`} />
                    <span className="zoom-hint">
                      <Expand size={14} /> View full size
                    </span>
                  </button>
                )}
                <div className="about-text">
                  <h2 className="card-title">About this event</h2>
                  {event.description ? <RichText text={event.description} /> : <p className="muted">See the image for the programme details.</p>}
                </div>
              </div>
            )}
            <h2 className="card-title">Fees</h2>
            <table className="fee-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="num">Fee</th>
                  <th className="num col-gst">GST</th>
                  <th className="num">You pay</th>
                </tr>
              </thead>
              <tbody>
                {cats.map((c) => {
                  const p = calcPrice({ ...event, bulk: null }, c, 1, settings.gstRate)
                  return (
                    <tr key={c}>
                      <td>{CATEGORY_PLURAL[c]}</td>
                      <td className="num">{rupees(p.fee)}</td>
                      <td className="num col-gst">{p.gstRate ? rupees(p.gst) : 'None'}</td>
                      <td className="num">
                        <b>{p.total ? rupees(p.total) : 'Free'}</b>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {b?.enabled && event.state !== 'closed' && (
              <div className="offer">
                <Percent size={20} />
                <span>Group discount: {describeDiscount(b)} in one booking.</span>
              </div>
            )}
          </section>

          {event.state === 'closed' && (
            <section className="card card-pad form-card">
              <div className="notice">
                <Info size={20} />
                <div>
                  <b>{event.ended ? 'This event is over.' : 'Registration for this event has closed.'}</b>
                  {cats.includes('student') ? 'For questions, contact the SICASA desk.' : 'For questions, contact the registrations desk.'}
                </div>
              </div>
              <InterestForm event={event} title="Missed this one?" />
            </section>
          )}
          {event.state === 'paused' && (
            <section className="card card-pad form-card">
              <div className="notice warn">
                <Info size={20} />
                <div>
                  <b>Bookings for this event are paused right now.</b>
                  Please check back later or call the branch.
                </div>
              </div>
            </section>
          )}
          {event.state === 'soon' && (
            <section className="card card-pad form-card">
              <div className="notice">
                <Info size={20} />
                <div>
                  <b>Registration opens on {fmtDate(event.bookingOpens)}.</b>
                  Come back then to book your seat.
                </div>
              </div>
            </section>
          )}
          {event.state === 'full' && (
            <section className="card card-pad form-card">
              <div className="notice warn">
                <Info size={20} />
                <div>
                  <b>This event is fully booked.</b>
                </div>
              </div>
              <InterestForm event={event} title="Want a seat if one opens up?" />
            </section>
          )}

          {open && (
            <form className="card form-card" onSubmit={submit} noValidate ref={formRef} aria-label="Registration form">
              <div className="step">
                <div className="step-head">
                  <span className="step-num">1</span>
                  <div>
                    <h2>Who is attending?</h2>
                    <p>One category per booking. Book members and non-members separately.</p>
                  </div>
                </div>
                {cats.length > 1 ? (
                  <div className="cat-options" role="radiogroup" aria-label="Category">
                    {cats.map((c) => {
                      const p = calcPrice({ ...event, bulk: null }, c, 1, settings.gstRate)
                      return (
                        <div className="cat-opt" key={c}>
                          <input type="radio" id={`cat-${c}`} name="category" value={c} checked={category === c} onChange={() => setCategory(c)} />
                          <label htmlFor={`cat-${c}`}>
                            <b>{CATEGORY_LABELS[c]}</b>
                            <span>{p.total ? `${rupees(p.total)} per person${p.gstRate ? ' with GST' : ''}` : 'Free'}</span>
                          </label>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p>
                    This event is for <b>{CATEGORY_PLURAL[cats[0]].toLowerCase()}</b> only.
                  </p>
                )}

                <div className="qty-row">
                  <div className="field">
                    <span className="label" id="qty-label">
                      Number of participants
                    </span>
                    <div className="stepper" role="group" aria-labelledby="qty-label">
                      <button type="button" onClick={() => setQty(qty - 1)} disabled={qty <= 1} aria-label="One less participant">
                        <Minus size={18} />
                      </button>
                      <output aria-live="polite">{qty}</output>
                      <button type="button" onClick={() => setQty(qty + 1)} disabled={qty >= event.maxNow} aria-label="One more participant">
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                  <p className="hint" style={{ alignSelf: 'flex-end', paddingBottom: 12 }}>
                    Up to {event.maxNow} {event.maxNow === 1 ? 'person' : 'people'} in one booking.
                  </p>
                </div>
                {discountReachable && price && (
                  <div className={`notice ${price.perDiscount ? 'ok' : 'warn'}`} style={{ marginTop: 16 }} aria-live="polite">
                    <Percent size={20} />
                    <div>
                      {price.perDiscount ? (
                        <>
                          <b>Group discount applied.</b>
                          You save {rupees(price.perDiscount)} per person, {rupees(price.discount)} in total.
                        </>
                      ) : (
                        <>
                          <b>
                            Add {b.minQty - qty} more {b.minQty - qty === 1 ? 'person' : 'people'} to get the group discount.
                          </b>
                          {describeDiscount(b)}.
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="step">
                <div className="step-head">
                  <span className="step-num">2</span>
                  <div>
                    <h2>Participant details</h2>
                    <p>Certificates and CPE credit go to these names and numbers.</p>
                  </div>
                </div>
                {people.map((p, i) => {
                  const pe = personErrors(category, p)
                  const done = Object.keys(pe).length === 0
                  const shownErr = ['memberId', 'studentId', 'name', 'email', 'mobile', 'gender'].some((f) => err(`p${i}.${f}`))
                  const isOpen = openP.includes(i)
                  const idText = category === 'member' ? p.memberId : category === 'student' ? p.studentId : ''
                  const summary = [p.name.trim(), idText].filter(Boolean).join(', ')
                  return (
                    <fieldset className={`person ${isOpen ? 'is-open' : ''} ${shownErr ? 'has-err' : done ? 'is-done' : ''}`} key={i}>
                      <legend className="sr-only">Participant {i + 1}</legend>
                      <button type="button" className="person-head" aria-expanded={isOpen} aria-controls={`p${i}-body`} onClick={() => toggleOpen(i)}>
                        <span className="av" aria-hidden="true">
                          {done && !shownErr ? <Check size={15} strokeWidth={3} /> : i + 1}
                        </span>
                        <span className="ph-text">
                          <b>Participant {i + 1}</b>
                          <span className={shownErr ? 'tone-red' : ''}>{shownErr ? 'Some details need fixing' : summary || 'Tap to fill in details'}</span>
                        </span>
                        <ChevronDown size={18} className="ph-chev" aria-hidden="true" />
                      </button>
                      {isOpen && (
                        <div className="person-body" id={`p${i}-body`}>
                          <div className="grid-2">
                            {category === 'member' && (
                              <FloatInput id={`p${i}-memberId`} label="Membership number" help="6 digits, as on your ICAI membership card" inputMode="numeric" maxLength={6} value={p.memberId} onChange={(v) => setPerson(i, 'memberId', v.replace(/\D/g, ''))} error={err(`p${i}.memberId`)} />
                            )}
                            {category === 'student' && (
                              <FloatInput id={`p${i}-studentId`} label="Student registration number" help="For example SRO0123456" maxLength={10} value={p.studentId} onChange={(v) => setPerson(i, 'studentId', v.toUpperCase())} style={{ textTransform: 'uppercase' }} error={err(`p${i}.studentId`)} />
                            )}
                            <FloatInput id={`p${i}-name`} label="Full name" value={p.name} onChange={(v) => setPerson(i, 'name', v)} autoComplete={i === 0 ? 'name' : 'off'} error={err(`p${i}.name`)} className={category === 'nonMember' ? 'span-2' : ''} />
                            <FloatInput id={`p${i}-email`} label="Email" type="email" value={p.email} onChange={(v) => setPerson(i, 'email', v)} autoComplete={i === 0 ? 'email' : 'off'} error={err(`p${i}.email`)} />
                            <FloatInput id={`p${i}-mobile`} label="Mobile" type="tel" inputMode="numeric" value={p.mobile} onChange={(v) => setPerson(i, 'mobile', v)} autoComplete={i === 0 ? 'tel-national' : 'off'} error={err(`p${i}.mobile`)} />
                            <FloatChoice id={`p${i}-gender`} label="Gender" options={['Male', 'Female']} value={p.gender} onChange={(v) => setPerson(i, 'gender', v)} error={err(`p${i}.gender`)} className="span-2" />
                          </div>
                          <div className="person-foot">
                            {qty > 1 && (
                              <button type="button" className="link-btn muted-link" onClick={() => removePerson(i)}>
                                Remove participant
                              </button>
                            )}
                            {i < qty - 1 && (
                              <button type="button" className="btn btn-soft btn-sm" onClick={() => setOpenP([i + 1])}>
                                Next participant <ChevronDown size={15} />
                              </button>
                            )}
                            {i === qty - 1 && qty > 1 && (
                              <button type="button" className="btn btn-soft btn-sm" onClick={() => setOpenP([])}>
                                Done <Check size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </fieldset>
                  )
                })}
                {qty < event.maxNow && (
                  <button type="button" className="btn btn-soft" style={{ marginTop: 14 }} onClick={() => setQty(qty + 1)}>
                    <Plus size={18} /> Add another participant
                  </button>
                )}
              </div>

              <div className="step">
                <div className="step-head">
                  <span className="step-num">3</span>
                  <div>
                    <h2>Billing details</h2>
                    <p>Used for the receipt{gstAppliesTo(category) ? ' and GST invoice' : ''}.</p>
                  </div>
                </div>
                <div className="grid-2">
                  <FloatInput id="c-firm" label="Firm or trade name" value={contact.firm} onChange={(v) => setC('firm', v)} autoComplete="organization" error={err('c.firm')} className="span-2" />
                  <FloatInput id="c-address" label="Address" value={contact.address} onChange={(v) => setC('address', v)} autoComplete="street-address" error={err('c.address')} className="span-2" />
                  <FloatInput id="c-city" label="City" value={contact.city} onChange={(v) => setC('city', v)} autoComplete="address-level2" error={err('c.city')} className="half" />
                  <FloatInput id="c-pincode" label="Pincode" inputMode="numeric" maxLength={6} value={contact.pincode} onChange={(v) => setC('pincode', v.replace(/\D/g, ''))} autoComplete="postal-code" error={err('c.pincode')} className="half" />
                  <FloatSelect id="c-state" label="State" value={contact.state} onChange={(v) => setC('state', v)} error={err('c.state')}>
                    {STATES.map((st) => (
                      <option key={st}>{st}</option>
                    ))}
                  </FloatSelect>
                  <FloatInput id="c-phone" label="Contact number" type="tel" inputMode="numeric" value={contact.phone} onChange={(v) => setC('phone', v)} autoComplete="tel-national" error={err('c.phone')} />
                  <FloatInput id="c-email" label="Email for the receipt" type="email" value={contact.email} onChange={(v) => setC('email', v)} autoComplete="email" error={err('c.email')} className={gstAppliesTo(category) ? '' : 'span-2'} />
                  {gstAppliesTo(category) && (
                    <FloatInput id="c-gstin" label="GSTIN" optional help="Add it to claim GST input credit" maxLength={15} value={contact.gstin} onChange={(v) => setC('gstin', v.toUpperCase())} style={{ textTransform: 'uppercase' }} error={err('c.gstin')} />
                  )}
                </div>
                {people[0].email && !contact.email && (
                  <button type="button" className="link-btn" style={{ marginTop: 12, fontSize: 14.5 }} onClick={() => setContact((c) => ({ ...c, email: people[0].email, phone: c.phone || people[0].mobile }))}>
                    Use participant 1's email and mobile
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <aside>
          {open && price && (
            <div className="card summary">
              <div className="summary-in">
                <h2>Booking summary</h2>
                <p className="ev">{event.title}</p>
                <div className="lines">
                  <div className="row">
                    <span>
                      {CATEGORY_LABELS[category]} × {qty}
                    </span>
                    <span>{rupees(price.subtotal)}</span>
                  </div>
                  {price.discount > 0 && (
                    <div className="row disc">
                      <span>Group discount</span>
                      <span>-{rupees(price.discount)}</span>
                    </div>
                  )}
                  <div className="row">
                    <span>GST {price.gstRate ? `${price.gstRate}%` : ''}</span>
                    <span>{price.gstRate ? rupees(price.gst) : 'Not applicable'}</span>
                  </div>
                  <div className="row total">
                    <span>Total</span>
                    <span>{rupees(price.total)}</span>
                  </div>
                </div>
                <label className="check" id="agree-wrap">
                  <input type="checkbox" id="agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span>
                    I have read the{' '}
                    <button type="button" className="link-btn" onClick={() => setPolicy('refund')}>
                      refund
                    </button>{' '}
                    and{' '}
                    <button type="button" className="link-btn" onClick={() => setPolicy('cancellation')}>
                      cancellation
                    </button>{' '}
                    policies.
                  </span>
                </label>
                {err('agree') && (
                  <p className="err-text" style={{ marginTop: 6 }}>
                    {err('agree')}
                  </p>
                )}
                {tried && Object.keys(errors).length > 0 && (
                  <p className="err-text" style={{ marginTop: 10 }} role="alert">
                    Some details need fixing. They are marked in red.
                  </p>
                )}
                {formError && (
                  <div className="notice err" style={{ marginTop: 12 }} role="alert">
                    {formError}
                  </div>
                )}
                <button className="btn btn-primary btn-lg btn-block" onClick={submit} disabled={busy}>
                  {busy ? 'Please wait...' : payLabel}
                </button>
                {price.total > 0 && (
                  <p className="secure">
                    <Lock size={14} /> You pay on ICICI Bank Eazypay
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="card help-card">
            <h3>Need help?</h3>
            <p className="muted" style={{ display: 'block', marginTop: 0 }}>
              {student ? 'SICASA desk' : 'Registrations desk'}
            </p>
            <p>
              <Phone size={16} /> <a href={`tel:+91${contactInfo.phone.replace(/\D/g, '')}`}>{contactInfo.phone}</a>
            </p>
            <p>
              <Mail size={16} /> <a href={`mailto:${contactInfo.email}`}>{contactInfo.email}</a>
            </p>
          </div>
        </aside>
      </div>

      {open && price && (
        <div className="mobile-pay">
          <div>
            <small>
              {qty} {qty === 1 ? 'person' : 'people'}
              {price.discount > 0 ? ', discount applied' : ''}
            </small>
            <strong>{rupees(price.total)}</strong>
          </div>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {price.total > 0 ? 'Pay now' : 'Confirm'}
          </button>
        </div>
      )}
      {policy && <PolicyModal slug={policy} onClose={() => setPolicy(null)} />}
      {zoom && event.imageUrl && (
        <Modal title={event.title} onClose={() => setZoom(false)} wide>
          <img className="zoom-img" src={event.imageUrl} alt={`${event.title} poster`} />
        </Modal>
      )}
    </div>
  )
}
