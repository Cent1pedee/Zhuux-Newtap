import { describe, expect, it } from "vitest";
import { clockParts, dateLabelOf, greetingAt, greetingKeyAt, pad2, weekdayOf } from "@/lib/greeting";

/** 构造本地时间（避免时区干扰） */
function at(hour: number, minute = 0, day = 15): Date {
  return new Date(2026, 0, day, hour, minute, 0, 0);
}

describe("greetingKeyAt：时段边界左闭右开", () => {
  it.each([
    [5, "early"],
    [8, "early"],
    [9, "morning"],
    [11, "morning"],
    [12, "noon"],
    [13, "noon"],
    [14, "afternoon"],
    [17, "afternoon"],
    [18, "evening"],
    [22, "evening"],
    [23, "late"],
  ])("%i 点 → %s", (hour, key) => {
    expect(greetingKeyAt(at(hour))).toBe(key);
  });

  it("凌晨 0-4 点为夜深了", () => {
    for (const h of [0, 1, 2, 3, 4]) expect(greetingKeyAt(at(h))).toBe("late");
  });
});

describe("greetingAt", () => {
  it("按时间返回中文问候", () => {
    expect(greetingAt(at(7))).toBe("早安");
    expect(greetingAt(at(10))).toBe("上午好");
    expect(greetingAt(at(12))).toBe("午安");
    expect(greetingAt(at(15))).toBe("下午好");
    expect(greetingAt(at(20))).toBe("晚上好");
    expect(greetingAt(at(1))).toBe("夜深了");
  });

  it("自定义问候优先", () => {
    expect(greetingAt(at(15), "今天也要加油")).toBe("今天也要加油");
  });

  it("空白自定义回落到时段问候", () => {
    expect(greetingAt(at(15), "   ")).toBe("下午好");
  });
});

describe("日期与时钟格式化", () => {
  it("weekdayOf 返回中文周几", () => {
    // 2026-01-15 是周四
    expect(weekdayOf(at(9, 0, 15))).toBe("周四");
  });

  it("dateLabelOf 形如「周几 · 月日」", () => {
    expect(dateLabelOf(at(9, 0, 15))).toBe("周四 · 1月15日");
  });

  it("pad2 补零", () => {
    expect(pad2(0)).toBe("00");
    expect(pad2(9)).toBe("09");
    expect(pad2(12)).toBe("12");
  });

  it("clockParts 返回两位时分秒", () => {
    const p = clockParts(new Date(2026, 0, 15, 7, 3, 9));
    expect(p).toEqual({ hh: "07", mm: "03", ss: "09" });
  });
});
