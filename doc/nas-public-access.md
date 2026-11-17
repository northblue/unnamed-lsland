# 共享密码与 Cloudflare Tunnel

更新：2026-11-17。公网域名按用户选择采用 `https://unnamed-island.northblue.cc`。本页固定密码由小岛应用验证，Cloudflare Tunnel 负责转发流量；不是 Cloudflare Access 邮箱验证码登录。

## 目前状态

NAS 已完成旧岛导入 / 校验，LAN 首页、health、存档 200。共享密码代码、本地单元测试和生产构建已通过，新镜像已通过 [Actions 43951191099](https://github.com/northblue/unnamed-lsland/actions/runs/43951191099) 验收 / 发布，摘要、linux/amd64 和匿名拉取已核对；详见 progress.md 和 deploy/island/release.json。尚未替用户改 NAS 配置或创建域名路由。先部署支持认证的新镜像并确认 LAN 登录，再添加公网路由。

## 密码在哪里

Mac 私密文件：`deploy/island/.env.access.local`。可在编辑器打开；Finder 中隐藏文件可用 Command+Shift+. 显示。文件权限 600，Git 和配置 ZIP 不收录。

- `ISLAND_SHARED_PASSWORD`：家人输入的共享密码，可自行设为至少 12、最多 256 字符，不要换行。脚本默认生成随机 24 字符密码。
- `ISLAND_SESSION_SECRET`：签名密钥，至少 32 字符，脚本生成 64 字符十六进制值，不要分享给玩家。
- `PUBLIC_ORIGIN=https://unnamed-island.northblue.cc`。
- `APP_ORIGIN=http://192.168.4.82:3080`：继续保留 LAN，不要改成公网域名。

`cd code` 后 `npm run access:prepare` 可生成该文件；已存在则拒绝覆盖。文件放在 deploy 下避免 Next 自动加载成开发环境。没有把实际密码写进代码或公开配置。不要把含密钥 / DATABASE_URL 的截图发到聊天或上传仓库。

## 在绿联更新现有 Web 项目

1. 在 PostgreSQL 容器终端执行既有备份：`sh /backups/backup-in-container.sh`。本次不改表，不重导旧存档。
2. Docker → 项目 → `unnamed-island` → Compose 配置。使用 [密码版模板](../deploy/island/compose.public.ugreen.yaml) 核对差异，更新 `image` 为已发布新 digest，保留当前私密 DATABASE_URL、网络和端口。
3. 在 `web.environment` 中加入上述四项。直接在 Compose 内填写时用单引号包住字符串；生成值是字母数字 / - / _ 或十六进制，不需数据库 URL 编码。若自定义密码含单引号，YAML 中用两个连续单引号表示一个；含 `$` 时 Compose 用 `$$` 表示原始一个 `$`。不要修改数据库密码。
4. 点重新部署。维持 `192.168.4.82:3080:3000`；无需新建 Web 项目、tools 项目或数据库容器。
5. 打开 `http://192.168.4.82:3080`，应先看到登录页。输入共享密码，核对原岛、材料、鱼池，做一次操作等显示已保存，再刷新验证。用无痕窗口确认没有密码不能进入，存档 `/api/island` 返回 401。
6. Web 容器终端可运行以下不输出密钥的健康检查，预期 200。局域网未登录访问 health 返回 401 是预期行为。

```sh
node -e "fetch('http://127.0.0.1:3000/api/health').then(async r=>console.log(r.status,await r.text()))"
```

设置 PUBLIC_ORIGIN 后如密码 / 密钥为空或过短，受保护入口返回 503；此时先补齐配置重新部署。不要删掉认证配置后保持公网路由开启。

## 复用现有 northblue-nas Tunnel

Cloudflare 当前官方流程：Networking → Tunnels → `northblue-nas` → Routes → Add route → Published application。按 [官方指南](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/#2a-publish-an-application) 填写：

| 字段 | 值 |
| --- | --- |
| Subdomain | `unnamed-island` |
| Domain | `northblue.cc` |
| Path | 留空 |
| Service 协议 | HTTP |
| Service URL / 地址 | `192.168.4.82:3080`（合起来为 `http://192.168.4.82:3080`） |
| HTTP Host Header 覆盖 | 留空，保留原始公网 Host |

只加这条路由，保留 AnythingLLM / Open WebUI。cloudflared 在其他容器中，所以不要把服务地址填成 localhost。无需暴露 PostgreSQL 5432，也无需路由器端口转发。NAS DHCP 地址将来变化时，端口绑定、APP_ORIGIN 和 Tunnel 地址需要一起更新；可在路由器预留此 IP。

访问公网 HTTPS，用无痕窗口验证先登录，错误密码被拒绝，正确密码能看到原岛和保存；退出后刷新回到登录页。公网与 LAN 使用独立会话 Cookie，第一次各登录一次。保持现有缓存默认设置，不为 `/api/*`、`/login` 或整站添加 Cache Everything；应用受保护响应使用 private/no-store。

## 会话、限流与回滚

会话 7 天，不滑动续期。HTTPS Cookie 使用 HttpOnly / Secure / SameSite=Lax，绑定域名；LAN HTTP 使用独立 Cookie，仅在可信家庭网络使用。密码或签名密钥改变后旧会话失效，重启不改密钥则保持登录。密码持有者都能管理同一岛屿，没有独立账号、管理员分级或个人岛。

“保存并退出登录”先保存再清除当前浏览器 Cookie；清 Cookie 不是服务器撤销所有已复制的无状态令牌。需整体失效时轮换密码 / 密钥。会话过期后游戏保留页面，点“重新登录”在新标签页登录，返回原页重试保存，避免刷新丢掉未保存进度。

登录每进程每分钟最多 20 次（含成功 / 失败），超限返回 429 / Retry-After，进程重启清空。这适用于当前单 Node 家庭试玩，不是分布式限流或个人账户锁定。

如上线失败，先移除 / 停用本次 Tunnel 公网路由，再检查 NAS 日志和配置；需要恢复旧无密码镜像时，必须先关闭公网入口，保留数据库和备份。不降级数据库、不重导覆盖当前存档。
