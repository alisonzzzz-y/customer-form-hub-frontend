import { useRef, useState } from "react";
import { Inbox, Plus, Search, Upload, X } from "lucide-react";
import { BtnPrimary, BtnSecondary } from "../components/shared";
import {
  DEPARTMENTS,
  MvpTicket,
  NdaStatus,
  Urgency,
  fmtDate,
  fmtDateTime,
  isDueToday,
  isOverdueTicket,
} from "./data";
import { AppActions, AppState } from "./MvpApp";
import { EmptyState, FilterSelect, Pill, Th, UrgencyDot } from "./ui";

// PRD §7: statuses are FILTERS here, never separate sidebar pages (TK-02,
// Appendix B). Archived stays searchable behind its filter (TK-06).

export type TicketFilters = {
  query: string;
  status: string;
  department: string;
  nda: string;
  urgency: string;
  due: string; // All | Overdue | Due today
  includeArchived: boolean;
};

export const EMPTY_FILTERS: TicketFilters = {
  query: "",
  status: "All",
  department: "All",
  nda: "All",
  urgency: "All",
  due: "All",
  includeArchived: false,
};

const TICKET_STATUSES = [
  "New",
  "AI Processing",
  "Intake Review",
  "In Progress",
  "Waiting SME",
  "Ready for Review",
  "Approved",
  "Sent",
  "Closed",
  "Archived",
];

export function TicketsPage({
  state,
  actions,
  filters,
  setFilters,
  newTicketOpen,
  setNewTicketOpen,
}: {
  state: AppState;
  actions: AppActions;
  filters: TicketFilters;
  setFilters: (f: TicketFilters) => void;
  newTicketOpen: boolean;
  setNewTicketOpen: (v: boolean) => void;
}) {
  const { tickets, questions, smeRequests, role } = state;
  const set = (patch: Partial<TicketFilters>) => setFilters({ ...filters, ...patch });

  const q = filters.query.trim().toLowerCase();
  const visible = tickets
    .filter((t) => {
      if (t.status === "Archived" && !filters.includeArchived && filters.status !== "Archived")
        return false;
      if (filters.status !== "All" && t.status !== filters.status) return false;
      if (filters.nda !== "All" && t.nda !== filters.nda) return false;
      if (filters.urgency !== "All" && t.urgency !== filters.urgency) return false;
      if (filters.due === "Overdue" && !isOverdueTicket(t)) return false;
      if (filters.due === "Due today" && !isDueToday(t)) return false;
      // TK-03: department filter based on outstanding questions / SME requests
      if (filters.department !== "All") {
        const hasDept =
          questions.some((qu) => qu.ticketId === t.id && qu.department === filters.department) ||
          smeRequests.some((r) => r.ticketId === t.id && r.department === filters.department);
        if (!hasDept) return false;
      }
      if (q) {
        const hay = [t.id, t.customer, t.sorId, t.owner, t.notes ?? ""]
          .join(" ")
          .toLowerCase();
        const inQuestions = questions.some(
          (qu) => qu.ticketId === t.id && qu.original.toLowerCase().includes(q),
        );
        if (!hay.includes(q) && !inQuestions) return false;
      }
      return true;
    })
    // TK-05: urgency + due date default sort, overdue first
    .sort((a, b) => {
      const ao = isOverdueTicket(a) ? 0 : 1;
      const bo = isOverdueTicket(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const urg = { High: 0, Medium: 1, Low: 2 } as const;
      if (urg[a.urgency] !== urg[b.urgency]) return urg[a.urgency] - urg[b.urgency];
      return a.due.localeCompare(b.due);
    });

  const smePending = (id: string) =>
    smeRequests.filter((r) => r.ticketId === id && !["Returned", "Closed"].includes(r.status))
      .length;

  const lastActivity = (id: string) => {
    const a = state.activity.find((ev) => ev.ticketId === id);
    return a ? fmtDateTime(a.at) : "—";
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-7 pt-6 pb-4 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-7 bg-[#F96702] rounded-full shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Tickets</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              All customer form requests — statuses are filters, not pages
            </p>
          </div>
        </div>
        {role !== "SME" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // design system §7.2: demo helper that simulates SOR ingestion
                const num = Math.max(...tickets.map((t) => parseInt(t.id.slice(3), 10))) + 1;
                const id = `TK-${num}`;
                actions.setTickets((p) => [
                  {
                    id,
                    customer: "Pied Piper",
                    sorId: `SOR-${88400 + num}`,
                    owner: state.currentUser,
                    status: "New",
                    due: "2026-07-28",
                    created: new Date().toISOString().slice(0, 10),
                    urgency: "Medium",
                    nda: "In Place",
                    region: "AMER",
                    source: "Salesforce",
                    businessImpact: "Imported from mock SOR",
                    files: [],
                  },
                  ...p,
                ]);
                actions.logActivity("Imported ticket from mock Salesforce SOR", id);
                actions.addToast(`Imported ${id} from mock SOR.`, "success");
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-semibold border border-[rgba(0,0,0,0.15)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] tracking-[0.04em] transition-all"
            >
              Import Mock SOR
            </button>
            <button
              onClick={() => setNewTicketOpen(true)}
              className="flex items-center gap-1.5 px-5 py-2 text-[10px] bg-[#F96702] text-white rounded-full hover:bg-[#D95400] font-bold tracking-[0.06em] shadow-[0_2px_8px_rgba(249,103,2,0.3)] transition-all"
            >
              <Plus size={12} /> Create Ticket
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 flex flex-col gap-4">
        {/* TK-01 search + filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={filters.query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder="Search company, SOR ID, ticket ID, question…"
              className="pl-8 pr-4 py-1.5 text-[11px] border border-[rgba(0,0,0,0.15)] rounded-full bg-white placeholder-[#B0B0B0] focus:outline-none focus:ring-2 focus:ring-[#F96702]/30 focus:border-[#F96702]/50 w-72 transition-all"
            />
          </div>
          <FilterSelect label="Status" value={filters.status} options={TICKET_STATUSES} onChange={(v) => set({ status: v })} />
          <FilterSelect label="Department" value={filters.department} options={DEPARTMENTS} onChange={(v) => set({ department: v })} />
          <FilterSelect label="NDA" value={filters.nda} options={["In Place", "Missing", "Unknown"]} onChange={(v) => set({ nda: v })} />
          <FilterSelect label="Urgency" value={filters.urgency} options={["High", "Medium", "Low"]} onChange={(v) => set({ urgency: v })} />
          <FilterSelect label="Due" value={filters.due} options={["Overdue", "Due today"]} onChange={(v) => set({ due: v })} />
          <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[#6B7280] cursor-pointer ml-1">
            <input
              type="checkbox"
              className="accent-[#F96702]"
              checked={filters.includeArchived}
              onChange={(e) => set({ includeArchived: e.target.checked })}
            />
            Include archived
          </label>
          {JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="flex items-center gap-1 text-[10px] font-semibold text-[#9CA3AF] hover:text-[#F96702]"
            >
              <X size={10} /> Clear
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] overflow-hidden">
          {visible.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No tickets match this filter."
              hint="Adjust filters or create a new ticket."
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Ticket ID</Th>
                  <Th>Customer</Th>
                  <Th>Owner</Th>
                  <Th>Status</Th>
                  <Th>Urgency</Th>
                  <Th>Due</Th>
                  <Th>NDA</Th>
                  <Th>SME Pending</Th>
                  <Th>Last Activity</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => actions.openTicket(t.id)}
                    className={`border-b border-border last:border-0 cursor-pointer transition-colors ${isOverdueTicket(t) ? "bg-red-50/40 hover:bg-red-50/70" : "hover:bg-gray-50/60"}`}
                  >
                    <td className="px-4 py-2.5 text-xs font-mono font-bold text-[#1F2937]">{t.id}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-[#1F2937]">{t.customer}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6B7280] whitespace-nowrap">{t.owner}</td>
                    <td className="px-4 py-2.5"><Pill value={t.status} /></td>
                    <td className="px-4 py-2.5"><UrgencyDot urgency={t.urgency} /></td>
                    <td className={`px-4 py-2.5 text-xs whitespace-nowrap ${isOverdueTicket(t) ? "text-red-600 font-semibold" : "text-[#374151]"}`}>
                      {fmtDate(t.due)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-[10px] font-bold ${t.nda === "In Place" ? "text-green-700" : t.nda === "Missing" ? "text-red-600" : "text-[#C05600]"}`}
                      >
                        {t.nda}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono font-bold text-[#1F2937]">
                      {smePending(t.id) || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] text-[#9CA3AF] whitespace-nowrap">
                      {lastActivity(t.id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {newTicketOpen && (
        <NewTicketModal state={state} actions={actions} close={() => setNewTicketOpen(false)} />
      )}
    </div>
  );
}

// PRD §7.1 New Ticket flow (NT-01..05)
function NewTicketModal({
  state,
  actions,
  close,
}: {
  state: AppState;
  actions: AppActions;
  close: () => void;
}) {
  const [customer, setCustomer] = useState("");
  const [sorId, setSorId] = useState("");
  const [due, setDue] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("Medium");
  const [nda, setNda] = useState<NdaStatus>("Unknown");
  const [region, setRegion] = useState("EMEA");
  const [source, setSource] = useState("Email");
  const [ae, setAe] = useState("");
  const [impact, setImpact] = useState("");
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = () => {
    // NT-01: required fields
    if (!customer.trim() || !due || !urgency || !nda) {
      actions.addToast("Customer, due date, urgency and NDA status are required.", "warning");
      return;
    }
    const num = Math.max(...state.tickets.map((t) => parseInt(t.id.slice(3), 10))) + 1;
    const id = `TK-${num}`;
    const ticket: MvpTicket = {
      id,
      customer: customer.trim(),
      sorId: sorId.trim() || "—",
      owner: state.currentUser,
      // NT-04: unknown NDA keeps the ticket in Intake Review
      status: nda === "Unknown" ? "Intake Review" : fileName ? "AI Processing" : "New",
      due,
      created: new Date().toISOString().slice(0, 10),
      urgency,
      nda,
      region,
      source,
      ae: ae.trim() || undefined,
      businessImpact: impact.trim() || undefined,
      notes: notes.trim() || undefined,
      files: fileName
        ? [
            {
              name: fileName,
              size: "—",
              kind: "Customer form",
              uploaded: new Date().toISOString().slice(0, 10),
              status: "Uploaded",
            },
          ]
        : [],
    };
    actions.setTickets((p) => [ticket, ...p]);
    actions.logActivity(`Created ticket for ${ticket.customer} (${ticket.sorId})`, id);
    if (nda === "Unknown") {
      actions.addToast("Ticket created — intake flagged incomplete until NDA status is resolved.", "warning");
    } else {
      actions.addToast(`Ticket ${id} created.`, "success");
    }
    close();
    actions.openTicket(id); // NT-05
  };

  const field = "w-full border border-border rounded-md px-2.5 py-1.5 text-xs";
  const label = "text-[10px] font-medium text-[#6B7280] mb-1 block";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-5 w-[520px] max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#1F2937]">New Ticket</h3>
          <button onClick={close} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={label}>Customer Name *</label>
            <input className={field} value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </div>
          <div>
            <label className={label}>Salesforce / SOR Case ID</label>
            <input className={field} placeholder="SOR-00000" value={sorId} onChange={(e) => setSorId(e.target.value)} />
          </div>
          <div>
            <label className={label}>Due Date *</label>
            <input type="date" className={field} value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div>
            <label className={label}>Urgency *</label>
            <select className={`${field} bg-white`} value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)}>
              {["High", "Medium", "Low"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>NDA Status *</label>
            <select className={`${field} bg-white`} value={nda} onChange={(e) => setNda(e.target.value as NdaStatus)}>
              {["In Place", "Missing", "Unknown"].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Region</label>
            <select className={`${field} bg-white`} value={region} onChange={(e) => setRegion(e.target.value)}>
              {["EMEA", "AMER", "APAC"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Request Source</label>
            <select className={`${field} bg-white`} value={source} onChange={(e) => setSource(e.target.value)}>
              {["Email", "Salesforce"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>AE / Requester</label>
            <input className={field} value={ae} onChange={(e) => setAe(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={label}>Business Impact</label>
            <input className={field} placeholder="e.g. Renewal, high value" value={impact} onChange={(e) => setImpact(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={label}>Notes</label>
            <textarea rows={2} className={`${field} resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={label}>Attach Customer Form (NT-02)</label>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFileName(f.name);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-border rounded-md text-[10px] text-[#6B7280] hover:border-[#F96702]/40 hover:text-[#F96702]"
            >
              <Upload size={11} /> {fileName ?? "Choose a file (optional)"}
            </button>
          </div>
        </div>
        {nda === "Unknown" && (
          <p className="text-[10px] text-[#C05600] bg-[#FFF4EC] border border-[#F96702]/25 rounded-md px-2.5 py-1.5 mt-2.5">
            NDA status unknown — the ticket will be flagged Intake Review until resolved (NT-04).
          </p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <BtnSecondary onClick={close}>Cancel</BtnSecondary>
          <BtnPrimary onClick={create}>Create Ticket</BtnPrimary>
        </div>
      </div>
    </div>
  );
}
