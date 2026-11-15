# UGREEN 图形界面：共享 PostgreSQL 部署

更新：2026-11-15。用户提供 UGREEN 日志截图，确认 NAS 的 PostgreSQL 17.12 已完成集群初始化并正常接受连接。用户后续目录查询截图确认 unnamed_island / island_app、mind_friend / mind_app，以及 mind_friend 的 vector 0.8.7；mind_app 的 TCP 密码登录已由截图确认，island_app 登录、权限隔离、真实业务数据的重启持久化待验证；当前空库的逻辑备份与临时库恢复已通过用户截图确认；当前 Mac 没有 Docker。

PostgreSQL 是 SQL 关系型数据库，不是 MySQL，也不是 NoSQL。本镜像包含 pgvector 扩展，方便未来 Mind Friend 做向量检索；数据库不运行大模型，Ollama 是独立服务。

| 数据库 | 账号 | 初次启动后的内容 |
| --- | --- | --- |
| unnamed_island | island_app | 空库，等待无名岛适配与存档迁移 |
| mind_friend | mind_app | 空库 + vector 扩展，尚无业务表 / 向量索引 |

管理员 nas_admin 单独使用，不交给应用。不同项目使用不同密码；初始化取消 PUBLIC 对项目数据库的权限，并限制应用只能连接自己的项目库。共享服务升级 / 故障会影响两个项目。

## 创建前注意：必须先准备 .env

Compose 中的 `${VAR:?提示}` 在配置解析时就要求变量有值；取消“创建后立即运行”也不会跳过。不能先创建 Docker 项目再补必填变量。请先用 NAS 文件管理器建立普通目录 / 解压文件，完成第二步 .env，再导入项目。只在 Mac 导入 compose.yaml 并不会把 init 或 .env 一起上传。

如果界面仅显示“无效配置文件”，先核对 .env 是否位于 UGREEN 实际项目工作目录、四个必填变量是否有值；若仍失败，查看完整错误，不能直接推定是 YAML 缩进或删除数据。当前只验证 YAML 语法，未复现该 UGOS 错误的完整详情。

## 绿联界面只提示“无效配置文件”时

截图确认用户在创建页面导入的是带变量 / 顶层 name 的原版，但没有显示底层错误；未确认具体是 .env 读取还是界面校验兼容问题。新增 **compose.ugreen.yaml** 作为独立导入版本：无顶层 name、无变量插值、固定镜像、相对 ./data / ./init，保留内部网络和密码认证。

1. 在创建页面重新导入 compose.ugreen.yaml，保留“创建完成后立即运行”为未勾选，先保存项目。
2. 保存后在项目实际目录补齐 init/10-projects.sh 与空 data 文件夹；编辑项目配置里的三个空密码，填不同的至少 32 字符随机密码。只在 NAS 编辑，不将含密码的配置发到聊天或重新打包到公开仓库。
3. 无变量版本不读取 .env 中的密码，必须编辑这三个字段；其他启动 / 隔离验证要求不变。未准备好时不要启动；默认管理员密码为空，官方入口会拒绝空密码初始化，并非无密码服务。
4. 这个版本的 YAML 静态检查通过，但仍没有真实 Docker / UGOS 配置解析结果，不能保证已解决当前 UI 错误；需要用户反馈重新导入结果。

使用可选宿主脚本时，如果绿联将文件保存为 compose.yaml，则按默认命令执行；若实际保留 compose.ugreen.yaml，需通过 COMPOSE_FILE=compose.ugreen.yaml 指定同一文件，避免误读原版变量配置。完成密码后该文件属于私有配置，必须保护。下文为原 .env 版本的完整部署说明，不与此无变量版本混用。

## 第一步：上传并解压

将 `nas-postgres-setup.zip` 上传到 NAS 的独立部署目录并解压。确认以下结构在同一项目根目录：

```text
nas-postgres/
  compose.yaml
  .env.example
  init/10-projects.sh
  scripts/...
```

不要覆盖 AnythingLLM / Open WebUI 的现有目录。NAS 路径必须使用实际完整路径，不能猜测为示例的 /volume1。

## 第二步：准备 .env 和专用 data 目录

1. 在 nas-postgres 内建立空的 `data` 文件夹，仅供这个全新 PostgreSQL 实例使用。
2. 复制 `.env.example`，命名为 `.env`（注意开头的点，可能需要文件管理器显示隐藏文件）。
3. 用 NAS 文本编辑器修改：

```dotenv
POSTGRES_DATA_DIR=<data 文件夹在 NAS 上的实际绝对路径>
POSTGRES_BACKUP_DIR=<独立备份文件夹的实际绝对路径>
POSTGRES_IMAGE=pgvector/pgvector:0.8.7-pg17-bookworm
POSTGRES_PASSWORD=<管理员密码>
ISLAND_DB_PASSWORD=<无名岛专用密码>
MIND_DB_PASSWORD=<Mind Friend 专用密码>
```

把尖括号占位内容全部替换。三个密码使用密码管理器各自生成的至少 32 位随机字母数字，避免 `$`、`#`、引号等干扰 .env 解析的字符。不要将 .env 截图 / 发到聊天 / 提交 Git。环境变量可被有容器管理权限的人查看；此方案适应用户仅用 UGREEN GUI 的偏好，NAS 管理员需要保护项目目录和配置。

POSTGRES_DATA_DIR 必须在 NAS 本机文件系统，不使用 SMB / NFS 网络共享。POSTGRES_BACKUP_DIR 是记录用配置；备份脚本要求显式 BACKUP_DIR，不自动执行 .env 的内容。无名岛现有 SQLite 不会被此步骤覆盖、删除或迁移。

## 第三步：UGREEN Docker 导入 Compose

在 UGREEN Docker 的 Compose / 项目功能创建独立项目，选择已解压目录的 compose.yaml，确保工作目录和 `.env` 位于同一根目录。不同 UGOS 版本界面文字可能不同，具体选择以当前界面为准。

导入前核对：

- 项目名 `nas-postgres`；镜像 `pgvector/pgvector:0.8.7-pg17-bookworm`。
- 文件夹挂载：NAS 的 data → `/var/lib/postgresql/data`；本地 init → `/docker-entrypoint-initdb.d` 只读。
- `.env` 的实际路径和密码已填；配置解析不能出现 REPLACE_WITH 等占位文字。
- 没有宿主机端口映射，不将 5432 配置到 Cloudflare Tunnel。

启动后查看容器状态和日志：应完成两个数据库 / 角色、vector 初始化，并出现 `database system is ready to accept connections`；健康检查应转为 healthy。不要把包含环境变量或密码的界面截图公开。

首次初始化只会在空 PGDATA 发生；如果中途失败，不能假设重启会补跑全部脚本。保留目录和日志排查，不把删除 data 当作通用修复方式。编辑 .env 不能轮换已有库密码，轮换需显式修改数据库角色。

## 第四步：验证 / 接入

仅看到容器运行并不等于应用接好。下一步需要检查两个账号真实登录、各自读写、跨库访问被拒绝、vector 可用。包内 `scripts/verify.sh` 用 TCP 和真实密码检测并回滚测试表，需在 NAS 宿主终端执行；用户目前仅 GUI，因此尚未执行，后续可使用 UGREEN 容器终端或数据库客户端完成等价检查。

未来应用自己的 Compose 加入数据库网络：

```yaml
services:
  web:
    networks:
      - default
      - database
networks:
  database:
    external: true
    name: nas-postgres-data
```

连接串模板（仅放应用服务端配置）：

```text
postgresql://island_app:<密码>@nas-postgres:5432/unnamed_island?schema=public
postgresql://mind_app:<密码>@nas-postgres:5432/mind_friend?schema=public
```

共享网络提供容器名称解析，Web 仍保留自己的入口网络；cloudflared 不加入数据库网络。不同项目不共享数据库账号。此配置没有为 Mac 开放访问端口，Mac 开发推荐独立同版本本地数据库。

现有无名岛仍用 PrismaD1 / SQLite，下一阶段才改 provider / 驱动、建立 PostgreSQL 迁移并导入存档；Mind Friend 代码尚未检查，本包仅预留库和扩展。

## 镜像与资源

按此前 NAS 架构信息设置 linux/amd64；首次启动核对实际架构。镜像固定 pgvector 0.8.7 和 PostgreSQL 17，拉取后记录实际 digest / server_version。不是 Docker 官方 postgres 镜像本体，而是 pgvector 项目基于官方 Postgres 镜像发布的版本。

1 GiB 内存上限、128 MiB shared_buffers、50 连接是起点，不代表实测承载量；每应用角色限制 15 连接，应用池仍需限制。默认自动重启、日志轮转。pg_isready 通过 TCP 检测最终服务就绪，不替代身份 / 权限验证。

## 当前 NAS：SSD 数据与机械盘备份分开

用户确认 volume2 是当前单块约 100 GB SSD，Docker / PostgreSQL 项目路径已由属性截图核实为 `/volume2/docker/nas-postgres`；volume1 为双机械盘 RAID，具体 RAID 类型未核查。数据库继续使用现有 SSD 的 data，不迁动活动 PGDATA。

建议在 volume1 建立一个备份共享文件夹，再建 nas-postgres 子目录。2026-11-15 用户属性截图已确认目标为 `/volume1/backup/nas-postgres`（backup 是单数）。当前配置只替换 /backups 的宿主挂载来源为：

```yaml
    volumes:
      - ./data:/var/lib/postgresql/data
      - ./init:/docker-entrypoint-initdb.d:ro
      - /volume1/backup/nas-postgres:/backups
```

上述目录已由用户创建并在属性中确认；截图显示当时为空目录。数据和 init 两行保留当前有效值，不从空密码模板覆盖 NAS 配置。

备份脚本也可上传到这个机械盘目录，仍执行 `sh /backups/backup-in-container.sh`；脚本会直接把导出文件写到机械盘，不先占用 SSD 生成完整备份。不需要搬 Docker 项目或活动数据库。脚本不在 init 目录。

相对 `./backups` 会指向 volume2 的项目目录，不能达到跨 SSD / HDD 的目标，所以这里应使用核实过的 volume1 绝对路径。修改挂载并重建容器后，先确认运行正常和目录实际挂载，再执行备份。现有 SSD 备份如已经生成，另外复制到机械盘目录，不因切换挂载假定旧文件自动搬走。

RAID 提供磁盘故障冗余，不替代历史备份；这份逻辑导出是独立副本，但同一 NAS 上的两个卷仍不防整机损坏 / 误删或勒索，重要数据后续再保存异机或离线副本。目标机械盘路径已由截图核对，但尚未验证 NAS 中的挂载 / 写权限或执行真实备份。

## 纯绿联 GUI 的第一次备份（容器终端）

用户反馈完成隔离检查和密码轮换后，下一步建立备份。保留 NAS 已填的新密码，只增加下面挂载，不用空密码模板覆盖当前配置。

1. 将 scripts/backup-in-container.sh 上传到已确认的 /volume1/backup/nas-postgres 机械盘目录（不要放 init，避免首次建库时自动执行）。
2. 当前 Compose 的 volumes 增加或替换备份行为 `/volume1/backup/nas-postgres:/backups`，同一目标 /backups 只保留一行，保留原 data / init 挂载。保存、重新部署并确认运行后，在绿联容器终端执行 `sh /backups/backup-in-container.sh`。无需宿主机 Docker 命令 / SSH。
3. 脚本会先确认 /backups 是实际挂载点；未挂载时拒绝写入，避免备份只留在临时容器层。成功在 NAS backups 中生成 UTC 时间目录，包含角色和每个业务库的归档。错误留 .partial，不能当作成功备份。
4. `pg_restore --list` 只检查归档可读取，不代表恢复演练。后续还需在独立恢复库演练，并把一份备份安全复制到其他设备 / 存储位置。这个同 NAS 本地目录不能防范整台 NAS / 存储池损坏。

roles.sql 含角色密码哈希，备份文件以 owner-only 权限建立，不将文件内容贴到聊天。脚本不修改业务数据、不自动删除旧备份；多库不是单一跨库事务快照。2026-11-15 用户终端截图确认首次运行成功，目录为 /backups/20261115T120737Z-65；宿主对应机械盘内容及恢复结果仍待验证。

## 第一次备份后的非覆盖恢复验证

用户终端已显示 `Backup completed: /backups/20261115T120737Z-65`。将 `scripts/restore-check-in-container.sh` 上传到 NAS 的 `/volume1/backup/nas-postgres`，在同一容器终端执行：

```sh
sh /backups/restore-check-in-container.sh 20261115T120737Z-65
```

脚本只接受完成目录名，不接受 .partial / 路径；逐库创建新的唯一 restorecheck_* 库，恢复归档、查询表目录及 Mind Friend 的 vector，最后清理本次创建的临时库。不会用 --create / --clean 覆盖原库，不还原 roles.sql 或重置密码。如果重名导致 createdb 失败，不会清理那个原有库。

成功末尾显示 `Restore check passed. Temporary databases removed; originals were not targeted.`。失败时也尝试清理自己创建的临时库，清理失败会报出名称并返回非零，不自动删除其他数据库。脚本应只用于自己可信的 NAS 备份，不执行来源不明的 dump。

这验证的是已有角色 / 扩展安装环境下，当前快照能在同实例另一个库还原并查询；不等于空实例的角色 / 密钥 / 整机恢复，也不替代以后有真实业务数据时的应用级数据核对。2026-11-15 用户截图已确认这份快照恢复通过：两个库均为 0 张业务表，Mind Friend vector 0.8.7 正常，临时库已清理；原库未被覆盖。这是当前空库的同实例归档恢复验收，不等于真实业务数据或空新实例整机恢复。

## 备份、更新与恢复

data 挂载是持久化，不等于备份。备份需 PostgreSQL pg_dump / pg_dumpall，不直接复制运行中的 data 目录。

可选宿主终端工具（目前未实际运行）：

```sh
BACKUP_DIR=/actual/nas/backup/path sh scripts/backup.sh
```

脚本输出 roles.sql（含密码哈希）、每个非模板业务库的 custom-format .dump、镜像 ID 和库清单。每库单独的一致性快照，不是跨库统一事务；失败保留 `.partial`，不会标为成功。文件 owner-only，需保护 / 加密异机副本。不自动清理旧备份。纯 GUI 使用者可后续通过 UGREEN 容器终端执行 pg_dump，再由文件管理器取出；正式上线前必须安排可操作的备份流程并做恢复演练。

恢复先使用新库或独立恢复实例演练；已有角色时不能盲目重复执行 roles.sql。使用 pg_restore --exit-on-error，核对数据后才切换应用，避免覆盖正在用的数据库。

更新前备份并记录旧 digest，更新只换容器，保留 data。PostgreSQL 17 升 18 需要单独迁移，不能只更换大版本标签。密码和配置另安全备份。

## 可选终端工具与验证范围

- `prepare.sh`：首次生成带随机密码的 .env，不覆盖已有 .env，不打印密码；GUI 用户不需执行。
- `verify.sh`：真实身份 / 读写 / 跨库拒绝检查，尚未执行。
- `backup.sh`：生成按库逻辑备份，尚未执行真实备份 / 恢复。

已完成 YAML 解析、无宿主端口 / 内部网络 / TCP 健康检查静态检查，shell 语法检查，以及临时目录中密码生成不覆盖与备份失败 `.partial` 的模拟验证。不能据此宣称 NAS 服务已经运行或 SQL 权限已实测。

来源：[pgvector 镜像标签](https://github.com/pgvector/pgvector#docker)、[Postgres 镜像初始化和密码配置](https://hub.docker.com/_/postgres)、[PostgreSQL 多库](https://www.postgresql.org/docs/17/manage-ag-overview.html)、[逻辑备份](https://www.postgresql.org/docs/17/backup-dump.html)。
