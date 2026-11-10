# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project summary

**Smart Campus Analytics** is a role-based academic management portal for IcfaiTech (Faculty of Science & Technology). It has three portals — Teacher, HOD and Admin — covering timetables, attendance, internal marks, leave, requests, announcements, workload and department analytics.

**North star:** every class gets taught, and teachers carry a fair workload.
**Metric:** class sessions with attendance recorded each week.

## Stack

- TanStack Start (file-based routing, SSR, server functions), React 19, TypeScript
- Tailwind CSS 4, shadcn/ui (Radix), lucide-react, Recharts
- Supabase (Postgres, Auth, Row Level Security)
- TanStack Query, React Hook Form, Zod
- Vite 8, Vitest + Testing Library, ESLint, Prettier
- Package manager: Bun (`bun.lock`); npm also works

## Commands

| Task | Command |
| --- | --- |
| Install | `bun install` |
| Dev server | `bun run dev` |
| Build | `bun run build` |
| Lint | `bun run lint` |
| Format | `bun run format` |
| Tests | `bun run test` (single run), `bun run test:watch` |

Run `lint` and `test` before finishing a change.

## Architecture

- **Roles** live in `public.user_roles` (`admin` / `hod` / `teacher`). HODs also hold `teacher`.
- **Access scoping is enforced by RLS** using the `has_role` and `my_dept` helpers, so UI queries can stay simple. Do not re-implement access checks in the client as a substitute for RLS.
- **Staff accounts** are created only by admins via the `createStaffAccount` server function (`src/lib/admin.functions.ts`). There is no public sign-up; don't add one.
- **Portal pages** live at `src/routes/_authenticated/{admin,hod,teacher}.tsx`. `/dashboard` redirects each user to the portal for their primary role.
- **Shared widgets** live in `src/components/`. Never export components from route files — route code splitting strips them.
- **Business rules** (timetable clashes, missing attendance, leave impact, low-attendance alerts) are pure functions in `src/lib/campus-tools.ts`, with shared UI in `src/components/campus-tools.tsx` reused by all portals. This is the single source of truth: change rules there, not in individual portals.
- **Workload and analytics** helpers (`OVERLOAD_HOURS`, `UNDERUTILIZED_HOURS`, `workloadStatus`, CSV export) are in `src/lib/analytics.ts`.

## Repository layout

```
drizzle/migrations/        SQL migrations (apply in order)
src/components/            Shared portal UI; ui/ holds shadcn primitives
src/integrations/supabase/ Clients, auth middleware, generated types
src/lib/                   Business rules, analytics, session, server functions
src/routes/                File-based routes (see src/routes/README.md)
src/test/                  Vitest suites
src/server.ts              SSR entry / error wrapper
```

## Routing rules

- Every `.tsx` file in `src/routes/` is a route. The only root layout is `src/routes/__root.tsx`; keep its `<Outlet />`.
- Do **not** create `src/pages/`, `app/layout.tsx` or other Next.js/Remix conventions.
- Dynamic segments use a bare `$` (`users/$id.tsx`), and splats are read via `_splat`.
- `src/routeTree.gen.ts` is auto-generated. Never edit it by hand.

## Database & Supabase

- Schema changes go in a new numbered file in `drizzle/migrations/`. Don't edit existing migrations.
- `drizzle/schema.ts` is auto-generated and intentionally blank. Don't edit it.
- `src/integrations/supabase/types.ts` is generated; regenerate rather than hand-editing.
- Every new table must enable RLS and define explicit policies (see `0002_leave_requests.sql` for the pattern: teachers see their own rows, HODs their department, admins all).
- Use `supabaseAdmin` (`client.server.ts`) only inside server functions, imported dynamically, and only after verifying the caller's role.
- Server functions should use the `requireSupabaseAuth` middleware and validate input with Zod.

## Security

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client or commit it. It must exist only in server environment variables.
- Don't weaken or bypass RLS policies to make a feature work; fix the policy instead.
- Don't log or return passwords, tokens or personal details (DOB, blood group, address, emergency contacts) beyond what the role is allowed to see.
- `.env` currently holds only public Supabase values; still avoid adding secrets to it, and consider gitignoring it.

## Code conventions

- TypeScript strict; avoid `any` and non-null assertions unless an index is guaranteed.
- Match existing formatting (Prettier config in `.prettierrc`) and ESLint rules.
- Prefer existing shadcn components in `src/components/ui/` over new UI dependencies.
- Keep date logic in ISO `YYYY-MM-DD` strings and UTC, as `campus-tools.ts` does, to avoid timezone drift.
- Add or update Vitest tests in `src/test/` for any change to rules in `src/lib/`.

## Do / Don't

**Do**
- Reuse shared components and the rules in `campus-tools.ts` across all three portals.
- Keep the connected branch buildable after every commit.

**Don't**
- Don't rewrite pushed git history.
- Don't hand-edit generated files (`routeTree.gen.ts`, `drizzle/schema.ts`, `supabase/types.ts`).
- Don't add public sign-up or client-side-only authorization.
- Don't add duplicate Vite plugins; the shared Vite setup already provides TanStack Start, React, Tailwind, tsconfig paths and Nitro (see comments in `vite.config.ts`).