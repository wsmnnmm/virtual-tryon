import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getJob } from '@/lib/tryon/jobStore'
import { ensureHttpsUrl } from '@/lib/tryon/log'
import type { TryOnStatusResponse } from '@/lib/tryon/protocol'

export const runtime = 'nodejs'
export const maxDuration = 10

const querySchema = z.object({ jobId: z.string().min(1) })

export async function GET(req: Request) {
  const url = new URL(req.url)
  const parsed = querySchema.safeParse({ jobId: url.searchParams.get('jobId') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'jobId is required' }, { status: 400 })
  }

  const job = await getJob(parsed.data.jobId)
  if (!job) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Job not found', jobId: parsed.data.jobId }, { status: 404 })
  }

  const payload: TryOnStatusResponse = {
    jobId: job.jobId,
    status: job.status,
    requestId: job.requestId,
    coarseTaskId: job.coarseTaskId,
    refineTaskId: job.refineTaskId,
    coarseImageUrl: ensureHttpsUrl(job.coarseImageUrl),
    refinedImageUrl: ensureHttpsUrl(job.refinedImageUrl),
    error: job.error,
    errorMessage: job.errorMessage,
  }

  return NextResponse.json(payload)
}
