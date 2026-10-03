import { useParams, Link, useNavigate } from 'react-router-dom'
import { useApp, useAuthor } from '../store/AppContext'
import { postsByAuthor, TOPICS, topicName, topicColor } from '../data/community'
import { getAttraction, regionName } from '../data/attractions'
import Avatar from '../components/Avatar'
import { Breadcrumb, EmptyState, Notice, Thumb } from '../components/ui'
import { PostGrid } from '../components/cards'

/* ==========================================================================
   他人主页
   社区为「内容型」：作者主页只展示 TA 发布的内容，不做关注 / 粉丝关系链。
   关系链留到后续版本，可省去大量社区复杂度。
   ========================================================================== */

export default function UserProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { allPosts, isLoggedIn, setAuthModal, toast } = useApp()
  const author = useAuthor()

  const a = author(id)

  /* 当前用户看自己的主页时，引导到个人中心 */
  if (a.isMe) {
    return (
      <div className="container page">
        <EmptyState
          icon="👤"
          title="这是你自己的主页"
          desc="个人中心里有更完整的管理功能：发布内容、收藏、行程、浏览记录与形象编辑。"
          actions={
            <Link className="btn btn-primary" to="/profile">
              去个人中心
            </Link>
          }
        />
      </div>
    )
  }

  const theirPosts = allPosts.filter((p) => p.author === a.id)

  /* 统计 TA 的内容涉及的景点与话题 */
  const attractionIds = [...new Set(theirPosts.map((p) => p.attraction).filter(Boolean))]
  const topics = TOPICS.filter((t) => theirPosts.some((p) => p.topic === t.key))

  return (
    <div className="page">
      <div className="container">
        <Breadcrumb
          items={[{ label: '社区广场', to: '/community' }, { label: a.name }]}
        />

        <button className="back-link" onClick={() => navigate(-1)}>
          ← 返回上一页
        </button>

        {/* ---------------- 作者头卡 ---------------- */}
        <div className="profile-hero" style={{ marginTop: 'var(--sp-5)' }}>
          <div className="profile-hero-inner">
            <Avatar variant={a.avatar} size={92} ring />

            <div className="grow" style={{ minWidth: 220 }}>
              <h1 className="profile-name">{a.name}</h1>
              <p className="profile-bio">{a.bio}</p>

              <div className="profile-stats">
                <div className="profile-stat">
                  <div className="n">{theirPosts.length}</div>
                  <div className="l">发布内容</div>
                </div>
                <div className="profile-stat">
                  <div className="n">{a.likes}</div>
                  <div className="l">获赞</div>
                </div>
                <div className="profile-stat">
                  <div className="n">{a.region}</div>
                  <div className="l">常居地</div>
                </div>
              </div>
            </div>

            <button
              className="btn btn-gold"
              style={{ flexShrink: 0 }}
              onClick={() => {
                if (!isLoggedIn) return setAuthModal('login')
                toast(`已关注 ${a.name} 的内容（演示）`, 'success')
              }}
            >
              ＋ 关注 TA 的动态
            </button>
          </div>
        </div>

        <Notice kind="quiet" className="mt-5">
          当前版本社区为<strong>内容型</strong>：作者主页只展示 TA 发布的内容，
          暂不提供关注与粉丝关系链。你可以通过话题和景点标签找到相似经验。
        </Notice>

        <div className="detail-layout" style={{ marginTop: 'var(--sp-6)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--fs-h2)', marginBottom: 'var(--sp-5)' }}>
              TA 发布的内容
            </h2>

            {theirPosts.length === 0 ? (
              <EmptyState
                icon="✎"
                title={`${a.name} 还没有发布内容`}
                desc="可以去社区广场看看其他游客的分享。"
                actions={
                  <Link className="btn btn-primary" to="/community">
                    去社区广场
                  </Link>
                }
              />
            ) : (
              <PostGrid items={theirPosts} />
            )}
          </div>

          {/* ---------------- 侧栏 ---------------- */}
          <aside className="detail-aside">
            {topics.length > 0 && (
              <div className="card card-pad">
                <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-4)' }}>
                  TA 常写的话题
                </h3>
                <div className="filter-chips">
                  {topics.map((t) => (
                    <Link
                      key={t.key}
                      to={`/community?topic=${t.key}`}
                      className="chip"
                      style={{ borderColor: `${topicColor(t.key)}55`, color: topicColor(t.key) }}
                    >
                      {t.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {attractionIds.length > 0 && (
              <div className="card card-pad">
                <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-4)' }}>
                  TA 写过的景点
                </h3>
                <div className="stack stack-3">
                  {attractionIds.map((aid) => {
                    const at = getAttraction(aid)
                    if (!at) return null
                    return (
                      <Link key={aid} to={`/attraction/${aid}`} className="row row-3">
                        <span className="record-thumb" style={{ width: 44, height: 44 }}>
                          <Thumb src={at.image} alt={at.name} tone={at.tone} label="" />
                        </span>
                        <span className="grow" style={{ minWidth: 0 }}>
                          <span
                            className="clamp-1"
                            style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', display: 'block' }}
                          >
                            {at.name}
                          </span>
                          <span className="xs muted">{regionName(at.region)}</span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="card card-pad">
              <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-3)' }}>
                关于作者
              </h3>
              <dl className="info-list">
                <div className="info-row">
                  <dt>加入时间</dt>
                  <dd>{a.joined}</dd>
                </div>
                <div className="info-row">
                  <dt>常居地</dt>
                  <dd>{a.region}</dd>
                </div>
                <div className="info-row">
                  <dt>发布内容</dt>
                  <dd>{theirPosts.length} 篇</dd>
                </div>
              </dl>
            </div>

            <Notice kind="quiet">
              TA 发布的内容属于个人经验分享，不代表平台或官方立场。
              如发现违规内容，可在对应帖子下使用举报入口反馈。
            </Notice>
          </aside>
        </div>
      </div>
    </div>
  )
}
