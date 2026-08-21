// 将报时段帧（alarmFrame..alarmLoopFrame.r）打包为单个 H.264 mp4，
// 运行时报时状态改用视频播放，减小包体积与请求数。依赖本机 ffmpeg。
import { frameNumbers, alarmFrame, alarmLoopFrame } from "@/config";
import { $ } from "bun";
import { writeFileSync } from "fs";
import os from "os";
import path from "path";

const endFrame = alarmLoopFrame.r;
const fps = 30;

// 与播放器一致的帧复用逻辑：省略帧复用上一帧图片
const sequence: number[] = [];
let current = alarmFrame;
let idx = frameNumbers.indexOf(alarmFrame);
for (let i = alarmFrame; i <= endFrame; i++) {
  if (idx < frameNumbers.length && frameNumbers[idx] === i) {
    current = i;
    idx++;
  }
  sequence.push(current);
}

const listPath = path.join(os.tmpdir(), "alarm-concat.txt");
const lines = sequence.map(
  (frame) =>
    `file '${path.resolve(`../assets/frames_compressed/${frame}.avif`)}'\nduration ${1 / fps}`,
);
writeFileSync(listPath, lines.join("\n") + "\n");

const loopStart = (alarmLoopFrame.l - alarmFrame) / fps;

await $`ffmpeg -y -hide_banner -loglevel error \
  -f concat -safe 0 -i ${listPath} \
  -r ${fps} -c:v libx264 -crf 20 -preset veryslow -pix_fmt yuv420p \
  -force_key_frames ${`0,${loopStart}`} \
  -movflags +faststart -an ../assets/alarm.mp4`;

const { size } = await Bun.file("../assets/alarm.mp4").stat();
console.log(
  `✅ assets/alarm.mp4: ${(size / 1024).toFixed(1)} KB, ${sequence.length} frames @ ${fps}fps, loopStart=${loopStart.toFixed(4)}s`,
);
