import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "./utils";
import { ShortcutDock } from "@/components/shortcut-dock";
import { ShortcutManager } from "@/components/shortcut-manager";
import { CONFIG_KEY } from "@/lib/storage";

function readConfig() {
  return JSON.parse(window.localStorage.getItem(CONFIG_KEY) ?? "{}");
}

function total() {
  return Number(screen.getByTestId("shortcut-total").textContent);
}

describe("快捷跳转 Dock（首页）", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("把默认分组展平成一条，12 个快捷项全部渲染", async () => {
    renderWithProviders(<ShortcutDock />);
    await waitFor(() => expect(screen.getByTestId("shortcut-total")).toBeTruthy());
    expect(total()).toBe(12);
    expect(screen.getByTestId("shortcut-dock")).toBeTruthy();
    // 不再有分组标题
    expect(screen.queryByText("自建服务")).toBeNull();
    expect(screen.queryByText("常用站点")).toBeNull();
    expect(screen.queryByText("开发工具")).toBeNull();
  });

  it("指针划过图标不会出现任何编辑/删除入口", async () => {
    renderWithProviders(<ShortcutDock />);
    await waitFor(() => expect(screen.getByTestId("shortcut-dock")).toBeTruthy());

    // 增删改全部搬去设置里了，首页 DOM 里根本不该存在这些按钮
    expect(document.querySelector('[data-testid^="shortcut-edit-"]')).toBeNull();
    expect(document.querySelector('[data-testid^="shortcut-delete-"]')).toBeNull();
    expect(screen.queryByLabelText(/前移/)).toBeNull();
    expect(screen.queryByLabelText(/后移/)).toBeNull();
    expect(screen.queryByTestId("add-shortcut")).toBeNull();
  });

  it("悬停容器本身不带卡片底色，只有图标层做位移", async () => {
    renderWithProviders(<ShortcutDock />);
    await waitFor(() => expect(screen.getByTestId("shortcut-dock")).toBeTruthy());
    const link = document.querySelector<HTMLAnchorElement>('[data-testid^="shortcut-sc-"]');
    expect(link).toBeTruthy();
    // 图标外层是 .shortcut-icon-wrap，hover 动效挂在这一层
    expect(link!.querySelector(".shortcut-icon-wrap")).toBeTruthy();
    // 链接自身没有 shortcut-tile 之类的整块底色 class
    expect(link!.className).not.toContain("shortcut-tile");
  });

  it("快捷项是可访问的链接（新标签 + noopener）", async () => {
    renderWithProviders(<ShortcutDock />);
    await waitFor(() => expect(screen.getByTestId("shortcut-total")).toBeTruthy());
    const link = document.querySelector<HTMLAnchorElement>('a[data-testid^="shortcut-"]');
    expect(link).toBeTruthy();
    expect(link!.getAttribute("target")).toBe("_blank");
    expect(link!.getAttribute("rel")).toContain("noopener");
    // 可访问名来自可见文字本身（不用 aria-label，避免 label-content-name-mismatch）
    expect((link!.textContent ?? "").trim().length).toBeGreaterThan(0);
    expect(link!.getAttribute("title")).toContain("打开 ");
  });
});

describe("快捷跳转 Dock：空态", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("没有快捷项时渲染一行说明（不再是可以点的按钮）", async () => {
    window.localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ groups: [{ id: "grp-main", name: "快捷跳转", items: [] }] }),
    );
    renderWithProviders(<ShortcutDock />);
    const empty = await screen.findByTestId("shortcut-empty");
    expect(empty.tagName).toBe("P");
    expect(empty.textContent).toContain("还没有快捷项");
    // 引导文案指向设置，而不是自己弹窗
    expect(empty.textContent).toContain("设置");
  });
});

describe("快捷跳转管理（设置内）", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("列表里能看到全部 12 项，并标明顺序即首页顺序", async () => {
    renderWithProviders(<ShortcutManager />);
    await waitFor(() => expect(screen.getByTestId("shortcut-list")).toBeTruthy());
    const rows = screen.getByTestId("shortcut-list").querySelectorAll("[data-shortcut-id]");
    expect(rows.length).toBe(12);
  });

  it("新增快捷项：名称为空时报错，填写后保存成功", async () => {
    renderWithProviders(<ShortcutManager />);
    await waitFor(() => expect(screen.getByTestId("add-shortcut")).toBeTruthy());
    fireEvent.click(screen.getByTestId("add-shortcut"));

    const titleInput = (await screen.findByTestId("shortcut-title")) as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "" } });
    fireEvent.click(screen.getByTestId("shortcut-save"));
    await waitFor(() => expect(screen.getByTestId("shortcut-error").textContent).toContain("名称"));

    fireEvent.change(titleInput, { target: { value: "我的站点" } });
    const urlInput = screen.getByTestId("shortcut-url") as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "mysite.dev" } });
    fireEvent.click(screen.getByTestId("shortcut-save"));

    await waitFor(() => expect(screen.queryByTestId("shortcut-title")).toBeNull());
    await waitFor(() => expect(screen.getByText("我的站点")).toBeTruthy());
    const groups = readConfig().groups ?? [];
    const saved = groups[0].items.find((i: { title: string }) => i.title === "我的站点");
    expect(saved.url).toBe("https://mysite.dev");
  });

  it("非法链接被拒绝", async () => {
    renderWithProviders(<ShortcutManager />);
    fireEvent.click(screen.getByTestId("add-shortcut"));
    const titleInput = await screen.findByTestId("shortcut-title");
    fireEvent.change(titleInput, { target: { value: "坏链接" } });
    fireEvent.change(screen.getByTestId("shortcut-url"), { target: { value: "http://" } });
    fireEvent.click(screen.getByTestId("shortcut-save"));
    await waitFor(() => expect(screen.getByTestId("shortcut-error").textContent).toContain("链接"));
  });

  it("编辑快捷项会回填原值", async () => {
    renderWithProviders(<ShortcutManager />);
    await waitFor(() => expect(screen.getByTestId("shortcut-list")).toBeTruthy());
    const firstEdit = document.querySelector<HTMLButtonElement>('[data-testid^="shortcut-edit-"]');
    expect(firstEdit).toBeTruthy();
    fireEvent.click(firstEdit!);
    const titleInput = (await screen.findByTestId("shortcut-title")) as HTMLInputElement;
    expect(titleInput.value.length).toBeGreaterThan(0);
  });

  it("删除快捷项需二次确认", async () => {
    renderWithProviders(<ShortcutManager />);
    await waitFor(() => expect(screen.getByTestId("shortcut-list")).toBeTruthy());
    const before = readConfig().groups[0].items.length;

    const firstDelete = document.querySelector<HTMLButtonElement>('[data-testid^="shortcut-delete-"]');
    fireEvent.click(firstDelete!);
    await waitFor(() => expect(screen.getByTestId("confirm-ok")).toBeTruthy());

    fireEvent.click(screen.getByTestId("confirm-ok"));
    await waitFor(() => {
      expect(readConfig().groups[0].items.length).toBe(before - 1);
    });
  });

  it("确认框取消不删除", async () => {
    renderWithProviders(<ShortcutManager />);
    await waitFor(() => expect(screen.getByTestId("shortcut-list")).toBeTruthy());
    const before = readConfig().groups[0].items.length;
    const firstDelete = document.querySelector<HTMLButtonElement>('[data-testid^="shortcut-delete-"]');
    fireEvent.click(firstDelete!);
    await waitFor(() => expect(screen.getByTestId("confirm-ok")).toBeTruthy());
    fireEvent.click(screen.getByTestId("confirm-cancel"));
    await waitFor(() => expect(screen.queryByTestId("confirm-ok")).toBeNull());
    expect(readConfig().groups[0].items.length).toBe(before);
  });

  it("前移 / 后移按钮改变顺序并写入 localStorage", async () => {
    renderWithProviders(<ShortcutManager />);
    await waitFor(() => expect(screen.getByTestId("shortcut-list")).toBeTruthy());
    const before = readConfig().groups[0].items.map((i: { id: string }) => i.id);

    const second = document.querySelectorAll<HTMLElement>("[data-shortcut-id]")[1];
    const back = within(second).getByLabelText(/前移/);
    fireEvent.click(back);

    await waitFor(() => {
      const after = readConfig().groups[0].items.map((i: { id: string }) => i.id);
      expect(after[0]).toBe(before[1]);
      expect(after[1]).toBe(before[0]);
    });
  });
});
