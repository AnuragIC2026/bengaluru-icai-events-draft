// Demo data layer. Everything is kept in this browser's localStorage.
// Every function is async and returns plain objects, so a later version can swap
// this file for calls to a Node/Express API without touching the pages.

import seedEvents from '../data/events.json'
import { calcPrice, enabledCategories } from './pricing.js'
import { eventStart, eventCloseAt, eventState, decorateEvent } from './eventState.js'
import { getAllImages, getImage, putImage, deleteImage, clearImages } from './images.js'

const NS = 'blricai-events:v1:'
const KEYS = {
  events: NS + 'events',
  bookings: NS + 'bookings',
  interest: NS + 'interest',
  settings: NS + 'settings',
  seq: NS + 'seq',
  seeded: NS + 'seeded',
}

export const DEFAULT_SETTINGS = {
  gstRate: 18,
  bookingPrefix: 'EICAI',
  bookingDigits: 8,
  // Taken from the old site's contact page.
  memberContact: { phone: '98800 07905', email: 'blrregistrations@icai.org' },
  studentContact: { phone: '96069 13003', email: 'blrsicasa@icai.org' },
  officePhone: '080 4394 4868',
  address: 'ICAI Bhawan, #16/O, Millers Tank Bed Area, Vasanth Nagar, Bengaluru 560052',
}

// Demo logins only. The real build will use hashed passwords on the server.
export const DEMO_USERS = [
  { email: 'admin@demo.in', password: 'admin123', name: 'Branch admin', role: 'admin' },
  { email: 'accounts@demo.in', password: 'accounts123', name: 'Accounts team', role: 'accounts' },
]

const memory = {}
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return key in memory ? memory[key] : fallback
  }
}
function write(key, value) {
  memory[key] = value
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked: keep in memory for this visit */
  }
}

function ensureSeed() {
  if (read(KEYS.seeded, false)) return
  const now = new Date().toISOString()
  write(KEYS.events, seedEvents.map((e) => ({ ...e, createdAt: now, updatedAt: now })))
  write(KEYS.bookings, [])
  write(KEYS.interest, [])
  write(KEYS.settings, DEFAULT_SETTINGS)
  // The old portal's last booking number was 158186.
  write(KEYS.seq, 158186)
  write(KEYS.seeded, true)
}

const delay = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 60))

// ---------- settings ----------
export async function getSettings() {
  ensureSeed()
  return delay({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) })
}
export async function saveSettings(s) {
  ensureSeed()
  write(KEYS.settings, s)
  return delay(s)
}

// ---------- events ----------
function bookedCount(eventId, bookings) {
  return bookings
    .filter((b) => b.eventId === eventId && b.status === 'paid')
    .reduce((n, b) => n + b.participants.length, 0)
}

export { eventStart, eventCloseAt, eventState }

function decorate(e, bookings) {
  return decorateEvent(e, bookedCount(e.id, bookings))
}

export async function listEvents() {
  ensureSeed()
  const bookings = read(KEYS.bookings, [])
  const images = await getAllImages()
  const events = read(KEYS.events, []).map((e) => ({ ...decorate(e, bookings), imageUrl: images[String(e.id)] || null }))
  events.sort((a, b) => eventStart(a) - eventStart(b))
  return delay(events)
}

export async function getEvent(id) {
  ensureSeed()
  const e = read(KEYS.events, []).find((x) => String(x.id) === String(id))
  if (!e) return delay(null)
  return delay({ ...decorate(e, read(KEYS.bookings, [])), imageUrl: await getImage(e.id) })
}

export async function saveEvent(input) {
  ensureSeed()
  const events = read(KEYS.events, [])
  const now = new Date().toISOString()
  const clean = { ...input }
  for (const k of ['booked', 'seatsLeft', 'state', 'maxNow', 'imageUrl', 'imageChange', 'imageCopyFrom']) delete clean[k]
  if (!clean.id) {
    clean.id = Math.max(0, ...events.map((e) => e.id)) + 1
    const codes = events.map((e) => Number(e.code)).filter(Boolean)
    clean.code = String(Math.max(0, ...codes) + 1)
    clean.bookedBefore = 0
    clean.createdAt = now
    events.push({ ...clean, updatedAt: now })
  } else {
    const i = events.findIndex((e) => e.id === clean.id)
    events[i] = { ...events[i], ...clean, updatedAt: now }
  }
  write(KEYS.events, events)
  // imageChange: undefined = leave as is, null = remove, data URL = replace
  if (input.imageChange === null) await deleteImage(clean.id)
  else if (typeof input.imageChange === 'string') await putImage(clean.id, input.imageChange)
  return delay(clean)
}

export async function deleteEvent(id) {
  ensureSeed()
  const bookings = read(KEYS.bookings, [])
  if (bookings.some((b) => b.eventId === id)) throw new Error('This event has bookings, so it can only be closed, not deleted.')
  write(KEYS.events, read(KEYS.events, []).filter((e) => e.id !== id))
  await deleteImage(id)
  return delay(true)
}

// ---------- bookings ----------
function nextBookingId(settings) {
  const n = read(KEYS.seq, 158186) + 1
  write(KEYS.seq, n)
  return settings.bookingPrefix + String(n).padStart(settings.bookingDigits, '0')
}

export async function createBooking({ eventId, category, contact, participants }) {
  ensureSeed()
  const settings = { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) }
  const raw = read(KEYS.events, []).find((e) => e.id === eventId)
  if (!raw) throw new Error('This event no longer exists.')
  const bookings = read(KEYS.bookings, [])
  const e = decorate(raw, bookings)
  // Same checks the server will run, never trust the page.
  if (e.state !== 'open') throw new Error('Registration for this event is not open.')
  if (!enabledCategories(e).includes(category)) throw new Error('That category is not allowed for this event.')
  if (participants.length < 1 || participants.length > e.maxNow) throw new Error(`You can book up to ${e.maxNow} people for this event.`)
  const price = calcPrice(e, category, participants.length, settings.gstRate)
  const booking = {
    id: nextBookingId(settings),
    eventId,
    eventTitle: e.title,
    category,
    contact,
    participants,
    price,
    accessKey: Math.random().toString(36).slice(2, 12),
    status: price.total > 0 ? 'pending' : 'paid',
    payment: price.total > 0 ? null : { method: 'Free event', ref: '', at: new Date().toISOString() },
    createdAt: new Date().toISOString(),
  }
  write(KEYS.bookings, [...bookings, booking])
  return delay({ booking, payment: { mode: booking.status === 'pending' ? 'test' : 'none' } })
}

export async function getBooking(id) {
  ensureSeed()
  return delay(read(KEYS.bookings, []).find((b) => b.id === id) || null)
}

export async function findBooking(id, emailOrMobile) {
  ensureSeed()
  const q = String(emailOrMobile || '').trim().toLowerCase()
  const b = read(KEYS.bookings, []).find((x) => x.id.toLowerCase() === String(id).trim().toLowerCase())
  if (!b) return delay(null)
  const ok = b.contact.email.toLowerCase() === q || b.contact.phone.replace(/\D/g, '') === q.replace(/\D/g, '')
  return delay(ok ? { id: b.id, accessKey: b.accessKey || '' } : null)
}

// Demo stand-in for the ICICI Eazypay return call.
export async function completePayment(id, success) {
  ensureSeed()
  const bookings = read(KEYS.bookings, [])
  const i = bookings.findIndex((b) => b.id === id)
  if (i < 0) throw new Error('Booking not found.')
  const b = bookings[i]
  if (b.status === 'paid') return delay(b)
  if (success) {
    // Seats are only taken once payment succeeds, so recheck them.
    const raw = read(KEYS.events, []).find((e) => e.id === b.eventId)
    const e = decorate(raw, bookings)
    if (e.seatsLeft < b.participants.length) {
      b.status = 'failed'
      b.payment = { method: 'ICICI Eazypay (demo)', mode: 'Test', ref: 'DEMO' + Date.now().toString().slice(-9), code: 'E000', amount: b.price.total, at: new Date().toISOString(), message: 'Seats ran out before payment finished', note: 'Seats ran out before payment finished.' }
    } else {
      b.status = 'paid'
      b.payment = { method: 'ICICI Eazypay (demo)', mode: 'Test', ref: 'DEMO' + Date.now().toString().slice(-9), code: 'E000', amount: b.price.total, at: new Date().toISOString() }
    }
  } else {
    b.status = 'failed'
    b.payment = { method: 'ICICI Eazypay (demo)', mode: 'Test', ref: '', code: 'E0803', amount: b.price.total, at: new Date().toISOString(), message: 'Cancelled by the person paying (test)', note: 'Payment was not completed.' }
  }
  bookings[i] = b
  write(KEYS.bookings, bookings)
  return delay(b)
}

export async function listBookings() {
  ensureSeed()
  return delay([...read(KEYS.bookings, [])].reverse())
}

// ---------- interest (missed opportunity) ----------
export async function addInterest(entry) {
  ensureSeed()
  const list = read(KEYS.interest, [])
  const item = { id: Date.now(), ...entry, createdAt: new Date().toISOString() }
  write(KEYS.interest, [...list, item])
  return delay(item)
}
export async function listInterest() {
  ensureSeed()
  return delay([...read(KEYS.interest, [])].reverse())
}

// ---------- demo admin ----------
export async function resetDemo() {
  await clearImages()
  write(KEYS.seeded, false)
  ensureSeed()
  return delay(true)
}

export async function login(email, password) {
  const u = DEMO_USERS.find((x) => x.email === email.trim().toLowerCase() && x.password === password)
  if (!u) return null
  const session = { email: u.email, name: u.name, role: u.role }
  try {
    sessionStorage.setItem(NS + 'session', JSON.stringify(session))
  } catch {
    memory.session = session
  }
  return session
}
export function currentUser() {
  try {
    return JSON.parse(sessionStorage.getItem(NS + 'session')) || null
  } catch {
    return memory.session || null
  }
}
export function logout() {
  try {
    sessionStorage.removeItem(NS + 'session')
  } catch {
    delete memory.session
  }
}
