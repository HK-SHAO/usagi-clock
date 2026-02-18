import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { frames as frameNumbers, frameRate } from "../config";
import { getFramePath } from "../utils/get-frame-path";

export function ImagePlayer() {
  const startFrame = frameNumbers[0]!;
  const endFrame = frameNumbers.at(-1)!;
  const totalFrames = endFrame - startFrame + 1;
  const frameInterval = 1000 / frameRate;

  const fullFrameList = useMemo(() => {
    const list: number[] = [];
    let currentFrame = frameNumbers[0]!;
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

  const [isPortrait, setIsPortrait] = useState(
    window.innerWidth < window.innerHeight,
  );
  const currentFrameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const [currentDisplayFrame, setCurrentDisplayFrame] = useState(
    fullFrameList[0]!,
  );

  useEffect(() => {
    frameNumbers.forEach((frame) => {
      const img = new Image();
      const path = getFramePath(frame);
      if (path) img.src = path;
    });
  }, [frameNumbers]);

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerWidth < window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const rafId = useRef(0);
  const animate = useCallback(
    (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;

      if (delta >= frameInterval) {
        currentFrameRef.current = (currentFrameRef.current + 1) % totalFrames;
        setCurrentDisplayFrame(fullFrameList[currentFrameRef.current]!);
        lastTimeRef.current = time - (delta % frameInterval);
      }

      rafId.current = requestAnimationFrame(animate);
    },
    [totalFrames, frameInterval, fullFrameList],
  );

  useEffect(() => {
    rafId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId.current);
  }, [animate]);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      <div
        className={`absolute bg-cover bg-center bg-no-repeat transition-none ${
          isPortrait
            ? "rotate-90 w-[100vh] h-[100vw] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            : "w-full h-full inset-0"
        }`}
        style={{
          backgroundImage: `url(${getFramePath(currentDisplayFrame)})`,
        }}
      />
    </div>
  );
}
