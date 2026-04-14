import { logger } from '@/lib/logger'
import { HttpClientError, HttpTimeoutError, requestJson } from '@/lib/services/httpClient'
import type {
  DashScopeCreateTaskRequest,
  DashScopeCreateTaskResponse,
  DashScopeTaskQueryResponse,
  TryOnCreateRequest,
} from '@/types/tryon'

const apiKey = process.env.TRYON_API_KEY
const baseUrl = process.env.TRYON_API_BASE_URL ?? 'https://dashscope.aliyuncs.com'
const timeoutMs = Number(process.env.TRYON_API_TIMEOUT_MS ?? '30000')
const pollIntervalMs = Number(process.env.TRYON_POLL_INTERVAL_MS ?? '2000')
const pollTimeoutMs = Number(process.env.TRYON_POLL_TIMEOUT_MS ?? '120000')

function ensureEnv() {
  if (!apiKey) {
    throw new Error('TRYON_API_KEY is missing on server environment')
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function createTryOnTask(input: TryOnCreateRequest) {
  ensureEnv()

  const requestPayload: DashScopeCreateTaskRequest = {
    model: 'aitryon-plus',
    input: {
      person_image_url: input.personImageUrl,
      top_garment_url: input.topGarmentUrl,
      bottom_garment_url: input.bottomGarmentUrl,
    },
    parameters: {
      resolution: -1,
      restore_face: true,
    },
  }

  const start = Date.now()
  logger.info({
    event: 'tryon.request.start',
    route: 'dashscope.createTask',
    hasPersonImageUrl: Boolean(input.personImageUrl),
    hasTopGarment: Boolean(input.topGarmentUrl),
    hasBottomGarment: Boolean(input.bottomGarmentUrl),
  })

  try {
    const response = await requestJson<DashScopeCreateTaskResponse>({
      url: `${baseUrl}/api/v1/services/aigc/image2image/image-synthesis/`,
      method: 'POST',
      timeoutMs,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(requestPayload),
    })

    logger.info({
      event: 'tryon.request.success',
      route: 'dashscope.createTask',
      elapsedMs: Date.now() - start,
      taskId: response.output?.task_id,
      taskStatus: response.output?.task_status,
      responseCode: response.code,
      responseMessage: response.message,
      responseRequestId: response.request_id,
    })

    return response
  } catch (error) {
    if (error instanceof HttpTimeoutError) {
      logger.error({
        event: 'tryon.request.error',
        route: 'dashscope.createTask',
        errorType: 'timeout',
        elapsedMs: Date.now() - start,
      })
      throw error
    }

    if (error instanceof HttpClientError) {
      logger.error({
        event: 'tryon.request.error',
        route: 'dashscope.createTask',
        errorType: 'http_error',
        status: error.status,
        elapsedMs: Date.now() - start,
        errorBody: error.body,
        errorMessage: error.message,
      })
      throw error
    }

    logger.error({
      event: 'tryon.request.error',
      route: 'dashscope.createTask',
      errorType: 'unknown',
      elapsedMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'unknown error',
    })

    throw error
  }
}

export async function queryTryOnTask(taskId: string) {
  ensureEnv()

  return requestJson<DashScopeTaskQueryResponse>({
    url: `${baseUrl}/api/v1/tasks/${taskId}`,
    method: 'GET',
    timeoutMs,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
}

export async function createTryOnTaskAndWait(input: TryOnCreateRequest) {
  const created = await createTryOnTask(input)
  const taskId = created.output?.task_id

  if (!taskId) {
    return created
  }

  const startedAt = Date.now()

  while (Date.now() - startedAt < pollTimeoutMs) {
    await sleep(pollIntervalMs)
    const task = await queryTryOnTask(taskId)
    const status = task.output?.task_status

    if (status === 'SUCCEEDED') {
      logger.info({
        event: 'tryon.task.completed',
        taskId,
        elapsedMs: Date.now() - startedAt,
      })
      return task
    }

    if (status === 'FAILED' || status === 'CANCELED') {
      logger.error({
        event: 'tryon.task.failed',
        taskId,
        status,
        elapsedMs: Date.now() - startedAt,
      })
      throw new HttpClientError('Try-on task failed', 502, task)
    }

    logger.info({
      event: 'tryon.task.polling',
      taskId,
      status,
      elapsedMs: Date.now() - startedAt,
    })
  }

  throw new HttpTimeoutError(`Try-on task polling timed out in ${pollTimeoutMs}ms`)
}
