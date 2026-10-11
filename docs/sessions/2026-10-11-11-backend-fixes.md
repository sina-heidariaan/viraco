# Session 2026-10-11-11 — S8a: backend fixes from the S7 review

Goal: Fix the backend findings F2 (warning only), F3, F6, F8, F9, F11 from [log 10](2026-10-11-10-review-fix-plan.md), tests first.
Milestone: after M7 (buffer)

Done:
- F3: global `JsonDepthPipe` (`common/pipes/`, before `ValidationPipe`, iterative, limit 64; deepest valid TipTap body = 43) → a 2000-level description is 400 on `description`, not 500. F11: `@UuidParam('id')` → 400 with `details[0].field = 'id'` on 4 routes.
- F8: `installExtensions: false`; e2e global setup drops `pgcrypto` and a test proves the app does not re-create it. F6: `config/cli-data-source.ts` (clear `DATABASE_URL is missing` message); `migration:*` scripts use it; default export removed from `data-source.ts`.
- F9: `main.ts` loads `.env` (`process.loadEnvFile`, set variables win — checked) and checks the env before `AppModule` is imported; one "missing"/"invalid" line per variable with what to set, exit 1, no stack. F2: `WARN [Environment]` when the secret is the `.env.example` placeholder; comment in `.env.example`.
- Tests: red first (unit: modules missing; e2e: 500s, empty `details`, `pgcrypto` present), then unit 64/64, e2e 58/58, typecheck and build pass. MT-A2 (4 commands), MT-A3, MT-A4, MT-A5, MT-D6, MT-I4 run by hand: all as documented.
- Docs: README (step 3 security warning, env behaviour, tests, known gaps), `manual-testing.md` (MT-A2 updated; A3–A5, D6, I4 new), plan §13 entry, `architecture.md`.

Decisions:
- User: F2 = B (warning, no block), F3 = A, F6 = A, F9 = A, no Joi. Plan §13: new `common/pipes/` folder and `cli-data-source.ts`.
- `ConfigModule` keeps its own validation (e2e boot through it); both use the same `findEnvProblems` lines.

Open / next:
- S8b (frontend): F1, F4, F5, F7, F10 — prompt below.
- The migration CLI still shows TypeORM's own 2-line `at` trace around the F6 message (TypeORM wraps load errors; not in scope).
- The dev database keeps the old `pgcrypto` / `uuid-ossp` extensions (left alone on purpose).

AI usage: Claude Code (Opus 5.5), no subagents. Each fix proven by a test that failed first, then by the real command (startup, CLI, `curl` through the proxy).

## Handoff

- State: `main` = the `S8a (fixes): …` commit. Backend unit 64/64, e2e 58/58, typecheck, build pass. Frontend untouched.
- Next step: S8b, frontend fixes.
- Files in progress: none.
- Verify with: `npm run backend:test` (64) and `npm run backend:test:e2e` (58).

### Ready prompt for S8b

```text
Start session S8b (frontend fixes from the S7 review).
Read CLAUDE.md, then docs/ABSTRACTION_PLAN.md (§3, §8, §9, §10.1, §10.2, §11, §13), then the last 3 lines of docs/sessions/HISTORY.md, then docs/sessions/2026-10-11-10-review-fix-plan.md (fix plan + verified facts: do not re-derive them) and the handoff in docs/sessions/2026-10-11-11-backend-fixes.md.

My choices: F1 = <A or B>, F10 = <A or B> (fix plan recommends A for both).

Scope (plan §10.1): frontend/ plus docs/ and README.md only. Do these fixes: F1, F4, F5, F7, F10.
- There are no automated UI tests (plan §9). For each fix: first show the bug with a throwaway headless-browser or command probe in the session scratchpad (not committed), then fix, then show the same probe passing.
- F1 is done only when tab, newline, //, /\, https:, and encoded forms in ?next= all stay on 127.0.0.1:3000, and /tasks?status=done is still kept.
- F4: Escape in the link row closes only the link row; the dialog and its input stay. Verify in the browser.
- F7: server.mjs exits with code 1 and a clear message when BACKEND_URL is missing or not http(s); it still starts when it is set. Not in next.config.ts.
- Update README (BACKEND_URL behaviour, known limitations) and docs/manual-testing.md (one scenario per fix; remove the BACKEND_URL known gap in MT-A2).
- Run heavy commands one at a time: typecheck, lint, build. The backend must be running for the browser probes. Report real output.

End with a session file, a HISTORY line, and one commit "S8b (fixes): …".
Push to origin/main: <yes or no>.
If context nears 50 %, stop at a green point and write a handoff.
```
