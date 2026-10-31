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
async function setup(workflowStage = "review") {
  await api("/_debug/reset");
  const t = await api("/tickets", "POST", { customerName: "Edge Case Co", ndaStatus: "Yes", status: "In Progress", workflowStage });
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

  // A department change shows at once while the backend is still saving it,
  // and a failed save moves the question back.
  ({ t } = await setup("grouping"));
  await open();
  const firstRow = page.locator("div:has(> select)").first();
  await firstRow.waitFor();
  const text = (await firstRow.locator("p").first().textContent()).trim();
  const rowSelect = () => page.locator("div:has(> select)", { hasText: text }).locator("select");
  const savedDept = async () =>
    (await api("/questions/ticket/" + t.id)).find((x) => x.questionText === text).department;
  const from = await rowSelect().inputValue();
  const to = from === "Legal" ? "Finance" : "Legal";
  const deptTab = (d) => page.getByRole("button", { name: new RegExp(`^${d}\\s*\\d+$`) });
  await page.route("**/api/questions/*", async (r) => {
    if (r.request().method() !== "PUT") return r.continue();
    await new Promise((done) => setTimeout(done, 2000));
    await r.continue();
  });
  const started = Date.now();
  await rowSelect().selectOption(to);
  await page.getByText("Saving department assignments…").waitFor();
  await deptTab(to).click();
  assert.equal(await rowSelect().inputValue(), to);
  assert.ok(Date.now() - started < 1500, "the department was not shown before the save finished");
  assert.ok(await page.getByRole("button", { name: /Next: Match Knowledge Answers/ }).isDisabled());
  await page.getByText("Saving department assignments…").waitFor({ state: "detached" });
  assert.equal(await savedDept(), to);
  await page.unroute("**/api/questions/*");
  await page.route("**/api/questions/*", (r) =>
    r.request().method() === "PUT" ? r.fulfill({ status: 500, body: "fail" }) : r.continue());
  await rowSelect().selectOption(from);
  await page.getByText(`was not saved, so it is back in ${to}`, { exact: false }).waitFor();
  await deptTab(to).click();
  assert.equal(await rowSelect().inputValue(), to);
  assert.equal(await savedDept(), to);
  await page.unroute("**/api/questions/*");

  // Review decisions move on at once while the backend is still saving them;
  // the next step waits until every decision is saved.
  ({ t, qs } = await setup());
  await page.route(/\/api\/(final-answers|questions\/\d+\/review-escalation)$/, async (r) => {
    await new Promise((done) => setTimeout(done, 2000));
    await r.continue();
  });
  await open();
  const shownQuestion = async () => (await page.locator("h3").first().textContent()).trim();
  const first = await shownQuestion();
  const clicked = Date.now();
  await page.getByRole("button", { name: "Route to SME", exact: true }).click();
  await page.waitForFunction((was) => document.querySelector("h3")?.textContent.trim() !== was, first);
  assert.ok(Date.now() - clicked < 1000, "the next question was not shown before the save finished");
  await page.getByText("Saving 1 decision…").waitFor();
  assert.equal(await reviewCount("queued for SME"), 1);
  await page.getByText("Saving 1 decision…").waitFor({ state: "detached" });
  const routed = (await api("/questions/ticket/" + t.id)).find((x) => x.questionText === first);
  assert.equal(routed.status, "SME Needed");
  await page.unroute(/\/api\/(final-answers|questions\/\d+\/review-escalation)$/);

  // While writing a manual answer, the question can still be routed to SME.
  ({ t, qs } = await setup());
  await open();
  assert.equal(await reviewCount("queued for SME"), 0);
  await page.getByRole("button", { name: /^(Manual Answer|Edit)$/ }).click();
  await page.locator("textarea").waitFor();
  await page.getByRole("button", { name: "Route to SME" }).click();
  await page.getByText("SME queue.", { exact: false }).first().waitFor();
  assert.equal(await page.locator("textarea").count(), 0);
  assert.equal(await reviewCount("queued for SME"), 1);

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
