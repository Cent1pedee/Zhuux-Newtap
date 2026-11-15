import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./utils";
import { ShortcutManager } from "@/components/shortcut-manager";
import { loadConfig } from "@/lib/storage";

function ids() {
  return loadConfig().groups[0].items.map((i) => i.id);
}

describe("快捷项：删除可撤销", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("撤销后按原位置恢复", async () => {
    renderWithProviders(<ShortcutManager />);
    await waitFor(() => expect(screen.getByTestId("shortcut-list")).toBeTruthy());

    const before = ids();
    const target = before[2];

    fireEvent.click(screen.getByTestId(`shortcut-delete-${target}`));
    fireEvent.click(screen.getByRole("button", { name: /^删除$/ }));

    await waitFor(() => expect(ids()).toHaveLength(before.length - 1));
    expect(ids()).not.toContain(target);

    fireEvent.click(screen.getByTestId("toast-action"));

    await waitFor(() => expect(ids()).toEqual(before));
  });
});
