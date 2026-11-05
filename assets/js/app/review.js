/*
 * Kenari.Review: the short daily review (route #/review). Up to five cleared missions come back:
 * the request and an empty editor, through Kenari.Mission.mount in review mode. Clearing one moves it
 * up a Leitner box, and "I cannot recall this one" sends it back to box 1, due tomorrow.
 * This module owns the schedule: it calls State.recordReview. Mission only reports what happened.
 */
(function () {
  'use strict';
  const K = (window.Kenari = window.Kenari || {});
  const INTERVALS = [1, 3, 7, 16, 35];

  /* This tab's review so far, so a learner who wanders off and returns sees the same slip. */
  let session = null;

  const parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const longDate = (s) => parse(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const shortDate = (s) => parse(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const missions = (n) => n + (n === 1 ? ' mission' : ' missions');

  function dayWord(date, State) {
    const t = State.today();
    if (date === t) return 'today';
    if (date === State.addDays(t, 1)) return 'tomorrow';
    return longDate(date);
  }
  const interval = (box) => INTERVALS[Math.max(0, Math.min(INTERVALS.length - 1, (box || 1) - 1))];

  function reviewableLessons(State) {
    return K.lessons.filter((l) => State.isDone(l.id) && State.lesson(l.id).srs);
  }

  /** Which box a mission sits in, as five small marks. */
  function boxMarks(box) {
    const { UI } = K;
    const b = box || 1;
    return UI.el('span', { class: 'rv-marks', role: 'img', 'aria-label': 'Box ' + b + ' of ' + INTERVALS.length, title: 'Box ' + b + ' of ' + INTERVALS.length },
      INTERVALS.map((_, i) => UI.el('i', { class: i < b ? 'on' : '' })));
  }

  /** Five boxes, one per interval. Moving right means the memory is holding for longer. */
  function shelf(State, always) {
    const { UI } = K;
    const el = UI.el;
    const counts = INTERVALS.map(() => 0);
    reviewableLessons(State).forEach((l) => { counts[Math.min(INTERVALS.length, State.lesson(l.id).srs.box || 1) - 1]++; });
    const total = counts.reduce((a, b) => a + b, 0);
    if (!total && !always) return null;
    return el('section', { class: 'rv-shelf', 'aria-labelledby': 'rv-shelf-h' },
      el('h2', { id: 'rv-shelf-h', text: total ? 'How long each one is holding' : 'How the boxes work' }),
      el('p', { class: 'rv-sub', text: 'A mission you clear in review moves one box to the right and comes back later. One you cannot recall returns to the first box, with no penalty.' }),
      el('ol', { class: 'rv-boxes' }, INTERVALS.map((days, i) => el('li', { class: counts[i] ? 'has' : '' },
        total ? el('span', { class: 'rv-box-n', html: UI.dm(String(counts[i]), { p: 3 }) }) : null,
        el('span', { class: 'rv-box-l', text: days === 1 ? 'Back in 1 day' : 'Back in ' + days + ' days' })))));
  }

  /** What is coming on the next days: printed lines, not tiles. */
  function comingUp(State) {
    const { UI } = K;
    const el = UI.el;
    const t = State.today();
    const byDay = new Map();
    reviewableLessons(State).forEach((l) => {
      const due = State.lesson(l.id).srs.due;
      const day = due <= t ? State.addDays(t, 1) : due;
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(l);
    });
    const days = [...byDay.keys()].sort().slice(0, 5);
    if (!days.length) return null;
    const crowded = days.some((d) => byDay.get(d).length > 5);
    return el('section', { class: 'rv-coming', 'aria-labelledby': 'rv-coming-h' },
      el('h2', { id: 'rv-coming-h', text: 'Coming up' }),
      crowded ? el('p', { class: 'rv-sub', text: 'You never get more than five in a day. Anything over that rolls to the next day.' }) : null,
      el('ul', { class: 'rv-lines' }, days.map((day) => {
        const list = byDay.get(day);
        const names = list.slice(0, 3).map((l) => l.id + ' ' + l.title).join(', ') + (list.length > 3 ? ', and ' + (list.length - 3) + ' more' : '');
        return el('li', {},
          el('span', { class: 'rv-line-d', text: shortDate(day) }),
          el('span', { class: 'rv-line-n', text: missions(list.length) }),
          el('span', { class: 'rv-line-t', text: names }));
      })));
  }

  function render(container) {
    const { UI, State } = K;
    const el = UI.el;
    UI.setTitle('Review');
    const root = document.documentElement;
    const page = el('div', { class: 'rv' });
    container.append(page);
    let stopMission = null;
    let leaveMission = null;
    let alive = true;

    if (session && session.date !== State.today()) session = null;

    const stopCurrent = () => {
      if (leaveMission) leaveMission();
      leaveMission = null;
      if (stopMission) { try { stopMission(); } catch (e) { console.error(e); } }
      stopMission = null;
      delete root.dataset.reviewing;
    };

    /* ---------- Nothing due ---------- */
    function showCalm() {
      stopCurrent();
      const next = State.nextReviewDate();
      const t = State.today();
      const cur = State.current();
      const waiting = reviewableLessons(State).filter((l) => State.lesson(l.id).srs.due <= t).length;
      const did = State.reviewedToday();
      const wrap = el('div', { class: 'wrap wrap-narrow rv-calm' });

      if (!next) {
        wrap.append(
          el('header', { class: 'tl-head' },
            el('h1', { class: 'page-title', text: 'Nothing to review yet' }),
            el('p', { class: 'page-lead', text: 'A mission you clear comes back here the next day, right as it starts to fade, and then at longer and longer gaps. Quizzes stay cleared and do not come back.' })),
          cur ? el('a', { class: 'key canary big rv-go', href: '#/m/' + cur.id }, State.doneCount() ? 'Continue: Mission ' + cur.id + ' ' + cur.title : 'Start Mission ' + cur.id, el('span', { html: UI.icons.arrow })) : null,
          shelf(State, true));
      } else {
        const capped = waiting > 0;
        const when = capped ? 'tomorrow' : dayWord(next, State);
        const dueThatDay = capped ? waiting : reviewableLessons(State).filter((l) => State.lesson(l.id).srs.due === next).length;
        wrap.append(el('header', { class: 'tl-head' },
          el('h1', { class: 'page-title', text: did ? 'That is today\'s review done' : 'Nothing is due today' }),
          el('p', { class: 'page-lead' },
            capped
              ? 'Five a day is plenty. ' + (waiting === 1 ? 'One more mission is' : waiting + ' more missions are') + ' waiting, and they will be here tomorrow.'
              : 'Your next review is ' + (when === longDate(next) ? 'on ' : '') + when + (when === 'tomorrow' ? ', ' + longDate(next) : '') + ', with ' + missions(Math.min(dueThatDay, 5)) + '. Nothing you need to do until then.')));
        wrap.append(el('div', { class: 'rv-calm-act' },
          cur ? el('a', { class: 'key rv-go', href: '#/m/' + cur.id }, 'Continue: Mission ' + cur.id + ' ' + cur.title, el('span', { html: UI.icons.arrow })) : el('a', { class: 'key rv-go', href: '#/scratchpad', text: 'Open the Scratchpad' })));
        const s = shelf(State);
        if (s) wrap.append(s);
        const c = comingUp(State);
        if (c) wrap.append(c);
      }
      page.replaceChildren(wrap);
    }

    /* ---------- Start ---------- */
    function showStart(due) {
      stopCurrent();
      const did = session ? session.done.length : State.reviewedToday();
      const first = due[0];
      const startBtn = el('button', { type: 'button', class: 'key canary big rv-go', onClick: () => showMission(0) },
        did ? 'Continue with ' + first.id + ' ' + first.title : 'Start with ' + first.id + ' ' + first.title,
        el('span', { html: UI.icons.arrow }));
      const wrap = el('div', { class: 'wrap wrap-narrow rv-start' },
        el('header', { class: 'tl-head' },
          el('h1', { class: 'page-title', text: did ? 'Pick up where you stopped' : 'Today\'s review' }),
          el('p', { class: 'page-lead', text: (due.length === 1 ? 'One cleared mission comes back' : due.length + ' cleared missions come back') + ' today, so what you learned stays with you. No teaching and no blanks this time: you get the request and write the query yourself. Hints open after two failed runs.' })),
        /* The button comes before the list, so it is on screen on a short laptop too. */
        el('div', { class: 'rv-start-act' }, startBtn),
        el('ol', { class: 'rv-due' }, due.map((l) => {
          const s = State.lesson(l.id);
          return el('li', {},
            el('span', { class: 'rv-due-id', text: l.id }),
            el('span', { class: 'rv-due-t' }, el('b', { text: l.title }), el('small', { text: 'Level ' + l.level.n + ', ' + l.level.title })),
            el('span', { class: 'rv-due-h' }, boxMarks(s.srs && s.srs.box)));
        })));
      const s = shelf(State);
      if (s) wrap.append(s);
      page.replaceChildren(wrap);
      if (!UI.coarse()) startBtn.focus({ preventScroll: true });
    }

    /* ---------- One mission ---------- */
    function ensureSession() {
      if (!session) session = { date: State.today(), startedAfter: State.reviewedToday(), done: [] };
      return session;
    }
    function settle(lesson, ok) {
      const s = ensureSession();
      if (s.done.some((d) => d.id === lesson.id)) return;
      const srs = State.recordReview(lesson.id, ok);
      s.done.push({ id: lesson.id, title: lesson.title, ok, box: srs.box, due: srs.due });
      if (K.Header && K.Header.refresh) K.Header.refresh();
    }
    function advance() {
      if (!alive) return;
      const due = State.dueReviews();
      if (due.length) showMission(0);
      else showSummary();
    }

    function showMission() {
      stopCurrent();
      const due = State.dueReviews();
      if (!due.length) { showSummary(); return; }
      const lesson = due[0];
      const s = ensureSession();
      const doneCount = s.done.length;
      const total = doneCount + due.length;
      const seenBefore = State.lesson(lesson.id).answerSeen;
      let settled = false;

      const pips = el('span', { class: 'rv-pips', 'aria-hidden': 'true' }, Array.from({ length: total }, (_, i) => {
        const d = s.done[i];
        return el('i', { class: d ? (d.ok ? 'ok' : 'back') : i === doneCount ? 'now' : '' });
      }));
      const giveUp = el('button', {
        type: 'button', class: 'plain rv-giveup', text: 'I cannot recall this one',
        onClick: () => {
          if (settled) return;
          settled = true;
          settle(lesson, false);
          UI.toast('No problem. ' + lesson.id + ' comes back tomorrow.');
          advance();
        }
      });
      /* On a phone the site header and tabs step aside during a review, so the strip carries the way out. */
      const backBtn = el('button', {
        type: 'button', class: 'iconbtn rv-back', 'aria-label': 'Leave the review for now', html: UI.icons.left,
        onClick: () => {
          stopCurrent();
          const left = State.dueReviews();
          if (left.length) showStart(left);
          else showSummary();
        }
      });
      const strip = el('div', { class: 'rv-strip' },
        backBtn,
        el('b', { class: 'rv-pos', text: 'Review ' + (doneCount + 1) + ' of ' + total }),
        pips,
        el('span', { class: 'sp' }),
        giveUp);
      const host = el('div', { class: 'rv-host' });
      page.replaceChildren(el('div', { class: 'rv-flow' }, strip, host));
      root.dataset.reviewing = '1';

      const moreAfter = due.length - 1;
      const onDone = (info) => {
        if (settled) return;
        settled = true;
        /* A pass after opening the answer in this review does not count as remembering it. */
        const sawAnswer = (info && (info.answerSeen || info.gaveUp)) || (!seenBefore && State.lesson(lesson.id).answerSeen);
        const ok = !(info === false || (info && info.ok === false)) && !sawAnswer;
        settle(lesson, ok);
      };
      try {
        stopMission = K.Mission.mount(host, lesson, {
          mode: 'review',
          onDone,
          onNext: advance,
          nextLabel: moreAfter > 0 ? 'Next review' : 'See how it went'
        });
      } catch (e) {
        console.error(e);
        host.append(el('p', { class: 'page-lead', text: 'This mission could not open. Your progress is safe. Reload the page to try again.' }));
      }
      /* Once it has passed, giving up no longer makes sense. A pass also counts if they leave before pressing Next. */
      const ms = host.querySelector('.ms');
      const isPassed = () => !!ms && ms.classList.contains('is-passed');
      let watch = null;
      if (ms && window.MutationObserver) {
        watch = new MutationObserver(() => { giveUp.hidden = isPassed(); });
        watch.observe(ms, { attributes: true, attributeFilter: ['class'] });
      }
      leaveMission = () => {
        if (watch) watch.disconnect();
        if (isPassed()) onDone({ ok: true });
      };
    }

    /* ---------- Summary ---------- */
    function showSummary() {
      stopCurrent();
      const done = session ? session.done : [];
      if (!done.length) { showCalm(); return; }
      const held = done.filter((d) => d.ok).length;
      const back = done.length - held;
      const next = State.nextReviewDate();
      const t = State.today();
      const waiting = reviewableLessons(State).filter((l) => State.lesson(l.id).srs.due <= t).length;
      const cur = State.current();

      const lead = back === 0
        ? (held === 1 ? 'You still had it. It moves up a box and comes back later.' : 'You still had all ' + held + '. They move up a box and come back later.')
        : held === 0
          ? 'These were hard today, and that is what this is for. They come back tomorrow.'
          : held + ' of ' + done.length + ' came straight back to you. The ' + (back === 1 ? 'other one returns' : 'other ' + back + ' return') + ' tomorrow, and that is what this is for.';

      const slip = el('div', { class: 'paper rv-slip' },
        el('div', { class: 'rv-slip-h' },
          el('h2', { tabindex: '-1', text: 'Review slip' }),
          el('span', { class: 'rv-slip-date', text: UI.stampDate(t) })),
        el('table', { class: 'rv-slip-t' },
          el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'Keterangan' }), el('th', { scope: 'col', text: 'Result' }), el('th', { scope: 'col', class: 'r', text: 'Back on' }))),
          el('tbody', {}, done.map((d) => el('tr', {},
            el('td', {}, el('span', { class: 'rv-slip-id', text: d.id }), ' ', d.title),
            el('td', { class: d.ok ? 'ok' : 'back', text: d.ok ? 'Cleared' : 'Back to the first box' }),
            el('td', { class: 'r', text: shortDate(d.due) }))))),
        el('p', { class: 'rv-slip-foot' }, 'E. & O.E. ', el('span', { text: done.length + (done.length === 1 ? ' review' : ' reviews') + ' posted today.' })),
        held === done.length ? el('div', { class: 'rv-slip-stamp' }) : null);
      if (held === done.length) slip.classList.add('has-stamp');

      const nextLine = waiting
        ? (waiting === 1 ? 'One more mission is' : waiting + ' more missions are') + ' waiting. Five a day is plenty, so they will be here tomorrow.'
        : next ? 'Your next review is ' + (dayWord(next, State) === longDate(next) ? 'on ' : '') + dayWord(next, State) + '.' : '';

      const wrap = el('div', { class: 'wrap wrap-narrow rv-sum' },
        el('header', { class: 'tl-head' },
          el('h1', { class: 'page-title', text: 'That is today\'s review done' }),
          el('p', { class: 'page-lead', text: lead })),
        slip,
        nextLine ? el('p', { class: 'rv-next', text: nextLine }) : null,
        el('div', { class: 'rv-start-act' }, cur
          ? el('a', { class: 'key canary big rv-go', href: '#/m/' + cur.id }, 'Continue: Mission ' + cur.id + ' ' + cur.title, el('span', { html: UI.icons.arrow }))
          : el('a', { class: 'key canary big rv-go', href: '#/', text: 'Back to the home page' })));
      const sh = shelf(State);
      if (sh) wrap.append(sh);
      page.replaceChildren(wrap);

      const stampHost = slip.querySelector('.rv-slip-stamp');
      if (stampHost) {
        /* Everyday wins stay small: a modest stamp, with no flare. */
        UI.stamp(stampHost, { small: 'REVIEW', size: 104, rot: -9, left: 0, top: 0, flare: false, jolt: slip, still: !UI.motionOK() });
      }
      UI.announce('Review done. ' + lead);
      const h = slip.querySelector('h2');
      if (h) h.focus({ preventScroll: true });
    }

    /* ---------- Open ---------- */
    const due = State.dueReviews();
    if (due.length) showStart(due);
    else if (session && session.done.length) showSummary();
    else showCalm();

    return () => {
      alive = false;
      stopCurrent();
    };
  }

  K.Review = {
    /** After progress is reset or restored, this tab's review so far no longer applies. */
    forget() { session = null; },
    render
  };
})();
