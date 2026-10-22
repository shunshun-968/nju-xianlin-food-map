# 五片绿地色带试验

当前分支 `feat/green-relief` 展示绿色高程渐变与轻微地形明暗，没有等高线和树木模型。原等高线方案仍保留在 `feat/osm-basemap-preview` 的 `11c3b8c`；已删除未提交的树木试验与 `feat/woodland-plants` 分支。

此次开始前保存了 **`1f19040` 纯绿地基线**。它保留现有地图、道路、建筑、湖泊、交互和配色，仅关闭等高线显示。色带效果作为下一次独立提交保存；撤回该试验提交即可返回这份纯绿地底图，无需重置整个项目历史。

## 视觉规则

- 只覆盖原来带等高线的五片绿地，直接沿用其 OSM ID。
- 所有区域使用同一条 5—85 米色带，低处为 `#b4c69c`，中间为 `#c6d3aa`，高处为 `#dbe0b7`。保持在相近的浅绿色范围内，不分片重新拉伸高程，也不画分层边线。
- 明暗来自 DEM 坡度，光源位于西北方、仰角 45°，垂直比例 1.4，仅使用 0.45 强度的柔和明暗；不改变建筑或地面几何位置。
- 绿地边缘用 12 米范围过渡到原底色，裁切保持原轮廓。图层位于道路、运动场和建筑下方，独立排除水面、建筑与运动设施，避免覆盖地物。道路穿过山体时高程连续。
- 图层没有点击事件，不影响食堂入口、地图拖动或缩放。

## 数据与重建

使用已经归档的 Mapzen / Tilezen Terrarium DEM，来源含 USGS SRTM / GMTED。原始瓦片约 32 米网格；生成时使用 4 米显示像素，仅为平滑绘图，并非更高精度测量。沿用 0.8 原始像素平滑，并加约 8 米显示平滑，避免坡度光照显出插值网格的折痕。原始 DEM 未修改。

成果位于 `public/osm/`：

- `campus-green-relief.png`：带透明通道的高程与明暗图。
- `campus-green-relief.json`：前端读取的坐标范围、裁切路径和参数。
- `campus-green-relief-mask.geojson`：WGS84 显示范围。
- `campus-green-relief-report.json`：色带、光照、来源与输入/输出哈希。

```powershell
python -m pip install --target .cache/osm-build -r scripts/osm/requirements-terrain.txt
npm run osm:build-relief
npm run osm:validate-relief
npm run build
```

常规部署直接使用静态成果，不需要 Python 或额外地图服务。验证脚本检查五片区域覆盖、像素位置、透明范围、地物避让和源数据哈希。当前分支仍保存历史等高线数据和生成脚本，方便比较，但前端不加载等高线。
