# Design decisions

Three prototypes competed. These decisions are final, and they take priority over `docs/UI-SPEC.md` wherever the two differ.

**The look comes from Passbook Noir. The workspace comes from Green-bar. The momentum comes from Level Up.**

Learner's verdict: Passbook Noir is the one they want to reopen and can leave open at work. Experts' verdict: Green-bar's fixed console and one-color-one-job are the best workspace. Everyone loved Level Up's rank-up, route and small progress signals, and nobody could have its skin at the office.

The three prototypes were design studies and are not part of this repository. They were: `design-lab/passbook-noir/index.html` and `NOTES.md` (tokens, type, rosettes, stamp, paper, UV print, passbook), `design-lab/greenbar/index.html` (console structure, printing, compare, ledger jokes), `design-lab/level-up/index.html` (route, rank-up, hint pips, ticket closed). Judges' full notes: `design-lab/JUDGES.md`. All three run stand-in engines and hold stale mission data, so copy their visual and interaction code, never their data.

## Color: each color has one job

Keep Passbook Noir's tokens (`--ground`, `--hair`, `--text`, `--verd`, the terminal `--mc`, `--paper`, and the rest), in both themes. Then add one new role and enforce all of these:

| Color | Job | Never used for |
| --- | --- | --- |
| **Canary** (new, about `#FFD83A` with dark ink text, tuned for AA in both themes) | **What needs you right now:** blanks, Run, Next, and the first-run call to action. Kenari means canary, so it belongs. | Decoration, titles, verdicts, "Show the answer" |
| **Terminal** (`--mc`, dark in both themes) | What you write | |
| **Paper** (cream) | What came back: results, printouts, the database's replies | Buttons |
| **Violet** (stamp ink) | Approval only: the stamp, UV print | Anything else |
| **Amber** (`--help`) | The word to fix | Decoration |

Only one canary thing should be asking for attention at a time. In dark mode, Noir's cream Start and cream Run looked the same and confused the learner. The selected blank must look at least as strong as the others, with a visible cursor ring.

## Type

Mona Sans expanded for display, Atkinson Hyperlegible Next for all sentences (chosen for second-language readers), IBM Plex Mono for code **and for data cells**. The drawn 5x7 dot-matrix numerals are for large moments only: the mission plate, passbook date stamps and big counts, at 20px or more. Below that they are noisy, so small counts use Plex Mono. No sentence is ever set in a dot-matrix face. Check everything with Google Fonts blocked. The fallback must still look deliberate.

## Mission screen: desktop (1000px and wider)

Two panes under a slim header. Each pane scrolls on its own, and the page itself does not scroll.

**Left, learn:** level name with "Next rank: Data Reader", mission plate and title, the one new idea, teach, annotated example (notes read as a sentence; highlight the line that carries the new idea when obvious) with its real result, Excel bridge, `atWork` collapsed. Keep the title modest so it never pushes the teaching below the fold. Mission position: a compact strip with prev and next. Levels hold up to 29 missions, so dots wrap or become a strip. Each is a real target, with a tooltip naming the mission.

**Right, do:** a grid with a scrolling upper area and a **console docked to the bottom that never moves**.

- Upper area: request ticket with a named requester, role and initials, columns wanted, target preview. Then Tables you need.
- **Console:** status line, editor (sized to the query, capped at about 40 percent of pane height with internal scroll), and a key row with Hint (with pips), Start over, and **Run in canary at the far right**.
- **Status line says the next step in words:** "2 blanks to fill", "One blank left", "Ready to run", "One word to fix", "Matches the request". Never "READY" while blanks remain.
- **Paper rises out of the console** over the upper area after a run, so nothing shifts. A one-line copy of the request stays pinned at the top of the paper, because the learner must be able to re-read it next to a wrong result. A control lowers the paper to show the full ticket and tables again.

**Run must be on screen at all times**, at 1366x625 too (a 1366x768 laptop after browser bars), and at 1093x580.

## The printout

Paper holds, top to bottom: a **verdict band**, then **rows in their own scroll box** with a sticky header, then a **foot** with row count, "Copy for Excel" (never "TSV"), and "Copy for AI".

- The verdict and stamp live **outside** the horizontally scrolling table. A wide result must never push them away.
- Show "More columns" only when real result columns are off-screen.
- Line-feed print animation capped at 20 rows. **Next must appear within 1.4 seconds.** Enter or a click fast-forwards.
- Every Run clears the old printout, verdict and help slip, including from the live region.
- Several result sets stack, labeled "Result 1 of 3".
- **Compare in place:** on a wrong answer, one toggle flips the same table between "Your result" and "The target". Exams have no target.
- A row counter climbing as rows print, ending "37 rows kept, of 502" when that is true (a single-table filter), is a nice touch that shows what WHERE did.
- A "Teller validation" slot on the paper reads **NOT YET** on a wrong answer, then takes the stamp on a pass. Hide its label once stamped.

## The pass moment

Rows print, the round violet **SESUAI** stamp lands with a small jolt of the paper, showing the date, "MISI 1.2" and "BANK FIKTIF". A brief UV flare reveals violet microprint in the paper. The rows and stamp must always be visible first, at every size. If space is short, the win text compresses or scrolls, and it never covers the stamp.

Then, together: **Run flips into Next in the exact same spot, in canary, with focus**, naming the next mission ("Next: 1.3 The loan grade, Kol"), with "Enter to continue" beside it. Focus leaves the editor the moment Run passes, and the editor is read-only until the print ends, so a stray Enter cannot change the query. `win` appears. "Added to your Cheat sheet". The ticket gets a small **TICKET 1.2 CLOSED** mark. The header **Saldo** ticks from 9 to 10, and one passbook line prints in the verdict band.

Everyday wins stay small. The big moment is saved for clearing a level.

## Wrong answers and errors

Wrong answers are kind and specific: **NOT YET** in the validation slot, `verdict.title`, `verdict.body` and `verdict.tips`.

Errors rise as a **help slip attached to the marked word**, with a small pointer to it (positions come from the monospace grid). The slip must not cover the editor or Run.

- `explainError` now returns `{title, plain, token, fix, useColumn, note}`. Show the `title` ("Right idea, different name"), `plain`, `tips`, then `note`, then the raw database message, smaller.
- `fix`: a one-click button, "Change kol to collectibility". It only appears when `fix` is set. Never invent one.
- `useColumn`: light up that column in Tables you need with a "Use this one" tag.
- After an error, select the marked word, so typing replaces it, the same as a blank.
- **Scared-person test:** `DELETE FROM loans;` and `DROP TABLE branches;` are the first things a nervous person tries after reading "you cannot break anything". They run on the throwaway copy. Say plainly what changed, and that the next Run starts clean. A SELECT right after still works and the data is whole.

## Hints and blanks

Hint button shows pips for how many are left. Hints open inline under the console's upper edge without covering the ticket. Below 1000px they slide up as a sheet with Next hint inside, so an error slip stays whole. "Show the answer" is a quiet text button, never canary, because giving up must not be the loudest option. "Copy for AI" shows only after the first Run. The blanks message attaches directly under the editor: "The yellow boxes are waiting for you. Your cursor is in the first one."

## Home

- First screen, no scrolling, down to 1280x600: Noir's headline and rosette, and the live query with a **canary Run**.
- **First Run on Home is a real win:** paper prints, the stamp lands (MISI 0.1), Mission 0.1 is recorded as cleared, Saldo goes to 1, and a line appears: "That was a real query. Now change branches to collectors." The main button becomes Mission 0.2.
- Returning learners: Continue button naming the mission, a mini route with "you are here", and a stats row printed as ledger marks, not number tiles: rank with "21 missions to Data Reader" and a small bar, streak with week dots, Saldo, reviews due.
- UV lamp: on pointer devices, the pointer reveals violet microprint on the hero rosette. Home only, and off for reduced motion and touch. Stop or simplify animations when off-screen. It must stay smooth on an office laptop.

## Journey

A compact climbing route with ten stations, then the detail list. Each level has its own rosette that grows denser with rank (a real sense of earning). A cleared level shows its stamp. No locks. A tear-line after Level 3: "Levels 0 to 3 are enough to read most everyday queries." That sentence calms people who see the total mission count, so make it visible.

## Passbook

Noir's book, with Indonesian ledger heads an accounting graduate will enjoy: Tanggal, Keterangan, Kredit, Saldo. Add Green-bar's jokes: BALANCE B/F, a double rule under the last balance, rank posted as "Interest", "E. & O.E.", "TOTAL DEBITS 0. CLEARED MISSIONS STAY CLEARED." Level stamps on a facing page. Finishing Level 9 opens a full two-page completed passbook with the rank SQL Pro, and a name field that stays on the device. No sentence here needs a translation to understand the progress.

## Rank-up

Level Up's structure, in Noir's skin: a sheet of paper on the desk (no full-screen color flood), the level's rosette, a big violet stamp with the new rank, "You can now ..." from `level.goal`, the mini route with you are here, the next level's name and rank on a canary button, and the line "Bank Kenari is made up. This rank is yours."

## Phone (below 1000px)

Single column in this order: compact position bar ("Mission 2 of 22" with a thin progress bar and prev and next, tapping opens a sheet listing the level's missions), title, new idea, teach, example, bridge, then ticket, tables (collapsed by default, 44px rows), console. **A bottom bar that changes with context:** "Jump to the editor" while reading, Hint and Run once the console is in view, Next after a pass. No canary Run while they are still reading.

- Results print directly above the console, so rows, verdict, editor and Run are all visible with no scroll, down to 360x640. Stamp stays visible. Hide the key bar after a pass.
- All targets 44px or larger. Key bar only while the editor has focus.
- Add `interactive-widget=resizes-content` to the viewport meta, and use `visualViewport` so the bottom bar and key bar stay above the keyboard. Jump to the editor moves focus properly.
- Site navigation: a menu button in the header opens a sheet.

## Small things that matter

- All counts, titles, dots and copy come from the lesson files. Never hardcode. There are 198 missions, and Level 7 has 29.
- Glossary popover for Kol shows the five grades as a small table with the Indonesian names and days-past-due bands. Other terms show their definition.
- Tables panel on desktop: two columns of `name meaning` so all columns of `loans` fit, as in Noir.
- Requester from `lesson.from`. Text may be like "Citra, Head of Collection". Initials come from the first word.
- Keyboard: Ctrl/Cmd+Enter runs, and the label shows the right keys for the platform (a Windows laptop should not say Cmd).
- Loading: calm "Warming up the database" only where the engine is needed. Run queues until it is ready. Engine failure keeps lessons readable, and says how to retry.
- Sound is off by default. It has never been listened to, so keep it short and quiet.

## Acceptance checks

Run these for real with `scripts/dev/cdp.mjs` and read the screenshots.

Sizes: 1920x1080, 1440x900, 1366x625, 1280x720, 1093x580, 768x1024, 390x844, 360x640. Both themes. Fonts blocked. Reduced motion.

1. Run is visible at every desktop size, in every state, without scrolling.
2. On a pass, rows, stamp and Next are all visible with no scrolling at every size. Next within 1.4 seconds. Enter continues, and no stray Enter changes the query.
3. The request can be re-read next to a wrong result.
4. A wide result (8 or more columns) leaves the verdict and stamp in place.
5. `DELETE FROM loans;` on a mission explains itself, and the next run works.
6. A query with a JOIN and no ON on big tables times out kindly, and the app keeps working.
7. Levels with 29 missions render well on a phone.
8. No sideways page scroll at any size. No console errors. Tap targets 44px on phones.
9. `test.html` passes on all 198 missions in the real browser engine.
10. Works from a subfolder path, and only calls the fonts and engine hosts.
