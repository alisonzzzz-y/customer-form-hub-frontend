import { useState } from "react";
import { BarChart3, Download, FileText, Loader2, Printer, Sparkles, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BtnPrimary, BtnSecondary } from "../components/ui";
import {
  DEPARTMENTS,
  MvpReport,
  fmtDate,
  isOverdueTicket,
  ticketReferenceNow,
} from "../data/model";
import { AppActions, AppState } from "../AppShell";
import { Card, EmptyState, FilterSelect, Pill, Th } from "../components/ui";

const RANGES = ["This week", "This month", "Last 30 days", "All time"];

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

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
  const [openReport, setOpenReport] = useState<MvpReport | null>(null);

  const companies = [...new Set(state.tickets.map((t) => t.customer))];

  const RESOLVED = ["Approved", "Ready", "SME Complete"];
  const openProgress = state.tickets
    .filter((t) => !["Closed", "Archived", "Sent"].includes(t.status))
    .map((t) => {
      const tq = state.questions.filter((q) => q.ticketId === t.id);
      const pct = tq.length
        ? Math.round((tq.filter((q) => RESOLVED.includes(q.status)).length / tq.length) * 100)
        : 0;
      return { name: `${t.id} · ${t.customer}`, progress: pct, remaining: 100 - pct };
    })
    .sort((a, b) => b.progress - a.progress);
  // Limit the chart to ten tickets so it remains readable.
  const progressData = openProgress.slice(0, 10);
  const progressOverflow = openProgress.length - progressData.length;

  const STATUS_COLORS: Record<string, string> = {
    New: "#4338CA", "AI Processing": "#6366F1", "Intake Review": "#F59E0B",
    "In Progress": "#1F2937", "Waiting SME": "#EAB308", "Ready for Review": "#10B981",
    Approved: "#16A34A", Sent: "#16A34A", Closed: "#9CA3AF",
  };
  const statusData = Object.entries(
    state.tickets
      .filter((t) => t.status !== "Archived")
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.status] = (acc[t.status] ?? 0) + 1;
        return acc;
      }, {}),
  ).map(([name, value]) => ({ name, value }));

  const deptSet = [...new Set(state.questions.map((q) => q.department))];
  const deptData = deptSet
    .map((d) => {
      const dq = state.questions.filter((q) => q.department === d);
      return {
        dept: d,
        Resolved: dq.filter((q) => RESOLVED.includes(q.status)).length,
        "With SME": dq.filter((q) => ["Waiting SME", "SME Queued"].includes(q.status)).length,
        Open: dq.filter(
          (q) => !RESOLVED.includes(q.status) && !["Waiting SME", "SME Queued"].includes(q.status),
        ).length,
      };
    })
    .filter((d) => d.Resolved + d["With SME"] + d.Open > 0);

  const compute = (): Metrics => {
    let ts = state.tickets;
    if (status !== "All") ts = ts.filter((t) => t.status === status);
    if (company !== "All") ts = ts.filter((t) => t.customer === company);
    if (dept !== "All")
      ts = ts.filter((t) =>
        state.questions.some((q) => q.ticketId === t.id && q.department === dept),
      );
    if (range === "This week") {
      ts = ts.filter(
        (t) =>
          new Date(t.created) >=
          new Date(ticketReferenceNow(t).getTime() - 7 * 24 * 3600 * 1000),
      );
    } else if (range === "This month") {
      ts = ts.filter((t) => {
        const now = ticketReferenceNow(t);
        const monthStart = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
        );
        return new Date(t.created) >= monthStart;
      });
    } else if (range === "Last 30 days") {
      ts = ts.filter(
        (t) =>
          new Date(t.created) >=
          new Date(ticketReferenceNow(t).getTime() - 30 * 24 * 3600 * 1000),
      );
    }

    const selectedTicketIds = new Set(ts.map((t) => t.id));
    const selectedQuestions = state.questions.filter(
      (q) =>
        selectedTicketIds.has(q.ticketId) &&
        (dept === "All" || q.department === dept),
    );

    const closed = ts.filter((t) => t.closed);
    const avgCompletion = closed.length
      ? closed.reduce(
          (s, t) => s + (new Date(t.closed!).getTime() - new Date(t.created).getTime()), 0,
        ) / closed.length / 86400000
      : 0;

    const returned = state.smeRequests.filter(
      (r) =>
        selectedTicketIds.has(r.ticketId) &&
        (dept === "All" || r.department === dept) &&
        r.returnedAt,
    );
    const avgSme = returned.length
      ? returned.reduce(
          (s, r) => s + (new Date(r.returnedAt!).getTime() - new Date(r.sentAt).getTime()), 0,
        ) / returned.length / 86400000
      : 0;

    const reviewed = selectedQuestions.filter(
      (q) => q.finalAnswer || q.status === "Rejected",
    );
    const accepted = reviewed.filter(
      (q) => q.finalAnswer?.sourceType === "AI",
    );
    const answered = selectedQuestions.filter((q) => q.finalAnswer);
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
      const s = `In the selected period (${range.toLowerCase()}${dept !== "All" ? `, ${dept} department` : ""}${company !== "All" ? `, ${company}` : ""}), the team handled ${m.volume} ticket(s) with ${m.overdue} currently overdue. Average completion time was ${m.avgCompletionDays} day(s) and SME turnaround averaged ${m.avgSmeTurnaroundDays} day(s). AI suggestions were accepted unchanged at a rate of ${m.aiAcceptance}, with ${m.knowledgeReuse} of final answers reusing approved knowledge. ${m.overdue > 0 ? "The main bottleneck is overdue tickets — review their deadlines and outstanding SME ETAs." : "No structural bottlenecks detected in this period."}`;
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
        metrics: [
          { label: "Ticket Volume", value: String(m.volume) },
          { label: "Avg Completion (days)", value: m.avgCompletionDays },
          { label: "Avg SME Turnaround (days)", value: m.avgSmeTurnaroundDays },
          { label: "Overdue Tickets", value: String(m.overdue) },
          { label: "Direct AI Acceptance Rate", value: m.aiAcceptance },
          { label: "Knowledge Reuse Rate", value: m.knowledgeReuse },
        ],
        status: "Ready",
      };
      setReports((p) => [rec, ...p]);
      actions.logActivity(`Generated operational report (${rec.title})`);
      setGenerating(false);
      actions.addToast("Report generated and saved.", "success");
    }, 900);
  };

  const downloadBlob = (content: string, mime: string, name: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  // Export the report as a CSV file that Excel can open.
  const exportExcel = (r: MvpReport) => {
    const rows = [
      ["Report", r.title],
      ["Created by", r.createdBy],
      ["Created at", fmtDate(r.createdAt)],
      [],
      ["Metric", "Value"],
      ...r.metrics.map((m) => [m.label, m.value]),
      [],
      ["AI Summary", r.summary],
    ];
    downloadBlob(
      rows.map((row) => row.map((cell) => csvCell(String(cell))).join(",")).join("\n"),
      "text/csv",
      `report-${r.id}.csv`,
    );
    actions.addToast("Report exported for Excel (.csv).", "info");
  };

  // Open a printable report that can be saved as a PDF.
  const exportPdf = (r: MvpReport) => {
    const w = window.open("", "_blank", "width=840,height=640");
    if (!w) return;
    const title = escapeHtml(r.title);
    const type = escapeHtml(r.type);
    const createdBy = escapeHtml(r.createdBy);
    const summaryText = escapeHtml(r.summary);
    const metricRows = r.metrics
      .map(
        (metric) =>
          `<tr><td>${escapeHtml(metric.label)}</td><td><strong>${escapeHtml(metric.value)}</strong></td></tr>`,
      )
      .join("");
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      body{font-family:Inter,system-ui,sans-serif;color:#1F2937;padding:36px;max-width:720px;margin:0 auto}
      h1{font-size:20px;border-left:4px solid #F96702;padding-left:12px}
      .meta{color:#6B7280;font-size:12px;margin-bottom:24px}
      table{border-collapse:collapse;width:100%;margin-bottom:24px}
      th{background:#F96702;color:#fff;text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase}
      td{border-bottom:1px solid #E5E7EB;padding:8px 12px;font-size:13px}
      .summary{background:#FFF7F0;border:1px solid #F9670233;border-radius:8px;padding:16px;font-size:13px;line-height:1.6}
    </style></head><body>
      <h1>${title}</h1>
      <p class="meta">${type} report · ${createdBy} · ${fmtDate(r.createdAt)}</p>
      <table><tr><th>Metric</th><th>Value</th></tr>
        ${metricRows}
      </table>
      <div class="summary"><strong>AI Executive Summary</strong><br/>${summaryText}</div>
      <script>window.onload = () => window.print();</` + `script></body></html>`);
    w.document.close();
    actions.addToast("Print dialog opened — choose 'Save as PDF'.", "info");
  };

  const metricCards = metrics
    ? [
        { label: "Ticket Volume", value: String(metrics.volume) },
        { label: "Avg Completion (days)", value: metrics.avgCompletionDays },
        { label: "Avg SME Turnaround (days)", value: metrics.avgSmeTurnaroundDays },
        { label: "Overdue Tickets", value: String(metrics.overdue), accent: metrics.overdue > 0 },
        { label: "Direct AI Acceptance Rate", value: metrics.aiAcceptance },
        { label: "Knowledge Reuse Rate", value: metrics.knowledgeReuse },
      ]
    : [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 sm:px-8 pt-7 pb-5 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0 flex items-center gap-3">
        <div className="w-[3px] h-7 bg-[#F96702] rounded-full shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Reports</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Operational insight for managers — metrics first, AI narrative second
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-4 sm:px-8 py-7 flex flex-col gap-5">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card title="Ticket Progress — open tickets" className="lg:col-span-2">
            <div className="px-2 py-2" style={{ height: Math.max(180, progressData.length * 34 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressData} layout="vertical" margin={{ left: 8, right: 28, top: 4 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tick={{ fontSize: 10, fill: "#6B7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ChartTooltip
                    formatter={(v: number, key: string) => [`${v}%`, key === "progress" ? "Resolved" : "Remaining"]}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Bar dataKey="progress" stackId="p" fill="#F96702" radius={[4, 0, 0, 4]} isAnimationActive={false} />
                  <Bar dataKey="remaining" stackId="p" fill="#F0EEEB" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {progressOverflow > 0 && (
              <p className="px-4 pb-2.5 text-[11px] text-[#9CA3AF]">
                Showing the 10 most-resolved of {openProgress.length} open tickets — see the
                Tickets module for the full list.
              </p>
            )}
          </Card>
          <Card title="Status Mix" className="lg:col-span-1">
            <div className="px-2 py-2 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="52%"
                    outerRadius="80%"
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {statusData.map((d) => (
                      <Cell key={d.name} fill={STATUS_COLORS[d.name] ?? "#D8D5D0"} />
                    ))}
                  </Pie>
                  <ChartTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="px-3 pb-2.5 flex flex-wrap gap-x-3 gap-y-1">
              {statusData.map((d) => (
                <span key={d.name} className="flex items-center gap-1 text-[10px] text-[#6B7280]">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: STATUS_COLORS[d.name] ?? "#D8D5D0" }}
                  />
                  {d.name} ({d.value})
                </span>
              ))}
            </div>
          </Card>
          <Card title="Questions by Department" className="lg:col-span-2">
            <div className="px-2 py-2 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} margin={{ top: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEECE9" vertical={false} />
                  <XAxis dataKey="dept" tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} width={24} />
                  <ChartTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="Resolved" stackId="q" fill="#16A34A" isAnimationActive={false} />
                  <Bar dataKey="With SME" stackId="q" fill="#EAB308" isAnimationActive={false} />
                  <Bar dataKey="Open" stackId="q" fill="#F96702" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="px-3 pb-2.5 flex gap-3">
              {[["Resolved", "#16A34A"], ["With SME", "#EAB308"], ["Open", "#F96702"]].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1 text-[10px] text-[#6B7280]">
                  <span className="w-2 h-2 rounded-full" style={{ background: c }} /> {l}
                </span>
              ))}
            </div>
          </Card>
        </div>

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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {metricCards.map((m) => (
                <div key={m.label} className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-sm px-4 py-3.5">
                  <p className={`text-[22px] font-black tracking-tight leading-none ${m.accent ? "text-red-600" : "text-[#0A0A0A]"}`}>
                    {m.value}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#B8B5B0] mt-1.5">{m.label}</p>
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
              <p className="px-4 py-3 text-[13px] text-[#374151] leading-relaxed">{summary}</p>
            </Card>
          </>
        )}

        {reports.length > 0 && (
          <Card title="Saved Reports">
            <div className="overflow-x-auto"><table className="w-full">
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
                  <tr
                    key={r.id}
                    onClick={() => setOpenReport(r)}
                    title="Open the report in the app"
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-[13px] font-semibold text-[#1F2937]">{r.title}</td>
                    <td className="px-4 py-2.5 text-[13px] text-[#6B7280]">{r.type}</td>
                    <td className="px-4 py-2.5 text-[13px] text-[#6B7280] whitespace-nowrap">{r.createdBy}</td>
                    <td className="px-4 py-2.5 text-[13px] text-[#6B7280] whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-2.5"><Pill value={r.status} /></td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenReport(r);
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold border border-[rgba(0,0,0,0.15)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] tracking-[0.06em] uppercase transition-all"
                      >
                        <FileText size={9} /> Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
        )}
      </div>

      {openReport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[640px] max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-[#F96702] flex items-center gap-2 shrink-0">
              <p className="text-[11px] font-bold text-white uppercase tracking-[0.08em] flex-1">
                {openReport.title}
              </p>
              <button onClick={() => setOpenReport(null)} className="text-white/80 hover:text-white">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
              <p className="text-[12px] text-[#6B7280]">
                {openReport.type} report · generated by {openReport.createdBy} ·{" "}
                {fmtDate(openReport.createdAt)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {openReport.metrics.map((m) => (
                  <div key={m.label} className="bg-[#FAFAF9] rounded-lg border border-[rgba(0,0,0,0.05)] px-3.5 py-3">
                    <p className="text-[20px] font-black tracking-tight leading-none text-[#0A0A0A]">
                      {m.value}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#B8B5B0] mt-1.5">
                      {m.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="bg-[#FFF7F0] border border-[#F96702]/20 rounded-lg p-4">
                <p className="text-[11px] font-bold text-[#C05600] uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <Sparkles size={11} /> AI Executive Summary
                </p>
                <p className="text-[13px] text-[#374151] leading-relaxed">{openReport.summary}</p>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center gap-2 bg-[#FAFAFA] shrink-0">
              <span title="Opens the print dialog — choose 'Save as PDF' there">
                <BtnPrimary onClick={() => exportPdf(openReport)}>
                  <Printer size={11} /> Export PDF
                </BtnPrimary>
              </span>
              <span title="Downloads a .csv that opens directly in Excel">
                <BtnSecondary onClick={() => exportExcel(openReport)}>
                  <Download size={11} /> Export Excel
                </BtnSecondary>
              </span>
              <span className="flex-1" />
              <BtnSecondary onClick={() => setOpenReport(null)}>Close</BtnSecondary>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
