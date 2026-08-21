import {
  frameNumbers,
  frameRate,
  tiktokLoopFrame,
  alarmFrame,
  alarmLoopFrame,
  clockStylesMapping,
} from "./config";
import { AudioEngine } from "./audio";
import { AlarmSchedule } from "./schedule";
import { VideoFrameSource } from "./video-source";
import { animationVideo } from "./video";

// 播放器状态枚举
const enum State {
  TIKTOK,
  ALARM,
  ALARM_LOOP,
}

/**
 * 帧动画播放器：requestAnimationFrame 驱动的状态机
 *
 * 三态：TIKTOK（乒乓循环 + 滴答音）→ ALARM（报时过渡）→ ALARM_LOOP（循环 + 持续铃声）
 * Canvas 2D 渲染：从单个 MP4 视频文件 seek + drawImage 提取帧，零 DOM 开销
 */
export class Player {
  private state = State.TIKTOK;
  private direction = 1;
  private frameIndex = 0;
  private lastFrameTime = 0;
  private lastTiktokAudioTime = 0;
  private alarmStartTime = 0;
  private rafId = 0;

  // 帧间隔 (ms)
  private readonly frameInterval = 1000 / frameRate;
  // 滴答音频间隔 (ms)
  private readonly tiktokAudioInterval = 2000;
  // 报时持续时间 (ms)
  private readonly alarmDuration = 60 * 1000;

  // 完整帧列表（含复用帧）
  private readonly fullFrameList: number[];
  // 乒乓循环边界（在 fullFrameList 中的下标）
  private readonly tiktokStart: number;
  private readonly tiktokEnd: number;
  // 缓存状态机常用 findIndex 结果（避免动画循环中反复遍历）
  private readonly alarmStartIdx: number;
  private readonly alarmLoopStartIdx: number;
  private readonly alarmLoopEndIdx: number;

  // Canvas 渲染
  private readonly ctx: CanvasRenderingContext2D;
  private readonly videoSource = new VideoFrameSource();
  // 视频首帧对应的原始帧序号（用于将 original frame → video index）
  private readonly videoStartFrame: number;
  private currentFrame: number | null = null;
  private seeking = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly clockEl: HTMLElement,
    private readonly audio: AudioEngine,
    private readonly schedule: AlarmSchedule,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available");
    this.ctx = ctx;

    // 视频首帧对应的原始帧序号
    this.videoStartFrame = frameNumbers[0]!;

    // 构建完整帧列表（复用重复帧，减少图片数量）
    const start = frameNumbers[0]!;
    const end = frameNumbers.at(-1)!;
    const list: number[] = [];
    let cur = start;
    let idx = 0;
    for (let i = start; i <= end; i++) {
      if (idx < frameNumbers.length && frameNumbers[idx] === i) {
        cur = i;
        idx++;
      }
      list.push(cur);
    }
    this.fullFrameList = list;
    this.tiktokStart = list.findIndex((f) => f === tiktokLoopFrame.l);
    this.tiktokEnd = list.findIndex((f) => f === tiktokLoopFrame.r);

    // 缓存状态机关键帧下标
    this.alarmStartIdx = list.findIndex((f) => f === alarmFrame);
    this.alarmLoopStartIdx = list.findIndex((f) => f === alarmLoopFrame.l);
    this.alarmLoopEndIdx = list.findIndex((f) => f === alarmLoopFrame.r);
  }

  /**
   * 加载视频文件并提取首帧：
   * 1. fetch() 一次性加载整个 MP4 到内存（不依赖 Range 请求）
   * 2. 创建 Blob URL → 隐藏 <video> 元素
   * 3. seek 到首帧并绘制到 canvas
   */
  async loadFrames(): Promise<void> {
    await this.videoSource.load(animationVideo);

    // 绘制首帧（tiktok 循环起点）
    const firstFrameIdx = this.fullFrameList.indexOf(tiktokLoopFrame.l);
    if (firstFrameIdx !== -1) {
      await this.videoSource.seekAndDraw(firstFrameIdx, this.canvas);
    }
  }

  /** 同步 canvas 像素尺寸（含 DPR） */
  syncSize(): void {
    const dpr = devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  /** seek 当前帧到 canvas（异步，防重叠） */
  private drawFrame(): void {
    if (this.currentFrame == null || this.seeking) return;
    // 将原始帧序号转换为视频帧索引（0-based）
    const videoIndex = this.currentFrame - this.videoStartFrame;
    this.seeking = true;
    void this.videoSource
      .seekAndDraw(videoIndex, this.canvas)
      .finally(() => {
        this.seeking = false;
      });
  }

  /** 启动动画循环 */
  start(): void {
    this.resetToTiktok();
    this.rafId = requestAnimationFrame((t) => this.animate(t));
  }

  /** 停止动画循环 */
  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  /** 手动触发闹钟检查（设置保存后调用） */
  checkAlarm(): void {
    this.evaluateAlarm();
  }

  // ── 帧切换 ──

  /** 切换到指定帧（视频 seek + Canvas drawImage） */
  private changeFrame(frameListIndex: number): void {
    const frame = this.fullFrameList[frameListIndex]!;
    if (this.currentFrame === frame) return;

    this.currentFrame = frame;
    this.drawFrame();

    // 更新时钟时间
    const now = new Date();
    this.clockEl.textContent =
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // 更新时钟容器位置/样式
    const style = clockStylesMapping[frame];
    if (style) Object.assign(this.clockEl.style, style);
  }

  // ── 状态机 ──

  /** 计算下一帧索引 */
  private nextFrameIndex(): number {
    switch (this.state) {
      case State.TIKTOK: {
        let next = this.frameIndex + this.direction;
        if (next >= this.tiktokEnd || next <= this.tiktokStart) {
          this.direction *= -1;
          next = next >= this.tiktokEnd ? this.tiktokEnd : this.tiktokStart;
        }
        return next;
      }

      case State.ALARM: {
        const next = this.frameIndex + 1;
        if (next >= this.alarmLoopStartIdx) {
          this.state = State.ALARM_LOOP;
          this.alarmStartTime = Date.now();
          return this.alarmLoopStartIdx;
        }
        return next;
      }

      case State.ALARM_LOOP: {
        const next = this.frameIndex + 1;

        if (next >= this.alarmLoopEndIdx || Date.now() - this.alarmStartTime >= this.alarmDuration) {
          if (Date.now() - this.alarmStartTime >= this.alarmDuration) {
            this.state = State.TIKTOK;
            this.audio.stopAll();
            return this.tiktokStart;
          }
          return this.alarmLoopStartIdx;
        }
        return next;
      }
    }
  }

  // ── 闹钟触发 ──

  private triggerAlarm(): void {
    this.state = State.ALARM;
    if (this.alarmStartIdx !== -1) {
      this.changeFrame((this.frameIndex = this.alarmStartIdx));
    }
    this.audio.stopAll();
    this.audio.play(this.audio.alarmBuf, () => {
      if (this.state === State.ALARM || this.state === State.ALARM_LOOP) {
        this.audio.playLoop(this.audio.alarmLoopBuf);
      }
    });
  }

  private resetToTiktok(): void {
    this.state = State.TIKTOK;
    if (this.tiktokStart !== -1) {
      this.changeFrame((this.frameIndex = this.tiktokStart));
    }
    this.direction = 1;
    this.lastTiktokAudioTime = performance.now();
    this.audio.stopAll();
  }

  private evaluateAlarm(): void {
    const should = this.schedule.shouldTriggerAlarm();
    if (should && this.state === State.TIKTOK) {
      this.triggerAlarm();
    } else if (!should && this.state !== State.TIKTOK) {
      this.resetToTiktok();
    }
  }

  // ── 主循环 ──

  private animate = (time: number): void => {
    if (!this.lastFrameTime) this.lastFrameTime = time;
    const delta = time - this.lastFrameTime;

    if (delta >= this.frameInterval) {
      // 滴答音频
      if (this.state === State.TIKTOK) {
        if (time - this.lastTiktokAudioTime >= this.tiktokAudioInterval) {
          this.audio.play(this.audio.tiktokBuf);
          this.lastTiktokAudioTime = time;
        }
      }

      // 下一帧
      const next = this.nextFrameIndex();
      this.changeFrame((this.frameIndex = next));

      // 修正时间偏差
      this.lastFrameTime = time - (delta % this.frameInterval);

      // 检查闹钟
      this.evaluateAlarm();
    }

    this.rafId = requestAnimationFrame((t) => this.animate(t));
  };
}
