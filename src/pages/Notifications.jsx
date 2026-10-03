import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp, useAuthor } from '../store/AppContext'
import Avatar from '../components/Avatar'
import { Breadcrumb, EmptyState, Notice } from '../components/ui'

/* ==========================================================================
   消息通知
   汇总评论回复、点赞、收藏与系统通知，提供未读状态、时间与跳转目标。
   支持标记已读、清空已读提醒；未登录时保留登录引导。
   ========================================================================== */

const KINDS = [
  { key: 'all', label: '全部' },
  { key: 'comment', label: '评论与回复' },
  { key: 'like', label: '点赞' },
  { key: 'favorite', label: '收藏' },
  { key: 'task', label: '任务提醒' },
  { key: 'system', label: '系统' },
]

const KIND_META = {
  comment: { icon: '💬', tone: 'var(--daiqing-700)' },
  reply: { icon: '↩', tone: 'var(--daiqing-700)' },
  like: { icon: '♥', tone: 'var(--cinnabar-600)' },
  favorite: { icon: '★', tone: 'var(--gold-700)' },
  task: { icon: '🐾', tone: 'var(--gold-700)' },
  system: { icon: 'ⓘ', tone: 'var(--ink-500)' },
}

export default function Notifications() {
  const navigate = useNavigate()
  const {
    isLoggedIn,
    setAuthModal,
    notifs,
    unreadCount,
    markRead,
    markAllRead,
    clearRead,
  } = useApp()
  const author = useAuthor()
  const [kind, setKind] = useState('all')

  /* ---------------- 未登录 ---------------- */
  if (!isLoggedIn) {
    return (
      <div className="container page">
        <Breadcrumb items={[{ label: '消息通知' }]} />
        <EmptyState
          icon="🔔"
          title="登录后查看消息通知"
          desc="评论回复、点赞与收藏提醒需要登录后才能查看和管理。不登录仍可自由浏览景点与社区内容。"
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

  const filtered =
    kind === 'all'
      ? notifs
      : notifs.filter((n) =>
          kind === 'comment' ? n.kind === 'comment' || n.kind === 'reply' : n.kind === kind
        )

  const readCount = notifs.length - unreadCount

  return (
    <div className="page">
      <div className="container-narrow">
        <Breadcrumb items={[{ label: '消息通知' }]} />

        <div className="row-between wrap row-4" style={{ marginTop: 'var(--sp-6)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--fs-h1)' }}>消息通知</h1>
            <p className="muted small" style={{ marginTop: 8 }}>
              共 {notifs.length} 条 · {unreadCount} 条未读
            </p>
          </div>

          <div className="row row-2">
            <button className="btn btn-secondary btn-sm" onClick={markAllRead} disabled={!unreadCount}>
              全部标记已读
            </button>
            <button className="btn btn-ghost btn-sm" onClick={clearRead} disabled={!readCount}>
              清空已读
            </button>
          </div>
        </div>

        {/* 分类 */}
        <div className="filter-group wrap" style={{ marginTop: 'var(--sp-5)' }}>
          <div className="filter-chips">
            {KINDS.map((k) => {
              const n =
                k.key === 'all'
                  ? notifs.length
                  : notifs.filter((x) =>
                      k.key === 'comment' ? x.kind === 'comment' || x.kind === 'reply' : x.kind === k.key
                    ).length
              return (
                <button
                  key={k.key}
                  className={`chip ${kind === k.key ? 'on' : ''}`}
                  onClick={() => setKind(k.key)}
                  aria-pressed={kind === k.key}
                >
                  {k.label}
                  {n > 0 && <span style={{ marginLeft: 5, opacity: 0.75 }}>{n}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* 列表 */}
        <section style={{ marginTop: 'var(--sp-5)' }}>
          {filtered.length === 0 ? (
            <EmptyState
              icon="🔔"
              title={kind === 'all' ? '还没有通知' : '这个分类下没有通知'}
              desc="当有人评论、点赞或收藏你的内容时，会出现在这里。"
              actions={
                <Link className="btn btn-primary" to="/community">
                  去社区看看
                </Link>
              }
            />
          ) : (
            <div className="stack stack-3">
              {filtered.map((n) => {
                const meta = KIND_META[n.kind] ?? KIND_META.system
                const actor = n.actor ? author(n.actor) : null

                return (
                  <div
                    key={n.id}
                    className={`notif-item ${n.unread ? 'unread' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      markRead(n.id)
                      /* 任务提醒直接跳行前清单；其余通知跳对应的帖子 */
                      if (n.to) navigate(n.to)
                      else if (n.target) navigate(`/post/${n.target}`)
                    }}
                    onKeyDown={(e) =>
                      (e.key === 'Enter' || e.key === ' ') && markRead(n.id)
                    }
                  >
                    {n.unread ? (
                      <span className="unread-dot" aria-label="未读" />
                    ) : (
                      <span style={{ width: 7, flexShrink: 0 }} />
                    )}

                    {actor ? (
                      <Avatar variant={actor.avatar} size={40} />
                    ) : (
                      <span
                        className="suggest-icon"
                        style={{ width: 40, height: 40, background: 'var(--paper-200)' }}
                      >
                        {meta.icon}
                      </span>
                    )}

                    <div className="grow" style={{ minWidth: 0 }}>
                      <p className="small">
                        <strong>{actor ? actor.name : '系统'}</strong>{' '}
                        <span className="muted">{n.text}</span>
                      </p>

                      <p
                        className="small clamp-2"
                        style={{ marginTop: 6, fontWeight: 600, color: 'var(--ink-800)' }}
                      >
                        {n.targetTitle}
                      </p>

                      {n.preview && (
                        <p className="xs muted clamp-2" style={{ marginTop: 6 }}>
                          「{n.preview}」
                        </p>
                      )}

                      <p className="xs muted" style={{ marginTop: 8 }}>
                        {n.createdAt}
                      </p>
                    </div>

                    <span
                      style={{
                        fontSize: 15,
                        color: meta.tone,
                        flexShrink: 0,
                        alignSelf: 'flex-start',
                      }}
                      aria-hidden="true"
                    >
                      {meta.icon}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <Notice kind="quiet" className="mt-8">
          通知按时间倒序排列。点击任意一条会标记为已读，并跳转到对应内容。
          已读通知可以通过上方按钮一次性清空。
        </Notice>
      </div>
    </div>
  )
}
