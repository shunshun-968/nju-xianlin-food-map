# 校园绿地等高线

最外层底图在校园内面积不小于 10,000 平方米的森林、草地等绿地上绘制暖白细等高线。当前共 5 片绿地、62 段线；等高距保持 5 米。道路、建筑、水体和运动场被挖空，边界留少量空隙，避免与道路标线混淆。普通线宽 0.6 屏幕像素、不透明度 53%；每 20 米的线略强调至 0.72 像素、65%。颜色统一为 `#fff8e9`，缩放时不变粗，也不参与点击。

## 尝试 1：专项优化

优化前的本地 Git 基线为 `ae952a8`。原 88 段线有 166 个开放端点，其中 148 个在遮挡裁切边界上，另外 18 个形成 9 对同高程重合端点：它们来自闭合线在任意起点处被几何裁切拆段。20 段不足 45 米。主要问题来自裁切和短段筛选，原始 DEM 没有缺测导致的断洞；简化后的折线和恒定透明度使断点更明显。

新流程先对完整源线做有限平滑，再裁切；只合并**同一源线、同一高程、端点完全相接**的拆段，修复 9 处人工接缝。禁止跨道路连线，禁止跨高程或不同源线拼接。显示数量由 88 减为 62，保留了 5 条实际闭合线，没有通过加密等高线掩盖问题。

开放端点使用独立渐隐遮罩，范围为 14 地面米且上限 8 屏幕像素。两个端点的遮罩相乘，避免窄路两侧端点相近时互相覆盖渐隐。只有正常被边界/地物裁切的端点会渐隐，山顶闭合线不使用端点遮罩。道路、建筑、湖泊、绿地填色、原始 DEM 及 5 米高程间隔均保持不变。

## 高程来源

- 数据：[Mapzen / Tilezen Terrain Tiles，AWS Open Data](https://registry.opendata.aws/terrain-tiles/)。无需账号或 API key。
- 本地获取日期：2026-10-22（Asia/Shanghai）；UTC 请求时间记录在 `data/dem/raw/source.json`。
- [原始瓦片](https://elevation-tiles-prod.s3.amazonaws.com/terrarium/12/3401/1661.png)：XYZ `12/3401/1661`，256×256 Terrarium PNG。
- 原始响应的 `x-amz-meta-x-imagery-sources`：`srtm/N32E118.tif, srtm/N32E119.tif, gmted/30N090E_20101117_gmted_mea075.tif`。这是整块瓦片的来源清单，不代表每个像素都使用三个来源。
- 瓦片最后修改时间为 2017-11-20，获取日期并非地形测量日期。中国区域主要来源 SRTM，瓦片来源还包含 GMTED。
- [格式说明](https://github.com/tilezen/joerd/blob/master/docs/formats.md)：`高程（米）= R × 256 + G + B ÷ 256 − 32768`；瓦片采用 Web Mercator。
- [来源与分辨率](https://github.com/tilezen/joerd/blob/master/docs/data-sources.md)：本地瓦片网格间距约 32.36 米。5 米是绘制等高距，不表示 5 米高程精度；适合校园地形示意，不能替代实测地形图。
- 署名：Mapzen / Tilezen；SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey。遵循[提供方署名说明](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)，地图边角保留来源链接。

原始 PNG、请求 URL、完整响应头、UTC 时间和 SHA-256 均已归档。原始 DEM 作为仓库数据保存，不需要前端在线请求第三方高程服务。

## 处理与输出

1. 校验原始 PNG 哈希并解码高程。以 0.8 像素高斯平滑压低格网锯齿，约相当于 26 米的平滑尺度。
2. 按瓦片像素中心定位，转换到与 OSM 底图一致的本地米制坐标；8 米双线性插值网格仅用于连续绘图，不增加测量分辨率。
3. 提取 5 米源等高线，按约 6 米等弧长重采样并轻度平滑。闭合线采用周期平滑；开放线固定首尾。平滑结果必须保持简单几何和开闭关系，与原线偏移不超过 2.5 米，且高程与既有平滑 DEM 残差小于 0.48 米，否则逐步减弱平滑或使用原线。
4. 裁切到实际校园绿地，再合并同一源线的重合端点。沿用原遮挡范围：道路半宽加 2 米、建筑/水面/运动场外扩 3 米、绿地边缘内缩 2 米。舍去不足 50 米的开放碎段；闭合山顶线采用更宽松的 35 米周长门槛，避免丢失主要峰顶。
5. 当前选定绿地的平滑高程仍为约 8.45—80.33 米。本次最大几何平滑偏移为 2.458 米，导出顶点相对原平滑 DEM 最大残差约 0.439 米。这是处理一致性指标，不是实测精度。62 段线包括裁切形成的断段，不表示 62 个不同高度。

输出均在 `public/osm/`：

- `campus-contours-source.geojson`：平滑、裁切之前的 DEM 源线，保留父级 ID 和高程，用于复核。
- `campus-contours.geojson`：WGS84 显示等高线，属性含 `elevation_m`、`interval_m` 和 `parent_id`。
- `campus-contour-mask.geojson`：实际显示区域，保留孔洞。
- `campus-contours.json`：前端读取的米制 SVG 路径、端点、边界框和元数据，约 97 KB。
- `campus-contours-report.json`：高程范围、参数、来源、原始 DEM 和底图输入文件哈希。

## 重建与验证

常规前端开发和部署只读静态成果，无需安装 GIS 依赖。重新处理时：

```powershell
python -m pip install --target .cache/osm-build -r scripts/osm/requirements-terrain.txt
# 只在要更新 DEM 原始来源时执行
npm run osm:fetch-dem
# 如修改过校园 OSM 数据，先运行 npm run osm:build-campus
npm run osm:build-contours
npm run osm:validate-contours
npm run build
```

独立校验检查来源哈希、底图变更导致的过期成果、线条间隔、高程残差、绿地和校园边界、地物避让，以及相同高程父线、平滑偏移、线条自交/交叉、短碎线和人工内部端点。更新校园边界、道路宽度或绿地后必须重新生成等高线。

前端将等高线作为独立静态图层加载，失败不会阻断食堂地图。等高线位于绿地填色上方、道路建筑下方，仅影响校园层；食堂模型、楼层、场所坐标和手机抽屉不依赖该图层。
