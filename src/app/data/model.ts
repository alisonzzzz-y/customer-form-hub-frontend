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
  const now = t.backendId ? new Date() : MOCK_NOW;
  return (
    !["Approved", "Sent", "Closed", "Archived"].includes(t.status) &&
    new Date(t.due + "T23:59:59Z") < now
  );
}

export function isDueToday(t: MvpTicket): boolean {
  const now = t.backendId ? new Date() : MOCK_NOW;
  return (
    t.due === now.toISOString().slice(0, 10) &&
    !["Closed", "Archived"].includes(t.status)
  );
}

export function ticketReferenceNow(t: MvpTicket): Date {
  return t.backendId ? new Date() : MOCK_NOW;
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

export function confidenceBand(c: number | null): "high" | "medium" | "low" | "none" {
  if (c === null) return "none";
  if (c >= 0.9) return "high";
  if (c >= 0.7) return "medium";
  return "low";
}
