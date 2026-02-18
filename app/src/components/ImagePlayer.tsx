import { useEffect, useRef, useMemo, useCallback } from "react";
import {
  frames as frameNumbers,
  frameRate,
  tiktokLoopFrame,
  alarmFrame,
  alarmLoopFrame,
} from "../config";
import { getFramePath } from "../utils/get-frame-path";
import { ulaTiktokURL, ulaAlarmURL, ulaAlarmLoopURL } from "../audios";

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
  // 音频引用
  const tiktokAudioRef = useRef<HTMLAudioElement | null>(null);
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const alarmLoopAudioRef = useRef<HTMLAudioElement | null>(null);
  // 横竖屏状态
  const isPortraitRef = useRef(window.innerWidth < window.innerHeight);

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

  // 去重后的帧列表
  const uniqueFrames = useMemo(() => Array.from(new Set(fullFrameList)), [fullFrameList]);

  /**
   * 预加载所有图片帧: 利用浏览器空闲时间加载, 不阻塞主线程
   * 提前缓存到内存, 避免播放过程中出现卡顿
   */
  useEffect(() => {
    let loadedCount = 0;

    const preloadImages = () => {
      uniqueFrames.forEach((frame) => {
        const path = getFramePath(frame);
        if (!path) return;

        const img = new Image();
        img.src = path;
        img.onload = () => {
          loadedCount++;
          // 全部加载完成后可以触发首屏渲染优化
          if (loadedCount === uniqueFrames.length) {
            console.log("所有帧图片预加载完成");
          }
        };
      });
    };

    // 浏览器空闲时预加载
    if ("requestIdleCallback" in window) {
      requestIdleCallback(preloadImages);
    } else {
      // 降级方案: 延迟1秒加载
      setTimeout(preloadImages, 1000);
    }
  }, [fullFrameList]);

  /**
   * 初始化音频对象
   */
  useEffect(() => {
    // 初始化滴答音频
    tiktokAudioRef.current = new Audio(ulaTiktokURL);
    // 初始化报时音频
    alarmAudioRef.current = new Audio(ulaAlarmURL);
    // 初始化报时循环音频
    alarmLoopAudioRef.current = new Audio(ulaAlarmLoopURL);
    alarmLoopAudioRef.current.loop = true;

    // 用户交互后才能播放音频(浏览器策略限制)
    const playOnInteraction = async () => {
      try {
        await tiktokAudioRef.current?.load();
        await alarmAudioRef.current?.load();
        await alarmLoopAudioRef.current?.load();
      } catch {}
      document.removeEventListener("click", playOnInteraction);
      document.removeEventListener("touchstart", playOnInteraction);
    };

    document.addEventListener("click", playOnInteraction);
    document.addEventListener("touchstart", playOnInteraction);

    // 销毁时释放音频资源
    return () => {
      tiktokAudioRef.current?.pause();
      tiktokAudioRef.current = null;
      alarmAudioRef.current?.pause();
      alarmAudioRef.current = null;
      alarmLoopAudioRef.current?.pause();
      alarmLoopAudioRef.current = null;
    };
  }, []);

  /**
   * 防抖处理横竖屏切换
   */
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let resizeTimer: number | null = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        isPortraitRef.current = window.innerWidth < window.innerHeight;
        if (containerRef.current) {
          // 直接操作dom更新类名, 不触发组件重渲染
          if (isPortraitRef.current) {
            containerRef.current.className =
              "absolute rotate-90 w-[100vh] h-[100vw] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-none will-change-transform";
          } else {
            containerRef.current.className =
              "absolute w-full h-full inset-0 transition-none will-change-transform";
          }
        }
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, []);

  /**
   * 播放滴答音频: 精准每2秒播放一次
   */
  const playTiktokAudio = useCallback((currentTime: number) => {
    if (currentTime - lastTiktokAudioTimeRef.current >= tiktokAudioInterval) {
      if (tiktokAudioRef.current) {
        tiktokAudioRef.current.currentTime = 0;
        tiktokAudioRef.current.play().catch(() => {});
      }
      lastTiktokAudioTimeRef.current = currentTime;
    }
  }, []);

  /**
   * 状态机逻辑: 处理不同状态下的帧计算
   */
  const getNextFrameIndex = useCallback(
    (currentIndex: number) => {
      const state = playerStateRef.current;

      switch (state) {
        case PlayerState.TIKTOK:
          // 滴答状态: 在tiktokLoopFrame区间内乒乓循环
          const tiktokStart = fullFrameList.findIndex(
            (f) => f === tiktokLoopFrame.l,
          );
          const tiktokEnd = fullFrameList.findIndex(
            (f) => f === tiktokLoopFrame.r,
          );

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
            // 切换到报时循环音频
            alarmAudioRef.current?.pause();
            alarmLoopAudioRef.current?.play().catch(() => {});
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
              alarmLoopAudioRef.current?.pause();
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
        // 计算下一帧索引
        const nextFrameIndex = getNextFrameIndex(currentFrameIndexRef.current);
        currentFrameIndexRef.current = nextFrameIndex;

        // 切换帧显示状态，仅修改visibility，无重绘闪烁
        const nextFrame = fullFrameList[nextFrameIndex]!;
        if (currentFrameRef.current !== nextFrame) {
          // 隐藏上一帧
          if (currentFrameRef.current && frameImgRefs.current[currentFrameRef.current]) {
            frameImgRefs.current[currentFrameRef.current]!.style.visibility = 'hidden';
          }
          // 显示当前帧
          if (frameImgRefs.current[nextFrame]) {
            frameImgRefs.current[nextFrame]!.style.visibility = 'visible';
          }
          currentFrameRef.current = nextFrame;
        }

        // 滴答状态下播放音频
        if (playerStateRef.current === PlayerState.TIKTOK) {
          playTiktokAudio(time);
        }

        // 修正时间偏差, 避免累计误差导致掉帧
        lastFrameTimeRef.current = time - (delta % frameInterval);
      }

      // 继续下一帧
      rafIdRef.current = requestAnimationFrame(animate);
    },
    [frameInterval, fullFrameList, getNextFrameIndex, playTiktokAudio],
  );

  /**
   * 启动/停止动画循环
   */
  useEffect(() => {
    // 初始帧定位到滴答循环起始帧
    const initialIndex = fullFrameList.findIndex(
      (f) => f === tiktokLoopFrame.l,
    );
    currentFrameIndexRef.current = initialIndex >= 0 ? initialIndex : 0;

    // 启动动画
    rafIdRef.current = requestAnimationFrame(animate);

    // 组件销毁时停止动画
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [animate, fullFrameList]);

  /**
   * 暴露整点报时触发方法(可以通过ref调用)
   * 这里预留外部调用入口
   */
  const triggerAlarm = useCallback(() => {
    if (playerStateRef.current !== PlayerState.TIKTOK) return;
    playerStateRef.current = PlayerState.ALARM;
    // 跳转到报时起始帧
    const alarmStartIndex = fullFrameList.findIndex((f) => f === alarmFrame);
    currentFrameIndexRef.current =
      alarmStartIndex >= 0 ? alarmStartIndex : currentFrameIndexRef.current;
    // 播放报时音频
    alarmAudioRef.current?.play().catch(() => {});
  }, [fullFrameList]);

  // 首屏直接渲染, 后续更新仅切换visibility, 无重绘闪烁
  const initialFrame = fullFrameList[currentFrameIndexRef.current]!;
  currentFrameRef.current = initialFrame;

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      <div
        ref={containerRef}
        className={`absolute transition-none will-change-transform ${
          isPortraitRef.current
            ? "rotate-90 w-[100vh] h-[100vw] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            : "w-full h-full inset-0"
        }`}
      >
        {uniqueFrames.map((frame) => (
          <img
          key={frame}
          ref={(el) => frameImgRefs.current[frame] = el}
          src={getFramePath(frame)}
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{
            visibility: frame === initialFrame ? 'visible' : 'hidden',
            transition: 'none'
          }}
          alt=""
          decoding="sync"
        />
        ))}
      </div>
    </div>
  );
}
