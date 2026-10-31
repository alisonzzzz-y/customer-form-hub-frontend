import assert from "node:assert/strict";
import { chromium } from "playwright";

// Routed questions keep their routing, ticket status buttons wait for the
// backend, and demo questions of a saved ticket are saved with it.
const API = (process.env.E2E_API_URL ?? "http://localhost:8080") + "/api";
const URL = process.env.E2E_URL ?? "http://localhost:5199";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
async function api(path, method = "GET", body) {
  const r = await fetch(API + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  assert.ok(r.ok, path);
  return r.json();
}
async function setup() {
  await api("/_debug/reset");
  const t = await api("/tickets", "POST", { customerName: "Edge Case Co", ndaStatus: "Yes", status: "In Progress", workflowStage: "review" });
  const f = new FormData(); f.append("file", new Blob(["fixture"]), "Audit.xlsx");
  await fetch(API + "/questionnaire/import?ticketId=" + t.id, { method: "POST", body: f });
  return { t, qs: await api("/questions/ticket/" + t.id) };
}
async function open() {
  await page.goto(URL);
  await page.getByText("Live data:", { exact: false }).waitFor();
  await page.click("nav >> text=Tickets");
  await page.click('tr:has-text("TK-9001")');
}
const reviewCount = async (label) => {
  const line = page.locator(`p:has-text("${label}")`).first();
  await line.waitFor();
  return Number((await line.textContent()).match(new RegExp(`(\\d+)\\s*${label}`))[1]);
};

try {
  // Going back to Grouping and confirming again keeps a question that waits
  // for the AE; it used to be matched again and shown as open for review.
  let { t, qs } = await setup();
  await api("/questions/" + qs[0].id + "/review-escalation", "POST", { type: "AE" });
  await open();
  assert.equal(await reviewCount("waiting for AE"), 1);
  await page.getByRole("button", { name: /Back: Grouping/ }).click();
  await page.getByRole("button", { name: /Next: Match Knowledge Answers/ }).click();
  await page.getByText("Knowledge matches ready", { exact: false }).waitFor();
  assert.equal(await reviewCount("waiting for AE"), 1);

  // A question routed to SME again after its request was returned is queued
  // for a new package after a refresh, not shown as waiting on the old one.
  ({ t, qs } = await setup());
  await api("/questions/" + qs[0].id + "/status", "PATCH", { status: "SME Needed" });
  const old = await api("/sme-requests", "POST", { ticketId: t.id, department: qs[0].department, teamName: "Team", status: "Requested", questionCount: 1 });
  await api("/sme-request-questions/package", "POST", { smeRequestId: old.id, ticketId: t.id, department: qs[0].department });
  await api("/sme-requests/" + old.id, "PUT", { status: "Returned", returnedAt: "2026-10-27T10:00:00", sentAt: "2026-10-26T10:00:00" });
  await open();
  assert.equal(await reviewCount("queued for SME"), 1);

  // A status change the backend does not save is not shown as done.
  ({ t } = await setup());
  await page.goto(URL);
  await page.getByText("Live data:", { exact: false }).waitFor();
  await page.click("nav >> text=Tickets");
  await page.route("**/api/tickets/*/status", (r) => r.fulfill({ status: 500, body: "fail" }));
  await page.getByRole("button", { name: "Archive TK-9001" }).click();
  await page.getByText("TK-9001 was not set to Archived", { exact: false }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Archive TK-9001" }).count(), 1);
  assert.equal((await api("/tickets/" + t.id)).status, "In Progress");
  await page.unroute("**/api/tickets/*/status");
  await page.getByRole("button", { name: "Archive TK-9001" }).click();
  await page.getByText("TK-9001 archived.", { exact: true }).waitFor();
  assert.equal((await api("/tickets/" + t.id)).status, "Archived");

  // Demo questions of a ticket saved to the backend are saved there too, so
  // they are still there after a refresh.
  await api("/_debug/reset");
  await page.goto(URL);
  // With no tickets on the backend yet there is no "Live data" banner.
  await page.getByText("Good morning, Sarah").waitFor();
  await page.click("header >> text=New Request");
  await page.click("text=Use sample email (demo)");
  await page.click("text=Extract Intake Information");
  await page.getByText("All required intake fields resolved").waitFor();
  await page.getByRole("button", { name: "Continue with demo questions" }).click();
  const heading = page.getByText(/Department Grouping — \d+ questions/);
  await heading.waitFor();
  const shown = Number((await heading.textContent()).match(/(\d+) questions/)[1]);
  const saved = (await api("/tickets")).at(-1);
  assert.equal((await api("/questions/ticket/" + saved.id)).length, shown);
  await open();
  await page.getByText(`Department Grouping — ${shown} questions`).waitFor();

  assert.deepEqual(errors, []);
  console.log("ROUTING AND STATUS SAVES OK");
} finally {
  await browser.close();
}
