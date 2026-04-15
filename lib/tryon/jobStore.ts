import type { TryOnJobRecord } from './protocol'

const globalForTryOn = globalThis as typeof globalThis & {
  __tryOnJobs?: Map<string, TryOnJobRecord>
}

const jobs = globalForTryOn.__tryOnJobs ?? new Map<string, TryOnJobRecord>()
if (!globalForTryOn.__tryOnJobs) {
  globalForTryOn.__tryOnJobs = jobs
}

export function upsertJob(job: TryOnJobRecord) {
  jobs.set(job.jobId, job)
  return job
}

export function getJob(jobId: string) {
  return jobs.get(jobId)
}

export function patchJob(jobId: string, patch: Partial<TryOnJobRecord>) {
  const current = jobs.get(jobId)
  if (!current) return undefined
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  jobs.set(jobId, next)
  return next
}
