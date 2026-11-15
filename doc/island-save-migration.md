# Mac D1 → NAS PostgreSQL 存档迁移

更新：2026-11-16。NAS 用户截图已确认首次建表迁移成功、维护工具 code 0，Web `/api/health` 返回 200。健康检查不会初始化岛屿；尚未确认 NAS Island 表为空，也没有导入 Mac 旧岛。

## 迁移工具

在 code/ 执行 `npm run save:export`。Node 24 的 `node:sqlite` 以只读模式打开当前项目的 D1 SQLite，通过 backup API 创建包含已提交 WAL 的一致性副本，先检查副本完整性，再从副本读取 local-island。不会调用会自动初始化存档的 GET API，不修改源数据库。自动发现仅搜索本项目 `.wrangler/state/v3/d1`，找到零个或多个存档时拒绝猜测，可以显式指定 `--sqlite FILE`。`--out NEW_DIRECTORY` 指定新输出目录，已有目录拒绝覆盖。

输出在被 Git / Docker 排除的 code/transfers/时间戳目录，目录权限 700、文件 600：

- source.sqlite：Mac 完整本地数据库快照，只留本机，不上传 NAS / Git。
- island-save.json：版本化逻辑存档、源 revision / 时间戳和规范化内容 SHA-256。
- island-import.sql：PostgreSQL 事务导入，只允许 unnamed_island，设置 island_app 角色并锁 Island 表；发现任意已存岛屿立即拒绝，无 UPDATE / DELETE 覆盖分支。
- island-verify.sql：只读核对所有游戏字段、revision 和 updatedAt，与导出快照比较；不一致时返回 SQL 错误，不会修改数据。
- manifest.json、SHA256SUMS、README.md：文件摘要与操作说明。校验和仅用于完整性检查，不提供来源认证；只执行自己的可信导出。

导入 SQL 在同一事务内插入并比对完整状态，校验失败则不提交。字符串通过 SQL 字面量转义，用户数据不拼进 DO 块；包含空字节 / 不合法 Unicode 的名字、非法游戏状态和无效 revision 在导出时拒绝。这个工具只处理当前共享岛，不迁移 User / GameSave 草案，也不是常驻同步服务。

## 本次 Mac 导出

2026-11-16 悉尼时间 00:56:37 导出（UTC 2026-11-15T13:56:37.256Z）：Island of Lucas & Ethan，木材 49、石料 16、建筑 0；鱼池 gold 1 / blue 2 / coral 2 / silver 0，共 5 条；revision 688。以实际导出 JSON 为准，不用旧截图数据重建存档。

本机目录 code/transfers/2026-11-15T13-56-37-254Z；完整 source.sqlite 保留在此。导出后的 Mac 新进度不会自动进入这个快照，迁移完成后以 NAS 为准游玩，避免两边独立发展。

## NAS 导入顺序（用户在 UGREEN 操作）

1. 停止 unnamed-island Web 项目，避免迁移期间游玩 / 创建默认空岛。保留 PostgreSQL 运行。不要访问 `/api/island` 来“检查空库”，它会初始化存档。
2. 先在 PostgreSQL 容器终端运行 `sh /backups/backup-in-container.sh`，备份刚建表后的数据库；成功后继续。
3. 上传迁移包并解压，使 island-import.sql 等六个文件直接位于 `/volume1/backup/nas-postgres/transfers/current`。完整 Mac source.sqlite 不上传。既有 /backups 挂载可直接访问这个 HDD 子目录，不需要重建容器或升级镜像。
4. 在 nas-postgres 的容器终端运行：

```sh
cd /backups/transfers/current
sha256sum -c SHA256SUMS
```

五个文件全部 OK 后，才继续：

```sh
psql -X -U nas_admin -d unnamed_island -v ON_ERROR_STOP=1 -f island-import.sql
psql -X -U nas_admin -d unnamed_island -v ON_ERROR_STOP=1 -f island-verify.sql
```

两次 state_verified 均应为 1，导入须出现 COMMIT。如果提示目标非空，停在这里保留现场，不删除记录、不改 SQL、不用 reset 绕过。运行结束后工具连接退出，SET LOCAL ROLE 和锁均释放；导入不改 mind_friend，不接触 Mac D1。

5. 导入和只读核对成功后重新启动 Web，先确认 health 200。之后通过容器内 API核对实际岛屿，再做受保护的浏览器入口配置；不要在本轮直接开放公网。真实 NAS 导入、重启与备份恢复结果需用户截图另行验收。

迁移代码不会改密码；沿用现有 PostgreSQL 容器的本地管理连接，SQL 在事务内切换 island_app。镜像无需重新发布。数据库备份与迁移包都保存在机械盘，但仍需独立的异机 / 离线副本。

## 验证范围

本地已通过 WAL 一致性备份、源文件 / WAL 不变、完整游戏状态 / revision / 时间戳、篡改校验和拒绝、目录不覆盖、权限和数据库发现歧义等测试。云端工作流 verify-save-transfer.yml 使用合成存档与一次性 PostgreSQL：普通应用角色导入、错库拒绝、非空 / 重复导入拒绝、中途失败整事务回滚、只读检查发现漂移，以及已发布 Web 镜像读回 / 重启核对。实际运行结果见开发进度，不把已编写的检查视为已执行。

SQLite API 依据 [Node 官方文档](https://nodejs.org/download/release/v24.22.1/docs/api/sqlite.html)。当前 Mac Node 会提示 node:sqlite 实验性警告；已用本机实际 API / WAL 测试验证，不需安装 SQLite 驱动。
