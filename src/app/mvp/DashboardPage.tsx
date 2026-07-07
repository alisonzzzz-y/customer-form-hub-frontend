import { Activity, BookOpen, ChevronRight, Clock, Inbox } from "lucide-react";
import {
  MOCK_NOW,
  fmtDate,
  fmtDateTime,
  isDueToday,
  isOverdueTicket,
} from "./data";
import { AppActions, AppState } from "./MvpApp";
import { Card, EmptyState, Pill, Th, UrgencyDot } from "./ui";

// PRD §6: what needs attention today, which tickets are blocked, which SME
// responses are overdue. Metric cards deep-link into filtered Tickets (DB-04).

export function DashboardPage({ state, actions }: { state: AppState; actions: AppActions }) {
  const { tickets, smeRequests, activity, knowledge, role, currentUser } = state;

  // DB-06: Analyst sees own tickets first; Manager sees team level
  const scoped =
    role === "Manager" ? tickets : tickets.filter((t) => t.owner === currentUser);
  const live = scoped.filter((t) => t.status !== "Archived");

  const open = live.filter((t) => !["Closed", "Sent"].includes(t.status));
  const waitingSme = live.filter((t) => t.status === "Waiting SME");
  const dueToday = live.filter(isDueToday);
  const overdue = live.filter(isOverdueTicket);
  const aiReady = live.filter((t) => t.status === "Ready for Review");
  const weekAgo = new Date(MOCK_NOW.getTime() - 7 * 24 * 3600 * 1000);
  const closedThisWeek = scoped.filter(
    (t) => t.closed && new Date(t.closed) >= weekAgo,
  );

  const metrics = [
    { label: "Open Tickets", value: open.length, filter: {} },
    { label: "Waiting SME", value: waitingSme.length, filter: { status: "Waiting SME" } },
    { label: "Due Today", value: dueToday.length, filter: { due: "Due today" } },
    { label: "Overdue", value: overdue.length, filter: { due: "Overdue" }, accent: true },
    { label: "AI Ready", value: aiReady.length, filter: { status: "Ready for Review" } },
    { label: "Closed This Week", value: closedThisWeek.length, filter: { status: "Closed" } },
  ];

  // DB-02: priority = overdue first, then due date
  const priority = [...open].sort((a, b) => {
    const ao = isOverdueTicket(a) ? 0 : 1;
    const bo = isOverdueTicket(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return a.due.localeCompare(b.due);
  });

  // DB-03: SME tracker aggregated by department
  const activeSme = smeRequests.filter((r) => !["Returned", "Closed"].includes(r.status));
  const byDept = new Map<string, { pending: number; overdue: number; nextEta: string | null }>();
  for (const r of activeSme) {
    const isOver = r.status === "Overdue" || (r.eta !== null && new Date(r.eta) < MOCK_NOW);
    const cur = byDept.get(r.department) ?? { pending: 0, overdue: 0, nextEta: null };
    cur.pending += 1;
    if (isOver) cur.overdue += 1;
    if (r.eta && (!cur.nextEta || r.eta < cur.nextEta)) cur.nextEta = r.eta;
    byDept.set(r.department, cur);
  }

  const pendingKnowledge = knowledge.filter((k) => k.status === "Pending Review");
  const greeting = role === "Manager" ? "Team overview" : `Good morning, ${currentUser.split(" ")[0]}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-7 pt-6 pb-4 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-7 bg-[#F96702] rounded-full shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">{greeting}</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {role === "Manager"
                ? "All team tickets, bottlenecks and pending reviews"
                : "Your tickets, blockers and overdue SME responses"}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-[#9CA3AF]">
          Demo date: {fmtDate(MOCK_NOW.toISOString())} · This week
        </span>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 flex flex-col gap-5">
        {/* DB-01 metric cards */}
        <div className="grid grid-cols-6 gap-3">
          {metrics.map((m) => (
            <button
              key={m.label}
              onClick={() => actions.openTicketsFiltered(m.filter)}
              className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-sm px-4 py-3.5 text-left hover:border-[#F96702]/40 transition-all group"
            >
              <p
                className={`text-[26px] font-black tracking-tight leading-none ${m.accent && m.value > 0 ? "text-red-600" : "text-[#0A0A0A]"}`}
              >
                {m.value}
              </p>
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#B8B5B0] mt-1.5 group-hover:text-[#C05600] transition-colors">
                {m.label}
              </p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-4">
          {/* DB-02 priority list */}
          <Card title="My Priority Tickets" className="col-span-3 overflow-hidden">
            {priority.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No open tickets yet."
                hint="Create a ticket to begin."
              />
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>Ticket</Th>
                    <Th>Company</Th>
                    <Th>Status</Th>
                    <Th>Due</Th>
                    <Th>Owner</Th>
                  </tr>
                </thead>
                <tbody>
                  {priority.slice(0, 6).map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => actions.openTicket(t.id)}
                      className={`border-b border-border last:border-0 cursor-pointer transition-colors ${isOverdueTicket(t) ? "bg-red-50/40 hover:bg-red-50/70" : "hover:bg-gray-50/60"}`}
                    >
                      <td className="px-4 py-2.5 text-xs font-mono font-bold text-[#1F2937]">
                        {t.id}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-[#1F2937]">
                        {t.customer}
                      </td>
                      <td className="px-4 py-2.5">
                        <Pill value={t.status} />
                      </td>
                      <td
                        className={`px-4 py-2.5 text-xs whitespace-nowrap ${isOverdueTicket(t) ? "text-red-600 font-semibold" : "text-[#374151]"}`}
                      >
                        {fmtDate(t.due)}
                        {isDueToday(t) && (
                          <span className="ml-1.5 text-[9px] font-bold text-[#C05600]">TODAY</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#6B7280] whitespace-nowrap">
                        {t.owner}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* DB-03 SME ETA Tracker */}
          <Card title="SME ETA Tracker" className="col-span-2 overflow-hidden">
            {byDept.size === 0 ? (
              <EmptyState icon={Clock} title="No pending SME requests." />
            ) : (
              <div className="divide-y divide-border">
                {[...byDept.entries()].map(([dept, d]) => (
                  <div
                    key={dept}
                    className={`px-4 py-2.5 flex items-center gap-3 ${d.overdue > 0 ? "bg-red-50/40" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#1F2937]">{dept}</p>
                      <p className="text-[10px] text-[#9CA3AF]">
                        Next ETA: {d.nextEta ? fmtDateTime(d.nextEta) : "—"}
                      </p>
                    </div>
                    <span className="text-[10px] text-[#6B7280] whitespace-nowrap">
                      {d.pending} pending
                    </span>
                    {d.overdue > 0 && (
                      <span className="text-[9px] font-bold text-[#991B1B] bg-[#FEF2F2] border border-[#FCA5A5]/50 rounded-full px-2 py-0.5 whitespace-nowrap">
                        {d.overdue} overdue
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {/* DB-05 recent activity */}
          <Card title="Recent Activity" className="col-span-3 overflow-hidden">
            {activity.length === 0 ? (
              <EmptyState icon={Activity} title="No activity yet." />
            ) : (
              <div className="divide-y divide-border">
                {activity.slice(0, 6).map((a) => (
                  <div key={a.id} className="px-4 py-2.5 flex items-start gap-2.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${a.actor === "AI" ? "bg-[#4338CA]" : "bg-[#F96702]/60"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#374151]">
                        <span className="font-semibold">{a.actor}</span> {a.action}
                      </p>
                      <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                        {a.ticketId && (
                          <button
                            onClick={() => actions.openTicket(a.ticketId!)}
                            className="font-mono font-bold text-[#C05600] hover:underline mr-1.5"
                          >
                            {a.ticketId}
                          </button>
                        )}
                        {fmtDateTime(a.at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Knowledge pending review */}
          <Card
            title="Knowledge Pending Review"
            className="col-span-2 overflow-hidden"
            right={
              <button
                onClick={() => actions.openKnowledge("pending")}
                className="text-[10px] font-bold text-[#C05600] hover:underline flex items-center gap-0.5"
              >
                Review all <ChevronRight size={10} />
              </button>
            }
          >
            {pendingKnowledge.length === 0 ? (
              <EmptyState icon={BookOpen} title="Nothing pending review." />
            ) : (
              <div className="divide-y divide-border">
                {pendingKnowledge.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => actions.openKnowledge("pending", k.id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50/60 transition-colors"
                  >
                    <p className="text-xs font-semibold text-[#1F2937]">{k.title}</p>
                    <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                      {k.department} · submitted by {k.owner} · {fmtDate(k.lastUpdated)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
