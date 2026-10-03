import { useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { attractions, regionName, REGIONS, TYPES } from '../data/attractions'
import { users, topicName, topicColor, TOPICS } from '../data/community'
import { useApp, useAuthor } from '../store/AppContext'
import { AttractionGrid, PostGrid } from '../components/cards'
import { Breadcrumb, EmptyState, Notice, Thumb } from '../components/ui'
import Avatar from '../components/Avatar'
import { Highlight } from '../components/SearchOverlay'

/* ==========================================================================
   搜索结果页
   覆盖景点、帖子和用户三类内容，提供分类切换、关键词高亮与筛选条件。
   无结果时给出改写建议。
   ========================================================================== */

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'attraction', label: '景点' },
  { key: 'post', label: '帖子' },
  { key: 'user', label: '用户' },
]

export default function SearchResults() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const [tab, setTab] = useState(params.get('tab') || 'all')
  const [region, setRegion] = useState('')
  const [type, setType] = useState('')
  const { allPosts } = useApp()
  const author = useAuthor()

  const results = useMemo(() => {
    const kw = q.trim().toLowerCase()
    const match = (s) => (s || '').toLowerCase().includes(kw)

    const at = attractions.filter((a) => {
      if (region && a.region !== region) return false
      if (type && a.type !== type) return false
      if (!kw) return true
      return (
        match(a.name) ||
        match(a.alias) ||
        match(a.summary) ||
        match(a.type) ||
        match(regionName(a.region)) ||
        a.seasons.some(match)
      )
    })

    const po = allPosts.filter((p) => {
      if (!kw) return true
      return (
        match(p.title) ||
        match(p.excerpt) ||
        match(topicName(p.topic)) ||
        match(attractions.find((a) => a.id === p.attraction)?.name)
      )
    })

    const us = users.filter((u) => {
      if (!kw) return true
      return match(u.name) || match(u.bio)
    })

    return { attraction: at, post: po, user: us }
  }, [q, allPosts, region, type])

  const total = results.attraction.length + results.post.length + results.user.length
  const counts = {
    all: total,
    attraction: results.attraction.length,
    post: results.post.length,
    user: results.user.length,
  }

  const setTabAndUrl = (k) => {
    setTab(k)
    setParams({ q, tab: k }, { replace: true })
  }

  const hasFilter = region || type

  return (
    <div className="page">
      <div className="container">
        <Breadcrumb items={[{ label: '搜索结果' }]} />

        <div style={{ marginTop: 'var(--sp-6)' }}>
          <h1 style={{ fontSize: 'var(--fs-h1)' }}>
            {q ? (
              <>
                「<Highlight text={q} q={q} />」的搜索结果
              </>
            ) : (
              '全部内容'
            )}
          </h1>
          <p className="muted small" style={{ marginTop: 8 }}>
            覆盖景点、帖子与用户 · 共 {total} 条结果
          </p>
        </div>

        {/* 分类切换 */}
        <div className="tabs" style={{ marginTop: 'var(--sp-6)' }} role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? 'on' : ''}`}
              onClick={() => setTabAndUrl(t.key)}
              role="tab"
              aria-selected={tab === t.key}
            >
              {t.label}
              <span className="tag tag-outline" style={{ marginLeft: 6 }}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>

        {/* 景点筛选条件 */}
        {(tab === 'all' || tab === 'attraction') && counts.attraction > 0 && (
          <div className="filter-bar" style={{ marginBottom: 'var(--sp-5)' }}>
            <div className="filter-group wrap">
              <span className="filter-label">区域</span>
              <div className="filter-chips">
                <button className={`chip ${!region ? 'on' : ''}`} onClick={() => setRegion('')}>
                  全部
                </button>
                {REGIONS.map((r) => (
                  <button
                    key={r.key}
                    className={`chip ${region === r.key ? 'on' : ''}`}
                    onClick={() => setRegion(r.key === region ? '' : r.key)}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group wrap">
              <span className="filter-label">类型</span>
              <div className="filter-chips">
                <button className={`chip ${!type ? 'on' : ''}`} onClick={() => setType('')}>
                  全部
                </button>
                {TYPES.map((t) => (
                  <button
                    key={t}
                    className={`chip ${type === t ? 'on' : ''}`}
                    onClick={() => setType(t === type ? '' : t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {hasFilter && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setRegion('')
                  setType('')
                }}
              >
                清除筛选
              </button>
            )}
          </div>
        )}

        {/* 无结果 */}
        {total === 0 && (
          <EmptyState
            icon="?"
            title={`没有找到「${q}」相关的内容`}
            desc="可以试试改用景点名称、行政区域或主题词搜索。例如把「看俑的地方」换成「兵马俑」或「临潼」。"
            actions={
              <>
                {['兵马俑', '城墙', '博物馆', '临潼', '夜景'].map((s) => (
                  <Link key={s} className="chip" to={`/search?q=${encodeURIComponent(s)}`}>
                    试试「{s}」
                  </Link>
                ))}
              </>
            }
          />
        )}

        {/* 结果 */}
        {(tab === 'all' || tab === 'attraction') && results.attraction.length > 0 && (
          <section className="section" style={{ marginTop: tab === 'all' ? 0 : 'var(--sp-6)' }}>
            <div className="section-head">
              <h2 className="section-title" style={{ fontSize: 'var(--fs-h2)' }}>
                景点 · {results.attraction.length}
              </h2>
              {tab === 'all' && counts.attraction > 8 && (
                <button className="section-link" onClick={() => setTabAndUrl('attraction')}>
                  查看全部 →
                </button>
              )}
            </div>
            <AttractionGrid
              items={tab === 'all' ? results.attraction.slice(0, 8) : results.attraction}
            />
          </section>
        )}

        {(tab === 'all' || tab === 'post') && results.post.length > 0 && (
          <section className="section">
            <div className="section-head">
              <h2 className="section-title" style={{ fontSize: 'var(--fs-h2)' }}>
                帖子 · {results.post.length}
              </h2>
              {tab === 'all' && counts.post > 6 && (
                <button className="section-link" onClick={() => setTabAndUrl('post')}>
                  查看全部 →
                </button>
              )}
            </div>
            <PostGrid items={tab === 'all' ? results.post.slice(0, 6) : results.post} />
          </section>
        )}

        {(tab === 'all' || tab === 'user') && results.user.length > 0 && (
          <section className="section">
            <div className="section-head">
              <h2 className="section-title" style={{ fontSize: 'var(--fs-h2)' }}>
                用户 · {results.user.length}
              </h2>
            </div>
            <div className="grid-posts">
              {results.user.map((u) => {
                const au = author(u.id)
                const count = allPosts.filter((p) => p.author === u.id).length
                return (
                  <Link key={u.id} to={`/user/${u.id}`} className="card card-pad card-hover">
                    <div className="row row-4">
                      <Avatar variant={au.avatar} size={56} ring />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: 'var(--fs-body-lg)' }}>
                          <Highlight text={u.name} q={q} />
                        </h3>
                        <p className="xs muted" style={{ marginTop: 4 }}>
                          {u.region} · {count} 篇内容 · {u.likes} 获赞
                        </p>
                      </div>
                    </div>
                    <p className="small muted clamp-2" style={{ marginTop: 'var(--sp-4)' }}>
                      <Highlight text={u.bio} q={q} />
                    </p>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {total > 0 && (
          <Notice kind="quiet" className="mt-8">
            搜索结果按相关度与热度综合排序。景点信息由平台整理，
            帖子与用户内容为用户发布，出行前请以官方渠道为准。
          </Notice>
        )}
      </div>
    </div>
  )
}
