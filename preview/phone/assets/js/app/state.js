/*
 * Kenari.State: progress and settings in localStorage, always in try/catch with an in-memory
 * fallback, so the app keeps working when storage is blocked. See docs/APP-API.md.
 * Dates are the learner's local calendar day, as YYYY-MM-DD.
 */
(function () {
  'use strict';
  const K = (window.Kenari = window.Kenari || {});
  const PROGRESS_KEY = 'kenari.progress.v1';
  const SETTINGS_KEY = 'kenari.settings.v1';
  const INTERVALS = [1, 3, 7, 16, 35];
  const DAILY_REVIEWS = 5;
  const FORMAT = 'kenari-sql-lab';

  let memoryOnly = false;
  let saving = true;
  const memory = {};
  const listeners = new Set();
  let data = null;
  let settings = null;

  function readRaw(key) {
    if (memoryOnly) return memory[key] || null;
    try { return localStorage.getItem(key); } catch (e) { saving = false; return memory[key] || null; }
  }
  function writeRaw(key, value) {
    memory[key] = value;
    if (memoryOnly) return;
    try { localStorage.setItem(key, value); saving = true; } catch (e) { saving = false; }
  }
  function blank() {
    return { v: 1, lessons: {}, current: null, activeDays: [], passbook: [], stamps: [], queries: 0, reviewLog: { date: null, count: 0 }, scratch: { text: null, history: [], saved: [] } };
  }
  function normalise(obj) {
    const d = Object.assign(blank(), obj || {});
    d.lessons = d.lessons && typeof d.lessons === 'object' ? d.lessons : {};
    for (const k of ['activeDays', 'passbook', 'stamps']) if (!Array.isArray(d[k])) d[k] = [];
    d.reviewLog = d.reviewLog && typeof d.reviewLog === 'object' ? d.reviewLog : { date: null, count: 0 };
    d.scratch = Object.assign({ text: null, history: [], saved: [] }, d.scratch || {});
    d.queries = Number(d.queries) || 0;
    return d;
  }
  function load() {
    try { data = normalise(JSON.parse(readRaw(PROGRESS_KEY))); } catch (e) { data = blank(); }
    try { settings = Object.assign({ theme: 'system', sound: false }, JSON.parse(readRaw(SETTINGS_KEY)) || {}); } catch (e) { settings = { theme: 'system', sound: false }; }
  }
  function store() { writeRaw(PROGRESS_KEY, JSON.stringify(data)); }
  function notify() {
    listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  }
  function commit() { store(); notify(); }

  /* ---------- Dates ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(State.now());
  const parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };

  function markActive() {
    const t = today();
    if (!data.activeDays.includes(t)) {
      data.activeDays.push(t);
      if (data.activeDays.length > 800) data.activeDays = data.activeDays.slice(-800);
    }
  }

  /* ---------- Lessons ---------- */
  const levels = () => K.levels || [];
  const lessons = () => K.lessons || [];
  const byId = (id) => (K.lessonById ? K.lessonById(id) : null);
  /* A prefilled mission has nothing to recall: the query is already written, and pressing Run is the whole task. */
  const reviewable = (lesson) => !!lesson && !lesson.prefilled && ['write', 'fix', 'order'].includes(lesson.type || 'write');

  function lessonState(id) {
    if (!data.lessons[id]) data.lessons[id] = { done: false, doneAt: null, attempts: 0, hints: 0, answerSeen: false, draft: null, srs: null };
    return data.lessons[id];
  }
  const isDone = (id) => !!(data.lessons[id] && data.lessons[id].done);
  const doneCount = () => lessons().filter((l) => isDone(l.id)).length;
  function levelProgress(n) {
    const level = levels().find((L) => L.n === n);
    const list = level ? level.lessons : [];
    return { done: list.filter((l) => isDone(l.id)).length, total: list.length };
  }
  const levelCleared = (level) => level.lessons.length > 0 && level.lessons.every((l) => isDone(l.id));

  const State = {
    /** Swappable clock, for the self-test. */
    now: () => new Date(),
    today,
    addDays,
    lesson: lessonState,
    saveDraft(id, sql) {
      lessonState(id).draft = sql;
      store();
    },
    recordAttempt(id, verdict) {
      const s = lessonState(id);
      s.attempts++;
      s.lastState = verdict && verdict.state ? verdict.state : null;
      commit();
    },
    recordPass(id) {
      const s = lessonState(id);
      const lesson = byId(id);
      const firstTime = !s.done;
      let cleared = null;
      markActive();
      if (firstTime) {
        s.done = true;
        s.doneAt = today();
        if (reviewable(lesson)) s.srs = { box: 1, due: addDays(today(), INTERVALS[0]) };
        data.passbook.push({ date: today(), id, title: lesson ? lesson.title : id, balance: doneCount(), kind: 'mission' });
        const level = lesson && lesson.level;
        if (level && levelCleared(level) && !data.stamps.some((x) => x.n === level.n)) {
          data.stamps.push({ n: level.n, rank: level.rank, title: level.title, date: today() });
          data.passbook.push({ date: today(), id: `L${level.n}`, title: level.title, rank: level.rank, n: level.n, balance: doneCount(), kind: 'level' });
          cleared = level;
        }
      }
      commit();
      return { firstTime, levelCleared: cleared, balance: doneCount() };
    },
    useHint(id) {
      const s = lessonState(id);
      s.hints++;
      commit();
      return s.hints;
    },
    markAnswerSeen(id) {
      lessonState(id).answerSeen = true;
      commit();
    },
    current() {
      const open = data.current && byId(data.current);
      if (open && !isDone(open.id)) return open;
      return lessons().find((l) => !isDone(l.id)) || null;
    },
    setCurrent(id) {
      if (data.current === id) return;
      data.current = id;
      store();
    },
    isDone,
    doneCount,
    levelProgress,
    rank() {
      let rank = 'Newcomer';
      for (const level of levels()) {
        if (!levelCleared(level)) break;
        rank = level.rank;
      }
      return rank;
    },
    /** The next rank to earn: {rank, level, left} where left is missions left in that level. Null when every level is cleared. */
    nextRank() {
      for (const level of levels()) {
        if (!levelCleared(level)) {
          return { rank: level.rank, level, left: level.lessons.filter((l) => !isDone(l.id)).length };
        }
      }
      return null;
    },
    streak() {
      const set = new Set(data.activeDays);
      const t = today();
      const activeToday = set.has(t);
      let days = 0;
      let d = activeToday ? t : addDays(t, -1);
      while (set.has(d)) { days++; d = addDays(d, -1); }
      const last7 = [];
      for (let i = 6; i >= 0; i--) last7.push(set.has(addDays(t, -i)));
      return { days, activeToday, last7 };
    },
    passbook: () => data.passbook.slice(),
    stamps: () => data.stamps.slice(),

    /* ---------- Reviews: Leitner boxes at 1, 3, 7, 16 and 35 days ---------- */
    dueReviews(limit) {
      const t = today();
      const log = data.reviewLog.date === t ? data.reviewLog.count : 0;
      const room = Math.max(0, Math.min(limit == null ? DAILY_REVIEWS : limit, DAILY_REVIEWS - log));
      return lessons()
        .filter((l) => reviewable(l) && isDone(l.id) && data.lessons[l.id].srs && data.lessons[l.id].srs.due <= t)
        .sort((a, b) => (data.lessons[a.id].srs.due < data.lessons[b.id].srs.due ? -1 : data.lessons[a.id].srs.due > data.lessons[b.id].srs.due ? 1 : a.index - b.index))
        .slice(0, room);
    },
    nextReviewDate() {
      let best = null;
      for (const l of lessons()) {
        const s = data.lessons[l.id];
        if (s && s.done && s.srs && reviewable(l) && (!best || s.srs.due < best)) best = s.srs.due;
      }
      return best;
    },
    recordReview(id, ok) {
      const s = lessonState(id);
      const box = ok ? Math.min((s.srs ? s.srs.box : 1) + 1, INTERVALS.length) : 1;
      s.srs = { box, due: addDays(today(), INTERVALS[box - 1]) };
      const t = today();
      if (data.reviewLog.date !== t) data.reviewLog = { date: t, count: 0 };
      data.reviewLog.count++;
      markActive();
      commit();
      return s.srs;
    },
    reviewedToday: () => (data.reviewLog.date === today() ? data.reviewLog.count : 0),

    bumpQueries() {
      data.queries++;
      markActive();
      store();
      return data.queries;
    },
    queryCount: () => data.queries,

    /* ---------- Backup ---------- */
    exportJson() {
      return JSON.stringify({ app: FORMAT, version: 1, exportedAt: new Date().toISOString(), progress: data, settings }, null, 1);
    },
    importJson(text) {
      let obj;
      try { obj = JSON.parse(text); } catch (e) {
        return { ok: false, message: 'That file could not be read as a progress file. Choose the file you downloaded from this menu.' };
      }
      if (!obj || obj.app !== FORMAT || !obj.progress || typeof obj.progress.lessons !== 'object' || obj.progress.lessons === null) {
        return { ok: false, message: 'That file is not a Kenari progress file. Choose the file you downloaded from this menu.' };
      }
      data = normalise(obj.progress);
      if (obj.settings && typeof obj.settings === 'object') {
        settings = Object.assign({ theme: 'system', sound: false }, obj.settings);
        writeRaw(SETTINGS_KEY, JSON.stringify(settings));
      }
      commit();
      const n = doneCount();
      return { ok: true, message: `Restored your progress: ${n} ${n === 1 ? 'mission' : 'missions'} cleared.` };
    },
    reset() {
      data = blank();
      commit();
    },

    settings: () => settings,
    setSetting(key, value) {
      settings[key] = value;
      writeRaw(SETTINGS_KEY, JSON.stringify(settings));
      notify();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Scratchpad state: {text, history:[...], saved:[...]}. Change it, then call commit(). */
    scratch: () => data.scratch,
    commit,

    /** False when the browser is blocking storage, so progress lasts only until the tab closes. */
    isSaving: () => saving && !memoryOnly,
    /** For the self-test: stop touching localStorage and start from nothing. */
    useMemoryStore() {
      memoryOnly = true;
      for (const k of Object.keys(memory)) delete memory[k];
      load();
    }
  };

  load();
  /* Another tab changed the progress. */
  window.addEventListener('storage', (e) => {
    if (e.key === PROGRESS_KEY || e.key === SETTINGS_KEY) { load(); notify(); }
  });
  K.State = State;
})();
