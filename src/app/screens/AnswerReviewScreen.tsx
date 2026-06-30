import { useState } from "react";
import {
  Search,
  Brain,
  Clock,
  Shield,
  Loader2,
  ExternalLink,
  CheckCircle,
  ChevronRight,
  AlertTriangle,
  Edit3,
  RefreshCw,
  X,
} from "lucide-react";
import { searchKnowledgeBase, SearchResult, Ticket } from "../api";
import { Screen, ToastMsg } from "../types";
import { PageHeader, WorkflowStepper, BtnPrimary } from "../components/shared";

// Bold every word that starts with a search keyword.
// Searching "encrypt" will also catch "encrypted", "encryption", etc.
function highlightKeywords(text: string, query: string) {
  if (!query.trim()) return text;

  // Common words we don't want to bold
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "of",
    "to",
    "in",
    "on",
    "for",
    "and",
    "or",
    "is",
    "are",
    "do",
    "does",
    "you",
    "your",
    "we",
    "with",
    "have",
    "has",
    "this",
    "that",
    "what",
    "how",
    "describe",
  ]);

  const keywords = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (keywords.length === 0) return text;

  // Escape special regex characters
  const escaped = keywords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  // \b = word start, \w* = keep the rest of the word (encrypt -> encrypted)
  const wordPattern = escaped.map((w) => w + "\\w*").join("|");
  const splitPattern = new RegExp(`\\b(${wordPattern})`, "gi");
  const testPattern = new RegExp(`^(${wordPattern})$`, "i");

  // Split keeps the matched words because of the capture group ()
  const parts = text.split(splitPattern);

  // Bold any part that is a matched word
  return parts.map((part, i) =>
    testPattern.test(part) ? (
      <strong
        key={i}
        className="font-semibold text-[#0A0A0A] bg-[#FFF1E6] rounded px-0.5"
      >
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

// ─── Screen: Answer Review (search-first layout) ──────────────────────────────

export function AnswerReviewScreen({
  setScreen,
  addToast,
  addLog,
  activeTicket,
}: {
  setScreen: (s: Screen) => void;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  addLog: (e: string) => void;
  activeTicket: Ticket | null;
}) {
  // Sample questions for quick access
  const sampleQuestions = [
    "Do you have a SOC 2 Type II report?",
    "Describe data encryption in transit.",
    "What is your vulnerability disclosure policy?",
    "Do you run credit checks on employees?",
    "Do you have anti-bribery policies in place?",
    "Do you perform annual penetration testing?",
    "What MFA mechanisms are supported?",
  ];

  const [query, setQuery] = useState(""); // text in the search box
  const [searched, setSearched] = useState(""); // the question actually searched
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [editedAnswer, setEditedAnswer] = useState(""); // the editable answer text
  const [isEdited, setIsEdited] = useState(false); // whether the analyst changed it
  const [isConfirmed, setIsConfirmed] = useState(false); // whether the chosen answer is confirmed
  const [history, setHistory] = useState<string[]>([]); // recent searches (session only)
  const [hasSearched, setHasSearched] = useState(false); // whether any search has run yet
  // Customer context comes from the ticket that was opened (fallback if opened directly from the menu)
  const customerName = activeTicket?.customerName ?? "No ticket selected";
  const customerNda = activeTicket?.ndaStatus ?? "Unknown";
  // The customer is "covered" by an NDA only when their NDA status is explicitly "Yes"
  const customerHasNda = customerNda === "Yes";

  // Call the backend with a given question
  async function runSearch(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    setSearched(trimmed);
    setHasSearched(true);
    setLoading(true);
    setChosenId(null);
    setEditedAnswer("");
    setIsEdited(false);
    setIsConfirmed(false);
    // Add to history (most recent first, no duplicates, keep last 6)
    setHistory((prev) =>
      [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, 6),
    );
    try {
      const data = await searchKnowledgeBase(trimmed);
      setResults(data);
    } catch (error) {
      console.error("Search failed:", error);
      addToast("Search failed. Is the backend running?", "warning");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleChip(q: string) {
    setQuery(q);
    runSearch(q);
  }

  function formatDate(raw: string): string {
    if (!raw) return "—";
    return `${raw.slice(0, 10)} (UTC)`;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        back="question-extraction"
        backLabel="Questions"
        title={`Answer Review — ${customerName}`}
        subtitle="Search the knowledge base for the most relevant approved sources."
        setScreen={setScreen}
      />
      <WorkflowStepper current="answer-review" />

      <div className="flex-1 overflow-auto px-8 py-7">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          {/* Big search box */}
          <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            {/* Current customer context */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em]">
                Customer
              </span>
              <span className="text-xs font-semibold text-[#0A0A0A]">
                {customerName}
              </span>
              <span className="text-[#D5D5D5]">·</span>
              <span className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em]">
                NDA
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-[0.06em] uppercase border ${customerHasNda ? "bg-[#F5F5F5] text-[#374151] border-[rgba(0,0,0,0.1)]" : "bg-[#FFF4EC] text-[#C05600] border-[#F96702]/25"}`}
              >
                {customerNda}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runSearch(query);
                  }}
                  placeholder="Ask any question about the company…"
                  className="w-full pl-12 pr-4 py-3.5 text-base border border-[rgba(0,0,0,0.12)] rounded-full bg-[#FAFAF9] placeholder-[#B0B0B0] focus:outline-none focus:ring-2 focus:ring-[#F96702]/30 focus:border-[#F96702]/50 focus:bg-white transition-all"
                />
              </div>
              <button
                onClick={() => runSearch(query)}
                disabled={loading}
                className={`flex items-center gap-2 px-7 py-3.5 text-[11px] font-bold tracking-[0.07em] rounded-full transition-all ${loading ? "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed" : "bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.3)] hover:shadow-[0_4px_16px_rgba(249,103,2,0.45)]"}`}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Searching
                  </>
                ) : (
                  <>
                    <Search size={14} /> Search
                  </>
                )}
              </button>
            </div>

            {/* Sample questions */}
            <div className="mt-5">
              <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em] mb-2.5">
                Sample Questions
              </p>
              <div className="flex flex-wrap gap-2">
                {sampleQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleChip(q)}
                    className="px-3.5 py-1.5 rounded-full text-[11px] font-medium bg-[#F5F4F1] text-[#374151] border border-[rgba(0,0,0,0.06)] hover:border-[#F96702]/50 hover:text-[#F96702] hover:bg-[#FFF7F0] transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Search history */}
            {history.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.05)]">
                <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em] mb-2.5">
                  Recent Searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {history.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => handleChip(h)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-white text-[#6B7280] border border-[rgba(0,0,0,0.1)] hover:border-[#F96702]/50 hover:text-[#F96702] transition-all"
                    >
                      <Clock size={10} /> {h}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Empty state (before first search) */}
          {!hasSearched && (
            <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] p-12 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#FFF1E6] flex items-center justify-center">
                <Brain size={22} className="text-[#F96702]" />
              </div>
              <p className="text-sm font-semibold text-[#374151]">
                Search to find relevant sources
              </p>
              <p className="text-xs text-[#9CA3AF] max-w-sm">
                Type a question above, or pick a sample question. The system
                retrieves the most relevant approved sources from the knowledge
                base.
              </p>
            </div>
          )}

          {/* Results */}
          {hasSearched && (
            <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] p-7">
              <div className="flex items-start justify-between gap-6 mb-6 pb-6 border-b border-[rgba(0,0,0,0.06)]">
                <div>
                  <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em] mb-1.5">
                    Showing results for
                  </p>
                  <h3 className="text-lg font-bold text-[#0A0A0A] leading-snug tracking-tight">
                    {searched}
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FFF1E6] border border-[#F96702]/30 rounded-md shrink-0">
                  <Brain size={12} className="text-[#F96702]" />
                  <span className="text-[10px] font-bold text-[#D95400]">
                    AI Retrieved
                  </span>
                </span>
              </div>

              {loading && (
                <div className="flex items-center gap-2 text-sm text-[#6B7280] py-8 justify-center">
                  <Loader2 size={16} className="animate-spin" /> Searching the
                  knowledge base…
                </div>
              )}

              {!loading && results.length === 0 && (
                <div className="text-sm text-[#9CA3AF] py-8 text-center">
                  No relevant source found for this question.
                </div>
              )}

              {!loading && results.length > 0 && (
                <div className="flex flex-col gap-4">
                  <p className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.14em]">
                    Suggested Sources ({results.length})
                  </p>
                  {results.map((r, i) => {
                    const isNDA = r.sharingStatus === "NDA-required";
                    const isChosen = chosenId === r.id;
                    // When something is chosen, fade the others to focus attention
                    const isDimmed = chosenId !== null && !isChosen;
                    return (
                      <div
                        key={r.id}
                        className={`rounded-xl border p-5 flex flex-col gap-3 transition-all ${isChosen ? "border-[#F96702] bg-[#FFF7F0]" : "border-[rgba(0,0,0,0.08)] bg-[#FAFAF9]"} ${isDimmed ? "opacity-50" : "opacity-100"}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em]">
                              Candidate {i + 1}
                            </span>
                            {r.similarityScore != null && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-[0.06em] uppercase bg-[#FFF1E6] text-[#C05600] border border-[#F96702]/25">
                                {Math.round(r.similarityScore * 100)}% Relevance
                              </span>
                            )}
                          </div>
                          {isNDA ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-[0.06em] uppercase bg-[#FFF4EC] text-[#C05600] border border-[#F96702]/30">
                              <Shield size={9} /> NDA-required
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-[0.06em] uppercase bg-[#F5F5F5] text-[#374151] border border-[rgba(0,0,0,0.1)]">
                              {r.sharingStatus}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#1F2937] leading-relaxed">
                          {highlightKeywords(r.content, searched)}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#6B7280] pt-1">
                          <span className="inline-flex items-center gap-1">
                            <ExternalLink
                              size={11}
                              className="text-[#F96702]"
                            />
                            {r.source}
                          </span>
                          <span>Updated: {formatDate(r.lastUpdated)}</span>
                          <span>Dept: {r.department}</span>
                        </div>

                        {/* NDA conflict warning */}
                        {isNDA && !customerHasNda && (
                          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FFF7F0] border border-[#F96702]/20">
                            <AlertTriangle
                              size={13}
                              className="text-[#F96702] shrink-0 mt-0.5"
                            />
                            <div>
                              <p className="text-[11px] font-bold text-[#C05600] mb-0.5">
                                NDA Conflict
                              </p>
                              <p className="text-[11px] text-[#8B4500] leading-relaxed">
                                This source is NDA-required, but no NDA is on
                                file for this customer. Route to SME or confirm
                                with the AE before sharing.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Editable answer area — appears only for the chosen candidate */}
                        {isChosen ? (
                          <div
                            className={`flex flex-col gap-2.5 pt-2 border-t mt-1 ${isConfirmed ? "border-green-300" : "border-[#F96702]/20"}`}
                          >
                            <div className="flex items-center justify-between">
                              {isConfirmed ? (
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-green-700 uppercase tracking-[0.1em]">
                                  <CheckCircle size={11} /> Answer Confirmed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-[#C05600] uppercase tracking-[0.1em]">
                                  <CheckCircle size={11} /> Selected — Review &
                                  Edit
                                </span>
                              )}
                              {isEdited && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-[0.06em] uppercase bg-[#FFF1E6] text-[#C05600] border border-[#F96702]/30">
                                  <Edit3 size={9} /> Edited
                                </span>
                              )}
                            </div>
                            <textarea
                              value={editedAnswer}
                              onChange={(e) => {
                                setEditedAnswer(e.target.value);
                                setIsEdited(e.target.value !== r.content);
                              }}
                              readOnly={isConfirmed}
                              rows={5}
                              className={`w-full px-3.5 py-3 text-sm text-[#1F2937] leading-relaxed border rounded-lg transition-all resize-y focus:outline-none ${isConfirmed ? "border-green-200 bg-green-50/40 cursor-default" : "border-[#F96702]/30 bg-white focus:ring-2 focus:ring-[#F96702]/30 focus:border-[#F96702]/50"}`}
                            />
                            {isConfirmed ? (
                              <>
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 border border-green-100">
                                  <CheckCircle
                                    size={12}
                                    className="text-green-500 shrink-0"
                                  />
                                  <span className="text-[11px] text-green-700 font-medium">
                                    This answer has been reviewed and confirmed
                                    for the customer response
                                    {isEdited ? " (with analyst edits)." : "."}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    onClick={() => {
                                      setIsConfirmed(false);
                                      addToast(
                                        "Answer unlocked for editing.",
                                        "info",
                                      );
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase border border-[rgba(0,0,0,0.18)] text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] transition-all"
                                  >
                                    <Edit3 size={11} /> Edit Again
                                  </button>
                                  <button
                                    onClick={() => {
                                      setChosenId(null);
                                      setEditedAnswer("");
                                      setIsEdited(false);
                                      setIsConfirmed(false);
                                      addToast("Selection cleared.", "info");
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase border border-[rgba(0,0,0,0.18)] text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] transition-all"
                                  >
                                    <X size={11} /> Clear
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-[10px] text-[#9CA3AF]">
                                  Final human review. Edit the answer as needed
                                  before confirming.
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    onClick={() => {
                                      setChosenId(null);
                                      setEditedAnswer("");
                                      setIsEdited(false);
                                      setIsConfirmed(false);
                                      addToast("Selection cleared.", "info");
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase border border-[rgba(0,0,0,0.18)] text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] transition-all"
                                  >
                                    <X size={11} /> Cancel Selection
                                  </button>
                                  {isEdited && (
                                    <button
                                      onClick={() => {
                                        setEditedAnswer(r.content);
                                        setIsEdited(false);
                                        addToast(
                                          "Reverted to original source text.",
                                          "info",
                                        );
                                      }}
                                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase border border-[rgba(0,0,0,0.18)] text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] transition-all"
                                    >
                                      <RefreshCw size={11} /> Restore Original
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setIsConfirmed(true);
                                      addLog(
                                        isEdited
                                          ? `Answer confirmed (edited): ${r.sectionTitle}`
                                          : `Answer confirmed: ${r.sectionTitle}`,
                                      );
                                      addToast(
                                        "Answer confirmed for this question.",
                                        "success",
                                      );
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.25)] transition-all"
                                  >
                                    <CheckCircle size={11} /> Confirm Answer
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => {
                                setChosenId(r.id);
                                setEditedAnswer(r.content);
                                setIsEdited(false);
                                setIsConfirmed(false);
                                addLog(`Selected source: ${r.sectionTitle}`);
                                addToast(
                                  "Source selected. Review and edit before confirming.",
                                  "success",
                                );
                              }}
                              className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold rounded-full tracking-[0.06em] uppercase bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.25)] transition-all"
                            >
                              Use this
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <BtnPrimary onClick={() => setScreen("sme-package")}>
              Continue to SME Preparation <ChevronRight size={11} />
            </BtnPrimary>
          </div>
        </div>
      </div>
    </div>
  );
}
