/* vh0.2 西安独立内容配置。后台接入时按 version + attractionId 加载。 */
import { attractions } from './attractions.js'

export const VH02_VERSION = 'vh0.2'
export const VH02_POLICY = Object.freeze({
  region: '西安/秦岭',
  petAcquisition: 'official_core_chain_only',
  coinSources: ['pre_recorded_task', 'daily_task', 'itinerary_task', 'approved_private_task', 'approved_public_task'],
  coinPurchases: ['generic_costume'],
  reminderActions: ['snooze', 'skip', 'not_interested', 'dismiss_today'],
  privateTaskDailyRewardLimit: 2,
  publicCreatorMilestones: [{ completions: 5, coins: 5 }, { completions: 20, coins: 10 }, { completions: 50, coins: 20 }],
})

const makeStep = (id, title, attractionId, type, instruction) => ({
  id, title, attractionId, type, instruction,
  optional: true, skippable: true, reminderRequired: false,
  review: type === 'photo' ? 'photo_optional_upload' : 'manual_or_location',
})

/* 每链四个轻量步骤，跨两次游览日；跳过不惩罚，也不计作完成。 */
export const CORE_CHAINS = [
  { id: 'core-qizai', petId: 'pet-qizai', title: '七仔的慢游手账', rewardCostumeId: 'it-bamboo-back', steps: [
    makeStep('qz-1', '看看城墙轮廓', 'a3', 'checkin', '在安全开放区域找到城墙，轻点到达。'),
    makeStep('qz-2', '记一处喜欢的城门', 'a3', 'observe', '选一处你喜欢的城门或城墙细节。'),
    makeStep('qz-3', '大雁塔旁慢看', 'a5', 'checkin', '到达大雁塔开放区域，无需排队。'),
    makeStep('qz-4', '写一句西安印象', 'a5', 'answer', '用一句自己的话记下今天的印象。'),
  ] },
  { id: 'core-zhuhuan', petId: 'pet-zhuhuan', title: '朱鹮的光影笔记', rewardCostumeId: 'it-cloud-back', steps: [
    makeStep('zh-1', '望一眼钟楼', 'a7', 'checkin', '在合法步行区域看一眼钟楼。'),
    makeStep('zh-2', '找一处屋檐线条', 'a7', 'observe', '观察建筑屋檐，不用拍摄陌生人。'),
    makeStep('zh-3', '大唐不夜城光影', 'a6', 'checkin', '到达步行街开放区域，留意脚下。'),
    makeStep('zh-4', '自选一张景色照片', 'a6', 'photo', '可拍建筑或灯光；照片默认只在本机，上传须另行确认。'),
  ] },
  { id: 'core-jinsihou', petId: 'pet-jinsihou', title: '金丝猴的探索册', rewardCostumeId: 'it-vine-back', steps: [
    makeStep('js-1', '走到陕西历史博物馆周边', 'a4', 'checkin', '只需到达开放公共区域，不要求入馆。'),
    makeStep('js-2', '选一个想了解的文物', 'a4', 'answer', '写下一个自己好奇的问题，不考知识。'),
    makeStep('js-3', '逛逛大唐芙蓉园周边', 'a13', 'checkin', '到达开放区域即可，不要求购票。'),
    makeStep('js-4', '观察一种园林颜色', 'a13', 'observe', '选择今天看到的一种颜色。'),
  ] },
  { id: 'core-lingniu', petId: 'pet-lingniu', title: '羚牛的稳稳行程', rewardCostumeId: 'it-rock-back', steps: [
    makeStep('ln-1', '到达小雁塔周边', 'a11', 'checkin', '在公共开放区域打卡。'),
    makeStep('ln-2', '找一处歇脚点', 'a11', 'observe', '观察休息区，按需休息，不要求消费。'),
    makeStep('ln-3', '走到碑林博物馆周边', 'a10', 'checkin', '在步行开放区域打卡，不要求购票。'),
    makeStep('ln-4', '记一件路上见闻', 'a10', 'answer', '写一句话即可，可随时放弃。'),
  ] },
]

export const CORE_CHAINS_BY_PET = Object.fromEntries(CORE_CHAINS.map((chain) => [chain.petId, chain]))

export const ACTIVITY_TASKS = [
  { id: 'activity-qizai', title: '秦岭竹影留念', attractionId: 'a15', type: 'photo', costumeId: 'it-leaf-hat', instruction: '自选一张秦岭绿意照片，照片只在本机预览。' },
  { id: 'activity-zhuhuan', title: '曲江水色观察', attractionId: 'a22', type: 'observe', costumeId: 'it-feather-hat', instruction: '观察曲江池的水色，写一句话。' },
  { id: 'activity-jinsihou', title: '翠华山林间颜色', attractionId: 'a16', type: 'observe', costumeId: 'it-vine-hat', instruction: '观察一处林间颜色，写一句话。' },
  { id: 'activity-lingniu', title: '南五台远山印象', attractionId: 'a23', type: 'photo', costumeId: 'it-rock-hat', instruction: '在安全区域选一张山景照片，不进入危险地带。' },
]

const SCENIC_MOTIFS = {
  a1: ['秦俑军阵', '俑', '#6F5948'], a2: ['骊山温泉', '泉', '#B97B67'],
  a3: ['古城砖纹', '城', '#9B6150'], a4: ['馆藏器物', '史', '#8B7654'],
  a5: ['雁塔檐影', '塔', '#A67A52'], a6: ['唐街灯影', '灯', '#C45C54'],
  a7: ['钟楼铜钟', '钟', '#A8783E'], a8: ['鼓楼鼓点', '鼓', '#A65E48'],
  a9: ['回坊巷口', '坊', '#B27B58'], a10: ['碑林墨拓', '碑', '#5D6670'],
  a11: ['小雁塔影', '雁', '#8C8270'], a12: ['大明宫殿脊', '宫', '#AA674B'],
  a13: ['芙蓉园水纹', '蓉', '#5C8A8B'], a14: ['永兴坊食巷', '兴', '#B57751'],
  a15: ['秦岭林叶', '林', '#66875D'], a16: ['翠华山峰', '山', '#6D8790'],
  a17: ['楼观台云纹', '观', '#737D64'], a18: ['西博文物', '博', '#9B7258'],
  a19: ['汉城湖水波', '湖', '#55859E'], a20: ['白鹿原片场', '鹿', '#A38A67'],
  a21: ['化觉巷院门', '巷', '#69847A'], a22: ['曲江池涟漪', '池', '#5B8C9C'],
  a23: ['南五台山云', '云', '#718A7C'], a24: ['广仁寺屋檐', '寺', '#9C6C61'],
}

/* 景点服饰与秦岭四宝一一对应；景点名称取项目原始数据，不伪造景区内部坐标。 */
export const SCENIC_COSTUMES = attractions.flatMap((attraction) =>
  ['pet-qizai', 'pet-zhuhuan', 'pet-jinsihou', 'pet-lingniu'].map((petId) => ({
    id: 'scenic-' + attraction.id + '-' + petId,
    name: attraction.name + '·' + SCENIC_MOTIFS[attraction.id][0] + '披风',
    slot: 'back', style: 'scenic', petId, attractionId: attraction.id,
    motif: SCENIC_MOTIFS[attraction.id][1], motifColor: SCENIC_MOTIFS[attraction.id][2],
    acquisition: 'verified_attraction_task', price: null,
    desc: '取自' + SCENIC_MOTIFS[attraction.id][0] + '；完成该景点自愿任务后领取，仅为外观。',
  }))
)

export const PUBLIC_TASK_REVIEW = { defaultVisibility: 'private', defaultPhotoUpload: false, approvalRequired: true }
