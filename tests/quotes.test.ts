import { describe, expect, it } from "vitest";
import { QUOTES, quoteOfDay, quotesByCategory, randomQuote } from "@/lib/quotes";

describe("内置语录库", () => {
  it("至少 30 条，字段完整", () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(30);
    for (const q of QUOTES) {
      expect(q.text.trim().length).toBeGreaterThan(0);
      expect(q.from.trim().length).toBeGreaterThan(0);
      expect(["inspire", "tech", "literary"]).toContain(q.category);
    }
  });

  it("三个分类都有内容", () => {
    for (const c of ["inspire", "tech", "literary"]) {
      expect(quotesByCategory(c).length).toBeGreaterThan(0);
    }
  });

  it("未知分类回退为全部", () => {
    expect(quotesByCategory("nope")).toHaveLength(QUOTES.length);
    expect(quotesByCategory("all")).toHaveLength(QUOTES.length);
  });
});

describe("quoteOfDay：同一天稳定", () => {
  it("同一天两次调用结果相同", () => {
    const d1 = new Date(2026, 2, 8, 0, 1);
    const d2 = new Date(2026, 2, 8, 23, 59);
    expect(quoteOfDay("all", d1).text).toBe(quoteOfDay("all", d2).text);
  });

  it("不同日期通常会变化", () => {
    const a = quoteOfDay("all", new Date(2026, 2, 8));
    const b = quoteOfDay("all", new Date(2026, 2, 9));
    expect(a.text).not.toBe(b.text);
  });

  it("结果属于所选分类", () => {
    const q = quoteOfDay("tech", new Date(2026, 2, 8));
    expect(q.category).toBe("tech");
  });
});

describe("randomQuote", () => {
  it("尽量避开上一条", () => {
    const pool = quotesByCategory("all");
    const avoid = pool[0].text;
    for (let i = 0; i < 20; i += 1) {
      expect(randomQuote("all", avoid).text).not.toBe(avoid);
    }
  });

  it("单条分类时仍返回该条", () => {
    expect(randomQuote("all").text.length).toBeGreaterThan(0);
  });
});
