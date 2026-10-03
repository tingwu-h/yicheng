import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import Avatar, { AVATAR_PRESETS } from './Avatar'
import { Modal, Notice } from './ui'
import { BACKEND_ENABLED } from '../services/backendClient'

/* ==========================================================================
   登录 / 注册 / 首次使用引导
   · 简洁说明必要信息、验证步骤与隐私用途
   · 首次登录后引导设置昵称与虚拟形象，并允许稍后完成，不阻断景点浏览
   · 表单校验指出具体字段与修正方式；网络异常给出明确反馈与重试入口
   ========================================================================== */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* 模拟的网络延迟 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export function AuthFlow({ initialMode = 'login', intent = null, onDone, compact = false }) {
  const { login, setAvatarId } = useApp()
  const [mode, setMode] = useState(initialMode)
  const [step, setStep] = useState(0) // 0 表单 / 1 选形象 / 2 填昵称
  const [pending, setPending] = useState(false)
  const [form, setForm] = useState({
    account: '',
    password: '',
    confirm: '',
    agree: false,
    remember: true,
  })
  const [errors, setErrors] = useState({})
  const [newName, setNewName] = useState('')
  const [pick, setPick] = useState('av-1')

  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  /* ---------- 校验：逐字段指出问题与修正方式 ---------- */
  function validate() {
    const e = {}
    const acc = form.account.trim()

    if (mode === 'register') {
      /* 注册只使用邮箱，无需验证码 */
      if (!acc) e.account = '请输入邮箱'
      else if (!EMAIL_RE.test(acc)) e.account = '邮箱格式不正确，应形如 name@example.com'
    } else if (BACKEND_ENABLED && !EMAIL_RE.test(acc)) {
      e.account = '请输入注册时使用的邮箱'
    } else if (!acc) {
      e.account = '随便填一个非空昵称或测试账号即可'
    }

    if (!form.password) {
      e.password = '请输入密码'
    } else if (mode === 'register' && form.password.length < 8) {
      e.password = '密码至少 8 位，建议同时包含字母与数字'
    } else if (mode === 'register' && !/(?=.*[A-Za-z])(?=.*\d)/.test(form.password)) {
      e.password = '密码需同时包含字母和数字，以提升账号安全性'
    }

    if (mode === 'register') {
      if (!form.confirm) e.confirm = '请再次输入密码'
      else if (form.confirm !== form.password) e.confirm = '两次输入的密码不一致，请核对'

      if (!form.agree) e.agree = '请先阅读并同意用户协议与隐私说明'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev) {
    ev.preventDefault()
    if (!validate()) return

    setPending(true)
    try {
      if (!BACKEND_ENABLED) await wait(600)
      if (mode === 'login') {
        const account = form.account.trim()
        await login(account, { password: form.password, remember:form.remember, internalTest: !BACKEND_ENABLED && account === '内测账号' })
        onDone?.()
      } else { setNewName(form.account.trim().split('@')[0]); setStep(1) }
    } catch(e) { setErrors({ form: e.message }) }
    finally { setPending(false) }
  }

  async function finish() {
    if(pending) return
    setPending(true);setErrors({})
    try {
      if(BACKEND_ENABLED) await login(form.account.trim(),{register:true,password:form.password,name:newName.trim()||'长安游客',avatarId:pick,agree:form.agree,remember:form.remember})
      else {await login(newName.trim() || '长安游客', { isNew: true });setAvatarId(pick)}
      onDone?.()
    } catch(e) {setErrors({form:e.message})}
    finally {setPending(false)}
  }

  /* ======================================================================
     步骤 1：选择虚拟形象
     ====================================================================== */
  if (step === 1) {
    return (
      <div>
        <Steps current={1} />
        <Notice kind="brand" className="mb-4" >
          虚拟形象将作为你在社区的身份标识，与真实账号信息分开呈现。
          现在选择或稍后再定都可以。
        </Notice>

        <div className="row row-4" style={{ margin: '20px 0 24px', alignItems: 'center' }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: 'radial-gradient(circle at 50% 34%, #fff, var(--paper-200))',
              boxShadow: 'inset 0 0 0 1px var(--border-subtle)',
            }}
          >
            <Avatar variant={pick} size={84} />
          </div>
          <div className="grow">
            <p style={{ fontWeight: 700, fontSize: 'var(--fs-body-lg)' }}>
              {AVATAR_PRESETS.find((p) => p.id === pick)?.name}
            </p>
            <p className="small muted">
              {AVATAR_PRESETS.find((p) => p.id === pick)?.title}
              <br />
              共 30 款初始形象，注册后仍可在个人中心随时更换或自定义。
            </p>
          </div>
        </div>

        <div className="avatar-grid" style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
          {AVATAR_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`avatar-option ${pick === p.id ? 'on' : ''}`}
              onClick={() => setPick(p.id)}
              aria-pressed={pick === p.id}
            >
              <Avatar variant={p.id} size={56} />
              <span className="nm">{p.name}</span>
            </button>
          ))}
        </div>

        <div className="row row-3" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn btn-ghost" onClick={() => setStep(2)}>
            稍后完成
          </button>
          <button className="btn btn-primary" onClick={() => setStep(2)}>
            下一步
          </button>
        </div>
      </div>
    )
  }

  /* ======================================================================
     步骤 2：设置昵称
     ====================================================================== */
  if (step === 2) {
    return (
      <div>
        <Steps current={2} />
        {errors.form && <p role="alert" className="field-error">{errors.form}</p>}
        <div className="field" style={{ marginTop: 20 }}>
          <label className="label" htmlFor="nick">
            昵称<span className="req">*</span>
          </label>
          <input
            id="nick"
            className="input"
            value={newName}
            maxLength={16}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="例如：秦俑小骠"
          />
          <p className="field-hint">
            昵称会显示在帖子与评论中，{16 - newName.length} 字可用。可随时在个人中心修改。
          </p>
        </div>

        <Notice kind="quiet" className="mt-4">
          真实账号信息与虚拟形象分开呈现，其他游客只能看到你的昵称与形象。
        </Notice>

        <div className="row row-3" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn btn-secondary" disabled={pending} onClick={finish}>
            稍后设置
          </button>
          <button className="btn btn-primary" disabled={pending} onClick={finish}>
            {pending ? '正在创建账号…' : '完成，开始逛长安'}
          </button>
        </div>
      </div>
    )
  }

  /* ======================================================================
     步骤 0：登录 / 注册表单
     ====================================================================== */
  return (
    <div>
      <div className="auth-tabs" role="tablist">
        <button
          className={`auth-tab ${mode === 'login' ? 'on' : ''}`}
          onClick={() => {
            setMode('login')
            setErrors({})
          }}
          role="tab"
          aria-selected={mode === 'login'}
        >
          登录
        </button>
        <button
          className={`auth-tab ${mode === 'register' ? 'on' : ''}`}
          onClick={() => {
            setMode('register')
            setErrors({})
          }}
          role="tab"
          aria-selected={mode === 'register'}
        >
          注册
        </button>
      </div>

      {intent && (
        <Notice kind="brand" className="mb-4">
          {intent}
        </Notice>
      )}

      {mode === 'login' && <Notice kind="quiet" className="mb-4">{BACKEND_ENABLED ? '使用注册邮箱和密码登录，行程、金币与萌宠会保存到你的账号。原来的本机演示数据仍保留，但不会自动导入线上账号。' : '本地演示登录不验证身份，请勿输入真实密码。输入账号“内测账号”可载入全部萌宠、服饰和 9999 测试金币。'}</Notice>}
      {errors.form && <p role="alert" className="field-error">{errors.form}</p>}

      <form onSubmit={submit} noValidate>
        <div className="stack stack-4">
          <div className="field">
            <label className="label" htmlFor="acc">
              {mode === 'register' || BACKEND_ENABLED ? '邮箱' : '昵称 / 测试账号'}
              <span className="req">*</span>
            </label>
            <input
              id="acc"
              type={mode === 'register' ? 'email' : 'text'}
              className={`input ${errors.account ? 'error' : ''}`}
              value={form.account}
              onChange={(e) => set('account')(e.target.value)}
              placeholder={
                mode === 'register' || BACKEND_ENABLED ? 'name@example.com，用作登录账号' : '任意非空内容，例如：游客甲'
              }
              aria-invalid={!!errors.account}
              aria-describedby={errors.account ? 'acc-err' : undefined}
            />
            {errors.account && (
              <p className="field-error" id="acc-err">
                <span>⚠</span>
                {errors.account}
              </p>
            )}
          </div>

          <div className="field">
            <label className="label" htmlFor="pwd">
              密码<span className="req">*</span>
            </label>
            <input
              id="pwd"
              type="password"
              className={`input ${errors.password ? 'error' : ''}`}
              value={form.password}
              onChange={(e) => set('password')(e.target.value)}
              placeholder={mode === 'register' ? '至少 8 位，含字母和数字' : BACKEND_ENABLED ? '请输入注册时设置的密码' : '任意非空内容，不要使用真实密码'}
            />
            {errors.password && (
              <p className="field-error">
                <span>⚠</span>
                {errors.password}
              </p>
            )}
          </div>

          {mode === 'register' && (
            <div className="field">
              <label className="label" htmlFor="pwd2">
                确认密码<span className="req">*</span>
              </label>
              <input
                id="pwd2"
                type="password"
                className={`input ${errors.confirm ? 'error' : ''}`}
                value={form.confirm}
                onChange={(e) => set('confirm')(e.target.value)}
                placeholder="再次输入密码"
              />
              {errors.confirm && (
                <p className="field-error">
                  <span>⚠</span>
                  {errors.confirm}
                </p>
              )}
            </div>
          )}

          {mode === 'login' ? (
            <div className="row-between">
              <label className="check">
                <input type="checkbox" checked={form.remember} onChange={e=>set('remember')(e.target.checked)} />
                <span className="small">保持登录状态</span>
              </label>
              <span className="xs muted">{BACKEND_ENABLED ? '内测阶段暂不提供邮件找回密码' : '仅本机演示，不提供找回密码'}</span>
            </div>
          ) : (
            <div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.agree}
                  onChange={(e) => set('agree')(e.target.checked)}
                />
                <span>
                  我了解并同意本次内测会保存账号、行程、任务和金币记录。邮箱仅作为登录标识，尚未验证；照片不会自动公开，定位只用于本次任务校验。请使用专用测试密码，不要复用重要账号密码。
                </span>
              </label>
              {errors.agree && (
                <p className="field-error" style={{ marginTop: 6 }}>
                  <span>⚠</span>
                  {errors.agree}
                </p>
              )}
            </div>
          )}

          <button className="btn btn-primary btn-lg btn-block" disabled={pending}>
            {pending ? (
              <>
                <span className="spinner" />
                {mode === 'login' ? '登录中…' : '注册中…'}
              </>
            ) : mode === 'login' ? (
              '登录'
            ) : (
              '注册并创建虚拟形象'
            )}
          </button>
        </div>
      </form>

      <p className="xs muted center" style={{ marginTop: 20 }}>
        不登录也可以自由浏览景点与社区内容
        <br />
        收藏、发布、评论等操作需要登录后使用
      </p>
    </div>
  )
}

/* ---------- 步骤条 ---------- */
function Steps({ current }) {
  const items = ['账号', '虚拟形象', '昵称']
  return (
    <div className="steps">
      {items.map((label, i) => (
        <span
          key={label}
          className={`step ${i === current ? 'on' : ''} ${i < current ? 'done' : ''}`}
          style={{ flex: i < items.length - 1 ? 1 : 'none' }}
        >
          <span className="step-num">{i < current ? '✓' : i + 1}</span>
          <span className="step-label">{label}</span>
          {i < items.length - 1 && <span className="step-line" />}
        </span>
      ))}
    </div>
  )
}

/* ==========================================================================
   模态形态
   ========================================================================== */
export function AuthModal() {
  const { authModal, setAuthModal, authIntent, setAuthIntent } = useApp()

  if (!authModal) return null

  const close = () => {
    setAuthModal(null)
    setAuthIntent(null)
  }

  return (
    <Modal
      title={authModal === 'register' ? '创建账号' : '欢迎回来'}
      desc={
        authModal === 'register'
          ? '注册后可收藏景点、规划行程、发布游记并创建专属虚拟形象。'
          : '登录后即可收藏、评论、发布内容并管理你的行程。'
      }
      onClose={close}
      size="modal-lg"
    >
      <AuthFlow
        initialMode={authModal}
        intent={authIntent}
        onDone={() => {
          close()
        }}
      />
    </Modal>
  )
}

/* ==========================================================================
   独立页面形态 /login
   ========================================================================== */
export function AuthPage() {
  const navigate = useNavigate()

  return (
    <div className="container">
      <div className="auth-layout">
        <div className="auth-aside">
          <p className="hero-eyebrow" style={{ background: 'var(--cinnabar-50)', color: 'var(--cinnabar-700)', borderColor: 'var(--cinnabar-100)' }}>
            驿程
          </p>
          <h1 className="auth-brand-title" style={{ marginTop: 16 }}>
            发现目的地
            <br />
            了解景点
            <br />
            <span style={{ color: 'var(--cinnabar-700)' }}>规划行程 · 记录分享</span>
          </h1>
          <p className="muted" style={{ marginTop: 20, maxWidth: 460, lineHeight: 1.8 }}>
            登录后可以收藏景点、把景点加入行程、发布游记并在社区与其他游客交流。
            虚拟形象作为你在社区的身份标识，与真实账号信息分开呈现。
          </p>

          <div className="stack stack-3" style={{ marginTop: 32, maxWidth: 420 }}>
            <Perk icon="⭐" title="收藏与行程" desc="把感兴趣的景点收起来，按日期整理成可执行的安排。" />
            <Perk icon="📝" title="发布游记" desc="分享路线攻略、避坑经验与实拍感受。" />
            <Perk icon="🎭" title="专属虚拟形象" desc="30 款兵马俑初始形象任选，打造线上游玩身份。" />
          </div>
        </div>

        <div className="auth-card">
          <AuthFlow initialMode="login" onDone={() => navigate('/profile')} />
        </div>
      </div>
    </div>
  )
}

function Perk({ icon, title, desc }) {
  return (
    <div className="row row-3" style={{ alignItems: 'flex-start' }}>
      <span style={{ fontSize: 20, lineHeight: 1.2 }}>{icon}</span>
      <span>
        <span style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', display: 'block' }}>
          {title}
        </span>
        <span className="small muted">{desc}</span>
      </span>
    </div>
  )
}
