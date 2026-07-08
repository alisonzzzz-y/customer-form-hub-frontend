import {
  Mail,
  Brain,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Screen, ToastMsg } from "../types";
import {
  PageHeader,
  WorkflowStepper,
  BtnPrimary,
  StatusPill,
  ActivityLog,
} from "../components/shared";

// ─── Screen: Intake Check ─────────────────────────────────────────────────────

export function IntakeCheckScreen({
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
            {!intakeComplete && (
              <BtnPrimary onClick={() => setScreen("clarification-email")}>
                <Mail size={12} /> Generate Clarification Email
              </BtnPrimary>
            )}
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
