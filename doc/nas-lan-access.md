# 小岛局域网访问

更新：2026-11-16。用户网络截图确认 NAS LAN1 的 IPv4 为 192.168.4.82（DHCP）。目标地址为 `http://192.168.4.82:3080`，只供同一局域网的家庭共享岛试玩，不需要 Cloudflare Tunnel / 公网域名。

旧配置没有 ports，所以浏览器曾显示 ERR_CONNECTION_REFUSED；旧镜像还只允许 localhost 存档 API。需要同时升级到支持 APP_ORIGIN 的新镜像、配置 Origin 和发布端口，不能只改其中一项。[Actions 43722484386](https://github.com/northblue/unnamed-lsland/actions/runs/43722484386) 对提交 440addd 验收并发布成功；当前 [release.json](../deploy/island/release.json) 和 [局域网 Compose](../deploy/island/compose.lan.ugreen.yaml) 已固定新镜像摘要，旧镜像不支持该配置。

## 应用行为

APP_ORIGIN 为空时仍仅允许 localhost / 127.0.0.1 / [::1]。明确设置 `APP_ORIGIN=http://192.168.4.82:3080` 后，仅额外允许这个 Host；PUT 保存必须携带完全一致的 Origin（含协议和端口）。不信任 X-Forwarded-Host / Proto，保持 revision 冲突和数据校验。APP_ORIGIN 仅接受私有 LAN IP 或 loopback 的 http(s) origin，不接受公网域名 / IP、URL 路径或内嵌凭据；配置非法时拒绝访问。

这是局域网共享模式，没有独立用户 / 管理员登录；能访问该入口的家庭网络设备可以使用管理面板。家庭成员共用一座岛，不生成每人独立存档；多页面旧 revision 的保存会被拒绝。公网域名 / Access / JWT 是后续独立步骤，当前配置不接入公网。

## UGREEN 更新顺序

1. 先停止 Web 并完成 [旧岛迁移与只读核对](island-save-migration.md)。未迁移时不要先打开浏览器试玩，GET 会初始化默认空岛，之后导入会拒绝覆盖。
2. 只修改现有 unnamed-island 项目的 Compose，不创建第二个 Web 项目。保留已经填写的 DATABASE_URL，不要用空模板覆盖真实值。
3. 将 Web image 更新为 release.json 的新摘要（必须是通过局域网验收的版本）；在 environment 加入 APP_ORIGIN，并添加与 environment 同级的 ports：

```yaml
    environment:
      # 其他已配置环境变量保持原值，包括私密 DATABASE_URL。
      APP_ORIGIN: 'http://192.168.4.82:3080'
    ports:
      - '192.168.4.82:3080:3000'
```

该端口只绑定 NAS 的这个局域网 IPv4，容器内部仍监听 3000。不发布 PostgreSQL 5432，不动 nas-postgres / AnythingLLM / Open WebUI。3080 如果已被占用，先停止这次更新并换另一个空闲端口，APP_ORIGIN 和访问地址须同步调整。

4. 重新部署 Web，确认容器运行及 health 200；在与 NAS 同一局域网的 Mac 浏览器打开 `http://192.168.4.82:3080`。加载应显示迁移的岛名 / 木石 / 鱼池数量，保存成功后刷新核对。之后再做 Web 重启 / 页面刷新和新备份验证。

NAS 当前用 DHCP；地址以后变化时，APP_ORIGIN、ports 的绑定 IP 和浏览器地址都要同步。这里没有要求修改 NAS 网络设置。

## 验证边界

本地测试覆盖显式 LAN Host、端口 / 协议 / Origin 错配、缺失 Origin、伪造 forwarded 头，以及非法 / 公网 APP_ORIGIN。云端镜像工作流会用原始 HTTP 发送真实 Host，测试局域网语义的 GET / PUT 和旧版本冲突；这些请求只连 CI localhost，192.168.4.82 是 HTTP 头测试值，不连接用户 NAS。

81 项测试及上述原始 HTTP LAN 保存 / 拒绝 / 冲突检查已通过，镜像发布成功，摘要 / linux/amd64 / 匿名拉取也已实际核对。实际 NAS 页面打开、保存 / 刷新以及多设备表现仍需要用户现场验收，助手未修改 NAS。错误提示已集中更新中文 / English。
