import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { openDatabase, getDocument, putDocument, transactionQueue } from './database.mjs'
import { id, hash, HttpError, insist, passwordHash, passwordMatches, validateCredentials, sessionCookie, currentUser, publicUser, readBody, readJson, rateLimiter } from './security.mjs'
import { config, validateConfig, cleanAppDocument, questState, saveQuest, executeQuest, completePublicTask } from './business.mjs'
import { tasksForItinerary } from '../src/services/vh02Api.js'

const stamp = () => new Date().toISOString()
export function createApp(options = {}) {
  const production = options.production ?? process.env.NODE_ENV === 'production'
  const originList = options.origins ?? (process.env.PUBLIC_ORIGIN || (production ? '' : 'http://127.0.0.1:5180,http://localhost:5180')).split(',').filter(Boolean)
  insist(originList.length > 0 && (!production || originList.every(x => new URL(x).protocol === 'https:')), 500, '生产环境需要配置 HTTPS PUBLIC_ORIGIN')
  const allowedOrigins = new Set(originList.map(s=>new URL(s).origin))
  const db = openDatabase(options.databasePath)
  const transact = transactionQueue(db), rate = rateLimiter()
  const dummyHash = passwordHash(randomBytes(32).toString('hex'))
  let hashing = 0
  const audit = (u,action,target='') => db.prepare('INSERT INTO audit_log(user_id,action,target,created_at) VALUES (?,?,?,?)').run(u,action,target,stamp())
  const write = (res,status,data,headers={}) => {
    res.writeHead(status, { 'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers })
    res.end(JSON.stringify(data))
  }
  const memberView = uid => {
    const u=db.prepare('SELECT id,name FROM users WHERE id=?').get(uid), q=questState(db,uid), app=getDocument(db,uid,'app').data
    const petId=q.userPets.some(p=>p.petId===q.activePetId) ? q.activePetId : null
    return {id:uid,name:app.profile?.name || u.name,petId,loadout:q.loadouts[petId]??{},level:q.petLevels[petId]??1}
  }
  const viewJourney = (row,uid) => {
    const journey=JSON.parse(row.body)
    const members=row.status==='finished' && journey.members ? journey.members : db.prepare('SELECT user_id FROM journey_members WHERE journey_id=? ORDER BY joined_at').all(row.id).map(m=>memberView(m.user_id))
    return {...journey,userId:uid,ownerId:row.owner_id,members,status:row.status,inviteCode:row.status==='active'?row.invite_code:null}
  }
  const listJourneys = uid => {
    const rows=db.prepare('SELECT j.* FROM journeys j JOIN journey_members m ON j.id=m.journey_id WHERE m.user_id=? ORDER BY j.created_at DESC LIMIT 100').all(uid)
    const active=rows.find(r=>r.status==='active')
    const records=[...rows.filter(r=>r.status==='finished').map(r=>viewJourney(r,uid)),...getDocument(db,uid,'journey_exits',[]).data]
    return {version:2,active:active?viewJourney(active,uid):null,records:records.sort((a,b)=>String(b.endedAt).localeCompare(String(a.endedAt))).slice(0,100)}
  }
  const server = createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost'), path=url.pathname, method=req.method
      const peer=req.socket.remoteAddress ?? 'unknown'
      const ip=process.env.TRUST_PROXY==='1' && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)
        ? String(req.headers['x-real-ip']??peer).slice(0,100) : peer
      rate('all:'+ip,300)
      if (!['GET','HEAD'].includes(method)) insist(req.headers['x-yicheng-request']==='1' && allowedOrigins.has(req.headers.origin),403,'请求来源不受信任，请从驿程网页重试')
      if (method==='GET'&&path==='/api/health') return write(res,200,{ok:true,service:'yicheng',version:'0.7-backend-1',time:stamp()})
      if (method==='GET'&&(path==='/api/vh02/config'||path==='/api/config')) return write(res,200,config(db))
      if (method==='GET'&&path==='/api/auth/me') return write(res,200,{user:publicUser(currentUser(db,req))})
      if (method==='GET'&&path==='/api/tasks/public') {
        const rows=db.prepare('SELECT body FROM task_submissions WHERE status=? ORDER BY updated_at DESC LIMIT 200').all('approved')
        return write(res,200,{tasks:rows.map(r=>{const t=JSON.parse(r.body);return {id:t.id,title:t.title,attractionId:t.attractionId,type:t.type,status:'approved',userId:t.userId}})})
      }
      if (method==='POST' && ['/api/auth/register','/api/auth/login'].includes(path)) {
        rate('auth:'+ip,12,15*60000)
        const body=await readJson(req), account=validateCredentials(body)
        rate('account:'+hash(account),12,15*60000)
        insist(hashing<4,503,'登录请求较多，请稍后再试')
        hashing++
        let user
        try {
          if (path.endsWith('/register')) {
            insist(body.agree===true,400,'请先阅读账号与隐私说明')
            insist(/(?=.*[A-Za-z])(?=.*[0-9])/.test(body.password),400,'密码请同时包含字母和数字')
            const encoded=await passwordHash(body.password)
            user=await transact(()=>{
              insist(!db.prepare('SELECT 1 FROM users WHERE account=?').get(account),409,'这个邮箱已经注册，请直接登录')
              const uid=id('user-'), name=String(body.name||account.split('@')[0]).trim().slice(0,32)||'长安游客'
              db.prepare('INSERT INTO users(id,account,password_hash,name,created_at) VALUES (?,?,?,?,?)').run(uid,account,encoded,name,stamp())
              putDocument(db,uid,'app',cleanAppDocument({profile:{name},avatarId:body.avatarId??'av-1'}))
              audit(uid,'register')
              return {id:uid,account,name,role:'user'}
            })
          } else {
            const row=db.prepare('SELECT * FROM users WHERE account=?').get(account)
            const valid=await passwordMatches(body.password,row?.password_hash ?? await dummyHash)
            insist(valid && row,401,'邮箱或密码不正确，请检查后重试')
            user=row
          }
        } finally { hashing-- }
        const token=randomBytes(32).toString('hex')
        await transact(()=>{
          db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now())
          db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token),user.id,Date.now()+7*86400000)
        })
        return write(res,200,{user:publicUser(user)}, {'set-cookie':sessionCookie(token,production,body.remember!==false)})
      }
      const user=currentUser(db,req)
      insist(user,401,'请先登录，之前的本机演示账号不能作为线上账号使用')
      if(path==='/api/tasks/public/complete'&&method==='POST'){
        const body=await readJson(req)
        rate('quest:'+user.id,90)
        return write(res,200,await transact(()=>completePublicTask(db,user.id,body.taskId,body)))
      }
      if (method==='POST'&&path==='/api/auth/logout') {
        const token=/(?:^|; *)yicheng_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1]
        if (token) await transact(()=>db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token)))
        return write(res,200,{ok:true},{'set-cookie':'yicheng_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'+(production?'; Secure':'')})
      }
      if (path==='/api/me/app'&&method==='GET') return write(res,200,getDocument(db,user.id,'app'))
      if (path==='/api/me/app'&&method==='PUT') {
        const body=await readJson(req), clean=cleanAppDocument(body.data??{})
        const result=await transact(()=>{
          insist(getDocument(db,user.id,'app').revision===body.revision,409,'另一处已更新你的资料，请刷新后再保存，避免覆盖')
          if (clean.profile.name) db.prepare('UPDATE users SET name=? WHERE id=?').run(clean.profile.name,user.id)
          return putDocument(db,user.id,'app',clean)
        })
        return write(res,200,result)
      }
      if (path==='/api/me/quest'&&method==='GET') return write(res,200,{state:questState(db,user.id)})
      if (path==='/api/me/coins'&&method==='GET') {
        const rows=db.prepare('SELECT body FROM coin_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 200').all(user.id)
        return write(res,200,{balance:db.prepare('SELECT COALESCE(SUM(delta),0) AS n FROM coin_ledger WHERE user_id=?').get(user.id).n,ledger:rows.map(r=>JSON.parse(r.body))})
      }
      if (path.startsWith('/api/quest/actions/')&&method==='POST') {
        rate('quest:'+user.id,90)
        const action=path.slice('/api/quest/actions/'.length), body=await readJson(req)
        const result=await transact(async()=>{
          const row=action==='completeItineraryTask' ? db.prepare('SELECT j.* FROM journeys j JOIN journey_members m ON j.id=m.journey_id WHERE m.user_id=? AND j.status=?').get(user.id,'active') : null
          if (row && JSON.parse(row.body).sharedTasks?.some(t=>t.taskId===body.taskId)) return {code:0,message:'队友已完成这一项，小队进度已同步',data:{already:true},state:questState(db,user.id)}
          const r=await executeQuest(db,user.id,action,body)
          if (r.code===0 && row) {
            const journey=JSON.parse(row.body), record=r.state?.itineraryTaskRecords.find(t=>t.taskId===body.taskId)
            if(record && tasksForItinerary(journey.trip).some(t=>t.id===record.taskId)) {
              journey.sharedTasks=[...(journey.sharedTasks??[]),{...record,completedBy:user.id}]
              db.prepare('UPDATE journeys SET body=? WHERE id=?').run(JSON.stringify(journey),row.id)
            }
          }
          return r
        })
        return write(res,200,result)
      }
      if (path==='/api/journeys'&&method==='GET') return write(res,200,listJourneys(user.id))
      if (path==='/api/journeys/start'&&method==='POST') {
        const body=await readJson(req)
        const result=await transact(()=>{
          const current=listJourneys(user.id).active
          if(current) { insist(current.trip.id===body.tripId,409,'请先结束正在进行的游玩');return current }
          const trip=getDocument(db,user.id,'app').data.savedTrips?.find(t=>t.id===body.tripId)
          insist(trip?.days.some(d=>d.items.length),400,'请先保存包含景点的行程')
          const jid=id('play-'), code=randomBytes(6).toString('hex').toUpperCase()
          const journey={id:jid,trip,userId:user.id,startedAt:stamp(),sharedTasks:[],baselineIds:questState(db,user.id).itineraryTaskRecords.map(t=>t.taskId)}
          db.prepare('INSERT INTO journeys VALUES (?,?,?,?,?,?)').run(jid,user.id,code,'active',JSON.stringify(journey),stamp())
          db.prepare('INSERT INTO journey_members VALUES (?,?,?)').run(jid,user.id,stamp())
          return viewJourney(db.prepare('SELECT * FROM journeys WHERE id=?').get(jid),user.id)
        })
        return write(res,200,{active:result})
      }
      if (path==='/api/journeys/join'&&method==='POST') {
        rate('join:'+user.id,10,60000)
        const body=await readJson(req)
        const result=await transact(()=>{
          const row=db.prepare('SELECT * FROM journeys WHERE invite_code=? AND status=?').get(String(body.code??'').trim().toUpperCase(),'active')
          insist(row,404,'邀请码不存在或这段游玩已结束')
          const current=listJourneys(user.id).active
          insist(!current || current.id===row.id,409,'请先结束当前游玩，再加入其他小队')
          if(!current) {
            insist(db.prepare('SELECT COUNT(*) AS n FROM journey_members WHERE journey_id=?').get(row.id).n<8,409,'小队最多 8 人')
            db.prepare('INSERT INTO journey_members VALUES (?,?,?)').run(row.id,user.id,stamp())
          }
          return viewJourney(row,user.id)
        })
        return write(res,200,{active:result})
      }
      if (path==='/api/journeys/finish'&&method==='POST') {
        const body=await readJson(req)
        await transact(()=>{
          const row=db.prepare('SELECT j.* FROM journeys j JOIN journey_members m ON m.journey_id=j.id WHERE j.id=? AND m.user_id=?').get(body.sessionId,user.id)
          if(!row && getDocument(db,user.id,'journey_exits',[]).data.some(r=>r.sessionId===body.sessionId))return
          insist(row,403,'只能结束自己参与的游玩')
          if(row.status==='finished') return
          const journey=JSON.parse(row.body)
          Object.assign(journey,{endedAt:stamp(),status:'ended',completedTasks:journey.sharedTasks??[],durationSeconds:Math.max(0,Math.floor((Date.now()-Date.parse(journey.startedAt))/1000))})
          journey.members=viewJourney(row,user.id).members
          if(row.owner_id!==user.id){
            const records=getDocument(db,user.id,'journey_exits',[]).data
            putDocument(db,user.id,'journey_exits',[{...journey,id:id('left-'),sessionId:row.id,userId:user.id,ownerId:row.owner_id,inviteCode:null,status:'finished',leftEarly:true},...records].slice(0,100))
            db.prepare('DELETE FROM journey_members WHERE journey_id=? AND user_id=?').run(row.id,user.id)
            audit(user.id,'journey.leave',row.id);return
          }
          db.prepare('UPDATE journeys SET status=?,body=? WHERE id=?').run('finished',JSON.stringify(journey),row.id)
          audit(user.id,'journey.finish',row.id)
        })
        return write(res,200,listJourneys(user.id))
      }
      if (path==='/api/media'&&method==='POST') {
        rate('media:'+user.id,10)
        const mime=(req.headers['content-type']??'').split(';')[0], bytes=await readBody(req,2*1024*1024)
        const isJpeg=mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255
        const isPng=mime==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        const isWebp=mime==='image/webp'&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'
        insist(isJpeg||isPng||isWebp,415,'仅支持 JPEG、PNG、WebP 图片，不支持 SVG 或其他文件')
        const mid=id('media-')
        await transact(()=>{
          const used=db.prepare('SELECT COALESCE(SUM(length(data)),0) AS n FROM media WHERE user_id=?').get(user.id).n
          insist(used+bytes.length<=20*1024*1024,413,'个人图片空间上限为 20 MB，请先删除不需要的图片')
          db.prepare('INSERT INTO media VALUES (?,?,?,?,?)').run(mid,user.id,mime,bytes,stamp())
        })
        return write(res,201,{id:mid,url:'/api/media/'+mid,visibility:'private'})
      }
      if (path.startsWith('/api/media/') && ['GET','DELETE'].includes(method)) {
        const mid=path.slice('/api/media/'.length), media=db.prepare('SELECT * FROM media WHERE id=? AND user_id=?').get(mid,user.id)
        insist(media,404,'图片不存在或没有访问权限')
        if(method==='DELETE') {await transact(()=>db.prepare('DELETE FROM media WHERE id=? AND user_id=?').run(mid,user.id));return write(res,200,{ok:true})}
        res.writeHead(200,{'content-type':media.mime,'x-content-type-options':'nosniff','cache-control':'private, no-store','content-security-policy':"default-src 'none'; sandbox",'content-disposition':'inline'})
        return res.end(Buffer.from(media.data))
      }
      if (path.startsWith('/api/admin/')) {
        insist(user.role==='admin',403,'此处仅限管理员')
        if(path==='/api/admin/overview'&&method==='GET') {
          const accounts=db.prepare('SELECT id,account,name,role,created_at FROM users ORDER BY created_at DESC LIMIT 100').all()
          return write(res,200,{users:accounts,submissions:db.prepare('SELECT * FROM task_submissions WHERE status=? ORDER BY updated_at LIMIT 100').all('pending_review').map(t=>({...t,body:JSON.parse(t.body)})),config:config(db),audit:db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100').all()})
        }
        if(path.startsWith('/api/admin/users/')&&method==='GET') {
          const uid=path.slice('/api/admin/users/'.length)
          insist(db.prepare('SELECT 1 FROM users WHERE id=?').get(uid),404,'用户不存在')
          return write(res,200,{state:questState(db,uid),journeys:listJourneys(uid)})
        }
        if(path.startsWith('/api/admin/config/')&&method==='PUT') {
          const key=path.slice('/api/admin/config/'.length), body=await readJson(req), value=validateConfig(key,body.value)
          await transact(()=>{
            db.prepare('INSERT INTO official_config VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at').run(key,JSON.stringify(value),stamp())
            audit(user.id,'config.update',key)
          })
          return write(res,200,{ok:true})
        }
        if(path==='/api/admin/review'&&method==='POST') {
          const body=await readJson(req)
          insist(typeof body.approved==='boolean' && (body.approved||String(body.reason??'').trim()),400,'未通过时请填写原因')
          await transact(()=>{
            const row=db.prepare('SELECT * FROM task_submissions WHERE id=? AND status=?').get(body.taskId,'pending_review')
            insist(row,409,'任务不存在或已审核')
            const q=questState(db,row.user_id)
            q.customTasks=q.customTasks.map(t=>t.id===body.taskId?{...t,status:body.approved?'approved':'rejected',reviewReason:String(body.reason??'').slice(0,500),reviewedAt:stamp(),reviewedBy:user.id}:t)
            saveQuest(db,row.user_id,q);audit(user.id,'task.review',body.taskId)
          })
          return write(res,200,{ok:true})
        }
      }
      return write(res,404,{code:404,message:'未找到接口'})
    } catch(e) {
      const status=e instanceof HttpError?e.status:500
      if(status===500) console.error('[api]',e)
      if(!res.headersSent) write(res,status,{code:status,message:status===500?'服务暂时忙碌，请稍后再试':e.message})
      else res.end()
    }
  })
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000
  return {server,db,transact}
}
