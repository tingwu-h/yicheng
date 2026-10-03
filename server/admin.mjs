import { openDatabase } from './database.mjs'
const account=process.argv[2]?.trim().toLowerCase()
if(!account) throw new Error('用法：npm run admin:grant -- 已注册的管理员邮箱；只应在服务器终端执行')
const db=openDatabase(process.env.DATABASE_PATH)
const user=db.prepare('SELECT id FROM users WHERE account=?').get(account)
if(!user) { db.close(); throw new Error('账号尚未注册，不会自动创建默认密码') }
db.prepare('UPDATE users SET role=? WHERE id=?').run('admin',user.id)
db.prepare('INSERT INTO audit_log(user_id,action,target,created_at) VALUES (?,?,?,?)').run(user.id,'admin.grant',user.id,new Date().toISOString())
db.close()
console.log('已授权指定账号为管理员。没有设置默认密码，也没有开放公开提权接口。')
