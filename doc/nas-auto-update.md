# 小岛自动发布与 NAS 更新

更新：2026-11-18。目标：Mac 推送 main → GitHub 测试和构建 → 发布 nas-stable → NAS 每 5 分钟检查，仅更新小岛 Web。NAS 不需要 GitHub Token、Git、Node、源码或本地构建。

## 发布规则

- main 上 code/、镜像 workflow 和更新器源码变化时自动构建；纯 doc/ 或固定版本记录修改不触发。保留 workflow_dispatch 手动验证（默认不发布）。分支不会发布生产频道。
- 先完成游戏 / 服务端测试、PostgreSQL / LAN / 登录 / 保存 / 重启验收，再验证更新器真实替换、坏版本回退和隔离，全部通过才上传镜像。SHA 标签 / digest 保留可追溯版本，nas-stable 是供检查的可变频道。
- 发布时再检查 main 是否有更新的相关源码，旧的排队构建不会覆盖较新的源代码频道；仅文档变化不阻止已验证代码发布。无需把 GitHub Actions 的 Token 放到 NAS。
- 更新器本身使用固定 digest，不自动更新自己。代码改动不自动修改环境变量、密码、端口、数据库、Ollama 或 Cloudflare 路由。

## 一次性在绿联启用

先确认 deploy/island/release.json 与 deploy/auto-update/release.json 已记录本次验收成功的真实镜像；若仍是占位或 pending，不能启动。

1. 正常执行已有数据库备份 `sh /backups/backup-in-container.sh`。
2. 在现有 unnamed-island 项目中将 image 换成配置包 WEB-IMAGE.txt 的固定版本，其他私密 environment / 网络 / 端口保留，重新部署并确认 healthy 和原岛存档正常。这一步为镜像加上数据库结构兼容标记，旧版本没有标记，更新器会拒绝自动替换。
3. 在 `/volume2/docker/apps/unnamed-island-updater` 建立独立项目，导入配置包中的 compose.ugreen.yaml。不要导入到原 Web 项目，不要修改 PostgreSQL 或 AI 项目。
4. 核对 COMPOSE_FILE 为 `/volume2/docker/apps/unnamed-island/docker-compose.yaml`；实际文件名不同时同步修改。Web 项目目录挂载的左右绝对路径必须相同。更新器 project 名为 unnamed-island-updater，环境变量 PROJECT_NAME 仍是被管理的 unnamed-island。
5. 如希望先只检查，设 `AUTO_UPDATE_ENABLED: 'false'`；确认日志正常后改回 `'true'` 并重新部署。模板默认启用，CHECK_INTERVAL_SECONDS 为 300，首次启动立即检查。
6. 启动后查看日志：`UP TO DATE` 表示已是最新；`UPDATED` 表示新 Web 已健康；`ROLLED BACK` 表示失败并已恢复旧版本。以后推送 main，等 Actions 成功及下一次检查即可，无需手改 image。

## 更新器的权限与边界

更新器连接 `/var/run/docker.sock`，这是 Docker 管理权限，**实际可控制整个 Docker / 主机，并非技术上只能访问小岛**。脚本将命令限定到指定 Compose project / web 服务，但不是 Docker 的强制权限隔离。只导入本项目已验证的固定镜像，不将 socket 或更新器暴露到公网。来源：[Docker Engine security](https://docs.docker.com/engine/security/)、[Protect daemon access](https://docs.docker.com/engine/security/protect-access/)。

更新器不开放端口，网络模式 none（拉镜像的网络访问由 Docker daemon 执行），根文件系统只读；只挂载目标 Web 目录、Docker socket 和独立 state 目录。state 中的恢复日志 / Compose 备份包含现有数据库密码等私密配置，文件权限 600，不要分享或上传 Git。替换 Compose 保留原拥有者，只改 web 的 image 行，其他内容按原样保留。

## 每次更新做什么

1. 要求现有 Web 是 healthy；校验保存的配置与实际容器的 image / 显式 environment 一致。GUI 修改了配置却还没部署时拒绝自动更新。
2. 在旧 Web 继续运行时先显式保留当前固定 digest 的本地镜像引用，再拉取 nas-stable 并解析新 digest，避免频道重新标记时丢失旧引用。已是同一镜像时不重启。
3. 比较当前 / 新镜像的 PostgreSQL schema 与 migration 文件内容摘要。不同则记录 `MANUAL MIGRATION REQUIRED`，保留旧 Web，等待人工备份 / 迁移 / 更新。它不自动运行 Prisma、不更新 PostgreSQL 容器。
4. 保存私密恢复日志和上一版 Compose，将原配置中唯一的 web.image 改成新 digest，使用 `compose up --no-deps --no-build --pull never --wait` 仅替换 web。原网络、账号、端口 / 挂载继续使用，UGREEN 项目路径仍是原绝对路径。
5. 最多等待 180 秒健康检查，失败则恢复旧 digest / Compose 并再次检查 healthy。坏 digest 持久阻止重试，避免每 5 分钟反复中断。网络下载失败不会停止旧 Web。
6. 若更新器进程中断，下一次启动读取 pending.json 并恢复旧 Web；如果用户同时手改了配置，会拒绝覆盖，要求人工处理。检查模式也会先处理已有 pending 回退日志，避免把尚未完成的事务当作正常状态。更新过程中请勿同时在绿联编辑 / 重新部署这个 Web 项目；只有更新器自身的文件锁，GUI 不遵守它。

更新会短暂中断 Web，不是零停机；升级后浏览器可刷新获得新页面。健康检查通过不保证全部玩法或数据语义兼容，自动回退也不撤销新版本已写入的业务数据。数据库结构摘要是保守的结构门槛，不是完整的数据兼容性证明；涉及数据含义变化仍需人工发布。现有备份安排继续保留。

## 暂停、固定版本和恢复

- 停止 unnamed-island-updater 项目即可暂停检查，不会停止小岛、数据库或 Tunnel。
- 需要固定版本：先停止更新器，再在 Web Compose 选 release 历史 digest 重新部署；不改数据库文件。
- 坏版本已回退时，优先提交修复，频道新 digest 会重新检查。确需重试同一 digest：在更新器容器终端执行 `python3 /app/updater.py --retry`，只清除失败阻止记录，不直接更新。
- 回退自身失败：保留 state/pending.json 与 state/compose.previous.yaml，先检查 Web 日志 / 数据库连通性；不要删除 state 强行跳过恢复。恢复日志包含密码，勿截图。
- 本工具不清理整个 Docker 的镜像 / 卷；旧镜像保留供回退。SSD 空间不足时，在绿联人工检查不用的镜像，不删除数据库目录或卷。

## 验证状态

本地 11 项更新器测试通过；[Actions 44170757949](https://github.com/northblue/unnamed-lsland/actions/runs/44170757949) 由 push 自动触发并成功，包含 99 项测试、三镜像构建和临时 Docker / PostgreSQL / registry 真实替换、同版不重启、坏版本健康失败回退、坏 digest 阻止和数据库容器不变检查。三镜像摘要 / linux/amd64 / 匿名拉取与 nas-stable 解析结果已实际核对，正式固定版本见配置包 release.json。

2026-11-18 用户已在 NAS 启用更新器，截图多次显示当前 Web 的 UP TO DATE，确认现场轮询正常。真实版本替换 / 健康失败回退、绿联项目刷新和掉电恢复仍需现场验证。首次安装仍应先使用 WEB-IMAGE.txt 的 Web，再导入独立更新器，不要只换旧 Web 为 nas-stable 标签；已经启用的实例不需每次重新导入。

官方命令依据：[Compose up](https://docs.docker.com/reference/cli/docker/compose/up/)、[Compose config](https://docs.docker.com/reference/cli/docker/compose/config/)、[GitHub workflow trigger](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)。
