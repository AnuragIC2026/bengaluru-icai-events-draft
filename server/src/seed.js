// Loads the 22 imported events, their sample posters and the admin logins.
// Run: npm run seed   (safe to run again: existing events and bookings are left alone)
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '..', '..')

export async function seed(db, cfg, { quiet = false } = {}) {
  const say = (...a) => !quiet && console.log(...a)
  const events = JSON.parse(await fs.readFile(path.join(ROOT, 'src', 'data', 'events.json'), 'utf8'))
  await fs.mkdir(cfg.uploadDir, { recursive: true })
  let added = 0
  for (const e of events) {
    if (await db.events.get(e.id)) continue
    let image = null
    const sample = path.join(ROOT, 'src', 'data', 'sample-images', `${e.id}.webp`)
    try {
      await fs.copyFile(sample, path.join(cfg.uploadDir, `sample-${e.id}.webp`))
      image = `sample-${e.id}.webp`
    } catch {
      /* no sample for this event */
    }
    await db.events.create({ ...e, seatsTaken: 0, image })
    added++
  }
  // Booking numbers carry on from the old portal (last one was 158186).
  await db.counters.ensure('booking', 158186)
  for (const u of cfg.seedUsers) {
    await db.users.upsert({ email: u.email, name: u.name, role: u.role, passwordHash: await bcrypt.hash(u.password, 12) })
  }
  say(`Seed: ${added} events added, ${events.length - added} already there, ${cfg.seedUsers.length} logins set.`)
}

// Run directly: node src/seed.js
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { loadConfig } = await import('./config.js')
  const { createDb } = await import('./db/index.js')
  const cfg = loadConfig()
  if (cfg.dbDriver !== 'mongo') {
    console.log('Seeding only matters for MongoDB. The memory database seeds itself on start.')
    process.exit(0)
  }
  const db = await createDb(cfg)
  await db.connect()
  await seed(db, cfg)
  await db.close()
}
