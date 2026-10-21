# 两个人如何一起开发

main 保存能运行的版本。每个任务建一个短分支、提交小范围修改、开 Pull Request，由另一人看过后合并。

```sh
git switch main
git pull --ff-only
git switch -c feat/real-canteen-layout
# 修改后
npm test
npm run data:validate
npm run build
git add <明确要提交的文件>
git commit -m "feat: add verified canteen layout"
git push -u origin feat/real-canteen-layout
```

在 GitHub 打开 PR，说明改了什么、如何验证、哪些数据仍未核实。不要使用 force push 覆盖同事的 main。不要同时编辑同一份食堂布局；可以一人负责场景、另一人负责数据采集。

数据库结构新增迁移文件，例如 `002_spatial_constraints.sql`；已经执行过的文件不再修改，脚本会核验 SHA-256。破坏性修改先设计兼容期与数据回填，再做下一次迁移。生产库操作前备份并演练恢复。

用 Codex 时给出具体范围，例如：“只补齐 v-456-f1 的实测窗口坐标，不改变其他楼层；运行空间校验并解释变化。”不要把真实用户导出、服务密钥或私有原图直接提交进公开 PR。

## 变更验收

- 校园→建筑→楼层→详情、返回、搜索和风格切换都能用。
- 新窗口有稳定 ID、floorId、明确坐标与朝向；示例数据保持清楚标注。
- 桌面和手机屏幕检查，键盘能通过列表完成浏览。
- CI 的类型构建、单元测试、数据库权限测试和备份恢复测试通过。
- 合并后检查 Deploy Pages，失败时读日志，不用重新创建仓库。

仓库公开并不自动代表选择了开源许可。项目许可证与校园原图、照片的授权需要项目所有者决定；当前未擅自加入第三方内容授权或学校官方背书。
