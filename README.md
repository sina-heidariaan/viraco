# Task Board

A small task board for a team, with a Persian right-to-left interface. People sign
in, see tasks in three columns (to do, in progress, done), filter them by status and
assignee, and create, edit or delete tasks with a rich-text description. There are
three roles — owner, manager and member — and every permission is enforced by the
NestJS API, not by hiding buttons.

Built as a hiring assignment ([the spec](docs/spec/Task_Board_Hiring_Assignment.pdf)).
The governing design document is [docs/ABSTRACTION_PLAN.md](docs/ABSTRACTION_PLAN.md).

## Contents

- [Stack](#stack)
- [Prerequisites](#prerequisites)
- [Setup from a clean clone](#setup-from-a-clean-clone)
- [Seed users](#seed-users)
- [Tests and checks](#tests-and-checks)
- [Everyday commands](#everyday-commands)
- [Architecture](#architecture)
- [Permission matrix](#permission-matrix)
- [Assumptions](#assumptions)
- [AI workflow](#ai-workflow)
- [Known limitations](#known-limitations)

## Stack

Versions are the ones installed by the committed lockfiles.

| Area | Packages |
| ---- | -------- |
| Backend | NestJS 11.2.7 (`@nestjs/common`, `core`, `platform-express`, `testing`), `@nestjs/config` 4.0.4, `@nestjs/jwt` 11.0.2, `@nestjs/typeorm` 11.0.3, `@nestjs/throttler` 6.7.1, TypeORM 0.3.31, `pg` 8.23.1, `class-validator` 0.15.1, `class-transformer` 0.5.1, `argon2` 0.45.1, `cookie-parser` 1.4.7, `helmet` 8.3.0, TypeScript 5.9.3 |
| Backend tests | Jest 30.5.2, `ts-jest` 29.4.14, `supertest` 7.3.1 |
| Frontend | Next.js 16.4.0 (App Router), React 19.3.0, Tailwind CSS 4.3.3, Headless UI 2.2.10, TipTap 3.31.4 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`), Heroicons 2.2.0, `clsx` 2.1.1, TypeScript 6.0.3, ESLint 9.39.5 with `eslint-config-next` 16.4.0 |
| Database | PostgreSQL 16 (`postgres:16-alpine`) in Docker Compose |

Why NestJS 11 and not 12: NestJS 12 is ESM-only and needs experimental Jest flags
(decision recorded in plan §7).

## Prerequisites

- **Node.js 20.12 or newer** with npm. The backend needs 20.12+ (`engines` in
  `backend/package.json`); the frontend needs 20.9+ (Next.js 16).
- **Docker** with the Compose plugin (`docker compose`).
- Free local ports: **3000** (frontend), **4000** (backend), **5433** (PostgreSQL).

Tested on macOS with Node 24.18.0, Docker 29.4.0 and Docker Compose 5.1.2.

## Setup from a clean clone

Run every command from the repository root unless a step says otherwise. Steps 7
and 8 keep running, so give each its own terminal.

**1. Clone**

```bash
git clone https://github.com/sina-heidariaan/viraco.git
cd viraco
```

**2. Create the environment files**

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

- `.env` — PostgreSQL user, password, database and host port, used by Docker Compose.
- `backend/.env` — database URL, JWT secret, token lifetimes, cookie settings, seed users.
- `frontend/.env` — `BACKEND_URL` only. It is read on the server; the browser never sees it.

**3. Set a real JWT secret**

The backend refuses to start with a secret shorter than 32 characters. The
placeholder in `backend/.env.example` is long enough to pass that check, so replace
it. This command writes a random 64-character secret into `backend/.env` (works on
macOS and Linux):

```bash
SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
sed -i.bak "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$SECRET|" backend/.env && rm backend/.env.bak
```

> **Security warning — do not skip this step.** The placeholder is public: it is
> in `backend/.env.example`, which is in git. With it, anyone can sign their own
> access token for any user, including the owner, and the API accepts it. The
> backend still starts with the placeholder (by design), but it prints a
> `WARN [Environment] JWT_ACCESS_SECRET is the example value …` line at every start.

If `DATABASE_URL` or `JWT_ACCESS_SECRET` is missing, or any backend variable has an
invalid value (an empty value counts as missing), the backend does not start. The
other variables fall back to the defaults shown in `backend/.env.example`. It prints
one line per variable, saying whether it is missing or invalid and what to set,
and exits with code 1 (no stack trace). Example:

```text
The backend cannot start. Fix these environment variables:
- JWT_ACCESS_SECRET is invalid. Set it to a random string of at least 32 characters. Generate one with: node -e "…"
```

The migration commands (`npm run backend:migrate`, `migration:*`) say
`DATABASE_URL is missing. Set it in backend/.env (copy backend/.env.example).` when
that variable is not set.

The frontend does not start without a valid `BACKEND_URL` (an `http://` or
`https://` address). It prints
`BACKEND_URL is missing or invalid. Set it in frontend/.env (copy frontend/.env.example).`
and exits with code 1.

**4. Start PostgreSQL**

```bash
npm run db:up
```

This runs `docker compose up -d --wait`: one PostgreSQL 16 container, port 5433 on
127.0.0.1 only. On the first start of an empty data volume it also creates the
`taskboard_test` database used by the e2e tests.

**5. Install the backend and create the schema**

```bash
npm run backend:install
npm run backend:migrate
```

The schema is created **only** by migrations (`synchronize` is always `false`).

Newer npm versions (seen with npm 11.16) may print `allow-scripts` warnings and skip
the install scripts of `argon2`, `@parcel/watcher` and `unrs-resolver`. That is fine
on macOS (Apple silicon), Linux and Windows x64: `argon2` ships prebuilt binaries
for them, and the seed in step 6 proves it works. Intel Macs have no prebuilt
`argon2` binary, so there the script must run (not tested here; npm's own hint is
`npm approve-scripts argon2` inside `backend/`, then `npm install` again).

**6. Seed the users and demo tasks**

```bash
npm run backend:seed
```

It creates the owner, manager and member (see [Seed users](#seed-users)) and four
demo tasks. Running it again is safe: existing users are matched by email and left
unchanged, and demo tasks are added only when the `todos` table is empty.

**7. Start the backend (terminal 2)**

```bash
npm run backend:dev
```

Wait for `API listening on http://127.0.0.1:4000`.

**8. Install and start the frontend (terminal 3)**

```bash
cd frontend
npm install
npm run dev
```

Wait for `> Frontend on http://127.0.0.1:3000 (development)`. Always start the
frontend with `npm run dev` (it runs `node server.mjs`), never with `next dev`:
the custom server is what sends the real client IP to the login rate limit.

**9. Sign in**

Open <http://127.0.0.1:3000> and sign in with one of the [seed users](#seed-users).

To stop: press Ctrl+C in terminals 2 and 3, then `npm run db:down` (the data volume
is kept).

## Seed users

Development defaults, created by `npm run backend:seed`:

| Role | Name | Email | Password |
| ---- | ---- | ----- | -------- |
| Owner | مالک سیستم | `owner@taskboard.local` | `Owner@12345` |
| Manager | مدیر پروژه | `manager@taskboard.local` | `Manager@12345` |
| Member | عضو تیم | `member@taskboard.local` | `Member@12345` |

Change them with `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` and the `MANAGER` /
`MEMBER` equivalents in `backend/.env`. With `NODE_ENV=production` the seed refuses
to run without all three passwords. Passwords are hashed with argon2id.

Demo tasks: the member sees three of the four (two assigned to them by the
manager, one of their own). The fourth belongs to the owner and the manager, so the
member does not see it.

## Tests and checks

Run them one at a time.

**Backend unit tests** — access policy, TipTap validator, last-owner rule, the
environment messages, the nesting-depth guard, the migration CLI's `DATABASE_URL`
check:

```bash
npm run backend:test
```

**Backend e2e tests** — needs PostgreSQL running (step 4). They run against
`taskboard_test` only: each run empties that database and rebuilds it from
the migrations. They refuse any database whose name does not end in `_test`.

```bash
npm run backend:test:e2e
```

They cover the three tests the spec requires — a member cannot view another
user's task, a member cannot modify users, a disabled user's old token gets 401 —
plus cookies, refresh rotation and reuse, logout, the login rate limit, the full
task permission matrix, 400 (not 500) for very deeply nested bodies and non-UUID
ids, and that the app installs no PostgreSQL extension outside the migrations.

**Backend type check:**

```bash
cd backend && npm run typecheck
```

**Frontend checks** (inside `frontend/`, after `npm install`):

```bash
cd frontend
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint (Next.js 16 has no `next lint`)
npm run build       # production build
```

**Browser check** — 93 checks of the running app in headless Google Chrome, as
owner, manager, member and a new user that gets disabled: board, filters, task
dialogs, the TipTap editor and stored JSON, the users page, keyboard use, phone
width, access rules seen from the browser, and no console errors. It needs
Node 22 or newer and Google Chrome (`CHROME_PATH` if Chrome is not in the usual
place). It needs a database whose only tasks are the 4 seeded demo tasks.
It deletes the tasks it creates, but it leaves one disabled user («کاربر Check …»)
per run. So run it on a throwaway database, as below, and your own data stays
untouched; the same throwaway database can be used for several runs.

```bash
# 1. Stop your normal backend first (port 4000). Then, in terminal 2,
#    a throwaway database (PostgreSQL running, step 4):
docker compose exec postgres createdb -U taskboard taskboard_check
export DATABASE_URL=postgres://taskboard:taskboard@localhost:5433/taskboard_check

# 2. Schema, seed, and the backend on it — same terminal, so the export applies
cd backend && npm run migration:run && npm run seed && npm run start:dev

# 3. The frontend (terminal 3, step 8), then the check (terminal 4)
cd frontend && npm run check:browser

# 4. Afterwards: stop that backend (Ctrl+C), drop the database, `unset DATABASE_URL`,
#    and start the backend on your own data again (step 7)
docker compose exec postgres dropdb -U taskboard taskboard_check
```

A `DATABASE_URL` set in the shell wins over `backend/.env`. The check prints one
PASS/FAIL line per check, `93/93 checks passed` at the end, and where the
screenshots were saved; it exits with 1 if any check fails.

## Everyday commands

| Command (from the root) | What it does |
| ----------------------- | ------------ |
| `npm run db:up` / `npm run db:down` | Start / stop PostgreSQL (data is kept) |
| `npm run backend:migrate` | Apply pending migrations |
| `cd backend && npm run migration:revert` | Undo the last migration |
| `cd backend && npm run migration:generate -- src/database/migrations/<Name>` | New migration after an entity change |
| `npm run backend:seed` | Seed users and demo tasks (safe to repeat) |
| `cd frontend && npm run build && npm start` | Frontend in production mode (`node server.mjs start`) |

## Architecture

```text
Browser ──/api/v1/*──▶ Next.js (3000) ──proxy──▶ NestJS (4000) ──TypeORM──▶ PostgreSQL (5433)
```

Diagrams of the components, the login and refresh flow, a task request with
row-level access, and the data model: **[docs/architecture.md](docs/architecture.md)**.

Main decisions:

1. **The browser talks only to Next.js.** One route,
   `frontend/src/app/api/v1/[...path]/route.ts`, forwards `/api/v1/*` to NestJS with
   the cookies and passes every `Set-Cookie` back. The backend URL is server-only and
   NestJS has CORS off. The proxy also rejects cross-site state-changing requests.
2. **A custom Next.js server (`frontend/server.mjs`)** writes `X-Forwarded-For` from
   the TCP socket. Next.js on its own keeps a client-sent value, which would let
   anyone dodge the login rate limit.
3. **Tokens only in HttpOnly cookies.** The access token is a 15-minute JWT. The
   refresh token is random, lasts 7 days, is stored only as a SHA-256 hash, is
   rotated on every refresh, and reusing an old one revokes all of that user's
   sessions. The refresh cookie is scoped to `/api/v1/auth`.
4. **Disabled users are cut off at once.** Every request loads the user from the
   database and checks `is_active` and a `token_version` stored in the JWT.
   Disabling a user or changing their role bumps that version and revokes their
   refresh tokens in one transaction.
5. **Authorization lives in two places only:** `RolesGuard` for role rules ("owner
   only", 403) and `todo-access.policy.ts` for row rules. A member's visibility
   filter is part of the SQL query, and a task they cannot see returns 404.
6. **The last active owner** cannot be disabled or downgraded. The check locks all
   active owner rows first, so two owners cannot disable each other at the same time.
7. **TipTap JSON is the source of truth.** It is stored as `jsonb`, checked by an
   allowlist validator in the API, and rendered by the same TipTap extension list in
   the editor and the read-only viewer.
8. **Separate apps, no shared package.** `backend/` and `frontend/` each have their
   own `package.json` and lockfile. The frontend mirrors the API types it needs.
9. **No extra layers.** Rejected as over-engineering: repository or interface layers, base DTOs, data or form libraries, an i18n framework, and an event bus.

## Permission matrix

Enforced in NestJS (plan §5.1). The UI hides buttons only for convenience.

| Action | Owner | Manager | Member |
| ------ | ----- | ------- | ------ |
| List / view tasks | all | all | only tasks they created or are assigned to |
| Create task | yes | yes | yes; assignee = self or empty |
| Edit task fields | any | any | own tasks (created or assigned) — see AS1 |
| Change assignee | any | any | only on tasks they created; only to self or empty |
| Delete task | any | any | only tasks they created |
| List / create / edit users | yes | no | no |
| Assignee list (`GET /users/options`) | yes | yes | no (AS4) |

A role-level "no" returns **403**. A task a member cannot see returns **404**, so the
API does not reveal that it exists (AS5).

## Assumptions

Where the spec is silent, these choices were made (plan §12):

| Code | Assumption |
| ---- | ---------- |
| AS1 | A member may edit all fields (except the assignee) of tasks assigned to them by someone else. Confirmed by the user. |
| AS2 | Priority is `low` / `medium` / `high`; the due date is a date without a time. |
| AS3 | Owners also have full task permissions ("full access"). |
| AS4 | Managers need an assignee list, but `GET /users` is owner-only, so `GET /users/options` returns only `{ id, name }` of all active users; only the owner and managers may call it. |
| AS5 | A member asking for a task they cannot access gets 404, not 403. |
| AS6 | Owners may promote users to owner, and may disable themselves unless they are the last active owner. |
| AS7 | New-user passwords are 8–128 characters; no other complexity rule. |
| AS8 | Removing the last active owner and a duplicate email both return 409 Conflict; an inactive or unknown new assignee returns 400 with a field error on `assigneeId`. |

## AI workflow

The code was written with Claude Code, under rules a human set before any code
existed: a governing plan, project instructions for agents
([CLAUDE.md](CLAUDE.md)), one session per stack and milestone with a short log
([docs/sessions/](docs/sessions/HISTORY.md)), and tests or real command output for
every claim. The human made the architecture, security and scope decisions.

Details — the plan, the contracts, sessions and handoffs, how output was checked,
and the list of human decisions: **[docs/ai-workflow.md](docs/ai-workflow.md)**.

## Known limitations

**Not built (out of scope, plan §1):**

- Public registration, and creating the first owner in the UI (the seed does it).
- Password reset and password change.
- Drag-and-drop between board columns (status is changed in the edit dialog).
- Pagination: the board loads every visible task at once.
- Real-time updates: other people's changes appear after a reload.
- Email of any kind.
- Dark mode.
- A Jalali date picker: dates are *shown* in the Jalali calendar but *entered*
  with the browser's native (Gregorian) date input.
- Frontend unit and component tests. The frontend is checked by `typecheck`,
  `lint`, `build` and the [browser check](#tests-and-checks)
  (`npm run check:browser`), which needs Google Chrome and a freshly seeded database.
- Docker images for the two apps. Only PostgreSQL runs in Docker Compose.

**Known gaps and behaviour worth knowing:**

- The backend **starts even with the example JWT secret** from
  `backend/.env.example` and only logs a warning (S7 review F2; the user chose a
  warning, not a block). With that secret, anyone can sign tokens as any user.
  Always set your own secret (setup step 3).
- A request body nested more than 64 levels deep (objects and arrays) is refused
  with 400 before validation. A valid task description is at most 43 levels.
- Pressing Escape **inside the description editor** does not close the task
  dialog; Escape in any other field does. Escape in the editor's link row closes
  only that row.
- An unknown address shows a Persian "page not found" screen. A signed-out visitor
  is sent to the login page first, like every other page.
- Users cannot be deleted, only disabled. This keeps task history intact.
- **Two people editing the same task: the last save wins**, without a warning.
  Each save sends only the changed fields, so edits of different fields both
  survive; edits of the same field do not. A warning needs a version check in
  the API (an `updatedAt` sent with each save and a 409 answer), which changes
  the contract in plan §4, so it was left out.
- **The login limit (5 per minute) counts per IP address, not per account.** In
  an office where everyone shares one internet address, the sixth sign-in within
  a minute is refused even with the right password. A per-account key in the
  backend throttler would fix it.
- Text typed in a task dialog is lost when the session ends or the account is
  disabled before saving (no drafts). When the task itself was deleted or taken
  away, the dialog stays open with the text and says so.
- A task whose due date is before the viewer's today and that is not done shows
  «گذشته از موعد». "Today" is the viewer's own calendar day. Past due dates can
  still be entered.
- Changing an owner's own role logs that owner out (their token version changes).
- Expired and revoked rows in `refresh_tokens` are never cleaned up.
- The backend has no linter; it is checked by `tsc` and its tests.
- `npm audit` (2026-10-11): **0 advisories in production dependencies** of both
  apps (`npm audit --omit=dev`). Development tools do have advisories: 5 high in
  the frontend ESLint toolchain (`braces` via `eslint-config-next`) and 20
  moderate in the backend Jest toolchain (`js-yaml` via `jest` / `ts-jest`).
  None of them ship or run in the app. Fixing all of them needs a major
  downgrade (npm proposes Jest 25 and `eslint-config-next` 14), so they are left
  as they are.
- Production deployment is not covered. Both servers listen on 127.0.0.1 only,
  `COOKIE_SECURE=true` is required when `NODE_ENV=production`, and a reverse proxy
  placed in front of `server.mjs` would need its own trusted-IP rule.
- Tested only on macOS with Node 24.18. The Node 20 minimum comes from the
  `engines` fields and the Next.js requirement; it was not run on Node 20.
