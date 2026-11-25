import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'

// Shared with the front end so prices, rules and messages are identical on both sides.
import { calcPrice, enabledCategories, gstAppliesTo, CATEGORY_ORDER } from '../../src/lib/pricing.js'
import { rules, STATES } from '../../src/lib/validate.js'
import { decorateEvent } from '../../src/lib/eventState.js'
import { checkEvent } from '../../src/lib/eventRules.js'
import { DEFAULT_SETTINGS } from './defaults.js'
import { buildPaymentUrl, verifyResponse } from './services/eazypay.js'
import { saveEventImage, deleteEventImage, MAX_UPLOAD } from './services/images.js'

const httpError = (status, message, extra) => Object.assign(new Error(message), { status, ...extra })
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timeStr = z.string().regex(/^\d{2}:\d{2}$/)
const money = z.coerce.number().min(0).max(1_000_000)
const cat = z.object({ enabled: z.boolean(), fee: money })

const EventInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(5000).default(''),
    venue: z.string().trim().min(1).max(300),
    startDate: dateStr,
    endDate: z.union([dateStr, z.literal('')]).optional(),
    startTime: timeStr,
    endTime: z.union([timeStr, z.literal('')]).optional(),
    categories: z.object({ member: cat, nonMember: cat, student: cat }),
    seats: z.coerce.number().int().min(1).max(100000),
    maxPerBooking: z.coerce.number().int().min(1).max(50),
    bulk: z.object({ enabled: z.boolean(), minQty: z.coerce.number().int().min(1).max(50), type: z.enum(['percent', 'amount']), value: z.coerce.number().min(0).max(1_000_000) }),
    bookingOpens: z.union([dateStr, z.literal('')]).default(''),
    closesAt: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), z.literal('')]).default(''),
    status: z.enum(['open', 'paused', 'closed']),
    cpeHours: z.string().max(40).default(''),
    speakers: z.string().max(300).default(''),
  })
  .strip()

const str = (max) => z.string().max(max).default('')
const BookingInput = z.object({
  eventId: z.coerce.number().int(),
  category: z.enum(['member', 'nonMember', 'student']),
  contact: z.object({ firm: str(200), address: str(400), city: str(100), pincode: str(10), state: str(60), phone: str(20), email: str(200), gstin: str(20) }),
  participants: z
    .array(z.object({ name: str(120), email: str(200), mobile: str(20), gender: str(10), idNumber: str(20) }))
    .min(1)
    .max(50),
})

const SettingsInput = z
  .object({
    gstRate: z.coerce.number().min(0).max(28),
    bookingPrefix: z.string().regex(/^[A-Z]{2,10}$/),
    memberContact: z.object({ phone: str(30), email: str(200) }),
    studentContact: z.object({ phone: str(30), email: str(200) }),
  })
  .strip()

function bookingErrors(category, people, contact) {
  const err = {}
  people.forEach((p, i) => {
    if (category === 'member') err[`p${i}.memberId`] = rules.memberId(p.idNumber)
    if (category === 'student') err[`p${i}.studentId`] = rules.studentId(p.idNumber)
    err[`p${i}.name`] = rules.name(p.name)
    err[`p${i}.email`] = rules.email(p.email)
    err[`p${i}.mobile`] = rules.mobile(p.mobile)
    err[`p${i}.gender`] = ['Male', 'Female'].includes(p.gender) ? '' : 'Choose one'
  })
  if (category !== 'nonMember') {
    const seen = new Map()
    people.forEach((p, i) => {
      const v = p.idNumber.trim().toUpperCase()
      if (v && seen.has(v)) err[`p${i}.idNumber`] = `Same number as participant ${seen.get(v) + 1}`
      else seen.set(v, i)
    })
  }
  err['c.firm'] = rules.required(contact.firm)
  err['c.address'] = rules.required(contact.address)
  err['c.city'] = rules.required(contact.city)
  err['c.pincode'] = rules.pincode(contact.pincode)
  err['c.state'] = STATES.includes(contact.state) ? '' : 'Choose a state'
  err['c.phone'] = rules.mobile(contact.phone)
  err['c.email'] = rules.email(contact.email)
  if (gstAppliesTo(category)) err['c.gstin'] = rules.gstin(contact.gstin)
  for (const k of Object.keys(err)) if (!err[k]) delete err[k]
  return err
}

export function createApp({ cfg, db, mailer, log = console }) {
  const app = express()
  if (cfg.trustProxy) app.set('trust proxy', 1)
  app.disable('x-powered-by')
  // Images are shown on the front end's own domain, so they must be loadable cross-origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(
    '/api',
    cors({
      origin: (origin, cb) => cb(null, !origin || cfg.corsOrigins.includes(origin) ? true : false),
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  )
  app.use(express.json({ limit: '200kb' }))
  // Eazypay posts its reply as a normal form.
  app.use('/api/payments/eazypay', express.urlencoded({ extended: false, limit: '50kb' }))
  app.use('/uploads', express.static(cfg.uploadDir, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }))

  const limiter = (max, minutes) => rateLimit({ windowMs: minutes * 60_000, limit: max, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many tries. Please wait a few minutes.' } })
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD, files: 1 } })

  // ---------- helpers ----------
  const getSettings = async () => ({ ...DEFAULT_SETTINGS, ...((await db.settings.get()) || {}) })
  const imageUrl = (name) => (name ? `${cfg.publicApiUrl}/uploads/${name}` : null)
  const publicEvent = (e) => {
    const d = decorateEvent(e, e.seatsTaken || 0)
    const { seatsTaken, image, ...rest } = d
    return { ...rest, imageUrl: imageUrl(image) }
  }
  const bookingLink = (b) => `${cfg.frontendUrl}/#/booking/${b.id}?k=${b.accessKey}`

  async function settle(id, success, payment) {
    // Only one caller can move a booking out of "pending", so seats are never taken twice.
    const claimed = await db.bookings.updateIfStatus(id, 'pending', { status: 'processing' })
    if (!claimed) return db.bookings.get(id)
    let done
    if (success) {
      const took = await db.events.takeSeats(claimed.eventId, claimed.participants.length)
      if (took) done = await db.bookings.updateIfStatus(id, 'processing', { status: 'paid', payment })
      else
        done = await db.bookings.updateIfStatus(id, 'processing', {
          status: 'failed',
          payment: { ...payment, note: 'Seats ran out before payment finished. The branch will refund this payment.', needsRefund: cfg.payment.mode !== 'test' },
        })
    } else {
      done = await db.bookings.updateIfStatus(id, 'processing', { status: 'failed', payment })
    }
    if (done?.status === 'paid') await sendPaidEmails(done)
    return done
  }

  async function sendPaidEmails(b) {
    try {
      const e = await db.events.get(b.eventId)
      const results = await mailer.bookingPaid(b, e, bookingLink(b))
      results.filter((r) => r.status === 'rejected').forEach((r) => log.error('email failed:', r.reason?.message))
    } catch (x) {
      log.error('email failed:', x.message)
    }
  }

  const auth = (...roles) =>
    wrap(async (req, _res, next) => {
      const h = req.get('authorization') || ''
      const token = h.startsWith('Bearer ') ? h.slice(7) : ''
      try {
        req.user = jwt.verify(token, cfg.jwtSecret, { algorithms: ['HS256'] })
      } catch {
        throw httpError(401, 'Please log in again.')
      }
      if (roles.length && !roles.includes(req.user.role)) throw httpError(403, 'Your login cannot do this.')
      next()
    })

  // ---------- public ----------
  app.get('/api/health', (_req, res) => res.json({ ok: true, db: db.driver, payment: cfg.payment.mode }))

  app.get(
    '/api/settings',
    wrap(async (_req, res) => {
      const s = await getSettings()
      res.json({ gstRate: s.gstRate, memberContact: s.memberContact, studentContact: s.studentContact, paymentMode: cfg.payment.mode, emailEnabled: mailer.enabled })
    }),
  )

  app.get(
    '/api/events',
    wrap(async (_req, res) => {
      const list = (await db.events.list()).map(publicEvent)
      res.json(list)
    }),
  )

  app.get(
    '/api/events/:id',
    wrap(async (req, res) => {
      const e = await db.events.get(req.params.id)
      if (!e) throw httpError(404, 'Event not found.')
      res.json(publicEvent(e))
    }),
  )

  app.post(
    '/api/bookings',
    limiter(30, 10),
    wrap(async (req, res) => {
      const parsed = BookingInput.safeParse(req.body)
      if (!parsed.success) throw httpError(400, 'Some details are missing or wrong.')
      const { eventId, category, contact, participants } = parsed.data
      const raw = await db.events.get(eventId)
      if (!raw) throw httpError(404, 'This event no longer exists.')
      const e = decorateEvent(raw, raw.seatsTaken || 0)
      if (e.state !== 'open') throw httpError(409, 'Registration for this event is not open.')
      if (!enabledCategories(e).includes(category)) throw httpError(400, 'That category is not allowed for this event.')
      if (participants.length > e.maxNow) throw httpError(409, `You can book up to ${e.maxNow} people for this event.`)
      const fieldErrors = bookingErrors(category, participants, contact)
      if (Object.keys(fieldErrors).length) throw httpError(400, 'Some details need fixing.', { fields: fieldErrors })

      const s = await getSettings()
      const price = calcPrice(e, category, participants.length, s.gstRate)
      const seq = await db.counters.next('booking', 158186)
      const booking = {
        id: s.bookingPrefix + String(seq).padStart(s.bookingDigits || 8, '0'),
        accessKey: crypto.randomBytes(16).toString('base64url'),
        eventId: e.id,
        eventTitle: e.title,
        category,
        contact: {
          ...contact,
          email: contact.email.trim().toLowerCase(),
          gstin: gstAppliesTo(category) ? contact.gstin.trim().toUpperCase() : '',
        },
        participants: participants.map((p) => ({
          name: p.name.trim(),
          email: p.email.trim().toLowerCase(),
          mobile: p.mobile.replace(/\D/g, '').slice(-10),
          gender: p.gender,
          idNumber: category === 'nonMember' ? '' : p.idNumber.trim().toUpperCase(),
        })),
        price,
        status: 'pending',
        payment: null,
        createdAt: new Date().toISOString(),
      }
      await db.bookings.create(booking)

      if (price.total === 0) {
        const done = await settle(booking.id, true, { method: 'Free event', ref: '', at: new Date().toISOString() })
        if (done.status !== 'paid') throw httpError(409, done.payment?.note || 'This event just filled up.')
        return res.status(201).json({ booking: done, payment: { mode: 'none' } })
      }
      if (cfg.payment.mode === 'eazypay') {
        const url = buildPaymentUrl(booking, cfg.payment.eazypay, `${cfg.publicApiUrl}/api/payments/eazypay/return`)
        return res.status(201).json({ booking, payment: { mode: 'eazypay', url } })
      }
      res.status(201).json({ booking, payment: { mode: 'test' } })
    }),
  )

  app.get(
    '/api/bookings/:id',
    wrap(async (req, res) => {
      const b = await db.bookings.get(req.params.id)
      const k = String(req.query.k || '')
      if (!b || !k || !crypto.timingSafeEqual(Buffer.from(b.accessKey.padEnd(64)), Buffer.from(k.padEnd(64).slice(0, 64)))) throw httpError(404, 'Booking not found.')
      res.json(b)
    }),
  )

  app.post(
    '/api/bookings/find',
    limiter(20, 10),
    wrap(async (req, res) => {
      const id = String(req.body?.id || '').trim().toUpperCase()
      const who = String(req.body?.who || '').trim().toLowerCase()
      const b = id && who ? await db.bookings.get(id) : null
      const ok = b && (b.contact.email === who || (who.replace(/\D/g, '').length >= 10 && b.contact.phone.replace(/\D/g, '').slice(-10) === who.replace(/\D/g, '').slice(-10)))
      if (!ok) throw httpError(404, 'We could not find a booking with those details.')
      res.json({ id: b.id, accessKey: b.accessKey })
    }),
  )

  app.post(
    '/api/interest',
    limiter(20, 10),
    wrap(async (req, res) => {
      const body = z.object({ eventId: z.coerce.number().int(), name: str(120), email: str(200), mobile: str(20) }).safeParse(req.body)
      if (!body.success) throw httpError(400, 'Some details are missing.')
      const { eventId, name, email, mobile } = body.data
      const errs = { name: rules.name(name), email: rules.email(email), mobile: rules.mobile(mobile) }
      for (const k of Object.keys(errs)) if (!errs[k]) delete errs[k]
      if (Object.keys(errs).length) throw httpError(400, 'Some details need fixing.', { fields: errs })
      const e = await db.events.get(eventId)
      if (!e) throw httpError(404, 'Event not found.')
      const item = await db.interest.add({ eventId, eventTitle: e.title, name: name.trim(), email: email.trim().toLowerCase(), mobile: mobile.replace(/\D/g, '').slice(-10) })
      res.status(201).json({ ok: true, id: item.id })
    }),
  )

  // ---------- payments ----------
  app.post(
    '/api/payments/test/:id',
    limiter(30, 10),
    wrap(async (req, res) => {
      if (cfg.payment.mode !== 'test') throw httpError(404, 'Not found.')
      const b = await db.bookings.get(req.params.id)
      if (!b || b.accessKey !== String(req.body?.k || '')) throw httpError(404, 'Booking not found.')
      const ok = req.body?.success === true
      const done = await settle(b.id, ok, {
        method: 'ICICI Eazypay (test mode)',
        ref: ok ? 'TEST' + Date.now().toString().slice(-9) : '',
        at: new Date().toISOString(),
        note: ok ? undefined : 'Payment was not completed.',
      })
      res.json(done)
    }),
  )

  app.post(
    '/api/payments/eazypay/return',
    wrap(async (req, res) => {
      const v = verifyResponse(req.body || {}, cfg.payment.eazypay)
      const b = v.ref ? await db.bookings.get(v.ref) : null
      if (!b) {
        log.error('eazypay return for unknown booking', v.ref, v.reason || '')
        return res.redirect(303, `${cfg.frontendUrl}/#/find`)
      }
      if (!v.ok) {
        // Never change a booking on a reply that fails the hash check.
        log.error('eazypay reply rejected for', b.id, v.reason)
        return res.redirect(303, bookingLink(b))
      }
      const amountOk = Math.abs(v.amount - b.price.total) < 0.01
      await settle(b.id, v.paid && amountOk, {
        method: `ICICI Eazypay${v.mode ? ` (${v.mode})` : ''}`,
        ref: v.bankRef,
        code: v.code,
        at: new Date().toISOString(),
        note: !v.paid ? `Bank response ${v.code}. Payment was not completed.` : amountOk ? undefined : 'Amount from the bank does not match the booking. Please contact the branch.',
      })
      res.redirect(303, bookingLink(b))
    }),
  )

  // ---------- admin ----------
  app.post(
    '/api/admin/login',
    limiter(10, 15),
    wrap(async (req, res) => {
      const email = String(req.body?.email || '').trim().toLowerCase()
      const password = String(req.body?.password || '')
      const u = email ? await db.users.findByEmail(email) : null
      // Compare even when the user does not exist, so timing does not reveal valid emails.
      const ok = await bcrypt.compare(password, u?.passwordHash || '$2a$12$0000000000000000000000000000000000000000000000000000.')
      if (!u || !ok) throw httpError(401, 'Email or password is wrong.')
      const user = { email: u.email, name: u.name, role: u.role }
      const token = jwt.sign({ sub: u.email, name: u.name, role: u.role }, cfg.jwtSecret, { algorithm: 'HS256', expiresIn: `${cfg.jwtHours}h` })
      res.json({ token, user })
    }),
  )

  app.get('/api/admin/me', auth(), (req, res) => res.json({ email: req.user.sub, name: req.user.name, role: req.user.role }))

  app.get(
    '/api/admin/events',
    auth('admin', 'accounts'),
    wrap(async (_req, res) => {
      res.json((await db.events.list()).map(publicEvent))
    }),
  )

  async function eventFromBody(body, existing) {
    const parsed = EventInput.safeParse(body)
    if (!parsed.success) throw httpError(400, 'Some event details are missing or wrong.', { issues: parsed.error.issues.map((i) => i.path.join('.')) })
    const f = parsed.data
    const out = { ...f, endDate: f.endDate || f.startDate, endTime: f.endTime || '' }
    const problems = checkEvent(out, existing?.seatsTaken || 0)
    // bookedBefore lives on the stored event, so check seats against it here
    if (existing && out.seats < (existing.bookedBefore || 0) + (existing.seatsTaken || 0)) problems.seats = `${(existing.bookedBefore || 0) + (existing.seatsTaken || 0)} seats are already booked`
    if (Object.keys(problems).length) throw httpError(400, 'Some event details need fixing.', { fields: problems })
    return out
  }

  app.post(
    '/api/admin/events',
    auth('admin'),
    wrap(async (req, res) => {
      const data = await eventFromBody(req.body)
      const code = String((await db.events.maxCode()) + 1)
      const e = await db.events.create({ ...data, code })
      res.status(201).json(publicEvent(e))
    }),
  )

  app.put(
    '/api/admin/events/:id',
    auth('admin'),
    wrap(async (req, res) => {
      const existing = await db.events.get(req.params.id)
      if (!existing) throw httpError(404, 'Event not found.')
      const data = await eventFromBody(req.body, existing)
      res.json(publicEvent(await db.events.update(existing.id, data)))
    }),
  )

  app.delete(
    '/api/admin/events/:id',
    auth('admin'),
    wrap(async (req, res) => {
      const e = await db.events.get(req.params.id)
      if (!e) throw httpError(404, 'Event not found.')
      if (await db.bookings.existsForEvent(e.id)) throw httpError(409, 'This event has bookings, so it can only be closed, not deleted.')
      await db.events.remove(e.id)
      await deleteEventImage(e.image, cfg.uploadDir)
      res.json({ ok: true })
    }),
  )

  app.post(
    '/api/admin/events/:id/image',
    auth('admin'),
    (req, res, next) =>
      upload.single('image')(req, res, (err) => {
        if (err) return next(httpError(400, err.code === 'LIMIT_FILE_SIZE' ? 'That image is over 8 MB. Please use a smaller one.' : 'Upload failed.'))
        next()
      }),
    wrap(async (req, res) => {
      const e = await db.events.get(req.params.id)
      if (!e) throw httpError(404, 'Event not found.')
      if (!req.file) throw httpError(400, 'No image was sent.')
      const name = await saveEventImage(req.file.buffer, req.file.mimetype, cfg.uploadDir)
      await db.events.update(e.id, { image: name })
      await deleteEventImage(e.image, cfg.uploadDir)
      res.json({ imageUrl: imageUrl(name) })
    }),
  )

  app.post(
    '/api/admin/events/:id/image/copy-from/:from',
    auth('admin'),
    wrap(async (req, res) => {
      const [to, from] = await Promise.all([db.events.get(req.params.id), db.events.get(req.params.from)])
      if (!to || !from) throw httpError(404, 'Event not found.')
      if (!from.image) return res.json({ imageUrl: null })
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const buf = await fs.readFile(path.join(cfg.uploadDir, from.image))
      const name = await saveEventImage(buf, 'image/webp', cfg.uploadDir)
      await db.events.update(to.id, { image: name })
      res.json({ imageUrl: imageUrl(name) })
    }),
  )

  app.delete(
    '/api/admin/events/:id/image',
    auth('admin'),
    wrap(async (req, res) => {
      const e = await db.events.get(req.params.id)
      if (!e) throw httpError(404, 'Event not found.')
      await db.events.update(e.id, { image: null })
      await deleteEventImage(e.image, cfg.uploadDir)
      res.json({ ok: true })
    }),
  )

  app.get(
    '/api/admin/bookings',
    auth('admin', 'accounts'),
    wrap(async (_req, res) => {
      res.json(await db.bookings.list())
    }),
  )

  app.get(
    '/api/admin/interest',
    auth('admin'),
    wrap(async (_req, res) => {
      res.json(await db.interest.list())
    }),
  )

  app.get(
    '/api/admin/settings',
    auth('admin'),
    wrap(async (_req, res) => res.json(await getSettings())),
  )

  app.put(
    '/api/admin/settings',
    auth('admin'),
    wrap(async (req, res) => {
      const parsed = SettingsInput.safeParse(req.body)
      if (!parsed.success) throw httpError(400, 'Some settings are wrong.')
      const s = { ...(await getSettings()), ...parsed.data }
      await db.settings.save(s)
      res.json(s)
    }),
  )

  // ---------- errors ----------
  app.use('/api', (_req, _res, next) => next(httpError(404, 'Not found.')))
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : 500)
    if (status >= 500) log.error(err)
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message, ...(err.fields ? { fields: err.fields } : {}) })
  })

  return app
}

export { CATEGORY_ORDER }
