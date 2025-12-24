# Noa — Intelligent Email Assistant

An AI-powered email copilot that works in the shadows. Connect your Gmail and Calendar once — Noa handles the rest. Drafts appear in your inbox, meetings land on your calendar, and you get an executive brief every morning. No new apps to learn. No new behaviors required.

## Demo & Resources

| Resource | Link |
|----------|------|
| Demo Video | [Watch the full product walkthrough](https://drive.google.com/file/d/1ZY2uhKS3_mSAslDAOgHxdN7z9Tre37AL/view?usp=drive_link) |
| Presentation | [View the project presentation](https://drive.google.com/file/d/1G88ImKTh1iUmQY0BN7WbmH0YF9q9t8nn/view?usp=drive_link) |
| CodeRabbit Review | [AI code review feedback](https://drive.google.com/file/d/1e1HZwBkFV_yxe6Vd9UIW-9B170DMonwF/view?usp=drive_link) |

## What Noa Does

- **Auto-drafts replies** — Context-aware, tone-matched responses generated before you open Gmail
- **Detects meeting requests** — Parses proposed times, checks your calendar, accepts or declines automatically
- **Handles conflicts** — Declines gracefully and shares your Calendly link as fallback
- **Creates calendar events** — Meetings are scheduled with details extracted from the email
- **Executive briefs** — Summarizes your last 24 hours: urgent items, meeting requests, availability status

## How It Works

```
User connects Gmail + Calendar (one-time OAuth)
                    ↓
        Noa listens via webhooks
                    ↓
    New email → Classify → Detect meetings → Draft reply
                    ↓
        Check calendar availability
                    ↓
    Gmail: Draft ready    Calendar: Event created
                    ↓
       User opens Gmail → Just hits send
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| AI Framework | Mastra (multi-agent orchestration) |
| LLM | OpenAI GPT-4o / GPT-4o-mini |
| Integrations | Composio (Gmail + Google Calendar OAuth) |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Auth | Clerk (JWT-based) |
| Database | Neon Postgres + Drizzle ORM |
| Build | Turborepo + pnpm workspaces |

## Monorepo Structure

```
apps/
  api/          → Mastra backend, agents, tools, webhooks
  web/          → Next.js frontend, dashboard, landing page
packages/
  types/        → Shared TypeScript interfaces
  shared/       → Utility functions
  config/       → Environment config with Zod validation
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables (see below)

# Push database schema
pnpm --filter @email-assistant/api db:push

# Run both servers
pnpm dev
```

API runs on `localhost:3000`, Web runs on `localhost:3001`

## Environment Variables

### Backend (`apps/api`)

```
OPENAI_API_KEY=
CLERK_SECRET_KEY=
COMPOSIO_API_KEY=
COMPOSIO_GMAIL_AUTH_CONFIG_ID=
COMPOSIO_GCAL_AUTH_CONFIG_ID=
NEON_DATABASE_URL=
```

Optional: `LOG_LEVEL` (debug|info|warn|error), `NODE_ENV`

### Frontend (`apps/web`)

```
NEXT_PUBLIC_MASTRA_API_URL=http://localhost:3000/api
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
COMPOSIO_API_KEY=
COMPOSIO_GMAIL_AUTH_CONFIG_ID=
COMPOSIO_GCAL_AUTH_CONFIG_ID=
```

Optional: `NEXT_PUBLIC_APP_URL`

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/*` | Mastra built-in agent/workflow APIs |
| `/composio/webhook` | Gmail webhook ingestion |
| `/composio/triggers/setup` | Create Gmail trigger for user (auto-called on OAuth) |
| `/settings/get`, `/settings/update` | User preferences (Clerk auth required) |
| `/brief` | Executive summary generation (rate-limited) |
| `/calendar/status`, `/calendar/availability` | Calendar connection and availability |

## Database Schema

**user_settings** — Clerk user ID, Calendly URL, working hours, timezone, calendar toggle

**processed_emails** — Message/thread IDs, user ID, sender, subject, meeting flags, urgency, generated draft, timestamp

## Deployment

**Backend (Railway):**
```bash
pnpm --filter @email-assistant/api build
pnpm --filter @email-assistant/api start
```

**Frontend (Vercel):**
```bash
pnpm --filter @email-assistant/web build
```

Point `NEXT_PUBLIC_MASTRA_API_URL` to your deployed backend.

## Development

```bash
pnpm dev                    # Run all services
pnpm typecheck              # Type checking
pnpm lint                   # Linting
pnpm --filter @email-assistant/api db:studio  # Database GUI
```

---

Built with Mastra AI + Composio
