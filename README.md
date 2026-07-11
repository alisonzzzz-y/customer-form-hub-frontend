# Customer Forms Hub — Frontend

Internal AI-assisted workflow platform for Cloudera's Global Order Management
team: intake customer compliance questionnaires, review AI-suggested answers
against the knowledge base, route open questions to SMEs, track ETAs, and
export the completed response. UCC x Cloudera capstone (July 2026).

**Stack**: React 18 · TypeScript · Vite · Tailwind CSS 4 · Recharts · Playwright

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

The app is backend-first with a simulated fallback: if the Spring Boot
backend (https://github.com/alisonzzzz-y/customer-form-hub) is running on
localhost:8080 you get real parsing/retrieval/export (green "Backend live"
dot, bottom-left); otherwise every flow still works on simulated data.

To develop against realistic API responses without the real backend:

```bash
npm run mock       # contract mock of the backend on :8080
```

## Configuration

| Variable | Purpose |
|---|---|
| `VITE_API_BASE` | Backend origin. Unset → `http://localhost:8080`. On Vercel, set to the Render backend URL (and set `CORS_ALLOWED_ORIGINS` on the backend to the Vercel URL). |

See `.env.example`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` / `preview` | Production build / serve it locally |
| `npm run typecheck` | Strict project-wide `tsc --noEmit` |
| `npm run mock` | Contract mock backend on :8080 (in-memory, `/api/_debug/reset`) |
| `npm run test:e2e` | Self-contained Playwright E2E: spawns the mock + a Vite server on :5199, runs all `e2e/*.spec.mjs`, cleans up |

## Structure

Layer-based `src/` layout — see [`src/app/README.md`](src/app/README.md) for
a per-file map. Highlights: `services/backend.ts` is the only module that
talks to the API (env-configurable, graceful offline fallback);
`pages/TicketWorkflow.tsx` is the guided per-ticket flow (Intake → Grouping →
Answer Review → SME Package → ETA Tracking → Final Review).

## Conventions

- Backend calls are best-effort: reachable → live, otherwise simulate. Never
  block the UI on the backend.
- The system never sends email — sends open a pre-filled draft in the user's
  mail client via `mailto:` (attachments must be added manually).
- Archive over delete (no DELETE endpoints are called), UTC markers on all
  timestamps, Cloudera orange `#F96702`.
