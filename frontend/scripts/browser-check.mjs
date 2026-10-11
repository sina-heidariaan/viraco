// Browser check: 93 checks of the running app in headless Google Chrome, as owner,
// manager, member and a freshly created user that gets disabled. No dependency: it
// talks to Chrome over the DevTools protocol with Node's built-in WebSocket.
//
// Needs: Node 22 or newer, Google Chrome, the frontend on APP_URL (default
// http://127.0.0.1:3000) and the backend behind it, on a database whose only tasks
// are the 4 seeded demo tasks. The run deletes the tasks it creates but leaves one
// disabled user («کاربر Check …») per run, so it can be repeated on the same
// database. See README "Tests and checks" for a throwaway database.
//
// Usage (in frontend/): npm run check:browser
// Env: APP_URL, CHROME_PATH (Chrome binary), SHOTS_DIR (screenshots; default a temp folder).
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (typeof WebSocket === 'undefined') {
  console.error('This check needs Node 22 or newer (built-in WebSocket). Current: ' + process.version);
  process.exit(1);
}

const BASE = (process.env.APP_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const OUT = process.env.SHOTS_DIR ?? mkdtempSync(join(tmpdir(), 'taskboard-shots-'));
mkdirSync(OUT, { recursive: true });
const CHROME =
  process.env.CHROME_PATH ??
  {
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  }[process.platform] ??
  'google-chrome';
const PORT = 9333;
const TS = Date.now().toString().slice(-6);
const CREDS = {
  xuser: [null, 'Check-password-1'],
  owner: ['owner@taskboard.local', 'Owner@12345'],
  manager: ['manager@taskboard.local', 'Manager@12345'],
  member: ['member@taskboard.local', 'Member@12345'],
};

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Chrome + CDP plumbing ----------
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'taskboard-chrome-'))}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,900',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
chrome.on('error', () => {
  console.error(`Google Chrome did not start from ${CHROME}. Set CHROME_PATH to the Chrome binary.`);
  process.exit(1);
});
let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  await sleep(200);
  try {
    wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl;
  } catch {}
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 1;
const pending = new Map();
const listeners = new Map(); // sessionId -> fn(method, params)
ws.addEventListener('message', ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  } else if (msg.method && msg.sessionId && listeners.has(msg.sessionId)) {
    listeners.get(msg.sessionId)(msg.method, msg.params);
  }
});
function send(method, params = {}, sessionId) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const PRE = `
const vis = (e) => !!e && e.getClientRects().length > 0;
const root = () => document.querySelector('[role=dialog]') || document;
const norm = (s) => s.replace(/\\s+/g, ' ').trim();
const byText = (sel, t) => [...root().querySelectorAll(sel)].filter(vis).find((e) => norm(e.textContent) === t);
const anyText = (sel, t) => [...document.querySelectorAll(sel)].filter(vis).find((e) => norm(e.textContent) === t);
const ctl = (t) => {
  const l = [...root().querySelectorAll('label')].filter(vis).find((x) => norm(x.textContent) === t);
  if (!l) return null;
  return (l.htmlFor && document.getElementById(l.htmlFor)) || document.querySelector('[aria-labelledby~="' + l.id + '"]');
};
const bodyText = () => norm(document.body.innerText);
`;

async function newPage(role, width = 1280) {
  const { browserContextId } = await send('Target.createBrowserContext');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const errors = [];
  const network = [];
  listeners.set(sessionId, (method, p) => {
    if (method === 'Runtime.exceptionThrown') errors.push(`exception: ${p.exceptionDetails.exception?.description ?? p.exceptionDetails.text}`);
    if (method === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'warning')) {
      errors.push(`console.${p.type}: ${p.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300)}`);
    }
    if (method === 'Log.entryAdded' && p.entry.level === 'error') {
      (p.entry.source === 'network' ? network : errors).push(`${p.entry.source}: ${p.entry.text} ${p.entry.url ?? ''}`);
    }
  });
  await send('Runtime.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Log.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);

  const page = {
    role,
    errors,
    network,
    async eval(expr) {
      const r = await send(
        'Runtime.evaluate',
        { expression: `(async () => { ${PRE}; return (${expr}); })()`, awaitPromise: true, returnByValue: true },
        sessionId,
      );
      if (r.exceptionDetails) throw new Error(`eval failed: ${expr}\n${r.exceptionDetails.exception?.description}`);
      return r.result.value;
    },
    async waitFor(expr, ms = 10000) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        try {
          const v = await page.eval(expr);
          if (v) return v;
        } catch {}
        await sleep(150);
      }
      return null;
    },
    async goto(path) {
      await send('Page.navigate', { url: BASE + path }, sessionId);
      await sleep(300);
      await page.waitFor(`document.readyState === 'complete'`);
    },
    async click(finder) {
      const pos = await page.waitFor(
        `(() => { const el = ${finder}; if (!vis(el)) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`,
        6000,
      );
      if (!pos) throw new Error(`[${role}] not clickable: ${finder}`);
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', { type, x: pos.x, y: pos.y, button: 'left', clickCount: 1 }, sessionId);
      }
      await sleep(120);
    },
    async type(text) {
      await send('Input.insertText', { text }, sessionId);
      await sleep(60);
    },
    async fill(finder, text) {
      await page.click(finder);
      await page.eval(`(() => { const el = document.activeElement; el.select?.(); return true; })()`);
      await page.type(text);
    },
    async key(key) {
      const codes = { Enter: 13, Escape: 27 };
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: codes[key], text: key === 'Enter' ? '\r' : undefined }, sessionId);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: codes[key] }, sessionId);
      await sleep(120);
    },
    async select(label, option) {
      await page.click(`ctl(${JSON.stringify(label)})`);
      await page.click(`anyText('[role=option]', ${JSON.stringify(option)})`);
      await sleep(150);
    },
    async setDate(label, value) {
      await page.eval(`(() => { const el = ctl(${JSON.stringify(label)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    },
    async api(path, init = {}) {
      return page.eval(`fetch('/api/v1${path}', ${JSON.stringify({ credentials: 'same-origin', ...init })}).then(async (r) => ({ status: r.status, body: r.status === 204 ? null : await r.json() }))`);
    },
    async shot(name) {
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
      writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
    },
    async resize(width) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
      await sleep(300);
    },
  };
  return page;
}

async function login(page) {
  const [email, password] = CREDS[page.role];
  await page.goto('/login');
  await page.waitFor(`ctl('ایمیل')`);
  await page.fill(`ctl('ایمیل')`, email);
  await page.fill(`ctl('رمز عبور')`, password);
  await page.click(`byText('button', 'ورود')`);
  const ok = await page.waitFor(`location.pathname === '/tasks' && !!document.querySelector('h1')`, 15000);
  check(`[${page.role}] login lands on /tasks`, ok);
  return (await page.api('/auth/me')).body;
}

const boardReady = `!!document.querySelector('section[aria-labelledby^="column-"]') || bodyText().includes('هیچ کاری') || bodyText().includes('هنوز کاری')`;
const cardCount = `document.querySelectorAll('section[aria-labelledby^="column-"] ul > li').length`;
const msg = (t) => `!!document.querySelector('[role=status]') && [...document.querySelectorAll('[role=status]')].some((e) => e.textContent.includes(${JSON.stringify(t)}))`;

async function openCardMenu(page, title) {
  await page.click(`document.querySelector('button[aria-label="گزینه‌های کار «${title}»"]')`);
}

async function createTask(page, { title, status, priority, due, assignee, description }) {
  await page.click(`byText('button', 'کار جدید')`);
  await page.waitFor(`!!document.querySelector('[role=dialog] .ProseMirror')`);
  await page.fill(`ctl('عنوان')`, title);
  if (status) await page.select('وضعیت', status);
  if (priority) await page.select('اولویت', priority);
  if (due) await page.setDate('موعد (اختیاری)', due);
  if (assignee) await page.select('مسئول', assignee);
  if (description) await description();
  await page.click(`byText('button', 'ساخت کار')`);
  const ok = await page.waitFor(msg(`کار «${title}» ساخته شد`), 10000);
  await page.waitFor(`!document.querySelector('[role=dialog]')`, 3000);
  return ok;
}

let xuser;
let ownerTaskId; // created by owner, assigned to member (AS1 checks)
let privateTaskId; // created by owner, unassigned (member must not see it)
const titles = {
  rich: `Check کار کامل ${TS}`,
  priv: `Check کار خصوصی مالک ${TS}`,
  member: `Check کار عضو ${TS}`,
  manager: `Check کار مدیر ${TS}`,
};

try {
  // ======================= OWNER =======================
  const owner = await newPage('owner');
  const ownerMe = await login(owner);
  await owner.waitFor(boardReady);
  check('[owner] board has 3 <section> columns with h2 + list/empty text', await owner.eval(`[...document.querySelectorAll('section[aria-labelledby^="column-"]')].filter((s) => s.querySelector('h2') && (s.querySelector('ul') || s.querySelector('p'))).length === 3`));
  const seed = (await owner.api('/todos')).body;
  const SEED_TITLES = ['طراحی صفحه ورود', 'نوشتن تست‌های دسترسی', 'یادداشت شخصی عضو تیم', 'بازبینی نقش کاربران'];
  check('[owner] fresh seed: exactly the 4 demo tasks', seed.length === 4 && SEED_TITLES.every((t) => seed.some((x) => x.title === t)), seed.map((x) => x.title).join(' | '));
  const reviewTaskId = seed.find((x) => x.title === 'بازبینی نقش کاربران')?.id;
  check('[owner] board shows the 4 seeded cards', (await owner.waitFor(`${cardCount} === 4`)) === true);
  // Keyboard: Enter on the trigger opens the dialog with focus inside; Escape closes it and returns focus.
  await owner.eval(`(byText('button', 'کار جدید').focus(), true)`);
  await owner.key('Enter');
  check('[owner] keyboard: Enter opens dialog, focus moves inside', await owner.waitFor(`!!document.querySelector('[role=dialog]') && document.querySelector('[role=dialog]').contains(document.activeElement)`, 3000));
  await owner.key('Escape');
  check('[owner] keyboard: Escape closes dialog, focus returns to trigger', await owner.waitFor(`!document.querySelector('[role=dialog]') && norm(document.activeElement?.textContent ?? '') === 'کار جدید'`, 3000), await owner.eval(`document.activeElement?.outerHTML.slice(0, 80)`));
  check('[owner] nav shows کاربران link', await owner.eval(`!!anyText('nav a', 'کاربران')`));

  // Create a rich task: in progress, high, due date, assigned to the member, formatted description with a link.
  const created = await createTask(owner, {
    title: titles.rich,
    status: 'در حال انجام',
    priority: 'زیاد',
    due: '2026-10-20',
    assignee: 'عضو تیم',
    description: async () => {
      await owner.click(`document.querySelector('[role=dialog] .ProseMirror')`);
      await owner.type('سلام، این توضیح است. ');
      await owner.click(`document.querySelector('[role=dialog] button[aria-label="پررنگ"]')`);
      await owner.type('متن پررنگ');
      await owner.click(`document.querySelector('[role=dialog] button[aria-label="پررنگ"]')`);
      await owner.type(' و پیوند: ');
      await owner.click(`document.querySelector('[role=dialog] button[aria-label="پیوند"]')`);
      await owner.fill(`ctl('نشانی پیوند')`, 'javascript:alert(1)');
      await owner.key('Enter');
      check('[owner] editor refuses a javascript: link', await owner.waitFor(`bodyText().includes('فقط نشانی‌هایی که با http')`, 3000));
      await owner.fill(`ctl('نشانی پیوند')`, 'example.com/docs');
      await owner.key('Enter');
    },
  });
  check('[owner] create dialog saves and announces', created);
  await owner.waitFor(`${cardCount} > 0`);
  const list = (await owner.api('/todos')).body;
  const rich = list.find((t) => t.title === titles.rich);
  ownerTaskId = rich?.id;
  check('[owner] task stored with status/priority/due/assignee', rich && rich.status === 'in_progress' && rich.priority === 'high' && rich.dueDate === '2026-10-20' && rich.assignee?.name === 'عضو تیم', JSON.stringify(rich && { s: rich.status, p: rich.priority, d: rich.dueDate, a: rich.assignee?.name }));
  const linkMarks = JSON.stringify(rich?.description ?? {}).match(/"type":"link","attrs":\{[^}]*\}/g) ?? [];
  check('[owner] stored link mark has only href=https://example.com/docs', linkMarks.length === 1 && linkMarks[0] === '"type":"link","attrs":{"href":"https://example.com/docs"}', linkMarks.join(' '));
  check('[owner] stored description has bold mark', JSON.stringify(rich?.description ?? {}).includes('"type":"bold"'));
  check('[owner] card is in the "در حال انجام" column', await owner.eval(`[...document.querySelectorAll('#column-in_progress ~ ul li, section[aria-labelledby="column-in_progress"] li')].some((li) => li.textContent.includes(${JSON.stringify(titles.rich)}))`));
  await owner.shot('owner-board-1280');

  // Editor → viewer round trip on the detail page.
  await owner.click(`anyText('a', ${JSON.stringify(titles.rich)})`);
  await owner.waitFor(`location.pathname.startsWith('/tasks/') && !!document.querySelector('.tiptap-content a')`, 10000);
  const viewer = await owner.eval(`(() => { const a = document.querySelector('.tiptap-content a'); return { href: a?.getAttribute('href'), rel: a?.getAttribute('rel'), target: a?.getAttribute('target'), strong: !!document.querySelector('.tiptap-content strong'), editable: document.querySelector('.tiptap-content .ProseMirror')?.getAttribute('contenteditable'), h1: document.querySelector('h1')?.textContent, text: document.querySelector('.tiptap-content').textContent }; })()`);
  check('[owner] viewer renders link with rel=noopener noreferrer nofollow, target=_blank', viewer.href === 'https://example.com/docs' && viewer.rel === 'noopener noreferrer nofollow' && viewer.target === '_blank', JSON.stringify(viewer));
  check('[owner] viewer renders bold and text, read-only', viewer.strong && viewer.editable === 'false' && viewer.text.includes('متن پررنگ'));
  check('[owner] detail shows Jalali due date', await owner.eval(`bodyText().includes('۲۸ مهر ۱۴۰۵')`));
  await owner.shot('owner-detail-1280');
  await owner.resize(390);
  await owner.shot('owner-detail-390');
  check('[owner] detail has no horizontal scroll at 390px', await owner.eval(`document.documentElement.scrollWidth <= window.innerWidth`));
  await owner.resize(1280);

  // Edit: change title through the card menu.
  await owner.goto('/tasks');
  await owner.waitFor(boardReady);
  await openCardMenu(owner, titles.rich);
  await owner.click(`anyText('[role=menuitem]', 'ویرایش')`);
  await owner.waitFor(`!!document.querySelector('[role=dialog] .ProseMirror')`);
  check('[owner] edit dialog loads the description into the editor', await owner.eval(`document.querySelector('[role=dialog] .ProseMirror a')?.getAttribute('href') === 'https://example.com/docs'`));
  titles.rich += ' ویرایش‌شده';
  await owner.fill(`ctl('عنوان')`, titles.rich);
  await owner.click(`byText('button', 'ذخیرهٔ تغییرات')`);
  check('[owner] edit saves and announces', await owner.waitFor(msg(`تغییرات کار «${titles.rich}» ذخیره شد`)));
  await owner.waitFor(`!document.querySelector('[role=dialog]')`, 3000);
  check('[owner] edited title is on the board', await owner.waitFor(`!!anyText('a', ${JSON.stringify(titles.rich)})`));

  // Empty-title validation stays client-side and focuses the field.
  await owner.click(`byText('button', 'کار جدید')`);
  await owner.waitFor(`!!document.querySelector('[role=dialog] .ProseMirror')`);
  await owner.click(`byText('button', 'ساخت کار')`);
  check('[owner] empty title shows field error and focuses title', await owner.waitFor(`bodyText().includes('عنوان کار را وارد کنید.') && document.activeElement === ctl('عنوان')`, 3000));
  await owner.click(`byText('button', 'انصراف')`);
  await owner.waitFor(`!document.querySelector('[role=dialog]')`);

  // A private owner task (unassigned) the member must never see.
  check('[owner] second task created', await createTask(owner, { title: titles.priv }));
  privateTaskId = (await owner.api('/todos')).body.find((t) => t.title === titles.priv)?.id;

  // Filters in the URL; reload keeps them; back undoes them.
  await owner.select('وضعیت', 'در حال انجام');
  check('[owner] status filter writes ?status=in_progress', await owner.waitFor(`location.search === '?status=in_progress'`));
  await owner.waitFor(`document.querySelectorAll('section[aria-labelledby^="column-"]').length === 1`);
  await owner.select('مسئول', 'عضو تیم');
  const memberId = (await owner.api('/todos')).body.find((t) => t.id === ownerTaskId)?.assignee?.id;
  check('[owner] assignee filter writes assigneeId', await owner.waitFor(`location.search === '?status=in_progress&assigneeId=${memberId}'`), await owner.eval('location.search'));
  await owner.waitFor(boardReady);
  const apiFiltered = (await owner.api(`/todos?status=in_progress&assigneeId=${memberId}`)).body.length;
  await owner.waitFor(`${cardCount} === ${apiFiltered}`);
  check('[owner] filtered board matches API count', (await owner.eval(cardCount)) === apiFiltered, `ui=${await owner.eval(cardCount)} api=${apiFiltered}`);
  await owner.goto(`/tasks?status=in_progress&assigneeId=${memberId}`);
  await owner.waitFor(boardReady);
  await owner.waitFor(`${cardCount} === ${apiFiltered}`);
  check('[owner] reload keeps filters (URL, selects, cards)', (await owner.eval(`location.search === '?status=in_progress&assigneeId=${memberId}' && ctl('وضعیت').textContent.includes('در حال انجام') && ctl('مسئول').textContent.includes('عضو تیم')`)) && (await owner.eval(cardCount)) === apiFiltered);
  await owner.eval(`(history.back(), true)`);
  check('[owner] back button returns to the previous filter', await owner.waitFor(`location.search === '?status=in_progress'`, 5000), await owner.eval('location.search'));
  await owner.goto(`/tasks?assigneeId=00000000-0000-4000-8000-000000000000`);
  check('[owner] no-match state with clear-filters button', await owner.waitFor(`bodyText().includes('هیچ کاری با این فیلترها پیدا نشد.')`));
  await owner.click(`byText('[role=status] button', 'پاک کردن فیلترها')`);
  check('[owner] clear filters returns to /tasks with all columns', await owner.waitFor(`location.search === '' && document.querySelectorAll('section[aria-labelledby^="column-"]').length === 3`));
  await owner.goto('/tasks?status=bogus&assigneeId=nope');
  check('[owner] junk filter values in the URL are ignored (no error state)', await owner.waitFor(`document.querySelectorAll('section[aria-labelledby^="column-"]').length === 3`));
  await owner.resize(390);
  await owner.goto('/tasks');
  await owner.waitFor(boardReady);
  await owner.shot('owner-board-390');
  check('[owner] board has no horizontal scroll at 390px', await owner.eval(`document.documentElement.scrollWidth <= window.innerWidth`));
  await owner.resize(1280);

  // ---------- Users page (owner) ----------
  await owner.goto('/users');
  check('[owner] users table loads with emails isolated LTR', await owner.waitFor(`!!document.querySelector('table') && [...document.querySelectorAll('td bdi[dir=ltr]')].some((b) => b.textContent === 'owner@taskboard.local')`));
  await owner.click(`byText('button', 'کاربر جدید')`);
  await owner.waitFor(`!!ctl('ایمیل')`);
  await owner.fill(`ctl('نام')`, `کاربر Check ${TS}`);
  await owner.fill(`ctl('ایمیل')`, 'member@taskboard.local');
  await owner.fill(`ctl('رمز عبور')`, 'Check-password-1');
  await owner.click(`byText('button', 'ساخت کاربر')`);
  check('[owner] duplicate email → 409 shown under the email field', await owner.waitFor(`bodyText().includes('این ایمیل قبلاً برای کاربر دیگری ثبت شده است.')`));
  await owner.fill(`ctl('ایمیل')`, 'a@b');
  await owner.click(`byText('button', 'ساخت کاربر')`);
  check('[owner] server field error (invalid email) shown under the field', await owner.waitFor(`bodyText().includes('یک ایمیل معتبر وارد کنید.')`));
  const newEmail = `check-${TS}@taskboard.local`;
  await owner.fill(`ctl('ایمیل')`, newEmail);
  await owner.select('نقش', 'مدیر');
  await owner.click(`byText('button', 'ساخت کاربر')`);
  check('[owner] user created and announced', await owner.waitFor(msg(`کاربر «کاربر Check ${TS}» ساخته شد`)));
  await owner.waitFor(`!document.querySelector('[role=dialog]')`, 3000);
  await owner.click(`document.querySelector('button[aria-label="گزینه‌های کاربر «کاربر Check ${TS}»"]')`);
  await owner.click(`anyText('[role=menuitem]', 'ویرایش')`);
  await owner.waitFor(`!!ctl('نام')`);
  await owner.select('نقش', 'عضو');
  await owner.click(`byText('button', 'ذخیرهٔ تغییرات')`);
  check('[owner] role change saved', await owner.waitFor(msg(`تغییرات «کاربر Check ${TS}» ذخیره شد`)));
  await owner.waitFor(`!document.querySelector('[role=dialog]')`, 3000);
  await owner.click(`document.querySelector('button[aria-label="گزینه‌های کاربر «کاربر Check ${TS}»"]')`);
  await owner.click(`anyText('[role=menuitem]', 'غیرفعال کردن')`);
  await owner.click(`byText('button', 'غیرفعال کردن')`);
  check('[owner] disable via Menu + confirm dialog', await owner.waitFor(msg(`«کاربر Check ${TS}» غیرفعال شد`)));
  await owner.waitFor(`!document.querySelector('[role=dialog]')`, 3000);
  const s6User = (await owner.api('/users')).body.find((u) => u.email === newEmail);
  check('[owner] backend shows the user disabled, role member', s6User && !s6User.isActive && s6User.role === 'member');
  await owner.click(`document.querySelector('button[aria-label="گزینه‌های کاربر «کاربر Check ${TS}»"]')`);
  await owner.click(`anyText('[role=menuitem]', 'فعال کردن')`);
  check('[owner] enable via Menu', await owner.waitFor(msg(`«کاربر Check ${TS}» فعال شد`)));
  CREDS.xuser[0] = newEmail;
  xuser = await newPage('xuser');
  await login(xuser);
  check('[xuser] new member session works', (await xuser.api('/auth/me')).status === 200);
  await owner.click(`document.querySelector('button[aria-label="گزینه‌های کاربر «کاربر Check ${TS}»"]')`);
  await owner.click(`anyText('[role=menuitem]', 'غیرفعال کردن')`);
  await owner.click(`byText('button', 'غیرفعال کردن')`);
  await owner.waitFor(msg(`«کاربر Check ${TS}» غیرفعال شد`));
  await owner.waitFor(`!document.querySelector('[role=dialog]')`, 3000);
  check('[xuser] after disable: old access token → 401', (await xuser.api('/auth/me')).status === 401);
  check('[xuser] after disable: refresh → 401', (await xuser.api('/auth/refresh', { method: 'POST' })).status === 401);
  await xuser.goto('/tasks');
  check('[xuser] after disable: page lands on /login', await xuser.waitFor(`location.pathname === '/login'`, 10000), await xuser.eval('location.href'));
  await xuser.waitFor(`ctl('ایمیل')`);
  await xuser.fill(`ctl('ایمیل')`, newEmail);
  await xuser.fill(`ctl('رمز عبور')`, 'Check-password-1');
  await xuser.click(`byText('button', 'ورود')`);
  check('[xuser] disabled account: generic login error', await xuser.waitFor(`bodyText().includes('ایمیل یا رمز عبور درست نیست.')`, 5000));

  const activeOwners = (await owner.api('/users')).body.filter((u) => u.role === 'owner' && u.isActive);
  if (activeOwners.length === 1) {
    await owner.click(`document.querySelector('button[aria-label="گزینه‌های کاربر «${ownerMe.name}»"]')`);
    await owner.click(`anyText('[role=menuitem]', 'غیرفعال کردن')`);
    await owner.click(`byText('button', 'غیرفعال کردن')`);
    check('[owner] disabling the last owner → 409 message in dialog', await owner.waitFor(`bodyText().includes('این کاربر آخرین مالک فعال است و نمی‌توان او را غیرفعال کرد.')`));
    await owner.click(`byText('button', 'انصراف')`);
    await owner.waitFor(`!document.querySelector('[role=dialog]')`);
    await owner.click(`document.querySelector('button[aria-label="گزینه‌های کاربر «${ownerMe.name}»"]')`);
    await owner.click(`anyText('[role=menuitem]', 'ویرایش')`);
    await owner.select('نقش', 'عضو');
    await owner.click(`byText('button', 'ذخیرهٔ تغییرات')`);
    check('[owner] demoting the last owner → 409 message in form', await owner.waitFor(`bodyText().includes('این کاربر آخرین مالک فعال است. نقش او را')`));
    await owner.click(`byText('button', 'انصراف')`);
  } else {
    check('[owner] last-owner 409 (skipped: more than one active owner)', true, `${activeOwners.length} active owners`);
  }
  await owner.shot('owner-users-1280');
  await owner.resize(390);
  await owner.shot('owner-users-390');
  await owner.resize(1280);

  // ======================= MANAGER =======================
  const manager = await newPage('manager');
  await login(manager);
  await manager.waitFor(boardReady);
  const allCount = (await owner.api('/todos')).body.length;
  await manager.waitFor(`${cardCount} === ${allCount}`);
  check('[manager] sees all tasks', (await manager.eval(cardCount)) === allCount, `ui=${await manager.eval(cardCount)} all=${allCount}`);
  check('[manager] nav has no کاربران link', await manager.eval(`!anyText('nav a', 'کاربران')`));
  check('[manager] creates a task assigned to the member', await createTask(manager, { title: titles.manager, assignee: 'عضو تیم' }));
  await openCardMenu(manager, titles.priv);
  check('[manager] delete is offered on a task someone else created', await manager.waitFor(`!!anyText('[role=menuitem]', 'حذف')`, 3000));
  await manager.key('Escape');
  await manager.goto('/users');
  check('[manager] /users shows the forbidden state', await manager.waitFor(`bodyText().includes('به این صفحه دسترسی ندارید.')`));
  check('[manager] GET /users → 403 from the backend', (await manager.api('/users')).status === 403);
  const memberUserId = seed.find((x) => x.title === 'یادداشت شخصی عضو تیم')?.createdBy.id;
  check('[manager] PATCH /users/:id → 403', (await manager.api(`/users/${memberUserId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'owner' }) })).status === 403);

  // ======================= MEMBER =======================
  const member = await newPage('member');
  const memberMe = await login(member);
  await member.waitFor(boardReady);
  const memberApi = (await member.api('/todos')).body;
  await member.waitFor(`${cardCount} === ${memberApi.length}`);
  check('[member] board count equals API count', (await member.eval(cardCount)) === memberApi.length, `ui=${await member.eval(cardCount)} api=${memberApi.length}`);
  check('[member] every visible task is created by or assigned to the member', memberApi.every((t) => t.createdBy.id === memberMe.id || t.assignee?.id === memberMe.id));
  const seededSeen = memberApi.filter((t) => SEED_TITLES.includes(t.title)).map((t) => t.title).sort();
  check('[member] sees exactly 3 of the 4 seeded tasks (not بازبینی نقش کاربران)', JSON.stringify(seededSeen) === JSON.stringify(SEED_TITLES.filter((t) => t !== 'بازبینی نقش کاربران').sort()), seededSeen.join(' | '));
  await openCardMenu(member, 'نوشتن تست‌های دسترسی');
  check('[member] seeded manager task: edit offered, delete not', await member.waitFor(`!!anyText('[role=menuitem]', 'ویرایش') && !anyText('[role=menuitem]', 'حذف')`, 3000));
  await member.click(`anyText('[role=menuitem]', 'ویرایش')`);
  await member.waitFor(`!!document.querySelector('[role=dialog] .ProseMirror')`);
  check('[member] seeded manager task: assignee locked', await member.eval(`ctl('مسئول').hasAttribute('disabled') || ctl('مسئول').getAttribute('aria-disabled') === 'true'`));
  await member.click(`byText('button', 'انصراف')`);
  await member.waitFor(`!document.querySelector('[role=dialog]')`);
  await member.goto(`/tasks/${reviewTaskId}`);
  check('[member] seeded owner task URL → "not found"', await member.waitFor(`bodyText().includes('این کار پیدا نشد.')`));
  await member.goto('/tasks');
  await member.waitFor(boardReady);
  const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  check('[member] API: POST /users → 403', (await member.api('/users', json('POST', { email: `x-${TS}@taskboard.local`, name: 'x', password: 'password-123', role: 'owner' }))).status === 403);
  check('[member] API: PATCH /users/:id (self → owner) → 403', (await member.api(`/users/${memberMe.id}`, json('PATCH', { role: 'owner' }))).status === 403);
  check('[member] API: PATCH invisible task → 404', (await member.api(`/todos/${reviewTaskId}`, json('PATCH', { title: 'hacked' }))).status === 404);
  check('[member] API: DELETE invisible task → 404', (await member.api(`/todos/${reviewTaskId}`, { method: 'DELETE' })).status === 404);
  check('[member] API: create task assigned to the manager → 403', (await member.api('/todos', json('POST', { title: 'x', assigneeId: seed.find((x) => x.title === 'بازبینی نقش کاربران')?.assignee?.id }))).status === 403);
  check('[member] API: filter cannot widen visibility', (await member.api(`/todos?assigneeId=${seed.find((x) => x.title === 'بازبینی نقش کاربران')?.assignee?.id}`)).body.length === 0);
  check('[member] private owner task absent from board', !(await member.eval(`!!anyText('a', ${JSON.stringify(titles.priv)})`)));
  check('[member] nav has no کاربران link', await member.eval(`!anyText('nav a', 'کاربران')`));
  await member.click(`ctl('مسئول')`);
  const memberFilterOpts = await member.eval(`[...document.querySelectorAll('[role=option]')].map((o) => o.textContent.trim())`);
  check('[member] assignee filter offers all / unassigned / me only', JSON.stringify(memberFilterOpts) === JSON.stringify(['همهٔ افراد', 'بدون مسئول', 'عضو تیم (من)']), JSON.stringify(memberFilterOpts));
  await member.key('Escape');

  // Create: assignee options are only nobody / self.
  await member.click(`byText('button', 'کار جدید')`);
  await member.waitFor(`!!document.querySelector('[role=dialog] .ProseMirror')`);
  await member.click(`ctl('مسئول')`);
  const memberAssignOpts = await member.eval(`[...document.querySelectorAll('[role=option]')].map((o) => o.textContent.trim())`);
  check('[member] create: assignee options are nobody + self only', JSON.stringify(memberAssignOpts) === JSON.stringify(['بدون مسئول', 'عضو تیم (من)']), JSON.stringify(memberAssignOpts));
  await member.click(`anyText('[role=option]', 'عضو تیم (من)')`);
  await member.fill(`ctl('عنوان')`, titles.member);
  await member.click(`byText('button', 'ساخت کار')`);
  check('[member] creates a task assigned to self', await member.waitFor(msg(`کار «${titles.member}» ساخته شد`)));
  await member.waitFor(`!document.querySelector('[role=dialog]')`, 3000);

  // Task created by the owner and assigned to the member: edit allowed (AS1), assignee locked, no delete.
  await openCardMenu(member, titles.rich);
  check('[member] no delete on a task created by someone else', await member.waitFor(`!!anyText('[role=menuitem]', 'ویرایش') && !anyText('[role=menuitem]', 'حذف')`, 3000));
  await member.click(`anyText('[role=menuitem]', 'ویرایش')`);
  await member.waitFor(`!!document.querySelector('[role=dialog] .ProseMirror')`);
  check('[member] assignee locked with hint on a task they did not create', await member.eval(`ctl('مسئول').hasAttribute('disabled') || ctl('مسئول').getAttribute('aria-disabled') === 'true'`) && (await member.eval(`bodyText().includes('مسئول را فقط سازندهٔ کار می‌تواند تغییر دهد.')`)));
  await member.select('وضعیت', 'انجام‌شده');
  await member.click(`byText('button', 'ذخیرهٔ تغییرات')`);
  check('[member] may change status of a task assigned to them (AS1)', await member.waitFor(msg(`تغییرات کار «${titles.rich}» ذخیره شد`)));
  await member.waitFor(`!document.querySelector('[role=dialog]')`, 3000);
  check('[member] own task shows delete in its menu', await (async () => {
    await openCardMenu(member, titles.member);
    const ok = await member.waitFor(`!!anyText('[role=menuitem]', 'حذف')`, 3000);
    await member.key('Escape');
    return ok;
  })());

  // Not visible / not a uuid → "not found", no leak.
  await member.goto(`/tasks/${privateTaskId}`);
  check('[member] invisible task id → "not found" page', await member.waitFor(`bodyText().includes('این کار پیدا نشد.')`) && !(await member.eval(`bodyText().includes(${JSON.stringify(titles.priv)})`)));
  check('[member] backend answers 404 for that id', (await member.api(`/todos/${privateTaskId}`)).status === 404);
  await member.goto('/tasks/not-a-uuid');
  check('[member] malformed id → "not found" page', await member.waitFor(`bodyText().includes('این کار پیدا نشد.')`));
  await member.goto('/users');
  check('[member] /users shows the forbidden state', await member.waitFor(`bodyText().includes('به این صفحه دسترسی ندارید.')`));
  await member.shot('member-users-forbidden');
  await member.goto('/tasks');
  await member.waitFor(boardReady);
  await member.shot('member-board-1280');

  // Delete own task from the board.
  await openCardMenu(member, titles.member);
  await member.click(`anyText('[role=menuitem]', 'حذف')`);
  check('[member] delete dialog names the task', await member.waitFor(`!!document.querySelector('[role=dialog]') && bodyText().includes('برای همیشه حذف می‌شود')`));
  await member.shot('member-delete-dialog');
  await member.click(`byText('button', 'حذف کار')`);
  check('[member] delete removes the card and announces', await member.waitFor(msg(`کار «${titles.member}» حذف شد`)) && (await member.waitFor(`!anyText('a', ${JSON.stringify(titles.member)})`)));

  // ======================= OWNER cleanup via the UI =======================
  await owner.goto('/tasks');
  await owner.waitFor(boardReady);
  for (const t of [titles.rich, titles.priv, titles.manager]) {
    await openCardMenu(owner, t);
    await owner.click(`anyText('[role=menuitem]', 'حذف')`);
    await owner.click(`byText('button', 'حذف کار')`);
    check(`[owner] deleted "${t}"`, await owner.waitFor(msg(`کار «${t}» حذف شد`)));
    await owner.waitFor(`!document.querySelector('[role=dialog]')`, 3000);
  }

  await member.click(`byText('button', 'خروج')`);
  check('[member] logout (خروج) → /login', await member.waitFor(`location.pathname === '/login'`, 8000));
  check('[member] after logout: /auth/me → 401', (await member.api('/auth/me')).status === 401);
  await member.goto('/tasks');
  check('[member] after logout: /tasks redirects to /login', await member.waitFor(`location.pathname === '/login'`, 8000));

  for (const p of [owner, manager, member, xuser]) {
    check(`[${p.role}] no console errors / exceptions`, p.errors.length === 0, p.errors.slice(0, 5).join(' | '));
    console.log(`  [${p.role}] network errors (expected 4xx from probes): ${p.network.length}`);
    for (const n of p.network) console.log(`    ${n}`);
  }
} catch (err) {
  check('script ran to the end', false, err.message);
} finally {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  console.log(`Screenshots: ${OUT}`);
  ws.close();
  chrome.kill();
  process.exit(failed.length ? 1 : 0);
}
