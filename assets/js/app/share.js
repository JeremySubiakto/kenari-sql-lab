/*
 * Kenari.Share: the "Share this rank" picture on the rank-up sheet. See docs/APP-API.md.
 * A page of the mission passbook with the level's rank stamp, drawn on a canvas on this device
 * as a 1080x1350 PNG. Nothing is uploaded.
 * The rows are the passbook's own lines: the last three passes up to the one that cleared the level,
 * with the dates and saldo the Passbook screen prints, so the picture is the same whenever it is made.
 */
(function () {
  'use strict';
  const K = (window.Kenari = window.Kenari || {});

  /* The approved mock is 540x675 CSS px, drawn at 2x. Every position here is measured from it, in CSS px,
     with rules and baselines on the device-pixel grid, as the browser drew them. */
  const W = 540;
  const H = 675;
  const S = 2;
  const LEFT = 36;
  const RIGHT = 504;
  const COL2 = 122;                 // Keterangan starts here, and runs 330px to the Saldo column
  const COL2_W = 330;
  const ROW_H = 43;
  const ROW0_BASE = 188;            // baseline of the BALANCE B/F row
  const ROW0_RULE = 204;            // its rule underneath
  const DOUBLE_W = 60;              // the double rule under Saldo
  const STAMP = { cx: 405, cy: 477, size: 210, rot: -9 };
  const STAMP_PAD = 10;             // stamp units kept round the stamp's viewBox, as the page lets it draw past it
  const SITE = 'Kenari Collection SQL Lab';
  const ADDRESS = 'jeremysubiakto.github.io/kenari-sql-lab';
  const SMALL_PRINT = ['E. & O.E.', 'TOTAL DEBITS 0.', 'CLEARED MISSIONS', 'STAY CLEARED.'];
  const SMALL_BASE = [445, 465, 486, 506];
  const FAILED = 'The image could not be made on this browser.';

  const toLevel = (v) => (typeof v === 'number' ? (K.levels || []).find((L) => L.n === v) : v) || null;

  /* ---------- The page: the passbook's own lines, ending at the pass that cleared the level ---------- */
  function lastIndex(lines, from, test) {
    for (let i = from; i >= 0; i--) if (test(lines[i])) return i;
    return -1;
  }
  function page(level) {
    const { State } = K;
    const book = State.passbook();
    const isPass = (l) => l.kind !== 'level';
    const lv = book.findIndex((l) => l.kind === 'level' && l.n === level.n);
    let end = lv >= 0 ? lastIndex(book, lv - 1, isPass) : -1;
    if (lv < 0) {
      const ids = new Set(level.lessons.map((m) => m.id));
      end = lastIndex(book, book.length - 1, (l) => isPass(l) && ids.has(l.id));
      if (end < 0) end = lastIndex(book, book.length - 1, isPass);
    }
    const rows = [];
    let first = -1;
    for (let i = end; i >= 0 && rows.length < 3; i--) {
      if (isPass(book[i])) { rows.unshift(book[i]); first = i; }
    }
    /* Brought forward: the balance on the line before, as the Passbook carries it from page to page. */
    const bf = first > 0 ? book[first - 1].balance : 0;
    const stamped = State.stamps().find((x) => x.n === level.n);
    const stampDate = (stamped && stamped.date) || (lv >= 0 ? book[lv].date : State.today());
    return { rows, bf, rankDate: lv >= 0 ? book[lv].date : stampDate, stampDate };
  }
  /* The short date the Passbook prints: 06 NOV */
  const shortDate = (date) => K.UI.stampDate(date, true).slice(0, 6);

  /* ---------- Colours and fonts come from the page, since a canvas cannot read CSS variables ---------- */
  function palette() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name) => cs.getPropertyValue(name).trim();
    return {
      paper: v('--paper'), ink: v('--paper-ink'), ink2: v('--paper-ink-2'), rule: v('--paper-rule'), rule2: v('--paper-rule-2'), stamp: v('--stamp-paper'),
      display: v('--f-display') || 'sans-serif', body: v('--f-body') || 'sans-serif', mono: v('--f-mono') || 'monospace'
    };
  }
  function fonts(p) {
    return {
      title: '600 32px ' + p.display,
      sub: '400 16px ' + p.body,
      head: '700 14.5px ' + p.body,
      bf: '400 14px ' + p.mono,
      date: '400 13px ' + p.mono,
      id: '700 14px ' + p.mono,
      text: '400 15.5px ' + p.body,
      rank: '600 15.5px ' + p.body,
      saldo: '500 15px ' + p.mono,
      small: '400 13.5px ' + p.mono,
      site: '600 18px ' + p.display,
      address: '400 13px ' + p.mono
    };
  }
  /* The web fonts are on the page already. Wait for each face, but never long: a blocked font host draws in the fallback fonts. */
  function loadFonts(list) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const jobs = list.map(([font, text]) => {
      const first = font.replace(/,.*$/, '');
      return document.fonts.load(first, text).catch(() => null);
    });
    return Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 3000))]);
  }

  /* ---------- The stamp: the page's own stamp, made standalone so an image can draw it ---------- */
  function stampDoc(level, date, color) {
    const t = document.createElement('template');
    t.innerHTML = K.UI.rankStamp(level, date);
    const svg = t.content.querySelector('svg');
    /* rankStamp uses the page's shared ink filter, which a picture on its own cannot reach, so it travels with it. */
    const ink = document.getElementById('ink-s');
    let defs = svg.querySelector('defs');
    if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); svg.prepend(defs); }
    if (ink) defs.append(ink.cloneNode(true));
    const vb = (svg.getAttribute('viewBox') || '0 0 300 300').trim().split(/[\s,]+/).map(Number);
    const box = [vb[0] - STAMP_PAD, vb[1] - STAMP_PAD, vb[2] + STAMP_PAD * 2, vb[3] + STAMP_PAD * 2];
    const side = STAMP.size * box[2] / vb[2];
    svg.setAttribute('viewBox', box.join(' '));
    svg.setAttribute('width', (side * S).toFixed(2));
    svg.setAttribute('height', (side * S).toFixed(2));
    svg.removeAttribute('class');
    return { xml: new XMLSerializer().serializeToString(svg).replace(/currentColor/g, color), side };
  }
  function loadImage(xml) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => resolve({ img, done: () => URL.revokeObjectURL(url) });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('The stamp did not load.')); };
      img.src = url;
    });
  }

  /* ---------- Drawing ---------- */
  function put(ctx, font, color, text, x, y, align, spacing) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    if (!spacing) { ctx.fillText(text, x, y); return; }
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = spacing + 'px';
      ctx.fillText(text, x, y);
      ctx.letterSpacing = '0px';
      return;
    }
    /* No letterSpacing on this canvas: one letter at a time, keeping the pair spacing of the text before it. */
    let before = '';
    let n = 0;
    for (const ch of text) {
      ctx.fillText(ch, x + ctx.measureText(before).width + spacing * n, y);
      before += ch;
      n++;
    }
  }
  /** Cuts text to fit max px, with an ellipsis. */
  function fit(ctx, font, text, max) {
    ctx.font = font;
    if (ctx.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t.trimEnd() + '…').width > max) t = t.slice(0, -1);
    return t.trimEnd() + '…';
  }

  async function make(level) {
    const data = page(level);
    const p = palette();
    const F = fonts(p);
    const rankText = 'Rank: ' + level.rank;
    const stamp = stampDoc(level, data.stampDate, p.stamp);
    const [, pic] = await Promise.all([
      loadFonts([
        [F.title, 'Buku tabungan misi'], [F.sub, 'Mission passbook'], [F.head, 'Tanggal Keterangan Saldo'],
        [F.bf, 'BALANCE B/F'], [F.date, '0123456789 ' + data.rows.map((l) => shortDate(l.date)).join(' ')],
        [F.id, data.rows.map((l) => l.id).join(' ') || '0.1'],
        [F.text, data.rows.map((l) => l.title).join(' ') + ' …'], [F.rank, rankText + ' …'],
        [F.saldo, '0123456789'], [F.small, SMALL_PRINT.join(' ')], [F.site, SITE], [F.address, ADDRESS]
      ]),
      loadImage(stamp.xml)
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = W * S;
    canvas.height = H * S;
    /* In the page, hidden, the canvas sets its words with the page's own font smoothing, as the mock was. */
    canvas.hidden = true;
    document.body.append(canvas);
    try {
      draw(canvas.getContext('2d'), data, p, F, rankText, stamp, pic.img);
    } finally {
      canvas.remove();
      pic.done();
    }
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The canvas gave no image.'))), 'image/png');
    });
  }

  function draw(ctx, data, p, F, rankText, stamp, img) {
    ctx.scale(S, S);
    ctx.textBaseline = 'alphabetic';
    ctx.fontKerning = 'normal';
    const rule = (y, h, color, from, to) => { ctx.fillStyle = color; ctx.fillRect(from, y, to - from, h); };

    ctx.fillStyle = p.paper;
    ctx.fillRect(0, 0, W, H);

    put(ctx, F.title, p.ink, 'Buku tabungan misi', LEFT, 67, 'left', -0.384);
    put(ctx, F.sub, p.ink2, 'Mission passbook', LEFT, 99);

    rule(120, 2, p.ink, LEFT, RIGHT);
    put(ctx, F.head, p.ink, 'Tanggal', LEFT, 145);
    put(ctx, F.head, p.ink, 'Keterangan', COL2, 145);
    put(ctx, F.head, p.ink, 'Saldo', RIGHT, 145, 'right');
    rule(161, 1, p.ink, LEFT, RIGHT);

    /* Row 0 is BALANCE B/F, then the passes, then the rank. Each has its rule underneath. */
    const base = (i) => ROW0_BASE + ROW_H * i;
    const count = data.rows.length + 2;
    for (let i = 0; i < count; i++) rule(ROW0_RULE + ROW_H * i, 1, p.rule, LEFT, RIGHT);

    put(ctx, F.bf, p.ink2, 'BALANCE B/F', COL2, base(0));
    put(ctx, F.saldo, p.ink, String(data.bf), RIGHT, base(0), 'right');
    data.rows.forEach((l, k) => {
      const y = base(k + 1);
      put(ctx, F.date, p.ink2, shortDate(l.date), LEFT, y);
      put(ctx, F.id, p.ink, String(l.id), COL2, y);
      const idW = ctx.measureText(String(l.id)).width;
      put(ctx, F.text, p.ink, fit(ctx, F.text, ' ' + l.title, COL2_W - idW), COL2 + idW, y);
      put(ctx, F.saldo, p.ink, String(l.balance), RIGHT, y, 'right');
    });
    const rankRow = count - 1;
    put(ctx, F.date, p.ink2, shortDate(data.rankDate), LEFT, base(rankRow));
    put(ctx, F.rank, p.ink, fit(ctx, F.rank, rankText, COL2_W), COL2, base(rankRow));
    const last = ROW0_RULE + ROW_H * rankRow;
    rule(last, 1, p.ink, RIGHT - DOUBLE_W, RIGHT);
    rule(last + 2, 1, p.ink, RIGHT - DOUBLE_W, RIGHT);

    SMALL_PRINT.forEach((t, i) => put(ctx, F.small, p.ink2, t, LEFT, SMALL_BASE[i]));

    rule(587, 1, p.rule2, LEFT, RIGHT);
    put(ctx, F.site, p.ink, SITE, LEFT, 618);
    put(ctx, F.address, p.ink2, ADDRESS, LEFT, 643);

    /* The stamp goes on last, in multiply, so the paper and print show through the ink. */
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(STAMP.cx, STAMP.cy);
    ctx.rotate(STAMP.rot * Math.PI / 180);
    ctx.drawImage(img, -stamp.side / 2, -stamp.side / 2, stamp.side, stamp.side);
    ctx.restore();
  }

  /* One picture is kept, so a tap can share at once with the one made while the sheet settled. */
  let kept = null;
  function keyOf(level) {
    return level.n + '|' + (document.documentElement.getAttribute('data-theme') || '') + '|' + K.State.passbook().length;
  }
  /** Resolves with the PNG as a Blob. */
  function image(levelOrN) {
    const level = toLevel(levelOrN);
    if (!level) return Promise.reject(new Error('No such level.'));
    const key = keyOf(level);
    if (kept && kept.key === key) return kept.promise;
    const entry = { key, blob: null, promise: null };
    entry.promise = make(level).then((blob) => { entry.blob = blob; return blob; });
    entry.promise.catch(() => { if (kept === entry) kept = null; });
    kept = entry;
    return entry.promise;
  }
  /** Starts the picture once the sheet has settled, so the tap that shares it does not wait. */
  function prepare(levelOrN) {
    setTimeout(() => K.UI.whenIdle(() => { image(levelOrN).catch(() => {}); }), 1200);
  }

  function save(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.hidden = true;
    (document.querySelector('dialog[open]') || document.body).append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function deliver(blob, level) {
    const name = 'kenari-rank-' + level.n + '.png';
    let file = null;
    try { file = new File([blob], name, { type: 'image/png' }); } catch (e) { file = null; }
    let can = false;
    try { can = !!(file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })); } catch (e) { can = false; }
    if (!can) { save(blob, name); return Promise.resolve('downloaded'); }
    return navigator.share({ files: [file], title: SITE }).then(() => 'shared', (e) => {
      if (e && e.name === 'AbortError') return 'cancelled';
      /* The share sheet would not open: the picture still reaches the learner, as a download. */
      save(blob, name);
      return 'downloaded';
    });
  }

  let busy = false;
  /**
   * Makes the picture (or takes the one already made), then opens the share sheet with it,
   * or downloads it where this browser cannot share files.
   * Resolves with 'shared', 'cancelled', 'downloaded', 'failed' or 'busy'.
   */
  function rank(levelOrN) {
    const level = toLevel(levelOrN);
    if (!level || busy) return Promise.resolve('busy');
    busy = true;
    const done = (r) => { busy = false; return r; };
    /* When the picture is ready, share in this same tap, as Safari asks. */
    const ready = kept && kept.key === keyOf(level) && kept.blob;
    let got;
    try {
      got = ready ? deliver(ready, level) : image(level).then((blob) => deliver(blob, level), () => {
        K.UI.toast(FAILED);
        return 'failed';
      });
    } catch (e) {
      got = Promise.reject(e);
    }
    return got.then(done, () => done('failed'));
  }

  K.Share = { image, prepare, rank };
})();
