import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useApp, formatDate } from '../store/AppContext'
import Avatar, {
  AVATAR_PRESETS,
  HATS,
  ARMORS,
  FACES,
  PALETTES,
  getPreset,
} from '../components/Avatar'
import { Thumb, EmptyState, Notice, Modal } from '../components/ui'
import { PostGrid } from '../components/cards'
import Pet from '../components/Pet'
import { useQuest } from '../store/QuestContext'
import { QUEST_COPY } from '../data/questConfig'
import { PET_ITEMS_BY_ID } from '../data/pets'
import { getAttraction, regionName } from '../data/attractions'
import { topicName, postCoverImage } from '../data/community'
import ProfilePetPanel from '../components/ProfilePetPanel'
import PlayRecords from '../components/PlayRecords'
import { compressAvatar } from '../lib/avatarImage'

/* ==========================================================================
   个人中心
   · 展示头像形象、昵称、个人简介与个人主页入口
   · 集中管理我发布的帖子、收藏的景点、行程、浏览记录与互动记录
   · 隐私设置区分公开内容与仅自己可见的记录
   · 虚拟形象编辑：30 款初始形象选择 + 自定义外观调整
   ========================================================================== */

const MENU = [
  { key: 'overview', label: '概览', icon: '◈' },
  { key: 'posts', label: '我发布的', icon: '📝' },
  { key: 'saved', label: '收藏的景点', icon: '⭐' },
  { key: 'trips', label: '我的行程', icon: '🗺' },
  { key: 'playRecords', label: '游玩记录', icon: '⌛' },
  { key: 'history', label: '浏览记录', icon: '🕘', privacy: 'private' },
  { key: 'interactions', label: '互动记录', icon: '♡', privacy: 'private' },
  { key: 'pets', label: '萌宠', icon: '🐾' },
  { key: 'coins', label: '金币明细', icon: '🪙' },
  { key: 'avatar', label: '虚拟形象', icon: '🎭' },
  { key: 'settings', label: '账号设置', icon: '⚙' },
]

export default function Profile() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    user,
    isLoggedIn,
    setAuthModal,
    profile,
    avatarId,
    setAvatarId,
    updateProfile,
    logout,
    myPosts,
    savedAttractions,
    history,
    savedPosts,
    likedPosts,
    allPosts,
    itinerary,
    drafts,
    toast,
  } = useApp()

  const [tab, setTab] = useState(params.get('tab') || 'overview')

  /* 萌宠 / 金币：数据都在 QuestContext 里 */
  const {
    ledger,
    balance,
    activePet,
    petCatalog,
    upgradeItem,
  } = useQuest()

  useEffect(() => {
    setTab(params.get('tab') || 'overview')
  }, [params])

  const go = (key) => {
    setTab(key)
    setParams({ tab: key }, { replace: true })
  }

  /* ---------------- 未登录 ---------------- */
  if (!isLoggedIn) {
    return (
      <div className="container page">
        <EmptyState
          icon="👤"
          title="登录后查看个人中心"
          desc="个人中心用于管理你发布的内容、收藏的景点、行程与浏览记录。不登录也可以自由浏览景点与社区内容。"
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

  const displayName = profile.name || user?.name || '长安游客'
  const mySavedPosts = allPosts.filter((p) => savedPosts.includes(p.id))

  return (
    <div className="page">
      <div className="container">
        {/* ---------------- 头卡 ---------------- */}
        <div className="profile-hero">
          <div className="profile-hero-inner">
            <Avatar variant={avatarId} size={96} ring />

            <div className="grow" style={{ minWidth: 220 }}>
              <h1 className="profile-name">{displayName}</h1>
              <p className="profile-bio">
                {profile.bio || '还没有填写个人简介，去账号设置里补一句吧。'}
              </p>

              <div className="profile-stats">
                <div className="profile-stat">
                  <div className="n">{myPosts.length}</div>
                  <div className="l">发布内容</div>
                </div>
                <div className="profile-stat">
                  <div className="n">{savedAttractions.length}</div>
                  <div className="l">收藏景点</div>
                </div>
                <div className="profile-stat">
                  <div className="n">{likedPosts.length}</div>
                  <div className="l">点赞</div>
                </div>
                <div className="profile-stat">
                  <div className="n">{history.length}</div>
                  <div className="l">浏览记录</div>
                </div>
              </div>
            </div>

            <div className="row row-2" style={{ flexShrink: 0 }}>
              <button className="btn btn-gold" onClick={() => go('avatar')}>
                🎭 编辑形象
              </button>
              <button
                className="btn"
                style={{ color: '#fff', border: '1px solid rgba(255,255,255,.36)' }}
                onClick={() => go('settings')}
              >
                账号设置
              </button>
            </div>
          </div>
        </div>

        <div className="profile-layout">
          {/* ---------------- 侧栏菜单 ---------------- */}
          <nav className="side-menu" aria-label="个人中心导航">
            {MENU.map((m) => {
              const counts = {
                posts: myPosts.length,
                saved: savedAttractions.length,
                trips: itinerary.days.reduce((n, d) => n + d.items.length, 0) || '',
                history: history.length,
                interactions: likedPosts.length + savedPosts.length,
                pets: petCatalog.filter((p) => p.unlocked).length,
                coins: balance || '',
              }
              return (
                <button
                  key={m.key}
                  className={`side-menu-item ${tab === m.key ? 'on' : ''}`}
                  onClick={() => go(m.key)}
                  aria-current={tab === m.key ? 'page' : undefined}
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                  {counts[m.key] ? <span className="cnt">{counts[m.key]}</span> : null}
                </button>
              )
            })}
          </nav>

          {/* ---------------- 内容区 ---------------- */}
          <div style={{ minWidth: 0 }}>
            {tab === 'playRecords' && <PlayRecords />}
            {tab === 'overview' && (
              <Overview
                myPosts={myPosts}
                savedAttractions={savedAttractions}
                itinerary={itinerary}
                history={history}
                drafts={drafts}
                onGo={go}
              />
            )}

            {tab === 'posts' && (
              <Section
                title="我发布的内容"
                desc="这些内容对所有游客可见"
                privacy="public"
              >
                {myPosts.length === 0 ? (
                  <EmptyState
                    icon="✎"
                    title="还没有发布内容"
                    desc="把你在西安的经历写下来，对后来的人很有帮助。"
                    tone="info"
                    actions={
                      <Link className="btn btn-primary" to="/publish">
                        写第一篇游记
                      </Link>
                    }
                  />
                ) : (
                  <PostGrid items={myPosts} />
                )}
              </Section>
            )}

            {tab === 'saved' && (
              <Section title="收藏的景点" desc="收藏内容对其他游客可见" privacy="public">
                {savedAttractions.length === 0 ? (
                  <EmptyState
                    icon="⭐"
                    title="还没有收藏景点"
                    desc="在景点页点击卡片右上角的 ☆ 即可收藏，之后能快速加入行程。"
                    actions={
                      <Link className="btn btn-primary" to="/attractions">
                        去景点库逛逛
                      </Link>
                    }
                  />
                ) : (
                  <div className="stack stack-3">
                    {savedAttractions.map((id) => {
                      const a = getAttraction(id)
                      if (!a) return null
                      return (
                        <Link key={id} to={`/attraction/${a.id}`} className="record-row">
                          <span className="record-thumb">
                            <Thumb src={a.image} alt={a.name} tone={a.tone} label="" />
                          </span>
                          <span className="grow" style={{ minWidth: 0 }}>
                            <span style={{ fontWeight: 700, display: 'block' }}>
                              {a.name}
                            </span>
                            <span className="xs muted">
                              {regionName(a.region)} · {a.type} · {a.duration}
                            </span>
                          </span>
                          <span className="tag tag-outline">
                            {a.ticket?.kind === 'free' ? '免费' : `¥${a.ticket.price}`}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </Section>
            )}

            {tab === 'trips' && (
              <Section title="我的行程" desc="行程默认为仅自己可见，可通过分享摘要发给同行的人">
                <div className="card card-pad">
                  <div className="row-between wrap row-3">
                    <div>
                      <h3 style={{ fontSize: 'var(--fs-body-lg)' }}>{itinerary.title}</h3>
                      <p className="xs muted" style={{ marginTop: 6 }}>
                        {itinerary.startDate} 出发 · {itinerary.days.length} 天 ·{' '}
                        {itinerary.days.reduce((n, d) => n + d.items.length, 0)} 个点位
                      </p>
                    </div>
                    <Link className="btn btn-primary btn-sm" to="/itinerary">
                      继续编辑
                    </Link>
                  </div>

                  <div className="divider" />

                  <div className="stack stack-3">
                    {itinerary.days.map((d, i) => (
                      <div key={i} className="row row-3 wrap">
                        <span className="day-badge">D{i + 1}</span>
                        <span className="small muted" style={{ minWidth: 110 }}>
                          {formatDate(d.date)}
                        </span>
                        <span className="grow small">
                          {d.items.length === 0
                            ? '暂无安排'
                            : d.items
                                .map((it) => getAttraction(it.attractionId)?.name)
                                .filter(Boolean)
                                .join(' → ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            )}

            {tab === 'history' && (
              <Section
                title="浏览记录"
                desc="仅你自己可见。其他游客无法查看你浏览过什么。"
                privacy="private"
              >
                {history.length === 0 ? (
                  <EmptyState
                    icon="🕘"
                    title="还没有浏览记录"
                    desc="你看过的景点与帖子会出现在这里，方便回头查找。"
                  />
                ) : (
                  <div className="stack stack-3">
                    {history.map((h, i) => (
                      <div key={`${h.type}-${h.id}-${i}`} className="record-row">
                        <span className="record-thumb">
                          <Thumb src={h.type === 'attraction' ? getAttraction(h.id)?.image : undefined} tone={h.tone || ['#8C5A3C', '#5E3A26']} label="" />
                        </span>
                        <span className="grow" style={{ minWidth: 0 }}>
                          <Link
                            to={h.type === 'attraction' ? `/attraction/${h.id}` : `/post/${h.id}`}
                            style={{ fontWeight: 600, display: 'block' }}
                          >
                            {h.title}
                          </Link>
                          <span className="xs muted">
                            {h.type === 'attraction' ? '景点' : '帖子'} ·{' '}
                            {new Date(h.at).toLocaleString('zh-CN', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </span>
                        <span className="privacy-chip privacy-private">🔒 仅自己</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {tab === 'pets' && (
              <Section title="萌宠" desc="秦岭四宝：棕色大熊猫七仔、朱鹮、川金丝猴、羚牛" privacy="private">
                <div className="row row-4 wrap" style={{ alignItems: 'center' }}>
                  {activePet.id ? <Pet
                    petId={activePet.id}
                    loadout={petCatalog.find((p) => p.id === activePet.id)?.loadout ?? {}}
                    size={120}
                    mood="happy"
                  /> : <span aria-hidden="true" style={{ fontSize: 60 }}>🐾</span>}
                  <div className="grow" style={{ minWidth: 240 }}>
                    <h3 className="card-title">
                      {activePet.name}
                      <span className="tag tag-cinnabar" style={{ marginLeft: 8 }}>
                        {activePet.id ? '同行中' : '未解锁'}
                      </span>
                    </h3>
                    <p className="small muted" style={{ marginTop: 6 }}>
                      {activePet.species} · {activePet.personality} · {activePet.skillLabel}
                    </p>
                    <p className="small muted" style={{ marginTop: 8 }}>
                      「{activePet.lines.greet}」
                    </p>
                    <div className="row row-2 wrap" style={{ marginTop: 'var(--sp-4)' }}>
                      <Link className="btn btn-primary btn-sm" to="/pets">
                        萌宠图鉴与装扮
                      </Link>
                      <span className="tag tag-gold">🪙 {balance} 金币</span>
                      <span className="tag tag-outline">
                        已解锁 {petCatalog.filter((p) => p.unlocked).length}/{petCatalog.length}
                      </span>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {tab === 'coins' && (
              <Section title="金币明细" desc={QUEST_COPY.coinsNoCash} privacy="private">
                <Notice kind="quiet">{QUEST_COPY.petsVirtual}</Notice>

                <div className="row row-2 wrap" style={{ margin: 'var(--sp-4) 0' }}>
                  <span className="tag tag-gold">当前余额 🪙 {balance}</span>
                  <Link className="btn btn-ghost btn-sm" to="/pets">
                    去萌宠页
                  </Link>
                </div>

                {ledger.length === 0 ? (
                  <EmptyState
                    icon="🪙"
                    title="还没有金币记录"
                    desc="完成任务后会有金币入账，这里会显示每一笔的来路与去处。"
                    actions={
                      <Link className="btn btn-primary" to="/tasks">
                        去任务中心
                      </Link>
                    }
                  />
                ) : (
                  <div className="stack stack-2">
                    {ledger.slice(0, 30).map((e) => (
                      <div key={e.id} className="coin-row">
                        <span className={`coin-delta ${e.delta > 0 ? 'plus' : 'minus'}`}>
                          {e.delta > 0 ? '+' : ''}
                          {e.delta}
                        </span>
                        <div className="grow" style={{ minWidth: 0 }}>
                          <p className="small" style={{ fontWeight: 700 }}>
                            {{ complete: '完成任务', unlock: '解锁萌宠', buy: '购买装扮' }[e.reason] ?? e.reason}
                            {e.refType === 'item' && PET_ITEMS_BY_ID[e.refId]
                              ? ` · ${PET_ITEMS_BY_ID[e.refId].name}`
                              : ''}
                          </p>
                          <p className="xs muted">
                            {new Date(e.createdAt).toLocaleString('zh-CN')} · 余额 {e.balanceAfter}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {tab === 'interactions' && (
              <Section
                title="互动记录"
                desc="你点赞与收藏过的内容，仅你自己可见"
                privacy="private"
              >
                {likedPosts.length + savedPosts.length === 0 ? (
                  <EmptyState
                    icon="♡"
                    title="还没有互动记录"
                    desc="在社区里点赞或收藏内容后，会在这里留下记录。"
                    actions={
                      <Link className="btn btn-primary" to="/community">
                        去社区看看
                      </Link>
                    }
                  />
                ) : (
                  <div className="stack stack-6">
                    <div>
                      <p className="label" style={{ marginBottom: 'var(--sp-3)' }}>
                        点赞的内容 · {likedPosts.length}
                      </p>
                      {likedPosts.length === 0 ? (
                        <p className="small muted">还没有点赞过内容。</p>
                      ) : (
                        <div className="stack stack-3">
                          {allPosts
                            .filter((p) => likedPosts.includes(p.id))
                            .map((p) => (
                              <Link key={p.id} to={`/post/${p.id}`} className="record-row">
                                <span className="record-thumb">
                                  <Thumb src={postCoverImage(p)} tone={p.cover} label="" />
                                </span>
                                <span className="grow">
                                  <span
                                    className="clamp-1"
                                    style={{ fontWeight: 600, display: 'block' }}
                                  >
                                    {p.title}
                                  </span>
                                  <span className="xs muted">{topicName(p.topic)}</span>
                                </span>
                                <span className="privacy-chip privacy-private">🔒 仅自己</span>
                              </Link>
                            ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="label" style={{ marginBottom: 'var(--sp-3)' }}>
                        收藏的内容 · {mySavedPosts.length}
                      </p>
                      {mySavedPosts.length === 0 ? (
                        <p className="small muted">还没有收藏过帖子。</p>
                      ) : (
                        <div className="stack stack-3">
                          {mySavedPosts.map((p) => (
                            <Link key={p.id} to={`/post/${p.id}`} className="record-row">
                              <span className="record-thumb">
                                <Thumb src={postCoverImage(p)} tone={p.cover} label="" />
                              </span>
                              <span className="grow">
                                <span
                                  className="clamp-1"
                                  style={{ fontWeight: 600, display: 'block' }}
                                >
                                  {p.title}
                                </span>
                                <span className="xs muted">{topicName(p.topic)}</span>
                              </span>
                              <span className="privacy-chip privacy-private">🔒 仅自己</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Section>
            )}

            {tab === 'avatar' && <AvatarEditor avatarId={avatarId} onChange={setAvatarId} />}

            {tab === 'settings' && (
              <SettingsTab
                profile={profile}
                user={user}
                updateProfile={updateProfile}
                logout={logout}
                toast={toast}
              />
            )}
          </div>
          <ProfilePetPanel pet={petCatalog.find((pet) => pet.active) ?? petCatalog.find((pet) => pet.unlocked)} onUpgradeItem={upgradeItem} balance={balance} />
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   区块包装：统一标题与隐私标识
   ========================================================================== */
function Section({ title, desc, privacy, children }) {
  return (
    <section>
      <div className="row-between wrap row-3" style={{ marginBottom: 'var(--sp-5)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--fs-h2)' }}>{title}</h2>
          {desc && (
            <p className="small muted" style={{ marginTop: 6 }}>
              {desc}
            </p>
          )}
        </div>
        {privacy && (
          <span className={`privacy-chip privacy-${privacy}`}>
            {privacy === 'public' ? '🌐 公开可见' : '🔒 仅自己可见'}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

/* ==========================================================================
   概览
   ========================================================================== */
function Overview({ myPosts, savedAttractions, itinerary, history, drafts, onGo }) {
  const stops = itinerary.days.reduce((n, d) => n + d.items.length, 0)

  return (
    <section>
      <h2 style={{ fontSize: 'var(--fs-h2)', marginBottom: 'var(--sp-5)' }}>概览</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--sp-4)',
          marginBottom: 'var(--sp-6)',
        }}
      >
        <StatCard icon="📝" n={myPosts.length} label="我发布的内容" onClick={() => onGo('posts')} />
        <StatCard
          icon="⭐"
          n={savedAttractions.length}
          label="收藏的景点"
          onClick={() => onGo('saved')}
        />
        <StatCard icon="🗺" n={stops} label="行程中的点位" onClick={() => onGo('trips')} />
        <StatCard icon="🕘" n={history.length} label="浏览记录" onClick={() => onGo('history')} />
      </div>

      {myPosts.length === 0 && savedAttractions.length === 0 && history.length === 0 && (
        <Notice kind="brand" className="mb-4">
          <strong>从这三件事开始：</strong>
          <div className="row row-2 wrap" style={{ marginTop: 10 }}>
            <Link className="btn btn-primary btn-sm" to="/attractions">
              收藏几个景点
            </Link>
            <Link className="btn btn-secondary btn-sm" to="/itinerary">
              创建一个行程
            </Link>
            <Link className="btn btn-secondary btn-sm" to="/publish">
              发布首篇游记
            </Link>
          </div>
        </Notice>
      )}

      {drafts.length > 0 && (
        <Notice kind="info" className="mb-4">
          你有 {drafts.length} 篇草稿还没有发布。
          <Link className="section-link" to={`/publish/${drafts[0].id}`} style={{ marginLeft: 8 }}>
            继续编辑 →
          </Link>
        </Notice>
      )}

      {myPosts.length > 0 && (
        <div style={{ marginTop: 'var(--sp-6)' }}>
          <div className="row-between" style={{ marginBottom: 'var(--sp-4)' }}>
            <h3 style={{ fontSize: 'var(--fs-h3)' }}>最近发布</h3>
            <button className="section-link" onClick={() => onGo('posts')}>
              查看全部 →
            </button>
          </div>
          <PostGrid items={myPosts.slice(0, 3)} />
        </div>
      )}

      {savedAttractions.length > 0 && (
        <div style={{ marginTop: 'var(--sp-8)' }}>
          <div className="row-between" style={{ marginBottom: 'var(--sp-4)' }}>
            <h3 style={{ fontSize: 'var(--fs-h3)' }}>最近收藏</h3>
            <button className="section-link" onClick={() => onGo('saved')}>
              查看全部 →
            </button>
          </div>
          <div className="stack stack-3">
            {savedAttractions.slice(0, 3).map((id) => {
              const a = getAttraction(id)
              if (!a) return null
              return (
                <Link key={id} to={`/attraction/${a.id}`} className="record-row">
                  <span className="record-thumb">
                    <Thumb src={a.image} alt={a.name} tone={a.tone} label="" />
                  </span>
                  <span className="grow">
                    <span style={{ fontWeight: 600, display: 'block' }}>{a.name}</span>
                    <span className="xs muted">
                      {regionName(a.region)} · {a.type}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function StatCard({ icon, n, label, onClick }) {
  return (
    <button className="card card-pad card-hover" onClick={onClick} style={{ textAlign: 'left' }}>
      <div className="row-between">
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 26,
            fontWeight: 700,
            color: 'var(--cinnabar-700)',
          }}
        >
          {n}
        </span>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        {label}
      </p>
    </button>
  )
}

/* ==========================================================================
   虚拟形象编辑
   30 款初始形象 + 自定义外观参数
   ========================================================================== */
function AvatarEditor({ avatarId, onChange }) {
  const { toast } = useApp()

  /* 已保存自定义形象时，打开即落在「自定义」页签 */
  const isPhoto = typeof avatarId === 'object' && !!avatarId?.photoDataUrl
  const isCustom = typeof avatarId === 'object' && avatarId !== null && !isPhoto
  const [mode, setMode] = useState(isPhoto ? 'photo' : isCustom ? 'custom' : 'preset') // preset | custom | photo
  const [presetId, setPresetId] = useState(!isCustom && !isPhoto ? avatarId : 'av-1')
  const [photo, setPhoto] = useState(isPhoto ? avatarId.photoDataUrl : '')
  const [photoInfo, setPhotoInfo] = useState(null)
  const [compressing, setCompressing] = useState(false)
  const [custom, setCustom] = useState(() => {
    if (isCustom) {
      return { hat: avatarId.hat, armor: avatarId.armor, face: avatarId.face, color: avatarId.color }
    }
    const p = getPreset(isPhoto ? 'av-1' : avatarId)
    return { hat: p.hat, armor: p.armor, face: p.face, color: p.color }
  })

  const current = mode === 'photo'
    ? photo ? { photoDataUrl: photo } : getPreset(presetId)
    : mode === 'preset' ? presetId : custom
  const presets = AVATAR_PRESETS.find((p) => p.id === presetId)

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('请选择图片文件', 'warning')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      toast('图片不能超过 12 MB', 'warning')
      return
    }
    try {
      setCompressing(true)
      const image = await compressAvatar(file)
      setPhoto(image.url)
      setPhotoInfo(image)
      setMode('photo')
    } catch (error) {
      toast(error.message || '无法读取这张图片，请换一张试试', 'warning')
    } finally {
      setCompressing(false)
    }
  }

  return (
    <section>
      <div className="row-between wrap row-3" style={{ marginBottom: 'var(--sp-5)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--fs-h2)' }}>虚拟形象</h2>
          <p className="small muted" style={{ marginTop: 6 }}>
            形象会作为你在社区帖子、评论与个人主页中的身份标识
          </p>
        </div>
        <div className="segment">
          <button className={mode === 'preset' ? 'on' : ''} onClick={() => setMode('preset')}>
            初始形象
          </button>
          <button className={mode === 'custom' ? 'on' : ''} onClick={() => setMode('custom')}>
            自定义
          </button>
          <button className={mode === 'photo' ? 'on' : ''} onClick={() => setMode('photo')}>
            {compressing ? '压缩中…' : '上传照片'}
          </button>
        </div>
      </div>

      <div className="avatar-layout">
        {/* 预览 */}
        <div className="avatar-preview">
          <div className="avatar-stage">
            <Avatar variant={current} size={168} />
          </div>

          <h3 style={{ fontSize: 'var(--fs-body-lg)', marginTop: 'var(--sp-5)' }}>
            {mode === 'preset' && presets
              ? presets.name
              : `${HATS[custom.hat].name}·${ARMORS[custom.armor].name}`}
          </h3>
          <p className="xs muted" style={{ marginTop: 6 }}>
            {mode === 'preset' && presets
              ? presets.title
              : `${FACES[custom.face].name} · ${PALETTES[custom.color].name}`}
          </p>

          <div className="stack stack-2" style={{ marginTop: 'var(--sp-5)' }}>
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                if (mode === 'custom') onChange({ ...custom, custom: true })
                else if (mode === 'photo') {
                  if (!photo) { toast('先选择一张照片', 'warning'); return }
                  onChange({ photoDataUrl: photo, photo: true })
                } else onChange(presetId)
                toast('虚拟形象已保存，社区中的展示会同步更新', 'success')
              }}
            >
              保存形象
            </button>
            {mode !== 'photo' && <button
              className="btn btn-secondary btn-block btn-sm"
              onClick={() => {
                const p = AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)]
                if (mode === 'preset') setPresetId(p.id)
                else setCustom({ hat: p.hat, armor: p.armor, face: p.face, color: p.color })
                toast('换了一个，看看合不合眼缘', 'info')
              }}
            >
              🎲 随机一个
            </button>}
          </div>

          <Notice kind="quiet" className="mt-4" >
            照片会裁剪并压缩后保存在当前浏览器，不会自动上传服务器；保存后会显示在个人资料、帖子和评论中。
          </Notice>
        </div>

        {/* 选择区 */}
        <div>
          {mode === 'preset' ? (
            <>
              <p className="label" style={{ marginBottom: 'var(--sp-2)' }}>
                共 {AVATAR_PRESETS.length} 款初始形象
              </p>
              <p className="xs muted" style={{ marginBottom: 'var(--sp-5)' }}>
                形象取自兵马俑的上半身像造型，按头饰、甲胄、面容与配色组合而成。
              </p>

              <div className="avatar-grid">
                {AVATAR_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    className={`avatar-option ${presetId === p.id ? 'on' : ''}`}
                    onClick={() => setPresetId(p.id)}
                    aria-pressed={presetId === p.id}
                    title={`${p.name} · ${p.title}`}
                  >
                    <span style={{ position: 'relative' }}>
                      <span className="avatar-index">{p.index}</span>
                      <Avatar variant={p.id} size={62} />
                    </span>
                    <span className="nm">{p.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : mode === 'photo' ? (
            <div className="card card-pad avatar-upload-panel">
              <p className="label">我的照片</p>
              <p className="xs muted">选择正方形或人像照片，系统会居中裁切并压缩为头像。</p>
              {photo ? <img className="avatar-photo-preview" src={photo} alt="头像照片预览" /> : <div className="avatar-photo-empty">照片预览</div>}
              <label className="btn btn-secondary btn-sm avatar-upload-button">
                <input type="file" accept="image/*" onChange={handlePhoto} />
                选择照片
              </label>
              <p className="xs muted">支持常见图片格式，原图最大 12 MB；上传后自动裁剪压缩，只保存在本机浏览器。</p>
              {photoInfo && <p className="small" role="status">已自动压缩：{Math.ceil(photoInfo.originalBytes / 1024)} KB → {Math.ceil(photoInfo.bytes / 1024)} KB · {photoInfo.width} × {photoInfo.width}</p>}
              {photo && <button className="btn btn-ghost btn-sm" onClick={() => { setPhoto(''); setMode('preset'); setPresetId('av-1') }}>移除照片并改用虚拟形象</button>}
            </div>
          ) : (
            <>
              <p className="label" style={{ marginBottom: 'var(--sp-2)' }}>
                自定义外观
              </p>
              <p className="xs muted" style={{ marginBottom: 'var(--sp-5)' }}>
                调整下面四项参数，左侧预览会实时变化。保存后形象会应用到社区各处。
              </p>

              <div className="card card-pad">
                <OptionRow
                  label="头饰"
                  options={Object.values(HATS)}
                  value={custom.hat}
                  onChange={(v) => setCustom((c) => ({ ...c, hat: v }))}
                />
                <OptionRow
                  label="甲胄"
                  options={Object.values(ARMORS)}
                  value={custom.armor}
                  onChange={(v) => setCustom((c) => ({ ...c, armor: v }))}
                />
                <OptionRow
                  label="面容"
                  options={Object.values(FACES)}
                  value={custom.face}
                  onChange={(v) => setCustom((c) => ({ ...c, face: v }))}
                />

                <div className="param-row">
                  <span className="param-label">主色</span>
                  <div className="param-options">
                    {Object.values(PALETTES).map((p) => (
                      <button
                        key={p.key}
                        className={`swatch ${custom.color === p.key ? 'on' : ''}`}
                        style={{ background: p.armor }}
                        onClick={() => setCustom((c) => ({ ...c, color: p.key }))}
                        aria-label={p.name}
                        title={p.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <Notice kind="info" className="mt-5">
                自定义组合共 {Object.keys(HATS).length * Object.keys(ARMORS).length *
                  Object.keys(FACES).length * Object.keys(PALETTES).length}{' '}
                种可能，够你挑到满意为止。
              </Notice>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function OptionRow({ label, options, value, onChange }) {
  return (
    <div className="param-row">
      <span className="param-label">{label}</span>
      <div className="param-options">
        {options.map((o) => (
          <button
            key={o.key}
            className={`chip ${value === o.key ? 'on' : ''}`}
            onClick={() => onChange(o.key)}
            aria-pressed={value === o.key}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ==========================================================================
   账号设置
   ========================================================================== */
function SettingsTab({ profile, user, updateProfile, logout, toast }) {
  const [name, setName] = useState(profile.name || user?.name || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [region, setRegion] = useState(profile.region || '西安')
  const [errors, setErrors] = useState({})
  const [logoutOpen, setLogoutOpen] = useState(false)

  function save() {
    const e = {}
    if (!name.trim()) e.name = '昵称不能为空'
    else if (name.trim().length > 16) e.name = '昵称最多 16 个字'
    if (bio.length > 60) e.bio = '个人简介最多 60 个字'
    setErrors(e)
    if (Object.keys(e).length) {
      toast('有字段需要修改，请检查标红的部分', 'warning')
      return
    }
    updateProfile({ name: name.trim(), bio: bio.trim(), region })
    toast('资料已保存', 'success')
  }

  return (
    <section>
      <h2 style={{ fontSize: 'var(--fs-h2)', marginBottom: 'var(--sp-5)' }}>账号设置</h2>

      <div className="card card-pad" style={{ marginBottom: 'var(--sp-5)' }}>
        <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-5)' }}>资料编辑</h3>

        <div className="stack stack-5">
          <div className="field">
            <label className="label" htmlFor="nickname">
              昵称<span className="req">*</span>
            </label>
            <input
              id="nickname"
              className={`input ${errors.name ? 'error' : ''}`}
              value={name}
              maxLength={16}
              onChange={(e) => {
                setName(e.target.value)
                setErrors((x) => ({ ...x, name: undefined }))
              }}
            />
            {errors.name ? (
              <p className="field-error">
                <span>⚠</span>
                {errors.name}
              </p>
            ) : (
              <p className="field-hint">昵称会显示在你发布的帖子与评论中</p>
            )}
          </div>

          <div className="field">
            <label className="label" htmlFor="bio">
              个人简介<span className="opt">（选填）</span>
            </label>
            <textarea
              id="bio"
              className={`textarea ${errors.bio ? 'error' : ''}`}
              style={{ minHeight: 90 }}
              value={bio}
              maxLength={60}
              onChange={(e) => {
                setBio(e.target.value)
                setErrors((x) => ({ ...x, bio: undefined }))
              }}
              placeholder="例如：在西安念书第四年，专挑淡季带朋友逛。"
            />
            {errors.bio ? (
              <p className="field-error">
                <span>⚠</span>
                {errors.bio}
              </p>
            ) : (
              <p className="field-hint">{60 - bio.length} 字可用</p>
            )}
          </div>

          <div className="field">
            <label className="label" htmlFor="region">
              常居地<span className="opt">（选填）</span>
            </label>
            <select
              id="region"
              className="select"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              {['西安', '北京', '上海', '成都', '杭州', '武汉', '其他'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="row row-3">
            <button className="btn btn-primary" onClick={save}>
              保存资料
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setName(profile.name || user?.name || '')
                setBio(profile.bio || '')
                setErrors({})
                toast('已还原为上次保存的内容', 'info')
              }}
            >
              还原
            </button>
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 'var(--sp-5)' }}>
        <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-4)' }}>登录方式</h3>
        <div className="stack stack-3">
          <div className="row-between wrap row-3">
            <span>
              <strong className="small">手机号 / 邮箱</strong>
              <br />
              <span className="xs muted">{user?.email || user?.name || '已绑定'}</span>
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => toast('演示环境不提供修改', 'info')}>
              修改
            </button>
          </div>
          <div className="divider" style={{ margin: 0 }} />
          <div className="row-between wrap row-3">
            <span>
              <strong className="small">登录密码</strong>
              <br />
              <span className="xs muted">上次修改：未记录</span>
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => toast('演示环境不提供修改', 'info')}>
              修改密码
            </button>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <h3 style={{ fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--sp-3)' }}>隐私与退出</h3>
        <Notice kind="quiet" className="mb-4">
          你发布的帖子、收藏的景点为<strong>公开内容</strong>，其他游客可见；
          浏览记录、点赞与收藏帖子的记录<strong>仅你自己可见</strong>。
          你可以随时在对应列表里删除内容。
        </Notice>
        <button className="btn btn-secondary btn-danger-text" onClick={() => setLogoutOpen(true)}>
          退出登录
        </button>
      </div>

      {logoutOpen && (
        <Modal
          title="确认退出登录？"
          desc="退出后仍可自由浏览景点与社区内容，但需要重新登录才能收藏、评论、发布与管理行程。"
          onClose={() => setLogoutOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setLogoutOpen(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setLogoutOpen(false)
                  logout()
                }}
              >
                确认退出
              </button>
            </>
          }
        >
          <Notice kind="warn">
            未发布的草稿会保留在本机，重新登录后仍可继续编辑。
          </Notice>
        </Modal>
      )}
    </section>
  )
}
