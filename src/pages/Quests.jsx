import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { useQuest, quietReasonText } from '../store/QuestContext'
import { attractions, getAttraction, regionName } from '../data/attractions'
import {
  PRE_ITEM_CATEGORIES,
  PRIORITIES,
  TIME_SLOTS,
  TASK_CATEGORIES,
  SCENE_WEATHER,
  SCENE_QUEUE,
  QUEST_COPY,
  DEFAULT_PREFS,
} from '../data/questConfig'
import { Breadcrumb, EmptyState, Notice, Modal } from '../components/ui'
import Pet from '../components/Pet'
import { CoreChainsPanel, CustomTasksPanel, ActivityTasksPanel } from '../components/Vh02TaskPanels'

/* ==========================================================================
   行前清单（/quests）
   --------------------------------------------------------------------------
   四块内容：
     1. 我的清单   —— 预录项目的增删改与单条提醒开关
     2. 提醒       —— 场景模拟器 + 手动问一次 + 「为什么现在不提醒」
     3. 任务记录   —— 下发 / 完成 / 跳过 / 稍后 的流水
     4. 提醒偏好   —— 频率、安静时段、整类静音与撤销、总开关
   ========================================================================== */

const TABS = [
  { key: 'core', label: '核心任务链' },
  { key: 'custom', label: '自建任务' },
  { key: 'activity', label: '活动任务' },
  { key: 'list', label: '我的清单' },
  { key: 'remind', label: '提醒' },
  { key: 'records', label: '任务记录' },
  { key: 'prefs', label: '提醒偏好' },
]

const RECORD_STATE = {
  surfaced: { label: '已提醒', tone: 'var(--gold-700)' },
  completed: { label: '已完成', tone: 'var(--success-600)' },
  skipped: { label: '已跳过', tone: 'var(--ink-400)' },
  snoozed: { label: '稍后提醒', tone: 'var(--daiqing-700)' },
  dismissedToday: { label: '今天不再提醒', tone: 'var(--ink-400)' },
  notInterested: { label: '不感兴趣', tone: 'var(--ink-400)' },
}

const VERIFY_TEXT = { location: '位置校验', scan: '扫码核销', manual: '手动确认' }

const catMeta = (key) => PRE_ITEM_CATEGORIES.find((c) => c.key === key) ?? PRE_ITEM_CATEGORIES[0]
const prioLabel = (key) => PRIORITIES.find((p) => p.key === key)?.label ?? '想去'
const DEMO_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]

export default function Quests() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'list'
  const setTab = (key) => setParams({ tab: key }, { replace: true })

  const { isLoggedIn, setAuthModal } = useApp()
  const {
    prefs,
    preItems,
    updatePreItem,
    removePreItem,
    togglePreItemRemind,
    updatePrefs,
    scene,
    setScene,
    requestTask,
    activeTask,
    taskRecords,
    balance,
    ledger,
    restoreMuted,
    line,
    petCatalog,
    activePet,
  } = useQuest()

  const [quietReason, setQuietReason] = useState(null)
  const [editing, setEditing] = useState(null)
  const [askBusy, setAskBusy] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map()
    for (const it of preItems) {
      if (!map.has(it.attractionId)) map.set(it.attractionId, [])
      map.get(it.attractionId).push(it)
    }
    return Array.from(map.entries())
  }, [preItems])

  /* ---------------- 未登录 ---------------- */
  if (!isLoggedIn) {
    return (
      <div className="container page">
        <Breadcrumb items={[{ label: '行前清单' }]} />
        <EmptyState
          icon="🧾"
          title="登录后可以记录想玩的项目"
          desc="清单、任务提醒、金币与萌宠都需要一个账号。不登录仍可自由浏览景点、行程与社区内容。"
          tone="info"
          actions={
            <>
              <button className="btn btn-primary" onClick={() => setAuthModal('login')}>
                登录
              </button>
              <button className="btn btn-secondary" onClick={() => setAuthModal('register')}>
                注册新账号
              </button>
            </>
          }
        />
      </div>
    )
  }

  const loadout = petCatalog.find((p) => p.id === activePet.id)?.loadout ?? {}
  const remindOn = prefs.featureEnabled && prefs.remindEnabled

  /* 手动问一次：演示时间只影响这一次请求，不影响自动调度 */
  const ask = async () => {
    setAskBusy(true)
    let now = new Date()
    if (scene.demoHour !== null && scene.demoHour !== undefined) {
      now = new Date()
      now.setHours(Number(scene.demoHour), 0, 0, 0)
    }
    const res = await requestTask(now)
    setAskBusy(false)
    if (res?.code === 0) {
      setQuietReason(res.data?.task ? null : res.data?.reason ?? 'no-candidate')
    }
  }

  return (
    <div className="page">
      <div className="container">
        <Breadcrumb items={[{ label: '个人中心', to: '/profile' }, { label: '行前清单' }]} />

        <div className="row-between wrap row-4" style={{ marginTop: 'var(--sp-6)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--fs-h1)' }}>行前清单</h1>
            <p className="muted small" style={{ marginTop: 8 }}>
              {QUEST_COPY.entryDesc}
            </p>
          </div>

          <div className="row row-2">
            <span className="tag tag-gold">🪙 {balance} 金币</span>
            <Link className="btn btn-secondary btn-sm" to="/pets">
              萌宠与装扮
            </Link>
          </div>
        </div>

        {/* 总开关常驻可见：一键全部安静 */}
        <div className="quest-switch-bar">
          <div className="grow">
            <p className="small" style={{ fontWeight: 700 }}>
              {remindOn ? '提醒功能已开启' : prefs.featureEnabled ? '提醒已暂停' : '提醒功能已关闭（灰度）'}
            </p>
            <p className="xs muted">
              {remindOn
                ? '随时可以关掉。清单、金币与萌宠都不会消失。'
                : prefs.featureEnabled
                  ? QUEST_COPY.offHint
                  : '你可以继续查看清单、金币与萌宠，只是不再有任何任务卡。'}
            </p>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={remindOn}
              onChange={(e) => updatePrefs({ remindEnabled: e.target.checked, featureEnabled: true })}
            />
            <span className="small">{remindOn ? '关闭提醒' : '打开提醒'}</span>
          </label>
        </div>

        {/* ---------------- 分类 ---------------- */}
        <div className="filter-group wrap" style={{ marginTop: 'var(--sp-5)' }}>
          <div className="filter-chips">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`chip ${tab === t.key ? 'on' : ''}`}
                onClick={() => setTab(t.key)}
                aria-pressed={tab === t.key}
              >
                {t.label}
                {t.key === 'list' && preItems.length > 0 && (
                  <span style={{ marginLeft: 5, opacity: 0.75 }}>{preItems.length}</span>
                )}
                {t.key === 'records' && taskRecords.length > 0 && (
                  <span style={{ marginLeft: 5, opacity: 0.75 }}>{taskRecords.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {tab === 'core' && <div style={{ marginTop: 'var(--sp-5)' }}><CoreChainsPanel /></div>}
        {tab === 'custom' && <CustomTasksPanel />}
        {tab === 'activity' && <ActivityTasksPanel />}

        {/* ================= 1. 我的清单 ================= */}
        {tab === 'list' && (
          <section style={{ marginTop: 'var(--sp-5)' }}>
            {preItems.length === 0 ? (
              <EmptyState
                icon="🧾"
                title="清单还是空的"
                desc="去景点详情页，把「想玩 / 想拍 / 想体验」的项目记下来。记下来之后才会有提醒；什么都不记也完全没问题。"
                actions={
                  <Link className="btn btn-primary" to="/attractions">
                    去逛景点库
                  </Link>
                }
              />
            ) : (
              <div className="stack stack-5">
                {grouped.map(([attractionId, items]) => {
                  const a = getAttraction(attractionId)
                  return (
                    <div key={attractionId} className="card card-pad">
                      <div className="row-between wrap row-2">
                        <div>
                          <h3 className="card-title">{a?.name ?? '未知景点'}</h3>
                          <p className="xs muted">
                            {a ? `${regionName(a.region)} · ${a.type}` : ''} · 共 {items.length} 项
                          </p>
                        </div>
                        {a && (
                          <Link className="btn btn-ghost btn-sm" to={`/attraction/${a.id}`}>
                            去详情页继续加
                          </Link>
                        )}
                      </div>

                      <div className="stack stack-2" style={{ marginTop: 'var(--sp-4)' }}>
                        {items.map((it) => (
                          <div key={it.id} className="pre-item">
                            <span className="poi-icon" aria-hidden="true">
                              {catMeta(it.category).icon}
                            </span>

                            <div className="grow" style={{ minWidth: 0 }}>
                              <p className="small clamp-2" style={{ fontWeight: 700 }}>
                                {it.name}
                              </p>
                              <p className="xs muted">
                                {catMeta(it.category).label} · {prioLabel(it.priority)} · 期望 {it.expectedTime}
                                {it.status === 'done' ? ' · 已完成' : ''}
                              </p>
                            </div>

                            <label className="check" title="是否允许提醒这一项">
                              <input
                                type="checkbox"
                                checked={it.remindEnabled !== false}
                                onChange={(e) => togglePreItemRemind(it.id, e.target.checked)}
                                aria-label={`提醒开关：${it.name}`}
                              />
                              <span className="xs">{it.remindEnabled !== false ? '提醒' : '静默'}</span>
                            </label>

                            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(it)}>
                              编辑
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => removePreItem(it.id)}>
                              移除
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ================= 2. 提醒 ================= */}
        {tab === 'remind' && (
          <section style={{ marginTop: 'var(--sp-5)' }} className="stack stack-5">
            <div className="card card-pad">
              <h3 className="card-title">现在要不要提醒？</h3>
              <p className="small muted" style={{ marginTop: 8 }}>
                演示环境没有真实定位、天气与排队数据，用一个场景模拟器代替。
                正式接入后这三项由服务端下发，判断规则完全一致。
              </p>

              <div className="scene-grid">
                <div className="field">
                  <label className="label" htmlFor="sceneAttraction">
                    当前所在景点
                  </label>
                  <select
                    id="sceneAttraction"
                    className="input"
                    value={scene.atAttractionId ?? ''}
                    onChange={(e) => {
                      const id = e.target.value || null
                      const a = id ? getAttraction(id) : null
                      setScene({ atAttractionId: id, region: a?.region ?? null })
                    }}
                  >
                    <option value="">不在景点</option>
                    {attractions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="label" htmlFor="sceneWeather">
                    天气
                  </label>
                  <select
                    id="sceneWeather"
                    className="input"
                    value={scene.weather}
                    onChange={(e) => setScene({ weather: e.target.value })}
                  >
                    {SCENE_WEATHER.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="label" htmlFor="sceneQueue">
                    排队情况
                  </label>
                  <select
                    id="sceneQueue"
                    className="input"
                    value={scene.queueKey ?? 'normal'}
                    onChange={(e) => {
                      const q = SCENE_QUEUE.find((x) => x.key === e.target.value)
                      setScene({ queueKey: e.target.value, queueWaitMin: q?.waitMin ?? 0 })
                    }}
                  >
                    {SCENE_QUEUE.map((q) => (
                      <option key={q.key} value={q.key}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="label" htmlFor="sceneVisit">
                    已在园时长（分钟）
                  </label>
                  <input
                    id="sceneVisit"
                    className="input"
                    type="number"
                    min="0"
                    max="600"
                    step="10"
                    value={scene.visitMinutes ?? 0}
                    onChange={(e) => setScene({ visitMinutes: Number(e.target.value) })}
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="sceneHour">
                    演示用时间
                  </label>
                  <select
                    id="sceneHour"
                    className="input"
                    value={scene.demoHour ?? ''}
                    onChange={(e) => setScene({ demoHour: e.target.value === '' ? null : Number(e.target.value) })}
                  >
                    <option value="">跟随系统时间</option>
                    {DEMO_HOURS.map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                  <p className="field-hint">只影响下面这一次手动请求，不影响自动提醒。</p>
                </div>
              </div>

              <div className="row row-2 wrap" style={{ marginTop: 'var(--sp-4)' }}>
                <button className="btn btn-primary" onClick={ask} disabled={askBusy}>
                  {askBusy ? '正在判断…' : '看看现在给我什么建议'}
                </button>
                <span className="xs muted">引擎每次最多只会给出一张任务卡。</span>
              </div>

              <Notice kind="quiet" className="mt-4">
                {QUEST_COPY.demoLocation}
              </Notice>
            </div>

            <div className="card card-pad">
              <div className="row row-4">
                {activePet.id ? <Pet petId={activePet.id} loadout={loadout} size={56} /> : <span aria-hidden="true">🧭</span>}
                <div className="grow">
                  <p className="small" style={{ fontWeight: 700 }}>
                    {activePet.name} 说
                  </p>
                  <p className="small muted">
                    {activeTask ? line(activeTask.petLineKey) : line('greet')}
                  </p>
                  <p className="xs muted" style={{ marginTop: 6 }}>
                    性格：{activePet.personality} · {activePet.skillLabel}
                  </p>
                </div>
              </div>

              <div style={{ marginTop: 'var(--sp-4)' }}>
                {activeTask ? (
                  <Notice kind="info">
                    有一张任务卡正在等你处理：《{activeTask.title}》。它在页面右下角，稍后提醒、跳过、不感兴趣都可以。
                  </Notice>
                ) : quietReason ? (
                  <Notice kind="quiet">现在不提醒：{quietReasonText(quietReason)}</Notice>
                ) : (
                  <Notice kind="quiet">点上面的按钮可以立刻问一次。</Notice>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ================= 3. 任务记录 ================= */}
        {tab === 'records' && (
          <section style={{ marginTop: 'var(--sp-5)' }}>
            {taskRecords.length === 0 ? (
              <EmptyState
                icon="🗂"
                title="还没有任务记录"
                desc={QUEST_COPY.emptyTasks}
                actions={
                  <button className="btn btn-primary" onClick={() => setTab('list')}>
                    去记录项目
                  </button>
                }
              />
            ) : (
              <div className="stack stack-3">
                {taskRecords.slice(0, 60).map((r) => {
                  const meta = RECORD_STATE[r.state] ?? RECORD_STATE.surfaced
                  const a = r.attractionId ? getAttraction(r.attractionId) : null
                  return (
                    <div key={r.id} className="record-item">
                      <span className="record-dot" style={{ background: meta.tone }} aria-hidden="true" />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <p className="small" style={{ fontWeight: 700 }}>
                          {r.templateId}
                          {a ? ` · ${a.name}` : ''}
                        </p>
                        <p className="xs muted">
                          {r.dateKey} · {meta.label}
                          {r.coinsGranted ? ` · 获得 ${r.coinsGranted} 金币` : ' · 未获得金币'}
                          {r.verifyMethod ? ` · ${VERIFY_TEXT[r.verifyMethod] ?? r.verifyMethod}` : ''}
                          {r.verifyDowngraded ? '（演示环境降级为手动确认）' : ''}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <p className="xs muted">最多显示最近 60 条。跳过与不感兴趣都不会有任何惩罚。</p>
              </div>
            )}
          </section>
        )}

        {/* ================= 4. 提醒偏好 ================= */}
        {tab === 'prefs' && (
          <section style={{ marginTop: 'var(--sp-5)' }} className="stack stack-5">
            <div className="card card-pad">
              <h3 className="card-title">频率与时段</h3>
              <p className="small muted" style={{ marginTop: 8 }}>
                默认已经很克制：每天最多 {DEFAULT_PREFS.maxPerDay} 次、两次之间至少间隔{' '}
                {DEFAULT_PREFS.cooldownMin} 分钟、{DEFAULT_PREFS.quietHours[0]}:00–
                {String(DEFAULT_PREFS.quietHours[1]).padStart(2, '0')}:00 不打扰。
              </p>

              <div className="scene-grid" style={{ marginTop: 'var(--sp-4)' }}>
                <div className="field">
                  <label className="label" htmlFor="maxPerDay">
                    每天最多提醒次数
                  </label>
                  <input
                    id="maxPerDay"
                    className="input"
                    type="number"
                    min="0"
                    max="6"
                    value={prefs.maxPerDay}
                    onChange={(e) => updatePrefs({ maxPerDay: Number(e.target.value) })}
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="cooldownMin">
                    两次提醒的最小间隔（分钟）
                  </label>
                  <input
                    id="cooldownMin"
                    className="input"
                    type="number"
                    min="0"
                    max="360"
                    step="15"
                    value={prefs.cooldownMin}
                    onChange={(e) => updatePrefs({ cooldownMin: Number(e.target.value) })}
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="maxSurfaces">
                    同一提醒最多出现次数
                  </label>
                  <input
                    id="maxSurfaces"
                    className="input"
                    type="number"
                    min="1"
                    max="10"
                    value={prefs.maxSurfacesPerTemplate}
                    onChange={(e) => updatePrefs({ maxSurfacesPerTemplate: Number(e.target.value) })}
                  />
                  <p className="field-hint">达到次数后自动静音，不会反复出现。</p>
                </div>
              </div>

              <div className="stack stack-2" style={{ marginTop: 'var(--sp-4)' }}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={prefs.allowLocation}
                    onChange={(e) => updatePrefs({ allowLocation: e.target.checked })}
                  />
                  <span className="small">允许基于位置的提醒（演示环境为模拟位置，不读取真实定位）</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={prefs.showSafetyTip}
                    onChange={(e) => updatePrefs({ showSafetyTip: e.target.checked })}
                  />
                  <span className="small">在任务卡上显示安全提示</span>
                </label>
              </div>
            </div>

            <div className="card card-pad">
              <h3 className="card-title">已静音的类别与提醒</h3>
              <p className="small muted" style={{ marginTop: 8 }}>
                点过「不感兴趣」的内容会出现在这里，随时可以撤销——撤销后就重新参与提醒。
              </p>

              <div className="stack stack-4" style={{ marginTop: 'var(--sp-4)' }}>
                <div>
                  <p className="label" style={{ marginBottom: 8 }}>
                    整类静音
                  </p>
                  {(prefs.mutedCategories ?? []).length === 0 ? (
                    <p className="small muted">没有静音的类别。</p>
                  ) : (
                    <div className="filter-chips">
                      {prefs.mutedCategories.map((c) => (
                        <button
                          key={c}
                          className="chip on"
                          onClick={() => restoreMuted({ category: c })}
                          title="点击撤销"
                        >
                          {TASK_CATEGORIES.find((x) => x.key === c)?.label ?? c} ✕
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="label" style={{ marginBottom: 8 }}>
                    单条静音
                  </p>
                  {(prefs.mutedTemplates ?? []).length === 0 ? (
                    <p className="small muted">没有静音的提醒。</p>
                  ) : (
                    <div className="filter-chips">
                      {prefs.mutedTemplates.map((t) => (
                        <button
                          key={t}
                          className="chip on"
                          onClick={() => restoreMuted({ templateId: t })}
                          title="点击撤销"
                        >
                          {t} ✕
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="card card-pad">
              <h3 className="card-title">关于金币与萌宠</h3>
              <ul className="small muted" style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.9 }}>
                <li>{QUEST_COPY.coinsNoCash}</li>
                <li>{QUEST_COPY.petsVirtual}</li>
                <li>不做也完全没关系：跳过不会扣金币，也不会降低之后提醒的质量。</li>
              </ul>
              <div className="row row-2 wrap" style={{ marginTop: 'var(--sp-4)' }}>
                <Link className="btn btn-secondary btn-sm" to="/pets">
                  去萌宠页
                </Link>
                <Link className="btn btn-ghost btn-sm" to="/profile?tab=coins">
                  金币明细（{ledger.length} 条）
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>

      {editing && (
        <EditPreItemModal
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await updatePreItem(editing.id, patch)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

/* --------------------------------------------------------------------------
   编辑预录项目
   -------------------------------------------------------------------------- */
function EditPreItemModal({ item, onClose, onSave }) {
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState(item.category)
  const [expectedTime, setExpectedTime] = useState(item.expectedTime)
  const [priority, setPriority] = useState(item.priority)
  const [note, setNote] = useState(item.note ?? '')

  return (
    <Modal
      title="编辑清单项目"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSave({ name, category, expectedTime, priority, note })}
            disabled={!name.trim()}
          >
            保存
          </button>
        </>
      }
    >
      <div className="stack stack-4">
        <div className="field">
          <label className="label" htmlFor="editName">
            名称
          </label>
          <input
            id="editName"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
        </div>

        <div className="field">
          <span className="label">类型</span>
          <div className="filter-chips">
            {PRE_ITEM_CATEGORIES.map((c) => (
              <button
                key={c.key}
                className={`chip ${category === c.key ? 'on' : ''}`}
                onClick={() => setCategory(c.key)}
                aria-pressed={category === c.key}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="row row-3 wrap">
          <div className="field grow">
            <label className="label" htmlFor="editTime">
              期望时间
            </label>
            <select
              id="editTime"
              className="input"
              value={expectedTime}
              onChange={(e) => setExpectedTime(e.target.value)}
            >
              {TIME_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="field grow">
            <label className="label" htmlFor="editPrio">
              优先级
            </label>
            <select
              id="editPrio"
              className="input"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="editNote">
            备注 <span className="opt">（选填）</span>
          </label>
          <textarea
            id="editNote"
            className="input"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如：记得带长焦镜头"
            maxLength={120}
          />
        </div>
      </div>
    </Modal>
  )
}
