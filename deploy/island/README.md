# Unnamed Island NAS container templates

操作步骤与验证状态见 [小岛独立容器与镜像发布](../../doc/nas-island-container.md)。

- compose.ugreen.yaml：独立 Web 项目，外接既有数据库网络；已固定发布镜像摘要，只需在 NAS 私下填写 DATABASE_URL。
- compose.tools.ugreen.yaml：可选维护项目，默认只看迁移 status 并退出；deploy 必须单独选择。

Web / tools 镜像已发布并核对匿名拉取、摘要和 linux/amd64，版本见 release.json；本轮未在 NAS 启动。当前没有公开端口或 Tunnel，API 仍仅允许 localhost。存档导入和家庭访问保护完成后再配置真实入口。
