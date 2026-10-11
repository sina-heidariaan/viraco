# Session 2026-10-11-05 — Backend tests (S4)

Goal: The plan §9 backend tests exist, pass, and fail when the rule they guard is broken.
Milestone: M4

Done:
- E2E (supertest, real `taskboard_test`, dropped and rebuilt from migrations each run, never synchronize): the three required tests plus auth (cookies, hashing, rotation, reuse, logout, rate limit) and the task permission matrix — 5 suites, 49 tests, all pass.
- Unit: todo-access.policy, TipTap validator, last-owner rule — 3 suites, 45 tests, all pass.
- Proved the required tests bite: removing the member filter, the role check, or the disabled/token-version check each made its own suite fail (6, 11, 10 failures); code restored byte-for-byte.
- `src/app.setup.ts` now holds the HTTP pipeline, shared by main.ts and the tests.

Decisions:
- Test DB guard: e2e refuses any database whose name does not end in `_test` (it wipes it). URL from TEST_DATABASE_URL, default = documented dev URL.
- Test app listens once on a free loopback port; each login uses its own X-Forwarded-For so the 5/min limit only hits the test that checks it.
- `npm test` runs in band (one process, machine memory rule).

Open / next:
- S5 (M5): frontend — proxy, RTL layout, tokens, login. Proxy must forward X-Forwarded-For and single-flight refresh.

AI usage: Claude Code (Opus); every result from real command output; mutation runs used to show the tests detect the bugs they target.
