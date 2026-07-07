import { useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  Send,
  Edit3,
  ArrowLeft,
} from "lucide-react";
import { Screen, ToastMsg } from "../types";
import {
  PageHeader,
  WorkflowStepper,
  BtnPrimary,
  BtnSecondary,
  StatusPill,
} from "../components/shared";

// ─── Screen: Reminder Email ───────────────────────────────────────────────────

const DEFAULT_BODY = `Hi HR team,

Just following up on the HR tab for the Globex Inc customer form. The agreed ETA has passed. Could you please confirm when this can be returned?

We have a customer deadline of Mon 26 May and want to ensure we have time for final review. If you need additional context, please reply to this email.

Thank you,
Sarah Chen
GOM Analyst, Cloudera`;

export function ReminderEmailScreen({
  setScreen,
  addToast,
  addLog,
}: {
  setScreen: (s: Screen) => void;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  addLog: (e: string) => void;
}) {
  const [sent, setSent] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
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
            {editing ? (
              <textarea
                className="w-full min-h-[220px] px-4 py-4 text-xs text-[#374151] leading-relaxed resize-y focus:outline-none"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
              />
            ) : body ? (
              <div className="px-4 py-4 text-xs text-[#374151] leading-relaxed whitespace-pre-wrap">
                {body}
              </div>
            ) : (
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
            )}
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <BtnPrimary
                  onClick={() => {
                    setBody(draftText);
                    setEditing(false);
                    addToast("Draft updated.", "info");
                  }}
                >
                  <CheckCircle size={12} /> Save Draft
                </BtnPrimary>
                <BtnSecondary onClick={() => setEditing(false)}>
                  Cancel
                </BtnSecondary>
              </>
            ) : (
              <>
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
                {!sent && (
                  <BtnSecondary
                    onClick={() => {
                      setDraftText(body ?? DEFAULT_BODY);
                      setEditing(true);
                    }}
                  >
                    <Edit3 size={12} /> Edit Draft
                  </BtnSecondary>
                )}
                <BtnSecondary onClick={() => setScreen("eta-tracking")}>
                  <ArrowLeft size={11} /> Back to ETA Tracking
                </BtnSecondary>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
