import { useMemo, useState } from 'react'
import { Modal, Notice } from './ui'
import { useQuest } from '../store/QuestContext'
import {
  PRE_ITEM_CATEGORIES,
  PRIORITIES,
  TIME_SLOTS,
  QUEST_COPY,
} from '../data/questConfig'

/* ==========================================================================
   预录项目选择器（景点详情页与行前清单共用）
   --------------------------------------------------------------------------
   项目来源有两处：
     1. 景点自带的结构化 POI（试点景点在 data/attractions.js 里补了 pois 字段）；
     2. 由景点亮点派生的建议（derivePois），保证任何景点都能选中东西。
   用户可以改名字，也可以完全自己写一条。
   ========================================================================== */

export default function PreItemPicker({ attraction, onClose }) {
  const { poisFor, addPreItem, preItemsOf } = useQuest()

  const pois = useMemo(() => poisFor(attraction), [poisFor, attraction])
  const mine = useMemo(() => preItemsOf(attraction.id), [preItemsOf, attraction.id])
  const recordedNames = useMemo(() => new Set(mine.map((x) => x.name)), [mine])

  const [name, setName] = useState('')
  const [category, setCategory] = useState('spot')
  const [expectedTime, setExpectedTime] = useState('不限')
  const [priority, setPriority] = useState('mid')
  const [remindEnabled, setRemindEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  const pickPoi = (poi) => {
    setName(poi.name)
    setCategory(poi.category)
  }

  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    const created = await addPreItem(attraction.id, {
      name: name.trim(),
      category,
      expectedTime,
      priority,
      remindEnabled,
    })
    setSaving(false)
    if (created) {
      setName('')
      onClose?.()
    }
  }

  return (
    <Modal
      title={`记录想玩的项目 · ${attraction.name}`}
      desc="先记下来，到了地方再由你决定做不做。不记录也不影响任何浏览与行程功能。"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!name.trim() || saving}>
            {saving ? '正在保存…' : '记入清单'}
          </button>
        </>
      }
    >
      {/* ---------------- 可选项目 ---------------- */}
      <section className="stack stack-3">
        <h3 className="small" style={{ fontWeight: 700 }}>
          这个景点的可选项目
        </h3>

        <div className="poi-list">
          {pois.map((poi) => {
            const cat = PRE_ITEM_CATEGORIES.find((c) => c.key === poi.category) ?? PRE_ITEM_CATEGORIES[0]
            const done = recordedNames.has(poi.name)
            const on = name === poi.name
            return (
              <button
                key={poi.id}
                className={`poi-item ${on ? 'on' : ''}`}
                onClick={() => pickPoi(poi)}
                aria-pressed={on}
              >
                <span className="poi-icon" aria-hidden="true">
                  {cat.icon}
                </span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="poi-name clamp-2">{poi.name}</span>
                  <span className="xs muted">
                    {cat.label}
                    {poi.source === 'derived' ? ' · 由景点亮点派生' : ' · 景点资料'}
                    {done ? ' · 已在清单' : ''}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <p className="xs muted">
          派生出来的项目只是建议，可以在下面改成你自己的说法。全部 {pois.length} 条。
        </p>
      </section>

      {/* ---------------- 自定义名称 ---------------- */}
      <section className="stack stack-3" style={{ marginTop: 'var(--sp-5)' }}>
        <div className="field">
          <label className="label" htmlFor="preName">
            项目名称
          </label>
          <input
            id="preName"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：在城墙东南角拍一张日落"
            maxLength={40}
          />
          <p className="field-hint">可以从上面挑一条，也可以自己写。名称会过一遍词表，避免出现促销类字样。</p>
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
            <label className="label" htmlFor="preTime">
              期望时间
            </label>
            <select id="preTime" className="input" value={expectedTime} onChange={(e) => setExpectedTime(e.target.value)}>
              {TIME_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="field grow">
            <label className="label" htmlFor="prePrio">
              优先级
            </label>
            <select id="prePrio" className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={remindEnabled}
            onChange={(e) => setRemindEnabled(e.target.checked)}
          />
          <span className="small">
            允许在合适的时间提醒这一项
            <span className="xs muted">（关掉后这一项不会被任何任务卡提到）</span>
          </span>
        </label>
      </section>

      <Notice kind="quiet" className="mt-6">
        {QUEST_COPY.nonForcing}
      </Notice>
    </Modal>
  )
}
