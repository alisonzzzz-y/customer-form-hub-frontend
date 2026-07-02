import { useState } from "react";
import {
  AlertTriangle,
  CheckSquare,
  Shield,
  CheckCircle,
  Info,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Screen, ToastMsg } from "../types";
import {
  PageHeader,
  WorkflowStepper,
  BtnSecondary,
  BtnPrimary,
  StatusPill,
} from "../components/shared";
import { updateTicketStatus, Ticket } from "../api";

// ─── Screen: Final Review ─────────────────────────────────────────────────────

export function FinalReviewScreen({
  setScreen,
  addToast,
  addLog,
  onComplete,
  smeReturned,
  activeTicket,
}: {
  setScreen: (s: Screen) => void;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  addLog: (e: string) => void;
  onComplete: () => void;
  smeReturned: boolean;
  activeTicket: Ticket | null;
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
              onClick={async () => {
                if (!exported) return;
                if (!activeTicket) {
                  addToast("No ticket selected to update.", "warning");
                  return;
                }
                try {
                  await updateTicketStatus(activeTicket.id, "Completed");
                  onComplete();
                  addLog(
                    `Ticket ${activeTicket.customerName} marked Completed`,
                  );
                  addToast("Ticket status updated to Completed.", "success");
                  setTimeout(() => setScreen("dashboard"), 600);
                } catch (error) {
                  console.error("Failed to update ticket status:", error);
                  addToast("Failed to update ticket status.", "warning");
                }
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
