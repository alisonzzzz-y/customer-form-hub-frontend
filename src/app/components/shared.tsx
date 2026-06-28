import React, { useState } from "react";
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
  Info,
  User,
  ArrowLeft,
  X,
  Activity,
  ChevronDown,
} from "lucide-react";
import { Screen, ToastMsg } from "../types";

// ─── Shared primitives ────────────────────────────────────────────────────────

export function StatusPill({ status }: { status: string }) {
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

export function UrgencyPill({ urgency }: { urgency: string }) {
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

export function BtnPrimary({
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

export function BtnSecondary({
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

export function Toast({
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

export function WorkflowStepper({ current }: { current: Screen }) {
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

export function Sidebar({
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

export function ActivityLog({ entries }: { entries: string[] }) {
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

export function PageHeader({
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
