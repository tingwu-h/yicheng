import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useApp, useAuthor } from '../store/AppContext'
import { topicName, topicColor, postCoverImage } from '../data/community'
import { getAttraction, regionName } from '../data/attractions'
import {
  Breadcrumb,
  Thumb,
  EmptyState,
  Modal,
  Notice,
  SourceNote,
} from '../components/ui'
import Avatar from '../components/Avatar'

/* ==========================================================================
   帖子详情
   完整展示作者虚拟形象、发布时间、正文图文、关联景点与话题标签，
   提供点赞、收藏、评论及分享入口。评论区支持查看、发表与回复。
   用户可从关联景点跳转至景点详情。
   ========================================================================== */

export default function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    allPosts,
    myPosts,
    isPostLiked,
    toggleLike,
    isPostSaved,
    toggleSavePost,
    isLoggedIn,
    setAuthModal,
    addComment,
    toast,
    pushHistory,
    toggleSaveAttraction,
    isAttractionSaved,
    avatarId,
  } = useApp()
  const author = useAuthor()

  const [replyTo, setReplyTo] = useState(null)
  const [text, setText] = useState('')
  const [reportOpen, setReportOpen] = useState(false)

  /* 我的帖子与种子数据的评论分别存放，这里合并展示 */
  const post = allPosts.find((p) => p.id === id)

  useEffect(() => {
    if (post) {
      pushHistory({ type: 'post', id: post.id, title: post.title, tone: post.cover })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (location.hash === '#comments') {
      setTimeout(() => {
        document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' })
      }, 120)
    }
  }, [location.hash, post])

  if (!post) {
    return (
      <div className="container page">
        <EmptyState
          icon="?"
          title="没有找到这篇内容"
          desc="它可能已被作者删除，或者链接不正确。"
          actions={
            <>
              <Link className="btn btn-primary" to="/community">
                返回社区广场
              </Link>
              <Link className="btn btn-secondary" to="/">
                回到首页
              </Link>
            </>
          }
        />
      </div>
    )
  }

  const a = author(post.author)
  const attraction = post.attraction ? getAttraction(post.attraction) : null
  const liked = isPostLiked(post.id)
  const saved = isPostSaved(post.id)

  /* 评论列表：allPosts 已包含我的发布与种子数据，直接取当前帖子的即可 */
  const comments = post.commentList || []

  const submitComment = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    if (!isLoggedIn) {
      setAuthModal('login')
      return
    }
    addComment(post.id, text.trim())
    setText('')
    setReplyTo(null)
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast('链接已复制到剪贴板', 'success')
    } catch {
      toast('复制失败，请手动复制地址栏链接', 'warning')
    }
  }

  return (
    <div className="page">
      <div className="container-narrow">
        <Breadcrumb
          items={[
            { label: '社区广场', to: '/community' },
            { label: topicName(post.topic), to: `/community?topic=${post.topic}` },
            { label: '内容详情' },
          ]}
        />

        <button className="back-link" onClick={() => navigate(-1)}>
          ← 返回上一页
        </button>

        {/* ---------------- 文章头 ---------------- */}
        <header className="article-head">
          <div className="post-tags" style={{ marginBottom: 'var(--sp-4)' }}>
            <span
              className="tag"
              style={{ background: `${topicColor(post.topic)}1A`, color: topicColor(post.topic) }}
            >
              {topicName(post.topic)}
            </span>
            {post.isMine && <span className="tag tag-gold">我发布的</span>}
          </div>

          <h1 className="article-title">{post.title}</h1>

          <div className="article-author">
            <Link to={a.isMe ? '/profile' : `/user/${a.id}`} className="avatar-name">
              <Avatar variant={a.avatar} size={44} ring />
              <span>
                <span className="nm" style={{ fontSize: 'var(--fs-body)' }}>
                  {a.name}
                </span>
                <br />
                <span className="sub">
                  {post.createdAt} 发布
                  {a.region ? ` · ${a.region}` : ''}
                </span>
              </span>
            </Link>

            <div className="grow" />

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (!isLoggedIn) return setAuthModal('login')
                toast(`已关注 ${a.name} 的内容（演示）`, 'success')
              }}
              disabled={a.isMe}
            >
              {a.isMe ? '这是你自己' : '关注作者'}
            </button>
          </div>
        </header>

        {/* ---------------- 正文 ---------------- */}
        <article className="article-body">
          {post.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}

          {/* 配图占位 */}
          <figure className="article-figure">
            <Thumb src={postCoverImage(post)} tone={post.cover} label={topicName(post.topic).slice(0, 2)} />
            <figcaption>
              作者实拍 · 共 {post.images || 1} 张（演示环境以占位图呈现）
            </figcaption>
          </figure>
        </article>

        {/* ---------------- 关联景点 ---------------- */}
        {attraction && (
          <section className="card card-pad" style={{ marginBottom: 'var(--sp-6)' }}>
            <p className="label" style={{ marginBottom: 'var(--sp-4)' }}>
              关联景点
            </p>
            <div className="row row-4 wrap">
              <Link
                to={`/attraction/${attraction.id}`}
                className="record-thumb"
                style={{ width: 76, height: 76 }}
              >
                <Thumb src={attraction.image} alt={attraction.name} tone={attraction.tone} label="" />
              </Link>

              <div className="grow" style={{ minWidth: 180 }}>
                <Link to={`/attraction/${attraction.id}`}>
                  <h3 style={{ fontSize: 'var(--fs-body-lg)' }}>{attraction.name}</h3>
                </Link>
                <p className="xs muted" style={{ marginTop: 6 }}>
                  {regionName(attraction.region)} · {attraction.type} · {attraction.duration}
                </p>
                <p className="small muted clamp-2" style={{ marginTop: 8 }}>
                  {attraction.summary}
                </p>
              </div>

              <div className="stack stack-2" style={{ flexShrink: 0 }}>
                <Link className="btn btn-secondary btn-sm" to={`/attraction/${attraction.id}`}>
                  查看景点详情
                </Link>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => toggleSaveAttraction(attraction.id, attraction.name)}
                >
                  {isAttractionSaved(attraction.id) ? '★ 已收藏' : '☆ 收藏景点'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ---------------- 互动条 ---------------- */}
        <div
          className="card card-pad row-between wrap row-4"
          style={{ marginBottom: 'var(--sp-8)' }}
        >
          <div className="row row-2">
            <button
              className={`btn ${liked ? 'btn-gold' : 'btn-secondary'}`}
              onClick={() => toggleLike(post.id, post.title)}
              aria-pressed={liked}
            >
              {liked ? '♥ 已点赞' : '♡ 点赞'} {post.likes + (liked ? 1 : 0)}
            </button>
            <button
              className={`btn ${saved ? 'btn-gold' : 'btn-secondary'}`}
              onClick={() => toggleSavePost(post.id, post.title)}
              aria-pressed={saved}
            >
              {saved ? '★ 已收藏' : '☆ 收藏'}
            </button>
            <button className="btn btn-secondary" onClick={share}>
              分享
            </button>
          </div>

          <div className="meta">
            <span>👁 {post.views} 次浏览</span>
            <span className="dot-sep">💬 {post.comments} 条评论</span>
          </div>
        </div>

        {/* ---------------- 评论区 ---------------- */}
        <section id="comments">
          <div className="row-between wrap row-3" style={{ marginBottom: 'var(--sp-5)' }}>
            <h2 style={{ fontSize: 'var(--fs-h2)' }}>
              评论区
              <span className="muted small" style={{ fontWeight: 400, marginLeft: 10 }}>
                {comments.length > 0 ? `显示最近 ${comments.length} 条` : ''}
              </span>
            </h2>
            <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => setReportOpen(true)}>
              ⚑ 举报这篇内容
            </button>
          </div>

          {/* 发表评论 */}
          <form onSubmit={submitComment} className="card card-pad" style={{ marginBottom: 'var(--sp-6)' }}>
            {replyTo && (
              <div className="row-between" style={{ marginBottom: 'var(--sp-3)' }}>
                <span className="xs muted">正在回复 {replyTo.name}</span>
                <button
                  type="button"
                  className="xs"
                  style={{ color: 'var(--cinnabar-700)' }}
                  onClick={() => setReplyTo(null)}
                >
                  取消回复
                </button>
              </div>
            )}

            <div className="row row-3" style={{ alignItems: 'flex-start' }}>
              <Avatar
                variant={isLoggedIn ? avatarId : 'av-1'}
                size={38}
                title={isLoggedIn ? undefined : '未登录游客'}
              />
              <div className="grow">
                <textarea
                  className="textarea"
                  style={{ minHeight: 92 }}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    isLoggedIn
                      ? '说说你的看法，或补充你知道的实用信息…'
                      : '登录后即可参与评论互动'
                  }
                  onFocus={() => {
                    if (!isLoggedIn) setAuthModal('login')
                  }}
                  aria-label="评论内容"
                />
                <div className="row-between wrap row-3" style={{ marginTop: 'var(--sp-3)' }}>
                  <span className="xs muted">
                    {isLoggedIn
                      ? '请友善表达，避免发布未经核实的价格与承诺信息。'
                      : '未登录状态下可以浏览全部内容'}
                  </span>
                  <button className="btn btn-primary btn-sm" disabled={!text.trim()}>
                    发表评论
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* 评论列表 */}
          {comments.length === 0 ? (
            <EmptyState
              icon="💬"
              title="还没有评论"
              desc="来说说你的想法，或者补充一些对后来者有帮助的信息。"
              tone="info"
            />
          ) : (
            <div className="card card-pad">
              {comments.map((c) => {
                const ca = author(c.author)
                return (
                  <div className="comment" key={c.id}>
                    <Link to={ca.isMe ? '/profile' : `/user/${ca.id}`}>
                      <Avatar variant={ca.avatar} size={38} />
                    </Link>

                    <div className="comment-main">
                      <div className="comment-head">
                        <Link to={ca.isMe ? '/profile' : `/user/${ca.id}`} className="comment-name">
                          {ca.name}
                        </Link>
                        <span className="xs muted">{c.createdAt}</span>
                        {c.author === post.author && (
                          <span className="tag tag-cinnabar">作者</span>
                        )}
                      </div>

                      <p className="comment-body">{c.content}</p>

                      <div className="comment-actions">
                        <button
                          className="stat-btn"
                          onClick={() => {
                            if (!isLoggedIn) return setAuthModal('login')
                            toast('已点赞这条评论', 'success')
                          }}
                        >
                          ♡ {c.likes}
                        </button>
                        <button
                          className="stat-btn"
                          onClick={() => {
                            if (!isLoggedIn) return setAuthModal('login')
                            setReplyTo(ca)
                          }}
                        >
                          回复
                        </button>
                      </div>

                      {c.reply && (
                        <div className="comment-reply">
                          <span className="who">
                            {author(c.reply.author).name} 回复：
                          </span>
                          {c.reply.content}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <Notice kind="quiet" className="mt-8">
          以上内容由用户发布，属于个人经验分享，不代表平台或官方立场。
          涉及票价、开放时间与交通的信息请以官方渠道为准，出行前请核实。
        </Notice>
      </div>

      {/* ---------------- 举报 ---------------- */}
      {reportOpen && (
        <Modal
          title="举报内容"
          desc="请选择举报原因。我们会根据社区规范进行核实处理。"
          onClose={() => setReportOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setReportOpen(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setReportOpen(false)
                  toast('举报已提交，我们会在 24 小时内核实处理', 'success')
                }}
              >
                提交举报
              </button>
            </>
          }
        >
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
    </div>
  )
}
