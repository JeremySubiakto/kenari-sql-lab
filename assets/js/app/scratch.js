/*
 * Kenari.Scratch: free practice (route #/scratchpad). An editor on the practice copy, whose changes
 * stay until Reset practice data. Beside it: the full table reference with how tables connect, the
 * last 30 queries, and named saved queries. Text, history and saved queries live in State.scratch().
 *
 * The practice copy itself lives in the engine's worker, so a reload or a restart after a runaway
 * query empties it. Every run that changed it is kept in State.scratch().practice and played back
 * before the next query, which is what makes the changes stick.
 */
(function () {
  'use strict';
  const K = (window.Kenari = window.Kenari || {});

  const SAMPLE = `-- Example: a weekly report a colleague might send you.
-- Run it, then read one step at a time from the top.
WITH overdue AS (
  SELECT loan_id, dpd, outstanding,
         CASE
           WHEN dpd <= 30 THEN '01-30'
           WHEN dpd <= 60 THEN '31-60'
           WHEN dpd <= 90 THEN '61-90'
           ELSE '90+'
         END AS bucket
  FROM loans
  WHERE dpd > 0 AND status <> 'Written Off'
),
contacted AS (
  SELECT DISTINCT loan_id
  FROM collection_activities
  WHERE activity_date >= '2026-10-01'
)
SELECT o.bucket,
       COUNT(*) AS overdue_loans,
       SUM(o.outstanding) AS outstanding,
       ROUND(100.0 * COUNT(c.loan_id) / COUNT(*), 1) AS contacted_pct
FROM overdue o
LEFT JOIN contacted c ON c.loan_id = o.loan_id
GROUP BY o.bucket
ORDER BY o.bucket;`;
  const HISTORY_MAX = 30;
  const KEEP_LIMIT = 20000;
  const STAYS = 'This stays on your practice copy until you press Reset practice data.';
  const STAYS_TAB = 'This stays on your practice copy until you press Reset practice data or close this tab. You have changed so much that it is too big to keep after that.';
  const REPLAY_MAX_CHARS = 200000;
  const WORK_NOTE = 'Queries run only in this browser, and nothing is sent anywhere. Before you paste anything from work into another tool, check your company\'s rules and remove customer data.';
  const ICON_GROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 10l4-4 4 4M8 14l4 4 4-4"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  let baseCounts = null;
  let lastTab = 'tables';

  /* ---------- Practice copy: kept as the list of runs that changed it ---------- */
  /** {log: [sql, ...], changed: true once a run really changed data, full: too big to keep} in State.scratch(). */
  function practiceLog() {
    const sc = K.State.scratch();
    if (!sc.practice || !Array.isArray(sc.practice.log)) sc.practice = { log: [], changed: false, full: false };
    return sc.practice;
  }
  const logKey = (list) => list.join('\u0000');
  let applied = null;    /* {gen, key}: what the live practice copy already holds */
  let syncing = null;

  /** Makes the live practice copy match the log. Every practice query waits for this first. */
  function syncPractice() {
    if (syncing) return syncing;
    const { Engine } = K;
    const prac = practiceLog();
    /* Changes too big to keep are gone once the worker they lived in is gone. */
    if (prac.full && (!applied || applied.gen !== Engine.generation)) {
      prac.full = false;
      prac.changed = false;
      K.State.commit();
    }
    const key = logKey(prac.log);
    if (applied && applied.gen === Engine.generation && applied.key === key) return Promise.resolve();
    if (!applied && !prac.log.length) { applied = { gen: Engine.generation, key }; return Promise.resolve(); }
    syncing = (async () => {
      await Engine.ready;
      /* Restoring a backup changes the log under a live copy, so that copy starts again first. */
      if (applied && applied.gen === Engine.generation && applied.key) await Engine.resetPractice();
      const list = prac.log.slice();
      for (const sql of list) {
        /* A run that stopped on an error stops at the same place again, and its earlier statements still count. */
        try { await Engine.run(sql, { db: 'practice' }); } catch (e) {
          if (e && e.type === 'sql') continue;
          if (e && e.type === 'timeout') {
            prac.log = []; prac.changed = false; K.State.commit();
            K.UI.toast('Your earlier practice changes took too long to put back, so the practice data is back to how it came.', { ms: 7000 });
            applied = { gen: Engine.generation, key: '' };
            return;
          }
          throw e;
        }
      }
      applied = { gen: Engine.generation, key };
    })().finally(() => { syncing = null; });
    return syncing;
  }
  function practiceRun(sql) {
    return syncPractice().then(() => K.Engine.run(sql, { db: 'practice' }));
  }
  const touchedData = (actions) => (actions || []).some((a) => /^(DELETE|INSERT|REPLACE|UPDATE|DROP|CREATE|ALTER)/.test(a.verb));
  /** A run changed the copy: keep it, so it can be played back later. */
  function logRun(sql, touched) {
    const prac = practiceLog();
    if (touched) prac.changed = true;
    if (!prac.full) {
      prac.log.push(sql);
      if (logKey(prac.log).length > REPLAY_MAX_CHARS) { prac.log = []; prac.full = true; }
    }
    applied = { gen: K.Engine.generation, key: logKey(prac.log) };
    K.State.commit();
  }

  const q = (name) => '"' + String(name).replace(/"/g, '""') + '"';
  const previewOf = (sql) => String(sql).replace(/--.*$/gm, ' ').replace(/\s+/g, ' ').trim() || String(sql).trim();
  const rowsWord = (n) => n.toLocaleString('en-US') + (n === 1 ? ' row' : ' rows');

  function whenLabel(at) {
    const d = new Date(at);
    if (isNaN(d)) return '';
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return time;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + time;
  }

  /** Links as data: 'loans.customer_id → customers.customer_id' */
  function parseLinks() {
    return KenariData.LINKS.map((s) => {
      const m = s.match(/^(\w+)\.(\w+)\s*\S+\s*(\w+)\.(\w+)$/);
      return m ? { from: m[1], fromCol: m[2], to: m[3], toCol: m[4], text: s } : null;
    }).filter(Boolean);
  }

  /* A map of how the tables connect. Layout is by hand, the lines come from KenariData.LINKS. */
  const MAP_POS = {
    customers: [85, 22], branches: [259, 22],
    loans: [85, 80], collectors: [259, 80],
    payments: [85, 138], collection_activities: [259, 138],
    loan_snapshots: [85, 196], loan_assignments: [259, 196],
    batch_runs: [85, 254]
  };
  function mapSvg() {
    const W = 150, H = 32;
    const box = (name) => MAP_POS[name];
    const lines = [];
    for (const l of parseLinks()) {
      const a = box(l.from), b = box(l.to);
      if (!a || !b) continue;
      if (l.from === l.to) {
        /* The self-link: a small hump on the top edge */
        lines.push('<path class="m-self" d="M' + (a[0] + 36) + ' ' + (a[1] - H / 2) + 'q10 -15 20 0"/>');
        continue;
      }
      const sameCol = a[0] === b[0];
      const adjacent = Math.abs(a[1] - b[1]) <= 58;
      if (sameCol && adjacent) {
        lines.push('<path d="M' + a[0] + ' ' + (a[1] + (b[1] > a[1] ? H / 2 : -H / 2)) + 'V' + (b[1] + (b[1] > a[1] ? -H / 2 : H / 2)) + '"/>');
      } else if (sameCol) {
        /* Around the outside of the column, so it never runs through a box */
        const edge = a[0] < 172 ? a[0] - W / 2 : a[0] + W / 2;
        const out = a[0] < 172 ? -6 : 6;
        lines.push('<path d="M' + edge + ' ' + a[1] + 'h' + out + 'V' + b[1] + 'h' + (-out) + '"/>');
      } else {
        /* Across the middle gutter */
        const ax = a[0] < 172 ? a[0] + W / 2 : a[0] - W / 2;
        const bx = b[0] < 172 ? b[0] + W / 2 : b[0] - W / 2;
        lines.push('<path d="M' + ax + ' ' + a[1] + 'H172V' + b[1] + 'H' + bx + '"/>');
      }
    }
    const nodes = Object.keys(MAP_POS).map((name) => {
      const [x, y] = MAP_POS[name];
      const lone = !parseLinks().some((l) => l.from === name || l.to === name);
      return '<g class="' + (name === 'loans' ? 'm-hub' : lone ? 'm-lone' : '') + '"><rect x="' + (x - W / 2) + '" y="' + (y - H / 2) + '" width="' + W + '" height="' + H + '" rx="3"/><text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle">' + name + '</text></g>';
    }).join('');
    return '<svg class="sp-map" viewBox="0 0 344 276" role="img" aria-label="A map of how the tables connect. The same links are listed in words below.">' + lines.join('') + nodes + '</svg>';
  }

  function render(container) {
    const { UI, State, Engine, Editor } = K;
    const el = UI.el;
    /* Read it each time: restoring a backup, or another tab, replaces the object. */
    const sc = () => State.scratch();
    UI.setTitle('Scratchpad');

    let alive = true;
    let isExample = sc().text === null || sc().text === undefined || sc().text === SAMPLE;
    const firstOpen = sc().text === null || sc().text === undefined;
    if (firstOpen) sc().text = SAMPLE;

    /* ---------- Console ---------- */
    const lamp = el('span', { class: 'mc-lamp' });
    const statusB = el('b', { text: 'Ready to run' });
    const statusNote = el('span', { class: 'mc-note' });
    const growBtn = el('button', {
      type: 'button', class: 'sp-grow', 'aria-pressed': 'false', html: ICON_GROW + '<span>Bigger editor</span>',
      onClick: () => {
        const big = work.classList.toggle('big');
        growBtn.setAttribute('aria-pressed', big ? 'true' : 'false');
        growBtn.querySelector('span').textContent = big ? 'Bigger results' : 'Bigger editor';
        ed.refresh();
      }
    });
    const exampleBar = el('div', { class: 'sp-example' },
      el('span', { class: 'sp-tag', text: 'Example' }),
      el('span', { text: 'A report a colleague might send: overdue loans by days-late bucket, with how many were contacted this month. It is yours to change.' }));
    /* On a short window the sentence goes, and this tag keeps the example clearly marked. */
    const exampleTag = el('span', { class: 'sp-tag sp-tag-bar', text: 'Example' });

    const edHost = el('div', { class: 'sp-edhost' });
    const runBtn = el('button', { type: 'button', class: 'key canary sp-run', onClick: () => run() }, 'Run', el('span', { class: 'kbd', text: UI.runKeys() }));
    const saveBtn = el('button', { type: 'button', class: 'ghost', text: 'Save this query', onClick: () => saveDialog() });
    const clearBtn = el('button', { type: 'button', class: 'ghost', text: 'Clear', onClick: () => clearEditor() });
    const exampleBtn = el('button', { type: 'button', class: 'plain', text: 'Load the example', onClick: () => loadSql(SAMPLE, { toast: 'The example report is back in the editor.' }) });

    const consoleBox = el('div', { class: 'mc sp-console' },
      el('div', { class: 'mc-bar' }, lamp, exampleTag, statusB, statusNote, growBtn),
      exampleBar,
      edHost,
      el('div', { class: 'mc-act' }, saveBtn, clearBtn, exampleBtn, el('span', { class: 'sp' }), runBtn));

    /* ---------- Printout ---------- */
    const out = el('div', { class: 'sp-out', 'aria-label': 'Results' });

    /* ---------- Practice data ---------- */
    const practiceChip = el('span', { class: 'sp-practice' });
    const resetBtn = el('button', { type: 'button', class: 'ghost', text: 'Reset practice data', onClick: () => resetPractice() });
    const practiceChanged = () => practiceLog().changed;
    const paintPractice = () => {
      practiceChip.dataset.changed = practiceChanged() ? 'yes' : 'no';
      practiceChip.textContent = practiceChanged() ? 'Practice data: changed by you' : 'Practice data: as it came';
    };

    const head = el('header', { class: 'sp-head' },
      el('div', { class: 'sp-head-t' }, el('h1', { class: 'sp-title', text: 'Scratchpad' }), practiceChip),
      resetBtn);

    const work = el('div', { class: 'sp-work' }, head, consoleBox, out);

    /* ---------- Rail: tables, history, saved ---------- */
    const tabBtns = {};
    const panels = {};
    const tabLabel = {};
    const switchTab = (name) => {
      lastTab = name;
      for (const k of Object.keys(tabBtns)) {
        tabBtns[k].setAttribute('aria-pressed', k === name ? 'true' : 'false');
        panels[k].hidden = k !== name;
      }
    };
    const makeTab = (name, label) => {
      tabLabel[name] = el('span', { class: 'sp-tab-n' });
      tabBtns[name] = el('button', { type: 'button', onClick: () => switchTab(name) }, label, ' ', tabLabel[name]);
      panels[name] = el('div', { class: 'sp-panel' });
    };
    makeTab('tables', 'Tables');
    makeTab('history', 'History');
    makeTab('saved', 'Saved');
    const rail = el('aside', { class: 'sp-rail', 'aria-label': 'Reference, history and saved queries' },
      el('div', { class: 'seg sp-tabs', role: 'group', 'aria-label': 'Choose a panel' }, tabBtns.tables, tabBtns.history, tabBtns.saved),
      el('div', { class: 'sp-rail-body' }, panels.tables, panels.history, panels.saved),
      el('p', { class: 'sp-worknote', text: WORK_NOTE }));

    const page = el('div', { class: 'sp-page' }, work, rail);
    container.append(page);

    /* Phone: Run lives in a bottom bar that stays above the keyboard. */
    const backBtn = el('button', {
      type: 'button', class: 'ghost sp-back', text: 'Back to the editor', hidden: true,
      onClick: () => { consoleBox.scrollIntoView({ block: 'start', behavior: UI.motionOK() ? 'smooth' : 'auto' }); ed.focus(); }
    });
    const barRun = el('button', { type: 'button', class: 'key canary big sp-barrun', text: 'Run', onClick: () => run() });
    const bar = el('div', { class: 'sp-bar' }, backBtn, el('span', { class: 'sp' }), barRun);
    page.append(bar);

    /* ---------- Editor ---------- */
    let saveTimer = 0;
    const saveText = () => { clearTimeout(saveTimer); sc().text = ed.value; State.commit(); };
    const ed = Editor.create(edHost, {
      id: 'scratchpad', value: sc().text, label: 'SQL editor for the scratchpad', lines: { min: 5, max: 40 }, autocomplete: true, keybar: true,
      onInput: () => {
        sc().text = ed.value;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveText, 400);
        setExample(ed.value === SAMPLE);
        ready();
      },
      onRun: () => run()
    });

    /** A query opens at its first line, whatever was selected before. */
    function toTop() {
      const area = edHost.querySelector('.ed-ta');
      const box = edHost.querySelector('.ed-scroll');
      if (area) area.setSelectionRange(0, 0);
      if (box) { box.scrollTop = 0; box.scrollLeft = 0; }
    }
    function setExample(on) {
      isExample = on;
      exampleBar.hidden = !on;
      exampleTag.hidden = !on;
      exampleBtn.hidden = on;
    }
    function status(state, text, note) {
      if (state) lamp.dataset.state = state; else delete lamp.dataset.state;
      statusB.textContent = text;
      statusNote.textContent = note || '';
    }
    function ready() {
      const empty = KenariCheck.isEmptySql(ed.value);
      if (KenariCheck.hasBlanks(ed.value)) status('todo', 'Fill the yellow boxes, then press Run');
      else if (empty) status(null, 'Write a query, then press Run');
      else status('todo', isExample ? 'Example report, ready to run' : 'Ready to run');
    }

    /* ---------- Loading queries ---------- */
    /** Whatever is in the editor goes into History first, so loading something else never loses it. */
    function keepCurrent() {
      const text = ed.value;
      if (KenariCheck.isEmptySql(text) || text === SAMPLE) return false;
      const known = sc().history.some((h) => h.sql.trim() === text.trim()) || sc().saved.some((s) => s.sql.trim() === text.trim());
      if (known) return false;
      remember(text, 'Not run');
      return true;
    }
    function loadSql(sql, opts) {
      const o = opts || {};
      const kept = keepCurrent();
      ed.value = sql;
      sc().text = sql;
      State.commit();
      setExample(sql === SAMPLE);
      ed.clearError();
      showIdle();
      ready();
      if (o.toast || kept) UI.toast((o.toast || 'Loaded.') + (kept ? ' Your earlier query is in History.' : ''));
      if (matchMedia('(max-width:999px)').matches) consoleBox.scrollIntoView({ block: 'start', behavior: UI.motionOK() ? 'smooth' : 'auto' });
      toTop();
      if (!UI.coarse()) ed.focus();
      toTop();
    }
    function clearEditor() {
      const kept = keepCurrent();
      ed.value = '';
      sc().text = '';
      State.commit();
      setExample(false);
      ed.clearError();
      showIdle();
      ready();
      if (kept) UI.toast('Cleared. Your query is in History if you want it back.');
      ed.focus();
    }

    /* ---------- History ---------- */
    function remember(sql, note) {
      const t = String(sql).trim();
      if (!t || t.length > KEEP_LIMIT) return;
      const h = sc().history;
      const at = h.findIndex((x) => x.sql.trim() === t);
      if (at >= 0) h.splice(at, 1);
      h.unshift({ sql: t, at: Date.now(), note: note || '' });
      if (h.length > HISTORY_MAX) h.length = HISTORY_MAX;
      State.commit();
      renderHistory();
    }
    function renderHistory() {
      const p = panels.history;
      p.replaceChildren();
      tabLabel.history.textContent = sc().history.length || '';
      if (!sc().history.length) {
        p.append(el('p', { class: 'sp-none', text: 'Your last ' + HISTORY_MAX + ' queries appear here after you run them. Click one to put it back in the editor.' }));
        return;
      }
      p.append(el('div', { class: 'sp-panel-h' },
        el('h2', { text: 'Last ' + HISTORY_MAX + ' queries' }),
        el('button', {
          type: 'button', class: 'plain', text: 'Clear history',
          onClick: async () => {
            const yes = await UI.confirmInPage({ title: 'Clear the history?', body: 'This removes the list of past queries. Saved queries stay, and so does the text in the editor.', confirm: 'Clear history', cancel: 'Keep it', danger: true });
            if (!yes) return;
            sc().history.length = 0;
            State.commit();
            renderHistory();
          }
        })));
      p.append(el('ul', { class: 'sp-list' }, sc().history.map((h) => el('li', {},
        el('button', { type: 'button', class: 'sp-item', onClick: () => loadSql(h.sql) },
          el('code', { class: 'sp-item-q', text: previewOf(h.sql) }),
          el('span', { class: 'sp-item-m' }, el('span', { text: whenLabel(h.at) }), h.note ? el('span', { text: h.note }) : null))))));
    }

    /* ---------- Saved ---------- */
    function renderSaved() {
      const p = panels.saved;
      p.replaceChildren();
      tabLabel.saved.textContent = sc().saved.length || '';
      if (!sc().saved.length) {
        p.append(el('p', { class: 'sp-none', text: 'Nothing saved yet. When a query is worth keeping, press Save this query and give it a name you will recognize next month. Saved queries stay in this browser.' }));
        return;
      }
      p.append(el('div', { class: 'sp-panel-h' }, el('h2', { text: 'Your saved queries' })));
      p.append(el('ul', { class: 'sp-list' }, sc().saved.map((s, i) => el('li', { class: 'sp-saved' },
        el('button', { type: 'button', class: 'sp-item', onClick: () => loadSql(s.sql, { toast: 'Loaded ' + s.name + '.' }) },
          el('b', { class: 'sp-item-name', text: s.name }),
          el('code', { class: 'sp-item-q', text: previewOf(s.sql) })),
        el('button', {
          type: 'button', class: 'iconbtn sp-del', 'aria-label': 'Delete ' + s.name, html: ICON_X,
          onClick: async () => {
            const yes = await UI.confirmInPage({ title: 'Delete this saved query?', body: UI.el('p', { text: s.name + ' will be gone from this list.' }), confirm: 'Delete it', cancel: 'Keep it', danger: true });
            if (!yes) return;
            sc().saved.splice(i, 1);
            State.commit();
            renderSaved();
          }
        })))));
    }
    function saveDialog() {
      if (KenariCheck.isEmptySql(ed.value)) { UI.toast('The editor is empty, so there is nothing to save yet.'); return; }
      const sql = ed.value;
      const first = (sql.match(/^\s*--\s*(.+)$/m) || [])[1];
      const input = el('input', { type: 'text', class: 'sp-input', id: 'sp-name', maxlength: '80', autocomplete: 'off', value: first && sql !== SAMPLE ? first.slice(0, 60) : (sql === SAMPLE ? 'Overdue buckets with contact coverage' : '') });
      const msg = el('p', { class: 'sp-msg', role: 'alert' });
      const submit = (close) => {
        const name = input.value.trim();
        if (!name) { msg.textContent = 'Type a name first, so you can find this query later.'; input.focus(); return false; }
        const same = sc().saved.findIndex((s) => s.name.toLowerCase() === name.toLowerCase());
        if (same >= 0) sc().saved[same] = { name, sql, at: Date.now() };
        else sc().saved.unshift({ name, sql, at: Date.now() });
        State.commit();
        renderSaved();
        switchTab('saved');
        UI.toast(same >= 0 ? 'Replaced ' + name + ' with this version.' : 'Saved as ' + name + '.');
        if (close) close();
        return true;
      };
      const m = UI.modal({
        title: 'Save this query',
        body: el('div', { class: 'sp-form' },
          el('label', { for: 'sp-name', text: 'Name' }),
          input,
          msg,
          el('p', { class: 'sp-form-note', text: 'Saved queries stay in this browser. Using a name you already have replaces that query.' })),
        actions: [
          { label: 'Cancel', value: false },
          { label: 'Save', primary: true, onClick: () => submit() }
        ]
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); if (submit()) m.close(true); }
      });
      input.focus();
      input.select();
    }

    /* ---------- Table reference ---------- */
    const LINKS = parseLinks();
    const openTables = new Set(['loans']);
    let practiceInfo = null;   /* {counts:{name:n}, own:[{name,type,cols:[...]}]} once something changed */
    let wantColumn = null;
    const refFind = el('input', { type: 'search', class: 'sp-input sp-reffind', autocomplete: 'off', spellcheck: 'false', placeholder: 'Find a table or column', 'aria-label': 'Find a table or column' });
    const refList = el('div', { class: 'sp-reflist' });
    const refNone = el('p', { class: 'sp-none', hidden: true });

    function connectionsOf(t) {
      const list = [];
      for (const l of LINKS) {
        if (l.from === t && l.to === t) list.push({ other: t, sql: 'JOIN ' + t + ' boss\n  ON boss.' + l.toCol + ' = ' + t + '.' + l.fromCol, on: l.fromCol, self: true });
        else if (l.from === t) list.push({ other: l.to, sql: 'JOIN ' + l.to + '\n  ON ' + l.to + '.' + l.toCol + ' = ' + t + '.' + l.fromCol, on: l.fromCol });
        else if (l.to === t) list.push({ other: l.from, sql: 'JOIN ' + l.from + '\n  ON ' + l.from + '.' + l.fromCol + ' = ' + t + '.' + l.toCol, on: l.fromCol });
      }
      return list;
    }
    function insertCode(text) {
      ed.insert(text);
      if (!UI.coarse()) ed.focus();
      UI.announce('Put ' + text.replace(/\s+/g, ' ') + ' in your query.');
    }
    function peek(name, box, btn) {
      if (!box.hidden) { box.hidden = true; box.replaceChildren(); btn.setAttribute('aria-expanded', 'false'); btn.textContent = 'Peek at 5 rows'; return; }
      box.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      btn.textContent = 'Hide the rows';
      box.replaceChildren(el('p', { class: 'sp-none', text: 'Fetching the rows.' }));
      practiceRun('SELECT * FROM ' + q(name) + ' LIMIT 5;').then((r) => {
        if (!alive) return;
        box.replaceChildren(UI.ledger(r.results[0] || { columns: [], rows: [] }, { compact: true, foot: false, label: 'First five rows of ' + name }));
      }).catch((e) => {
        if (!alive) return;
        const gone = e && e.type === 'sql' && /no such table/.test(e.message || '');
        box.replaceChildren(el('p', { class: 'sp-none', text: gone ? 'This table is gone from your practice copy. Reset practice data brings it back.' : 'The rows could not be fetched right now. Try again in a moment.' }));
      });
    }
    function countLine(name) {
      const now = practiceInfo ? practiceInfo.counts[name] : baseCounts && baseCounts[name];
      const base = baseCounts && baseCounts[name];
      if (practiceInfo && now === undefined) return { text: 'dropped', changed: true };
      if (now === undefined || now === null) return { text: '', changed: false };
      if (base !== undefined && now !== base) return { text: now.toLocaleString('en-US') + ' rows, was ' + base.toLocaleString('en-US'), changed: true };
      return { text: rowsWord(now), changed: false };
    }
    function tableEntry(t, match) {
      const cnt = countLine(t.t);
      const peekBox = el('div', { class: 'sp-peek', hidden: true });
      const peekBtn = el('button', { type: 'button', class: 'plain', 'aria-expanded': 'false', text: 'Peek at 5 rows', onClick: () => peek(t.t, peekBox, peekBtn) });
      const conn = connectionsOf(t.t);
      const body = el('div', { class: 'sp-t-body' },
        el('div', { class: 'sp-t-acts' },
          el('button', { type: 'button', class: 'plain', text: 'Put the name in my query', onClick: () => insertCode(t.t) }),
          peekBtn),
        peekBox,
        el('ul', { class: 'sp-cols' }, t.c.map(([name, meaning]) => {
          const wanted = wantColumn && wantColumn.toLowerCase() === name.toLowerCase();
          return el('li', {},
            el('button', { type: 'button', class: 'sp-col' + (wanted ? ' want' : ''), onClick: () => insertCode(name), 'aria-label': 'Put ' + name + ' in your query. ' + meaning },
              el('code', { text: name }),
              wanted ? el('span', { class: 'use-this', text: 'Use this one' }) : null,
              el('span', { class: 'sp-col-m', text: meaning })));
        })),
        conn.length ? el('div', { class: 'sp-conn' },
          el('h4', { text: 'Connects to' }),
          el('ul', {}, conn.map((c) => el('li', {},
            el('button', { type: 'button', class: 'sp-joinbtn', onClick: () => insertCode(c.sql), title: 'Put this JOIN in your query', 'aria-label': 'Put a JOIN to ' + c.other + ' in your query, on ' + c.on },
              el('code', { text: c.other }),
              el('span', { text: c.self ? 'their boss, on ' + c.on : 'on ' + c.on }),
              el('span', { class: 'sp-joinadd', text: 'Add JOIN' })))))) : el('p', { class: 'sp-lone', text: 'This table stands alone. It logs the nightly feeds and has no links to the others.' }));
      const d = el('details', { class: 'sp-t', open: match || openTables.has(t.t) ? true : null, 'data-t': t.t },
        el('summary', {},
          el('span', { class: 'sp-t-h' },
            el('code', { text: t.t }),
            cnt.text ? el('span', { class: 'sp-t-count' + (cnt.changed ? ' changed' : ''), text: cnt.text }) : null),
          el('span', { class: 'sp-t-d', text: t.d })),
        body);
      d.addEventListener('toggle', () => { if (d.open) openTables.add(t.t); else openTables.delete(t.t); });
      return d;
    }
    function renderTables() {
      const term = refFind.value.trim().toLowerCase();
      const hit = (t) => !term || t.t.includes(term) || t.d.toLowerCase().includes(term) || t.c.some((c) => c[0].includes(term) || c[1].toLowerCase().includes(term));
      const schema = KenariData.SCHEMA.filter(hit);
      refList.replaceChildren();
      for (const t of schema) refList.append(tableEntry(t, !!term));
      const own = practiceInfo ? practiceInfo.own.filter((o) => !term || o.name.toLowerCase().includes(term)) : [];
      if (own.length) {
        refList.append(el('h3', { class: 'sp-own-h', text: 'Made by you on this copy' }));
        for (const o of own) {
          refList.append(el('div', { class: 'sp-own' },
            el('button', { type: 'button', class: 'sp-joinbtn', onClick: () => insertCode(o.name), 'aria-label': 'Put ' + o.name + ' in your query' },
              el('code', { text: o.name }),
              el('span', { text: (o.type === 'view' ? 'view' : rowsWord(o.count || 0)) + (o.cols.length ? ', ' + o.cols.join(', ') : '') }))));
        }
      }
      refNone.hidden = !!(schema.length || own.length);
      refNone.textContent = 'No table or column matches "' + refFind.value.trim() + '". Try part of the name, such as dpd or phone.';
    }
    refFind.addEventListener('input', renderTables);

    panels.tables.append(
      refFind,
      el('p', { class: 'sp-hint', text: 'Click a column to put it in your query.' }),
      refNone,
      refList,
      el('section', { class: 'sp-links', 'aria-labelledby': 'sp-links-h' },
        el('h2', { id: 'sp-links-h', text: 'How the tables connect' }),
        el('div', { class: 'sp-mapbox', html: mapSvg() }),
        el('ul', { class: 'sp-linklist' }, KenariData.LINKS.map((s) => el('li', { text: s })))));

    async function loadBaseCounts() {
      if (baseCounts) return;
      const names = KenariData.SCHEMA.map((t) => t.t);
      const sql = names.map((n) => 'SELECT ' + "'" + n + "'" + ' AS t, COUNT(*) AS n FROM ' + q(n)).join(' UNION ALL ') + ';';
      try {
        const r = await Engine.run(sql, { db: 'reference' });
        baseCounts = {};
        r.results[0].rows.forEach(([t, n]) => { baseCounts[t] = n; });
        if (alive) renderTables();
      } catch (e) { /* the reference works without row counts */ }
    }
    /* After a change: what is really on the practice copy now, including tables the learner made. */
    async function loadPractice() {
      if (!practiceChanged()) { practiceInfo = null; renderTables(); return; }
      const known = new Set(KenariData.SCHEMA.map((t) => t.t));
      try {
        const list = await practiceRun("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' UNION ALL SELECT name, type FROM sqlite_temp_master WHERE type IN ('table','view');");
        const rows = (list.results[0] && list.results[0].rows) || [];
        const counts = {}, own = [];
        if (rows.length) {
          const countSql = rows.map(([n]) => 'SELECT ' + "'" + n.replace(/'/g, "''") + "'" + ' AS t, COUNT(*) AS n FROM ' + q(n)).join(' UNION ALL ') + ';';
          const c = await Engine.run(countSql, { db: 'practice' });
          ((c.results[0] && c.results[0].rows) || []).forEach(([t, n]) => { counts[t] = n; });
          const mine = rows.filter(([n]) => !known.has(n));
          if (mine.length) {
            const colSql = mine.map(([n]) => "SELECT '" + n.replace(/'/g, "''") + "' AS t, name FROM pragma_table_info('" + n.replace(/'/g, "''") + "')").join(' UNION ALL ') + ';';
            const cols = await Engine.run(colSql, { db: 'practice' });
            const byName = {};
            ((cols.results[0] && cols.results[0].rows) || []).forEach(([t, name]) => { (byName[t] = byName[t] || []).push(name); });
            mine.forEach(([n, type]) => own.push({ name: n, type, count: counts[n], cols: byName[n] || [] }));
          }
        }
        practiceInfo = { counts, own };
      } catch (e) { practiceInfo = null; }
      if (alive) renderTables();
    }

    /* ---------- Printout states ---------- */
    function showIdle() {
      UI.announce('');
      out.replaceChildren(el('div', { class: 'sp-idle' }, el('p', { text: 'Press Run and the result prints here.' })));
      out.classList.remove('stack');
    }
    /* The slip points at the marked word, wherever the editor has scrolled it. */
    function pointerAt(slip) {
      const word = ed.markedRect();
      if (!word) return;
      const box = slip.getBoundingClientRect();
      slip.style.setProperty('--ax', Math.max(24, Math.min(word.left + word.width / 2 - box.left, box.width - 40)) + 'px');
    }
    function claudeButton(outcome, sql) {
      return el('button', {
        type: 'button', class: 'tlink', text: 'Copy for Claude',
        onClick: () => UI.copyForClaude({ kind: 'scratch', sql, outcome })
      });
    }
    function showError(e, sql) {
      const raw = e.message || 'The database stopped on that query.';
      const info = KenariCheck.explainError(raw, K.vocab, sql);
      /* Those two lines are written for missions, where every Run starts clean. This copy keeps changes. */
      if (info.note) info.note = info.note.replace(/, and every Run starts from a clean copy of the data/, '');
      info.plain = String(info.plain).replace('one click away, under All tables', 'in the Tables panel on this page');
      const slip = el('div', { class: 'helpslip sp-slip' }, el('h3', { text: info.title }), UI.rich(info.plain));
      const acts = el('div', { class: 'help-act' });
      if (info.fix) {
        acts.append(el('button', {
          type: 'button', class: 'fixbtn',
          onClick: () => {
            const from = info.fix.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const next = ed.value.replace(new RegExp('(^|[^\\w.])' + from + '(?![\\w])', 'i'), (m, p) => p + info.fix.to);
            ed.clearError();
            ed.replaceAll(next);
            sc().text = next;
            State.commit();
            setExample(next === SAMPLE);
            ready();
            out.replaceChildren(el('div', { class: 'sp-idle' }, el('p', { text: 'Changed. Press Run to try it.' })));
            runBtn.focus();
            wantColumn = null;
            renderTables();
          }
        }, 'Change ', el('code', { text: info.fix.from }), ' to ', el('code', { text: info.fix.to })));
      }
      acts.append(claudeButton({ kind: 'error', error: Object.assign({}, info, { raw }) }, sql));
      slip.append(acts);
      if (info.note) slip.append(el('p', { class: 'help-sub' }, UI.rich(info.note, { inline: true })));
      slip.append(el('p', { class: 'help-raw', text: 'The database said: ' + raw }));
      out.replaceChildren(slip);
      status('help', 'One word to fix');
      if (info.token) { ed.markError(info.token); pointerAt(slip); }
      if (info.useColumn) {
        wantColumn = info.useColumn;
        KenariData.SCHEMA.forEach((t) => { if (t.c.some((c) => c[0].toLowerCase() === wantColumn.toLowerCase())) openTables.add(t.t); });
        refFind.value = '';
        renderTables();
        switchTab('tables');
        if (matchMedia('(min-width:1000px)').matches) {
          const hit = refList.querySelector('.sp-col.want');
          if (hit) hit.scrollIntoView({ block: 'center' });
        }
      } else if (wantColumn) {
        wantColumn = null;
        renderTables();
      }
      UI.announce(info.title + '. ' + UI.plainOf(info.plain));
      const partial = e.partial;
      if (partial) printResults(partial, sql, { append: true, beforeError: true });
    }
    function changeBand(actions) {
      const said = K.describeChange ? K.describeChange(actions, { throwaway: false }) : '';
      if (!said) return null;
      return el('div', { class: 'vband sp-band' },
        el('div', {},
          el('h3', { class: 'vband-title', text: 'Done on your practice copy' }),
          el('div', { class: 'vband-body' }, UI.rich(said + ' ' + (practiceLog().full ? STAYS_TAB : STAYS)))));
    }
    function printResults(r, sql, opts) {
      const o = opts || {};
      const results = r.results || [];
      const nodes = [];
      const multiple = results.length > 1;
      const band = changeBand(r.actions);
      const summary = results.length
        ? results.map((x) => rowsWord(x.rows.length)).join(', ')
        : 'No table came back';
      const outcome = results.length
        ? 'It ran without an error and returned ' + results.map((x) => rowsWord(x.rows.length) + ' with columns ' + x.columns.join(', ')).join('; then ') + '.'
        : 'It ran without an error, and no table came back.' + (band ? ' ' + UI.plainOf(K.describeChange(r.actions, { throwaway: false })) : '');
      results.forEach((res, i) => {
        const title = o.beforeError
          ? (multiple ? 'Ran before the error, result ' + (i + 1) + ' of ' + results.length : 'Ran before the error')
          : multiple ? 'Result ' + (i + 1) + ' of ' + results.length : (isExample ? 'Example result' : null);
        const isLast = i === results.length - 1;
        const sheet = UI.ledger(res, {
          animate: !o.append && UI.motionOK(),
          title,
          label: title || 'Query result',
          actions: isLast && !o.beforeError ? [claudeButton(outcome, sql)] : []
        });
        sheet.addEventListener('click', () => sheet.finish());
        nodes.push(sheet);
      });
      if (band) {
        if (nodes[0]) nodes[0].prepend(band);
        else {
          const sheet = el('div', { class: 'paper sp-solo' }, band, el('div', { class: 'lg-foot' }, el('span', { class: 'lg-count', text: 'No table came back' }), el('span', { class: 'sp' }), claudeButton(outcome, sql)));
          nodes.push(sheet);
        }
      } else if (!nodes.length && !o.beforeError) {
        nodes.push(el('div', { class: 'paper sp-solo' },
          el('div', { class: 'vband sp-band' }, el('div', {}, el('h3', { class: 'vband-title', text: 'It ran, and no table came back' }), el('div', { class: 'vband-body', text: 'That statement does not return rows. Add a SELECT to see the data.' }))),
          el('div', { class: 'lg-foot' }, el('span', { class: 'sp' }), claudeButton(outcome, sql))));
      }
      if (o.append) out.append(...nodes);
      else out.replaceChildren(...nodes);
      out.classList.toggle('stack', out.children.length > 1);
      return summary;
    }

    /* ---------- Run ---------- */
    let runId = 0;
    let running = 0;
    function run(opts) {
      running++;
      return runNow(opts).finally(() => { running--; });
    }
    async function runNow(opts) {
      const o = opts || {};
      const sql = ed.value;
      const mine = ++runId;
      UI.announce('');
      ed.clearError();
      clearTimeout(saveTimer);
      sc().text = sql;
      if (KenariCheck.isEmptySql(sql)) {
        status(null, 'Write a query, then press Run');
        out.replaceChildren(el('div', { class: 'sp-idle' }, el('p', { text: 'The editor is empty. Write a query, or use Load the example, then press Run.' })));
        ed.focus();
        return;
      }
      if (KenariCheck.hasBlanks(sql)) {
        status('todo', 'Fill the yellow boxes, then press Run');
        out.replaceChildren(el('div', { class: 'sp-idle' }, el('p', { text: 'The yellow boxes are waiting for you. Your cursor is in the first one.' })));
        ed.selectFirstBlank();
        return;
      }
      const warming = Engine.status !== 'ready';
      status('busy', warming ? 'Warming up the database' : 'Running');
      out.replaceChildren();
      if (warming) out.append(el('div', { class: 'sp-idle' }, el('p', { text: 'Warming up the database. Your query runs as soon as it is ready.' })));
      if (matchMedia('(max-width:999px)').matches && !o.silent) {
        if (edHost.contains(document.activeElement)) ed.blur();
        else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      }
      try {
        const r = await practiceRun(sql);
        if (!o.silent) State.bumpQueries();
        const summary = (r.results || []).length ? r.results.map((x) => rowsWord(x.rows.length)).join(', ') : (r.changed != null ? 'Changed the practice copy' : 'No table came back');
        if (!o.silent) remember(sql, summary);
        if (r.changed != null) logRun(sql, touchedData(r.actions));
        if (!alive || mine !== runId) return;
        paintPractice();
        printResults(r, sql);
        const n = (r.results || []).length;
        const note = (r.ms != null ? r.ms + ' ms' : '');
        status(null, n > 1 ? n + ' results, last one ' + rowsWord(r.results[n - 1].rows.length) : n === 1 ? rowsWord(r.results[0].rows.length) : 'Done', note);
        UI.announce(n ? 'Query ran. ' + summary + '.' : 'Query ran. ' + UI.plainOf(K.describeChange(r.actions, { throwaway: false }) || 'No table came back.'));
        if (r.changed != null) loadPractice();
        if (matchMedia('(max-width:999px)').matches && !o.silent) out.scrollIntoView({ block: 'start', behavior: UI.motionOK() ? 'smooth' : 'auto' });
      } catch (e) {
        if (!o.silent) State.bumpQueries();
        if (e && e.type === 'sql') {
          if (!o.silent) remember(sql, 'Stopped with an error');
          if (e.partial && e.partial.changed != null) logRun(sql, touchedData(e.partial.actions));
          if (!alive || mine !== runId) return;
          paintPractice();
          showError(e, sql);
          if (e.partial && e.partial.changed != null) loadPractice();
          return;
        }
        if (e && e.type === 'timeout') {
          const kept = practiceChanged();
          if (!o.silent) remember(sql, 'Stopped after 8 seconds');
          if (!alive || mine !== runId) return;
          /* The restart emptied the practice copy, so the kept runs go back on it now. */
          if (kept) loadPractice();
          status('help', 'Stopped after 8 seconds');
          out.replaceChildren(el('div', { class: 'helpslip sp-slip' },
            el('h3', { text: 'That query took too long' }),
            UI.rich('That query was still running after 8 seconds, so I stopped it. The usual cause is a <code>JOIN</code> with no <code>ON</code>. Your query is still in the editor.'),
            kept ? el('p', { class: 'help-sub', text: 'The database had to restart, and your earlier changes to the practice copy are back in place.' }) : null,
            el('div', { class: 'help-act' }, claudeButton({ kind: 'timeout' }, sql))));
          UI.announce('That query took too long, so it was stopped after 8 seconds.');
          return;
        }
        if (!alive || mine !== runId) return;
        showEngineTrouble(e && e.message);
      }
    }
    function showEngineTrouble(message) {
      status('help', 'The database is not running');
      const retry = el('button', {
        type: 'button', class: 'fixbtn', text: 'Try again',
        onClick: () => {
          status('busy', 'Warming up the database');
          Engine.retry();
          Engine.ready.then(() => { if (alive) run({ silent: isExample }); }).catch((err) => { if (alive) showEngineTrouble(err && err.message); });
        }
      });
      out.replaceChildren(el('div', { class: 'helpslip sp-slip' },
        el('h3', { text: 'The database could not start' }),
        el('p', { text: message || 'The database engine could not load. Your queries are safe in this browser. Check the connection, then try again.' }),
        el('div', { class: 'help-act' }, Engine.status === 'failed' ? retry : null)));
      UI.announce('The database could not start.');
    }

    /* ---------- Reset ---------- */
    async function resetPractice() {
      if (practiceChanged()) {
        const yes = await UI.confirmInPage({
          title: 'Reset the practice data?',
          body: 'All nine tables go back to how they came, and temp tables you made are removed. The text in the editor, your history and your saved queries all stay.',
          confirm: 'Reset practice data', cancel: 'Keep my changes', danger: true
        });
        if (!yes) return;
      }
      try {
        await Engine.resetPractice();
      } catch (e) {
        UI.toast('The practice data could not be reset right now. Try again in a moment.');
        return;
      }
      State.scratch().practice = { log: [], changed: false, full: false };
      applied = { gen: Engine.generation, key: '' };
      State.commit();
      practiceInfo = null;
      wantColumn = null;
      if (!alive) return;
      paintPractice();
      renderTables();
      showIdle();
      ready();
      UI.toast('Practice data reset. Everything is back to how it came.');
    }

    /* ---------- Phone: bottom bar stays above the keyboard ---------- */
    const root = document.documentElement;
    /* The editor's key bar rides above this bar, which rides above the keyboard. Wide screens have no bar. */
    const liftKeybar = () => {
      const h = getComputedStyle(bar).display === 'none' ? 0 : bar.offsetHeight;
      root.style.setProperty('--ed-bar-lift', h + 'px');
      root.style.setProperty('--toast-lift', (h ? h + 8 : 0) + 'px');
    };
    liftKeybar();
    window.addEventListener('resize', liftKeybar);
    const vv = window.visualViewport;
    const placeBar = () => {
      if (!vv) return;
      const lift = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      bar.style.setProperty('--kb', lift + 'px');
    };
    if (vv) { vv.addEventListener('resize', placeBar); vv.addEventListener('scroll', placeBar); placeBar(); }
    let io = null;
    if (window.IntersectionObserver) {
      io = new IntersectionObserver((entries) => { backBtn.hidden = entries[0].isIntersecting; }, { rootMargin: '-40px 0px -80px 0px' });
      io.observe(consoleBox);
    }

    /* ---------- Warming up ---------- */
    const offStatus = Engine.onStatus((s) => {
      if (!alive) return;
      if (s === 'loading' && lamp.dataset.state !== 'busy') status('busy', 'Warming up the database');
      if (s === 'ready' && lamp.dataset.state === 'busy' && statusB.textContent === 'Warming up the database' && !running) ready();
    });

    /* ---------- Open ---------- */
    syncPractice().catch(() => { /* the engine is not up yet. The next query says so if it stays down. */ });
    paintPractice();
    setExample(isExample);
    renderHistory();
    renderSaved();
    renderTables();
    switchTab(lastTab);
    loadBaseCounts();
    if (practiceChanged()) loadPractice();
    ready();

    /* The example runs by itself on the way in. Anything of the learner's waits for them to press Run. */
    if (firstOpen) State.commit();
    if (isExample) {
      run({ silent: true });
    } else {
      showIdle();
    }
    toTop();
    if (!UI.coarse()) ed.focus();
    toTop();

    return () => {
      alive = false;
      clearTimeout(saveTimer);
      sc().text = ed.value;
      State.commit();
      offStatus();
      root.style.removeProperty('--toast-lift');
      root.style.removeProperty('--ed-bar-lift');
      window.removeEventListener('resize', liftKeybar);
      if (vv) { vv.removeEventListener('resize', placeBar); vv.removeEventListener('scroll', placeBar); }
      if (io) io.disconnect();
      ed.destroy();
    };
  }

  K.Scratch = { render, SAMPLE };
})();
