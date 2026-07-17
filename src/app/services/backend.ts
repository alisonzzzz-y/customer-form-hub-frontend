// Backend integration layer for the MVP shell.
//
// Every call is best-effort: if Alison's Spring Boot backend (localhost:8080)
// is reachable the app uses real parsing/classification/RAG/export; when it is
// not, callers fall back to the simulated layer in simulation.ts. Field-name
// and status-value mapping between the PRD frontend model and the current
// backend entities lives here so it can be deleted once the schemas converge
// (see NOTES_FOR_ALISON.md §4.6).

import type {
  ClassifiedQuestion,
  FinalAnswerInput,
  FormQuestion,
  SearchResult,
  SmeRequestQuestion,
} from "../api";
import {
  MvpQuestion,
  MvpTicket,
  SUGGESTED_THRESHOLD,
  SharingStatus,
  TBD_DEPARTMENT,
} from "../data/model";

// The backend classifier's fallback bucket is "General"; questions show it as
// "TBD" so analysts know the AI did not pick a department. Stored value stays
// "General" until the classifier vocabulary is renamed on the backend too.
export function questionDeptFromBackend(d: string | null | undefined): string {
  return d && d !== "General" ? d : TBD_DEPARTMENT;
}
function questionDeptToBackend(d: string): string {
  return d === TBD_DEPARTMENT ? "General" : d;
}

// Configurable for deployment (PR #3 review): VITE_API_BASE on Vercel,
// localhost default for development. All requests in this module go through
// BASE — api.ts is only used for its types here, since its axios instance is
// hardcoded to localhost.
const BASE = `${import.meta.env.VITE_API_BASE ?? "http://localhost:8080"}/api`;

export function exportUrl(backendTicketId: number): string {
  return `${BASE}/export/ticket/${backendTicketId}`;
}

// ─── Live/offline status ─────────────────────────────────────────────────────

let listener: ((live: boolean) => void) | null = null;
export function onBackendStatus(fn: (live: boolean) => void) {
  listener = fn;
}
function report(live: boolean) {
  listener?.(live);
}

export async function pingBackend(): Promise<boolean> {
  try {
    // Generous timeout: the hosted backend answers in ~1-2s when warm, and a
    // premature abort here silently strands the app on demo seed data.
    const res = await fetch(`${BASE}/tickets`, { signal: AbortSignal.timeout(8000) });
    report(res.ok);
    return res.ok;
  } catch {
    report(false);
    return false;
  }
}

// Fire-and-forget writes must not fail silently: the shell registers a
// listener so a lost write at least tells the user their change may not have
// been saved. Throttled — a burst of failures is one problem, not ten toasts.
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

// Wrap any backend promise: resolve null on failure instead of throwing.
// An HTTP error response means the backend ANSWERED — only network-level
// failures may flip the app into offline mode (a 500 is not "offline").
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

// File uploads need richer outcomes than attempt(): a 400 from the parser is
// the backend WORKING and telling us the file is wrong — that must reach the
// user instead of silently falling back to simulated questions.
type FileOutcome<T> =
  | { kind: "ok"; data: T }
  | { kind: "rejected"; message: string }
  | { kind: "offline" };

async function postFile<T>(path: string, file: File): Promise<FileOutcome<T>> {
  const form = new FormData();
  form.append("file", file);
  try {
    // Parsing + LLM classification on the hosted backend can take a while,
    // but must not spin forever (F-04): 3 minutes, then a clear failure.
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
      } catch { /* non-JSON error body */ }
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

// ─── Value mapping between frontend and backend vocabularies ─────────────────

// backend Ticket.ndaStatus: Yes / No / Unknown
const NDA_TO_BACKEND: Record<string, string> = {
  "In Place": "Yes",
  Missing: "No",
  Unknown: "Unknown",
};

// backend KB sharingStatus: Public / Customer-shareable / NDA-required (spec)
export function mapSharing(raw: string | null | undefined): SharingStatus {
  if (!raw) return "Internal";
  const v = raw.toLowerCase();
  if (v.includes("nda")) return "NDA Required";
  if (v.includes("public") || v.includes("shareable")) return "Public";
  return "Internal";
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

type BackendTicket = { id: number };

export async function createBackendTicket(t: MvpTicket): Promise<number | null> {
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

// Sync edited intake fields for a backend-synced ticket. Both backend PUTs
// are null-skip partial updates (verified in TicketService/FormQuestionService),
// so sending only the changed fields is safe. Debounced per ticket because
// text inputs fire per keystroke.
const ticketSyncTimers = new Map<number, ReturnType<typeof setTimeout>>();
const ticketSyncPending = new Map<number, Record<string, unknown>>();

export function syncTicketFields(backendId: number | undefined, t: Partial<MvpTicket>) {
  if (!backendId) return;
  const payload: Record<string, unknown> = {};
  if (t.customer !== undefined) payload.customerName = t.customer;
  if (t.ae !== undefined) payload.createdBy = t.ae ?? undefined;
  if (t.due) payload.deadline = `${t.due}T00:00:00`;
  if (t.urgency !== undefined) payload.urgency = t.urgency;
  if (t.nda !== undefined) payload.ndaStatus = NDA_TO_BACKEND[t.nda] ?? "Unknown";
  if (t.businessImpact !== undefined) payload.businessImpact = t.businessImpact ?? undefined;
  if (Object.keys(payload).length === 0) return;

  ticketSyncPending.set(backendId, { ...ticketSyncPending.get(backendId), ...payload });
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

// Grouping/review department changes must reach the backend: the SME package
// endpoint filters ITS copy of the questions by department.
export function syncQuestionDepartment(backendId: number | undefined, department: string) {
  if (!backendId) return;
  void put(`/questions/${backendId}`, { department: questionDeptToBackend(department) });
}

export function syncTicketStatus(backendId: number | undefined, status: string) {
  if (!backendId) return;
  // frontend lifecycle statuses collapse onto the backend's smaller set
  const map: Record<string, string> = {
    "In Progress": "In Review",
    "Intake Review": "Intake Missing",
    "AI Processing": "In Review",
    "Ready for Review": "In Review",
    Approved: "Completed",
    Sent: "Completed",
    Closed: "Completed",
  };
  void patch(`/tickets/${backendId}/status`, { status: map[status] ?? status });
}

// ─── Questionnaire parsing + classification (real files) ─────────────────────

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
    // One user action = at most one upload (F-03). No fallback to /classify:
    // if the import response was lost the questions may already be saved
    // server-side, and a second upload path would double-process the file.
    return imported;
  }
  const classified = await postFile<ClassifiedQuestion[]>("/questionnaire/classify", file);
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

// ─── RAG retrieval for suggestions and AI Search ─────────────────────────────

export async function ragSearch(question: string): Promise<SearchResult[] | null> {
  return post<SearchResult[]>("/knowledge-base/search", { question });
}

// Batched retrieval (PR #3 review, discussion 4): a 36-question form must not
// fire 36 concurrent embedding calls at a free-tier backend. Runs in batches
// of 5; a null result for the first probe means the backend is offline.
export async function ragSearchAll(
  questions: { id: number; text: string }[],
): Promise<Map<number, SearchResult[]> | null> {
  if (questions.length === 0) return new Map();
  const first = await ragSearch(questions[0].text);
  if (first === null) return null; // offline → caller falls back to simulation
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

// Apply the retrieval hits to a question. Mirrors RetrievalService: cosine
// similarity >= 0.35, top 3 — first hit becomes the primary suggestion, the
// rest are shown as alternative matches (AI-03/04/05).
export function applyRagResult(q: MvpQuestion, results: SearchResult[]): MvpQuestion {
  // the backend already applies its 0.35 similarity threshold and returns top 3
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
    suggested: { text: top.content, knowledgeId: top.id, reasoning: describe(top) },
    alternatives: hits.slice(1).map((r) => ({
      text: r.content,
      knowledgeId: r.id,
      confidence: r.similarityScore ?? 0,
      reasoning: describe(r),
      sharingStatus: mapSharing(r.sharingStatus),
    })),
    status: score >= SUGGESTED_THRESHOLD ? "Suggested" : "Needs Review",
  };
}

// ─── Startup load: hydrate the local model from the backend ─────────────────
// Called once when the backend is reachable so existing tickets, questions,
// SME requests, answers and knowledge appear in the app (the local demo seeds
// stay alongside; everything loaded here is fully live-synced).

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

export type BackendWorld = {
  tickets: MvpTicket[];
  questions: MvpQuestion[];
  smeRequests: import("../data/model").MvpSmeRequest[];
};

export async function loadBackendWorld(knownBackendIds: Set<number>): Promise<BackendWorld | null> {
  const raw = await get<BackendTicketFull[]>("/tickets");
  if (raw === null) return null;
  const world: BackendWorld = { tickets: [], questions: [], smeRequests: [] };

  // Each round-trip to the hosted backend costs ~1s; sequential fetching made
  // hydration take 30s+ for a handful of tickets. Fetch every ticket's detail
  // lists concurrently.
  const perTicket = await Promise.all(
    raw
      .filter((bt) => !knownBackendIds.has(bt.id)) // already in local state this session
      .map(async (bt) => {
        const [bqs, answers, breqsRaw] = await Promise.all([
          get<FormQuestion[]>(`/questions/ticket/${bt.id}`),
          get<QuestionWithAnswer[]>(`/final-review/ticket/${bt.id}`),
          get<BackendSmeRequestFull[]>(`/sme-requests/ticket/${bt.id}`),
        ]);
        const breqs = breqsRaw ?? [];
        const linkLists = await Promise.all(
          breqs.map((r) => get<SmeRequestQuestion[]>(`/sme-request-questions/request/${r.id}`)),
        );
        return { bt, bqs: bqs ?? [], answers: answers ?? [], breqs, linkLists };
      }),
  );

  for (const { bt, bqs, answers, breqs, linkLists } of perTicket) {
    const localId = `TK-${9000 + bt.id}`;
    // Only Confirmed answers count as approved — a Draft row is what an
    // unapproved answer looks like, and must not hydrate back as Approved.
    const answerByQ = new Map(
      answers
        .filter((a) => a.answered && a.approvalStatus === "Confirmed")
        .map((a) => [a.questionId, a]),
    );

    // which backend questions are linked to an SME request (and their link ids)
    const linkByQ = new Map<number, { reqId: number; srqId: number; returned: boolean }>();
    breqs.forEach((r, i) => {
      for (const l of linkLists[i] ?? [])
        linkByQ.set(l.questionId, { reqId: r.id, srqId: l.id, returned: l.status === "Returned" });
    });

    const localQs: MvpQuestion[] = bqs.map((q, i) => {
      const fa = answerByQ.get(q.id);
      const link = linkByQ.get(q.id);
      const sourceType =
        fa?.sourceType === "SME" ? "SME" : fa?.sourceType === "Manual" ? "Manual" : "AI";
      let status: MvpQuestion["status"];
      if (fa) status = link?.returned ? "SME Complete" : "Approved";
      else if (q.status === "SME Needed") status = link ? "Waiting SME" : "SME Queued";
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
      };
    });

    const localReqs = breqs.map((r) => {
      const statusMap: Record<string, import("../data/model").MvpSmeRequest["status"]> = {
        "Waiting for ETA": "Requested",
        "ETA Confirmed": "ETA Set",
        Overdue: "ETA Set", // our UI derives overdue from the clock
        Returned: "Returned",
        "In Progress": "ETA Set", // legacy rows written before the vocab guard
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

    // derive the workflow stage from the loaded state
    const allDone =
      localQs.length > 0 &&
      localQs.every((q) => ["Approved", "SME Complete"].includes(q.status));
    const anyWaiting = localQs.some((q) => q.status === "Waiting SME");
    const anyQueued = localQs.some((q) => q.status === "SME Queued");
    const stage: MvpTicket["stage"] =
      bt.status === "Completed" ? "done"
      : localQs.length === 0 ? "intake"
      : allDone ? "final"
      : anyWaiting ? "eta"
      : anyQueued ? "sme"
      : "review";

    const statusMap: Record<string, MvpTicket["status"]> = {
      New: "New",
      "Intake Missing": "Intake Review",
      "In Review": "In Progress",
      "Waiting SME": "Waiting SME",
      Completed: "Closed",
    };

    world.tickets.push({
      id: localId,
      backendId: bt.id,
      customer: bt.customerName,
      sorId: "—",
      owner: bt.assignedTo ?? "Sarah Chen",
      status: statusMap[bt.status] ?? "In Progress",
      stage,
      due: bt.deadline?.slice(0, 10) ?? "",
      created: bt.createdAt?.slice(0, 10) ?? "",
      closed: bt.status === "Completed" ? (bt.createdAt?.slice(0, 10) ?? undefined) : undefined,
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

// Live knowledge entries for the MVP Knowledge Base module (replaces the
// seeded list when the backend is reachable, so suggestion source links
// resolve to real entries).
export async function loadBackendKnowledge(): Promise<
  import("../data/model").MvpKnowledgeEntry[] | null
> {
  const raw = await get<SearchResult[]>("/knowledge-base");
  if (raw === null || raw.length === 0) return null;
  return raw.map((k) => ({
    id: k.id,
    title: `${k.documentTitle} — ${k.sectionTitle}`,
    content: k.content,
    department: k.department,
    source: k.source,
    lastUpdated: k.lastUpdated?.slice(0, 10) ?? "—",
    sharingStatus: mapSharing(k.sharingStatus),
    status: k.approved ? "Approved" : "Pending Review",
    tags: [],
    owner: k.department,
  }));
}

// Write-back for the MVP Knowledge Base module (approve/edit/archive/create).
// The backend models approval as a boolean; richer statuses (Draft/Deprecated/
// Archived) map to approved=false until it gains a status field.
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
    lastUpdated: entry.lastUpdated && entry.lastUpdated !== "—" ? `${entry.lastUpdated}T00:00:00` : null,
    sharingStatus: SHARING_TO_BACKEND[entry.sharingStatus] ?? entry.sharingStatus,
    department: entry.department,
    approved: entry.status === "Approved",
  };
  if (isNew) {
    const created = await post<{ id: number }>("/knowledge-base", payload);
    return created?.id ?? null;
  }
  const updated = await put<{ id: number }>(`/knowledge-base/${entry.id}`, payload);
  return updated?.id ?? null;
}

// ─── Answers ─────────────────────────────────────────────────────────────────

export function syncFinalAnswer(q: MvpQuestion, answerText: string, edited: boolean, approvedBy: string) {
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
  // the backend flips the question to "Answered" itself on Confirmed saves
  void post("/final-answers", input);
}

// Unapprove: downgrade the backend final answer to Draft instead of deleting
// it. The backend upserts by questionId with null-skip, and its Excel export
// prints "(Draft – not confirmed)" for anything not Confirmed — so a reverted
// answer can never reach the customer while the audit trail is preserved.
export function revertFinalAnswer(q: MvpQuestion) {
  if (!q.backendId) return;
  void post("/final-answers", { questionId: q.backendId, approvalStatus: "Draft" });
}

export function syncQuestionStatus(backendId: number | undefined, status: string) {
  if (!backendId) return;
  void patch(`/questions/${backendId}/status`, { status });
}

// ─── SME requests ────────────────────────────────────────────────────────────

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

// Link the ticket's "SME Needed" questions of this department to the request;
// returns a map of backend question id → SmeRequestQuestion id.
export async function packageBackendQuestions(
  backendRequestId: number,
  backendTicketId: number,
  department: string,
): Promise<Record<number, number> | null> {
  const linked = await post<SmeRequestQuestion[]>("/sme-request-questions/package", {
    smeRequestId: backendRequestId,
    ticketId: backendTicketId,
    department,
  });
  if (!linked) return null;
  const map: Record<number, number> = {};
  for (const srq of linked) map[srq.questionId] = srq.id;
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
  patch: { eta?: string | null; status?: string; confirmedBy?: string | null; returnedAt?: string | null },
) {
  if (!backendId) return;
  // Backend vocabulary: Waiting for ETA / ETA Confirmed / Overdue / Returned.
  // Anything unmapped is a frontend-only state — drop it rather than writing
  // an invalid string into the shared database.
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
    returnedAt: patch.returnedAt ? patch.returnedAt.slice(0, 19) : patch.returnedAt,
  });
}

export function syncSmeAnswer(srqId: number | undefined, answer: string) {
  if (!srqId) return;
  void patch(`/sme-request-questions/${srqId}/answer`, { returnedAnswer: answer });
}
