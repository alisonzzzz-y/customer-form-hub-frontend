import React, { useState } from "react";
import {
  User,
  Globe,
  Bell,
  PenLine,
  Save,
  RotateCcw,
  Info,
} from "lucide-react";
import { ToastMsg } from "../data/model";
import { BtnPrimary, BtnSecondary } from "../components/ui";

const STORAGE_KEY = "gom-settings";

type Settings = {
  displayName: string;
  email: string;
  timezone: string;
  overdueAlerts: boolean;
  smeReturnedAlerts: boolean;
  dailyDigest: boolean;
  signature: string;
};

const DEFAULTS: Settings = {
  displayName: "Sarah Chen",
  email: "sarah.chen@cloudera.com",
  timezone: "UTC",
  overdueAlerts: true,
  smeReturnedAlerts: true,
  dailyDigest: false,
  signature: "Sarah Chen\nGOM Analyst, Cloudera",
};

const TIMEZONES = [
  "UTC",
  "Europe/Dublin",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Singapore",
  "Australia/Sydney",
];

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // Use default settings if saved data cannot be read.
  }
  return DEFAULTS;
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2.5 cursor-pointer group">
      <div>
        <p className="text-[13px] font-medium text-[#1F2937]">{label}</p>
        <p className="text-[11px] text-[#9CA3AF] mt-0.5">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${checked ? "bg-[#F96702]" : "bg-[#D8D5D0] group-hover:bg-[#C8C5C0]"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`}
        />
      </button>
    </label>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-border shadow-sm p-4">
      <h3 className="text-[13px] font-bold text-[#1F2937] mb-3 flex items-center gap-1.5">
        <Icon size={13} className="text-[#F96702]" /> {title}
      </h3>
      {children}
    </div>
  );
}

export function SettingsPage({
  onBack,
  addToast,
  addLog,
}: {
  onBack: () => void;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  addLog: (e: string) => void;
}) {
  const [saved, setSaved] = useState<Settings>(loadSettings);
  const [form, setForm] = useState<Settings>(saved);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const setField = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const save = () => {
    if (!form.displayName.trim()) {
      addToast("Display name cannot be empty.", "warning");
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    setSaved(form);
    addLog("Settings updated");
    addToast("Settings saved.", "success");
  };

  const reset = () => {
    setForm(DEFAULTS);
    addToast("Restored default settings — click Save to apply.", "info");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 sm:px-8 pt-7 pb-5 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-7 bg-[#F96702] rounded-full shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">
              Settings
            </h1>
            <p className="text-sm text-[#6B7280] mt-0.5 font-normal">
              Analyst preferences for this workspace
            </p>
          </div>
        </div>
        {dirty && (
          <span className="text-[11px] font-semibold text-[#C05600] bg-[#FFF4EC] border border-[#F96702]/25 rounded-full px-3 py-1">
            Unsaved changes
          </span>
        )}
      </div>
      <div className="flex-1 overflow-auto px-4 sm:px-8 py-7">
        <div className="max-w-2xl mx-auto flex flex-col gap-5">
          <SectionCard icon={User} title="Profile">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-[#6B7280] mb-1 block">
                  Display Name
                </label>
                <input
                  className="w-full border border-border rounded-md px-2.5 py-1.5 text-[13px]"
                  value={form.displayName}
                  onChange={(e) => setField("displayName", e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#6B7280] mb-1 block">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full border border-border rounded-md px-2.5 py-1.5 text-[13px]"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
              </div>
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-2 flex items-center gap-1">
              <Info size={10} /> Role is assigned by your admin: GOM Analyst
            </p>
          </SectionCard>

          <SectionCard icon={Globe} title="Region & Time">
            <label className="text-[11px] font-medium text-[#6B7280] mb-1 block">
              Preferred Timezone
            </label>
            <select
              className="w-full border border-border rounded-md px-2.5 py-1.5 text-[13px] bg-white"
              value={form.timezone}
              onChange={(e) => setField("timezone", e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#9CA3AF] mt-2 flex items-center gap-1">
              <Info size={10} /> ETAs and deadlines are stored in UTC; this
              controls how they will be displayed for you.
            </p>
          </SectionCard>

          <SectionCard icon={Bell} title="Notifications">
            <div className="divide-y divide-border">
              <ToggleRow
                label="Overdue SME alerts"
                hint="Notify me when an SME tab passes its ETA"
                checked={form.overdueAlerts}
                onChange={(v) => setField("overdueAlerts", v)}
              />
              <ToggleRow
                label="SME return alerts"
                hint="Notify me when an SME tab is returned"
                checked={form.smeReturnedAlerts}
                onChange={(v) => setField("smeReturnedAlerts", v)}
              />
              <ToggleRow
                label="Daily digest"
                hint="A morning summary of all my open tickets"
                checked={form.dailyDigest}
                onChange={(v) => setField("dailyDigest", v)}
              />
            </div>
          </SectionCard>

          <SectionCard icon={PenLine} title="Email Signature">
            <textarea
              rows={3}
              className="w-full border border-border rounded-md px-2.5 py-1.5 text-[13px] resize-y"
              value={form.signature}
              onChange={(e) => setField("signature", e.target.value)}
            />
            <p className="text-[11px] text-[#9CA3AF] mt-2 flex items-center gap-1">
              <Info size={10} /> Used at the bottom of clarification, SME and
              reminder email drafts.
            </p>
          </SectionCard>

          <div className="flex gap-2">
            <BtnPrimary onClick={save} disabled={!dirty}>
              <Save size={12} /> Save Settings
            </BtnPrimary>
            <BtnSecondary onClick={reset}>
              <RotateCcw size={12} /> Restore Defaults
            </BtnSecondary>
            <BtnSecondary onClick={onBack}>
              Back to Ticket Queue
            </BtnSecondary>
          </div>
        </div>
      </div>
    </div>
  );
}
