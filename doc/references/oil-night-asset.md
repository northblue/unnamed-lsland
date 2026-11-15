# 夜空油画贴图来源（v1 历史）

> 当前已使用保留油画笔触、移除巨大金色星团的 v2。见 [细星空与人物记录](fine-stars-explorer.md)。

日期：2026-11-08。生成方式：内置 image_gen 工具（非 CLI）。用途：无名岛游戏夜间背景。

项目资产：[oil-night-v1.png](../../code/public/textures/oil-night-v1.png)。这是一张按项目需求生成的 AI 位图，不是原画扫描、网络下载或第三方素材包；未引用第三方纹理。遵循生成服务适用条款，不将该文件声明为第三方授权或公有领域素材。首次引入位图纹理后，旧文档中的“全部外观由程序生成”不再适用于夜空。

贴图不含月亮；游戏继续叠加随时间移动的月亮。夜间渐入，白天不显示；按视口比例裁切，载入失败保留程序天空，卸载时清理纹理。

## 完整生成提示词

Use case: stylized-concept. Asset type: wide 16:9 background texture for a Three.js island game's night sky. Primary request: an unmistakably traditional impasto oil painting of a starry night sky inspired by Vincent van Gogh's Starry Night. Entire frame is SKY ONLY: deep ultramarine and cobalt blue, sweeping organic curling clouds with rich curved individual brush strokes, thick raised paint ridges catching soft studio light, visible coarse linen canvas beneath paint. A few glowing ochre and cream stars painted with irregular short strokes, concentrated in upper half. Lower third calmer dark blue brushwork. No moon (the game adds its moving moon), no land, no horizon, no trees, no island, no objects, no text, no frame or watermark. Must look like a close photograph of REAL tactile oil paint on canvas, NOT a digital spiral pattern, NOT smooth airbrushing, NOT neon, NOT a vector illustration. Rich painterly color mixing and irregular bristle marks throughout. Wide composition.
