import { loadConfig, checkConfig } from './config.js'
import { createDb } from './db/index.js'
import { createMailer } from './services/mailer.js'
import { createApp } from './app.js'
import { seed } from './seed.js'

const cfg = loadConfig()
const problems = checkConfig(cfg)
const fatal = problems.filter((p) => !p.startsWith('PAYMENT_MODE=test'))
problems.forEach((p) => console.warn('config:', p))
if (fatal.length) {
  console.error('Fix the settings in .env and start again.')
  process.exit(1)
}

const db = await createDb(cfg)
await db.connect()
// The memory database starts empty every time, so fill it on start.
if (db.driver === 'memory') {
  if (!cfg.seedUsers.length) {
    cfg.seedUsers = [
      { email: 'admin@demo.in', password: 'admin123', name: 'Branch admin', role: 'admin' },
      { email: 'accounts@demo.in', password: 'accounts123', name: 'Accounts team', role: 'accounts' },
    ]
    console.warn('No ADMIN_EMAIL set, so the memory database uses the test logins admin@demo.in / admin123 and accounts@demo.in / accounts123.')
  }
  await seed(db, cfg, { quiet: true })
}

const app = createApp({ cfg, db, mailer: createMailer(cfg) })
const server = app.listen(cfg.port, () => {
  console.log(`API on ${cfg.publicApiUrl} (db: ${db.driver}, payments: ${cfg.payment.mode}, email: ${cfg.email.enabled ? 'on' : 'off'})`)
})

const stop = async () => {
  server.close()
  await db.close()
  process.exit(0)
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
