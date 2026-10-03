# 任务提醒 / 金币 / 萌宠 · 数据模型

## 一、两层结构

| 层 | 位置 | 作用 |
| --- | --- | --- |
| 本地持久化 | `src/store/questStore.js` → localStorage 键 `changan-banlv-quest-v1` | 演示版的「一张库」，带 `schemaVersion` 与 `migrate()` |
| 服务端建表 | `docs/quest/migrations/001_quest.sql` | 接入后端时的建表脚本，字段与本地集合一一对应 |

**关键约束**：本地键与既有的 `changan-banlv-state-v1`（登录/收藏/行程/草稿）
完全分离，互不影响；SQL 脚本也只 `CREATE TABLE`，不对任何既有表做 `ALTER`。

## 二、集合与字段

### 1. `preItems` — 用户预录项目

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键，`pi-` 前缀 |
| `userId` | string | 用户 ID（演示版固定 `me`） |
| `attractionId` | string | 景点 ID |
| `poiId` | string \| null | 来源 POI；自定义条目为空 |
| `name` | string | 项目名称，**写前过词表** |
| `category` | `spot` \| `photo` \| `activity` \| `food` | 想玩 / 想拍 / 想体验 / 想吃 |
| `expectedTime` | `不限` \| `上午` \| `中午` \| `下午` \| `傍晚` \| `夜晚` | 期望时间 |
| `priority` | `high` \| `mid` \| `low` | 必去 / 想去 / 随缘，参与打分 |
| `remindEnabled` | boolean | **false 表示这一项完全不参与触发**（不是降权） |
| `status` | `want` \| `done` \| `skipped` | 用户自己的标记，不影响金币 |
| `note` | string | 备注 |
| `createdAt` / `updatedAt` | ISO string | 时间戳 |

→ 表：`quest_pre_items`

### 2. `taskTemplates` — 任务模板（配置）

位于 `src/data/questConfig.js`，是**配置而非用户数据**，因此不写进 localStorage。
接后端后由 `quest_task_templates` 表下发。

| 字段 | 说明 |
| --- | --- |
| `id` | 模板 ID，如 `t-photo-spot` |
| `category` | `sight` / `photo` / `food` / `rest` / `queue` / `weather` / `family` / `record` / `prepare` |
| `preCategories` | 适合哪些预录类型；空数组 = 通用任务 |
| `trigger` | `{ type, params }`，type 为 `time` / `location` / `weather` / `queue` / `duration` |
| `steps` / `condition` | 任务卡上的步骤与完成条件 |
| `difficulty` | `easy` 5 币 / `normal` 10 币 / `hard` 20 币（`DIFFICULTY_COINS`） |
| `verify` | `manual` / `location` / `scan` |
| `petLineKey` | 萌宠话术键 |
| `safetyTip` | 安全提示 |
| `cooldownMin` | 冷却分钟 |
| `enabled` | 是否启用 |

→ 表：`quest_task_templates`

### 3. `taskRecords` — 任务记录

| 字段 | 说明 |
| --- | --- |
| `id` | 主键，`tr-` 前缀；同时是任务卡上「完成」按钮的 `taskId` |
| `templateId` / `preItemId` / `attractionId` | 关联关系 |
| `dateKey` | 归属日期（**本地时区**，不是 UTC），每日上限与冷却按它统计 |
| `state` | `surfaced` / `completed` / `skipped` / `snoozed` / `dismissedToday` / `notInterested` |
| `verifyMethod` | `manual` / `location` / `scan` |
| `verifyDowngraded` | 演示环境降级为手动确认时置 true，界面如实标注 |
| `coinsGranted` | 本记录发放的金币（跳过与拒绝恒为 0） |
| `idempotencyKey` | `task:{userId}:{templateId}:{dateKey}`，唯一 |
| `surfacedAt` / `completedAt` / `snoozeUntil` | 时间点 |
| `context` | 触发时的场景快照，含 `simulated: true` |

→ 表：`quest_task_records`

### 4. `coinLedger` — 金币流水

| 字段 | 说明 |
| --- | --- |
| `delta` | 正数为任务所得，负数为解锁/购买 |
| `balanceAfter` | 记账后余额，便于对账 |
| `reason` | **只有 `complete` / `unlock` / `buy` 三种** |
| `refType` / `refId` / `templateId` | 关联来源 |
| `idempotencyKey` | 发币幂等键，唯一索引 |

> 结构上不存在充值、提现、现金兑换的字段与枚举值——这是「不可变现」的硬约束，
> 不是靠文案声明。

→ 表：`quest_coin_ledger`

### 5. `pets` / `petItems` — 萌宠与装扮（配置）

位于 `src/data/pets.js`：

- 四只萌宠：`pet-qizai`（七仔，棕色大熊猫，默认解锁）、`pet-zhuhuan`（朱鹮，60 币）、
  `pet-jinsihou`（川金丝猴，90 币）、`pet-lingniu`（羚牛，120 币）。
- 每只含 `personality`、`skill`、`skillLabel`、`palette`（程序化 SVG 配色）、
  `lines`（各场景话术）。
- 装扮 `PET_ITEMS`：`slot` 为 `back`（披风）/ `outfit`（外袍或甲胄）/ `hat`（冠饰）；
  通用件 `petId: null`，专属件绑定物种。价格区间 30–80 币。

→ 表：`quest_pets`、`quest_pet_items`

### 6. `userPets` / `ownedItems` / `loadouts` / `activePetId` — 用户萌宠状态

| 集合 | 说明 |
| --- | --- |
| `userPets` | `[{ petId, unlockedAt }]`，初始含默认萌宠 |
| `activePetId` | 当前同行萌宠 |
| `ownedItems` | 已购买装扮的 ID 数组 |
| `loadouts` | `{ [petId]: { back, outfit, hat } }`，按槽位存 itemId |

→ 表：`quest_user_pets`、`quest_user_pet_items`、`quest_user_loadouts`、`quest_user_active_pet`

### 7. `questPrefs` — 偏好与开关（非强迫原则的落点）

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `featureEnabled` | true | 灰度总开关；关闭后连定时器都不再问引擎 |
| `remindEnabled` | true | 提醒开关；关闭不清空清单与金币 |
| `maxPerDay` | 2 | 每日最多提醒次数（每次仍只出 1 张卡） |
| `cooldownMin` | 45 | 两次提醒最小间隔 |
| `quietHours` | `[22, 8]` | 安静时段，支持跨零点 |
| `mutedCategories` | `[]` | 整类静音，**可撤销** |
| `mutedTemplates` | `[]` | 单条静音，**可撤销** |
| `maxSurfacesPerTemplate` | 3 | 同一模板出现次数上限，达到后自动静音 |
| `allowLocation` | true | 是否基于位置提醒（演示为模拟位置） |
| `showSafetyTip` | true | 是否在任务卡显示安全提示 |
| `surfaceCounts` | `{}` | 各模板已出现次数 |

→ 表：`quest_user_prefs`

### 8. `events` — 埋点

最多保留 200 条（`MAX_EVENTS`），见 [EVENTS.md](./EVENTS.md)。→ 表：`quest_events`

## 三、版本与迁移

```js
QUEST_SCHEMA_VERSION = 1        // src/store/questStore.js
migrateQuestState(raw)          // v0 → v1：补 schemaVersion、补默认偏好、补默认萌宠
```

迁移规则：

1. **只加字段，不改语义**。新字段一律先在 `defaultQuestState()` 里给默认值，
   再在 `migrateQuestState` 里补写。
2. 老数据、手工改过的数据、`null`、字符串等异常输入都要能读起来，
   读不了就退回默认值（已由自测覆盖：`损坏数据不会让界面崩掉`）。
3. 版本高于当前代码时**不做降级**，只补缺字段，保证不丢用户数据。
4. 重置入口：`resetQuestState()`（设置页二次确认后调用），只删任务键，
   不影响 `changan-banlv-state-v1` 里的收藏、行程与账号。

## 四、POI 数据来源

预录项目的可选条目有两个来源（`questEngine.derivePois`）：

1. **景点自带**：`src/data/attractions.js` 里的 `pois` 字段。
   目前试点补了 5 个景点：`a1` 秦始皇帝陵博物院、`a3` 西安城墙、`a4` 陕西历史博物馆、
   `a6` 大唐不夜城、`a9` 回民街。
2. **自动派生**：没有 `pois` 的景点，从 `highlights` / `tips` / `bestTime` 按关键词
   归到 `spot` / `photo` / `activity` / `food` 四类，标记 `source: 'derived'`，
   界面上会注明「由景点亮点派生」。

自测里有一条断言保证 **24 个景点都不会出现空清单**。
