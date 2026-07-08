import { useState } from "react";
import { BarChart3, Download, Loader2, Sparkles } from "lucide-react";
import { BtnPrimary } from "../components/shared";
import { DEPARTMENTS, MOCK_NOW, MvpReport, fmtDate, isOverdueTicket } from "./data";
import { AppActions, AppState } from "./MvpApp";
import { Card, EmptyState, FilterSelect, Pill, Th } from "./ui";

// PRD §13: manager-oriented operational summaries. Metrics before AI
// narrative; generated reports persist as records (RP-08); export JSON as the
// minimum viable export (RP-09).

const RANGES = ["This week", "This month", "Last 30 days", "All time"];

type Metrics = {
  volume: number;
  avgCompletionDays: string;
  avgSmeTurnaroundDays: string;
  overdue: number;
  aiAcceptance: string;
  knowledgeReuse: string;
};

export function ReportsPage({ state, actions }: { state: AppState; actions: AppActions }) {
  const [range, setRange] = useState("This month");
  const [status, setStatus] = useState("All");
  const [company, setCompany] = useState("All");
  const [dept, setDept] = useState("All");
  const [generating, setGenerating] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [summary, setSummary] = useState("");
  const [reports, setReports] = useState<MvpReport[]>([]);

  const companies = [...new Set(state.tickets.map((t) => t.customer))];

  const compute = (): Metrics => {
    let ts = state.tickets;
    if (status !== "All") ts = ts.filter((t) => t.status === status);
    if (company !== "All") ts = ts.filter((t) => t.customer === company);
    if (dept !== "All")
      ts = ts.filter((t) =>
        state.questions.some((q) => q.ticketId === t.id && q.department === dept),
      );
    if (range === "This week") {
      const weekAgo = new Date(MOCK_NOW.getTime() - 7 * 24 * 3600 * 1000);
      ts = ts.filter((t) => new Date(t.created) >= weekAgo);
    } else if (range === "This month" || range === "Last 30 days") {
      const monthAgo = new Date(MOCK_NOW.getTime() - 30 * 24 * 3600 * 1000);
      ts = ts.filter((t) => new Date(t.created) >= monthAgo);
    }

    const closed = ts.filter((t) => t.closed);
    const avgCompletion = closed.length
      ? closed.reduce(
          (s, t) => s + (new Date(t.closed!).getTime() - new Date(t.created).getTime()), 0,
        ) / closed.length / 86400000
      : 0;

    const returned = state.smeRequests.filter((r) => r.returnedAt);
    const avgSme = returned.length
      ? returned.reduce(
          (s, r) => s + (new Date(r.returnedAt!).getTime() - new Date(r.sentAt).getTime()), 0,
        ) / returned.length / 86400000
      : 0;

    const reviewed = state.questions.filter(
      (q) => q.finalAnswer || q.status === "Rejected",
    );
    const accepted = reviewed.filter(
      (q) => q.finalAnswer && ["AI", "AI Edited"].includes(q.finalAnswer.sourceType),
    );
    const answered = state.questions.filter((q) => q.finalAnswer);
    const fromKnowledge = answered.filter(
      (q) => q.finalAnswer!.sourceType === "AI" || q.finalAnswer!.sourceType === "AI Edited",
    );

    return {
      volume: ts.length,
      avgCompletionDays: avgCompletion ? avgCompletion.toFixed(1) : "—",
      avgSmeTurnaroundDays: avgSme ? avgSme.toFixed(1) : "—",
      overdue: ts.filter(isOverdueTicket).length,
      aiAcceptance: reviewed.length
        ? `${Math.round((accepted.length / reviewed.length) * 100)}%`
        : "—",
      knowledgeReuse: answered.length
        ? `${Math.round((fromKnowledge.length / answered.length) * 100)}%`
        : "—",
    };
  };

  const generate = () => {
    setGenerating(true);
    setMetrics(null);
    setTimeout(() => {
      const m = compute();
      const s = `In the selected period (${range.toLowerCase()}${dept !== "All" ? `, ${dept} department` : ""}${company !== "All" ? `, ${company}` : ""}), the team handled ${m.volume} ticket(s) with ${m.overdue} currently overdue. Average completion time was ${m.avgCompletionDays} day(s) and SME turnaround averaged ${m.avgSmeTurnaroundDays} day(s). AI suggestions were accepted at a rate of ${m.aiAcceptance}, with ${m.knowledgeReuse} of final answers reusing approved knowledge. ${m.overdue > 0 ? "The main bottleneck is overdue SME responses — consider reviewing department ETAs." : "No structural bottlenecks detected in this period."}`;
      setMetrics(m);
      setSummary(s);
      const rec: MvpReport = {
        id: Date.now(),
        title: `${range} · ${status === "All" ? "All statuses" : status}${dept !== "All" ? ` · ${dept}` : ""}${company !== "All" ? ` · ${company}` : ""}`,
        type: "Operational",
        createdBy: state.currentUser,
        createdAt: new Date().toISOString(),
        filters: JSON.stringify({ range, status, company, dept }),
        summary: s,
        status: "Ready",
      };
      setReports((p) => [rec, ...p]);
      actions.logActivity(`Generated operational report (${rec.title})`);
      setGenerating(false);
      actions.addToast("Report generated and saved.", "success");
    }, 900);
  };

  const exportJson = (r: MvpReport) => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${r.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    actions.addToast("Report exported as JSON.", "info");
  };

  const metricCards = metrics
    ? [
        { label: "Ticket Volume", value: String(metrics.volume) },
        { label: "Avg Completion (days)", value: metrics.avgCompletionDays },
        { label: "Avg SME Turnaround (days)", value: metrics.avgSmeTurnaroundDays },
        { label: "Overdue Tickets", value: String(metrics.overdue), accent: metrics.overdue > 0 },
        { label: "AI Acceptance Rate", value: metrics.aiAcceptance },
        { label: "Knowledge Reuse Rate", value: metrics.knowledgeReuse },
      ]
    : [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-7 pt-6 pb-4 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0 flex items-center gap-3">
        <div className="w-[3px] h-7 bg-[#F96702] rounded-full shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Reports</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Operational insight for managers — metrics first, AI narrative second
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-8 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect label="Range" value={range === "This month" ? "This month" : range} options={RANGES} onChange={(v) => setRange(v === "All" ? "All time" : v)} />
          <FilterSelect
            label="Status"
            value={status}
            options={["New", "Intake Review", "In Progress", "Waiting SME", "Ready for Review", "Approved", "Sent", "Closed", "Archived"]}
            onChange={setStatus}
          />
          <FilterSelect label="Company" value={company} options={companies} onChange={setCompany} />
          <FilterSelect label="Department" value={dept} options={DEPARTMENTS} onChange={setDept} />
          <BtnPrimary onClick={generate} disabled={generating} className="ml-auto">
            {generating ? (
              <>
                <Loader2 size={11} className="animate-spin" /> Generating…
              </>
            ) : (
              <>
                <BarChart3 size={11} /> Generate Report
              </>
            )}
          </BtnPrimary>
        </div>

        {!metrics && !generating && reports.length === 0 && (
          <EmptyState
            icon={BarChart3}
            title="No reports generated yet."
            hint="Select filters and generate your first operational report."
          />
        )}

        {metrics && (
          <>
            <div className="grid grid-cols-6 gap-3">
              {metricCards.map((m) => (
                <div key={m.label} className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-sm px-4 py-3.5">
                  <p className={`text-[22px] font-black tracking-tight leading-none ${m.accent ? "text-red-600" : "text-[#0A0A0A]"}`}>
                    {m.value}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#B8B5B0] mt-1.5">{m.label}</p>
                </div>
              ))}
            </div>
            <Card
              title={
                <span className="flex items-center gap-1.5 text-white">
                  <Sparkles size={11} /> AI Executive Summary — draft
                </span>
              }
            >
              <p className="px-4 py-3 text-xs text-[#374151] leading-relaxed">{summary}</p>
            </Card>
          </>
        )}

        {reports.length > 0 && (
          <Card title="Saved Reports">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Type</Th>
                  <Th>Created By</Th>
                  <Th>Created At</Th>
                  <Th>Status</Th>
                  <Th>Export</Th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-xs font-semibold text-[#1F2937]">{r.title}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6B7280]">{r.type}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6B7280] whitespace-nowrap">{r.createdBy}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6B7280] whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-2.5"><Pill value={r.status} /></td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => exportJson(r)}
                        className="flex items-center gap-1 px-3 py-1 text-[9px] font-bold border border-[rgba(0,0,0,0.15)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] tracking-[0.06em] uppercase transition-all"
                      >
                        <Download size={9} /> JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
