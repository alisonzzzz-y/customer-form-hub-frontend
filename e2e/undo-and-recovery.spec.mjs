import { chromium } from "playwright";

const BASE_URL = process.env.E2E_URL ?? "http://localhost:5199/";
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

await fetch("http://localhost:8080/api/_debug/reset").catch(() => {});
await page.goto(BASE_URL);
await page.waitForSelector("text=Good morning, Sarah");

// 1) Unapprove: TK-1027 approve then undo
await page.click('nav >> text=Tickets');
await page.click('tr:has-text("TK-1027")');
await page.waitForSelector("text=AI Suggested Answer — best match");
await page.getByRole("button", { name: "Approve", exact: true }).click();
await page.waitForSelector("text=Answer approved.");
// go back to the approved question (advance moved selection)
await page.click("text=Do you hold ISO27001?");
await page.waitForSelector('button:has-text("Unapprove")');
await page.click('button:has-text("Unapprove")');
await page.waitForSelector("text=Approval undone — the question is back in review.");
if (!(await page.isVisible("text=AI Suggested Answer — best match"))) errors.push("Unapprove: suggestion not restored");

// 2) KB source link → back-to-ticket banner
await page.click("text=ISO 27001 & SOC 2"); // resolves to the live KB entry title when backend is up
// entry drawer auto-opens; the back button lives inside it too
await page.waitForSelector('div.fixed button:has-text("Back to Ticket TK-1027")');
await page.click('div.fixed button:has-text("Back to Ticket TK-1027")');
await page.waitForSelector("text=TK-1027 · Microsoft");

// sidebar nav clears stale banner
await page.click('nav >> text=Knowledge Base');
if (await page.isVisible("text=Back to ticket")) errors.push("KB: stale return banner after sidebar nav");

// 3) incomplete extraction → same full-page intake check + editable clarify email
await page.click('header >> text=New Request');
await page.fill("textarea", "Hi team, can you help with a questionnaire? Thanks, Bob");
await page.click("text=Extract Intake Information");
await page.waitForSelector("text=Intake incomplete", { timeout: 10000 });
// analyse is blocked while required fields are missing
if (await page.getByRole("button", { name: /Next: Analyse Form/ }).isEnabled())
  errors.push("Intake: analyse enabled despite missing fields");
// clarify email is editable before sending
await page.click("text=email the AE to clarify");
await page.waitForSelector("text=Clarification email to AE — auto-drafted, editable");
await page.fill('div.fixed textarea', "Hi Bob — quick check on deadline and NDA?");
await page.click("text=Open in Mail App");
await page.waitForSelector("text=fill the confirmed values into the intake table by hand");
await page.click("text=Close");
// analyst fills the fields manually — banner flips to resolved
await page.fill("td input >> nth=0", "Bob's Burgers Ltd");
await page.fill('input[type="date"]', "2026-07-25");
await page.selectOption("td select >> nth=0", "Medium");
await page.selectOption("td select >> nth=1", "In Place");
await page.waitForSelector("text=All required intake fields resolved");

// 4) Back to Grouping from review
await page.goto(BASE_URL);
await page.waitForSelector("text=Good morning, Sarah");
await page.click('nav >> text=Tickets');
await page.click('tr:has-text("TK-1027")');
await page.waitForSelector("text=Back: Grouping");
await page.click("text=Back: Grouping");
await page.waitForSelector("text=Department Grouping —");
await page.click("text=Next: Generate AI Answers");
await page.waitForSelector("text=AI suggestions ready — review each answer.");

console.log(errors.length ? "FAIL:\n" + errors.join("\n") : "UNDO SMOKE OK");
await browser.close();
process.exit(errors.length ? 1 : 0);
