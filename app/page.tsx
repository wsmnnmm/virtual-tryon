'use client'

/* eslint-disable @next/next/no-img-element */
import { FormEvent, useMemo, useState } from 'react'

type UiState = 'idle' | 'uploading' | 'creating' | 'success' | 'error'
type PickerType = 'sample' | 'upload'

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

const PERSON_SAMPLES = [
  {
    id: 'p1',
    name: 'Studio 模特',
    url: 'https://coze-coding-project.tos.coze.site/coze_storage_7628204427257708580/uploads/1776082041699_ast_mnx5e25f_u73grjwd_68c012d5.jpg?sign=1778674042-23f3d5e294-0-51ba46e30d65b33685231b72e59ec7ecf2d1f2789f0a73fae2cf230265e3aa90',
  },
  {
    id: 'p2',
    name: '街拍风格',
    url: 'https://coze-coding-project.tos.coze.site/coze_storage_7628204427257708580/uploads/1776082093383_ast_mnx5f613_lg384m6y_a923f5e3.jpg?sign=1778674093-210db0bf52-0-58160287910092e680e7212b04142c07cf255a9fbd22e7dc500348281dc22b07',
  },
]

const GARMENT_SAMPLES = [
  {
    id: 'g1',
    name: '蓝色上衣',
    url: 'https://coze-coding-project.tos.coze.site/coze_storage_7628204427257708580/uploads/1776082045598_ast_mnx5e55q_f4jxrnbf_cc32b983.jpg?sign=1778674046-7ccd8c91ec-0-d56bf3a70da77d1c9383f8d28e0688c976e861136395d6e38a2c1d0d468782cb',
  },
  {
    id: 'g2',
    name: '连衣裙',
    url: 'https://coze-coding-project.tos.coze.site/coze_storage_7628204427257708580/uploads/1776082094007_ast_mnx5f6if_vt0l8pc4_af05a376.jpg?sign=1778674094-32862261ae-0-ce7ed2667073bb06c7392aff6c220a94115501d8988d1a23ee0e5ebdb071eaef',
  },
  {
    id: 'g3',
    name: '男士西装',
    url: 'https://coze-coding-project.tos.coze.site/coze_storage_7628204427257708580/uploads/1776082094520_ast_mnx5f6wo_jaefxx3i_e2ffade6.jpg?sign=1778674094-2e90ba3141-0-e8bfa8e937e6ac7c1cff6d145589fa6ca0845d1ba80f28c5b98cb800fcc532bb',
  },
  {
    id: 'g4',
    name: '休闲卫衣',
    url: 'https://coze-coding-project.tos.coze.site/coze_storage_7628204427257708580/uploads/1776082117963_ast_mnx5fozv_53xn3hzg_072f59f5.jpg?sign=1778674118-afe4a1615c-0-fd900eed13911860ae057a1c4c3888ec8801034c73b089cc81c2d6a0616daddc',
  },
]

export default function Page() {
  const [personPickerType, setPersonPickerType] = useState<PickerType>('sample')
  const [garmentPickerType, setGarmentPickerType] = useState<PickerType>('sample')

  const [personSampleUrl, setPersonSampleUrl] = useState<string>(PERSON_SAMPLES[0].url)
  const [garmentSampleUrl, setGarmentSampleUrl] = useState<string>(GARMENT_SAMPLES[0].url)

  const [personFile, setPersonFile] = useState<File | null>(null)
  const [garmentFile, setGarmentFile] = useState<File | null>(null)
  const [personPreview, setPersonPreview] = useState<string>('')
  const [garmentPreview, setGarmentPreview] = useState<string>('')

  const [state, setState] = useState<UiState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TryOnApiResponse | null>(null)

  const personReady = personPickerType === 'sample' ? Boolean(personSampleUrl) : Boolean(personFile)
  const garmentReady = garmentPickerType === 'sample' ? Boolean(garmentSampleUrl) : Boolean(garmentFile)

  const canSubmit = useMemo(() => {
    return personReady && garmentReady && state !== 'uploading' && state !== 'creating'
  }, [personReady, garmentReady, state])

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

  const resolvePersonImageUrl = async () => {
    if (personPickerType === 'sample') return personSampleUrl
    if (!personFile) throw new Error('请先上传人物照片')
    return uploadOne(personFile, 'person')
  }

  const resolveGarmentImageUrl = async () => {
    if (garmentPickerType === 'sample') return garmentSampleUrl
    if (!garmentFile) throw new Error('请先上传服饰图片')
    return uploadOne(garmentFile, 'garment')
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return

    setState('uploading')
    setError(null)
    setResult(null)

    try {
      const [personImageUrl, topGarmentUrl] = await Promise.all([resolvePersonImageUrl(), resolveGarmentImageUrl()])

      setState('creating')

      const response = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personImageUrl, topGarmentUrl }),
      })

      const payload = (await response.json()) as TryOnApiResponse & {
        error?: string
        message?: string
        retryAfter?: string
      }

      if (!response.ok) {
        if (response.status === 401) throw new Error('401：API Key 无效或已过期，请检查服务端配置')
        if (response.status === 429) throw new Error(`429：请求频率受限，请稍后重试${payload.retryAfter ? `（retry-after: ${payload.retryAfter}）` : ''}`)
        if (response.status === 504) throw new Error('timeout：上游服务超时，请稍后重试')
        throw new Error(payload.message ?? payload.error ?? '请求失败，请稍后重试')
      }

      setResult(payload)
      setState('success')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '未知错误')
      setState('error')
    }
  }

  const resetAll = () => {
    setPersonPickerType('sample')
    setGarmentPickerType('sample')
    setPersonSampleUrl(PERSON_SAMPLES[0].url)
    setGarmentSampleUrl(GARMENT_SAMPLES[0].url)

    setPersonFile(null)
    setGarmentFile(null)
    setPersonPreview('')
    setGarmentPreview('')

    setResult(null)
    setError(null)
    setState('idle')
  }

  const personDisplayUrl = personPickerType === 'sample' ? personSampleUrl : personPreview
  const garmentDisplayUrl = garmentPickerType === 'sample' ? garmentSampleUrl : garmentPreview

  const busyText = state === 'uploading' ? 'Uploading...' : state === 'creating' ? 'Generating...' : 'Generate Try-On'

  return (
    <main className="container">
      <header className="hero">
        <h1>Try On Any Outfit</h1>
        <p>上传人物照 + 服饰图，1 步生成试穿结果</p>
        <p className="tries">Simple · Fast · Easy</p>
      </header>

      <form onSubmit={onSubmit}>
        <div className="grid-two">
          <section className="card">
            <h2 className="section-title">Your Photo</h2>
            <p className="section-subtitle">选择示例人物或上传自己的照片</p>

            <div className="picker-tabs">
              <button type="button" className={`tab-btn ${personPickerType === 'sample' ? 'active' : ''}`} onClick={() => setPersonPickerType('sample')}>
                示例人物
              </button>
              <button type="button" className={`tab-btn ${personPickerType === 'upload' ? 'active' : ''}`} onClick={() => setPersonPickerType('upload')}>
                上传人物
              </button>
            </div>

            {personPickerType === 'sample' ? (
              <div className="samples-grid two">
                {PERSON_SAMPLES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`sample-item ${personSampleUrl === item.url ? 'active' : ''}`}
                    onClick={() => setPersonSampleUrl(item.url)}
                  >
                    <img src={item.url} alt={item.name} />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <label className="field-label">Person Photo</label>
                <p className="field-tip">建议全身站姿、光线清晰</p>
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
              </>
            )}

            <div className="preview-box">
              {personDisplayUrl ? <img src={personDisplayUrl} alt="person" className="preview-image" /> : 'Preview'}
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">Clothing Item</h2>
            <p className="section-subtitle">选择示例服饰或上传自己的服饰图</p>

            <div className="picker-tabs">
              <button type="button" className={`tab-btn ${garmentPickerType === 'sample' ? 'active' : ''}`} onClick={() => setGarmentPickerType('sample')}>
                示例服饰
              </button>
              <button type="button" className={`tab-btn ${garmentPickerType === 'upload' ? 'active' : ''}`} onClick={() => setGarmentPickerType('upload')}>
                上传服饰
              </button>
            </div>

            {garmentPickerType === 'sample' ? (
              <div className="samples-grid four">
                {GARMENT_SAMPLES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`sample-item ${garmentSampleUrl === item.url ? 'active' : ''}`}
                    onClick={() => setGarmentSampleUrl(item.url)}
                  >
                    <img src={item.url} alt={item.name} />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <label className="field-label">Garment Photo</label>
                <p className="field-tip">支持上衣、裤装、连衣裙等</p>
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
              </>
            )}

            <div className="preview-box">
              {garmentDisplayUrl ? <img src={garmentDisplayUrl} alt="garment" className="preview-image" /> : 'Preview'}
            </div>
          </section>
        </div>

        <div className="actions-row">
          <button className="button-primary" type="submit" disabled={!canSubmit}>
            {busyText}
          </button>
          <button className="button-secondary" type="button" onClick={resetAll}>
            Try Another
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {result?.output && (
        <section className="card result-card">
          <div className="result-head">
            <h2 className="result-title">✧ Your Try-On Result</h2>
            <p className="result-subtitle">This is a preview for reference only</p>
          </div>

          <div className="result-media">
            {result.output.image_url ? (
              <img src={result.output.image_url} alt="try-on result" className="result-image fit" />
            ) : (
              <div className="result-placeholder">任务已创建，正在等待最终图片。</div>
            )}
          </div>

          <div className="result-actions">
            <button className="button-light" type="button" onClick={resetAll}>
              ↻ Try Another
            </button>
            <a className="button-dark" href={result.output.image_url ?? '#'} download>
              ⇩ Download
            </a>
          </div>
        </section>
      )}
    </main>
  )
}
