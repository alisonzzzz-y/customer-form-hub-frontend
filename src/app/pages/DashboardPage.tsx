import { Activity, BookOpen, ChevronRight, Clock, Inbox, LoaderCircle } from "lucide-react";
import {
  MOCK_NOW,
  fmtDate,
  fmtDateTime,
  isDueToday,
  isOverdueSmeRequest,
  isOverdueTicket,
} from "../data/model";
import { AppActions, AppState } from "../AppShell";
import { Card, EmptyState, Pill, Th } from "../components/ui";
import { useEffect, useState } from "react";
import { fetchDashboardStats, type DashboardStats } from "../services/backend";

export function DashboardPage({
  state,
  actions,
}: {
  state: AppState;
  actions: AppActions;
}) {
  const { tickets, smeRequests, activity, knowledge, role, currentUser, isInitialLiveLoad } =
    state;
  // Hide live metrics when the backend is unavailable.
  const [stats, setStats] = useState<DashboardStats | null>(null);
  useEffect(() => {
    let alive = true;
    fetchDashboardStats().then((s) => {
      if (alive) setStats(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const scoped =
    role === "Manager"
      ? tickets
      : tickets.filter((t) => t.owner === currentUser);
  const hasLiveData = tickets.some((ticket) => ticket.backendId !== undefined);
  const referenceDate = hasLiveData ? new Date() : MOCK_NOW;
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
    {
      label: "Waiting SME",
      value: waitingSme.length,
      filter: { status: "Waiting SME" },
    },
    {
      label: "Due Today",
      value: dueToday.length,
      filter: { due: "Due today" },
    },
    {
      label: "Overdue Tickets",
      value: overdue.length,
      filter: { due: "Overdue" },
      accent: true,
    },
    {
      label: "AI Ready",
      value: aiReady.length,
      filter: { status: "Ready for Review" },
    },
    {
      label: "Closed This Week",
      value: closedThisWeek.length,
      filter: { status: "Closed" },
    },
  ];

  // Show overdue tickets first, then sort by due date.
  const priority = [...open].sort((a, b) => {
    const ao = isOverdueTicket(a) ? 0 : 1;
    const bo = isOverdueTicket(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return a.due.localeCompare(b.due);
  });

  const activeSme = smeRequests
    .filter((r) => !["Returned", "Closed"].includes(r.status))
    .map((r) => ({
      ...r,
      over: isOverdueSmeRequest(r),
      ticket: tickets.find((t) => t.id === r.ticketId),
    }))
    .sort((a, b) => Number(b.over) - Number(a.over));
  const overdueSmeCount = activeSme.filter((r) => r.over).length;

  const pendingKnowledge = knowledge.filter(
    (k) => k.status === "Pending Review",
  );
  const greeting =
    role === "Manager"
      ? "Team overview"
      : `Good morning, ${currentUser.split(" ")[0]}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 sm:px-8 pt-7 pb-5 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-7 bg-[#F96702] rounded-full shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">
              {greeting}
            </h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {role === "Manager"
                ? "All team tickets, bottlenecks and pending reviews"
                : "Your tickets, blockers and overdue SME responses"}
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-[#9CA3AF]">
          {isInitialLiveLoad ? "Loading live workspace…" : hasLiveData ? "Live data: " : "Demo date: "}
          {!isInitialLiveLoad && `${fmtDate(referenceDate.toISOString())} · This week`}
        </span>
      </div>

      {isInitialLiveLoad ? (
        <DashboardLoading />
      ) : (
      <div className="flex-1 overflow-auto px-4 sm:px-8 py-7 flex flex-col gap-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#B8B5B0] mt-1.5 group-hover:text-[#C05600] transition-colors">
                {m.label}
              </p>
            </button>
          ))}
        </div>

        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card title="AI Coverage" className="overflow-hidden">
              <div className="px-4 py-4 flex items-center gap-4">
                <DonutChart percent={stats.aiCoveragePercent} />
                <div className="min-w-0">
                  <p className="text-[26px] font-black tracking-tight leading-none text-[#0A0A0A]">
                    {stats.aiCoveragePercent}%
                  </p>
                  <p className="text-[11px] text-[#6B7280] mt-1 leading-snug">
                    of confirmed answers came
                    <br />
                    from the knowledge base
                  </p>
                  <p className="text-[10px] text-[#9CA3AF] mt-1.5">
                    {stats.answeredFromKnowledgeBase} AI · {stats.answeredBySme}{" "}
                    SME/manual
                  </p>
                </div>
              </div>
            </Card>

            <Card title="SME Bottleneck" className="overflow-hidden">
              <div className="px-4 py-4">
                <p
                  className={`text-[26px] font-black tracking-tight leading-none ${overdueSmeCount > 0 ? "text-red-600" : "text-[#0A0A0A]"}`}
                >
                  {overdueSmeCount}
                </p>
                <p className="text-[11px] text-[#6B7280] mt-1.5">
                  overdue SME request{overdueSmeCount === 1 ? "" : "s"}
                </p>
              </div>
            </Card>

            <Card title="Processed" className="overflow-hidden">
              <div className="px-4 py-4">
                <p className="text-[26px] font-black tracking-tight leading-none text-[#0A0A0A]">
                  {stats.totalQuestions}
                </p>
                <p className="text-[11px] text-[#6B7280] mt-1.5">
                  questions across {stats.totalTickets} tickets
                </p>
              </div>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card
            title="My Priority Tickets"
            className="lg:col-span-3 overflow-hidden"
          >
            {priority.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No open tickets yet."
                hint="Create a ticket to begin."
              />
            ) : (
              <div className="overflow-x-auto">
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
                        <td className="px-4 py-2.5 text-[13px] font-mono font-bold text-[#1F2937]">
                          {t.id}
                        </td>
                        <td className="px-4 py-2.5 text-[13px] font-semibold text-[#1F2937]">
                          {t.customer}
                        </td>
                        <td className="px-4 py-2.5">
                          <Pill value={t.status} />
                        </td>
                        <td
                          className={`px-4 py-2.5 text-[13px] whitespace-nowrap ${isOverdueTicket(t) ? "text-red-600 font-semibold" : "text-[#374151]"}`}
                        >
                          {fmtDate(t.due)}
                          {isDueToday(t) && (
                            <span className="ml-1.5 text-[10px] font-bold text-[#C05600]">
                              TODAY
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-[#6B7280] whitespace-nowrap">
                          {t.owner}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="SME ETA Tracker"
            className="lg:col-span-2 overflow-hidden"
          >
            {activeSme.length === 0 ? (
              <EmptyState icon={Clock} title="No pending SME requests." />
            ) : (
              <div className="divide-y divide-border">
                {activeSme.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => actions.openTicket(r.ticketId)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${r.over ? "bg-red-50/40 hover:bg-red-50/70" : "hover:bg-gray-50/60"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1F2937]">
                        {r.department} · {r.assignee}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                        <span className="font-mono font-bold text-[#C05600]">
                          {r.ticketId}
                        </span>
                        {r.ticket ? ` ${r.ticket.customer}` : ""} · ETA{" "}
                        {r.eta ? fmtDateTime(r.eta) : "not set"}
                      </p>
                    </div>
                    <span className="text-[11px] text-[#6B7280] whitespace-nowrap">
                      {r.questionIds.length} question
                      {r.questionIds.length === 1 ? "" : "s"}
                    </span>
                    {r.over ? (
                      <span className="text-[10px] font-bold text-[#991B1B] bg-[#FEF2F2] border border-[#FCA5A5]/50 rounded-full px-2 py-0.5 whitespace-nowrap">
                        Overdue
                      </span>
                    ) : (
                      <ChevronRight
                        size={12}
                        className="text-[#C0BEBA] shrink-0"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card
            title="Recent Activity"
            className="lg:col-span-3 overflow-hidden"
          >
            {activity.length === 0 ? (
              <EmptyState icon={Activity} title="No activity yet." />
            ) : (
              <div className="divide-y divide-border">
                {activity.slice(0, 6).map((a) => (
                  <div
                    key={a.id}
                    className="px-4 py-2.5 flex items-start gap-2.5"
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${a.actor === "AI" ? "bg-[#4338CA]" : "bg-[#F96702]/60"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#374151]">
                        <span className="font-semibold">{a.actor}</span>{" "}
                        {a.action}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] mt-0.5">
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

          <Card
            title="Knowledge Pending Review"
            className="lg:col-span-2 overflow-hidden"
            right={
              <button
                onClick={() => actions.openKnowledge("pending")}
                className="text-[11px] font-bold text-white hover:underline flex items-center gap-0.5"
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
                    <p className="text-[13px] font-semibold text-[#1F2937]">
                      {k.title}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      {k.department} · submitted by {k.owner} ·{" "}
                      {fmtDate(k.lastUpdated)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="flex-1 overflow-auto px-4 sm:px-8 py-7 flex flex-col gap-5" aria-busy="true" aria-label="Loading live workspace data">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-sm px-4 py-3.5 animate-pulse">
            <div className="h-7 w-12 rounded bg-[#EEECE8]" />
            <div className="h-2.5 w-20 rounded bg-[#F3F1EE] mt-2.5" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-sm px-4 py-4 animate-pulse">
            <div className="h-2.5 w-24 rounded bg-[#EEECE8]" />
            <div className="h-7 w-14 rounded bg-[#F3F1EE] mt-3" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <LoadingCard title="My Priority Tickets" className="lg:col-span-3" rows={5} />
        <LoadingCard title="SME ETA Tracker" className="lg:col-span-2" rows={5} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <LoadingCard title="Recent Activity" className="lg:col-span-3" rows={4} />
        <LoadingCard title="Knowledge Pending Review" className="lg:col-span-2" rows={4} />
      </div>

      <div className="flex items-center justify-center gap-2 text-[12px] text-[#6B7280] py-1">
        <LoaderCircle size={14} className="text-[#F96702] animate-spin" />
        Loading live tickets, SME requests, and knowledge sources.
      </div>
    </div>
  );
}

function LoadingCard({ title, className, rows }: { title: string; className: string; rows: number }) {
  return (
    <Card title={title} className={`${className} overflow-hidden`}>
      <div className="animate-pulse divide-y divide-border">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="px-4 py-3 flex items-center gap-3">
            <div className="h-3 w-24 rounded bg-[#EEECE8]" />
            <div className="h-3 flex-1 rounded bg-[#F3F1EE]" />
            <div className="h-3 w-14 rounded bg-[#EEECE8]" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function DonutChart({ percent }: { percent: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 40 40"
      className="shrink-0 -rotate-90"
    >
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="#F1EFEC"
        strokeWidth="5"
      />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="#F96702"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c - filled}`}
      />
    </svg>
  );
}
