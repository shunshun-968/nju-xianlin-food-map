# 从免费云迁移到学校服务器

本流程适用于后续已经接入真实数据的阶段。Phase 0 目前没有云端用户和上传文件。所有备份都含敏感数据，应加密保存在受控、异地存储；不要放在 Git、公开 bucket 或聊天消息中。

## 备份包含什么

`npm run db:backup -- backups/<批次>` 导出整个 `app` schema：业务用户、认证身份映射、场所、楼层、窗口、菜品、评论、评分、图片元数据、举报、审计、维护开关。还保存迁移记录、源 PostgreSQL 版本、dump 的 SHA-256，以及每张表的行数和内容校验值。

使用 PostgreSQL 导出快照，让数据库 dump 与校验清单来自同一数据库时点。图片和认证供应商数据不在该快照中，所以正式切换时需要冻结全部写入口。表内容校验采用数据库内排序聚合，适合当前小规模数据；数据增长后应换流式校验，避免占用过多内存。

数据库文件备份 **不包含图片字节，也不自动包含 Supabase auth 密码散列**。[Supabase 数据库备份说明](https://supabase.com/docs/guides/platform/backups)

## 1. 迁移前盘点（至少提前一天）

记录代码 commit、所有迁移版本、PostgreSQL 主版本、Auth/Storage 版本、扩展、bucket ACL、OAuth 提供方、邮件服务、JWT issuer/audience/签名方式。列出需要切换的前端/API/图片/认证域名和回调地址。

先获得学校服务器和 DNS 子域名授权，确认公网或校园网可达范围。将将要切换的 DNS 记录 TTL 降到例如 300 秒，并等待原 TTL 过去。保留旧服务器、旧数据库和旧配置用于回滚。

预估数据量、文件量、全量传输时间；安排维护窗口。目标 RPO：维护冻结之后不丢提交；RTO 由演练实测决定，不能承诺固定分钟数。日常建议每日加密全备，保留 7 个日备、4 个周备，至少每月进行一次恢复演练。

## 2. 准备目标环境

按 DEPLOYMENT.md 部署。目标 PostgreSQL 应与源一致或在测试通过的更高版本，`pg_dump/pg_restore` 客户端不能低于源服务端。源连接使用直连或 session pooler，不能使用 transaction pooler。

恢复必须选择 **全新且不存在 app schema 的数据库**。不要先对目标执行 `db:migrate`，否则恢复脚本会拒绝覆盖。先启动 `docker compose up -d db`，为恢复配置本机的 PostgreSQL 客户端连接（SSH 隧道或受控运维网络）；恢复后再启动其余服务。

`RESTORE_TO_EMPTY=1` 是显式指定目标的保护开关，不会绕过“目标已有 app schema”的拒绝逻辑。源和目标的 `DATABASE_URL` 应存于两个独立的私有环境配置；命令执行前检查当前目标数据库名称，不能在日志打印含密码的 URL。

## 3. 提前同步图片

安装 rclone，通过 `rclone config` 在仓库外配置源和目标。Supabase Storage 提供 S3 兼容端点，可按其 [S3 文档](https://supabase.com/docs/guides/storage/s3/compatibility) 配置密钥、区域和 endpoint。账户密钥不能写入命令行或仓库。

```sh
npm run files:sync -- cloud:approved campus:approved copy
npm run files:sync -- cloud:pending campus:pending copy
npm run files:sync -- cloud:approved campus:approved check
npm run files:verify -- campus:approved approved
npm run files:verify -- campus:pending pending
```

源和目标都指向 bucket 的根，Key 保持原样。`copy --immutable` 遇到同 Key 不同内容会报错，不会静默覆盖；`check --download --one-way` 比较源对象内容，允许目标额外文件，不删除任何对象。目标 ACL 必须分别重建：pending 私有，approved 才公开。rclone 复制内容不代表访问策略自动迁移。

## 4. 第一次完整演练

使用专门环境导出、恢复、核验，并验证照片、认证和 API。Linux 示例：

```sh
# 当前 .env / PG* 指向源
npm run db:backup -- backups/rehearsal
# 切换到新建目标数据库连接后
RESTORE_TO_EMPTY=1 npm run db:restore -- backups/rehearsal
npm run db:verify -- backups/rehearsal
npm run db:migrate
```

Windows 设置方式：`$env:RESTORE_TO_EMPTY='1'` 后运行恢复命令。脚本同时支持标准 PG* 环境与 `DATABASE_URL`；如果同时设置，DATABASE_URL 优先。pg_dump 密码通过进程环境或 `.pgpass` 传递，不在命令行打印。

恢复使用单事务 `pg_restore` 导入业务 schema；之后重建迁移记录和最小读角色，并核对所有表。若中途失败，保留日志，重建一个新的空目标再试，不要向半完成数据库强制追加。

## 5. 认证迁移：必须选择一种实际可行的分支

业务 UUID 与供应商身份解耦：`app.auth_identities(provider, subject) -> app.users.id`。评论、评分和照片归属都引用业务 UUID，身份系统改变时不需要改写这些外键。

### A. Supabase Cloud → 兼容的自托管 Supabase Auth

官方说明同体系可以迁移 auth 表及密码散列，但没有适合所有版本的一键 auth-only 脚本。[官方说明](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)

可使用 `node scripts/auth-export.mjs backups/auth-<批次>` 单独导出 auth 数据；该脚本读取 PG* / .pgpass，**不读取 DATABASE_URL**，需明确指向源。这份文件含密码散列和可能的令牌，立即加密、限制文件 ACL。先确保 `backups/` 父目录存在。

导入采用目标版本对应的 [平台恢复到自托管步骤](https://supabase.com/docs/guides/self-hosting/restore-from-platform)：先让目标 Auth 自己创建相容 schema，比较 auth 迁移版本与列定义，在隔离环境按官方 restore SQL 修正版本差异，再导入，不盲目用本项目业务 restore 命令覆盖 auth schema。目标与源的 Postgres、Auth、Storage 版本不匹配时，应停止并升级/转换后重新演练。

保留 provider subject 或生成经审核的映射，验证邮箱密码、邮箱验证、OAuth、找回密码和 MFA。主动使旧会话失效并提示重新登录；不承诺旧 JWT、refresh token、加密 MFA secret 或签名链接在新环境继续有效。OAuth client secret、SMTP、回调 allowlist 和 JWT 签名密钥要单独配置，不从业务 dump 自动获得。

### B. Supabase → 学校统一身份 / 其他 Auth 服务

密码散列算法、导入 API、加密材料或策略可能不兼容；无法迁移时不能从散列恢复密码。保留业务用户和旧身份映射，使用新供应商登录或一次性邮件找回建立新身份。学校 SSO 需取得其授权与开发资料，不能假定已开放。

新账号通过旧会话+重新验证，或受控找回流程证明所有权后，服务端在一个事务内把新 `(provider,subject)` 绑定到原业务 UUID，记录审计。**不能只凭同一邮箱或客户端 user_id 自动合并账户。** 邮箱不可用的用户进入人工核验流程；重复绑定由数据库唯一约束阻止。

所有人重新登录。提前公告迁移影响，保留历史内容，无法立即重新绑定的账户保持待认领状态，不丢弃或转给他人。Phase 0 尚未实现绑定/找回界面，必须在开放账号后、真实迁移前完成此分支功能和测试。

## 6. 正式冻结写入

```sh
npm run db:maintenance -- on
npm run db:maintenance -- status
```

维护操作获取数据库排他 advisory lock，等待已开始的业务写事务结束。业务写触发器持有共享锁并检查开关，因此按钮以外的直接 API 调用也不能继续提交。前端未来应显示维护提示并保存草稿，写 API 返回 503 + Retry-After，不自动无限重试。

**数据库触发器只覆盖 app 的 INSERT/UPDATE/DELETE。** 它不冻结 Supabase Auth 注册、图片桶上传、队列、管理员 DDL/TRUNCATE、旧 service role 旁路。正式冻结还必须关闭注册、上传签名签发、写 API、后台作业和管理写入口；等已有签名 URL 过期、上传与审核任务完成，记录截止时间，核对最终文件清单。不能只改 `VITE_READ_ONLY`。

## 7. 最终备份、同步与验证

冻结后生成新的 app dump，按所选认证分支导出最终 Auth；再运行图片 copy/check。目标使用新的空数据库恢复最终备份，不用演练库覆盖正式内容。

核验 `db:verify` 全表行数与内容校验值；检查全部 FK、每用户每窗口评分唯一性、用户身份映射是否完整。将 `app.media.storage_key` 与文件清单交叉比对：每一个已审核记录必须有文件、sha256 和字节数一致；孤儿对象移入隔离清单，不能自动删除。抽样打开不同年份/窗口的照片、评价，并测试未审核内容不会公开。

恢复的维护开关保持开启。对目标执行 `db:migrate` 确认迁移 hash 一致，然后将只读 API 与前端接到目标环境。以临时域名或 hosts 进行验收。

## 8. DNS、HTTPS 与配置切换

学校分配的实际域名例如 `<实际名称>.nju.edu.cn` 才能使用，不能假定示例域名已存在。由 DNS 管理员配置 A/AAAA 指向服务器或 CNAME 指向学校代理。验证证书 SAN、有效期、续期，IPv4/IPv6 都应可达；没有 IPv6 服务就不要留下旧 AAAA。

前端改 `VITE_BASE_PATH=/`、`VITE_API_URL`、`VITE_MEDIA_BASE_URL` 并重新构建。API CORS/CSRF allowed origins、Auth Site URL、OAuth redirect、邮件确认和密码重置链接同步更新。不同域名的 Cookie/localStorage 不会随 DNS 自动迁移；提示重新登录，不复制浏览器 token。

确认页面资源、地图、菜单、图片、登录回调都成功，监测错误率与延迟。旧 Pages 可暂时发布迁移说明和新链接（Pages 不能配置常规服务器 301）；将来若旧入口由自建服务器控制，再使用明确的 301/308。避免浏览器继续向旧写 API 提交。

## 9. 开放写入与回滚

双人核验后仅在新环境执行 `db:maintenance -- off`，恢复新 Auth/上传/写 API。旧系统继续只读，绝不双写。记录第一笔新提交及新环境截止点。

- **尚未开放新写入时失败**：DNS/前端配置切回旧环境；确认没有新提交后，在旧环境恢复写入。保留失败目标做诊断。
- **已经产生新写入后失败**：立即冻结新环境，备份新数据与文件，按稳定 ID 导出切换后增量；在隔离库解决冲突、校验后反向同步旧库。确认没有丢失用户提交再恢复旧写入。不能直接恢复旧快照、只切 DNS。
- 观察至少一个完整业务周期与原 TTL，建议保留旧环境和最终加密备份 7–14 天，再按授权的保留策略下线。

## 日常恢复演练

`.github/workflows/ci.yml` 在隔离 PostgreSQL 中测试迁移、RLS、只读保护、种子数据、备份→空库恢复→内容校验。该测试不证明真实云端 Auth、图片或 DNS 迁移已完成；这些必须在接入真实服务后单独验收。
