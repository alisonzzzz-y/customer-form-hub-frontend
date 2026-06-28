import { useState, useEffect } from "react";
import { Search, Filter, Plus, ChevronRight, X, Loader2 } from "lucide-react";
import { getTickets, Ticket } from "../api";
import { Screen } from "../types";
import { UrgencyPill, StatusPill } from "../components/shared";

// ─── Screen: Dashboard ────────────────────────────────────────────────────────
export function DashboardScreen({
  setScreen,
  ticketCompleted,
  setActiveTicket,
}: {
  setScreen: (s: Screen) => void;
  ticketCompleted: boolean;
  setActiveTicket: (t: Ticket) => void;
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Load tickets from the backend on mount
  useEffect(() => {
    getTickets()
      .then((data) => setTickets(data))
      .catch((err) => {
        console.error("Failed to load tickets:", err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  // Format a backend date string like "2025-05-26T00:00:00" as "26 May 2025"
  function formatDate(raw: string | null): string {
    if (!raw) return "—";
    const date = new Date(raw);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const selected = tickets.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-7 pt-6 pb-4 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-[3px] h-7 bg-[#F96702] rounded-full shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">
                Ticket Queue
              </h1>
              <p className="text-sm text-[#6B7280] mt-0.5 font-normal">
                All customer form workflow tickets
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              />
              <input
                className="pl-8 pr-4 py-2 text-[11px] border border-[rgba(0,0,0,0.15)] rounded-full bg-white placeholder-[#B0B0B0] focus:outline-none focus:ring-2 focus:ring-[#F96702]/30 focus:border-[#F96702]/50 w-44 transition-all"
                placeholder="Search tickets…"
              />
            </div>
            <button className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-semibold border border-[rgba(0,0,0,0.15)] rounded-full bg-white text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] tracking-[0.04em] transition-all">
              <Filter size={11} /> Filters
            </button>
            <button
              onClick={() => setScreen("intake-upload")}
              className="flex items-center gap-1.5 px-5 py-2 text-[10px] bg-[#F96702] text-white rounded-full hover:bg-[#D95400] font-bold tracking-[0.06em] shadow-[0_2px_8px_rgba(249,103,2,0.3)] hover:shadow-[0_4px_16px_rgba(249,103,2,0.45)] transition-all"
            >
              <Plus size={12} /> New Request
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 divide-x divide-[rgba(0,0,0,0.06)] bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0">
          {[
            { value: tickets.length, label: "Total Tickets", accent: false },
            {
              value: tickets.filter((r) => r.urgency === "High").length,
              label: "High Priority",
              accent: true,
            },
            {
              value: tickets.filter((r) => r.status !== "Completed").length,
              label: "In Progress",
              accent: false,
            },
            {
              value: tickets.filter((r) => r.status === "Completed").length,
              label: "Completed",
              accent: false,
            },
          ].map(({ value, label, accent }) => (
            <div key={label} className="px-8 py-6 flex items-end gap-3.5">
              <span
                className={`text-[3rem] font-black tracking-tight leading-none ${accent ? "text-[#F96702]" : "text-[#0A0A0A]"}`}
              >
                {value}
              </span>
              <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#B8B5B0] pb-2">
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {[
              "All Status",
              "Intake Missing",
              "In Review",
              "Waiting SME",
              "Completed",
            ].map((f, i) => (
              <button
                key={f}
                className={`px-3.5 py-1 rounded-full text-[9px] font-bold tracking-[0.08em] uppercase border transition-all ${i === 0 ? "bg-[#F96702] text-white border-[#F96702] shadow-[0_2px_8px_rgba(249,103,2,0.25)]" : "bg-white text-[#9CA3AF] border-[rgba(0,0,0,0.12)] hover:border-[#F96702]/50 hover:text-[#F96702]"}`}
              >
                {f}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-[#9CA3AF] font-semibold tracking-[0.06em]">
              {tickets.length} TICKETS
            </span>
          </div>

          {/* Loading / error / table */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-[#6B7280] py-16">
              <Loader2 size={16} className="animate-spin" /> Loading tickets…
            </div>
          ) : error ? (
            <div className="text-sm text-[#9CA3AF] py-16 text-center">
              Failed to load tickets. Is the backend running?
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FAFAF9] border-b border-[rgba(0,0,0,0.06)]">
                    {[
                      "Ticket ID",
                      "Customer",
                      "AE",
                      "Due Date",
                      "NDA",
                      "Urgency",
                      "Status",
                      "Owner",
                      "Action",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3.5 text-[8.5px] font-black text-[#ABABAB] uppercase tracking-[0.14em] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => {
                    const isSel = selectedId === t.id;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedId(isSel ? null : t.id)}
                        className={`border-b border-[rgba(0,0,0,0.04)] last:border-0 cursor-pointer transition-all border-l-[3px] ${isSel ? "bg-[#FFF7F0] border-l-[#F96702]" : t.urgency === "High" ? "border-l-[#F96702]/35 hover:bg-[#FAFAF8]" : "border-l-transparent hover:bg-[#FAFAF8]"}`}
                      >
                        <td className="px-4 py-3.5 font-mono text-xs font-black text-[#0A0A0A] tracking-tight">
                          T-{1000 + t.id}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-semibold text-[#0A0A0A]">
                          {t.customerName}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-[#6B7280]">
                          {t.createdBy || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-[#6B7280] whitespace-nowrap">
                          {formatDate(t.deadline)}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-medium">
                          <span
                            className={
                              t.ndaStatus === "Unknown"
                                ? "text-[#C05600] font-semibold"
                                : t.ndaStatus === "Yes"
                                  ? "text-[#374151] font-medium"
                                  : "text-[#9CA3AF]"
                            }
                          >
                            {t.ndaStatus || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <UrgencyPill urgency={t.urgency || "—"} />
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusPill status={t.status} />
                        </td>
                        <td className="px-4 py-3.5 text-xs text-[#6B7280]">
                          {t.assignedTo || "—"}
                        </td>
                        <td
                          className="px-4 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setActiveTicket(t);
                              setScreen("answer-review");
                            }}
                            className="flex items-center gap-1 px-3 py-1 text-[9px] font-black bg-[#F96702] text-white rounded-full hover:bg-[#D95400] tracking-[0.06em] uppercase transition-all"
                          >
                            Open <ChevronRight size={9} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Ticket detail drawer */}
      {selected && (
        <div className="w-60 bg-white border-l border-border flex flex-col shrink-0 overflow-y-auto">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <p className="text-xs font-bold text-[#1F2937]">
              T-{1000 + selected.id}
            </p>
            <button
              onClick={() => setSelectedId(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          </div>
          <div className="px-4 py-4 flex flex-col gap-3 flex-1">
            {[
              ["Customer", selected.customerName],
              ["AE", selected.createdBy || "—"],
              ["Due Date", formatDate(selected.deadline)],
              ["NDA Status", selected.ndaStatus || "—"],
              ["Urgency", selected.urgency || "—"],
              ["Owner", selected.assignedTo || "—"],
              ["Business Impact", selected.businessImpact || "—"],
            ].map(([l, v]) => (
              <div key={l as string}>
                <p className="text-[10px] text-[#9CA3AF] mb-0.5">
                  {l as string}
                </p>
                <p className="text-xs font-medium text-[#1F2937]">
                  {v as string}
                </p>
              </div>
            ))}
            <div>
              <p className="text-[10px] text-[#9CA3AF] mb-1">Status</p>
              <StatusPill status={selected.status} />
            </div>
          </div>
          <div className="px-4 py-3 border-t border-border flex flex-col gap-2 shrink-0">
            <button
              onClick={() => {
                if (selected) setActiveTicket(selected);
                setSelectedId(null);
                setScreen("answer-review");
              }}
              className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold bg-[#F96702] text-white rounded-full hover:bg-[#D95400] w-full shadow-[0_2px_8px_rgba(249,103,2,0.3)] tracking-[0.06em] uppercase transition-all"
            >
              Open Workflow <ChevronRight size={10} />
            </button>
            <button
              onClick={() => setSelectedId(null)}
              className="text-xs text-[#6B7280] hover:text-[#1F2937] text-center"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
