import { chromium } from "@playwright/test";
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1500, height: 1200 } });
await p.goto(process.argv[2], { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(5000);
// 展开注解折叠区
for (const sel of ['summary:has-text("Annotations")', 'button:has-text("Annotations")', '[aria-label*="annotation"]']) {
  const loc = p.locator(sel).first();
  if (await loc.count()) { await loc.click({ timeout: 3000 }).catch(() => {}); }
}
await p.waitForTimeout(2500);
const txt = await p.evaluate(() => document.body.innerText);
console.log(txt.slice(0, 7000));
await b.close();
