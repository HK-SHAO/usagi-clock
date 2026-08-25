import "./style.css";
import { AudioEngine } from "./audio";
import { Player } from "./player";
import { AlarmSchedule } from "./schedule";
import { SettingsPanel } from "./settings";
import { WELCOME_ITEMS, WelcomeModal } from "./welcome";
import { checkin } from "./toy";
import {
  exitFullscreen,
  getFullscreenElement,
  requestFullscreen,
} from "./utils/full-screen";

// ── 常量 ──
const ORIENTATION_KEY = "usagi-clock-orientation-dismissed";

// ── DOM 引用 ──
const canvas = document.getElementById("stage") as HTMLCanvasElement;
const clockEl = document.getElementById("clock")!;
const loadingEl = document.getElementById("loading")!;
const settingsContainer = document.getElementById("settings-container")!;

// ── 模块初始化 ──
const audio = new AudioEngine();
const schedule = new AlarmSchedule();
const settingsPanel = new SettingsPanel(settingsContainer);

let player: Player;
let welcome: WelcomeModal | null = null;

/** 初始化入口 */
async function init(): Promise<void> {
  // 音频加载放后台，不阻塞视觉启动（AudioContext 需用户手势解锁，init 仅预加载 Buffer）
  void audio.init().catch(() => {});
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

  // 欢迎弹窗：融合「开启声音」与「点击时钟」引导，每次打开都展示，按钮点击同时解锁音频
  welcome = new WelcomeModal(document.getElementById("app")!, WELCOME_ITEMS, () => {
    void audio.unlock();
  });

  // 绑定交互
  setupAudioUnlock();
  setupFullscreen();
  setupClockClick();
  setupVisibilityHandler();
  setupResizeObserver();
  setupOrientationPrompt();
  setupWelcome();
  setupEscapeClose();
}

// ── 全局音频解锁：任意位置 click/touchstart/keydown 均可 ──
function setupAudioUnlock(): void {
  const unlock = () => {
    if (audio.unlocked) return;
    void audio.unlock();
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

// ── 竖屏提示：点击"知道了"后不再显示（localStorage 记忆），并补上点击时钟引导 ──
function setupOrientationPrompt(): void {
  const dismissBtn = document.getElementById("orientation-dismiss");
  const overlay = document.getElementById("orientation-prompt");
  if (!dismissBtn || !overlay) return;

  // 已确认过的用户不再打扰（隐私模式等异常静默降级）
  try {
    if (localStorage.getItem(ORIENTATION_KEY)) {
      overlay.classList.add("dismissed");
    }
  } catch {
    // 忽略读取失败
  }
  dismissBtn.addEventListener("click", () => {
    overlay.classList.add("dismissed");
    try {
      localStorage.setItem(ORIENTATION_KEY, "1");
    } catch {
      // 忽略写入失败
    }
    // 横屏引导关闭后，补上欢迎弹窗（每次打开都展示，不受历史影响）
    welcome?.show();
  });
}

// ── 设置面板：ESC 关闭（桌面端习惯）──
function setupEscapeClose(): void {
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") settingsPanel.close();
  });
}

// ── 欢迎弹窗：每次打开都展示（无历史记忆）；竖屏引导遮罩可见时等其关闭 ──
function setupWelcome(): void {
  const overlay = document.getElementById("orientation-prompt");
  const portraitMq = window.matchMedia("(orientation: portrait)");

  // 竖屏全屏遮罩可见时不打扰（被遮住，无意义）
  const promptActive = () =>
    !!overlay &&
    !overlay.classList.contains("dismissed") &&
    portraitMq.matches &&
    window.innerWidth <= 900;

  // 首帧已显示（init 在 await loadFrames 之后才调用本函数），立即淡入引导
  if (!promptActive()) welcome?.show();
}

// ── 启动 ──
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { void init(); });
} else {
  void init();
}
