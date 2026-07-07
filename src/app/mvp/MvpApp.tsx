import React, { useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { Toast } from "../components/shared";
import { ToastMsg } from "../types";
import { SettingsScreen } from "../screens/SettingsScreen";
import {
  ModuleId,
  Role,
  MvpTicket,
  MvpQuestion,
  MvpSmeRequest,
  MvpKnowledgeEntry,
  MvpNotification,
  MvpActivity,
  SEED_TICKETS,
  SEED_QUESTIONS,
  SEED_SME_REQUESTS,
  SEED_KNOWLEDGE,
  SEED_NOTIFICATIONS,
  SEED_ACTIVITY,
} from "./data";
import { DashboardPage } from "./DashboardPage";
import { TicketsPage, TicketFilters, EMPTY_FILTERS } from "./TicketsPage";
import { TicketDetailPage } from "./TicketDetailPage";
import { AiSearchPage } from "./AiSearchPage";
import { KnowledgeBasePage } from "./KnowledgeBasePage";
import { ReportsPage } from "./ReportsPage";
import { NotificationsPage } from "./NotificationsPage";

// PRD §4/§5: module navigation shell. Sidebar lists modules, never workflow
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
  openKnowledge: (view: "all" | "pending", entryId?: number) => void;
  setTickets: React.Dispatch<React.SetStateAction<MvpTicket[]>>;
  setQuestions: React.Dispatch<React.SetStateAction<MvpQuestion[]>>;
  setSmeRequests: React.Dispatch<React.SetStateAction<MvpSmeRequest[]>>;
  setKnowledge: React.Dispatch<React.SetStateAction<MvpKnowledgeEntry[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<MvpNotification[]>>;
  addToast: (m: string, t?: ToastMsg["type"]) => void;
  logActivity: (action: string, ticketId?: string) => void;
  openNewTicket: () => void;
};

export default function MvpApp() {
  const [module, setModule] = useState<ModuleId>("dashboard");
  const [role, setRole] = useState<Role>("Analyst");
  const [roleMenu, setRoleMenu] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [ticketFilters, setTicketFilters] = useState<TicketFilters>(EMPTY_FILTERS);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [kbView, setKbView] = useState<"all" | "pending">("all");
  const [kbFocusEntry, setKbFocusEntry] = useState<number | null>(null);
  const [globalQuery, setGlobalQuery] = useState("");

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
      openKnowledge: (view, entryId) => {
        setKbView(view);
        setKbFocusEntry(entryId ?? null);
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

  return (
    <div
      className="h-screen w-screen flex overflow-hidden bg-[#F5F4F1]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Sidebar (GL-01) */}
      <aside className="w-56 bg-white flex flex-col shrink-0 h-full overflow-y-auto border-r border-[rgba(0,0,0,0.06)]">
        <div className="h-[3px] bg-[#F96702] w-full shrink-0" />
        <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.06)] shrink-0 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#F96702] flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(249,103,2,0.35)]">
            <span className="text-white text-[11px] font-black">C</span>
          </div>
          <div>
            <p className="text-[#0A0A0A] text-xs font-bold leading-tight tracking-[-0.01em]">
              Customer Forms Hub
            </p>
            <p className="text-[#9CA3AF] text-[10px] tracking-[0.04em] uppercase font-medium">
              Cloudera GOM
            </p>
          </div>
        </div>
        <nav className="flex-1 py-3 px-3 flex flex-col gap-0.5">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = module === id || (id === "tickets" && module === "ticket-detail");
            return (
              <button
                key={id}
                onClick={() => setModule(id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] w-full text-left transition-all ${active ? "bg-[#F96702] text-white font-bold shadow-[0_2px_8px_rgba(249,103,2,0.3)]" : "text-[#6B7280] hover:text-[#111111] hover:bg-[#F5F3F0]"}`}
              >
                <Icon size={13} />
                <span className="flex-1">{label}</span>
                {id === "notifications" && unread > 0 && (
                  <span
                    className={`text-[9px] font-bold rounded-full px-1.5 py-px ${active ? "bg-white text-[#F96702]" : "bg-[#F96702] text-white"}`}
                  >
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-[rgba(0,0,0,0.06)] shrink-0 text-[9px] text-[#B8B5B0] font-medium">
          MVP demo build · seeded data
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar (GL-02/03/04) */}
        <header className="h-12 bg-white border-b border-[rgba(0,0,0,0.06)] flex items-center gap-3 px-5 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitGlobalSearch()}
              placeholder="Search company, SOR ID, ticket ID…"
              className="w-full pl-8 pr-4 py-1.5 text-[11px] border border-[rgba(0,0,0,0.12)] rounded-full bg-[#FAFAF9] placeholder-[#B0B0B0] focus:outline-none focus:ring-2 focus:ring-[#F96702]/30 focus:border-[#F96702]/50 focus:bg-white transition-all"
            />
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            {role !== "SME" && (
              <button
                onClick={actions.openNewTicket}
                className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] bg-[#F96702] text-white rounded-full hover:bg-[#D95400] font-bold tracking-[0.06em] shadow-[0_2px_8px_rgba(249,103,2,0.3)] transition-all"
              >
                <Plus size={11} /> New Request
              </button>
            )}
            <button
              onClick={() => setModule("notifications")}
              className="relative w-8 h-8 rounded-full border border-[rgba(0,0,0,0.1)] flex items-center justify-center text-[#6B7280] hover:text-[#F96702] hover:border-[#F96702]/40 transition-all"
            >
              <Bell size={13} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#F96702] text-white text-[8px] font-bold rounded-full min-w-[14px] h-3.5 px-1 flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
            <div className="relative">
              <button
                onClick={() => setRoleMenu((o) => !o)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-[rgba(0,0,0,0.1)] hover:border-[#F96702]/40 transition-all"
              >
                <span className="w-6 h-6 rounded-full bg-[#F5F3F0] flex items-center justify-center ring-2 ring-[#F96702]/20">
                  <User size={11} className="text-[#F96702]" />
                </span>
                <span className="text-left">
                  <span className="block text-[10px] font-semibold text-[#0A0A0A] leading-tight">
                    {currentUser}
                  </span>
                  <span className="block text-[8.5px] text-[#9CA3AF] uppercase tracking-[0.08em] font-bold leading-tight">
                    {role}
                  </span>
                </span>
                <ChevronDown size={11} className="text-[#9CA3AF]" />
              </button>
              {roleMenu && (
                <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl border border-[rgba(0,0,0,0.08)] shadow-[0_8px_24px_rgba(0,0,0,0.12)] py-1.5 z-50">
                  <p className="px-3 py-1 text-[9px] font-black text-[#ABABAB] uppercase tracking-[0.12em]">
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
                      className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#F5F3F0] ${role === r ? "font-bold text-[#C05600]" : "text-[#374151]"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

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
            />
          )}
          {module === "reports" && <ReportsPage state={state} actions={actions} />}
          {module === "notifications" && <NotificationsPage state={state} actions={actions} />}
          {module === "settings" && (
            <SettingsScreen
              setScreen={() => setModule("dashboard")}
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
