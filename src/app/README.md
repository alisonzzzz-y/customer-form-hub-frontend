# Customer Forms Hub — frontend structure

One app, organised by responsibility (not by file extension): `data/` and
`services/` are logic (.ts), `components/` and `pages/` render UI (.tsx).

```
src/
  main.tsx                 # entry: mounts <AppShell /> at /
  styles/                  # Tailwind setup + theme (unchanged)
  app/
    AppShell.tsx           # application shell: sidebar, top bar, role switch,
                           # global state (tickets/questions/SME/knowledge/
                           # notifications/activity) and module routing
    api.ts                 # Alison's typed backend API layer (types consumed
                           # by services/backend.ts; do not edit without her)
    vite-env.d.ts          # typing for import.meta.env.VITE_API_BASE
    data/
      model.ts             # domain types (Ticket/Question/SmeRequest/…),
                           # status vocabularies, date/overdue helpers
      seeds.ts             # local demo data (lives alongside anything
                           # hydrated from the live backend)
    services/
      backend.ts           # backend adapter: env-configurable base URL, every
                           # API call, live/offline detection, startup
                           # hydration, value mapping to backend vocabulary
      simulation.ts        # offline fallbacks: intake email parser, question
                           # extraction templates, simulated suggestions
    components/
      ui.tsx               # shared presentational pieces: status pills,
                           # confidence/sharing badges, cards, buttons, toast,
                           # empty states, mailto helper
    pages/
      DashboardPage.tsx    # landing: metric cards (deep-link to filtered
                           # tickets), priority list, SME ETA tracker,
                           # activity feed, knowledge pending review
      TicketsPage.tsx      # all tickets: search + status/dept/NDA/urgency
                           # filters (statuses are filters, not pages)
      TicketDetailPage.tsx # one ticket: Overview / Workflow / Files /
                           # Timeline / Activity tabs, reopen/close actions
      TicketWorkflow.tsx   # the guided per-ticket flow inside the Workflow
                           # tab: Intake check → Grouping → Answer Review →
                           # SME Package → ETA Tracking → Final Review
      NewRequestFlow.tsx   # "New Request" dialog: paste the AE email (+
                           # attach form) → AI intake extraction; also the
                           # editable AE clarification email
      AiSearchPage.tsx     # citation-first semantic search over approved
                           # knowledge
      KnowledgeBasePage.tsx# knowledge module: department browsing, pending-
                           # review approvals, live load + write-back
      ReportsPage.tsx      # charts (ticket progress/status mix/dept load),
                           # filtered metrics + AI summary, report viewer
                           # with PDF/Excel export
      NotificationsPage.tsx# unread filtering, mark-all-read, deep links
      SettingsPage.tsx     # analyst preferences (localStorage for now)
```
