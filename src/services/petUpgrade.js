import { PETS, PET_ITEMS } from '../data/pets.js'
import { GROWTH_POLICY, levelOf } from './petGrowth.js'
import { balanceOf } from '../store/questEngine.js'

const fail = (state, message) => ({ code: 1, state, message })

function debitUpgrade(state, userId, { kind, id, price, levelKey, levels }) {
  const balance = balanceOf(state.coinLedger)
  if (balance < price) return fail(state, `还差 ${price - balance} 枚金币`)
  const nextLevel = levels[id] + 1
  const balanceAfter = balance - price
  const ledger = {
    id: `${kind}-upgrade-${id}-${Date.now()}`,
    userId,
    delta: -price,
    balanceAfter,
    reason: kind === 'pet' ? '萌宠升级' : '服饰升级',
    refType: kind,
    refId: id,
    createdAt: new Date().toISOString(),
  }
  return {
    code: 0,
    message: `${kind === 'pet' ? '萌宠' : '服饰'}已升级至 Lv.${nextLevel}，解锁新的展示效果`,
    data: { level: nextLevel, paid: price },
    state: { ...state, [levelKey]: { ...levels, [id]: nextLevel }, coinLedger: [...state.coinLedger, ledger], itemAppearanceLevels: { ...state.itemAppearanceLevels, [id]: nextLevel } },
  }
}

export function upgradePet(state, { userId, petId }) {
  if (!userId) return fail(state, '请先登录')
  const current = levelOf(state.petLevels?.[petId])
  if (!PETS.some((pet) => pet.id === petId) || !state.userPets.some((pet) => pet.petId === petId)) {
    return fail(state, '先解锁这只萌宠再升级')
  }
  if (current >= 3) return fail(state, '已经达到最高等级')
  const growth = Number(state.petGrowth?.[petId]) || 0
  const needed = GROWTH_POLICY.thresholds[current]
  if (growth < needed) return fail(state, `再积累 ${needed-growth} 点陪伴值，就能升级啦`)
  return { code: 0, message: `已成长至 Lv.${current+1}，谢谢你的陪伴！`, data: { level: current+1, paid: 0 }, state: { ...state, petLevels: { ...state.petLevels, [petId]: current+1 }, petAppearanceLevels: { ...state.petAppearanceLevels, [petId]: current+1 } } }
}

export function upgradeCostume(state, { userId, itemId }) {
  if (!userId) return fail(state, '请先登录')
  const current = levelOf(state.itemLevels?.[itemId])
  if (!PET_ITEMS.some((item) => item.id === itemId) || !state.ownedItems.includes(itemId)) {
    return fail(state, '先获得这件服饰再升级')
  }
  if (current >= 3) return fail(state, '服饰已经达到最高等级')
  return debitUpgrade(state, userId, {
    kind: 'item', id: itemId, price: current === 1 ? 40 : 80,
    levelKey: 'itemLevels', levels: { ...state.itemLevels, [itemId]: current },
  })
}
