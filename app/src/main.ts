import "./style.css";
import { AudioEngine } from "./audio";
import { Player } from "./player";
import { AlarmSchedule } from "./schedule";
import { SettingsPanel } from "./settings";
import { checkin } from "./toy";
import {
  exitFullscreen,
  getFullscreenElement,
  requestFullscreen,
} from "./utils/full-screen";

// ── DOM 引用 ──
const canvas = document.getElementById("stage") as HTMLCanvasElement;
const clockEl = document.getElementById("clock")!;
const audioHint = document.getElementById("audio-hint")!;
const loadingEl = document.getElementById("loading")!;
const settingsContainer = document.getElementById("settings-container")!;

// ── 模块初始化 ──
const audio = new AudioEngine();
const schedule = new AlarmSchedule();
const settingsPanel = new SettingsPanel(settingsContainer);

let player: Player;

/** 初始化入口 */
async function init(): Promise<void> {
  // 音频加载放后台，不阻塞视觉启动（AudioContext 需用户手势解锁，init 仅预加载 Buffer）
  void audio.init();
  void schedule.load();

  // 创建播放器，同步尺寸，等待首帧加载，然后启动动画
  player = new Player(canvas, clockEl, audio, schedule);
  player.syncSize();
  await player.loadFrames();
  player.start();

  // 首帧已显示，隐藏加载指示器
  loadingEl.classList.add("hidden");

  // 每日打卡
  void checkin();

  // 绑定交互
  setupAudioUnlock();
  setupFullscreen();
  setupClockClick();
  setupVisibilityHandler();
  setupResizeObserver();
  setupOrientationPrompt();

  // 2秒后若未解锁，显示提示
  if (!audio.unlocked) {
    setTimeout(() => {
      if (!audio.unlocked) audioHint.classList.add("show");
    }, 2000);
    // 8秒后自动隐藏提示
    setTimeout(() => audioHint.classList.remove("show"), 8000);
  }
}

// ── 全局音频解锁：任意位置 click/touchstart/keydown 均可 ──
function setupAudioUnlock(): void {
  const unlock = () => {
    if (audio.unlocked) return;
    void audio.unlock().then(() => {
      audioHint.classList.remove("show");
    });
  };

  document.addEventListener("click", unlock, true);
  document.addEventListener("touchstart", unlock, true);
  window.addEventListener("keydown", unlock);
}

// ── 全屏切换 ──
let wakeLock: WakeLockSentinel | null = null;

async function toggleFullscreen(): Promise<void> {
  const isFull = !!getFullscreenElement();
  try {
    if (!isFull) {
      await requestFullscreen(document.documentElement);
      if ("wakeLock" in navigator) {
        try { wakeLock = await navigator.wakeLock.request("screen"); } catch {}
      }
    } else {
      await exitFullscreen();
      if (wakeLock) {
        try { await wakeLock.release(); } catch {}
        wakeLock = null;
      }
    }
  } catch (e) {
    console.warn("Fullscreen operation failed:", e);
  }
}

function setupFullscreen(): void {
  canvas.addEventListener("click", () => { void toggleFullscreen(); });

  const onFsChange = () => {
    if (!getFullscreenElement() && wakeLock) {
      void wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  };
  for (const evt of ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"]) {
    document.addEventListener(evt, onFsChange);
  }
}

// ── 时钟点击 → 打开设置面板 ──
// 同时监听 click + touchend：iOS Safari 的 click 有 ~350ms 延迟且可能被
// ghost-click 预防机制干扰，touchend 更可靠。preventDefault 阻止两者重复触发。
function setupClockClick(): void {
  let handled = false;
  const openSettings = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (handled) return;
    handled = true;
    // touchend 触发后短暂锁定期，防止后续合成 click 再次触发
    setTimeout(() => { handled = false; }, 400);
    settingsPanel.open(schedule.settings, (newSettings) => {
      schedule.save(newSettings);
      player.checkAlarm();
    });
  };
  clockEl.addEventListener("click", openSettings);
  clockEl.addEventListener("touchend", openSettings);
}

// ── 页面可见性恢复时 resume AudioContext ──
function setupVisibilityHandler(): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && audio.unlocked) {
      // AudioEngine 内部不直接暴露 ctx，但 unlock() 会安全地 resume
      void audio.unlock();
    }
  });
}

// ── canvas 尺寸同步 ──
function setupResizeObserver(): void {
  const ro = new ResizeObserver(() => {
    if (player) {
      player.syncSize();
    }
  });
  ro.observe(canvas);
}

// ── 竖屏提示：点击“知道了”后不再显示 ──
function setupOrientationPrompt(): void {
  const dismissBtn = document.getElementById("orientation-dismiss");
  const overlay = document.getElementById("orientation-prompt");
  if (!dismissBtn || !overlay) return;
  dismissBtn.addEventListener("click", () => {
    overlay.classList.add("dismissed");
  });
}

// ── 启动 ──
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { void init(); });
} else {
  void init();
}
