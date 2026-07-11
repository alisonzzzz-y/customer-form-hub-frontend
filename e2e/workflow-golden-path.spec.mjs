import { chromium } from "playwright";

const BASE_URL = process.env.E2E_URL ?? "http://localhost:5199/";

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  // network noise is expected when the backend is offline (graceful fallback)
  if (m.type() === "error" && !m.text().includes("net::") && !m.text().includes("Failed to load resource"))
    errors.push("console: " + m.text());
});

await fetch("http://localhost:8080/api/_debug/reset").catch(() => {});
await page.goto(BASE_URL);
await page.waitForSelector("text=Good morning, Sarah");

// ── New Request: paste email → extract → confirm → auto question extraction ──
await page.click('header >> text=New Request');
await page.waitForSelector("text=Paste the email you received from the AE");
await page.click("text=Use sample email (demo)");
await page.setInputFiles('input[type="file"]', {
  name: "Vandelay_Security_Q.xlsx",
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  buffer: Buffer.from("dummy"),
});
await page.click("text=Extract Intake Information");
// lands directly on the full-page intake check of the new ticket
await page.waitForSelector("text=TK-1030 · Vandelay Industries", { timeout: 15000 });
await page.waitForSelector("text=All required intake fields resolved");
// verify extraction hit the right values (now editable inputs in the panel)
const customer = await page.inputValue("td input >> nth=0");
if (customer !== "Vandelay Industries") errors.push(`Extract: customer=${customer}`);
const due = await page.inputValue('input[type="date"]');
if (due !== "2026-07-21") errors.push(`Extract: due=${due}`);
const urgency = await page.inputValue("td select >> nth=0");
if (urgency !== "High") errors.push(`Extract: urgency=${urgency}`);
const nda = await page.inputValue("td select >> nth=1");
if (nda !== "In Place") errors.push(`Extract: nda=${nda}`);
await page.click("text=Next: Analyse Form");
await page.waitForSelector("text=Department Grouping — 8 questions", { timeout: 15000 });
// live backend indicator + live parse toast
if (!(await page.isVisible("text=Backend live — real AI parsing & retrieval")))
  errors.push("Live: backend indicator not green");

// ── Grouping: dept tabs + move one question ──
await page.locator('button:has-text("HR")').first().click(); // switch to the HR tab
const turnoverRow = page.locator("div.flex.items-center.gap-3", { hasText: "employee turnover rate" }).first();
await turnoverRow.locator("select").selectOption("General");
// question moved out of HR tab -> General tab appears with it
await page.locator('button:has-text("General")').first().click();
if (!(await page.isVisible("text=employee turnover rate"))) errors.push("Grouping: moved question not in General tab");
await page.click("text=Next: Generate AI Answers");
await page.waitForSelector("text=AI suggestions ready — review each answer.");
await page.waitForSelector("text=of");

// ── Review: approve first (high-confidence), route one to SME ──
await page.waitForSelector("text=AI Suggested Answer — best match");
await page.getByRole("button", { name: "Approve", exact: true }).click();
await page.waitForSelector("text=Answer approved.");
// route turnover question (now in General) to SME
await page.click("text=What is your employee turnover rate?");
await page.getByRole("button", { name: "Route to SME", exact: true }).click();
await page.waitForSelector("text=SME queue.");

// resolve everything else: walk the left list, approve or route each question
const pendingItems = () =>
  page
    .locator("div.w-72 > button")
    .filter({ hasNot: page.locator('span:text-is("Approved")') })
    .filter({ hasNot: page.locator('span:text-is("SME Queued")') })
    .filter({ hasNot: page.locator('span:text-is("Rejected")') });
for (let i = 0; i < 12; i++) {
  if ((await pendingItems().count()) === 0) break;
  await pendingItems().first().click();
  await page.waitForTimeout(200);
  const approve = page.getByRole("button", { name: "Approve", exact: true });
  if ((await approve.count()) > 0 && (await approve.isEnabled().catch(() => false))) {
    await approve.click();
  } else {
    await page.getByRole("button", { name: "Route to SME", exact: true }).click();
  }
  await page.waitForTimeout(250);
}
if ((await pendingItems().count()) > 0) errors.push("Review: questions left unresolved");
try {
  await page.waitForSelector('button:has-text("Next: SME Package")', { timeout: 8000 });
} catch {
  const pills = await page.locator("div.w-72 > button span").allTextContents();
  console.log("DEBUG left-list pills:", JSON.stringify(pills));
  console.log("DEBUG progress:", await page.locator("p:has-text('resolved ·')").textContent().catch(() => "n/a"));
  throw new Error("Continue button never appeared");
}
await page.click('button:has-text("Next: SME Package")');

// ── SME package: batch send all departments at once ──
await page.waitForSelector("text=SMEs do not log into this system");
await page.click('button:has-text("Send All")');
await page.waitForSelector("text=All SME packages sent — track ETAs next.", { timeout: 15000 });

// ── ETA tracking: record ETA, mark returned ──
await page.waitForSelector("text=SME ETA Tracking — this ticket");
while ((await page.locator('button:has-text("Record ETA")').count()) > 0) {
  await page.click('button:has-text("Record ETA") >> nth=0');
  await page.fill('input[type="datetime-local"]', "2026-07-15T15:00");
  await page.click("text=Save ETA");
  await page.waitForTimeout(250);
}
while ((await page.locator('button:has-text("Record Answers")').count()) > 0) {
  await page.click('button:has-text("Record Answers") >> nth=0');
  await page.waitForSelector("text=Upload the returned Excel");
  await page.click("text=fill sample answers");
  await page.getByRole("button", { name: /Save Answers/ }).click();
  await page.waitForSelector("text=answers recorded");
  await page.waitForTimeout(250);
}
await page.click("text=Next: Final Review");

// ── Final review: complete, export, approve ──
await page.waitForSelector("text=Completeness Checklist");
await page.click("text=1 · Mark Review Complete");
await page.waitForSelector("text=Review Complete");
await page.click("text=2 · Export Response");
await page.waitForSelector("text=Confirm Export");
const dl = page.waitForEvent("download", { timeout: 10000 }).catch(() => null);
await page.click('div.fixed >> button:has-text("Export")');
await page.waitForSelector("text=exported", { timeout: 10000 });
const download = await dl;
if (download && !(await download.suggestedFilename()).includes("answers"))
  errors.push("Export: unexpected filename " + (await download.suggestedFilename()));
await page.getByRole("button", { name: "3 · Approve Ticket" }).click();
await page.waitForSelector('header ~ * >> text=Mark Sent & Close', { timeout: 5000 }).catch(() => {});
await page.click("text=Mark Sent & Close");
await page.waitForSelector("text=Ticket marked Sent and Closed.");

const calls = await (await fetch("http://localhost:8080/api/_debug/calls")).json();
const expectCalls = [
  "POST /api/tickets",
  "POST /api/questionnaire/import",
  "POST /api/knowledge-base/search",
  "POST /api/final-answers",
  "PATCH /api/questions/{id}/status",
  "PUT /api/questions/{id}",
  "POST /api/sme-requests",
  "POST /api/sme-request-questions/package",
  "GET /api/sme-requests/{id}/email",
  "PUT /api/sme-requests/{id}",
  "PATCH /api/sme-request-questions/{id}/answer",
  "PATCH /api/tickets/{id}/status",
  "GET /api/export/ticket/{id}",
];
for (const c of expectCalls) {
  if (!calls[c]) errors.push(`Backend call missing: ${c}`);
}
console.log("backend calls:", JSON.stringify(calls));
console.log(errors.length ? "FAIL:\n" + errors.join("\n") : "WORKFLOW SMOKE OK");
await browser.close();
process.exit(errors.length ? 1 : 0);
