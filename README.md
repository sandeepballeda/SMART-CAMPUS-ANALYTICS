# Smart Campus Analytics

A role-based academic management and analytics portal for **IcfaiTech – Faculty of Science & Technology (FST)**. It gives teachers, heads of department (HODs) and administrators one place to manage timetables, attendance, internal marks, leave, workload and departmental performance.

> **North star:** every class gets taught, and teachers carry a fair workload.
> **Metric:** class sessions with attendance recorded each week.

---

## Features

### Teacher portal (`/teacher`)
- **Overview** – class performance, assigned subjects and weekly schedule
- **Timetable** – personal weekly grid
- **Attendance** – record sessions and review past records
- **Internal marks** – enter marks and view class results
- **Leave** – apply for leave and see which of your classes it affects
- **Requests** – send requests to your HOD
- **Announcements** and **Profile**

### HOD portal (`/hod`)
- **Overview** – faculty workload (hrs/week) and subject performance
- **Faculty** – department staff list
- **Allocations & schedule** – allocate subjects to teachers and add timetable slots
- **Alerts** – low-attendance and missing-attendance warnings
- **Timetable** – department grid with clash detection
- **Leave / Requests** – approve or reject teacher submissions
- **Announcements**, **Reports** (CSV export) and **Profile**

### Admin portal (`/admin`)
- **Overview** – institution-wide stats and department comparison
- **Staff accounts** – create teacher/HOD accounts (no public sign-up)
- **Teacher directory** – searchable staff profiles
- **Departments & subjects** – manage academic structure
- **Alerts, Timetable, Leave, Requests, Announcements** – institution-wide views

After sign-in, `/dashboard` redirects each user to the portal matching their primary role.

### Built-in rules
All business rules live as pure, unit-tested functions in `src/lib/campus-tools.ts`:

| Rule | Behaviour |
| --- | --- |
| Timetable clashes | Flags overlapping slots for the same teacher or the same room on the same day |
| Missing attendance | Scheduled classes in the last 7 days with no attendance recorded |
| Leave impact | Lists the classes a teacher would miss during a leave period |
| Low attendance | Classes averaging below **75%**, worst first |
| Workload | Overloaded above **16 hrs/week**, underutilized below **6 hrs/week** |

---

## Tech stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (file-based routing, SSR, server functions) with React 19 and TypeScript
- **Styling/UI:** Tailwind CSS 4, shadcn/ui (Radix primitives), lucide-react icons, Recharts
- **Data & auth:** [Supabase](https://supabase.com) (Postgres, Auth, Row Level Security)
- **Forms/validation:** React Hook Form, Zod
- **Data fetching:** TanStack Query
- **Tooling:** Vite 8, Vitest + Testing Library, ESLint, Prettier, Bun (lockfile)

---

## Project structure

```
├── drizzle/migrations/        # SQL migrations (profile details, leave requests, …)
├── src/
│   ├── components/            # Shared portal UI (campus, campus-tools, directory, ui/*)
│   ├── integrations/supabase/ # Supabase clients, auth middleware, generated types
│   ├── lib/                   # Business rules, analytics, session, admin server functions
│   ├── routes/                # File-based routes
│   │   ├── index.tsx          # Landing page
│   │   ├── auth.tsx           # Sign in
│   │   └── _authenticated/    # admin.tsx, hod.tsx, teacher.tsx, dashboard.tsx
│   ├── test/                  # Vitest suites
│   └── server.ts              # SSR entry / error wrapper
├── supabase/config.toml
└── vite.config.ts
```

Conventions (see `AGENTS.md` and `src/routes/README.md`):
- Shared widgets live in `src/components/`, never exported from route files.
- `src/routeTree.gen.ts` is auto-generated — don't edit it by hand.

---

## Data model & access control

Main tables: `profiles`, `user_roles`, `departments`, `subjects`, `allocations`, `schedules`, `attendance_records`, `marks`, `faculty_attendance`, `leave_requests`, `dept_requests`, `announcements`.

- Roles (`admin`, `hod`, `teacher`) live in `public.user_roles`; HODs also hold `teacher`.
- Access is enforced in the database with **Row Level Security** using the `has_role` and `my_dept` helpers, so UI queries stay simple.
- Staff accounts are created only by admins through the `createStaffAccount` server function.

---

## Getting started

### Prerequisites
- [Bun](https://bun.sh) (recommended, a `bun.lock` is included) or Node.js 20+ with npm
- A Supabase project

### Install and run

```sh
bun install        # or: npm install
bun run dev        # or: npm run dev
```

### Environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
VITE_SUPABASE_PROJECT_ID=<project id>

SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
SUPABASE_PROJECT_ID=<project id>

# Server-only: required for admin account creation. Never expose to the client.
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

> ⚠️ The service-role key bypasses RLS. Keep it out of version control and set it only in your server/hosting environment. Also consider adding `.env` to `.gitignore` — it currently isn't listed there.

### Database setup
Apply the SQL files in `drizzle/migrations/` to your Supabase project in order (`0000` → `0002`), via the Supabase SQL editor or CLI.

### First admin
There is no public sign-up. Create the first admin user in the Supabase dashboard (Auth), then insert a matching row in `public.profiles` and `public.user_roles` with role `admin`. Further staff can then be created from the Admin portal.

---

## Scripts

| Command | Description |
| --- | --- |
| `dev` | Start the dev server |
| `build` | Production build |
| `build:dev` | Development-mode build |
| `preview` | Preview the production build |
| `lint` | Run ESLint |
| `format` | Format with Prettier |
| `test` | Run tests once (Vitest) |
| `test:watch` | Run tests in watch mode |

Run with `bun run <script>` or `npm run <script>`.

---

## Testing

Vitest covers the core rules and routing:

- `campus-tools.test.ts` – clashes, missing attendance, leave impact, low-attendance alerts
- `directory.test.ts` – teacher directory logic
- `workload.test.ts` – workload classification
- `app-routing.test.tsx` – route smoke test

```sh
bun run test
```

---

## Deployment

The build uses Nitro (Cloudflare target by default via the project Vite config). Set the environment variables above in your hosting provider, then run `bun run build`.

## Notes

- Staff sign-in only; accounts are provisioned by an admin.
- Apply database migrations in order before first run.
