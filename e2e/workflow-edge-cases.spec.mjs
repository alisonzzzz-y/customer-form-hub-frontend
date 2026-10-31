import assert from "node:assert/strict";
import { chromium } from "playwright";
const API = (process.env.E2E_API_URL ?? "http://localhost:8080") + "/api";
const URL = process.env.E2E_URL ?? "http://localhost:5199";
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", e => errors.push(e.message));
async function api(path, method = "GET", body) {
  const r = await fetch(API + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  assert.ok(r.ok, path);
  return r.json();
}
async function setup(nda = "Yes") {
  await api("/_debug/reset");
  const t = await api("/tickets", "POST", { customerName: "Edge Case Co", ndaStatus: nda, status: "In Progress", workflowStage: "review" });
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
try {
  let { t, qs } = await setup();
  await api("/questions/" + qs[0].id + "/status", "PATCH", { status: "SME Needed" });
  const req = await api("/sme-requests", "POST", { ticketId: t.id, department: "InfoSec", teamName: "InfoSec Team", status: "Requested", questionCount: 1 });
  await api("/sme-request-questions/package", "POST", { smeRequestId: req.id, ticketId: t.id, department: "InfoSec" });
  // Answers can only be recorded for a package that was sent.
  await api("/sme-requests/" + req.id, "PUT", { status: "Waiting for ETA", sentAt: "2026-10-27T10:00:00" });
  await api("/tickets/" + t.id, "PUT", { workflowStage: "eta" });
  await open();
  await page.getByRole("button", { name: "Record Answers", exact: true }).click();
  const file = { name: "returned.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("fixture") };
  // Parser behavior is covered with real workbooks in backend tests.
  // Here verify rejection, preview, and preservation at the browser/API boundary.
  await page.route("**/import-preview", r => r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Invalid Excel workbook." }) }));
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByText("Invalid Excel workbook.", { exact: true }).waitFor();
  assert.equal(await page.locator("textarea").inputValue(), "");
  assert.ok(await page.getByRole("button", { name: /^Save Answers/ }).isDisabled());
  await page.unroute("**/import-preview");
  await page.route("**/import-preview", r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ [qs[0].id]: "Actual returned answer 71923" }) }));
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByText("Read 1 answer(s)", { exact: false }).waitFor();
  assert.equal(await page.locator("textarea").inputValue(), "Actual returned answer 71923");
  await page.locator("textarea").fill("Reviewer correction");
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByText("No new answers to import.", { exact: false }).waitFor();
  assert.equal(await page.locator("textarea").inputValue(), "Reviewer correction");
  await page.route("**/api/final-answers", r => r.fulfill({ status: 500, body: "Save failed" }));
  await page.getByRole("button", { name: /^Save Answers/ }).click();
  await page.getByText("The SME answers were not fully saved.", { exact: false }).waitFor();
  assert.equal(await page.locator("textarea").inputValue(), "Reviewer correction");
  await page.unroute("**/api/final-answers");
  await page.getByRole("button", { name: /^Save Answers/ }).click();
  await page.getByText("SME answers recorded", { exact: false }).waitFor();
  await page.unroute("**/import-preview");
  ({ t, qs } = await setup());
  await open();
  await page.getByRole("button", { name: "Approve", exact: true }).waitFor();
  await page.route("**/api/final-answers", r => r.fulfill({ status: 500, body: "Save failed" }));
  // The decision shows at once; when its save fails the question goes back
  // to review and nothing is recorded on the backend.
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByText("was not saved, so it is back as it was", { exact: false }).waitFor();
  assert.notEqual((await api("/questions/ticket/" + t.id))[0].status, "Answered");
  await page.unroute("**/api/final-answers");
  await page.getByRole("button").filter({ hasText: "Do you hold ISO27001?" }).click();
  await page.locator("h3").filter({ hasText: "Do you hold ISO27001" }).waitFor();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.locator("h3").filter({ hasText: "Describe how data is encrypted" }).waitFor();
  assert.equal((await api("/questions/ticket/" + t.id))[0].status, "Answered");
  await open();
  await page.getByRole("button").filter({ hasText: "Do you hold ISO27001?" }).click();
  await page.getByRole("button", { name: "Unapprove", exact: true }).waitFor();

  // An answer saved to the Knowledge Base from review reaches the backend as a
  // new Pending Review entry (it used to stay in this browser only).
  const kbBefore = (await api("/knowledge-base")).length;
  await page.getByRole("button").filter({ hasText: "Describe how data is encrypted" }).first().click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator("textarea").fill("Reviewer-written encryption answer 50417");
  await page.getByLabel("Save to Knowledge Base after approval (Pending Review)").check();
  await page.getByRole("button", { name: "Save & Approve", exact: true }).click();
  await page.getByText("Saved to Knowledge Base as Pending Review.", { exact: true }).waitFor();
  const kbAfter = await api("/knowledge-base");
  assert.equal(kbAfter.length, kbBefore + 1);
  const savedEntry = kbAfter.find((k) => k.content === "Reviewer-written encryption answer 50417");
  assert.equal(savedEntry?.status, "Pending Review");

  ({ t, qs } = await setup("No"));
  await open();
  const approve = page.getByRole("button", { name: "Approve", exact: true });
  await approve.waitFor();
  assert.ok(await approve.isDisabled());
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  assert.ok(await page.getByRole("button", { name: "Save & Approve", exact: true }).isDisabled());
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.ok(await page.getByRole("button", { name: "Route to SME", exact: true }).isEnabled());

  ({ t, qs } = await setup());
  await api("/questions/" + qs[0].id + "/status", "PATCH", { status: "SME Needed" });
  const existing = await api("/sme-requests", "POST", { ticketId: t.id, department: "InfoSec", teamName: "InfoSec Team", status: "Requested", questionCount: 1 });
  await api("/sme-request-questions/package", "POST", { smeRequestId: existing.id, ticketId: t.id, department: "InfoSec" });
  await api("/questions/" + qs[1].id + "/status", "PATCH", { status: "SME Needed" });
  await api("/tickets/" + t.id, "PUT", { workflowStage: "sme" });
  await open();
  await page.getByRole("button", { name: /Send All/ }).click();
  await page.getByText("All SME packages prepared", { exact: false }).waitFor();
  const savedRequests = await api("/sme-requests/ticket/" + t.id);
  assert.equal(savedRequests.length, 1);
  assert.equal(savedRequests[0].id, existing.id);
  assert.equal(savedRequests[0].questionCount, 2);
  const links = await api("/sme-request-questions/request/" + existing.id);
  assert.equal(links.length, 2);
  assert.equal(new Set(links.map(l => l.questionId)).size, 2);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await open();
  // The updated draft is not sent yet, so it offers Mark as Sent, not Record Answers.
  assert.equal(await page.getByRole("button", { name: "Record Answers", exact: true }).count(), 0);
  await page.getByRole("button", { name: /Mark as Sent/ }).first().click();
  await page.getByText("package marked as sent", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Record Answers", exact: true }).click();
  assert.equal(await page.locator("textarea").count(), 2);

  // A package that was already sent keeps its send record and ETA; a question
  // routed later goes out in a new request.
  ({ t, qs } = await setup());
  await api("/questions/" + qs[0].id + "/status", "PATCH", { status: "SME Needed" });
  const sentReq = await api("/sme-requests", "POST", { ticketId: t.id, department: "InfoSec", teamName: "InfoSec Team", status: "Draft Prepared", questionCount: 1 });
  await api("/sme-request-questions/package", "POST", { smeRequestId: sentReq.id, ticketId: t.id, department: "InfoSec" });
  await api("/sme-requests/" + sentReq.id, "PUT", { status: "ETA Confirmed", sentAt: "2026-10-27T10:00:00", eta: "2026-11-03T17:00:00" });
  await api("/questions/" + qs[1].id + "/status", "PATCH", { status: "SME Needed" });
  await api("/tickets/" + t.id, "PUT", { workflowStage: "sme" });
  await open();
  await page.getByRole("button", { name: /Send All/ }).click();
  await page.getByText("All SME packages prepared", { exact: false }).waitFor();
  const afterSend = await api("/sme-requests/ticket/" + t.id);
  assert.equal(afterSend.length, 2);
  const original = afterSend.find((r) => r.id === sentReq.id);
  assert.equal(original.sentAt?.slice(0, 16), "2026-10-27T10:00");
  assert.equal(original.eta?.slice(0, 16), "2026-11-03T17:00");
  assert.equal((await api("/sme-request-questions/request/" + sentReq.id)).length, 1);
  const added = afterSend.find((r) => r.id !== sentReq.id);
  assert.deepEqual((await api("/sme-request-questions/request/" + added.id)).map((l) => l.questionId), [qs[1].id]);
  await page.getByRole("button", { name: "Done", exact: true }).click();

  assert.deepEqual(errors, []);
  console.log("WORKFLOW EDGE CASES OK");
} finally { await browser.close(); }
