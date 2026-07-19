// Domain model, vocabulary and shared helpers for the MVP app.
// All dates are UTC. Overdue logic for seeded demo data is anchored to a
// fixed demo "now" (MOCK_NOW) so the story stays deterministic; live-synced
// records use the real clock.

// Toast message shape (previously in the legacy app's types.ts)
export type ToastMsg = {
  id: number;
  message: string;
  type: "success" | "info" | "warning";
};

export const MOCK_NOW = new Date("2026-07-07T09:00:00Z");

export type Role = "Analyst" | "SME" | "Manager";

export type ModuleId =
  | "dashboard"
  | "tickets"
  | "ticket-detail"
  | "ai-search"
  | "knowledge-base"
  | "reports"
  | "notifications"
  | "settings";

// PRD §5.1 Global Status Tags
export type TicketStatus =
  | "New"
  | "AI Processing"
  | "Intake Review"
  | "In Progress"
  | "Waiting SME"
  | "Ready for Review"
  | "Approved"
  | "Sent"
  | "Closed"
  | "Archived";

export type QuestionStatus =
  | "New"
  | "AI Analysed"
  | "Suggested"
  | "Needs Review"
  | "SME Queued" // marked "route to SME" during review; not yet sent
  | "Waiting SME"
  | "SME Complete"
  | "Ready"
  | "Approved"
  | "Rejected";

// Guided workflow stage inside a ticket (mirrors the original prototype flow:
// intake → grouping → answer review → SME package → ETA tracking → final)
export type TicketStage =
  | "intake"
  | "grouping"
  | "review"
  | "sme"
  | "eta"
  | "final"
  | "done";

export type KnowledgeStatus =
  | "Draft"
  | "Pending Review"
  | "Approved"
  | "Deprecated"
  | "Archived";

export type SmeStatus =
  | "Requested"
  | "ETA Set"
  | "In Progress"
  | "Returned"
  | "Overdue"
  | "Escalated"
  | "Closed";

export type SharingStatus = "Public" | "Internal" | "NDA Required";
export type NdaStatus = "In Place" | "Missing" | "Unknown";
export type Urgency = "High" | "Medium" | "Low";

// Unified department vocabulary: union of the PRD §4 list and the backend
// LLM classifier's fixed set (QuestionClassifierService). "Security" was
// merged into "InfoSec" — the backend classifier, KB seeds, and live DB rows
// all use InfoSec. Keep in sync with the classifier prompt on the backend.
export const DEPARTMENTS = [
  "InfoSec",
  "Legal",
  "Finance",
  "HR",
  "Compliance",
  "ESG",
  "Product",
  "General",
];

// The backend classifier buckets unroutable questions as "General". Questions
// show that as "TBD" so analysts can see the AI did not pick a department and
// must assign one themselves. "General" remains a real Knowledge Base
// category (company-overview content) — the rename applies to questions only.
export const TBD_DEPARTMENT = "TBD";

// Departments a QUESTION can be assigned to: no "General" — a question must
// end up with a real owning team, or stay parked as TBD until the analyst
// decides. TBD questions cannot be routed to an SME.
export const QUESTION_DEPARTMENTS = [
  ...DEPARTMENTS.filter((d) => d !== "General"),
  TBD_DEPARTMENT,
];

export type MvpFile = {
  name: string;
  size: string;
  kind: string;
  uploaded: string;
  status: "Uploaded" | "Processing" | "Processed" | "Failed";
  supporting?: boolean;
};

export type MvpTicket = {
  id: string;
  backendId?: number; // id in Alison's backend once synced
  // intake fields the email extraction could not find (cleared as the analyst fills them)
  intakeMissing?: string[];
  customer: string;
  sorId: string;
  owner: string;
  status: TicketStatus;
  stage: TicketStage;
  aeEmail?: string;
  due: string; // ISO date
  created: string;
  closed?: string;
  urgency: Urgency;
  nda: NdaStatus;
  region: string;
  source: string;
  businessImpact?: string;
  ae?: string;
  notes?: string;
  files: MvpFile[];
};

export type MvpQuestion = {
  id: number;
  backendId?: number;
  ticketId: string;
  row: number;
  original: string;
  normalised: string;
  department: string;
  risk: "Low" | "Medium" | "High";
  status: QuestionStatus;
  confidence: number | null; // null = no knowledge match
  suggested?: { text: string; knowledgeId: number; reasoning: string; sourceTitle?: string };
  // further KB matches above the backend's 0.35 threshold (top 3 total)
  alternatives?: {
    text: string;
    knowledgeId: number;
    confidence: number;
    reasoning: string;
    sourceTitle?: string;
    sharingStatus?: SharingStatus;
  }[];
  sharingStatus?: SharingStatus;
  finalAnswer?: {
    text: string;
    sourceType: "AI" | "AI Edited" | "Manual" | "SME";
  };
  smeRequestId?: number;
  duplicateOf?: number;
  rejectedReason?: string;
};

export type MvpSmeRequest = {
  id: number;
  backendId?: number;
  sentEmail?: { subject: string; body: string }; // backend-composed content
  srqIds?: Record<number, number>; // local question id -> SmeRequestQuestion id
  ticketId: string;
  department: string;
  assignee: string;
  eta: string | null; // ISO datetime
  status: SmeStatus;
  questionIds: number[];
  sentAt: string;
  returnedAt?: string;
};

export type MvpKnowledgeEntry = {
  id: number;
  title: string;
  content: string;
  department: string;
  source: string;
  lastUpdated: string; // ISO date
  sharingStatus: SharingStatus;
  status: KnowledgeStatus;
  tags: string[];
  owner: string;
};

export type MvpNotification = {
  id: number;
  type: "SME Reply" | "Overdue" | "AI Complete" | "Knowledge Review" | "Status Change";
  title: string;
  content: string;
  createdAt: string;
  read: boolean;
  ticketId?: string;
  knowledgeId?: number;
};

export type MvpActivity = {
  id: number;
  ticketId?: string;
  actor: string; // "AI" or a user name
  action: string;
  at: string;
};

export type MvpReport = {
  id: number;
  title: string;
  type: string;
  createdBy: string;
  createdAt: string;
  filters: string;
  summary: string;
  metrics: { label: string; value: string }[];
  status: "Ready" | "Archived";
};

// Files attached in the New Request modal, waiting for AI analysis at intake
// confirmation (keyed by local ticket id). Kept outside React state on purpose.
export const pendingForms = new Map<string, File>();

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return `${date}, ${time} UTC`;
}

export function isOverdueTicket(t: MvpTicket): boolean {
  return (
    !["Approved", "Sent", "Closed", "Archived"].includes(t.status) &&
    new Date(t.due + "T23:59:59Z") < MOCK_NOW
  );
}

export function isDueToday(t: MvpTicket): boolean {
  return t.due === MOCK_NOW.toISOString().slice(0, 10) && !["Closed", "Archived"].includes(t.status);
}

// Similarity score at/above which a suggestion is auto-marked "Suggested"
// (below it: "Needs Review"). Calibrated for text-embedding-3-small, whose
// near-perfect matches score ~0.75–0.85 (PR #3/#4 reviews). Display banding
// in confidenceBand below is intentionally separate (PRD §9.1).
export const SUGGESTED_THRESHOLD = 0.6;

// PRD §9.1 confidence bands
export function confidenceBand(c: number | null): "high" | "medium" | "low" | "none" {
  if (c === null) return "none";
  if (c >= 0.9) return "high";
  if (c >= 0.7) return "medium";
  return "low";
}
