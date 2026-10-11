# Session 2026-10-11-01 — Abstraction plan

Goal: Turn the assignment PDF into one governing plan before writing code.
Milestone: M0

Done:
- Wrote docs/ABSTRACTION_PLAN.md (fixed structure, contracts, invariants, milestones).
- Wrote CLAUDE.md (AI agent rules) and this session-log folder.
- Moved the assignment PDF to docs/spec/ and initialised git (no commit yet).

Decisions:
- Repo root is the monorepo root; frontend and backend share no code package.
- Disabled users are cut off by a per-request user lookup plus a token version.
- Spec gaps recorded as assumptions AS1–AS6 in plan §12 (AS1 confirmed by user).
- User rules added: context < 50 % with handoff, stack-based sessions S1–S7, ask only unanswered critical questions, no judgment without facts.

Open / next:
- User to confirm the plan and assumptions.
- M1: scaffold both apps, compose, first migration, seed.

AI usage: Claude Code (Opus) with engineering-orchestrator and design-orchestrator skills; plan checked line by line against the PDF.
