// Shared data types and date helpers.
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
  | "ai-performance"
  | "reports"
  | "notifications"
  | "settings";

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
  | "Waiting AE"
  | "Ready"
  | "Approved"
  | "Rejected";

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
  | "Draft Prepared" // package registered and mail draft opened; not yet confirmed as sent
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

// Keep this list in sync with the backend classifier.
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

// Use TBD when the classifier cannot assign a question.
export const TBD_DEPARTMENT = "TBD";

// Questions must have an owning team before they can be sent to an SME.
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
  backendId?: number;
  // Used only for the first paint of the hosted demo. These records are
  // replaced as soon as the live backend returns its own ticket data.
  isStartupDemo?: boolean;
  // Fields that still need to be completed.
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
  // What the last "Analyse Form" step actually used, shown on the grouping step.
  formImport?: {
    source: "file" | "demo";
    fileName?: string;
    questionCount: number;
    sections: string[];
    reused: number; // questions already saved for this ticket by an earlier parse
    at: string;
  };
};

export type MvpQuestion = {
  id: number;
  backendId?: number;
  ticketId: string;
  row: number;
  original: string;
  normalised: string;
  department: string;
  // Where the department came from. Undefined for questions loaded from the
  // backend, which does not record whether a person changed it.
  departmentSource?: "AI" | "Manual" | "Demo";
  risk: "Low" | "Medium" | "High";
  status: QuestionStatus;
  confidence: number | null; // knowledge-match similarity; null = not searched or no match
  suggested?: { text: string; knowledgeId: number; reasoning: string; sourceTitle?: string };
  // Other matching knowledge entries.
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
  reviewOutcome?: "ACCEPTED" | "EDITED" | "ESCALATED";
  reviewedAt?: string;
  aeClarificationRequestedAt?: string;
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
  sentAt: string; // registration time while "Draft Prepared", then the user-confirmed send time
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

// Files waiting to be analysed, grouped by ticket ID.
export const pendingForms = new Map<string, File>();

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
  const now = t.backendId || t.isStartupDemo ? new Date() : MOCK_NOW;
  return (
    !["Approved", "Sent", "Closed", "Archived"].includes(t.status) &&
    new Date(t.due + "T23:59:59Z") < now
  );
}

export function isDueToday(t: MvpTicket): boolean {
  const now = t.backendId || t.isStartupDemo ? new Date() : MOCK_NOW;
  return (
    t.due === now.toISOString().slice(0, 10) &&
    !["Closed", "Archived"].includes(t.status)
  );
}

export function ticketReferenceNow(t: MvpTicket): Date {
  return t.backendId || t.isStartupDemo ? new Date() : MOCK_NOW;
}

export function smeRequestReferenceNow(r: MvpSmeRequest): Date {
  return r.backendId ? new Date() : MOCK_NOW;
}

export function isOverdueSmeRequest(r: MvpSmeRequest): boolean {
  return (
    !["Returned", "Closed"].includes(r.status) &&
    (r.status === "Overdue" ||
      (r.eta !== null && new Date(r.eta) < smeRequestReferenceNow(r)))
  );
}

// Suggestions below this score require review.
export const SUGGESTED_THRESHOLD = 0.6;
// Below this score a match is only related knowledge, not a supported answer.
// Keep in sync with RetrievalService.PARTIAL_THRESHOLD on the backend.
export const RELATED_ONLY_THRESHOLD = 0.5;

export type MatchSupport = "supported" | "partial" | "related" | "none";

export function matchSupport(c: number | null): MatchSupport {
  if (c === null) return "none";
  if (c >= SUGGESTED_THRESHOLD) return "supported";
  if (c >= RELATED_ONLY_THRESHOLD) return "partial";
  return "related";
}

// Backend tickets are shown as TK-<9000 + database id> everywhere.
export const BACKEND_TICKET_OFFSET = 9000;

export function ticketIdForBackend(backendId: number): string {
  return `TK-${BACKEND_TICKET_OFFSET + backendId}`;
}

// Next free numeric ID for a ticket that exists only in this browser session.
// IDs that are not TK-<number> (for example TK-DEMO-01) are ignored, so the
// result is always a valid number and never repeats an existing ID.
export function nextLocalTicketId(tickets: Pick<MvpTicket, "id">[]): string {
  const taken = new Set(tickets.map((t) => t.id));
  const numbers = tickets
    .map((t) => /^TK-(\d+)$/.exec(t.id)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  let next = Math.max(1000, ...numbers) + 1;
  while (taken.has(`TK-${next}`)) next++;
  return `TK-${next}`;
}

// Case, spacing and punctuation-insensitive text used to flag repeated questions.
export function duplicateKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Default demo deadline: ten days from today, as an ISO date.
export function demoDeadline(from: Date = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + 10);
  return d.toISOString().slice(0, 10);
}

export function isPastDate(iso: string, now: Date = new Date()): boolean {
  return !!iso && iso < now.toISOString().slice(0, 10);
}

// The backend composes the SME email when the package is prepared. Until the
// user confirms the send, keep its deadline line in step with the ticket so a
// later deadline edit reaches the draft.
const DEADLINE_LINE = /^Customer deadline: \d{4}-\d{2}-\d{2} \(UTC\)$/m;
export function withCurrentDeadline(body: string, due: string): string {
  if (!due) return body;
  const line = `Customer deadline: ${due} (UTC)`;
  if (DEADLINE_LINE.test(body)) return body.replace(DEADLINE_LINE, line);
  const paras = body.split("\n\n");
  const intro = paras.findIndex((p) => p.startsWith("The GOM team"));
  if (intro === -1) return body;
  paras.splice(intro + 1, 0, line);
  return paras.join("\n\n");
}

export function confidenceBand(c: number | null): "high" | "medium" | "low" | "none" {
  if (c === null) return "none";
  if (c >= 0.9) return "high";
  if (c >= 0.7) return "medium";
  return "low";
}
