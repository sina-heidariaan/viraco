# Demo video script

A Persian screen recording of **at most 5 minutes** (spec: "Project Demonstration
Video"). The spec asks it to show: project overview, architecture,
frontend/backend structure, the authentication and authorization flow, the task
workflow, the TipTap JSON implementation, and important technical decisions.

Target length: about 4 min 40 s. Screen directions are in English; the narration
(right column) is in Persian, to be read aloud.

## Before recording

1. Start from fresh data so the screens match this script: stop the backend, then
   `docker compose down -v` (this **deletes** the local database volume),
   `npm run db:up`, `npm run backend:migrate`, `npm run backend:seed`, and start
   the backend and frontend ([README](../README.md#setup-from-a-clean-clone)).
2. Run `npm run backend:test:e2e` once in a terminal and leave the summary on screen
   (it takes about a minute — do not run it during the recording).
3. As the owner, open the task "بازبینی نقش کاربران" and copy its URL
   (`/tasks/<id>`). The member cannot see this task; it is used in scene 8.
4. Open in tabs: the GitHub page of the repository (README),
   [architecture.md](architecture.md) on GitHub, VS Code with the repository, and
   <http://127.0.0.1:3000/login>. Browser zoom 110–125 %, DevTools closed.
5. Log out before each role change (header → خروج).

## Scenes

| # | Time | On screen | Narration (Persian) |
| - | ---- | --------- | ------------------- |
| 1 | 0:00–0:20 | GitHub README: title, stack table | سلام. این پروژه یک تخته‌ی مدیریت کار برای تیم است، با رابط فارسی و راست‌به‌چپ. فرانت‌اند با Next.js و بک‌اند با NestJS و PostgreSQL ساخته شده. سه نقش داریم: مالک، مدیر و عضو؛ و همه‌ی دسترسی‌ها در خود API کنترل می‌شود، نه با پنهان کردن دکمه‌ها. |
| 2 | 0:20–0:55 | architecture.md, diagram 1 (components) | مرورگر فقط با Next.js حرف می‌زند. همه‌ی درخواست‌ها به ‎/api/v1‎ می‌روند و یک route در Next.js آن‌ها را با کوکی‌ها به NestJS می‌فرستد؛ آدرس بک‌اند فقط سمت سرور است و CORS در NestJS خاموش است. یک سرور سفارشی هم داریم، server.mjs، که IP واقعی کاربر را از خود اتصال TCP می‌خواند؛ چون محدودیت ورود، یعنی پنج تلاش در دقیقه، روی همین IP است و Next.js به‌تنهایی هدر جعلی را نگه می‌دارد. |
| 3 | 0:55–1:15 | VS Code explorer: expand `backend/src/modules`, `common/guards`, then `frontend/src/app`, `components`, `lib` | ساختار مونو‌ریپو: پوشه‌ی backend و frontend هر کدام package و lockfile خودشان را دارند و هیچ کد مشترکی ندارند. در بک‌اند سه ماژول auth، users و todos داریم و دو guard سراسری. در فرانت‌اند صفحه‌ها، کامپوننت‌ها و کلاینت API جدا هستند. طرح کلی پروژه در ABSTRACTION_PLAN نوشته شده. |
| 4 | 1:15–1:55 | Login as `owner@taskboard.local` / `Owner@12345`. Open DevTools → Application → Cookies: point at HttpOnly and the Path of `refresh_token`. Then architecture.md, diagram 2 | ورود با مالک. دو کوکی ساخته می‌شود، هر دو HttpOnly، پس جاوااسکریپت به آن‌ها دسترسی ندارد. توکن دسترسی یک JWT پانزده‌دقیقه‌ای است. توکن تازه‌سازی یک رشته‌ی تصادفی هفت‌روزه است که فقط هش آن در دیتابیس ذخیره می‌شود و مسیرش فقط ‎/api/v1/auth‎ است. با هر تازه‌سازی، توکن عوض می‌شود؛ و اگر یک توکن قدیمی دوباره استفاده شود، همه‌ی نشست‌های آن کاربر باطل می‌شود. |
| 5 | 1:55–2:45 | Board. Status filter → «در حال انجام» (point at the URL), assignee filter, then «پاک کردن فیلترها». Create a task: title, priority, assignee, due date; in the editor a heading, **bold**, a bullet list and a link. Save, open the new task (read-only view). Edit → change status to «انجام‌شده». Delete it → confirm dialog | این تخته‌ی کارهاست: سه ستون برای سه وضعیت. فیلتر وضعیت و مسئول در آدرس صفحه ذخیره می‌شود، پس رفرش و دکمه‌ی برگشت کار می‌کنند. حالا یک کار جدید می‌سازم: عنوان، اولویت، مسئول، تاریخ سررسید که به شمسی نمایش داده می‌شود، و توضیحات با ویرایشگر TipTap: تیتر، متن پررنگ، فهرست و لینک. فرم‌ها و تأیید حذف همه Dialog از Headless UI هستند و انتخاب‌ها Listbox؛ با کیبورد هم کار می‌کنند. ویرایش وضعیت… و حذف با تأیید. |
| 6 | 2:45–3:15 | Create one more task with a description (leave «مسئول» as «بدون مسئول»); DevTools → Network → the POST request payload (`description` JSON). Then VS Code: `tiptap.validator.ts` (allowlist at the top) and `tiptap-extensions.ts` | توضیحات به‌صورت JSON خود TipTap ذخیره می‌شود، در ستون jsonb؛ HTML هیچ‌جا منبع داده نیست. در بک‌اند یک validator درخت JSON را پیمایش می‌کند و فقط گره‌ها و علامت‌های مجاز را قبول می‌کند؛ لینک فقط http و https، و عمق و حجم هم محدود است. در فرانت‌اند یک فهرست افزونه‌ی واحد داریم که هم ویرایشگر و هم نمایش فقط‌خواندنی از آن استفاده می‌کنند، پس همان JSON در هر دو یکسان نمایش داده می‌شود. |
| 7 | 3:15–3:45 | Header → «کاربران». Create a user (role «عضو»). Row menu → disable → confirm. Then try to disable the owner's own row → the 409 message | صفحه‌ی کاربران فقط برای مالک است. کاربر جدید می‌سازم و بعد غیرفعالش می‌کنم. غیرفعال کردن، شماره‌ی نسخه‌ی توکن کاربر را بالا می‌برد و توکن‌های تازه‌سازی‌اش را باطل می‌کند، پس نشست قبلی‌اش در همان درخواست بعدی از کار می‌افتد. اگر بخواهم آخرین مالک فعال را غیرفعال کنم، سرور اجازه نمی‌دهد. |
| 8 | 3:45–4:05 | Log out. Log in as `manager@taskboard.local` / `Manager@12345`. Board shows all tasks; no «کاربران» link. Type `/users` in the address bar → forbidden state | مدیر همه‌ی کارها را می‌بیند و می‌تواند هر کاری را بسازد، ویرایش کند، حذف کند و به هر کسی بسپارد؛ ولی مدیریت کاربران ندارد. اگر آدرس را دستی بزنم، صفحه پیام «دسترسی ندارید» نشان می‌دهد؛ و این فقط ظاهر است: خود API هم درخواست مدیر به ‎/users‎ را با ۴۰۳ رد می‌کند. |
| 9 | 4:05–4:30 | Log out. Log in as `member@taskboard.local` / `Member@12345`. Board shows 3 tasks. Open «نوشتن تست‌های دسترسی»: no delete button, assignee locked. Paste the owner task URL from step 3 → «not found» state | عضو فقط کارهایی را می‌بیند که خودش ساخته یا به او سپرده شده؛ این فیلتر داخل خود کوئری SQL است، نه بعد از خواندن داده. کاری که مدیر به او سپرده را می‌تواند ویرایش کند، ولی نمی‌تواند مسئولش را عوض کند یا حذفش کند. اگر آدرس کار شخص دیگری را باز کند، سرور ۴۰۴ می‌دهد تا حتی وجود آن کار هم معلوم نشود. |
| 10 | 4:30–4:50 | Terminal with the e2e summary; then `docs/ai-workflow.md` on GitHub | این قوانین با تست‌های e2e روی یک دیتابیس واقعی بررسی می‌شوند، از جمله سه تست خواسته‌شده: عضو کار دیگران را نمی‌بیند، عضو نمی‌تواند کاربران را تغییر دهد، و توکن قدیمی کاربر غیرفعال کار نمی‌کند. پروژه با Claude Code و بر اساس یک طرح مکتوب، قوانین پروژه و جلسه‌های ثبت‌شده ساخته شد؛ تصمیم‌های معماری و امنیتی با من بود. جزئیات در README و پوشه‌ی docs است. ممنون. |

## Checks after recording

- Length is 5:00 or less.
- The seed passwords on screen are the development defaults only.
- No real secret is visible (for example `backend/.env` must not be open in VS Code).
