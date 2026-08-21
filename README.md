# Usagi Clock

chiikawa（兔）动画时钟 / 闹钟，已适配 B站 Toy 平台。

- Author: HK-SHAO
- Assets Copyright: chiikawa offical

## 功能

- 帧动画时钟、整点报时、时间段闹钟
- 全视图播放：全屏、iframe 或任意容器内相对位置保持准确
- Toy 能力：云存储同步设置、关注作者解锁时间段闹钟、陪伴打卡榜

## 开发

```bash
cd app
bun i
bun dev        # 开发
bun run build  # 产出 dist，全部相对路径，可直接发布到 Toy
```

发布 / 更新到 Toy 平台使用 `toy` CLI，流程见 `.agents/skills/toy`。
