import { useState, useEffect } from "react";
import { type AlarmSettings } from "../hooks/useAlarmSchedule";

interface AlarmSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AlarmSettings;
  onSave: (settings: AlarmSettings) => void;
}

export function AlarmSettingsPanel({
  isOpen,
  onClose,
  settings,
  onSave,
}: AlarmSettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState<AlarmSettings>(settings);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const updateField = (field: keyof AlarmSettings, value: number | boolean) => {
    setLocalSettings((prev) => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/20">
      <div className="bg-white/80 rounded-xl p-5 w-[90%] max-w-sm shadow-lg">
        <h2 className="text-xl font-semibold mb-5 text-center text-[#3a2320]">
          报时设置
        </h2>

        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <label htmlFor="wholeHourToggle" className="font-medium text-base">
              整点报时
            </label>
            <input
              type="checkbox"
              checked={localSettings.wholeHourAlarmEnabled}
              onChange={(e) =>
                updateField("wholeHourAlarmEnabled", e.target.checked)
              }
              className="w-5 h-5 accent-[#3a2320] cursor-pointer opacity-50"
              id="wholeHourToggle"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="timeRangeToggle"
                className="font-medium text-base"
              >
                时间段闹钟
              </label>
              <input
                type="checkbox"
                checked={localSettings.periodAlarmEnabled}
                onChange={(e) =>
                  updateField("periodAlarmEnabled", e.target.checked)
                }
                className="w-5 h-5 accent-[#3a2320] cursor-pointer opacity-50"
                id="timeRangeToggle"
              />
            </div>

            {localSettings.periodAlarmEnabled && (
              <div className="flex items-center justify-between gap-3 pl-2 mt-3">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-gray-500">开始时间</label>
                  <input
                    type="time"
                    value={`${String(localSettings.startHour).padStart(2, "0")}:${String(localSettings.startMinute).padStart(2, "0")}`}
                    onChange={(e) => {
                      const [h = NaN, m = NaN] = e.target.value
                        .split(":")
                        .map(Number);
                      !Number.isNaN(h) && updateField("startHour", h);
                      !Number.isNaN(m) && updateField("startMinute", m);
                    }}
                    className="w-full p-2 border border-gray-300 rounded text-center cursor-text"
                  />
                </div>
                <span className="text-gray-500 mt-5">至</span>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-gray-500">结束时间</label>
                  <input
                    type="time"
                    value={`${String(localSettings.endHour).padStart(2, "0")}:${String(localSettings.endMinute).padStart(2, "0")}`}
                    onChange={(e) => {
                      const [h = NaN, m = NaN] = e.target.value
                        .split(":")
                        .map(Number);
                      !Number.isNaN(h) && updateField("endHour", h);
                      !Number.isNaN(h) && updateField("endMinute", m);
                    }}
                    className="w-full p-2 border border-gray-300 rounded text-center cursor-text"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full py-3 rounded-lg bg-[#3a2320]/50 text-white hover:bg-[#2c1a18]/80 transition font-medium cursor-pointer"
        >
          确定
        </button>

        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500 space-y-1 text-center">
          <p>
            作者：
            <a
              href="https://github.com/HK-SHAO"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#3a2320] transition"
            >
              HK-SHAO
            </a>
          </p>
          <p>
            仓库：
            <a
              href="https://github.com/HK-SHAO/usagi-clock"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#3a2320] transition"
            >
              HK-SHAO/usagi-clock
            </a>
          </p>
          <p>素材版权归ちいかわ原作者及动画官方所有</p>
        </div>
      </div>
    </div>
  );
}
