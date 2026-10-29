import { describe, expect, it } from "vitest";
import { asDirectUrl, commandSuggestions, parseCommand, resolveCommandUrl, resolveSearchUrl } from "@/lib/commands";
import type { QuickCommand } from "@/config/site";

const COMMANDS: QuickCommand[] = [
  { id: "g", key: "/g", label: "GitHub", url: "https://github.com/search?q={q}", siteUrl: "https://github.com" },
  { id: "b", key: "/b", label: "百度", url: "https://www.baidu.com/s?wd={q}", siteUrl: "https://www.baidu.com" },
  { id: "bili", key: "/bili", label: "B站", url: "https://search.bilibili.com/all?keyword={q}", siteUrl: "https://www.bilibili.com" },
];

describe("parseCommand", () => {
  it("识别「指令 + 空格 + 关键词」", () => {
    const hit = parseCommand("/g react hooks", COMMANDS);
    expect(hit?.command.key).toBe("/g");
    expect(hit?.query).toBe("react hooks");
  });

  it("无关键词时命中站点首页", () => {
    const hit = parseCommand("/g", COMMANDS);
    expect(hit?.query).toBe("");
    expect(hit && resolveCommandUrl(hit)).toBe("https://github.com");
  });

  it("长指令优先，/bili 不会被 /b 抢占", () => {
    const hit = parseCommand("/bili 前端", COMMANDS);
    expect(hit?.command.key).toBe("/bili");
    expect(hit?.query).toBe("前端");
  });

  it("指令后无空格分隔时不命中（/github 不是 /g）", () => {
    expect(parseCommand("/github", COMMANDS)).toBeNull();
  });

  it("非 / 开头返回 null", () => {
    expect(parseCommand("react", COMMANDS)).toBeNull();
  });

  it("大小写不敏感", () => {
    expect(parseCommand("/G Hooks", COMMANDS)?.command.key).toBe("/g");
  });
});

describe("resolveCommandUrl / resolveSearchUrl", () => {
  it("关键词被 URL 编码", () => {
    const hit = parseCommand("/g 中文 关键词", COMMANDS);
    expect(hit && resolveCommandUrl(hit)).toBe("https://github.com/search?q=%E4%B8%AD%E6%96%87%20%E5%85%B3%E9%94%AE%E8%AF%8D");
  });

  it("搜索模板替换 {q}", () => {
    expect(resolveSearchUrl("https://example.com/?q={q}", "a b")).toBe("https://example.com/?q=a%20b");
  });
});

describe("asDirectUrl", () => {
  it("识别完整 http(s) 地址", () => {
    expect(asDirectUrl("https://example.com/a")).toBe("https://example.com/a");
  });

  it("识别常见顶级域名并补全协议", () => {
    expect(asDirectUrl("github.com")).toBe("https://github.com");
    expect(asDirectUrl("example.io/path")).toBe("https://example.io/path");
  });

  it("普通词组不当成网址", () => {
    expect(asDirectUrl("hello world")).toBeNull();
    expect(asDirectUrl("react")).toBeNull();
  });

  it("非主流后缀不自动补全", () => {
    expect(asDirectUrl("file.txt")).toBeNull();
  });
});

describe("commandSuggestions", () => {
  it("输入 / 时给出全部指令", () => {
    expect(commandSuggestions("/", COMMANDS)).toHaveLength(3);
  });

  it("按前缀过滤", () => {
    const list = commandSuggestions("/bi", COMMANDS);
    expect(list.map((c) => c.key)).toEqual(["/bili"]);
  });

  it("已输入关键词后按指令段匹配", () => {
    expect(commandSuggestions("/g react", COMMANDS).map((c) => c.key)).toEqual(["/g"]);
  });

  it("非 / 开头返回空", () => {
    expect(commandSuggestions("react", COMMANDS)).toEqual([]);
  });
});
