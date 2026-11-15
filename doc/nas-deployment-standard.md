# NAS 应用发布规范 v0.1（建议稿）

更新：2026-11-10。适用无名岛，以及未来的 Macro Friend / Mind Friend 等 Web / AI 项目。

已确认环境：Mac 开发；UGREEN NAS 使用 Docker 的 Compose / 项目功能；现有 northblue-nas Cloudflare Tunnel 已运行；截图中连接器为 linux_amd64；NAS 和 Mac 都有 Ollama。用户补充：NAS 资源不足以运行较大的模型，不能把“大模型在 NAS 推理”作为默认部署前提。

本文固定建议的发布流程与接口约定，不代表已完成应用改造或 NAS 配置。NAS 实际数据路径、Git 仓库 / 镜像仓库账号、现有 Docker 网络、Ollama 容器服务名与访问控制仍需在首个项目落地时核对。所有示例域名、目录和服务名均不是已创建的资源。

2026-11-14 最新决定：用户选择共享 PostgreSQL，让无名岛与未来 Mind Friend 各自独立建库 / 账号，并要求仅用 UGREEN 图形界面。已准备 [配置和操作说明](../deploy/postgres/README.md)，未实际启动；当前小岛 D1 / SQLite 存档保持不变。下文旧的“优先 SQLite”属于此前建议，此决定优先。

2026-11-14 补充：无名岛已按当前代码整理 [首次部署计划](unnamed-island-nas-plan.md)，包含 D1 → 普通 SQLite 的差距、存档迁移、镜像与 Tunnel 验收；均尚未落地。

2026-11-15 存储事实：用户确认 Docker 位于 volume2 单 SSD（约 100 GB），PostgreSQL 项目实际为 /volume2/docker/nas-postgres；volume1 是双机械盘 RAID。当前建议活动数据库继续在 SSD，逻辑备份和脚本放 volume1，通过绝对路径绑定到容器 /backups；目标路径需从属性确认，不移动 PGDATA。具体操作见 [数据库存储分层](../deploy/postgres/README.md)。

## 1. 统一流程

```text
Mac：开发 / 测试 → Git 提交 → 发布版本标签
                           ↓
CI：检查 / 构建 linux/amd64 镜像 → 镜像仓库
                           ↓
NAS：备份数据 → 拉取指定镜像 → 迁移 → 更新 Compose 项目 → 检查
                           ↑
浏览器 → 项目子域名 → 现有 Cloudflare Tunnel → 项目 Web 容器
```

推荐默认 GitHub + GitHub Actions + GHCR；若选其他 Git / OCI 镜像仓库，保持同一发布流程。第一次使用前确认账号、仓库可见性和额度。Mac 不必常开，NAS 只运行成品镜像，不执行日常 npm install / 开发服务器或从本地源代码目录运行生产服务。

Mac 若是 ARM 芯片，也要为 NAS 构建 linux/amd64 镜像。CI 采用 amd64 runner，或使用 Buildx 明确目标架构；需要在 Mac 本机也运行同一镜像时再发布 amd64 / arm64 多架构版本。不要把 Mac 的 node_modules 复制进镜像。

## 2. 项目与容器边界

| 内容 | 建议约定 |
| --- | --- |
| Web 应用 | 每项目独立 Compose 项目、独立 Web 容器、唯一服务名 / 网络别名 |
| SQLite | 每项目独立文件目录，挂载到容器 /app/data；不需要单独数据库容器；单实例写入 |
| PostgreSQL 等服务型数据库 | 可共用一个数据库服务容器，但每项目独立数据库 / 账号 / 迁移；按隔离与版本需求再拆实例 |
| 文件上传 | 独立 uploads 持久目录；不要写入临时容器文件系统 |
| Ollama | 复用现有 NAS / Mac 实例，避免每个应用再建一份模型服务与模型目录 |
| Cloudflare Tunnel | 复用现有 Tunnel，为每个应用增加独立子域名 / route |
| 配置 / 密钥 | .env.example 随代码，真实 .env 在 NAS；不烘焙进镜像、不提交 Git |
| 更新 / 重启 | 更新镜像时保留 data / uploads；应用设明确重启策略、日志轮转和健康检查 |

SQLite 的数据目录应位于 NAS 本机文件系统，而非从其他机器挂载的 SMB / NFS 数据库目录。更新容器不会清空持久数据；删除目录或卷仍会丢数据。

### 数据库服务是否共用

原则：项目数据独立，不等于每个项目都必须独占数据库服务容器。

| 方案 | 每个项目的边界 | NAS 运行方式 | 适用方向 |
| --- | --- | --- | --- |
| SQLite | 独立数据库文件、持久目录、迁移与备份 | 由该项目 Web 进程直接访问，无额外 DB 容器 | 当前无名岛、单实例个人 / 家庭应用，优先简单低维护 |
| 共用 PostgreSQL | 每项目独立 database、独立角色凭据、迁移与逻辑备份 | 共享一个 PostgreSQL Compose 基础服务和独立持久卷，各 Web 容器连接它 | 多个应用需要服务型数据库、较多并发写入或多个 Web 实例 |
| 独立 PostgreSQL 实例 | 独立服务、数据库、版本和资源边界 | 需要的项目另建数据库容器 | 不同版本 / 扩展、较强隔离或独立升级需求 |

共享 PostgreSQL 示意（名称只是建议，尚未创建）：

```text
postgres 基础服务容器
  ├─ unnamed_island 数据库 ← island_app 专用角色
  ├─ macro_friend   数据库 ← macro_app 专用角色
  └─ mind_friend    数据库 ← mind_app 专用角色
```

不能只创建不同账号就假定数据库已经完全隔离。PostgreSQL 角色属于整个实例，默认数据库连接权限也需要核对；应按项目收紧连接 / schema / 对象权限，不把管理员账号交给所有应用。每个项目只管理自己的 Prisma schema 与迁移，不让某个应用的初始化脚本重置其他数据库。

PostgreSQL 实例有自己的 Compose 项目与持久目录，应用更新不重建它。共享实例意味着升级、故障和部分备份恢复操作会影响所有连接它的项目；各应用限制连接池，升级前核对兼容性，按项目做逻辑备份并记录角色 / 权限恢复方式。数据卷持久化不是备份。

当前建议：无名岛首个 NAS 版本仍优先普通 SQLite；需要中心数据库的项目可统一采用一个 PostgreSQL 服务。无需为了“统一流程”强迫所有现有应用迁移数据库。若明确选择所有新项目用 PostgreSQL，Mac 开发环境也应运行独立的同版本 PostgreSQL（通常用本地 Compose），不要将日常开发直接指向 NAS 生产库。

SQLite → PostgreSQL 不是只替换连接字符串：Prisma provider / 驱动、迁移 SQL 和数据导入需要按项目适配与验证。当前无名岛仍是 D1 接入，SQLite / PostgreSQL 的 NAS 方案都尚未实施。Macro Friend / Mind Friend 未检查代码，不能预设其数据库兼容性。

### 向量检索建议：先用 PostgreSQL + pgvector

对未来自行开发的 Macro Friend / Mind Friend，优先评估在共享 PostgreSQL 服务中安装 pgvector，按项目独立数据库保存业务表、文档块、元数据与向量。它是 PostgreSQL 扩展，不是必须新增的独立服务。部署时镜像 / 服务端先具备扩展，再在需要的项目数据库启用 vector；不用向量检索的无名岛不必启用。

这仍是建议，尚未创建 PostgreSQL / pgvector 服务或改造项目。现有 AnythingLLM / Open WebUI 的向量后端和数据未核对，不自动统一或迁移。

| 组成 | 职责 | 建议运行位置 |
| --- | --- | --- |
| PostgreSQL + pgvector | 存储向量及相关业务数据、检索近邻 | NAS 共享数据库服务，各项目独立数据库与权限 |
| Embedding 模型 | 将文档和查询转成向量 | 优先实测 NAS 上的小型多语言模型；也可用 Mac / 明确选择的云服务 |
| 对话模型 | 根据检索结果生成回答 | 按前述任务质量和可用性选择 NAS 小模型、Mac 或云服务 |

文档向量通常在导入 / 变更时生成；每次检索仍要给查询生成向量。Embedding 服务若只在 Mac，Mac 离线时检索也会受影响，即使向量库仍在 NAS。Embedding 和对话模型应可分别配置 endpoint / model，不能只用一个 Ollama 地址绑定所有任务。

起步可评估 Ollama 的 embeddinggemma 等小型模型，使用自己的中文 / 英文材料做相关性和速度测试；不要只按参数量决定检索质量。记录模型版本、向量维度、文档分块规则与内容哈希；同一个检索空间的文档和查询使用相同 embedding 模型与预处理。换模型通常需要重建向量，不混用旧向量。保留文档 / 文本与元数据，以便重建。

Prisma 继续管理普通业务表；vector 自定义类型和相似度查询按 Prisma 官方方式用定制迁移与参数化 SQL / TypedSQL 处理，不假定普通 CRUD 已完整支持。初期根据真实数据测查询，再决定索引类型与内存预算；不默认给所有表建立大型 HNSW 索引。

若实测向量检索已需要独立扩容、单独的检索运维或明确的独立向量引擎能力，再考虑 Qdrant；它是独立服务，需要另一个持久化与备份方案，以及与业务数据库同步文档 / 删除状态的逻辑。

参考：[pgvector](https://github.com/pgvector/pgvector)、[Prisma 扩展类型处理](https://www.prisma.io/docs/postgres/database/postgres-extensions)、[Ollama Embeddings](https://docs.ollama.com/capabilities/embeddings)、[Qdrant](https://qdrant.tech/documentation/overview/)。

## 3. 仓库文件约定

```text
repository/
  code/                       # 当前无名岛的应用目录
    Dockerfile                # 多阶段构建、生产启动、非 root 运行
    .dockerignore             # 排除 node_modules / .env / 数据库 / 本地缓存
    .env.example              # 开发配置说明，不包含真实密钥
    ...
  deploy/
    compose.yaml              # UGREEN 项目导入入口
    .env.example              # 镜像版本、域名、数据目录与外部服务示例
    README.md                 # 首装、更新、备份和回滚命令
  .github/workflows/
    image.yml                 # 测试 → 构建 → 发布镜像
  doc/
    ...
```

这是首个落地项目需要创建的文件清单，当前并未生成这些部署文件或修改应用存储实现。其他项目可保持应用目录在仓库根；CI 的构建上下文相应配置，不强制统一代码布局。

建议 NAS 布局（基目录需按实际 UGREEN 路径填写）：

```text
<NAS_APPS_ROOT>/
  unnamed-island/
    compose.yaml
    .env
    data/
    uploads/
  macro-friend/
    compose.yaml
    .env
    data/
    uploads/
  mind-friend/
    ...
<NAS_BACKUP_ROOT>/
  unnamed-island/
  macro-friend/
```

备份目录与活跃数据分开，另保留一份异机备份。不要把数据库放在 Git 工作区后与代码一起覆盖同步。

## 4. 版本、发布与回滚

建议规则：main 提交执行检查；明确发布版本标签（例如 v0.1.0）后构建和发布镜像。生产 Compose 引用固定版本 / commit SHA，重要发布可锁定镜像 digest，避免靠 latest 推断运行版本。

初期先用 UGREEN 项目界面手动更新，流程稳定后再加自动部署。CI 负责构建，不要求在 NAS 安装 CI runner。

每次更新顺序：

1. 在 Mac 完成改动、测试与 Git 提交，创建发布版本。
2. CI 检查成功后推送 linux/amd64 镜像到仓库。
3. 在 NAS 记录当前镜像版本，生成一致性数据库备份与必要文件备份。
4. 将 Compose 的 APP_IMAGE 指向新版本，拉取镜像。
5. 若本次有数据库迁移，用新镜像执行一次项目指定的迁移任务；SQLite 迁移期间停止写入。具体命令由应用落地时提供，不能把不同项目的迁移脚本混用。
6. 更新 Web 容器；检查健康接口、登录 / 权限、关键功能和保存 / 刷新恢复，再确认域名访问。

迁移后旧应用未必兼容新数据库。只有在 schema 向后兼容时可直接切回旧镜像；否则需要停写后同时恢复对应备份，且会丢失备份后的新修改。保留至少上一个可用镜像和对应数据备份，不自动执行破坏性降级。

Compose 支持用新镜像更新单个服务；日常发布不需要重建 Tunnel、Ollama 或所有其他应用。不要在普通更新流程里删除持久卷。

## 5. 域名与 Docker 网络

推荐最终约定一张共享入口网络，例如 nas-edge，让 cloudflared 和各项目的 Web 服务加入。每个 Web 服务使用唯一名字，如 island-web / macro-web / mind-web，Tunnel 的 Service URL 用可解析的服务名。

示例：

| 示例域名 | Tunnel 的内部 Service URL |
| --- | --- |
| island.northblue.cc | http://island-web:3000 |
| macro.northblue.cc | http://macro-web:3000 |
| mind.northblue.cc | http://mind-web:3000 |

上述名称和网络尚未建立。先核对现有 cloudflared 的网络模式和 route，再决定如何加入共享网络；不要直接改动正在运行的 AnythingLLM / Open WebUI。只有在同一个可用 Docker 网络时，容器服务名才能这样解析。独立容器里的 localhost 指向它自己。

若当前 Tunnel 已按 NAS IP + 宿主机端口访问服务，也可先沿用，并为新项目分配不冲突的端口；这是兼容现有环境的落地方式，不能把任意端口填入域名后就视为部署完成。

数据库只接入项目内部网络，Ollama 使用单独共享 AI 网络，例如 nas-ai；仅需要 AI 的应用后端加入，cloudflared 不需要加入 nas-ai。发布给家人可先用 Cloudflare Access；应用级多用户仍需自己的会话与存档 / 数据归属，不只放开 localhost 检查。

## 6. NAS 与 Mac 的 Ollama

建议应用约定以下服务端配置（需由各应用实现，不是所有框架自动识别的通用开关）：

```dotenv
# Mac 原生开发时，应用后端和 Ollama 都在 Mac 上
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=<已安装且适合该应用的模型>

# NAS 发布环境：仅当应用与名为 ollama 的容器共享网络时
# OLLAMA_BASE_URL=http://ollama:11434
```

应用浏览器 → 应用后端 → Ollama。Ollama 不单独配置公开 Tunnel route；本地 Ollama API 默认没有请求认证。AI 调用的超时、取消、流式响应和并发限制由应用后端处理，模型选择与版本写入该项目环境配置。

按项目任务选择推理位置，而不是统一要求 NAS 承担所有模型：

| 任务 / 部署目标 | 建议推理位置 |
| --- | --- |
| 无名岛的现有玩法 | 不需要 Ollama |
| 经实测小模型能胜任的轻量 AI 任务 | NAS Ollama，小模型与应用共享资源需留余量 |
| 较大模型、需要更高生成质量的个人使用任务 | 优先在 Mac Ollama 测试；是否能运行取决于该 Mac 的内存与模型，不预设性能 |
| 需要 24 小时可用、NAS 又无法运行目标模型的 AI 功能 | 项目明确选择云端 API 或独立推理设备，并考虑费用与数据去向 |

应用可通过项目级 AI 配置固定 provider / base URL / model，例如服务端 AI_PROVIDER=ollama，OLLAMA_BASE_URL 指向 NAS 或 Mac 的实际可达地址，OLLAMA_MODEL 为实测可用模型；使用云 API 时需按所选服务单独实现适配与密钥配置。这里的变量是建议接口，不能假定现有 Macro Friend / Mind Friend 已支持。

选择 Mac 时，先确认监听范围、局域网防火墙与网络可达性。Mac 休眠 / 关机时该推理服务不可用，应用需明确显示“AI 暂不可用”，并保留非 AI 功能与输入；不要自动把用户内容改发云端。可由用户 / 管理员明确切换到已配置且适合任务的 NAS 小模型或云服务，不把小模型当成等价质量的无感替代。开发也可调用 NAS 的模型进行一致性验证。

应用部署在哪台机器与模型跑在哪台机器可以分开。当前未测 NAS / Mac 的模型速度、可用内存与并发能力，因此不承诺 NAS 能顺畅运行某个大模型。

## 7. 健康与备份约定

- 每项目提供 /api/health，返回应用版本和就绪状态；不要返回密钥或模型提示词。
- 区分应用自身可用与 Ollama 暂时不可用，避免模型离线造成容器无限重启；部署验收另做模型真实调用。
- SQLite 使用在线备份 API / SQLite .backup 或停写后的完整一致性备份；不要只复制运行中的主 .db 文件而忽略 WAL。
- 保存数据库、上传文件和必要配置的加密备份；记录日期、应用版本、schema 版本，并周期性测试恢复。
- 应用日志输出到容器 stdout / stderr，由 Docker 限制日志大小；关键错误可查，不默认记录隐私对话全文。

## 8. 无名岛的首个落地范围

无名岛当前仍是 PrismaD1 + OpenNext，数据在本地 Wrangler D1 模拟器，尚不能直接使用普通 Next.js 容器并保存生产数据。落地需要：

1. 将 NAS 路径适配为 Node.js + Prisma 的普通 SQLite 连接，并提供显式开发 / 生产配置。推荐 NAS 方案落地后开发也使用普通 SQLite，减少双运行时维护；是否保留 D1 作为另一个目标由后续决定。
2. 制作独立、可挂载 /app/data 的 Docker 镜像及 UGREEN Compose 项目。
3. 导出当前逻辑存档 JSON，初始化新 SQLite 并校验导入；不要直接把 .wrangler 内部文件路径当成生产 DB 配置。
4. 处理当前固定 local-island 和 localhost 限制，确定家人共享岛 / 每用户独立岛与访问方案。
5. 降低连续生长导致的高频保存、补部署健康检查和备份 / 恢复步骤。
6. 按真实数据目录和网络填写配置，验证 NAS / Tunnel 下保存、刷新、鱼池和新鱼模型后再推广到其他项目。

Macro Friend / Mind Friend 的现有代码与数据库尚未检查，本文不假定它们已经实现这些接口，也不修改其部署。

## 9. 核对依据

- [Docker Compose 生产部署](https://docs.docker.com/compose/how-tos/production/)
- [Docker 多平台镜像](https://docs.docker.com/build/building/multi-platform/)
- [GitHub Actions 发布到镜像仓库](https://docs.docker.com/build/ci/github-actions/push-multi-registries/)
- [Compose 网络与服务名](https://docs.docker.com/compose/how-tos/networking/)
- [Cloudflare Tunnel 路由](https://developers.cloudflare.com/tunnel/concepts/routing/)
- [Ollama Docker](https://docs.ollama.com/docker) / [API](https://docs.ollama.com/api/introduction)
- [SQLite 一致性备份](https://sqlite.org/backup.html)

补充参考：[PostgreSQL 多数据库与项目隔离](https://www.postgresql.org/docs/current/manage-ag-overview.html)、[SQLite 适用场景](https://www.sqlite.org/whentouse.html)、[Docker 持久卷](https://docs.docker.com/engine/storage/volumes/)。
