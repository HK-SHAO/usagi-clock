// Toy SDK 辅助函数：SDK 缺失、未登录或环境不支持时一律静默降级，不阻塞本地体验

export const AUTHOR_MID = "24046148";

const SETTINGS_KEY = "alarm-settings";
const CHECKIN_DAYS_KEY = "checkin-days";
const CHECKIN_LAST_KEY = "checkin-last";

export function hasToy(): boolean {
  return typeof window !== "undefined" && typeof window.toy !== "undefined";
}

export async function loadCloudSettings<T>(): Promise<T | null> {
  if (!hasToy()) return null;
  try {
    const data = await window.toy.getCloudStorage([SETTINGS_KEY]);
    const raw = data[SETTINGS_KEY];
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function saveCloudSettings<T>(settings: T): Promise<void> {
  if (!hasToy()) return;
  try {
    await window.toy.setCloudStorage({
      [SETTINGS_KEY]: JSON.stringify(settings),
    });
  } catch {
    // 云存储失败（未登录等）不影响本地保存
  }
}

export type FollowState = "unknown" | "following" | "locked" | "unavailable";

export async function fetchFollowState(): Promise<FollowState> {
  if (!hasToy()) return "unavailable";
  try {
    const res = await window.toy.getAuthorRelation();
    if (res.status === "ok" && res.data) {
      return res.data.isFollowing || res.data.isAuthor ? "following" : "locked";
    }
    return "locked";
  } catch {
    return "unavailable";
  }
}

// 需用户手势触发：跳转作者空间页引导关注
export function openAuthorSpace(): void {
  if (!hasToy()) return;
  window.toy
    .navigate({ type: "space", id: AUTHOR_MID })
    .catch(() => {});
}

function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// 每日首次打开打卡：连续天数写入云存储并上报排行榜（board 1 = 陪伴榜）
export async function checkin(): Promise<void> {
  if (!hasToy()) return;
  try {
    const data = await window.toy.getCloudStorage([
      CHECKIN_DAYS_KEY,
      CHECKIN_LAST_KEY,
    ]);
    const today = localDateStr(new Date());
    const last = data[CHECKIN_LAST_KEY];
    if (last === today) return;

    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    const prevDays = parseInt(data[CHECKIN_DAYS_KEY] ?? "0", 10) || 0;
    const days = last === yesterday ? prevDays + 1 : 1;

    await window.toy.setCloudStorage({
      [CHECKIN_DAYS_KEY]: String(days),
      [CHECKIN_LAST_KEY]: today,
    });
    await window.toy.submitScore({ board: 1, score: days });
  } catch {
    // 未登录等场景静默跳过
  }
}

export interface RankData {
  list: ToySDK.RankItem[];
  mine: ToySDK.MyRankResp | null;
}

export async function fetchRank(): Promise<RankData> {
  if (!hasToy()) return { list: [], mine: null };
  const [list, mine] = await Promise.all([
    window.toy.getRankList({ board: 1, limit: 5 }).catch(() => []),
    window.toy.getMyRank({ board: 1 }).catch(() => null),
  ]);
  return { list, mine };
}
