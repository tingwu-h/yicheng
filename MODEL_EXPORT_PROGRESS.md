# 景区 3D 模型导出进度

来源：TopoExport BASIC，选择 glTF，导出 ZIP 中的 `topoexport_3D_modeling.glb`。模型为 Overture 建筑、道路、水系、树木与绿地等要素，不包含兵马俑单体或历史建筑的精细复原。每个 ZIP 的 `LICENSE.txt` 保存在对应模型目录；共用模型的景点引用同一文件。

TopoExport 免费账户显示每天 2 次 BASIC 导出、每次最多 1 km²。新模型须核对地图位置和范围、下载 ZIP、验证 GLB 后才能登记到 `src/data/attractionModels.js`。用户已要求停止继续下载。

| ID | 景点 | 状态 | TopoExport 导出 |
| --- | --- | --- | --- |
| a1 | 秦始皇帝陵博物院 | 已接入、已在 Edge 验证 | #2235FA；34.383843–34.390589 N，109.270948–109.279098 E |
| a2 | 华清宫 | 已接入、已在 Edge 验证 | #503AAD；34.363700–34.366402 N，109.205237–109.209617 E |
| a3 | 西安城墙 | GLB 与构建验证通过，待页面复核 | `xianchenglou.zip`；具体展示片段以导出范围为准 |
| a4 | 陕西历史博物馆 | 本馆与秦汉馆两份 GLB 及构建验证通过，待页面复核 | `shanxi history (basin).zip`、`shanxi history (QinHan).zip` |
| a5 | 大雁塔 | 共用 a6 模型，待页面复核 | 与大唐不夜城共用 `topoexport-6565BB.zip` |
| a6 | 大唐不夜城 | 已接入，GLB 与构建验证通过，待页面复核 | #6565BB；由用户提供 ZIP |
| a7 | 钟楼 | 已接入，GLB 与构建验证通过，待页面复核 | #400A6D；由用户提供 ZIP |
| a8 | 鼓楼 | GLB 与构建验证通过，待页面复核 | 与回民街共用 `huiminjie and  gulou.zip` |
| a9 | 回民街 | 共用 a8 模型，待页面复核 | 与鼓楼共用 `huiminjie and  gulou.zip` |
| a10 | 西安碑林博物馆 | 已导入，页面加载验证通过 | `碑林博物馆.zip`；含 OpenGeoHub 地形数据 |
| a11 | 小雁塔 | 待导出 |  |
| a12 | 大明宫国家遗址公园 | GLB 与构建验证通过，待页面复核 | `damingong.zip`；具体展示片段以导出范围为准 |
| a13 | 大唐芙蓉园 | GLB 与构建验证通过，待页面复核 | `datangfurongyuan.zip` |
| a14 | 永兴坊 | GLB 与构建验证通过，待页面复核 | `yongxingfang.zip` |
| a15 | 秦岭野生动物园 | 待导出 | 园区范围大于单次 BASIC 导出范围，需先确定展示片段 |
| a16 | 翠华山 | 待导出 | 山地需检查 Terrain Mesh 是否可用 |
| a17 | 楼观台 | 待导出 |  |
| a18 | 西安博物院 | GLB 与构建验证通过，待页面复核 | `xianbowuguan.zip` |
| a19 | 汉城湖遗址公园 | 待导出 | 公园范围大于单次 BASIC 导出范围，需先确定展示片段 |
| a20 | 白鹿原影视城 | 待导出 |  |
| a21 | 化觉巷清真大寺 | 待导出 |  |
| a22 | 曲江池遗址公园 | 已导入，页面加载验证通过 | `曲江池遗址公园.zip`；含 OpenGeoHub 地形数据 |
| a23 | 终南山·南五台 | 待导出 | 山地需检查 Terrain Mesh 是否可用 |
| a24 | 广仁寺 | 待导出 |  |

