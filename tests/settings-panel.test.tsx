import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "./utils";
import { SettingsPanel } from "@/components/settings-panel";
import { CONFIG_KEY } from "@/lib/storage";

/**
 * jsdom 没有 IndexedDB，图片资源库整体换成可控替身。
 * 这里只验证两件事：配置里留的是引用还是 dataURL；写失败会不会明说。
 */
const imageMocks = vi.hoisted(() => ({
  putStoredImage: vi.fn(async (kind: string) => `idb:img:${kind}:42:abc`),
}));

vi.mock("@/lib/image-store", () => ({
  IMAGE_REF_PREFIX: "idb:",
  isStoredImageRef: (value: string) => value.startsWith("idb:"),
  peekStoredImage: () => null,
  getStoredImage: async () => null,
  deleteStoredImage: async () => {},
  hasInlineImages: () => false,
  migrateInlineImages: async () => null,
  putStoredImage: imageMocks.putStoredImage,
}));

function readConfig() {
  return JSON.parse(window.localStorage.getItem(CONFIG_KEY) ?? "{}");
}

const TAB_ANCHOR: Record<string, string> = {
  search: "suggest-toggle",
  appearance: "theme-mode",
  shortcuts: "shortcut-manager",
  modules: "clock-seconds",
  background: "background-edge",
  privacy: "whitelist-input",
  about: "about-copy-url",
};

const TAB_IDS = ["search", "appearance", "shortcuts", "modules", "background", "privacy", "about"];

/** 页签内容由 AnimatePresence 切换，需等待新面板挂载 */
async function openTab(id: string) {
  fireEvent.click(screen.getByTestId(`settings-tab-${id}`));
  await waitFor(() => expect(screen.getByTestId(TAB_ANCHOR[id])).toBeTruthy());
}

function pickRadio(testId: string, label: string) {
  const group = screen.getByTestId(testId);
  fireEvent.click(within(group).getByText(label));
}

describe("设置面板：基础", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("渲染七个分类页签且可切换", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    for (const id of TAB_IDS) {
      expect(screen.getByTestId(`settings-tab-${id}`)).toBeTruthy();
    }
    await openTab("privacy");
    await waitFor(() => expect(screen.getByText("请求白名单")).toBeTruthy());
    await openTab("search");
    await waitFor(() => expect(screen.getByTestId("suggest-toggle")).toBeTruthy());
  });

  it("完成按钮触发 onClose", () => {
    const onClose = vi.fn();
    renderWithProviders(<SettingsPanel open onClose={onClose} />);
    fireEvent.click(screen.getByTestId("settings-done"));
    expect(onClose).toHaveBeenCalled();
  });

  it("Esc 关闭设置面板", () => {
    const onClose = vi.fn();
    renderWithProviders(<SettingsPanel open onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("设置面板：搜索引擎", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("停用引擎后从启用列表移除，并保留至少一个", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("search");
    const toggle = screen.getByTestId("engine-toggle-google");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByTestId("engine-toggle-google").getAttribute("aria-checked")).toBe("false"));
    await waitFor(() => expect(readConfig().engineOrder).not.toContain("google"));
  });

  it("下移按钮改变引擎顺序", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("search");
    const before = readConfig().engineOrder as string[];
    fireEvent.click(screen.getByTestId("engine-down-google"));
    await waitFor(() => {
      const after = readConfig().engineOrder as string[];
      expect(after).not.toEqual(before);
      expect(after[0]).not.toBe("google");
    });
  });

  it("搜索建议开关可切换并持久化", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("search");
    const toggle = screen.getByTestId("suggest-toggle");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    await waitFor(() => expect(readConfig().suggest.enabled).toBe(true));
  });

  it("新增快捷指令后出现在列表里", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("search");
    fireEvent.change(screen.getByTestId("cmd-key"), { target: { value: "/npm" } });
    fireEvent.change(screen.getByTestId("cmd-label"), { target: { value: "npm 包" } });
    fireEvent.change(screen.getByTestId("cmd-url"), { target: { value: "https://www.npmjs.com/search?q={q}" } });
    fireEvent.click(screen.getByTestId("cmd-add"));
    await waitFor(() => {
      const cmds = readConfig().quickCommands ?? [];
      expect(cmds.some((c: { key: string }) => c.key === "/npm")).toBe(true);
    });
  });

  it("非法快捷指令给出提示", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("search");
    fireEvent.change(screen.getByTestId("cmd-key"), { target: { value: "npm" } });
    fireEvent.click(screen.getByTestId("cmd-add"));
    await waitFor(() => expect(screen.getByTestId("toast").textContent).toContain("均为必填"));
  });
});

describe("设置面板：外观", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("切换主题模式写入配置", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("appearance");
    pickRadio("theme-mode", "亮色");
    await waitFor(() => expect(readConfig().theme.mode).toBe("light"));
  });

  it("选择预设强调色写入配置", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("appearance");
    fireEvent.click(screen.getByTestId("accent-green"));
    await waitFor(() => expect(readConfig().theme.accent).toBe("#12A150"));
  });

  it("自定义取色器显示对比度", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("appearance");
    const picker = screen.getByTestId("accent-picker") as HTMLInputElement;
    fireEvent.change(picker, { target: { value: "#ffffff" } });
    await waitFor(() => expect(screen.getByTestId("accent-contrast").textContent).toContain("对比度"));
  });

  it("减少动效开关写入 a11y.reducedMotion", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("appearance");
    fireEvent.click(screen.getByTestId("reduce-motion"));
    await waitFor(() => expect(readConfig().a11y.reducedMotion).toBe(true));
  });
});

describe("设置面板：模块", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("时钟显示与秒开关独立生效", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("modules");
    fireEvent.click(screen.getByTestId("clock-seconds"));
    await waitFor(() => expect(readConfig().clock.showSeconds).toBe(true));
    fireEvent.click(screen.getByTestId("clock-show"));
    await waitFor(() => expect(readConfig().clock.show).toBe(false));
  });

  it("自定义问候语生效", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("modules");
    fireEvent.change(screen.getByTestId("greeting-custom"), { target: { value: "欢迎回来" } });
    await waitFor(() => expect(readConfig().greeting.custom).toBe("欢迎回来"));
  });

  it("天气：默认开启，展示单位与省市下拉（不再暴露经纬度输入）", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("modules");
    await waitFor(() => expect(screen.getByTestId("weather-unit")).toBeTruthy());
    expect(screen.getByTestId("weather-province")).toBeTruthy();
    expect(screen.getByTestId("weather-city-select")).toBeTruthy();
    // 经纬度是机器坐标，不该让人手填
    expect(screen.queryByTestId("weather-lat")).toBeNull();
    expect(screen.queryByTestId("weather-lon")).toBeNull();
  });

  it("天气：选省份与城市后把坐标一并写进配置", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("modules");
    fireEvent.change(screen.getByTestId("weather-province"), { target: { value: "浙江省" } });
    // 选省份只切城市列表，不写库也不收起面板
    expect(readConfig().weather.province).toBe("");
    fireEvent.change(screen.getByTestId("weather-city-select"), { target: { value: "杭州" } });
    await waitFor(() => {
      const w = readConfig().weather;
      expect(w.city).toBe("杭州");
      expect(w.source).toBe("manual");
      expect(w.lat).toBeCloseTo(30.27);
      expect(w.lon).toBeCloseTo(120.15);
    });
  });

  it("一言来源切换为远程写入配置", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("modules");
    pickRadio("quote-source", "远程 API");
    await waitFor(() => expect(readConfig().quote.source).toBe("remote"));
  });
});

describe("设置面板：背景", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("每日壁纸开关写入 background.source", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("background");
    // 默认就是 edge，点一次关掉
    fireEvent.click(screen.getByTestId("background-edge"));
    await waitFor(() => expect(readConfig().background.source).toBe("none"));
    expect(readConfig().background.source).not.toBe(true);
  });

  it("回溯天数切换写入 background.offset", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("background");
    pickRadio("background-offset", "-3 天");
    await waitFor(() => expect(readConfig().background.offset).toBe(3));
  });

  it("远程背景图片地址为空时提示", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("background");
    fireEvent.click(screen.getByTestId("wallpaper-url-apply"));
    await waitFor(() => expect(screen.getByTestId("toast").textContent).toContain("请填写图片地址"));
  });

  it("远程背景图片地址非法时提示", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("background");
    fireEvent.change(screen.getByTestId("wallpaper-url"), { target: { value: "ftp://x" } });
    fireEvent.click(screen.getByTestId("wallpaper-url-apply"));
    await waitFor(() => expect(screen.getByTestId("toast").textContent).toContain("http(s)"));
  });

  it("合法远程背景图片地址应用成功", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("background");
    fireEvent.change(screen.getByTestId("wallpaper-url"), {
      target: { value: "https://images.example.com/a.jpg" },
    });
    fireEvent.click(screen.getByTestId("wallpaper-url-apply"));
    await waitFor(() => {
      const w = readConfig().wallpaper;
      expect(w.source).toBe("url");
      expect(w.value).toBe("https://images.example.com/a.jpg");
    });
  });

  it("移除自定义图片后回到每日壁纸", async () => {
    window.localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ wallpaper: { source: "url", value: "https://images.example.com/a.jpg" } }),
    );
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("background");
    fireEvent.click(screen.getByTestId("wallpaper-clear"));
    await waitFor(() => expect(readConfig().wallpaper.source).toBe("none"));
  });

  it("本地上传的图片写进 IndexedDB，配置里只留引用", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("background");
    const file = new File([new Uint8Array([137, 80, 78, 71])], "bg.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("wallpaper-file"), { target: { files: [file] } });

    await waitFor(() => expect(readConfig().wallpaper.source).toBe("local"));
    expect(readConfig().wallpaper.value).toBe("idb:img:wallpaper:42:abc");
    expect(readConfig().wallpaper.value).not.toContain("data:");
  });

  it("图片写不进本地存储时明确报错，不谎报成功", async () => {
    imageMocks.putStoredImage.mockRejectedValueOnce(new Error("quota"));
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("background");
    const file = new File([new Uint8Array([1, 2, 3])], "big.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("wallpaper-file"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByTestId("toast").textContent).toContain("图片保存失败"));
    expect(readConfig().wallpaper?.source ?? "none").not.toBe("local");
  });

  it("拒绝把 dataURL 当图片地址粘贴（避免重新撑爆 localStorage）", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("background");
    fireEvent.change(screen.getByTestId("wallpaper-url"), {
      target: { value: "data:image/png;base64,AAAA" },
    });
    fireEvent.click(screen.getByTestId("wallpaper-url-apply"));
    await waitFor(() => expect(screen.getByTestId("toast").textContent).toContain("http(s)"));
  });

  it("点「往前回溯」标题不会把偏移重置回今天", async () => {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ background: { offset: 3 } }));
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("background");

    fireEvent.click(screen.getByText("往前回溯"));
    await waitFor(() => {
      const group = screen.getByTestId("background-offset");
      expect(within(group).getByText("-3 天").getAttribute("aria-checked")).toBe("true");
    });
    expect(readConfig().background.offset).toBe(3);
  });

  it("暗化与模糊滑杆可调", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("background");

    const dim = screen.getByTestId("wallpaper-dim") as HTMLInputElement;
    fireEvent.change(dim, { target: { value: "60" } });
    await waitFor(() => expect(readConfig().background.dim).toBe(60));

    const blur = screen.getByTestId("wallpaper-blur") as HTMLInputElement;
    fireEvent.change(blur, { target: { value: "8" } });
    await waitFor(() => expect(readConfig().background.blur).toBe(8));
  });
});

describe("设置面板：快捷跳转", () => {
  beforeEach(() => {
    window.localStorage.clear();
    imageMocks.putStoredImage.mockClear();
  });

  it("上传图标后存成引用，不把 dataURL 写进配置", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("shortcuts");
    fireEvent.click(screen.getByTestId("add-shortcut"));
    await waitFor(() => expect(screen.getByTestId("shortcut-title")).toBeTruthy());

    fireEvent.change(screen.getByTestId("shortcut-title"), { target: { value: "图床" } });
    fireEvent.change(screen.getByTestId("shortcut-url"), { target: { value: "https://img.example.com" } });
    pickRadio("shortcut-icon-kind", "上传图片");
    await waitFor(() => expect(screen.getByTestId("shortcut-file")).toBeTruthy());

    const file = new File([new Uint8Array([1, 2, 3])], "icon.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("shortcut-file"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText("已选择本地图片")).toBeTruthy());

    fireEvent.click(screen.getByTestId("shortcut-save"));

    await waitFor(() => {
      const items = readConfig().groups[0].items;
      const added = items[items.length - 1];
      expect(added.title).toBe("图床");
      expect(added.iconValue).toBe("idb:img:icon:42:abc");
    });
  });
});

describe("设置面板：关于", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("关于页展示快捷键与版本信息", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("about");
    expect(screen.getByTestId("about-copy-url")).toBeTruthy();
    expect(screen.getByText(/版本 1\.0\.0/)).toBeTruthy();
  });
});

describe("设置面板：隐私与数据", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("添加与移除白名单域名", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("privacy");
    fireEvent.change(screen.getByTestId("whitelist-input"), { target: { value: "mysite.dev" } });
    fireEvent.click(screen.getByTestId("whitelist-add"));
    await waitFor(() => expect(readConfig().privacy.whitelist).toContain("mysite.dev"));

    fireEvent.click(screen.getByTestId("whitelist-remove-mysite.dev"));
    await waitFor(() => expect(readConfig().privacy.whitelist).not.toContain("mysite.dev"));
  });

  it("非法白名单域名被拒绝", async () => {
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("privacy");
    fireEvent.change(screen.getByTestId("whitelist-input"), { target: { value: "nope" } });
    fireEvent.click(screen.getByTestId("whitelist-add"));
    await waitFor(() => expect(screen.getByTestId("toast").textContent).toContain("有效域名"));
  });

  it("导出配置触发下载", async () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("privacy");
    fireEvent.click(screen.getByTestId("export-config"));
    await waitFor(() => expect(screen.getByTestId("toast").textContent).toContain("配置已导出"));
    expect(createObjectURL).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("一键清除需二次确认，确认后恢复默认", async () => {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ theme: { accent: "#10B981" } }));
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    await openTab("privacy");
    fireEvent.click(screen.getByTestId("clear-data"));
    await waitFor(() => expect(screen.getByTestId("confirm-ok")).toBeTruthy());
    fireEvent.click(screen.getByTestId("confirm-ok"));
    await waitFor(() => expect(readConfig().theme.accent).toBe("#2F6FED"));
  });

  it("恢复出厂需二次确认", async () => {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ clock: { showSeconds: true } }));
    renderWithProviders(<SettingsPanel open onClose={() => {}} />);
    fireEvent.click(screen.getByTestId("settings-reset"));
    await waitFor(() => expect(screen.getByTestId("confirm-ok")).toBeTruthy());
    fireEvent.click(screen.getByTestId("confirm-ok"));
    await waitFor(() => expect(readConfig().clock.showSeconds).toBe(false));
  });
});
