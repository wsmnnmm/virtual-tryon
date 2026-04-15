// cspell:ignore redis tryon
import { createClient, type RedisClientType } from 'redis'
import type { TryOnJobRecord } from './protocol'

const redisUrl = process.env.REDIS_URL
const namespace = 'tryon:job:'
const jobTtlSeconds = Number(process.env.TRYON_JOB_TTL_SECONDS ?? '604800')

let redisClient: RedisClientType | undefined
let redisConnectPromise: Promise<RedisClientType> | undefined

function assertRedisConfigured() {
  if (!redisUrl) {
    throw new Error('Redis job store is not configured. Set REDIS_URL.')
  }
}

function getRedisClient() {
  assertRedisConfigured()

  if (!redisClient) {
    redisClient = createClient({ url: redisUrl })
    redisClient.on('error', (error) => {
      console.error('Redis client error:', error)
    })
  }

  return redisClient
}

async function getConnectedRedisClient() {
  const client = getRedisClient()

  if (client.isOpen) {
    return client
  }

  if (!redisConnectPromise) {
    redisConnectPromise = client.connect().then(() => client)
  }

  try {
    return await redisConnectPromise
  } finally {
    redisConnectPromise = undefined
  }
}

async function persistJob(job: TryOnJobRecord) {
  const client = await getConnectedRedisClient()
  await client.set(`${namespace}${job.jobId}`, JSON.stringify(job), { EX: jobTtlSeconds })
  return job
}

async function loadJob(jobId: string) {
  const client = await getConnectedRedisClient()
  const raw = await client.get(`${namespace}${jobId}`)
  if (!raw) return undefined
  return JSON.parse(raw) as TryOnJobRecord
}

export async function upsertJob(job: TryOnJobRecord) {
  return persistJob(job)
}

export async function getJob(jobId: string) {
  return loadJob(jobId)
}

export async function patchJob(jobId: string, patch: Partial<TryOnJobRecord>) {
  const current = await getJob(jobId)
  if (!current) return undefined

  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  }

  await persistJob(next)
  return next
}
