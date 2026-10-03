import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'

const runFile = promisify(execFile)
// Keep the URL out of shell source code and wait for a real command result.
export async function openPreviewBrowser(url, {platform=process.platform, env=process.env, run=runFile}={}) {
  if (url !== 'http://127.0.0.1:5180/') throw new Error('启动器只打开本项目的本机预览地址')
  const options={windowsHide:true, timeout:12000, maxBuffer:128*1024}
  try {
    if(platform==='win32') {
      const powershell=env.SystemRoot
        ? join(env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe')
        : 'powershell.exe'
      const command="$ErrorActionPreference='Stop'; try { Start-Process -FilePath $env:YICHENG_PREVIEW_URL -ErrorAction Stop; exit 0 } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }"
      await run(powershell,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{
        ...options,env:{...env,YICHENG_PREVIEW_URL:url},
      })
    } else {
      await run(platform==='darwin'?'open':'xdg-open',[url],options)
    }
    return true
  } catch(error) {
    const detail=String(error.stderr || error.message || '系统没有返回成功结果').trim().slice(0,800)
    throw new Error('浏览器打开请求未成功：'+detail)
  }
}
