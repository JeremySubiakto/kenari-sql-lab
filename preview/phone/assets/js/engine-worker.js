/*
 * Runs SQLite (sql.js) off the main thread, so a runaway query never freezes the page.
 * engine.js owns this worker and terminates it on a timeout. Protocol:
 *
 *   {type:'init', seed?:ArrayBuffer}                 -> {type:'ready', sqliteVersion, ms, source, seed}
 *   {id, type:'run', sql, db, cap}                   -> {id, ok:true, results, changed, actions}
 *   {id, type:'steps', sqls, db, cap}                -> {id, ok:true, steps:[{results, changed, actions}]}
 *   {id, type:'resetPractice'}                       -> {id, ok:true}
 *   failures                                         -> {id, ok:false, error:{type:'sql', message, step, partial}}
 */
'use strict';
importScripts('core/data.js');

const SOURCES = [
  { base: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/', file: 'sql-wasm.js' },
  { base: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/', file: 'sql-asm.js' },
  { base: 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/', file: 'sql-wasm.js' },
  { base: 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/', file: 'sql-asm.js' }
];

let SQL = null;
let seed = null;       // Uint8Array of the freshly built bank. Opening a copy from it costs a few ms.
let reference = null;  // read-only, for expected answers
let practice = null;   // persistent private copy for the Scratchpad

async function loadSql() {
  let last = null;
  for (const src of SOURCES) {
    try {
      self.initSqlJs = undefined;
      importScripts(src.base + src.file);
      const lib = await self.initSqlJs({ locateFile: (f) => src.base + f });
      return { lib, source: src.base + src.file };
    } catch (e) { last = e; }
  }
  throw last || new Error('sql.js did not load');
}

function open(kind) {
  if (kind === 'reference') {
    if (!reference) {
      reference = new SQL.Database(seed);
      reference.run('PRAGMA query_only = 1');
    }
    return reference;
  }
  if (kind === 'practice') {
    if (!practice) practice = new SQL.Database(seed);
    return practice;
  }
  return new SQL.Database(seed);
}

const stripLead = (sql) => String(sql).replace(/^(\s|--[^\n]*\n?|\/\*[\s\S]*?\*\/)+/, '');
const VERB = /^(DELETE\s+FROM|INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DROP\s+(?:TABLE|VIEW|INDEX|TRIGGER)(?:\s+IF\s+EXISTS)?|CREATE\s+(?:TEMP(?:ORARY)?\s+)?(?:UNIQUE\s+)?(?:TABLE|VIEW|INDEX|TRIGGER)(?:\s+IF\s+NOT\s+EXISTS)?|ALTER\s+TABLE|BEGIN|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE)\b\s*(?:"?([A-Za-z_][\w.]*)"?)?/i;

/** What a statement that returned no table did, for "say plainly what changed". */
function describe(sql, rows) {
  const m = VERB.exec(stripLead(sql));
  if (!m) return null;
  const verb = m[1].replace(/\s+/g, ' ').toUpperCase();
  const isDml = /^(DELETE|INSERT|REPLACE|UPDATE)/.test(verb);
  return { verb, target: m[2] || null, rows: isDml ? rows : 0, dml: isDml };
}

/** Run every statement. Every statement that has columns gives a result set. */
function execAll(db, sql, cap) {
  const results = [], actions = [];
  const it = db.iterateStatements(sql);
  let changed = null, step;
  try {
    while (!(step = it.next()).done) {
      const stmt = step.value;
      const columns = stmt.getColumnNames();
      if (columns.length) {
        const rows = [];
        let truncated = false;
        while (stmt.step()) {
          if (rows.length >= cap) { truncated = true; break; }
          rows.push(stmt.get());
        }
        results.push({ columns, rows, truncated });
      } else {
        while (stmt.step()) { /* no rows to collect */ }
        const act = describe(stmt.getSQL(), db.getRowsModified());
        if (act) {
          actions.push(act);
          changed = (changed || 0) + act.rows;
        }
      }
    }
  } catch (e) {
    try { it.finalize && it.finalize(); } catch (x) { /* already finished */ }
    e.partial = { results, changed, actions };
    throw e;
  }
  return { results, changed, actions };
}

function sqlError(e, stepIndex) {
  return { type: 'sql', message: String((e && e.message) || e), step: stepIndex, partial: (e && e.partial) || null };
}

self.onmessage = async (ev) => {
  const m = ev.data;
  if (m.type === 'init') {
    const t0 = performance.now();
    try {
      const { lib, source } = await loadSql();
      SQL = lib;
      if (m.seed) seed = new Uint8Array(m.seed);
      else {
        const d = new SQL.Database();
        KenariData.build(KenariData.sqljsAdapter(d));
        seed = d.export();
        d.close();
      }
      const probe = new SQL.Database();
      const sqliteVersion = probe.exec('SELECT sqlite_version()')[0].values[0][0];
      probe.close();
      /* A copy of the seed goes to the page, so a restart after a timeout does not rebuild the bank. */
      const copy = m.seed ? null : seed.slice().buffer;
      self.postMessage({ type: 'ready', sqliteVersion, ms: Math.round(performance.now() - t0), source, seed: copy }, copy ? [copy] : []);
    } catch (e) {
      self.postMessage({ type: 'failed', message: String((e && e.message) || e) });
    }
    return;
  }

  const reply = (body) => self.postMessage(Object.assign({ id: m.id }, body));
  const cap = m.cap || 20000;
  try {
    if (m.type === 'resetPractice') {
      if (practice) practice.close();
      practice = null;
      reply({ ok: true });
    } else if (m.type === 'run') {
      const db = open(m.db);
      try {
        reply(Object.assign({ ok: true }, execAll(db, m.sql, cap)));
      } catch (e) {
        reply({ ok: false, error: sqlError(e, 0) });
      } finally {
        if (db !== reference && db !== practice) db.close();
      }
    } else if (m.type === 'steps') {
      const db = open(m.db);
      const steps = [];
      try {
        for (let i = 0; i < m.sqls.length; i++) {
          try {
            steps.push(execAll(db, m.sqls[i], cap));
          } catch (e) {
            const err = sqlError(e, i);
            err.steps = steps;
            reply({ ok: false, error: err });
            return;
          }
        }
        reply({ ok: true, steps });
      } finally {
        if (db !== reference && db !== practice) db.close();
      }
    }
  } catch (e) {
    reply({ ok: false, error: { type: 'engine', message: String((e && e.message) || e) } });
  }
};
