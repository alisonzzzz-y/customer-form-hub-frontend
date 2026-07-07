import { useState } from "react";
import {
  FileSpreadsheet,
  Mail,
  Info,
  Download,
  Loader2,
  Send,
  Edit3,
  Clock,
  ArrowLeft,
  ChevronRight,
  CheckCircle,
} from "lucide-react";
import { Screen, ToastMsg } from "../types";
import {
  PageHeader,
  WorkflowStepper,
  BtnPrimary,
  BtnSecondary,
} from "../components/shared";

// ─── Screen: SME Package & Email ──────────────────────────────────────────────

export function SMEPackageScreen({
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
  const [sentTeams, setSentTeams] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
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
  const defaultBody = (team: string, count: number) =>
    `Hi ${team} Team,

We have received a security questionnaire from Globex Inc and need your input on the ${team} tab of the attached Excel.

Customer: Globex Inc
NDA status: No NDA — do not share NDA-restricted materials
Deadline: Mon 26 May 2025
Your tab: ${team} (${count} questions)
Attached: Globex_SME_Request.xlsx

Please complete your tab and reply with your ETA. If any question is outside your scope, note it in the answer column.

Thank you,
Sarah Chen, GOM Analyst`;
  const tabCount = (label: string) =>
    tabs.find((t) => t.label === label)?.count ?? 0;
  const sentCount = tabs.filter((t) => sentTeams[t.label]).length;
  const sendCurrent = () => {
    const updated = { ...sentTeams, [excelTab]: true };
    setSentTeams(updated);
    addLog(`SME package sent to ${excelTab} Team`);
    if (tabs.every((t) => updated[t.label])) {
      addToast(
        "All 5 SME emails sent — continue to ETA Tracking.",
        "success",
      );
    } else {
      addToast(`SME email sent to ${excelTab} Team.`, "success");
    }
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
                  onClick={() => {
                    setExcelTab(t.label);
                    setEditing(false);
                  }}
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
                {drafts[excelTab] && !editing && (
                  <span className="ml-1.5 font-medium text-[#9CA3AF]">
                    (edited)
                  </span>
                )}
              </p>
              {sentTeams[excelTab] && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-green-600 font-medium">
                  <CheckCircle size={10} /> Sent
                </span>
              )}
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
            {editing ? (
              <textarea
                className="mx-3.5 my-3 flex-1 border border-border rounded-md p-2.5 text-[10px] text-[#374151] leading-relaxed resize-none focus:outline-none focus:border-[#F96702]/50"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
              />
            ) : drafts[excelTab] ? (
              <div className="px-3.5 py-3 text-[10px] text-[#374151] leading-relaxed whitespace-pre-wrap flex-1 overflow-auto">
                {drafts[excelTab]}
              </div>
            ) : (
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
            )}
            <div className="px-3.5 py-2.5 border-t border-border bg-[#F7F8FA] flex gap-1.5">
              {editing ? (
                <>
                  <button
                    onClick={() => {
                      setDrafts((p) => ({ ...p, [excelTab]: draftText }));
                      setEditing(false);
                      addToast(`Draft updated for ${excelTab} Team.`, "info");
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold bg-[#F96702] text-white rounded-full hover:bg-[#D95400] flex-1 justify-center shadow-[0_2px_8px_rgba(249,103,2,0.25)] tracking-[0.06em] uppercase transition-all"
                  >
                    <CheckCircle size={10} /> Save Draft
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold border border-[rgba(0,0,0,0.15)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] transition-all"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={sendCurrent}
                    disabled={sentTeams[excelTab]}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold rounded-full flex-1 justify-center tracking-[0.06em] uppercase transition-all ${sentTeams[excelTab] ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : "bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.25)]"}`}
                  >
                    {sentTeams[excelTab] ? (
                      <>
                        <CheckCircle size={10} /> Sent to {excelTab} Team
                      </>
                    ) : (
                      <>
                        <Send size={10} /> Send to {excelTab} Team ({sentCount}
                        /5 sent)
                      </>
                    )}
                  </button>
                  {!sentTeams[excelTab] && (
                    <button
                      onClick={() => {
                        setDraftText(
                          drafts[excelTab] ??
                            defaultBody(excelTab, tabCount(excelTab)),
                        );
                        setEditing(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold border border-[rgba(0,0,0,0.15)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] transition-all"
                    >
                      <Edit3 size={10} /> Edit
                    </button>
                  )}
                  <button
                    onClick={() =>
                      addToast(
                        "Use Record ETA on the ETA Tracking screen.",
                        "info",
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold border border-[rgba(0,0,0,0.15)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] transition-all"
                  >
                    <Clock size={10} /> Record ETA
                  </button>
                </>
              )}
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
