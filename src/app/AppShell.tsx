import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Ticket as TicketIcon,
  Sparkles,
  BookOpen,
  BarChart3,
  Bell,
  Settings as SettingsIcon,
  Search,
  Plus,
  User,
  ChevronDown,
  AlertTriangle,
  Menu,
} from "lucide-react";
import {
  ModuleId,
  Role,
  MvpTicket,
  MvpQuestion,
  MvpSmeRequest,
  MvpKnowledgeEntry,
  MvpNotification,
  MvpActivity,
  ToastMsg,
} from "./data/model";
import {
  SEED_ACTIVITY,
  SEED_KNOWLEDGE,
  SEED_NOTIFICATIONS,
  SEED_QUESTIONS,
  SEED_SME_REQUESTS,
  SEED_TICKETS,
} from "./data/seeds";
import { Toast } from "./components/ui";
import { loadBackendKnowledge, loadBackendWorld, onBackendStatus, pingBackend } from "./services/backend";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TicketsPage, TicketFilters, EMPTY_FILTERS } from "./pages/TicketsPage";
import { TicketDetailPage } from "./pages/TicketDetailPage";
import { AiSearchPage } from "./pages/AiSearchPage";
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage";
import { ReportsPage } from "./pages/ReportsPage";
import { NotificationsPage } from "./pages/NotificationsPage";

// Application shell (PRD §4/§5): module navigation, top bar, global state. Sidebar lists modules, never workflow
// steps; ticket statuses are filters inside Tickets.

const NAV: { id: ModuleId; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tickets", label: "Tickets", icon: TicketIcon },
  { id: "ai-search", label: "AI Search", icon: Sparkles },
  { id: "knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export type AppState = {
  role: Role;
  currentUser: string;
  tickets: MvpTicket[];
  questions: MvpQuestion[];
  smeRequests: MvpSmeRequest[];
  knowledge: MvpKnowledgeEntry[];
  notifications: MvpNotification[];
  activity: MvpActivity[];
};

export type AppActions = {
  go: (m: ModuleId) => void;
  openTicket: (id: string) => void;
  openTicketsFiltered: (f: Partial<TicketFilters>) => void;
  openKnowledge: (view: "all" | "pending", entryId?: number, fromTicketId?: string) => void;
  setTickets: React.Dispatch<React.SetStateAction<MvpTicket[]>>;
  setQuestions: React.Dispatch<React.SetStateAction<MvpQuestion[]>>;
  setSmeRequests: React.Dispatch<React.SetStateAction<MvpSmeRequest[]>>;
  setKnowledge: React.Dispatch<React.SetStateAction<MvpKnowledgeEntry[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<MvpNotification[]>>;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  logActivity: (action: string, ticketId?: string) => void;
  openNewTicket: () => void;
};

export default function AppShell() {
  const [module, setModule] = useState<ModuleId>("dashboard");
  const [role, setRole] = useState<Role>("Analyst");
  const [roleMenu, setRoleMenu] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [ticketFilters, setTicketFilters] = useState<TicketFilters>(EMPTY_FILTERS);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [kbView, setKbView] = useState<"all" | "pending">("all");
  const [kbFocusEntry, setKbFocusEntry] = useState<number | null>(null);
  const [kbReturnTicket, setKbReturnTicket] = useState<string | null>(null);
  const [globalQuery, setGlobalQuery] = useState("");
  const [backendLive, setBackendLive] = useState<boolean | null>(null);

  // Hydrate from the backend when it is reachable: existing tickets (with
  // their questions, SME requests and answers) and the live knowledge base
  // appear alongside the local demo seeds. Runs at most once per session.
  const hydratedRef = useRef(false);
  const hydrate = async () => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    addToast("Backend connected — loading live tickets…", "info");
    const world = await loadBackendWorld(
      new Set(SEED_TICKETS.map((t) => t.backendId).filter((x): x is number => x !== undefined)),
    );
    if (world && world.tickets.length > 0) {
      setTickets((p) => [
        ...world.tickets.filter((w) => !p.some((t) => t.backendId === w.backendId)),
        ...p,
      ]);
      setQuestions((p) => [
        ...p,
        ...world.questions.filter((w) => !p.some((q) => q.backendId === w.backendId)),
      ]);
      setSmeRequests((p) => [
        ...p,
        ...world.smeRequests.filter((w) => !p.some((r) => r.backendId === w.backendId)),
      ]);
      addToast(`Loaded ${world.tickets.length} ticket(s) from the live backend.`, "info");
    }
    const kb = await loadBackendKnowledge();
    if (kb) setKnowledge(kb);
  };

  useEffect(() => {
    onBackendStatus(setBackendLive);
    void (async () => {
      // The hosted backend cold-starts in 30-60s after idling; a single failed
      // probe must not strand the session on demo seeds. Retry with backoff
      // and tell the user which world they are looking at.
      let live = await pingBackend();
      for (const delay of [2000, 4000, 8000, 16000, 30000]) {
        if (live) break;
        await new Promise((r) => setTimeout(r, delay));
        live = await pingBackend();
      }
      if (!live) {
        addToast("Backend unreachable — showing local demo data only.", "warning");
        return;
      }
      void hydrate();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Late recovery: any successful backend call flips the status to live even
  // after the startup retries gave up — hydrate then too, so the offline
  // banner's "appears automatically" promise actually holds.
  useEffect(() => {
    if (backendLive) void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendLive]);

  const [tickets, setTickets] = useState<MvpTicket[]>(SEED_TICKETS);
  const [questions, setQuestions] = useState<MvpQuestion[]>(SEED_QUESTIONS);
  const [smeRequests, setSmeRequests] = useState<MvpSmeRequest[]>(SEED_SME_REQUESTS);
  const [knowledge, setKnowledge] = useState<MvpKnowledgeEntry[]>(SEED_KNOWLEDGE);
  const [notifications, setNotifications] = useState<MvpNotification[]>(SEED_NOTIFICATIONS);
  const [activity, setActivity] = useState<MvpActivity[]>(SEED_ACTIVITY);

  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const idRef = useRef(0);
  const addToast = (message: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now() + ++idRef.current;
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  };

  const currentUser = "Sarah Chen";
  const unread = notifications.filter((n) => !n.read).length;

  const actions: AppActions = useMemo(
    () => ({
      go: (m) => setModule(m),
      openTicket: (id) => {
        setActiveTicketId(id);
        setModule("ticket-detail");
      },
      openTicketsFiltered: (f) => {
        setTicketFilters({ ...EMPTY_FILTERS, ...f });
        setModule("tickets");
      },
      openKnowledge: (view, entryId, fromTicketId) => {
        setKbView(view);
        setKbFocusEntry(entryId ?? null);
        setKbReturnTicket(fromTicketId ?? null);
        setModule("knowledge-base");
      },
      setTickets,
      setQuestions,
      setSmeRequests,
      setKnowledge,
      setNotifications,
      addToast,
      logActivity: (action, ticketId) =>
        setActivity((p) => [
          { id: Date.now(), ticketId, actor: currentUser, action, at: new Date().toISOString() },
          ...p,
        ]),
      openNewTicket: () => {
        setModule("tickets");
        setNewTicketOpen(true);
      },
    }),
    // state setters are stable; only recreated intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const state: AppState = {
    role,
    currentUser,
    tickets,
    questions,
    smeRequests,
    knowledge,
    notifications,
    activity,
  };

  const submitGlobalSearch = () => {
    if (!globalQuery.trim()) return;
    actions.openTicketsFiltered({ query: globalQuery.trim() });
  };

  // Shared between the static sidebar (desktop) and the slide-over drawer
  // (mobile) — navigation also closes the drawer.
  const sidebarContent = (
    <>
      <div className="h-[3px] bg-[#F96702] w-full shrink-0" />
      <div className="px-5 py-5 border-b border-[rgba(0,0,0,0.06)] shrink-0 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#F96702] flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(249,103,2,0.35)]">
          <span className="text-white text-[13px] font-black">C</span>
        </div>
        <div>
          <p className="text-[#0A0A0A] text-[13px] font-bold leading-tight tracking-[-0.01em]">
            Customer Forms Hub
          </p>
          <p className="text-[#9CA3AF] text-[11px] tracking-[0.04em] uppercase font-medium">
            Cloudera GOM
          </p>
        </div>
      </div>
      <nav className="flex-1 py-5 px-4 flex flex-col gap-1.5">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = module === id || (id === "tickets" && module === "ticket-detail");
          return (
            <button
              key={id}
              onClick={() => {
                setModule(id);
                setKbReturnTicket(null);
                setKbFocusEntry(null);
                setMobileNav(false);
              }}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] w-full text-left transition-all ${active ? "bg-[#F96702] text-white font-bold shadow-[0_2px_8px_rgba(249,103,2,0.3)]" : "text-[#6B7280] hover:text-[#111111] hover:bg-[#F5F3F0]"}`}
            >
              <Icon size={15} />
              <span className="flex-1">{label}</span>
              {id === "notifications" && unread > 0 && (
                <span
                  className={`text-[10px] font-bold rounded-full px-1.5 py-px ${active ? "bg-white text-[#F96702]" : "bg-[#F96702] text-white"}`}
                >
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-[rgba(0,0,0,0.06)] shrink-0 flex items-center gap-1.5 text-[10px] font-medium">
        <span
          className={`w-1.5 h-1.5 rounded-full ${backendLive ? "bg-green-500" : "bg-[#D8D5D0]"}`}
        />
        <span className={backendLive ? "text-green-700" : "text-[#B8B5B0]"}>
          {backendLive
            ? "Backend live — real AI parsing & retrieval"
            : "Backend offline — simulated data"}
        </span>
      </div>
    </>
  );

  return (
    <div
      className="h-screen w-screen flex overflow-hidden bg-[#F5F4F1]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Sidebar (GL-01): static on desktop, slide-over drawer on mobile */}
      <aside className="w-64 bg-white hidden lg:flex flex-col shrink-0 h-full overflow-y-auto border-r border-[rgba(0,0,0,0.06)]">
        {sidebarContent}
      </aside>
      {mobileNav && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <aside className="w-72 max-w-[85vw] bg-white flex flex-col h-full overflow-y-auto shadow-[8px_0_32px_rgba(0,0,0,0.2)]">
            {sidebarContent}
          </aside>
          <button
            aria-label="Close menu"
            onClick={() => setMobileNav(false)}
            className="flex-1 bg-black/40"
          />
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar (GL-02/03/04) */}
        <header className="h-14 bg-white border-b border-[rgba(0,0,0,0.06)] flex items-center gap-2.5 sm:gap-4 px-3 sm:px-6 shrink-0">
          <button
            aria-label="Open menu"
            onClick={() => setMobileNav(true)}
            className="lg:hidden w-9 h-9 rounded-full border border-[rgba(0,0,0,0.1)] flex items-center justify-center text-[#6B7280] hover:text-[#F96702] shrink-0"
          >
            <Menu size={16} />
          </button>
          <div className="relative flex-1 max-w-md">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitGlobalSearch()}
              placeholder="Search company, SOR ID, ticket ID…"
              className="w-full pl-8 pr-4 py-1.5 text-[12px] border border-[rgba(0,0,0,0.12)] rounded-full bg-[#FAFAF9] placeholder-[#B0B0B0] focus:outline-none focus:ring-2 focus:ring-[#F96702]/30 focus:border-[#F96702]/50 focus:bg-white transition-all"
            />
          </div>
          <div className="ml-auto flex items-center gap-3.5">
            {role !== "SME" && (
              <button
                onClick={actions.openNewTicket}
                className="flex items-center gap-2 px-5 py-2 text-[12px] bg-[#F96702] text-white rounded-full hover:bg-[#D95400] font-bold tracking-[0.06em] shadow-[0_2px_8px_rgba(249,103,2,0.3)] transition-all"
              >
                <Plus size={13} /> <span className="hidden sm:inline">New Request</span><span className="sm:hidden">New</span>
              </button>
            )}
            <button
              onClick={() => setModule("notifications")}
              className="relative w-9 h-9 rounded-full border border-[rgba(0,0,0,0.1)] flex items-center justify-center text-[#6B7280] hover:text-[#F96702] hover:border-[#F96702]/40 transition-all"
            >
              <Bell size={15} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#F96702] text-white text-[9px] font-bold rounded-full min-w-[14px] h-3.5 px-1 flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
            <div className="relative">
              <button
                onClick={() => setRoleMenu((o) => !o)}
                className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-full border border-[rgba(0,0,0,0.1)] hover:border-[#F96702]/40 transition-all"
              >
                <span className="w-7 h-7 rounded-full bg-[#F5F3F0] flex items-center justify-center ring-2 ring-[#F96702]/20">
                  <User size={13} className="text-[#F96702]" />
                </span>
                <span className="text-left hidden sm:block">
                  <span className="block text-[11px] font-semibold text-[#0A0A0A] leading-tight">
                    {currentUser}
                  </span>
                  <span className="block text-[9.5px] text-[#9CA3AF] uppercase tracking-[0.08em] font-bold leading-tight">
                    {role}
                  </span>
                </span>
                <ChevronDown size={11} className="text-[#9CA3AF]" />
              </button>
              {roleMenu && (
                <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl border border-[rgba(0,0,0,0.08)] shadow-[0_8px_24px_rgba(0,0,0,0.12)] py-1.5 z-50">
                  <p className="px-3 py-1 text-[10px] font-black text-[#ABABAB] uppercase tracking-[0.12em]">
                    Switch role (demo)
                  </p>
                  {(["Analyst", "SME", "Manager"] as Role[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setRole(r);
                        setRoleMenu(false);
                        setModule("dashboard");
                        addToast(`Viewing as ${r}.`, "info");
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#F5F3F0] ${role === r ? "font-bold text-[#C05600]" : "text-[#374151]"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Persistent banner — the sidebar dot alone is too easy to miss, and
            a "you are looking at demo data" mistake wastes a whole session */}
        {backendLive === false && (
          <div className="bg-[#FEF3C7] border-b border-[#F59E0B]/30 px-6 py-2 flex items-center gap-2 shrink-0">
            <AlertTriangle size={13} className="text-[#92400E] shrink-0" />
            <p className="text-[12px] text-[#92400E] font-medium">
              Backend unreachable — showing local demo data only. Live tickets appear automatically
              once the connection returns.
            </p>
          </div>
        )}

        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {module === "dashboard" && <DashboardPage state={state} actions={actions} />}
          {module === "tickets" && (
            <TicketsPage
              state={state}
              actions={actions}
              filters={ticketFilters}
              setFilters={setTicketFilters}
              newTicketOpen={newTicketOpen}
              setNewTicketOpen={setNewTicketOpen}
            />
          )}
          {module === "ticket-detail" && activeTicketId && (
            <TicketDetailPage state={state} actions={actions} ticketId={activeTicketId} />
          )}
          {module === "ai-search" && <AiSearchPage state={state} actions={actions} />}
          {module === "knowledge-base" && (
            <KnowledgeBasePage
              state={state}
              actions={actions}
              view={kbView}
              setView={setKbView}
              focusEntry={kbFocusEntry}
              returnTicket={kbReturnTicket}
            />
          )}
          {module === "reports" && <ReportsPage state={state} actions={actions} />}
          {module === "notifications" && <NotificationsPage state={state} actions={actions} />}
          {module === "settings" && (
            <SettingsPage
              onBack={() => setModule("dashboard")}
              addToast={addToast}
              addLog={(e) =>
                setActivity((p) => [
                  { id: Date.now(), actor: currentUser, action: e, at: new Date().toISOString() },
                  ...p,
                ])
              }
            />
          )}
        </main>
      </div>
      <Toast toasts={toasts} remove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </div>
  );
}
