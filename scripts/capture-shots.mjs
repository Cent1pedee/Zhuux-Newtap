import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";
const OUT = "shots";

const browser = await chromium.launch({ channel: "chrome" });

async function shot(name, { width = 1440, height = 900, theme = "dark", setup } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "zh-CN", timezoneId: "Asia/Shanghai" });
  await ctx.addInitScript(
    ([t]) => {
      try {
        localStorage.setItem(
          "startpage.config.v1",
          JSON.stringify({
            version: 1,
            theme: { mode: t, accent: "#2F6FED" },
            // 给天气一个确定的城市，截图才不会因定位授权与否而变形
            weather: {
              enabled: true,
              unit: "c",
              province: "浙江省",
              city: "杭州",
              lat: 30.27,
              lon: 120.15,
              source: "manual",
            },
          }),
        );
      } catch {}
    },
    [theme],
  );
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  if (setup) await setup(page);
  await page.screenshot({ path: `${OUT}/${name}.png` });

  const metrics = await page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      docScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      mainScroll: main ? main.scrollHeight - main.clientHeight : null,
      horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  console.log(name, JSON.stringify(metrics));
  await ctx.close();
}

await shot("01-dark-1440", {});
await shot("02-light-1440", { theme: "light" });
await shot("03-dark-1280x600", { width: 1280, height: 600 });
await shot("04-mobile-390", { width: 390, height: 844 });
await shot("05-settings-appearance", {
  setup: async (page) => {
    await page.getByTestId("settings-trigger").click();
    await page.waitForTimeout(700);
  },
});
await shot("06-settings-background", {
  setup: async (page) => {
    await page.getByTestId("settings-trigger").click();
    await page.waitForTimeout(500);
    await page.getByTestId("settings-tab-background").click();
    await page.waitForTimeout(600);
  },
});
await shot("07-wallpaper-off", {
  setup: async (page) => {
    await page.getByTestId("settings-trigger").click();
    await page.waitForTimeout(500);
    await page.getByTestId("settings-tab-background").click();
    await page.waitForTimeout(400);
    await page.getByTestId("background-edge").click();
    await page.getByTestId("settings-done").click();
    await page.waitForTimeout(900);
  },
});
await shot("08-wallpaper-offset-light", {
  theme: "light",
  setup: async (page) => {
    await page.getByTestId("settings-trigger").click();
    await page.waitForTimeout(500);
    await page.getByTestId("settings-tab-background").click();
    await page.waitForTimeout(400);
    await page.getByText("-3 天", { exact: true }).click();
    await page.getByTestId("settings-done").click();
    await page.waitForTimeout(2200);
  },
});
await shot("09-shortcut-manager", {
  setup: async (page) => {
    await page.getByTestId("settings-trigger").click();
    await page.waitForTimeout(500);
    await page.getByTestId("settings-tab-shortcuts").click();
    await page.waitForTimeout(600);
  },
});
await shot("10-palette", {
  setup: async (page) => {
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(700);
  },
});

await shot("11-focus-search", {
  setup: async (page) => {
    await page.getByTestId("search-input").click();
    await page.waitForTimeout(700);
  },
});
await shot("12-hover-shortcut", {
  setup: async (page) => {
    await page.getByTestId("shortcut-sc-github").hover();
    await page.waitForTimeout(450);
  },
});
await shot("13-settings-modules", {
  setup: async (page) => {
    await page.getByTestId("settings-trigger").click();
    await page.waitForTimeout(500);
    await page.getByTestId("settings-tab-modules").click();
    await page.waitForTimeout(600);
  },
});
await shot("14-light-1280x600", { width: 1280, height: 600, theme: "light" });
await shot("15-settings-search", {
  setup: async (page) => {
    await page.getByTestId("settings-trigger").click();
    await page.waitForTimeout(450);
    await page.getByTestId("settings-tab-search").click();
    await page.waitForTimeout(700);
  },
});
await shot("15b-settings-privacy", {
  setup: async (page) => {
    await page.getByTestId("settings-trigger").click();
    await page.waitForTimeout(450);
    await page.getByTestId("settings-tab-privacy").click();
    await page.waitForTimeout(600);
  },
});
await shot("16-shortcut-editor", {
  setup: async (page) => {
    await page.getByTestId("settings-trigger").click();
    await page.waitForTimeout(450);
    await page.getByTestId("settings-tab-shortcuts").click();
    await page.waitForTimeout(450);
    await page.getByTestId("add-shortcut").click();
    await page.waitForTimeout(400);
    await page.getByTestId("shortcut-title").fill("哔哩哔哩");
    await page.getByTestId("shortcut-url").fill("https://www.bilibili.com");
    await page.waitForTimeout(900);
  },
});
await shot("17-note-on", {
  // 直接输入而不是预置到 localStorage —— addInitScript 每次导航都会重置存储，
  // reload 之后刚写入的便签内容会被覆盖回默认值，截出来是一张空卡。
  setup: async (page) => {
    const area = page.getByTestId("note-input");
    await area.click();
    await area.type("买牛奶\n写周报\n回邮件");
    // 输完把焦点挪走：输入框聚焦会让整张壁纸加深模糊（那是聚焦模式，不是这张图想展示的）
    await page.getByTestId("clock").click();
    await page.waitForTimeout(900);
  },
});

await browser.close();
console.log("done");
