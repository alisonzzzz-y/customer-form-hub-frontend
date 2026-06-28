import { useState } from "react";
import { CheckCircle, RefreshCw, Send, Edit3, ArrowLeft } from "lucide-react";
import { Screen, ToastMsg } from "../types";
import {
  PageHeader,
  WorkflowStepper,
  BtnPrimary,
  BtnSecondary,
} from "../components/shared";

// ─── Screen: Clarification Email ──────────────────────────────────────────────

export function ClarificationEmailScreen({
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
