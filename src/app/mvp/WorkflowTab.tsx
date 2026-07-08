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
} from "./data";
import { AppActions, AppState } from "./MvpApp";
import {
  applyRagResult,
  createBackendSmeRequest,
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
import { Card, ConfidenceBadge, Pill, SharingBadge, Th } from "./ui";

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

// ─── Stage: Intake (resolve missing fields before AI runs) ───────────────────

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

  const patch = (p: Partial<MvpTicket>) =>
    actions.setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, ...p } : t)));

  const rows: { label: string; value: string; ok: boolean; edit?: React.ReactNode }[] = [
    { label: "Customer", value: ticket.customer, ok: true },
    { label: "AE / Requester", value: ticket.ae ?? "—", ok: !!ticket.ae },
    {
      label: "Deadline",
      value: fmtDate(ticket.due),
      ok: !!ticket.due,
    },
    {
      label: "NDA status",
      value: ticket.nda,
      ok: ticket.nda !== "Unknown",
      edit: (
        <select
          value={ticket.nda}
          onChange={(e) => patch({ nda: e.target.value as MvpTicket["nda"] })}
          className="border border-border rounded-md px-2 py-1 text-xs bg-white"
        >
          {["In Place", "Missing", "Unknown"].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      ),
    },
    { label: "Urgency level", value: ticket.urgency, ok: true },
    {
      label: "Business impact",
      value: ticket.businessImpact ?? "—",
      ok: !!ticket.businessImpact,
      edit: (
        <input
          value={ticket.businessImpact ?? ""}
          onChange={(e) => patch({ businessImpact: e.target.value })}
          placeholder="e.g. Renewal, high value"
          className="border border-border rounded-md px-2 py-1 text-xs w-44"
        />
      ),
    },
  ];
  const ready = ticket.nda !== "Unknown";

  const confirm = () => {
    setProcessing(true);
    patch({ status: "AI Processing" });
    actions.logActivity("Confirmed intake complete — AI analysis started", ticket.id);
    setTimeout(() => {
      const base = Math.max(0, ...state.questions.map((q) => q.id));
      const newQs = extractQuestionsFor(ticket.id, base);
      actions.setQuestions((p) => [...p, ...newQs]);
      patch({ status: "In Progress", stage: "grouping" });
      actions.logActivity(
        `AI extracted ${newQs.length} questions and classified departments (1 possible duplicate flagged)`,
        ticket.id,
      );
      actions.addToast(`${newQs.length} questions extracted — review the department grouping.`, "success");
    }, 1500);
  };

  if (processing)
    return <ProcessingCard text="Extracting questions · normalising text · classifying departments…" />;

  return (
    <Card title="Intake Check">
      <div className="px-4 py-3">
        {!ready && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3.5 py-2.5 flex items-start gap-2.5 mb-3">
            <AlertTriangle size={13} className="text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-700">
              Intake incomplete — resolve the NDA status before the form can be analysed (NT-04).
            </p>
          </div>
        )}
        <table className="w-full">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={`border-b border-border last:border-0 ${!r.ok ? "bg-orange-50/40" : ""}`}>
                <td className="px-3 py-2.5 text-xs font-medium text-[#1F2937] w-44">{r.label}</td>
                <td className="px-3 py-2.5 text-xs text-[#374151]">{r.edit ?? r.value}</td>
                <td className="px-3 py-2.5 w-28">
                  {r.ok ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle size={11} /> Found
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
                      <AlertTriangle size={11} /> Missing
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <BtnPrimary onClick={confirm} disabled={!ready}>
            <Brain size={12} /> Confirm Intake &amp; Analyse Form
          </BtnPrimary>
          <button
            onClick={() => setClarifyOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-semibold border border-[#F96702]/30 text-[#C05600] bg-[#FFF4EC] rounded-full hover:bg-[#FFE8D0] transition-colors"
          >
            <Mail size={11} /> Draft Clarification Email
          </button>
          {!ready && (
            <p className="text-[10px] text-[#9CA3AF]">
              Required intake fields must be resolved before continuing.
            </p>
          )}
        </div>
      </div>
      {clarifyOpen && (
        <ClarificationEmailModal
          fields={{
            customer: ticket.customer,
            ae: ticket.ae ?? "",
            aeEmail: ticket.aeEmail ?? "",
            urgency: ticket.urgency,
            nda: ticket.nda,
            due: ticket.due,
            businessImpact: ticket.businessImpact ?? "",
            requestType: "",
          }}
          actions={actions}
          onReply={(p) =>
            patch({
              nda: (p.nda as MvpTicket["nda"]) ?? ticket.nda,
              businessImpact: p.businessImpact || ticket.businessImpact,
            })
          }
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

// ─── Stage: Grouping (adjust AI department classification) ───────────────────

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
  const depts = DEPARTMENTS.filter((d) => qs.some((q) => q.department === d));

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
        <span className="text-[10px] text-[#9CA3AF]">
          AI classified each question — adjust below, then confirm
        </span>
      }
    >
      <div className="divide-y divide-border">
        {depts.map((d) => {
          const dq = qs.filter((q) => q.department === d);
          return (
            <div key={d}>
              <div className="px-4 py-2 bg-[#F7F8FA] flex items-center gap-2">
                <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide">{d}</p>
                <span className="text-[9px] font-bold bg-[#FFF4EC] text-[#C05600] rounded px-1.5 py-0.5">
                  {dq.length}
                </span>
              </div>
              {dq.map((q) => (
                <div key={q.id} className="px-4 py-2.5 flex items-center gap-3 border-t border-border/60">
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
                    onChange={(e) => {
                      actions.setQuestions((p) =>
                        p.map((x) => (x.id === q.id ? { ...x, department: e.target.value } : x)),
                      );
                      actions.logActivity(
                        `Moved question #${q.row} to ${e.target.value}`,
                        ticket.id,
                      );
                    }}
                    className="border border-[rgba(0,0,0,0.15)] rounded-full px-2.5 py-1 text-[10px] font-semibold bg-white shrink-0"
                  >
                    {DEPARTMENTS.map((dep) => (
                      <option key={dep}>{dep}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-border bg-[#FAFAFA]">
        <BtnPrimary onClick={confirm}>
          <CheckCircle size={12} /> Confirm Grouping &amp; Generate AI Answers
        </BtnPrimary>
      </div>
    </Card>
  );
}

// ─── Stage: Answer Review (card-by-card, route-to-SME queues only) ──────────

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
  const [selectedId, setSelectedId] = useState<number | null>(qs[0]?.id ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saveToKb, setSaveToKb] = useState(false);

  const q = qs.find((x) => x.id === selectedId) ?? qs[0];
  const resolved = qs.filter((x) =>
    ["Approved", "Ready", "SME Queued", "Waiting SME", "SME Complete", "Rejected"].includes(x.status),
  );
  const queued = qs.filter((x) => x.status === "SME Queued");
  const allResolved = qs.length > 0 && resolved.length === qs.length;

  const update = (id: number, patch: Partial<MvpQuestion>, log: string) => {
    actions.setQuestions((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    actions.logActivity(log, ticket.id);
  };

  const advance = () => {
    const next = qs.find(
      (x) =>
        x.id !== q?.id &&
        !["Approved", "Ready", "SME Queued", "Waiting SME", "SME Complete", "Rejected"].includes(x.status),
    );
    if (next) setSelectedId(next.id);
    setEditing(false);
  };

  const maybeSaveKb = (answerText: string, question: MvpQuestion) => {
    if (!saveToKb) return;
    actions.setKnowledge((p) => [
      {
        id: Math.max(...p.map((k) => k.id)) + 1,
        title: question.normalised,
        content: answerText,
        department: question.department,
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
      actions.logActivity("Answer review complete — no SME input needed", ticket.id);
    }
  };

  if (!q) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <p className="text-xs text-[#6B7280]">
          <strong className="text-[#1F2937]">{resolved.length}</strong> of{" "}
          <strong className="text-[#1F2937]">{qs.length}</strong> resolved ·{" "}
          <strong className="text-[#C05600]">{queued.length}</strong> queued for SME
        </p>
        <span className="flex-1" />
        <BtnSecondary
          onClick={() =>
            actions.setTickets((p) =>
              p.map((t) => (t.id === ticket.id ? { ...t, stage: "grouping" } : t)),
            )
          }
        >
          <ArrowLeft size={11} /> Back to Grouping
        </BtnSecondary>
        {allResolved && (
          <BtnPrimary onClick={continueNext}>
            {queued.length > 0 ? (
              <>
                Continue to SME Package ({queued.length}) <ChevronRight size={11} />
              </>
            ) : (
              <>
                Continue to Final Review <ChevronRight size={11} />
              </>
            )}
          </BtnPrimary>
        )}
      </div>
      <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] overflow-hidden flex min-h-[440px]">
        {/* Question list */}
        <div className="w-72 border-r border-[rgba(0,0,0,0.06)] overflow-y-auto shrink-0 bg-[#FAFAF9]">
          {qs.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedId(item.id);
                setEditing(false);
              }}
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
        {/* Answer card */}
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
            <div className="border border-[#F96702]/25 rounded-xl overflow-hidden">
              <div className="px-3.5 py-2 bg-[#FFF4EC] flex items-center gap-2">
                <Brain size={11} className="text-[#C05600]" />
                <p className="text-[10px] font-bold text-[#C05600] uppercase tracking-wide flex-1">
                  AI Suggested Answer — provisional
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

          <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-[rgba(0,0,0,0.06)]">
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
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase transition-all ${ndaBlocked ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-700"}`}
                  >
                    <CheckCircle size={11} /> Approve
                  </button>
                )}
                <BtnSecondary
                  onClick={() => {
                    setDraft(q.finalAnswer?.text ?? q.suggested?.text ?? "");
                    setEditing(true);
                  }}
                >
                  <Edit3 size={11} /> {q.suggested || q.finalAnswer ? "Edit" : "Manual Answer"}
                </BtnSecondary>
                {q.status === "Approved" && q.finalAnswer && (
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
                )}
                {q.status !== "SME Queued" && !q.finalAnswer && (
                  <button
                    onClick={() => {
                      update(q.id, { status: "SME Queued" }, `Routed question #${q.row} to ${q.department} SME queue`);
                      syncQuestionStatus(q.backendId, "SME Needed");
                      actions.addToast(`Added to the ${q.department} SME queue.`, "info");
                      advance();
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold bg-[#F96702] text-white rounded-full hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.25)] tracking-[0.06em] uppercase transition-all"
                  >
                    <Send size={11} /> Route to SME
                  </button>
                )}
                {q.status === "SME Queued" && (
                  <BtnSecondary
                    onClick={() => {
                      update(q.id, { status: q.suggested ? "Needs Review" : "New" }, `Removed question #${q.row} from SME queue`);
                      syncQuestionStatus(q.backendId, "Needs Review");
                      actions.addToast("Removed from SME queue.", "info");
                    }}
                  >
                    Remove from Queue
                  </BtnSecondary>
                )}
                <button
                  onClick={() => {
                    actions.logActivity(`Asked AE for context on question #${q.row}`, ticket.id);
                    actions.addToast(`Clarification request sent to ${ticket.ae ?? "the AE"}.`, "info");
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-semibold border border-[rgba(0,0,0,0.18)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] tracking-[0.04em] transition-all"
                >
                  <Mail size={11} /> Ask AE
                </button>
              </>
            )}
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

  const sendDept = async () => {
    const req: MvpSmeRequest = {
      id: Math.max(0, ...state.smeRequests.map((r) => r.id)) + 1,
      ticketId: ticket.id,
      department: tab,
      assignee: `${tab} Team`,
      eta: null,
      status: "Requested",
      questionIds: tabQueued.map((q) => q.id),
      sentAt: new Date().toISOString(),
    };
    // Live backend: create the request, link questions, use its composed email
    if (ticket.backendId) {
      const backendReqId = await createBackendSmeRequest(
        ticket.backendId, tab, `${tab} Team`, tabQueued.length,
      );
      if (backendReqId) {
        req.backendId = backendReqId;
        const srqByBackendQ = await packageBackendQuestions(backendReqId, ticket.backendId, tab);
        if (srqByBackendQ) {
          req.srqIds = {};
          for (const q of tabQueued) {
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
    actions.logActivity(
      `Sent ${tab} SME package (${tabQueued.length} questions) — awaiting ETA`,
      ticket.id,
    );
    const remaining = queued.filter((q) => q.department !== tab).length;
    if (remaining === 0) {
      actions.setTickets((p) =>
        p.map((t) => (t.id === ticket.id ? { ...t, stage: "eta", status: "Waiting SME" } : t)),
      );
      syncTicketStatus(ticket.backendId, "Waiting SME");
      actions.addToast("All SME packages sent — track ETAs next.", "success");
    } else {
      actions.addToast(`${tab} SME email sent. ${remaining} question(s) left in other departments.`, "success");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-[#FAFAFA] border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 flex items-start gap-2.5">
        <Info size={13} className="text-[#9CA3AF] shrink-0 mt-0.5" />
        <p className="text-xs text-[#6B7280]">
          SMEs do not log into this system. Every question routed during review is packaged here by
          department into an Excel tab plus an email — send each package, then record ETAs on the
          tracking step.
        </p>
      </div>
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
      <div className="flex">
        <BtnSecondary
          onClick={() =>
            actions.setTickets((p) =>
              p.map((t) => (t.id === ticket.id ? { ...t, stage: "review" } : t)),
            )
          }
        >
          <ArrowLeft size={11} /> Back to Answer Review
        </BtnSecondary>
      </div>
      {allSent && (
        <div className="flex justify-end">
          <BtnPrimary
            onClick={() =>
              actions.setTickets((p) =>
                p.map((t) => (t.id === ticket.id ? { ...t, stage: "eta", status: "Waiting SME" } : t)),
              )
            }
          >
            Continue to ETA Tracking <ChevronRight size={11} />
          </BtnPrimary>
        </div>
      )}
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
  const [reminderFor, setReminderFor] = useState<MvpSmeRequest | null>(null);

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
                          {over && (
                            <button
                              onClick={() => setReminderFor(r)}
                              className="px-3 py-1 text-[9px] font-bold border border-[#FCA5A5]/50 bg-[#FEF2F2] rounded-full text-[#991B1B] hover:bg-[#FEE2E2] tracking-[0.06em] uppercase whitespace-nowrap transition-all"
                            >
                              <Bell size={9} className="inline mr-0.5" /> Reminder
                            </button>
                          )}
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
      <div className="flex gap-2 items-center">
        <BtnSecondary onClick={() => actions.addToast("SME emails resent.", "success")}>
          <Send size={11} /> Resend SME Emails
        </BtnSecondary>
        <span className="flex-1" />
        {allReturned && (
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
            Proceed to Final Review <ChevronRight size={11} />
          </BtnPrimary>
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

      {reminderFor && (
        <ReminderModal ticket={ticket} req={reminderFor} actions={actions} close={() => setReminderFor(null)} />
      )}
    </div>
  );
}

function ReminderModal({
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
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[480px] overflow-hidden">
        <div className="px-4 py-2.5 bg-[#F7F8FA] border-b border-border flex items-center justify-between">
          <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide">
            Auto-generated overdue reminder
          </p>
          <span className="flex items-center gap-1 text-[10px] text-red-600 font-medium">
            <AlertTriangle size={10} /> {req.department} tab overdue
          </span>
        </div>
        <div className="px-4 py-2.5 space-y-1 border-b border-border text-xs">
          {[
            ["To", `${req.department.toLowerCase()}-team@cloudera.com`],
            ["Subject", `Follow-up: ${req.department} tab overdue — ${ticket.customer} customer form (${ticket.id})`],
          ].map(([l, v]) => (
            <div key={l} className="flex gap-2">
              <span className="text-[#9CA3AF] w-12 shrink-0">{l}:</span>
              <span className="text-[#1F2937]">{v}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-4 text-xs text-[#374151] leading-relaxed space-y-2.5">
          <p>Hi {req.department} team,</p>
          <p>
            Following up on the <strong>{req.department} tab</strong> for the {ticket.customer}{" "}
            customer form — the agreed ETA ({req.eta ? fmtDateTime(req.eta) : "—"}) has passed.
            Could you confirm when this can be returned?
          </p>
          <p>
            Our customer deadline is <strong>{fmtDate(ticket.due)}</strong> and we need time for
            final review.
          </p>
        </div>
        <div className="px-4 py-3 border-t border-border flex gap-2 bg-[#FAFAFA]">
          <BtnPrimary
            onClick={() => {
              actions.logActivity(`Sent overdue reminder to ${req.assignee}`, ticket.id);
              actions.addToast(`Reminder sent to ${req.assignee}.`, "success");
              close();
            }}
          >
            <Send size={11} /> Send Reminder
          </BtnPrimary>
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
      <div className="flex gap-2.5 flex-wrap items-center">
        <button
          disabled={!allComplete}
          onClick={() => {
            setReviewed(true);
            actions.logActivity("Final review complete", ticket.id);
            actions.addToast("Final review complete.", "success");
          }}
          className={`flex items-center gap-1.5 px-5 py-2 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase transition-all ${!allComplete ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : reviewed ? "bg-green-600 text-white" : "bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.3)]"}`}
        >
          {reviewed ? (
            <>
              <CheckCircle size={11} /> Review Complete
            </>
          ) : (
            <>
              <CheckSquare size={11} /> Mark Final Review Complete
            </>
          )}
        </button>
        <button
          disabled={!reviewed || exporting}
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
              <Download size={11} /> Export Response
            </>
          )}
        </button>
        <button
          disabled={!exported}
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
          <RefreshCw size={11} /> Approve Ticket
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
