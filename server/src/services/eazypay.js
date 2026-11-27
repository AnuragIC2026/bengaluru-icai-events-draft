// ICICI Bank Eazypay.
// Matches what the old bangaloreicai.org code did: values are AES-128-ECB encrypted with the merchant key
// and sent to https://eazypay.icicibank.com/EazyPG, and the bank's reply is checked with a SHA-512 hash of
// 15 values joined by | (the 15th is the key). Response code E000 means paid.
// Confirm field order and URL encoding against ICICI's merchant kit before going live.
import crypto from 'node:crypto'

export function encrypt(value, key) {
  const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from(key, 'utf8'), null)
  return Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]).toString('base64')
}

export function decrypt(b64, key) {
  const d = crypto.createDecipheriv('aes-128-ecb', Buffer.from(key, 'utf8'), null)
  return Buffer.concat([d.update(Buffer.from(b64, 'base64')), d.final()]).toString('utf8')
}

const amountText = (n) => Number(n).toFixed(2)

function fillTemplate(tpl, booking, cfg) {
  const first = booking.participants[0] || {}
  const vals = {
    ref: booking.id,
    sub: cfg.subMerchantId,
    amount: amountText(booking.price.total),
    name: (booking.contact.firm || first.name || '').replace(/[|]/g, ' ').slice(0, 60),
    mobile: booking.contact.phone,
    email: booking.contact.email,
  }
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vals[k] ?? '')
}

// Builds the address the person's browser is sent to for paying.
export function buildPaymentUrl(booking, cfg, returnUrl) {
  const k = cfg.aesKey
  const parts = [
    ['merchantid', cfg.merchantId, false],
    ['mandatory fields', fillTemplate(cfg.mandatoryFields, booking, cfg), true],
    ['optional fields', '', true],
    ['returnurl', returnUrl, true],
    ['Reference No', booking.id, true],
    ['submerchantid', cfg.subMerchantId, true],
    ['transaction amount', amountText(booking.price.total), true],
    ['paymode', cfg.paymode, true],
  ]
  const qs = parts.map(([name, v, enc]) => `${encodeURIComponent(name)}=${encodeURIComponent(enc ? encrypt(v, k) : v)}`).join('&')
  return `${cfg.url}?${qs}`
}

const HASH_FIELDS = [
  'ID',
  'Response Code',
  'Unique Ref Number',
  'Service Tax Amount',
  'Processing Fee Amount',
  'Total Amount',
  'Transaction Amount',
  'Transaction Date',
  'Interchange Value',
  'TDR',
  'Payment Mode',
  'SubMerchantId',
  'ReferenceNo',
  'TPS',
]

export function responseHash(body, key) {
  const text = [...HASH_FIELDS.map((f) => body[f] ?? ''), key].join('|')
  return crypto.createHash('sha512').update(text, 'utf8').digest('hex')
}

// Checks the bank's reply. Returns { ok, paid, ref, bankRef, amount, mode, code, reason }.
export function verifyResponse(body, cfg) {
  const ref = String(body.ReferenceNo || '').trim()
  const code = String(body['Response Code'] || '').trim()
  if (!ref) return { ok: false, reason: 'No reference number in the bank reply.' }
  const expected = responseHash(body, cfg.aesKey)
  const got = String(body.RS || '').trim().toLowerCase()
  const a = Buffer.from(expected)
  const b = Buffer.from(got.padEnd(expected.length, ' ').slice(0, expected.length))
  if (!got || !crypto.timingSafeEqual(a, b)) return { ok: false, ref, code, reason: 'invalid hash' }
  return {
    ok: true,
    paid: code === cfg.successCode,
    ref,
    code,
    bankRef: String(body['Unique Ref Number'] || ''),
    amount: Number(body['Total Amount'] || body['Transaction Amount'] || 0),
    mode: String(body['Payment Mode'] || ''),
    txnDate: String(body['Transaction Date'] || ''),
  }
}
