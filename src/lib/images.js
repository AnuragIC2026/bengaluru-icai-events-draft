// Event images for the test version, kept in this browser's IndexedDB
// (localStorage is too small for pictures). The live build will upload them to the server.

// Dummy posters for reference, made by tools/sample_posters.py. Loaded once on the first visit;
// the admin can replace or remove them like any other image.
const SAMPLES = Object.fromEntries(
  Object.entries(import.meta.glob('../data/sample-images/*.webp', { eager: true, query: '?url', import: 'default' })).map(([path, url]) => [
    path.match(/(\d+)\.webp$/)[1],
    url,
  ]),
)
// Bump the version when the sample posters change. Browsers that saw an older set get the new
// posters, but images an admin uploaded (saved as data URLs) and samples they removed stay as they are.
const SAMPLE_FLAG = 'blricai-events:v3:samples-loaded'
const OLD_FLAGS = ['blricai-events:v1:samples-loaded', 'blricai-events:v2:samples-loaded']

let seeding = null
function seedSamples() {
  if (seeding) return seeding
  seeding = (async () => {
    let done = false
    try {
      done = localStorage.getItem(SAMPLE_FLAG) === '1'
    } catch {
      done = memory.size > 0
    }
    if (done) return
    let seenBefore = false
    try {
      seenBefore = OLD_FLAGS.some((k) => localStorage.getItem(k) === '1')
    } catch {
      /* treat as a first visit */
    }
    for (const [id, url] of Object.entries(SAMPLES)) {
      let current
      try {
        current = await tx('readonly', (s) => s.get(id))
      } catch {
        current = memory.get(id)
      }
      const isOldSample = typeof current === 'string' && !current.startsWith('data:')
      if (isOldSample || (!seenBefore && current == null)) {
        memory.set(id, url)
        await tx('readwrite', (s) => s.put(url, id))
      }
    }
    try {
      localStorage.setItem(SAMPLE_FLAG, '1')
    } catch {
      /* fine, memory copy is used for this visit */
    }
  })()
  return seeding
}

const DB = 'blricai-events-images'
const STORE = 'images'
const memory = new Map()

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no indexeddb'))
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode, fn) {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      const out = fn(t.objectStore(STORE))
      t.oncomplete = () => resolve(out?.result)
      t.onerror = () => reject(t.error)
    })
  } catch {
    return undefined
  }
}

export async function putImage(id, dataUrl) {
  memory.set(String(id), dataUrl)
  await tx('readwrite', (s) => s.put(dataUrl, String(id)))
}

export async function deleteImage(id) {
  memory.delete(String(id))
  await tx('readwrite', (s) => s.delete(String(id)))
}

export async function getImage(id) {
  await seedSamples()
  const k = String(id)
  if (memory.has(k)) return memory.get(k)
  const v = await tx('readonly', (s) => s.get(k))
  if (v) memory.set(k, v)
  return v || null
}

export async function getAllImages() {
  await seedSamples()
  const keys = (await tx('readonly', (s) => s.getAllKeys())) || []
  const out = {}
  for (const k of keys) out[k] = await getImage(k)
  for (const [k, v] of memory) out[k] = v
  return out
}

export async function clearImages() {
  memory.clear()
  await tx('readwrite', (s) => s.clear())
  try {
    localStorage.removeItem(SAMPLE_FLAG)
  } catch {
    /* ignore */
  }
  seeding = null
}

const MAX_SIDE = 1400
const MAX_BYTES = 8 * 1024 * 1024

// Reads a picked file, scales it down so the longest side is at most 1400px, and returns a compressed data URL.
export function prepareImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file chosen.'))
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Use a JPG, PNG or WebP image.'))
    if (file.size > MAX_BYTES) return reject(new Error('That image is over 8 MB. Please use a smaller one.'))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      // White behind transparent PNGs so they don't turn black as JPEG.
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      let data = c.toDataURL('image/webp', 0.85)
      if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/jpeg', 0.85)
      resolve({ dataUrl: data, width: w, height: h })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be read as an image.'))
    }
    img.src = url
  })
}
