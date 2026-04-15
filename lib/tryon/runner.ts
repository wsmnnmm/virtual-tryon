import { HttpClientError } from '@/lib/services/httpClient'
import { getJob, patchJob } from './jobStore'
import { ensureHttpsUrl, logTryOn, summarizeUrl } from './log'
import { createRefinerTask, createTryOnTask, queryTryOnTask } from './service'
import type { TryOnJobRecord, TryOnJobStatus } from './protocol'

function pickImageUrl(task: { output?: { image_url?: string; results?: Array<{ url?: string }> } }) {
  return task.output?.image_url ?? task.output?.results?.[0]?.url
}

function isTerminalStatus(status: TryOnJobStatus) {
  return status === 'succeeded' || status === 'failed'
}

export async function advanceTryOnJob(jobId: string, requestId?: string) {
  const job = await getJob(jobId)
  if (!job) return undefined

  const traceRequestId = requestId ?? jobId
  const request = {
    personImageUrl: job.personImageUrl,
    topGarmentUrl: job.topGarmentUrl,
    bottomGarmentUrl: job.bottomGarmentUrl,
    refine: job.refine,
    gender: job.gender,
  }

  try {
    if (job.status === 'pending') {
      logTryOn('tryon.job.started', { jobId, requestId: traceRequestId, refine: request.refine !== false })
      if (!job.coarseTaskId) {
        await patchJob(jobId, { status: 'coarse_running' })
        const coarseTask = await createTryOnTask(request)
        const coarseTaskId = coarseTask.output?.task_id
        if (!coarseTaskId) throw new Error('DashScope coarse task id missing')
        return await patchJob(jobId, { status: 'coarse_running', coarseTaskId })
      }
    }

    if (job.status === 'coarse_running') {
      const coarseTaskId = job.coarseTaskId
      if (!coarseTaskId) throw new Error('coarse task id missing while coarse_running')
      const task = await queryTryOnTask(coarseTaskId)
      const status = task.output?.task_status
      const imageUrl = pickImageUrl(task)
      logTryOn('tryon.job.coarse.poll', { jobId, requestId: traceRequestId, coarseTaskId, status, imageUrl: summarizeUrl(imageUrl) })

      if (status === 'SUCCEEDED') {
        const safeImage = ensureHttpsUrl(imageUrl)
        const current = await patchJob(jobId, { status: 'coarse_succeeded', coarseImageUrl: safeImage })
        if (current?.refine === false) {
          const complete = await patchJob(jobId, { status: 'succeeded' })
          logTryOn('tryon.job.complete', { jobId, requestId: traceRequestId, status: complete?.status, coarseImageUrl: summarizeUrl(complete?.coarseImageUrl) })
          return complete
        }
        return current
      }

      if (status === 'FAILED' || status === 'CANCELED') {
        throw new Error(`coarse task failed with status ${status}`)
      }

      return job
    }

    if (job.status === 'coarse_succeeded' && job.refine !== false) {
      if (!job.coarseImageUrl) throw new Error('coarse image missing before refine')
      if (!job.refineTaskId) {
        await patchJob(jobId, { status: 'refine_running' })
        const refineTask = await createRefinerTask({ ...request, coarseImageUrl: job.coarseImageUrl })
        const refineTaskId = refineTask.output?.task_id
        if (!refineTaskId) throw new Error('DashScope refine task id missing')
        return await patchJob(jobId, { status: 'refine_running', refineTaskId })
      }
    }

    if (job.status === 'refine_running') {
      const refineTaskId = job.refineTaskId
      if (!refineTaskId) throw new Error('refine task id missing while refine_running')
      const task = await queryTryOnTask(refineTaskId)
      const status = task.output?.task_status
      const imageUrl = pickImageUrl(task)
      logTryOn('tryon.job.refine.poll', { jobId, requestId: traceRequestId, refineTaskId, status, imageUrl: summarizeUrl(imageUrl) })

      if (status === 'SUCCEEDED') {
        const safeImage = ensureHttpsUrl(imageUrl)
        const current = await patchJob(jobId, { status: 'succeeded', refinedImageUrl: safeImage })
        logTryOn('tryon.job.complete', { jobId, requestId: traceRequestId, status: current?.status, refinedImageUrl: summarizeUrl(current?.refinedImageUrl) })
        return current
      }

      if (status === 'FAILED' || status === 'CANCELED') {
        throw new Error(`refine task failed with status ${status}`)
      }

      return job
    }

    if (isTerminalStatus(job.status)) return job
    return job
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    await patchJob(jobId, { status: 'failed', error: 'JOB_FAILED', errorMessage: message })
    logTryOn('tryon.job.failed', { jobId, requestId: traceRequestId, message })
    if (error instanceof HttpClientError) throw error
    throw error
  }
}

export async function runTryOnJob(job: TryOnJobRecord, requestId?: string) {
  return advanceTryOnJob(job.jobId, requestId)
}
