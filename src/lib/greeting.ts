/**
 * 时段问候（PRD 4.2）
 * 5-9 早安 / 9-12 上午好 / 12-14 午安 / 14-18 下午好 / 18-23 晚上好 / 23-5 夜深了
 * 边界：左闭右开，23:00 起至次日 05:00 为「夜深了」。
 */
export type GreetingKey = "early" | "morning" | "noon" | "afternoon" | "evening" | "late";

export const GREETINGS: Record<GreetingKey, string> = {
  early: "早安",
  morning: "上午好",
  noon: "午安",
  afternoon: "下午好",
  evening: "晚上好",
  late: "夜深了",
};

export function greetingKeyAt(date: Date): GreetingKey {
  const h = date.getHours();
  if (h >= 5 && h < 9) return "early";
  if (h >= 9 && h < 12) return "morning";
  if (h >= 12 && h < 14) return "noon";
  if (h >= 14 && h < 18) return "afternoon";
  if (h >= 18 && h < 23) return "evening";
  return "late";
}

export function greetingAt(date: Date, custom = ""): string {
  const text = custom.trim();
  if (text) return text;
  return GREETINGS[greetingKeyAt(date)];
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function weekdayOf(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

/** 日期显示「周几 · 月日」（PRD 4.2） */
export function dateLabelOf(date: Date): string {
  return `${weekdayOf(date)} · ${date.getMonth() + 1}月${date.getDate()}日`;
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function clockParts(date: Date): { hh: string; mm: string; ss: string } {
  return {
    hh: pad2(date.getHours()),
    mm: pad2(date.getMinutes()),
    ss: pad2(date.getSeconds()),
  };
}
