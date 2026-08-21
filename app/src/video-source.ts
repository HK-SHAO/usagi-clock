import { frameRate } from "./config";

/**
 * 视频帧提取器：将单个视频文件作为帧源，通过 seek + drawImage 提取指定帧。
 *
 * 核心流程：
 * 1. fetch() 一次性加载整个视频文件到内存（不依赖 HTTP Range 请求）
 * 2. 创建 Blob URL 赋给隐藏 <video> 元素
 * 3. 动画时 seek 到对应帧的时间点，等待 seeked 事件后 drawImage 到 Canvas
 *
 * 兼容性：
 * - MP4 (H.264)：Chrome 30+, Safari 9+, Firefox 42+, iOS Safari 9+
 * - fetch + Blob URL：所有现代浏览器
 * - video.currentTime seek：所有现代浏览器
 */
export class VideoFrameSource {
  private video: HTMLVideoElement | null = null;
  private blobUrl: string | null = null;

  /**
   * 加载视频文件并准备帧提取。
   * @param videoUrl Bun 构建后的视频资源 URL
   * @returns 首帧已绘制到 canvas 后 resolve
   */
  async load(videoUrl: string): Promise<void> {
    // 1. 一次性获取整个视频文件（单个 HTTP GET，无需 Range）
    const response = await fetch(videoUrl);
    const buffer = await response.arrayBuffer();
    const blob = new Blob([buffer], { type: "video/mp4" });
    this.blobUrl = URL.createObjectURL(blob);

    // 2. 创建隐藏 video 元素
    const video = document.createElement("video");
    video.src = this.blobUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    this.video = video;

    // 3. 等待元数据（分辨率、时长）
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error("视频加载失败")), {
        once: true,
      });
    });

    // 4. 等待首帧可解码（确保 seek 可用）
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) {
        resolve();
      } else {
        video.addEventListener("canplay", () => resolve(), { once: true });
        // 超时兜底：部分浏览器 may not fire canplay for blob URLs
        setTimeout(resolve, 3000);
      }
    });
  }

  /**
   * seek 到指定帧并绘制到 canvas（object-fit: cover 等效）。
   * @param frameIndex 视频帧序号（0 = 第一帧）
   * @param canvas 目标 canvas
   */
  async seekAndDraw(
    frameIndex: number,
    canvas: HTMLCanvasElement,
  ): Promise<void> {
    const video = this.video;
    if (!video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 计算帧对应的视频时间
    const time = frameIndex / frameRate;

    // 等待 seek 完成
    await this.seekTo(time);

    // object-fit: cover 计算
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw === 0 || ch === 0 || vw === 0 || vh === 0) return;

    const scale = Math.max(cw / vw, ch / vh);
    const sw = cw / scale;
    const sh = ch / scale;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
  }

  /** 释放资源 */
  dispose(): void {
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute("src");
      this.video.load();
      this.video = null;
    }
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
  }

  // ── 内部 ──

  /** Promise 封装的 video.seekTo()，带 seeked 事件等待和超时兜底 */
  private seekTo(time: number): Promise<void> {
    const video = this.video!;

    // 如果 currentTime 已经非常接近目标时间，跳过 seek
    if (Math.abs(video.currentTime - time) < 0.001) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      const onSeeked = () => done();
      video.addEventListener("seeked", onSeeked, { once: true });
      video.currentTime = time;
      // 超时兜底：防止 seeked 事件不触发
      setTimeout(done, 100);
    });
  }
}
