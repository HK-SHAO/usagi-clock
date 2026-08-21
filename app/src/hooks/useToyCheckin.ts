import { useEffect } from "react";
import { checkin } from "../utils/toy";

// 每日首次打开打卡：连续天数入云存储并上报陪伴榜
export function useToyCheckin() {
  useEffect(() => {
    void checkin();
  }, []);
}
