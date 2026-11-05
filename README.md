# Kenari Collection SQL Lab

**Try it, free: <https://jeremysubiakto.github.io/kenari-sql-lab/>**

A static website that takes a nervous beginner to professional SQL, for work in a bank's collection unit. You run real queries on a made-up bank's data, one small win at a time, from "press the button" to a final exam.

**Bank Kenari is made up.** Every bank, branch, customer, loan, phone number and colleague in this project is invented. It does not name or stand for any real bank or person.

- Ten levels and 198 missions, from Day One to SQL Pro.
- Real SQLite in your browser, through [sql.js](https://sql.js.org) in a Web Worker. A runaway query cannot freeze the page.
- No account, no backend, no API keys and no analytics. Your progress stays in this browser's `localStorage`, and you can download it as a file and restore it elsewhere.
- Works on a laptop at the office and on a phone on the way home.

The only other hosts it talks to are Google Fonts and the sql.js CDNs (cdnjs, with jsDelivr as a fallback). `claude.ai` opens only if you click that link. If the fonts are blocked, the fallback fonts take over. If the engine is blocked, the lessons stay readable and the page says how to retry.

## Run it locally

There is no build step and nothing to install. Serve the folder over HTTP, because browsers will not start a Web Worker from a `file://` page.

```sh
# From the folder that holds kenari-sql-lab, so it runs from a subfolder, as on GitHub Pages
python3 -m http.server 8000
```

Then open <http://localhost:8000/kenari-sql-lab/>.

## Publish it

Push the folder to a GitHub repository and turn on GitHub Pages for it. All URLs are relative, and `.nojekyll` is already there, so it works from `https://<user>.github.io/<repo>/`.

`docs/` holds the specs. The site never loads them.

## How it fits together

```
index.html            the shell: header, nav, <main id="view">, script tags in order
assets/css/           tokens, base, shared components, then one file per screen
assets/js/core/       the fake bank (data.js), answer checking (check.js), glossary and reference (reference.js)
assets/js/lessons/    one file per level, all the course text
assets/js/app/        the app: engine, state, UI kit, editor, demos, mission, home, review, scratchpad, cheat sheet, router
assets/js/engine-worker.js   SQLite, off the main thread
```

Plain JS and CSS with classic `defer` scripts, all hanging off one global, `window.Kenari`. `docs/APP-API.md` is the contract between the modules, `docs/DESIGN.md` holds the final design decisions, and `docs/UI-SPEC.md` is the full product spec.

## How the lessons work

Each level is a file, `assets/js/lessons/level-N.js`, that pushes a level object onto `KENARI_LEVELS`. Every count, title, dot and rank on screen is read from these files, so adding a mission changes the whole site. Nothing is hardcoded elsewhere.

A mission is a real request from a colleague at Bank Kenari, with one new idea:

```js
{
  id: '1.3',
  title: 'The loan grade, Kol',
  newIdea: "Kol is a loan's quality grade, stored as a number from 1 to 5.",
  teach: '<p>...</p>',          // [[Term]] opens the glossary, [[demo:name]] puts in an interactive demo
  ex: [['SELECT loan_id', 'Show each loan ID']],   // an example, line by line
  bridge: 'Like a filter on one column in Excel.',
  from: 'Citra, Head of Collection',
  task: '...',
  starter: 'SELECT ...\nWHERE ____ = ____;',       // blanks are three or more underscores
  fill: ['collectibility', '5'],
  solution: 'SELECT ...',       // its real result is the expected answer
  hints: ['...', '...', '...'],
  win: 'Why this matters at work.'
}
```

Missions come in four types: `write`, `fix`, `quiz` and `order`. Mode `state` checks what a query did to the data, for missions that change it. `docs/AUTHORING.md` has every field and the voice rules, and `docs/CURRICULUM.md` lists what each level teaches. `docs/DATA.md` describes the fake bank, which `assets/js/core/data.js` builds the same way every time.

Answers are never compared as text. The learner's query runs on a fresh copy of the data, and its result is compared with the result of the mission's solution. A wrong answer gets a specific reason, and an error gets plain help pointing at the word to fix.

Cleared missions come back for review on a Leitner schedule (1, 3, 7, 16 and 35 days), at most five a day. The Scratchpad keeps a private copy of the data, so your changes stay until you press Reset practice data.

## How the tests work

**Every mission, in Node.** Needs a Node version with `node:sqlite` (24 works).

```sh
node --no-warnings scripts/verify.mjs             # all levels
node --no-warnings scripts/verify.mjs --level 3   # one level
node --no-warnings scripts/verify.mjs --fixtures  # rewrite tests/fixtures.json after changing a solution or the data
node --no-warnings scripts/q.mjs "SELECT * FROM branches LIMIT 3"   # try a query on the fake bank
```

For each mission it checks that the solution runs and passes, that every planned wrong answer fails for the right reason, and that the text follows the rules.

**Every mission, in the real browser engine.** Serve the site and open `test.html`. It runs each mission through the same `Kenari.evaluate` path the mission screen uses, compares results with `tests/fixtures.json`, and also tests the engine, the state store and the text pipeline. It keeps its state in memory, so it never touches your progress. The result is on the page and in `window.__selftest`.

**The parts with their own test pages.** `tests/editor.html` with `tests/editor-drive.mjs` drives the editor with real key, mouse and touch events. `tests/demos.html` shows every demo under its mission, with theme and width switches.

**Driving the real site.** `scripts/dev/cdp.mjs` is a small driver for a private headless Chrome, with no dependencies. Its header comment shows how to use it. `docs/DESIGN.md` ends with the acceptance checks to run with it.

Automated checks only reach so far. Real phone keyboards, real Windows machines and how the optional sound actually sounds still need a person to try them.

## Report a problem

Open an [issue on GitHub](https://github.com/JeremySubiakto/kenari-sql-lab/issues/new?template=problem.md). Please do not paste real customer data or anything from your workplace, because issues are public.

## License

Code is under the [MIT license](LICENSE). The lessons are under [CC BY-NC 4.0](LICENSE-LESSONS.md), so share them with credit, but not for sale. sql.js and the fonts load from their own hosts and keep their own licenses.
