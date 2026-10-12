# Demo video script

A screen recording of **at most 5 minutes** (spec: "Project Demonstration
Video"), narrated in English. The spec asks it to show: project overview,
architecture, frontend/backend structure, the authentication and authorization
flow, the task workflow, the TipTap JSON implementation, and important technical
decisions.

Target length: about 4 min 45 s (about 650 spoken words at a normal pace). Screen
directions and narration are in English. The app itself is Persian, so labels on
screen are Persian; the English meaning is in parentheses.

| Spec topic | Scenes |
| ---------- | ------ |
| Project overview | 1 |
| Architecture | 2 |
| Frontend/backend structure | 3 |
| Authentication flow | 4 |
| Task workflow | 5 |
| TipTap JSON implementation | 6 |
| Authorization flow | 7, 8, 9 |
| Important technical decisions | 10 (and 2, 4, 6, 9 as they come up) |

## Before recording

1. Start from fresh data so the screens match this script: stop the backend, then
   `docker compose down -v` (this **deletes** the local database volume),
   `npm run db:up`, `npm run backend:migrate`, `npm run backend:seed`, and start
   the backend and frontend ([README](../README.md#setup-from-a-clean-clone)).
2. Run `npm run backend:test:e2e` once in a terminal and leave the summary on screen
   (it takes about a minute — do not run it during the recording).
3. As the owner, open the task «بازبینی نقش کاربران» ("Review user roles") and copy
   its URL (`/tasks/<id>`). The member cannot see this task; it is used in scene 9.
4. Open in tabs: the GitHub page of the repository (README),
   [architecture.md](architecture.md) on GitHub, VS Code with the repository, and
   <http://127.0.0.1:3000/login>. Browser zoom 110–125 %, DevTools closed.
5. Log out before each role change (header → «خروج», "Log out").

## Scenes

| # | Time | On screen | Narration (English) |
| - | ---- | --------- | ------------------- |
| 1 | 0:00–0:20 | GitHub README: title, stack table | Hi. This is a task board for a team, with a Persian, right-to-left interface. The frontend is Next.js, the backend is NestJS, and the database is PostgreSQL. There are three roles: owner, manager and member. Every permission is enforced in the API itself, not by hiding buttons. |
| 2 | 0:20–0:50 | architecture.md, diagram 1 (components) | The browser only talks to Next.js. Every request goes to `/api/v1`, and one Next.js route forwards it to NestJS together with the cookies. The backend address exists only on the server, and CORS is off in NestJS. A small custom server, `server.mjs`, reads the real client IP from the TCP connection. The login limit, five tries per minute, is keyed on that IP, and plain Next.js would keep a forged header. |
| 3 | 0:50–1:12 | VS Code explorer: expand `backend/src/modules`, `common/guards`, then `frontend/src/app`, `components`, `lib` | This is a monorepo with two separate apps. Backend and frontend each have their own package and lockfile, and share no code. The backend has three modules, auth, users and todos, plus two global guards. The frontend keeps pages, components and the API client apart. The full design is written in the abstraction plan. |
| 4 | 1:12–1:50 | Login as `owner@taskboard.local` / `Owner@12345`. Open DevTools → Application → Cookies: point at HttpOnly and the Path of `refresh_token`. Then architecture.md, diagram 2 | I sign in as the owner. Two cookies are created, both HttpOnly, so JavaScript cannot read them. The access token is a fifteen-minute JWT. The refresh token is a random seven-day string; only its hash is stored in the database, and its path is limited to `/api/v1/auth`. Every refresh replaces the token, and if an old token is used again, all sessions of that user are revoked. |
| 5 | 1:50–2:30 | Board. Status filter → «در حال انجام» ("In progress"; point at the URL), assignee filter, then «پاک کردن فیلترها» ("Clear filters"). Create a task: title, priority, assignee, due date; in the editor a heading, **bold**, a bullet list and a link. Save, open the new task (read-only view). Edit → change status to «انجام‌شده» ("Done"). Delete it → confirm dialog | This is the board: three columns for three statuses. The status and assignee filters are saved in the page URL, so refresh and the back button work. Now I create a task: title, priority, assignee, a due date shown in the Jalali calendar, and a description in the TipTap editor, with a heading, bold text, a list and a link. I save it and open it. Then I edit it, move it to done, and delete it after a confirmation. |
| 6 | 2:30–3:00 | Create one more task with a description (leave «مسئول» ("Assignee") as «بدون مسئول» ("No assignee")); DevTools → Network → the POST request payload (`description` JSON). Then VS Code: `tiptap.validator.ts` (allowlist at the top) and `tiptap-extensions.ts` | The description is stored as TipTap's own JSON, in a `jsonb` column. HTML is never a source of data. In the backend, a validator walks the JSON tree and accepts only allowed nodes and marks. Links must be http or https, and depth and size are limited. In the frontend, one extension list is used by both the editor and the read-only view, so the same JSON looks the same in both. |
| 7 | 3:00–3:22 | Header → «کاربران» ("Users"). Create a user (role «عضو», "Member"). Row menu → disable → confirm. Then try to disable the owner's own row → the 409 message | Now authorization. The users page is for the owner only. I create a member and then disable them. Disabling raises the user's token version and revokes their refresh tokens, so their session stops working on the very next request. The last active owner cannot be disabled; the server answers 409. |
| 8 | 3:22–3:40 | Log out. Log in as `manager@taskboard.local` / `Manager@12345`. Board shows all tasks; no «کاربران» link. Type `/users` in the address bar → forbidden state | The manager sees every task and can create, edit, delete and assign any of them, but has no user management. If I type `/users`, the page shows a "no access" message. That is only cosmetic: the API itself answers the manager with 403. |
| 9 | 3:40–4:05 | Log out. Log in as `member@taskboard.local` / `Member@12345`. Board shows 3 tasks. Open «نوشتن تست‌های دسترسی» ("Write access tests"): no delete button, assignee locked. Paste the owner task URL from step 3 of "Before recording" → "not found" state | The member sees only tasks they created or that are assigned to them. This filter is inside the SQL query, not applied after loading. A task assigned by a manager can be edited, but its assignee cannot be changed and it cannot be deleted. If the member opens someone else's task URL, the server answers 404, so even its existence stays hidden. |
| 10 | 4:05–4:45 | README "Architecture → Main decisions"; then the terminal with the e2e summary; then `docs/ai-workflow.md` on GitHub | The important decisions: authorization lives in two places only, a roles guard and one row-level policy. Tokens exist only in HttpOnly cookies. The schema changes only through migrations. TipTap JSON, not HTML, is the source of truth. There are no extra layers. These rules are checked by end-to-end tests on a real database, including the three required ones: a member cannot see other people's tasks, a member cannot change users, and a disabled user's old token stops working. The project was built with Claude Code under a written plan and session logs; the architecture and security decisions were mine. Thank you. |

## Checks after recording

- Length is 5:00 or less.
- The seed passwords on screen are the development defaults only.
- No real secret is visible (for example `backend/.env` must not be open in VS Code).
