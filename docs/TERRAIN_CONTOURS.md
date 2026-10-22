# 校园绿地等高线

最外层底图在校园内面积不小于 10,000 平方米的森林、草地等绿地上绘制白色细等高线。当前共 5 片绿地、88 段线；等高距 5 米。道路、建筑、水体和运动场被挖空，边界留少量空隙，避免与道路标线混淆。线宽固定 0.65 屏幕像素、白色不透明度 68%，缩放时不变粗，也不参与点击。

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
3. 提取 5 米等高线，简化容差 0.7 米，再裁切到实际校园绿地。道路按宽度加 2 米、建筑/水面/运动场外扩 3 米排除，绿地边缘内缩 2 米；舍去不足 18 米的碎段。
4. 当前选定绿地的平滑高程约 8.45—80.33 米。88 段线包括裁切形成的断段，不表示 88 个不同高度。

输出均在 `public/osm/`：

- `campus-contours.geojson`：WGS84 等高线，属性含 `elevation_m` 和 `interval_m`。
- `campus-contour-mask.geojson`：实际显示区域，保留孔洞。
- `campus-contours.json`：前端读取的米制 SVG 路径和元数据，约 48 KB。
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

独立校验检查来源哈希、底图变更导致的过期成果、线条间隔、高程与平滑 DEM 的残差、绿地和校园边界，以及道路/建筑/水体/运动场避让。更新校园边界、道路宽度或绿地后必须重新生成等高线。

前端将等高线作为独立静态图层加载，失败不会阻断食堂地图。等高线位于绿地填色上方、道路建筑下方，仅影响校园层；食堂模型、楼层、场所坐标和手机抽屉不依赖该图层。
