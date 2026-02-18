/**
 * 状态机的逻辑：
 * 1. 整点报时，即分秒为0时，刚好播放到alarmFrame（同时播放音频ulaAlarm）
 * 2. alarmFrame按顺序播放到alarmLoopFrame（音频ulaAlarmLoop），并在alarmLoopFrame之间循环播放（默认持续1分钟，可配置）
 * 2. 其他状态下在tiktokLoopFrame之间“乒乓”循环播放，同时播放ulaTiktok（2秒的音频，精准每两秒播放一次）
 */

import type { CSSProperties } from "react";

/**
 * 已有的图片的帧序号（省略的帧与上一帧完全一致，因此可复用上一张图片）
 */
export const frameNumbers = [
  541, 545, 548, 552, 556, 560, 563, 567, 571, 575, 578, 582, 597, 601, 605,
  608, 646, 678, 688, 690, 691, 692, 693, 695, 696, 697, 698, 700, 701, 702,
  703, 705, 706, 707, 708, 710, 711, 712, 713, 715, 716, 717, 718, 720, 721,
  722, 723, 725, 726, 727, 728, 730, 731, 732, 733, 735, 736, 737, 738, 740,
  741, 742, 743, 745, 746, 747, 748, 750, 751, 752, 753, 755, 756, 757, 758,
  760, 761, 762, 763, 765, 766, 767, 768, 770, 771, 772, 773, 775, 776, 777,
  778, 780, 781, 782, 783, 785, 786, 787, 788,
];

/**
 * 视频帧率
 */
export const frameRate = 29.97;

/**
 * Tiktok 状态时“乒乓”播放的开始和结束帧
 */
export const tiktokLoopFrame = { l: 552, r: 582 };

/**
 * 报警开始的关键帧
 */
export const alarmFrame = 678;

/**
 * 持续发出铃声时，从左到右循环播放的帧
 */
export const alarmLoopFrame = { l: 743, r: 788 };

/**
 * 时钟容器每一帧的样式，位置用相对于图片左上角的相对位置（百分比）
 * 支持属性：
 * - left: 水平位置（百分比）
 * - top: 垂直位置（百分比）
 * - transform: CSS transform（支持translate, rotate, scale等）
 */
export const clockStylesMapping: Record<number, CSSProperties> = {
  552: {
    left: "59.61748633879782%",
    top: "49.61290322580645%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  556: {
    left: "60.4919650273224%",
    top: "49.3547%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  560: {
    left: "59.071233879781424%",
    top: "49.3547%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  563: {
    left: "57.32255464480874%",
    top: "49.35473225806452%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  567: {
    left: "55.79250655737705%",
    top: "49.2257%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  571: {
    left: "54.80886885245902%",
    top: "49.2257%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  575: {
    left: "53.60668306010929%",
    top: "49.2257%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  578: {
    left: "54.48101693989071%",
    top: "49.2257%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  678: {
    left: "50.10943879781421%",
    top: "50.7741%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  688: {
    left: "50.54655846994535%",
    top: "50.7741%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  690: {
    left: "52.95097158469945%",
    top: "53.61280967741935%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  692: {
    left: "67.4864568306011%",
    top: "58.12895806451613%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  693: {
    left: "69.78158196721313%",
    top: "58.38706451612903%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  695: {
    left: "68.798%",
    top: "54.77416129032258%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  696: {
    left: "69.6723169398907%",
    top: "53.74194193548387%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
  698: {
    left: "69.6723%",
    top: "56.45157741935484%",
    transform: "translate(-50%, -50%) rotate(0deg) scale(1.2)",
  },
};
