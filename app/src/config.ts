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
  552, 556, 560, 563, 567, 571, 575, 578, 582, 597, 601, 605, 608, 646, 678,
  688, 690, 691, 692, 693, 695, 696, 697, 698, 700, 701, 702, 703, 705, 706,
  707, 708, 710, 711, 712, 713, 715, 716, 717, 718, 720, 721, 722, 723, 725,
  726, 727, 728, 730, 731, 732, 733, 735, 736, 737, 738, 740, 741, 742, 743,
  745, 746, 747, 748, 750, 751, 752, 753, 755, 756, 757, 758, 760, 761, 762,
  763, 765, 766, 767, 768, 770, 771, 772, 773, 775, 776, 777, 778, 780, 781,
  782, 783, 785, 786, 787, 788,
];

/**
 * 视频帧率
 */
export const frameRate = 30;

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
  541: {
    left: "calc(50% + var(--unit) * 11.95)",
    top: "calc(50% + var(--unit) * -0.62)",
    transform: "translate(-50%, -50%) rotate(0deg) scale(2.3)",
  },
  552: {
    left: "calc(50% + var(--unit) * 11.95)",
    top: "calc(50% + var(--unit) * -0.62)",
    transform: "translate(-50%, -50%) rotate(0deg) scale(2.3)",
  },
  556: {
    left: "calc(50% + var(--unit) * 11.95)",
    top: "calc(50% + var(--unit) * -0.62)",
    transform: "translate(-50%, -50%) rotate(0deg) scale(2.3)",
  },
  560: {
    left: "calc(50% + var(--unit) * 10.364)",
    top: "calc(50% + var(--unit) * -0.742)",
    transform: "translate(-50%, -50%) rotate(0deg) scale(2.3)",
  },
  563: {
    left: "calc(50% + var(--unit) * 8.534)",
    top: "calc(50% + var(--unit) * -0.864)",
    transform: "translate(-50%, -50%) rotate(0deg) scale(2.3)",
  },
  567: {
    left: "calc(50% + var(--unit) * 6.704)",
    top: "calc(50% + var(--unit) * -0.742)",
    transform: "translate(-50%, -50%) rotate(0deg) scale(2.3)",
  },
  571: {
    left: "calc(50% + var(--unit) * 5.728)",
    top: "calc(50% + var(--unit) * -0.62)",
    transform: "translate(-50%, -50%) rotate(0deg) scale(2.3)",
  },
  575: {
    left: "calc(50% + var(--unit) * 4.874)",
    top: "calc(50% + var(--unit) * -0.498)",
    transform: "translate(-50%, -50%) rotate(0deg) scale(2.3)",
  },
  646: {
    left: "calc(50% + var(--unit) * 0)",
    top: "calc(50% + var(--unit) * 0)",
    transform: "translate(-50%, -50%) rotate(0deg) scale(22)",
  },
  678: {
    left: "calc(50% + var(--unit) * 0)",
    top: "calc(50% + var(--unit) * 0)",
    transform: "translate(-50%, -50%) rotate(0deg) scale(22)",
  },
  688: {
    left: "calc(50% + var(--unit) * 4.2)",
    top: "calc(50% + var(--unit) * 3.5)",
    transform: "translate(-50%, -50%) rotate(6deg) scale(5)",
  },
  690: {
    left: "calc(50% + var(--unit) * 18.4)",
    top: "calc(50% + var(--unit) * 6.4)",
    transform: "translate(-50%, -50%) rotate(6deg) scale(3.4)",
  },
  691: {
    left: "calc(50% + var(--unit) * 21.9)",
    top: "calc(50% + var(--unit) * 7.7)",
    transform: "translate(-50%, -50%) rotate(6deg) scale(3)",
  },
  692: {
    left: "calc(50% + var(--unit) * 23.4)",
    top: "calc(50% + var(--unit) * 8)",
    transform: "translate(-50%, -50%) rotate(6deg) scale(2.8)",
  },
  693: {
    left: "calc(50% + var(--unit) * 23)",
    top: "calc(50% + var(--unit) * 3.2)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.8)",
  },
  695: {
    left: "calc(50% + var(--unit) * 23.6)",
    top: "calc(50% + var(--unit) * 3.4)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.7)",
  },
  696: {
    left: "calc(50% + var(--unit) * 23.7)",
    top: "calc(50% + var(--unit) * 3.6)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  697: {
    left: "calc(50% + var(--unit) * 23.2)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  701: {
    left: "calc(50% + var(--unit) * 23.7)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  705: {
    left: "calc(50% + var(--unit) * 23.2)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  708: {
    left: "calc(50% + var(--unit) * 23.7)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  712: {
    left: "calc(50% + var(--unit) * 23.2)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  713: {
    left: "calc(50% + var(--unit) * 23.7)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  715: {
    left: "calc(50% + var(--unit) * 24.3)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  716: {
    left: "calc(50% + var(--unit) * 25.8)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  717: {
    left: "calc(50% + var(--unit) * 27.1)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  718: {
    left: "calc(50% + var(--unit) * 28.6)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  720: {
    left: "calc(50% + var(--unit) * 29.8)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  721: {
    left: "calc(50% + var(--unit) * 34)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  723: {
    left: "calc(50% + var(--unit) * 36.8)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  725: {
    left: "calc(50% + var(--unit) * 39.2)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  726: {
    left: "calc(50% + var(--unit) * 41.4)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  727: {
    left: "calc(50% + var(--unit) * 43)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  728: {
    left: "calc(50% + var(--unit) * 45)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  730: {
    left: "calc(50% + var(--unit) * 46.8)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  731: {
    left: "calc(50% + var(--unit) * 48.9)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  732: {
    left: "calc(50% + var(--unit) * 50.1)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  733: {
    left: "calc(50% + var(--unit) * 51.2)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  735: {
    left: "calc(50% + var(--unit) * 51.2)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  736: {
    left: "calc(50% + var(--unit) * 51.7)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  737: {
    left: "calc(50% + var(--unit) * 51.8)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  738: {
    left: "calc(50% + var(--unit) * 52.3)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  742: {
    left: "calc(50% + var(--unit) * 51.9)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  746: {
    left: "calc(50% + var(--unit) * 52.3)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  750: {
    left: "calc(50% + var(--unit) * 51.9)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  753: {
    left: "calc(50% + var(--unit) * 52.3)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  757: {
    left: "calc(50% + var(--unit) * 51.9)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  761: {
    left: "calc(50% + var(--unit) * 52.3)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  765: {
    left: "calc(50% + var(--unit) * 51.9)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  768: {
    left: "calc(50% + var(--unit) * 52.3)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  772: {
    left: "calc(50% + var(--unit) * 51.9)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  776: {
    left: "calc(50% + var(--unit) * 52.3)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  780: {
    left: "calc(50% + var(--unit) * 51.9)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  783: {
    left: "calc(50% + var(--unit) * 52.3)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
  787: {
    left: "calc(50% + var(--unit) * 51.9)",
    top: "calc(50% + var(--unit) * 6.7)",
    transform: "translate(-50%, -50%) rotate(-4deg) scale(2.6)",
  },
  788: {
    left: "calc(50% + var(--unit) * 52.3)",
    top: "calc(50% + var(--unit) * 5.9)",
    transform: "translate(-50%, -50%) rotate(16deg) scale(2.6)",
  },
};
