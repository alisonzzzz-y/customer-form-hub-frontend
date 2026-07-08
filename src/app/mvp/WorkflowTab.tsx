import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Brain,
  CheckCircle,
  CheckSquare,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  Info,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Send,
  Shield,
  X,
} from "lucide-react";
import { BtnPrimary, BtnSecondary } from "../components/shared";
import {
  DEPARTMENTS,
  MOCK_NOW,
  MvpQuestion,
  MvpSmeRequest,
  MvpTicket,
  TicketStage,
  fmtDate,
  fmtDateTime,
  pendingForms,
} from "./data";
import { AppActions, AppState } from "./MvpApp";
import {
  applyRagResult,
  createBackendSmeRequest,
  createBackendTicket,
  parseQuestionnaire,
  fetchSmeEmail,
  packageBackendQuestions,
  ragSearch,
  syncFinalAnswer,
  syncQuestionStatus,
  syncSmeAnswer,
  syncSmeRequest,
  syncTicketStatus,
} from "./backend";
import { ClarificationEmailModal } from "./NewRequestFlow";
import { attachSuggestions, extractQuestionsFor, smeAnswerFor } from "./simulation";
import { exportTicketUrl } from "../api";
import { Card, ConfidenceBadge, Pill, SharingBadge, Th, openMailDraft } from "./ui";

// Guided per-ticket workflow, ported from the original prototype:
// Intake → Grouping → Answer Review → SME Package → ETA Tracking → Final Review.
// Routing a question to SME only queues it; requests are sent per department
// from the SME Package stage.

const STAGES: { id: TicketStage; label: string }[] = [
  { id: "intake", label: "Intake" },
  { id: "grouping", label: "Grouping" },
  { id: "review", label: "Answer Review" },
  { id: "sme", label: "SME Package" },
  { id: "eta", label: "ETA Tracking" },
  { id: "final", label: "Final Review" },
];

export function WorkflowTab({
  state,
  actions,
  ticketId,
}: {
  state: AppState;
  actions: AppActions;
  ticketId: string;
}) {
  const ticket = state.tickets.find((t) => t.id === ticketId);
  if (!ticket) return null;
  const qs = state.questions.filter((q) => q.ticketId === ticketId);
  const reqs = state.smeRequests.filter((r) => r.ticketId === ticketId);

  return (
    <div className="flex flex-col gap-4">
      <StageStepper stage={ticket.stage} />
      {ticket.stage === "intake" && <IntakePanel ticket={ticket} state={state} actions={actions} />}
      {ticket.stage === "grouping" && <GroupingPanel ticket={ticket} qs={qs} actions={actions} />}
      {ticket.stage === "review" && <ReviewPanel ticket={ticket} qs={qs} state={state} actions={actions} />}
      {ticket.stage === "sme" && <SmePackagePanel ticket={ticket} qs={qs} state={state} actions={actions} />}
      {ticket.stage === "eta" && <EtaPanel ticket={ticket} qs={qs} reqs={reqs} actions={actions} />}
      {ticket.stage === "final" && <FinalPanel ticket={ticket} qs={qs} reqs={reqs} actions={actions} />}
      {ticket.stage === "done" && <DonePanel qs={qs} actions={actions} />}
    </div>
  );
}

function StageStepper({ stage }: { stage: TicketStage }) {
  const idx = stage === "done" ? STAGES.length : STAGES.findIndex((s) => s.id === stage);
  return (
    <div className="flex items-center bg-white rounded-xl border border-[rgba(0,0,0,0.06)] px-4 py-2.5 overflow-x-auto">
      {STAGES.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.id} className="flex items-center shrink-0">
            <div
              className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold tracking-[0.04em] uppercase ${active ? "text-[#F96702]" : done ? "text-[#C05600]" : "text-[#C0BEBA]"}`}
            >
              {done ? (
                <div className="w-3.5 h-3.5 rounded-full bg-[#F96702] flex items-center justify-center">
                  <CheckCircle size={9} className="text-white" />
                </div>
              ) : active ? (
                <div className="w-3.5 h-3.5 rounded-full bg-[#F96702] flex items-center justify-center ring-2 ring-[#F96702]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-[#D8D5D0]" />
              )}
              {s.label}
            </div>
            {i < STAGES.length - 1 && (
              <div className={`w-5 h-px mx-1 shrink-0 ${i < idx ? "bg-[#F96702]/40" : "bg-[#D8D5D0]"}`} />
            )}
          </div>
        );
      })}
      {stage === "done" && (
        <span className="ml-auto text-[10px] font-bold text-green-700 flex items-center gap-1 shrink-0">
          <CheckCircle size={11} /> Workflow complete
        </span>
      )}
    </div>
  );
}

// ─── Stage: Intake (same full-page check whether extraction was complete) ────

const MISSING_LABELS: Record<string, string> = {
  customer: "Customer name — which account is this request for?",
  due: "Response deadline — by what date does the customer need completed answers?",
  urgency: "Urgency level — High, Medium or Low?",
  nda: "NDA status — is there an active NDA with the customer?",
  impact: "Business impact — renewal, expansion or new deal, and rough value?",
};

function IntakePanel({
  ticket,
  state,
  actions,
}: {
  ticket: MvpTicket;
  state: AppState;
  actions: AppActions;
}) {
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const missing = ticket.intakeMissing ?? [];
  const patch = (p: Partial<MvpTicket>, clearFlag?: string) =>
    actions.setTickets((prev) =>
      prev.map((t) =>
        t.id === ticket.id
          ? {
              ...t,
              ...p,
              intakeMissing: clearFlag
                ? (t.intakeMissing ?? []).filter((m) => m !== clearFlag)
                : t.intakeMissing,
            }
          : t,
      ),
    );

  const input = "border border-border rounded-md px-2 py-1 text-xs w-56";
  const rows: { key: string; label: string; edit: React.ReactNode }[] = [
    {
      key: "customer",
      label: "Customer",
      edit: (
        <input
          className={input}
          value={ticket.customer}
          onChange={(e) => patch({ customer: e.target.value }, "customer")}
        />
      ),
    },
    {
      key: "ae",
      label: "AE / Requester",
      edit: (
        <input
          className={input}
          value={ticket.ae ?? ""}
          placeholder="e.g. Jane Smith"
          onChange={(e) => patch({ ae: e.target.value || undefined })}
        />
      ),
    },
    {
      key: "due",
      label: "Deadline",
      edit: (
        <input
          type="date"
          className={input}
          value={ticket.due}
          onChange={(e) => patch({ due: e.target.value }, "due")}
        />
      ),
    },
    {
      key: "urgency",
      label: "Urgency level",
      edit: (
        <select
          className={`${input} bg-white`}
          value={ticket.urgency}
          onChange={(e) => patch({ urgency: e.target.value as MvpTicket["urgency"] }, "urgency")}
        >
          {["High", "Medium", "Low"].map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      ),
    },
    {
      key: "nda",
      label: "NDA status",
      edit: (
        <select
          className={`${input} bg-white`}
          value={ticket.nda}
          onChange={(e) => {
            const v = e.target.value as MvpTicket["nda"];
            patch({ nda: v }, v !== "Unknown" ? "nda" : undefined);
          }}
        >
          {["In Place", "Missing", "Unknown"].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      ),
    },
    {
      key: "impact",
      label: "Business impact",
      edit: (
        <input
          className={input}
          value={ticket.businessImpact ?? ""}
          placeholder="e.g. Renewal, ~$450k ARR"
          onChange={(e) => patch({ businessImpact: e.target.value || undefined }, "impact")}
        />
      ),
    },
  ];

  const isMissing = (key: string) =>
    missing.includes(key) || (key === "nda" && ticket.nda === "Unknown") || (key === "due" && !ticket.due);
  const requiredMissing = ["customer", "due", "urgency", "nda"].filter(isMissing);
  const ready = requiredMissing.length === 0;

  const confirm = async () => {
    setProcessing(true);
    patch({ status: "AI Processing" });
    actions.logActivity("Confirmed intake complete — AI analysis started", ticket.id);

    // sync the ticket to the backend now that the fields are final
    let backendId = ticket.backendId ?? null;
    if (!backendId) {
      backendId = await createBackendTicket({ ...ticket });
      if (backendId) patch({ backendId });
    }

    // real file → backend parse + LLM classification; otherwise simulation
    const base = Math.max(0, ...state.questions.map((q) => q.id));
    const file = pendingForms.get(ticket.id);
    let newQs: MvpQuestion[] = [];
    let live = false;
    if (file) {
      const parsed = await parseQuestionnaire(file, backendId);
      if (parsed && parsed.length > 0) {
        live = true;
        pendingForms.delete(ticket.id);
        newQs = parsed.map((pq, i) => ({
          id: base + i + 1,
          backendId: pq.backendId,
          ticketId: ticket.id,
          row: i + 1,
          original: pq.text,
          normalised: pq.text,
          department: pq.department,
          risk: "Medium" as const,
          status: "AI Analysed" as const,
          confidence: null,
        }));
      }
    }
    if (newQs.length === 0) newQs = extractQuestionsFor(ticket.id, base);

    setTimeout(() => {
      actions.setQuestions((p) => [...p, ...newQs]);
      actions.setTickets((p) =>
        p.map((t) =>
          t.id === ticket.id
            ? {
                ...t,
                status: "In Progress",
                stage: "grouping",
                files: t.files.map((fl) =>
                  fl.kind === "Customer form" ? { ...fl, status: "Processed" } : fl,
                ),
              }
            : t,
        ),
      );
      syncTicketStatus(backendId ?? undefined, "In Progress");
      actions.logActivity(
        live
          ? `AI parsed ${file!.name} and classified ${newQs.length} questions by department (live backend)`
          : `AI extracted ${newQs.length} questions and classified departments (1 possible duplicate flagged)`,
        ticket.id,
      );
      actions.addToast(
        `${newQs.length} questions ${live ? "parsed from the uploaded form" : "extracted"} — review the department grouping.`,
        "success",
      );
    }, live ? 300 : 1400);
  };

  if (processing)
    return <ProcessingCard text="Extracting questions · normalising text · classifying departments…" />;

  return (
    <Card title="Intake Check">
      <div className="px-4 py-3">
        {!ready ? (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3.5 py-2.5 flex items-start gap-2.5 mb-3">
            <AlertTriangle size={13} className="text-orange-500 shrink-0 mt-0.5" />
            <div className="text-xs text-orange-700">
              <p className="font-semibold mb-0.5">Intake incomplete</p>
              <p>
                Fill the missing fields directly in the table below, or{" "}
                <button
                  onClick={() => setClarifyOpen(true)}
                  className="font-bold underline hover:text-orange-900"
                >
                  email the AE to clarify
                </button>{" "}
                — the draft lists only what is missing. AI analysis starts once the required
                fields are resolved (NT-04).
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-[#FFF4EC] border border-[#F96702]/25 rounded-lg px-3.5 py-2.5 flex items-center gap-2.5 mb-3">
            <CheckCircle size={13} className="text-[#F96702] shrink-0" />
            <p className="text-xs font-semibold text-[#C05600]">
              All required intake fields resolved — review and continue to AI analysis.
            </p>
          </div>
        )}
        <table className="w-full">
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                className={`border-b border-border last:border-0 ${isMissing(r.key) ? "bg-orange-50/40" : ""}`}
              >
                <td className="px-3 py-2.5 text-xs font-medium text-[#1F2937] w-44">{r.label}</td>
                <td className="px-3 py-2.5">{r.edit}</td>
                <td className="px-3 py-2.5 w-28">
                  {isMissing(r.key) ? (
                    <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
                      <AlertTriangle size={11} /> Missing
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle size={11} /> Found
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pendingForms.has(ticket.id) && (
          <p className="text-[10px] text-[#6B7280] mt-2 flex items-center gap-1">
            <FileSpreadsheet size={10} className="text-green-600" />
            {pendingForms.get(ticket.id)!.name} attached — it will be parsed right after this step.
          </p>
        )}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span title="Confirm the intake fields — AI then extracts and classifies the questions automatically">
            <BtnPrimary onClick={confirm} disabled={!ready}>
              <Brain size={12} /> Next: Analyse Form <ChevronRight size={11} />
            </BtnPrimary>
          </span>
          <button
            onClick={() => setClarifyOpen(true)}
            title="Auto-drafts an editable email to the AE asking only for the missing intake fields"
            className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-semibold border border-[#F96702]/30 text-[#C05600] bg-[#FFF4EC] rounded-full hover:bg-[#FFE8D0] transition-colors"
          >
            <Mail size={11} /> Draft Clarification Email
          </button>
        </div>
      </div>
      {clarifyOpen && (
        <ClarificationEmailModal
          customer={ticket.customer}
          ae={ticket.ae}
          aeEmail={ticket.aeEmail}
          missing={
            requiredMissing.length > 0
              ? requiredMissing.concat(missing.includes("impact") ? ["impact"] : []).map((k) => MISSING_LABELS[k])
              : Object.values(MISSING_LABELS)
          }
          actions={actions}
          close={() => setClarifyOpen(false)}
        />
      )}
    </Card>
  );
}

function ProcessingCard({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-10 flex flex-col items-center gap-3">
      <Loader2 size={24} className="animate-spin text-[#F96702]" />
      <p className="text-xs text-[#6B7280]">{text}</p>
    </div>
  );
}

// ─── Stage: Grouping (adjust AI department classification, per-dept tabs) ───

function GroupingPanel({
  ticket,
  qs,
  actions,
}: {
  ticket: MvpTicket;
  qs: MvpQuestion[];
  actions: AppActions;
}) {
  const [processing, setProcessing] = useState(false);
  const [tab, setTab] = useState("");
  const [customFor, setCustomFor] = useState<number | null>(null);
  const [customName, setCustomName] = useState("");

  // standard departments first, then any custom ones already assigned
  const customs = [...new Set(qs.map((q) => q.department))].filter(
    (d) => !DEPARTMENTS.includes(d),
  );
  const knownDepts = [...DEPARTMENTS, ...customs];
  const depts = knownDepts.filter((d) => qs.some((q) => q.department === d));
  const active = depts.includes(tab) ? tab : (depts[0] ?? "");
  const dq = qs.filter((q) => q.department === active);

  const moveDept = (q: MvpQuestion, dept: string) => {
    actions.setQuestions((p) =>
      p.map((x) => (x.id === q.id ? { ...x, department: dept } : x)),
    );
    actions.logActivity(`Moved question #${q.row} to ${dept}`, ticket.id);
  };

  const confirm = async () => {
    setProcessing(true);
    actions.logActivity("Confirmed department grouping — generating AI suggestions", ticket.id);
    const pending = qs.filter((q) => !q.finalAnswer && q.status !== "SME Queued");

    // Try live RAG retrieval first (POST /api/knowledge-base/search per question)
    let updates: Map<number, MvpQuestion> | null = null;
    const probe = pending.length > 0 ? await ragSearch(pending[0].normalised || pending[0].original) : null;
    if (probe !== null) {
      updates = new Map();
      updates.set(pending[0].id, applyRagResult(pending[0], probe));
      const rest = await Promise.all(
        pending.slice(1).map(async (q) => {
          const results = await ragSearch(q.normalised || q.original);
          return [q.id, results ? applyRagResult(q, results) : attachSuggestions(q)] as const;
        }),
      );
      for (const [qid, qq] of rest) updates!.set(qid, qq);
    }

    setTimeout(() => {
      actions.setQuestions((p) =>
        p.map((q) => {
          if (q.ticketId !== ticket.id || q.finalAnswer || q.status === "SME Queued") return q;
          return updates ? (updates.get(q.id) ?? q) : attachSuggestions(q);
        }),
      );
      actions.setTickets((p) =>
        p.map((t) => (t.id === ticket.id ? { ...t, stage: "review" } : t)),
      );
      actions.logActivity(
        updates
          ? `AI retrieved suggestions from the live Knowledge Base for ${updates.size} questions`
          : "AI generated suggested answers from approved knowledge (simulated)",
        ticket.id,
      );
      actions.addToast("AI suggestions ready — review each answer.", "success");
    }, updates ? 200 : 1200);
  };

  if (processing)
    return <ProcessingCard text="Retrieving approved knowledge · generating suggested answers…" />;

  return (
    <Card
      title={`Department Grouping — ${qs.length} questions`}
      right={
        <span className="text-[10px] text-white/85">
          AI classified each question — adjust below, then confirm
        </span>
      }
    >
      {/* department tabs: jump between groups instead of scrolling one long list */}
      <div className="flex border-b border-border overflow-x-auto">
        {depts.map((d) => (
          <button
            key={d}
            onClick={() => setTab(d)}
            title={`Show the ${d} questions`}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 shrink-0 transition-colors ${active === d ? "border-[#F96702] text-[#C05600]" : "border-transparent text-[#6B7280] hover:text-[#1F2937]"}`}
          >
            {d}
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${active === d ? "bg-[#FFF1E6] text-[#F96702]" : "bg-gray-100 text-gray-500"}`}>
              {qs.filter((q) => q.department === d).length}
            </span>
          </button>
        ))}
      </div>
      <div className="divide-y divide-border/60">
        {dq.map((q) => (
          <div key={q.id} className="px-4 py-2.5 flex items-center gap-3">
            <span className="text-[10px] font-mono text-[#9CA3AF] w-5 shrink-0">{q.row}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#1F2937]">{q.original}</p>
              {q.duplicateOf && (
                <span className="text-[9px] font-bold text-[#4338CA] bg-[#EEF2FF] border border-[#C7D2FE] rounded-full px-2 py-0.5 mt-1 inline-block">
                  Possible duplicate — confirm before answering
                </span>
              )}
            </div>
            <ConfidenceBadge confidence={q.confidence} />
            <select
              value={q.department}
              title="Change which department this question belongs to"
              onChange={(e) => {
                if (e.target.value === "__custom__") {
                  setCustomFor(q.id);
                  setCustomName("");
                  return;
                }
                moveDept(q, e.target.value);
              }}
              className="border border-[rgba(0,0,0,0.15)] rounded-full px-2.5 py-1 text-[10px] font-semibold bg-white shrink-0"
            >
              {knownDepts.map((dep) => (
                <option key={dep}>{dep}</option>
              ))}
              <option value="__custom__">＋ Custom department…</option>
            </select>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-border bg-[#FAFAFA]">
        <span title="AI retrieves approved knowledge and drafts an answer for every question">
          <BtnPrimary onClick={confirm}>
            Next: Generate AI Answers <ChevronRight size={11} />
          </BtnPrimary>
        </span>
      </div>

      {customFor !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-5 w-80">
            <h3 className="text-sm font-semibold text-[#1F2937] mb-0.5">Custom Department</h3>
            <p className="text-xs text-[#6B7280] mb-3">
              Name a department that is not in the standard list — it becomes a tab and gets its
              own SME package later.
            </p>
            <input
              autoFocus
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customName.trim()) {
                  const q = qs.find((x) => x.id === customFor);
                  if (q) moveDept(q, customName.trim());
                  setCustomFor(null);
                }
              }}
              placeholder="e.g. Procurement"
              className="w-full border border-border rounded-md px-2.5 py-1.5 text-xs"
            />
            <div className="flex justify-end gap-2 mt-4">
              <BtnSecondary onClick={() => setCustomFor(null)}>Cancel</BtnSecondary>
              <BtnPrimary
                disabled={!customName.trim()}
                onClick={() => {
                  const q = qs.find((x) => x.id === customFor);
                  if (q) moveDept(q, customName.trim());
                  setCustomFor(null);
                }}
              >
                Assign
              </BtnPrimary>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Stage: Answer Review (per-department tabs, card-by-card) ───────────────

function ReviewPanel({
  ticket,
  qs,
  state,
  actions,
}: {
  ticket: MvpTicket;
  qs: MvpQuestion[];
  state: AppState;
  actions: AppActions;
}) {
  const [deptTab, setDeptTab] = useState("All");
  const [selectedId, setSelectedId] = useState<number | null>(qs[0]?.id ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saveToKb, setSaveToKb] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const customs = [...new Set(qs.map((x) => x.department))].filter((d) => !DEPARTMENTS.includes(d));
  const depts = [...DEPARTMENTS, ...customs].filter((d) => qs.some((x) => x.department === d));
  const visible = deptTab === "All" ? qs : qs.filter((x) => x.department === deptTab);

  const q = visible.find((x) => x.id === selectedId) ?? visible[0] ?? qs[0];
  const RESOLVED = ["Approved", "Ready", "SME Queued", "Waiting SME", "SME Complete", "Rejected"];
  const resolved = qs.filter((x) => RESOLVED.includes(x.status));
  const queued = qs.filter((x) => x.status === "SME Queued");
  const allResolved = qs.length > 0 && resolved.length === qs.length;
  const isResolvedDept = (d: string) =>
    qs.filter((x) => x.department === d).every((x) => RESOLVED.includes(x.status));

  const update = (id: number, patch: Partial<MvpQuestion>, log: string) => {
    actions.setQuestions((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    actions.logActivity(log, ticket.id);
  };

  const select = (id: number) => {
    setSelectedId(id);
    setEditing(false);
    setShowAlternatives(false);
  };

  // after an action: next unresolved question, preferring the current tab
  const advance = () => {
    const next =
      visible.find((x) => x.id !== q?.id && !RESOLVED.includes(x.status)) ??
      qs.find((x) => x.id !== q?.id && !RESOLVED.includes(x.status));
    if (next) select(next.id);
    else setEditing(false);
  };

  // explicit Next: following question in the current tab, wrapping around
  const nextQuestion = () => {
    if (!q || visible.length === 0) return;
    const idx = visible.findIndex((x) => x.id === q.id);
    select(visible[(idx + 1) % visible.length].id);
  };

  const maybeSaveKb = (answerText: string, question: MvpQuestion) => {
    if (!saveToKb) return;
    actions.setKnowledge((p) => [
      {
        id: Math.max(...p.map((k) => k.id)) + 1,
        title: question.normalised,
        content: answerText,
        department: DEPARTMENTS.includes(question.department) ? question.department : "General",
        source: `Ticket ${ticket.id}`,
        lastUpdated: new Date().toISOString().slice(0, 10),
        sharingStatus: question.sharingStatus ?? "Internal",
        status: "Pending Review",
        tags: [question.department],
        owner: state.currentUser,
      },
      ...p,
    ]);
    actions.addToast("Saved to Knowledge Base as Pending Review.", "info");
    setSaveToKb(false);
  };

  const source = q?.suggested ? state.knowledge.find((k) => k.id === q.suggested!.knowledgeId) : undefined;
  const ndaBlocked = q?.sharingStatus === "NDA Required" && ticket.nda !== "In Place";

  const continueNext = () => {
    if (queued.length > 0) {
      actions.setTickets((p) => p.map((t) => (t.id === ticket.id ? { ...t, stage: "sme" } : t)));
      actions.logActivity(`Answer review complete — ${queued.length} question(s) queued for SME`, ticket.id);
    } else {
      actions.setTickets((p) =>
        p.map((t) => (t.id === ticket.id ? { ...t, stage: "final", status: "Ready for Review" } : t)),
      );
      syncTicketStatus(ticket.backendId, "Ready for Review");
      actions.logActivity("Answer review complete — no SME input needed", ticket.id);
    }
  };

  // swap an alternative KB match into the primary suggestion slot
  const useAlternative = (altIndex: number) => {
    if (!q?.alternatives) return;
    const alt = q.alternatives[altIndex];
    const demoted = q.suggested
      ? [{
          text: q.suggested.text,
          knowledgeId: q.suggested.knowledgeId,
          confidence: q.confidence ?? 0,
          reasoning: q.suggested.reasoning,
          sharingStatus: q.sharingStatus,
        }]
      : [];
    update(
      q.id,
      {
        suggested: { text: alt.text, knowledgeId: alt.knowledgeId, reasoning: alt.reasoning },
        confidence: alt.confidence,
        sharingStatus: alt.sharingStatus ?? q.sharingStatus,
        alternatives: [...q.alternatives.filter((_, i) => i !== altIndex), ...demoted],
      },
      `Switched question #${q.row} to an alternative knowledge match`,
    );
    actions.addToast("Switched to the alternative match.", "info");
  };

  if (!q) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-xs text-[#6B7280]">
          <strong className="text-[#1F2937]">{resolved.length}</strong> of{" "}
          <strong className="text-[#1F2937]">{qs.length}</strong> resolved ·{" "}
          <strong className="text-[#C05600]">{queued.length}</strong> queued for SME
        </p>
        <span className="flex-1" />
        <span title="Go back and adjust the department grouping — decisions made here are kept">
          <BtnSecondary
            onClick={() =>
              actions.setTickets((p) =>
                p.map((t) => (t.id === ticket.id ? { ...t, stage: "grouping" } : t)),
              )
            }
          >
            <ArrowLeft size={11} /> Back: Grouping
          </BtnSecondary>
        </span>
      </div>
      <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] overflow-hidden flex flex-col h-[calc(100vh-330px)] min-h-[440px]">
        {/* department tabs */}
        <div className="flex border-b border-border overflow-x-auto shrink-0">
          {["All", ...depts].map((d) => {
            const count = d === "All" ? qs.length : qs.filter((x) => x.department === d).length;
            const done = d !== "All" && isResolvedDept(d);
            return (
              <button
                key={d}
                onClick={() => {
                  setDeptTab(d);
                  const first = (d === "All" ? qs : qs.filter((x) => x.department === d))[0];
                  if (first) select(first.id);
                }}
                title={d === "All" ? "Review every question in one list" : `Review only the ${d} questions`}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 shrink-0 transition-colors ${deptTab === d ? "border-[#F96702] text-[#C05600]" : "border-transparent text-[#6B7280] hover:text-[#1F2937]"}`}
              >
                {d}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${deptTab === d ? "bg-[#FFF1E6] text-[#F96702]" : "bg-gray-100 text-gray-500"}`}>
                  {count}
                </span>
                {done && <CheckCircle size={11} className="text-green-500" />}
              </button>
            );
          })}
        </div>
        <div className="flex flex-1 min-h-0">
          {/* Question list */}
          <div className="w-72 border-r border-[rgba(0,0,0,0.06)] overflow-y-auto shrink-0 bg-[#FAFAF9]">
            {visible.map((item) => (
              <button
                key={item.id}
                onClick={() => select(item.id)}
                className={`w-full text-left px-4 py-3 border-b border-[rgba(0,0,0,0.04)] flex flex-col gap-1.5 transition-all border-l-[3px] ${item.id === q.id ? "bg-[#FFF7F0] border-l-[#F96702]" : "hover:bg-white border-l-transparent"}`}
              >
                <p className="text-[11px] text-[#0A0A0A] leading-snug font-medium">{item.original}</p>
                <div className="flex items-center gap-1.5">
                  <Pill value={item.status} />
                  <span className="text-[9px] text-[#9CA3AF]">{item.department}</span>
                </div>
              </button>
            ))}
          </div>
          {/* Answer card: content scrolls, the action bar below stays visible */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[rgba(0,0,0,0.06)]">
              <div>
                <h3 className="text-base font-bold text-[#0A0A0A] leading-snug tracking-tight">
                  {q.normalised}
                </h3>
                <p className="text-[11px] text-[#9CA3AF] mt-1 italic">Customer wording: “{q.original}”</p>
              </div>
              <Pill value={q.status} />
            </div>

            {ndaBlocked && (
              <div className="bg-[#FFF7F0] border border-[#F96702]/25 rounded-lg px-3.5 py-2.5 flex items-start gap-2.5">
                <Lock size={13} className="text-[#C05600] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#8B4500]">
                  <strong>NDA conflict</strong> — this answer is NDA-restricted but the ticket NDA
                  status is <strong>{ticket.nda}</strong>. Route to SME or confirm the NDA with the AE
                  before approving.
                </p>
              </div>
            )}

            {editing ? (
              <div className="bg-[#F5F4F1] rounded-xl p-4 flex flex-col gap-2">
                <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.14em]">
                  {q.suggested ? "Edit answer" : "Manual answer"}
                </p>
                <textarea
                  rows={6}
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-full text-xs text-[#1F2937] bg-white border border-[rgba(0,0,0,0.1)] rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-[#F96702]/30 leading-relaxed"
                />
                <label className="flex items-center gap-2 text-[11px] text-[#374151] cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-[#F96702]"
                    checked={saveToKb}
                    onChange={(e) => setSaveToKb(e.target.checked)}
                  />
                  Save to Knowledge Base after approval (Pending Review)
                </label>
              </div>
            ) : q.finalAnswer ? (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <p className="text-[9px] font-black text-green-700 uppercase tracking-[0.14em] mb-2">
                  Final answer · {q.finalAnswer.sourceType}
                </p>
                <p className="text-xs text-[#1F2937] leading-relaxed">{q.finalAnswer.text}</p>
              </div>
            ) : q.suggested ? (
              <>
                <div className="border border-[#F96702]/25 rounded-xl overflow-hidden">
                  <div className="px-3.5 py-2 bg-[#FFF4EC] flex items-center gap-2">
                    <Brain size={11} className="text-[#C05600]" />
                    <p className="text-[10px] font-bold text-[#C05600] uppercase tracking-wide flex-1">
                      AI Suggested Answer — best match
                    </p>
                    <ConfidenceBadge confidence={q.confidence} />
                  </div>
                  <p className="px-3.5 py-3 text-xs text-[#1F2937] leading-relaxed">{q.suggested.text}</p>
                  <div className="px-3.5 py-2 bg-[#FAFAFA] border-t border-border grid grid-cols-2 gap-2 text-[10px] text-[#6B7280]">
                    <p>
                      <strong>Source:</strong>{" "}
                      {source ? (
                        <button
                          onClick={() => actions.openKnowledge("all", source.id, ticket.id)}
                          title="Open the knowledge entry — a back-to-ticket button brings you straight back"
                          className="text-[#C05600] font-semibold hover:underline"
                        >
                          {source.title}
                        </button>
                      ) : (
                        "Knowledge entry"
                      )}
                    </p>
                    <p>
                      <strong>Last updated:</strong> {source ? `${source.lastUpdated} (UTC)` : "—"}
                    </p>
                    <p>
                      <strong>Sharing:</strong> {q.sharingStatus ?? "—"}
                    </p>
                    <p>
                      <strong>Why:</strong> {q.suggested.reasoning}
                    </p>
                  </div>
                </div>

                {/* Other matches above the 0.35 similarity threshold (top 3 total) */}
                {(q.alternatives?.length ?? 0) > 0 && (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => setShowAlternatives((o) => !o)}
                      title="The Knowledge Base returned more than one relevant entry — compare and pick the best fit"
                      className="w-full px-3.5 py-2 bg-[#F7F8FA] flex items-center gap-2 hover:bg-[#F0F1F3] transition-colors"
                    >
                      <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide flex-1 text-left">
                        {q.alternatives!.length} other possible match
                        {q.alternatives!.length === 1 ? "" : "es"} from the Knowledge Base
                      </p>
                      <ChevronRight
                        size={12}
                        className={`text-[#9CA3AF] transition-transform ${showAlternatives ? "rotate-90" : ""}`}
                      />
                    </button>
                    {showAlternatives &&
                      q.alternatives!.map((alt, i) => (
                        <div key={i} className="px-3.5 py-3 border-t border-border flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <ConfidenceBadge confidence={alt.confidence} />
                            <span className="text-[10px] text-[#9CA3AF] flex-1">{alt.reasoning}</span>
                            <button
                              onClick={() => useAlternative(i)}
                              title="Replace the suggestion above with this match"
                              className="px-3 py-1 text-[9px] font-bold border border-[#F96702]/40 rounded-full text-[#C05600] hover:bg-[#FFF4EC] tracking-[0.06em] uppercase whitespace-nowrap transition-all"
                            >
                              Use this answer
                            </button>
                          </div>
                          <p className="text-[11px] text-[#374151] leading-relaxed">{alt.text}</p>
                        </div>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-[#F7F8FA] border border-border rounded-xl px-4 py-3.5 text-[11px] text-[#6B7280]">
                No approved knowledge match — <strong>Research Required</strong>. Enter a manual
                answer or route this question to the {q.department} SME team.
              </div>
            )}

            {q.status === "SME Queued" && (
              <p className="text-[11px] text-[#C05600] flex items-center gap-1.5">
                <Clock size={11} /> Queued for the {q.department} SME package — it will be sent with
                the other unresolved {q.department} questions.
              </p>
            )}

            </div>
            {/* pinned action bar — always visible next to the stage Next button */}
            <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-t border-[rgba(0,0,0,0.06)] bg-[#FAFAFA] shrink-0">
              {editing ? (
                <>
                  <BtnPrimary
                    onClick={() => {
                      if (!draft.trim()) {
                        actions.addToast("Answer text cannot be empty.", "warning");
                        return;
                      }
                      update(
                        q.id,
                        {
                          status: "Approved",
                          finalAnswer: {
                            text: draft.trim(),
                            sourceType: q.suggested ? "AI Edited" : "Manual",
                          },
                        },
                        `${q.suggested ? "Edited and approved" : "Manually answered"} question #${q.row}`,
                      );
                      syncFinalAnswer(q, draft.trim(), true, state.currentUser);
                      maybeSaveKb(draft.trim(), q);
                      actions.addToast("Answer approved.", "success");
                      advance();
                    }}
                  >
                    <CheckCircle size={11} /> Save &amp; Approve
                  </BtnPrimary>
                  <BtnSecondary onClick={() => setEditing(false)}>Cancel</BtnSecondary>
                </>
              ) : (
                <>
                  {q.suggested && !q.finalAnswer && q.status !== "SME Queued" && (
                    <button
                      onClick={() => {
                        update(
                          q.id,
                          {
                            status: "Approved",
                            finalAnswer: { text: q.suggested!.text, sourceType: "AI" },
                          },
                          `Approved AI answer for question #${q.row}`,
                        );
                        syncFinalAnswer(q, q.suggested!.text, false, state.currentUser);
                        actions.addToast("Answer approved.", "success");
                        advance();
                      }}
                      disabled={ndaBlocked}
                      title={ndaBlocked ? "Blocked: this answer needs an NDA that the ticket does not have" : "Accept this AI answer as the final answer for this question"}
                      className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase transition-all ${ndaBlocked ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-700"}`}
                    >
                      <CheckCircle size={11} /> Approve
                    </button>
                  )}
                  <span title={q.suggested || q.finalAnswer ? "Rewrite the answer before approving it" : "Write the answer yourself — no knowledge match was found"}>
                    <BtnSecondary
                      onClick={() => {
                        setDraft(q.finalAnswer?.text ?? q.suggested?.text ?? "");
                        setEditing(true);
                      }}
                    >
                      <Edit3 size={11} /> {q.suggested || q.finalAnswer ? "Edit" : "Manual Answer"}
                    </BtnSecondary>
                  </span>
                  {q.status === "Approved" && q.finalAnswer && (
                    <span title="Undo the approval — the question goes back into review">
                      <BtnSecondary
                        onClick={() => {
                          update(
                            q.id,
                            {
                              status: q.suggested
                                ? (q.confidence ?? 0) >= 0.9
                                  ? "Suggested"
                                  : "Needs Review"
                                : "New",
                              finalAnswer: undefined,
                            },
                            `Reverted approval on question #${q.row}`,
                          );
                          syncQuestionStatus(q.backendId, "Needs Review");
                          actions.addToast("Approval undone — the question is back in review.", "info");
                        }}
                      >
                        <RefreshCw size={11} /> Unapprove
                      </BtnSecondary>
                    </span>
                  )}
                  {q.status !== "SME Queued" && !q.finalAnswer && (
                    <button
                      onClick={() => {
                        update(q.id, { status: "SME Queued" }, `Routed question #${q.row} to ${q.department} SME queue`);
                        syncQuestionStatus(q.backendId, "SME Needed");
                        actions.addToast(`Added to the ${q.department} SME queue.`, "info");
                        advance();
                      }}
                      title={`Queue this question for the ${q.department} SME team — nothing is sent yet; all queued questions go out together as one package per department`}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold bg-[#F96702] text-white rounded-full hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.25)] tracking-[0.06em] uppercase transition-all"
                    >
                      <Send size={11} /> Route to SME
                    </button>
                  )}
                  {q.status === "SME Queued" && (
                    <span title="Take this question out of the SME queue and answer it here instead">
                      <BtnSecondary
                        onClick={() => {
                          update(q.id, { status: q.suggested ? "Needs Review" : "New" }, `Removed question #${q.row} from SME queue`);
                          syncQuestionStatus(q.backendId, "Needs Review");
                          actions.addToast("Removed from SME queue.", "info");
                        }}
                      >
                        Remove from Queue
                      </BtnSecondary>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      actions.logActivity(`Asked AE for context on question #${q.row}`, ticket.id);
                      actions.addToast(`Clarification request sent to ${ticket.ae ?? "the AE"}.`, "info");
                    }}
                    title="Email the account executive for missing context about this question"
                    className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-semibold border border-[rgba(0,0,0,0.18)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] tracking-[0.04em] transition-all"
                  >
                    <Mail size={11} /> Ask AE
                  </button>
                  <span className="flex-1" />
                  <button
                    onClick={nextQuestion}
                    title="Move on to the next question in this tab (wraps around)"
                    className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold border border-[#F96702]/40 rounded-full text-[#C05600] hover:bg-[#FFF4EC] tracking-[0.06em] uppercase transition-all"
                  >
                    Next Question <ChevronRight size={11} />
                  </button>
                  {allResolved && (
                    <span title={queued.length > 0 ? "Package the queued questions into per-department SME emails" : "All questions answered — run the completeness checks and export"}>
                      <BtnPrimary onClick={continueNext}>
                        {queued.length > 0
                          ? `Next: SME Package (${queued.length})`
                          : "Next: Final Review"}{" "}
                        <ChevronRight size={11} />
                      </BtnPrimary>
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stage: SME Package (per-department Excel + email, send in bulk) ─────────

function SmePackagePanel({
  ticket,
  qs,
  state,
  actions,
}: {
  ticket: MvpTicket;
  qs: MvpQuestion[];
  state: AppState;
  actions: AppActions;
}) {
  const queued = qs.filter((q) => q.status === "SME Queued");
  const waiting = qs.filter((q) => q.status === "Waiting SME");
  const depts = DEPARTMENTS.filter((d) => queued.some((q) => q.department === d) || waiting.some((q) => q.department === d));
  const [tab, setTab] = useState(depts[0] ?? "");

  const tabQueued = queued.filter((q) => q.department === tab);
  const tabSent = tab !== "" && tabQueued.length === 0 && waiting.some((q) => q.department === tab);
  const allSent = queued.length === 0;
  const unsentDepts = depts.filter((d) => queued.some((q) => q.department === d));
  const [selected, setSelected] = useState<string[]>([]);

  const sendOne = async (dept: string) => {
    const deptQueued = state.questions.filter(
      (q) => q.ticketId === ticket.id && q.status === "SME Queued" && q.department === dept,
    );
    if (deptQueued.length === 0) return;
    const req: MvpSmeRequest = {
      id: Math.max(0, ...state.smeRequests.map((r) => r.id)) + 1 + Math.floor(Math.random() * 1000),
      ticketId: ticket.id,
      department: dept,
      assignee: `${dept} Team`,
      eta: null,
      status: "Requested",
      questionIds: deptQueued.map((q) => q.id),
      sentAt: new Date().toISOString(),
    };
    if (ticket.backendId) {
      const backendReqId = await createBackendSmeRequest(
        ticket.backendId, dept, `${dept} Team`, deptQueued.length,
      );
      if (backendReqId) {
        req.backendId = backendReqId;
        const srqByBackendQ = await packageBackendQuestions(backendReqId, ticket.backendId, dept);
        if (srqByBackendQ) {
          req.srqIds = {};
          for (const q of deptQueued) {
            if (q.backendId && srqByBackendQ[q.backendId] !== undefined)
              req.srqIds[q.id] = srqByBackendQ[q.backendId];
          }
        }
        const email = await fetchSmeEmail(backendReqId);
        if (email) req.sentEmail = email;
      }
    }
    actions.setSmeRequests((p) => [...p, req]);
    actions.setQuestions((p) =>
      p.map((q) =>
        req.questionIds.includes(q.id) ? { ...q, status: "Waiting SME", smeRequestId: req.id } : q,
      ),
    );
    actions.logActivity(`Sent ${dept} SME package (${deptQueued.length} questions) — awaiting ETA`, ticket.id);
    return req;
  };

  const sendMany = async (deptList: string[]) => {
    for (const d of deptList) await sendOne(d);
    setSelected([]);
    const remaining = unsentDepts.filter((d) => !deptList.includes(d));
    if (remaining.length === 0) {
      actions.setTickets((p) =>
        p.map((t) => (t.id === ticket.id ? { ...t, stage: "eta", status: "Waiting SME" } : t)),
      );
      syncTicketStatus(ticket.backendId, "Waiting SME");
      actions.addToast("All SME packages sent — track ETAs next.", "success");
    } else {
      actions.addToast(
        `${deptList.length} SME package${deptList.length === 1 ? "" : "s"} sent. ${remaining.join(", ")} still queued.`,
        "success",
      );
    }
  };

  const sendDept = async () => {
    const req = await sendOne(tab);
    if (req) {
      // The system never sends email itself — open the draft in the mail app.
      const to = `${tab.toLowerCase()}-team@cloudera.com`;
      const subject =
        req.sentEmail?.subject ?? `ETA request — ${ticket.customer} customer form, ${tab} tab`;
      const bodyText =
        req.sentEmail?.body ??
        [
          `Hi ${tab} Team,`,
          "",
          `We need your input on the ${tab} tab of the attached Excel for ${ticket.customer}.`,
          `NDA status: ${ticket.nda}. Deadline: ${fmtDate(ticket.due)}.`,
          "",
          "Please complete your tab and reply with your ETA.",
          "",
          "Thanks,",
          "Sarah Chen, GOM Analyst",
        ].join("\n");
      openMailDraft(to, subject, bodyText);
      actions.addToast(
        "Draft opened in your mail app — attach the downloaded Excel before sending.",
        "info",
      );
    }
    const remaining = unsentDepts.filter((d) => d !== tab);
    if (remaining.length === 0) {
      actions.setTickets((p) =>
        p.map((t) => (t.id === ticket.id ? { ...t, stage: "eta", status: "Waiting SME" } : t)),
      );
      syncTicketStatus(ticket.backendId, "Waiting SME");
      actions.addToast("All SME packages sent — track ETAs next.", "success");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-[#FAFAFA] border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 flex items-start gap-2.5">
        <Info size={13} className="text-[#9CA3AF] shrink-0 mt-0.5" />
        <p className="text-xs text-[#6B7280]">
          SMEs do not log into this system. Every question routed during review is packaged here by
          department into an Excel tab plus an email. Sending opens a pre-filled draft in your mail
          app (Outlook/Gmail) — <strong>attach the downloaded Excel manually</strong>, browsers
          cannot pre-attach files. Batch send marks packages as sent without opening drafts.
        </p>
      </div>
      {unsentDepts.length > 0 && (
        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide">
            Send packages
          </p>
          {unsentDepts.map((d) => (
            <label
              key={d}
              title={`Include the ${d} package in the batch send`}
              className="flex items-center gap-1.5 text-xs text-[#374151] cursor-pointer border border-border rounded-full px-3 py-1 hover:border-[#F96702]/40"
            >
              <input
                type="checkbox"
                className="accent-[#F96702]"
                checked={selected.includes(d)}
                onChange={(e) =>
                  setSelected((p) => (e.target.checked ? [...p, d] : p.filter((x) => x !== d)))
                }
              />
              {d}
              <span className="text-[9px] font-bold text-[#C05600]">
                {queued.filter((q) => q.department === d).length}
              </span>
            </label>
          ))}
          <span className="flex-1" />
          <button
            onClick={() => sendMany(selected)}
            disabled={selected.length === 0}
            title="Marks the ticked departments as sent in one go (per-department send opens the mail draft)"
            className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase transition-all ${selected.length === 0 ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : "bg-[#F96702] text-white hover:bg-[#D95400]"}`}
          >
            <Send size={10} /> Send Selected ({selected.length})
          </button>
          <button
            onClick={() => sendMany(unsentDepts)}
            title="Marks every remaining package as sent at once (per-department send opens the mail draft)"
            className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold border border-[#F96702]/40 rounded-full text-[#C05600] hover:bg-[#FFF4EC] tracking-[0.06em] uppercase transition-all"
          >
            <Send size={10} /> Send All ({unsentDepts.length})
          </button>
        </div>
      )}
      <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {depts.map((d) => {
            const count =
              queued.filter((q) => q.department === d).length ||
              waiting.filter((q) => q.department === d).length;
            const sent = !queued.some((q) => q.department === d);
            return (
              <button
                key={d}
                onClick={() => setTab(d)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 shrink-0 transition-colors ${tab === d ? "border-[#F96702] text-[#C05600]" : "border-transparent text-[#6B7280] hover:text-[#1F2937]"}`}
              >
                {d}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tab === d ? "bg-[#FFF1E6] text-[#F96702]" : "bg-gray-100 text-gray-500"}`}>
                  {count}
                </span>
                {sent && <CheckCircle size={11} className="text-green-500" />}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 divide-x divide-border">
          {/* Excel preview */}
          <div className="flex flex-col">
            <div className="px-3.5 py-2.5 bg-[#F7F8FA] border-b border-border flex items-center gap-1.5">
              <FileSpreadsheet size={12} className="text-green-600" />
              <p className="text-[10px] font-bold text-[#1F2937]">SME Excel Package Preview</p>
              <span className="ml-auto text-[10px] text-[#9CA3AF]">
                {ticket.customer.replace(/\s+/g, "_")}_SME_Request.xlsx
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#FFF7F0] border-b border-border">
                  {["#", "Question", "SME Answer"].map((h) => (
                    <th key={h} className="text-left px-3 py-1.5 text-[10px] font-bold text-[#C05600]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(tabQueued.length > 0 ? tabQueued : waiting.filter((q) => q.department === tab)).map((q, i) => (
                  <tr key={q.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-[10px] text-[#9CA3AF] font-mono">{i + 1}</td>
                    <td className="px-3 py-2 text-[10px] text-[#1F2937]">{q.original}</td>
                    <td className="px-3 py-2 text-[10px] text-[#9CA3AF] italic">— to be completed —</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3.5 py-2.5 border-t border-border bg-[#F7F8FA] mt-auto">
              <button
                onClick={() => actions.addToast("SME Excel downloaded.", "success")}
                className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold rounded w-full justify-center bg-white border border-border text-[#374151] hover:border-[#F96702]/50 hover:text-[#F96702] transition-colors"
              >
                <Download size={11} /> Download Excel
              </button>
            </div>
          </div>
          {/* Email draft */}
          <div className="flex flex-col">
            <div className="px-3.5 py-2.5 bg-[#F7F8FA] border-b border-border flex items-center gap-1.5">
              <Mail size={12} className="text-[#F96702]" />
              <p className="text-[10px] font-bold text-[#1F2937]">SME Email Draft — {tab} Team</p>
              {tabSent && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-green-600 font-medium">
                  <CheckCircle size={10} /> Sent
                </span>
              )}
            </div>
            <div className="px-3.5 py-2.5 space-y-1 border-b border-border text-[10px]">
              {[
                ["To", `${tab.toLowerCase()}-team@cloudera.com`],
                ["Subject", `ETA request — ${ticket.customer} customer form, ${tab} tab`],
              ].map(([l, v]) => (
                <div key={l} className="flex gap-2">
                  <span className="text-[#9CA3AF] w-11 shrink-0">{l}:</span>
                  <span className="text-[#1F2937]">{v}</span>
                </div>
              ))}
            </div>
            {(() => {
              const sentReq = state.smeRequests.find(
                (r) => r.ticketId === ticket.id && r.department === tab && r.sentEmail,
              );
              if (sentReq?.sentEmail)
                return (
                  <div className="px-3.5 py-3 text-[10px] text-[#374151] leading-relaxed flex-1 whitespace-pre-wrap">
                    <p className="text-[9px] font-bold text-green-700 uppercase tracking-[0.1em] mb-1.5">
                      Sent — composed by backend
                    </p>
                    {sentReq.sentEmail.body}
                  </div>
                );
              return null;
            })() ?? (
            <div className="px-3.5 py-3 text-[10px] text-[#374151] leading-relaxed space-y-2 flex-1">
              <p>Hi {tab} Team,</p>
              <p>
                We need your input on the <strong>{tab} tab</strong> of the attached Excel for{" "}
                <strong>{ticket.customer}</strong>.
              </p>
              <div className="bg-[#F7F8FA] rounded p-2.5 border border-border space-y-0.5">
                <p><strong>Customer:</strong> {ticket.customer}</p>
                <p><strong>NDA status:</strong> {ticket.nda}{ticket.nda !== "In Place" && " — do not share NDA-restricted materials"}</p>
                <p><strong>Deadline:</strong> {fmtDate(ticket.due)}</p>
                <p><strong>Questions:</strong> {(tabQueued.length || waiting.filter((q) => q.department === tab).length)}</p>
              </div>
              <p>
                Please complete your tab and reply with your <strong>ETA</strong>.
              </p>
            </div>
            )}
            <div className="px-3.5 py-2.5 border-t border-border bg-[#F7F8FA]">
              <button
                onClick={sendDept}
                disabled={tabSent}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold rounded-full w-full justify-center tracking-[0.06em] uppercase transition-all ${tabSent ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : "bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.25)]"}`}
              >
                {tabSent ? (
                  <>
                    <CheckCircle size={10} /> Sent to {tab} Team
                  </>
                ) : (
                  <>
                    <Send size={10} /> Send {tab} SME Package
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span title="Go back to answer review — queued and sent questions are kept as they are">
          <BtnSecondary
            onClick={() =>
              actions.setTickets((p) =>
                p.map((t) => (t.id === ticket.id ? { ...t, stage: "review" } : t)),
              )
            }
          >
            <ArrowLeft size={11} /> Back: Answer Review
          </BtnSecondary>
        </span>
        <span className="flex-1" />
        {!allSent && (
          <p className="text-[10px] text-[#9CA3AF]">
            {queued.length} question(s) not sent yet — you can still jump ahead and come back.
          </p>
        )}
        <span title="Track the expected return date of each SME package — you can come back here anytime">
          <BtnPrimary
            onClick={() =>
              actions.setTickets((p) =>
                p.map((t) =>
                  t.id === ticket.id
                    ? { ...t, stage: "eta", status: allSent ? "Waiting SME" : t.status }
                    : t,
                ),
              )
            }
          >
            Next: ETA Tracking <ChevronRight size={11} />
          </BtnPrimary>
        </span>
      </div>
    </div>
  );
}

// ─── Stage: ETA Tracking ─────────────────────────────────────────────────────

function EtaPanel({
  ticket,
  qs,
  reqs,
  actions,
}: {
  ticket: MvpTicket;
  qs: MvpQuestion[];
  reqs: MvpSmeRequest[];
  actions: AppActions;
}) {
  const [etaModal, setEtaModal] = useState<MvpSmeRequest | null>(null);
  const [etaValue, setEtaValue] = useState("");
  const [confirmedBy, setConfirmedBy] = useState("");
  const [nudgeFor, setNudgeFor] = useState<MvpSmeRequest | null>(null);

  const isOver = (r: MvpSmeRequest) =>
    r.status !== "Returned" && r.eta !== null && new Date(r.eta) < MOCK_NOW;
  const allReturned = reqs.length > 0 && reqs.every((r) => r.status === "Returned");

  const saveEta = () => {
    if (!etaModal) return;
    if (!etaValue) {
      actions.addToast("Please pick an ETA date and time.", "warning");
      return;
    }
    const iso = new Date(etaValue + ":00Z").toISOString();
    actions.setSmeRequests((p) =>
      p.map((r) => (r.id === etaModal.id ? { ...r, eta: iso, status: "ETA Set" } : r)),
    );
    syncSmeRequest(etaModal.backendId, { eta: iso, status: "ETA Set", confirmedBy: confirmedBy || null });
    actions.logActivity(
      `ETA recorded for ${etaModal.department}: ${fmtDateTime(iso)}${confirmedBy ? ` — ${confirmedBy}` : ""}`,
      ticket.id,
    );
    actions.addToast(`ETA recorded for ${etaModal.department}.`, "success");
    setEtaModal(null);
  };

  const markReturned = (r: MvpSmeRequest) => {
    const returnedAt = new Date().toISOString();
    actions.setSmeRequests((p) =>
      p.map((x) => (x.id === r.id ? { ...x, status: "Returned", returnedAt } : x)),
    );
    syncSmeRequest(r.backendId, { status: "Returned", returnedAt });
    actions.setQuestions((p) =>
      p.map((q) => {
        if (!r.questionIds.includes(q.id)) return q;
        const answer = smeAnswerFor(q, r.assignee);
        syncSmeAnswer(r.srqIds?.[q.id], answer);
        syncFinalAnswer(q, answer, false, r.assignee);
        return {
          ...q,
          status: "SME Complete",
          finalAnswer: { text: answer, sourceType: "SME" },
        };
      }),
    );
    actions.logActivity(`${r.department} SME tab returned (${r.questionIds.length} answers)`, ticket.id);
    actions.addToast(`${r.department} SME answers received.`, "success");
  };

  return (
    <div className="flex flex-col gap-3">
      <Card title="SME ETA Tracking — this ticket">
        <table className="w-full">
          <thead>
            <tr>
              <Th>Department</Th>
              <Th>SME Team</Th>
              <Th>Questions</Th>
              <Th>ETA</Th>
              <Th>Status</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {reqs.map((r) => {
              const over = isOver(r);
              return (
                <tr
                  key={r.id}
                  className={`border-b border-border last:border-0 transition-colors ${over ? "bg-red-50/40" : "hover:bg-gray-50/50"}`}
                >
                  <td className="px-4 py-2.5 text-xs font-semibold text-[#1F2937]">{r.department}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6B7280]">{r.assignee}</td>
                  <td className="px-4 py-2.5 text-xs font-mono font-bold text-[#1F2937]">
                    {r.questionIds.length}
                  </td>
                  <td className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap ${!r.eta ? "text-orange-500" : over ? "text-red-600" : "text-[#1F2937]"}`}>
                    {r.eta ? fmtDateTime(r.eta) : "No ETA"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Pill value={over ? "Overdue" : r.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1.5 flex-wrap">
                      {r.status !== "Returned" && (
                        <>
                          <button
                            onClick={() => {
                              setEtaModal(r);
                              setEtaValue(r.eta ? r.eta.slice(0, 16) : "");
                              setConfirmedBy("");
                            }}
                            className="px-3 py-1 text-[9px] font-bold border border-[rgba(0,0,0,0.15)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] tracking-[0.06em] uppercase whitespace-nowrap transition-all"
                          >
                            {r.eta ? "Update ETA" : "Record ETA"}
                          </button>
                          <button
                            onClick={() => setNudgeFor(r)}
                            title={
                              over
                                ? "Overdue — drafts a follow-up email in your mail app"
                                : !r.eta
                                  ? "No ETA yet — drafts an ETA-confirmation chaser in your mail app"
                                  : "Drafts a context-aware check-in email in your mail app"
                            }
                            className={`px-3 py-1 text-[9px] font-bold rounded-full tracking-[0.06em] uppercase whitespace-nowrap transition-all ${over ? "border border-[#FCA5A5]/50 bg-[#FEF2F2] text-[#991B1B] hover:bg-[#FEE2E2]" : "border border-[#F96702]/40 text-[#C05600] hover:bg-[#FFF4EC]"}`}
                          >
                            <Bell size={9} className="inline mr-0.5" /> Nudge
                          </button>
                          <button
                            onClick={() => markReturned(r)}
                            className="px-3 py-1 text-[9px] font-bold border border-[rgba(0,0,0,0.12)] rounded-full text-[#374151] hover:bg-[#F5F5F5] tracking-[0.06em] uppercase whitespace-nowrap transition-all"
                          >
                            <RefreshCw size={9} className="inline mr-0.5" /> Mark Returned
                          </button>
                        </>
                      )}
                      {r.status === "Returned" && (
                        <span className="text-[10px] text-green-700 font-medium flex items-center gap-1.5">
                          <CheckCircle size={11} /> {r.returnedAt ? fmtDateTime(r.returnedAt) : "Returned"}
                          <button
                            onClick={() => {
                              actions.setSmeRequests((p) =>
                                p.map((x) =>
                                  x.id === r.id
                                    ? { ...x, status: r.eta ? "ETA Set" : "Requested", returnedAt: undefined }
                                    : x,
                                ),
                              );
                              actions.setQuestions((p) =>
                                p.map((qq) =>
                                  r.questionIds.includes(qq.id) && qq.finalAnswer?.sourceType === "SME"
                                    ? { ...qq, status: "Waiting SME", finalAnswer: undefined }
                                    : qq,
                                ),
                              );
                              syncSmeRequest(r.backendId, {
                                status: r.eta ? "ETA Set" : "Requested",
                                returnedAt: null,
                              });
                              actions.logActivity(`Undid returned status for ${r.department}`, ticket.id);
                              actions.addToast(`${r.department} marked as still pending.`, "info");
                            }}
                            className="text-[9px] font-bold text-[#6B7280] border border-[rgba(0,0,0,0.15)] rounded-full px-2 py-0.5 hover:border-[#F96702]/50 hover:text-[#F96702] uppercase tracking-[0.06em]"
                          >
                            Undo
                          </button>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="flex gap-2 items-center flex-wrap">
        <span title="Go back to the per-department SME packages (e.g. to send a remaining one)">
          <BtnSecondary
            onClick={() =>
              actions.setTickets((p) =>
                p.map((t) => (t.id === ticket.id ? { ...t, stage: "sme" } : t)),
              )
            }
          >
            <ArrowLeft size={11} /> Back: SME Package
          </BtnSecondary>
        </span>
        <span className="flex-1" />
        {allReturned && (
          <span title="All SME answers are back — run the completeness checks and export">
            <BtnPrimary
              onClick={() => {
                actions.setTickets((p) =>
                  p.map((t) =>
                    t.id === ticket.id ? { ...t, stage: "final", status: "Ready for Review" } : t,
                  ),
                );
                syncTicketStatus(ticket.backendId, "Ready for Review");
                actions.logActivity("All SME tabs returned — final review unlocked", ticket.id);
              }}
            >
              Next: Final Review <ChevronRight size={11} />
            </BtnPrimary>
          </span>
        )}
      </div>

      {etaModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-5 w-80">
            <h3 className="text-sm font-semibold text-[#1F2937] mb-0.5">Record ETA</h3>
            <p className="text-xs text-[#6B7280] mb-3">
              Expected return for <strong>{etaModal.department}</strong>
            </p>
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="text-[10px] font-medium text-[#6B7280] mb-1 block">
                  ETA Date &amp; Time (UTC)
                </label>
                <input
                  type="datetime-local"
                  className="w-full border border-border rounded-md px-2.5 py-1.5 text-xs"
                  value={etaValue}
                  onChange={(e) => setEtaValue(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#6B7280] mb-1 block">
                  Confirmed by (optional)
                </label>
                <input
                  className="w-full border border-border rounded-md px-2.5 py-1.5 text-xs"
                  placeholder="e.g. Confirmed via email by Alex"
                  value={confirmedBy}
                  onChange={(e) => setConfirmedBy(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <BtnSecondary onClick={() => setEtaModal(null)}>Cancel</BtnSecondary>
              <BtnPrimary onClick={saveEta}>Save ETA</BtnPrimary>
            </div>
          </div>
        </div>
      )}

      {nudgeFor && (
        <NudgeModal ticket={ticket} req={nudgeFor} actions={actions} close={() => setNudgeFor(null)} />
      )}
    </div>
  );
}

// Context-aware nudge: the template matches the SME request's actual state
// (no ETA yet / due soon / overdue / general check-in). Editable, then opens
// a draft in the analyst's mail client.
function NudgeModal({
  ticket,
  req,
  actions,
  close,
}: {
  ticket: MvpTicket;
  req: MvpSmeRequest;
  actions: AppActions;
  close: () => void;
}) {
  const over = req.eta !== null && new Date(req.eta) < MOCK_NOW;
  const dueSoon =
    !over && req.eta !== null && new Date(req.eta).getTime() - MOCK_NOW.getTime() < 24 * 3600 * 1000;
  const variant = !req.eta ? "no-eta" : over ? "overdue" : dueSoon ? "due-soon" : "check-in";

  const templates: Record<string, { label: string; subject: string; lines: string[] }> = {
    "no-eta": {
      label: "ETA confirmation chaser",
      subject: `ETA needed — ${ticket.customer} customer form, ${req.department} tab (${ticket.id})`,
      lines: [
        `Hi ${req.assignee},`,
        "",
        `We sent the ${req.department} tab of the ${ticket.customer} questionnaire on ${fmtDate(req.sentAt)} and haven't received an ETA yet.`,
        "",
        `Could you reply with a realistic return date? Our customer deadline is ${fmtDate(ticket.due)} and we plan the final review around your ETA.`,
      ],
    },
    "due-soon": {
      label: "ETA due soon — friendly heads-up",
      subject: `Heads-up: ${req.department} tab due ${req.eta ? fmtDateTime(req.eta) : ""} — ${ticket.customer} (${ticket.id})`,
      lines: [
        `Hi ${req.assignee},`,
        "",
        `A quick heads-up that the agreed ETA for the ${req.department} tab (${req.eta ? fmtDateTime(req.eta) : "—"}) is coming up.`,
        "",
        `If anything blocks the return, let us know early so we can re-plan — the customer deadline is ${fmtDate(ticket.due)}.`,
      ],
    },
    overdue: {
      label: "Overdue follow-up",
      subject: `Follow-up: ${req.department} tab overdue — ${ticket.customer} customer form (${ticket.id})`,
      lines: [
        `Hi ${req.assignee},`,
        "",
        `Following up on the ${req.department} tab for the ${ticket.customer} customer form — the agreed ETA (${req.eta ? fmtDateTime(req.eta) : "—"}) has passed. Could you confirm when this can be returned?`,
        "",
        `Our customer deadline is ${fmtDate(ticket.due)} and we need time for final review.`,
      ],
    },
    "check-in": {
      label: "Progress check-in",
      subject: `Checking in: ${req.department} tab — ${ticket.customer} customer form (${ticket.id})`,
      lines: [
        `Hi ${req.assignee},`,
        "",
        `Just checking in on the ${req.department} tab ahead of your ETA (${req.eta ? fmtDateTime(req.eta) : "—"}). No action needed if everything is on track.`,
        "",
        `If any question is out of scope or blocked, flag it now so we can reroute before the ${fmtDate(ticket.due)} customer deadline.`,
      ],
    },
  };
  const t = templates[variant];
  const to = `${req.department.toLowerCase()}-team@cloudera.com`;
  const [subject, setSubject] = useState(t.subject);
  const [body, setBody] = useState(
    [...t.lines, "", "Thanks,", "Sarah Chen, GOM Analyst"].join("\n"),
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[520px] max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-4 py-2.5 bg-[#F7F8FA] border-b border-border flex items-center justify-between shrink-0">
          <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide">
            {t.label} — auto-drafted, editable
          </p>
          {variant === "overdue" && (
            <span className="flex items-center gap-1 text-[10px] text-red-600 font-medium">
              <AlertTriangle size={10} /> {req.department} tab overdue
            </span>
          )}
        </div>
        <div className="px-4 py-2.5 space-y-2 border-b border-border text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[#9CA3AF] w-14 shrink-0">To:</span>
            <span className="text-[#1F2937]">{to}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#9CA3AF] w-14 shrink-0">Subject:</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 border border-border rounded-md px-2 py-1 text-xs"
            />
          </div>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="flex-1 px-4 py-3 text-xs text-[#374151] leading-relaxed resize-none focus:outline-none"
        />
        <div className="px-4 py-3 border-t border-border flex items-center gap-2 bg-[#FAFAFA] shrink-0">
          <span title="Opens the draft in your mail app (Outlook/Gmail) — the system never sends email itself">
            <BtnPrimary
              onClick={() => {
                openMailDraft(to, subject, body);
                actions.logActivity(`Nudged ${req.assignee} (${t.label.toLowerCase()})`, ticket.id);
                actions.addToast("Draft opened in your mail app.", "info");
                close();
              }}
            >
              <Send size={11} /> Open in Mail App
            </BtnPrimary>
          </span>
          <BtnSecondary onClick={close}>Cancel</BtnSecondary>
        </div>
      </div>
    </div>
  );
}

// ─── Stage: Final Review & Export ────────────────────────────────────────────

function FinalPanel({
  ticket,
  qs,
  reqs,
  actions,
}: {
  ticket: MvpTicket;
  qs: MvpQuestion[];
  reqs: MvpSmeRequest[];
  actions: AppActions;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const depts = DEPARTMENTS.filter((d) => qs.some((q) => q.department === d));
  const deptComplete = (d: string) =>
    qs.filter((q) => q.department === d).every((q) =>
      ["Approved", "Ready", "SME Complete"].includes(q.status),
    );
  const allComplete = depts.every(deptComplete);
  const ndaWarnings = qs.filter(
    (q) => q.sharingStatus === "NDA Required" && ticket.nda !== "In Place" && q.finalAnswer,
  );

  const handleExport = () => {
    setExportModal(false);
    setExporting(true);
    actions.addToast("Exporting response…", "info");
    setTimeout(() => {
      setExporting(false);
      setExported(true);
      if (ticket.backendId) {
        // Real Excel generated by the backend (GET /api/export/ticket/{id})
        const a = document.createElement("a");
        a.href = exportTicketUrl(ticket.backendId);
        a.download = "";
        a.click();
        actions.logActivity("Downloaded backend-generated Excel response package", ticket.id);
        actions.addToast("Excel exported from the live backend.", "success");
      } else {
        actions.logActivity("Exported completed response package (simulated)", ticket.id);
        actions.addToast("Response exported successfully.", "success");
      }
    }, ticket.backendId ? 300 : 1200);
  };

  return (
    <div className="flex flex-col gap-3">
      <Card title="Completeness Checklist">
        <div className="px-4 py-3 space-y-2">
          {depts.map((d) => {
            const ok = deptComplete(d);
            const total = qs.filter((q) => q.department === d).length;
            return (
              <div
                key={d}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md border ${ok ? "bg-green-50 border-green-100" : "bg-gray-50 border-border"}`}
              >
                {ok ? (
                  <CheckCircle size={13} className="text-green-500 shrink-0" />
                ) : (
                  <div className="w-3 h-3 rounded-full border-2 border-gray-300 shrink-0" />
                )}
                <span className={`text-xs font-medium flex-1 ${ok ? "text-green-800" : "text-[#9CA3AF]"}`}>
                  {d} — {ok ? "Complete" : "Awaiting answers"}
                </span>
                <span className="text-[10px] text-[#9CA3AF]">{total} question{total === 1 ? "" : "s"}</span>
              </div>
            );
          })}
          {reqs.length === 0 && (
            <p className="text-[10px] text-[#9CA3AF] pt-1">
              All answers were resolved from approved knowledge — no SME input was needed.
            </p>
          )}
        </div>
      </Card>
      <Card title="Outstanding Warnings">
        <div className="px-4 py-3">
          {ndaWarnings.length > 0 ? (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-[#FFF7F0] border border-[#F96702]/25">
              <Shield size={12} className="text-[#C05600] shrink-0 mt-0.5" />
              <span className="text-xs text-[#8B4500]">
                {ndaWarnings.length} answer(s) are NDA-restricted but the ticket NDA status is{" "}
                <strong>{ticket.nda}</strong> — confirm before the response is sent.
              </span>
            </div>
          ) : allComplete ? (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-green-50 border border-green-100">
              <CheckCircle size={12} className="text-green-500" />
              <span className="text-xs text-green-700 font-medium">None — all checks passed.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-yellow-50 border border-yellow-100">
              <AlertTriangle size={12} className="text-yellow-500" />
              <span className="text-xs text-yellow-700">Some departments are still incomplete.</span>
            </div>
          )}
        </div>
      </Card>
      <div className="bg-[#FAFAFA] border border-[rgba(0,0,0,0.06)] rounded-lg px-4 py-2.5 flex items-center gap-2 text-[10px] font-semibold">
        <span className="text-[#6B7280] uppercase tracking-[0.08em]">Three steps:</span>
        <span className={reviewed ? "text-green-700" : "text-[#C05600]"}>
          1 · Confirm review {reviewed && "✓"}
        </span>
        <ChevronRight size={10} className="text-[#C0BEBA]" />
        <span className={exported ? "text-green-700" : reviewed ? "text-[#C05600]" : "text-[#C0BEBA]"}>
          2 · Export package {exported && "✓"}
        </span>
        <ChevronRight size={10} className="text-[#C0BEBA]" />
        <span className={exported ? "text-[#C05600]" : "text-[#C0BEBA]"}>3 · Approve ticket</span>
        <span className="flex-1" />
        <span className="text-[#9CA3AF] font-normal normal-case">
          each step unlocks the next — hover a button for details
        </span>
      </div>
      <div className="flex gap-2.5 flex-wrap items-center">
        <span title={reqs.length > 0 ? "Go back to the SME ETA tracking for this ticket" : "Go back and review the answers again"}>
          <BtnSecondary
            onClick={() =>
              actions.setTickets((p) =>
                p.map((t) =>
                  t.id === ticket.id
                    ? { ...t, stage: reqs.length > 0 ? "eta" : "review", status: "In Progress" }
                    : t,
                ),
              )
            }
          >
            <ArrowLeft size={11} /> {reqs.length > 0 ? "Back: ETA Tracking" : "Back: Answer Review"}
          </BtnSecondary>
        </span>
        <button
          disabled={!allComplete}
          onClick={() => {
            setReviewed(true);
            actions.logActivity("Final review complete", ticket.id);
            actions.addToast("Final review complete.", "success");
          }}
          title={
            !allComplete
              ? "Blocked: some departments still have unanswered questions (see checklist above)"
              : "Step 1 — confirm you have reviewed every answer; this unlocks the export"
          }
          className={`flex items-center gap-1.5 px-5 py-2 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase transition-all ${!allComplete ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : reviewed ? "bg-green-600 text-white" : "bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.3)]"}`}
        >
          {reviewed ? (
            <>
              <CheckCircle size={11} /> Review Complete
            </>
          ) : (
            <>
              <CheckSquare size={11} /> 1 · Mark Review Complete
            </>
          )}
        </button>
        <button
          disabled={!reviewed || exporting}
          title={
            !reviewed
              ? "Blocked: complete step 1 (confirm review) first"
              : "Step 2 — downloads the completed answer package for the customer"
          }
          onClick={() => setExportModal(true)}
          className={`flex items-center gap-1.5 px-5 py-2 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase transition-all ${!reviewed || exporting ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : exported ? "bg-green-600 text-white" : "border border-[rgba(0,0,0,0.18)] text-[#374151] hover:border-[#F96702]/60 hover:text-[#F96702]"}`}
        >
          {exporting ? (
            <>
              <Loader2 size={11} className="animate-spin" /> Exporting…
            </>
          ) : exported ? (
            <>
              <CheckCircle size={11} /> Exported
            </>
          ) : (
            <>
              <Download size={11} /> 2 · Export Response
            </>
          )}
        </button>
        <button
          disabled={!exported}
          title={
            !exported
              ? "Blocked: complete step 2 (export) first"
              : "Step 3 — locks the ticket as Approved; finish with 'Mark Sent & Close' in the header"
          }
          onClick={() => {
            actions.setTickets((p) =>
              p.map((t) => (t.id === ticket.id ? { ...t, status: "Approved", stage: "done" } : t)),
            );
            syncTicketStatus(ticket.backendId, "Approved");
            actions.logActivity("Approved final response — ticket ready to send", ticket.id);
            actions.addToast("Ticket approved. Use Mark Sent & Close in the header to finish.", "success");
          }}
          className={`flex items-center gap-1.5 px-5 py-2 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase transition-all ${!exported ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : "bg-[#0A0A0A] text-white hover:bg-[#222]"}`}
        >
          <RefreshCw size={11} /> 3 · Approve Ticket
        </button>
      </div>

      {exportModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-5 w-80">
            <h3 className="text-sm font-semibold text-[#1F2937] mb-1">Confirm Export</h3>
            <p className="text-xs text-[#6B7280] mb-4">
              Export the completed response package for {ticket.customer} ({ticket.id})?
            </p>
            <div className="bg-[#F7F8FA] rounded-md p-3 border border-border mb-4 space-y-1 text-xs">
              <p><strong>Customer:</strong> {ticket.customer}</p>
              <p><strong>NDA status:</strong> {ticket.nda}</p>
              <p><strong>File:</strong> {ticket.customer.replace(/\s+/g, "_")}_Response_{ticket.id.replace("TK-", "T")}.zip</p>
              <p><strong>Sections:</strong> {depts.join(", ")}</p>
            </div>
            <div className="flex justify-end gap-2">
              <BtnSecondary onClick={() => setExportModal(false)}>Cancel</BtnSecondary>
              <BtnPrimary onClick={handleExport}>
                <Download size={11} /> Export
              </BtnPrimary>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stage: Done (read-only question record) ─────────────────────────────────

function DonePanel({ qs, actions }: { qs: MvpQuestion[]; actions: AppActions }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = qs.find((q) => q.id === openId) ?? null;
  return (
    <Card title={`Questions — ${qs.length} answered`}>
      {qs.length === 0 ? (
        <p className="px-4 py-5 text-xs text-[#9CA3AF] italic">No question records for this ticket.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Question</Th>
              <Th>Department</Th>
              <Th>Status</Th>
              <Th>Final Answer</Th>
            </tr>
          </thead>
          <tbody>
            {qs.map((q) => (
              <tr
                key={q.id}
                onClick={() => setOpenId(q.id)}
                className="border-b border-border last:border-0 cursor-pointer hover:bg-gray-50/60"
              >
                <td className="px-4 py-2.5 text-[10px] font-mono text-[#9CA3AF]">{q.row}</td>
                <td className="px-4 py-2.5 text-xs text-[#1F2937] max-w-[320px]">
                  <p className="line-clamp-1">{q.original}</p>
                </td>
                <td className="px-4 py-2.5 text-xs text-[#374151]">{q.department}</td>
                <td className="px-4 py-2.5"><Pill value={q.status} /></td>
                <td className="px-4 py-2.5 text-[11px] text-[#6B7280] max-w-[240px]">
                  <p className="line-clamp-1">{q.finalAnswer?.text ?? "—"}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setOpenId(null)} />
          <div className="w-[400px] bg-white h-full shadow-[-8px_0_32px_rgba(0,0,0,0.12)] flex flex-col">
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
              <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide flex-1">
                Question #{open.row}
              </p>
              <Pill value={open.status} />
              <button onClick={() => setOpenId(null)} className="text-gray-400 hover:text-gray-600 ml-1">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-3">
              <p className="text-sm font-bold text-[#0A0A0A]">{open.normalised}</p>
              {open.sharingStatus && <div><SharingBadge status={open.sharingStatus} /></div>}
              <div className="text-xs text-[#374151] leading-relaxed bg-[#F7F8FA] border border-border rounded-md px-3 py-2.5">
                {open.finalAnswer?.text ?? "No final answer recorded."}
              </div>
              {open.finalAnswer && (
                <p className="text-[10px] text-[#9CA3AF]">Source: {open.finalAnswer.sourceType}</p>
              )}
            </div>
            {open.finalAnswer && (
              <div className="px-5 py-3 border-t border-border bg-[#FAFAFA]">
                <BtnSecondary
                  onClick={() => {
                    navigator.clipboard.writeText(open.finalAnswer!.text);
                    actions.addToast("Answer copied.", "info");
                  }}
                >
                  <Copy size={11} /> Copy Answer
                </BtnSecondary>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
