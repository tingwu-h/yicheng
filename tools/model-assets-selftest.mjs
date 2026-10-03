import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const config = readFileSync(resolve(root, 'src/data/attractionModels.js'), 'utf8')
const attractionIds = [...config.matchAll(/^  (a\d+): \{/gm)].map((match) => match[1])
const modelPaths = [...config.matchAll(/models\/([a-z0-9/]+\.glb)/g)].map((match) => match[1])

assert.equal(attractionIds.length, 15, '应登记 VL1.0 的 15 个景点模型配置项')
assert.equal(modelPaths.length, 16, '陕西历史博物馆双馆区应登记两个模型路径')

const uniquePaths = [...new Set(modelPaths)]
assert.equal(uniquePaths.length, 14, 'a5/a6 与 a8/a9 按 VL1.0 共用模型')

for (const modelPath of uniquePaths) {
  const absolutePath = resolve(root, 'public/models', modelPath)
  assert.ok(existsSync(absolutePath), `缺少模型文件 ${modelPath}`)
  const buffer = readFileSync(absolutePath)
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF', `${modelPath} 不是 GLB 文件`)
  assert.equal(buffer.readUInt32LE(4), 2, `${modelPath} GLB 版本错误`)
  assert.equal(buffer.readUInt32LE(8), buffer.length, `${modelPath} GLB 长度字段不匹配`)
  assert.ok(existsSync(resolve(dirname(absolutePath), 'LICENSE.txt')), `${modelPath} 缺少许可文件`)
}

const museumModels = readdirSync(resolve(root, 'public/models/a4'))
assert.deepEqual(new Set(museumModels), new Set(['main', 'qinhan']))

console.log('3D 模型资产测试通过：15 个景点配置、14 个唯一 GLB、许可文件与双馆区模型齐全。')
