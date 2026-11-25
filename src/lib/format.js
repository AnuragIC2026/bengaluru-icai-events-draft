const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// All event times are Bengaluru time.
export function istDate(date, time = '00:00') {
  return new Date(`${date}T${time}:00+05:30`)
}

function parts(date) {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return { y, m, d, dow }
}

export function dayNum(date) {
  return parts(date).d
}
export function monShort(date) {
  return MONTHS[parts(date).m - 1]
}
export function dowShort(date) {
  return DAYS[parts(date).dow]
}
export function monthKey(date) {
  const { y, m } = parts(date)
  return `${MONTHS_LONG[m - 1]} ${y}`
}

export function fmtDate(date) {
  const { y, m, d, dow } = parts(date)
  return `${DAYS[dow]}, ${d} ${MONTHS[m - 1]} ${y}`
}

export function fmtDateShort(date) {
  const { m, d } = parts(date)
  return `${d} ${MONTHS[m - 1]}`
}

export function fmtDateRange(start, end) {
  if (!end || end === start) return fmtDate(start)
  const a = parts(start)
  const b = parts(end)
  if (a.y === b.y && a.m === b.m) return `${a.d} to ${b.d} ${MONTHS[b.m - 1]} ${b.y}`
  if (a.y === b.y) return `${a.d} ${MONTHS[a.m - 1]} to ${b.d} ${MONTHS[b.m - 1]} ${b.y}`
  return `${fmtDateShort(start)} ${a.y} to ${fmtDateShort(end)} ${b.y}`
}

export function fmtTime(t) {
  if (!t) return ''
  let [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return m ? `${h}:${String(m).padStart(2, '0')} ${ap}` : `${h} ${ap}`
}

export function fmtTimeRange(a, b) {
  return b ? `${fmtTime(a)} to ${fmtTime(b)}` : fmtTime(a)
}

export function rupees(n, { paise = 'auto' } = {}) {
  const v = Number(n || 0)
  const showPaise = paise === true || (paise === 'auto' && Math.round(v * 100) % 100 !== 0)
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: showPaise ? 2 : 0, maximumFractionDigits: showPaise ? 2 : 0 })
}

export function fmtDateTime(iso) {
  const d = new Date(iso)
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000)
  const y = ist.getUTCFullYear()
  const m = ist.getUTCMonth()
  const day = ist.getUTCDate()
  const hh = ist.getUTCHours()
  const mm = ist.getUTCMinutes()
  const h12 = hh % 12 || 12
  return `${day} ${MONTHS[m]} ${y}, ${h12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'pm' : 'am'}`
}

export function todayIST() {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000)
  return ist.toISOString().slice(0, 10)
}
