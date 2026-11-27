// How a booking's payment is shown to the branch. Shared by the admin pages, the Excel export and the server.
//
// Stored statuses: pending (form sent, not paid yet), processing (bank reply being handled), paid, failed.
// A booking still pending or processing after NOT_COMPLETED_AFTER is shown as "Not completed": the person
// reached the payment step and left, or the bank never sent a final reply. The old portal kept these too,
// as registrations with no payment reply.

export const NOT_COMPLETED_AFTER = 30 * 60 * 1000

export const STATUS_LABELS = {
  paid: 'Paid',
  failed: 'Failed',
  notCompleted: 'Not completed',
  pending: 'In progress',
}

export function displayStatus(b, now = Date.now()) {
  if (b.status === 'paid') return 'paid'
  if (b.status === 'failed') return 'failed'
  const age = now - new Date(b.createdAt).getTime()
  return age > NOT_COMPLETED_AFTER ? 'notCompleted' : 'pending'
}

export const isUnpaid = (key) => key === 'failed' || key === 'notCompleted'

// ICICI Eazypay response codes, from the Eazypay integration guide.
// Check this list against the guide ICICI gives the branch with its live keys.
export const EAZYPAY_CODES = {
  E000: 'Payment successful',
  E001: 'Unauthorised payment mode',
  E002: 'Unauthorised key',
  E003: 'Unauthorised packet',
  E004: 'Unauthorised merchant',
  E005: 'Unauthorised return URL',
  E006: 'Transaction already paid',
  E007: 'Transaction failed',
  E008: 'Technical error at the bank or card network',
  E009: 'Payment link expired',
  E0801: 'Payment failed',
  E0802: 'Person left the payment page',
  E0803: 'Cancelled by the person paying',
  E0812: 'Declined by the card issuer',
  E0815: 'Not enough balance',
  E0843: 'Payment session expired',
  E0850: 'Payment timed out',
}

export function codeMessage(code) {
  if (!code) return ''
  return EAZYPAY_CODES[code] || `Bank response ${code}`
}

// One line on why a booking is unpaid, for the admin list and Excel.
export function unpaidReason(b, key = displayStatus(b)) {
  if (key === 'failed') return b.payment?.message || b.payment?.note || codeMessage(b.payment?.code) || 'Payment was not completed'
  if (key === 'notCompleted') {
    if (b.payment?.message) return b.payment.message
    return b.status === 'processing' ? 'Payment started but the bank sent no final reply. Check with ICICI.' : 'Left at the payment step'
  }
  return ''
}
