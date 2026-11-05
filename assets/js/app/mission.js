/*
 * Kenari.Mission: the heart of the product. See docs/DESIGN.md.
 *
 * Desktop: two panes, each scrolling on its own. The right pane is a stage over a docked console.
 * Everything the database says back rises out of the console as paper and covers the stage, so
 * nothing shifts.
 *
 * Phone (below 1000px, see docs/PHONE.md): an app, not a page. One locked screen with a mission bar,
 * Learn | Task | Result tabs, one step at a time, and a fixed bottom bar with one main action. The same
 * parts are used. root.dataset.step says which step shows, and mission.css does the rest.
 *
 * Kenari.Mission.mount(container, lesson, {mode:'learn'|'review', onDone, onNext, nextLabel}) -> cleanup
 *   learn:  onDone({ok:true, firstTime, levelCleared, lesson}) fires as the stamp lands.
 *   review: no teaching, no blanks, no drafts, nothing written to State. Hints appear after two failed runs.
 *           onDone({ok, answerSeen, attempts, lesson}) fires when the learner presses the Next key,
 *           so the stamp has been seen first. ok is false if they looked at the answer.
 */
(function () {
  'use strict';
  const K = (window.Kenari = window.Kenari || {});

  const WIDE = '(min-width: 1000px)';
  const isWide = () => matchMedia(WIDE).matches;
  const BLANK = /_{3,}/g;
  const HONORIFIC = /^(bu|pak|ibu|bapak|mas|mbak)$/i;

  /* ---------- Small helpers ---------- */
  const countBlanks = (s) => (String(s || '').match(BLANK) || []).length;
  const lineCount = (s) => String(s || '').split('\n').length;
  const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function requester(from) {
    const text = String(from || '').trim();
    if (!text) return null;
    const comma = text.indexOf(',');
    const name = comma >= 0 ? text.slice(0, comma).trim() : text;
    const role = comma >= 0 ? text.slice(comma + 1).trim() : '';
    const words = name.split(/\s+/);
    const first = words.find((w) => !HONORIFIC.test(w)) || words[0];
    return { name, role, initials: first.slice(0, 2).toUpperCase() };
  }

  /* A stable shuffle, seeded by the mission ID, so the tiles never jump between visits. */
  function stableShuffle(list, seedText) {
    let h = 2166136261;
    for (const ch of String(seedText)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rand = () => {
      h = (h + 0x6D2B79F5) | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.length > 1 && out.every((v, i) => v === list[i])) out.push(out.shift());
    return out;
  }

  const schemaByName = (name) => KenariData.SCHEMA.find((t) => t.t === name);
  function tablesIn(sql) {
    const clean = String(sql || '').replace(/'(?:[^']|'')*'/g, "''");
    return KenariData.SCHEMA.filter((t) => new RegExp('\\b' + t.t + '\\b', 'i').test(clean));
  }

  /* A single-table filter can honestly say "37 rows kept, of 502". Anything else cannot. */
  function keptTable(sql) {
    const clean = KenariCheck.stripComments(String(sql || '')).trim().replace(/;\s*$/, '');
    if (!clean || clean.includes(';')) return null;
    if (/\b(JOIN|GROUP\s+BY|HAVING|UNION|INTERSECT|EXCEPT|LIMIT|OFFSET|DISTINCT|OVER|COUNT|SUM|AVG|MIN|MAX|TOTAL|WITH)\b/i.test(clean)) return null;
    if ((clean.match(/\bSELECT\b/gi) || []).length !== 1) return null;
    const m = /^SELECT\b[\s\S]*?\bFROM\s+([A-Za-z_]+)(?:\s+(?:AS\s+)?[A-Za-z_]+)?\s+WHERE\b/i.exec(clean);
    return m && K.vocab.tables.includes(m[1].toLowerCase()) ? m[1].toLowerCase() : null;
  }
  const tableSizes = new Map();
  function tableSize(name) {
    if (!tableSizes.has(name)) {
      const p = K.Engine.run('SELECT COUNT(*) FROM ' + name, { db: 'reference' }).then((r) => r.results[0].rows[0][0]);
      p.catch(() => tableSizes.delete(name));
      tableSizes.set(name, p);
    }
    return tableSizes.get(name).catch(() => null);
  }

  /* The word to change, skipping text in quotes and comments. Returns [start, end] or null. */
  function findWord(sql, word) {
    if (!word) return null;
    const w = escRe(word);
    /* No lookbehind in these patterns: Safari before 16.4 cannot compile one. */
    const re = new RegExp("'(?:[^']|'')*'?|--[^\\n]*|(^|[^A-Za-z0-9_])(" + w + ')(?![A-Za-z0-9_])', 'gi');
    let m;
    while ((m = re.exec(sql))) {
      if (m[2] !== undefined) return [m.index + m[1].length, m.index + m[0].length];
      if (!m[0]) re.lastIndex++;
    }
    return null;
  }
  function replaceWord(sql, from, to) {
    const w = escRe(from);
    const re = new RegExp("'(?:[^']|'')*'?|--[^\\n]*|(^|[^A-Za-z0-9_])(" + w + ')(?![A-Za-z0-9_])', 'gi');
    return sql.replace(re, (all, before, hit) => (hit !== undefined ? before + to : all));
  }

  /* Pick the example line that carries the new idea, but only when that is obvious. */
  function keyLine(lesson) {
    const ex = lesson.ex;
    if (!ex || ex.length < 2) return -1;
    const idea = String(lesson.newIdea || '');
    const tokens = [];
    idea.replace(/<code>([^<]+)<\/code>/g, (a, t) => { tokens.push(t.trim()); return a; });
    (idea.replace(/<[^>]+>/g, ' ').match(/\b[A-Z][A-Z_]{1,}\b/g) || []).forEach((t) => { if (K.UI.SQL_KEYWORDS.includes(t) || K.UI.SQL_FUNCTIONS.includes(t)) tokens.push(t); });
    for (const t of tokens) {
      const re = new RegExp('(?:^|[^A-Za-z0-9_])' + escRe(t) + '(?![A-Za-z0-9_])', 'i');
      const hits = ex.map((x, i) => (re.test(x[0]) ? i : -1)).filter((i) => i >= 0);
      if (hits.length === 1) return hits[0];
    }
    return -1;
  }

  /* Review opens an empty editor where the mission had blanks, so the request and the hints stop mentioning them. */
  function reviewTask(task) {
    return String(task || '')
      .replace(/\bFill (?:in )?the blanks? to (\w)/, (all, c) => c.toUpperCase())
      .replace(/\s*Fill in the [^.]*\./g, '')
      .replace(/ in the blank,/g, '');
  }
  const mentionsBlank = (text) => /\bblanks?\b/i.test(text);

  /* The request on one line: a table or a list waits behind Read all. */
  const oneLine = (html) => String(html || '').replace(/<table[\s\S]*?<\/table>/gi, ' ').replace(/<\/?(p|ul|ol|li|div|br)\b[^>]*>/gi, ' ').replace(/\s+/g, ' ').trim();

  /* ---------- Mount ---------- */
  /* Below 1000px: the last few passes of this visit, so Back from the Cheat sheet does not lose what was earned. */
  const lastPass = new Map();
  function keepPass(id, p) {
    lastPass.delete(id);
    lastPass.set(id, p);
    if (lastPass.size > 4) lastPass.delete(lastPass.keys().next().value);
  }

  function mount(container, lesson, opts) {
    const { UI, State, Engine } = K;
    const el = UI.el;
    const o = opts || {};
    const review = o.mode === 'review';
    const type = lesson.type || 'write';
    const isQuiz = type === 'quiz', isOrder = type === 'order';
    const isExam = !!lesson.exam;
    const next = K.nextLesson(lesson.id);
    const level = lesson.level;
    /* In review a starter with blanks goes away. One with none stays, because its request leans on it ("Both steps are ready in the editor"). */
    const blanksGone = review && type !== 'fix' && KenariCheck.hasBlanks(lesson.starter || '');
    /* lesson.phone: [from, to] pairs for sentences that describe the laptop layout. Below 1000px they say what is on this screen. */
    const wording = (text) => (!isWide() && lesson.phone && typeof text === 'string' ? lesson.phone.reduce((t, [a, b]) => t.replace(a, b), text) : text);
    const taskHtml = wording(blanksGone ? reviewTask(lesson.task) : lesson.task);
    const hints = (blanksGone ? (lesson.hints || []).filter((h) => !mentionsBlank(h)) : (lesson.hints || [])).map(wording);
    const showHints = !isExam && !isQuiz && (hints.length > 0 || (blanksGone && !!lesson.solution));
    const coarse = UI.coarse();

    const S = {
      disposed: false,
      phase: 'edit',        /* edit | running | printing | stamping | passed */
      outcome: null,        /* null | 'error' | 'near' | 'fail' | 'timeout' */
      seq: 0,
      held: false,
      shownHints: review ? 0 : Math.min(hints.length, (State.lesson(lesson.id).hints || 0)),
      answerSeen: false,
      failed: 0,
      attempts: 0,
      firstTime: false,
      levelCleared: null,
      ledgers: [],
      sheet: null,
      slip: null,
      lowered: false,
      litColumn: null
    };
    const cleanups = [];
    const onCleanup = (fn) => cleanups.push(fn);

    if (!review) State.setCurrent(lesson.id);

    const starter = blanksGone ? '' : (lesson.starter || '');
    const saved = review ? null : State.lesson(lesson.id).draft;
    const startText = saved != null ? saved : starter;

    /* The phone's steps. A fresh mission opens on Learn. A draft, a cleared mission or a review opens on Task. */
    const steps = review ? ['task', 'result'] : isQuiz ? ['learn', 'task'] : ['learn', 'task', 'result'];
    const stepLabel = { learn: isExam ? 'Brief' : 'Learn', task: isQuiz ? 'Question' : 'Task', result: 'Result' };
    S.step = review || saved != null || State.isDone(lesson.id) ? 'task' : 'learn';
    /* Below 1000px a pass from earlier in this visit is still here: its printout, its stamp and its Next. */
    const restored = !review && !isQuiz && !isWide() && State.isDone(lesson.id) ? lastPass.get(lesson.id) : null;
    if (restored) S.step = 'result';

    const root = el('section', { class: 'ms' + (review ? ' is-review' : ''), 'data-type': type, 'data-step': S.step, 'aria-label': 'Mission ' + lesson.id });
    if (isExam) root.classList.add('is-exam');
    if (isQuiz) root.classList.add('is-quiz');

    /* ---------- Left: learn ---------- */
    function dotsNav() {
      const nav = el('nav', { class: 'ms-dots', 'aria-label': 'Missions in level ' + level.n });
      const tip = el('div', { class: 'ms-tip', role: 'presentation', hidden: true });
      level.lessons.forEach((l) => {
        const a = el('a', {
          href: '#/m/' + l.id,
          class: 'ms-dot' + (l.id === lesson.id ? ' cur' : '') + (State.isDone(l.id) ? ' on' : '') + (l.checkpoint || l.exam ? ' cp' : ''),
          'aria-label': l.id + ' ' + l.title + (State.isDone(l.id) ? ', cleared' : ''),
          'aria-current': l.id === lesson.id ? 'page' : null,
          dataset: { id: l.id }
        }, el('i'));
        const show = () => {
          tip.textContent = l.id + ' ' + l.title;
          tip.hidden = false;
          const nr = nav.getBoundingClientRect(), ar = a.getBoundingClientRect();
          const w = tip.offsetWidth;
          tip.style.left = Math.max(0, Math.min(ar.left - nr.left + ar.width / 2 - w / 2, nr.width - w)) + 'px';
          tip.style.top = (ar.bottom - nr.top + 2) + 'px';
        };
        const hide = () => { tip.hidden = true; };
        a.addEventListener('pointerenter', show);
        a.addEventListener('pointerleave', hide);
        a.addEventListener('focus', show);
        a.addEventListener('blur', hide);
        nav.append(a);
      });
      nav.append(tip);
      return nav;
    }

    function navLink(l, dir) {
      if (!l) return el('span', { class: 'ms-navgap', 'aria-hidden': 'true' });
      return el('a', {
        href: '#/m/' + l.id, class: 'ms-nav-a',
        'aria-label': (dir === 'prev' ? 'Previous mission: ' : 'Next mission: ') + l.id + ' ' + l.title,
        title: l.id + ' ' + l.title,
        html: dir === 'prev' ? UI.icons.left + '<span>' + UI.esc(l.id) + '</span>' : '<span>' + UI.esc(l.id) + '</span>' + UI.icons.right
      });
    }

    function openPositionSheet() {
      const list = el('ol', { class: 'ms-poslist' }, level.lessons.map((l) => el('li', {},
        el('a', {
          href: '#/m/' + l.id,
          class: 'ms-posrow' + (l.id === lesson.id ? ' cur' : '') + (State.isDone(l.id) ? ' on' : ''),
          'aria-current': l.id === lesson.id ? 'page' : null
        }, el('i', { class: 'ms-posmark', html: State.isDone(l.id) ? UI.icons.check : '' }),
          el('span', { class: 'ms-posid', text: l.id }),
          el('span', { class: 'ms-postitle', text: l.title }),
          l.id === lesson.id ? el('em', { text: 'You are here' }) : null))));
      const sheet = UI.sheet({ title: 'Level ' + level.n + ', ' + level.title, body: list });
      list.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (!a) return;
        if (a.classList.contains('cur')) e.preventDefault();
        sheet.close();
      });
      const cur = list.querySelector('.cur');
      if (cur) cur.scrollIntoView({ block: 'center' });
    }

    /* ---------- Phone: the mission bar and the step tabs ---------- */
    let saldoEl = null;
    function buildMissionBar() {
      const idx = level.lessons.indexOf(lesson);
      saldoEl = el('b', { text: State.doneCount() });
      return el('div', { class: 'ms-mbar' },
        el('div', { class: 'ms-mbar-row' },
          el('a', { href: '#/journey', class: 'ms-back', 'aria-label': 'Back to the journey', html: UI.icons.left }),
          el('h1', { class: 'ms-mhead' },
            el('button', {
              type: 'button', class: 'ms-mtitle', 'aria-haspopup': 'dialog',
              'aria-label': 'Mission ' + lesson.id + ', ' + lesson.title + '. See every mission in level ' + level.n,
              onClick: openPositionSheet
            }, el('span', { class: 'ms-mid', text: lesson.id }), el('span', { class: 'ms-mname', text: lesson.title }), el('span', { class: 'ms-mdown', html: UI.icons.down }))),
          el('a', { href: '#/passbook', class: 'ms-saldo', 'aria-label': 'Saldo. Open the passbook.' }, el('small', { text: 'Saldo' }), saldoEl)),
        el('span', { class: 'ms-mprog', style: { '--p': ((idx + 1) / level.lessons.length * 100) + '%' } }));
    }
    function tickSaldo() {
      if (!saldoEl) return;
      const n = State.doneCount();
      if (String(n) === saldoEl.textContent) return;
      saldoEl.textContent = n;
      UI.anim(saldoEl, [{ transform: 'translateY(-70%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }

    const tabs = {};
    function buildSegs() {
      const bar = el('div', { class: 'ms-segs', role: 'tablist', 'aria-label': 'Steps of this mission' });
      steps.forEach((st) => {
        tabs[st] = el('button', {
          type: 'button', class: 'ms-seg', role: 'tab', id: 'ms-tab-' + st, tabindex: '-1',
          'aria-selected': 'false', 'aria-controls': st === 'learn' ? 'ms-panel-learn' : 'ms-panel-do',
          text: stepLabel[st],
          onClick: () => { setStep(st); UI.announce(stepLabel[st] + ' step'); }
        });
        bar.append(tabs[st]);
      });
      /* Arrow keys move between tabs that can open, as a tablist should. */
      bar.addEventListener('keydown', (e) => {
        const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        const open = steps.filter((st) => !tabs[st].disabled);
        const to = open[(open.indexOf(S.step) + dir + open.length) % open.length];
        setStep(to);
        tabs[to].focus();
      });
      return bar;
    }
    function paintSegs() {
      steps.forEach((st) => {
        const t = tabs[st];
        if (!t) return;
        t.setAttribute('aria-selected', String(st === S.step));
        t.tabIndex = st === S.step ? 0 : -1;
        if (st === 'result') t.disabled = !S.sheet;
      });
    }

    /* Which step shows. Only mission.css below 1000px reads data-step, so this changes nothing on a laptop. */
    function setStep(st) {
      if (!steps.includes(st)) return;
      const from = S.step;
      S.step = st;
      root.dataset.step = st;
      paintSegs();
      if (isWide()) return;
      doPane.setAttribute('aria-labelledby', 'ms-tab-' + (st === 'learn' ? 'task' : st));
      closeCopyMenus();
      if (st !== from) {
        const pane = st === 'learn' ? learnPane : st === 'result' ? tray : doPane;
        const dir = steps.indexOf(st) > steps.indexOf(from) ? 1 : -1;
        if (pane) UI.anim(pane, [{ transform: 'translateX(' + (dir * 30) + 'px)', opacity: 0.4 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 170, easing: 'cubic-bezier(.2,.7,.3,1)' });
      }
      if (st !== 'task') setReqOpen(false);
      if (st === 'task' && ed) {
        ed.refresh();
        /* The query opens at its top. The caret comes into view when the learner is in the editor. */
        if (edHost.contains(document.activeElement)) ed.revealCaret();
        else { const box = edHost.querySelector('.ed-scroll'); if (box) box.scrollTop = 0; }
      }
      if (st === 'task') requestAnimationFrame(clampRequest);
      if (st === 'result' && S.sheet && S.sheet.pin) requestAnimationFrame(() => S.sheet.pin.checkOverflow());
      if (st === 'result' && S.sheet && S.sheet.checkBand) requestAnimationFrame(S.sheet.checkBand);
    }

    /* Try it: on a touch screen the keyboard stays down until the learner taps the editor. */
    function goToWork() {
      setStep('task');
      UI.announce(stepLabel.task + ' step');
      if (!coarse && ed) { if (!ed.selectFirstBlank({ focus: true })) ed.focus(); return; }
      doPane.focus({ preventScroll: true });
    }
    /* Edit query: the learner asked to type, so the cursor goes in the editor and the keyboard comes up. */
    function editQuery() {
      setStep('task');
      if (isOrder) { const f = tileBox.querySelector('button:not([hidden])') || builtBox.querySelector('button'); if (f) f.focus({ preventScroll: true }); return; }
      if (ed && !ed.selectFirstBlank({ focus: true })) ed.focus();
    }

    function buildLearn() {
      const prog = State.levelProgress(level.n);
      const earned = (State.stamps() || []).some((s) => s.n === level.n);

      const where = el('div', { class: 'ms-where' },
        el('div', { class: 'ms-where-t' },
          el('a', { href: '#/journey', class: 'ms-lv' }, 'Level ' + level.n + ': ', el('b', { text: level.title })),
          el('span', { class: 'ms-rank' }, earned ? 'Rank earned: ' : 'Next rank: ', el('b', { text: level.rank }), el('span', { class: 'ms-prog', text: prog.done + ' of ' + prog.total }))),
        el('div', { class: 'ms-nav' }, navLink(K.prevLesson(lesson.id), 'prev'), navLink(next, 'next')));

      const head = el('header', { class: 'ms-head' },
        el('span', { class: 'ms-plate', html: UI.qd(lesson.id, 3) }),
        el('div', { class: 'ms-head-t' },
          lesson.checkpoint || isExam ? el('span', { class: 'ms-tag', text: isExam ? 'Final exam' : 'Checkpoint' }) : null,
          el('h1', { text: lesson.title })));

      const idea = el('div', { class: 'ms-idea' },
        el('div', { class: 'weave' }, el('i')),
        el('div', { class: 'ms-idea-b' },
          el('div', { class: 'ms-idea-l', text: isExam ? 'What this tests' : 'The one new idea' }),
          UI.rich(lesson.newIdea)),
        el('div', { class: 'weave rev' }, el('i')));

      const parts = [where, dotsNav(), head, idea, el('div', { class: 'ms-teach' }, UI.rich(wording(lesson.teach)))];

      if (lesson.ex && lesson.ex.length) parts.push(buildExample());

      if (lesson.bridge) {
        parts.push(el('aside', { class: 'ms-bridge' },
          el('span', { class: 'ms-fx', 'aria-hidden': 'true', text: 'fx' }),
          el('div', {}, el('h2', { text: 'In terms you already know' }), UI.rich(lesson.bridge))));
      }
      if (lesson.atWork) {
        parts.push(el('details', { class: 'ms-atwork' },
          el('summary', { html: '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3.5 1.5v9L9 6z"/></svg><span>On real databases at work</span>' }),
          UI.rich(lesson.atWork)));
      }

      const glHost = el('div', { class: 'gl', 'aria-hidden': 'true' });
      const pane = el('div', { class: 'ms-learn', id: 'ms-panel-learn' }, glHost, el('div', { class: 'ms-learn-in' }, parts));
      if (isWide()) {
        const g = UI.guilloche(glHost, 620, { k: 0.75 });
        onCleanup(() => g.destroy());
      }
      return pane;
    }

    function buildExample() {
      const key = keyLine(lesson);
      const lines = el('ol', { class: 'ms-ex-lines' }, lesson.ex.map((x, i) => el('li', { class: 'ms-ex-line' + (i === key ? ' is-key' : '') },
        el('code', { class: 'ms-ex-sql', html: UI.hl(x[0]) }),
        x[1] ? el('div', { class: 'ms-ex-en' }, el('span', { html: UI.icons.hook }), UI.rich(x[1], { inline: true })) : null)));
      const feed = el('div', { class: 'ms-ex-feed' });
      /* On a phone the result waits behind this toggle, so the reading stays short. */
      const feedCount = el('span', { class: 'ms-ex-tn' });
      const feedToggle = el('button', {
        type: 'button', class: 'ms-ex-t', 'aria-expanded': 'false', hidden: !!lesson.exNoResult,
        onClick: () => {
          const open = feedToggle.getAttribute('aria-expanded') !== 'true';
          feedToggle.setAttribute('aria-expanded', String(open));
          feed.classList.toggle('open', open);
        }
      }, el('span', { text: 'See its result' }), feedCount, el('span', { class: 'ms-ex-ti', html: UI.icons.down }));
      const box = el('section', { class: 'ms-ex' },
        el('h2', { class: 'ms-sub', text: 'An example, line by line' }),
        el('div', { class: 'mc ms-ex-mc' }, lines),
        feedToggle,
        feed,
        lesson.exNote ? el('div', { class: 'ms-ex-note' }, UI.rich(lesson.exNote)) : null);
      if (!lesson.exNoResult) {
        const sql = lesson.ex.map((x) => x[0]).join('\n');
        const paint = () => {
          feed.replaceChildren(el('p', { class: 'ms-wait', text: Engine.status === 'failed' ? 'The result appears here once the database loads.' : 'Warming up the database' }));
          Engine.run(sql, { db: 'fresh' }).then((r) => {
            if (S.disposed) return;
            const last = r.results[r.results.length - 1];
            if (!last) { feed.replaceChildren(); feedToggle.hidden = true; return; }
            feedCount.textContent = last.rows.length === 1 ? '1 row' : last.rows.length.toLocaleString('en-US') + ' rows';
            feed.replaceChildren(UI.ledger(last, { compact: true, copy: false, title: 'Its real result', label: 'Result of the example' }));
          }, (e) => {
            if (S.disposed) return;
            feed.replaceChildren(el('p', { class: 'ms-wait', text: e && e.type === 'engine' ? 'The result appears here once the database loads.' : 'This example could not run right now.' }));
          });
        };
        paint();
        S.repaintExample = paint;
      }
      return box;
    }

    /* ---------- Right: the upper area ---------- */
    const ticket = el('article', { class: 'ticket ms-ticket' });
    let stubBox = null;

    function closedMark() {
      return el('span', { class: 'tk-closed', text: 'TICKET ' + lesson.id + ' CLOSED' });
    }

    function buildTicket() {
      const who = requester(lesson.from);
      const main = el('div', { class: 'tk-main' });
      if (who) {
        main.append(el('div', { class: 'tk-top' },
          el('span', { class: 'tk-avatar', 'aria-hidden': 'true', text: who.initials }),
          el('span', {}, el('b', { text: who.name }), who.role ? ', ' + who.role : '')));
      }
      main.append(el('div', { class: 'tk-task' }, UI.rich(taskHtml)));
      const wanted = el('div', { class: 'tk-wanted', hidden: true });
      main.append(wanted);
      ticket.append(main);

      const hasTarget = !isExam && !lesson.noTarget && !!lesson.solution;
      if (hasTarget) {
        const open = isWide() && level.n <= 3;
        stubBox = el('div', { class: 'tk-stub' });
        const body = el('div', { class: 'ms-stub-b' }, el('p', { class: 'ms-wait', text: 'Warming up the database' }));
        const tgl = el('button', {
          type: 'button', class: 'ms-stub-t', 'aria-expanded': String(open),
          html: '<span>What the answer looks like</span>' + UI.icons.down,
          onClick: () => {
            const now = tgl.getAttribute('aria-expanded') !== 'true';
            tgl.setAttribute('aria-expanded', String(now));
            body.hidden = !now;
            ticket.classList.toggle('stub-open', now);
            if (now) paintStub();
          }
        });
        S.stubToggle = tgl;
        body.hidden = !open;
        ticket.classList.toggle('stub-open', open);
        stubBox.append(tgl, body);
        ticket.append(stubBox);
        ticket.classList.add('has-stub');
        const paintStub = () => {
          K.expected(lesson).then((t) => {
            if (S.disposed || !t) return;
            const shown = { columns: t.columns, rows: t.rows.slice(0, 3) };
            const led = UI.ledger(shown, { compact: true, foot: false, label: 'Preview of the target result' });
            const n = t.rows.length;
            body.replaceChildren(led, el('p', { class: 'tk-more', text: n > 3 ? 'First 3 rows of ' + n.toLocaleString('en-US') + ' in total' : (n === 1 ? 'The whole answer is 1 row' : 'The whole answer is ' + n + ' rows') }));
            wanted.replaceChildren(el('span', { text: 'Columns wanted' }), ...t.columns.map((c) => el('code', { text: c })));
            wanted.hidden = false;
          }, () => {
            if (S.disposed) return;
            body.replaceChildren(el('p', { class: 'ms-wait', text: 'The preview appears here once the database loads.' }));
          });
        };
        S.repaintStub = paintStub;
        paintStub();
      }
      if (!review && State.isDone(lesson.id)) ticket.append(closedMark());
      return ticket;
    }

    /* Tables you need */
    let tablesBody = null, tablesToggle = null;

    function columnButton(table, col, meaning, afterInsert) {
      const inner = [el('code', { text: col }), el('span', { text: meaning })];
      if (isOrder) return el('div', { class: 'col', dataset: { col, table } }, inner);
      return el('button', {
        type: 'button', class: 'col', dataset: { col, table },
        'aria-label': 'Put ' + col + ' in your query. ' + meaning,
        onClick: () => {
          if (!ed) return;
          /* With blanks waiting, a column goes in a blank, even if the caret has wandered off. */
          const ta = edHost.querySelector('textarea');
          const onBlank = ta && /^_{3,}$/.test(ta.value.slice(ta.selectionStart, ta.selectionEnd));
          if (!onBlank && !S.markedWord && ed.hasBlanks && ed.hasBlanks()) ed.selectFirstBlank({ focus: !coarse });
          const wide = isWide();
          ed.insert(col, wide || onBlank ? undefined : { list: true });
          if (afterInsert) afterInsert();
          /* On a phone, with no blank to go to, the learner goes back to typing right after the new word. */
          if (!wide && !ed.hasBlanks()) ed.focus();
        }
      }, inner);
    }

    function peekButton(table, host) {
      const box = el('div', { class: 'ms-peek', hidden: true });
      const btn = el('button', {
        type: 'button', class: 'ms-peekb', text: 'Peek at this table', 'aria-expanded': 'false',
        onClick: () => {
          const open = box.hidden;
          box.hidden = !open;
          btn.setAttribute('aria-expanded', String(open));
          btn.textContent = open ? 'Hide the peek' : 'Peek at this table';
          if (!open) return;
          box.replaceChildren(el('p', { class: 'ms-wait', text: 'Warming up the database' }));
          Promise.all([Engine.run('SELECT * FROM ' + table + ' LIMIT 5', { db: 'reference' }), tableSize(table)]).then(([r, size]) => {
            box.replaceChildren(UI.ledger(r.results[0], { compact: true, foot: false, label: 'First 5 rows of ' + table }),
              el('p', { class: 'tk-more', text: 'First 5 rows' + (size != null ? ' of ' + size.toLocaleString('en-US') : '') }));
          }, () => box.replaceChildren(el('p', { class: 'ms-wait', text: 'The database is not available right now, so the peek cannot load.' })));
        }
      });
      host.after(box);
      return btn;
    }

    function tableBlock(t, afterInsert) {
      const head = el('div', { class: 'tbl-n' }, el('code', { text: t.t }), el('span', { class: 'tbl-d', text: t.d }));
      const block = el('div', { class: 'tbl-c', dataset: { table: t.t } }, head);
      head.append(peekButton(t.t, head));
      block.append(el('div', { class: 'cols' }, t.c.map((c) => columnButton(t.t, c[0], c[1], afterInsert))));
      return block;
    }

    function openAllTables() {
      let m = null;
      const body = el('div', { class: 'ms-alltables' },
        KenariData.SCHEMA.map((t) => tableBlock(t, () => m && m.close())),
        el('h3', { text: 'How the tables connect' }),
        el('ul', { class: 'ms-links' }, KenariData.LINKS.map((x) => el('li', {}, el('code', { text: x })))));
      m = UI.modal({ title: 'All tables', body, wide: true });
    }

    function buildTables() {
      const used = isExam ? [] : tablesIn(lesson.solution);
      const wrap = el('section', { class: 'ms-tables', 'aria-label': 'Tables you need' });
      const startOpen = isWide() && used.length > 0;
      tablesBody = el('div', { class: 'ms-tables-b', hidden: !startOpen }, used.map((t) => tableBlock(t)));
      tablesToggle = el('button', {
        type: 'button', class: 'ms-tables-t', 'aria-expanded': String(startOpen),
        html: '<span>Tables you need</span>' + UI.icons.down,
        onClick: () => setTablesOpen(tablesToggle.getAttribute('aria-expanded') !== 'true')
      });
      const head = el('div', { class: 'ms-tables-h' });
      if (used.length) {
        head.append(tablesToggle);
        if (!isOrder) head.append(el('small', { text: coarse ? 'Tap a column to put it in your query.' : 'Click a column to put it in your query.' }));
      } else {
        head.append(el('h2', { class: 'ms-tables-t0', text: isExam ? 'Every table is open to you' : 'Tables' }));
      }
      head.append(el('button', { type: 'button', class: 'plain', text: 'All tables', onClick: openAllTables }));
      wrap.append(head, tablesBody);
      return wrap;
    }
    function setTablesOpen(open) {
      if (!tablesBody) return;
      tablesBody.hidden = !open;
      if (tablesToggle) tablesToggle.setAttribute('aria-expanded', String(open));
    }
    function clearLit() {
      root.querySelectorAll('.col.want,.col.hinted').forEach((c) => {
        c.classList.remove('want', 'hinted');
        const tag = c.querySelector('.use-this');
        if (tag) tag.remove();
      });
      S.litColumn = null;
      if (tablesChip) tablesChip.classList.remove('has-lit');
    }
    function findColumnEl(name) {
      return root.querySelector('.ms-tables .col[data-col="' + CSS.escape(name) + '"]');
    }
    function lightColumn(name) {
      if (!name) return;
      /* On a phone the column lights up when the Tables sheet opens, and the chip says there is something to see. */
      S.litColumn = name;
      if (tablesChip) tablesChip.classList.add('has-lit');
      let col = findColumnEl(name);
      if (!col && tablesBody) {
        const t = KenariData.SCHEMA.find((x) => x.c.some((c) => c[0] === name));
        if (t) { tablesBody.append(tableBlock(t)); col = findColumnEl(name); }
      }
      if (!col) return;
      setTablesOpen(true);
      col.classList.add('want');
      col.append(el('span', { class: 'use-this', text: 'Use this one' }));
      if (isWide()) {
        /* Only as far as it takes to bring the column clear of the slip, so the ticket stays when there is room. */
        requestAnimationFrame(() => {
          const ur = upper.getBoundingClientRect(), cr = col.getBoundingClientRect();
          const clearOf = S.slip ? ur.bottom - S.slip.offsetHeight - 9 : ur.bottom;
          const below = cr.bottom + 8 - clearOf;
          const above = ur.top + 8 - cr.top;
          if (below > 0) upper.scrollTop += below;
          else if (above > 0) upper.scrollTop -= above;
          S.scrolledForLit = below > 0 || above > 0;
        });
      }
    }

    /* ---------- Phone: the two chips and the Tables sheet ---------- */
    let tablesChip = null, targetChip = null;
    function buildChips() {
      const row = el('div', { class: 'ms-chips' });
      if (S.stubToggle) {
        targetChip = el('button', {
          type: 'button', class: 'ms-chip', 'aria-expanded': String(S.stubToggle.getAttribute('aria-expanded') === 'true'),
          onClick: () => {
            S.stubToggle.click();
            const open = S.stubToggle.getAttribute('aria-expanded') === 'true';
            targetChip.setAttribute('aria-expanded', String(open));
            upper.classList.toggle('target-open', open);
            clampRequest();
            if (open) requestAnimationFrame(() => { upper.scrollTop = stubBox.offsetTop; });
          }
        }, el('span', { text: 'Target' }), el('span', { class: 'ms-chip-i', html: UI.icons.down }));
        row.append(targetChip);
      }
      tablesChip = el('button', {
        type: 'button', class: 'ms-chip', 'aria-haspopup': 'dialog', onClick: openTablesSheet
      }, el('i', { class: 'ms-chip-dot', 'aria-hidden': 'true' }), el('span', { text: 'Tables' }), el('span', { class: 'ms-chip-i', html: UI.icons.up }));
      row.append(tablesChip);
      return row;
    }

    function openTablesSheet() {
      const used = isExam ? [] : tablesIn(lesson.solution);
      const lit = S.litColumn;
      let showAll = !used.length;
      let sheet = null;
      const body = el('div', { class: 'ms-tsheet' });
      const paint = () => {
        const list = showAll ? KenariData.SCHEMA.slice() : used.slice();
        /* The column to use lights up even if its table is not one of the mission's own. */
        if (lit && !list.some((t) => t.c.some((c) => c[0] === lit))) {
          const t = KenariData.SCHEMA.find((x) => x.c.some((c) => c[0] === lit));
          if (t) list.push(t);
        }
        body.replaceChildren();
        if (!isOrder) body.append(el('p', { class: 'ms-tsheet-l', text: 'Tap a column to put it in your query.' }));
        list.forEach((t) => body.append(tableBlock(t, () => sheet && sheet.close())));
        if (showAll) {
          body.append(el('h3', { text: 'How the tables connect' }),
            el('ul', { class: 'ms-links' }, KenariData.LINKS.map((x) => el('li', {}, el('code', { text: x })))));
        }
        if (used.length) {
          body.append(el('button', {
            type: 'button', class: 'plain ms-tsheet-all', text: showAll ? 'Show only the tables you need' : 'All tables',
            onClick: () => {
              showAll = !showAll;
              const title = sheet.el.querySelector('.dlg-h h2');
              if (title) title.textContent = showAll ? 'All tables' : 'Tables you need';
              paint();
              body.closest('.dlg-b').scrollTop = 0;
            }
          }));
        }
        hintsBox.querySelectorAll('.ms-hint code').forEach((c) => {
          const col = body.querySelector('.col[data-col="' + CSS.escape(c.textContent.trim()) + '"]');
          if (col) col.classList.add('hinted');
        });
        const want = lit && body.querySelector('.col[data-col="' + CSS.escape(lit) + '"]');
        if (want) {
          want.classList.add('want');
          want.append(el('span', { class: 'use-this', text: 'Use this one' }));
          requestAnimationFrame(() => want.scrollIntoView({ block: 'center' }));
        }
      };
      sheet = UI.sheet({ title: showAll ? 'All tables' : 'Tables you need', body });
      paint();
    }

    /* Quiz */
    let choiceCards = [];
    function buildQuiz() {
      const box = el('article', { class: 'ticket ms-q' });
      const main = el('div', { class: 'tk-main' });
      main.append(el('div', { class: 'tk-task' }, UI.rich(lesson.question)));
      if (lesson.code) {
        const codeBox = UI.code(lesson.code, { label: 'The query to read' });
        main.append(el('div', { class: 'ms-q-code' }, codeBox));
        if (lesson.showCodeResult) {
          const feed = el('div', { class: 'ms-ex-feed ms-q-feed' }, el('p', { class: 'ms-wait', text: 'Warming up the database' }));
          main.lastChild.append(feed);
          const paint = () => Engine.run(lesson.code, { db: 'fresh' }).then((r) => {
            if (S.disposed) return;
            const last = r.results[r.results.length - 1];
            feed.replaceChildren(last ? UI.ledger(last, { compact: true, copy: false, label: 'Result of that query' }) : '');
          }, () => { if (!S.disposed) feed.replaceChildren(el('p', { class: 'ms-wait', text: 'The result appears here once the database loads. You can still answer.' })); });
          paint();
          S.repaintQuizResult = paint;
        }
      }
      box.append(main);
      if (!review && State.isDone(lesson.id)) box.append(closedMark());

      const list = el('div', { class: 'ms-choices', role: 'group', 'aria-label': 'Choose one answer' });
      choiceCards = lesson.choices.map((c, i) => {
        const why = el('div', { class: 'ms-why', hidden: true }, UI.rich(c.why));
        const btn = el('button', {
          type: 'button', class: 'ms-choice-b',
          onClick: () => pickChoice(i)
        }, el('span', { class: 'ms-choice-l', 'aria-hidden': 'true', text: String.fromCharCode(65 + i) }), UI.rich(c.t, { inline: true }));
        const card = el('div', { class: 'ms-choice' }, btn, why);
        list.append(card);
        return { c, card, btn, why };
      });
      return el('div', { class: 'ms-quiz' }, box, list);
    }

    function pickChoice(i) {
      const pick = choiceCards[i];
      if (!pick || S.phase !== 'edit' || pick.card.classList.contains('is-wrong')) return;
      clearOutput();
      pick.why.hidden = false;
      if (!pick.c.correct) {
        pick.card.classList.add('is-wrong');
        pick.btn.setAttribute('aria-pressed', 'true');
        pick.btn.setAttribute('aria-disabled', 'true');
        S.outcome = 'fail';
        if (!review) State.recordAttempt(lesson.id, { state: 'fail' });
        setStatus('Not that one. Read why, then choose again', 'help');
        UI.announce('Not that one. ' + UI.plainOf(pick.c.why));
        if (!isWide()) pick.card.scrollIntoView({ block: 'nearest' });
        return;
      }
      pick.card.classList.add('is-right');
      pick.btn.setAttribute('aria-pressed', 'true');
      choiceCards.forEach((x) => { x.why.hidden = false; x.card.classList.toggle('is-other', x !== pick); });
      passQuiz(pick);
    }

    /* Order: tiles to tap */
    let tileBox = null, builtBox = null, tileEmpty = null;
    let tilePool = [];      /* {text, used, node} */
    let builtLines = [];    /* entries from tilePool, in order */

    function buildTiles() {
      const all = stableShuffle((lesson.lines || []).concat(lesson.distractors || []), lesson.id);
      tilePool = all.map((text, i) => ({ text, i, used: false, node: null }));
      tileBox = el('div', { class: 'ms-tiles', role: 'group', 'aria-label': 'Lines to choose from' });
      tilePool.forEach((t) => {
        t.node = el('button', {
          type: 'button', class: 'ms-tile', 'aria-label': 'Add this line to your query: ' + t.text,
          draggable: 'true',
          html: '<code>' + UI.hl(t.text) + '</code>',
          onClick: () => addTile(t)
        });
        t.node.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-kenari-tile', String(t.i)); e.dataTransfer.effectAllowed = 'move'; });
        tileBox.append(t.node);
      });
      tileEmpty = el('p', { class: 'ms-tiles-e', hidden: true, text: (coarse ? 'Every line is placed. Tap a line in your query to take it back.' : 'Every line is placed. Click a line in your query to take it back.') });
      tileBox.append(tileEmpty);
      /* A draft restores which lines were placed */
      if (startText) {
        for (const line of String(startText).split('\n')) {
          const t = tilePool.find((x) => !x.used && x.text === line);
          if (t) { t.used = true; builtLines.push(t); }
        }
      }
      return el('section', { class: 'ms-tilewrap' },
        el('h2', { class: 'ms-sub', text: (coarse ? 'Tap' : 'Click') + ' the lines in order' + (lesson.distractors && lesson.distractors.length ? '. Not every line belongs.' : '') }),
        tileBox);
    }
    function addTile(t) {
      if (S.phase !== 'edit' && S.phase !== 'passed') return;
      if (t.used) return;
      t.used = true;
      builtLines.push(t);
      afterTiles();
    }
    function removeBuilt(t) {
      if (S.phase !== 'edit' && S.phase !== 'passed') return;
      t.used = false;
      builtLines = builtLines.filter((x) => x !== t);
      afterTiles();
    }
    function afterTiles() {
      if (S.phase === 'passed') { S.phase = 'edit'; setRunMode(); }
      lastPass.delete(lesson.id);
      paintBuilt();
      clearOutput();
      if (!review) State.saveDraft(lesson.id, builtLines.map((x) => x.text).join('\n'));
      S.outcome = null;
      refreshStatus();
    }
    function paintBuilt() {
      tilePool.forEach((t) => { t.node.hidden = t.used; });
      if (tileEmpty) tileEmpty.hidden = tilePool.some((t) => !t.used);
      const total = (lesson.lines || []).length;
      const rows = builtLines.map((t, i) => {
        const b = el('button', {
          type: 'button', class: 'ms-line', draggable: 'true',
          'aria-label': 'Take line ' + (i + 1) + ' back out: ' + t.text,
          dataset: { i },
          onClick: () => removeBuilt(t)
        }, el('span', { class: 'ms-line-n', 'aria-hidden': 'true', text: i + 1 }), el('code', { html: UI.hl(t.text) }));
        b.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-kenari-line', String(i)); e.dataTransfer.effectAllowed = 'move'; });
        return el('li', {}, b);
      });
      for (let i = builtLines.length; i < total; i++) {
        rows.push(el('li', { class: 'ms-line-empty' }, el('span', { class: 'ms-line-n', 'aria-hidden': 'true', text: i + 1 }), el('span', { text: i === builtLines.length ? (coarse ? 'Tap a line above' : 'Click a line above') : '' })));
      }
      builtBox.replaceChildren(el('ol', { class: 'ms-built', 'aria-label': 'Your query' }, rows));
      if (!isWide()) edBox.scrollTop = edBox.scrollHeight;
    }
    function dropOnBuilt(e) {
      e.preventDefault();
      const fromTile = e.dataTransfer.getData('text/x-kenari-tile');
      const fromLine = e.dataTransfer.getData('text/x-kenari-line');
      const lis = [...builtBox.querySelectorAll('.ms-line')];
      let at = lis.findIndex((n) => { const r = n.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      if (at < 0) at = lis.length;
      if (fromTile !== '') {
        const t = tilePool.find((x) => String(x.i) === fromTile);
        if (t && !t.used) { t.used = true; builtLines.splice(at, 0, t); afterTiles(); }
      } else if (fromLine !== '') {
        const from = Number(fromLine);
        const [t] = builtLines.splice(from, 1);
        if (t) { builtLines.splice(from < at ? at - 1 : at, 0, t); afterTiles(); }
      }
    }

    /* ---------- Right: the console ---------- */
    let ed = null;
    const lamp = el('span', { class: 'mc-lamp', 'data-state': 'todo' });
    const statusEl = el('b', { class: 'ms-status', text: '' });
    const noteEl = el('span', { class: 'mc-note ms-note', text: 'Every Run starts from a clean copy of the data' });
    const hintsBox = el('div', { class: 'ms-hints', hidden: true });
    const edHost = el('div', { class: 'ms-edhost' });
    const edBox = el('div', { class: 'ms-edbox' }, edHost);
    const under = el('div', { class: 'ms-under', hidden: true });

    function setStatus(text, state) {
      statusEl.textContent = text;
      if (state) lamp.dataset.state = state; else lamp.removeAttribute('data-state');
    }

    const getSql = () => (isOrder ? builtLines.map((x) => x.text).join('\n') : isQuiz ? '' : (ed ? ed.value : ''));

    function refreshStatus() {
      if (isQuiz) {
        if (S.phase === 'passed') { setStatus('Matches the request'); return; }
        if (S.outcome !== 'fail') setStatus('Choose the answer that fits', 'todo');
        return;
      }
      if (S.phase === 'running' || S.phase === 'printing' || S.phase === 'stamping') return;
      const passedNow = S.phase === 'passed' && !S.editedAfterPass;
      if (passedNow) { setStatus('Matches the request'); return; }
      if (Engine.status === 'failed' && !S.outcome) { setStatus('The database did not load', 'help'); return; }
      if (S.outcome === 'error') { setStatus(isOrder ? 'Check the order of the lines' : S.markedWord ? 'One word to fix' : 'One thing to fix', 'help'); return; }
      if (S.outcome === 'fail') { setStatus('Not yet. Change it, then run it again', 'help'); return; }
      if (S.outcome === 'near') { setStatus('Nearly there. One thing to change', 'help'); return; }
      if (S.outcome === 'timeout') { setStatus('Stopped after 8 seconds', 'help'); return; }
      const sql = getSql();
      if (isOrder) {
        const left = (lesson.lines || []).length - builtLines.length;
        if (left > 1) setStatus(left + ' lines to place', 'todo');
        else if (left === 1) setStatus('One line left to place', 'todo');
        else setStatus('Ready to run');
        return;
      }
      const n = countBlanks(sql);
      if (n > 1) setStatus(n + ' blanks to fill', 'todo');
      else if (n === 1) setStatus('One blank left', 'todo');
      else if (KenariCheck.isEmptySql(sql)) setStatus('Write your query, then press Run', 'todo');
      else setStatus('Ready to run');
    }

    function paintNote() {
      noteEl.replaceChildren();
      if (Engine.status === 'loading') noteEl.textContent = 'Warming up the database';
      else if (Engine.status === 'failed') {
        noteEl.append(el('button', { type: 'button', class: 'plain', text: 'Try loading it again', onClick: () => retryEngine() }));
      } else noteEl.textContent = 'Every Run starts from a clean copy of the data';
    }
    function retryEngine() {
      const p = Engine.retry();
      paintNote();
      return Promise.resolve(p).catch(() => {});
    }

    /* Keys */
    const tryBtn = el('button', { type: 'button', class: 'key canary big ms-try', onClick: goToWork, text: isQuiz ? 'See the question' : isExam ? 'See the task' : 'Try it' });
    const editBtn = el('button', { type: 'button', class: 'key canary big ms-edit', onClick: editQuery, text: 'Edit query' });
    const pipsEl = el('span', { class: 'pips', 'aria-hidden': 'true' }, hints.map(() => el('i')));
    const hintBtn = el('button', { type: 'button', class: 'key ms-hintb', onClick: onHint }, 'Hint', pipsEl);
    const overBtn = el('button', { type: 'button', class: 'ghost ms-over', text: 'Start over', onClick: () => startOver() });
    const againBtn = el('button', { type: 'button', class: 'ghost ms-again', text: 'Run again', hidden: true, onClick: () => doRun() });
    const modelBtn = el('button', { type: 'button', class: 'ghost ms-model', text: 'See the model answer', hidden: !(isExam && !review && State.isDone(lesson.id)), onClick: openModel });
    /* Below 1000px a cleared mission keeps a quiet way forward. A laptop has its arrows for this. */
    const quietNext = review ? null : el('a', {
      class: 'ghost ms-qnext', href: next ? '#/m/' + next.id : '#/passbook', text: 'Next',
      'aria-label': next ? 'Next mission: ' + next.id + ' ' + next.title : 'Open your passbook'
    });
    const enterHint = el('span', { class: 'ms-enter', hidden: true, text: 'Enter to continue' });
    const runLabel = el('span', { class: 'ms-run-l', text: 'Run' });
    const runKbd = el('span', { class: 'kbd', text: UI.runKeys() });
    const runBtn = el('button', { type: 'button', class: 'key canary big ms-run', onClick: onMainKey, 'aria-label': 'Run the query' }, runLabel, runKbd);
    const keys = el('div', { class: 'mc-act ms-keys' }, tryBtn, editBtn, hintBtn, overBtn, againBtn, modelBtn, quietNext, el('span', { class: 'sp' }), enterHint, runBtn);

    function paintHintBtn() {
      const left = hints.length - S.shownHints;
      [...pipsEl.children].forEach((p, i) => p.classList.toggle('on', i < left));
      hintBtn.setAttribute('aria-label', !hints.length ? 'Hint: show the answer' : left > 0 ? 'Hint. ' + left + ' of ' + hints.length + ' left' : 'Hints. All ' + hints.length + ' shown');
      hintBtn.hidden = !showHints || (review && S.failed < 2) || S.phase === 'passed';
    }
    function hintNode(i) {
      return el('div', { class: 'ms-hint' }, el('span', { class: 'n', text: i + 1 }), UI.rich(hints[i]));
    }
    function paintHints() {
      hintsBox.replaceChildren();
      const head = el('div', { class: 'ms-hints-h' },
        el('b', { text: 'Hints' }),
        el('button', { type: 'button', class: 'plain', text: 'Hide hints', onClick: () => { hintsBox.hidden = true; fitAll(); } }));
      hintsBox.append(head);
      /* Once the answer is open the hints have done their job, and the answer gets the room. */
      if (!S.answerOpen) for (let i = 0; i < S.shownHints; i++) hintsBox.append(hintNode(i));
      if (S.shownHints >= hints.length && lesson.solution) {
        const box = el('div', { class: 'ms-answer' });
        if (S.answerOpen) {
          box.append(UI.code(lesson.solution, { label: 'The answer' }),
            el('button', { type: 'button', class: 'ghost', text: isOrder ? 'Put these lines in your query' : 'Put it in the editor', onClick: putAnswer }));
        } else {
          box.append(el('button', { type: 'button', class: 'plain', text: 'Show the answer', onClick: showAnswer }));
        }
        hintsBox.append(box);
      }
      lightHinted();
    }
    function lightHinted() {
      root.querySelectorAll('.col.hinted').forEach((c) => c.classList.remove('hinted'));
      hintsBox.querySelectorAll('.ms-hint code').forEach((c) => {
        const col = findColumnEl(c.textContent.trim());
        if (col) col.classList.add('hinted');
      });
    }
    function onHint() {
      /* On a wrong result the Hint key takes the learner back to the editor, where hints open. */
      if (S.step === 'result' && !isWide()) setStep('task');
      setReqOpen(false);
      if (hintsBox.hidden && S.shownHints > 0) {
        hintsBox.hidden = false;
        paintHints();
        fitAll();
        return;
      }
      if (S.shownHints < hints.length) {
        S.shownHints++;
        if (!review) State.useHint(lesson.id);
        hintsBox.hidden = false;
        paintHints();
        paintHintBtn();
        fitAll();
        const last = hintsBox.querySelectorAll('.ms-hint');
        if (last.length) {
          hintsBox.scrollTop = hintsBox.scrollHeight;
          UI.announce('Hint ' + S.shownHints + '. ' + UI.plainOf(hints[S.shownHints - 1]));
        }
        return;
      }
      hintsBox.hidden = !hintsBox.hidden;
      if (!hintsBox.hidden) paintHints();
      fitAll();
    }
    function showAnswer() {
      S.answerOpen = true;
      S.answerSeen = true;
      if (!review) State.markAnswerSeen(lesson.id);
      paintHints();
      fitAll();
      hintsBox.scrollTop = hintsBox.scrollHeight;
    }
    function putAnswer() {
      if (isOrder) {
        tilePool.forEach((t) => { t.used = false; });
        builtLines = [];
        (lesson.lines || []).forEach((line) => {
          const t = tilePool.find((x) => !x.used && x.text === line);
          if (t) { t.used = true; builtLines.push(t); }
        });
        afterTiles();
      } else if (ed) {
        ed.clearError();
        ed.replaceAll(lesson.solution);
        if (!review) State.saveDraft(lesson.id, lesson.solution);
        clearOutput();
        S.outcome = null;
        refreshStatus();
      }
      hintsBox.hidden = true;
      fitAll();
      runBtn.focus({ preventScroll: true });
    }

    function startOver() {
      const before = isOrder ? builtLines.slice() : getSql();
      setReqOpen(false);
      lastPass.delete(lesson.id);
      clearOutput();
      closeUnder();
      setRunMode();
      S.phase = 'edit';
      S.outcome = null;
      S.editedAfterPass = false;
      if (isOrder) {
        tilePool.forEach((t) => { t.used = false; });
        builtLines = [];
        paintBuilt();
        if (!review) State.saveDraft(lesson.id, null);
      } else if (ed) {
        ed.readOnly = false;
        ed.clearError();
        ed.replaceAll(starter);
        if (!review) State.saveDraft(lesson.id, null);
        ed.refresh();
      }
      refreshStatus();
      fitAll();
      const undo = el('button', {
        type: 'button', class: 'tlink', text: 'Undo',
        onClick: () => {
          if (isOrder) {
            tilePool.forEach((t) => { t.used = false; });
            builtLines = before;
            before.forEach((t) => { t.used = true; });
            afterTiles();
          } else if (ed) {
            ed.replaceAll(before);
            if (!review) State.saveDraft(lesson.id, before);
            refreshStatus();
            ed.focus();
          }
          const t = document.querySelector('.toast');
          if (t) t.remove();
        }
      });
      UI.toast(el('span', { class: 'ms-toast' }, el('span', { text: isOrder ? 'Your lines went back to the tiles.' : starter ? 'Back to the starter query.' : 'The editor is empty again.' }), undo));
      if (!isOrder && ed) { if (!coarse) { if (!ed.selectFirstBlank()) ed.focus(); } }
    }

    function openModel() {
      UI.modal({ title: 'A model answer', body: el('div', { class: 'ms-model-b' }, UI.rich('<p>This is one good way to write it. Yours can look different and still be right.</p>'), UI.code(lesson.solution, { copy: true, label: 'Model answer' })), wide: true });
    }

    /* ---------- Paper: what came back ---------- */
    const tray = el('div', { class: 'ms-tray', hidden: true });

    function pinLine() {
      const who = requester(lesson.from);
      const source = String(taskHtml || lesson.question || '');
      const hasBlocks = /<(table|ul|ol)\b/i.test(source);
      const text = el('span', { class: 'ms-pin-text' }, who ? el('b', { text: who.name + ': ' }) : null, UI.rich(oneLine(source), { inline: true }));
      const full = hasBlocks ? el('div', { class: 'ms-pin-full', hidden: true }, UI.rich(source)) : null;
      const more = el('button', {
        type: 'button', class: 'tlink ms-pin-more', text: 'Read all', hidden: true,
        onClick: () => {
          const open = !pin.classList.contains('open');
          pin.classList.toggle('open', open);
          if (full) { full.hidden = !open; text.hidden = open; }
          more.textContent = open ? 'Read less' : 'Read all';
          fitAll();
        }
      });
      const lower = el('button', {
        type: 'button', class: 'tlink ms-pin-low',
        onClick: () => setLowered(!S.lowered)
      }, lowerLabel(false));
      const pin = el('div', { class: 'ms-pin' }, text, full, more, lower);
      /* On a phone the whole line is the target: tap it to read the full request. */
      pin.addEventListener('click', (e) => {
        if (isWide() || more.hidden || e.target.closest('a,button,[data-term],.term')) return;
        more.click();
      });
      pin.checkOverflow = () => { more.hidden = !hasBlocks && !(text.scrollWidth > text.clientWidth + 1) && !pin.classList.contains('open'); };
      pin.lowerBtn = lower;
      return pin;
    }
    function lowerLabel(lowered) {
      return lowered ? 'Back to the printout' : (isQuiz ? 'See the question' : 'See the ticket');
    }
    function setLowered(v) {
      S.lowered = v;
      const sheet = S.sheet || S.slip;
      if (sheet) {
        const pinH = sheet.pin ? sheet.pin.offsetHeight : 36;
        tray.style.setProperty('--low', (sheet.offsetHeight - pinH + (S.slip ? 9 : 0)) + 'px');
      }
      if (v && S.scrolledForLit) { upper.scrollTop = 0; S.scrolledForLit = false; }
      tray.classList.toggle('lowered', v);
      tray.querySelectorAll('.ms-pin-low').forEach((b) => { b.textContent = lowerLabel(v); });
      fitAll();
    }

    function clearOutput() {
      S.seq++;
      UI.announce('');
      S.ledgers = [];
      S.sheet = null;
      S.slip = null;
      S.markedWord = null;
      tray.replaceChildren();
      tray.hidden = true;
      tray.classList.remove('lowered', 'has-slip');
      S.lowered = false;
      root.classList.remove('paper-up');
      if (root.classList.contains('is-passing')) { root.classList.remove('is-passing'); runLabel.textContent = 'Run'; }
      /* The printout is gone, so its step is too. */
      if (S.step === 'result') setStep('task'); else paintSegs();
      clearLeader();
      clearLit();
      if (S.scrolledForLit) { upper.scrollTop = 0; S.scrolledForLit = false; }
      lightHinted();
      closeUnder();
      if (ed && !isOrder) ed.clearError();
      fitAll();
    }
    function closeUnder() {
      under.hidden = true;
      under.replaceChildren();
    }
    function showUnder(text) {
      under.replaceChildren(el('i', { class: 'ms-under-mark', 'aria-hidden': 'true' }), el('span', { text }));
      under.hidden = false;
      fitAll();
    }

    function rise(node) {
      if (!isWide()) return;
      UI.anim(node, [{ transform: 'translateY(calc(100% + 16px))' }, { transform: 'translateY(0)' }], { duration: 260, easing: 'steps(9,end)' });
    }

    function claudeBtn(outcome, sql) {
      return el('button', {
        type: 'button', class: 'tlink ms-claude', text: 'Copy for AI',
        onClick: () => UI.copyForClaude({ kind: review ? 'review' : 'mission', lesson, sql, outcome })
      });
    }

    function bandText(titleText, bodyHtml, extras) {
      const box = el('div', { class: 'ms-band-t' });
      box.append(el('h3', { class: 'vband-title', text: titleText }));
      if (bodyHtml) box.append(el('div', { class: 'vband-body' }, UI.rich(bodyHtml)));
      (extras || []).forEach((n) => n && box.append(n));
      return box;
    }

    function tipsList(tips) {
      if (!tips || !tips.length) return null;
      return el('ul', { class: 'vband-tips' }, tips.map((t) => el('li', {}, UI.rich(t, { inline: true }))));
    }

    function changeNode(r) {
      if (!r.changeNote) return null;
      return el('div', { class: 'ms-change' }, el('span', { html: UI.icons.shield }), UI.rich(r.changeNote, { inline: true }));
    }

    /* On a phone both copy links fold into a small Copy menu, so the foot keeps one row. */
    function copyMenu(led) {
      const links = [...led.foot.querySelectorAll('.tlink')];
      if (!links.length) return;
      const menu = el('div', { class: 'ms-copy-m', role: 'menu', hidden: true }, links.map((a) => el('button', {
        type: 'button', class: 'ms-copy-i', role: 'menuitem', text: a.textContent,
        onClick: () => { setOpen(false); a.click(); }
      })));
      const btn = el('button', { type: 'button', class: 'tlink ms-copy', 'aria-haspopup': 'menu', 'aria-expanded': 'false', text: 'Copy', onClick: () => setOpen(menu.hidden) });
      const wrap = el('span', { class: 'ms-copy-w' }, btn, menu);
      const away = (e) => { if (!wrap.contains(e.target)) setOpen(false); };
      const esc = (e) => { if (e.key === 'Escape') { setOpen(false); btn.focus(); } };
      function setOpen(open) {
        menu.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
        document[open ? 'addEventListener' : 'removeEventListener']('pointerdown', away, true);
        document[open ? 'addEventListener' : 'removeEventListener']('keydown', esc, true);
      }
      wrap.closeMenu = () => setOpen(false);
      led.foot.append(wrap);
    }
    function closeCopyMenus() {
      tray.querySelectorAll('.ms-copy-w').forEach((w) => w.closeMenu());
    }

    /* The sheet: pinned request, verdict band, rows in their own box, foot. */
    function buildSheet(state, bandNode, slot, results, ledgerOpts, footActions) {
      const sheet = el('div', { class: 'paper ms-sheet', 'data-state': state, tabindex: '-1', role: 'group', 'aria-label': 'Printout' });
      const pin = pinLine();
      const band = el('div', { class: 'vband', 'data-state': state }, bandNode, slot);
      sheet.append(pin, band);
      S.ledgers = [];
      const list = (results || []).filter((x) => x && x.columns && x.columns.length);
      if (list.length) {
        const box = el('div', { class: 'ms-results' + (list.length > 1 ? ' many' : '') });
        list.forEach((res, i) => {
          const isLast = i === list.length - 1;
          const led = UI.ledger(res, Object.assign({
            animate: !S.restoring,
            title: list.length > 1 ? 'Result ' + (i + 1) + ' of ' + list.length : undefined,
            label: list.length > 1 ? 'Result ' + (i + 1) + ' of ' + list.length : 'Your result',
            actions: isLast ? footActions : []
          }, isLast ? ledgerOpts : {}));
          S.ledgers.push(led);
          copyMenu(led);
          box.append(led);
        });
        sheet.append(box);
        /* On a phone a long verdict scrolls before the rows give up their height, but a short result needs no more than its own rows. */
        const rows = list[list.length - 1].rows.length;
        sheet.style.setProperty('--res-min', (list.length > 1 ? 260 : 90 + Math.min(rows, 5) * 30) + 'px');
      } else {
        sheet.append(el('div', { class: 'lg-foot ms-foot0' }, el('span', { class: 'sp' }), footActions));
      }
      sheet.pin = pin;
      sheet.band = band;
      if (!isWide()) bandMore(sheet);
      return sheet;
    }

    /* Below 1000px a verdict too long for its band says so: a fade over the last line and a More control. More gives it the rows' height. */
    function bandMore(sheet) {
      const band = sheet.band;
      const label = el('span', { text: 'More' });
      const icon = el('span', { class: 'ms-band-i', html: UI.icons.down });
      const btn = el('button', {
        type: 'button', class: 'tlink ms-band-more', hidden: true, 'aria-expanded': 'false',
        onClick: () => {
          const open = !sheet.classList.contains('band-open');
          sheet.classList.toggle('band-open', open);
          btn.setAttribute('aria-expanded', String(open));
          label.textContent = open ? 'Less' : 'More';
          band.querySelector('.ms-band-t').scrollTop = 0;
          check();
        }
      }, label, icon);
      band.append(btn);
      const check = () => {
        const t = band.querySelector('.ms-band-t');
        if (!t) return;
        const open = sheet.classList.contains('band-open');
        const left = t.scrollHeight - t.clientHeight - t.scrollTop;
        const over = t.scrollHeight - t.clientHeight > 2;
        btn.hidden = !open && !(over && left > 2);
        band.classList.toggle('has-more', !open && over && left > 2);
      };
      band.querySelector('.ms-band-t').addEventListener('scroll', check, { passive: true });
      /* The win text slides in as the stamp lands, and while it moves it reads as taller than it is. */
      band.addEventListener('animationend', check);
      sheet.checkBand = check;
    }

    function putSheet(sheet) {
      tray.replaceChildren(sheet);
      tray.hidden = false;
      S.sheet = sheet;
      root.classList.add('paper-up');
      if (!isQuiz) setStep('result'); else paintSegs();
      /* On a phone the slot floats inside the text, so the win text wraps around the stamp and then uses the full width. */
      if (!isWide() && sheet.dataset.state === 'pass') sheet.band.querySelector('.ms-band-t').prepend(sheet.band.querySelector('.validation'));
      fitAll();
      rise(sheet);
      requestAnimationFrame(() => { if (sheet.pin) sheet.pin.checkOverflow(); });
    }

    /* The slot says NOT YET only on a real wrong answer. On the way to a pass it waits with its label alone, then takes the stamp. */
    function validationSlot(forPass) {
      return el('div', { class: 'validation' }, el('small', { text: 'Teller validation' }), forPass ? null : el('span', { class: 'not-yet', text: 'NOT YET' }));
    }

    /* ---------- Wrong answer ---------- */
    function showWrong(r, sql, keptOf) {
      const v = r.verdict;
      S.outcome = v.state === 'near' ? 'near' : 'fail';
      S.failed++;
      const extras = [changeNode(r), tipsList(v.tips), r.plan && v.code !== 'state-check' ? el('p', { class: 'vband-line', text: r.plan }) : null];
      const band = bandText(v.title, v.body, extras);
      const canCompare = v.state !== 'near' && !isExam && !lesson.noTarget && lesson.mode !== 'state' && r.expected && r.results.length > 0;
      const results = r.results;
      const actions = [claudeBtn(r, sql)];
      const sheet = buildSheet(v.state, band, validationSlot(), results, { kept: keptOf ? { of: keptOf } : undefined }, actions);
      if (canCompare && S.ledgers.length) {
        const led = S.ledgers[S.ledgers.length - 1];
        const mine = results[results.length - 1];
        const seg = el('div', { class: 'seg ms-cmp', role: 'group', 'aria-label': 'Which table to show' });
        const mk = (label, res, more) => el('button', {
          type: 'button', text: label, 'aria-pressed': String(res === mine),
          onClick: (e) => {
            led.setResult(res, more);
            seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
            sheet.dataset.showing = res === mine ? 'mine' : 'target';
            UI.announce(label + ': ' + res.rows.length + ' rows');
          }
        });
        seg.append(mk('Your result', mine, { kept: keptOf ? { of: keptOf } : undefined }), mk('The target', r.expected, { kept: undefined }));
        led.foot.insertBefore(seg, led.foot.children[1]);
      }
      putSheet(sheet);
      UI.announce(UI.plainOf(v.title + '. ' + (v.body || '') + ' ' + (r.changeNote || '')));
      refreshStatus();
      paintHintBtn();
      /* Keep focus sensible: a keyboard Run stays in the editor, a clicked Run stays on Run. */
    }

    /* ---------- Errors: the help slip ---------- */
    function showSlip(r, sql) {
      const err = r.error;
      S.outcome = 'error';
      S.failed++;
      S.markedWord = err.token || null;
      const body = el('div', { class: 'ms-slip-b' });
      body.append(el('h3', { text: err.title }));
      const rightLines = isOrder && builtLines.length === (lesson.lines || []).length && builtLines.every((t) => (lesson.lines || []).includes(t.text));
      if (rightLines) body.append(UI.rich('<p>These are the right lines, in an order the database cannot read. SQL needs its parts in a fixed order. ' + (coarse ? 'Tap' : 'Click') + ' a line to take it back, then place it again.</p>'));
      else if (err.plain) body.append(UI.rich(err.plain));
      if (err.tips && err.tips.length) body.append(el('ul', { class: 'ms-sliptips' }, err.tips.map((t) => el('li', {}, UI.rich(t, { inline: true })))));
      const act = el('div', { class: 'help-act' });
      if (err.fix && !isOrder) {
        act.append(el('button', {
          type: 'button', class: 'fixbtn',
          html: 'Change <code>' + UI.esc(err.fix.from) + '</code> to <code>' + UI.esc(err.fix.to) + '</code>',
          onClick: () => applyFix(err.fix)
        }));
      }
      act.append(claudeBtn(r, sql));
      body.append(act);
      if (r.changeNote) body.append(el('div', { class: 'help-sub' }, UI.rich(r.changeNote)));
      if (err.note) body.append(el('div', { class: 'help-sub' }, UI.rich(err.note)));
      if (err.raw) body.append(el('p', { class: 'help-raw', text: 'The database said: ' + err.raw }));

      const slip = el('div', { class: 'helpslip ms-slip', role: 'group', 'aria-label': 'Help with the error' });
      const pin = pinLine();
      slip.append(pin, body);
      slip.pin = pin;
      tray.replaceChildren(slip);
      tray.hidden = false;
      tray.classList.add('has-slip');
      S.slip = slip;
      root.classList.add('paper-up');
      if (!isOrder && ed) ed.markError(err.token);
      fitAll();
      rise(slip);
      requestAnimationFrame(() => {
        pin.checkOverflow();
        pointAtWord(err.token);
      });
      if (err.useColumn) lightColumn(err.useColumn);
      UI.announce(UI.plainOf(err.title + '. ' + err.plain));
      refreshStatus();
      paintHintBtn();
    }

    /* Where the word sits, in viewport pixels. */
    function wordRect(token) {
      if (isOrder) {
        const lines = [...builtBox.querySelectorAll('.ms-line code')];
        const line = lines.find((n) => findWord(n.textContent, token));
        return line ? line.getBoundingClientRect() : null;
      }
      return ed && ed.markedRect ? ed.markedRect() : null;
    }

    const leader = el('i', { class: 'ms-leader', 'aria-hidden': 'true', hidden: true });
    function clearLeader() { leader.hidden = true; }
    function pointAtWord(token) {
      if (!S.slip) return;
      const r = token ? wordRect(token) : null;
      /* On a phone the status line sits between slip and editor, and the marked word is amber, so no pointer is needed. */
      if (!r || !isWide()) {
        S.slip.classList.add('no-ptr');
        clearLeader();
        return;
      }
      const sr = S.slip.getBoundingClientRect();
      const trayRect = tray.getBoundingClientRect();
      const slipBottom = trayRect.bottom - 9;
      const x = Math.max(sr.left + 14, Math.min(r.left + r.width / 2, sr.right - 14));
      S.slip.style.setProperty('--ax', (x - sr.left) + 'px');
      const dr = dock.getBoundingClientRect();
      const pr = doPane.getBoundingClientRect();
      const top = slipBottom + 6;
      leader.style.left = (x - pr.left) + 'px';
      leader.style.top = (top - pr.top) + 'px';
      leader.style.height = Math.max(0, r.top - top) + 'px';
      /* The line skips the status row and any open hints, so it never strikes through their words. */
      const statusTop = mc.querySelector('.ms-bar').getBoundingClientRect().top;
      leader.style.setProperty('--gap-a', Math.max(0, statusTop - top) + 'px');
      leader.style.setProperty('--gap-b', Math.max(0, edBox.getBoundingClientRect().top - top) + 'px');
      leader.hidden = !(r.top > dr.top && r.top < dr.bottom);
    }

    function applyFix(fix) {
      const text = replaceWord(ed.value, fix.from, fix.to);
      ed.clearError();
      ed.replaceAll(text);
      if (!review) State.saveDraft(lesson.id, text);
      clearOutput();
      S.outcome = null;
      refreshStatus();
      fitAll();
      runBtn.focus({ preventScroll: true });
      UI.announce('Changed ' + fix.from + ' to ' + fix.to + '. Press Run.');
    }

    /* Timeout and engine trouble use the same slip, with no word to point at. */
    function showNote(title, message, tips, extra) {
      const body = el('div', { class: 'ms-slip-b' }, el('h3', { text: title }), UI.rich(message));
      if (tips && tips.length) body.append(el('ul', { class: 'ms-sliptips' }, tips.map((t) => el('li', {}, UI.rich(t, { inline: true })))));
      if (extra) body.append(el('div', { class: 'help-act' }, extra));
      const slip = el('div', { class: 'helpslip ms-slip no-ptr', role: 'group', 'aria-label': title });
      const pin = pinLine();
      slip.append(pin, body);
      slip.pin = pin;
      tray.replaceChildren(slip);
      tray.hidden = false;
      tray.classList.add('has-slip');
      S.slip = slip;
      root.classList.add('paper-up');
      fitAll();
      rise(slip);
      requestAnimationFrame(() => pin.checkOverflow());
      UI.announce(UI.plainOf(title + '. ' + message));
    }

    /* ---------- Run ---------- */
    function setRunMode() {
      runBtn.classList.remove('is-next');
      runLabel.textContent = 'Run';
      runKbd.hidden = false;
      enterHint.hidden = true;
      againBtn.hidden = true;
      modelBtn.hidden = !(isExam && !review && State.isDone(lesson.id));
      overBtn.hidden = isQuiz;
      runBtn.setAttribute('aria-label', 'Run the query');
      runBtn.removeAttribute('title');
      root.classList.remove('is-passed');
      paintHintBtn();
    }

    function nextLabelText() {
      if (review) return o.nextLabel || 'Next';
      if (S.levelCleared) return 'Next: see your new rank';
      if (next) return 'Next: ' + next.id + ' ' + next.title;
      return 'Open your passbook';
    }

    function flipToNext() {
      S.nextAt = performance.now();
      runBtn.classList.add('is-next');
      runLabel.textContent = nextLabelText();
      runKbd.hidden = true;
      enterHint.hidden = coarse;
      hintBtn.hidden = true;
      overBtn.hidden = isQuiz || isOrder ? true : false;
      againBtn.hidden = isQuiz;
      modelBtn.hidden = true;
      runBtn.setAttribute('aria-label', nextLabelText());
      runBtn.title = nextLabelText();
      hintsBox.hidden = true;
      root.classList.add('is-passed');
      root.classList.remove('is-passing');
      fitAll();
      UI.anim(runBtn, [{ transform: 'perspective(400px) rotateX(-70deg)', opacity: 0.2 }, { transform: 'perspective(400px) rotateX(0)', opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.2,.7,.3,1)' });
      runBtn.focus({ preventScroll: true });
    }

    function onMainKey(e) {
      if (!runBtn.classList.contains('is-next')) { doRun(); return; }
      /* A keyboard press in the first moments is the same stray Enter that just ran the query. A click is on purpose. */
      const byKeyboard = !e || e.detail === 0;
      if (byKeyboard && performance.now() - S.nextAt < 350) return;
      goNext();
    }

    function goNext() {
      if (review) {
        if (o.onDone) o.onDone({ ok: !S.answerSeen, answerSeen: S.answerSeen, attempts: S.attempts, lesson });
        if (o.onNext) o.onNext();
        return;
      }
      if (S.levelCleared && K.Home && K.Home.rankUp) {
        const after = (res) => { if (!S.disposed) K.navigate((res && res.hash) || (next ? '#/m/' + next.id : '#/passbook')); };
        const shown = K.Home.rankUp(S.levelCleared);
        if (shown && shown.then) shown.then(after, () => after());
        else after();
        return;
      }
      K.navigate(next ? '#/m/' + next.id : '#/passbook');
    }

    async function doRun() {
      if (S.disposed || isQuiz) return;
      if (S.phase === 'running' || S.phase === 'printing' || S.phase === 'stamping') {
        finishPrint();
        return;
      }
      const sql = getSql();
      const wasPassed = S.phase === 'passed';
      if (coarse && ed && edHost.contains(document.activeElement)) ed.blur();
      root.classList.remove('ed-focus', 'kb-up');
      setReqOpen(false);
      /* On a phone a half-built order does not run: the database's complaint would be about lines that are still missing. */
      if (isOrder && !isWide() && builtLines.length && builtLines.length < (lesson.lines || []).length) {
        const left = (lesson.lines || []).length - builtLines.length;
        clearOutput();
        if (wasPassed) setRunMode();
        S.phase = 'edit';
        S.outcome = null;
        refreshStatus();
        showUnder(left === 1 ? 'Place the last line, then press Run.' : 'Place the other ' + left + ' lines, then press Run.');
        return;
      }
      lastPass.delete(lesson.id);
      clearOutput();
      if (wasPassed) setRunMode();
      S.editedAfterPass = false;
      S.outcome = null;
      S.phase = 'running';
      const seq = S.seq;
      if (ed) ed.clearError();

      if (isOrder && !builtLines.length) {
        S.phase = 'edit';
        showUnder((coarse ? 'Tap' : 'Click') + ' a line to start building the query.');
        refreshStatus();
        return;
      }

      lamp.dataset.state = 'busy';
      setStatus(Engine.status === 'loading' ? 'Warming up the database' : 'Running');
      if (Engine.status === 'failed') retryEngine();
      const keptName = keptTable(sql);
      let r, keptOf = null;
      try {
        [r, keptOf] = await Promise.all([K.evaluate(lesson, sql), keptName ? tableSize(keptName) : null]);
      } catch (e) {
        r = { kind: 'engine', message: (e && e.message) || 'The database engine stopped unexpectedly. Press Run again.' };
      }
      if (S.disposed || seq !== S.seq) return;
      S.phase = 'edit';

      if (r.kind === 'blanks') {
        const n = countBlanks(sql);
        showUnder(n > 1 ? 'The yellow boxes are waiting for you. Your cursor is in the first one.' : 'The yellow box is waiting for you. Your cursor is in it.');
        if (ed) ed.selectFirstBlank();
        refreshStatus();
        UI.announce(under.textContent);
        return;
      }
      if (r.kind === 'empty') {
        showUnder('The editor is empty. Write a query, then press Run.');
        if (ed) ed.focus();
        refreshStatus();
        return;
      }
      S.attempts++;
      State.bumpQueries();
      if (r.kind === 'engine') {
        S.outcome = 'timeout';
        showNote('The database is not answering', r.message, null, el('button', { type: 'button', class: 'fixbtn', text: 'Try again', onClick: () => { retryEngine(); doRun(); } }));
        setStatus('The database is not answering', 'help');
        return;
      }
      if (r.kind === 'timeout') {
        S.outcome = 'timeout';
        S.failed++;
        if (!review) State.recordAttempt(lesson.id, { state: 'timeout' });
        showNote('Stopped after 8 seconds', r.message, r.tips);
        refreshStatus();
        paintHintBtn();
        return;
      }
      if (r.kind === 'error') {
        if (!review) State.recordAttempt(lesson.id, { state: 'error' });
        showSlip(r, sql);
        return;
      }
      if (!review) State.recordAttempt(lesson.id, r.verdict);
      if (r.verdict.state === 'pass') runPass(r, sql, keptOf);
      else showWrong(r, sql, keptOf);
    }

    /* ---------- The pass moment ---------- */
    function passExtras(r) {
      const out = [];
      if (lesson.win) out.push(el('div', { class: 'vband-body ms-win' }, UI.rich(lesson.win)));
      const cn = changeNode(r || {});
      if (cn) out.push(cn);
      if (r && r.plan) out.push(el('p', { class: 'vband-line', text: 'The plan now reads: ' + r.plan }));
      const meta = el('div', { class: 'ms-meta' });
      if (!review) {
        const bal = State.doneCount();
        meta.append(el('span', { class: 'vband-line ms-pbline', text: S.firstTime ? UI.stampDate(new Date()) + '   MISI ' + lesson.id + '   +1   Saldo ' + bal : 'Already in your passbook. Saldo ' + bal }));
        if (S.firstTime && lesson.pattern) meta.append(el('a', { class: 'tlink ms-added', href: '#/cheatsheet', html: UI.icons.check + '<span>Added to your Cheat sheet</span>' }));
      }
      if (isExam && lesson.solution) meta.append(el('button', { type: 'button', class: 'tlink', text: 'See the model answer', onClick: openModel }));
      if (meta.children.length) out.push(meta);
      return out;
    }

    function recordPassNow() {
      if (review) return;
      K.Header.hold();
      S.held = true;
      const res = State.recordPass(lesson.id);
      S.firstTime = !!res.firstTime;
      S.levelCleared = res.levelCleared || null;
    }

    /* Below 1000px: the slot's own size. A phone on its side has a smaller slot. */
    function stampSize() {
      return matchMedia('(max-height:449px)').matches ? 62 : 92;
    }

    function stampSheet(sheet, slot) {
      S.phase = 'stamping';
      slot.classList.add('stamped');
      const sr = slot.getBoundingClientRect();
      const small = !isWide() || sr.width < 130;
      const size = !isWide() ? stampSize() : small ? 92 : 124;
      UI.stamp(slot, {
        mission: lesson.id,
        size,
        rot: -11,
        left: (sr.width - size) / 2,
        top: (sr.height - size) / 2,
        onImpact: () => {
          if (S.disposed) return;
          if (S.held) { K.Header.release(); S.held = false; }
          tickSaldo();
          sheet.classList.add('is-stamped');
          lamp.removeAttribute('data-state');
          setStatus('Matches the request');
          if (ed) ed.readOnly = false;
          S.phase = 'passed';
          S.editedAfterPass = false;
          flipToNext();
          markTicketClosed(sheet);
          markDots();
          UI.announce('Sesuai. ' + UI.plainOf(lesson.win || ''));
          if (!review && o.onDone) o.onDone({ ok: true, firstTime: S.firstTime, levelCleared: S.levelCleared, lesson });
        }
      });
    }

    function markTicketClosed(sheet) {
      if (review) return;
      const t = isQuiz ? root.querySelector('.ms-q') : ticket;
      if (t && !t.querySelector('.tk-closed')) t.append(closedMark());
      if (sheet && sheet.pin && !sheet.pin.querySelector('.ms-pin-closed')) {
        sheet.pin.insertBefore(el('span', { class: 'ms-pin-closed', text: 'CLOSED' }), sheet.pin.firstChild);
      }
    }
    function markDots() {
      root.querySelectorAll('.ms-dot[data-id="' + CSS.escape(lesson.id) + '"]').forEach((a) => {
        a.classList.add('on');
        a.setAttribute('aria-label', lesson.id + ' ' + lesson.title + ', cleared');
      });
      const prog = root.querySelector('.ms-prog');
      if (prog) {
        const p = State.levelProgress(level.n);
        prog.textContent = p.done + ' of ' + p.total;
      }
    }

    function finishPrint() {
      S.ledgers.forEach((l) => l.finish());
    }

    function runPass(r, sql, keptOf) {
      S.phase = 'printing';
      lamp.dataset.state = 'busy';
      setStatus('Printing');
      /* Focus leaves the editor at once, and the editor is locked until the print ends. */
      /* Setting the value puts the query back at its top-left corner, so the whole shape reads. */
      if (ed) { ed.value = sql; ed.readOnly = true; }
      root.classList.add('is-passing');
      if (!isWide()) runLabel.textContent = 'Printing';
      recordPassNow();
      if (!review && !isOrder) State.saveDraft(lesson.id, sql);
      if (!review && !isWide()) keepPass(lesson.id, { r, sql, keptOf, firstTime: S.firstTime, levelCleared: S.levelCleared, step: 'result' });

      const slot = validationSlot(true);
      const band = bandText(r.verdict.title || 'You got it', '', passExtras(r));
      const sheet = buildSheet('pass', band, slot, r.results, { kept: keptOf ? { of: keptOf } : undefined }, [claudeBtn(r, sql)]);
      sheet.classList.add('is-landing');
      putSheet(sheet);
      sheet.focus({ preventScroll: true });
      sheet.addEventListener('click', onSheetClick);
      Promise.all(S.ledgers.map((l) => l.printed)).then(() => {
        if (S.disposed || S.sheet !== sheet) return;
        sheet.removeEventListener('click', onSheetClick);
        stampSheet(sheet, slot);
      });
    }
    function onSheetClick() { if (S.phase === 'printing') finishPrint(); }

    /* Coming back to a pass from earlier in this visit: the same printout, already stamped, with no second print and no second record. */
    function restorePass(p) {
      S.phase = 'passed';
      S.firstTime = p.firstTime;
      S.levelCleared = p.levelCleared;
      S.editedAfterPass = false;
      S.restoring = true;
      const slot = validationSlot(true);
      const band = bandText(p.r.verdict.title || 'You got it', '', passExtras(p.r));
      const sheet = buildSheet('pass', band, slot, p.r.results, { kept: p.keptOf ? { of: p.keptOf } : undefined }, [claudeBtn(p.r, p.sql)]);
      S.restoring = false;
      putSheet(sheet);
      slot.classList.add('stamped');
      const sr = slot.getBoundingClientRect();
      const size = stampSize();
      UI.stamp(slot, { mission: lesson.id, size, rot: -11, left: (sr.width - size) / 2, top: (sr.height - size) / 2, still: true, jolt: false, flare: false });
      sheet.classList.add('is-stamped');
      lamp.removeAttribute('data-state');
      setStatus('Matches the request');
      flipToNext();
      markTicketClosed(sheet);
      S.nextAt = 0;
      if (p.step !== 'result') setStep(p.step);
    }

    function passQuiz(pick) {
      S.phase = 'stamping';
      root.classList.add('is-passing');
      recordPassNow();
      const slot = validationSlot(true);
      const band = bandText('You got it', '', passExtras({}));
      const sheet = buildSheet('pass', band, slot, [], {}, []);
      const foot = sheet.querySelector('.ms-foot0');
      if (foot) foot.remove();
      sheet.classList.add('is-landing');
      putSheet(sheet);
      requestAnimationFrame(() => {
        if (!S.disposed) {
          const ur = upper.getBoundingClientRect(), cr = pick.card.getBoundingClientRect();
          upper.scrollTop += cr.top - ur.top - 12;
        }
      });
      setTimeout(() => { if (!S.disposed && S.sheet === sheet) stampSheet(sheet, slot); }, UI.motionOK() ? 260 : 0);
    }

    /* ---------- Layout measuring ---------- */
    let doPane, stage, upper, dock, mc, learnPane = null;

    function fitAll() {
      if (S.disposed || !doPane) return;
      if (isWide()) {
        const paneH = doPane.clientHeight;
        root.style.setProperty('--ed-cap', Math.round(paneH * 0.4) + 'px');
        root.classList.toggle('is-short', paneH < 660);
        const stageH = stage.clientHeight;
        root.style.setProperty('--stage-h', stageH + 'px');
        const trayH = tray.hidden ? 0 : tray.getBoundingClientRect().height;
        root.style.setProperty('--tray-h', (S.lowered ? 44 : trayH) + 'px');
      } else {
        clampRequest();
        if (S.sheet && S.sheet.checkBand) S.sheet.checkBand();
      }
      if (S.slip && S.markedWord) pointAtWord(S.markedWord);
    }

    /* Below 1000px a long request stops at a whole line, with a fade over it and a Read all control. Read all gives it the step. */
    const reqMore = isQuiz || isOrder ? null : el('button', {
      type: 'button', class: 'plain ms-req-more', text: 'Read all', hidden: true, 'aria-expanded': 'false',
      onClick: () => setReqOpen(!doPane.classList.contains('req-open'))
    });
    let reqKey = '';
    function setReqOpen(open) {
      if (!reqMore || !doPane || open === doPane.classList.contains('req-open')) return;
      doPane.classList.toggle('req-open', open);
      reqMore.textContent = open ? 'Read less' : 'Read all';
      reqMore.setAttribute('aria-expanded', String(open));
      upper.scrollTop = 0;
      reqKey = '';
      clampRequest();
      if (!open && ed) { ed.refresh(); const box = edHost.querySelector('.ed-scroll'); if (box && !edHost.contains(document.activeElement)) box.scrollTop = 0; }
    }
    function clampRequest() {
      if (!reqMore || S.disposed || isWide() || S.step !== 'task') return;
      const open = doPane.classList.contains('req-open');
      const skip = open || upper.classList.contains('target-open') || upper.offsetHeight === 0;
      const key = [doPane.clientWidth, doPane.clientHeight, !!hintsBox.hidden, skip, upper.offsetHeight === 0].join();
      if (key === reqKey) return;
      reqKey = key;
      upper.style.maxHeight = '';
      upper.classList.remove('is-clamped');
      if (skip) { reqMore.hidden = !open; return; }
      reqMore.hidden = true;
      const cap = upper.clientHeight;
      const taskEl = upper.querySelector('.tk-task');
      if (!taskEl || upper.scrollHeight <= cap + 1) return;
      const lh = parseFloat(getComputedStyle(taskEl).lineHeight) || 23;
      const top = taskEl.getBoundingClientRect().top - upper.getBoundingClientRect().top + upper.scrollTop;
      const lines = Math.max(1, Math.floor((cap - top) / lh));
      upper.scrollTop = 0;
      /* A table that would show only a sliver waits behind Read all too. */
      const ur = upper.getBoundingClientRect();
      let cut = top + lines * lh;
      taskEl.querySelectorAll('.rich>:not(p)').forEach((n) => {
        const r = n.getBoundingClientRect();
        const a = r.top - ur.top, z = r.bottom - ur.top;
        if (a < cut && z > cut && cut - a < 34 && a > top) cut = a;
      });
      upper.style.maxHeight = Math.round(cut) + 'px';
      upper.classList.add('is-clamped');
      reqMore.hidden = false;
    }

    /* ---------- Assemble ---------- */
    const upperParts = [];
    if (isQuiz) {
      upperParts.push(buildQuiz());
    } else {
      upperParts.push(buildTicket());
      if (isOrder) upperParts.push(buildTiles());
      upperParts.push(buildTables());
    }
    /* An order mission on a phone keeps its height for the tiles, so its two chips sit after them in the same scroll. */
    const chipsInScroll = isOrder && !isWide();
    if (chipsInScroll) upperParts.push(buildChips());
    upper = el('div', { class: 'ms-upper', tabindex: '-1' }, el('div', { class: 'ms-upper-in' }, upperParts), reqMore);
    /* With the keyboard up the request folds to one line. Tapping it puts the keyboard away and shows it all. */
    const reqLine = isQuiz ? null : el('button', {
      type: 'button', class: 'ms-req1', 'aria-label': 'Read the full request',
      onClick: () => { if (ed) ed.blur(); root.classList.remove('kb-up'); }
    }, (requester(lesson.from) ? el('b', { text: requester(lesson.from).name + ': ' }) : null), UI.rich(oneLine(taskHtml), { inline: true }));
    stage = el('div', { class: 'ms-stage' }, reqLine, upper, isQuiz || chipsInScroll ? null : buildChips(), tray);

    if (isOrder) {
      builtBox = el('div', { class: 'ms-builtbox' });
      builtBox.addEventListener('dragover', (e) => e.preventDefault());
      builtBox.addEventListener('drop', dropOnBuilt);
      edHost.append(builtBox);
      paintBuilt();
    }

    const barParts = [lamp, statusEl, noteEl];
    mc = el('div', { class: 'mc ms-mc' },
      el('div', { class: 'mc-bar ms-bar' }, barParts),
      hintsBox,
      isQuiz ? null : edBox,
      under,
      keys,
      el('div', { class: 'slot', 'aria-hidden': 'true' }));
    dock = el('div', { class: 'ms-dock' }, mc);
    doPane = el('div', { class: 'ms-do', id: 'ms-panel-do' }, stage, dock, leader);

    root.append(buildMissionBar(), buildSegs());
    if (!review) { learnPane = buildLearn(); root.append(learnPane); }
    root.append(doPane);
    container.append(root);

    /* Toasts stay above the bottom bar. */
    const setLift = () => document.documentElement.style.setProperty('--toast-lift', isWide() ? '0px' : '72px');

    /* The bottom bar lives in the console on a laptop, and under the steps on a phone. Everything else stays in place. */
    let wideNow = null;
    function syncLayout() {
      const wide = isWide();
      if (wide === wideNow) return;
      const first = wideNow === null;
      wideNow = wide;
      if (wide) {
        if (!first) mc.insertBefore(keys, mc.querySelector('.slot'));
        [learnPane, doPane].forEach((p) => { if (p) { p.removeAttribute('role'); p.removeAttribute('tabindex'); p.removeAttribute('aria-labelledby'); } });
      } else {
        root.append(keys);
        if (learnPane) { learnPane.setAttribute('role', 'tabpanel'); learnPane.setAttribute('aria-labelledby', 'ms-tab-learn'); learnPane.tabIndex = -1; }
        doPane.setAttribute('role', 'tabpanel');
        doPane.setAttribute('aria-labelledby', 'ms-tab-' + (S.step === 'learn' ? 'task' : S.step));
        doPane.tabIndex = -1;
      }
      setLift();
    }

    if (!review && State.isDone(lesson.id)) root.classList.add('is-cleared');
    if (isQuiz) { overBtn.hidden = true; modelBtn.hidden = true; noteEl.hidden = true; runBtn.classList.add('ms-run-quiz'); keys.classList.add('ms-keys-quiz'); }
    if (isExam || !showHints) hintBtn.hidden = true;
    if (isOrder) overBtn.hidden = false;

    /* The editor */
    if (!isQuiz && !isOrder) {
      const startLines = Math.max(lineCount(startText), startText ? 0 : Math.min(6, lineCount(lesson.solution)));
      const edLines = { min: Math.max(3, Math.min(startLines, 8)), max: 24 };
      ed = K.Editor.create(edHost, {
        id: lesson.id,
        value: startText,
        lines: edLines,
        autocomplete: true,
        keybar: true,
        runKey: true,
        label: 'SQL editor for mission ' + lesson.id,
        onRun: () => doRun(),
        onInput: (text) => {
          if (!review) State.saveDraft(lesson.id, text);
          lastPass.delete(lesson.id);
          if (S.phase === 'passed') {
            S.editedAfterPass = true;
            statusEl.textContent = 'Changed since it matched. Run it again to check';
            lamp.dataset.state = 'todo';
            return;
          }
          S.markedWord = null;
          if (S.outcome) {
            clearLeader();
            if (S.slip) S.slip.classList.add('no-ptr');
            S.outcome = null;
          }
          closeUnder();
          refreshStatus();
          fitAll();
        }
      });
      /* With paper up on a short screen, the editor stays small until the learner goes back to work in it. */
      const working = () => { if (!root.classList.contains('ed-focus')) { root.classList.add('ed-focus'); fitAll(); } };
      /* On a touch phone, focus in the editor means the keyboard: the request folds and the bottom bar steps aside. */
      edBox.addEventListener('focusin', () => { S.kbShrunk = false; if (coarse && !isWide()) root.classList.add('kb-up'); });
      edBox.addEventListener('pointerdown', working);
      edBox.addEventListener('input', working);
      edBox.addEventListener('keydown', (e) => { if (!e.ctrlKey && !e.metaKey && e.key !== 'Enter' && e.key !== 'Tab' && e.key !== 'Shift') working(); });
      /* The editor gives its height back a moment later, so a click that took focus away still lands on what was under the pointer. */
      let givenBack = 0;
      edBox.addEventListener('focusin', () => clearTimeout(givenBack));
      edBox.addEventListener('focusout', () => {
        clearTimeout(givenBack);
        givenBack = setTimeout(() => { if (!S.disposed) { root.classList.remove('ed-focus', 'kb-up'); fitAll(); } }, 300);
      });
      onCleanup(() => clearTimeout(givenBack));
    }

    paintHintBtn();
    paintNote();
    refreshStatus();
    setRunMode();
    if (isQuiz) { overBtn.hidden = true; }
    if (isExam) hintBtn.hidden = true;
    paintSegs();
    syncLayout();
    fitAll();
    if (restored) restorePass(restored);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { reqKey = ''; if (!S.disposed) fitAll(); });

    /* ---------- Listeners ---------- */
    const mountedAt = performance.now();
    const onDocKey = (e) => {
      if (document.querySelector('dialog[open]')) return;
      /* Enter held down from the last mission must not type line breaks into this one. */
      if (e.key === 'Enter' && e.repeat && performance.now() - mountedAt < 800) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key === 'Enter' && (S.phase === 'printing' || S.phase === 'stamping')) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) finishPrint();
        return;
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.repeat) {
        const inEd = edHost.contains(document.activeElement);
        if (inEd) return;   /* The editor reports it through onRun. */
        e.preventDefault();
        onMainKey();
      }
    };
    document.addEventListener('keydown', onDocKey, true);
    onCleanup(() => document.removeEventListener('keydown', onDocKey, true));

    const ro = window.ResizeObserver ? new ResizeObserver(() => fitAll()) : null;
    if (ro) {
      ro.observe(doPane);
      ro.observe(stage);
      ro.observe(tray);
      onCleanup(() => ro.disconnect());
    }
    const onResize = () => {
      syncLayout();
      fitAll();
      if (ed) ed.refresh();
    };
    window.addEventListener('resize', onResize);
    onCleanup(() => window.removeEventListener('resize', onResize));

    /* The screen is exactly as tall as what can be seen, with or without the keyboard. Some phones shrink the
       layout for the keyboard and some only shrink the visual viewport, so the step layout follows the visual one. */
    const root0 = document.documentElement;
    const vv = window.visualViewport;
    let tallest = 0, lastW = 0;
    const onViewport = () => {
      if (isWide()) { root0.style.removeProperty('--vvh'); return; }
      if (vv && vv.scale > 1.02) return;   /* Pinch zoom is not a smaller screen. */
      const h = vv ? vv.height : innerHeight;
      root0.style.setProperty('--vvh', Math.round(h) + 'px');
      if (scrollY || (vv && vv.offsetTop)) window.scrollTo(0, 0);
      if (innerWidth !== lastW) { lastW = innerWidth; tallest = h; }
      tallest = Math.max(tallest, h);
      /* The keyboard went away but focus stayed, as Android's back key does: leave the editor, and the bottom bar comes back. */
      if (root.classList.contains('kb-up') || S.kbShrunk) {
        if (h < tallest - 120) { S.kbShrunk = true; root.classList.add('kb-up'); }
        else if (S.kbShrunk) { S.kbShrunk = false; if (ed) ed.blur(); root.classList.remove('kb-up'); }
      }
    };
    if (vv) {
      vv.addEventListener('resize', onViewport);
      vv.addEventListener('scroll', onViewport);
      onCleanup(() => { vv.removeEventListener('resize', onViewport); vv.removeEventListener('scroll', onViewport); });
    }
    window.addEventListener('resize', onViewport);
    onViewport();
    onCleanup(() => { window.removeEventListener('resize', onViewport); root0.style.removeProperty('--toast-lift'); });

    /* The engine: calm while it warms up, honest if it fails */
    const offEngine = Engine.onStatus((st) => {
      if (S.disposed) return;
      paintNote();
      if (S.phase === 'edit') refreshStatus();
      if (st === 'ready') {
        if (S.repaintStub && !stubBox.querySelector('.ledger')) S.repaintStub();
        if (S.repaintExample && !root.querySelector('.ms-ex-feed .ledger')) S.repaintExample();
        if (S.repaintQuizResult && !root.querySelector('.ms-q-feed .ledger')) S.repaintQuizResult();
      }
    });
    onCleanup(offEngine);

    /* Focus: the first blank on a laptop, Run if the query is ready as it stands. */
    requestAnimationFrame(() => {
      if (S.disposed) return;
      fitAll();
      if (ed) ed.refresh();
      if (coarse || isQuiz || isOrder) return;
      if (lesson.prefilled && !saved) { runBtn.focus({ preventScroll: true }); return; }
      if (ed && !ed.selectFirstBlank()) ed.focus();
    });

    return function cleanup() {
      const kept = lastPass.get(lesson.id);
      if (kept) kept.step = S.step === 'learn' ? 'result' : S.step;
      S.disposed = true;
      if (S.held) { K.Header.release(); S.held = false; }
      cleanups.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
      if (ed) { try { ed.destroy(); } catch (e) { console.error(e); } }
      root.remove();
    };
  }

  K.Mission = {
    mount,
    render(container, params) { return mount(container, params.lesson, { mode: 'learn' }); }
  };
})();
