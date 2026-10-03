import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { useQuest } from '../store/QuestContext'
import { PET_ITEMS_BY_ID } from '../data/pets'
import { QUEST_COPY } from '../data/questConfig'
import { Breadcrumb, EmptyState, Notice } from '../components/ui'
import Pet from '../components/Pet'
import PetUpgradeModal from '../components/PetUpgradeModal'
import { CoreChainsPanel } from '../components/Vh02TaskPanels'

/* ==========================================================================
   萌宠与装扮（/pets）
   --------------------------------------------------------------------------
   三块内容：
     1. 秦岭四宝图鉴 —— 通过萌宠获取指南认识并解锁
     2. 装扮         —— 唐装 / 兵马俑盔甲 / 各物种冠饰与披风
     3. 金币明细     —— 每一笔的来路去处，明确不可充值、不可提现
   刻意不做的事：没有充值入口、没有限时折扣、没有「即将过期」。
   ========================================================================== */

const SLOT_LABEL = { back: '披风', outfit: '外袍 / 甲胄', hat: '冠饰' }

const REASON_LABEL = {
  complete: '完成任务',
  itinerary_task: '完成行程任务',
  private_custom_task: '完成私有自建任务',
  unlock: '解锁萌宠',
  buy: '购买装扮',
}

export default function Pets() {
  const { isLoggedIn, setAuthModal } = useApp()
  const { balance, petCatalog, activePet, unlockPet, activatePet, upgradePet, upgradeItem, buyItem, equipItem, unequipSlot, ledger } =
    useQuest()

  const [upgradeTarget,setUpgradeTarget] = useState(null)
  const [detailId, setDetailId] = useState(activePet.id)
  useEffect(() => {
    if (activePet.id) setDetailId(activePet.id)
  }, [activePet.id])

  /* ---------------- 未登录 ---------------- */
  if (!isLoggedIn) {
    return (
      <div className="container page">
        <Breadcrumb items={[{ label: '萌宠' }]} />
        <EmptyState
          icon="🐾"
          title="登录后可以领养秦岭四宝"
          desc="萌宠与装扮是社区身份的一部分，也和任务金币放在一起。不登录仍可自由浏览所有景点与社区内容。"
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

  const detail = petCatalog.find((p) => p.id === detailId) ?? petCatalog[0]
  const equippedCount = Object.keys(detail.loadout ?? {}).length

  return (
    <div className="page">
      <div className="container">
        <Breadcrumb items={[{ label: '个人中心', to: '/profile' }, { label: '萌宠与装扮' }]} />

        <div className="row-between wrap row-4" style={{ marginTop: 'var(--sp-6)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--fs-h1)' }}>秦岭四宝</h1>
            <p className="muted small" style={{ marginTop: 8 }}>
              以西安本地代表性动物为原型：棕色大熊猫「七仔」、朱鹮、川金丝猴、羚牛。
              它们会在合适的时候替你说一句话，不做任务也不会闹脾气。萌宠与服饰可升至 3 级，只改变展示效果。
            </p>
          </div>

          <div className="coin-panel">
            <span className="coin-panel-label">金币余额</span>
            <span className="coin-panel-value">🪙 {balance}</span>
            <Link className="xs" to="/tasks?tab=records" style={{ color: 'var(--cinnabar-700)' }}>
              怎么获得金币 →
            </Link>
          </div>
        </div>

        {/* ================= 图鉴 ================= */}
        <section style={{ marginTop: 'var(--sp-6)' }}>
          <h2 style={{ fontSize: 'var(--fs-h2)' }}>图鉴</h2>
          <p className="small muted" style={{ marginTop: 6 }}>
            {petCatalog.some((p) => p.unlocked) ? '当前同行的是「' + activePet.name + '」。切换随时可以。' : '尚未解锁宠物。跟着萌宠获取指南完成轻松步骤即可认识它，金币不能购买。'}
          </p>

          <div className="pet-grid">
            {petCatalog.map((p) => (
              <article key={p.id} className={`pet-card ${p.active ? 'on' : ''}`}>
                <Pet petId={p.id} loadout={p.loadout} itemLevels={Object.fromEntries(p.items.map((item) => [item.id, (item.appearanceLevel ?? item.level)]))} petLevel={p.appearanceLevel} size={116} mood={p.active ? 'happy' : 'idle'} />

                <div className="pet-card-body">
                  <div className="row row-2 wrap">
                    <h3 className="card-title">{p.name}</h3>
                    {p.active && <span className="tag tag-cinnabar">同行中</span>}
                    {!p.unlocked && <span className="tag tag-outline">未解锁</span>}
                  </div>

                  <p className="xs muted">{p.species}</p>
                  <p className="small muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
                    {p.skillLabel}
                  </p>
                  <p className="xs muted" style={{ marginTop: 6 }}>
                    性格：{p.personality}
                  </p>

                  <div className="row row-2 wrap" style={{ marginTop: 'var(--sp-4)' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDetailId(p.id)}>
                      看话术与装扮
                    </button>

                    {p.unlocked ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setDetailId(p.id); activatePet(p.id) }}
                        disabled={p.active}
                      >
                        {p.active ? '正在同行' : '一起走'}
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => document.getElementById('core-chains')?.scrollIntoView({ behavior: 'smooth' })}
                        disabled={false}
                        title="非强制、可跳过；按步骤完成后解锁"
                      >
                        查看萌宠获取指南
                      </button>
                    )}
                  </div>

                  {!p.unlocked && <p className="xs muted" style={{ marginTop: 8 }}>任务可稍后再做，跳过没有惩罚。</p>}
      {p.unlocked && <div className="level-panel">
                    <div className="row-between"><span className="xs muted">萌宠等级</span><strong className="xs">Lv.{p.level} / 3</strong></div>
                    <p className="xs muted">{p.levelInfo?.name}：{p.levelInfo?.effect}</p>
                    <button className="btn btn-ghost btn-sm" onClick={() => setUpgradeTarget({petId:p.id})}>陪伴成长 · Lv.{p.level}</button><p className="xs muted">陪伴值 {p.growth} · 完成任务积累，不花金币</p>
                  </div>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <div id="core-chains" style={{ marginTop: 'var(--sp-8)' }}><CoreChainsPanel /></div>

        {/* ================= 话术与装扮 ================= */}
        <section style={{ marginTop: 'var(--sp-8)' }}>
          <div className="row-between wrap row-3">
            <div>
              <h2 style={{ fontSize: 'var(--fs-h2)' }}>{detail.name} 的话术与装扮</h2>
              <p className="small muted" style={{ marginTop: 6 }}>
                {detail.personality} · 说话风格会出现在任务卡与站内消息里
              </p>
            </div>
            <span className="tag tag-outline">已穿戴 {equippedCount} 件</span>
          </div>

          <div className="pet-detail">
            <div className="pet-detail-preview">
              <Pet petId={detail.id} loadout={detail.loadout} itemLevels={Object.fromEntries(detail.items.map((item) => [item.id, (item.appearanceLevel ?? item.level)]))} petLevel={detail.appearanceLevel} size={180} mood="happy" />
              <p className="xs muted" style={{ textAlign: 'center' }}>
                装扮按「披风 / 外袍 / 冠饰」三层叠加
              </p>
            </div>

            <div className="grow stack stack-4">
              <div className="card card-pad">
                <p className="label" style={{ marginBottom: 10 }}>
                  它会怎么说
                </p>
                <ul className="pet-lines">
                  {['greet', 'suggest', 'complete', 'skip'].map((k) => (
                    <li key={k}>
                      <span className="pet-line-key">
                        {{ greet: '见面', suggest: '建议', complete: '完成', skip: '跳过' }[k]}
                      </span>
                      {detail.lines[k]}
                    </li>
                  ))}
                </ul>
              </div>

              {['back', 'outfit', 'hat'].map((slot) => {
                const items = detail.items.filter((i) => i.slot === slot)
                if (!items.length) return null
                return (
                  <div key={slot} className="card card-pad">
                    <p className="label" style={{ marginBottom: 10 }}>
                      {SLOT_LABEL[slot]}
                    </p>

                    <div className="stack stack-2">
                      {items.map((it) => (
                        <div key={it.id} className="item-row"><div className="pet-item-thumbnail"><Pet petId={detail.id} loadout={{[it.slot]:it.id}} itemLevels={{[it.id]:it.appearanceLevel}} petLevel={detail.appearanceLevel} size={78} title={it.name+"穿戴示意"}/></div>
                          <div className="grow" style={{ minWidth: 0 }}>
                            <p className="small" style={{ fontWeight: 700 }}>
                              {it.name}
                              {it.equipped && <span className="tag tag-gold" style={{ marginLeft: 8 }}>已穿戴</span>}
                              {!it.owned && it.petId && <span className="tag tag-outline" style={{ marginLeft: 8 }}>专属</span>}
                            </p>
                            <p className="xs muted">{it.desc}</p>
                            <p className="xs muted">等级 Lv.{it.level} / 3 · {it.level >= 3 ? '珍藏款刺绣与互动细节' : it.level === 2 ? '精致滚边与流苏' : '基础外观'}</p>
                          </div>

                          {!it.owned && it.petId === null ? (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => buyItem(it.id)}
                              disabled={balance < it.price}
                              title={balance < it.price ? `还差 ${it.price - balance} 枚金币` : ''}
                            >
                              🪙 {it.price}
                            </button>
                          ) : !it.owned ? (
                            <span className="xs muted">{it.acquisition === 'core' ? '萌宠获取指南解锁' : it.acquisition === 'activity' ? '活动任务获取' : '景点任务掉落'}</span>
                          ) : !detail.unlocked ? (
                            <span className="xs muted">解锁宠物后穿戴</span>
                          ) : <div className="row row-2 wrap" style={{ justifyContent: 'flex-end' }}>
                            {it.equipped ? <button className="btn btn-ghost btn-sm" onClick={() => unequipSlot(detail.id, slot)}>卸下</button> : <button className="btn btn-secondary btn-sm" onClick={() => equipItem(detail.id, it.id)}>穿上</button>}
                            <button className="btn btn-ghost btn-sm" onClick={() => setUpgradeTarget({petId:detail.id,itemId:it.id})}>{it.level>=3 ? "外观设置" : "预览与升级"}</button>
                          </div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ================= 金币明细 ================= */}
        <section style={{ marginTop: 'var(--sp-8)' }}>
          <h2 style={{ fontSize: 'var(--fs-h2)' }}>金币明细</h2>
          <p className="small muted" style={{ marginTop: 6 }}>
            {QUEST_COPY.coinsNoCash}
          </p>

          <Notice kind="quiet" className="mt-4">
            {QUEST_COPY.petsVirtual} 萌宠靠任务陪伴成长，服饰用任务金币升级；不影响任务或金币收益。
          </Notice>

          <div className="stack stack-2" style={{ marginTop: 'var(--sp-4)' }}>
            {ledger.length === 0 ? (
              <EmptyState
                icon="🪙"
                title="还没有金币记录"
                desc="完成任务后会有金币入账，这里会显示每一笔的来路与去处。"
                actions={
                  <Link className="btn btn-primary" to="/tasks">
                    去任务中心
                  </Link>
                }
              />
            ) : (
              ledger.slice(0, 50).map((e) => (
                <div key={e.id} className="coin-row">
                  <span className={`coin-delta ${e.delta > 0 ? 'plus' : 'minus'}`}>
                    {e.delta > 0 ? '+' : ''}
                    {e.delta}
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <p className="small" style={{ fontWeight: 700 }}>
                      {REASON_LABEL[e.reason] ?? e.reason}
                      {e.refType === 'item' && PET_ITEMS_BY_ID[e.refId] ? ` · ${PET_ITEMS_BY_ID[e.refId].name}` : ''}
                    </p>
                    <p className="xs muted">
                      {new Date(e.createdAt).toLocaleString('zh-CN')} · 余额 {e.balanceAfter}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        {upgradeTarget && <PetUpgradeModal {...upgradeTarget} onClose={() => setUpgradeTarget(null)}/>}
      </div>
    </div>
  )
}
