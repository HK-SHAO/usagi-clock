// 根据帧序号获取图片 URL（相对当前 HOST 的路径），若没有则返回 undefined
export function getFramePath(frame: number): string | undefined {
  // 使用动态导入方式获取帧路径
  try {
    // 尝试从 frames 模块获取
    const framesModule = require("@/frames");
    const path = (framesModule as Record<string, string>)[`f${frame}`];
    if (path) return path;
  } catch {
    // 如果模块加载失败，使用备用路径
  }
  
  // 备用：根据项目结构构造路径
  return `/src/assets/frames/f${frame}.jpg`;
}
