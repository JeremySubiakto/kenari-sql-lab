/*
 * Boot: builds Kenari.levels and friends, then (when the page has #view) runs the hash router,
 * the header and the settings menu. test.html loads this too, with no #view, so only the data part runs.
 */
(function () {
  'use strict';
  const K = (window.Kenari = window.Kenari || {});

  /* ---------- Course data ---------- */
  function initData() {
    K.levels = (globalThis.KENARI_LEVELS || []).slice().sort((a, b) => a.n - b.n);
    K.lessons = [];
    const byId = new Map();
    for (const level of K.levels) {
      for (const lesson of level.lessons || []) {
        lesson.level = level;
        lesson.index = K.lessons.length;
        if (lesson.type === 'order' && !lesson.solution) lesson.solution = (lesson.lines || []).join('\n');
        K.lessons.push(lesson);
        byId.set(lesson.id, lesson);
      }
    }
    K.lessonById = (id) => byId.get(String(id)) || null;
    K.nextLesson = (id) => { const l = K.lessonById(id); return l ? K.lessons[l.index + 1] || null : null; };
    K.prevLesson = (id) => { const l = K.lessonById(id); return l ? K.lessons[l.index - 1] || null : null; };

    K.glossary = Object.assign({}, KenariRef.GLOSSARY);
    K.levels.forEach((L) => Object.assign(K.glossary, L.terms || {}));
    const lower = new Map(Object.keys(K.glossary).map((k) => [k.toLowerCase(), k]));
    /** Case-insensitive lookup: {term, def}, or null. */
    K.term = (name) => {
      const key = lower.get(String(name).trim().toLowerCase());
      return key ? { term: key, def: K.glossary[key] } : null;
    };

    K.vocab = {
      values: KenariData.VALUES,
      columns: [...new Set(KenariData.SCHEMA.flatMap((t) => t.c.map((c) => c[0])))],
      tables: KenariData.SCHEMA.map((t) => t.t)
    };
  }
  initData();

  const view = document.getElementById('view');
  if (!view) return;   /* test.html: data only */

  const { UI, State, Engine } = K;
  const $ = (id) => document.getElementById(id);

  /* The router places every screen. A browser restoring its old scroll on reload could open Home halfway down. */
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* older browser */ }

  /* ---------- Router ---------- */
  const ROUTES = [
    { re: /^\/?$/, module: 'Home', nav: 'home', title: null },
    { re: /^\/journey\/?$/, module: 'Home', nav: 'journey', section: 'journey', title: 'Journey' },
    { re: /^\/passbook\/?$/, module: 'Home', nav: 'passbook', section: 'passbook', title: 'Passbook' },
    { re: /^\/m\/([\d.]+)\/?$/, module: 'Mission', nav: null, mission: true },
    { re: /^\/review\/?$/, module: 'Review', nav: 'review', title: 'Review' },
    { re: /^\/scratchpad\/?$/, module: 'Scratch', nav: 'scratchpad', title: 'Scratchpad' },
    { re: /^\/cheatsheet\/?$/, module: 'Sheet', nav: 'cheatsheet', title: 'Cheat sheet' },
    { re: /^\/about\/?$/, module: 'About', nav: null, title: 'About' }
  ];
  const ROUTE_NAMES = { Home: 'home', Mission: 'mission', Review: 'review', Scratch: 'scratchpad', Sheet: 'cheatsheet', About: 'about' };

  let cleanup = null;
  let currentModule = null;
  let booted = false;

  function renderNotFound(message) {
    UI.setTitle('Page not found');
    document.documentElement.dataset.route = 'notfound';
    view.replaceChildren(UI.el('div', { class: 'wrap wrap-narrow notfound' },
      UI.el('h1', { class: 'page-title', text: 'This page is not in the passbook' }),
      UI.el('p', { class: 'page-lead', text: message || 'The link may be old, or a character went missing. Your progress is safe.' }),
      UI.el('a', { class: 'key canary', href: '#/', text: 'Go to the home page' })));
  }

  function scrollToSection(section) {
    const go = () => {
      /* On a phone each section is its own screen, so it opens at the top. */
      const target = section && UI.isWide() ? document.getElementById(section) : null;
      if (target) target.scrollIntoView({ block: 'start' });
      else window.scrollTo(0, 0);
    };
    go();
    requestAnimationFrame(go);
  }

  function setNav(nav) {
    document.querySelectorAll('.nav a,.tabbar a').forEach((a) => {
      if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    /* The tab bar has no Passbook tab: the Saldo in the header is its way in, so it carries the mark. */
    if (nav === 'passbook') $('saldo').setAttribute('aria-current', 'page');
    else $('saldo').removeAttribute('aria-current');
  }

  function route() {
    const hash = location.hash.replace(/^#/, '') || '/';
    let match = null, r = null;
    for (const candidate of ROUTES) {
      match = hash.match(candidate.re);
      if (match) { r = candidate; break; }
    }
    closeMenu();
    UI.closeDialogs();
    /* A field that left with the old screen may never report losing focus. */
    delete document.documentElement.dataset.typing;
    delete document.documentElement.dataset.section;
    if (!r) { teardown(); currentModule = null; setNav(null); renderNotFound(); afterRoute(); return; }

    const params = {};
    let title = r.title;
    if (r.mission) {
      const lesson = K.lessonById(match[1]);
      if (!lesson) {
        teardown(); currentModule = null; setNav(null);
        renderNotFound('There is no mission ' + match[1] + ' in this course. Your progress is safe.');
        afterRoute();
        return;
      }
      params.id = lesson.id;
      params.lesson = lesson;
      title = lesson.id + ' ' + lesson.title;
    }
    if (r.section) params.section = r.section;

    setNav(r.nav);
    /* On a phone, CSS shows one section of Home at a time from this mark. */
    if (r.section) document.documentElement.dataset.section = r.section;
    else delete document.documentElement.dataset.section;
    /* Moving between sections of Home does not rebuild it. */
    if (currentModule === 'Home' && r.module === 'Home' && booted) {
      UI.setTitle(title);
      scrollToSection(r.section);
      document.dispatchEvent(new CustomEvent('kenari:section', { detail: { section: r.section || null } }));
      if (!UI.isWide() && !view.contains(document.activeElement)) view.focus({ preventScroll: true });
      return;
    }

    teardown();
    const mod = K[r.module];
    document.documentElement.dataset.route = ROUTE_NAMES[r.module];
    UI.setTitle(title);
    view.replaceChildren();
    currentModule = r.module;
    try {
      const result = mod.render(view, params);
      cleanup = typeof result === 'function' ? result : null;
    } catch (e) {
      console.error(e);
      renderNotFound('This screen hit a problem and could not open. Your progress is safe. Reload the page to try again.');
    }
    scrollToSection(r.section);
    afterRoute();
  }

  function afterRoute() {
    /* Focus goes to the new content unless the screen already placed it, as the editor does. */
    if (booted && !view.contains(document.activeElement)) view.focus({ preventScroll: true });
    booted = true;
  }

  function teardown() {
    if (cleanup) {
      try { cleanup(); } catch (e) { console.error(e); }
    }
    cleanup = null;
  }

  K.navigate = (hash) => {
    if (location.hash === hash) route(); else location.hash = hash;
  };
  /** Rebuild the current screen, for example after restoring progress. */
  K.refresh = () => { currentModule = null; route(); };

  /* ---------- Header: Saldo and the Review badge ---------- */
  let shownSaldo = null;
  let held = false;
  function paintSaldo(animate) {
    const n = State.doneCount();
    const box = $('saldoN');
    const label = 'Saldo: ' + n + (n === 1 ? ' mission' : ' missions') + ' cleared. Open the passbook.';
    $('saldo').setAttribute('aria-label', label);
    if (n === shownSaldo) return;
    const up = shownSaldo !== null && n > shownSaldo;
    shownSaldo = n;
    box.textContent = n;
    if (animate && up && UI.motionOK()) {
      box.classList.remove('tick');
      void box.offsetWidth;
      box.classList.add('tick');
    }
  }
  function paintDue() {
    const due = State.dueReviews().length;
    const badge = $('dueBadge');
    badge.hidden = !due;
    badge.textContent = due;
    const tabBadge = $('tabDue');
    tabBadge.hidden = !due;
    tabBadge.textContent = due;
    document.querySelectorAll('.nav a[data-nav="review"],.tabbar a[data-nav="review"]').forEach((link) => link.setAttribute('aria-label', due ? 'Review, ' + due + ' due' : 'Review'));
  }
  function paintHeader() {
    if (!held) paintSaldo(true);
    paintDue();
  }
  /** On a pass, the Mission screen holds the Saldo so it ticks when the stamp lands. */
  K.Header = {
    hold() { held = true; },
    release() { held = false; paintSaldo(true); },
    refresh: paintHeader
  };

  /* ---------- About: printed like the terms on the back of a passbook ---------- */
  const REPORT_URL = 'https://github.com/JeremySubiakto/kenari-sql-lab/issues/new?template=problem.md';
  /* The maker's link page: both labs and his LinkedIn. */
  const LINKS_URL = 'https://jeremysubiakto.github.io/links/';
  K.About = {
    render(host) {
      const rows = [
        ['What this is', 'A free course that takes you from your first query to professional SQL: ' + K.lessons.length + ' missions, with real SQLite running in your browser.'],
        ['Bank Kenari', 'Bank Kenari is made up. Every bank, branch, customer and colleague here is invented, and none of it stands for a real bank or person.'],
        ['Your privacy', 'Your progress stays in this browser. There is no account, no analytics and no tracking. Your queries stay on your device unless you copy them somewhere yourself.'],
        ['Other services', 'The page loads its fonts from Google Fonts and the SQL engine from cdnjs or jsDelivr. Those hosts see a normal web request, as with any website.'],
        ['Who made it', ['Made by ', UI.el('a', { href: LINKS_URL, target: '_blank', rel: 'noopener', text: 'Jeremy Subiakto' }), '.']],
        ['License', 'Code: MIT. Lessons: CC BY-NC 4.0, so share them with credit, but not for sale.'],
        ['Found a problem?', [UI.el('a', { href: REPORT_URL, target: '_blank', rel: 'noopener', text: 'Report it on GitHub' }), '. You need a free GitHub account.']]
      ];
      host.append(UI.el('div', { class: 'paper ab-book' },
        UI.el('div', { class: 'ab-book-in' },
          UI.el('h1', { lang: 'id', text: 'Syarat dan ketentuan' }),
          UI.el('small', { text: 'Terms, on the back of your passbook' }),
          UI.el('dl', {}, rows.map(([term, def]) => UI.el('div', {}, UI.el('dt', { text: term }), UI.el('dd', {}, def)))),
          UI.el('p', { class: 'eoe', text: 'E. & O.E.' }))));
    }
  };
  /* Already on About, the link changes nothing, so the computer's menu closes by hand. */
  const aboutRow = () => UI.el('a', { class: 'menu-row', href: '#/about', onClick: () => { if (/^#\/about\/?$/.test(location.hash)) closeMenu(true); } }, UI.el('span', { text: 'About and privacy' }));
  /* The credit is a row of its own. It opens the link page in a new tab, and the computer's menu closes behind it
     once the click has gone through. */
  const madeBy = () => UI.el('a', {
    class: 'menu-row menu-made', href: LINKS_URL, target: '_blank', rel: 'noopener',
    onClick: () => setTimeout(() => { if (menuEl) closeMenu(true); })
  }, UI.el('span', { text: 'Made by Jeremy Subiakto' }), UI.el('span', { class: 'menu-out', html: UI.icons.out }));

  /* ---------- Settings ---------- */
  function downloadProgress() {
    const blob = new Blob([State.exportJson()], { type: 'application/json' });
    const a = UI.el('a', { href: URL.createObjectURL(blob), download: 'kenari-progress-' + State.today() + '.json' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    UI.toast('Progress downloaded. Keep the file somewhere safe, and restore it from this menu on any browser.');
  }
  function restoreProgress() {
    const input = UI.el('input', { type: 'file', accept: '.json,application/json', class: 'vh', 'aria-hidden': 'true', tabindex: '-1' });
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      file.text().then((text) => {
        const r = State.importJson(text);
        UI.toast(r.message, { ms: 6000 });
        if (r.ok) { K.Review.forget(); UI.applyTheme(); K.refresh(); }
      }, () => UI.toast('That file could not be read. Choose the file you downloaded from this menu.'));
    });
    document.body.append(input);
    input.click();
  }
  async function resetProgress() {
    closeMenu(true);
    const yes = await UI.confirmInPage({
      title: 'Reset your progress?',
      body: 'This clears your cleared missions, passbook, stamps, reviews and saved queries on this device. It cannot be undone. Download your progress first if you might want it back.',
      confirm: 'Reset progress',
      cancel: 'Keep my progress',
      danger: true
    });
    if (!yes) return;
    State.reset();
    /* The name on the finished passbook goes too: reset means this device keeps nothing. */
    try { localStorage.removeItem('kenari.passbook.name.v1'); } catch (e) { /* storage blocked: nothing was kept */ }
    K.Review.forget();
    shownSaldo = null;
    UI.toast('Progress reset. Your passbook is empty again.');
    K.refresh();
  }

  function themeSegment() {
    const mode = State.settings().theme;
    const seg = UI.el('div', { class: 'seg', role: 'group', 'aria-label': 'Theme' });
    for (const m of ['system', 'light', 'dark']) {
      seg.append(UI.el('button', {
        type: 'button', text: m[0].toUpperCase() + m.slice(1), 'aria-pressed': String(mode === m),
        onClick: (e) => {
          State.setSetting('theme', m);
          UI.applyTheme();
          paintThemeBtn();
          seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
        }
      }));
    }
    return seg;
  }
  function settingsRows(afterAction) {
    const soundState = UI.el('span', { text: State.settings().sound ? 'On' : 'Off' });
    const rows = [
      UI.el('h3', { text: 'Theme' }),
      themeSegment(),
      UI.el('button', {
        type: 'button', class: 'menu-row', 'aria-label': 'Sound',
        onClick: () => {
          const on = !State.settings().sound;
          State.setSetting('sound', on);
          soundState.textContent = on ? 'On' : 'Off';
          if (on) UI.sound.thunk();
        }
      }, UI.el('span', { text: 'Sound' }), soundState),
      UI.el('button', { type: 'button', class: 'menu-row', onClick: () => { downloadProgress(); afterAction(); } }, UI.el('span', { text: 'Download progress as a file' })),
      UI.el('button', { type: 'button', class: 'menu-row', onClick: () => { restoreProgress(); afterAction(); } }, UI.el('span', { text: 'Restore from a file' })),
      UI.el('button', { type: 'button', class: 'menu-row', onClick: () => { if (!menuEl) afterAction(); resetProgress(); } }, UI.el('span', { text: 'Reset progress' }))
    ];
    if (!State.isSaving()) {
      rows.push(UI.el('p', { class: 'menu-note', text: 'This browser is blocking storage, so progress lasts only until this tab closes. Download it before you leave.' }));
    }
    return rows;
  }

  let menuEl = null;
  function closeMenu(refocus) {
    if (!menuEl) return;
    menuEl.remove();
    menuEl = null;
    $('gear').setAttribute('aria-expanded', 'false');
    if (refocus) $('gear').focus();
  }
  function openMenu() {
    menuEl = UI.el('div', { class: 'menu', role: 'group', 'aria-label': 'Settings' }, settingsRows(() => closeMenu()), aboutRow(), madeBy());
    $('top').append(menuEl);
    $('gear').setAttribute('aria-expanded', 'true');
    const first = menuEl.querySelector('button[aria-pressed="true"]');
    if (first) first.focus();
  }
  function paintThemeBtn() {
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    $('themeBtn').setAttribute('aria-label', 'Switch to the ' + (dark ? 'light' : 'dark') + ' theme');
  }

  /* On a phone, the settings come up as a sheet. The tab bar handles navigation, so only the Passbook, About and the maker's page are linked here. */
  function openSettingsSheet() {
    let sheet = null;
    const body = UI.el('div', {},
      UI.el('div', { class: 'sheet-group' }, settingsRows(() => sheet && sheet.close())),
      UI.el('div', { class: 'sheet-group' },
        UI.el('a', { class: 'menu-row', href: '#/passbook' }, UI.el('span', { text: 'Open your passbook' }), UI.el('span', { text: State.doneCount() + ' cleared' })),
        aboutRow(),
        madeBy()));
    body.addEventListener('click', (e) => { if (e.target.closest('a')) sheet.close(); });
    sheet = UI.sheet({ title: 'Settings', body });
  }

  /* iOS zooms the whole page into any text box under 16px when it gets focus, and the mission editor
     on a phone is 14px. maximum-scale=1 stops only that zoom: since iOS 10, Safari still lets people
     pinch to zoom. Other browsers never get the setting. */
  (function stopFocusZoom() {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const meta = document.querySelector('meta[name="viewport"]');
    if (ios && meta && !/maximum-scale/.test(meta.content)) meta.content += ', maximum-scale=1';
  })();

  /* While the on-screen keyboard is up, the tab bar steps aside, and fixed layouts follow the visible height. */
  function trackPhoneViewport() {
    const root = document.documentElement;
    const isField = (t) => t && t.matches && t.matches('input:not([type="file"]):not([type="checkbox"]):not([type="radio"]),textarea,[contenteditable="true"]');
    document.addEventListener('focusin', (e) => {
      if (isField(e.target) && !e.target.readOnly && UI.coarse() && !UI.isWide()) root.dataset.typing = '1';
    });
    document.addEventListener('focusout', (e) => {
      if (isField(e.target)) delete root.dataset.typing;
    });
    const vv = window.visualViewport;
    if (!vv) return;
    const place = () => {
      if (UI.isWide()) root.style.removeProperty('--vvh');
      else root.style.setProperty('--vvh', Math.round(vv.height) + 'px');
    };
    vv.addEventListener('resize', place);
    place();
  }

  function bindHeader() {
    $('gear').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!UI.isWide()) { openSettingsSheet(); return; }
      if (menuEl) closeMenu(); else openMenu();
    });
    $('themeBtn').addEventListener('click', () => {
      const dark = document.documentElement.getAttribute('data-theme') !== 'light';
      State.setSetting('theme', dark ? 'light' : 'dark');
      UI.applyTheme();
      paintThemeBtn();
    });
    document.addEventListener('click', (e) => {
      if (menuEl && !menuEl.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuEl) closeMenu(true);
    });
    document.addEventListener('kenari:theme', paintThemeBtn);
  }

  /* ---------- Boot ---------- */
  UI.applyTheme();
  paintThemeBtn();
  bindHeader();
  trackPhoneViewport();
  paintSaldo(false);
  paintDue();
  State.onChange(paintHeader);
  window.addEventListener('hashchange', route);
  route();
  K.booted = true;
  /* The opening (intro.js) plays over Home's first paint, which index.html covered. Either way the cover lifts here. */
  try { if (K.Intro) K.Intro.start(); } catch (e) { console.error(e); }
  document.documentElement.classList.remove('kn-cover');
  /* The page paints first. The engine loads after, and Run queues until it is ready. */
  requestAnimationFrame(() => setTimeout(() => Engine.ready, 0));
  UI.whenIdle(() => UI.prepFlare());
})();
