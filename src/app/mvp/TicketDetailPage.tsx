import { useRef, useState } from "react";
import {
  ArrowLeft,
  Brain,
  CheckCircle,
  Copy,
  FileSpreadsheet,
  Lock,
  Search,
  Send,
  Upload,
  X,
} from "lucide-react";
import { BtnPrimary, BtnSecondary } from "../components/shared";
import {
  DEPARTMENTS,
  MOCK_NOW,
  MvpQuestion,
  MvpSmeRequest,
  confidenceBand,
  fmtDate,
  fmtDateTime,
} from "./data";
import { AppActions, AppState } from "./MvpApp";
import { Card, ConfidenceBadge, EmptyState, FilterSelect, Pill, SharingBadge, Th } from "./ui";

// PRD §8: Ticket Detail is the core workspace — tabs instead of a long
// presentation-style scroll. Questions are the central business objects.

type Tab = "Overview" | "Questions" | "Files" | "Timeline" | "Activity";

export function TicketDetailPage({
  state,
  actions,
  ticketId,
}: {
  state: AppState;
  actions: AppActions;
  ticketId: string;
}) {
  const ticket = state.tickets.find((t) => t.id === ticketId);
  const [tab, setTab] = useState<Tab>("Overview");
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [smeModal, setSmeModal] = useState(false);

  const qs = state.questions.filter((q) => q.ticketId === ticketId);
  if (!ticket) return null;

  const done = qs.filter((q) => ["Ready", "Approved"].includes(q.status)).length;
  const progress = qs.length ? Math.round((done / qs.length) * 100) : 0;
  const drawerQ = qs.find((q) => q.id === drawerId) ?? null;

  const canApprove =
    state.role === "Analyst" && qs.length > 0 && done === qs.length && ticket.status !== "Approved";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-7 pt-5 pb-0 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0">
        <button
          onClick={() => actions.go("tickets")}
          className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.06em] uppercase text-[#ABABAB] hover:text-[#F96702] transition-colors mb-2"
        >
          <ArrowLeft size={11} /> Tickets
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-[3px] h-7 bg-[#F96702] rounded-full shrink-0 mt-0.5" />
            <div>
              <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight leading-snug">
                {ticket.id} · {ticket.customer}
              </h1>
              <p className="text-sm text-[#6B7280] mt-0.5">
                Due {fmtDate(ticket.due)} · NDA: {ticket.nda} · Owner {ticket.owner} ·{" "}
                {ticket.sorId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Pill value={ticket.status} />
            {canApprove && (
              <BtnPrimary
                onClick={() => {
                  actions.setTickets((p) =>
                    p.map((t) => (t.id === ticket.id ? { ...t, status: "Approved" } : t)),
                  );
                  actions.logActivity("Approved final response", ticket.id);
                  actions.addToast("Ticket approved.", "success");
                }}
              >
                <CheckCircle size={11} /> Approve Ticket
              </BtnPrimary>
            )}
            {ticket.status === "Approved" && (
              <BtnSecondary
                onClick={() => {
                  actions.setTickets((p) =>
                    p.map((t) =>
                      t.id === ticket.id
                        ? { ...t, status: "Closed", closed: new Date().toISOString().slice(0, 10) }
                        : t,
                    ),
                  );
                  actions.logActivity("Marked response sent and closed the ticket", ticket.id);
                  actions.addToast("Ticket marked Sent and Closed.", "success");
                }}
              >
                <Send size={11} /> Mark Sent &amp; Close
              </BtnSecondary>
            )}
          </div>
        </div>
        <div className="flex gap-1 mt-3">
          {(["Overview", "Questions", "Files", "Timeline", "Activity"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-2 text-[11px] font-semibold border-b-2 transition-colors ${tab === t ? "border-[#F96702] text-[#C05600]" : "border-transparent text-[#6B7280] hover:text-[#1F2937]"}`}
            >
              {t}
              {t === "Questions" && (
                <span className="ml-1 text-[9px] font-bold text-[#9CA3AF]">{qs.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {tab === "Overview" && (
          <OverviewTab state={state} actions={actions} ticketId={ticketId} progress={progress} />
        )}
        {tab === "Questions" && (
          <QuestionsTab
            qs={qs}
            smeRequests={state.smeRequests}
            selected={selected}
            setSelected={setSelected}
            openDrawer={setDrawerId}
            requestSme={() => setSmeModal(true)}
          />
        )}
        {tab === "Files" && <FilesTab state={state} actions={actions} ticketId={ticketId} />}
        {tab === "Timeline" && <TimelineTab state={state} ticketId={ticketId} />}
        {tab === "Activity" && <ActivityTab state={state} ticketId={ticketId} />}
      </div>

      {drawerQ && (
        <QuestionDrawer
          q={drawerQ}
          ticketNda={ticket.nda}
          state={state}
          actions={actions}
          close={() => setDrawerId(null)}
          requestSme={() => {
            setSelected([drawerQ.id]);
            setDrawerId(null);
            setSmeModal(true);
          }}
        />
      )}
      {smeModal && (
        <SmeRequestModal
          state={state}
          actions={actions}
          ticketId={ticketId}
          questionIds={selected}
          close={() => {
            setSmeModal(false);
            setSelected([]);
          }}
        />
      )}
    </div>
  );
}

// ─── Overview (TD-OV-01..04) ─────────────────────────────────────────────────

function OverviewTab({
  state,
  actions,
  ticketId,
  progress,
}: {
  state: AppState;
  actions: AppActions;
  ticketId: string;
  progress: number;
}) {
  const ticket = state.tickets.find((t) => t.id === ticketId)!;
  const qs = state.questions.filter((q) => q.ticketId === ticketId);
  const smeReqs = state.smeRequests.filter((r) => r.ticketId === ticketId);

  const deptStats = DEPARTMENTS.map((d) => {
    const dq = qs.filter((q) => q.department === d);
    return {
      dept: d,
      total: dq.length,
      ready: dq.filter((q) => ["Ready", "Approved"].includes(q.status)).length,
      waiting: dq.filter((q) => q.status === "Waiting SME").length,
    };
  }).filter((s) => s.total > 0);

  const suggestions = qs.filter((q) => q.suggested).length;
  const duplicates = qs.filter((q) => q.duplicateOf).length;

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card title="Ticket Metadata">
        <div className="px-4 py-3 space-y-2 text-xs">
          {[
            ["Customer", ticket.customer],
            ["SOR ID", ticket.sorId],
            ["Owner", ticket.owner],
            ["AE / Requester", ticket.ae ?? "—"],
            ["Region", ticket.region],
            ["Source", ticket.source],
            ["Urgency", ticket.urgency],
            ["NDA Status", ticket.nda],
            ["Business Impact", ticket.businessImpact ?? "—"],
            ["Created", fmtDate(ticket.created)],
            ["Due", fmtDate(ticket.due)],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between gap-3">
              <span className="text-[#9CA3AF]">{l}</span>
              <span className="font-medium text-[#1F2937] text-right">{v}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-border">
            <div className="flex justify-between mb-1">
              <span className="text-[#9CA3AF]">Progress</span>
              <span className="font-bold text-[#C05600]">{progress}%</span>
            </div>
            <div className="h-1.5 bg-[#F5F3F0] rounded-full overflow-hidden">
              <div className="h-full bg-[#F96702] rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card title="Question Completion by Department">
          {deptStats.length === 0 ? (
            <p className="px-4 py-4 text-xs text-[#9CA3AF] italic">
              No questions extracted yet. Upload or process a form.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {deptStats.map((s) => (
                <div key={s.dept} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-xs font-semibold text-[#1F2937] flex-1">{s.dept}</span>
                  <span className="text-[10px] text-[#6B7280]">
                    {s.ready}/{s.total} ready
                  </span>
                  {s.waiting > 0 && (
                    <span className="text-[9px] font-bold text-[#854D0E] bg-[#FEFCE8] border border-[#FDE68A] rounded-full px-2 py-0.5">
                      {s.waiting} waiting SME
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="AI Processing Summary">
          <div className="px-4 py-3 space-y-1.5 text-xs text-[#374151]">
            <p>
              <strong>{qs.length}</strong> questions extracted ·{" "}
              <strong>{duplicates}</strong> possible duplicate{duplicates === 1 ? "" : "s"} flagged
            </p>
            <p>
              <strong>{suggestions}</strong> suggested answers generated (
              {qs.length ? Math.round((suggestions / qs.length) * 100) : 0}% coverage)
            </p>
            <p className="text-[10px] text-[#9CA3AF]">
              AI suggests. Humans decide — every suggestion needs review before approval.
            </p>
          </div>
        </Card>
      </div>

      <Card title="SME ETA Tracker (this ticket)">
        {smeReqs.length === 0 ? (
          <p className="px-4 py-4 text-xs text-[#9CA3AF] italic">No SME requests yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {smeReqs.map((r) => {
              const over =
                r.status !== "Returned" && r.eta !== null && new Date(r.eta) < MOCK_NOW;
              return (
                <div key={r.id} className={`px-4 py-3 ${over ? "bg-red-50/40" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#1F2937] flex-1">
                      {r.department} · {r.assignee}
                    </span>
                    <Pill value={over && r.status !== "Returned" ? "Overdue" : r.status} />
                  </div>
                  <p className="text-[10px] text-[#6B7280] mt-1">
                    {r.questionIds.length} question{r.questionIds.length === 1 ? "" : "s"} · ETA{" "}
                    {r.eta ? fmtDateTime(r.eta) : "not set"}
                  </p>
                  {r.status !== "Returned" && (
                    <button
                      onClick={() => {
                        // SME-05: manual mark as received (e.g. reply came by email)
                        actions.setSmeRequests((p) =>
                          p.map((x) =>
                            x.id === r.id
                              ? { ...x, status: "Returned", returnedAt: new Date().toISOString() }
                              : x,
                          ),
                        );
                        actions.setQuestions((p) =>
                          p.map((q) =>
                            r.questionIds.includes(q.id)
                              ? {
                                  ...q,
                                  status: "SME Complete",
                                  finalAnswer: {
                                    text:
                                      q.finalAnswer?.text ??
                                      `[SME response received from ${r.assignee} — pending analyst review]`,
                                    sourceType: "SME",
                                  },
                                }
                              : q,
                          ),
                        );
                        actions.logActivity(
                          `Marked ${r.department} SME response as received`,
                          ticketId,
                        );
                        actions.addToast("SME response marked as received.", "success");
                      }}
                      className="mt-1.5 text-[10px] font-bold text-[#C05600] hover:underline"
                    >
                      Mark response received
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Questions (TD-Q-01..08) ─────────────────────────────────────────────────

function QuestionsTab({
  qs,
  smeRequests,
  selected,
  setSelected,
  openDrawer,
  requestSme,
}: {
  qs: MvpQuestion[];
  smeRequests: MvpSmeRequest[];
  selected: number[];
  setSelected: (ids: number[]) => void;
  openDrawer: (id: number) => void;
  requestSme: () => void;
}) {
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("All");
  const [status, setStatus] = useState("All");

  const visible = qs.filter((q) => {
    if (dept !== "All" && q.department !== dept) return false;
    if (status !== "All" && q.status !== status) return false;
    if (query && !q.original.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const toggle = (id: number) =>
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (qs.length === 0)
    return (
      <EmptyState
        icon={Brain}
        title="No questions extracted yet."
        hint="Upload or process a form in the Files tab."
      />
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions…"
            className="pl-8 pr-4 py-1.5 text-[11px] border border-[rgba(0,0,0,0.15)] rounded-full bg-white placeholder-[#B0B0B0] focus:outline-none focus:ring-2 focus:ring-[#F96702]/30 w-56"
          />
        </div>
        <FilterSelect label="Department" value={dept} options={DEPARTMENTS} onChange={setDept} />
        <FilterSelect
          label="Status"
          value={status}
          options={["New", "AI Analysed", "Suggested", "Needs Review", "Waiting SME", "SME Complete", "Ready", "Approved", "Rejected"]}
          onChange={setStatus}
        />
        {selected.length > 0 && (
          <BtnPrimary onClick={requestSme} className="ml-auto">
            <Send size={11} /> Request SME for {selected.length} selected
          </BtnPrimary>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <Th> </Th>
              <Th>#</Th>
              <Th>Question</Th>
              <Th>Department</Th>
              <Th>AI Confidence</Th>
              <Th>Status</Th>
              <Th>SME</Th>
              <Th>Final Answer</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((q) => (
              <tr
                key={q.id}
                onClick={() => openDrawer(q.id)}
                className="border-b border-border last:border-0 cursor-pointer hover:bg-gray-50/60 transition-colors"
              >
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="accent-[#F96702]"
                    checked={selected.includes(q.id)}
                    onChange={() => toggle(q.id)}
                  />
                </td>
                <td className="px-4 py-2.5 text-[10px] font-mono text-[#9CA3AF]">{q.row}</td>
                <td className="px-4 py-2.5 text-xs text-[#1F2937] max-w-[320px]">
                  <p className="line-clamp-2">{q.original}</p>
                  {q.duplicateOf && (
                    <span className="text-[9px] font-bold text-[#4338CA] bg-[#EEF2FF] border border-[#C7D2FE] rounded-full px-2 py-0.5 mt-1 inline-block">
                      Possible duplicate of #{qs.find((x) => x.id === q.duplicateOf)?.row}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-[#374151] whitespace-nowrap">{q.department}</td>
                <td className="px-4 py-2.5"><ConfidenceBadge confidence={q.confidence} /></td>
                <td className="px-4 py-2.5"><Pill value={q.status} /></td>
                <td className="px-4 py-2.5 text-[10px] text-[#6B7280] whitespace-nowrap">
                  {(() => {
                    const r = smeRequests.find((x) => x.id === q.smeRequestId);
                    return r ? (
                      <span title={r.eta ? `ETA ${fmtDateTime(r.eta)}` : undefined}>
                        {r.assignee}
                      </span>
                    ) : (
                      "—"
                    );
                  })()}
                </td>
                <td className="px-4 py-2.5 text-[11px] text-[#6B7280] max-w-[200px]">
                  {q.finalAnswer ? (
                    <p className="line-clamp-1">{q.finalAnswer.text}</p>
                  ) : (
                    <span className="italic text-[#C0BEBA]">Pending</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="px-4 py-6 text-xs text-[#9CA3AF] italic text-center">
            No questions match this filter.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Question Detail Drawer (§8.3, QD-01..05) ────────────────────────────────

function QuestionDrawer({
  q,
  ticketNda,
  state,
  actions,
  close,
  requestSme,
}: {
  q: MvpQuestion;
  ticketNda: string;
  state: AppState;
  actions: AppActions;
  close: () => void;
  requestSme: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [saveToKb, setSaveToKb] = useState(false);

  const source = q.suggested
    ? state.knowledge.find((k) => k.id === q.suggested!.knowledgeId)
    : undefined;
  // QD-04 / AI-08: block accept when the answer needs NDA and ticket lacks one
  const ndaBlocked = q.sharingStatus === "NDA Required" && ticketNda !== "In Place";

  const update = (patch: Partial<MvpQuestion>, log: string) => {
    actions.setQuestions((p) => p.map((x) => (x.id === q.id ? { ...x, ...patch } : x)));
    actions.logActivity(log, q.ticketId);
  };

  const maybeSaveKnowledge = (answerText: string) => {
    if (!saveToKb) return;
    actions.setKnowledge((p) => [
      {
        id: Math.max(...p.map((k) => k.id)) + 1,
        title: q.normalised,
        content: answerText,
        department: q.department,
        source: `Ticket ${q.ticketId}`,
        lastUpdated: new Date().toISOString().slice(0, 10),
        sharingStatus: q.sharingStatus ?? "Internal",
        status: "Pending Review",
        tags: [q.department],
        owner: state.currentUser,
      },
      ...p,
    ]);
    actions.addToast("Saved to Knowledge Base as Pending Review.", "info");
  };

  const accept = () => {
    if (!q.suggested || ndaBlocked) return;
    update(
      {
        status: "Ready",
        finalAnswer: { text: q.suggested.text, sourceType: "AI" },
      },
      `Accepted AI suggestion for question #${q.row}`,
    );
    maybeSaveKnowledge(q.suggested.text);
    actions.addToast("Suggestion accepted.", "success");
    close();
  };

  const saveEdit = () => {
    if (!draft.trim()) {
      actions.addToast("Answer text cannot be empty.", "warning");
      return;
    }
    update(
      {
        status: "Ready",
        finalAnswer: {
          text: draft.trim(),
          sourceType: q.suggested ? "AI Edited" : "Manual",
        },
      },
      `${q.suggested ? "Edited AI answer" : "Entered manual answer"} for question #${q.row}`,
    );
    maybeSaveKnowledge(draft.trim());
    actions.addToast("Answer saved.", "success");
    close();
  };

  const reject = () => {
    update(
      { status: "Rejected", rejectedReason: rejectReason.trim() || undefined },
      `Rejected AI suggestion for question #${q.row}${rejectReason ? ` — ${rejectReason}` : ""}`,
    );
    actions.addToast("Suggestion rejected.", "info");
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={close} />
      <div className="w-[420px] bg-white h-full shadow-[-8px_0_32px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2 shrink-0">
          <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide flex-1">
            Question #{q.row} · {q.ticketId}
          </p>
          <Pill value={q.status} />
          <button onClick={close} className="text-gray-400 hover:text-gray-600 ml-1">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-4">
          {/* QD-01 original vs normalised */}
          <div>
            <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em] mb-1">
              Customer wording
            </p>
            <p className="text-xs text-[#1F2937] bg-[#F7F8FA] border border-border rounded-md px-3 py-2">
              “{q.original}”
            </p>
            <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em] mb-1 mt-2.5">
              AI-normalised
            </p>
            <p className="text-xs text-[#374151]">{q.normalised}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* TD-Q-03 editable department */}
            <select
              value={q.department}
              onChange={(e) =>
                update(
                  { department: e.target.value },
                  `Changed question #${q.row} department to ${e.target.value}`,
                )
              }
              className="border border-[rgba(0,0,0,0.15)] rounded-full px-3 py-1 text-[10px] font-semibold bg-white"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <span className="text-[10px] text-[#6B7280]">Risk: {q.risk}</span>
            {q.sharingStatus && <SharingBadge status={q.sharingStatus} />}
          </div>

          {ndaBlocked && (
            <div className="bg-[#FEF2F2] border border-[#FCA5A5]/50 rounded-md px-3 py-2.5 flex items-start gap-2">
              <Lock size={12} className="text-[#991B1B] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#991B1B]">
                This answer requires an NDA, but the ticket NDA status is{" "}
                <strong>{ticketNda}</strong>. Accepting is blocked until the NDA is in place
                (AI-08).
              </p>
            </div>
          )}

          {/* AI suggestion (QD-02/03, AI-06, NFR-05) */}
          {q.suggested && !editing && (
            <div className="border border-[#F96702]/25 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-[#FFF4EC] flex items-center gap-2">
                <Brain size={11} className="text-[#C05600]" />
                <p className="text-[10px] font-bold text-[#C05600] uppercase tracking-wide flex-1">
                  AI Suggested Answer — provisional
                </p>
                <ConfidenceBadge confidence={q.confidence} />
              </div>
              <div className="px-3 py-2.5 text-xs text-[#374151] leading-relaxed">
                {q.suggested.text}
              </div>
              <div className="px-3 py-2 bg-[#FAFAFA] border-t border-border space-y-1 text-[10px] text-[#6B7280]">
                <p>
                  <strong>Source:</strong>{" "}
                  {source ? (
                    <button
                      onClick={() => actions.openKnowledge("all", source.id)}
                      className="text-[#C05600] font-semibold hover:underline"
                    >
                      {source.title}
                    </button>
                  ) : (
                    `Knowledge entry #${q.suggested.knowledgeId}`
                  )}
                </p>
                <p>
                  <strong>Source last updated:</strong>{" "}
                  {source ? `${source.lastUpdated} (UTC)` : "—"}
                </p>
                <p>
                  <strong>Why suggested:</strong> {q.suggested.reasoning}
                </p>
              </div>
            </div>
          )}

          {q.finalAnswer && !editing && (
            <div className="border border-green-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-green-50 flex items-center gap-2">
                <CheckCircle size={11} className="text-green-600" />
                <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide flex-1">
                  Final Answer · {q.finalAnswer.sourceType}
                </p>
              </div>
              <div className="px-3 py-2.5 text-xs text-[#374151] leading-relaxed">
                {q.finalAnswer.text}
              </div>
            </div>
          )}

          {q.status === "Rejected" && q.rejectedReason && (
            <p className="text-[11px] text-[#991B1B]">
              <strong>Rejection reason:</strong> {q.rejectedReason}
            </p>
          )}

          {!q.suggested && !q.finalAnswer && !editing && (
            <div className="bg-[#F7F8FA] border border-border rounded-md px-3 py-2.5 text-[11px] text-[#6B7280]">
              No approved knowledge match — <strong>Research Required</strong>. Enter a manual
              answer or request SME input.
            </div>
          )}

          {editing && (
            <div>
              <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em] mb-1">
                {q.suggested ? "Edit answer" : "Manual answer"}
              </p>
              <textarea
                rows={6}
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-xs resize-y focus:outline-none focus:border-[#F96702]/50"
              />
            </div>
          )}

          {rejecting && (
            <div>
              <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em] mb-1">
                Rejection reason (optional)
              </p>
              <input
                autoFocus
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-xs"
                placeholder="e.g. answer is out of date"
              />
            </div>
          )}

          {(editing || (q.status !== "Approved" && !q.finalAnswer)) && (
            <label className="flex items-center gap-2 text-[11px] text-[#374151] cursor-pointer">
              <input
                type="checkbox"
                className="accent-[#F96702]"
                checked={saveToKb}
                onChange={(e) => setSaveToKb(e.target.checked)}
              />
              Save answer to Knowledge Base after approval (goes to Pending Review)
            </label>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-t border-border flex gap-2 flex-wrap shrink-0 bg-[#FAFAFA]">
          {editing ? (
            <>
              <BtnPrimary onClick={saveEdit}>Save Answer</BtnPrimary>
              <BtnSecondary onClick={() => setEditing(false)}>Cancel</BtnSecondary>
            </>
          ) : rejecting ? (
            <>
              <BtnPrimary onClick={reject}>Confirm Reject</BtnPrimary>
              <BtnSecondary onClick={() => setRejecting(false)}>Cancel</BtnSecondary>
            </>
          ) : (
            <>
              {q.suggested && !q.finalAnswer && (
                <BtnPrimary onClick={accept} disabled={ndaBlocked}>
                  <CheckCircle size={11} /> Accept
                </BtnPrimary>
              )}
              <BtnSecondary
                onClick={() => {
                  setDraft(q.finalAnswer?.text ?? q.suggested?.text ?? "");
                  setEditing(true);
                }}
              >
                {q.suggested || q.finalAnswer ? "Edit" : "Manual Answer"}
              </BtnSecondary>
              {q.suggested && q.status !== "Rejected" && !q.finalAnswer && (
                <BtnSecondary onClick={() => setRejecting(true)}>Reject</BtnSecondary>
              )}
              {q.status !== "Waiting SME" && (
                <BtnSecondary onClick={requestSme}>Request SME</BtnSecondary>
              )}
              {q.finalAnswer && (
                <BtnSecondary
                  onClick={() => {
                    navigator.clipboard.writeText(q.finalAnswer!.text);
                    actions.addToast("Answer copied.", "info");
                  }}
                >
                  <Copy size={11} /> Copy
                </BtnSecondary>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SME Request modal (SME-01/02, TD-Q-07/08) ───────────────────────────────

function SmeRequestModal({
  state,
  actions,
  ticketId,
  questionIds,
  close,
}: {
  state: AppState;
  actions: AppActions;
  ticketId: string;
  questionIds: number[];
  close: () => void;
}) {
  const chosen = state.questions.filter((q) => questionIds.includes(q.id));
  const defaultDept = chosen[0]?.department ?? "General";
  const [dept, setDept] = useState(defaultDept);
  const [assignee, setAssignee] = useState(`${defaultDept} Team`);
  const [eta, setEta] = useState("");

  const submit = () => {
    if (questionIds.length === 0) {
      actions.addToast("Select at least one question.", "warning");
      return;
    }
    if (!eta) {
      actions.addToast("Please set an expected ETA.", "warning");
      return;
    }
    const iso = new Date(eta + ":00Z").toISOString();
    const req: MvpSmeRequest = {
      id: Math.max(0, ...state.smeRequests.map((r) => r.id)) + 1,
      ticketId,
      department: dept,
      assignee: assignee.trim() || `${dept} Team`,
      eta: iso,
      status: "ETA Set",
      questionIds,
      sentAt: new Date().toISOString(),
    };
    actions.setSmeRequests((p) => [...p, req]);
    actions.setQuestions((p) =>
      p.map((q) =>
        questionIds.includes(q.id) ? { ...q, status: "Waiting SME", smeRequestId: req.id } : q,
      ),
    );
    actions.setTickets((p) =>
      p.map((t) => (t.id === ticketId ? { ...t, status: "Waiting SME" } : t)),
    );
    actions.logActivity(
      `Requested ${dept} SME input for ${questionIds.length} question(s), ETA ${fmtDateTime(iso)}`,
      ticketId,
    );
    actions.addToast("SME request created.", "success");
    close();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-5 w-96">
        <h3 className="text-sm font-semibold text-[#1F2937] mb-0.5">Request SME Input</h3>
        <p className="text-xs text-[#6B7280] mb-3">
          Groups {questionIds.length} question{questionIds.length === 1 ? "" : "s"} into one SME
          request (SME-01).
        </p>
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="text-[10px] font-medium text-[#6B7280] mb-1 block">Department</label>
            <select
              className="w-full border border-border rounded-md px-2.5 py-1.5 text-xs bg-white"
              value={dept}
              onChange={(e) => {
                setDept(e.target.value);
                setAssignee(`${e.target.value} Team`);
              }}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-[#6B7280] mb-1 block">
              Assigned team or alias
            </label>
            <input
              className="w-full border border-border rounded-md px-2.5 py-1.5 text-xs"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-[#6B7280] mb-1 block">
              Expected ETA (UTC)
            </label>
            <input
              type="datetime-local"
              className="w-full border border-border rounded-md px-2.5 py-1.5 text-xs"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <BtnSecondary onClick={close}>Cancel</BtnSecondary>
          <BtnPrimary onClick={submit}>
            <Send size={11} /> Send Request
          </BtnPrimary>
        </div>
      </div>
    </div>
  );
}

// ─── Files (TD-F-01..04) ─────────────────────────────────────────────────────

function FilesTab({
  state,
  actions,
  ticketId,
}: {
  state: AppState;
  actions: AppActions;
  ticketId: string;
}) {
  const ticket = state.tickets.find((t) => t.id === ticketId)!;
  const qs = state.questions.filter((q) => q.ticketId === ticketId);

  const processFile = (name: string) => {
    // TD-F-03: simulate AI processing with seeded extraction
    actions.setTickets((p) =>
      p.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: t.status === "Intake Review" ? t.status : "In Progress",
              files: t.files.map((f) => (f.name === name ? { ...f, status: "Processed" } : f)),
            }
          : t,
      ),
    );
    if (qs.length === 0) {
      const base = Math.max(0, ...state.questions.map((q) => q.id));
      const seeded: MvpQuestion[] = [
        {
          id: base + 1, ticketId, row: 1,
          original: "Do you hold ISO27001?",
          normalised: "Does Cloudera hold ISO 27001 certification?",
          department: "Security", risk: "Medium", status: "Suggested", confidence: 0.96,
          suggested: {
            text: "Yes. Cloudera maintains an ISMS aligned with ISO 27001, certified annually.",
            knowledgeId: 88,
            reasoning: "Matched approved Security entry (96% similarity).",
          },
          sharingStatus: "Public",
        },
        {
          id: base + 2, ticketId, row: 2,
          original: "Is a data processing agreement available?",
          normalised: "Is a standard data processing agreement (DPA) available?",
          department: "Legal", risk: "Medium", status: "Suggested", confidence: 0.91,
          suggested: {
            text: "Yes. A standard DPA incorporating the EU SCCs is available.",
            knowledgeId: 92,
            reasoning: "Matched approved Legal DPA entry (91% similarity).",
          },
          sharingStatus: "Public",
        },
        {
          id: base + 3, ticketId, row: 3,
          original: "What is your employee turnover rate?",
          normalised: "What is the annual employee turnover rate?",
          department: "HR", risk: "Low", status: "New", confidence: 0.42,
          sharingStatus: "NDA Required",
        },
      ];
      actions.setQuestions((p) => [...p, ...seeded]);
      actions.logActivity(
        `AI extracted ${seeded.length} questions from ${name} (confidence 0.42–0.96)`,
        ticketId,
      );
      actions.addToast(`AI processing complete — ${seeded.length} questions extracted.`, "success");
    } else {
      actions.addToast("File processed.", "success");
    }
  };

  return (
    <Card title="Files">
      <div className="divide-y divide-border">
        {ticket.files.length === 0 && (
          <p className="px-4 py-5 text-xs text-[#9CA3AF] italic">No files uploaded yet.</p>
        )}
        {ticket.files.map((f) => (
          <div key={f.name} className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={14} className="text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#1F2937] truncate">{f.name}</p>
              <p className="text-[10px] text-[#9CA3AF]">
                {f.kind} · {f.size} · uploaded {fmtDate(f.uploaded)}
              </p>
            </div>
            <Pill value={f.status} />
            {f.status === "Uploaded" && !f.supporting && (
              <BtnPrimary onClick={() => processFile(f.name)}>
                <Brain size={11} /> Process with AI
              </BtnPrimary>
            )}
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-border">
        <UploadSupporting actions={actions} ticketId={ticketId} />
      </div>
    </Card>
  );
}

function UploadSupporting({ actions, ticketId }: { actions: AppActions; ticketId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        type="file"
        className="hidden"
        ref={inputRef}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            actions.setTickets((p) =>
              p.map((t) =>
                t.id === ticketId
                  ? {
                      ...t,
                      files: [
                        ...t.files,
                        {
                          name: f.name,
                          size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
                          kind: "Supporting document",
                          uploaded: new Date().toISOString().slice(0, 10),
                          status: "Uploaded",
                          supporting: true,
                        },
                      ],
                    }
                  : t,
              ),
            );
            actions.logActivity(`Uploaded supporting document ${f.name}`, ticketId);
            actions.addToast(`Attached ${f.name}.`, "info");
          }
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-1.5 py-2 w-full border border-dashed border-border rounded-md text-[10px] text-[#6B7280] hover:border-[#F96702]/40 hover:text-[#F96702]"
      >
        <Upload size={11} /> Upload supporting document (TD-F-04)
      </button>
    </>
  );
}

// ─── Timeline & Activity (§8.5) ──────────────────────────────────────────────

const MILESTONE_ORDER = [
  "New",
  "AI Processing",
  "Intake Review",
  "In Progress",
  "Waiting SME",
  "Ready for Review",
  "Approved",
  "Sent",
  "Closed",
];

function TimelineTab({ state, ticketId }: { state: AppState; ticketId: string }) {
  const ticket = state.tickets.find((t) => t.id === ticketId)!;
  const idx = MILESTONE_ORDER.indexOf(ticket.status === "Archived" ? "Closed" : ticket.status);
  return (
    <Card title="Ticket Milestones">
      <div className="px-5 py-4">
        {MILESTONE_ORDER.map((m, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <div key={m} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center ${done ? "bg-[#F96702]" : active ? "bg-[#F96702] ring-2 ring-[#F96702]/25" : "border-2 border-[#D8D5D0]"}`}
                >
                  {done && <CheckCircle size={9} className="text-white" />}
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                {i < MILESTONE_ORDER.length - 1 && (
                  <div className={`w-px h-6 ${done ? "bg-[#F96702]/40" : "bg-[#E8E6E3]"}`} />
                )}
              </div>
              <p
                className={`text-xs pb-4 ${active ? "font-bold text-[#C05600]" : done ? "font-medium text-[#374151]" : "text-[#C0BEBA]"}`}
              >
                {m}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ActivityTab({ state, ticketId }: { state: AppState; ticketId: string }) {
  const events = state.activity.filter((a) => a.ticketId === ticketId);
  return (
    <Card title="Activity Log">
      {events.length === 0 ? (
        <p className="px-4 py-5 text-xs text-[#9CA3AF] italic">No activity recorded yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {events.map((a) => (
            <div key={a.id} className="px-4 py-2.5 flex items-start gap-2.5">
              <div
                className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${a.actor === "AI" ? "bg-[#4338CA]" : "bg-[#F96702]/60"}`}
              />
              <div>
                <p className="text-xs text-[#374151]">
                  <span className="font-semibold">{a.actor}</span> {a.action}
                </p>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">{fmtDateTime(a.at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
