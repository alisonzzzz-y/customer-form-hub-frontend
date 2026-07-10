/// <reference path="./vite-env.d.ts" />
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
import { MvpQuestion, MvpTicket, SharingStatus } from "./data";

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
    const res = await fetch(`${BASE}/tickets`, { signal: AbortSignal.timeout(2500) });
    report(res.ok);
    return res.ok;
  } catch {
    report(false);
    return false;
  }
}

// Wrap any backend promise: resolve null on failure instead of throwing.
async function attempt<T>(p: Promise<T>): Promise<T | null> {
  try {
    const v = await p;
    report(true);
    return v;
  } catch {
    report(false);
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
  );
}

async function postFile<T>(path: string, file: File): Promise<T | null> {
  const form = new FormData();
  form.append("file", file);
  return attempt(
    fetch(`${BASE}${path}`, { method: "POST", body: form }).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<T>;
    }),
  );
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

export async function parseQuestionnaire(
  file: File,
  backendTicketId: number | null,
): Promise<ParsedBackendQuestion[] | null> {
  if (backendTicketId !== null) {
    const imported = await postFile<FormQuestion[]>(
      `/questionnaire/import?ticketId=${backendTicketId}`,
      file,
    );
    if (imported)
      return imported.map((fq) => ({
        backendId: fq.id,
        text: fq.questionText,
        department: fq.department ?? "General",
        section: fq.rowReference ?? "",
      }));
  }
  const classified = await postFile<ClassifiedQuestion[]>("/questionnaire/classify", file);
  if (classified)
    return classified.map((c) => ({
      text: c.questionText,
      department: c.department || "General",
      section: c.section,
    }));
  return null;
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
    // with text-embedding-3-small a near-perfect match scores ~0.75–0.85,
    // so 0.6 marks "confident" (calibrate against seed questions over time)
    status: score >= 0.6 ? "Suggested" : "Needs Review",
  };
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
  const statusMap: Record<string, string> = {
    Requested: "Waiting for ETA",
    "ETA Set": "ETA Confirmed",
    Returned: "Returned",
  };
  void put(`/sme-requests/${backendId}`, {
    ...patch,
    status: patch.status ? (statusMap[patch.status] ?? patch.status) : undefined,
    eta: patch.eta ? patch.eta.slice(0, 19) : patch.eta,
    returnedAt: patch.returnedAt ? patch.returnedAt.slice(0, 19) : patch.returnedAt,
  });
}

export function syncSmeAnswer(srqId: number | undefined, answer: string) {
  if (!srqId) return;
  void patch(`/sme-request-questions/${srqId}/answer`, { returnedAnswer: answer });
}
