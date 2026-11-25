// Talks to the Node API (server/). Used when the site is built with VITE_API_URL set.
// Same functions as the browser demo in store.js, so the pages don't care which one is in use.

const BASE = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const SESSION = 'blricai-events:api-session'

function session() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION)) || null
  } catch {
    return null
  }
}

async function call(path, { method = 'GET', body, admin = false, form } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (admin) {
    const s = session()
    if (s?.token) headers.Authorization = `Bearer ${s.token}`
  }
  let res
  try {
    res = await fetch(BASE + path, { method, headers, body: form || (body !== undefined ? JSON.stringify(body) : undefined) })
  } catch {
    throw new Error('Could not reach the server. Check your internet connection and try again.')
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && admin) {
      logout()
      if (!location.hash.startsWith('#/admin/login')) location.hash = '#/admin/login'
    }
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.status = res.status
    err.fields = data?.fields
    throw err
  }
  return data
}

export const IS_DEMO = false

// ---------- settings ----------
export async function getSettings() {
  if (session()?.role === 'admin' && location.hash.startsWith('#/admin')) return call('/api/admin/settings', { admin: true })
  return call('/api/settings')
}
export const saveSettings = (s) => call('/api/admin/settings', { method: 'PUT', body: s, admin: true })

// ---------- events ----------
export const listEvents = () => call('/api/events')
export async function getEvent(id) {
  try {
    return await call(`/api/events/${encodeURIComponent(id)}`)
  } catch (e) {
    if (e.status === 404) return null
    throw e
  }
}

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',')
  const type = head.match(/data:([^;]+)/)?.[1] || 'image/webp'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type })
}

export async function saveEvent(input) {
  const { imageChange, imageCopyFrom, imageUrl, booked, seatsLeft, state, maxNow, id, code, createdAt, updatedAt, bookedBefore, ...fields } = input
  const saved = id ? await call(`/api/admin/events/${id}`, { method: 'PUT', body: fields, admin: true }) : await call('/api/admin/events', { method: 'POST', body: fields, admin: true })
  if (typeof imageChange === 'string' && imageChange.startsWith('data:')) {
    const form = new FormData()
    form.append('image', dataUrlToBlob(imageChange), 'event.webp')
    await call(`/api/admin/events/${saved.id}/image`, { method: 'POST', form, admin: true })
  } else if (imageChange === null) {
    await call(`/api/admin/events/${saved.id}/image`, { method: 'DELETE', admin: true })
  } else if (imageCopyFrom) {
    await call(`/api/admin/events/${saved.id}/image/copy-from/${imageCopyFrom}`, { method: 'POST', admin: true })
  }
  return saved
}

export const deleteEvent = (id) => call(`/api/admin/events/${id}`, { method: 'DELETE', admin: true })

// ---------- bookings ----------
// Returns { booking, payment } where payment.mode is none | test | eazypay (with url)
export const createBooking = (input) => call('/api/bookings', { method: 'POST', body: input })

export async function getBooking(id, key) {
  if (!key) return null
  try {
    return await call(`/api/bookings/${encodeURIComponent(id)}?k=${encodeURIComponent(key)}`)
  } catch (e) {
    if (e.status === 404) return null
    throw e
  }
}

export async function findBooking(id, who) {
  try {
    return await call('/api/bookings/find', { method: 'POST', body: { id, who } })
  } catch (e) {
    if (e.status === 404) return null
    throw e
  }
}

export const completePayment = (id, success, key) => call(`/api/payments/test/${encodeURIComponent(id)}`, { method: 'POST', body: { k: key, success } })
export const listBookings = () => call('/api/admin/bookings', { admin: true })

// ---------- interest ----------
export const addInterest = (entry) => call('/api/interest', { method: 'POST', body: { eventId: entry.eventId, name: entry.name, email: entry.email, mobile: entry.mobile } })
export const listInterest = () => call('/api/admin/interest', { admin: true })

// ---------- admin ----------
export async function resetDemo() {
  throw new Error('Reset is only for the browser test version.')
}
export const DEMO_USERS = []

export async function login(email, password) {
  try {
    const r = await call('/api/admin/login', { method: 'POST', body: { email, password } })
    const s = { ...r.user, token: r.token }
    sessionStorage.setItem(SESSION, JSON.stringify(s))
    return s
  } catch (e) {
    if (e.status === 401) return null
    throw e
  }
}
export function currentUser() {
  return session()
}
export function logout() {
  try {
    sessionStorage.removeItem(SESSION)
  } catch {
    /* ignore */
  }
}
