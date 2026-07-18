import { useEffect, useState } from "react";
import { Archive, ArrowLeft, BookOpen, CheckCircle, Edit3, Plus, RotateCcw, Search, X } from "lucide-react";
import { BtnPrimary, BtnSecondary } from "../components/ui";
import { DEPARTMENTS, KnowledgeStatus, SharingStatus } from "../data/model";
import { AppActions, AppState } from "../AppShell";
import { upsertBackendKnowledge } from "../services/backend";
import { EmptyState, Pill, SharingBadge, Th } from "../components/ui";

// PRD §11: entries with metadata, department browsing (not "collections" in
// the UI), and a Pending Review approval queue (§11.2). Archive, never delete
// (NFR-02, Appendix B).

export function KnowledgeBasePage({
  state,
  actions,
  view,
  setView,
  focusEntry,
  returnTicket,
}: {
  state: AppState;
  actions: AppActions;
  view: "all" | "pending";
  setView: (v: "all" | "pending") => void;
  focusEntry: number | null;
  returnTicket: string | null;
}) {
  const { knowledge, role } = state;
  const [dept, setDept] = useState("All");
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editorFor, setEditorFor] = useState<null | "new" | number>(null);

  // deep link from dashboard / drawers
  useEffect(() => {
    if (focusEntry !== null) setDetailId(focusEntry);
  }, [focusEntry]);

  const pendingCount = knowledge.filter((k) => k.status === "Pending Review").length;
  const canApprove = role === "Analyst" || role === "Manager";

  const visible = knowledge.filter((k) => {
    if (view === "pending") return k.status === "Pending Review";
    if (dept !== "All" && k.department !== dept) return false;
    if (query) {
      const hay = `${k.title} ${k.content} ${k.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  const detail = knowledge.find((k) => k.id === detailId) ?? null;

  const setStatus = (id: number, status: KnowledgeStatus, log: string) => {
    const updated = knowledge.find((k) => k.id === id);
    actions.setKnowledge((p) =>
      p.map((k) =>
        k.id === id
          ? { ...k, status, lastUpdated: new Date().toISOString().slice(0, 10) }
          : k,
      ),
    );
    // best-effort write-back so live backend data stays in sync
    if (updated)
      void upsertBackendKnowledge(
        { ...updated, status, lastUpdated: new Date().toISOString().slice(0, 10) },
        false,
      );
    actions.logActivity(log);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Department browser (KB-02) */}
      <aside className="w-48 bg-white border-r border-[rgba(0,0,0,0.06)] shrink-0 overflow-y-auto py-4 px-3 hidden md:block">
        <p className="text-[10px] font-black text-[#ABABAB] uppercase tracking-[0.14em] px-3 pb-2">
          Browse
        </p>
        <button
          onClick={() => {
            setView("all");
            setDept("All");
          }}
          className={`w-full text-left px-3 py-1.5 rounded-lg text-[12px] transition-all ${view === "all" && dept === "All" ? "bg-[#F96702] text-white font-bold" : "text-[#6B7280] hover:bg-[#F5F3F0]"}`}
        >
          All Entries
        </button>
        <p className="text-[10px] font-black text-[#ABABAB] uppercase tracking-[0.14em] px-3 pt-4 pb-2">
          Departments
        </p>
        {/* derive from the entries themselves — live data uses labels (e.g.
            InfoSec, Compliance) outside the PRD list */}
        {[
          ...DEPARTMENTS.filter((d) => knowledge.some((k) => k.department === d)),
          ...[...new Set(knowledge.map((k) => k.department))].filter(
            (d) => !DEPARTMENTS.includes(d),
          ),
        ].map((d) => (
          <button
            key={d}
            onClick={() => {
              setView("all");
              setDept(d);
            }}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-[12px] transition-all flex items-center ${view === "all" && dept === d ? "bg-[#F96702] text-white font-bold" : "text-[#6B7280] hover:bg-[#F5F3F0]"}`}
          >
            <span className="flex-1">{d}</span>
            <span className={`text-[10px] ${view === "all" && dept === d ? "text-white/80" : "text-[#C0BEBA]"}`}>
              {knowledge.filter((k) => k.department === d && k.status !== "Archived").length}
            </span>
          </button>
        ))}
        <p className="text-[10px] font-black text-[#ABABAB] uppercase tracking-[0.14em] px-3 pt-4 pb-2">
          Review
        </p>
        <button
          onClick={() => setView("pending")}
          className={`w-full text-left px-3 py-1.5 rounded-lg text-[12px] transition-all flex items-center ${view === "pending" ? "bg-[#F96702] text-white font-bold" : "text-[#6B7280] hover:bg-[#F5F3F0]"}`}
        >
          <span className="flex-1">Pending Review</span>
          {pendingCount > 0 && (
            <span
              className={`text-[10px] font-bold rounded-full px-1.5 py-px ${view === "pending" ? "bg-white text-[#F96702]" : "bg-[#FEFCE8] text-[#854D0E] border border-[#FDE68A]"}`}
            >
              {pendingCount}
            </span>
          )}
        </button>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {returnTicket && (
          <button
            onClick={() => actions.openTicket(returnTicket)}
            className="flex items-center gap-2 px-7 py-2 bg-[#FFF4EC] border-b border-[#F96702]/25 text-[12px] font-semibold text-[#C05600] hover:bg-[#FFE8D0] transition-colors shrink-0"
          >
            <ArrowLeft size={12} /> Back to ticket {returnTicket} — you were reviewing an answer
            source
          </button>
        )}
        <div className="px-4 sm:px-8 pt-7 pb-5 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-[3px] h-7 bg-[#F96702] rounded-full shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">
                {view === "pending" ? "Pending Review" : "Knowledge Base"}
              </h1>
              <p className="text-sm text-[#6B7280] mt-0.5">
                {view === "pending"
                  ? "Proposed reusable answers awaiting approval — approved entries feed AI retrieval"
                  : "Approved answers used by AI suggestions and AI Search"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setEditorFor("new")}
            className="flex items-center gap-1.5 px-5 py-2 text-[11px] bg-[#F96702] text-white rounded-full hover:bg-[#D95400] font-bold tracking-[0.06em] shadow-[0_2px_8px_rgba(249,103,2,0.3)] transition-all"
          >
            <Plus size={12} /> Add Entry
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 sm:px-8 py-7 flex flex-col gap-5">
          {view === "all" && (
            <div className="relative w-72">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles, content, tags…"
                className="w-full pl-8 pr-4 py-1.5 text-[12px] border border-[rgba(0,0,0,0.15)] rounded-full bg-white placeholder-[#B0B0B0] focus:outline-none focus:ring-2 focus:ring-[#F96702]/30"
              />
            </div>
          )}

          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] overflow-hidden">
            {visible.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title={
                  view === "pending"
                    ? "Nothing pending review."
                    : "No approved knowledge found."
                }
                hint={
                  view === "pending"
                    ? "New reusable answers submitted from tickets will appear here."
                    : "Try another department or submit a new entry for review."
                }
              />
            ) : (
              <div className="overflow-x-auto"><table className="w-full">
                <thead>
                  <tr>
                    <Th>Department</Th>
                    <Th>Title</Th>
                    <Th>Sharing Status</Th>
                    <Th>Last Updated</Th>
                    <Th>Status</Th>
                    <Th>Owner</Th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((k) => (
                    <tr
                      key={k.id}
                      onClick={() => setDetailId(k.id)}
                      className="border-b border-border last:border-0 cursor-pointer hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-[13px] text-[#374151] whitespace-nowrap">{k.department}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-[13px] font-semibold text-[#1F2937]">{k.title}</p>
                        <p className="text-[11px] text-[#9CA3AF] line-clamp-1 mt-0.5">{k.content}</p>
                      </td>
                      <td className="px-4 py-2.5"><SharingBadge status={k.sharingStatus} /></td>
                      <td className="px-4 py-2.5 text-[13px] text-[#6B7280] whitespace-nowrap">
                        {k.lastUpdated} (UTC)
                      </td>
                      <td className="px-4 py-2.5"><Pill value={k.status} /></td>
                      <td className="px-4 py-2.5 text-[13px] text-[#6B7280] whitespace-nowrap">{k.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </div>
      </div>

      {/* Entry detail drawer (§11.1) */}
      {detail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setDetailId(null)} />
          <div className="w-full max-w-[400px] bg-white h-full shadow-[-8px_0_32px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2 shrink-0">
              <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wide flex-1">
                Knowledge Entry #{detail.id}
              </p>
              <Pill value={detail.status} />
              <button onClick={() => setDetailId(null)} className="text-gray-400 hover:text-gray-600 ml-1">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-3">
              <h3 className="text-sm font-bold text-[#0A0A0A]">{detail.title}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <SharingBadge status={detail.sharingStatus} />
                <span className="text-[11px] text-[#6B7280]">{detail.department}</span>
              </div>
              <div className="text-[13px] text-[#374151] leading-relaxed bg-[#F7F8FA] border border-border rounded-md px-3 py-2.5">
                {detail.content}
              </div>
              <div className="space-y-1.5 text-[12px] text-[#6B7280]">
                <p><strong>Source:</strong> {detail.source}</p>
                <p><strong>Last updated:</strong> {detail.lastUpdated} (UTC)</p>
                <p><strong>Owner:</strong> {detail.owner}</p>
                <p><strong>Tags:</strong> {detail.tags.join(", ") || "—"}</p>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border flex gap-2 flex-wrap shrink-0 bg-[#FAFAFA]">
              {returnTicket && (
                <button
                  onClick={() => actions.openTicket(returnTicket)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold bg-[#F96702] text-white rounded-full hover:bg-[#D95400] tracking-[0.06em] uppercase shadow-[0_2px_8px_rgba(249,103,2,0.25)] transition-all"
                >
                  <ArrowLeft size={11} /> Back to Ticket {returnTicket}
                </button>
              )}
              {detail.status === "Pending Review" && canApprove ? (
                <>
                  <BtnPrimary
                    onClick={() => {
                      setStatus(detail.id, "Approved", `Approved knowledge entry “${detail.title}”`);
                      actions.addToast("Entry approved — now available to AI retrieval.", "success");
                      setDetailId(null);
                    }}
                  >
                    <CheckCircle size={11} /> Approve
                  </BtnPrimary>
                  <BtnSecondary
                    onClick={() => {
                      setStatus(detail.id, "Draft", `Requested changes on “${detail.title}”`);
                      actions.addToast("Sent back as Draft with change request.", "info");
                      setDetailId(null);
                    }}
                  >
                    Request Changes
                  </BtnSecondary>
                </>
              ) : (
                <>
                  <BtnSecondary onClick={() => setEditorFor(detail.id)}>
                    <Edit3 size={11} /> Edit
                  </BtnSecondary>
                  {detail.status === "Approved" && (
                    <BtnSecondary
                      onClick={() => {
                        setStatus(detail.id, "Deprecated", `Deprecated knowledge entry “${detail.title}”`);
                        actions.addToast("Entry deprecated — no longer used by AI.", "info");
                      }}
                    >
                      Deprecate
                    </BtnSecondary>
                  )}
                </>
              )}
              {["Deprecated", "Archived"].includes(detail.status) && (
                <BtnSecondary
                  onClick={() => {
                    setStatus(detail.id, "Draft", `Restored knowledge entry “${detail.title}” to Draft`);
                    actions.addToast("Entry restored as Draft — submit for review to reactivate.", "info");
                  }}
                >
                  <RotateCcw size={11} /> Restore to Draft
                </BtnSecondary>
              )}
              {detail.status !== "Archived" && (
                <button
                  onClick={() => {
                    setStatus(detail.id, "Archived", `Archived knowledge entry “${detail.title}”`);
                    actions.addToast("Entry archived (preserved, never deleted).", "info");
                    setDetailId(null);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold border border-[#FCA5A5]/60 rounded-full text-[#991B1B] hover:bg-[#FEF2F2] transition-all ml-auto"
                >
                  <Archive size={11} /> Archive
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editorFor !== null && (
        <EntryEditor
          state={state}
          actions={actions}
          entryId={editorFor === "new" ? null : editorFor}
          close={() => setEditorFor(null)}
        />
      )}
    </div>
  );
}

function EntryEditor({
  state,
  actions,
  entryId,
  close,
}: {
  state: AppState;
  actions: AppActions;
  entryId: number | null;
  close: () => void;
}) {
  const existing = entryId !== null ? state.knowledge.find((k) => k.id === entryId) : undefined;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [dept, setDept] = useState(existing?.department ?? "General");
  const [sharing, setSharing] = useState<SharingStatus>(existing?.sharingStatus ?? "Internal");
  const [source, setSource] = useState(existing?.source ?? "");
  const [tags, setTags] = useState(existing?.tags.join(", ") ?? "");

  const save = () => {
    if (!title.trim() || !content.trim()) {
      actions.addToast("Title and content are required.", "warning");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (existing) {
      const next = { ...existing, title: title.trim(), content: content.trim(), department: dept, sharingStatus: sharing, source: source.trim(), tags: tagList, lastUpdated: today };
      actions.setKnowledge((p) => p.map((k) => (k.id === existing.id ? next : k)));
      void upsertBackendKnowledge(next, false);
      actions.logActivity(`Edited knowledge entry “${title.trim()}”`);
      actions.addToast("Entry updated.", "success");
    } else {
      // KB-06: new manual entries start as Pending Review
      const entry = {
        id: Math.max(...state.knowledge.map((k) => k.id)) + 1,
        title: title.trim(),
        content: content.trim(),
        department: dept,
        sharingStatus: sharing,
        source: source.trim() || "Manual entry",
        lastUpdated: today,
        status: "Pending Review" as const,
        tags: tagList,
        owner: state.currentUser,
      };
      actions.setKnowledge((p) => [entry, ...p]);
      void upsertBackendKnowledge(entry, true).then((backendId) => {
        if (backendId)
          actions.setKnowledge((p) =>
            p.map((k) => (k.id === entry.id ? { ...k, id: backendId } : k)),
          );
      });
      actions.logActivity(`Submitted knowledge entry “${title.trim()}” for review`);
      actions.addToast("Entry submitted to Pending Review.", "success");
    }
    close();
  };

  const field = "w-full border border-border rounded-md px-2.5 py-1.5 text-[13px]";
  const label = "text-[11px] font-medium text-[#6B7280] mb-1 block";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-[480px] max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#1F2937]">
            {existing ? "Edit Knowledge Entry" : "New Knowledge Entry"}
          </h3>
          <button onClick={close} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          <div>
            <label className={label}>Title *</label>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={label}>Content *</label>
            <textarea rows={5} className={`${field} resize-y`} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div>
              <label className={label}>Department</label>
              <select className={`${field} bg-white`} value={dept} onChange={(e) => setDept(e.target.value)}>
                {DEPARTMENTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Sharing Status</label>
              <select className={`${field} bg-white`} value={sharing} onChange={(e) => setSharing(e.target.value as SharingStatus)}>
                {["Public", "Internal", "NDA Required"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={label}>Source</label>
            <input className={field} placeholder="e.g. Ticket TK-1027 / Security response" value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <div>
            <label className={label}>Tags (comma separated)</label>
            <input className={field} value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
        </div>
        {!existing && (
          <p className="text-[11px] text-[#854D0E] bg-[#FEFCE8] border border-[#FDE68A] rounded-md px-2.5 py-1.5 mt-2.5">
            New entries start in Pending Review — they only feed AI retrieval after approval
            (KB-05, §11.2).
          </p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <BtnSecondary onClick={close}>Cancel</BtnSecondary>
          <BtnPrimary onClick={save}>{existing ? "Save Changes" : "Submit for Review"}</BtnPrimary>
        </div>
      </div>
    </div>
  );
}
