> 2026-11-18：发布流程现支持 main 源码 push 自动构建 / 验收 / 发布，NAS 一次性配置更新器后定时更新；见 [自动发布与更新](nas-auto-update.md)。下方早期 GitHub 手动操作部分仅作历史参考。

# 小岛独立容器与镜像发布

更新：2026-11-18。用户指定代码仓库 https://github.com/northblue/unnamed-lsland；仓库名保留 lsland，应用正式名仍是 unnamed-island。部署文件准备完成后，已按用户授权初始化 Git main 并将首次提交 42537de 推送到该仓库；推送前远端没有分支 / 标签。现有仓库根包含 code/、doc/、deploy/ 和 .github/，与 workflow 路径一致。已完成仅验证 Actions，修复容器 Host 校验及测试请求后，第三次运行 43716023910 全部通过（提交 22ccece）；已由 Actions 43716616878 发布 Web / tools 镜像，摘要与 linux/amd64 架构及匿名拉取已核对；用户随后已在 NAS 启动 Web / tools，完成基线迁移且 health 200；旧岛导入与独立核对、局域网首页 / health / 存档 HTTP 200 已完成。共享密码与公网发布按 [最新入口说明](nas-public-access.md) 操作。

## 当前已发布版本

- 来源提交：`e622ac9d741ea2e28a869d2bc3a2f62a8ce07410`（自动构建、数据库兼容标记、手机专注模式、共享密码）。
- [Actions 44170757949](https://github.com/northblue/unnamed-lsland/actions/runs/44170757949) push 自动触发 / success：99 项测试、数据库 / 保存 / LAN / 认证 / 重启和缺配置拒绝访问验收通过，Web / tools / updater 上传成功，nas-stable 已核对。
- [release.json](../deploy/island/release.json) 记录不可变镜像摘要和完整 SHA 标签；实际 registry manifest 摘要、linux/amd64 与匿名拉取均已核对。四份 Compose 已更新固定摘要，真实密码 / DATABASE_URL 保持为空。
- [绿联配置包](../deploy/unnamed-island-nas.zip) 包含基础 / LAN / 共享密码 / tools 四份模板和说明。密码版用 compose.public.ugreen.yaml，更新现有 Web，保留其 DATABASE_URL，按 [公网入口说明](nas-public-access.md) 填写私密密码 / 密钥。
- 上一 LAN 版本 440addd 已在 NAS 运行、旧岛导入和 HTTP 读取已验证；共享密码基线 5b969c1 已部署，公网未登录跳转已实测；本次 bootstrap Web / 自动更新器尚未在 NAS 安装。历史版本保留在 deploy/island/releases/。

## 文件与边界

- code/Dockerfile：Linux 构建依赖，生成客户端、校验 schema、测试、Next standalone 打包；web 阶段使用非 root 用户，复制 public 和 .next/static。无需构建时数据库密码。默认 Node 24 Debian bookworm slim 标签，大版本固定但未锁 digest；首次成功构建后应记录镜像 digest。
- code/.dockerignore：排除 Mac node_modules、生成文件、本地 D1、.env / .dev.vars、原始素材 assets 与日志；运行模型和许可在 public，继续随镜像提供。
- tools 阶段：独立维护镜像，包含 Prisma CLI / PostgreSQL 基线，用于显式 status / deploy。Web 镜像不自带自动建表启动步骤，也不复制原 Mac 存档。
- deploy/island/compose.ugreen.yaml：新建 unnamed-island 项目，只包含 web，复用 external nas-postgres-data；独立应用网络由 Compose 创建，不改已有 AI 项目、数据库或 cloudflared。
- deploy/island/compose.tools.ugreen.yaml：可选临时维护项目，默认只查询迁移状态并退出；尚未部署。
- .github/workflows/island-image.yml：放在整个项目仓库根目录，构建上下文为 code/。如果远端仅有应用根目录，需要先调整目录对应关系，不能照搬路径启动。

## 首次手动发布步骤（历史，现用自动发布）

1. 先核对仓库目录是否为 code/、doc/、deploy/；提交本轮代码和 workflow。不要上传 .env、.wrangler、node_modules 或 NAS 数据 / 密码。
2. 在 Actions 允许 workflow 运行；打开 “Build and verify island image” → Run workflow。第一次保留 publish=false，仅构建验收。
3. CI 构建 linux/amd64 的 Web / tools 镜像，启动一次性 PostgreSQL 17、运行基线迁移；验证页面 / JS / GLB 资源、health、存档读写 / 校验 / Origin 拒绝 / 并发 revision、重启后存档保留。测试库用固定的 CI 测试密码，不是 NAS 密码，任务结束移除容器与网络。
4. 首次验证通过后，再 Run workflow 勾选 publish=true，使用 GITHUB_TOKEN 发布到 GHCR，权限为 contents:read / packages:write；不需要给 CI NAS 密码。私有仓库或组织策略可能需允许包写入 / Actions。
5. 镜像为 ghcr.io/northblue/unnamed-island:sha-完整提交SHA，维护镜像同标签加 -tools。两个镜像均通过验证后发布；不用 latest 自动更新。记录镜像 digest，NAS 可改用 digest 固定内容。这是早期手动流程；当前 main 源码推送会自动触发验收和发布，NAS 安装独立更新器后才会自动更新。

私有 GHCR 镜像需要在绿联配置拉取凭据（具 read:packages 的专用令牌，必要时组织授权）；不把令牌写进 Compose、发送到聊天或提交仓库。若包公开，镜像内代码也可被任何人读取，需由用户选择可见性。数据库密码从不进入构建。

## 绿联应用项目（现在先不要启动）

准备 /volume2/docker/unnamed-island 作为项目配置目录即可，应用自身暂无上传文件，不挂载 PostgreSQL data 或 Mac 源码。导入 compose.ugreen.yaml 时先取消立即运行：

1. 当前 image 已固定发布成功的 digest；首次无需替换。以后更新使用新版本已验证的 digest，不用 latest。
2. 在 NAS 私下填 DATABASE_URL：postgresql://island_app:URL编码后的密码@nas-postgres:5432/unnamed_island。这里仅使用 island_app，不是管理员账号。
3. 核实 nas-postgres-data 已存在；不要新建另一个 PostgreSQL 服务。检查镜像拉取授权。
4. **基础模板未映射宿主端口，APP_ORIGIN 未设置时仍仅 localhost；局域网模板另行映射 192.168.4.82:3080 并严格允许该 Origin，没有 Tunnel 路由。** 健康检查只证明数据库表可查询，不代表存档已迁移、认证完成或公网可用。缺 URL / 服务不可达 / 尚未建表时健康接口返回 503。

维护项目可先以 status 命令运行并看日志，完成后退出属于正常行为。确认数据库备份、目标库与导入计划后，才将 command 最后一项 status 改为 deploy，显式运行迁移；不是本轮授权自动执行的 NAS 动作。迁移工具不导入旧岛。不要反复让 Web 启动过程自动执行建表。

之后仍需：用户执行已验证的逻辑存档导入与真机核对、局域网实际页面 / 保存验收；公网家庭 Access 与源站防绕过是后续独立步骤，再核对 cloudflared 的入口网络并配置路由。当前不直接把 cloudflared 加入数据库网络，不在 NAS 或路由器公开 PostgreSQL。

## 验证记录

本机没有 Docker；第三次 [GitHub Actions 43716023910](https://github.com/northblue/unnamed-lsland/actions/runs/43716023910) 已全部通过，验收提交 22ccece：Linux Web / tools 镜像构建、75 项测试、临时 PostgreSQL 迁移、health、页面 / JS / 鱼鸟 GLB、存档读写 / 校验 / Origin / revision 并发及 Web 重启后的状态比对。该验收运行 publish=false；随后 publish=true 的 43716616878 重验并发布成功。已在 Mac 生成 standalone，复制到项目之外的临时目录并补 public / .next/static，验证 HTML、浏览器 JS、鱼 / 鸟 GLB 可访问；PostgreSQL 指向本机关闭端口时，API / health 返回 503，日志是数据库不可达而不是缺模块。临时服务已停止。

本地检查不代替 Linux 验收；上述 Linux / PostgreSQL 步骤已由 CI 补充通过。早期两次失败分别来自容器监听地址与 HTTP Host 的差异、Node fetch 移除测试指定 Host；修复和原始 HTTP 安全检查均已重验。发布运行 43716616878 已对提交 9c7f0c5 重新验收并上传两个镜像。当前还未验证 NAS 受限角色下的应用迁移、真实存档 / 备份恢复、生产资源限制和家庭访问保护。Compose / workflow 已做 YAML 与结构检查，未在 UGREEN 导入本轮配置。

实现依据：[Next standalone 输出](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)、[Docker GitHub Actions](https://docs.docker.com/build/ci/github-actions/)、[GitHub GHCR 发布](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)。
