'use client';

/* eslint-disable @next/next/no-img-element */
import { FormEvent, useMemo, useState } from 'react';
import { Download, ImageIcon, Loader2, RotateCcw, Shirt, Sparkles, Upload, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type UiState = 'idle' | 'uploading' | 'creating' | 'polling' | 'success' | 'error';
type TryOnMode = 'top' | 'bottom' | 'full';
type FullModeType = 'single' | 'split';
type RefineMode = 'on' | 'off';

type TryOnJobStatus = 'pending' | 'coarse_running' | 'coarse_succeeded' | 'refine_running' | 'succeeded' | 'failed';

interface TryOnCreateResponse {
  jobId: string;
  status: TryOnJobStatus;
  requestId: string;
}

interface TryOnStatusResponse {
  jobId: string;
  status: TryOnJobStatus;
  requestId: string;
  coarseImageUrl?: string;
  refinedImageUrl?: string;
  error?: string;
  errorMessage?: string;
}

interface UploadApiResponse {
  success: boolean;
  publicUrl?: string;
  error?: string;
  message?: string;
}

const PERSON_SAMPLES = [
  { id: 'p3', name: '全身正面', url: 'https://aliyunim.oss-cn-beijing.aliyuncs.com/uploads/person/1776161361260_d0f9e3c0-dfec-42bf-b713-35a5f068891b.jpg' },
  { id: 'p1', name: '全身正面', url: 'https://aliyunim.oss-cn-beijing.aliyuncs.com/my/Snipaste_2026-04-15_15-42-11.png' },
  { id: 'p2', name: '全身正面', url: 'https://aliyunim.oss-cn-beijing.aliyuncs.com/my/renxiangnan.png' }

];
const TOP_SAMPLES = [
  { id: 't3', name: '上衣模板', url: 'https://aliyunim.oss-cn-beijing.aliyuncs.com/my/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20260414180114_481_2.jpg' },
  { id: 't1', name: '上衣模板', url: 'https://aliyunim.oss-cn-beijing.aliyuncs.com/uploads/garment/1776161361812_54bdba4a-2e51-46cd-955d-a5c1ad93af63.png' },
  { id: 't2', name: '上衣模板', url: 'https://aliyunim.oss-cn-beijing.aliyuncs.com/my/%E4%B8%8A%E8%A1%A3.png' }

];
const BOTTOM_SAMPLES = [
  { id: 'b1', name: '下装模板', url: 'https://aliyunim.oss-cn-beijing.aliyuncs.com/my/%E8%A3%A4%E5%AD%903.png' }
];
const FULL_SINGLE_SAMPLES = [
  { id: 'f1', name: '连衣裙 / 套装', url: 'https://aliyunim.oss-cn-beijing.aliyuncs.com/my/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20260415151353_499_2.jpg' }
];

const MODE_OPTIONS: Array<{ id: TryOnMode; label: string }> = [
  { id: 'top', label: '上装' },
  { id: 'bottom', label: '下装' },
  { id: 'full', label: '整身' }
];

export default function Page() {
  const [mode, setMode] = useState<TryOnMode>('top');
  const [fullModeType, setFullModeType] = useState<FullModeType>('single');
  const [refineMode, setRefineMode] = useState<RefineMode>('on');

  const [personSampleUrl, setPersonSampleUrl] = useState('');
  const [topSampleUrl, setTopSampleUrl] = useState('');
  const [bottomSampleUrl, setBottomSampleUrl] = useState('');
  const [fullSingleSampleUrl, setFullSingleSampleUrl] = useState('');

  const [personFile, setPersonFile] = useState<File | null>(null);
  const [topFile, setTopFile] = useState<File | null>(null);
  const [bottomFile, setBottomFile] = useState<File | null>(null);
  const [fullSingleFile, setFullSingleFile] = useState<File | null>(null);

  const [personPreview, setPersonPreview] = useState('');
  const [topPreview, setTopPreview] = useState('');
  const [bottomPreview, setBottomPreview] = useState('');
  const [fullSinglePreview, setFullSinglePreview] = useState('');

  const [state, setState] = useState<UiState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState<TryOnStatusResponse | null>(null);

  const personReady = Boolean(personFile || personSampleUrl);
  const garmentReady = useMemo(() => {
    if (mode === 'top') return Boolean(topFile || topSampleUrl);
    if (mode === 'bottom') return Boolean(bottomFile || bottomSampleUrl);
    if (fullModeType === 'single') return Boolean(fullSingleFile || fullSingleSampleUrl);
    return Boolean((topFile || topSampleUrl) && (bottomFile || bottomSampleUrl));
  }, [bottomFile, bottomSampleUrl, fullModeType, mode, topFile, topSampleUrl, fullSingleFile, fullSingleSampleUrl]);

  const canSubmit = useMemo(() => personReady && garmentReady && state !== 'uploading' && state !== 'creating', [personReady, garmentReady, state]);

  const uploadOne = async (file: File, scene: 'person' | 'garment') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('scene', scene);

    const response = await fetch('/api/upload', { method: 'POST', body: formData });
    const rawText = await response.text();
    let payload: UploadApiResponse | null = null;

    try {
      payload = rawText ? (JSON.parse(rawText) as UploadApiResponse) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      // Some platforms/proxies return plain text/HTML (e.g. 413 Request Entity Too Large),
      // which would otherwise crash on response.json().
      if (response.status === 413 || rawText.toLowerCase().includes('request entity') || rawText.toLowerCase().includes('entity too large')) {
        throw new Error('图片过大导致上传被拦截（Request Entity Too Large），请换小一点的图片或先压缩后再试');
      }
      throw new Error(payload?.message ?? payload?.error ?? (rawText ? rawText.slice(0, 160) : '上传失败'));
    }

    if (!payload?.success || !payload.publicUrl) {
      throw new Error(payload?.message ?? payload?.error ?? '上传失败');
    }

    return payload.publicUrl;
  };

  const resolvePersonImageUrl = async () => {
    if (personFile) return uploadOne(personFile, 'person');
    if (personSampleUrl) return personSampleUrl;
    throw new Error('请先提供人物照片');
  };

  const resolveGarmentUrls = async () => {
    if (mode === 'top') {
      if (topFile) return { topGarmentUrl: await uploadOne(topFile, 'garment') };
      if (topSampleUrl) return { topGarmentUrl: topSampleUrl };
      throw new Error('请先提供上装图片');
    }

    if (mode === 'bottom') {
      if (bottomFile) return { bottomGarmentUrl: await uploadOne(bottomFile, 'garment') };
      if (bottomSampleUrl) return { bottomGarmentUrl: bottomSampleUrl };
      throw new Error('请先提供下装图片');
    }

    if (fullModeType === 'single') {
      if (fullSingleFile) return { topGarmentUrl: await uploadOne(fullSingleFile, 'garment') };
      if (fullSingleSampleUrl) return { topGarmentUrl: fullSingleSampleUrl };
      throw new Error('请先提供整身衣物图片');
    }

    const topGarmentUrl = topFile ? await uploadOne(topFile, 'garment') : topSampleUrl || undefined;
    const bottomGarmentUrl = bottomFile ? await uploadOne(bottomFile, 'garment') : bottomSampleUrl || undefined;

    if (!topGarmentUrl || !bottomGarmentUrl) {
      throw new Error('请同时提供上装和下装图片');
    }

    return { topGarmentUrl, bottomGarmentUrl };
  };

  const pollStatus = async (nextJobId: string) => {
    const maxPolls = 180
    for (let i = 0; i < maxPolls; i++) {
      const response = await fetch(`/api/tryon/status?jobId=${encodeURIComponent(nextJobId)}`, { cache: 'no-store' })
      const payload = (await response.json()) as TryOnStatusResponse & { error?: string; message?: string }

      if (!response.ok) throw new Error(payload.message ?? payload.error ?? '查询任务状态失败')

      setResult(payload)

      if (payload.status === 'succeeded') {
        setState('success')
        return
      }
      if (payload.status === 'failed') {
        throw new Error(payload.errorMessage ?? '任务失败')
      }

      setState('polling')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    throw new Error('任务等待超时，请稍后刷新页面继续查看')
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    setState('uploading');
    setError(null);
    setResult(null);
    setJobId('');

    try {
      const personImageUrl = await resolvePersonImageUrl();
      const garmentUrls = await resolveGarmentUrls();

      setState('creating');

      const response = await fetch('/api/tryon/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personImageUrl,
          ...garmentUrls,
          refine: refineMode === 'on',
          gender: 'woman'
        })
      });

      const payload = (await response.json()) as TryOnCreateResponse & { error?: string; message?: string; retryAfter?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? payload.error ?? '创建任务失败')
      }

      setJobId(payload.jobId)
      await pollStatus(payload.jobId)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '未知错误');
      setState('error');
    }
  };

  const retryGenerate = async () => {
    if (!canSubmit) return;
    await onSubmit({ preventDefault() {} } as FormEvent<HTMLFormElement>);
  };

  const resetAll = () => {
    setMode('full');
    setFullModeType('single');
    setPersonSampleUrl('');
    setTopSampleUrl('');
    setBottomSampleUrl('');
    setFullSingleSampleUrl('');
    setPersonFile(null);
    setTopFile(null);
    setBottomFile(null);
    setFullSingleFile(null);
    setPersonPreview('');
    setTopPreview('');
    setBottomPreview('');
    setFullSinglePreview('');
    setResult(null);
    setError(null);
    setRefineMode('on');
    setState('idle');
  };

  const clearPerson = () => {
    setPersonFile(null);
    setPersonPreview('');
    setPersonSampleUrl('');
  };

  const clearTop = () => {
    setTopFile(null);
    setTopPreview('');
    setTopSampleUrl('');
  };

  const clearBottom = () => {
    setBottomFile(null);
    setBottomPreview('');
    setBottomSampleUrl('');
  };

  const clearFullSingle = () => {
    setFullSingleFile(null);
    setFullSinglePreview('');
    setFullSingleSampleUrl('');
  };

  const isLoading = state === 'uploading' || state === 'creating' || state === 'polling';
  const loadingText = state === 'uploading' ? '正在上传图片...' : state === 'creating' ? '正在创建任务...' : state === 'polling' ? '正在轮询试穿进度...' : '';
  const resultImageUrl = result?.refinedImageUrl ?? result?.coarseImageUrl;
  const currentStepLabel =
    state === 'uploading'
      ? '1. 上传素材'
      : state === 'creating'
        ? '2. 创建试穿任务'
        : state === 'polling'
          ? '3. 试穿生成中'
          : state === 'success'
            ? '4. 生成完成'
            : state === 'error'
              ? '生成失败'
              : '等待开始';
  const currentStepHint =
    state === 'uploading'
      ? '正在把人物图和服装图上传到服务端'
      : state === 'creating'
        ? '正在创建 job，稍后会自动轮询 coarse / refine 进度'
        : state === 'polling'
          ? result?.status === 'coarse_running'
            ? 'coarse 阶段生成中，通常需要较长时间'
            : result?.status === 'coarse_succeeded'
              ? 'coarse 已完成，正在进入 refine 精修'
              : result?.status === 'refine_running'
                ? 'refine 精修中，请稍候'
                : '处理中，请稍候'
          : state === 'success'
            ? '已生成完成，可以下载或继续重试'
            : state === 'error'
              ? error ?? '发生错误'
              : '提交后将显示实时进度';
  const currentProgress = state === 'uploading' ? 20 : state === 'creating' ? 45 : state === 'polling' ? 78 : state === 'success' ? 100 : 0;
  const stepStates = [
    { key: 'uploading', label: '上传素材', done: ['creating', 'polling', 'success'].includes(state), active: state === 'uploading' },
    { key: 'creating', label: '创建任务', done: ['polling', 'success'].includes(state), active: state === 'creating' },
    { key: 'polling', label: '生成结果', done: state === 'success', active: state === 'polling' },
    { key: 'success', label: '完成', done: state === 'success', active: state === 'success' },
  ] as const;

  const sampleStrip = (items: Array<{ id: string; name: string; url: string }>, activeUrl: string, onPick: (url: string) => void) => (
    <div className="rounded-xl border border-black/10 bg-[#fafaf9] p-3">
      <p className="mb-2 text-sm font-medium text-black/70">示例</p>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] snap-x snap-mandatory">
        {items.map(sample => (
          <button
            key={sample.id}
            type="button"
            onClick={() => onPick(sample.url)}
            className={cn(
              'group shrink-0 snap-start overflow-hidden rounded-lg border transition-all',
              activeUrl === sample.url ? 'border-black/60 ring-2 ring-black/10' : 'border-black/15 hover:border-black/35'
            )}
          >
            <img src={sample.url} alt={sample.name} className="h-14 w-14 object-cover transition-transform duration-200 group-hover:scale-110" />
          </button>
        ))}
      </div>
    </div>
  );

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
  );

  const garmentModes = mode === 'full' && fullModeType === 'split' ? ['上装', '下装'] : mode === 'top' ? ['上装'] : mode === 'bottom' ? ['下装'] : ['整身'];

  const ModeSwitch = () => (
    <div className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-1 py-1 text-xs text-black/60 shadow-sm">
      {MODE_OPTIONS.map(option => (
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
  );

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
          <div className="flex h-full flex-col gap-4 lg:gap-5">
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
                <Label htmlFor="person-upload" className="text-xs text-black/55">
                  建议全身站姿，光线清晰
                </Label>
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
                    <label
                      htmlFor="person-upload"
                      className="flex h-[28vh] min-h-[220px] w-full cursor-pointer flex-col items-center justify-center gap-2 text-center"
                    >
                      <Upload className="h-8 w-8 text-black/35" />
                      <p className="text-sm font-medium text-black/70">点击上传人物照片</p>
                      <p className="text-xs text-black/40">支持 JPG / PNG / WebP</p>
                    </label>
                  )}
                  <input
                    id="person-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null;
                      setPersonFile(file);
                      setPersonPreview(file ? URL.createObjectURL(file) : '');
                    }}
                    className="hidden"
                  />
                </div>
                {sampleStrip(PERSON_SAMPLES, personSampleUrl, url => {
                  setPersonSampleUrl(url);
                  setPersonFile(null);
                  setPersonPreview('');
                })}
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-2xl border-black/10 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.05)]">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                        <label
                          htmlFor="top-upload"
                          className="flex h-[28vh] min-h-[220px] w-full cursor-pointer flex-col items-center justify-center gap-2 text-center"
                        >
                          <Upload className="h-8 w-8 text-black/35" />
                          <p className="text-sm font-medium text-black/70">点击上传上装图片</p>
                          <p className="text-xs text-black/40">支持 JPG / PNG / WebP</p>
                        </label>
                      )}
                      <input
                        id="top-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={e => {
                          const file = e.target.files?.[0] ?? null;
                          setTopFile(file);
                          setTopPreview(file ? URL.createObjectURL(file) : '');
                        }}
                        className="hidden"
                      />
                    </div>
                    {sampleStrip(TOP_SAMPLES, topSampleUrl, url => {
                      setTopSampleUrl(url);
                      setTopFile(null);
                      setTopPreview('');
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
                        <label
                          htmlFor="bottom-upload"
                          className="flex h-[28vh] min-h-[220px] w-full cursor-pointer flex-col items-center justify-center gap-2 text-center"
                        >
                          <Upload className="h-8 w-8 text-black/35" />
                          <p className="text-sm font-medium text-black/70">点击上传下装图片</p>
                          <p className="text-xs text-black/40">支持 JPG / PNG / WebP</p>
                        </label>
                      )}
                      <input
                        id="bottom-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={e => {
                          const file = e.target.files?.[0] ?? null;
                          setBottomFile(file);
                          setBottomPreview(file ? URL.createObjectURL(file) : '');
                        }}
                        className="hidden"
                      />
                    </div>
                    {sampleStrip(BOTTOM_SAMPLES, bottomSampleUrl, url => {
                      setBottomSampleUrl(url);
                      setBottomFile(null);
                      setBottomPreview('');
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
                        <label
                          htmlFor="full-single-upload"
                          className="flex h-[28vh] min-h-[220px] w-full cursor-pointer flex-col items-center justify-center gap-2 text-center"
                        >
                          <Upload className="h-8 w-8 text-black/35" />
                          <p className="text-sm font-medium text-black/70">点击上传整身衣物</p>
                          <p className="text-xs text-black/40">适合连衣裙 / 套装 / 连体衣</p>
                        </label>
                      )}
                      <input
                        id="full-single-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={e => {
                          const file = e.target.files?.[0] ?? null;
                          setFullSingleFile(file);
                          setFullSinglePreview(file ? URL.createObjectURL(file) : '');
                        }}
                        className="hidden"
                      />
                    </div>
                    {sampleStrip(FULL_SINGLE_SAMPLES, fullSingleSampleUrl, url => {
                      setFullSingleSampleUrl(url);
                      setFullSingleFile(null);
                      setFullSinglePreview('');
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
                          <label
                            htmlFor="top-upload"
                            className="flex h-[24vh] min-h-[200px] w-full cursor-pointer flex-col items-center justify-center gap-2 text-center"
                          >
                            <Upload className="h-7 w-7 text-black/35" />
                            <p className="text-sm font-medium text-black/70">上传上装</p>
                          </label>
                        )}
                        <input
                          id="top-upload"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={e => {
                            const file = e.target.files?.[0] ?? null;
                            setTopFile(file);
                            setTopPreview(file ? URL.createObjectURL(file) : '');
                          }}
                          className="hidden"
                        />
                      </div>
                      <div className="mt-2">
                        {sampleStrip(TOP_SAMPLES, topSampleUrl, url => {
                          setTopSampleUrl(url);
                          setTopFile(null);
                          setTopPreview('');
                        })}
                      </div>
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
                          <label
                            htmlFor="bottom-upload"
                            className="flex h-[24vh] min-h-[200px] w-full cursor-pointer flex-col items-center justify-center gap-2 text-center"
                          >
                            <Upload className="h-7 w-7 text-black/35" />
                            <p className="text-sm font-medium text-black/70">上传下装</p>
                          </label>
                        )}
                        <input
                          id="bottom-upload"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={e => {
                            const file = e.target.files?.[0] ?? null;
                            setBottomFile(file);
                            setBottomPreview(file ? URL.createObjectURL(file) : '');
                          }}
                          className="hidden"
                        />
                      </div>
                      <div className="mt-2">
                        {sampleStrip(BOTTOM_SAMPLES, bottomSampleUrl, url => {
                          setBottomSampleUrl(url);
                          setBottomFile(null);
                          setBottomPreview('');
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="flex h-full flex-col overflow-hidden rounded-2xl border-black/10 bg-white shadow-[0_16px_46px_rgba(0,0,0,0.10)]">
            <CardHeader className="pb-3">
              <div className="mb-3 rounded-xl border border-black/10 bg-[#fafaf9] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Generation Status</p>
                    <p className="mt-1 text-sm font-semibold text-black/80">{currentStepLabel}</p>
                    <p className="mt-1 text-xs leading-5 text-black/50">{currentStepHint}</p>
                  </div>
                  <div className="rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white">
                    {result?.status ?? 'idle'}
                  </div>
                </div>
                <div className="mt-3 rounded-full border border-black/10 bg-white px-2 py-1.5 sm:px-4 sm:py-2.5">
                  <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-x-2 sm:gap-x-3">
                    {stepStates.map((step, index) => (
                      <>
                        <div key={step.key} className="flex min-w-0 items-center justify-center gap-1 sm:gap-2.5">
                          <div
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[6px] font-medium transition sm:h-7 sm:w-7 sm:text-[11px]',
                              step.done
                                ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                                : step.active
                                  ? 'border-black bg-black text-white'
                                  : 'border-black/10 bg-[#f4f4f2] text-black/35'
                            )}
                          >
                            {index + 1}
                          </div>
                          <div className="min-w-0 text-left leading-none">
                            <div className={cn('truncate text-[6px] font-medium sm:text-xs', step.done ? 'text-emerald-700' : step.active ? 'text-black' : 'text-black/45')}>
                              {step.label}
                            </div>
                            <div className={cn('hidden truncate text-[9px] sm:block sm:text-[11px]', step.done ? 'text-emerald-600/80' : step.active ? 'text-black/65' : 'text-black/35')}>
                              {step.done ? '完成' : step.active ? '进行中' : '等待中'}
                            </div>
                          </div>
                        </div>
                        {index < stepStates.length - 1 && <div key={`${step.key}-line`} className="mx-auto h-px w-2.5 bg-black/10 sm:w-8" />}
                      </>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111827] text-white">
                    <Sparkles className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">试穿结果</CardTitle>
                    <p className="text-xs text-black/50">支持切换精修开关，便于对比 coarse / refine</p>
                  </div>
                </div>
                <div className="hidden items-center gap-2 text-xs text-black/45 sm:flex">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>{result?.status ?? '未开始'}</span>
                </div>
                <div className="inline-flex w-full items-center gap-1 rounded-full border border-black/10 bg-white p-1 text-xs text-black/60 shadow-sm sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setRefineMode('on')}
                    className={cn(
                      'min-w-0 flex-1 rounded-full px-2.5 py-1.5 text-[12px] transition sm:px-3',
                      refineMode === 'on' ? 'bg-black text-white' : 'hover:bg-black/5'
                    )}
                  >
                    精修开
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefineMode('off')}
                    className={cn(
                      'min-w-0 flex-1 rounded-full px-2.5 py-1.5 text-[12px] transition sm:px-3',
                      refineMode === 'off' ? 'bg-black text-white' : 'hover:bg-black/5'
                    )}
                  >
                    精修关
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-[#f7f7f6]">
                {resultImageUrl ? (
                  <img src={resultImageUrl} alt="try-on result" className="max-h-[58vh] w-full object-contain" />
                ) : (
                  <div className="flex h-full min-h-[420px] w-full flex-col items-center justify-center px-6 text-black/40">
                    {isLoading ? <Loader2 className="mb-2 h-10 w-10 animate-spin" /> : <ImageIcon className="mb-2 h-10 w-10" />}
                    <p className="text-sm">{isLoading ? loadingText : '等待生成试穿结果'}</p>
                    <p className="mt-2 max-w-sm text-center text-xs leading-5 text-black/35">
                      提交后会先创建 job，再自动轮询 coarse / refine 进度。长耗时不再阻塞浏览器连接。
                    </p>
                    {isLoading && (
                      <div className="mt-5 w-full max-w-sm rounded-xl border border-black/10 bg-white/80 px-4 py-3 shadow-sm">
                        <div className="mb-2 flex items-center justify-between text-xs text-black/55">
                          <span>{loadingText}</span>
                          <span>{jobId ? `jobId: ${jobId.slice(0, 8)}` : '处理中'}</span>
                        </div>
                        <Progress value={currentProgress} className="h-2" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isLoading && !resultImageUrl && (
                <div className="rounded-xl border border-black/10 bg-[#fafaf9] px-4 py-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-black/55">
                    <span>{loadingText}</span>
                    <span>{jobId ? `jobId: ${jobId.slice(0, 8)}` : '处理中'}</span>
                  </div>
                  <Progress value={currentProgress} className="h-2" />
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
  );
}
