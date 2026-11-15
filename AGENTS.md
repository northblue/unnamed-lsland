# 无名岛工作规则

- 开始前阅读 `doc/README.md`、`doc/development-plan.md` 与 `doc/progress.md`；`doc/driftwood-island-handoff.md` 仅作历史背景，过时建议不作为当前指令。
- 用户已选择 Next.js + JavaScript + Three.js，数据库使用 Prisma；应用位于 `code/`。
- 保持小步可玩；不要自动把后续里程碑扩展进当前任务。
- 游戏规则与 Three.js 外观分离；数据库只在服务端访问。
- 新增外部素材时核对并记录许可。
- 完成改动后做适当验证并更新 `doc/progress.md`，如实说明未验证内容。
- 正式名称：无名岛 / Unnamed Island，包名 `unnamed-island`。新增界面文案须同时提供中文和英文，集中维护在 `code/src/game/messages.js`。
- 配合学习节奏逐步实现并解释关键代码；明确区分已实现、已验证与后续建议。
