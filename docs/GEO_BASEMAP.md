# 正式校园地理底图

当前默认视图为鼠尾草绿平面块色及按缩放渐显的林地纹理，规则与前后对照见 [SAGE_GREEN_STYLE.md](SAGE_GREEN_STYLE.md)。高程渐变和等高线均不显示；[GREEN_RELIEF_TRIAL.md](GREEN_RELIEF_TRIAL.md) 与下文等高线部分保留为历史方案的说明。

默认校园层使用 OSM 与三个已审核餐饮点位，检查入口 `?basemap=osm` 保留。`CampusMap.tsx` 转发到独立的 `GeoCampusMap.tsx`，通过既有场所 ID 进入室内场景。`App.tsx`、`MapScene.tsx`、手机抽屉和 UI 样式均未改动。

加载按「校园核心 → 初始视野周边 → 空闲时预取外围」执行，缩小后才展开更远区域。缓存策略、重建方式与实测记录见 [MAP_LOADING.md](MAP_LOADING.md)。

## 数据与对应关系

校园原始数据归档在 `data/osm/raw/road-bounded-campus/`。周边数据归档在 `data/osm/raw/campus-context/`，采集框为 west=118.922、south=32.102、east=118.988、north=32.141。周边采集使用官方 OSM API 的四个分块，并补齐两个 multipolygon 关系；所有来源均附获取日期、请求 URL 和 SHA-256。

| 场所 ID | 地理来源            | 地图名称                    |
| ------- | ------------------- | --------------------------- |
| v-456   | way/99814434        | 四五六食堂                  |
| v-891   | way/99814405        | 民族食堂、第八、九食堂      |
| v-10    | way/188130723       | 第十食堂                    |
| v-1112  | way/350505117       | 第十一、十二食堂            |
| v-hut   | food-venues.geojson | 四五六食堂东侧美食小&小餐车 |
| v-south | food-venues.geojson | 南门小餐车                  |
| v-yifu  | food-venues.geojson | 逸夫楼快餐售卖点（室内）    |

三个补充点直接读取 `public/osm/food-venues.geojson`，与用户 Map 文件夹中的已审核副本保持相同坐标。食堂长方体的中心、大小和朝向来自对应建筑。地图显示名称映射不修改原始 OSM 标签，也不改写室内相对坐标。

## 裁切与样式

九乡河东路、纬地路、元化路、仙林大道围合的区域用于区分校园与周边配色；分离式道路使用靠校园一侧车道中心线与明确的交叉口。按最新要求，默认底图纳入初始视角及周边范围中 OSM 已记录的建筑、道路、水体和绿地。原校园与仙林大道南侧 100 米缓冲仍作为独立核心参考文件保存，不再限制默认底图的校外内容。

校园基底采用柔和的米杏色，配开心果绿植被、浅青色水体和浅奶油色道路；校外保持灰绿色基底，所有道路使用深一档的灰绿色。道路颜色按校园边界裁切，跨界道路能连续衔接。边界道路强调仍只覆盖实际围合的区段，路口外延伸段不额外加粗。普通建筑为暖白色、东南小阴影，保留内院孔洞；餐饮点为柔和配色的简单体块。射电望远镜位于左涤江天文台，尺寸按反馈缩至初版的 65%。

运动场采用用户参考图的矢量标线。主要篮球场 4×3、排球场 4×1、网球场 4×2，其他场地按轮廓比例排布，白线设最低屏幕线宽。它们属于风格化纹理，未声明为实测场地尺寸。

常见鼠标滚轮每格按 **1.2 倍**缩放，触控板的小幅滚动保持连续。初始和重置视角为原适配视角的 **1.2 倍**，即放大一级。所有建筑名称的缩放门槛较上一版延后两级：普通建筑从 **2.304 倍**起尝试显示，校园内包络面积较大的五个公共建筑从 **1.44 倍**起尝试显示，包含杜厦图书馆；校外建筑不进入大建筑优先名单。这些倍率均相对原适配视角。

餐饮标签没有缩放门槛。建筑文字受包络约束，每个维度最多为包络的 1.1 倍，并避让餐饮标签和 UI；屏幕空间不足时省略。道路名称仍从 **2.3 倍**起尝试显示，文字矩形必须完全在直线车道内、车道足够宽且无遮挡；人行径不套用车道名称。

## 绿地地形

校园内大片绿地已叠加来自 Mapzen / Tilezen DEM 的 5 米等高距白色细线；只显示在绿地内，并避开道路、建筑、水面和运动场。来源、精度范围、数据归档和独立重建步骤见 [TERRAIN_CONTOURS.md](TERRAIN_CONTOURS.md)。修改校园数据后，需重新运行 `npm run osm:build-contours` 与 `npm run osm:validate-contours`。

## 输出、重建与合并

- `public/osm/campus-map.geojson`：按周边采集框裁切的完整 WGS84 要素。
- `public/osm/campus-core.geojson`：原校园与南侧 100 米缓冲的核心参考数据。
- `public/osm/campus-retention.geojson`：四路围合面和南侧缓冲。
- `public/osm/campus-render.json`：完整米制路径、场所与标注数据，作为运行时分块的构建来源，含周边覆盖范围、校园外裁切路径和逐要素校园内外属性。
- `public/osm/runtime/`：前端实际读取的目录、校园核心、周边分块及按需林地纹理，使用内容哈希文件名。
- `public/osm/campus-build-report.json`：源文件、数量、面积及边界记录。

当前保留 5,247 个唯一要素、渲染 4,538 个要素；其中校外源要素含 1,574 个建筑和 1,631 条道路。四路围合约 2,613,605 平方米，南侧缓冲约 106,027 平方米。数据统计来自本次快照，OSM 尚未绘制的现实要素仍可能缺失。渲染时按当前视窗筛选路径，避免每次拖动都绘制全部周边。

普通开发、CI、部署直接使用已生成的静态文件；重新采集和裁切才需要 Python 3 与 Shapely：

```powershell
python -m pip install --target .cache/osm-build -r scripts/osm/requirements-basemap.txt
# 仅在需要刷新来源时执行以下两行
python scripts/osm/fetch-road-campus.py
python scripts/osm/fetch-context.py
npm run osm:build-campus
npm run osm:validate-campus
npm test
npm run build
```

独立校验脚本检查周边完整覆盖、多种桌面与手机初始视窗、唯一要素 ID、校园内外归属、缓冲方向与距离、核心数据裁切、几何有效性、7 个餐饮位置及已审核点无漂移。标注测试覆盖真实数据的多个视窗、道路文字四角、建筑包络限制、滚轮等级及缩放门槛。

已合并同事的 UI 提交 `b73e8be`。`App.tsx`、`FloatingSidebar.tsx`、`CompassRose.tsx`、`campus.css`、`desktop-shell.css` 和 `map-labels.ts` 保留该提交的版本；入口同时载入新版 UI 样式和最新 OSM 底图。底图对接列表与地图双向高亮、`SceneHandle`、`foodmap:overlays` 和 `foodmap:drawer`：全景下侧栏收展会重新适配，手动浏览后保留视角。桌面和手机均使用已审核 OSM 数据，食堂室内模型不变。署名与 ODbL 链接保留在地图边角。
