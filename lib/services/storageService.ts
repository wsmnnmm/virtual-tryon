import { logger } from '@/lib/logger'
import { HttpClientError, HttpTimeoutError, requestJson } from '@/lib/services/httpClient'
import type { CozeUploadResponse, StorageUploadResult } from '@/types/storage'

const storageBaseUrl = process.env.COZE_STORAGE_BASE_URL
const storageToken = process.env.STORAGE_TOKEN
const storageTimeoutMs = Number(process.env.COZE_STORAGE_TIMEOUT_MS ?? '30000')

function ensureStorageEnv() {
  if (!storageBaseUrl) {
    throw new Error('COZE_STORAGE_BASE_URL is missing on server environment')
  }

  if (!storageToken) {
    throw new Error('STORAGE_TOKEN is missing on server environment')
  }
}

export async function uploadToCozeStorage(file: File, scene?: string): Promise<StorageUploadResult> {
  ensureStorageEnv()

  const form = new FormData()
  form.append('file', file)

  if (scene) {
    form.append('scene', scene)
  }

  const token = storageToken as string

  const start = Date.now()
  logger.info({
    event: 'storage.upload.start',
    fileType: file.type,
    fileSize: file.size,
    scene: scene ?? 'unknown',
  })

  try {
    const res = await requestJson<CozeUploadResponse>({
      url: `${storageBaseUrl}/api/storage/upload`,
      method: 'POST',
      headers: {
        'X-Storage-Token': token,
      },
      body: form,
      timeoutMs: storageTimeoutMs,
    })

    if (!res.success || !res.asset_id || !res.public_url) {
      throw new HttpClientError('Storage upload failed', 502, res)
    }

    logger.info({
      event: 'storage.upload.success',
      elapsedMs: Date.now() - start,
      assetId: res.asset_id,
      requestId: res.request_id,
    })

    return {
      assetId: res.asset_id,
      publicUrl: res.public_url,
      mimeType: res.mime_type,
      sizeBytes: res.size_bytes,
      width: res.width,
      height: res.height,
      createdAt: res.created_at,
      requestId: res.request_id,
    }
  } catch (error) {
    if (error instanceof HttpTimeoutError) {
      logger.error({
        event: 'storage.upload.error',
        errorType: 'timeout',
        elapsedMs: Date.now() - start,
      })
      throw error
    }

    if (error instanceof HttpClientError) {
      logger.error({
        event: 'storage.upload.error',
        errorType: 'http_error',
        status: error.status,
        elapsedMs: Date.now() - start,
      })
      throw error
    }

    logger.error({
      event: 'storage.upload.error',
      errorType: 'unknown',
      elapsedMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'unknown error',
    })
    throw error
  }
}
