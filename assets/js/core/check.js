/*
 * Answer checking and plain-English error messages.
 * Pure functions with no DOM and no database, so the app and the test harness share them.
 * Classic script in the browser (window.KenariCheck), CommonJS in Node.
 *
 * A result object is {columns: string[], rows: any[][]}.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KenariCheck = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------- SQL text helpers ---------- */

  function stripComments(sql) {
    let out = '', i = 0, inStr = false;
    while (i < sql.length) {
      const c = sql[i], n = sql[i + 1];
      if (inStr) {
        out += c;
        if (c === "'") {
          if (n === "'") { out += n; i += 2; continue; }
          inStr = false;
        }
        i++; continue;
      }
      if (c === "'") { inStr = true; out += c; i++; continue; }
      if (c === '-' && n === '-') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
      if (c === '/' && n === '*') { i += 2; while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++; i += 2; continue; }
      out += c; i++;
    }
    return out;
  }

  /** Split on semicolons outside strings. Comments are removed. */
  function splitStatements(sql) {
    const clean = stripComments(sql), parts = [];
    let cur = '', inStr = false;
    for (let i = 0; i < clean.length; i++) {
      const c = clean[i];
      if (c === "'") inStr = !inStr;
      if (c === ';' && !inStr) { parts.push(cur); cur = ''; } else cur += c;
    }
    parts.push(cur);
    return parts.map((p) => p.trim()).filter(Boolean);
  }

  const BLANK = /_{3,}/;
  const hasBlanks = (sql) => BLANK.test(stripComments(sql));
  const isEmptySql = (sql) => !stripComments(sql).trim();

  /** Put fill values into a starter's blanks, in order. */
  function fillBlanks(starter, fill) {
    let i = 0;
    return starter.replace(/_{3,}/g, (m) => (i < fill.length ? fill[i++] : m));
  }

  /* ---------- Traps: friendly nudges for common mistakes ---------- */

  const maskStrings = (clean) => clean.replace(/'(?:[^']|'')*'?/g, "''");

  /** True when a plain JOIN has no ON or USING. CROSS JOIN is deliberate, and a joined subquery is skipped over. */
  function joinWithoutOn(clean) {
    const masked = maskStrings(clean);
    const re = /\b(CROSS\s+|NATURAL\s+)?JOIN\b/gi;
    let m;
    while ((m = re.exec(masked))) {
      if (m[1]) continue;
      let rest = masked.slice(re.lastIndex).replace(/^\s+/, '');
      if (rest[0] === '(') {
        let depth = 0, i = 0;
        for (; i < rest.length; i++) {
          if (rest[i] === '(') depth++;
          else if (rest[i] === ')' && --depth === 0) { i++; break; }
        }
        rest = rest.slice(i);
      }
      const next = rest.match(/\b(ON|USING|JOIN|WHERE|GROUP|ORDER|HAVING|LIMIT|UNION|EXCEPT|INTERSECT|SELECT)\b|\)|;/i);
      if (!next || !/^(ON|USING)$/i.test(next[0])) return true;
    }
    return false;
  }

  /** True when COUNT(*) and a LEFT JOIN sit in the same SELECT, not merely in the same statement. */
  function leftJoinCountStar(clean) {
    return maskStrings(clean).split(/\bSELECT\b/i).some((block) => /\bCOUNT\s*\(\s*\*\s*\)/i.test(block) && /\bLEFT\s+(OUTER\s+)?JOIN\b/i.test(block));
  }

  const GLOBAL_TRAPS = [
    { re: /(^|[^!<>])=\s*NULL\b/i, msg: '<code>= NULL</code> never matches anything, because NULL means "unknown". Write <code>IS NULL</code>.' },
    { re: /(<>|!=)\s*NULL\b/i, msg: '<code>&lt;&gt; NULL</code> never matches anything. Write <code>IS NOT NULL</code>.' },
    { re: /"[^"\n]+"/, msg: 'Double quotes mean a column name in SQL. Text values use single quotes, like <code>\'KTA\'</code>.' },
    { test: joinWithoutOn, msg: 'This JOIN has no <code>ON</code>, so every row gets paired with every row. Add <code>ON</code> to say which columns match.' },
    { test: leftJoinCountStar, msg: 'After a LEFT JOIN, <code>COUNT(*)</code> counts an unmatched row as 1. To get a true 0, count a column from the joined table.' },
    { re: /\b100\s*\*[^.\n]*\/|\/\s*(COUNT|SUM)\s*\([^)]*\)\s*\*\s*100\b(?!\.)/i, msg: 'If both sides of a division are whole numbers, the decimals get dropped. Write <code>100.0</code> to keep them.' }
  ];

  /** Vocabulary can be passed as a plain list of values, or as {values, columns, tables}. */
  const vocabOf = (v) => (Array.isArray(v) ? { values: v } : (v || {}));

  /** Capital-letter mistakes, like 'kta' when the data says 'KTA'. */
  function valueCaseTips(sql, values) {
    const tips = [];
    const clean = stripComments(sql);
    const re = /'((?:[^']|'')*)'/g;
    let m;
    const seen = new Set();
    while ((m = re.exec(clean))) {
      const lit = m[1];
      if (seen.has(lit)) continue;
      seen.add(lit);
      const hit = (values || []).find((v) => v.toLowerCase() === lit.trim().toLowerCase());
      if (hit && hit !== lit) tips.push(`Text has to match exactly. The data says <code>'${hit}'</code>, and you wrote <code>'${escapeHtml(lit)}'</code>.`);
    }
    return tips;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** Tips relevant to this SQL: the lesson's own traps first, then the general ones. Exams give none. */
  function tipsFor(lesson, sql, vocab) {
    if (lesson && lesson.exam) return [];
    const clean = stripComments(sql), tips = [];
    for (const t of (lesson && lesson.traps) || []) if (t.re.test(clean)) tips.push(t.msg);
    for (const t of GLOBAL_TRAPS) if (t.test ? t.test(clean) : t.re.test(clean)) tips.push(t.msg);
    tips.push(...valueCaseTips(sql, vocabOf(vocab).values));
    return [...new Set(tips)].slice(0, 2);
  }

  /** Double-quoted text that is not a column, table or alias. Some engines accept it as text, most reject it. */
  function doubleQuotedText(sql, vocab) {
    const v = vocabOf(vocab);
    const known = new Set([...(v.columns || []), ...(v.tables || [])].map((x) => x.toLowerCase()));
    const masked = maskStrings(stripComments(sql));
    const re = /"([^"\n]+)"/g;
    let m;
    while ((m = re.exec(masked))) {
      if (/\bAS\s*$/i.test(masked.slice(0, m.index))) continue;
      if (!known.has(m[1].toLowerCase())) return m[1];
    }
    return null;
  }

  /* ---------- Comparing a result to the expected answer ---------- */

  function norm(v, lesson) {
    if (v === null || v === undefined) return '\u0000NULL';
    if (typeof v === 'number' || typeof v === 'bigint') {
      const p = lesson && lesson.precision != null ? lesson.precision : 2;
      const f = Math.pow(10, p);
      return String(Math.round(Number(v) * f) / f);
    }
    if (v instanceof Uint8Array) return 'blob:' + Array.from(v).join(',');
    const s = String(v);
    return lesson && lesson.ci ? s.trim().toLowerCase() : s;
  }

  const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

  function columnKey(rows, i, lesson) {
    return rows.map((r) => norm(r[i], lesson)).sort().join('\u0001');
  }

  /**
   * Compare two columns as numbers, to spot a rounding difference. A query that already rounds
   * only counts as close when the difference is about one decimal place, so real logic errors
   * are not blamed on rounding.
   */
  function nearlySameColumn(rowsA, i, rowsB, j, alreadyRounds) {
    const a = rowsA.map((r) => r[i]), b = rowsB.map((r) => r[j]);
    if (!a.every((v) => typeof v === 'number') || !b.every((v) => typeof v === 'number')) return false;
    const sa = [...a].sort((x, y) => x - y), sb = [...b].sort((x, y) => x - y);
    const limit = alreadyRounds ? 0.06 : 0.51;
    return sa.every((v, k) => Math.abs(v - sb[k]) <= limit);
  }

  /** Line up the learner's columns with the expected ones by matching names, then by position. */
  function alignByName(expected, actual) {
    const lower = actual.columns.map((c) => String(c).toLowerCase());
    const taken = new Set(), map = [];
    expected.columns.forEach((c, j) => {
      let i = lower.indexOf(String(c).toLowerCase());
      if (i < 0 || taken.has(i)) i = -1;
      if (i >= 0) taken.add(i);
      map[j] = i;
    });
    map.forEach((v, j) => {
      if (v < 0) {
        let k = 0;
        while (taken.has(k)) k++;
        taken.add(k); map[j] = k;
      }
    });
    return map;
  }

  /**
   * @returns {{state:'pass'|'near'|'fail', title:string, body:string, tips:string[], code:string}}
   */
  function compare(lesson, expected, actual, sql, vocab) {
    const fail = (code, title, body) => {
      const tips = tipsFor(lesson, sql, vocab);
      const hint = literalTip(lesson, sql);
      if (hint && tips.length < 2) tips.push(hint);
      return { state: 'fail', code, title, body, tips };
    };
    const near = (code, title, body) => ({ state: 'near', code, title, body, tips: [] });
    /* Feedback must not mention ideas the learner has not met yet. */
    const level = parseInt(String(lesson.id), 10);
    const knowsGroupBy = !(level < 2), knowsJoin = !(level < 3);

    if (!actual || !actual.columns || !actual.columns.length) {
      return fail('no-table', 'No table came back', 'This mission needs a query that returns rows, which means a <code>SELECT</code>.');
    }

    const u = actual.rows.length, e = expected.rows.length;

    if (actual.columns.length !== expected.columns.length) {
      const need = expected.columns.map((c) => `<code>${escapeHtml(c)}</code>`).join(', ');
      const star = /\bSELECT\s+\*/i.test(stripComments(sql));
      const body = `Your result has ${plural(actual.columns.length, 'column')}, and this request needs ${plural(expected.columns.length, 'column')}: ${need}.`
        + (star && actual.columns.length > expected.columns.length ? ' <code>SELECT *</code> shows every column, so list only the ones asked for.' : '');
      return fail('columns', 'Check your columns', body);
    }

    const map0 = alignByName(expected, actual);
    const keyAt = (r, ix) => ix.map((i) => norm(r[i], lesson)).join('\u0001');

    if (u !== e) {
      let body = `You returned ${plural(u, 'row')}, and the answer has ${plural(e, 'row')}.`;
      const eKeys = new Set(expected.rows.map((r) => keyAt(r, expected.columns.map((_, i) => i))));
      const uKeys = new Set(actual.rows.map((r) => keyAt(r, map0)));
      const allExpectedFound = [...eKeys].every((k) => uKeys.has(k));
      const allMineExpected = [...uKeys].every((k) => eKeys.has(k));
      if (u === 0) body += ' Nothing matched, so check your filter and the exact spelling of any text.';
      else if (u === 1 && e > 1 && knowsGroupBy) body += ' If you wanted one row per group, you need <code>GROUP BY</code>.';
      else if (u > e && allExpectedFound) body += ' All the right rows are there, plus some extras. Something that narrows the rows, such as a filter or a LIMIT, may be missing.';
      else if (u < e && allMineExpected) body += knowsJoin ? ' Every row you returned is correct, but some are missing. A filter or LIMIT may be too strict, or a JOIN may be dropping rows.' : ' Every row you returned is correct, but some are missing. A filter or LIMIT may be too strict.';
      else if (u > e) body += knowsJoin ? ' Too many rows usually means a missing filter or grouping, or a JOIN that repeats rows.' : (knowsGroupBy ? ' Too many rows usually means a missing filter or grouping.' : ' Too many rows usually means a filter is missing or too loose.');
      else body += knowsJoin ? ' Too few rows usually means a strict filter, or a plain JOIN dropping rows with no match.' : ' Too few rows usually means a filter is too strict.';
      return fail('rows', 'The row count is off', body);
    }

    const alreadyRounds = /\bROUND\s*\(/i.test(stripComments(sql));

    /* Map each expected column to a learner column holding the same values */
    const map = [], taken = new Set();
    for (let j = 0; j < expected.columns.length; j++) {
      const key = columnKey(expected.rows, j, lesson);
      let found = -1;
      if (!taken.has(map0[j]) && columnKey(actual.rows, map0[j], lesson) === key) found = map0[j];
      for (let i = 0; found < 0 && i < actual.columns.length; i++) {
        if (!taken.has(i) && columnKey(actual.rows, i, lesson) === key) found = i;
      }
      if (found < 0) {
        const name = escapeHtml(expected.columns[j]);
        const close = actual.columns.some((_, i) => !taken.has(i) && nearlySameColumn(actual.rows, i, expected.rows, j, alreadyRounds));
        if (close) return fail('rounding', 'So close', `The numbers for <code>${name}</code> are nearly right. Check the rounding the request asks for.`);
        return fail('values', 'Right shape, different values', `You have the right number of rows and columns, but nothing matches <code>${name}</code>. Check the formula or filter behind it.`);
      }
      taken.add(found); map[j] = found;
    }

    const a = actual.rows.map((r) => keyAt(r, map)).sort();
    const b = expected.rows.map((r) => keyAt(r, expected.columns.map((_, i) => i))).sort();
    if (a.join('\u0002') !== b.join('\u0002')) {
      return fail('pairing', 'The columns do not line up', 'Each column looks right by itself, but the values are paired up differently across rows. Check your JOIN condition and grouping.');
    }

    if (lesson.ordered) {
      const j = expected.columns.indexOf(lesson.ordered);
      const seqU = actual.rows.map((r) => norm(r[map[j]], lesson)).join('\u0001');
      const seqE = expected.rows.map((r) => norm(r[j], lesson)).join('\u0001');
      if (seqU !== seqE) return fail('order', 'Right rows, wrong order', `The values are all correct, but the sort order is not. Check your <code>ORDER BY</code> on <code>${escapeHtml(lesson.ordered)}</code>.`);
    }

    /* Right numbers under the wrong names: a column named like an expected one holds another column's values */
    const lower = actual.columns.map((c) => String(c).toLowerCase());
    for (let j = 0; j < expected.columns.length; j++) {
      const at = lower.indexOf(String(expected.columns[j]).toLowerCase());
      if (at >= 0 && at !== map[j] && columnKey(actual.rows, at, lesson) !== columnKey(expected.rows, j, lesson)) {
        return near('labels', 'Right numbers, swapped labels', `Your values are correct, but <code>${escapeHtml(expected.columns[j])}</code> is the name on the wrong column. Whoever reads this report trusts the labels, so swap them.`);
      }
    }

    const quoted = doubleQuotedText(sql, vocab);
    if (quoted) {
      return near('dquote', 'Correct result, one more step', `Write <code>'${escapeHtml(quoted)}'</code> with single quotes. Double quotes mean a column name in SQL. This lab happens to accept them for text, but most databases at work will raise an error.`);
    }

    const clean = stripComments(sql);
    for (const q of lesson.requires || []) {
      if (!q.re.test(clean)) return near('requires', 'Correct result, one more step', q.msg);
    }

    return { state: 'pass', code: 'pass', title: 'You got it', body: '', tips: [] };
  }

  /* ---------- Database errors in plain English ---------- */

  function editDistance(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const r = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let p = r[0];
      r[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const t = r[j];
        r[j] = Math.min(r[j] + 1, r[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1));
        p = t;
      }
    }
    return r[b.length];
  }

  /** Nearest known name, allowing about one wrong letter in three. Swapped neighbors, as in FORM for FROM, count as one. */
  function closest(name, list, maxDistance) {
    const allowed = Math.min(maxDistance == null ? 3 : maxDistance, Math.max(1, Math.floor(name.length / 3)));
    let best = null, bd = allowed + 1;
    const sorted = (s) => s.toLowerCase().split('').sort().join('');
    for (const x of list) {
      let v = editDistance(name, x);
      if (v === 2 && x.length === name.length && sorted(x) === sorted(name)) v = 1;
      if (v < bd && v > 0) { bd = v; best = x; }
    }
    return best;
  }

  const KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'LIMIT', 'JOIN', 'LEFT', 'INNER', 'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'BETWEEN', 'LIKE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'WITH', 'DISTINCT', 'OVER', 'PARTITION', 'ASC', 'DESC', 'UNION', 'ALL', 'EXISTS', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'VIEW', 'INDEX', 'DROP', 'BEGIN', 'COMMIT', 'ROLLBACK', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND'];

  /* What people call a column at work, mapped to its name in this database. */
  const COLUMN_ALIASES = {
    kol: 'collectibility', kolektibilitas: 'collectibility', collectability: 'collectibility', grade: 'collectibility', quality: 'collectibility',
    balance: 'outstanding', saldo: 'outstanding', os: 'outstanding', outstanding_balance: 'outstanding',
    days_past_due: 'dpd', days_late: 'dpd', overdue: 'dpd', tunggakan: 'dpd',
    plafon: 'principal', plafond: 'principal',
    angsuran: 'installment', instalment: 'installment',
    rate: 'interest_rate', bunga: 'interest_rate',
    customer_name: 'full_name', nama: 'full_name', nasabah: 'full_name',
    phone_number: 'phone', telepon: 'phone', hp: 'phone',
    produk: 'product', cabang: 'branch_name', branch: 'branch_name'
  };
  const NAME_NOTE = 'Nothing broke. This is the SQL version of #NAME? in Excel, and every Run starts from a clean copy of the data.';

  /**
   * @param {string} msg raw database error
   * @param {{columns?:string[], tables?:string[], values?:string[]}} vocab
   * @param {string} [sql] the query that failed, used to tell similar errors apart
   * @returns {{title:string, plain:string, token:(string|null), fix:(null|{from:string,to:string}), useColumn:(string|null), note:(string|null)}}
   *   plain is HTML-safe. token is the word to mark in the editor. fix is a one-click replacement, offered only when
   *   confident. useColumn is the column to highlight in the Tables list. note is a calm extra line.
   */
  function explainError(msg, vocab, sql) {
    const v = vocabOf(vocab);
    const clean = sql ? maskStrings(stripComments(sql)) : '';
    const out = (title, plain, token, extra) => Object.assign({ title, plain, token: token || null, fix: null, useColumn: null, note: null }, extra || {});
    const code = (t) => `<code>${escapeHtml(t)}</code>`;
    const columns = v.columns || [], tables = v.tables || [];
    let m;

    if ((m = msg.match(/no such column:\s*(.+)/))) {
      const raw = m[1].replace(/\s*-\s*should this be a string literal.*$/i, '').trim().replace(/^"(.*)"$/, '$1');
      const parts = raw.split('.'), name = parts.pop(), prefix = parts.pop() || null;

      const value = (v.values || []).find((x) => x.toLowerCase() === raw.toLowerCase());
      if (value) {
        return out('This looks like text', `The database thinks ${code(raw)} is a column name. Text goes in single quotes: ${code(`'${value}'`)}.`, raw, { fix: { from: raw, to: `'${value}'` } });
      }

      if (prefix) {
        const short = sql ? new RegExp(`\\b(?:FROM|JOIN)\\s+${prefix.replace(/\W/g, '')}\\s+(?:AS\\s+)?([A-Za-z_]\\w*)`, 'i').exec(clean) : null;
        const shortName = short && !KEYWORDS.includes(short[1].toUpperCase()) ? short[1] : null;
        if (shortName) {
          return out('Use the short name', `This table has the short name ${code(shortName)}. Once a table has a short name, the full name stops working in that query, so write ${code(`${shortName}.${name}`)}.`, raw, { fix: { from: raw, to: `${shortName}.${name}` } });
        }
        const exists = columns.some((c) => c.toLowerCase() === name.toLowerCase());
        if (exists) return out('Check the part before the dot', `The database cannot find ${code(raw)}. A column called ${code(name)} does exist in this bank, so check that ${code(prefix)} is the right short name, and that its table really has that column.`, raw, { useColumn: name });
        const close = closest(name, columns);
        return out('That name is not here', `The database cannot find ${code(raw)}.${close ? ` Did you mean ${code(close)}?` : ''}`, raw, { useColumn: close, note: NAME_NOTE });
      }

      const alias = COLUMN_ALIASES[name.toLowerCase()];
      if (alias && columns.includes(alias)) {
        return out('Right idea, different name', `People may say ${code(name)} at work. In this database the column is called ${code(alias)}.`, name, { fix: { from: name, to: alias }, useColumn: alias, note: NAME_NOTE });
      }
      if (columns.some((c) => c.toLowerCase() === name.toLowerCase())) {
        return out('That column is in another table', `A column called ${code(name)} exists, but not in the tables this query uses. Check your FROM and JOIN lines.`, name, { useColumn: name });
      }
      const typo = closest(name, columns, 1);
      if (typo) return out('Check the spelling', `There is no column called ${code(name)}. Did you mean ${code(typo)}?`, name, { fix: { from: name, to: typo }, useColumn: typo, note: NAME_NOTE });
      const maybe = closest(name, columns);
      return out('That name is not here', `There is no column called ${code(name)} in the tables this query uses.${maybe ? ` Did you mean ${code(maybe)}?` : ''} If it is text, put it in single quotes.`, name, { useColumn: maybe, note: NAME_NOTE });
    }

    if ((m = msg.match(/no such table:\s*(.+)/))) {
      const name = m[1].trim(), near = closest(name, tables, 5);
      return out('That table is not here', `There is no table called ${code(name)}.${near ? ` Did you mean ${code(near)}?` : ' The full table list is one click away, under All tables.'}`, name, near ? { fix: { from: name, to: near } } : {});
    }

    if ((m = msg.match(/near "(.+?)": syntax error/))) {
      const word = m[1], up = word.toUpperCase();
      const stuck = 'The database got stuck here';
      /* A two-word value typed with no quotes, such as Written Off */
      const twoWord = (v.values || []).find((x) => x.includes(' ') && x.toLowerCase().split(' ').includes(word.toLowerCase()));
      if (twoWord) return out('This looks like text', `The database stopped at ${code(word)}. It looks like part of a text value, so put the whole value in single quotes: ${code(`'${twoWord}'`)}.`, word);
      if (up === 'FROM') return out(stuck, `The problem is right before ${code('FROM')}. The usual cause is an extra comma after the last column.`, word);
      if (['WHERE', 'GROUP', 'ORDER', 'HAVING', 'LIMIT'].includes(up)) return out(stuck, `The problem is around ${code(up)}. Clauses have to go in this order: SELECT, FROM, JOIN, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT. Also check the line before it for a stray comma.`, word);
      if (word === ',') return out(stuck, 'There is a comma in an unexpected place. Commas only go between items in a list.', word);
      if (word === ')') return out(stuck, 'There is a closing bracket the database did not expect. Check that the brackets pair up and nothing is missing right before it.', word);
      /* Only offer a keyword when one letter is wrong or two are swapped. A wrong confident guess teaches nonsense. */
      const near = /^[A-Za-z_]+$/.test(word) && word.length >= 3 ? closest(up, KEYWORDS, 1) : null;
      if (near) return out('Check the spelling', `The database does not recognize ${code(word)}. Did you mean ${code(near)}?`, word, { fix: { from: word, to: near } });
      return out(stuck, `The database got confused at ${code(word)}. Look right before it for something missing: a comma, a bracket, a symbol such as =, or a keyword.`, word);
    }

    const trouble = 'The database did not understand that';
    if (/incomplete input/.test(msg)) return out(trouble, 'The query ended too early. Look for a missing closing bracket, or a clause with nothing after it.');
    if (/unrecognized token/.test(msg)) return out(trouble, 'There is a character the database cannot read. The usual cause is a text value with an unclosed quote.');
    if (/misuse of (aliased )?aggregate/.test(msg)) {
      if (/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(DISTINCT\s+)?(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(clean)) {
        return out('One step too many at once', 'One summary function cannot sit directly inside another, as in <code>AVG(COUNT(*))</code>. Work out the inner one first in a subquery or a CTE, then summarize that result.');
      }
      return out('This belongs in HAVING', 'COUNT, SUM and AVG do not work in <code>WHERE</code>, because WHERE runs before grouping. To filter on a summary, use <code>HAVING</code>.', 'WHERE');
    }
    if (/misuse of (aliased )?window function/.test(msg)) return out('This needs one more step', 'Window functions run after WHERE and GROUP BY, so you cannot filter on one in the same query. Calculate it in a CTE, then filter in the next step.');
    if ((m = msg.match(/ambiguous column name:\s*(.+)/))) {
      const name = m[1].trim();
      return out('Which table do you mean?', `${code(name)} exists in more than one of your tables, so the database does not know which you mean. Put the table's short name in front, like ${code(`l.${name}`)}.`, name);
    }
    if (/HAVING/.test(msg) && /GROUP BY/.test(msg)) return out(trouble, 'HAVING filters groups, so it needs a <code>GROUP BY</code> before it.', 'HAVING');
    if ((m = msg.match(/no such function:\s*(.+)/))) {
      return out('That function is not here', `This lab runs SQLite, which has no function called ${code(m[1].trim())}. Other databases may have it. The Cheat sheet lists the common differences.`, m[1].trim());
    }
    if ((m = msg.match(/table (.+) already exists/))) return out('That name is taken', `A table called ${code(m[1].trim())} already exists here. Pick another name, or reset the practice data.`, m[1].trim());
    if (/UNIQUE constraint failed|NOT NULL constraint failed|FOREIGN KEY constraint failed|CHECK constraint failed/.test(msg)) return out('A table rule said no', 'A rule on the table refused this change, which is exactly what those rules are for. The message below names the column.');
    if (/cannot start a transaction within a transaction/.test(msg)) return out('A transaction is already open', 'Finish the open one with <code>COMMIT</code> or <code>ROLLBACK</code> first.', 'BEGIN');
    if (/SELECTs to the left and right of UNION/.test(msg) || /do not have the same number of result columns/.test(msg)) return out('The two sides do not match', 'Both sides of a UNION need the same number of columns.', 'UNION');
    return out(trouble, 'Read the database message below from the end, because it usually names the exact word that confused it.');
  }

  /** When only one number or text value differs from the model answer, point at it without giving the answer away. */
  function literalTip(lesson, sql) {
    if (!lesson || !lesson.solution || lesson.exam) return null;
    const tokens = (s) => stripComments(s).match(/'(?:[^']|'')*'|\b\d+(?:\.\d+)?\b/g) || [];
    const a = tokens(lesson.solution), b = tokens(sql);
    if (!a.length || a.length !== b.length) return null;
    const diff = b.filter((x, i) => x.toLowerCase() !== a[i].toLowerCase());
    if (diff.length !== 1) return null;
    return `Nearly everything lines up. Take another look at <code>${escapeHtml(diff[0])}</code> and check it against the request.`;
  }

  return { stripComments, splitStatements, hasBlanks, isEmptySql, fillBlanks, tipsFor, compare, explainError, escapeHtml, closest, GLOBAL_TRAPS };
});
