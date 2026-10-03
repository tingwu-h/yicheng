import { Link } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { useQuest } from '../store/QuestContext'
import { PetAvatar } from './Pet'

/* ==========================================================================
   顶栏小入口：金币余额 + 当前萌宠
   --------------------------------------------------------------------------
   刻意做小：金币与萌宠是加分项，不能盖过「景点 / 行程 / 社区」这些主路径。
   提醒功能关闭时整个入口不出现；未登录时不显示余额，只给一句登录提示。
   ========================================================================== */

export default function CoinBadge() {
  const { isLoggedIn, requireLogin } = useApp()
  const { balance, activePet, prefs, petCatalog } = useQuest()

  if (!isLoggedIn) {
    return (
      <button
        className="coin-badge ghost"
        onClick={() => requireLogin('登录后可完成官方核心任务链解锁秦岭四宝；金币仅购买通用服饰')}
        title="登录后解锁萌宠"
        aria-label="登录后解锁萌宠"
      >
        <span aria-hidden="true">🐾</span>
      </button>
    )
  }

  const loadout = petCatalog.find((p) => p.id === activePet.id)?.loadout ?? {}

  return (
    <Link className="coin-badge" to="/pets" title={`${activePet.name} · ${balance} 金币`}>
      {activePet.id ? <PetAvatar petId={activePet.id} loadout={loadout} size={26} /> : <span aria-hidden="true">🐾</span>}
      <span className="coin-amount">
        <span aria-hidden="true">🪙</span>
        {balance}
      </span>
      {!prefs.remindEnabled && (
        <span className="coin-muted-dot" aria-label="提醒已关闭" title="提醒已关闭" />
      )}
    </Link>
  )
}
