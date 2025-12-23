# Email Assistant (Mastra + Next.js)

A full-stack intelligent email copilot that classifies inboxes, drafts replies, and manages calendar coordination. The backend is built on Mastra’s multi-agent framework with Composio tool integrations and Drizzle/Postgres storage; the frontend is a Clerk-authenticated Next.js app that guides users through Gmail/Calendar connections and surfaces briefs of processed mail.

## Features
- Multi-agent orchestration via Mastra (email classifier, composer, manager) with an inbox triage workflow.
- Gmail and Google Calendar connectivity through Composio toolkits, including webhook-driven processing.
- AI drafting with OpenAI (meeting-aware replies, urgency detection, brief generation).
- User-authenticated settings (Clerk) for working hours, Calendly fallback, and calendar toggle.
- Typed data layer with Drizzle ORM and Postgres (Neon-ready), plus rate limiting on AI endpoints.
- Polished Next.js dashboard: connect Gmail/Calendar, view brief, manage preferences; public marketing/landing.

## Monorepo layout
- `apps/api` — Mastra backend (Hono-style server), Drizzle schema, Composio/OpenAI/Clerk wiring.
- `apps/web` — Next.js 16 frontend with Clerk, dashboard flows, and marketing pages.
- `packages/types`, `packages/shared`, `packages/config` — shared typings and config used across apps.
- `turbo.json`, `pnpm-workspace.yaml` — Turborepo and workspace configuration.

## Prerequisites
- Node 22+ (project preference) and pnpm 9.x.
- Postgres connection string (Neon or equivalent).
- API keys/secrets: OpenAI, Clerk, Composio (Gmail + Calendar auth config IDs).

## Backend (apps/api)
### Environment variables
- `OPENAI_API_KEY`
- `CLERK_SECRET_KEY`
- `COMPOSIO_API_KEY`
- `COMPOSIO_GMAIL_AUTH_CONFIG_ID`
- `COMPOSIO_GCAL_AUTH_CONFIG_ID`
- `NEON_DATABASE_URL` (Postgres URL for Drizzle + runtime)
- Optional: `LOG_LEVEL` (debug|info|warn|error), `NODE_ENV=production`

### Install, migrate, run (local)
```bash
pnpm install --frozen-lockfile
pnpm --filter @email-assistant/api db:push     # apply Drizzle schema
pnpm --filter @email-assistant/api dev         # Mastra dev server (defaults to 3000)
```

### Build & start (production)
```bash
pnpm --filter @email-assistant/api build       # runs `mastra build`
pnpm --filter @email-assistant/api start       # runs `node dist/index.js`
```
The server exposes:
- `/api/*` — Mastra built-in agent/workflow APIs.
- `/composio/webhook` — Gmail webhook ingest.
- `/composio/health` — health check.
- `/composio/triggers/setup` & `/composio/triggers` — Composio trigger management (auth required).
- `/settings/get` & `/settings/update` — user settings (Clerk-authenticated).
- `/brief` — inbox brief (rate-limited).
- `/meeting/detect` — meeting intent detector.

### Data model (Drizzle)
- `user_settings`: user_id (Clerk), Calendly URL, working hours, timezone, calendar_enabled, timestamps.
- `processed_emails`: id, message/thread IDs, user_id, metadata, meeting flags, urgency, generated draft, processed_at.

## Frontend (apps/web)
### Environment variables
- `NEXT_PUBLIC_MASTRA_API_URL` (e.g., `http://localhost:3000/api` or Railway host `/api`)
- `NEXT_PUBLIC_APP_URL` (optional override; otherwise uses `VERCEL_URL`)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `COMPOSIO_API_KEY`, `COMPOSIO_GMAIL_AUTH_CONFIG_ID`, `COMPOSIO_GCAL_AUTH_CONFIG_ID` (server-side for API routes)

### Run locally
```bash
pnpm --filter @email-assistant/web dev --port 3001
# ensure backend is running and NEXT_PUBLIC_MASTRA_API_URL points to it
```

### Build & start
```bash
pnpm --filter @email-assistant/web build
pnpm --filter @email-assistant/web start --port 3001
```

### UX highlights
- Dashboard connects Gmail/Calendar via Composio OAuth popups, with status polling and error handling.
- Settings panel for Calendly fallback, working hours, timezone, and calendar enable toggle.
- Brief section summarizing processed emails with urgency/meeting context.
- Marketing/landing pages showcasing the assistant’s value prop.

## Deployment notes
- **Backend (Railway-friendly):** build `pnpm --filter @email-assistant/api build`; start `pnpm --filter @email-assistant/api start`. Set Node 22, pnpm 9, and all backend env vars above. Use Railway Postgres or Neon for `NEON_DATABASE_URL`.
- **Frontend (Vercel-friendly):** build `pnpm --filter @email-assistant/web build`. Set env vars above and point `NEXT_PUBLIC_MASTRA_API_URL` to the backend host + `/api`. Redeploy after backend URL changes.

## Development tips
- Use `pnpm typecheck` or `pnpm --filter @email-assistant/api typecheck` / `@email-assistant/web typecheck` for faster feedback.
- Rate limits guard AI-heavy endpoints; expect 429-style responses if exceeded.
- Mastra build artifacts are in `apps/api/dist`; custom routes live in `apps/api/src/mastra/index.ts`.


