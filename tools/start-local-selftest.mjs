import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { probeService } from './start-local.mjs'
import { openPreviewBrowser } from './open-browser.mjs'

let content = 'An unrelated local application', status = 200
const server=createServer((_req,res)=>{res.writeHead(status,{'content-type':'text/plain'});res.end(content)})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const port=server.address().port
try {
  assert.equal(await probeService(port,'web'),'occupied','Do not reuse an unrelated website')
  assert.equal(await probeService(port,'api'),'occupied','Do not reuse a non-JSON endpoint')
  content=JSON.stringify({ok:true,service:'yicheng',version:'0.7-backend-1'})
  assert.equal(await probeService(port,'api'),'ready')
  content=JSON.stringify({ok:true,service:'yicheng',version:'other-version'})
  assert.equal(await probeService(port,'api'),'occupied')
  content='<title>驿程-vh-0.7</title><script src="/@vite/client"></script>'
  assert.equal(await probeService(port,'web'),'ready')
  content='<title>驿程-vh-0.7</title>'
  assert.equal(await probeService(port,'web'),'occupied','A static preview is not the configured development server')
  status=503
  assert.equal(await probeService(port,'web'),'occupied')
} finally { await new Promise(resolve=>server.close(resolve)) }
assert.equal(await probeService(port,'api'),'free')
console.log('快捷启动检查通过：空闲端口、已有服务、错误版本和无关程序，共 8 项。')
const url='http://127.0.0.1:5180/'
let request
await openPreviewBrowser(url,{platform:'win32',env:{SystemRoot:'C:/Windows'},run:async(file,args,options)=>{request={file,args,options}}})
assert.match(request.file,/powershell[.]exe$/)
assert.equal(request.options.windowsHide,true)
assert.equal(request.options.env.YICHENG_PREVIEW_URL,url)
assert.ok(request.options.timeout>0)
const script=Buffer.from(request.args.at(-1),'base64').toString('utf16le')
assert.ok(script.includes('Start-Process -FilePath $env:YICHENG_PREVIEW_URL -ErrorAction Stop'))
assert.ok(script.includes('exit 1'))
assert.ok(!request.args.includes('-ExecutionPolicy'),'Never bypass system execution policy')
await assert.rejects(openPreviewBrowser(url,{platform:'win32',run:async()=>{throw Object.assign(new Error('exit code 1'),{stderr:'test: no default browser'})}}),/no default browser/)
await assert.rejects(openPreviewBrowser('http://example.test/',{run:async()=>{throw Error('should not run')}}),/本机预览/)
await openPreviewBrowser(url,{platform:'darwin',run:async(file,args)=>{assert.equal(file,'open');assert.deepEqual(args,[url])}})
console.log('浏览器命令构造、等待结果、错误提示和本机地址限制测试通过；此测试不启动真实浏览器。')
