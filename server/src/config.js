import 'dotenv/config'

const bool = (v, d = false) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(v))
const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean)

export function loadConfig(env = process.env) {
  const cfg = {
    env: env.NODE_ENV || 'development',
    port: Number(env.PORT || 4000),
    // mongo for real use, memory for tests or a quick look without a database
    dbDriver: env.DB_DRIVER || (env.MONGODB_URI ? 'mongo' : 'memory'),
    mongoUri: env.MONGODB_URI || '',
    jwtSecret: env.JWT_SECRET || '',
    jwtHours: Number(env.JWT_HOURS || 8),
    // where the front end lives, for CORS and for sending people back after payment
    frontendUrl: (env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
    corsOrigins: list(env.CORS_ORIGINS || env.FRONTEND_URL || 'http://localhost:5173'),
    // public address of this API, used for image links and the Eazypay return URL
    publicApiUrl: (env.PUBLIC_API_URL || `http://localhost:${env.PORT || 4000}`).replace(/\/$/, ''),
    uploadDir: env.UPLOAD_DIR || new URL('../uploads/', import.meta.url).pathname,
    trustProxy: bool(env.TRUST_PROXY, false),
    payment: {
      // test: simulated bank, eazypay: real ICICI Eazypay
      mode: env.PAYMENT_MODE || 'test',
      eazypay: {
        url: env.EAZYPAY_URL || 'https://eazypay.icicibank.com/EazyPG',
        merchantId: env.EAZYPAY_MERCHANT_ID || '',
        subMerchantId: env.EAZYPAY_SUB_MERCHANT_ID || '',
        aesKey: env.EAZYPAY_AES_KEY || '',
        paymode: env.EAZYPAY_PAYMODE || '9',
        // ICICI sends the exact list in the merchant kit. Placeholders: {ref} {sub} {amount} {name} {mobile} {email}
        mandatoryFields: env.EAZYPAY_MANDATORY_FIELDS || '{ref}|{sub}|{amount}',
        successCode: env.EAZYPAY_SUCCESS_CODE || 'E000',
      },
    },
    email: {
      enabled: bool(env.EMAIL_ENABLED, false),
      from: env.EMAIL_FROM || 'ICAI Bengaluru Branch (SIRC) Events <no-reply@example.com>',
      replyTo: env.EMAIL_REPLY_TO || '',
      smtp: {
        host: env.SMTP_HOST || '',
        port: Number(env.SMTP_PORT || 587),
        secure: bool(env.SMTP_SECURE, false),
        user: env.SMTP_USER || '',
        pass: env.SMTP_PASS || '',
      },
    },
    seedUsers: [
      { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD, name: env.ADMIN_NAME || 'Branch admin', role: 'admin' },
      // Manager: registrations and failed registrations only. MANAGER_*; the older ACCOUNTS_* names still work.
      { email: env.MANAGER_EMAIL || env.ACCOUNTS_EMAIL, password: env.MANAGER_PASSWORD || env.ACCOUNTS_PASSWORD, name: env.MANAGER_NAME || env.ACCOUNTS_NAME || 'Registrations manager', role: 'manager' },
    ].filter((u) => u.email && u.password),
  }
  return cfg
}

export function checkConfig(cfg) {
  const problems = []
  if (!cfg.jwtSecret || cfg.jwtSecret.length < 32) problems.push('JWT_SECRET must be at least 32 characters.')
  if (cfg.dbDriver === 'mongo' && !cfg.mongoUri) problems.push('MONGODB_URI is required when DB_DRIVER=mongo.')
  if (cfg.payment.mode === 'eazypay') {
    const e = cfg.payment.eazypay
    if (!e.merchantId || !e.subMerchantId) problems.push('EAZYPAY_MERCHANT_ID and EAZYPAY_SUB_MERCHANT_ID are required for live payments.')
    if (e.aesKey.length !== 16) problems.push('EAZYPAY_AES_KEY must be the 16 character key from ICICI.')
  }
  if (cfg.env === 'production' && cfg.payment.mode === 'test') problems.push('PAYMENT_MODE=test in production: payments are simulated.')
  return problems
}
