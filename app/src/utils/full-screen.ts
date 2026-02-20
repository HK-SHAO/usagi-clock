// 扩展类型支持各浏览器前缀全屏API
declare global {
  interface Document {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void>;
    mozCancelFullScreen?: () => Promise<void>;
    msExitFullscreen?: () => Promise<void>;
  }
  interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
    mozRequestFullScreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
    webkitEnterFullscreen?: () => void;
  }
}

// 获取当前全屏元素（兼容所有浏览器前缀）
export function getFullscreenElement() {
  return (
    document.fullscreenElement ??
    document.webkitFullscreenElement ??
    document.mozFullScreenElement ??
    document.msFullscreenElement ??
    null
  );
}

// 请求全屏（兼容所有浏览器前缀）
export function requestFullscreen(element: HTMLElement) {
  if (element.requestFullscreen) {
    return element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) {
    return element.webkitRequestFullscreen();
  } else if (element.mozRequestFullScreen) {
    return element.mozRequestFullScreen();
  } else if (element.msRequestFullscreen) {
    return element.msRequestFullscreen();
  } else if (element.webkitEnterFullscreen) {
    // iOS Safari 特殊兼容
    element.webkitEnterFullscreen();
    return Promise.resolve();
  }
  return Promise.reject(new Error("Fullscreen API not supported"));
}

// 退出全屏（兼容所有浏览器前缀）
export function exitFullscreen() {
  if (document.exitFullscreen) {
    return document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    return document.webkitExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    return document.mozCancelFullScreen();
  } else if (document.msExitFullscreen) {
    return document.msExitFullscreen();
  }
  return Promise.reject(new Error("Fullscreen API not supported"));
}
