import {
  frameNumbers,
  frameRate,
  tiktokLoopFrame,
  alarmFrame,
  alarmLoopFrame,
  clockStylesMapping,
} from "./config";
import * as frames from "./frames";
import { AudioEngine } from "./audio";
import { AlarmSchedule } from "./schedule";

// 播放器状态枚举
const enum State {
  TIKTOK,
  ALARM,
  ALARM_LOOP,
}

/** 根据帧序号获取图片路径 */
function framePath(n: number): string {
  return (frames as Record<string, string>)[`f${n}`] ?? "";
}

/**
 * 帧动画播放器：requestAnimationFrame 驱动的状态机
 *
 * 三态：TIKTOK（乒乓循环 + 滴答音）→ ALARM（报时过渡）→ ALARM_LOOP（循环 + 持续铃声）
 * 直接操作 DOM（z-index 切换），无框架开销
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

  // DOM 引用
  private readonly imgMap = new Map<number, HTMLImageElement>();
  private currentFrame: number | null = null;

  constructor(
    private readonly stage: HTMLElement,
    private readonly clockEl: HTMLElement,
    private readonly audio: AudioEngine,
    private readonly schedule: AlarmSchedule,
  ) {
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

    // 创建所有帧 img 元素
    this.createFrameImages();
  }

  /** 创建帧图片 DOM 并挂载到 stage */
  private createFrameImages(): void {
    for (const n of frameNumbers) {
      const img = new Image();
      img.src = framePath(n);
      img.alt = `f${n}`;
      img.decoding = "async";
      img.loading = "eager";
      img.className = "frame-img";
      img.style.zIndex = n === this.fullFrameList[0] ? "10" : "1";

      // 加载失败时隐藏，避免显示破碎图标
      img.onerror = () => {
        img.style.display = "none";
      };

      this.stage.appendChild(img);
      this.imgMap.set(n, img);
    }
  }

  /** 等待所有帧图片加载完成（失败不阻塞，超时 5s 后继续） */
  async loadFrames(): Promise<void> {
    const imgs = Array.from(this.imgMap.values());
    const pending = imgs.filter((img) => !img.complete);
    if (pending.length === 0) return;

    await Promise.race([
      Promise.all(
        pending.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) { resolve(); return; }
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }),
        ),
      ),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]);
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

  /** 切换到指定帧（直接操作 DOM，无重渲染） */
  private changeFrame(frameListIndex: number): void {
    const frame = this.fullFrameList[frameListIndex]!;
    if (this.currentFrame === frame) return;

    // 降低旧帧
    if (this.currentFrame != null) {
      const old = this.imgMap.get(this.currentFrame);
      if (old) old.style.zIndex = "1";
    }
    // 提升新帧
    const next = this.imgMap.get(frame);
    if (next) next.style.zIndex = "10";

    // 更新时钟时间
    const now = new Date();
    this.clockEl.textContent =
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // 更新时钟容器位置/样式
    const style = clockStylesMapping[frame];
    if (style) Object.assign(this.clockEl.style, style);

    this.currentFrame = frame;
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
        const alarmStart = this.fullFrameList.findIndex((f) => f === alarmFrame);
        const loopStart = this.fullFrameList.findIndex((f) => f === alarmLoopFrame.l);
        const next = this.frameIndex + 1;
        if (next >= loopStart) {
          this.state = State.ALARM_LOOP;
          this.alarmStartTime = Date.now();
          return loopStart;
        }
        return next;
      }

      case State.ALARM_LOOP: {
        const loopStart = this.fullFrameList.findIndex((f) => f === alarmLoopFrame.l);
        const loopEnd = this.fullFrameList.findIndex((f) => f === alarmLoopFrame.r);
        const next = this.frameIndex + 1;

        if (next >= loopEnd || Date.now() - this.alarmStartTime >= this.alarmDuration) {
          if (Date.now() - this.alarmStartTime >= this.alarmDuration) {
            this.state = State.TIKTOK;
            this.audio.stopAll();
            return this.fullFrameList.findIndex((f) => f === tiktokLoopFrame.l);
          }
          return loopStart;
        }
        return next;
      }
    }
  }

  // ── 闹钟触发 ──

  private triggerAlarm(): void {
    this.state = State.ALARM;
    const idx = this.fullFrameList.findIndex((f) => f === alarmFrame);
    if (idx !== -1) {
      this.changeFrame((this.frameIndex = idx));
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
    const idx = this.fullFrameList.findIndex((f) => f === tiktokLoopFrame.l);
    if (idx !== -1) {
      this.changeFrame((this.frameIndex = idx));
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
