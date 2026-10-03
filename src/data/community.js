/* ==========================================================================
   社区数据：用户、帖子、评论、话题、消息通知
   社区定位为「内容型」：作者主页只展示其发布的内容，不做关注/粉丝关系链。
   ========================================================================== */

export const TOPICS = [
  { key: 'youji', name: '旅行游记', color: '#B2372E' },
  { key: 'gonglue', name: '路线攻略', color: '#C9A227' },
  { key: 'bikeng', name: '避坑经验', color: '#2C4A52' },
  { key: 'daka', name: '拍照打卡', color: '#7A5C8E' },
  { key: 'suigan', name: '即时感受', color: '#6B7F4E' },
]

export const topicName = (key) => TOPICS.find((t) => t.key === key)?.name || ''
export const topicColor = (key) => TOPICS.find((t) => t.key === key)?.color || '#8D8074'

/* ---------- 用户 ---------- */
export const users = [
  {
    id: 'u1',
    name: '秦俑小骠',
    avatar: 'av-1',
    bio: '在西安念书第四年，专挑淡季带朋友逛。把踩过的坑都写下来。',
    joined: '2024-09-12',
    region: '西安',
    posts: 18,
    likes: 1240,
  },
  {
    id: 'u2',
    name: '长安拾遗',
    avatar: 'av-6',
    bio: '博物馆爱好者，喜欢在人少的时段泡展厅。',
    joined: '2023-11-03',
    region: '西安',
    posts: 24,
    likes: 2180,
  },
  {
    id: 'u3',
    name: '一路向西',
    avatar: 'av-21',
    bio: '自驾游爱好者，秦岭北麓跑得比较多。',
    joined: '2024-03-20',
    region: '成都',
    posts: 12,
    likes: 860,
  },
  {
    id: 'u4',
    name: '阿禾',
    avatar: 'av-17',
    bio: '第一次来西安，记录得比较细，希望对后来的人有用。',
    joined: '2026-01-08',
    region: '杭州',
    posts: 6,
    likes: 420,
  },
  {
    id: 'u5',
    name: '城墙根下',
    avatar: 'av-28',
    bio: '本地人，专注讲怎么避开人流。',
    joined: '2023-06-15',
    region: '西安',
    posts: 31,
    likes: 3420,
  },
  {
    id: 'u6',
    name: '拍照的鹿',
    avatar: 'av-22',
    bio: '只关心光线和角度。',
    joined: '2024-07-01',
    region: '武汉',
    posts: 15,
    likes: 1690,
  },
]

export const getUser = (id) => users.find((u) => u.id === id) || users[0]

/* ---------- 帖子 ---------- */
export const posts = [
  {
    id: 'p1',
    title: '兵马俑别上午去！我试了三个时段，下午两点半人最少',
    topic: 'bikeng',
    author: 'u1',
    attraction: 'a1',
    excerpt:
      '官方建议上午开馆就进，但实测下来团队客全挤在 9 点到 11 点。我第二次改成下午两点半进馆，一号坑前排几乎不用等。',
    cover: ['#8C5A3C', '#5E3A26'],
    images: 3,
    likes: 486,
    comments: 62,
    favorites: 210,
    views: 5240,
    createdAt: '2026-09-20',
    featured: true,
    body: [
      '先说结论：如果你不赶行程，兵马俑下午 2:30 之后进馆，体验会明显好过上午。',
      '我第一次是按攻略说的 8:30 开馆就进，结果一号坑最前面那圈护栏已经站满了人，想拍一张没有路人头的照片基本不可能。',
      '第二次我把行程调了一下，上午先去了华清宫，下午两点半再进兵马俑。同样是旺季，一号坑前排等了不到五分钟就轮到了，铜车马展厅也没排队。',
      '原因其实不难理解：大部分一日游团队是「上午兵马俑 + 下午华清宫」的固定顺序，把顺序倒过来就能错开。',
      '另外提醒两点：一是门票必须提前在线约，现场真的不卖；二是馆内光线暗，手机拍照记得关掉自动闪光灯，反光会被工作人员提醒。',
    ],
    commentList: [
      {
        id: 'c1',
        author: 'u5',
        content: '同感。我一般建议别人下午去，上午那波团队客是真顶不住。',
        createdAt: '2026-09-20',
        likes: 48,
        reply: {
          author: 'u1',
          content: '对，尤其是节假日，上午一号坑基本是挪着走的。',
        },
      },
      {
        id: 'c2',
        author: 'u4',
        content: '请问下午去还来得及看华清宫吗？两个都想看的话怎么排？',
        createdAt: '2026-09-21',
        likes: 12,
        reply: {
          author: 'u1',
          content: '来得及，上午华清宫两小时够了，中午在临潼吃个饭，下午两点半进兵马俑正好。',
        },
      },
    ],
  },
  {
    id: 'p2',
    title: '陕博免费票到底怎么抢？连续蹲了四天总结出的规律',
    topic: 'gonglue',
    author: 'u2',
    attraction: 'a4',
    excerpt:
      '免费不免票，名额是真的紧张。试了几天发现放票时间和时段选择都有讲究，整理成一份可操作的清单。',
    cover: ['#7A6A4A', '#4E4230'],
    images: 2,
    likes: 723,
    comments: 94,
    favorites: 512,
    views: 8120,
    createdAt: '2026-09-18',
    featured: true,
    body: [
      '陕博的免费票是预约制，提前放票，热门时段基本是秒没。我连蹲四天，把能踩的点都踩了一遍。',
      '第一，放票是分时段释放的，不是一次性全放。早上那一波最难抢，反而下午场次竞争小很多。',
      '第二，工作日的下午比周末的上午好抢，这个和直觉相反，但实测确实如此。',
      '第三，如果你想看唐代壁画珍品馆，那个是单独收费的，不受免费票名额限制，可以作为备选——真的抢不到免费票时，买这个也能进馆。',
      '第四，周一闭馆，别把行程排在那天，很多人第一次来都会忘。',
      '最后说一句：免费票是实名预约，进场要核验，别想着借别人的名额。',
    ],
    commentList: [
      {
        id: 'c3',
        author: 'u4',
        content: '壁画馆是单独买就能进吗？那我直接买这个是不是就不用抢了',
        createdAt: '2026-09-19',
        likes: 31,
        reply: {
          author: 'u2',
          content: '是的，走收费通道，不用和免费票抢名额。',
        },
      },
      {
        id: 'c4',
        author: 'u6',
        content: '补充一下，周一闭馆这点真的坑，我上次白跑一趟。',
        createdAt: '2026-09-19',
        likes: 26,
        reply: null,
      },
    ],
  },
  {
    id: 'p3',
    title: '城墙骑行一圈的真实耗时，以及三个我想吐槽的地方',
    topic: 'youji',
    author: 'u5',
    attraction: 'a3',
    excerpt:
      '网上都说一个半小时骑完，我带着爸妈骑了两个多小时。把实际路况和几个要注意的点写下来。',
    cover: ['#8A4A34', '#5C2F22'],
    images: 5,
    likes: 341,
    comments: 47,
    favorites: 156,
    views: 3980,
    createdAt: '2026-09-15',
    featured: false,
    body: [
      '城墙一圈 13.7 公里，网上动不动就说一个半小时骑完，那是年轻人一路不停的成绩。',
      '我带着爸妈，中间停了三次拍照，实际用了两小时二十分钟。所以如果你是和长辈一起，别把时间卡太紧。',
      '第一个吐槽：墙顶风是真大，尤其是北段，骑起来有点吃力，帽子一定要系紧。',
      '第二个：墙面是砖铺的，有点颠，租车的时候挑一辆坐垫软一点的。',
      '第三个：四个角楼附近的租还车点位是最方便的，从南门上就从南门还，别骑到一半发现还车点关门了。',
      '最后建议傍晚去，日落那一段光线特别好，骑到一半正好赶上亮灯。',
    ],
    commentList: [
      {
        id: 'c5',
        author: 'u3',
        content: '北段风大这点太真实了，我上次差点被吹歪。',
        createdAt: '2026-09-16',
        likes: 19,
        reply: null,
      },
    ],
  },
  {
    id: 'p4',
    title: '大雁塔喷泉几点？别信旧攻略，以当天公告为准',
    topic: 'bikeng',
    author: 'u5',
    attraction: 'a5',
    excerpt:
      '按三年前的攻略去等，结果场次早就改了。这类时效性信息一定要现场核实，我把怎么查的方法写在下面。',
    cover: ['#7C6A55', '#4F4234'],
    images: 2,
    likes: 268,
    comments: 38,
    favorites: 194,
    views: 3120,
    createdAt: '2026-09-12',
    featured: false,
    body: [
      '这次踩了个典型的坑：我拿着一份三年前的攻略去等音乐喷泉，站了四十分钟没等到，问了工作人员才知道场次早改了。',
      '这类信息属于典型的「会变但攻略不会更新」的类型。开放时间、演出场次、票价，都属于这一类。',
      '所以我的建议是：攻略只看玩法思路，具体时间一律以当天官方渠道或现场公告为准。',
      '不夜城的街头演出也是同样情况，我这次看到的时间和网上写的完全对不上。',
      '总之，把攻略当参考，别当承诺。',
    ],
    commentList: [
      {
        id: 'c6',
        author: 'u4',
        content: '这个提醒太有必要了，我差点也按旧攻略去。',
        createdAt: '2026-09-13',
        likes: 22,
        reply: null,
      },
    ],
  },
  {
    id: 'p5',
    title: '两天一夜怎么排？城墙内 + 曲江的紧凑动线',
    topic: 'gonglue',
    author: 'u2',
    attraction: 'a6',
    excerpt:
      '时间紧的话，第一天城墙内解决人文，第二天曲江解决大雁塔一片。把动线和交通都标好了。',
    cover: ['#8E5A2E', '#5C3A1C'],
    images: 4,
    likes: 592,
    comments: 71,
    favorites: 438,
    views: 6740,
    createdAt: '2026-09-08',
    featured: true,
    body: [
      '只有两天的话，核心原则是「一天一个片区」，别来回横跳，西安的路程会吃掉很多时间。',
      '第一天走城墙内：上午碑林，中午回民街吃饭，下午登城墙，傍晚在城墙上等亮灯，晚上从南门下来。这一片基本靠步行和地铁 2 号线就能串起来。',
      '第二天走曲江：上午陕博（记得提前约票），中午小寨吃饭，下午小雁塔和西安博物院，傍晚大雁塔，晚上大唐不夜城。这几个点彼此都在三公里内。',
      '如果只有一天，就砍掉第二天的小雁塔和博物院，保留陕博 + 大雁塔 + 不夜城。',
      '注意：这个安排没有把兵马俑算进去，兵马俑在临潼，单独需要一整天。',
    ],
    commentList: [
      {
        id: 'c7',
        author: 'u3',
        content: '临潼那个建议很中肯，很多人以为半天能搞定，实际上光路上就两小时。',
        createdAt: '2026-09-09',
        likes: 41,
        reply: {
          author: 'u2',
          content: '对，兵马俑 + 华清宫一天刚好，再加别的就赶了。',
        },
      },
    ],
  },
  {
    id: 'p6',
    title: '在城墙上等到了今年最好的一次日落',
    topic: 'daka',
    author: 'u6',
    attraction: 'a3',
    excerpt: '东南角楼往西看，太阳落在钟楼方向，整面墙都是暖色的。',
    cover: ['#9C6B3F', '#6B4526'],
    images: 6,
    likes: 874,
    comments: 56,
    favorites: 328,
    views: 7290,
    createdAt: '2026-09-05',
    featured: false,
    body: [
      '守了三天，终于在城墙上拍到了想要的光。',
      '位置选在东南角楼往西的那一段，太阳会落在钟楼的方向，整个墙面被染成暖橘色，砖缝的纹理全都出来了。',
      '时间大概是日落后二十分钟，天还没全黑，城墙的灯刚亮起来，这个「蓝调时刻」只有十几分钟，拍完就得赶紧走。',
      '机位的话，靠城墙内侧蹲低一点，能把墙顶的垛口当前景。',
      '唯一的问题是那个时间段人也不少，想占好位置至少提前半小时到。',
    ],
    commentList: [
      {
        id: 'c8',
        author: 'u4',
        content: '这个光也太好看了，请问用的是什么设备？',
        createdAt: '2026-09-06',
        likes: 17,
        reply: {
          author: 'u6',
          content: '手机 + 三脚架，主要是等时间。',
        },
      },
    ],
  },
  {
    id: 'p7',
    title: '秦岭这几个点别排在同一天，我替你算过车程',
    topic: 'bikeng',
    author: 'u3',
    attraction: 'a16',
    excerpt:
      '翠华山、南五台、野生动物园看着都在秦岭，实际互相之间开车都要一小时以上，硬凑一天只会一直在车上。',
    cover: ['#4F6B4A', '#2F422C'],
    images: 3,
    likes: 204,
    comments: 29,
    favorites: 167,
    views: 2410,
    createdAt: '2026-09-02',
    featured: false,
    body: [
      '秦岭北麓的景区在地图上看着挨得很近，但那是直线距离。实际全是山路，两两之间开车基本都要一小时起。',
      '我第一次去的时候把翠华山和野生动物园排在一天，结果上午爬山消耗太大，下午到动物园已经没力气逛了，票钱基本浪费。',
      '正确的排法是：一天只放一个秦岭的点，其余时间留给市区。',
      '如果一定要连成两天，就住山脚下的民宿，别每天从市区往返。',
      '另外提醒，秦岭的公共交通不算方便，不自驾的话要留出换乘时间。',
    ],
    commentList: [
      {
        id: 'c9',
        author: 'u5',
        content: '山路那段太对了，导航说四十分钟，实际开了一小时多。',
        createdAt: '2026-09-03',
        likes: 15,
        reply: null,
      },
    ],
  },
  {
    id: 'p8',
    title: '华清宫 + 兵马俑一天，我的完整时间表',
    topic: 'gonglue',
    author: 'u1',
    attraction: 'a2',
    excerpt:
      '从早八点出门到晚上七点回到市区，每个环节的耗时都记下来了，可以直接照着排。',
    cover: ['#9C6B3F', '#6B4526'],
    images: 4,
    likes: 415,
    comments: 53,
    favorites: 296,
    views: 4620,
    createdAt: '2026-08-28',
    featured: false,
    body: [
      '这是我自己走过一遍的时间表，供参考。',
      '08:00 市区出发，坐地铁 9 号线，10:00 到华清宫。',
      '10:00–12:00 华清宫山下遗址区，山上骊山没去，时间不够。',
      '12:00–13:00 临潼城区吃午饭，本地馆子比景区门口便宜不少。',
      '13:30 到兵马俑，14:30 左右进馆，正好错开团队高峰。',
      '14:30–17:30 三个坑加铜车马展厅，节奏比较从容。',
      '18:00 返程，19:00 左右回到市区。',
      '几点说明：我没看《长恨歌》，如果要看演出得单独安排到晚上；另外这条线全程靠地铁 9 号线，不用报团。',
    ],
    commentList: [
      {
        id: 'c10',
        author: 'u4',
        content: '照着这个排了，确实顺，谢谢！',
        createdAt: '2026-08-30',
        likes: 24,
        reply: null,
      },
      {
        id: 'c11',
        author: 'u6',
        content: '请问地铁 9 号线从市区过去要多久？',
        createdAt: '2026-08-31',
        likes: 8,
        reply: {
          author: 'u1',
          content: '从钟楼那边过去大概一小时十分钟，中间要换一次。',
        },
      },
    ],
  },
  {
    id: 'p9',
    title: '回民街主街之外，我更推荐这两条巷子',
    topic: 'youji',
    author: 'u5',
    attraction: 'a9',
    excerpt: '主街商业化程度高，往化觉巷和大皮院走，价格和氛围都更接近日常。',
    cover: ['#94603A', '#5F3A22'],
    images: 3,
    likes: 356,
    comments: 44,
    favorites: 241,
    views: 4180,
    createdAt: '2026-08-24',
    featured: false,
    body: [
      '北院门主街现在游客密度很高，卖的东西也越来越同质化。',
      '我更常去的是旁边两条：化觉巷和大皮院。',
      '化觉巷里有清真大寺，巷子安静，两边是老院子，走起来舒服很多。',
      '大皮院的餐饮更偏本地日常，泡馍和小炒的价格比主街实在。',
      '如果你只有一小时，就在主街走个过场；如果有两三个小时，一定往巷子里拐。',
    ],
    commentList: [
      {
        id: 'c12',
        author: 'u1',
        content: '大皮院那几家确实比主街好吃，价格也正常。',
        createdAt: '2026-08-25',
        likes: 28,
        reply: null,
      },
    ],
  },
  {
    id: 'p10',
    title: '雨天在碑林待了一下午，这是我没想到的行程',
    topic: 'suigan',
    author: 'u2',
    attraction: 'a10',
    excerpt: '原本是躲雨，结果成了整个行程里最安静的一段。',
    cover: ['#6E6350', '#443C30'],
    images: 2,
    likes: 187,
    comments: 21,
    favorites: 132,
    views: 1980,
    createdAt: '2026-08-19',
    featured: false,
    body: [
      '那天下午下大雨，原定的城墙骑行泡汤，临时改去了碑林。',
      '结果意外地好。雨天馆里人很少，可以贴着碑石一块一块看过去，不用排队也不用等别人挪位置。',
      '我对书法其实没什么研究，但那种安静的氛围本身就很舒服。',
      '所以如果你在西安遇到雨天，博物馆是个很稳的备选，别硬撑着去户外景点。',
    ],
    commentList: [
      {
        id: 'c13',
        author: 'u4',
        content: '这个思路好，我下次雨天就这么安排。',
        createdAt: '2026-08-20',
        likes: 11,
        reply: null,
      },
    ],
  },
  {
    id: 'p11',
    title: '不夜城拍照，避开人流的三个位置',
    topic: 'daka',
    author: 'u6',
    attraction: 'a6',
    excerpt: '主街中段人最挤，往两端走反而容易出片，尤其是靠近开元广场那一段。',
    cover: ['#8E5A2E', '#5C3A1C'],
    images: 5,
    likes: 512,
    comments: 39,
    favorites: 288,
    views: 5340,
    createdAt: '2026-08-14',
    featured: false,
    body: [
      '不夜城晚上人是真的多，主街中段基本没法好好拍照。',
      '第一个位置：靠近开元广场那一段，人明显少，而且背景里能带到整条街的灯。',
      '第二个：从侧面进入的几条支路，灯光一样好，几乎没人。',
      '第三个：街口的过街天桥上，俯拍整条街的灯带，这个角度最出片。',
      '时间上前半夜人最多，往后走会稍微散一些。',
    ],
    commentList: [
      {
        id: 'c14',
        author: 'u4',
        content: '天桥那个角度我完全没想到，下次试试。',
        createdAt: '2026-08-15',
        likes: 19,
        reply: null,
      },
    ],
  },
  {
    id: 'p12',
    title: '带爸妈来西安，我把节奏放慢了一半',
    topic: 'suigan',
    author: 'u4',
    attraction: 'a22',
    excerpt: '第一天按原计划走了四个点，老人累得不行。第二天砍掉一半，反而都玩得开心。',
    cover: ['#5C7068', '#364440'],
    images: 4,
    likes: 298,
    comments: 43,
    favorites: 176,
    views: 3260,
    createdAt: '2026-08-06',
    featured: false,
    body: [
      '带爸妈出来，最大的教训是别按自己的节奏排。',
      '第一天我排了四个点，从早走到晚，晚上两位老人都不想说话了。',
      '第二天我砍掉一半，上午只去一个点，下午回酒店睡了两个小时，傍晚才出门，反而都玩得挺开心。',
      '后来几天我就按「一天一个大点 + 一个轻松点」来排，比如兵马俑配曲江池散步。',
      '所以如果你是带长辈，行程宁可少排一点。景点看不完没关系，累垮了才是真的亏。',
    ],
    commentList: [
      {
        id: 'c15',
        author: 'u5',
        content: '这个建议比什么攻略都实在。',
        createdAt: '2026-08-07',
        likes: 35,
        reply: null,
      },
    ],
  },
]

export const getPost = (id) => posts.find((p) => p.id === id) || null
export const postsByAuthor = (uid) => posts.filter((p) => p.author === uid)
export const postsByAttraction = (aid) => posts.filter((p) => p.attraction === aid)

/* ---------- 推荐路线（首页按主题/季节组织） ---------- */
export const ROUTES = [
  {
    id: 'r1',
    name: '首次来西安 · 经典三日',
    theme: '人文',
    days: 3,
    desc: '兵马俑、城墙、陕博、大雁塔，覆盖最核心的几个点，适合第一次来。',
    stops: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
    tone: ['#8C2A22', '#5C1A15'],
  },
  {
    id: 'r2',
    name: '博物馆深度两日',
    theme: '博物馆',
    days: 2,
    desc: '陕博、碑林、西安博物院、兵马俑，以展厅为主的慢节奏安排。',
    stops: ['a4', 'a10', 'a11', 'a18', 'a1'],
    tone: ['#7A6A4A', '#4A3F2C'],
  },
  {
    id: 'r3',
    name: '秋季秦岭轻徒步',
    theme: '自然',
    days: 2,
    desc: '翠华山与南五台，避开市区人流，适合喜欢走路的游客。',
    stops: ['a16', 'a23', 'a15'],
    tone: ['#4F6B4A', '#2C3D2A'],
  },
]

/* ---------- 消息通知 ---------- */
export const notifications = [
  {
    id: 'n1',
    kind: 'comment',
    actor: 'u5',
    text: '评论了你的帖子',
    target: 'p1',
    targetTitle: '兵马俑别上午去！我试了三个时段，下午两点半人最少',
    preview: '同感。我一般建议别人下午去，上午那波团队客是真顶不住。',
    createdAt: '2026-09-28 14:22',
    unread: true,
  },
  {
    id: 'n2',
    kind: 'like',
    actor: 'u4',
    text: '点赞了你的帖子',
    target: 'p8',
    targetTitle: '华清宫 + 兵马俑一天，我的完整时间表',
    preview: '',
    createdAt: '2026-09-28 10:05',
    unread: true,
  },
  {
    id: 'n3',
    kind: 'reply',
    actor: 'u2',
    text: '回复了你的评论',
    target: 'p2',
    targetTitle: '陕博免费票到底怎么抢？连续蹲了四天总结出的规律',
    preview: '是的，走收费通道，不用和免费票抢名额。',
    createdAt: '2026-09-27 19:40',
    unread: true,
  },
  {
    id: 'n4',
    kind: 'favorite',
    actor: 'u6',
    text: '收藏了你的帖子',
    target: 'p1',
    targetTitle: '兵马俑别上午去！我试了三个时段，下午两点半人最少',
    preview: '',
    createdAt: '2026-09-26 21:12',
    unread: false,
  },
  {
    id: 'n5',
    kind: 'system',
    actor: null,
    text: '系统通知',
    target: null,
    targetTitle: '「避坑经验」话题本周新增 42 篇内容',
    preview: '你关注的话题有新的热门内容，去社区看看。',
    createdAt: '2026-09-25 09:00',
    unread: false,
  },
  {
    id: 'n6',
    kind: 'like',
    actor: 'u3',
    text: '点赞了你的评论',
    target: 'p5',
    targetTitle: '两天一夜怎么排？城墙内 + 曲江的紧凑动线',
    preview: '',
    createdAt: '2026-09-24 16:38',
    unread: false,
  },
]

/* ---------- 发布页可选的关联景点（复用景点库） ---------- */
export const COMPOSER_TOPIC_HINT =
  '请勿发布涉及个人隐私、未经核实的价格承诺或与旅行无关的内容。'

/* ---------- 封面取图 ----------
   帖子与路线本身不存图片，封面复用景点库实景图：
   帖子取关联景点（post.attraction），路线取第一个站点（route.stops[0]）。
   返回 undefined 时由 Thumb 回退渐变占位，不会破图。 */
import { attractions as _attractions } from './attractions.js'

export function postCoverImage(post) {
  if (!post || !post.attraction) return undefined
  const a = _attractions.find((x) => x.id === post.attraction)
  return a ? a.image : undefined
}

export function routeCoverImage(route) {
  const first = route && Array.isArray(route.stops) ? route.stops[0] : null
  if (!first) return undefined
  const a = _attractions.find((x) => x.id === first)
  return a ? a.image : undefined
}
