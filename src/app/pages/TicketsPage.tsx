import { Inbox, Plus, Search, X } from "lucide-react";
import {
  DEPARTMENTS,
  fmtDate,
  fmtDateTime,
  isDueToday,
  isOverdueTicket,
} from "../data/model";
import { AppActions, AppState } from "../AppShell";
import { NewRequestFlow } from "./NewRequestFlow";
import { EmptyState, FilterSelect, Pill, Th, UrgencyDot } from "../components/ui";

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
                    stage: "intake",
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
              <Plus size={12} /> New Request
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
        <NewRequestFlow state={state} actions={actions} close={() => setNewTicketOpen(false)} />
      )}
    </div>
  );
}
