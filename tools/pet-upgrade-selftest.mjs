import assert from 'node:assert/strict'
import { defaultQuestState } from '../src/store/questStore.js'
import { upgradeCostume, upgradePet } from '../src/services/petUpgrade.js'

const state = defaultQuestState()
state.userPets = [{ petId: 'pet-qizai' }]
state.ownedItems = ['it-tang']
state.petGrowth = { 'pet-qizai': 15 }
state.coinLedger = [{ delta: 300, balanceAfter: 300 }]

let result = upgradePet(state, { userId: 'tester', petId: 'pet-qizai' })
assert.equal(result.code, 0)
assert.equal(result.data.paid, 0)
assert.equal(result.state.petLevels['pet-qizai'], 2)
assert.equal(result.state.coinLedger.at(-1).delta, 300)
assert.equal(result.state.coinLedger.at(-1).balanceAfter, 300)

result = upgradePet(result.state, { userId: 'tester', petId: 'pet-qizai' })
assert.equal(result.code, 0)
assert.equal(result.data.paid, 0)
assert.equal(result.state.petLevels['pet-qizai'], 3)
assert.notEqual(upgradePet(result.state, { userId: 'tester', petId: 'pet-qizai' }).code, 0)
assert.notEqual(upgradePet(state, { userId: 'tester', petId: 'pet-zhuhuan' }).code, 0)

result = upgradeCostume(state, { userId: 'tester', itemId: 'it-tang' })
assert.equal(result.code, 0)
assert.equal(result.data.paid, 40)
assert.equal(result.state.itemLevels['it-tang'], 2)
result = upgradeCostume(result.state, { userId: 'tester', itemId: 'it-tang' })
assert.equal(result.code, 0)
assert.equal(result.data.paid, 80)
assert.equal(result.state.itemLevels['it-tang'], 3)
assert.notEqual(upgradeCostume(state, { userId: 'tester', itemId: 'it-armor' }).code, 0)

const poor = { ...state, coinLedger: [{ delta: 20, balanceAfter: 20 }] }
assert.equal(upgradePet(poor, { userId: 'tester', petId: 'pet-qizai' }).code, 0)
assert.notEqual(upgradeCostume(poor, { userId: 'tester', itemId: 'it-tang' }).code, 0)
assert.equal(poor.petLevels['pet-qizai'], undefined)

console.log('宠物与服饰升级测试通过：等级上限、陪伴成长不扣币、服饰金币扣减、流水和未拥有拦截。')
