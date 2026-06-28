import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Inbox,
  ClipboardCheck,
  Mail,
  Brain,
  MessageSquare,
  FileSpreadsheet,
  Clock,
  Bell,
  CheckSquare,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Filter,
  Search,
  User,
  ArrowLeft,
  Send,
  Edit3,
  ExternalLink,
  Download,
  RefreshCw,
  Plus,
  Shield,
  X,
  Activity,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { searchKnowledgeBase, SearchResult } from "../api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | "dashboard"
  | "intake-upload"
  | "intake-check"
  | "clarification-email"
  | "question-extraction"
  | "answer-review"
  | "sme-package"
  | "eta-tracking"
  | "reminder-email"
  | "final-review";

type ToastMsg = {
  id: number;
  message: string;
  type: "success" | "info" | "warning";
};

// ─── Shared primitives ────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    New: "bg-[#F5F5F5] text-[#374151] border-[rgba(0,0,0,0.1)]",
    "Intake Missing": "bg-[#FFF4EC] text-[#C05600] border-[#F96702]/25",
    "In Review": "bg-[#1A1A1A] text-white border-transparent",
    "Waiting SME": "bg-[#F5F5F5] text-[#374151] border-[rgba(0,0,0,0.1)]",
    Completed: "bg-[#F96702] text-white border-transparent",
    Overdue: "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]/50",
    "ETA Confirmed": "bg-[#FFF4EC] text-[#C05600] border-[#F96702]/25",
    "Waiting for ETA": "bg-[#F5F5F5] text-[#374151] border-[rgba(0,0,0,0.1)]",
    "In Progress": "bg-[#1A1A1A] text-white border-transparent",
    Returned: "bg-[#FFF4EC] text-[#C05600] border-[#F96702]/25",
    "Intake Complete": "bg-[#F96702] text-white border-transparent",
    "Needs Review": "bg-[#F5F5F5] text-[#374151] border-[rgba(0,0,0,0.1)]",
    "Source Found": "bg-[#FFF4EC] text-[#C05600] border-[#F96702]/25",
    "SME Needed": "bg-[#FFF4EC] text-[#C05600] border-[#F96702]/25",
    Approved: "bg-[#F96702] text-white border-transparent",
    "SME Request": "bg-[#1A1A1A] text-white border-transparent",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-[0.08em] uppercase border ${map[status] ?? "bg-[#F5F5F5] text-[#6B7280] border-[rgba(0,0,0,0.1)]"}`}
    >
      {status}
    </span>
  );
}

function UrgencyPill({ urgency }: { urgency: string }) {
  const m: Record<string, string> = {
    High: "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]/50",
    Medium: "bg-[#F5F5F5] text-[#374151] border-[rgba(0,0,0,0.1)]",
    Low: "bg-[#FAFAFA] text-[#9CA3AF] border-[rgba(0,0,0,0.06)]",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-[0.08em] uppercase border ${m[urgency] ?? "bg-[#F5F5F5] text-[#6B7280] border-[rgba(0,0,0,0.1)]"}`}
    >
      {urgency}
    </span>
  );
}

function BtnPrimary({
  onClick,
  disabled,
  children,
  className = "",
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-5 py-2 text-[10px] font-bold tracking-[0.07em] rounded-full transition-all ${disabled ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : "bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.3)] hover:shadow-[0_4px_16px_rgba(249,103,2,0.45)]"} ${className}`}
    >
      {children}
    </button>
  );
}

function BtnSecondary({
  onClick,
  children,
  className = "",
}: {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2 text-[10px] font-semibold tracking-[0.04em] border border-[rgba(0,0,0,0.18)] rounded-full text-[#374151] hover:border-[#F96702]/60 hover:text-[#F96702] transition-all ${className}`}
    >
      {children}
    </button>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({
  toasts,
  remove,
}: {
  toasts: ToastMsg[];
  remove: (id: number) => void;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border text-[11px] font-medium min-w-[280px] max-w-xs bg-white ${t.type === "success" ? "border-green-200" : t.type === "warning" ? "border-[#F96702]/30" : "border-[rgba(0,0,0,0.08)]"}`}
        >
          {t.type === "success" && (
            <CheckCircle size={13} className="text-green-500 shrink-0" />
          )}
          {t.type === "warning" && (
            <AlertTriangle size={13} className="text-[#F96702] shrink-0" />
          )}
          {t.type === "info" && (
            <Info size={13} className="text-[#6B7280] shrink-0" />
          )}
          <span className="flex-1 text-[#1F2937]">{t.message}</span>
          <button
            onClick={() => remove(t.id)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

const STEPS: { id: Screen; label: string }[] = [
  { id: "intake-upload", label: "Upload" },
  { id: "intake-check", label: "Intake Check" },
  { id: "clarification-email", label: "Clarify" },
  { id: "question-extraction", label: "Questions" },
  { id: "answer-review", label: "Answer Review" },
  { id: "sme-package", label: "SME Package" },
  { id: "eta-tracking", label: "ETA Tracking" },
  { id: "final-review", label: "Final Review" },
];

function WorkflowStepper({ current }: { current: Screen }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  // reminder-email shares the eta-tracking step position
  const effectiveIdx =
    current === "reminder-email"
      ? STEPS.findIndex((s) => s.id === "eta-tracking")
      : idx;
  if (effectiveIdx < 0) return null;
  return (
    <div className="flex items-center px-7 py-2.5 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0 overflow-x-auto gap-0">
      {STEPS.map((step, i) => {
        const done = i < effectiveIdx,
          active = i === effectiveIdx;
        return (
          <div key={step.id} className="flex items-center shrink-0">
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
              {step.label}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-4 h-px mx-1 shrink-0 ${i < effectiveIdx ? "bg-[#F96702]/40" : "bg-[#D8D5D0]"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV: {
  id: Screen;
  label: string;
  icon: React.ElementType;
  section: string | null;
}[] = [
  {
    id: "dashboard",
    label: "Ticket Queue",
    icon: LayoutDashboard,
    section: null,
  },
  {
    id: "intake-upload",
    label: "New Request",
    icon: Inbox,
    section: "Workflow",
  },
  {
    id: "intake-check",
    label: "Intake Check",
    icon: ClipboardCheck,
    section: "Workflow",
  },
  {
    id: "clarification-email",
    label: "Clarify Email",
    icon: Mail,
    section: "Workflow",
  },
  {
    id: "question-extraction",
    label: "Questions",
    icon: Brain,
    section: "Workflow",
  },
  {
    id: "answer-review",
    label: "Answer Review",
    icon: MessageSquare,
    section: "Workflow",
  },
  {
    id: "sme-package",
    label: "SME Package",
    icon: FileSpreadsheet,
    section: "Workflow",
  },
  {
    id: "eta-tracking",
    label: "ETA Tracking",
    icon: Clock,
    section: "Workflow",
  },
  {
    id: "reminder-email",
    label: "Reminder Email",
    icon: Bell,
    section: "Workflow",
  },
  {
    id: "final-review",
    label: "Final Review",
    icon: CheckSquare,
    section: "Workflow",
  },
];

function Sidebar({
  screen,
  setScreen,
  currentUser,
  onLogout,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
  currentUser: string;
  onLogout: () => void;
}) {
  let lastSection: string | null = "__";
  return (
    <aside className="w-56 bg-white flex flex-col shrink-0 h-full overflow-y-auto border-r border-[rgba(0,0,0,0.06)]">
      <div className="h-[3px] bg-[#F96702] w-full shrink-0" />
      <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.06)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#F96702] flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(249,103,2,0.35)]">
            <span className="text-white text-[11px] font-black">C</span>
          </div>
          <div>
            <p className="text-[#0A0A0A] text-xs font-bold leading-tight tracking-[-0.01em]">
              Cloudera GOM
            </p>
            <p className="text-[#9CA3AF] text-[10px] tracking-[0.04em] uppercase font-medium">
              Workflow Hub
            </p>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-3 px-3 flex flex-col gap-0.5">
        {NAV.map(({ id, label, icon: Icon, section }) => {
          const showSection = section !== lastSection;
          lastSection = section;
          return (
            <div key={id}>
              {showSection && section && (
                <p className="text-[#C8C8C8] text-[8.5px] font-black uppercase tracking-[0.14em] px-3 pt-4 pb-1.5">
                  {section}
                </p>
              )}
              <button
                onClick={() => setScreen(id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] w-full text-left transition-all ${screen === id ? "bg-[#F96702] text-white font-bold shadow-[0_2px_8px_rgba(249,103,2,0.3)]" : "text-[#6B7280] hover:text-[#111111] hover:bg-[#F5F3F0]"}`}
              >
                <Icon size={13} className={screen === id ? "opacity-90" : ""} />
                {label}
              </button>
            </div>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-[rgba(0,0,0,0.06)] shrink-0">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-full bg-[#F5F3F0] flex items-center justify-center shrink-0 ring-2 ring-[#F96702]/20">
            <User size={13} className="text-[#F96702]" />
          </div>
          <div className="min-w-0">
            <p className="text-[#0A0A0A] text-[11px] font-semibold truncate">
              {currentUser}
            </p>
            <p className="text-[#9CA3AF] text-[10px]">GOM Analyst</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-semibold border border-[rgba(0,0,0,0.12)] rounded-lg text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] transition-all"
        >
          <ArrowLeft size={11} /> Sign Out
        </button>
      </div>
    </aside>
  );
}

// ─── Activity Log (collapsible card) ─────────────────────────────────────────

function ActivityLog({ entries }: { entries: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-4 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <Activity size={12} className="text-[#F96702]" />
        <span className="text-xs font-semibold text-[#1F2937] flex-1 text-left">
          Activity Log
        </span>
        <span className="text-[10px] text-[#9CA3AF] mr-1">
          {entries.length} entries
        </span>
        <ChevronDown
          size={12}
          className={`text-[#9CA3AF] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-border">
          {entries.length === 0 ? (
            <p className="text-xs text-[#9CA3AF] italic pt-2">
              No activity yet.
            </p>
          ) : (
            <div className="space-y-1.5 pt-2">
              {entries.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F96702]/40 shrink-0 mt-1" />
                  <span className="text-[#374151]">{e}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────

function PageHeader({
  back,
  backLabel,
  title,
  subtitle,
  badge,
  setScreen,
}: {
  back: Screen;
  backLabel: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  setScreen: (s: Screen) => void;
}) {
  return (
    <div className="px-7 pt-6 pb-4 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setScreen(back)}
          className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.06em] uppercase text-[#ABABAB] hover:text-[#F96702] transition-colors"
        >
          <ArrowLeft size={11} />
          {backLabel}
        </button>
        <span className="text-[#D5D5D5] text-xs font-light">/</span>
        <span className="text-[10px] font-semibold tracking-[0.06em] uppercase text-[#0A0A0A]">
          {title}
        </span>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-[3px] h-7 bg-[#F96702] rounded-full shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight leading-snug">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-[#6B7280] mt-0.5 font-normal">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {badge && <div className="shrink-0 mt-1">{badge}</div>}
      </div>
    </div>
  );
}

// ─── Screen: Dashboard ────────────────────────────────────────────────────────

const TICKETS = [
  {
    id: "T-1024",
    customer: "Acme Corp",
    ae: "—",
    due: "—",
    nda: "Yes",
    urgency: "Medium",
    status: "New",
    owner: "Unassigned",
  },
  {
    id: "T-1023",
    customer: "Globex Inc",
    ae: "Jane Smith",
    due: "Mon 26 May",
    nda: "Unknown",
    urgency: "High",
    status: "Intake Missing",
    owner: "Sarah",
  },
  {
    id: "T-1022",
    customer: "Initech",
    ae: "—",
    due: "—",
    nda: "Yes",
    urgency: "Medium",
    status: "In Review",
    owner: "Sarah",
  },
  {
    id: "T-1021",
    customer: "Umbrella Co",
    ae: "—",
    due: "—",
    nda: "Yes",
    urgency: "High",
    status: "Waiting SME",
    owner: "Alex",
  },
];

function DashboardScreen({
  setScreen,
  ticketCompleted,
}: {
  setScreen: (s: Screen) => void;
  ticketCompleted: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = TICKETS.map((t) =>
    t.id === "T-1023"
      ? { ...t, status: ticketCompleted ? "Completed" : t.status }
      : t,
  );
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-7 pt-6 pb-4 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-[3px] h-7 bg-[#F96702] rounded-full shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">
                Ticket Queue
              </h1>
              <p className="text-sm text-[#6B7280] mt-0.5 font-normal">
                All customer form workflow tickets
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              />
              <input
                className="pl-8 pr-4 py-2 text-[11px] border border-[rgba(0,0,0,0.15)] rounded-full bg-white placeholder-[#B0B0B0] focus:outline-none focus:ring-2 focus:ring-[#F96702]/30 focus:border-[#F96702]/50 w-44 transition-all"
                placeholder="Search tickets…"
              />
            </div>
            <button className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-semibold border border-[rgba(0,0,0,0.15)] rounded-full bg-white text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] tracking-[0.04em] transition-all">
              <Filter size={11} /> Filters
            </button>
            <button
              onClick={() => setScreen("intake-upload")}
              className="flex items-center gap-1.5 px-5 py-2 text-[10px] bg-[#F96702] text-white rounded-full hover:bg-[#D95400] font-bold tracking-[0.06em] shadow-[0_2px_8px_rgba(249,103,2,0.3)] hover:shadow-[0_4px_16px_rgba(249,103,2,0.45)] transition-all"
            >
              <Plus size={12} /> New Request
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x divide-[rgba(0,0,0,0.06)] bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0">
          {[
            { value: rows.length, label: "Total Tickets", accent: false },
            {
              value: rows.filter((r) => r.urgency === "High").length,
              label: "High Priority",
              accent: true,
            },
            {
              value: rows.filter((r) => r.status !== "Completed").length,
              label: "In Progress",
              accent: false,
            },
            {
              value: rows.filter((r) => r.status === "Completed").length,
              label: "Completed",
              accent: false,
            },
          ].map(({ value, label, accent }) => (
            <div key={label} className="px-8 py-6 flex items-end gap-3.5">
              <span
                className={`text-[3rem] font-black tracking-tight leading-none ${accent ? "text-[#F96702]" : "text-[#0A0A0A]"}`}
              >
                {value}
              </span>
              <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#B8B5B0] pb-2">
                {label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {[
              "All Status",
              "Intake Missing",
              "In Review",
              "Waiting SME",
              "Completed",
            ].map((f, i) => (
              <button
                key={f}
                className={`px-3.5 py-1 rounded-full text-[9px] font-bold tracking-[0.08em] uppercase border transition-all ${i === 0 ? "bg-[#F96702] text-white border-[#F96702] shadow-[0_2px_8px_rgba(249,103,2,0.25)]" : "bg-white text-[#9CA3AF] border-[rgba(0,0,0,0.12)] hover:border-[#F96702]/50 hover:text-[#F96702]"}`}
              >
                {f}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-[#9CA3AF] font-semibold tracking-[0.06em]">
              {rows.length} TICKETS
            </span>
          </div>
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAFAF9] border-b border-[rgba(0,0,0,0.06)]">
                  {[
                    "Ticket ID",
                    "Customer",
                    "AE",
                    "Due Date",
                    "NDA",
                    "Urgency",
                    "Status",
                    "Owner",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3.5 text-[8.5px] font-black text-[#ABABAB] uppercase tracking-[0.14em] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const isSel = selectedId === t.id;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedId(isSel ? null : t.id)}
                      className={`border-b border-[rgba(0,0,0,0.04)] last:border-0 cursor-pointer transition-all border-l-[3px] ${isSel ? "bg-[#FFF7F0] border-l-[#F96702]" : t.urgency === "High" ? "border-l-[#F96702]/35 hover:bg-[#FAFAF8]" : "border-l-transparent hover:bg-[#FAFAF8]"}`}
                    >
                      <td className="px-4 py-3.5 font-mono text-xs font-black text-[#0A0A0A] tracking-tight">
                        {t.id}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-[#0A0A0A]">
                        {t.customer}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#6B7280]">
                        {t.ae}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#6B7280] whitespace-nowrap">
                        {t.due}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium">
                        <span
                          className={
                            t.nda === "Unknown"
                              ? "text-[#C05600] font-semibold"
                              : t.nda === "Yes"
                                ? "text-[#374151] font-medium"
                                : "text-[#9CA3AF]"
                          }
                        >
                          {t.nda}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <UrgencyPill urgency={t.urgency} />
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusPill status={t.status} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#6B7280]">
                        {t.owner}
                      </td>
                      <td
                        className="px-4 py-3.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setScreen("intake-upload")}
                          className="flex items-center gap-1 px-3 py-1 text-[9px] font-black bg-[#F96702] text-white rounded-full hover:bg-[#D95400] tracking-[0.06em] uppercase transition-all"
                        >
                          Open <ChevronRight size={9} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ticket detail drawer */}
      {selected && (
        <div className="w-60 bg-white border-l border-border flex flex-col shrink-0 overflow-y-auto">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <p className="text-xs font-bold text-[#1F2937]">{selected.id}</p>
            <button
              onClick={() => setSelectedId(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          </div>
          <div className="px-4 py-4 flex flex-col gap-3 flex-1">
            {[
              ["Customer", selected.customer],
              ["AE", selected.ae],
              ["Due Date", selected.due],
              ["NDA Status", selected.nda],
              ["Urgency", selected.urgency],
              ["Owner", selected.owner],
            ].map(([l, v]) => (
              <div key={l as string}>
                <p className="text-[10px] text-[#9CA3AF] mb-0.5">
                  {l as string}
                </p>
                <p className="text-xs font-medium text-[#1F2937]">
                  {v as string}
                </p>
              </div>
            ))}
            <div>
              <p className="text-[10px] text-[#9CA3AF] mb-1">Status</p>
              <StatusPill status={selected.status} />
            </div>
            <div>
              <p className="text-[10px] text-[#9CA3AF] mb-1">Next Action</p>
              <p className="text-xs text-[#374151]">
                {selected.status === "Intake Missing"
                  ? "Resolve missing intake fields"
                  : selected.status === "In Review"
                    ? "Complete answer review"
                    : selected.status === "Waiting SME"
                      ? "Awaiting SME tab returns"
                      : selected.status === "Completed"
                        ? "No action required"
                        : "Review ticket"}
              </p>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-border flex flex-col gap-2 shrink-0">
            <button
              onClick={() => {
                setSelectedId(null);
                setScreen("intake-upload");
              }}
              className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold bg-[#F96702] text-white rounded-full hover:bg-[#D95400] w-full shadow-[0_2px_8px_rgba(249,103,2,0.3)] tracking-[0.06em] uppercase transition-all"
            >
              Open Workflow <ChevronRight size={10} />
            </button>
            <button
              onClick={() => setSelectedId(null)}
              className="text-xs text-[#6B7280] hover:text-[#1F2937] text-center"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Screen: Upload & Extract ─────────────────────────────────────────────────

function IntakeUploadScreen({
  setScreen,
  addToast,
  addLog,
}: {
  setScreen: (s: Screen) => void;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  addLog: (e: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const handleExtract = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      addLog("Intake uploaded");
      addToast("Extraction complete. 4 fields require attention.", "warning");
      setScreen("intake-check");
    }, 1400);
  };
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        back="dashboard"
        backLabel="Dashboard"
        title="New Request — Upload & Extract"
        subtitle="Paste the incoming email and upload the customer form to begin."
        setScreen={setScreen}
      />
      <WorkflowStepper current="intake-upload" />
      <div className="flex-1 overflow-auto px-8 py-7">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 flex flex-col gap-4 min-h-[280px]">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-[#F96702]" />
                <p className="text-xs font-bold text-[#0A0A0A] tracking-[-0.01em]">
                  Paste Incoming Email
                </p>
              </div>
              <div className="bg-[#F5F4F1] border border-[rgba(0,0,0,0.06)] rounded-xl p-4 flex-1">
                <div className="flex items-center gap-2 mb-2.5 pb-2.5 border-b border-border">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[9px] font-bold shrink-0">
                    J
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#1F2937]">
                      Jane Smith &lt;jane.smith@globexinc.com&gt;
                    </p>
                    <p className="text-[10px] text-[#9CA3AF]">
                      To: gom-team@cloudera.com · Mon 19 May, 09:07
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[#374151] leading-relaxed italic">
                  "Hi GOM team, could you complete the attached security
                  questionnaire for Globex Inc? Customer needs this soon.
                  Thanks, Jane."
                </p>
              </div>
              <p className="text-[10px] text-[#9CA3AF] flex items-center gap-1">
                <Info size={10} /> Email pre-loaded for prototype
              </p>
            </div>
            <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 flex flex-col gap-4 min-h-[280px]">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={14} className="text-[#F96702]" />
                <p className="text-xs font-bold text-[#0A0A0A] tracking-[-0.01em]">
                  Attached Customer Form
                </p>
              </div>
              <div className="border-2 border-dashed border-[#F96702]/30 rounded-xl bg-[#FFF8F4] p-8 flex flex-col items-center justify-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <FileSpreadsheet size={18} className="text-green-600" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-[#1F2937]">
                    Globex_Security_Q.xlsx
                  </p>
                  <p className="text-[10px] text-[#6B7280] mt-0.5">
                    Excel · 142 KB · 36 questions detected
                  </p>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 bg-green-50 border border-green-200 rounded-md">
                  <CheckCircle size={11} className="text-green-500" />
                  <span className="text-[10px] text-green-700 font-medium">
                    File attached
                  </span>
                </div>
              </div>
              <button className="flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-border rounded-md text-[10px] text-[#6B7280] hover:border-[#F96702]/40 hover:text-[#F96702]">
                Replace or upload different file
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-5">
            <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.14em] mb-3">
              Sources for Extraction
            </p>
            <div className="flex gap-3">
              {[
                {
                  icon: Mail,
                  label: "Email from Jane Smith",
                  detail: "Mon 19 May, 09:07",
                },
                {
                  icon: FileSpreadsheet,
                  label: "Globex_Security_Q.xlsx",
                  detail: "142 KB · 36 questions",
                },
              ].map(({ icon: Icon, label, detail }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#F7F8FA] border border-border flex-1"
                >
                  <Icon size={13} className="text-[#6B7280] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#1F2937] truncate">
                      {label}
                    </p>
                    <p className="text-[10px] text-[#9CA3AF]">{detail}</p>
                  </div>
                  <CheckCircle size={12} className="text-green-500 shrink-0" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleExtract}
              disabled={loading}
              className={`flex items-center gap-2 px-6 py-2.5 text-[10px] font-bold tracking-[0.07em] rounded-full transition-all ${loading ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : "bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.3)] hover:shadow-[0_4px_16px_rgba(249,103,2,0.45)]"}`}
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Extracting
                  intake information…
                </>
              ) : (
                <>
                  <Brain size={13} /> Extract Intake Information
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Intake Check ─────────────────────────────────────────────────────

function IntakeCheckScreen({
  setScreen,
  intakeComplete,
  addToast,
  addLog,
  onSimulateReply,
}: {
  setScreen: (s: Screen) => void;
  intakeComplete: boolean;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  addLog: (e: string) => void;
  onSimulateReply: () => void;
}) {
  const fields = [
    { label: "Customer", value: "Globex Inc", status: "found" },
    { label: "AE / Requester", value: "Jane Smith", status: "found" },
    { label: "Request type", value: "Security Questionnaire", status: "found" },
    {
      label: "Attached form",
      value: "Globex_Security_Q.xlsx",
      status: "found",
    },
    {
      label: "Deadline",
      value: intakeComplete ? "Mon 26 May" : "—",
      status: intakeComplete ? "found" : "missing",
    },
    {
      label: "NDA status",
      value: intakeComplete ? "No NDA required" : "—",
      status: intakeComplete ? "found" : "missing",
    },
    {
      label: "Urgency level",
      value: intakeComplete ? "High" : "—",
      status: intakeComplete ? "found" : "unclear",
    },
    {
      label: "Business impact / opportunity",
      value: intakeComplete ? "Renewal, medium value" : "—",
      status: intakeComplete ? "found" : "missing",
    },
  ];
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        back="intake-upload"
        backLabel="Upload"
        title="Intake Check — Globex Inc"
        badge={
          <StatusPill
            status={intakeComplete ? "Intake Complete" : "Intake Missing"}
          />
        }
        setScreen={setScreen}
      />
      <WorkflowStepper current="intake-check" />
      <div className="flex-1 overflow-auto px-8 py-7">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">
          {!intakeComplete && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3.5 flex items-start gap-2.5">
              <AlertTriangle
                size={14}
                className="text-orange-500 shrink-0 mt-0.5"
              />
              <div>
                <p className="text-xs font-semibold text-orange-800 mb-0.5">
                  Intake incomplete
                </p>
                <p className="text-xs text-orange-700">
                  Missing deadline, NDA status, urgency and business impact.
                  Resolve these before continuing.
                </p>
              </div>
            </div>
          )}
          {intakeComplete && (
            <div className="bg-[#FFF4EC] border border-[#F96702]/25 rounded-lg p-3.5 flex items-center gap-2.5">
              <CheckCircle size={14} className="text-[#F96702] shrink-0" />
              <p className="text-xs font-semibold text-[#C05600]">
                Intake complete. All fields resolved — ready to analyse the
                form.
              </p>
            </div>
          )}
          <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F7F8FA] border-b border-border">
              <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide">
                Extracted Fields — Globex Inc Security Questionnaire
              </p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Field", "Extracted Value", "Status"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2 text-[10px] font-bold text-[#6B7280] uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr
                    key={f.label}
                    className={`border-b border-border last:border-0 ${f.status !== "found" ? "bg-orange-50/30" : ""}`}
                  >
                    <td className="px-4 py-2.5 text-xs font-medium text-[#1F2937]">
                      {f.label}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#374151]">
                      {f.status === "found" ? (
                        f.value
                      ) : (
                        <span className="text-[#9CA3AF] italic">
                          Not provided
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {f.status === "found" && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle size={11} /> Found
                        </span>
                      )}
                      {f.status === "missing" && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                          <XCircle size={11} /> Missing
                        </span>
                      )}
                      {f.status === "unclear" && (
                        <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
                          <AlertTriangle size={11} /> Unclear
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <BtnPrimary onClick={() => setScreen("clarification-email")}>
              <Mail size={12} /> Generate Clarification Email
            </BtnPrimary>
            {!intakeComplete && (
              <button
                onClick={() => {
                  onSimulateReply();
                  addLog("Intake confirmed complete");
                  addToast("Intake confirmed complete.", "success");
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold border border-[#F96702]/30 text-[#C05600] bg-[#FFF4EC] rounded-md hover:bg-[#FFE8D0] transition-colors"
              >
                <CheckCircle size={12} /> Confirm Intake Complete
              </button>
            )}
            {intakeComplete && (
              <BtnPrimary onClick={() => setScreen("question-extraction")}>
                <Brain size={12} /> Analyse Form <ChevronRight size={11} />
              </BtnPrimary>
            )}
            {!intakeComplete && (
              <p className="text-[10px] text-[#9CA3AF]">
                Required intake fields must be resolved before continuing.
              </p>
            )}
          </div>
          <ActivityLog entries={[]} />
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Clarification Email ──────────────────────────────────────────────

function ClarificationEmailScreen({
  setScreen,
  onSimulateReply,
  addToast,
  addLog,
}: {
  setScreen: (s: Screen) => void;
  onSimulateReply: () => void;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  addLog: (e: string) => void;
}) {
  const [sent, setSent] = useState(false);
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        back="intake-check"
        backLabel="Intake Check"
        title="Clarification Email to AE — Auto-drafted"
        subtitle="Asking only for missing intake fields."
        setScreen={setScreen}
      />
      <WorkflowStepper current="clarification-email" />
      <div className="flex-1 overflow-auto px-8 py-7">
        <div className="max-w-3xl mx-auto flex flex-col gap-5">
          {sent && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2.5">
              <CheckCircle size={13} className="text-green-500 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-green-800">
                  Clarification email sent. Waiting for AE reply.
                </p>
              </div>
              <button
                onClick={() => {
                  onSimulateReply();
                  addLog("Intake confirmed complete");
                  addToast("AE replied — intake updated.", "success");
                  setScreen("intake-check");
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold bg-[#1A1A1A] text-white rounded hover:bg-[#333] whitespace-nowrap"
              >
                <RefreshCw size={10} /> Simulate AE Reply
              </button>
            </div>
          )}
          <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F7F8FA] border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide">
                Auto-generated draft
              </p>
              {sent && (
                <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle size={10} /> Sent
                </span>
              )}
            </div>
            <div className="px-4 py-3 space-y-2 border-b border-border">
              {[
                ["To", "jane.smith@globexinc.com"],
                ["CC", "sarah.chen@cloudera.com"],
                [
                  "Subject",
                  "RE: Globex Inc Security Questionnaire — Missing Intake Details (T-1023)",
                ],
              ].map(([l, v]) => (
                <div key={l as string} className="flex gap-2 text-xs">
                  <span className="text-[#9CA3AF] w-12 shrink-0">{l}:</span>
                  <span className="text-[#1F2937]">{v}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-4 text-xs text-[#374151] leading-relaxed space-y-2.5">
              <p>Hi Jane,</p>
              <p>
                Thank you for forwarding the Globex Inc questionnaire. We need a
                few additional details before we can begin safely routing the
                form.
              </p>
              <p>Could you please confirm:</p>
              <ol className="list-decimal ml-5 space-y-1.5">
                <li>
                  <strong>Response deadline</strong> — by what date does Globex
                  Inc require completed answers?
                </li>
                <li>
                  <strong>NDA status</strong> — is there an active NDA with
                  Globex Inc?
                </li>
                <li>
                  <strong>Urgency level</strong> — High, Medium, or Low?
                </li>
                <li>
                  <strong>Business impact</strong> — is this a renewal,
                  expansion, or new deal?
                </li>
              </ol>
              <p>
                Once confirmed, we will proceed immediately. Please reply to
                this email directly.
              </p>
              <p>
                Thank you,
                <br />
                <strong>Sarah Chen</strong>
                <br />
                GOM Analyst, Cloudera
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!sent && (
              <BtnPrimary
                onClick={() => {
                  setSent(true);
                  addLog("Clarification email sent");
                  addToast("Clarification email sent.", "success");
                }}
              >
                <Send size={12} /> Send Email
              </BtnPrimary>
            )}
            <BtnSecondary>
              <Edit3 size={12} /> Edit Draft
            </BtnSecondary>
            <BtnSecondary onClick={() => setScreen("intake-check")}>
              <ArrowLeft size={11} /> Back to Intake
            </BtnSecondary>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Question Extraction ──────────────────────────────────────────────

function QuestionExtractionScreen({
  setScreen,
  addLog,
}: {
  setScreen: (s: Screen) => void;
  addLog: (e: string) => void;
}) {
  const [tab, setTab] = useState("InfoSec");
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const tabs = [
    { label: "InfoSec", count: 12 },
    { label: "Legal", count: 5 },
    { label: "HR", count: 8 },
    { label: "Finance", count: 6 },
    { label: "ESG", count: 5 },
  ];
  const rows: Record<
    string,
    Array<{ q: string; dept: string; reviewStatus: string; status: string }>
  > = {
    InfoSec: [
      {
        q: "Do you have a SOC 2 Type II report?",
        dept: "InfoSec",
        reviewStatus: "Source Found",
        status: "Existing answer found",
      },
      {
        q: "Describe data encryption in transit.",
        dept: "InfoSec",
        reviewStatus: "Needs Review",
        status: "Needs review",
      },
      {
        q: "What is your vulnerability disclosure policy?",
        dept: "InfoSec",
        reviewStatus: "Source Found",
        status: "Existing answer found",
      },
      {
        q: "Do you perform annual penetration testing?",
        dept: "InfoSec",
        reviewStatus: "Needs Review",
        status: "Needs review",
      },
      {
        q: "What MFA mechanisms are supported?",
        dept: "InfoSec",
        reviewStatus: "Source Found",
        status: "Existing answer found",
      },
      {
        q: "How are privileged accounts managed?",
        dept: "InfoSec",
        reviewStatus: "SME Needed",
        status: "SME input needed",
      },
    ],
    Legal: [
      {
        q: "Do you have anti-bribery policies?",
        dept: "Legal",
        reviewStatus: "Source Found",
        status: "Existing answer found",
      },
      {
        q: "Where is customer data subject to jurisdiction?",
        dept: "Legal",
        reviewStatus: "SME Needed",
        status: "SME input needed",
      },
      {
        q: "Do you have a data processing agreement template?",
        dept: "Legal",
        reviewStatus: "Needs Review",
        status: "Needs review",
      },
    ],
    HR: [
      {
        q: "What is your employee turnover rate?",
        dept: "HR",
        reviewStatus: "SME Needed",
        status: "SME input needed",
      },
      {
        q: "Do you conduct background checks on all staff?",
        dept: "HR",
        reviewStatus: "Needs Review",
        status: "Needs review",
      },
      {
        q: "What security training do employees receive?",
        dept: "HR",
        reviewStatus: "Source Found",
        status: "Existing answer found",
      },
    ],
    Finance: [
      {
        q: "Are your financials audited by a third party?",
        dept: "Finance",
        reviewStatus: "Source Found",
        status: "Existing answer found",
      },
      {
        q: "Do you maintain cyber insurance?",
        dept: "Finance",
        reviewStatus: "SME Needed",
        status: "SME input needed",
      },
    ],
    ESG: [
      {
        q: "What is your carbon neutrality target?",
        dept: "ESG",
        reviewStatus: "SME Needed",
        status: "SME input needed",
      },
      {
        q: "Do you publish an annual sustainability report?",
        dept: "ESG",
        reviewStatus: "Needs Review",
        status: "Needs review",
      },
    ],
  };
  const statusStyle: Record<string, string> = {
    "Existing answer found": "bg-[#FFF4EC] text-[#C05600] border-[#F96702]/25",
    "Needs review": "bg-[#F5F5F5] text-[#374151] border-[rgba(0,0,0,0.1)]",
    "SME input needed": "bg-[#FFF4EC] text-[#C05600] border-[#F96702]/25",
  };
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        back="intake-check"
        backLabel="Intake Check"
        title="Question Extraction & Department Grouping"
        badge={
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FFF1E6] border border-[#F96702]/30 rounded-md">
            <Brain size={12} className="text-[#F96702]" />
            <span className="text-xs font-bold text-[#D95400]">
              36 questions extracted
            </span>
          </div>
        }
        setScreen={setScreen}
      />
      <WorkflowStepper current="question-extraction" />
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
          <div className="flex border-b border-border overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.label}
                onClick={() => {
                  setTab(t.label);
                  setSelectedRow(null);
                }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 shrink-0 transition-colors ${tab === t.label ? "border-[#F96702] text-[#F96702]" : "border-transparent text-[#6B7280] hover:text-[#1F2937]"}`}
              >
                {t.label}
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tab === t.label ? "bg-[#FFF1E6] text-[#F96702]" : "bg-gray-100 text-gray-500"}`}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F8FA] border-b border-border">
                {["Question", "Suggested Dept", "Review Status", "Status"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2 text-[10px] font-bold text-[#6B7280] uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {(rows[tab] ?? []).map((r, i) => (
                <tr
                  key={i}
                  onClick={() => setSelectedRow(i === selectedRow ? null : i)}
                  className={`border-b border-border last:border-0 cursor-pointer transition-colors ${selectedRow === i ? "bg-[#FFF7F0]" : "hover:bg-[#FAFAFA]"}`}
                >
                  <td className="px-4 py-2.5 text-xs text-[#1F2937]">{r.q}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6B7280] font-medium">
                    {r.dept}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={r.reviewStatus} />
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${statusStyle[r.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 mt-4">
          <BtnSecondary>
            <Edit3 size={12} /> Review Grouping
          </BtnSecondary>
          <BtnPrimary
            onClick={() => {
              addLog("Questions extracted");
              setScreen("answer-review");
            }}
          >
            Continue to Answer Review <ChevronRight size={11} />
          </BtnPrimary>
        </div>
      </div>
    </div>
  );
}

// Bold every word that starts with a search keyword.
// Searching "encrypt" will also catch "encrypted", "encryption", etc.
function highlightKeywords(text: string, query: string) {
  if (!query.trim()) return text;

  // Common words we don't want to bold
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "of",
    "to",
    "in",
    "on",
    "for",
    "and",
    "or",
    "is",
    "are",
    "do",
    "does",
    "you",
    "your",
    "we",
    "with",
    "have",
    "has",
    "this",
    "that",
    "what",
    "how",
    "describe",
  ]);

  const keywords = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (keywords.length === 0) return text;

  // Escape special regex characters
  const escaped = keywords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  // \b = word start, \w* = keep the rest of the word (encrypt -> encrypted)
  const wordPattern = escaped.map((w) => w + "\\w*").join("|");
  const splitPattern = new RegExp(`\\b(${wordPattern})`, "gi");
  const testPattern = new RegExp(`^(${wordPattern})$`, "i");

  // Split keeps the matched words because of the capture group ()
  const parts = text.split(splitPattern);

  // Bold any part that is a matched word
  return parts.map((part, i) =>
    testPattern.test(part) ? (
      <strong
        key={i}
        className="font-semibold text-[#0A0A0A] bg-[#FFF1E6] rounded px-0.5"
      >
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

// ─── Screen: Answer Review (search-first layout) ──────────────────────────────

function AnswerReviewScreen({
  setScreen,
  addToast,
  addLog,
}: {
  setScreen: (s: Screen) => void;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  addLog: (e: string) => void;
}) {
  // Sample questions for quick access
  const sampleQuestions = [
    "Do you have a SOC 2 Type II report?",
    "Describe data encryption in transit.",
    "What is your vulnerability disclosure policy?",
    "Do you run credit checks on employees?",
    "Do you have anti-bribery policies in place?",
    "Do you perform annual penetration testing?",
    "What MFA mechanisms are supported?",
  ];

  const [query, setQuery] = useState(""); // text in the search box
  const [searched, setSearched] = useState(""); // the question actually searched
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>([]); // recent searches (session only)
  const [hasSearched, setHasSearched] = useState(false); // whether any search has run yet
  const customerNda = "No NDA";

  // Call the backend with a given question
  async function runSearch(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    setSearched(trimmed);
    setHasSearched(true);
    setLoading(true);
    setChosenId(null);
    // Add to history (most recent first, no duplicates, keep last 6)
    setHistory((prev) =>
      [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, 6),
    );
    try {
      const data = await searchKnowledgeBase(trimmed);
      setResults(data);
    } catch (error) {
      console.error("Search failed:", error);
      addToast("Search failed. Is the backend running?", "warning");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleChip(q: string) {
    setQuery(q);
    runSearch(q);
  }

  function formatDate(raw: string): string {
    if (!raw) return "—";
    return `${raw.slice(0, 10)} (UTC)`;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        back="question-extraction"
        backLabel="Questions"
        title="Answer Review — Globex Inc"
        subtitle="Search the knowledge base for the most relevant approved sources."
        setScreen={setScreen}
      />
      <WorkflowStepper current="answer-review" />

      <div className="flex-1 overflow-auto px-8 py-7">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          {/* Big search box */}
          <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            {/* Current customer context */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em]">
                Customer
              </span>
              <span className="text-xs font-semibold text-[#0A0A0A]">
                Globex Inc
              </span>
              <span className="text-[#D5D5D5]">·</span>
              <span className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em]">
                NDA
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-[0.06em] uppercase bg-[#F5F5F5] text-[#374151] border border-[rgba(0,0,0,0.1)]">
                {customerNda}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runSearch(query);
                  }}
                  placeholder="Ask any question about the company…"
                  className="w-full pl-12 pr-4 py-3.5 text-base border border-[rgba(0,0,0,0.12)] rounded-full bg-[#FAFAF9] placeholder-[#B0B0B0] focus:outline-none focus:ring-2 focus:ring-[#F96702]/30 focus:border-[#F96702]/50 focus:bg-white transition-all"
                />
              </div>
              <button
                onClick={() => runSearch(query)}
                disabled={loading}
                className={`flex items-center gap-2 px-7 py-3.5 text-[11px] font-bold tracking-[0.07em] rounded-full transition-all ${loading ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : "bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.3)] hover:shadow-[0_4px_16px_rgba(249,103,2,0.45)]"}`}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Searching
                  </>
                ) : (
                  <>
                    <Search size={14} /> Search
                  </>
                )}
              </button>
            </div>

            {/* Sample questions */}
            <div className="mt-5">
              <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em] mb-2.5">
                Sample Questions
              </p>
              <div className="flex flex-wrap gap-2">
                {sampleQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleChip(q)}
                    className="px-3.5 py-1.5 rounded-full text-[11px] font-medium bg-[#F5F4F1] text-[#374151] border border-[rgba(0,0,0,0.06)] hover:border-[#F96702]/50 hover:text-[#F96702] hover:bg-[#FFF7F0] transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Search history */}
            {history.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.05)]">
                <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em] mb-2.5">
                  Recent Searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {history.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => handleChip(h)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-white text-[#6B7280] border border-[rgba(0,0,0,0.1)] hover:border-[#F96702]/50 hover:text-[#F96702] transition-all"
                    >
                      <Clock size={10} /> {h}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Empty state (before first search) */}
          {!hasSearched && (
            <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] p-12 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#FFF1E6] flex items-center justify-center">
                <Brain size={22} className="text-[#F96702]" />
              </div>
              <p className="text-sm font-semibold text-[#374151]">
                Search to find relevant sources
              </p>
              <p className="text-xs text-[#9CA3AF] max-w-sm">
                Type a question above, or pick a sample question. The system
                retrieves the most relevant approved sources from the knowledge
                base.
              </p>
            </div>
          )}

          {/* Results */}
          {hasSearched && (
            <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] p-7">
              <div className="flex items-start justify-between gap-6 mb-6 pb-6 border-b border-[rgba(0,0,0,0.06)]">
                <div>
                  <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em] mb-1.5">
                    Showing results for
                  </p>
                  <h3 className="text-lg font-bold text-[#0A0A0A] leading-snug tracking-tight">
                    {searched}
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FFF1E6] border border-[#F96702]/30 rounded-md shrink-0">
                  <Brain size={12} className="text-[#F96702]" />
                  <span className="text-[10px] font-bold text-[#D95400]">
                    AI Retrieved
                  </span>
                </span>
              </div>

              {loading && (
                <div className="flex items-center gap-2 text-sm text-[#6B7280] py-8 justify-center">
                  <Loader2 size={16} className="animate-spin" /> Searching the
                  knowledge base…
                </div>
              )}

              {!loading && results.length === 0 && (
                <div className="text-sm text-[#9CA3AF] py-8 text-center">
                  No relevant source found for this question.
                </div>
              )}

              {!loading && results.length > 0 && (
                <div className="flex flex-col gap-4">
                  <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.14em]">
                    Suggested Sources ({results.length})
                  </p>
                  {results.map((r, i) => {
                    const isNDA = r.sharingStatus === "NDA-required";
                    const isChosen = chosenId === r.id;
                    return (
                      <div
                        key={r.id}
                        className={`rounded-xl border p-5 flex flex-col gap-3 transition-all ${isChosen ? "border-[#F96702] bg-[#FFF7F0]" : "border-[rgba(0,0,0,0.08)] bg-[#FAFAF9]"}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em]">
                              Candidate {i + 1}
                            </span>
                            {r.similarityScore != null && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-[0.06em] uppercase bg-[#FFF1E6] text-[#C05600] border border-[#F96702]/25">
                                {Math.round(r.similarityScore * 100)}% Relevance
                              </span>
                            )}
                          </div>
                          {isNDA ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-[0.06em] uppercase bg-[#FFF4EC] text-[#C05600] border border-[#F96702]/30">
                              <Shield size={9} /> NDA-required
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-[0.06em] uppercase bg-[#F5F5F5] text-[#374151] border border-[rgba(0,0,0,0.1)]">
                              {r.sharingStatus}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#1F2937] leading-relaxed">
                          {highlightKeywords(r.content, searched)}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#6B7280] pt-1">
                          <span className="inline-flex items-center gap-1">
                            <ExternalLink
                              size={11}
                              className="text-[#F96702]"
                            />
                            {r.source}
                          </span>
                          <span>Updated: {formatDate(r.lastUpdated)}</span>
                          <span>Dept: {r.department}</span>
                        </div>

                        {/* NDA conflict warning */}
                        {isNDA && customerNda === "No NDA" && (
                          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FFF7F0] border border-[#F96702]/20">
                            <AlertTriangle
                              size={13}
                              className="text-[#F96702] shrink-0 mt-0.5"
                            />
                            <div>
                              <p className="text-[11px] font-bold text-[#C05600] mb-0.5">
                                NDA Conflict
                              </p>
                              <p className="text-[11px] text-[#8B4500] leading-relaxed">
                                This source is NDA-required, but no NDA is on
                                file for this customer. Route to SME or confirm
                                with the AE before sharing.
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => {
                              setChosenId(r.id);
                              addLog(`Selected source: ${r.sectionTitle}`);
                              addToast("Source selected as answer.", "success");
                            }}
                            className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase transition-all ${isChosen ? "bg-green-600 text-white" : "bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.25)]"}`}
                          >
                            {isChosen ? (
                              <>
                                <CheckCircle size={11} /> Selected
                              </>
                            ) : (
                              <>Use this</>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <BtnPrimary onClick={() => setScreen("sme-package")}>
              Continue to SME Preparation <ChevronRight size={11} />
            </BtnPrimary>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: SME Package & Email ──────────────────────────────────────────────

function SMEPackageScreen({
  setScreen,
  addToast,
  addLog,
}: {
  setScreen: (s: Screen) => void;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  addLog: (e: string) => void;
}) {
  const [excelTab, setExcelTab] = useState("InfoSec");
  const [generating, setGenerating] = useState(false);
  const tabs = [
    { label: "InfoSec", count: 12 },
    { label: "Legal", count: 5 },
    { label: "HR", count: 8 },
    { label: "Finance", count: 6 },
    { label: "ESG", count: 5 },
  ];
  const previewRows: Record<string, string[]> = {
    InfoSec: [
      "Do you have a SOC 2 Type II report?",
      "Describe data encryption in transit.",
      "How are privileged accounts managed?",
      "Do you have an incident response plan?",
      "What is your patch management cadence?",
    ],
    Legal: [
      "Where is customer data subject to jurisdiction?",
      "Do you have a data processing agreement?",
    ],
    HR: [
      "What is your employee turnover rate?",
      "Do you conduct background checks on all staff?",
    ],
    Finance: ["Do you maintain cyber insurance?"],
    ESG: [
      "What is your carbon neutrality target?",
      "Do you publish a sustainability report?",
    ],
  };
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        back="answer-review"
        backLabel="Answer Review"
        title="SME Package & Email"
        subtitle="Unresolved questions packaged by department. SMEs work in Excel and email."
        setScreen={setScreen}
      />
      <WorkflowStepper current="sme-package" />
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="bg-[#FAFAFA] border border-[rgba(0,0,0,0.08)] rounded-xl p-4 mb-5 flex items-start gap-2.5">
          <Info size={13} className="text-[#9CA3AF] shrink-0 mt-0.5" />
          <p className="text-xs text-[#6B7280]">
            SMEs are not required to log into this system. Unresolved questions
            are packaged into Excel by department, and this dashboard tracks ETA
            and return status.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Excel preview */}
          <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden flex flex-col">
            <div className="px-3.5 py-2.5 bg-[#F7F8FA] border-b border-border flex items-center gap-1.5">
              <FileSpreadsheet size={12} className="text-green-600" />
              <p className="text-[10px] font-bold text-[#1F2937]">
                Generated SME Excel Package Preview
              </p>
              <span className="ml-auto text-[10px] text-[#9CA3AF]">
                Globex_SME_Request.xlsx
              </span>
            </div>
            <div className="flex border-b border-border overflow-x-auto shrink-0">
              {tabs.map((t) => (
                <button
                  key={t.label}
                  onClick={() => setExcelTab(t.label)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium border-b-2 shrink-0 transition-colors ${excelTab === t.label ? "border-[#F96702] text-[#C05600]" : "border-transparent text-[#6B7280] hover:text-[#1F2937]"}`}
                >
                  {t.label}{" "}
                  <span
                    className={`px-1 rounded text-[9px] font-bold ${excelTab === t.label ? "bg-[#FFF4EC] text-[#C05600]" : "bg-gray-100 text-gray-500"}`}
                  >
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FFF7F0] border-b border-border">
                    <th className="text-left px-3 py-1.5 text-[10px] font-bold text-[#C05600]">
                      #
                    </th>
                    <th className="text-left px-3 py-1.5 text-[10px] font-bold text-[#C05600]">
                      Question
                    </th>
                    <th className="text-left px-3 py-1.5 text-[10px] font-bold text-[#C05600]">
                      SME Answer
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(previewRows[excelTab] ?? []).map((q, i) => (
                    <tr
                      key={i}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2 text-[10px] text-[#9CA3AF] font-mono">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-[#1F2937]">
                        {q}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-[#9CA3AF] italic">
                        — to be completed —
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50/50">
                    <td
                      colSpan={3}
                      className="px-3 py-1.5 text-[9px] text-[#9CA3AF] italic text-center"
                    >
                      +{" "}
                      {(tabs.find((t) => t.label === excelTab)?.count ?? 0) -
                        (previewRows[excelTab]?.length ?? 0)}{" "}
                      more rows…
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-3.5 py-2.5 border-t border-border bg-[#F7F8FA]">
              <button
                onClick={() => {
                  setGenerating(true);
                  setTimeout(() => {
                    setGenerating(false);
                    addToast("SME Excel downloaded.", "success");
                  }, 900);
                }}
                disabled={generating}
                className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold rounded w-full justify-center transition-colors ${generating ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-[#F96702] text-white hover:bg-[#D95400]"}`}
              >
                {generating ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Download size={11} /> Download SME Excel
                  </>
                )}
              </button>
            </div>
          </div>
          {/* Email draft */}
          <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden flex flex-col">
            <div className="px-3.5 py-2.5 bg-[#F7F8FA] border-b border-border flex items-center gap-1.5">
              <Mail size={12} className="text-[#F96702]" />
              <p className="text-[10px] font-bold text-[#1F2937]">
                SME Email Draft — {excelTab} Team
              </p>
            </div>
            <div className="px-3.5 py-3 space-y-1.5 border-b border-border">
              {[
                ["To", `${excelTab.toLowerCase()}-team@cloudera.com`],
                ["CC", "sarah.chen@cloudera.com"],
                [
                  "Subject",
                  `ETA request — Globex Inc customer form, ${excelTab} tab`,
                ],
              ].map(([l, v]) => (
                <div key={l as string} className="flex gap-2 text-[10px]">
                  <span className="text-[#9CA3AF] w-10 shrink-0">{l}:</span>
                  <span className="text-[#1F2937]">{v}</span>
                </div>
              ))}
            </div>
            <div className="px-3.5 py-3 text-[10px] text-[#374151] leading-relaxed space-y-2 flex-1 overflow-auto">
              <p>Hi {excelTab} Team,</p>
              <p>
                We have received a security questionnaire from{" "}
                <strong>Globex Inc</strong> and need your input on the{" "}
                <strong>{excelTab} tab</strong> of the attached Excel.
              </p>
              <div className="bg-[#F7F8FA] rounded p-2.5 border border-border space-y-1">
                <p>
                  <strong>Customer:</strong> Globex Inc
                </p>
                <p>
                  <strong>NDA status:</strong> No NDA — do not share
                  NDA-restricted materials
                </p>
                <p>
                  <strong>Deadline:</strong> Mon 26 May 2025
                </p>
                <p>
                  <strong>Your tab:</strong> {excelTab} (
                  {tabs.find((t) => t.label === excelTab)?.count} questions)
                </p>
                <p>
                  <strong>Attached:</strong> Globex_SME_Request.xlsx
                </p>
              </div>
              <p>
                Please complete your tab and reply with your{" "}
                <strong>ETA</strong>. If any question is outside your scope,
                note it in the answer column.
              </p>
              <p>
                Thank you,
                <br />
                <strong>Sarah Chen</strong>, GOM Analyst
              </p>
            </div>
            <div className="px-3.5 py-2.5 border-t border-border bg-[#F7F8FA] flex gap-1.5">
              <button
                onClick={() => {
                  addLog("SME package sent");
                  addToast("SME email sent.", "success");
                  setScreen("eta-tracking");
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold bg-[#F96702] text-white rounded-full hover:bg-[#D95400] flex-1 justify-center shadow-[0_2px_8px_rgba(249,103,2,0.25)] tracking-[0.06em] uppercase transition-all"
              >
                <Send size={10} /> Send SME Email
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold border border-[rgba(0,0,0,0.15)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] transition-all">
                <Edit3 size={10} /> Edit
              </button>
              <button
                onClick={() =>
                  addToast("Use Record ETA on the ETA Tracking screen.", "info")
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold border border-[rgba(0,0,0,0.15)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] transition-all"
              >
                <Clock size={10} /> Record ETA
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <BtnSecondary onClick={() => setScreen("answer-review")}>
            <ArrowLeft size={11} /> Back to Answer Review
          </BtnSecondary>
          <BtnPrimary onClick={() => setScreen("eta-tracking")}>
            Continue to ETA Tracking <ChevronRight size={11} />
          </BtnPrimary>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: ETA Tracking ─────────────────────────────────────────────────────

function ETATrackingScreen({
  setScreen,
  addToast,
  addLog,
  smeReturned,
  setSmeReturned,
}: {
  setScreen: (s: Screen) => void;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  addLog: (e: string) => void;
  smeReturned: boolean;
  setSmeReturned: (v: boolean) => void;
}) {
  const [etaModal, setEtaModal] = useState(false);
  const [etaDept, setEtaDept] = useState("");
  const rows = [
    {
      dept: "InfoSec",
      team: "InfoSec Team",
      qs: 12,
      eta: "Fri 3pm",
      status: smeReturned ? "Returned" : "ETA Confirmed",
    },
    {
      dept: "Legal",
      team: "Legal Team",
      qs: 5,
      eta: smeReturned ? "Thu 11am" : "No ETA",
      status: smeReturned ? "Returned" : "Waiting for ETA",
    },
    {
      dept: "HR",
      team: "HR Ops",
      qs: 8,
      eta: "Tue 5pm",
      status: smeReturned ? "Returned" : "Overdue",
    },
    {
      dept: "Finance",
      team: "Finance Team",
      qs: 6,
      eta: "Wed 2pm",
      status: smeReturned ? "Returned" : "In Progress",
    },
    {
      dept: "ESG",
      team: "ESG Team",
      qs: 5,
      eta: "Thu 12pm",
      status: smeReturned ? "Returned" : "In Progress",
    },
  ];
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        back="sme-package"
        backLabel="SME Package"
        title="ETA Tracking — Globex Inc"
        setScreen={setScreen}
      />
      <WorkflowStepper current="eta-tracking" />
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] overflow-hidden mb-5">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F8FA] border-b border-border">
                {[
                  "Department Tab",
                  "SME Team",
                  "Questions",
                  "ETA",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 text-[10px] font-bold text-[#6B7280] uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={i}
                  className={`border-b border-border last:border-0 transition-colors ${r.status === "Overdue" ? "bg-red-50/30" : "hover:bg-gray-50/50"}`}
                >
                  <td className="px-4 py-2.5 text-xs font-semibold text-[#1F2937]">
                    {r.dept}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#6B7280]">
                    {r.team}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono font-bold text-[#1F2937]">
                    {r.qs}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-xs font-medium ${r.eta === "No ETA" ? "text-orange-500" : r.status === "Overdue" ? "text-red-600" : "text-[#1F2937]"}`}
                  >
                    {r.eta}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          setEtaDept(r.dept);
                          setEtaModal(true);
                        }}
                        className="px-3 py-1 text-[9px] font-bold border border-[rgba(0,0,0,0.15)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] tracking-[0.06em] uppercase whitespace-nowrap transition-all"
                      >
                        Record ETA
                      </button>
                      {r.status === "Overdue" && (
                        <button
                          onClick={() => setScreen("reminder-email")}
                          className="px-3 py-1 text-[9px] font-bold border border-[#FCA5A5]/50 bg-[#FEF2F2] rounded-full text-[#991B1B] hover:bg-[#FEE2E2] tracking-[0.06em] uppercase whitespace-nowrap transition-all"
                        >
                          Reminder
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 flex-wrap">
          <BtnSecondary
            onClick={() => addToast("SME emails resent.", "success")}
          >
            <Send size={11} /> Resend SME Emails
          </BtnSecondary>
          <BtnSecondary
            onClick={() => {
              setEtaDept("All Depts");
              setEtaModal(true);
            }}
          >
            <Clock size={11} /> Record ETA
          </BtnSecondary>
          <button
            onClick={() => setScreen("reminder-email")}
            className="flex items-center gap-1.5 px-5 py-2 text-[10px] font-bold border border-[#F96702]/30 bg-[#FFF4EC] rounded-full text-[#C05600] hover:bg-[#FFE8D0] tracking-[0.06em] uppercase transition-all"
          >
            <Bell size={11} /> Generate Reminder
          </button>
          {!smeReturned ? (
            <button
              onClick={() => {
                setSmeReturned(true);
                addLog("SME tabs returned");
                addToast(
                  "SME tabs returned. Final Review unlocked.",
                  "success",
                );
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium border border-[rgba(0,0,0,0.12)] bg-white rounded-md text-[#374151] hover:bg-[#F5F5F5]"
            >
              <RefreshCw size={11} /> Simulate SME Tabs Returned
            </button>
          ) : (
            <BtnPrimary onClick={() => setScreen("final-review")}>
              Proceed to Final Review <ChevronRight size={11} />
            </BtnPrimary>
          )}
        </div>
      </div>
      {etaModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-5 w-80">
            <h3 className="text-sm font-semibold text-[#1F2937] mb-0.5">
              Record ETA
            </h3>
            <p className="text-xs text-[#6B7280] mb-3">
              Set expected return date for <strong>{etaDept}</strong>
            </p>
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="text-[10px] font-medium text-[#6B7280] mb-1 block">
                  Department
                </label>
                <input
                  className="w-full border border-border rounded-md px-2.5 py-1.5 text-xs bg-[#F7F8FA]"
                  value={etaDept}
                  readOnly
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#6B7280] mb-1 block">
                  ETA Date & Time
                </label>
                <input
                  type="datetime-local"
                  className="w-full border border-border rounded-md px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#6B7280] mb-1 block">
                  Confirmed by (optional)
                </label>
                <input
                  className="w-full border border-border rounded-md px-2.5 py-1.5 text-xs"
                  placeholder="e.g. Confirmed via email by Alex"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <BtnSecondary onClick={() => setEtaModal(false)}>
                Cancel
              </BtnSecondary>
              <BtnPrimary
                onClick={() => {
                  setEtaModal(false);
                  addToast(`ETA recorded for ${etaDept}.`, "success");
                }}
              >
                Save ETA
              </BtnPrimary>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Screen: Reminder Email ───────────────────────────────────────────────────

function ReminderEmailScreen({
  setScreen,
  addToast,
  addLog,
}: {
  setScreen: (s: Screen) => void;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  addLog: (e: string) => void;
}) {
  const [sent, setSent] = useState(false);
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        back="eta-tracking"
        backLabel="ETA Tracking"
        title="Overdue Reminder — HR Ops"
        badge={<StatusPill status="Overdue" />}
        setScreen={setScreen}
      />
      <WorkflowStepper current="reminder-email" />
      <div className="flex-1 overflow-auto px-8 py-7">
        <div className="max-w-3xl mx-auto flex flex-col gap-5">
          {sent && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2.5">
              <CheckCircle size={13} className="text-green-500 shrink-0" />
              <p className="text-xs font-semibold text-green-800">
                Reminder sent to HR Ops.
              </p>
            </div>
          )}
          <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F7F8FA] border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide">
                Auto-generated Overdue Reminder
              </p>
              <div className="flex items-center gap-1 text-[10px] text-red-600 font-medium">
                <AlertTriangle size={10} /> HR tab overdue
              </div>
            </div>
            <div className="px-4 py-3 space-y-2 border-b border-border">
              {[
                ["To", "hr-ops@cloudera.com"],
                ["CC", "sarah.chen@cloudera.com"],
                [
                  "Subject",
                  "Follow-up: HR tab overdue — Globex Inc customer form (T-1023)",
                ],
              ].map(([l, v]) => (
                <div key={l as string} className="flex gap-2 text-xs">
                  <span className="text-[#9CA3AF] w-12 shrink-0">{l}:</span>
                  <span className="text-[#1F2937]">{v}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-4 text-xs text-[#374151] leading-relaxed space-y-2.5">
              <p>Hi HR team,</p>
              <p>
                Just following up on the <strong>HR tab</strong> for the Globex
                Inc customer form. The agreed ETA has passed. Could you please
                confirm when this can be returned?
              </p>
              <p>
                We have a customer deadline of <strong>Mon 26 May</strong> and
                want to ensure we have time for final review. If you need
                additional context, please reply to this email.
              </p>
              <p>
                Thank you,
                <br />
                <strong>Sarah Chen</strong>
                <br />
                GOM Analyst, Cloudera
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!sent && (
              <BtnPrimary
                onClick={() => {
                  setSent(true);
                  addLog("HR reminder sent");
                  addToast("Reminder sent.", "success");
                }}
              >
                <Send size={12} /> Send Reminder
              </BtnPrimary>
            )}
            <BtnSecondary>
              <Edit3 size={12} /> Edit Draft
            </BtnSecondary>
            <BtnSecondary onClick={() => setScreen("eta-tracking")}>
              <ArrowLeft size={11} /> Back to SME Tracking
            </BtnSecondary>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Final Review ─────────────────────────────────────────────────────

function FinalReviewScreen({
  setScreen,
  addToast,
  addLog,
  onComplete,
  smeReturned,
}: {
  setScreen: (s: Screen) => void;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  addLog: (e: string) => void;
  onComplete: () => void;
  smeReturned: boolean;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [exported, setExported] = useState(false);
  const [exporting, setExporting] = useState(false);
  const depts = ["InfoSec", "Legal", "HR", "Finance", "ESG"];

  const handleExport = () => {
    setExportModal(false);
    setExporting(true);
    addToast("Exporting response…", "info");
    setTimeout(() => {
      setExporting(false);
      setExported(true);
      addLog("Export completed");
      addToast("Response exported successfully.", "success");
    }, 1200);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        back="eta-tracking"
        backLabel="ETA Tracking"
        title="Final Review & Export — T-1023 Globex Inc"
        badge={
          reviewed && exported ? <StatusPill status="Completed" /> : undefined
        }
        setScreen={setScreen}
      />
      <WorkflowStepper current="final-review" />
      <div className="flex-1 overflow-auto px-8 py-7">
        <div className="max-w-3xl mx-auto flex flex-col gap-5">
          {!smeReturned && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3.5 flex items-start gap-2.5">
              <AlertTriangle
                size={14}
                className="text-yellow-500 shrink-0 mt-0.5"
              />
              <p className="text-xs text-yellow-700">
                Not all SME tabs have been returned. Go back to{" "}
                <button
                  onClick={() => setScreen("eta-tracking")}
                  className="underline font-semibold"
                >
                  ETA Tracking
                </button>{" "}
                and click <strong>Simulate SME Tabs Returned</strong> to unlock
                final review.
              </p>
            </div>
          )}
          <div className="bg-white rounded-lg border border-border shadow-sm p-4">
            <h3 className="text-xs font-bold text-[#1F2937] mb-3 flex items-center gap-1.5">
              <CheckSquare size={13} className="text-[#F96702]" /> Completeness
              Checklist
            </h3>
            <div className="space-y-2">
              {depts.map((d) => (
                <div
                  key={d}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md border ${smeReturned ? "bg-green-50 border-green-100" : "bg-gray-50 border-border"}`}
                >
                  {smeReturned ? (
                    <CheckCircle
                      size={13}
                      className="text-green-500 shrink-0"
                    />
                  ) : (
                    <div className="w-3 h-3 rounded-full border-2 border-gray-300 shrink-0" />
                  )}
                  <span
                    className={`text-xs font-medium ${smeReturned ? "text-green-800" : "text-[#9CA3AF]"}`}
                  >
                    {d} — {smeReturned ? "Received" : "Awaiting"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-border shadow-sm p-4">
            <h3 className="text-xs font-bold text-[#1F2937] mb-2.5 flex items-center gap-1.5">
              <Shield size={13} className="text-[#F96702]" /> Outstanding
              Warnings
            </h3>
            {smeReturned ? (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-green-50 border border-green-100">
                <CheckCircle size={12} className="text-green-500" />
                <span className="text-xs text-green-700 font-medium">
                  None — all checks passed.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-yellow-50 border border-yellow-100">
                <AlertTriangle size={12} className="text-yellow-500" />
                <span className="text-xs text-yellow-700">
                  Waiting for SME tab returns.
                </span>
              </div>
            )}
          </div>
          <div className="bg-[#FFF1E6] border border-[#F96702]/20 rounded-lg p-3.5 flex items-start gap-2.5">
            <Info size={13} className="text-[#F96702] shrink-0 mt-0.5" />
            <p className="text-xs text-[#D95400]">
              {smeReturned
                ? "All sections are complete. Final analyst review is required before export."
                : "Export unavailable until all SME sections are received."}
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap items-center">
            <button
              disabled={!smeReturned}
              onClick={() => {
                if (!smeReturned) return;
                setReviewed(true);
                addLog("Final review complete");
                addToast("Final review complete.", "success");
              }}
              className={`flex items-center gap-1.5 px-5 py-2 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase transition-all ${!smeReturned ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : reviewed ? "bg-green-600 text-white shadow-sm" : "bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.3)] hover:shadow-[0_4px_16px_rgba(249,103,2,0.45)]"}`}
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
              onClick={() => {
                if (!reviewed) return;
                setExportModal(true);
              }}
              className={`flex items-center gap-1.5 px-5 py-2 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase transition-all ${!reviewed ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : exported ? "bg-green-600 text-white shadow-sm" : exporting ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : "border border-[rgba(0,0,0,0.18)] text-[#374151] hover:border-[#F96702]/60 hover:text-[#F96702]"}`}
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
                if (!exported) return;
                onComplete();
                addToast("Ticket status updated to Completed.", "success");
                setTimeout(() => setScreen("dashboard"), 600);
              }}
              className={`flex items-center gap-1.5 px-5 py-2 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase transition-all ${!exported ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : "bg-[#0A0A0A] text-white hover:bg-[#222]"}`}
            >
              <RefreshCw size={11} /> Update Ticket Status
            </button>
            {!smeReturned && (
              <p className="text-[10px] text-[#9CA3AF] w-full font-medium">
                Export unavailable until all SME sections are received.
              </p>
            )}
          </div>
        </div>
      </div>
      {exportModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-5 w-80">
            <h3 className="text-sm font-semibold text-[#1F2937] mb-1">
              Confirm Export
            </h3>
            <p className="text-xs text-[#6B7280] mb-4">
              Export the completed response package for Globex Inc (T-1023)?
            </p>
            <div className="bg-[#F7F8FA] rounded-md p-3 border border-border mb-4 space-y-1 text-xs">
              <p>
                <strong>Customer:</strong> Globex Inc
              </p>
              <p>
                <strong>NDA status:</strong> No NDA
              </p>
              <p>
                <strong>File:</strong> Globex_Response_T1023.zip
              </p>
              <p>
                <strong>Sections:</strong> InfoSec, Legal, HR, Finance, ESG
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <BtnSecondary onClick={() => setExportModal(false)}>
                Cancel
              </BtnSecondary>
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

// ─── Screen: Login (lightweight demo auth, not real authentication) ────────────

function LoginScreen({ onLogin }: { onLogin: (name: string) => void }) {
  const [name, setName] = useState("");

  function handleSubmit() {
    const trimmed = name.trim();
    if (trimmed) onLogin(trimmed);
  }

  return (
    <div
      className="h-screen w-screen flex items-center justify-center bg-[#F5F4F1]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-10 w-[380px] flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#F96702] flex items-center justify-center shadow-[0_2px_12px_rgba(249,103,2,0.4)]">
            <span className="text-white text-lg font-black">C</span>
          </div>
          <div className="text-center">
            <p className="text-[#0A0A0A] text-base font-bold tracking-tight">
              Cloudera GOM
            </p>
            <p className="text-[#9CA3AF] text-[10px] tracking-[0.14em] uppercase font-bold mt-0.5">
              Customer Form Workflow Hub
            </p>
          </div>
        </div>

        {/* Name input */}
        <div className="w-full flex flex-col gap-2">
          <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-[0.12em]">
            Analyst Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="Enter your name to continue"
            autoFocus
            className="w-full px-4 py-3 text-sm border border-[rgba(0,0,0,0.12)] rounded-xl bg-[#FAFAF9] placeholder-[#B0B0B0] focus:outline-none focus:ring-2 focus:ring-[#F96702]/30 focus:border-[#F96702]/50 focus:bg-white transition-all"
          />
        </div>

        {/* Enter button */}
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 text-[11px] font-bold tracking-[0.07em] uppercase rounded-xl transition-all ${name.trim() ? "bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.3)]" : "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed"}`}
        >
          Enter Workspace <ChevronRight size={13} />
        </button>

        <p className="text-[10px] text-[#9CA3AF] text-center leading-relaxed">
          Internal GOM tool · Demo sign-in for prototype
        </p>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [intakeComplete, setIntakeComplete] = useState(false);
  const [smeReturned, setSmeReturned] = useState(false);
  const [ticketCompleted, setTicketCompleted] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const idRef = useRef(0);

  const addToast = (message: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now() + ++idRef.current;
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  };
  const removeToast = (id: number) =>
    setToasts((p) => p.filter((t) => t.id !== id));
  const addLog = (e: string) => setLog((p) => [...p, e]);

  // Not logged in → show the login screen
  if (!currentUser) {
    return <LoginScreen onLogin={(name) => setCurrentUser(name)} />;
  }

  return (
    <div
      className="h-screen w-screen flex overflow-hidden bg-[#F5F4F1]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <Sidebar
        screen={screen}
        setScreen={setScreen}
        currentUser={currentUser}
        onLogout={() => setCurrentUser(null)}
      />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {screen === "dashboard" && (
          <DashboardScreen
            setScreen={setScreen}
            ticketCompleted={ticketCompleted}
          />
        )}
        {screen === "intake-upload" && (
          <IntakeUploadScreen
            setScreen={setScreen}
            addToast={addToast}
            addLog={addLog}
          />
        )}
        {screen === "intake-check" && (
          <IntakeCheckScreen
            setScreen={setScreen}
            intakeComplete={intakeComplete}
            addToast={addToast}
            addLog={addLog}
            onSimulateReply={() => setIntakeComplete(true)}
          />
        )}
        {screen === "clarification-email" && (
          <ClarificationEmailScreen
            setScreen={setScreen}
            onSimulateReply={() => setIntakeComplete(true)}
            addToast={addToast}
            addLog={addLog}
          />
        )}
        {screen === "question-extraction" && (
          <QuestionExtractionScreen setScreen={setScreen} addLog={addLog} />
        )}
        {screen === "answer-review" && (
          <AnswerReviewScreen
            setScreen={setScreen}
            addToast={addToast}
            addLog={addLog}
          />
        )}
        {screen === "sme-package" && (
          <SMEPackageScreen
            setScreen={setScreen}
            addToast={addToast}
            addLog={addLog}
          />
        )}
        {screen === "eta-tracking" && (
          <ETATrackingScreen
            setScreen={setScreen}
            addToast={addToast}
            addLog={addLog}
            smeReturned={smeReturned}
            setSmeReturned={setSmeReturned}
          />
        )}
        {screen === "reminder-email" && (
          <ReminderEmailScreen
            setScreen={setScreen}
            addToast={addToast}
            addLog={addLog}
          />
        )}
        {screen === "final-review" && (
          <FinalReviewScreen
            setScreen={setScreen}
            addToast={addToast}
            addLog={addLog}
            onComplete={() => setTicketCompleted(true)}
            smeReturned={smeReturned}
          />
        )}
      </main>
      <Toast toasts={toasts} remove={removeToast} />
    </div>
  );
}
