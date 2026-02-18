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
 * 时钟容器每一帧的样式，位置相对于所播放图片的正中心（百分比）
 * 支持属性：
 * - left: 水平位置（百分比），0% 表示图片中心，正数向右偏移
 * - top: 垂直位置（百分比），0% 表示图片中心，正数向下偏移
 * - transform: CSS transform（支持translate, rotate, scale等）
 */
export const clockStylesMapping: Record<number, CSSProperties> = {
  552: {
    left: "calc(50% + 12vh)",
    top: "calc(50% + -0.5vh)",
    transform: "translate(-50%, -50%) rotate(0deg) scale(2)",
  },
  556: {},
  560: {},
};
