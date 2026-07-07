import { useRef, useState } from "react";
import {
  ArrowLeft,
  Brain,
  CheckCircle,
  FileSpreadsheet,
  Send,
  Upload,
} from "lucide-react";
import { BtnSecondary } from "../components/shared";
import {
  DEPARTMENTS,
  MOCK_NOW,
  MvpQuestion,
  fmtDate,
  fmtDateTime,
} from "./data";
import { AppActions, AppState } from "./MvpApp";
import { WorkflowTab } from "./WorkflowTab";
import { Card, Pill, Th } from "./ui";

// PRD §8: Ticket Detail is the core workspace. The Workflow tab carries the
// guided flow (intake → grouping → review → SME → ETA → final).

type Tab = "Overview" | "Workflow" | "Files" | "Timeline" | "Activity";

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
  const [tab, setTab] = useState<Tab>(
    ticket && ticket.stage !== "done" ? "Workflow" : "Overview",
  );
  const qs = state.questions.filter((q) => q.ticketId === ticketId);
  if (!ticket) return null;

  const done = qs.filter((q) => ["Ready", "Approved", "SME Complete"].includes(q.status)).length;
  const progress = qs.length ? Math.round((done / qs.length) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
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
                Due {fmtDate(ticket.due)} · NDA: {ticket.nda} · Owner {ticket.owner} · {ticket.sorId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Pill value={ticket.status} />
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
          {(["Overview", "Workflow", "Files", "Timeline", "Activity"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-2 text-[11px] font-semibold border-b-2 transition-colors ${tab === t ? "border-[#F96702] text-[#C05600]" : "border-transparent text-[#6B7280] hover:text-[#1F2937]"}`}
            >
              {t}
              {t === "Workflow" && qs.length > 0 && (
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
        {tab === "Workflow" && <WorkflowTab state={state} actions={actions} ticketId={ticketId} />}
        {tab === "Files" && <FilesTab state={state} actions={actions} ticketId={ticketId} />}
        {tab === "Timeline" && <TimelineTab state={state} ticketId={ticketId} />}
        {tab === "Activity" && <ActivityTab state={state} ticketId={ticketId} />}
      </div>
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
      ready: dq.filter((q) => ["Ready", "Approved", "SME Complete"].includes(q.status)).length,
      waiting: dq.filter((q) => ["Waiting SME", "SME Queued"].includes(q.status)).length,
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
              <div
                className="h-full bg-[#F96702] rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card title="Question Completion by Department">
          {deptStats.length === 0 ? (
            <p className="px-4 py-4 text-xs text-[#9CA3AF] italic">
              No questions extracted yet — confirm intake in the Workflow tab.
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
                      {s.waiting} with SME
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
              <strong>{qs.length}</strong> questions extracted · <strong>{duplicates}</strong>{" "}
              possible duplicate{duplicates === 1 ? "" : "s"} flagged
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
              const over = r.status !== "Returned" && r.eta !== null && new Date(r.eta) < MOCK_NOW;
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
                </div>
              );
            })}
          </div>
        )}
      </Card>
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
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-border flex flex-col gap-2">
        <p className="text-[10px] text-[#9CA3AF] flex items-center gap-1">
          <Brain size={10} /> Question extraction runs automatically when intake is confirmed —
          no manual processing step.
        </p>
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
        <Upload size={11} /> Upload supporting document
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
