import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST() {
  return NextResponse.json(
    {
      error: 'DEPRECATED_ENDPOINT',
      message: 'Use POST /api/tryon/create then GET /api/tryon/status?jobId=...',
    },
    { status: 409 }
  )
}
