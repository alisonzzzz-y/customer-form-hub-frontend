import { describe, expect, it } from "vitest";
import {
  type MvpQuestion,
  demoDeadline,
  duplicateKey,
  isPastDate,
  matchSupport,
  nextLocalTicketId,
  restoredWorkflow,
  ticketIdForBackend,
  withCurrentDeadline,
} from "../data/model";
import { STARTUP_TICKETS } from "../data/seeds";
import { applyRagResult } from "./backend";
import { extractQuestionsFor, parseIntakeEmail, sampleAeEmail } from "./simulation";

describe("ticket IDs", () => {
  it("never produces TK-NaN when demo tickets use non-numeric IDs", () => {
    // The hosted demo shows TK-DEMO-01… before the backend answers.
    const id = nextLocalTicketId(STARTUP_TICKETS);
    expect(id).toMatch(/^TK-\d+$/);
    expect(id).not.toContain("NaN");
  });

  it("gives every new local ticket a different ID", () => {
    const tickets = [{ id: "TK-DEMO-01" }, { id: "TK-1027" }, { id: "TK-NaN" }];
    const first = nextLocalTicketId(tickets);
    const second = nextLocalTicketId([...tickets, { id: first }]);
    expect(first).toBe("TK-1028");
    expect(second).toBe("TK-1029");
  });

  it("shows backend tickets with the same ID before and after a refresh", () => {
    expect(ticketIdForBackend(57)).toBe("TK-9057");
  });
});

describe("sample email dates", () => {
  const now = new Date("2026-10-27T09:00:00Z");

  it("uses a deadline ten days ahead and the intake check reads the same date", () => {
    const email = sampleAeEmail(now);
    expect(email).toContain("by 6 November 2026");
    expect(demoDeadline(now)).toBe("2026-11-06");
    expect(parseIntakeEmail(email).due).toBe("2026-11-06");
  });

  it("never addresses real mailboxes", () => {
    expect(sampleAeEmail(now)).not.toMatch(/@cloudera\.com/);
    expect(parseIntakeEmail(sampleAeEmail(now)).aeEmail).toBe("jane.smith@example.com");
  });

  it("flags but keeps a deadline that has already passed", () => {
    expect(isPastDate("2026-07-21", now)).toBe(true);
    expect(isPastDate("2026-11-06", now)).toBe(false);
    expect(isPastDate("", now)).toBe(false);
  });
});

describe("knowledge match support", () => {
  const question: MvpQuestion = {
    id: 1,
    ticketId: "TK-9001",
    row: 1,
    original: "Is a data processing agreement available?",
    normalised: "Is a data processing agreement available?",
    department: "Legal",
    risk: "Medium",
    status: "AI Analysed",
    confidence: null,
  };
  const hit = (score: number) => ({
    id: 7,
    documentTitle: "Compliance and Certifications Summary",
    sectionTitle: "Certifications held",
    content: "Cloudera maintains SOC 2 Type II and ISO/IEC 27001 certification…",
    source: "",
    sourceKey: "",
    lastUpdated: "2025-09-15T00:00:00",
    sharingStatus: "Public",
    department: "Compliance",
    approved: true,
    similarityScore: score,
  });

  it("treats a 36% match as related knowledge, not a reviewable answer", () => {
    const q = applyRagResult(question, [hit(0.36)]);
    expect(matchSupport(q.confidence)).toBe("related");
    expect(q.status).toBe("Needs Review");
  });

  it("keeps strong matches as suggestions", () => {
    const q = applyRagResult(question, [hit(0.82)]);
    expect(matchSupport(q.confidence)).toBe("supported");
    expect(q.status).toBe("Suggested");
  });

  it("marks mid-range matches as partial", () => {
    expect(matchSupport(0.55)).toBe("partial");
    expect(matchSupport(null)).toBe("none");
  });
});

describe("questions", () => {
  it("demo questions say they are demo data", () => {
    const qs = extractQuestionsFor("TK-9001", 0);
    expect(qs.every((q) => q.departmentSource === "Demo")).toBe(true);
  });

  it("detects repeated questions regardless of case and punctuation", () => {
    expect(duplicateKey("Is data encrypted in transit?")).toBe(
      duplicateKey("  is DATA encrypted in transit "),
    );
    expect(duplicateKey("Do you hold ISO27001?")).not.toBe(
      duplicateKey("Do you currently hold ISO/IEC 27001 certification?"),
    );
  });
});

describe("SME draft deadline", () => {
  const body = [
    "Hi Legal Team,",
    "The GOM team is completing a customer questionnaire for Vandelay and needs your department's input on the questions below.",
    "Customer deadline: 2026-11-06 (UTC)",
    "1. Is a DPA available?",
  ].join("\n\n");

  it("follows a deadline edited after the package was prepared", () => {
    const updated = withCurrentDeadline(body, "2026-11-13");
    expect(updated).toContain("Customer deadline: 2026-11-13 (UTC)");
    expect(updated).not.toContain("2026-11-06");
  });

  it("adds the deadline when the package was prepared without one", () => {
    const noDeadline = body.replace("\n\nCustomer deadline: 2026-11-06 (UTC)", "");
    const updated = withCurrentDeadline(noDeadline, "2026-11-13");
    expect(updated.split("\n\n")[2]).toBe("Customer deadline: 2026-11-13 (UTC)");
  });

  it("leaves the body alone when the ticket has no deadline", () => {
    expect(withCurrentDeadline(body, "")).toBe(body);
  });
});

describe("archive and restore", () => {
  const qs = (...statuses: MvpQuestion["status"][]) => statuses.map((status) => ({ status }));

  it("sends an empty ticket back to intake", () => {
    expect(restoredWorkflow([])).toEqual({ status: "Intake Review", stage: "intake" });
  });

  it("puts a ticket waiting on SMEs back in ETA tracking", () => {
    expect(restoredWorkflow(qs("Approved", "Waiting SME"))).toEqual({
      status: "Waiting SME",
      stage: "eta",
    });
  });

  it("puts a fully answered ticket back in final review", () => {
    expect(restoredWorkflow(qs("Approved", "SME Complete"))).toEqual({
      status: "Ready for Review",
      stage: "final",
    });
  });

  it("puts a ticket mid-review back in review", () => {
    expect(restoredWorkflow(qs("Suggested", "Approved"))).toEqual({
      status: "In Progress",
      stage: "review",
    });
  });
});
