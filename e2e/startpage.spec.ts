import { test, expect, type Page } from "@playwright/test";

/**
 * E2E：按 PRD 的五个 P0 要素逐条验证「真实浏览器里的可操作性」。
 * 断言重点不是像素，而是「点了有反应、弹了能关、提交有结果」。
 */

const CONFIG_KEY = "startpage.config.v1";

/**
 * 每个用例从干净配置开始。
 * 注意：addInitScript 在每次导航（含 reload）都会执行，必须用 sessionStorage 打标，
 * 否则「刷新后仍保持」这类断言会被自己清掉数据。
 */
async function fresh(page: Page, seed?: Record<string, unknown>) {
  await page.addInitScript(
    ([key, seedJson]) => {
      try {
        if (!window.sessionStorage.getItem("__sp_e2e__")) {
          window.sessionStorage.setItem("__sp_e2e__", "1");
          window.localStorage.clear();
          if (seedJson) window.localStorage.setItem(key as string, seedJson as string);
        }
      } catch {
        /* ignore */
      }
    },
    [CONFIG_KEY, seed ? JSON.stringify(seed) : ""] as const,
  );
  await page.goto("/");
  await expect(page.getByTestId("clock")).toBeVisible();
}

/** 读取当前持久化配置（仅测试断言用，字段按需取） */
type StoredConfig = { theme?: { accent?: string; mode?: string }; clock?: { showSeconds?: boolean } };

async function readConfig(page: Page): Promise<StoredConfig | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredConfig) : null;
  }, CONFIG_KEY);
}

/** 按标题取快捷项 id（用于精确定位编辑/删除按钮） */
async function shortcutId(page: Page, title: string): Promise<string> {
  const id = await page.evaluate((t) => {
    const raw = window.localStorage.getItem("startpage.config.v1");
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    for (const g of cfg.groups ?? []) {
      for (const it of g.items ?? []) if (it.title === t) return it.id as string;
    }
    return null;
  }, title);
  expect(id, `找不到标题为「${title}」的快捷项`).not.toBeNull();
  return id as string;
}

/**
 * 打开「设置 → 快捷跳转」。
 * 第③项改造（m03287）后，快捷项的增删改全部收进设置面板，
 * 首页 Dock 悬停不再浮出编辑工具条。
 */
async function openShortcutSettings(page: Page) {
  await page.getByTestId("settings-trigger").click();
  await page.getByTestId("settings-tab-shortcuts").click();
  await expect(page.getByTestId("shortcut-manager")).toBeVisible();
}

test.describe("首屏与布局", () => {
  test("五个 P0 模块全部渲染，且无横向滚动", async ({ page }) => {
    await fresh(page);
    await expect(page.getByTestId("clock")).toBeVisible();
    await expect(page.getByTestId("search-form")).toBeVisible();
    await expect(page.getByTestId("shortcut-total")).toHaveText("12");
    await expect(page.getByTestId("quote-card")).toBeVisible();
    await expect(page.getByTestId("wallpaper")).toBeAttached();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("时钟按秒走动（开启秒后）", async ({ page }) => {
    await fresh(page, { clock: { show: true, showSeconds: true } });
    const read = () => page.getByTestId("clock-text").textContent();
    await expect.poll(read, { timeout: 4000 }).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    const first = await read();
    await expect.poll(read, { timeout: 4000 }).not.toBe(first);
  });

  test("秒数可见且字号不小于主数字的一半", async ({ page }) => {
    // 回归测试：早期秒只有 0.42em + 60% 不透明度，在渐变文字下几乎看不见，
    // 用户会以为「开了显示秒但没生效」。这里锁住视觉权重，而不只是 DOM 存在。
    await fresh(page, { clock: { show: true, showSeconds: true } });
    const seconds = page.getByTestId("clock-seconds");
    await expect(seconds).toBeVisible();
    await expect(page.getByTestId("clock-text")).toHaveText(/^\d{2}:\d{2}:\d{2}$/);

    const ratio = await page.evaluate(() => {
      const sec = document.querySelector('[data-testid="clock-seconds"]');
      const clock = document.querySelector('[data-testid="clock"]');
      if (!sec || !clock) return 0;
      return parseFloat(getComputedStyle(sec).fontSize) / parseFloat(getComputedStyle(clock).fontSize);
    });
    expect(ratio).toBeGreaterThan(0.5);
  });

  test("每个模块各自独立成层：左上天气 → 时钟 → 搜索框 → 便签卡 → 一言 → 底部 Dock", async ({ page }) => {
    // 回归测试：改造前所有次级模块塞在同一块 Bento 玻璃板里；
    // 现在天气钉在左上角（环境读数，不进主列），便签是独立卡片，
    // 一言单独一条贴着 Dock，时钟与搜索框直接压在壁纸上（无容器）。
    await fresh(page);
    const order = await page.evaluate(() => {
      const box = (sel: string) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
      };
      return {
        weather: box('[data-testid="weather-card"]'),
        clock: box('[data-testid="clock"]'),
        search: box('[data-testid="search-form"]'),
        note: box('[data-testid="note-card-panel"]'),
        quote: box('[data-testid="quote-card"]'),
        dock: box('[data-testid="shortcut-dock"]'),
        viewportH: window.innerHeight,
        viewportW: window.innerWidth,
      };
    });
    for (const [key, value] of Object.entries(order)) {
      if (key === "viewportH" || key === "viewportW") continue;
      expect(value, `${key} 应存在`).not.toBeNull();
    }
    // 天气在左上角：纵向比时钟更靠上，横向贴左侧
    expect(order.weather!.top).toBeLessThan(order.clock!.top);
    expect(order.weather!.left).toBeLessThan(order.viewportW / 2);
    // 主列仍然自上而下
    expect(order.clock!.top).toBeLessThan(order.search!.top);
    expect(order.search!.top).toBeLessThan(order.note!.top);
    expect(order.note!.top).toBeLessThan(order.quote!.top);
    expect(order.quote!.top).toBeLessThan(order.dock!.top);
    // Dock 落在视口底部附近（底部悬浮，而不是跟着内容流走）
    expect(order.viewportH - order.dock!.top).toBeLessThan(140);

    // 旧的 Bento 玻璃板已彻底移除；天气不再占用独立卡片层
    const legacy = await page.evaluate(() => ({
      board: document.querySelectorAll('[data-testid="board"]').length,
      bento: document.querySelectorAll(".bento-grid").length,
      weatherInsideNote:
        document.querySelector('[data-testid="note-card-panel"] [data-testid="weather"]') !== null,
      weatherInStage: document.querySelector('.stage [data-testid="weather"]') !== null,
    }));
    expect(legacy.board).toBe(0);
    expect(legacy.bento).toBe(0);
    expect(legacy.weatherInsideNote).toBe(false);
    expect(legacy.weatherInStage).toBe(false);
  });

  test("两处玻璃面板都启用了 backdrop-filter 且底色半透明", async ({ page }) => {
    // 一言与时钟已按青柠起始页的做法去掉容器（只剩文字压在壁纸上），不再参与此断言。
    // 天气胶囊也不再属于这一组：它已改成和右上角动作组同一套「板」材质（近实心 + 描边），
    // 由下面「天气胶囊与动作组同材质」那条单独守。
    await fresh(page);
    const panels = await page.evaluate(() => {
      const read = (sel: string) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return null;
        const cs = getComputedStyle(el);
        // Safari 走 -webkit- 前缀，DOM 类型里没声明，所以按索引取
        const filter =
          cs.backdropFilter || (cs as unknown as Record<string, string>)["webkitBackdropFilter"] || "";
        const match = filter.match(/blur\(([\d.]+)px\)/);
        // 解析背景色 alpha：rgba(...) 或 color(srgb r g b / a)
        const bg = cs.backgroundColor;
        const rgba = bg.match(/rgba?\([^)]*?,\s*([\d.]+)\)/);
        const slash = bg.match(/\/\s*([\d.]+)\)/);
        return {
          blur: match ? Number(match[1]) : 0,
          alpha: Number(rgba?.[1] ?? slash?.[1] ?? 1),
        };
      };
      return {
        search: read('[data-testid="search-shell"]'),
        dock: read('.dock-pill'),
      };
    });
    for (const [key, value] of Object.entries(panels)) {
      expect(value, `${key} 面板应存在`).not.toBeNull();
      expect(value!.blur, `${key} 应有 backdrop-filter blur`).toBeGreaterThanOrEqual(12);
      expect(value!.alpha, `${key} 底色应半透明`).toBeLessThan(0.95);
    }
  });

  test("天气胶囊与右上角动作组同高、同材质", async ({ page }) => {
    // 回归测试：天气胶囊原先用 --panel-bg（通明玻璃），和旁边的 --board-bg 实心胶囊
    // 并排，一眼就是两块不同来源的控件。现在两者共用同一套板材质与同一个高度。
    await fresh(page);
    const m = await page.evaluate(() => {
      const read = (sel: string) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return null;
        const cs = getComputedStyle(el);
        const bg = cs.backgroundColor;
        const rgba = bg.match(/rgba?\([^)]*?,\s*([\d.]+)\)/);
        const slash = bg.match(/\/\s*([\d.]+)\)/);
        return {
          height: el.getBoundingClientRect().height,
          alpha: Number(rgba?.[1] ?? slash?.[1] ?? 1),
          blur: (cs.backdropFilter || "").match(/blur\(([\d.]+)px\)/)?.[1] ?? "0",
          radius: cs.borderTopLeftRadius,
        };
      };
      return { weather: read(".weather-row"), dock: read(".bar-dock") };
    });
    expect(m.weather, "天气胶囊应存在").not.toBeNull();
    expect(m.dock, "动作组应存在").not.toBeNull();
    // 同一行左右并排，高度差超过 1px 就会看出来
    expect(Math.abs(m.weather!.height - m.dock!.height)).toBeLessThanOrEqual(1);
    // 同一套「板」材质：近实心 + 同样的胶囊圆角 + 同样的毛玻璃
    expect(m.weather!.alpha).toBeGreaterThanOrEqual(0.9);
    expect(m.dock!.alpha).toBeGreaterThanOrEqual(0.9);
    expect(Number(m.weather!.blur)).toBeGreaterThanOrEqual(12);
    expect(m.weather!.radius).toBe(m.dock!.radius);
  });

  test("多种视口下页面不滚动，内容等比缩放到一屏", async ({ page }) => {
    const sizes = [
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
      { width: 1280, height: 600 },
      { width: 1024, height: 560 },
    ];
    await fresh(page);
    for (const size of sizes) {
      await page.setViewportSize(size);
      // 缩放是异步的（ResizeObserver → 双 rAF → 复量），并行跑时固定 sleep 可能
      // 落在「上一档缩放还没换过来」的中间态，所以等到真正不溢出再断言
      await page
        .waitForFunction(
          () => {
            const main = document.querySelector("main");
            if (!main) return false;
            return main.scrollHeight - main.clientHeight <= 0;
          },
          undefined,
          { timeout: 5_000 },
        )
        .catch(() => {
          /* 真的溢出时交给下面的断言报出具体数值 */
        });
      const m = await page.evaluate(() => {
        const main = document.querySelector("main");
        if (!main) return null;
        return {
          docScroll: document.documentElement.scrollHeight - window.innerHeight,
          mainScroll: main.scrollHeight - main.clientHeight,
          horizontal: document.documentElement.scrollWidth - window.innerWidth,
          fit: Number(main.getAttribute("data-fit-scale") ?? "1"),
        };
      });
      expect(m, "main 应存在").not.toBeNull();
      expect(m!.docScroll, `${size.width}x${size.height} 整页不应纵向滚动`).toBeLessThanOrEqual(0);
      expect(m!.mainScroll, `${size.width}x${size.height} main 不应纵向滚动`).toBeLessThanOrEqual(0);
      expect(m!.horizontal, `${size.width}x${size.height} 不应横向滚动`).toBeLessThanOrEqual(0);
      expect(m!.fit, "缩放系数应落在 0.6~1").toBeGreaterThanOrEqual(0.6);
      expect(m!.fit).toBeLessThanOrEqual(1);
    }
  });

  test("首屏第三方请求分两层把关：接口走白名单，图片只允许 favicon", async ({ page }) => {
    // 第⑥项改造（m03287）后默认开启 Edge 每日壁纸，首屏必然有外部请求；
    // 第十一轮（m04901）后站点图标默认自动抓取，favicon 也不走白名单。
    // 于是把承诺拆成两条可验证的边界：
    //   ① 接口类请求（json 等）必须全部命中白名单；
    //   ② 图片类请求只允许 /favicon.ico 这一种形态（想全关就去设置里关抓取）。
    const external: { url: string; type: string; from: string }[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("http://127.0.0.1:3100") || url.startsWith("data:") || url.startsWith("blob:")) return;
      // 有些站点的 /favicon.ico 会 302 到自己的搜索页（如 caniuse.com），
      // 记下重定向来源，才能判断这条请求最初是不是一次图标抓取。
      external.push({ url, type: req.resourceType(), from: req.redirectedFrom()?.url() ?? "" });
    });
    await fresh(page);
    await page.waitForTimeout(1500);

    const whitelist = ["v1.hitokoto.cn", "api.bing.com", "api.open-meteo.com", "bing.biturl.top", "www.bing.com"];
    const allowedHost = (url: string) => {
      try {
        const host = new URL(url).hostname;
        return whitelist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
      } catch {
        return false;
      }
    };

    const apiOffenders = external
      .filter((r) => r.type !== "image")
      .map((r) => r.url)
      .filter((url) => !allowedHost(url));
    expect(apiOffenders, `白名单外接口请求：${apiOffenders.join(", ")}`).toEqual([]);

    const isFaviconTrace = (r: { url: string; from: string }) =>
      /\/favicon\.ico(\?|$)/.test(r.url) || /\/favicon\.ico(\?|$)/.test(r.from);
    const imageOffenders = external
      .filter((r) => allowedHost(r.url) ? false : !isFaviconTrace(r))
      .map((r) => r.url);
    expect(imageOffenders, `非法外部请求：${imageOffenders.join(", ")}`).toEqual([]);

    // 关掉每日壁纸 + 关掉图标抓取 + 一言切回本地库后，reload 应当一次外部请求都不发
    await page.getByTestId("settings-trigger").click();
    await page.getByTestId("settings-tab-background").click();
    await page.getByTestId("background-edge").click();
    await page.getByTestId("settings-tab-privacy").click();
    await page.getByTestId("icons-autofetch").click();
    await page.getByTestId("settings-tab-modules").click();
    await page.getByTestId("quote-source").getByText("内置语录库").click();
    await page.getByTestId("settings-done").click();
    external.length = 0;
    await page.reload();
    await page.waitForTimeout(2000);
    expect(external.map((r) => r.url)).toEqual([]);
  });
});

test.describe("搜索引擎框", () => {
  test("默认 Google，表单可原生提交", async ({ page }) => {
    await fresh(page);
    await expect(page.getByTestId("engine-name")).toHaveText("Google");
    const form = page.getByTestId("search-form");
    await expect(form).toHaveAttribute("method", "get");
    await expect(form).toHaveAttribute("action", /google\.com/);
  });

  test("点击引擎按钮循环切换，右键菜单可选择", async ({ page }) => {
    await fresh(page);
    await page.getByTestId("engine-button").click();
    await expect(page.getByTestId("engine-name")).not.toHaveText("Google");

    await page.getByTestId("engine-button").click({ button: "right" });
    await expect(page.getByTestId("engine-menu")).toBeVisible();
    await page.getByTestId("engine-option-baidu").click();
    await expect(page.getByTestId("engine-name")).toHaveText("百度");
    await expect(page.getByTestId("engine-menu")).toBeHidden();
  });

  test("快捷指令提示与 Esc 关闭", async ({ page }) => {
    await fresh(page);
    const input = page.getByTestId("search-input");
    await input.click();
    await input.fill("/");
    await expect(page.getByTestId("suggestions")).toBeVisible();
    await input.press("Escape");
    await expect(input).toHaveValue("");
  });

  test("Shift+Enter 用新标签打开搜索结果", async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => {
      (window as unknown as { __opened: unknown[][] }).__opened = [];
      const original = window.open.bind(window);
      window.open = (...args: unknown[]) => {
        (window as unknown as { __opened: unknown[][] }).__opened.push(args);
        return original(...(args as [string, string, string]));
      };
    });
    const input = page.getByTestId("search-input");
    await input.click();
    await input.fill("playwright e2e");
    await input.press("Shift+Enter");

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __opened: string[][] }).__opened))
      .toHaveLength(1);
    const opened = await page.evaluate(() => (window as unknown as { __opened: string[][] }).__opened);
    expect(opened[0][0]).toContain("google.com");
    expect(decodeURIComponent(opened[0][0])).toContain("playwright e2e");
    expect(opened[0][1]).toBe("_blank");
    expect(opened[0][2]).toContain("noopener");
  });

  test("回车与点搜索按钮都在新标签打开；空提交直接进当前引擎官网", async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => {
      (window as unknown as { __opened: unknown[][] }).__opened = [];
      const original = window.open.bind(window);
      window.open = (...args: unknown[]) => {
        (window as unknown as { __opened: unknown[][] }).__opened.push(args);
        return original(...(args as [string, string, string]));
      };
    });
    const readOpened = () => page.evaluate(() => (window as unknown as { __opened: string[][] }).__opened);

    // ① 有内容 + Enter → 新标签打开搜索结果，当前页不动
    const urlBefore = page.url();
    const input = page.getByTestId("search-input");
    await input.click();
    await input.fill("hello startpage");
    await input.press("Enter");
    await expect.poll(readOpened).toHaveLength(1);
    expect((await readOpened())[0][0]).toContain("google.com");
    expect(page.url()).toBe(urlBefore);

    // ② 有内容 + 点搜索按钮 → 同样在新标签
    await page.getByTestId("search-submit").click();
    await expect.poll(readOpened).toHaveLength(2);
    expect((await readOpened())[1][0]).toContain("hello");
    expect((await readOpened())[1][1]).toBe("_blank");

    // ③ 清空后提交 → 直接打开当前引擎官网（不是拒绝）
    await input.fill("");
    await page.getByTestId("search-submit").click();
    await expect.poll(readOpened).toHaveLength(3);
    expect((await readOpened())[2][0]).toMatch(/^https:\/\/www\.google\.com\/?$/);
    expect((await readOpened())[2][1]).toBe("_blank");
    expect(page.url()).toBe(urlBefore);
  });
});

test.describe("快捷跳转", () => {
  test("新增、编辑、删除快捷项全流程（全部在设置里完成）", async ({ page }) => {
    await fresh(page);
    // 首页 Dock 上不该有任何编辑入口
    await expect(page.getByTestId("add-shortcut")).toHaveCount(0);
    expect(await page.locator('[data-testid^="shortcut-edit-"]').count()).toBe(0);

    await openShortcutSettings(page);
    await page.getByTestId("add-shortcut").click();
    await expect(page.getByTestId("shortcut-title")).toBeVisible();

    // 空名称 → 报错，弹窗不关闭
    await page.getByTestId("shortcut-save").click();
    await expect(page.getByTestId("shortcut-error")).toBeVisible();

    await page.getByTestId("shortcut-title").fill("E2E 站点");
    await page.getByTestId("shortcut-url").fill("e2e.example.com");
    await page.getByTestId("shortcut-save").click();
    await expect(page.getByTestId("shortcut-title")).toBeHidden();

    const id = await shortcutId(page, "E2E 站点");
    await expect(page.getByTestId(`shortcut-${id}`)).toBeVisible();

    // 编辑：在设置列表里点铅笔，弹窗回填
    await page.getByTestId(`shortcut-edit-${id}`).click();
    await expect(page.getByTestId("shortcut-title")).toHaveValue("E2E 站点");
    await page.getByTestId("shortcut-title").fill("E2E 改名");
    await page.getByTestId("shortcut-save").click();
    // 等弹窗退场动画结束，否则遮罩会吞掉下一次点击
    await expect(page.getByTestId("shortcut-title")).toBeHidden();
    await expect(page.getByTestId(`shortcut-${id}`)).toContainText("E2E 改名");

    // 删除：先取消，再确认
    await page.getByTestId(`shortcut-delete-${id}`).click();
    await expect(page.getByTestId("confirm-ok")).toBeVisible();
    await page.getByTestId("confirm-cancel").click();
    await expect(page.getByTestId("confirm-ok")).toBeHidden();
    await expect(page.getByTestId(`shortcut-${id}`)).toBeVisible();

    await page.getByTestId(`shortcut-delete-${id}`).click();
    await page.getByTestId("confirm-ok").click();
    await expect(page.getByTestId(`shortcut-${id}`)).toHaveCount(0);
  });

  test("快捷项编辑弹窗叠在设置之上，标题可见且 Esc 只关最上一层", async ({ page }) => {
    // 回归测试：编辑弹窗原先渲染在设置弹窗内部，祖先 .glass-strong 同时带
    // backdrop-filter 与 overflow:hidden，`position: fixed` 于是相对于那块玻璃
    // 而不是视口 —— 标题被顶到遮罩下面看不见，按 Esc 还会把两层一起关掉。
    await fresh(page);
    await openShortcutSettings(page);
    await page.getByTestId("add-shortcut").click();
    await expect(page.getByTestId("shortcut-title")).toBeVisible();

    const title = page.getByRole("heading", { name: "添加快捷项" });
    await expect(title).toBeVisible();
    const box = await title.boundingBox();
    expect(box).not.toBeNull();
    // 标题必须落在视口内、且在设置弹窗顶部之上（也就是真的浮出来了）
    expect(box!.y).toBeGreaterThan(0);
    expect(box!.y).toBeLessThan(200);
    // 命中测试：标题位置最上层的元素必须属于编辑弹窗本身
    const topmostIsEditor = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      const dialog = el?.closest('[role="dialog"]');
      return dialog?.querySelector("h2")?.textContent === "添加快捷项";
    }, { x: box!.x + 8, y: box!.y + box!.height / 2 });
    expect(topmostIsEditor).toBe(true);

    // Esc 只关编辑层，设置面板仍然开着
    await page.keyboard.press("Escape");
    await expect(title).toBeHidden();
    await expect(page.getByTestId("shortcut-manager")).toBeVisible();
    await expect(page.getByTestId("settings-done")).toBeVisible();
  });

  test("悬停只在图标上生效，格子本身不出现卡片底色", async ({ page }) => {
    // 回归测试：早期给整个 .shortcut-tile 加了 hover 底色，指针一放上去就冒出
    // 一张 68×60 的圆角卡片。现在要求：容器背景必须始终透明，只有图标层动。
    await fresh(page);
    const item = page.locator("[data-shortcut-id]").nth(2);
    const bgBefore = await item.evaluate((el) => getComputedStyle(el).backgroundColor);

    await item.locator("a").hover();
    const state = await item.evaluate((el) => {
      const wrap = el.querySelector(".shortcut-icon-wrap");
      const cs = getComputedStyle(el);
      const ws = wrap ? getComputedStyle(wrap) : null;
      return {
        bg: cs.backgroundColor,
        boxShadow: cs.boxShadow,
        borderWidth: cs.borderTopWidth,
        iconTransform: ws?.transform ?? "none",
      };
    });

    // 容器：无底色、无阴影、无描边
    expect(state.bg).toBe(bgBefore);
    expect(["rgba(0, 0, 0, 0)", "transparent"]).toContain(state.bg);
    expect(state.boxShadow).toBe("none");
    expect(state.borderWidth).toBe("0px");
    // 图标层：确实发生了位移/放大
    expect(state.iconTransform).not.toBe("none");
  });

  test("快捷项可前后调序，顺序持久化到刷新后", async ({ page }) => {
    await fresh(page);
    await openShortcutSettings(page);
    const before = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("startpage.config.v1") ?? "{}").groups?.[0]?.items?.map(
        (i: { id: string }) => i.id,
      ),
    );
    const second = page.getByTestId("shortcut-list").locator("[data-shortcut-id]").nth(1);
    await second.getByLabel(/前移/).click();
    await expect
      .poll(async () => {
        const ids = await page.evaluate(() =>
          JSON.parse(window.localStorage.getItem("startpage.config.v1") ?? "{}").groups?.[0]?.items?.map(
            (i: { id: string }) => i.id,
          ),
        );
        return ids?.[0];
      })
      .toBe(before[1]);

    await page.reload();
    const after = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("startpage.config.v1") ?? "{}").groups?.[0]?.items?.map(
        (i: { id: string }) => i.id,
      ),
    );
    expect(after[0]).toBe(before[1]);
  });

  test("Ctrl+数字直达前九个快捷项", async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => {
      (window as unknown as { __opened: unknown[][] }).__opened = [];
      const original = window.open.bind(window);
      window.open = (...args: unknown[]) => {
        (window as unknown as { __opened: unknown[][] }).__opened.push(args);
        return original(...(args as [string, string, string]));
      };
    });
    await page.keyboard.press("Control+1");
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __opened: string[][] }).__opened))
      .toHaveLength(1);
    const opened = await page.evaluate(() => (window as unknown as { __opened: string[][] }).__opened);
    expect(opened[0][0]).toMatch(/^https?:\/\//);
    await expect(page.getByTestId("toast")).toContainText("打开");
  });
});

test.describe("每日一言", () => {
  test("点击正文即换一条，且不再有来源标签/分类/刷新按钮", async ({ page }) => {
    await fresh(page);
    const text = page.getByTestId("quote-text");
    await expect(text).not.toBeEmpty();
    const before = await text.textContent();
    await page.getByTestId("quote-body").click();
    await expect(text).not.toHaveText(before ?? "");

    // 一行小字旁边不该挂四个控件
    await expect(page.getByTestId("quote-source")).toHaveCount(0);
    await expect(page.getByTestId("quote-category-button")).toHaveCount(0);
    await expect(page.getByTestId("quote-refresh")).toHaveCount(0);
    await expect(page.getByTestId("quote-from")).not.toBeEmpty();
  });

  test("聚焦搜索框时一言渐隐，失焦后复原（且一言没有自己的容器）", async ({ page }) => {
    await fresh(page);
    const section = page.getByTestId("quote-section");
    const opacityOf = () =>
      section.evaluate((el) => Number(getComputedStyle(el).opacity));

    // 一言没有任何边框 / 玻璃底 —— 只是背景上的一行字
    const box = await section.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { border: cs.borderTopWidth, backdrop: cs.backdropFilter, bg: cs.backgroundColor };
    });
    expect(box.border).toBe("0px");
    expect(box.backdrop === "none" || box.backdrop === "").toBe(true);
    expect(box.bg === "rgba(0, 0, 0, 0)" || box.bg === "transparent").toBe(true);
    // 等入场动画（600ms 延迟 + 480ms）跑完，此后 opacity 应稳定为 1
    await expect.poll(opacityOf, { timeout: 3000 }).toBe(1);

    // 聚焦搜索框 → 整块淡出
    await page.getByTestId("search-input").click();
    await expect(section).toHaveAttribute("data-dimmed", "true");
    await expect.poll(opacityOf, { timeout: 2000 }).toBe(0);

    // 失焦 → 淡回
    await page.getByTestId("clock").click();
    await expect(section).toHaveAttribute("data-dimmed", "false");
    await expect.poll(opacityOf, { timeout: 2000 }).toBe(1);
  });
});

test.describe("背景与主题", () => {
  test("每日壁纸开关与暗化滑杆生效", async ({ page }) => {
    // 第⑥项改造（m03287）：Magic UI Backgrounds 全部移除，背景只有两种来源 ——
    // Edge 每日壁纸（默认开）与渐变兜底。这里验证开关与暗化滑杆都真的落到配置上。
    await fresh(page);
    await page.getByTestId("settings-trigger").click();
    await page.getByTestId("settings-tab-background").click();

    await expect(page.getByTestId("background-edge")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("background-edge").click();
    await expect(page.getByTestId("background-edge")).toHaveAttribute("aria-checked", "false");

    await page.getByTestId("wallpaper-dim").fill("60");
    await page.getByTestId("settings-done").click();

    const scrim = await page.evaluate(
      () => getComputedStyle(document.querySelector(".wallpaper-scrim") as Element).opacity,
    );
    expect(Number(scrim)).toBeGreaterThan(0);

    // 关掉每日壁纸后应只剩渐变兜底，且根节点 data-bg-source 不再是 edge
    await expect(page.getByTestId("wallpaper")).toHaveAttribute("data-bg-source", "none");
  });

  test("主题切换写回 html[data-theme]", async ({ page }) => {
    await fresh(page);
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.getByTestId("theme-toggle").click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .not.toBe(before);
  });
});

test.describe("命令面板", () => {
  test("Cmd/Ctrl+K 打开，可搜索并执行，Esc 关闭", async ({ page }) => {
    await fresh(page);
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("palette")).toBeVisible();

    await page.getByTestId("palette-input").fill("设置");
    await expect(page.getByTestId("palette").getByText("打开设置")).toBeVisible();
    await page.getByTestId("palette").getByText("打开设置").click();
    await expect(page.getByTestId("palette")).toBeHidden();
    await expect(page.getByTestId("settings-done")).toBeVisible();
    await page.getByTestId("settings-done").click();

    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("palette")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("palette")).toBeHidden();
  });
});

test.describe("设置与数据", () => {
  test("关闭模块后首页不再渲染对应组件，刷新后保持", async ({ page }) => {
    await fresh(page);
    await page.getByTestId("settings-trigger").click();
    await page.getByTestId("settings-tab-modules").click();
    await page.getByTestId("quote-show").click();
    await page.getByTestId("settings-done").click();
    await expect(page.getByTestId("quote-card")).toBeHidden();

    await page.reload();
    await expect(page.getByTestId("quote-card")).toBeHidden();
  });

  test("一键清除全部数据需二次确认，且清空后回到出厂配置", async ({ page }) => {
    await fresh(page, { theme: { mode: "light", accent: "#12A150" } });
    await page.getByTestId("settings-trigger").click();
    await page.getByTestId("settings-tab-privacy").click();
    await page.getByTestId("clear-data").click();
    await expect(page.getByTestId("confirm-ok")).toBeVisible();
    await page.getByTestId("confirm-ok").click();
    await expect(page.getByTestId("toast")).toContainText("本地数据已清空");
    await page.getByTestId("settings-done").click();

    await expect.poll(async () => (await readConfig(page))?.theme?.accent).toBe("#2F6FED");
  });

  test("导出配置生成 JSON 文件", async ({ page }) => {
    await fresh(page);
    await page.getByTestId("settings-trigger").click();
    await page.getByTestId("settings-tab-privacy").click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-config").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^startpage-config-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

test.describe("无障碍与键盘", () => {
  test("跳过链接可用，Tab 能到搜索框", async ({ page }) => {
    await fresh(page);
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => document.activeElement?.textContent ?? "");
    expect(first).toContain("跳到主要内容");

    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });

  test("设置弹窗焦点被困在内部，Esc 关闭后焦点回到触发按钮", async ({ page }) => {
    await fresh(page);
    await page.getByTestId("settings-trigger").click();
    await expect(page.getByTestId("settings-done")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("settings-done")).toBeHidden();
    const active = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    expect(active).toBe("settings-trigger");
  });

  test("减少动效开关写入 data-motion", async ({ page }) => {
    await fresh(page);
    await page.getByTestId("settings-trigger").click();
    await page.getByTestId("settings-tab-appearance").click();
    await page.getByTestId("reduce-motion").click();
    await page.getByTestId("settings-done").click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.motion))
      .toBe("reduce");
  });
});
