import { beforeEach, describe, expect, it } from "vitest";
import {
  SEARCH_HISTORY_KEY,
  SEARCH_HISTORY_LIMIT,
  clearSearchHistory,
  loadSearchHistory,
  pushSearchHistory,
  removeSearchHistory,
} from "@/lib/search-history";
import { CONFIG_KEY } from "@/lib/storage";

describe("搜索历史", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("新词排在最前且去重", () => {
    pushSearchHistory("react");
    pushSearchHistory("vite");
    pushSearchHistory("react");
    expect(loadSearchHistory()).toEqual(["react", "vite"]);
  });

  it(`最多保留 ${SEARCH_HISTORY_LIMIT} 条`, () => {
    for (let i = 0; i < SEARCH_HISTORY_LIMIT + 4; i += 1) pushSearchHistory(`q${i}`);
    const list = loadSearchHistory();
    expect(list).toHaveLength(SEARCH_HISTORY_LIMIT);
    expect(list[0]).toBe(`q${SEARCH_HISTORY_LIMIT + 3}`);
  });

  it("忽略空串与快捷指令", () => {
    pushSearchHistory("   ");
    pushSearchHistory("/g react");
    expect(loadSearchHistory()).toEqual([]);
  });

  it("可删除单条与全部清除", () => {
    pushSearchHistory("a");
    pushSearchHistory("b");
    expect(removeSearchHistory("a")).toEqual(["b"]);
    expect(clearSearchHistory()).toEqual([]);
  });

  it("损坏的 JSON 不会抛错", () => {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, "{not-json");
    expect(loadSearchHistory()).toEqual([]);
  });

  it("不写入配置 key", () => {
    pushSearchHistory("react");
    expect(window.localStorage.getItem(CONFIG_KEY)).toBeNull();
  });
});
