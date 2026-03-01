<insight-seek-guidelines>
=== foundation rules ===

# InsightSeek Project Guidelines

These guidelines are curated for this repository and should be followed closely to keep changes consistent, safe, and maintainable.

## Foundational Context

This application is a Next.js App Router product for repository analysis, meeting analysis, and credit-based billing.

Main stack and ecosystem:

- next (NEXT) - v16
- react (REACT) - v19
- typescript (TYPESCRIPT) - v5
- tailwindcss (TAILWINDCSS) - v4
- @trpc/server + @trpc/react-query (TRPC) - v11
- @prisma/client + prisma (PRISMA) - v6
- postgresql + pgvector (POSTGRES) - vector(768)
- @clerk/nextjs (CLERK) - v6
- stripe (STRIPE) - v19
- @trigger.dev/sdk (TRIGGER) - v4
- zod (ZOD) - v4

## Conventions

- Follow existing code conventions in sibling files before introducing new patterns.
- Keep changes surgical and strongly typed.
- Reuse existing helpers/components before creating new abstractions.
- Use descriptive names (no one-letter variables unless unavoidable).
- Preserve current API shapes unless the task explicitly requires a change.

## Application Structure & Architecture

- Keep directory structure stable; avoid adding new top-level folders without clear need.
- Prefer extending existing feature modules in:
  - `src/server/api/routers/*`
  - `src/app/actions/*`
  - `src/trigger/*`
  - `src/lib/*`
- Do not change dependencies unless required by the task.

## Security and Data Safety

- Never hardcode secrets or tokens.
- Keep webhook signature verification strict (`Stripe`, `Svix/Clerk`).
- Always enforce ownership checks before mutating user/project/chat/meeting data.
- Follow credit-accounting invariants when touching indexing/billing flows.

## Documentation Files

- Only create or update documentation files when explicitly requested.

## Replies

- Be concise and focus on actionable outcomes.

=== project rules ===

# InsightSeek Implementation Rules

## Important Paths

- App routes: `src/app`
  - Protected shell: `src/app/(protected)/layout.tsx`
  - Public groups: `src/app/(marketing)`, `src/app/(auth)`
- tRPC:
  - Root router: `src/server/api/root.ts`
  - Procedures/context: `src/server/api/trpc.ts`
  - Feature routers: `src/server/api/routers/*`
- Server actions: `src/app/actions/*`
- Background tasks: `src/trigger/*`
- Data model: `prisma/schema.prisma`
- Shared integrations: `src/lib/*`
- UI components: `src/components/*`
- Theme/tokens: `src/styles/globals.css`, `tailwind.config.ts`

## Data + Domain Invariants

- `User.credits` is consumed for indexing and incremented by successful Stripe checkout webhook.
- `Commit` must remain unique on `(projectId, commitHash)`.
- Validation and project-creation progress rely on unique constraints to avoid duplicates.
- Embeddings are stored as `vector(768)` and may require raw SQL vector updates after create.
- Chats/questions are user-owned and often linked to project or meeting context; preserve those relationships.

## Auth, Access, and Webhooks

- `src/middleware.ts` protects all non-public routes with Clerk.
- Public webhooks:
  - `src/app/api/webhook/stripe/route.ts`
  - `src/app/api/webhook/clerk/route.ts`
- Keep authentication and authorization checks explicit in routers/actions.

## Async Processing (Trigger.dev)

- Task flows live in `src/trigger` (project creation/indexing, commit processing, meeting processing, repository validation).
- Update `zod` payload schemas first when changing task inputs.
- Keep status transitions explicit (`PROCESSING` → `COMPLETED`/`ERROR`).
- Preserve retry-safe behavior and idempotency.

## TypeScript + tRPC

- Validate inputs using `zod`.
- Use procedures from `src/server/api/trpc.ts`.
- Note existing export spelling: `protectedProdecure` (keep consistent unless intentionally refactoring globally).
- Use Prisma transactions for multi-step atomic operations.
- Respect strict TS config (`strict`, `noUncheckedIndexedAccess`).

## UI + Styling

- Reuse existing UI primitives in `src/components/ui`.
- Reuse established patterns from dashboard/QA/chat flows (streaming + optimistic updates).
- Keep dark-mode compatibility and use existing CSS variable tokens.
- Do not introduce new color systems, typography systems, or ad-hoc theme primitives.

=== verification rules ===

# Build, Lint, and Validation

Use `pnpm` for all scripts.

Primary commands:

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm check`
- `pnpm format:check`

Database commands:

- `pnpm db:generate`
- `pnpm db:push`
- `pnpm db:migrate`
- `pnpm db:studio`

Local DB helper:

- `./start-database.sh`

Verification guidance:

- Run the minimum targeted checks first, then broader checks (`pnpm check`) when needed.
- For Prisma schema changes, run the matching DB command and update dependent code paths.
- Verify no regressions in auth-protected flows and credit/accounting behavior.

=== workflow rules ===

# Agent Workflow Checklist

Before coding:

1. Identify whether the change belongs in UI, server action, tRPC router, Trigger task, or shared `lib`.
2. Check Prisma models/relations touched by the change.
3. Confirm env var requirements (`src/env.js` if validation is needed).

While coding:

1. Keep edits minimal and focused on the requested scope.
2. Follow existing import order/style conventions.
3. Reuse established helpers/hooks/components.

After coding:

1. Run targeted validation commands.
2. Run broader checks as appropriate.
3. Confirm no regressions in auth, ownership, and billing/credits flows.

## What to Avoid

- Do not bypass auth or ownership checks.
- Do not duplicate business logic when a shared helper already exists.
- Do not add broad refactors unrelated to the task.
- Do not hardcode design tokens/colors outside existing systems.

## If Unsure

- Choose the simplest implementation consistent with existing patterns.
- Use nearby feature code as source of truth.
- Capture assumptions and risks briefly in your handoff summary.

</insight-seek-guidelines>
