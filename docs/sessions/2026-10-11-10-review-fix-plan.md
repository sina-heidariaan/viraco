# Session 2026-10-11-10 — Manual test scenarios, spec + code review, fix plan

Goal: Give the user scenarios to test the app by hand, answer whether bad env values fail clearly, and review both apps against the spec and for pragmatic code quality.
Milestone: after M7 (buffer)

Done:
- `docs/manual-testing.md`: 48 scenarios (MT-A1…MT-J2) with a checklist. Every `curl` block was run in zsh against the live app; all codes match. **Not committed yet.**
- Env check: missing/invalid backend env stops startup (exit 1), but messages are unclear and followed by a Nest stack trace; the `.env.example` placeholder secret is accepted.
- Spec re-check: every PDF requirement is met. Code review (2 read-only reviewers + own checks): layering is clean; 11 verified bugs below. No over-engineering found; textbook additions (repositories, base DTOs, data/form libraries, i18n, event bus) rejected.

Decisions:
- User: fix F1, F3–F11; F2 is flagged only (no behaviour fix). User wants a plan per fix before code; the plan is below.
- Fixes run as two sessions: backend first, then frontend (plan §10.1).

Open / next:
- User picks the options marked "decision" below (recommended = A, F2 = B), and whether to push.

AI usage: Claude Code (Opus); 2 read-only review subagents; each finding re-checked by `curl`, a startup run, or headless Chrome before it was listed.

## Handoff

- State: `main` = `c6fe1d5` (S7 docs). Working tree: `docs/manual-testing.md` and this file are new, uncommitted. App code unchanged. Unit 48/48 and e2e 49/49 passed on `c6fe1d5`.
- Next step: backend fix session (F2 comment, F3, F6, F8, F9, F11), tests first. Then frontend fix session (F1, F4, F5, F7, F10).
- Files in progress: none.
- Verify with: `npm run backend:test` (48) and `npm run backend:test:e2e` (49) before starting.

### Facts found while planning (verified, do not re-derive)

- F3 root cause: the global `ValidationPipe` (`transform: true`) runs `class-transformer`, which recurses into the whole body before any validator → `RangeError: Maximum call stack size exceeded` → 500. Any deep field on any route can do it. Repro: a description of 2000 nested `blockquote`s (68 KB) → 500. Build the JSON as a string (Python), because `JSON.stringify` in Node also overflows at ~4000 levels. V8 `JSON.parse` (body-parser) is not the problem.
- F9: `validateEnv` runs inside `ConfigModule.forRoot(...)` while `app.module` is **imported**, so wrapping `NestFactory.create` (even with `abortOnError: false`) cannot hide the stack. A clean message needs a check in `main.ts` before `AppModule` is loaded.
- F7: in `server.mjs`, `process.env.BACKEND_URL` is `undefined` before and right after `next()`, and set only after `await app.prepare()`.
- F1: `safeNext()` is called during render (`login-form.tsx:28`), so it also runs on the server — `window` is not available; use a fixed base URL.
- F10: reproduced in headless Chrome by intercepting `POST /api/v1/todos` (CDP `Fetch.fulfillRequest`) with `400 {details:[{field:"foo",…}]}`: dialog stays open, no alert, button enabled.
- F6: `migration:show` without `DATABASE_URL` → `ECONNREFUSED ::1:5432` (pg defaults). The seed already says `DATABASE_URL is not set`. A missing `.env` file → Node prints `.env: not found` (clear).
- F8: TypeORM `PostgresDriver.js:289-302` runs `CREATE EXTENSION IF NOT EXISTS "pgcrypto"` on connect unless `installExtensions: false`.
- F11: `GET /todos/not-a-uuid` → `400 {"message":"Validation failed (uuid is expected)","details":[]}`.
- Login rate limit counts every login (5/min/IP): space out probe logins.

### Fix plan

Each item: issue → solution(s) → proof. "Decision" = the user chooses; A is recommended.

**F1 — Open redirect through `?next=`** (frontend, security, must-fix)
- Issue: `login-form.tsx:19-23` blocks `//` and `/\` but not `/\t/evil.com`; browsers strip the tab → `//evil.com`. Verified: signed-in user opening `/login?next=%2F%09%2Fexample.com%2Fpwned` lands on `https://example.com/pwned`.
- Decision: **A** parse and compare origin: `const u = new URL(raw, 'http://local'); if (u.origin !== 'http://local' || u.pathname.startsWith('/login')) return '/tasks'; return u.pathname + u.search + u.hash;` (try/catch → `/tasks`). **B** allow only known app paths (`/tasks…`, `/users`).
- Proof: browser probe with tab, newline, `//`, `/\`, `https:`, encoded forms → all stay on 127.0.0.1:3000; `/tasks?status=done` still kept.

**F2 — Placeholder JWT secret accepted** (flag only; user: no fix)
- Issue: `replace-with-a-random-string-of-at-least-32-characters` passes `MinLength(32)`; anyone who reads the public example can sign tokens as any user, including the owner.
- Flag in: README step 3 (security warning: what happens if skipped), README known limitations, comment above `JWT_ACCESS_SECRET` in `backend/.env.example`, MT-A2.
- Decision: **A** docs/comments only. **B** (recommended) A + one non-blocking `Logger.warn` at startup when the secret equals the placeholder.

**F3 — Deeply nested body → 500** (backend, must-fix)
- Decision: **A** a global depth-guard pipe registered before `ValidationPipe` in `app.setup.ts`; iterative walk (explicit stack, no recursion); limit 64 JSON levels (a valid depth-20 TipTap doc is ≈45 — compute exactly and test); throws `BadRequestException({ message: 'Validation failed', details: [{ field: <top-level key>, message: '<key> is nested too deeply' }] })`. New folder `backend/src/common/pipes/` → plan §13 change-log entry. **B** pass-through `@Transform` on `description` only (leaves other fields open).
- Proof (tests first, e2e): depth 2000 in `description` → 400 with field `description`; deep array in `title` → 400; valid depth-20 doc → 201.

**F4 — Escape in the link row closes the task dialog** (frontend)
- Issue: `description-editor.tsx` `LinkRow.onKeyDown` handles Enter only; Escape reaches the Headless UI Dialog → closes, unsaved input lost (verified).
- Fix: on Escape `preventDefault()` + `stopPropagation()`, close only the link row, focus back to the editor. If React's stopPropagation does not stop Headless UI (it listens on window), fall back to a native listener on the input; verify in the browser.
- Proof: probe — dialog stays open, title kept, focus in editor.

**F5 — English 404 / error pages** (frontend)
- Fix: `src/app/not-found.tsx` (Persian, link to `/tasks`) and `src/app/error.tsx` (client component, Persian, «تلاش دوباره» calling `reset()`). Files inside an existing folder → no change-log.
- Proof: `/no-such-page` shows Persian text; no "could not be found".

**F6 — Migration CLI without `DATABASE_URL`** (backend)
- Decision: **A** new `backend/src/config/cli-data-source.ts` that throws `DATABASE_URL is missing. Set it in backend/.env (copy backend/.env.example).` and exports the DataSource; `migration:*` scripts use `-d src/config/cli-data-source.ts`; remove the default export from `data-source.ts`. (A check inside `data-source.ts` would break the app: it is imported before `.env` is loaded.)
- Proof: run the CLI without the variable → the message; with it → `migration:show` works; e2e still passes.

**F7 — Frontend starts without `BACKEND_URL`** (frontend)
- Fix: in `server.mjs` after `await app.prepare()`: require `BACKEND_URL` and `new URL()` with `http:`/`https:`; else `console.error('BACKEND_URL is missing or invalid. Set it in frontend/.env (copy frontend/.env.example).')` and `process.exit(1)`. Keep the per-request guard in `route.ts`. Not in `next.config.ts` (would break `npm run build`).
- Proof: start without it → message + exit 1; with it → starts.

**F8 — `CREATE EXTENSION` outside migrations** (backend)
- Fix: `installExtensions: false` in `buildDataSourceOptions`. PostgreSQL 13+ has `gen_random_uuid()` built in. Leave the extension already in the dev DB alone.
- Proof (e2e): drop `pgcrypto` in the test setup, init the app, assert `pg_extension` has no `pgcrypto`; all e2e still pass.

**F9 — Unclear env errors** (backend)
- Decision: **A** in `main.ts`, before `AppModule` is loaded (dynamic import/require): load `.env` with `process.loadEnvFile` (Node ≥20.12, matches `engines`; verify it does not override already-set variables, like ConfigModule), run `validateEnv`, print a clean list and `process.exit(1)` — no stack. Messages one per variable, "missing" vs "invalid", e.g. `- JWT_ACCESS_SECRET is missing. Copy backend/.env.example and set it.`; use `stopAtFirstError`; mention when `backend/.env` was not found. ConfigModule keeps validating (e2e relies on it). **B** Joi `validationSchema` (new dependency → allowlist + change-log; stack stays). **C** reword messages only (stack stays).
- Proof: unit tests for each message; the MT-A2 commands show only the clean list.

**F10 — Server field errors for fields the form does not show are lost** (frontend)
- Decision: **A** `fieldErrors()` in `lib/api-client.ts` keeps only the keys of the given `messages` map; if other fields remain, the caller also shows a form-level message «اطلاعات فرم پذیرفته نشد. دوباره تلاش کنید.» (login, task and user forms all use it). **B** filter only (mixed known+unknown still loses the unknown).
- Proof: the interception probe above now shows the message.

**F11 — Invalid id → 400 with empty `details`** (backend)
- Fix: `@UuidParam('id')` decorator in `common/decorators/` = `Param('id', new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException({ message: 'Validation failed', details: [{ field: 'id', message: 'id must be a UUID' }] }) }))`; use it in the 4 controller methods.
- Proof (e2e): `GET /todos/x` and owner `PATCH /users/x` → 400 with `details[0].field === 'id'`.

**Both sessions:** update README and `docs/manual-testing.md` (one scenario per fix), session file + HISTORY line, one commit per session (`S8a (fixes): …`, `S8b (fixes): …`). Heavy commands one at a time. Browser probes are throwaway scripts in the session scratchpad, not committed (the S7 script `s7-check.mjs` in the old scratchpad may be gone; rebuild from its description in log 09 if needed).
