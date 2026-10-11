# Session log

One short file per work session, plus one line in [HISTORY.md](HISTORY.md).
General information only — the code and git history hold the details.

- File name: `YYYY-MM-DD-NN-<topic>.md` (NN = session number that day).
- Length: about 10–20 lines. No step-by-step diary, no logs, no code.

## Template

```markdown
# Session YYYY-MM-DD-NN — <topic>

Goal: <one sentence>
Milestone: <M0–M7>

Done:
- <max 5 bullets>

Decisions:
- <max 3 bullets; plan changes also go in ABSTRACTION_PLAN.md §13>

Open / next:
- <max 3 bullets>

AI usage: <tools/skills used, and how the output was checked — 1–2 lines>

## Handoff (only if the milestone is not finished)
- State: <what works now, and the last check that passed>
- Next step: <the single next thing to do>
- Files in progress: <paths>
- Verify with: <command that proves the current state>
```

A session that finishes its milestone omits the Handoff section.
