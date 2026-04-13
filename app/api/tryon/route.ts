import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { HttpClientError, HttpTimeoutError } from '@/lib/services/httpClient'
import { createTryOnTask } from '@/lib/services/tryonService'
import type { ApiErrorPayload } from '@/types/tryon'

const requestSchema = z.object({
  personImageUrl: z.string().url(),
  topGarmentUrl: z.string().url(),
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
        message: 'personImageUrl and topGarmentUrl must be valid URL strings',
        requestId,
      })
    }

    const result = await createTryOnTask(parsed.data)

    return NextResponse.json({
      requestId,
      output: result.output,
      usage: result.usage,
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
