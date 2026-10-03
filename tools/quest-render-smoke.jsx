/* ==========================================================================
   任务功能 · 渲染冒烟测试（可选，需要 vite 参与编译 JSX）
   --------------------------------------------------------------------------
   node 不能直接解析 .jsx，所以先用 vite 把它编译成 SSR 产物再跑：

     npx vite build --ssr tools/quest-render-smoke.jsx --outDir tools/.smoke
     node tools/.smoke/quest-render-smoke.js

   作用：把新组件真正渲染一遍，能抓到「组件未定义 / 属性写错 / hooks 用法错」
   这类只在运行时才暴露的问题。不依赖任何新依赖（用的就是项目里的 vite）。
   ========================================================================== */

import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

import { AppProvider } from '../src/store/AppContext'
import { QuestProvider } from '../src/store/QuestContext'
import Pet, { PetAvatar } from '../src/components/Pet'
import PreItemPicker from '../src/components/PreItemPicker'
import TaskCard from '../src/components/TaskCard'
import CoinBadge from '../src/components/CoinBadge'
import Quests from '../src/pages/Quests'
import PetsPage from '../src/pages/Pets'
import Notifications from '../src/pages/Notifications'
import { getAttraction } from '../src/data/attractions'
import { PETS } from '../src/data/pets'

let passed = 0
const failures = []

const wrap = (node, route = '/', { withQuest = true } = {}) => {
  const inner = withQuest ? (
    <QuestProvider>
      <MemoryRouter initialEntries={[route]}>{node}</MemoryRouter>
    </QuestProvider>
  ) : (
    <MemoryRouter initialEntries={[route]}>{node}</MemoryRouter>
  )
  return renderToString(<AppProvider>{inner}</AppProvider>)
}

function check(name, fn) {
  try {
    const detail = fn()
    passed += 1
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`)
  } catch (err) {
    failures.push({ name, err })
    console.log(`  ✗ ${name}\n      ${err.message}`)
  }
}

console.log('\n渲染冒烟测试')

/* ---------- 萌宠 SVG：四只都要能画出来，且带装扮也不报错 ---------- */
for (const p of PETS) {
  check(`萌宠 SVG 渲染：${p.name}`, () => {
    const html = renderToString(<Pet petId={p.id} size={120} mood="happy" />)
    if (!html.includes('<svg')) throw new Error('没有渲染出 svg')
    return `${html.length} 字节`
  })
}

check('萌宠头像版渲染（含三层装扮）', () => {
  const html = renderToString(
    <PetAvatar petId="pet-qizai" loadout={{ back: 'it-bamboo-back', outfit: 'it-armor', hat: 'it-leaf-hat' }} />
  )
  if (!html.includes('pet-avatar')) throw new Error('头像容器缺失')
  return '披风 + 甲胄 + 冠饰'
})

check('四只萌宠在未知 id 时回落到默认萌宠', () => {
  const html = renderToString(<Pet petId="pet-not-exist" />)
  if (!html.includes('<svg')) throw new Error('回落失败')
  return '回落正常'
})

/* ---------- 预录项目选择器 ---------- */
check('预录项目选择器渲染（含派生 POI）', () => {
  const a = getAttraction('a1')
  const html = wrap(<PreItemPicker attraction={a} onClose={() => {}} />)
  if (!html.includes('记录想玩的项目')) throw new Error('标题缺失')
  if (!html.includes('一号坑军阵全景')) throw new Error('POI 没有渲染出来')
  return `${a.name} · 含自带 POI`
})

check('未补 pois 的景点也能渲染出派生项目', () => {
  const a = getAttraction('a5')
  const html = wrap(<PreItemPicker attraction={a} onClose={() => {}} />)
  if (!html.includes('可选项目')) throw new Error('区块缺失')
  return `${a.name} · 由亮点派生`
})

/* ---------- 任务卡：未登录必须什么都不渲染 ---------- */
check('未登录时任务卡不出现（非强迫）', () => {
  const html = wrap(<TaskCard />)
  if (html !== '') throw new Error(`未登录却渲染了内容：${html.slice(0, 60)}`)
  return '输出为空'
})

/* ---------- 顶栏小入口 ---------- */
check('未登录时金币入口只给登录引导，不显示余额', () => {
  const html = wrap(<CoinBadge />)
  if (html.includes('🪙')) throw new Error('未登录却显示了金币')
  return '只有入口'
})

/* ---------- 页面 ---------- */
check('行前清单页渲染（未登录走登录引导）', () => {
  const html = wrap(<Quests />, '/quests')
  if (!html.includes('行前清单')) throw new Error('页面标题缺失')
  return `${html.length} 字节`
})

check('萌宠页渲染（未登录走登录引导）', () => {
  const html = wrap(<PetsPage />, '/pets')
  if (!html.includes('登录')) throw new Error('缺少登录引导')
  return `${html.length} 字节`
})

check('消息中心渲染（含任务提醒分类）', () => {
  const html = wrap(<Notifications />, '/notifications')
  if (!html.includes('消息通知')) throw new Error('页面标题缺失')
  return `${html.length} 字节`
})

/* ---------- 汇总 ---------- */
console.log(`\n${'─'.repeat(52)}`)
console.log(`通过 ${passed} 项，失败 ${failures.length} 项`)
if (failures.length) {
  for (const f of failures) console.log(`  · ${f.name}\n    ${f.err.message}`)
  process.exitCode = 1
} else {
  console.log('全部通过。')
}
