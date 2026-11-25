import { createMemoryDb } from './memory.js'

export async function createDb(cfg) {
  if (cfg.dbDriver === 'mongo') {
    const { createMongoDb } = await import('./mongo.js')
    return createMongoDb(cfg.mongoUri)
  }
  return createMemoryDb()
}
