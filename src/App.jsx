import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { HashRouter, Routes, Route, useLocation, Link, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './store/AppContext'
import { QuestProvider } from './store/QuestContext'
import TopNav from './components/TopNav'
import SearchOverlay from './components/SearchOverlay'
import TaskCard from './components/TaskCard'
import { AuthModal } from './components/AuthFlow'
import { EmptyState, Footer } from './components/ui'

import Home from './pages/Home'
import Notebook from './pages/Notebook'
import Attractions from './pages/Attractions'
import AttractionDetail from './pages/AttractionDetail'
import Itinerary from './pages/Itinerary'
import PlayTrip from './pages/PlayTrip'
import Community from './pages/Community'
import PostDetail from './pages/PostDetail'
import PostEditor from './pages/PostEditor'
import Profile from './pages/Profile'
import UserProfile from './pages/UserProfile'
import MapView from './pages/MapView'
import Notifications from './pages/Notifications'
import SearchResults from './pages/SearchResults'
import TaskCenter from './pages/TaskCenter'
import { JourneyProvider } from './store/JourneyContext'
import Pets from './pages/Pets'
import { AuthPage } from './components/AuthFlow'
import { BACKEND_ENABLED } from './services/backendClient'
import Admin from './pages/Admin'

/* ==========================================================================
   应用外壳：统一顶部导航 + 内容区 + 页脚
   搜索浮层、登录模态与提示条在所有页面可用
   ========================================================================== */

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

function ToastHost() {
  const { toasts, dismissToast } = useApp()
  if (!toasts.length) return null

  const icons = { success: '✓', error: '!', info: 'i', warning: '!' }

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div className={`toast ${t.type}`} key={t.id}>
          <span className="toast-icon">{icons[t.type] ?? '✓'}</span>
          <span>{t.message}</span>
          {t.action?.to && (
            <Link className="toast-action" to={t.action.to} onClick={() => dismissToast(t.id)}>
              {t.action.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}

/* 键盘快捷键：/ 唤起搜索 */
function useSearchHotkey(open) {
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key === '/' && !typing) {
        e.preventDefault()
        open()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
}

function NotFound() {
  return (
    <div className="container">
      <EmptyState
        icon="?"
        title="页面不存在"
        desc="这个链接可能已经失效，或者地址输错了。"
        actions={
          <>
            <Link className="btn btn-primary" to="/">
              回到首页
            </Link>
            <Link className="btn btn-secondary" to="/attractions">
              浏览景点库
            </Link>
          </>
        }
      />
    </div>
  )
}

function Shell() {
  const { cloudStatus, flushAccount, user } = useApp()
  const location = useLocation()
  const [displayLocation, setDisplayLocation] = useState(location)
  const pageRef = useRef(null)
  useLayoutEffect(() => {
    const page = pageRef.current
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (location.pathname === displayLocation.pathname) {
      if (location !== displayLocation) setDisplayLocation(location)
      return
    }
    if (!page?.animate || preference.matches) { setDisplayLocation(location); return }
    // Keep the previous route visible while it fades out, then mount the new route.
    const animation = page.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 200, easing: 'ease-in', fill: 'forwards',
    })
    animation.onfinish = () => setDisplayLocation(location)
    return () => { animation.onfinish = null; animation.cancel() }
  }, [location, displayLocation])
  useLayoutEffect(() => {
    const page = pageRef.current
    if (!page?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const animation = page.animate([
      { opacity: 0, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 450, easing: 'ease-out' })
    return () => animation.cancel()
  }, [displayLocation.pathname])
  const [searchOpen, setSearchOpen] = useState(false)
  useSearchHotkey(() => setSearchOpen(true))

  return (
    <>
      <ScrollToTop />
      <TopNav onOpenSearch={() => setSearchOpen(true)} />
      {BACKEND_ENABLED && cloudStatus && <div className="container small muted" role="status" style={{paddingTop:8,paddingBottom:8}}>{cloudStatus}{user && cloudStatus.startsWith('尚未保存') && <button className="btn btn-ghost btn-sm" onClick={()=>flushAccount()}>重试保存</button>}</div>}

      <main ref={pageRef}>
        <Routes location={displayLocation}>
          <Route path="/" element={<Home onOpenSearch={() => setSearchOpen(true)} />} />
          <Route path="/attractions" element={<Attractions />} />
          <Route path="/attraction/:id" element={<AttractionDetail />} />
          <Route path="/itinerary" element={<Itinerary />} />
          <Route path="/play/:tripId" element={<PlayTrip />} />
          <Route path="/community" element={<Community />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/publish" element={<PostEditor />} />
          <Route path="/publish/:draftId" element={<PostEditor />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/user/:id" element={<UserProfile />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/quests" element={<Navigate to="/tasks" replace />} />
          <Route path="/tasks" element={<TaskCenter />} />
          <Route path="/notebook" element={<Notebook />} />
          <Route path="/pets" element={<Pets />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      <AuthModal />
      {/* 任务卡：全站唯一一张，挂在最外层，任何页面都能收到 */}
      <TaskCard />
      <ToastHost />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <QuestProvider>
        <JourneyProvider>
          <HashRouter>
            <Shell />
          </HashRouter>
        </JourneyProvider>
      </QuestProvider>
    </AppProvider>
  )
}
