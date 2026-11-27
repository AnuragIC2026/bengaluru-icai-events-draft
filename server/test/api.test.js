import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import sharp from 'sharp'
import nodemailer from 'nodemailer'
import { loadConfig } from '../src/config.js'
import { createMemoryDb } from '../src/db/memory.js'
import { createMailer } from '../src/services/mailer.js'
import { createApp } from '../src/app.js'
import { seed } from '../src/seed.js'
import { responseHash, decrypt } from '../src/services/eazypay.js'

let app, db, cfg, mailer, adminToken, managerToken, eventId
const quiet = { error() {}, log() {} }

const futureEvent = (over = {}) => ({
  title: 'Test Seminar on GST',
  description: 'Topic: test',
  venue: 'ICAI Bhawan, Vasanthnagar',
  startDate: '2030-06-15',
  endDate: '',
  startTime: '10:00',
  endTime: '13:00',
  categories: { member: { enabled: true, fee: 500 }, nonMember: { enabled: true, fee: 1000 }, student: { enabled: false, fee: 0 } },
  seats: 6,
  maxPerBooking: 5,
  bulk: { enabled: true, minQty: 3, type: 'percent', value: 10 },
  bookingOpens: '',
  closesAt: '',
  status: 'open',
  cpeHours: '3',
  speakers: '',
  ...over,
})

const person = (i, over = {}) => ({ name: `Test Person ${i}`, email: `p${i}@example.com`, mobile: `98450000${String(i).padStart(2, '0')}`, gender: 'Female', idNumber: String(100000 + i), ...over })
const contact = { firm: 'Example and Co', address: '12 MG Road', city: 'Bengaluru', pincode: '560001', state: 'Karnataka', phone: '9845000011', email: 'accounts@example.com', gstin: '29ABCDE1234F1Z5' }

before(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'evapi-'))
  cfg = loadConfig({
    JWT_SECRET: 'x'.repeat(40),
    UPLOAD_DIR: dir,
    FRONTEND_URL: 'https://example.github.io/portal',
    PUBLIC_API_URL: 'https://api.example.org',
    ADMIN_EMAIL: 'admin@test.in',
    ADMIN_PASSWORD: 'admin-pass-123',
    MANAGER_EMAIL: 'manager@test.in',
    MANAGER_PASSWORD: 'manager-pass-123',
    PAYMENT_MODE: 'test',
    EAZYPAY_MERCHANT_ID: '123456',
    EAZYPAY_SUB_MERCHANT_ID: '45',
    EAZYPAY_AES_KEY: '1234567890123456',
  })
  db = createMemoryDb()
  await seed(db, cfg, { quiet: true })
  mailer = createMailer(cfg, { transport: nodemailer.createTransport({ jsonTransport: true }) })
  app = createApp({ cfg, db, mailer, log: quiet })
})

test('health and events', async () => {
  const h = await request(app).get('/api/health').expect(200)
  assert.equal(h.body.db, 'memory')
  const r = await request(app).get('/api/events').expect(200)
  assert.equal(r.body.length, 22)
  const e = r.body.find((x) => x.id === 28396)
  assert.equal(e.title, 'RRC in Gift City')
  assert.ok(e.imageUrl.startsWith('https://api.example.org/uploads/sample-28396'))
  assert.equal(e.seatsTaken, undefined)
  assert.equal(e.booked, 2)
})

test('login and roles', async () => {
  await request(app).post('/api/admin/login').send({ email: 'admin@test.in', password: 'wrong' }).expect(401)
  const a = await request(app).post('/api/admin/login').send({ email: 'ADMIN@test.in', password: 'admin-pass-123' }).expect(200)
  adminToken = a.body.token
  assert.equal(a.body.user.role, 'admin')
  const b = await request(app).post('/api/admin/login').send({ email: 'manager@test.in', password: 'manager-pass-123' }).expect(200)
  assert.equal(b.body.user.role, 'manager')
  managerToken = b.body.token
  await request(app).get('/api/admin/bookings').expect(401)
  await request(app).get('/api/admin/bookings').set('Authorization', `Bearer ${managerToken}`).expect(200)
  await request(app).post('/api/admin/events').set('Authorization', `Bearer ${managerToken}`).send(futureEvent()).expect(403)
  await request(app).get('/api/admin/settings').set('Authorization', `Bearer ${managerToken}`).expect(403)
  await request(app).get('/api/admin/interest').set('Authorization', `Bearer ${managerToken}`).expect(403)
})

test('admin creates an event with the same checks as the form', async () => {
  const bad = await request(app).post('/api/admin/events').set('Authorization', `Bearer ${adminToken}`).send(futureEvent({ bulk: { enabled: true, minQty: 9, type: 'percent', value: 10 } })).expect(400)
  assert.match(bad.body.fields['bulk.minQty'], /limit of 5/)
  const r = await request(app).post('/api/admin/events').set('Authorization', `Bearer ${adminToken}`).send(futureEvent()).expect(201)
  eventId = r.body.id
  assert.equal(r.body.state, 'open')
  assert.equal(r.body.seatsLeft, 6)
  assert.ok(Number(r.body.code) > 1440)
})

test('booking checks the details on the server', async () => {
  const r = await request(app)
    .post('/api/bookings')
    .send({ eventId, category: 'member', contact: { ...contact, pincode: '12' }, participants: [person(1, { idNumber: '12' }), person(2, { idNumber: '12' })] })
    .expect(400)
  assert.ok(r.body.fields['c.pincode'])
  assert.ok(r.body.fields['p0.memberId'])
  await request(app).post('/api/bookings').send({ eventId, category: 'student', contact, participants: [person(1)] }).expect(400)
  await request(app).post('/api/bookings').send({ eventId, category: 'member', contact, participants: [1, 2, 3, 4, 5, 6].map((i) => person(i)) }).expect(409)
  // PAN is optional, but checked when given
  const badPan = await request(app).post('/api/bookings').send({ eventId, category: 'member', contact: { ...contact, pan: 'ABC12' }, participants: [person(1)] }).expect(400)
  assert.ok(badPan.body.fields['c.pan'])
})

test('group discount, test payment, seats and emails', async () => {
  const r = await request(app).post('/api/bookings').send({ eventId, category: 'member', contact, participants: [1, 2, 3].map((i) => person(i)) }).expect(201)
  const b = r.body.booking
  assert.equal(r.body.payment.mode, 'test')
  assert.equal(b.price.discount, 150)
  assert.equal(b.price.total, 1593)
  assert.match(b.id, /^EICAI\d{8}$/)
  assert.equal(b.id, 'EICAI00158187')
  await request(app).get(`/api/bookings/${b.id}`).expect(404)
  await request(app).get(`/api/bookings/${b.id}?k=wrong`).expect(404)
  await request(app).post(`/api/payments/test/${b.id}`).send({ k: 'wrong', success: true }).expect(404)
  const paid = await request(app).post(`/api/payments/test/${b.id}`).send({ k: b.accessKey, success: true }).expect(200)
  assert.equal(paid.body.status, 'paid')
  // paying twice changes nothing
  await request(app).post(`/api/payments/test/${b.id}`).send({ k: b.accessKey, success: true }).expect(200)
  const e = await request(app).get(`/api/events/${eventId}`).expect(200)
  assert.equal(e.body.seatsLeft, 3)
  assert.equal(mailer.sent.length, 4)
  assert.equal(mailer.sent[0].to, 'accounts@example.com')
  assert.match(mailer.sent[0].html, /1,593\.00/)
  const got = await request(app).get(`/api/bookings/${b.id}?k=${b.accessKey}`).expect(200)
  assert.equal(got.body.status, 'paid')
  const f = await request(app).post('/api/bookings/find').send({ id: b.id.toLowerCase(), who: '98450 00011' }).expect(200)
  assert.equal(f.body.accessKey, b.accessKey)
  await request(app).post('/api/bookings/find').send({ id: b.id, who: 'someone@else.com' }).expect(404)
})

test('failed payment does not take seats; seats running out fails safely', async () => {
  const one = await request(app).post('/api/bookings').send({ eventId, category: 'nonMember', contact, participants: [person(7, { idNumber: '' })] }).expect(201)
  await request(app).post(`/api/payments/test/${one.body.booking.id}`).send({ k: one.body.booking.accessKey, success: false }).expect(200)
  assert.equal((await request(app).get(`/api/events/${eventId}`)).body.seatsLeft, 3)
  // two people start booking the last 3 seats at the same time
  const a = await request(app).post('/api/bookings').send({ eventId, category: 'member', contact, participants: [4, 5, 6].map((i) => person(i)) }).expect(201)
  const b = await request(app).post('/api/bookings').send({ eventId, category: 'member', contact, participants: [7, 8].map((i) => person(i)) }).expect(201)
  const pa = await request(app).post(`/api/payments/test/${a.body.booking.id}`).send({ k: a.body.booking.accessKey, success: true })
  const pb = await request(app).post(`/api/payments/test/${b.body.booking.id}`).send({ k: b.body.booking.accessKey, success: true })
  assert.equal(pa.body.status, 'paid')
  assert.equal(pb.body.status, 'failed')
  assert.match(pb.body.payment.note, /Seats ran out/)
  const e = (await request(app).get(`/api/events/${eventId}`)).body
  assert.equal(e.seatsLeft, 0)
  assert.equal(e.state, 'full')
  await request(app).post('/api/bookings').send({ eventId, category: 'member', contact, participants: [person(9)] }).expect(409)
  await request(app).delete(`/api/admin/events/${eventId}`).set('Authorization', `Bearer ${adminToken}`).expect(409)
  // seats can't be set below what is sold
  const low = await request(app).put(`/api/admin/events/${eventId}`).set('Authorization', `Bearer ${adminToken}`).send(futureEvent({ seats: 4 })).expect(400)
  assert.match(low.body.fields.seats, /6 seats are already booked/)
})

test('free events confirm straight away', async () => {
  const r = await request(app).post('/api/admin/events').set('Authorization', `Bearer ${adminToken}`).send(futureEvent({ title: 'Free talk', categories: { member: { enabled: true, fee: 0 }, nonMember: { enabled: true, fee: 0 }, student: { enabled: true, fee: 0 } }, bulk: { enabled: false, minQty: 3, type: 'percent', value: 10 } })).expect(201)
  const b = await request(app).post('/api/bookings').send({ eventId: r.body.id, category: 'student', contact, participants: [person(1, { idNumber: 'sro0123456' })] }).expect(201)
  assert.equal(b.body.booking.status, 'paid')
  assert.equal(b.body.booking.participants[0].idNumber, 'SRO0123456')
  assert.equal(b.body.booking.contact.gstin, '')
})

test('image upload, copy and remove', async () => {
  const png = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#0C3D9E' } }).png().toBuffer()
  await request(app).post(`/api/admin/events/${eventId}/image`).set('Authorization', `Bearer ${adminToken}`).attach('image', Buffer.from('GIF89a'), { filename: 'x.gif', contentType: 'image/gif' }).expect(400)
  const up = await request(app).post(`/api/admin/events/${eventId}/image`).set('Authorization', `Bearer ${adminToken}`).attach('image', png, { filename: 'p.png', contentType: 'image/png' }).expect(200)
  const name = up.body.imageUrl.split('/').pop()
  const meta = await sharp(path.join(cfg.uploadDir, name)).metadata()
  assert.equal(meta.format, 'webp')
  assert.equal(meta.width, 1400)
  await request(app).get(`/uploads/${name}`).expect(200).expect('cross-origin-resource-policy', 'cross-origin')
  await request(app).delete(`/api/admin/events/${eventId}/image`).set('Authorization', `Bearer ${adminToken}`).expect(200)
  assert.equal((await request(app).get(`/api/events/${eventId}`)).body.imageUrl, null)
})

test('settings and interest list', async () => {
  await request(app).put('/api/admin/settings').set('Authorization', `Bearer ${adminToken}`).send({ gstRate: 50, bookingPrefix: 'EICAI', memberContact: { phone: '', email: '' }, studentContact: { phone: '', email: '' } }).expect(400)
  await request(app).post('/api/interest').send({ eventId: 28387, name: 'Late Person', email: 'late@example.com', mobile: '9845000077' }).expect(201)
  const l = await request(app).get('/api/admin/interest').set('Authorization', `Bearer ${adminToken}`).expect(200)
  assert.equal(l.body[0].eventTitle, (await db.events.get(28387)).title)
  assert.equal(l.body[0].mobile, '9845000077')
})

test('Eazypay: payment link, good reply, forged reply, wrong amount', async () => {
  const live = loadConfig({ ...process.env, JWT_SECRET: 'y'.repeat(40), UPLOAD_DIR: cfg.uploadDir, FRONTEND_URL: 'https://example.github.io/portal', PUBLIC_API_URL: 'https://api.example.org', PAYMENT_MODE: 'eazypay', EAZYPAY_MERCHANT_ID: '123456', EAZYPAY_SUB_MERCHANT_ID: '45', EAZYPAY_AES_KEY: '1234567890123456' })
  const liveApp = createApp({ cfg: live, db, mailer, log: quiet })
  const ev = await request(liveApp).post('/api/admin/events').set('Authorization', `Bearer ${adminToken}`)
  assert.equal(ev.status, 401) // different secret, old token is not valid
  const e2 = await db.events.create({ ...futureEvent({ title: 'Live payment test', seats: 50 }), code: '9999', endDate: '2030-06-15' })
  const r = await request(liveApp).post('/api/bookings').send({ eventId: e2.id, category: 'member', contact, participants: [person(1)] }).expect(201)
  const { booking, payment } = r.body
  assert.equal(payment.mode, 'eazypay')
  const url = new URL(payment.url)
  assert.equal(url.origin + url.pathname, 'https://eazypay.icicibank.com/EazyPG')
  assert.equal(url.searchParams.get('merchantid'), '123456')
  assert.equal(decrypt(url.searchParams.get('Reference No'), '1234567890123456'), booking.id)
  assert.equal(decrypt(url.searchParams.get('transaction amount'), '1234567890123456'), '590.00')
  assert.equal(decrypt(url.searchParams.get('mandatory fields'), '1234567890123456'), `${booking.id}|45|590.00`)
  assert.equal(decrypt(url.searchParams.get('returnurl'), '1234567890123456'), 'https://api.example.org/api/payments/eazypay/return')

  const reply = (over) => {
    const body = { ID: '123456', 'Response Code': 'E000', 'Unique Ref Number': '2611251234567', 'Service Tax Amount': '0.00', 'Processing Fee Amount': '0.00', 'Total Amount': '590.00', 'Transaction Amount': '590.00', 'Transaction Date': '25-11-2026 15:40:00', 'Interchange Value': '', TDR: '', 'Payment Mode': 'UPI', SubMerchantId: '45', ReferenceNo: booking.id, TPS: 'Y', ...over }
    body.RS = responseHash(body, '1234567890123456')
    return body
  }
  // forged: hash made without the key
  const forged = { ...reply({}), RS: 'abc' }
  const f = await request(liveApp).post('/api/payments/eazypay/return').type('form').send(forged).expect(303)
  assert.match(f.headers.location, new RegExp(`#/booking/${booking.id}\\?k=`))
  const afterForged = await db.bookings.get(booking.id)
  assert.equal(afterForged.status, 'pending')
  assert.match(afterForged.payment.message, /security check/)
  // genuine success
  await request(liveApp).post('/api/payments/eazypay/return').type('form').send(reply({})).expect(303)
  const b = await db.bookings.get(booking.id)
  assert.equal(b.status, 'paid')
  assert.equal(b.payment.ref, '2611251234567')
  assert.equal(b.payment.mode, 'UPI')
  assert.equal(b.payment.code, 'E000')
  assert.equal(b.payment.amount, 590)
  // declined by the bank: kept as a failed registration with the reason
  const r3 = await request(liveApp).post('/api/bookings').send({ eventId: e2.id, category: 'member', contact: { ...contact, pan: 'abcde1234f' }, participants: [person(3)] }).expect(201)
  await request(liveApp).post('/api/payments/eazypay/return').type('form').send(reply({ ReferenceNo: r3.body.booking.id, 'Response Code': 'E0815', 'Unique Ref Number': '2611259999999' })).expect(303)
  const b3 = await db.bookings.get(r3.body.booking.id)
  assert.equal(b3.status, 'failed')
  assert.equal(b3.payment.message, 'Not enough balance')
  assert.equal(b3.payment.ref, '2611259999999')
  assert.equal(b3.contact.pan, 'ABCDE1234F')
  // wrong amount on another booking
  const r2 = await request(liveApp).post('/api/bookings').send({ eventId: e2.id, category: 'member', contact, participants: [person(2)] }).expect(201)
  const bad = reply({ ReferenceNo: r2.body.booking.id, 'Total Amount': '1.00', 'Transaction Amount': '1.00' })
  await request(liveApp).post('/api/payments/eazypay/return').type('form').send(bad).expect(303)
  const b2 = await db.bookings.get(r2.body.booking.id)
  assert.equal(b2.status, 'failed')
  assert.match(b2.payment.note, /does not match/)
  // the test payment route is off in live mode
  await request(liveApp).post(`/api/payments/test/${r2.body.booking.id}`).send({ k: r2.body.booking.accessKey, success: true }).expect(404)
})

test('unknown routes and bad JSON', async () => {
  await request(app).get('/api/nothing').expect(404)
  await request(app).post('/api/bookings').set('Content-Type', 'application/json').send('{bad').expect(400)
})

after(async () => {
  await fs.rm(cfg.uploadDir, { recursive: true, force: true })
})
