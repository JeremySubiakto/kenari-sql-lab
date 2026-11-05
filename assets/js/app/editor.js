/*
 * Kenari.Editor: the custom SQL editor. A transparent textarea over a highlighted pre.
 *
 * How the two layers stay aligned, always:
 * - The textarea never scrolls by itself. It is exactly as large as the highlighted pre, and both sit in one
 *   scroll box, so scrolling moves them together with no script involved and no lag.
 * - Below 1000px wide, long lines soft-wrap in both layers, with the same width and the same wrapping rules.
 *   The line numbers go away there, and positions are read from the highlight layer instead of the monospace grid.
 * - Both layers use one font face. Colors tell tokens apart. Bold and italic would pull in other font files,
 *   which can load late or be blocked, and their widths can differ. See editor.css.
 * - The tokenizer keeps every character of the text, so the layers always hold the same string.
 *
 * Every edit made here goes through execCommand when the textarea has focus, so the browser's own undo keeps working.
 * API: docs/APP-API.md, under Kenari.Editor.
 */
(function () {
  'use strict';
  const K = (window.Kenari = window.Kenari || {});

  /* ---------- Tokenizer ---------- */
  const TOKEN = /(--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:[^']|'')*'?)|(_{3,})|(\d[\w.]*)|("[^"\n]*"?|[A-Za-z_]\w*)|(\s+)|([^])/y;
  const IS_NUM = /^\d+(?:\.\d*)?(?:[eE]\d+)?$/;
  let kwSet = null, fnSet = null;
  const sets = () => {
    if (!kwSet) {
      kwSet = new Set((K.UI && K.UI.SQL_KEYWORDS) || []);
      fnSet = new Set((K.UI && K.UI.SQL_FUNCTIONS) || []);
    }
  };

  /** Cut a text token around any blanks inside it. check.js counts those as blanks too, as in strftime('____', d). */
  function pushSplit(out, kind, text, a, b) {
    const piece = text.slice(a, b);
    if (!piece.includes('___')) { out.push({ k: kind, a, b }); return; }
    let at = a, m;
    const re = /_{3,}/g;
    while ((m = re.exec(piece))) {
      const s = a + m.index, e = s + m[0].length;
      if (s > at) out.push({ k: kind, a: at, b: s });
      out.push({ k: 'blank', a: s, b: e });
      at = e;
    }
    if (at < b) out.push({ k: kind, a: at, b });
  }

  /** Returns tokens that cover the text with no gaps, so nothing can ever drop out of the highlight layer. */
  function tokenize(text) {
    sets();
    const out = [];
    let pos = 0;
    TOKEN.lastIndex = 0;
    while (pos < text.length) {
      TOKEN.lastIndex = pos;
      const m = TOKEN.exec(text);
      if (!m || !m[0]) { out.push({ k: 'pun', a: pos, b: pos + 1 }); pos++; continue; }
      const a = pos, b = pos + m[0].length;
      if (m[1]) out.push({ k: 'com', a, b });
      else if (m[2]) pushSplit(out, 'str', text, a, b);
      else if (m[3]) out.push({ k: 'blank', a, b });
      else if (m[4]) out.push({ k: IS_NUM.test(m[4]) ? 'num' : 'id', a, b });
      else if (m[5]) {
        const up = m[5].toUpperCase();
        if (kwSet.has(up)) out.push({ k: 'kw', a, b });
        else if (fnSet.has(up)) out.push({ k: 'fn', a, b });
        else pushSplit(out, 'id', text, a, b);
      }
      else if (m[6]) out.push({ k: 'sp', a, b });
      else out.push({ k: 'pun', a, b });
      pos = b;
    }
    return out;
  }

  const CLASS = { com: 't-com', str: 't-str', num: 't-num', kw: 't-kw', fn: 't-fn', pun: 't-pun' };
  const escHtml = (s) => s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));

  function renderTokens(text, tokens, mark) {
    let out = '', blank = -1;
    const piece = (t, a, b) => {
      const s = escHtml(text.slice(a, b));
      if (t.k === 'blank') return '<span class="t-blank" data-blank="' + blank + '">' + s + '</span>';
      const c = CLASS[t.k];
      return c ? '<span class="' + c + '">' + s + '</span>' : s;
    };
    for (const t of tokens) {
      if (t.k === 'blank') blank++;
      const cuts = [t.a];
      if (mark) {
        if (mark[0] > t.a && mark[0] < t.b) cuts.push(mark[0]);
        if (mark[1] > t.a && mark[1] < t.b) cuts.push(mark[1]);
      }
      cuts.push(t.b);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i], b = cuts[i + 1];
        if (mark && a === mark[0]) out += '<span class="t-err">';
        out += piece(t, a, b);
        if (mark && b === mark[1]) out += '</span>';
      }
    }
    return out;
  }

  /* ---------- Vocabulary for suggestions ---------- */
  const MEANINGS = {
    'SELECT': 'choose the columns to show', 'FROM': 'choose the table', 'WHERE': 'keep only the rows that match',
    'AND': 'both rules must hold', 'OR': 'either rule can hold', 'NOT': 'the opposite of a rule',
    'GROUP BY': 'one row per group', 'ORDER BY': 'sort the rows', 'HAVING': 'keep only the groups that match',
    'LIMIT': 'stop after this many rows', 'JOIN': 'bring in another table', 'LEFT JOIN': 'keep every row from the first table',
    'INNER JOIN': 'keep only rows that match in both', 'ON': 'how the two tables connect', 'AS': 'give it a short name',
    'DISTINCT': 'drop repeated rows', 'BETWEEN': 'a range, both ends included', 'LIKE': 'a text pattern, % means anything',
    'IN': 'any value in this list', 'IS': 'used with NULL', 'NULL': 'no value here', 'CASE': 'if this, then that',
    'WHEN': 'the condition in a CASE', 'THEN': 'the value when it holds', 'ELSE': 'the value otherwise', 'END': 'closes a CASE',
    'ASC': 'low to high', 'DESC': 'high to low', 'UNION': 'stack two results', 'WITH': 'name a step to use later',
    'EXISTS': 'true when a subquery finds a row', 'OVER': 'runs as a window', 'PARTITION BY': 'restart the window per group',
    'INSERT': 'add rows', 'UPDATE': 'change rows', 'DELETE': 'remove rows', 'CREATE': 'make a table or view', 'DROP': 'remove a table',
    'COUNT': 'how many rows', 'SUM': 'add up a column', 'AVG': 'the average', 'MIN': 'the smallest value', 'MAX': 'the largest value',
    'ROUND': 'round a number', 'COALESCE': 'first value that is not NULL', 'UPPER': 'text to capitals', 'LOWER': 'text to small letters',
    'LENGTH': 'how many characters', 'SUBSTR': 'part of a text', 'TRIM': 'remove spaces at the ends', 'STRFTIME': 'format a date',
    'DATE': 'a date, or date arithmetic', 'JULIANDAY': 'days as a number, for subtracting dates', 'CAST': 'change a value\'s type',
    'RANK': 'position, ties share a rank', 'DENSE_RANK': 'position with no gaps', 'ROW_NUMBER': 'number the rows', 'LAG': 'the value from the row before', 'LEAD': 'the value from the row after',
    'IFNULL': 'a fallback for NULL', 'NULLIF': 'NULL when two values match'
  };
  /* Keywords a beginner meets first come first. Two-word forms replace their first word. */
  const COMMON = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'JOIN', 'LEFT JOIN', 'INNER JOIN', 'ON', 'AS', 'DISTINCT', 'BETWEEN', 'LIKE', 'IN', 'NOT', 'NULL', 'IS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ASC', 'DESC', 'UNION', 'WITH', 'PARTITION BY', 'OVER'];
  const COVERED = new Set(['GROUP', 'ORDER', 'BY', 'PARTITION', 'LEFT', 'INNER']);

  let vocabCache = null;
  function vocab() {
    if (vocabCache) return vocabCache;
    sets();
    const schema = (window.KenariData && window.KenariData.SCHEMA) || [];
    const tables = new Map(), cols = [];
    const colMeaning = new Map();
    for (const t of schema) {
      tables.set(t.t.toLowerCase(), t);
      for (const [name, meaning] of t.c) {
        if (!colMeaning.has(name)) { colMeaning.set(name, meaning); cols.push(name); }
      }
    }
    const kws = COMMON.slice();
    for (const w of kwSet) if (!kws.includes(w) && !COVERED.has(w)) kws.push(w);
    vocabCache = { schema, tables, cols, colMeaning, kws, fns: [...fnSet] };
    return vocabCache;
  }

  /** The tables a query already names, with their short names. Strings and comments are masked out first. */
  function readQuery(text, tokens) {
    let clean = '';
    for (const t of tokens) clean += t.k === 'com' ? ' ' : t.k === 'str' ? "''" : text.slice(t.a, t.b);
    const NOT_ALIAS = /^(WHERE|ON|USING|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|NATURAL|GROUP|ORDER|HAVING|LIMIT|UNION|EXCEPT|INTERSECT|SET|VALUES|SELECT|AS|WINDOW)$/i;
    const found = [], own = [];
    const add = (name, alias) => {
      if (!name) return;
      found.push({ name: name.toLowerCase(), alias: alias && !NOT_ALIAS.test(alias) ? alias.toLowerCase() : null });
    };
    let m;
    const one = /\b(?:JOIN|UPDATE|INTO)\s+([A-Za-z_]\w*)(?:\s+(?:AS\s+)?([A-Za-z_]\w*))?/gi;
    while ((m = one.exec(clean))) add(m[1], m[2]);
    const list = /\bFROM\s+([^;()]*?)(?=\b(?:WHERE|GROUP|ORDER|HAVING|LIMIT|UNION|EXCEPT|INTERSECT|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|NATURAL|ON|USING|WINDOW)\b|[;()]|$)/gi;
    while ((m = list.exec(clean))) {
      for (const part of m[1].split(',')) {
        const p = /^\s*([A-Za-z_]\w*)(?:\s+(?:AS\s+)?([A-Za-z_]\w*))?\s*$/.exec(part);
        if (p) add(p[1], p[2]);
      }
    }
    const cte = /(?:\bWITH\s+(?:RECURSIVE\s+)?|,\s*)([A-Za-z_]\w*)(?:\s*\([^)]*\))?\s+AS\s*\(/gi;
    while ((m = cte.exec(clean))) own.push(m[1]);
    const made = /\bCREATE\s+(?:TEMP(?:ORARY)?\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_]\w*)/gi;
    while ((m = made.exec(clean))) own.push(m[1]);
    return { found, own };
  }

  const FROM_LIKE = /^(FROM|JOIN|INTO|UPDATE|TABLE)$/i;
  const VALUE_LIKE = /^(SELECT|DISTINCT|WHERE|AND|OR|NOT|ON|BY|HAVING|WHEN|THEN|ELSE|CASE|SET|BETWEEN|IN|LIKE)$/i;
  const MAX_ITEMS = 6;

  function suggest(prefix, ctx) {
    const v = vocab();
    const lw = prefix.toLowerCase();
    const hit = (s) => s.toLowerCase().startsWith(lw);
    const col = (name, d) => ({ t: name, kind: 'col', d: d || v.colMeaning.get(name) || '', ins: name });
    const table = (t) => ({ t: t.t, kind: 'table', d: t.d, ins: t.t });
    const kw = (w) => ({ t: w, kind: 'kw', d: MEANINGS[w] || 'keyword', ins: w + ' ' });
    const fn = (w) => ({ t: w, kind: 'fn', d: MEANINGS[w] || 'function', ins: w + '(' });

    if (ctx.qualifier) {
      const q = ctx.qualifier.toLowerCase();
      const ref = ctx.query.found.find((f) => f.alias === q || f.name === q);
      const t = v.tables.get(ref ? ref.name : q);
      if (!t) return [];
      return t.c.filter((c) => hit(c[0])).map((c) => col(c[0], c[1]));
    }

    const inQuery = [];
    const seen = new Set();
    for (const f of ctx.query.found) {
      const t = v.tables.get(f.name);
      if (!t) continue;
      for (const c of t.c) if (hit(c[0]) && !seen.has(c[0])) { seen.add(c[0]); inQuery.push(col(c[0], c[1])); }
    }
    const own = [...new Set(ctx.query.own)].filter((n) => hit(n)).map((n) => ({ t: n, kind: 'table', d: 'named in this query', ins: n }));
    const tables = v.schema.filter((t) => hit(t.t)).map(table);
    const others = v.cols.filter((c) => hit(c) && !seen.has(c)).map((c) => col(c));
    const kws = v.kws.filter(hit).map(kw);
    const fns = v.fns.filter(hit).map(fn);

    let order;
    if (FROM_LIKE.test(ctx.prev)) order = [own, tables, kws];
    else if (VALUE_LIKE.test(ctx.prev) || ctx.prev === ',' || ctx.prev === '(') order = [inQuery, others, own, fns, kws, tables];
    else if (!ctx.prev || ctx.prev === ';') order = [kws, own, inQuery, tables, others, fns];
    else order = [inQuery, kws, own, tables, others, fns];
    return order.flat().slice(0, MAX_ITEMS + 4);
  }

  /* ---------- Small helpers ---------- */
  const CURLY = /[\u2018\u2019\u201A\u201B\u2032\u201C\u201D\u201E\u2033\u00A0\u2009\u202F\u200B\u2013\u2014]/;
  /** Word processors and phone keyboards swap in curly quotes and long dashes, which SQL cannot read. */
  const straighten = (s) => s
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u00A0\u2009\u202F]/g, ' ')
    .replace(/\u200B/g, '')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-');

  const isWord = (c) => !!c && /\w/.test(c);
  const coarse = () => (K.UI && K.UI.coarse ? K.UI.coarse() : matchMedia('(pointer: coarse)').matches);
  /* A tablet's on-screen keyboard has the full key set, and its docked console needs the bottom of the screen. */
  const isPhone = () => coarse() && window.innerWidth < 1000;
  /** Where a column goes in a SELECT list, and the comma it needs. Outside a list it changes nothing. */
  function listFit(value, s, e, text) {
    const before = value.slice(0, s);
    const m = /\bSELECT\b(?![\s\S]*\b(?:SELECT|FROM)\b)([\s\S]*)$/i.exec(before);
    if (!m) return { s, t: text };
    const list = m[1];
    const count = (re) => (list.match(re) || []).length;
    if (count(/\(/g) > count(/\)/g) || count(/\bCASE\b/gi) > count(/\bEND\b/gi)) return { s, t: text };
    const tail = list.replace(/\s+$/, '');
    const needsBefore = /[\w)"'\]]$/.test(tail) && !/\b(?:DISTINCT|ALL|AS)$/i.test(tail);
    const after = value.slice(e);
    const nextWord = /^\s*([\w."]+)/.exec(after);
    const needsAfter = !!nextWord && !/^(?:FROM|WHERE|GROUP|HAVING|ORDER|LIMIT|UNION|AS)$/i.test(nextWord[1]);
    let t = text;
    let from = s;
    if (needsBefore) { t = ', ' + t; from = s - (list.length - tail.length); }
    if (needsAfter) t += ', ';
    return { s: from, t };
  }

  const runKeys = () => (K.UI && K.UI.runKeys ? K.UI.runKeys() : 'Ctrl Enter');
  const div = (cls) => { const d = document.createElement('div'); d.className = cls; return d; };
  let uid = 0;

  /* Common tokens for phones. Words carry their own space. */
  const KEYS = [
    ['SELECT', 'SELECT '], ['FROM', 'FROM '], ['WHERE', 'WHERE '], ['*', '*'], [',', ', '], ["'", "'"], ['=', '= '],
    ['(', '('], [')', ')'], [';', ';'], ['AND', 'AND '], ['GROUP BY', 'GROUP BY '], ['ORDER BY', 'ORDER BY ']
  ];

  /* ---------- Editor ---------- */
  function create(host, options) {
    const o = options || {};
    const lines = o.lines || { min: 6, max: 24 };
    const n = ++uid;

    const root = div('ed');
    if (o.id != null) root.dataset.edId = o.id;
    root.style.setProperty('--ed-min', lines.min);
    root.style.setProperty('--ed-max', lines.max);

    const scroller = div('ed-scroll');
    const grid = div('ed-grid');
    const gutter = div('ed-g');
    gutter.setAttribute('aria-hidden', 'true');
    const code = div('ed-code');
    const cur = div('ed-cur');
    const probe = document.createElement('span');
    probe.className = 'ed-probe';
    probe.setAttribute('aria-hidden', 'true');
    probe.textContent = '0'.repeat(40);
    const pre = document.createElement('pre');
    pre.className = 'ed-hl';
    pre.setAttribute('aria-hidden', 'true');
    const ta = document.createElement('textarea');
    ta.className = 'ed-ta';
    const wrapQuery = matchMedia('(max-width: 999px)');
    const wrapped = () => wrapQuery.matches;
    ta.wrap = wrapped() ? 'soft' : 'off';
    ta.rows = 1;
    ta.spellcheck = false;
    ta.placeholder = o.placeholder == null ? 'Write your query here.' : o.placeholder;
    for (const [k, v] of Object.entries({
      autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'aria-label': o.label || 'SQL editor',
      'data-gramm': 'false', 'data-gramm_editor': 'false', 'data-enable-grammarly': 'false', 'data-lt-active': 'false'
    })) ta.setAttribute(k, v);
    const help = document.createElement('span');
    help.className = 'vh';
    help.id = 'ed-help-' + n;
    help.textContent = 'Tab moves to the next blank. ' + runKeys() + ' runs the query. Escape leaves the editor.';
    ta.setAttribute('aria-describedby', help.id);
    code.append(cur, probe, pre, ta);
    grid.append(gutter, code);
    scroller.append(grid);
    root.append(scroller, help);
    host.append(root);

    /* State */
    let tokens = [], blanks = [], mark = null, activeBlank = -1;
    let internal = false, composing = false, dragging = false, touched = false, destroyed = false;
    let lineCount = 0, curLine = -1;

    /* ----- Geometry from the monospace grid ----- */
    const metrics = () => {
      const cs = getComputedStyle(ta);
      return {
        ch: probe.getBoundingClientRect().width / 40,
        lh: parseFloat(cs.lineHeight) || 26,
        padL: parseFloat(cs.paddingLeft) || 0,
        padT: parseFloat(cs.paddingTop) || 0
      };
    };
    const tabSize = 2;
    const gridOf = (offset) => {
      const before = ta.value.slice(0, offset);
      const nl = before.lastIndexOf('\n');
      let line = 0;
      for (let i = before.indexOf('\n'); i >= 0; i = before.indexOf('\n', i + 1)) line++;
      let col = 0;
      for (let i = nl + 1; i < before.length; i++) col += before[i] === '\t' ? tabSize - (col % tabSize) : 1;
      return { line, col };
    };
    /** With soft wrap the grid cannot say where a character is, but the highlight layer holds the same text in the same place. */
    const placeWrapped = (offset, m) => {
      const walk = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
      let left = offset, node = null, last = null;
      while ((node = walk.nextNode())) {
        last = node;
        if (left < node.length) break;
        left -= node.length;
      }
      if (!node) return null;
      const range = document.createRange();
      range.setStart(node, left);
      range.setEnd(node, left + 1);
      const rects = range.getClientRects();
      const r = rects[rects.length - 1];
      if (!r || !r.height) return null;
      const c = code.getBoundingClientRect();
      const line = Math.max(0, Math.round((r.top + r.height / 2 - c.top - m.padT - m.lh / 2) / m.lh));
      return { x: r.left - c.left, y: m.padT + line * m.lh, lh: m.lh, ch: m.ch, line, col: 0 };
    };
    /** Position of a text offset, in the coordinates of the code layer. */
    const place = (offset) => {
      const m = metrics();
      if (wrapped() && pre.offsetParent) {
        const p = placeWrapped(offset, m);
        if (p) return p;
      }
      const g = gridOf(offset);
      return { x: m.padL + g.col * m.ch, y: m.padT + g.line * m.lh, lh: m.lh, ch: m.ch, line: g.line, col: g.col };
    };
    const clientRectOf = (a, b) => {
      const c = code.getBoundingClientRect(), p = place(a), q = place(b == null ? a : b);
      return { left: c.left + p.x, top: c.top + p.y, right: c.left + q.x, bottom: c.top + q.y + q.lh, width: q.x - p.x, height: q.y + q.lh - p.y };
    };

    /** Keep an offset in view inside the editor's own scroll box, clear of the sticky line numbers. */
    const reveal = (offset) => {
      const p = place(offset);
      const gw = gutter.offsetWidth;
      const left = p.x;
      const roomL = scroller.scrollLeft + p.ch * 2;
      const roomR = scroller.scrollLeft + scroller.clientWidth - gw - p.ch * 3;
      if (!wrapped()) {
        if (left < roomL) scroller.scrollLeft = Math.max(0, left - p.ch * 8);
        else if (left > roomR) scroller.scrollLeft = left - scroller.clientWidth + gw + p.ch * 8;
      }
      const top = p.y, bot = p.y + p.lh, pad = parseFloat(getComputedStyle(ta).paddingTop) || 0;
      if (top < scroller.scrollTop + 2) scroller.scrollTop = Math.max(0, top - pad);
      else if (bot > scroller.scrollTop + scroller.clientHeight - 2) scroller.scrollTop = bot - scroller.clientHeight + pad;
    };

    /* ----- Painting ----- */
    const updateFade = () => {
      root.classList.toggle('more-right', scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
    };
    const paintGutter = () => {
      const count = ta.value.split('\n').length;
      if (count === lineCount) return;
      lineCount = count;
      let html = '';
      for (let i = 1; i <= count; i++) html += '<div>' + i + '</div>';
      gutter.innerHTML = html;
      root.style.setProperty('--ed-digits', Math.max(2, String(count).length));
      curLine = -1;
    };
    const paint = () => {
      const text = ta.value;
      tokens = tokenize(text);
      blanks = tokens.filter((t) => t.k === 'blank').map((t) => [t.a, t.b]);
      /* The extra line feed keeps a trailing empty line tall enough, as it is in the textarea. */
      pre.innerHTML = renderTokens(text, tokens, mark) + '\n';
      paintGutter();
      activeBlank = -1;
      updateFade();
    };

    const blankAt = (s, e) => blanks.findIndex(([a, b]) => s >= a && e <= b);
    const setActive = (ix) => {
      if (ix === activeBlank) return;
      activeBlank = ix;
      pre.querySelectorAll('.t-blank.on').forEach((b) => b.classList.remove('on'));
      if (ix >= 0) {
        const el = pre.querySelector('[data-blank="' + ix + '"]');
        if (el) el.classList.add('on');
      }
      root.classList.toggle('on-blank', ix >= 0);
    };
    const paintCurrentLine = (focused) => {
      const line = wrapped() ? place(ta.selectionEnd).line : gridOf(ta.selectionEnd).line;
      if (line !== curLine) {
        const old = gutter.children[curLine];
        if (old) old.classList.remove('on');
        const now = gutter.children[line];
        if (now) now.classList.add('on');
        curLine = line;
        root.style.setProperty('--ed-line', line);
      }
      root.classList.toggle('has-line', focused && !ta.readOnly);
    };

    /** Reads the selection and brings the painted state in line with it. */
    const syncSelection = (opts) => {
      if (destroyed) return;
      const focused = document.activeElement === ta;
      const s = ta.selectionStart, e = ta.selectionEnd;
      /* A blank is one thing. A caret that lands inside it, by arrow key or tap, takes the whole blank. */
      if (focused && s === e && !dragging && !composing && !ta.readOnly) {
        const inside = blanks.findIndex(([a, b]) => s > a && s < b);
        if (inside >= 0) { ta.setSelectionRange(blanks[inside][0], blanks[inside][1]); return syncSelection(opts); }
      }
      const ix = s === e ? -1 : blankAt(s, e);
      setActive(ix >= 0 && (focused || coarse()) && !ta.readOnly ? ix : -1);
      root.classList.toggle('on-mark', !!mark && s === mark[0] && e === mark[1]);
      paintCurrentLine(focused);
      if (focused && !dragging && !(opts && opts.noReveal)) {
        if (s !== e && ix < 0) reveal(ta.selectionDirection === 'backward' ? s : e);
        else { reveal(e); if (s !== e) reveal(s); }
        keybar.onViewport();
      }
    };

    const fire = () => { if (o.onInput) o.onInput(ta.value); };

    /** Replaces a range. With focus it uses execCommand, which keeps native undo. Without focus it edits directly. */
    const edit = (s, e, text) => {
      const before = ta.value;
      const expected = before.slice(0, s) + text + before.slice(e);
      internal = true;
      let done = false;
      if (document.activeElement === ta && !composing) {
        ta.setSelectionRange(s, e);
        try {
          done = text ? document.execCommand('insertText', false, text) : (s === e ? true : document.execCommand('delete'));
        } catch (err) { done = false; }
        if (ta.value !== expected) done = false;
      }
      if (!done) {
        if (ta.value !== before) ta.value = before;
        ta.setRangeText(text, s, e, 'end');
        afterChange();
      }
      internal = false;
      fire();
    };

    function afterChange() {
      mark = null;
      paint();
      syncSelection();
      guard();
    }
    const guard = () => { if (ta.scrollLeft) ta.scrollLeft = 0; if (ta.scrollTop) ta.scrollTop = 0; };

    /* ----- Blanks ----- */
    const selectBlank = (ix, opts) => {
      if (!blanks.length) return false;
      const k = ((ix % blanks.length) + blanks.length) % blanks.length;
      touched = true;
      if (opts && opts.focus) ta.focus({ preventScroll: true });
      ta.setSelectionRange(blanks[k][0], blanks[k][1]);
      syncSelection();
      if (document.activeElement !== ta) reveal(blanks[k][0]);
      return true;
    };
    /** On touch, selecting a blank must not raise the keyboard by itself. The mission calls focus() when the learner asks. */
    const wantsFocus = () => !coarse() || document.activeElement === ta;

    /* ----- Finding the word to mark ----- */
    const findMark = (token) => {
      const word = String(token);
      const low = ta.value.toLowerCase(), lw = word.toLowerCase();
      const inToken = (kinds, at) => tokens.some((t) => kinds.includes(t.k) && at >= t.a && at < t.b);
      const wordy = /^\w/.test(word), wordEnd = /\w$/.test(word);
      const matches = [];
      for (let i = low.indexOf(lw); i >= 0; i = low.indexOf(lw, i + 1)) {
        if (wordy && isWord(ta.value[i - 1])) continue;
        if (wordEnd && isWord(ta.value[i + word.length])) continue;
        if (inToken(['com'], i)) continue;
        matches.push(i);
      }
      if (!matches.length) return null;
      const plain = matches.filter((i) => !inToken(['str'], i));
      const list = plain.length ? plain : matches;
      let at = list[0];
      /* SQLite names a bracket or comma, not which one. Point at the one that is really out of place. */
      if (word === ')') {
        let depth = 0;
        for (const t of tokens) {
          if (t.k !== 'pun') continue;
          const c = ta.value[t.a];
          if (c === '(') depth++;
          else if (c === ')') { if (depth === 0) { at = t.a; break; } depth--; }
        }
      } else if (word === ',') {
        /* A comma right after an open bracket, or the second of two in a row. */
        const afterOpen = list.find((i) => /\(\s*$/.test(ta.value.slice(0, i)));
        const second = list.find((i) => /,\s*$/.test(ta.value.slice(0, i)));
        if (afterOpen != null) at = afterOpen;
        else if (second != null) at = second;
      }
      return [at, at + word.length];
    };

    /* ----- Autocomplete ----- */
    const ac = { open: false, items: [], ix: 0, arrowed: false, start: 0, timer: 0, suppress: -1, box: null, list: null, foot: null };
    const useChips = () => o.keybar !== false && isPhone();

    const acBox = () => {
      if (ac.box) return ac.box;
      const box = div('ed-ac');
      box.hidden = true;
      const list = div('ed-ac-list');
      list.id = 'ed-ac-' + n;
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', 'Suggestions');
      const foot = div('ed-ac-foot');
      box.append(list, foot);
      box.addEventListener('mousedown', (e) => e.preventDefault());
      box.addEventListener('click', (e) => {
        const b = e.target.closest('.ed-ac-i');
        if (b) { ac.ix = Number(b.dataset.i); acAccept(); }
      });
      (root.closest('dialog') || document.body).append(box);
      ac.box = box; ac.list = list; ac.foot = foot;
      return box;
    };
    const acClose = () => {
      clearTimeout(ac.timer);
      ac.timer = 0;
      if (ac.open) {
        ac.open = false;
        ac.items = [];
        ac.arrowed = false;
        if (ac.box) ac.box.hidden = true;
        ta.removeAttribute('aria-activedescendant');
        ta.removeAttribute('aria-controls');
        if (keybar.el) keybar.paint();
      }
    };
    const acPaintSelection = () => {
      if (useChips() || !ac.list) return;
      [...ac.list.children].forEach((el, i) => {
        el.setAttribute('aria-selected', String(ac.arrowed && i === ac.ix));
        el.classList.toggle('next', !ac.arrowed && i === 0);
      });
      ac.foot.textContent = ac.arrowed ? 'Enter or Tab to accept. Esc to close.' : 'Tab to accept. Esc to close.';
      if (ac.arrowed) {
        ta.setAttribute('aria-activedescendant', 'ed-ac-' + n + '-' + ac.ix);
        const sel = ac.list.children[ac.ix];
        if (sel) sel.scrollIntoView({ block: 'nearest' });
      } else ta.removeAttribute('aria-activedescendant');
    };
    const acPlace = () => {
      if (!ac.open || !ac.box || ac.box.hidden) return;
      const r = clientRectOf(ac.start);
      const vv = window.visualViewport;
      const vTop = vv ? vv.offsetTop : 0;
      const vBot = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const vRight = (vv ? vv.offsetLeft + vv.width : window.innerWidth) - 8;
      const box = ac.box;
      box.style.left = '0px';
      box.style.top = '0px';
      const w = box.offsetWidth, h = box.offsetHeight;
      const below = r.bottom + 4;
      const above = r.top - h - 4;
      const top = below + h <= vBot - 8 || above < vTop + 8 ? below : above;
      box.style.top = Math.round(top) + 'px';
      box.style.left = Math.round(Math.max(8, Math.min(r.left - 8, vRight - w))) + 'px';
    };
    const acShow = (items, start) => {
      ac.items = items;
      ac.start = start;
      ac.ix = 0;
      ac.arrowed = false;
      ac.open = true;
      if (useChips()) { keybar.paint(); return; }
      const box = acBox();
      const esc = (K.UI && K.UI.esc) || escHtml;
      ac.list.innerHTML = items.slice(0, MAX_ITEMS).map((it, i) =>
        '<button type="button" class="ed-ac-i" role="option" tabindex="-1" id="ed-ac-' + n + '-' + i + '" data-i="' + i + '" data-kind="' + it.kind + '">' +
        '<code>' + esc(it.t) + '</code><span>' + esc(it.d) + '</span></button>').join('');
      box.hidden = false;
      ta.setAttribute('aria-controls', ac.list.id);
      acPaintSelection();
      acPlace();
    };
    const acContext = () => {
      const c = ta.selectionStart, text = ta.value;
      if (c !== ta.selectionEnd || ta.readOnly) return null;
      const within = tokens.find((t) => t.a < c && c <= t.b);
      if (within && (within.k === 'com' || within.k === 'str' || within.k === 'blank')) return null;
      if (isWord(text[c])) return null;
      const m = /[A-Za-z_]\w*$/.exec(text.slice(Math.max(0, c - 64), c));
      const word = m ? m[0] : '';
      const start = c - word.length;
      if (isWord(text[start - 1])) return null;
      if (/_{3,}/.test(word)) return null;
      let qualifier = null;
      if (text[start - 1] === '.') {
        const q = /([A-Za-z_]\w*)\.$/.exec(text.slice(Math.max(0, start - 64), start));
        if (!q) return null;
        qualifier = q[1];
      }
      let prev = '';
      for (let i = tokens.length - 1; i >= 0; i--) {
        const t = tokens[i];
        if (t.b > start || t.k === 'sp' || t.k === 'com') continue;
        prev = text.slice(t.a, t.b);
        break;
      }
      return { word, start, qualifier, prev };
    };
    const acRefresh = (force) => {
      const c = acContext();
      if (!c || (!c.qualifier && !force && c.word.length < 2) || ac.suppress === c.start) return acClose();
      const items = suggest(c.word, { qualifier: c.qualifier, prev: c.prev, query: readQuery(ta.value, tokens) });
      const lw = c.word.toLowerCase();
      /* A word that is already complete needs no popup, so Tab and Enter do what they normally do. */
      if (!items.length || (lw && items.some((it) => it.t.toLowerCase() === lw))) return acClose();
      acShow(items, c.start);
    };
    const acSoon = () => {
      clearTimeout(ac.timer);
      if (ac.open) { ac.timer = 0; acRefresh(); return; }
      ac.timer = setTimeout(() => { ac.timer = 0; if (document.activeElement === ta) acRefresh(); }, 90);
    };
    const acAccept = () => {
      const it = ac.items[ac.ix];
      if (!it) return;
      const c = ta.selectionStart;
      let text = it.ins;
      if (text.endsWith(' ') && /\s/.test(ta.value[c] || ' ')) text = ta.value[c] === undefined ? text : text.trimEnd();
      if (it.kind === 'fn' && ta.value[c] === '(') text = text.slice(0, -1);
      const from = ac.start;
      acClose();
      ta.focus({ preventScroll: true });
      edit(from, c, text);
    };

    /* ----- Key bar for phones, shown only while the editor has focus ----- */
    const keybar = {
      el: null, shown: false, sugg: null, keys: null, next: null, raf: 0,
      build() {
        const bar = div('ed-keybar');
        bar.hidden = true;
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute('aria-label', 'Insert a word');
        const sugg = div('ed-keys ed-keys-sugg');
        const keys = div('ed-keys');
        const row = div('ed-keyrow');
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'ed-key ed-key-next';
        next.textContent = 'Next blank';
        next.dataset.next = '1';
        keys.append(next);
        for (const [label, ins] of KEYS) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ed-key';
          b.textContent = label;
          b.dataset.ins = ins;
          keys.append(b);
        }
        row.append(sugg, keys);
        /* With the bottom bar hidden behind the keyboard, Run comes along here. */
        if (o.runKey && o.onRun) {
          const run = document.createElement('button');
          run.type = 'button';
          run.className = 'ed-key ed-key-run';
          run.textContent = 'Run';
          run.dataset.run = '1';
          run.setAttribute('aria-label', 'Run the query');
          row.append(run);
        }
        bar.append(row);
        /* Holding the focus in the textarea keeps the on-screen keyboard up while a key is tapped. */
        bar.addEventListener('mousedown', (e) => e.preventDefault());
        bar.addEventListener('click', (e) => {
          const b = e.target.closest('button');
          if (!b) return;
          if (b.dataset.run) { acClose(); if (!ta.readOnly) o.onRun(); return; }
          if (b.dataset.i != null) { ac.ix = Number(b.dataset.i); acAccept(); return; }
          if (b.dataset.next) { const s = ta.selectionEnd; const i = blanks.findIndex(([a]) => a >= s); selectBlank(i < 0 ? 0 : i, { focus: true }); return; }
          ta.focus({ preventScroll: true });
          acClose();
          const s = ta.selectionStart, end = ta.selectionEnd;
          let ins = b.dataset.ins;
          if (/^[A-Z]/.test(ins) && isWord(ta.value[s - 1])) ins = ' ' + ins;
          edit(s, end, ins);
        });
        (root.closest('dialog') || document.body).append(bar);
        this.el = bar; this.sugg = sugg; this.keys = keys; this.next = next;
      },
      paint() {
        if (!this.el) return;
        this.next.hidden = !blanks.length;
        const showing = ac.open && useChips();
        this.sugg.hidden = !showing;
        this.keys.hidden = showing;
        if (showing) {
          const esc = (K.UI && K.UI.esc) || escHtml;
          this.sugg.innerHTML = ac.items.slice(0, MAX_ITEMS).map((it, i) =>
            '<button type="button" class="ed-key ed-chip" data-i="' + i + '" aria-label="Insert ' + esc(it.t) + '. ' + esc(it.d) + '"><code>' + esc(it.t) + '</code><small>' + esc(it.d) + '</small></button>').join('');
          this.sugg.scrollLeft = 0;
        }
      },
      inset() {
        const vv = window.visualViewport;
        return vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
      },
      place() {
        if (destroyed) return;
        if (!root.isConnected) { api.destroy(); return; }
        if (!this.shown) return;
        const inset = this.inset();
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty('--kb-inset', inset + 'px');
        rootStyle.setProperty('--kb-safe', inset > 0 ? '0px' : 'env(safe-area-inset-bottom, 0px)');
        rootStyle.setProperty('--keybar-h', this.el.offsetHeight + 'px');
        this.keepCaretClear();
      },
      /** Scrolls the page when the caret would sit behind the key bar or the keyboard. */
      keepCaretClear() {
        if (!this.shown || document.activeElement !== ta) return;
        /* A locked page cannot scroll, and the editor already ends above the key bar, so its own scroll box does the work. */
        const page = document.scrollingElement;
        if (page && page.scrollHeight <= window.innerHeight + 1) { reveal(ta.selectionEnd); return; }
        const vv = window.visualViewport;
        const bottom = (vv ? vv.offsetTop + vv.height : window.innerHeight);
        const barTop = this.el.getBoundingClientRect().top;
        const r = clientRectOf(ta.selectionEnd);
        /* One line of air under the caret, so the next line can be read too. */
        const limit = Math.min(bottom, barTop) - 8 - r.height;
        if (r.bottom > limit) window.scrollBy(0, r.bottom - limit);
        else {
          const head = document.querySelector('.top');
          const top = (head ? head.getBoundingClientRect().bottom : 0) + 8;
          if (r.top < top) window.scrollBy(0, r.top - top);
        }
      },
      onViewport() {
        if (this.raf || !this.shown) return;
        this.raf = requestAnimationFrame(() => { this.raf = 0; this.place(); });
      },
      show() {
        if (o.keybar === false || !isPhone() || ta.readOnly) return;
        if (!this.el) { this.build(); this.handler = () => this.onViewport(); }
        if (this.shown) return;
        this.shown = true;
        this.paint();
        this.el.hidden = false;
        document.documentElement.dataset.keybar = 'up';
        this.vv = window.visualViewport;
        if (this.vv) { this.vv.addEventListener('resize', this.handler); this.vv.addEventListener('scroll', this.handler); }
        window.addEventListener('resize', this.handler);
        this.place();
        this.onViewport();
      },
      hide() {
        if (!this.shown) return;
        this.shown = false;
        this.el.hidden = true;
        if (this.vv) { this.vv.removeEventListener('resize', this.handler); this.vv.removeEventListener('scroll', this.handler); }
        window.removeEventListener('resize', this.handler);
        const rootStyle = document.documentElement.style;
        rootStyle.removeProperty('--kb-inset');
        rootStyle.removeProperty('--kb-safe');
        rootStyle.removeProperty('--keybar-h');
        delete document.documentElement.dataset.keybar;
      }
    };

    /* ----- Leaving ----- */
    const leave = () => {
      const box = root.closest('.mc');
      const vis = (el) => el && el.offsetParent !== null && !el.disabled;
      let target = null;
      if (box) target = [...box.querySelectorAll('.key.canary')].find(vis) || [...box.querySelectorAll('.key,button,a[href]')].find((el) => vis(el) && !root.contains(el));
      if (!target) {
        const all = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(vis);
        const at = all.indexOf(ta);
        target = at >= 0 ? all[at + 1] : null;
      }
      if (target) target.focus(); else ta.blur();
    };

    /* ----- Indenting ----- */
    const indentLines = (out) => {
      const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
      const from = v.lastIndexOf('\n', s - 1) + 1;
      const endAdj = e > s && v[e - 1] === '\n' ? e - 1 : e;
      let to = v.indexOf('\n', endAdj);
      if (to < 0) to = v.length;
      const block = v.slice(from, to);
      const lines_ = block.split('\n');
      const changed = lines_.map((l) => (out ? l.replace(/^ {1,2}/, '') : (l ? '  ' + l : l)));
      const next = changed.join('\n');
      if (next === block) return false;
      const firstDelta = changed[0].length - lines_[0].length;
      const totalDelta = next.length - block.length;
      edit(from, to, next);
      ta.setSelectionRange(Math.max(from, s + firstDelta), Math.max(from, e + totalDelta));
      syncSelection();
      return true;
    };

    /* ----- Events ----- */
    const onKeyDown = (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        acClose();
        if (!e.repeat && !ta.readOnly && o.onRun) o.onRun();
        return;
      }
      if (e.ctrlKey && (e.code === 'Space' || e.key === ' ')) {
        if (o.autocomplete !== false && !ta.readOnly) { e.preventDefault(); ac.suppress = -1; acRefresh(true); }
        return;
      }
      if (ac.open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const len = Math.min(ac.items.length, MAX_ITEMS);
          if (!ac.arrowed && e.key === 'ArrowDown') ac.ix = 0;
          else ac.ix = (ac.ix + (e.key === 'ArrowDown' ? 1 : -1) + len) % len;
          ac.arrowed = true;
          acPaintSelection();
          return;
        }
        if ((e.key === 'Tab' && !e.shiftKey) || (e.key === 'Enter' && ac.arrowed && !e.shiftKey)) {
          e.preventDefault();
          acAccept();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          ac.suppress = ac.start;
          acClose();
          return;
        }
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Enter'].includes(e.key)) acClose();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        leave();
        return;
      }
      if (ta.readOnly) return;
      const s = ta.selectionStart, end = ta.selectionEnd;
      if (e.key === 'Tab') {
        if (mod || e.altKey) return;
        if (blanks.length) {
          e.preventDefault();
          clearTimeout(ac.timer);
          if (e.shiftKey) {
            let ix = -1;
            blanks.forEach(([a], i) => { if (a < s) ix = i; });
            selectBlank(ix < 0 ? blanks.length - 1 : ix);
          } else {
            const ix = blanks.findIndex(([a]) => a >= end);
            selectBlank(ix < 0 ? 0 : ix);
          }
          return;
        }
        if (e.shiftKey) { if (indentLines(true)) e.preventDefault(); return; }
        e.preventDefault();
        if (s !== end && ta.value.slice(s, end).includes('\n')) indentLines(false);
        else edit(s, end, '  ');
        return;
      }
      if (s === end && !mod && !e.altKey) {
        /* A blank goes in one key press, in place of leaving a stray underscore or two behind. */
        if (e.key === 'Backspace') {
          const b = blanks.find(([, y]) => y === s);
          if (b) { e.preventDefault(); edit(b[0], b[1], ''); return; }
        }
        if (e.key === 'Delete') {
          const b = blanks.find(([x]) => x === s);
          if (b) { e.preventDefault(); edit(b[0], b[1], ''); return; }
        }
      }
      if (e.key === 'Enter' && !mod && !e.altKey && !e.shiftKey) {
        const from = ta.value.lastIndexOf('\n', s - 1) + 1;
        const indent = /^[ \t]*/.exec(ta.value.slice(from, s))[0];
        if (indent) { e.preventDefault(); acClose(); edit(s, end, '\n' + indent); }
      }
    };

    const onInput = (e) => {
      if (internal) { afterChange(); return; }
      afterChange();
      fire();
      if (o.autocomplete === false) return;
      const type = e.inputType || 'insertText';
      if (type.startsWith('delete')) {
        if (ac.open) acRefresh(); else clearTimeout(ac.timer);
        return;
      }
      if (type === 'insertText' || type === 'insertCompositionText' || type === 'insertReplacementText') {
        const c = e.data == null ? '' : e.data;
        if (/^\w+$/.test(c) || c === '.' || c === '') { if (c === '.') ac.suppress = -1; acSoon(); }
        else { ac.suppress = -1; acClose(); }
        return;
      }
      acClose();
    };

    const onBeforeInput = (e) => {
      if (internal || composing || e.isComposing) return;
      if ((e.inputType === 'insertText' || e.inputType === 'insertReplacementText') && e.data && CURLY.test(e.data)) {
        e.preventDefault();
        edit(ta.selectionStart, ta.selectionEnd, straighten(e.data));
      }
    };
    const onPaste = (e) => {
      const data = e.clipboardData && e.clipboardData.getData('text/plain');
      if (data && CURLY.test(data)) {
        e.preventDefault();
        edit(ta.selectionStart, ta.selectionEnd, straighten(data));
      }
    };
    const onClick = () => {
      acClose();
      const s = ta.selectionStart;
      if (s === ta.selectionEnd && !ta.readOnly) {
        const hit = blanks.findIndex(([a, b]) => s >= a && s <= b);
        if (hit >= 0) { selectBlank(hit); return; }
      }
      syncSelection();
    };
    const onPointerDown = (e) => {
      touched = true;
      if (e.pointerType === 'mouse') dragging = true;
      acClose();
    };
    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      syncSelection({ noReveal: true });
    };
    let hideTimer = 0;
    const onFocus = () => {
      clearTimeout(hideTimer);
      root.classList.add('focused');
      /* Coming in by keyboard or from a Jump control: start where the work is. */
      if (!touched) {
        touched = true;
        if (blanks.length && !ta.readOnly) ta.setSelectionRange(blanks[0][0], blanks[0][1]);
        else if (ta.selectionStart === 0 && ta.selectionEnd === 0) ta.setSelectionRange(ta.value.length, ta.value.length);
      }
      syncSelection();
      keybar.show();
    };
    const onBlur = (e) => {
      root.classList.remove('focused');
      if (ac.box && e.relatedTarget && ac.box.contains(e.relatedTarget)) return;
      acClose();
      /* The bar and its page padding go a moment later. Hiding them at once moves the page under a finger still tapping another control, and the tap is lost. */
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { if (document.activeElement !== ta) keybar.hide(); }, 300);
      syncSelection({ noReveal: true });
    };
    const onSelectionChange = () => {
      if (document.activeElement === ta) syncSelection();
    };
    const onScroll = () => { updateFade(); acPlace(); };
    const onOuterScroll = (e) => {
      if (!ac.open || useChips()) return;
      if (e.target === scroller || (ac.box && ac.box.contains(e.target))) return;
      acClose();
    };
    const onResize = () => { updateFade(); acPlace(); };

    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); return () => t.removeEventListener(ev, fn, opt); };
    const off = [
      on(ta, 'keydown', onKeyDown),
      on(ta, 'input', onInput),
      on(ta, 'beforeinput', onBeforeInput),
      on(ta, 'paste', onPaste),
      on(ta, 'click', onClick),
      on(ta, 'pointerdown', onPointerDown),
      on(ta, 'focus', onFocus),
      on(ta, 'blur', onBlur),
      on(ta, 'scroll', guard),
      on(ta, 'select', () => { if (document.activeElement === ta) syncSelection(); }),
      on(ta, 'compositionstart', () => { composing = true; }),
      on(ta, 'compositionend', () => { composing = false; syncSelection(); }),
      on(window, 'pointerup', onPointerUp),
      on(window, 'pointercancel', onPointerUp),
      on(document, 'selectionchange', onSelectionChange),
      on(scroller, 'scroll', onScroll, { passive: true }),
      on(window, 'scroll', onOuterScroll, { capture: true, passive: true }),
      on(window, 'resize', onResize),
      on(wrapQuery, 'change', () => { ta.wrap = wrapped() ? 'soft' : 'off'; paint(); syncSelection({ noReveal: true }); }),
      /* If a screen is torn down without calling destroy, nothing of the editor stays on the page. */
      on(window, 'hashchange', () => { setTimeout(() => { if (!root.isConnected) api.destroy(); }, 60); }),
      on(gutter, 'mousedown', (e) => { e.preventDefault(); ta.focus({ preventScroll: true }); })
    ];
    const ro = window.ResizeObserver ? new ResizeObserver(() => updateFade()) : null;
    if (ro) ro.observe(scroller);

    /* ----- API ----- */
    const api = {
      el: root,
      textarea: ta,
      get value() { return ta.value; },
      set value(v) {
        const text = v == null ? '' : straighten(String(v));
        acClose();
        ta.value = text;
        touched = false;
        mark = null;
        paint();
        scroller.scrollLeft = 0;
        scroller.scrollTop = 0;
        syncSelection({ noReveal: true });
        keybar.paint();
      },
      get readOnly() { return ta.readOnly; },
      set readOnly(v) {
        ta.readOnly = !!v;
        root.toggleAttribute('data-readonly', !!v);
        if (v) { acClose(); keybar.hide(); } else if (document.activeElement === ta) keybar.show();
        syncSelection({ noReveal: true });
      },
      /** Blank bookkeeping for the status line: "2 blanks to fill". */
      get blankCount() { return blanks.length; },
      hasBlanks() { return blanks.length > 0; },
      /** At the caret or over the selection, then on to the next blank. Before any caret exists, the first blank takes it. */
      insert(text, opts) {
        if (ta.readOnly) return;
        let t = straighten(String(text));
        let s = ta.selectionStart, e = ta.selectionEnd;
        if (!touched) {
          if (blanks.length) { s = blanks[0][0]; e = blanks[0][1]; }
          else { s = e = ta.value.length; }
        }
        touched = true;
        /* opts.list: a column going into a SELECT list brings its comma, so it never turns the one before it into an alias. */
        if (opts && opts.list) {
          const fit = listFit(ta.value, s, e, t);
          s = fit.s;
          t = fit.t;
        }
        if (/^\w/.test(t) && isWord(ta.value[s - 1])) t = ' ' + t;
        if (/\w$/.test(t) && isWord(ta.value[e])) t += ' ';
        if (wantsFocus()) ta.focus({ preventScroll: true });
        acClose();
        edit(s, e, t);
        const from = ta.selectionEnd;
        if (blanks.length) {
          const ix = blanks.findIndex(([a]) => a >= from);
          selectBlank(ix < 0 ? 0 : ix);
        } else {
          ta.setSelectionRange(s + t.length, s + t.length);
          syncSelection();
        }
        keybar.paint();
      },
      /** Leaves the editor at once, key bar included: for Run, whose tap has already landed. */
      blur() {
        ta.blur();
        clearTimeout(hideTimer);
        keybar.hide();
      },
      focus() {
        /* On touch, let the browser bring the field into view, because the keyboard takes half the screen. */
        if (coarse()) ta.focus(); else ta.focus({ preventScroll: true });
        syncSelection();
        reveal(ta.selectionEnd);
      },
      /** Selects the first blank. On a touch device it only focuses when opts.focus is set, to keep the keyboard down. */
      selectFirstBlank(opts) {
        const focus = opts && opts.focus != null ? opts.focus : wantsFocus();
        return selectBlank(0, { focus });
      },
      /** Highlights the word until the next edit and selects it, so typing replaces it. Returns whether it was found. */
      markError(token) {
        if (!token) { api.clearError(); return false; }
        const range = findMark(token);
        if (!range) { api.clearError(); return false; }
        mark = range;
        touched = true;
        paint();
        if (wantsFocus()) ta.focus({ preventScroll: true });
        ta.setSelectionRange(range[0], range[1]);
        syncSelection();
        reveal(range[1]);
        reveal(range[0]);
        return true;
      },
      clearError() {
        if (!mark) return;
        mark = null;
        paint();
        syncSelection({ noReveal: true });
      },
      /** Where the marked word is on screen, so the help slip can point at it. Null when nothing is marked. */
      markedRect() {
        if (!mark) return null;
        return clientRectOf(mark[0], mark[1]);
      },
      /** The one-click fix on a help slip: replaces the marked word, with undo. Takes text, or explainError's {from, to}. Returns false when nothing is marked. */
      replaceMarked(text) {
        if (!mark || ta.readOnly) return false;
        const [a, b] = mark;
        const to = text && typeof text === 'object' ? text.to : text;
        if (wantsFocus()) ta.focus({ preventScroll: true });
        edit(a, b, straighten(String(to)));
        return true;
      },
      /** Start over, or Put it in the editor. Unlike setting value, this can be undone. */
      replaceAll(text) {
        if (ta.readOnly) return;
        if (wantsFocus()) ta.focus({ preventScroll: true });
        acClose();
        edit(0, ta.value.length, straighten(String(text)));
        touched = false;
        scroller.scrollLeft = 0;
        scroller.scrollTop = 0;
        keybar.paint();
      },
      caretRect() { return clientRectOf(ta.selectionEnd); },
      /** Scrolls the editor's own box to the caret or the selected blank. */
      revealCaret() { reveal(ta.selectionEnd); },
      refresh() {
        paint();
        syncSelection({ noReveal: true });
        acPlace();
        keybar.onViewport();
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        clearTimeout(ac.timer);
        off.forEach((f) => f());
        if (ro) ro.disconnect();
        clearTimeout(hideTimer);
        keybar.hide();
        if (keybar.el) keybar.el.remove();
        if (ac.box) ac.box.remove();
        root.remove();
      }
    };

    ta.value = o.value == null ? '' : straighten(String(o.value));
    paint();
    syncSelection({ noReveal: true });
    return api;
  }

  K.Editor = { create, _tokenize: tokenize };
})();
