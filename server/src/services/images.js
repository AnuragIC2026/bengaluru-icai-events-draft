// Event images: checked, re-encoded (which also strips hidden data such as GPS tags) and saved to disk.
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

export const MAX_UPLOAD = 8 * 1024 * 1024
const OK_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function saveEventImage(buffer, mimetype, uploadDir) {
  if (!OK_TYPES.has(mimetype)) throw Object.assign(new Error('Use a JPG, PNG or WebP image.'), { status: 400 })
  let img
  try {
    img = sharp(buffer, { limitInputPixels: 40_000_000 }).rotate()
    const meta = await img.metadata()
    if (!['jpeg', 'png', 'webp'].includes(meta.format)) throw new Error('bad format')
  } catch {
    throw Object.assign(new Error('That file could not be read as an image.'), { status: 400 })
  }
  const out = await img
    .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .webp({ quality: 85 })
    .toBuffer()
  await fs.mkdir(uploadDir, { recursive: true })
  const name = `${crypto.randomBytes(12).toString('hex')}.webp`
  await fs.writeFile(path.join(uploadDir, name), out)
  return name
}

export async function deleteEventImage(name, uploadDir) {
  if (!name || !/^[a-f0-9]{24}\.webp$|^sample-\d+\.webp$/.test(name)) return
  await fs.rm(path.join(uploadDir, name), { force: true })
}
