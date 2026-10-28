# 仙林食光 · NJU Xianlin Food Map

南京大学仙林校区交互式美食地图，Phase 0 初始化原型。

**校园底图已接入 OSM 地理数据与三个已审核餐饮点位，采用克制的 2.5D 风格。建筑层数、窗口布局和菜单仍为示例。** 范围、场所映射与标注规则见 [GEO_BASEMAP.md](docs/GEO_BASEMAP.md)。

## 先运行起来

新增 OSM 底图检查预览：启动后打开 `?basemap=osm`（例如 <http://127.0.0.1:5173/nju-xianlin-food-map/?basemap=osm>）。已归档真实 OSM 数据、按类型输出 GeoJSON，并保留完整 Overpass 查询；操作、来源与限制见 [OSM_BASEMAP.md](docs/OSM_BASEMAP.md)。

要求 Node.js 22.12+（建议 Node 22 LTS）与 Git。Windows PowerShell 中若 `npm` 脚本受策略限制，使用 `npm.cmd`。

```sh
git clone https://github.com/shunshun-968/nju-xianlin-food-map.git
cd nju-xianlin-food-map
npm ci
npm run dev
```

打开终端打印的地址，默认 `http://127.0.0.1:5173/nju-xianlin-food-map/`。不需要申请数据库、地图 Key 或提供信用卡，即可浏览完整演示。

第八食堂内部模型可通过 `?floor=v-891-f2` 直接查看，默认俯视、手动切换 3D；包含 14 个真实编号窗口和独立水饺超市。窗口售卖、合并关系与临时楼层入口说明见 [第八食堂模型](docs/EIGHTH_CANTEEN_MODEL.md)。

民族食堂内部模型入口为 `?floor=v-891-f1`，包含 10 个真实编号窗口，并保留现场牌匾字形；3、5 号跨牌匾，8 号保存早餐地点标记。空间与数据说明见 [民族食堂模型](docs/MINZU_CANTEEN_MODEL.md)。

逸夫楼 B102 休闲食坊入口为 `?venue=v-yifu`，在第二层直接展示按照片还原的售卖点，整间作为一个窗口；3D 敞开南侧，俯视恢复四面墙与南门，保留入口宣传牌，支持暖黄色夜间照明与柜台选中聚光，详见 [逸夫楼售卖点模型](docs/YIFU_KIOSK_MODEL.md)。

呢喃小屋入口为 `?venue=v-hut`，直接展示按现场照片建立的外观与独立早餐棚；早餐、午餐模型与详情看板同步切换，白天默认早餐、夜晚默认晚餐。晚餐陈设待夜间实拍补充，详见 [呢喃小屋模型](docs/NINAN_HUT_MODEL.md)。

- 左侧搜索或点击地图建筑 → 选择楼层 → 点击窗口查看菜单占位内容。
- 地图左键拖动、滚轮缩放；建筑、餐车及楼层的 3D 模式支持右键单击进入／退出旋转模式，移动鼠标旋转，按住左键临时平移，松开后继续旋转，滚轮缩放。Esc 退出旋转；触屏沿用双指操作。
- 校园底图以 2D 为主：普通建筑白色，可交互地点为浅彩色 2.5D 矩形。右下角可以显示/隐藏名称。
- 3D 不可用时，左侧列表仍可完成层级浏览。

## 已交付与边界

| 内容                                  | Phase 0 状态                                          |
| ------------------------------------- | ----------------------------------------------------- |
| 校园 / 建筑 / 楼层 / 窗口四层交互     | 已实现，SVG 校园总平面 + Three.js 室内示意模型        |
| 数据驱动窗口位置                      | 已实现，稳定 ID + 楼层局部 x/z + 朝向，不依赖数组顺序 |
| 真实地图地理配准、实测布局、glTF 模型 | 校园已接入 WGS84；室内实测与 glTF 模型待完善                        |
| PostgreSQL 迁移、约束、RLS、只读维护  | 已提供；默认禁止客户端写入                            |
| 读 API 与 Docker Compose              | 已提供，可接 PostgreSQL；不包含认证服务器             |
| 业务数据备份/恢复/校验，图片同步      | 已提供脚本；认证凭证单独处理                          |
| 注册、上传、评价、举报、管理界面      | 尚未开放；数据表和安全接入方案已预留                  |
| Supabase 云项目                       | 未创建、未接入；当前线上演示使用 mock 数据            |

## 技术选择

React + TypeScript + Vite 管理界面；SVG 管理校园地理底图，Three.js 管理室内场景；Node.js + `pg` 提供小型只读 API；PostgreSQL 存业务数据。校园数据保留 WGS84 坐标，离线转换为局部米制路径；前端读取静态文件，无需在线瓦片或地图 Key。室内仍使用楼层相对坐标。

前端通过 `CatalogRepository` 读取数据，不直接绑定 Supabase 表。`app.users.id` 是业务用户 ID，第三方身份保存在单独的映射表；媒体记录保存 `storage_key`，URL 在读取时生成。这两点使数据库和认证、图片平台可以分别迁移。

## 常用命令

```sh
npm test                    # 空间与文件 Key 单元测试
npm run data:validate       # 检查示例位置和引用
npm run data:export         # 输出 data/demo-catalog.json
npm run build              # 类型检查 + 生产构建
npm run preview            # 预览 dist
```

数据库命令使用 `.env` 的 `DATABASE_URL`，或标准 `PGHOST/PGUSER/PGPASSWORD/PGDATABASE`。不要提交 `.env`。`VITE_` 前缀表示配置会公开到浏览器，绝不能放数据库密码或 Supabase service role Key。

```sh
npm run db:migrate          # 校验迁移校验和，顺序执行，重复运行安全
npm run db:seed             # 只允许空库写入示例数据
npm run api                # GET /health 和 GET /api/catalog
npm run db:maintenance -- on
npm run db:backup -- backups/2026-10-21
```

## GitHub Pages

仓库为 `shunshun-968/nju-xianlin-food-map`，预期地址为：

**https://shunshun-968.github.io/nju-xianlin-food-map/**

示例 `/nju-foodmap/` 与仓库名不一致。`vite.config.ts` 与 Pages workflow 已使用实际路径。自定义域名根目录部署时改为 `VITE_BASE_PATH=/` 并重新构建。

2026-10-21 实际调用 GitHub Pages API 返回「Your current plan does not support GitHub Pages for this repository.」。已依据仓库所有者授权将 Private 改为 Public，并启用 GitHub Actions 构建。账号接口未提供套餐名称，因此不能断言具体套餐名称。Pages 的最终发布结果以 Actions 为准。

Pages 只托管静态前端；数据库、认证与上传服务不能运行在 Pages 上。Phase 0 无需云端后端即可运行。

## 项目导航

- [技术架构与阶段计划](docs/ARCHITECTURE.md)
- [采集规范与空间坐标](docs/DATA.md)
- [底图风格](docs/BASEMAPS.md)与[相对坐标维护](docs/CAMPUS_PLAN.md)
- [部署说明](docs/DEPLOYMENT.md)
- [迁移、备份恢复、域名与认证](docs/MIGRATION.md)
- [权限、审核和上传安全](docs/SECURITY.md)
- [两人协作流程](CONTRIBUTING.md)

```text
src/                     界面、场景、领域类型、数据接口
data/                    示例目录导出与数据采集模板
server/                  可替换的只读 HTTP API
database/migrations/     按版本执行的 PostgreSQL 结构
scripts/                 迁移、种子、备份恢复、存储校验
deploy/                  Linux 反向代理和数据库初始化
tests/                   空间与数据库契约验证
.github/workflows/       持续检查与 Pages 发布
```
