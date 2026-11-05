#!/usr/bin/env node
/* Run a query against the fake bank: node --no-warnings scripts/q.mjs "SELECT * FROM branches LIMIT 3" */
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const Data = require(path.join(ROOT, 'assets/js/core/data.js'));
const Check = require(path.join(ROOT, 'assets/js/core/check.js'));

const d = new DatabaseSync(':memory:');
Data.build(Data.nodeAdapter(d));
const max = 40;
for (const stmt of Check.splitStatements(process.argv.slice(2).join(' '))) {
  const st = d.prepare(stmt);
  const cols = st.columns();
  if (!cols.length) { const r = st.run(); console.log(`(${r.changes} rows changed)`); continue; }
  st.setReturnArrays(true);
  const rows = st.all();
  console.log(cols.map((c) => c.name).join(' | '));
  rows.slice(0, max).forEach((r) => console.log(r.join(' | ')));
  console.log(`(${rows.length} rows${rows.length > max ? `, first ${max} shown` : ''})`);
}
