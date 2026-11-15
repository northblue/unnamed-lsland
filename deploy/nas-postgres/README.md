# UGREEN 图形界面：共享 PostgreSQL 部署

2026-11-14。配置包已准备，尚未在 NAS 启动。当前 Mac 没有 Docker，未运行真实初始化 SQL、身份隔离或备份恢复验证。

PostgreSQL 是 SQL 关系型数据库，不是 MySQL，也不是 NoSQL。本镜像包含 pgvector 扩展，方便未来 Mind Friend 做向量检索；数据库不运行大模型，Ollama 是独立服务。

| 数据库 | 账号 | 初次启动后的内容 |
| --- | --- | --- |
| unnamed_island | island_app | 空库，等待无名岛适配与存档迁移 |
| mind_friend | mind_app | 空库 + vector 扩展，尚无业务表 / 向量索引 |

管理员 nas_admin 单独使用，不交给应用。不同项目使用不同密码；初始化取消 PUBLIC 对项目数据库的权限，并限制应用只能连接自己的项目库。共享服务升级 / 故障会影响两个项目。

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
