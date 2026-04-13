import { logger } from '@/lib/logger'

export class HttpClientError extends Error {
  status: number
  body: unknown
  retryAfter: string | null

  constructor(message: string, status: number, body: unknown, retryAfter: string | null = null) {
    super(message)
    this.status = status
    this.body = body
    this.retryAfter = retryAfter
  }
}

export class HttpTimeoutError extends Error {}

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'DELETE'
  headers?: HeadersInit
  body?: BodyInit
  timeoutMs?: number
}

export async function requestJson<T>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', headers, body, timeoutMs = 30000 } = options
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const start = Date.now()

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
      cache: 'no-store',
    })

    const text = await res.text()
    let parsed: unknown = null

    try {
      parsed = text ? (JSON.parse(text) as unknown) : null
    } catch {
      parsed = { raw: text }
    }

    if (!res.ok) {
      throw new HttpClientError(
        `Upstream request failed with ${res.status}`,
        res.status,
        parsed,
        res.headers.get('retry-after'),
      )
    }

    return parsed as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.error({
        event: 'http.timeout',
        url,
        timeoutMs,
        elapsedMs: Date.now() - start,
      })
      throw new HttpTimeoutError(`Request timed out in ${timeoutMs}ms`)
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}
