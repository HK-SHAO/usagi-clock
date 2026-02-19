import { useState, useEffect, useRef, useCallback } from "react";

interface UseDebugControlsProps {
  triggerAlarm: () => void;
  resetToTiktok: () => void;
  currentFrameIndexRef: React.MutableRefObject<number>;
  fullFrameList: number[];
  rafIdRef: React.MutableRefObject<number>;
  animate: (time: number) => void;
  clockRef: React.MutableRefObject<HTMLDivElement | null>;
  frameImgRefs: React.MutableRefObject<Record<number, HTMLImageElement | null>>;
  currentFrameRef: React.MutableRefObject<number | null>;
}

export function useDebugControls({
  triggerAlarm,
  resetToTiktok,
  currentFrameIndexRef,
  fullFrameList,
  rafIdRef,
  animate,
  clockRef,
  frameImgRefs,
  currentFrameRef,
}: UseDebugControlsProps) {
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [_forceUpdate, setForceUpdate] = useState(0);
  const forceUpdate = useCallback(() => setForceUpdate((prev) => prev + 1), []);

  // 切换debug模式
  const toggleDebug = useCallback(() => {
    setDebugEnabled((prev) => {
      const newState = !prev;
      console.log(`Debug模式已${newState ? "开启" : "关闭"}`);
      return newState;
    });
  }, []);

  // 暂停/继续动画
  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const newState = !prev;
      if (newState) {
        cancelAnimationFrame(rafIdRef.current);
        console.log("Debug: 动画已暂停");
      } else {
        rafIdRef.current = requestAnimationFrame(animate);
        console.log("Debug: 动画已恢复");
      }
      return newState;
    });
  }, [rafIdRef, animate]);

  // 手动更新当前帧显示
  const updateFrameDisplay = useCallback(() => {
    const currentFrame = fullFrameList[currentFrameIndexRef.current];
    if (!currentFrame) return;

    // 隐藏上一帧
    if (
      currentFrameRef.current &&
      frameImgRefs.current[currentFrameRef.current]
    ) {
      frameImgRefs.current[currentFrameRef.current]!.style.visibility =
        "hidden";
    }
    // 显示当前帧
    if (frameImgRefs.current[currentFrame]) {
      frameImgRefs.current[currentFrame]!.style.visibility = "visible";
    }
    currentFrameRef.current = currentFrame;
    forceUpdate();
  }, [
    fullFrameList,
    currentFrameIndexRef,
    currentFrameRef,
    frameImgRefs,
    forceUpdate,
  ]);

  // 上一帧
  const prevFrame = useCallback(() => {
    if (!debugEnabled) return;
    if (!isPaused) togglePause();
    currentFrameIndexRef.current = Math.max(
      0,
      currentFrameIndexRef.current - 1,
    );
    updateFrameDisplay();
    console.log(
      `Debug: 切换到上一帧，索引: ${currentFrameIndexRef.current}, 帧号: ${fullFrameList[currentFrameIndexRef.current]}`,
    );
  }, [
    debugEnabled,
    isPaused,
    togglePause,
    currentFrameIndexRef,
    fullFrameList,
    updateFrameDisplay,
  ]);

  // 下一帧
  const nextFrame = useCallback(() => {
    if (!debugEnabled) return;
    if (!isPaused) togglePause();
    currentFrameIndexRef.current = Math.min(
      fullFrameList.length - 1,
      currentFrameIndexRef.current + 1,
    );
    updateFrameDisplay();
    console.log(
      `Debug: 切换到下一帧，索引: ${currentFrameIndexRef.current}, 帧号: ${fullFrameList[currentFrameIndexRef.current]}`,
    );
  }, [
    debugEnabled,
    isPaused,
    togglePause,
    currentFrameIndexRef,
    fullFrameList,
    updateFrameDisplay,
  ]);

  // 键盘事件监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // 切换debug模式
      if (key === "d") {
        toggleDebug();
      }

      if (!debugEnabled) return;

      switch (key) {
        case "a":
          console.log("Debug: 手动触发alarm");
          triggerAlarm();
          break;
        case "r":
          resetToTiktok();
          break;
        case "arrowleft":
          e.preventDefault();
          prevFrame();
          break;
        case "arrowright":
          e.preventDefault();
          nextFrame();
          break;
        case " ":
          e.preventDefault();
          togglePause();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    debugEnabled,
    toggleDebug,
    triggerAlarm,
    resetToTiktok,
    prevFrame,
    nextFrame,
    togglePause,
  ]);

  // 鼠标移动事件监听
  useEffect(() => {
    if (!debugEnabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!clockRef.current) return;
      const rect = clockRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setMousePos({
        x: Math.round(e.clientX - centerX),
        y: Math.round(e.clientY - centerY),
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [debugEnabled, clockRef]);

  // 定时更新debug面板，实时显示帧率
  useEffect(() => {
    if (!debugEnabled || isPaused) return;
    const interval = setInterval(() => {
      forceUpdate();
    }, 500);
    return () => clearInterval(interval);
  }, [debugEnabled, isPaused, forceUpdate]);

  // Debug UI元素
  const DebugUI = debugEnabled ? (
    <div className="fixed top-2 left-2 z-50 bg-black/80 text-white text-xs p-2 rounded font-mono pointer-events-none">
      <div>
        帧号: {fullFrameList[currentFrameIndexRef.current]} (索引:{" "}
        {currentFrameIndexRef.current})
      </div>
      <div>
        鼠标坐标: X:{mousePos.x} Y:{mousePos.y}
      </div>
      <div>状态: {isPaused ? "已暂停" : "播放中"}</div>
      <div className="mt-1 text-xs opacity-70">
        快捷键: ←/→ 切换帧, 空格 暂停/播放, A 触发alarm, R 重置, D 关闭debug
      </div>
    </div>
  ) : null;

  return { debugEnabled, DebugUI };
}
