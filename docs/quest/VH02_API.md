# vh0.2 接口与配置契约

本版保留原有任务 API，新增浏览器本地适配器 `src/services/vh02Api.js` 与可选 Node 24 配置服务 `server/vh02Admin.mjs`。**用户任务、金币、审核不是线上 HTTP 服务**；不能把演示态当成防刷上线态。

## 已实现的配置接口

启动配置服务需设置 `VH02_ADMIN_TOKEN`（至少 16 字符）并运行 `npm run dev:api`，默认只监听 `127.0.0.1:5174`。Vite 将 `/api/vh02` 代理过去。

| 方法 | 路径 | 权限 | 实现 |
| --- | --- | --- | --- |
| GET | `/api/vh02/config` | 游客可读 | 返回 vh0.2 内容快照 |
| GET | `/api/vh02/admin/coreChains` | Bearer 管理令牌 | 读取四条核心链 |
| PUT | `/api/vh02/admin/coreChains` | Bearer 管理令牌 | 校验并整体更新四条核心链 |
| GET/PUT | `/api/vh02/admin/activityTasks` | Bearer 管理令牌 | 读取/更新活动任务 |
| GET/PUT | `/api/vh02/admin/officialTaskConfig` | Bearer 管理令牌 | 读取/更新生效开关与提醒参数 |

后台配置页面：`/vh02-admin.html`。配置存 `data/vh02-config.sqlite`；数据库文件由首次启动创建。后台校验固定四宠、每链 3–5 步、所有步骤可跳过及核心服饰对应宠物。游客端页面刷新后读取新配置；后台不可用则回退随包配置。

### 真实请求/响应示例

`GET /api/vh02/config` 的响应（节选）：

```json
{
  "version": "vh0.2",
  "policy": { "region": "西安/秦岭", "petAcquisition": "official_core_chain_only" },
  "coreChains": [{ "id": "core-qizai", "petId": "pet-qizai", "steps": ["四个步骤对象"] }],
  "activityTasks": [{ "id": "activity-qizai", "costumeId": "it-leaf-hat" }],
  "scenicCostumeCount": 96,
  "officialTaskConfig": { "version": "vh0.2", "enabled": true, "maxRemindersPerDay": 2 }
}
```

`PUT /api/vh02/admin/officialTaskConfig`，请求头 `Authorization: Bearer <后台令牌>`，请求体示例：

```json
{"version":"vh0.2","enabled":false,"maxRemindersPerDay":2,"quietHours":[22,8],"privateTaskDailyRewardLimit":2,"publicCreatorMilestones":[{"completions":5,"coins":5},{"completions":20,"coins":10},{"completions":50,"coins":20}]}
```

成功响应：`{"key":"officialTaskConfig","saved":true}`；令牌缺失返回 401，不符合四宠/可跳过等约束返回 400。

## 本地用户任务函数（非 HTTP 接口）

| 函数 | 输入 | 成功结果 |
| --- | --- | --- |
| `completeCoreStep` | `{userId,chainId,stepId,evidence}` | 分两天完成四步后解锁宠物和专属服饰 |
| `completeItineraryTask` | `{userId,itinerary,taskId,evidence}` | 行程当天发一次金币；景点首次完成掉落四件服饰 |
| `createCustomTask` | `{userId,attractionId,title,type,visibility}` | 私有保存；公开状态为 `pending_review` |
| `completeCustomTask` | `{userId,taskId,evidence}` | 私有任务每日最多两次各 2 金币；公开不立即发币 |
| `completeActivityTask` | `{userId,taskId,evidence}` | 到对应景点完成轻任务后获限定冠饰 |
| `setCoreTaskAction` | `{userId,stepId,action}` | 稍后/跳过/不感兴趣/今天不再提醒/恢复 |

函数统一返回 `{code,message,data,state}`，`code:0` 表示成功。例如：

```json
{"code":0,"message":"任务完成，获得金币与景点纪念服饰","data":{"coins":3,"scenicDrop":"a6"},"state":"更新后的本地状态"}
```

定位只校验与景点参考中心的距离，不保存精确坐标；照片只在浏览器内预览，完成记录的 `photoUploaded` 始终为 `false`。正式环境需服务端身份验证、任务证据校验、对象存储、公开审核与跨用户唯一完成计数。MySQL 增量结构在 `migrations/002_vh02.sql`，当前配置服务使用 SQLite，两者**未自动同步**。
