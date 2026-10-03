# 任务提醒 / 金币 / 萌宠 · 埋点事件

## 一、落地方式

| 环境 | 落点 |
| --- | --- |
| 演示版（当前） | `quest.events` 数组，localStorage，最多 200 条 |
| 后端版 | `quest_events` 表（`docs/quest/migrations/001_quest.sql`） |

事件常量集中定义在 `src/services/questApi.js` 的 `EVENTS`，**不要在组件里写字面量**，
避免改名时漏改。

查看方式：行前清单页的请求记录，或在浏览器控制台执行

```js
JSON.parse(localStorage.getItem('changan-banlv-quest-v1')).events
```

## 二、事件清单

| 事件名 | 触发点 | payload | 用途 |
| --- | --- | --- | --- |
| `quest_task_surfaced` | 下发任务卡 | `templateId`、`preItemId`、`simulated` | 提醒量、打扰度是否过高 |
| `quest_task_completed` | 完成任务 | `taskId`、`templateId`、`coins`、`verifyMethod`、`downgraded` | 任务完成率 |
| `quest_task_skipped` | 点「跳过」 | `taskId`、`templateId` | 内容质量与打扰度 |
| `quest_task_snoozed` | 点「稍后提醒」 | `taskId`、`minutes` | 时机是否合适 |
| `quest_task_dismissed_today` | 点「今天不再提醒」 | `taskId`、`templateId` | 时机是否合适 |
| `quest_task_not_interested` | 点「不感兴趣」 | `taskId`、`scope`、`templateId`、`category` | 哪些类别不受欢迎 |
| `quest_pre_item_created` | 新增预录项目 | `id`、`attractionId`、`category` | 需求侧偏好 |
| `quest_pre_item_updated` | 编辑预录项目 | `id`、`keys` | —— |
| `quest_pre_item_deleted` | 删除预录项目 | `id` | —— |
| `quest_coin_granted` | 发放金币 | `coins`、`balance`、`refId` | 金币产出速率（与定价是否匹配） |
| `quest_coin_spent` | 消耗金币 | `amount`、`refId` | 金币消耗出口 |
| `quest_pet_unlocked` | 解锁萌宠 | `petId`、`cost` | 解锁转化 |
| `quest_pet_activated` | 切换同行萌宠 | `petId` | 萌宠偏好分布 |
| `quest_item_bought` | 购买装扮 | `itemId`、`price` | 装扮受欢迎程度 |
| `quest_item_equipped` | 穿戴/卸下装扮 | `petId`、`itemId`、`slot` | 装扮使用率 |
| `quest_prefs_updated` | 修改偏好或撤销静音 | `keys` 或 `restore` | 有多少人选择关闭（关键健康度指标） |

## 三、建议盯的四个指标

1. **关闭率**：`quest_prefs_updated` 中 `remindEnabled: false` 的占比。
   这是「非强迫」是否真的成立的唯一硬指标；上升说明提醒变烦了。
2. **拒绝率**：`quest_task_skipped` + `quest_task_not_interested` ÷ `quest_task_surfaced`。
   高于约六成，说明任务内容或时机需要重做。
3. **完成率**：`quest_task_completed` ÷ `quest_task_surfaced`。
4. **金币产出/消耗比**：`quest_coin_granted` 与 `quest_coin_spent` 的比值。
   长期只看不花（比值持续偏高），说明装扮供给不足或定价偏低。

## 四、刻意不采集的内容

- **不采集真实定位轨迹**：演示版只有模拟场景，`context.simulated` 恒为 true。
- **不采集内容正文**用于画像：埋点只带 ID 与枚举值，不带用户输入的文本。
- **不做「未完成」类负向事件**：没有 `task_failed`、`task_expired`、`task_missed`。
  这类事件一旦存在，产品逻辑就会自然而然地开始催人。
