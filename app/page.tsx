'use client'

/* eslint-disable @next/next/no-img-element */
import { FormEvent, useMemo, useState } from 'react'
import { Download, ImageIcon, Loader2, RotateCcw, Shirt, Sparkles, Upload, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type UiState = 'idle' | 'uploading' | 'creating' | 'success' | 'error'
type TryOnMode = 'top' | 'bottom' | 'full'
type FullModeType = 'single' | 'split'

interface TryOnApiResponse {
  output?: {
    task_id?: string
    task_status?: string
    image_url?: string
    coarse_image_url?: string
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

const PERSON_SAMPLES = [{ id: 'p1', name: '全身正面', url: 'https://aliyunim.oss-cn-beijing.aliyuncs.com/uploads/person/1776152851294_5bbef7fa-4fd1-4e82-9ea0-cc5f28bf7131.jpg' }]
const TOP_SAMPLES = [{ id: 't1', name: '上衣模板', url: 'https://aliyunim.oss-cn-beijing.aliyuncs.com/uploads/garment/1776161361812_54bdba4a-2e51-46cd-955d-a5c1ad93af63.png' }]
const BOTTOM_SAMPLES = [{ id: 'b1', name: '下装模板', url: 'https://aliyunim.oss-cn-beijing.aliyuncs.com/uploads/garment/1776161361891_01fa91d4-02d5-4e73-9674-a23554418fc5.png' }]
const FULL_SINGLE_SAMPLES = [{ id: 'f1', name: '连衣裙 / 套装', url: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250626/epousa/short_sleeve.jpeg' }]

const MODE_OPTIONS: Array<{ id: TryOnMode; label: string }> = [
  { id: 'top', label: '上装' },
  { id: 'bottom', label: '下装' },
  { id: 'full', label: '整身' },
]

export default function Page() {
  const [mode, setMode] = useState<TryOnMode>('full')
  const [fullModeType, setFullModeType] = useState<FullModeType>('single')

  const [personSampleUrl, setPersonSampleUrl] = useState('')
  const [topSampleUrl, setTopSampleUrl] = useState('')
  const [bottomSampleUrl, setBottomSampleUrl] = useState('')
  const [fullSingleSampleUrl, setFullSingleSampleUrl] = useState('')

  const [personFile, setPersonFile] = useState<File | null>(null)
  const [topFile, setTopFile] = useState<File | null>(null)
  const [bottomFile, setBottomFile] = useState<File | null>(null)
  const [fullSingleFile, setFullSingleFile] = useState<File | null>(null)

  const [personPreview, setPersonPreview] = useState('')
  const [topPreview, setTopPreview] = useState('')
  const [bottomPreview, setBottomPreview] = useState('')
  const [fullSinglePreview, setFullSinglePreview] = useState('')

  const [state, setState] = useState<UiState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TryOnApiResponse | null>(null)

  const personReady = Boolean(personFile || personSampleUrl)
  const garmentReady = useMemo(() => {
    if (mode === 'top') return Boolean(topFile || topSampleUrl)
    if (mode === 'bottom') return Boolean(bottomFile || bottomSampleUrl)
    if (fullModeType === 'single') return Boolean(fullSingleFile || fullSingleSampleUrl)
    return Boolean((topFile || topSampleUrl) && (bottomFile || bottomSampleUrl))
  }, [bottomFile, bottomSampleUrl, fullModeType, mode, topFile, topSampleUrl, fullSingleFile, fullSingleSampleUrl])

  const canSubmit = useMemo(
    () => personReady && garmentReady && state !== 'uploading' && state !== 'creating',
    [personReady, garmentReady, state],
  )

  const uploadOne = async (file: File, scene: 'person' | 'garment') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('scene', scene)

    const response = await fetch('/api/upload', { method: 'POST', body: formData })
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

  const resolveGarmentUrls = async () => {
    if (mode === 'top') {
      if (topFile) return { topGarmentUrl: await uploadOne(topFile, 'garment') }
      if (topSampleUrl) return { topGarmentUrl: topSampleUrl }
      throw new Error('请先提供上装图片')
    }

    if (mode === 'bottom') {
      if (bottomFile) return { bottomGarmentUrl: await uploadOne(bottomFile, 'garment') }
      if (bottomSampleUrl) return { bottomGarmentUrl: bottomSampleUrl }
      throw new Error('请先提供下装图片')
    }

    if (fullModeType === 'single') {
      if (fullSingleFile) return { topGarmentUrl: await uploadOne(fullSingleFile, 'garment') }
      if (fullSingleSampleUrl) return { topGarmentUrl: fullSingleSampleUrl }
      throw new Error('请先提供整身衣物图片')
    }

    const topGarmentUrl = topFile ? await uploadOne(topFile, 'garment') : topSampleUrl || undefined
    const bottomGarmentUrl = bottomFile ? await uploadOne(bottomFile, 'garment') : bottomSampleUrl || undefined

    if (!topGarmentUrl || !bottomGarmentUrl) {
      throw new Error('请同时提供上装和下装图片')
    }

    return { topGarmentUrl, bottomGarmentUrl }
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return

    setState('uploading')
    setError(null)
    setResult(null)

    try {
      const personImageUrl = await resolvePersonImageUrl()
      const garmentUrls = await resolveGarmentUrls()

      setState('creating')

      const response = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personImageUrl,
          ...garmentUrls,
          refine: true,
          gender: 'woman',
        }),
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
    await onSubmit({ preventDefault() {} } as FormEvent<HTMLFormElement>)
  }

  const resetAll = () => {
    setMode('full')
    setFullModeType('single')
    setPersonSampleUrl('')
    setTopSampleUrl('')
    setBottomSampleUrl('')
    setFullSingleSampleUrl('')
    setPersonFile(null)
    setTopFile(null)
    setBottomFile(null)
    setFullSingleFile(null)
    setPersonPreview('')
    setTopPreview('')
    setBottomPreview('')
    setFullSinglePreview('')
    setResult(null)
    setError(null)
    setState('idle')
  }

  const clearPerson = () => {
    setPersonFile(null)
    setPersonPreview('')
    setPersonSampleUrl('')
  }

  const clearTop = () => {
    setTopFile(null)
    setTopPreview('')
    setTopSampleUrl('')
  }

  const clearBottom = () => {
    setBottomFile(null)
    setBottomPreview('')
    setBottomSampleUrl('')
  }

  const clearFullSingle = () => {
    setFullSingleFile(null)
    setFullSinglePreview('')
    setFullSingleSampleUrl('')
  }

  const isLoading = state === 'uploading' || state === 'creating'
  const loadingText = state === 'uploading' ? '正在上传图片...' : state === 'creating' ? '正在生成试穿效果...' : ''
  const resultImageUrl = result?.output?.image_url ?? result?.output?.results?.[0]?.url

  const sampleStrip = (
    items: Array<{ id: string; name: string; url: string }>,
    activeUrl: string,
    onPick: (url: string) => void,
  ) => (
    <div className="rounded-xl border border-black/10 bg-[#fafaf9] p-3">
      <p className="mb-2 text-sm font-medium text-black/70">示例</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((sample) => (
          <button
            key={sample.id}
            type="button"
            onClick={() => onPick(sample.url)}
            className={cn(
              'group overflow-hidden rounded-lg border transition-all',
              activeUrl === sample.url ? 'border-black/60 ring-2 ring-black/10' : 'border-black/15 hover:border-black/35',
            )}
          >
            <img src={sample.url} alt={sample.name} className="h-14 w-14 object-cover transition-transform duration-200 group-hover:scale-110" />
          </button>
        ))}
      </div>
    </div>
  )

  const FullModeTypeSwitch = () => (
    <div className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-1 py-1 text-xs text-black/60">
      <button
        type="button"
        onClick={() => setFullModeType('single')}
        className={cn('rounded-full px-3 py-1.5 transition', fullModeType === 'single' ? 'bg-black text-white' : 'hover:bg-black/5')}
      >
        单件整身
      </button>
      <button
        type="button"
        onClick={() => setFullModeType('split')}
        className={cn('rounded-full px-3 py-1.5 transition', fullModeType === 'split' ? 'bg-black text-white' : 'hover:bg-black/5')}
      >
        分开上传
      </button>
    </div>
  )

  const garmentModes =
    mode === 'full' && fullModeType === 'split' ? ['上装', '下装'] : mode === 'top' ? ['上装'] : mode === 'bottom' ? ['下装'] : ['整身']

  const ModeSwitch = () => (
    <div className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-1 py-1 text-xs text-black/60 shadow-sm">
      {MODE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => setMode(option.id)}
          className={cn('rounded-full px-3 py-1.5 transition', mode === option.id ? 'bg-black text-white' : 'hover:bg-black/5')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )

  return (
    <main className="min-h-screen bg-[#f6f6f4] text-[#1b1b1b]">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[#f6f6f4]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#141414] text-white">
              <Shirt className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.1em] text-black/90">VIRTUAL TRY-ON</p>
              <p className="text-[11px] text-black/45">Fashion AI Studio</p>
            </div>
          </div>
          <ModeSwitch />
        </div>
      </header>

      <form onSubmit={onSubmit} className="mx-auto w-full max-w-[1280px] px-4 pb-12 pt-5">
        <div className="grid gap-4 lg:grid-cols-[42%_58%] xl:grid-cols-[40%_60%]">
          <div className="flex h-full flex-col gap-4">
            <Card className="overflow-hidden rounded-2xl border-black/10 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.05)]">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111827] text-white">
                    <User className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">人物照片</CardTitle>
                    <p className="text-xs text-black/50">按模式上传对应人物图</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label htmlFor="person-upload" className="text-xs text-black/55">建议全身站姿，光线清晰</Label>
                <div className="group relative min-h-[220px] overflow-hidden rounded-xl border border-black/10 bg-[#f7f7f6]">
                  {personPreview || personSampleUrl ? (
                    <>
                      <img
                        src={personPreview || personSampleUrl}
                        alt="person"
                        className="h-[28vh] min-h-[220px] w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <button
                        type="button"
                        onClick={clearPerson}
                        className="absolute left-1/2 top-1/2 z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 hover:scale-110"
                        aria-label="清空人物图片"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </>
                  ) : (
                    <label htmlFor="person-upload" className="flex h-[28vh] min-h-[220px] w-full cursor-pointer flex-col items-center justify-center gap-2 text-center">
                      <Upload className="h-8 w-8 text-black/35" />
                      <p className="text-sm font-medium text-black/70">点击上传人物照片</p>
                      <p className="text-xs text-black/40">支持 JPG / PNG / WebP</p>
                    </label>
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
                </div>
                {sampleStrip(PERSON_SAMPLES, personSampleUrl, (url) => {
                  setPersonSampleUrl(url)
                  setPersonFile(null)
                  setPersonPreview('')
                })}
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-2xl border-black/10 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.05)]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111827] text-white">
                      <Shirt className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">服装图片</CardTitle>
                      <p className="text-xs text-black/50">当前显示：{garmentModes.join(' + ')}</p>
                    </div>
                  </div>
                  {mode === 'full' && <FullModeTypeSwitch />}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {mode === 'top' && (
                  <>
                    <Label className="text-xs text-black/55">只允许上传上装图片</Label>
                    <div className="group relative min-h-[220px] overflow-hidden rounded-xl border border-black/10 bg-[#f7f7f6]">
                      {topPreview || topSampleUrl ? (
                        <>
                          <img
                            src={topPreview || topSampleUrl}
                            alt="top"
                            className="h-[28vh] min-h-[220px] w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                          <button
                            type="button"
                            onClick={clearTop}
                            className="absolute left-1/2 top-1/2 z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 hover:scale-110"
                            aria-label="清空上装图片"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </>
                      ) : (
                        <label htmlFor="top-upload" className="flex h-[28vh] min-h-[220px] w-full cursor-pointer flex-col items-center justify-center gap-2 text-center">
                          <Upload className="h-8 w-8 text-black/35" />
                          <p className="text-sm font-medium text-black/70">点击上传上装图片</p>
                          <p className="text-xs text-black/40">支持 JPG / PNG / WebP</p>
                        </label>
                      )}
                      <input
                        id="top-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          setTopFile(file)
                          setTopPreview(file ? URL.createObjectURL(file) : '')
                        }}
                        className="hidden"
                      />
                    </div>
                    {sampleStrip(TOP_SAMPLES, topSampleUrl, (url) => {
                      setTopSampleUrl(url)
                      setTopFile(null)
                      setTopPreview('')
                    })}
                  </>
                )}

                {mode === 'bottom' && (
                  <>
                    <Label className="text-xs text-black/55">只允许上传下装图片</Label>
                    <div className="group relative min-h-[220px] overflow-hidden rounded-xl border border-black/10 bg-[#f7f7f6]">
                      {bottomPreview || bottomSampleUrl ? (
                        <>
                          <img
                            src={bottomPreview || bottomSampleUrl}
                            alt="bottom"
                            className="h-[28vh] min-h-[220px] w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                          <button
                            type="button"
                            onClick={clearBottom}
                            className="absolute left-1/2 top-1/2 z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 hover:scale-110"
                            aria-label="清空下装图片"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </>
                      ) : (
                        <label htmlFor="bottom-upload" className="flex h-[28vh] min-h-[220px] w-full cursor-pointer flex-col items-center justify-center gap-2 text-center">
                          <Upload className="h-8 w-8 text-black/35" />
                          <p className="text-sm font-medium text-black/70">点击上传下装图片</p>
                          <p className="text-xs text-black/40">支持 JPG / PNG / WebP</p>
                        </label>
                      )}
                      <input
                        id="bottom-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          setBottomFile(file)
                          setBottomPreview(file ? URL.createObjectURL(file) : '')
                        }}
                        className="hidden"
                      />
                    </div>
                    {sampleStrip(BOTTOM_SAMPLES, bottomSampleUrl, (url) => {
                      setBottomSampleUrl(url)
                      setBottomFile(null)
                      setBottomPreview('')
                    })}
                  </>
                )}

                {mode === 'full' && fullModeType === 'single' && (
                  <>
                    <Label className="text-xs text-black/55">只允许上传一张整身衣物</Label>
                    <div className="group relative min-h-[220px] overflow-hidden rounded-xl border border-black/10 bg-[#f7f7f6]">
                      {fullSinglePreview || fullSingleSampleUrl ? (
                        <>
                          <img
                            src={fullSinglePreview || fullSingleSampleUrl}
                            alt="full garment"
                            className="h-[28vh] min-h-[220px] w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                          <button
                            type="button"
                            onClick={clearFullSingle}
                            className="absolute left-1/2 top-1/2 z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 hover:scale-110"
                            aria-label="清空整身衣物"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </>
                      ) : (
                        <label htmlFor="full-single-upload" className="flex h-[28vh] min-h-[220px] w-full cursor-pointer flex-col items-center justify-center gap-2 text-center">
                          <Upload className="h-8 w-8 text-black/35" />
                          <p className="text-sm font-medium text-black/70">点击上传整身衣物</p>
                          <p className="text-xs text-black/40">适合连衣裙 / 套装 / 连体衣</p>
                        </label>
                      )}
                      <input
                        id="full-single-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          setFullSingleFile(file)
                          setFullSinglePreview(file ? URL.createObjectURL(file) : '')
                        }}
                        className="hidden"
                      />
                    </div>
                    {sampleStrip(FULL_SINGLE_SAMPLES, fullSingleSampleUrl, (url) => {
                      setFullSingleSampleUrl(url)
                      setFullSingleFile(null)
                      setFullSinglePreview('')
                    })}
                  </>
                )}

                {mode === 'full' && fullModeType === 'split' && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="mb-2 block text-xs text-black/55">上装</Label>
                      <div className="group relative min-h-[200px] overflow-hidden rounded-xl border border-black/10 bg-[#f7f7f6]">
                        {topPreview || topSampleUrl ? (
                          <>
                            <img
                              src={topPreview || topSampleUrl}
                              alt="top"
                              className="h-[24vh] min-h-[200px] w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                            <button
                              type="button"
                              onClick={clearTop}
                              className="absolute left-1/2 top-1/2 z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 hover:scale-110"
                              aria-label="清空上装图片"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <label htmlFor="top-upload" className="flex h-[24vh] min-h-[200px] w-full cursor-pointer flex-col items-center justify-center gap-2 text-center">
                            <Upload className="h-7 w-7 text-black/35" />
                            <p className="text-sm font-medium text-black/70">上传上装</p>
                          </label>
                        )}
                        <input
                          id="top-upload"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null
                            setTopFile(file)
                            setTopPreview(file ? URL.createObjectURL(file) : '')
                          }}
                          className="hidden"
                        />
                      </div>
                      <div className="mt-2">{sampleStrip(TOP_SAMPLES, topSampleUrl, (url) => {
                        setTopSampleUrl(url)
                        setTopFile(null)
                        setTopPreview('')
                      })}</div>
                    </div>

                    <div>
                      <Label className="mb-2 block text-xs text-black/55">下装</Label>
                      <div className="group relative min-h-[200px] overflow-hidden rounded-xl border border-black/10 bg-[#f7f7f6]">
                        {bottomPreview || bottomSampleUrl ? (
                          <>
                            <img
                              src={bottomPreview || bottomSampleUrl}
                              alt="bottom"
                              className="h-[24vh] min-h-[200px] w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                            <button
                              type="button"
                              onClick={clearBottom}
                              className="absolute left-1/2 top-1/2 z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 hover:scale-110"
                              aria-label="清空下装图片"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <label htmlFor="bottom-upload" className="flex h-[24vh] min-h-[200px] w-full cursor-pointer flex-col items-center justify-center gap-2 text-center">
                            <Upload className="h-7 w-7 text-black/35" />
                            <p className="text-sm font-medium text-black/70">上传下装</p>
                          </label>
                        )}
                        <input
                          id="bottom-upload"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null
                            setBottomFile(file)
                            setBottomPreview(file ? URL.createObjectURL(file) : '')
                          }}
                          className="hidden"
                        />
                      </div>
                      <div className="mt-2">{sampleStrip(BOTTOM_SAMPLES, bottomSampleUrl, (url) => {
                        setBottomSampleUrl(url)
                        setBottomFile(null)
                        setBottomPreview('')
                      })}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="flex h-full flex-col overflow-hidden rounded-2xl border-black/10 bg-white shadow-[0_16px_46px_rgba(0,0,0,0.10)]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111827] text-white">
                    <Sparkles className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">试穿结果</CardTitle>
                    <p className="text-xs text-black/50">精修优先显示，支持下载与重试</p>
                  </div>
                </div>
                <div className="hidden items-center gap-2 text-xs text-black/45 sm:flex">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>{result?.output?.task_status ?? '未开始'}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-[#f7f7f6]">
                {resultImageUrl ? (
                  <img src={resultImageUrl} alt="try-on result" className="max-h-[58vh] w-full object-contain" />
                ) : (
                  <div className="flex h-full min-h-[420px] w-full flex-col items-center justify-center text-black/40">
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
                  <RotateCcw className="mr-2 h-4 w-4" />
                  重试
                </Button>

                <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={resetAll} disabled={isLoading}>
                  重置
                </Button>
              </div>

              {resultImageUrl && (
                <Button variant="outline" className="h-11 w-full rounded-xl" asChild>
                  <a href={resultImageUrl} download>
                    <Download className="mr-2 h-4 w-4" />
                    下载试穿结果
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </form>
    </main>
  )
}
