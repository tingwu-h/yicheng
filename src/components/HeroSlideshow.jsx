import { useEffect, useState } from 'react'
import { attractions } from '../data/attractions'

// Duplicate both ends so the overlapping blend is identical across the loop.
export const HERO_SLIDES = [
  ...attractions.filter(item => item.id === 'a6'),
  ...attractions.filter(item => item.id !== 'a6'),
].filter(item => item.image)
export const HERO_SLIDE_MS = 18000
export const HERO_INTERVAL_MS = HERO_SLIDE_MS

export default function HeroSlideshow() {
  const [paused,setPaused] = useState(false)
  const [visible,setVisible] = useState(true)
  const [loaded,setLoaded] = useState([])
  const [failed,setFailed] = useState([])
  useEffect(()=>{
    const sync=()=>setVisible(!document.hidden)
    sync()
    document.addEventListener('visibilitychange',sync)
    return ()=>document.removeEventListener('visibilitychange',sync)
  },[])
  const slides=HERO_SLIDES.filter(item=>!failed.includes(item.id))
  const ready=slides.length>1 && slides.every(item=>loaded.includes(item.id))
  const remember=(setter,id)=>setter(ids=>ids.includes(id)?ids:[...ids,id])
  if(!slides.length)return null
  return <>
    <div className="hero-photo" aria-hidden="true">
      <div className={'hero-photo-ribbon'+(ready?' is-ready':'')} style={{
        '--ribbon-distance': '-'+(slides.length+1)*100+'%',
        '--ribbon-duration': slides.length*HERO_SLIDE_MS+'ms',
        animationPlayState: paused||!visible?'paused':'running',
      }}>
        {[slides[slides.length-1],...slides,slides[0]].map((item,index)=><div className="hero-ribbon-frame" key={item.id+'-'+index}><img
          className="hero-ribbon-image" src={item.image} alt="" decoding="async"
          onLoad={()=>remember(setLoaded,item.id)} onError={()=>remember(setFailed,item.id)}/></div>)}
      </div>
    </div>
    {slides.length>1&&<button type="button" className="hero-slideshow-toggle" onClick={()=>setPaused(value=>!value)} aria-label={paused?'继续背景轮播':'暂停背景轮播'} aria-pressed={paused}>
      {paused?'▶ 继续轮播':'Ⅱ 暂停轮播'}
    </button>}
  </>
}
