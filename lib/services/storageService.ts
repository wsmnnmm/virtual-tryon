import crypto from 'node:crypto'
import { logger } from '@/lib/logger'
import { HttpClientError, HttpTimeoutError } from '@/lib/services/httpClient'
import type { StorageUploadResult } from '@/types/storage'

// Tencent COS config
const cosSecretId = process.env.COS_SECRET_ID
const cosSecretKey = process.env.COS_SECRET_KEY
const cosBucket = process.env.COS_BUCKET
const cosRegion = process.env.COS_REGION
const cosPublicBaseUrl = process.env.COS_PUBLIC_BASE_URL

// Aliyun OSS config
const ossSecretId = process.env.OSS_SECRET_ID
const ossSecretKey = process.env.OSS_SECRET_KEY
const ossBucket = process.env.OSS_BUCKET
const ossRegion = process.env.OSS_REGION
const ossPublicBaseUrl = process.env.OSS_PUBLIC_BASE_URL

const maxFileSizeBytes = Number(process.env.OSS_MAX_FILE_SIZE_BYTES ?? process.env.COS_MAX_FILE_SIZE_BYTES ?? String(10 * 1024 * 1024))
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

function ensureStorageEnv() {
  // Try OSS first, then COS
  if (ossSecretId && ossSecretKey && ossBucket && ossRegion) {
    return 'oss'
  }
  if (cosSecretId && cosSecretKey && cosBucket && cosRegion) {
    return 'cos'
  }
  throw new Error('No storage configured: missing OSS or COS credentials')
}

function sha1Hex(content: string) {
  return crypto.createHash('sha1').update(content).digest('hex')
}

function hmacSha1Hex(key: string, content: string) {
  return crypto.createHmac('sha1', key).update(content).digest('hex')
}

// Tencent COS signature
function createCosAuthorization(host: string, objectKey: string) {
  const now = Math.floor(Date.now() / 1000) - 60
  const expired = now + 10 * 60
  const signTime = `${now};${expired}`

  const httpString = `put\n/${objectKey}\n\nhost=${host}\n`
  const stringToSign = `sha1\n${signTime}\n${sha1Hex(httpString)}\n`
  const signKey = hmacSha1Hex(cosSecretKey as string, signTime)
  const signature = hmacSha1Hex(signKey, stringToSign)

  return `q-sign-algorithm=sha1&q-ak=${cosSecretId}&q-sign-time=${signTime}&q-key-time=${signTime}&q-header-list=host&q-url-param-list=&q-signature=${signature}`
}

export function createCosUploadAuth(objectKey: string) {
  const host = `${cosBucket}.cos.${cosRegion}.myqcloud.com`
  const uploadUrl = `https://${host}/${objectKey}`
  const publicBase = (cosPublicBaseUrl || `https://${host}`).replace(/\/$/, '')
  const publicUrl = `${publicBase}/${objectKey}`
  const authorization = createCosAuthorization(host, objectKey)

  return {
    provider: 'cos' as const,
    uploadUrl,
    publicUrl,
    headers: {
      Authorization: authorization,
    },
  }
}

// Mobile (especially WeChat WebView) uploads can be much slower on cellular networks.
// Default to a more forgiving timeout unless explicitly configured.
const uploadTimeoutMs = Number(process.env.OSS_UPLOAD_TIMEOUT_MS ?? process.env.COS_UPLOAD_TIMEOUT_MS ?? '120000')

// Aliyun OSS signature v1
function createOssAuthorization(method: string, objectKey: string, contentType: string, date: string) {
  const signature = `${method}\n\n${contentType}\n${date}\n/${ossBucket}/${objectKey}`
  const signatureBase64 = crypto.createHmac('sha1', ossSecretKey as string).update(signature).digest('base64')
  return `OSS ${ossSecretId}:${signatureBase64}`
}

export function createOssUploadAuth(objectKey: string, contentType: string) {
  const host = `${ossBucket}.oss-cn-${ossRegion}.aliyuncs.com`
  const uploadUrl = `https://${host}/${objectKey}`
  const publicBase = (ossPublicBaseUrl || `https://${host}`).replace(/\/$/, '')
  const publicUrl = `${publicBase}/${objectKey}`
  const date = new Date().toUTCString()
  const authorization = createOssAuthorization('PUT', objectKey, contentType, date)

  return {
    provider: 'oss' as const,
    uploadUrl,
    publicUrl,
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      Date: date,
    },
  }
}

function createObjectKey(file: File, scene?: string) {
  const extByMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }

  const ext = extByMime[file.type] ?? (file.name.split('.').pop() || 'jpg')
  const safeScene = scene && /^[a-zA-Z0-9_-]+$/.test(scene) ? scene : 'general'
  return `uploads/${safeScene}/${Date.now()}_${crypto.randomUUID()}.${ext}`
}

function getProvider() {
  return ensureStorageEnv()
}

export async function uploadToCozeStorage(file: File, scene?: string): Promise<StorageUploadResult> {
  const provider = getProvider()

  if (!allowedMimeTypes.has(file.type)) {
    throw new HttpClientError('INVALID_FILE_TYPE', 400, { error: 'INVALID_FILE_TYPE' })
  }

  if (file.size > maxFileSizeBytes) {
    throw new HttpClientError('FILE_TOO_LARGE', 400, { error: 'FILE_TOO_LARGE' })
  }

  if (provider === 'oss') {
    return uploadToOss(file, scene)
  } else {
    return uploadToCos(file, scene)
  }
}

export function createDirectUploadAuth(file: File, scene?: string) {
  const objectKey = createObjectKey(file, scene)
  const provider = getProvider()

  if (provider === 'oss') {
    return createOssUploadAuth(objectKey, file.type)
  }

  return createCosUploadAuth(objectKey)
}

export function createFallbackUploadResult(file: File, scene?: string): StorageUploadResult {
  const objectKey = createObjectKey(file, scene)
  const provider = getProvider()

  if (provider === 'oss') {
    const host = `${ossBucket}.oss-cn-${ossRegion}.aliyuncs.com`
    const publicBase = (ossPublicBaseUrl || `https://${host}`).replace(/\/$/, '')
    return {
      assetId: objectKey,
      publicUrl: `${publicBase}/${objectKey}`,
      mimeType: file.type,
      sizeBytes: file.size,
    }
  }

  const host = `${cosBucket}.cos.${cosRegion}.myqcloud.com`
  const publicBase = (cosPublicBaseUrl || `https://${host}`).replace(/\/$/, '')
  return {
    assetId: objectKey,
    publicUrl: `${publicBase}/${objectKey}`,
    mimeType: file.type,
    sizeBytes: file.size,
  }
}

async function uploadToOss(file: File, scene?: string): Promise<StorageUploadResult> {
  const objectKey = createObjectKey(file, scene)
  const host = `${ossBucket}.oss-cn-${ossRegion}.aliyuncs.com`
  const uploadUrl = `https://${host}/${objectKey}`
  const publicBase = (ossPublicBaseUrl || `https://${host}`).replace(/\/$/, '')
  const publicUrl = `${publicBase}/${objectKey}`

  const date = new Date().toUTCString()
  const authorization = createOssAuthorization('PUT', objectKey, file.type, date)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), uploadTimeoutMs)

  const start = Date.now()
  logger.info({
    event: 'storage.upload.start',
    provider: 'aliyun-oss',
    fileType: file.type,
    fileSize: file.size,
    scene: scene ?? 'unknown',
  })

  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: authorization,
        'Content-Type': file.type,
        'Content-Length': String(file.size),
        Date: date,
      },
      // File is a Blob in the browser/runtime and can be sent directly.
      body: file as unknown as BodyInit,
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new HttpClientError('OSS_UPLOAD_FAILED', response.status, errorBody)
    }

    const requestId = response.headers.get('x-oss-request-id') ?? undefined

    logger.info({
      event: 'storage.upload.success',
      provider: 'aliyun-oss',
      elapsedMs: Date.now() - start,
      objectKey,
      requestId,
    })

    return {
      assetId: objectKey,
      publicUrl,
      mimeType: file.type,
      sizeBytes: file.size,
      requestId,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.error({
        event: 'storage.upload.error',
        provider: 'aliyun-oss',
        errorType: 'timeout',
        elapsedMs: Date.now() - start,
      })
      throw new HttpTimeoutError('OSS upload timed out')
    }

    if (error instanceof HttpTimeoutError || error instanceof HttpClientError) {
      logger.error({
        event: 'storage.upload.error',
        provider: 'aliyun-oss',
        errorType: error instanceof HttpTimeoutError ? 'timeout' : 'http_error',
        status: error instanceof HttpClientError ? error.status : undefined,
        elapsedMs: Date.now() - start,
      })
      throw error
    }

    logger.error({
      event: 'storage.upload.error',
      provider: 'aliyun-oss',
      errorType: 'unknown',
      elapsedMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'unknown error',
    })
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function uploadToCos(file: File, scene?: string): Promise<StorageUploadResult> {
  const objectKey = createObjectKey(file, scene)
  const host = `${cosBucket}.cos.${cosRegion}.myqcloud.com`
  const uploadUrl = `https://${host}/${objectKey}`
  const publicBase = (cosPublicBaseUrl || `https://${host}`).replace(/\/$/, '')
  const publicUrl = `${publicBase}/${objectKey}`
  const authorization = createCosAuthorization(host, objectKey)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), uploadTimeoutMs)

  const start = Date.now()
  logger.info({
    event: 'storage.upload.start',
    provider: 'tencent-cos',
    fileType: file.type,
    fileSize: file.size,
    scene: scene ?? 'unknown',
  })

  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: authorization,
        'Content-Type': file.type,
        'Content-Length': String(file.size),
      },
      body: Readable.fromWeb(file.stream() as unknown as ReadableStream),
      duplex: 'half',
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new HttpClientError('COS_UPLOAD_FAILED', response.status, errorBody)
    }

    const requestId = response.headers.get('x-cos-request-id') ?? undefined

    logger.info({
      event: 'storage.upload.success',
      provider: 'tencent-cos',
      elapsedMs: Date.now() - start,
      objectKey,
      requestId,
    })

    return {
      assetId: objectKey,
      publicUrl,
      mimeType: file.type,
      sizeBytes: file.size,
      requestId,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.error({
        event: 'storage.upload.error',
        provider: 'tencent-cos',
        errorType: 'timeout',
        elapsedMs: Date.now() - start,
      })
      throw new HttpTimeoutError('COS upload timed out')
    }

    if (error instanceof HttpTimeoutError || error instanceof HttpClientError) {
      logger.error({
        event: 'storage.upload.error',
        provider: 'tencent-cos',
        errorType: error instanceof HttpTimeoutError ? 'timeout' : 'http_error',
        status: error instanceof HttpClientError ? error.status : undefined,
        elapsedMs: Date.now() - start,
      })
      throw error
    }

    logger.error({
      event: 'storage.upload.error',
      provider: 'tencent-cos',
      errorType: 'unknown',
      elapsedMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'unknown error',
    })
    throw error
  } finally {
    clearTimeout(timer)
  }
}