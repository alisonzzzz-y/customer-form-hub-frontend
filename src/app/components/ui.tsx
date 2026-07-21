import React from "react";
import { AlertTriangle as ToastWarn, CheckCircle as ToastOk, Info as ToastInfo, X as ToastX } from "lucide-react";

// Opens a pre-filled draft in the user's mail client (Outlook/Gmail via the
// OS handler). Browsers cannot attach files through mailto: — callers should
// remind the user to attach any downloaded Excel manually.
export function openMailDraft(to: string, subject: string, body: string) {
  const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
}
import { AlertTriangle, Lock, Globe2, Building2 } from "lucide-react";
import { SharingStatus, ToastMsg, confidenceBand } from "../data/model";

// Small presentational pieces shared across MVP pages.

// Status colours follow the design system doc (06 §6.1): Info for new/AI,
// Warning for review states, Danger for overdue, Success for approved/sent.
const STATUS_STYLES: Record<string, string> = {
  // ticket
  New: "bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]",
  "AI Processing": "bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]",
  "Intake Review": "bg-[#FFF4EC] text-[#C05600] border-[#F96702]/25",
  "In Progress": "bg-[#1A1A1A] text-white border-transparent",
  "Waiting SME": "bg-[#FEFCE8] text-[#854D0E] border-[#FDE68A]",
  "Ready for Review": "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  Approved: "bg-[#16A34A] text-white border-transparent",
  Sent: "bg-[#16A34A] text-white border-transparent",
  Closed: "bg-[#F5F5F5] text-[#374151] border-[rgba(0,0,0,0.1)]",
  Archived: "bg-[#FAFAFA] text-[#1F2937] border-[rgba(0,0,0,0.06)]",
  // question
  "AI Analysed": "bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]",
  Suggested: "bg-[#FFF4EC] text-[#C05600] border-[#F96702]/25",
  "Needs Review": "bg-[#FEFCE8] text-[#854D0E] border-[#FDE68A]",
  "SME Queued": "bg-[#FFF4EC] text-[#C05600] border-[#F96702]/25",
  "SME Complete": "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  Ready: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  Rejected: "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]/50",
  // sme
  Requested: "bg-[#F5F5F5] text-[#374151] border-[rgba(0,0,0,0.1)]",
  "ETA Set": "bg-[#FFF4EC] text-[#C05600] border-[#F96702]/25",
  Returned: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  Overdue: "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]/50",
  Escalated: "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]/50",
  // knowledge
  Draft: "bg-[#F5F5F5] text-[#374151] border-[rgba(0,0,0,0.1)]",
  "Pending Review": "bg-[#FEFCE8] text-[#854D0E] border-[#FDE68A]",
  Deprecated: "bg-[#FAFAFA] text-[#1F2937] border-[rgba(0,0,0,0.06)]",
};

export function Pill({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-[0.08em] uppercase border whitespace-nowrap ${STATUS_STYLES[value] ?? "bg-[#F5F5F5] text-[#374151] border-[rgba(0,0,0,0.1)]"}`}
    >
      {value}
    </span>
  );
}

export function UrgencyDot({ urgency }: { urgency: string }) {
  const color =
    urgency === "High" ? "bg-red-500" : urgency === "Medium" ? "bg-[#F96702]" : "bg-gray-300";
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-[#374151] whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} /> {urgency}
    </span>
  );
}

export function SharingBadge({ status }: { status: SharingStatus }) {
  const map: Record<SharingStatus, { cls: string; icon: React.ReactNode }> = {
    Public: {
      cls: "bg-[#F5F5F5] text-[#374151] border-[rgba(0,0,0,0.1)]",
      icon: <Globe2 size={9} />,
    },
    Internal: {
      cls: "bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]",
      icon: <Building2 size={9} />,
    },
    "NDA Required": {
      cls: "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]/50",
      icon: <Lock size={9} />,
    },
  };
  const m = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-[0.08em] uppercase border whitespace-nowrap ${m.cls}`}
    >
      {m.icon} {status}
    </span>
  );
}

// PRD §9.1: colour-coded confidence
export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  const band = confidenceBand(confidence);
  if (band === "none")
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1F2937] whitespace-nowrap">
        <AlertTriangle size={10} /> Research required
      </span>
    );
  const pct = Math.round((confidence as number) * 100);
  const cls =
    band === "high"
      ? "text-green-700 bg-green-50 border-green-200"
      : band === "medium"
        ? "text-[#854D0E] bg-[#FEFCE8] border-[#FDE68A]"
        : "text-[#991B1B] bg-[#FEF2F2] border-[#FCA5A5]/50";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-bold border whitespace-nowrap ${cls}`}
    >
      {pct}%
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: React.ElementType;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="w-10 h-10 rounded-lg bg-[#FFF4EC] flex items-center justify-center">
        <Icon size={18} className="text-[#F96702]" />
      </div>
      <p className="text-[13px] font-semibold text-[#1F2937]">{title}</p>
      {hint && <p className="text-[13px] text-[#1F2937] max-w-xs">{hint}</p>}
      {action}
    </div>
  );
}

export function Card({
  title,
  right,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-sm ${className}`}>
      {title !== undefined && (
        <div className="px-5 py-3 bg-[#F96702] rounded-t-xl flex items-center gap-2 shadow-[0_1px_4px_rgba(249,103,2,0.25)]">
          <p className="text-[12px] font-bold text-white uppercase tracking-[0.08em] flex-1">
            {title}
          </p>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 text-[12px] font-bold text-[#374151] uppercase tracking-wide whitespace-nowrap bg-[#F7F8FA] border-b border-border">
      {children}
    </th>
  );
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border rounded-full px-3 py-1.5 text-[12px] font-semibold bg-white transition-all ${value === "All" ? "border-[rgba(0,0,0,0.15)] text-[#374151]" : "border-[#F96702]/50 text-[#C05600]"}`}
    >
      <option value="All">{label}: All</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {label}: {o}
        </option>
      ))}
    </select>
  );
}


// ─── App primitives (internalized from the retired legacy shared.tsx) ────────

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
      className={`flex items-center gap-2 px-5 py-2 text-[12px] font-bold tracking-[0.07em] rounded-full transition-all ${disabled ? "bg-[#E8E6E3] text-[#1F2937] cursor-not-allowed" : "bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.3)] hover:shadow-[0_4px_16px_rgba(249,103,2,0.45)]"} ${className}`}
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
      className={`flex items-center gap-2 px-5 py-2 text-[12px] font-semibold tracking-[0.04em] border border-[rgba(0,0,0,0.18)] rounded-full text-[#374151] hover:border-[#F96702]/60 hover:text-[#F96702] transition-all ${className}`}
    >
      {children}
    </button>
  );
}

export function Toast({
  toasts,
  remove,
}: {
  toasts: ToastMsg[];
  remove: (id: number) => void;
}) {
  return (
    <div className="fixed top-16 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border text-[12px] font-medium min-w-[280px] max-w-xs bg-white ${t.type === "success" ? "border-green-200" : t.type === "warning" ? "border-[#F96702]/30" : "border-[rgba(0,0,0,0.08)]"}`}
        >
          {t.type === "success" && <ToastOk size={13} className="text-green-500 shrink-0" />}
          {t.type === "warning" && <ToastWarn size={13} className="text-[#F96702] shrink-0" />}
          {t.type === "info" && <ToastInfo size={13} className="text-[#374151] shrink-0" />}
          <span className="flex-1 text-[#1F2937]">{t.message}</span>
          <button onClick={() => remove(t.id)} className="text-gray-600 hover:text-gray-600">
            <ToastX size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}
