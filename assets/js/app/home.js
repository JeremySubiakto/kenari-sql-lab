/*
 * Kenari.Home: the hero with its live query, the Journey, the Passbook and the rank-up sheet.
 * Routes #/, #/journey and #/passbook. See docs/DESIGN.md.
 * Every count and title comes from the lesson files through Kenari.levels and Kenari.lessons.
 *
 * Kenari.Home.rankUp(level) shows the rank-up sheet. It takes a level object or a level number
 * and resolves with {next, lesson, hash} when the learner continues.
 */
(function () {
  'use strict';
  const K = (window.Kenari = window.Kenari || {});

  const STARTER = 'SELECT * FROM branches;';
  const FIRST_ID = '0.1';
  const NAME_KEY = 'kenari.passbook.name.v1';
  const LINES_PER_PAGE = 12;
  const TAU = Math.PI * 2;
  const NUM_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
  const SCISSORS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="6.5" r="2.7"/><circle cx="6" cy="17.5" r="2.7"/><path d="M8.3 8 20 17M8.3 16 20 7"/></svg>';
  const MICRO = 'BANK KENARI ADALAH BANK FIKTIF '.repeat(14);
  const STAMP_ROT = [-9, 7, -5, 11, -12, 6, -7, 9, -4, -10];
  /* The sister course. Linked once, from the rank-up that ends this course. */
  const EXCEL_URL = 'https://jeremysubiakto.github.io/kenari-excel-lab/';

  const missions = (n) => n + (n === 1 ? ' mission' : ' missions');
  const rows = (n) => Number(n).toLocaleString('en-US') + (n === 1 ? ' row' : ' rows');
  const lowerFirst = (s) => String(s).charAt(0).toLowerCase() + String(s).slice(1);

  function readName() {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
  }
  function saveName(v) {
    try { localStorage.setItem(NAME_KEY, v); } catch (e) { /* storage blocked: the name lasts until the page closes */ }
  }

  /* The fine rosette printed under the passbook pages. Built once, when the first page needs it. */
  function ensureUnderprint() {
    if (document.getElementById('hm-defs')) return;
    let d = '';
    [[20, 0.3, 0.16, 8, 0.02, 24], [32, 0.72, 0.18, 12, 0.025, 36]].forEach(([n, base, a, p, b, q]) => {
      for (let k = 0; k < n; k++) {
        const ph = k / n * TAU;
        const pts = 200;
        for (let i = 0; i <= pts; i++) {
          const t = i / pts * TAU;
          const r = 50 * (base + a * Math.cos(p * t + ph) + b * Math.cos(q * t - ph));
          d += (i ? 'L' : 'M') + (r * Math.cos(t)).toFixed(1) + ' ' + (r * Math.sin(t)).toFixed(1);
        }
        d += 'Z';
      }
    });
    document.body.insertAdjacentHTML('afterbegin', '<svg id="hm-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs><symbol id="hm-ros-big" viewBox="-52 -52 104 104"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width=".13"/><circle r="50.6" fill="none" stroke="currentColor" stroke-width=".22"/></symbol></defs></svg>');
  }

  /* ---------- Small shared pieces ---------- */
  const levelCleared = (L) => {
    const p = K.State.levelProgress(L.n);
    return p.total > 0 && p.done === p.total;
  };
  const stampDateOf = (n) => {
    const s = K.State.stamps().find((x) => x.n === n);
    return s ? s.date : K.State.today();
  };
  /** Where a level's link goes: its first mission not cleared yet, or its first mission. */
  const levelTarget = (L) => L.lessons.find((m) => !K.State.isDone(m.id)) || L.lessons[0];
  /** The level the suggested next mission sits in, or -1 when everything is cleared. */
  const hereIndex = () => {
    const c = K.State.current();
    return c ? K.levels.indexOf(c.level) : -1;
  };

  /* ---------- Mini route: the climb, drawn at the width it is given ---------- */
  function miniRoute(opts) {
    const o = opts || {};
    const { UI } = K;
    const here = o.here == null ? hereIndex() : o.here;
    const levels = K.levels;
    const hereL = levels[here];
    const label = hereL
      ? 'The route has ' + levels.length + ' levels, from ' + levels[0].rank + ' to ' + levels[levels.length - 1].rank + '. You are at Level ' + hereL.n + ', ' + hereL.title + '.'
      : 'The route has ' + levels.length + ' levels, and every one is cleared.';
    const box = o.link === false
      ? UI.el('div', { class: 'mr' + (o.paper ? ' mr-paper' : ''), role: 'img', 'aria-label': label })
      : UI.el('a', { class: 'mr' + (o.paper ? ' mr-paper' : ''), href: '#/journey', 'aria-label': label + ' Open the Journey.' });
    let lastW = 0;
    const draw = () => {
      const W = box.clientWidth;
      if (!W || W === lastW) return;
      lastW = W;
      const r = W < 420 ? 10.5 : 12.5;
      const H = 88;
      const x0 = r + 2;
      const step = (W - x0 * 2) / (levels.length - 1);
      const y0 = H - r - 17;
      const rise = (y0 - (r + 22)) / Math.floor((levels.length - 1) / 2);
      const pts = levels.map((L, i) => ({ x: x0 + i * step, y: y0 - Math.floor(i / 2) * rise }));
      const seg = (a, b) => {
        const dy = Math.abs(b.y - a.y);
        if (dy < 0.5) return 'L' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
        const mx = (a.x + b.x) / 2;
        return 'L' + (mx - dy / 2).toFixed(1) + ' ' + a.y.toFixed(1) + 'L' + (mx + dy / 2).toFixed(1) + ' ' + b.y.toFixed(1) + 'L' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
      };
      const through = here < 0 ? levels.length - 1 : here;
      let rest = 'M' + pts[through].x.toFixed(1) + ' ' + pts[through].y.toFixed(1);
      for (let i = through + 1; i < pts.length; i++) rest += seg(pts[i - 1], pts[i]);
      let done = 'M' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
      for (let i = 1; i <= through; i++) done += seg(pts[i - 1], pts[i]);
      const dots = levels.map((L, i) => {
        const p = pts[i];
        const cls = levelCleared(L) ? 'on' : i === here ? 'here' : '';
        return '<g transform="translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')">'
          + (i === here ? '<circle class="mr-ring" r="' + (r + 4) + '"/>' : '')
          + '<circle class="mr-dot ' + cls + '" r="' + r + '"/>'
          + '<text class="mr-n ' + cls + '" y="4.4" text-anchor="middle">' + L.n + '</text></g>';
      }).join('');
      let hereText = '';
      if (here >= 0) {
        const p = pts[here];
        const anchor = p.x < 50 ? 'start' : p.x > W - 50 ? 'end' : 'middle';
        const hx = anchor === 'start' ? 0 : anchor === 'end' ? W : p.x;
        hereText = '<text class="mr-here" x="' + hx.toFixed(1) + '" y="' + (p.y - r - 8).toFixed(1) + '" text-anchor="' + anchor + '">You are here</text>';
      }
      const lastP = pts[pts.length - 1];
      const endLabel = here === levels.length - 1 ? '' : '<text class="mr-end" x="' + W + '" y="' + (lastP.y + r + 15).toFixed(1) + '" text-anchor="end">' + UI.esc(levels[levels.length - 1].rank) + '</text>';
      box.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true" focusable="false">'
        + '<path class="mr-line" d="' + rest + '"/>' + (through > 0 ? '<path class="mr-line on" d="' + done + '"/>' : '') + dots
        + '<text class="mr-end" x="0" y="' + (pts[0].y + r + 15).toFixed(1) + '">' + UI.esc(levels[0].rank) + '</text>' + endLabel + hereText + '</svg>';
    };
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(draw);
      ro.observe(box);
      box._stop = () => ro.disconnect();
    }
    box._draw = draw;
    return box;
  }

  /* ---------- Rank-up: a sheet of paper on the desk ---------- */
  function rankUp(levelOrN) {
    const { UI, State } = K;
    const el = UI.el;
    const level = typeof levelOrN === 'number' ? K.levels.find((L) => L.n === levelOrN) : levelOrN;
    if (!level) return Promise.resolve({ next: null, lesson: State.current(), hash: '#/' });

    return new Promise((resolve) => {
      const later = K.levels.filter((L) => L.n > level.n && !levelCleared(L));
      const nr = State.nextRank();
      const next = later[0] || (nr ? nr.level : null);
      const finished = !nr;
      const lesson = next ? levelTarget(next) : null;
      const hash = lesson ? '#/m/' + lesson.id : '#/passbook';
      const heldBack = !finished && State.rank() !== level.rank && nr && nr.level.n < level.n;
      const total = level.lessons.length;

      const go = el('button', { type: 'button', class: 'key canary big rk-go' },
        el('span', { class: 'rk-go-t' },
          el('span', { class: 'rk-go-b', text: next ? 'On to Level ' + next.n + ': ' + next.title : 'Open your finished passbook' }),
          el('span', { class: 'rk-go-s', text: next ? 'Next rank: ' + next.rank : 'Every level is stamped' })),
        el('span', { html: UI.icons.arrow }));

      const seal = el('div', { class: 'rk-seal' }, el('span', { class: 'rk-ros', html: UI.rosette(level.n, 100) }));
      const route = miniRoute({ paper: true, link: false, here: next ? K.levels.indexOf(next) : -1 });
      /* A passbook page with this stamp, made on the device as a picture to share (Kenari.Share). */
      const share = K.Share ? el('button', { type: 'button', class: 'ghost rk-share', text: 'Share this rank', onClick: () => K.Share.rank(level) }) : null;
      const sheet = el('div', { class: 'paper rk-sheet' },
        el('div', { class: 'rk-copy' },
          el('p', { class: 'rk-label', text: 'Level ' + level.n + ' cleared, ' + total + ' of ' + total + ' missions' }),
          el('h2', { class: 'rk-rank', id: 'rkTitle' }, el('small', { text: 'New rank' }), level.rank),
          el('p', { class: 'rk-can' }, 'You can now ' + lowerFirst(level.goal)),
          heldBack ? el('p', { class: 'rk-held', text: 'This stamp is yours. Your rank in the passbook stays ' + State.rank() + ' until Level ' + nr.level.n + ' is cleared too.' }) : null,
          el('div', { class: 'rk-act' }, go),
          share,
          route,
          el('p', { class: 'rk-foot', text: 'Bank Kenari is made up. This rank is yours.' }),
          finished ? el('p', { class: 'rk-foot rk-xl' }, 'Next, the same idea for Excel: ',
            el('a', { href: EXCEL_URL, target: '_blank', rel: 'noopener', text: 'Kenari Excel Lab' }), '.') : null),
        seal);
      const dlg = el('dialog', { class: 'rk', 'aria-labelledby': 'rkTitle' }, sheet);
      document.body.append(dlg);

      let closed = false;
      const finish = () => {
        if (closed) return;
        closed = true;
        if (route._stop) route._stop();
        if (dlg.open) dlg.close();
        dlg.remove();
        resolve({ next, lesson, hash, finished });
      };
      go.addEventListener('click', finish);
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(); });

      try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
      route._draw();
      UI.announce('Level ' + level.n + ' cleared. New rank: ' + level.rank + '.');
      sheet.tabIndex = -1;
      sheet.focus({ preventScroll: true });
      UI.anim(sheet, [{ opacity: 0, transform: 'translateY(26px) rotate(-.5deg)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });

      /* The big stamp lands on the level's own rosette. */
      const land = () => {
        if (closed) return;
        const size = Math.round(Math.min(seal.clientWidth, seal.clientHeight || seal.clientWidth) * 0.8);
        const up = String(level.rank).toUpperCase();
        const node = UI.stamp(seal, {
          size,
          left: (seal.clientWidth - size) / 2,
          top: (seal.clientHeight - size) / 2,
          rot: -11,
          jolt: sheet,
          flare: 'rings',
          onImpact: () => go.focus({ preventScroll: true })
        });
        node.innerHTML = UI.stampSVG({ word: up.length <= 10 ? [up] : up.split(' '), upper: 'LEVEL ' + level.n, lower: UI.stampDate(stampDateOf(level.n), true) });
      };
      UI.prepFlare(true);
      setTimeout(land, UI.motionOK() ? 420 : 0);
      if (share) K.Share.prepare(level);
    });
  }

  /* ---------- The screen ---------- */
  function render(container) {
    const { UI, State, Engine } = K;
    const el = UI.el;
    const stops = [];
    let gone = false;

    const mode = !State.nextRank() ? 'done' : State.doneCount() === 0 ? 'new' : 'back';
    let won = false;
    let holding = false;
    const total = K.lessons.length;

    /* ---------- Hero, left: promise, main button, mini route, stats ---------- */
    const slipHost = el('div', { class: 'hm-cta' });
    const acctHost = el('div', { class: 'hm-acct-host' });
    const routeHost = mode === 'new' ? null : el('div', { class: 'hm-mr-host' });

    function paintSlip() {
      const cur = State.current();
      const canary = mode !== 'new' || won;
      const small = !cur ? 'Every mission cleared' : won ? 'Next' : State.doneCount() === 0 ? 'Start' : 'Continue';
      const big = cur ? 'Mission ' + cur.id + ' ' + cur.title : 'Open your finished passbook';
      const slip = el('a', { class: 'hm-slip' + (canary ? ' canary' : ''), href: cur ? '#/m/' + cur.id : '#/passbook' },
        el('span', { class: 'hm-slip-no', html: UI.dm(cur ? cur.id : String(total), { p: 3 }) }),
        el('span', { class: 'hm-slip-t' }, el('small', { text: small }), el('b', { text: big })),
        el('span', { class: 'hm-slip-a', html: UI.icons.arrow }));
      slipHost.replaceChildren(slip);
      return slip;
    }

    function paintAcct() {
      const dl = el('dl', { class: 'hm-acct', 'aria-label': mode === 'new' ? 'About this lab' : 'Your progress' });
      const cell = (label, dd, cls) => dl.append(el('div', { class: cls || null }, el('dt', { text: label }), dd));
      const done = State.doneCount();
      const saldoDd = el('dd', { html: '<span class="hm-saldo">' + UI.dm(done, { p: 3 }) + '</span><span class="vh">' + done + '</span><span class="hm-of">of ' + total + '</span>' });
      if (mode === 'new') {
        cell('Levels', el('dd', { html: UI.dm(K.levels.length, { p: 3 }) + '<span class="vh">' + K.levels.length + '</span>' }));
        cell('Saldo', saldoDd);
        cell('Account', el('dd', {}, el('b', { text: 'None needed' })));
        cell('Runs in', el('dd', {}, el('b', { text: 'This browser' })));
      } else {
        const nr = State.nextRank();
        const rankDd = el('dd', { class: 'hm-rank' }, el('b', { text: State.rank() }));
        if (nr) {
          const p = State.levelProgress(nr.level.n);
          rankDd.append(el('span', { class: 'hm-rank-next' },
            el('span', { class: 'hm-bar', 'aria-hidden': 'true' }, el('i', { style: { width: Math.round(p.done / Math.max(1, p.total) * 100) + '%' } })),
            el('span', { text: missions(nr.left) + ' to ' + nr.rank })));
        } else {
          rankDd.append(el('span', { class: 'hm-rank-next', text: 'Every level stamped' }));
        }
        cell('Rank', rankDd, 'hm-acct-rank');
        const st = State.streak();
        const week = st.last7.map((on, i) => '<i class="' + (on ? 'on' : '') + (i === 6 ? ' today' : '') + '"></i>').join('');
        cell('Streak', el('dd', { html: UI.dm(st.days, { p: 3 }) + '<span class="vh">' + st.days + (st.days === 1 ? ' day' : ' days') + '</span><span class="hm-week" aria-hidden="true">' + week + '</span>' }));
        cell('Saldo', saldoDd);
        const due = State.dueReviews().length;
        const dueDd = el('dd', { html: UI.dm(due, { p: 3 }) + '<span class="vh">' + due + '</span>' });
        dueDd.append(due
          ? el('a', { class: 'plain', href: '#/review', text: 'Review now' })
          : el('span', { text: 'today' }));
        cell('Reviews due', dueDd, 'hm-acct-due' + (due ? '' : ' is-zero'));
      }
      acctHost.replaceChildren(dl);
    }

    function paintMiniRoute() {
      if (!routeHost) return;
      routeHost.replaceChildren();
      const mr = miniRoute();
      routeHost.append(mr);
      stops.push(() => mr._stop && mr._stop());
      mr._draw();
    }

    let h1;
    if (mode === 'done') {
      h1 = el('h1', { class: 'hm-h1', id: 'hmPromise' }, el('span', { text: 'From zero to SQL pro.' }), el('span', { class: 'soft', text: 'The passbook is full,' }), el('span', { class: 'soft', text: 'and the rank is yours.' }));
    } else {
      h1 = el('h1', { class: 'hm-h1', id: 'hmPromise', html: mode === 'new'
        ? '<span>From zero</span> <span>to SQL pro,</span> <span class="soft">on a fake bank’s</span> <span class="soft">real-looking data.</span>'
        : '<span>From zero to SQL pro,</span> <span class="soft">on a fake bank’s</span> <span class="soft">real-looking data.</span>' });
    }
    /* A first visit says who the course is for, right under the promise. */
    const who = mode === 'new' ? el('p', { class: 'hm-who', text: 'For anyone starting SQL from zero. Excel helps, but you do not need it.' }) : null;
    const left = el('div', { class: 'hm-l' },
      el('p', { class: 'hm-eyebrow', html: UI.icons.shield + '<span>Bank Kenari is made up. You cannot break anything here.</span>' }),
      h1, who, slipHost, routeHost, acctHost);

    /* ---------- Hero, right: the live query, which really runs ---------- */
    const lampEl = el('span', { class: 'mc-lamp', 'aria-hidden': 'true' });
    const noteEl = el('span', { class: 'mc-note', text: 'Real SQL. It runs in this browser.' });
    const edHost = el('div', { class: 'hm-ed' });
    const helpHost = el('div', { class: 'hm-help', 'aria-live': 'polite' });
    const trEl = el('p', { class: 'hm-tr', text: 'Show every column from the table called branches.' });
    const overBtn = el('button', { type: 'button', class: 'plain hm-over', hidden: true, text: 'Start over' });
    const runBtn = el('button', { type: 'button', class: 'key' + (mode === 'new' ? ' canary' : '') + ' hm-run' }, 'Run', el('span', { class: 'kbd', text: UI.runKeys() }));
    const mc = el('div', { class: 'mc hm-mc' },
      el('div', { class: 'mc-bar' }, lampEl, el('b', { text: 'Live query' }), noteEl),
      edHost, helpHost,
      el('div', { class: 'mc-act' }, trEl, overBtn, el('span', { class: 'sp' }), runBtn),
      el('div', { class: 'slot', 'aria-hidden': 'true' }));
    const tongue = () => el('div', { class: 'paper hm-tongue', html: UI.icons.up + '<span>Press <b>Run</b>. Your result prints here.</span>' });
    const feed = el('div', { class: 'hm-feed' }, tongue());
    const right = el('div', { class: 'hm-r' }, mc, feed);

    const gl = el('div', { class: 'gl hm-gl', 'aria-hidden': 'true' });
    const weave = el('div', { class: 'weave hm-weave', 'aria-hidden': 'true' }, el('i'));
    const hero = el('section', { class: 'hm-hero', 'aria-labelledby': 'hmPromise', dataset: { mode } },
      gl, el('div', { class: 'hm-hero-in' }, left, right), weave);

    /* ---------- Phone: Home ends in two teasers, and each opens its own tab ---------- */
    const teasers = el('div', { class: 'hm-teasers' });
    let teaserStop = null;
    function paintTeasers() {
      const cur = State.current();
      const lvl = cur ? cur.level : K.levels[K.levels.length - 1];
      const p = State.levelProgress(lvl.n);
      if (teaserStop) teaserStop();
      const mr = miniRoute({ link: false });
      teaserStop = () => mr._stop && mr._stop();
      const go = () => el('span', { class: 'hm-tz-go', html: UI.icons.right });
      const jCard = el('a', { class: 'hm-tz hm-tz-j', href: '#/journey', 'aria-label': 'Open the Journey. ' + (cur ? 'You are on Level ' + lvl.n + ', ' + lvl.title + '.' : 'Every level is stamped.') },
        el('span', { class: 'hm-tz-h' }, el('b', { text: 'The journey' }), go()),
        mr,
        el('span', { class: 'hm-tz-s', text: cur ? 'Level ' + lvl.n + ', ' + lvl.title + ': ' + p.done + ' of ' + p.total + ' cleared' : 'Every level is stamped' }));
      const lines = State.passbook().filter((l) => l.kind !== 'level').slice(-2);
      const pCard = el('a', { class: 'paper hm-tz hm-tz-p', href: '#/passbook', 'aria-label': 'Open your passbook. Saldo ' + State.doneCount() + '.' },
        el('span', { class: 'hm-tz-h' }, el('b', { text: 'Your passbook' }), go()),
        lines.length
          ? el('span', { class: 'hm-tz-lines' }, lines.map((l) => el('span', { class: 'hm-tz-l' },
            el('span', { class: 'hm-tz-d', text: UI.stampDate(l.date, true).slice(0, 6) }),
            el('span', { class: 'hm-tz-t' }, el('b', { text: l.id }), ' ' + l.title),
            el('span', { class: 'hm-tz-b', text: String(l.balance) }))))
          : el('span', { class: 'hm-tz-s', text: 'Each cleared mission prints a line here.' }),
        el('span', { class: 'hm-tz-eoe' }, el('span', { text: 'E. & O.E.' }), el('span', { class: 'hm-tz-saldo', text: 'Saldo ' + State.doneCount() })));
      teasers.replaceChildren(jCard, pCard);
      mr._draw();
    }
    stops.push(() => teaserStop && teaserStop());

    /* ---------- Journey ---------- */
    const journey = el('section', { class: 'hm-sec hm-journey', id: 'journey', 'aria-labelledby': 'hmJh' });
    const passbook = el('section', { class: 'hm-sec hm-passbook', id: 'passbook', 'aria-labelledby': 'hmPh' });
    const routeBox = { el: null, stop: null };

    function paintJourney() {
      if (routeBox.stop) routeBox.stop();
      const levels = K.levels;
      const here = hereIndex();
      const word = NUM_WORDS[levels.length] || String(levels.length);
      const head = el('div', { class: 'hm-sec-head' },
        el('h2', { id: 'hmJh', text: 'The journey' }),
        el('p', { text: word + ' levels and ' + total + ' missions, from ' + levels[0].rank + ' to ' + levels[levels.length - 1].rank + '. Nothing is locked, so jump to any level you like.' }));

      /* Route */
      const ribbon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ribbon.setAttribute('class', 'hm-ribbon');
      ribbon.setAttribute('aria-hidden', 'true');
      const tearMark = el('span', { class: 'hm-route-tear', 'aria-hidden': 'true', html: SCISSORS });
      const stations = levels.map((L, i) => {
        const p = State.levelProgress(L.n);
        const cleared = levelCleared(L);
        const pct = Math.round(p.done / Math.max(1, p.total) * 100);
        const target = levelTarget(L);
        const medal = el('span', { class: 'hm-medal', html: UI.rosette(L.n, 100) });
        if (!cleared && p.done > 0) {
          medal.insertAdjacentHTML('beforeend', '<svg class="hm-ring" viewBox="-52 -52 104 104" aria-hidden="true"><circle r="50.6" pathLength="100" stroke-dasharray="' + pct + ' 100" transform="rotate(-90)"/></svg>');
        }
        if (cleared) {
          medal.insertAdjacentHTML('beforeend', '<span class="hm-medal-st">' + UI.rankStamp(L, stampDateOf(L.n)) + '</span>');
        } else {
          medal.append(el('span', { class: 'hm-medal-c', html: '<span class="hm-medal-dm">' + UI.dm(L.n, { p: 3 }) + '</span><span class="hm-medal-mono">' + L.n + '</span>' }));
        }
        const a = el('a', {
          class: 'hm-stn' + (cleared ? ' done' : '') + (i === here ? ' here' : '') + (i === levels.length - 1 ? ' goal' : ''),
          href: '#/m/' + target.id,
          'aria-label': 'Level ' + L.n + ', ' + L.title + '. Rank: ' + L.rank + '. ' + p.done + ' of ' + p.total + ' missions cleared.' + (i === here ? ' You are here.' : '')
        }, medal,
        i === here ? el('span', { class: 'hm-here', html: UI.icons.pin + 'You are here' }) : null,
        el('span', { class: 'hm-stn-l' }, el('b', { text: L.rank }), el('span', { text: cleared ? 'Stamped' : p.done + ' of ' + p.total })));
        return a;
      });
      const route = el('div', { class: 'hm-route' }, ribbon, tearMark, stations);

      const layoutRoute = () => {
        const W = route.clientWidth;
        if (!W) return;
        const single = W >= 640;
        const labels = W >= 900;
        route.classList.toggle('labels', labels);
        route.classList.toggle('single', single);
        const pts = [];
        let height;
        let m;
        if (single) {
          m = Math.min(92, Math.max(50, (W / 10.4) * 0.76));
          const big = m * 1.18;
          const step = (W - big) / (levels.length - 1 + (labels ? 0.18 : 0));
          const riseTotal = Math.min(84, W * 0.07);
          const topPad = 40 + (big - m) / 2;
          const labelRoom = labels ? 66 : 16;
          height = topPad + riseTotal + m + labelRoom;
          levels.forEach((L, i) => pts.push([big / 2 + i * step - (i === levels.length - 1 ? 0 : 0), topPad + m / 2 + riseTotal * (1 - i / (levels.length - 1))]));
          const mid = (pts[3][0] + pts[4][0]) / 2;
          tearMark.style.left = mid + 'px';
          tearMark.style.top = '0px';
          tearMark.style.height = height + 'px';
        } else {
          /* Phones: a switchback, so every station keeps a real tap target. */
          const half = Math.ceil(levels.length / 2);
          const cell = W / half;
          m = Math.min(60, cell * 0.84);
          const pad = 34;
          const gap = 40;
          height = pad + m * 2 + gap + pad - 18;
          const yLow = pad + m + gap + m / 2;
          const yHigh = pad + m / 2;
          levels.forEach((L, i) => {
            if (i < half) pts.push([cell * (i + 0.5), yLow]);
            else pts.push([cell * (levels.length - 1 - i + 0.5), yHigh]);
          });
          tearMark.style.left = '';
        }
        route.style.height = Math.ceil(height) + 'px';
        route.style.setProperty('--m', m + 'px');
        route.style.setProperty('--step', (single ? (W - m * 1.18) / (levels.length - 1) : W / 5) + 'px');
        stations.forEach((a, i) => {
          a.style.left = pts[i][0].toFixed(1) + 'px';
          a.style.top = pts[i][1].toFixed(1) + 'px';
        });
        drawRibbon(ribbon, pts, W, height, here < 0 ? levels.length - 1 : here, single);
      };

      /* Detail list */
      const row = (L, i) => {
        const p = State.levelProgress(L.n);
        const cleared = levelCleared(L);
        const target = levelTarget(L);
        const pips = Array.from({ length: p.total }, (_, k) => '<i' + (k < p.done ? ' class="on"' : '') + '></i>').join('');
        const medal = el('span', { class: 'hm-jl-medal', html: UI.rosette(L.n, 72) });
        if (cleared) medal.insertAdjacentHTML('beforeend', '<span class="hm-medal-st" style="--rot:' + STAMP_ROT[i % STAMP_ROT.length] + 'deg">' + UI.rankStamp(L, stampDateOf(L.n)) + '</span>');
        else medal.append(el('span', { class: 'hm-medal-c', html: '<span class="hm-medal-mono">' + L.n + '</span>' }));
        return el('li', { class: 'hm-jl-row' + (cleared ? ' done' : '') + (i === here ? ' here' : '') },
          el('a', { href: '#/m/' + target.id },
            medal,
            el('span', { class: 'hm-jl-b' },
              i === here ? el('span', { class: 'hm-here inline', html: UI.icons.pin + 'You are here' }) : null,
              el('span', { class: 'hm-jl-top', text: 'Level ' + L.n + ', ' + missions(p.total) }),
              el('span', { class: 'hm-jl-title', text: L.title }),
              el('span', { class: 'hm-jl-rank', html: (cleared ? 'Rank earned: ' : 'Rank: ') + '<b>' + UI.esc(L.rank) + '</b>' }),
              el('span', { class: 'hm-jl-tag', text: L.tagline }),
              el('span', { class: 'hm-jl-prog' },
                el('span', { class: 'hm-pips', 'aria-hidden': 'true', html: pips }),
                el('span', { class: 'hm-bar hm-jl-bar', 'aria-hidden': 'true' }, el('i', { style: { width: Math.round(p.done / Math.max(1, p.total) * 100) + '%' } })),
                el('span', { text: p.done + ' of ' + p.total })))));
      };
      const groupA = levels.filter((L) => L.n <= 3);
      const groupB = levels.filter((L) => L.n > 3);
      const lastA = groupA.length ? groupA[groupA.length - 1].n : 3;
      const firstRange = levels[0].n + ' to ' + lastA;
      const list = el('div', { class: 'hm-jl' },
        el('ol', { class: 'hm-jl-g' }, groupA.map((L) => row(L, levels.indexOf(L)))),
        el('p', { class: 'hm-tear', html: SCISSORS + '<span>Levels ' + firstRange + ' are enough to read most everyday queries.</span>' }),
        el('ol', { class: 'hm-jl-g', start: groupA.length }, groupB.map((L) => row(L, levels.indexOf(L)))));

      journey.replaceChildren(head, route, list);
      routeBox.el = route;
      layoutRoute();
      let ro = null;
      if (window.ResizeObserver) {
        ro = new ResizeObserver(layoutRoute);
        ro.observe(route);
      }
      routeBox.stop = () => { if (ro) ro.disconnect(); };
      stops.push(() => routeBox.stop && routeBox.stop());
      if (pauseIO) pauseIO.observe(route);
    }

    function drawRibbon(svg, pts, W, H, doneIx, wide) {
      const STEPS = 34;
      const samples = catmull(pts, STEPS);
      const STRANDS = 5;
      const A = wide && W > 800 ? 12 : 7;
      const lambda = wide && W > 800 ? 112 : 70;
      const doneTo = doneIx * STEPS;
      const done = Array.from({ length: STRANDS }, () => '');
      const rest = Array.from({ length: STRANDS }, () => '');
      let arc = 0;
      for (let i = 0; i < samples.length; i++) {
        const a = samples[Math.max(i - 1, 0)], b = samples[Math.min(i + 1, samples.length - 1)];
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
        if (i) arc += Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]);
        const nx = -dy / len, ny = dx / len;
        for (let k = 0; k < STRANDS; k++) {
          const off = A * Math.sin(TAU * arc / lambda + k / STRANDS * TAU) + 2.4 * Math.sin(TAU * arc / (lambda / 3) - 2 * k / STRANDS * TAU);
          const x = (samples[i][0] + nx * off).toFixed(1), y = (samples[i][1] + ny * off).toFixed(1);
          if (i <= doneTo) done[k] += (done[k] ? 'L' : 'M') + x + ' ' + y;
          if (i >= doneTo) rest[k] += (rest[k] ? 'L' : 'M') + x + ' ' + y;
        }
      }
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.innerHTML = '<g fill="none">' + rest.map((d) => '<path d="' + d + '" stroke="var(--ribbon-rest)" stroke-width="1"/>').join('')
        + (doneIx > 0 ? done.map((d) => '<path d="' + d + '" stroke="var(--ribbon-done)" stroke-width="1.2"/>').join('') : '') + '</g>';
    }

    /* ---------- Passbook ---------- */
    let shownLines = State.passbook().length;
    let pageIx = null;
    let finishedView = 'closing';

    function dateCell(date) {
      const full = UI.stampDate(date, true);
      const short = full.slice(0, 6);
      return '<span class="hm-d-dm">' + UI.dm(short, { p: 3 }) + '</span><span class="hm-d-mono" aria-hidden="true">' + short + '</span><span class="vh">' + full + '</span>';
    }

    function ledgerPageRows(lines, pages, ix) {
      const page = pages[ix] || [];
      const last = ix === pages.length - 1;
      const before = ix === 0 ? 0 : (() => {
        let bal = 0;
        for (let k = 0; k < ix; k++) pages[k].forEach((l) => { bal = l.balance; });
        return bal;
      })();
      let lastBalIdx = -1;
      page.forEach((l, i) => { if (l.kind !== 'level') lastBalIdx = i; });
      let html = '<tr class="bf"><td></td><td class="t">BALANCE B/F</td><td class="r cr"></td><td class="r bal">' + UI.dm(before, { p: 3 }) + '<span class="vh">' + before + '</span></td></tr>';
      page.forEach((l, i) => {
        const fresh = last && i === page.length - 1 && lines.length > shownLines;
        if (l.kind === 'level') {
          html += '<tr class="note' + (fresh ? ' newl' : '') + '"><td>' + dateCell(l.date) + '</td><td class="t">Interest: rank ' + UI.esc(l.rank) + '</td><td class="r cr"></td><td class="r bal"></td></tr>';
        } else {
          const lastBal = last && i === lastBalIdx;
          html += '<tr class="' + (fresh ? 'newl' : '') + '"><td>' + dateCell(l.date) + '</td><td class="t"><b>' + UI.esc(l.id) + '</b> ' + UI.esc(l.title) + '</td><td class="r cr">' + UI.dm('+1', { p: 3 }) + '<span class="vh">plus one</span></td><td class="r bal' + (lastBal ? ' dbl' : '') + '">' + UI.dm(l.balance, { p: 3 }) + '<span class="vh"> balance ' + l.balance + '</span></td></tr>';
        }
      });
      if (last) {
        const cur = State.current();
        const nextText = cur ? 'Clear Mission ' + cur.id + ' to print the next line.' : 'Every line is printed.';
        html += '<tr class="nextl"><td></td><td class="t" colspan="3">' + UI.esc(nextText) + '</td></tr>';
      }
      const used = page.length + 1 + (last ? 1 : 0);
      for (let i = used; i < LINES_PER_PAGE + 2; i++) html += '<tr class="blank"><td>&nbsp;</td><td></td><td class="cr"></td><td></td></tr>';
      return html;
    }

    function ledgerPage(onTurn) {
      const lines = State.passbook();
      const pages = [];
      for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE));
      if (!pages.length) pages.push([]);
      if (pageIx == null || pageIx > pages.length - 1) pageIx = pages.length - 1;
      const pageNode = el('div', { class: 'hm-pg hm-pg-l' });
      pageNode.innerHTML = '<svg class="hm-under" aria-hidden="true"><use href="#hm-ros-big"/></svg>'
        + '<div class="hm-pg-head"><h3 lang="id">Buku tabungan misi<small lang="en">Mission passbook</small></h3><p class="hm-pg-acct">Account <b>0000-0001-2026</b><br>Branch <b>KC Jakarta Sudirman</b></p></div>'
        + '<table class="hm-pb"><thead><tr><th scope="col"><span lang="id">Tanggal</span><small>Date</small></th><th scope="col"><span lang="id">Keterangan</span><small>Particulars</small></th><th scope="col" class="r cr"><span lang="id">Kredit</span><small>Credit</small></th><th scope="col" class="r"><span lang="id">Saldo</span><small>Balance</small></th></tr></thead><tbody>'
        + ledgerPageRows(lines, pages, pageIx) + '</tbody></table>';
      const foot = el('div', { class: 'hm-pb-foot' },
        el('div', { class: 'hm-pb-eoe' }, el('span', { text: 'E. & O.E.' }), el('span', { text: 'TOTAL DEBITS 0. CLEARED MISSIONS STAY CLEARED.' })));
      if (pages.length > 1) {
        const prev = el('button', { type: 'button', class: 'tlink', disabled: pageIx === 0, html: UI.icons.left + 'Earlier page', onClick: () => { pageIx--; onTurn(); } });
        const next = el('button', { type: 'button', class: 'tlink', disabled: pageIx === pages.length - 1, html: 'Later page' + UI.icons.right, onClick: () => { pageIx++; onTurn(); } });
        foot.prepend(el('div', { class: 'hm-pb-pager' }, prev, el('span', { text: 'Page ' + (pageIx + 1) + ' of ' + pages.length }), next));
      }
      foot.append(el('div', { class: 'hm-micro', 'aria-hidden': 'true', text: MICRO }));
      pageNode.append(foot);
      return pageNode;
    }

    function stampSlots() {
      return el('div', { class: 'hm-slots' }, K.levels.map((L, i) => {
        const got = levelCleared(L);
        const goal = i === K.levels.length - 1;
        const nodes = [];
        const g = el('div', { class: 'hm-slot-g', html: UI.rosette(L.n, 100) });
        if (got) g.insertAdjacentHTML('beforeend', '<span class="hm-slot-st" style="--rot:' + STAMP_ROT[i % STAMP_ROT.length] + 'deg">' + UI.rankStamp(L, stampDateOf(L.n)) + '</span>');
        else g.append(el('span', { class: 'hm-slot-n', html: UI.dm(L.n, { p: 3 }) }));
        g.append(el('span', { class: 'vh', text: 'Level ' + L.n + (got ? ', stamped.' : ', not stamped yet.') }));
        nodes.push(g);
        if (goal) {
          nodes.push(el('span', { class: 'hm-slot-cap' }, el('b', { text: L.rank }), got ? 'Level ' + L.n + ' cleared, and the rank is yours.' : 'Clearing Level ' + L.n + ' earns the final rank and closes this book.'));
        } else {
          nodes.push(el('span', { class: 'hm-slot-cap', text: L.rank }));
        }
        return el('div', { class: 'hm-slot' + (got ? ' got' : '') + (goal ? ' goal' : '') }, nodes);
      }));
    }

    function stampsPage(title, sub, line) {
      const pg = el('div', { class: 'hm-pg hm-pg-r', html: '<svg class="hm-under" aria-hidden="true"><use href="#hm-ros-big"/></svg>' });
      pg.append(el('div', { class: 'hm-pg-head' }, el('h3', { lang: 'id' }, title, el('small', { lang: 'en', text: sub }))));
      pg.append(el('p', { class: 'hm-rankline', html: line }));
      pg.append(stampSlots());
      pg.append(el('div', { class: 'hm-pb-foot' }, el('div', { class: 'hm-micro', 'aria-hidden': 'true', text: MICRO })));
      return pg;
    }

    function rankLineHtml() {
      const nr = State.nextRank();
      const rank = State.rank();
      if (!nr) return 'Rank: <b>' + UI.esc(rank) + '</b>. Every level is stamped.';
      if (rank === 'Newcomer') return 'No rank yet. <b>' + UI.esc(nr.rank) + '</b> comes after Level ' + nr.level.n + ', ' + missions(nr.left) + ' away.';
      return 'Rank now: <b>' + UI.esc(rank) + '</b>. Next: <b>' + UI.esc(nr.rank) + '</b>, ' + missions(nr.left) + ' away.';
    }

    function closingPage() {
      const lines = State.passbook();
      const missionLines = lines.filter((l) => l.kind !== 'level');
      const opened = lines.length ? lines[0].date : State.today();
      const closed = lines.length ? lines[lines.length - 1].date : State.today();
      const lastL = K.levels[K.levels.length - 1];
      const pg = el('div', { class: 'hm-pg hm-pg-l hm-closing', html: '<svg class="hm-under" aria-hidden="true"><use href="#hm-ros-big"/></svg>' });
      pg.append(el('div', { class: 'hm-pg-head' },
        el('h3', { lang: 'id' }, 'Buku tabungan misi', el('small', { lang: 'en', text: 'Mission passbook, completed' })),
        el('p', { class: 'hm-pg-acct', html: 'Account <b>0000-0001-2026</b><br>Branch <b>KC Jakarta Sudirman</b>' })));
      const input = el('input', {
        class: 'hm-name', id: 'hmName', type: 'text', maxlength: '60', autocomplete: 'off', spellcheck: 'false',
        value: readName(), placeholder: 'Write your name here',
        onInput: (e) => saveName(e.target.value)
      });
      pg.append(el('div', { class: 'hm-namebox' },
        el('label', { for: 'hmName', text: 'This passbook belongs to' }),
        input,
        el('p', { text: 'Your name stays on this device. Nothing is sent anywhere.' })));
      const big = el('div', { class: 'hm-closing-st', html: UI.stampSVG({ word: [String(lastL.rank).toUpperCase()], upper: 'LEVEL ' + lastL.n, lower: UI.stampDate(stampDateOf(lastL.n), true) }) });
      const sum = el('table', { class: 'hm-sum', html:
        '<tbody><tr><th scope="row">Opened</th><td>' + UI.esc(UI.stampDate(opened)) + '</td></tr>'
        + '<tr><th scope="row">Closed</th><td>' + UI.esc(UI.stampDate(closed)) + '</td></tr>'
        + '<tr><th scope="row">Queries run</th><td>' + State.queryCount().toLocaleString('en-US') + '</td></tr>'
        + '<tr><th scope="row">Total debits</th><td>0</td></tr>'
        + '<tr class="final"><th scope="row">Saldo</th><td>' + UI.dm(missionLines.length || State.doneCount(), { p: 4 }) + '<span class="vh">' + State.doneCount() + '</span></td></tr></tbody>' });
      pg.append(el('div', { class: 'hm-closing-mid' }, sum, big));
      pg.append(el('p', { class: 'hm-closing-line', text: 'Bank Kenari is made up. This rank is yours.' }));
      pg.append(el('div', { class: 'hm-closing-act hm-noprint' },
        el('button', { type: 'button', class: 'tlink', text: 'See every printed line', onClick: () => { finishedView = 'ledger'; paintPassbook(); } }),
        el('button', { type: 'button', class: 'tlink', text: 'Print this passbook', onClick: () => window.print() })));
      pg.append(el('div', { class: 'hm-pb-foot' },
        el('div', { class: 'hm-pb-eoe' }, el('span', { text: 'E. & O.E.' }), el('span', { text: 'TOTAL DEBITS 0. CLEARED MISSIONS STAY CLEARED.' })),
        el('div', { class: 'hm-micro', 'aria-hidden': 'true', text: MICRO })));
      return pg;
    }

    function paintPassbook() {
      ensureUnderprint();
      const finished = !State.nextRank();
      const head = el('div', { class: 'hm-sec-head hm-noprint' },
        el('h2', { id: 'hmPh', text: finished ? 'Your completed passbook' : 'Your passbook' }),
        el('p', { text: finished ? 'Every mission is on a line, and every level has its stamp. Add your name and keep it.' : 'Each cleared mission prints a line. Each cleared level earns a stamp and a rank.' }));

      const leftPage = finished && finishedView === 'closing' ? closingPage() : ledgerPage(paintPassbook);
      if (finished && finishedView === 'ledger') {
        const foot = leftPage.querySelector('.hm-pb-foot');
        foot.prepend(el('div', { class: 'hm-pb-pager' }, el('button', { type: 'button', class: 'tlink', text: 'Back to the closing page', onClick: () => { finishedView = 'closing'; paintPassbook(); } })));
      }
      const rightPage = stampsPage('Cap per level', 'Level stamps', rankLineHtml());

      const cover = el('div', { class: 'hm-cover', 'aria-hidden': 'true', html:
        '<div class="hm-cover-t"><span lang="id">Buku tabungan misi</span></div>'
        + '<svg class="hm-cover-r"><use href="#hm-ros-big"/></svg>'
        + '<div class="hm-cover-t"><b>Bank Kenari</b><small lang="id">Bank fiktif</small></div>' });
      const leaf = el('div', { class: 'hm-leaf' }, el('div', { class: 'hm-leaf-in' }, leftPage), cover);
      const book = el('div', { class: 'hm-book' + (finished ? ' finished' : '') },
        leaf,
        el('div', { class: 'hm-bk-r' }, rightPage),
        el('div', { class: 'hm-gutter', 'aria-hidden': 'true' }));

      passbook.replaceChildren(head, book);
      shownLines = State.passbook().length;
      return { book, leaf };
    }

    /* ---------- Foot ---------- */
    const foot = el('footer', { class: 'hm-foot' },
      el('div', { class: 'weave rev', 'aria-hidden': 'true' }, el('i')),
      el('p', { text: 'Bank Kenari is made up. Every name, loan and phone number here is invented. Your queries run only in this browser, and no account is needed.' }));

    /* Animations stop when they are off-screen. */
    let pauseIO = null;
    if ('IntersectionObserver' in window) {
      pauseIO = new IntersectionObserver((entries) => {
        entries.forEach((en) => en.target.classList.toggle('hm-off', !en.isIntersecting));
      }, { rootMargin: '60px' });
      pauseIO.observe(hero);
      stops.push(() => pauseIO.disconnect());
    }

    const root = el('div', { class: 'hm' }, hero, teasers, journey, passbook, foot);
    container.append(root);

    paintSlip();
    paintAcct();
    paintMiniRoute();
    paintTeasers();
    paintJourney();
    const firstBook = paintPassbook();

    /* ---------- The editor ---------- */
    const ed = K.Editor.create(edHost, {
      id: 'home-live',
      value: STARTER,
      lines: { min: 1, max: 6 },
      autocomplete: true,
      /* Below 1000px the key bar brings its own Run key, so Run is never cut by the keyboard. */
      keybar: !UI.isWide(),
      runKey: !UI.isWide(),
      label: 'Live SQL query',
      onRun: () => runHero(),
      onInput: () => {
        clearHelp();
        const same = ed.value.trim() === STARTER;
        trEl.hidden = !same;
        overBtn.hidden = same;
      }
    });
    stops.push(() => { try { ed.destroy(); } catch (e) { /* already gone */ } });
    if (ed.refresh) requestAnimationFrame(() => { if (!gone) ed.refresh(); });
    /* On a phone, the hero is hidden on the Journey and Passbook tabs, so the editor measures again on the way back. */
    const onSection = () => { if (!gone && ed.refresh) ed.refresh(); };
    document.addEventListener('kenari:section', onSection);
    stops.push(() => document.removeEventListener('kenari:section', onSection));

    overBtn.addEventListener('click', () => {
      if (ed.replaceAll) ed.replaceAll(STARTER);
      else ed.value = STARTER;
      clearHelp();
      trEl.hidden = false;
      overBtn.hidden = true;
      resetFeed();
      ed.focus();
    });
    runBtn.addEventListener('click', () => runHero());

    /* ---------- Engine status ---------- */
    let waitingForEngine = false;
    const paintStatus = (s) => {
      if (s === 'loading') {
        noteEl.textContent = 'Warming up the database';
        lampEl.dataset.state = 'busy';
      } else if (s === 'failed') {
        noteEl.textContent = 'The database did not load';
        lampEl.dataset.state = 'help';
      } else {
        noteEl.textContent = 'Real SQL. It runs in this browser.';
        if (!running) lampEl.dataset.state = '';
      }
    };
    let running = false;
    if (Engine && Engine.onStatus) {
      paintStatus(Engine.status);
      stops.push(Engine.onStatus(paintStatus));
    }

    /* ---------- Running the hero query ---------- */
    let currentLedger = null;
    let printing = false;
    let finishEarly = null;

    function clearHelp() { helpHost.replaceChildren(); }
    function resetFeed() {
      currentLedger = null;
      feed.classList.remove('printed');
      feed.replaceChildren(tongue());
    }

    /** Where the help slip's pointer goes: the marked word, inside the terminal. */
    function pointerFor() {
      const rect = ed.markedRect ? ed.markedRect() : null;
      if (!rect) return 60;
      const box = helpHost.getBoundingClientRect();
      return Math.max(18, Math.min(box.width - 44, rect.left + rect.width / 2 - box.left - 12));
    }

    function showHelpSlip(parts) {
      lampEl.dataset.state = 'help';
      const slip = el('div', { class: 'helpslip hm-slip-help', style: { '--ax': (parts.ax || 60) + 'px' } });
      slip.append(el('h3', { text: parts.title }));
      if (parts.plain) slip.append(UI.rich(parts.plain));
      if (parts.tips && parts.tips.length) {
        const ul = el('ul', { class: 'vband-tips' });
        parts.tips.forEach((t) => ul.append(el('li', {}, UI.rich(t, { inline: true }))));
        slip.append(ul);
      }
      if (parts.action) slip.append(el('div', { class: 'help-act' }, parts.action));
      slip.append(el('p', { class: 'help-sub' }, parts.note ? UI.rich(parts.note, { inline: true }) : 'Nothing broke. Every Run starts from a clean copy of the data.'));
      if (parts.raw) slip.append(el('p', { class: 'help-raw', text: 'The database said: ' + parts.raw }));
      helpHost.replaceChildren(slip);
      UI.anim(slip, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
      UI.announce(parts.title);
    }

    function band(title, bodyHtml, withSpot) {
      const main = el('div', {},
        el('p', { class: 'vband-title', text: title }),
        bodyHtml ? el('div', { class: 'vband-body' }, UI.rich(bodyHtml, { inline: true })) : null);
      const b = el('div', { class: 'vband hm-band', dataset: { state: 'pass' } }, main);
      if (withSpot) b.append(el('div', { class: 'hm-spot', 'aria-hidden': 'true' }));
      return b;
    }

    /** On a phone, the page moves so the paper is in view, just under the header. */
    function revealPaper() {
      if (UI.isWide()) return;
      const topH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 48;
      /* Measured from the feed, because the paper itself is mid-animation. */
      window.scrollTo({ top: feed.getBoundingClientRect().top + window.scrollY - topH - 8, behavior: UI.motionOK() ? 'smooth' : 'auto' });
    }

    /** Line-feed: the paper comes down out of the slot in steps, while its rows print. */
    function printPaper(node, led) {
      feed.replaceChildren(node);
      currentLedger = led || null;
      if (!UI.motionOK()) return;
      const h = node.getBoundingClientRect().height;
      UI.anim(node, [{ transform: 'translateY(' + -Math.max(0, h - 40) + 'px)' }, { transform: 'none' }], { duration: 520, easing: 'steps(12, end)' });
    }

    async function runHero() {
      if (running || gone) return;
      if (printing) { if (finishEarly) finishEarly(); return; }
      running = true;
      runBtn.classList.add('used');
      if (!UI.isWide() && ed.blur) ed.blur();
      UI.announce('');
      clearHelp();
      if (ed.clearError) ed.clearError();
      const sql = ed.value;
      lampEl.dataset.state = 'busy';
      resetFeed();
      const lesson = K.lessonById(FIRST_ID);
      let r;
      waitingForEngine = Engine.status !== 'ready';
      if (waitingForEngine) noteEl.textContent = 'Warming up the database. Your Run is in the queue.';
      try {
        r = await K.evaluate(lesson, sql);
      } catch (e) {
        r = { kind: 'engine', message: (e && e.message) || 'The database could not answer. Reload the page to try again.' };
      }
      waitingForEngine = false;
      running = false;
      if (gone) return;
      paintStatus(Engine.status);
      if (Engine.status === 'ready') lampEl.dataset.state = '';
      if (r.kind !== 'blanks' && r.kind !== 'empty') State.bumpQueries();

      if (r.kind === 'empty') {
        overBtn.hidden = false;
        showHelpSlip({ title: 'The editor is empty', plain: 'There is no query to run yet. Press <b>Start over</b> to bring the first query back, or type your own.', ax: 60 });
        return;
      }
      if (r.kind === 'blanks') {
        lampEl.dataset.state = 'todo';
        showHelpSlip({ title: 'Fill in the blanks first', plain: 'The yellow boxes are waiting for you. Your cursor is in the first one.', ax: 60 });
        ed.selectFirstBlank();
        return;
      }
      if (r.kind === 'timeout') {
        showHelpSlip({ title: 'That query took too long', plain: r.message, tips: r.tips, ax: 60 });
        return;
      }
      if (r.kind === 'engine') {
        const retry = el('button', { type: 'button', class: 'fixbtn', text: 'Try loading it again', onClick: () => { clearHelp(); Engine.retry(); } });
        showHelpSlip({ title: 'The database could not load', plain: r.message, action: retry, note: 'Your progress is safe.', ax: 60 });
        return;
      }
      if (r.kind === 'error') {
        showError(r.error);
        return;
      }

      /* It ran. */
      const pass = r.verdict && r.verdict.state === 'pass';
      const firstWin = pass && !State.isDone(FIRST_ID);
      if (firstWin) { win(r, sql); return; }
      showResult(r, sql, pass);
    }

    function showError(error) {
      const e = error || {};
      if (e.token) ed.markError(e.token);
      let action = null;
      if (e.fix && e.fix.to) {
        const from = e.fix.from || e.token;
        action = el('button', { type: 'button', class: 'fixbtn', html: 'Change <code>' + UI.esc(from) + '</code> to <code>' + UI.esc(e.fix.to) + '</code>', onClick: () => {
          if (!(ed.replaceMarked && ed.replaceMarked(e.fix.to))) ed.value = ed.value.replace(from, e.fix.to);
          clearHelp();
          lampEl.dataset.state = '';
          trEl.hidden = ed.value.trim() !== STARTER;
          overBtn.hidden = !trEl.hidden;
          ed.focus();
        } });
      }
      overBtn.hidden = false;
      trEl.hidden = true;
      showHelpSlip({ title: e.title || 'The database did not understand that', plain: e.plain, tips: e.tips, action, note: e.note, raw: e.raw, ax: pointerFor() });
    }

    function ledgerFor(r, opts) {
      const list = r.results || [];
      const last = list[list.length - 1];
      return UI.ledger(last, Object.assign({
        animate: true,
        label: 'Result of your live query',
        title: list.length > 1 ? 'Result ' + list.length + ' of ' + list.length + ', the last one' : null
      }, opts || {}));
    }

    function showResult(r, sql, pass) {
      const list = r.results || [];
      const last = list[list.length - 1];
      let title, body;
      if (r.changeNote) {
        title = 'That ran on a throwaway copy.';
        body = r.changeNote;
      } else if (!last) {
        title = 'It ran, and no table came back.';
        body = 'That kind of query does its work without printing rows.';
      } else if (/\bcollectors\b/i.test(sql) && last.rows.length) {
        title = 'One word, a whole different table.';
        body = 'You changed the word after <code>FROM</code> and got ' + rows(last.rows.length) + ' from <code>collectors</code>. That was real too.';
      } else if (!last.rows.length) {
        title = 'It ran, and no rows matched.';
        body = 'The query is fine. Nothing in the data fits what it asks for.';
      } else if (pass) {
        title = rows(last.rows.length) + ' came back.';
        body = 'That was a real query. Change the table after <code>FROM</code> and run it again, or carry on with your missions.';
      } else {
        title = rows(last.rows.length) + ' came back from the made-up bank.';
        body = 'Your own query, run on a clean copy of the data.';
      }
      const b = band(title, body, false);
      if (!last) {
        const sheet = el('div', { class: 'paper ledger hm-noresult' }, b);
        printPaper(sheet, null);
        UI.announce(title);
        feed.classList.add('printed');
        revealPaper();
        return;
      }
      const led = ledgerFor(r);
      led.prepend(b);
      printPaper(led, led);
      revealPaper();
      led.printed.then(() => { if (!gone) feed.classList.add('printed'); });
      UI.announce(title);
      trEl.hidden = ed.value.trim() !== STARTER;
      overBtn.hidden = !trEl.hidden;
    }

    /* The first Run is a real win: rows, stamp, Mission 0.1 cleared, Saldo 1, next step. */
    function win(r, sql) {
      const lesson = K.lessonById(FIRST_ID);
      State.recordAttempt(FIRST_ID, r.verdict);
      holding = true;
      K.Header.hold();
      const outcome = State.recordPass(FIRST_ID);
      ed.readOnly = true;
      printing = true;

      const b = band('That was a real query.', 'Now change <code>branches</code> to <code>collectors</code>.', true);
      b.classList.add('hm-band-wait');
      const lineEl = el('p', { class: 'vband-line', html: '<span class="hm-line-d">' + UI.esc(UI.stampDate(State.today(), true)) + '  </span>' + UI.esc(lesson.id + ' ' + lesson.title) + '  +1  Saldo ' + outcome.balance });
      b.firstChild.append(lineEl);
      const led = ledgerFor(r);
      led.prepend(b);
      printPaper(led, led);
      led.scroller.focus({ preventScroll: true });

      const fast = (e) => {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        if (e.type === 'keydown') e.preventDefault();
        led.finish();
      };
      finishEarly = () => led.finish();
      document.addEventListener('keydown', fast, true);
      led.addEventListener('click', fast);

      led.printed.then(() => {
        document.removeEventListener('keydown', fast, true);
        led.removeEventListener('click', fast);
        finishEarly = null;
        if (gone) { K.Header.release(); return; }
        const paperW = led.getBoundingClientRect().width;
        const size = paperW < 430 ? 108 : paperW < 620 ? 118 : 128;
        const spot = b.querySelector('.hm-spot');
        if (spot) spot.style.width = (size - 6) + 'px';
        /* When columns run off a narrow sheet, the stamp stays inside the band, so it covers no column name either. */
        const tag = led.querySelector('.lg-morecols');
        if (tag && !tag.hidden) b.style.minHeight = Math.round(size * 0.94) + 'px';
        const bandH = b.getBoundingClientRect().height;
        UI.stamp(led, {
          mission: lesson.id,
          size,
          right: paperW < 430 ? 4 : 12,
          top: Math.max(2, (bandH - size) / 2 + 6),
          jolt: led,
          onImpact: () => {
            holding = false;
            won = true;
            K.Header.release();
            b.classList.remove('hm-band-wait');
            UI.jolt(mc, 0.25);
            ed.readOnly = false;
            printing = false;
            feed.classList.add('printed');
            runBtn.classList.remove('canary');
            paintAcct();
            const slip = paintSlip();
            paintTeasers();
            paintJourney();
            paintPassbook();
            UI.anim(slip, [{ transform: 'translateY(4px)', opacity: .4 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'ease-out' });
            slip.focus({ preventScroll: true });
            UI.announce('Stamped. Mission ' + lesson.id + ' cleared. Saldo ' + outcome.balance + '. That was a real query. Now change branches to collectors.');
            /* On a phone, bring the stamped paper and the next button into view together. */
            revealPaper();
            if (outcome.levelCleared) setTimeout(() => { if (!gone) rankUp(outcome.levelCleared); }, 1400);
          }
        });
      });
    }

    /* ---------- Security print and the UV lamp ---------- */
    const glSize = window.innerWidth < 760 ? 720 : Math.round(Math.min(1300, Math.max(980, window.innerWidth * 0.82)));
    const guil = UI.guilloche(gl, glSize, { uv: true });
    stops.push(() => guil.destroy());
    const lampOK = !UI.coarse() && UI.motionOK() && matchMedia('(hover: hover)').matches;
    let sweep = 0;
    let lampRaf = 0;
    if (lampOK && guil.uvWrap) {
      const wrap = guil.uvWrap;
      let px = 0, py = 0;
      const place = (x, y) => { gl.style.setProperty('--mx', x + 'px'); gl.style.setProperty('--my', y + 'px'); };
      const move = (e) => {
        if (e.pointerType === 'touch') return;
        const r = hero.getBoundingClientRect();
        px = e.clientX - r.left;
        py = e.clientY - r.top;
        if (sweep) { cancelAnimationFrame(sweep); sweep = 0; }
        if (lampRaf) return;
        lampRaf = requestAnimationFrame(() => {
          lampRaf = 0;
          guil.prepUV();
          place(px, py);
          wrap.classList.add('on');
        });
      };
      const leave = () => wrap.classList.remove('on');
      hero.addEventListener('pointermove', move, { passive: true });
      hero.addEventListener('pointerleave', leave);
      /* The lamp's canvas is drawn at idle, so the first pointer move never stutters. */
      UI.whenIdle(() => { if (!gone) { guil.prepUV(); UI.prepFlare(); } });
      /* First visit only: the lamp passes once over the rosette, so the hidden print has a chance to be noticed. */
      if (mode === 'new' && window.innerWidth > 1100) {
        const t = setTimeout(() => {
          if (gone || won) return;
          guil.prepUV();
          const r = hero.getBoundingClientRect();
          const a = [r.width * 0.98, r.height * 0.5];
          const b = [r.width * 0.62, r.height * 0.98];
          const t0 = performance.now();
          const dur = 2600;
          wrap.classList.add('on');
          const tick = (now) => {
            if (gone) return;
            const k = Math.min(1, (now - t0) / dur), ez = k * k * (3 - 2 * k);
            place(a[0] + (b[0] - a[0]) * ez, a[1] + (b[1] - a[1]) * ez);
            if (k < 0.85) sweep = requestAnimationFrame(tick);
            else { wrap.classList.remove('on'); sweep = 0; }
          };
          sweep = requestAnimationFrame(tick);
        }, 1400);
        stops.push(() => clearTimeout(t));
      }
    } else {
      UI.whenIdle(() => { if (!gone) UI.prepFlare(); });
    }
    stops.push(() => { if (sweep) cancelAnimationFrame(sweep); if (lampRaf) cancelAnimationFrame(lampRaf); });

    /* The engine warms up at idle, so the first Run answers fast. */
    UI.whenIdle(() => { if (!gone) { try { Engine.ready.catch(() => {}); } catch (e) { /* reported by status */ } } });

    /* ---------- The cover swings open the first time the passbook comes into view ---------- */
    function armCover(parts) {
      const { book, leaf } = parts;
      if (!UI.motionOK() || !('IntersectionObserver' in window) || window.innerWidth <= 1100) return;
      if (location.hash.indexOf('passbook') >= 0) return;
      const box = book.getBoundingClientRect();
      if (box.top < window.innerHeight * 0.8) return;
      book.classList.add('closed');
      const io = new IntersectionObserver((es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        book.classList.remove('closed');
        book.classList.add('opening');
        UI.anim(leaf, [{ transform: 'perspective(2800px) rotateY(180deg)' }, { transform: 'perspective(2800px) rotateY(0deg)' }], { duration: 1150, easing: 'cubic-bezier(.32,.72,.12,1)' });
        setTimeout(() => { book.classList.remove('opening'); }, 1200);
      }, { threshold: 0.3 });
      io.observe(book);
      stops.push(() => io.disconnect());
    }
    armCover(firstBook);

    /* ---------- When progress changes (another tab, a restore) ---------- */
    let sig = progressSig();
    function progressSig() {
      return State.doneCount() + '|' + State.stamps().length + '|' + State.dueReviews().length + '|' + State.streak().days;
    }
    let changeTimer = 0;
    const onProgress = () => {
      changeTimer = 0;
      if (gone || holding) return;
      const next = progressSig();
      if (next === sig) return;
      sig = next;
      if ((mode !== 'new' && State.doneCount() === 0) || (mode !== 'done' && !State.nextRank())) { K.refresh(); return; }
      paintSlip();
      paintAcct();
      paintMiniRoute();
      paintTeasers();
      paintJourney();
      paintPassbook();
    };
    stops.push(State.onChange(() => {
      if (!changeTimer) changeTimer = setTimeout(onProgress, 60);
    }));
    stops.push(() => clearTimeout(changeTimer));

    return () => {
      gone = true;
      if (holding) K.Header.release();
      stops.forEach((fn) => { try { fn(); } catch (e) { /* nothing to stop */ } });
    };
  }

  function catmull(pts, steps) {
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n - 1)];
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (p2[0] - p0[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    out.push(pts[n - 1]);
    return out;
  }

  K.Home = { render, rankUp };
})();
