import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import {
  frameNumbers,
  frameRate,
  tiktokLoopFrame,
  alarmFrame,
  alarmLoopFrame,
  clockStylesMapping,
} from "../config";
import { getFramePath } from "../utils/get-frame-path";
import { ulaTiktokURL, ulaAlarmURL, ulaAlarmLoopURL } from "../audios";
import { useAlarmSchedule } from "../hooks/useAlarmSchedule";
import { AlarmSettingsPanel } from "./AlarmSettingsPanel";
import comicFontURL from "@/../../assets/clock-font.woff2";
import {
  exitFullscreen,
  getFullscreenElement,
  requestFullscreen,
} from "@/utils/full-screen";

// 播放器状态枚举
enum PlayerState {
  // 正常滴答状态
  TIKTOK,
  // 整点报时播放状态
  ALARM,
  // 报时循环状态
  ALARM_LOOP,
}

export function ImagePlayer() {
  // 配置常量
  const startFrame = frameNumbers[0]!;
  const endFrame = frameNumbers.at(-1)!;
  // 每帧间隔时间(ms)
  const frameInterval = 1000 / frameRate;
  // 滴答音频播放间隔(2秒)
  const tiktokAudioInterval = 2000;
  // 报时持续时间(默认1分钟)
  const alarmDuration = 60 * 1000;
  // 状态引用
  const playerStateRef = useRef<PlayerState>(PlayerState.TIKTOK);
  // 播放方向: 1正序 -1倒序 (乒乓循环用)
  const directionRef = useRef(1);
  // 当前帧索引(对应fullFrameList的下标)
  const currentFrameIndexRef = useRef(0);
  // 上一帧渲染时间
  const lastFrameTimeRef = useRef(0);
  // 上一次滴答音频播放时间
  const lastTiktokAudioTimeRef = useRef(0);
  // 报时开始时间
  const alarmStartTimeRef = useRef(0);
  // 动画帧id
  const rafIdRef = useRef(0);
  // 所有帧图片dom引用map
  const frameImgRefs = useRef<Record<number, HTMLImageElement | null>>({});
  // 当前显示的帧号
  const currentFrameRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsUpdateTimeRef = useRef(0);
  // Web Audio 全局实例
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  // 预加载音频Buffer
  const tiktokBufferRef = useRef<AudioBuffer | null>(null);
  const alarmBufferRef = useRef<AudioBuffer | null>(null);
  const alarmLoopBufferRef = useRef<AudioBuffer | null>(null);

  // 预加载图片缓存
  const preloadedImagesRef = useRef<Record<number, HTMLImageElement>>({});

  // 活动音频源
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const alarmLoopSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // 音频是否被允许播放的状态 - 仅通过播放按钮解锁
  const [isAudioAllowed, setIsAudioAllowed] = useState(false);

  // 当前时间状态（用于时钟显示）
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });

  // 时钟容器引用
  const clockRef = useRef<HTMLDivElement>(null);
  // 设置面板状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // 全屏状态
  const [isFullscreen, setIsFullscreen] = useState(false);
  // 屏幕唤醒锁引用
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // 报时时间段逻辑
  const { settings, saveSettings, checkShouldTriggerAlarm } =
    useAlarmSchedule();

  /**
   * 恢复音频上下文 - 核心函数
   * 浏览器的自动播放策略要求用户交互后才能播放音频
   */
  const resumeAudio = useCallback(async () => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    setIsAudioAllowed(true);
  }, []);

  /**
   * 生成完整帧列表: 复用重复帧, 减少资源加载
   * 比如序号连续但内容相同的帧, 直接复用前一帧的图片
   */
  const fullFrameList = useMemo(() => {
    const list: number[] = [];
    let currentFrame = startFrame;
    let frameIndex = 0;
    for (let i = startFrame; i <= endFrame; i++) {
      if (frameIndex < frameNumbers.length && frameNumbers[frameIndex] === i) {
        currentFrame = i;
        frameIndex++;
      }
      list.push(currentFrame);
    }
    return list;
  }, [frameNumbers, startFrame, endFrame]);

  const tiktokStart = useMemo(
    () => fullFrameList.findIndex((f) => f === tiktokLoopFrame.l),
    [fullFrameList],
  );

  const tiktokEnd = useMemo(
    () => fullFrameList.findIndex((f) => f === tiktokLoopFrame.r),
    [fullFrameList],
  );

  /**
   * 播放单次音频，自动管理生命周期
   */
  const playAudio = useCallback(
    (buffer: AudioBuffer | null, onEnded?: () => void) => {
      const ctx = audioContextRef.current;
      const gain = masterGainRef.current;
      if (!ctx || !gain || !buffer) return;

      // 恢复被浏览器暂停的上下文
      if (ctx.state === "suspended") {
        ctx.resume();
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);

      // 播放完成自动清理资源
      source.onended = () => {
        source.disconnect();
        activeSourcesRef.current.delete(source);
        onEnded?.();
      };

      activeSourcesRef.current.add(source);
      source.start(0);
    },
    [],
  );

  /**
   * 播放无缝循环音频
   */
  const playLoopAudio = useCallback((buffer: AudioBuffer | null) => {
    const ctx = audioContextRef.current;
    const gain = masterGainRef.current;
    if (!ctx || !gain || !buffer) return;

    // 停止已存在的循环播放
    if (alarmLoopSourceRef.current) {
      try {
        alarmLoopSourceRef.current.stop();
      } catch {}
      alarmLoopSourceRef.current.disconnect();
      alarmLoopSourceRef.current = null;
    }

    if (ctx.state === "suspended") void ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start(0);
    alarmLoopSourceRef.current = source;
  }, []);

  /**
   * 停止所有音频（单次+循环）
   */
  const stopAllAudio = useCallback(() => {
    // 清理所有单次播放源
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {}
      source.disconnect();
    });
    activeSourcesRef.current.clear();

    // 清理循环播放源
    if (alarmLoopSourceRef.current) {
      try {
        alarmLoopSourceRef.current.stop();
      } catch {}
      alarmLoopSourceRef.current.disconnect();
      alarmLoopSourceRef.current = null;
    }
  }, []);

  /**
   * 初始化Web Audio系统和图片预加载
   */
  useEffect(() => {
    // 加载单个音频文件到Buffer
    const loadAudioBuffer = async (
      url: string,
    ): Promise<AudioBuffer | null> => {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        return await audioContextRef.current!.decodeAudioData(buf);
      } catch {
        return null;
      }
    };

    // 初始化音频栈
    const initAudio = async () => {
      // 创建上下文和主音量节点
      const AudioContext = window.AudioContext;
      audioContextRef.current = new AudioContext();
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);

      // 并行加载所有音频资源
      const [tiktokBuf, alarmBuf, alarmLoopBuf] = await Promise.all([
        loadAudioBuffer(ulaTiktokURL),
        loadAudioBuffer(ulaAlarmURL),
        loadAudioBuffer(ulaAlarmLoopURL),
      ]);

      tiktokBufferRef.current = tiktokBuf;
      alarmBufferRef.current = alarmBuf;
      alarmLoopBufferRef.current = alarmLoopBuf;
    };

    // 并行初始化音频和预加载所有图片
    const initAll = async () => {
      await Promise.all([initAudio()]);
    };

    void initAll();

    // 检查音频是否已解锁
    const checkAudioState = () => {
      if (audioContextRef.current?.state === "running") {
        setIsAudioAllowed(true);
      }
    };

    // 监听音频上下文状态变化
    const handleStateChange = () => {
      checkAudioState();
    };

    // 初始检查
    checkAudioState();

    // 订阅状态变化事件
    audioContextRef.current?.addEventListener("statechange", handleStateChange);

    // 销毁时全量释放资源
    return () => {
      stopAllAudio();
      void audioContextRef.current?.close();
      audioContextRef.current?.removeEventListener(
        "statechange",
        handleStateChange,
      );
    };
  }, [stopAllAudio]);

  /**
   * 播放滴答音频: 精准每2秒播放一次
   */
  const playTiktokAudio = useCallback(
    (currentTime: number) => {
      if (currentTime - lastTiktokAudioTimeRef.current >= tiktokAudioInterval) {
        playAudio(tiktokBufferRef.current);
        lastTiktokAudioTimeRef.current = currentTime;
      }
    },
    [playAudio],
  );

  /**
   * 状态机逻辑: 处理不同状态下的帧计算
   */
  const getNextFrameIndex = useCallback(
    (currentIndex: number) => {
      const state = playerStateRef.current;

      switch (state) {
        case PlayerState.TIKTOK:
          // 滴答状态: 在tiktokLoopFrame区间内乒乓循环

          let nextIndex = currentIndex + directionRef.current;
          if (nextIndex >= tiktokEnd || nextIndex <= tiktokStart) {
            directionRef.current *= -1;
            nextIndex = nextIndex >= tiktokEnd ? tiktokEnd : tiktokStart;
          }
          return nextIndex;

        case PlayerState.ALARM:
          // 报时状态: 从alarmFrame正序播放到alarmLoopFrame起始帧
          const alarmStart = fullFrameList.findIndex((f) => f === alarmFrame);
          const alarmLoopStart = fullFrameList.findIndex(
            (f) => f === alarmLoopFrame.l,
          );

          const nextAlarmIndex = currentIndex + 1;
          // 播放到循环起始帧后切换到循环状态
          if (nextAlarmIndex >= alarmLoopStart) {
            playerStateRef.current = PlayerState.ALARM_LOOP;
            alarmStartTimeRef.current = Date.now();
            return alarmLoopStart;
          }
          return nextAlarmIndex;

        case PlayerState.ALARM_LOOP:
          // 报时循环状态: 在alarmLoopFrame区间内正序循环
          const loopStart = fullFrameList.findIndex(
            (f) => f === alarmLoopFrame.l,
          );
          const loopEnd = fullFrameList.findIndex(
            (f) => f === alarmLoopFrame.r,
          );

          const nextLoopIndex = currentIndex + 1;
          // 循环播放, 或者到时间后切换回滴答状态
          if (
            nextLoopIndex >= loopEnd ||
            Date.now() - alarmStartTimeRef.current >= alarmDuration
          ) {
            // 报时结束, 回到滴答状态
            if (Date.now() - alarmStartTimeRef.current >= alarmDuration) {
              playerStateRef.current = PlayerState.TIKTOK;
              stopAllAudio();
              return fullFrameList.findIndex((f) => f === tiktokLoopFrame.l);
            }
            return loopStart;
          }
          return nextLoopIndex;

        default:
          return currentIndex;
      }
    },
    [fullFrameList],
  );

  function changeFrame(frameNumber: number) {
    const frame = fullFrameList[frameNumber]!;
    // 立即切换显示帧，无需等待下一动画帧
    if (currentFrameRef.current !== frame) {
      // 降低当前帧z-index
      if (currentFrameRef.current && frameImgRefs.current) {
        const img = frameImgRefs.current[currentFrameRef.current];
        if (img) img.style.zIndex = "1";
      }
      // 提升新帧到顶层
      if (frameImgRefs.current[frame]) {
        frameImgRefs.current[frame].style.zIndex = "10";
      }
      // 更新时钟时间（每帧更新）
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const timeStr = `${h}:${m}`;
      setCurrentTime(timeStr);

      // 更新时钟容器样式（动画）
      const frameStyle = clockStylesMapping[frame];
      if (frameStyle && clockRef.current) {
        Object.assign(clockRef.current.style, frameStyle);
      }

      // 更新当前帧序号引用
      currentFrameRef.current = frame;
    }
  }

  /**
   * 触发Alarm状态方法
   */
  const triggerAlarm = useCallback(() => {
    playerStateRef.current = PlayerState.ALARM;
    // 跳转到alarm起始帧
    const alarmStartIndex = fullFrameList.findIndex((f) => f === alarmFrame);
    if (alarmStartIndex !== -1) {
      changeFrame((currentFrameIndexRef.current = alarmStartIndex));
    }
    // 停止所有现有音频，播放报时音频，结束后自动无缝接循环
    stopAllAudio();
    playAudio(alarmBufferRef.current, () => {
      if (
        playerStateRef.current === PlayerState.ALARM ||
        playerStateRef.current === PlayerState.ALARM_LOOP
      ) {
        playLoopAudio(alarmLoopBufferRef.current);
      }
    });
  }, [stopAllAudio, playAudio, playLoopAudio, fullFrameList]);

  /**
   * 重置回tiktok状态
   */
  const resetToTiktok = useCallback(() => {
    playerStateRef.current = PlayerState.TIKTOK;
    // 跳转到tiktok起始帧，重置播放方向
    const tiktokStartIndex = fullFrameList.findIndex(
      (f) => f === tiktokLoopFrame.l,
    );
    if (tiktokStartIndex !== -1) {
      changeFrame((currentFrameIndexRef.current = tiktokStartIndex));
    }
    directionRef.current = 1;
    // 重置滴答音频计时器，避免刚重置就播放音频
    lastTiktokAudioTimeRef.current = performance.now();
    // 停止所有音频
    stopAllAudio();
  }, [stopAllAudio, fullFrameList]);

  const checkTriggerAlarm = useCallback(() => {
    // 检查闹钟
    const shouldAlarm = checkShouldTriggerAlarm();
    if (shouldAlarm && playerStateRef.current === PlayerState.TIKTOK) {
      triggerAlarm();
    } else if (!shouldAlarm && playerStateRef.current !== PlayerState.TIKTOK) {
      resetToTiktok();
    }
  }, [checkShouldTriggerAlarm, triggerAlarm, resetToTiktok]);

  /**
   * 渲染动画主循环: 用requestAnimationFrame实现高性能渲染
   * 避免不必要的state更新, 直接操作dom减少重渲染
   */
  const animate = useCallback(
    (time: number) => {
      if (!lastFrameTimeRef.current) lastFrameTimeRef.current = time;
      // 计算两帧时间差
      const delta = time - lastFrameTimeRef.current;

      // 达到帧间隔时间才更新帧
      if (delta >= frameInterval) {
        // 滴答状态下播放音频
        if (playerStateRef.current === PlayerState.TIKTOK) {
          playTiktokAudio(time);
        }
        // 计算下一帧索引
        const nextFrameIndex = getNextFrameIndex(currentFrameIndexRef.current);
        // 切换帧显示状态，仅修改visibility，无重绘闪烁
        changeFrame((currentFrameIndexRef.current = nextFrameIndex));

        // 修正时间偏差, 避免累计误差导致掉帧
        lastFrameTimeRef.current = time - (delta % frameInterval);

        // 检查闹钟
        checkTriggerAlarm();
      }

      // 继续下一帧
      rafIdRef.current = requestAnimationFrame(animate);
    },
    [
      frameInterval,
      fullFrameList,
      getNextFrameIndex,
      playTiktokAudio,
      checkTriggerAlarm,
    ],
  );

  /**
   * 启动/停止动画循环
   */
  useEffect(() => {
    // 启动动画
    resetToTiktok();
    rafIdRef.current = requestAnimationFrame(animate);

    // 组件销毁时停止动画
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [animate, fullFrameList, resetToTiktok]);

  // 首屏直接渲染, 后续更新仅切换visibility, 无重绘闪烁
  const initialFrame = fullFrameList[currentFrameIndexRef.current]!;
  currentFrameRef.current = initialFrame;

  /**
   * 请求屏幕唤醒锁，禁止熄屏
   */
  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {}
  }, []);

  /**
   * 释放屏幕唤醒锁，恢复正常熄屏
   */
  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {}
  }, []);

  /**
   * 切换全屏状态（兼容所有主流浏览器，含iOS Safari特殊处理）
   */
  const toggleFullscreen = useCallback(async () => {
    const isFull = !!getFullscreenElement();
    try {
      if (!isFull) {
        // iOS Safari 要求全屏请求必须在用户交互事件的同步流程中触发，不能放在await之后
        await requestFullscreen(document.documentElement);
        setIsFullscreen(true);
        await requestWakeLock();
      } else {
        await exitFullscreen();
        setIsFullscreen(false);
        await releaseWakeLock();
      }
    } catch (e) {
      // 处理部分浏览器自动拒绝全屏的情况（比如iOS受限制模式）
      console.warn("Fullscreen operation failed:", e);
    }
  }, [requestWakeLock, releaseWakeLock]);

  /**
   * 监听全屏状态变化（兼容所有浏览器前缀），同步状态和唤醒锁
   */
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!getFullscreenElement();
      setIsFullscreen(isFull);
      if (!isFull) {
        releaseWakeLock();
      }
    };

    // 监听所有前缀的全屏变化事件
    const events = [
      "fullscreenchange",
      "webkitfullscreenchange",
      "mozfullscreenchange",
      "MSFullscreenChange",
    ];
    events.forEach((event) =>
      document.addEventListener(event, handleFullscreenChange),
    );

    return () => {
      events.forEach((event) =>
        document.removeEventListener(event, handleFullscreenChange),
      );
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // 点击播放按钮处理函数 - 用户交互解锁音频（浏览器自动播放策略限制）
  const handlePlayButtonClick = resumeAudio;

  return (
    <div className="fixed inset-0 w-dvw h-dvh overflow-hidden bg-black select-none">
      <style>{`
        @font-face {
          font-family: 'ClockFont';
          src: url('${comicFontURL}') format('woff2');
          font-weight: bold;
          font-style: normal;
          font-display: swap;
        }
        html, body {
          margin: 0;
          padding: 0;
          width: 100dvw;
          height: 100dvh;
          overflow: hidden;
        }
      `}</style>
      <div className="w-full h-full inset-0" onClick={toggleFullscreen}>
        {frameNumbers.map((frame) => (
          <img
            key={frame}
            ref={(el) => void (frameImgRefs.current[frame] = el)}
            alt={`f${frame}`}
            src={getFramePath(frame)}
            className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none"
            style={{
              zIndex: frame === initialFrame ? 10 : 1,
              visibility: "visible",
              transition: "none",
            }}
            decoding="sync"
            loading="eager"
          />
        ))}
        {/* 时钟容器 - 纯白色背景，显示24小时制时间 */}
        <div
          ref={clockRef}
          onClick={(e) => {
            e.stopPropagation();
            setIsSettingsOpen(true);
          }}
          className="absolute flex items-center justify-center p-0 shadow-none select-none transition-none cursor-pointer"
          style={{
            "--unit": "max(0.5625 * 1cqw, 1cqh)",
            backgroundColor: "#f8f5f3",
            color: "#3a2320",
            fontFamily: "ClockFont",
            lineHeight: 1.1,
            paddingLeft: "calc(0.2 * var(--unit))",
            paddingRight: "calc(0.75 * var(--unit))",
            borderRadius: "calc(0.5 * var(--unit))",
            fontWeight: "bold",
            whiteSpace: "bold",
            textAlign: "center",
            fontSize: "calc(2 * var(--unit))",
            zIndex: 20,
            ...clockStylesMapping[541],
          }}
        >
          {currentTime}
        </div>
      </div>

      {/* 音频未允许时的高斯模糊覆盖层和播放按钮 */}
      {!isAudioAllowed && (
        <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/30">
          <button
            onClick={handlePlayButtonClick}
            className="group flex items-center justify-center w-[20%] aspect-square rounded-full bg-black/30 hover:bg-white/30 transition-all duration-200"
            aria-label="播放音频"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-[50%] aspect-square text-white"
            >
              <circle cx="12" cy="13" r="8" />
              <path d="M5 3 2 6" />
              <path d="m22 6-3-3" />
              <path d="M6.38 18.7 4 21" />
              <path d="M17.64 18.67 20 21" />
              <path d="m9 13 2 2 4-4" />
            </svg>
          </button>
        </div>
      )}

      {/* 报时设置面板 */}
      <AlarmSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={(newSettings) => {
          saveSettings(newSettings);
          // 保存后立即检查当前状态
          checkTriggerAlarm();
        }}
      />
    </div>
  );
}
