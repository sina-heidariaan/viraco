# Session 2026-10-11-06 — Frontend scaffold and auth (S5)

Goal: Login works through the Next.js proxy in a real browser, in Persian RTL.
Milestone: M5

Done:
- `frontend/` scaffold: next 16.4.0, react/react-dom 19.3.0, tailwindcss + @tailwindcss/postcss 4.3.3, @headlessui/react 2.2.10, @heroicons/react 2.2.0, clsx 2.1.1; dev: typescript 6.0.3, eslint 9.39.5, eslint-config-next 16.4.0, @types/node 20.19.43 (Node 20 floor), @types/react(-dom) 19.3.0.
- Proxy `app/api/v1/[...path]/route.ts` per §4.1: both Set-Cookie headers pass through, foreign Origin / cross-site POST → 403, backend down → 502, silent backend → 504 after 10 s, all in the §6.4 shape.
- `lib/api-client.ts`: one shared refresh on 401 (Web Lock also queues other tabs), retry, else /login. Login page (Persian, field errors from `details`, 401 and 429 messages) and an `(app)` shell with name, role label and logout.
- Checked in headless Chrome over the DevTools protocol (scratch script, not committed): 14/14 — redirect, 429, field errors, wrong password, login → shell, reload, expired access cookie restored with exactly 1 refresh, logout clears both cookies, no console errors. Screens at 1280 px and 390 px checked by eye.
- `tsc --noEmit`, `npm run lint` (0 warnings) and `next build` pass; production mode smoke-tested.

Decisions:
- Custom `server.mjs` writes X-Forwarded-For from the socket (user choice). Next.js keeps a client-sent value; proven: 6 logins with 6 fake IPs hit 429 on the shared real IP.
- Next 16 file is `src/proxy.ts` (was middleware.ts); `next lint` no longer exists. TS 6.0 / ESLint 9: newest versions the lint plugins accept. Plan §2, §4.1, §7, §9, §13 updated.
- Redirect checks only the access cookie (the refresh cookie never reaches pages); /login first tries a silent refresh, so a reload after 15 idle minutes stays logged in.

Open / next:
- S6 (M6): board, filters, task dialog, TipTap editor/viewer, users page. `useCurrentUser()` gives the role for hiding buttons.
- No backend bug found. `npm audit`: 5 high, all one `braces` DoS inside the ESLint toolchain (dev only); fix only via a major downgrade, left as is.

AI usage: Claude Code (Opus) with design-orchestrator + rtl-persian-ui; versions from `npm view`, Next behaviour from the installed docs and source; every claim above from real command or browser output.
