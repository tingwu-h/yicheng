import assert from 'node:assert/strict'
import { PETS, PET_ITEMS } from '../src/data/pets.js'
import { ACTIVITY_TASKS, CORE_CHAINS } from '../src/data/vh02Config.js'
import { defaultQuestState, makeInternalTestQuestState } from '../src/store/questStore.js'

const fixture = makeInternalTestQuestState()
const defaults = defaultQuestState()

assert.equal(fixture.userPets.length, 4)
assert.deepEqual(fixture.userPets.map((pet) => pet.petId), PETS.map((pet) => pet.id))
assert.equal(fixture.activePetId, PETS[0].id)
assert.ok(PETS.every((pet) => fixture.petLevels[pet.id] === 3))
assert.ok(PET_ITEMS.every((item) => fixture.itemLevels[item.id] === 3))
assert.deepEqual(new Set(fixture.ownedItems), new Set(PET_ITEMS.map((item) => item.id)))
assert.equal(fixture.ownedItems.length, PET_ITEMS.length)
assert.equal(fixture.coreProgress.length, CORE_CHAINS.reduce((sum, chain) => sum + chain.steps.length, 0))
assert.ok(fixture.coreProgress.every((step) => step.status === 'completed'))
assert.deepEqual(new Set(fixture.activityProgress.map((task) => task.taskId)), new Set(ACTIVITY_TASKS.map((task) => task.id)))
assert.equal(fixture.coinLedger[0].delta, 9999)
assert.match(fixture.coinLedger[0].reason, /非真实金币/)
assert.equal(defaults.userPets.length, 0)
assert.equal(defaults.ownedItems.length, 0)

for (const pet of PETS) {
  const loadout = fixture.loadouts[pet.id]
  assert.equal(loadout.outfit, 'it-tang')
  assert.ok(PET_ITEMS.some((item) => item.id === loadout.hat && item.petId === pet.id))
  assert.ok(PET_ITEMS.some((item) => item.id === loadout.back && item.petId === pet.id))
}

console.log(`内测账号测试档通过：${PETS.length} 只宠物、${PET_ITEMS.length} 件服饰、全部核心链/活动记录与隔离默认档。`)
