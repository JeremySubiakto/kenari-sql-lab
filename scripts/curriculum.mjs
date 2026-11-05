#!/usr/bin/env node
/* Prints docs/CURRICULUM.md from the lesson files, so it can never drift: node --no-warnings scripts/curriculum.mjs > docs/CURRICULUM.md */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'assets/js/lessons');
fs.readdirSync(dir).filter((f) => /^level-\d+\.js$/.test(f)).forEach((f) => require(path.join(dir, f)));
const levels = globalThis.KENARI_LEVELS.slice().sort((a, b) => a.n - b.n);
const plain = (s) => String(s || '').replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1').replace(/<\/?(b|i|em|strong|code|p|br|ul|ol|li|table|tr|td|th)\b[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\|/g, '\\|');
const total = levels.reduce((n, L) => n + L.lessons.length, 0);
console.log(`# Curriculum\n\nGenerated from the lesson files by \`scripts/curriculum.mjs\`. ${levels.length} levels, ${total} missions, from never having seen SQL to professional collection analytics.\n`);
for (const L of levels) {
  console.log(`## Level ${L.n}: ${L.title} (rank: ${L.rank})\n\n${L.goal}\n\n| Mission | Type | Title | New idea |\n| --- | --- | --- | --- |`);
  for (const m of L.lessons) console.log(`| ${m.id} | ${m.exam ? 'exam' : m.checkpoint ? 'checkpoint' : (m.type || 'write')} | ${plain(m.title)} | ${plain(m.newIdea)} |`);
  console.log('');
}
