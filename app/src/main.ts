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
const stage = document.getElementById("stage")!;
const clockEl = document.getElementById("clock")!;
const audioHint = document.getElementById("audio-hint")!;
const settingsContainer = document.getElementById("settings-container")!;

// ── 模块初始化 ──
const audio = new AudioEngine();
const schedule = new AlarmSchedule();
const settingsPanel = new SettingsPanel(settingsContainer);

let player: Player;

/** 初始化入口 */
async function init(): Promise<void> {
  // 并行初始化音频引擎和闹钟调度
  await Promise.all([audio.init(), schedule.load()]);

  // 创建播放器并启动动画
  player = new Player(stage, clockEl, audio, schedule);
  player.start();

  // 每日打卡
  void checkin();

  // 绑定交互
  setupAudioUnlock();
  setupFullscreen();
  setupClockClick();
  setupVisibilityHandler();

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
  stage.addEventListener("click", () => { void toggleFullscreen(); });

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
function setupClockClick(): void {
  clockEl.addEventListener("click", (e) => {
    e.stopPropagation();
    settingsPanel.open(schedule.settings, (newSettings) => {
      schedule.save(newSettings);
      player.checkAlarm();
    });
  });
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

// ── 启动 ──
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { void init(); });
} else {
  void init();
}
