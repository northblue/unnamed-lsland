# Quaternius Fish1 试用素材（历史）

> 2026-11-11：已扩展为四类鱼和鸟类模型。下文保留首次试用记录，运行 GLB 已重新导出，当前文件校验、来源及行为以 [动物模型升级](animal-models.md) 为准。

引入日期：2026-11-10。作者：Quaternius。模型包：Animated Fish Pack（2018）。

## 来源与许可

- [作者官网](https://quaternius.com/packs/animatedfish.html)标注 CC0，附作者的 Google Drive 下载目录；本轮该下载源提示配额已满。
- 实际下载来自[作者在 OpenGameArt 的发布页](https://opengameart.org/content/animated-fish)，发布者 quaternius，同样标注 CC0。
- [原始 ZIP](https://opengameart.org/sites/default/files/Animated%20Fish%20Pack%20by%20%40Quaternius.zip)，只提取其中 Fish1.fbx 和 License.txt。
- 包内许可原文保存在 [License.txt](../../code/public/models/quaternius-fish/License.txt)，明确 CC0 1.0 Universal，适用条款见 [CC0](https://creativecommons.org/publicdomain/zero/1.0/)。虽然无需署名，项目保留作者来源和许可文本。

## 项目文件与改动

- 原 FBX：[Fish1.fbx](../../code/assets/source/quaternius-fish/Fish1.fbx)，未经修改，98,156 字节。
- 运行资产：[Fish1.glb](../../code/public/models/quaternius-fish/Fish1.glb)，137,280 字节，约 134 KiB。只包含一种鱼，其他动物未引入。
- [转换脚本](../../code/scripts/convert-fish.mjs)：在 code/ 执行 `node scripts/convert-fish.mjs`，使用项目自带 Three.js FBXLoader / GLTFExporter。保留作者三种纯色材质及一段 Armature|Swim 骨骼动画（约 1.29 秒）；材质转为 MeshStandardMaterial、roughness=0.65。没有图片纹理或外部 CDN 依赖。
- fishModel.js 运行时将长度归一至 1.1 单位，原 +Z 朝向转为游戏 +X；每条鱼独立克隆骨骼与 AnimationMixer，共享几何和材质。海洋边界裁切沿用原实现，未修改源骨骼动画。
- 海中仅 coral 类的 8 条鱼替换外观；保持原 ID、颜色分类、路线、深度、钓获和刷新鱼群行为。鱼池中的珊瑚小鱼暂用原池鱼模型，其他鱼 / 鲸鱼 / 海豚 / 章鱼和人物不变。
- 加载失败保持程序鱼；场景卸载后迟到的加载结果会清理，实例及材质 / 几何随场景释放。
- `/fish-preview` 为双语近距离试用页，可旋转缩放，切换新模型与原程序鱼造型作对照，不读取或写入存档。

## 校验值（SHA-256）

- Fish1.fbx：`1adea1cca2f02f351cf524b60d2448502e3acb3ef2965f74a21c45a5dfce77e3`
- Fish1.glb：`315f998fb0ee8500b122dfd0ad6378bfbee007eaa5d2e15fa9dfb7782b33ac81`
