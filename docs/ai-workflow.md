# AI workflow

How AI was used to build this project, how its output was checked, and which
decisions a human made. Facts here come from the session logs in
[sessions/](sessions/HISTORY.md) and the change log in
[ABSTRACTION_PLAN.md §13](ABSTRACTION_PLAN.md#13-change-log).

## Tools

- **Claude Code** (Anthropic, Opus model) wrote the plan, the code, the tests and
  these documents, one session at a time.
- No other AI assistant was used. No code was generated outside a logged session.

## The rules the AI worked under

Three layers of written rules, all set by the human before or during the work.

**1. The plan — [ABSTRACTION_PLAN.md](ABSTRACTION_PLAN.md).** Written in the first
session and checked line by line against the spec. It fixes the folder structure,
the API contracts, the security invariants, the data model, the dependency
allowlist and the milestones. When anything disagrees with it, the plan wins.
Sections 2–6 are frozen: changing them needs an entry in the change log (§13) and
the human's approval. Spec gaps are written down as assumptions AS1–AS8 (§12) with
the cost of being wrong.

**2. Project instructions — [CLAUDE.md](../CLAUDE.md).** The entry point for any
agent (Claude Code, Cursor, Codex). It lists what to read first, the hard rules
(for example: authorization only in NestJS, row-level access inside the SQL query,
tokens only in HttpOnly cookies, `synchronize` always false, no dependency outside
the allowlist), the session rules, and the commands.

**3. Machine-wide contracts** (in the human's `~/.claude/` folder, not in this
repository). They apply to every project on the machine:

- *Communication contract* — plain language, a fixed report format, and evidence
  labels: "verified", "not verified", "assumption", "pre-existing".
- *Decision contract* — the AI must stop and ask before any choice that changes
  behaviour, scope, architecture, security, dependencies or data. Smaller choices
  are recorded as rulings in the report.
- *Options contract* — every choice offered to the human states its concrete gain,
  its cost, how easy it is to undo, and a recommendation with the strongest
  argument against it.
- *Process contract* — only one heavy process (tests, type check, build, install)
  at a time on the machine, with output logged to a file and checked early. A
  `PreToolUse` hook blocks a second heavy process.

## Sessions and handoffs

Work was split by stack and milestone (plan §10.1): a session touches either
`backend/` or `frontend/`, never both, plus `docs/`.

| Session (plan name) | Log file | Milestone | Scope |
| ------------------- | -------- | --------- | ----- |
| — | [01](sessions/2026-10-11-01-abstraction-plan.md) | M0 | Plan, CLAUDE.md, session log |
| S1 | [02](sessions/2026-10-11-02-backend-scaffold.md) | M1 | Backend scaffold, Docker DB, first migration, seed |
| S2 | [03](sessions/2026-10-11-03-auth.md) | M2 | Authentication |
| S3 | [04](sessions/2026-10-11-04-users-todos.md) | M3 | Users and tasks with row-level access, TipTap validator |
| S4 | [05](sessions/2026-10-11-05-backend-tests.md) | M4 | Backend e2e and unit tests |
| S5 | [06](sessions/2026-10-11-06-frontend-auth.md) | M5 | Frontend scaffold, proxy, login |
| S6 | [07](sessions/2026-10-11-07-board-users.md) | M6 | Board, filters, dialogs, editor, users page |
| S6 fix | [08](sessions/2026-10-11-08-tiptap-link-title.md) | M6 | Backend fix found in S6 (TipTap link `title`) |
| S7 | [09](sessions/2026-10-11-09-docs.md) | M7 | This documentation, clean-clone run, full browser check |

- Each session ends "green" — its own checks pass — and writes a short log file
  plus one line in `HISTORY.md`. The next session starts by reading the plan and
  the last three log lines.
- **Context budget:** a session stops at about half of the model's context. If the
  milestone is not done, it writes a **handoff** (state, next step, files in
  progress, the command that proves the current state) and a new session continues
  from it (plan §10.2).
- A bug found in the other stack is logged, not fixed on the spot. Example: S6
  (frontend) found that the backend rejected TipTap's default link `title`
  attribute; it worked around it in the frontend and logged it; a short backend
  session (log 08) then fixed it with tests.

## Skills

Claude Code skills (reusable instruction packs) used, as recorded in the logs:

- `engineering-orchestrator` — before backend, auth and data work (M0, S1–S3).
- `design-orchestrator`, `rtl-persian-ui`, `ux-flow-guardrail` — before UI work (S5, S6).
- `diagram-as-code` — for the Mermaid diagrams in [architecture.md](architecture.md) (S7).

## How the output was checked

The rule: no claim of "passed" or "done" without the command or browser output that
proves it. In practice:

- **Tests that are shown to bite.** After the e2e tests were written, the code
  they protect was broken on purpose — the member filter removed, the role check
  removed, the disabled-user check removed. Each change made its own test suite
  fail (6, 11 and 10 failures), and the code was then restored exactly (S4). In the S6 backend fix the
  new unit tests were written first and seen failing before the fix.
- **Real API calls.** Auth was checked with `curl` against the running API (S2);
  users and tasks with a 101-check HTTP script against the live API and database
  (S3).
- **A real browser.** A headless Chrome, driven over the DevTools protocol by a
  throwaway script that is not committed, checked the UI: 14 checks in S5 and 68
  checks for all three roles in S6, with zero console errors. In S7 the same kind
  of script ran 93 checks against a fresh clone with fresh seed data (owner,
  manager, member, and a fourth user disabled while signed in), again with zero
  console errors. Screens at 1280 px and 390 px wide were looked at by eye.
- **A clean clone.** In S7 the README was followed step by step in a fresh clone
  with an empty database: install, migrate, seed (twice), start, sign in, then the
  unit tests (48), e2e tests (49), type checks, lint and build. The four Mermaid
  diagrams were rendered with the Mermaid library to prove they parse.
- **Facts, not memory.** Package versions came from `npm view` before installing.
  Next.js 16 behaviour (the `proxy.ts` rename, the missing `next lint`, the
  `X-Forwarded-For` handling) was read in the installed Next.js docs and source.
  TipTap's link attributes were read in the installed source.
- **Concurrency claims were tested.** The last-owner lock was run with 8 parallel
  "owners disable each other" requests and a held-lock test (S3).

Problems the checks caught, and how they were fixed:

| Found in | Problem | Fix |
| -------- | ------- | --- |
| S2 | `COOKIE_SECURE=false` was read as `true` (string-to-boolean conversion) | Env validation reads the raw value |
| S3 | Body-parser errors such as "too large" came out as 500 | Error filter maps them; JSON limit raised so the 100 KB description rule answers first |
| S5 | Plain Next.js keeps a client-sent `X-Forwarded-For`, so the login rate limit could be dodged | Custom `server.mjs` (human decision) — proven: 6 logins with 6 fake IPs still hit 429 |
| S6 | The backend rejected the `title: null` that TipTap 3 writes on links | Log 08: validator accepts `title`; tests first |

## What a human decided

The human (the candidate) owns the architecture, security and final decisions. The
AI proposed options in the format above; the human chose. Decisions recorded as the
human's:

| Date | Decision | Where recorded |
| ---- | -------- | -------------- |
| 2026-10-11 | The plan, its milestones and assumptions accepted before any code | Log 01 |
| 2026-10-11 | Session rules: context under 50 % with handoffs, one stack and one milestone per session, ask only critical unanswered questions, no judgment without facts | Plan §13, CLAUDE.md |
| 2026-10-11 | AS1: a member may edit tasks assigned to them by someone else (except the assignee) | Plan §12 |
| 2026-10-11 | NestJS 11 / TypeORM 0.3 / TypeScript 5.9 instead of NestJS 12 (ESM-only) | Plan §7, §13 |
| 2026-10-11 | A custom Next.js server sets `X-Forwarded-For` from the socket, instead of accepting a spoofable header | Plan §4.1, §13; log 06 |
| 2026-10-11 | The scope of each session, including this documentation session and its "done" test (a clean clone reaches a working login) | The session prompts |

Smaller choices were made by the AI as **rulings** and written in the session
logs, for example: UUIDs from PostgreSQL's built-in `gen_random_uuid()`, env files
loaded with Node's `--env-file` instead of a `dotenv` dependency, logout being
public, the e2e guard that refuses any database not ending in `_test`, and link
marks being reduced to `{ href }` on save. Each one is visible in
[sessions/](sessions/HISTORY.md) and can be reversed.
