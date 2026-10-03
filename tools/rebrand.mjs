import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const walk = dir => {
  for (const entry of readdirSync(dir,{withFileTypes:true})) {
    if (['node_modules','dist','.git','models'].includes(entry.name)) continue
    const path=join(dir,entry.name)
    if(entry.isDirectory()){walk(path);continue}
    if(!/\.(jsx?|mjs|css|html|md|json|sql)$/i.test(entry.name)||entry.name==='rebrand.mjs')continue
    const old=readFileSync(path,'utf8')
    let next=old.replaceAll('长安伴旅','驿程').replaceAll('长安伴侣','驿程').replaceAll('CHANGAN BANLV','YICHENG')
    if(entry.name==='import-pet-art.mjs') next=next.replace('../驿程-萌宠UI设计稿-v1','../长安伴旅-萌宠UI设计稿-v1')
    if(['package.json','package-lock.json'].includes(entry.name))next=next.replaceAll('"name": "changan-banlv"','"name": "yicheng"')
    if(next!==old)writeFileSync(path,next)
  }
}
walk('.')
