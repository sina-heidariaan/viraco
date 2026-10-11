# Manual test scenarios

Step-by-step scenarios to check every part of the Task Board by hand. Each one has
an ID, the steps, and the expected result. Tick them off in the
[checklist](#checklist) at the end.

Facts about the app (texts, counts, status codes) were taken from the code and from
the S7 headless-browser run (93/93 checks) on a fresh seed, rerun in S8b (93/93).

## Before you start

1. Follow the [README setup](../README.md#setup-from-a-clean-clone) until you can
   open <http://127.0.0.1:3000>.
2. **Use fresh data**, so the counts below match. This **deletes** your local
   database and creates it again:

   ```bash
   # stop the backend first (Ctrl+C), then from the repo root:
   docker compose down -v
   npm run db:up && npm run backend:migrate && npm run backend:seed
   npm run backend:dev        # terminal 2
   ```

3. Use **three separate browser profiles** (or one normal + two private windows of
   different browsers), one per role, so the cookies do not mix.
4. **Login rate limit:** every login attempt counts, including successful ones —
   5 per minute from your machine. If you see «تلاش‌ها بیش از حد مجاز بود…», wait one
   minute.

Seed users:

| Role | Email | Password |
| ---- | ----- | -------- |
| Owner (مالک) | `owner@taskboard.local` | `Owner@12345` |
| Manager (مدیر) | `manager@taskboard.local` | `Manager@12345` |
| Member (عضو) | `member@taskboard.local` | `Member@12345` |

Seed tasks (fresh data):

| Title | Status | Created by | Assignee | Member sees it? |
| ----- | ------ | ---------- | -------- | --------------- |
| طراحی صفحه ورود | انجام‌شده | manager | member | yes |
| نوشتن تست‌های دسترسی | در حال انجام | manager | member | yes |
| یادداشت شخصی عضو تیم | برای انجام | member | member | yes |
| بازبینی نقش کاربران | برای انجام | owner | manager | **no** |

### Command-line helpers (for API scenarios)

The scenarios marked **API** prove that NestJS enforces a rule even when the
browser is bypassed. Run them in a terminal from any folder. Each `*.txt` file is
one person's cookie jar.

```bash
API=http://127.0.0.1:3000/api/v1
login() { curl -s -c "$1.txt" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1@taskboard.local\",\"password\":\"$2\"}" $API/auth/login; echo; }
login owner Owner@12345
login manager Manager@12345
login member Member@12345
```

Each `login` prints the user as JSON (`{"id":…,"role":…}`). Write down the
member's `id`.

---

## A. Startup and configuration

### MT-A1 — Seed is safe to run twice
- Run `npm run backend:seed` again.
- **Expected:** three lines starting with `exists`, then
  `skipped  sample tasks (todos table not empty)`. Nothing changes in the app.

### MT-A2 — Backend refuses to start with a bad environment
- Build once: `cd backend && npm run build`.
- From an **empty folder** (so no `.env` file is read), run each line and read the
  error (replace `<repo>` with your repository path):

  ```bash
  env -i PATH="$PATH" node <repo>/backend/dist/main.js
  env -i PATH="$PATH" DATABASE_URL=postgres://taskboard:taskboard@localhost:5433/taskboard node <repo>/backend/dist/main.js
  env -i PATH="$PATH" DATABASE_URL=postgres://taskboard:taskboard@localhost:5433/taskboard JWT_ACCESS_SECRET=short node <repo>/backend/dist/main.js
  env -i PATH="$PATH" DATABASE_URL=postgres://taskboard:taskboard@localhost:5433/taskboard JWT_ACCESS_SECRET=abcdefghijklmnopqrstuvwxyz0123456789ABCD NODE_ENV=production node <repo>/backend/dist/main.js
  ```

- **Expected:** each one stops at once (exit code 1). It prints
  `The backend cannot start. Fix these environment variables:`, one line per
  variable that says what to set, and
  `No .env file was found in <folder>. Copy backend/.env.example …`.
  **No stack trace** (no lines starting with `at `).
  - Line 1: `DATABASE_URL is missing. …` and `JWT_ACCESS_SECRET is missing. …`
  - Line 2: only `JWT_ACCESS_SECRET is missing. …`
  - Line 3: `JWT_ACCESS_SECRET is invalid. Set it to a random string of at least 32
    characters. Generate one with: node -e …`
  - Line 4: `COOKIE_SECURE must be true when NODE_ENV=production. …`
### MT-A3 — Warning for the example JWT secret
- Stop the backend. In `backend/.env`, set
  `JWT_ACCESS_SECRET=replace-with-a-random-string-of-at-least-32-characters`
  (the value from `.env.example`). Run `npm run backend:dev`.
- **Expected:** the backend **still starts**, and prints one `WARN [Environment]`
  line: `JWT_ACCESS_SECRET is the example value from .env.example. Anyone who has
  read that file can sign in as any user, including the owner. …`
- Put your own secret back (README step 3) and restart. **Expected:** no warning.

### MT-A4 — Migration command without `DATABASE_URL`
```bash
cd backend
DATABASE_URL= npm run migration:show     # empty value wins over backend/.env
npm run migration:show                   # normal
```
- **Expected:** the first prints `DATABASE_URL is missing. Set it in backend/.env
  (copy backend/.env.example).` and exits with code 1; no `ECONNREFUSED`. TypeORM
  puts `Unable to open file: "…cli-data-source.ts".` in front and adds two `at`
  lines; that part comes from the TypeORM CLI. The second lists
  `[X] … InitialSchema…`.

### MT-A5 — The app installs no PostgreSQL extension
- On fresh data ([Before you start](#before-you-start), step 2), after the backend
  has started once:

  ```bash
  docker compose exec -T postgres psql -U taskboard -d taskboard -tAc "SELECT extname FROM pg_extension ORDER BY 1"
  ```

- **Expected:** only `plpgsql`. (A database created before S8a may still list
  `pgcrypto` and `uuid-ossp`; the app no longer adds them, and they do no harm.)

---

### MT-A6 — Frontend refuses to start without a valid `BACKEND_URL`
- Stop the frontend. In `frontend/`, run each line:

  ```bash
  mv .env .env.off; node server.mjs; echo "exit $?"; mv .env.off .env
  BACKEND_URL=ftp://127.0.0.1:4000 node server.mjs; echo "exit $?"
  BACKEND_URL=not-a-url node server.mjs; echo "exit $?"
  node server.mjs
  ```

- **Expected:** the first three print
  `BACKEND_URL is missing or invalid. Set it in frontend/.env (copy frontend/.env.example).`
  and `exit 1`. The last one starts normally (`> Frontend on http://127.0.0.1:3000`).

## B. Sign-in and session

### MT-B1 — Pages need a session
- In a fresh profile open <http://127.0.0.1:3000/tasks>.
- **Expected:** you land on `/login?next=%2Ftasks`.

### MT-B2 — Empty form
- Click «ورود» with both fields empty.
- **Expected:** «ایمیل را وارد کنید.» and «رمز عبور را وارد کنید.» under the fields.
  No request is sent.

### MT-B3 — Wrong password and unknown email look the same
- Sign in with `owner@taskboard.local` / `wrong-pass`, then with
  `nobody@taskboard.local` / `wrong-pass`.
- **Expected:** both show «ایمیل یا رمز عبور درست نیست.»

### MT-B4 — Login rate limit
- Try a wrong password 6 times within one minute.
- **Expected:** the 6th shows «تلاش‌ها بیش از حد مجاز بود. یک دقیقه صبر کنید و دوباره تلاش کنید.»
  Wait one minute before the next scenario.

### MT-B5 — Successful login and cookies
- Sign in as the owner. Open DevTools → Application → Cookies → `127.0.0.1:3000`.
- **Expected:** you land on `/tasks`. Two cookies:
  - `access_token`: HttpOnly ✓, SameSite Lax, Path `/`.
  - `refresh_token`: HttpOnly ✓, SameSite Strict, Path `/api/v1/auth`.
- In the Console run `document.cookie`. **Expected:** `''` (scripts cannot read them).

### MT-B6 — Reload keeps the session
- Reload `/tasks`. **Expected:** still signed in, board shown.

### MT-B7 — Expired access token is renewed silently
- In DevTools → Cookies, delete only `access_token`. Reload.
- **Expected:** you stay signed in (maybe after a short stop on `/login`), and a new
  `access_token` and a new `refresh_token` value appear.

### MT-B8 — Logout
- Click «خروج».
- **Expected:** you land on `/login`; both cookies are gone. Opening `/tasks` sends
  you back to `/login`.

### MT-B9 — API: a stolen refresh token kills every session
```bash
cp member.txt member-old.txt
curl -s -o /dev/null -w '%{http_code}\n' -b member.txt -c member.txt -X POST $API/auth/refresh      # 200 (rotated)
curl -s -o /dev/null -w '%{http_code}\n' -b member-old.txt -X POST $API/auth/refresh                # 401 (old token reused)
curl -s -o /dev/null -w '%{http_code}\n' -b member.txt -c member.txt -X POST $API/auth/refresh      # 401 (all sessions revoked)
login member Member@12345   # sign in again for the next scenarios
```
- **Expected:** `200`, `401`, `401`, then the member's JSON.

---

### MT-B10 — `?next=` cannot send you to another site
- Signed in as any user, open each address:
  - `http://127.0.0.1:3000/login?next=%2F%09%2Fexample.com` (a tab after the first `/`)
  - `http://127.0.0.1:3000/login?next=%2F%0A%2Fexample.com` (a newline)
  - `http://127.0.0.1:3000/login?next=%2F.%2F%2Fexample.com` (`/.//example.com`)
  - `http://127.0.0.1:3000/login?next=https%3A%2F%2Fexample.com`
- **Expected:** every one ends on `http://127.0.0.1:3000/tasks`, never on example.com.
- Open `http://127.0.0.1:3000/login?next=%2Ftasks%3Fstatus%3Ddone`. **Expected:** you
  land on `/tasks?status=done` (a normal path, with its query, is kept).

## C. Tasks as the owner

### MT-C1 — Board
- Sign in as the owner.
- **Expected:** three columns «برای انجام» (2), «در حال انجام» (1), «انجام‌شده» (1),
  each with a count; the 4 seed tasks; dates in Jalali with Persian digits; the
  header shows «کاربران».

### MT-C2 — Create a task with every field
- «کار جدید» → title, «وضعیت» = «در حال انجام», «اولویت» = «زیاد», «موعد» = any
  date, «مسئول» = «عضو تیم», a description (see D1) → «ساخت کار».
- **Expected:** the dialog closes; the message «کار «…» ساخته شد» appears; the
  card is in «در حال انجام» with priority, assignee and the Jalali due date.

### MT-C3 — Title is required
- «کار جدید» → «ساخت کار» with an empty title.
- **Expected:** «عنوان کار را وارد کنید.» and focus moves to the title field.

### MT-C4 — Detail page (read-only)
- Click a task title.
- **Expected:** `/tasks/<id>` shows every field and the description, not editable.

### MT-C5 — Edit
- On a card, open the «⋮» menu → «ویرایش» → change the title and status →
  «ذخیرهٔ تغییرات».
- **Expected:** «تغییرات کار «…» ذخیره شد»; the card moves to the new column.

### MT-C6 — Delete
- «⋮» → «حذف» → the dialog names the task and says it «برای همیشه حذف می‌شود» →
  «حذف کار».
- **Expected:** «کار «…» حذف شد»; the card is gone. Reload: still gone.

### MT-C7 — Filters live in the URL
- «وضعیت» = «در حال انجام». **Expected:** URL `?status=in_progress`, one column.
- «مسئول» = «عضو تیم». **Expected:** `&assigneeId=<uuid>` is added; only matching cards.
- Reload. **Expected:** the same filters and cards.
- Browser Back. **Expected:** returns to `?status=in_progress`.
- «مسئول» = «بدون مسئول». **Expected:** only unassigned tasks (or the no-match state).
- «پاک کردن فیلترها». **Expected:** URL `/tasks`, three columns.

### MT-C8 — No match and junk filters
- Open `/tasks?assigneeId=00000000-0000-4000-8000-000000000000`.
- **Expected:** «هیچ کاری با این فیلترها پیدا نشد.» with a «پاک کردن فیلترها» button.
- Open `/tasks?status=bogus&assigneeId=nope`. **Expected:** filters ignored, full board.

### MT-C9 — Missing task
- Open `/tasks/not-a-uuid` and `/tasks/00000000-0000-4000-8000-000000000000`.
- **Expected:** both show «این کار پیدا نشد.»

---

## D. Description (TipTap JSON)

### MT-D1 — Formatting round trip
- In the create or edit dialog, use the toolbar: «عنوان», «زیرعنوان», «پررنگ»,
  «کج», «فهرست نقطه‌ای», «فهرست شماره‌دار», «نقل‌قول», and «پیوند» with
  `example.com/docs`. Save, then open the task detail and the edit dialog again.
- **Expected:** the detail page and the editor show exactly the same formatting.
  In DevTools, the link in the detail page has `href="https://example.com/docs"`,
  `target="_blank"`, `rel="noopener noreferrer nofollow"`.

### MT-D2 — Unsafe link refused in the editor
- «پیوند» → `javascript:alert(1)` → Enter.
- **Expected:** a message starting «فقط نشانی‌هایی که با http…»; no link is added.

### MT-D7 — Escape in the link row keeps the dialog
- «کار جدید» → type a title → in the editor click «پیوند» → type `example.com`
  → press Escape.
- **Expected:** only the link row closes. The dialog stays open, the title is still
  there, and the cursor is back in the editor. No link is added.
- Click the title field and press Escape. **Expected:** the dialog closes (as before).

### MT-D3 — Stored as JSON, not HTML
- DevTools → Network → save a task → the `todos` request → Payload.
- **Expected:** `description` is an object like `{"type":"doc","content":[…]}`, not
  an HTML string.

### MT-D4 — Empty description is valid
- Create a task with no description. **Expected:** saved; the detail page shows
  «توضیحی ثبت نشده است.»

### MT-D5 — API: the server validates the JSON itself
```bash
# javascript: link → 400, details mention "description"
curl -s -b owner.txt -H 'Content-Type: application/json' -d '{"title":"t","description":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x","marks":[{"type":"link","attrs":{"href":"javascript:alert(1)"}}]}]}]}}' $API/todos; echo
# HTML instead of JSON → 400
curl -s -b owner.txt -H 'Content-Type: application/json' -d '{"title":"t","description":"<p>hi</p>"}' $API/todos; echo
# a node type that is not allowed → 400
curl -s -b owner.txt -H 'Content-Type: application/json' -d '{"title":"t","description":{"type":"doc","content":[{"type":"codeBlock"}]}}' $API/todos; echo
# an unknown field → 400
curl -s -b owner.txt -H 'Content-Type: application/json' -d '{"title":"t","foo":1}' $API/todos; echo
```
- **Expected:** four `400` responses in the shape
  `{"statusCode":400,"error":"Bad Request","message":…,"details":[{"field":…,"message":…}]}`.

### MT-D6 — API: a very deeply nested body is a 400, not a 500
```bash
# a description with 2000 nested blockquotes (68 KB)
python3 -c 'n=2000; print("{\"title\":\"t\",\"description\":{\"type\":\"doc\",\"content\":[" + "{\"type\":\"blockquote\",\"content\":["*n + "]}"*n + "]}}")' > deep.json
curl -s -b owner.txt -H 'Content-Type: application/json' --data-binary @deep.json $API/todos; echo
```
- **Expected:**
  `{"statusCode":400,"error":"Bad Request","message":"Validation failed","details":[{"field":"description","message":"description is nested too deeply"}]}`.
  The backend terminal shows no error.

---

## E. Users (owner only)

### MT-E1 — Users page
- Owner → «کاربران».
- **Expected:** a table with the three seed users; emails shown left-to-right.

### MT-E2 — Create a user and field errors
- «کاربر جدید» → name, email `member@taskboard.local`, password `Password-123` →
  «ساخت کاربر». **Expected:** «این ایمیل قبلاً برای کاربر دیگری ثبت شده است.» under
  the email.
- Email `a@b`. **Expected:** «یک ایمیل معتبر وارد کنید.»
- Email `tester@taskboard.local`, «نقش» = «عضو». **Expected:** «کاربر «…» ساخته شد»
  and a new row.

### MT-E3 — Change a role
- Row menu → «ویرایش» → «نقش» = «مدیر» → «ذخیرهٔ تغییرات». **Expected:** saved; the row
  shows the new role.

### MT-E4 — A disabled user is cut off at once
- In the member profile, sign in as `tester@taskboard.local` and leave `/tasks` open.
- Owner: row menu of the tester → «غیرفعال کردن» → confirm.
- In the tester profile, click anything or reload.
- **Expected:** the tester lands on `/login`. Signing in again shows
  «ایمیل یا رمز عبور درست نیست.» (same as a wrong password).
- Owner: row menu → «فعال کردن». The tester can sign in again; the old session does
  not come back.

### MT-E5 — The last active owner stays
- Owner: own row menu → «غیرفعال کردن» → confirm.
  **Expected:** «این کاربر آخرین مالک فعال است و نمی‌توان او را غیرفعال کرد.»
- Own row → «ویرایش» → «نقش» = «عضو» → save.
  **Expected:** a message starting «این کاربر آخرین مالک فعال است. نقش او را…».

### MT-E6 — API: disabled user's old token
```bash
curl -s -o /dev/null -w '%{http_code}\n' -b member.txt $API/auth/me     # 200
# owner disables the member (use the member id you wrote down)
curl -s -b owner.txt -H 'Content-Type: application/json' -X PATCH -d '{"isActive":false}' $API/users/<member-id>; echo
curl -s -o /dev/null -w '%{http_code}\n' -b member.txt $API/auth/me     # 401
curl -s -o /dev/null -w '%{http_code}\n' -b member.txt $API/todos       # 401
# enable again
curl -s -b owner.txt -H 'Content-Type: application/json' -X PATCH -d '{"isActive":true}' $API/users/<member-id>; echo
login member Member@12345
```
- **Expected:** `200`, then `401`, `401`.

---

## F. Manager

### MT-F1 — Sees and manages every task
- Sign in as the manager.
- **Expected:** all tasks (same as the owner); no «کاربران» in the header.
- Create a task assigned to «عضو تیم»; edit «بازبینی نقش کاربران»; delete a task
  the owner created. **Expected:** all succeed.

### MT-F2 — No user management
- Open `/users`. **Expected:** «به این صفحه دسترسی ندارید.»
- API:
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' -b manager.txt $API/users                     # 403
  curl -s -o /dev/null -w '%{http_code}\n' -b manager.txt -H 'Content-Type: application/json' \
    -X PATCH -d '{"role":"owner"}' $API/users/<member-id>                               # 403
  curl -s -b manager.txt $API/users/options; echo                                         # 200, only id + name
  ```

---

## G. Member

### MT-G1 — Sees only own tasks
- Sign in as the member.
- **Expected:** exactly the three seed tasks marked "yes" above (plus any task you
  created or assigned to the member). «بازبینی نقش کاربران» is not shown. No
  «کاربران» in the header.

### MT-G2 — Can only assign to self or nobody
- Filter «مسئول». **Expected:** options «همهٔ افراد», «بدون مسئول», «عضو تیم (من)».
- «کار جدید» → «مسئول». **Expected:** only «بدون مسئول» and «عضو تیم (من)».

### MT-G3 — A task someone else created and assigned to the member
- «نوشتن تست‌های دسترسی» → «⋮». **Expected:** «ویرایش» shown, «حذف» not shown.
- «ویرایش». **Expected:** «مسئول» is locked with «مسئول را فقط سازندهٔ کار می‌تواند تغییر دهد.»
- Change «وضعیت» to «انجام‌شده» → save. **Expected:** saved (assumption AS1).

### MT-G4 — Own task
- Create a task, then «⋮» → «حذف» → «حذف کار». **Expected:** deleted.

### MT-G5 — Another person's task by URL
- As the owner, open «بازبینی نقش کاربران» and copy its URL. Open it as the member.
- **Expected:** «این کار پیدا نشد.» (the API answers 404 and does not reveal that
  the task exists).

### MT-G6 — API: the rules hold without the UI
Get the hidden task's id: `curl -s -b owner.txt $API/todos` and copy the `id` of
«بازبینی نقش کاربران» (`<hidden-id>`) and its `assignee.id` (`<manager-id>`).

```bash
curl -s -o /dev/null -w '%{http_code}\n' -b member.txt $API/todos/<hidden-id>                                  # 404
curl -s -o /dev/null -w '%{http_code}\n' -b member.txt -H 'Content-Type: application/json' -X PATCH -d '{"title":"x"}' $API/todos/<hidden-id>   # 404
curl -s -o /dev/null -w '%{http_code}\n' -b member.txt -X DELETE $API/todos/<hidden-id>                        # 404
curl -s -b member.txt "$API/todos?assigneeId=<manager-id>"; echo                                               # []
curl -s -o /dev/null -w '%{http_code}\n' -b member.txt -H 'Content-Type: application/json' -d '{"title":"x","assigneeId":"<manager-id>"}' $API/todos  # 403
curl -s -o /dev/null -w '%{http_code}\n' -b member.txt $API/users                                              # 403
curl -s -o /dev/null -w '%{http_code}\n' -b member.txt -H 'Content-Type: application/json' -d '{"email":"x@taskboard.local","name":"x","password":"Password-123","role":"owner"}' $API/users  # 403
curl -s -o /dev/null -w '%{http_code}\n' -b member.txt -H 'Content-Type: application/json' -X PATCH -d '{"role":"owner"}' $API/users/<member-id> # 403
```
- **Expected:** exactly the codes in the comments.

---

## H. Accessibility, RTL and layout

### MT-H1 — Keyboard only
- Sign in and use only the keyboard (Tab, Shift+Tab, Enter, Space, arrows, Escape).
- **Expected:**
  - Every control shows a visible focus ring.
  - Filters open with Enter or Space; arrows move; Enter picks; Escape closes.
  - «کار جدید» + Enter opens the dialog with focus inside it; Tab stays inside the
    dialog; Escape closes it and focus returns to «کار جدید».
  - The «⋮» card menu opens with Enter; arrows move between «ویرایش» and «حذف».

### MT-H2 — Screen reader basics (optional, macOS VoiceOver: Cmd+F5)
- Not checked with a real screen reader yet; the expectations come from the code.
- **Expected:** each column is read as a section with its heading; dialogs are
  announced with their title; "saved" and "deleted" messages are announced.

### MT-H3 — Right-to-left and Persian
- **Expected:** text aligned right; menus and dialogs mirrored; all numbers and
  dates in Persian digits; dates in the Jalali calendar; emails and links stay
  left-to-right and readable.

### MT-H4 — Phone width
- DevTools device toolbar, width 390 px: board, task dialog, detail, users page.
- **Expected:** no sideways scrolling; columns stack; dialogs fit the screen.

---

## I. Errors and security edges

### MT-I1 — Backend down
- Stop the backend (Ctrl+C in terminal 2). Reload `/tasks`.
- **Expected:** «فهرست کارها بارگذاری نشد.» with «سرور در دسترس نیست. کمی بعد دوباره
  تلاش کنید.» and a «تلاش دوباره» button.
- Start the backend, click «تلاش دوباره». **Expected:** the board loads.

### MT-I2 — API: cross-site request blocked by the proxy
```bash
curl -s -b owner.txt -H 'Content-Type: application/json' -H 'Origin: http://evil.example' -d '{"title":"x"}' $API/todos; echo
```
- **Expected:** `403` with `"message":"Cross-origin request rejected"`.

### MT-I3 — API: no backend URL in the browser
- In DevTools → Network, reload any page and filter by `4000`.
- **Expected:** no request goes to port 4000; every API call is `/api/v1/…`.

### MT-I4 — API: an id that is not a UUID names the field
```bash
curl -s -b owner.txt $API/todos/not-a-uuid; echo
curl -s -b owner.txt -X PATCH -H 'Content-Type: application/json' -d '{}' $API/users/not-a-uuid; echo
```
- **Expected:** both
  `{"statusCode":400,"error":"Bad Request","message":"Validation failed","details":[{"field":"id","message":"id must be a UUID"}]}`.

### MT-I5 — Persian 404 and error pages
- Signed in, open <http://127.0.0.1:3000/no-such-page>.
- **Expected:** «این صفحه پیدا نشد.» and a «رفتن به تخته کارها» button that opens
  `/tasks`. No English "This page could not be found".
- Error page (fakes a broken API answer): open `/tasks`, paste this into the
  DevTools console, then pick «وضعیت» = «انجام‌شده» (do not reload; a reload removes
  the fake):

  ```js
  const realFetch = window.fetch; window.fetch = (url, init) => String(url).includes('/api/v1/todos?') ? Promise.resolve(new Response('{}', { headers: { 'Content-Type': 'application/json' } })) : realFetch(url, init);
  ```

- **Expected:** «این صفحه نمایش داده نشد.» with a «تلاش دوباره» button, in Persian
  and right-to-left. Reload the page: the board is back.

### MT-I6 — A server error on a field the form does not show
- Every field the API checks has a place in the forms, so this needs a fake answer.
  Open `/tasks`, paste this into the DevTools console, then «کار جدید» → any title
  → «ساخت کار»:

  ```js
  const realFetch = window.fetch; window.fetch = (url, init) => String(url).endsWith('/api/v1/todos') && init?.method === 'POST' ? Promise.resolve(new Response('{"statusCode":400,"error":"Bad Request","message":"Validation failed","details":[{"field":"foo","message":"foo is bad"}]}', { status: 400, headers: { 'Content-Type': 'application/json' } })) : realFetch(url, init);
  ```

- **Expected:** the dialog stays open and shows «اطلاعات فرم پذیرفته نشد. دوباره
  تلاش کنید.»; the button works again. Reload the page to remove the fake.

---

## J. Automated tests

### MT-J1 — Backend tests (one at a time)
```bash
npm run backend:test        # expected: 6 suites, 64 tests passed
npm run backend:test:e2e    # expected: 6 suites, 58 tests passed
```

### MT-J2 — Frontend checks
```bash
cd frontend && npm run typecheck && npm run lint && npm run build
```
- **Expected:** all three finish without errors.

---

## Checklist

| ID | Scenario | Result |
| -- | -------- | ------ |
| A1 | Seed twice | |
| A2 | Bad environment stops the backend | |
| A3 | Warning for the example JWT secret | |
| A4 | Migration command without DATABASE_URL | |
| A5 | No PostgreSQL extension installed | |
| A6 | Bad BACKEND_URL stops the frontend | |
| B1 | Pages need a session | |
| B2 | Empty login form | |
| B3 | Same error for wrong password and unknown email | |
| B4 | Login rate limit | |
| B5 | Cookies are HttpOnly | |
| B6 | Reload keeps the session | |
| B7 | Silent token renewal | |
| B8 | Logout | |
| B9 | Stolen refresh token (API) | |
| B10 | ?next= stays on this site | |
| C1 | Board | |
| C2 | Create with every field | |
| C3 | Title required | |
| C4 | Detail page | |
| C5 | Edit | |
| C6 | Delete | |
| C7 | Filters in the URL | |
| C8 | No match and junk filters | |
| C9 | Missing task | |
| D1 | Formatting round trip | |
| D2 | Unsafe link refused | |
| D3 | JSON, not HTML | |
| D4 | Empty description | |
| D5 | Server validates the JSON (API) | |
| D6 | Deeply nested body is a 400 (API) | |
| D7 | Escape in the link row keeps the dialog | |
| E1 | Users page | |
| E2 | Create user, field errors | |
| E3 | Change a role | |
| E4 | Disabled user cut off | |
| E5 | Last owner stays | |
| E6 | Disabled user's old token (API) | |
| F1 | Manager manages all tasks | |
| F2 | Manager cannot manage users | |
| G1 | Member sees own tasks only | |
| G2 | Member assigns self or nobody | |
| G3 | Task assigned by someone else | |
| G4 | Member deletes own task | |
| G5 | Other task by URL | |
| G6 | Member rules hold without UI (API) | |
| H1 | Keyboard only | |
| H2 | Screen reader basics | |
| H3 | RTL and Persian | |
| H4 | Phone width | |
| I1 | Backend down | |
| I2 | Cross-site request blocked (API) | |
| I3 | No backend URL in the browser | |
| I4 | Non-UUID id names the field (API) | |
| I5 | Persian 404 and error pages | |
| I6 | Unknown server field error | |
| J1 | Backend tests | |
| J2 | Frontend checks | |
