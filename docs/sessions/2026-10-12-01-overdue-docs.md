# Session 2026-10-12-01 — Typed text kept, overdue mark, documentation check

Goal: Build the two weakness fixes the user chose (O2, O3), document the two kept ones (O1, O4), and check every document against the code.
Milestone: after M7 (buffer)

Done:
- O2: a save that gets 404 after the user changed something keeps the dialog open with the typed text, says so, and disables save; the board behind already reloads. A no-change save still closes (decision B of log 14).
- O3: «گذشته از موعد» on the card and the detail page when the due date is before the viewer's own today and the task is not done. Due today is not overdue.
- O1 (last save wins) and O4 (login limit per IP) documented as kept in README "Known limitations"; manual scenarios R2, R3, R5, R12, R15 updated.
- Documentation check (read-only subagent, each finding verified before editing): 11 fixes in README, architecture.md, ai-workflow.md, video-script.md, manual-testing.md and plan §2/§6.3.
- B: the 93-check browser run is now in the repo as `frontend/scripts/browser-check.mjs` (`npm run check:browser`, no new dependency) with README steps for a throwaway database. The README steps were followed literally: 93/93, exit 0; a wrong `CHROME_PATH` exits 1 with a clear message; a second run on the same database also passes.
- Proof: O2/O3 probe 15/15 (dev and production build); S7 browser check 93/93 on a throwaway fresh-seeded database, 0 console errors; `typecheck`, `lint`, `build` pass.

Decisions:
- User: do O2 and O3, document O1 and O4; A1 needs no more work; the demo video (A3) is the user's. Then B: put the browser check in the repo.
- Ruling: the script lives in `frontend/scripts/` (not a new top-level `scripts/`), because it checks the frontend and needs no new top-level folder.

Open / next:
- Demo video (user).

AI usage: Claude Code (Opus 5.5); one read-only subagent audited the docs against the code (no processes run by it). Browser claims checked by headless-Chrome probes.
