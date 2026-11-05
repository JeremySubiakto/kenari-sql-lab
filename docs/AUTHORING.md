# How to write missions

The product promise: **take someone who has never seen SQL and make them genuinely good at it, for a job in a bank's retail collection unit.**

Read `assets/js/lessons/level-0.js` first. It is the model for tone, length and structure.

## The learner

- An accounting graduate in a bank's management trainee program, placed as a system and project analyst in a retail collection unit.
- Knows Excel and accounting well. New to SQL. New to banking too.
- Smart, nervous, and convinced they are bad at SQL. Their job depends on this.
- Reads on a laptop at work or a phone on the way home, usually in short sessions.
- May read English as a second language, so plain words beat clever ones.

## The rules that matter most

1. **One new idea per mission.** If a mission needs two new ideas, it is two missions. The `newIdea` field must state the one idea in a sentence.
2. **Never use an idea before it is taught.** `docs/CURRICULUM.md` says what each level has already covered. Everything before your mission is fair game, and nothing after it is.
3. **Define every term at first use.** Use a glossary token like `[[DPD]]`. Banking terms need this as much as SQL terms.
4. **Help fades over time.** See "Scaffolding" below. Beginners fill blanks. Pros start from nothing.
5. **Every mission is a real request from a real colleague.** Collection work, not abstract exercises. Who is asking, and why do they need it?
6. **Nothing is abstract for long.** Show the idea in the annotated example, working on real rows, before asking for it.

## Voice

- Short sentences, plain words, active voice. Talk to "you".
- Warm and calm. Never mention being dumb, stupid or slow. Never talk down.
- Do not use: simply, just, obviously, easy, easily, basically, trivial, of course, clearly. These words make a stuck learner feel worse.
- No em dashes (the harness rejects them). Avoid colon-then-reveal sentences, "not X but Y" framing and rhetorical questions.
- `teach`: 110 words or fewer. Most should be 30 to 70.
- `task`: 60 words or fewer. It must be unambiguous about which rows and columns are wanted. A careful beginner should never have to guess.
- `win`: one or two sentences saying why this matters at work. Teach something, do not only praise.
- `bridge`: one concrete Excel or accounting comparison in one short sentence.
- Hints escalate: first the idea, then which clause or column, and the last one nearly gives the answer.
- Accuracy matters. This person will repeat what they learn here at work. For banking facts, stick to general meanings you are sure of, and do not invent regulations or numbers. The data is simplified: collectibility here follows days past due only, apart from a few loans planted with the wrong grade for Level 7 to find.

## SQL style in solutions and examples

Solutions are shown to the learner, so write them the way a pro would:

- Keywords in CAPITALS, identifiers in lower_snake_case.
- One clause per line, with continuation lines indented two spaces.
- Consistent table aliases: `l` loans, `c` customers, `b` branches, `k` collectors, `a` collection_activities, `p` payments, `s` loan_snapshots, `g` loan_assignments, `r` batch_runs.
- Name computed columns with `AS` using clear names.
- Multi-line template strings, ending in a semicolon.

The engine is SQLite 3.45 in the browser and a newer SQLite in the test harness. **Do not use** `pow`, `median`, `stdev`, `variance`, `mode`, regular expressions, or anything else that differs between versions. Fine to use: window functions, CTEs, `WITH RECURSIVE`, `FILTER`, `RIGHT`/`FULL JOIN` (teach LEFT first), `strftime`, `date`, `julianday`, `printf`, `substr`, `instr`, `trim`, `upper`, `lower`, `replace`, `length`, `coalesce`, `nullif`, `iif`, `group_concat`, `round`, `abs`.

Dates are ISO text (`2026-10-31`). "Today" in the data is **2026-10-31**. Never use `date('now')` in a solution, because results must not change over time.

## Scaffolding

| Levels | Starter |
| --- | --- |
| 0 | Prefilled query. The learner edits one word. |
| 1, 2 | Fill-in-the-blank (`____`) for the first two-thirds of each level, then partial skeletons. Checkpoint has no starter. |
| 3, 4, 5 | Blanks for the first mission of each new concept, a partial skeleton for the next, then nothing. Checkpoint has no starter. |
| 6 | A colleague's buggy query (`type: 'fix'`). |
| 7, 8, 9 | No starter unless a skeleton is what teaches the idea. Exams have no hints and no target, and only a `fix` exam has a starter. |

A blank is three or more underscores. **Every starter with blanks needs a `fill` array** with the correct values in order. The harness fills them in, runs the query and confirms it passes.

## File format

One file per level: `assets/js/lessons/level-N.js`.

```js
(function (root) {
  (root.KENARI_LEVELS = root.KENARI_LEVELS || []).push({
    n: 3,
    title: 'Combine Tables',
    rank: 'Table Connector',        // title earned when the level is cleared
    tagline: 'One short line for the journey map.',
    goal: 'What you can do after this level.',
    terms: { 'some term': 'Definition in one short sentence.' },   // extra glossary terms
    lessons: [ /* missions, in order */ ]
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

### Mission fields

Every mission:

| Field | Meaning |
| --- | --- |
| `id` | `'3.12'`. Sequential within the level. |
| `type` | `'write'` (default), `'fix'`, `'quiz'`, `'order'` |
| `title` | Short, 44 characters or fewer. A plain phrase. |
| `newIdea` | One sentence with the one new idea. Shown to the learner. |
| `teach` | HTML. `<p>`, `<b>`, `<code>`, `<ul>`, `<table class="plain">` are fine. Supports `[[Term]]`, `[[label\|Term]]` and `[[demo:name]]`. |
| `bridge` | Excel or accounting comparison |
| `win` | Why it matters at work, shown when cleared |
| `from` | Who is asking (all types except quiz) |
| `ex` | Annotated example: `[['SQL line', 'plain English for that line'], ...]`. Lines join into a runnable query, and the app shows its result. Read top to bottom, the notes should sound like one sentence. |
| `exNote` | Optional note under the example |
| `exNoResult` | Hide the example's result |
| `atWork` | Optional. How this differs on real databases (Oracle, SQL Server, BigQuery, PostgreSQL). Collapsed by default. |
| `phone` | Optional. `[[from, to], ...]` sentence swaps for `teach`, `task` and `hints` below 1000px, when a sentence describes the laptop layout. |
| `checkpoint` | `true` on a level's review mission |
| `exam` | `true` for final exam missions: no hints, target or answer until cleared |

`write` and `fix` missions also have:

| Field | Meaning |
| --- | --- |
| `task` | The request. HTML allowed. |
| `solution` | Canonical SQL. Its result is the expected answer. |
| `starter` | Text placed in the editor. May contain `____` blanks. |
| `fill` | Required if `starter` has blanks: values in order. |
| `prefilled` | `true` when the starter is already correct and the learner only presses Run |
| `starterErrors` | `true` on a `fix` mission whose starter is meant to raise an error |
| `hints` | 2 to 4 strings, escalating (none on exams) |
| `pattern` | `{sql, note}`: the reusable pattern added to the learner's Cheat sheet |
| `ordered` | Column name, if row order matters. Only that column's sequence is compared, so ties are safe. |
| `ci` | `true` to ignore case and outer spaces in text |
| `precision` | Decimals compared, default 2 |
| `requires` | `[{re: /\bWITH\b/i, msg: '...'}]`: the result is right but the mission's technique is missing |
| `traps` | `[{re: /.../i, msg: 'HTML message'}]`: extra nudge when this pattern appears in a wrong attempt |
| `wrong` | SQL strings that must NOT pass. Add the likely wrong answers. Include at least one from Level 2 onward. |
| `altSolutions` | SQL strings that must also pass. Add other reasonable ways to solve it, so a correct learner is never failed. |
| `allowEmpty` | `true` if an empty result is genuinely right (rare) |
| `noTarget` | Hide the "what the answer looks like" preview |

The answer checker ignores column names and column order, ignores row order unless `ordered` is set, and rounds numbers to 2 decimals. Tasks should still name the columns they want.

### Missions that change data (Level 8)

Set `mode: 'state'`. The learner's SQL and the `solution` each run on a clean copy of the database. Then either:

- `stateQuery: 'SELECT ...'` runs on both copies and the results are compared. It may hold several statements, and the last result counts. Or
- `stateCheck: {sql: 'EXPLAIN QUERY PLAN ...', mustMatch: 'regex'}` runs on the learner's copy and its text must match.

Every mission run starts from a clean copy, so learners cannot damage later missions.

### Quiz missions

```js
{
  id: '2.10', type: 'quiz', title: 'WHERE or HAVING?', newIdea: '...', teach: '...', bridge: '...', win: '...',
  question: 'HTML question',
  code: 'SELECT ...',          // optional SQL to read
  showCodeResult: true,        // optional: show its result under it
  check: { sql: 'SELECT COUNT(*) FROM ...', equals: 42 },   // required when the correct answer depends on the data
  choices: [
    { t: 'Choice text', correct: true, why: 'Why this is right' },
    { t: 'Choice text', why: 'Why this is wrong, kindly, and what it would actually do' }
  ]
}
```

Use quizzes for reading skills: "how many rows will this return?", "what is wrong with this query?", "which clause does this need?". Wrong answers teach, so every `why` matters.

### Order missions

```js
{
  id: '1.9', type: 'order', title: '...', newIdea: '...', from: '...', teach: '...', bridge: '...', win: '...',
  task: 'Tap the lines in the right order to ...',
  lines: ['SELECT a, b', 'FROM t', 'WHERE c = 1', 'ORDER BY a;'],   // the correct order; the app shuffles them
  distractors: ['HAVING c = 1'],   // optional wrong lines
  hints: ['...', '...']
}
```

## The cast

Use these people so the bank feels consistent: Citra (Head of Collection), Fitri (Desk Call lead), Budi (Field Collection lead), Yusuf (Field team lead), Eko (Agency lead), Dian (Finance), Dimas (Portfolio Analyst), Bu Ratih (Head of Collection Operations), Maya (UAT lead), Wulan (Internal Audit).

## Glossary and demos

- `[[DPD]]` shows "DPD" with a tap-to-define popover. `[[days past due|DPD]]` shows custom text.
- Terms live in `assets/js/core/reference.js`. Add new ones to your level's `terms` field.
- `[[demo:name]]` inserts an interactive picture. Available: `anatomy` (table, row, column), `order` (the order clauses run), `join` and `join-left` (matching rows), `group` (rows collapsing into groups), `fanout` (a JOIN inflating a total), `window` (a calculation that keeps every row), `transaction` (commit and rollback), `index` (scan versus lookup).

## Testing

```bash
node --no-warnings scripts/verify.mjs --level 3
```

This runs every example, solution, starter with `fill`, `altSolutions`, `wrong` attempt and quiz check. Fix every ERROR and read every WARN. `docs/DATA.md` lists all tables, values, ranges and planted problems. Query the data yourself before writing a task, so you know what the result looks like and that it is a sensible size (ideally 1 to 60 rows).

Lesson text must not hold leftover author to-do marks. The harness fails if one appears.
