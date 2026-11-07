/*
 * Kenari.Intro: the opening, "Collection day". What SQL does for collection work, in one take of about 4.3 seconds.
 * 1  Stream   (0 to 0.86 s)    the loans ledger (40 real rows) streams upward and settles; FROM loans types.
 * 2  Filter   (0.34 to 1.4 s)  WHERE dpd > 90 types; a canary scan line sweeps down; loans over 90 days late light up.
 * 3  Group    (1.3 to 2.6 s)   the lit rows fly into one bar per branch (real counts); GROUP BY branch types, the bars
 *                              grow, then ORDER BY loans DESC types and they sort, longest first.
 * 4  Name     (2.6 to 3.4 s)   the bars collapse into one canary rule; "Kenari Collection SQL Lab" rises from it.
 * 5  Hand-off (3.4 s to end)   the name glides onto Home's headline (same type, measured from the page), the rule
 *                              stretches across and the screen splits open on Home. When the headline is hidden (a phone,
 *                              coming back), the name stays where it is and the screen splits open from its rule.
 * When: once a visit, and only when a visit starts on Home. index.html decides before first paint, covers that paint
 * (html.kn-cover) and marks the visit on its first page, whatever the screen (sessionStorage 'kenari.intro.v1');
 * main.js calls Intro.start() after the first route, then lifts the cover. ?nointro skips it and ?intro forces it.
 * It does not play when Home is not up within 2.5 s of the page opening, in a hidden tab, or in forced colors.
 * Skip: the Skip intro button, any key, a tap (its click is swallowed), a wheel turn or a scroll. Reduced motion, or a
 * screen under 540px tall (a phone on its side): the name fades in, holds, and the cover fades to Home (1.8 s).
 * Only transform, opacity and clip-path animate (Web Animations API).
 * The rows and counts are the course's own data: tests/selftest.js checks them against the database.
 */
(function () {
  'use strict';
  var W = window, d = document, K = W.Kenari = W.Kenari || {};

  /* ---------- the course's data (checked by the self-test) ---------- */
  /* SELECT loan_id, branch_id, product, dpd, outstanding FROM loans ORDER BY loan_id LIMIT 40 */
  var LOANS = [[1,9,'KKB',0,44608000],[2,9,'KTA',394,15290000],[3,3,'KTA',52,3130000],[4,5,'KPR',0,160718000],[5,5,'Kartu Kredit',0,6596000],[6,5,'KPR',0,141851000],[7,5,'KPR',0,404430000],[8,5,'Kartu Kredit',0,14065000],[9,9,'Kartu Kredit',592,9678000],[10,12,'Kartu Kredit',0,18798000],[11,12,'Kartu Kredit',0,5754000],[12,3,'Kartu Kredit',0,3985000],[13,3,'KKB',38,61012000],[14,11,'KTA',0,22418000],[15,2,'KPR',0,141329000],[16,8,'KKB',39,36491000],[17,7,'Kartu Kredit',0,4640000],[18,2,'KTA',63,33810000],[19,1,'KPR',0,338400000],[20,12,'Kartu Kredit',0,9760000],[21,11,'KPR',0,73879000],[22,7,'KKB',0,77919000],[23,7,'Kartu Kredit',13,10942000],[24,8,'Kartu Kredit',0,14073000],[25,12,'KTA',0,5495000],[26,5,'Kartu Kredit',0,4657000],[27,8,'KPR',0,290821000],[28,5,'KTA',601,20626000],[29,7,'KKB',0,79527000],[30,12,'Kartu Kredit',126,6646000],[31,11,'Kartu Kredit',0,4939000],[32,12,'KTA',139,36413000],[33,3,'Kartu Kredit',0,3586000],[34,11,'Kartu Kredit',22,8135000],[35,11,'KKB',0,104662000],[36,11,'Kartu Kredit',0,18678000],[37,11,'KTA',0,7361000],[38,4,'Kartu Kredit',0,18778000],[39,2,'Kartu Kredit',0,12944000],[40,5,'Kartu Kredit',0,9169000]];
  /* SELECT branch_name FROM branches ORDER BY branch_id, so BRANCH[branch_id] is its name */
  var BRANCH = ['', 'KC Jakarta Sudirman', 'KCP Kelapa Gading', 'KCP Bekasi Timur', 'KC Bandung Dago', 'KCP Cimahi', 'KC Semarang Simpang Lima', 'KC Surabaya Darmo', 'KCP Malang Ijen', 'KC Denpasar Renon', 'KC Medan Merdeka', 'KCP Palembang Ilir', 'KC Makassar Losari'];
  /* loans over 90 days past due, per branch, longest first */
  var OVER = [['KC Semarang Simpang Lima', 10], ['KC Surabaya Darmo', 8], ['KCP Bekasi Timur', 6], ['KC Makassar Losari', 6], ['KC Bandung Dago', 6], ['KCP Kelapa Gading', 5], ['KCP Cimahi', 5], ['KCP Palembang Ilir', 4], ['KCP Malang Ijen', 4], ['KC Jakarta Sudirman', 4], ['KC Denpasar Renon', 4], ['KC Medan Merdeka', 2]];
  var TITLE = ['Kenari Collection', 'SQL Lab'];
  var SUB = 'Learn SQL on real-looking collection data.';

  /* ---------- timeline (ms) ---------- */
  var T = { from: 60, where: 340, scan: 660, scanEnd: 1120, fly: 1300, group: 1330, grow: 1370, order: 1760, sort: 1900,
    fade: 2620, coll: 2680, rise: 3010, move: 3400, moveEnd: 3830, wipe: 3880 };
  var CALM = 1800;
  var EXPO = 'cubic-bezier(.16,1,.3,1)', QUART = 'cubic-bezier(.25,1,.5,1)', SOFT = 'cubic-bezier(.3,0,.2,1)';
  var LIN_OK = !!(W.CSS && W.CSS.supports && W.CSS.supports('transition-timing-function', 'linear(0, 1)'));
  /* a damped spring as a linear() easing (falls back to an overshooting bezier) */
  function spring(zeta, omega, ms) {
    if (!LIN_OK) return 'cubic-bezier(.3,1.25,.5,1)';
    var pts = [], N = 48, wd = omega * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
    for (var i = 0; i <= N; i++) {
      var t = i / N * ms / 1000;
      var x = 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + zeta * omega / wd * Math.sin(wd * t));
      pts.push(i === N ? 1 : Math.round(x * 10000) / 10000);
    }
    return 'linear(' + pts.join(',') + ')';
  }
  function money(n) { return 'Rp ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function tr(x, y, sx, sy) { return 'translate(' + r2(x) + 'px,' + r2(y) + 'px) scale(' + r2(sx * 1000) / 1000 + ',' + r2((sy == null ? sx : sy) * 1000) / 1000 + ')'; }
  function cells(L) { return '<span class="i">' + L[0] + '</span><span class="p">' + L[2] + '</span><span class="d">' + L[3] + '</span><span class="o">' + money(L[4]) + '</span>'; }

  /* ---------- where the name lands: Home's headline, measured, or null when it is hidden or off screen ---------- */
  var STRETCH = { 'ultra-condensed': 50, 'extra-condensed': 62.5, condensed: 75, 'semi-condensed': 87.5, normal: 100, 'semi-expanded': 112.5, expanded: 125, 'extra-expanded': 150, 'ultra-expanded': 200 };
  function headline(vh) {
    var h = d.querySelector('#view .hm-hero .hm-h1');
    if (!h) return null;
    var r = h.getBoundingClientRect(), cs = getComputedStyle(h);
    var fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight);
    if (!(fs > 0)) return null;
    if (!(lh > 0)) lh = fs * 1.05;
    if (r.width < 40 || r.height < 2 * lh - 2 || r.top < 0 || r.top + 2 * lh > vh) return null;
    return { x: r.left, y: r.top, fs: fs, lh: lh, wdth: STRETCH[cs.fontStretch] || parseFloat(cs.fontStretch) || 100, ls: parseFloat(cs.letterSpacing) || 0 };
  }

  /* Home's own left margin on a phone, which grows past 16px for a notch (a phone on its side) */
  function gutter() {
    var hi = d.querySelector('#view .hm-hero-in'), p = hi ? parseFloat(getComputedStyle(hi).paddingLeft) : NaN;
    return p >= 16 ? p : 16;
  }

  /* ---------- geometry that needs no font metrics ---------- */
  function geo(vw, vh, tgt, wide) {
    var g = { vw: vw, vh: vh, phone: !wide, tgt: tgt };
    if (tgt) { g.fs = tgt.fs; g.lh = tgt.lh; g.wdth = tgt.wdth; g.ls = tgt.ls; g.x0 = tgt.x; g.y0 = tgt.y; }
    else {
      /* nothing to land on: the type of Home's first-visit headline (home.css), and the name stays put */
      g.fs = g.phone ? Math.min(vw * 0.083, 44) : Math.max(34, Math.min(vw * 0.05, vh * 0.103, 86));
      g.lh = g.fs * (g.phone ? 1.08 : 1.03); g.wdth = g.phone ? 112 : 125; g.ls = g.fs * (g.phone ? -0.024 : -0.028);
      g.x0 = 0; g.y0 = 0;
    }
    g.ruleGap = Math.round(g.fs * (g.phone ? 0.25 : 0.21));
    g.ruleH = g.phone ? 2 : 3;
    g.subFs = g.phone ? Math.max(14, Math.round(g.fs * 0.47 * 2) / 2) : Math.max(16, Math.round(g.fs * 0.27));
    g.subLH = Math.round(g.subFs * 1.3);
    g.subGap = Math.round(g.fs * (g.phone ? 0.3 : 0.2));
    g.ruleY = g.y0 + 2 * g.lh + g.ruleGap;             /* the rule's top, landed */
    g.subY = g.ruleY + g.ruleH + g.subGap;
    g.lockH = g.subY + g.subLH - g.y0;
    /* ledger and caption */
    g.G = Math.round(tgt ? tgt.x : gutter());
    if (g.phone) {
      g.rf = Math.max(13, Math.min(14, Math.floor((vw - 2 * g.G) / 25.2 * 2) / 2));
      g.rh = Math.round(g.rf * 1.5);
      g.cols = 1; g.capFs = 14; g.capLH = 21;
      g.capTop = Math.round(Math.max(16, vh * 0.028));
    } else {
      g.rf = Math.max(14, Math.min(17, Math.round(vh * 0.021)));
      g.rh = Math.round(g.rf * 1.6);
      g.cols = 2; g.capFs = Math.max(15, Math.min(19, Math.round(vh * 0.022))); g.capLH = Math.round(g.capFs * 1.55);
    }
    g.ch = g.rf * 0.6; g.padX = 0.6 * g.ch;
    g.colW = 42 * g.ch; g.colGap = g.phone ? 0 : Math.round(g.rf * 4.8);
    g.ledW = g.cols * g.colW + (g.cols - 1) * g.colGap;
    g.ledX = g.phone ? g.G : Math.round((vw - g.ledW) / 2);
    g.hdrH = g.rh + 4;
    if (g.phone) {
      g.capX = g.G;
      g.hdrY = g.capTop + 2 * g.capLH + 10;
      g.winY = g.hdrY + g.hdrH;
      g.n = Math.max(10, Math.min(40, Math.floor((vh - g.winY - 80) / g.rh)));
    } else {
      g.n = 20;
      var gap = Math.round(g.capLH * 0.7);
      g.capTop = Math.round((vh - (2 * g.capLH + gap + g.hdrH + g.n * g.rh)) / 2);
      g.capX = g.ledX;
      g.hdrY = g.capTop + 2 * g.capLH + gap;
      g.winY = g.hdrY + g.hdrH;
    }
    return g;
  }
  var SKIP = '<button type="button" class="kn-skip">Skip intro<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m6 6 6 6-6 6M13 6l6 6-6 6"/></svg></button>';

  /**
   * Builds #kn-intro, plays it, removes it, then calls onDone.
   * opts.reduce forces the calm version; opts.t freezes the frame at that ms (for tests); opts.by is the latest time
   * (ms since the page opened) to stop waiting for the fonts.
   * Returns { duration, seek(ms), skip() }; duration is final once it is built (at most 600 ms, or by opts.by).
   */
  function play(onDone, opts) {
    opts = opts || {};
    var old = d.getElementById('kn-intro');
    /* one at a time: an opening still on screen ends first, and its onDone runs (so Intro.current and theme-color reset) */
    if (old) { if (old._knEnd) old._knEnd(); else old.remove(); }
    var mq = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var freezeAt = typeof opts.t === 'number' && isFinite(opts.t) ? Math.max(0, opts.t) : null;
    var vw = d.documentElement.clientWidth || W.innerWidth, vh = W.innerHeight;
    /* Home's computer layout follows this media query, which counts a classic scrollbar in the width (clientWidth does not) */
    var wide = W.matchMedia ? W.matchMedia('(min-width: 1000px)').matches : vw >= 1000;
    /* too short for the ledger and the bars (a phone on its side): the calm version */
    var reduce = opts.reduce === true || !!(mq && mq.matches) || vh < 540 || vw < 300;
    var g = null, D = reduce ? CALM : 4300;

    var root = d.createElement('div');
    root.id = 'kn-intro';
    root.innerHTML = '<div class="kn-a" aria-hidden="true"><div class="kn-b"><div class="kn-g"></div></div></div>' +
      '<div class="kn-fx" aria-hidden="true"></div><p class="kn-sr">Kenari Collection SQL Lab</p>' + SKIP;
    var stage = root.querySelector('.kn-b'), fx = root.querySelector('.kn-fx'), skipBtn = root.querySelector('.kn-skip');
    var anims = [], over = false, leaving = false, armed = false, built = false, timer = 0, pendingSeek = freezeAt;

    function A(el, kf) { var a = el.animate(kf, { duration: D, fill: 'both', easing: 'linear' }); anims.push(a); return a; }
    /* one animation per element for the whole timeline: steps = [[ms, {props}, easing of the segment that starts here], ...] */
    function track(el, steps) {
      if (!el) return null;
      var keys = [], first = {}, cur = {}, kfs = [];
      steps.forEach(function (st) { Object.keys(st[1]).forEach(function (k) { if (keys.indexOf(k) < 0) { keys.push(k); first[k] = st[1][k]; } }); });
      keys.forEach(function (k) { cur[k] = first[k]; });
      var lastT = 0;
      steps.forEach(function (st) {
        var t = Math.max(lastT, Math.min(D, st[0])); lastT = t;
        Object.keys(st[1]).forEach(function (k) { cur[k] = st[1][k]; });
        var f = { offset: t / D, easing: st[2] || 'linear' };
        keys.forEach(function (k) { f[k] = cur[k]; });
        kfs.push(f);
      });
      if (kfs[0].offset > 0) { var f0 = Object.assign({}, kfs[0]); f0.offset = 0; f0.easing = 'linear'; kfs.unshift(f0); }
      if (kfs[kfs.length - 1].offset < 1) { var f1 = Object.assign({}, kfs[kfs.length - 1]); f1.offset = 1; kfs.push(f1); }
      return A(el, kfs);
    }

    function end() {
      if (over) return;
      over = true;
      clearTimeout(timer);
      W.removeEventListener('keydown', onKey, true);
      W.removeEventListener('wheel', onWheel, true);
      W.removeEventListener('scroll', skip);
      W.removeEventListener('resize', onResize);
      W.removeEventListener('hashchange', skip);
      d.removeEventListener('visibilitychange', onVis);
      root.removeEventListener('pointerdown', onTap);
      anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* gone */ } });
      var had = root.contains(d.activeElement);
      root.remove();
      /* if the Skip button had focus, focus goes back to the page */
      if (had) { try { d.body.setAttribute('tabindex', '-1'); d.body.focus({ preventScroll: true }); d.body.removeAttribute('tabindex'); } catch (e) { /* old browser */ } }
      if (typeof onDone === 'function') onDone();
    }
    function skip() {
      if (over || leaving) return;
      leaving = true;
      clearTimeout(timer);
      var o = parseFloat(getComputedStyle(root).opacity);
      var a = root.animate([{ opacity: isNaN(o) ? 1 : o }, { opacity: 0 }], { duration: 250, easing: 'cubic-bezier(.33,0,.2,1)', fill: 'forwards' });
      anims.push(a);
      a.finished.then(function () { end(); }, function () {});
      timer = setTimeout(function () { end(); }, 450);
    }
    function seek(ms) {
      /* once it is leaving, the skip's fade must run out (a paused fade would leave an invisible cover on Home) */
      if (over || leaving) return;
      pendingSeek = Math.max(0, +ms || 0);
      clearTimeout(timer);
      anims.forEach(function (a) { a.pause(); a.currentTime = Math.min(pendingSeek, D); });
    }
    function onKey(e) {
      if (!armed) return;
      /* keep browser shortcuts (Cmd, Ctrl, Alt and the F keys) working; any other key only skips */
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !/^F\d{1,2}$/.test(e.key || '')) e.preventDefault();
      skip();
    }
    function onTap(e) {
      if (!armed) return;
      /* A finger or pen: no compatibility mouse events (mousedown could focus a field on Home under it), and the click
         that ends this press is swallowed. A mouse press needs neither: once its target is gone, it gets no click. */
      if (e.pointerType !== 'mouse') { e.preventDefault(); guardClick(e.pointerId); }
      skip();
    }
    /* Home must not scroll under the opening (the name would land on the wrong place), so a wheel turn anywhere,
       even over a page scrollbar outside the opening, skips instead, and so does any scroll that still happens */
    function onWheel(e) { e.preventDefault(); if (armed) skip(); }
    function onVis() { if (d.visibilityState === 'hidden') end(); }
    /* a new width changes Home's layout; on a computer a new height changes the headline's size too */
    var lastW = W.innerWidth, lastH = W.innerHeight;
    function onResize() { if (Math.abs(W.innerWidth - lastW) > 2 || (wide && Math.abs(W.innerHeight - lastH) > 2)) skip(); }
    root._knEnd = end;

    d.body.appendChild(root);
    W.addEventListener('keydown', onKey, true);
    W.addEventListener('wheel', onWheel, { capture: true, passive: false });
    W.addEventListener('scroll', skip, { passive: true });
    W.addEventListener('resize', onResize);
    W.addEventListener('hashchange', skip);
    d.addEventListener('visibilitychange', onVis);
    root.addEventListener('pointerdown', onTap);
    skipBtn.addEventListener('click', skip);
    /* arm on the next frames, so the click or key that started the opening does not also skip it */
    requestAnimationFrame(function () { requestAnimationFrame(function () { armed = true; }); });

    var ctl = { duration: D, seek: seek, skip: skip };
    if (!root.animate) { setTimeout(function () { end(); }, 0); return ctl; }

    function begin() {
      /* skipped during the wait for the fonts: build nothing, let the fade finish */
      if (built || over || leaving) return;
      built = true;
      /* the display font still on its way: the name is measured and drawn in the fallback face for the whole opening,
         so its rule, the bars and its centring agree with it whenever the font arrives */
      if (d.fonts && d.fonts.check && !d.fonts.check('500 40px "Mona Sans"')) root.classList.add('kn-fb');
      g = geo(vw, vh, headline(vh), wide);
      var m = measure();
      settle(m);
      D = reduce ? CALM : g.end;
      ctl.duration = D;
      if (reduce) buildReduced(m); else buildFull(m);
      if (pendingSeek != null) seek(pendingSeek);
      else {
        anims[0].finished.then(function () { if (pendingSeek == null) end(); }, function () {});
        timer = setTimeout(function () { if (pendingSeek == null) end(); }, D + 250);
      }
    }
    /* The name's width, the rule, the bars and the ledger's columns are measured once, so wait for the fonts, at most
       600 ms on the plain dark ground, and never past opts.by (ms since the page opened), so a slow start does not
       keep that ground up for long. A frozen frame for a test waits longer, so its metrics are right. On a network
       that blocks the fonts, the loads fail fast and the fallback fonts are measured, as Home's headline uses them too. */
    var loads = d.fonts && d.fonts.load ? Promise.all(['500 40px "Mona Sans"', '400 16px "IBM Plex Mono"', '500 16px "IBM Plex Mono"', '400 16px "Atkinson Hyperlegible Next"', '600 16px "Atkinson Hyperlegible Next"'].map(function (f) { return d.fonts.load(f).catch(function () {}); })) : Promise.resolve();
    loads.then(begin, begin);
    var wait = freezeAt != null ? 4000 : 600;
    if (opts.by && W.performance) wait = Math.max(0, Math.min(wait, opts.by - performance.now()));
    setTimeout(begin, wait);
    return ctl;

    /* ---------- measuring the name ---------- */
    function measure() {
      var ms = d.createElement('span');
      ms.className = 'kn-meas';
      ms.style.cssText = 'font-size:' + g.fs + 'px;font-stretch:' + g.wdth + '%;letter-spacing:' + g.ls + 'px';
      root.appendChild(ms);
      ms.textContent = TITLE[0]; var tw = ms.getBoundingClientRect().width;
      ms.textContent = TITLE[1]; var tw2 = ms.getBoundingClientRect().width;
      ms.style.cssText = 'font-family:var(--f-body);font-weight:400;letter-spacing:0;font-size:' + g.subFs + 'px';
      ms.textContent = SUB; var sw = ms.getBoundingClientRect().width;
      ms.remove();
      var room = g.phone ? vw - 2 * g.G : vw - 2 * Math.max(48, vw * 0.08);
      var c = g.phone ? Math.min(1.16, (room - 26) / tw, room / sw) : Math.min(1.08, room / tw);
      var lw = tw * c;
      var left = g.phone ? g.G : Math.round((vw - lw) / 2);
      var top = Math.round((vh - g.lockH * c) / 2 - (g.phone ? vh * 0.02 : 0));
      return { tw: tw, tw2: tw2, sw: sw, c: c, lw: lw, left: left, top: top, tx: left - g.x0, ty: top - g.y0, ruleTop: top + (g.ruleY - g.y0) * c };
    }
    /* where the name and its rule end up, and the line the screen splits open from */
    function settle(m) {
      g.land = g.tgt
        ? { T: tr(0, 0, 1), ruleY: g.ruleY, ruleH: g.ruleH, x: g.x0, w: m.tw }
        : { T: tr(m.tx, m.ty, m.c), ruleY: m.ruleTop, ruleH: g.ruleH * m.c, x: m.left, w: m.lw };
      /* on a whole device pixel, so the two clips that open from it leave no hairline of the ground across Home */
      var dpr = W.devicePixelRatio || 1;
      g.R = Math.round((g.land.ruleY + g.land.ruleH / 2) * dpr) / dpr;
      g.durU = Math.round(260 + 0.36 * g.R);
      g.durL = Math.round(260 + 0.36 * (vh - g.R));
      g.end = T.wipe + Math.max(g.durU, g.durL);
    }
    function lockHtml(m) {
      /* the headline's own values, unrounded, so the name's two lines sit exactly on its first two */
      var fsCss = 'font-size:' + g.fs + 'px;line-height:' + g.lh + 'px;font-stretch:' + g.wdth + '%;letter-spacing:' + g.ls + 'px';
      return '<div class="kn-lock" style="left:' + r2(g.x0) + 'px;top:' + r2(g.y0) + 'px;width:' + r2(m.tw + 4) + 'px;height:' + r2(g.lockH) + 'px">' +
        TITLE.map(function (t, i) { return '<div class="kn-tl" style="top:' + i * g.lh + 'px;height:' + g.lh + 'px"><span style="' + fsCss + '">' + t + '</span></div>'; }).join('') +
        '<i class="kn-rule" style="top:' + r2(g.ruleY - g.y0) + 'px;width:' + r2(m.tw) + 'px;height:' + g.ruleH + 'px"></i>' +
        '<div class="kn-sub" style="top:' + r2(g.subY - g.y0) + 'px;height:' + g.subLH + 'px"><span style="font-size:' + g.subFs + 'px;line-height:' + g.subLH + 'px">' + SUB + '</span></div></div>';
    }

    /* ---------- the calm version: a still name fades in, holds, and the cover fades to Home ---------- */
    function buildReduced(m) {
      stage.insertAdjacentHTML('beforeend', lockHtml(m));
      var lock = stage.querySelector('.kn-lock');
      lock.style.transform = tr(m.tx, m.ty, m.c);
      stage.querySelectorAll('.kn-tl span,.kn-sub span').forEach(function (el) { el.style.transform = 'none'; });
      stage.querySelector('.kn-rule').style.opacity = '1';
      track(root, [[0, { opacity: 1 }], [1400, { opacity: 1 }, 'ease'], [1800, { opacity: 0 }]]);
      track(lock, [[0, { opacity: 0 }, 'ease'], [400, { opacity: 1 }]]);
      track(skipBtn, [[0, { opacity: 0 }, 'ease'], [400, { opacity: 1 }]]);
    }
    /* ---------- the full opening ---------- */
    function buildFull(m) {
      var h = [];
      var DR = 40;                                   /* the stream scrolls one full turn of the 40-row sample */
      /* which consecutive window of the sample to rest on: the one holding the most loans over 90 days */
      var bases = [], k;
      if (g.cols === 2) bases = [0, 20];
      else {
        var best = -1, bb = 0;
        for (var b = 0; b <= 40 - g.n; b++) { var cnt = 0; for (k = 0; k < g.n; k++) if (LOANS[(b + k) % 40][3] > 90) cnt++; if (cnt > best) { best = cnt; bb = b; } }
        bases = [bb];
      }

      /* caption: the query, one clause per step */
      var CAP = [
        ['<b class="k">FROM</b> loans', 10, T.from, T.where],
        ['<b class="k">WHERE</b> dpd <b class="o">&gt;</b> <b class="n">90</b>', 14, T.where, T.group],
        ['<b class="k">GROUP BY</b> branch', 15, T.group, T.order],
        ['<b class="k">ORDER BY</b> loans <b class="k">DESC</b>', 19, T.order, T.fade]
      ];
      h.push('<div class="kn-cap" style="left:' + g.capX + 'px;top:' + g.capTop + 'px;font-size:' + g.capFs + 'px;line-height:' + g.capLH + 'px">');
      CAP.forEach(function (c, i) { h.push('<div class="kn-cl" style="top:' + i * g.capLH + 'px;height:' + g.capLH + 'px"><span class="kn-ct">' + c[0] + '</span><i class="kn-caret"></i></div>'); });
      h.push('</div>');

      /* ledger: header, window, footer */
      h.push('<div class="kn-led" style="left:' + r2(g.ledX - g.padX) + 'px;top:' + g.hdrY + 'px;width:' + r2(g.ledW + 2 * g.padX) + 'px;font-size:' + g.rf + 'px">');
      h.push('<div class="kn-hdr" style="top:0;height:' + g.hdrH + 'px">');
      for (var c = 0; c < g.cols; c++) {
        var cx = r2(g.padX + c * (g.colW + g.colGap));
        h.push('<div class="kn-h" style="left:' + cx + 'px;top:0;height:' + g.hdrH + 'px"><span class="i">loan_id</span><span class="p">product</span><span class="d">dpd</span><span class="o">outstanding</span></div>');
        h.push('<i class="kn-hu" style="left:' + r2(cx + 23 * g.ch) + 'px;width:' + r2(3 * g.ch) + 'px"></i>');
      }
      h.push('</div>');
      h.push('<div class="kn-win" style="left:0;top:' + g.hdrH + 'px;width:100%;height:' + g.n * g.rh + 'px">');
      var lit = [], rows = [];
      for (c = 0; c < g.cols; c++) {
        h.push('<div class="kn-col" style="left:' + r2(g.padX + c * (g.colW + g.colGap)) + 'px;top:' + (-DR * g.rh) + 'px;width:' + r2(g.colW) + 'px;height:' + (DR + g.n) * g.rh + 'px">');
        for (k = -DR; k < g.n; k++) {
          var L = LOANS[((bases[c] + k) % 40 + 40) % 40], rest = k >= 0, on = rest && L[3] > 90;
          h.push('<div class="kn-r" style="top:' + (k + DR) * g.rh + 'px;height:' + g.rh + 'px"' + (rest ? ' data-c="' + c + '" data-k="' + k + '"' + (on ? ' data-on="1"' : '') : '') + '>' + cells(L) + (on ? '<div class="kn-lit">' + cells(L) + '</div>' : '') + '</div>');
          if (rest) rows.push({ c: c, k: k, on: on, L: L });
        }
        h.push('</div>');
      }
      h.push('</div><i class="kn-ft" style="top:' + (g.hdrH + g.n * g.rh) + 'px"></i></div>');

      /* scan line */
      h.push('<div class="kn-scan" style="left:' + r2(g.ledX - g.padX - 12) + 'px;top:' + (g.winY - 1) + 'px;width:' + r2(g.ledW + 2 * g.padX + 24) + 'px;height:2px"><div class="kn-scanl"><i></i></div></div>');

      /* bars: one per branch, in branch_id order until ORDER BY sorts them */
      var lf = g.phone ? 13.5 : g.rf, thick = g.phone ? 8 : Math.round(g.rh * 0.5);
      var labH = Math.round(lf * 1.2), capBottom = g.capTop + 4 * g.capLH;
      var pitch = g.phone ? Math.min(39, Math.floor((vh - capBottom - 18 - 76) / 12)) : Math.round(g.rh * 1.45);
      var barsTop = Math.max(capBottom + 18, Math.round((vh - 12 * pitch) / 2 - (g.phone ? 10 : 0)));
      var barOff = g.phone ? labH + 5 : Math.round((pitch - thick) / 2);
      var count = {}, rank = {};
      OVER.forEach(function (o, i) { count[o[0]] = o[1]; rank[o[0]] = i; });
      var bars = [];
      for (var j = 0; j < 12; j++) {
        var name = BRANCH[j + 1], len = m.lw * count[name] / 10;
        bars.push({ j: j, r: rank[name], n: count[name], len: len, y: barsTop + j * pitch + barOff, fly: [] });
        h.push('<div class="kn-br" style="top:' + (barsTop + j * pitch) + 'px;height:' + pitch + 'px">');
        if (g.phone) h.push('<span class="kn-bl" style="left:' + g.G + 'px;top:0;font-size:' + lf + 'px;line-height:' + labH + 'px">' + name + '</span>');
        else h.push('<span class="kn-bl" style="right:' + (vw - m.left + 18) + 'px;top:0;font-size:' + lf + 'px;line-height:' + pitch + 'px">' + name + '</span>');
        h.push('<i class="kn-bb" style="left:' + r2(m.left) + 'px;top:' + barOff + 'px;width:' + r2(len) + 'px;height:' + thick + 'px"></i>');
        var cf = g.phone ? 13 : g.rf - 1, clh = Math.round(cf * 1.3);
        h.push('<span class="kn-bc" style="left:' + r2(m.left + len + (g.phone ? 8 : 12)) + 'px;top:' + Math.round(barOff + thick / 2 - clh / 2) + 'px;font-size:' + cf + 'px;line-height:' + clh + 'px">' + count[name] + '</span></div>');
      }

      /* the lit rows' twins, which fly out of the ledger into their branch's bar */
      var travel = g.n * g.rh, sdur = T.scanEnd - T.scan;
      rows.forEach(function (rw) {
        var p = Math.min(1, ((rw.k + 0.5) * g.rh) / travel);
        rw.t = T.scan + sdur * Math.acos(1 - 2 * p) / Math.PI;     /* when the eased scan line crosses the row */
      });
      rows.filter(function (rw) { return rw.on; }).sort(function (a, b2) { return a.t - b2.t; }).forEach(function (rw, q) {
        var x = g.ledX + rw.c * (g.colW + g.colGap) - g.padX, y = g.winY + rw.k * g.rh + 1, w = g.colW + 2 * g.padX, hh = g.rh - 2;
        var bar = bars[rw.L[1] - 1];
        var f = { q: q, x: x, y: y, w: w, h: hh, bar: bar, t0: T.fly + q * 45 };
        f.t1 = f.t0 + 440;
        bar.fly.push(f); lit.push(f);
        h.push('<div class="kn-fly" style="left:' + r2(x) + 'px;top:' + r2(y) + 'px;width:' + r2(w) + 'px;height:' + hh + 'px;font-size:' + g.rf + 'px"><div class="kn-fi"><div class="kn-fl">' + cells(rw.L) + '</div></div></div>');
      });

      /* the name sits at its landed place; transforms carry it there */
      h.push(lockHtml(m));
      stage.insertAdjacentHTML('beforeend', h.join(''));
      /* the two edges of the hand-off ride above the stage */
      var Lr = g.land;
      fx.innerHTML = '<i class="kn-edge" style="top:' + r2(Lr.ruleY) + 'px;height:' + r2(Lr.ruleH) + 'px"><b></b></i><i class="kn-edge" style="top:' + r2(Lr.ruleY) + 'px;height:' + r2(Lr.ruleH) + 'px"><b></b></i>';

      animateFull(m, { rows: rows, lit: lit, bars: bars, pitch: pitch, barsTop: barsTop, barOff: barOff, thick: thick, CAP: CAP, DR: DR });
    }
    function animateFull(m, o) {
      var $ = function (s) { return stage.querySelector(s); }, $$ = function (s) { return Array.prototype.slice.call(stage.querySelectorAll(s)); };
      var R = g.R, Lr = g.land, WIPE = 'cubic-bezier(.7,0,.25,1)', MOVE = 'cubic-bezier(.7,0,.16,1)', COLL = 'cubic-bezier(.7,0,.25,1)';
      var FLY = 'cubic-bezier(.55,.05,.15,1)', SORT = spring(0.72, 13, 460);
      var swap = T.coll + 11 * 12 + 340;

      /* 5. hand-off: the stage opens from the rule's line; two nested clips so each half keeps its own pace */
      var polyA = function (a) { return 'polygon(0px 0px,100% 0px,100% ' + r2(a) + 'px,0px ' + r2(a) + 'px,0px ' + r2(R) + 'px,100% ' + r2(R) + 'px,100% 100%,0px 100%)'; };
      var polyB = function (b) { return 'polygon(0px 0px,100% 0px,100% ' + r2(R) + 'px,0px ' + r2(R) + 'px,0px ' + r2(b) + 'px,100% ' + r2(b) + 'px,100% 100%,0px 100%)'; };
      track(root.querySelector('.kn-a'), [[T.wipe, { clipPath: polyA(R) }, WIPE], [T.wipe + g.durU, { clipPath: polyA(-Lr.ruleH - 10) }]]);
      track(stage, [[T.wipe, { clipPath: polyB(R) }, WIPE], [T.wipe + g.durL, { clipPath: polyB(vh + Lr.ruleH + 10) }]]);
      Array.prototype.slice.call(fx.querySelectorAll('.kn-edge')).forEach(function (e, i) {
        var dur = i ? g.durL : g.durU, to = i ? vh - R + Lr.ruleH + 10 : -(R + Lr.ruleH + 10);
        track(e, [[T.moveEnd, { opacity: 0, transform: 'translateY(0px)' }], [T.moveEnd, { opacity: 1 }], [T.wipe, {}, WIPE], [T.wipe + dur, { transform: 'translateY(' + r2(to) + 'px)' }]]);
        track(e.firstChild, [[T.moveEnd, { clipPath: 'inset(-24px ' + r2(vw - Lr.x - Lr.w) + 'px -24px ' + r2(Lr.x) + 'px)' }, EXPO], [T.moveEnd + 170, { clipPath: 'inset(-24px 0px -24px 0px)' }]]);
      });
      track(skipBtn, [[240, { opacity: 0 }, SOFT], [520, { opacity: 1 }], [T.move, {}, SOFT], [T.move + 160, { opacity: 0 }]]);

      /* 1. stream: the ledger scrolls one turn of the sample and settles */
      track($('.kn-win'), [[0, { opacity: 0 }, SOFT], [130, { opacity: 1 }]]);
      $$('.kn-col').forEach(function (col) { track(col, [[0, { transform: 'translateY(' + o.DR * g.rh + 'px)' }, 'cubic-bezier(.2,.62,.28,1)'], [800, { transform: 'translateY(0px)' }]]); });
      [$('.kn-hdr'), $('.kn-ft')].forEach(function (el) { track(el, [[0, { opacity: 0 }, SOFT], [130, { opacity: 1 }], [T.fly - 60, {}, SOFT], [T.fly + 110, { opacity: 0 }]]); });
      $$('.kn-hu').forEach(function (el) { track(el, [[T.where + 150, { transform: 'scaleX(0)' }, EXPO], [T.where + 400, { transform: 'scaleX(1)' }]]); });

      /* caption: each clause types, then dims when the next one starts */
      var cls = $$('.kn-cl');
      o.CAP.forEach(function (c, i) {
        var line = cls[i], ct = line.querySelector('.kn-ct'), caret = line.querySelector('.kn-caret');
        var t0 = c[2], t1 = t0 + c[1] * (i === 0 ? 24 : i === 1 ? 21 : 20), tN = c[3];
        track(ct, [[t0, { clipPath: 'inset(0px 100% 0px 0px)' }, 'steps(' + c[1] + ', start)'], [t1, { clipPath: 'inset(0px 0% 0px 0px)' }]]);
        var ls = [[0, { opacity: 1 }]];
        if (i < 3) ls.push([tN, {}, SOFT], [tN + 200, { opacity: 0.5 }]);
        ls.push([T.fade, {}, SOFT], [T.fade + 200, { opacity: 0 }]);
        track(line, ls);
        var cs = [[t0, { opacity: 0, transform: 'translateX(0ch)' }], [t0, { opacity: 1 }, 'steps(' + c[1] + ', start)'], [t1, { transform: 'translateX(' + c[1] + 'ch)' }, 'step-end']];
        var on = true, stop = i < 3 ? tN : T.fade;
        for (var t = t1 + 260; t < stop; t += 260) { on = !on; cs.push([t, { opacity: on ? 1 : 0 }, 'step-end']); }
        cs.push([stop, { opacity: 0 }]);
        track(caret, cs);
      });

      /* 2. filter: the scan line sweeps down (eased), rows over 90 days light up, the rest dim */
      var travel = g.n * g.rh, sdur = T.scanEnd - T.scan, ss = [];
      for (var i = 0; i <= 16; i++) { var u = i / 16; ss.push([T.scan + u * sdur, { transform: 'translateY(' + r2(travel * (1 - Math.cos(Math.PI * u)) / 2) + 'px)' }]); }
      track($('.kn-scanl'), ss);
      track($('.kn-scan'), [[T.scan, { opacity: 0 }, SOFT], [T.scan + 50, { opacity: 1 }], [T.scanEnd - 70, {}, SOFT], [T.scanEnd + 60, { opacity: 0 }]]);
      var rowEls = $$('.kn-r[data-k]'), fadeAt = T.fly - 60;
      o.rows.forEach(function (rw, idx) {
        var el = rowEls[idx];
        if (rw.on) {
          track(el.querySelector('.kn-lit'), [[rw.t - 10, { clipPath: 'inset(0px 100% 0px 0px)' }, 'cubic-bezier(.25,.8,.25,1)'], [Math.min(rw.t + 170, T.fly - 5), { clipPath: 'inset(0px 0% 0px 0px)' }]]);
          track(el, [[T.fly, { opacity: 1 }], [T.fly, { opacity: 0 }]]);
        } else {
          var dimEnd = Math.min(rw.t + 220, fadeAt);
          track(el, [[rw.t, { opacity: 1 }, SOFT], [dimEnd, { opacity: 0.22 }], [fadeAt, {}, SOFT], [fadeAt + 170, { opacity: 0 }]]);
        }
      });

      /* 3. group: the lit rows fly into their branch's bar, the other bars grow, then ORDER BY sorts them */
      var flyEls = $$('.kn-fly');
      o.lit.forEach(function (f, q) {
        var el = flyEls[q], b = f.bar;
        f.t0 = T.fly + q * 35; f.t1 = f.t0 + 440;
        /* the strip thins into a bar quickly (inner scale), while the glide to the bar takes longer (outer translate) */
        track(el, [[T.fly, { opacity: 0, transform: 'translate(0px,0px)' }], [T.fly, { opacity: 1 }], [f.t0, {}, FLY],
          [f.t1, { transform: 'translate(' + r2(m.left - f.x) + 'px,' + r2(b.y - f.y) + 'px)' }], [f.t1 + 1, { opacity: 0 }]]);
        track(el.firstChild, [[f.t0, { transform: 'scale(1,1)' }, 'cubic-bezier(.3,0,.1,1)'], [f.t0 + 320, { transform: 'scale(' + r2(b.len / f.w * 1000) / 1000 + ',' + r2(o.thick / f.h * 1000) / 1000 + ')' }]]);
        track(el.firstChild.firstChild, [[f.t0, { opacity: 1 }, SOFT], [f.t0 + 110, { opacity: 0 }]]);
      });
      var brEls = $$('.kn-br');
      o.bars.forEach(function (b) {
        var row = brEls[b.j], lab = row.querySelector('.kn-bl'), bar = row.querySelector('.kn-bb'), num = row.querySelector('.kn-bc');
        var fly = b.fly.length > 0, tA = fly ? Math.min.apply(null, b.fly.map(function (f) { return f.t1; })) : 0;
        var tg = T.grow + b.j * 24, sy = g.ruleH * m.c / o.thick;
        var cS = T.coll + b.r * 12, cE = cS + 340, sS = T.sort + b.r * 8;
        var bs = fly ? [[tA, { transform: 'scale(1,1)', opacity: 0 }], [tA, { opacity: 1 }]] : [[tg, { transform: 'scale(0,1)', opacity: 1 }, EXPO], [tg + 420, { transform: 'scale(1,1)' }]];
        bs.push([cS, {}, COLL], [cE, { transform: 'scale(1,' + r2(sy * 1000) / 1000 + ')' }], [swap, { opacity: 1 }], [swap, { opacity: 0 }]);
        track(bar, bs);
        var tl = fly ? tA - 160 : tg + 40, tc = fly ? tA + 60 : tg + 300;
        track(lab, [[tl, { opacity: 0, transform: 'translateX(-8px)' }, QUART], [tl + 320, { opacity: 1, transform: 'translateX(0px)' }], [T.fade + b.r * 6, {}, SOFT], [T.fade + b.r * 6 + 140, { opacity: 0 }]]);
        track(num, [[tc, { opacity: 0 }, SOFT], [tc + 200, { opacity: 1 }], [T.fade, {}, SOFT], [T.fade + 140, { opacity: 0 }]]);
        track(row, [[sS, { transform: 'translateY(0px)' }, SORT], [sS + 460, { transform: 'translateY(' + (b.r - b.j) * o.pitch + 'px)' }],
          [cS, {}, COLL], [cE, { transform: 'translateY(' + r2(m.ruleTop - b.y) + 'px)' }]]);
      });

      /* 4. name: the bars become the rule, the name rises from it, a slow push, then the glide to where it lands */
      var c1 = m.c * 1.025, C0 = tr(m.tx, m.ty, m.c), C1 = tr(m.tx + (m.c - c1) * m.tw / 2, m.ty + (m.c - c1) * g.lockH / 2, c1);
      track($('.kn-lock'), [[swap, { transform: C0 }, 'cubic-bezier(.33,0,.45,1)'], [T.move, { transform: C1 }, MOVE], [T.moveEnd, { transform: Lr.T }]]);
      track($('.kn-rule'), [[swap, { opacity: 0 }], [swap, { opacity: 1 }], [T.moveEnd, { opacity: 1 }], [T.moveEnd, { opacity: 0 }]]);
      $$('.kn-tl span').forEach(function (el, i) { track(el, [[T.rise + i * 70, { transform: 'translateY(115%)' }, EXPO], [T.rise + i * 70 + 560, { transform: 'translateY(0%)' }]]); });
      track($('.kn-sub span'), [[T.rise + 120, { transform: 'translateY(-115%)' }, EXPO], [T.rise + 640, { transform: 'translateY(0%)' }]]);
    }
  }

  /* ---------- the click that ends a skipping tap ---------- */
  /* A tap skips on pointerdown, and the opening is gone 250 ms later. If the finger is still down by then, the tap's
     click (or a long press's menu) would land on whatever Home has under it: a tab, the Run key. So that one click is
     swallowed, and only that one: the guard lifts 400 ms after this pointer goes up, at the next press of any pointer
     (a new gesture owns its own click), and after 3 s whatever happens. */
  function guardClick(id) {
    var grace = 0, cap = 0;
    function swallow(e) { e.preventDefault(); e.stopImmediatePropagation(); release(); }
    function menu(e) { e.preventDefault(); }
    function lift(e) { if (e.pointerId === id) { clearTimeout(grace); grace = setTimeout(release, 400); } }
    function release() {
      clearTimeout(grace); clearTimeout(cap);
      W.removeEventListener('click', swallow, true);
      W.removeEventListener('contextmenu', menu, true);
      W.removeEventListener('pointerup', lift, true);
      W.removeEventListener('pointercancel', lift, true);
      W.removeEventListener('pointerdown', release, true);
    }
    W.addEventListener('click', swallow, true);
    W.addEventListener('contextmenu', menu, true);
    W.addEventListener('pointerup', lift, true);
    W.addEventListener('pointercancel', lift, true);
    /* added while the skipping press is past window's capture phase, so only a later press releases it */
    W.addEventListener('pointerdown', release, true);
    cap = setTimeout(release, 3000);
  }

  /* ---------- when it plays ---------- */
  var api = { current: null, data: { LOANS: LOANS, BRANCH: BRANCH, OVER: OVER }, play: play, start: start };
  /* Called by main.js after the first route. Plays only if index.html put the cover up, and Home came up in time in a
     tab that is still in view. When it ends, 'kenari:intro-end' goes to the document (Home's first-visit lamp waits for it). */
  function start() {
    var html = d.documentElement;
    if (!html.classList.contains('kn-cover') || api.current) return;
    if (!d.querySelector('#view .hm-hero') || !html.animate || d.visibilityState === 'hidden') return;
    if ((W.performance && performance.now() > 2500) || (W.matchMedia && matchMedia('(forced-colors: active)').matches)) return;
    /* the browser's own bar matches the opening's dark ground, then follows the theme again (it may have changed) */
    var meta = d.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#06181D');
    /* built by 2.8 s after the page opened at the latest: the plain ground is never up longer than that */
    api.current = play(function () {
      api.current = null;
      if (meta) meta.setAttribute('content', html.getAttribute('data-theme') === 'light' ? '#DAE5E1' : '#06181D');
      d.dispatchEvent(new CustomEvent('kenari:intro-end'));
    }, { by: 2800 });
  }
  K.Intro = api;
})();
