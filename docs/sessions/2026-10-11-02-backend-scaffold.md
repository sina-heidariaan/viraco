# Session 2026-10-11-02 — Backend scaffold (S1)

Goal: Backend skeleton, database in Docker, first migration and seed.
Milestone: M1

Done:
- Root files: docker-compose.yml (PostgreSQL 16, dev + test DB), .env.example, package.json scripts, .gitignore.
- Backend skeleton: env validation, one shared TypeORM data source, entities users / refresh_tokens / todos.
- InitialSchema migration (generated, reviewed) and idempotent seed (3 users + 4 demo tasks).
- Checked: typecheck passes; migration runs, reverts and re-runs; seed run twice (2nd run changes nothing); API boots.

Decisions:
- NestJS 11 / TypeORM 0.3 / TS 5.9 instead of NestJS 12 (ESM-only) — user decision, plan §7.
- UUIDs use built-in gen_random_uuid() (no Postgres extension).
- Env files loaded with Node's --env-file for CLI and seed; no dotenv dependency.

Open / next:
- S2 (M2): auth module — login/refresh/logout/me, cookies, global guards, error filter, rate limit.
- No backend linter yet (typecheck only); decide in S7 whether it is worth adding.

AI usage: Claude Code (Opus) with engineering-orchestrator; versions checked with npm view before install; every step verified by running it.
