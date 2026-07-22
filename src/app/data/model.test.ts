import { describe, expect, it } from "vitest";
import {
  confidenceBand,
  isDueToday,
  isOverdueSmeRequest,
  isOverdueTicket,
  type MvpSmeRequest,
  type MvpTicket,
} from "./model";

function makeTicket(overrides: Partial<MvpTicket> = {}): MvpTicket {
  return {
    id: "TK-TEST",
    customer: "Test Customer",
    sorId: "SOR-TEST",
    owner: "Sarah Chen",
    status: "In Progress",
    stage: "review",
    due: "2026-07-07",
    created: "2026-07-01",
    urgency: "Medium",
    nda: "In Place",
    region: "EMEA",
    source: "Unit Test",
    files: [],
    ...overrides,
  };
}

function makeSmeRequest(overrides: Partial<MvpSmeRequest> = {}): MvpSmeRequest {
  return {
    id: 1,
    ticketId: "TK-TEST",
    department: "Legal",
    assignee: "Legal Team",
    eta: "2026-07-06T12:00:00Z",
    status: "ETA Set",
    questionIds: [1],
    sentAt: "2026-07-01T09:00:00Z",
    ...overrides,
  };
}

describe("confidenceBand", () => {
  it("returns high for confidence at or above 0.9", () => {
    expect(confidenceBand(0.9)).toBe("high");
    expect(confidenceBand(0.95)).toBe("high");
  });

  it("returns medium from 0.7 to below 0.9", () => {
    expect(confidenceBand(0.7)).toBe("medium");
    expect(confidenceBand(0.89)).toBe("medium");
  });

  it("returns low below 0.7", () => {
    expect(confidenceBand(0.69)).toBe("low");
  });

  it("returns none when confidence is null", () => {
    expect(confidenceBand(null)).toBe("none");
  });
});

describe("ticket due-date helpers", () => {
  it("recognises a demo ticket due today", () => {
    expect(isDueToday(makeTicket({ due: "2026-07-07" }))).toBe(true);
  });

  it("recognises an overdue demo ticket", () => {
    expect(isOverdueTicket(makeTicket({ due: "2026-07-06" }))).toBe(true);
  });

  it("does not treat a closed ticket as overdue", () => {
    expect(
      isOverdueTicket(
        makeTicket({
          due: "2026-07-06",
          status: "Closed",
        }),
      ),
    ).toBe(false);
  });
});

describe("SME overdue helper", () => {
  it("recognises a request whose ETA has passed", () => {
    expect(isOverdueSmeRequest(makeSmeRequest())).toBe(true);
  });

  it("does not treat a returned request as overdue", () => {
    expect(
      isOverdueSmeRequest(
        makeSmeRequest({
          status: "Returned",
        }),
      ),
    ).toBe(false);
  });

  it("recognises an explicit Overdue status without an ETA", () => {
    expect(
      isOverdueSmeRequest(
        makeSmeRequest({
          eta: null,
          status: "Overdue",
        }),
      ),
    ).toBe(true);
  });
});
