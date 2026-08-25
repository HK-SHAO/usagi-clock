import type { AlarmSettings } from "./schedule";
import { fetchFollowState, fetchRank, openAuthorSpace, type FollowState, type RankData } from "./toy";
import { el } from "./utils/dom";

/**
 * 报时设置面板（纯 DOM 操作）
 *
 * 包含：整点报时开关、时间段闹钟（关注解锁）、时间选择器、陪伴榜、版权信息
 */
export class SettingsPanel {
  private readonly overlay: HTMLElement;
  private readonly panel: HTMLElement;
  private onSave: ((s: AlarmSettings) => void) | null = null;
  private local: AlarmSettings | null = null;
  private followState: FollowState = "unknown";
  private rank: RankData = { list: [], mine: null };
  private cleanupFns: (() => void)[] = [];

  constructor(container: HTMLElement) {
    // 遮罩层
    this.overlay = el("div", "settings-overlay");
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });

    // 面板主体
    this.panel = el("div", "settings-panel");
    this.overlay.appendChild(this.panel);
    container.appendChild(this.overlay);
  }

  /** 打开面板 */
  open(settings: AlarmSettings, onSave: (s: AlarmSettings) => void): void {
    this.local = { ...settings };
    this.onSave = onSave;
    this.render();
    this.overlay.classList.add("open");

    // 拉取关注关系与榜单（合并为一次渲染）
    const refresh = () => {
      void Promise.all([fetchFollowState(), fetchRank()]).then(([s, r]) => {
        this.followState = s;
        this.rank = r;
        this.render();
      });
    };
    refresh();

    // 窗口获得焦点 / 可见性变化时刷新
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    this.cleanupFns.push(
      () => window.removeEventListener("focus", refresh),
      () => document.removeEventListener("visibilitychange", refresh),
    );
  }

  /** 关闭面板 */
  close(): void {
    this.overlay.classList.remove("open");
    this.onSave = null;
    this.local = null;
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns.length = 0;
  }

  /** 清空面板子节点（安全方式，不用 innerHTML） */
  private clearPanel(): void {
    while (this.panel.firstChild) this.panel.removeChild(this.panel.firstChild);
  }

  /** 渲染面板内容 */
  private render(): void {
    const s = this.local;
    if (!s) return;

    const locked = this.followState === "locked";
    this.clearPanel();

    // 标题
    this.panel.appendChild(el("h2", "settings-title", "报时设置"));

    // ── 整点报时 ──
    const wholeRow = el("div", "settings-row");
    wholeRow.appendChild(el("label", "settings-label", "整点报时"));
    const wholeToggle = el("input", "settings-toggle");
    wholeToggle.type = "checkbox";
    wholeToggle.checked = s.wholeHourAlarmEnabled;
    wholeToggle.addEventListener("change", () => {
      s.wholeHourAlarmEnabled = wholeToggle.checked;
    });
    wholeRow.appendChild(wholeToggle);
    this.panel.appendChild(wholeRow);

    // ── 时间段闹钟 ──
    const periodSection = el("div", "settings-section");
    const periodRow = el("div", "settings-row");
    periodRow.appendChild(el("label", "settings-label", "时间段闹钟"));

    if (locked) {
      const unlockBtn = el("button", "settings-unlock-btn", "关注作者解锁");
      unlockBtn.addEventListener("click", openAuthorSpace);
      periodRow.appendChild(unlockBtn);
    } else {
      const periodToggle = el("input", "settings-toggle");
      periodToggle.type = "checkbox";
      periodToggle.checked = s.periodAlarmEnabled;
      periodToggle.disabled = this.followState === "unknown";
      periodToggle.addEventListener("change", () => {
        s.periodAlarmEnabled = periodToggle.checked;
        this.render();
      });
      periodRow.appendChild(periodToggle);
    }
    periodSection.appendChild(periodRow);

    // 时间选择器
    if (s.periodAlarmEnabled && !locked) {
      const timeRow = el("div", "settings-time-row");

      // 开始时间
      const startGroup = el("div", "settings-time-group");
      startGroup.appendChild(el("label", "settings-time-label", "开始时间"));
      const startInput = el("input", "settings-time-input") as HTMLInputElement;
      startInput.type = "time";
      startInput.value = this.pad2(s.startHour) + ":" + this.pad2(s.startMinute);
      startInput.addEventListener("change", () => {
        const [h, m] = startInput.value.split(":").map(Number);
        if (h != null && !Number.isNaN(h)) s.startHour = h;
        if (m != null && !Number.isNaN(m)) s.startMinute = m;
      });
      startGroup.appendChild(startInput);
      timeRow.appendChild(startGroup);

      timeRow.appendChild(el("span", "settings-time-sep", "至"));

      // 结束时间
      const endGroup = el("div", "settings-time-group");
      endGroup.appendChild(el("label", "settings-time-label", "结束时间"));
      const endInput = el("input", "settings-time-input") as HTMLInputElement;
      endInput.type = "time";
      endInput.value = this.pad2(s.endHour) + ":" + this.pad2(s.endMinute);
      endInput.addEventListener("change", () => {
        const [h, m] = endInput.value.split(":").map(Number);
        if (h != null && !Number.isNaN(h)) s.endHour = h;
        if (m != null && !Number.isNaN(m)) s.endMinute = m;
      });
      endGroup.appendChild(endInput);
      timeRow.appendChild(endGroup);

      periodSection.appendChild(timeRow);
    }
    this.panel.appendChild(periodSection);

    // ── 确定按钮 ──
    const saveBtn = el("button", "settings-save-btn", "确定");
    saveBtn.addEventListener("click", () => {
      this.onSave?.(s);
      this.close();
    });
    this.panel.appendChild(saveBtn);

    // ── 陪伴榜 ──
    if (this.rank.list.length > 0) {
      const rankSection = el("div", "settings-rank-section");
      rankSection.appendChild(el("p", "settings-rank-title", "陪伴榜 · 连续打卡天数"));

      const list = el("ul", "settings-rank-list");
      for (const item of this.rank.list) {
        const li = el("li", "settings-rank-item");
        li.appendChild(el("span", "rank-num", String(item.rank)));
        const avatar = el("img", "rank-avatar");
        avatar.src = item.avatar;
        avatar.alt = "";
        li.appendChild(avatar);
        li.appendChild(el("span", "rank-name", item.nickname));
        li.appendChild(el("span", "rank-score", `${item.score}天`));
        list.appendChild(li);
      }
      rankSection.appendChild(list);

      if (this.rank.mine) {
        const mineText = this.rank.mine.ranked
          ? `我的排名：第 ${this.rank.mine.rank} 名 · ${this.rank.mine.score}天`
          : "我暂未上榜，明天继续打卡吧";
        rankSection.appendChild(el("p", "settings-rank-mine", mineText));
      }
      this.panel.appendChild(rankSection);
    }

    // ── 版权信息 ──
    const footer = el("div", "settings-footer");
    footer.appendChild(el("p", "", "HK-SHAO · usagi-clock"));
    footer.appendChild(el("p", "", "素材版权归ちいかわ原作者及动画官方所有"));
    this.panel.appendChild(footer);
  }

  private pad2(n: number): string {
    return String(n).padStart(2, "0");
  }
}
