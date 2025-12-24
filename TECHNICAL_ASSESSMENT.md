# Technical Assessment: Noa Email Assistant

**Assessment Date:** December 2025
**Codebase Version:** 0.0.1
**Assessor:** Automated Code Analysis

---

## 1. Architecture Overview

### 1.1 System Design

The application follows a **monorepo architecture** with clear separation between frontend, backend, and shared packages.

```
email-assistant/
├── apps/
│   ├── api/          # Mastra AI backend (Port 3000)
│   └── web/          # Next.js frontend (Port 3001)
├── packages/
│   ├── types/        # Shared TypeScript definitions
│   ├── shared/       # Utility functions
│   └── config/       # Environment configuration
```

### 1.2 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend Framework | Next.js | 16.1.0 |
| UI Library | React | 19.2.3 |
| Styling | Tailwind CSS | 4.x |
| Animation | Framer Motion | 12.23.26 |
| Authentication | Clerk | 6.36.5 |
| AI Framework | Mastra | 0.24.9 |
| LLM Provider | OpenAI | 4.77.0 |
| OAuth Integration | Composio | 0.3.1 |
| Database | Neon Postgres | Serverless |
| ORM | Drizzle | 0.45.1 |
| Validation | Zod | 3.24.1 |
| Build System | Turborepo | 2.3.3 |
| Package Manager | pnpm | 9.15.0 |

### 1.3 Dependency Graph

```
@email-assistant/types (no dependencies)
         ↓
@email-assistant/shared (depends on types)
         ↓
@email-assistant/config (depends on zod)
         ↓
@email-assistant/api (depends on types, shared, config)
@email-assistant/web (depends on types)
```

---

## 2. Backend Architecture

### 2.1 Multi-Agent System

Three specialized AI agents handle distinct responsibilities:

| Agent | Model | Purpose |
|-------|-------|---------|
| Email Manager | GPT-4o-mini | Gmail OAuth, inbox operations, email composition |
| Email Classifier | GPT-4o | Category/priority/sentiment classification |
| Email Composer | GPT-4o | Tone-aware draft generation |

### 2.2 Service Layer

| Service | Responsibility |
|---------|----------------|
| `composio.ts` | Gmail/Calendar OAuth management, trigger setup |
| `email-webhook-handler.ts` | Webhook processing, draft generation pipeline |
| `meeting-detector.ts` | AI-powered meeting request detection |
| `calendar-service.ts` | FreeBusy API, availability checking |
| `brief-service.ts` | Executive summary generation |
| `processed-email-service.ts` | Database operations, deduplication |
| `user-profile.ts` | User settings management |
| `urgency-detector.ts` | Regex-based urgency classification |
| `rate-limiter.ts` | Per-user request throttling |

### 2.3 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/composio/webhook` | POST | Gmail webhook ingestion |
| `/composio/triggers/setup` | POST | Create Gmail trigger |
| `/composio/triggers` | GET | List active triggers |
| `/calendar/connect` | POST | Initiate Calendar OAuth |
| `/calendar/status` | GET | Check calendar connection |
| `/calendar/availability` | POST | Check time slot availability |
| `/calendar/slots` | GET | Get available meeting slots |
| `/meeting/detect` | POST | AI meeting detection |
| `/settings/get` | GET | Retrieve user settings |
| `/settings/update` | POST | Update user settings |
| `/brief` | GET | Generate executive brief |

### 2.4 Database Schema

**Tables:**

1. **user_settings**
   - Primary Key: `userId` (Clerk ID)
   - Fields: `calendlyUrl`, `workingHoursStart`, `workingHoursEnd`, `timezone`, `calendarEnabled`
   - Timestamps: `createdAt`, `updatedAt`

2. **processed_emails**
   - Primary Key: `id` (UUID)
   - Fields: `messageId`, `threadId`, `userId`, `from`, `subject`, `snippet`
   - Classification: `isMeetingRequest`, `availabilityStatus`, `isUrgent`
   - Draft: `draftId`, `draftBody`
   - Timestamp: `processedAt`
   - Indexes: `user_id_idx`, `message_user_idx`, `processed_at_idx`

### 2.5 Webhook Processing Pipeline

```
Gmail Webhook Received
        ↓
Extract Email Data (messageId, threadId, from, subject, body)
        ↓
Deduplication Check (messageId + userId)
        ↓
Fetch User Profile (name, email from Clerk)
        ↓
AI Meeting Detection (OpenAI structured outputs)
        ↓
[If Meeting Request]
    ├── Check Calendar Availability (FreeBusy API)
    ├── Get Alternative Slots (if unavailable)
    └── Get Calendly URL (fallback)
        ↓
Generate Draft Reply (context-aware, tone-matched)
        ↓
Create Draft in Gmail (Composio action)
        ↓
[If Available] Create Calendar Event
        ↓
Persist to Database
```

---

## 3. Frontend Architecture

### 3.1 Application Structure

```
apps/web/src/
├── app/
│   ├── layout.tsx              # Root layout with Clerk provider
│   ├── page.tsx                # Landing page
│   ├── dashboard/page.tsx      # Main dashboard
│   ├── oauth-success/page.tsx  # OAuth callback
│   └── api/                    # API routes (proxy to backend)
├── components/
│   ├── ui/                     # Reusable components (Button, Card)
│   ├── landing/                # Landing page sections
│   └── dashboard/              # Dashboard components
├── lib/
│   ├── api/                    # Typed API client layer
│   ├── composio.ts             # Composio SDK client
│   └── utils/                  # Utility functions
└── config/                     # Animation presets, content
```

### 3.2 State Management

- **Local component state** via React hooks
- **No global state library** (Redux/Zustand not required for current complexity)
- **URL search params** for OAuth callback handling
- **Polling mechanism** for OAuth completion detection

### 3.3 API Client Layer

- Custom `ApiError` class with status, code, and details
- Promise race-based timeout implementation
- Configurable timeouts per operation type:

| Operation | Timeout |
|-----------|---------|
| Default | 30,000ms |
| Status Check | 10,000ms |
| Connection | 15,000ms |
| AI Operation | 15,000ms |
| Agent | 60,000ms |

### 3.4 Authentication Flow

1. Clerk modal-based Sign In/Sign Up
2. Middleware protection on all routes
3. Server-side token retrieval for API calls
4. Race condition handling in header rendering

---

## 4. Shared Packages

### 4.1 @email-assistant/types (302 lines)

Comprehensive type definitions covering:
- Email entities (Email, EmailThread, Attachment)
- Classification types (Category, Priority, Sentiment)
- Action types (Reply, Forward, Archive, etc.)
- Agent types (Context, Preferences, Messages)
- Connection types (Gmail, Calendar status)
- Workflow types (InboxTriageResult)
- Brief types (ProcessedEmail, Stats, Breakdown)
- API response types (Generic wrappers, Pagination)

### 4.2 @email-assistant/shared (137 lines)

Utility functions:
- Email formatting and parsing
- Thread participant extraction
- Relative time formatting
- Text truncation and HTML stripping
- Email validation
- ID generation
- Async utilities (sleep, retry with exponential backoff)

### 4.3 @email-assistant/config (100 lines)

- Zod-based environment validation
- Application configuration interface
- Default configuration values
- Config creation with overrides

---

## 5. Code Quality Assessment

### 5.1 Strengths

| Category | Observation |
|----------|-------------|
| Type Safety | TypeScript strict mode throughout, comprehensive type definitions |
| Error Handling | Try-catch with typed errors, graceful degradation in webhooks |
| Security | Clerk JWT verification, user isolation, anonymized logging |
| Code Organization | Clear separation of concerns, barrel exports, single-responsibility functions |
| Modern Tooling | Latest framework versions, proper monorepo setup |
| AI Integration | Structured outputs with Zod schemas, multi-model strategy |
| Database | Proper indexing, atomic upserts, type-safe ORM |

### 5.2 Design Patterns

| Pattern | Implementation |
|---------|----------------|
| Multi-Agent Architecture | Specialized agents for distinct tasks |
| Service Layer | Business logic isolated from route handlers |
| Repository Pattern | Database operations encapsulated in services |
| Factory Pattern | Config creation with defaults and overrides |
| Retry with Backoff | Exponential backoff in shared utilities |
| Graceful Degradation | Non-critical failures don't crash webhooks |
| Fail-Open | Deduplication failures allow processing to continue |

### 5.3 Security Measures

| Measure | Implementation |
|---------|----------------|
| Authentication | Clerk JWT verification on protected routes |
| Authorization | User can only access own data |
| Input Validation | Zod schemas for all inputs |
| Secret Management | Environment variables, no hardcoded values |
| Logging | User IDs anonymized in logs |
| Rate Limiting | Per-user throttling on AI endpoints |

### 5.4 Areas for Enhancement

| Area | Current State | Recommendation |
|------|---------------|----------------|
| Rate Limiting | In-memory (per-instance) | Redis-based for horizontal scaling |
| Testing | No visible test suite | Add unit and integration tests |
| CI/CD | No configuration present | Add GitHub Actions workflow |
| Error Monitoring | Basic logging | Integrate Sentry or similar |
| API Versioning | No versioning | Add version prefix to endpoints |
| Email Validation | Basic regex | Use RFC 5322 compliant validation |

---

## 6. Performance Considerations

### 6.1 Optimizations Present

- Parallel operations with `Promise.all()` (draft + calendar event creation)
- Database indexes on frequently queried columns
- Non-blocking database saves in webhook handler
- Automatic cleanup of rate limiter entries (5-minute interval)
- Lazy initialization of Composio client (singleton pattern)

### 6.2 Scalability Notes

- Webhook handler designed for async processing
- Database uses serverless Postgres (auto-scaling)
- Stateless API design allows horizontal scaling
- Rate limiter requires Redis for multi-instance deployment

---

## 7. Integration Analysis

### 7.1 External Services

| Service | Purpose | Integration Method |
|---------|---------|-------------------|
| OpenAI | LLM inference | Direct SDK |
| Composio | Gmail/Calendar OAuth | SDK + webhooks |
| Clerk | User authentication | SDK + middleware |
| Neon | Database | Serverless HTTP client |

### 7.2 Composio Integration

**Gmail Actions:**
- `GMAIL_FETCH_EMAILS`
- `GMAIL_SEND_EMAIL`
- `GMAIL_CREATE_EMAIL_DRAFT`
- `GMAIL_REPLY_TO_THREAD`

**Calendar Actions:**
- `GOOGLECALENDAR_EVENTS_LIST`
- `GOOGLECALENDAR_CREATE_EVENT`
- `GOOGLECALENDAR_FREE_BUSY_QUERY`
- `GOOGLECALENDAR_FIND_FREE_SLOTS`

### 7.3 AI Integration

| Feature | Model | Technique |
|---------|-------|-----------|
| Meeting Detection | GPT-4o-mini | Structured outputs (Zod schema) |
| Draft Generation | GPT-4o-mini | System prompt + context injection |
| Email Classification | GPT-4o | Multi-label classification |
| Brief Summary | GPT-4o-mini | Summarization with stats |

---

## 8. File Metrics

| Component | Files | Lines of Code |
|-----------|-------|---------------|
| API Source | 18 | ~2,500 |
| Web Source | 35 | ~3,000 |
| Types Package | 1 | 302 |
| Shared Package | 1 | 137 |
| Config Package | 1 | 100 |
| **Total** | **56** | **~6,000** |

---

## 9. Summary

### 9.1 Technical Highlights

1. **Well-architected monorepo** with proper dependency management
2. **Multi-agent AI system** with specialized agents for distinct tasks
3. **Production-ready authentication** with Clerk integration
4. **Real OAuth integration** with Gmail and Google Calendar
5. **Webhook-driven automation** for email processing
6. **AI-powered features** including meeting detection, draft generation, and executive briefs
7. **Type-safe implementation** with strict TypeScript and Zod validation
8. **Clean code organization** following established patterns

### 9.2 Technical Maturity

| Aspect | Rating | Notes |
|--------|--------|-------|
| Architecture | High | Clean separation, scalable design |
| Code Quality | High | Consistent style, proper patterns |
| Type Safety | High | Strict mode, comprehensive types |
| Error Handling | High | Graceful degradation, typed errors |
| Security | High | Auth, validation, isolation |
| Testing | Low | No visible test coverage |
| Documentation | Medium | Good README, inline comments sparse |
| CI/CD | Low | No automation configured |

---

*Assessment generated through comprehensive static analysis of the codebase.*
