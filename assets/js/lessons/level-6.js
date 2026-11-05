/* Level 6: bugs that raise no error. Most missions hand the learner a colleague's query to repair. */
(function (root) {
  (root.KENARI_LEVELS = root.KENARI_LEVELS || []).push({
    n: 6,
    title: "Debug a Colleague's Query",
    rank: 'Bug Hunter',
    tagline: 'No error message. Wrong answer anyway.',
    goal: 'Find and fix the bugs that run without complaint and quietly give the wrong number.',
    terms: {
      'precedence': 'The order SQL applies AND, OR and other operators when no brackets say otherwise.',
      'bare column': 'A column in SELECT that is neither in GROUP BY nor inside SUM, COUNT or a similar function.'
    },
    lessons: [
      {
        id: '6.1',
        type: 'fix',
        title: 'On-time loans on the overdue list',
        newIdea: 'AND runs before OR, so mixed conditions need brackets.',
        from: 'Dimas, Portfolio Analyst',
        teach: `<p>SQL has a rule of [[precedence]]: AND runs before OR, the way multiply runs before add. So <code>team = 'Field' OR team = 'Agency' AND branch_id = 1</code> means all Field people, plus Agency people in branch 1. The AND applies only to the test right beside it.</p><p>No error appears. The list only comes back too long. Brackets say exactly what you mean.</p>`,
        ex: [
          [`SELECT collector_name, team, branch_id`, `Show each collector's name, team and branch`],
          [`FROM collectors`, `from the collectors table,`],
          [`WHERE (team = 'Field' OR team = 'Agency')`, `keeping people in Field or Agency`],
          [`  AND branch_id = 1;`, `who also sit in branch 1.`]
        ],
        bridge: 'Like =2+3*4 in Excel, which gives 14 until you add brackets to get 20.',
        task: `My list of KTA and KKB loans over 90 [[DPD]], of any status, goes to the field team today, and it has KTA loans with no overdue days on it. Please fix my query. Keep the same four columns.`,
        starter: `SELECT loan_id, product, dpd, outstanding
FROM loans
WHERE product = 'KTA' OR product = 'KKB' AND dpd > 90;`,
        solution: `SELECT loan_id, product, dpd, outstanding
FROM loans
WHERE (product = 'KTA' OR product = 'KKB')
  AND dpd > 90;`,
        altSolutions: [
          `SELECT loan_id, product, dpd, outstanding FROM loans WHERE product IN ('KTA', 'KKB') AND dpd > 90;`,
          `SELECT loan_id, product, dpd, outstanding FROM loans WHERE (product = 'KTA' AND dpd > 90) OR (product = 'KKB' AND dpd > 90);`,
          `SELECT loan_id, product, dpd, outstanding FROM loans WHERE dpd > 90 AND (product = 'KKB' OR product = 'KTA');`
        ],
        wrong: [
          `SELECT loan_id, product, dpd, outstanding FROM loans WHERE product = 'KTA' OR product = 'KKB' AND dpd > 90;`,
          `SELECT loan_id, product, dpd, outstanding FROM loans WHERE (product = 'KTA' OR product = 'KKB' AND dpd > 90);`,
          `SELECT loan_id, product, dpd, outstanding FROM loans WHERE product = 'KTA' AND dpd > 90 OR product = 'KKB';`,
          `SELECT loan_id, product, dpd, outstanding FROM loans WHERE product = 'KTA' AND product = 'KKB' AND dpd > 90;`,
          `SELECT loan_id, product, dpd, outstanding FROM loans WHERE (product = 'KTA' OR product = 'KKB') AND dpd > 90 AND status <> 'Written Off';`
        ],
        traps: [
          { re: /'KTA'\s+OR\s+(l\.)?product\s*=\s*'KKB'\s+AND/i, msg: 'The AND still applies to the KKB test only. Close the bracket right after <code>\'KKB\'</code>, so the two product tests sit together.' },
          { re: /dpd\s*>\s*90\s+OR\b/i, msg: 'Now the 90-day test applies to the KTA side only, so every KKB loan gets through. Keep one DPD test outside brackets that hold both products.' },
          { re: /'KTA'\s+AND\s+(l\.)?product\s*=\s*'KKB'/i, msg: 'One loan cannot be KTA and KKB at the same time, so this matches nothing. The two product tests need OR, inside brackets.' },
          { re: /\bstatus\b/i, msg: 'This list covers every status, so leave the status filter out. Collection continues after write-off.' }
        ],
        requires: [
          { re: /^(?![\s\S]*\bdpd\s*>=\s*90\b)/i, msg: 'Right rows today, because no loan sits at exactly 90 DPD. Over 90 means 91 and up, and a loan at exactly 90 is still Kol 2, so write <code>dpd &gt; 90</code>.' }
        ],
        hints: [
          `Run it and read the <code>dpd</code> column. Look for a KTA row with 0.`,
          `AND runs first, so <code>dpd &gt; 90</code> applies to KKB only. Every KTA loan gets through.`,
          `Put brackets around the two product tests: <code>WHERE (product = 'KTA' OR product = 'KKB') AND dpd &gt; 90</code>`
        ],
        win: `A field visit costs money, and visiting a customer who pays on time can upset a good borrower. Add brackets every time you mix AND with OR, even when you are sure of the rule.`,
        pattern: { sql: `WHERE (col_a = 'a' OR col_a = 'b')\n  AND other_col > 90`, note: 'Brackets around OR when it sits beside AND' }
      },
      {
        id: '6.2',
        type: 'fix',
        title: 'A total bigger than the whole book',
        newIdea: 'A JOIN that repeats a loan makes SUM count its balance again each time.',
        from: 'Sari, Digital Collection',
        teach: `<p>This bug is called [[fan-out]]. A loan with nine payments becomes nine rows after a JOIN, and SUM adds its balance nine times.</p>[[demo:fanout]]<p>Catch it with a [[control total]] that covers the same loans as your result. A part can never exceed the whole.</p><p>To fix it, stop joining the table that has many rows per loan. Use it only to filter, with <code>IN</code> and a subquery. Each loan then stays one row.</p>`,
        ex: [
          [`SELECT SUM(l.outstanding) AS total_outstanding`, `Add up the balance, once per loan,`],
          [`FROM loans l`, `from the loans table,`],
          [`WHERE l.loan_id IN (`, `keeping only loans found in`],
          [`  SELECT a.loan_id`, `the list of loan IDs`],
          [`  FROM collection_activities a`, `in collection activities`],
          [`  WHERE a.activity_type = 'Visit');`, `that had a visit.`]
        ],
        bridge: 'Like an XLOOKUP copied down a payment list, where each loan balance repeats and the column total means nothing.',
        task: `I need the total outstanding of loans with at least one Mobile payment, any status. Mine says about Rp 91 billion. All loans, written-off ones included, hold Rp 34.7 billion. The [[book]] is Rp 32.3 billion. Fix it so each loan counts once. One row, one column: <code>total_outstanding</code>.`,
        starter: `SELECT SUM(l.outstanding) AS total_outstanding
FROM loans l
JOIN payments p
  ON p.loan_id = l.loan_id
WHERE p.channel = 'Mobile';`,
        solution: `SELECT SUM(l.outstanding) AS total_outstanding
FROM loans l
WHERE l.loan_id IN (
  SELECT p.loan_id
  FROM payments p
  WHERE p.channel = 'Mobile'
);`,
        altSolutions: [
          `SELECT SUM(l.outstanding) AS total_outstanding FROM loans l WHERE EXISTS (SELECT 1 FROM payments p WHERE p.loan_id = l.loan_id AND p.channel = 'Mobile');`,
          `SELECT SUM(outstanding) AS total_outstanding FROM (SELECT DISTINCT l.loan_id, l.outstanding FROM loans l JOIN payments p ON p.loan_id = l.loan_id WHERE p.channel = 'Mobile');`,
          `WITH mobile_loans AS (SELECT DISTINCT loan_id FROM payments WHERE channel = 'Mobile') SELECT SUM(l.outstanding) AS total_outstanding FROM loans l JOIN mobile_loans m ON m.loan_id = l.loan_id;`,
          `SELECT SUM(l.outstanding) AS total_outstanding FROM loans l JOIN (SELECT loan_id FROM payments WHERE channel = 'Mobile' GROUP BY loan_id) m ON m.loan_id = l.loan_id;`
        ],
        wrong: [
          `SELECT SUM(l.outstanding) AS total_outstanding FROM loans l JOIN payments p ON p.loan_id = l.loan_id WHERE p.channel = 'Mobile';`,
          `SELECT SUM(DISTINCT l.outstanding) AS total_outstanding FROM loans l JOIN payments p ON p.loan_id = l.loan_id WHERE p.channel = 'Mobile';`,
          `SELECT SUM(outstanding) AS total_outstanding FROM loans WHERE loan_id IN (SELECT loan_id FROM payments);`,
          `SELECT SUM(outstanding) AS total_outstanding FROM loans;`
        ],
        traps: [
          { re: /^(?![\s\S]*'Mobile')/i, msg: 'The Mobile filter has gone. The request is only about loans with at least one Mobile payment.' },
          { re: /SUM\s*\(\s*DISTINCT/i, msg: 'Very close, and this is a classic. <code>SUM(DISTINCT ...)</code> adds each different <b>amount</b> once, so two separate loans with the same balance count as one. Keep each loan as one row instead, with <code>IN</code> or <code>EXISTS</code>.' },
          { re: /\bJOIN\s+payments\b(?![\s\S]*\bDISTINCT\b)(?![\s\S]*\bGROUP\s+BY\b)/i, msg: 'The JOIN to <code>payments</code> is still repeating each loan. Compare your total with all loans, written-off ones included, Rp 34.7 billion.' }
        ],
        hints: [
          `Each loan has many payments. To see it, replace the SELECT line with <code>SELECT l.loan_id, l.outstanding</code> and run it. The same loan appears again and again.`,
          `You only need <code>payments</code> to decide which loans qualify. Nothing from it appears in the answer, so it can move into a subquery.`,
          `Remove the JOIN and write <code>WHERE l.loan_id IN (SELECT p.loan_id FROM payments p WHERE p.channel = 'Mobile')</code>`
        ],
        win: `Before you send any total, compare it with a control total that covers the same loans, here all loans. A report with a total above that loses people's trust at once.`,
        pattern: { sql: `SELECT SUM(l.amount) AS total\nFROM parent l\nWHERE l.id IN (\n  SELECT c.parent_id\n  FROM child c\n);`, note: 'Use a table with many matching rows as a filter, without repeating rows' }
      },
      {
        id: '6.3',
        type: 'fix',
        title: 'Counted activities, wanted loans',
        newIdea: 'COUNT(*) counts rows and COUNT(DISTINCT col) counts different things, so decide which one the request wants.',
        from: 'Fitri, Desk Call lead',
        teach: `<p>Before you count, say what one row means. That is the [[grain]] of your result.</p><p>In <code>collection_activities</code>, one row is one contact attempt. A loan contacted five times is five rows, so <code>COUNT(*)</code> counts contact attempts.</p><p>You met <code>COUNT(DISTINCT loan_id)</code> in Level 2. It counts each different loan once. This JOIN does not repeat anything, because each activity has at most one collector, so the JOIN can stay.</p>`,
        ex: [
          [`SELECT channel,`, `Show each payment channel,`],
          [`  COUNT(*) AS payment_rows,`, `how many payment rows it has,`],
          [`  COUNT(DISTINCT loan_id) AS loans_paying`, `and how many different loans those rows belong to,`],
          [`FROM payments`, `from the payments table,`],
          [`WHERE payment_date BETWEEN '2026-09-01' AND '2026-09-30'`, `counting only September 2026,`],
          [`GROUP BY channel;`, `with one row per channel.`]
        ],
        bridge: 'Like a PivotTable that shows Count when you wanted Distinct Count.',
        task: `I track how many different loans each Desk Call collector works in a month. My October 2026 numbers look far too high, and I think they count contact attempts. Fix it so one loan counts once per collector. List only collectors with activity in October. Show <code>collector_name</code> and <code>loans_worked</code>.`,
        starter: `SELECT k.collector_name, COUNT(*) AS loans_worked
FROM collection_activities a
JOIN collectors k
  ON k.collector_id = a.collector_id
WHERE k.team = 'Desk Call'
  AND a.activity_date BETWEEN '2026-10-01' AND '2026-10-31'
GROUP BY k.collector_id, k.collector_name;`,
        solution: `SELECT k.collector_name, COUNT(DISTINCT a.loan_id) AS loans_worked
FROM collection_activities a
JOIN collectors k
  ON k.collector_id = a.collector_id
WHERE k.team = 'Desk Call'
  AND a.activity_date BETWEEN '2026-10-01' AND '2026-10-31'
GROUP BY k.collector_id, k.collector_name;`,
        altSolutions: [
          `SELECT collector_name, COUNT(*) AS loans_worked FROM (SELECT DISTINCT k.collector_name, a.loan_id FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE k.team = 'Desk Call' AND a.activity_date BETWEEN '2026-10-01' AND '2026-10-31') GROUP BY collector_name;`,
          `SELECT k.collector_name, COUNT(DISTINCT a.loan_id) AS loans_worked FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE k.team = 'Desk Call' AND a.activity_date >= '2026-10-01' GROUP BY k.collector_id, k.collector_name;`
        ],
        wrong: [
          `SELECT k.collector_name, COUNT(a.loan_id) AS loans_worked FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE k.team = 'Desk Call' AND a.activity_date BETWEEN '2026-10-01' AND '2026-10-31' GROUP BY k.collector_name;`,
          `SELECT k.collector_name, COUNT(DISTINCT a.activity_id) AS loans_worked FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE k.team = 'Desk Call' AND a.activity_date BETWEEN '2026-10-01' AND '2026-10-31' GROUP BY k.collector_name;`,
          `SELECT k.collector_name, COUNT(DISTINCT a.loan_id) AS loans_worked FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE k.team = 'Desk Call' GROUP BY k.collector_name;`,
          `SELECT DISTINCT k.collector_name, COUNT(*) AS loans_worked FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE k.team = 'Desk Call' AND a.activity_date BETWEEN '2026-10-01' AND '2026-10-31' GROUP BY k.collector_name;`,
          `SELECT k.collector_name, COUNT(DISTINCT a.loan_id) AS loans_worked FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE k.team = 'Desk Call' AND a.activity_type = 'Call' AND a.activity_date BETWEEN '2026-10-01' AND '2026-10-31' GROUP BY k.collector_id, k.collector_name;`,
          `SELECT k.collector_name, COUNT(DISTINCT a.loan_id) AS loans_worked FROM collectors k LEFT JOIN collection_activities a ON a.collector_id = k.collector_id AND a.activity_date BETWEEN '2026-10-01' AND '2026-10-31' WHERE k.team = 'Desk Call' GROUP BY k.collector_id, k.collector_name;`
        ],
        traps: [
          { re: /\bLEFT\s+JOIN\b/i, msg: 'This list is only collectors with activity in October, so the plain JOIN is right here. Showing zeros is the next mission.' },
          { re: /activity_type\s*=/i, msg: 'One row is any contact attempt, including WhatsApp and SP Letter. Fitri counts loans worked by any contact, so leave this filter out.' },
          { re: /^(?![\s\S]*\bDISTINCT\b)[\s\S]*COUNT\s*\(\s*\*\s*\)/i, msg: '<code>COUNT(*)</code> counts rows, and one row here is one contact attempt. Fitri wants different loans.' },
          { re: /COUNT\s*\(\s*a\.loan_id\s*\)|COUNT\s*\(\s*loan_id\s*\)/i, msg: '<code>COUNT(a.loan_id)</code> still counts every row that has a loan ID. The word <code>DISTINCT</code> goes inside the brackets.' },
          { re: /DISTINCT\s+(a\.)?activity_id/i, msg: 'Every activity has its own ID, so this still counts every contact attempt. Count different <code>loan_id</code> values.' },
          { re: /^(?![\s\S]*2026-10)/i, msg: 'The October filter has gone, so this counts the whole year. Keep the date test.' },
          { re: /SELECT\s+DISTINCT[\s\S]*COUNT\s*\(\s*\*\s*\)/i, msg: '<code>SELECT DISTINCT</code> removes repeated result rows after the counting is done, so the counts stay the same. Put <code>DISTINCT</code> inside <code>COUNT( )</code>.' }
        ],
        hints: [
          `Say what one row of <code>collection_activities</code> means. Then say what Fitri wants to count.`,
          `Only the <code>COUNT</code> needs to change. The JOIN and the filters are fine.`,
          `Replace <code>COUNT(*)</code> with <code>COUNT(DISTINCT a.loan_id)</code>.`
        ],
        win: `Effort and coverage are two different numbers. Twenty calls on three loans is very different work from twenty calls on twenty loans, so always say which one your report shows.`,
        pattern: { sql: `SELECT group_col, COUNT(DISTINCT id_col) AS things\nFROM table_name\nGROUP BY group_col;`, note: 'Count different things, not rows' }
      },
      {
        id: '6.4',
        type: 'fix',
        title: 'The collectors who vanished',
        newIdea: 'A WHERE test on the table after LEFT JOIN removes the unmatched rows, so that test belongs in ON.',
        from: 'Yusuf, Field team lead',
        teach: `<p>A LEFT JOIN keeps unmatched rows and fills the joined table's columns with [[NULL]]. Then WHERE runs. A date test removes the unmatched rows, because a NULL date is not true. It also removes rows that matched only outside the dates. Your LEFT JOIN now behaves like a plain JOIN.</p>[[demo:join-left]]<p>If a test is about the table named after LEFT JOIN, put it in <code>ON</code>, so it decides what matches. If it is about the first table, keep it in <code>WHERE</code>. The one exception is <code>IS NULL</code> looking for rows with no match, as in Level 3, which stays in <code>WHERE</code>.</p>`,
        ex: [
          [`SELECT k.collector_name, COUNT(g.assignment_id) AS new_loans`, `Show each collector's name and new loan count`],
          [`FROM collectors k`, `starting from all collectors,`],
          [`LEFT JOIN loan_assignments g ON g.collector_id = k.collector_id`, `attaching their assignments, if any,`],
          [`  AND g.assigned_date >= '2026-07-01'`, `but matching only assignments from July 2026 onward,`],
          [`WHERE k.team = 'Agency'`, `for Agency people,`],
          [`GROUP BY k.collector_id, k.collector_name;`, `with one row per collector.`]
        ],
        exNote: `All 5 people show, and four have 0. Move the date test down into WHERE and only Sari Rahayu is left.`,
        bridge: 'Like filtering a sheet on a looked-up column, which hides every row where the lookup came back #N/A.',
        task: `I want every Field collector with the number of activities logged in the last week of October, 25 to 31 October 2026, zero included. The zeros are who I am looking for, and my list shows only 8 of 13 people. Show <code>collector_name</code> and <code>activities</code>.`,
        starter: `SELECT k.collector_name, COUNT(a.activity_id) AS activities
FROM collectors k
LEFT JOIN collection_activities a
  ON a.collector_id = k.collector_id
WHERE k.team = 'Field'
  AND a.activity_date BETWEEN '2026-10-25' AND '2026-10-31'
GROUP BY k.collector_id, k.collector_name;`,
        solution: `SELECT k.collector_name, COUNT(a.activity_id) AS activities
FROM collectors k
LEFT JOIN collection_activities a
  ON a.collector_id = k.collector_id
  AND a.activity_date BETWEEN '2026-10-25' AND '2026-10-31'
WHERE k.team = 'Field'
GROUP BY k.collector_id, k.collector_name;`,
        altSolutions: [
          `SELECT k.collector_name, (SELECT COUNT(*) FROM collection_activities a WHERE a.collector_id = k.collector_id AND a.activity_date BETWEEN '2026-10-25' AND '2026-10-31') AS activities FROM collectors k WHERE k.team = 'Field';`,
          `WITH last_week AS (SELECT * FROM collection_activities WHERE activity_date BETWEEN '2026-10-25' AND '2026-10-31') SELECT k.collector_name, COUNT(a.activity_id) AS activities FROM collectors k LEFT JOIN last_week a ON a.collector_id = k.collector_id WHERE k.team = 'Field' GROUP BY k.collector_id, k.collector_name;`,
          `SELECT k.collector_name, SUM(CASE WHEN a.activity_date BETWEEN '2026-10-25' AND '2026-10-31' THEN 1 ELSE 0 END) AS activities FROM collectors k LEFT JOIN collection_activities a ON a.collector_id = k.collector_id WHERE k.team = 'Field' GROUP BY k.collector_id, k.collector_name;`,
          `SELECT k.collector_name, COUNT(a.activity_id) AS activities FROM collectors k LEFT JOIN collection_activities a ON a.collector_id = k.collector_id AND a.activity_date >= '2026-10-25' AND a.activity_date <= '2026-10-31' WHERE k.team = 'Field' GROUP BY k.collector_name;`
        ],
        wrong: [
          `SELECT k.collector_name, COUNT(*) AS activities FROM collectors k LEFT JOIN collection_activities a ON a.collector_id = k.collector_id AND a.activity_date BETWEEN '2026-10-25' AND '2026-10-31' WHERE k.team = 'Field' GROUP BY k.collector_id, k.collector_name;`,
          `SELECT k.collector_name, COUNT(a.activity_id) AS activities FROM collectors k LEFT JOIN collection_activities a ON a.collector_id = k.collector_id WHERE k.team = 'Field' AND (a.activity_date BETWEEN '2026-10-25' AND '2026-10-31' OR a.activity_id IS NULL) GROUP BY k.collector_id, k.collector_name;`,
          `SELECT k.collector_name, COUNT(a.activity_id) AS activities FROM collectors k LEFT JOIN collection_activities a ON a.collector_id = k.collector_id WHERE k.team = 'Field' AND (a.activity_date BETWEEN '2026-10-25' AND '2026-10-31' OR a.activity_date IS NULL) GROUP BY k.collector_id, k.collector_name;`,
          `SELECT k.collector_name, COUNT(a.activity_id) AS activities FROM collectors k LEFT JOIN collection_activities a ON a.collector_id = k.collector_id AND k.team = 'Field' AND a.activity_date BETWEEN '2026-10-25' AND '2026-10-31' GROUP BY k.collector_id, k.collector_name;`,
          `SELECT k.collector_name, COUNT(a.activity_id) AS activities FROM collectors k LEFT JOIN collection_activities a ON a.collector_id = k.collector_id WHERE k.team = 'Field' GROUP BY k.collector_id, k.collector_name;`
        ],
        traps: [
          { re: /\bWHERE\b[\s\S]*\bactivity_date\s+(BETWEEN|>=|>|<=|<)/i, msg: 'The date test is still in <code>WHERE</code>, which runs after the LEFT JOIN. It removes collectors with no activity at all, because their date is NULL, and collectors whose activity is all in other weeks. Move the test up into <code>ON</code>.' },
          { re: /^(?![\s\S]*activity_date)/i, msg: 'The date test has gone, so this counts the whole year. Keep it, and put it in <code>ON</code>.' },
          { re: /a\.activity_id\s+IS\s+NULL|a\.activity_date\s+IS\s+NULL/i, msg: 'Clever, and it nearly works. It keeps people with no activity at all, but it drops anyone who worked in other weeks and not this one. Maria Setiawan is one of them. Move the date test into <code>ON</code>.' },
          { re: /\bON\b(?:(?!\bWHERE\b)[\s\S])*k\.team\s*=\s*'Field'/i, msg: 'A LEFT JOIN keeps every row on the left, whatever ON says, so all 33 collectors come back. The team test is about the first table, so it stays in <code>WHERE</code>.' }
        ],
        hints: [
          `Run it and count the rows. Then ask which clause removed the five missing people.`,
          `Four of the five have no activity at all, so their date is NULL. Maria Setiawan has activity, but only in other weeks. The WHERE removes both kinds.`,
          `Move <code>AND a.activity_date BETWEEN '2026-10-25' AND '2026-10-31'</code> up into the ON. Keep <code>WHERE k.team = 'Field'</code> where it is.`
        ],
        win: `The people with zero are often the whole reason for the report. Whenever a LEFT JOIN is followed by a WHERE, check that it does not test the joined table, unless the test is IS NULL looking for rows with no match.`,
        pattern: { sql: `SELECT l.name, COUNT(r.id) AS matches\nFROM left_table l\nLEFT JOIN right_table r\n  ON r.left_id = l.id\n  AND r.some_date >= '2026-10-01'\nWHERE l.team = 'Field'\nGROUP BY l.id, l.name;`, note: 'Tests on the joined table go in ON. Tests on the first table go in WHERE. The exception is IS NULL looking for rows with no match, which stays in WHERE.' }
      },
      {
        id: '6.5',
        type: 'fix',
        title: 'NOT IN returned nothing',
        newIdea: 'One NULL in a NOT IN list makes the whole test fail for every row.',
        from: 'Bu Ratih, Head of Collection Operations',
        teach: `<p><code>x NOT IN (1, 2, NULL)</code> means x is not 1, and not 2, and not unknown. Nobody can be sure about the unknown, so no row ever passes. You get an empty result and no error.</p><p>An empty result looks like good news. Here it is wrong.</p><p>There are two safe fixes. Remove the NULLs inside the subquery with <code>IS NOT NULL</code>, or use <code>NOT EXISTS</code>, which NULLs cannot upset.</p>`,
        ex: [
          [`SELECT collector_name, team`, `Show each person's name and team`],
          [`FROM collectors`, `from the collectors table,`],
          [`WHERE team = 'Agency'`, `keeping Agency staff`],
          [`  AND collector_id NOT IN (`, `whose ID is not in`],
          [`    SELECT supervisor_id`, `the list of bosses`],
          [`    FROM collectors`, `from the same table,`],
          [`    WHERE supervisor_id IS NOT NULL);`, `with the empty boss entry removed first.`]
        ],
        exNote: `The list of bosses has one NULL, because the top boss has no boss. Without the last line this query returns nothing.`,
        bridge: 'Like =SUM(A1:A10) when one cell holds #N/A, and the whole answer becomes #N/A.',
        task: `I need everyone in the <code>collectors</code> table with no activity logged at all, team leads and managers included, so we can check why. My query returned zero rows, and I told my boss everyone is working. Please fix it. Show <code>collector_id</code>, <code>collector_name</code> and <code>team</code>.`,
        starter: `SELECT collector_id, collector_name, team
FROM collectors
WHERE collector_id NOT IN (
  SELECT collector_id
  FROM collection_activities
);`,
        solution: `SELECT k.collector_id, k.collector_name, k.team
FROM collectors k
WHERE NOT EXISTS (
  SELECT 1
  FROM collection_activities a
  WHERE a.collector_id = k.collector_id
);`,
        altSolutions: [
          `SELECT collector_id, collector_name, team FROM collectors WHERE collector_id NOT IN (SELECT collector_id FROM collection_activities WHERE collector_id IS NOT NULL);`,
          `SELECT k.collector_id, k.collector_name, k.team FROM collectors k LEFT JOIN collection_activities a ON a.collector_id = k.collector_id WHERE a.activity_id IS NULL;`,
          `SELECT collector_id, collector_name, team FROM collectors WHERE collector_id NOT IN (SELECT collector_id FROM collection_activities WHERE activity_type <> 'Auto SMS');`,
          `SELECT collector_id, collector_name, team FROM collectors k WHERE NOT EXISTS (SELECT 1 FROM collection_activities a WHERE a.collector_id = k.collector_id);`,
          `SELECT collector_id, collector_name, team FROM collectors WHERE NOT EXISTS (SELECT 1 FROM collection_activities a WHERE a.collector_id = collectors.collector_id);`
        ],
        wrong: [
          `SELECT collector_id, collector_name, team FROM collectors WHERE collector_id NOT IN (SELECT collector_id FROM collection_activities);`,
          `SELECT collector_id, collector_name, team FROM collectors WHERE collector_id NOT IN (SELECT collector_id FROM collection_activities WHERE activity_type = 'Visit');`,
          `SELECT collector_id, collector_name, team FROM collectors WHERE collector_id IN (SELECT collector_id FROM collection_activities WHERE collector_id IS NOT NULL);`,
          `SELECT collector_id, collector_name, team FROM collectors WHERE collector_id NOT IN (SELECT collector_id FROM collection_activities WHERE collector_id IS NULL);`,
          `SELECT collector_id, collector_name, team FROM collectors WHERE NOT EXISTS (SELECT 1 FROM collection_activities a WHERE a.collector_id = collector_id);`
        ],
        traps: [
          { re: /^(?![\s\S]*\bNOT\s+(IN|EXISTS)\b)[\s\S]*\bIN\s*\(/i, msg: 'Without <code>NOT</code>, this lists the collectors who <b>do</b> have activity. The request is for those with none.' },
          { re: /NOT\s+IN\s*\(\s*SELECT\b(?![\s\S]*\bIS\s+NOT\s+NULL\b)(?![\s\S]*<>)(?![\s\S]*activity_type\s*=)/i, msg: 'The subquery still has NULLs in it. Auto SMS rows have no collector, so <code>collector_id</code> is NULL on them. Filter those out or switch to <code>NOT EXISTS</code>.' },
          { re: /WHERE\s+(a\.)?activity_type\s*=/i, msg: 'This list only holds collectors who logged that one activity type, so people who logged other types are wrongly reported as idle. Keep every type in the list, and remove only the NULLs.' },
          { re: /a\.collector_id\s*=\s*collector_id\b|(^|[^.\w])collector_id\s*=\s*a\.collector_id\b/i, msg: 'Here <code>collector_id</code> with no table name means the activity table again, so the row matches itself. Give the outer table a short name, like <code>FROM collectors k</code>, and write <code>k.collector_id</code>.' }
        ],
        hints: [
          `Look at the subquery on its own. Check <code>collection_activities</code> for rows where <code>collector_id</code> is NULL.`,
          `Auto SMS rows have no collector, so the list has NULLs in it. One NULL is enough to empty the whole result.`,
          `Inside the subquery, add one line: <code>WHERE collector_id IS NOT NULL</code>. Nothing else changes.`,
          `Another way is NOT EXISTS. Add the letter k after the table name, so SQL can tell the two tables apart: <code>FROM collectors k WHERE NOT EXISTS (SELECT 1 FROM collection_activities a WHERE a.collector_id = k.collector_id)</code>`
        ],
        win: `Treat a surprising empty result as a question to check, never as a finding. Then read the list before you raise it, because team leads and new starters often log no activity themselves.`,
        pattern: { sql: `SELECT t.id\nFROM table_a t\nWHERE NOT EXISTS (\n  SELECT 1\n  FROM table_b b\n  WHERE b.a_id = t.id\n);`, note: 'Rows with no match, safe from NULLs' }
      },
      {
        id: '6.6',
        type: 'fix',
        title: 'Jakarta, four times',
        newIdea: 'Clean hand-typed text with UPPER and TRIM before you group by it.',
        from: 'Dimas, Portfolio Analyst',
        teach: `<p>To SQL, <code>'Jakarta'</code>, <code>'JAKARTA'</code> and <code>'Jakarta '</code> with a space at the end are three different values. Hand-typed columns collect all of these.</p><p><code>TRIM</code> removes spaces from both ends. <code>UPPER</code> turns letters into capitals. Together, <code>UPPER(TRIM(city))</code> gives one clean value to group by.</p><p>Name the clean column <code>clean_city</code> and group by that name.</p>`,
        ex: [
          [`SELECT DISTINCT city,`, `Show each different spelling of the city,`],
          [`  LENGTH(city) AS characters,`, `how many characters it has,`],
          [`  UPPER(TRIM(city)) AS clean_city`, `and its cleaned version,`],
          [`FROM customers`, `from the customers table,`],
          [`WHERE UPPER(TRIM(city)) = 'SEMARANG';`, `for Semarang only.`]
        ],
        exNote: `Two rows look the same, and one has 9 characters. The extra one is a space at the end, which you cannot see. <code>LENGTH</code> counts characters, and spaces count too.`,
        bridge: 'Same as =UPPER(TRIM(A2)) in a helper column. Excel treats Jakarta and JAKARTA as equal, and SQL does not.',
        task: `My count of customers per city shows Jakarta on four lines. I need one row per real city. Show <code>clean_city</code> in capitals, and <code>customers</code>, which is how many customers live there.`,
        starter: `SELECT city, COUNT(*) AS customers
FROM customers
GROUP BY city
ORDER BY city;`,
        ci: true,
        solution: `SELECT UPPER(TRIM(city)) AS clean_city, COUNT(*) AS customers
FROM customers
GROUP BY clean_city
ORDER BY clean_city;`,
        altSolutions: [
          `SELECT UPPER(TRIM(city)) AS clean_city, COUNT(*) AS customers FROM customers GROUP BY UPPER(TRIM(city));`,
          `SELECT UPPER(TRIM(city)) AS clean_city, COUNT(*) AS customers FROM customers GROUP BY 1;`,
          `SELECT TRIM(UPPER(city)) AS clean_city, COUNT(*) AS customers FROM customers GROUP BY TRIM(UPPER(city));`,
          `WITH cleaned AS (SELECT UPPER(TRIM(city)) AS clean_city FROM customers) SELECT clean_city, COUNT(*) AS customers FROM cleaned GROUP BY clean_city;`
        ],
        wrong: [
          `SELECT city, COUNT(*) AS customers FROM customers GROUP BY city;`,
          `SELECT UPPER(TRIM(city)) AS city, COUNT(*) AS customers FROM customers GROUP BY city;`,
          `SELECT UPPER(city) AS clean_city, COUNT(*) AS customers FROM customers GROUP BY UPPER(city);`,
          `SELECT TRIM(city) AS clean_city, COUNT(*) AS customers FROM customers GROUP BY TRIM(city);`,
          `SELECT UPPER(TRIM(city)) AS clean_city, COUNT(*) AS customers FROM customers GROUP BY city;`,
          `SELECT LOWER(TRIM(city)) AS clean_city, COUNT(*) AS customers FROM customers GROUP BY 1;`
        ],
        requires: [
          { re: /\bUPPER\b/i, msg: 'Right groups. The request asks for capitals, so use <code>UPPER</code>.' }
        ],
        traps: [
          { re: /^(?![\s\S]*\b(UPPER|LOWER|TRIM)\b)/i, msg: 'Every spelling is still its own group. Clean the text with <code>UPPER</code> and <code>TRIM</code> before you group by it.' },
          { re: /AS\s+city\b[\s\S]*GROUP\s+BY\s+city\b/i, msg: 'You named the clean column <code>city</code>, the same as the raw one. <code>GROUP BY city</code> uses the raw column, so the messy groups stay. Call it <code>clean_city</code> and group by that.' },
          { re: /^(?![\s\S]*AS\s+city\b)[\s\S]*(UPPER|TRIM)\s*\([\s\S]*GROUP\s+BY\s+(c\.)?city\b/i, msg: 'The cleaning is in SELECT, and GROUP BY still uses the raw <code>city</code>. Group by the clean version too.' },
          { re: /^(?![\s\S]*\bTRIM\b)[\s\S]*\bUPPER\b/i, msg: '<code>UPPER</code> fixed the capitals. Spaces at the end still make separate groups, so add <code>TRIM</code>.' },
          { re: /^(?![\s\S]*\b(UPPER|LOWER)\b)[\s\S]*\bTRIM\b/i, msg: '<code>TRIM</code> fixed the spaces. Different capitals still make separate groups, so add <code>UPPER</code>.' }
        ],
        hints: [
          `Run it and look at how many spellings each city has. Some differ only by a hidden space.`,
          `You need both functions. One handles capitals and one handles spaces.`,
          `Use <code>SELECT UPPER(TRIM(city)) AS clean_city</code>, then <code>GROUP BY clean_city</code>.`
        ],
        win: `Cleaning text in your query fixes today's report. The bad data is still in the source, so tell the team that runs the system, and ask them to check text when it is typed in.`,
        atWork: `Text rules vary. SQL Server often ignores capitals and trailing spaces in comparisons, depending on its settings, while Oracle, PostgreSQL and BigQuery treat them as different. The same query can group differently, so UPPER and TRIM are a safe habit everywhere. SQL Server and older Oracle do not accept an AS name in GROUP BY, so repeat <code>UPPER(TRIM(city))</code> there.`,
        pattern: { sql: `SELECT UPPER(TRIM(col_a)) AS clean_col, COUNT(*) AS n\nFROM table_name\nGROUP BY clean_col;`, note: 'Group messy text after cleaning it. SQL Server and older Oracle need the full UPPER(TRIM(col_a)) in GROUP BY.' }
      },
      {
        id: '6.7',
        type: 'fix',
        title: 'The date that sorts wrong',
        newIdea: 'Text dates only compare correctly when every date is typed as YYYY-MM-DD with its zeros.',
        from: 'Dian, Finance',
        teach: `<p>Dates in this database are text, and text compares one character at a time from the left. <code>'2026-10-31'</code> and <code>'2026-9-1'</code> first differ at the month, where <code>1</code> comes before <code>9</code>. So 31 October counts as earlier than 1 September.</p><p>The zero fixes it. With <code>'2026-09-01'</code>, the comparison is <code>1</code> against <code>0</code>, and October lands after September.</p>`,
        ex: [
          [`SELECT '2026-10-31' < '2026-9-1' AS badly_typed,`, `Ask if 31 October is before a date typed with no zero,`],
          [`  '2026-10-31' < '2026-09-01' AS well_typed;`, `then ask the same about the date typed in full.`]
        ],
        exNote: `This query reads no table, so it has no FROM. It only compares two pieces of text. 1 means true and 0 means false. Only the well-typed date gives the right answer.`,
        bridge: 'Like sorting text cells in Excel, where 10 lands before 9 until you type the 9 as 09.',
        task: `I need cash received per month, for payments dated before 1 September 2026, to close my August numbers. September and October are still showing up. Fix my filter. Show <code>pay_month</code> and <code>total_amount</code>.`,
        starter: `SELECT strftime('%Y-%m', payment_date) AS pay_month,
  SUM(amount) AS total_amount
FROM payments
WHERE payment_date < '2026-9-1'
GROUP BY pay_month
ORDER BY pay_month;`,
        solution: `SELECT strftime('%Y-%m', payment_date) AS pay_month,
  SUM(amount) AS total_amount
FROM payments
WHERE payment_date < '2026-09-01'
GROUP BY pay_month
ORDER BY pay_month;`,
        altSolutions: [
          `SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS total_amount FROM payments WHERE payment_date <= '2026-08-31' GROUP BY pay_month;`,
          `SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS total_amount FROM payments WHERE payment_date BETWEEN '2026-01-01' AND '2026-08-31' GROUP BY pay_month;`,
          `SELECT substr(payment_date, 1, 7) AS pay_month, SUM(amount) AS total_amount FROM payments WHERE substr(payment_date, 1, 7) < '2026-09' GROUP BY pay_month;`,
          `SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS total_amount FROM payments WHERE payment_date < '2026-09' GROUP BY pay_month;`
        ],
        wrong: [
          `SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS total_amount FROM payments WHERE payment_date < '2026-9-1' GROUP BY pay_month;`,
          `SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS total_amount FROM payments WHERE payment_date < '2026-9-01' GROUP BY pay_month;`,
          `SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS total_amount FROM payments WHERE payment_date < '2026-09-1' GROUP BY pay_month;`,
          `SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS total_amount FROM payments WHERE payment_date > '2026-9-1' GROUP BY pay_month;`
        ],
        traps: [
          { re: /'2026-9/, msg: 'The month still has no zero. Every date needs all ten characters, like <code>2026-09-01</code>.' },
          { re: /'2026-09-1'/, msg: 'The month is right now, and the day still needs its zero. Write <code>2026-09-01</code>.' }
        ],
        hints: [
          `Run it. Look at which months should not be there, then look at how the date in WHERE is typed.`,
          `Compare the date with one value from the column, such as <code>2026-08-15</code>. They do not have the same number of characters.`,
          `Change the filter to <code>WHERE payment_date &lt; '2026-09-01'</code>.`
        ],
        win: `A badly typed date gives no error, and it can quietly pull two extra months into a closing figure. Any date you type into a query should have all ten characters.`,
        atWork: `Oracle, SQL Server, PostgreSQL and BigQuery have real DATE types, so these comparisons behave better there. Bank source systems often still hold dates as text or numbers, like 20260901, so check a column's type before you compare it.`,
        pattern: { sql: `WHERE date_col >= '2026-09-01'\n  AND date_col < '2026-10-01'`, note: 'Always type dates in full, as YYYY-MM-DD' }
      },
      {
        id: '6.8',
        type: 'fix',
        title: 'Every percentage is zero',
        newIdea: 'Whole number divided by whole number drops the decimals, so bring in a decimal first.',
        from: 'Rudi, Credit Risk',
        teach: `<p>You saw this in Level 2, and here it is in a real report. In SQLite, <code>3 / 4</code> gives 0, because two whole numbers give a whole number. Then 0 times 100 is still 0.</p><p>Calculations run from left to right. <code>100.0 * 3 / 4</code> starts with a decimal, so it stays a decimal and gives 75.0. <code>3 / 4 * 100.0</code> has already lost the decimals in its first step.</p>`,
        ex: [
          [`SELECT employment,`, `Show each employment type`],
          [`  ROUND(100.0 * SUM(CASE WHEN phone IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS no_phone_pct`, `and the percent of customers with no phone, to 1 decimal,`],
          [`FROM customers`, `from the customers table,`],
          [`GROUP BY employment;`, `with one row per type.`]
        ],
        bridge: 'Excel always keeps the decimals in 3/4, so this one surprises every Excel user.',
        task: `I need the percent of loans that are overdue (<code>dpd &gt; 0</code>) in each product, counting all loans of any status. Every percentage in my query comes out 0. Fix it, rounded to 1 decimal. Show <code>product</code> and <code>overdue_pct</code>.`,
        starter: `SELECT product,
  ROUND(SUM(CASE WHEN dpd > 0 THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) AS overdue_pct
FROM loans
GROUP BY product;`,
        solution: `SELECT product,
  ROUND(100.0 * SUM(CASE WHEN dpd > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS overdue_pct
FROM loans
GROUP BY product;`,
        altSolutions: [
          `SELECT product, ROUND(SUM(CASE WHEN dpd > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS overdue_pct FROM loans GROUP BY product;`,
          `SELECT product, ROUND(SUM(CASE WHEN dpd > 0 THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) AS overdue_pct FROM loans GROUP BY product;`,
          `SELECT product, ROUND(CAST(SUM(CASE WHEN dpd > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) AS overdue_pct FROM loans GROUP BY product;`,
          `SELECT product, ROUND(AVG(CASE WHEN dpd > 0 THEN 100.0 ELSE 0 END), 1) AS overdue_pct FROM loans GROUP BY product;`
        ],
        wrong: [
          `SELECT product, ROUND(SUM(CASE WHEN dpd > 0 THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) AS overdue_pct FROM loans GROUP BY product;`,
          `SELECT product, ROUND(SUM(CASE WHEN dpd > 0 THEN 1 ELSE 0 END) / COUNT(*) * 100.0, 1) AS overdue_pct FROM loans GROUP BY product;`,
          `SELECT product, ROUND(100 * SUM(CASE WHEN dpd > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS overdue_pct FROM loans GROUP BY product;`,
          `SELECT product, ROUND(1.0 * SUM(CASE WHEN dpd > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS overdue_pct FROM loans GROUP BY product;`,
          `SELECT product, ROUND(100.0 * SUM(CASE WHEN dpd > 0 THEN 1 ELSE 0 END) / COUNT(*), 0) AS overdue_pct FROM loans GROUP BY product;`
        ],
        traps: [
          { re: /\/\s*COUNT\s*\(\s*\*\s*\)\s*\*\s*100\.0/i, msg: 'You have the decimal, and it comes too late. The division runs first, on two whole numbers, and gives 0. Move <code>100.0 *</code> to the front.' },
          { re: /ROUND\s*\(\s*1\.0\s*\*/i, msg: 'The decimals are safe now, and this gives a fraction like 0.2. The request is for a percent, so multiply by <code>100.0</code>.' }
        ],
        hints: [
          `Work out the first step by hand. SUM gives a whole number and COUNT gives a whole number.`,
          `The division has to see a decimal before it runs. Calculations go from left to right.`,
          `Write <code>ROUND(100.0 * SUM(CASE WHEN dpd &gt; 0 THEN 1 ELSE 0 END) / COUNT(*), 1)</code>.`
        ],
        win: `A column of zeros gets noticed, and the dangerous version is <code>100 * x / y</code>, because 23.6 quietly becomes 23. Start every percentage with <code>100.0 *</code> and you never have to think about it again.`,
        atWork: `SQL Server and PostgreSQL drop the decimals the same way. Oracle and BigQuery keep them. Writing <code>100.0</code> gives the right answer on all of them.`,
        pattern: { sql: `ROUND(100.0 * SUM(CASE WHEN test THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct`, note: 'A percentage that keeps its decimals' }
      },
      {
        id: '6.9',
        type: 'fix',
        title: 'The average of averages',
        newIdea: 'An overall ratio is total over total, and averaging smaller ratios gives a different number.',
        from: 'Tari, Reporting analyst',
        teach: `<p>Averaging branch shares makes every branch count the same. A branch with about Rp 1.8 billion counts as much as one with about Rp 4.7 billion, so the answer is wrong.</p><p>The right way adds all the top numbers, adds all the bottom numbers, and divides once. That lets each branch count by its true size.</p>`,
        ex: [
          [`WITH product_avg AS (`, `Build a helper list`],
          [`  SELECT product, AVG(outstanding) AS avg_balance`, `of each product's average balance`],
          [`  FROM loans`, `from the loans table,`],
          [`  GROUP BY product`, `one row per product,`],
          [`)`, `and then`],
          [`SELECT ROUND(AVG(avg_balance)) AS avg_of_averages`, `take the average of those four averages`],
          [`FROM product_avg;`, `from the helper list.`]
        ],
        exNote: `This gives 86,885,845. The true average across every loan is 69,072,062. KPR has few loans with very large balances, and it still counts as one of four.`,
        bridge: 'Like =AVERAGE over a percent column, when the true figure is total overdue divided by total balance.',
        task: `I reported how much of the bank's balance is overdue by averaging the 12 branch shares, and Finance says it is wrong. Give one row, <code>overall_overdue_pct</code>: balance with <code>dpd</code> above 0 as a percent of all balance, excluding <code>Written Off</code> loans, rounded to 2 decimals.`,
        starter: `WITH branch_share AS (
  SELECT branch_id,
    100.0 * SUM(CASE WHEN dpd > 0 THEN outstanding ELSE 0 END) / SUM(outstanding) AS overdue_pct
  FROM loans
  WHERE status <> 'Written Off'
  GROUP BY branch_id
)
SELECT ROUND(AVG(overdue_pct), 2) AS overall_overdue_pct
FROM branch_share;`,
        solution: `SELECT ROUND(100.0 * SUM(CASE WHEN dpd > 0 THEN outstanding ELSE 0 END) / SUM(outstanding), 2) AS overall_overdue_pct
FROM loans
WHERE status <> 'Written Off';`,
        altSolutions: [
          `WITH branch_totals AS (SELECT branch_id, SUM(CASE WHEN dpd > 0 THEN outstanding ELSE 0 END) AS overdue_balance, SUM(outstanding) AS total_outstanding FROM loans WHERE status <> 'Written Off' GROUP BY branch_id) SELECT ROUND(100.0 * SUM(overdue_balance) / SUM(total_outstanding), 2) AS overall_overdue_pct FROM branch_totals;`,
          `SELECT ROUND(100.0 * SUM(CASE WHEN dpd <> 0 THEN outstanding ELSE 0 END) / SUM(outstanding), 2) AS overall_overdue_pct FROM loans WHERE status <> 'Written Off';`,
          `SELECT ROUND(SUM(CASE WHEN dpd > 0 THEN outstanding ELSE 0 END) * 100.0 / SUM(outstanding), 2) AS overall_overdue_pct FROM loans WHERE status IN ('Active', 'Restructured');`
        ],
        wrong: [
          `WITH branch_share AS (SELECT branch_id, 100.0 * SUM(CASE WHEN dpd > 0 THEN outstanding ELSE 0 END) / SUM(outstanding) AS overdue_pct FROM loans WHERE status <> 'Written Off' GROUP BY branch_id) SELECT ROUND(AVG(overdue_pct), 2) AS overall_overdue_pct FROM branch_share;`,
          `SELECT ROUND(100.0 * SUM(CASE WHEN dpd > 0 THEN outstanding ELSE 0 END) / SUM(outstanding), 2) AS overall_overdue_pct FROM loans;`,
          `SELECT ROUND(100.0 * SUM(CASE WHEN dpd > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) AS overall_overdue_pct FROM loans WHERE status <> 'Written Off';`,
          `SELECT ROUND(AVG(CASE WHEN dpd > 0 THEN 100.0 ELSE 0 END), 2) AS overall_overdue_pct FROM loans WHERE status <> 'Written Off';`,
          `SELECT ROUND(100.0 * SUM(CASE WHEN dpd > 30 THEN outstanding ELSE 0 END) / SUM(outstanding), 2) AS overall_overdue_pct FROM loans WHERE status <> 'Written Off';`,
          `SELECT ROUND(100.0 * SUM(CASE WHEN dpd > 0 THEN outstanding ELSE 0 END) / SUM(outstanding), 2) AS overall_overdue_pct FROM loans WHERE status = 'Active';`
        ],
        traps: [
          { re: /^(?![\s\S]*\bstatus\b)/i, msg: 'Written Off loans are still in your total. They are off the balance sheet, so this share leaves them out with a <code>status</code> filter.' },
          { re: /\bAVG\s*\(/i, msg: 'Rounding is not the problem here. <code>AVG</code> is still in your query, and this share needs total divided by total with <code>SUM</code>.' },
          { re: /COUNT\s*\(\s*\*\s*\)/i, msg: 'This one counts loans. The request is about balance, so divide <code>SUM</code> of overdue outstanding by <code>SUM(outstanding)</code>.' },
          { re: /dpd\s*(>\s*[1-9]|>=\s*[2-9])/i, msg: 'Rounding is not the problem here. Overdue means <code>dpd</code> above 0, so test <code>dpd &gt; 0</code>.' },
          { re: /status\s*=\s*'Active'/i, msg: 'Rounding is not the problem here. Restructured loans are still on the book, so exclude only <code>Written Off</code>.' }
        ],
        hints: [
          `Look at what <code>AVG(overdue_pct)</code> does. Each branch counts once, whatever its size.`,
          `You do not need the branch step at all. One ratio over the whole book gives the overall figure.`,
          `In a single query on <code>loans</code>, with the same WHERE, write <code>ROUND(100.0 * SUM(CASE WHEN dpd &gt; 0 THEN outstanding ELSE 0 END) / SUM(outstanding), 2)</code>.`
        ],
        win: `A gap of 12.27 to 12.33 looks small, and on a Rp 32 billion book it is about Rp 19 million of overdue balance. Ratios do not average across groups, so add the top numbers, add the bottom numbers, and divide at the last step.`,
        pattern: { sql: `SELECT 100.0 * SUM(part) / SUM(whole) AS overall_pct\nFROM table_name;`, note: 'An overall ratio is total over total, never AVG of ratios' }
      },
      {
        id: '6.10',
        type: 'fix',
        title: 'The column left out of GROUP BY',
        newIdea: 'Every SELECT column must be in GROUP BY or inside SUM, COUNT or a similar function, or SQLite picks a value with no warning.',
        from: 'Nadia, Credit Risk',
        teach: `<p>A column in SELECT that is neither grouped nor inside SUM or COUNT is a [[bare column]]. One group holds many rows, so SQLite picks one value and shows it with no warning.</p><p>Most other databases stop with an error here. SQLite does not, so you must check it yourself. Read your SELECT line, and make sure every plain column is also in <code>GROUP BY</code>.</p>`,
        ex: [
          [`SELECT team, branch_id,`, `Show each team and branch`],
          [`  COUNT(*) AS people`, `with its number of people`],
          [`FROM collectors`, `from the collectors table,`],
          [`GROUP BY team, branch_id;`, `making one row for each team and branch pair.`]
        ],
        bridge: 'Like a PivotTable with Product in Rows and Status nowhere, then typing one status beside each total by hand.',
        task: `I need loans and outstanding per product and per status. My report shows one status for each product, and that cannot be right, since every product has several. Fix it. Show <code>product</code>, <code>status</code>, <code>loans</code> and <code>total_outstanding</code>.`,
        starter: `SELECT product, status,
  COUNT(*) AS loans,
  SUM(outstanding) AS total_outstanding
FROM loans
GROUP BY product;`,
        solution: `SELECT product, status,
  COUNT(*) AS loans,
  SUM(outstanding) AS total_outstanding
FROM loans
GROUP BY product, status;`,
        altSolutions: [
          `SELECT product, status, COUNT(*) AS loans, SUM(outstanding) AS total_outstanding FROM loans GROUP BY status, product;`,
          `SELECT product, status, COUNT(*) AS loans, SUM(outstanding) AS total_outstanding FROM loans GROUP BY 1, 2;`,
          `SELECT product, status, COUNT(loan_id) AS loans, SUM(outstanding) AS total_outstanding FROM loans GROUP BY product, status ORDER BY product, status;`
        ],
        wrong: [
          `SELECT product, status, COUNT(*) AS loans, SUM(outstanding) AS total_outstanding FROM loans GROUP BY product;`,
          `SELECT product, status, COUNT(*) AS loans, SUM(outstanding) AS total_outstanding FROM loans GROUP BY status;`,
          `SELECT product, MAX(status) AS status, COUNT(*) AS loans, SUM(outstanding) AS total_outstanding FROM loans GROUP BY product;`,
          `SELECT product, COUNT(*) AS loans, SUM(outstanding) AS total_outstanding FROM loans GROUP BY product;`
        ],
        traps: [
          { re: /^(?![\s\S]*\b(MAX|MIN)\s*\()[\s\S]*GROUP\s+BY\s+product\s*;?\s*$/i, msg: '<code>status</code> is in SELECT and not in <code>GROUP BY</code>, so you still get one row per product with one status picked for you.' },
          { re: /MAX\s*\(\s*status\s*\)|MIN\s*\(\s*status\s*\)/i, msg: 'This silences the bug and keeps one status per product. Each product and status pair needs its own row, so <code>status</code> belongs in <code>GROUP BY</code>.' },
          { re: /GROUP\s+BY\s+status\s*;?\s*$/i, msg: 'Now it is <code>product</code> that has been left out. Both plain columns in SELECT belong in <code>GROUP BY</code>.' }
        ],
        hints: [
          `List the plain columns in SELECT. Then list the columns in GROUP BY. Compare the two lists.`,
          `<code>status</code> is in SELECT, and it is not in GROUP BY, so SQLite picks one for you.`,
          `The last line should read <code>GROUP BY product, status</code>.`
        ],
        win: `This bug looks completely normal on screen, and each number sits beside a label it does not belong to. Queries written on SQLite or MySQL can also fail when moved to a stricter database, so keep your SELECT and GROUP BY in step.`,
        atWork: `Oracle, SQL Server and BigQuery raise an error for a bare column. PostgreSQL does too, unless you grouped by the table's [[primary key]]. MySQL depends on a setting. That error helps you, because it stops the wrong number before anyone reads it.`,
        pattern: { sql: `SELECT col_a, col_b, COUNT(*) AS n\nFROM table_name\nGROUP BY col_a, col_b;`, note: 'Every plain SELECT column goes in GROUP BY' }
      },
      {
        id: '6.11',
        type: 'fix',
        title: 'A top 10 that is not the top 10',
        newIdea: 'LIMIT cuts whatever order the rows are in, so a top N needs ORDER BY.',
        from: 'Fitri, Desk Call lead',
        teach: `<p>Without <code>ORDER BY</code>, a database may return rows in any order it likes, which is often the order they were stored. <code>LIMIT</code> then cuts that list. Your "top 10" is the first 10 it found.</p><p>The result looks fine, with ten sensible rows. You only see the problem when you read the numbers. Sort first, and LIMIT runs after the sort.</p>`,
        ex: [
          [`SELECT payment_id, loan_id, amount`, `Show each payment's ID, loan and amount`],
          [`FROM payments`, `from the payments table,`],
          [`WHERE payment_date >= '2026-10-01'`, `keeping October 2026 onward,`],
          [`ORDER BY amount DESC`, `sorted with the largest first,`],
          [`LIMIT 5;`, `then stop after the first 5.`]
        ],
        bridge: 'Like copying the first ten lines of a sheet and calling them the ten largest, without sorting first.',
        task: `For next week's call plan I need the 10 largest [[Kol 2]] loans by outstanding, biggest first. My list has some tiny balances on it. Please fix it. Show <code>loan_id</code>, <code>product</code>, <code>outstanding</code> and <code>dpd</code>.`,
        starter: `SELECT loan_id, product, outstanding, dpd
FROM loans
WHERE collectibility = 2
LIMIT 10;`,
        solution: `SELECT loan_id, product, outstanding, dpd
FROM loans
WHERE collectibility = 2
ORDER BY outstanding DESC
LIMIT 10;`,
        ordered: 'outstanding',
        altSolutions: [
          `SELECT loan_id, product, outstanding, dpd FROM loans WHERE collectibility = 2 ORDER BY 3 DESC LIMIT 10;`,
          `SELECT loan_id, product, outstanding, dpd FROM loans WHERE collectibility = 2 ORDER BY outstanding DESC, loan_id LIMIT 10;`,
          `WITH ranked AS (SELECT loan_id, product, outstanding, dpd, ROW_NUMBER() OVER (ORDER BY outstanding DESC) AS rn FROM loans WHERE collectibility = 2) SELECT loan_id, product, outstanding, dpd FROM ranked WHERE rn <= 10 ORDER BY outstanding DESC;`
        ],
        wrong: [
          `SELECT loan_id, product, outstanding, dpd FROM loans WHERE collectibility = 2 LIMIT 10;`,
          `SELECT loan_id, product, outstanding, dpd FROM loans WHERE collectibility = 2 ORDER BY outstanding LIMIT 10;`,
          `SELECT loan_id, product, outstanding, dpd FROM loans WHERE collectibility = 2 ORDER BY dpd DESC LIMIT 10;`,
          `SELECT loan_id, product, outstanding, dpd FROM loans WHERE collectibility = 2 ORDER BY outstanding DESC;`
        ],
        traps: [
          { re: /^(?![\s\S]*\bORDER\s+BY\b)/i, msg: 'There is no <code>ORDER BY</code> yet, so <code>LIMIT</code> is cutting an unsorted list.' },
          { re: /ORDER\s+BY\s+(outstanding|3)\s*(ASC\s*)?(\n|\s)*LIMIT/i, msg: 'The default sort is smallest first, which gives you the 10 smallest. Add <code>DESC</code>.' },
          { re: /^(?![\s\S]*\bLIMIT\b)/i, msg: 'The sort is right, and <code>LIMIT 10</code> has gone. Put it back on the last line.' },
          { re: /ORDER\s+BY\s+dpd/i, msg: 'This sorts by how late the loan is. The request is about the largest balance, so sort by <code>outstanding</code>.' }
        ],
        hints: [
          `Run it and read the <code>outstanding</code> column. Check whether it is sorted.`,
          `A new line goes between <code>WHERE</code> and <code>LIMIT</code>.`,
          `Add <code>ORDER BY outstanding DESC</code> on the line above <code>LIMIT 10</code>.`
        ],
        win: `Call time goes where the money is, so a wrong top 10 sends people after the wrong accounts. Any time you see LIMIT in a query you are reviewing, look for the ORDER BY above it.`,
        atWork: `On large databases, the same query with no ORDER BY can return different rows on different days. Oracle writes this as <code>ORDER BY ... FETCH FIRST 10 ROWS ONLY</code> and SQL Server as <code>SELECT TOP 10 ... ORDER BY ...</code>. The sort is what makes it a true top 10.`,
        pattern: { sql: `SELECT col_a, amount\nFROM table_name\nORDER BY amount DESC\nLIMIT 10;`, note: 'A real top 10 sorts first, then cuts' }
      },
      {
        id: '6.12',
        type: 'fix',
        title: 'The change that crosses loans',
        newIdea: 'Without PARTITION BY, LAG reads the row before even when it belongs to another loan.',
        from: 'Nadia, Credit Risk',
        teach: `<p><code>LAG</code> reads the row before, whatever that row is. Sort by loan and month with no [[partition]], and each loan's first month reads the last month of the loan before it. The numbers look fine, and nothing raises an error.</p><p><code>PARTITION BY loan_id</code> starts each loan fresh. Its first month has no row before it, so its change is NULL, which is correct.</p>`,
        ex: [
          [`SELECT s.loan_id, s.snapshot_month, s.dpd,`, `Show each loan, month and DPD,`],
          [`  LAG(s.dpd) OVER (PARTITION BY s.loan_id ORDER BY s.snapshot_month) AS prior_dpd`, `plus its DPD one month earlier, starting fresh for each loan,`],
          [`FROM loan_snapshots s`, `from the snapshots,`],
          [`WHERE s.loan_id IN (75, 85)`, `for these two loans`],
          [`  AND s.snapshot_month >= '2026-08'`, `from August on,`],
          [`ORDER BY s.loan_id, s.snapshot_month;`, `sorted by loan and then by month.`]
        ],
        exNote: `Each loan starts with NULL. Without <code>PARTITION BY</code>, loan 85's first row would read loan 75's last month.`,
        bridge: 'Like filling =C3-C2 down a sorted sheet, which also subtracts across the line where one loan ends and the next begins.',
        task: `Balances should fall month by month, so I listed every snapshot where a loan's <code>outstanding</code> went up. I expected a handful and got 272 rows. Fix it, so each loan compares only with its own prior month. Show <code>loan_id</code>, <code>snapshot_month</code>, <code>outstanding</code> and <code>change_from_prior</code>, biggest rise first.`,
        starter: `WITH moves AS (
  SELECT s.loan_id, s.snapshot_month, s.outstanding,
    s.outstanding - LAG(s.outstanding) OVER (ORDER BY s.loan_id, s.snapshot_month) AS change_from_prior
  FROM loan_snapshots s
)
SELECT loan_id, snapshot_month, outstanding, change_from_prior
FROM moves
WHERE change_from_prior > 0
ORDER BY change_from_prior DESC;`,
        solution: `WITH moves AS (
  SELECT s.loan_id, s.snapshot_month, s.outstanding,
    s.outstanding - LAG(s.outstanding) OVER (PARTITION BY s.loan_id ORDER BY s.snapshot_month) AS change_from_prior
  FROM loan_snapshots s
)
SELECT loan_id, snapshot_month, outstanding, change_from_prior
FROM moves
WHERE change_from_prior > 0
ORDER BY change_from_prior DESC;`,
        ordered: 'change_from_prior',
        altSolutions: [
          `SELECT s.loan_id, s.snapshot_month, s.outstanding, s.outstanding - prev.outstanding AS change_from_prior FROM loan_snapshots s JOIN loan_snapshots prev ON prev.loan_id = s.loan_id AND prev.snapshot_month = (SELECT MAX(x.snapshot_month) FROM loan_snapshots x WHERE x.loan_id = s.loan_id AND x.snapshot_month < s.snapshot_month) WHERE s.outstanding > prev.outstanding ORDER BY change_from_prior DESC;`,
          `SELECT * FROM (SELECT loan_id, snapshot_month, outstanding, outstanding - LAG(outstanding) OVER (PARTITION BY loan_id ORDER BY snapshot_month) AS change_from_prior FROM loan_snapshots) WHERE change_from_prior > 0 ORDER BY change_from_prior DESC;`
        ],
        wrong: [
          `WITH moves AS (SELECT s.loan_id, s.snapshot_month, s.outstanding, s.outstanding - LAG(s.outstanding) OVER (ORDER BY s.loan_id, s.snapshot_month) AS change_from_prior FROM loan_snapshots s) SELECT loan_id, snapshot_month, outstanding, change_from_prior FROM moves WHERE change_from_prior > 0 ORDER BY change_from_prior DESC;`,
          `WITH moves AS (SELECT s.loan_id, s.snapshot_month, s.outstanding, s.outstanding - LAG(s.outstanding) OVER (PARTITION BY s.snapshot_month ORDER BY s.loan_id) AS change_from_prior FROM loan_snapshots s) SELECT loan_id, snapshot_month, outstanding, change_from_prior FROM moves WHERE change_from_prior > 0 ORDER BY change_from_prior DESC;`,
          `WITH moves AS (SELECT s.loan_id, s.snapshot_month, s.outstanding, s.outstanding - LAG(s.outstanding) OVER (PARTITION BY s.loan_id ORDER BY s.snapshot_month DESC) AS change_from_prior FROM loan_snapshots s) SELECT loan_id, snapshot_month, outstanding, change_from_prior FROM moves WHERE change_from_prior > 0 ORDER BY change_from_prior DESC;`,
          `WITH moves AS (SELECT s.loan_id, s.snapshot_month, s.outstanding, s.outstanding - LAG(s.outstanding) OVER (PARTITION BY s.loan_id ORDER BY s.snapshot_month) AS change_from_prior FROM loan_snapshots s) SELECT loan_id, snapshot_month, outstanding, change_from_prior FROM moves WHERE change_from_prior > 0 ORDER BY loan_id;`
        ],
        traps: [
          { re: /^(?![\s\S]*PARTITION\s+BY)[\s\S]*\bLAG\b/i, msg: '<code>LAG</code> is still crossing from one loan to the next. Add <code>PARTITION BY s.loan_id</code> inside <code>OVER</code>, and take <code>loan_id</code> out of its <code>ORDER BY</code>.' },
          { re: /PARTITION\s+BY\s+(\w+\.)?snapshot_month/i, msg: 'This compares different loans inside one month. Each loan compares with itself, so partition by <code>loan_id</code>.' },
          { re: /OVER\s*\([^)]*snapshot_month\s+DESC/i, msg: '<code>DESC</code> makes <code>LAG</code> read the later month, so every falling balance looks like a rise. Keep months in normal order.' }
        ],
        hints: [
          `Look at the first row for any loan. It should have no prior month, so what is it subtracting?`,
          `The fix is inside <code>OVER</code>. Each loan needs to start fresh.`,
          `Write <code>OVER (PARTITION BY s.loan_id ORDER BY s.snapshot_month)</code>.`
        ],
        win: `The 272 rows shrink to 4 real rises, all in October, and the other 268 were one loan compared with the next. When you review a LAG or ROW_NUMBER over many loans, look for PARTITION BY first.`,
        pattern: { sql: `LAG(col_a) OVER (PARTITION BY id_col ORDER BY date_col)`, note: 'Compare a row only with the row before it in its own group' }
      },
      {
        id: '6.13',
        type: 'quiz',
        title: 'Spot the bug: too much money',
        newIdea: 'When a total looks too big, walk through the JOINs and look for one that repeats rows.',
        teach: `<p>In the next three missions you read a query and choose the bug. You do not write anything.</p><p>Start with a [[control total]] you trust, covering the same loans as the query. If the result is bigger, go through each JOIN and say what one row means after it.</p>`,
        bridge: 'Like a sheet total bigger than the ledger it came from, where you look for duplicated lines first.',
        question: `Budi wants total outstanding per region. The regions below add up to about Rp 310 billion. All loans, written-off ones included, hold Rp 34.7 billion. The [[book]] is Rp 32.3 billion. What is the bug?`,
        code: `SELECT b.region, SUM(l.outstanding) AS total_outstanding
FROM loans l
JOIN branches b ON b.branch_id = l.branch_id
JOIN payments p ON p.loan_id = l.loan_id
GROUP BY b.region;`,
        showCodeResult: true,
        check: { sql: `SELECT (SELECT SUM(l.outstanding) FROM loans l JOIN branches b ON b.branch_id = l.branch_id JOIN payments p ON p.loan_id = l.loan_id) > (SELECT SUM(outstanding) FROM loans);`, equals: 1 },
        choices: [
          { t: 'The JOIN to payments repeats each loan once per payment.', correct: true, why: 'Yes, this is fan-out. Each balance is added once per payment. Nothing from payments is used either, so the fix is to delete that JOIN.' },
          { t: 'The JOIN to branches repeats each loan.', why: 'Each loan has exactly one branch, so this JOIN keeps one row per loan. Following the link from the many side to the one side is safe.' },
          { t: 'GROUP BY needs to include branch_id as well.', why: 'That would give one row per branch, and Budi wants regions. The total would still be too big, because each loan is still repeated.' },
          { t: 'SUM needs a decimal, like 100.0, to work correctly.', why: 'That fixes division of whole numbers. There is no division here, and SUM adds whole numbers correctly.' }
        ],
        win: `Say "one row now means one what?" after every JOIN. That single sentence finds most fan-out bugs before you even press Run.`
      },
      {
        id: '6.14',
        type: 'quiz',
        title: 'Spot the bug: missing branches',
        newIdea: 'When rows you expected are missing, check whether a WHERE is undoing a LEFT JOIN.',
        teach: `<p>Too few rows is a different clue from too much money. Count what you expected, and compare it with what came back.</p><p>If a LEFT JOIN is in the query, read the WHERE line and check which table each test belongs to.</p>`,
        bridge: 'Like a filter left switched on in a sheet, where rows quietly disappear from the view.',
        question: `Nia wants <b>every</b> branch with its number of Agency collectors, zero included. There are 12 branches and only 3 came back. What is the fix?`,
        code: `SELECT b.branch_name, COUNT(k.collector_id) AS agency_collectors
FROM branches b
LEFT JOIN collectors k ON k.branch_id = b.branch_id
WHERE k.team = 'Agency'
GROUP BY b.branch_name;`,
        showCodeResult: true,
        check: { sql: `SELECT COUNT(*) FROM (SELECT b.branch_name FROM branches b LEFT JOIN collectors k ON k.branch_id = b.branch_id WHERE k.team = 'Agency' GROUP BY b.branch_name);`, equals: 3 },
        choices: [
          { t: 'Move the team test from WHERE into the ON of the LEFT JOIN.', correct: true, why: 'Yes. In ON it decides which collectors match, and branches with no match stay in the result with a count of 0.' },
          { t: 'Change COUNT(k.collector_id) to COUNT(*).', why: 'The rows are already gone by the time COUNT runs. COUNT(*) would also turn a true zero into 1 after the fix, so the original COUNT is the right one.' },
          { t: 'Change LEFT JOIN to JOIN.', why: 'That removes unmatched branches on purpose, which is the same problem. The LEFT JOIN is what Nia needs, and the WHERE is undoing it.' },
          { t: 'Add k.team to GROUP BY.', why: 'The WHERE still removes the other nine branches first, so you still get 3 rows.' }
        ],
        win: `Know how many rows you expect before you run a query. Twelve branches and three rows is a gap, and that gap is your first clue.`
      },
      {
        id: '6.15',
        type: 'quiz',
        title: 'Spot the bug: the busiest collector',
        newIdea: 'A name beside a total may have nothing to do with that total.',
        teach: `<p>A [[bare column]] is dangerous because the result looks right. You see a name and a number side by side, and you read them as one fact.</p><p>To test it, count that one person. In the query in this mission, add <code>WHERE k.collector_name = 'Wahyu Sinaga'</code>. You get 101, and the Field row shows 906.</p>`,
        bridge: 'Like typing one person\'s name beside a team total, which is still the team\'s total.',
        question: `Putri reads this result as "the busiest collector in each team, with their activity count". Why is that reading wrong?`,
        code: `SELECT k.team, k.collector_name, COUNT(*) AS activities
FROM collection_activities a
JOIN collectors k ON k.collector_id = a.collector_id
GROUP BY k.team
ORDER BY activities DESC;`,
        showCodeResult: true,
        check: { sql: `SELECT COUNT(*) FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE k.team = 'Field';`, equals: 906 },
        choices: [
          { t: 'The count is the whole team total, and the name is one person SQLite picked with no reason.', correct: true, why: 'Yes. The grouping is by team only, so 906 belongs to the whole Field team. The busiest Field collector logged 174. The name can even be right by luck, as it may be for one team here, and the query still proves nothing. To really find the busiest person, group by collector and use a window function, as in Level 5.' },
          { t: 'ORDER BY should run before GROUP BY.', why: 'SQL always groups first and sorts after. The order here is fine, and the problem is what the grouping covers.' },
          { t: 'The JOIN to collectors repeats the activities.', why: 'Each activity has at most one collector, so the JOIN keeps one row per activity. The count of rows is correct for a team.' },
          { t: 'COUNT(*) should be COUNT(DISTINCT k.team).', why: 'That would give 1 for every team. Counting activities is fine, and the issue is the name shown beside the count.' }
        ],
        win: `You now read results with the right kind of doubt. A name beside a number proves nothing until you check that the grouping supports it.`
      },
      {
        id: '6.16',
        type: 'fix',
        checkpoint: true,
        title: 'Checkpoint: three bugs in one report',
        newIdea: 'Real reports hide several bugs at once, so review with a checklist.',
        from: 'Citra, Head of Collection',
        teach: `<p>Fixing one bug can make a report look right while others remain. Review with a checklist, and go through it every time:</p><ul><li>AND next to OR: are the brackets there?</li><li>After each JOIN, what does one row mean?</li><li>Counting rows, or different things?</li><li>LEFT JOIN: does WHERE test the joined table? Only IS NULL, looking for rows with no match, is safe there.</li><li>NOT IN: can the list hold a NULL?</li><li>Typed text: cleaned before grouping?</li><li>Dates: all ten characters?</li><li>Division: 100.0 first?</li><li>Overall ratio: total over total?</li><li>GROUP BY: every plain column in it?</li><li>LIMIT: ORDER BY above it?</li><li>Is the total below its [[control total]]?</li></ul>`,
        bridge: 'Same as reviewing a colleague\'s workbook, where you tick through formulas, ranges and totals in a fixed order.',
        task: `I need this report per branch. It covers overdue (<code>dpd &gt; 0</code>) KTA and Kartu Kredit loans, any status, with at least one activity on or after 1 October 2026. Show <code>branch_name</code>, <code>overdue_loans</code>, <code>overdue_balance</code> and <code>over_90_pct</code>, the percent of those loans over 90 DPD, to 1 decimal. Biggest balance first. Three bugs hide here.`,
        starter: `SELECT b.branch_name,
  COUNT(*) AS overdue_loans,
  SUM(l.outstanding) AS overdue_balance,
  ROUND(SUM(CASE WHEN l.dpd > 90 THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) AS over_90_pct
FROM loans l
JOIN branches b
  ON b.branch_id = l.branch_id
JOIN collection_activities a
  ON a.loan_id = l.loan_id
WHERE l.product = 'KTA' OR l.product = 'Kartu Kredit'
  AND l.dpd > 0
  AND a.activity_date >= '2026-10-01'
GROUP BY b.branch_name
ORDER BY overdue_balance DESC;`,
        solution: `SELECT b.branch_name,
  COUNT(*) AS overdue_loans,
  SUM(l.outstanding) AS overdue_balance,
  ROUND(100.0 * SUM(CASE WHEN l.dpd > 90 THEN 1 ELSE 0 END) / COUNT(*), 1) AS over_90_pct
FROM loans l
JOIN branches b
  ON b.branch_id = l.branch_id
WHERE (l.product = 'KTA' OR l.product = 'Kartu Kredit')
  AND l.dpd > 0
  AND l.loan_id IN (
    SELECT a.loan_id
    FROM collection_activities a
    WHERE a.activity_date >= '2026-10-01'
  )
GROUP BY b.branch_name
ORDER BY overdue_balance DESC;`,
        ordered: 'overdue_balance',
        altSolutions: [
          `SELECT b.branch_name, COUNT(*) AS overdue_loans, SUM(l.outstanding) AS overdue_balance, ROUND(100.0 * SUM(CASE WHEN l.dpd > 90 THEN 1 ELSE 0 END) / COUNT(*), 1) AS over_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.product IN ('KTA', 'Kartu Kredit') AND l.dpd > 0 AND EXISTS (SELECT 1 FROM collection_activities a WHERE a.loan_id = l.loan_id AND a.activity_date >= '2026-10-01') GROUP BY b.branch_name ORDER BY overdue_balance DESC;`,
          `WITH contacted AS (SELECT DISTINCT loan_id FROM collection_activities WHERE activity_date >= '2026-10-01') SELECT b.branch_name, COUNT(*) AS overdue_loans, SUM(l.outstanding) AS overdue_balance, ROUND(100.0 * SUM(CASE WHEN l.dpd > 90 THEN 1 ELSE 0 END) / COUNT(*), 1) AS over_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id JOIN contacted c ON c.loan_id = l.loan_id WHERE (l.product = 'KTA' OR l.product = 'Kartu Kredit') AND l.dpd > 0 GROUP BY b.branch_name ORDER BY overdue_balance DESC;`,
          `SELECT b.branch_name, COUNT(*) AS overdue_loans, SUM(l.outstanding) AS overdue_balance, ROUND(SUM(CASE WHEN l.dpd > 90 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS over_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id JOIN (SELECT loan_id FROM collection_activities WHERE activity_date >= '2026-10-01' GROUP BY loan_id) m ON m.loan_id = l.loan_id WHERE (l.product = 'KTA' OR l.product = 'Kartu Kredit') AND l.dpd > 0 GROUP BY b.branch_name ORDER BY 3 DESC;`
        ],
        wrong: [
          `SELECT b.branch_name, COUNT(*) AS overdue_loans, SUM(l.outstanding) AS overdue_balance, ROUND(100.0 * SUM(CASE WHEN l.dpd > 90 THEN 1 ELSE 0 END) / COUNT(*), 1) AS over_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id JOIN collection_activities a ON a.loan_id = l.loan_id WHERE (l.product = 'KTA' OR l.product = 'Kartu Kredit') AND l.dpd > 0 AND a.activity_date >= '2026-10-01' GROUP BY b.branch_name ORDER BY overdue_balance DESC;`,
          `SELECT b.branch_name, COUNT(*) AS overdue_loans, SUM(l.outstanding) AS overdue_balance, ROUND(SUM(CASE WHEN l.dpd > 90 THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) AS over_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE (l.product = 'KTA' OR l.product = 'Kartu Kredit') AND l.dpd > 0 AND l.loan_id IN (SELECT a.loan_id FROM collection_activities a WHERE a.activity_date >= '2026-10-01') GROUP BY b.branch_name ORDER BY overdue_balance DESC;`,
          `SELECT b.branch_name, COUNT(*) AS overdue_loans, SUM(l.outstanding) AS overdue_balance, ROUND(100.0 * SUM(CASE WHEN l.dpd > 90 THEN 1 ELSE 0 END) / COUNT(*), 1) AS over_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.product = 'KTA' OR l.product = 'Kartu Kredit' AND l.dpd > 0 AND l.loan_id IN (SELECT a.loan_id FROM collection_activities a WHERE a.activity_date >= '2026-10-01') GROUP BY b.branch_name ORDER BY overdue_balance DESC;`,
          `SELECT b.branch_name, COUNT(DISTINCT l.loan_id) AS overdue_loans, SUM(DISTINCT l.outstanding) AS overdue_balance, ROUND(100.0 * COUNT(DISTINCT CASE WHEN l.dpd > 90 THEN l.loan_id END) / COUNT(DISTINCT l.loan_id), 1) AS over_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id JOIN collection_activities a ON a.loan_id = l.loan_id WHERE (l.product = 'KTA' OR l.product = 'Kartu Kredit') AND l.dpd > 0 AND a.activity_date >= '2026-10-01' GROUP BY b.branch_name ORDER BY overdue_balance DESC;`,
          `SELECT b.branch_name, COUNT(*) AS overdue_loans, SUM(l.outstanding) AS overdue_balance, ROUND(100.0 * SUM(CASE WHEN l.dpd > 90 THEN 1 ELSE 0 END) / COUNT(*), 1) AS over_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE (l.product = 'KTA' OR l.product = 'Kartu Kredit') AND l.dpd > 0 AND l.loan_id IN (SELECT a.loan_id FROM collection_activities a WHERE a.activity_date >= '2026-10-01') GROUP BY b.branch_name ORDER BY overdue_balance;`
        ],
        requires: [
          { re: /^(?![\s\S]*\bSUM\s*\(\s*DISTINCT\b)/i, msg: 'The numbers match today, because no two overdue loans here share a balance. <code>SUM(DISTINCT ...)</code> would merge two loans with equal balances on another day. Filter with <code>IN</code> or <code>EXISTS</code> so each loan stays one row, and it stays right.' },
          { re: /^(?![\s\S]*\bdpd\s*>=\s*90\b)/i, msg: 'Right numbers today, because no loan sits at exactly 90 DPD. Over 90 means 91 and up, and a loan at exactly 90 is still Kol 2, so write <code>l.dpd &gt; 90</code>.' }
        ],
        traps: [
          { re: /'KTA'\s+OR\s+(l\.)?product\s*=\s*'Kartu Kredit'\s+AND/i, msg: 'Check the WHERE line. AND runs before OR, so the overdue and date tests apply to Kartu Kredit only.' },
          { re: /\bJOIN\s+collection_activities\b(?![\s\S]*\bDISTINCT\b)/i, msg: 'Each loan appears once per activity after this JOIN, so counts and balances are inflated. Use the activities only to filter.' },
          { re: /\/\s*COUNT\s*\([^)]*\)\s*\*\s*100/i, msg: 'The percentage divides two whole numbers before it multiplies. Start with <code>100.0 *</code>.' }
        ],
        hints: [
          `Run it first. Read the percent column, then look at the WHERE line, and then ask what one row means after the second JOIN. All KTA and Kartu Kredit loans together hold about Rp 4.4 billion, so add up your <code>overdue_balance</code> column and compare.`,
          `The three bugs are in the percent formula, in the mix of AND with OR, and in the JOIN to <code>collection_activities</code>.`,
          `Start the percent with <code>100.0 *</code>. Put brackets around the two product tests. Delete the <code>JOIN collection_activities</code> line and the <code>a.activity_date</code> line. Then add <code>AND l.loan_id IN (SELECT a.loan_id FROM collection_activities a WHERE a.activity_date &gt;= '2026-10-01')</code> at the end of WHERE.`
        ],
        win: `Level 6 done, and you can now read a query that runs without complaint and still prove it wrong, which is what senior analysts get paid for. Next you will turn this same doubt on whole collection systems.`,
        pattern: { sql: `-- Review checklist\n-- 1. Brackets where AND meets OR\n-- 2. After each JOIN, one row means what?\n-- 3. Counting rows, or different things?\n-- 4. A WHERE test on a LEFT JOIN's joined table is a bug,\n--    unless it is IS NULL looking for rows with no match\n-- 5. NOT IN: can the list hold a NULL?\n-- 6. Typed text cleaned before grouping\n-- 7. Dates typed YYYY-MM-DD\n-- 8. 100.0 at the front of a percentage\n-- 9. An overall ratio is total over total\n-- 10. Every plain SELECT column in GROUP BY\n-- 11. LIMIT has an ORDER BY above it\n-- 12. Total below its control total`, note: 'A checklist for reviewing any query' }
      }
    ]
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
