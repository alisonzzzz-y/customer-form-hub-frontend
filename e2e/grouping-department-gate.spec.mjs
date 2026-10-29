import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_URL ?? "http://localhost:5199/";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8080";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(10_000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

async function json(path, method, body) {
  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.json();
}


async function openTicket(stage) {
  await fetch(`${API_URL}/api/_debug/reset`);
  const ticket = await json("/tickets", "POST", {
    customerName: "Department Gate Co", status: "In Progress",
    workflowStage: stage, ndaStatus: "Yes",
  });
  const form = new FormData();
  form.append("file", new Blob(["department fixture"]), "Review.xlsx");
  const imported = await fetch(`${API_URL}/api/questionnaire/import?ticketId=${ticket.id}`, {
    method: "POST", body: form,
  });
  assert.ok(imported.ok);
  const questions = await json(`/questions/ticket/${ticket.id}`, "GET");
  await json(`/questions/${questions[0].id}`, "PUT", { department: "General" });
  await page.goto(BASE_URL);
  await page.waitForSelector("text=Live data:");
  await page.click("nav >> text=Tickets");
  await page.click(`tr:has-text("TK-${9000 + ticket.id}")`);
}
try {
  await openTicket("grouping");
  const next = page.getByRole("button", { name: /Next: Match Knowledge Answers/ });
  assert.ok(await next.isDisabled());
  await page.getByRole("button", { name: /^TBD/ }).click();
  const department = page.getByTitle("Change which department this question belongs to");
  await page.route("**/api/questions/*", async route => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ status: 500, body: "Save failed" });
    } else await route.continue();
  });
  await department.selectOption("Legal");
  await page.getByText(/was not saved. Please try again/).waitFor();
  assert.ok(await next.isDisabled());
  assert.equal(await department.inputValue(), "TBD");
  await page.unroute("**/api/questions/*");
  await department.selectOption("Legal");
  await page.waitForFunction(() => [...document.querySelectorAll("button")]
    .some(b => b.textContent.includes("Next: Match Knowledge Answers") && !b.disabled));
  await page.route("**/api/knowledge-base/search", route =>
    route.fulfill({ contentType: "application/json", body: "[]" }));
  await next.click();
  await page.getByRole("button", { name: "Route to SME", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Approve", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Route to SME", exact: true }).click();
  await page.getByText("SME Queued", { exact: true }).first().waitFor();

  await openTicket("review");
  await page.getByRole("button", { name: "Assign missing departments", exact: true }).click();
  await next.waitFor();
  assert.ok(await next.isDisabled());
  assert.deepEqual(errors, []);
  console.log("DEPARTMENT GATE OK");
} finally {
  await browser.close();
}
