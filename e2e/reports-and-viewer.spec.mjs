import { chromium } from "playwright";

const BASE_URL = process.env.E2E_URL ?? "http://localhost:5199/";
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await fetch("http://localhost:8080/api/_debug/reset").catch(() => {});
await page.goto(BASE_URL);
await page.waitForSelector("text=Good morning, Sarah");
// reports: generate → open in-app viewer → export excel downloads a csv
await page.click('nav >> text=Reports');
await page.click('button:has-text("Generate Report")');
await page.waitForSelector("text=Saved Reports");
await page.click('button:has-text("Open")');
await page.waitForSelector("text=AI Executive Summary");
if (!(await page.isVisible("text=Ticket Volume"))) errors.push("Viewer: metrics missing");
const dl = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
await page.click("text=Export Excel");
const download = await dl;
if (!download || !(await download.suggestedFilename()).endsWith(".csv"))
  errors.push("Viewer: Excel export did not download a csv");
await page.getByRole("button", { name: "Close", exact: true }).click();
// review sticky bar: TK-1027, actions visible without scrolling
await page.click('nav >> text=Tickets');
await page.click('tr:has-text("TK-1027")');
await page.waitForSelector("text=AI Suggested Answer — best match");
const nextBtn = page.getByRole("button", { name: /Next Question/ });
if (!(await nextBtn.isVisible())) errors.push("Review: Next Question not visible without scroll");
console.log(errors.length ? "FAIL:\n" + errors.join("\n") : "REPORT/STICKY OK");
await browser.close();
process.exit(errors.length ? 1 : 0);
