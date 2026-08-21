import { frameNumbers, tiktokLoopFrame } from "@/config";

// 仅乒乓循环段保留为图片帧；报时段已打包为 assets/alarm.mp4（见 build-alarm-video.ts）
const pingpongFrames = frameNumbers.filter((f) => f <= tiktokLoopFrame.r);

const lines = [];

for (const frame of pingpongFrames) {
  lines.push(
    `export { default as f${frame} } from "../../assets/frames_compressed/${frame}.avif";`,
  );
}

const code = lines.join("\n");

Bun.write("src/frames.ts", `${code}\n`);
