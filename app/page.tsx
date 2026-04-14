'use client'

/* eslint-disable @next/next/no-img-element */
import { FormEvent, useMemo, useState } from 'react'
import { Upload, Shirt, User, Sparkles, RotateCcw, Download, ImageIcon, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type UiState = 'idle' | 'uploading' | 'creating' | 'success' | 'error'

interface TryOnApiResponse {
  output?: {
    task_id?: string
    task_status?: string
    image_url?: string
    results?: Array<{ url?: string }>
  }
  usage?: { image_count?: number }
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
    name: '全身正面',
    url: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250626/ubznva/model_person.png',
  },
]

const GARMENT_SAMPLES = [
  {
    id: 'g1',
    name: '上衣模板',
    url: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250626/epousa/short_sleeve.jpeg',
  },
  {
    id: 'g2',
    name: '下装模板',
    url: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250626/rchumi/pants.jpeg',
  },
]

export default function Page() {
  const [personSampleUrl, setPersonSampleUrl] = useState('')
  const [garmentSampleUrl, setGarmentSampleUrl] = useState('')

  const [personFile, setPersonFile] = useState<File | null>(null)
  const [garmentFile, setGarmentFile] = useState<File | null>(null)
  const [personPreview, setPersonPreview] = useState('')
  const [garmentPreview, setGarmentPreview] = useState('')

  const [state, setState] = useState<UiState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TryOnApiResponse | null>(null)

  const personReady = Boolean(personFile || personSampleUrl)
  const garmentReady = Boolean(garmentFile || garmentSampleUrl)

  const canSubmit = useMemo(
    () => personReady && garmentReady && state !== 'uploading' && state !== 'creating',
    [personReady, garmentReady, state],
  )

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
    if (personFile) return uploadOne(personFile, 'person')
    if (personSampleUrl) return personSampleUrl
    throw new Error('请先提供人物照片')
  }

  const resolveGarmentImageUrl = async () => {
    if (garmentFile) return uploadOne(garmentFile, 'garment')
    if (garmentSampleUrl) return garmentSampleUrl
    throw new Error('请先提供服装图片')
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

  const retryGenerate = async () => {
    if (!canSubmit) return
    const fakeFormEvent = { preventDefault() {} } as FormEvent<HTMLFormElement>
    await onSubmit(fakeFormEvent)
  }

  const clearPersonSelection = () => {
    setPersonFile(null)
    setPersonPreview('')
    setPersonSampleUrl('')
  }

  const clearGarmentSelection = () => {
    setGarmentFile(null)
    setGarmentPreview('')
    setGarmentSampleUrl('')
  }

  const resetAll = () => {
    setPersonSampleUrl('')
    setGarmentSampleUrl('')
    setPersonFile(null)
    setGarmentFile(null)
    setPersonPreview('')
    setGarmentPreview('')
    setResult(null)
    setError(null)
    setState('idle')
  }

  const isLoading = state === 'uploading' || state === 'creating'
  const loadingText = state === 'uploading' ? '正在上传图片...' : state === 'creating' ? '正在生成试穿效果...' : ''
  const resultImageUrl = result?.output?.image_url ?? result?.output?.results?.[0]?.url

  const personDisplayUrl = personPreview || personSampleUrl
  const garmentDisplayUrl = garmentPreview || garmentSampleUrl

  return (
    <main className="min-h-screen bg-[#f6f6f4] text-[#1b1b1b]">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-[#f6f6f4]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#141414] text-white">
              <Shirt className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.1em] text-black/90">VIRTUAL TRY-ON</p>
              <p className="text-[11px] text-black/45">Fashion AI Studio</p>
            </div>
          </div>
          <div className="hidden rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/60 sm:block">
            Step 1 人物 · Step 2 服装 · Step 3 成片
          </div>
        </div>
      </header>

      <form onSubmit={onSubmit} className="mx-auto w-full max-w-[1120px] px-4 pb-12 pt-5">
        <div className="mb-5 rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.05)]">
          <h1 className="text-lg font-semibold tracking-tight">AI 时尚试衣工作台</h1>
          <p className="mt-0.5 text-sm text-black/55">上传即预览，没图可直接点击下方示例使用</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden rounded-2xl border-black/10 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.05)]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111827] text-white">
                  <User className="h-4.5 w-4.5" />
                </div>
                <div>
                  <CardTitle className="text-base">人物照片</CardTitle>
                  <p className="text-xs text-black/50">上传或直接选择示例（同位预览）</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="person-upload" className="text-xs text-black/55">
                建议全身站姿，光线清晰
              </Label>

              <div className="group relative overflow-hidden rounded-xl border border-black/10 bg-[#f7f7f6]">
                {personDisplayUrl ? (
                  <>
                    <img
                      src={personDisplayUrl}
                      alt="person"
                      className="h-[34vh] min-h-[240px] w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <button
                      type="button"
                      onClick={clearPersonSelection}
                      className="absolute left-1/2 top-1/2 z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-white shadow-lg opacity-0 transition-all duration-200 group-hover:opacity-100 hover:scale-110"
                      aria-label="清空人物图片"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-[34vh] min-h-[240px] w-full flex-col items-center justify-center text-black/40">
                    <Upload className="mb-2 h-8 w-8" />
                    <p className="text-sm">上传人物照片</p>
                  </div>
                )}

                <input
                  id="person-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    setPersonFile(file)
                    setPersonPreview(file ? URL.createObjectURL(file) : '')
                  }}
                  className="hidden"
                />

                <label
                  htmlFor="person-upload"
                  className="absolute inset-0 z-10 cursor-pointer"
                  aria-label="上传人物照片"
                />
              </div>

              <div className="rounded-xl border border-black/10 bg-[#fafaf9] p-3">
                <p className="mb-2 text-sm font-medium text-black/70">没有图像？试试这些</p>
                <div className="flex gap-2">
                  {PERSON_SAMPLES.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => {
                        setPersonSampleUrl(sample.url)
                        setPersonFile(null)
                        setPersonPreview('')
                      }}
                      className={cn(
                        'group overflow-hidden rounded-lg border transition-all',
                        personSampleUrl === sample.url && !personPreview
                          ? 'border-black/60 ring-2 ring-black/10'
                          : 'border-black/15 hover:border-black/35',
                      )}
                    >
                      <img
                        src={sample.url}
                        alt={sample.name}
                        className="h-14 w-14 object-cover transition-transform duration-200 group-hover:scale-110"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-black/10 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.05)]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111827] text-white">
                  <Shirt className="h-4.5 w-4.5" />
                </div>
                <div>
                  <CardTitle className="text-base">服装图片</CardTitle>
                  <p className="text-xs text-black/50">上传或直接选择示例（同位预览）</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="garment-upload" className="text-xs text-black/55">
                支持上衣、裤装、连衣裙等
              </Label>

              <div className="group relative overflow-hidden rounded-xl border border-black/10 bg-[#f7f7f6]">
                {garmentDisplayUrl ? (
                  <>
                    <img
                      src={garmentDisplayUrl}
                      alt="garment"
                      className="h-[34vh] min-h-[240px] w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <button
                      type="button"
                      onClick={clearGarmentSelection}
                      className="absolute left-1/2 top-1/2 z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-white shadow-lg opacity-0 transition-all duration-200 group-hover:opacity-100 hover:scale-110"
                      aria-label="清空服装图片"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-[34vh] min-h-[240px] w-full flex-col items-center justify-center text-black/40">
                    <Upload className="mb-2 h-8 w-8" />
                    <p className="text-sm">上传服装图片</p>
                  </div>
                )}

                <input
                  id="garment-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    setGarmentFile(file)
                    setGarmentPreview(file ? URL.createObjectURL(file) : '')
                  }}
                  className="hidden"
                />

                <label
                  htmlFor="garment-upload"
                  className="absolute inset-0 z-10 cursor-pointer"
                  aria-label="上传服装图片"
                />
              </div>

              <div className="rounded-xl border border-black/10 bg-[#fafaf9] p-3">
                <p className="mb-2 text-sm font-medium text-black/70">没有图像？试试这些</p>
                <div className="flex gap-2">
                  {GARMENT_SAMPLES.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => {
                        setGarmentSampleUrl(sample.url)
                        setGarmentFile(null)
                        setGarmentPreview('')
                      }}
                      className={cn(
                        'group overflow-hidden rounded-lg border transition-all',
                        garmentSampleUrl === sample.url && !garmentPreview
                          ? 'border-black/60 ring-2 ring-black/10'
                          : 'border-black/15 hover:border-black/35',
                      )}
                    >
                      <img
                        src={sample.url}
                        alt={sample.name}
                        className="h-14 w-14 object-cover transition-transform duration-200 group-hover:scale-110"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="relative mx-auto mt-8 w-full max-w-[760px] overflow-hidden rounded-2xl border-black/10 bg-white shadow-[0_16px_46px_rgba(0,0,0,0.10)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111827] text-white">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div>
                  <CardTitle className="text-base">试穿结果</CardTitle>
                  <p className="text-xs text-black/50">成果区独占展示，可下载与重试</p>
                </div>
              </div>
              <div className="hidden items-center gap-2 text-xs text-black/45 sm:flex">
                <ImageIcon className="h-3.5 w-3.5" />
                <span>{result?.output?.task_status ?? '未开始'}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative overflow-hidden rounded-xl border border-black/10 bg-[#f7f7f6]">
              {resultImageUrl ? (
                <img src={resultImageUrl} alt="try-on result" className="h-[44vh] min-h-[320px] w-full object-contain" />
              ) : (
                <div className="flex h-[44vh] min-h-[320px] w-full flex-col items-center justify-center text-black/40">
                  {isLoading ? <Loader2 className="mb-2 h-10 w-10 animate-spin" /> : <ImageIcon className="mb-2 h-10 w-10" />}
                  <p className="text-sm">{isLoading ? loadingText : '等待生成试穿结果'}</p>
                </div>
              )}
            </div>

            {isLoading && (
              <div className="rounded-xl border border-black/10 bg-[#fafaf9] px-4 py-3">
                <div className="mb-2 flex items-center justify-between text-xs text-black/55">
                  <span>{loadingText}</span>
                  <span>处理中</span>
                </div>
                <Progress value={state === 'uploading' ? 35 : 72} className="h-2" />
              </div>
            )}

            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

            <div className="grid gap-2 sm:grid-cols-3">
              <Button type="submit" className="h-11 rounded-xl bg-[#111827] text-white hover:bg-[#0f172a]" disabled={!canSubmit || isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {loadingText}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    生成试穿效果
                  </>
                )}
              </Button>

              <Button type="button" variant="secondary" className="h-11 rounded-xl" onClick={retryGenerate} disabled={!canSubmit || isLoading}>
                <RotateCcw className="mr-2 h-4 w-4" />重试
              </Button>

              <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={resetAll} disabled={isLoading}>
                重置
              </Button>
            </div>

            {resultImageUrl && (
              <Button variant="outline" className="h-11 w-full rounded-xl" asChild>
                <a href={resultImageUrl} download>
                  <Download className="mr-2 h-4 w-4" />下载试穿结果
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </form>
    </main>
  )
}
