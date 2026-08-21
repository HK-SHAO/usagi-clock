import ulaTiktokURL from "../../assets/ula-tiktok.ogg";
import ulaAlarmURL from "../../assets/ula-alarm.ogg";
import ulaAlarmLoopURL from "../../assets/ula-alarm-loop.wav";

/**
 * Web Audio 引擎：管理 AudioContext、音频 Buffer 加载/播放/解锁/资源回收
 *
 * 关键设计：
 * - play() 在 suspended 状态下也立即 start source，浏览器排队后 resume 即出声，零丢失
 * - 音频加载带重试（指数退避），应对网络波动
 * - 全局 document click/touchstart/keydown 解锁，任意位置交互均可触发
 * - visibilitychange 恢复：tab 切回时自动 resume 被挂起的上下文
 * - onended 自动 disconnect + 从 activeSources 移除，无泄漏
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private tiktokBuffer: AudioBuffer | null = null;
  private alarmBuffer: AudioBuffer | null = null;
  private alarmLoopBuffer: AudioBuffer | null = null;

  private activeSources = new Set<AudioBufferSourceNode>();
  private loopSource: AudioBufferSourceNode | null = null;
  private _unlocked = false;

  /** 是否已解锁音频播放 */
  get unlocked(): boolean {
    return this._unlocked;
  }

  /** 滴答音频 Buffer */
  get tiktokBuf(): AudioBuffer | null {
    return this.tiktokBuffer;
  }

  /** 报时音频 Buffer */
  get alarmBuf(): AudioBuffer | null {
    return this.alarmBuffer;
  }

  /** 报时循环音频 Buffer */
  get alarmLoopBuf(): AudioBuffer | null {
    return this.alarmLoopBuffer;
  }

  /** 初始化 AudioContext + 加载全部音频（带重试） */
  async init(): Promise<void> {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    const [tiktok, alarm, alarmLoop] = await Promise.all([
      this.loadBuffer(ulaTiktokURL),
      this.loadBuffer(ulaAlarmURL),
      this.loadBuffer(ulaAlarmLoopURL),
    ]);

    this.tiktokBuffer = tiktok;
    this.alarmBuffer = alarm;
    this.alarmLoopBuffer = alarmLoop;
  }

  /** 加载单个音频 Buffer，失败时重试（最多 retries 次，指数退避） */
  private async loadBuffer(url: string, retries = 2): Promise<AudioBuffer | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        return await this.ctx!.decodeAudioData(buf);
      } catch {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }
    return null;
  }

  /**
   * 恢复 AudioContext（需用户手势触发）
   * 页面任意位置的 click/touchstart/keydown 均可调用此方法
   */
  async unlock(): Promise<void> {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        return;
      }
    }
    this._unlocked = true;
  }

  /**
   * 播放单次音频
   * 即使 AudioContext 处于 suspended 也立即 start —— 浏览器排队，resume 后自动播放
   */
  play(buffer: AudioBuffer | null, onEnded?: () => void): void {
    const ctx = this.ctx;
    const gain = this.masterGain;
    if (!ctx || !gain || !buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);

    source.onended = () => {
      source.disconnect();
      this.activeSources.delete(source);
      onEnded?.();
    };

    this.activeSources.add(source);
    source.start(0);

    // suspended 时立即尝试恢复（source 已排队，恢复后自动播放）
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  /** 播放无缝循环音频 */
  playLoop(buffer: AudioBuffer | null): void {
    const ctx = this.ctx;
    const gain = this.masterGain;
    if (!ctx || !gain || !buffer) return;

    // 停止已存在的循环
    if (this.loopSource) {
      try { this.loopSource.stop(); } catch {}
      this.loopSource.disconnect();
      this.loopSource = null;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start(0);
    this.loopSource = source;

    if (ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  /** 停止所有音频（单次 + 循环） */
  stopAll(): void {
    this.activeSources.forEach((source) => {
      try { source.stop(); } catch {}
      source.disconnect();
    });
    this.activeSources.clear();

    if (this.loopSource) {
      try { this.loopSource.stop(); } catch {}
      this.loopSource.disconnect();
      this.loopSource = null;
    }
  }

  /** 销毁：停止所有音频 + 关闭 AudioContext */
  destroy(): void {
    this.stopAll();
    void this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
  }
}
