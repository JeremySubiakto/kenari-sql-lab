# App structure and shared contract

Static site with no build step. Classic scripts with `defer`, all hanging off one global: `window.Kenari`. Screen modules can be built in parallel because this contract is fixed. If you must change a signature, change it here too.

## Files

```
index.html                        shell: header, nav, <main id="view">, overlays, script tags in order
.nojekyll
assets/icon.svg                   favicon, a stamp mark
assets/img/og.png                 link preview, 1200x630, under 300 KB so WhatsApp shows it
assets/css/tokens.css             color, type and spacing tokens, light and dark
assets/css/base.css               reset, typography, buttons, forms, layout helpers
assets/css/components.css         shared parts only: keys, terminal, syntax colors, code block, paper, ledger, ticket, verdict band, help slip, stamp, toast, popover, modal, sheet, rosette, weave
assets/css/editor.css             owned by the editor agent
assets/css/mission.css            owned by the mission agent (Review reuses it)
assets/css/home.css               owned by the home agent (Home, Journey, Passbook, rank-up)
assets/css/tools.css              owned by the review, scratchpad and cheat sheet agents
assets/css/demos.css              owned by the demos agent
assets/js/core/data.js            DONE. KenariData: SCHEMA, LINKS, VALUES, build, adapters
assets/js/core/check.js           DONE. KenariCheck: compare, tipsFor, explainError, hasBlanks, ...
assets/js/core/reference.js       DONE. KenariRef: GLOSSARY, EXCEL_MAP, DIALECTS
assets/js/lessons/level-0..9.js   DONE. Pushes onto globalThis.KENARI_LEVELS
assets/js/app/glyphs.js           DONE. Outline letters for stamps and microprint (Kenari.GLYPHS)
assets/js/engine-worker.js        Web Worker running sql.js
assets/js/app/engine.js           Kenari.Engine
assets/js/app/state.js            Kenari.State
assets/js/app/ui.js               Kenari.UI
assets/js/app/demos.js            Kenari.Demos
assets/js/app/editor.js           Kenari.Editor
assets/js/app/evaluate.js         Kenari.evaluate, Kenari.expected
assets/js/app/mission.js          Kenari.Mission  (routes #/m/ID)
assets/js/app/home.js             Kenari.Home     (routes #/ and #/journey and #/passbook)
assets/js/app/share.js            Kenari.Share    (the Share this rank picture on the rank-up sheet)
assets/js/app/review.js           Kenari.Review   (route #/review)
assets/js/app/scratch.js          Kenari.Scratch  (route #/scratchpad)
assets/js/app/sheet.js            Kenari.Sheet    (route #/cheatsheet)
assets/js/app/main.js             router, boot, settings menu, Kenari.About (route #/about)
test.html, tests/selftest.js      runs every mission through the real browser engine
tests/fixtures.json               DONE. Expected result digests from scripts/verify.mjs --fixtures
```

## Kenari.levels and Kenari.lessons

`main.js` sorts `KENARI_LEVELS` by `n`, then sets:

- `Kenari.levels`: the level objects
- `Kenari.lessons`: flat array in course order, each lesson also given `lesson.level` (its level object) and `lesson.index`
- `Kenari.lessonById(id)`, `Kenari.nextLesson(id)`, `Kenari.prevLesson(id)`
- `Kenari.glossary`: `KenariRef.GLOSSARY` merged with every level's `terms`, later levels winning, with case-insensitive lookup via `Kenari.term(name)`, which returns `{term, def}` or `null`
- `Kenari.vocab`: `{values: KenariData.VALUES, columns: [...], tables: [...]}`, passed to every KenariCheck call

An `order` mission with no `solution` uses `lesson.lines.join('\n')`. `main.js` fills this in, so `lesson.solution` is always set except on quizzes.

Also from `main.js`:

- `Kenari.navigate(hash)` goes to a route. `Kenari.refresh()` rebuilds the current screen.
- `Kenari.Header.hold()` stops the Saldo from updating, and `Kenari.Header.release()` ticks it. On a pass, call `hold()` before `State.recordPass`, then `release()` in the stamp's `onImpact`. `Kenari.Header.refresh()` repaints the Saldo and the Review badge.
- `document.documentElement.dataset.route` is `home`, `mission`, `review`, `scratchpad`, `cheatsheet`, `about` or `notfound`, so a screen's CSS can target `html[data-route="mission"]`.
- `Kenari.levels` and friends also load in `test.html`, which has no `#view`, so nothing there routes.
- Below 1000px: `.tabbar` is the site navigation, hidden on `html[data-route="mission"]`, `html[data-reviewing]` and while a field has the keyboard (`html[data-typing]`). `--tabbar-h` and `--shell-bottom` give its height, and `body` keeps that much bottom padding.
- `html[data-section]` is `journey` or `passbook` on those routes. Below 1000px, CSS shows one section of Home at a time from it. Moving between sections fires `kenari:section` on `document`.
- `--vvh` on `:root`, below 1000px: the visible height from `visualViewport`. Locked screens use `height:var(--vvh,100dvh)`.
- `Kenari.booted` turns true at the end of `main.js`. Until then, a script or stylesheet of ours that fails to load, or an error during boot, replaces the opening note with a message and a reload link. An inline script in `index.html` does this.

## Kenari.Engine

Wraps the worker. The UI never touches sql.js directly.

```js
Engine.ready                     // Promise<{sqliteVersion, ms}>; rejects {type:'engine', message} if sql.js cannot load
Engine.run(sql, {db, cap})       // db: 'fresh' (default) | 'practice' | 'reference'
  // -> Promise<{results: [{columns, rows, truncated}], changed: number|null, ms}>
  // results holds EVERY statement that returned columns, in order. cap default 20000 rows.
  // rejects {type:'sql', message} | {type:'timeout'} | {type:'engine', message}
Engine.runSteps([sqlA, sqlB], {db})   // runs each on the SAME database copy
  // -> Promise<[{results, changed}, ...]>; a failure rejects with {type:'sql', message, step}
Engine.resetPractice()           // Promise<void>
```

Timeout is 8 seconds: terminate the worker, start a new one, reject `{type:'timeout', practiceLost}`. Jobs run one at a time, and each job's clock starts when it reaches the worker. `practiceLost` is true when the practice copy had been used since its last reset. The new worker starts with an empty practice copy, and `Engine.generation` goes up. The practice copy lives in the worker, so a reload or a restart empties it. Scratchpad keeps every run that changed it in `State.scratch().practice` and plays them back before its next query, so changes stay until Reset practice data.

Additions to the above:

```js
Engine.run(...)                  // result also has actions: [{verb:'DELETE FROM', target:'loans', rows:502, dml:true}, ...], one per statement that returned no table
                                 // changed is null when only SELECTs ran, and a number once a data or schema statement ran (DROP counts as 0 rows)
                                 // a {type:'sql'} rejection also has partial: {results, changed, actions} for what ran before the failure
Engine.status                    // 'idle' | 'loading' | 'ready' | 'failed'. Show "Warming up the database" while it is 'loading'.
Engine.onStatus(fn)              // fn(status, info). Returns an unsubscribe function.
Engine.retry()                   // after 'failed': try again. Returns the new ready promise.
Engine.info                      // {sqliteVersion, ms, source} once ready
Engine.generation                // goes up each time a new worker starts
```

Run queues until the engine is ready. `Engine.ready` is a getter, because a failed load or a restart makes a new promise. Read it each time.

## Kenari.evaluate

The one path for judging an attempt. The mission screen, review and the self-test all use it.

```js
Kenari.expected(lesson)   // Promise<result>, cached. Solution result, or for mode:'state', solution then stateQuery on a fresh copy.
Kenari.evaluate(lesson, sql)
  // -> Promise<{
  //   kind: 'blanks' | 'empty' | 'error' | 'timeout' | 'engine' | 'checked',
  //   verdict: {state:'pass'|'near'|'fail', title, body, tips, code},   // when kind is 'checked'
  //   error: {title, plain, token, fix, useColumn, note, raw, tips},    // when kind is 'error'
  //   results: [...],   // every result set from the learner's SQL, for display
  //   changed: number|null
  // }>
```

Rules, matching `scripts/verify.mjs`:

- `kind:'blanks'` if `KenariCheck.hasBlanks(sql)`. `kind:'empty'` if `KenariCheck.isEmptySql(sql)`.
- Normal mission: run the learner's SQL on a fresh copy. Compare the LAST result to `expected` with `KenariCheck.compare(lesson, expected, last, sql, Kenari.vocab)`.
- `mode:'state'` with `stateQuery`: `runSteps([sql, stateQuery])`. Compare the stateQuery's last result. `stateQuery` may hold several statements. Show the learner's own result sets, not the stateQuery's.
- `mode:'state'` with `stateCheck`: `runSteps([sql, stateCheck.sql])`. Join the rows' text with newlines and test `new RegExp(stateCheck.mustMatch, 'i')`. If it matches, also test `requires`.
- SQL error: `error = {...KenariCheck.explainError(raw, Kenari.vocab, sql), raw, tips: KenariCheck.tipsFor(lesson, sql, Kenari.vocab)}`.
- A failure of the check query itself (`mode:'state'`, the learner's SQL ran fine) is `kind:'checked'` with `verdict.code:'state-query'`, never `kind:'error'`, because the learner's own query has nothing to mark.

Extra fields on the returned object:

- `actions` and `changeNote`: `changeNote` is one plain HTML sentence about what a data-changing query did, or `''`. For `DELETE FROM loans;`: "You deleted 502 rows from loans. That happened on a throwaway copy of the data. The next Run starts clean, with everything back in place." Show it whenever it is not empty. That is the scared-person test. The verdict alone says "No table came back". `Kenari.describeChange(actions, {throwaway:false})` gives the same sentence without the throwaway part, for Scratchpad.
- `expected`: the target result, for Compare. Absent on `mode:'state'` missions with `stateCheck`, and null when there is none.
- `kind:'timeout'`: `message` (ready to show), `tips`, `practiceLost`. `kind:'engine'`: `message` (ready to show).
- `plan`: the plan text on `stateCheck` missions.

`Kenari.evaluate` does not touch `State`. The caller records attempts, passes and `State.bumpQueries()`.

## Kenari.State

Progress in `localStorage` under `kenari.progress.v1`, settings under `kenari.settings.v1`, always in try/catch with an in-memory fallback.

```js
State.lesson(id)            // {done, doneAt, attempts, hints, answerSeen, draft, srs:{box, due}}, created on demand. srs is null until a reviewable mission is cleared.
State.saveDraft(id, sql)
State.recordAttempt(id, verdict)
State.recordPass(id)        // sets done and doneAt, adds a passbook line, updates streak and SRS. Returns {firstTime, levelCleared: level|null, balance}
State.useHint(id)           // returns new count
State.markAnswerSeen(id)
State.current()             // suggested next lesson object: last opened if not done, else first not done. Null when every mission is cleared.
State.setCurrent(id)
State.isDone(id), State.doneCount(), State.levelProgress(n)   // {done, total}
State.rank()                // rank of the highest fully cleared level in order, 'Newcomer' before Level 0 is cleared
State.nextRank()            // {rank, level, left}: the next rank to earn and how many missions are left in that level. Null at the end.
State.streak()              // {days, activeToday, last7:[bool...]}
State.passbook()            // [{date, id, title, balance, kind:'mission'|'level'}...], oldest first. A 'level' line also has n and rank, and its id is 'L3'.
State.stamps()              // [{n, rank, title, date}...] for cleared levels
State.dueReviews(limit)     // lessons due today, oldest first. Only cleared write, fix and order missions. Leitner intervals: 1, 3, 7, 16, 35 days.
                            // Never more than 5 a day, counting reviews already done today. So the header badge and the Review screen agree.
State.nextReviewDate()      // 'YYYY-MM-DD' or null
State.recordReview(id, ok)  // ok moves up a box. Not ok goes back to box 1. Returns the new {box, due}.
State.reviewedToday()
State.bumpQueries(), State.queryCount()
State.exportJson(), State.importJson(text)   // importJson validates and returns {ok, message}
State.reset()
State.isSaving()            // false when the browser blocks storage, so progress lasts only until the tab closes
State.today(), State.addDays(date, n)   // local calendar days as 'YYYY-MM-DD'
State.settings()            // {theme:'system'|'light'|'dark', sound:false}
State.setSetting(key, value)
State.onChange(fn)          // returns an unsubscribe function. saveDraft and bumpQueries save without firing it.
```

Scratchpad state (current text, history of 30, saved queries, and the runs that changed the practice copy) lives in the same store: `State.scratch()` returning a mutable object, and `State.commit()` to save it.

Dates use the learner's local calendar day (`YYYY-MM-DD`).

## Kenari.UI

```js
UI.el(tag, attrs, ...children)     // attrs: class, text, html, dataset, style (object, including --vars), onClick and other on* handlers, true for boolean attributes
UI.esc(text)
UI.hl(sql, {mark, active})         // highlighted HTML for SQL, including blanks. mark: the word to fix. active: index of the selected blank. Blanks carry data-blank="n".
UI.code(sql, {copy, label})        // element: read-only code block
UI.rich(html, {inline})            // element (div, or span when inline). Handles [[Term]], [[label|Term]] and [[demo:name]]. Run EVERY lesson text field through this:
                                   // teach, task, question, bridge, win, exNote, atWork, hints, ex notes, choice t and why, newIdea, tips, verdict body.
                                   // Terms open the glossary popover. Kol and collectibility also show the five grades as a table.
UI.ledger(result, {max, compact, animate, title, copy, foot, kept, actions, label, onPrinted})
  // element: the printed result table with its row count and "Copy for Excel". Paper color, rows in their own scroll box, sticky header.
  // kept: {of: 502} ends the count as "37 rows kept, of 502". actions: nodes added to the foot, such as Copy for AI.
  // foot: false drops the foot, as in a target preview. compact: the small version for tickets and peeks.
  // "More columns" appears only when real result columns are off-screen. The print is capped at 20 rows and under one second.
  // The element also has:
  //   .printed      Promise, resolved when the print ends
  //   .finish()     fast-forward the print (Enter or a click)
  //   .setResult(r) swap the rows in place, for Compare
  //   .foot, .scroller, .tsv()
  // ledger.prepend(band) puts a verdict band above the rows, on the same sheet.
  // The ledger is a flex column. Give it a height, or set --lg-max on it, and the rows scroll while band and foot stay put.
UI.toast(message, {ms})            // message: text or a Node. Set --toast-lift on :root to keep it above a bottom bar.
UI.copy(text, label)               // clipboard with a fallback, then toasts label. Resolves true or false.
UI.stamp(hostEl, opts)             // plays the stamp in hostEl (position:relative), plus sound if enabled. Returns the stamp element. See below.
UI.modal({title, body, actions, wide})   // focus-trapped native dialog, Esc closes, focus returns. body: string (goes through rich) or Node.
                                   // actions: [{label, primary, danger, value, onClick(close), keepOpen, autofocus}]. Returns {el, body, close(value), closed: Promise}.
UI.sheet({title, body, onClose})   // same, sliding up from the bottom. Use it for the phone mission list.
UI.confirmInPage({title, body, confirm, cancel, danger})   // Promise<boolean>, built on modal
UI.closeDialogs()                  // closes whatever dialog is open. The router calls it on every route change.
UI.setTitle(text)
UI.announce(text)                  // says it in the page's aria-live region. Empty it with UI.announce('') on every Run.
UI.copyForClaude({kind, lesson, sql, outcome})     // kind: 'mission' | 'review' | 'scratch'. outcome: text, or what Kenari.evaluate returned.
                                   // Builds the prompt, copies it, toasts, offers the claude.ai link. Never puts the learner's text in a URL.
```

`UI.stamp` options: `text` ('SESUAI'), `mission` ('1.2' prints MISI 1.2) or `small` (any lower line), `upper` (today's date by default), `size` (150), `rot` (-11), `left`, `top`, `right`, `bottom` in px (default: right side, vertically centred), `jolt` (element, default the nearest `.paper`, `false` for none), `flare` (default true, the violet UV print inside the paper; `'rings'` leaves out the big SESUAI word, for a stamp that carries another word, such as a rank; `false` for none), `onImpact(el)`, `still` (place it with no motion, as in the passbook). BANK FIKTIF prints on every stamp.

More from `UI`, for screens that need the signature pieces:

```js
UI.isWide()                  // true at 1000px and wider. Below that, the phone layout.
UI.motionOK(), UI.coarse(), UI.isMac(), UI.runKeys()   // runKeys: 'Ctrl Enter', or the Command key form on a Mac. Label Run with it.
UI.whenIdle(fn), UI.anim(el, frames, opts)             // anim plays and then cancels itself, and does nothing under reduced motion
UI.icons                     // HTML strings: arrow, left, right, down, up, check, hook, shield, pin, close
UI.dm(text, {p, sw})         // dot-matrix HTML string with hidden real text. Pitch p defaults to 3, which is 21px tall. Never go below 20px, and never use it for sentences.
UI.qd(text, pitch)           // the queue display: the mission plate, as an HTML string
UI.rosette(n, size)          // level n's rosette as an SVG HTML string, denser as levels rise. Color comes from currentColor.
UI.stampSVG({word:[...], upper, lower, small, top, bottom})   // any stamp, as an SVG string
UI.rankStamp(level, date)    // a level's rank stamp, as an SVG string. Size it with the wrapper. date: 'YYYY-MM-DD'.
UI.stampDate(date, short)    // '05 NOV 2026' or '05 NOV 26'
UI.jolt(el, strength), UI.prepFlare()
UI.guilloche(hostEl, size, {k, uv})  // counter-rotating rosettes in a .gl host. Repaints on theme change. Returns {prepUV(), uvWrap, destroy()}. Set --mx and --my on the host for the UV lamp.
UI.drawUV(canvas, size, {noWord}), UI.prepFlare(rings), UI.sound, UI.applyTheme()
UI.plainOf(html), UI.toTSV(result), UI.SQL_KEYWORDS, UI.SQL_FUNCTIONS, UI.KOL_GRADES
UI.scrollTable(table)        // below 1000px: puts a table that is already in the page in its own sideways scroll box, with the More columns cue. UI.rich does this for table.plain.
document.addEventListener('kenari:theme', fn)   // fires when the theme changes, for anything drawn on a canvas
```

## Shared CSS classes

Tokens are in `tokens.css`. Each color has one job (`docs/DESIGN.md`). Use the tokens and these classes, and put no literal colors in component rules.

- **Buttons:** `.key` (neutral), `.key.canary` (Run, Next, first-run call to action, one at a time), `.key.big`, `.key.danger`, `.ghost` (outline), `button.plain` or `a.plain` (quiet text, for "Show the answer"), `.tlink` (a text button on paper), `.fixbtn` (the one-click fix on a help slip), `.iconbtn`, `.seg` (segmented control with `aria-pressed`). `.kbd` is a key label inside a key. Use `.plain` only on `button` or `a`, since lesson tables also use the class `plain`.
- **Terminal:** `.mc`, `.mc-bar` with `.mc-lamp[data-state="todo|busy|help"]` and `.mc-note`, `.mc-act`, `.slot`.
- **Code:** `.t-kw`, `.t-str`, `.t-num`, `.t-fn`, `.t-com`, `.t-pun`, `.t-blank` (`.on` is the selected blank), `.t-err` (the word to fix). `.codeblock` comes from `UI.code`.
- **Paper:** `.paper` is any sheet. It gets its grain and takes the jolt. `.ledger` comes from `UI.ledger`. The editor agent uses the same `.t-*` colors.
- **Ticket:** `.ticket` holding `.tk-main` (`.tk-top` with `.tk-avatar`, `.tk-task`, `.tk-wanted`) and `.tk-stub` (target preview, with `.tk-more`). `.tk-closed` is the TICKET 1.2 CLOSED mark.
- **Verdict:** `.vband[data-state="pass|near|fail"]` with `.vband-title`, `.vband-body`, `.vband-tips`, `.vband-line`. `.validation` holds `<small>Teller validation</small>` and `.not-yet`, and `.validation.stamped` hides both so the stamp can land there.
- **Help slip:** `.helpslip` (set `--ax` to point at the word), `code.bad`, `.help-act`, `.help-sub`, `.help-raw`, `.use-this` (the "Use this one" tag).
- **Layout:** `.wrap` and `.wrap-narrow` for pages that scroll, `.page-title`, `.page-lead`, `.sp` (flex spacer), `.vh` (screen readers only), `.rich` (lesson prose, with `table.plain`).
- **Security print:** `.gl`, `.weave` (with an `<i>` child), `.ros`, `.dm`, `.qd`.

`#view` is a flex column with `overflow-x:clip`. The header is `--topbar-h` tall plus the top safe area, sticky by default. To lock the page on the mission screen at 1000px and wider, set `html[data-route="mission"] body{height:100dvh;overflow:hidden}` in `mission.css`.

## Kenari.Demos

`Demos.render(name, hostEl, opts)`: `anatomy`, `order`, `join`, `join-left`, `group`, `fanout`, `window`, `transaction`, `index`. Spec in `docs/UI-SPEC.md`. `Demos.names` lists them. `opts.level` picks a level's version of a demo: `join-left` on Level 6 and later becomes "Where the date test goes". Without it the level comes from a `[data-demo-level]` ancestor, then from the `#/m/N` route. `UI.rich` renders while detached, so a screen showing lesson text outside that route must set `data-demo-level` and render again after attaching.

## Kenari.Editor

```js
const ed = Editor.create(hostEl, {
  id, value, onInput(text), onRun(), lines: {min: 6, max: 24},
  autocomplete: true, keybar: true, label: 'SQL editor'
});
ed.value                 // get and set
ed.readOnly              // get and set. The mission screen locks the editor while a pass prints.
ed.insert(text)          // at the caret or over the selection, then jumps to the next blank
ed.insert(text, {list:true})   // the same, but a column going into a SELECT list brings the comma it needs. The mission screen uses this below 1000px.
ed.focus()
ed.blur()                // leaves at once, key bar included. On its own, the key bar waits a moment after focus leaves, so a tap on another control is not lost.
ed.selectFirstBlank()
ed.markError(token)      // highlight until the next edit
ed.clearError()
ed.refresh()             // re-measure after becoming visible
ed.destroy()
```

Additions, all safe to rely on:

```js
Editor.create(host, {..., placeholder})   // shown while empty. Default: 'Write your query here.'
ed.el, ed.textarea       // the root element and the textarea
ed.blankCount, ed.hasBlanks()   // for the status line. Blanks inside quotes count, and blanks in comments do not, the same as KenariCheck.hasBlanks.
ed.selectFirstBlank({focus})    // returns whether there was a blank. Default: focus on desktop, not on touch, so the keyboard stays down until the learner asks.
ed.markError(token)      // also selects the word, so typing replaces it. Returns whether the word was found.
ed.markedRect()          // {left, top, right, bottom, width, height} of the marked word on screen, for the help slip's pointer. Null when nothing is marked.
ed.replaceMarked(text)   // the one-click fix. Takes text or explainError's {from, to}. Can be undone.
ed.replaceAll(text)      // Start over and Put it in the editor. Unlike setting ed.value, this can be undone.
ed.caretRect()           // where the caret is on screen
ed.revealCaret()         // scrolls the editor's own box to the caret or the selected blank
Editor.create(host, {..., runKey: true})   // adds a canary Run key to the phone's key bar, for screens whose bottom bar hides under the keyboard. It calls onRun.
```

Below 1000px wide the editor soft-wraps long lines and hides the line numbers. A locked page (one that cannot scroll) keeps the caret in view with the editor's own scroll box. Without a lock it scrolls the page, as before.

CSS and page hooks:

- `--ed-max-h` on `.ed` or any ancestor caps its height, for example the console's 40 percent of the pane. `--ed-lh` changes the line height.
- `--ed-bar-lift` on `:root`: how far above the keyboard the key bar sits, so a bottom bar can stay under it. The mission screen hides its bottom bar with the keyboard up, so it leaves this at 0.
- While the key bar is up, the editor sets on `:root`: `--kb-inset` (keyboard height, from `visualViewport`), `--keybar-h`, and `data-keybar="up"`. The first two are not set at other times, so read them with a fallback: `var(--kb-inset,0px)`.
- The key bar shows on touch devices below 1000px wide. Its keys sit in two short rows that scroll together (`.ed-keys.ed-keys-2` holding `.ed-krow`s): words on top, symbols below. There, suggestions appear as chips in place of the words' row, so nothing covers the code and the bar keeps its height. Tablets at 1000px and wider get the popup with 44px rows.
- The mission editor is 14px below 1000px. On iOS, `main.js` adds `maximum-scale=1` to the viewport meta, so focusing a field under 16px does not zoom the page. Safari still allows pinch zoom.
- While the key bar is up, `body` gets bottom padding so the editor can scroll clear of it, even when the console is the last thing on the page.

## Kenari.Share

The Share this rank button on the rank-up sheet. It makes a page of the passbook with the level's rank stamp, as a 1080x1350 PNG drawn on a canvas on the device. Nothing is uploaded.

```js
Share.image(level)     // level object or number. Promise<Blob>, the PNG. The last picture is kept, so asking again gives the same one.
Share.prepare(level)   // makes it in the background once the sheet has settled (1.2 s, then when the browser is idle), so the tap shares at once
Share.rank(level)      // what the button does: navigator.share({files: [png], title: 'Kenari Collection SQL Lab'}) where the browser
                       // can share files, otherwise a download named kenari-rank-<n>.png. A cancelled share does nothing, and any other
                       // share error falls back to the download. If the picture cannot be made: toast 'The image could not be made on this browser.'
                       // Resolves 'shared' | 'cancelled' | 'downloaded' | 'failed' | 'busy'
```

- The rows are `State.passbook()` lines, as the Passbook screen prints them: the last three passes up to the one that cleared the level, BALANCE B/F from the line before, short dates from `UI.stampDate(date, true).slice(0, 6)`, then `Rank: <rank>`. The stamp is `UI.rankStamp` dated the day the level was cleared. So the picture is the same whenever the sheet opens. A title too long for its column ends in an ellipsis.
- Colours and fonts are read from the tokens on `:root` when it is drawn, so the light theme gives the light paper. The stamp SVG takes the `ink-s` filter and its colour with it, because an image cannot reach the page's defs or `currentColor`. Positions are measured from the approved mock (540x675 CSS px, drawn at 2x).
- `rankUp` puts the button (`button.ghost.rk-share`) right after `.rk-act` and calls `prepare`.
- On the rank-up that ends the course (`State.nextRank()` is null), `rankUp` also adds `p.rk-foot.rk-xl` after the small print: "Next, the same idea for Excel: Kenari Excel Lab." The link is `EXCEL_URL` in `home.js`, with `target=_blank` and `rel=noopener`. Both playthroughs (`scripts/dev/e2e-all.mjs`) check that it shows on that rank-up only.

## Screen modules

Each exports `render(container, params)` returning an optional cleanup function. `main.js` routes `#/`, `#/journey`, `#/passbook`, `#/m/<id>`, `#/review`, `#/scratchpad`, `#/cheatsheet`, `#/about`, and shows a friendly not-found view otherwise. `#/about` is `Kenari.About` in `main.js`: the terms on the back of the passbook, reached from the About and privacy row in Settings. `#/journey` and `#/passbook` render Home and scroll to the element with `id="journey"` or `id="passbook"`, so Home must give those sections these ids. Below 1000px each opens as its own screen, at the top. Moving between them does not rebuild Home. Params: Mission gets `{id, lesson}`, and Home gets `{section}` when there is one.

`main.js` sets a default title per route, scrolls to the top, and moves focus to `#view` unless the screen already placed focus inside it. Call `UI.setTitle` in `render` for a better title.

`Kenari.Mission.mount(container, lesson, {mode: 'learn'|'review', onDone, onNext, nextLabel})` is what Review reuses. It returns a cleanup function.

- Below 1000px the screen follows `docs/PHONE.md`: `root.dataset.step` is `learn`, `task` or `result`, and `mission.css` shows one step at a time. Review gets Task and Result only.
- Below 1000px every dialog from `UI.modal` and `UI.sheet` adds a history entry, so Android's back key closes the top dialog instead of leaving the screen. Closing it another way steps back over that entry. At 1000px and wider history is untouched.
- Below 1000px the last passes of this visit stay in memory, so coming back to a cleared mission restores its printout, stamp and Next without printing or recording again. Running or editing again drops it. A cleared mission with nothing kept shows a quiet Next (`.ms-qnext`) on its Task step.
- Below 1000px an order mission puts its two chips after the tiles in the same scroll, and a half-built order does not run. A long request or verdict stops with a fade and a control (`.ms-req-more`, `.ms-band-more`) that gives it the step's height.
- A lesson can carry `phone: [[from, to], ...]`: sentence swaps for `teach`, `task` and `hints` below 1000px, for wording that describes the laptop layout. The laptop text is not touched.
- Learn mode: `onDone({ok:true, firstTime, levelCleared, lesson})` fires as the stamp lands.
- Review mode: no teaching, no blanks, no drafts, and nothing is written to `State`. Hints appear after two failed runs. `onDone({ok, answerSeen, attempts, lesson})` fires when the learner presses the Next key, so the stamp has been seen first, then `onNext()`. `nextLabel` is the key's text. Review owns `State.recordReview`.

Review sets `html[data-reviewing]` during the flow, which locks the body at 1000px and wider, and sets `--ms-h` on its host to leave room for its 43px strip. `Kenari.Review.forget()` drops this tab's review so far, and `main.js` calls it after a reset or a restore.

In review, a starter with blanks gives way to an empty editor, and the request and hints stop mentioning blanks. A `fix`, or a starter with no blanks, stays as it is, because its request leans on it.
