import { useState, useEffect, useCallback } from "react";

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

export function useAlarmSchedule() {
  const [settings, setSettings] = useState<AlarmSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [isInAlarmPeriod, setIsInAlarmPeriod] = useState(true);

  const checkIsInAlarmPeriod = useCallback(() => {
    if (!settings.periodAlarmEnabled) return false;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotal = currentHour * 60 + currentMinute;

    const startTotal = settings.startHour * 60 + settings.startMinute;
    const endTotal = settings.endHour * 60 + settings.endMinute;

    if (startTotal <= endTotal) {
      return currentTotal >= startTotal && currentTotal < endTotal;
    } else {
      return currentTotal >= startTotal || currentTotal < endTotal;
    }
  }, [settings]);

  const checkShouldTriggerAlarm = useCallback(() => {
    const now = new Date();
    const currentMinute = now.getMinutes();

    // 优先级1: 时间段闹钟开启且在时间段内，直接触发
    if (settings.periodAlarmEnabled && checkIsInAlarmPeriod()) {
      return true;
    }

    // 优先级2: 整点报时开启且现在是整点
    if (settings.wholeHourAlarmEnabled && currentMinute === 0) {
      return true;
    }

    return false;
  }, [settings, checkIsInAlarmPeriod]);

  const saveSettings = useCallback((newSettings: AlarmSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
  }, []);

  return {
    settings,
    isInAlarmPeriod,
    saveSettings,
    checkIsInAlarmPeriod,
    checkShouldTriggerAlarm,
  };
}
