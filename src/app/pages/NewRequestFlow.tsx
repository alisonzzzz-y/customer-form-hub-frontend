import { useRef, useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle,
  ClipboardPaste,
  Loader2,
  Mail,
  Upload,
  X,
} from "lucide-react";
import { BtnPrimary, BtnSecondary } from "../components/ui";
import { MvpTicket, NdaStatus, Urgency, pendingForms } from "../data/model";
import { AppActions, AppState } from "../AppShell";
import { openMailDraft } from "../components/ui";
import { SAMPLE_AE_EMAIL, parseIntakeEmail } from "../services/simulation";

// Create a ticket from pasted request details.

export function NewRequestFlow({
  state,
  actions,
  close,
}: {
  state: AppState;
  actions: AppActions;
  close: () => void;
}) {
  const [emailText, setEmailText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [attached, setAttached] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const runExtraction = () => {
    if (!emailText.trim()) {
      actions.addToast("Paste the AE email first (or use the sample).", "warning");
      return;
    }
    setExtracting(true);
    setTimeout(() => {
      const f = parseIntakeEmail(emailText);
      const missing: string[] = [];
      if (!f.customer.trim()) missing.push("customer");
      if (!f.due) missing.push("due");
      if (!f.urgency) missing.push("urgency");
      if (!f.nda || f.nda === "Unknown") missing.push("nda");
      if (!f.businessImpact.trim()) missing.push("impact");

      const num = Math.max(...state.tickets.map((t) => parseInt(t.id.slice(3), 10))) + 1;
      const id = `TK-${num}`;
      const ticket: MvpTicket = {
        id,
        customer: f.customer.trim() || "New Customer",
        sorId: "—",
        owner: state.currentUser,
        status: "Intake Review",
        stage: "intake",
        intakeMissing: missing,
        due: f.due,
        created: new Date().toISOString().slice(0, 10),
        urgency: (f.urgency || "Medium") as Urgency,
        nda: (f.nda || "Unknown") as NdaStatus,
        region: "EMEA",
        source: "Email",
        ae: f.ae.trim() || undefined,
        aeEmail: f.aeEmail.trim() || undefined,
        businessImpact: f.businessImpact.trim() || undefined,
        notes: f.requestType ? `Request type: ${f.requestType}` : undefined,
        files: attached
          ? [{
              name: attached.name,
              size: `${Math.max(1, Math.round(attached.size / 1024))} KB`,
              kind: "Customer form",
              uploaded: new Date().toISOString().slice(0, 10),
              status: "Uploaded",
            }]
          : [],
      };
      if (attached) pendingForms.set(id, attached);
      actions.setTickets((p) => [ticket, ...p]);
      actions.logActivity("Created request from pasted AE email — intake check pending", id);
      actions.addToast(
        missing.length === 0
          ? "Intake extracted — all fields found. Review and analyse."
          : `Intake extracted — ${missing.length} field${missing.length === 1 ? "" : "s"} need attention.`,
        missing.length === 0 ? "success" : "warning",
      );
      setExtracting(false);
      close();
      actions.openTicket(id);
    }, 0);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[720px] max-h-[88vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2.5 shrink-0">
          <Mail size={15} className="text-[#F96702]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#1F2937]">New Request</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#C0BEBA] mt-0.5">
              Paste email → Intake Check → AI Analysis
            </p>
          </div>
          <button onClick={close} className="text-gray-400 hover:text-gray-600 ml-2">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 overflow-auto">
          <p className="text-[13px] text-[#6B7280]">
            Paste the email you received from the AE. AI extracts the customer, urgency, NDA
            status, deadline and deal value — you review everything on the intake check next.
          </p>
          <textarea
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            placeholder="Paste the incoming AE email here…"
            rows={10}
            autoFocus
            className="w-full border border-border rounded-lg px-3 py-2.5 text-[13px] leading-relaxed resize-y focus:outline-none focus:border-[#F96702]/50 focus:ring-2 focus:ring-[#F96702]/20 font-mono"
          />
          <button
            onClick={() => setEmailText(SAMPLE_AE_EMAIL)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[#C05600] hover:underline self-start"
          >
            <ClipboardPaste size={11} /> Use sample email (demo)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setAttached(f);
              e.target.value = "";
            }}
          />
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) setAttached(f);
            }}
            title="The attached form is parsed and its questions classified automatically once intake is confirmed"
            className={`border-2 border-dashed rounded-xl px-6 py-6 flex items-center gap-4 cursor-pointer transition-colors ${attached ? "border-green-300 bg-green-50/50" : "border-[#F96702]/30 bg-[#FFF8F4] hover:bg-[#FFF1E6]"}`}
          >
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${attached ? "bg-green-100" : "bg-[#FFE8D0]"}`}>
              {attached ? (
                <CheckCircle size={20} className="text-green-600" />
              ) : (
                <Upload size={20} className="text-[#F96702]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {attached ? (
                <>
                  <p className="text-[13px] font-semibold text-[#1F2937] truncate">{attached.name}</p>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">
                    {Math.max(1, Math.round(attached.size / 1024))} KB · will be parsed and
                    classified by AI after intake is confirmed
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[13px] font-semibold text-[#1F2937]">
                    Attach the customer form (optional)
                  </p>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">
                    Click to browse or drag the .xlsx / .docx here — questions are extracted
                    automatically after intake
                  </p>
                </>
              )}
            </div>
            {attached && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAttached(null);
                }}
                title="Remove the attached file"
                className="text-[11px] font-semibold text-[#9CA3AF] hover:text-[#F96702] shrink-0"
              >
                Remove
              </button>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <BtnSecondary onClick={close}>Cancel</BtnSecondary>
            <BtnPrimary onClick={runExtraction} disabled={extracting}>
              {extracting ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Extracting intake…
                </>
              ) : (
                <>
                  <Brain size={12} /> Extract Intake Information
                </>
              )}
            </BtnPrimary>
          </div>
        </div>
      </div>
    </div>
  );
}

// Draft an editable email asking for missing request details.
export function ClarificationEmailModal({
  customer,
  ae,
  aeEmail,
  missing,
  actions,
  close,
}: {
  customer: string;
  ae?: string;
  aeEmail?: string;
  missing: string[];
  actions: AppActions;
  close: () => void;
}) {
  const defaultBody = [
    `Hi ${ae ? ae.split(" ")[0] : "there"},`,
    "",
    "Thanks for sending this over. Before we can safely route the form, could you confirm:",
    "",
    ...missing.map((m, i) => `${i + 1}. ${m}`),
    "",
    "Once confirmed we will proceed immediately.",
    "",
    "Thank you,",
    "Sarah Chen, GOM Analyst",
  ].join("\n");

  const [to, setTo] = useState(aeEmail || "ae@cloudera.com");
  const [subject, setSubject] = useState(`RE: ${customer} request — missing intake details`);
  const [body, setBody] = useState(defaultBody);
  const [sent, setSent] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[560px] max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-4 py-2.5 bg-[#F7F8FA] border-b border-border flex items-center justify-between shrink-0">
          <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wide">
            Clarification email to AE — auto-drafted, editable
          </p>
          {sent ? (
            <span className="text-[11px] text-green-600 font-medium flex items-center gap-1">
              <CheckCircle size={10} /> Sent
            </span>
          ) : (
            <button onClick={close} className="text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="px-4 py-3 space-y-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-[#9CA3AF] w-14 shrink-0">To:</span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={sent}
              className="flex-1 border border-border rounded-md px-2 py-1 text-[13px] disabled:bg-[#F7F8FA]"
            />
          </div>
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-[#9CA3AF] w-14 shrink-0">Subject:</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sent}
              className="flex-1 border border-border rounded-md px-2 py-1 text-[13px] disabled:bg-[#F7F8FA]"
            />
          </div>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={sent}
          rows={12}
          className="flex-1 px-4 py-3 text-[13px] text-[#374151] leading-relaxed resize-none focus:outline-none disabled:bg-white"
        />
        <div className="px-4 py-3 border-t border-border flex items-center gap-2 bg-[#FAFAFA] shrink-0">
          {!sent ? (
            <>
              <span title="Opens the draft in your mail app (Outlook/Gmail) — the system never sends email itself">
                <BtnPrimary
                  onClick={() => {
                    openMailDraft(to, subject, body);
                    setSent(true);
                    actions.logActivity("Sent clarification email to AE for missing intake fields");
                    actions.addToast("Draft opened in your mail app.", "info");
                  }}
                >
                  Open in Mail App
                </BtnPrimary>
              </span>
              <BtnSecondary onClick={close}>Cancel</BtnSecondary>
            </>
          ) : (
            <>
              <p className="text-[12px] text-[#6B7280] flex items-center gap-1.5 flex-1">
                <AlertTriangle size={11} className="text-[#C05600]" />
                When the AE replies, fill the confirmed values into the intake table by hand.
              </p>
              <BtnSecondary onClick={close}>Close</BtnSecondary>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
