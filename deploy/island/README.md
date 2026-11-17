> 自动更新：main 源码推送现自动验收并发布 nas-stable，NAS 还需一次性导入独立更新器；见 [操作手册](../../doc/nas-auto-update.md)。

> 公网共享密码版本：见 [部署说明](../../doc/nas-public-access.md) 和 `compose.public.ugreen.yaml`；实际新镜像状态以 release.json / progress.md 为准。

# Unnamed Island NAS container templates

操作步骤与验证状态见 [小岛独立容器与镜像发布](../../doc/nas-island-container.md)。

- compose.ugreen.yaml：独立 Web 项目，外接既有数据库网络；已固定发布镜像摘要，只需在 NAS 私下填写 DATABASE_URL。
- compose.tools.ugreen.yaml：可选维护项目，默认只看迁移 status 并退出；deploy 必须单独选择。

Web / tools 镜像已发布并核对匿名拉取、摘要和 linux/amd64，版本见 release.json；本轮未在 NAS 启动。基础模板没有端口映射，未设置 APP_ORIGIN 时仍仅 localhost。新增 compose.lan.ugreen.yaml 为 192.168.4.82:3080 局域网版本；先导入旧岛，再更新现有 Web 项目，保留已填写的 DATABASE_URL。局域网家庭共享模式不含独立登录，不配置 Tunnel / 公网入口。详见局域网说明。

局域网操作见 [nas-lan-access.md](../../doc/nas-lan-access.md)；旧版摘要保留在 releases/，不要在已有岛屿时重复导入迁移包。
