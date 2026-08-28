import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle, Edit3, RefreshCw, Send } from "lucide-react";
import { Card, EmptyState } from "../components/ui";
import { fmtDateTime } from "../data/model";
import {
  loadAiPerformance,
  RetrievalEvaluationRun,
  ReviewSummary,
} from "../services/backend";

const pct = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-4 min-w-0">
      <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-[0.12em]">{label}</p>
      <p className="text-2xl font-bold text-[#0A0A0A] mt-1.5">{value}</p>
      <p className="text-[11px] text-[#6B7280] mt-1">{detail}</p>
    </div>
  );
}

export function AiPerformancePage() {
  const [days, setDays] = useState(30);
  const [review, setReview] = useState<ReviewSummary | null>(null);
  const [runs, setRuns] = useState<RetrievalEvaluationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const result = await loadAiPerformance(days);
    if (!result) {
      setReview(null);
      setRuns([]);
      setError(true);
    } else {
      setReview(result.review);
      setRuns(result.runs);
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const completed = runs.find((run) => run.status === "COMPLETED") ?? null;
  const newestFailed = runs.find((run) => run.status === "FAILED") ?? null;
  const failedAfterSuccess = Boolean(
    newestFailed?.completedAt &&
      (!completed?.completedAt || newestFailed.completedAt > completed.completedAt),
  );
  const combinedEscalated = review
    ? review.counts.rejected + review.counts.escalated
    : 0;
  const outcomeRows = review
    ? [
        { label: "Accepted unchanged", value: review.counts.accepted, color: "bg-green-600", icon: CheckCircle },
        { label: "Edited by a reviewer", value: review.counts.edited, color: "bg-[#2563EB]", icon: Edit3 },
        { label: "Escalated to SME or AE", value: combinedEscalated, color: "bg-[#F96702]", icon: Send },
      ]
    : [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 sm:px-8 pt-7 pb-5 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0 flex items-center gap-3">
        <div className="w-[3px] h-7 bg-[#F96702] rounded-full shrink-0" />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">AI Performance</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Human review outcomes and offline retrieval benchmark results
          </p>
        </div>
        <label className="text-[11px] font-semibold text-[#6B7280] flex items-center gap-2">
          Reporting period
          <select
            aria-label="Reporting period"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="border border-[rgba(0,0,0,0.15)] rounded-full bg-white px-3 py-1.5 text-[12px] text-[#1F2937]"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
      </div>

      <div className="flex-1 overflow-auto px-4 sm:px-8 py-7 flex flex-col gap-5">
        {loading ? (
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-10 text-center text-[13px] text-[#6B7280]">
            Loading AI performance metrics…
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-red-100 p-8 flex flex-col items-center gap-3 text-center">
            <AlertTriangle size={22} className="text-red-500" />
            <div>
              <p className="text-sm font-semibold text-[#1F2937]">AI performance data is unavailable</p>
              <p className="text-[12px] text-[#6B7280] mt-1">The backend did not return analytics data. No demo KPI has been substituted.</p>
            </div>
            <button onClick={() => void load()} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#F96702] text-white text-[11px] font-bold uppercase tracking-[0.06em]">
              <RefreshCw size={11} /> Retry
            </button>
          </div>
        ) : review ? (
          <>
            <section aria-labelledby="human-review-heading" className="flex flex-col gap-3">
              <div>
                <h2 id="human-review-heading" className="text-base font-bold text-[#1F2937]">Human Review Outcomes</h2>
                <p className="text-[12px] text-[#6B7280] mt-0.5">Latest outcome per AI-assisted question, using UTC decision timestamps.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <MetricCard label="AI Suggestions Reviewed" value={String(review.reviewed)} detail={`Last ${days} days`} />
                <MetricCard label="Direct Acceptance Rate" value={pct(review.rates.directAcceptance)} detail={`${review.counts.accepted} accepted unchanged`} />
                <MetricCard label="Human Edit Rate" value={pct(review.rates.humanEdit)} detail={`${review.counts.edited} edited before approval`} />
                <MetricCard label="Rejected or Escalated Rate" value={pct(review.rates.rejectedOrEscalated)} detail={`${combinedEscalated} escalated, no Reject action in V1`} />
              </div>

              <Card title="Outcome Distribution">
                {review.reviewed === 0 ? (
                  <EmptyState icon={BarChart3} title="No reviewed AI suggestions in this period." />
                ) : (
                  <div className="px-4 py-4 space-y-3" role="img" aria-label={`Review outcomes: ${review.counts.accepted} accepted, ${review.counts.edited} edited, ${combinedEscalated} escalated`}>
                    {outcomeRows.map(({ label, value, color, icon: Icon }) => {
                      const width = (value / review.reviewed) * 100;
                      return (
                        <div key={label}>
                          <div className="flex items-center gap-2 text-[12px] mb-1.5">
                            <Icon size={12} className="text-[#6B7280]" />
                            <span className="text-[#374151] font-medium flex-1">{label}</span>
                            <span className="text-[#1F2937] font-bold">{value} · {width.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-[#ECEAE7] overflow-hidden">
                            <div className={`h-full ${color} rounded-full`} style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </section>

            <section aria-labelledby="retrieval-heading" className="flex flex-col gap-3">
              <div>
                <h2 id="retrieval-heading" className="text-base font-bold text-[#1F2937]">Retrieval Evaluation</h2>
                <p className="text-[12px] text-[#6B7280] mt-0.5">Offline benchmark results, not live production answer accuracy.</p>
              </div>
              {failedAfterSuccess && (
                <div className="bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-lg px-3.5 py-2.5 text-[12px] text-[#92400E] flex items-center gap-2">
                  <AlertTriangle size={12} /> A newer evaluation failed. The last successful result remains visible.
                </div>
              )}
              {!completed ? (
                <Card title="Offline Benchmark">
                  <EmptyState icon={BarChart3} title="No completed evaluation run." />
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <MetricCard label="Evaluation Cases" value={String(completed.evaluationCases)} detail={`${completed.failedCases} failed · ${completed.skippedCases} skipped`} />
                    <MetricCard label="Top-1 Hit Rate" value={pct(completed.top1HitRate)} detail={`${completed.top1Hits} expected sources ranked first`} />
                    <MetricCard label="Top-3 Hit Rate" value={pct(completed.top3HitRate)} detail={`${completed.top3Hits} expected sources in the first three`} />
                  </div>
                  <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                    <p><span className="text-[#9CA3AF]">Latest completed run:</span> <strong className="text-[#374151]">{fmtDateTime(completed.completedAt)}</strong></p>
                    <p><span className="text-[#9CA3AF]">Dataset:</span> <strong className="text-[#374151]">{completed.datasetVersion ?? "—"}</strong></p>
                  </div>
                </>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
