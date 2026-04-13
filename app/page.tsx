'use client'

import { FormEvent, useMemo, useState } from 'react'

type UiState = 'idle' | 'uploading' | 'creating' | 'success' | 'error'

interface TryOnApiResponse {
  output?: {
    task_id?: string
    task_status?: string
    image_url?: string
  }
  usage?: {
    image_count?: number
  }
  requestId?: string
}

interface UploadApiResponse {
  success: boolean
  publicUrl?: string
  error?: string
  message?: string
}

export default function Page() {
  const [personFile, setPersonFile] = useState<File | null>(null)
  const [garmentFile, setGarmentFile] = useState<File | null>(null)
  const [personPreview, setPersonPreview] = useState<string>('')
  const [garmentPreview, setGarmentPreview] = useState<string>('')
  const [state, setState] = useState<UiState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TryOnApiResponse | null>(null)

  const canSubmit = useMemo(() => {
    return Boolean(personFile && garmentFile) && state !== 'uploading' && state !== 'creating'
  }, [personFile, garmentFile, state])

  const uploadOne = async (file: File, scene: 'person' | 'garment') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('scene', scene)

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    const payload = (await response.json()) as UploadApiResponse

    if (!response.ok || !payload.success || !payload.publicUrl) {
      throw new Error(payload.message ?? payload.error ?? '上传失败')
    }

    return payload.publicUrl
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!personFile || !garmentFile || !canSubmit) {
      return
    }

    setState('uploading')
    setError(null)
    setResult(null)

    try {
      const [personImageUrl, topGarmentUrl] = await Promise.all([
        uploadOne(personFile, 'person'),
        uploadOne(garmentFile, 'garment'),
      ])

      setState('creating')

      const response = await fetch('/api/tryon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ personImageUrl, topGarmentUrl }),
      })

      const payload = (await response.json()) as TryOnApiResponse & {
        error?: string
        message?: string
        retryAfter?: string
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('401：API Key 无效或已过期，请检查服务端配置')
        }
        if (response.status === 429) {
          throw new Error(`429：调用频率受限，请稍后重试${payload.retryAfter ? `（retry-after: ${payload.retryAfter}）` : ''}`)
        }
        if (response.status === 504) {
          throw new Error('timeout：上游服务超时，请稍后重试')
        }

        throw new Error(payload.message ?? payload.error ?? '请求失败，请稍后重试')
      }

      setResult(payload)
      setState('success')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '未知错误')
      setState('error')
    }
  }

  const busyText = state === 'uploading' ? 'Uploading images...' : state === 'creating' ? 'Creating task...' : 'Generate Try-On'

  return (
    <main className="container fade-in">
      <header className="hero">
        <h1>Try On Any Outfit</h1>
        <p>Upload your photo and a clothing item to preview the result.</p>
        <p className="tries">2 free tries remaining</p>
      </header>

      <form onSubmit={onSubmit} className="grid-two">
        <section className="card float-card">
          <div className="section-title">Your Photo</div>
          <p className="section-subtitle">Upload a full-body photo of yourself</p>

          <label className="field">
            <span className="field-label">Person Photo</span>
            <input
              className="input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                setPersonFile(file)
                setPersonPreview(file ? URL.createObjectURL(file) : '')
              }}
            />
          </label>

          <div className="preview-box frosted">
            {personPreview ? <img src={personPreview} alt="person" className="preview-image" /> : 'Preview'}
          </div>
        </section>

        <section className="card float-card">
          <div className="section-title">Clothing Item</div>
          <p className="section-subtitle">Upload the clothing you want to try</p>

          <label className="field">
            <span className="field-label">Garment Photo</span>
            <input
              className="input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                setGarmentFile(file)
                setGarmentPreview(file ? URL.createObjectURL(file) : '')
              }}
            />
          </label>

          <div className="preview-box frosted">
            {garmentPreview ? <img src={garmentPreview} alt="garment" className="preview-image" /> : 'Preview'}
          </div>
        </section>

        <div className="actions-row action-buttons">
          <button className="button-primary" type="submit" disabled={!canSubmit}>
            {busyText}
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() => {
              setPersonFile(null)
              setGarmentFile(null)
              setPersonPreview('')
              setGarmentPreview('')
              setResult(null)
              setError(null)
              setState('idle')
            }}
          >
            Try Another
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {result?.output && (
        <section className="card result-card fade-up">
          <div className="result-head">
            <div>
              <div className="section-title">Your Try-On Result</div>
              <p className="section-subtitle">This is a preview for reference only</p>
            </div>
            <span className="status-chip">{result.output.task_status ?? '-'}</span>
          </div>

          <div className="result-media frosted">
            {result.output.image_url ? (
              <img src={result.output.image_url} alt="try-on result" className="result-image" />
            ) : (
              <div className="result-placeholder">Task created. Polling endpoint can fetch final image later.</div>
            )}
          </div>

          <div className="meta-row">
            <span>task_id: {result.output.task_id ?? '-'}</span>
            <span>image_count: {result.usage?.image_count ?? '-'}</span>
            <span>requestId: {result.requestId ?? '-'}</span>
          </div>
        </section>
      )}
    </main>
  )
}
