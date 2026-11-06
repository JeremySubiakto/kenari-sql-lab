# Phone design (below 1000px wide)

The learner's verdict: "the computer is very nice, but not on phone". The desktop screen is what they love: dark terminal, cream paper, canary for what needs you, the violet SESUAI stamp. Keep that identity exactly. What must change is the structure, because a phone is not a narrow desktop.

This document replaces the phone sections of `docs/DESIGN.md` and `docs/UI-SPEC.md`. **Nothing at 1000px and wider may change.**

## What is wrong today

Seen at 390x720 with Android browser chrome:

- **The mission is one long page**, nearly three screens tall: position bar, plate, idea, teach, example, result, bridge, ticket, target, tables, console. To re-read the lesson you scroll far up, then far back down. On desktop the lesson and editor sit side by side, and the phone has lost that.
- **Too much chrome before any content:** site header plus position bar plus mission plate plus guilloche rules, then boxes inside boxes with inset paper.
- **After Run everything is squeezed:** verdict text cut mid-sentence ("Take another look at 30 and check it"), only 5 narrow rows, the query cut off by the bottom bar, "Teller validation" taking a third of the width.
- **The editor does not wrap,** so a beginner sees `SELECT loan_id, product, dpd, out` and has to scroll sideways.
- **The Jump bar is a big full-width button over the content** with no way back to the lesson except scrolling.
- Sprocket holes and paper margins waste scarce width. Rosettes and guilloche sit behind text.
- Home, Journey, Passbook and Scratchpad are long stacks too. Passbook is mostly empty ruled paper. Navigation hides behind a hamburger.

## The idea: an app, not a page

Think of the best mobile learning apps. **One thing on screen at a time, one thumb, one obvious next action at the bottom.** The screen never scrolls as a page. Only the content area inside a step scrolls, and the top and bottom bars stay put. Lock the page like desktop does (`html[data-route="mission"]`, `100dvh`, safe-area insets).

## Mission: three steps

Compact mission bar on top (replacing the site header on this route, at most 48px): back chevron, then the mission number and title on one line (tap it to open a sheet listing the level's missions, with cleared marks), and a small Saldo. A hairline progress bar sits under it. Under that, a segmented control:

**Learn | Task | Result**

Segments are real tabs, one tap, at least 44px tall. Result is disabled until the first Run. Opening a fresh mission lands on Learn. A mission with a saved draft, or an already cleared one, lands on Task. Quizzes use **Learn | Question**. Exams use **Brief | Task | Result**.

Each step has a **fixed bottom bar with one primary action**, reachable by thumb:

### Learn
Content in reading order: the one new idea, large and calm, as the first thing you see. Teach. Demos. Example, line by line, tight. The example's result sits behind a "See its result" toggle, showing the row count. Excel bridge. `atWork` collapsed.

No mission plate, no guilloche rules, no boxes inside boxes, no rosette behind text. Text 16 to 17px with generous line height. Sections separated by space, with a hairline at most.

Bottom bar: canary **Try it** (goes to Task). On a quiz: **See the question**.

### Task
Everything needed to do the job, with no scrolling in the normal case at 390x720:

1. **Request:** requester initials and name, then the task text. It takes what it needs up to about a third of the step, scrolling inside itself if long.
2. **A row of two chips:** "Target" (toggles the what-the-answer-looks-like table) and "Tables" (opens a bottom sheet with Tables you need: each column a 44px row with its meaning, plus Peek and All tables). Tapping a column inserts it and closes the sheet, and the next blank is selected.
3. **Console:** status line naming the next step, and the terminal-style editor. It takes the remaining height. **Long lines soft-wrap** on phones, so nobody scrolls sideways. If wrapping breaks line numbers, hide the numbers on phones. The highlight layer and textarea must stay perfectly aligned. Blanks stay big and canary.

Bottom bar: Hint with pips, Start over as a quiet control, and a large canary **Run**.

**With the on-screen keyboard open:** the request collapses to one line, the chips hide, the editor stays visible, and the key bar sits directly above the keyboard with a Run key of its own. Use `visualViewport`. The bottom bar hides. Never let the keyboard cover the line being typed. The key bar has two short rows that scroll together, words on top and symbols below. Suggestions take the words' row while they show, so the bar keeps its height. Code in lessons and the mission editor is 14px.

A SQL error stays on this step: the help slip appears above the editor with the plain explanation, the one-click fix and the marked word in view, scrolling inside its own area if long. "Use this one" highlights the column when the Tables sheet opens. A blanks message appears right under the editor. Hint opens the hints as a sheet from the bottom, with Next hint inside it, so the help slip stays whole.

### Result
After Run, slide to this step automatically (quick, off for reduced motion). **Paper fills the whole step, edge to edge, with no sprocket holes and no side margins.**

1. Pinned one-line request. Tap to expand.
2. **Verdict band:** title and full text. Never truncate a sentence. If it is long, the band scrolls or expands. On a pass, the SESUAI stamp sits at the band's right, whole and visible, with the win text beside or below it. On a wrong answer, a small NOT YET mark, without the big Teller Validation box. With the phone on its side, the band sits on the left and the rows on the right, each with the full height.
3. **Rows in their own scroll box, taking all the remaining height.** At least 5 rows visible at 390x720, even with a long verdict. Numbers stay right-aligned. The "More columns" cue appears when columns are off-screen.
4. Foot: row count, and on a wrong answer the Your result and The target toggle. Copy for Excel and Copy for AI go in a small "Copy" menu, so they do not take a whole row.

Bottom bar on a wrong answer: canary **Edit query** (back to Task, cursor in the editor), and Hint. Bottom bar on a pass: canary **Next: 1.6 Title**, large, with focus, and a quiet Run again. Passing also ticks Saldo and marks the ticket closed.

### Other mission types
- **Quiz, Question step:** question, code and its result, then choices as large cards. The chosen card reveals its why. After the right one: stamp and win text, and Next in the bottom bar. Same paper language.
- **Order, Task step:** request, tiles as large rows, the built query below in the terminal, then Run. Result as usual.
- **Review mode** (`Mission.mount` with `mode: 'review'`): Task and Result only, keeping Review's own strip.

## The rest of the site

- **Bottom tab bar** on all non-mission routes, replacing the hamburger for navigation: Home, Journey, Review (with its due badge), Scratchpad, Cheat sheet. Simple drawn SVG icons with short labels, no emoji, 56px tall plus the safe-area inset. Top header is slim: brand mark, Saldo, a settings icon.
- **Home:** the first screen fits without scrolling at 390x720. Smaller headline (about 32 to 36px, three lines at most), live query card with a full-width canary Run, and the Start or Continue button visible. After Run, the result prints as compact paper with the stamp, and the page moves to show it. Returning learners see Continue first, then a compact rank, streak and Saldo row. The rosette stays decorative, dimmed and static on phones. The journey and passbook on Home become compact teasers linking to their own tabs, so Home is not a very long page.
- **Journey:** keep the route map. Levels as tappable rows with rosette, title, rank and a thin progress bar. Keep the tear-line after Level 3.
- **Passbook:** real ledger lines only, without pages of empty ruled paper (show a few blank lines at most). Readable columns at 360px. Stamps in a tidy grid of 3 per row. It should still make an accounting graduate smile. The finished two-page book becomes one column.
- **Scratchpad:** the same pattern as missions: **Query | Result | Tables** tabs, with a fixed Run. History and Saved in a sheet.
- **Cheat sheet:** sticky search, section chips that scroll sideways, code blocks and tables that fit or scroll inside themselves.
- **Review:** consistent with missions.
- **Rank-up:** fits one screen at 390x720 with the stamp, new rank, one line of what you can do, and the button in thumb reach.
- **Glossary terms:** on touch, a bottom sheet instead of a floating popover, with a large close target.

## Also fix, everywhere

**"NOT YET" flashes on correct answers.** While a passing result prints, the validation slot says NOT YET until the stamp lands. On the way to a pass it must not say that at any size. Leave the slot empty, or show the label only.

## Quality bar

- Canary only on what needs you, one at a time. Violet only for the stamp. Paper for what came back. Terminal for what you write. Both themes.
- All tap targets 44px or more. Text at least 16px for reading, 14px for code on small screens.
- Primary actions in the bottom quarter of the screen. Safe-area insets respected on all fixed bars. `100dvh`, never `100vh`, so browser bars do not hide anything.
- No continuous animations on phones. Keep it fast on a mid-range Android.
- Focus handling stays correct, because keyboard users exist on tablets. `aria-selected` and `role="tab"` on segments, and each step announced.

## Acceptance checks

Use `scripts/dev/cdp.mjs` with `p.viewport(w, h, {mobile: true})` and `p.android()`, and actually read the screenshots. Sizes: 390x720 and 360x640 (Android with browser bars), 412x780, 430x800 (large phones), 768x1024 (tablet), 390x400 (keyboard open, approximately). Both themes.

1. Mission routes: `document.documentElement.scrollHeight` equals the window height. Top bars and the bottom bar never move.
2. Task step at 390x720 on Missions 1.1, 1.13, 3.2 and 7.14: request, editor and Run all visible with no scrolling.
3. Result step at 390x720: verdict text fully readable, at least 5 rows visible, stamp whole, Next visible, nothing cut off, on a pass and on a wrong answer, including a wide `SELECT *`.
4. A long query wraps. Nothing scrolls sideways. Caret and highlight stay aligned while typing.
5. Help slip on `WHERE kol = 5` shows the one-click fix and the marked word with Run in view.
6. `DELETE FROM loans;` explains itself on the Result step.
7. Bottom tab bar on every non-mission route. No sideways page scroll anywhere.
8. Home's first screen at 390x720 shows the headline, query, Run and the Start button.
9. **Desktop unchanged:** screenshots at 1366x625 and 1440x900 of mission, pass, wrong and Home match how they looked before.
10. `node --no-warnings scripts/verify.mjs`, `test.html` and `node --no-warnings scripts/dev/e2e-all.mjs desktop` and `phone` all pass. Update the phone path in `e2e-all.mjs` to follow the new steps. Keep the classes `.ms-run`, `.ms-hintb`, `.ms-choice-b`, `.ms-tile`, `.ms-status`, `.vband`, `.ms-win`.
