# Manual test scenarios

Real situations a team runs into, which a script cannot judge: several people
working at the same time, access changing in the middle of work, sessions running
out, real pasted content, and how the screens read on a desk and on a phone.

Simple checks (single screens, status codes, start-up errors, permission rules) are
not repeated here. They are covered automatically; see
[What is already checked automatically](#what-is-already-checked-automatically).

Expected results come from the code (read on 2026-10-11) and from the browser runs
of sessions S7 and S8b. A **Known weakness** line marks behaviour that works as
built but that you may decide to change.

## Before you start

1. Start the app (README steps 4–8) on a **fresh seed**: three users
   (owner «مالک سیستم», manager «مدیر پروژه», member «عضو تیم») and four tasks.

   | Task | Created by | Assigned to | Status |
   | ---- | ---------- | ----------- | ------ |
   | طراحی صفحه ورود | manager | member | انجام‌شده |
   | نوشتن تست‌های دسترسی | manager | member | در حال انجام |
   | یادداشت شخصی عضو تیم | member | member | برای انجام |
   | بازبینی نقش کاربران | owner | manager | برای انجام |

2. **One browser per person.** Cookies are shared inside one browser profile, so
   two people in one profile are the same person. Use for example: Chrome (owner),
   a Chrome Incognito window (manager), Firefox or Safari (member).
3. **Login limit.** All logins from your machine count against **one** limit of
   5 per minute (successful ones too). If you see «تلاش‌ها بیش از حد مجاز بود…»,
   wait one minute.
4. **Short sessions** (only for R7 and R8). In `backend/.env` set
   `JWT_ACCESS_TTL_SECONDS=60` (the minimum) and restart the backend. Set it back
   to `900` afterwards.

---

## R1 — A normal working day for the team

1. **Manager:** create three tasks for «عضو تیم»: one «زیاد» with a due date next
   week, one «متوسط» with no due date, one «کم». Give each a description with a
   heading, a list and a link.
2. **Member:** sign in. Work on the board for a few minutes: open each new task,
   move one to «در حال انجام» and one to «انجام‌شده» (edit dialog → «وضعیت»).
3. **Manager:** look at the board without reloading, then reload.
4. **Owner:** reload the board and filter «مسئول» = «عضو تیم».

**Expected:**
- The member sees their own task, the two seeded tasks assigned to them, and the
  three new ones. They do not see «بازبینی نقش کاربران».
- The manager sees the member's status changes **only after a reload**. The board
  does not update by itself.
- The owner's filtered board shows exactly the tasks assigned to the member.

**Judge:** Can you find a task within a few seconds? Are priority and due date
readable on the cards? Does the read-only detail page look the same as what you
typed in the editor?

## R2 — Two people edit the same task at the same time

1. **Manager** and **member** both open the edit dialog of «نوشتن تست‌های دسترسی».
2. Manager: change the **title**, save. Member: change the **status**, save.
3. Reload both boards.
4. Repeat, but now **both** change the title to different texts.

**Expected:**
- Step 3: both changes are kept. Each save sends only the fields that person
  changed.
- Step 4: the **last save wins**. The first person's title is gone. Both people
  saw «تغییرات کار «…» ذخیره شد.»

**Known weakness (kept, see README "Known limitations"):** nobody is warned
that someone else changed the task in the meantime.

## R3 — A task is deleted while someone is editing it

1. **Member:** open the edit dialog of «طراحی صفحه ورود» and type a new description.
2. **Manager:** delete that task (card menu → «حذف» → «حذف کار»).
3. **Member:** click «ذخیرهٔ تغییرات».
4. Repeat with another task, but in step 1 change nothing before step 3.

**Expected:**
- First run: the dialog **stays open** with the typed text, shows «این کار دیگر
  وجود ندارد یا به آن دسترسی ندارید. متنی که نوشته‌اید هنوز اینجاست؛ …», and
  «ذخیرهٔ تغییرات» is disabled. The text can be copied. Behind the dialog the
  board already shows «… فهرست به‌روز شد.» without the task. «انصراف» closes it.
- Second run (nothing changed): the dialog closes, the same board message
  appears, and the task is gone.
- A save without changes on a task that still exists closes the dialog with no
  message.

## R4 — A task is taken away from a member

1. **Member:** open the detail page of «نوشتن تست‌های دسترسی». Keep it open.
2. **Owner:** edit that task and set «مسئول» to «مدیر پروژه».
3. **Member:** reload the detail page (the address bar still shows `/tasks/…`),
   then click «بازگشت به کارها».

**Expected:** after the reload the address stays `/tasks/…` and the page shows
«این کار پیدا نشد.» and the task is no longer
on the member's board. The member was neither its creator nor its assignee any
more. The page does not say whether the task still exists.

## R5 — A person is disabled in the middle of their work

1. **Member:** open «کار جدید», type a title and a long description. Do not save.
2. **Owner:** «کاربران» → member's row menu → «غیرفعال کردن» → confirm.
3. **Member:** click «ساخت کار».
4. Member: try to sign in again.
5. **Owner:** «فعال کردن». Member: sign in.

**Expected:**
- Step 3: the save is refused and the member lands on the login page. An error
  line may flash in the dialog first.
- Step 4: «ایمیل یا رمز عبور درست نیست.» This is the same text as a wrong password,
  so nobody can find out from outside that an account is disabled.
- Step 5: the member is back, with the same tasks as before.

**Known weakness (kept, see README "Known limitations"):** everything the
member typed in step 1 is lost. There is no draft and no "you are being signed
out" warning.

## R6 — A manager is demoted to member while signed in

1. **Manager:** stay on the board.
2. **Owner:** «کاربران» → manager's row → «ویرایش» → «نقش» = «عضو» → save.
3. **Manager:** click anything that loads data, for example a filter.
4. Manager: sign in again.

**Expected:**
- Step 3: the manager is sent to the login page.
- Step 4: the board shows only tasks they created or that are assigned to them.
  The assignee choices are «بدون مسئول» and their own name with «(من)». «حذف» is
  shown only on tasks they created.
- Put the role back to «مدیر» afterwards.

## R7 — A long writing session outlives the session token

Needs the 60-second setting (Before you start, point 4).

1. **Owner:** open «کار جدید» and write a description slowly for **3 minutes**.
2. Click «ساخت کار».
3. Wait 2 more minutes, then reload the board.

**Expected:**
- Step 2: the task is saved without a login screen. The app renews the session
  in the background.
- Step 3: the board loads and you are still signed in. You do not have to type
  your password.

## R8 — One person, several tabs

Needs the 60-second setting.

1. **Owner:** open the board in **three tabs**. Wait 2 minutes.
2. Within a few seconds, click a filter in each tab.
3. Click «خروج» in tab 1. Do nothing in tabs 2 and 3 for a moment, then click a
   filter in tab 2.

**Expected:**
- Step 2: no tab is logged out and no login screen appears. The tabs renew the session one after another, so the server
  never sees the same renewal twice (it would treat that as a stolen token and end
  every session).
- Step 3: tabs 2 and 3 still show the board until you click. On the click, tab 2
  goes to the login page. Other tabs are not told about the logout at once.

## R9 — Two owners try to disable each other at the same moment

1. **Owner:** promote «مدیر پروژه» to «مالک». Sign in as that user (now an owner)
   in the second browser.
2. In each browser open «کاربران» → the **other** owner's row → «غیرفعال کردن».
   Both confirmation dialogs are open.
3. Click both confirm buttons within one second.

**Expected:** exactly one of them is disabled. The other one sees «این کاربر آخرین
مالک فعال است و نمی‌توان او را غیرفعال کرد.», or is sent to the login page if
they were the one disabled. There is always one active owner left.
Undo afterwards: enable the disabled owner and set «مدیر پروژه» back to «مدیر».

## R10 — Real content: pasting, mixed languages, long text

1. Copy a section from a real document (Google Docs, Word, or a web page) that
   has headings, a table, an image, coloured and underlined text and a code
   snippet. Paste it into a new task's description and save.
2. Write a title and description that mix Persian and English, for example
   «بررسی API ورود در نسخه 2.5 با Next.js», including an English link inside a
   Persian sentence.
3. Paste text longer than 100 KB (about 50,000 Persian letters; paste one long
   article several times) into a description and save.
4. In Safari and in Chrome: open «کار جدید», click into the empty description,
   choose «فهرست نقطه‌ای», type a Persian item, press Enter, type an English
   item. Repeat with «فهرست شماره‌دار».

**Expected:**
- Step 1: kept: headings (3 levels), bold, italic, lists, quotes, links (http/https
  only). Dropped: images, colours, underline, code formatting. A table does not
  stay a table; its text remains. The task saves, and the detail page shows the
  same result as the editor.
- Step 2: English words and numbers read left to right inside the Persian line
  and stay in place.
- Step 3: the dialog shows «توضیحات بیش از ۱۰۰ کیلوبایت است. آن را کوتاه‌تر
  کنید.» and nothing is saved.
- Step 4: the cursor of an empty item starts on the right, next to the marker.
  The marker stays after you type. Persian text sits indented beside it; an
  English item reads left to right on the left side of the same line.

**Judge:** Is what remains after the paste still readable? Is anything lost that
your team would miss?

## R11 — A full board, long titles, and a phone

1. Create about 15 tasks in one column. Give one a 200-character title (the field
   stops at 200) and one a single very long English word.
2. Look at the board at full width, then in Chrome DevTools device mode at 390 px
   (iPhone size). Open a dialog and a card menu at 390 px.

**Expected:** long titles wrap and are never cut off. Only a long assignee name is
shortened. Nothing scrolls sideways.

**Judge:** Is the board still usable with many cards? Can you reach every button
with a thumb?

## R12 — Due dates in real life

1. Create a task with a due date **in the past**.
2. Create one due on **2027-03-21** (Nowruz).
3. Change your computer's time zone to Los Angeles (System Settings → General →
   Date & Time), reload, and compare the dates. Set it back afterwards.

**Expected:**
- Step 1: accepted (a task can be recorded late). The card and the detail page
  show «گذشته از موعد» next to the date. Set the status to «انجام‌شده»: the
  mark goes away. A task due **today** is not marked.
- Step 2: shown as «۱ فروردین ۱۴۰۶». While you pick the date, the hint under the
  field shows it in the Persian calendar («به تاریخ شمسی: …»).
- Step 3: due dates **do not move** by a day. Only "last changed" times follow the
  time zone.

## R13 — A manager shares a filtered board link with a member

1. **Manager:** filter «مسئول» = «مدیر پروژه». Copy the address and send it to the
   member.
2. **Member:** open that address.

**Expected:** the member sees only tasks **they created** that are assigned to
the manager. If there are none: «هیچ کاری با این فیلترها پیدا نشد.» The filter
shows «فرد انتخاب‌شده» when the member's board does not know the manager's name.
The link never shows the member another person's tasks.

## R14 — The server stops while someone is saving

1. **Owner:** open «کار جدید», fill in a title and a description.
2. Stop the backend (Ctrl+C in its terminal).
3. Click «ساخت کار».
4. Start the backend again and click «ساخت کار» once more.

**Expected:**
- Step 3: «سرور در دسترس نیست. کمی بعد دوباره تلاش کنید.» inside the dialog. All the
  typed text is still there and the button works again.
- Step 4: the task is saved once (no duplicate).

## R15 — An office where everyone signs in at 9:00

1. From the three browsers, sign in, sign out and sign in again, quickly: six
   logins within one minute.

**Expected:** the sixth login is refused with «تلاش‌ها بیش از حد مجاز بود. یک دقیقه
صبر کنید و دوباره تلاش کنید.»

**Known weakness (kept, see README "Known limitations"):** the limit is per IP
address, not per account. In an office
where all staff share one internet address, the sixth colleague in a minute is
blocked, even with the right password.

## R16 — Keyboard only, and a screen reader

1. Do not use the mouse. With Tab, Shift+Tab, Enter, Space, arrow keys and Escape:
   sign in, filter the board, create a task with a description and a link, edit
   it, delete it, sign out.
2. Optional, macOS VoiceOver (Cmd+F5): create a task again.

**Expected:** every control can be reached and the focus ring is always visible.
Dialogs keep focus inside and return it to the button that opened them. Escape
closes menus and dialogs. In the editor's link row it closes only that row; inside
the description editor itself it does nothing. VoiceOver reads field labels,
error messages and the «…ساخته شد» confirmation.

**Judge:** Is the order of focus natural for a right-to-left page?

---

## What is already checked automatically

You do not need to repeat these by hand.

| Area | Checked by |
| ---- | ---------- |
| Every permission rule (owner / manager / member, 403 vs 404, last owner, disabled user's old token, stolen refresh token) | Backend e2e tests (`npm run backend:test:e2e`, 58 tests) |
| Env checks, TipTap validator, JSON depth limit, error shape | Backend unit tests (`npm run backend:test`, 64 tests) |
| Login, board, filters in the URL, dialogs, editor round trip, users page, all three roles, 0 console errors | `npm run check:browser` in `frontend/` (93 checks; README "Tests and checks") |
| `?next=` redirect safety, Escape in the link row, Persian 404 and error pages, unknown field errors, `BACKEND_URL` check | S8b probes (34 checks plus the start-up check) |
| Types, lint, production build | `npm run typecheck`, `npm run lint`, `npm run build` in `frontend/` |

---

## Checklist

| ID | Scenario | Result |
| -- | -------- | ------ |
| R1 | A normal working day | |
| R2 | Two people edit one task | |
| R3 | Task deleted during editing | |
| R4 | Task taken away from a member | |
| R5 | Person disabled mid-work | |
| R6 | Manager demoted while signed in | |
| R7 | Long writing session | |
| R8 | Several tabs | |
| R9 | Two owners disable each other | |
| R10 | Pasting real content | |
| R11 | Full board, long titles, phone | |
| R12 | Due dates | |
| R13 | Shared filter link | |
| R14 | Server stops during save | |
| R15 | Office login rush | |
| R16 | Keyboard and screen reader | |
