import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store/AppContext'

/* ==========================================================================
   通用 UI 组件
   ========================================================================== */

/* --------------------------------------------------------------------------
   图片 / 占位
   传入 src 时显示实景图（加载失败自动回退占位）；
   不传 src 时用唐风渐变 + 唐纹底样 + 名称构建占位，
   保证与整体视觉一致，且不会出现破图。
   -------------------------------------------------------------------------- */
export function Thumb({
  src = '',
  alt = '',
  tone = ['#8C5A3C', '#5E3A26'],
  label = '',
  ratio,
  className = '',
  children,
}) {
  const raw = useId()
  const patternId = `tile-${raw.replace(/[^a-zA-Z0-9]/g, '')}`
  const [brokenSrc, setBrokenSrc] = useState(null)
  const showImg = src && brokenSrc !== src

  return (
    <div
      className={`thumb ${className}`}
      style={{
        background: `linear-gradient(150deg, ${tone[0]}, ${tone[1]})`,
        ...(ratio ? { aspectRatio: ratio } : null),
      }}
    >
      {/* 唐纹底样（有实景图时隐藏） */}
      {!showImg && (
        <svg
          viewBox="0 0 200 200"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0.16,
          }}
        >
          <defs>
            <pattern id={patternId} width="40" height="40" patternUnits="userSpaceOnUse">
              <circle
                cx="20"
                cy="20"
                r="9"
                fill="none"
                stroke="#fff"
                strokeWidth="1"
              />
              <circle
                cx="20"
                cy="20"
                r="3.2"
                fill="none"
                stroke="#fff"
                strokeWidth="1"
              />
              <path d="M0 0 L40 0 M0 40 L40 40" stroke="#fff" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="200" height="200" fill={`url(#${patternId})`} />
        </svg>
      )}

      {showImg && (
        <img
          src={src}
          alt={alt || label}
          loading="lazy"
          decoding="async"
          onError={() => setBrokenSrc(src)}
          style={{ position: 'absolute', inset: 0 }}
        />
      )}

      {!showImg && label && <span className="thumb-fallback">{label}</span>}
      {children}
    </div>
  )
}

/* --------------------------------------------------------------------------
   面包屑
   -------------------------------------------------------------------------- */
export function Breadcrumb({ items = [] }) {
  return (
    <nav className="breadcrumb" aria-label="面包屑">
      <Link to="/">首页</Link>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'contents' }}>
          <span className="sep">/</span>
          {it.to && i < items.length - 1 ? (
            <Link to={it.to}>{it.label}</Link>
          ) : (
            <span className="current">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

/* --------------------------------------------------------------------------
   载入 / 空结果 / 失败重试 —— 所有列表页统一使用
   -------------------------------------------------------------------------- */
export function LoadingState({ rows = 6, label = '正在加载…' }) {
  return (
    <div>
      <p className="sr-only">{label}</p>
      <div className="grid-attractions">
        {Array.from({ length: rows }).map((_, i) => (
          <div className="skeleton-card" key={i}>
            <div className="skeleton" style={{ aspectRatio: '16 / 10' }} />
            <div style={{ padding: 20, display: 'grid', gap: 10 }}>
              <div className="skeleton" style={{ height: 18, width: '72%' }} />
              <div className="skeleton" style={{ height: 13, width: '100%' }} />
              <div className="skeleton" style={{ height: 13, width: '86%' }} />
              <div
                className="skeleton"
                style={{ height: 20, width: '40%', marginTop: 6 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function EmptyState({
  icon = '空',
  title,
  desc,
  actions,
  tone = 'quiet',
}) {
  return (
    <div className="state">
      <div className={`state-icon ${tone === 'info' ? 'info' : ''}`}>{icon}</div>
      <h3 className="state-title">{title}</h3>
      {desc && <p className="state-desc">{desc}</p>}
      {actions && <div className="state-actions">{actions}</div>}
    </div>
  )
}

export function ErrorState({
  title = '加载失败',
  desc = '网络似乎不太顺畅，请检查连接后重试。已为你保留当前的筛选条件。',
  onRetry,
}) {
  return (
    <div className="state">
      <div className="state-icon warn">!</div>
      <h3 className="state-title">{title}</h3>
      <p className="state-desc">{desc}</p>
      <div className="state-actions">
        <button className="btn btn-primary" onClick={onRetry}>
          重新加载
        </button>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   提示条
   -------------------------------------------------------------------------- */
export function Notice({ kind = 'info', icon, children, className = '' }) {
  const icons = { info: 'ⓘ', warn: '⚠', brand: '★', quiet: '·' }
  return (
    <div className={`notice notice-${kind} ${className}`}>
      <span className="notice-icon">{icon ?? icons[kind]}</span>
      <div className="grow">{children}</div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   信息更新时间 / 来源提示
   重要信息（开放时间、票价、交通）统一标注，避免被当作实时承诺
   -------------------------------------------------------------------------- */
export function SourceNote({ updatedAt, source = '平台整理' }) {
  return (
    <p className="source-note">
      <span>ⓘ</span>
      信息更新于 {updatedAt} · 来源：{source} · 出行前请核实
    </p>
  )
}

/* --------------------------------------------------------------------------
   模态框
   -------------------------------------------------------------------------- */
export function Modal({ title, desc, children, footer, onClose, size = '' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className={`modal ${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 className="modal-title">{title}</h2>
            {desc && <p className="modal-desc">{desc}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   抽屉
   -------------------------------------------------------------------------- */
export function Drawer({ title, onClose, children, headExtra }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="overlay" style={{ alignItems: 'stretch', padding: 0 }} onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="drawer-head">
          <h2 style={{ fontSize: 'var(--fs-h3)' }}>{title}</h2>
          <div className="row row-2">
            {headExtra}
            <button className="icon-btn" onClick={onClose} aria-label="关闭">
              ✕
            </button>
          </div>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   分页
   -------------------------------------------------------------------------- */
export function Pager({ page, total, onChange }) {
  if (total <= 1) return null
  const pages = Array.from({ length: total }, (_, i) => i + 1)
  return (
    <nav className="pager" aria-label="分页">
      <button disabled={page === 1} onClick={() => onChange(page - 1)}>
        上一页
      </button>
      {pages.map((p) => (
        <button
          key={p}
          className={p === page ? 'on' : ''}
          onClick={() => onChange(p)}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </button>
      ))}
      <button disabled={page === total} onClick={() => onChange(page + 1)}>
        下一页
      </button>
    </nav>
  )
}

/* --------------------------------------------------------------------------
   页脚
   -------------------------------------------------------------------------- */
export function Footer() {
  const { isLoggedIn } = useApp()
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div>
            <div className="brand">
              <img className="brand-logo" src={`${import.meta.env.BASE_URL}brand/logo.png`} alt="驿程 Logo" width="48" height="40" />
              <span className="brand-text">
                <span className="brand-name">驿程</span>
                <span className="brand-tag">YICHENG</span>
              </span>
            </div>
            <p className="footer-note">
              面向西安游客的旅游信息与交流平台。景点信息由平台整理，用户内容为用户个人经验分享，
              不代表官方发布，出行前请以官方渠道为准。
            </p>
          </div>

          <div className="footer-links">
            <div className="footer-col">
              <h4>发现</h4>
              <Link to="/attractions">景点库</Link>
              <Link to="/map">地图总览</Link>
              <Link to="/community">社区广场</Link>
            </div>
            <div className="footer-col">
              <h4>规划</h4>
              <Link to="/itinerary">行程规划</Link>
              <Link to="/profile?tab=saved">我的收藏</Link>
              <Link to="/notifications">消息通知</Link>
            </div>
            <div className="footer-col">
              <h4>关于</h4>
              <Link to="/community?rules=1">社区规范</Link>
              <Link to="/profile">个人中心</Link>
              {isLoggedIn
                ? <Link to="/profile?tab=settings">账号设置</Link>
                : <Link to="/login">登录注册</Link>}
            </div>
          </div>
        </div>

      </div>
    </footer>
  )
}
