# 任务提醒 / 金币 / 萌宠 · 接口契约

本文件是**契约**：先定接口，再写实现。当前实现是纯前端版本
（`src/services/questApi.js`，数据落在 localStorage），接后端时按本文档换成同签名的
`fetch` 即可，**调用方（`src/store/QuestContext.jsx`）一行都不用改**。

---

## 一、通用约定

### 1. 统一返回格式

```json
{ "code": 0, "message": "ok", "data": {} }
```

| 字段 | 说明 |
| --- | --- |
| `code` | `0` 表示成功，其它为错误码（见下表）。界面只在 `code !== 0` 时弹提示 |
| `message` | 直接可展示给用户的中文短句。**不允许**出现催促、焦虑、导流类措辞 |
| `data` | 业务数据，失败时为 `null` |

> 本地适配器额外返回一个 `state` 字段（改动后的完整状态）。
> 这是 localStorage 版特有的：服务端版本不需要它，调用方也不应依赖它。

### 2. 错误码

| code | 含义 | 界面表现 |
| --- | --- | --- |
| `0` | 成功 | 按需 Toast |
| `40001` | 参数不合法（含被词表拦截） | 指出具体字段与修正方向 |
| `40201` | 金币不足 | 提示还差多少，不诱导充值 |
| `40301` | 未登录 | 弹登录框，并说明登录后可获得的能力 |
| `40401` | 记录不存在 / 已过期 | 提示卡片已过期并刷新 |
| `40901` | 重复提交（幂等命中） | 友好提示「今天已经记过了」，不报错 |

### 3. 本地适配器的调用方式

```js
import * as api from '../services/questApi'

const res = await api.createPreItem(currentState, { userId: 'me', attractionId: 'a1', name: '一号坑军阵全景' })
if (res.code === 0) setState(res.state)
```

服务端版本（将来）：

```js
const res = await request('POST', '/api/quest/pre-items', body) // 返回 { code, message, data }
```

### 4. 鉴权与权限

- 写操作一律要求登录：`createPreItem`、`updatePreItem`、`deletePreItem`、
  `completeTask`、`unlockPet`、`buyItem`、`equipItem`、`unequipSlot`。
- 读操作对游客开放，但游客没有清单时不会产生任何任务卡（见「非强迫」一节）。

---

## 二、端点清单

| 方法 | 路径 | 本地实现 |
| --- | --- | --- |
| GET | `/api/quest/pre-items?attractionId=` | `listPreItems` |
| POST | `/api/quest/pre-items` | `createPreItem` |
| PATCH | `/api/quest/pre-items/:id` | `updatePreItem` |
| DELETE | `/api/quest/pre-items/:id` | `deletePreItem` |
| POST | `/api/quest/tasks/next` | `nextTask` |
| POST | `/api/quest/tasks/:id/complete` | `completeTask` |
| POST | `/api/quest/tasks/:id/snooze` | `snoozeTask` |
| POST | `/api/quest/tasks/:id/dismiss-today` | `dismissToday` |
| POST | `/api/quest/tasks/:id/not-interested` | `notInterested` |
| POST | `/api/quest/tasks/:id/skip` | `skipTask` |
| GET | `/api/quest/tasks/records` | `listTaskRecords` |
| POST | `/api/quest/muted/restore` | `restoreMuted` |
| GET | `/api/quest/coins` | `getCoins` |
| GET | `/api/quest/pets` | `listPets` |
| POST | `/api/quest/pets/:id/unlock` | `unlockPet` |
| POST | `/api/quest/pets/:id/activate` | `activatePet` |
| POST | `/api/quest/pet-items/:id/buy` | `buyItem` |
| POST | `/api/quest/pets/:id/equip` | `equipItem` |
| DELETE | `/api/quest/pets/:id/equip/:slot` | `unequipSlot` |
| GET | `/api/quest/prefs` | `getPrefs` |
| PATCH | `/api/quest/prefs` | `updatePrefs` |
| PUT | `/api/quest/scene` | `updateScene` |
| GET | `/api/quest/events?event=&limit=` | `listEvents` |

---

## 三、关键接口示例

### 1. 创建预录项目

`POST /api/quest/pre-items`

```json
{
  "attractionId": "a1",
  "poiId": "a1-p1",
  "name": "一号坑军阵全景",
  "category": "photo",
  "expectedTime": "上午",
  "priority": "high",
  "remindEnabled": true,
  "note": "记得带长焦"
}
```

成功（`200`）：

```json
{
  "code": 0,
  "message": "已记入清单",
  "data": {
    "id": "pi-m3k2a1-x9f2q",
    "userId": "me",
    "attractionId": "a1",
    "poiId": "a1-p1",
    "name": "一号坑军阵全景",
    "category": "photo",
    "expectedTime": "上午",
    "priority": "high",
    "remindEnabled": true,
    "note": "记得带长焦",
    "status": "want",
    "createdAt": "2026-08-15T01:20:00.000Z",
    "updatedAt": "2026-08-15T01:20:00.000Z"
  }
}
```

重复添加（同一景点 + 同名 + 同类型）：`code` 仍为 `0`，`message` 为
「这个项目已经在清单里了」，`data` 返回已存在的那条——**不报错**，避免用户困惑。

被词表拦截：

```json
{ "code": 40001, "message": "名称里有不适合的词「限时」，换一个说法吧", "data": null }
```

### 2. 请求下一张任务卡

`POST /api/quest/tasks/next`

```json
{
  "scene": {
    "atAttractionId": "a1",
    "region": "lintong",
    "weather": "晴",
    "queueKey": "long",
    "queueWaitMin": 40,
    "visitMinutes": 160,
    "demoHour": null
  },
  "now": "2026-08-15T09:30:00.000Z"
}
```

> `scene` 是**演示环境的场景模拟**输入。正式环境由服务端从定位、天气、排队
> 三个数据源构造同一个结构，前端与引擎不需要改动。`simulated: true` 会写进
> 任务记录的 `context` 里，便于区分演示数据与真实数据。

下发成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "reason": "ok",
    "petLine": "拍照别站正中间，往旁边挪两步更好看。",
    "task": {
      "id": "tr-m3k2b7-p1a2c",
      "templateId": "t-photo-spot",
      "title": "找到你的机位",
      "desc": "人多的时候，往侧面走两步往往比正面更好拍。",
      "steps": ["绕开正面人群，找侧面或斜角", "蹲低一点，让建筑占满上半幅", "拍 3 张不同角度"],
      "condition": "拍到 1 张自己满意的照片",
      "difficulty": "easy",
      "coins": 5,
      "verify": "location",
      "petLineKey": "photo",
      "safetyTip": "在水边、台阶、城墙上拍照时留意脚下，不要退到边缘。",
      "category": "photo",
      "preItemName": "一号坑军阵全景",
      "attractionId": "a1",
      "dateKey": "2026-08-15"
    }
  }
}
```

本次不提醒（这同样是**正常返回**，不是错误）：

```json
{ "code": 0, "message": "ok", "data": { "task": null, "reason": "quiet-hours" } }
```

`reason` 取值与界面文案（见 `QuestContext.QUIET_REASON_TEXT`）：

| reason | 含义 | 界面文案 |
| --- | --- | --- |
| `feature-off` | 总开关关闭 | 提醒功能已关闭 |
| `remind-off` | 提醒开关关闭 | 提醒已暂停，清单与金币都还在 |
| `no-pre-items` | 清单为空 | 清单还是空的，先记几个想玩的项目 |
| `quiet-hours` | 安静时段 | 现在是安静时段（默认 22:00–08:00） |
| `daily-limit` | 当日次数用完 | 今天提醒的次数已经用完了 |
| `cooldown` | 冷却期内 | 刚提醒过不久，过一会儿再说 |
| `off-hours` | 不在可提醒时段 | 这个时间点暂不提醒 |
| `no-candidate` | 无匹配任务 | 按当前场景，没有合适的提醒 |
| `already-active` | 已有卡片待处理 | 有一张任务卡正在等你处理 |

**每次最多返回一张卡**（`task` 是对象，不是数组），这是引擎的结构性约束。

### 3. 完成任务并发放金币

`POST /api/quest/tasks/tr-m3k2b7-p1a2c/complete`

```json
{ "verifyMethod": "location" }
```

成功：

```json
{
  "code": 0,
  "message": "完成，获得 5 金币",
  "data": { "granted": 5, "balance": 35, "duplicated": false, "downgraded": false }
}
```

重复完成（幂等命中）：

```json
{ "code": 40901, "message": "这个任务今天已经完成过了", "data": null }
```

> 幂等键为 `task:{userId}:{templateId}:{dateKey}`，唯一索引在
> `quest_coin_ledger.idempotency_key`。同一天同一模板**只可能发一次币**。

演示环境降级（模板要求位置/扫码，但用 `manual` 确认）：

```json
{ "code": 0, "message": "完成，获得 5 金币",
  "data": { "granted": 5, "balance": 40, "duplicated": false, "downgraded": true } }
```

`downgraded: true` 会写进任务记录，界面如实标注「演示环境降级为手动确认」。

### 4. 四个「随时可以不做」的动作

| 端点 | 请求体 | 效果（都不扣币、不降权） |
| --- | --- | --- |
| `.../snooze` | `{ "minutes": 30 }` | 写 `snoozeUntil`，当场收卡 |
| `.../dismiss-today` | `{}` | 该模板当天不再出现 |
| `.../not-interested` | `{ "scope": "category" }` | 整类静音，可在偏好页撤销 |
| `.../skip` | `{}` | 仅标记 `skipped` 并收卡，**不产生任何负向流水** |

### 5. 金币与萌宠

`GET /api/quest/coins`

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "balance": 40,
    "ledger": [
      { "id": "coin-1", "delta": 5, "balanceAfter": 40, "reason": "complete",
        "refType": "task", "refId": "tr-m3k2b7-p1a2c", "createdAt": "2026-08-15T01:40:00.000Z" }
    ]
  }
}
```

`POST /api/quest/pets/pet-lingniu/unlock`

```json
{ "code": 0, "message": "解锁了羚牛", "data": { "petId": "pet-lingniu", "already": false, "balance": 0 } }
```

金币不足：

```json
{ "code": 40201, "message": "金币不足，还差 80 枚", "data": null }
```

重复解锁（幂等且友好）：

```json
{ "code": 0, "message": "已经解锁过了", "data": { "petId": "pet-lingniu", "already": true } }
```

### 6. 偏好与开关

`PATCH /api/quest/prefs`

```json
{ "patch": { "remindEnabled": false } }
```

```json
{ "code": 0, "message": "设置已保存",
  "data": { "prefs": { "featureEnabled": true, "remindEnabled": false, "maxPerDay": 2, "cooldownMin": 45 } } }
```

> 关闭 `featureEnabled` 或 `remindEnabled` 时，服务端/本地实现都会**顺手清空
> 当前正在展示的任务卡**，不会出现「明明关了还弹」。

---

## 四、切换到真实后端的步骤

1. 执行 `docs/quest/migrations/001_quest.sql`（只新增表，不动既有表）。
2. 新建 `src/services/questHttpApi.js`，按本文档实现同名函数：

   ```js
   export async function createPreItem(_state, body) {
     return request('POST', '/api/quest/pre-items', body) // { code, message, data }
   }
   ```

3. 把 `QuestContext.jsx` 里的 `import * as api from '../services/questApi'`
   改成新模块，并去掉对 `res.state` 的依赖（改成本地状态合并或重新拉取）。
4. 服务端实现同一套闸门（安静时段、每日上限、冷却、静音）——
   规则已抽成纯函数 `src/store/questEngine.js`，可整体搬过去，前后端行为保持一致。
5. 定位、天气、排队三个数据源接入后，替换 `scene` 的构造处即可，
   引擎与界面无需改动。
