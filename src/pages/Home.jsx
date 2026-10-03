import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { AttractionGrid, PostGrid, RouteCard } from '../components/cards'
import { Thumb, Notice } from '../components/ui'
import Avatar from '../components/Avatar'
import { attractions, REGIONS } from '../data/attractions'
import '../styles/exploration.css'
import HeroSlideshow from '../components/HeroSlideshow'
import { ROUTES, posts, TOPICS, topicColor, postCoverImage } from '../data/community'

/* ==========================================================================
   首页
   承担平台入口与内容发现：首屏主题视觉、目的地搜索、热门景点入口、
   分层展示热门景点 / 推荐路线 / 社区精选 / 最新动态。
   登录入口清晰但不遮挡浏览。
   ========================================================================== */

const HOT_KEYWORDS = ['兵马俑', '西安城墙', '陕博', '大唐不夜城', '华清宫', '回民街']

const QUICK = [
  { img: 'a4', icon: '🏛', title: '文物看不够', sub: '博物馆与遗址', to: '/attractions?type=博物馆' },
  { img: 'a1', icon: '🚶', title: '初次来西安', sub: '经典三日路线', to: '/itinerary?route=r1' },
  { img: 'a6', icon: '🌙', title: '夜游长安', sub: '夜景与街区', to: '/attractions?season=夜景' },
  { img: 'a16', icon: '⛰', title: '秦岭避暑', sub: '山岳与自然', to: '/attractions?region=qinling' },
]

/* 静态资源前缀，与 src/data/attractions.js 的 ASSET_BASE 口径一致 */
const ASSET_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/'

export default function Home({ onOpenSearch }) {
  const navigate = useNavigate()
  const { isLoggedIn, setAuthModal, allPosts } = useApp()
  const [q, setQ] = useState('')

  const hotAttractions = [...attractions]
    .sort((a, b) => b.favorites - a.favorites)
    .slice(0, 8)

  const featuredPosts = allPosts.filter((p) => p.featured).slice(0, 3)
  const latestPosts = allPosts.slice(0, 6)

  const submit = (e) => {
    e.preventDefault()
    if (!q.trim()) return onOpenSearch()
    navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div className="page">
      {/* ---------------- 首屏 ---------------- */}
      <section className="hero">
        {/* 景点实景轮播；红色遮罩与前景文字保持固定。 */}
        <HeroSlideshow />
        <div className="container">
          <div className="hero-inner">
            <span className="hero-eyebrow">西安文旅 · 旅游信息与交流平台</span>

            <h1 className="hero-title">
              逛长安，<span className="accent">有人同行</span>
              <br />
              景点、行程与真实游记
            </h1>

            <p className="hero-sub">
              从发现目的地到规划行程，再到记录分享。
              景点资料、实用游玩信息、游客经验和虚拟形象社交，都在这里。
            </p>

            <form className="hero-search" onSubmit={submit} role="search">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索景点、区域或主题，如「兵马俑」「临潼」"
                aria-label="搜索景点、区域或主题"
              />
              <button className="btn btn-primary btn-lg" type="submit">
                搜索
              </button>
            </form>

            <div className="hero-keywords">
              <span>大家在搜：</span>
              {HOT_KEYWORDS.map((k) => (
                <button
                  key={k}
                  className="hero-keyword"
                  onClick={() => navigate(`/search?q=${encodeURIComponent(k)}`)}
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="hero-quick">
              {QUICK.map((it) => (
                <Link key={it.title} className="hero-quick-item" to={it.to}>
                  <span
                    className="qi qi-img"
                    style={{ backgroundImage: `url(${ASSET_BASE}images/attractions/${it.img}.jpg)` }}
                    role="img"
                    aria-label={it.title}
                  >
                    <span className="qi-emoji" aria-hidden="true">{it.icon}</span>
                  </span>
                  <span>
                    <span className="qt">{it.title}</span>
                    <br />
                    <span className="qs">{it.sub}</span>
                  </span>
                </Link>
              ))}
            </div>
            <Link className="exploration-hero-entry" to="/notebook">
              <span className="exploration-hero-entry-label" aria-hidden="true">✦ 探索入口</span>
              <span className="exploration-hero-entry-text">打开手札，收录你的长安发现 →</span>
            </Link>
          </div>
        </div>
      </section>

      <div className="container">
        {/* 数据条 */}
        <div className="stat-strip">
          <div className="stat-cell">
            <div className="stat-num">{attractions.length}</div>
            <div className="stat-label">收录景点</div>
          </div>
          <div className="stat-cell">
            <div className="stat-num">{REGIONS.length}</div>
            <div className="stat-label">覆盖片区</div>
          </div>
          <div className="stat-cell">
            <div className="stat-num">{allPosts.length}</div>
            <div className="stat-label">社区游记</div>
          </div>
          <div className="stat-cell">
            <div className="stat-num">30</div>
            <div className="stat-label">虚拟形象款式</div>
          </div>
        </div>

        {/* 未登录时的轻提示，不遮挡浏览 */}
        {!isLoggedIn && (
          <Notice kind="brand" className="mt-6">
            <div className="row-between wrap row-4">
              <span>
                <strong>想收藏景点或发布游记？</strong>
                <span className="muted">
                  {' '}
                  登录后可收藏、加入行程、评论互动，并创建专属虚拟形象。
                </span>
              </span>
              <span className="row row-2" style={{ flexShrink: 0 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setAuthModal('login')}>
                  登录
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setAuthModal('register')}>
                  注册
                </button>
              </span>
            </div>
          </Notice>
        )}



        {/* ---------------- 热门景点 ---------------- */}
        <section className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">热门景点</h2>
              <p className="section-sub">
                按收藏热度排序 · 卡片显示区域、类型与票价，便于快速比较
              </p>
            </div>
            <Link className="section-link" to="/attractions">
              查看全部 {attractions.length} 个 →
            </Link>
          </div>

          <AttractionGrid items={hotAttractions} />
        </section>

        {/* ---------------- 按区域浏览 ---------------- */}
        <section className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">按区域找</h2>
              <p className="section-sub">
                西安的景点分布是强地理概念，同一片区适合排在同一天
              </p>
            </div>
            <Link className="section-link" to="/map">
              地图总览 →
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 'var(--sp-4)',
            }}
          >
            {REGIONS.map((r) => {
              const count = attractions.filter((a) => a.region === r.key).length
              return (
                <Link
                  key={r.key}
                  to={`/attractions?region=${r.key}`}
                  className="card card-hover"
                  style={{ display: 'block', overflow: 'hidden' }}
                >
                  <div style={{ height: 4, background: r.color }} />
                  <div className="card-pad" style={{ padding: '18px 20px' }}>
                    <div className="row-between">
                      <h3 style={{ fontSize: 'var(--fs-body-lg)' }}>{r.name}</h3>
                      <span className="tag tag-outline">{count} 个</span>
                    </div>
                    <p className="xs muted" style={{ marginTop: 8 }}>
                      {regionHint(r.key)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ---------------- 推荐路线 ---------------- */}
        <section className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">推荐路线</h2>
              <p className="section-sub">按季节与主题组织的行程参考，可直接套用再改</p>
            </div>
            <Link className="section-link" to="/itinerary">
              自己排一个 →
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--sp-5)',
            }}
          >
            {ROUTES.map((r) => (
              <RouteCard key={r.id} route={r} />
            ))}
          </div>
        </section>

        {/* ---------------- 社区精选 ---------------- */}
        <section className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">社区精选游记</h2>
              <p className="section-sub">
                由游客发布的真实经验 · 用户内容不代表官方信息，请结合官方渠道核实
              </p>
            </div>
            <Link className="section-link" to="/community">
              进入社区 →
            </Link>
          </div>

          <PostGrid items={featuredPosts} />
        </section>

        {/* ---------------- 话题入口 ---------------- */}
        <section className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">按话题逛</h2>
              <p className="section-sub">游记、攻略、避坑、打卡与即时感受</p>
            </div>
          </div>
          <div className="filter-chips">
            {TOPICS.map((t) => (
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
        </section>

        {/* ---------------- 最新动态 ---------------- */}
        <section className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">最新旅行动态</h2>
              <p className="section-sub">社区最近发布的内容</p>
            </div>
            <Link className="section-link" to="/community?sort=latest">
              更多动态 →
            </Link>
          </div>

          <div className="stack stack-3">
            {latestPosts.map((p) => (
              <Link key={p.id} to={`/post/${p.id}`} className="record-row">
                <span className="record-thumb">
                  <Thumb src={postCoverImage(p)} tone={p.cover} label="" alt={p.title} />
                </span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span
                    className="clamp-1"
                    style={{ fontWeight: 600, display: 'block', fontSize: 'var(--fs-sm)' }}
                  >
                    {p.title}
                  </span>
                  <span className="xs muted">
                    {p.createdAt} · {p.likes} 赞 · {p.comments} 评论
                  </span>
                </span>
                <span className="tag" style={{ background: `${topicColor(p.topic)}1A`, color: topicColor(p.topic) }}>
                  {TOPICS.find((t) => t.key === p.topic)?.name}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ---------------- 虚拟形象介绍 ---------------- */}
        <section className="section">
          <div
            className="card"
            style={{
              background: 'linear-gradient(150deg, #8c2a22, #a83128 55%, #6d1f19)',
              border: 'none',
              color: 'var(--paper-50)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: 'var(--sp-10)',
                display: 'flex',
                gap: 'var(--sp-8)',
                alignItems: 'center',
                flexWrap: 'wrap',
                position: 'relative',
              }}
            >
              <div className="grow" style={{ minWidth: 280 }}>
                <span
                  className="hero-eyebrow"
                  style={{ background: 'rgba(255,255,255,.14)', borderColor: 'rgba(255,255,255,.22)', color: '#fff' }}
                >
                  虚拟形象 IP
                </span>
                <h2 style={{ fontSize: 'var(--fs-h1)', marginTop: 16, color: '#fff' }}>
                  给自己一个兵马俑形象
                </h2>
                <p style={{ marginTop: 14, color: 'rgba(255,255,255,.84)', maxWidth: 520, lineHeight: 1.8 }}>
                  注册后可从 30 款初始形象中选择，也可自定义外观。
                  虚拟形象作为社区身份展示的一部分，与真实账号信息分开呈现。
                </p>
                <div className="row row-3" style={{ marginTop: 24 }}>
                  <button
                    className="btn btn-gold btn-lg"
                    onClick={() => (isLoggedIn ? navigate('/profile?tab=avatar') : setAuthModal('register'))}
                  >
                    {isLoggedIn ? '编辑我的形象' : '创建我的形象'}
                  </button>
                  <Link className="btn btn-lg" style={{ color: '#fff', border: '1px solid rgba(255,255,255,.34)' }} to="/profile?tab=avatar">
                    先看看有哪些
                  </Link>
                </div>
              </div>

              <div className="row row-2" style={{ flexWrap: 'wrap', maxWidth: 340 }}>
                {['av-1', 'av-6', 'av-13', 'av-21'].map((id) => (
                  <span
                    key={id}
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      background: 'rgba(255,255,255,.94)',
                      boxShadow: '0 8px 24px rgba(0,0,0,.2)',
                    }}
                  >
                    <Avatar variant={id} size={66} />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function regionHint(key) {
  return {
    citywall: '钟楼、城墙、回民街，步行与地铁即可串联',
    qujiang: '大雁塔、陕博、不夜城，点位密集',
    lintong: '兵马俑与华清宫，需单独安排一整天',
    gaoxin: '汉城湖等休闲向点位，游客密度低',
    qinling: '山岳与自然景区，建议自驾并各留一天',
  }[key]
}
