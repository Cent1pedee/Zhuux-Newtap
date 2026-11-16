import { test, expect, type Page } from "@playwright/test";
import { openSettings, openSettingsDialog, readSettled, settleAnimations } from "./helpers";

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
  await openSettings(page);
  await page.getByTestId("settings-tab-shortcuts").click();
  await expect(page.getByTestId("shortcut-manager")).toBeVisible();
}

test.describe("首屏与布局", () => {
  test("默认态：时间 / 搜索 / 一言 / Dock，且无横向滚动", async ({ page }) => {
    await fresh(page);
    await expect(page.getByTestId("clock")).toBeVisible();
    await expect(page.getByTestId("search-form")).toBeVisible();
    await expect(page.getByTestId("shortcut-dock")).toBeVisible();
    await expect(page.getByTestId("shortcut-total")).toHaveText("13");
    await expect(page.getByTestId("quote-card")).toBeVisible();
    await expect(page.getByTestId("wallpaper")).toBeAttached();
    await expect(page.getByTestId("wallpaper-vignette")).toBeVisible();
    // 快捷方块与右上角设置属于「点时间之后」的展开态
    await expect(page.getByTestId("shortcut-grid")).toHaveCount(0);
    await expect(page.getByTestId("settings-trigger")).toHaveCount(0);
    await expect(page.getByTestId("wallpaper")).toHaveAttribute("data-blurred", "false");
    // 天气模块已整体移除：DOM 里不能留下胶囊、占位或残留的空盒子
    await expect(page.getByTestId("weather-card")).toHaveCount(0);
    await expect(page.getByTestId("weather")).toHaveCount(0);
    await expect(page.getByTestId("note-card-panel")).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("点击时间：壁纸高斯模糊，时钟与搜索上移，方块浮现，Esc 收起", async ({ page }) => {
    await fresh(page);
    const before = await page.getByTestId("clock").boundingBox();
    await page.getByTestId("clock").click();

    await expect(page.getByTestId("shortcut-grid")).toBeVisible();
    await expect(page.getByTestId("settings-trigger")).toBeVisible();
    await expect(page.getByTestId("wallpaper")).toHaveAttribute("data-blurred", "true");
    await expect(page.locator(".clock-trigger")).toHaveAttribute("aria-expanded", "true");
    // 一言与 Dock 不因展开而消失
    await expect(page.getByTestId("quote-card")).toBeVisible();
    await expect(page.getByTestId("shortcut-dock")).toBeVisible();

    // 时钟确实上移（居中 → 给方块让位）。高度动画还在跑，用轮询等它落位
    const clockY = async () => (await page.getByTestId("clock").boundingBox())?.y ?? Number.POSITIVE_INFINITY;
    expect(before).not.toBeNull();
    await expect.poll(clockY).toBeLessThan(before!.y - 40);

    // 壁纸图片可能因为网络不可达而缺失；有节点时核对真实滤镜。
    // 滤镜由 Motion 逐帧插值，点击后第一帧读到的可能还是 none —— 用轮询等它到位。
    if ((await page.locator('[data-testid="wallpaper-image"]').count()) > 0) {
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const el = document.querySelector('[data-testid="wallpaper-image"]');
              return el ? getComputedStyle(el).filter : "";
            }),
          { timeout: 3000 },
        )
        .toContain("blur(18px)");
    }

    // Esc 收起：方块与齿轮退场，壁纸恢复清晰
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("shortcut-grid")).toHaveCount(0);
    await expect(page.getByTestId("wallpaper")).toHaveAttribute("data-blurred", "false");
    await expect(page.locator(".clock-trigger")).toHaveAttribute("aria-expanded", "false");
  });

  test("右键时间同样展开，再点一次收起", async ({ page }) => {
    await fresh(page);
    await page.getByTestId("clock").click({ button: "right" });
    await expect(page.getByTestId("shortcut-grid")).toBeVisible();
    await expect(page.locator(".clock-trigger")).toHaveAttribute("aria-expanded", "true");

    await page.getByTestId("clock").click();
    await expect(page.getByTestId("shortcut-grid")).toHaveCount(0);
    await expect(page.locator(".clock-trigger")).toHaveAttribute("aria-expanded", "false");
  });

  test("齿轮直接打开完整设置，Esc 只关弹窗", async ({ page }) => {
    await fresh(page);
    expect(await page.getByTestId("settings-trigger").count()).toBe(0);

    await page.getByTestId("clock").click();
    await expect(page.getByTestId("shortcut-grid")).toBeVisible();
    // 回归：齿轮此前包在 dynamic 菜单里，chunk 未到时整块不渲染
    await expect(page.getByTestId("settings-trigger")).toBeVisible();
    await page.getByTestId("settings-trigger").click();

    // 直接出完整设置，不再有二级菜单这一层
    await expect(page.getByTestId("settings-done")).toBeVisible();
    await expect(page.getByTestId("settings-menu")).toHaveCount(0);
    await expect(page.getByTestId("settings-tab-appearance")).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("dialog")).toContainText("设置");

    // 第一下 Esc 只关弹窗，展开态（方块 / 模糊壁纸）保留
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("settings-done")).toBeHidden();
    await expect(page.getByTestId("modal-overlay")).toHaveCount(0);
    await expect(page.getByTestId("shortcut-grid")).toBeVisible();
    await expect(page.getByTestId("wallpaper")).toHaveAttribute("data-blurred", "true");

    // 第二下 Esc 收起展开态
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("shortcut-grid")).toHaveCount(0);
    await expect(page.getByTestId("wallpaper")).toHaveAttribute("data-blurred", "false");
  });

  test("「添加」方块直达快捷跳转设置", async ({ page }) => {
    await fresh(page);
    await page.getByTestId("clock").click();
    await expect(page.getByTestId("shortcut-grid")).toBeVisible();
    await page.getByTestId("shortcut-add-tile").click();
    await expect(page.getByTestId("settings-done")).toBeVisible();
    await expect(page.getByTestId("settings-tab-shortcuts")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("shortcut-manager")).toBeVisible();
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

  test("每个模块各自独立成层：时钟 → 搜索框 → 便签卡 → 一言 → 底部 Dock", async ({ page }) => {
    // 回归测试：改造前所有次级模块塞在同一块 Bento 玻璃板里；
    // 现在便签是独立卡片，一言单独一条贴着 Dock，时钟与搜索框直接压在壁纸上（无容器）。
    await fresh(page, {
      home: { simple: false },
      note: { enabled: true },
      quote: { show: true, source: "local" },
    });
    const order = await page.evaluate(() => {
      const box = (sel: string) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
      };
      return {
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
    // 主列仍然自上而下
    expect(order.clock!.top).toBeLessThan(order.search!.top);
    expect(order.search!.top).toBeLessThan(order.note!.top);
    expect(order.note!.top).toBeLessThan(order.quote!.top);
    expect(order.quote!.top).toBeLessThan(order.dock!.top);
    // Dock 落在视口底部附近（底部悬浮，而不是跟着内容流走）
    expect(order.viewportH - order.dock!.top).toBeLessThan(140);

    // 旧的 Bento 玻璃板已彻底移除
    const legacy = await page.evaluate(() => ({
      board: document.querySelectorAll('[data-testid="board"]').length,
      bento: document.querySelectorAll(".bento-grid").length,
      weatherLeftovers: document.querySelectorAll('[data-testid^="weather"]').length,
    }));
    expect(legacy.board).toBe(0);
    expect(legacy.bento).toBe(0);
    expect(legacy.weatherLeftovers).toBe(0);
  });

  test("两处玻璃面板都启用了 backdrop-filter 且底色半透明", async ({ page }) => {
    // 一言与时钟已按青柠起始页的做法去掉容器（只剩文字压在壁纸上），不再参与此断言。
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
      // 搜索胶囊的模糊值对齐参考站（blur(10px)），Dock 仍是 20px+
      expect(value!.blur, `${key} 应有 backdrop-filter blur`).toBeGreaterThanOrEqual(8);
      expect(value!.alpha, `${key} 底色应半透明`).toBeLessThan(0.95);
    }
  });

  test("主题切换只改组件材质，壁纸层保持不变", async ({ page }) => {
    await fresh(page);
    const read = () =>
      page.evaluate(() => {
        const bg = (sel: string) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          return el ? getComputedStyle(el).backgroundImage : "missing";
        };
        const panel = document.querySelector(".search-panel") as HTMLElement | null;
        return {
          layer: bg(".wallpaper-layer"),
          scrim: bg(".wallpaper-scrim"),
          vignette: bg(".wallpaper-vignette"),
          home: bg(".home-scrim"),
          searchColor: panel ? getComputedStyle(panel).backgroundColor : "missing",
        };
      });

    const dark = await read();
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";
    });
    await page.waitForTimeout(400);
    const light = await read();

    // 背景四层一个字节都不该变
    expect(light.layer).toBe(dark.layer);
    expect(light.scrim).toBe(dark.scrim);
    expect(light.vignette).toBe(dark.vignette);
    expect(light.home).toBe(dark.home);
    // 组件自己按 data-theme 换材质
    expect(light.searchColor).not.toBe(dark.searchColor);
  });

  test("五个分类页签的按钮尺寸、间距与状态表现一致", async ({ page }) => {
    await fresh(page);
    await openSettings(page);

    // 逐页签收集全部官方 Button 的几何；每个页签都不该出现第二种高度/内距/间距
    const summary: { tab: string; heights: number[]; pads: string[]; gaps: string[]; fonts: string[]; radii: string[] }[] = [];
    for (const tab of ["appearance", "modules", "shortcuts", "background", "search"]) {
      await page.getByTestId(`settings-tab-${tab}`).click();
      await expect(page.getByTestId(`settings-tab-${tab}`)).toHaveAttribute("aria-current", "page");
      summary.push(
        await page.evaluate((name) => {
          const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="button"]')).map((el) => {
            const cs = getComputedStyle(el);
            return {
              h: Math.round(el.getBoundingClientRect().height),
              pad: `${cs.paddingLeft}/${cs.paddingRight}`,
              gap: cs.gap,
              font: cs.fontSize,
              radius: cs.borderTopLeftRadius,
            };
          });
          return {
            tab: name,
            heights: [...new Set(rows.map((r) => r.h))],
            pads: [...new Set(rows.map((r) => r.pad))],
            gaps: [...new Set(rows.map((r) => r.gap))],
            fonts: [...new Set(rows.map((r) => r.font))],
            radii: [...new Set(rows.map((r) => r.radius))],
          };
        }, tab),
      );
    }
    for (const row of summary) {
      expect(row.heights, `${row.tab} 按钮高度`).toHaveLength(1);
      expect(row.pads, `${row.tab} 按钮内距`).toHaveLength(1);
      expect(row.gaps, `${row.tab} 按钮图标间距`).toHaveLength(1);
      expect(row.fonts, `${row.tab} 按钮字号`).toHaveLength(1);
      expect(row.radii, `${row.tab} 按钮圆角`).toHaveLength(1);
      expect(row.heights[0]).toBeGreaterThanOrEqual(30);
    }

    const footer = await page.evaluate(() => {
      const read = (id: string) => {
        const el = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          slot: el.getAttribute("data-slot"),
          variant: el.getAttribute("data-variant"),
          h: Math.round(el.getBoundingClientRect().height),
          radius: cs.borderTopLeftRadius,
        };
      };
      return { done: read("settings-done"), reset: read("settings-reset") };
    });
    expect(footer.done?.slot).toBe("button");
    expect(footer.done?.variant).toBe("default");
    expect(footer.reset?.variant).toBe("ghost");
    expect(footer.done?.radius).toBe(footer.reset?.radius);
    expect(footer.done?.h).toBe(footer.reset?.h);
  });

  test("开关关闭 / 开启 / 连续切换 / 滚动时对齐稳定", async ({ page }) => {
    await fresh(page);
    await openSettings(page);
    // 用「显示秒」而不是「减少动效」：后者会切全局动效模式、连带页面布局位移，
    // 前者只改首页时钟，设置面板内的几何应当完全静止。
    // 注意 clock-seconds 这个 testid 还被首页时钟的秒位复用，必须限定在设置内容区。
    await page.getByTestId("settings-tab-modules").click();
    const sw = page.locator('[data-testid="settings-content"] [data-testid="clock-seconds"]');
    await expect(sw).toBeVisible();

    const read = () =>
      sw.evaluate((el) => {
        const root = el as HTMLElement;
        const thumb = root.querySelector('[data-slot="switch-thumb"]') as HTMLElement;
        const r = root.getBoundingClientRect();
        const t = thumb.getBoundingClientRect();
        return {
          state: root.getAttribute("data-state"),
          root: [r.x, r.y, r.width, r.height],
          thumb: [t.x, t.y, t.width, t.height],
          thumbRight: t.right,
          rootRight: r.right,
          scrollTop: document.querySelector('[data-testid="settings-content"]')?.scrollTop ?? 0,
        };
      });

    const closed = await read();
    expect(closed.state).toBe("unchecked");
    /*
     * 首页的 fit-scale 会给 main 加 `zoom`，所以这里的坐标是「设计像素 × 缩放比」。
     * 缩放比由内容高度决定，而内容高度取决于字体度量 —— macOS 与 Linux runner
     * 的字体不同，16px 会被缩成 15.x，Math.round 之后就成了 15（CI 上报的就是这个）。
     * 用轨道宽度（34 设计像素）反推 1 个设计像素的实际长度，断言就和平台无关了。
     */
    const designUnit = (snap: typeof closed) => snap.root[2] / 34;
    const dx = (snap: typeof closed) => Math.round((snap.thumb[0] - snap.root[0]) / designUnit(snap));
    const dy = (snap: typeof closed) => Math.round((snap.thumb[1] - snap.root[1]) / designUnit(snap));

    // 落位的定义是「位移等于目标值」，不是「动画列表里没有 running」
    const waitOffset = (state: string) =>
      expect
        .poll(async () => dx(await read()), { timeout: 3_000 })
        .toBe(state === "checked" ? 16 : 2);

    await sw.click();
    /*
     * 先等状态翻转，再等几何稳定。
     * 只等「几何稳定」会踩坑：点击刚发出、React 还没重渲染时，连续两次读到的是
     * **同一个旧值**，readSettled 立刻判定「稳定」并返回 —— 于是拿到未切换的快照，
     * 后续 offsets 序列整体错位（CI 上报的 [2,16,2,16] ≠ 实际）。
     */
    await expect.poll(async () => (await read()).state, { timeout: 3_000 }).toBe("checked");
    /*
     * 不要用「等动画结束」来判定落位：点击后 React 重渲染与 CSS 过渡启动之间
     * 有一帧空隙，此时 getAnimations() 里一条 running 都没有，会立刻返回**旧几何**。
     * 直接轮询几何值本身，等到它等于目标值为止 —— 这才是「落位」的定义。
     */
    await waitOffset("checked");
    const opened = await read();
    expect(opened.state).toBe("checked");

    /*
     * 「减少动效」开启会改全局 data-motion，页面自身的入场动画被关掉，
     * 行的绝对 y 本来就会变。要守的是轨道内部对齐：尺寸恒定、滑块相对轨道
     * 的上下留白恒定、水平位移精确 14px、绝不越出轨道。
     */
    expect(opened.root[2]).toBe(closed.root[2]); // 轨道宽
    expect(opened.root[3]).toBe(closed.root[3]); // 轨道高
    expect(opened.thumb[2]).toBe(closed.thumb[2]); // 滑块宽
    expect(opened.thumb[3]).toBe(closed.thumb[3]); // 滑块高
    expect(opened.thumbRight).toBeLessThanOrEqual(opened.rootRight - 1);
    expect(closed.thumbRight).toBeLessThanOrEqual(closed.rootRight - 1);


    expect(dy(opened)).toBe(2);
    expect(dy(closed)).toBe(2);
    expect(dx(opened)).toBe(16);
    expect(dx(closed)).toBe(2);

    // 连续快速切换：每次落位都回到同样的两个相对坐标，不累积偏移
    const offsets: number[] = [];
    const expectedStates = ["unchecked", "checked", "unchecked", "checked"] as const;
    for (let i = 0; i < 4; i++) {
      await sw.click();
      await expect.poll(async () => (await read()).state, { timeout: 3_000 }).toBe(expectedStates[i]!);
      await waitOffset(expectedStates[i]!);
      const s = await read();
      expect(s.root[2]).toBe(closed.root[2]);
      expect(s.root[3]).toBe(closed.root[3]);
      expect(dy(s)).toBe(2);
      expect(s.thumbRight).toBeLessThanOrEqual(s.rootRight - 1);
      offsets.push(dx(s));
    }
    /*
     * 用字符串比较而不是数组：失败时 GitHub 注解里直接显示
     * Received 的完整序列（数组 diff 会被折叠成「Array [ 2, ...」）。
     */
    expect(offsets.join(",")).toBe("2,16,2,16");

    // 滚动只改变纵向位置：控件宽度与横向坐标不漂移
    const beforeScroll = await read();
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="settings-content"]') as HTMLElement;
      el.scrollTop = 60;
    });
    const afterScroll = await readSettled(read);
    expect(afterScroll.thumb[2]).toBe(beforeScroll.thumb[2]);
    expect(afterScroll.root[0]).toBe(beforeScroll.root[0]);
  });

  test("整页任意区域右键都能唤出隐藏内容，输入框与浮层保留原生语义", async ({ page }) => {
    await fresh(page);
    await expect(page.locator(".app-shell")).toHaveAttribute("data-revealed", "false");

    // 壁纸、中轴、右侧空白、底部 Dock —— 四个完全不同的区域，手势一致
    const zones = [
      [90, 170],
      [720, 300],
      [1250, 620],
      [700, 830],
    ] as const;
    for (const [x, y] of zones) {
      await page.mouse.click(x, y, { button: "right" });
      await expect(page.getByTestId("shortcut-grid")).toBeVisible();
      await expect(page.locator(".app-shell")).toHaveAttribute("data-revealed", "true");
      // 展开后中轴整体上移，原来的坐标可能落到搜索输入框上（那里要保留原生菜单）。
      // 收起统一用左上角固定空白点，测的仍是「右键」这个手势而不是坐标。
      await page.mouse.click(90, 170, { button: "right" });
      await expect(page.getByTestId("shortcut-grid")).toHaveCount(0);
      await expect(page.locator(".app-shell")).toHaveAttribute("data-revealed", "false");
    }

    // 输入框保留浏览器原生菜单（复制 / 粘贴），右键不该把页面一起切了
    await page.getByTestId("search-input").click({ button: "right" });
    await expect(page.locator(".app-shell")).toHaveAttribute("data-revealed", "false");

    // 浮层打开时右键不改动被遮住的那层页面
    await openSettings(page);
    const before = await page.locator(".app-shell").getAttribute("data-revealed");
    await page.mouse.click(120, 120, { button: "right" });
    expect(await page.locator(".app-shell").getAttribute("data-revealed")).toBe(before);
  });

  test("toast 固定顶部居中：多条几何一致、不压一言与 Dock、浮层之上可见", async ({ page }) => {
    await fresh(page);
    // 远程一言失败时首屏也会推一条提示，等它自然消失再采样
    await page.waitForTimeout(3200);
    await page.evaluate(() => {
      window.open = () => null;
    });
    await page.keyboard.press("Control+1");
    await expect(page.getByTestId("toast")).toContainText("打开");
    await page.keyboard.press("Control+2");
    await page.keyboard.press("Control+3");
    await expect.poll(() => page.getByTestId("toast").count()).toBeGreaterThanOrEqual(2);

    /*
     * sonner 的入场是「缩放 + 淡入」，中间帧的 width/height 与最终值不同。
     * 本地采样时动画早已结束，CI 慢一倍就会采到缩放中的卡片 —— 于是
     * 「所有卡片几何一致」这条断言假红。等 toaster 内不再有运行中的动画再读。
     */
    await page
      .waitForFunction(
        () => {
          const toaster = document.querySelector("[data-sonner-toaster]");
          if (!toaster) return false;
          return toaster.getAnimations({ subtree: true }).every((a) => a.playState !== "running");
        },
        undefined,
        { timeout: 6_000 },
      )
      .catch(() => {
        /* 拿不到动画列表时退回直接采样，由断言报具体数值 */
      });

    const info = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="toast"]')).map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
          radius: cs.borderTopLeftRadius,
          tone: el.getAttribute("data-tone"),
          icon: el.querySelector(".sp-toast-icon") !== null,
        };
      });
      const quote = document.querySelector('[data-testid="quote-slot"]')?.getBoundingClientRect();
      const dock = document.querySelector(".dock-shell")?.getBoundingClientRect();
      const toaster = document.querySelector("[data-sonner-toaster]");
      return {
        cards,
        quoteTop: quote?.top ?? 0,
        dockTop: dock?.top ?? 0,
        z: toaster ? Number(getComputedStyle(toaster).zIndex) : 0,
      };
    });

    // 全部固定顶部居中，且几何完全一致（旧版宽度随文字变、堆叠还会缩放）
    for (const c of info.cards) {
      expect(c.y).toBeLessThan(160);
      expect(c.x).toBe(info.cards[0]!.x);
      expect(c.w).toBe(info.cards[0]!.w);
      expect(c.h).toBe(info.cards[0]!.h);
      expect(c.radius).toBe(info.cards[0]!.radius);
      expect(c.icon).toBe(true);
      expect(c.tone).toBeTruthy();
    }
    expect(info.cards.length).toBeGreaterThanOrEqual(2);
    expect(new Set(info.cards.map((c) => c.y)).size).toBe(info.cards.length);
    // 不再压住一言与 Dock
    const bottom = Math.max(...info.cards.map((c) => c.y + c.h));
    expect(info.quoteTop).toBeGreaterThan(0);
    expect(info.dockTop).toBeGreaterThan(0);
    expect(bottom).toBeLessThan(info.quoteTop);
    expect(bottom).toBeLessThan(info.dockTop);
    // 高于设置弹窗（z-50）与二级菜单（z-70）
    expect(info.z).toBeGreaterThanOrEqual(80);
  });

  test("快捷图标统一为同一套浅色 squircle，Dock 与网格比例一致", async ({ page }) => {
    await fresh(page);
    const collect = (root: string) =>
      page.evaluate((sel) => {
        return Array.from(document.querySelectorAll(`${sel} .shortcut-plate`)).map((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          // Chrome 对百分比圆角可能原样返回 "28%"，也可能解析成 px
          const raw = cs.borderTopLeftRadius;
          const ratio = raw.endsWith("%")
            ? Number.parseFloat(raw) / 100
            : Number.parseFloat(raw) / r.width;
          const img = el.querySelector(".shortcut-icon-img");
          return {
            ratio: Number(ratio.toFixed(3)),
            tinted: cs.backgroundImage.includes("gradient"),
            imgFilter: img ? getComputedStyle(img).filter : "none",
          };
        });
      }, root);

    const dock = await collect(".shortcut-dock");
    expect(dock.length).toBeGreaterThanOrEqual(13);
    for (const plate of dock) {
      expect(plate.ratio).toBeGreaterThan(0.26);
      expect(plate.ratio).toBeLessThan(0.3);
      expect(plate.tinted).toBe(true);
      // favicon 保留站点原色（上一轮整体去色，站点辨识度太差已回退）
      expect(plate.imgFilter).not.toContain("grayscale");
      // 不再给 favicon 硬叠白边滤镜
      expect(plate.imgFilter).not.toContain("drop-shadow");
    }

    await page.getByTestId("clock").click();
    await expect(page.getByTestId("shortcut-grid")).toBeVisible();
    const grid = await collect(".shortcut-grid");
    expect(grid.length).toBeGreaterThanOrEqual(13);
    expect(new Set(grid.map((p) => p.ratio))).toEqual(new Set(dock.map((p) => p.ratio)));
  });

  test("隐私与数据 / 关于 从设置页脚打开，主面板只剩五个分类且无二级菜单", async ({ page }) => {
    await fresh(page);
    await page.getByTestId("clock").click();
    await expect(page.getByTestId("shortcut-grid")).toBeVisible();
    // 设置入口首帧即存在（回归：dynamic 菜单 chunk 未到时齿轮整块缺失）
    await expect(page.getByTestId("settings-trigger")).toBeVisible();
    await page.getByTestId("settings-trigger").click();
    await expect(page.getByTestId("settings-done")).toBeVisible();

    expect(await page.locator(".settings-tab").count()).toBe(5);
    await expect(page.getByTestId("settings-tab-privacy")).toHaveCount(0);
    await expect(page.getByTestId("settings-tab-about")).toHaveCount(0);
    expect(await page.locator(".settings-nav-label").allTextContents()).toEqual(["首页", "外观与服务"]);
    await expect(page.getByTestId("settings-menu")).toHaveCount(0);

    // 页脚入口：打开隐私子弹窗，关闭后回到主面板
    await page.getByTestId("settings-open-privacy").click();
    await expect(page.getByTestId("privacy-done")).toBeVisible();
    await expect(page.getByTestId("whitelist-input")).toBeVisible();
    await expect(page.getByTestId("export-config")).toBeVisible();
    await page.getByTestId("privacy-done").click();
    await expect(page.getByTestId("settings-done")).toBeVisible();

    await page.getByTestId("settings-open-about").click();
    await expect(page.getByTestId("about-done")).toBeVisible();
    await expect(page.getByTestId("about-copy-url")).toBeVisible();
    await expect(page.getByTestId("about-open-help")).toBeVisible();
    await page.getByTestId("about-done").click();
    await expect(page.getByTestId("settings-done")).toBeVisible();

    // 站点图标开关跟着站点列表走
    await page.getByTestId("settings-tab-shortcuts").click();
    await expect(page.getByTestId("icons-autofetch")).toBeVisible();
  });

  test("设置搜索：陈旧关键词不再留空白面板，无结果给出空状态", async ({ page }) => {
    await fresh(page);
    await openSettings(page);
    const search = page.getByTestId("settings-search");

    // 「暗角」原先写在常规页的关键词里、实际已迁到背景页，搜索会停在原地隐藏全部卡片
    await search.fill("暗角");
    await expect(page.getByTestId("settings-tab-background")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("settings-search-count")).not.toHaveText("0 项");
    await expect(page.getByTestId("background-vignette")).toBeVisible();

    // 「快捷键」原先只在关于页的关键词里、正文却没有，跳转后是一整块空白
    await search.fill("快捷键");
    await expect(page.getByTestId("settings-search-empty")).toBeVisible();
    await page.getByTestId("settings-search-clear").click();
    await expect(page.getByTestId("settings-search-empty")).toHaveCount(0);

    await search.fill("zzzz不存在");
    await expect(page.getByTestId("settings-search-empty")).toBeVisible();
    await expect(page.getByTestId("settings-search-empty")).toContainText("没有找到");
    await page.getByTestId("settings-search-clear").click();
    await expect(page.getByTestId("settings-search")).toHaveValue("");
  });

  test("设置内容区的滚动渐隐标记与实际溢出始终一致", async ({ page }) => {
    await fresh(page);
    await openSettings(page);
    const read = () =>
      page.evaluate(() => {
        const el = document.querySelector('[data-testid="settings-content"]') as HTMLElement;
        return { flag: el.getAttribute("data-scrollable"), real: el.scrollHeight - el.clientHeight > 4 };
      });

    // 来回切换长短页签：旧版只观察滚动容器，标记会反过来（不滚的标 true、要滚的标 false）
    for (const tab of ["shortcuts", "appearance", "shortcuts", "background", "appearance"]) {
      await page.getByTestId(`settings-tab-${tab}`).click();
      await expect.poll(async () => {
        const r = await read();
        return r.flag === String(r.real);
      }).toBe(true);
    }
  });

  test("时钟阴影是宽而无边界的环境光，没有暗圆盘与黑雾投影", async ({ page }) => {
    await fresh(page);
    const styles = await page.evaluate(() => {
      const clock = document.querySelector(".home-clock") as HTMLElement;
      const after = getComputedStyle(clock, "::after");
      const before = getComputedStyle(clock, "::before");
      const digits = document.querySelector(".home-clock .clock-digits") as HTMLElement;
      const cs = getComputedStyle(digits);
      return {
        veil: after.backgroundImage,
        veilFilter: after.filter,
        veilWidth: parseFloat(after.width) / clock.getBoundingClientRect().width,
        hoverPeak: before.backgroundImage,
        shadow: cs.textShadow,
      };
    });
    // 四个色标一路衰减到全透明、且范围远大于时钟本体 —— 人眼找不到边界
    expect(styles.veil).toContain("rgba(6, 10, 18, 0) 100%");
    expect(styles.veilWidth).toBeGreaterThan(2);
    expect(styles.veilFilter).toBe("none");
    // 不再有 0.5 的深色盘与 24/56px 的高不透明度黑晕
    expect(styles.veil).not.toContain("0.5");
    expect(styles.shadow).not.toContain("56px");
    expect(styles.shadow).not.toContain("24px");
    expect(styles.shadow.split("rgba").length - 1).toBe(2);
    expect(styles.hoverPeak).not.toContain("0.68");
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
    //   ② 图片类请求只允许站点自身的图标路径（想全关就去设置里关抓取）。
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

    const whitelist = ["v1.hitokoto.cn", "api.bing.com", "bing.biturl.top", "www.bing.com"];
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

    // 图标抓取会按候选顺序探测：apple-touch-icon → favicon.ico → png → svg
    const ICON_TRACE = /\/(apple-touch-icon(-precomposed)?\.png|favicon\.(ico|png|svg))(\?|$)/;
    const isFaviconTrace = (r: { url: string; from: string }) =>
      ICON_TRACE.test(r.url) || ICON_TRACE.test(r.from);
    const imageOffenders = external
      .filter((r) => allowedHost(r.url) ? false : !isFaviconTrace(r))
      .map((r) => r.url);
    expect(imageOffenders, `非法外部请求：${imageOffenders.join(", ")}`).toEqual([]);

    // 关掉每日壁纸 + 关掉图标抓取 + 一言切回本地库后，reload 应当一次外部请求都不发
    await openSettings(page);
    await page.getByTestId("settings-tab-background").click();
    await page.getByTestId("background-edge").click();
    await page.getByTestId("settings-tab-shortcuts").click();
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
  test("默认 Bing，表单可原生提交", async ({ page }) => {
    await fresh(page);
    await expect(page.getByTestId("engine-name")).toHaveText("Bing");
    const form = page.getByTestId("search-form");
    await expect(form).toHaveAttribute("method", "get");
    await expect(form).toHaveAttribute("action", /bing\.com/);
  });

  test("左侧引擎图标与搜索键比例协调", async ({ page }) => {
    await fresh(page);
    await page.getByTestId("search-input").click();
    await expect(page.getByTestId("engine-button")).toHaveCSS("opacity", "1");

    const sizes = await page.evaluate(() => {
      const badge = document.querySelector('[data-testid="engine-badge"]') as HTMLElement;
      const glyph = badge.querySelector("svg")?.getBoundingClientRect().width ?? 0;
      const submit = document.querySelector('[data-testid="search-submit"] svg')?.getBoundingClientRect().width ?? 0;
      return { badge: badge.getBoundingClientRect().width, glyph, submit };
    });
    // 徽标 28px、图形 18px：与右侧 18px 的搜索键同一量级，不再缩成 11px 的小点
    expect(sizes.badge).toBeGreaterThanOrEqual(27);
    expect(sizes.glyph).toBeGreaterThanOrEqual(17);
    expect(Math.abs(sizes.glyph - sizes.submit)).toBeLessThanOrEqual(4);
  });

  test("点击引擎按钮弹出列表，选定后切换并收起", async ({ page }) => {
    await fresh(page);
    // 新交互：未聚焦时引擎图标隐身，先点输入框让它淡入
    await page.getByTestId("search-input").click();
    await expect(page.getByTestId("engine-button")).toHaveCSS("opacity", "1");
    await page.getByTestId("engine-button").click();
    await expect(page.getByTestId("engine-menu")).toBeVisible();
    // 点开只是摊开列表，不会自动跳到下一个引擎
    await expect(page.getByTestId("engine-name")).toHaveText("Bing");
    await expect(page.getByTestId("engine-option-bing")).toHaveAttribute("aria-checked", "true");

    await page.getByTestId("engine-option-baidu").click();
    await expect(page.getByTestId("engine-name")).toHaveText("百度");
    await expect(page.getByTestId("engine-menu")).toBeHidden();

    // 再点一次按钮：重新摊开列表，当前项是百度
    await page.getByTestId("engine-button").click();
    await expect(page.getByTestId("engine-menu")).toBeVisible();
    await expect(page.getByTestId("engine-option-baidu")).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("engine-menu")).toBeHidden();
  });

  test("搜索栏三态：默认只留模糊胶囊，悬停加深，聚焦图标淡入并轻微放大", async ({ page }) => {
    await fresh(page);
    const shell = page.getByTestId("search-shell");
    const input = page.getByTestId("search-input");

    const read = () =>
      page.evaluate(() => {
        const shellEl = document.querySelector('[data-testid="search-shell"]') as HTMLElement;
        const cs = getComputedStyle(shellEl);
        return {
          bg: cs.backgroundColor,
          transform: cs.transform,
          focused: shellEl.getAttribute("data-focused"),
          engineOpacity: getComputedStyle(document.querySelector('[data-testid="engine-button"]') as HTMLElement).opacity,
          submitOpacity: getComputedStyle(document.querySelector('[data-testid="search-submit"]') as HTMLElement).opacity,
          inputPad: getComputedStyle(document.querySelector('[data-testid="search-input"]') as HTMLElement).paddingLeft,
        };
      });

    const base = await read();
    expect(base.focused).toBe("false");
    // 未聚焦：两枚图标完全隐身，只剩一条模糊胶囊
    expect(Number(base.engineOpacity)).toBe(0);
    expect(Number(base.submitOpacity)).toBe(0);
    expect(base.transform).toBe("none");
    expect(base.inputPad).toBe("20px");

    // 悬停：底色变深（解析成 rgb 后比亮度）
    await shell.hover();
    await expect.poll(async () => (await read()).bg, { timeout: 4_000 }).not.toBe(base.bg);
    const hover = await read();
    expect(hover.bg).not.toBe(base.bg);

    // 聚焦：图标淡入、胶囊放大、输入框收内距
    await input.click();
    // 内距与缩放都在过渡里：等目标值真的到位
    await expect.poll(async () => (await read()).inputPad, { timeout: 4_000 }).toBe("4px");
    const focus = await read();
    expect(focus.focused).toBe("true");
    expect(Number(focus.engineOpacity)).toBeGreaterThan(0.9);
    expect(Number(focus.submitOpacity)).toBeGreaterThan(0.9);
    expect(focus.transform).not.toBe("none");
    expect(focus.inputPad).toBe("4px");

    // 失焦后回到隐身态
    await page.mouse.click(1200, 240);
    await expect.poll(async () => (await read()).transform, { timeout: 4_000 }).toBe("none");
    const blurred = await read();
    expect(Number(blurred.engineOpacity)).toBe(0);
    expect(blurred.transform).toBe("none");
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
    expect(opened[0][0]).toContain("bing.com");
    expect(decodeURIComponent(opened[0][0])).toContain("playwright e2e");
    expect(opened[0][1]).toBe("_blank");
    expect(opened[0][2]).toContain("noopener");
  });

  test("回车与点搜索按钮都在新标签打开；空提交直接进当前引擎官网", async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => {
      (window as unknown as { __opened: unknown[][] }).__opened = [];
      /*
       * 只记录参数，不真开窗口。
       * 早先这里调用原始 window.open，会真的弹出一个新标签并把本页焦点抢走 ——
       * 而搜索键是「聚焦才可见」的控件（visibility:hidden + pointer-events:none），
       * 于是后续点击经常打在一个不可见的按钮上，Playwright 一路重试到 30s 超时。
       * 本用例要验的是「提交时把哪个 URL 交给了 window.open」，与是否真开窗无关。
       */
      window.open = (...args: unknown[]) => {
        (window as unknown as { __opened: unknown[][] }).__opened.push(args);
        return null;
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
    expect((await readOpened())[0][0]).toContain("bing.com");
    expect(page.url()).toBe(urlBefore);

    // ② 有内容 + 点搜索按钮 → 同样在新标签
    // 图标随焦点显隐：等 data-focused 真的为 true 再点提交键
    await input.click();
    await expect(page.getByTestId("search-shell")).toHaveAttribute("data-focused", "true");
    await page.getByTestId("search-submit").click();
    await expect.poll(readOpened).toHaveLength(2);
    expect((await readOpened())[1][0]).toContain("hello");
    expect((await readOpened())[1][1]).toBe("_blank");

    // ③ 清空后提交 → 直接打开当前引擎官网（不是拒绝）
    await input.click();
    await expect(page.getByTestId("search-shell")).toHaveAttribute("data-focused", "true");
    await settleAnimations(page, '[data-testid="search-shell"]');
    await input.fill("");
    await page.getByTestId("search-submit").click();
    await expect.poll(readOpened).toHaveLength(3);
    expect((await readOpened())[2][0]).toMatch(/^https:\/\/www\.bing\.com\/?$/);
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
    // 图标层：确实发生了位移/放大（spring 动画异步落位，等它一帧）
    await expect
      .poll(
        () =>
          item.evaluate((el) => {
            const wrap = el.querySelector(".shortcut-icon-wrap");
            return wrap ? getComputedStyle(wrap).transform : "none";
          }),
        { timeout: 2000 },
      )
      .not.toBe("none");
  });

  test("快捷项可前后调序，顺序持久化到刷新后", async ({ page }) => {
    await fresh(page);
    await openShortcutSettings(page);
    const before = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("startpage.config.v1") ?? "{}").groups?.[0]?.items?.map(
        (i: { id: string }) => i.id,
      ),
    );
    const rows = page.getByTestId("shortcut-list").locator("[data-shortcut-id]");
    const firstBox = await rows.nth(0).boundingBox();
    const handle = await rows.nth(1).getByTestId(/^shortcut-drag-/).boundingBox();
    expect(firstBox).not.toBeNull();
    expect(handle).not.toBeNull();
    // 真拖拽：按住把手把第二项拖到第一项上方
    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle!.x + handle!.width / 2, firstBox!.y + 2, { steps: 14 });
    await page.mouse.up();
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

  test("拖动排序时图标不退回字母或 favicon.ico（候选链断点续传）", async ({ page }) => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    // 每个站点都「没有 /favicon.ico、有 apple-touch-icon」：
    // 正常状态下所有图标都应停在第二条候选上；一旦某次重挂载把候选链重置，
    // 它会退回 favicon.ico（404）并短暂露成首字母 —— 正是用户看到的「错乱」。
    await page.route("**/favicon.ico", (route) => route.fulfill({ status: 404, contentType: "text/plain", body: "" }));
    await page.route("**/apple-touch-icon.png", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: png }),
    );

    await fresh(page);
    await openShortcutSettings(page);

    const read = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid="shortcut-list"] [data-shortcut-id]')).map((row) => {
          const img = row.querySelector(".shortcut-icon-img");
          return {
            id: row.getAttribute("data-shortcut-id"),
            src: img?.getAttribute("src") ?? null,
            loaded: img?.getAttribute("data-loaded") ?? null,
          };
        }),
      );

    await expect
      .poll(async () => {
        const rows = await read();
        return rows.length > 0 && rows.every((r) => r.src?.endsWith("/apple-touch-icon.png") && r.loaded === "true");
      })
      .toBe(true);

    const rows = page.getByTestId("shortcut-list").locator("[data-shortcut-id]");
    const handle = await rows.nth(0).getByTestId(/^shortcut-drag-/).boundingBox();
    const target = await rows.nth(2).boundingBox();
    expect(handle).not.toBeNull();
    expect(target).not.toBeNull();

    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle!.x + handle!.width / 2, target!.y + target!.height - 4, { steps: 10 });
    await page.waitForTimeout(220);

    // 拖动过程中：拖起来的那一项也仍然显示原图标，而不是退回 .ico / 字母
    const during = await read();
    expect(during.length).toBe(13);
    expect(during.every((r) => r.src?.endsWith("/apple-touch-icon.png"))).toBe(true);
    expect(during.every((r) => r.loaded === "true")).toBe(true);

    await page.mouse.up();
  });

  test("Dock 在本地配置就绪前不可见，就绪后从下方浮入", async ({ page, request }) => {
    // 服务端首帧仍渲染出厂列表（无 JS 时可用），但胶囊是透明的，
    // 用户不会看到「默认列表被本地列表替换」的那一帧。
    const html = await (await request.get("/")).text();
    expect(html).toContain('data-ready="false"');
    expect(html).toContain("sc-zhuux");

    await fresh(page);
    await expect(page.locator(".dock-shell")).toHaveAttribute("data-ready", "true");
    await expect
      .poll(() => page.locator(".dock-pill").evaluate((el) => getComputedStyle(el).opacity), { timeout: 2000 })
      .toBe("1");
  });

  test("本地配置与出厂列表不同时，首个可见帧就是最终布局（无旧列表残留）", async ({ page }) => {
    /**
     * 回归：本地配置到达的那一帧，AnimatePresence 会把被删掉的出厂项保留 160ms
     * 播退出动画、同 id 换位的项会从默认位置做 layout 滑动；胶囊同时在淡入，
     * 于是用户先看到「旧布局 + 新布局」叠在一起，再变回最终布局。
     *
     * 这里用 rAF 记录 data-ready=true 之后的每一帧：项数与顺序必须从第一帧起
     * 就等于本地配置，不允许出现 13 项（出厂）或 23 项（出厂 + 新列表）的中间帧。
     */
    await page.addInitScript(() => {
      const w = window as unknown as { __dockReady?: Array<{ n: number; ids: string }> };
      w.__dockReady = [];
      const tick = () => {
        const shell = document.querySelector(".dock-shell");
        if (shell?.getAttribute("data-ready") === "true") {
          const dock = document.querySelector('[data-testid="shortcut-dock"]');
          const ids = Array.from(dock?.querySelectorAll("[data-shortcut-id]") ?? []).map((n) =>
            n.getAttribute("data-shortcut-id"),
          );
          w.__dockReady!.push({ n: ids.length, ids: ids.join(",") });
        }
        if ((w.__dockReady?.length ?? 0) < 80) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `sc-custom-${i}`,
      title: `站点 ${i}`,
      url: `https://example.com/${i}`,
      iconKind: "letter",
      iconValue: "",
      color: "#64748B",
    }));
    await fresh(page, { groups: [{ id: "grp-main", name: "快捷跳转", items }] });
    await expect(page.getByTestId("shortcut-total")).toHaveText("10");
    await page.waitForTimeout(400);

    const frames = await page.evaluate(
      () => (window as unknown as { __dockReady?: Array<{ n: number; ids: string }> }).__dockReady ?? [],
    );
    expect(frames.length).toBeGreaterThan(0);
    const expected = items.map((i) => i.id).join(",");
    expect(frames.every((f) => f.n === 10 && f.ids === expected)).toBe(true);
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
    await fresh(page, { home: { simple: false }, quote: { show: true, source: "local" } });
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
    await fresh(page, { home: { simple: false }, quote: { show: true, source: "local" } });
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
    await page.getByTestId("theme-toggle").focus();
    await expect(section).toHaveAttribute("data-dimmed", "false");
    await expect.poll(opacityOf, { timeout: 2000 }).toBe(1);
  });
});

test.describe("背景与主题", () => {
  test("每日壁纸开关与暗化滑杆生效", async ({ page }) => {
    // 第⑥项改造（m03287）：Magic UI Backgrounds 全部移除，背景只有两种来源 ——
    // Edge 每日壁纸（默认开）与渐变兜底。这里验证开关与暗化滑杆都真的落到配置上。
    await fresh(page);
    await openSettings(page);
    await page.getByTestId("settings-tab-background").click();

    await expect(page.getByTestId("background-edge")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("background-edge").click();
    await expect(page.getByTestId("background-edge")).toHaveAttribute("aria-checked", "false");

    // Radix thumb 不能 fill，用键盘设到 60（End=70，左移 10 格）。
    const dimThumb = page.getByTestId("wallpaper-dim").getByRole("slider");
    await dimThumb.focus();
    await dimThumb.press("End");
    for (let i = 0; i < 10; i += 1) await dimThumb.press("ArrowLeft");
    await page.getByTestId("settings-done").click();

    const scrim = await page.evaluate(
      () => getComputedStyle(document.querySelector(".wallpaper-scrim") as Element).opacity,
    );
    expect(Number(scrim)).toBeGreaterThan(0);

    // 关掉每日壁纸后应只剩渐变兜底，且根节点 data-bg-source 不再是 edge
    await expect(page.getByTestId("wallpaper")).toHaveAttribute("data-bg-source", "none");
  });

  test("在设置里切换主题", async ({ page }) => {
    await fresh(page);
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await openSettings(page);
    // 常规设置是默认分区，主题模式直接在第一组里
    await page.getByTestId("theme-mode").getByText("亮色").click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("light");
    expect(before).not.toBe("light");
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
  test("经典布局下关闭模块后首页不再渲染对应组件，刷新后保持", async ({ page }) => {
    await fresh(page, { home: { simple: false }, quote: { show: true, source: "local" } });
    await expect(page.getByTestId("quote-card")).toBeVisible();
    await openSettings(page);
    await page.getByTestId("settings-tab-modules").click();
    await page.getByTestId("quote-show").click();
    await page.getByTestId("settings-done").click();
    await expect(page.getByTestId("quote-card")).toBeHidden();

    await page.reload();
    await expect(page.getByTestId("quote-card")).toBeHidden();
  });

  test("一键清除全部数据需二次确认，且清空后回到出厂配置", async ({ page }) => {
    await fresh(page, { theme: { mode: "light", accent: "#12A150" } });
    await openSettingsDialog(page, "privacy");
    await page.getByTestId("clear-data").click();
    await expect(page.getByTestId("confirm-ok")).toBeVisible();
    await page.getByTestId("confirm-ok").click();
    await expect(page.getByTestId("toast")).toContainText("本地数据已清空");
    // 先关隐私子弹窗，再关主面板
    await page.getByTestId("privacy-done").click();
    await page.getByTestId("settings-done").click();

    await expect.poll(async () => (await readConfig(page))?.theme?.accent).toBe("#2F6FED");
  });

  test("导出配置生成 JSON 文件", async ({ page }) => {
    await fresh(page);
    await openSettingsDialog(page, "privacy");
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
    await openSettings(page);
    await expect(page.getByTestId("settings-done")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("settings-done")).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-testid")))
      .toBe("settings-trigger");
  });

  test("减少动效开关写入 data-motion", async ({ page }) => {
    await fresh(page);
    await openSettings(page);
    await page.getByTestId("settings-tab-appearance").click();
    await page.getByTestId("reduce-motion").click();
    await page.getByTestId("settings-done").click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.motion))
      .toBe("reduce");
  });
});

test.describe("本轮新增：历史 / 导入 / 帮助 / 设置搜索", () => {
  test("搜索历史：独立存储、可单条删除、可清空", async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => {
      window.localStorage.setItem("startpage.search-history.v1", JSON.stringify(["react 19", "vite"]));
    });
    await page.reload();
    await page.getByTestId("search-input").focus();

    await expect(page.getByTestId("search-history")).toBeVisible();
    await expect(page.getByTestId("search-history")).toContainText("react 19");

    await page.getByTestId("search-history-remove").first().click();
    await expect(page.getByTestId("search-history")).not.toContainText("react 19");

    await page.getByTestId("search-history-clear").click();
    await expect(page.getByTestId("search-history")).toBeHidden();
    // 清空的是独立 key，配置本身不受影响
    await expect(page.getByTestId("clock")).toBeVisible();
  });

  test("书签导入：预览确认后才写入，标题与 URL 正确", async ({ page }) => {
    await fresh(page);
    await openShortcutSettings(page);
    const before = await page.getByTestId("shortcut-list").locator("li").count();

    const html = `<DL><p><DT><H3>工作</H3><DL><p>
      <DT><A HREF="https://example.com/docs">示例文档</A>
      <DT><A HREF="https://example.org/tools">示例工具</A>
    </DL><p></DL><p>`;
    await page.getByTestId("bookmarks-file").setInputFiles({
      name: "bookmarks.html",
      mimeType: "text/html",
      buffer: Buffer.from(html, "utf8"),
    });

    await expect(page.getByTestId("bookmark-preview-list")).toContainText("示例文档");
    await page.getByTestId("confirm-bookmark-import").click();
    await expect(page.getByTestId("shortcut-list").locator("li")).toHaveCount(before + 2);
    await expect(page.getByTestId("shortcut-list")).toContainText("示例工具");
  });

  test("设置搜索：跨页签跳转并隐藏未命中分区", async ({ page }) => {
    await fresh(page);
    await openSettings(page);
    await expect(page.getByTestId("settings-tab-appearance")).toHaveAttribute("aria-current", "page");

    await page.getByTestId("settings-search").fill("模糊");
    await expect(page.getByTestId("settings-tab-background")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("wallpaper-blur")).toBeVisible();
    await expect(page.getByTestId("settings-search-count")).toHaveText("1 项");

    await page.getByTestId("settings-search").fill("");
    await expect(page.getByTestId("settings-search-count")).toBeHidden();
  });

  test("按 ? 打开快捷键帮助", async ({ page }) => {
    await fresh(page);
    await page.keyboard.press("?");
    await expect(page.getByTestId("shortcut-help-list")).toBeVisible();
    await expect(page.getByTestId("shortcut-help-list")).toContainText("命令面板");
    await page.getByTestId("shortcut-help-close").click();
    await expect(page.getByTestId("shortcut-help-list")).toBeHidden();
  });
});
