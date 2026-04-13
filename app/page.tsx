'use client'

import { FormEvent, useMemo, useState } from 'react'

type UiState = 'idle' | 'loading' | 'success' | 'error'

interface TryOnApiResponse {
  output?: {
    task_id?: string
    task_status?: string
    image_url?: string
  }
  usage?: {
    image_count?: number
  }
  error?: string
  message?: string
  requestId?: string
  retryAfter?: string | null
}

export default function Page() {
  const [personImageUrl, setPersonImageUrl] = useState('')
  const [topGarmentUrl, setTopGarmentUrl] = useState('')
  const [state, setState] = useState<UiState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TryOnApiResponse | null>(null)

  const canSubmit = useMemo(() => {
    return Boolean(personImageUrl.trim() && topGarmentUrl.trim()) && state !== 'loading'
  }, [personImageUrl, topGarmentUrl, state])

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return

    setState('loading')
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/tryon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ personImageUrl, topGarmentUrl }),
      })

      const payload = (await response.json()) as TryOnApiResponse

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('401：API Key 无效或已过期，请检查服务端配置')
        }
        if (response.status === 429) {
          throw new Error(
            `429：调用频率受限，请稍后重试${payload.retryAfter ? `（retry-after: ${payload.retryAfter}）` : ''}`,
          )
        }
        if (response.status === 504) {
          throw new Error('timeout：上游服务超时，请稍后重试')
        }

        throw new Error(payload.message ?? '请求失败，请稍后重试')
      }

      setResult(payload)
      setState('success')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '未知错误')
      setState('error')
    }
  }

  return (
    <main className="container">
      <header className="hero">
        <h1>Try On Any Outfit</h1>
        <p>Upload your photo and a clothing item to preview the result.</p>
        <p className="tries">2 free tries remaining</p>
      </header>

      <form onSubmit={onSubmit} className="grid-two">
        <section className="card">
          <div className="section-title">Your Photo</div>
          <p className="section-subtitle">Upload a full-body photo of yourself</p>

          <label className="field">
            <span className="field-label">Person Photo URL</span>
            <input
              className="input"
              placeholder="https://.../person.jpg"
              value={personImageUrl}
              onChange={(e) => setPersonImageUrl(e.target.value)}
            />
          </label>

          <div className="preview-box">
            {personImageUrl ? <img src={personImageUrl} alt="person" className="preview-image" /> : 'Preview'}
          </div>
        </section>

        <section className="card">
          <div className="section-title">Clothing Item</div>
          <p className="section-subtitle">Upload the clothing you want to try</p>

          <label className="field">
            <span className="field-label">Garment Photo URL</span>
            <input
              className="input"
              placeholder="https://.../garment.jpg"
              value={topGarmentUrl}
              onChange={(e) => setTopGarmentUrl(e.target.value)}
            />
          </label>

          <div className="preview-box">
            {topGarmentUrl ? (
              <img src={topGarmentUrl} alt="garment" className="preview-image" />
            ) : (
              'Preview'
            )}
          </div>
        </section>

        <div className="actions-row">
          <button className="button-primary" type="submit" disabled={!canSubmit}>
            {state === 'loading' ? 'Creating task...' : 'Generate Try-On'}
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {result?.output && (
        <section className="card result-card">
          <div className="result-head">
            <div>
              <div className="section-title">Your Try-On Result</div>
              <p className="section-subtitle">This is a preview for reference only</p>
            </div>
            <span className="status-chip">{result.output.task_status ?? '-'}</span>
          </div>

          <div className="result-media">
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
