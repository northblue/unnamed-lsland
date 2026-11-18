# 猫狗模型、比例与许可

2026-11-18。根据用户反馈，用完整皮肤、绘制纹理和骨骼动画替换初版球体拼接造型。不是照片级扫描：仍然使用适合微缩岛的风格化猫和柴犬造型。

## 来源与逐项许可

- 官方来源：[Mesh2Motion / mesh2motion-app](https://github.com/Mesh2Motion/mesh2motion-app)，固定提交 `bcb014ea25e44f76b3add78463f72d1faec16418`。原始下载与逐文件 SHA-256 见 `code/assets/source/mesh2motion-pets/SOURCE.json`，保留原 GLB、预览图、许可文件和未修改的 RigConfig.ts 证据。
- 狗模型 `static/assets/fox/variations/dog.glb` 与六段动画采用 Mesh2Motion / Scott Petrovic 的 CC0 1.0；原文件许可随源文件与运行素材保留。
- **猫模型是例外**：该提交的 [RigConfig.ts](https://github.com/Mesh2Motion/mesh2motion-app/blob/bcb014ea25e44f76b3add78463f72d1faec16418/src/lib/RigConfig.ts#L126) 将 cat 命名为 Carrot，署名 David Revoy，标记 CC-BY；不能仅根据仓库总体 CC0 将此猫模型也记为 CC0。角色来自 [Pepper&Carrot](https://www.peppercarrot.com/)，作者的[署名说明](https://www.peppercarrot.com/en/documentation/120_License_best_practices.html)采用 CC BY 4.0。上游配置仅写 CC-BY，项目 NOTICE 如实区分该标记与原角色许可链接。
- 完整来源、许可链接和改动说明放在游戏自带 `code/public/models/mesh2motion-pets/NOTICE.txt`；视角面板提供中英文“模型来源与许可”入口。源文件中附带的官方配置代码按其 MIT 许可保留。

## 转换与表现

在 code/ 运行 `node scripts/convert-pets.mjs`，仅使用现有 Three.js 依赖，将 Idle / Walk / Run / Play Bow / Sit / Sleep 六段动画合入每个模型；解开动画的 Meshopt 压缩，按局部静止姿态差值适配各模型骨骼，保留原 PNG 绘制纹理。运行时只读项目本地 GLB，不请求模型网站。

| 模型 | 原网格三角形 | 合并后 GLB | 游戏最高约 |
| --- | ---: | ---: | ---: |
| Carrot 猫 | 1,710 | 837,180 字节 | 0.62 |
| 狗 | 2,616 | 953,660 字节 | 0.78 |

人物约 1.7 高，向日葵缩为初版 52%，最高约 3.5，低于主要椰子树；螃蟹场景缩放为 0.45。每只猫狗独立克隆骨架和 AnimationMixer，共用源几何与纹理，轻微材质色调区分同类个体。游荡走路、追逐跑动、停下玩耍时做 Play Bow、休息时过渡到 Sleep；减少动态效果时采用静态 Idle。加载失败保留缩小后的程序造型，场景销毁后迟到的素材会释放。

本地真实 GLB 测试覆盖六动画 / 内嵌纹理存在、克隆骨骼独立、动作时包围盒与比例、减少动态效果和迟到释放。浏览器已看到猫狗纹理和动作、调整后的体型与螃蟹比例，控制台未出现模型 / shader 错误；截图见 [新模型与浅滩](../screenshots/landmarks/pets-beach-v2.png)。未完成真实手机 GPU / Safari / 长时帧率和内存量化验收。
