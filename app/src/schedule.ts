import { loadCloudSettings, saveCloudSettings } from "./toy";

export interface AlarmSettings {
  periodAlarmEnabled: boolean;
  wholeHourAlarmEnabled: boolean;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

const DEFAULT_SETTINGS: AlarmSettings = {
  periodAlarmEnabled: false,
  wholeHourAlarmEnabled: true,
  startHour: 0,
  startMinute: 0,
  endHour: 23,
  endMinute: 59,
};

const STORAGE_KEY = "usagi-clock-alarm-settings";

/** 闹钟调度：整点报时 + 时间段闹钟，localStorage + Toy 云存储双写 */
export class AlarmSchedule {
  settings: AlarmSettings;

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.settings = saved
      ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
      : { ...DEFAULT_SETTINGS };
  }

  /** 挂载后拉取 Toy 云存储设置（跟随登录态跨设备），命中则覆盖本地 */
  async load(): Promise<void> {
    const cloud = await loadCloudSettings<Partial<AlarmSettings>>();
    if (!cloud) return;
    const merged = { ...DEFAULT_SETTINGS, ...cloud };
    this.settings = merged;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }

  /** 保存设置到 localStorage + Toy 云 */
  save(newSettings: AlarmSettings): void {
    this.settings = newSettings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    void saveCloudSettings(newSettings);
  }

  /** 当前是否处于闹钟时间段内 */
  private isInAlarmPeriod(): boolean {
    const s = this.settings;
    if (!s.periodAlarmEnabled) return false;

    const now = new Date();
    const currentTotal = now.getHours() * 60 + now.getMinutes();
    const startTotal = s.startHour * 60 + s.startMinute;
    const endTotal = s.endHour * 60 + s.endMinute;

    if (startTotal <= endTotal) {
      return currentTotal >= startTotal && currentTotal < endTotal;
    } else {
      return currentTotal >= startTotal || currentTotal < endTotal;
    }
  }

  /** 判断当前是否应触发闹钟 */
  shouldTriggerAlarm(): boolean {
    const now = new Date();

    // 优先级1: 时间段闹钟开启且在时间段内
    if (this.settings.periodAlarmEnabled && this.isInAlarmPeriod()) {
      return true;
    }

    // 优先级2: 整点报时开启且现在是整点
    if (this.settings.wholeHourAlarmEnabled && now.getMinutes() === 0) {
      return true;
    }

    return false;
  }
}
