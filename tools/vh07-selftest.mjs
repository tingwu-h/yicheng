import assert from 'node:assert/strict'
import { defaultQuestState, migrateQuestState } from '../src/store/questStore.js'
import { addCompanionGrowth, changeAppearance } from '../src/services/petGrowth.js'
import { upgradePet, upgradeCostume } from '../src/services/petUpgrade.js'
import { readFileSync } from 'node:fs'
const t=new Date(2026,9,2,12), userId='v7-test', petId='pet-qizai'
let state={...defaultQuestState(),userPets:[{petId}],activePetId:petId,ownedItems:['it-tang'],coinLedger:[{delta:300,balanceAfter:300}]}
for(let i=0;i<5;i++) {const next={...state,itineraryTaskRecords:[...state.itineraryTaskRecords,{taskId:'t'+i,completedAt:t.toISOString()}]};state=addCompanionGrowth(state,next,userId,t)}
assert.equal(state.petGrowth[petId],3);assert.equal(state.petGrowthLedger.length,5)
assert.equal(addCompanionGrowth(state,state,userId,t),state)
assert.notEqual(upgradePet(state,{userId,petId}).code,0)
const tomorrow=new Date(2026,9,3,12)
for(const field of ['taskRecords','coreProgress']) {const row=field==='taskRecords'?{id:'daily',state:'completed',completedAt:tomorrow.toISOString()}:{stepId:'core',status:'completed',completedAt:tomorrow.toISOString()};state=addCompanionGrowth(state,{...state,[field]:[row]},userId,tomorrow)}
assert.equal(state.petGrowth[petId],5)
let r=upgradePet(state,{userId,petId});assert.equal(r.code,0);assert.equal(r.state.petLevels[petId],2);assert.deepEqual(r.state.coinLedger,state.coinLedger)
assert.notEqual(upgradePet(r.state,{userId,petId}).code,0)
assert.notEqual(upgradePet(state,{petId}).code,0)
assert.notEqual(changeAppearance(r.state,{userId,kind:'pet',id:petId,level:3}).code,0)
assert.equal(changeAppearance(r.state,{userId,kind:'pet',id:petId,level:1}).code,0)
assert.notEqual(changeAppearance(state,{userId,kind:'item',id:'it-armor',level:1}).code,0)
let gear=upgradeCostume(state,{userId,itemId:'it-tang'});assert.equal(gear.state.itemAppearanceLevels['it-tang'],2)
gear=upgradeCostume(gear.state,{userId,itemId:'it-tang'});assert.equal(gear.state.itemLevels['it-tang'],3)
assert.equal(gear.state.coinLedger.reduce((sum,row)=>sum+row.delta,0),180)
assert.notEqual(upgradeCostume(gear.state,{userId,itemId:'it-tang'}).code,0)
const old={...state,schemaVersion:3,petLevels:{[petId]:3},itemLevels:{'it-tang':2},loadouts:{[petId]:{outfit:'it-tang'}}}
delete old.petGrowth;delete old.petGrowthLedger
const migrated=migrateQuestState(old);assert.equal(migrated.schemaVersion,4);assert.equal(migrated.petLevels[petId],3)
assert.deepEqual(migrated.coinLedger,old.coinLedger);assert.deepEqual(migrated.loadouts,old.loadouts);assert.deepEqual(migrated.petGrowth,{})
assert.equal(migrateQuestState({...old,schemaVersion:7}).schemaVersion,7)
const art=JSON.parse(readFileSync(new URL('../src/data/petUi.json',import.meta.url),'utf8'))
assert.equal(art.items.length,106);assert.equal(art.pets.length,4)
assert.ok(!art.pets.find(p=>p.key==='pet-zhuhuan').base.includes('M157 160 Q191'))
const walk=readFileSync(new URL('../src/components/WalkingPet.jsx',import.meta.url),'utf8')
assert.ok(walk.includes('4000'));assert.ok(walk.includes('8 * 60 * 1000'));assert.ok(walk.includes('Math.random() >= .3'))
console.log('vh07-selftest: growth caps/idempotency, no pet coin charge, gear charge/ownership, appearance bounds, migration, 106 assets and idle behavior PASS')
