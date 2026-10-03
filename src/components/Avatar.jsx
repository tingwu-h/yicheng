import { useId } from 'react'

/* ==========================================================================
   虚拟形象 · 程序化兵马俑上半身像
   --------------------------------------------------------------------------
   按四个维度参数化绘制，组合出 30 款初始形象：
     · 头饰 8 种  武冠 / 进贤冠 / 巾帻 / 发髻 / 鹖冠 / 幞头 / 束发 / 将军盔
     · 甲胄 6 种  鱼鳞甲 / 山文甲 / 扎甲 / 玄甲 / 布衣 / 战袍
     · 面容 5 种  无须 / 短髭 / 八字须 / 长髯 / 络腮
     · 主色 4 种  赭石 / 黛青 / 鎏金 / 玄黑
   形象在社区帖子、评论和个人主页中作为身份标识使用。
   ========================================================================== */

/* ---------- 配色 ---------- */
export const PALETTES = {
  zheshi: {
    key: 'zheshi',
    name: '赭石',
    armor: '#A6553A',
    armorDark: '#7F3E28',
    armorLight: '#C87F58',
    accent: '#E0B071',
  },
  daiqing: {
    key: 'daiqing',
    name: '黛青',
    armor: '#2F4F58',
    armorDark: '#223A42',
    armorLight: '#4C7480',
    accent: '#9CC0C7',
  },
  liujin: {
    key: 'liujin',
    name: '鎏金',
    armor: '#C09A2E',
    armorDark: '#95741C',
    armorLight: '#DDBB55',
    accent: '#F2E1A8',
  },
  xuanhei: {
    key: 'xuanhei',
    name: '玄黑',
    armor: '#413C36',
    armorDark: '#2B2723',
    armorLight: '#5E574F',
    accent: '#A79E92',
  },
}

const SKIN = '#E9CDA9'
const SKIN_SHADE = '#D9B48D'
const HAIR = '#2B2320'
const FEATURE = '#3A2E28'
const TORSO = 'M16 100 C16 79 28 66 50 66 C72 66 84 79 84 100 Z'

/* ---------- 头饰 ---------- */
export const HATS = {
  wuguan: { key: 'wuguan', name: '武冠' },
  jinxian: { key: 'jinxian', name: '进贤冠' },
  jinze: { key: 'jinze', name: '巾帻' },
  faji: { key: 'faji', name: '发髻' },
  heguan: { key: 'heguan', name: '鹖冠' },
  futou: { key: 'futou', name: '幞头' },
  shufa: { key: 'shufa', name: '束发' },
  jiangjun: { key: 'jiangjun', name: '将军盔' },
}

/* ---------- 甲胄 ---------- */
export const ARMORS = {
  yulin: { key: 'yulin', name: '鱼鳞甲' },
  shanwen: { key: 'shanwen', name: '山文甲' },
  zhajia: { key: 'zhajia', name: '扎甲' },
  xuanjia: { key: 'xuanjia', name: '玄甲' },
  buyi: { key: 'buyi', name: '布衣' },
  zhanpao: { key: 'zhanpao', name: '战袍' },
}

/* ---------- 面容 ---------- */
export const FACES = {
  clean: { key: 'clean', name: '无须' },
  short: { key: 'short', name: '短髭' },
  bazi: { key: 'bazi', name: '八字须' },
  changran: { key: 'changran', name: '长髯' },
  luosai: { key: 'luosai', name: '络腮' },
}

/* ==========================================================================
   30 款初始形象
   ========================================================================== */

const PRESET_DEFS = [
  ['骠骑', 'wuguan', 'yulin', 'short', 'zheshi'],
  ['校尉', 'wuguan', 'shanwen', 'bazi', 'xuanhei'],
  ['都尉', 'jiangjun', 'yulin', 'luosai', 'liujin'],
  ['司马', 'jinxian', 'buyi', 'clean', 'daiqing'],
  ['参军', 'jinxian', 'buyi', 'short', 'zheshi'],
  ['郎将', 'jiangjun', 'xuanjia', 'luosai', 'xuanhei'],
  ['中郎', 'jinxian', 'zhanpao', 'changran', 'daiqing'],
  ['执戟', 'jinze', 'zhajia', 'bazi', 'zheshi'],
  ['持节', 'heguan', 'shanwen', 'clean', 'liujin'],
  ['司戈', 'jinze', 'yulin', 'short', 'xuanhei'],
  ['旅帅', 'wuguan', 'zhajia', 'bazi', 'zheshi'],
  ['队正', 'shufa', 'buyi', 'clean', 'daiqing'],
  ['果毅', 'wuguan', 'xuanjia', 'luosai', 'xuanhei'],
  ['别将', 'heguan', 'zhajia', 'short', 'liujin'],
  ['折冲', 'jiangjun', 'shanwen', 'luosai', 'daiqing'],
  ['游击', 'futou', 'zhanpao', 'clean', 'xuanhei'],
  ['昭武', 'faji', 'buyi', 'clean', 'zheshi'],
  ['陪戎', 'jinze', 'yulin', 'bazi', 'daiqing'],
  ['仁勇', 'shufa', 'zhajia', 'short', 'liujin'],
  ['翊麾', 'futou', 'zhanpao', 'changran', 'daiqing'],
  ['致果', 'wuguan', 'shanwen', 'luosai', 'liujin'],
  ['怀化', 'faji', 'buyi', 'clean', 'xuanhei'],
  ['归德', 'jinxian', 'zhanpao', 'changran', 'zheshi'],
  ['武骑', 'jiangjun', 'yulin', 'bazi', 'xuanhei'],
  ['云麾', 'heguan', 'xuanjia', 'changran', 'daiqing'],
  ['忠武', 'wuguan', 'yulin', 'luosai', 'zheshi'],
  ['壮武', 'shufa', 'shanwen', 'short', 'xuanhei'],
  ['宣节', 'futou', 'buyi', 'bazi', 'liujin'],
  ['御侮', 'jinze', 'zhajia', 'changran', 'zheshi'],
  ['定远', 'faji', 'zhanpao', 'luosai', 'liujin'],
]

export const AVATAR_PRESETS = PRESET_DEFS.map(
  ([name, hat, armor, face, color], i) => ({
    id: `av-${i + 1}`,
    index: i + 1,
    name,
    hat,
    armor,
    face,
    color,
    // 便于展示的完整称谓，如「武冠·鱼鳞甲」
    title: `${HATS[hat].name}·${ARMORS[armor].name}`,
  })
)

export const DEFAULT_AVATAR = AVATAR_PRESETS[0].id

export const getPreset = (id) =>
  AVATAR_PRESETS.find((p) => p.id === id) || AVATAR_PRESETS[0]

/* ==========================================================================
   绘制：头饰
   ========================================================================== */

function Hat({ hat, pal }) {
  const { armor, armorDark, armorLight, accent } = pal

  switch (hat) {
    case 'wuguan':
      return (
        <>
          <circle cx="50" cy="15.5" r="4.2" fill={accent} />
          <path d="M36 32 C36 22 43 18 50 18 C57 18 64 22 64 32 Z" fill={armor} />
          <rect x="34.5" y="29.5" width="31" height="5" rx="2.5" fill={armorDark} />
        </>
      )
    case 'jinxian':
      return (
        <>
          <path d="M38 31 L42 11 L58 11 L62 31 Z" fill={armor} />
          <path d="M42 11 L58 11 L57 15 L43 15 Z" fill={armorLight} />
          <rect x="35.5" y="29" width="29" height="5" rx="2.5" fill={armorDark} />
        </>
      )
    case 'jinze':
      return (
        <>
          <path d="M35 36 C35 24 42 20 50 20 C58 20 65 24 65 36 Z" fill={armor} />
          <rect x="35" y="29" width="30" height="8" rx="4" fill={armorDark} />
          <path
            d="M63 33 C70 33 72.5 38 69.5 43"
            stroke={armorDark}
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )
    case 'faji':
      return (
        <>
          <circle cx="50" cy="17.5" r="7.2" fill={HAIR} />
          <circle cx="50" cy="17.5" r="3" fill={accent} />
          <path d="M34 34 C34 26 41 23 50 23 C59 23 66 26 66 34 Z" fill={HAIR} />
        </>
      )
    case 'heguan':
      return (
        <>
          <path
            d="M46.5 19 C44 12 41 7.5 36 4.5"
            stroke={accent}
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M53.5 19 C56 12 59 7.5 64 4.5"
            stroke={accent}
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M36 32 C36 23 43 19 50 19 C57 19 64 23 64 32 Z" fill={armor} />
          <rect x="34.5" y="29.5" width="31" height="4.5" rx="2.2" fill={armorDark} />
        </>
      )
    case 'futou':
      return (
        <>
          <path d="M36 33 C36 22 43 18 50 18 C57 18 64 22 64 33 Z" fill={armor} />
          <rect x="34.5" y="30" width="31" height="5" rx="2.5" fill={armorDark} />
          <path
            d="M35 33 C28 33.5 25 38 26.5 43.5"
            stroke={armor}
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M65 33 C72 33.5 75 38 73.5 43.5"
            stroke={armor}
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )
    case 'shufa':
      return (
        <>
          <path d="M34.5 35 C34.5 25 41.5 21 50 21 C58.5 21 65.5 25 65.5 35 Z" fill={HAIR} />
          <rect x="34" y="31.5" width="32" height="4" rx="2" fill={accent} />
        </>
      )
    case 'jiangjun':
      return (
        <>
          <path d="M50 15 L50 4.5" stroke={accent} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="50" cy="4.5" r="3.4" fill={accent} />
          <path d="M34 34 C34 20 42 15 50 15 C58 15 66 20 66 34 Z" fill={armor} />
          <rect x="33" y="31" width="34" height="6" rx="3" fill={armorDark} />
          <path
            d="M34 34 C31 40 30.5 46 32.5 51"
            stroke={armorDark}
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M66 34 C69 40 69.5 46 67.5 51"
            stroke={armorDark}
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )
    default:
      return null
  }
}

/* ==========================================================================
   绘制：甲胄
   ========================================================================== */

function Armor({ armor, pal, clipId }) {
  const { armor: base, armorDark, armorLight, accent } = pal

  // 鱼鳞甲：交错排列的甲片
  const scales = []
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 8; c++) {
      const y = 73 + r * 7.5
      const x = 16 + c * 9 + (r % 2 ? 4.5 : 0)
      scales.push(
        <path
          key={`s${r}-${c}`}
          d={`M${x} ${y} a4.4 4.4 0 0 0 8.8 0`}
          fill="none"
          stroke={armorLight}
          strokeWidth="1.15"
          opacity="0.85"
        />
      )
    }
  }

  // 山文甲：连续山形纹
  const chevrons = []
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 7; c++) {
      const y = 76 + r * 8
      const x = 20 + c * 9 + (r % 2 ? 4.5 : 0)
      chevrons.push(
        <path
          key={`c${r}-${c}`}
          d={`M${x} ${y} l4.5 -5 l4.5 5`}
          fill="none"
          stroke={armorLight}
          strokeWidth="1.2"
          opacity="0.85"
        />
      )
    }
  }

  // 扎甲：横向甲片
  const plates = [73, 80.5, 88, 95.5].map((y) => (
    <rect
      key={`p${y}`}
      x="14"
      y={y}
      width="72"
      height="6"
      rx="1.8"
      fill={armorLight}
      opacity="0.42"
    />
  ))

  const content = () => {
    switch (armor) {
      case 'yulin':
        return (
          <>
            <path d={TORSO} fill={base} />
            <g clipPath={`url(#${clipId})`}>{scales}</g>
            <path d="M38 67 L50 79 L62 67" fill="none" stroke={armorDark} strokeWidth="3" />
          </>
        )
      case 'shanwen':
        return (
          <>
            <path d={TORSO} fill={base} />
            <g clipPath={`url(#${clipId})`}>{chevrons}</g>
            <path d="M38 67 L50 79 L62 67" fill="none" stroke={armorDark} strokeWidth="3" />
          </>
        )
      case 'zhajia':
        return (
          <>
            <path d={TORSO} fill={armorDark} />
            <g clipPath={`url(#${clipId})`}>{plates}</g>
            <path d="M38 67 L50 79 L62 67" fill="none" stroke={base} strokeWidth="3" />
          </>
        )
      case 'xuanjia':
        return (
          <>
            <path d={TORSO} fill={base} />
            <ellipse cx="25" cy="73" rx="12.5" ry="8.5" fill={armorDark} />
            <ellipse cx="75" cy="73" rx="12.5" ry="8.5" fill={armorDark} />
            <rect x="43.5" y="66" width="13" height="34" fill={armorDark} opacity="0.55" />
            <path d="M38 67 L50 77 L62 67" fill="none" stroke={accent} strokeWidth="2" opacity="0.6" />
          </>
        )
      case 'buyi':
        return (
          <>
            <path d={TORSO} fill={base} />
            <path
              d="M38 66.5 L50 84 L62 66.5"
              fill="none"
              stroke={accent}
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path d="M50 84 L50 100" stroke={armorDark} strokeWidth="1.6" opacity="0.5" />
          </>
        )
      case 'zhanpao':
        return (
          <>
            <path d={TORSO} fill={base} />
            <path d="M50 100 L50 66 L84 66 L84 100 Z" fill={armorLight} opacity="0.75" />
            <path d="M50 100 L50 66 L56 66 L56 100 Z" fill={armorDark} opacity="0.6" />
            <rect x="14" y="88.5" width="72" height="6" rx="2" fill={armorDark} />
            <circle cx="50" cy="91.5" r="2.6" fill={accent} />
          </>
        )
      default:
        return <path d={TORSO} fill={base} />
    }
  }

  return content()
}

/* ==========================================================================
   绘制：面容
   ========================================================================== */

function Face({ face }) {
  return (
    <>
      {/* 眉 */}
      <path
        d="M40.5 37.5 q4 -2.6 8 -0.6"
        stroke={FEATURE}
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M59.5 37.5 q-4 -2.6 -8 -0.6"
        stroke={FEATURE}
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
      />

      {/* 眼 */}
      <ellipse cx="44" cy="42" rx="2.1" ry="1.5" fill={FEATURE} />
      <ellipse cx="56" cy="42" rx="2.1" ry="1.5" fill={FEATURE} />

      {/* 鼻 */}
      <path
        d="M50 42.5 L50 47.5"
        stroke={SKIN_SHADE}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M47.6 48.4 q2.4 1.6 4.8 0"
        stroke={FEATURE}
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* 嘴 */}
      <path
        d="M46.5 52.5 q3.5 2.2 7 0"
        stroke={FEATURE}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* 须髯 */}
      {face === 'short' && (
        <path
          d="M43.5 50.2 q6.5 -1.6 13 0"
          stroke={HAIR}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {face === 'bazi' && (
        <>
          <path
            d="M45.5 50.5 C42 50.5 39.5 52 38.5 55"
            stroke={HAIR}
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M54.5 50.5 C58 50.5 60.5 52 61.5 55"
            stroke={HAIR}
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M45 51.5 q5 -1.4 10 0" stroke={HAIR} strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}
      {face === 'changran' && (
        <>
          <path d="M43.5 50.5 q6.5 -1.4 13 0" stroke={HAIR} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path
            d="M43.5 54 C43.5 64 46 73 50 78.5 C54 73 56.5 64 56.5 54 C54 57.5 46 57.5 43.5 54 Z"
            fill={HAIR}
          />
        </>
      )}
      {face === 'luosai' && (
        <>
          <path d="M43.5 50.5 q6.5 -1.4 13 0" stroke={HAIR} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path
            d="M36.5 44 C36.5 60 41 69 50 69 C59 69 63.5 60 63.5 44
               C63.5 54.5 58.5 58.5 50 58.5 C41.5 58.5 36.5 54.5 36.5 44 Z"
            fill={HAIR}
          />
        </>
      )}
    </>
  )
}

/* ==========================================================================
   Avatar 组件
   ========================================================================== */

export default function Avatar({
  variant,
  size = 48,
  ring = false,
  title,
  className = '',
}) {
  const rawId = useId()
  const clipId = `avclip-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`

  // variant 可以是预设对象、预设 id，或自定义参数对象
  const v =
    typeof variant === 'string'
      ? getPreset(variant)
      : variant && (variant.hat || variant.photoDataUrl)
        ? variant
        : getPreset(undefined)

  const pal = PALETTES[v.color] || PALETTES.zheshi
  const label = title ?? (v.name ? `${v.name} · ${v.title ?? ''}` : '虚拟形象')

  if (v.photoDataUrl) {
    return <img
      className={`avatar ${ring ? 'avatar-ring' : ''} ${className}`}
      src={v.photoDataUrl}
      width={size}
      height={size}
      alt={label}
      title={label}
      loading="lazy"
      decoding="async"
    />
  }

  return (
    <svg
      className={`avatar ${ring ? 'avatar-ring' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <defs>
        <clipPath id={clipId}>
          <path d={TORSO} />
        </clipPath>
      </defs>

      {/* 甲胄（躯干） */}
      <Armor armor={v.armor} pal={pal} clipId={clipId} />

      {/* 颈 */}
      <path d="M44 50 L56 50 L57.5 68 L42.5 68 Z" fill={SKIN_SHADE} />

      {/* 头：后发 → 面 → 耳 → 前发 → 头饰 → 五官 */}
      <ellipse cx="50" cy="41" rx="15.2" ry="18.2" fill={HAIR} />
      <ellipse cx="50" cy="42" rx="14" ry="17" fill={SKIN} />
      <ellipse cx="35.8" cy="43" rx="2.5" ry="4" fill={SKIN_SHADE} />
      <ellipse cx="64.2" cy="43" rx="2.5" ry="4" fill={SKIN_SHADE} />

      <path
        d="M35.8 44 C35.8 26 42 22 50 22 C58 22 64.2 26 64.2 44
           C64.2 36 60 31 50 31 C40 31 35.8 36 35.8 44 Z"
        fill={HAIR}
      />

      <Hat hat={v.hat} pal={pal} />
      <Face face={v.face} />
    </svg>
  )
}

/* 带昵称的头像组合，社区各处复用 */
export function AvatarName({ variant, name, sub, size = 38, ring = false }) {
  return (
    <span className="avatar-name">
      <Avatar variant={variant} size={size} ring={ring} />
      <span className="grow">
        <span className="nm">{name}</span>
        {sub && (
          <>
            <br />
            <span className="sub">{sub}</span>
          </>
        )}
      </span>
    </span>
  )
}
