import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { HttpClientError, HttpTimeoutError } from '@/lib/services/httpClient'
import { createRefinerTask, createTryOnTask, waitForTask } from '@/lib/services/tryonService'
import type { ApiErrorPayload } from '@/types/tryon'

const requestSchema = z.object({
  personImageUrl: z.string().url(),
  topGarmentUrl: z.string().url().optional(),
  bottomGarmentUrl: z.string().url().optional(),
  refine: z.boolean().optional(),
  gender: z.enum(['man', 'woman']).optional(),
})

function errorResponse(status: number, payload: ApiErrorPayload) {
  return NextResponse.json(payload, { status })
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID()

  try {
    const body = await req.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse(400, {
        error: 'INVALID_INPUT',
        message: 'personImageUrl is required, and at least one of topGarmentUrl or bottomGarmentUrl must be provided',
        requestId,
      })
    }

    const { topGarmentUrl, bottomGarmentUrl, refine, gender } = parsed.data
    if (!topGarmentUrl && !bottomGarmentUrl) {
      return errorResponse(400, {
        error: 'INVALID_INPUT',
        message: 'At least one of topGarmentUrl or bottomGarmentUrl must be provided',
        requestId,
      })
    }

    const tryOn = await createTryOnTask({
      personImageUrl: parsed.data.personImageUrl,
      topGarmentUrl,
      bottomGarmentUrl,
    })

    const coarseTaskId = tryOn.output?.task_id
    const coarseResult = coarseTaskId ? await waitForTask(coarseTaskId) : tryOn
    const coarseImageUrl = coarseResult.output?.image_url ?? coarseResult.output?.results?.[0]?.url

    if (!refine) {
      return NextResponse.json({
        requestId,
        output: coarseResult.output,
        usage: coarseResult.usage,
      })
    }

    if (!coarseImageUrl) {
      return errorResponse(502, {
        error: 'UPSTREAM_ERROR',
        message: 'Try-on result image is missing',
        requestId,
      })
    }

    const refinedTask = await createRefinerTask({
      personImageUrl: parsed.data.personImageUrl,
      topGarmentUrl,
      bottomGarmentUrl,
      coarseImageUrl,
      gender,
    })

    const refinedTaskId = refinedTask.output?.task_id
    const refinedResult = refinedTaskId ? await waitForTask(refinedTaskId) : refinedTask
    const refinedImageUrl = refinedResult.output?.image_url ?? refinedResult.output?.results?.[0]?.url

    return NextResponse.json({
      requestId,
      output: {
        ...refinedResult.output,
        image_url: refinedImageUrl ?? coarseImageUrl,
        coarse_image_url: coarseImageUrl,
      },
      usage: refinedResult.usage,
    })
  } catch (error) {
    if (error instanceof HttpTimeoutError) {
      return errorResponse(504, {
        error: 'UPSTREAM_TIMEOUT',
        message: 'Try-on service timed out, please retry',
        requestId,
      })
    }

    if (error instanceof HttpClientError) {
      logger.error({
        event: 'tryon.request.error',
        route: 'dashscope.createTask',
        errorType: 'http_error',
        status: error.status,
        errorBody: error.body,
      })

      if (error.status === 401) {
        return errorResponse(401, {
          error: 'API_AUTH_FAILED',
          message: 'Upstream authentication failed',
          requestId,
        })
      }

      if (error.status === 429) {
        return errorResponse(429, {
          error: 'RATE_LIMITED',
          message: 'Rate limited by upstream service',
          requestId,
          retryAfter: error.retryAfter,
        })
      }

      return errorResponse(502, {
        error: 'UPSTREAM_ERROR',
        message: 'Try-on upstream service failed',
        requestId,
      })
    }

    logger.error({
      event: 'tryon.route.error',
      requestId,
      message: error instanceof Error ? error.message : 'unknown error',
    })

    return errorResponse(500, {
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId,
    })
  }
}
