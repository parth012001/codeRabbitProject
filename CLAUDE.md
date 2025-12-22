# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Email Assistant - An intelligent email management application powered by Mastra AI with Composio Gmail integration. Monorepo using pnpm workspaces with TypeScript.

## Commands

```bash
# Development
pnpm dev                                    # Start all dev servers
pnpm dev --filter @email-assistant/web      # Web app only (port 3001)
pnpm dev --filter @email-assistant/api      # API only

# Build & Quality
pnpm build                                  # Build all packages
pnpm typecheck                              # TypeScript checking
pnpm lint                                   # ESLint
pnpm format                                 # Prettier

# Single package operations
pnpm build --filter @email-assistant/api
pnpm build --filter @email-assistant/web
pnpm build --filter @email-assistant/shared
```

## Architecture

### Monorepo Structure

- `apps/api` - Mastra AI backend with email agents and tools
- `apps/web` - Next.js 16 frontend with Clerk auth (port 3001)
- `packages/types` - Shared TypeScript types (Email, Classification, Thread)
- `packages/shared` - Utilities (email parsing, validation, retry helpers)
- `packages/config` - Environment configuration with Zod validation

### AI Agents (`apps/api/src/agents/`)

Three specialized agents using OpenAI GPT-4o:

1. **Email Manager Agent** (`email-manager-agent.ts`) - Main agent with Gmail OAuth via Composio, handles connection management, inbox operations, composition
2. **Email Classifier Agent** (`email-classifier-agent.ts`) - Classifies by category/priority/sentiment
3. **Email Composer Agent** (`email-composer-agent.ts`) - Drafts emails with tone support (formal, professional, casual, friendly)

### Tools (`apps/api/src/tools/`)

- `composio-email-tools.ts` - Real Gmail operations via Composio OAuth (connect, fetch, send, reply, draft)
- `email-tools.ts` - Legacy mock implementations for testing

### Workflows (`apps/api/src/workflows/`)

- `inbox-triage-workflow.ts` - 3-step pipeline: fetch → classify → summarize with recommendations

### Core Patterns

- **Multi-user support**: UserId injected from Clerk into agent context for Composio tool isolation
- **Tool composition**: Agents combine multiple tools; tools use Zod schemas for validation
- **Mastra initialization**: `apps/api/src/mastra/index.ts` configures agents, workflows, LibSQL storage

## Key Technologies

- Mastra (AI agent framework) + OpenAI/Anthropic SDKs
- Composio (Gmail OAuth integration)
- Next.js 16 + React 19 + Tailwind CSS 4
- Clerk (authentication)
- Turbo (build orchestration)
- LibSQL (persistence)

## Environment Variables

Required:
- `OPENAI_API_KEY` - For AI agents
- `COMPOSIO_API_KEY` - For Gmail integration
- `COMPOSIO_GMAIL_AUTH_CONFIG_ID` - Gmail OAuth config

Optional:
- `ANTHROPIC_API_KEY`, `PORT`, `NODE_ENV`, `LOG_LEVEL`, `DATABASE_URL`

## Code Style

- Prettier: semicolons, single quotes, 2-space tabs, trailing commas (es5), 100 char width
- TypeScript strict mode, ES2022 target, ESM modules
