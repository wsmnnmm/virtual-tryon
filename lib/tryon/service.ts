import { logger } from '@/lib/logger'
import { HttpClientError, HttpTimeoutError, requestJson } from '@/lib/services/httpClient'
import type {
  DashScopeCreateTaskRequest,
  DashScopeCreateTaskResponse,
  DashScopeTaskQueryResponse,
  TryOnCreateRequest,
} from './protocol'

const apiKey = process.env.TRYON_API_KEY
const baseUrl = process.env.TRYON_API_BASE_URL ?? 'https://dashscope.aliyuncs.com'
const timeoutMs = Number(process.env.TRYON_API_TIMEOUT_MS ?? '30000')
const useMock = process.env.TRYON_USE_MOCK === '1'

function ensureEnv() {
  if (!apiKey && !useMock) throw new Error('TRYON_API_KEY is missing on server environment')
}

async function createDashScopeTask(payload: DashScopeCreateTaskRequest, routeLabel: string) {
  ensureEnv()
  const start = Date.now()
  logger.info({ event: 'tryon.request.start', route: routeLabel, useMock })
  try {
    if (useMock) {
      const taskId = crypto.randomUUID()
      const status = payload.model === 'aitryon-plus' ? 'PENDING' : 'PENDING'
      const response: DashScopeCreateTaskResponse = {
        output: { task_id: taskId, task_status: status },
        usage: { image_count: 1 },
        request_id: crypto.randomUUID(),
      }
      logger.info({ event: 'tryon.request.success', route: routeLabel, elapsedMs: Date.now() - start, taskId, taskStatus: status, responseRequestId: response.request_id })
      return response
    }

    const response = await requestJson<DashScopeCreateTaskResponse>({
      url: `${baseUrl}/api/v1/services/aigc/image2image/image-synthesis/`,
      method: 'POST',
      timeoutMs,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(payload),
    })
    logger.info({ event: 'tryon.request.success', route: routeLabel, elapsedMs: Date.now() - start, taskId: response.output?.task_id, taskStatus: response.output?.task_status, responseCode: response.code, responseMessage: response.message, responseRequestId: response.request_id })
    return response
  } catch (error) {
    if (error instanceof HttpTimeoutError) {
      logger.error({ event: 'tryon.request.error', route: routeLabel, errorType: 'timeout', elapsedMs: Date.now() - start })
      throw error
    }
    if (error instanceof HttpClientError) {
      logger.error({ event: 'tryon.request.error', route: routeLabel, errorType: 'http_error', status: error.status, elapsedMs: Date.now() - start, errorBody: error.body, errorMessage: error.message })
      throw error
    }
    logger.error({ event: 'tryon.request.error', route: routeLabel, errorType: 'unknown', elapsedMs: Date.now() - start, message: error instanceof Error ? error.message : 'unknown error' })
    throw error
  }
}

export async function createTryOnTask(input: TryOnCreateRequest) {
  const requestPayload: DashScopeCreateTaskRequest = {
    model: 'aitryon-plus',
    input: {
      person_image_url: input.personImageUrl,
      ...(input.topGarmentUrl ? { top_garment_url: input.topGarmentUrl } : {}),
      ...(input.bottomGarmentUrl ? { bottom_garment_url: input.bottomGarmentUrl } : {}),
    },
    parameters: { resolution: -1, restore_face: true },
  }
  return createDashScopeTask(requestPayload, 'dashscope.createTryOnTask')
}

export async function createRefinerTask(input: { personImageUrl: string; topGarmentUrl?: string; bottomGarmentUrl?: string; coarseImageUrl: string; gender?: 'man' | 'woman' }) {
  const requestPayload: DashScopeCreateTaskRequest = {
    model: 'aitryon-refiner',
    input: {
      person_image_url: input.personImageUrl,
      top_garment_url: input.topGarmentUrl,
      bottom_garment_url: input.bottomGarmentUrl,
      coarse_image_url: input.coarseImageUrl,
    },
    parameters: { gender: input.gender },
  }
  return createDashScopeTask(requestPayload, 'dashscope.createRefinerTask')
}

export async function queryTryOnTask(taskId: string) {
  ensureEnv()
  if (useMock) {
    return {
      output: {
        task_id: taskId,
        task_status: 'SUCCEEDED',
        image_url: `https://example.com/mock/${taskId}.jpg`,
      },
      usage: { image_count: 1 },
      request_id: crypto.randomUUID(),
    } satisfies DashScopeTaskQueryResponse
  }
  return requestJson<DashScopeTaskQueryResponse>({
    url: `${baseUrl}/api/v1/tasks/${taskId}`,
    method: 'GET',
    timeoutMs,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  })
}
