// MongoDB storage through Mongoose. Same functions as db/memory.js.
import mongoose from 'mongoose'

const { Schema } = mongoose
const Mixed = Schema.Types.Mixed
const opts = { versionKey: false, minimize: false }

const Category = { enabled: Boolean, fee: Number }

const EventSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    code: String,
    title: String,
    description: String,
    venue: String,
    startDate: String,
    endDate: String,
    startTime: String,
    endTime: String,
    categories: { member: Category, nonMember: Category, student: Category },
    seats: Number,
    bookedBefore: { type: Number, default: 0 },
    seatsTaken: { type: Number, default: 0 },
    maxPerBooking: Number,
    bulk: { enabled: Boolean, minQty: Number, type: { type: String }, value: Number },
    bookingOpens: String,
    closesAt: String,
    status: String,
    cpeHours: String,
    speakers: String,
    image: { type: String, default: null },
    createdAt: String,
    updatedAt: String,
  },
  opts,
)

const BookingSchema = new Schema(
  {
    id: { type: String, unique: true, index: true },
    accessKey: String,
    eventId: { type: Number, index: true },
    eventTitle: String,
    category: String,
    contact: Mixed,
    participants: [Mixed],
    price: Mixed,
    status: { type: String, index: true },
    payment: Mixed,
    createdAt: { type: String, index: true },
  },
  opts,
)

const InterestSchema = new Schema({ id: String, eventId: Number, eventTitle: String, name: String, email: String, mobile: String, createdAt: String }, opts)
const SettingsSchema = new Schema({ key: { type: String, unique: true }, value: Mixed }, opts)
const UserSchema = new Schema({ email: { type: String, unique: true }, name: String, role: String, passwordHash: String }, opts)
const CounterSchema = new Schema({ name: { type: String, unique: true }, seq: Number }, opts)

const plain = (doc) => {
  if (!doc) return null
  const o = doc.toObject ? doc.toObject() : { ...doc }
  delete o._id
  return o
}

export function createMongoDb(uri) {
  const conn = mongoose.createConnection()
  const Event = conn.model('Event', EventSchema)
  const Booking = conn.model('Booking', BookingSchema)
  const Interest = conn.model('Interest', InterestSchema)
  const Settings = conn.model('Settings', SettingsSchema)
  const User = conn.model('User', UserSchema)
  const Counter = conn.model('Counter', CounterSchema)

  return {
    driver: 'mongo',
    async connect() {
      await conn.openUri(uri)
      await Promise.all([Event, Booking, Interest, Settings, User, Counter].map((m) => m.init()))
    },
    async close() {
      await conn.close()
    },

    events: {
      async list() {
        return (await Event.find().lean()).map(plain)
      },
      async get(id) {
        return plain(await Event.findOne({ id: Number(id) }).lean())
      },
      async create(doc) {
        let id = doc.id
        if (id === undefined) {
          const last = await Event.findOne().sort({ id: -1 }).lean()
          id = Math.max(28400, last?.id || 0) + 1
        }
        const now = new Date().toISOString()
        return plain(await Event.create({ seatsTaken: 0, bookedBefore: 0, image: null, ...doc, id, createdAt: now, updatedAt: now }))
      },
      async update(id, patch) {
        return plain(await Event.findOneAndUpdate({ id: Number(id) }, { $set: { ...patch, updatedAt: new Date().toISOString() } }, { new: true }).lean())
      },
      async remove(id) {
        const r = await Event.deleteOne({ id: Number(id) })
        return r.deletedCount > 0
      },
      // Atomic: the update only matches while enough seats are free.
      async takeSeats(id, n) {
        const r = await Event.updateOne(
          { id: Number(id), $expr: { $lte: [{ $add: [{ $ifNull: ['$bookedBefore', 0] }, { $ifNull: ['$seatsTaken', 0] }, n] }, '$seats'] } },
          { $inc: { seatsTaken: n } },
        )
        return r.modifiedCount === 1
      },
      async maxCode() {
        const all = await Event.find({}, { code: 1 }).lean()
        return Math.max(0, ...all.map((e) => Number(e.code) || 0))
      },
    },

    bookings: {
      async create(doc) {
        return plain(await Booking.create(doc))
      },
      async get(id) {
        return plain(await Booking.findOne({ id }).lean())
      },
      async list() {
        return (await Booking.find().sort({ createdAt: -1 }).lean()).map(plain)
      },
      async updateIfStatus(id, from, patch) {
        return plain(await Booking.findOneAndUpdate({ id, status: from }, { $set: patch }, { new: true }).lean())
      },
      async existsForEvent(eventId) {
        return !!(await Booking.exists({ eventId: Number(eventId) }))
      },
    },

    interest: {
      async add(doc) {
        return plain(await Interest.create({ id: String(Date.now()) + Math.random().toString(36).slice(2, 6), ...doc, createdAt: new Date().toISOString() }))
      },
      async list() {
        return (await Interest.find().sort({ createdAt: -1 }).lean()).map(plain)
      },
    },

    settings: {
      async get() {
        const s = await Settings.findOne({ key: 'site' }).lean()
        return s ? s.value : null
      },
      async save(value) {
        await Settings.updateOne({ key: 'site' }, { $set: { value } }, { upsert: true })
        return value
      },
    },

    users: {
      async findByEmail(email) {
        return plain(await User.findOne({ email: String(email).toLowerCase() }).lean())
      },
      async upsert(u) {
        await User.updateOne({ email: u.email.toLowerCase() }, { $set: { ...u, email: u.email.toLowerCase() } }, { upsert: true })
      },
    },

    counters: {
      async next(name, start = 0) {
        await Counter.updateOne({ name }, { $setOnInsert: { seq: start } }, { upsert: true })
        const c = await Counter.findOneAndUpdate({ name }, { $inc: { seq: 1 } }, { new: true }).lean()
        return c.seq
      },
      async ensure(name, start) {
        await Counter.updateOne({ name }, { $max: { seq: start } }, { upsert: true })
      },
    },
  }
}
