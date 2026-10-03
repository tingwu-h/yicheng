import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { attractions, regionName } from '../data/attractions'
import { posts as seedPosts, users, topicName } from '../data/community'
import { useApp } from '../store/AppContext'
import Avatar from './Avatar'

/* ==========================================================================
   搜索浮层
   覆盖景点、帖子和用户三类主要内容，支持分类切换与关键词高亮。
   无结果时给出改写建议（景点名称 / 区域 / 主题）。
   ========================================================================== */

/* 关键词高亮 */
export function Highlight({ text = '', q = '' }) {
  if (!q.trim()) return <>{text}</>
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'attraction', label: '景点' },
  { key: 'post', label: '帖子' },
  { key: 'user', label: '用户' },
]

export default function SearchOverlay({ onClose }) {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { allPosts } = useApp()

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const results = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (!kw) return { attraction: [], post: [], user: [] }

    const match = (s) => (s || '').toLowerCase().includes(kw)

    return {
      attraction: attractions.filter(
        (a) =>
          match(a.name) ||
          match(a.alias) ||
          match(a.summary) ||
          match(a.type) ||
          match(regionName(a.region)) ||
          a.seasons.some(match)
      ),
      post: allPosts.filter(
        (p) =>
          match(p.title) ||
          match(p.excerpt) ||
          match(topicName(p.topic)) ||
          match(attractions.find((a) => a.id === p.attraction)?.name)
      ),
      user: users.filter((u) => match(u.name) || match(u.bio)),
    }
  }, [q, allPosts])

  const total =
    results.attraction.length + results.post.length + results.user.length

  const go = (to) => {
    onClose()
    navigate(to)
  }

  const HOT = ['兵马俑', '城墙', '陕博', '曲江', '避坑', '临潼']

  return (
    <div className="overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: 90 }}>
      <div
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="搜索"
        style={{ maxHeight: '76vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="search-overlay-input">
          <span style={{ fontSize: 18, color: 'var(--ink-300)' }}>🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索景点、帖子或用户…"
            aria-label="搜索关键词"
          />
          <button className="icon-btn" onClick={onClose} aria-label="关闭搜索">
            ✕
          </button>
        </div>

        {q.trim() && (
          <div
            className="row row-2"
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`chip ${tab === t.key ? 'on' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                {q.trim() && t.key !== 'all' && (
                  <span style={{ marginLeft: 5, opacity: 0.75 }}>
                    {results[t.key].length}
                  </span>
                )}
              </button>
            ))}
            <span className="xs muted" style={{ marginLeft: 'auto' }}>
              共 {total} 条结果
            </span>
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* 默认状态：热搜词 */}
          {!q.trim() && (
            <div style={{ padding: '20px 24px 24px' }}>
              <p className="label" style={{ marginBottom: 12 }}>
                热门搜索
              </p>
              <div className="filter-chips">
                {HOT.map((h) => (
                  <button key={h} className="chip" onClick={() => setQ(h)}>
                    {h}
                  </button>
                ))}
              </div>
              <p className="label" style={{ margin: '24px 0 12px' }}>
                按主题找
              </p>
              <div className="filter-chips">
                {['博物馆', '历史遗迹', '自然风光', '夜景', '亲子', '人文'].map((h) => (
                  <button key={h} className="chip" onClick={() => setQ(h)}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 无结果 */}
          {q.trim() && total === 0 && (
            <div className="state" style={{ padding: '48px 24px' }}>
              <div className="state-icon">?</div>
              <h3 className="state-title">没有找到「{q}」相关的内容</h3>
              <p className="state-desc">
                可以试试改用景点名称、行政区域或主题词搜索。
                例如把「看俑的地方」换成「兵马俑」或「临潼」。
              </p>
              <div className="state-actions">
                {['兵马俑', '临潼', '博物馆', '城墙'].map((s) => (
                  <button key={s} className="chip" onClick={() => setQ(s)}>
                    试试「{s}」
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 结果 */}
          {(tab === 'all' || tab === 'attraction') && results.attraction.length > 0 && (
            <Section title="景点" count={results.attraction.length}>
              {results.attraction.slice(0, tab === 'all' ? 4 : 20).map((a) => (
                <button
                  key={a.id}
                  className="suggest-row"
                  onClick={() => go(`/attraction/${a.id}`)}
                >
                  <span
                    className="suggest-icon"
                    style={{
                      background: `linear-gradient(140deg, ${a.tone[0]}, ${a.tone[1]})`,
                      color: '#fff',
                    }}
                  >
                    景
                  </span>
                  <span className="grow">
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, display: 'block' }}>
                      <Highlight text={a.name} q={q} />
                    </span>
                    <span className="xs muted clamp-1">
                      <Highlight text={regionName(a.region)} q={q} /> ·{' '}
                      <Highlight text={a.type} q={q} /> · {a.summary}
                    </span>
                  </span>
                  <span className="tag tag-outline">{regionName(a.region)}</span>
                </button>
              ))}
            </Section>
          )}

          {(tab === 'all' || tab === 'post') && results.post.length > 0 && (
            <Section title="帖子" count={results.post.length}>
              {results.post.slice(0, tab === 'all' ? 3 : 20).map((p) => (
                <button key={p.id} className="suggest-row" onClick={() => go(`/post/${p.id}`)}>
                  <span className="suggest-icon">📄</span>
                  <span className="grow">
                    <span
                      className="clamp-1"
                      style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, display: 'block' }}
                    >
                      <Highlight text={p.title} q={q} />
                    </span>
                    <span className="xs muted">
                      {topicName(p.topic)} · {p.likes} 赞 · {p.comments} 评论
                    </span>
                  </span>
                </button>
              ))}
            </Section>
          )}

          {(tab === 'all' || tab === 'user') && results.user.length > 0 && (
            <Section title="用户" count={results.user.length}>
              {results.user.slice(0, tab === 'all' ? 3 : 20).map((u) => (
                <button key={u.id} className="suggest-row" onClick={() => go(`/user/${u.id}`)}>
                  <Avatar variant={u.avatar} size={36} />
                  <span className="grow">
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, display: 'block' }}>
                      <Highlight text={u.name} q={q} />
                    </span>
                    <span className="xs muted clamp-1">{u.bio}</span>
                  </span>
                </button>
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, count, children }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
      <p
        className="xs muted"
        style={{ padding: '14px 24px 6px', fontWeight: 700, letterSpacing: '0.06em' }}
      >
        {title} · {count}
      </p>
      <div className="search-suggest">{children}</div>
    </div>
  )
}
