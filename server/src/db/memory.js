// In-memory storage with the same functions as db/mongo.js.
// Used by the tests and for a quick look without a database. Everything is lost on restart.

const clone = (v) => (v === undefined || v === null ? v : structuredClone(v))

export function createMemoryDb() {
  const events = new Map()
  const bookings = new Map()
  const interest = []
  const users = new Map()
  const counters = new Map()
  let settings = null

  return {
    driver: 'memory',
    async connect() {},
    async close() {},

    events: {
      async list() {
        return [...events.values()].map(clone)
      },
      async get(id) {
        return clone(events.get(Number(id)) || null)
      },
      async create(doc) {
        const id = doc.id ?? Math.max(28400, ...events.keys()) + 1
        const now = new Date().toISOString()
        const e = { seatsTaken: 0, bookedBefore: 0, image: null, ...doc, id, createdAt: now, updatedAt: now }
        events.set(id, e)
        return clone(e)
      },
      async update(id, patch) {
        const e = events.get(Number(id))
        if (!e) return null
        Object.assign(e, patch, { updatedAt: new Date().toISOString() })
        return clone(e)
      },
      async remove(id) {
        return events.delete(Number(id))
      },
      // Takes seats only if they are still free. Returns true when it worked.
      async takeSeats(id, n) {
        const e = events.get(Number(id))
        if (!e || (e.bookedBefore || 0) + (e.seatsTaken || 0) + n > e.seats) return false
        e.seatsTaken = (e.seatsTaken || 0) + n
        return true
      },
      async maxCode() {
        return Math.max(0, ...[...events.values()].map((e) => Number(e.code) || 0))
      },
    },

    bookings: {
      async create(doc) {
        bookings.set(doc.id, clone(doc))
        return clone(doc)
      },
      async get(id) {
        return clone(bookings.get(id) || null)
      },
      async list() {
        return [...bookings.values()].map(clone).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      },
      // Changes a booking only if it is still in the expected status, so a payment is never applied twice.
      async updateIfStatus(id, from, patch) {
        const b = bookings.get(id)
        if (!b || b.status !== from) return null
        Object.assign(b, patch)
        return clone(b)
      },
      async existsForEvent(eventId) {
        return [...bookings.values()].some((b) => b.eventId === Number(eventId))
      },
    },

    interest: {
      async add(doc) {
        const item = { id: String(Date.now()) + Math.random().toString(36).slice(2, 6), ...doc, createdAt: new Date().toISOString() }
        interest.push(item)
        return clone(item)
      },
      async list() {
        return [...interest].reverse().map(clone)
      },
    },

    settings: {
      async get() {
        return clone(settings)
      },
      async save(s) {
        settings = clone(s)
        return clone(s)
      },
    },

    users: {
      async findByEmail(email) {
        return clone(users.get(String(email).toLowerCase()) || null)
      },
      async upsert(u) {
        users.set(u.email.toLowerCase(), clone({ ...u, email: u.email.toLowerCase() }))
      },
    },

    counters: {
      async next(name, start = 0) {
        const n = (counters.has(name) ? counters.get(name) : start) + 1
        counters.set(name, n)
        return n
      },
      async ensure(name, start) {
        if (!counters.has(name) || counters.get(name) < start) counters.set(name, start)
      },
    },
  }
}
