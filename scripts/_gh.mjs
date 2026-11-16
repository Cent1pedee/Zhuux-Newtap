import { chromium } from "@playwright/test";
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1500, height: 1300 } });
await p.goto("https://github.com/Cent1pedee/Zhuux-Newtap/actions", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(4000);
const txt = await p.evaluate(() => document.body.innerText);
const start = txt.indexOf("Actions");
console.log(txt.slice(start, start + 1800));
await b.close();
