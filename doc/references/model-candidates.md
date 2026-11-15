# 模型与材质候选及试用

核对日期：2026-11-10。以下是调研记录；现已试用 Quaternius Fish1 一种鱼，其余条目尚未下载、转制或接入游戏。

| 来源 | 可帮助的内容 | 官方页标注 / 接入限制 |
| --- | --- | --- |
| [Google Three-Live](https://github.com/google/three-live) | Three.js 场景编译、显示、跨平台 / XR，非现成动物模型库 | Apache-2.0 代码；本轮读取 main 完整文件树 785 路径（未截断），未找到目标鱼 / 鲸鱼 / 海豚 / 人物模型文件。不能推断所有未来版本都没有 |
| [Quaternius Animated Fish](https://quaternius.com/packs/animatedfish.html) | 7 类水生动物，附动画 | 页面 CC0；FBX / OBJ / Blend，需实际下载核对种类、包内许可并转 GLB；造型偏风格化 |
| [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) | 骨骼人物、可换发型，适合替代几何小人 | 页面 CC0，提供 glTF；需另核对所选免费 / Source 版本内容与动作适配 |
| [Quaternius Ultimate Animated Animals](https://quaternius.com/packs/ultimateanimatedanimals.html) | 12 种动物，各有多种动作 | 页面 CC0，glTF / FBX / OBJ / Blend；未逐一核对物种，不承诺包含海鸟或全部海洋访客 |
| [Quaternius Ultimate Stylized Nature](https://quaternius.com/packs/ultimatestylizednature.html) | 60+ 自然资产，配无缝纹理和法线，适合植被 / 岩石细节 | 页面 CC0，提供 glTF；推荐与微缩海岛统一材质后逐项试换 |
| [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) | 树、岩石、植被，330 个文件 | 页面 CC0，适合低多边形景观；尚未下载核对文件格式 |
| [Khronos BarramundiFish](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/BarramundiFish) | 带细节的鱼模型，可做单鱼对比试验 | 官方 README 标注 Microsoft、CC0，提供 GLB；动画与实际渲染外观未在本项目验证，不代表包含游泳动画 |
| [Poly Haven](https://polyhaven.com/license) | 自然材质、HDRI、3D 模型，为石头 / 沙地 / 木材和反光补细节 | 官方资产政策 CC0；属于资产来源，不能把站点所有代码、商标或其他内容也当成 CC0；选择资产后再核对具体页面与性能 |

建议先试换一种鱼、一种人物和一组树 / 岩石，统一尺度、颜色、光照与动画速度，再扩大替换。已有鱼的编号、路线、钓获规则保持，加载失败保留程序模型。当前只替换珊瑚类海鱼群，详情见 [Fish1 素材记录](quaternius-fish-asset.md)；其他动物、人物和鱼池仍使用程序模型。
