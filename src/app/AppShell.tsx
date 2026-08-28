import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Ticket as TicketIcon,
  Sparkles,
  BookOpen,
  BarChart3,
  Gauge,
  Bell,
  Settings as SettingsIcon,
  Search,
  Plus,
  User,
  ChevronDown,
  AlertTriangle,
  LoaderCircle,
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
import { loadBackendKnowledge, loadBackendWorld, onBackendStatus, onWriteFailure, pingBackend } from "./services/backend";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TicketsPage, TicketFilters, EMPTY_FILTERS } from "./pages/TicketsPage";
import { TicketDetailPage } from "./pages/TicketDetailPage";
import { AiSearchPage } from "./pages/AiSearchPage";
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage";
import { ReportsPage } from "./pages/ReportsPage";
import { AiPerformancePage } from "./pages/AiPerformancePage";
import { NotificationsPage } from "./pages/NotificationsPage";

// Main navigation and shared application state.

const NAV: { id: ModuleId; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tickets", label: "Tickets", icon: TicketIcon },
  { id: "ai-search", label: "AI Search", icon: Sparkles },
  { id: "knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { id: "ai-performance", label: "AI Performance", icon: Gauge },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

// Demo data is only included when explicitly enabled.
const INCLUDE_DEMO_DATA = import.meta.env.VITE_INCLUDE_DEMO_DATA === "true";
const SEED_TICKET_IDS = new Set(SEED_TICKETS.map((t) => t.id));
const SEED_QUESTION_IDS = new Set(SEED_QUESTIONS.map((q) => q.id));
const SEED_SME_REQUEST_IDS = new Set(SEED_SME_REQUESTS.map((r) => r.id));
const SEED_NOTIFICATION_IDS = new Set(SEED_NOTIFICATIONS.map((n) => n.id));
const SEED_ACTIVITY_IDS = new Set(SEED_ACTIVITY.map((a) => a.id));

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
  const [initialLiveLoad, setInitialLiveLoad] = useState(!INCLUDE_DEMO_DATA);

  const [tickets, setTickets] = useState<MvpTicket[]>(
    INCLUDE_DEMO_DATA ? SEED_TICKETS : [],
  );
  const [questions, setQuestions] = useState<MvpQuestion[]>(
    INCLUDE_DEMO_DATA ? SEED_QUESTIONS : [],
  );
  const [smeRequests, setSmeRequests] = useState<MvpSmeRequest[]>(
    INCLUDE_DEMO_DATA ? SEED_SME_REQUESTS : [],
  );
  const [knowledge, setKnowledge] = useState<MvpKnowledgeEntry[]>(
    INCLUDE_DEMO_DATA ? SEED_KNOWLEDGE : [],
  );
  const [notifications, setNotifications] = useState<MvpNotification[]>(
    INCLUDE_DEMO_DATA ? SEED_NOTIFICATIONS : [],
  );
  const [activity, setActivity] = useState<MvpActivity[]>(
    INCLUDE_DEMO_DATA ? SEED_ACTIVITY : [],
  );

  const showLocalDemoData = () => {
    setTickets(SEED_TICKETS);
    setQuestions(SEED_QUESTIONS);
    setSmeRequests(SEED_SME_REQUESTS);
    setKnowledge(SEED_KNOWLEDGE);
    setNotifications(SEED_NOTIFICATIONS);
    setActivity(SEED_ACTIVITY);
  };

  // Load live data once the backend becomes available.
  const hydratedRef = useRef(false);
  const hydratingRef = useRef(false);
  const hydrate = async () => {
    if (hydratedRef.current || hydratingRef.current) return;
    hydratingRef.current = true;
    try {
      addToast("Backend connected — loading live tickets…", "info");
      const [world, kb] = await Promise.all([
        loadBackendWorld(
          new Set(
            SEED_TICKETS.map((t) => t.backendId).filter((x): x is number => x !== undefined),
          ),
        ),
        loadBackendKnowledge(),
      ]);
      // Retry later if any ticket details failed to load.
      if (world !== null && world.complete) hydratedRef.current = true;
      if (world !== null && !world.complete)
        addToast("Some tickets could not be fully loaded — will retry on reconnect.", "warning");
      if (world) {
        const keepDemo = INCLUDE_DEMO_DATA || !world.complete;
        setTickets((p) => {
          const retained = keepDemo
            ? p
            : p.filter((t) => !SEED_TICKET_IDS.has(t.id));
          return [
            ...world.tickets.filter(
              (w) => !retained.some((t) => t.backendId === w.backendId),
            ),
            ...retained,
          ];
        });
        setQuestions((p) => {
          const retained = keepDemo
            ? p
            : p.filter((q) => !SEED_QUESTION_IDS.has(q.id));
          return [
            ...retained,
            ...world.questions.filter(
              (w) => !retained.some((q) => q.backendId === w.backendId),
            ),
          ];
        });
        setSmeRequests((p) => {
          const retained = keepDemo
            ? p
            : p.filter((r) => !SEED_SME_REQUEST_IDS.has(r.id));
          return [
            ...retained,
            ...world.smeRequests.filter(
              (w) => !retained.some((r) => r.backendId === w.backendId),
            ),
          ];
        });
        if (!keepDemo) {
          setNotifications((p) =>
            p.filter((n) => !SEED_NOTIFICATION_IDS.has(n.id)),
          );
          setActivity((p) =>
            p.filter((a) => !SEED_ACTIVITY_IDS.has(a.id)),
          );
        }
        addToast(`Loaded ${world.tickets.length} ticket(s) from the live backend.`, "info");
        setInitialLiveLoad(false);
      }
      if (kb !== null)
        setKnowledge(
          INCLUDE_DEMO_DATA && kb.length === 0 ? SEED_KNOWLEDGE : kb,
        );
    } finally {
      hydratingRef.current = false;
    }
  };

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    onBackendStatus(setBackendLive);
    // Tell the user when a background save fails.
    onWriteFailure((detail) =>
      addToast(`A change could not be saved (${detail}) — it may be lost on refresh.`, "warning"),
    );
    void (async () => {
      // Retry while the hosted backend starts.
      let live = await pingBackend();
      for (const delay of [2000, 4000, 8000, 16000, 30000]) {
        if (live) break;
        await new Promise((r) => setTimeout(r, delay));
        live = await pingBackend();
      }
      if (!live) {
        addToast("Backend unreachable — showing local demo data only.", "warning");
        if (!INCLUDE_DEMO_DATA) showLocalDemoData();
        setInitialLiveLoad(false);
        // Keep checking so live data can appear after a slow startup.
        pollRef.current = setInterval(() => {
          void pingBackend().then((ok) => {
            if (ok && pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          });
        }, 30000);
        return;
      }
      void hydrate();
    })();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load live data if the backend recovers later.
  useEffect(() => {
    if (backendLive) void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendLive]);

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
        {NAV.filter((item) => item.id !== "ai-performance" || role === "Manager").map(({ id, label, icon: Icon }) => {
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
          {backendLive === null
            ? "Connecting to backend…"
            : backendLive
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

        {backendLive === false && !initialLiveLoad && (
          <div className="bg-[#FEF3C7] border-b border-[#F59E0B]/30 px-6 py-2 flex items-center gap-2 shrink-0">
            <AlertTriangle size={13} className="text-[#92400E] shrink-0" />
            <p className="text-[12px] text-[#92400E] font-medium flex-1">
              Backend unreachable — showing local demo data only. Reconnecting automatically; live
              tickets appear as soon as it answers.
            </p>
            <button
              onClick={() => void pingBackend()}
              className="text-[11px] font-bold text-[#92400E] border border-[#F59E0B]/40 rounded-full px-3 py-1 hover:bg-[#FDE68A]/60 whitespace-nowrap transition-colors"
            >
              Retry now
            </button>
          </div>
        )}

        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {initialLiveLoad ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="w-11 h-11 rounded-xl bg-[#FFF4EC] flex items-center justify-center">
                <LoaderCircle size={20} className="text-[#F96702] animate-spin" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#1F2937]">Connecting to your live workspace</p>
                <p className="text-[12px] text-[#9CA3AF] mt-1">
                  Loading tickets, SME requests, and approved knowledge sources.
                </p>
              </div>
            </div>
          ) : (
            <>
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
          {module === "ai-performance" && <AiPerformancePage />}
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
            </>
          )}
        </main>
      </div>
      <Toast toasts={toasts} remove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </div>
  );
}
