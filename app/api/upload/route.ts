import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { HttpClientError, HttpTimeoutError } from '@/lib/services/httpClient'
import { createDirectUploadAuth } from '@/lib/services/storageService'
import type { ApiErrorPayload } from '@/types/tryon'

// Vercel/Next.js route handler hints:
// - Ensure the function has enough time budget for slow mobile networks.
// - Prefer running closer to OSS (oss-cn-beijing) to reduce latency.
export const runtime = 'nodejs'
export const maxDuration = 30
export const preferredRegion = ['hnd1', 'sin1', 'iad1']

function errorResponse(status: number, payload: ApiErrorPayload) {
  return NextResponse.json(payload, { status })
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID()

  try {
    const start = Date.now()
    const formData = await req.formData()
    const file = formData.get('file')
    const scene = formData.get('scene')

    if (!(file instanceof File)) {
      return errorResponse(400, {
        error: 'INVALID_INPUT',
        message: 'file is required in multipart/form-data',
        requestId,
      })
    }

    if (!file.type || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return errorResponse(400, {
        error: 'INVALID_FILE_TYPE',
        message: 'Only JPEG, PNG and WebP are allowed',
        requestId,
      })
    }

    logger.info({
      event: 'upload.route.start',
      requestId,
      scene: typeof scene === 'string' ? scene : 'unknown',
      fileType: file.type,
      fileSize: file.size,
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    const auth = createDirectUploadAuth(file, typeof scene === 'string' ? scene : undefined)

    logger.info({
      event: 'upload.route.success',
      requestId,
      elapsedMs: Date.now() - start,
      provider: auth.provider,
    })

    return NextResponse.json({
      requestId,
      success: true,
      provider: auth.provider,
      uploadUrl: auth.uploadUrl,
      publicUrl: auth.publicUrl,
      headers: auth.headers,
      mimeType: file.type,
      sizeBytes: file.size,
    })
  } catch (error) {
    if (error instanceof HttpTimeoutError) {
      logger.error({
        event: 'upload.route.timeout',
        requestId,
        message: error.message,
      })
      return errorResponse(504, {
        error: 'STORAGE_TIMEOUT',
        message: 'Storage upload timed out, please retry',
        requestId,
      })
    }

    if (error instanceof HttpClientError) {
      const upstreamError =
        typeof error.body === 'object' && error.body !== null && 'error' in error.body
          ? String((error.body as { error?: unknown }).error)
          : null

      if (error.status === 401) {
        return errorResponse(401, {
          error: 'STORAGE_UNAUTHORIZED',
          message: 'Storage token is invalid',
          requestId,
        })
      }

      if (error.status === 429 || upstreamError === 'RATE_LIMITED') {
        return errorResponse(429, {
          error: 'RATE_LIMITED',
          message: 'Storage service rate limited',
          requestId,
          retryAfter: error.retryAfter,
        })
      }

      if (upstreamError === 'FILE_TOO_LARGE') {
        return errorResponse(400, {
          error: 'FILE_TOO_LARGE',
          message: 'File exceeds the upload size limit',
          requestId,
        })
      }

      if (upstreamError === 'INVALID_FILE_TYPE') {
        return errorResponse(400, {
          error: 'INVALID_FILE_TYPE',
          message: 'Only JPEG, PNG and WebP are allowed',
          requestId,
        })
      }

      return errorResponse(502, {
        error: 'UPLOAD_FAILED',
        message: 'Storage upload failed',
        requestId,
      })
    }

    logger.error({
      event: 'upload.route.error',
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
