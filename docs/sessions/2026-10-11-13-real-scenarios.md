# Session 2026-10-11-13 — Real manual scenarios, first user test results (handoff)

Goal: Replace the trivial manual checks with real team scenarios, then fix what the user's own test run finds.
Milestone: after M7 (buffer)

Done:
- `docs/manual-testing.md` rewritten: R1–R16 (parallel users, access changed mid-work, short sessions, paste, phone, dates, keyboard) plus a table of what is already automated. **Not committed yet.**
- Facts for the scenarios collected from the code by one read-only subagent (file:line in its report). Nowruz display (`۱ فروردین ۱۴۰۶` for 2027-03-21) and the 100 KiB byte limit checked directly.

Decisions:
- User: the manual list must hold only scenarios a script cannot judge.

Open / next:
- 4 findings from the user's own run, below. Known weaknesses W1–W4 (last-write-wins, lost typed text, per-IP login limit, no overdue mark) await the user's decision.

AI usage: Claude Code (Opus 5.5); 1 read-only Explore subagent; stopped at 50 % context per the session rule.

## Handoff

- Resolved in [2026-10-11-14](2026-10-11-14-safari-fixes.md): U1, U2, U4.

- State: `main` = `4255db8` (S8b, pushed). Uncommitted: `docs/manual-testing.md` (rewrite), `docs/sessions/2026-10-11-12-frontend-fixes.md` (docs bullet + W1–W4 line), this file, HISTORY line.
- Next step: reproduce U1, U2 and U4 in headless Chrome (scratchpad probes as in S8b: `cdp.mjs` pattern, `s7-check.mjs` in the S8b scratchpad), find the cause, fix (frontend only), then correct R3/R4 in `manual-testing.md` (R7/R8 already fixed).
- Files in progress: `docs/manual-testing.md`.
- Verify with: the S7 browser check (93/93) after the fixes; `typecheck`, `lint`, `build` one at a time.

### User findings from running R1–R16 (2026-10-11)

- **U1 (R3):** after the manager deleted the task, the member clicked save; the dialog closed but **no message** was visible. Fact: `taskGone()` (`task-board.tsx:54-59`) sets `NOT_FOUND_MESSAGE` into a **visible** `<p role="status">` (`task-board.tsx:78`), so the text should show. Not verified: why it does not — suspect something clears `message` after `taskGone` (a close/reload path), or the 404 does not reach `onMissing`. Reproduce first.
- **U2 (R4):** user answer (Q1): reloading the detail page of the reassigned task showed **the board**, not «این کار پیدا نشد.». Not verified why (S7 saw «این کار پیدا نشد.» for an id the member never had; check whether a 404 on the detail page navigates away, or whether the user reloaded from the board). The member does **not** need to be told why a task left their board (user: no).
- **U3 (R7, R8):** closed. The user stayed signed in without a password (Q2 = yes); only the doc's «در حال بررسی ورود…» wording was wrong and is fixed in `manual-testing.md`.
- **U4 (description editor):** choosing a numbered or bulleted list does not indent the text; the marker sits **under/over the text** while creating a task. Lists use `padding-inline-start: 1.5rem` (`globals.css:130-137`); paragraphs inside use `unicode-bidi: plaintext` (`globals.css:114-117`). Not verified: the cause. Suspects: the marker position vs a `<p>` with `plaintext` inside `<li>` in RTL, or Tailwind preflight resetting list padding inside the editor. Screenshot the editor with an empty and a filled list item, RTL and LTR text.

### Answers from the user

- Q1 (U2): the member saw the board; no notice about why the task left is wanted.
- Q2 (U3): yes, still signed in.
