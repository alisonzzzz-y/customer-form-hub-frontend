import { useRef, useState } from "react";
import {
  Mail,
  FileSpreadsheet,
  Info,
  CheckCircle,
  Brain,
  Loader2,
} from "lucide-react";
import { Screen, ToastMsg } from "../types";
import { PageHeader, WorkflowStepper } from "../components/shared";

export function IntakeUploadScreen({
  setScreen,
  addToast,
  addLog,
}: {
  setScreen: (s: Screen) => void;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  addLog: (e: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState({
    name: "Globex_Security_Q.xlsx",
    size: "142 KB",
    detail: "36 questions detected",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFilePicked = (picked: File) => {
    setFile({
      name: picked.name,
      size: `${Math.max(1, Math.round(picked.size / 1024))} KB`,
      detail: "Pending extraction",
    });
    addLog(`Form replaced: ${picked.name}`);
    addToast(`Attached ${picked.name}.`, "info");
  };
  const handleExtract = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      addLog("Intake uploaded");
      addToast("Extraction complete. 4 fields require attention.", "warning");
      setScreen("intake-check");
    }, 1400);
  };
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        back="dashboard"
        backLabel="Dashboard"
        title="New Request — Upload & Extract"
        subtitle="Paste the incoming email and upload the customer form to begin."
        setScreen={setScreen}
      />
      <WorkflowStepper current="intake-upload" />
      <div className="flex-1 overflow-auto px-8 py-7">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 flex flex-col gap-4 min-h-[280px]">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-[#F96702]" />
                <p className="text-xs font-bold text-[#0A0A0A] tracking-[-0.01em]">
                  Paste Incoming Email
                </p>
              </div>
              <div className="bg-[#F5F4F1] border border-[rgba(0,0,0,0.06)] rounded-xl p-4 flex-1">
                <div className="flex items-center gap-2 mb-2.5 pb-2.5 border-b border-border">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[9px] font-bold shrink-0">
                    J
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#1F2937]">
                      Jane Smith &lt;jane.smith@globexinc.com&gt;
                    </p>
                    <p className="text-[10px] text-[#9CA3AF]">
                      To: gom-team@cloudera.com · Mon 19 May, 09:07
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[#374151] leading-relaxed italic">
                  "Hi GOM team, could you complete the attached security
                  questionnaire for Globex Inc? Customer needs this soon.
                  Thanks, Jane."
                </p>
              </div>
              <p className="text-[10px] text-[#9CA3AF] flex items-center gap-1">
                <Info size={10} /> Email pre-loaded for prototype
              </p>
            </div>
            <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 flex flex-col gap-4 min-h-[280px]">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={14} className="text-[#F96702]" />
                <p className="text-xs font-bold text-[#0A0A0A] tracking-[-0.01em]">
                  Attached Customer Form
                </p>
              </div>
              <div className="border-2 border-dashed border-[#F96702]/30 rounded-xl bg-[#FFF8F4] p-8 flex flex-col items-center justify-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <FileSpreadsheet size={18} className="text-green-600" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-[#1F2937]">
                    {file.name}
                  </p>
                  <p className="text-[10px] text-[#6B7280] mt-0.5">
                    Excel · {file.size} · {file.detail}
                  </p>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 bg-green-50 border border-green-200 rounded-md">
                  <CheckCircle size={11} className="text-green-500" />
                  <span className="text-[10px] text-green-700 font-medium">
                    File attached
                  </span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const picked = e.target.files?.[0];
                  if (picked) handleFilePicked(picked);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-border rounded-md text-[10px] text-[#6B7280] hover:border-[#F96702]/40 hover:text-[#F96702]"
              >
                Replace or upload different file
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-5">
            <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.14em] mb-3">
              Sources for Extraction
            </p>
            <div className="flex gap-3">
              {[
                {
                  icon: Mail,
                  label: "Email from Jane Smith",
                  detail: "Mon 19 May, 09:07",
                },
                {
                  icon: FileSpreadsheet,
                  label: file.name,
                  detail: `${file.size} · ${file.detail}`,
                },
              ].map(({ icon: Icon, label, detail }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#F7F8FA] border border-border flex-1"
                >
                  <Icon size={13} className="text-[#6B7280] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#1F2937] truncate">
                      {label}
                    </p>
                    <p className="text-[10px] text-[#9CA3AF]">{detail}</p>
                  </div>
                  <CheckCircle size={12} className="text-green-500 shrink-0" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleExtract}
              disabled={loading}
              className={`flex items-center gap-2 px-6 py-2.5 text-[10px] font-bold tracking-[0.07em] rounded-full transition-all ${loading ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : "bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.3)] hover:shadow-[0_4px_16px_rgba(249,103,2,0.45)]"}`}
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Extracting
                  intake information…
                </>
              ) : (
                <>
                  <Brain size={13} /> Extract Intake Information
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
