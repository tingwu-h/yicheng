import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../server/app.mjs'
import { DatabaseSync } from 'node:sqlite'
import { backupDatabase } from '../server/backup.mjs'
import { getDocument, putDocument } from '../server/database.mjs'
import { questState, saveQuest } from '../server/business.mjs'
import { getAttraction } from '../src/data/attractions.js'
import { PET_ITEMS } from '../src/data/pets.js'
import { CORE_CHAINS } from '../src/data/vh02Config.js'
import { dateKey } from '../src/store/questEngine.js'

process.env.TZ='Asia/Shanghai'
test('比赛版后端 HTTP 集成、权限与结算回归',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'yicheng-api-test-')), databasePath=join(dir,'test.sqlite')
  let app=createApp({databasePath,origins:['http://127.0.0.1:5180']})
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve))
  let base='http://127.0.0.1:'+app.server.address().port
  t.after(async()=>{await new Promise(r=>app.server.close(r));app.db.close();rmSync(dir,{recursive:true,force:true})})
  const client=()=>({cookie:'',user:null})
  const alice=client(),bob=client(),admin=client()
  async function request(c,path,{method='GET',body,origin='http://127.0.0.1:5180',headers={}}={}) {
    const res=await fetch(base+path,{method,headers:{Origin:origin,'X-Yicheng-Request':'1','Content-Type':'application/json',Cookie:c?.cookie??'',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
    if(c&&res.headers.get('set-cookie')) c.cookie=res.headers.get('set-cookie').split(';')[0]
    const data=await res.json();return {status:res.status,data,headers:res.headers}
  }
  const action=(c,name,body={})=>request(c,'/api/quest/actions/'+name,{method:'POST',body})
  await t.test('真实注册、散列密码、HttpOnly 会话，客户端不能自封管理员',async()=>{
    for(const [i,c] of [alice,bob,admin].entries()) {
      const r=await request(c,'/api/auth/register',{method:'POST',body:{account:'visitor'+i+'@example.test',password:'TestOnly123!',name:'测试旅人'+i,agree:true,role:'admin',isInternalTest:true}})
      assert.equal(r.status,200);c.user=r.data.user
      assert.equal(c.user.role,'user');assert.equal(c.user.isInternalTest,false)
      assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/SameSite=Lax/)
      assert.notEqual(app.db.prepare('SELECT password_hash FROM users WHERE id=?').get(c.user.id).password_hash,'TestOnly123!')
    }
    assert.equal((await request(alice,'/api/auth/me')).data.user.id,alice.user.id)
    assert.equal((await request(client(),'/api/me/quest')).status,401)
    assert.equal((await request(alice,'/api/admin/overview')).status,403)
    assert.equal((await request(client(),'/api/auth/login',{method:'POST',body:{account:'visitor0@example.test',password:'WrongPass123'}})).status,401)
    assert.equal((await action(alice,'buyItem',{itemId:'fake'})).data.code!==0,true)
    assert.equal((await request(alice,'/api/auth/logout',{method:'POST',body:{},origin:'https://malicious.example'})).status,403)
  })
  const today=dateKey(),trip={id:'trip-test',title:'测试行程',startDate:today,days:[{date:today,items:[{id:'item-1',attractionId:'a1',time:'09:00',note:''}]}]}
  await t.test('按账号保存行程；旧版本冲突不覆盖；第三方不能读写',async()=>{
    const old=(await request(alice,'/api/me/app')).data
    const next=await request(alice,'/api/me/app',{method:'PUT',body:{revision:old.revision,data:{...old.data,itinerary:trip,savedTrips:[trip]}}})
    assert.equal(next.status,200)
    assert.equal((await request(bob,'/api/me/app')).data.data.savedTrips.length,0)
    assert.equal((await request(alice,'/api/me/app',{method:'PUT',body:{revision:old.revision,data:{}}})).status,409)
    assert.equal((await action(alice,'completeItineraryTask',{itinerary:{...trip,id:'invented'},taskId:'x',evidence:{photoSelected:true}})).status,404)
    assert.equal((await request(bob,'/api/journeys/start',{method:'POST',body:{tripId:trip.id}})).status,400)
  })
  await t.test('金币和宠物由服务器决定；并发重试不重复领奖',async()=>{
    assert.equal((await action(alice,'createCustomTask',{attractionId:'a1',title:'拍一张屋檐照片',type:'photo',coins:999})).status,400)
    assert.equal((await action(alice,'nextTask',{templates:[]})).status,400)
    const r=await action(alice,'createCustomTask',{attractionId:'a1',title:'拍一张屋檐照片',type:'photo',userId:bob.user.id})
    assert.equal(r.data.code,0);const taskId=r.data.data.id
    assert.equal(r.data.data.userId,alice.user.id)
    assert.notEqual((await action(bob,'completeCustomTask',{taskId,evidence:{photoSelected:true}})).data.code,0)
    const completions=await Promise.all(Array.from({length:5},()=>action(alice,'completeCustomTask',{taskId,evidence:{photoSelected:true}})))
    assert.ok(completions.every(c=>c.data.code===0))
    assert.equal((await request(alice,'/api/me/coins')).data.balance,2)
    assert.equal((await request(alice,'/api/me/coins')).data.ledger.length,1)
    assert.notEqual((await action(alice,'unlockPet',{petId:CORE_CHAINS[0].petId})).data.code,0)
    assert.deepEqual((await request(alice,'/api/me/quest')).data.state.userPets,[])
    assert.equal((await action(alice,'deleteCustomTask',{taskId})).data.code,0)
    assert.equal((await request(alice,'/api/me/coins')).data.balance,2)
  })
  let submitted
  await t.test('私有任务上限、公开待审核、管理员权限和审计',async()=>{
    const r=await action(alice,'createCustomTask',{attractionId:'a1',title:'找到钟楼的好角度',type:'photo'})
    submitted=r.data.data.id
    const done=await action(alice,'completeCustomTask',{taskId:submitted,evidence:{photoSelected:true,publish:true}})
    assert.equal(done.data.code,0);assert.equal((await request(alice,'/api/me/coins')).data.balance,7)
    const third=await action(alice,'createCustomTask',{attractionId:'a1',title:'再拍一张城墙照片',type:'photo'})
    await action(alice,'completeCustomTask',{taskId:third.data.data.id,evidence:{photoSelected:true}})
    assert.equal((await request(alice,'/api/me/coins')).data.balance,7)
    assert.equal((await request(alice,'/api/admin/review',{method:'POST',body:{taskId:submitted,approved:true}})).status,403)
    app.db.prepare('UPDATE users SET role=? WHERE id=?').run('admin',admin.user.id)
    const pending=await request(admin,'/api/admin/overview');assert.equal(pending.data.submissions.length,1)
    assert.equal((await request(admin,'/api/admin/review',{method:'POST',body:{taskId:submitted,approved:true}})).status,200)
    assert.equal((await request(admin,'/api/admin/review',{method:'POST',body:{taskId:submitted,approved:true}})).status,409)
    assert.equal((await request(alice,'/api/me/quest')).data.state.customTasks.find(x=>x.id===submitted).status,'approved')
    assert.equal((await request(admin,'/api/admin/config/coreChains',{method:'PUT',body:{value:[]}})).status,400)
  })
  await t.test('真实小队邀请、本人宠物、共享进度和结束记录',async()=>{
    const start=await request(alice,'/api/journeys/start',{method:'POST',body:{tripId:trip.id,members:[{id:'forged'}]}})
    assert.equal(start.status,200);const session=start.data.active
    assert.equal(session.members.length,1)
    const join=await request(bob,'/api/journeys/join',{method:'POST',body:{code:session.inviteCode}})
    assert.equal(join.status,200);assert.equal(join.data.active.members.length,2)
    const taskId='trip-'+today+'-a1-photo'
    const done=await action(bob,'completeItineraryTask',{itinerary:{id:trip.id},taskId,evidence:{photoSelected:true}})
    assert.equal(done.data.code,0);assert.equal((await request(bob,'/api/me/coins')).data.balance,3)
    assert.equal((await request(alice,'/api/journeys')).data.active.sharedTasks.length,1)
    assert.equal((await action(alice,'completeItineraryTask',{itinerary:{id:trip.id},taskId,evidence:{photoSelected:true}})).data.data.already,true)
    assert.equal((await request(alice,'/api/me/coins')).data.balance,7)
    assert.equal((await request(admin,'/api/journeys/finish',{method:'POST',body:{sessionId:session.id}})).status,403)
    assert.equal((await request(bob,'/api/journeys/finish',{method:'POST',body:{sessionId:session.id}})).status,200)
    assert.equal((await request(alice,'/api/journeys')).data.active.members.length,1)
    assert.equal((await request(bob,'/api/journeys')).data.records[0].leftEarly,true)
    assert.equal((await request(bob,'/api/journeys/finish',{method:'POST',body:{sessionId:session.id}})).data.records.length,1)
    assert.equal((await request(bob,'/api/journeys/join',{method:'POST',body:{code:session.inviteCode}})).status,200)
    assert.equal((await request(alice,'/api/journeys/finish',{method:'POST',body:{sessionId:session.id}})).status,200)
    const records=(await request(bob,'/api/journeys')).data
    assert.equal(records.active,null);assert.equal(records.records[0].completedTasks.length,1)
  })
  await t.test('核心链顺序、服务端日期、任务解锁宠物和专属服饰',async()=>{
    const chain=CORE_CHAINS[0],first=chain.steps[0]
    assert.notEqual((await action(bob,'completeCoreStep',{chainId:chain.id,stepId:chain.steps.at(-1).id,evidence:{answer:'观察'}})).data.code,0)
    const goodEvidence=s=>({answer:'记录了建筑与自然的小细节',photoSelected:true,coords:getAttraction(s.attractionId).geo})
    if(first.type==='checkin') assert.notEqual((await action(bob,'completeCoreStep',{chainId:chain.id,stepId:first.id,evidence:{coords:{lat:0,lng:0}}})).data.code,0)
    for(const step of chain.steps.slice(0,-1)) assert.equal((await action(bob,'completeCoreStep',{chainId:chain.id,stepId:step.id,evidence:goodEvidence(step)})).data.code,0)
    assert.notEqual((await action(bob,'completeCoreStep',{chainId:chain.id,stepId:chain.steps.at(-1).id,evidence:goodEvidence(chain.steps.at(-1)),now:'2099-01-01'})).data.code,0)
    // Isolated fixture represents a previous-day visit. No public API can change the clock or progress.
    const q=questState(app.db,bob.user.id);q.coreProgress[0].day='2026-01-01';saveQuest(app.db,bob.user.id,q)
    const unlock=await action(bob,'completeCoreStep',{chainId:chain.id,stepId:chain.steps.at(-1).id,evidence:goodEvidence(chain.steps.at(-1))})
    assert.equal(unlock.data.code,0);assert.equal(unlock.data.state.userPets[0].petId,chain.petId);assert.ok(unlock.data.state.ownedItems.includes(chain.rewardCostumeId))
  })
  await t.test('不能购买限定服饰；余额不足不得升级',async()=>{
    const item=PET_ITEMS.find(i=>i.acquisition==='activity')
    assert.notEqual((await action(bob,'buyItem',{itemId:item.id})).data.code,0)
    assert.notEqual((await action(bob,'upgradeCostume',{itemId:CORE_CHAINS[0].rewardCostumeId})).data.code,0)
    assert.equal((await request(bob,'/api/me/coins')).data.balance,3)
  })
  await t.test('公开任务大众完成度由服务端计数，作者奖励不重复',async()=>{
    assert.equal((await request(null,'/api/tasks/public')).data.tasks.some(t=>t.id===submitted),true)
    assert.equal((await request(alice,'/api/tasks/public/complete',{method:'POST',body:{taskId:submitted,evidence:{photoSelected:true}}})).status,400)
    const others=[admin]
    for(let i=0;i<4;i++){
      const c=client(),r=await request(c,'/api/auth/register',{method:'POST',body:{account:'public'+i+'@example.test',password:'TestOnly123!',agree:true}})
      assert.equal(r.status,200);c.user=r.data.user;others.push(c)
    }
    for(const c of others){
      assert.equal((await request(c,'/api/tasks/public/complete',{method:'POST',body:{taskId:submitted,evidence:{photoSelected:false}}})).status,400)
      const r=await request(c,'/api/tasks/public/complete',{method:'POST',body:{taskId:submitted,evidence:{photoSelected:true}}})
      assert.equal(r.data.code,0);assert.equal(r.data.data.coins,2)
    }
    const repeat=await Promise.all(Array.from({length:3},()=>request(admin,'/api/tasks/public/complete',{method:'POST',body:{taskId:submitted,evidence:{photoSelected:true}}})))
    assert.ok(repeat.every(r=>r.data.data.already))
    assert.equal((await request(alice,'/api/me/coins')).data.balance,12)
    assert.equal((await request(alice,'/api/me/quest')).data.state.customTasks.find(t=>t.id===submitted).publicVerifiedCompletions,5)
    assert.equal((await request(admin,'/api/me/coins')).data.balance,2)
  })
  await t.test('私人图片类型、大小、所有权、删除与请求来源校验',async()=>{
    const headers={Origin:'http://127.0.0.1:5180','X-Yicheng-Request':'1',Cookie:alice.cookie,'Content-Type':'image/png'}
    const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6QBUAAAAASUVORK5CYII=','base64')
    assert.equal((await fetch(base+'/api/media',{method:'POST',headers,body:Buffer.from('<svg></svg>')})).status,415)
    assert.equal((await fetch(base+'/api/media',{method:'POST',headers,body:Buffer.alloc(2*1024*1024+1)})).status,413)
    const result=await fetch(base+'/api/media',{method:'POST',headers,body:bytes});assert.equal(result.status,201)
    const media=await result.json()
    assert.equal((await request(bob,media.url)).status,404)
    const owned=await fetch(base+media.url,{headers:{Cookie:alice.cookie}});assert.equal(owned.status,200);assert.deepEqual(Buffer.from(await owned.arrayBuffer()),bytes)
    assert.equal((await request(alice,media.url,{method:'DELETE'})).status,200)
    assert.equal((await request(alice,media.url)).status,404)
    assert.equal((await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:alice.cookie}})).status,403)
    assert.equal((await request(alice,'/api/me/app',{method:'PUT',body:{revision:0,data:{avatarId:{photoDataUrl:'data:image/svg+xml;base64,AAAA'}}}})).status,400)
  })
  await t.test('未指定景点时间可以保存，关闭任务后不发放奖励',async()=>{
    const original=(await request(alice,'/api/me/app')).data
    const data=structuredClone(original.data);data.itinerary.days[0].items[0].time=''
    assert.equal((await request(alice,'/api/me/app',{method:'PUT',body:{revision:original.revision,data}})).status,200)
    const cfg=(await request(null,'/api/config')).data.officialTaskConfig
    assert.equal((await request(admin,'/api/admin/config/officialTaskConfig',{method:'PUT',body:{value:{...cfg,enabled:false}}})).status,200)
    assert.notEqual((await action(bob,'createCustomTask',{attractionId:'a1',title:'关闭期间不发奖',type:'photo'})).data.code,0)
    assert.equal((await request(admin,'/api/admin/config/officialTaskConfig',{method:'PUT',body:{value:cfg}})).status,200)
  })
  await t.test('重启后账号、金币与游玩记录仍存在；退出失效',async()=>{
    await new Promise(r=>app.server.close(r));app.db.close()
    app=createApp({databasePath,origins:['http://127.0.0.1:5180']})
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+app.server.address().port
    assert.equal((await request(alice,'/api/me/coins')).data.balance,12)
    assert.equal((await request(alice,'/api/journeys')).data.records.length,1)
    const oldCookie=alice.cookie
    assert.equal((await request(alice,'/api/auth/logout',{method:'POST',body:{}})).status,200)
    assert.equal((await request({cookie:oldCookie},'/api/me/quest')).status,401)
    assert.equal((await request(alice,'/api/auth/login',{method:'POST',body:{account:'visitor0@example.test',password:'TestOnly123!'}})).status,200)
  })
  await t.test('在线备份包含已提交数据，且不修改原数据库',async()=>{
    const backupPath=backupDatabase(databasePath,join(dir,'backups'))
    const copy=new DatabaseSync(backupPath,{readOnly:true})
    try {
      assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM users').get().n,app.db.prepare('SELECT COUNT(*) AS n FROM users').get().n)
      assert.equal(copy.prepare('SELECT SUM(delta) AS n FROM coin_ledger WHERE user_id=?').get(alice.user.id).n,12)
      assert.equal(Object.values(copy.prepare('PRAGMA integrity_check').get())[0],'ok')
    } finally { copy.close() }
  })
})
