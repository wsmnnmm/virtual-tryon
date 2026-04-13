export interface CozeUploadResponse {
  success: boolean
  asset_id?: string
  public_url?: string
  mime_type?: string
  size_bytes?: number
  width?: number
  height?: number
  created_at?: string
  request_id?: string
  error?: string
  message?: string
}

export interface StorageUploadResult {
  assetId: string
  publicUrl: string
  mimeType?: string
  sizeBytes?: number
  width?: number
  height?: number
  createdAt?: string
  requestId?: string
}
