import { chromium } from "playwright";

const BASE_URL = process.env.E2E_URL ?? "http://localhost:5199/";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8080";
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

// 1) create a live ticket with a real file
await fetch(`${API_URL}/api/_debug/reset`).catch(() => {});
await page.goto(BASE_URL);
await page.waitForSelector("text=Good morning, Sarah");
await page.click('header >> text=New Request');
await page.click("text=Use sample email (demo)");
await page.setInputFiles('input[type="file"]', {
  name: "Vandelay_Security_Q.xlsx",
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  buffer: Buffer.from("dummy"),
});
await page.click("text=Extract Intake Information");
await page.waitForSelector("text=All required intake fields resolved", { timeout: 15000 });
await page.click("text=Next: Analyse Form");
await page.waitForSelector("text=Department Grouping — 8 questions", { timeout: 15000 });

// 2) reload: the ticket must come back from the backend, not local memory
await page.goto(BASE_URL);
// Wait for the stable live-data marker instead of the short-lived toast.
await page.waitForSelector("text=Live data:", { timeout: 10000 });
await page.click('nav >> text=Tickets');
await page.waitForSelector('tr:has-text("Vandelay Industries")');
const row = page.locator('tr:has-text("Vandelay Industries")').first();
if (!(await row.textContent())?.includes("TK-9001")) errors.push("Persist: loaded ticket id not TK-9001");

// 3) hydrated ticket continues the workflow: regenerate suggestions via grouping
await row.click();
await page.waitForSelector("text=Back: Grouping");
await page.click("text=Back: Grouping");
await page.waitForSelector("text=Department Grouping — 8 questions");
await page.click("text=Next: Match Knowledge Answers");
await page.waitForSelector("text=AI Suggested Answer — best match", { timeout: 15000 });

// 4) KB module now shows live backend entries
await page.click('nav >> text=Knowledge Base');
await page.waitForSelector("text=Security FAQ — ISO 27001 & SOC 2");
if (!(await page.isVisible("text=LIVE BACKEND DATA"))) errors.push("KB: live entries not loaded");

console.log(errors.length ? "FAIL:\n" + errors.join("\n") : "PERSIST SMOKE OK");
await browser.close();
process.exit(errors.length ? 1 : 0);
