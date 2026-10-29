# 部署

## A. GitHub Pages（当前默认）

仓库设置 → Pages → Source 选择 GitHub Actions。推送 main 会执行 `.github/workflows/pages.yml`，构建后上传 `dist/`。Actions 出现绿色 Deploy Pages 后打开：

`https://shunshun-968.github.io/nju-xianlin-food-map/`

当前已核实 Private 仓库的 Pages 被套餐限制拒绝，按所有者指示改为 Public。不要把照片原件、用户导出、备份或 `.env` 放进公开仓库；`.gitignore` 已排除这些目录。没有设置自定义域名，`nju.edu.cn` 子域名需要学校管理方分配。

当前是静态 mock 演示，无 Supabase 依赖。Pages 路径来自仓库名，不能使用 `/nju-foodmap/`。切换自定义域名根路径时修改构建环境 `VITE_BASE_PATH=/`，重新部署，并根据实际 DNS 配置 CNAME；切换到学校服务器则由学校 DNS 指向新服务器。

## B. 免费云数据服务（Phase 1 接入步骤，尚未创建）

1. 由项目所有者创建 Supabase 项目、选择区域，记录 PostgreSQL 主版本；免费额度和暂停规则以控制台当时说明为准。先测试校园网对 API 和文件的可达性。
2. 在本机私有 `.env` 配置直连或 **session pooler** 的 `DATABASE_URL`，执行 `npm run db:migrate`。服务端连接须验证 TLS；备份不可用 transaction pooler。
3. app schema 默认不对 anon/authenticated 授权，也不直接开放到 PostgREST。先做受控的目录 API（Supabase Edge Function 或独立 Node 服务），按 `CatalogRepository` 的返回契约映射数据。Phase 0 的 Node API可直接连接 Supabase PostgreSQL，但部署它需要另一个支持 Node 的主机；Pages 不能运行它。
4. 生产 API 使用专门 LOGIN 角色，授予 `foodmap_reader`，不能用数据库管理员或 service role Key充当普通客户端凭证。用户写 API 完成身份校验与 RLS 设计前保持关闭。
5. 配置私有 pending bucket 和公开 approved bucket；同一 Key 的图片只有审核后进入公开桶。将公开图片基础 URL 设为 `VITE_MEDIA_BASE_URL`。
6. 将 Pages workflow 改为 `VITE_DATA_SOURCE=api`，并设置公开的 `VITE_API_URL`。服务端 CORS 只允许 `https://shunshun-968.github.io`（Origin 不包含路径）。验证 API 错误页面、空目录、慢网和手机。

Phase 1 的云函数适配、用户认证和上传 API 仍需实现；当前没有假装已接通 Supabase。

## C. 普通 Linux 服务器 / Docker Compose

本仓库 Compose 部署的是 **静态站点 + 只读 Node API + PostgreSQL**，不包含 Supabase Auth、Storage 网关或用户上传。需要保留 Supabase 完整行为时，另按官方自托管方案部署，并执行 MIGRATION.md 的认证分支。

```sh
cp .env.example .env
# 编辑 .env：把 POSTGRES_PASSWORD 和 API_DATABASE_PASSWORD 换成不同的长随机值。
# PUBLIC_ORIGIN 填实际浏览器 Origin（协议 + 主机 + 可选端口，无路径）。
docker compose up --build -d
docker compose ps
curl http://localhost:8080/backend/health
```

初始目录为空。仅在试验环境可加载示例：

```sh
docker compose --profile demo run --rm seed
```

数据库和 API 不公开宿主机端口，Web 默认只监听宿主机 `127.0.0.1:8080`。使用学校已有的 HTTPS 反向代理转发到该地址，申请受信任证书、开启自动续期。不要把数据库 5432 暴露到公网。

`deploy/init-api-user.sh` 只在首次创建数据库卷时创建 API 登录角色；之后修改 `.env` 中的密码不会自动更改数据库角色密码，需要运维执行角色轮换。

公开图片目录挂载到 `storage-data/public`；私有和待审核文件必须放在其他受限目录。当前没有上传服务。备份数据库卷不能代替一致性数据库备份。

更新时先备份，检查迁移，再运行 `docker compose up --build -d`。已有数据库的迁移任务应显式执行 `docker compose run --rm migrate`，检查成功后更新 API；不使用 `docker compose down -v`。

## 自托管的服务端加载优化

以下配置由 Docker/Nginx 与 Node API 执行。当前 GitHub Pages 构建使用 `VITE_DATA_SOURCE=mock`，不会运行这两个服务，因此修改这些文件不会改变现有 Pages 站点的传输线路或响应头。

Docker 构建在 Vite 输出后运行 `node scripts/precompress.mjs dist`，为大于 1 KB 且确实能缩小的 HTML、JavaScript、CSS、JSON、SVG 和 WASM 生成无损 `.gz` 副本。原文件、图片与模型内容不变。Nginx 按客户端 `Accept-Encoding` 协商发送预压缩文件；没有副本时动态 gzip，响应包含 `Vary: Accept-Encoding`。此项减少首次访问的传输字节，不要求浏览器已有缓存。[Nginx 预压缩说明](https://nginx.org/en/docs/http/ngx_http_gzip_static_module.html)

带哈希的 `/assets/` 和地图分块使用一年不可变缓存；HTML、地图目录及其他未版本化文件使用 `no-cache` 重验证。缺失的静态资源直接返回 404，不回退成 HTML。API 与公开媒体保留各自的缓存策略；API 连接通过上游 keepalive 复用。所有路径继续继承原有安全响应头。

Node 目录 API 将原有八次数据库往返合并为一次固定的批量只读请求，仍使用 `foodmap_reader` 角色和原字段、排序、价格换算。并发目录请求共享正在进行的读取；每次新一批请求仍访问数据库，不以 TTL 缓存菜单或维护状态。响应支持 gzip/Brotli 与弱 ETag，内容未变可返回 304；只复用上一版相同内容的编码结果。目录为 `private, no-cache`，健康检查和错误仍为 `no-store`，CORS 白名单和只读方法限制不变。

上线前，在实际 Docker 环境执行 `docker compose config --quiet`、构建 web/api 并检查 `docker compose exec web nginx -t`。随后对比 `curl -I -H 'Accept-Encoding: gzip' http://localhost:8080/` 与不带压缩请求的响应，核对 Content-Encoding、Vary、ETag、Cache-Control；浏览器无缓存测试还应包含校园网和手机网络。本地 Vite 预览不会模拟 Nginx 的全部行为。

## 资源预算

- 本仓库轻量栈：开发/小流量起点 **1 vCPU、1 GB RAM、10 GB SSD**；正式试点建议 **2 vCPU、2 GB RAM、20 GB SSD 起**，图片和备份另计。这是工程估算，尚未做并发压测；构建建议在 CI 完成，避免小内存机器构建失败。
- Supabase 完整自托管：官方最低 **2 CPU、4 GB RAM、40 GB SSD**，推荐 4 CPU、8 GB+、80 GB+；不能沿用轻量栈的资源估算。[官方要求](https://supabase.com/docs/guides/self-hosting/docker#system-requirements)
- 三维渲染主要由用户设备 GPU 执行；服务器不负责实时渲染。首页、Three.js 和各食堂代码按需分包，传输体积以最新构建结果为准。服务器压缩不能替代手机上的模型构建、着色器编译与渲染测试。

PostgreSQL 镜像默认 16，迁移云端 17 数据时需先将目标版本改为兼容的 17 并演练；不能把高主版本 dump 无条件导入旧主版本。
