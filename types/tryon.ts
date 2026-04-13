export interface TryOnCreateRequest {
  personImageUrl: string
  topGarmentUrl: string
}

export interface DashScopeCreateTaskRequest {
  model: 'aitryon'
  input: {
    person_image_url: string
    top_garment_url: string
  }
}

export interface DashScopeTaskOutput {
  task_id: string
  task_status: string
  image_url?: string
}

export interface DashScopeCreateTaskResponse {
  output: DashScopeTaskOutput
  usage?: {
    image_count?: number
  }
  code?: string
  message?: string
  request_id?: string
}

export interface ApiErrorPayload {
  error: string
  message: string
  requestId?: string
  retryAfter?: string | null
}
