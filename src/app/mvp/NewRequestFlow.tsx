import { useRef, useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle,
  ChevronRight,
  ClipboardPaste,
  Loader2,
  Mail,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { BtnPrimary, BtnSecondary } from "../components/shared";
import { MvpTicket, NdaStatus, Urgency } from "./data";
import { AppActions, AppState } from "./MvpApp";
import { createBackendTicket, parseQuestionnaire, syncTicketStatus } from "./backend";
import { IntakeExtraction, SAMPLE_AE_EMAIL, extractQuestionsFor, parseIntakeEmail } from "./simulation";

// New Request flow: paste the AE email, AI extracts the intake fields, the
// analyst corrects/completes them, then question extraction runs
// automatically — no manual field-by-field entry, no separate "process" click.

type Step = "paste" | "check" | "processing";

const EMPTY: IntakeExtraction = {
  customer: "", ae: "", aeEmail: "", urgency: "", nda: "", due: "",
  businessImpact: "", requestType: "",
};

export function NewRequestFlow({
  state,
  actions,
  close,
}: {
  state: AppState;
  actions: AppActions;
  close: () => void;
}) {
  const [step, setStep] = useState<Step>("paste");
  const [emailText, setEmailText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [fields, setFields] = useState<IntakeExtraction>(EMPTY);
  const [sorId, setSorId] = useState("");
  const [region, setRegion] = useState("EMEA");
  const [attached, setAttached] = useState<File | null>(null);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const runExtraction = () => {
    if (!emailText.trim()) {
      actions.addToast("Paste the AE email first (or use the sample).", "warning");
      return;
    }
    setExtracting(true);
    setTimeout(() => {
      const parsed = parseIntakeEmail(emailText);
      setFields(parsed);
      setExtracting(false);
      setStep("check");
      const missing = countMissing(parsed);
      actions.addToast(
        missing === 0
          ? "Intake extracted — all required fields found."
          : `Intake extracted — ${missing} field${missing === 1 ? "" : "s"} need attention.`,
        missing === 0 ? "success" : "warning",
      );
      // Missing required info → auto-draft the clarification email to the AE
      if (missing > 0) setClarifyOpen(true);
    }, 1100);
  };

  const countMissing = (f: IntakeExtraction) =>
    [f.customer, f.due, f.urgency, f.nda && f.nda !== "Unknown" ? f.nda : ""].filter((v) => !v).length;

  const requiredReady = fields.customer.trim() && fields.due && fields.urgency && fields.nda;

  const confirmIntake = async () => {
    if (!requiredReady) {
      actions.addToast("Customer, due date, urgency and NDA status are required.", "warning");
      return;
    }
    setStep("processing");
    const num = Math.max(...state.tickets.map((t) => parseInt(t.id.slice(3), 10))) + 1;
    const id = `TK-${num}`;
    const ndaUnknown = fields.nda === "Unknown";
    const ticket: MvpTicket = {
      id,
      customer: fields.customer.trim(),
      sorId: sorId.trim() || "—",
      owner: state.currentUser,
      status: ndaUnknown ? "Intake Review" : "AI Processing",
      stage: ndaUnknown ? "intake" : "grouping",
      due: fields.due,
      created: new Date().toISOString().slice(0, 10),
      urgency: fields.urgency as Urgency,
      nda: fields.nda as NdaStatus,
      region,
      source: "Email",
      ae: fields.ae.trim() || undefined,
      aeEmail: fields.aeEmail.trim() || undefined,
      businessImpact: fields.businessImpact.trim() || undefined,
      notes: fields.requestType ? `Request type: ${fields.requestType}` : undefined,
      files: attached
        ? [{
            name: attached.name,
            size: "—",
            kind: "Customer form",
            uploaded: new Date().toISOString().slice(0, 10),
            status: "Processed",
          }]
        : [],
    };
    // Best-effort sync to Alison's backend (falls back to local-only demo)
    const backendId = await createBackendTicket(ticket);
    if (backendId) ticket.backendId = backendId;
    actions.setTickets((p) => [ticket, ...p]);
    actions.logActivity(
      `Created request for ${ticket.customer} from pasted AE email${backendId ? ` (synced to backend #${backendId})` : ""}`,
      id,
    );

    // NT-04: unknown NDA keeps the ticket in Intake Review; extraction waits.
    if (ndaUnknown) {
      setTimeout(() => {
        actions.addToast("Request created — resolve NDA status to start AI analysis.", "warning");
        close();
        actions.openTicket(id);
      }, 600);
      return;
    }

    // Auto-run question extraction + department classification. Real file →
    // backend parse + LLM classification; otherwise the simulated template.
    const base = Math.max(0, ...state.questions.map((q) => q.id));
    let qs: ReturnType<typeof extractQuestionsFor> = [];
    let live = false;
    if (attached) {
      const parsed = await parseQuestionnaire(attached, backendId);
      if (parsed && parsed.length > 0) {
        live = true;
        qs = parsed.map((pq, i) => ({
          id: base + i + 1,
          backendId: pq.backendId,
          ticketId: id,
          row: i + 1,
          original: pq.text,
          normalised: pq.text,
          department: pq.department,
          risk: "Medium" as const,
          status: "AI Analysed" as const,
          confidence: null,
        }));
      }
    }
    if (qs.length === 0) qs = extractQuestionsFor(id, base);

    setTimeout(() => {
      actions.setQuestions((p) => [...p, ...qs]);
      actions.setTickets((p) =>
        p.map((t) => (t.id === id ? { ...t, status: "In Progress" } : t)),
      );
      syncTicketStatus(backendId ?? undefined, "In Progress");
      actions.logActivity(
        live
          ? `AI parsed ${attached!.name} and classified ${qs.length} questions by department (live backend)`
          : `AI extracted ${qs.length} questions and classified departments (1 possible duplicate flagged)`,
        id,
      );
      actions.addToast(
        `${qs.length} questions ${live ? "parsed from the uploaded form" : "extracted"} — review the department grouping.`,
        "success",
      );
      close();
      actions.openTicket(id);
    }, live ? 300 : 1400);
  };

  const field = "w-full border border-border rounded-md px-2.5 py-1.5 text-xs";
  const label = "text-[10px] font-medium text-[#6B7280] mb-1 block";
  const missingCls = "border-orange-300 bg-orange-50/40";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[640px] max-h-[88vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2 shrink-0">
          <Mail size={14} className="text-[#F96702]" />
          <p className="text-sm font-semibold text-[#1F2937] flex-1">
            New Request {step === "check" && "— Intake Check"}
          </p>
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em]">
            <span className={step === "paste" ? "text-[#F96702]" : "text-[#C0BEBA]"}>1 · Paste Email</span>
            <span className="text-[#D8D5D0]">→</span>
            <span className={step === "check" ? "text-[#F96702]" : "text-[#C0BEBA]"}>2 · Check Intake</span>
            <span className="text-[#D8D5D0]">→</span>
            <span className={step === "processing" ? "text-[#F96702]" : "text-[#C0BEBA]"}>3 · AI Analysis</span>
          </div>
          <button onClick={close} className="text-gray-400 hover:text-gray-600 ml-2">
            <X size={14} />
          </button>
        </div>

        {step === "paste" && (
          <div className="p-5 flex flex-col gap-3 overflow-auto">
            <p className="text-xs text-[#6B7280]">
              Paste the email you received from the AE. AI extracts the customer, urgency, NDA
              status, deadline and deal value — you review and correct before anything is created.
            </p>
            <textarea
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder="Paste the incoming AE email here…"
              rows={11}
              autoFocus
              className="w-full border border-border rounded-lg px-3 py-2.5 text-xs leading-relaxed resize-y focus:outline-none focus:border-[#F96702]/50 focus:ring-2 focus:ring-[#F96702]/20 font-mono"
            />
            <button
              onClick={() => setEmailText(SAMPLE_AE_EMAIL)}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-[#C05600] hover:underline self-start"
            >
              <ClipboardPaste size={11} /> Use sample email (demo)
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setAttached(f);
                e.target.value = "";
              }}
            />
            {/* Customer form drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) setAttached(f);
              }}
              title="The attached form is parsed and its questions classified automatically after intake is confirmed"
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
                    <p className="text-xs font-semibold text-[#1F2937] truncate">{attached.name}</p>
                    <p className="text-[10px] text-[#6B7280] mt-0.5">
                      {Math.max(1, Math.round(attached.size / 1024))} KB · will be parsed and
                      classified by AI after intake is confirmed
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-[#1F2937]">
                      Attach the customer form (optional)
                    </p>
                    <p className="text-[10px] text-[#6B7280] mt-0.5">
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
                  className="text-[10px] font-semibold text-[#9CA3AF] hover:text-[#F96702] shrink-0"
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
        )}

        {step === "check" && (
          <div className="p-5 flex flex-col gap-3 overflow-auto">
            {countMissing(fields) > 0 ? (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3.5 py-2.5 flex items-start gap-2.5">
                <AlertTriangle size={13} className="text-orange-500 shrink-0 mt-0.5" />
                <div className="text-xs text-orange-700">
                  <p className="font-semibold mb-0.5">Some required fields could not be extracted.</p>
                  <p>
                    Fill them in below, or{" "}
                    <button
                      onClick={() => setClarifyOpen(true)}
                      className="font-bold underline hover:text-orange-900"
                    >
                      email the AE to clarify
                    </button>{" "}
                    — the draft asks only for what is missing, and their reply fills the fields.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-[#FFF4EC] border border-[#F96702]/25 rounded-lg px-3.5 py-2.5 flex items-center gap-2.5">
                <CheckCircle size={13} className="text-[#F96702] shrink-0" />
                <p className="text-xs font-semibold text-[#C05600]">
                  All required intake fields found — review and confirm to start AI analysis.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={label}>
                  Customer * <FieldFlag ok={!!fields.customer.trim()} />
                </label>
                <input
                  className={`${field} ${!fields.customer.trim() ? missingCls : ""}`}
                  value={fields.customer}
                  onChange={(e) => setFields({ ...fields, customer: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>AE / Requester</label>
                <input
                  className={field}
                  value={fields.ae}
                  onChange={(e) => setFields({ ...fields, ae: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>AE Email</label>
                <input
                  className={field}
                  value={fields.aeEmail}
                  onChange={(e) => setFields({ ...fields, aeEmail: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>Request Type</label>
                <input
                  className={field}
                  value={fields.requestType}
                  onChange={(e) => setFields({ ...fields, requestType: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>
                  Deadline * <FieldFlag ok={!!fields.due} />
                </label>
                <input
                  type="date"
                  className={`${field} ${!fields.due ? missingCls : ""}`}
                  value={fields.due}
                  onChange={(e) => setFields({ ...fields, due: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>
                  Urgency * <FieldFlag ok={!!fields.urgency} />
                </label>
                <select
                  className={`${field} bg-white ${!fields.urgency ? missingCls : ""}`}
                  value={fields.urgency}
                  onChange={(e) => setFields({ ...fields, urgency: e.target.value as Urgency })}
                >
                  <option value="">— not extracted —</option>
                  {["High", "Medium", "Low"].map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>
                  NDA Status * <FieldFlag ok={!!fields.nda} warn={fields.nda === "Unknown"} />
                </label>
                <select
                  className={`${field} bg-white ${!fields.nda ? missingCls : ""}`}
                  value={fields.nda}
                  onChange={(e) => setFields({ ...fields, nda: e.target.value as NdaStatus })}
                >
                  <option value="">— not extracted —</option>
                  {["In Place", "Missing", "Unknown"].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Business Impact / Value</label>
                <input
                  className={field}
                  value={fields.businessImpact}
                  onChange={(e) => setFields({ ...fields, businessImpact: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>Salesforce / SOR Case ID</label>
                <input className={field} placeholder="SOR-00000" value={sorId} onChange={(e) => setSorId(e.target.value)} />
              </div>
              <div>
                <label className={label}>Region</label>
                <select className={`${field} bg-white`} value={region} onChange={(e) => setRegion(e.target.value)}>
                  {["EMEA", "AMER", "APAC"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            {fields.nda === "Unknown" && (
              <p className="text-[10px] text-[#C05600] bg-[#FFF4EC] border border-[#F96702]/25 rounded-md px-2.5 py-1.5">
                NDA status unknown — the request will stay in Intake Review and AI analysis will
                wait until it is resolved (NT-04).
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <BtnSecondary onClick={() => setStep("paste")}>Back</BtnSecondary>
              {countMissing(fields) > 0 && (
                <button
                  onClick={() => setClarifyOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-semibold border border-[#F96702]/30 text-[#C05600] bg-[#FFF4EC] rounded-full hover:bg-[#FFE8D0] transition-colors"
                >
                  <Mail size={11} /> Draft Clarification Email
                </button>
              )}
              <span className="flex-1" />
              <span title="Creates the request; AI then extracts and classifies the questions automatically">
                <BtnPrimary onClick={confirmIntake} disabled={!requiredReady}>
                  Next: AI Analysis <ChevronRight size={12} />
                </BtnPrimary>
              </span>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="p-10 flex flex-col items-center gap-4">
            <Loader2 size={26} className="animate-spin text-[#F96702]" />
            <div className="text-center">
              <p className="text-sm font-semibold text-[#1F2937]">AI is analysing the form…</p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Extracting questions · normalising text · classifying departments · detecting duplicates
              </p>
            </div>
          </div>
        )}
      </div>

      {clarifyOpen && (
        <ClarificationEmailModal
          fields={fields}
          actions={actions}
          onReply={(patch) => setFields((f) => ({ ...f, ...patch }))}
          close={() => setClarifyOpen(false)}
        />
      )}
    </div>
  );
}

function FieldFlag({ ok, warn }: { ok: boolean; warn?: boolean }) {
  if (warn)
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-orange-600 ml-1">
        <AlertTriangle size={9} /> UNCLEAR
      </span>
    );
  return ok ? (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-green-600 ml-1">
      <CheckCircle size={9} /> FOUND
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 ml-1">
      <XCircle size={9} /> MISSING
    </span>
  );
}

// Auto-drafted clarification email asking only for the missing fields, with a
// simulated AE reply that fills them (mirrors the original prototype flow).
export function ClarificationEmailModal({
  fields,
  actions,
  onReply,
  close,
}: {
  fields: IntakeExtraction;
  actions: AppActions;
  onReply: (patch: Partial<IntakeExtraction>) => void;
  close: () => void;
}) {
  const [sent, setSent] = useState(false);
  const missing: string[] = [];
  if (!fields.due) missing.push("Response deadline — by what date does the customer need completed answers?");
  if (!fields.nda || fields.nda === "Unknown") missing.push("NDA status — is there an active NDA with the customer?");
  if (!fields.urgency) missing.push("Urgency level — High, Medium or Low?");
  if (!fields.businessImpact) missing.push("Business impact — renewal, expansion or new deal, and rough value?");
  if (!fields.customer.trim()) missing.push("Customer name — which account is this request for?");

  const simulateReply = () => {
    onReply({
      due: fields.due || "2026-07-21",
      nda: !fields.nda || fields.nda === "Unknown" ? "In Place" : fields.nda,
      urgency: fields.urgency || "High",
      businessImpact: fields.businessImpact || "Renewal, ~$450k ARR",
      customer: fields.customer.trim() || "Vandelay Industries",
    });
    actions.addToast("AE replied — intake fields updated.", "success");
    close();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl shadow-xl w-[520px] max-h-[80vh] overflow-auto">
        <div className="px-4 py-2.5 bg-[#F7F8FA] border-b border-border flex items-center justify-between">
          <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide">
            Clarification email to AE — auto-drafted
          </p>
          {sent ? (
            <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
              <CheckCircle size={10} /> Sent
            </span>
          ) : (
            <button onClick={close} className="text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="px-4 py-3 space-y-1.5 border-b border-border text-xs">
          {[
            ["To", fields.aeEmail || "ae@cloudera.com"],
            ["Subject", `RE: ${fields.customer || "Customer"} request — missing intake details`],
          ].map(([l, v]) => (
            <div key={l} className="flex gap-2">
              <span className="text-[#9CA3AF] w-12 shrink-0">{l}:</span>
              <span className="text-[#1F2937]">{v}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-4 text-xs text-[#374151] leading-relaxed space-y-2.5">
          <p>Hi {fields.ae ? fields.ae.split(" ")[0] : "there"},</p>
          <p>
            Thanks for sending this over. Before we can safely route the form, could you confirm:
          </p>
          <ol className="list-decimal ml-5 space-y-1.5">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ol>
          <p>Once confirmed we will proceed immediately.</p>
          <p>
            Thank you,
            <br />
            <strong>Sarah Chen</strong>, GOM Analyst
          </p>
        </div>
        <div className="px-4 py-3 border-t border-border flex gap-2 bg-[#FAFAFA]">
          {!sent ? (
            <>
              <BtnPrimary
                onClick={() => {
                  setSent(true);
                  actions.logActivity("Sent clarification email to AE for missing intake fields");
                  actions.addToast("Clarification email sent.", "success");
                }}
              >
                Send Email
              </BtnPrimary>
              <BtnSecondary onClick={close}>Cancel</BtnSecondary>
            </>
          ) : (
            <>
              <button
                onClick={simulateReply}
                className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold bg-[#1A1A1A] text-white rounded-full hover:bg-[#333] tracking-[0.06em] uppercase transition-all"
              >
                Simulate AE Reply
              </button>
              <BtnSecondary onClick={close}>Close</BtnSecondary>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
