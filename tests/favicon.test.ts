import { describe, expect, it } from "vitest";
import { faviconCandidates, faviconCapability, faviconUrl, isPrivateHost } from "@/lib/favicon";

describe("favicon 候选链", () => {
  it("按清晰度与命中率给出多条候选，且不再拼 ?size", () => {
    const list = faviconCandidates("https://www.zhihu.com/question/1");
    expect(list[0]).toBe("https://www.zhihu.com/favicon.ico");
    expect(list).toContain("https://www.zhihu.com/apple-touch-icon.png");
    expect(list).toContain("https://www.zhihu.com/favicon.svg");
    expect(list).toHaveLength(3);
    expect(list.every((u) => !u.includes("?size="))).toBe(true);
  });

  it("faviconUrl 取优先级最高的那条（favicon.ico）", () => {
    expect(faviconUrl("https://juejin.cn")).toBe("https://juejin.cn/favicon.ico");
  });

  it("内网 / 非法地址不产生请求", () => {
    expect(faviconCandidates("http://192.168.1.10:5000")).toEqual([]);
    expect(faviconCandidates("http://localhost:3000")).toEqual([]);
    expect(faviconCandidates("ftp://example.com")).toEqual([]);
    expect(faviconUrl("https://10.0.0.2")).toBe("");
  });

  it("能力判断与候选链一致", () => {
    expect(faviconCapability("https://example.com")).toBe("ok");
    expect(faviconCapability("http://172.20.1.2")).toBe("private");
    expect(faviconCapability("nope")).toBe("invalid");
    expect(isPrivateHost("127.0.0.1")).toBe(true);
  });
});
