import { describe, expect, it } from "vitest";
import { parseBookmarksHtml, toShortcuts } from "@/lib/bookmarks";
import { LIMITS, type Shortcut } from "@/config/site";

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000">开发</H3>
    <DL><p>
        <DT><A HREF="https://github.com" ADD_DATE="1700000001">GitHub &amp; friends</A>
        <DT><A HREF="https://developer.mozilla.org/zh-CN/" ADD_DATE="1700000002">MDN</A>
        <DT><A HREF="https://github.com/" ADD_DATE="1700000003">GitHub 重复</A>
        <DT><A HREF="javascript:void(0)" ADD_DATE="1700000004">书签栏脚本</A>
        <DT><A HREF="https://example.com/a?b=1&amp;c=2">带参数</A>
    </DL><p>
    <DT><A HREF="https://news.ycombinator.com">Hacker News</A>
    <DT><A>没有地址</A>
</DL><p>`;

describe("书签解析", () => {
  it("解析出 http(s) 链接并统计无效项", () => {
    const result = parseBookmarksHtml(SAMPLE);
    expect(result.total).toBe(6); // 只统计带 href 的 <a>
    expect(result.invalid).toBe(1); // javascript:
    expect(result.duplicates).toBe(1); // github.com 与 github.com/
    expect(result.items.map((i) => i.title)).toEqual([
      "GitHub & friends",
      "MDN",
      "带参数",
      "Hacker News",
    ]);
  });

  it("实体与查询参数不被破坏", () => {
    const result = parseBookmarksHtml(SAMPLE);
    expect(result.items[0].url).toBe("https://github.com/");
    expect(result.items[2].url).toBe("https://example.com/a?b=1&c=2");
  });

  it("记录所在文件夹，顶层为空", () => {
    const result = parseBookmarksHtml(SAMPLE);
    expect(result.items[0].folder).toBe("开发");
    expect(result.items[3].folder).toBe("");
  });

  it("空文件与坏输入返回空结果", () => {
    expect(parseBookmarksHtml("").items).toEqual([]);
    expect(parseBookmarksHtml("not html at all").items).toEqual([]);
  });
});

describe("书签转快捷项", () => {
  const existing: Shortcut[] = [
    { id: "sc-a", title: "GitHub", url: "https://github.com", iconKind: "letter", iconValue: "" },
  ];

  it("与现有项按 URL 去重，标题截断，图标走自动", () => {
    const parsed = parseBookmarksHtml(SAMPLE);
    const { items, skipped } = toShortcuts(parsed.items, existing);
    expect(items.map((i) => i.title)).toEqual(["MDN", "带参数", "Hacker News"]);
    expect(items.every((i) => i.iconKind === "letter")).toBe(true);
    expect(items.every((i) => i.title.length <= LIMITS.shortcutTitleMax)).toBe(true);
    expect(skipped).toBe(1);
  });

  it("遵守总上限", () => {
    const parsed = parseBookmarksHtml(SAMPLE);
    const { items, skipped } = toShortcuts(parsed.items, existing, 3);
    expect(items).toHaveLength(2);
    expect(skipped).toBe(2);
  });

  it("生成的 id 不重复", () => {
    const parsed = parseBookmarksHtml(SAMPLE);
    const { items } = toShortcuts(parsed.items, []);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });
});
