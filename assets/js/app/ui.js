/*
 * Kenari.UI: shared DOM helpers and the signature pieces ported from Passbook Noir.
 * Sections: helpers, SQL highlight, rich text and glossary, code block, ledger, toast and copy,
 * dialogs, dot matrix and icons, stamp, rosettes and guilloche, sound, theme, Copy for Claude.
 */
(function () {
  'use strict';
  const K = (window.Kenari = window.Kenari || {});
  const TAU = Math.PI * 2;

  /* ---------- Helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** el('button', {class:'key', onClick: fn, 'aria-label': 'x', dataset:{a:1}, style:{...}, html:'<b>'}, child, 'text', [more]) */
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'style' && typeof v === 'object') {
        for (const [p, q] of Object.entries(v)) {
          if (p.startsWith('--')) node.style.setProperty(p, q); else node.style[p] = q;
        }
      } else if (/^on[A-Z]/.test(k)) node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    }
    const add = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(add);
      else node.append(c.nodeType ? c : document.createTextNode(String(c)));
    };
    children.forEach(add);
    return node;
  }
  const motionOK = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || '');
  const coarse = () => matchMedia('(pointer: coarse)').matches;
  const whenIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 30));
  const cssv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  /** Run an entrance animation, then cancel it, so the element's own style is always the final state. */
  function anim(node, frames, opts) {
    if (!motionOK() || !node) return null;
    const a = node.animate(frames, Object.assign({ fill: 'both' }, opts));
    setTimeout(() => { try { a.cancel(); } catch (e) { /* already gone */ } }, (opts.delay || 0) + opts.duration + 30);
    return a;
  }

  /* ---------- SQL highlight ---------- */
  const SQL_KEYWORDS = 'SELECT FROM WHERE AND OR NOT IN IS NULL BETWEEN LIKE GLOB ORDER BY ASC DESC NULLS FIRST LAST LIMIT OFFSET GROUP HAVING JOIN LEFT RIGHT INNER OUTER FULL CROSS NATURAL ON USING AS DISTINCT UNION ALL INTERSECT EXCEPT CASE WHEN THEN ELSE END WITH RECURSIVE INSERT INTO VALUES UPDATE SET DELETE CREATE TEMP TEMPORARY TABLE VIEW INDEX UNIQUE TRIGGER DROP ALTER ADD COLUMN RENAME TO IF PRIMARY KEY FOREIGN REFERENCES DEFAULT CHECK CONSTRAINT BEGIN COMMIT ROLLBACK TRANSACTION SAVEPOINT RELEASE EXISTS OVER PARTITION ROWS RANGE UNBOUNDED PRECEDING FOLLOWING CURRENT ROW FILTER WINDOW EXPLAIN QUERY PLAN PRAGMA ANALYZE REPLACE'.split(' ');
  const SQL_FUNCTIONS = 'COUNT SUM TOTAL AVG MIN MAX ROUND COALESCE NULLIF IFNULL IIF CAST TRIM LTRIM RTRIM UPPER LOWER LENGTH SUBSTR SUBSTRING INSTR ABS PRINTF FORMAT STRFTIME DATE TIME DATETIME JULIANDAY UNIXEPOCH RANK DENSE_RANK ROW_NUMBER PERCENT_RANK CUME_DIST LAG LEAD NTILE FIRST_VALUE LAST_VALUE NTH_VALUE GROUP_CONCAT STRING_AGG TYPEOF RANDOM SIGN'.split(' ');
  const KW = new Set(SQL_KEYWORDS), FN = new Set(SQL_FUNCTIONS);

  /** opts.mark: the word to mark as the one to fix. opts.active: index of the selected blank. */
  function hl(sql, opts) {
    const o = opts || {};
    /* Every character lands in one group. A digit followed by letters, like 2026x, reads as a word. */
    const re = /(--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:[^']|'')*'?)|(_{3,})|(\d+[A-Za-z_][A-Za-z0-9_]*)|(\d+(?:\.\d+)?)|("[^"\n]*"?|[A-Za-z_][A-Za-z0-9_]*)|([^\sA-Za-z0-9_'"]+)|(\s+)/g;
    let m, out = '', blank = -1, marked = false;
    const text = String(sql == null ? '' : sql);
    const blankHtml = (b) => { blank++; return '<span class="t-blank' + (o.active === blank ? ' on' : '') + '" data-blank="' + blank + '">' + b + '</span>'; };
    while ((m = re.exec(text))) {
      const [all, com, str, bl, oddWord, num, wordOnly, pun, sp] = m;
      const word = oddWord || wordOnly;
      if (!all) { re.lastIndex++; continue; }
      if (o.mark && !marked && !com && !str && all.toLowerCase() === String(o.mark).toLowerCase()) {
        out += '<span class="t-err">' + esc(all) + '</span>';
        marked = true;
        continue;
      }
      if (com) out += '<span class="t-com">' + esc(com) + '</span>';
      else if (str) {
        /* A blank inside quotes is still a blank, the same as in the editor and KenariCheck.hasBlanks. */
        out += '<span class="t-str">' + str.split(/(_{3,})/).map((part, i) => (i % 2 ? blankHtml(part) : esc(part))).join('') + '</span>';
      }
      else if (bl) out += blankHtml(bl);
      else if (num) out += '<span class="t-num">' + num + '</span>';
      else if (word) {
        const up = word.toUpperCase();
        if (KW.has(up)) out += '<span class="t-kw">' + esc(word) + '</span>';
        else if (FN.has(up)) out += '<span class="t-fn">' + esc(word) + '</span>';
        else out += esc(word);
      } else if (pun) out += '<span class="t-pun">' + esc(pun) + '</span>';
      else if (sp) out += sp;
    }
    return out;
  }

  /* ---------- Rich text and glossary ---------- */
  function rich(html, opts) {
    const host = el(opts && opts.inline ? 'span' : 'div', { class: 'rich' });
    host.innerHTML = String(html == null ? '' : html).replace(/\[\[([^\]]+)\]\]/g, (all, inner) => {
      if (inner.startsWith('demo:')) return '<div class="demo-host" data-demo="' + esc(inner.slice(5).trim()) + '"></div>';
      const bar = inner.indexOf('|');
      const label = bar >= 0 ? inner.slice(0, bar) : inner;
      const term = bar >= 0 ? inner.slice(bar + 1) : inner;
      return '<button type="button" class="term" data-term="' + esc(term.trim()) + '" aria-haspopup="dialog" aria-expanded="false">' + label + '</button>';
    });
    host.querySelectorAll('[data-demo]').forEach((d) => {
      try { if (K.Demos) K.Demos.render(d.dataset.demo, d); } catch (e) { console.error(e); }
    });
    return host;
  }

  const KOL_GRADES = [
    ['Kol 1', 'Lancar', '0'],
    ['Kol 2', 'Dalam Perhatian Khusus', '1 to 90'],
    ['Kol 3', 'Kurang Lancar', '91 to 120'],
    ['Kol 4', 'Diragukan', '121 to 180'],
    ['Kol 5', 'Macet', 'Over 180']
  ];
  const KOL_NAMES = new Set(['kol', 'collectibility', 'kolektibilitas']);

  function kolTable() {
    return '<table class="pop-table"><thead><tr><th scope="col">Grade</th><th scope="col">Name</th><th scope="col">Days past due</th></tr></thead><tbody>'
      + KOL_GRADES.map((g) => '<tr><td class="n">' + g[0] + '</td><td>' + g[1] + '</td><td class="d">' + g[2] + '</td></tr>').join('')
      + '</tbody></table>';
  }

  let popEl = null, popTerm = null;
  function closePop(refocus) {
    if (!popEl) return;
    popEl.remove();
    popEl = null;
    if (popTerm) {
      popTerm.setAttribute('aria-expanded', 'false');
      if (refocus) popTerm.focus({ preventScroll: true });
    }
    popTerm = null;
  }
  function openPop(btn) {
    closePop();
    const name = btn.dataset.term;
    const found = K.term ? K.term(name) : null;
    const pop = el('div', { class: 'pop', role: 'dialog', 'aria-label': name, tabindex: '-1' });
    pop.append(el('span', { class: 'pop-t', text: found ? found.term : name }));
    if (found) pop.append(rich(found.def));
    else pop.append(el('p', { text: 'This word is not in the glossary yet. The Cheat sheet has the full list.' }));
    if (KOL_NAMES.has(name.toLowerCase())) pop.insertAdjacentHTML('beforeend', kolTable());
    /* A dialog sits in the top layer, so the popover must live inside it to be seen. */
    (btn.closest('dialog') || document.body).append(pop);
    const r = btn.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    const vw = document.documentElement.clientWidth, vh = (window.visualViewport && visualViewport.height) || innerHeight;
    const left = Math.max(12, Math.min(r.left + r.width / 2 - pw / 2, vw - pw - 12));
    const above = r.bottom + 10 + ph > vh - 8 && r.top - 10 - ph > 8;
    pop.style.left = left + 'px';
    pop.style.top = (above ? r.top - 10 - ph : r.bottom + 10) + 'px';
    pop.style.setProperty('--ax', Math.max(14, Math.min(r.left + r.width / 2 - left, pw - 14)) + 'px');
    pop.classList.toggle('above', above);
    btn.setAttribute('aria-expanded', 'true');
    popEl = pop;
    popTerm = btn;
    pop.focus({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.term');
    if (btn) {
      e.preventDefault();
      if (popTerm === btn) closePop(true); else openPop(btn);
      return;
    }
    if (popEl && !popEl.contains(e.target)) closePop();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popEl) { e.stopPropagation(); e.preventDefault(); closePop(true); }
  }, true);
  document.addEventListener('focusin', (e) => {
    if (popEl && !popEl.contains(e.target) && e.target !== popTerm) closePop();
  });
  document.addEventListener('scroll', (e) => {
    if (popEl && !(e.target.nodeType === 1 && popEl.contains(e.target))) closePop();
  }, true);
  window.addEventListener('resize', () => closePop());

  /* ---------- Code block ---------- */
  function code(sql, opts) {
    const o = opts || {};
    const box = el('div', { class: 'codeblock' + (o.copy ? ' has-copy' : '') + (o.class ? ' ' + o.class : '') });
    box.append(el('pre', { html: hl(sql), tabindex: '0', 'aria-label': o.label || 'SQL code' }));
    if (o.copy) box.append(el('button', { type: 'button', class: 'cb-copy', text: 'Copy', onClick: () => copy(String(sql).trim(), 'Copied the query.') }));
    return box;
  }

  /* ---------- Ledger ---------- */
  const group = (v) => {
    const s = String(v), dot = s.indexOf('.');
    const whole = dot >= 0 ? s.slice(0, dot) : s;
    return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009') + (dot >= 0 ? s.slice(dot) : '');
  };
  /* Floating point noise is hidden. The raw value stays in the title. */
  const tidy = (v) => (Number.isInteger(v) ? v : +v.toFixed(6));
  function cellHtml(v, col) {
    if (v === null || v === undefined) return '<td><span class="null">NULL</span></td>';
    if (typeof v === 'number') {
      const big = !/_id$/i.test(col) && Math.abs(v) >= 100000;
      const shown = tidy(v);
      const needsTitle = big || shown !== v;
      return '<td class="num"' + (needsTitle ? ' title="' + v + '"' : '') + '>' + (big ? group(shown) : shown) + '</td>';
    }
    if (v instanceof Uint8Array) return '<td><span class="null">BLOB</span></td>';
    return '<td>' + esc(v) + '</td>';
  }
  function tableHtml(res, max) {
    if (!res.columns.length) return '<p class="lg-more">No table came back.</p>';
    const shown = res.rows.slice(0, max);
    const nums = res.columns.map((c, j) => shown.some((r) => typeof r[j] === 'number'));
    const th = res.columns.map((c, j) => '<th scope="col"' + (nums[j] ? ' class="num"' : '') + '>' + esc(c) + '</th>').join('');
    const body = shown.length
      ? shown.map((r, i) => '<tr style="--i:' + Math.min(i, 20) + '"><td class="rn">' + (i + 1) + '</td>' + r.map((v, j) => cellHtml(v, res.columns[j])).join('') + '</tr>').join('')
      : '<tr style="--i:0"><td class="rn"></td><td class="none" colspan="' + res.columns.length + '">No rows came back.</td></tr>';
    return '<table class="lg"><thead><tr><th class="rn" scope="col">No.</th>' + th + '</tr></thead><tbody>' + body + '</tbody></table>';
  }
  const toTSV = (res) => [res.columns.join('\t')]
    .concat(res.rows.map((r) => r.map((v) => (v === null || v === undefined ? '' : String(v).replace(/[\t\n]/g, ' '))).join('\t')))
    .join('\n');
  const rowsWord = (n) => n.toLocaleString('en-US') + (n === 1 ? ' row' : ' rows');

  /**
   * The printed result table.
   * opts: max (200), compact, animate, title, copy (true: Copy for Excel in the foot), foot (true),
   *       kept: {of: 502} ends the count as "37 rows kept, of 502", actions: [nodes] added to the foot,
   *       label: name for screen readers, onPrinted().
   * The element also has: .printed (Promise), .finish() fast-forwards the print, .setResult(result)
   * swaps the table in place (Compare), .foot, .scroller, .tsv().
   * To add a verdict band, ledger.prepend(band): rows scroll in their own box below it.
   */
  function ledger(result, opts) {
    const o = Object.assign({ max: 200, copy: true, foot: true }, opts || {});
    let res = result || { columns: [], rows: [] };
    const root = el('div', { class: 'paper ledger' + (o.compact ? ' compact' : '') });
    if (o.title) root.append(el('div', { class: 'lg-title', text: o.title }));
    const scroller = el('div', { class: 'lg-scroll', tabindex: '0', role: 'region', 'aria-label': o.label || o.title || 'Query result' });
    const wrap = el('div', { class: 'lg-wrap' });
    scroller.append(wrap);
    const moreCols = el('button', {
      type: 'button', class: 'lg-morecols', hidden: true, html: 'More columns' + ICONS.right,
      onClick: () => scroller.scrollBy({ left: scroller.clientWidth * 0.7, behavior: motionOK() ? 'smooth' : 'auto' })
    });
    root.append(el('div', { class: 'lg-frame' }, scroller, moreCols));
    let count = null;
    if (o.foot) {
      count = el('span', { class: 'lg-count' });
      root.foot = el('div', { class: 'lg-foot' }, count, el('span', { class: 'sp' }));
      if (o.copy) root.foot.append(el('button', { type: 'button', class: 'tlink', text: 'Copy for Excel', onClick: () => copy(toTSV(res), 'Copied. Paste it straight into Excel.') }));
      (o.actions || []).forEach((a) => root.foot.append(a));
      root.append(root.foot);
    }
    const countText = (n) => {
      if (o.kept && o.kept.of != null && n !== o.kept.of) return rowsWord(n).replace(/rows?$/, (w) => w + ' kept, of ' + o.kept.of.toLocaleString('en-US'));
      return rowsWord(n);
    };
    const render = () => {
      let html = tableHtml(res, o.max);
      if (res.rows.length > o.max) html += '<p class="lg-more">Showing the first ' + o.max + ' of ' + res.rows.length.toLocaleString('en-US') + ' rows.' + (res.truncated ? ' The database found even more, so it stopped counting there.' : '') + '</p>';
      wrap.innerHTML = html;
      if (count) count.textContent = res.columns.length ? countText(res.rows.length) : '';
      checkCols();
    };
    function checkCols() {
      const ths = wrap.querySelectorAll('th');
      const last = ths[ths.length - 1];
      const hidden = last ? last.getBoundingClientRect().right - scroller.getBoundingClientRect().right : 0;
      moreCols.hidden = !(hidden > 2);
      moreCols.parentNode.classList.toggle('has-more', hidden > 2);
    }
    scroller.addEventListener('scroll', checkCols, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(checkCols).observe(scroller);
    render();

    root.scroller = scroller;
    root.tsv = () => toTSV(res);
    root.setResult = (next, more) => { res = next; Object.assign(o, more || {}); scroller.scrollTop = 0; scroller.scrollLeft = 0; root.finish(); render(); };
    let done = null, timer = 0, ticker = 0;
    root.printed = new Promise((r) => { done = r; });
    root.finish = () => {
      clearTimeout(timer);
      clearInterval(ticker);
      root.classList.remove('printing');
      if (count) count.textContent = countText(res.rows.length);
      if (done) { done(); done = null; if (o.onPrinted) o.onPrinted(); }
    };
    if (o.animate && motionOK() && res.rows.length) {
      /* The line feed is capped at 20 rows and under a second, so Next can appear within 1.4 seconds. */
      const n = Math.min(res.rows.length, 20);
      const step = Math.min(34, 620 / n);
      const dur = 60 + n * step + 96;
      root.style.setProperty('--step', step + 'ms');
      root.classList.add('printing');
      sound.print(n);
      if (count) {
        let i = 0;
        const total = res.rows.length;
        count.textContent = rowsWord(0);
        ticker = setInterval(() => {
          i++;
          count.textContent = rowsWord(Math.round(total * Math.min(1, i / n)));
          if (i >= n) clearInterval(ticker);
        }, step);
      }
      timer = setTimeout(root.finish, dur);
    } else {
      root.finish();
    }
    return root;
  }

  /* ---------- Toast and clipboard ---------- */
  let toastEl = null, toastTimer = 0;
  /** message: text, or a Node for rich content. opts.ms sets how long it stays. */
  function toast(message, opts) {
    if (toastEl) toastEl.remove();
    const t = el('div', { class: 'toast', role: 'status' });
    if (message && message.nodeType) t.append(message); else t.textContent = String(message);
    (document.querySelector('dialog[open]') || document.body).append(t);
    toastEl = t;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.remove(); if (toastEl === t) toastEl = null; }, (opts && opts.ms) || 4200);
    return t;
  }
  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      try {
        const a = el('textarea', { style: { position: 'fixed', opacity: '0' } });
        a.value = text;
        (document.querySelector('dialog[open]') || document.body).append(a);
        a.select();
        const ok = document.execCommand('copy');
        a.remove();
        return ok;
      } catch (e2) { return false; }
    }
  }
  /** Copies, toasts label (or a default), and resolves to true or false. */
  async function copy(text, label) {
    const before = document.activeElement;
    const ok = await writeClipboard(text);
    if (before && before.focus && document.activeElement !== before) before.focus({ preventScroll: true });
    toast(ok ? (label || 'Copied.') : 'Your browser blocked the clipboard, so nothing was copied.');
    return ok;
  }

  /* ---------- Dialogs ---------- */
  const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
  const openDialogs = new Set();
  /** The Back button should not leave a dialog hanging over the next screen. */
  function closeDialogs() {
    [...openDialogs].forEach((close) => close(undefined));
    document.querySelectorAll('dialog.rk[open]').forEach((d) => d.dispatchEvent(new Event('cancel', { cancelable: true })));
  }
  function openDialog(cls, o) {
    const before = document.activeElement;
    const dlg = el('dialog', { class: cls + (o.wide ? ' wide' : ''), 'aria-label': o.title || 'Dialog' });
    let settled = false, resolve = null;
    const closed = new Promise((r) => { resolve = r; });
    const close = (value) => {
      if (settled) return;
      settled = true;
      openDialogs.delete(close);
      if (dlg.open) dlg.close();
      dlg.remove();
      if (o.onClose) o.onClose(value);
      if (before && before.isConnected && before.focus) before.focus({ preventScroll: true });
      resolve(value);
    };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(undefined); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(undefined); });
    dlg.append(el('div', { class: 'dlg-h' },
      el('h2', { text: o.title || '' }),
      el('button', { type: 'button', class: 'dlg-x', 'aria-label': 'Close', html: CLOSE_ICON, onClick: () => close(undefined) })));
    const bodyBox = el('div', { class: 'dlg-b' });
    if (typeof o.body === 'string') bodyBox.append(rich(o.body)); else if (o.body) bodyBox.append(o.body);
    dlg.append(bodyBox);
    if (o.actions && o.actions.length) {
      dlg.append(el('div', { class: 'dlg-a' }, o.actions.map((a) => {
        const kind = a.primary ? 'key canary' : a.danger ? 'key danger' : 'ghost';
        const b = el('button', {
          type: 'button', class: kind, text: a.label, 'data-autofocus': a.primary || a.autofocus ? '1' : null,
          onClick: () => { const r = a.onClick ? a.onClick(close) : undefined; if (r !== false && !a.keepOpen) close(a.value); }
        });
        return b;
      })));
    }
    document.body.append(dlg);
    dlg.showModal();
    openDialogs.add(close);
    const auto = dlg.querySelector('[data-autofocus]');
    if (auto) auto.focus();
    return { el: dlg, body: bodyBox, close, closed };
  }
  /** {title, body (string or Node), actions:[{label, primary, danger, value, onClick(close), keepOpen, autofocus}], wide} -> {el, body, close(value), closed} */
  const modal = (o) => openDialog('modal', o);
  /** Same as modal, sliding up from the bottom: {title, body, onClose}. */
  const sheet = (o) => openDialog('sheet', o);
  /** {title, body, confirm:'Reset progress', cancel:'Keep my progress', danger:true} -> Promise<boolean> */
  function confirmInPage(o) {
    const opts = o || {};
    const m = modal({
      title: opts.title || 'Are you sure?',
      body: opts.body || '',
      actions: [
        { label: opts.cancel || 'Go back', value: false, autofocus: true },
        { label: opts.confirm || 'Yes, continue', value: true, primary: !opts.danger, danger: !!opts.danger }
      ]
    });
    return m.closed.then((v) => v === true);
  }

  const setTitle = (text) => { document.title = text ? text + ' | Kenari SQL Lab' : 'Kenari Collection SQL Lab: learn SQL free, from zero to pro'; };
  const announce = (text) => {
    const live = document.getElementById('live');
    if (!live) return;
    live.textContent = '';
    setTimeout(() => { live.textContent = text; }, 30);
  };

  /* ---------- Dot matrix: drawn 5x7 for moments of 20px and larger ---------- */
  const F5 = {
    '0': '01110 10001 10011 10101 11001 10001 01110', '1': '00100 01100 00100 00100 00100 00100 01110',
    '2': '01110 10001 00001 00010 00100 01000 11111', '3': '11111 00010 00100 00010 00001 10001 01110',
    '4': '00010 00110 01010 10010 11111 00010 00010', '5': '11111 10000 11110 00001 00001 10001 01110',
    '6': '00110 01000 10000 11110 10001 10001 01110', '7': '11111 00001 00010 00100 01000 01000 01000',
    '8': '01110 10001 10001 01110 10001 10001 01110', '9': '01110 10001 10001 01111 00001 00010 01100',
    'A': '01110 10001 10001 11111 10001 10001 10001', 'B': '11110 10001 10001 11110 10001 10001 11110',
    'C': '01110 10001 10000 10000 10000 10001 01110', 'D': '11100 10010 10001 10001 10001 10010 11100',
    'E': '11111 10000 10000 11110 10000 10000 11111', 'F': '11111 10000 10000 11110 10000 10000 10000',
    'G': '01110 10001 10000 10111 10001 10001 01111', 'H': '10001 10001 10001 11111 10001 10001 10001',
    'I': '01110 00100 00100 00100 00100 00100 01110', 'J': '00111 00010 00010 00010 00010 10010 01100',
    'K': '10001 10010 10100 11000 10100 10010 10001', 'L': '10000 10000 10000 10000 10000 10000 11111',
    'M': '10001 11011 10101 10101 10001 10001 10001', 'N': '10001 10001 11001 10101 10011 10001 10001',
    'O': '01110 10001 10001 10001 10001 10001 01110', 'P': '11110 10001 10001 11110 10000 10000 10000',
    'Q': '01110 10001 10001 10001 10101 10010 01101', 'R': '11110 10001 10001 11110 10100 10010 10001',
    'S': '01111 10000 10000 01110 00001 00001 11110', 'T': '11111 00100 00100 00100 00100 00100 00100',
    'U': '10001 10001 10001 10001 10001 10001 01110', 'V': '10001 10001 10001 10001 10001 01010 00100',
    'W': '10001 10001 10001 10101 10101 10101 01010', 'X': '10001 10001 01010 00100 01010 10001 10001',
    'Y': '10001 10001 10001 01010 00100 00100 00100', 'Z': '11111 00001 00010 00100 01000 10000 11111',
    '.': '00 00 00 00 00 11 11', ':': '00 11 11 00 11 11 00', '-': '000 000 000 111 000 000 000',
    '+': '000 000 010 111 010 000 000', '/': '00001 00001 00010 00100 01000 10000 10000', '#': '01010 01010 11111 01010 11111 01010 01010'
  };
  function dmPath(str, ox, oy) {
    let x = ox || 0, d = '';
    const y0 = oy || 0;
    for (const ch of String(str).toUpperCase()) {
      if (ch === ' ') { x += 2; continue; }
      const g = F5[ch];
      if (!g) { x += 2; continue; }
      const rows = g.split(' ');
      rows.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) if (row[c] === '1') d += 'M' + (x + c + 0.5) + ' ' + (y0 + r + 0.5) + 'h0';
      });
      x += rows[0].length + 1;
    }
    return { d, w: Math.max(0, x - 1 - (ox || 0)) };
  }
  /** Dot-matrix numerals as an HTML string. Pitch p defaults so the height is 21px, the smallest allowed. */
  function dm(str, o) {
    const p = (o && o.p) || 3;
    const { d, w } = dmPath(str);
    const sw = (o && o.sw) || 0.92;
    return '<svg class="dm" viewBox="0 0 ' + w + ' 7" width="' + (w * p) + '" height="' + (7 * p) + '" aria-hidden="true" focusable="false"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="' + sw + '" stroke-linecap="round"/></svg><span class="vh">' + esc(str) + '</span>';
  }
  /** The bank queue display, with unlit dots behind the lit ones: the mission plate. */
  function qd(str, p) {
    const pitch = p || 4;
    const m = dmPath(str, 1, 1);
    const cols = m.w + 2, rows = 9;
    let off = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) off += 'M' + (c + 0.5) + ' ' + (r + 0.5) + 'h0';
    return '<span class="qd" role="img" aria-label="Mission ' + esc(str) + '"><svg viewBox="0 0 ' + cols + ' ' + rows + '" width="' + (cols * pitch) + '" height="' + (rows * pitch) + '" aria-hidden="true"><path class="off" d="' + off + '" fill="none" stroke="currentColor" stroke-width=".8" stroke-linecap="round"/><path class="lit" d="' + m.d + '" fill="none" stroke="currentColor" stroke-width=".86" stroke-linecap="round"/></svg></span>';
  }

  /* ---------- Icons: inline, no emoji ---------- */
  const ICONS = {
    arrow: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
    left: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    down: '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M1.5 3.5h9L6 9z"/></svg>',
    up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5"/></svg>',
    check: '<svg class="ico" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6.5l2.6 2.6L10 3.2"/></svg>',
    hook: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 1.5v6.5a2 2 0 0 0 2 2h8M10 7l3 3-3 3"/></svg>',
    shield: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2.2l6.5 2.4v5c0 4-2.7 6.8-6.5 8.2-3.8-1.4-6.5-4.2-6.5-8.2v-5z"/><path d="M7 10l2.2 2.2L13.2 8"/></svg>',
    pin: '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M6 11s4-3.7 4-6.6A4 4 0 0 0 2 4.4C2 7.3 6 11 6 11zm0-5.2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>',
    close: CLOSE_ICON
  };

  /* ---------- Shared SVG defs: the stamp's ink filters and the level rosettes ---------- */
  function rosD(level) {
    const p = 3 + level, n = 6 + level * 2, a = 0.2, b = 0.02 + level * 0.006, base = 0.72;
    const pts = Math.max(84, p * 16);
    let d = '';
    for (let k = 0; k < n; k++) {
      const ph = k / n * TAU;
      for (let i = 0; i <= pts; i++) {
        const t = i / pts * TAU;
        const r = 50 * (base + a * Math.cos(p * t + ph) + b * Math.cos(3 * p * t - 2 * ph));
        d += (i ? 'L' : 'M') + (r * Math.cos(t)).toFixed(1) + ' ' + (r * Math.sin(t)).toFixed(1);
      }
      d += 'Z';
    }
    return d;
  }
  function ensureDefs() {
    if (document.getElementById('kn-defs')) return;
    let rosettes = '';
    for (let n = 0; n < 10; n++) {
      rosettes += '<symbol id="ros-' + n + '" viewBox="-52 -52 104 104"><path d="' + rosD(n) + '" fill="none" stroke="currentColor" stroke-width=".32"/><circle r="50.6" fill="none" stroke="currentColor" stroke-width=".55"/></symbol>';
    }
    const host = el('div', { id: 'kn-defs', 'aria-hidden': 'true', style: { position: 'absolute', width: '0', height: '0', overflow: 'hidden' } });
    host.innerHTML = '<svg width="0" height="0" focusable="false"><defs>'
      + '<filter id="ink" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.42" numOctaves="2" seed="4" result="fine"/><feDisplacementMap in="SourceGraphic" in2="fine" scale="1.5" xChannelSelector="R" yChannelSelector="G" result="rough"/><feTurbulence type="fractalNoise" baseFrequency="0.011 0.019" numOctaves="3" seed="19" result="blotch"/><feColorMatrix in="blotch" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.68" result="blotchA"/><feTurbulence type="fractalNoise" baseFrequency="0.36" numOctaves="3" seed="23" result="speck"/><feColorMatrix in="speck" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -12 9.3" result="speckA"/><feComposite in="rough" in2="blotchA" operator="in" result="a"/><feComposite in="a" in2="speckA" operator="in"/></filter>'
      + '<filter id="ink-s" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="2" seed="7" result="fine"/><feDisplacementMap in="SourceGraphic" in2="fine" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="rough"/><feTurbulence type="fractalNoise" baseFrequency="0.014 0.022" numOctaves="3" seed="31" result="blotch"/><feColorMatrix in="blotch" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 1.6" result="blotchA"/><feComposite in="rough" in2="blotchA" operator="in"/></filter>'
      + rosettes + '</defs></svg>';
    document.body.prepend(host);
  }
  /** A level's rosette, denser as the rank rises. HTML string. n is the level number. */
  const rosette = (n, size) => { ensureDefs(); return '<svg class="ros" width="' + (size || 96) + '" height="' + (size || 96) + '" aria-hidden="true"><use href="#ros-' + n + '"/></svg>'; };

  /* ---------- Stamps: outlines only, so they survive blocked fonts ---------- */
  const GL = () => K.GLYPHS;
  let sid = 0;
  function runW(str, size, ls) {
    const k = size / GL().upm;
    let w = 0;
    for (const ch of str) { const g = GL().g[ch]; w += (g ? g[0] : GL().sp) * k + ls; }
    return w - ls;
  }
  function flat(str, size, ls, cx, base) {
    const k = size / GL().upm;
    let x = cx - runW(str, size, ls) / 2, out = '';
    for (const ch of str) {
      const g = GL().g[ch];
      if (g) out += '<path transform="translate(' + x.toFixed(2) + ' ' + base + ') scale(' + k.toFixed(5) + ')" d="' + g[1] + '"/>';
      x += (g ? g[0] : GL().sp) * k + ls;
    }
    return out;
  }
  function arcText(str, size, ls, cx, cy, r, bottom) {
    const k = size / GL().upm;
    const total = runW(str, size, ls);
    let s = -total / 2, out = '';
    for (const ch of str) {
      const g = GL().g[ch];
      const adv = (g ? g[0] : GL().sp) * k;
      if (g) {
        const ang = (s + adv / 2) / r * 360 / TAU;
        const tr = bottom
          ? 'rotate(' + (-ang).toFixed(2) + ' ' + cx + ' ' + cy + ') translate(' + (cx - adv / 2).toFixed(2) + ' ' + (cy + r) + ')'
          : 'rotate(' + ang.toFixed(2) + ' ' + cx + ' ' + cy + ') translate(' + (cx - adv / 2).toFixed(2) + ' ' + (cy - r) + ')';
        out += '<path transform="' + tr + ' scale(' + k.toFixed(5) + ')" d="' + g[1] + '"/>';
      }
      s += adv + ls;
    }
    return out;
  }
  /** word: array of one or two lines. upper and lower sit above and below the band. All capitals. */
  function stampSVG(o) {
    ensureDefs();
    const id = 'sm' + (++sid);
    const lines = o.word;
    const two = lines.length > 1;
    const bandH = two ? 118 : 92;
    const bandY = 150 - bandH / 2;
    const maxW = 268;
    const capR = GL().cap / GL().upm;
    let wordG = '';
    if (!two) {
      let size = 66 / capR;
      const w = runW(lines[0], size, 5);
      if (w > maxW) size *= maxW / w;
      wordG = flat(lines[0], size, 5, 150, (150 + size * capR / 2).toFixed(2));
    } else {
      lines.forEach((ln, i) => {
        let size = 42 / capR;
        const w = runW(ln, size, 3);
        if (w > maxW) size *= maxW / w;
        wordG += flat(ln, size, 3, 150, (i === 0 ? 150 - 8 : 150 + 8 + size * capR).toFixed(2));
      });
    }
    const upper = o.upper ? flat(o.upper, 22.5, 1.9, 150, (bandY - 11).toFixed(1)) : '';
    const lower = o.lower ? flat(o.lower, 24, 2, 150, (bandY + bandH + 31).toFixed(1)) : '';
    return '<svg class="stamp" viewBox="-14 -14 328 328" fill="currentColor" aria-hidden="true" focusable="false">'
      + '<defs><mask id="' + id + '" maskUnits="userSpaceOnUse" x="-20" y="-20" width="340" height="340"><rect x="-20" y="-20" width="340" height="340" fill="#fff"/><g fill="#000">' + wordG + '</g></mask></defs>'
      + '<g filter="url(#' + (o.small ? 'ink-s' : 'ink') + ')">'
      + '<circle cx="150" cy="150" r="144" fill="none" stroke="currentColor" stroke-width="5.5"/>'
      + '<circle cx="150" cy="150" r="134" fill="none" stroke="currentColor" stroke-width="1.7"/>'
      + arcText(o.top || 'BANK KENARI', 25, 3.8, 150, 150, 109, false)
      + arcText(o.bottom || 'BANK FIKTIF', 25, 3.8, 150, 150, 129, true)
      + upper + lower
      + '<rect x="-8" y="' + bandY + '" width="316" height="' + bandH + '" mask="url(#' + id + ')"/>'
      + '<rect x="-13" y="' + (bandY - 6) + '" width="326" height="' + (bandH + 12) + '" fill="none" stroke="currentColor" stroke-width="2"/>'
      + '</g></svg>';
  }
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  /** A Date or 'YYYY-MM-DD' as "05 NOV 2026", or "05 NOV 26" when short. */
  function stampDate(when, short) {
    const d = when instanceof Date ? when : (when ? new Date(String(when).split('-').map(Number)[0], Number(String(when).split('-')[1]) - 1, Number(String(when).split('-')[2])) : new Date());
    return String(d.getDate()).padStart(2, '0') + ' ' + MON[d.getMonth()] + ' ' + (short ? String(d.getFullYear()).slice(2) : d.getFullYear());
  }
  /** A level's rank stamp as an SVG string: {rank, n}, with the date it was earned. */
  function rankStamp(level, date) {
    const up = String(level.rank).toUpperCase();
    return stampSVG({ word: up.length <= 10 ? [up] : up.split(' '), upper: 'LEVEL ' + level.n, lower: stampDate(date, true), small: true });
  }
  function jolt(node, k) {
    const s = k || 1;
    anim(node, [
      { transform: 'translateY(0) rotate(0)' },
      { transform: 'translateY(' + (4 * s) + 'px) rotate(' + (0.24 * s) + 'deg)', offset: 0.14 },
      { transform: 'translateY(' + (-1.4 * s) + 'px) rotate(' + (-0.08 * s) + 'deg)', offset: 0.42 },
      { transform: 'translateY(' + (0.5 * s) + 'px) rotate(0)', offset: 0.7 },
      { transform: 'translateY(0) rotate(0)' }
    ], { duration: 420, easing: 'cubic-bezier(.2,.7,.3,1)' });
  }
  /**
   * The stamp lands in hostEl (which must be position:relative). It falls fast, lands hard, the
   * paper takes the weight, and the UV print flares in the paper.
   * opts: text ('SESUAI'), mission ('1.2' prints MISI 1.2) or small (lower line), upper (the date by default),
   *       size (150), rot (-11), left/top/right/bottom in px (default: right side, vertically centred),
   *       jolt (default: nearest .paper), flare (default true), onImpact(el), still (no motion).
   * Returns the stamp element.
   */
  function stamp(host, opts) {
    const o = opts || {};
    const size = o.size || 150;
    const rot = o.rot == null ? -11 : o.rot;
    const lower = o.mission ? 'MISI ' + o.mission : o.small;
    const svg = stampSVG({ word: [(o.text || 'SESUAI').toUpperCase()], upper: o.upper || stampDate(new Date()), lower: lower ? String(lower).toUpperCase() : undefined });
    const pos = {};
    for (const side of ['left', 'top', 'right', 'bottom']) if (o[side] != null) pos[side] = o[side] + 'px';
    const hasPos = Object.keys(pos).length > 0;
    const node = el('div', {
      class: 'stamp-fx',
      style: Object.assign({ width: size + 'px', height: size + 'px', transform: 'rotate(' + rot + 'deg)' }, hasPos ? pos : { right: '12px', top: 'calc(50% - ' + size / 2 + 'px)' }),
      html: svg
    });
    host.append(node);
    const paper = o.jolt === false ? null : (o.jolt || host.closest('.paper') || host);
    const impact = () => {
      sound.thunk();
      if (paper) jolt(paper);
      if (o.flare !== false) uvFlare(paper || host, node, o.flare === 'rings');
      if (o.onImpact) o.onImpact(node);
    };
    if (o.still || !motionOK()) {
      if (!o.still) sound.thunk();
      if (o.onImpact) o.onImpact(node);
      return node;
    }
    const dur = 400;
    anim(node, [
      { transform: 'translateY(-60px) scale(2.5) rotate(' + (rot - 10) + 'deg)', opacity: 0, offset: 0 },
      { transform: 'translateY(-40px) scale(2.05) rotate(' + (rot - 7) + 'deg)', opacity: 0.32, offset: 0.34 },
      { transform: 'translateY(0) scale(.95) rotate(' + rot + 'deg)', opacity: 1, offset: 0.68, easing: 'cubic-bezier(.2,.7,.3,1)' },
      { transform: 'translateY(0) scale(1.014) rotate(' + rot + 'deg)', opacity: 1, offset: 0.84 },
      { transform: 'translateY(0) scale(1) rotate(' + rot + 'deg)', opacity: 1, offset: 1 }
    ], { duration: dur, easing: 'cubic-bezier(.62,0,.96,.42)' });
    setTimeout(() => {
      impact();
      setTimeout(() => node.classList.add('settled'), 90);
    }, dur * 0.68);
    return node;
  }

  /* ---------- Guilloche and UV print ---------- */
  const LACE = [
    [18, 0.12, 0.075, 9, 0, 0, 0, 0.8],
    [27, 0.3, 0.07, 9, 0.022, 27, 1, 0.95],
    [36, 0.5, 0.095, 12, 0.03, 36, 1, 1],
    [48, 0.74, 0.1, 16, 0.03, 48, 1, 1],
    [64, 0.93, 0.035, 32, 0, 0, 0, 0.75]
  ];
  const FINE = [
    [12, 0.1, 0.07, 6, 0, 0, 0, 1],
    [24, 0.27, 0.09, 12, 0, 0, 0, 1],
    [32, 0.48, 0.11, 16, 0, 0, 0, 1],
    [40, 0.76, 0.13, 20, 0, 0, 0, 1]
  ];
  const isDark = () => document.documentElement.getAttribute('data-theme') !== 'light';
  function drawRosette(cv, size, rgb, alpha, opts) {
    const o = opts || {};
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = cv.height = Math.round(size * dpr);
    cv.style.width = cv.style.height = size + 'px';
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, size / 2 * dpr, size / 2 * dpr);
    const R = size / 2 * 0.985;
    c.lineWidth = o.lw || 0.5;
    c.globalCompositeOperation = o.add ? 'lighter' : 'source-over';
    const phase = o.phase || 0;
    (o.recipe || LACE).forEach((b) => {
      const n = b[0];
      c.strokeStyle = 'rgba(' + rgb + ',' + (alpha * b[7]) + ')';
      const steps = Math.max(420, Math.max(b[3], b[5]) * 12);
      for (let k = 0; k < n; k++) {
        const ph = k / n * TAU + phase;
        c.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t = i / steps * TAU;
          const r = R * (b[1] + b[2] * Math.cos(b[3] * t + ph) + b[4] * Math.cos(b[5] * t - b[6] * ph));
          const x = r * Math.cos(t), y = r * Math.sin(t);
          if (i) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.closePath();
        c.stroke();
      }
    });
    return c;
  }
  const glyphCache = {};
  function gp(ch) {
    if (!glyphCache[ch]) glyphCache[ch] = new Path2D(GL().g[ch][1]);
    return glyphCache[ch];
  }
  /** The hidden security print: rosette plus microprinted SESUAI and BANK FIKTIF. */
  function drawUV(cv, size, opts) {
    const o = opts || {};
    const rgb = o.rgb || cssv('--uv-rgb');
    const dark = o.dark != null ? o.dark : isDark();
    const c = drawRosette(cv, size, rgb, dark ? 0.62 : 0.5, { add: dark, phase: 0.6 });
    const R = size / 2 * 0.985;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = 'rgb(' + rgb + ')';
    const ring = (txt, r, sz, ls) => {
      const k = sz / GL().upm;
      let total = 0;
      for (const ch of txt) total += (GL().g[ch] ? GL().g[ch][0] : GL().sp) * k + ls;
      const reps = Math.floor(TAU * r / total);
      const scale = TAU * r / (reps * total);
      for (let q = 0; q < reps; q++) {
        let s = q * total * scale;
        for (const ch of txt) {
          const adv = (GL().g[ch] ? GL().g[ch][0] : GL().sp) * k;
          if (GL().g[ch]) {
            c.save();
            c.rotate(s / r);
            c.translate(0, -r);
            c.scale(k, k);
            c.globalAlpha = 0.85;
            c.fill(gp(ch));
            c.restore();
          }
          s += (adv + ls) * scale;
        }
      }
    };
    ring('SESUAI ', R * 0.505, 24, 2.4);
    ring('BANK KENARI BANK FIKTIF ', R * 0.74, 16, 2);
    ring('SESUAI ', R * 0.3, 20, 2);
    if (o.noWord) return c;
    const word = 'SESUAI';
    const sz = R * 0.29, k = sz / GL().upm;
    let w = 0;
    for (const ch of word) w += GL().g[ch][0] * k + 4;
    let x = -w / 2;
    c.globalAlpha = 0.9;
    for (const ch of word) {
      c.save();
      c.translate(x, sz * 0.4);
      c.scale(k, k);
      c.fill(gp(ch));
      c.restore();
      x += GL().g[ch][0] * k + 4;
    }
    c.globalAlpha = 1;
    return c;
  }
  /* The flare canvas is drawn once at idle, so the stamp moment never stutters on an office laptop. */
  const flareSources = {};
  /* rings: the rosette and microprint with no big SESUAI, for a stamp that carries another word, such as a rank. */
  function prepFlare(rings) {
    const key = rings ? 'rings' : 'word';
    if (flareSources[key] || !motionOK()) return;
    const cv = document.createElement('canvas');
    drawUV(cv, 760, { rgb: cssv('--uv-paper-rgb'), dark: false, noWord: !!rings });
    flareSources[key] = cv;
  }
  function uvFlare(paper, stampNode, rings) {
    if (!motionOK() || !paper) return;
    prepFlare(rings);
    const flareSource = flareSources[rings ? 'rings' : 'word'];
    if (getComputedStyle(paper).position === 'static') return;
    const pr = paper.getBoundingClientRect(), sr = stampNode.getBoundingClientRect();
    const u = el('div', { class: 'uvflare', 'aria-hidden': 'true', style: { '--px': (sr.left + sr.width / 2 - pr.left) + 'px', '--py': (sr.top + sr.height / 2 - pr.top) + 'px' } });
    const cv = document.createElement('canvas');
    cv.width = flareSource.width;
    cv.height = flareSource.height;
    /* A rank stamp is the whole message: its rings stay close to it, so the sheet's words stay readable. */
    const shown = rings ? Math.min(760, Math.round(sr.width * 2.7)) : 760;
    cv.style.width = cv.style.height = shown + 'px';
    cv.getContext('2d').drawImage(flareSource, 0, 0);
    u.append(el('i'), cv);
    paper.append(u);
    anim(u, [{ opacity: 0 }, { opacity: 1, offset: 0.05 }, { opacity: 0.8, offset: 0.26 }, { opacity: 0 }], { duration: 1500, easing: 'ease-out' });
    anim(cv, [{ transform: 'scale(.85) rotate(-5deg)' }, { transform: 'scale(1.05) rotate(4deg)' }], { duration: 1500, easing: 'cubic-bezier(.1,.75,.2,1)' });
    setTimeout(() => u.remove(), 1560);
  }

  /**
   * Counter-rotating rosettes in host. The host needs class "gl" with its own --cx and --cy.
   * Painted at idle and repainted when the theme changes. opts: k (strength), uv (true adds the UV layer for the lamp).
   */
  function guilloche(host, size, opts) {
    const o = opts || {};
    const a = el('canvas', { class: 'gl-a' }), b = el('canvas', { class: 'gl-b' });
    host.append(a, b);
    let uvWrap = null;
    if (o.uv) { uvWrap = el('div', { class: 'gl-uvwrap' }, el('canvas')); host.append(uvWrap); }
    const paint = () => {
      const rgb = cssv('--lace-rgb');
      const la = parseFloat(cssv('--lace-a')), lb = parseFloat(cssv('--lace-b'));
      const add = isDark();
      drawRosette(a, size, rgb, la * (o.k || 1), { add });
      drawRosette(b, size, rgb, lb * (o.k || 1), { add, recipe: FINE, phase: 0.21 });
      if (uvWrap && uvWrap.firstChild.dataset.drawn) drawUV(uvWrap.firstChild, size);
    };
    host._paint = paint;
    host.classList.add('gl-painted');
    whenIdle(paint);
    return {
      /** Draw the UV layer now (call once, on the first pointer move). */
      prepUV() { if (uvWrap && !uvWrap.firstChild.dataset.drawn) { uvWrap.firstChild.dataset.drawn = '1'; drawUV(uvWrap.firstChild, size); } return uvWrap; },
      uvWrap,
      destroy() { host.innerHTML = ''; host._paint = null; }
    };
  }

  /* ---------- Sound: off by default, short and quiet ---------- */
  const sound = {
    ctx: null,
    ready() {
      if (!K.State || !K.State.settings().sound) return false;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return true;
      } catch (e) { return false; }
    },
    thunk() {
      if (!this.ready()) return;
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(46, t + 0.13);
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 0.22);
      const n = c.createBufferSource(), b = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      n.buffer = b;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1400;
      const g2 = c.createGain();
      g2.gain.value = 0.09;
      n.connect(f).connect(g2).connect(c.destination);
      n.start(t);
    },
    print(rows) {
      if (!this.ready()) return;
      const c = this.ctx, t0 = c.currentTime;
      for (let r = 0; r < Math.min(rows, 20); r++) {
        const o = c.createOscillator(), g = c.createGain(), t = t0 + r * 0.034;
        o.type = 'square';
        o.frequency.value = 1500 + (r % 3) * 120;
        g.gain.setValueAtTime(0.012, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.024);
        o.connect(g).connect(c.destination);
        o.start(t);
        o.stop(t + 0.03);
      }
    }
  };

  /* ---------- Theme ---------- */
  function weaveURI(rgb) {
    const w = 240, h = 36, strands = 7;
    let out = '';
    for (let k = 0; k < strands; k++) {
      const ph = k / strands * TAU;
      let d = '';
      for (let x = 0; x <= w; x += 3) {
        const y = h / 2 + (h / 2 - 1) * (0.72 * Math.sin(TAU * 4 * x / w + ph) + 0.28 * Math.sin(TAU * 12 * x / w - 2 * ph));
        d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(2);
      }
      out += '<path d="' + d + '"/>';
    }
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><g fill="none" stroke="rgb(' + rgb + ')" stroke-opacity=".6" stroke-width=".7">' + out + '</g></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  /** Reads the saved theme, sets data-theme, theme-color and the weave, and repaints canvases. */
  function applyTheme() {
    const mode = K.State ? K.State.settings().theme : 'system';
    const dark = mode === 'dark' || (mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    const root = document.documentElement;
    const changed = root.getAttribute('data-theme') !== (dark ? 'dark' : 'light');
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#06181D' : '#DAE5E1');
    root.style.setProperty('--weave', weaveURI(cssv('--weave-rgb')));
    if (changed) {
      document.querySelectorAll('.gl-painted').forEach((g) => g._paint && g._paint());
      document.dispatchEvent(new CustomEvent('kenari:theme', { detail: { dark } }));
    }
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (K.State && K.State.settings().theme === 'system') applyTheme();
  });
  document.documentElement.style.setProperty('--grain', 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .38 0 0 0 0 .36 0 0 0 0 .28 0 0 0 .2 0"/></filter><rect width="240" height="240" filter="url(#n)"/></svg>') + '")');

  /* ---------- Copy for Claude ---------- */
  const plainOf = (html) => String(html == null ? '' : html)
    .replace(/\[\[demo:[^\]]+\]\]/g, ' ')
    .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1')
    .replace(/<\/(p|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

  function tablesFor(sql, fallbackAll) {
    const schema = KenariData.SCHEMA;
    const used = schema.filter((t) => new RegExp('\\b' + t.t + '\\b', 'i').test(sql || ''));
    const list = used.length ? used : (fallbackAll ? schema : []);
    return list.map((t) => '- ' + t.t + ' (' + t.c.map((c) => c[0]).join(', ') + ')').join('\n');
  }
  function outcomeText(outcome) {
    if (outcome == null) return 'I have not run it yet.';
    if (typeof outcome === 'string') return outcome;
    switch (outcome.kind) {
      case 'blanks': return 'I still have blanks to fill in.';
      case 'empty': return 'The editor is empty.';
      case 'timeout': return 'The query was stopped after 8 seconds.';
      case 'engine': return 'The database engine did not respond.';
      case 'error': return plainOf(outcome.error.title + '. ' + outcome.error.plain) + '\nThe database said: ' + outcome.error.raw;
      case 'checked': {
        const v = outcome.verdict || {};
        const last = outcome.results && outcome.results[outcome.results.length - 1];
        const rows = last ? ' My result has ' + rowsWord(last.rows.length) + ' and these columns: ' + last.columns.join(', ') + '.' : '';
        return plainOf(v.state === 'pass' ? 'It passed the check. I would like to understand why it works.' : (v.title || '') + '. ' + (v.body || '')) + rows;
      }
      default: return String(outcome);
    }
  }
  /**
   * Copies a tutoring prompt, toasts what was copied, and offers the claude.ai link.
   * kind: 'mission' | 'review' | 'scratch'. lesson and sql as you would expect.
   * outcome: a string, or the object Kenari.evaluate returned. The learner's text never goes in a URL.
   */
  function copyForClaude(o) {
    const opt = o || {};
    const sql = opt.sql || '';
    let prompt;
    let said;
    if (opt.kind === 'scratch') {
      prompt = 'I am practicing SQL in Kenari Collection SQL Lab, on a made-up bank database that runs in my browser (SQLite). Please explain this query line by line in plain English, then tell me one way to make it better.\n\n'
        + 'Tables:\n' + tablesFor(sql, true) + '\n\nMy query:\n' + sql + '\n\nWhat happened:\n' + outcomeText(opt.outcome);
      said = 'Copied a prompt that asks Claude to explain your query line by line. If it holds anything from work, remove customer data before you paste.';
    } else {
      const l = opt.lesson || {};
      prompt = 'I am learning SQL in Kenari Collection SQL Lab, a practice site with a made-up bank (Bank Kenari), running SQLite. Please tutor me. Do not give me the final query. Point me to the part to look at, and ask me one question at a time.\n\n'
        + 'Mission ' + l.id + ': ' + l.title + '\n'
        + (l.newIdea ? 'The idea of this mission: ' + plainOf(l.newIdea) + '\n' : '')
        + 'The request: ' + plainOf(l.task || l.question) + '\n\n'
        + 'Tables:\n' + tablesFor(l.solution, true) + '\n\n'
        + 'My query:\n' + sql + '\n\nWhat happened:\n' + outcomeText(opt.outcome);
      said = 'Copied a tutoring prompt with this mission, the tables and your query.';
    }
    return writeClipboard(prompt).then((ok) => {
      const body = el('span', {}, ok ? said + ' ' : 'Your browser blocked the clipboard, so nothing was copied. ');
      if (ok) body.append(el('a', { href: 'https://claude.ai/new', target: '_blank', rel: 'noopener noreferrer', text: 'Open claude.ai' }));
      toast(body, { ms: 7000 });
      return ok;
    });
  }

  K.UI = {
    el, esc, hl, code, rich, ledger, toast, copy, stamp, modal, sheet, confirmInPage, closeDialogs, setTitle, announce, copyForClaude,
    plainOf, toTSV,
    /* Extras other screens need */
    SQL_KEYWORDS, SQL_FUNCTIONS, KOL_GRADES, icons: ICONS, motionOK, isMac, coarse, whenIdle, anim,
    runKeys: () => (isMac() ? '\u2318 Enter' : 'Ctrl Enter'),
    dm, qd, rosette, stampSVG, rankStamp, stampDate, jolt, prepFlare, guilloche, drawUV, sound, applyTheme
  };
})();
