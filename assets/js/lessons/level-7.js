/* Level 7: use SQL to prove whether a collection system is right. */
(function (root) {
  (root.KENARI_LEVELS = root.KENARI_LEVELS || []).push({
    n: 7,
    title: 'System Checks',
    rank: 'System Checker',
    tagline: 'Zero rows means pass. Every row returned gets checked against the spec.',
    goal: 'Prove with SQL whether a collection system is right, and write up what you find so it gets fixed.',
    terms: {
      'defect': 'Something in a system that does not do what the spec says. Also called a bug.',
      'population': 'The full set of rows a check is meant to cover.',
      'reversal': 'An entry that cancels an earlier payment, often recorded as a negative amount.',
      'feed': 'A regular delivery of data from one system to another.',
      'allocation': 'The rules for which collector works which loan.',
      'test pack': 'A set of checks run together, giving one pass or fail line per check.',
      'spec': 'The written document that says what a system must do. Short for specification.',
      'child table': 'The table holding a pointer to another table, such as payments pointing to loans.',
      'parent table': 'The table being pointed to, such as loans for payments.',
      'release': 'A new version of a system going live.',
      'regression test': 'Rerunning old checks after a change, to catch things that used to work and now fail.'
    },
    lessons: [
      {
        id: '7.1',
        title: 'Test a business rule',
        newIdea: 'A system check is a query that returns only the rows breaking a rule.',
        from: 'Maya, UAT lead',
        teach: `<p>This level is the job you were hired for. In [[UAT]], you prove a system follows its rules. Write each rule as a query that returns only the rows breaking it.</p><p><b>Zero rows means pass. Each row returned needs checking against the [[spec]], and most will be [[defect]]s to report.</b></p><p>Below, our spec says a written-off loan stays at [[Kol]] 5.</p>`,
        ex: [
          ['SELECT loan_id, status, collectibility', "Show each loan's ID, status and stored grade"],
          ['FROM loans', 'from the loans table'],
          ["WHERE status = 'Written Off'", 'for written-off loans'],
          ['  AND collectibility <> 5;', 'whose grade is anything other than Kol 5.']
        ],
        exAllowEmpty: true,
        exNote: 'No rows came back, so this rule passes.',
        bridge: 'Like a filter on a sheet that shows only the rows failing a control test.',
        task: `Our spec says a loan more than 180 days late must be Kol 5. Test it on <code>loans</code>. Return <code>loan_id</code>, <code>dpd</code> and <code>collectibility</code>, only for loans breaking the rule.`,
        solution: `SELECT loan_id, dpd, collectibility
FROM loans
WHERE dpd > 180
  AND collectibility <> 5;`,
        altSolutions: [
          `SELECT loan_id, dpd, collectibility
FROM loans
WHERE dpd >= 181
  AND collectibility < 5;`
        ],
        requires: [{ re: /dpd\s*(>\s*180|>=\s*181)\b|BETWEEN\s+181\b/i, msg: 'The rows match, but check the limit. More than 180 days means 181 or above, so a loan at exactly 180 does not break this rule. No loan here sits on that line, so the result alone cannot show the mistake.' }],
        wrong: [
          `SELECT loan_id, dpd, collectibility FROM loans WHERE dpd > 180;`,
          `SELECT loan_id, dpd, collectibility FROM loans WHERE dpd > 180 AND collectibility = 5;`,
          `SELECT loan_id, dpd, collectibility FROM loans WHERE collectibility <> 5;`,
          `SELECT loan_id, dpd, collectibility FROM loans WHERE dpd >= 180 AND collectibility <> 5;`
        ],
        traps: [
          { re: /collectibility\s*=\s*5/i, msg: 'This keeps the loans that follow the rule. A check returns the ones that break it, so use <code>&lt;&gt;</code>.' },
          { re: /^(?![\s\S]*collectibility\s*(<>|!=|<))/i, msg: 'You have the loans the rule covers. A check returns only the ones breaking it, so also test the grade.' },
          { re: /^(?![\s\S]*\bdpd\s*>)/i, msg: 'The rule only covers loans more than 180 days late, so test <code>dpd</code> as well.' }
        ],
        hints: [
          'Two things must be true on a row that breaks the rule: it is that late, and its grade is wrong.',
          'Both tests go in <code>WHERE</code>, joined by <code>AND</code>.',
          '<code>WHERE dpd &gt; 180 AND collectibility &lt;&gt; 5</code>'
        ],
        pattern: { sql: `SELECT id, col_a, stored_value\nFROM table_name\nWHERE col_a > 100\n  AND stored_value <> 'expected';`, note: 'Test a rule: return only the rows that break it' },
        win: `Loans 386 and 445 are over 180 days late and stored at Kol 4. The other 37 loans above 180 days pass, and two loan IDs give IT something exact to look at.`
      },
      {
        id: '7.2',
        title: 'Work out the expected grade',
        newIdea: 'Use CASE to work out the value a row should have, then compare it with the stored value.',
        from: 'Maya, UAT lead',
        teach: `<p>A fixed value works when a rule has one answer. A grade depends on [[DPD]], so first work out the grade each loan should have, then compare it with the stored one.</p><p><code>CASE</code> gives the expected value, and it can return numbers as well as text. Put it in a CTE, so the next step can filter on its name.</p>`,
        ex: [
          ['WITH graded AS (', 'Make a first step called graded'],
          ['  SELECT loan_id, dpd, collectibility,', 'showing each loan, its DPD and stored grade,'],
          ['    CASE WHEN dpd <= 90 THEN 2 ELSE 3 END AS expected_kol', 'and the grade it should have, 2 up to 90 days and 3 after that,'],
          ['  FROM loans', 'from the loans table'],
          ['  WHERE dpd BETWEEN 1 AND 120', 'for loans 1 to 120 days late.'],
          [')', 'Then'],
          ['SELECT loan_id, dpd, collectibility, expected_kol', 'show those columns'],
          ['FROM graded', 'from that step,'],
          ['WHERE collectibility <> expected_kol;', 'keeping loans whose stored grade differs from the expected one.']
        ],
        exNote: 'The CASE returns a number here, so it can be compared with the stored grade. Your task covers all five grades.',
        bridge: 'Like a check column in Excel that flags any row where the stored value differs from your formula.',
        task: `Test this full rule on <code>loans</code>.<table class="plain"><tr><th>DPD</th><th>Kol</th></tr><tr><td>0</td><td>1</td></tr><tr><td>1 to 90</td><td>2</td></tr><tr><td>91 to 120</td><td>3</td></tr><tr><td>121 to 180</td><td>4</td></tr><tr><td>above 180</td><td>5</td></tr></table>Return <code>loan_id</code>, <code>dpd</code>, <code>collectibility</code> and <code>expected_kol</code>, only for loans breaking this rule.`,
        starter: `WITH graded AS (
  SELECT
    loan_id,
    dpd,
    collectibility,
    CASE
      WHEN dpd = 0 THEN ____
      WHEN dpd <= 90 THEN ____
      WHEN dpd <= ____ THEN 3
      WHEN dpd <= ____ THEN 4
      ELSE ____
    END AS expected_kol
  FROM loans
)
SELECT loan_id, dpd, collectibility, expected_kol
FROM graded
WHERE ____;`,
        fill: ['1', '2', '120', '180', '5', 'collectibility <> expected_kol'],
        solution: `WITH graded AS (
  SELECT
    loan_id,
    dpd,
    collectibility,
    CASE
      WHEN dpd = 0 THEN 1
      WHEN dpd <= 90 THEN 2
      WHEN dpd <= 120 THEN 3
      WHEN dpd <= 180 THEN 4
      ELSE 5
    END AS expected_kol
  FROM loans
)
SELECT loan_id, dpd, collectibility, expected_kol
FROM graded
WHERE collectibility <> expected_kol;`,
        altSolutions: [
          `SELECT loan_id, dpd, collectibility,
  CASE WHEN dpd = 0 THEN 1 WHEN dpd <= 90 THEN 2 WHEN dpd <= 120 THEN 3 WHEN dpd <= 180 THEN 4 ELSE 5 END AS expected_kol
FROM loans
WHERE collectibility <> CASE WHEN dpd = 0 THEN 1 WHEN dpd <= 90 THEN 2 WHEN dpd <= 120 THEN 3 WHEN dpd <= 180 THEN 4 ELSE 5 END;`,
          `SELECT loan_id, dpd, collectibility,
  CASE WHEN dpd > 180 THEN 5 WHEN dpd > 120 THEN 4 WHEN dpd > 90 THEN 3 WHEN dpd > 0 THEN 2 ELSE 1 END AS expected_kol
FROM loans
WHERE collectibility <> expected_kol;`,
          `WITH graded AS (
  SELECT loan_id, dpd, collectibility,
    CASE WHEN dpd = 0 THEN 1 WHEN dpd BETWEEN 1 AND 90 THEN 2 WHEN dpd BETWEEN 91 AND 120 THEN 3 WHEN dpd BETWEEN 121 AND 180 THEN 4 ELSE 5 END AS expected_kol
  FROM loans
)
SELECT loan_id, dpd, collectibility, expected_kol
FROM graded
WHERE collectibility <> expected_kol;`
        ],
        requires: [
          { re: /dpd\s*(<=\s*90|<\s*91|>\s*90|>=\s*91)\b|BETWEEN\s+\d+\s+AND\s+90\b|BETWEEN\s+91\b/i, msg: 'The rows match, but check this limit. DPD 90 is still Kol 2, and DPD 91 is Kol 3. No loan here sits on that line, so the result alone cannot show the mistake.' },
          { re: /dpd\s*(<=\s*120|<\s*121|>\s*120|>=\s*121)\b|BETWEEN\s+\d+\s+AND\s+120\b|BETWEEN\s+121\b/i, msg: 'The rows match, but check this limit. DPD 120 is still Kol 3, and DPD 121 is Kol 4. No loan here sits on that line, so the result alone cannot show the mistake.' },
          { re: /dpd\s*(<=\s*180|<\s*181|>\s*180|>=\s*181)\b|BETWEEN\s+\d+\s+AND\s+180\b|BETWEEN\s+181\b/i, msg: 'The rows match, but check this limit. DPD 180 is still Kol 4, and DPD 181 is Kol 5. No loan here sits on that line, so the result alone cannot show the mistake.' }
        ],
        wrong: [
          `SELECT loan_id, dpd, collectibility, CASE WHEN dpd = 0 THEN 1 WHEN dpd <= 90 THEN 2 WHEN dpd <= 120 THEN 3 WHEN dpd <= 180 THEN 4 ELSE 5 END AS expected_kol FROM loans;`,
          `SELECT loan_id, dpd, collectibility, CASE WHEN dpd = 0 THEN 1 WHEN dpd <= 90 THEN 2 WHEN dpd <= 120 THEN 3 WHEN dpd <= 180 THEN 4 ELSE 5 END AS expected_kol FROM loans WHERE collectibility = expected_kol;`,
          `SELECT loan_id, dpd, collectibility, CASE WHEN dpd = 0 THEN 1 WHEN dpd <= 100 THEN 2 WHEN dpd <= 120 THEN 3 WHEN dpd <= 180 THEN 4 ELSE 5 END AS expected_kol FROM loans WHERE collectibility <> expected_kol;`,
          `SELECT loan_id, dpd, collectibility, CASE WHEN dpd = 0 THEN 1 WHEN dpd < 90 THEN 2 WHEN dpd <= 120 THEN 3 WHEN dpd <= 180 THEN 4 ELSE 5 END AS expected_kol FROM loans WHERE collectibility <> expected_kol;`,
          `SELECT loan_id, dpd, collectibility, CASE WHEN dpd = 0 THEN 1 WHEN dpd <= 91 THEN 2 WHEN dpd <= 120 THEN 3 WHEN dpd <= 180 THEN 4 ELSE 5 END AS expected_kol FROM loans WHERE collectibility <> expected_kol;`
        ],
        traps: [
          { re: /^(?![\s\S]*\bWHERE\b)/i, msg: 'You have the expected grade. A check should return only the rows that break the rule, so add a filter comparing it with the stored grade.' },
          { re: /collectibility\s*=\s*expected_kol/i, msg: 'This keeps the loans that follow the rule. A check returns the ones that break it, so use <code>&lt;&gt;</code>.' },
          { re: /dpd\s*<=\s*(?!0\b|90\b|120\b|180\b)\d+/i, msg: 'Check your limits against the rule. With <code>&lt;=</code>, the upper limits are 90, 120 and 180.' }
        ],
        hints: [
          'The table gives you each grade. Fill them into the <code>CASE</code>, working from the lowest DPD up.',
          'The first <code>WHEN</code> that is true wins, so each branch only needs its upper limit. The last step keeps rows where the stored grade differs from <code>expected_kol</code>.',
          '<code>WITH graded AS (SELECT loan_id, dpd, collectibility, CASE WHEN dpd = 0 THEN 1 WHEN dpd &lt;= 90 THEN 2 WHEN dpd &lt;= 120 THEN 3 WHEN dpd &lt;= 180 THEN 4 ELSE 5 END AS expected_kol FROM loans)</code>, then select from <code>graded</code> with <code>WHERE collectibility &lt;&gt; expected_kol</code>.'
        ],
        pattern: { sql: `WITH checked AS (\n  SELECT id, stored_value,\n    CASE ... END AS expected_value\n  FROM table_name\n)\nSELECT *\nFROM checked\nWHERE stored_value <> expected_value;`, note: 'Test a rule against a value you calculate' },
        win: `Six loans break the rule. Four of them are really Kol 3, so their stored grade keeps them out of [[NPL]] figures, and that is why this check matters.`,
        atWork: `Real collectibility rules can look at more than days late, such as the borrower's ability to pay. This lab uses DPD only. Also, SQLite lets you use an AS name in WHERE, and most other databases refuse it, which is one more reason to use a CTE.`
      },
      {
        id: '7.3',
        type: 'quiz',
        title: 'Can you trust zero rows?',
        newIdea: 'Zero rows is a pass only if the check looked at the right rows.',
        teach: `<p>A typo in a filter also returns zero rows, and then the check tested nothing.</p><p>So before you write PASS, count the rows the check is meant to cover. That group is called the [[population]], the same word auditors use.</p>`,
        bridge: 'Like a SUMIF showing 0 because its criteria says Writen Off with one t, so nothing was added up.',
        question: `This check should prove every written-off loan sits at Kol 5. It returns no rows. What should you do before writing PASS?`,
        code: `SELECT loan_id, collectibility\nFROM loans\nWHERE status = 'WRITTEN OFF'\n  AND collectibility <> 5;`,
        showCodeResult: true,
        check: { sql: `SELECT COUNT(*) FROM loans WHERE status = 'WRITTEN OFF'`, equals: 0 },
        choices: [
          { t: 'Count the loans matching the status filter, and confirm the number is what you expect', correct: true, why: `Yes. That count is 0, because the data stores <code>Written Off</code>, so this check tested nothing. With the correct text it covers 23 loans and still returns no rows, and that is a real pass.` },
          { t: 'Write PASS, because zero rows means pass', why: 'That rule assumes the check looked at the right rows. Here the filter matches no loans at all, so nothing was tested.' },
          { t: 'Report a defect, because a check should always return something', why: 'Most good checks return nothing on a healthy system. The problem here is the filter text, and the system has not been shown to be wrong.' },
          { t: 'Add ORDER BY loan_id and run it again', why: 'Sorting changes the order of rows, and there are no rows to sort. The result would still be empty.' }
        ],
        win: `Reporting the population next to the result, such as "23 loans tested, 0 failed", makes a pass believable to anyone who reads it, including an auditor.`
      },
      {
        id: '7.4',
        title: 'Profile a table you have never seen',
        newIdea: 'One query can size up a new table: its rows, filled values, distinct values and range.',
        from: 'Maya, UAT lead',
        teach: `<p>Before you test a table you do not know, profile it. You learned each piece in Level 2, and here they work as one habit.</p><p><code>COUNT(*)</code> gives the rows. <code>COUNT(col)</code> skips NULLs, so the gap shows what is missing. <code>COUNT(DISTINCT col)</code> shows repeats. <code>MIN</code> and <code>MAX</code> show the range, and a date outside it is your first question.</p>`,
        ex: [
          [`SELECT COUNT(*) AS total_rows,`, `Show how many rows there are,`],
          [`  COUNT(ptp_date) AS ptp_dates,`, `how many have a promised date,`],
          [`  COUNT(DISTINCT result) AS distinct_results,`, `how many different results appear,`],
          [`  MIN(activity_date) AS first_activity,`, `the earliest activity`],
          [`  MAX(activity_date) AS last_activity`, `and the latest,`],
          [`FROM collection_activities;`, `from the activities table.`]
        ],
        bridge: 'Like the first look at a new Excel file: row count, blanks, unique values, lowest and highest.',
        task: `The next release changes the customer file, so I need to know what normal looks like. In one row from <code>customers</code>: <code>total_rows</code>, <code>phones</code> (filled), <code>distinct_phones</code>, <code>emails</code> (filled), <code>distinct_cities</code>, <code>first_joined</code> and <code>last_joined</code> (from <code>joined_date</code>).`,
        solution: `SELECT COUNT(*) AS total_rows,
  COUNT(phone) AS phones,
  COUNT(DISTINCT phone) AS distinct_phones,
  COUNT(email) AS emails,
  COUNT(DISTINCT city) AS distinct_cities,
  MIN(joined_date) AS first_joined,
  MAX(joined_date) AS last_joined
FROM customers;`,
        altSolutions: [
          `SELECT COUNT(customer_id) AS total_rows, SUM(CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END) AS phones, COUNT(DISTINCT phone) AS distinct_phones, SUM(CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) AS emails, COUNT(DISTINCT city) AS distinct_cities, MIN(joined_date) AS first_joined, MAX(joined_date) AS last_joined FROM customers;`
        ],
        wrong: [
          `SELECT COUNT(*) AS total_rows, COUNT(*) AS phones, COUNT(DISTINCT phone) AS distinct_phones, COUNT(email) AS emails, COUNT(DISTINCT city) AS distinct_cities, MIN(joined_date) AS first_joined, MAX(joined_date) AS last_joined FROM customers;`,
          `SELECT COUNT(*) AS total_rows, COUNT(phone) AS phones, COUNT(phone) AS distinct_phones, COUNT(email) AS emails, COUNT(DISTINCT city) AS distinct_cities, MIN(joined_date) AS first_joined, MAX(joined_date) AS last_joined FROM customers;`,
          `SELECT COUNT(*) AS total_rows, COUNT(phone) AS phones, COUNT(DISTINCT phone) AS distinct_phones, COUNT(email) AS emails, COUNT(city) AS distinct_cities, MIN(joined_date) AS first_joined, MAX(joined_date) AS last_joined FROM customers;`
        ],
        traps: [
          { re: /COUNT\s*\(\s*\*\s*\)\s*AS\s+(phones|emails)/i, msg: '<code>COUNT(*)</code> counts every row. To count filled values, name the column: <code>COUNT(phone)</code>.' },
          { re: /COUNT\s*\(\s*(phone|city)\s*\)\s*AS\s+distinct/i, msg: 'A distinct count needs the word inside the brackets: <code>COUNT(DISTINCT phone)</code>.' }
        ],
        hints: [
          `This is one row, so there is no <code>GROUP BY</code>. Every column is an [[aggregate]].`,
          `Filled values use <code>COUNT(column)</code>, and repeats show up with <code>COUNT(DISTINCT column)</code>.`,
          `The dates are <code>MIN(joined_date)</code> and <code>MAX(joined_date)</code>.`
        ],
        win: `Those 423 rows are your population, and the numbers are your first questions: 42 customers have no phone, 10 phones repeat, and customers spell 11 cities in 35 ways. Run this before any test on a new table, so you can tell a real change from what was always there.`,
        pattern: { sql: `SELECT COUNT(*) AS total_rows,\n  COUNT(col_a) AS col_a_filled,\n  COUNT(DISTINCT col_a) AS col_a_distinct,\n  MIN(col_b) AS lowest,\n  MAX(col_b) AS highest\nFROM table_name;`, note: 'Profile a table you have never seen' }
      },
      {
        id: '7.5',
        title: 'Find duplicates',
        newIdea: 'Group by the columns that define "the same event", then keep groups with more than one row.',
        from: 'Pak Surya, collection system owner',
        teach: `<p>When a system logs one event twice, counts inflate and a collector's numbers look better than they are. Each copy gets its own <code>activity_id</code>, so ignore that column and look at the columns describing the event.</p><p>Group by those columns, then keep groups with <code>HAVING COUNT(*) &gt; 1</code>. The columns you choose define what "duplicate" means.</p>`,
        ex: [
          ['SELECT loan_id, collector_id, COUNT(*) AS times_assigned', 'Show each loan and collector with a count of their assignments'],
          ['FROM loan_assignments', 'from the assignments table,'],
          ['GROUP BY loan_id, collector_id', 'one row per loan and collector pair,'],
          ['HAVING COUNT(*) > 1;', 'keeping only pairs that appear more than once.']
        ],
        exNote: 'These three may be fine, because a collector can take a loan back later. The query finds the rows, and you still judge them against the spec.',
        bridge: 'Like COUNTIFS across several columns, then filtering to results above 1.',
        task: `We suspect double logging. Find activities logged more than once with the same <code>loan_id</code>, <code>collector_id</code>, <code>activity_date</code>, <code>activity_type</code> and <code>result</code>. Return those five columns plus <code>times_logged</code>.`,
        solution: `SELECT loan_id, collector_id, activity_date, activity_type, result, COUNT(*) AS times_logged
FROM collection_activities
GROUP BY loan_id, collector_id, activity_date, activity_type, result
HAVING COUNT(*) > 1;`,
        altSolutions: [
          `SELECT loan_id, collector_id, activity_date, activity_type, result, COUNT(*) AS times_logged
FROM collection_activities
GROUP BY 1, 2, 3, 4, 5
HAVING times_logged >= 2;`
        ],
        wrong: [
          `SELECT loan_id, collector_id, activity_date, activity_type, result, COUNT(*) AS times_logged FROM collection_activities GROUP BY loan_id, activity_date HAVING COUNT(*) > 1;`,
          `SELECT loan_id, collector_id, activity_date, activity_type, result, COUNT(*) AS times_logged FROM collection_activities GROUP BY loan_id, collector_id, activity_date, activity_type, result;`,
          `SELECT loan_id, collector_id, activity_date, activity_type, result, COUNT(*) AS times_logged FROM collection_activities GROUP BY activity_id, loan_id, collector_id, activity_date, activity_type, result HAVING COUNT(*) > 1;`
        ],
        traps: [
          { re: /GROUP\s+BY[^;]*\bactivity_id\b/i, msg: '<code>activity_id</code> is different on every row, so grouping by it can never find a copy. Leave it out.' },
          { re: /\bDISTINCT\b/i, msg: '<code>DISTINCT</code> hides duplicates. This check needs to find them, so use <code>GROUP BY</code> and <code>HAVING</code>.' }
        ],
        hints: [
          'Treat the five named columns as one event, and count how many rows each event has.',
          'All five columns go in <code>GROUP BY</code>. The filter on the count goes in <code>HAVING</code>.',
          'End with <code>HAVING COUNT(*) &gt; 1</code>.'
        ],
        pattern: { sql: `SELECT col_a, col_b, COUNT(*) AS copies\nFROM table_name\nGROUP BY col_a, col_b\nHAVING COUNT(*) > 1;`, note: 'Find duplicates by the columns that define one event' },
        win: `Eleven groups share all five columns, and two are [[PTP]]s whose promised dates differ, so open those rows before you call them copies. The columns you choose define what duplicate means, and a scorecard is only as good as this check.`
      },
      {
        id: '7.6',
        title: 'Orphan records',
        newIdea: 'Start from the child table and LEFT JOIN the parent, and a NULL parent marks an orphan.',
        from: 'Pak Surya, collection system owner',
        teach: `<p>An [[orphan]] is a row pointing to something that does not exist, such as an activity logged on a loan the bank does not have. A database can block these with a [[foreign key]] rule, but not every system has one switched on.</p><p>You know this shape already. The table holding the pointer is called the [[child|child table]]. Here that is <code>payments</code>, because each payment points to a loan. The table it points to is the [[parent|parent table]], here <code>loans</code>. Start <code>FROM</code> the child, <code>LEFT JOIN</code> the parent, and keep rows where the parent came back NULL.</p>`,
        ex: [
          ['SELECT p.payment_id, p.loan_id', 'Show each payment and the loan it points to'],
          ['FROM payments p', 'from the payments table,'],
          ['LEFT JOIN loans l', 'looking up the loans table'],
          ['  ON l.loan_id = p.loan_id', 'by loan ID,'],
          ['WHERE l.loan_id IS NULL;', 'keeping only payments where no loan was found.']
        ],
        exAllowEmpty: true,
        exNote: 'No rows, so every payment points to a real loan. This check passes.',
        bridge: 'Like an XLOOKUP from a detail sheet to the master list, then filtering to #N/A.',
        task: `Now check the activity log. Find activities whose <code>loan_id</code> does not exist in <code>loans</code>. Return <code>activity_id</code>, <code>loan_id</code>, <code>collector_id</code> and <code>activity_date</code>.`,
        solution: `SELECT a.activity_id, a.loan_id, a.collector_id, a.activity_date
FROM collection_activities a
LEFT JOIN loans l
  ON l.loan_id = a.loan_id
WHERE l.loan_id IS NULL;`,
        altSolutions: [
          `SELECT a.activity_id, a.loan_id, a.collector_id, a.activity_date
FROM collection_activities a
WHERE NOT EXISTS (
  SELECT 1
  FROM loans l
  WHERE l.loan_id = a.loan_id
);`,
          `SELECT activity_id, loan_id, collector_id, activity_date
FROM collection_activities
WHERE loan_id NOT IN (SELECT loan_id FROM loans);`
        ],
        wrong: [
          `SELECT a.activity_id, a.loan_id, a.collector_id, a.activity_date FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id WHERE l.loan_id IS NULL;`,
          `SELECT a.activity_id, a.loan_id, a.collector_id, a.activity_date FROM loans l LEFT JOIN collection_activities a ON a.loan_id = l.loan_id WHERE a.loan_id IS NULL;`,
          `SELECT a.activity_id, a.loan_id, a.collector_id, a.activity_date FROM collection_activities a LEFT JOIN loans l ON l.loan_id = a.loan_id;`
        ],
        traps: [
          { re: /FROM\s+loans\b[\s\S]*LEFT\s+JOIN\s+collection_activities/i, msg: 'This starts from loans, so it finds loans with no activity. An orphan check starts from the child, which is <code>collection_activities</code> here.' },
          { re: /(?<!LEFT\s)(?<!OUTER\s)\bJOIN\s+loans\b/i, msg: 'A plain <code>JOIN</code> drops any activity with no matching loan, and those are the rows you want. Use <code>LEFT JOIN</code>.' }
        ],
        hints: [
          'The child here is <code>collection_activities</code>, and the parent is <code>loans</code>.',
          'Start <code>FROM collection_activities</code>, then <code>LEFT JOIN loans</code> on the loan ID.',
          'Keep the rows where the loans side found nothing: <code>WHERE l.loan_id IS NULL</code>.'
        ],
        pattern: { sql: `SELECT c.col_a, c.col_b\nFROM child_table c\nLEFT JOIN parent_table p\n  ON p.id = c.parent_id\nWHERE p.id IS NULL;`, note: 'Find orphans: child rows with no parent' },
        win: `Three calls are logged against loans that do not exist, with loan IDs from 90001 to 90003, far outside the real range. That points to a data delivery that went wrong or to a test entry, and a clue like that belongs in your [[defect]] report.`
      },
      {
        id: '7.7',
        title: 'Required fields',
        newIdea: 'A field can be required only when another column has a certain value.',
        from: 'Fitri, Desk Call lead',
        teach: `<p>Some fields depend on context. A [[PTP]] needs a promised date and amount, or nobody can follow it up. A No Answer row should have neither, so a plain NULL test would flag more than a thousand healthy rows.</p><p>So the test has two parts, the kind of row and the missing fields. Brackets keep the <code>OR</code> together, as the example shows.</p>`,
        ex: [
          ['SELECT customer_id, full_name, phone, email', 'Show each customer with their phone and email'],
          ['FROM customers', 'from the customers table'],
          ["WHERE employment = 'Payroll'", 'for payroll customers only'],
          ['  AND (phone IS NULL OR email IS NULL)', 'whose phone or email is missing,'],
          ['LIMIT 10;', 'showing the first ten.']
        ],
        exNote: 'Imagine a spec saying payroll customers must have both on file. The brackets keep the two NULL tests together.',
        bridge: 'Like a helper column with =AND(C2="PTP", OR(D2="", E2="")), then filtering to TRUE. Two filter dropdowns would only find rows where both are blank.',
        task: `Every PTP row needs both a date and an amount. Find rows with <code>result</code> = PTP where <code>ptp_date</code> or <code>ptp_amount</code> is missing. Return <code>activity_id</code>, <code>loan_id</code>, <code>activity_date</code>, <code>ptp_date</code> and <code>ptp_amount</code>.`,
        solution: `SELECT activity_id, loan_id, activity_date, ptp_date, ptp_amount
FROM collection_activities
WHERE result = 'PTP'
  AND (ptp_date IS NULL OR ptp_amount IS NULL);`,
        altSolutions: [
          `SELECT activity_id, loan_id, activity_date, ptp_date, ptp_amount
FROM collection_activities
WHERE (result = 'PTP' AND ptp_date IS NULL)
  OR (result = 'PTP' AND ptp_amount IS NULL);`
        ],
        wrong: [
          `SELECT activity_id, loan_id, activity_date, ptp_date, ptp_amount FROM collection_activities WHERE result = 'PTP' AND ptp_date IS NULL OR ptp_amount IS NULL;`,
          `SELECT activity_id, loan_id, activity_date, ptp_date, ptp_amount FROM collection_activities WHERE ptp_date IS NULL OR ptp_amount IS NULL;`,
          `SELECT activity_id, loan_id, activity_date, ptp_date, ptp_amount FROM collection_activities WHERE result = 'PTP' AND ptp_date IS NULL AND ptp_amount IS NULL;`,
          `SELECT activity_id, loan_id, activity_date, ptp_date, ptp_amount FROM collection_activities WHERE result = 'PTP' AND ptp_date IS NULL;`
        ],
        traps: [
          { re: /'PTP'\s+AND\s+\w*\.?ptp_\w+\s+IS\s+NULL\s+OR\b/i, msg: '<code>AND</code> binds tighter than <code>OR</code>, so every row with a NULL amount comes back, PTP or not. Put brackets around the OR.' },
          { re: /^(?![\s\S]*'PTP')/i, msg: 'Rows with other results are meant to have these fields empty. Limit the check to <code>result = \'PTP\'</code>.' },
          { re: /ptp_date\s+IS\s+NULL\s+AND\s+\w*\.?ptp_amount\s+IS\s+NULL/i, msg: 'This finds rows missing both fields. The rule fails if either one is missing, so use <code>OR</code> between them.' }
        ],
        hints: [
          'Two things must be true: the row is a PTP, and at least one field is empty.',
          'Use <code>OR</code> between the two NULL tests, inside brackets.',
          `<code>WHERE result = 'PTP' AND (ptp_date IS NULL OR ptp_amount IS NULL)</code>`
        ],
        pattern: { sql: `SELECT id, field_a, field_b\nFROM table_name\nWHERE kind = 'X'\n  AND (field_a IS NULL OR field_b IS NULL);`, note: 'Required fields that depend on another column' },
        win: `A promise with no date cannot be chased, and one with no amount cannot be checked as kept. All five bad rows sit on loan 2, and a cluster like that is worth stating in your report.`,
        atWork: `On real systems, a text field can hold empty text instead of NULL. Test <code>field IS NULL OR TRIM(field) = ''</code>. On Oracle, empty text is stored as NULL, so <code>IS NULL</code> alone covers it. This applies to text columns, and date and number columns only need <code>IS NULL</code>.`
      },
      {
        id: '7.8',
        title: 'Impossible dates',
        newIdea: 'Compare two columns in the same row to catch values that cannot both be true.',
        from: 'Fitri, Desk Call lead',
        teach: `<p>Some values look fine alone and are impossible together. A borrower cannot promise today to pay on a date that has already passed.</p><p>Put both columns in <code>WHERE</code>. Dates written like 2026-10-31 compare correctly as text, as you saw in Level 6.</p><p>If a date is NULL, the comparison is never true, so that row does not appear. Your required fields check from the last mission catches those rows.</p>`,
        ex: [
          ['SELECT assignment_id, assigned_date, unassigned_date', 'Show each assignment with its start and end dates'],
          ['FROM loan_assignments', 'from the assignments table'],
          ['WHERE unassigned_date < assigned_date;', 'where it ended before it began.']
        ],
        exAllowEmpty: true,
        exNote: 'No rows, so no assignment ends before it starts. This check passes.',
        bridge: 'Like an audit test flagging any invoice with a payment date earlier than its issue date.',
        task: `Find activities where the promised date is before the activity itself, meaning <code>ptp_date</code> is earlier than <code>activity_date</code>. Return <code>activity_id</code>, <code>loan_id</code>, <code>activity_date</code>, <code>ptp_date</code> and <code>days_early</code> (days from the promised date to the activity date).`,
        solution: `SELECT activity_id, loan_id, activity_date, ptp_date,
  julianday(activity_date) - julianday(ptp_date) AS days_early
FROM collection_activities
WHERE ptp_date < activity_date;`,
        altSolutions: [
          `SELECT activity_id, loan_id, activity_date, ptp_date, julianday(activity_date) - julianday(ptp_date) AS days_early
FROM collection_activities
WHERE activity_date > ptp_date;`,
          `SELECT activity_id, loan_id, activity_date, ptp_date, julianday(activity_date) - julianday(ptp_date) AS days_early
FROM collection_activities
WHERE julianday(ptp_date) < julianday(activity_date);`
        ],
        requires: [{ re: /^(?![\s\S]*(ptp_date\s*\)?\s*<=|activity_date\s*\)?\s*>=))/i, msg: 'The rows match, but <code>&lt;=</code> also flags a promise to pay today, and that is valid. No row here has the two dates the same, so the result alone cannot show the mistake. Use <code>&lt;</code>.' }],
        wrong: [
          `SELECT activity_id, loan_id, activity_date, ptp_date, julianday(activity_date) - julianday(ptp_date) AS days_early FROM collection_activities WHERE ptp_date > activity_date;`,
          `SELECT activity_id, loan_id, activity_date, ptp_date, julianday(activity_date) - julianday(ptp_date) AS days_early FROM collection_activities WHERE ptp_date < '2026-10-31';`,
          `SELECT activity_id, loan_id, activity_date, ptp_date, julianday(activity_date) - julianday(ptp_date) AS days_early FROM collection_activities WHERE ptp_date <= activity_date;`,
          `SELECT activity_id, loan_id, activity_date, ptp_date, julianday(ptp_date) - julianday(activity_date) AS days_early FROM collection_activities WHERE ptp_date < activity_date;`,
          `SELECT activity_id, loan_id, activity_date, ptp_date, activity_date - ptp_date AS days_early FROM collection_activities WHERE ptp_date < activity_date;`
        ],
        traps: [
          { re: /ptp_date\s*>\s*\w*\.?activity_date|activity_date\s*<\s*\w*\.?ptp_date/i, msg: 'This keeps promises dated after the activity, and those are the healthy ones. Flip the comparison.' },
          { re: /ptp_date\s*<\s*'/i, msg: 'Comparing with a fixed date finds every old promise. The rule compares two columns on the same row.' }
        ],
        hints: [
          `Both dates are on the same row, so no JOIN is needed.`,
          `One column goes on each side of the <code>&lt;</code> in <code>WHERE</code>. The gap uses <code>julianday</code> on both dates, with the later date first.`,
          `<code>julianday(activity_date) - julianday(ptp_date) AS days_early</code>, with <code>WHERE ptp_date &lt; activity_date</code>`
        ],
        pattern: { sql: `SELECT id, start_date, end_date,\n  julianday(start_date) - julianday(end_date) AS days_wrong\nFROM table_name\nWHERE end_date < start_date;`, note: 'Two columns on one row that cannot both be true, with the size of the gap' },
        win: `A promise dated in the past looks broken from day one, so it makes a collector look worse for no fair reason. Report the entry screen too, because it should have refused that date.`
      },
      {
        id: '7.9',
        title: 'Impossible amounts',
        newIdea: 'Check a number column against the range of values it can sensibly hold.',
        from: 'Dian, Finance',
        teach: `<p>A payment is money received, so an amount of zero records nothing. A negative amount needs a reason. It may be a [[reversal]] of an earlier payment, and the spec should say how those are recorded.</p><p>A fast first look at any number column is its lowest and highest value. Then write the exact filter, and join the loan so the reader can see what it is.</p>`,
        ex: [
          ['SELECT MIN(ptp_amount) AS lowest,', 'Show the lowest'],
          ['  MAX(ptp_amount) AS highest', 'and highest promised amounts'],
          ['FROM collection_activities;', 'across all activities.']
        ],
        exNote: 'Both look sensible, so promised amounts pass this first look.',
        bridge: 'Like sorting a ledger column to see what sits at the very top and bottom.',
        task: `My cash totals look odd. Find every payment with an <code>amount</code> at or below zero, with its loan's details. Return <code>payment_id</code>, <code>loan_id</code>, <code>product</code>, <code>status</code>, <code>payment_date</code>, <code>amount</code> and <code>channel</code>.`,
        solution: `SELECT p.payment_id, p.loan_id, l.product, l.status, p.payment_date, p.amount, p.channel
FROM payments p
JOIN loans l
  ON l.loan_id = p.loan_id
WHERE p.amount <= 0;`,
        altSolutions: [
          `SELECT p.payment_id, p.loan_id, l.product, l.status, p.payment_date, p.amount, p.channel
FROM payments p
LEFT JOIN loans l
  ON l.loan_id = p.loan_id
WHERE NOT p.amount > 0;`
        ],
        wrong: [
          `SELECT p.payment_id, p.loan_id, l.product, l.status, p.payment_date, p.amount, p.channel FROM payments p JOIN loans l ON l.loan_id = p.loan_id WHERE p.amount < 0;`,
          `SELECT p.payment_id, p.loan_id, l.product, l.status, p.payment_date, p.amount, p.channel FROM payments p JOIN loans l ON l.loan_id = p.loan_id WHERE p.amount = 0;`,
          `SELECT p.payment_id, p.loan_id, l.product, l.status, p.payment_date, p.amount, p.channel FROM payments p JOIN loans l WHERE p.amount <= 0;`
        ],
        traps: [
          { re: /amount\s*<\s*0\b/i, msg: '"At or below zero" includes zero itself. Use <code>&lt;=</code>.' },
          { re: /amount\s*=\s*0\b/i, msg: 'This finds zeros only. The request also includes negative amounts.' }
        ],
        hints: [
          `The filter is one comparison on <code>amount</code>. <code>product</code> and <code>status</code> live in <code>loans</code>, so join it on <code>loan_id</code>.`,
          `Use the symbol that means "at or below".`,
          `<code>WHERE p.amount &lt;= 0</code>`
        ],
        pattern: { sql: `SELECT t.id, t.amount, p.col_a\nFROM table_name t\nJOIN parent_table p\n  ON p.id = t.parent_id\nWHERE t.amount <= 0;`, note: 'Range check on a number column, with details from the parent row' },
        win: `Two zero rows and one of minus Rp 250,000, all on Active loans. A SUM adds them without complaint, so only a check like this finds them.`,
      },
      {
        id: '7.10',
        title: 'Suspicious, or wrong?',
        newIdea: 'A value that looks wrong is reported as a question until the business confirms the rule.',
        from: 'Dian, Finance',
        teach: `<p>Some values look wrong without being impossible. A balance above the original [[principal]] is one. Under some terms, unpaid interest or fees can be added to a balance, especially after [[restructuring]].</p><p>So find the rows, show the size of the gap, and ask the product owner, the person who decides the business rules for that loan type, before you call it a [[defect]].</p>`,
        ex: [
          ['SELECT s9.loan_id, s9.outstanding AS sep_balance, s10.outstanding AS oct_balance', 'Show each loan with its September and October balance'],
          ['FROM loan_snapshots s9', 'from the snapshots,'],
          ['JOIN loan_snapshots s10', 'paired with the snapshots again'],
          ["  ON s10.loan_id = s9.loan_id AND s10.snapshot_month = '2026-10'", "to find the same loan's October row,"],
          ["WHERE s9.snapshot_month = '2026-09'", 'starting from September,'],
          ['  AND s10.outstanding > s9.outstanding;', 'keeping loans whose balance went up.']
        ],
        exNote: '[[Installment|installment]] balances normally fall month by month, so these four deserve a question. Your task brings in the September balance the same way. Loan 13 went up but is still below its principal, so it will not appear in your result.',
        bridge: 'Like an audit query on a ledger balance that looks too high, where you gather evidence before calling it an error.',
        task: `Find loans whose <code>outstanding</code> is above their <code>principal</code>. Return <code>loan_id</code>, <code>product</code>, <code>status</code>, <code>principal</code>, <code>outstanding</code>, <code>excess</code> (outstanding minus principal) and <code>sep_outstanding</code> (the loan's balance in the 2026-09 snapshot).`,
        solution: `SELECT l.loan_id, l.product, l.status, l.principal, l.outstanding,
  l.outstanding - l.principal AS excess,
  s.outstanding AS sep_outstanding
FROM loans l
JOIN loan_snapshots s
  ON s.loan_id = l.loan_id
  AND s.snapshot_month = '2026-09'
WHERE l.outstanding > l.principal;`,
        altSolutions: [
          `SELECT l.loan_id, l.product, l.status, l.principal, l.outstanding, l.outstanding - l.principal AS excess, s.outstanding AS sep_outstanding
FROM loans l
JOIN loan_snapshots s
  ON s.loan_id = l.loan_id
WHERE s.snapshot_month = '2026-09'
  AND l.outstanding - l.principal > 0;`
        ],
        wrong: [
          `SELECT l.loan_id, l.product, l.status, l.principal, l.outstanding, l.principal - l.outstanding AS excess, s.outstanding AS sep_outstanding FROM loans l JOIN loan_snapshots s ON s.loan_id = l.loan_id AND s.snapshot_month = '2026-09' WHERE l.outstanding > l.principal;`,
          `SELECT l.loan_id, l.product, l.status, l.principal, l.outstanding, l.outstanding - l.principal AS excess, s.outstanding AS sep_outstanding FROM loans l JOIN loan_snapshots s ON s.loan_id = l.loan_id AND s.snapshot_month = '2026-09' WHERE l.outstanding < l.principal;`,
          `SELECT l.loan_id, l.product, l.status, l.principal, l.outstanding, l.outstanding - l.principal AS excess, s.outstanding AS sep_outstanding FROM loans l JOIN loan_snapshots s ON s.loan_id = l.loan_id WHERE l.outstanding > l.principal;`,
          `SELECT l.loan_id, l.product, l.status, l.principal, l.outstanding, l.outstanding - l.principal AS excess, s.outstanding AS sep_outstanding FROM loans l JOIN loan_snapshots s ON s.loan_id = l.loan_id AND s.snapshot_month = '2026-10' WHERE l.outstanding > l.principal;`
        ],
        traps: [
          { re: /principal\s*-\s*outstanding/i, msg: 'The excess is outstanding minus principal, so it comes out positive on these rows.' },
          { re: /outstanding\s*<\s*principal/i, msg: 'A balance below principal is normal after repayments. You want the rows above it.' }
        ],
        hints: [
          `The test is one <code>WHERE</code> comparison on <code>loans</code>. Add a math column for the gap, and name it with <code>AS excess</code>.`,
          `For the September balance, join <code>loan_snapshots</code> with two conditions in <code>ON</code>, as the example does.`,
          `<code>l.outstanding - l.principal AS excess</code>, with <code>s.outstanding AS sep_outstanding</code> and <code>WHERE l.outstanding &gt; l.principal</code>.`
        ],
        pattern: { sql: `SELECT id, limit_value, actual_value, actual_value - limit_value AS excess\nFROM table_name\nWHERE actual_value > limit_value;`, note: 'Show suspicious rows with the size of the gap' },
        win: `All three are Active with none Restructured, and each balance jumped in October from the September figure beside it. So added interest after restructuring does not explain them well, and a question backed by evidence gets a fast answer.`,
      },
      {
        id: '7.11',
        title: 'Reconcile two totals',
        newIdea: 'Calculate the same total from two sources side by side and show the difference.',
        from: 'Dian, Finance',
        teach: `<p>A [[reconciliation]] compares two sources that should agree. <code>loans</code> shows balances at 31 October, and the <code>2026-10</code> row in <code>loan_snapshots</code> holds the same month end, so they should match.</p><p>Build one CTE per source, join them on the grouping column, and subtract. A difference tells you the sources disagree, and it does not say which one is right.</p>`,
        ex: [
          ['WITH loan_side AS (', 'Make a first step called loan_side'],
          ['  SELECT collectibility, COUNT(*) AS loans_count', 'that counts loans per grade'],
          ['  FROM loans', 'in the loans table,'],
          ['  GROUP BY collectibility', 'one row per grade,'],
          ['),', 'then'],
          ['snapshot_side AS (', 'a second step called snapshot_side'],
          ['  SELECT collectibility, COUNT(*) AS snapshot_count', 'with the same count'],
          ['  FROM loan_snapshots', 'from the snapshots'],
          ["  WHERE snapshot_month = '2026-10'", 'for October only,'],
          ['  GROUP BY collectibility', 'also one row per grade.'],
          [')', 'Then'],
          ['SELECT loan_side.collectibility, loans_count, snapshot_count,', 'show each grade, both counts'],
          ['  loans_count - snapshot_count AS difference', 'and the gap between them,'],
          ['FROM loan_side', 'starting from loan_side'],
          ['JOIN snapshot_side', 'and joining snapshot_side'],
          ['  ON snapshot_side.collectibility = loan_side.collectibility;', 'on the grade.']
        ],
        exNote: 'Kol 2 to 5 disagree. The six loans from your Kol grade check are the reason.',
        bridge: 'Like a bank reconciliation, with the book balance, the statement balance and a difference still to be explained.',
        task: `Reconcile balances by product. Return <code>product</code>, <code>loans_total</code> (sum of outstanding in <code>loans</code>), <code>snapshot_total</code> (sum of outstanding in the 2026-10 snapshot) and <code>difference</code> (loans_total minus snapshot_total), with one row for each of the four products. <code>loan_snapshots</code> has no product column, so that side needs a JOIN to <code>loans</code>.`,
        solution: `WITH loan_side AS (
  SELECT product, SUM(outstanding) AS loans_total
  FROM loans
  GROUP BY product
),
snapshot_side AS (
  SELECT l.product, SUM(s.outstanding) AS snapshot_total
  FROM loan_snapshots s
  JOIN loans l
    ON l.loan_id = s.loan_id
  WHERE s.snapshot_month = '2026-10'
  GROUP BY l.product
)
SELECT loan_side.product, loans_total, snapshot_total,
  loans_total - snapshot_total AS difference
FROM loan_side
JOIN snapshot_side
  ON snapshot_side.product = loan_side.product;`,
        altSolutions: [
          `SELECT l.product, SUM(l.outstanding) AS loans_total, SUM(s.outstanding) AS snapshot_total,
  SUM(l.outstanding) - SUM(s.outstanding) AS difference
FROM loans l
JOIN loan_snapshots s
  ON s.loan_id = l.loan_id
  AND s.snapshot_month = '2026-10'
GROUP BY l.product;`
        ],
        wrong: [
          `WITH a1 AS (SELECT product, SUM(outstanding) AS loans_total FROM loans GROUP BY product), b1 AS (SELECT l.product, SUM(s.outstanding) AS snapshot_total FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id GROUP BY l.product) SELECT a1.product, loans_total, snapshot_total, loans_total - snapshot_total AS difference FROM a1 JOIN b1 ON b1.product = a1.product;`,
          `SELECT l.product, SUM(l.outstanding) AS loans_total, SUM(s.outstanding) AS snapshot_total, SUM(s.outstanding) - SUM(l.outstanding) AS difference FROM loans l JOIN loan_snapshots s ON s.loan_id = l.loan_id AND s.snapshot_month = '2026-10' GROUP BY l.product;`,
          `SELECT l.product, SUM(l.outstanding) AS loans_total, SUM(s.outstanding) AS snapshot_total, SUM(l.outstanding) - SUM(s.outstanding) AS difference FROM loans l JOIN loan_snapshots s ON s.loan_id = l.loan_id AND s.snapshot_month = '2026-10' GROUP BY l.product HAVING SUM(l.outstanding) <> SUM(s.outstanding);`
        ],
        traps: [
          { re: /^(?![\s\S]*2026-10)/i, msg: 'The snapshots table holds ten months per loan. Without <code>2026-10</code>, you are adding ten month ends together.' },
          { re: /SUM\(\s*s\.outstanding\s*\)\s*-\s*SUM\(\s*l\.outstanding\s*\)|snapshot_total\s*-\s*loans_total/i, msg: 'The request asks for loans minus snapshot. Swapping them flips every sign.' },
          { re: /\bHAVING\b/i, msg: 'The request wants all four products, including the ones that agree. A reconciliation shows its matches too.' }
        ],
        hints: [
          'In <code>snapshot_side</code>, write <code>FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id</code>, and group by <code>l.product</code>.',
          'Write one CTE per source, each grouped by product, with a filter for <code>2026-10</code> on the snapshot side.',
          'Join the two CTEs on product, and select <code>loans_total - snapshot_total AS difference</code>.'
        ],
        pattern: { sql: `WITH side_a AS (\n  SELECT key_col, SUM(x) AS a_total FROM table_a GROUP BY key_col\n),\nside_b AS (\n  SELECT key_col, SUM(x) AS b_total FROM table_b GROUP BY key_col\n)\nSELECT side_a.key_col, a_total, b_total, a_total - b_total AS difference\nFROM side_a\nJOIN side_b ON side_b.key_col = side_a.key_col;`, note: 'Reconcile totals from two sources. A plain JOIN drops a key found on one side only, so compare row counts too.' },
        win: `KKB is out by minus Rp 1,250,000 and KTA by plus Rp 500,000, yet the grand total differs by only minus Rp 750,000. Differences can offset each other, so reconcile below the grand total.`,
        atWork: `October is complete here, so this query loses nothing. On real data, a plain <code>JOIN</code> drops rows found on one side only, and those are often the biggest breaks. Use <code>FULL JOIN</code>, or <code>LEFT JOIN</code> with <code>COALESCE</code>, and compare row counts on each side.`
      },
      {
        id: '7.12',
        title: 'Drill down to the loans',
        newIdea: 'Move from a total that disagrees to the exact rows causing it.',
        from: 'Dian, Finance',
        teach: `<p>A total tells you something differs, and a colleague can only fix rows. So take the same two sources, match them row by row on the [[key]], and keep the rows where the values differ.</p><p>Then check your own work. The differences you find should add up to the totals you reported.</p>`,
        ex: [
          ['SELECT l.loan_id, l.collectibility AS loans_kol, s.collectibility AS snapshot_kol', 'Show each loan with its grade in both places'],
          ['FROM loans l', 'from the loans table,'],
          ['JOIN loan_snapshots s', 'matched to its snapshot'],
          ["  ON s.loan_id = l.loan_id AND s.snapshot_month = '2026-10'", 'for October,'],
          ['WHERE l.collectibility <> s.collectibility;', 'keeping loans where the two grades differ.']
        ],
        exNote: 'These are the six loans behind the Kol differences in the last example.',
        bridge: 'Like moving from a variance on the summary sheet to the journal lines behind it.',
        task: `Show me the loans behind the differences. Compare each loan's <code>outstanding</code> with its 2026-10 snapshot. Return <code>loan_id</code>, <code>product</code>, <code>loans_outstanding</code>, <code>snapshot_outstanding</code> and <code>difference</code> (loans minus snapshot), only where they differ.`,
        solution: `SELECT l.loan_id, l.product,
  l.outstanding AS loans_outstanding,
  s.outstanding AS snapshot_outstanding,
  l.outstanding - s.outstanding AS difference
FROM loans l
JOIN loan_snapshots s
  ON s.loan_id = l.loan_id
  AND s.snapshot_month = '2026-10'
WHERE l.outstanding <> s.outstanding;`,
        wrong: [
          `SELECT l.loan_id, l.product, l.outstanding AS loans_outstanding, s.outstanding AS snapshot_outstanding, l.outstanding - s.outstanding AS difference FROM loans l JOIN loan_snapshots s ON s.loan_id = l.loan_id WHERE l.outstanding <> s.outstanding;`,
          `SELECT l.loan_id, l.product, l.outstanding AS loans_outstanding, s.outstanding AS snapshot_outstanding, s.outstanding - l.outstanding AS difference FROM loans l JOIN loan_snapshots s ON s.loan_id = l.loan_id AND s.snapshot_month = '2026-10' WHERE l.outstanding <> s.outstanding;`,
          `SELECT l.loan_id, l.product, l.outstanding AS loans_outstanding, s.outstanding AS snapshot_outstanding, l.outstanding - s.outstanding AS difference FROM loans l JOIN loan_snapshots s ON s.loan_id = l.loan_id AND s.snapshot_month = '2026-10';`
        ],
        traps: [
          { re: /^(?![\s\S]*2026-10)/i, msg: 'Without <code>2026-10</code>, each loan matches ten snapshots, and old balances will always differ from today\'s. Add the month to the <code>ON</code>.' },
          { re: /s\.outstanding\s*-\s*l\.outstanding/i, msg: 'The request asks for loans minus snapshot, so the first number is <code>l.outstanding</code>.' }
        ],
        hints: [
          'Each loan should match exactly one snapshot row, so the join needs both the loan and the month.',
          'Put the loan ID and <code>snapshot_month</code> in <code>ON</code>, then filter in <code>WHERE</code>.',
          '<code>WHERE l.outstanding &lt;&gt; s.outstanding</code>'
        ],
        pattern: { sql: `SELECT a.id, a.x AS a_value, b.x AS b_value, a.x - b.x AS difference\nFROM table_a a\nJOIN table_b b\n  ON b.id = a.id\nWHERE a.x <> b.x;`, note: 'Drill from a total difference to the rows behind it. A plain JOIN lists only keys found on both sides.' },
        win: `Loan 13 is minus Rp 1,250,000 and loan 14 is plus Rp 500,000, which matches the KKB and KTA gaps exactly. The differences now tie out to two loans, and the reconciliation stays open until IT explains them.`,
        atWork: `This <code>JOIN</code> can only list loans found on both sides. A loan missing from the snapshot would never appear here, so run a completeness check as well, which comes later in this level.`
      },
      {
        id: '7.13',
        title: 'EXCEPT, the shorter way',
        newIdea: 'EXCEPT returns rows from the first query that the second query does not have.',
        from: 'Dian, Finance',
        teach: `<p><code>EXCEPT</code> sits between two queries with matching columns. It keeps each row from the first query that is missing from the second, comparing the whole row.</p><p>It works in one direction only, so a full comparison runs it both ways. Use it to find which rows differ. A JOIN is still better when you want both values side by side.</p>`,
        ex: [
          ['SELECT loan_id, collectibility', 'Take each loan and its grade'],
          ['FROM loans', 'from the loans table'],
          ['EXCEPT', 'and remove every identical pair'],
          ['SELECT loan_id, collectibility', 'of loan and grade'],
          ['FROM loan_snapshots', 'found in the snapshots'],
          ["WHERE snapshot_month = '2026-10';", 'for October.']
        ],
        exNote: 'The same six loans, with less typing.',
        bridge: 'Like a helper column joining the compared columns on both sheets, then a MATCH from the first to the second, keeping the #N/A rows.',
        task: `Same comparison, shorter. Use <code>EXCEPT</code> to list <code>loan_id</code> and <code>outstanding</code> from <code>loans</code> where that exact pair is not in the 2026-10 snapshot.`,
        solution: `SELECT loan_id, outstanding
FROM loans
EXCEPT
SELECT loan_id, outstanding
FROM loan_snapshots
WHERE snapshot_month = '2026-10';`,
        requires: [{ re: /\bEXCEPT\b/i, msg: 'That is the right answer. This mission is about <code>EXCEPT</code>, so try it with that.' }],
        wrong: [
          `SELECT loan_id, outstanding FROM loan_snapshots WHERE snapshot_month = '2026-10' EXCEPT SELECT loan_id, outstanding FROM loans;`,
          `SELECT loan_id, outstanding FROM loans EXCEPT SELECT loan_id, outstanding FROM loan_snapshots;`,
          `SELECT loan_id FROM loans EXCEPT SELECT loan_id FROM loan_snapshots WHERE snapshot_month = '2026-10';`
        ],
        traps: [
          { re: /FROM\s+loan_snapshots[\s\S]*EXCEPT[\s\S]*FROM\s+loans\b/i, msg: 'This runs from the snapshot side, so it shows snapshot balances. The request starts from <code>loans</code>.' },
          { re: /^(?![\s\S]*2026-10)/i, msg: 'Without <code>2026-10</code>, a balance matching any earlier month would be removed too. Filter the second query to that month.' }
        ],
        hints: [
          'Write two queries with the same two columns, one from each table.',
          'The <code>loans</code> query goes first, because you want its rows left over.',
          'Put <code>EXCEPT</code> between them, and filter the second query to <code>2026-10</code>.'
        ],
        pattern: { sql: `SELECT id, value FROM table_a\nEXCEPT\nSELECT id, value FROM table_b;`, note: 'Rows in A that are not in B. Run both ways for a full check.' },
        win: `When a bank moves data from an old system to a new one, teams compare the tables this way, old minus new and then new minus old, and both should return nothing. <code>EXCEPT</code> also removes repeated rows, so two tables can pass both ways with different row counts, and you compare <code>COUNT(*)</code> on each side as well.`,
        atWork: `Oracle has traditionally used <code>MINUS</code> for this. BigQuery writes <code>EXCEPT DISTINCT</code>. SQL Server and PostgreSQL write <code>EXCEPT</code>.`
      },
      {
        id: '7.14',
        title: 'The two-way break report',
        newIdea: 'Wrap each EXCEPT in brackets, so you can label its side and stack both directions.',
        from: 'Dian, Finance',
        teach: `<p>A full comparison runs both ways, and the reader needs to know which side each row came from. A label cannot go inside the <code>EXCEPT</code>, because it would be compared with the rest of the row and nothing would ever match.</p><p>So put each <code>EXCEPT</code> in brackets as a [[subquery]] in <code>FROM</code>, add the label outside it, and stack the two with <code>UNION ALL</code>.</p>`,
        ex: [
          [`SELECT 'loans_only' AS side, loan_id, collectibility`, `Label each row with its side, and show the loan and grade,`],
          [`FROM (`, `reading from a list in brackets:`],
          [`  SELECT loan_id, collectibility FROM loans`, `each loan and grade in the loans table,`],
          [`  EXCEPT`, `minus`],
          [`  SELECT loan_id, collectibility FROM loan_snapshots WHERE snapshot_month = '2026-10'`, `the same pairs in the October snapshot,`],
          [`) only_in_loans;`, `and name that list.`]
        ],
        exNote: `This is one direction. Your task stacks the other direction under it.`,
        bridge: 'Like a bank reconciliation with two lists, items in the ledger only and items on the statement only.',
        task: `Month end needs every balance break on one list. Compare <code>loan_id</code> and <code>outstanding</code> between <code>loans</code> and the 2026-10 snapshot, both ways. Columns: <code>side</code> (<code>loans_only</code> or <code>snapshot_only</code>), <code>loan_id</code>, <code>outstanding</code>.`,
        solution: `SELECT 'loans_only' AS side, loan_id, outstanding
FROM (
  SELECT loan_id, outstanding
  FROM loans
  EXCEPT
  SELECT loan_id, outstanding
  FROM loan_snapshots
  WHERE snapshot_month = '2026-10'
) only_in_loans
UNION ALL
SELECT 'snapshot_only', loan_id, outstanding
FROM (
  SELECT loan_id, outstanding
  FROM loan_snapshots
  WHERE snapshot_month = '2026-10'
  EXCEPT
  SELECT loan_id, outstanding
  FROM loans
) only_in_snapshot;`,
        altSolutions: [
          `WITH only_in_loans AS (SELECT loan_id, outstanding FROM loans EXCEPT SELECT loan_id, outstanding FROM loan_snapshots WHERE snapshot_month = '2026-10'), only_in_snapshot AS (SELECT loan_id, outstanding FROM loan_snapshots WHERE snapshot_month = '2026-10' EXCEPT SELECT loan_id, outstanding FROM loans) SELECT 'loans_only' AS side, loan_id, outstanding FROM only_in_loans UNION ALL SELECT 'snapshot_only', loan_id, outstanding FROM only_in_snapshot;`
        ],
        requires: [{ re: /\bEXCEPT\b/i, msg: 'That is the right list. This mission is about running <code>EXCEPT</code> both ways, so try it with that.' }],
        wrong: [
          `SELECT 'loans_only' AS side, loan_id, outstanding FROM (SELECT loan_id, outstanding FROM loans EXCEPT SELECT loan_id, outstanding FROM loan_snapshots WHERE snapshot_month = '2026-10') only_in_loans;`,
          `SELECT 'snapshot_only' AS side, loan_id, outstanding FROM (SELECT loan_id, outstanding FROM loans EXCEPT SELECT loan_id, outstanding FROM loan_snapshots WHERE snapshot_month = '2026-10') only_in_loans UNION ALL SELECT 'loans_only', loan_id, outstanding FROM (SELECT loan_id, outstanding FROM loan_snapshots WHERE snapshot_month = '2026-10' EXCEPT SELECT loan_id, outstanding FROM loans) only_in_snapshot;`,
          `SELECT 'loans_only' AS side, loan_id, outstanding FROM (SELECT loan_id, outstanding FROM loans EXCEPT SELECT loan_id, outstanding FROM loan_snapshots) only_in_loans UNION ALL SELECT 'snapshot_only', loan_id, outstanding FROM (SELECT loan_id, outstanding FROM loan_snapshots EXCEPT SELECT loan_id, outstanding FROM loans) only_in_snapshot;`
        ],
        traps: [
          { re: /^(?![\s\S]*UNION)/i, msg: 'That is one direction. Stack the other direction under it with <code>UNION ALL</code>.' },
          { re: /^(?![\s\S]*2026-10)/i, msg: 'Without <code>2026-10</code>, every earlier month comes along. Filter the snapshot to that month in both directions.' },
          { re: /'(loans_only|snapshot_only)'[^()]*EXCEPT/i, msg: 'A label inside the <code>EXCEPT</code> gets compared too, so nothing ever matches. Put it outside the brackets.' }
        ],
        hints: [
          `You wrote the first direction in the last mission. Put it inside <code>FROM ( ... )</code>, with a name after the closing bracket.`,
          `The outer <code>SELECT</code> adds the label: <code>SELECT 'loans_only' AS side, loan_id, outstanding</code>.`,
          `Write the same thing with the two queries swapped and the label <code>'snapshot_only'</code>, and put <code>UNION ALL</code> between them.`
        ],
        win: `Loans 13 and 14 appear on both sides, one row with each balance, so two breaks make four rows. This is the report a data migration signs off on, because it shows the owner of each system exactly which value to look for.`,
        pattern: { sql: `SELECT 'a_only' AS side, id, col_a\nFROM (\n  SELECT id, col_a FROM table_a\n  EXCEPT\n  SELECT id, col_a FROM table_b\n) only_in_a\nUNION ALL\nSELECT 'b_only', id, col_a\nFROM (\n  SELECT id, col_a FROM table_b\n  EXCEPT\n  SELECT id, col_a FROM table_a\n) only_in_b;`, note: 'A two-way break report, labeled by side' }
      },
      {
        id: '7.15',
        title: 'Completeness: count what arrived',
        newIdea: 'Compare how many rows exist with how many should exist.',
        from: 'Bu Ratih, Head of Collection Operations',
        teach: `<p>A row that never arrived raises no error, and only a completeness check catches it. Work out how many rows you expect, then count what is there.</p><p>Every loan here started before 2026, meaning the money went out by December 2025. So each should have 10 snapshots, January to October. Start <code>FROM loans</code> and <code>LEFT JOIN</code> the snapshots, so a loan with none still appears with a count of 0.</p>`,
        ex: [
          ['SELECT snapshot_month, COUNT(*) AS loans_in_month', 'Show each month with its number of loans'],
          ['FROM loan_snapshots', 'from the snapshots,'],
          ['GROUP BY snapshot_month', 'one row per month,'],
          ['HAVING COUNT(*) < 502;', 'keeping months with fewer than our 502 loans.']
        ],
        exNote: '<code>SELECT COUNT(*) FROM loans</code> gives 502, so a full month has 502 rows. Two months came up short, so now find which loans are affected.',
        bridge: 'Like counting the lines on a sheet and comparing that with the control total on the cover page.',
        task: `My month-on-month report looks odd. Each loan should have 10 snapshots, January to October 2026. Find loans with fewer. Return <code>loan_id</code> and <code>snapshots_held</code> (how many it has).`,
        solution: `SELECT l.loan_id, COUNT(s.loan_id) AS snapshots_held
FROM loans l
LEFT JOIN loan_snapshots s
  ON s.loan_id = l.loan_id
GROUP BY l.loan_id
HAVING COUNT(s.loan_id) < 10;`,
        altSolutions: [
          `SELECT l.loan_id,
  (SELECT COUNT(*) FROM loan_snapshots s WHERE s.loan_id = l.loan_id) AS snapshots_held
FROM loans l
WHERE (SELECT COUNT(*) FROM loan_snapshots s WHERE s.loan_id = l.loan_id) < 10;`
        ],
        requires: [
          { re: /\bLEFT\s+JOIN\b|\(\s*SELECT\s+COUNT/i, msg: 'The right loans for today. A loan with no snapshots at all would not show up here, so start from <code>loans</code> with <code>LEFT JOIN</code>.' },
          { re: /^(?![\s\S]*\bLEFT\s+JOIN\b)|^(?![\s\S]*COUNT\s*\(\s*\*\s*\))/i, msg: 'The right loans for today. After a <code>LEFT JOIN</code>, <code>COUNT(*)</code> gives a loan with no snapshots a count of 1, and that hides it. Count a column from the snapshot side.' }
        ],
        wrong: [
          `SELECT l.loan_id, COUNT(s.loan_id) AS snapshots_held FROM loans l LEFT JOIN loan_snapshots s ON s.loan_id = l.loan_id GROUP BY l.loan_id;`,
          `SELECT l.loan_id, COUNT(s.loan_id) AS snapshots_held FROM loans l LEFT JOIN loan_snapshots s ON s.loan_id = l.loan_id GROUP BY l.loan_id HAVING COUNT(s.loan_id) <= 10;`,
          `SELECT loan_id, COUNT(*) AS snapshots_held FROM loan_snapshots WHERE snapshot_month = '2026-10' GROUP BY loan_id HAVING COUNT(*) < 10;`,
          `SELECT loan_id, COUNT(*) AS snapshots_held FROM loan_snapshots GROUP BY loan_id HAVING COUNT(*) < 10;`,
          `SELECT l.loan_id, COUNT(s.loan_id) AS snapshots_held FROM loans l JOIN loan_snapshots s ON s.loan_id = l.loan_id GROUP BY l.loan_id HAVING COUNT(s.loan_id) < 10;`,
          `SELECT l.loan_id, COUNT(*) AS snapshots_held FROM loans l LEFT JOIN loan_snapshots s ON s.loan_id = l.loan_id GROUP BY l.loan_id HAVING COUNT(*) < 10;`
        ],
        traps: [
          { re: /<=\s*10\b/i, msg: 'Ten is the expected number, so a loan with 10 is healthy. Use <code>&lt; 10</code>.' },
          { re: /^(?![\s\S]*\bHAVING\b)/i, msg: 'You have the count for every loan. Now keep only the loans that fall short, with <code>HAVING</code>.' }
        ],
        hints: [
          'You want one row per loan, with a count of its snapshot rows.',
          'Group by the loan ID, and count a column from the snapshot side.',
          'Finish with <code>HAVING COUNT(s.loan_id) &lt; 10</code>.'
        ],
        pattern: { sql: `SELECT p.id, COUNT(c.id) AS rows_held\nFROM parent p\nLEFT JOIN child c ON c.parent_id = p.id\nGROUP BY p.id\nHAVING COUNT(c.id) < 10;`, note: 'Completeness: fewer rows than expected' },
        win: `Five loans have a gap. A month-on-month report drops them without warning in the missing month, so NPL trends can shift for no real reason.`
      },
      {
        id: '7.16',
        title: 'Completeness: name the gap',
        newIdea: 'CROSS JOIN builds every combination that should exist, ready to compare with what does.',
        from: 'Bu Ratih, Head of Collection Operations',
        teach: `<p>Counting shows a gap exists. To name it, first build what should exist. <code>CROSS JOIN</code> pairs every row on one side with every row on the other. In Level 3, a JOIN with no <code>ON</code> was a bug. <code>CROSS JOIN</code> does the same pairing on purpose.</p><p>Here, 502 loans times 10 months gives 5,020 expected rows. <code>LEFT JOIN</code> the real data onto that grid, and each NULL marks a hole.</p>`,
        ex: [
          ['WITH products AS (SELECT DISTINCT product FROM loans),', 'Make a list of the products'],
          ['grades AS (SELECT DISTINCT collectibility FROM loans)', 'and a list of the grades,'],
          ['SELECT products.product, grades.collectibility', 'then show each product and grade'],
          ['FROM products', 'starting from products,'],
          ['CROSS JOIN grades', 'paired with every grade,'],
          ['LEFT JOIN loans l', 'looking up real loans'],
          ['  ON l.product = products.product AND l.collectibility = grades.collectibility', 'with that product and grade,'],
          ['WHERE l.loan_id IS NULL;', 'keeping pairs where no loan was found.']
        ],
        exNote: 'Nothing is wrong here, because a product can have no loans at a grade. It shows how the grid works.',
        bridge: 'Like a sheet with loans down the side and months across the top, where each empty cell is a missing snapshot.',
        task: `Which months are missing? Return <code>loan_id</code> and <code>missing_month</code> for each loan and month with no row in <code>loan_snapshots</code>. Use the distinct <code>snapshot_month</code> values already in that table as your list of months.`,
        solution: `WITH months AS (
  SELECT DISTINCT snapshot_month
  FROM loan_snapshots
)
SELECT l.loan_id, m.snapshot_month AS missing_month
FROM loans l
CROSS JOIN months m
LEFT JOIN loan_snapshots s
  ON s.loan_id = l.loan_id
  AND s.snapshot_month = m.snapshot_month
WHERE s.loan_id IS NULL;`,
        altSolutions: [
          `WITH months AS (
  SELECT DISTINCT snapshot_month
  FROM loan_snapshots
)
SELECT l.loan_id, m.snapshot_month AS missing_month
FROM loans l
CROSS JOIN months m
EXCEPT
SELECT loan_id, snapshot_month
FROM loan_snapshots;`,
          `WITH months AS (
  SELECT DISTINCT snapshot_month
  FROM loan_snapshots
)
SELECT l.loan_id, m.snapshot_month AS missing_month
FROM loans l
CROSS JOIN months m
WHERE NOT EXISTS (
  SELECT 1
  FROM loan_snapshots s
  WHERE s.loan_id = l.loan_id
    AND s.snapshot_month = m.snapshot_month
);`
        ],
        wrong: [
          `WITH months AS (SELECT DISTINCT snapshot_month FROM loan_snapshots) SELECT l.loan_id, m.snapshot_month AS missing_month FROM loans l CROSS JOIN months m LEFT JOIN loan_snapshots s ON s.loan_id = l.loan_id WHERE s.loan_id IS NULL;`,
          `WITH months AS (SELECT DISTINCT snapshot_month FROM loan_snapshots) SELECT l.loan_id, m.snapshot_month AS missing_month FROM loans l CROSS JOIN months m;`
        ],
        traps: [
          { re: /^(?![\s\S]*CROSS\s+JOIN)/i, msg: 'Start by building the full grid with <code>FROM loans l CROSS JOIN months m</code>.' },
          { re: /\bCROSS\s+JOIN\b(?![\s\S]*\b(LEFT\s+JOIN|EXCEPT|NOT\s+EXISTS|NOT\s+IN)\b)/i, msg: 'The grid is built. Now compare it with the real rows, using <code>LEFT JOIN loan_snapshots</code> and <code>IS NULL</code>.' },
          { re: /LEFT\s+JOIN\s+loan_snapshots\s+\w+\s+ON\s+\w+\.loan_id\s*=\s*\w+\.loan_id\s+WHERE/i, msg: 'The join needs to match the month as well as the loan. Otherwise every loan finds a snapshot from some other month.' },
          { re: /\bCROSS\s+JOIN\b(?![\s\S]*\b(ON|USING)\b)/i, msg: '<code>CROSS JOIN</code> rightly has no <code>ON</code>, so leave that part as it is.' },
          { re: /\bCROSS\s+JOIN\b(?![\s\S]*\b(ON|USING)\b)[\s\S]*\b(EXCEPT|NOT\s+EXISTS|NOT\s+IN)\b/i, msg: 'The second query has to match both the loan and the month. With <code>EXCEPT</code>, it returns <code>loan_id</code> and <code>snapshot_month</code>, in the same order as the first query.' }
        ],
        hints: [
          'Make a CTE of the distinct months. That list and <code>loans</code> form the grid.',
          'Write <code>FROM loans l CROSS JOIN months m</code>, then <code>LEFT JOIN loan_snapshots s</code>.',
          'The <code>ON</code> matches both the loan ID and the month. Finish with <code>WHERE s.loan_id IS NULL</code>.'
        ],
        pattern: { sql: `WITH periods AS (\n  SELECT DISTINCT period FROM facts\n)\nSELECT t.id, p.period AS missing_period\nFROM things t\nCROSS JOIN periods p\nLEFT JOIN facts f\n  ON f.id = t.id AND f.period = p.period\nWHERE f.id IS NULL;`, note: 'Build the full grid, then find the holes' },
        win: `Two gaps fall in April and three in July, so IT can start from those two month-end jobs. A precise gap narrows the search far more than "some data is missing".`,
        atWork: `Older queries may write the same thing as <code>FROM a, b</code>. Spelling out <code>CROSS JOIN</code> tells the next reader you meant it, and that it is not a forgotten <code>ON</code>. Also, taking months from the same table misses a month that is missing for everyone. At work, build the list from a calendar, which comes later in this level.`
      },
      {
        id: '7.17',
        title: 'A status can lie',
        newIdea: 'Compare what was sent with what was loaded, whatever the status says.',
        from: 'Arif, batch support in IT',
        teach: `<p>Each night, [[batch]] jobs bring data in through [[feed]]s from other systems, and <code>batch_runs</code> logs each one. A job can finish, mark itself SUCCESS and still have dropped rows, for example by skipping bad records.</p><p>So test the counts directly. A status only reports what the job believes happened.</p>`,
        ex: [
          ['SELECT run_id, run_date, feed_name, rows_sent, rows_loaded', 'Show each run with its date, feed and row counts'],
          ['FROM batch_runs', 'from the batch log'],
          ["WHERE status = 'FAILED';", 'for runs that report a failure.']
        ],
        exNote: 'These two say they failed, so someone can react. Your task hunts for the runs that say nothing.',
        bridge: 'Like checking a file transfer by comparing its record count and control total, whatever the upload screen said.',
        task: `The monitoring screen shows every run as fine, apart from two failures. Find runs with <code>status</code> SUCCESS where <code>rows_loaded</code> is below <code>rows_sent</code>. Return <code>run_id</code>, <code>run_date</code>, <code>feed_name</code>, <code>rows_sent</code>, <code>rows_loaded</code> and <code>rows_missing</code> (sent minus loaded).`,
        solution: `SELECT run_id, run_date, feed_name, rows_sent, rows_loaded,
  rows_sent - rows_loaded AS rows_missing
FROM batch_runs
WHERE status = 'SUCCESS'
  AND rows_loaded < rows_sent;`,
        altSolutions: [
          `SELECT run_id, run_date, feed_name, rows_sent, rows_loaded,
  rows_sent - rows_loaded AS rows_missing
FROM batch_runs
WHERE status = 'SUCCESS'
  AND rows_loaded <> rows_sent;`
        ],
        wrong: [
          `SELECT run_id, run_date, feed_name, rows_sent, rows_loaded, rows_sent - rows_loaded AS rows_missing FROM batch_runs WHERE rows_loaded < rows_sent;`,
          `SELECT run_id, run_date, feed_name, rows_sent, rows_loaded, rows_sent - rows_loaded AS rows_missing FROM batch_runs WHERE status = 'FAILED';`,
          `SELECT run_id, run_date, feed_name, rows_sent, rows_loaded, rows_loaded - rows_sent AS rows_missing FROM batch_runs WHERE status = 'SUCCESS' AND rows_loaded < rows_sent;`
        ],
        traps: [
          { re: /^(?![\s\S]*'SUCCESS')/i, msg: 'The two failed runs already announced themselves. The request is about runs that claim SUCCESS.' },
          { re: /rows_loaded\s*-\s*rows_sent/i, msg: '<code>rows_missing</code> is sent minus loaded, so it comes out positive.' }
        ],
        hints: [
          'Two tests: what the status says, and how the two counts compare.',
          'Both columns are on the same row, so compare them in <code>WHERE</code>.',
          `<code>WHERE status = 'SUCCESS' AND rows_loaded &lt; rows_sent</code>`
        ],
        pattern: { sql: `SELECT run_id, rows_sent, rows_loaded,\n  rows_sent - rows_loaded AS rows_missing\nFROM batch_runs\nWHERE status = 'SUCCESS'\n  AND rows_loaded < rows_sent;`, note: 'Test the counts, whatever the status says' },
        win: `Five runs said SUCCESS and lost 15 rows between them. One missing payment row can leave a customer who paid looking overdue, and then a collector calls them.`
      },
      {
        id: '7.18',
        title: 'On time, not only complete',
        newIdea: 'A feed can load every row and still arrive too late to be useful.',
        from: 'Arif, batch support in IT',
        teach: `<p>Desk staff start their calls from the overnight data. A run that finishes after they start means they work from yesterday's [[DPD]], even when it says SUCCESS and loaded every row. So a [[feed]] needs a timing test as well as a count test.</p><p><code>finished_time</code> is text such as 07:25, always five characters, so it compares correctly, the same way as the dates in Level 6.</p>`,
        ex: [
          [`SELECT run_date, feed_name, finished_time`, `Show each run's date, feed and finish time`],
          [`FROM batch_runs`, `from the batch log,`],
          [`WHERE feed_name = 'PAYMENTS'`, `for the PAYMENTS feed,`],
          [`ORDER BY finished_time DESC`, `latest finish first,`],
          [`LIMIT 3;`, `and stop after 3 rows.`]
        ],
        exNote: `PAYMENTS is always done well before the desk opens. Your task covers both feeds.`,
        bridge: 'Like a month-end close, where correct numbers that arrive after the deadline still miss the close.',
        task: `The [[spec]] says every feed finishes before 07:00, when desk staff start. Find the runs that miss it. Return <code>run_date</code>, <code>feed_name</code>, <code>status</code> and <code>finished_time</code>, latest finish first.`,
        solution: `SELECT run_date, feed_name, status, finished_time
FROM batch_runs
WHERE finished_time >= '07:00'
ORDER BY finished_time DESC;`,
        ordered: 'finished_time',
        altSolutions: [
          `SELECT run_date, feed_name, status, finished_time FROM batch_runs WHERE NOT finished_time < '07:00' ORDER BY finished_time DESC;`
        ],
        requires: [{ re: /finished_time\s*>=\s*'07:00'|'07:00'\s*<=\s*\w*\.?finished_time|NOT\s+\w*\.?finished_time\s*<\s*'07:00'/i, msg: `The rows match only because no run finished at exactly 07:00. The spec says before 07:00, so a run at 07:00 also misses it. Use <code>&gt;= '07:00'</code>.` }],
        wrong: [
          `SELECT run_date, feed_name, status, finished_time FROM batch_runs WHERE finished_time > '07:00' ORDER BY finished_time DESC;`,
          `SELECT run_date, feed_name, status, finished_time FROM batch_runs WHERE finished_time >= '07:00' AND status = 'FAILED' ORDER BY finished_time DESC;`,
          `SELECT run_date, feed_name, status, finished_time FROM batch_runs WHERE finished_time < '07:00' ORDER BY finished_time DESC;`,
          `SELECT run_date, feed_name, status, finished_time FROM batch_runs WHERE finished_time >= '07:00' ORDER BY finished_time;`
        ],
        traps: [
          { re: /'FAILED'/, msg: 'A late run can still say SUCCESS. Test the time, whatever the status says.' },
          { re: /finished_time\s*<\s*'07:00'/i, msg: 'This keeps the runs that made it. You want the ones that missed the time.' }
        ],
        hints: [
          `This is one comparison on <code>finished_time</code>.`,
          `Times written as HH:MM compare correctly as text, so put the limit in single quotes.`,
          `<code>WHERE finished_time &gt;= '07:00'</code>, then sort by <code>finished_time DESC</code>.`
        ],
        win: `All four are CORE_LOANS and marked SUCCESS, finishing between 07:25 and 07:40, so desk staff may have started those days on stale DPD. Complete and on time are separate tests, so a pack needs both.`,
        pattern: { sql: `SELECT run_date, feed_name, finished_time\nFROM batch_runs\nWHERE finished_time >= '07:00'\nORDER BY finished_time DESC;`, note: 'A feed that finished after its deadline' }
      },
      {
        id: '7.19',
        title: 'The next date',
        newIdea: 'date() moves a date forward by the step you name.',
        from: 'Arif, batch support in IT',
        teach: `<p>Dates here are text, so adding 1 to one does not give the next day. <code>date(d, '+1 day')</code> takes a date and moves it by the step you name. The step is text, with a sign, a number and a unit.</p><p>In the example, the day after 31 October rolls over into November with no extra work.</p>`,
        ex: [
          ["SELECT date('2026-10-31', '+1 day') AS next_day;", 'Show the day after 31 October.']
        ],
        bridge: 'Like =A1+1 on a date cell in Excel.',
        task: `Failed runs get rerun the next night. For runs with <code>status</code> FAILED, return <code>run_id</code>, <code>run_date</code>, <code>feed_name</code> and <code>rerun_date</code> (the day after <code>run_date</code>).`,
        solution: `SELECT run_id, run_date, feed_name,
  date(run_date, '+1 day') AS rerun_date
FROM batch_runs
WHERE status = 'FAILED';`,
        altSolutions: [
          `SELECT run_id, run_date, feed_name,
  strftime('%Y-%m-%d', run_date, '+1 day') AS rerun_date
FROM batch_runs
WHERE status = 'FAILED';`
        ],
        wrong: [
          `SELECT run_id, run_date, feed_name, run_date + 1 AS rerun_date FROM batch_runs WHERE status = 'FAILED';`,
          `SELECT run_id, run_date, feed_name, date(run_date, '-1 day') AS rerun_date FROM batch_runs WHERE status = 'FAILED';`,
          `SELECT run_id, run_date, feed_name, date(run_date, '+1') AS rerun_date FROM batch_runs WHERE status = 'FAILED';`,
          `SELECT run_id, run_date, feed_name, date(run_date, '+1 day') AS rerun_date FROM batch_runs;`
        ],
        traps: [
          { re: /run_date\s*\+\s*\d/i, msg: 'Adding a number treats the date as a number, so you get 2027. Use <code>date(run_date, \'+1 day\')</code>.' },
          { re: /date\(\s*run_date\s*,\s*'-/i, msg: 'A minus sign moves the date back. The rerun is the day after, so use a plus sign.' },
          { re: /date\(\s*run_date\s*,\s*'\+?\d+'\s*\)/i, msg: 'The step needs a unit, so write <code>\'+1 day\'</code>. Without one, <code>date()</code> returns NULL.' },
          { re: /^(?![\s\S]*'FAILED')/i, msg: 'The request is about failed runs only, so filter on <code>status</code>.' }
        ],
        hints: [
          'You need one filter and one calculated column.',
          'Copy the shape of the example, with <code>run_date</code> in place of the fixed date.',
          `<code>date(run_date, '+1 day') AS rerun_date</code>`
        ],
        pattern: { sql: `SELECT id, date(some_date, '+1 day') AS next_day\nFROM table_name;`, note: 'Move a date forward' },
        win: `A date calculated from the row stays right for any run, with nothing typed by hand. The same step builds a full calendar in the next mission.`,
        atWork: `The date step differs by database. SQL Server uses <code>DATEADD(day, 1, d)</code>. Oracle and PostgreSQL use <code>d + 1</code>. BigQuery uses <code>DATE_ADD(d, INTERVAL 1 DAY)</code>.`
      },
      {
        id: '7.20',
        title: 'Build a calendar',
        newIdea: 'WITH RECURSIVE builds a list of dates, one row at a time.',
        from: 'Arif, batch support in IT',
        teach: `<p>To find a date with no data, you need a list of every date, and you cannot trust a log to contain the dates it missed. So you build the list.</p><p><code>WITH RECURSIVE</code> makes a list that can read its own rows. The first <code>SELECT</code> gives the first row. The second <code>SELECT</code> reads the newest row and adds the next one. <code>WHERE</code> says when to stop.</p>`,
        ex: [
          ['WITH RECURSIVE calendar(d) AS (', 'Build a list called calendar with one column, d,'],
          ["  SELECT '2026-01-01'", 'starting at 1 January'],
          ['  UNION ALL', 'and adding rows,'],
          ["  SELECT date(d, '+1 day')", 'each one day after the last,'],
          ['  FROM calendar', 'taken from the list so far,'],
          ["  WHERE d < '2026-01-07'", 'while the date is still before 7 January.'],
          [')', 'Then'],
          ['SELECT d', 'show each date'],
          ['FROM calendar;', 'in the list.']
        ],
        exNote: 'Look at the last row. The test says before 7 January, and 7 January is still in the list. The 6 January row passes the test and adds one more day. Then 7 January fails the test, so the list stops.',
        bridge: 'Like typing a start date in Excel and dragging the fill handle down, with the formula =A1+1.',
        task: `Fill the blanks to build a calendar of every date from 2026-10-01 to 2026-10-31, in a column called <code>run_date</code>. You should get 31 rows.`,
        starter: `WITH RECURSIVE calendar(run_date) AS (
  SELECT '____'
  UNION ALL
  SELECT date(run_date, '____')
  FROM calendar
  WHERE run_date < '____'
)
SELECT run_date
FROM calendar;`,
        fill: ['2026-10-01', '+1 day', '2026-10-31'],
        solution: `WITH RECURSIVE calendar(run_date) AS (
  SELECT '2026-10-01'
  UNION ALL
  SELECT date(run_date, '+1 day')
  FROM calendar
  WHERE run_date < '2026-10-31'
)
SELECT run_date
FROM calendar;`,
        wrong: [
          `WITH RECURSIVE calendar(run_date) AS (SELECT '2026-10-01' UNION ALL SELECT date(run_date, '+1 day') FROM calendar WHERE run_date <= '2026-10-31') SELECT run_date FROM calendar;`,
          `WITH RECURSIVE calendar(run_date) AS (SELECT '2026-10-01' UNION ALL SELECT date(run_date, '+1 day') FROM calendar WHERE run_date < '2026-10-30') SELECT run_date FROM calendar;`
        ],
        traps: [
          { re: /<=\s*'2026-10-31'/, msg: 'With <code>&lt;=</code>, the step still runs when the date is already 31 October, and it adds 1 November. Use <code>&lt;</code>.' },
          { re: /<\s*'2026-10-30'/, msg: 'The stop test runs before the next row is added. To reach 31 October, the last date allowed to take a step is 30 October, so write <code>&lt; \'2026-10-31\'</code>.' },
          { re: /<\s*'2026-11-01'/, msg: 'The 31 October row would pass this test and add 1 November. Stop at the last date you want.' },
          { re: /date\(\s*run_date\s*,\s*'\+?\d+'\s*\)/i, msg: 'The step needs a unit, so write <code>\'+1 day\'</code>. Without one, <code>date()</code> returns NULL.' }
        ],
        hints: [
          'The first blank is the first date you want.',
          'The middle blank is the step from the last mission.',
          `The last blank is the date to stop at: <code>'2026-10-31'</code>.`
        ],
        pattern: { sql: `WITH RECURSIVE calendar(d) AS (\n  SELECT '2026-01-01'\n  UNION ALL\n  SELECT date(d, '+1 day')\n  FROM calendar\n  WHERE d < '2026-01-31'\n)\nSELECT d\nFROM calendar;`, note: 'Build a list of every date in a range' },
        win: `Checks for what did not happen start from a list of what should have happened. You can now build that list for any date range.`,
        atWork: `PostgreSQL has <code>generate_series</code> and BigQuery has <code>GENERATE_DATE_ARRAY</code>. Oracle and SQL Server use recursive CTEs without the word RECURSIVE. SQL Server stops at 100 steps unless you add <code>OPTION (MAXRECURSION 0)</code>. Many data warehouses also keep a ready-made calendar table, so ask first.`
      },
      {
        id: '7.21',
        title: 'Find the missing runs',
        newIdea: 'Join a calendar to the log to find jobs that never ran at all.',
        from: 'Arif, batch support in IT',
        teach: `<p>A failed run leaves a row. A run that never started leaves nothing, so no filter on <code>batch_runs</code> can find it.</p><p>The starter has the calendar and the feeds. Write <code>RECURSIVE</code> once, right after <code>WITH</code>, even when other steps follow, and add the next step after a comma. Now <code>CROSS JOIN</code> them, then look for gaps with <code>LEFT JOIN</code> and <code>IS NULL</code>. Match on date and feed together, because the other feed may have run that night.</p>`,
        ex: [
          ['WITH RECURSIVE calendar(d) AS (', 'Build a calendar'],
          ["  SELECT '2026-01-26'", 'starting at 26 January'],
          ['  UNION ALL', 'and adding'],
          ["  SELECT date(d, '+1 day')", 'one day at a time'],
          ['  FROM calendar', 'to the list so far'],
          ["  WHERE d < '2026-01-31'", 'up to 31 January.'],
          [')', 'Then'],
          ['SELECT calendar.d', 'show each date'],
          ['FROM calendar', 'from the calendar,'],
          ['LEFT JOIN collection_activities a', 'looking up activities'],
          ['  ON a.activity_date = calendar.d', 'on that date,'],
          ['WHERE a.activity_id IS NULL;', 'keeping dates where none were found.']
        ],
        exNote: 'No contact attempts were logged on these three dates, and now you can ask why.',
        bridge: 'Like a month-end checklist, where you list every expected item first and then tick off what arrived.',
        task: `For each date from 2026-01-01 to 2026-10-31 and each <code>feed_name</code> in <code>batch_runs</code>, find the combinations with no run at all. Return <code>run_date</code> and <code>feed_name</code>.`,
        starter: `WITH RECURSIVE calendar(run_date) AS (
  SELECT '2026-01-01'
  UNION ALL
  SELECT date(run_date, '+1 day')
  FROM calendar
  WHERE run_date < '2026-10-31'
),
feeds AS (
  SELECT DISTINCT feed_name
  FROM batch_runs
)
-- Your query starts here
`,
        solution: `WITH RECURSIVE calendar(run_date) AS (
  SELECT '2026-01-01'
  UNION ALL
  SELECT date(run_date, '+1 day')
  FROM calendar
  WHERE run_date < '2026-10-31'
),
feeds AS (
  SELECT DISTINCT feed_name
  FROM batch_runs
)
SELECT calendar.run_date, feeds.feed_name
FROM calendar
CROSS JOIN feeds
LEFT JOIN batch_runs r
  ON r.run_date = calendar.run_date
  AND r.feed_name = feeds.feed_name
WHERE r.run_id IS NULL;`,
        altSolutions: [
          `WITH RECURSIVE calendar(run_date) AS (
  SELECT '2026-01-01'
  UNION ALL
  SELECT date(run_date, '+1 day')
  FROM calendar
  WHERE run_date < '2026-10-31'
),
feeds AS (
  SELECT DISTINCT feed_name
  FROM batch_runs
)
SELECT calendar.run_date, feeds.feed_name
FROM calendar
CROSS JOIN feeds
EXCEPT
SELECT run_date, feed_name
FROM batch_runs;`
        ],
        requires: [{ re: /\bRECURSIVE\b/i, msg: 'Right result. Dates taken from the log would miss a night when both feeds failed to run, so build the calendar with <code>WITH RECURSIVE</code>.' }],
        wrong: [
          `SELECT run_date, feed_name FROM batch_runs WHERE status = 'FAILED';`,
          `WITH RECURSIVE calendar(run_date) AS (SELECT '2026-01-01' UNION ALL SELECT date(run_date, '+1 day') FROM calendar WHERE run_date < '2026-10-31'), feeds AS (SELECT DISTINCT feed_name FROM batch_runs) SELECT calendar.run_date, feeds.feed_name FROM calendar CROSS JOIN feeds LEFT JOIN batch_runs r ON r.run_date = calendar.run_date WHERE r.run_id IS NULL;`,
          `WITH RECURSIVE calendar(run_date) AS (SELECT '2026-01-01' UNION ALL SELECT date(run_date, '+1 day') FROM calendar WHERE run_date <= '2026-10-31'), feeds AS (SELECT DISTINCT feed_name FROM batch_runs) SELECT calendar.run_date, feeds.feed_name FROM calendar CROSS JOIN feeds LEFT JOIN batch_runs r ON r.run_date = calendar.run_date AND r.feed_name = feeds.feed_name WHERE r.run_id IS NULL;`,
          `WITH cal AS (SELECT DISTINCT run_date FROM batch_runs), feeds AS (SELECT DISTINCT feed_name FROM batch_runs) SELECT cal.run_date, feeds.feed_name FROM cal CROSS JOIN feeds LEFT JOIN batch_runs r ON r.run_date = cal.run_date AND r.feed_name = feeds.feed_name WHERE r.run_id IS NULL;`,
          `SELECT run_date, CASE WHEN MAX(feed_name) = 'CORE_LOANS' THEN 'PAYMENTS' ELSE 'CORE_LOANS' END AS feed_name FROM batch_runs GROUP BY run_date HAVING COUNT(DISTINCT feed_name) < 2;`
        ],
        traps: [
          { re: /'FAILED'/, msg: 'A failed run did run, and it has a row. This check looks for nights with no row at all.' },
          { re: /<=\s*'2026-10-31'/, msg: 'With <code>&lt;=</code>, the calendar runs on to 1 November, which has no runs yet. Use <code>&lt;</code>.' },
          { re: /ON\s+\w+\.run_date\s*=\s*\w+\.run_date\s+WHERE/i, msg: 'On each missing night the other feed still ran, so matching on date alone finds a row. Match on <code>feed_name</code> too.' },
          { re: /\bCROSS\s+JOIN\b(?![\s\S]*\b(LEFT\s+JOIN|EXCEPT|NOT\s+EXISTS|NOT\s+IN)\b)/i, msg: 'The grid is built. Now <code>LEFT JOIN batch_runs</code> and keep the rows where nothing matched.' },
          { re: /\bCROSS\s+JOIN\b(?![\s\S]*\b(ON|USING)\b)/i, msg: '<code>CROSS JOIN</code> rightly has no <code>ON</code>, so leave that part as it is.' },
          { re: /\bCROSS\s+JOIN\b(?![\s\S]*\b(ON|USING)\b)[\s\S]*\b(EXCEPT|NOT\s+EXISTS|NOT\s+IN)\b/i, msg: 'The second query has to match both the date and the feed. With <code>EXCEPT</code>, it returns <code>run_date</code> and <code>feed_name</code>, in the same order as the first query.' }
        ],
        hints: [
          'The starter has two of the three pieces, the calendar and the feeds. The third is the real log.',
          'Under the comment, write <code>SELECT calendar.run_date, feeds.feed_name FROM calendar CROSS JOIN feeds</code>, then <code>LEFT JOIN batch_runs r</code>.',
          'The <code>ON</code> matches both date and feed. Finish with <code>WHERE r.run_id IS NULL</code>.'
        ],
        pattern: { sql: `WITH RECURSIVE calendar(d) AS (...),\nfeeds AS (SELECT DISTINCT feed_name FROM batch_runs)\nSELECT calendar.d, feeds.feed_name\nFROM calendar\nCROSS JOIN feeds\nLEFT JOIN batch_runs r\n  ON r.run_date = calendar.d AND r.feed_name = feeds.feed_name\nWHERE r.run_id IS NULL;`, note: 'Find jobs that never ran' },
        win: `CORE_LOANS never ran on 2026-03-29, and PAYMENTS never ran on 2026-08-17. These leave no row and no error, so a dashboard reading only the log will not show them.`,
        atWork: `The feed list here also comes from the log, so a feed that never ran at all would be missed. At work, take the list of expected feeds from the spec or a setup table.`
      },
      {
        id: '7.22',
        title: 'Overdue with no collector',
        newIdea: 'Test an allocation rule using only the rows that are active today.',
        from: 'Bu Ratih, Head of Collection Operations',
        teach: `<p>[[Allocation|allocation]] rules say who works each loan. An active assignment has <code>unassigned_date</code> NULL, and old assignments do not count.</p><p>Put the active test in <code>ON</code>. Then a loan with only old assignments finds no match, so it comes back with NULLs and you can catch it.</p><p>If you put the test in <code>WHERE</code>, those loans disappear from the result. That is the LEFT JOIN bug you fixed in Level 6.</p>`,
        ex: [
          ['SELECT k.collector_id, k.collector_name, k.team', 'Show each collector and their team'],
          ['FROM collectors k', 'from the collectors table,'],
          ['LEFT JOIN loan_assignments g', 'looking up assignments'],
          ['  ON g.collector_id = k.collector_id', 'belonging to that collector'],
          ['  AND g.unassigned_date IS NULL', 'that are still active,'],
          ["WHERE k.team IN ('Field', 'Agency')", 'for field and agency staff in this example,'],
          ['  AND g.assignment_id IS NULL;', 'keeping those with no active loan.']
        ],
        exNote: 'This looks from the other side: people with no active work.',
        bridge: 'Like running a VLOOKUP against a sheet of current records only, then keeping the #N/A rows.',
        task: `Which overdue loans have nobody on them? Find loans with <code>dpd</code> above 0, <code>status</code> not Written Off, and no active assignment. Written-off loans have their own rule, which you will test later. Return <code>loan_id</code>, <code>dpd</code>, <code>status</code> and <code>outstanding</code>.`,
        solution: `SELECT l.loan_id, l.dpd, l.status, l.outstanding
FROM loans l
LEFT JOIN loan_assignments g
  ON g.loan_id = l.loan_id
  AND g.unassigned_date IS NULL
WHERE l.dpd > 0
  AND l.status <> 'Written Off'
  AND g.assignment_id IS NULL;`,
        altSolutions: [
          `SELECT l.loan_id, l.dpd, l.status, l.outstanding
FROM loans l
WHERE l.dpd > 0
  AND l.status <> 'Written Off'
  AND NOT EXISTS (
    SELECT 1
    FROM loan_assignments g
    WHERE g.loan_id = l.loan_id
      AND g.unassigned_date IS NULL
  );`,
          `SELECT loan_id, dpd, status, outstanding
FROM loans
WHERE dpd > 0
  AND status <> 'Written Off'
  AND loan_id NOT IN (
    SELECT loan_id
    FROM loan_assignments
    WHERE unassigned_date IS NULL
  );`
        ],
        wrong: [
          `SELECT l.loan_id, l.dpd, l.status, l.outstanding FROM loans l LEFT JOIN loan_assignments g ON g.loan_id = l.loan_id WHERE l.dpd > 0 AND l.status <> 'Written Off' AND g.assignment_id IS NULL;`,
          `SELECT l.loan_id, l.dpd, l.status, l.outstanding FROM loans l LEFT JOIN loan_assignments g ON g.loan_id = l.loan_id WHERE l.dpd > 0 AND l.status <> 'Written Off' AND g.unassigned_date IS NULL;`,
          `SELECT l.loan_id, l.dpd, l.status, l.outstanding FROM loans l LEFT JOIN loan_assignments g ON g.loan_id = l.loan_id AND g.unassigned_date IS NULL WHERE l.dpd > 0 AND g.assignment_id IS NULL;`
        ],
        traps: [
          { re: /^(?![\s\S]*unassigned_date)/i, msg: 'This only finds loans never assigned to anyone. A loan whose last collector has been unassigned is also unworked. Test <code>unassigned_date IS NULL</code> in the <code>ON</code>.' },
          { re: /LEFT\s+JOIN[\s\S]*\bWHERE[\s\S]*unassigned_date\s+IS\s+NULL/i, msg: 'In <code>WHERE</code>, this test keeps loans that do have an active assignment. Move it up into the <code>ON</code>.' },
          { re: /^(?![\s\S]*Written Off)/i, msg: "The request leaves out Written Off loans. Add <code>status &lt;&gt; 'Written Off'</code>." }
        ],
        hints: [
          'Start from <code>loans</code>, because that is the side you must keep.',
          'The join has two conditions: same loan, and <code>g.unassigned_date IS NULL</code>.',
          'In <code>WHERE</code>: overdue, not written off, and <code>g.assignment_id IS NULL</code>.'
        ],
        pattern: { sql: `SELECT p.id\nFROM parent p\nLEFT JOIN child c\n  ON c.parent_id = p.id\n  AND c.end_date IS NULL\nWHERE c.id IS NULL;`, note: 'No active row: the "active" test goes in ON' },
        win: `Twenty-five overdue loans have no active collector, and 14 of them have no logged contact at all. Three are already Kol 4 or 5, so name those first, and most of the rest are under 30 days late, so ask whether the spec starts allocation later.`
      },
      {
        id: '7.23',
        title: 'Two collectors on one loan',
        newIdea: 'Test a rule from the other side: too many active rows as well as too few.',
        from: 'Bu Ratih, Head of Collection Operations',
        teach: `<p>"One collector per loan" can fail two ways. You found loans with none. The other failure is two collectors holding one loan at once. A customer may get called twice, or each collector may assume the other is handling it.</p><p>Find those loans in a [[CTE]], with the active test in <code>WHERE</code> and a count per loan. Then join back to list who holds them, because a loan ID alone gives IT little to work with.</p>`,
        ex: [
          ['SELECT collector_id, COUNT(*) AS active_loans', 'Show each collector with a count of their loans'],
          ['FROM loan_assignments', 'from the assignments table,'],
          ['WHERE unassigned_date IS NULL', 'looking at active ones only,'],
          ['GROUP BY collector_id', 'one row per collector,'],
          ['HAVING COUNT(*) >= 9;', 'keeping anyone holding 9 or more.']
        ],
        exNote: 'This is a workload view of the same rows. The 9 is only a level picked for this example.',
        bridge: 'Like a pivot of current assignments by loan, then filtering to counts above 1.',
        task: `Now the other side. Find loans with more than one active assignment, at any DPD, and show who holds them. One row per active assignment on those loans: <code>loan_id</code>, <code>collector_name</code>, <code>assigned_date</code>. Sort by <code>loan_id</code>, then <code>assigned_date</code>.`,
        solution: `WITH doubled AS (
  SELECT loan_id
  FROM loan_assignments
  WHERE unassigned_date IS NULL
  GROUP BY loan_id
  HAVING COUNT(*) > 1
)
SELECT g.loan_id, k.collector_name, g.assigned_date
FROM loan_assignments g
JOIN doubled d
  ON d.loan_id = g.loan_id
JOIN collectors k
  ON k.collector_id = g.collector_id
WHERE g.unassigned_date IS NULL
ORDER BY g.loan_id, g.assigned_date;`,
        ordered: 'assigned_date',
        altSolutions: [
          `SELECT g.loan_id, k.collector_name, g.assigned_date FROM loan_assignments g JOIN collectors k ON k.collector_id = g.collector_id WHERE g.unassigned_date IS NULL AND g.loan_id IN (SELECT loan_id FROM loan_assignments WHERE unassigned_date IS NULL GROUP BY loan_id HAVING COUNT(*) > 1) ORDER BY g.loan_id, g.assigned_date;`,
          `WITH counted AS (SELECT loan_id, collector_id, assigned_date, COUNT(*) OVER (PARTITION BY loan_id) AS holders FROM loan_assignments WHERE unassigned_date IS NULL) SELECT c.loan_id, k.collector_name, c.assigned_date FROM counted c JOIN collectors k ON k.collector_id = c.collector_id WHERE c.holders > 1 ORDER BY c.loan_id, c.assigned_date;`
        ],
        wrong: [
          `WITH doubled AS (SELECT loan_id FROM loan_assignments GROUP BY loan_id HAVING COUNT(*) > 1) SELECT g.loan_id, k.collector_name, g.assigned_date FROM loan_assignments g JOIN doubled d ON d.loan_id = g.loan_id JOIN collectors k ON k.collector_id = g.collector_id WHERE g.unassigned_date IS NULL ORDER BY g.loan_id, g.assigned_date;`,
          `WITH doubled AS (SELECT loan_id FROM loan_assignments WHERE unassigned_date IS NULL GROUP BY loan_id HAVING COUNT(*) > 1) SELECT g.loan_id, k.collector_name, g.assigned_date FROM loan_assignments g JOIN doubled d ON d.loan_id = g.loan_id JOIN collectors k ON k.collector_id = g.collector_id ORDER BY g.loan_id, g.assigned_date;`,
          `WITH doubled AS (SELECT g.loan_id FROM loan_assignments g JOIN loans l ON l.loan_id = g.loan_id WHERE g.unassigned_date IS NULL AND l.dpd > 0 GROUP BY g.loan_id HAVING COUNT(*) > 1) SELECT g.loan_id, k.collector_name, g.assigned_date FROM loan_assignments g JOIN doubled d ON d.loan_id = g.loan_id JOIN collectors k ON k.collector_id = g.collector_id WHERE g.unassigned_date IS NULL ORDER BY g.loan_id, g.assigned_date;`,
          `WITH doubled AS (SELECT loan_id FROM loan_assignments WHERE unassigned_date IS NULL GROUP BY loan_id HAVING COUNT(*) > 1) SELECT g.loan_id, k.collector_name, g.assigned_date FROM loan_assignments g JOIN doubled d ON d.loan_id = g.loan_id JOIN collectors k ON k.collector_id = g.collector_id WHERE g.unassigned_date IS NULL ORDER BY k.collector_name;`
        ],
        traps: [
          { re: /^(?![\s\S]*unassigned_date)/i, msg: 'This counts old assignments too, so any reassigned loan shows up. Limit it to <code>unassigned_date IS NULL</code>.' },
          { re: /unassigned_date\s+IS\s+NOT\s+NULL/i, msg: '<code>IS NOT NULL</code> means the assignment has ended. Active ones are <code>IS NULL</code>.' },
          { re: /\bdpd\b/i, msg: 'The request says at any DPD, so a loan that is current also counts here.' }
        ],
        hints: [
          `Start with the step that finds the loans: <code>loan_assignments</code>, active rows only, grouped by <code>loan_id</code>.`,
          `<code>HAVING COUNT(*) &gt; 1</code> keeps the doubled loans. Then join <code>loan_assignments</code> back to that step, and join <code>collectors</code> for the name.`,
          `The outer query needs the active test as well, <code>WHERE g.unassigned_date IS NULL</code>, or old assignments come back.`
        ],
        pattern: { sql: `WITH doubled AS (\n  SELECT id\n  FROM table_name\n  WHERE end_date IS NULL\n  GROUP BY id\n  HAVING COUNT(*) > 1\n)\nSELECT t.id, t.col_a\nFROM table_name t\nJOIN doubled d\n  ON d.id = t.id\nWHERE t.end_date IS NULL;`, note: 'More than one active row where only one is allowed, then list them' },
        win: `On all four loans, the newer active assignment is dated 2026-10-05, and the older one was never closed. That suggests one job moved these loans and left the old rows open, which gives IT a place to start.`
      },
      {
        id: '7.24',
        title: 'Who held the loan that day',
        newIdea: 'An assignment covers a date when it started on or before that date and had not ended before it.',
        from: 'Bu Ratih, Head of Collection Operations',
        teach: `<p>So far, active meant <code>unassigned_date</code> is NULL, and that only says who holds a loan today. To credit work or cash fairly, you need who held it on the day.</p><p>Test the date against the range. <code>assigned_date</code> is on or before it, and the end is either NULL or on or after it. Put brackets around that OR. When you join, this goes in <code>ON</code>, so a row with no match still comes back.</p>`,
        ex: [
          [`SELECT g.collector_id, g.assigned_date, g.unassigned_date`, `Show the collector and the assignment's dates`],
          [`FROM loan_assignments g`, `from the assignments table,`],
          [`WHERE g.loan_id = 85`, `for loan 85,`],
          [`  AND g.assigned_date <= '2026-06-15'`, `where it started by 15 June`],
          [`  AND (g.unassigned_date IS NULL OR g.unassigned_date >= '2026-06-15');`, `and had not ended before that day.`]
        ],
        exNote: `Loan 85 has four assignments, and only this one covers 15 June. It has an end date, so the old "active" test would miss it.`,
        bridge: 'Like looking up the tax rate in force on an invoice date, from a table with effective-from and effective-to columns.',
        task: `Who is logging work on loans they did not hold? List activities from 2026-10-01 on, with a <code>collector_id</code>, where that collector had no assignment on that loan covering the <code>activity_date</code>. Return <code>activity_id</code>, <code>loan_id</code>, <code>collector_id</code> and <code>activity_date</code>.`,
        solution: `SELECT a.activity_id, a.loan_id, a.collector_id, a.activity_date
FROM collection_activities a
LEFT JOIN loan_assignments g
  ON g.loan_id = a.loan_id
  AND g.collector_id = a.collector_id
  AND g.assigned_date <= a.activity_date
  AND (g.unassigned_date IS NULL OR g.unassigned_date >= a.activity_date)
WHERE a.activity_date >= '2026-10-01'
  AND a.collector_id IS NOT NULL
  AND g.assignment_id IS NULL;`,
        altSolutions: [
          `SELECT a.activity_id, a.loan_id, a.collector_id, a.activity_date FROM collection_activities a WHERE a.activity_date >= '2026-10-01' AND a.collector_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM loan_assignments g WHERE g.loan_id = a.loan_id AND g.collector_id = a.collector_id AND g.assigned_date <= a.activity_date AND (g.unassigned_date IS NULL OR g.unassigned_date >= a.activity_date));`,
          `SELECT a.activity_id, a.loan_id, a.collector_id, a.activity_date FROM collection_activities a LEFT JOIN loan_assignments g ON g.loan_id = a.loan_id AND g.collector_id = a.collector_id AND a.activity_date BETWEEN g.assigned_date AND COALESCE(g.unassigned_date, '9999-12-31') WHERE a.activity_date >= '2026-10-01' AND a.collector_id IS NOT NULL AND g.assignment_id IS NULL;`
        ],
        wrong: [
          `SELECT a.activity_id, a.loan_id, a.collector_id, a.activity_date FROM collection_activities a LEFT JOIN loan_assignments g ON g.loan_id = a.loan_id AND g.collector_id = a.collector_id AND g.unassigned_date IS NULL WHERE a.activity_date >= '2026-10-01' AND a.collector_id IS NOT NULL AND g.assignment_id IS NULL;`,
          `SELECT a.activity_id, a.loan_id, a.collector_id, a.activity_date FROM collection_activities a LEFT JOIN loan_assignments g ON g.loan_id = a.loan_id AND g.collector_id = a.collector_id AND g.assigned_date <= a.activity_date AND (g.unassigned_date IS NULL OR g.unassigned_date >= a.activity_date) WHERE a.activity_date >= '2026-10-01' AND g.assignment_id IS NULL;`,
          `SELECT a.activity_id, a.loan_id, a.collector_id, a.activity_date FROM collection_activities a LEFT JOIN loan_assignments g ON g.loan_id = a.loan_id AND g.collector_id = a.collector_id AND g.assigned_date <= a.activity_date AND g.unassigned_date IS NULL OR g.unassigned_date >= a.activity_date WHERE a.activity_date >= '2026-10-01' AND a.collector_id IS NOT NULL AND g.assignment_id IS NULL;`,
          `SELECT a.activity_id, a.loan_id, a.collector_id, a.activity_date FROM collection_activities a LEFT JOIN loan_assignments g ON g.loan_id = a.loan_id AND g.assigned_date <= a.activity_date AND (g.unassigned_date IS NULL OR g.unassigned_date >= a.activity_date) WHERE a.activity_date >= '2026-10-01' AND a.collector_id IS NOT NULL AND g.assignment_id IS NULL;`
        ],
        traps: [
          { re: /^(?![\s\S]*assigned_date\s*<=|[\s\S]*BETWEEN)/i, msg: 'The test has to cover the date of the activity, so compare <code>assigned_date</code> with <code>activity_date</code>.' },
          { re: /assigned_date\s*<=\s*\w+\.activity_date\s+AND\s+\w+\.unassigned_date\s+IS\s+NULL\s+OR/i, msg: 'Without brackets, the OR reaches past the other tests and matches other loans. Put brackets around <code>unassigned_date IS NULL OR unassigned_date &gt;= activity_date</code>.' },
          { re: /^(?![\s\S]*collector_id\s+IS\s+NOT\s+NULL)(?![\s\S]*NOT\s+EXISTS)/i, msg: 'Auto SMS rows have no collector, so nobody held them. Keep only rows where <code>collector_id IS NOT NULL</code>.' }
        ],
        hints: [
          `Start from the activities, and look for a matching assignment that covers the day. Keep the rows that find none.`,
          `The <code>ON</code> matches the loan, the collector and the date range. Put the range tests in <code>ON</code>, as you did for the active test.`,
          `The range is <code>g.assigned_date &lt;= a.activity_date AND (g.unassigned_date IS NULL OR g.unassigned_date &gt;= a.activity_date)</code>. In <code>WHERE</code>, add the date, <code>a.collector_id IS NOT NULL</code> and <code>g.assignment_id IS NULL</code>.`
        ],
        win: `Thirty activities since 1 October came from someone with no assignment that day, so either the assignment log runs late or people are working loans they do not hold. The same test decides who gets credit for cash, since 138 of 242 Collector payments reach today's holder and 234 reach the holder on the payment date.`,
        pattern: { sql: `SELECT t.id, t.event_date\nFROM table_name t\nLEFT JOIN history_table h\n  ON h.id = t.id\n  AND h.start_date <= t.event_date\n  AND (h.end_date IS NULL OR h.end_date >= t.event_date)\nWHERE h.id IS NULL;`, note: 'Who or what was in force on the day of the event' }
      },
      {
        id: '7.25',
        title: 'Right team for the bucket',
        newIdea: 'Test that the right team holds a loan, as well as how many people hold it.',
        from: 'Bu Ratih, Head of Collection Operations',
        teach: `<p>Your [[allocation]] checks so far counted collectors. A loan can have exactly one collector and still sit with the wrong team. Early overdue loans usually go to [[desk call]], and later ones to [[field collection]] or an [[agency]].</p><p>Write the rule as its broken combinations, each in brackets, joined by <code>OR</code>. A row matching either one is a break. Without the brackets, <code>AND</code> binds first and the list goes wrong, as you saw in Level 6.</p>`,
        ex: [
          [`SELECT k.team,`, `For each team, show its name,`],
          [`  COUNT(*) AS active_loans,`, `how many loans it holds,`],
          [`  MIN(l.dpd) AS lowest_dpd,`, `the lowest DPD`],
          [`  MAX(l.dpd) AS highest_dpd`, `and the highest,`],
          [`FROM loan_assignments g`, `from the assignments`],
          [`JOIN loans l ON l.loan_id = g.loan_id`, `with each loan`],
          [`JOIN collectors k ON k.collector_id = g.collector_id`, `and each collector,`],
          [`WHERE g.unassigned_date IS NULL`, `using active assignments`],
          [`  AND l.status <> 'Written Off'`, `on loans not written off,`],
          [`GROUP BY k.team;`, `with one row per team.`]
        ],
        exNote: `Desk Call reaches 103 DPD and Field starts at 0, so the teams overlap. Your task names the rows.`,
        bridge: 'Like testing a delegation of authority, where each approval must sit with someone allowed to give it.',
        task: `This rule is a sample, since each bank writes its own: <code>Desk Call</code> holds loans up to 90 DPD, and <code>Field</code> and <code>Agency</code> hold loans above 90. For active assignments on loans not written off, list the breaks: <code>loan_id</code>, <code>dpd</code>, <code>collector_name</code> and <code>team</code>.`,
        solution: `SELECT l.loan_id, l.dpd, k.collector_name, k.team
FROM loan_assignments g
JOIN loans l
  ON l.loan_id = g.loan_id
JOIN collectors k
  ON k.collector_id = g.collector_id
WHERE g.unassigned_date IS NULL
  AND l.status <> 'Written Off'
  AND (
    (k.team = 'Desk Call' AND l.dpd > 90)
    OR (k.team IN ('Field', 'Agency') AND l.dpd <= 90)
  );`,
        requires: [
          { re: /Written Off/i, msg: `The rows match only because no written-off loan breaks this rule today. The request leaves them out, so add <code>l.status &lt;&gt; 'Written Off'</code>.` },
          { re: /^(?![\s\S]*dpd\s*(>=|<)\s*90\b)/i, msg: 'The rows match only because no loan here sits at exactly 90 DPD. Up to 90 includes 90, so write <code>&lt;= 90</code> and <code>&gt; 90</code>.' }
        ],
        altSolutions: [
          `SELECT l.loan_id, l.dpd, k.collector_name, k.team FROM loan_assignments g JOIN loans l ON l.loan_id = g.loan_id JOIN collectors k ON k.collector_id = g.collector_id WHERE g.unassigned_date IS NULL AND l.status <> 'Written Off' AND CASE WHEN l.dpd <= 90 THEN 'Desk Call' ELSE 'Field or Agency' END <> CASE WHEN k.team = 'Desk Call' THEN 'Desk Call' ELSE 'Field or Agency' END;`
        ],
        wrong: [
          `SELECT l.loan_id, l.dpd, k.collector_name, k.team FROM loan_assignments g JOIN loans l ON l.loan_id = g.loan_id JOIN collectors k ON k.collector_id = g.collector_id WHERE g.unassigned_date IS NULL AND l.status <> 'Written Off' AND (k.team = 'Desk Call' AND l.dpd > 90) OR (k.team IN ('Field', 'Agency') AND l.dpd <= 90);`,
          `SELECT l.loan_id, l.dpd, k.collector_name, k.team FROM loan_assignments g JOIN loans l ON l.loan_id = g.loan_id JOIN collectors k ON k.collector_id = g.collector_id WHERE g.unassigned_date IS NULL AND ((k.team = 'Desk Call' AND l.dpd > 90) OR (k.team IN ('Field', 'Agency') AND l.dpd <= 90));`,
          `SELECT l.loan_id, l.dpd, k.collector_name, k.team FROM loan_assignments g JOIN loans l ON l.loan_id = g.loan_id JOIN collectors k ON k.collector_id = g.collector_id WHERE l.status <> 'Written Off' AND ((k.team = 'Desk Call' AND l.dpd > 90) OR (k.team IN ('Field', 'Agency') AND l.dpd <= 90));`,
          `SELECT l.loan_id, l.dpd, k.collector_name, k.team FROM loan_assignments g JOIN loans l ON l.loan_id = g.loan_id JOIN collectors k ON k.collector_id = g.collector_id WHERE g.unassigned_date IS NULL AND l.status <> 'Written Off' AND k.team = 'Desk Call' AND l.dpd > 90;`
        ],
        traps: [
          { re: /'Written Off'[\s\S]*?\bAND\s*\(\s*k\.team[^()]*\)\s*OR\b/i, msg: 'Without brackets around the whole OR, the second half skips the active and status tests. Wrap both combinations in one more pair of brackets.' },
          { re: /^(?![\s\S]*unassigned_date)/i, msg: 'Old assignments do not count. Keep only rows with <code>unassigned_date IS NULL</code>.' },
          { re: /'Desk Call'[^)]*dpd\s*>\s*\d+[^)]*\)\s*\)?\s*;?\s*$/i, msg: 'That is only half of the rule. Add the other break, Field or Agency at 90 or below.' }
        ],
        hints: [
          `You need three tables: <code>loan_assignments</code> for active rows, <code>loans</code> for DPD and status, and <code>collectors</code> for name and team.`,
          `A break is Desk Call above 90, or Field or Agency at 90 or below. Write each one in its own brackets.`,
          `Put <code>(k.team = 'Desk Call' AND l.dpd &gt; 90) OR (k.team IN ('Field', 'Agency') AND l.dpd &lt;= 90)</code> inside one more pair of brackets, after the other tests.`
        ],
        win: `There are twelve breaks, 6 Desk Call loans past 90 DPD and 6 current loans still with Field. Get the real rule from your bank's allocation spec before you raise them, because this one is only a sample.`,
        pattern: { sql: `WHERE g.end_date IS NULL\n  AND (\n    (k.team = 'Team A' AND t.size > 90)\n    OR (k.team = 'Team B' AND t.size <= 90)\n  )`, note: 'Allocation check: list the combinations the rule forbids' }
      },
      {
        id: '7.26',
        title: 'Near-duplicate customers',
        newIdea: 'Join a table to itself with < to list each matching pair once.',
        from: 'Pak Surya, collection system owner',
        teach: `<p>Data entry can create one person twice with slightly different details, and an exact duplicate check misses them. A shared phone number is a strong clue.</p><p>Do a [[self-join]] on the phone. Then add <code>&lt;</code> on the IDs. A row can no longer match itself, because its ID is not smaller than its own ID. Each pair shows once, with the smaller ID first. With <code>&lt;&gt;</code> you would see each pair twice. Customers with a NULL phone do not match anyone, because a comparison with NULL is never true.</p>`,
        ex: [
          ['SELECT b1.city, b1.branch_name AS first_branch, b2.branch_name AS second_branch', 'Show a city and two branch names'],
          ['FROM branches b1', 'from the branches table,'],
          ['JOIN branches b2', 'paired with the same table,'],
          ['  ON b2.city = b1.city', 'where the city matches'],
          ['  AND b1.branch_id < b2.branch_id;', 'and the first ID is the smaller one.']
        ],
        exNote: 'Jakarta has two branches, so one pair comes back. Nothing is wrong here, and the shape is what matters.',
        bridge: 'Like sorting by phone and comparing each row with the one below it, except SQL does the pairing.',
        task: `Find pairs of customer rows with the same <code>phone</code>. Return <code>phone</code>, <code>first_id</code>, <code>first_name</code>, <code>second_id</code> and <code>second_name</code>. Show each pair once, with the smaller <code>customer_id</code> as first.`,
        solution: `SELECT c1.phone,
  c1.customer_id AS first_id,
  c1.full_name AS first_name,
  c2.customer_id AS second_id,
  c2.full_name AS second_name
FROM customers c1
JOIN customers c2
  ON c2.phone = c1.phone
  AND c1.customer_id < c2.customer_id;`,
        requires: [{ re: /(\w+)\.customer_id\s+(?:AS\s+)?first_id[\s\S]*(\1\.customer_id\s*<|>\s*\1\.customer_id)/i, msg: 'Right pairs. The task wants the smaller ID as <code>first_id</code>, so swap the two sides.' }],
        wrong: [
          `SELECT c1.phone, c1.customer_id AS first_id, c1.full_name AS first_name, c2.customer_id AS second_id, c2.full_name AS second_name FROM customers c1 JOIN customers c2 ON c2.phone = c1.phone AND c1.customer_id <> c2.customer_id;`,
          `SELECT c1.phone, c1.customer_id AS first_id, c1.full_name AS first_name, c2.customer_id AS second_id, c2.full_name AS second_name FROM customers c1 JOIN customers c2 ON c2.phone = c1.phone;`,
          `SELECT c1.phone, c1.customer_id AS first_id, c1.full_name AS first_name, c2.customer_id AS second_id, c2.full_name AS second_name FROM customers c1 JOIN customers c2 ON c2.phone = c1.phone AND c1.customer_id > c2.customer_id;`
        ],
        traps: [
          { re: /customer_id\s*(<>|!=)/i, msg: 'With <code>&lt;&gt;</code>, each pair appears twice, once in each direction. Use <code>&lt;</code> so it appears once.' },
          { re: /^(?![\s\S]*customer_id\s*[<>])/i, msg: 'A row always matches itself on its own phone. Add a test on the two IDs.' }
        ],
        hints: [
          'You need the customers table twice, with two different short names.',
          'Join on the phone, and add a second condition on the IDs in the same <code>ON</code>.',
          '<code>ON c2.phone = c1.phone AND c1.customer_id &lt; c2.customer_id</code>'
        ],
        pattern: { sql: `SELECT t1.id AS first_id, t2.id AS second_id\nFROM table_name t1\nJOIN table_name t2\n  ON t2.match_col = t1.match_col\n  AND t1.id < t2.id;`, note: 'List each matching pair once' },
        win: `Three pairs have the same name in different capitals, so they look like one person entered twice, and while the extra rows hold no loans today, a new loan booked on one could split the [[exposure]]. The other seven have different names, so a phone match alone is a clue to check before anyone merges anything.`
      },
      {
        id: '7.27',
        title: 'Build a test pack',
        newIdea: 'UNION ALL stacks one count per check into a single pass or fail table.',
        from: 'Maya, UAT lead',
        teach: `<p>A [[test pack]] runs many checks together and gives one line per check. Each line has a fixed label, the rows it tested and the rows that failed, stacked with <code>UNION ALL</code>.</p><p><code>COUNT(*)</code> is the [[population]], and <code>SUM(CASE ...)</code> counts the failures. A pass shows 0 failed beside a tested count above 0. If <code>rows_tested</code> is 0, the check tested nothing, as you saw with zero rows. Run the pack after every [[release]] and compare it with the last run.</p>`,
        ex: [
          [`SELECT 'customers_no_phone' AS check_name,`, `Label the first check,`],
          [`  COUNT(*) AS rows_tested,`, `count the rows it tested`],
          [`  SUM(CASE WHEN phone IS NULL THEN 1 ELSE 0 END) AS failed_rows`, `and count the rows with no phone,`],
          [`FROM customers`, `from the customers table,`],
          [`UNION ALL`, `then stack underneath`],
          [`SELECT 'dpd_below_zero',`, `a second check,`],
          [`  COUNT(*),`, `the rows it tested`],
          [`  SUM(CASE WHEN dpd < 0 THEN 1 ELSE 0 END)`, `and the rows where DPD is below zero,`],
          [`FROM loans;`, `from the loans table.`]
        ],
        exNote: `Column names come from the first SELECT. The second check shows 0 failed out of 502, a pass you can defend.`,
        bridge: 'Like a one-page control sheet in a workbook, with one line per test and its exception count.',
        task: `Build the pack for tonight's release: <code>check_name</code>, <code>rows_tested</code>, <code>failed_rows</code>.<ul><li><code>orphan_activities</code>: all activities, failing if the loan does not exist</li><li><code>ptp_missing_fields</code>: PTP rows, failing with no date or no amount</li><li><code>bad_payments</code>: all payments, failing at or below zero</li><li><code>short_loads</code>: SUCCESS runs, failing if rows_loaded is below rows_sent</li><li><code>negative_balances</code>: all loans, failing below zero</li></ul>`,
        solution: `SELECT 'orphan_activities' AS check_name,
  COUNT(*) AS rows_tested,
  SUM(CASE WHEN l.loan_id IS NULL THEN 1 ELSE 0 END) AS failed_rows
FROM collection_activities a
LEFT JOIN loans l
  ON l.loan_id = a.loan_id
UNION ALL
SELECT 'ptp_missing_fields',
  COUNT(*),
  SUM(CASE WHEN ptp_date IS NULL OR ptp_amount IS NULL THEN 1 ELSE 0 END)
FROM collection_activities
WHERE result = 'PTP'
UNION ALL
SELECT 'bad_payments',
  COUNT(*),
  SUM(CASE WHEN amount <= 0 THEN 1 ELSE 0 END)
FROM payments
UNION ALL
SELECT 'short_loads',
  COUNT(*),
  SUM(CASE WHEN rows_loaded < rows_sent THEN 1 ELSE 0 END)
FROM batch_runs
WHERE status = 'SUCCESS'
UNION ALL
SELECT 'negative_balances',
  COUNT(*),
  SUM(CASE WHEN outstanding < 0 THEN 1 ELSE 0 END)
FROM loans;`,
        requires: [{ re: /\bUNION\b/i, msg: 'The numbers are right. This mission is about stacking checks, so build it with <code>UNION ALL</code>.' }],
        altSolutions: [
          `SELECT 'orphan_activities' AS check_name, COUNT(*) AS rows_tested, COUNT(*) - COUNT(l.loan_id) AS failed_rows FROM collection_activities a LEFT JOIN loans l ON l.loan_id = a.loan_id UNION ALL SELECT 'ptp_missing_fields', COUNT(*), SUM(CASE WHEN ptp_date IS NULL OR ptp_amount IS NULL THEN 1 ELSE 0 END) FROM collection_activities WHERE result = 'PTP' UNION ALL SELECT 'bad_payments', COUNT(*), SUM(amount <= 0) FROM payments UNION ALL SELECT 'short_loads', COUNT(*), SUM(rows_loaded <> rows_sent) FROM batch_runs WHERE status = 'SUCCESS' UNION ALL SELECT 'negative_balances', COUNT(*), SUM(outstanding < 0) FROM loans;`,
          `SELECT 'orphan_activities' AS check_name, (SELECT COUNT(*) FROM collection_activities) AS rows_tested, (SELECT COUNT(*) FROM collection_activities WHERE loan_id NOT IN (SELECT loan_id FROM loans)) AS failed_rows UNION ALL SELECT 'ptp_missing_fields', (SELECT COUNT(*) FROM collection_activities WHERE result = 'PTP'), (SELECT COUNT(*) FROM collection_activities WHERE result = 'PTP' AND (ptp_date IS NULL OR ptp_amount IS NULL)) UNION ALL SELECT 'bad_payments', (SELECT COUNT(*) FROM payments), (SELECT COUNT(*) FROM payments WHERE amount <= 0) UNION ALL SELECT 'short_loads', (SELECT COUNT(*) FROM batch_runs WHERE status = 'SUCCESS'), (SELECT COUNT(*) FROM batch_runs WHERE status = 'SUCCESS' AND rows_loaded < rows_sent) UNION ALL SELECT 'negative_balances', (SELECT COUNT(*) FROM loans), (SELECT COUNT(*) FROM loans WHERE outstanding < 0);`
        ],
        wrong: [
          `SELECT 'orphan_activities' AS check_name, COUNT(*) AS failed_rows FROM collection_activities a LEFT JOIN loans l ON l.loan_id = a.loan_id WHERE l.loan_id IS NULL UNION ALL SELECT 'ptp_missing_fields', COUNT(*) FROM collection_activities WHERE result = 'PTP' AND (ptp_date IS NULL OR ptp_amount IS NULL) UNION ALL SELECT 'bad_payments', COUNT(*) FROM payments WHERE amount <= 0 UNION ALL SELECT 'short_loads', COUNT(*) FROM batch_runs WHERE status = 'SUCCESS' AND rows_loaded < rows_sent UNION ALL SELECT 'negative_balances', COUNT(*) FROM loans WHERE outstanding < 0;`,
          `SELECT 'orphan_activities' AS check_name, COUNT(*) AS rows_tested, SUM(CASE WHEN l.loan_id IS NULL THEN 1 ELSE 0 END) AS failed_rows FROM collection_activities a LEFT JOIN loans l ON l.loan_id = a.loan_id UNION ALL SELECT 'ptp_missing_fields', COUNT(*), SUM(CASE WHEN ptp_date IS NULL OR ptp_amount IS NULL THEN 1 ELSE 0 END) FROM collection_activities WHERE result = 'PTP' UNION ALL SELECT 'bad_payments', COUNT(*), SUM(CASE WHEN amount <= 0 THEN 1 ELSE 0 END) FROM payments UNION ALL SELECT 'short_loads', COUNT(*), SUM(CASE WHEN rows_loaded < rows_sent THEN 1 ELSE 0 END) FROM batch_runs UNION ALL SELECT 'negative_balances', COUNT(*), SUM(CASE WHEN outstanding < 0 THEN 1 ELSE 0 END) FROM loans;`,
          `SELECT 'orphan_activities' AS check_name, COUNT(*) AS rows_tested, SUM(CASE WHEN l.loan_id IS NULL THEN 1 ELSE 0 END) AS failed_rows FROM collection_activities a LEFT JOIN loans l ON l.loan_id = a.loan_id UNION ALL SELECT 'ptp_missing_fields', COUNT(*), SUM(CASE WHEN ptp_date IS NULL OR ptp_amount IS NULL THEN 1 ELSE 0 END) FROM collection_activities WHERE result = 'PTP' UNION ALL SELECT 'bad_payments', COUNT(*), SUM(CASE WHEN amount < 0 THEN 1 ELSE 0 END) FROM payments UNION ALL SELECT 'short_loads', COUNT(*), SUM(CASE WHEN rows_loaded < rows_sent THEN 1 ELSE 0 END) FROM batch_runs WHERE status = 'SUCCESS' UNION ALL SELECT 'negative_balances', COUNT(*), SUM(CASE WHEN outstanding < 0 THEN 1 ELSE 0 END) FROM loans;`,
          `SELECT 'orphan_activities' AS check_name, COUNT(*) AS rows_tested, SUM(CASE WHEN l.loan_id IS NULL THEN 1 ELSE 0 END) AS failed_rows FROM collection_activities a LEFT JOIN loans l ON l.loan_id = a.loan_id UNION ALL SELECT 'ptp_missing_fields', COUNT(*), SUM(CASE WHEN ptp_date IS NULL OR ptp_amount IS NULL THEN 1 ELSE 0 END) FROM collection_activities WHERE result = 'ptp' UNION ALL SELECT 'bad_payments', COUNT(*), SUM(CASE WHEN amount <= 0 THEN 1 ELSE 0 END) FROM payments UNION ALL SELECT 'short_loads', COUNT(*), SUM(CASE WHEN rows_loaded < rows_sent THEN 1 ELSE 0 END) FROM batch_runs WHERE status = 'SUCCESS' UNION ALL SELECT 'negative_balances', COUNT(*), SUM(CASE WHEN outstanding < 0 THEN 1 ELSE 0 END) FROM loans;`
        ],
        traps: [
          { re: /^(?![\s\S]*\b(CASE|SELECT\s+COUNT\s*\(\s*\*\s*\)\s+FROM\s+\w+\s+WHERE|SUM\s*\(\s*\w+\s*(<|>)|COUNT\s*\(\s*\*\s*\)\s*-\s*COUNT)\b)/i, msg: 'Each line needs two numbers. Use <code>COUNT(*)</code> for the rows tested and <code>SUM(CASE WHEN ... THEN 1 ELSE 0 END)</code> for the failures.' },
          { re: /amount\s*<\s*0\b/i, msg: '<code>bad_payments</code> means at or below zero, so use <code>&lt;=</code>.' },
          { re: /LEFT\s+JOIN/i, msg: 'For <code>orphan_activities</code>, <code>COUNT(*)</code> is correct even after a LEFT JOIN, because every activity is a row tested. If a number is off, look at the other checks.' },
          { re: /LEFT\s+JOIN/i, msg: 'To find the check that is off, run each <code>SELECT</code> alone and compare its number with what you found in its own mission.' }
        ],
        hints: [
          `Write each check as its own small query with a label, <code>COUNT(*)</code> and a <code>SUM(CASE ...)</code>. You wrote most of the tests earlier in this level, so reuse them.`,
          `The first <code>SELECT</code> names the columns: <code>AS check_name</code>, <code>AS rows_tested</code> and <code>AS failed_rows</code>. Only a filter that sets the population, such as PTP rows, stays in <code>WHERE</code>.`,
          `Put <code>UNION ALL</code> between the five queries, with one semicolon at the very end.`
        ],
        pattern: { sql: `SELECT 'check_one' AS check_name,\n  COUNT(*) AS rows_tested,\n  SUM(CASE WHEN ... THEN 1 ELSE 0 END) AS failed_rows\nFROM table_a\nUNION ALL\nSELECT 'check_two',\n  COUNT(*),\n  SUM(CASE WHEN ... THEN 1 ELSE 0 END)\nFROM table_b;`, note: 'A test pack: one row per check, rows tested beside rows failed' },
        win: `This is your [[regression test]]. After a release, one query tells you what is still broken, what got fixed, and whether a check that was passing has started to fail.`
      },
      {
        id: '7.28',
        type: 'quiz',
        title: 'From query to defect report',
        newIdea: 'A good defect report lets someone else reproduce the problem with no follow-up questions.',
        teach: `<p>A developer has to act on what you write. A good [[defect]] report gives what was expected, what actually happened, how many rows are affected, a few sample IDs, and the exact query, so anyone can rerun it.</p><p>Report what you can prove. You may add a clue if you label it as a clue, such as "all four are dated 2026-10-05". Do not state a cause you have not proven.</p>`,
        bridge: 'Like an audit finding, which gives the criteria, the condition, the evidence and how many items were affected.',
        question: `You found the short-load runs from this query. Which report should you send to IT?`,
        code: `SELECT run_id, run_date, feed_name, rows_sent, rows_loaded\nFROM batch_runs\nWHERE status = 'SUCCESS'\n  AND rows_loaded < rows_sent;`,
        showCodeResult: true,
        check: { sql: `SELECT COUNT(*) FROM batch_runs WHERE status = 'SUCCESS' AND rows_loaded < rows_sent`, equals: 5 },
        choices: [
          { t: 'Expected: rows_loaded equals rows_sent on every SUCCESS run. Actual: 5 of 604 SUCCESS runs are short, 15 rows lost in total. Sample run_ids: 83, 277, 306, 527, 558. Query attached. Data as of 2026-10-31.', correct: true, why: 'Yes. It states the rule, the actual result, the count and sample IDs, and it comes with the query, so IT can rerun it and start work straight away.' },
          { t: 'The batch is broken and the numbers are wrong. Please fix urgently.', why: 'This gives IT nothing to act on: no rule, no count and no IDs. Someone will have to come back and ask you for all of it.' },
          { t: 'Query attached. Please check the result.', why: 'The query helps, but the reader has to guess what you expected and what looks wrong. Say both.' },
          { t: 'Run 83 loaded 540 of 542 rows. Please look at it.', why: 'This is specific and true, but it hides the other four runs. Someone could fix one run and close the ticket while the problem continues.' },
          { t: 'The load job has a bug that skips bad records. Please patch the job. 5 runs affected.', why: 'You can prove rows are missing. You cannot yet prove why, and a guessed cause can send the investigation the wrong way. Report the facts and let the cause come from the investigation.' }
        ],
        win: `A clear defect gets fixed faster, and it builds your name as the analyst whose tickets are always right. Save the query with the ticket, so it can be the retest once the fix goes in.`
      },
      {
        id: '7.29',
        checkpoint: true,
        title: 'Checkpoint: a check from a spec',
        newIdea: 'Turn a written spec into a query on your own.',
        from: 'Wulan, Internal Audit',
        teach: `<p>This is the job in one mission. A spec arrives. You turn each rule into a test, decide what failure looks like, and return the failing rows with a clear label.</p><p>Read the rules one at a time. Two small queries stacked together often read better than one clever query.</p>`,
        bridge: 'Like an audit program: each test step has its own criteria, and each exception is listed with the test it failed.',
        task: `Spec for loans with status Written Off. Rule 1: <code>write_off_date</code> must be filled. Rule 2: the loan must have an active assignment (<code>unassigned_date</code> NULL), because collection continues. Return one row per failure: <code>loan_id</code> and <code>failed_rule</code>, with the exact text <code>No write-off date</code> or <code>No active collector</code>.`,
        solution: `SELECT loan_id, 'No write-off date' AS failed_rule
FROM loans
WHERE status = 'Written Off'
  AND write_off_date IS NULL
UNION ALL
SELECT l.loan_id, 'No active collector'
FROM loans l
LEFT JOIN loan_assignments g
  ON g.loan_id = l.loan_id
  AND g.unassigned_date IS NULL
WHERE l.status = 'Written Off'
  AND g.assignment_id IS NULL;`,
        altSolutions: [
          `SELECT loan_id, 'No write-off date' AS failed_rule
FROM loans
WHERE status = 'Written Off'
  AND write_off_date IS NULL
UNION ALL
SELECT loan_id, 'No active collector'
FROM loans
WHERE status = 'Written Off'
  AND loan_id NOT IN (
    SELECT loan_id
    FROM loan_assignments
    WHERE unassigned_date IS NULL
  );`,
          `SELECT loan_id, 'No write-off date' AS failed_rule
FROM loans
WHERE status = 'Written Off'
  AND write_off_date IS NULL
UNION ALL
SELECT l.loan_id, 'No active collector'
FROM loans l
WHERE l.status = 'Written Off'
  AND NOT EXISTS (
    SELECT 1
    FROM loan_assignments g
    WHERE g.loan_id = l.loan_id
      AND g.unassigned_date IS NULL
  );`
        ],
        requires: [
          { re: /unassigned_date/i, msg: 'Rule 2 is about an active assignment, so test <code>unassigned_date</code>. A loan whose last collector was removed also fails, even though this data has no such loan today.' },
          { re: /\bUNION\b/i, msg: 'The right rows for today. The spec asks for one row per failure, and a loan failing both rules needs two rows. This shape can only give one, so write one query per rule and stack them with <code>UNION ALL</code>.' }
        ],
        wrong: [
          `SELECT loan_id, 'No write-off date' AS failed_rule FROM loans WHERE status = 'Written Off' AND write_off_date IS NULL;`,
          `SELECT loan_id, 'No write-off date' AS failed_rule FROM loans WHERE status = 'Written Off' AND write_off_date IS NULL UNION ALL SELECT l.loan_id, 'No active collector' FROM loans l JOIN loan_assignments g ON g.loan_id = l.loan_id AND g.unassigned_date IS NULL WHERE l.status = 'Written Off' AND g.assignment_id IS NULL;`,
          `SELECT loan_id, 'No write-off date' AS failed_rule FROM loans WHERE status = 'Written Off' AND write_off_date IS NULL UNION ALL SELECT l.loan_id, 'No active collector' FROM loans l LEFT JOIN loan_assignments g ON g.loan_id = l.loan_id WHERE l.status = 'Written Off' AND g.unassigned_date IS NULL;`,
          `SELECT loan_id, 'No write-off date' AS failed_rule FROM loans WHERE write_off_date IS NULL UNION ALL SELECT l.loan_id, 'No active collector' FROM loans l LEFT JOIN loan_assignments g ON g.loan_id = l.loan_id AND g.unassigned_date IS NULL WHERE l.status = 'Written Off' AND g.assignment_id IS NULL;`,
          `SELECT loan_id, 'No write-off date' AS failed_rule FROM loans WHERE status = 'Written Off' AND write_off_date IS NULL UNION ALL SELECT l.loan_id, 'No active collector' FROM loans l LEFT JOIN loan_assignments g ON g.loan_id = l.loan_id WHERE l.status = 'Written Off' AND g.assignment_id IS NULL;`,
          `SELECT loan_id, 'No write-off date' AS failed_rule FROM loans WHERE status = 'Written Off' AND write_off_date IS NULL UNION ALL SELECT loan_id, 'No active collector' FROM loans WHERE status = 'Written Off' AND loan_id NOT IN (SELECT loan_id FROM loan_assignments);`,
          `SELECT l.loan_id, CASE WHEN l.write_off_date IS NULL THEN 'No write-off date' ELSE 'No active collector' END AS failed_rule FROM loans l LEFT JOIN loan_assignments g ON g.loan_id = l.loan_id AND g.unassigned_date IS NULL WHERE l.status = 'Written Off' AND (l.write_off_date IS NULL OR g.assignment_id IS NULL);`
        ],
        traps: [
          { re: /^(?![\s\S]*No active collector)/i, msg: 'The spec has two rules, and this only tests one. Add a test for loans with no active assignment.' },
          { re: /^(?![\s\S]*No write-off date)/i, msg: 'The spec has two rules, and this only tests one. Add a test for a missing <code>write_off_date</code>.' },
          { re: /LEFT\s+JOIN(?:(?!\bUNION\b)[\s\S])*\bWHERE(?:(?!\bUNION\b)[\s\S])*\bunassigned_date\s+IS\s+NULL/i, msg: 'After a LEFT JOIN, the active test belongs in the <code>ON</code>. In <code>WHERE</code>, it keeps loans that do have a collector.' },
          { re: /(?<!LEFT\s)(?<!OUTER\s)\bJOIN\s+loan_assignments\b/i, msg: 'A plain <code>JOIN</code> drops loans with no active assignment, and those are the failures you want. Use <code>LEFT JOIN</code>.' },
          { re: /FROM\s+loans(\s+l)?\s+WHERE\s+(l\.)?write_off_date\s+IS\s+NULL/i, msg: 'Rule 1 applies only to Written Off loans. Other loans are meant to have no write-off date.' }
        ],
        hints: [
          'Write one query per rule, then stack them.',
          'Each query selects <code>loan_id</code> and a fixed text label, with <code>UNION ALL</code> between them. Rule 1 is one table and two <code>WHERE</code> tests.',
          `Rule 2 is the anti-join you wrote for overdue loans: <code>LEFT JOIN loan_assignments g ON g.loan_id = l.loan_id AND g.unassigned_date IS NULL</code>, then <code>WHERE l.status = 'Written Off' AND g.assignment_id IS NULL</code>.`
        ],
        pattern: { sql: `SELECT id, 'Rule one failed' AS failed_rule\nFROM table_name\nWHERE ...\nUNION ALL\nSELECT id, 'Rule two failed'\nFROM table_name\nWHERE ...;`, note: 'One row per failure, labeled by rule' },
        win: `Loans 9 and 258 have no write-off date, and loan 140 has nobody collecting on it. Level 7 cleared: you can take a written rule, prove whether a system follows it, and hand over evidence people can act on.`
      }
    ]
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
