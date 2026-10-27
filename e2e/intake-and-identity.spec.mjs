import { chromium } from "playwright";

// Excel-only requests, ticket identity across an offline create, and the
// review step after a refresh.
const BASE_URL = process.env.E2E_URL ?? "http://localhost:5199/";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8080";
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

const xlsx = (name) => ({
  name,
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  buffer: Buffer.from(`dummy ${name}`),
});
const backendTickets = async () => (await fetch(`${API_URL}/api/tickets`)).json();

async function fillIntake(customer) {
  await page.fill('tr:has-text("Customer") input', customer);
  await page.fill('tr:has-text("Deadline") input[type="date"]', "2026-11-13");
  await page.selectOption('tr:has-text("Urgency level") select', "High");
  await page.selectOption('tr:has-text("NDA status") select', "In Place");
}

async function reopen(id) {
  await page.goto(BASE_URL);
  await page.waitForSelector("text=Live data:", { timeout: 15000 });
  await page.click("nav >> text=Tickets");
  await page.click(`tr:has-text("${id}")`);
}

await fetch(`${API_URL}/api/_debug/reset`).catch(() => {});
await page.goto(BASE_URL);
await page.waitForSelector("text=Good morning, Sarah");

// ── 1) neither an email nor a file: nothing is created ──
await page.click("header >> text=New Request");
await page.click("text=Extract Intake Information");
await page.waitForSelector("text=Paste the AE email or attach the customer form first.");
if ((await backendTickets()).length !== 0) errors.push("Empty request: a ticket was created");

// ── 2) Excel only: the intake check asks for the details, then parses the real file ──
await page.setInputFiles('input[type="file"]', xlsx("Acme_Only_Form.xlsx"));
await page.click("text=Extract Intake Information");
await page.waitForSelector("text=Intake incomplete");
if (!(await page.isDisabled('button:has-text("Next: Analyse Form")')))
  errors.push("Excel only: analysis allowed before the required fields were filled");
if ((await page.locator('button:has-text("Continue with demo questions")').count()) > 0)
  errors.push("Excel only: demo questions offered although a file is attached");
const created = await backendTickets();
if (created.length !== 1 || created[0].customerName !== "")
  errors.push(`Excel only: expected one ticket with no invented customer, got ${JSON.stringify(created)}`);
await fillIntake("Acme Corp");
await page.waitForSelector("text=All required intake fields resolved");
await page.click("text=Next: Analyse Form");
await page.waitForSelector("text=Department Grouping — 8 questions", { timeout: 15000 });
if (!(await page.isVisible("text=Acme_Only_Form.xlsx"))) errors.push("Excel only: summary does not name the file");
if ((await page.locator("text=Demo mode").count()) > 0) errors.push("Excel only: fell back to demo questions");

const acme = (await backendTickets())[0];
if (acme.customerName !== "Acme Corp" || acme.deadline?.slice(0, 10) !== "2026-11-13")
  errors.push(`Excel only: intake details not saved (${acme.customerName}, ${acme.deadline})`);

// ── 3) refresh during answer review: same step, matches looked up again ──
await page.click("text=Next: Match Knowledge Answers");
await page.waitForSelector("text=AI Suggested Answer", { timeout: 15000 });
await reopen("TK-9001");
await page.waitForSelector("text=Back: Grouping");
await page.waitForSelector("text=AI Suggested Answer", { timeout: 15000 });

// ── 4) created while the backend was unreachable, saved later ──
// The first create reaches the backend but its response is lost, so the
// browser keeps a temporary number. The retry must not create a second ticket.
let lost = false;
await page.route("**/api/tickets", async (route) => {
  if (lost || route.request().method() !== "POST") return route.fallback();
  lost = true;
  await route.fetch();
  return route.abort("internetdisconnected");
});
await page.goto(BASE_URL);
await page.waitForSelector("text=Live data:", { timeout: 15000 });
await page.click("header >> text=New Request");
await page.click("text=Use sample email (demo)");
await page.setInputFiles('input[type="file"]', xlsx("Offline_Form.xlsx"));
await page.click("text=Extract Intake Information");
await page.waitForSelector("text=exists only in this browser");
const heading = await page.locator("h1").first().textContent();
const tempId = heading?.match(/TK-\d+/)?.[0];
if (!tempId || !/^TK-1\d{3}$/.test(tempId)) errors.push(`Offline: expected a temporary TK-1xxx number, got ${heading}`);
await page.waitForSelector("text=All required intake fields resolved");
await page.click("text=Next: Analyse Form");
await page.waitForSelector("text=Department Grouping — 8 questions", { timeout: 15000 });
const after = await backendTickets();
if (after.length !== 2) errors.push(`Offline: expected 2 backend tickets after the retry, found ${after.length}`);
const savedId = `TK-${9000 + after[after.length - 1].id}`;
if (!(await page.locator("h1").first().textContent())?.includes(savedId))
  errors.push(`Offline: heading did not switch to ${savedId}`);
await page.click("nav >> text=Tickets");
if ((await page.locator(`tr:has-text("${tempId}")`).count()) > 0) errors.push("Offline: temporary number still listed");
await reopen(savedId);
await page.waitForSelector("text=Department Grouping — 8 questions");
if (!(await page.isVisible("text=Offline_Form.xlsx"))) errors.push("Offline: file lost after refresh");

console.log(errors.length ? "FAIL:\n" + errors.join("\n") : "INTAKE/IDENTITY OK");
await browser.close();
process.exit(errors.length ? 1 : 0);
