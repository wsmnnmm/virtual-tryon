import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { upsertJob } from '@/lib/tryon/jobStore'
import { logTryOn } from '@/lib/tryon/log'
import { runTryOnJob } from '@/lib/tryon/runner'
import type { TryOnCreateResponse, TryOnJobRecord } from '@/lib/tryon/protocol'

export const runtime = 'nodejs'
export const maxDuration = 60

const requestSchema = z.object({
  personImageUrl: z.string().url(),
  topGarmentUrl: z.string().url().optional(),
  bottomGarmentUrl: z.string().url().optional(),
  refine: z.boolean().optional(),
  gender: z.enum(['man', 'woman']).optional(),
})

export async function POST(req: Request) {
  const requestId = crypto.randomUUID()

  try {
    const body = await req.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT', message: 'Invalid tryon request', requestId }, { status: 400 })
    }

    if (!parsed.data.topGarmentUrl && !parsed.data.bottomGarmentUrl) {
      return NextResponse.json({ error: 'INVALID_INPUT', message: 'At least one garment url is required', requestId }, { status: 400 })
    }

    const jobId = crypto.randomUUID()
    const now = new Date().toISOString()

    const job: TryOnJobRecord = {
      jobId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      requestId,
      request: parsed.data,
    }
    upsertJob(job)

    logTryOn('tryon.job.created', {
      jobId,
      requestId,
      hasTopGarment: Boolean(parsed.data.topGarmentUrl),
      hasBottomGarment: Boolean(parsed.data.bottomGarmentUrl),
      refine: parsed.data.refine !== false,
    })

    void runTryOnJob(job).catch(error => {
      logger.error({
        event: 'tryon.job.background_error',
        jobId,
        requestId,
        message: error instanceof Error ? error.message : 'unknown error',
      })
    })

    const payload: TryOnCreateResponse = { jobId, status: 'pending', requestId }
    return NextResponse.json(payload, { status: 202 })
  } catch (error) {
    logger.error({
      event: 'tryon.create.error',
      requestId,
      message: error instanceof Error ? error.message : 'unknown error',
    })
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unable to create job', requestId }, { status: 500 })
  }
}
