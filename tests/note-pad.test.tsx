import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { NotePad } from "@/components/note-pad";
import { renderWithProviders } from "./utils";
import { CONFIG_KEY } from "@/lib/storage";

function seedNote(enabled: boolean, content = "") {
  window.localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify({ note: { enabled, content } }),
  );
}

function readNote(): { enabled: boolean; content: string } | null {
  const raw = window.localStorage.getItem(CONFIG_KEY);
  if (!raw) return null;
  return JSON.parse(raw).note ?? null;
}

describe("待办便签", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("显式关闭时不渲染", async () => {
    seedNote(false);
    renderWithProviders(<NotePad />);
    await waitFor(() => expect(screen.queryByTestId("note-card")).toBeNull());
  });

  it("开启后渲染输入框并回填已保存内容", async () => {
    seedNote(true, "买牛奶");
    renderWithProviders(<NotePad />);
    const input = await screen.findByTestId<HTMLTextAreaElement>("note-input");
    await waitFor(() => expect(input.value).toBe("买牛奶"));
  });

  it("输入内容防抖后写入 localStorage", async () => {
    seedNote(true, "");
    renderWithProviders(<NotePad />);
    const input = await screen.findByTestId<HTMLTextAreaElement>("note-input");
    fireEvent.change(input, { target: { value: "写周报" } });
    await waitFor(() => expect(readNote()?.content).toBe("写周报"), { timeout: 2000 });
  });

  it("清空按钮可用，且空内容时按钮禁用", async () => {
    seedNote(true, "旧内容");
    renderWithProviders(<NotePad />);
    const input = await screen.findByTestId<HTMLTextAreaElement>("note-input");
    await waitFor(() => expect(input.value).toBe("旧内容"));
    const clear = screen.getByTestId<HTMLButtonElement>("note-clear");
    expect(clear.disabled).toBe(false);
    fireEvent.click(clear);
    await waitFor(() => expect(input.value).toBe(""));
    expect(clear.disabled).toBe(true);
    await waitFor(() => expect(readNote()?.content).toBe(""), { timeout: 2000 });
  });

  it("保存后短暂显示「已保存到本机」", async () => {
    seedNote(true, "");
    renderWithProviders(<NotePad />);
    const input = await screen.findByTestId<HTMLTextAreaElement>("note-input");
    fireEvent.change(input, { target: { value: "任务一" } });
    await waitFor(() => expect(screen.getByTestId("note-saved")).toBeTruthy(), { timeout: 2000 });
  });

  it("超长内容被截断到 2000 字", async () => {
    seedNote(true, "");
    renderWithProviders(<NotePad />);
    const input = await screen.findByTestId<HTMLTextAreaElement>("note-input");
    fireEvent.change(input, { target: { value: "a".repeat(2100) } });
    expect(input.value.length).toBe(2000);
    await waitFor(() => expect(readNote()?.content.length).toBe(2000), { timeout: 2000 });
  });
});
