/* ==========================================================================
   萌宠数据 · 秦岭四宝
   --------------------------------------------------------------------------
   设计取舍：与 src/components/Avatar.jsx 一脉相承——全部用程序化 SVG 分层
   绘制，不引入任何图片资源。理由：素材版权可控、体积为零、装扮可以按层
   叠加（back / outfit / hat），与虚拟形象的实现方式保持一致。

   四只萌宠各有性格与擅长方向，任务卡的话术按萌宠风格取词：
   - 七仔  棕色大熊猫：憨厚治愈，擅长鼓励
   - 朱鹮           ：优雅温柔，擅长推荐拍照点
   - 川金丝猴       ：活泼好动，擅长推荐游玩项目
   - 羚牛           ：憨厚可靠，擅长推荐休息点与美食
   ========================================================================== */

import { SCENIC_COSTUMES } from './vh02Config.js'

export const PETS = [
  {
    id: 'pet-qizai',
    name: '七仔',
    species: '棕色大熊猫',
    subtitle: '世界唯一的棕色大熊猫，来自秦岭',
    isDefault: false,
    unlockCost: null,
    skill: '鼓励',
    skillLabel: '擅长陪着你慢慢走',
    personality: '憨厚治愈',
    palette: { main: '#8C6136', sub: '#F3E7D3', accent: '#5E3F1F', dark: '#3B2712' },
    traits: ['慢悠悠', '爱说“咱”', '不催人'],
    upgradeLevels: [
      { level: 1, name: '同行新手', effect: '基础形象与全部基础互动' },
      { level: 2, name: '慢游搭子', effect: '亮眼细节与专属亲昵动作' },
      { level: 3, name: '长安老友', effect: '精致名牌与互动时专属特效' },
    ],
    lines: {
      greet: '咱不急，今天想看什么就看什么。',
      suggest: '先绕着看一圈，心里就有数了。',
      photo: '拍照别站正中间，往旁边挪两步更好看。',
      queue: '队太长了咱就先看别的，回头再来也一样。',
      weather: '天变了就换室内的，别硬撑。',
      rest: '走这么久，坐一会儿吧，咱等你。',
      food: '找家开得久的小店，比排长队稳当。',
      activity: '能上手试的就去试试，看一眼和做一次不一样。',
      care: '带着孩子就慢点走，少去一个地方也没关系。',
      record: '写一句就行，往后翻着看挺有意思。',
      prepare: '明天要去的，今晚顺手看一眼开放时间。',
      complete: '做到了，挺好。给你留了点金币。',
      snooze: '行，待会儿再说，咱记着。',
      dismissToday: '今天不提了，你好好玩。',
      notInterested: '知道了，这类以后少跟你说。',
      skip: '不做也没事，本来就是可做可不做。',
      unlock: '往后咱一起逛长安。',
      lowCoins: '金币还不够，慢慢攒，不急这一会儿。',
      off: '提醒关掉了，清单和金币都还在。',
    },
  },
  {
    id: 'pet-zhuhuan',
    name: '朱鹮',
    species: '朱鹮',
    subtitle: '从七只到万只，秦岭飞出的东方宝石',
    isDefault: false,
    unlockCost: null,
    skill: '拍照',
    skillLabel: '擅长推荐拍照点与光线',
    personality: '优雅温柔',
    palette: { main: '#F2EDE4', sub: '#E8A9A0', accent: '#C4574C', dark: '#5A3230' },
    traits: ['轻声细语', '讲究光线', '爱看细节'],
    upgradeLevels: [
      { level: 1, name: '同行新手', effect: '基础形象与全部基础互动' },
      { level: 2, name: '光影向导', effect: '亮眼细节与专属亲昵动作' },
      { level: 3, name: '朱羽知音', effect: '精致名牌与互动时专属特效' },
    ],
    lines: {
      greet: '今天的风很轻，适合慢慢看。',
      suggest: '先不急着按快门，等一等人群散开。',
      photo: '侧逆光的位置最柔和，往那边站一点。',
      queue: '排得久的时候，不如先去别处取几个角度。',
      weather: '落雨时屋檐与水面会有好看的倒影。',
      rest: '找一处能坐下的廊下，看人来人往也很好。',
      food: '安静的小院常常比临街的铺子更从容。',
      activity: '若是遇到讲解，值得停下来听一段。',
      care: '同行的人累了，就先歇着，风景不会跑。',
      record: '把当时的天气也写下来，日后一读就回去了。',
      prepare: '明日的开放时间，今晚看一眼更安心。',
      complete: '很美的一刻，留住了。金币请收下。',
      snooze: '好，那过一会儿再同你说。',
      dismissToday: '今日便不提了，愿你看得尽兴。',
      notInterested: '明白了，这一类我就不再说了。',
      skip: '跳过也是好选择，本就不必勉强。',
      unlock: '很高兴与你同行。',
      lowCoins: '金币尚缺一些，不急，慢慢来。',
      off: '提醒已歇下，你的清单与金币都在。',
    },
  },
  {
    id: 'pet-jinsihou',
    name: '川金丝猴',
    species: '川金丝猴',
    subtitle: '秦岭林间的金色跳跃者',
    isDefault: false,
    unlockCost: null,
    skill: '游玩',
    skillLabel: '擅长推荐体验项目',
    personality: '活泼好动',
    palette: { main: '#E0A33F', sub: '#F7E3B8', accent: '#3F6E8C', dark: '#4A331A' },
    traits: ['语速快', '爱蹦跳', '点子多'],
    upgradeLevels: [
      { level: 1, name: '同行新手', effect: '基础形象与全部基础互动' },
      { level: 2, name: '探索小队长', effect: '亮眼细节与专属亲昵动作' },
      { level: 3, name: '秦岭探路王', effect: '精致名牌与互动时专属特效' },
    ],
    lines: {
      greet: '来了来了！今天想去哪儿玩？',
      suggest: '先去最想看的那个，趁人还没堆起来！',
      photo: '快！这个角度现在没人，冲！',
      queue: '队太长啦，那边有个冷门的，先去！',
      weather: '下雨？正好去展厅，还能躲一躲！',
      rest: '歇五分钟也行，我刚才跳太久了。',
      food: '这条街往里走三家，那家排队的少还好吃！',
      activity: '这个能动手！一定得试一次！',
      care: '小朋友跟紧点，人多的地方别走散！',
      record: '写一句！就一句！写完好继续玩。',
      prepare: '明天的票约了没？看一眼！',
      complete: '干得漂亮！金币拿去拿去！',
      snooze: '行行行，一会儿我再喊你！',
      dismissToday: '那今天不吵你了，玩得开心！',
      notInterested: '收到！这类以后不喊了。',
      skip: '跳过跳过，本来也不用都做！',
      unlock: '以后我跟着你跑！',
      lowCoins: '还差一点点！再做两个任务就够了！',
      off: '提醒关啦，我想出来玩就看看清单。',
    },
  },
  {
    id: 'pet-lingniu',
    name: '羚牛',
    species: '羚牛',
    subtitle: '秦岭高处的沉稳大家伙',
    isDefault: false,
    unlockCost: null,
    skill: '休息与吃食',
    skillLabel: '擅长推荐休息点与吃的',
    personality: '憨厚可靠',
    palette: { main: '#C8A96B', sub: '#EDE0C4', accent: '#6B5A3A', dark: '#3E3322' },
    traits: ['话少', '实在', '看天色'],
    upgradeLevels: [
      { level: 1, name: '同行新手', effect: '基础形象与全部基础互动' },
      { level: 2, name: '稳稳向导', effect: '亮眼细节与专属亲昵动作' },
      { level: 3, name: '秦岭老伙计', effect: '精致名牌与互动时专属特效' },
    ],
    lines: {
      greet: '来了。慢慢走，别赶。',
      suggest: '挑一个重点看透，比全跑一遍强。',
      photo: '风大就别站边上。',
      queue: '排长队不值当，换个门进。',
      weather: '要变天了，把室内的放前面。',
      rest: '坐下。喝水。',
      food: '面食顶饿，先吃饱再走。',
      activity: '想试就试，别犹豫。',
      care: '带孩子少排一个点。',
      record: '一句话，记下来。',
      prepare: '睡前看一眼明天的开放时间。',
      complete: '不错。金币收好。',
      snooze: '嗯，回头说。',
      dismissToday: '今天不说了。',
      notInterested: '好，这类不提了。',
      skip: '不做就不做。',
      unlock: '一起走。',
      lowCoins: '金币不够，再攒攒。',
      off: '提醒关了。东西都在。',
    },
  },
]

/* --------------------------------------------------------------------------
   萌宠装扮（对应后台 pet_items）
   slot：back 披风 / outfit 外袍 / hat 冠饰，渲染时按层叠加
   price：只能用任务金币购买，无任何充值入口
   -------------------------------------------------------------------------- */

export const PET_ITEMS = [
  /* 通用两件：所有萌宠都可穿 */
  { id: 'it-tang', name: '唐装圆领袍', slot: 'outfit', style: 'tang', petId: null, price: 40, desc: '唐制圆领袍，配幞头更精神。' },
  { id: 'it-armor', name: '兵马俑盔甲', slot: 'outfit', style: 'armor', petId: null, price: 80, desc: '照着俑坑里的甲片做的，穿上很威风。' },

  /* 每只萌宠的专属冠饰与披风 */
  { id: 'it-leaf-hat', name: '竹叶小帽', slot: 'hat', style: 'leaf', petId: 'pet-qizai', price: null, acquisition: 'activity', desc: '秦岭箭竹的叶子编的，戴着凉快。' },
  { id: 'it-bamboo-back', name: '竹影披风', slot: 'back', style: 'bamboo', petId: 'pet-qizai', price: null, acquisition: 'core', desc: '走过竹林时像披了一层影子。' },

  { id: 'it-feather-hat', name: '云羽冠', slot: 'hat', style: 'feather', petId: 'pet-zhuhuan', price: null, acquisition: 'activity', desc: '几片轻羽，风一吹会动。' },
  { id: 'it-cloud-back', name: '朱羽披风', slot: 'back', style: 'cloud', petId: 'pet-zhuhuan', price: null, acquisition: 'core', desc: '取朱鹮翅下那一抹朱色。' },

  { id: 'it-vine-hat', name: '金藤冠', slot: 'hat', style: 'vine', petId: 'pet-jinsihou', price: null, acquisition: 'activity', desc: '林间老藤绕成的，蹦跳也不掉。' },
  { id: 'it-vine-back', name: '藤蔓披风', slot: 'back', style: 'vineback', petId: 'pet-jinsihou', price: null, acquisition: 'core', desc: '从树上一路荡过来的痕迹。' },

  { id: 'it-rock-hat', name: '岩角冠', slot: 'hat', style: 'rock', petId: 'pet-lingniu', price: null, acquisition: 'activity', desc: '像山顶的岩脊，稳稳的。' },
  { id: 'it-rock-back', name: '山岩披风', slot: 'back', style: 'rockback', petId: 'pet-lingniu', price: null, acquisition: 'core', desc: '厚实，挡风。' },
  ...SCENIC_COSTUMES,
]

/* --------------------------------------------------------------------------
   查询工具
   -------------------------------------------------------------------------- */

export const PETS_BY_ID = PETS.reduce((m, p) => {
  m[p.id] = p
  return m
}, {})

export const PET_ITEMS_BY_ID = PET_ITEMS.reduce((m, i) => {
  m[i.id] = i
  return m
}, {})

export const DEFAULT_PET_ID = 'pet-qizai'

export const getPet = (id) => PETS_BY_ID[id] ?? null

export const getPetItem = (id) => PET_ITEMS_BY_ID[id] ?? null

/* 某只萌宠可用的装扮：通用件 + 该物种专属件（不代表均可购买） */
export const itemsForPet = (petId) =>
  PET_ITEMS.filter((i) => i.petId === null || i.petId === petId)

/* 取话术：找不到对应萌宠或键时，回落到默认萌宠，再回落到空串 */
export function petLine(petId, key) {
  if (!petId) return {
    greet: '按自己的节奏逛西安。', suggest: '这是一条自愿提醒，不想做就跳过。',
    photo: '留一张自己喜欢的照片即可，不会自动上传。', complete: '任务已记录。',
    snooze: '好的，稍后再说。', skip: '已跳过，不影响行程。',
    dismissToday: '今天不再提醒。', notInterested: '这类提醒会减少。',
  }[key] ?? '按自己的节奏走，任务可随时跳过。'
  const pet = getPet(petId) ?? getPet(DEFAULT_PET_ID)
  return pet?.lines?.[key] ?? getPet(DEFAULT_PET_ID)?.lines?.[key] ?? ''
}
