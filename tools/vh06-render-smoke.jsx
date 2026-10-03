import assert from 'node:assert/strict'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from '../src/store/AppContext'
import { QuestProvider } from '../src/store/QuestContext'
import { JourneyProvider } from '../src/store/JourneyContext'
import Home from '../src/pages/Home'
import HeroSlideshow, { HERO_SLIDES, HERO_INTERVAL_MS, HERO_SLIDE_MS } from '../src/components/HeroSlideshow'
import AttractionDetail from '../src/pages/AttractionDetail'
import Community from '../src/pages/Community'
import Profile from '../src/pages/Profile'
import TaskCenter from '../src/pages/TaskCenter'
import { attractions } from '../src/data/attractions'

// In-memory fixtures only; no browser/user storage is read or changed.
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
memory.set('changan-banlv-state-v1', JSON.stringify({
  user: { id: 'vh06-render-test', name: '页面测试' },
  history: [{ type: 'attraction', id: 'a4', title: '陕西历史博物馆' }],
}))
const originalError = console.error
console.error = (...args) => {
  // React Router uses layout effects in the browser; they are expected to be inert in SSR.
  if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) originalError(...args)
}
const render = (path, pattern, element) => renderToString(
  <MemoryRouter initialEntries={[path]}><AppProvider><QuestProvider><JourneyProvider>
    <Routes><Route path={pattern} element={element} /></Routes>
  </JourneyProvider></QuestProvider></AppProvider></MemoryRouter>,
)
let checks = 0
try {
  assert.equal(HERO_INTERVAL_MS, 3000)
  assert.ok(HERO_SLIDE_MS > 0 && HERO_SLIDE_MS < HERO_INTERVAL_MS)
  assert.equal(HERO_SLIDES.length, 24)
  assert.equal(new Set(HERO_SLIDES.map(item => item.id)).size, 24)
  assert.equal(HERO_SLIDES[0].id, 'a6')
  const slideshow = renderToString(<HeroSlideshow />)
  assert.equal((slideshow.match(/<img /g) || []).length, 1)
  assert.ok(slideshow.includes('暂停背景轮播'))
  assert.ok(slideshow.includes('images/attractions/a6.jpg'))
  const home = render('/', '/', <Home onOpenSearch={() => {}} />)
  assert.ok(home.includes('长安探索手札'))
  assert.ok(home.includes('images/attractions/a6.jpg'))
  assert.ok(home.includes('/itinerary?route=r1'))
  checks++
  for (const a of attractions) {
    const html = render(`/attraction/${a.id}`, '/attraction/:id', <AttractionDetail />)
    assert.ok(html.includes(a.name))
    assert.ok(html.includes(a.image), `${a.id}: detail cover missing`)
    checks++
  }
  assert.ok(render('/community', '/community', <Community />).includes('社区广场'))
  checks++
  for (const tab of ['overview', 'saved', 'history', 'interactions', 'avatar', 'playRecords']) {
    const html = render(`/profile?tab=${tab}`, '/profile', <Profile />)
    assert.ok(html.length > 1000)
    if (tab === 'history') assert.ok(html.includes('images/attractions/a4.jpg'))
    checks++
  }
  assert.ok(render('/tasks', '/tasks', <TaskCenter />).includes('任务中心'))
  checks++
  console.log(`vh06-render-smoke: ${checks} pages rendered (home, 24 attractions, community, 6 profile tabs, tasks)`)
} finally { console.error = originalError; delete globalThis.localStorage }
