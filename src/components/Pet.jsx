import { useId, useMemo } from 'react'
import { getPet, DEFAULT_PET_ID } from '../data/pets'
import ART from '../data/petUi.json'
import { levelOf } from '../services/petGrowth'
import '../styles/petUi.css'

const bases = Object.fromEntries(ART.pets.map(p => [p.key,p.base]))
const costumes = Object.fromEntries(ART.items.map(i => [i.id,i]))
// All markup comes from bundled, reviewed vector assets, never user HTML.
export function composePet(petId, loadout = {}, itemLevels = {}, namespace = 'pet') {
  let svg = bases[petId] ?? bases[DEFAULT_PET_ID]
  for (const slot of ['back','outfit','hat']) {
    const item = costumes[loadout[slot]], layer = item?.layers[petId]
    if (!item || item.slot !== slot || !layer || (item.petId && item.petId !== petId)) continue
    const lv = levelOf(itemLevels[item.id])
    const y = slot === 'hat' ? 85 : slot === 'back' ? 288 : 278
    const trim = lv >= 2 ? '<path class="gear-stitch" d="M122 '+y+' Q161 '+(y+12)+' 200 '+y+'" fill="none" stroke="#E7C982" stroke-width="2.6" stroke-dasharray="3 4"/><path d="M198 '+y+' v12 m-3 -4 v6 m6 -6 v6" fill="none" stroke="#D9B677" stroke-width="2"/>' : ''
    const ornate = lv >= 3 ? '<path d="M143 '+(y-5)+' q9 -9 18 0 q9 -9 18 0 M149 '+(y-9)+' l12 -8 l12 8" fill="none" stroke="#E7C982" stroke-width="2"/><g class="gear-moment"><path d="M115 '+(y-8)+' l3 6 l6 3 l-6 3 l-3 6 l-3-6 l-6-3 l6-3Z" fill="#E9C978"/></g>' : ''
    svg = svg.replace(new RegExp('<g class="costume costume-'+slot+'"[^>]*>[\\s\\S]*?</g>'), '<g class="costume costume-'+slot+' gear-level-'+lv+'" data-slot="'+slot+'" data-item="'+item.id+'">'+layer+trim+ornate+'</g>')
  }
  // Every instance owns its gradient/clip IDs, including multiple matching team pets.
  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map(m=>m[1])
  for (const id of new Set(ids)) svg = svg.replaceAll('id="'+id+'"','id="'+namespace+'-'+id+'"').replaceAll('url(#'+id+')','url(#'+namespace+'-'+id+')')
  return svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')
}
export default function Pet({petId=DEFAULT_PET_ID,loadout={},itemLevels={},petLevel=1,size=120,mood='idle',className='',title}) {
  const pet=getPet(petId) ?? getPet(DEFAULT_PET_ID), id=useId().replace(/[^a-zA-Z0-9_-]/g,'')
  const body=useMemo(()=>composePet(pet.id,loadout,itemLevels,id),[pet.id,loadout,itemLevels,id])
  return <svg viewBox="0 0 320 360" width={size} height={size} className={'pet-svg pet-ui-v7 pet-growth-'+levelOf(petLevel)+' mood-'+mood+' '+className} data-pet={pet.id} role="img" aria-label={title ?? pet.name+'（'+pet.species+'）虚拟萌宠'} dangerouslySetInnerHTML={{__html:body}} />
}
export function PetAvatar({petId,loadout={},size=44,mood='idle'}) {
 const pet=getPet(petId) ?? getPet(DEFAULT_PET_ID)
 return <span className="pet-avatar" style={{width:size,height:size}} title={pet.name}><Pet petId={petId} loadout={loadout} size={size} mood={mood}/></span>
}
