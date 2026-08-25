import { el } from "./utils/dom";

const VOLUME_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>`;

const GEAR_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>`;

export interface WelcomeItem {
  /** 静态 SVG 字符串（无用户输入，安全） */
  icon: string;
  text: string;
}

/**
 * 欢迎弹窗（iOS Alert / Material AlertDialog 风格）：
 * 融合「开启声音」与「点击时钟」两项引导，仅能通过按钮手动关闭。
 * 自包含 DOM 与显隐状态，按钮点击后触发 onDismiss 回调。
 */
export class WelcomeModal {
  private readonly overlay: HTMLElement;
  private readonly onDismiss: () => void;

  constructor(container: HTMLElement, items: WelcomeItem[], onDismiss: () => void) {
    this.onDismiss = onDismiss;

    this.overlay = el("div", "welcome-overlay");
    const card = el("div", "welcome-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", "欢迎使用时钟");

    card.appendChild(el("h2", "welcome-title", "开启声音与更多功能"));

    const list = el("ul", "welcome-items");
    for (const item of items) {
      const li = el("li", "welcome-item");
      li.insertAdjacentHTML("beforeend", item.icon);
      li.appendChild(el("span", "", item.text));
      list.appendChild(li);
    }
    card.appendChild(list);

    const cta = el("button", "welcome-cta", "知道了");
    cta.addEventListener("click", () => {
      this.hide();
      this.onDismiss();
    });
    card.appendChild(cta);

    this.overlay.appendChild(card);
    container.appendChild(this.overlay);
  }

  show(): void {
    this.overlay.classList.add("open");
  }

  hide(): void {
    this.overlay.classList.remove("open");
  }

  dispose(): void {
    this.overlay.remove();
  }
}

/** 预设项：开启声音 + 点击时钟（静态导出，便于 main.ts 组装） */
export const WELCOME_ITEMS: WelcomeItem[] = [
  { icon: VOLUME_ICON, text: "点击任意位置开启声音" },
  { icon: GEAR_ICON, text: "点击乌萨奇手中的时钟查看更多功能" },
];
