import { logger } from '@/lib/logger'

export function summarizeUrl(url?: string) {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
  } catch {
    return url.slice(0, 120)
  }
}

export function ensureHttpsUrl(url?: string) {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:') parsed.protocol = 'https:'
    return parsed.toString()
  } catch {
    return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url
  }
}

export function logTryOn(event: string, payload: Record<string, unknown>) {
  logger.info({ event, ...payload })
}
