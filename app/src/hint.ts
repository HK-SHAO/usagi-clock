/** 轻提示 toast：引导点击时钟等一次性文案提示（自包含 DOM，可复用） */

const GEAR_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>`;

/**
 * 轻提示（toast / snackbar 风格）：底部胶囊浮层，显示一段时间后自动隐藏。
 * 组件自包含 DOM 与状态，仅暴露 show/hide，便于各场景复用。
 */
export class TapHint {
  private readonly el: HTMLElement;
  private hideTimer = 0;

  constructor(text: string, container: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "hint tap-hint";
    this.el.setAttribute("role", "status");
    this.el.insertAdjacentHTML("beforeend", GEAR_ICON);
    const label = document.createElement("span");
    label.textContent = text;
    this.el.appendChild(label);
    container.appendChild(this.el);
  }

  /** 显示提示，durationMs 后自动隐藏；重复调用会重置计时 */
  show(durationMs = 4000): void {
    window.clearTimeout(this.hideTimer);
    this.el.classList.add("show");
    this.hideTimer = window.setTimeout(() => {
      this.el.classList.remove("show");
    }, durationMs);
  }

  /** 立即隐藏 */
  hide(): void {
    window.clearTimeout(this.hideTimer);
    this.el.classList.remove("show");
  }

  /** 移除节点 */
  dispose(): void {
    this.hide();
    this.el.remove();
  }
}
