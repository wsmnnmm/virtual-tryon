import { useMemo, useState } from 'react'
import './App.css'

type JobStatus =
  | 'draft'
  | 'ready'
  | 'submitted'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed_retryable'
  | 'failed_final'

type AppTab = 'studio' | 'history' | 'pricing' | 'account'

interface JobItem {
  id: string
  status: JobStatus
  createdAt: string
  personName: string
  garmentName: string
}

const statusLabelMap: Record<JobStatus, string> = {
  draft: '草稿',
  ready: '待提交',
  submitted: '已提交',
  queued: '排队中',
  running: '生成中',
  succeeded: '已完成',
  failed_retryable: '失败可重试',
  failed_final: '失败终态',
}

const statusToneMap: Record<JobStatus, 'neutral' | 'info' | 'ok' | 'danger'> = {
  draft: 'neutral',
  ready: 'info',
  submitted: 'info',
  queued: 'info',
  running: 'info',
  succeeded: 'ok',
  failed_retryable: 'danger',
  failed_final: 'danger',
}

const mockHistory: JobItem[] = [
  {
    id: 'job_001',
    status: 'succeeded',
    createdAt: '2026-04-12 16:20',
    personName: 'person_demo_1.jpg',
    garmentName: 'shirt_blue.png',
  },
  {
    id: 'job_002',
    status: 'running',
    createdAt: '2026-04-13 10:05',
    personName: 'person_demo_2.jpg',
    garmentName: 'jacket_black.png',
  },
]

function App() {
  const [tab, setTab] = useState<AppTab>('studio')
  const [personImage, setPersonImage] = useState<File | null>(null)
  const [garmentImage, setGarmentImage] = useState<File | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus>('draft')

  const canSubmit = personImage && garmentImage && (jobStatus === 'draft' || jobStatus === 'ready')

  const statusHint = useMemo(() => {
    if (!personImage || !garmentImage) {
      return '请先上传人物图与服饰图'
    }

    if (jobStatus === 'draft') {
      return '素材齐全，可提交生成'
    }

    return `当前状态：${statusLabelMap[jobStatus]}`
  }, [personImage, garmentImage, jobStatus])

  const onUploadPerson = (file: File | null) => {
    setPersonImage(file)
    if (file && garmentImage) {
      setJobStatus('ready')
    }
  }

  const onUploadGarment = (file: File | null) => {
    setGarmentImage(file)
    if (file && personImage) {
      setJobStatus('ready')
    }
  }

  const startGenerate = () => {
    if (!canSubmit) return
    setJobStatus('submitted')
    setTimeout(() => setJobStatus('queued'), 400)
    setTimeout(() => setJobStatus('running'), 1100)
    setTimeout(() => setJobStatus('succeeded'), 2600)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand">Virtual Try-On</p>
          <h1>MVP 控制台</h1>
          <p className="subtitle">从上传到生成下载，一条龙打通你的首版 AI 试穿产品。</p>
        </div>
        <button className="ghost-button">升级 Pro</button>
      </header>

      <nav className="tabs">
        {([
          ['studio', '试穿工作台'],
          ['history', '历史记录'],
          ['pricing', '订阅定价'],
          ['account', '账户账单'],
        ] as Array<[AppTab, string]>).map(([id, label]) => (
          <button key={id} className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'studio' && (
        <main className="panel-grid">
          <section className="panel upload-panel">
            <h2>1) 上传人物图</h2>
            <p className="help">建议正面、清晰、无遮挡。</p>
            <label className="dropzone">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onUploadPerson(e.target.files?.[0] ?? null)}
              />
              <span>点击上传或拖拽到这里</span>
            </label>
            <p className="file-name">{personImage ? personImage.name : '未上传'}</p>
          </section>

          <section className="panel upload-panel">
            <h2>2) 上传服饰图</h2>
            <p className="help">建议纯背景、完整平铺。</p>
            <label className="dropzone">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onUploadGarment(e.target.files?.[0] ?? null)}
              />
              <span>点击上传或拖拽到这里</span>
            </label>
            <p className="file-name">{garmentImage ? garmentImage.name : '未上传'}</p>
          </section>

          <section className="panel">
            <h2>3) 生成与状态</h2>
            <p className={`status-badge ${statusToneMap[jobStatus]}`}>{statusLabelMap[jobStatus]}</p>
            <p className="help">{statusHint}</p>
            <div className="button-row">
              <button className="primary-button" onClick={startGenerate} disabled={!canSubmit}>
                开始生成
              </button>
              <button className="ghost-button" onClick={() => setJobStatus('failed_retryable')}>
                模拟失败
              </button>
            </div>
            <div className="result-box">
              <div className="preview before">
                <span>Before</span>
              </div>
              <div className="preview after">
                <span>{jobStatus === 'succeeded' ? 'After' : 'Generating...'}</span>
              </div>
            </div>
          </section>
        </main>
      )}

      {tab === 'history' && (
        <main className="list-panel">
          <h2>历史任务</h2>
          {mockHistory.map((job) => (
            <article key={job.id} className="history-item">
              <div>
                <p className="history-id">{job.id}</p>
                <p className="help">
                  {job.personName} + {job.garmentName}
                </p>
              </div>
              <div>
                <p className={`status-badge ${statusToneMap[job.status]}`}>{statusLabelMap[job.status]}</p>
                <p className="help">{job.createdAt}</p>
              </div>
            </article>
          ))}
        </main>
      )}

      {tab === 'pricing' && (
        <main className="list-panel">
          <h2>订阅定价（MVP）</h2>
          <div className="pricing-grid">
            <article className="price-card">
              <h3>Free</h3>
              <p>每月 5 次低清生成，含水印，普通队列</p>
            </article>
            <article className="price-card pro">
              <h3>Pro</h3>
              <p>每月 300 次高清生成，无水印，优先队列</p>
            </article>
          </div>
        </main>
      )}

      {tab === 'account' && (
        <main className="list-panel">
          <h2>账户与账单</h2>
          <article className="account-kpis">
            <div>
              <p className="help">当前套餐</p>
              <p className="kpi">Free</p>
            </div>
            <div>
              <p className="help">剩余额度</p>
              <p className="kpi">5 次</p>
            </div>
          </article>
          <p className="help">账单模块待接入（Stripe/Paddle）</p>
        </main>
      )}
    </div>
  )
}

export default App
