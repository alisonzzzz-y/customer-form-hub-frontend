import { useState } from "react";
import { Send, Clock, Bell, RefreshCw, ChevronRight } from "lucide-react";
import { Screen, ToastMsg } from "../types";
import {
  PageHeader,
  WorkflowStepper,
  BtnPrimary,
  BtnSecondary,
  StatusPill,
} from "../components/shared";

export function ETATrackingScreen({
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
