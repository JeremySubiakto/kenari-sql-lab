/*
 * Kenari.evaluate: the one path for judging an attempt. The mission screen, review and the
 * self-test all use it. The logic matches runExpected, runAttempt and attemptState in scripts/verify.mjs.
 */
(function () {
  'use strict';
  const K = (window.Kenari = window.Kenari || {});
  const cache = new Map();

  const lastOf = (results) => (results && results.length ? results[results.length - 1] : null);

  /** Solution result, or for mode:'state', solution then stateQuery on a fresh copy. Cached. Null when there is nothing to compare to. */
  K.expected = function (lesson) {
    if (cache.has(lesson.id)) return cache.get(lesson.id);
    let p;
    if (!lesson.solution || (lesson.mode === 'state' && lesson.stateCheck)) {
      p = Promise.resolve(null);
    } else if (lesson.mode === 'state') {
      p = K.Engine.runSteps([lesson.solution, lesson.stateQuery], { db: 'fresh' }).then((steps) => lastOf(steps[1].results));
    } else {
      p = K.Engine.run(lesson.solution, { db: 'reference' }).then((r) => lastOf(r.results));
    }
    cache.set(lesson.id, p);
    p.catch(() => cache.delete(lesson.id));
    return p;
  };

  const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

  /**
   * One plain sentence about what a data-changing query did, or '' if it changed nothing.
   * throwaway:true (the default) adds that this happened on a copy and the next Run starts clean.
   */
  K.describeChange = function (actions, opts) {
    const throwaway = !opts || opts.throwaway !== false;
    const said = [];
    for (const a of actions || []) {
      const t = a.target ? `<code>${K.escapeHtml(a.target)}</code>` : 'the table';
      if (/^DELETE/.test(a.verb)) said.push(`You deleted ${plural(a.rows, 'row')} from ${t}.`);
      else if (/^(INSERT|REPLACE)/.test(a.verb)) said.push(`You added ${plural(a.rows, 'row')} to ${t}.`);
      else if (/^UPDATE/.test(a.verb)) said.push(`You changed ${plural(a.rows, 'row')} in ${t}.`);
      else if (/^DROP/.test(a.verb)) said.push(`You removed ${t} completely.`);
      else if (/^CREATE/.test(a.verb)) said.push(`You created ${t}.`);
      else if (/^ALTER/.test(a.verb)) said.push(`You changed the shape of ${t}.`);
    }
    if (!said.length) return '';
    if (throwaway) said.push('That happened on a throwaway copy of the data. The next Run starts clean, with everything back in place.');
    return said.join(' ');
  };

  K.escapeHtml = (s) => KenariCheck.escapeHtml(s);

  const base = (results, changed, actions) => ({
    results: results || [],
    changed: changed === undefined ? null : changed,
    actions: actions || [],
    changeNote: K.describeChange(actions)
  });

  function explain(lesson, sql, raw) {
    return Object.assign({}, KenariCheck.explainError(raw, K.vocab, sql), {
      raw,
      tips: KenariCheck.tipsFor(lesson, sql, K.vocab)
    });
  }

  function failure(lesson, sql, e) {
    if (e && e.type === 'timeout') {
      return Object.assign(base(), {
        kind: 'timeout',
        message: 'That query was still running after 8 seconds, so I stopped it. The usual cause is a JOIN with no ON. Your query is still in the editor, and the data is fine.',
        tips: KenariCheck.tipsFor(lesson, sql, K.vocab),
        practiceLost: !!e.practiceLost
      });
    }
    if (e && e.type === 'sql') {
      /* The learner's own SQL failed. A failed check query afterwards is handled by the caller. */
      const partial = e.partial || {};
      return Object.assign(base(partial.results, partial.changed, partial.actions), { kind: 'error', error: explain(lesson, sql, e.message) });
    }
    return Object.assign(base(), {
      kind: 'engine',
      message: (e && e.message) || 'The database engine stopped unexpectedly. Press Run again.'
    });
  }

  async function runState(lesson, sql) {
    const check = lesson.stateCheck ? lesson.stateCheck.sql : lesson.stateQuery;
    let steps;
    try {
      steps = await K.Engine.runSteps([sql, check], { db: 'fresh' });
    } catch (e) {
      if (e && e.type === 'sql' && e.step === 1) {
        const mine = (e.steps && e.steps[0]) || {};
        return Object.assign(base(mine.results, mine.changed, mine.actions), {
          kind: 'checked',
          verdict: {
            state: 'fail',
            code: 'state-query',
            title: 'The check could not run',
            body: `Your SQL ran without an error, but the check that runs after it stopped with this message: <code>${K.escapeHtml(e.message)}</code>. Compare what your SQL creates or changes with what the request names.`,
            tips: KenariCheck.tipsFor(lesson, sql, K.vocab)
          }
        });
      }
      return failure(lesson, sql, e);
    }
    const mine = steps[0], after = steps[1];
    const out = base(mine.results, mine.changed, mine.actions);
    out.kind = 'checked';
    if (lesson.stateCheck) {
      const last = lastOf(after.results);
      const text = last ? last.rows.map((r) => r.join(' ')).join('\n') : '';
      out.plan = text;
      if (!new RegExp(lesson.stateCheck.mustMatch, 'i').test(text)) {
        out.verdict = {
          state: 'fail',
          code: 'state-check',
          title: 'The route has not changed yet',
          body: `After your SQL ran, the database's plan reads: <code>${K.escapeHtml(text)}</code>. This mission needs a different plan.`,
          tips: KenariCheck.tipsFor(lesson, sql, K.vocab)
        };
        return out;
      }
      const clean = KenariCheck.stripComments(sql);
      for (const q of lesson.requires || []) {
        if (!q.re.test(clean)) {
          out.verdict = { state: 'near', code: 'requires', title: 'Correct result, one more step', body: q.msg, tips: [] };
          return out;
        }
      }
      out.verdict = { state: 'pass', code: 'pass', title: 'You got it', body: '', tips: [] };
      return out;
    }
    const expected = await K.expected(lesson);
    out.expected = expected;
    out.verdict = KenariCheck.compare(lesson, expected, lastOf(after.results), sql, K.vocab);
    return out;
  }

  K.evaluate = async function (lesson, sql) {
    const text = String(sql == null ? '' : sql);
    if (KenariCheck.hasBlanks(text)) return Object.assign(base(), { kind: 'blanks' });
    if (KenariCheck.isEmptySql(text)) return Object.assign(base(), { kind: 'empty' });
    try {
      if (lesson.mode === 'state') return await runState(lesson, text);
      const [expected, r] = await Promise.all([K.expected(lesson), K.Engine.run(text, { db: 'fresh' })]);
      const out = base(r.results, r.changed, r.actions);
      out.kind = 'checked';
      out.expected = expected;
      out.ms = r.ms;
      out.verdict = KenariCheck.compare(lesson, expected, lastOf(r.results), text, K.vocab);
      return out;
    } catch (e) {
      return failure(lesson, text, e);
    }
  };
})();
