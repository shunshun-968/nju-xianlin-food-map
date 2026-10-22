# OSM 底图数据检查（2026-10-21）

三个补充餐饮地点已完成视觉对齐并经用户审核，逸夫楼售卖点标注为室内；已保存坐标和使用方法见 [FOOD_VENUE_ALIGNMENT.md](FOOD_VENUE_ALIGNMENT.md)。补充点位独立于原始 OSM 分类图层。

这是一次底图可用性试验。原有校园地图、紫色浮动 UI、食堂与楼层交互仍保留；新预览使用独立入口，不将图纸坐标当成经纬度。预览只依赖项目里的静态数据，无地图 Key、在线瓦片或云服务。SVG 负责简单显示，未引入新的 GIS 运行时。

## 打开检查

```powershell
npm ci
npm run dev
```

打开 <http://127.0.0.1:5173/nju-xianlin-food-map/?basemap=osm>。原应用仍为不带参数的地址。

支持拖动、滚轮/双指缩放、图层开关、只显示校园范围、点击要素查看标签和 OSM 链接。地图获得焦点后，方向键平移、`+`/`-` 缩放、`Home` 回全图。地图下载链接提供标准 GeoJSON，可用 QGIS 等工具检查。预览里的设施圆点、名称锚点只是几何显示中心，不代表入口或已核实的餐饮位置。

主要请检查：教学楼和宿舍是否完整；内院是否正确镂空；香雪海和水道是否连贯；新建建筑是否缺失；南门与附近道路是否足够覆盖。OSM 名称原样保留，例如“学生第十一餐厅”不能自动等同于项目的“十一十二食堂”。正式餐饮名称仍以用户定位图片的文件名为准，待确认后建立显式的场所 ID—OSM 对象映射。

## 边界验证与获取结果

通过 [OSM 官方对象接口](https://api.openstreetmap.org/api/0.6/way/89910837/full.json) 验证：

| 字段                | 值                                                                     |
| ------------------- | ---------------------------------------------------------------------- |
| 对象                | [way/89910837](https://www.openstreetmap.org/way/89910837)             |
| 名称                | 南京大学(仙林校区)                                                     |
| 英文名              | Nanjing University (Xianlin Campus)                                    |
| 类型                | amenity=university；闭合边界 Polygon                                   |
| 地址                | 江苏省南京市栖霞区仙林大道 163 号                                      |
| 对象版本 / 编辑时间 | v25 / 2026-01-28T14:51:41Z（与数据获取日期不同）                       |
| 校园经纬度范围      | west=118.9457301, south=32.1113781, east=118.9605563, north=32.1281062 |
| 实际查询框          | west=118.9442, south=32.1099, east=118.9621, north=32.1297             |

名称、地址及经纬度范围一致指向南京大学仙林校区；这不代表已证明边界涵盖学校所有最新用地。查询框在这个边界四周留出了约百余米余量，以保留相邻道路供检查。

优先访问 Overpass：`overpass-api.de` 返回过 HTTP 406，随后 GET/POST 超时；`overpass.kumi.systems`、`overpass.private.coffee` 超时。`overpass.osm.ch` 的区域数据响应为空，不作为南京数据来源。因而没有得到可用于比较完整性的校园 area 查询结果，不能声称“边界查询已证明完整”。本次改用 **OSM 官方 map API 的 bbox 快照**，并补取 `relation/19161478/full.json` 修复一个不完整的建筑关系。完整请求 URL、获取 UTC 时间和 SHA-256 位于 `data/osm/raw/acquisition.json`；预览获取日期按 Asia/Shanghai 显示。

| 分类      | 要素数 | 说明                                                      |
| --------- | -----: | --------------------------------------------------------- |
| boundary  |      1 | 指定校园边界                                              |
| roads     |    688 | highway，包括道路、步道及少量节点设施                     |
| buildings |    327 | building / building:part；35 个建筑包含内院孔洞           |
| land      |    167 | landuse / leisure / natural，包括运动设施及水面等自然要素 |
| water     |     15 | waterway / water / natural=water / landuse=reservoir      |
| pois      |     99 | amenity / shop，包括校园对象本身                          |
| labels    |    468 | name、name:zh 或 name:en，保持原几何                      |

共 1,336 个唯一 OSM ID。分类可以重叠，不能相加；这些是 **bbox 范围及与其相交的完整对象** 的计数，不是校园内建筑普查。OSM map API 可能返回越过查询框的完整道路及父关系，GeoJSON 不做几何裁剪。预览以固定查询框取景，“仅显示校园边界内”是视觉裁剪，下载文件仍保留周边数据。跨区域公交/地铁等路线关系不作为底图图层；构成道路的 highway ways 保留。当前纳入图层的要素没有 `tainted` 标记，但 OSM 未绘制的现实要素仍可能缺失。

## 数据文件与可复现转换

```text
data/osm/raw/                 原始响应、来源、获取时间、校验和（保留不改写）
data/osm/queries/             可在 Overpass Turbo 运行的完整查询
public/osm/boundary.geojson   校园边界
public/osm/roads.geojson      道路、人行道
public/osm/buildings.geojson  建筑（Polygon/MultiPolygon，含内环）
public/osm/land.geojson       土地、植被、运动设施
public/osm/water.geojson      水道、水面
public/osm/pois.geojson       公共设施、餐饮、商店
public/osm/labels.geojson     有名字的对象（保留原始几何）
public/osm/all.geojson        按 OSM ID 去重的全部分类要素
public/osm/manifest.json      来源、获取时间、边界验证、统计、许可
```

GeoJSON 使用 **WGS84 经度、纬度** 顺序，未转换为 GCJ-02 或 BD-09。预览显示时在校区中心纬度采用局部米制近似投影（北向上），不修改源坐标；不能直接叠加采用另一坐标系的国内互联网底图。建筑几何通过 `osmtogeojson` 组装关系，SVG 使用 `fill-rule=evenodd` 保留孔洞。转换器仅是开发依赖，未进入前端包；覆盖其旧 XML 解析器依赖到修复版本，当前 `npm audit` 无已知漏洞。

离线重新转换已归档快照（校验原始文件 SHA-256）：

```powershell
npm run osm:convert
npm test
npm run build
```

显式刷新网络快照（需要 Python 3；避免频繁调用公共 API）：

```powershell
npm run osm:fetch
npm run osm:convert
```

刷新脚本优先 Overpass；无法访问时回退到 OSM 官方 API。它验证边界名称，记录来源，补齐缺成员的 multipolygon；转换器遇到不完整的主题几何会报错，不把残缺建筑悄悄显示成完整数据。新快照保存在 `raw/snapshots/<UTC时间>/`，保留旧原始文件；成功获取后才更新 `acquisition.json` 指向新快照。不同日期的快照可能不一致，更新后必须重新检查；提交前用 Git diff 比较原始快照和统计。`OVERPASS_URL` 可指定其他覆盖中国的 Overpass 实例；访问地址仅用于采集，不写入前端运行依赖。

## 手动 Overpass Turbo 导出与导入

1. 打开 [Overpass Turbo](https://overpass-turbo.eu/)。先运行 `data/osm/queries/boundary.overpassql`，核对名称和边界。
2. 运行 `data/osm/queries/campus-area.overpassql`，按已验证的 way 转区域查询。若缺少校门外道路、边缘对象或新区域，运行 `data/osm/queries/campus-bbox.overpassql`。两个查询都包含 highway、building、landuse、leisure、natural、waterway、water、amenity、shop、name、name:zh，并递归获取全部成员以保留孔洞。bbox 固定覆盖本次校园边界和附近道路，不受当前 Turbo 视窗影响。
3. 点击“导出 → 数据 → GeoJSON”下载；另外保存原始 OSM JSON 响应，便于追溯。不要导出“仅中心点”的数据，否则无法恢复建筑轮廓。查询文件包含完整语句，可直接全选复制，不需要补写条件。
4. 在项目目录导入导出的文件。填写实际获取日期和来源；以下日期仅为格式示例，必须换成自己的真实时间：

```powershell
$env:OSM_IMPORT_SOURCE = 'https://overpass-turbo.eu/ (campus-bbox.overpassql)'
$env:OSM_IMPORT_RETRIEVED_AT = '2026-10-21T20:30:00+08:00'
npm run osm:convert -- 'C:\Downloads\campus.geojson'
# 原始 OSM JSON 同样可以导入：
# npm run osm:convert -- 'C:\Downloads\campus.osm.json'
npm test
npm run build
```

导入器保存完整原文件到 `data/osm/raw/imports/<SHA-256>.geojson`（或 `.osm.json`），记录原文件哈希和来源，按主题分类输出。需包含 OSM ID（Turbo 默认 `id` / `@id`），未命名对象也保留其 ID。手动导入不自动刷新已验证的边界快照；如边界已变更，先运行刷新。手动导入和默认离线转换是两种输入方式；以后直接运行不带路径的 `osm:convert` 会重新使用 `acquisition.json` 指定的默认快照。

## 后续接入与迁移

本次只为检查 OSM 数据，不把旧图纸点位按比例拉伸到经纬度上，也不自动修改任何食堂名字。决定采用后，需核实餐饮点位的经纬度/OSM ID、处理缺失建筑，并决定初始取景范围，再替换正式底图。现有图纸地图的比例尺校准不能代替新的点位配准。

所有预览和数据均在仓库中，构建后随 `dist/osm/` 一起发布到 GitHub Pages，使用 `BASE_URL` 适配仓库子路径；以后迁往学校服务器或自定义域名只需沿用现有部署流程调整 `VITE_BASE_PATH`，无需调用地图服务或迁移云端状态。本次未改变数据库、认证、媒体存储、维护模式和备份恢复流程。

OSM 原始及派生数据库按 [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) 提供，署名为 [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright)。预览固定展示署名和许可链接。该数据许可与项目代码、用户提供的校园图片许可分开，不自动为项目代码或照片授予许可。
