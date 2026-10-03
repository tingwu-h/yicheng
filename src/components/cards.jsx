import { Link } from 'react-router-dom'
import { Thumb } from './ui'
import Avatar from './Avatar'
import { useApp, useAuthor } from '../store/AppContext'
import { regionName, priceText, regionColor } from '../data/attractions'
import { topicName, topicColor, postCoverImage, routeCoverImage } from '../data/community'

/* ==========================================================================
   景点卡片与帖子卡片
   ========================================================================== */

/* ---------- 景点卡片 ---------- */
export function AttractionCard({ item, onTagClick }) {
  const { isAttractionSaved, toggleSaveAttraction } = useApp()
  const saved = isAttractionSaved(item.id)
  const free = item.ticket?.kind === 'free'

  return (
    <article className="attraction-card">
      <Link to={`/attraction/${item.id}`} className="attraction-media" aria-label={item.name}>
        <Thumb src={item.image} tone={item.tone} label={item.name.slice(0, 4)} alt={item.name} />
        <span className="attraction-region">{regionName(item.region)}</span>
      </Link>

      <button
        className={`fav-btn ${saved ? 'on' : ''}`}
        onClick={(e) => {
          e.preventDefault()
          toggleSaveAttraction(item.id, item.name)
        }}
        aria-label={saved ? `取消收藏${item.name}` : `收藏${item.name}`}
        aria-pressed={saved}
      >
        {saved ? '★' : '☆'}
      </button>

      <div className="attraction-body">
        <Link to={`/attraction/${item.id}`}>
          <h3 className="attraction-name">{item.name}</h3>
        </Link>

        <p className="attraction-desc clamp-2">{item.summary}</p>

        <div className="post-tags">
          <button className="tag tag-link" onClick={() => onTagClick?.('type', item.type)}>
            {item.type}
          </button>
          {item.seasons.slice(0, 2).map((s) => (
            <button
              key={s}
              className="tag tag-link"
              onClick={() => onTagClick?.('season', s)}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="attraction-foot">
          <span className={`price ${free ? 'price-free' : ''}`}>
            {free ? (
              '免费开放'
            ) : (
              <>
                <span className="unit">¥</span>
                {item.ticket.price}
                <span className="unit"> 起</span>
              </>
            )}
          </span>
          <span className="meta">
            <span>★ {item.rating}</span>
            <span className="dot-sep">{item.reviews} 条点评</span>
          </span>
        </div>
      </div>
    </article>
  )
}

export function AttractionGrid({ items, onTagClick }) {
  return (
    <div className="grid-attractions">
      {items.map((item) => (
        <AttractionCard key={item.id} item={item} onTagClick={onTagClick} />
      ))}
    </div>
  )
}

/* ---------- 帖子卡片 ---------- */
export function PostCard({ post }) {
  const { isPostLiked, toggleLike, isPostSaved, toggleSavePost } = useApp()
  const author = useAuthor()
  const a = author(post.author)
  const liked = isPostLiked(post.id)
  const saved = isPostSaved(post.id)

  return (
    <article className="post-card">
      <Link to={`/post/${post.id}`} className="post-media" aria-label={post.title}>
        <Thumb src={postCoverImage(post)} tone={post.cover} label={topicName(post.topic).slice(0, 2)} alt={post.title} />
      </Link>

      <div className="post-body">
        <div className="post-tags">
          <span
            className="tag"
            style={{
              background: `${topicColor(post.topic)}1A`,
              color: topicColor(post.topic),
            }}
          >
            {topicName(post.topic)}
          </span>
          {post.attraction && (
            <Link className="tag tag-outline" to={`/attraction/${post.attraction}`}>
              关联景点
            </Link>
          )}
        </div>

        <Link to={`/post/${post.id}`}>
          <h3 className="post-title clamp-2">{post.title}</h3>
        </Link>

        <p className="post-excerpt clamp-3">{post.excerpt}</p>

        <Link
          to={a.isMe ? '/profile' : `/user/${a.id}`}
          className="avatar-name"
          style={{ pointerEvents: a.isMe ? 'auto' : 'auto' }}
        >
          <Avatar variant={a.avatar} size={32} />
          <span className="nm">{a.name}</span>
        </Link>

        <div className="post-foot">
          <div className="post-stats">
            <button
              className={`stat-btn ${liked ? 'on' : ''}`}
              onClick={() => toggleLike(post.id, post.title)}
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
          </div>

          <button
            className={`stat-btn ${saved ? 'on' : ''}`}
            onClick={() => toggleSavePost(post.id, post.title)}
            aria-pressed={saved}
            aria-label={saved ? '取消收藏' : '收藏'}
          >
            <span>{saved ? '★' : '☆'}</span>
          </button>
        </div>
      </div>
    </article>
  )
}

export function PostGrid({ items }) {
  return (
    <div className="grid-posts">
      {items.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  )
}

/* ---------- 路线卡片（首页） ---------- */
export function RouteCard({ route }) {
  return (
    <Link
      to={`/itinerary?route=${route.id}`}
      className="card card-hover"
      style={{ display: 'block' }}
    >
      <Thumb src={routeCoverImage(route)} tone={route.tone} label="" ratio="16 / 7" alt={route.name}>
        <span className="thumb-corner-label">{route.days} 日</span>
      </Thumb>
      <div className="card-pad">
        <div className="row row-2" style={{ marginBottom: 10 }}>
          <span className="tag tag-cinnabar">{route.theme}</span>
          <span className="tag tag-outline">{route.days} 天</span>
        </div>
        <h3 className="card-title">{route.name}</h3>
        <p className="small muted" style={{ marginTop: 8, lineHeight: 1.65 }}>
          {route.desc}
        </p>
        <p className="xs" style={{ marginTop: 12, color: 'var(--cinnabar-700)', fontWeight: 700 }}>
          含 {route.stops.length} 个点位 · 查看详情 →
        </p>
      </div>
    </Link>
  )
}
