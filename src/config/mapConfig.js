/* ==========================================================================
   地图配置（用户可自行填写）
   ─────────────────────────────────────────────────────────────────────────
   本文件是所有地图相关配置的唯一入口。**不填任何东西也能用**：
   系统检测不到 Key 时会自动降级为无需 Key 的栅格瓦片底图，页面照常显示。
   只有想用高德官方 JS API（矢量底图 / 官方路网）时才需要填下面的 AMAP_KEY。

   Key 怎么申请（Web 端 JS API）：
     1. 打开 https://console.amap.com/dev/key/app ，用高德账号登录；
     2. 「应用管理 → 我的应用 → 创建新应用」，名称随便填（如「驿程」）；
     3. 在该应用下「添加 Key」：服务平台务必选 **Web端(JS API)**；
     4. 复制生成的 Key（32 位字符串），填到下面的 AMAP_KEY；
     5. 如果控制台给的是「安全密钥 securityJsCode」（2021-12-02 之后新建的 Key 基本都有），
        一并填到 AMAP_SECURITY，否则高德接口会拒绝请求。
   注意：Key 是公开暴露在前端代码里的，建议在高德控制台为该 Key 配置域名白名单，
   并限制调用量；不要把带付费额度的私钥写进前端。

   两种填写位置（任选其一，优先级见下）：
     A. 推荐、且不会把 Key 提交进 Git —— 在项目根目录新建 `.env.local`（该文件已被
        .gitignore 忽略），写入：
            VITE_AMAP_KEY=你申请到的Key
            VITE_AMAP_SECURITY=你申请到的安全密钥
        改完必须重启 `npm run dev`，Vite 只在启动时读取 .env 文件。
     B. 直接把 Key 填进本文件的 AMAP_KEY / AMAP_SECURITY（简单，但会被提交到仓库）。
   读取优先级：`.env.local` 的 VITE_AMAP_KEY > 本文件 AMAP_KEY；
   两者都为空 → 走栅格瓦片降级，不需要任何配置。
   ========================================================================== */

/* 高德 Web 端 JS API Key；留空表示不使用高德 SDK（自动降级栅格底图）。 */
export const AMAP_KEY = ''

/* 高德安全密钥 securityJsCode；留空表示该 Key 不需要安全密钥。
   有值时会在加载 JS API 之前写入 window._AMapSecurityConfig，因此必须保持与服务端的 Key 配套。 */
export const AMAP_SECURITY = ''

/* 默认地图中心：西安市钟楼附近（lat 纬度 / lng 经度）。
   全项目对外统一使用 { lat, lng }，高德内部的 [lng, lat] 顺序只在 src/map/amap.js 里转换。 */
export const DEFAULT_CENTER = { lat: 34.26, lng: 108.94 }

/* 默认缩放级别：11 级约等于「西安市域全貌」，适合总览页。 */
export const DEFAULT_ZOOM = 11

/* 栅格瓦片（无 Key 降级底图）可用的子域名，用于在浏览器并发上限内轮询分流。 */
export const TILE_SUBDOMAINS = ['01', '02', '03', '04']
