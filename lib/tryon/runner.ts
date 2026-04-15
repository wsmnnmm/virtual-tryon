import { HttpClientError } from '@/lib/services/httpClient'
import { patchJob } from './jobStore'
import { ensureHttpsUrl, logTryOn, summarizeUrl } from './log'
import { createRefinerTask, createTryOnTask, queryTryOnTask } from './service'
import type { TryOnJobRecord } from './protocol'

function pickImageUrl(task: { output?: { image_url?: string; results?: Array<{ url?: string }> } }) {
  return task.output?.image_url ?? task.output?.results?.[0]?.url
}

export async function runTryOnJob(job: TryOnJobRecord) {
  const { jobId, requestId, request } = job

  try {
    logTryOn('tryon.job.started', { jobId, requestId, refine: request.refine !== false })
    await patchJob(jobId, { status: 'coarse_running' })

    const coarseTask = await createTryOnTask(request)
    const coarseTaskId = coarseTask.output?.task_id
    if (coarseTaskId) await patchJob(jobId, { coarseTaskId })

    if (!coarseTaskId) throw new Error('DashScope coarse task id missing')

    while (true) {
      const task = await queryTryOnTask(coarseTaskId)
      const status = task.output?.task_status
      const imageUrl = pickImageUrl(task)

      logTryOn('tryon.job.coarse.poll', { jobId, requestId, coarseTaskId, status, imageUrl: summarizeUrl(imageUrl) })

      if (status === 'SUCCEEDED') {
        const safeImage = ensureHttpsUrl(imageUrl)
        await patchJob(jobId, { status: 'coarse_succeeded', coarseImageUrl: safeImage })
        break
      }

      if (status === 'FAILED' || status === 'CANCELED') {
        throw new Error(`coarse task failed with status ${status}`)
      }

      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    if (request.refine === false) {
      const current = await patchJob(jobId, { status: 'succeeded' })
      logTryOn('tryon.job.complete', { jobId, requestId, status: current?.status, coarseImageUrl: summarizeUrl(current?.coarseImageUrl) })
      return current
    }

    const coarseImageUrl = (await patchJob(jobId, {}))?.coarseImageUrl
    if (!coarseImageUrl) throw new Error('coarse image missing before refine')

    await patchJob(jobId, { status: 'refine_running' })
    const refineTask = await createRefinerTask({ ...request, coarseImageUrl })
    const refineTaskId = refineTask.output?.task_id
    if (refineTaskId) await patchJob(jobId, { refineTaskId })
    if (!refineTaskId) throw new Error('DashScope refine task id missing')

    while (true) {
      const task = await queryTryOnTask(refineTaskId)
      const status = task.output?.task_status
      const imageUrl = pickImageUrl(task)
      logTryOn('tryon.job.refine.poll', { jobId, requestId, refineTaskId, status, imageUrl: summarizeUrl(imageUrl) })

      if (status === 'SUCCEEDED') {
        const safeImage = ensureHttpsUrl(imageUrl)
        const current = await patchJob(jobId, { status: 'succeeded', refinedImageUrl: safeImage })
        logTryOn('tryon.job.complete', { jobId, requestId, status: current?.status, refinedImageUrl: summarizeUrl(current?.refinedImageUrl) })
        return current
      }

      if (status === 'FAILED' || status === 'CANCELED') {
        throw new Error(`refine task failed with status ${status}`)
      }

      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    await patchJob(jobId, { status: 'failed', error: 'JOB_FAILED', errorMessage: message })
    logTryOn('tryon.job.failed', { jobId, requestId, message })
    if (error instanceof HttpClientError) throw error
    throw error
  }
}
