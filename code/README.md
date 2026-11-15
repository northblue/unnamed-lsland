# 无名岛 / Unnamed Island

更新：2026-11-15。Next.js App Router + JavaScript + Three.js；数据库默认采用 Prisma + Cloudflare D1，新增可选 Node PostgreSQL 模式供后续 NAS 部署；存档未迁移。

## 本地运行

在 `code/` 下执行：

```sh
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

打开 http://localhost:3000。本地通过 OpenNext 初始化 Wrangler 的 D1 模拟器，数据持久化在 `code/.wrangler/state/` 的 SQLite 文件中。重启开发服务器不会清空存档；删除该目录会丢失本地数据。无需 PostgreSQL、DATABASE_URL 或 Cloudflare 登录；本地没有配置 remote binding，不会读写生产数据。添加或修改 Next 配置后需要重启 dev。

WASD / 方向键移动，靠近树木或大石头按 E 采集。每处资源提供 3 份，建造小屋需要 6 木材和 3 石料。材料足够后可推荐空地并确认建造。拖动旋转、滚轮缩放，视角面板支持俯视、斜俯视及侧视。海面点击有涟漪和水花，拖动有弹性晃动；四类小鱼与鱼池使用 Quaternius CC0 骨骼模型，小鸟 / 海鸥使用 Mesh2Motion CC0 模型与动画；小鱼可钓获，鲸鱼 / 海豚使用骨骼模型，另有独立海豹和章鱼用于观赏；夜空与太阳另用 AI 生成的油画贴图。

岛名、材料、已采集资源状态、角色位置、建筑、分类鱼篓和鱼池会自动保存（变化后约 1 秒检查一次）；刷新从数据库恢复。界面“管理岛屿”可以修改名字、木材、石料及建筑位置，添加或移除小屋，保存前校验岸线、资源与建筑占地。管理界面修改不会扣建造配方材料；正常游戏建造仍会扣材料。海洋生物的路线 / 位置和水花不存档，语言偏好独立保存在 localStorage。

断开数据库时显示错误，可主动选择离线试玩；离线进度不会保存。写入失败有提示和重试，多标签页旧版本保存会报冲突，需要先保留修改再刷新，不会静默覆盖新存档。

## 操作速查

| 操作 | 方式 |
| --- | --- |
| 移动 / 采集 | WASD / 方向键；靠近资源按 E |
| 建造 / 取消 | 材料够后点放置小屋、推荐空地、确认；Esc 取消 |
| 钓鱼 | 靠岸按 F，点击海面或附近鱼群按钮；F / Esc 收竿退出 |
| 镜头 | 拖动、滚轮及视角按钮；建造时右键拖动 |
| 昼夜 / 声音 | 时间面板选择速度及预览；管理按钮下方开启环境声 |
| 编辑 / 语言 | 管理岛屿；右上角中文 / EN |

需要先点击游戏画面恢复键盘焦点。当前没有完整手机触控移动或一键重置功能。

## 保存内容

| 内容 | 保存位置 / 刷新行为 |
| --- | --- |
| 岛名、木石、资源点剩余量、玩家 XZ、建筑、鱼篓、鱼池 | D1；自动保存后刷新恢复 |
| 语言偏好 | 浏览器 localStorage；尽可能保留 |
| 昼夜速度、预览时间、声音开关 | 会话状态；刷新回到现实时间、静音 |
| 鱼群 / 鸟类位置、浮标、水花、风浪形变 | 不保存 |

## 默认 D1 模式的对应关系

| 内容 | 本地 | 未来生产 |
| --- | --- | --- |
| 数据库 | Wrangler 模拟的 D1，底层 SQLite | Cloudflare D1 |
| Prisma | PrismaD1 + DB binding | PrismaD1 + DB binding |
| 数据位置 | .wrangler/state | Cloudflare 管理的独立数据库 |
| 迁移 | npm run db:migrate（--local） | npm run db:deploy（--remote） |

已应用的本地迁移：`migrations/0001_island_persistence.sql` 建立基础表，`migrations/0002_fishing_catches.sql` 增量增加鱼篓，`migrations/0003_seaside_pond.sql` 增加鱼池。扩岛、昼夜和自然景观不需要新的数据库字段。

Prisma schema 在 `prisma/schema.prisma`；D1 SQL 迁移在 `migrations/`，由 Wrangler 跟踪。不要用 prisma migrate dev / deploy 或 db push 操作 D1。后续改表时，用 Prisma migrate diff 对比上一个 schema 与新 schema 生成 SQL，再审查并保存为新的顺序编号迁移；不要改写已应用的迁移。

数据库只在服务端访问。`src/lib/prisma.js` 每次请求按 DB binding 创建客户端，不跨请求缓存绑定。Island 用 JSON 保存建筑、资源点状态和分类鱼篓，与材料数量一起在单条带 revision 条件的 UPDATE 中保存，避免依赖 D1 不支持的 Prisma 交互式事务。User / GameSave 仍是未来认证的模型草案。

## PostgreSQL / NAS 准备状态

默认 Mac 开发和原 D1 存档保持不变。设置 `ISLAND_DATABASE_PROVIDER=postgresql` 和服务端 `DATABASE_URL` 后使用独立 PostgreSQL 客户端、每进程最多 5 个连接。只填写 URL 不会自动切换；切换模式不导入数据。`npm run db:generate` / `db:validate` 同时处理两份 schema。

PostgreSQL 的建表文件在 `prisma/postgresql/migrations/`；未来核对目标后用 `npm run db:pg:status` / `db:pg:deploy`。已在 CI 临时 PostgreSQL 17.12 通过迁移、读写 / 冲突 / 重启检查，尚未操作 NAS 应用库或导入现有岛屿；API 仍限定 localhost，Access / Origin / 镜像及逻辑存档迁移尚待完成，不能直接开放公网。首版按自己 / 家人共用一座岛实施，User / GameSave 仍是未接入的模型。

详见 [PostgreSQL 适配说明](../doc/postgresql-app-adapter.md)、[独立容器与镜像发布](../doc/nas-island-container.md) 和 [NAS 计划](../doc/unnamed-island-nas-plan.md)。原 `wrangler.jsonc` / OpenNext 仍保留 D1 开发与预览能力，真实生产 D1 未创建；NAS 是当前选定的发布方向。不要复用其他项目的库、账号或存档。

Docker 构建上下文为 code/，Dockerfile 的 web / tools 分别对应应用和显式迁移维护镜像。`ISLAND_STANDALONE=1` 启用 standalone；普通 D1 开发不启用。`/api/health` 只读查询 Island 表，数据库不可用或未建表返回 503，不初始化岛屿。现有 localhost API 限制保留，当前 Compose 没有公开端口或 Tunnel，不能直接作为公开上线配置。

## 现有存档导出

`npm run save:export` 使用只读 SQLite backup API 导出当前 D1 岛屿到被 Git / Docker 排除的 transfers/。完整 SQLite 副本保留本机，JSON / SQL 导入包含 checksum、事务和目标非空拒绝保护，不需要升级 NAS 镜像。步骤见 [Mac → NAS 存档迁移](../doc/island-save-migration.md)。

## 局域网访问

可显式设置 `APP_ORIGIN=http://192.168.4.82:3080`，再将 NAS 该 IP 的 3080 映射到容器 3000；默认未设置仍仅 localhost。写入需精确匹配 Origin，伪造 forwarded 头不放行。先迁移旧存档，再启用浏览器入口，具体版本和操作见 [局域网说明](../doc/nas-lan-access.md)。
