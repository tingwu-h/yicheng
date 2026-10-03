import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createConnection } from 'node:net'
import { createInterface } from 'node:readline/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { openPreviewBrowser } from './open-browser.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const site = 'http://127.0.0.1:5180/'
const vite = resolve(root, 'node_modules/vite/bin/vite.js')

async function listening(port) {
  return new Promise(resolveStatus => {
    const socket = createConnection({host:'127.0.0.1', port})
    const done = value => { socket.destroy(); resolveStatus(value) }
    socket.setTimeout(1000)
    socket.once('connect', () => done(true))
    socket.once('error', error => done(error.code !== 'ECONNREFUSED'))
    socket.once('timeout', () => done(true))
  })
}

export async function probeService(port, kind) {
  if (!(await listening(port))) return 'free'
  try {
    const url = 'http://127.0.0.1:' + port + (kind === 'api' ? '/api/health' : '/')
    const response = await fetch(url, {signal:AbortSignal.timeout(2500)})
    if (!response.ok) return 'occupied'
    if (kind === 'api') {
      const result = await response.json()
      return result.ok === true && result.service === 'yicheng' && result.version === '0.7-backend-1' ? 'ready' : 'occupied'
    }
    const html = await response.text()
    return html.includes('<title>驿程-vh-0.7') && html.includes('/@vite/client') ? 'ready' : 'occupied'
  } catch { return 'occupied' }
}

async function launch() {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('需要 Node.js 24 或更新版本；不会自动安装或修改系统。')
  process.chdir(root)
  if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'))
  if (process.env.NODE_ENV === 'production') throw new Error('此入口只用于本机预览。生产部署请参考 docs/后端搭建说明.md。')
  if (process.env.API_PORT && process.env.API_PORT !== '5181') throw new Error('API_PORT 与网页代理不一致，请设为 5181 后再启动。')
  if (process.env.API_HOST && process.env.API_HOST !== '127.0.0.1') throw new Error('快捷启动只允许本机访问，请将 API_HOST 设为 127.0.0.1。')
  if (process.env.PUBLIC_ORIGIN && !process.env.PUBLIC_ORIGIN.split(',').map(v=>v.trim()).includes(site.slice(0,-1))) throw new Error('PUBLIC_ORIGIN 需要包含 http://127.0.0.1:5180，不会自动覆盖你的配置。')
  if (process.env.VITE_APP_MODE && process.env.VITE_APP_MODE !== 'server') throw new Error('此入口启动真实后端，请将 VITE_APP_MODE 设为 server；演示模式仍可使用原 npm run dev。')
  const checkOnly = process.argv.includes('--check')
  const smoke = process.argv.includes('--smoke')
  const openBrowser = !checkOnly && !smoke && !process.argv.includes('--no-open')
  console.log('\n驿程 vh-0.7 · 本机快捷启动\n项目：' + root)
  const [apiStatus, webStatus] = await Promise.all([probeService(5181,'api'), probeService(5180,'web')])
  for (const [port,status] of [[5181,apiStatus],[5180,webStatus]]) if (status === 'occupied') throw new Error(port+' 端口被其他服务占用或未通过检查。请手动确认，不会自动结束已有进程。')
  console.log('后端：'+(apiStatus==='ready'?'已有服务，将复用':'尚未启动')+'；网页：'+(webStatus==='ready'?'已有服务，将复用':'尚未启动'))
  if (!existsSync(vite)) {
    if (checkOnly || smoke) throw new Error('缺少依赖；请运行 npm ci，或双击启动入口按提示安装。')
    const prompt=createInterface({input:process.stdin,output:process.stdout})
    let answer
    try { answer=await prompt.question('首次运行缺少依赖，是否联网执行 npm ci 安装？输入 Y 确认：') } finally { prompt.close() }
    if (answer.trim().toLowerCase() !== 'y') throw new Error('已取消安装，没有修改依赖。')
    await new Promise((done,fail)=>{
      const install=process.platform==='win32'
        ? spawn('cmd.exe',['/d','/c','npm ci'],{cwd:root,stdio:'inherit',windowsHide:true})
        : spawn('npm',['ci'],{cwd:root,stdio:'inherit'})
      install.once('error',fail)
      install.once('exit',code=>code===0?done():fail(new Error('依赖安装未完成，请检查网络和 npm 提示。')))
    })
  }
  if (checkOnly) { console.log('检查通过：Node.js、依赖与端口配置可用；未启动进程或打开浏览器。'); return }

  const owned=[]
  let stopping=false, cancelled=false, failure=null
  let resolveStop
  const stopped=new Promise(resolveDone=>{resolveStop=resolveDone})
  const stop=()=>{cancelled=true;resolveStop()}
  process.once('SIGINT',stop)
  process.once('SIGTERM',stop)
  function start(label,args) {
    const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,API_HOST:'127.0.0.1',API_PORT:'5181'},stdio:['ignore','inherit','inherit'],windowsHide:true})
    owned.push(child)
    child.once('error',error=>{if(!stopping){failure=new Error(label+'启动失败：'+error.message);resolveStop()}})
    child.once('exit',()=>{if(!stopping){failure=new Error(label+'意外退出，请查看上方错误。');resolveStop()}})
  }
  async function waitReady(port,kind) {
    const until=Date.now()+30000
    while(Date.now()<until) {
      if(cancelled) throw new Error('已取消启动。')
      if(failure) throw failure
      if(await probeService(port,kind)==='ready') return
      await delay(350)
    }
    throw new Error(port+' 服务未能在 30 秒内就绪，请查看终端错误。')
  }
  try {
    if(apiStatus!=='ready') { start('后端',['--env-file-if-exists=.env','server/start.mjs']); await waitReady(5181,'api') }
    if(webStatus!=='ready') { start('网页',[vite,'--host','127.0.0.1']); await waitReady(5180,'web') }
    const proxy = await fetch(site+'api/health',{signal:AbortSignal.timeout(5000)})
    const health=proxy.ok?await proxy.json():null
    if(health?.service!=='yicheng'||health?.ok!==true) throw new Error('网页已启动，但 /api 代理未连上后端，请检查 vite.config.js。')
    console.log('\n已就绪：'+site+'\n新账号请先注册；已有账号使用真实密码登录。')
    let browserError=null
    if(openBrowser) {
      try { await openPreviewBrowser(site); console.log('已向系统默认浏览器发送打开请求。') }
      catch(error) {
        browserError=error
        console.error(error.message+'\n服务已就绪。可双击项目中的“打开网页.url”，无需输入网址；如仍无响应，请检查系统默认浏览器设置。')
      }
    }
    if(smoke) { console.log('启动冒烟通过，正在停止本次新启动的服务。'); return }
    if(!owned.length) { console.log('两个服务均已存在，无需重复启动；关闭本窗口不影响原服务。'); if(browserError)throw browserError; return }
    console.log('请保留本窗口。按回车或 Ctrl+C 停止本次启动的服务；不会关闭已有服务。')
    const input=createInterface({input:process.stdin,output:process.stdout})
    input.once('line',stop)
    input.once('close',stop)
    try { await stopped; if(failure) throw failure } finally { input.close() }
  } finally {
    stopping=true
    for(const child of owned) if(child.exitCode===null && child.signalCode===null) child.kill('SIGTERM')
    await Promise.all(owned.map(child=>child.exitCode!==null||child.signalCode!==null?Promise.resolve():Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)])))
    process.off('SIGINT',stop);process.off('SIGTERM',stop)
  }
}

if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  launch().catch(error=>{console.error('\n启动未完成：'+error.message);process.exitCode=1})
}
