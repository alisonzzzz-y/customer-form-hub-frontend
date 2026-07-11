import { useState } from "react";
import { Copy, ExternalLink, Loader2, Lock, Search, Sparkles } from "lucide-react";
import { MvpKnowledgeEntry } from "../data/model";
import { AppActions, AppState } from "../MvpApp";
import { mapSharing, ragSearch } from "../services/backend";
import { Card, ConfidenceBadge, EmptyState, SharingBadge } from "../components/ui";

// PRD §12: standalone, citation-first lookup over APPROVED knowledge only.
// Shows "no answer" rather than inventing content (AIS-06).

type SearchOutcome =
  | { kind: "hit"; entry: MvpKnowledgeEntry; confidence: number; related: MvpKnowledgeEntry[] }
  | { kind: "miss" };

function scoreEntry(entry: MvpKnowledgeEntry, query: string): number {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  if (words.length === 0) return 0;
  const hay = `${entry.title} ${entry.content} ${entry.tags.join(" ")}`.toLowerCase();
  const hits = words.filter((w) => hay.includes(w)).length;
  return hits / words.length;
}

export function AiSearchPage({ state, actions }: { state: AppState; actions: AppActions }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchOutcome | null>(null);

  const run = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResult(null);

    // Live semantic search first (POST /api/knowledge-base/search)
    const live = await ragSearch(query.trim());
    if (live !== null) {
      const usable = live; // backend applies its own similarity threshold
      if (usable.length === 0) {
        setResult({ kind: "miss" });
      } else {
        const toEntry = (r: (typeof usable)[number]): MvpKnowledgeEntry => ({
          id: r.id,
          title: `${r.documentTitle} — ${r.sectionTitle}`,
          content: r.content,
          department: r.department,
          source: r.source,
          lastUpdated: r.lastUpdated?.slice(0, 10) ?? "—",
          sharingStatus: mapSharing(r.sharingStatus),
          status: "Approved",
          tags: [],
          owner: r.department,
        });
        setResult({
          kind: "hit",
          entry: toEntry(usable[0]),
          confidence: usable[0].similarityScore ?? 0.5,
          related: usable.slice(1, 4).map(toEntry),
        });
      }
      setSearching(false);
      return;
    }

    // Fallback: simulated retrieval over seeded approved entries (AIS-01, KB-05)
    setTimeout(() => {
      const approved = state.knowledge.filter((k) => k.status === "Approved");
      const ranked = approved
        .map((k) => ({ k, s: scoreEntry(k, query) }))
        .filter((x) => x.s > 0.3)
        .sort((a, b) => b.s - a.s);
      if (ranked.length === 0) {
        setResult({ kind: "miss" });
      } else {
        const top = ranked[0];
        setResult({
          kind: "hit",
          entry: top.k,
          confidence: Math.min(0.97, 0.55 + top.s * 0.4),
          related: ranked.slice(1, 4).map((x) => x.k),
        });
      }
      setSearching(false);
    }, 700);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-7 pt-6 pb-4 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0 flex items-center gap-3">
        <div className="w-[3px] h-7 bg-[#F96702] rounded-full shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">AI Search</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Quick answers from approved knowledge — citation-first, never invented
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          <div className="relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="Ask a question, e.g. do we hold ISO 27001?"
              autoFocus
              className="w-full pl-10 pr-24 py-3 text-sm border border-[rgba(0,0,0,0.12)] rounded-2xl bg-white placeholder-[#B0B0B0] focus:outline-none focus:ring-2 focus:ring-[#F96702]/30 focus:border-[#F96702]/50 shadow-sm transition-all"
            />
            <button
              onClick={run}
              disabled={searching || !query.trim()}
              className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase transition-all ${searching || !query.trim() ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : "bg-[#F96702] text-white hover:bg-[#D95400]"}`}
            >
              {searching ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              Search
            </button>
          </div>

          {!result && !searching && (
            <EmptyState
              icon={Sparkles}
              title="Ask a question to search approved knowledge."
              hint="Answers cite their source entries with confidence and last-updated dates."
            />
          )}

          {searching && (
            <div className="flex items-center justify-center gap-2 py-12 text-[#9CA3AF]">
              <Loader2 size={16} className="animate-spin text-[#F96702]" />
              <span className="text-xs">Searching approved knowledge…</span>
            </div>
          )}

          {result?.kind === "miss" && (
            <Card>
              <div className="px-4 py-4">
                <p className="text-xs font-semibold text-[#1F2937]">No approved answer found.</p>
                <p className="text-xs text-[#6B7280] mt-1">
                  Nothing in the approved Knowledge Base matches this question. Consider requesting
                  SME input from a ticket, or submitting a new knowledge entry for review.
                </p>
              </div>
            </Card>
          )}

          {result?.kind === "hit" && (
            <>
              <div className="border border-[#F96702]/25 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="px-4 py-2.5 bg-[#FFF4EC] flex items-center gap-2">
                  <Sparkles size={12} className="text-[#C05600]" />
                  <p className="text-[10px] font-bold text-[#C05600] uppercase tracking-wide flex-1">
                    Direct answer draft — AI-generated suggestion
                  </p>
                  <ConfidenceBadge confidence={result.confidence} />
                  <SharingBadge status={result.entry.sharingStatus} />
                </div>
                <div className="px-4 py-3.5 text-sm text-[#374151] leading-relaxed">
                  {result.entry.content}
                </div>
                {result.entry.sharingStatus === "NDA Required" && (
                  <div className="mx-4 mb-3 bg-[#FEF2F2] border border-[#FCA5A5]/50 rounded-md px-3 py-2 flex items-start gap-2">
                    <Lock size={11} className="text-[#991B1B] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#991B1B]">
                      This answer is NDA-restricted. Confirm the customer NDA before sharing
                      (AIS-05).
                    </p>
                  </div>
                )}
                <div className="px-4 py-2.5 bg-[#FAFAFA] border-t border-border flex items-center gap-4 text-[10px] text-[#6B7280]">
                  <span>
                    <strong>Source:</strong> {result.entry.title}
                  </span>
                  <span>
                    <strong>Last updated:</strong> {result.entry.lastUpdated} (UTC)
                  </span>
                  <span>
                    <strong>Dept:</strong> {result.entry.department}
                  </span>
                </div>
                <div className="px-4 py-2.5 border-t border-border flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.entry.content);
                      actions.addToast("Answer copied.", "info");
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold bg-[#F96702] text-white rounded-full hover:bg-[#D95400] tracking-[0.06em] uppercase transition-all"
                  >
                    <Copy size={10} /> Copy Answer
                  </button>
                  <button
                    onClick={() => actions.openKnowledge("all", result.entry.id)}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-semibold border border-[rgba(0,0,0,0.15)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] transition-all"
                  >
                    <ExternalLink size={10} /> Open Source Entry
                  </button>
                </div>
              </div>

              {result.related.length > 0 && (
                <Card title="Related Knowledge Entries">
                  <div className="divide-y divide-border">
                    {result.related.map((k) => (
                      <button
                        key={k.id}
                        onClick={() => actions.openKnowledge("all", k.id)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50/60 transition-colors flex items-center gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#1F2937]">{k.title}</p>
                          <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                            {k.department} · updated {k.lastUpdated} (UTC)
                          </p>
                        </div>
                        <SharingBadge status={k.sharingStatus} />
                      </button>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
