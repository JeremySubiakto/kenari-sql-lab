/*
 * Kenari.Demos: the small interactive pictures inside lesson text, used through [[demo:name]].
 *
 *   Demos.render(name, hostEl, opts)
 *   name: anatomy, order, join, join-left, group, fanout, window, transaction, index
 *   opts.level: optional. join-left grows the WHERE versus ON comparison from Level 6 on, because
 *   Mission 6.4 is about that. Without it the level is read from a [data-demo-level] ancestor, then the route.
 *
 * The query sits on top and the control sits directly above the paper, so on a phone the result is in view
 * the moment the control is pressed.
 * Every picture follows the product's color jobs: a dark slab holds what you write, paper holds what
 * came back, and the sentence under them says what happened. Amber marks the number that is wrong.
 * Canary and violet stay out, because Run and the stamp own them. All sizes reserve their space up front,
 * so pressing a control never moves the lesson text. Nothing plays until the learner presses something.
 */
(function () {
  'use strict';
  const K = (window.Kenari = window.Kenari || {});

  /* ---------- Parts every demo shares ---------- */
  const el = (...a) => K.UI.el(...a);
  const hl = (s) => K.UI.hl(s);
  const motion = () => K.UI.motionOK();
  const anim = (node, frames, opts) => K.UI.anim(node, frames, opts);
  const NOTHING = ' ';

  /** The frame: a small heading, then whatever the demo adds. */
  function shell(name, title, lede) {
    const root = el('figure', { class: 'demo', dataset: { demoName: name } },
      el('figcaption', { class: 'demo-head' },
        el('span', { class: 'demo-kicker', text: 'Try it' }),
        el('span', { class: 'demo-title', text: title }),
        lede ? el('span', { class: 'demo-lede', text: lede }) : null));
    return root;
  }

  /** A segmented control. Returns the node, with .set(value) to change it from code. */
  function seg(label, options, value, onPick) {
    const buttons = new Map();
    const node = el('div', { class: 'seg demo-seg', role: 'group', 'aria-label': label, style: { '--n': options.length } });
    const set = (v) => buttons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === v)));
    options.forEach(([key, text]) => {
      const b = el('button', { type: 'button', text, onClick: () => { set(key); onPick(key); } });
      buttons.set(key, b);
      node.append(b);
    });
    set(value);
    node.set = set;
    return node;
  }

  /**
   * The dark slab that holds the query. variants: {key: [line, ...]}.
   * A line is text, or {t: text, on: true} for the line doing the work, or {t, off: true} for one that has not run.
   * All variants are stacked in one grid cell, so the slab keeps the height of the tallest.
   */
  function slab(variants) {
    const box = el('div', { class: 'demo-sql' });
    const pres = new Map();
    Object.entries(variants).forEach(([key, lines]) => {
      const html = lines.map((ln) => {
        const line = typeof ln === 'string' ? { t: ln } : ln;
        const cls = 'dl' + (line.on ? ' on' : '') + (line.off ? ' off' : '');
        return '<span class="' + cls + '">' + (line.t ? (line.raw ? line.t : hl(line.t)) : NOTHING) + '</span>';
      }).join('');
      const pre = el('pre', { html });
      pres.set(key, pre);
      box.append(pre);
    });
    box.show = (key) => pres.forEach((p, k) => {
      const on = k === key;
      if (on && !p.classList.contains('shown')) anim(p, [{ opacity: 0.35 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
      p.classList.toggle('shown', on);
    });
    return box;
  }

  /** The sentence that says what happened. Holds the height of its longest version, and announces changes. */
  function readout(sentences) {
    const box = el('div', { class: 'demo-read' });
    Object.values(sentences).forEach((html) => box.append(el('p', { class: 'demo-read-size', 'aria-hidden': 'true', html })));
    const live = el('p', { class: 'demo-read-now', role: 'status', 'aria-live': 'polite' });
    box.append(live);
    box.show = (key) => { if (live.dataset.key !== key) { live.dataset.key = key; live.innerHTML = sentences[key]; } };
    return box;
  }

  /** Text changes that should also tell the row or cell that it changed. */
  function setText(node, text) {
    if (node.textContent === text) return false;
    node.textContent = text;
    return true;
  }

  const thin = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const nullTag = () => el('span', { class: 'null', text: 'NULL' });
  const rowsWord = (n) => n + (n === 1 ? ' row' : ' rows');

  /** Runs fn(progress 0..1) over ms. Stops when cancelled or when the demo leaves the page. */
  function tween(root, ms, fn, done) {
    let stop = false;
    let started = false;
    const t0 = performance.now();
    function frame(now) {
      if (stop) return;
      if (started && !root.isConnected) return;
      started = true;
      const p = Math.min(1, (now - t0) / ms);
      fn(p);
      if (p < 1) requestAnimationFrame(frame);
      else if (done) done();
    }
    requestAnimationFrame(frame);
    return () => { stop = true; };
  }

  /* ---------- anatomy: Mission 0.1. The same branches the learner is about to print. ---------- */
  function anatomy(host) {
    const root = shell('anatomy', 'A database is a workbook', 'If you know Excel, you already know the shape. Choose a pair below to see it on the table.');
    const cols = ['branch_id', 'branch_name', 'city', 'region'];
    const data = [
      [1, 'KC Jakarta Sudirman', 'Jakarta', 'Jabodetabek'],
      [2, 'KCP Kelapa Gading', 'Jakarta', 'Jabodetabek'],
      [3, 'KCP Bekasi Timur', 'Bekasi', 'Jabodetabek']
    ];
    const ROW = 1, COL = 2;
    const tables = (window.KenariData && KenariData.SCHEMA ? KenariData.SCHEMA.map((t) => t.t) : ['branches']);

    const headLabel = el('tr', { class: 'an-labels' },
      el('td', { class: 'rn' }),
      cols.map((c, i) => el('td', { class: 'c' + i + (i === COL ? ' c-on' : '') },
        i === COL ? el('span', { class: 'an-tag an-tag-col', text: 'column' }) : i === 1 ? el('span', { class: 'an-tag an-tag-table', text: 'table: branches' }) : null)));
    const table = el('table', { class: 'd-t an-t' },
      el('thead', {}, headLabel,
        el('tr', {}, el('th', { class: 'rn', 'aria-label': 'row number' }), cols.map((c, i) => el('th', { scope: 'col', class: 'c' + i + (i === COL ? ' c-on' : ''), text: c })))),
      el('tbody', {}, data.map((r, ri) => el('tr', { class: ri === ROW ? 'r-on' : '' },
        el('td', { class: 'rn' }, ri === ROW ? el('span', { class: 'an-tag an-tag-row', text: 'row' }) : null, el('span', { class: 'an-n', text: ri + 1 })),
        r.map((v, i) => el('td', { class: 'c' + i + (i === COL ? ' c-on' : ''), text: v }))))));
    const tabs = el('div', { class: 'an-tabs', 'aria-hidden': 'true' }, tables.map((t, i) => el('span', { class: i === 0 ? 'on' : '', text: t })));
    const sheet = el('div', { class: 'paper demo-sheet an-sheet', dataset: { show: 'both' } }, el('div', { class: 'an-scroll' }, table), tabs);

    const read = readout({
      both: 'A <b>row</b> is one record, read across. A <b>column</b> is one kind of fact, read down.',
      database: 'A workbook holds many sheets, and a <b>database</b> holds many tables. This one holds ' + tables.length + ', named along the bottom.',
      table: 'One sheet is one <b>table</b>. This one is called <code>branches</code>, and every row has the same columns.',
      row: 'A <b>row</b> is one record, read across. This one is the branch KCP Kelapa Gading.',
      column: 'A <b>column</b> is one kind of fact, read down. This one holds the city of every branch.'
    });

    const pairs = [['database', 'Workbook', 'Database'], ['table', 'Sheet', 'Table'], ['row', 'Row', 'Row'], ['column', 'Column', 'Column']];
    let current = 'both';
    const pairBtns = new Map();
    function show(key) {
      current = key;
      sheet.dataset.show = key;
      read.show(key);
      pairBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === key)));
    }
    const map = el('div', { class: 'an-map', role: 'group', 'aria-label': 'Excel words and database words' },
      el('span', { class: 'an-map-head', 'aria-hidden': 'true', text: 'In Excel \u2192 in a database' }),
      pairs.map(([key, excel, db]) => {
        const b = el('button', { type: 'button', class: 'an-pair', 'aria-pressed': 'false', 'aria-label': 'In Excel: ' + excel + '. Here: ' + db, onClick: () => show(current === key ? 'both' : key) },
          el('span', { text: excel }), el('b', { text: db }));
        pairBtns.set(key, b);
        return b;
      }));
    root.append(sheet, map, read);
    show('both');
    host.append(root);
  }

  /* ---------- order: Mission 2.12. All seven clauses, moving into the order they run. ---------- */
  function order(host) {
    const root = shell('order', 'The order you write, the order it runs', 'The same query both ways. Watch where SELECT goes.');
    const lines = [
      { k: 'SELECT', sql: 'SELECT loan_id, COUNT(*) AS ptps', note: 'Pick the columns, name them', run: 4, hot: true },
      { k: 'FROM', sql: 'FROM collection_activities', note: 'Open the table', run: 0 },
      { k: 'WHERE', sql: "WHERE result = 'PTP'", note: 'Pick the rows', run: 1 },
      { k: 'GROUP BY', sql: 'GROUP BY loan_id', note: 'Make the piles', run: 2 },
      { k: 'HAVING', sql: 'HAVING COUNT(*) >= 8', note: 'Remove piles', run: 3 },
      { k: 'ORDER BY', sql: 'ORDER BY ptps DESC', note: 'Sort, and ptps exists by now', run: 5 },
      { k: 'LIMIT', sql: 'LIMIT 5;', note: 'Keep the first few', run: 6 }
    ];
    const mark = (html) => html.replace(/\bptps\b/g, '<span class="or-name">ptps</span>');
    const nodes = lines.map((ln) => {
      const n = el('span', { class: 'or-n' });
      const node = el('div', { class: 'or-line' + (ln.hot ? ' hot' : '') }, n,
        el('code', { class: 'or-sql', html: mark(hl(ln.sql)) }),
        el('span', { class: 'or-note', text: ln.note }));
      node.n = n;
      return node;
    });
    const stage = el('div', { class: 'or-stage', 'aria-hidden': 'true' }, nodes);
    const box = el('div', { class: 'demo-sql or-box', dataset: { mode: 'write' } }, stage);
    const said = el('ol', { class: 'vh' });
    const read = readout({
      write: 'This is the order you type, every time. <code>SELECT</code> comes first.',
      run: 'The database starts at <code>FROM</code>, and <code>SELECT</code> moves to fifth. That is why <code>ORDER BY</code> can use the name <code>ptps</code>: <code>SELECT</code> has already run by then.'
    });
    function show(mode) {
      box.dataset.mode = mode;
      const place = (ln, i) => (mode === 'run' ? ln.run : i);
      lines.forEach((ln, i) => {
        const at = place(ln, i);
        nodes[i].style.setProperty('--i', at);
        nodes[i].style.setProperty('--d', Math.abs(ln.run - i));
        nodes[i].n.textContent = at + 1;
      });
      const inOrder = mode === 'run' ? lines.slice().sort((a, b) => a.run - b.run) : lines;
      said.replaceChildren(...inOrder.map((ln) => el('li', { text: ln.sql + ' ' + ln.note + '.' })));
      read.show(mode);
    }
    const control = seg('Show the query', [['write', 'The order you write'], ['run', 'The order it runs']], 'write', show);
    root.append(control, box, said, read);
    show('write');
    host.append(root);
  }

  /* ---------- join and join-left: Missions 3.2, 3.7, and 6.4 with the date test ---------- */
  function join(host, kind, level) {
    const trap = kind === 'join-left' && level >= 6;
    const short = kind === 'join-left';   /* The alias lesson comes after 3.2, so only join-left uses l and a. */
    const root = trap
      ? shell('join-left', 'Where the date test goes', 'The same LEFT JOIN with a date test in two places. Watch L2 and L3.')
      : shell(kind, kind === 'join' ? 'JOIN pairs the rows' : 'LEFT JOIN keeps every loan',
        'Three loans and three activities. L1 has two activities, and L2 has none.');
    const fromLine = short ? 'FROM loans l' : 'FROM loans';
    const on = short ? ['  ON a.loan_id = l.loan_id'] : ['  ON loans.loan_id =', '     collection_activities.loan_id'];
    const target = short ? 'collection_activities a' : 'collection_activities';

    const modes = trap
      ? [['left', 'No date test'], ['where', 'Test in WHERE'], ['on', 'Test in ON']]
      : [['join', 'JOIN'], ['left', 'LEFT JOIN']];
    const variants = trap ? {
      left: [fromLine, { t: 'LEFT JOIN ' + target, on: true }, ...on, '', ''],
      where: [fromLine, 'LEFT JOIN ' + target, ...on, { t: 'WHERE a.activity_date', on: true }, { t: "      >= '2026-10-01'", on: true }],
      on: [fromLine, 'LEFT JOIN ' + target, ...on, { t: '  AND a.activity_date', on: true }, { t: "      >= '2026-10-01'", on: true }]
    } : {
      join: [fromLine, { t: 'JOIN ' + target, on: true }, ...on],
      left: [fromLine, { t: 'LEFT JOIN ' + target, on: true }, ...on]
    };
    const sql = slab(variants);

    /* The two source tables, with the matches drawn between them */
    const acts = [
      { key: 'L1', type: 'Call', date: '10-27', full: '2026-10-27', row: 1, line: 'l1' },
      { key: 'L1', type: 'Visit', date: '09-03', full: '2026-09-03', row: 2, line: 'l2' },
      { key: 'L3', type: 'WhatsApp', date: '09-14', full: '2026-09-14', row: 4, line: 'l4' }
    ];
    const chip = (key, rest, cls) => el('span', { class: 'jn-chip ' + (cls || '') }, el('b', { text: key }), rest ? ' ' + rest : '');
    const loanChips = {
      L1: chip('L1', 'KPR', 'jn-l1'), L2: chip('L2', 'KTA', 'jn-l2'), L3: chip('L3', 'KKB', 'jn-l3')
    };
    const actChips = acts.map((a) => {
      const c = chip(a.key, a.type);
      if (trap) c.append(el('i', { text: a.date }));
      c.style.gridRow = String(a.row);
      return c;
    });
    const gap = el('span', { class: 'jn-gap' });
    gap.style.gridRow = '3';
    const wires = el('span', {
      class: 'jn-wires',
      html: '<svg viewBox="0 0 40 136" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
        '<path class="l1" d="M0 34C20 34 20 17 40 17"/><path class="l2" d="M0 34C20 34 20 51 40 51"/>' +
        '<path class="l3" d="M0 85H40"/><path class="l4" d="M0 119H40"/></svg>'
    });
    const link = el('div', { class: 'jn-link' },
      el('span', { class: 'jn-name', text: 'loans' }), el('span'), el('span', { class: 'jn-name', text: 'collection_activities' }),
      el('div', { class: 'jn-grid' },
        el('div', { class: 'jn-left' }, loanChips.L1, loanChips.L2, loanChips.L3),
        wires,
        el('div', { class: 'jn-right' }, actChips, gap)));

    /* The result: always four slots, so a row that drops out leaves its mark and nothing jumps */
    const heads = trap ? ['loan_id', 'activity_type', 'activity_date', ''] : ['loan_id', 'product', 'activity_type', ''];
    const slots = [0, 1, 2, 3].map(() => {
      const tds = [el('td'), el('td'), el('td'), el('td', { class: 'jn-note' })];
      return { tr: el('tr', {}, tds), tds };
    });
    const table = el('table', { class: 'd-t d-fixed jn-t' + (trap ? ' jn-trap' : '') },
      el('thead', {}, el('tr', {}, heads.map((h, i) => el('th', { scope: 'col', class: 'jn-c' + i + (i === 3 ? ' jn-note' : '') }, h ? h : el('span', { class: 'vh', text: 'What happened' }))))),
      el('tbody', {}, slots.map((s) => s.tr)));
    const count = el('span', { class: 'd-count' });
    const footNote = el('span', { class: 'd-foot-note' });
    const sheet = el('div', { class: 'paper demo-sheet jn-sheet' }, link,
      el('div', { class: 'jn-result-title', text: 'What comes back' }), table,
      el('div', { class: 'd-foot' }, count, footNote));

    const read = readout(trap ? {
      left: 'Every loan is here. L1 has two rows, and L2 shows NULL because it has no activity.',
      where: 'WHERE runs after the join. L2 has a NULL date, and NULL is not true, so L2 goes. L3 matched only outside the dates, so L3 goes too. Your LEFT JOIN now acts like a plain JOIN.',
      on: 'In <code>ON</code>, the test decides what matches. The September activities no longer match, so L1 keeps one row, and L2 and L3 stay with NULL. No loan is lost.'
    } : {
      join: 'L1 appears twice, once for each activity. L2 has no match, so <b>JOIN drops it</b>. You get 3 rows, and nothing warns you that L2 is gone.',
      left: 'L1 still appears twice. L2 has no match, and <b>LEFT JOIN keeps it</b>, with NULL where the activity would be. Every loan stays on the list.'
    });

    function paint(mode) {
      const plan = trap ? ({
        left: [['L1', 'Call', '2026-10-27'], ['L1', 'Visit', '2026-09-03'], ['L2', null, null, 'no match'], ['L3', 'WhatsApp', '2026-09-14']],
        where: [['L1', 'Call', '2026-10-27'], ['L1', 'Visit', '2026-09-03', 'too old', 1], ['L2', null, null, 'NULL date', 1], ['L3', 'WhatsApp', '2026-09-14', 'too old', 1]],
        on: [['L1', 'Call', '2026-10-27'], ['L1', 'Visit', '2026-09-03', 'no match', 1], ['L2', null, null, 'no match'], ['L3', null, null, 'no match']]
      })[mode] : ({
        join: [['L1', 'KPR', 'Call'], ['L1', 'KPR', 'Visit', 'L1 again'], ['L2', 'KTA', null, 'dropped', 1], ['L3', 'KKB', 'WhatsApp']],
        left: [['L1', 'KPR', 'Call'], ['L1', 'KPR', 'Visit', 'L1 again'], ['L2', 'KTA', null, 'kept'], ['L3', 'KKB', 'WhatsApp']]
      })[mode];
      let kept = 0;
      plan.forEach((row, i) => {
        const s = slots[i];
        const gone = !!row[4];
        if (!gone) kept++;
        const before = s.tr.className;
        s.tr.className = gone ? 'gone' : (row[3] === 'kept' || (trap && row[3] === 'no match') ? 'held' : '');
        if (gone) s.tr.setAttribute('aria-hidden', 'true'); else s.tr.removeAttribute('aria-hidden');
        [0, 1, 2].forEach((c) => {
          const td = s.tds[c];
          td.replaceChildren(row[c] == null ? (gone ? '' : nullTag()) : row[c]);
        });
        s.tds[3].textContent = row[3] || '';
        if (before !== s.tr.className && !gone) anim(s.tr, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 240, easing: 'steps(8)' });
      });
      count.textContent = rowsWord(kept) + ' came back';
      footNote.textContent = trap
        ? (mode === 'where' ? '2 of 3 loans lost' : 'All 3 loans kept')
        : (mode === 'join' ? '1 of 3 loans lost' : 'All 3 loans kept');
      footNote.classList.toggle('bad', trap ? mode === 'where' : mode === 'join');

      /* The picture above the result */
      const noMatchL1Visit = trap && mode === 'on';
      const noMatchL3 = trap && mode === 'on';
      actChips[1].classList.toggle('off', noMatchL1Visit);
      actChips[2].classList.toggle('off', noMatchL3);
      wires.querySelector('.l2').classList.toggle('dash', noMatchL1Visit);
      wires.querySelector('.l4').classList.toggle('dash', noMatchL3);
      const l2Lost = mode === 'join' || mode === 'where';
      loanChips.L2.classList.toggle('off', l2Lost);
      loanChips.L3.classList.toggle('off', trap && mode === 'where');
      gap.className = 'jn-gap' + (mode === 'join' || mode === 'where' ? '' : ' kept');
      gap.replaceChildren(mode === 'join' || mode === 'where' ? document.createTextNode('no match') : nullTag());
      sql.show(mode);
      read.show(mode);
    }
    const start = trap || kind === 'join-left' ? 'left' : 'join';
    const control = seg(trap ? 'Where the date test goes' : 'Choose the kind of join', modes, start, paint);
    root.append(sql, control, sheet, read);
    paint(start);
    host.append(root);
  }

  /* ---------- group: Mission 2.6. Six rows, three piles, three result rows. ---------- */
  function group(host) {
    const root = shell('group', 'Rows into piles', 'Press the button to step through it. Amounts are in Rp million.');
    const rows = [['KPR', 60], ['KTA', 15], ['KKB', 40], ['KTA', 5], ['KPR', 50], ['KTA', 10]];
    const piles = ['KKB', 'KPR', 'KTA'];
    const total = (p) => rows.filter((r) => r[0] === p).reduce((a, r) => a + r[1], 0);
    const sql = slab({
      0: [{ t: 'SELECT product,' }, { t: '  SUM(outstanding) AS total' }, { t: 'FROM loans', on: true }, { t: 'GROUP BY product;' }],
      1: [{ t: 'SELECT product,' }, { t: '  SUM(outstanding) AS total' }, { t: 'FROM loans' }, { t: 'GROUP BY product;', on: true }],
      2: [{ t: 'SELECT product,', on: true }, { t: '  SUM(outstanding) AS total', on: true }, { t: 'FROM loans' }, { t: 'GROUP BY product;' }]
    });
    const seen = {};
    const chips = rows.map((r, i) => {
      const pileRow = (seen[r[0]] = (seen[r[0]] || 0) + 1) - 1;
      const c = el('div', { class: 'gp-chip', style: { '--i': i } }, el('span', { class: 'p', text: r[0] }), el('span', { class: 'v', text: r[1] }));
      c.place = { row: i, col: piles.indexOf(r[0]), pileRow };
      return c;
    });
    const rawHead = el('div', { class: 'gp-rawhead' }, el('span', { text: 'product' }), el('span', { text: 'outstanding' }));
    const pileHeads = piles.map((p, i) => el('div', { class: 'gp-pile', style: { '--col': i } }, el('span', { class: 'gp-pile-name', text: p })));
    const totals = piles.map((p, i) => {
      const n = rows.filter((r) => r[0] === p).length;
      return el('div', { class: 'gp-total', style: { '--col': i } },
        el('span', { class: 'gp-total-n', text: rowsWord(n) }),
        el('span', { class: 'gp-total-l', text: 'total' }),
        el('span', { class: 'gp-total-v', html: K.UI.dm(String(total(p)), { p: 4 }) }));
    });
    const stage = el('div', { class: 'gp-stage', role: 'img', dataset: { step: 0 } }, rawHead, pileHeads, chips, totals);
    const count = el('span', { class: 'd-count' });
    const sheet = el('div', { class: 'paper demo-sheet' }, stage, el('div', { class: 'd-foot' }, count));
    const read = readout({
      0: 'Six loans, one row each, in no useful order.',
      1: '<code>GROUP BY</code> sorts the rows into piles, one pile per product. A pile can hold one row or many.',
      2: '<code>SUM</code> runs on each pile, and each pile becomes one result row. Six rows went in, and three came out.'
    });
    const labels = ['Sort into piles', 'Add up each pile', 'Start over'];
    const alt = [
      'Six loan rows in a list: ' + rows.map((r) => r[0] + ' ' + r[1]).join(', ') + '.',
      'Three piles: ' + piles.map((p) => p + ' with ' + rows.filter((r) => r[0] === p).length + (rows.filter((r) => r[0] === p).length === 1 ? ' row' : ' rows')).join(', ') + '.',
      'Three result rows: ' + piles.map((p) => p + ' ' + total(p)).join(', ') + '.'
    ];
    const btn = el('button', { type: 'button', class: 'key demo-key gp-go', onClick: () => paint((step + 1) % 3) });
    const pips = el('span', { class: 'd-pips', 'aria-hidden': 'true' }, [0, 1, 2].map(() => el('i')));
    const stepNote = el('span', { class: 'd-step' });
    const progress = el('span', { class: 'd-progress' }, stepNote, pips);
    let step = 0;
    function paint(n) {
      step = n;
      stage.dataset.step = n;
      chips.forEach((c) => {
        const { row, col, pileRow } = c.place;
        c.style.setProperty('--col', n === 0 ? 0 : col);
        c.style.setProperty('--y', n === 0 ? row : n === 1 ? pileRow : 0);
        c.style.setProperty('--z', n === 2 ? pileRow : 0);
      });
      stage.setAttribute('aria-label', alt[n]);
      btn.textContent = labels[n];
      [...pips.children].forEach((p, i) => p.classList.toggle('on', i <= n));
      stepNote.textContent = 'Step ' + (n + 1) + ' of 3';
      count.textContent = n === 2 ? '3 rows came back' : n === 1 ? '6 rows in 3 piles' : '6 rows';
      sql.show(String(n));
      read.show(String(n));
    }
    root.append(sql, el('div', { class: 'demo-ctl gp-ctl' }, btn, progress), sheet, read);
    paint(0);
    host.append(root);
  }

  /* ---------- fanout: Mission 6.2. Rp 10 million becomes Rp 30 million. ---------- */
  function fanout(host) {
    const root = shell('fanout', 'One loan, counted three times', 'One loan owes Rp 10 million and has three activities. Press With JOIN and watch the total.');
    const select = 'SELECT SUM(l.outstanding) AS total';
    const sql = slab({
      one: [select, { t: 'FROM loans l;', on: true }, '-- No JOIN yet', '', ''],
      join: [select, 'FROM loans l', { t: 'JOIN collection_activities a', on: true }, { t: '  ON a.loan_id = l.loan_id;', on: true }, ''],
      fix: [select, 'FROM loans l', { t: 'WHERE l.loan_id IN (', on: true }, { t: '  SELECT a.loan_id', on: true }, { t: '  FROM collection_activities a);', on: true }]
    });
    const types = ['Call', 'Visit', 'WhatsApp'];
    const rows = types.map((t, i) => {
      const bal = el('td', { class: 'num', text: thin(10000000) });
      const act = el('td', { class: 'fo-act', text: t });
      const tr = el('tr', { class: i ? 'fo-copy' : '' }, el('td', { class: 'fo-id', text: 'L1' }), bal, act);
      return { tr, bal, act };
    });
    const table = el('table', { class: 'd-t fo-t' },
      el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'loan_id' }), el('th', { scope: 'col', class: 'num', text: 'outstanding' }), el('th', { scope: 'col', class: 'fo-act', text: 'activity_type' }))),
      el('tbody', {}, rows.map((r) => r.tr)));
    const big = el('span', { class: 'fo-big' });
    const sum = el('span', { class: 'fo-sum' });
    const segs = [el('i'), el('i'), el('i')];
    const bar = el('div', { class: 'fo-bar', 'aria-hidden': 'true' }, segs,
      el('span', { class: 'fo-mark' }, el('span', { class: 'fo-real', text: 'Real balance' }), el('span', { class: 'fo-extra', text: 'Counted again' })));
    const says = el('div', { class: 'fo-says' },
      el('div', { class: 'fo-says-l' }, el('span', {}, el('code', { text: 'SUM' }), ' says'), sum),
      big);
    const sheet = el('div', { class: 'paper demo-sheet fo-sheet', dataset: { mode: 'one' } }, table, says, bar);
    const read = readout({
      one: 'One loan, one row. <code>SUM</code> says Rp 10 million, and that is the real balance.',
      join: 'The loan has 3 activities, so the JOIN makes 3 rows, each carrying the same balance. <code>SUM</code> adds it 3 times and says <b>Rp 30 million</b>. The loan still owes Rp 10 million.',
      fix: '<code>IN</code> only asks whether the loan has activities. The loan stays one row, so <code>SUM</code> is right again: Rp 10 million.'
    });
    let cancel = null;
    function setTotal(n, wrong) {
      big.innerHTML = '<span class="fo-rp">Rp</span>' + K.UI.dm(String(n), { p: 5, sw: 0.95 }) + '<span class="fo-mil">million</span>';
      big.classList.toggle('wrong', !!wrong);
    }
    function paint(mode) {
      const prev = sheet.dataset.mode;
      sheet.dataset.mode = mode;
      if (cancel) { cancel(); cancel = null; }
      const fan = mode === 'join';
      rows.slice(1).forEach((r) => { if (fan) r.tr.removeAttribute('aria-hidden'); else r.tr.setAttribute('aria-hidden', 'true'); });
      sql.show(mode);
      read.show(mode);
      sum.textContent = fan ? '10 + 10 + 10' : '';
      if (fan && motion() && prev !== 'join') {
        /* The copies slide out from behind the first row, and the total ticks up as each lands */
        rows.slice(1).forEach((r, i) => {
          anim(r.tr, [{ transform: 'translateY(' + (-100 * (i + 1)) + '%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 360, delay: 120 + i * 280, easing: 'cubic-bezier(.25,1,.4,1)' });
        });
        setTotal(10, false);
        segs[1].classList.remove('on'); segs[2].classList.remove('on');
        const t1 = setTimeout(() => { setTotal(20, true); segs[1].classList.add('on'); }, 380);
        const t2 = setTimeout(() => { setTotal(30, true); segs[2].classList.add('on'); }, 660);
        cancel = () => { clearTimeout(t1); clearTimeout(t2); };
      } else {
        setTotal(fan ? 30 : 10, fan);
        segs[1].classList.toggle('on', fan);
        segs[2].classList.toggle('on', fan);
      }
    }
    const control = seg('Choose the query', [['one', 'One loan'], ['join', 'With JOIN'], ['fix', 'With IN']], 'one', paint);
    segs[0].classList.add('on');
    root.append(sql, control, sheet, read);
    paint('one');
    host.append(root);
  }

  /* ---------- window: Mission 5.1. Same money, two shapes. ---------- */
  function windowFn(host) {
    const root = shell('window', 'Squeeze the rows, or keep them', 'Four loans, in Rp million. Switch between the two and count the rows.');
    const data = [['L1', 'KPR', 60], ['L2', 'KPR', 20], ['L3', 'KTA', 15], ['L4', 'KTA', 5]];
    const sql = slab({
      group: ['SELECT product,', { t: '  SUM(outstanding) AS total', on: true }, 'FROM loans', { t: 'GROUP BY product;', on: true }],
      over: ['SELECT loan_id, product,', '  outstanding,', { t: '  SUM(outstanding) OVER () AS total', on: true }, 'FROM loans;']
    });
    const headCells = ['loan_id', 'product', 'outstanding', 'total'];
    const head = el('div', { class: 'wn-row wn-head' }, headCells.map((h, i) => el('span', { class: 'wn-c wn-c' + i + (i >= 2 ? ' num' : ''), text: h })));
    const rows = data.map((d, i) => {
      const tot = el('span', { class: 'wn-c wn-c3 num' });
      const node = el('div', { class: 'wn-row wn-body', style: { '--slot': i } },
        el('span', { class: 'wn-c wn-c0', text: d[0] }), el('span', { class: 'wn-c wn-c1', text: d[1] }), el('span', { class: 'wn-c wn-c2 num', text: d[2] }), tot);
      node.tot = tot;
      return node;
    });
    const tag = el('span', { class: 'wn-tag', text: 'new column' });
    const stage = el('div', { class: 'wn-stage', role: 'img' }, head, rows, tag);
    const big = el('span', { class: 'wn-big' });
    const note = el('span', { class: 'd-foot-note' });
    const sheet = el('div', { class: 'paper demo-sheet wn-sheet' }, stage, el('div', { class: 'd-foot wn-foot' }, big, note));
    const read = readout({
      group: '<code>GROUP BY</code> squeezes the rows: 4 loans become 2 rows. You get the totals and lose each loan’s own line.',
      over: '<code>OVER ()</code> keeps all 4 rows and adds the total beside each one. The 80 and the 20 from the other view add up to this 100.'
    });
    function paint(mode) {
      const g = mode === 'group';
      stage.dataset.mode = mode;
      const totals = g ? [80, null, 20, null] : [100, 100, 100, 100];
      const slots = g ? [0, 0, 1, 1] : [0, 1, 2, 3];
      rows.forEach((r, i) => {
        r.style.setProperty('--slot', slots[i]);
        r.classList.toggle('merged', g && (i === 1 || i === 3));
        if (totals[i] != null) r.tot.textContent = totals[i];
      });
      big.innerHTML = K.UI.dm(g ? '2' : '4', { p: 3 }) + '<span class="wn-big-l">rows</span>';
      note.textContent = g ? 'Loan detail gone' : 'Every loan still here';
      stage.setAttribute('aria-label', g
        ? 'Two result rows: KPR total 80, and KTA total 20.'
        : 'Four result rows, one per loan. Each row shows its own balance, and the total, 100, beside it.');
      sql.show(mode);
      read.show(mode);
    }
    const control = seg('Choose the query', [['group', 'GROUP BY'], ['over', 'OVER ()']], 'group', paint);
    root.append(sql, control, sheet, read);
    paint('group');
    host.append(root);
  }

  /* ---------- transaction: Mission 8.6. The bad line from the task, then the choice. ---------- */
  function transaction(host) {
    const root = shell('transaction', 'Keep it or undo it', 'A script writes off every KTA loan by mistake. Run it, look at the table, then decide.');
    const update = (on, off) => [
      { t: 'BEGIN;', on, off },
      { t: 'UPDATE loans', on, off },
      { t: "SET status = 'Written Off'", on, off },
      { t: "WHERE product = 'KTA';", on, off }
    ];
    const sql = slab({
      start: [...update(false, true), { t: '-- Then COMMIT or ROLLBACK', off: true }],
      open: [...update(true, false), { t: '-- Then COMMIT or ROLLBACK' }],
      commit: [...update(false, false), { t: 'COMMIT;', on: true }],
      rollback: [...update(false, false), { t: 'ROLLBACK;', on: true }]
    });
    const data = [['L1', 'KPR', 'Active'], ['L2', 'KTA', 'Active'], ['L3', 'KTA', 'Active'], ['L4', 'KKB', 'Written Off']];
    const rows = data.map((d) => {
      const status = el('td', { class: 'tx-status' }, el('span', { class: 'tx-val', text: d[2] }));
      const flag = el('td', { class: 'tx-flag' });
      const tr = el('tr', { class: d[1] === 'KTA' ? 'tx-kta' : '' }, el('td', { text: d[0] }), el('td', { text: d[1] }), status, flag);
      return { tr, val: status.firstChild, flag, base: d[2], kta: d[1] === 'KTA' };
    });
    const lamp = el('span', { class: 'tx-lamp' });
    const table = el('table', { class: 'd-t d-fixed tx-t' },
      el('thead', {}, el('tr', {}, ['loan_id', 'product', 'status'].map((h, i) => el('th', { scope: 'col', class: 'tx-c' + i, text: h })), el('th', { scope: 'col', class: 'tx-flag' }, el('span', { class: 'vh', text: 'Is it final?' })))),
      el('tbody', {}, rows.map((r) => r.tr)));
    const count = el('span', { class: 'd-count' });
    const sheet = el('div', { class: 'paper demo-sheet tx-sheet', dataset: { state: 'start' } },
      el('div', { class: 'tx-top' }, lamp), table, el('div', { class: 'd-foot' }, count));
    const read = readout({
      start: 'The table as it is now. One loan is Written Off.',
      open: 'The UPDATE ran, and you can see the result: 3 loans are Written Off. <b>Nothing is final yet.</b> Keep it or undo it.',
      commit: '<code>COMMIT</code> made it final. <code>ROLLBACK</code> cannot undo it now, so check before you commit.',
      rollback: '<code>ROLLBACK</code> put everything back as it was at <code>BEGIN</code>. One loan is Written Off again, as if the UPDATE never ran.'
    });
    const runBtn = el('button', { type: 'button', class: 'key demo-key', text: 'Run BEGIN and UPDATE', onClick: () => paint('open', true) });
    const commitBtn = el('button', { type: 'button', class: 'key demo-key', onClick: () => paint('commit', true) }, el('b', { text: 'COMMIT' }), el('span', { text: 'Keep the change' }));
    const rollBtn = el('button', { type: 'button', class: 'key demo-key', onClick: () => paint('rollback', true) }, el('b', { text: 'ROLLBACK' }), el('span', { text: 'Undo the change' }));
    const againBtn = el('button', { type: 'button', class: 'key demo-key', text: 'Start over', onClick: () => paint('start', true) });
    const actions = el('div', { class: 'demo-ctl tx-ctl' }, runBtn, commitBtn, rollBtn, againBtn);
    const lampText = {
      start: 'No transaction open',
      open: 'Transaction open: not final',
      commit: 'Committed: final',
      rollback: 'Rolled back: as it was'
    };
    function paint(state, moveFocus) {
      sheet.dataset.state = state;
      lamp.textContent = lampText[state];
      const changed = state === 'open' || state === 'commit';
      rows.forEach((r) => {
        if (!r.kta) return;
        const now = changed ? 'Written Off' : r.base;
        if (setText(r.val, now)) anim(r.val, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 300, easing: 'steps(10)' });
        r.flag.textContent = state === 'open' ? 'not final' : state === 'commit' ? 'final' : state === 'rollback' ? 'put back' : '';
      });
      count.textContent = 'Written Off: ' + (changed ? 3 : 1);
      runBtn.hidden = state !== 'start';
      commitBtn.hidden = rollBtn.hidden = state !== 'open';
      againBtn.hidden = state !== 'commit' && state !== 'rollback';
      sql.show(state);
      read.show(state);
      if (moveFocus) (state === 'start' ? runBtn : state === 'open' ? commitBtn : againBtn).focus();
    }
    root.append(sql, actions, sheet, read);
    paint('start');
    host.append(root);
  }

  /* ---------- index: Mission 8.15. SCAN reads the whole payments table. SEARCH reads loan 102's rows. ---------- */
  const PAYMENTS = 4436;   /* Rows in payments. docs/DATA.md */
  const LOAN_102_ROWS = 3; /* SELECT COUNT(*) FROM payments WHERE loan_id = 102 */
  const PER_SQUARE = 20;
  function index(host) {
    const root = shell('index', 'Read everything, or go straight there', 'Same question both times: the payments for loan 102.');
    const comment = (t) => ({ t: '-- ' + t });
    const query = ['SELECT payment_id, amount', 'FROM payments', { t: 'WHERE loan_id = 102;', on: true }];
    const sql = slab({
      idle: [comment('No index on loan_id yet'), ...query],
      search: [comment('idx_payments_loan is in place'), ...query]
    });
    const total = Math.ceil(PAYMENTS / PER_SQUARE);
    const cells = Array.from({ length: total }, () => el('i'));
    const hits = [37, 118, 171];   /* Payments for one loan are spread across the table, as in the real data */
    hits.forEach((h) => cells[h].classList.add('t'));
    const grid = el('div', { class: 'ix-cells', role: 'img', 'aria-label': 'Every row of the payments table, drawn as ' + total + ' squares. Three of them hold loan 102.' }, cells);
    const keys = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109].map((k) => el('span', { class: 'ix-key' + (k === 102 ? ' me' : ''), text: k }));
    const stripLabel = el('span', { class: 'ix-strip-l', text: 'No index yet, and the rows are in no useful order' });
    const strip = el('div', { class: 'ix-strip', 'aria-hidden': 'true' }, stripLabel, el('div', { class: 'ix-keys' }, keys));
    const score = (label, word) => {
      const value = el('span', { class: 'ix-v', text: 'Not run yet' });
      const node = el('div', { class: 'ix-score' }, el('span', { class: 'ix-l', text: label }), value, el('code', { class: 'ix-word', text: word }));
      node.value = value;
      return node;
    };
    const scanScore = score('Without an index', 'SCAN');
    const searchScore = score('With an index', 'SEARCH');
    const legend = el('p', { class: 'ix-legend' }, el('i', { class: 'ix-sw t' }), 'Loan 102', el('i', { class: 'ix-sw r' }), 'Read', el('span', { class: 'ix-each', text: 'Each square is ' + PER_SQUARE + ' rows' }));
    const sheet = el('div', { class: 'paper demo-sheet ix-sheet', dataset: { mode: 'idle' } }, strip, grid, legend,
      el('div', { class: 'ix-scores' }, scanScore, searchScore));
    const read = readout({
      idle: 'Every square is part of the payments table. Choose a way to look, then count the rows it reads.',
      scan: '<code>SCAN</code>: the database reads all ' + PAYMENTS + ' rows, because a match could be anywhere, and another could follow it.',
      search: '<code>SEARCH</code>: the index is sorted, so the database goes straight to loan 102 and reads its ' + LOAN_102_ROWS + ' rows. Your query stays the same.'
    });
    const setCount = (s, n) => { s.value.innerHTML = K.UI.dm(String(n), { p: 3 }) + '<span class="ix-unit">rows read</span>'; };
    let cancel = null;
    function clear() {
      if (cancel) { cancel(); cancel = null; }
      cells.forEach((c) => c.classList.remove('r', 'h'));
      keys.forEach((k) => k.classList.remove('on'));
    }
    function scan() {
      clear();
      sheet.dataset.mode = 'scan';
      stripLabel.textContent = 'No index yet, and the rows are in no useful order';
      sql.show('idle');
      read.show('scan');
      searchScore.classList.remove('live');
      scanScore.classList.add('live');
      const finish = () => {
        cells.forEach((c) => c.classList.add('r'));
        hits.forEach((h) => cells[h].classList.add('h'));
        setCount(scanScore, PAYMENTS);
      };
      if (!motion()) { finish(); return; }
      let lit = 0;
      cancel = tween(root, 1300, (p) => {
        const to = Math.floor(p * total);
        for (; lit < to; lit++) {
          cells[lit].classList.add('r');
          if (cells[lit].classList.contains('t')) cells[lit].classList.add('h');
        }
        setCount(scanScore, Math.floor(p * PAYMENTS));
      }, finish);
    }
    function search() {
      clear();
      sheet.dataset.mode = 'search';
      stripLabel.textContent = 'The index: loan_id, sorted, each pointing at its rows';
      sql.show('search');
      read.show('search');
      scanScore.classList.remove('live');
      searchScore.classList.add('live');
      keys.forEach((k) => { if (k.classList.contains('me')) k.classList.add('on'); });
      const finish = () => {
        hits.forEach((h) => cells[h].classList.add('r', 'h'));
        setCount(searchScore, LOAN_102_ROWS);
      };
      if (!motion()) { finish(); return; }
      setCount(searchScore, 0);
      const timers = hits.map((h, i) => setTimeout(() => {
        if (!root.isConnected) return;
        cells[h].classList.add('r', 'h');
        setCount(searchScore, i + 1);
        anim(cells[h], [{ transform: 'scale(2.6)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
      }, 260 + i * 240));
      cancel = () => timers.forEach(clearTimeout);
    }
    const scanBtn = el('button', { type: 'button', class: 'key demo-key', text: 'Scan every row', onClick: scan });
    const searchBtn = el('button', { type: 'button', class: 'key demo-key', text: 'Use the index', onClick: search });
    root.append(sql, el('div', { class: 'demo-ctl ix-ctl' }, scanBtn, searchBtn), sheet, read);
    sql.show('idle');
    read.show('idle');
    host.append(root);
  }

  /* ---------- Entry point ---------- */
  function levelFor(host, opts) {
    if (opts && opts.level != null) return Number(opts.level);
    const marked = host.closest && host.closest('[data-demo-level]');
    if (marked) return Number(marked.dataset.demoLevel);
    const m = /^#\/m\/(\d+)/.exec(location.hash || '');
    return m ? Number(m[1]) : 0;
  }

  const DEMOS = {
    anatomy: (h) => anatomy(h),
    order: (h) => order(h),
    join: (h, level) => join(h, 'join', level),
    'join-left': (h, level) => join(h, 'join-left', level),
    group: (h) => group(h),
    fanout: (h) => fanout(h),
    window: (h) => windowFn(h),
    transaction: (h) => transaction(h),
    index: (h) => index(h)
  };

  K.Demos = {
    names: Object.keys(DEMOS),
    /** Draws the demo into hostEl, replacing what is there. An unknown name draws nothing and logs a warning. */
    render(name, host, opts) {
      const fn = DEMOS[name];
      host.replaceChildren();
      if (!fn) { console.warn('Unknown demo: ' + name); return; }
      fn(host, levelFor(host, opts));
    }
  };
})();
