/*
 * Kenari.Engine: the page's only door to SQLite. See docs/APP-API.md.
 * Jobs run one at a time. Each job gets 8 seconds. After that the worker is terminated,
 * a new one starts from the saved seed bytes, and the job rejects with {type:'timeout'}.
 */
(function () {
  'use strict';
  const K = (window.Kenari = window.Kenari || {});
  const TIMEOUT_MS = 8000;
  const LOAD_LIMIT_MS = 45000;
  const WORKER_URL = 'assets/js/engine-worker.js';
  const LOAD_FAILED = 'The database engine could not load. Bank networks sometimes block cdnjs.cloudflare.com and cdn.jsdelivr.net, which is where it comes from. The lessons still work for reading. Check the connection, then try again.';

  let worker = null;
  let seed = null;
  let status = 'idle';
  let info = null;
  let readyPromise = null;
  let readyResolve = null;
  let readyReject = null;
  let loadTimer = 0;
  let practiceTouched = false;
  let generation = 0;
  let nextId = 1;
  const queue = [];
  let active = null;
  const listeners = new Set();

  function setStatus(s) {
    status = s;
    listeners.forEach((fn) => { try { fn(s, info); } catch (e) { console.error(e); } });
  }

  function newReadyPromise() {
    readyPromise = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });
    /* Pages may never read this promise. A failed load must not show up as an unhandled rejection. */
    readyPromise.catch(() => {});
  }

  function fail(message) {
    clearTimeout(loadTimer);
    if (worker) { worker.terminate(); worker = null; }
    const err = { type: 'engine', message: message || LOAD_FAILED };
    setStatus('failed');
    readyReject(err);
    /* Everything still waiting gets the same honest answer. */
    while (queue.length) queue.shift().reject(err);
  }

  function spawn() {
    clearTimeout(loadTimer);
    generation++;
    setStatus('loading');
    try {
      worker = new Worker(WORKER_URL);
    } catch (e) {
      fail();
      return;
    }
    const w = worker;
    w.onmessage = (ev) => { if (w === worker) onMessage(ev.data); };
    w.onerror = (ev) => {
      if (w !== worker) return;
      ev.preventDefault && ev.preventDefault();
      if (status !== 'ready') fail();
      else crash('The database engine stopped unexpectedly, so it has been restarted. Press Run again.');
    };
    loadTimer = setTimeout(() => fail(), LOAD_LIMIT_MS);
    /* The worker keeps its own copy, and the page keeps one for later restarts. */
    w.postMessage({ type: 'init', seed: seed ? seed.slice(0) : undefined });
  }

  function onMessage(m) {
    if (m.type === 'ready') {
      clearTimeout(loadTimer);
      if (m.seed) seed = m.seed;
      info = { sqliteVersion: m.sqliteVersion, ms: m.ms, source: m.source };
      setStatus('ready');
      readyResolve({ sqliteVersion: m.sqliteVersion, ms: m.ms });
      pump();
      return;
    }
    if (m.type === 'failed') { fail(); return; }
    if (!active || m.id !== active.id) return;
    const job = active;
    active = null;
    clearTimeout(job.timer);
    if (m.ok) {
      job.resolve(m);
    } else {
      job.reject(m.error);
    }
    pump();
  }

  function restart() {
    if (worker) worker.terminate();
    worker = null;
    practiceTouched = false;
    newReadyPromise();
    spawn();
  }

  function crash(message) {
    const job = active;
    active = null;
    if (job) { clearTimeout(job.timer); job.reject({ type: 'engine', message }); }
    restart();
  }

  function pump() {
    if (active || !queue.length || status !== 'ready') return;
    const job = queue.shift();
    active = job;
    job.id = nextId++;
    if (job.msg.db === 'practice') practiceTouched = true;
    job.timer = setTimeout(() => {
      const lost = practiceTouched;
      active = null;
      restart();
      job.reject({ type: 'timeout', practiceLost: lost });
    }, TIMEOUT_MS);
    job.t0 = performance.now();
    worker.postMessage(Object.assign({ id: job.id }, job.msg));
  }

  function submit(msg) {
    ensureStarted();
    return new Promise((resolve, reject) => {
      if (status === 'failed') { reject({ type: 'engine', message: LOAD_FAILED }); return; }
      const job = { msg, resolve, reject };
      queue.push(job);
      pump();
    });
  }

  function ensureStarted() {
    if (status === 'idle') { newReadyPromise(); spawn(); }
  }

  const Engine = {
    get ready() { ensureStarted(); return readyPromise; },
    /** 'idle' | 'loading' | 'ready' | 'failed' */
    get status() { return status; },
    get info() { return info; },
    /** Goes up each time a new worker starts. The practice copy lives in the worker, so a new one starts empty. */
    get generation() { return generation; },
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** After a failed load: try again. Returns the new ready promise. */
    retry() {
      if (status === 'failed' || status === 'idle') { newReadyPromise(); spawn(); }
      return readyPromise;
    },
    run(sql, opts) {
      const o = opts || {};
      const t0 = performance.now();
      return submit({ type: 'run', sql: String(sql), db: o.db || 'fresh', cap: o.cap || 20000 })
        .then((r) => ({ results: r.results, changed: r.changed, actions: r.actions, ms: Math.round(performance.now() - t0) }));
    },
    runSteps(sqls, opts) {
      const o = opts || {};
      return submit({ type: 'steps', sqls: sqls.map(String), db: o.db || 'fresh', cap: o.cap || 20000 })
        .then((r) => r.steps);
    },
    resetPractice() {
      return submit({ type: 'resetPractice' }).then(() => {
        practiceTouched = false;
      });
    }
  };

  K.Engine = Engine;
})();
