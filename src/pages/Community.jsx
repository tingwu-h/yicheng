import { useState, useMemo, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp, useAuthor } from '../store/AppContext'
import { TOPICS, topicName, topicColor, COMPOSER_TOPIC_HINT, postCoverImage } from '../data/community'
import {
  Breadcrumb,
  LoadingState,
  EmptyState,
  ErrorState,
  Pager,
  Notice,
  Modal,
  Thumb,
} from '../components/ui'
import Avatar from '../components/Avatar'
import { BACKEND_ENABLED } from '../services/backendClient'
import { attractions, regionName } from '../data/attractions'

/* ==========================================================================
   社区广场
   游客交流和经验发现的主要页面。
   内容主题：旅行游记 / 路线攻略 / 避坑经验 / 拍照打卡 / 即时感受
   支持按最新、热门或主题筛选，并可按景点搜索相关帖子。
   社区定位为内容型：作者主页只展示其发布内容，不做关注关系链。
   ========================================================================== */

const SORTS = [
  { key: 'latest', label: '最新' },
  { key: 'hot', label: '热门' },
]

const PAGE_SIZE = 6

export default function Community() {
  const [params, setParams] = useSearchParams()
  const { allPosts, isLoggedIn, setAuthModal, isPostLiked, toggleLike, isPostSaved, toggleSavePost, toast } =
    useApp()
  const author = useAuthor()

  const [sort, setSort] = useState(params.get('sort') || 'latest')
  const [topic, setTopic] = useState(params.get('topic') || '')
  const [attractionFilter, setAttractionFilter] = useState(params.get('attraction') || '')
  const [kw, setKw] = useState(params.get('kw') || '')
  const [page, setPage] = useState(1)
  const [reportPost, setReportPost] = useState(null)
  const [rulesOpen, setRulesOpen] = useState(params.get('rules') === '1')
  useEffect(() => {
    if (params.get('rules') === '1') {
      setRulesOpen(true)
      const next = new URLSearchParams(params)
      next.delete('rules')
      setParams(next, { replace: true })
    }
  }, [params, setParams])

  const [status, setStatus] = useState('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const forceError = params.get('demo') === 'error'

  useEffect(() => {
    setStatus('loading')
    const t = setTimeout(() => setStatus(forceError ? 'error' : 'ready'), forceError ? 400 : 380)
    return () => clearTimeout(t)
  }, [sort, topic, attractionFilter, kw, reloadKey, forceError])

  useEffect(() => {
    const next = {}
    if (sort !== 'latest') next.sort = sort
    if (topic) next.topic = topic
    if (attractionFilter) next.attraction = attractionFilter
    if (kw) next.kw = kw
    setParams(next, { replace: true })
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, topic, attractionFilter, kw])

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase()
    let list = allPosts.filter((p) => {
      if (topic && p.topic !== topic) return false
      if (attractionFilter && p.attraction !== attractionFilter) return false
      if (k) {
        const hay = [p.title, p.excerpt, topicName(p.topic)].join(' ').toLowerCase()
        if (!hay.includes(k)) return false
      }
      return true
    })

    list = [...list].sort((a, b) => {
      if (sort === 'hot') return b.likes + b.comments * 2 - (a.likes + a.comments * 2)
      return a.createdAt < b.createdAt ? 1 : -1
    })

    return list
  }, [allPosts, topic, attractionFilter, kw, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const clearAll = () => {
    setTopic('')
    setAttractionFilter('')
    setKw('')
    setSort('latest')
  }

  const hasFilter = topic || attractionFilter || kw

  /* 右侧栏：本周活跃话题统计 */
  const topicStats = TOPICS.map((t) => ({
    ...t,
    count: allPosts.filter((p) => p.topic === t.key).length,
  })).sort((a, b) => b.count - a.count)

  return (
    <div className="page">
      <div className="container">
        <Breadcrumb items={[{ label: '社区广场' }]} />
        {BACKEND_ENABLED && <p className="notice small">社区目前为本机预览：草稿与试发内容仅保存在当前设备，不会公开给其他账号。任务中心的公开任务审核已联网。</p>}

        <div className="row-between wrap row-4" style={{ marginTop: 'var(--sp-6)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--fs-h1)' }}>社区广场</h1>
            <p className="muted small" style={{ marginTop: 8 }}>
              来分享你的长安见闻，也看看大家的游玩心得
            </p>
          </div>
          <div className="row row-2">
            <button className="btn btn-ghost" onClick={() => setRulesOpen(true)}>
              发布规范
            </button>
            <Link className="btn btn-primary" to="/publish">
              ＋ 发布内容
            </Link>
          </div>
        </div>

        <div className="community-layout" style={{ marginTop: 'var(--sp-6)' }}>
          <div style={{ minWidth: 0 }}>
            {/* ---------------- 筛选 ---------------- */}
            <div className="filter-bar">
              <div className="filter-group grow" style={{ minWidth: 200 }}>
                <input
                  className="input"
                  value={kw}
                  onChange={(e) => setKw(e.target.value)}
                  placeholder="搜索帖子标题或内容"
                  aria-label="搜索帖子"
                />
              </div>

              <div className="segment">
                {SORTS.map((s) => (
                  <button
                    key={s.key}
                    className={sort === s.key ? 'on' : ''}
                    onClick={() => setSort(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <button
                className="btn btn-ghost btn-sm"
                onClick={clearAll}
                disabled={!hasFilter && sort === 'latest'}
              >
                清除筛选
              </button>
            </div>

            <div className="filter-group wrap" style={{ marginTop: 'var(--sp-4)' }}>
              <span className="filter-label" style={{ minWidth: 64 }}>
                话题
              </span>
              <div className="filter-chips">
                <button className={`chip ${!topic ? 'on' : ''}`} onClick={() => setTopic('')}>
                  全部
                </button>
                {TOPICS.map((t) => (
                  <button
                    key={t.key}
                    className={`chip ${topic === t.key ? 'on' : ''}`}
                    onClick={() => setTopic(t.key === topic ? '' : t.key)}
                    aria-pressed={topic === t.key}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 已选条件 */}
            {(topic || attractionFilter || kw) && (
              <div className="active-filters">
                <span>已选条件：</span>
                {topic && (
                  <span className="filter-pill">
                    话题：{topicName(topic)}
                    <button onClick={() => setTopic('')} aria-label="移除话题筛选">
                      ✕
                    </button>
                  </span>
                )}
                {attractionFilter && (
                  <span className="filter-pill">
                    景点：{attractions.find((a) => a.id === attractionFilter)?.name}
                    <button onClick={() => setAttractionFilter('')} aria-label="移除景点筛选">
                      ✕
                    </button>
                  </span>
                )}
                {kw && (
                  <span className="filter-pill">
                    关键词：{kw}
                    <button onClick={() => setKw('')} aria-label="移除关键词">
                      ✕
                    </button>
                  </span>
                )}
                <button className="btn btn-ghost btn-sm" onClick={clearAll}>
                  全部清除
                </button>
              </div>
            )}

            {/* ---------------- 帖子列表 ---------------- */}
            <section style={{ marginTop: 'var(--sp-5)' }}>
              {status === 'loading' && <LoadingState rows={4} />}

              {status === 'error' && (
                <ErrorState
                  desc="社区内容加载失败。你当前的筛选条件已保留，可以直接重新加载。"
                  onRetry={() => setReloadKey((k) => k + 1)}
                />
              )}

              {status === 'ready' &&
                (filtered.length === 0 ? (
                  <EmptyState
                    icon="✎"
                    title="这里还没有内容"
                    desc={
                      hasFilter
                        ? '换个话题或关键词试试，也可以清除筛选看看全部内容。'
                        : '还没有人发布内容，你可以成为第一个。'
                    }
                    tone="info"
                    actions={
                      <>
                        {hasFilter && (
                          <button className="btn btn-secondary" onClick={clearAll}>
                            清除筛选
                          </button>
                        )}
                        <Link className="btn btn-primary" to="/publish">
                          写第一篇
                        </Link>
                      </>
                    }
                  />
                ) : (
                  <>
                    <p className="small muted" style={{ marginBottom: 'var(--sp-4)' }}>
                      共 {filtered.length} 篇内容 · 第 {page} / {totalPages} 页
                    </p>

                    <div className="stack stack-4">
                      {pageItems.map((p) => (
                        <CommunityRow
                          key={p.id}
                          post={p}
                          author={author(p.author)}
                          liked={isPostLiked(p.id)}
                          saved={isPostSaved(p.id)}
                          onLike={() => toggleLike(p.id, p.title)}
                          onSave={() => toggleSavePost(p.id, p.title)}
                          onReport={() => setReportPost(p)}
                          onAttraction={() =>
                            p.attraction && setAttractionFilter(p.attraction)
                          }
                        />
                      ))}
                    </div>

                    <Pager page={page} total={totalPages} onChange={setPage} />
                  </>
                ))}
            </section>
          </div>

          {/* ---------------- 侧栏 ---------------- */}
          <aside className="detail-aside">
            <div className="card card-pad">
              <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-4)' }}>
                话题
              </h3>
              <div className="stack stack-2">
                {topicStats.map((t) => (
                  <button
                    key={t.key}
                    className={`region-card ${topic === t.key ? 'on' : ''}`}
                    onClick={() => setTopic(t.key === topic ? '' : t.key)}
                  >
                    <span className="region-swatch" style={{ background: t.color }} />
                    <span className="grow small" style={{ fontWeight: 600 }}>
                      {t.name}
                    </span>
                    <span className="tag tag-outline">{t.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="card card-pad">
              <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-3)' }}>
                按景点找帖子
              </h3>
              <p className="xs muted" style={{ marginBottom: 'var(--sp-4)' }}>
                选择景点，只看与它相关的经验分享。
              </p>
              <div className="filter-chips">
                {attractions
                  .filter((a) => allPosts.some((p) => p.attraction === a.id))
                  .slice(0, 8)
                  .map((a) => (
                    <button
                      key={a.id}
                      className={`chip ${attractionFilter === a.id ? 'on' : ''}`}
                      onClick={() =>
                        setAttractionFilter(attractionFilter === a.id ? '' : a.id)
                      }
                    >
                      {a.name}
                    </button>
                  ))}
              </div>
            </div>

            <Notice kind="quiet">
              <strong>社区规范</strong>
              <br />
              {COMPOSER_TOPIC_HINT}
              <button
                className="section-link"
                style={{ display: 'block', marginTop: 8 }}
                onClick={() => setRulesOpen(true)}
              >
                查看完整规范 →
              </button>
            </Notice>
          </aside>
        </div>
      </div>

      {/* ---------------- 举报 ---------------- */}
      {reportPost && (
        <Modal
          title="举报内容"
          desc="请选择举报原因。我们会根据社区规范进行核实处理。"
          onClose={() => setReportPost(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setReportPost(null)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setReportPost(null)
                  toast('举报已提交，我们会在 24 小时内核实处理', 'success')
                }}
              >
                提交举报
              </button>
            </>
          }
        >
          <p className="small muted" style={{ marginBottom: 'var(--sp-4)' }}>
            被举报内容：{reportPost.title}
          </p>
          <div className="stack stack-2">
            {[
              '内容与旅行无关或为广告推广',
              '包含未经核实的价格或承诺信息',
              '涉及他人隐私或未经同意的肖像',
              '含有攻击性或不友善的表述',
              '其他违规内容',
            ].map((r) => (
              <label key={r} className="check">
                <input type="radio" name="report" />
                <span>{r}</span>
              </label>
            ))}
          </div>
        </Modal>
      )}

      {/* ---------------- 发布规范 ---------------- */}
      {rulesOpen && (
        <Modal
          title="社区发布规范"
          desc="为了让经验分享对后来的人真正有用，请遵守以下几条。"
          onClose={() => setRulesOpen(false)}
          size="modal-lg"
          footer={
            <button className="btn btn-primary" onClick={() => setRulesOpen(false)}>
              我知道了
            </button>
          }
        >
          <div className="stack stack-4">
            {[
              {
                t: '分享真实经历',
                d: '写你实际走过的路线和真实的感受。转述他人的内容请注明来源。',
              },
              {
                t: '价格与时间请注明日期',
                d: '票价、开放时间和交通都会变化。写下你实际去的日期，读者才能判断信息是否还适用。',
              },
              {
                t: '不做绝对化承诺',
                d: '避免「绝对不用排队」「一定最便宜」这类表述，也请勿发布商业推广与导流信息。',
              },
              {
                t: '尊重他人隐私与肖像',
                d: '发布含他人面孔的照片前请取得同意，不要公开他人联系方式与住址。',
              },
              {
                t: '友善表达',
                d: '对景点和商家的评价请就事论事，不对个人进行攻击。',
              },
            ].map((r) => (
              <div className="tip-item" key={r.t}>
                <span className="ti">◆</span>
                <span>
                  <strong>{r.t}</strong>
                  <br />
                  {r.d}
                </span>
              </div>
            ))}

            <Notice kind="warn">
              违反规范的内容可能被下架或限制展示。如发现违规内容，可通过帖子上的举报入口反馈。
            </Notice>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ==========================================================================
   社区列表行：横向卡片，信息密度高于首页的图文卡片
   ========================================================================== */
function CommunityRow({ post, author, liked, saved, onLike, onSave, onReport, onAttraction }) {
  const a = post.attraction ? attractions.find((x) => x.id === post.attraction) : null

  return (
    <article className="card card-hover" style={{ overflow: 'hidden' }}>
      <div className="community-row">
        <Link to={`/post/${post.id}`} className="community-row-media">
          <Thumb src={postCoverImage(post)} tone={post.cover} label={topicName(post.topic).slice(0, 2)} />
        </Link>

        <div className="community-row-body">
          <div className="post-tags">
            <span
              className="tag"
              style={{ background: `${topicColor(post.topic)}1A`, color: topicColor(post.topic) }}
            >
              {topicName(post.topic)}
            </span>
            {a && (
              <button className="tag tag-link" onClick={onAttraction}>
                景点 · {a.name}
              </button>
            )}
            {post.isMine && <span className="tag tag-gold">我发布的</span>}
          </div>

          <Link to={`/post/${post.id}`}>
            <h3 className="post-title clamp-2" style={{ fontSize: 'var(--fs-body-lg)' }}>
              {post.title}
            </h3>
          </Link>

          <p className="post-excerpt clamp-2">{post.excerpt}</p>

          <div className="row-between wrap row-3" style={{ marginTop: 'auto' }}>
            <Link
              to={author.isMe ? '/profile' : `/user/${author.id}`}
              className="avatar-name"
            >
              <Avatar variant={author.avatar} size={30} />
              <span className="nm">{author.name}</span>
              <span className="xs muted">· {post.createdAt}</span>
            </Link>

            <div className="post-stats">
              <button
                className={`stat-btn ${liked ? 'on' : ''}`}
                onClick={onLike}
                aria-pressed={liked}
                aria-label={liked ? '取消点赞' : '点赞'}
              >
                <span>{liked ? '♥' : '♡'}</span>
                {post.likes + (liked ? 1 : 0)}
              </button>
              <Link className="stat-btn" to={`/post/${post.id}#comments`}>
                <span>💬</span>
                {post.comments}
              </Link>
              <span className="stat-btn" style={{ cursor: 'default' }}>
                <span>👁</span>
                {post.views}
              </span>
              <button
                className={`stat-btn ${saved ? 'on' : ''}`}
                onClick={onSave}
                aria-pressed={saved}
                aria-label={saved ? '取消收藏' : '收藏'}
              >
                <span>{saved ? '★' : '☆'}</span>
              </button>
              <button className="stat-btn" onClick={onReport} aria-label="举报">
                <span>⚑</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
