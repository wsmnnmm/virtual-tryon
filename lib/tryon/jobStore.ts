import type { TryOnJobRecord } from './protocol'

const globalForTryOn = globalThis as typeof globalThis & {
  __tryOnJobs?: Map<string, TryOnJobRecord>
}

const memoryJobs = globalForTryOn.__tryOnJobs ?? new Map<string, TryOnJobRecord>()
if (!globalForTryOn.__tryOnJobs) {
  globalForTryOn.__tryOnJobs = memoryJobs
}

const kvRestUrl = process.env.KV_REST_API_URL
const kvRestToken = process.env.KV_REST_API_TOKEN
const usePersistentStore = Boolean(kvRestUrl && kvRestToken)
const namespace = 'tryon:job:'

async function kvFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!kvRestUrl || !kvRestToken) throw new Error('KV env missing')
  const response = await fetch(`${kvRestUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${kvRestToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`KV request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

async function persistJob(job: TryOnJobRecord) {
  if (!usePersistentStore) {
    memoryJobs.set(job.jobId, job)
    return job
  }
  await kvFetch('/set', {
    method: 'POST',
    body: JSON.stringify({ key: `${namespace}${job.jobId}`, value: job }),
  })
  return job
}

async function loadJob(jobId: string) {
  if (!usePersistentStore) return memoryJobs.get(jobId)
  const data = await kvFetch<{ result: TryOnJobRecord | null }>(`/get/${encodeURIComponent(`${namespace}${jobId}`)}`)
  return data.result ?? undefined
}

export async function upsertJob(job: TryOnJobRecord) {
  return persistJob(job)
}

export async function getJob(jobId: string) {
  const persisted = await loadJob(jobId)
  if (persisted) {
    memoryJobs.set(jobId, persisted)
    return persisted
  }
  return memoryJobs.get(jobId)
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
