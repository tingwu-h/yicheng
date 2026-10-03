import { createApp } from './app.mjs'
process.env.TZ ||= 'Asia/Shanghai'
const {server,db}=createApp({databasePath:process.env.DATABASE_PATH})
const port=Number(process.env.API_PORT||5181),host=process.env.API_HOST||'127.0.0.1'
server.listen(port,host,()=>console.log('驿程后端已启动：http://'+host+':'+port+'（数据保存在独立 SQLite 数据库）'))
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?'端口已被占用，请先确认是否已有后端在运行':err.message);process.exitCode=1;db.close()})
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>{db.close();process.exit(0)}))
