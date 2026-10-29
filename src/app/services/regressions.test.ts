import { describe, expect, it } from "vitest";
import {
  type MvpQuestion,
  demoDeadline,
  duplicateKey,
  isPastDate,
  matchSupport,
  mergeImportedQuestions,
  rekeyTicketRefs,
  deriveNotifications,
  localKnowledgeId,
  DERIVED_NOTIFICATION_BASE,
  nextLocalTicketId,
  restoredWorkflow,
  ticketIdForBackend,
  withCurrentDeadline,
} from "../data/model";
import { STARTUP_TICKETS } from "../data/seeds";
import { answerSourceFromBackend, applyRagResult, sectionOf } from "./backend";
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

  it("never gives an offline ticket a number from the backend range", () => {
    // With TK-9001 loaded from the backend, the next local number must not be
    // TK-9002, which the backend will give the next ticket it saves.
    expect(nextLocalTicketId([{ id: "TK-9001" }, { id: "TK-1027" }])).toBe("TK-1028");
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
  const hit = (
    score: number,
    supportLevel?: string,
    content = "Cloudera maintains SOC 2 Type II and ISO/IEC 27001 certification…",
  ) => ({
    id: 7,
    documentTitle: "Compliance and Certifications Summary",
    sectionTitle: "Certifications held",
    content,
    source: "",
    sourceKey: "",
    lastUpdated: "2025-09-15T00:00:00",
    sharingStatus: "Public",
    department: "Compliance",
    approved: true,
    similarityScore: score,
    supportLevel,
    supportReason: supportLevel === "RELATED" ? "The source does not mention DPA, which the question asks about." : undefined,
  });

  it("treats a 36% match as related knowledge, not a reviewable answer", () => {
    const q = applyRagResult(question, [hit(0.36, "RELATED")]);
    expect(q.answerSupport).toBe("related");
    expect(q.status).toBe("Needs Review");
  });

  it("does not offer a high-scoring passage that does not answer the question", () => {
    // 82% similar, but a certifications summary is not a DPA.
    const q = applyRagResult(question, [hit(0.82, "RELATED")]);
    expect(q.confidence).toBe(0.82);
    expect(q.answerSupport).toBe("related");
    expect(q.status).toBe("Needs Review");
    expect(q.supportReason).toContain("DPA");
  });

  it("treats a result without a support level as related knowledge", () => {
    const q = applyRagResult(question, [hit(0.9)]);
    expect(q.answerSupport).toBe("related");
    expect(q.status).toBe("Needs Review");
  });

  it("offers a supported passage with its evidence, even when another scores higher", () => {
    const dpa = {
      ...hit(0.71, "SUPPORTED", "Cloudera offers a standard Data Processing Addendum (DPA) to customers."),
      id: 9,
      sectionTitle: "Data processing",
      evidence: "Cloudera offers a standard Data Processing Addendum (DPA) to customers.",
    };
    const q = applyRagResult(question, [hit(0.82, "RELATED"), dpa]);
    expect(q.status).toBe("Suggested");
    expect(q.answerSupport).toBe("supported");
    expect(q.suggested?.knowledgeId).toBe(9);
    expect(q.evidence).toContain("Data Processing Addendum");
    expect(q.alternatives?.[0].support).toBe("related");
  });

  it("keeps score bands only for hand-written demo suggestions", () => {
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

describe("importing a new version of the customer form", () => {
  const q = (id: number, text: string, extra: Partial<MvpQuestion> = {}): MvpQuestion => ({
    id,
    backendId: id,
    ticketId: "TK-9001",
    row: id,
    original: text,
    normalised: text,
    department: "InfoSec",
    risk: "Medium",
    status: "AI Analysed",
    confidence: null,
    ...extra,
  });

  it("keeps reviewed questions, adds new ones and leaves out removed ones", () => {
    const existing = [
      q(1, "Is data encrypted in transit?", { status: "Approved", finalAnswer: { text: "TLS 1.2+", sourceType: "AI" } }),
      q(2, "Do you hold ISO 27001?", { status: "Approved" }),
    ];
    const { questions, reused } = mergeImportedQuestions(
      existing,
      [
        { backendId: 1, text: "Is data encrypted in transit?", department: "InfoSec" },
        { backendId: 3, text: "Is MFA enforced for admins?", department: "InfoSec" },
      ],
      "TK-9001",
      50,
    );
    expect(reused).toBe(1);
    expect(questions.map((x) => x.backendId)).toEqual([1, 3]);
    expect(questions[0].finalAnswer?.text).toBe("TLS 1.2+");
    expect(questions[1]).toMatchObject({ id: 50, status: "AI Analysed", departmentSource: "AI" });
  });

  it("flags repeats inside the file instead of dropping them", () => {
    const { questions } = mergeImportedQuestions(
      [],
      [
        { backendId: 1, text: "Is data encrypted in transit?", department: "InfoSec" },
        { backendId: 2, text: "Is data encrypted in transit?", department: "InfoSec" },
      ],
      "TK-9001",
      1,
    );
    expect(questions).toHaveLength(2);
    expect(questions[1].duplicateOf).toBe(questions[0].id);
  });

  it("names sheets the same way before and after a refresh", () => {
    expect(sectionOf("InfoSec / Access control")).toBe("InfoSec");
    expect(sectionOf("Legal!B4")).toBe("Legal");
    expect(sectionOf(null)).toBe("");
  });
});

describe("saving a ticket that was created offline", () => {
  it("moves every reference from the temporary number to the backend number", () => {
    const items = [
      { id: 1, ticketId: "TK-1028" },
      { id: 2, ticketId: "TK-1027" },
      { id: 3, ticketId: undefined },
    ];
    expect(rekeyTicketRefs(items, "TK-1028", "TK-9012").map((i) => i.ticketId)).toEqual([
      "TK-9012",
      "TK-1027",
      undefined,
    ]);
  });
});

describe("review findings", () => {
  it("keeps an edited knowledge answer labelled as edited after a refresh", () => {
    expect(answerSourceFromBackend("Knowledge Base", true)).toBe("AI Edited");
    expect(answerSourceFromBackend("Knowledge Base", false)).toBe("AI");
    expect(answerSourceFromBackend("SME", true)).toBe("SME");
    expect(answerSourceFromBackend("Manual", null)).toBe("Manual");
  });

  it("gives browser-only knowledge entries ids no backend entry can have", () => {
    const a = localKnowledgeId();
    const b = localKnowledgeId();
    expect(a).toBeLessThan(0);
    expect(a).not.toBe(b);
  });

  it("derives notifications from overdue and returned SME requests and late tickets", () => {
    const now = new Date("2026-10-29T12:00:00Z");
    const ticket = {
      id: "TK-9001", backendId: 1, customer: "Vandelay", sorId: "—", owner: "Sarah Chen",
      status: "Waiting SME" as const, stage: "eta" as const, due: "2026-10-27", created: "2026-10-01",
      urgency: "High" as const, nda: "In Place" as const, region: "—", source: "Backend", files: [],
    };
    const req = (id: number, extra: object) => ({
      id: 100000 + id, backendId: id, ticketId: "TK-9001", department: "Legal", assignee: "Legal Team",
      eta: null, status: "ETA Set" as const, questionIds: [], sentAt: "2026-10-20T09:00:00Z", ...extra,
    });
    const list = deriveNotifications(
      [ticket, { ...ticket, id: "TK-9002", backendId: 2, status: "Archived" as const }],
      [
        req(1, { eta: "2026-10-28T09:00:00Z" }),
        req(2, { status: "Returned", returnedAt: "2026-10-28T10:00:00Z" }),
        req(3, { ticketId: "TK-9002", eta: "2026-10-01T09:00:00Z" }),
      ],
      now,
    );
    // Newest first; the archived ticket's request is left out.
    expect(list.map((n) => n.title)).toEqual([
      "Legal SME answers returned — TK-9001",
      "Legal SME answers overdue — TK-9001",
      "Customer deadline passed — TK-9001",
    ]);
    expect(list.every((n) => n.id >= DERIVED_NOTIFICATION_BASE)).toBe(true);
    // Same events give the same ids, so read state survives a re-derive.
    expect(deriveNotifications([ticket], [req(1, { eta: "2026-10-28T09:00:00Z" })], now)[0].id)
      .toBe(list[1].id);
  });
});
