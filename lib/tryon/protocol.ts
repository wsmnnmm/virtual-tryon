export type TryOnJobStatus =
  | 'pending'
  | 'coarse_running'
  | 'coarse_succeeded'
  | 'refine_running'
  | 'succeeded'
  | 'failed'

export interface TryOnCreateRequest {
  personImageUrl: string
  topGarmentUrl?: string
  bottomGarmentUrl?: string
  refine?: boolean
  gender?: 'man' | 'woman'
}

export interface TryOnJobRecord {
  jobId: string
  status: TryOnJobStatus
  createdAt: string
  updatedAt: string
  personImageUrl: string
  topGarmentUrl?: string
  bottomGarmentUrl?: string
  refine?: boolean
  gender?: 'man' | 'woman'
  coarseTaskId?: string
  coarseImageUrl?: string
  refineTaskId?: string
  refinedImageUrl?: string
  error?: string
  errorMessage?: string
}

export interface TryOnCreateResponse {
  jobId: string
  status: TryOnJobStatus
  requestId: string
}

export interface TryOnStatusResponse {
  jobId: string
  status: TryOnJobStatus
  coarseTaskId?: string
  refineTaskId?: string
  coarseImageUrl?: string
  refinedImageUrl?: string
  error?: string
  errorMessage?: string
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
