import { useState } from "react";
import { Brain, ChevronRight, Edit3 } from "lucide-react";
import { Screen } from "../types";
import {
  PageHeader,
  WorkflowStepper,
  BtnPrimary,
  BtnSecondary,
  StatusPill,
} from "../components/shared";

// ─── Screen: Question Extraction ──────────────────────────────────────────────

export function QuestionExtractionScreen({
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
