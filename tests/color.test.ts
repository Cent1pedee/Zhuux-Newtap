import { describe, expect, it } from "vitest";
import { accentContrast, contrastRatio, hexToRgb, isAccentAcceptable, relativeLuminance } from "@/lib/color";

describe("hexToRgb", () => {
  it("解析 6 位与 3 位十六进制", () => {
    expect(hexToRgb("#2F6FED")).toEqual({ r: 47, g: 111, b: 237 });
    expect(hexToRgb("fff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("非法输入返回 null", () => {
    expect(hexToRgb("zzz")).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
  });
});

describe("对比度（WCAG）", () => {
  it("黑白对比度为 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("同色对比度为 1:1", () => {
    expect(contrastRatio("#2F6FED", "#2F6FED")).toBeCloseTo(1, 5);
  });

  it("相对亮度单调：白 > 灰 > 黑", () => {
    expect(relativeLuminance("#ffffff")).toBeGreaterThan(relativeLuminance("#808080"));
    expect(relativeLuminance("#808080")).toBeGreaterThan(relativeLuminance("#000000"));
  });

  it("对比度对称", () => {
    expect(contrastRatio("#2F6FED", "#0a0d14")).toBeCloseTo(contrastRatio("#0a0d14", "#2F6FED"), 6);
  });
});

describe("强调色可用性（≥3:1）", () => {
  it("品牌蓝在深色底通过", () => {
    expect(accentContrast("#2F6FED", "dark")).toBeGreaterThanOrEqual(3);
    expect(isAccentAcceptable("#2F6FED", "dark")).toBe(true);
  });

  it("接近黑色的强调色在深色底不通过", () => {
    expect(isAccentAcceptable("#101010", "dark")).toBe(false);
  });

  it("浅黄色在浅色底不通过", () => {
    expect(isAccentAcceptable("#FFF9A8", "light")).toBe(false);
  });

  it("深蓝在浅色底通过", () => {
    expect(isAccentAcceptable("#1B3FBF", "light")).toBe(true);
  });
});
