import * as frames from "../frames";

// 根据帧序号获取图片 URL（相对当前 HOST 的路径），若没有则返回 undefined
export function getFramePath(frame: number): string | undefined {
  return (frames as Record<string, string>)[`f${frame}`];
}
