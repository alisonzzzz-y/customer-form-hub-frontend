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

async function openReview() {
  await fetch(`${API_URL}/api/_debug/reset`);
  const ticket = await json("/tickets", "POST", {
    customerName: "Review Navigation Co",
    status: "In Progress",
    workflowStage: "review",
    ndaStatus: "Yes",
    deadline: "2026-12-01T00:00:00",
  });
  const form = new FormData();
  form.append("file", new Blob(["navigation fixture"]), "Review.xlsx");
  const imported = await fetch(`${API_URL}/api/questionnaire/import?ticketId=${ticket.id}`, {
    method: "POST",
    body: form,
  });
  assert.ok(imported.ok);
  await page.goto(BASE_URL);
  await page.waitForSelector("text=Live data:");
  await page.click("nav >> text=Tickets");
  await page.click(`tr:has-text("TK-${9000 + ticket.id}")`);
  await page.waitForSelector("text=AI Suggested Answer — supported by the source");
}

async function expectQuestion(text) {
  await page.locator("h3").filter({ hasText: text }).waitFor();
}

async function assertInViewport(locator) {
  const fullyVisible = await locator.evaluate((button) => {
    const box = button.getBoundingClientRect();
    let top = 0;
    let bottom = window.innerHeight;
    for (let parent = button.parentElement; parent; parent = parent.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflowY)) {
        const bounds = parent.getBoundingClientRect();
        top = Math.max(top, bounds.top);
        bottom = Math.min(bottom, bounds.bottom);
      }
    }
    return box.height > 0 && box.top >= top && box.bottom <= bottom;
  });
  assert.ok(fullyVisible,
    "The continuation button must be visible without scrolling the answer");
}

try {
  await openReview();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expectQuestion("Describe how data is encrypted in transit and at rest.");

  // A completed department must take the reviewer to a different department.
  await page.getByTitle("Review only the InfoSec questions", { exact: true }).click();
  await expectQuestion("Describe how data is encrypted in transit and at rest.");
  await page.getByRole("button", { name: "Route to SME", exact: true }).click();
  await expectQuestion("What is your employee turnover rate?");

  // Saving an edited/manual answer follows the same automatic navigation.
  await page.getByRole("button", { name: "Manual Answer", exact: true }).click();
  await page.locator("textarea").fill("This response has been checked by the reviewer.");
  await page.getByRole("button", { name: "Save & Approve", exact: true }).click();
  await expectQuestion("Do you maintain cyber insurance and at what coverage?");

  // Keep processing the selected question, without clicking the question list.
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Route to SME", exact: true }).click();
  }
  await page.getByText("All questions reviewed.", { exact: false }).waitFor();
  const nextSme = page.getByRole("button", { name: "Next: SME Package (6)", exact: false });
  await assertInViewport(nextSme);
  assert.ok(await nextSme.isEnabled());
  await nextSme.click();
  await page.getByText("SMEs don't log in", { exact: false }).waitFor();

  // All approved answers lead directly to final review, including a short viewport.
  await page.setViewportSize({ width: 1280, height: 640 });
  await openReview();
  const nextFinal = page.getByRole("button", { name: "Next: Final Review", exact: false });
  assert.ok(await nextFinal.isDisabled(), "Continue explains that more questions need review");
  for (let i = 0; i < 8; i++) {
    const edit = page.getByRole("button", { name: /^(Edit|Manual Answer)$/ });
    await edit.click();
    await page.locator("textarea").fill(`Verified manual answer ${i + 1}.`);
    await page.getByRole("button", { name: "Save & Approve", exact: true }).click();
  }
  await page.getByText("All questions reviewed.", { exact: false }).waitFor();
  await assertInViewport(nextFinal);
  assert.ok(await nextFinal.isEnabled());
  await nextFinal.click();
  await page.getByRole("button", { name: "1 · Mark Review Complete", exact: false }).waitFor();

  assert.deepEqual(errors, []);
  console.log("REVIEW NAVIGATION OK");
} finally {
  await browser.close();
}
