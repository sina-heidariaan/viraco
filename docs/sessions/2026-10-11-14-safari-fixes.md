# Session 2026-10-11-14 — User test findings U1–U4 reproduced and fixed (Chrome + Safari)

Goal: Reproduce the findings from the user's R1–R16 run, fix the causes (frontend only), correct the manual scenarios.
Milestone: after M7 (buffer)

Done:
- U4 (Safari): a new task's description `{content: []}` gave the editor no block, so a click selected everything and the first key press after choosing a list replaced the list. The editor now starts with one empty paragraph (`description-editor.tsx`); what is saved is unchanged.
- U4 (both browsers): `unicode-bidi: plaintext` made an empty line left-to-right, so the caret sat on the far left, away from the list marker. Empty lines now follow the page direction (`globals.css`).
- U1: a save with no change sent nothing, so a task deleted meanwhile closed the dialog silently and stayed on the board. A no-change save now checks the task first; 404 → the usual "task gone" message (`task-form-dialog.tsx`, user choice B).
- U2: not reproducible in Chrome or Safari (also with an expired session); R4 now says to check the address bar. R3 covers the no-change case; R10 step 4 covers lists in Safari and Chrome.
- Proof: throwaway probes red before, green after (headless Chrome via CDP; real Safari via safaridriver, 14/14). Full S7 browser check 93/93 on a throwaway fresh-seeded database, 0 console errors. `typecheck`, `lint`, `build` pass.

Decisions:
- User: U1 = B (check the task on a no-change save).
- The user does not want the member told why a task left their board (U2).

Open / next:
- User: rerun R3, R4 and R10 step 4 in Safari. Known weaknesses W1–W4 still await the user's decision.

AI usage: Claude Code (Opus 5.5), no subagents. Every claim checked by a browser probe; Safari driven through plain WebDriver HTTP calls (no new dependency).
