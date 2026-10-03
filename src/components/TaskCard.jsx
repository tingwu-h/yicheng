import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { useQuest } from '../store/QuestContext'
import { Modal, Notice } from './ui'
import Pet from './Pet'
import { QUEST_COPY } from '../data/questConfig'

/* ==========================================================================
   任务卡（全站唯一一张，右下角浮出）
   --------------------------------------------------------------------------
   非强迫原则的具体落点，全部在这一屏里可见：
     · 四个出口：稍后提醒 / 今天不再提醒 / 不感兴趣 / 跳过
     · 跳过与关闭都不会扣金币、不会降权、不会记失败
     · 没有倒计时、没有「还剩几次」、没有催办语气
     · 完成是「确认制」：先选校验方式，再确认，避免误点
   ========================================================================== */

export default function TaskCard() {
  const { isLoggedIn } = useApp()
  const {
    activeTask,
    prefs,
    activePet,
    petCatalog,
    line,
    completeTask,
    snoozeTask,
    dismissToday,
    notInterested,
    skipTask,
  } = useQuest()

  const [confirming, setConfirming] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)

  /* 任何一项开关关闭、未登录或没有卡，都不出现 */
  if (!isLoggedIn || !prefs.featureEnabled || !prefs.remindEnabled || !activeTask) return null

  const t = activeTask
  const needVerify = t.verify !== 'manual'
  const petLoadout = petCatalog.find((p) => p.id === activePet.id)?.loadout ?? {}

  const finish = async (method) => {
    setConfirming(false)
    await completeTask(t.id, method)
  }

  return (
    <aside className="task-card" role="complementary" aria-label="任务提醒">
      <div className="task-card-top">
        <span className="tag tag-gold">任务提醒</span>
        <button
          className="task-close"
          onClick={() => skipTask(t.id)}
          aria-label="收起这张任务卡（不做也没关系）"
          title="收起，不做也没关系"
        >
          ×
        </button>
      </div>

      <div className="task-card-body">
        <div className="task-pet">
          {activePet.id ? <Pet petId={activePet.id} loadout={petLoadout} size={54} /> : <span aria-hidden="true">🧭</span>}
        </div>

        <div className="grow">
          <p className="task-say">{line(t.petLineKey)}</p>
          <h3 className="task-title">{t.title}</h3>
          {t.preItemName && <p className="xs muted">清单项目：{t.preItemName}</p>}
        </div>
      </div>

      {t.desc && <p className="small task-desc">{t.desc}</p>}

      {Array.isArray(t.steps) && t.steps.length > 0 && (
        <ol className="task-steps">
          {t.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}

      <div className="task-meta">
        <span className="task-coin">🪙 +{t.coins} 金币</span>
        {t.condition && <span className="xs muted">完成条件：{t.condition}</span>}
      </div>

      {prefs.showSafetyTip && t.safetyTip && (
        <Notice kind="quiet" className="task-safety">
          {t.safetyTip}
        </Notice>
      )}

      {needVerify && (
        <p className="xs muted task-demo-note">
          演示环境没有真实定位与扫码，可手动确认完成；正式接入后为
          {t.verify === 'location' ? '位置校验' : '扫码校验'}。
        </p>
      )}

      {confirming ? (
        <div className="task-confirm">
          <p className="small" style={{ fontWeight: 700 }}>
            确认这个任务已经做完了吗？
          </p>
          <div className="task-actions">
            {needVerify && (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => finish('location')}>
                  已到现场（模拟位置校验）
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => finish('scan')}>
                  模拟扫码核销
                </button>
              </>
            )}
            <button
              className={needVerify ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'}
              onClick={() => finish('manual')}
            >
              手动确认完成
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
              再想想
            </button>
          </div>
        </div>
      ) : (
        <div className="task-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setConfirming(true)}>
            做完了
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => snoozeTask(t.id, 30)}>
            稍后提醒
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => dismissToday(t.id)}>
            今天不再提醒
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setScopeOpen(true)}>
            不感兴趣
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => skipTask(t.id)}>
            跳过
          </button>
        </div>
      )}

      <p className="xs muted task-foot">{QUEST_COPY.nonForcing}</p>

      {scopeOpen && (
        <Modal
          title="不感兴趣"
          desc="告诉萌宠以后少提哪一类。这个选择随时可以在「任务中心 → 提醒偏好」里撤销。"
          onClose={() => setScopeOpen(false)}
          size="sm"
          footer={
            <button className="btn btn-ghost btn-sm" onClick={() => setScopeOpen(false)}>
              取消
            </button>
          }
        >
          <div className="stack stack-3">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setScopeOpen(false)
                notInterested(t.id, 'template')
              }}
            >
              这一条以后都不提
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setScopeOpen(false)
                notInterested(t.id, 'category')
              }}
            >
              这一类都少提
            </button>
            <p className="xs muted">两个选择都不会影响金币、清单或你的行程。</p>
          </div>
        </Modal>
      )}
    </aside>
  )
}
