import { useEffect, useRef, useState } from 'react'
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export default function AttractionModel({ name, model }) {
  const hostRef = useRef(null)
  const [status, setStatus] = useState('loading')
  const [variantIndex, setVariantIndex] = useState(0)
  const activeModel = model.variants?.[variantIndex] ?? model

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    let disposed = false
    let frame = 0
    let loadedScene = null
    const scene = new Scene()
    scene.background = new Color('#f6f2ea')

    const camera = new PerspectiveCamera(45, 1, 0.01, 10000)
    const renderer = new WebGLRenderer({ antialias: true, alpha: false })
    renderer.outputColorSpace = SRGBColorSpace
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    host.appendChild(renderer.domElement)

    scene.add(new AmbientLight('#ffffff', 2.1))
    const sun = new DirectionalLight('#ffffff', 2.4)
    sun.position.set(3, 8, 5)
    scene.add(sun)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 0.3
    controls.maxDistance = 10000

    const resize = () => {
      const width = Math.max(host.clientWidth, 1)
      const height = Math.max(host.clientHeight, 1)
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    const animate = () => {
      frame = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    setStatus('loading')
    new GLTFLoader().load(
      activeModel.url,
      (gltf) => {
        if (disposed) return
        loadedScene = gltf.scene || new Group()
        // TopoExport emits Z-up geometry; Three.js uses Y-up.
        loadedScene.rotation.x = -Math.PI / 2
        loadedScene.updateMatrixWorld(true)
        const focus = loadedScene.getObjectByName('TPX_Buildings') || loadedScene
        const bounds = new Box3().setFromObject(focus)
        if (bounds.isEmpty()) {
          console.error('3D model has no renderable geometry:', activeModel.url)
          setStatus('error')
          return
        }

        const center = bounds.getCenter(new Vector3())
        const size = bounds.getSize(new Vector3())
        loadedScene.position.sub(center)
        loadedScene.updateMatrixWorld(true)
        scene.add(loadedScene)

        const radius = Math.max(size.length() / 2, 0.1)
        const distance = radius / Math.sin((camera.fov * Math.PI) / 360)
        camera.position.set(distance * 0.6, distance * 0.45, distance * 0.7)
        camera.near = Math.max(distance / 1000, 0.01)
        camera.far = distance * 20
        camera.updateProjectionMatrix()
        controls.minDistance = Math.max(radius * 0.05, 0.01)
        controls.maxDistance = distance * 8
        controls.target.set(0, 0, 0)
        camera.lookAt(controls.target)
        camera.updateMatrixWorld(true)
        controls.update()
        setStatus('ready')
      },
      undefined,
      (error) => {
        console.error('Failed to load 3D model:', activeModel.url, error)
        if (!disposed) setStatus('error')
      },
    )

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      loadedScene?.traverse((object) => {
        object.geometry?.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.filter(Boolean).forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value?.isTexture) value.dispose()
          })
          material.dispose()
        })
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [activeModel.url])

  return (
    <section className="attraction-model" aria-label={`${name} 3D 模型`}>
      {model.variants && (
        <div className="attraction-model-variants">
          <div className="segment" role="group" aria-label="选择模型馆区">
            {model.variants.map((variant, index) => (
              <button
                key={variant.url}
                type="button"
                className={index === variantIndex ? 'on' : ''}
                aria-pressed={index === variantIndex}
                onClick={() => setVariantIndex(index)}
              >
                {variant.label}
              </button>
            ))}
          </div>
          {model.note && <p className="small muted">{model.note}</p>}
        </div>
      )}
      <div className="attraction-model-canvas" ref={hostRef} />
      {status !== 'ready' && (
        <div className="attraction-model-status" role="status">
          {status === 'error' ? '模型加载失败，请稍后重试。' : '正在加载 3D 模型…'}
        </div>
      )}
      <div className="attraction-model-caption">
        <span>拖动旋转 · 滚轮缩放 · 右键平移</span>
        <span>景区及周边要素模型，建筑细节以数据源为准</span>
      </div>
      {model.attribution && <p className="small muted">数据来源：{model.attribution}</p>}
    </section>
  )
}

