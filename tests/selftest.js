/*
 * Runs every mission through the real browser engine via Kenari.evaluate and Kenari.expected, then
 * checks the engine, the state store and the text pipeline. Mirrors scripts/verify.mjs.
 * window.__selftest = {done, total, passed, missions, failures:[...], sqliteVersion, ms}
 */
(function () {
  'use strict';
  const K = window.Kenari;
  const failures = [];
  let total = 0;
  const sectionNotes = [];
  const $ = (id) => document.getElementById(id);
  const report = (window.__selftest = { done: false, total: 0, passed: 0, missions: 0, failures, sqliteVersion: null, ms: 0 });

  function check(ok, where, message) {
    total++;
    report.total = total;
    if (!ok) {
      failures.push(where + ': ' + message);
      const li = document.createElement('li');
      li.innerHTML = '<b>' + K.UI.esc(where) + '</b> ' + K.UI.esc(message);
      $('fails').append(li);
    }
    report.passed = total - failures.length;
  }
  const paint = (text) => { $('summary').innerHTML = text; };

  /** Order-independent fingerprint. Same as digest() in scripts/verify.mjs. */
  function digest(r) {
    /* EXPLAIN QUERY PLAN's id and notused columns are internal numbers that differ between SQLite versions. Compare the plan text. */
    const source = r.columns.join() === 'id,parent,notused,detail' ? r.rows.map((row) => [row[3]]) : r.rows;
    const rows = source.map((row) => row.map((v) => (typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v))).join('\u0001')).sort();
    let h = 0;
    for (const s of rows) for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    return { n: r.rows.length, c: r.columns.length, h };
  }
  const lastOf = (results) => (results && results.length ? results[results.length - 1] : null);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const brief = (sql) => String(sql).replace(/\s+/g, ' ').slice(0, 90);
  const describe = (r) => {
    if (r.kind === 'checked') return r.verdict.state + ': ' + r.verdict.title + '. ' + K.UI.plainOf(r.verdict.body || '');
    if (r.kind === 'error') return 'error: ' + r.error.raw;
    return r.kind + (r.message ? ': ' + r.message : '');
  };

  async function expectPass(lesson, label, sql) {
    const r = await K.evaluate(lesson, sql);
    check(r.kind === 'checked' && r.verdict.state === 'pass', lesson.id, label + ' did not pass (' + describe(r) + ')');
  }

  async function testLesson(lesson, fixtures) {
    const id = lesson.id;
    const type = lesson.type || 'write';

    /* Annotated example */
    if (lesson.ex) {
      const sql = lesson.ex.map((x) => x[0]).join('\n');
      try {
        const r = await K.Engine.run(sql, { db: lesson.exState ? 'fresh' : 'reference' });
        const last = lastOf(r.results);
        if (!lesson.exNoResult && !lesson.exAllowEmpty) check(!!last && last.rows.length > 0, id, 'example returned no rows');
        else check(true, id, '');
        if (Object.prototype.hasOwnProperty.call(fixtures, id + '#ex')) {
          const want = fixtures[id + '#ex'];
          check(same(last ? digest(last) : null, want), id, 'example result differs from the Node fixture. Browser ' + JSON.stringify(last ? digest(last) : null) + ', Node ' + JSON.stringify(want));
        }
      } catch (e) { check(false, id, 'example fails: ' + (e.message || e.type)); }
    }

    /* Quiz */
    if (type === 'quiz') {
      const correct = (lesson.choices || []).filter((c) => c.correct).length;
      check(correct === 1, id, 'quiz needs exactly one correct choice, found ' + correct);
      if (lesson.code) {
        try {
          const r = await K.Engine.run(lesson.code, { db: 'reference' });
          check(true, id, '');
          if (lesson.showCodeResult) check(!!lastOf(r.results), id, 'showCodeResult is set, but the quiz code returned no table');
        } catch (e) { check(false, id, 'quiz code fails: ' + (e.message || e.type)); }
      }
      if (lesson.check) {
        try {
          const r = await K.Engine.run(lesson.check.sql, { db: 'reference' });
          const last = lastOf(r.results);
          const val = last && last.rows[0] ? String(last.rows[0][0]) : '';
          check(val === String(lesson.check.equals), id, 'quiz check expected ' + lesson.check.equals + ', data says ' + val);
        } catch (e) { check(false, id, 'quiz check fails: ' + (e.message || e.type)); }
      }
      return;
    }

    /* Expected result */
    let expected = null;
    try {
      expected = await K.expected(lesson);
      if (!(lesson.mode === 'state' && lesson.stateCheck)) {
        check(!!expected, id, 'solution returned no table');
        if (expected) {
          check(expected.rows.length > 0 || !!lesson.allowEmpty, id, 'solution returned 0 rows');
          if (Object.prototype.hasOwnProperty.call(fixtures, id)) {
            check(same(digest(expected), fixtures[id]), id, 'result differs from the Node fixture. Browser ' + JSON.stringify(digest(expected)) + ', Node ' + JSON.stringify(fixtures[id]));
          } else check(false, id, 'no fixture for this mission');
        }
      }
    } catch (e) { check(false, id, 'solution fails: ' + (e.message || e.type)); return; }

    /* Solution, alternatives, order lines */
    await expectPass(lesson, 'solution', lesson.solution);
    if (type === 'order') await expectPass(lesson, 'order lines', lesson.lines.join('\n'));
    for (let i = 0; i < (lesson.altSolutions || []).length; i++) await expectPass(lesson, 'altSolutions[' + i + ']', lesson.altSolutions[i]);

    /* Wrong attempts must not pass. An error also counts as not passing. */
    for (let i = 0; i < (lesson.wrong || []).length; i++) {
      const r = await K.evaluate(lesson, lesson.wrong[i]);
      check(!(r.kind === 'checked' && r.verdict.state === 'pass'), id, 'wrong[' + i + '] passed, and it should not: ' + brief(lesson.wrong[i]));
      check(r.kind === 'checked' || r.kind === 'error', id, 'wrong[' + i + '] gave ' + r.kind + ' instead of a verdict or an explained error');
    }

    /* Starter */
    if (lesson.starter !== undefined) {
      if (KenariCheck.hasBlanks(lesson.starter)) {
        const r = await K.evaluate(lesson, lesson.starter);
        check(r.kind === 'blanks', id, 'a starter with blanks should report blanks, got ' + r.kind);
        check(!!lesson.fill, id, 'starter has blanks but no fill');
        if (lesson.fill) await expectPass(lesson, 'starter with fill', KenariCheck.fillBlanks(lesson.starter, lesson.fill));
      } else if (type === 'fix') {
        const r = await K.evaluate(lesson, lesson.starter);
        if (lesson.starterErrors) {
          check(r.kind === 'error' || (r.kind === 'checked' && r.verdict.code === 'state-query'), id, 'starterErrors is set, but the starter gave: ' + describe(r));
        } else {
          check(r.kind === 'checked' && r.verdict.state !== 'pass', id, 'the buggy starter should run and not pass, but gave: ' + describe(r));
        }
      }
    } else {
      check(type !== 'fix', id, 'fix mission needs a starter');
    }
  }

  /* ---------- Glossary tokens, demos and copy rules across all text ---------- */
  function testText() {
    const allowed = new Set(['anatomy', 'order', 'join', 'join-left', 'group', 'fanout', 'window', 'transaction', 'index']);
    const HUMAN_MARK = 'TODO' + '(human)';
    let humanTodos = 0;
    for (const l of K.lessons) {
      const fields = [l.teach, l.task, l.question, l.bridge, l.win, l.exNote, l.atWork, l.newIdea, ...(l.hints || [])];
      (l.ex || []).forEach((x) => fields.push(x[1]));
      (l.choices || []).forEach((c) => { fields.push(c.t); fields.push(c.why); });
      for (const html of fields) {
        const text = String(html || '');
        check(!text.includes('\u2014'), l.id, 'em dash in: ' + brief(K.UI.plainOf(text)));
        const re = /\[\[([^\]]+)\]\]/g;
        let m;
        while ((m = re.exec(text))) {
          if (m[1].startsWith('demo:')) check(allowed.has(m[1].slice(5)), l.id, 'unknown demo ' + m[1]);
          else {
            const name = m[1].includes('|') ? m[1].split('|')[1] : m[1];
            check(!!K.term(name), l.id, 'glossary term not found: ' + name);
          }
        }
      }
      if (String(l.starter || '').includes(HUMAN_MARK)) {
        humanTodos++;
        check(l.id === '1.1', l.id, 'the one human mark belongs to Mission 1.1');
      }
    }
    check(humanTodos === 1, 'all', 'there must be exactly one human mark in the starters, found ' + humanTodos);
  }

  /* ---------- Rich text: tokens turn into controls ---------- */
  function testRich() {
    const node = K.UI.rich('<p>[[Kol]] and [[the grade|Kol]] and [[DPD]].</p>');
    const terms = node.querySelectorAll('.term');
    check(terms.length === 3, 'UI.rich', 'expected 3 glossary buttons, got ' + terms.length);
    check(terms[1].textContent === 'the grade' && terms[1].dataset.term === 'Kol', 'UI.rich', 'label form [[label|Term]] is wrong');
    check(K.term('kol') && K.term('KOL').term === 'Kol', 'Kenari.term', 'lookup must ignore case');
    document.body.append(node);
    terms[0].click();
    const pop = document.querySelector('.pop');
    check(!!pop && pop.querySelectorAll('tbody tr').length === 5, 'glossary popover', 'Kol must show the five grades as a table');
    check(!!pop && pop.textContent.includes('Dalam Perhatian Khusus') && pop.textContent.includes('Over 180'), 'glossary popover', 'Kol table is missing Indonesian names or day bands');
    terms[2].click();
    const pop2 = document.querySelector('.pop');
    check(!!pop2 && !pop2.querySelector('table'), 'glossary popover', 'DPD should show a definition, not the Kol table');
    document.body.click();
    check(!document.querySelector('.pop'), 'glossary popover', 'a click outside should close it');
    node.remove();
    const led = K.UI.ledger({ columns: ['loan_id', 'outstanding', 'note'], rows: [[1234567, 1234567, null]] }, {});
    check(led.querySelector('td:nth-child(2)').textContent === '1234567', 'UI.ledger', '_id columns are not grouped');
    check(led.querySelector('td:nth-child(3)').textContent === '1\u2009234\u2009567', 'UI.ledger', 'big numbers use thin-space grouping, got ' + led.querySelector('td:nth-child(3)').textContent);
    check(!!led.querySelector('.null'), 'UI.ledger', 'NULL needs its own marker');
    check(K.UI.toTSV({ columns: ['a', 'b'], rows: [[1, null]] }) === 'a\tb\n1\t', 'UI.toTSV', 'wrong tab-separated text');
    check(/t-blank/.test(K.UI.hl('SELECT ____')) && /t-kw/.test(K.UI.hl('SELECT 1')) && /t-err/.test(K.UI.hl('WHERE kol = 5', { mark: 'kol' })), 'UI.hl', 'highlight classes are missing');
    /* The highlighter keeps every character, so what is on screen is what runs. */
    const shown = (sql) => { const d = document.createElement('div'); d.innerHTML = K.UI.hl(sql); return d.textContent; };
    for (const odd of ['SELECT 1abc, 2026x, 3.5, a_1 FROM t', "strftime('____', d) -- ____", "SELECT 'it''s', \"q\", <>, %, é;", '/* open']) {
      check(shown(odd) === odd, 'UI.hl', 'changed the text of: ' + odd);
    }
    check(K.UI.hl("strftime('____', d)").includes('t-blank'), 'UI.hl', 'a blank inside quotes is a blank');
    check(!K.UI.hl('-- ____').includes('t-blank'), 'UI.hl', 'a blank in a comment is not a blank');
    for (const lesson of K.lessons) {
      for (const sql of [lesson.starter, lesson.solution, lesson.code].filter(Boolean)) {
        check(shown(sql) === sql, 'UI.hl', lesson.id + ' changed its SQL');
      }
    }
  }

  /* ---------- The engine's promises ---------- */
  async function testEngine() {
    const where = 'engine';
    /* Several statements stack, and the last is checked */
    const multi = await K.Engine.run('SELECT 1 AS a; SELECT 2 AS b; SELECT 3 AS c;');
    check(multi.results.length === 3 && multi.results[2].rows[0][0] === 3, where, 'every statement with columns must come back in order');

    /* Scared-person test: it runs, says what changed, and the next run is whole */
    const lesson = K.lessonById('1.2');
    const del = await K.evaluate(lesson, 'DELETE FROM loans;');
    check(del.kind === 'checked' && del.changed === 502, where, 'DELETE FROM loans should report 502 rows changed, got ' + del.changed);
    check(/502 rows/.test(del.changeNote) && /next Run starts clean/.test(del.changeNote), where, 'DELETE needs a plain sentence, got: ' + del.changeNote);
    const after = await K.Engine.run('SELECT COUNT(*) FROM loans');
    check(after.results[0].rows[0][0] === 502, where, 'the next run must see all 502 loans');
    const drop = await K.evaluate(lesson, 'DROP TABLE branches;');
    check(drop.kind === 'checked' && /removed/.test(drop.changeNote), where, 'DROP TABLE must run on the copy and say so, got: ' + drop.changeNote);
    const after2 = await K.Engine.run('SELECT COUNT(*) FROM branches');
    check(after2.results[0].rows[0][0] === 12, where, 'branches must be whole after DROP TABLE');

    /* Blanks, empty, errors */
    check((await K.evaluate(lesson, 'SELECT ____ FROM loans;')).kind === 'blanks', where, 'blanks kind');
    check((await K.evaluate(lesson, '  -- nothing here\n')).kind === 'empty', where, 'empty kind');
    const kol = await K.evaluate(lesson, 'SELECT * FROM loans WHERE kol = 5;');
    check(kol.kind === 'error' && kol.error.title === 'Right idea, different name' && kol.error.fix && kol.error.fix.to === 'collectibility' && kol.error.useColumn === 'collectibility', where, 'the kol error must give the fix, got ' + JSON.stringify(kol.error));
    const nonsense = await K.evaluate(lesson, 'halo apa kabar');
    check(nonsense.kind === 'error' && !nonsense.error.fix, where, 'nonsense must never offer a one-click fix, got ' + JSON.stringify(nonsense.error));

    /* Reference is read-only */
    let refused = false;
    try { await K.Engine.run('DELETE FROM loans', { db: 'reference' }); } catch (e) { refused = e.type === 'sql'; }
    check(refused, where, 'the reference copy must refuse writes');

    /* Practice persists until reset */
    await K.Engine.resetPractice();
    await K.Engine.run('CREATE TEMP TABLE t1 AS SELECT 1 AS x; DELETE FROM branches;', { db: 'practice' });
    const held = await K.Engine.run('SELECT (SELECT COUNT(*) FROM t1), (SELECT COUNT(*) FROM branches)', { db: 'practice' });
    check(held.results[0].rows[0][0] === 1 && held.results[0].rows[0][1] === 0, where, 'the practice copy must keep its changes');
    await K.Engine.resetPractice();
    const clean = await K.Engine.run('SELECT COUNT(*) FROM branches', { db: 'practice' });
    check(clean.results[0].rows[0][0] === 12, where, 'Reset practice data must restore it');

    /* A runaway query times out kindly, the worker restarts, and the app keeps working */
    await K.Engine.run('DELETE FROM branches', { db: 'practice' });
    const t0 = performance.now();
    const slow = await K.evaluate(lesson, 'SELECT COUNT(*) FROM payments, loan_snapshots, collection_activities, loans, customers;');
    const took = performance.now() - t0;
    check(slow.kind === 'timeout', where, 'a runaway query must time out, got ' + slow.kind);
    check(took >= 7500 && took < 11000, where, 'the timeout should be about 8 seconds, took ' + Math.round(took));
    check(/8 seconds/.test(slow.message), where, 'the timeout needs a kind message');
    check(slow.practiceLost === true, where, 'the timeout must say the practice copy was lost');
    const back = await K.Engine.run('SELECT COUNT(*) FROM loans');
    check(back.results[0].rows[0][0] === 502, where, 'the engine must work after a timeout');
    const rebuilt = await K.Engine.run('SELECT COUNT(*) FROM branches', { db: 'practice' });
    check(rebuilt.results[0].rows[0][0] === 12, where, 'the practice copy must be rebuilt from the seed after a timeout');

    /* The row cap */
    const capped = await K.Engine.run('SELECT 1 FROM payments p, loans l', { cap: 100 });
    check(capped.results[0].rows.length === 100 && capped.results[0].truncated === true, where, 'the row cap must truncate and say so');
    /* Cheap copies */
    const t1 = performance.now();
    for (let i = 0; i < 20; i++) await K.Engine.run('SELECT 1');
    const each = (performance.now() - t1) / 20;
    check(each < 60, where, 'a fresh copy should be cheap, took ' + Math.round(each) + ' ms each');
    sectionNotes.push('fresh copy ' + each.toFixed(1) + ' ms');
  }

  /* ---------- The state store ---------- */
  function testState() {
    const where = 'state';
    const S = K.State;
    S.useMemoryStore();
    let day = new Date(2026, 10, 2, 9, 0, 0);
    S.now = () => new Date(day);
    const nextDay = (n) => { day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + (n || 1), 9); };

    check(S.rank() === 'Newcomer', where, 'rank starts as Newcomer');
    check(S.doneCount() === 0 && S.current().id === K.lessons[0].id, where, 'a new learner starts at the first mission');
    const level0 = K.levels[0];
    let cleared = null;
    level0.lessons.forEach((l, i) => {
      const r = S.recordPass(l.id);
      check(r.firstTime === true, where, 'first pass of ' + l.id);
      check(r.balance === i + 1, where, 'balance after ' + l.id);
      if (r.levelCleared) cleared = r.levelCleared;
    });
    check(cleared === level0, where, 'clearing the last mission must return the level');
    check(S.recordPass(level0.lessons[0].id).firstTime === false, where, 'a second pass is not a first time');
    check(S.rank() === level0.rank, where, 'rank should be ' + level0.rank + ', got ' + S.rank());
    check(S.stamps().length === 1 && S.stamps()[0].n === 0, where, 'one stamp for Level 0');
    const book = S.passbook();
    check(book.length === level0.lessons.length + 1 && book[book.length - 1].kind === 'level', where, 'passbook needs a line per mission and one for the level');
    check(book[level0.lessons.length - 1].balance === level0.lessons.length, where, 'passbook balance');
    const nr = S.nextRank();
    check(nr && nr.rank === K.levels[1].rank && nr.left === K.levels[1].lessons.length, where, 'nextRank');
    check(S.levelProgress(0).done === S.levelProgress(0).total, where, 'levelProgress');

    /* Leitner: only cleared write, fix and order missions, at 1, 3, 7, 16 and 35 days */
    check(S.dueReviews().length === 0, where, 'nothing is due on the day it was cleared');
    const reviewables = level0.lessons.filter((l) => ['write', 'fix', 'order'].includes(l.type || 'write'));
    const quiz = level0.lessons.find((l) => l.type === 'quiz');
    check(!S.lesson(quiz.id).srs, where, 'a quiz never enters the review schedule');
    nextDay();
    const due = S.dueReviews(50);
    check(due.length === Math.min(reviewables.length, 5), where, 'daily cap of 5, got ' + due.length);
    check(due.every((l) => l.type !== 'quiz'), where, 'quiz in the due list');
    check(S.nextReviewDate() === S.today(), where, 'nextReviewDate');
    const id = reviewables[0].id;
    const gaps = [3, 7, 16, 35, 35];
    gaps.forEach((gap, i) => {
      const before = S.today();
      const srs = S.recordReview(id, true);
      check(srs.due === S.addDays(before, gap), where, 'box ' + (i + 2) + ' should wait ' + gap + ' days, due ' + srs.due);
    });
    check(S.lesson(id).srs.box === 5, where, 'the box tops out at 5');
    const failed = S.recordReview(id, false);
    check(failed.box === 1 && failed.due === S.addDays(S.today(), 1), where, 'giving up goes back to box 1');

    /* Streak on local days */
    S.useMemoryStore();
    day = new Date(2026, 10, 2, 9);
    S.recordPass('0.1');
    nextDay(); S.recordPass('0.2');
    nextDay(); S.bumpQueries();
    let st = S.streak();
    check(st.days === 3 && st.activeToday && st.last7.filter(Boolean).length === 3 && st.last7[6] === true, where, 'streak should be 3 days, got ' + JSON.stringify(st));
    nextDay();
    st = S.streak();
    check(st.days === 3 && !st.activeToday, where, 'a streak survives until the day ends');
    nextDay(2);
    check(S.streak().days === 0, where, 'a missed day ends the streak');

    /* Drafts, hints, current, scratch */
    S.saveDraft('1.2', 'SELECT 1');
    check(S.lesson('1.2').draft === 'SELECT 1', where, 'drafts');
    check(S.useHint('1.2') === 1 && S.useHint('1.2') === 2, where, 'useHint counts');
    S.setCurrent('1.2');
    check(S.current().id === '1.2', where, 'current returns the last opened if it is not done');
    S.recordPass('1.2');
    check(S.current().id === '0.3', where, 'current then returns the first not done, got ' + S.current().id);
    S.scratch().history.push('SELECT 1');
    S.commit();
    check(S.scratch().history.length === 1, where, 'scratch');
    let fired = 0;
    const off = S.onChange(() => fired++);
    S.useHint('1.2');
    off();
    S.useHint('1.2');
    check(fired === 1, where, 'onChange and its unsubscribe');

    /* Export, import, reset */
    const saved = S.exportJson();
    const count = S.doneCount();
    S.reset();
    check(S.doneCount() === 0 && S.passbook().length === 0, where, 'reset clears progress');
    check(S.importJson('not json').ok === false, where, 'import refuses text that is not JSON');
    check(S.importJson('{"a":1}').ok === false, where, 'import refuses another file');
    const imp = S.importJson(saved);
    check(imp.ok && S.doneCount() === count, where, 'import restores progress: ' + imp.message);
    S.setSetting('sound', true);
    check(S.settings().sound === true, where, 'settings');
    S.reset();
    delete S.now;
    S.now = () => new Date();
  }

  async function main() {
    const t0 = performance.now();
    let fixtures = {};
    try {
      fixtures = await (await fetch('tests/fixtures.json', { cache: 'no-store' })).json();
    } catch (e) { check(false, 'fixtures', 'could not load tests/fixtures.json'); }

    try {
      const info = await K.Engine.ready;
      report.sqliteVersion = info.sqliteVersion;
      sectionNotes.push('SQLite ' + info.sqliteVersion, 'engine ready in ' + info.ms + ' ms', K.Engine.info.source);
    } catch (e) {
      check(false, 'engine', 'did not load: ' + e.message);
      report.done = true;
      paint('<b>The engine did not load.</b> ' + K.UI.esc(e.message));
      return;
    }
    $('sections').textContent = sectionNotes.join('  |  ');

    testText();
    testRich();
    testState();

    report.missions = K.lessons.length;
    check(K.lessons.length === Object.values(K.levels).reduce((a, L) => a + L.lessons.length, 0), 'course', 'lesson count');
    for (let i = 0; i < K.lessons.length; i++) {
      const lesson = K.lessons[i];
      paint('Mission <b>' + lesson.id + '</b>, ' + (i + 1) + ' of ' + K.lessons.length + '. ' + total + ' checks, ' + failures.length + ' failed.');
      try { await testLesson(lesson, fixtures); } catch (e) { check(false, lesson.id, 'crash: ' + (e.stack || e.message || JSON.stringify(e))); }
    }
    paint('Testing the engine\'s promises, including an 8-second timeout.');
    try { await testEngine(); } catch (e) { check(false, 'engine', 'crash: ' + (e.stack || e.message || JSON.stringify(e))); }

    report.ms = Math.round(performance.now() - t0);
    report.passed = total - failures.length;
    report.done = true;
    $('sections').textContent = sectionNotes.join('  |  ');
    paint((failures.length ? '<b>' + failures.length + ' failed.</b> ' : '<b>All passed.</b> ')
      + K.lessons.length + ' missions, ' + total + ' checks, ' + report.passed + ' passed, ' + (report.ms / 1000).toFixed(1) + ' seconds.');
    document.title = (failures.length ? 'FAILED' : 'PASSED') + ' | Kenari self-test';
  }

  window.addEventListener('error', (e) => { check(false, 'page', e.message); });
  main();
})();
