import React, { useState } from "react";
import { Bell, BookOpen, Brain, CheckCheck, Clock, Inbox } from "lucide-react";
import { MvpNotification, fmtDateTime } from "./data";
import { AppActions, AppState } from "./MvpApp";
import { Card, EmptyState } from "./ui";

// PRD §14: centralised attention items with read/unread filtering (NTF-05)
// and deep links back to the related object (NTF-06).

const ICONS: Record<MvpNotification["type"], React.ElementType> = {
  "SME Reply": Inbox,
  Overdue: Clock,
  "AI Complete": Brain,
  "Knowledge Review": BookOpen,
  "Status Change": Bell,
};

export function NotificationsPage({ state, actions }: { state: AppState; actions: AppActions }) {
  const [filter, setFilter] = useState<"All" | "Unread">("All");
  const { notifications } = state;
  const visible =
    filter === "Unread" ? notifications.filter((n) => !n.read) : notifications;
  const unread = notifications.filter((n) => !n.read).length;

  const markRead = (id: number) =>
    actions.setNotifications((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const open = (n: MvpNotification) => {
    markRead(n.id);
    if (n.ticketId) actions.openTicket(n.ticketId);
    else if (n.knowledgeId) actions.openKnowledge("pending", n.knowledgeId);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-7 pt-6 pb-4 bg-white border-b border-[rgba(0,0,0,0.06)] shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-7 bg-[#F96702] rounded-full shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Notifications</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              SME replies, overdue ETAs, AI processing and knowledge reviews in one place
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(["All", "Unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 text-[10px] font-bold rounded-full border transition-all ${filter === f ? "bg-[#F96702] text-white border-transparent" : "border-[rgba(0,0,0,0.15)] text-[#6B7280] hover:border-[#F96702]/50"}`}
            >
              {f}
              {f === "Unread" && unread > 0 && ` (${unread})`}
            </button>
          ))}
          {unread > 0 && (
            <button
              onClick={() => {
                actions.setNotifications((p) => p.map((n) => ({ ...n, read: true })));
                actions.addToast("All notifications marked as read.", "info");
              }}
              className="flex items-center gap-1 px-3.5 py-1.5 text-[10px] font-semibold border border-[rgba(0,0,0,0.15)] rounded-full text-[#6B7280] hover:border-[#F96702]/50 hover:text-[#F96702] transition-all"
            >
              <CheckCheck size={11} /> Mark all read
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-3xl mx-auto">
          <Card>
            {visible.length === 0 ? (
              <EmptyState icon={Bell} title="You are all caught up." />
            ) : (
              <div className="divide-y divide-border">
                {visible.map((n) => {
                  const Icon = ICONS[n.type];
                  return (
                    <button
                      key={n.id}
                      onClick={() => open(n)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-gray-50/60 ${!n.read ? "bg-[#FFF8F4]" : ""}`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${n.type === "Overdue" ? "bg-[#FEF2F2] text-[#991B1B]" : "bg-[#FFF4EC] text-[#C05600]"}`}
                      >
                        <Icon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs flex-1 ${!n.read ? "font-bold text-[#0A0A0A]" : "font-medium text-[#374151]"}`}>
                            {n.title}
                          </p>
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#F96702] shrink-0" />}
                        </div>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">{n.content}</p>
                        <p className="text-[10px] text-[#9CA3AF] mt-1">{fmtDateTime(n.createdAt)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
