/* ==========================================================================
   任务化提醒 · 配置中心
   --------------------------------------------------------------------------
   说明：本项目无后端，「后台可配置」以本文件作为配置快照落地。
   将来接入后台时，本文件导出的每个常量都对应后台的一张配置表，
   字段名保持一致，前端只需把常量换成接口返回值（见 docs/quest/API.md）。

   原则：
   1. 所有数值（奖励、频率、冷却、静音上限）集中在此，代码里不写魔法数字。
   2. 一切提醒都可关闭：DEFAULT_PREFS.featureEnabled 为总开关。
   3. 不做负反馈：没有扣币、降权、催办的配置项，结构上杜绝。
   ========================================================================== */

export const QUEST_CONFIG_VERSION = 2

/* --------------------------------------------------------------------------
   一、默认偏好（可被用户修改后存 localStorage；对应后台 user_quest_prefs）
   -------------------------------------------------------------------------- */

export const DEFAULT_PREFS = {
  featureEnabled: true, // 灰度总开关：关闭后不生成任何任务卡与提醒
  remindEnabled: true, // 提醒开关：只关提醒，不清空已获得的清单与金币
  maxPerDay: 2, // 每日最多提醒次数（每次仍只出 1 张卡）
  cooldownMin: 45, // 两次提醒之间的最小间隔（分钟）
  quietHours: [22, 8], // 安静时段 [起, 止)，跨零点：22:00–08:00 不提醒
  mutedCategories: [], // 不感兴趣的类别（长期降权，可在界面上撤销）
  mutedTemplates: [], // 不感兴趣的具体任务模板
  maxSurfacesPerTemplate: 3, // 同一模板最多出现次数，达到后自动静音
  allowLocation: true, // 是否允许基于位置的提醒（演示环境为模拟位置）
  showSafetyTip: true, // 任务卡是否显示安全提示
}

/* --------------------------------------------------------------------------
   二、预录项目：分类、优先级、期望时间
   -------------------------------------------------------------------------- */

export const PRE_ITEM_CATEGORIES = [
  { key: 'spot', label: '想玩', icon: '🏛', hint: '必看的展馆、遗址、院落' },
  { key: 'photo', label: '想拍', icon: '📷', hint: '出片的机位、光线、角度' },
  { key: 'activity', label: '想体验', icon: '🎭', hint: '演出、手作、讲解、互动' },
  { key: 'food', label: '想吃', icon: '🥢', hint: '本地吃食与歇脚处' },
]

export const PRIORITIES = [
  { key: 'high', label: '必去', weight: 3 },
  { key: 'mid', label: '想去', weight: 2 },
  { key: 'low', label: '随缘', weight: 1 },
]

export const TIME_SLOTS = ['不限', '上午', '中午', '下午', '傍晚', '夜晚']

/* 时段与小时的对应关系，供触发引擎判断「现在是否合适」 */
export const TIME_SLOT_HOURS = {
  上午: [8, 11],
  中午: [11, 14],
  下午: [14, 17],
  傍晚: [17, 19],
  夜晚: [19, 22],
}

/* --------------------------------------------------------------------------
   三、任务模板（对应后台 task_templates）
   --------------------------------------------------------------------------
   字段：
   - category     任务类别，用于用户「不感兴趣」时整类静音
   - preCategories 适合哪类预录项目；空数组表示与预录项目无关的通用任务
   - trigger      触发条件，见 TRIGGER_TYPES
   - steps        任务步骤（任务卡上逐条显示，最多 3 条）
   - condition    完成条件（怎么算完成，写清楚，避免用户猜）
   - difficulty   难度，决定金币数（见 DIFFICULTY_COINS）
   - verify       完成校验方式：manual 手动确认 / location 位置 / scan 扫码
   - petLineKey   萌宠话术的键（各萌宠有各自的说话风格）
   - safetyTip    安全提示，可空
   -------------------------------------------------------------------------- */

export const TRIGGER_TYPES = {
  time: '到点了', // 进入某个时段
  location: '到附近了', // 进入景点所在区域
  weather: '天气合适', // 天气条件匹配
  queue: '排队偏长', // 排队超过阈值，给替代方案
  duration: '待久了', // 在园时长达到阈值，提示休息
}

export const DIFFICULTY_COINS = { easy: 5, normal: 10, hard: 20 }

export const TASK_TEMPLATES = [
  {
    id: 't-first-look',
    title: '先建立整体印象',
    category: 'sight',
    preCategories: ['spot'],
    desc: '刚到一处大的遗址或展馆时，先走一圈看全貌，再回头细看，顺序感会好很多。',
    steps: ['先走到最开阔的位置看整体', '用一句话记下第一印象', '再决定细看哪一处'],
    condition: '看完整体并记下一句印象即可',
    trigger: { type: 'time', params: { slots: ['上午', '下午'] } },
    difficulty: 'easy',
    verify: 'manual',
    petLineKey: 'suggest',
    safetyTip: '',
    cooldownMin: 120,
    enabled: true,
  },
  {
    id: 't-photo-spot',
    title: '找到你的机位',
    category: 'photo',
    preCategories: ['photo'],
    desc: '人多的时候，往侧面走两步往往比正面更好拍。',
    steps: ['绕开正面人群，找侧面或斜角', '蹲低一点，让建筑占满上半幅', '拍 3 张不同角度'],
    condition: '拍到 1 张自己满意的照片',
    trigger: { type: 'location', params: {} },
    difficulty: 'easy',
    verify: 'manual',
    petLineKey: 'photo',
    safetyTip: '在水边、台阶、城墙上拍照时留意脚下，不要退到边缘。',
    cooldownMin: 90,
    enabled: true,
  },
  {
    id: 't-photo-golden',
    title: '等一等傍晚的光',
    category: 'photo',
    preCategories: ['photo'],
    desc: '日落前一小时的光最柔和，同一处景会好看很多。',
    steps: ['提前 20 分钟找好位置', '等太阳压低再按快门'],
    condition: '在傍晚时段完成一次拍摄',
    trigger: { type: 'time', params: { slots: ['傍晚'] } },
    difficulty: 'easy',
    verify: 'manual',
    petLineKey: 'photo',
    safetyTip: '',
    cooldownMin: 180,
    enabled: true,
  },
  {
    id: 't-queue-swap',
    title: '队伍太长，先看别的',
    category: 'queue',
    preCategories: ['spot', 'activity'],
    desc: '队排得久时，先去看同一景点里人少的点位，回头再排，通常更省时间。',
    steps: ['先看一下旁边哪个点位人少', '去那边看完再回来', '回来时队伍通常短一些'],
    condition: '换点位看完一处内容',
    trigger: { type: 'queue', params: { minWaitMin: 30 } },
    difficulty: 'normal',
    verify: 'manual',
    petLineKey: 'queue',
    safetyTip: '',
    cooldownMin: 60,
    enabled: true,
  },
  {
    id: 't-rain-indoor',
    title: '下雨了，换个室内的',
    category: 'weather',
    preCategories: ['spot'],
    desc: '雨天优先去展厅、遗址厅这类室内点位，等雨小了再走室外。',
    steps: ['先找最近的室内展厅', '把室外段落挪到雨后'],
    condition: '完成一次室内点位的游览',
    trigger: { type: 'weather', params: { kinds: ['小雨', '大雨'] } },
    difficulty: 'easy',
    verify: 'manual',
    petLineKey: 'weather',
    safetyTip: '雨天地面湿滑，台阶与石板路请慢行。',
    cooldownMin: 120,
    enabled: true,
  },
  {
    id: 't-rest',
    title: '该歇一会儿了',
    category: 'rest',
    preCategories: [],
    desc: '连续走了很久，找个地方坐一会儿，后面的行程反而更顺。',
    steps: ['找一处可以坐下的地方', '喝水、缓一缓', '再决定下一站去哪'],
    condition: '休息 10 分钟以上',
    trigger: { type: 'duration', params: { minMinutes: 150 } },
    difficulty: 'easy',
    verify: 'manual',
    petLineKey: 'rest',
    safetyTip: '夏天注意补水和防晒，冬天注意保暖。',
    cooldownMin: 150,
    enabled: true,
  },
  {
    id: 't-food-local',
    title: '尝一口本地的',
    category: 'food',
    preCategories: ['food'],
    desc: '不一定要去排长队的名店，附近开了很多年的小店通常更稳。',
    steps: ['选一样你没吃过的本地吃食', '记下店名与大致位置'],
    condition: '吃到一样预录清单里的本地吃食',
    trigger: { type: 'time', params: { slots: ['中午', '傍晚'] } },
    difficulty: 'normal',
    verify: 'manual',
    petLineKey: 'food',
    safetyTip: '注意饮食卫生，肠胃敏感的话少试生冷。',
    cooldownMin: 240,
    enabled: true,
  },
  {
    id: 't-activity-handson',
    title: '动手试一次',
    category: 'sight',
    preCategories: ['activity'],
    desc: '讲解、手作、拓印这类体验，看一眼和亲手做一次完全是两回事。',
    steps: ['确认场次与位置', '参与一次体验', '记下感受'],
    condition: '完成一次预录清单里的体验项目',
    trigger: { type: 'location', params: {} },
    difficulty: 'hard',
    verify: 'manual',
    petLineKey: 'activity',
    safetyTip: '',
    cooldownMin: 240,
    enabled: true,
  },
  {
    id: 't-one-detail',
    title: '挑一件细看',
    category: 'sight',
    preCategories: ['spot'],
    desc: '大场馆里挑一件你最感兴趣的，看它的介绍牌，比走马观花记得住。',
    steps: ['选一件最吸引你的展品', '读完整块介绍牌', '记住它的名字'],
    condition: '记住一件展品的名字与来历',
    trigger: { type: 'time', params: { slots: ['上午', '下午'] } },
    difficulty: 'easy',
    verify: 'manual',
    petLineKey: 'suggest',
    safetyTip: '',
    cooldownMin: 120,
    enabled: true,
  },
  {
    id: 't-kid-pace',
    title: '带孩子就慢一点',
    category: 'family',
    preCategories: [],
    desc: '带小朋友时，把一天的点位减到 2 个，中间留出休息和吃东西的时间。',
    steps: ['把当天点位减到 2 个', '中间安排一次休息'],
    condition: '按更松的节奏走完半天',
    trigger: { type: 'duration', params: { minMinutes: 90 } },
    difficulty: 'normal',
    verify: 'manual',
    petLineKey: 'care',
    safetyTip: '在人多处牵好小朋友，约定走散后的集合点。',
    cooldownMin: 180,
    enabled: true,
  },
  {
    id: 't-write-note',
    title: '写一句给自己的记录',
    category: 'record',
    preCategories: [],
    desc: '不用写给别人看，一句话就够，回头翻的时候会很有意思。',
    steps: ['写下今天最有印象的一件事'],
    condition: '写下一句记录',
    trigger: { type: 'time', params: { slots: ['夜晚'] } },
    difficulty: 'easy',
    verify: 'manual',
    petLineKey: 'record',
    safetyTip: '',
    cooldownMin: 720,
    enabled: true,
  },
  {
    id: 't-verify-plan',
    title: '顺手核实一下明天',
    category: 'prepare',
    preCategories: [],
    desc: '开放时间与预约规则会变，出发前看一眼官方渠道，比到了门口才发现要好。',
    steps: ['打开明天要去景点的官方渠道', '确认开放时间与是否需预约', '必要时调整出发时间'],
    condition: '完成一次信息核实',
    trigger: { type: 'time', params: { slots: ['夜晚'] } },
    difficulty: 'easy',
    verify: 'manual',
    petLineKey: 'prepare',
    safetyTip: '',
    cooldownMin: 720,
    enabled: true,
  },
]

/* 任务类别清单，供偏好设置里做「整类不感兴趣」 */
export const TASK_CATEGORIES = [
  { key: 'sight', label: '游览' },
  { key: 'photo', label: '拍照' },
  { key: 'food', label: '吃食' },
  { key: 'rest', label: '休息' },
  { key: 'queue', label: '排队调整' },
  { key: 'weather', label: '天气应对' },
  { key: 'family', label: '亲子节奏' },
  { key: 'record', label: '记录' },
  { key: 'prepare', label: '出行准备' },
]

/* --------------------------------------------------------------------------
   四、演示用场景（本项目无真实定位与排队数据，用可切换的场景模拟）
   -------------------------------------------------------------------------- */

export const SCENE_WEATHER = ['晴', '多云', '小雨', '大雨', '高温', '寒冷']
export const SCENE_QUEUE = [
  { key: 'free', label: '基本没队', waitMin: 0 },
  { key: 'normal', label: '排一会儿', waitMin: 15 },
  { key: 'long', label: '排 30 分钟以上', waitMin: 40 },
  { key: 'verylong', label: '排 1 小时以上', waitMin: 70 },
]

/* --------------------------------------------------------------------------
   五、文案与安全
   -------------------------------------------------------------------------- */

export const QUEST_COPY = {
  entryTitle: '任务中心',
  entryDesc: '把想玩、想拍、想体验的先记下来，到了地方再决定要不要做。',
  nonForcing: '任务只是提醒，不做也完全没关系：不扣金币、不降权、不会反复催你。',
  coinsNoCash: '金币只能用任务获得，不能充值、不能提现、不能换现金。',
  petsVirtual: '萌宠与装扮都是虚拟内容，只是游览途中的一点乐趣。',
  demoLocation: '演示环境使用模拟位置，不会读取你的真实定位。',
  offHint: '提醒已关闭。清单、金币与萌宠都还在，随时可以再打开。',
  emptyTasks: '还没有任务记录。记录几个想玩的项目，到合适的时间才会有提醒。',
}

/* 焦虑词与不合规词：任务卡文案、自定义清单名称都会过一遍这道词表 */
export const BLOCKED_WORDS = [
  '还剩',
  '已错过',
  '错过就',
  '最后机会',
  '限时',
  '赶紧',
  '必须马上',
  '再不',
  '快来完成',
  '马上过期',
  '过期作废',
  '不完成就',
  '充值',
  '提现',
  '返现',
  '现金',
  '刷单',
  '代购',
  '转账',
  '加微信',
  '私聊',
]

/* 校验文本是否包含被拦截词，返回命中的词（无则返回 null） */
export function findBlockedWord(text) {
  if (!text) return null
  const s = String(text)
  return BLOCKED_WORDS.find((w) => s.includes(w)) ?? null
}
