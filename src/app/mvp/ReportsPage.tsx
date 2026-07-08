import { useState } from "react";
import { BarChart3, Download, FileText, Loader2, Printer, Sparkles, X } from "lucide-react";
import { BtnPrimary, BtnSecondary } from "../components/shared";
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
  const [openReport, setOpenReport] = useState<MvpReport | null>(null);

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
        metrics: [
          { label: "Ticket Volume", value: String(m.volume) },
          { label: "Avg Completion (days)", value: m.avgCompletionDays },
          { label: "Avg SME Turnaround (days)", value: m.avgSmeTurnaroundDays },
          { label: "Overdue Tickets", value: String(m.overdue) },
          { label: "AI Acceptance Rate", value: m.aiAcceptance },
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
    URL.revokeObjectURL(url);
  };

  // Excel-friendly CSV of the metrics + summary
  const exportExcel = (r: MvpReport) => {
    const rows = [
      ["Report", r.title],
      ["Created by", r.createdBy],
      ["Created at", fmtDate(r.createdAt)],
      [],
      ["Metric", "Value"],
      ...r.metrics.map((m) => [m.label, m.value]),
      [],
      ["AI Summary", `"${r.summary.replace(/"/g, '""')}"`],
    ];
    downloadBlob(rows.map((row) => row.join(",")).join("\n"), "text/csv", `report-${r.id}.csv`);
    actions.addToast("Report exported for Excel (.csv).", "info");
  };

  // Print-friendly window — save as PDF from the browser dialog
  const exportPdf = (r: MvpReport) => {
    const w = window.open("", "_blank", "width=840,height=640");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${r.title}</title><style>
      body{font-family:Inter,system-ui,sans-serif;color:#1F2937;padding:36px;max-width:720px;margin:0 auto}
      h1{font-size:20px;border-left:4px solid #F96702;padding-left:12px}
      .meta{color:#6B7280;font-size:12px;margin-bottom:24px}
      table{border-collapse:collapse;width:100%;margin-bottom:24px}
      th{background:#F96702;color:#fff;text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase}
      td{border-bottom:1px solid #E5E7EB;padding:8px 12px;font-size:13px}
      .summary{background:#FFF7F0;border:1px solid #F9670233;border-radius:8px;padding:16px;font-size:13px;line-height:1.6}
    </style></head><body>
      <h1>${r.title}</h1>
      <p class="meta">${r.type} report · ${r.createdBy} · ${fmtDate(r.createdAt)}</p>
      <table><tr><th>Metric</th><th>Value</th></tr>
        ${r.metrics.map((m) => `<tr><td>${m.label}</td><td><strong>${m.value}</strong></td></tr>`).join("")}
      </table>
      <div class="summary"><strong>AI Executive Summary</strong><br/>${r.summary}</div>
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
                  <tr
                    key={r.id}
                    onClick={() => setOpenReport(r)}
                    title="Open the report in the app"
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-xs font-semibold text-[#1F2937]">{r.title}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6B7280]">{r.type}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6B7280] whitespace-nowrap">{r.createdBy}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6B7280] whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-2.5"><Pill value={r.status} /></td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenReport(r);
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-[9px] font-bold border border-[rgba(0,0,0,0.15)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] tracking-[0.06em] uppercase transition-all"
                      >
                        <FileText size={9} /> Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {openReport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[640px] max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-[#F96702] flex items-center gap-2 shrink-0">
              <p className="text-[10px] font-bold text-white uppercase tracking-[0.08em] flex-1">
                {openReport.title}
              </p>
              <button onClick={() => setOpenReport(null)} className="text-white/80 hover:text-white">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
              <p className="text-[11px] text-[#6B7280]">
                {openReport.type} report · generated by {openReport.createdBy} ·{" "}
                {fmtDate(openReport.createdAt)}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {openReport.metrics.map((m) => (
                  <div key={m.label} className="bg-[#FAFAF9] rounded-lg border border-[rgba(0,0,0,0.05)] px-3.5 py-3">
                    <p className="text-[20px] font-black tracking-tight leading-none text-[#0A0A0A]">
                      {m.value}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#B8B5B0] mt-1.5">
                      {m.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="bg-[#FFF7F0] border border-[#F96702]/20 rounded-lg p-4">
                <p className="text-[10px] font-bold text-[#C05600] uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <Sparkles size={11} /> AI Executive Summary
                </p>
                <p className="text-xs text-[#374151] leading-relaxed">{openReport.summary}</p>
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
