// Drives tests/editor.html with real key and mouse events in a private headless Chrome.
//   KENARI_SHOTS=/tmp/kenari-shots node --no-warnings tests/editor-drive.mjs [desktop|phone|align|shots]
import { launch, BASE, sleep } from '../scripts/dev/cdp.mjs';

const URL_ = BASE + '/tests/editor.html';
const which = process.argv[2] || 'all';
let pass = 0, fail = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
};
const CTRL = 2, META = 4, SHIFT = 8;

function helpers(p) {
  const h = {
    val: (e) => p.ev(`eds.${e}.value`),
    set: (e, v) => p.ev(`(eds.${e}.value = ${JSON.stringify(v)}, void 0)`),
    sel: (e) => p.ev(`(() => { const t = eds.${e}.textarea; return [t.selectionStart, t.selectionEnd, t.value.slice(t.selectionStart, t.selectionEnd)]; })()`),
    focused: (e) => p.ev(`document.activeElement === eds.${e}.textarea`),
    ac: () => p.ev(`[...document.querySelectorAll('.ed-ac')].filter((b) => !b.hidden).map((b) => [...b.querySelectorAll('.ed-ac-i code')].map((c) => c.textContent))[0] || null`),
    acRect: () => p.ev(`(() => { const b = [...document.querySelectorAll('.ed-ac')].find((x) => !x.hidden); if (!b) return null; const r = b.getBoundingClientRect(); return {left:r.left, top:r.top, right:r.right, bottom:r.bottom}; })()`),
    onBlank: (e) => p.ev(`(() => { const b = eds.${e}.el.querySelector('.t-blank.on'); return b ? Number(b.dataset.blank) : -1; })()`),
    /* Click a text offset through the grid, like a person pointing at it. */
    clickOffset: async (e, off) => {
      const r = await p.ev(`(() => { const ed = eds.${e}, t = ed.textarea, s = t.selectionStart, en = t.selectionEnd; t.setSelectionRange(${off}, ${off}); const c = ed.caretRect(); t.setSelectionRange(s, en); return {x: c.left + 3, y: c.top + 10}; })()`);
      await p.ev(`eds.${e}.el.scrollIntoView({block:'center'})`);
      const r2 = await p.ev(`(() => { const ed = eds.${e}, t = ed.textarea, s = t.selectionStart, en = t.selectionEnd; t.setSelectionRange(${off}, ${off}); const c = ed.caretRect(); t.setSelectionRange(s, en); return {x: c.left + 3, y: c.top + 10}; })()`);
      await p.clickAt(r2.x, r2.y);
      await sleep(40);
    },
    focusAt: async (e, off) => { await p.ev(`(eds.${e}.textarea.focus({preventScroll:true}), eds.${e}.textarea.setSelectionRange(${off}, ${off}), void 0)`); await sleep(30); },
    undo: async () => {
      await p.s('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: META, commands: ['undo'] });
      await p.s('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: META });
      await sleep(30);
    },
    keyEnd: async () => { await p.s('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35, commands: ['moveToEndOfLine'] }); await p.s('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 }); await sleep(30); },
    /* Screenshot with only the highlight text, then only the textarea text, in one color, and count differing pixels. */
    alignDiff: async (name) => {
      const clipR = await p.ev(`(() => { eds.${name}.el.scrollIntoView({block:'center'}); const r = eds.${name}.el.getBoundingClientRect(); return {x: Math.max(0, r.left) + scrollX, y: Math.max(0, r.top) + scrollY, width: Math.min(r.width, innerWidth), height: Math.min(r.height, innerHeight - Math.max(0, r.top))}; })()`);
      const clip = { ...clipR, scale: 1 };
      const shot = async (css) => {
        await p.ev(`(() => { let s = document.getElementById('__dbg'); if (!s) { s = document.createElement('style'); s.id = '__dbg'; document.head.append(s); } s.textContent = ${JSON.stringify(css)}; })()`);
        await sleep(60);
        const { data } = await p.s('Page.captureScreenshot', { format: 'png', clip });
        return data;
      };
      const common = '.ed-cur,.ed::after,.ed::before{display:none!important}.ed-ta{caret-color:transparent!important}.ed-ta::selection{background:transparent!important}.ed-hl *{animation:none!important}';
      const a = await shot(common + '.ed-ta{visibility:hidden}.ed-hl,.ed-hl *{color:#fff!important;background:none!important;box-shadow:none!important;-webkit-text-stroke:0!important;text-decoration:none!important}');
      const b = await shot(common + '.ed-hl{visibility:hidden}.ed-ta{color:#fff!important;-webkit-text-fill-color:#fff!important}');
      await p.ev(`document.getElementById('__dbg').remove()`);
      return p.ev(`(async () => {
        const load = async (d) => { const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
        const A = await load(${JSON.stringify(a)}), B = await load(${JSON.stringify(b)});
        let diff = 0, inked = 0;
        for (let i = 0; i < A.length; i += 4) { if (Math.abs(A[i] - B[i]) > 70) diff++; if (A[i] > 180) inked++; }
        return { diff, inked };
      })()`);
    },
    fit: () => p.ev(`({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })`),
  };
  return h;
}

async function desktop(b) {
  console.log('Desktop');
  const p = await b.page();
  await p.viewport(1280, 900);
  await p.go(URL_, 1500);
  const h = helpers(p);

  /* Every starter must tokenize with no gaps */
  const cover = await p.ev(`(() => { const samples = ["SELECT 1abc, 2026x, 12_ FROM t", "a___b ____ '____' -- ____", "é→ 'x", "/* open", '"q', "12.5.6 1e5 .5"]; return samples.map((s) => { const t = Kenari.Editor._tokenize(s); let at = 0; for (const k of t) { if (k.a !== at) return false; at = k.b; } return at === s.length; }); })()`);
  ok(cover.every(Boolean), 'tokenizer covers every character', cover);

  /* Blanks */
  ok((await p.ev(`eds.a.blankCount`)) === 3, 'starter has three blanks');
  ok((await p.ev(`eds.b.blankCount`)) === 3, 'blank inside quotes counts');
  const A = await h.val('a');
  const blanksA = await p.ev(`(() => { const r = /_{3,}/g, v = eds.a.value, o = []; let m; while ((m = r.exec(v))) o.push(m.index); return o; })()`);
  await h.clickOffset('a', blanksA[1] + 2);
  let s = await h.sel('a');
  ok(s[2] === '____' && s[0] === blanksA[1], 'clicking a blank selects it', s);
  ok((await h.onBlank('a')) === 1, 'clicked blank has the ring');
  await p.key('Tab'); await sleep(30);
  s = await h.sel('a');
  ok(s[0] === blanksA[2] && (await h.onBlank('a')) === 2, 'Tab goes to the next blank', s);
  await p.key('Tab'); await sleep(30);
  s = await h.sel('a');
  ok(s[0] === blanksA[0], 'Tab wraps to the first blank', s);
  await p.key('Tab', { modifiers: SHIFT }); await sleep(30);
  s = await h.sel('a');
  ok(s[0] === blanksA[2], 'Shift Tab goes back', s);
  await p.key('Tab'); await sleep(30);
  await p.type('collector_name'); await sleep(150);
  ok((await h.val('a')).includes('SELECT collector_name, ____'), 'typing replaces the selected blank', await h.val('a'));
  ok((await p.ev(`eds.a.blankCount`)) === 2, 'one blank fewer');
  ok((await h.ac()) === null, 'no popup after a complete word');
  await p.key('Tab'); await sleep(30);
  ok((await h.onBlank('a')) === 0, 'Tab moves on after a complete word, with no popup in the way');

  /* Arrow keys treat a blank as one thing */
  await p.key('Escape');
  await h.set('e', 'SELECT ____ FROM t');
  await h.focusAt('e', 6);
  await p.s('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, commands: ['moveRight'] }); await sleep(10);
  await p.s('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }); await sleep(30);
  await p.s('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, commands: ['moveRight'] }); await sleep(10);
  await p.s('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }); await sleep(30);
  s = await h.sel('e');
  ok(s[2] === '____', 'arrowing into a blank takes the whole blank', s);
  await h.focusAt('e', 11);
  await p.key('Backspace'); await sleep(30);
  ok((await h.val('e')) === 'SELECT  FROM t', 'Backspace right after a blank removes all of it', await h.val('e'));
  await h.undo();
  ok((await h.val('e')) === 'SELECT ____ FROM t', 'and undo brings it back', await h.val('e'));

  /* Autocomplete */
  await h.set('e', '');
  await h.focusAt('e', 0);
  await p.type('se'); await sleep(150);
  let items = await h.ac();
  ok(items && items[0] === 'SELECT', 'keywords first at the start of a query', items);
  ok(!!(await p.ev(`document.querySelector('.ed-ac-i.next')`) ), 'first item is marked as what Tab takes');
  await p.key('Enter'); await sleep(40);
  ok((await h.val('e')) === 'se\n', 'Enter without arrowing is a plain new line', await h.val('e'));
  ok((await h.ac()) === null, 'popup closed on Enter');

  await h.set('e', '\nFROM collectors');
  await h.focusAt('e', 0);
  await p.type('SELECT co'); await sleep(150);
  items = await h.ac();
  ok(items && items[0] === 'collector_id', 'columns of tables in the query come first', items);
  const meaning = await p.ev(`document.querySelector('.ed-ac-i span').textContent`);
  ok(meaning === 'unique ID', 'with the meaning from the right table', meaning);
  await p.key('ArrowDown'); await p.key('ArrowDown'); await sleep(20);
  ok((await p.ev(`document.querySelector('.ed-ac-i[aria-selected="true"] code').textContent`)) === items[1], 'arrow moves the selection');
  await p.key('Enter'); await sleep(40);
  ok((await h.val('e')).startsWith('SELECT ' + items[1] + '\nFROM'), 'Enter accepts after arrowing', await h.val('e'));

  await h.set('e', '');
  await h.focusAt('e', 0);
  await p.type('SELECT * FROM lo'); await sleep(150);
  items = await h.ac();
  ok(items && items[0] === 'loans', 'tables first after FROM', items);
  await p.key('Tab'); await sleep(40);
  ok((await h.val('e')) === 'SELECT * FROM loans', 'Tab accepts', await h.val('e'));

  await h.set('e', '');
  await h.focusAt('e', 0);
  await p.type('SELECT lo'); await sleep(150);
  ok(!!(await h.ac()), 'popup open before punctuation');
  await p.type(','); await sleep(40);
  ok((await h.ac()) === null, 'punctuation closes the popup');
  await p.type(' lo'); await sleep(150);
  ok(!!(await h.ac()), 'popup opens again for the next word');
  await p.key('Escape'); await sleep(30);
  ok((await h.ac()) === null && (await h.focused('e')), 'Esc closes the popup and stays');
  await p.type('a'); await sleep(150);
  ok((await h.ac()) === null, 'stays closed for the rest of that word');

  await h.set('e', '');
  await h.focusAt('e', 0);
  await p.type("WHERE team = 'lo"); await sleep(150);
  ok((await h.ac()) === null, 'no popup inside text');
  await h.set('e', '');
  await h.focusAt('e', 0);
  await p.type('-- lo'); await sleep(150);
  ok((await h.ac()) === null, 'no popup inside a comment');

  await h.set('e', '\nFROM loans l JOIN customers AS c ON c.customer_id = l.customer_id');
  await h.focusAt('e', 0);
  await p.type('SELECT c.'); await sleep(150);
  items = await h.ac();
  ok(items && items.includes('full_name') && !items.includes('dpd'), 'short name then a dot lists that table', items);
  await p.type('fu'); await sleep(60);
  items = await h.ac();
  ok(items && items[0] === 'full_name', 'narrowing after the dot', items);
  await p.key('Tab'); await sleep(40);
  ok((await h.val('e')).startsWith('SELECT c.full_name\n'), 'Tab keeps the short name', await h.val('e'));

  await h.set('e', '');
  await h.focusAt('e', 0);
  await p.type('SELECT cou'); await sleep(150);
  await p.key('ArrowDown'); await sleep(10);
  items = await h.ac();
  ok(items && items.includes('COUNT'), 'functions are offered', items);

  /* Popup placement near the caret */
  await h.set('e', '');
  await h.focusAt('e', 0);
  await p.type('SELECT loan'); await sleep(150);
  const pr = await h.acRect();
  const cr = await p.ev(`eds.e.caretRect()`);
  ok(pr && pr.top >= cr.bottom - 1 && pr.left < cr.left, 'popup sits under the word', { pr, cr });
  await p.key('Escape');

  /* Near the bottom of the window the popup opens upward, and never leaves the window */
  await p.viewport(1280, 400);
  await h.set('e', 'SELECT 1;\nSELECT lo');
  await p.ev(`(eds.e.el.scrollIntoView({block:'end'}), void 0)`);
  await h.focusAt('e', 19); await sleep(40);
  await p.type('a'); await sleep(150);
  const up = await h.acRect();
  const cu = await p.ev(`eds.e.caretRect()`);
  ok(up && up.bottom <= cu.top + 1 && up.top >= 0 && up.bottom <= 400, 'popup flips above the line near the bottom', { up, cu });
  await p.key('Escape');
  await p.viewport(1280, 900);

  /* Coming in by keyboard starts at the first blank */
  await p.go(URL_, 800);
  await p.ev(`document.getElementById('theme').focus()`);
  for (let i = 0; i < 5; i++) await p.key('Tab');
  await sleep(40);
  ok(await h.focused('a'), 'Tab from the page reaches the editor', await p.ev(`document.activeElement.outerHTML.slice(0,60)`));
  s = await h.sel('a');
  ok(s[2] === '____', 'and lands on the first blank', s);
  await p.key('Escape');

  /* Run keys */
  await h.set('e', 'SELECT 1;');
  await h.focusAt('e', 9);
  const runs0 = await p.ev(`window.__runs || 0`);
  await p.key('Enter', { modifiers: CTRL }); await sleep(30);
  await p.key('Enter', { modifiers: META }); await sleep(30);
  ok((await p.ev(`window.__runs || 0`)) === runs0 + 2, 'Ctrl Enter and Cmd Enter run');
  ok((await h.val('e')) === 'SELECT 1;', 'running adds no new line', await h.val('e'));

  /* Tab, Esc */
  await h.focusAt('e', 0);
  await p.key('Tab'); await sleep(30);
  ok((await h.val('e')) === '  SELECT 1;', 'Tab indents when there is no blank', await h.val('e'));
  await p.key('Enter'); await sleep(30);
  ok((await h.val('e')).startsWith('  \n  SELECT') , 'new line keeps the indent', await h.val('e'));
  await h.undo(); await h.undo();
  await p.key('Escape'); await sleep(30);
  ok(!(await h.focused('e')), 'Esc leaves the editor');
  ok((await p.ev(`document.activeElement.tagName`)) !== 'BODY', 'and focus lands on a real control', await p.ev(`document.activeElement.outerHTML.slice(0,80)`));
  await h.focusAt('a', 0);
  await p.key('Escape'); await sleep(30);
  ok((await p.ev(`document.activeElement.id`)) === 'run', 'in a console, Esc lands on Run');

  /* markError */
  await p.click('Mark an error in E'); await sleep(60);
  s = await h.sel('e');
  ok(s[2] === 'kol' && s[0] === 7, 'the marked word is selected', s);
  ok((await p.ev(`eds.e.el.querySelector('.t-err').textContent`)) === 'kol', 'the marked word is highlighted');
  const mr = await p.ev(`eds.e.markedRect()`);
  ok(mr && mr.width > 15, 'markedRect gives the slip a place to point', mr);
  await p.type('collectibility'); await sleep(40);
  ok(!(await p.ev(`eds.e.el.querySelector('.t-err')`)), 'the mark clears on the next edit');
  ok((await h.val('e')).startsWith('SELECT collectibility, l.kol'), 'typing replaced the word', await h.val('e'));
  await p.key('Escape');
  await p.ev(`eds.e.markError('l.kol')`);
  ok((await p.ev(`eds.e.el.querySelector('.t-err').textContent`)) === 'l.kol', 'a dotted name marks across its parts');
  ok(await p.ev(`eds.e.replaceMarked({from:'l.kol', to:'l.collectibility'})`), 'replaceMarked works, with text or a fix object');
  ok((await h.val('e')).includes('l.collectibility'), 'and changes the text');
  await h.undo();
  ok((await h.val('e')).includes('l.kol'), 'and can be undone', await h.val('e'));
  await p.ev(`eds.e.value = "SELECT note FROM t WHERE x = 'nothere'"`);
  ok(await p.ev(`eds.e.markError('nothere')`), 'falls back to text when the word is only in a string');
  await p.ev(`eds.e.value = "SELECT note FROM t"`);
  ok(!(await p.ev(`eds.e.markError('absent')`)), 'an absent word marks nothing and throws nothing');
  await p.ev(`eds.e.value = "SELECT a,, b FROM t"; eds.e.markError(',')`);
  ok((await h.sel('e'))[0] === 9, 'the second of two commas is the one marked', await h.sel('e'));
  await p.ev(`eds.e.value = "SELECT (a)) FROM t"; eds.e.markError(')')`);
  ok((await h.sel('e'))[0] === 10, 'the unmatched bracket is the one marked', await h.sel('e'));
  await p.ev(`eds.e.value = "SELECT a FROM t"; eds.e.markError('FROM'); eds.e.clearError()`);
  ok(!(await p.ev(`eds.e.el.querySelector('.t-err')`)), 'clearError clears');

  /* Undo through every kind of edit */
  await h.set('e', '');
  await h.focusAt('e', 0);
  await p.type('SELECT loan'); await sleep(150);
  await p.key('Tab'); await sleep(40);
  const accepted = await h.val('e');
  ok(accepted.startsWith('SELECT loan'), 'accepted a suggestion', accepted);
  await h.undo();
  ok((await h.val('e')) === 'SELECT loan', 'undo takes back the suggestion', await h.val('e'));
  await h.set('a', 'SELECT ____, ____\nFROM ____;');
  await p.click('Insert loan_id'); await sleep(40);
  s = await h.sel('a');
  ok((await h.val('a')) === 'SELECT loan_id, ____\nFROM ____;', 'insert fills the first blank before any caret exists', await h.val('a'));
  ok(s[2] === '____' && (await h.focused('a')), 'and moves on to the next blank', s);
  await p.click('Insert product'); await sleep(40);
  await p.click('Insert loans'); await sleep(40);
  ok((await h.val('a')) === 'SELECT loan_id, product\nFROM loans;', 'inserting by click fills all blanks in order', await h.val('a'));
  await h.undo();
  ok((await h.val('a')) === 'SELECT loan_id, product\nFROM ____;', 'undo after insert', await h.val('a'));
  await h.undo();
  await h.undo();
  ok((await h.val('a')) === 'SELECT ____, ____\nFROM ____;', 'undo all the way back', await h.val('a'));
  await p.ev(`(eds.a.textarea.focus(), eds.a.replaceAll('SELECT 1;'))`);
  await h.undo();
  ok((await h.val('a')) === 'SELECT ____, ____\nFROM ____;', 'replaceAll can be undone', await h.val('a'));
  await h.set('e', 'SELECT a');
  await h.focusAt('e', 8);
  await p.click('Insert product'); await sleep(40);
  ok((await h.val('e')) === 'SELECT a', 'buttons for one editor leave others alone');

  /* Pasted curly quotes */
  await h.set('e', '');
  await h.focusAt('e', 0);
  await p.type('x = ‘a’'); await sleep(40);
  ok((await h.val('e')) === "x = 'a'", 'curly quotes come in straight', await h.val('e'));

  /* Read only */
  await h.set('e', 'SELECT 1;');
  await h.focusAt('e', 9);
  await p.ev(`eds.e.readOnly = true`);
  const r0 = await p.ev(`window.__runs || 0`);
  await p.type('x'); await p.key('Enter'); await p.key('Enter', { modifiers: CTRL }); await sleep(30);
  ok((await h.val('e')) === 'SELECT 1;', 'read only ignores typing and Enter', await h.val('e'));
  ok((await p.ev(`window.__runs || 0`)) === r0, 'read only does not run');
  await p.ev(`eds.e.insert('nope')`);
  ok((await h.val('e')) === 'SELECT 1;', 'read only ignores insert');
  await p.ev(`eds.e.readOnly = false`);
  await p.type('x'); await sleep(30);
  ok((await h.val('e')) === 'SELECT 1;x', 'typing works again after unlocking', await h.val('e'));

  /* Long lines */
  await h.set('c', await p.ev(`eds.c.value`));
  await h.focusAt('c', 0);
  await h.keyEnd(); await sleep(60);
  let g = await p.ev(`(() => { const ed = eds.c, sc = ed.el.querySelector('.ed-scroll'), t = ed.textarea, c = ed.caretRect(), r = sc.getBoundingClientRect(), gw = ed.el.querySelector('.ed-g').getBoundingClientRect(); return { sl: sc.scrollLeft, tsl: t.scrollLeft, tst: t.scrollTop, caretLeft: c.left, right: r.right, gr: gw.right, gleft: gw.left, rl: r.left, sw: t.scrollWidth, cw: t.clientWidth }; })()`);
  ok(g.sl > 100, 'End on a long line scrolls the box', g);
  ok(g.tsl === 0 && g.tst === 0, 'the textarea itself never scrolls', g);
  ok(g.caretLeft < g.right && g.caretLeft > g.gr, 'the caret is on screen, clear of the numbers', g);
  ok(g.gleft === g.rl, 'line numbers stay put when scrolled sideways', g);
  await p.type('ABCDEFGHIJKLMNOPQRSTUVWXYZ'); await sleep(50);
  g = await p.ev(`(() => { const ed = eds.c, sc = ed.el.querySelector('.ed-scroll'), t = ed.textarea, c = ed.caretRect(), r = sc.getBoundingClientRect(); return { sl: sc.scrollLeft, tsl: t.scrollLeft, caretLeft: c.left, right: r.right }; })()`);
  ok(g.tsl === 0 && g.caretLeft < g.right, 'typing at the end stays in view', g);
  let d = await h.alignDiff('c');
  ok(d.inked > 500 && d.diff < 8, 'layers match pixel for pixel on a scrolled long line', d);
  await h.undo();

  /* Many lines */
  await h.focusAt('d', 0);
  await p.ev(`eds.d.textarea.setSelectionRange(eds.d.value.length, eds.d.value.length)`); await sleep(80);
  g = await p.ev(`(() => { const ed = eds.d, sc = ed.el.querySelector('.ed-scroll'), t = ed.textarea, c = ed.caretRect(), r = sc.getBoundingClientRect(); return { st: sc.scrollTop, tst: t.scrollTop, ch: sc.clientHeight, bottom: c.bottom, rb: r.bottom, sh: sc.scrollHeight }; })()`);
  ok(g.st > 0 && g.tst === 0, 'a tall query scrolls in the box, not in the textarea', g);
  ok(g.bottom <= g.rb + 1, 'the caret is in view at the bottom', g);
  ok(g.ch <= 12 * 26 + 22 + 1, 'height stops at lines.max', g);
  d = await h.alignDiff('d');
  ok(d.inked > 500 && d.diff < 8, 'layers match after scrolling down', d);
  /* A wheel scroll moves both layers because there is one scroll box */
  await p.s('Input.dispatchMouseEvent', { type: 'mouseWheel', x: (await p.ev(`eds.d.el.getBoundingClientRect().left + 100`)), y: (await p.ev(`eds.d.el.getBoundingClientRect().top + 60`)), deltaX: 0, deltaY: -150 });
  await sleep(100);
  d = await h.alignDiff('d');
  ok(d.diff < 8, 'layers match after a wheel scroll', d);

  /* Destroy */
  await p.ev(`(() => { const host = document.createElement('div'); document.body.append(host); const x = Kenari.Editor.create(host, {value:'SELECT lo'}); x.textarea.focus(); window.__x = x; window.__xh = host; })()`);
  await p.ev(`__x.destroy()`);
  ok(!(await p.ev(`__xh.children.length`)), 'destroy empties the host');

  ok(p.errors.length === 0, 'no console errors', p.errors);
  return p;
}

async function align(b) {
  console.log('Alignment across fonts and scale');
  for (const [label, block, dpr] of [['web font', false, 1], ['web font, 2x', false, 2], ['fonts blocked', true, 1], ['fonts blocked, 2x', true, 2]]) {
    const p = await b.page();
    if (block) await p.blockFonts();
    await p.viewport(1280, 1400, { dpr });
    await p.go(URL_, 1200);
    const h = helpers(p);
    const fam = await p.ev(`(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight).join(', '); })()`);
    console.log('  ' + label + ': fonts loaded: ' + (fam || 'none'));
    if (!block && dpr === 1) {
      /* Negative control: a 1px nudge must be caught, or the check proves nothing. */
      await p.ev(`(() => { const s = document.createElement('style'); s.id = '__nudge'; s.textContent = '.ed-hl{left:1px}'; document.head.append(s); })()`);
      const bad = await h.alignDiff('a');
      ok(bad.diff > 50, 'control: a 1px nudge is detected', bad);
      await p.ev(`document.getElementById('__nudge').textContent = '.ed-hl{left:.5px}'`);
      const bad2 = await h.alignDiff('a');
      ok(bad2.diff > 50, 'control: half a pixel is detected too', bad2);
      await p.ev(`document.getElementById('__nudge').remove()`);
    }
    for (const e of ['a', 'b', 'c', 'd']) {
      const d = await h.alignDiff(e);
      ok(d.inked > 100 && d.diff < 8 * dpr, label + ': editor ' + e + ' layers match', d);
    }
    /* Every token type at once, and odd characters */
    await h.set('e', "SELECT COUNT(*), 1abc, 12.5, 'text ____ more', \"q\" -- note ____\n\tFROM é_table, ____ /* block */ WHERE x <> 'it''s';\nSELECT 2026x;");
    const d = await h.alignDiff('e');
    ok(d.inked > 100 && d.diff < 8 * dpr, label + ': all token kinds and a tab match', d);
    await p.ev(`eds.e.value = 'SELECT kol FROM t'; eds.e.markError('kol')`);
    await p.ev(`document.activeElement.blur()`);
    const d2 = await h.alignDiff('e');
    ok(d2.diff < 8 * dpr, label + ': marked word matches', d2);
    await p.s('Target.closeTarget', {}).catch(() => {});
  }
}

async function phone(b) {
  console.log('Phone');
  const p = await b.page();
  await p.viewport(390, 844, { mobile: true, dpr: 2 });
  await p.go(URL_, 1500);
  const h = helpers(p);
  ok(await p.ev(`matchMedia('(pointer: coarse)').matches`), 'emulation is coarse');
  ok((await p.ev(`document.querySelector('.ed-keybar')`)) === null, 'no key bar before focus');
  ok(await p.ev(`getComputedStyle(eds.a.textarea).fontSize === '16px'`), '16px text so iOS does not zoom');
  /* selecting a blank on touch must not raise the keyboard */
  await p.ev(`eds.a.selectFirstBlank()`);
  ok(!(await h.focused('a')), 'selectFirstBlank keeps the keyboard down');
  ok((await h.onBlank('a')) === 0, 'and still shows where the next word lands');
  await p.ev(`eds.a.insert('loan_id')`);
  ok(!(await h.focused('a')) && (await h.val('a')).includes('loan_id'), 'insert works with no keyboard');
  await h.set('a', 'SELECT ____, ____\nFROM ____;');

  const blanksA = await p.ev(`(() => { const r = /_{3,}/g, v = eds.a.value, o = []; let m; while ((m = r.exec(v))) o.push(m.index); return o; })()`);
  await h.clickOffset('a', blanksA[0] + 1); await sleep(200);
  ok(await h.focused('a'), 'tap focuses the editor');
  let s = await h.sel('a');
  ok(s[2] === '____', 'tap on a blank selects it', s);
  const bar = await p.ev(`(() => { const k = document.querySelector('.ed-keybar'); if (!k || k.hidden) return null; const r = k.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height, vh: innerHeight, keys: [...k.querySelectorAll('.ed-key')].filter((x) => x.offsetParent).map((x) => { const q = x.getBoundingClientRect(); return [x.textContent, q.width, q.height]; }) }; })()`);
  ok(bar && Math.abs(bar.bottom - bar.vh) < 1, 'key bar shows at the bottom while focused', bar);
  ok(bar && bar.keys.every(([, w, hh]) => w >= 44 && hh >= 44), 'all keys are 44px or larger', bar && bar.keys);
  ok(bar && bar.keys.map((k) => k[0]).join(' ').startsWith('Next blank SELECT FROM WHERE * , \' = ( ) ; AND GROUP BY ORDER BY'), 'the keys from the spec', bar && bar.keys.map((k) => k[0]));
  await p.shot('phone-keybar');

  /* Tapping a key keeps focus and inserts */
  const tap = async (label) => { const c = await p.ev(`(() => { const x = [...document.querySelectorAll('.ed-keybar .ed-key')].find((b) => b.textContent === ${JSON.stringify(label)} && b.offsetParent); x.scrollIntoView({inline:'nearest'}); const r = x.getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; })()`); await p.clickAt(c.x, c.y); await sleep(120); };
  await tap('*');
  ok((await h.val('a')).startsWith('SELECT *, ____'), 'a key replaces the selected blank', await h.val('a'));
  ok(await h.focused('a'), 'focus stays in the editor after tapping a key');
  await tap('Next blank');
  s = await h.sel('a');
  ok(s[2] === '____' && s[0] > 8, 'Next blank moves on', s);
  ok(await h.focused('a'), 'still focused');

  /* Suggestions move into the bar, so they cover nothing */
  await h.set('e', '');
  await h.focusAt('e', 0); await sleep(100);
  await p.type('SELECT lo'); await sleep(200);
  ok((await h.ac()) === null, 'no floating popup on a phone');
  const chips = await p.ev(`[...document.querySelectorAll('.ed-chip')].filter((c) => c.offsetParent).map((c) => { const r = c.getBoundingClientRect(); return [c.querySelector('code').textContent, c.querySelector('small').textContent, r.height]; })`);
  ok(chips.length && chips[0][2] >= 44, 'suggestions show as chips in the key bar', chips);
  await p.shot('phone-chips');
  const first = chips[0][0];
  const c = await p.ev(`(() => { const r = document.querySelector('.ed-chip').getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; })()`);
  await p.clickAt(c.x, c.y); await sleep(150);
  ok((await h.val('e')).trimEnd() === 'SELECT ' + first, 'tapping a chip accepts it', await h.val('e'));
  ok(await h.focused('e'), 'focus stays after a chip');
  ok((await p.ev(`[...document.querySelectorAll('.ed-chip')].filter((c) => c.offsetParent).length`)) === 0, 'chips give way to keys');

  /* Fake a keyboard the way iOS behaves: the layout viewport keeps its height, the visual viewport shrinks. */
  await p.ev(`(() => {
    const real = window.visualViewport, et = new EventTarget();
    const fake = { offsetTop: 0, offsetLeft: 0, width: innerWidth, height: innerHeight, addEventListener: et.addEventListener.bind(et), removeEventListener: et.removeEventListener.bind(et), dispatch: () => et.dispatchEvent(new Event('resize')) };
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: fake });
    window.__fakeVV = fake;
  })()`);
  await p.ev(`(document.activeElement.blur(), void 0)`); await sleep(380);   /* The bar waits a moment, so a tap on another control is not lost. */
  ok(await p.ev(`document.querySelector('.ed-keybar') ? [...document.querySelectorAll('.ed-keybar')].every((k) => k.hidden) : true`), 'key bar hides on blur');
  ok(!(await p.ev(`document.documentElement.dataset.keybar`)), 'the page flag clears on blur');
  await h.focusAt('a', 0); await sleep(100);
  await p.ev(`(__fakeVV.height = innerHeight - 300, __fakeVV.dispatch())`); await sleep(120);
  let kb = await p.ev(`(() => { const k = [...document.querySelectorAll('.ed-keybar')].find((x) => !x.hidden); const r = k.getBoundingClientRect(); return { bottom: r.bottom, top: r.top, limit: __fakeVV.height + __fakeVV.offsetTop, inset: getComputedStyle(document.documentElement).getPropertyValue('--kb-inset'), h: getComputedStyle(document.documentElement).getPropertyValue('--keybar-h'), caret: eds.a.caretRect().bottom }; })()`);
  ok(Math.abs(kb.bottom - kb.limit) < 1, 'key bar sits on top of the keyboard', kb);
  ok(kb.inset === '300px' && parseFloat(kb.h) >= 44, 'the page can read --kb-inset and --keybar-h', kb);
  ok(kb.caret <= kb.top, 'the caret line stays above the key bar', kb);
  await p.shot('phone-keyboard');
  await p.ev(`(__fakeVV.offsetTop = 120, __fakeVV.dispatch())`); await sleep(120);
  kb = await p.ev(`(() => { const k = [...document.querySelectorAll('.ed-keybar')].find((x) => !x.hidden); const r = k.getBoundingClientRect(); return { bottom: r.bottom, limit: __fakeVV.height + __fakeVV.offsetTop }; })()`);
  ok(Math.abs(kb.bottom - kb.limit) < 1, 'and follows when iOS shifts the visual viewport', kb);
  await p.ev(`(__fakeVV.height = innerHeight, __fakeVV.offsetTop = 0, __fakeVV.dispatch())`); await sleep(120);

  await p.ev(`document.activeElement.blur()`);
  const fit = await h.fit();
  ok(fit.sw <= fit.cw, 'no sideways page scroll at 390px', fit);
  await h.focusAt('c', 0); await h.keyEnd(); await sleep(60);
  const f2 = await h.fit();
  ok(f2.sw <= f2.cw, 'a long line scrolls inside its box', f2);
  ok(p.errors.length === 0, 'no console errors', p.errors);
  return p;
}

async function shots(b) {
  const p = await b.page();
  for (const theme of ['dark', 'light']) {
    await p.viewport(1280, 1150);
    await p.go(URL_, 1500);
    await p.ev(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`);
    await p.ev(`eds.a.selectFirstBlank()`); await sleep(120);
    await p.shot(`desk-${theme}-blank`);
    const h = helpers(p);
    await h.set('e', 'SELECT co\nFROM collectors c;');
    await h.focusAt('e', 9);
    await p.type('l'); await sleep(180);
    await p.key('ArrowDown'); await sleep(30);
    await p.shot(`desk-${theme}-popup`);
    await p.key('Escape');
    await p.click('Mark an error in E'); await sleep(100);
    await p.ev(`eds.c.textarea.focus(); eds.c.textarea.setSelectionRange(7, 60)`); await sleep(100);
    await p.shot(`desk-${theme}-selection`);
    await p.ev(`eds.e.value='SELECT kol, dpd\\nFROM loans;'; eds.e.markError('kol'); eds.e.el.scrollIntoView({block:'center'})`); await sleep(100);
    await p.shot(`desk-${theme}-mark`);
  }
  await p.ev(`document.documentElement.dataset.theme = 'dark'`);
  return p;
}

const b = await launch();
try {
  if (which === 'all' || which === 'desktop') await desktop(b);
  if (which === 'all' || which === 'align') await align(b);
  if (which === 'all' || which === 'phone') await phone(b);
  if (which === 'all' || which === 'shots') await shots(b);
} catch (e) { fail++; console.log('CRASH', e); }
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
