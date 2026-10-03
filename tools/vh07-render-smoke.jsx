import assert from 'node:assert/strict'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from '../src/store/AppContext'
import { QuestProvider } from '../src/store/QuestContext'
import { JourneyProvider } from '../src/store/JourneyContext'
import Home from '../src/pages/Home'
import Notebook from '../src/pages/Notebook'
import HeroSlideshow, { HERO_SLIDES, HERO_INTERVAL_MS, HERO_SLIDE_MS } from '../src/components/HeroSlideshow'
import AttractionDetail from '../src/pages/AttractionDetail'
import Community from '../src/pages/Community'
import Profile from '../src/pages/Profile'
import TaskCenter from '../src/pages/TaskCenter'
import Pets from '../src/pages/Pets'
import Itinerary from '../src/pages/Itinerary'
import PlayTrip from '../src/pages/PlayTrip'
import MapView from '../src/pages/MapView'
import Notifications from '../src/pages/Notifications'
import SearchResults from '../src/pages/SearchResults'
import PostEditor from '../src/pages/PostEditor'
import Pet, { composePet } from '../src/components/Pet'
import PetUpgradeModal from '../src/components/PetUpgradeModal'
import { PETS, PET_ITEMS } from '../src/data/pets'
import { makeInternalTestQuestState, INTERNAL_TEST_QUEST_LS_KEY } from '../src/store/questStore'
import { attractions } from '../src/data/attractions'
import { Footer } from '../src/components/ui'

// In-memory fixtures only; no browser/user storage is read or changed.
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
memory.set('changan-banlv-state-v1', JSON.stringify({
  user: { id: 'vh06-render-test', name: '页面测试', isInternalTest: true },
  history: [{ type: 'attraction', id: 'a4', title: '陕西历史博物馆' }],
}))
memory.set(INTERNAL_TEST_QUEST_LS_KEY, JSON.stringify(makeInternalTestQuestState()))
memory.set('changan-journeys-vh05',JSON.stringify({version:1,active:{id:'smoke-session',userId:'vh06-render-test',startedAt:new Date().toISOString(),baselineIds:[],members:[{id:'vh06-render-test',name:'测试伙伴',petId:'pet-qizai'}],trip:{id:'test',title:'回归测试行程',startDate:'2026-10-02',days:[{date:'2026-10-02',items:[{id:'smoke-a6',attractionId:'a6'}]}]}},records:[]}))
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
  const signedInFooter = render('/', '/', <Footer />)
  assert.ok(signedInFooter.includes('账号设置'))
  assert.ok(!signedInFooter.includes('登录注册'))
  assert.ok(signedInFooter.includes('/community?rules=1'))
  const savedAccount = memory.get('changan-banlv-state-v1')
  memory.delete('changan-banlv-state-v1')
  const guestFooter = render('/', '/', <Footer />)
  assert.ok(guestFooter.includes('登录注册'))
  assert.ok(!guestFooter.includes('账号设置'))
  memory.set('changan-banlv-state-v1', savedAccount)
  assert.ok(render('/community?rules=1', '/community', <Community />).includes('社区发布规范'))
  assert.equal(HERO_INTERVAL_MS, 18000)
  assert.equal(HERO_SLIDE_MS, 18000)
  assert.equal(HERO_SLIDES.length, 24)
  assert.equal(new Set(HERO_SLIDES.map(item => item.id)).size, 24)
  assert.equal(HERO_SLIDES[0].id, 'a6')
  const slideshow = renderToString(<HeroSlideshow />)
  assert.equal((slideshow.match(/<img /g) || []).length, 26)
  assert.ok(slideshow.includes('暂停背景轮播'))
  assert.ok(slideshow.includes('images/attractions/a6.jpg'))
  const home = render('/', '/', <Home onOpenSearch={() => {}} />)
  assert.ok(!home.includes('exploration-board'))
  assert.ok(render('/notebook','/notebook',<Notebook/>).includes('id="exploration-heading">手札</h1>'))
  checks++
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
  for (const tab of ['overview', 'saved', 'history', 'interactions', 'avatar', 'playRecords', 'pets', 'coins', 'settings', 'trips', 'posts']) {
    const html = render(`/profile?tab=${tab}`, '/profile', <Profile />)
    assert.ok(html.length > 1000)
    if (tab === 'history') assert.ok(html.includes('images/attractions/a4.jpg'))
    checks++
  }
  assert.ok(render('/tasks', '/tasks', <TaskCenter />).includes('任务中心'))
  checks++
  for (const [path,element] of [['/pets',<Pets/>],['/itinerary',<Itinerary/>],['/map',<MapView/>],['/notifications',<Notifications/>],['/search?q=城墙',<SearchResults/>],['/publish',<PostEditor/>],['/play/test',<PlayTrip/>]]) { assert.ok(render(path,path.startsWith('/play/')?'/play/:tripId':path.split('?')[0],element).length>300, path); checks++ }
  assert.ok(render('/pets','/pets',<PetUpgradeModal petId='pet-qizai' itemId='it-tang' onClose={()=>{}}/>).includes('使用外观'))
  let variants=0
  for(const item of PET_ITEMS) for(const pet of PETS.filter(p=>!item.petId||item.petId===p.id)) for(const level of [1,2,3]) {
    const art=composePet(pet.id,{[item.slot]:item.id},{[item.id]:level},'test'+variants)
    assert.ok(art.includes('data-item="'+item.id+'"'),item.id)
    assert.ok(art.includes('gear-level-'+level))
    assert.ok(art.includes('pet-arm-right'))
    assert.equal(art.includes('visibility="hidden"'),false)
    const ids=[...art.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]); assert.equal(new Set(ids).size,ids.length)
    variants++
  }
  assert.equal(variants,336)
  assert.ok(renderToString(<Pet petId='pet-zhuhuan'/>).includes('M145 162 Q153'))
  console.log('vh07: 336 clothing-level combinations, unique SVG ids, upgrade modal passed')
  console.log(`vh07-render-smoke: ${checks} pages rendered (home, notebook, 24 attractions, community, 11 profile tabs, tasks, pets, itinerary, map, notifications, search, publish, play)`)
} finally { console.error = originalError; delete globalThis.localStorage }
