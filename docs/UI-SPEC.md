# UI and UX spec

**What it is:** a static website on GitHub Pages where a nervous beginner learns SQL by running real queries on a made-up bank's collection data, and ends up genuinely good at it. No account, no backend, no API keys. It should feel like a product someone would pay for, and be cool enough that the learner wants to open it after work.

**Who it is for:** see `docs/AUTHORING.md`. Laptop at work, phone on the way home.

**How it fits together:** `docs/APP-API.md` is the shared contract between modules. Lesson text fields can hold glossary tokens, so every one goes through `UI.rich`.

**Name:** Kenari Collection SQL Lab. Always make clear that Bank Kenari is made up. Never name or imply a real bank.

## The feeling

- **Instant:** the first click produces a real result in under a minute of arriving.
- **Safe:** "you cannot break anything" is visibly true. Errors look like help, never like failure.
- **Momentum:** one small win after another. Each win is satisfying, with a stamp, a sound if enabled, and the next step ready.
- **Grown-up cool:** a game's momentum with a professional's taste. Not childish, and nothing a person would be embarrassed to have open at the office.

## World and motifs

Bank back office: the passbook (buku tabungan), dot-matrix printing, ledger lines, teller stamps, security-paper patterns. Learner progress is literally a passbook: each cleared mission prints a line, and each cleared level earns a stamp and a rank.

A correct answer gets a teller's stamp reading **SESUAI** (Indonesian for "matches"). That stamp is the signature moment.

## Screens

### Home (`#/`)
First visit opens here. The first screen must be useful with no scrolling:

- A one-line promise: from zero to SQL pro, on a fake bank's real-looking data.
- **A live query in the hero:** a small editor already holding `SELECT * FROM branches;` with a Run button. Pressing it prints a real result. This is the whole pitch in one click.
- The primary button: "Start Mission 0.1", or "Continue: Mission 3.4 Three tables" for returning learners.
- For returning learners: current rank, streak in days, missions cleared, reviews due today.

Below that:
- **The journey:** all ten levels as a path from "Day One" to "SQL Pro". Each stop shows its title, rank, tagline, progress and stamp when earned. Everything stays clickable, with no locks. A "you are here" marker shows the suggested next stop. A note says Levels 0 to 3 are enough to read most everyday queries.
- **The passbook:** recent progress printed as ledger lines with date, mission and a running balance of missions cleared. An accounting graduate should smile at this. Level stamps appear on a passbook page. Clearing Level 9 shows a full-page completed passbook with the rank SQL Pro.

### Mission (`#/m/1.2`)
The main screen. Two panes on wide screens, with instructions beside the editor so the learner never scrolls back and forth.

**Left pane: learn.** Scrolls independently on desktop.
- Where am I: level name, mission number, dots for each mission in the level (clickable), previous and next.
- Title, then the one new idea, stated prominently.
- `teach`, with tap-to-define glossary terms and interactive demos.
- Annotated example: each SQL line with its plain English under it, like a translation, then the example's real result.
- The Excel or accounting bridge.
- `atWork` as a collapsed section.

**Right pane: do.**
- Request ticket: who is asking, the task, expected columns, and a preview of the target result (first 3 rows and total row count). Open by default on Levels 0 to 3, collapsed on later levels, hidden on exams and where `noTarget` is set.
- **Tables you need:** only the tables this mission's solution uses, with each column's meaning. Click a column to insert it. A "Peek at this table" button shows 5 rows. "All tables" opens the full reference with how tables connect.
- Editor (below), Run button, Hint button.
- Hints reveal one at a time. After the last hint, "Show the answer" appears, with "Put it in the editor". Exams: no hints. After clearing an exam, show the model answer.
- Verdict, then result, then "Copy for AI".

**Verdict states:**
- *Blanks left:* "Fill in the blanks first", and jump to the first blank.
- *Error:* plain-English explanation first, then any `tips` from `KenariCheck.tipsFor`, then the raw database message, smaller. The confusing word is marked in the editor. Use `KenariCheck.explainError(raw, vocab, sql)`.
- *Wrong:* a kind title and specific reason from `KenariCheck.compare`, plus its `tips`. Never just "incorrect". The learner's result shows below, with the target available to compare.
- *Near:* right result, one thing to change (`requires`, swapped labels, double-quoted text). Warm, because they nearly have it.
- *Pass:* SESUAI stamp lands, `win` text, "Added to your Cheat sheet", and a focused **Next** button so Enter continues.
- *Too slow:* after 8 seconds the query is stopped. "That query was still running after 8 seconds, so I stopped it. The usual cause is a JOIN with no ON."
- *Level cleared:* a rank-up moment, with a big stamp, the new rank and what they can now do, then on to the next level.

**Mission types:**
- `write`, `fix`: editor as above. Each Run starts from a clean copy of the data.
- `mode: 'state'`: run the learner's SQL on a clean copy, then compare `stateQuery` or test `stateCheck`.
- `quiz`: question, optional code block and result, and choices as large tappable cards. A wrong choice shows its `why` and stays open to try again. The right one shows its `why` and the stamp.
- `order`: shuffled line tiles (stable shuffle by mission ID). Tap a tile to move it into the query, tap again to take it back. Dragging is a bonus. Run it, and check it like a write mission.

### Review (`#/review`)
Spaced repetition, because knowledge fades. Each cleared `write`, `fix` or `order` mission enters a Leitner schedule: intervals of 1, 3, 7, 16, 35 days. Clearing moves it up a box, and giving up moves it back to box 1. Up to 5 due missions a day. Review mode shows the task and an empty editor, with no teaching and no blanks (a `fix` keeps its buggy starter, and a starter with no blanks stays, because its request leans on it), and hints only after two failed runs. A prefilled mission has nothing to recall, so it never comes back. Finishing shows a short summary. When nothing is due, say when the next review is.

### Scratchpad (`#/scratchpad`)
Free practice on a persistent private copy of the data, so temp tables and updates stick until "Reset practice data".
- Opens with a realistic example report loaded and run (see the sample query in the first version: overdue buckets with contact coverage). Clearly marked as an example.
- Full table reference beside it.
- Query history (last 30, click to reload), and named saved queries.
- Copy results as tab-separated text to paste into Excel.
- "Copy for AI": see below.
- A note: queries run only in this browser. Before pasting anything from work anywhere, check the company's rules and remove customer data.

### Cheat sheet (`#/cheatsheet`)
Searchable.
- Patterns earned so far, from each cleared mission's `pattern`, with copy buttons. Grouped by level. Empty state explains how to earn the first.
- Excel to SQL table (`KenariRef.EXCEL_MAP`).
- Collection and SQL glossary (`KenariRef.GLOSSARY` plus each level's `terms`).
- Dialect table (`KenariRef.DIALECTS`). A note: this lab runs SQLite, and most of it carries over.

### Settings
A small menu in the header: theme (system, light, dark), sound on or off (default off, since this is used at work), download progress as a file, restore from a file, reset progress (with a confirm step built into the page).

## The editor

Custom, no library: a transparent `<textarea>` over a highlighted `<pre>`, in a monospace font with no wrapping. Requirements:

- Syntax highlighting for keywords, strings, numbers, comments and functions.
- **Blanks** (`____`) stand out strongly. Tab jumps to the next blank and selects it. Clicking a blank selects it. Typing replaces it. On opening a mission on a non-touch device, the first blank is selected. After inserting a column by click, jump to the next blank.
- **Autocomplete:** a popup near the caret, computed from the monospace grid. Keywords, table names and column names, with columns of tables already in the query first, plus each column's meaning. Up, Down, Tab and Enter accept, Esc closes. It must never get in the way of a beginner typing normally: Enter accepts only after the learner has arrowed to an item, and the popup closes on punctuation.
- Ctrl/Cmd+Enter runs. Tab inserts two spaces when there is no blank or popup. Esc leaves the editor, so keyboard users are not trapped.
- Error marking: after an error, highlight the token from `explainError` until the next edit.
- Grows with content between about 6 and 24 lines.
- **Phone:** a key bar of common tokens (`SELECT FROM WHERE * , ' = ( ) ; AND GROUP BY ORDER BY`) above or under the editor on touch devices. 16px text so iOS does not zoom. Keep Run in easy reach with a sticky bar. A "Jump to the editor" control on the mission screen.

## Results

Results print like a passbook or ledger: ruled lines, a row-number column in a dot-matrix face, numbers right-aligned with tabular figures, sticky headers, scrolling in its own box. Show `NULL` as a distinct muted marker. Display integers of 100,000 or more with thin-space grouping (except `_id` columns), with the raw value in the title attribute. Show the first 200 rows and say how many there are. A brief print-in animation on the first 20 rows, off for reduced motion. Copy-as-TSV button.

## Copy for AI

There is no built-in AI, because a public page cannot hold an API key. Instead, one button copies a ready-made prompt to the clipboard: the mission, the table list, the learner's query, what happened, and an instruction to tutor without giving away the answer. A link opens claude.ai in a new tab. Show a toast saying what was copied. In Scratchpad the prompt says to explain the query line by line and warns the learner to remove sensitive data first. Never put the learner's text in a URL.

## Demos (`[[demo:name]]`)

Small interactive pictures inside lesson text, all built from HTML and CSS using theme tokens:
- `anatomy`: a small table with one row and one column highlighted and labeled, and the mapping workbook to database, sheet to table.
- `order`: the seven clauses in written order, and a toggle animating them into run order (FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT).
- `join`, `join-left`: three loans and three activities, a toggle for JOIN and LEFT JOIN, and the result. L1 appears twice, L2 vanishes or stays with NULL.
- `group`: a few rows sliding into groups, with their totals. Button to step through it.
- `fanout`: one loan of Rp 10 million with three activities. The join makes three rows and SUM says Rp 30 million.
- `window`: GROUP BY collapses rows, a window function keeps them and adds a column. Toggle between the two.
- `transaction`: UPDATE, then choose COMMIT or ROLLBACK, and see the table.
- `index`: scan every row versus jump straight to the row, with a count of rows read.

## Technical rules

- **Static site, no build step.** `index.html` plus plain JS and CSS files, with classic scripts and `defer`. It must work from a subfolder (`https://user.github.io/kenari-sql-lab/`), so use relative URLs only. Add `.nojekyll`.
- **Engine in a Web Worker** (`assets/js/engine-worker.js`) so a runaway query never freezes the page. Load sql.js 1.10.3 from `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/`: try `sql-wasm.js` with `locateFile`, then fall back to `sql-asm.js`, then the same from `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/`. Build the data with `KenariData.build(KenariData.sqljsAdapter(db))`, export the bytes, and open new databases from them. If no reply comes in 8 seconds, terminate the worker, start a new one and report a timeout.
- Keep a read-only reference copy for expected answers and a persistent practice copy for Scratchpad. Mission runs always use a fresh copy.
- **Multiple statements:** run them all with `iterateStatements`. Show every result set that has columns, stacked with a small "Result 1 of 3" label, and use the last for checking. Report rows changed when a statement changes data. Cap collected rows at 20,000.
- Show a graceful message if the engine cannot load, with lessons still readable.
- **State:** `localStorage` with try/catch everywhere, and an in-memory fallback. It must work when storage is blocked. Save on change. Keep drafts per mission.
- Hash routing, deep links work, the back button works, and the title updates per screen.
- **Theme:** CSS custom properties. `prefers-color-scheme` by default, with a saved override set via `data-theme` on `<html>`. Both themes get equal care. No literal colors in component rules.
- Fonts from Google Fonts with solid fallback stacks. The page must look right if they are blocked, because bank networks block things.
- No analytics, no trackers, no third-party calls other than the fonts and engine above, and claude.ai only when the learner clicks that link.
- `<html lang="en">`, a real `<title>`, a meta description, `theme-color`, and an SVG favicon (a stamp mark).

## Accessibility and quality bar

- WCAG AA contrast in both themes. Visible focus everywhere. Everything works by keyboard. Skip link. `aria-live` on verdicts. Honest labels on controls. Respect `prefers-reduced-motion`.
- Good at 360px, 768px, 1280px and 1920px wide. The page body never scrolls sideways. Tables and code scroll inside their own boxes. Sticky bars respect safe-area insets.
- No layout shift when results appear. Focus never gets lost after an action.
- Fast: first paint before the engine loads, with a calm loading state for the engine only.

## Design taste

Make deliberate, specific choices. Avoid the look of generated design: warm cream with serif and terracotta, near-black with a lone acid-green accent, purple-to-blue gradients, Inter or Space Grotesk, emoji as icons, everything centered, identical rounded cards with shadows, accent bars on rounded cards, big-number tiles as decoration. Use cards by role, not by default. Write copy plainly: active voice, buttons say what they do, errors say what happened and how to fix it. No em dashes, no "worth noting", no hype.
