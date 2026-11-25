// Price maths. Kept free of React and storage so the same file can move to the backend later.

export const CATEGORY_LABELS = {
  member: 'Member',
  nonMember: 'Non-member',
  student: 'Student',
}

export const CATEGORY_PLURAL = {
  member: 'Members',
  nonMember: 'Non-members',
  student: 'Students',
}

export const CATEGORY_ORDER = ['member', 'nonMember', 'student']

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

// Students never pay GST (0 of 39,489 paid student bookings on the old portal carried GST).
export function gstAppliesTo(category) {
  return category !== 'student'
}

export function enabledCategories(event) {
  return CATEGORY_ORDER.filter((c) => event.categories?.[c]?.enabled)
}

// Discount per participant for a given group size. Flat amounts are per person and never exceed the fee.
export function discountPerPerson(event, fee, qty) {
  const b = event.bulk
  if (!b?.enabled || qty < b.minQty || fee <= 0) return 0
  if (b.type === 'percent') return round2((fee * Math.min(b.value, 100)) / 100)
  return round2(Math.min(b.value, fee))
}

export function calcPrice(event, category, qty, gstRate = 18) {
  const fee = Number(event.categories?.[category]?.fee || 0)
  const perDiscount = discountPerPerson(event, fee, qty)
  const netPerPerson = round2(fee - perDiscount)
  const subtotal = round2(fee * qty)
  const discount = round2(perDiscount * qty)
  const taxable = round2(netPerPerson * qty)
  const rate = gstAppliesTo(category) ? gstRate : 0
  const gst = round2((taxable * rate) / 100)
  const total = round2(taxable + gst)
  return { fee, qty, perDiscount, netPerPerson, subtotal, discount, taxable, gstRate: rate, gst, total }
}

export function priceWithGst(fee, category, gstRate = 18) {
  const rate = gstAppliesTo(category) ? gstRate : 0
  return round2(fee + (fee * rate) / 100)
}

export function describeDiscount(bulk, short = false) {
  if (!bulk?.enabled) return ''
  const v = bulk.type === 'percent' ? `${bulk.value}%` : `₹${Number(bulk.value).toLocaleString('en-IN')}`
  if (short) return `Save ${v} each on ${bulk.minQty}+`
  return `${v} off per person for ${bulk.minQty} or more`
}
