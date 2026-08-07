import { chromium } from "playwright";

const BASE_URL = process.env.E2E_URL ?? "http://localhost:5199/";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8080";

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  // network noise is expected when the backend is offline (graceful fallback)
  if (m.type() === "error" && !m.text().includes("net::") && !m.text().includes("Failed to load resource"))
    errors.push("console: " + m.text());
});

await fetch(`${API_URL}/api/_debug/reset`).catch(() => {});
await page.goto(BASE_URL);

// Dashboard
await page.waitForSelector("text=Good morning, Sarah");
if (!(await page.isVisible("text=SME ETA Tracker"))) errors.push("Dashboard: SME tracker missing");
if (!(await page.isVisible("text=Knowledge Pending Review"))) errors.push("Dashboard: pending review card missing");

// Check that a metric card opens the filtered ticket list.
await page.click('button:has-text("Waiting SME") >> nth=0');
await page.waitForSelector('h1:has-text("Tickets")');
const statusVal = await page.inputValue("select >> nth=0");
if (statusVal !== "Waiting SME") errors.push(`Tickets: status filter not applied, got ${statusVal}`);
const rows = await page.locator("tbody tr").count();
if (rows !== 1) errors.push(`Tickets: expected 1 Waiting SME row, got ${rows}`);

// Clear filters, open ticket detail
await page.click("text=Clear");
await page.click('tr:has-text("TK-1027")');
await page.waitForSelector("text=TK-1027 · Vandelay Industries");
await page.click('button:has-text("Overview")');
if (!(await page.isVisible("text=Question Completion by Department"))) errors.push("Detail: overview missing");
await page.click('button:has-text("Workflow")');

// Workflow tab: answer review stage with card + approve
await page.waitForSelector("text=Answer Review");
await page.waitForSelector("text=AI Suggested Answer — best match");
if (!(await page.isVisible("text=Why:"))) errors.push("Review: reasoning missing");
await page.getByRole("button", { name: "Approve", exact: true }).click();
await page.waitForSelector("text=Answer approved.");

// NDA block on TK-1024 (NDA Missing) in review card
await page.click('nav >> text=Tickets');
await page.click("text=Clear").catch(() => {});
await page.click('tr:has-text("TK-1024")');
await page.click("text=Share your latest SOC 2 Type II report.");
await page.waitForSelector("text=NDA conflict");
const acceptDisabled = await page.getByRole("button", { name: "Approve", exact: true }).isDisabled();
if (!acceptDisabled) errors.push("Review: NDA block not enforcing disabled Approve");

// AI Search: hit + miss
await page.click('nav >> text=AI Search');
await page.fill('input[placeholder*="Ask a question"]', "Do we hold ISO 27001 certification?");
await page.press('input[placeholder*="Ask a question"]', "Enter");
await page.waitForSelector("text=Best match — answer drafted from approved knowledge");
if (!(await page.isVisible("text=Last updated:"))) errors.push("AI Search: metadata missing");
await page.fill('input[placeholder*="Ask a question"]', "quantum blockchain llama farming");
await page.press('input[placeholder*="Ask a question"]', "Enter");
await page.waitForSelector("text=No approved answer found.");

// Knowledge Base: pending review approve
await page.click('nav >> text=Knowledge Base');
await page.waitForSelector("text=All Entries");
await page.click("text=Pending Review >> nth=0");
await page.waitForSelector("text=Employee Background Checks");
await page.click("text=Employee Background Checks");
await page.waitForSelector('button:has-text("Approve")');
await page.click('button:has-text("Approve")');
await page.waitForSelector("text=Entry approved — now available to AI retrieval.");

// Reports
await page.click('nav >> text=Reports');
await page.click('button:has-text("Generate Report")');
await page.waitForSelector("text=AI Executive Summary");
if (!(await page.isVisible("text=Saved Reports"))) errors.push("Reports: saved record missing");

// Notifications: unread count + mark all read
await page.click('nav >> text=Notifications');
await page.waitForSelector("text=SME request overdue — InfoSec");
await page.click("text=Mark all read");
await page.waitForSelector("text=All notifications marked as read.");

// Role switch: SME hides Create Ticket
await page.click('button:has-text("Sarah Chen")');
await page.click('button:has-text("SME")');
await page.waitForSelector("text=Viewing as SME.");
if (await page.isVisible('header >> text=Create Ticket')) errors.push("Role: Create Ticket visible for SME");

console.log(errors.length ? "FAIL:\n" + errors.join("\n") : "MVP SMOKE OK");
await browser.close();
process.exit(errors.length ? 1 : 0);
