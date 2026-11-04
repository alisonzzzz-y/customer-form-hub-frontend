import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// The dashboard of the hosted build (no test demo data): demo tickets are never
// swapped for live ones in front of the user, the page does not move when the
// numbers arrive, startup uses bulk requests, and a return visit shows the KPI
// numbers at once.
const API_BASE = process.env.E2E_API_URL ?? "http://localhost:8080";
const API = API_BASE + "/api";
const PORT = 5198;
const URL = `http://localhost:${PORT}/`;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
  cwd: root,
  env: { ...process.env, VITE_API_BASE: API_BASE, VITE_TEST_DEMO_DATA: "false" },
  stdio: "ignore",
  detached: true,
});
for (let i = 0; i < 80; i++) {
  try {
    await fetch(URL);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 250));
  }
}

const browser = await chromium.launch();
try {
  await fetch(API + "/_debug/reset");
  await fetch(API + "/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerName: "Stable Co", ndaStatus: "Yes", status: "In Progress", assignedTo: "Sarah Chen" }),
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const apiCalls = [];
  page.on("request", (r) => {
    if (r.url().startsWith(API)) apiCalls.push(new globalThis.URL(r.url()).pathname);
  });
  // Numbers arrive after the workspace, as they do on the hosted backend.
  await page.route("**/api/dashboard/stats", async (r) => {
    await new Promise((done) => setTimeout(done, 2000));
    await r.continue();
  });
  await page.addInitScript(() => {
    window.__sawDemo = false;
    window.__shift = 0;
    new MutationObserver(() => {
      if (document.body?.innerText.includes("TK-DEMO")) window.__sawDemo = true;
    }).observe(document, { subtree: true, childList: true, characterData: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__shift += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto(URL);
  const kpiTop = async () => page.getByText("Processed", { exact: true }).evaluate((e) => e.getBoundingClientRect().top);
  // The KPI cards are there from the start, holding their place.
  await page.getByText("Processed", { exact: true }).waitFor();
  const topBefore = await kpiTop();
  await page.getByText("Live data:", { exact: false }).waitFor();
  await page.getByText("questions across 1 tickets").waitFor();
  assert.equal(await kpiTop(), topBefore, "the KPI cards moved");
  const priorityTop = await page.getByText("My Priority Tickets").evaluate((e) => e.getBoundingClientRect().top);
  await page.waitForTimeout(500);
  assert.equal(await page.getByText("My Priority Tickets").evaluate((e) => e.getBoundingClientRect().top), priorityTop);
  assert.equal(await page.evaluate(() => window.__sawDemo), false, "demo tickets were shown");
  assert.ok((await page.evaluate(() => window.__shift)) < 0.1, "the page moved while loading");

  // Startup does not ask per ticket.
  assert.deepEqual(apiCalls.filter((p) => /\/ticket\/\d+$/.test(p)), []);
  assert.ok(apiCalls.length <= 8, `startup made ${apiCalls.length} requests`);

  // A return visit shows the last numbers while the new ones are on their way.
  await page.goto(URL);
  await page.getByText("questions across 1 tickets").waitFor({ timeout: 1500 });
  assert.deepEqual(errors, []);

  // A backend that fails shows the demo workspace, marked as such, not an endless load.
  const cold = await context.newPage();
  await cold.route(API + "/**", (r) => r.abort());
  await cold.goto(URL);
  await cold.getByText("Demo date:", { exact: false }).waitFor();
  await cold.getByText("Backend unreachable", { exact: false }).waitFor();

  console.log("DASHBOARD STABILITY OK");
} finally {
  await browser.close();
  try {
    process.kill(-vite.pid);
  } catch {
    vite.kill();
  }
}
