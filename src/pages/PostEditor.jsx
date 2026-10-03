import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { TOPICS, COMPOSER_TOPIC_HINT, topicName } from '../data/community'
import { attractions, regionName } from '../data/attractions'
import {
  Breadcrumb,
  Modal,
  Notice,
  Thumb,
  EmptyState,
} from '../components/ui'
import Avatar from '../components/Avatar'

/* ==========================================================================
   发布页
   支持输入标题与正文、添加图片、选择关联景点和话题。
   发布前可预览；草稿、上传中、发布成功与失败状态均给出清晰反馈，
   通过按钮禁用与状态锁避免重复提交、防止内容丢失。
   ========================================================================== */

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const MAX_TITLE = 60
const MIN_BODY = 30

export default function PostEditor() {
  const { draftId } = useParams()
  const navigate = useNavigate()
  const {
    isLoggedIn,
    setAuthModal,
    publishPost,
    drafts,
    saveDraft,
    deleteDraft,
    toast,
    avatarId,
    profile,
    user,
  } = useApp()

  const [form, setForm] = useState({
    id: draftId || `draft-${Date.now()}`,
    title: '',
    body: '',
    topic: '',
    attraction: '',
    images: [],
  })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | uploading | submitting | success | error
  const [uploading, setUploading] = useState({}) // { [key]: progress }
  const [previewOpen, setPreviewOpen] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  /* 载入草稿 */
  useEffect(() => {
    if (!draftId) return
    const d = drafts.find((x) => x.id === draftId)
    if (d) setForm(d)
  }, [draftId, drafts])

  /* 未登录时提示，但不强制跳转，避免内容丢失 */
  useEffect(() => {
    if (!isLoggedIn) setAuthModal('register')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
    if (status === 'error') setStatus('idle')
  }

  /* ---------- 校验 ---------- */
  function validate() {
    const e = {}
    if (!form.title.trim()) e.title = '请填写标题'
    else if (form.title.trim().length < 6) e.title = '标题太短，建议至少 6 个字，让读者一眼知道内容主题'

    if (!form.body.trim()) e.body = '请填写正文'
    else if (form.body.trim().length < MIN_BODY)
      e.body = `正文至少 ${MIN_BODY} 个字，把实际经历写清楚，对读者更有帮助`

    if (!form.topic) e.topic = '请选择一个人物话题，便于其他游客找到你的内容'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  /* ---------- 模拟图片上传 ---------- */
  async function addImages() {
    const key = `img-${Date.now()}`
    setUploading((u) => ({ ...u, [key]: 0 }))
    setStatus('uploading')

    for (let p = 10; p <= 100; p += 15) {
      await wait(140)
      setUploading((u) => ({ ...u, [key]: Math.min(p, 100) }))
    }

    setUploading((u) => {
      const { [key]: done, ...rest } = u
      return rest
    })
    setForm((f) => ({
      ...f,
      images: [...f.images, { key, tone: ['#8C5A3C', '#5E3A26'] }],
    }))
    setStatus('idle')
    toast('图片已添加，发布前仍可删除', 'success')
  }

  function removeImage(key) {
    setForm((f) => ({ ...f, images: f.images.filter((i) => i.key !== key) }))
    toast('已移除图片', 'info')
  }

  /* ---------- 保存草稿 ---------- */
  function onSaveDraft() {
    if (!form.title.trim() && !form.body.trim()) {
      toast('还没有可保存的内容', 'warning')
      return
    }
    saveDraft(form)
    setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
  }

  /* ---------- 发布 ---------- */
  async function submit() {
    if (status === 'submitting' || status === 'success') return // 防重复提交
    if (!validate()) {
      toast('还有必填项没有完成，请检查标红的字段', 'warning')
      return
    }

    setStatus('submitting')
    await wait(900)

    /* 演示：标题含「失败」时模拟提交失败 */
    if (form.title.includes('失败')) {
      setStatus('error')
      return
    }

    const post = publishPost(form)
    deleteDraft(form.id)
    setStatus('success')
    toast('发布成功，内容已出现在社区', 'success')

    await wait(700)
    navigate(`/post/${post.id}`)
  }

  const uploadingCount = Object.keys(uploading).length
  const canPublish = form.title.trim() && form.body.trim() && form.topic && status !== 'submitting'

  /* ======================================================================
     成功态
     ====================================================================== */
  if (status === 'success') {
    return (
      <div className="container page">
        <EmptyState
          icon="✓"
          title="发布成功"
          desc="内容已出现在社区广场，其他游客现在可以查看、点赞与评论。"
          actions={
            <>
              <Link className="btn btn-primary" to="/community">
                去社区看看
              </Link>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setForm({
                    id: `draft-${Date.now()}`,
                    title: '',
                    body: '',
                    topic: '',
                    attraction: '',
                    images: [],
                  })
                  setStatus('idle')
                }}
              >
                再写一篇
              </button>
            </>
          }
        />
      </div>
    )
  }

  /* ======================================================================
     未登录提示
     ====================================================================== */
  if (!isLoggedIn) {
    return (
      <div className="container page">
        <EmptyState
          icon="✎"
          title="登录后即可发布内容"
          desc="你可以先把想写的内容记下来，登录后继续。发布游记、攻略与经验分享需要账号。"
          tone="info"
          actions={
            <>
              <button className="btn btn-primary" onClick={() => setAuthModal('login')}>
                登录
              </button>
              <button className="btn btn-secondary" onClick={() => setAuthModal('register')}>
                注册新账号
              </button>
            </>
          }
        />
      </div>
    )
  }

  /* ======================================================================
     编辑态
     ====================================================================== */
  return (
    <div className="page">
      <div className="container">
        <Breadcrumb items={[{ label: '社区广场', to: '/community' }, { label: '发布内容' }]} />

        <div className="row-between wrap row-4" style={{ marginTop: 'var(--sp-6)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--fs-h1)' }}>发布内容</h1>
            <p className="muted small" style={{ marginTop: 8 }}>
              分享你的西安旅行经历 · {savedAt ? `草稿保存于 ${savedAt}` : '内容会自动保留在当前页面'}
            </p>
          </div>

          <div className="row row-2">
            <button className="btn btn-secondary" onClick={onSaveDraft}>
              存为草稿
            </button>
            <button className="btn btn-secondary" onClick={() => setPreviewOpen(true)}>
              预览
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={!canPublish}>
              {status === 'submitting' ? (
                <>
                  <span className="spinner" />
                  发布中…
                </>
              ) : (
                '发布'
              )}
            </button>
          </div>
        </div>

        {/* 发布失败 */}
        {status === 'error' && (
          <Notice kind="warn" className="mt-5">
            <div className="row-between wrap row-4">
              <span>
                <strong>发布失败</strong>，内容没有提交成功。
                你写的文字和已添加的图片都保留在当前页面，可以直接重试。
              </span>
              <span className="row row-2" style={{ flexShrink: 0 }}>
                <button className="btn btn-secondary btn-sm" onClick={onSaveDraft}>
                  先存草稿
                </button>
                <button className="btn btn-primary btn-sm" onClick={submit}>
                  重试发布
                </button>
              </span>
            </div>
          </Notice>
        )}

        <div className="editor-layout">
          {/* ---------------- 主体表单 ---------------- */}
          <div className="stack stack-6">
            <div className="card card-pad">
              <div className="stack stack-5">
                {/* 标题 */}
                <div className="field">
                  <label className="label" htmlFor="title">
                    标题<span className="req">*</span>
                  </label>
                  <input
                    id="title"
                    className={`input ${errors.title ? 'error' : ''}`}
                    value={form.title}
                    maxLength={MAX_TITLE}
                    onChange={(e) => set('title')(e.target.value)}
                    placeholder="用一句话说清这篇内容讲什么，例如「兵马俑别上午去」"
                    aria-invalid={!!errors.title}
                  />
                  <div className="row-between">
                    {errors.title ? (
                      <p className="field-error">
                        <span>⚠</span>
                        {errors.title}
                      </p>
                    ) : (
                      <p className="field-hint">好的标题能让人一眼判断对自己是否有用</p>
                    )}
                    <span className="xs muted">
                      {form.title.length} / {MAX_TITLE}
                    </span>
                  </div>
                </div>

                {/* 正文 */}
                <div className="field">
                  <label className="label" htmlFor="body">
                    正文<span className="req">*</span>
                  </label>
                  <textarea
                    id="body"
                    className={`textarea ${errors.body ? 'error' : ''}`}
                    style={{ minHeight: 240 }}
                    value={form.body}
                    onChange={(e) => set('body')(e.target.value)}
                    placeholder={
                      '写下你的实际经历。建议包含：\n· 你什么时候去的，当时的实际情况\n· 具体的路线、耗时与花费\n· 对后来的人有用的提醒'
                    }
                    aria-invalid={!!errors.body}
                  />
                  <div className="row-between">
                    {errors.body ? (
                      <p className="field-error">
                        <span>⚠</span>
                        {errors.body}
                      </p>
                    ) : (
                      <p className="field-hint">
                        涉及价格与时间的信息，建议写明你去的日期
                      </p>
                    )}
                    <span className="xs muted">{form.body.length} 字</span>
                  </div>
                </div>

                {/* 图片 */}
                <div className="field">
                  <label className="label">
                    图片<span className="opt">（选填）</span>
                  </label>

                  {form.images.length > 0 && (
                    <div className="upload-grid" style={{ marginBottom: 'var(--sp-3)' }}>
                      {form.images.map((img, i) => (
                        <div className="upload-item" key={img.key}>
                          <Thumb tone={img.tone} label="" />
                          <button
                            className="upload-remove"
                            onClick={() => removeImage(img.key)}
                            aria-label={`移除第 ${i + 1} 张图片`}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {uploadingCount > 0 && (
                    <div className="upload-grid" style={{ marginBottom: 'var(--sp-3)' }}>
                      {Object.entries(uploading).map(([k, p]) => (
                        <div className="upload-item" key={k}>
                          <div
                            className="thumb"
                            style={{ background: 'var(--paper-200)', height: '100%' }}
                          />
                          <div className="upload-progress">
                            <span style={{ width: `${p}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    className="upload-zone"
                    onClick={addImages}
                    disabled={status === 'uploading'}
                    type="button"
                  >
                    <span style={{ fontSize: 22 }}>＋</span>
                    <span>
                      {status === 'uploading'
                        ? `上传中… ${Object.values(uploading)[0] ?? 0}%`
                        : '点击添加图片'}
                    </span>
                    <span className="xs">演示环境不会真正上传文件</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 话题与关联景点 */}
            <div className="card card-pad">
              <div className="stack stack-5">
                <div className="field">
                  <label className="label">
                    选择话题<span className="req">*</span>
                  </label>
                  <div className="topic-picker">
                    {TOPICS.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className={`chip ${form.topic === t.key ? 'on' : ''}`}
                        onClick={() => set('topic')(t.key)}
                        aria-pressed={form.topic === t.key}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                  {errors.topic && (
                    <p className="field-error">
                      <span>⚠</span>
                      {errors.topic}
                    </p>
                  )}
                  <p className="field-hint">
                    话题决定内容出现在哪个分类下，也影响其他游客能否找到它。
                  </p>
                </div>

                <div className="field">
                  <label className="label" htmlFor="attraction">
                    关联景点<span className="opt">（选填）</span>
                  </label>
                  <select
                    id="attraction"
                    className="select"
                    value={form.attraction}
                    onChange={(e) => set('attraction')(e.target.value)}
                  >
                    <option value="">不关联景点</option>
                    {attractions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}（{regionName(a.region)}）
                      </option>
                    ))}
                  </select>
                  <p className="field-hint">
                    关联后，这篇内容会出现在该景点的「游客经验」中，方便其他游客查看。
                  </p>
                </div>
              </div>
            </div>

            <Notice kind="quiet">{COMPOSER_TOPIC_HINT}</Notice>
          </div>

          {/* ---------------- 侧栏 ---------------- */}
          <aside className="detail-aside">
            <div className="card card-pad">
              <p className="label" style={{ marginBottom: 'var(--sp-4)' }}>
                发布者
              </p>
              <div className="avatar-name">
                <Avatar variant={avatarId} size={46} ring />
                <span>
                  <span className="nm" style={{ fontSize: 'var(--fs-body)' }}>
                    {profile.name || user?.name}
                  </span>
                  <br />
                  <span className="sub">虚拟形象将作为社区身份展示</span>
                </span>
              </div>
              <Link
                className="btn btn-secondary btn-sm btn-block"
                to="/profile?tab=avatar"
                style={{ marginTop: 'var(--sp-4)' }}
              >
                更换形象
              </Link>
            </div>

            <div className="card card-pad">
              <p className="label" style={{ marginBottom: 'var(--sp-4)' }}>
                发布前检查
              </p>
              <div className="stack stack-3">
                <Check ok={form.title.trim().length >= 6} label="标题说清了主题" />
                <Check ok={form.body.trim().length >= MIN_BODY} label="正文写清了实际经历" />
                <Check ok={!!form.topic} label="选择了合适的话题" />
                <Check
                  ok={!!form.attraction}
                  label="关联了相关景点"
                  optional
                />
                <Check
                  ok={!/绝对|一定|百分百/.test(form.body)}
                  label="没有使用绝对化承诺表述"
                />
                <Check ok={/20\d\d|月|日|今天|昨天/.test(form.body)} label="注明了时间信息" optional />
              </div>
            </div>

            {/* 草稿箱 */}
            {drafts.length > 0 && (
              <div className="card card-pad">
                <p className="label" style={{ marginBottom: 'var(--sp-3)' }}>
                  草稿箱 · {drafts.length}
                </p>
                <div className="stack stack-2">
                  {drafts.map((d) => (
                    <div key={d.id} className="row row-2">
                      <span className="grow small clamp-1">
                        {d.title || '（未命名草稿）'}
                      </span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setForm(d)}
                        title="继续编辑"
                      >
                        编辑
                      </button>
                      <button
                        className="btn btn-ghost btn-sm btn-danger-text"
                        onClick={() => deleteDraft(d.id)}
                        title="删除草稿"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* ---------------- 预览 ---------------- */}
      {previewOpen && (
        <Modal
          title="发布预览"
          desc="确认内容无误后再发布。这里的效果与发布后基本一致。"
          onClose={() => setPreviewOpen(false)}
          size="modal-lg"
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setPreviewOpen(false)}>
                返回编辑
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setPreviewOpen(false)
                  submit()
                }}
                disabled={status === 'submitting'}
              >
                确认发布
              </button>
            </>
          }
        >
          <div className="post-tags" style={{ marginBottom: 'var(--sp-4)' }}>
            {form.topic && (
              <span className="tag tag-cinnabar">{topicName(form.topic)}</span>
            )}
            {form.attraction && (
              <span className="tag tag-outline">
                关联 · {attractions.find((a) => a.id === form.attraction)?.name}
              </span>
            )}
          </div>

          <h2 style={{ fontSize: 'var(--fs-h2)', lineHeight: 1.35 }}>
            {form.title || '（未填写标题）'}
          </h2>

          <div className="row row-3" style={{ margin: 'var(--sp-5) 0' }}>
            <Avatar variant={avatarId} size={38} />
            <div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
                {profile.name || user?.name}
              </div>
              <div className="xs muted">刚刚</div>
            </div>
          </div>

          <div style={{ fontSize: 'var(--fs-body)', lineHeight: 1.9, color: 'var(--ink-700)' }}>
            {(form.body || '（未填写正文）').split('\n').map((line, i) => (
              <p key={i} style={{ marginTop: i ? 12 : 0 }}>
                {line || ' '}
              </p>
            ))}
          </div>

          {form.images.length > 0 && (
            <div className="upload-grid" style={{ marginTop: 'var(--sp-5)' }}>
              {form.images.map((img, i) => (
                <div className="upload-item" key={img.key}>
                  <Thumb tone={img.tone} label={`图 ${i + 1}`} />
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function Check({ ok, label, optional }) {
  return (
    <div className="row row-2 small" style={{ color: ok ? 'var(--success-600)' : 'var(--text-muted)' }}>
      <span style={{ flexShrink: 0 }}>{ok ? '✓' : '○'}</span>
      <span>
        {label}
        {optional && <span className="xs"> （选填）</span>}
      </span>
    </div>
  )
}
