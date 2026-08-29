// Connects the frontend to the backend and maps their data formats.

import {
  MvpQuestion,
  MvpTicket,
  KnowledgeStatus,
  SUGGESTED_THRESHOLD,
  SharingStatus,
  TBD_DEPARTMENT,
} from "../data/model";

interface SearchResult {
  id: number;
  documentTitle: string;
  sectionTitle: string;
  content: string;
  source: string;
  sourceKey: string;
  lastUpdated: string;
  sharingStatus: string;
  department: string;
  approved: boolean;
  status?: string;
  similarityScore: number | null;
}

interface FormQuestion {
  id: number;
  ticketId: number;
  questionText: string;
  department: string;
  status: string;
  riskLevel: string | null;
  rowReference: string | null;
  createdAt: string | null;
  aiSuggestionSourceId: number | null;
  reviewOutcome: "ACCEPTED" | "EDITED" | "ESCALATED" | null;
  reviewedAt: string | null;
  aeClarificationRequestedAt: string | null;
}

interface FinalAnswerInput {
  questionId: number;
  sourceChunkId: number | null;
  answerText: string;
  isEdited: boolean;
  sourceType: string;
  approvalStatus: string;
  approvedBy: string;
}

interface SmeRequestQuestion {
  id: number;
  smeRequestId: number;
  questionId: number;
  status: string;
  includedReason: string | null;
  returnedAnswer: string | null;
  updatedAt: string | null;
}

interface ClassifiedQuestion {
  section: string;
  questionText: string;
  department: string;
}

// Display the backend's "General" value as "TBD" for questions.
export function questionDeptFromBackend(d: string | null | undefined): string {
  return d && d !== "General" ? d : TBD_DEPARTMENT;
}
function questionDeptToBackend(d: string): string {
  return d === TBD_DEPARTMENT ? "General" : d;
}

// Use the configured API URL, or the local backend during development.
const BASE = `${import.meta.env.VITE_API_BASE ?? "http://localhost:8080"}/api`;

export async function downloadTicketExport(
  backendTicketId: number,
): Promise<{ blob: Blob; filename: string } | null> {
  try {
    const response = await fetch(`${BASE}/export/ticket/${backendTicketId}`, {
      signal: AbortSignal.timeout(30_000),
    });
    report(true);
    if (!response.ok) return null;
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const filename =
      disposition.match(/filename\*?=(?:UTF-8''|["']?)([^"';]+)/i)?.[1] ??
      `ticket-${backendTicketId}-answers.xlsx`;
    return {
      blob: await response.blob(),
      filename: decodeURIComponent(filename),
    };
  } catch {
    report(false);
    return null;
  }
}

let listener: ((live: boolean) => void) | null = null;
export function onBackendStatus(fn: (live: boolean) => void) {
  listener = fn;
}
function report(live: boolean) {
  listener?.(live);
}

export async function pingBackend(): Promise<boolean> {
  try {
    // Allow enough time for the hosted backend to respond.
    const res = await fetch(`${BASE}/tickets`, {
      signal: AbortSignal.timeout(8000),
    });
    report(res.ok);
    return res.ok;
  } catch {
    report(false);
    return false;
  }
}

// Report failed background saves without showing repeated warnings.
let writeFailListener: ((detail: string) => void) | null = null;
export function onWriteFailure(fn: (detail: string) => void) {
  writeFailListener = fn;
}
let lastWriteFailAt = 0;
function notifyWriteFailure(detail: string) {
  const now = Date.now();
  if (now - lastWriteFailAt < 5000) return;
  lastWriteFailAt = now;
  writeFailListener?.(detail);
}

// Return null on failure. Only network errors mark the backend as offline.
async function attempt<T>(p: Promise<T>, mutation = false): Promise<T | null> {
  try {
    const v = await p;
    report(true);
    return v;
  } catch (e) {
    const status = Number((e as Error)?.message);
    const isHttp = Number.isFinite(status);
    report(isHttp);
    if (mutation)
      notifyWriteFailure(
        isHttp
          ? `the backend answered HTTP ${status}`
          : "the backend could not be reached",
      );
    return null;
  }
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  return attempt(
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<T>;
    }),
    true,
  );
}

async function put<T>(path: string, body: unknown): Promise<T | null> {
  return attempt(
    fetch(`${BASE}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<T>;
    }),
    true,
  );
}

async function patch<T>(path: string, body: unknown): Promise<T | null> {
  return attempt(
    fetch(`${BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<T>;
    }),
    true,
  );
}

// Keep invalid-file errors separate from network failures.
type FileOutcome<T> =
  | { kind: "ok"; data: T }
  | { kind: "rejected"; message: string }
  | { kind: "offline" };

async function postFile<T>(path: string, file: File): Promise<FileOutcome<T>> {
  const form = new FormData();
  form.append("file", file);
  try {
    // Allow up to three minutes for file parsing and classification.
    const r = await fetch(`${BASE}${path}`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
    report(true);
    if (!r.ok) {
      let message = `HTTP ${r.status}`;
      try {
        const body = (await r.json()) as { message?: string };
        if (body?.message) message = body.message;
      } catch {
        // Use the HTTP status when the response has no JSON message.
      }
      return { kind: "rejected", message };
    }
    return { kind: "ok", data: (await r.json()) as T };
  } catch {
    report(false);
    return { kind: "offline" };
  }
}

async function get<T>(path: string): Promise<T | null> {
  return attempt(
    fetch(`${BASE}${path}`).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<T>;
    }),
  );
}

const NDA_TO_BACKEND: Record<string, string> = {
  "In Place": "Yes",
  Missing: "No",
  Unknown: "Unknown",
};

export function mapSharing(raw: string | null | undefined): SharingStatus {
  if (!raw) return "Internal";
  const v = raw.toLowerCase();
  if (v.includes("nda")) return "NDA Required";
  if (v.includes("public") || v.includes("shareable")) return "Public";
  return "Internal";
}

type BackendTicket = { id: number };

export async function createBackendTicket(
  t: MvpTicket,
): Promise<number | null> {
  const created = await post<BackendTicket>("/tickets", {
    customerName: t.customer,
    createdBy: t.ae ?? null,
    assignedTo: t.owner,
    status: "New",
    urgency: t.urgency,
    ndaStatus: NDA_TO_BACKEND[t.nda] ?? "Unknown",
    deadline: `${t.due}T00:00:00`,
    businessImpact: t.businessImpact ?? null,
  });
  return created?.id ?? null;
}

// Debounce ticket updates while the user is typing.
const ticketSyncTimers = new Map<number, ReturnType<typeof setTimeout>>();
const ticketSyncPending = new Map<number, Record<string, unknown>>();

export function syncTicketFields(
  backendId: number | undefined,
  t: Partial<MvpTicket>,
) {
  if (!backendId) return;
  const payload: Record<string, unknown> = {};
  if (t.customer !== undefined) payload.customerName = t.customer;
  if (t.ae !== undefined) payload.createdBy = t.ae ?? undefined;
  if (t.due) payload.deadline = `${t.due}T00:00:00`;
  if (t.urgency !== undefined) payload.urgency = t.urgency;
  if (t.nda !== undefined)
    payload.ndaStatus = NDA_TO_BACKEND[t.nda] ?? "Unknown";
  if (t.businessImpact !== undefined)
    payload.businessImpact = t.businessImpact ?? undefined;
  if (Object.keys(payload).length === 0) return;

  ticketSyncPending.set(backendId, {
    ...ticketSyncPending.get(backendId),
    ...payload,
  });
  clearTimeout(ticketSyncTimers.get(backendId));
  ticketSyncTimers.set(
    backendId,
    setTimeout(() => {
      const merged = ticketSyncPending.get(backendId);
      ticketSyncPending.delete(backendId);
      if (merged) void put(`/tickets/${backendId}`, merged);
    }, 600),
  );
}

// Keep question departments in sync for SME packages.
export async function syncQuestionDepartment(
  backendId: number | undefined,
  department: string,
): Promise<boolean> {
  if (!backendId) return true;
  return (await put(`/questions/${backendId}`, {
    department: questionDeptToBackend(department),
  })) !== null;
}

// Older demo tickets can have locally-created questions even when the ticket
// itself was saved to the backend. Save those questions before they enter an
// SME workflow so the package, request and email draft remain traceable.
export async function createBackendQuestion(
  ticketId: number,
  question: Pick<MvpQuestion, "original" | "department" | "risk" | "row">,
): Promise<number | null> {
  const created = await post<FormQuestion>("/questions", {
    ticketId,
    questionText: question.original,
    department: questionDeptToBackend(question.department),
    status: "SME Needed",
    riskLevel: question.risk,
    rowReference: `Q${question.row}`,
  });
  return created?.id ?? null;
}

export function syncTicketStatus(
  backendId: number | undefined,
  status: string,
) {
  if (!backendId) return;
  void patch(`/tickets/${backendId}/status`, { status });
}

export type ParsedBackendQuestion = {
  backendId?: number;
  text: string;
  department: string;
  section: string;
};

export type ParseOutcome =
  | { kind: "ok"; questions: ParsedBackendQuestion[] }
  | { kind: "rejected"; message: string } // backend alive but refused the file
  | { kind: "offline" };

export async function parseQuestionnaire(
  file: File,
  backendTicketId: number | null,
): Promise<ParseOutcome> {
  if (backendTicketId !== null) {
    // Reuse saved questions to avoid duplicate uploads.
    const existing = await get<FormQuestion[]>(
      `/questions/ticket/${backendTicketId}`,
    );
    if (existing === null) return { kind: "offline" };
    if (existing.length > 0) {
      return {
        kind: "ok",
        questions: existing.map((fq) => ({
          backendId: fq.id,
          text: fq.questionText,
          department: questionDeptFromBackend(fq.department),
          section: fq.rowReference ?? "",
        })),
      };
    }
    const imported = await postFile<FormQuestion[]>(
      `/questionnaire/import?ticketId=${backendTicketId}`,
      file,
    );
    if (imported.kind === "ok")
      return {
        kind: "ok",
        questions: imported.data.map((fq) => ({
          backendId: fq.id,
          text: fq.questionText,
          department: questionDeptFromBackend(fq.department),
          section: fq.rowReference ?? "",
        })),
      };
    return imported;
  }
  const classified = await postFile<ClassifiedQuestion[]>(
    "/questionnaire/classify",
    file,
  );
  if (classified.kind === "ok")
    return {
      kind: "ok",
      questions: classified.data.map((c) => ({
        text: c.questionText,
        department: questionDeptFromBackend(c.department),
        section: c.section,
      })),
    };
  return classified;
}

export async function ragSearch(
  question: string,
): Promise<SearchResult[] | null> {
  // Search uses POST but does not change backend data.
  return attempt(
    fetch(`${BASE}/knowledge-base/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<SearchResult[]>;
    }),
  );
}

// Search in small batches to avoid overloading the backend.
export async function ragSearchAll(
  questions: { id: number; text: string }[],
): Promise<Map<number, SearchResult[]> | null> {
  if (questions.length === 0) return new Map();
  const first = await ragSearch(questions[0].text);
  if (first === null) return null;
  const out = new Map<number, SearchResult[]>();
  out.set(questions[0].id, first);
  const rest = questions.slice(1);
  for (let i = 0; i < rest.length; i += 5) {
    const batch = rest.slice(i, i + 5);
    const results = await Promise.all(batch.map((q) => ragSearch(q.text)));
    batch.forEach((q, j) => out.set(q.id, results[j] ?? []));
  }
  return out;
}

// Use the best match as the main suggestion and keep two alternatives.
export function applyRagResult(
  q: MvpQuestion,
  results: SearchResult[],
): MvpQuestion {
  const hits = results.slice(0, 3);
  const describe = (r: SearchResult) =>
    `Matched "${r.documentTitle} — ${r.sectionTitle}" (${Math.round((r.similarityScore ?? 0) * 100)}% similarity, updated ${r.lastUpdated?.slice(0, 10) ?? "n/a"})`;
  const top = hits[0];
  if (!top) return { ...q, status: "New", confidence: null };
  const score = top.similarityScore ?? 0;
  return {
    ...q,
    confidence: score,
    sharingStatus: mapSharing(top.sharingStatus),
    suggested: {
      text: top.content,
      knowledgeId: top.id,
      reasoning: describe(top),
      sourceTitle: `${top.documentTitle} — ${top.sectionTitle}`,
    },
    alternatives: hits.slice(1).map((r) => ({
      text: r.content,
      knowledgeId: r.id,
      confidence: r.similarityScore ?? 0,
      reasoning: describe(r),
      sourceTitle: `${r.documentTitle} — ${r.sectionTitle}`,
      sharingStatus: mapSharing(r.sharingStatus),
    })),
    status: score >= SUGGESTED_THRESHOLD ? "Suggested" : "Needs Review",
  };
}

// Load existing tickets and related data from the backend.

type BackendTicketFull = {
  id: number;
  customerName: string;
  createdBy: string | null;
  assignedTo: string | null;
  status: string;
  urgency: string | null;
  ndaStatus: string | null;
  deadline: string | null;
  businessImpact: string | null;
  createdAt: string | null;
};
type BackendSmeRequestFull = {
  id: number;
  ticketId: number;
  department: string;
  teamName: string | null;
  eta: string | null;
  status: string;
  sentAt: string | null;
  returnedAt: string | null;
};
type QuestionWithAnswer = {
  questionId: number;
  answerText: string | null;
  sourceType: string | null;
  approvalStatus: string | null;
  answered: boolean;
};

const NDA_FROM_BACKEND: Record<string, MvpTicket["nda"]> = {
  Yes: "In Place",
  No: "Missing",
  Unknown: "Unknown",
};

const TICKET_STATUSES: MvpTicket["status"][] = [
  "New",
  "AI Processing",
  "Intake Review",
  "In Progress",
  "Waiting SME",
  "Ready for Review",
  "Approved",
  "Sent",
  "Closed",
  "Archived",
];

function ticketStatusFromBackend(raw: string): MvpTicket["status"] {
  const legacy: Record<string, MvpTicket["status"]> = {
    "Intake Missing": "Intake Review",
    "In Review": "In Progress",
    Completed: "Closed",
  };
  const normalised = legacy[raw] ?? raw;
  return TICKET_STATUSES.includes(normalised as MvpTicket["status"])
    ? (normalised as MvpTicket["status"])
    : "In Progress";
}

const KNOWLEDGE_STATUSES: KnowledgeStatus[] = [
  "Draft",
  "Pending Review",
  "Approved",
  "Deprecated",
  "Archived",
];

function knowledgeStatusFromBackend(
  raw: string | null | undefined,
  approved: boolean,
): KnowledgeStatus {
  if (raw && KNOWLEDGE_STATUSES.includes(raw as KnowledgeStatus)) {
    return raw as KnowledgeStatus;
  }
  return approved ? "Approved" : "Pending Review";
}

export type BackendWorld = {
  tickets: MvpTicket[];
  questions: MvpQuestion[];
  smeRequests: import("../data/model").MvpSmeRequest[];
};

export async function loadBackendWorld(
  knownBackendIds: Set<number>,
): Promise<(BackendWorld & { complete: boolean }) | null> {
  const raw = await get<BackendTicketFull[]>("/tickets");
  if (raw === null) return null;
  const world: BackendWorld & { complete: boolean } = {
    tickets: [],
    questions: [],
    smeRequests: [],
    complete: true,
  };

  // Fetch ticket details in parallel and retry incomplete results later.
  const perTicket = await Promise.all(
    raw
      .filter((bt) => !knownBackendIds.has(bt.id))
      .map(async (bt) => {
        const [bqs, answers, breqsRaw] = await Promise.all([
          get<FormQuestion[]>(`/questions/ticket/${bt.id}`),
          get<QuestionWithAnswer[]>(`/final-review/ticket/${bt.id}`),
          get<BackendSmeRequestFull[]>(`/sme-requests/ticket/${bt.id}`),
        ]);
        if (bqs === null || answers === null || breqsRaw === null)
          return {
            bt,
            failed: true as const,
            bqs: [],
            answers: [],
            breqs: [],
            linkLists: [],
          };
        const breqs = breqsRaw;
        const linkLists = await Promise.all(
          breqs.map((r) =>
            get<SmeRequestQuestion[]>(`/sme-request-questions/request/${r.id}`),
          ),
        );
        if (linkLists.some((l) => l === null))
          return {
            bt,
            failed: true as const,
            bqs: [],
            answers: [],
            breqs: [],
            linkLists: [],
          };
        return { bt, failed: false as const, bqs, answers, breqs, linkLists };
      }),
  );

  for (const { bt, failed, bqs, answers, breqs, linkLists } of perTicket) {
    if (failed) {
      world.complete = false;
      continue;
    }
    const localId = `TK-${9000 + bt.id}`;
    // Only confirmed answers are treated as approved.
    const answerByQ = new Map(
      answers
        .filter((a) => a.answered && a.approvalStatus === "Confirmed")
        .map((a) => [a.questionId, a]),
    );

    // Map questions to their SME requests.
    const linkByQ = new Map<
      number,
      { reqId: number; srqId: number; returned: boolean }
    >();
    breqs.forEach((r, i) => {
      for (const l of linkLists[i] ?? [])
        linkByQ.set(l.questionId, {
          reqId: r.id,
          srqId: l.id,
          returned: l.status === "Returned",
        });
    });

    const localQs: MvpQuestion[] = bqs.map((q, i) => {
      const fa = answerByQ.get(q.id);
      const link = linkByQ.get(q.id);
      const sourceType =
        fa?.sourceType === "SME"
          ? "SME"
          : fa?.sourceType === "Manual"
            ? "Manual"
            : "AI";
      let status: MvpQuestion["status"];
      if (fa) status = link?.returned ? "SME Complete" : "Approved";
      else if (q.status === "SME Needed")
        status = link ? "Waiting SME" : "SME Queued";
      else if (q.status === "Waiting AE") status = "Waiting AE";
      else status = "Needs Review";
      return {
        id: 100000 + q.id,
        backendId: q.id,
        ticketId: localId,
        row: i + 1,
        original: q.questionText,
        normalised: q.questionText,
        department: questionDeptFromBackend(q.department),
        risk: (q.riskLevel as MvpQuestion["risk"]) ?? "Medium",
        status,
        confidence: null,
        finalAnswer: fa ? { text: fa.answerText ?? "", sourceType } : undefined,
        smeRequestId: link ? 100000 + link.reqId : undefined,
        reviewOutcome: q.reviewOutcome ?? undefined,
        reviewedAt: q.reviewedAt ?? undefined,
        aeClarificationRequestedAt: q.aeClarificationRequestedAt ?? undefined,
      };
    });

    const localReqs = breqs.map((r) => {
      const statusMap: Record<
        string,
        import("../data/model").MvpSmeRequest["status"]
      > = {
        "Waiting for ETA": "Requested",
        "ETA Confirmed": "ETA Set",
        Overdue: "ETA Set",
        Returned: "Returned",
        "In Progress": "ETA Set",
      };
      const srqIds: Record<number, number> = {};
      const questionIds: number[] = [];
      for (const [qid, link] of linkByQ) {
        if (link.reqId !== r.id) continue;
        questionIds.push(100000 + qid);
        srqIds[100000 + qid] = link.srqId;
      }
      return {
        id: 100000 + r.id,
        backendId: r.id,
        ticketId: localId,
        department: r.department,
        assignee: r.teamName ?? `${r.department} Team`,
        eta: r.eta,
        status: statusMap[r.status] ?? "Requested",
        questionIds,
        sentAt: r.sentAt ?? new Date().toISOString(),
        returnedAt: r.returnedAt ?? undefined,
        srqIds,
      };
    });

    // Derive the workflow stage from the loaded data.
    const allDone =
      localQs.length > 0 &&
      localQs.every((q) => ["Approved", "SME Complete"].includes(q.status));
    const anyWaiting = localQs.some((q) => q.status === "Waiting SME");
    const anyQueued = localQs.some((q) => q.status === "SME Queued");
    const hydratedStatus = ticketStatusFromBackend(bt.status);
    const stage: MvpTicket["stage"] = [
      "Approved",
      "Sent",
      "Closed",
      "Archived",
    ].includes(hydratedStatus)
      ? "done"
      : hydratedStatus === "Ready for Review"
        ? "final"
        : localQs.length === 0
          ? "intake"
          : allDone
            ? "final"
            : anyWaiting
              ? "eta"
              : anyQueued
                ? "sme"
                : "review";

    world.tickets.push({
      id: localId,
      backendId: bt.id,
      customer: bt.customerName,
      sorId: "—",
      owner: bt.assignedTo ?? "Sarah Chen",
      status: hydratedStatus,
      stage,
      due: bt.deadline?.slice(0, 10) ?? "",
      created: bt.createdAt?.slice(0, 10) ?? "",
      closed: ["Closed", "Archived"].includes(hydratedStatus)
        ? (bt.createdAt?.slice(0, 10) ?? undefined)
        : undefined,
      urgency: (bt.urgency as MvpTicket["urgency"]) ?? "Medium",
      nda: NDA_FROM_BACKEND[bt.ndaStatus ?? "Unknown"] ?? "Unknown",
      region: "—",
      source: "Backend",
      ae: bt.createdBy ?? undefined,
      files: [],
    });
    world.questions.push(...localQs);
    world.smeRequests.push(...localReqs);
  }
  return world;
}

// Load knowledge entries from the backend.
export async function loadBackendKnowledge(): Promise<
  import("../data/model").MvpKnowledgeEntry[] | null
> {
  const raw = await get<SearchResult[]>("/knowledge-base");
  if (raw === null) return null;
  return raw.map((k) => ({
    id: k.id,
    title: `${k.documentTitle} — ${k.sectionTitle}`,
    content: k.content,
    department: k.department,
    source: k.source,
    lastUpdated: k.lastUpdated?.slice(0, 10) ?? "—",
    sharingStatus: mapSharing(k.sharingStatus),
    status: knowledgeStatusFromBackend(k.status, k.approved),
    tags: [],
    owner: k.department,
  }));
}

const SHARING_TO_BACKEND: Record<string, string> = {
  Public: "Public",
  Internal: "Internal",
  "NDA Required": "NDA-required",
};

export async function upsertBackendKnowledge(
  entry: import("../data/model").MvpKnowledgeEntry,
  isNew: boolean,
): Promise<number | null> {
  const [documentTitle, sectionTitle = ""] = entry.title.split(" — ");
  const payload = {
    documentTitle,
    sectionTitle,
    content: entry.content,
    source: entry.source,
    lastUpdated:
      entry.lastUpdated && entry.lastUpdated !== "—"
        ? `${entry.lastUpdated}T00:00:00`
        : null,
    sharingStatus:
      SHARING_TO_BACKEND[entry.sharingStatus] ?? entry.sharingStatus,
    department: entry.department,
    approved: entry.status === "Approved",
    status: entry.status,
  };
  if (isNew) {
    const created = await post<{ id: number }>("/knowledge-base", payload);
    return created?.id ?? null;
  }
  const updated = await put<{ id: number }>(
    `/knowledge-base/${entry.id}`,
    payload,
  );
  return updated?.id ?? null;
}

export function syncFinalAnswer(
  q: MvpQuestion,
  answerText: string,
  edited: boolean,
  approvedBy: string,
) {
  if (!q.backendId) return;
  const input: FinalAnswerInput = {
    questionId: q.backendId,
    sourceChunkId: q.suggested?.knowledgeId ?? null,
    answerText,
    isEdited: edited,
    sourceType: q.suggested ? "Knowledge Base" : "Manual",
    approvalStatus: "Confirmed",
    approvedBy,
  };
  void post("/final-answers", input);
}

// Keep reverted answers as drafts so they are excluded from exports.
export async function revertFinalAnswer(q: MvpQuestion): Promise<boolean> {
  if (!q.backendId) return true;
  return (await post("/final-answers", {
    questionId: q.backendId,
    approvalStatus: "Draft",
  })) !== null;
}

export async function recordReviewEscalation(
  q: MvpQuestion,
  type: "SME" | "AE",
): Promise<boolean> {
  if (!q.backendId) return true;
  return (await post(`/questions/${q.backendId}/review-escalation`, {
    type,
    suggestionSourceId: q.suggested?.knowledgeId ?? null,
  })) !== null;
}

export async function reopenReviewDecision(q: MvpQuestion): Promise<boolean> {
  if (!q.backendId) return true;
  return (await post(`/questions/${q.backendId}/review-reopen`, {})) !== null;
}

export type ReviewSummary = {
  period: { from: string; to: string; timezone: string };
  reviewed: number;
  counts: { accepted: number; edited: number; rejected: number; escalated: number };
  rates: {
    directAcceptance: number | null;
    humanEdit: number | null;
    rejectedOrEscalated: number | null;
  };
};

export type RetrievalEvaluationRun = {
  runId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  datasetVersion: string | null;
  datasetHash: string | null;
  evaluationCases: number;
  failedCases: number;
  skippedCases: number;
  top1Hits: number;
  top3Hits: number;
  top1HitRate: number | null;
  top3HitRate: number | null;
  errorMessage: string | null;
};

export async function loadAiPerformance(
  days: number,
): Promise<{ review: ReviewSummary; runs: RetrievalEvaluationRun[] } | null> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const [review, runs] = await Promise.all([
    get<ReviewSummary>(
      `/ai-performance/review-summary?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
    ),
    get<RetrievalEvaluationRun[]>("/ai-performance/retrieval-runs?limit=10"),
  ]);
  return review && runs ? { review, runs } : null;
}

export async function syncQuestionStatus(
  backendId: number | undefined,
  status: string,
): Promise<boolean> {
  if (!backendId) return true;
  return (await patch(`/questions/${backendId}/status`, { status })) !== null;
}

type BackendSmeRequest = { id: number };

export async function createBackendSmeRequest(
  backendTicketId: number,
  department: string,
  teamName: string,
  questionCount: number,
): Promise<number | null> {
  const created = await post<BackendSmeRequest>("/sme-requests", {
    ticketId: backendTicketId,
    department,
    teamName,
    questionCount,
    eta: null,
    status: "Waiting for ETA",
    sentAt: new Date().toISOString().slice(0, 19),
  });
  return created?.id ?? null;
}

// Link a department's questions to an SME request.
export async function packageBackendQuestions(
  backendRequestId: number,
  backendTicketId: number,
  department: string,
): Promise<Record<number, number> | null> {
  const linked = await post<SmeRequestQuestion[]>(
    "/sme-request-questions/package",
    {
      smeRequestId: backendRequestId,
      ticketId: backendTicketId,
      department,
    },
  );
  // Read saved links if the create response was lost.
  const reconciled =
    linked ??
    (await get<SmeRequestQuestion[]>(
      `/sme-request-questions/request/${backendRequestId}`,
    ));
  if (!reconciled) return null;
  const map: Record<number, number> = {};
  for (const srq of reconciled) map[srq.questionId] = srq.id;
  return map;
}

export async function fetchSmeEmail(
  backendRequestId: number,
): Promise<{ subject: string; body: string } | null> {
  const composed = await get<{ to: string; subject: string; body: string }>(
    `/sme-requests/${backendRequestId}/email`,
  );
  return composed ? { subject: composed.subject, body: composed.body } : null;
}

export function syncSmeRequest(
  backendId: number | undefined,
  patch: {
    eta?: string | null;
    status?: string;
    confirmedBy?: string | null;
    returnedAt?: string | null;
  },
) {
  if (!backendId) return;
  // Only send status values supported by the backend.
  const statusMap: Record<string, string> = {
    Requested: "Waiting for ETA",
    "ETA Set": "ETA Confirmed",
    Overdue: "Overdue",
    Returned: "Returned",
  };
  void put(`/sme-requests/${backendId}`, {
    ...patch,
    status: patch.status ? statusMap[patch.status] : undefined,
    eta: patch.eta ? patch.eta.slice(0, 19) : patch.eta,
    returnedAt: patch.returnedAt
      ? patch.returnedAt.slice(0, 19)
      : patch.returnedAt,
  });
}

export async function unreturnBackendSmeRequest(
  backendId: number | undefined,
): Promise<boolean> {
  if (!backendId) return true;
  return (await post(`/sme-requests/${backendId}/unreturn`, {})) !== null;
}

export function syncSmeAnswer(srqId: number | undefined, answer: string) {
  if (!srqId) return;
  void patch(`/sme-request-questions/${srqId}/answer`, {
    returnedAnswer: answer,
  });
}

export type DashboardStats = {
  totalTickets: number;
  closedTickets: number;
  inProgressTickets: number;
  totalQuestions: number;
  answeredFromKnowledgeBase: number;
  answeredBySme: number;
  overdueSmeRequests: number;
  aiCoveragePercent: number;
};

export async function fetchDashboardStats(): Promise<DashboardStats | null> {
  try {
    const res = await fetch(`${BASE}/dashboard/stats`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as DashboardStats;
  } catch {
    return null;
  }
}
