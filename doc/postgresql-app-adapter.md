# 小岛 PostgreSQL 适配第一步

更新：2026-11-15。已准备 Node PostgreSQL 接入代码和独立基线 SQL，尚未连接 NAS、运行建表或迁移当前岛屿。首次部署仍按 [NAS 计划](unnamed-island-nas-plan.md) 分步进行。

## 两种模式

默认 `ISLAND_DATABASE_PROVIDER=d1`，继续使用 Mac 的 Wrangler 模拟 D1 / SQLite，原 `.wrangler/state` 不变。只有明确设置 `ISLAND_DATABASE_PROVIDER=postgresql` 才改用 PostgreSQL；仅存在 DATABASE_URL 不会切换。错误的模式值直接报错，连接失败不会回退另一份存档。

PostgreSQL 通过 PrismaPg 驱动和独立生成的客户端接入；每个 Node 进程共用一个最多 5 连接的池，建连等待 5 秒、闲置连接 30 秒后释放。多个进程的总连接数需要另外核算。开发热更新复用同一客户端；D1 binding 继续按请求取得。数据库只在服务端访问。

两份 schema 的模型字段保持一致，由测试防止遗漏；D1 的 SQLite 迁移和 PostgreSQL 的迁移历史分开，不能交叉执行。API 的数据校验、单条 UPDATE 原子保存和 revision 冲突返回 409 保留。

## 文件和命令

在 code/ 下执行：

```sh
npm install
npm run db:generate
npm run db:validate
npm run test:database
```

`db:generate` 生成 D1 默认客户端和 `src/generated/postgresql` 客户端，生成目录不提交。PostgreSQL schema 在 `prisma/postgresql/schema.prisma`，基线在 `prisma/postgresql/migrations/20261115000000_initial/migration.sql`；包括 Island、User 和 GameSave，后两者仍不代表已实现认证。

以后在独立本地 PostgreSQL 开发库、或部署阶段确认的 NAS 目标中，将以下设置私下写入应用 `.env` / 容器环境；密码须 URL 编码，不用 NEXT_PUBLIC_ 前缀：

```dotenv
ISLAND_DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://island_app:URL_ENCODED_PASSWORD@nas-postgres:5432/unnamed_island
```

`nas-postgres` 只能由加入 NAS 数据库网络的容器解析，Mac 不直接连这个内部名称。Mac PostgreSQL 开发应使用独立开发库，不能拿 NAS 正式库做开发或 reset。

在下一阶段核对目标并备份后，才执行 `npm run db:pg:status` / `npm run db:pg:deploy`。两个命令先校验 DATABASE_URL，再调用 Prisma Migrate；没有 URL 直接失败。它们不会创建 PostgreSQL 服务、账号或导入旧岛。不要用 `db push` / `migrate reset` 替代部署迁移。

纯 schema 比较生成 SQL 时，这个版本的 Prisma 引擎也需要配置 URL；可给临时占位值（下例不连接数据库）：

```sh
DATABASE_URL=postgresql://unused@127.0.0.1:1/schema_diff npx prisma migrate diff --config prisma.postgresql.config.mjs --from-empty --to-schema prisma/postgresql/schema.prisma --script
```

## 验收边界与下一步

已验证双 schema 校验与生成、配置选择和字段一致性测试、部署缺少 URL 时拒绝、67 项游戏规则回归、D1 / PostgreSQL 两种构建；临时开发服务器只读 GET 成功加载原 D1 岛屿，随后关闭服务。后续 Actions 43716023910 已在临时 PostgreSQL 17.12 验证建表、JSON 存档读写、revision 并发及 Web 重启后的状态比对，见容器发布说明；NAS 实际应用账号 / 现有岛屿迁移、连接池回收及备份恢复仍未验收。本机没有 PostgreSQL / Docker 服务，未访问 NAS 数据库。

当前 API 仍限定 localhost，不是可直接对外发布的 NAS 版本。后续依次做逻辑存档导出 / 拒绝覆盖的导入工具、独立 PostgreSQL 真机读写验收、APP_ORIGIN / 家庭 Access 权限、镜像和 UGREEN 应用 Compose，最后切换存档与 Tunnel。切换数据库不会自动搬迁岛屿，也不会同步 Mac 与 NAS 的进度。

接入方式参照 [Prisma 官方驱动说明](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/database-drivers)；具体安装版本与接口也已对照本地包。
