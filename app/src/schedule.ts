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

/** 读本地设置；数据损坏时降级默认值，不阻塞启动 */
function readLocalSettings(): AlarmSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 写本地设置；隐私模式 / 配额满时静默降级，仅内存生效 */
function writeLocalSettings(settings: AlarmSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 忽略写入失败
  }
}

/** 闹钟调度：整点报时 + 时间段闹钟，localStorage + Toy 云存储双写 */
export class AlarmSchedule {
  settings: AlarmSettings;

  /** 是否已处于当前闹钟时段内（时段内只响一次，避免循环） */
  private inPeriod = false;
  /** 上次整点报时的分钟（去重） */
  private lastWholeMinute = -1;

  constructor() {
    this.settings = readLocalSettings();
  }

  /** 挂载后拉取 Toy 云存储设置（跟随登录态跨设备），命中则覆盖本地 */
  async load(): Promise<void> {
    const cloud = await loadCloudSettings<Partial<AlarmSettings>>();
    if (!cloud) return;
    const merged = { ...DEFAULT_SETTINGS, ...cloud };
    this.settings = merged;
    writeLocalSettings(merged);
  }

  /** 保存设置到 localStorage + Toy 云 */
  save(newSettings: AlarmSettings): void {
    this.settings = newSettings;
    writeLocalSettings(newSettings);
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

  /** 判断当前是否应触发闹钟（时段内仅进入时触发一次；整点报时每整点一次） */
  shouldTriggerAlarm(): boolean {
    const now = new Date();
    const minute = now.getHours() * 60 + now.getMinutes();

    let trigger = false;

    // 时间段闹钟：进入时段的当分钟触发一次，时段内不重复
    if (this.settings.periodAlarmEnabled && this.isInAlarmPeriod()) {
      if (!this.inPeriod) trigger = true;
      this.inPeriod = true;
    } else {
      this.inPeriod = false;
    }

    // 整点报时：每个整点触发一次（同分钟去重，防重复调用）
    if (
      this.settings.wholeHourAlarmEnabled &&
      now.getMinutes() === 0 &&
      this.lastWholeMinute !== minute
    ) {
      this.lastWholeMinute = minute;
      trigger = true;
    }

    return trigger;
  }
}
