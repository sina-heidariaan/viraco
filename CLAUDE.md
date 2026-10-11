# Task Board — AI Agent Instructions

Applies to every AI agent working in this repository (Claude Code, Cursor, Codex, …).

## Read first, in this order

1. [docs/ABSTRACTION_PLAN.md](docs/ABSTRACTION_PLAN.md) — structure, contracts, invariants. It wins over everything else.
2. The last 3 lines of [docs/sessions/HISTORY.md](docs/sessions/HISTORY.md) — where work stopped.
3. [docs/spec/Task_Board_Hiring_Assignment.pdf](docs/spec/Task_Board_Hiring_Assignment.pdf) — only when a requirement is unclear.

## Hard rules (never break, never "temporarily")

- Authorization is enforced in NestJS (guard or service). UI hiding is never the control.
- Row-level task access is part of the database query, not a check after loading.
- The browser calls only `/api/v1/*` on Next.js. No backend URL in client code.
- `synchronize` stays `false`. Schema changes = new migration. Applied migrations are never edited.
- Tokens live only in HttpOnly cookies. Refresh tokens are stored only as hashes.
- Task descriptions are TipTap JSON. Never store or accept HTML.
- No dependency outside the allowlist (plan §7) without asking the user.
- No new top-level folder or module without a change-log entry (plan §11).
- Never log passwords, tokens, or cookies.

## Session rules (set by the user)

1. **Context under 50 %.** Near that point, stop at the next green point and write a
   handoff (plan §10.2). Continue in a new session from the handoff.
2. **One session = one stack and one milestone** (plan §10.1). Edit only the folders
   that session allows.
3. **Ask only what the plan, docs, and the user's prompts do not already answer**, and
   only when it is critical or no fact exists. Check plan §1–§12 before asking.
4. **No judgment without facts.** If a claim cannot be checked (a version, a behaviour,
   a cause), say it is not verified and find the fact — read the code, run the check,
   or ask the user a precise question. Never guess and present it as fact.

## How to work

- Use the `engineering-orchestrator` skill before backend/auth/data work and the
  `design-orchestrator` skill before UI work. Keep trivial changes trivial.
- Build in the milestone order of plan §10. Finish one milestone green before the next.
- Every permission rule gets a test. Run tests one process at a time.
- Do not claim "passed" or "done" without the command output that proves it.
- Spec gap? Pick the most reversible option, add it to plan §12 as an assumption, tell the user.
- Avoid over-engineering: no generic base classes, no extra layers, no features outside plan §1.

## Session log

At the end of every session:

1. Add `docs/sessions/YYYY-MM-DD-NN-<topic>.md` using the template in
   [docs/sessions/README.md](docs/sessions/README.md). Keep it short.
2. Append one line to [docs/sessions/HISTORY.md](docs/sessions/HISTORY.md).

## Commands

Run from the repo root unless noted. Heavy commands (tests, builds, tsc) one at a time.

```bash
cp .env.example .env && cp backend/.env.example backend/.env   # then set JWT_ACCESS_SECRET
npm run db:up                      # PostgreSQL in Docker (host port 5433)
npm run backend:install
npm run backend:migrate            # apply migrations
npm run backend:seed               # idempotent seed users + demo tasks
npm run backend:dev                # API on http://127.0.0.1:4000

# inside backend/
npm run typecheck
npm run migration:generate -- src/database/migrations/<Name>   # after an entity change
npm run migration:revert
npm test                           # unit tests (in band)
npm run test:e2e                   # e2e; needs db:up; wipes and re-migrates taskboard_test only
```

Frontend (inside `frontend/`; needs the backend running):

```bash
cp .env.example .env               # BACKEND_URL=http://127.0.0.1:4000 (server-only)
npm install
npm run dev                        # node server.mjs → http://127.0.0.1:3000 (never `next dev`: see server.mjs)
npm run build && npm start         # production: node server.mjs start
npm run typecheck                  # tsc --noEmit
npm run lint                       # eslint (Next 16 has no `next lint`)
```
