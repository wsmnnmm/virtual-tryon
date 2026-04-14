export interface TryOnCreateRequest {
  personImageUrl: string
  topGarmentUrl?: string
  bottomGarmentUrl?: string
}

export interface DashScopeCreateTaskRequest {
  model: 'aitryon-plus' | 'aitryon-refiner'
  input: {
    person_image_url?: string
    top_garment_url?: string
    bottom_garment_url?: string
    coarse_image_url?: string
  }
  parameters?: {
    resolution?: number
    restore_face?: boolean
    gender?: 'man' | 'woman'
  }
}

export interface DashScopeTaskOutput {
  task_id: string
  task_status: string
  image_url?: string
  results?: Array<{
    url?: string
  }>
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

export type DashScopeTaskQueryResponse = DashScopeCreateTaskResponse

export interface ApiErrorPayload {
  error: string
  message: string
  requestId?: string
  retryAfter?: string | null
}
