#!/usr/bin/env node
/*
 * Plays every mission through the real screens, the way a person would, and reports anything broken.
 *
 *   node --no-warnings scripts/dev/e2e-all.mjs desktop
 *   node --no-warnings scripts/dev/e2e-all.mjs phone
 *
 * desktop (1366x625): tries a wrong answer, runs the starter, then solves the mission.
 * phone (390x720, touch, Android): follows the steps. Learn, then Try it, then Task, then the help path: every hint,
 *   Show the answer, Put it in the editor, Run, then Result. Checks that the page stays locked, Run is in view on Task,
 *   the Result step opens with rows, stamp and Next in view, and a wrong answer never flashes NOT YET on a pass.
 * Both follow Next from Mission 0.1 to the finished passbook, including every rank-up.
 */
import { launch, BASE, sleep, OUT } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const view = process.argv[2] || 'desktop';
const phone = view === 'phone';
const size = phone ? [390, 720, { mobile: true, dpr: 1 }] : [1366, 625];

const b = await launch();
const p = await b.page();
await p.viewport(...size);
if (phone) await p.android();
await p.media([{ name: 'prefers-color-scheme', value: phone ? 'light' : 'dark' }]);
await p.go(BASE + '/index.html#/m/0.1', 1500);
for (let i = 0; i < 200; i++) { if (await p.ev(`!!(window.Kenari && Kenari.Engine && Kenari.Engine.status === 'ready' && document.querySelector('.ms-run'))`).catch(() => false)) break; await sleep(100); }

const problems = [];
const stats = { missions: 0, nextMs: [], ranks: 0 };
let shots = 0;
const problem = async (id, what, extra) => {
  problems.push({ id, what, extra });
  console.log(`PROBLEM ${view} ${id}: ${what}${extra ? ' ' + JSON.stringify(extra).slice(0, 240) : ''}`);
  if (shots++ < 20) { try { await p.shot(`fail-${view}-${id}-${what.replace(/\W+/g, '-').slice(0, 30)}`); } catch { /* keep going */ } }
};

const settled = () => p.ev(`(()=>{
  const run = document.querySelector('.ms-run');
  const busy = document.querySelector('.mc-lamp[data-state="busy"]');
  if (run && run.classList.contains('is-next')) return 'pass';
  if (document.querySelector('.ms-sheet.is-landing:not(.is-stamped)')) return 'busy';
  const status = (document.querySelector('.ms-status')?.textContent || '').toLowerCase();
  if (busy || /running|printing|warming/.test(status)) return 'busy';
  if (document.querySelector('.ms-slip-b')) return 'error';
  /* Only a real wrong answer counts as a verdict. A pass band, or one still on its way to a pass, is not one, whatever its Teller validation label says. */
  if (document.querySelector('.ms-sheet:not([data-state="pass"]) .vband')) return 'verdict';
  const u = document.querySelector('.ms-under');
  if (u && !u.hidden && u.textContent.trim()) return 'under';
  return 'none';
})()`);
const waitSettled = async (ms = 11000) => {
  const t0 = Date.now(); let s = 'none';
  await sleep(120);
  while (Date.now() - t0 < ms) { s = await settled(); if (s === 'pass' || s === 'error' || s === 'verdict' || s === 'under') return { s, ms: Date.now() - t0 }; await sleep(60); }
  return { s, ms: Date.now() - t0 };
};
const setSql = (sql) => p.ev(`(()=>{const t=document.querySelector('.ms-root textarea, textarea'); if(!t) return false; t.setRangeText(${JSON.stringify(sql)},0,t.value.length,'end'); t.dispatchEvent(new Event('input',{bubbles:true})); return true;})()`);
const clickRun = () => p.ev(`(()=>{const r=document.querySelector('.ms-run'); if(!r) return false; r.click(); return true;})()`);
const layout = () => p.ev(`(()=>{
  const inView=(el)=>{ if(!el) return null; const r=el.getBoundingClientRect(); if(!r.width||!r.height) return false; return r.top>=-1&&r.left>=-1&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1; };
  const stampEl=document.querySelector('.stamp-fx');
  return { h: document.documentElement.scrollWidth-document.documentElement.clientWidth, run: inView(document.querySelector('.ms-run')), stamp: inView(stampEl), win: !!document.querySelector('.ms-win'), focus: document.activeElement&&document.activeElement.classList.contains('ms-run'), lit: document.querySelector('.ms-run')?.textContent.trim().slice(0,70) };
})()`);
/* The phone's locked screen: the page does not scroll, and the result keeps at least five rows in its own box. */
const phoneState = () => p.ev(`(()=>{
  const ms=document.querySelector('.ms'); const de=document.documentElement;
  const box=document.querySelector('.ms-sheet .lg-scroll'); const tr=box&&box.querySelector('tbody tr'); const th=box&&box.querySelector('thead tr');
  const rowsShown=box&&tr?Math.floor((box.clientHeight-(th?th.offsetHeight:0))/tr.offsetHeight):null;
  const rowCount=box?box.querySelectorAll('tbody tr').length:null;
  const tabs=[...document.querySelectorAll('.ms-seg')].filter(t=>t.offsetParent!==null).map(t=>t.textContent.trim());
  /* .lg-morecols is left out: it is 24px to look at, with a 44px hit area from its ::after on touch. */
  const small=[...document.querySelectorAll('.ms-seg,.ms-keys button,.ms-keys a,.ms-chip,.ms-cmp button,.ms-copy,.ms-band-more,.ms-req-more,.ms-toast .tlink,.sp-libseg button')].filter(b=>b.offsetParent!==null&&(b.getBoundingClientRect().height<44||b.getBoundingClientRect().width<40)).map(b=>b.textContent.trim());
  return {step:ms&&ms.dataset.step,locked:de.scrollHeight<=innerHeight+1&&scrollY===0,tabs,rowsShown,rowCount,small,notYet:!!document.querySelector('.ms-sheet[data-state="pass"] .not-yet')};
})()`);
const clickByText = (text) => p.ev(`(()=>{const el=[...document.querySelectorAll('button')].find(x=>x.offsetParent!==null&&x.textContent.trim().startsWith(${JSON.stringify(text)})); if(!el) return false; el.click(); return true;})()`);

/* A busy local test server can drop a file, which would quietly shorten the run or leave the "did not finish loading" screen. Reload, and stop if it keeps happening. */
const loaded = () => p.ev(`(window.Kenari && Kenari.levels && document.querySelector('.ms-run')) ? Kenari.levels.length : 0`).catch(() => 0);
let levelCount = await loaded();
for (let t = 0; t < 3 && levelCount !== 10; t++) {
  await p.go(BASE + '/index.html#/m/0.1', 3000);
  levelCount = await loaded();
}
if (levelCount !== 10) { console.log(`PROBLEM ${view}: the mission screen did not load (${levelCount} levels)`); await b.close(); process.exit(1); }
const ids = await p.ev(`Kenari.lessons.map(l=>l.id)`);
console.log(`${view}: ${ids.length} missions`);

for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  const hash = await p.ev('location.hash');
  if (hash !== '#/m/' + id) await problem(id, 'not on the expected mission', { hash });
  if (hash !== '#/m/' + id) { await p.ev(`location.hash=${JSON.stringify('#/m/' + id)}`); await sleep(500); }
  for (let w = 0; w < 60; w++) { if (await p.ev(`!!document.querySelector('.ms-run')`)) break; await sleep(100); }
  await sleep(350);
  const L = await p.ev(`(()=>{const l=Kenari.lessonById(${JSON.stringify(id)}); return {type:l.type||'write',exam:!!l.exam,wrong:(l.wrong||[])[0]||null,solution:l.solution||null,lines:l.lines||null,correct:l.choices?l.choices.findIndex(c=>c.correct):null,n:l.choices?l.choices.length:0,fill:l.fill||null,starter:l.starter||null,hints:(l.hints||[]).length,prefilled:!!l.prefilled,starterErrors:!!l.starterErrors}})()`);
  const before = await layout();
  if (before.h > 0) await problem(id, 'page scrolls sideways on open', before);
  if (!phone && L.type !== 'quiz' && before.run !== true) await problem(id, 'Run not visible on open', before);
  if (phone) {
    const st = await phoneState();
    if (!st.locked) await problem(id, 'phone page is not locked on open', st);
    const want = L.type === 'quiz' ? 'Learn,Question' : L.exam ? 'Brief,Task,Result' : 'Learn,Task,Result';
    if (st.tabs.join() !== want) await problem(id, 'wrong step tabs', st);
    if (st.step !== 'learn') await problem(id, 'a fresh mission did not open on Learn', st);
    if (st.small.length) await problem(id, 'tap target under 44px', st);
    if (!(await p.ev(`(()=>{const b=document.querySelector('.ms-try'); if(!b||b.offsetParent===null) return false; b.click(); return true;})()`))) await problem(id, 'no Try it key on Learn');
    await sleep(240);
    const st2 = await phoneState();
    if (st2.step !== 'task') await problem(id, 'Try it did not open the task step', st2);
    if (st2.small.length) await problem(id, 'tap target under 44px on task', st2);
    if (L.type !== 'quiz') {
      const l1 = await layout();
      if (l1.run !== true) await problem(id, 'Run not visible on the task step', l1);
    }
  }

  if (L.type === 'quiz') {
    if (!phone && L.n > 1) {
      const wrongIx = L.correct === 0 ? 1 : 0;
      await p.ev(`document.querySelectorAll('.ms-choice-b')[${wrongIx}].click()`);
      await sleep(250);
      if (await p.ev(`document.querySelector('.ms-run')?.classList.contains('is-next')`)) await problem(id, 'wrong quiz choice passed');
    }
    const ok = await p.ev(`(()=>{const c=document.querySelectorAll('.ms-choice-b')[${L.correct}]; if(!c) return false; c.click(); return true;})()`);
    if (!ok) await problem(id, 'quiz choice missing');
    /* The wrong pick's verdict may still be on screen for a moment, so wait for the real thing: Next. */
    for (let w = 0; w < 80; w++) { if (await p.ev(`!!document.querySelector('.ms-run.is-next')`)) break; await sleep(100); }
  } else if (L.type === 'order') {
    if (phone && L.hints) {
      for (let h = 0; h < L.hints; h++) { await p.ev(`document.querySelector('.ms-hintb')?.click()`); await sleep(40); }
      await clickByText('Show the answer'); await sleep(60);
      if (!(await clickByText('Put these lines'))) await problem(id, 'no Put these lines button');
      await sleep(100);
    } else {
      for (const line of L.lines) {
        const ok = await p.ev(`(()=>{const t=[...document.querySelectorAll('.ms-tile')].find(x=>x.getAttribute('aria-label')==='Add this line to your query: '+${JSON.stringify(line)}&&!x.hidden); if(!t) return false; t.click(); return true;})()`);
        if (!ok) await problem(id, 'order tile missing', { line });
        await sleep(40);
      }
    }
    await clickRun();
  } else {
    if (!phone) {
      if (L.starter && !L.prefilled) {
        await clickRun();
        const r = await waitSettled();
        if (r.s === 'pass') await problem(id, 'unsolved starter passed');
        if (r.s === 'none' || r.s === 'busy') await problem(id, 'starter gave no feedback', r);
      }
      if (L.wrong) {
        await setSql(L.wrong); await sleep(60); await clickRun();
        const r = await waitSettled();
        if (r.s === 'pass') await problem(id, 'wrong answer passed', { sql: L.wrong.slice(0, 120) });
        if (r.s === 'none' || r.s === 'busy') await problem(id, 'wrong answer gave no feedback', r);
        const l2 = await layout();
        if (l2.run !== true) await problem(id, 'Run off screen after wrong answer', l2);
        if (l2.h > 0) await problem(id, 'sideways scroll after wrong answer', l2);
      }
      const answer = L.fill && L.starter ? await p.ev(`KenariCheck.fillBlanks(${JSON.stringify(L.starter)}, ${JSON.stringify(L.fill)})`) : L.solution;
      await setSql(answer); await sleep(60);
    } else if (L.hints && !L.exam && !L.prefilled) {
      for (let h = 0; h < L.hints; h++) { await p.ev(`document.querySelector('.ms-hintb')?.click()`); await sleep(40); }
      if (!(await clickByText('Show the answer'))) await problem(id, 'no Show the answer button after all hints');
      await sleep(60);
      if (!(await clickByText('Put it in the editor'))) await problem(id, 'no Put it in the editor button');
      await sleep(100);
    } else if (!L.prefilled) {
      await setSql(L.solution); await sleep(60);
    }
    await clickRun();
  }

  const t0 = Date.now();
  /* NOT YET must never show on the way to a pass, so watch the whole print. */
  await p.ev(`(()=>{window.__notYet=0;clearInterval(window.__nyTimer);window.__nyTimer=setInterval(()=>{if(document.querySelector('.ms-sheet[data-state="pass"] .not-yet'))window.__notYet++;},16);})()`);
  const r = await waitSettled(14000);
  if (r.s !== 'pass') {
    await problem(id, 'mission did not pass', { state: r.s, status: await p.ev(`document.querySelector('.ms-status, .mc-status')?.textContent`), body: await p.ev(`document.querySelector('.vband, .ms-slip-b')?.innerText.slice(0,220)`) });
    await p.ev(`location.hash=${JSON.stringify('#/m/' + (ids[i + 1] || id))}`); await sleep(400);
    continue;
  }
  stats.nextMs.push(Date.now() - t0);
  stats.missions++;
  await sleep(150);
  const l3 = await layout();
  if (l3.run !== true) await problem(id, 'Next off screen after pass', l3);
  if (l3.stamp !== true) await problem(id, 'stamp off screen after pass', l3);
  if (!l3.win) await problem(id, 'no win text after pass', l3);
  if (l3.h > 0) await problem(id, 'sideways scroll after pass', l3);
  if (!l3.focus) await problem(id, 'focus not on Next after pass', l3);
  if (await p.ev(`(clearInterval(window.__nyTimer),window.__notYet)`)) await problem(id, 'NOT YET showed on a pass');
  if (phone) {
    const st3 = await phoneState();
    if (!st3.locked) await problem(id, 'phone page is not locked after pass', st3);
    if (L.type !== 'quiz' && st3.step !== 'result') await problem(id, 'pass did not open the result step', st3);
    if (st3.rowCount != null && st3.rowsShown < Math.min(5, st3.rowCount)) await problem(id, 'fewer than 5 rows in view after pass', st3);
    if (st3.small.length) await problem(id, 'tap target under 44px on result', st3);
    const left = await p.ev(`document.querySelector('.ms-saldo b').textContent`);
    if (String(left) !== String(await p.ev(`Kenari.State.doneCount()`))) await problem(id, 'mission bar Saldo did not tick', { left });
  }
  await sleep(380);
  await clickRun();
  await sleep(250);
  if (/see your new rank/i.test(l3.lit || '')) {
    let up = false;
    for (let w = 0; w < 30; w++) { if (await p.ev(`!!document.querySelector('.rk-go')`)) { up = true; break; } await sleep(100); }
    if (!up) await problem(id, 'no rank-up sheet'); else {
      stats.ranks++;
      await sleep(900);
      if (shots < 20 && stats.ranks <= 1) await p.shot(`rank-${view}-${id}`);
      const inView = await p.ev(`(()=>{const r=document.querySelector('.rk-go').getBoundingClientRect(); return r.top>=0&&r.bottom<=innerHeight})()`);
      if (!inView) await problem(id, 'rank-up button off screen');
      await p.ev(`document.querySelector('.rk-go').click()`);
      await sleep(500);
    }
  }
  if ((i + 1) % 25 === 0) console.log(`${view}: ${i + 1}/${ids.length}, problems so far ${problems.length}`);
  if (p.errors.length) { await problem(id, 'console error', p.errors.splice(0, 3)); }
}

await sleep(800);
const end = { hash: await p.ev('location.hash'), saldo: await p.ev(`Kenari.State.doneCount()`), rank: await p.ev(`Kenari.State.rank()`), stamps: await p.ev(`Kenari.State.stamps().length`) };
await p.shot(`finished-${view}`);
const sorted = stats.nextMs.slice().sort((a, c) => a - c);
const summary = { view, cleared: stats.missions, total: ids.length, ranks: stats.ranks, end, passMs: { median: sorted[sorted.length >> 1], max: sorted[sorted.length - 1] }, problems };
writeFileSync(join(OUT, `e2e-${view}.json`), JSON.stringify(summary, null, 1));
console.log(`DONE ${view}: cleared ${stats.missions}/${ids.length}, rank-ups ${stats.ranks}, problems ${problems.length}, end ${JSON.stringify(end)}, pass ms median ${summary.passMs.median} max ${summary.passMs.max}`);
await b.close();
