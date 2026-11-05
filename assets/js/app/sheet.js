/*
 * Kenari.Sheet: the cheat sheet (route #/cheatsheet). One search box looks through four sections:
 * patterns earned so far, Excel to SQL, the glossary and the dialect table.
 * Everything comes from the lesson files and KenariRef, so nothing here is hardcoded.
 */
(function () {
  'use strict';
  const K = (window.Kenari = window.Kenari || {});
  const FIND_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
  const HIGHLIGHT = 'cs-find';

  const norm = (s) => String(s == null ? '' : s).toLowerCase();
  const plural = (n, one, many) => n.toLocaleString('en-US') + ' ' + (n === 1 ? one : (many || one + 's'));

  function render(container) {
    const { UI, State } = K;
    const el = UI.el;
    UI.setTitle('Cheat sheet');

    const withPattern = K.lessons.filter((l) => l.pattern);
    const earned = withPattern.filter((l) => State.isDone(l.id));
    const next = State.current();

    /* Everything the search can hide: {node, text, group, section} */
    const index = [];
    const add = (section, node, text, group) => { index.push({ section, node, text: norm(text), group: group || null }); return node; };

    /* ---------- Patterns ---------- */
    const patterns = el('section', { class: 'cs-sec', id: 'cs-patterns', 'aria-labelledby': 'cs-h-patterns' });
    const patCount = el('span', { class: 'cs-n' });
    patterns.append(el('h2', { id: 'cs-h-patterns', tabindex: '-1' }, 'Patterns you have earned', patCount));

    if (!earned.length) {
      patterns.append(el('div', { class: 'cs-empty' },
        el('div', { class: 'cs-empty-ros', html: UI.rosette(0, 76) }),
        el('div', { class: 'cs-empty-t' },
          el('h3', { text: 'Your first pattern is one mission away' }),
          el('p', { text: 'Each mission you clear leaves a query shape here, ready to copy and reuse at work. Nothing is on this list yet because nothing is cleared yet, and that is where everyone starts.' }),
          next ? el('a', { class: 'key canary cs-cta', href: '#/m/' + next.id }, State.doneCount() ? 'Continue: Mission ' + next.id + ' ' + next.title : 'Start Mission ' + next.id, el('span', { html: UI.icons.arrow })) : null)));
    }
    const levelGroups = [];
    for (const level of K.levels) {
      const mine = earned.filter((l) => l.level === level);
      if (!mine.length) continue;
      const totalHere = withPattern.filter((l) => l.level === level).length;
      const list = el('div', { class: 'cs-pats' });
      const group = el('details', { class: 'cs-level', open: true },
        el('summary', {},
          el('span', { class: 'cs-level-ros', html: UI.rosette(level.n, 38) }),
          el('span', { class: 'cs-level-t' },
            el('b', { text: 'Level ' + level.n + ', ' + level.title }),
            el('small', { text: 'Rank: ' + level.rank })),
          el('span', { class: 'cs-level-n', text: mine.length + ' of ' + totalHere }),
          el('span', { class: 'cs-chev', html: UI.icons.down })),
        list);
      for (const l of mine) {
        const item = el('article', { class: 'cs-pat' },
          el('div', { class: 'cs-pat-note' },
            UI.rich(l.pattern.note),
            el('a', { class: 'plain', href: '#/m/' + l.id, text: 'Mission ' + l.id })),
          UI.code(l.pattern.sql, { copy: true, label: 'Pattern from Mission ' + l.id }));
        list.append(add('patterns', item, UI.plainOf(l.pattern.note) + ' ' + l.pattern.sql + ' ' + l.id + ' ' + l.title + ' ' + level.title, group));
      }
      levelGroups.push(group);
      patterns.append(group);
    }
    /* What a search would find in missions not cleared yet, without giving those patterns away. */
    const unearned = withPattern.filter((l) => !State.isDone(l.id));
    const stillNote = el('p', { class: 'cs-still' });
    if (earned.length && unearned.length) patterns.append(stillNote);

    /* ---------- Excel to SQL ---------- */
    const excelList = el('ul', { class: 'cs-xl' });
    for (const [xl, sql] of KenariRef.EXCEL_MAP) {
      excelList.append(add('excel', el('li', {},
        el('span', { class: 'cs-xl-a', text: xl }),
        el('span', { class: 'cs-xl-arrow', 'aria-hidden': 'true', html: UI.icons.right }),
        el('span', { class: 'vh', text: ' in SQL is ' }),
        el('code', { text: sql })), xl + ' ' + sql));
    }
    const excelCount = el('span', { class: 'cs-n' });
    const excel = el('section', { class: 'cs-sec', id: 'cs-excel', 'aria-labelledby': 'cs-h-excel' },
      el('h2', { id: 'cs-h-excel', tabindex: '-1' }, 'Excel to SQL', excelCount),
      el('p', { class: 'cs-lead', text: 'What you already do in a workbook, and what the same move is called here.' }),
      excelList);

    /* ---------- Glossary ---------- */
    const names = Object.keys(K.glossary).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    const dl = el('dl', { class: 'cs-gl' });
    for (const name of names) {
      const def = K.glossary[name];
      const entry = el('div', { class: 'cs-gl-i' }, el('dt', { text: name }), el('dd', {}, UI.rich(def)));
      if (name === 'Kol' && UI.KOL_GRADES) {
        const rows = UI.KOL_GRADES.map((g) => el('tr', {}, el('td', { class: 'n', text: g[0] }), el('td', { text: g[1] }), el('td', { class: 'd', text: g[2] })));
        entry.querySelector('dd').append(el('table', { class: 'cs-kol' },
          el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'Grade' }), el('th', { scope: 'col', text: 'Name' }), el('th', { scope: 'col', text: 'Days past due' }))),
          el('tbody', {}, rows)));
      }
      dl.append(add('glossary', entry, name + ' ' + UI.plainOf(def)));
    }
    const glossCount = el('span', { class: 'cs-n' });
    const glossary = el('section', { class: 'cs-sec', id: 'cs-glossary', 'aria-labelledby': 'cs-h-glossary' },
      el('h2', { id: 'cs-h-glossary', tabindex: '-1' }, 'Collection and SQL glossary', glossCount),
      el('p', { class: 'cs-lead', text: 'The words people use on the floor and in queries, in plain English.' }),
      dl);

    /* ---------- Dialects ---------- */
    const D = KenariRef.DIALECTS;
    const others = D.head.slice(2);
    const dt = el('table', { class: 'cs-dt', 'data-show': '0' },
      el('thead', {}, el('tr', {}, D.head.map((h, i) => el('th', { scope: 'col', 'data-c': i >= 2 ? i - 2 : null, class: i === 1 ? 'lab' : null, text: h })))),
      el('tbody', {}));
    for (const row of D.rows) {
      const tr = el('tr', {}, row.map((cell, i) => (i === 0
        ? el('th', { scope: 'row', text: cell })
        : el('td', { 'data-c': i >= 2 ? i - 2 : null, class: i === 1 ? 'lab' : null }, el('code', { text: cell })))));
      dt.tBodies[0].append(add('dialects', tr, row.join(' ')));
    }
    /* On a phone six columns cannot fit, so it compares this lab with one product at a time. */
    const seg = el('div', { class: 'seg cs-seg', role: 'group', 'aria-label': 'Compare SQLite with', style: { gridTemplateColumns: 'repeat(' + others.length + ',minmax(0,1fr))' } },
      others.map((name, i) => el('button', {
        type: 'button', text: name, 'aria-pressed': i === 0 ? 'true' : 'false',
        onClick: (e) => {
          dt.dataset.show = String(i);
          seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false'));
        }
      })));
    const dialectCount = el('span', { class: 'cs-n' });
    const dialects = el('section', { class: 'cs-sec', id: 'cs-dialects', 'aria-labelledby': 'cs-h-dialects' },
      el('h2', { id: 'cs-h-dialects', tabindex: '-1' }, 'Other databases at work', dialectCount),
      el('p', { class: 'cs-lead', text: 'This lab runs SQLite, and most of what you learn here carries over. These are the places where other products write the same thing differently.' }),
      el('div', { class: 'cs-dialect' }, seg, dt));

    /* ---------- Page ---------- */
    const SECTIONS = [
      { key: 'patterns', label: 'Patterns', node: patterns, count: patCount },
      { key: 'excel', label: 'Excel to SQL', node: excel, count: excelCount },
      { key: 'glossary', label: 'Glossary', node: glossary, count: glossCount },
      { key: 'dialects', label: 'Dialects', node: dialects, count: dialectCount }
    ];
    const navLinks = SECTIONS.map((s) => {
      const n = el('span', { class: 'cs-nav-n' });
      const b = el('button', {
        type: 'button', 'data-key': s.key,
        onClick: () => {
          s.node.scrollIntoView({ block: 'start', behavior: UI.motionOK() ? 'smooth' : 'auto' });
          const h = s.node.querySelector('h2');
          if (h) h.focus({ preventScroll: true });
        }
      }, el('span', { text: s.label }), n);
      s.navN = n;
      s.navB = b;
      return b;
    });
    const nav = el('nav', { class: 'cs-nav', 'aria-label': 'Sections of the cheat sheet' }, navLinks);

    const input = el('input', {
      type: 'search', class: 'cs-input', id: 'cs-q', autocomplete: 'off', spellcheck: 'false',
      placeholder: 'Search the cheat sheet', 'aria-label': 'Search patterns, Excel terms, the glossary and dialects'
    });
    const found = el('p', { class: 'cs-found', role: 'status' });
    const none = el('div', { class: 'cs-none', hidden: true });

    const lead = !earned.length
      ? 'Your own SQL phrasebook. The reference sections are here from day one, and the patterns fill in as you clear missions.'
      : 'You have earned ' + earned.length.toLocaleString('en-US') + ' of ' + plural(withPattern.length, 'pattern') + ' so far. Copy one, change the names, and it works at the office too.';

    const main = el('div', { class: 'cs-main' },
      el('div', { class: 'cs-find' }, el('span', { class: 'cs-find-i', html: FIND_ICON }), input),
      found, none, patterns, excel, glossary, dialects);
    const page = el('div', { class: 'wrap cs' },
      el('header', { class: 'tl-head' },
        el('h1', { class: 'page-title', text: 'Cheat sheet' }),
        el('p', { class: 'page-lead', text: lead })),
      el('div', { class: 'cs-grid' }, nav, main));
    container.append(page);

    /* ---------- Search ---------- */
    const setCounts = () => {
      for (const s of SECTIONS) {
        const items = index.filter((i) => i.section === s.key);
        const shown = items.filter((i) => !i.node.hidden).length;
        s.navN.textContent = shown;
        s.count.textContent = shown;
        s.shown = shown;
        s.navB.disabled = !shown && !!input.value.trim();
      }
    };
    const paintHighlight = (terms) => {
      if (!window.CSS || !CSS.highlights || !window.Highlight) return;
      CSS.highlights.delete(HIGHLIGHT);
      if (!terms.length) return;
      const ranges = [];
      const CAP = 300;
      outer: for (const item of index) {
        if (item.node.hidden) continue;
        const walker = document.createTreeWalker(item.node, NodeFilter.SHOW_TEXT);
        let t;
        while ((t = walker.nextNode())) {
          if (t.parentElement.closest('.vh,.cb-copy')) continue;
          const low = t.nodeValue.toLowerCase();
          for (const term of terms) {
            let at = low.indexOf(term);
            while (at >= 0) {
              const r = new Range();
              r.setStart(t, at);
              r.setEnd(t, at + term.length);
              ranges.push(r);
              if (ranges.length >= CAP) break outer;
              at = low.indexOf(term, at + term.length);
            }
          }
        }
      }
      CSS.highlights.set(HIGHLIGHT, new Highlight(...ranges));
    };
    const stillText = (terms) => {
      if (!stillNote.isConnected) return;
      stillNote.replaceChildren();
      const list = terms.length
        ? unearned.filter((l) => { const t = norm(UI.plainOf(l.pattern.note) + ' ' + l.pattern.sql + ' ' + l.title); return terms.every((w) => t.includes(w)); })
        : unearned;
      if (!list.length) { stillNote.hidden = true; return; }
      stillNote.hidden = false;
      const first = list.find((l) => !next || l.index >= next.index) || list[0];
      stillNote.append(
        terms.length
          ? plural(list.length, 'more pattern') + ' on this search ' + (list.length === 1 ? 'is' : 'are') + ' waiting in missions you have not cleared. '
          : plural(list.length, 'more pattern') + ' to earn. ',
        el('a', { class: 'plain', href: '#/m/' + first.id, text: 'Go to Mission ' + first.id + ', ' + first.title }));
    };

    let wasSearching = false;
    const openBefore = new Map();
    const apply = () => {
      const q = input.value.trim().toLowerCase();
      const terms = q ? q.split(/\s+/) : [];
      for (const item of index) item.node.hidden = !terms.every((w) => item.text.includes(w));
      for (const group of levelGroups) group.hidden = ![...group.querySelectorAll('.cs-pat')].some((p) => !p.hidden);
      /* A search looks inside closed levels, then puts them back the way they were. */
      if (terms.length && !wasSearching) levelGroups.forEach((g) => openBefore.set(g, g.open));
      if (terms.length) levelGroups.forEach((g) => { g.open = true; });
      if (!terms.length && wasSearching) levelGroups.forEach((g) => { g.open = openBefore.get(g) !== false; });
      wasSearching = !!terms.length;
      setCounts();
      for (const s of SECTIONS) s.node.hidden = !!terms.length && !s.shown && !(s.key === 'patterns' && unearned.length && earned.length);
      if (patterns.hidden === false && terms.length && !SECTIONS[0].shown && !earned.length) patterns.hidden = true;
      stillText(terms);
      /* Headings stay out of the way when a search leaves a section with only the "still to earn" line. */
      const total = SECTIONS.reduce((n, s) => n + (s.shown || 0), 0);
      if (!terms.length) {
        found.textContent = '';
        found.hidden = true;
        none.hidden = true;
      } else if (total) {
        found.hidden = false;
        found.textContent = plural(total, 'match', 'matches') + ' for "' + input.value.trim() + '"';
        none.hidden = true;
      } else {
        found.hidden = true;
        none.hidden = false;
        none.replaceChildren(
          el('h3', {}, 'Nothing here matches "' + input.value.trim() + '"'),
          el('p', { text: 'The search looks through your earned patterns, the Excel list, the glossary and the dialect table. Try a shorter word, or the Excel name for what you want to do.' }),
          el('button', { type: 'button', class: 'ghost', text: 'Clear the search', onClick: () => { input.value = ''; apply(); input.focus(); } }));
        const anyStill = stillNote.isConnected && !stillNote.hidden;
        for (const s of SECTIONS) s.node.hidden = !(s.key === 'patterns' && anyStill);
      }
      paintHighlight(terms);
    };
    let debounce = 0;
    input.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(apply, 70); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; apply(); } });

    /* The slash key jumps to the search, unless the learner is already typing somewhere. */
    const onKey = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      input.focus();
      input.select();
    };
    document.addEventListener('keydown', onKey);

    /* The section you are reading is marked in the side list. */
    let spy = null;
    if (window.IntersectionObserver) {
      spy = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const s = SECTIONS.find((x) => x.node === e.target);
          navLinks.forEach((b) => (b === s.navB ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
        }
      }, { rootMargin: '-20% 0px -70% 0px' });
      SECTIONS.forEach((s) => spy.observe(s.node));
    }

    apply();
    if (!UI.coarse()) input.focus({ preventScroll: true });

    return () => {
      clearTimeout(debounce);
      document.removeEventListener('keydown', onKey);
      if (spy) spy.disconnect();
      if (window.CSS && CSS.highlights) CSS.highlights.delete(HIGHLIGHT);
    };
  }

  K.Sheet = { render };
})();
