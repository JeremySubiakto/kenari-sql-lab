// Small driver for testing the site in its own private headless Chrome, with no dependencies.
//
//   import { launch, BASE, sleep } from './cdp.mjs';
//   const b = await launch(); const p = await b.page();
//   await p.viewport(1366, 625);
//   await p.go(BASE + '/index.html#/m/1.1', 2500);
//   await p.click('Run');
//   console.log(await p.shot('mission'), p.errors);   // screenshots go to OUT, read them to see the page
//   await b.close();
//
// viewport(w, h, {mobile:true}) emulates a phone with touch. blockFonts() simulates a blocked font host.
// media([{name:'prefers-color-scheme',value:'dark'}]) and media([{name:'prefers-reduced-motion',value:'reduce'}]) emulate settings.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const BASE = process.env.KENARI_BASE || 'http://localhost:8765/kenari-sql-lab';
export const OUT = process.env.KENARI_SHOTS || join(tmpdir(), 'kenari-shots');
mkdirSync(OUT, { recursive: true });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  const dir = mkdtempSync(join(tmpdir(), 'kenari-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  const portFile = join(dir, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await sleep(100);
  const [port, path] = readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    else listeners.forEach((l) => l(m));
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
  });
  return {
    send, on: (fn) => listeners.push(fn),
    async page() { return newPage(this); },
    async close() { try { await send('Browser.close'); } catch {} ws.close(); proc.kill(); await sleep(200); try { rmSync(dir, { recursive: true, force: true }); } catch {} },
  };
}

async function newPage(b) {
  const { targetId } = await b.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => b.send(m, p, sessionId);
  await s('Page.enable'); await s('Runtime.enable'); await s('Network.enable'); await s('Log.enable');
  const errors = []; const requests = [];
  b.on((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
    if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
  });
  let touch = false;
  const page = {
    s, errors, requests,
    async viewport(width, height, { mobile = false, dpr = 1 } = {}) {
      touch = mobile;
      await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
      await s('Emulation.setTouchEmulationEnabled', mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    },
    async blockFonts() { await s('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*'] }); await s('Network.setCacheDisabled', { cacheDisabled: true }); },
    async windows() { await s('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', platform: 'Win32' }); },
    async android() { await s('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A156E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', platform: 'Linux armv8l' }); },
    async media(features) { await s('Emulation.setEmulatedMedia', { features }); },
    async go(url, wait = 1500) {
      await s('Page.navigate', { url });
      await sleep(wait);
    },
    async ev(expr) {
      const r = await s('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async shot(name, { full = false } = {}) {
      const params = { format: 'png', captureBeyondViewport: full };
      if (full) {
        const m = await s('Page.getLayoutMetrics');
        const { width, height } = m.cssContentSize;
        params.clip = { x: 0, y: 0, width, height: Math.min(height, 8000), scale: 1 };
      }
      const { data } = await s('Page.captureScreenshot', params);
      const f = join(OUT, `${name}.png`);
      writeFileSync(f, Buffer.from(data, 'base64'));
      return f;
    },
    // Find the visible element whose text or aria-label matches; scroll it in view; return centre.
    async locate(q, { selector = 'button,a,[role=button],summary,input,textarea', exact = false, nth = 0 } = {}) {
      return page.ev(`(() => {
        const q = ${JSON.stringify(q)}; const exact = ${exact}; const nth = ${nth};
        const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
        const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
        const match = (el) => { const t = norm(el.innerText || el.textContent); const a = norm(el.getAttribute('aria-label')); const n = norm(q); return exact ? (t === n || a === n) : (t.includes(n) || a.includes(n)); };
        const all = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((el) => vis(el) && match(el));
        const el = all[nth]; if (!el) return null;
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top, bottom: r.bottom, text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 60), count: all.length };
      })()`);
    },
    async clickAt(x, y) {
      if (touch) {
        await s('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await sleep(40);
        await s('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await s('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await s('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      }
    },
    async click(q, opts) {
      const p = await page.locate(q, opts);
      if (!p) throw new Error('not found: ' + q);
      await page.clickAt(p.x, p.y);
      return p;
    },
    async type(text) {
      for (const ch of text) {
        await s('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, unmodifiedText: ch, key: ch });
        await s('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
        await sleep(15);
      }
    },
    async key(key, { modifiers = 0, code, vk } = {}) {
      const map = { Enter: [13, 'Enter', '\r'], Tab: [9, 'Tab'], Escape: [27, 'Escape'], Backspace: [8, 'Backspace'], ArrowDown: [40, 'ArrowDown'], ArrowUp: [38, 'ArrowUp'], a: [65, 'KeyA'] };
      const [v, c, text] = map[key] || [vk || 0, code || key];
      const useText = text && !modifiers;
      await s('Input.dispatchKeyEvent', { type: useText ? 'keyDown' : 'rawKeyDown', key, code: c, windowsVirtualKeyCode: v, nativeVirtualKeyCode: v, modifiers, ...(useText ? { text, unmodifiedText: text } : {}) });
      await s('Input.dispatchKeyEvent', { type: 'keyUp', key, code: c, windowsVirtualKeyCode: v, nativeVirtualKeyCode: v, modifiers });
    },
    focusInfo() {
      return page.ev(`(() => { const a = document.activeElement; if (!a) return null; const r = a.getBoundingClientRect(); return { tag: a.tagName, text: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 50), top: r.top, bottom: r.bottom, vh: innerHeight }; })()`);
    },
    scrollInfo() { return page.ev(`({ y: scrollY, doc: document.documentElement.scrollHeight, vh: innerHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })`); },
  };
  return page;
}
