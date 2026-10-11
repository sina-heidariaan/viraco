# Abstraction Plan — Task Board

This is the governing document of the repository. When any other file, comment, or
agent instruction disagrees with it, this file wins.

- Source of truth for requirements: [docs/spec/Task_Board_Hiring_Assignment.pdf](spec/Task_Board_Hiring_Assignment.pdf)
- Sections 2–6 are **frozen**. Changing them follows §11 (change control).
- Deadline: 60 hours from the assignment email. Every rule below is sized for that.

---

## 1. Scope

**In scope:** login with HttpOnly cookies and refresh-token rotation, three roles
(owner, manager, member) enforced in NestJS, owner-only user management, task CRUD
with status/priority/assignee/due date/TipTap description, a Persian RTL board with
status and assignee filters, seed users, the three required permission tests,
README and AI-workflow documentation.

**Out of scope (do not build; list in README "Known limitations"):**
public registration · owner creation in the UI · password reset / change ·
drag-and-drop between columns · pagination · real-time updates · email ·
dark mode · Jalali date picker (dates are *displayed* in Jalali, *entered* with the
native date input) · frontend automated tests · Docker images for the two apps
(only PostgreSQL runs in Docker Compose).

## 2. Fixed repository structure

The repository root **is** the monorepo root (no extra `task-board/` folder).
Folders below are fixed. Adding a file inside an existing folder is free.
Adding a new top-level folder, a new backend module, or a new frontend route group
needs a change-log entry (§11).

```
.
├── CLAUDE.md                      AI agent instructions (entry point for any agent)
├── README.md                      Setup, credentials, architecture, AI workflow, limitations
├── docker-compose.yml             PostgreSQL 16 only
├── .env.example                   Compose variables (POSTGRES_*)
├── package.json                   Root convenience scripts only — no dependencies
├── docs/
│   ├── ABSTRACTION_PLAN.md        This file
│   ├── architecture.md            Diagrams + request/auth flows (written in M7)
│   ├── ai-workflow.md             How AI was used and reviewed (written in M7)
│   ├── spec/                      The assignment PDF (read-only)
│   └── sessions/                  Short per-session work log + HISTORY.md index
├── backend/                       NestJS application (own package.json + lockfile)
│   ├── .env.example
│   ├── src/
│   │   ├── main.ts                Bootstrap: pipes, filter, cookie-parser, helmet
│   │   ├── app.module.ts
│   │   ├── config/
│   │   │   ├── env.validation.ts  Fails fast on missing/weak env at startup
│   │   │   └── data-source.ts     One TypeORM DataSource for app AND migration CLI
│   │   ├── common/
│   │   │   ├── decorators/        @CurrentUser, @Roles, @Public
│   │   │   ├── guards/            AuthGuard (global), RolesGuard (global)
│   │   │   └── filters/           AllExceptionsFilter → one error shape (§6.4)
│   │   ├── modules/
│   │   │   ├── auth/              controller, service, refresh-token.entity, dto/
│   │   │   ├── users/             controller, service, user.entity, role.enum, dto/
│   │   │   └── todos/             controller, service, todo.entity, dto/,
│   │   │                          todo-access.policy.ts, tiptap/ (schema validator)
│   │   └── database/
│   │       ├── migrations/        The ONLY way the schema changes
│   │       └── seeds/seed.ts      Idempotent seed (§5.3)
│   └── test/
│       ├── jest-e2e.json
│       └── e2e/                   Permission-boundary tests against a real test DB
└── frontend/                      Next.js App Router application (own package.json + lockfile)
    ├── .env.example
    ├── server.mjs                 Custom server: sets X-Forwarded-For from the socket (§4.1)
    └── src/
        ├── proxy.ts               Redirects to /login when no auth cookie (UX only; Next 16 name for middleware)
        ├── app/
        │   ├── layout.tsx         <html lang="fa" dir="rtl">, Vazirmatn font
        │   ├── globals.css        Tailwind + design tokens (§8.3)
        │   ├── (auth)/login/      Login page
        │   ├── (app)/             Authenticated shell (loads /auth/me)
        │   │   ├── tasks/         Board + filters; tasks/[id] read-only detail
        │   │   └── users/         Owner-only user management
        │   └── api/v1/[...path]/route.ts   THE proxy to NestJS (§4.1)
        ├── components/
        │   ├── ui/                Thin Headless UI wrappers: Dialog, Select (Listbox), Menu, Button, Field
        │   ├── tasks/             Board, card, filters, form dialog, description editor/view
        │   ├── users/             Users table, user form dialog
        │   └── layout/            App header
        ├── lib/
        │   ├── api-client.ts      Browser fetch to /api/v1 + single-flight refresh on 401
        │   ├── tiptap-extensions.ts  ONE extension list, used by editor AND viewer
        │   ├── labels.ts          Persian labels for status / priority / role
        │   └── format.ts          fa-IR dates (Jalali display) and digits
        └── types/api.ts           Response/request types mirrored from backend DTOs
```

Frontend and backend share **no code package**. The frontend mirrors the few API
types it needs in `types/api.ts`. Reason: the spec asks for clear separation, and a
shared package costs build wiring we do not have time for. Revisit only if the types
drift more than once.

## 3. Architecture rules

1. **The browser talks only to Next.js.** Client code never knows the backend URL.
   `BACKEND_URL` is a server-only env var (never `NEXT_PUBLIC_*`). NestJS has CORS off.
2. **NestJS owns every security decision.** Next.js middleware and hidden buttons are
   convenience only. Any rule in §5.1 must be enforced in a NestJS service or guard,
   and covered by a test where §9 says so.
3. **Layering in the backend:** controller (HTTP + DTO) → service (rules +
   transactions) → TypeORM repository. Controllers hold no business logic. Services
   never read `req`/`res` directly. No repository-pattern wrappers on top of TypeORM.
4. **Authorization lives in two places only:** `RolesGuard` (role-level: "owner
   only") and `todo-access.policy.ts` (row-level: "member owns this task").
   Row-level checks go into the **query** (`WHERE created_by = :me OR assignee = :me`),
   not into a check after loading.
5. **Schema changes only through migrations.** `synchronize: false` always, in every
   environment, including tests.
6. **No abstraction without a second use.** No generic base services, no CQRS, no
   event bus, no shared "core" package.

## 4. Fixed contracts

### 4.1 Proxy (`frontend/src/app/api/v1/[...path]/route.ts`)

- `/api/v1/<path>` → `${BACKEND_URL}/<path>` for GET, POST, PATCH, DELETE.
- Forwards: method, query string, JSON body, `Cookie`, `Content-Type`, client IP as
  `X-Forwarded-For`. Returns: status, body, and every `Set-Cookie` header.
- The client IP is the TCP peer address, written by `server.mjs` before Next.js runs;
  a client-sent `X-Forwarded-For` is always discarded (Next.js alone would keep it).
- Rejects non-GET requests whose `Origin` does not match the app host (CSRF backstop).
- Backend unreachable or slower than 10 s → 502/504 in the standard error shape.

### 4.2 Backend endpoints (paths exactly as the spec)

| Method & path        | Who                         | Notes                                                    |
| -------------------- | --------------------------- | -------------------------------------------------------- |
| POST /auth/login     | public, rate-limited        | Sets both cookies                                        |
| POST /auth/refresh   | refresh cookie              | Rotates refresh token, sets both cookies                 |
| POST /auth/logout    | any                         | Revokes current refresh token, clears cookies            |
| GET /auth/me         | authenticated               | `{ id, email, name, role }`                              |
| GET /users           | owner                       | Full user list                                           |
| POST /users          | owner                       | Create user (email, name, password, role)                |
| PATCH /users/:id     | owner                       | name, role, isActive — last-owner rule applies           |
| GET /users/options   | owner, manager              | **Added (AS4).** Active users `{ id, name }` for assignee picker |
| GET /todos           | authenticated               | Filters: `status`, `assigneeId` (uuid or `unassigned`); row-scoped |
| POST /todos          | authenticated               | Member: assignee must be self or empty                   |
| GET /todos/:id       | authenticated               | Not visible → **404** (does not reveal existence)        |
| PATCH /todos/:id     | authenticated               | See §5.1                                                 |
| DELETE /todos/:id    | authenticated               | See §5.1                                                 |

Todo responses embed `assignee` and `createdBy` as `{ id, name }`.

### 4.3 Ports and environments

Frontend `3000` · Backend `4000` (localhost only) · PostgreSQL host port `5433`.
Databases: `taskboard` (dev) and `taskboard_test` (e2e tests), same container.

## 5. Security and domain invariants

### 5.1 Permission matrix

| Action                         | Owner | Manager | Member                                                 |
| ------------------------------ | ----- | ------- | ------------------------------------------------------ |
| List / view tasks              | all   | all     | only tasks they created or are assigned to             |
| Create task                    | yes   | yes     | yes; assignee = self or empty                          |
| Edit task fields               | any   | any     | own tasks (created or assigned) — see AS1              |
| Change assignee                | any   | any     | only on tasks they created; only to self or empty      |
| Delete task                    | any   | any     | only tasks they created                                |
| List / create / edit users     | yes   | no      | no                                                     |

Every "no" returns 403 for role-level denials and 404 for row-level invisibility.

### 5.2 Authentication

- **Access token:** JWT (15 min), claims `sub`, `tv` (token version). Cookie
  `access_token`: HttpOnly, `SameSite=Lax`, `Secure` in production, `Path=/`.
- **Refresh token:** 32 random bytes, opaque (not a JWT), 7 days. Stored **only as a
  SHA-256 hash** in `refresh_tokens`. Cookie `refresh_token`: HttpOnly,
  `SameSite=Strict`, `Path=/api/v1/auth`. Rotated on every refresh; reusing a revoked
  token revokes all of that user's refresh tokens.
- **Every authenticated request** loads the user by `sub` from the database and
  rejects if `is_active = false` or `tv ≠ users.token_version`. This is why a
  disabled user's old token stops working immediately — not after 15 minutes.
- Disabling a user or changing their role increments `token_version` and revokes their
  refresh tokens, in the same transaction.
- Passwords hashed with **argon2id**. Login failures return one generic 401 message
  (wrong email, wrong password, and disabled account look the same).
- Login is rate-limited (5 attempts / minute / IP).
- **Last active owner:** disabling or downgrading an owner runs in a transaction that
  locks the active owners (`SELECT … FOR UPDATE`) and refuses if none would remain.
  The lock stops two owners from disabling each other at the same moment.

### 5.3 Seed

- Creates exactly: one active owner, one manager, one member. Plus a few sample
  tasks **only if the `todos` table is empty** (for the demo).
- Re-running is safe: users are matched by email; an existing user is left untouched
  (password and role are never reset).
- Credentials come from env vars with documented dev defaults. The seed refuses
  default passwords when `NODE_ENV=production`.

### 5.4 TipTap description

- Stored in `todos.description` as **jsonb**. HTML is never stored or accepted.
- Empty document is valid: `{"type":"doc","content":[]}` or one empty paragraph.
- Backend validator walks the tree and rejects anything not on this list:
  - nodes: `doc`, `paragraph`, `text`, `heading` (levels 1–3), `bulletList`,
    `orderedList`, `listItem`, `blockquote`, `hardBreak`
  - marks: `bold`, `italic`, `link` (`href` must parse as `http:` or `https:`)
  - unknown attributes are rejected; max depth 20; max size 100 KB.
- Frontend: one extension list in `lib/tiptap-extensions.ts` configured to the same
  allowlist. The editor and the read-only viewer both use it; the viewer is a TipTap
  instance with `editable: false`, so the same JSON renders in both places.
- Links render with `rel="noopener noreferrer nofollow"` and `target="_blank"`.

## 6. Backend conventions

### 6.1 Data model

```
users           id uuid PK · email varchar UNIQUE (stored lowercase) · name varchar(100)
                password_hash · role enum(owner, manager, member)
                is_active bool default true · token_version int default 0
                created_at · updated_at
refresh_tokens  id uuid PK · user_id FK→users ON DELETE CASCADE · token_hash char(64) UNIQUE
                expires_at · revoked_at null · created_at
todos           id uuid PK · title varchar(200) · description jsonb NOT NULL
                status enum(todo, in_progress, done) default todo
                priority enum(low, medium, high) default medium
                due_date date null
                assignee_id FK→users null ON DELETE SET NULL
                created_by_id FK→users NOT NULL ON DELETE RESTRICT
                created_at · updated_at
                indexes: assignee_id, created_by_id, status
```

Users are never hard-deleted (disable instead). A disabled user cannot be made a new
assignee; tasks already assigned to them keep the assignment.

### 6.2 Validation

Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
Every request body and query has a DTO with class-validator decorators. Unknown
fields → 400.

### 6.3 Config

All env vars are validated at startup. The app refuses to start with a missing
variable or a JWT secret shorter than 32 characters.

### 6.4 Error shape (every non-2xx response)

```json
{ "statusCode": 403, "error": "Forbidden", "message": "…", "details": [] }
```

`details` holds field errors for 400s. 5xx responses never include stack traces or
SQL. The proxy uses the same shape for 502/504.

### 6.5 Logging

Nest `Logger`. 5xx logged with stack; auth failures logged without the password.
Never log passwords, tokens, cookies, or full request bodies.

## 7. Dependency allowlist

Anything not listed needs approval and a change-log entry.

- **Backend:** `@nestjs/*` (core, common, platform-express, config, jwt, typeorm,
  throttler), `typeorm`, `pg`, `class-validator`, `class-transformer`, `argon2`,
  `cookie-parser`, `helmet`; dev: `@nestjs/cli`, `@nestjs/testing`, `jest`, `ts-jest`,
  `supertest`, `ts-node` (TypeORM CLI + seed), `typescript`, `@types/*`.
- **Frontend:** `next`, `react`, `react-dom`, `tailwindcss` (v4), `@headlessui/react`,
  `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-link`
  (if not already inside StarterKit), `@heroicons/react`, `clsx`;
  dev: `typescript`, `eslint`, `eslint-config-next`, `@tailwindcss/postcss`, `@types/*`.
- **Banned:** MUI, Ant Design, any admin/UI kit, Passport (the custom guard is
  smaller), state-management libraries, ORMs other than TypeORM.
- Versions: **NestJS 11.x, TypeORM 0.3.x, TypeScript 5.9.x** (CommonJS) for the backend —
  NestJS 12 is ESM-only and needs experimental Jest flags (user decision, 2026-10-11).
  Frontend: latest stable at scaffold time that supports Node 20 — Next 16.4, React 19.3,
  Tailwind 4.3, Headless UI 2.2; TypeScript 6.0 and ESLint 9 because typescript-eslint
  (inside eslint-config-next) accepts TypeScript < 6.1 and the React/import plugins ESLint ≤ 9.
  TipTap 3.31 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`); StarterKit 3 already contains
  Link, so `@tiptap/extension-link` is not installed.

## 8. Frontend rules

### 8.1 RTL and Persian

- Root: `<html lang="fa" dir="rtl">`. Font: Vazirmatn via `next/font`.
- **Logical utilities only:** `ms-/me-/ps-/pe-/start-/end-/text-start/border-s`.
  Physical ones (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`,
  `text-right`) are banned. Direction icons (chevrons, arrows) use `rtl:rotate-180`.
- Latin content (emails, URLs, passwords) is isolated with `dir="ltr"` or `<bdi>`.
  Email and password inputs are `dir="ltr"`.
- Dates displayed with `Intl.DateTimeFormat('fa-IR-u-ca-persian')`; numbers with
  `fa-IR`. Stored and sent values stay ISO / Latin digits.
- All UI text is Persian. Enum labels live only in `lib/labels.ts`.

### 8.2 Components and accessibility

- Create/edit forms and delete confirmations: Headless UI `Dialog`.
- Selections (status, priority, assignee, role, filters): Headless UI `Listbox`.
  Row actions (edit, delete, disable): Headless UI `Menu`.
- Every input has a visible `<label>`. Focus ring always visible (`focus-visible:ring`).
- Status is shown as text plus colour, never colour alone. Contrast meets WCAG AA.
- Board columns are `<section>` with a heading and a `<ul>` of cards.
- Buttons the user may not use are hidden; the backend still enforces (§3.2).

### 8.3 Visual tokens (in `globals.css` via Tailwind `@theme`)

Light theme only. One neutral scale, one accent (indigo), status colours
(todo = slate, in_progress = amber, done = emerald), one danger (rose).
Radius: `rounded-lg` controls, `rounded-xl` cards and dialogs. Spacing on the
Tailwind 4-px scale. Motion: Headless UI enter/leave transitions only, ≤ 200 ms,
disabled under `prefers-reduced-motion`.

### 8.4 Required screen states

Every data screen handles: **loading** (skeleton), **empty** ("هنوز کاری ثبت نشده"),
**no filter match** (a different sentence + "clear filters"), **error** (message +
retry), **forbidden** (users page for non-owners). Submit buttons disable while
pending. Server field errors show under the matching field. Status messages use
`aria-live="polite"`.

### 8.5 Data flow

- Pages fetch through `lib/api-client.ts` from client components. No data library.
- On a 401 the client calls `/api/v1/auth/refresh` once (shared by parallel requests),
  retries, and redirects to `/login` if refresh fails.
- Board filters live in the URL (`?status=&assigneeId=`), so reload and back work.

## 9. Testing rules

- **Required e2e tests** (supertest, real PostgreSQL `taskboard_test`, migrations run
  first, never `synchronize`):
  1. Member cannot view another user's task (absent from `GET /todos`; `GET /todos/:id` → 404).
  2. Member cannot modify users (`POST /users`, `PATCH /users/:id` → 403; `GET /users` → 403).
  3. Disabled user's old access token → 401 on any API.
- **Unit tests:** `todo-access.policy`, TipTap validator (rejects `javascript:` links
  and unknown nodes; accepts empty doc), last-owner rule.
- Tests run one process at a time. A "passed" claim needs the command output.
- Frontend: `tsc --noEmit` and `npm run lint` (ESLint; Next 16 removed `next lint`) must pass; no automated UI tests (scope).

## 10. Milestones (time budget ≈ 60 h)

| #  | Milestone                                                              | Budget |
| -- | ---------------------------------------------------------------------- | ------ |
| M0 | Plan, AI instructions, session log (this session)                      | 1 h    |
| M1 | Scaffold both apps, compose, env validation, entities, first migration, seed | 6 h |
| M2 | Auth: login/refresh/logout/me, cookies, guards, rate limit             | 7 h    |
| M3 | Users (owner) + todos with access policy + TipTap validator            | 7 h    |
| M4 | Backend e2e + unit tests                                               | 5 h    |
| M5 | Frontend: proxy, RTL layout, tokens, login, auth handling              | 6 h    |
| M6 | Board, filters, task dialog, TipTap editor/viewer, users page          | 10 h   |
| M7 | README, architecture.md, ai-workflow.md, full manual check, video script | 6 h  |
|    | Buffer                                                                 | 12 h   |

Each milestone ends green (its checks pass) before the next starts.

### 10.1 Session boundaries (stack-based)

Work is split **by stack**: a session touches either `backend/` or `frontend/`,
never both (docs are allowed in any session). Reasons: a session then loads only one
app into context, and the backend API (§4.2) is finished and tested before the
frontend uses it. The cost: no feature works end-to-end in the browser until S5.

| Session | Milestone | May edit                              | Done when                                              |
| ------- | --------- | ------------------------------------- | ------------------------------------------------------ |
| S1      | M1        | root files, `backend/`                | Compose DB up, migration runs, seed runs twice cleanly |
| S2      | M2        | `backend/`                            | Login/refresh/logout/me work via curl; tokens hashed   |
| S3      | M3        | `backend/`                            | All §4.2 endpoints respond per §5.1 via curl           |
| S4      | M4        | `backend/test/`, `backend/src` (fixes)| All §9 backend tests pass                              |
| S5      | M5        | `frontend/`                           | Login works through the proxy in the browser           |
| S6      | M6        | `frontend/` (backend only for a bug, logged) | Board, filters, dialogs, editor, users page work |
| S7      | M7        | `docs/`, `README.md`                  | README steps run from a clean clone                    |

A session that finds a bug in the other stack writes it in its handoff instead of
switching stacks, unless the bug blocks its own "done when".

### 10.2 Context budget and handoff

- Each session keeps its context **under 50 %**. Read only the files the session
  needs; do not re-read files already in context.
- The agent cannot see its exact context usage. Proxies: number of large files read,
  long tool outputs, and milestone size. The user can check exactly with `/context`.
- When usage is near 50 % (by `/context` or by those proxies), the agent stops at the
  next green point and writes a **handoff** in the session file (template in
  [sessions/README.md](sessions/README.md)). The next session starts from that handoff.
- A milestone too big for one session is split into S2a, S2b, … at a green point.

## 11. Change control

- Free: new files inside existing folders, internal refactors, copy changes.
- Needs a change-log entry below (and the user's approval): new top-level folder or
  module, new dependency, any change to §4 contracts, §5 invariants, §6.1 schema
  meaning, or §7 allowlist.
- Schema changes always ship as a new migration; applied migrations are never edited.

## 12. Assumptions (spec gaps)

| Code | Assumption                                                                                   | Cost if wrong |
| ---- | -------------------------------------------------------------------------------------------- | ------------- |
| AS1  | A member may edit all fields (except assignee) of tasks assigned to them by someone else. **Confirmed by user 2026-10-11.** | Small: one policy function + one test. |
| AS2  | Priority is `low / medium / high`; due date is a date without time.                          | Small: one migration + labels. |
| AS3  | Owners also have full task permissions ("full access").                                      | Small: policy function. |
| AS4  | Managers need an assignee list, but `GET /users` is owner-only, so `GET /users/options` returns only `{id, name}` of active users. | Small: one endpoint. |
| AS5  | A member viewing a task they cannot access gets 404, not 403.                                | Tiny: one status code. |
| AS6  | Owners may promote users to owner and may disable themselves unless they are the last active owner. | Small: service rule. |
| AS7  | New-user passwords are 8–128 characters; no other complexity rule (the spec sets none). | Tiny: one DTO decorator. |
| AS8  | Refusing to remove the last active owner and a duplicate email both return **409 Conflict**; an inactive or unknown new assignee returns 400 with a field error on `assigneeId`. | Tiny: status codes. |

## 13. Change log

| Date       | Change                     | Reason |
| ---------- | -------------------------- | ------ |
| 2026-10-11 | Plan created               | M0     |
| 2026-10-11 | Added §10.1 session boundaries and §10.2 context budget | User rules |
| 2026-10-11 | §7: backend pinned to NestJS 11 / TypeORM 0.3 / TS 5.9; dev tools listed | NestJS 12 is ESM-only (user decision) |
| 2026-10-11 | §2: `frontend/src/middleware.ts` → `frontend/src/proxy.ts` | Next.js 16 renamed the convention (checked in the installed docs) |
| 2026-10-11 | §2/§4.1: `frontend/server.mjs` custom server sets X-Forwarded-For from the socket | Next.js keeps a client-sent X-Forwarded-For, which would bypass the login rate limit (user decision, S5) |
| 2026-10-11 | §7: frontend dev tools listed; versions recorded. §9: `next lint` → `npm run lint` | S5 scaffold; Next 16 has no `next lint` |
| 2026-10-11 | §7: TipTap 3.31 recorded; `@tiptap/extension-link` not installed | StarterKit 3 includes Link (checked with `npm view`, S6) |
