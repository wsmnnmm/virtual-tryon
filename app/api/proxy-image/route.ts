import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import https from 'https'
import http from 'http'

const PROXY_TIMEOUT_MS = 30000

export async function GET(req: Request) {
  const requestId = crypto.randomUUID()

  try {
    const { searchParams } = new URL(req.url)
    const imageUrl = searchParams.get('url')

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'MISSING_URL', message: 'url parameter is required', requestId },
        { status: 400 },
      )
    }

    logger.info({
      event: 'proxy.image.start',
      requestId,
      imageUrl,
    })

    const urlObj = new URL(imageUrl)
    const isHttps = urlObj.protocol === 'https:'
    const client = isHttps ? https : http

    return await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        logger.error({
          event: 'proxy.image.timeout',
          requestId,
          imageUrl,
        })
        resolve(NextResponse.json(
          { error: 'TIMEOUT', message: 'Image fetch timed out', requestId },
          { status: 504 },
        ))
      }, PROXY_TIMEOUT_MS)

      const proxyReq = client.get(imageUrl, { headers: { Accept: 'image/*' } }, (proxyRes) => {
        clearTimeout(timeout)

        if (!proxyRes.ok) {
          logger.error({
            event: 'proxy.image.upstream_error',
            requestId,
            status: proxyRes.statusCode,
            imageUrl,
          })
          resolve(NextResponse.json(
            { error: 'UPSTREAM_ERROR', status: proxyRes.statusCode, message: 'Failed to fetch image', requestId },
            { status: 502 },
          ))
          return
        }

        const chunks: Buffer[] = []
        proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk))
        proxyRes.on('end', () => {
          const buffer = Buffer.concat(chunks)
          const contentType = proxyRes.headers['content-type'] || 'image/jpeg'

          logger.info({
            event: 'proxy.image.success',
            requestId,
            size: buffer.length,
            contentType,
          })

          resolve(new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(buffer.length),
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*',
            },
          }))
        })
        proxyRes.on('error', (err) => {
          logger.error({
            event: 'proxy.image.stream_error',
            requestId,
            message: err.message,
            imageUrl,
          })
          resolve(NextResponse.json(
            { error: 'STREAM_ERROR', message: err.message, requestId },
            { status: 502 },
          ))
        })
      })

      proxyReq.on('error', (err) => {
        clearTimeout(timeout)
        logger.error({
          event: 'proxy.image.request_error',
          requestId,
          message: err.message,
          imageUrl,
        })
        resolve(NextResponse.json(
          { error: 'REQUEST_ERROR', message: err.message, requestId },
          { status: 502 },
        ))
      })
    })
  } catch (error) {
    logger.error({
      event: 'proxy.image.error',
      requestId,
      message: error instanceof Error ? error.message : 'unknown error',
    })

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'unknown error', requestId },
      { status: 500 },
    )
  }
}
