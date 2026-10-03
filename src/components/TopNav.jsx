import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import Avatar from './Avatar'
import CoinBadge from './CoinBadge'

/* ==========================================================================
   顶部主导航
   首页 / 景点 / 行程 / 社区 / 个人中心
   搜索入口在所有主要页面保持可见。
   ========================================================================== */

const LINKS = [
  { to: '/', label: '首页', end: true },
  { to: '/attractions', label: '景点' },
  { to: '/itinerary', label: '行程' },
  { to: '/community', label: '社区' },
  { to: '/map', label: '地图' },
  { to: '/tasks', label: '任务中心' },
  { to: '/notebook', label: '手札' },
]

export default function TopNav({ onOpenSearch }) {
  const { user, profile, avatarId, logout, unreadCount, requireLogin, setAuthModal } =
    useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const navRef = useRef(null)
  const navigate = useNavigate()

  /* 点击外部关闭下拉 */
  useEffect(() => {
    const onClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setUserOpen(false)
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const displayName = profile.name || user?.name || ''

  return (
    <header className="nav" ref={navRef}>
      <div className="container nav-inner">
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}brand/logo.png`} alt="驿程 Logo" width="48" height="40" />
          <span className="brand-text">
            <span className="brand-name">驿程</span>
            <span className="brand-tag">YICHENG</span>
          </span>
        </Link>

        <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <button
            className="nav-search"
            onClick={onOpenSearch}
            aria-label="搜索景点、帖子或用户"
          >
            <span aria-hidden="true">🔍</span>
            <span>搜索景点 / 帖子</span>
            <kbd>/</kbd>
          </button>

          <button
            className="icon-btn"
            onClick={onOpenSearch}
            aria-label="搜索"
            style={{ display: 'none' }}
            data-mobile-search
          >
            🔍
          </button>

          {/* 金币与萌宠：做小，避免抢走景点 / 行程 / 社区的主路径 */}
          <CoinBadge />

          <Link
            className="icon-btn"
            to="/notifications"
            aria-label={`消息通知，${unreadCount} 条未读`}
            title="消息通知"
          >
            🔔
            {unreadCount > 0 && (
              <span className="icon-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </Link>

          {user ? (
            <div className="nav-user">
              <button
                className="nav-user-trigger"
                onClick={() => setUserOpen((v) => !v)}
                aria-expanded={userOpen}
                aria-haspopup="menu"
              >
                <Avatar variant={avatarId} size={30} />
                <span className="nav-user-name">{displayName}</span>
                <span style={{ fontSize: 10, color: 'var(--ink-400)' }}>▾</span>
              </button>

              {userOpen && (
                <div className="dropdown" role="menu">
                  {user.role==='admin' && <Link className="dropdown-item" to="/admin" onClick={()=>setUserOpen(false)}>管理后台</Link>}
                  <div className="dropdown-head">
                    <div className="row row-3">
                      <Avatar variant={avatarId} size={40} ring />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)' }}>
                          {displayName}
                        </div>
                        <div className="xs muted">虚拟形象 · 社区身份</div>
                      </div>
                    </div>
                  </div>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setUserOpen(false)
                      navigate('/profile')
                    }}
                  >
                    <span>👤</span> 个人中心
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setUserOpen(false)
                      navigate('/profile?tab=avatar')
                    }}
                  >
                    <span>🎭</span> 编辑虚拟形象
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setUserOpen(false)
                      navigate('/profile?tab=posts')
                    }}
                  >
                    <span>📝</span> 我发布的内容
                  </button>
                  <Link
                    className="dropdown-item"
                    to="/profile?tab=saved"
                    onClick={() => setUserOpen(false)}
                  >
                    <span>⭐</span> 我的收藏
                  </Link>
                  <Link
                    className="dropdown-item"
                    to="/pets"
                    onClick={() => setUserOpen(false)}
                  >
                    <span>🐾</span> 萌宠与装扮
                  </Link>
                  <div className="dropdown-sep" />
                  <button
                    className="dropdown-item danger"
                    onClick={() => {
                      setUserOpen(false)
                      logout()
                    }}
                  >
                    <span>↩</span> 退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setAuthModal('login')
                }}
                style={{ display: 'none' }}
                data-desktop-only
              >
                登录
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setAuthModal('register')}
              >
                登录 / 注册
              </button>
            </>
          )}

          <button
            className="icon-btn nav-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="展开导航菜单"
            aria-expanded={menuOpen}
          >
            ☰
          </button>
        </div>
      </div>
    </header>
  )
}
