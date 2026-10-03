import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import vm from 'node:vm'
import { resolve } from 'node:path'
const source = resolve(process.argv[2] ?? '../长安伴旅-萌宠UI设计稿-v1')
const context = { window: {} }; vm.createContext(context)
vm.runInContext(readFileSync(resolve(source, 'wardrobe-data.js'),'utf8'),context)
const data = context.window.WARDROBE_DATA
// Front-facing tapered ibis beak, centered on the face rather than bent sideways.
const oldBeak = 'M157 160 Q191 153 199 199 Q186 179 159 176Z'
const newBeak = 'M145 162 Q153 157 161 162 Q160 179 153 196 Q146 179 145 162Z'
for (const pet of data.pets) {
  pet.base = pet.base.replace(oldBeak,newBeak).replace('#555054','#74615E').replace('M166 166 Q183 169 191 183','M150 164 Q148 174 153 187')
  // A slot starts empty in production. Hidden concept outfits must not leak into inventory.
  pet.base = pet.base.replace(/<g class="costume costume-(back|outfit|hat)"[^>]*>[\s\S]*?<\/g>/g, '<g class="costume costume-$1" data-slot="$1"></g>')
}
const payload = { pets: data.pets.map(p => ({ key:p.key,base:p.base })), items: data.items.map(i => ({ id:i.id,slot:i.slot,petId:i.petId,layers:i.layers })) }
mkdirSync('src/data',{recursive:true})
writeFileSync('src/data/petUi.json',JSON.stringify(payload))
console.log(`Imported ${payload.pets.length} pets and ${payload.items.length} layered costumes; ibis beak refined.`)
