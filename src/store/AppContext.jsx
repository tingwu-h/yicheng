import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import { attractions } from '../data/attractions'
import { BACKEND_ENABLED, apiRequest, accountEpoch, changeAccountEpoch } from '../services/backendClient'
import { posts as seedPosts, notifications as seedNotifs, getUser } from '../data/community'
import { addCalendarDays, appendTripDay, formatCalendarDate, localTodayISO, normalizeTripDates, removeTripDay } from '../lib/calendarDates'

/* ==========================================================================
   全局状态
   涵盖：登录态 / 收藏 / 点赞 / 行程 / 我的发布 / 浏览记录 / 消息 / 即时反馈
   ========================================================================== */

const AppContext = createContext(null)

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用')
  return ctx
}

/* 本地持久化：刷新后不丢数据 */
const LS_KEY = 'changan-banlv-state-v1'

function loadPersisted() {
  if (BACKEND_ENABLED) return null
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const todayISO = localTodayISO
const addDays = addCalendarDays

export const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function formatDate(iso) {
  return formatCalendarDate(iso)
}

/* ---------- 行程初始数据（未登录也可先体验规划） ---------- */
function initialItinerary() {
  const start = addDays(todayISO(), 7)
  return {
    id: 'trip-1',
    title: '我的西安行程',
    startDate: start,
    companions: 'family',
    days: [0, 1, 2].map((i) => ({
      date: addDays(start, i),
      items:
        i === 0
          ? [
              { id: 'it-1', attractionId: 'a1', time: '09:00', note: '' },
              { id: 'it-2', attractionId: 'a2', time: '14:30', note: '' },
            ]
          : i === 1
            ? [
                { id: 'it-3', attractionId: 'a4', time: '09:30', note: '' },
                { id: 'it-4', attractionId: 'a5', time: '15:00', note: '' },
                { id: 'it-5', attractionId: 'a6', time: '19:30', note: '' },
              ]
            : [],
    })),
  }
}

export function AppProvider({ children }) {
  const persisted = useRef(loadPersisted()).current

  /* ---------- 登录态 ---------- */
  const [user, setUser] = useState(persisted?.user ?? null)
  const [avatarId, setAvatarId] = useState(persisted?.avatarId ?? 'av-1')
  const [profile, setProfile] = useState(
    persisted?.profile ?? { name: '', bio: '', region: '西安' }
  )

  /* ---------- 收藏与互动 ---------- */
  const [savedAttractions, setSavedAttractions] = useState(
    persisted?.savedAttractions ?? ['a3', 'a4', 'a6']
  )
  const [likedPosts, setLikedPosts] = useState(persisted?.likedPosts ?? [])
  const [savedPosts, setSavedPosts] = useState(persisted?.savedPosts ?? ['p2'])
  const [history, setHistory] = useState(persisted?.history ?? [])
  const [myPosts, setMyPosts] = useState([])
  const [drafts, setDrafts] = useState(persisted?.drafts ?? [])

  /* ---------- 行程 ---------- */
  const [itinerary, setItinerary] = useState(() => {
    const trip = normalizeTripDates(persisted?.itinerary ?? initialItinerary())
    return trip.title === '我的西安三日行' && trip.days.length !== 3
      ? { ...trip, title: '我的西安行程' }
      : trip
  })
  const [savedTrips, setSavedTrips] = useState(persisted?.savedTrips ?? [])
  const [activeDay, setActiveDay] = useState(0)

  /* ---------- 消息 ---------- */
  /* 任务提醒也会写入这里（kind: 'task'），所以纳入持久化 */
  const [notifs, setNotifs] = useState(persisted?.notifs ?? seedNotifs)

  /* ---------- 模态与提示 ---------- */
  const [authModal, setAuthModal] = useState(null) // 'login' | 'register' | null
  const [authIntent, setAuthIntent] = useState(null) // 登录后可获得的功能说明
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)
  const [cloudStatus, setCloudStatus] = useState(BACKEND_ENABLED ? '正在连接服务…' : '')
  const [accountReady, setAccountReady] = useState(!BACKEND_ENABLED)
  const cloud = useRef({uid:null,revision:0,saved:'',queue:Promise.resolve()})
  const accountSnapshot = useMemo(()=>({profile,avatarId,savedAttractions,likedPosts,savedPosts,itinerary,savedTrips}),[profile,avatarId,savedAttractions,likedPosts,savedPosts,itinerary,savedTrips])
  const snapshotRef = useRef(accountSnapshot)
  snapshotRef.current = accountSnapshot

  /* ---------- 持久化 ---------- */
  useEffect(() => {
    if(BACKEND_ENABLED) return
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          user,
          avatarId,
          profile,
          savedAttractions,
          likedPosts,
          savedPosts,
          history,
          drafts,
          itinerary,
          savedTrips,
          notifs,
        })
      )
    } catch {
      /* 忽略隐私模式下的写入失败 */
    }
  }, [
    user,
    avatarId,
    profile,
    savedAttractions,
    likedPosts,
    savedPosts,
    history,
    drafts,
    itinerary,
    savedTrips,
    notifs,
  ])

  /* ======================================================================
     Toast 即时反馈
     ====================================================================== */

  const toast = useCallback((message, type = 'success', action = null) => {
    const id = ++toastId.current
    setToasts((list) => [...list, { id, message, type, action }])
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id))
    }, action ? 5200 : 2600)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const hydrateAccount = useCallback((who, document) => {
    changeAccountEpoch()
    const data=document?.data??{}
    cloud.current={uid:who?.id??null,revision:document?.revision??0,saved:'',queue:Promise.resolve()}
    setProfile(data.profile??{name:who?.name??'',bio:'',region:'西安'})
    setAvatarId(data.avatarId??'av-1')
    setSavedAttractions(data.savedAttractions??[]);setLikedPosts(data.likedPosts??[]);setSavedPosts(data.savedPosts??[])
    setItinerary(normalizeTripDates(data.itinerary??initialItinerary()));setSavedTrips(data.savedTrips??[])
    let local={}
    try { if(who?.id) local=JSON.parse(localStorage.getItem('yicheng-local-extras:'+who.id)||'{}') } catch {}
    setActiveDay(0);setHistory(local.history??[]);setMyPosts(local.myPosts??[]);setDrafts(local.drafts??[]);setNotifs(local.notifs??[])
    setUser(who);setAccountReady(true);setCloudStatus(who?'已连接服务器':'')
  },[])

  // Community publishing is still a local preview. Keep those drafts account-isolated
  // without uploading them or allowing them to alter server rewards.
  useEffect(()=>{
    if(!BACKEND_ENABLED||!accountReady||!user?.id||cloud.current.uid!==user.id)return
    try {localStorage.setItem('yicheng-local-extras:'+user.id,JSON.stringify({history,myPosts,drafts,notifs}))}
    catch {toast('本机草稿空间不足，请先保留好未发布的文字','warning')}
  },[accountReady,user?.id,history,myPosts,drafts,notifs,toast])

  const flushAccount = useCallback(async(override) => {
    if(!BACKEND_ENABLED) return true
    const owner=cloud.current, epoch=accountEpoch(), snapshot=override??snapshotRef.current
    if(!owner.uid) return false
    const serialized=JSON.stringify(snapshot)
    const execute=async()=>{
      if(epoch!==accountEpoch()) return false
      if(owner.saved===serialized) return true
      setCloudStatus('正在保存到服务器…')
      try {
        const result=await apiRequest('/api/me/app',{method:'PUT',body:{revision:owner.revision,data:snapshot}})
        if(epoch!==accountEpoch()) return false
        owner.revision=result.revision;owner.saved=serialized;setCloudStatus('已保存到服务器');return true
      } catch(e){if(epoch===accountEpoch())setCloudStatus('尚未保存：'+e.message);return false}
    }
    const pending=owner.queue.then(execute,execute);owner.queue=pending.catch(()=>{});return pending
  },[])

  useEffect(()=>{
    if(!BACKEND_ENABLED) return
    let cancelled=false
    apiRequest('/api/auth/me').then(async({user:who})=>{
      const doc=who?await apiRequest('/api/me/app'):null
      if(!cancelled) hydrateAccount(who,doc)
    }).catch(e=>{if(!cancelled){setCloudStatus(e.message);setAccountReady(true)}})
    const expire=()=>{hydrateAccount(null,null);toast('登录已过期，请重新登录','info')}
    window.addEventListener('yicheng:session-expired',expire)
    return()=>{cancelled=true;window.removeEventListener('yicheng:session-expired',expire)}
  },[hydrateAccount,toast])

  useEffect(()=>{
    if(!BACKEND_ENABLED||!accountReady||!user?.id) return
    const timer=setTimeout(()=>flushAccount(),500)
    return()=>clearTimeout(timer)
  },[accountSnapshot,accountReady,user?.id,flushAccount])

  useEffect(()=>{
    if(!BACKEND_ENABLED) return
    const warn=event=>{if(cloud.current.uid&&cloud.current.saved!==JSON.stringify(snapshotRef.current)){event.preventDefault();event.returnValue=''}}
    window.addEventListener('beforeunload',warn)
    return()=>window.removeEventListener('beforeunload',warn)
  },[])

  /* ======================================================================
     登录 / 注册 / 退出
     ====================================================================== */

  const requireLogin = useCallback(
    (reason) => {
      if (user) return true
      setAuthIntent(reason)
      setAuthModal('login')
      return false
    },
    [user]
  )

  const login = useCallback(
    async (name, opts = {}) => {
      if(BACKEND_ENABLED) {
        const result=await apiRequest(opts.register?'/api/auth/register':'/api/auth/login',{method:'POST',body:{account:name,password:opts.password,name:opts.name,avatarId:opts.avatarId,agree:opts.agree,remember:opts.remember}})
        const doc=await apiRequest('/api/me/app')
        hydrateAccount(result.user,doc);setAuthModal(null);return true
      }
      const nm = (name || '').trim() || '长安游客'
      const isInternalTest = !!opts.internalTest
      setUser({
        id: isInternalTest ? 'internal-test-vh03' : 'me',
        name: nm,
        email: opts.email || '',
        isNew: !!opts.isNew,
        isInternalTest,
      })
      setProfile((p) => ({ ...p, name: nm }))
      setAuthModal(null)
      return true
    },
    [hydrateAccount]
  )

  const logout = useCallback(async () => {
    if(BACKEND_ENABLED) {
      try {
        if(!(await flushAccount())) {toast('还有改动未保存，请先重试保存再退出','warning');return false}
        await apiRequest('/api/auth/logout',{method:'POST',body:{}});hydrateAccount(null,null)
      } catch(e){toast(e.message,'warning');return false}
    }
    setUser(null)
    toast('已退出登录，浏览内容不受影响', 'info')
    return true
  }, [toast,flushAccount,hydrateAccount])

  const updateProfile = useCallback((patch) => {
    setProfile((p) => ({ ...p, ...patch }))
    if (patch.name) {
      setUser((u) => (u ? { ...u, name: patch.name } : u))
    }
  }, [])

  /* ======================================================================
     收藏 / 点赞
     ====================================================================== */

  const isAttractionSaved = useCallback(
    (id) => savedAttractions.includes(id),
    [savedAttractions]
  )

  const toggleSaveAttraction = useCallback(
    (id, name) => {
      if (!requireLogin('登录后可收藏景点、跨设备同步你的行程')) return
      setSavedAttractions((list) => {
        const on = list.includes(id)
        if (on) {
          toast(`已取消收藏${name ? `「${name}」` : ''}`, 'info')
          return list.filter((x) => x !== id)
        }
        toast(`已收藏${name ? `「${name}」` : ''}，可在个人中心查看`, 'success', {
          label: '去行程',
          to: '/itinerary',
        })
        return [...list, id]
      })
    },
    [requireLogin, toast]
  )

  const isPostLiked = useCallback((id) => likedPosts.includes(id), [likedPosts])

  const toggleLike = useCallback(
    (id, title) => {
      if (!requireLogin('登录后可点赞、评论与发布内容')) return
      setLikedPosts((list) => {
        const on = list.includes(id)
        toast(on ? '已取消点赞' : '已点赞', on ? 'info' : 'success')
        return on ? list.filter((x) => x !== id) : [...list, id]
      })
    },
    [requireLogin, toast]
  )

  const isPostSaved = useCallback((id) => savedPosts.includes(id), [savedPosts])

  const toggleSavePost = useCallback(
    (id, title) => {
      if (!requireLogin('登录后可收藏帖子，稍后在个人中心回看')) return
      setSavedPosts((list) => {
        const on = list.includes(id)
        if (on) {
          toast('已取消收藏', 'info')
          return list.filter((x) => x !== id)
        }
        toast('已收藏，可在个人中心「互动记录」查看', 'success', {
          label: '查看',
          to: '/profile?tab=interactions',
        })
        return [...list, id]
      })
    },
    [requireLogin, toast]
  )

  const pushHistory = useCallback((item) => {
    setHistory((list) => {
      const rest = list.filter((x) => !(x.type === item.type && x.id === item.id))
      return [{ ...item, at: new Date().toISOString() }, ...rest].slice(0, 40)
    })
  }, [])

  /* ======================================================================
     行程
     ====================================================================== */

  const addToItinerary = useCallback(
    (attractionId, dayIndex = null) => {
      if (!requireLogin('登录后可保存行程，并在不同设备继续编辑')) return
      const name = attractions.find((a) => a.id === attractionId)?.name
      const di = dayIndex ?? activeDay
      setItinerary((t) => {
        const day = t.days[di]
        if (!day) return t
        if (day.items.some((i) => i.attractionId === attractionId)) {
          toast(`「${name}」已在第 ${di + 1} 天的安排中`, 'warning')
          return t
        }
        const items = [
          ...day.items,
          {
            id: `it-${Date.now()}`,
            attractionId,
            time: '',
            note: '',
          },
        ]
        const days = t.days.map((d, i) => (i === di ? { ...d, items } : d))
        toast(`已加入第 ${di + 1} 天`, 'success', { label: '查看行程', to: '/itinerary' })
        return { ...t, days }
      })
    },
    [requireLogin, toast, activeDay]
  )

  const removeFromItinerary = useCallback(
    (dayIndex, itemId) => {
      setItinerary((t) => {
        const days = t.days.map((d, i) =>
          i === dayIndex ? { ...d, items: d.items.filter((x) => x.id !== itemId) } : d
        )
        return { ...t, days }
      })
      toast('已从行程中移除', 'info')
    },
    [toast]
  )

  const moveItem = useCallback((dayIndex, itemId, dir) => {
    setItinerary((t) => {
      const days = t.days.map((d, i) => {
        if (i !== dayIndex) return d
        const items = [...d.items]
        const idx = items.findIndex((x) => x.id === itemId)
        const next = idx + dir
        if (idx < 0 || next < 0 || next >= items.length) return d
        ;[items[idx], items[next]] = [items[next], items[idx]]
        return { ...d, items }
      })
      return { ...t, days }
    })
  }, [])

  const setItemNote = useCallback((dayIndex, itemId, note) => {
    setItinerary((t) => {
      const days = t.days.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              items: d.items.map((x) => (x.id === itemId ? { ...x, note } : x)),
            }
          : d
      )
      return { ...t, days }
    })
  }, [])

  const setItemTime = useCallback((dayIndex, itemId, time) => {
    setItinerary((t) => {
      const days = t.days.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              items: d.items.map((x) => (x.id === itemId ? { ...x, time } : x)),
            }
          : d
      )
      return { ...t, days }
    })
  }, [])

  const updateTrip = useCallback((patch) => {
    setItinerary((t) => normalizeTripDates({ ...t, ...patch }))
  }, [])

  const saveItinerary = useCallback(async () => {
    const now = new Date().toISOString()
    if (!requireLogin('登录后保存你的行程')) return null
    if (!itinerary.days.some(d => d.items.length)) { toast('先添加一个景点再保存', 'warning'); return null }
    const previous = savedTrips.find(t => t.id === itinerary.id)
    const id = previous?.id ?? `trip-${Date.now()}`
    const saved = structuredClone({ ...normalizeTripDates(itinerary), id, updatedAt: now, createdAt: previous?.createdAt ?? now })
    if(BACKEND_ENABLED) {
      const nextTrips=previous?savedTrips.map(t=>t.id===id?saved:t):[saved,...savedTrips]
      if(!(await flushAccount({...snapshotRef.current,itinerary:saved,savedTrips:nextTrips}))) {toast('行程尚未保存成功，请检查连接后重试','warning');return null}
    }
    setItinerary(saved)
    setSavedTrips((list) => {
      const exists = list.some((trip) => trip.id === id)
      return exists ? list.map((trip) => (trip.id === id ? saved : trip)) : [saved, ...list]
    })
    toast('行程已保存', 'success')
    return saved
  }, [itinerary, savedTrips, toast, requireLogin, flushAccount])

  const loadSavedTrip = useCallback((trip) => {
    if (!trip) return
    setItinerary(normalizeTripDates(trip))
    setActiveDay(0)
    toast('已载入行程，可继续修改', 'success')
  }, [toast])

  const deleteSavedTrip = useCallback((tripId) => {
    setSavedTrips((list) => list.filter((trip) => trip.id !== tripId))
    toast('已删除保存的行程', 'info')
  }, [toast])

  const addDay = useCallback(() => {
    setItinerary((trip) => {
      const next = appendTripDay(trip)
      return next.title === '我的西安三日行'
        ? { ...next, title: '我的西安行程' }
        : next
    })
    setActiveDay(itinerary.days.length)
    toast('已添加一天', 'success')
  }, [itinerary.days.length, toast])

  const removeDay = useCallback(
    (dayIndex) => {
      setItinerary((t) => {
        return removeTripDay(t, dayIndex)
      })
      setActiveDay((d) => Math.max(0, Math.min(d > dayIndex ? d - 1 : d, itinerary.days.length - 2)))
      toast('已删除该天', 'info')
    },
    [itinerary.days.length, toast]
  )

  const clearDay = useCallback(
    (dayIndex) => {
      setItinerary((t) => ({
        ...t,
        days: t.days.map((d, i) => (i === dayIndex ? { ...d, items: [] } : d)),
      }))
      toast('已清空当天安排', 'info')
    },
    [toast]
  )

  /* ======================================================================
     发布
     ====================================================================== */

  const publishPost = useCallback(
    (draft) => {
      const post = {
        id: `mp-${Date.now()}`,
        title: draft.title,
        topic: draft.topic,
        author: 'me',
        attraction: draft.attraction,
        excerpt: draft.body.slice(0, 62),
        cover: draft.cover ?? ['#8C2A22', '#5C1A15'],
        images: draft.images?.length ?? 0,
        imageList: draft.images ?? [],
        likes: 0,
        comments: 0,
        favorites: 0,
        views: 0,
        createdAt: todayISO(),
        featured: false,
        body: draft.body.split('\n').filter(Boolean),
        commentList: [],
        isMine: true,
      }
      setMyPosts((list) => [post, ...list])
      setDrafts((list) => list.filter((d) => d.id !== draft.id))
      return post
    },
    []
  )

  const saveDraft = useCallback(
    (draft) => {
      setDrafts((list) => {
        const exists = list.some((d) => d.id === draft.id)
        return exists
          ? list.map((d) => (d.id === draft.id ? draft : d))
          : [draft, ...list]
      })
      toast('草稿已保存', 'success')
    },
    [toast]
  )

  const deleteDraft = useCallback((id) => {
    setDrafts((list) => list.filter((d) => d.id !== id))
  }, [])

  const addComment = useCallback(
    (postId, content) => {
      if (!requireLogin('登录后可参与评论互动')) return
      const c = {
        id: `mc-${Date.now()}`,
        author: 'me',
        content,
        createdAt: todayISO(),
        likes: 0,
        reply: null,
      }
      setMyPosts((list) =>
        list.map((p) =>
          p.id === postId ? { ...p, commentList: [...p.commentList, c] } : p
        )
      )
      toast('评论已发布', 'success')
      return c
    },
    [requireLogin, toast]
  )

  /* ======================================================================
     消息通知
     ====================================================================== */

  const unreadCount = notifs.filter((n) => n.unread).length

  /* 供任务提醒等模块推送站内消息；id 由调用方给或自动生成 */
  const pushNotif = useCallback((notif) => {
    const entry = {
      id: notif.id ?? `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      unread: true,
      createdAt: notif.createdAt ?? new Date().toISOString().slice(0, 16).replace('T', ' '),
      ...notif,
    }
    setNotifs((list) => [entry, ...list])
    return entry
  }, [])

  const markRead = useCallback((id) => {
    setNotifs((list) => list.map((n) => (n.id === id ? { ...n, unread: false } : n)))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifs((list) => list.map((n) => ({ ...n, unread: false })))
    toast('已将全部通知标记为已读', 'success')
  }, [toast])

  const clearRead = useCallback(() => {
    setNotifs((list) => list.filter((n) => n.unread))
    toast('已清空已读通知', 'info')
  }, [toast])

  /* ======================================================================
     汇总
     ====================================================================== */

  const allPosts = useMemo(() => [...myPosts, ...seedPosts], [myPosts])

  const value = useMemo(
    () => ({
      /* 登录 */
      user,
      isLoggedIn: !!user,
      accountReady,
      cloudStatus,
      flushAccount,
      profile,
      avatarId,
      setAvatarId,
      login,
      logout,
      updateProfile,
      requireLogin,
      authModal,
      setAuthModal,
      authIntent,
      setAuthIntent,

      /* 收藏互动 */
      savedAttractions,
      isAttractionSaved,
      toggleSaveAttraction,
      likedPosts,
      isPostLiked,
      toggleLike,
      savedPosts,
      isPostSaved,
      toggleSavePost,
      history,
      pushHistory,

      /* 行程 */
      itinerary,
      activeDay,
      setActiveDay,
      addToItinerary,
      removeFromItinerary,
      moveItem,
      setItemNote,
      setItemTime,
      updateTrip,
      savedTrips,
      saveItinerary,
      loadSavedTrip,
      deleteSavedTrip,
      addDay,
      removeDay,
      clearDay,

      /* 发布 */
      allPosts,
      myPosts,
      publishPost,
      drafts,
      saveDraft,
      deleteDraft,
      addComment,

      /* 消息 */
      notifs,
      unreadCount,
      markRead,
      markAllRead,
      clearRead,
      pushNotif,

      /* 提示 */
      toasts,
      toast,
      dismissToast,
    }),
    [
      user,
      accountReady,
      cloudStatus,
      flushAccount,
      profile,
      avatarId,
      login,
      logout,
      updateProfile,
      requireLogin,
      authModal,
      authIntent,
      savedAttractions,
      isAttractionSaved,
      toggleSaveAttraction,
      likedPosts,
      isPostLiked,
      toggleLike,
      savedPosts,
      isPostSaved,
      toggleSavePost,
      history,
      pushHistory,
      itinerary,
      activeDay,
      addToItinerary,
      removeFromItinerary,
      moveItem,
      setItemNote,
      setItemTime,
      updateTrip,
      savedTrips,
      saveItinerary,
      loadSavedTrip,
      deleteSavedTrip,
      addDay,
      removeDay,
      clearDay,
      allPosts,
      myPosts,
      publishPost,
      drafts,
      saveDraft,
      deleteDraft,
      addComment,
      notifs,
      unreadCount,
      markRead,
      markAllRead,
      clearRead,
      pushNotif,
      toasts,
      toast,
      dismissToast,
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

/* ---------- 通用工具：按 ID 取作者（含当前用户） ---------- */
export function useAuthor() {
  const { user, profile, avatarId } = useApp()
  return useCallback(
    (uid) => {
      if (uid === 'me') {
        return {
          id: 'me',
          name: profile.name || user?.name || '我',
          avatar: avatarId,
          bio: profile.bio || '还没有填写简介',
          region: profile.region,
          isMe: true,
        }
      }
      return getUser(uid)
    },
    [user, profile, avatarId]
  )
}
