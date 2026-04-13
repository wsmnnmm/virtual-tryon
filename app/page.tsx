'use client'

/* eslint-disable @next/next/no-img-element */
import { FormEvent, useMemo, useState } from 'react'
import { Upload, Shirt, User, Sparkles, RotateCcw, Download, ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

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

  const isLoading = state === 'uploading' || state === 'creating'
  const loadingText = state === 'uploading' ? '正在上传图片...' : state === 'creating' ? '正在生成试穿效果...' : ''

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-lg">
              <Shirt className="h-5 w-5 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">AI 虚拟试穿</h1>
              <p className="text-xs text-gray-500">上传人物照 + 服饰图，AI 智能生成试穿效果</p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-10 pb-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            <span>基于阿里云 DashScope AI 模型</span>
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 mb-3">
            试试 AI 换装效果
          </h2>
          <p className="text-gray-500 text-lg">
            选择一张人物照片和一件服装，AI 将在几秒钟内生成试穿效果
          </p>
        </div>
      </section>

      {/* Main Form */}
      <form onSubmit={onSubmit} className="container mx-auto px-4 pb-16">
        <div className="grid lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Person Card */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>人物照片</CardTitle>
                  <p className="text-sm text-gray-500 mt-0.5">选择示例或上传自己的照片</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={personPickerType} onValueChange={(v) => setPersonPickerType(v as PickerType)}>
                <TabsList className="w-full">
                  <TabsTrigger value="sample" className="flex-1">
                    <ImageIcon className="h-4 w-4 mr-2" />
                    示例图片
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1">
                    <Upload className="h-4 w-4 mr-2" />
                    上传照片
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sample" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    {PERSON_SAMPLES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPersonSampleUrl(item.url)}
                        className={cn(
                          'relative rounded-xl overflow-hidden border-2 transition-all duration-200 aspect-[3/4] group hover:shadow-md',
                          personSampleUrl === item.url
                            ? 'border-gray-900 shadow-md ring-2 ring-gray-900 ring-offset-2'
                            : 'border-gray-200 hover:border-gray-300',
                        )}
                      >
                        <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <p className="text-white text-sm font-medium">{item.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="upload" className="mt-4">
                  <div className="space-y-3">
                    <Label htmlFor="person-upload">上传人物照片</Label>
                    <p className="text-xs text-gray-500 -mt-1">建议全身站姿，光线清晰</p>
                    <div className="relative">
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
                        className="flex flex-col items-center justify-center w-full h-48 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-all duration-200"
                      >
                        <Upload className="h-10 w-10 text-gray-400 mb-3" />
                        <p className="text-sm text-gray-600 font-medium">
                          {personFile ? personFile.name : '点击选择图片'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">支持 JPG、PNG、WebP</p>
                      </label>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Preview */}
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">预览</p>
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                  {personDisplayUrl ? (
                    <img src={personDisplayUrl} alt="person" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                      <ImageIcon className="h-12 w-12 mb-2" />
                      <p className="text-sm">暂无预览</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Garment Card */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Shirt className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle>服装图片</CardTitle>
                  <p className="text-sm text-gray-500 mt-0.5">选择示例或上传自己的服装图</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={garmentPickerType} onValueChange={(v) => setGarmentPickerType(v as PickerType)}>
                <TabsList className="w-full">
                  <TabsTrigger value="sample" className="flex-1">
                    <ImageIcon className="h-4 w-4 mr-2" />
                    示例图片
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1">
                    <Upload className="h-4 w-4 mr-2" />
                    上传服装
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sample" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    {GARMENT_SAMPLES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setGarmentSampleUrl(item.url)}
                        className={cn(
                          'relative rounded-xl overflow-hidden border-2 transition-all duration-200 aspect-square group hover:shadow-md',
                          garmentSampleUrl === item.url
                            ? 'border-gray-900 shadow-md ring-2 ring-gray-900 ring-offset-2'
                            : 'border-gray-200 hover:border-gray-300',
                        )}
                      >
                        <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <p className="text-white text-sm font-medium">{item.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="upload" className="mt-4">
                  <div className="space-y-3">
                    <Label htmlFor="garment-upload">上传服装图片</Label>
                    <p className="text-xs text-gray-500 -mt-1">支持上衣、裤装、连衣裙等</p>
                    <div className="relative">
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
                        className="flex flex-col items-center justify-center w-full h-48 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-all duration-200"
                      >
                        <Upload className="h-10 w-10 text-gray-400 mb-3" />
                        <p className="text-sm text-gray-600 font-medium">
                          {garmentFile ? garmentFile.name : '点击选择图片'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">支持 JPG、PNG、WebP</p>
                      </label>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Preview */}
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">预览</p>
                <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                  {garmentDisplayUrl ? (
                    <img src={garmentDisplayUrl} alt="garment" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                      <ImageIcon className="h-12 w-12 mb-2" />
                      <p className="text-sm">暂无预览</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Message */}
        {error && (
          <div className="max-w-5xl mx-auto mt-6">
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-600 text-sm font-medium">
              {error}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="max-w-5xl mx-auto mt-6">
            <Card>
              <CardContent className="py-8">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-10 w-10 text-gray-900 animate-spin" />
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">{loadingText}</p>
                    <p className="text-sm text-gray-500 mt-1">请稍候...</p>
                  </div>
                  <Progress value={state === 'uploading' ? 30 : 70} className="w-full max-w-xs" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Result */}
        {result?.output && (
          <div className="max-w-5xl mx-auto mt-6">
            <Card className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>试穿结果</CardTitle>
                    <p className="text-sm text-gray-500 mt-0.5">AI 生成的试穿效果</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                  {result.output.image_url ? (
                    <img src={result.output.image_url} alt="try-on result" className="w-full h-full object-contain" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                      <Loader2 className="h-12 w-12 mb-2 animate-spin" />
                      <p className="text-sm">正在生成...</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" onClick={resetAll}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    重新生成
                  </Button>
                  {result.output.image_url && (
                    <Button variant="default" className="flex-1" asChild>
                      <a href={result.output.image_url} download>
                        <Download className="h-4 w-4 mr-2" />
                        下载图片
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Submit Button */}
        {!result?.output && (
          <div className="max-w-5xl mx-auto mt-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                type="submit"
                size="lg"
                className="flex-1 max-w-md text-base shadow-lg"
                disabled={!canSubmit || isLoading}
                isLoading={isLoading}
              >
                {isLoading ? loadingText : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    生成试穿效果
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="flex-1 max-w-md"
                onClick={resetAll}
                disabled={isLoading}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                重置
              </Button>
            </div>
          </div>
        )}
      </form>
    </main>
  )
}
