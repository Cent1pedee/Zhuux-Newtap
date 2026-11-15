import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./utils";
import { ShortcutManager } from "@/components/shortcut-manager";
import { loadConfig } from "@/lib/storage";

const BOOKMARKS = `<DL><p>
  <DT><H3>工作</H3>
  <DL><p>
    <DT><A HREF="https://github.com">GitHub</A>
    <DT><A HREF="https://example.com/docs">文档</A>
    <DT><A HREF="https://example.com/docs/">文档重复</A>
    <DT><A HREF="javascript:void(0)">脚本</A>
  </DL><p>
</DL><p>`;

describe("快捷项：导入浏览器书签", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("先出预览、确认后才写入，并跳过重复项", async () => {
    renderWithProviders(<ShortcutManager />);
    const before = loadConfig().groups[0].items.length;

    fireEvent.change(screen.getByTestId("bookmarks-file"), {
      target: { files: [new File([BOOKMARKS], "bookmarks.html", { type: "text/html" })] },
    });

    await waitFor(() => expect(screen.getByTestId("bookmark-preview-list")).toBeTruthy());
    // 默认配置里已有 github.com，预览应说明跳过 2 条（重复 + 文件内重复）
    // 文件内重复已在解析阶段去掉，这里只剩「与现有 github.com 重复」这一条
    expect(screen.getByText(/跳过 1 条/)).toBeTruthy();
    expect(screen.getByTestId("bookmark-preview-list").textContent).toContain("文档");

    fireEvent.click(screen.getByTestId("confirm-bookmark-import"));

    await waitFor(() => {
      const items = loadConfig().groups[0].items;
      expect(items).toHaveLength(before + 1);
      expect(items.at(-1)?.url).toBe("https://example.com/docs");
      expect(items.at(-1)?.iconKind).toBe("letter");
    });
  });
});
