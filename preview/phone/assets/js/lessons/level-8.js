/* Level 8: change data safely, make queries fast, and think like an engineer. */
(function (root) {
  const KOL_RULE = `CASE
    WHEN dpd = 0 THEN 1
    WHEN dpd <= 90 THEN 2
    WHEN dpd <= 120 THEN 3
    WHEN dpd <= 180 THEN 4
    ELSE 5
  END`;

  (root.KENARI_LEVELS = root.KENARI_LEVELS || []).push({
    n: 8,
    title: 'Pro Toolkit',
    rank: 'Database Operator',
    tagline: 'Change data safely, make queries fast, think like an engineer.',
    goal: 'Change data with a safety net, read a query plan, review SQL like a senior and behave well around production.',
    terms: {
      'temp table': 'A table that lasts until you disconnect from the database, then disappears. Good for saving a working list.',
      'constraint': 'A rule on a table that the database enforces, refusing any row that breaks it.',
      'query plan': 'The route the database chooses to answer a query, such as reading a whole table or using an index.',
      'sargable': 'A filter an index can use, because it compares the bare column. Short for "search argument able".',
      'cross-tab': 'A table with one kind of value down the side and another across the top, like a PivotTable.',
      'hierarchy': 'A tree of who or what sits under whom, such as staff under their managers.',
      'normalized': 'Tables designed so each fact is stored in one place, and other tables point to it with a key.',
      'SQL injection': 'An attack where text typed into an app gets run as part of a SQL query.',
      'parameter': 'A value sent to the database separately from the SQL text, so it can only ever be treated as data.',
      'production': 'The live system, with real customers and real money.',
      'staging': 'A copy of the system kept for testing, separate from production.',
      'read-only': 'A login that can look at data but cannot change it.',
      'audit trail': 'A record of who changed what, when and why.',
      'change process': 'The bank\'s steps for changing a live system: a written request, a review, approval, testing, then a logged release.'
    },
    lessons: [
      /* ---------- Changing data ---------- */
      {
        id: '8.1',
        mode: 'state',
        title: 'Save a working list',
        newIdea: 'CREATE TEMP TABLE saves a query result as a table you can query again.',
        from: 'Yusuf, Field team lead',
        teach: `<p>So far, every result has disappeared once you moved on. A [[temp table]] keeps a result until you disconnect from the database, so you can query it again and again.</p><p>Write <code>CREATE TEMP TABLE name AS</code>, then a normal SELECT. A semicolon ends one statement, so you can press Run once for both. Here the first statement saves the list and the second reads it. In this lab, each press of Run starts from a clean copy, so create the table and query it together.</p>`,
        ex: [
          ['CREATE TEMP TABLE feed_problems AS', 'Make a temporary table called feed_problems, filled with'],
          ['SELECT run_date, feed_name, rows_sent, rows_loaded', 'these four columns'],
          ['FROM batch_runs', 'from the batch_runs table,'],
          ['WHERE rows_loaded <> rows_sent;', 'keeping only runs that lost rows,'],
          ['SELECT *', 'then show every column'],
          ['FROM feed_problems;', 'of the new table.']
        ],
        exState: true,
        bridge: 'Like pasting a filtered list as values into a new sheet, so you can work on it and leave the source alone.',
        task: `I want this week's visit list to stay fixed while I work on it. Save every Kol 4 loan that is not Written Off into a temp table named <code>field_list</code>, with loan_id, customer_id and outstanding. Then SELECT from <code>field_list</code>, and press Run once for both.`,
        solution: `CREATE TEMP TABLE field_list AS
SELECT loan_id, customer_id, outstanding
FROM loans
WHERE collectibility = 4
  AND status <> 'Written Off';

SELECT *
FROM field_list;`,
        stateQuery: `SELECT * FROM field_list`,
        requires: [
          { re: /\bTEMP(ORARY)?\s+TABLE\b/i, msg: 'The list is right. This mission asks for a temp table, so write <code>CREATE TEMP TABLE</code>. A normal table stays behind and clutters the database.' },
          { re: /\bFROM\s+field_list\b/i, msg: 'The table is saved. Now use it: add a second query that reads <code>FROM field_list</code>.' },
          { re: /\bstatus\b/i, msg: 'The list matches only because no Kol 4 loan is Written Off today. The request leaves them out, so filter on <code>status</code> as well.' }
        ],
        altSolutions: [
          `CREATE TEMPORARY TABLE field_list AS SELECT loan_id, customer_id, outstanding FROM loans WHERE collectibility = 4 AND status <> 'Written Off'; SELECT COUNT(*), SUM(outstanding) FROM field_list;`,
          `CREATE TEMP TABLE field_list AS SELECT customer_id, loan_id, outstanding FROM loans WHERE collectibility = 4 AND status IN ('Active', 'Restructured'); SELECT * FROM field_list ORDER BY outstanding DESC;`
        ],
        wrong: [
          `CREATE TEMP TABLE field_list AS SELECT loan_id, customer_id, outstanding FROM loans WHERE collectibility = 4; SELECT * FROM field_list;`,
          `CREATE TABLE field_list AS SELECT loan_id, customer_id, outstanding FROM loans WHERE collectibility = 4 AND status <> 'Written Off'; SELECT * FROM field_list;`,
          `SELECT loan_id, customer_id, outstanding FROM loans WHERE collectibility = 4 AND status <> 'Written Off';`,
          `CREATE TEMP TABLE field_list AS SELECT * FROM loans WHERE collectibility = 4 AND status <> 'Written Off'; SELECT * FROM field_list;`,
          `CREATE TEMP TABLE field_list AS SELECT loan_id, customer_id, outstanding FROM loans WHERE collectibility = 5 AND status <> 'Written Off'; SELECT * FROM field_list;`
        ],
        traps: [
          { re: /\bTABLE\s+\w+\s+SELECT\b/i, msg: 'Put <code>AS</code> between the table name and the SELECT.' },
          { re: /\bAS\s+SELECT\s+\*/i, msg: 'The request names three columns, so list them in place of <code>*</code>.' }
        ],
        hints: [
          `This takes two statements with a semicolon between them. The first saves the list, and the second reads it.`,
          `Filter with <code>collectibility = 4</code> and <code>status &lt;&gt; 'Written Off'</code>.`,
          `Start with <code>CREATE TEMP TABLE field_list AS</code>, then your SELECT and a semicolon. Finish with <code>SELECT * FROM field_list;</code>`
        ],
        win: `Temp tables split a hard job into saved steps and never touch the real data. A temp table is a frozen copy, so it will not pick up changes made after you created it.`,
        atWork: `PostgreSQL and BigQuery scripts also use <code>CREATE TEMP TABLE</code>. SQL Server uses <code>SELECT ... INTO #name</code>. Oracle has <code>CREATE GLOBAL TEMPORARY TABLE</code>. Many banks limit who can create tables, so ask what your login allows.`,
        pattern: { sql: `CREATE TEMP TABLE my_list AS\nSELECT col_a, col_b\nFROM table_name\nWHERE condition;\n\nSELECT *\nFROM my_list;`, note: 'Save a result and query it again' }
      },
      {
        id: '8.2',
        mode: 'state',
        title: 'Add a row with INSERT',
        newIdea: 'INSERT INTO adds a new row to a table.',
        from: 'Maya, UAT lead',
        teach: `<p><code>INSERT INTO</code> adds a row. Name the columns, then give the values in the same order after <code>VALUES</code>. Text and dates go in single quotes, and numbers do not.</p><p>In [[UAT]] you often need a test row with exact values, so you can watch what the system does with it.</p><p>The starter already makes an empty test table. You will write one like it yourself later in this level.</p>`,
        ex: [
          ['INSERT INTO branches (branch_id, branch_name, city, region)', 'Add a row to branches, filling these four columns'],
          [`VALUES (13, 'KCP Test UAT', 'Jakarta', 'Jabodetabek');`, 'with these four values in the same order,'],
          ['SELECT branch_id, branch_name', 'then show the ID and name'],
          ['FROM branches', 'from branches'],
          ['WHERE branch_id >= 12;', 'for the last real branch and the new one.']
        ],
        exState: true,
        bridge: 'Like typing a new line at the bottom of a sheet, one value per column.',
        task: `I need one test loan in <code>uat_loans</code> to check the desk call screen: loan_id 900001, product KTA, outstanding 10000000, dpd 45. Keep the CREATE line and add your INSERT under it.`,
        starter: `-- This line makes an empty test table. Keep it.\nCREATE TEMP TABLE uat_loans (loan_id INTEGER, product TEXT, outstanding INTEGER, dpd INTEGER);\n\n-- Write your INSERT below.\n`,
        solution: `CREATE TEMP TABLE uat_loans (loan_id INTEGER, product TEXT, outstanding INTEGER, dpd INTEGER);

INSERT INTO uat_loans (loan_id, product, outstanding, dpd)
VALUES (900001, 'KTA', 10000000, 45);`,
        stateQuery: `SELECT loan_id, product, outstanding, dpd, (SELECT COUNT(*) FROM uat_loans) AS rows_in_uat_loans, (SELECT COUNT(*) FROM loans) AS real_loans FROM uat_loans WHERE dpd < 1000`,
        noTarget: true,
        altSolutions: [
          `CREATE TEMP TABLE uat_loans (loan_id INTEGER, product TEXT, outstanding INTEGER, dpd INTEGER); INSERT INTO uat_loans VALUES (900001, 'KTA', 10000000, 45);`,
          `CREATE TEMP TABLE uat_loans (loan_id INTEGER, product TEXT, outstanding INTEGER, dpd INTEGER); INSERT INTO uat_loans (dpd, outstanding, product, loan_id) VALUES (45, 10000000, 'KTA', 900001); SELECT * FROM uat_loans;`
        ],
        wrong: [
          `CREATE TEMP TABLE uat_loans (loan_id INTEGER, product TEXT, outstanding INTEGER, dpd INTEGER);`,
          `CREATE TEMP TABLE uat_loans (loan_id INTEGER, product TEXT, outstanding INTEGER, dpd INTEGER); INSERT INTO uat_loans (loan_id, product, outstanding, dpd) VALUES (900001, 'KTA', 45, 10000000);`,
          `CREATE TEMP TABLE uat_loans (loan_id INTEGER, product TEXT, outstanding INTEGER, dpd INTEGER); INSERT INTO uat_loans (loan_id, product, outstanding, dpd) VALUES (900001, KTA, 10000000, 45);`,
          `INSERT INTO uat_loans (loan_id, product, outstanding, dpd) VALUES (900001, 'KTA', 10000000, 45);`,
          `CREATE TEMP TABLE uat_loans (loan_id INTEGER, product TEXT, outstanding INTEGER, dpd INTEGER); INSERT INTO uat_loans (loan_id, product, outstanding, dpd) VALUES (900001, 'KTA', 10000000, 45), (900001, 'KTA', 10000000, 45);`,
          `CREATE TEMP TABLE uat_loans (loan_id INTEGER, product TEXT, outstanding INTEGER, dpd INTEGER); INSERT INTO uat_loans VALUES (900001, 'KTA', 10000000, 45), (900002, 'KTA', 1, 5000);`,
          `CREATE TEMP TABLE uat_loans (loan_id INTEGER, product TEXT, outstanding INTEGER, dpd INTEGER); INSERT INTO uat_loans VALUES (900001, 'KTA', 10000000, 45); DELETE FROM loans;`
        ],
        traps: [
          { re: /\bVALUES\s*\(\s*900001\s*,\s*'KTA'\s*,\s*45\b/i, msg: 'Values go in the same order as the columns. Outstanding comes before dpd, so these two are swapped.' },
          { re: /\bINSERT\s+INTO\s+loans\b/i, msg: 'That adds a row to the real <code>loans</code> table. This test row belongs in <code>uat_loans</code>.' },
          { re: /^(?![\s\S]*\bCREATE\s+TEMP\s+TABLE\b)/i, msg: 'Keep the CREATE line from the starter. Each press of Run starts clean, so the table has to be made in the same go.' },
          { re: /\)\s*,\s*\(/, msg: 'One test row is enough here, so give <code>VALUES</code> one set of brackets.' },
          { re: /^(?![\s\S]*\bINSERT\b)/i, msg: 'The table is still empty. Add an <code>INSERT INTO uat_loans</code> statement under the CREATE line.' }
        ],
        hints: [
          `You need two parts: the columns you are filling, and the values for them.`,
          `Start with <code>INSERT INTO uat_loans (loan_id, product, outstanding, dpd)</code>.`,
          `The next line is <code>VALUES (900001, 'KTA', 10000000, 45);</code>`
        ],
        win: `Test rows with known values let you say exactly what the screen should show. That is how a UAT case gets a clear pass or fail.`,
        pattern: { sql: `INSERT INTO table_name (col_a, col_b)\nVALUES (1, 'text');`, note: 'Add a row' }
      },
      {
        id: '8.3',
        mode: 'state',
        title: 'Change a row with UPDATE',
        newIdea: 'UPDATE changes existing rows, and its WHERE decides which ones.',
        from: 'Maya, UAT lead',
        teach: `<p><code>UPDATE</code> changes rows that already exist. <code>SET</code> gives the new value and <code>WHERE</code> says which rows.</p><p><b>Forget the WHERE and every row changes.</b> The database gives no warning. On <code>loans</code>, that is 502 rows in one go, so write the WHERE with care and check it finds the row you mean.</p>`,
        ex: [
          ['UPDATE collectors', 'In the collectors table,'],
          [`SET team = 'Field'`, 'set the team to Field'],
          ['WHERE collector_id = 33;', 'on collector 33 only,'],
          ['SELECT collector_id, collector_name, team', 'then show the ID, name and team'],
          ['FROM collectors', 'from collectors'],
          ['WHERE collector_id = 33;', 'to confirm that one row changed.']
        ],
        exState: true,
        bridge: 'Like filtering to one row and typing a new value in the cell. With no filter, it is pasting that value down the whole column.',
        task: `Loan 84 is 99 days past due, but <code>loans</code> stores it as Kol 2. The rule says 91 to 120 days is [[Kol 3]]. On this test copy, set its <code>collectibility</code> to 3 and change nothing else. I will rerun my rule check afterwards.`,
        solution: `UPDATE loans
SET collectibility = 3
WHERE loan_id = 84;`,
        stateQuery: `SELECT (SELECT collectibility FROM loans WHERE loan_id = 84) AS kol_84, SUM(collectibility) - 769 AS kol_points_added, 502 - COUNT(*) AS loans_removed, SUM(dpd) - 20995 AS dpd_change, SUM(outstanding) - 34674175000 AS balance_change, SUM(status = 'Active') - 455 AS active_change FROM loans`,
        noTarget: true,
        altSolutions: [
          `UPDATE loans SET collectibility = 3 WHERE loan_id = 84; SELECT * FROM loans WHERE loan_id = 84;`,
          `SELECT * FROM loans WHERE loan_id = 84; UPDATE loans SET collectibility = 3 WHERE loan_id = 84 AND collectibility = 2;`
        ],
        wrong: [
          `UPDATE loans SET collectibility = 3;`,
          `UPDATE loans SET collectibility = 3 WHERE dpd = 99;`,
          `UPDATE loans SET collectibility = 3 WHERE loan_id = 331;`,
          `UPDATE loans SET dpd = 90 WHERE loan_id = 84;`,
          `SELECT * FROM loans WHERE loan_id = 84;`,
          `UPDATE loans SET collectibility = 3 WHERE loan_id IN (84, 331);`,
          `UPDATE loans SET collectibility = 3, outstanding = 0 WHERE loan_id = 84;`,
          `UPDATE loans SET collectibility = 3, status = 'Written Off' WHERE loan_id = 84;`,
          `UPDATE loans SET collectibility = 3 WHERE loan_id = 84; UPDATE loans SET outstanding = 0;`,
          `UPDATE loans SET collectibility = 3 WHERE loan_id = 84; DELETE FROM loans WHERE loan_id = 1;`
        ],
        traps: [
          { re: /\bUPDATE\b(?![\s\S]*\bWHERE\b)/i, msg: 'This UPDATE has no <code>WHERE</code>, so it changed every loan in the table. Add one that picks only loan 84.' },
          { re: /\bWHERE\s+dpd\b/i, msg: 'Another loan also has 99 DPD, so this catches more than loan 84. Use the ID, which is unique: <code>loan_id = 84</code>.' },
          { re: /\bSET\s+dpd\b/i, msg: 'The DPD is correct, and the grade is the wrong value. Change <code>collectibility</code>.' },
          { re: /\bloan_id\s*=\s*(?!84\b)\d+/i, msg: 'That is a different loan. This request is about loan 84.' },
          { re: /\bloan_id\s+IN\b/i, msg: 'This changes more than one loan. The request is about loan 84 only.' },
          { re: /\bSET\s+\w+\s*=[^;]*,\s*\w+\s*=/i, msg: 'The request changes one column only, so set <code>collectibility</code> and leave the others alone.' },
          { re: /^(?![\s\S]*\bUPDATE\b)/i, msg: 'A SELECT only reads, so the grade has not changed yet. Write an <code>UPDATE</code>.' }
        ],
        hints: [
          `Three parts: which table, what new value, which row.`,
          `<code>loan_id</code> is unique, so it picks exactly one row.`,
          `<code>UPDATE loans SET collectibility = 3 WHERE ...</code> and finish it with loan 84's ID.`
        ],
        win: `Many pros first write the WHERE as a SELECT, read the rows, then turn it into an UPDATE. One missing line is how whole tables get overwritten.`,
        pattern: { sql: `UPDATE table_name\nSET col_a = 'new value'\nWHERE id_col = 123;`, note: 'Change a row. Never forget the WHERE' }
      },
      {
        id: '8.4',
        mode: 'state',
        title: 'DELETE, with a SELECT first',
        newIdea: 'Before any DELETE, run a SELECT with the same WHERE and read what it finds.',
        from: 'Maya, UAT lead',
        teach: `<p><code>DELETE FROM</code> removes whole rows. Like UPDATE, with no WHERE it hits every row in the table.</p><p>The habit that protects you is to <b>SELECT first</b>. Write a SELECT with your WHERE and read the rows it returns. Then change the first line to DELETE and keep the same WHERE. If the SELECT looks wrong, nothing has been lost.</p>`,
        ex: [
          ['SELECT payment_id, amount', 'First look at the ID and amount'],
          ['FROM payments', 'in payments'],
          ['WHERE amount <= 0;', 'for rows at or below zero,'],
          ['DELETE FROM payments', 'then remove from payments'],
          ['WHERE amount <= 0;', 'those same rows.']
        ],
        exState: true,
        exNote: `The rows shown are the ones the SELECT found, before the DELETE removed them. Here both statements run together so you can see the pattern. At work, run the SELECT by itself first, and write the DELETE only after you have read the rows.`,
        bridge: 'Like filtering a sheet and reading the visible rows before you delete them.',
        task: `Three test activities point to loans that do not exist, the [[orphan]] rows from Level 7. On this test copy, run a SELECT of them alone and read the rows. Then add the DELETE under it, with the same WHERE, and press Run again. Leave every other activity in place.`,
        solution: `SELECT activity_id, loan_id
FROM collection_activities
WHERE loan_id NOT IN (SELECT loan_id FROM loans);

DELETE FROM collection_activities
WHERE loan_id NOT IN (SELECT loan_id FROM loans);`,
        stateQuery: `SELECT (2166 - COUNT(*)) || ' removed, ' || SUM(CASE WHEN loan_id NOT IN (SELECT loan_id FROM loans) THEN 1 ELSE 0 END) || ' orphans left' AS outcome FROM collection_activities`,
        requires: [
          { re: /\bSELECT\b[^;]*\bFROM\s+collection_activities\b[^;]*;[\s\S]*\bDELETE\b/i, msg: 'The right rows are gone. Now build the habit: put a SELECT from <code>collection_activities</code> with the same WHERE above the DELETE, as its own statement, so you see the rows first.' }
        ],
        altSolutions: [
          `SELECT * FROM collection_activities a WHERE NOT EXISTS (SELECT 1 FROM loans l WHERE l.loan_id = a.loan_id); DELETE FROM collection_activities WHERE NOT EXISTS (SELECT 1 FROM loans l WHERE l.loan_id = collection_activities.loan_id);`,
          `SELECT a.activity_id FROM collection_activities a LEFT JOIN loans l ON l.loan_id = a.loan_id WHERE l.loan_id IS NULL; DELETE FROM collection_activities WHERE loan_id IN (90001, 90002, 90003);`,
          `SELECT * FROM collection_activities WHERE activity_id IN (2164, 2165, 2166); DELETE FROM collection_activities WHERE activity_id IN (2164, 2165, 2166);`,
          `SELECT * FROM collection_activities WHERE loan_id >= 90000; DELETE FROM collection_activities WHERE loan_id >= 90000;`
        ],
        wrong: [
          `SELECT * FROM collection_activities WHERE loan_id NOT IN (SELECT loan_id FROM loans); DELETE FROM collection_activities;`,
          `DELETE FROM collection_activities WHERE loan_id NOT IN (SELECT loan_id FROM loans);`,
          `SELECT * FROM collection_activities WHERE loan_id NOT IN (SELECT loan_id FROM loans);`,
          `SELECT * FROM collection_activities WHERE loan_id IN (SELECT loan_id FROM loans); DELETE FROM collection_activities WHERE loan_id IN (SELECT loan_id FROM loans);`,
          `SELECT COUNT(*) FROM loans; DELETE FROM collection_activities WHERE loan_id NOT IN (SELECT loan_id FROM loans);`,
          `WITH o AS (SELECT loan_id FROM loans) DELETE FROM collection_activities WHERE loan_id NOT IN (SELECT loan_id FROM o);`,
          `SELECT * FROM collection_activities WHERE loan_id NOT IN (SELECT loan_id FROM loans); DELETE FROM collection_activities WHERE 1 = 0;`
        ],
        traps: [
          { re: /\bDELETE\b(?![\s\S]*\bWHERE\b)/i, msg: 'This DELETE has no <code>WHERE</code>, so it removes every row. Reuse the WHERE from your SELECT.' },
          { re: /\bDELETE\b[^;]*\bJOIN\b/i, msg: 'A SQLite DELETE cannot use JOIN. Use a subquery in the WHERE: <code>loan_id NOT IN (SELECT loan_id FROM loans)</code>.' },
          { re: /^(?![\s\S]*\bDELETE\b)/i, msg: 'You have looked at the rows. Now add the <code>DELETE</code> underneath, with the same WHERE.' },
          { re: /\bloan_id\s+IN\s*\(\s*SELECT\b/i, msg: 'Check the direction. <code>IN</code> finds activities whose loan exists, and you want the ones whose loan does not.' }
        ],
        hints: [
          `An orphan's <code>loan_id</code> is not found in the <code>loans</code> table. You wrote this check in Level 7.`,
          `<code>WHERE loan_id NOT IN (SELECT loan_id FROM loans)</code> finds them. It should return 3 rows.`,
          `Write the SELECT with that WHERE, add a semicolon, then <code>DELETE FROM collection_activities</code> with the same WHERE.`
        ],
        win: `SELECT first takes seconds and catches the worst mistakes before they happen. The count you read is also evidence, so you can report "3 rows expected, 3 rows removed".`,
        pattern: { sql: `SELECT *\nFROM table_name\nWHERE condition;  -- read these rows first\n\nDELETE FROM table_name\nWHERE condition;  -- same WHERE`, note: 'SELECT first, then DELETE' }
      },
      {
        id: '8.5',
        mode: 'state',
        title: 'Remove duplicates, keep one',
        newIdea: 'To remove duplicates, name the row to keep in each group and delete all the others.',
        from: 'Fitri, Desk Call lead',
        teach: `<p>DELETE needs to know which copy to keep. A subquery can name the keepers. <code>MIN(id)</code> with <code>GROUP BY</code> gives one ID per group, and <code>NOT IN</code> then removes everything else.</p><p>Group by every column that makes two rows "the same". Miss one, and you delete rows that were real.</p>`,
        ex: [
          ['CREATE TEMP TABLE sms_log (sms_id INTEGER, loan_id INTEGER, sent_date TEXT);', 'Make a small test table,'],
          [`INSERT INTO sms_log VALUES (1, 102, '2026-10-01');`, 'add one SMS,'],
          [`INSERT INTO sms_log VALUES (2, 102, '2026-10-01');`, 'add a true copy of it,'],
          [`INSERT INTO sms_log VALUES (3, 102, '2026-10-02');`, 'add a real SMS sent the next day,'],
          ['DELETE FROM sms_log', 'then remove rows from sms_log'],
          ['WHERE sms_id NOT IN (', 'when the ID is not among'],
          ['  SELECT MIN(sms_id)', 'the lowest IDs'],
          ['  FROM sms_log', 'in sms_log,'],
          ['  GROUP BY loan_id, sent_date', 'one per loan and date,'],
          [');', 'which are the keepers,'],
          ['SELECT *', 'and show every column'],
          ['FROM sms_log;', 'of the rows left.']
        ],
        exState: true,
        exNote: `Row 2 repeated row 1 in both columns, so it went. Row 3 has a different date, so it is a real SMS and it stayed. The table had 3 rows, so 2 left means 1 was removed.`,
        bridge: 'Like Remove Duplicates in Excel, where you tick which columns must match and the first row stays.',
        task: `The 11 duplicate activity groups from Level 7 are inflating my counts. On this test copy, keep the lowest <code>activity_id</code> in each group and delete the rest. Rows are duplicates when loan_id, collector_id, activity_date, activity_type and result all match. First run your Level 7 duplicate check, which should show 11 groups. After the DELETE, 2,155 rows should remain.`,
        solution: `DELETE FROM collection_activities
WHERE activity_id NOT IN (
  SELECT MIN(activity_id)
  FROM collection_activities
  GROUP BY loan_id, collector_id, activity_date, activity_type, result
);`,
        stateQuery: `SELECT (2166 - COUNT(*)) || ' removed, ' || SUM(activity_id IN (3, 403, 989, 1433, 1505, 1596, 2159, 2160, 2161, 2162, 2163)) || ' extra copies left' AS outcome FROM collection_activities`,
        altSolutions: [
          `SELECT loan_id, collector_id, activity_date, activity_type, result, COUNT(*) FROM collection_activities GROUP BY 1, 2, 3, 4, 5 HAVING COUNT(*) > 1; DELETE FROM collection_activities WHERE activity_id NOT IN (SELECT MIN(activity_id) FROM collection_activities GROUP BY loan_id, collector_id, activity_date, activity_type, result);`,
          `DELETE FROM collection_activities WHERE activity_id IN (SELECT activity_id FROM (SELECT activity_id, ROW_NUMBER() OVER (PARTITION BY loan_id, collector_id, activity_date, activity_type, result ORDER BY activity_id) AS rn FROM collection_activities) WHERE rn > 1);`,
          `WITH keepers AS (SELECT MIN(activity_id) AS activity_id FROM collection_activities GROUP BY loan_id, collector_id, activity_date, activity_type, result) DELETE FROM collection_activities WHERE activity_id NOT IN (SELECT activity_id FROM keepers);`
        ],
        wrong: [
          `DELETE FROM collection_activities WHERE activity_id NOT IN (SELECT MAX(activity_id) FROM collection_activities GROUP BY loan_id, collector_id, activity_date, activity_type, result);`,
          `DELETE FROM collection_activities WHERE activity_id NOT IN (SELECT MIN(activity_id) FROM collection_activities GROUP BY loan_id, activity_date);`,
          `DELETE FROM collection_activities WHERE activity_id IN (SELECT MIN(activity_id) FROM collection_activities GROUP BY loan_id, collector_id, activity_date, activity_type, result HAVING COUNT(*) > 1);`,
          `DELETE FROM collection_activities WHERE activity_id NOT IN (SELECT MIN(activity_id) FROM collection_activities);`,
          `SELECT loan_id, collector_id, activity_date, activity_type, result, COUNT(*) FROM collection_activities GROUP BY 1, 2, 3, 4, 5 HAVING COUNT(*) > 1;`
        ],
        traps: [
          { re: /\bMAX\s*\(\s*activity_id/i, msg: 'This keeps the highest ID in each group. The request says to keep the lowest, so use <code>MIN</code>.' },
          { re: /\bGROUP\s+BY\b(?!(?=[^)]*\bloan_id\b)(?=[^)]*\bcollector_id\b)(?=[^)]*\bactivity_date\b)(?=[^)]*\bactivity_type\b)(?=[^)]*\bresult\b))/i, msg: 'Group by all five columns named in the request. With fewer, real activities count as duplicates and get deleted.' },
          { re: /\bactivity_id\s+IN\s*\(\s*SELECT\s+MIN/i, msg: 'This deletes the rows you meant to keep. Use <code>NOT IN</code> with the keepers.' },
          { re: /^(?![\s\S]*\b(GROUP|PARTITION)\s+BY\b)/i, msg: 'With no <code>GROUP BY</code>, MIN gives one ID for the whole table, and every other row gets deleted.' },
          { re: /^(?![\s\S]*\bDELETE\b)/i, msg: 'Good, that is the check. Now write the <code>DELETE</code> and press Run.' }
        ],
        hints: [
          `Start with a SELECT. GROUP BY the five columns with <code>HAVING COUNT(*) &gt; 1</code> shows the 11 groups. Then find the keepers, one <code>activity_id</code> per group.`,
          `<code>SELECT MIN(activity_id) ... GROUP BY</code> the five columns gives the keepers. Rows with no duplicate are their own keeper.`,
          `<code>DELETE FROM collection_activities WHERE activity_id NOT IN (</code> that subquery <code>);</code>`
        ],
        win: `Write down what you expect before you run a change, such as 2,166 rows now and 2,155 after. At work, review before you delete, because two of these groups hold different PTP dates or amounts, and also find the cause, such as a batch that ran twice.`,
        pattern: { sql: `DELETE FROM table_name\nWHERE id_col NOT IN (\n  SELECT MIN(id_col)\n  FROM table_name\n  GROUP BY col_a, col_b\n);`, note: 'Delete duplicates, keeping the lowest ID in each group' }
      },
      {
        id: '8.6',
        mode: 'state',
        title: 'Undo with ROLLBACK',
        newIdea: 'After BEGIN, ROLLBACK undoes every change back to that point.',
        from: 'Reza, senior analyst',
        teach: `<p>A [[transaction]] makes your changes temporary until you decide. <code>BEGIN</code> opens one. You can see your changes and check them, and nothing is final yet. <code>ROLLBACK</code> puts everything back as it was at BEGIN.</p>[[demo:transaction]]`,
        ex: [
          ['BEGIN;', 'Open a transaction,'],
          ['DELETE FROM payments;', 'delete every payment by mistake,'],
          ['ROLLBACK;', 'undo all of it,'],
          ['SELECT COUNT(*) AS payments', 'and count the payments,'],
          ['FROM payments;', 'which are all still there.']
        ],
        exState: true,
        bridge: 'Like editing a copy of a workbook and closing it with Do Not Save. The original is untouched.',
        task: `My script has a bad line: <code>UPDATE loans SET status = 'Written Off' WHERE product = 'KTA';</code> Practice the undo by pressing Run twice. First, BEGIN, that line, and a count of Written Off loans. You will see 147, and it will not pass yet. Then add ROLLBACK and the same count. You will see 23.`,
        solution: `BEGIN;

UPDATE loans
SET status = 'Written Off'
WHERE product = 'KTA';

SELECT COUNT(*) AS written_off
FROM loans
WHERE status = 'Written Off';

ROLLBACK;

SELECT COUNT(*) AS written_off
FROM loans
WHERE status = 'Written Off';`,
        stateQuery: `SELECT status, COUNT(*) AS loans, SUM(outstanding) AS outstanding FROM loans GROUP BY status`,
        requires: [
          { re: /\bBEGIN\b[\s\S]*\bUPDATE\b[\s\S]*\bROLLBACK\b/i, msg: 'The data ends up right, but this mission is about the safety net. Run the steps in order: <code>BEGIN</code>, the <code>UPDATE</code>, then <code>ROLLBACK</code>.' },
          { re: /\bUPDATE\s+loans\s+SET\s+status\s*=\s*'Written Off'\s+WHERE\s+product\s*=\s*'KTA'/i, msg: 'The undo works. For this practice, use the bad line from the request, word for word.' },
          { re: /\bUPDATE\b[\s\S]*;\s*SELECT\b[\s\S]*\bROLLBACK\b[\s\S]*;\s*SELECT\b/i, msg: 'The undo works. Now see it: add a count of Written Off loans after the UPDATE, and the same count after <code>ROLLBACK</code>.' }
        ],
        altSolutions: [
          `BEGIN TRANSACTION; UPDATE loans SET status = 'Written Off' WHERE product = 'KTA'; SELECT status, COUNT(*) FROM loans GROUP BY status; ROLLBACK; SELECT status, COUNT(*) FROM loans GROUP BY status;`
        ],
        wrong: [
          `BEGIN; UPDATE loans SET status = 'Written Off' WHERE product = 'KTA'; COMMIT;`,
          `UPDATE loans SET status = 'Written Off' WHERE product = 'KTA';`,
          `UPDATE loans SET status = 'Written Off' WHERE product = 'KTA'; BEGIN; ROLLBACK;`,
          `BEGIN; ROLLBACK;`,
          `BEGIN; UPDATE loans SET status = 'Written Off' WHERE product = 'KTA';`,
          `BEGIN; UPDATE loans SET status = 'Written Off' WHERE product = 'KTA'; SELECT COUNT(*) FROM loans WHERE status = 'Written Off';`,
          `BEGIN; UPDATE loans SET status = 'Written Off' WHERE product = 'KTA'; ROLLBACK;`,
          `BEGIN; UPDATE loans SET status = 'Active'; SELECT COUNT(*) FROM loans; ROLLBACK; SELECT COUNT(*) FROM loans;`,
          `BEGIN; UPDATE loans SET status = 'Written Off' WHERE product = 'KTA'; SELECT COUNT(*) FROM loans WHERE status = 'Written Off'; ROLLBACK; SELECT COUNT(*) FROM loans WHERE status = 'Written Off'; UPDATE loans SET outstanding = 0;`
        ],
        traps: [
          { re: /\bCOMMIT\b/i, msg: '<code>COMMIT</code> makes the change permanent. To undo it, use <code>ROLLBACK</code>.' },
          { re: /^(?![\s\S]*\b(ROLLBACK|COMMIT)\b)/i, msg: 'That count shows the damage, and the bad change is still in the data. Now add <code>ROLLBACK;</code> and the same count underneath, and press Run again.' },
          { re: /\bUPDATE\b[\s\S]*\bBEGIN\b/i, msg: '<code>BEGIN</code> only protects what comes after it. It has to go first.' }
        ],
        hints: [
          `Press Run first with BEGIN, the bad UPDATE and a count. Then add ROLLBACK and another count, and press Run again.`,
          `Count with <code>SELECT COUNT(*) FROM loans WHERE status = 'Written Off'</code>. The first time shows 147, and the second shows 23.`,
          `Each step ends in a semicolon: <code>BEGIN;</code> then the UPDATE, the count, <code>ROLLBACK;</code> and the count again.`
        ],
        win: `A transaction is the seat belt for every data change. Open it before you touch anything, check what happened, and decide only then.`,
        atWork: `SQL Server uses <code>BEGIN TRANSACTION</code>. In Oracle a transaction starts by itself with your first change, and there is no BEGIN to type. Some tools commit each statement automatically unless you switch that off, so check before you rely on ROLLBACK. BigQuery supports transactions inside multi-statement scripts.`,
        pattern: { sql: `BEGIN;\n-- make the change\n-- check the result\nROLLBACK;  -- undo it all`, note: 'Undo a change inside a transaction' }
      },
      {
        id: '8.7',
        mode: 'state',
        title: 'Keep changes with COMMIT',
        newIdea: 'COMMIT makes every change since BEGIN permanent, all together.',
        from: 'Yusuf, Field team lead',
        teach: `<p><code>COMMIT</code> is the other way out of a transaction. It makes every change since BEGIN permanent, all together.</p><p>This matters when one piece of work takes two statements. Nothing is final until COMMIT. If the second statement fails, you ROLLBACK, and the first is undone too.</p><p>An INSERT can leave out columns. Those stay NULL. Here SQLite also numbers assignment_id for you.</p>`,
        ex: [
          ['BEGIN;', 'Open a transaction,'],
          ['UPDATE payments', 'then in payments'],
          ['SET amount = 250000', 'correct the amount from -250,000 to 250,000'],
          ['WHERE payment_id = 4436;', 'on one payment,'],
          ['UPDATE loans', 'and in loans'],
          ['SET outstanding = outstanding - 500000', 'and take that 500,000 difference off the balance'],
          ['WHERE loan_id = 76;', 'on that payment\'s loan,'],
          ['COMMIT;', 'make both changes permanent,'],
          ['SELECT loan_id, outstanding', 'and show the new balance'],
          ['FROM loans', 'from loans'],
          ['WHERE loan_id = 76;', 'for that loan.']
        ],
        exState: true,
        exNote: `<code>outstanding = outstanding - 500000</code> means the old balance minus 500,000. A column can appear on both sides of SET.`,
        bridge: 'Like a journal entry, where the debit and the credit post together or neither posts.',
        task: `Move loan 219 from collector 15 to collector 20, in one transaction. Set <code>unassigned_date</code> to 2026-10-31 on assignment 131. Then add a <code>loan_assignments</code> row with loan_id 219, collector_id 20 and assigned_date 2026-10-31. Then COMMIT.`,
        solution: `BEGIN;

UPDATE loan_assignments
SET unassigned_date = '2026-10-31'
WHERE assignment_id = 131;

INSERT INTO loan_assignments (loan_id, collector_id, assigned_date)
VALUES (219, 20, '2026-10-31');

COMMIT;`,
        stateQuery: `SELECT loan_id, collector_id, assigned_date, unassigned_date FROM loan_assignments WHERE loan_id = 219 OR unassigned_date = '2026-10-31' UNION ALL SELECT COUNT(*), SUM(unassigned_date IS NULL), 'table totals', 'table totals' FROM loan_assignments`,
        noTarget: true,
        requires: [
          { re: /\bBEGIN\b[\s\S]*\bCOMMIT\b/i, msg: 'The data is right, but these two changes need to be one unit. Wrap them in <code>BEGIN</code> and <code>COMMIT</code>.' },
          { re: /^(?:(?!\b(?:UPDATE|INSERT)\b)[\s\S])*\bBEGIN\b/i, msg: 'The data is right, but one change ran outside the transaction. Put <code>BEGIN</code> before both changes.' },
          { re: /^(?![\s\S]*\bCOMMIT\b[\s\S]*\b(?:UPDATE|INSERT|BEGIN)\b)/i, msg: 'The data is right, but this is two transactions, and a failure between them leaves half the work done. Use one <code>BEGIN</code> and one <code>COMMIT</code> around both changes.' }
        ],
        altSolutions: [
          `BEGIN; UPDATE loan_assignments SET unassigned_date = '2026-10-31' WHERE loan_id = 219 AND unassigned_date IS NULL; INSERT INTO loan_assignments (assignment_id, loan_id, collector_id, assigned_date, unassigned_date) VALUES (336, 219, 20, '2026-10-31', NULL); COMMIT;`,
          `BEGIN TRANSACTION; INSERT INTO loan_assignments (loan_id, collector_id, assigned_date) VALUES (219, 20, '2026-10-31'); UPDATE loan_assignments SET unassigned_date = '2026-10-31' WHERE assignment_id = 131; COMMIT; SELECT * FROM loan_assignments WHERE loan_id = 219;`
        ],
        wrong: [
          `UPDATE loan_assignments SET unassigned_date = '2026-10-31' WHERE assignment_id = 131; INSERT INTO loan_assignments (loan_id, collector_id, assigned_date) VALUES (219, 20, '2026-10-31');`,
          `BEGIN; UPDATE loan_assignments SET unassigned_date = '2026-10-31' WHERE assignment_id = 131; INSERT INTO loan_assignments (loan_id, collector_id, assigned_date) VALUES (219, 20, '2026-10-31'); ROLLBACK;`,
          `BEGIN; UPDATE loan_assignments SET unassigned_date = '2026-10-31' WHERE assignment_id = 131; COMMIT;`,
          `BEGIN; UPDATE loan_assignments SET collector_id = 20 WHERE assignment_id = 131; COMMIT;`,
          `BEGIN; UPDATE loan_assignments SET unassigned_date = '2026-10-31'; INSERT INTO loan_assignments (loan_id, collector_id, assigned_date) VALUES (219, 20, '2026-10-31'); COMMIT;`,
          `BEGIN; UPDATE loan_assignments SET unassigned_date = '2026-10-31' WHERE assignment_id = 131; COMMIT; BEGIN; INSERT INTO loan_assignments (loan_id, collector_id, assigned_date) VALUES (219, 20, '2026-10-31'); COMMIT;`,
          `UPDATE loan_assignments SET unassigned_date = '2026-10-31' WHERE assignment_id = 131; BEGIN; INSERT INTO loan_assignments (loan_id, collector_id, assigned_date) VALUES (219, 20, '2026-10-31'); COMMIT;`,
          `BEGIN; DELETE FROM loan_assignments WHERE loan_id <> 219; UPDATE loan_assignments SET unassigned_date = '2026-10-31' WHERE assignment_id = 131; INSERT INTO loan_assignments (loan_id, collector_id, assigned_date) VALUES (219, 20, '2026-10-31'); COMMIT;`
        ],
        traps: [
          { re: /\bSET\s+collector_id\b/i, msg: 'Overwriting <code>collector_id</code> erases who held the loan before. Close the old row and add a new one, so the history stays.' },
          { re: /\bUPDATE\s+loan_assignments\s+SET\s+\w+\s*=\s*'[^']*'\s*;/i, msg: 'This UPDATE has no <code>WHERE</code>, so it closes every assignment in the table. Pick assignment 131.' },
          { re: /\bROLLBACK\b/i, msg: '<code>ROLLBACK</code> throws the work away. This time you want to keep it, so end with <code>COMMIT</code>.' },
          { re: /^(?![\s\S]*\bINSERT\b)/i, msg: 'Half the job is done. The new collector still needs a row, so add an <code>INSERT</code>.' }
        ],
        hints: [
          `There are four statements: BEGIN, an UPDATE, an INSERT and COMMIT.`,
          `Name only the three columns you were given. SQLite numbers <code>assignment_id</code>, and <code>unassigned_date</code> stays NULL.`,
          `<code>INSERT INTO loan_assignments (loan_id, collector_id, assigned_date) VALUES (219, 20, '2026-10-31');</code>`
        ],
        win: `With no transaction, a failure between the two statements leaves a loan with no collector at all. Closing the old row, instead of overwriting it, also keeps the history that audits and collector scorecards need.`,
        atWork: `Do not COMMIT after an error. Behavior differs: PostgreSQL blocks further work until you ROLLBACK, and SQL Server and SQLite let you carry on. Auto-numbering differs too. SQL Server uses IDENTITY, Oracle uses a sequence or an identity column, and PostgreSQL uses an identity column.`,
        pattern: { sql: `BEGIN;\nUPDATE table_a SET col_a = 1 WHERE id_col = 10;\nINSERT INTO table_b (col_b) VALUES ('x');\nCOMMIT;`, note: 'Two changes kept together, or undone together' }
      },
      {
        id: '8.8',
        mode: 'state',
        title: 'Save a report as a view',
        newIdea: 'CREATE VIEW saves a query under a name, and it reruns each time you read it.',
        from: 'Citra, Head of Collection',
        teach: `<p>A [[view]] is a saved query with a name. You read it like a table, and the database runs the saved query each time, so the answer is always current.</p><p>That is the difference from a temp table, which holds a frozen copy of the rows. A view holds only the question. The <code>v_</code> at the start is only a naming habit, so readers can tell a view from a table.</p>`,
        ex: [
          ['CREATE VIEW v_feed_problems AS', 'Save a view called v_feed_problems, which is'],
          ['SELECT run_date, feed_name, rows_sent, rows_loaded', 'these four columns'],
          ['FROM batch_runs', 'from batch_runs'],
          ['WHERE rows_loaded <> rows_sent;', 'for runs that lost rows,'],
          ['SELECT *', 'then read every column'],
          ['FROM v_feed_problems;', 'from the view, the same way as a table.']
        ],
        exState: true,
        bridge: 'Like a sheet full of formulas linked to the raw data. Open it any day and it shows current numbers.',
        task: `I look at NPL every morning. Save a view named <code>v_npl_by_product</code> with one row per product: product, loans (the count) and outstanding (the total), for [[NPL]] loans (Kol 3 to 5) that are not Written Off. Then SELECT from the view.`,
        solution: `CREATE VIEW v_npl_by_product AS
SELECT product, COUNT(*) AS loans, SUM(outstanding) AS outstanding
FROM loans
WHERE collectibility >= 3
  AND status <> 'Written Off'
GROUP BY product;

SELECT *
FROM v_npl_by_product;`,
        stateQuery: `SELECT * FROM v_npl_by_product`,
        requires: [
          { re: /\bCREATE\s+(TEMP\s+|TEMPORARY\s+)?VIEW\b/i, msg: 'The numbers are right, but a table is a frozen copy. Citra needs fresh numbers every morning, so use <code>CREATE VIEW</code>.' },
          { re: /\bFROM\s+v_npl_by_product\b/i, msg: 'The view is saved. Now read it: add <code>SELECT * FROM v_npl_by_product;</code>' }
        ],
        altSolutions: [
          `CREATE VIEW v_npl_by_product AS SELECT product, COUNT(loan_id) AS loans, SUM(outstanding) AS outstanding FROM loans WHERE collectibility IN (3, 4, 5) AND status <> 'Written Off' GROUP BY product; SELECT product, loans, outstanding FROM v_npl_by_product ORDER BY outstanding DESC;`,
          `CREATE VIEW v_npl_by_product (product, loans, outstanding) AS SELECT product, COUNT(*), SUM(outstanding) FROM loans WHERE collectibility BETWEEN 3 AND 5 AND status IN ('Active', 'Restructured') GROUP BY product; SELECT * FROM v_npl_by_product;`
        ],
        wrong: [
          `CREATE VIEW v_npl_by_product AS SELECT product, COUNT(*) AS loans, SUM(outstanding) AS outstanding FROM loans WHERE collectibility >= 3 GROUP BY product; SELECT * FROM v_npl_by_product;`,
          `CREATE TABLE v_npl_by_product AS SELECT product, COUNT(*) AS loans, SUM(outstanding) AS outstanding FROM loans WHERE collectibility >= 3 AND status <> 'Written Off' GROUP BY product; SELECT * FROM v_npl_by_product;`,
          `CREATE VIEW v_npl_by_product AS SELECT product, COUNT(*) AS loans, SUM(outstanding) AS outstanding FROM loans WHERE collectibility >= 2 AND status <> 'Written Off' GROUP BY product; SELECT * FROM v_npl_by_product;`,
          `CREATE VIEW v_npl_by_product AS SELECT product, COUNT(*) AS loans, SUM(outstanding) AS outstanding FROM loans WHERE collectibility >= 3 AND status <> 'Written Off' GROUP BY product;`
        ],
        traps: [
          { re: /^(?![\s\S]*\bstatus\b)/i, msg: 'Written Off loans are all Kol 5, so they are in your numbers. Filter on <code>status</code> as well.' },
          { re: /\bcollectibility\s*(>=\s*[012]\b|>\s*[01]\b)/i, msg: 'NPL means Kol 3, 4 and 5. Check the grade in your filter.' }
        ],
        hints: [
          `Write the report as a normal SELECT first and check it. There should be 4 rows.`,
          `Then put <code>CREATE VIEW v_npl_by_product AS</code> on the line above it.`,
          `Finish with a semicolon and <code>SELECT * FROM v_npl_by_product;</code>`
        ],
        win: `Views put a business definition in one place. When everyone reads the same view, NPL means one thing, and two teams stop arguing over two numbers.`,
        atWork: `<code>CREATE VIEW</code> looks the same on Oracle, SQL Server, BigQuery and PostgreSQL. Oracle, PostgreSQL and BigQuery also have materialized views, which store the result for speed. In most banks, adding a view to production needs approval first, through a formal review called [[change process]].`,
        pattern: { sql: `CREATE VIEW v_report_name AS\nSELECT col_a, COUNT(*) AS rows_count\nFROM table_name\nGROUP BY col_a;\n\nSELECT *\nFROM v_report_name;`, note: 'Save a report as a view' }
      },
      {
        id: '8.9',
        mode: 'state',
        title: 'Before and after a release',
        newIdea: 'Save the pack before a change, run it again after, and join the two to see what moved.',
        from: 'Maya, UAT lead',
        teach: `<p>A [[test pack]] shows today's numbers. A [[regression test]] also needs the last run. So save the pack in a [[temp table]] before the [[release]], save it again after, and join the two on <code>check_name</code>.</p><p>A number that went down may be a fix. A number that went up is what you raise tonight.</p>`,
        ex: [
          [`CREATE TEMP TABLE before_count AS`, `Make a temporary table called before_count, filled with`],
          [`SELECT COUNT(*) AS no_email FROM customers WHERE email IS NULL;`, `the number of customers with no email,`],
          [`UPDATE customers SET email = NULL WHERE customer_id = 2;`, `then change one customer's row,`]
,
          [`SELECT b.no_email AS before_count, COUNT(*) AS after_count`, `and show the saved count beside a fresh one,`],
          [`FROM customers c`, `from the customers table`],
          [`CROSS JOIN before_count b`, `paired with the saved row,`],
          [`WHERE c.email IS NULL;`, `counting customers with no email.`]
        ],
        exState: true,
        bridge: 'Like comparing this month\'s exception report with last month\'s, line by line, to see what cleared and what is new.',
        task: `The release is in the editor. Save three checks in <code>before_pack</code> and again in <code>after_pack</code>, as <code>check_name</code>, <code>rows_tested</code>, <code>failed_rows</code>: <code>bad_payments</code> (all payments, amount at or below 0), <code>customers_no_phone</code> (all customers, phone NULL), <code>negative_balances</code> (all loans, outstanding below 0). Then join them: <code>check_name</code>, <code>before_failed</code>, <code>after_failed</code>.`,
        starter: `-- 1. Save the three checks in before_pack


-- 2. The release. Leave these two lines as they are.
DELETE FROM payments WHERE amount <= 0;
UPDATE customers SET phone = NULL WHERE city = 'Denpasar';

-- 3. Save the same checks in after_pack


-- 4. Join the two on check_name
`,
        solution: `CREATE TEMP TABLE before_pack AS
SELECT 'bad_payments' AS check_name,
  COUNT(*) AS rows_tested,
  SUM(CASE WHEN amount <= 0 THEN 1 ELSE 0 END) AS failed_rows
FROM payments
UNION ALL
SELECT 'customers_no_phone',
  COUNT(*),
  SUM(CASE WHEN phone IS NULL THEN 1 ELSE 0 END)
FROM customers
UNION ALL
SELECT 'negative_balances',
  COUNT(*),
  SUM(CASE WHEN outstanding < 0 THEN 1 ELSE 0 END)
FROM loans;

DELETE FROM payments WHERE amount <= 0;
UPDATE customers SET phone = NULL WHERE city = 'Denpasar';

CREATE TEMP TABLE after_pack AS
SELECT 'bad_payments' AS check_name,
  COUNT(*) AS rows_tested,
  SUM(CASE WHEN amount <= 0 THEN 1 ELSE 0 END) AS failed_rows
FROM payments
UNION ALL
SELECT 'customers_no_phone',
  COUNT(*),
  SUM(CASE WHEN phone IS NULL THEN 1 ELSE 0 END)
FROM customers
UNION ALL
SELECT 'negative_balances',
  COUNT(*),
  SUM(CASE WHEN outstanding < 0 THEN 1 ELSE 0 END)
FROM loans;

SELECT b.check_name,
  b.failed_rows AS before_failed,
  a.failed_rows AS after_failed
FROM before_pack b
JOIN after_pack a
  ON a.check_name = b.check_name;`,
        stateQuery: `SELECT b.check_name, b.failed_rows AS before_failed, a.failed_rows AS after_failed FROM before_pack b JOIN after_pack a ON a.check_name = b.check_name`,
        requires: [
          { re: /\brows_tested\b/i, msg: 'The failures are right. Each check also shows what it tested, so add <code>COUNT(*) AS rows_tested</code> to both packs.' },
          { re: /before_pack[\s\S]*\bDELETE\b[\s\S]*\bUPDATE\b[\s\S]*after_pack/i, msg: 'The tables are right, but the order matters. Save <code>before_pack</code> above the release lines, and <code>after_pack</code> below them.' },
          { re: /\bJOIN\b[\s\S]*\bcheck_name\b/i, msg: 'Both packs are saved. Now show them side by side: a <code>SELECT</code> joining <code>before_pack</code> to <code>after_pack</code> on <code>check_name</code>.' }
        ],
        wrong: [
          `DELETE FROM payments WHERE amount <= 0; UPDATE customers SET phone = NULL WHERE city = 'Denpasar'; CREATE TEMP TABLE before_pack AS SELECT 'bad_payments' AS check_name, COUNT(*) AS rows_tested, SUM(CASE WHEN amount <= 0 THEN 1 ELSE 0 END) AS failed_rows FROM payments UNION ALL SELECT 'customers_no_phone', COUNT(*), SUM(CASE WHEN phone IS NULL THEN 1 ELSE 0 END) FROM customers UNION ALL SELECT 'negative_balances', COUNT(*), SUM(CASE WHEN outstanding < 0 THEN 1 ELSE 0 END) FROM loans; CREATE TEMP TABLE after_pack AS SELECT * FROM before_pack; SELECT b.check_name, b.failed_rows AS before_failed, a.failed_rows AS after_failed FROM before_pack b JOIN after_pack a ON a.check_name = b.check_name;`,
          `CREATE TEMP TABLE before_pack AS SELECT 'bad_payments' AS check_name, COUNT(*) AS rows_tested, SUM(CASE WHEN amount <= 0 THEN 1 ELSE 0 END) AS failed_rows FROM payments UNION ALL SELECT 'customers_no_phone', COUNT(*), SUM(CASE WHEN phone IS NULL THEN 1 ELSE 0 END) FROM customers UNION ALL SELECT 'negative_balances', COUNT(*), SUM(CASE WHEN outstanding < 0 THEN 1 ELSE 0 END) FROM loans; DELETE FROM payments WHERE amount <= 0; UPDATE customers SET phone = NULL WHERE city = 'Denpasar'; CREATE TEMP TABLE after_pack AS SELECT * FROM before_pack; SELECT b.check_name, b.failed_rows AS before_failed, a.failed_rows AS after_failed FROM before_pack b JOIN after_pack a ON a.check_name = b.check_name;`
        ],
        traps: [
          { re: /CREATE\s+(TEMP\s+|TEMPORARY\s+)?TABLE\s+after_pack\s+AS\s+SELECT\s+\*\s+FROM\s+before_pack/i, msg: 'That copies the old numbers, so nothing can move. Run the three checks again for <code>after_pack</code>.' },
          { re: /^(?![\s\S]*\bTEMP(ORARY)?\s+TABLE\b)/i, msg: 'Save each pack with <code>CREATE TEMP TABLE name AS</code>, followed by the three checks.' }
        ],
        hints: [
          `Each pack is three small queries stacked with <code>UNION ALL</code>, as in your test pack from Level 7. Put <code>CREATE TEMP TABLE before_pack AS</code> in front.`,
          `Copy the same three checks below the release lines, and change the table name to <code>after_pack</code>.`,
          `Finish with <code>SELECT b.check_name, b.failed_rows AS before_failed, a.failed_rows AS after_failed FROM before_pack b JOIN after_pack a ON a.check_name = b.check_name;</code>`
        ],
        win: `Bad payments went from 3 to 0, which looks like a fix, and customers with no phone jumped from 42 to 65, which is the release breaking something. A side by side like this tells you in one look what to raise before go-live.`,
        pattern: { sql: `CREATE TEMP TABLE before_pack AS\nSELECT 'check_one' AS check_name, COUNT(*) AS failed_rows FROM table_name WHERE ...;\n\n-- the release runs here\n\nCREATE TEMP TABLE after_pack AS\nSELECT 'check_one' AS check_name, COUNT(*) AS failed_rows FROM table_name WHERE ...;\n\nSELECT b.check_name, b.failed_rows AS before_failed, a.failed_rows AS after_failed\nFROM before_pack b\nJOIN after_pack a\n  ON a.check_name = b.check_name;`, note: 'Compare a test pack before and after a release' }
      },

      /* ---------- Rules in the table ---------- */
      {
        id: '8.10',
        mode: 'state',
        title: 'Build your own table',
        newIdea: 'CREATE TABLE lists each column with its type, and PRIMARY KEY marks the column that identifies a row.',
        from: 'Maya, UAT lead',
        teach: `<p>A table's columns and rules are part of the database's [[schema]]. A [[constraint]] is a rule the table enforces, so bad data gets refused at the door. In Level 7 you hunted bad rows after they arrived. Constraints stop them arriving.</p><p>Write each column as name, then type, with commas between columns. The types you need are <code>INTEGER</code> and <code>TEXT</code>. <code>PRIMARY KEY</code> means this column identifies the row and cannot repeat.</p><p>Use plain <code>CREATE TABLE</code> when the table should stay. TEMP is for working lists. Either passes here.</p>`,
        ex: [
          ['CREATE TEMP TABLE new_branches (', 'Make a temporary table with'],
          ['  branch_id INTEGER PRIMARY KEY,', 'an ID that cannot repeat'],
          ['  branch_name TEXT', 'and a name,'],
          [');', 'and no other columns,'],
          ['INSERT OR IGNORE INTO new_branches (branch_id, branch_name)', 'then try to add rows, skipping any the rules refuse,'],
          [`VALUES (1, 'KC Bogor'), (1, 'KC Depok'), (2, 'KC Tangerang');`, 'where the second repeats an ID,'],
          ['SELECT *', 'and show every column'],
          ['FROM new_branches;', 'of the rows that got in.']
        ],
        exState: true,
        exNote: `<code>INSERT OR IGNORE</code> skips refused rows quietly, which keeps this demo running. A plain INSERT stops with an error. VALUES can list several rows, each in its own brackets.`,
        bridge: 'Like a voucher register, where each voucher number can appear only once.',
        task: `I need a table for [[PTP]] rows. Fill the blanks to create <code>ptp_log</code>: ptp_id INTEGER as primary key, loan_id INTEGER, ptp_date TEXT, ptp_amount INTEGER. You will see no rows, because CREATE only builds the table. I will then try three test rows, and two should get in, since one repeats an ID.`,
        starter: `CREATE TABLE ptp_log (\n  ptp_id INTEGER ____,\n  loan_id INTEGER,\n  ptp_date ____,\n  ptp_amount ____\n);`,
        fill: ['PRIMARY KEY', 'TEXT', 'INTEGER'],
        solution: `CREATE TABLE ptp_log (
  ptp_id INTEGER PRIMARY KEY,
  loan_id INTEGER,
  ptp_date TEXT,
  ptp_amount INTEGER
);`,
        stateQuery: `DELETE FROM ptp_log; INSERT OR IGNORE INTO ptp_log (ptp_id, loan_id, ptp_date, ptp_amount) VALUES (1, 102, '2026-11-05', 500000), (1, 214, '2026-11-06', 700000), (2, 269, '2026-11-07', 900000); SELECT COUNT(*) AS test_rows_that_got_in, SUM(ptp_id) AS sum_of_ids FROM ptp_log`,
        requires: [
          { re: /^(?=[\s\S]*\bptp_id\s+INT(?:EGER)?\b)(?=[\s\S]*\bloan_id\s+INT(?:EGER)?\b)(?=[\s\S]*\bptp_date\s+TEXT\b)(?=[\s\S]*\bptp_amount\s+INT(?:EGER)?\b)/i, msg: 'The rule works, and some column types differ from the request. Use INTEGER for ptp_id, loan_id and ptp_amount, and TEXT for ptp_date.' },
          { re: /\bptp_id\s+INT(?:EGER)?\s+(?:NOT\s+NULL\s+)?PRIMARY\s+KEY\b|\bPRIMARY\s+KEY\s*\(\s*ptp_id\b/i, msg: 'The test rows came out right, and this mission asks for a primary key. Write <code>PRIMARY KEY</code> on ptp_id.' }
        ],
        altSolutions: [
          `CREATE TEMP TABLE ptp_log (ptp_id INTEGER PRIMARY KEY, loan_id INTEGER, ptp_date TEXT, ptp_amount INTEGER);`,
          `CREATE TABLE ptp_log (ptp_id INTEGER, loan_id INTEGER, ptp_date TEXT, ptp_amount INTEGER, PRIMARY KEY (ptp_id));`,
          `CREATE TABLE ptp_log (ptp_id INTEGER PRIMARY KEY, loan_id INTEGER, ptp_date TEXT, ptp_amount INTEGER); INSERT OR IGNORE INTO ptp_log (ptp_id, loan_id, ptp_date, ptp_amount) VALUES (1, 1, '2026-11-05', 100), (1, 2, '2026-11-05', 100), (2, 3, '2026-11-05', 100); SELECT * FROM ptp_log;`
        ],
        wrong: [
          `CREATE TABLE ptp_log (ptp_id INTEGER, loan_id INTEGER, ptp_date TEXT, ptp_amount INTEGER);`,
          `CREATE TABLE ptp_log (ptp_id INTEGER UNIQUE, loan_id INTEGER, ptp_date TEXT, ptp_amount INTEGER);`,
          `CREATE TABLE ptp_log (ptp_id TEXT PRIMARY KEY, loan_id TEXT, ptp_date INTEGER, ptp_amount TEXT);`,
          `SELECT * FROM collection_activities LIMIT 3;`
        ],
        traps: [
          { re: /^(?![\s\S]*\bPRIMARY\s+KEY\b)/i, msg: 'Your table let in the repeated ptp_id, because it has no <code>PRIMARY KEY</code>. Add it to the ptp_id column.' }
        ],
        hints: [
          `The blanks need one rule and two types. Dates here are text, and amounts are whole numbers.`,
          `The first blank is the rule that stops a repeated ID, which is <code>PRIMARY KEY</code>.`,
          `The blanks are <code>PRIMARY KEY</code>, <code>TEXT</code> and <code>INTEGER</code>.`
        ],
        win: `You can now read and write a table definition, which is how a system's tables are documented. When you test a new table, the primary key is the first thing to look for.`,
        atWork: `<code>INSERT OR IGNORE</code> is SQLite. PostgreSQL uses <code>ON CONFLICT DO NOTHING</code>. On Oracle, SQL Server and PostgreSQL, a primary key always refuses NULL. SQLite is looser, because an INTEGER PRIMARY KEY fills in a missing ID and other key types can store NULL.`,
        pattern: { sql: `CREATE TABLE table_name (\n  id_col INTEGER PRIMARY KEY,\n  col_a TEXT,\n  col_b INTEGER\n);`, note: 'Create a table that refuses repeated IDs' }
      },
      {
        id: '8.11',
        mode: 'state',
        title: 'Rules on a table: required values',
        newIdea: 'NOT NULL makes a column refuse a row with no value.',
        from: 'Maya, UAT lead',
        teach: `<p><code>NOT NULL</code> means a value is required. Put it after the column type, and the table refuses any row that leaves that column empty.</p><p>Write it on each column that must be filled. A column without it accepts NULL, and that is how rows with missing facts get in.</p>`,
        ex: [
          ['CREATE TEMP TABLE new_branches (', 'Make a temporary table with'],
          ['  branch_id INTEGER PRIMARY KEY,', 'an ID that cannot repeat'],
          ['  branch_name TEXT NOT NULL', 'and a name that must be filled,'],
          [');', 'and no other columns,'],
          ['INSERT OR IGNORE INTO new_branches (branch_id, branch_name)', 'then try to add rows, skipping any the rules refuse,'],
          [`VALUES (1, 'KC Bogor'), (2, NULL), (3, 'KC Tangerang');`, 'where the second has no name,'],
          ['SELECT *', 'and show every column'],
          ['FROM new_branches;', 'of the rows that got in.']
        ],
        exState: true,
        bridge: 'Like Data Validation in Excel, which refuses a bad entry as it is typed, with no cleanup later.',
        task: `Five [[PTP]] rows had no date or no amount. Make that impossible. Create <code>ptp_log</code>: ptp_id INTEGER as primary key, loan_id INTEGER, ptp_date TEXT, ptp_amount INTEGER. The last three must refuse NULL. You will see no rows, because CREATE only builds the table. I will then try six test rows, and two should get in.`,
        solution: `CREATE TABLE ptp_log (
  ptp_id INTEGER PRIMARY KEY,
  loan_id INTEGER NOT NULL,
  ptp_date TEXT NOT NULL,
  ptp_amount INTEGER NOT NULL
);`,
        stateQuery: `DELETE FROM ptp_log; INSERT OR IGNORE INTO ptp_log (ptp_id, loan_id, ptp_date, ptp_amount) VALUES (1, 102, '2026-11-05', 500000), (1, 214, '2026-11-06', 700000), (2, NULL, '2026-11-05', 500000), (3, 269, NULL, 500000), (4, 269, '2026-11-05', NULL), (5, 269, '2026-11-07', 900000); SELECT COUNT(*) AS test_rows_that_got_in, SUM(ptp_id) AS sum_of_ids FROM ptp_log`,
        requires: [
          { re: /^(?=[\s\S]*\bptp_id\s+INT(?:EGER)?\b)(?=[\s\S]*\bloan_id\s+INT(?:EGER)?\b)(?=[\s\S]*\bptp_date\s+TEXT\b)(?=[\s\S]*\bptp_amount\s+INT(?:EGER)?\b)/i, msg: 'The rules work, and some column types differ from the request. Use INTEGER for ptp_id, loan_id and ptp_amount, and TEXT for ptp_date.' },
          { re: /\bptp_id\s+INT(?:EGER)?\s+(?:NOT\s+NULL\s+)?PRIMARY\s+KEY\b|\bPRIMARY\s+KEY\s*\(\s*ptp_id\b/i, msg: 'The test rows came out right, and this mission asks for a primary key. Write <code>PRIMARY KEY</code> on ptp_id, in place of UNIQUE.' }
        ],
        altSolutions: [
          `CREATE TEMP TABLE ptp_log (ptp_id INTEGER PRIMARY KEY, loan_id INTEGER NOT NULL, ptp_date TEXT NOT NULL, ptp_amount INTEGER NOT NULL);`,
          `CREATE TABLE ptp_log (ptp_id INTEGER NOT NULL, loan_id INTEGER NOT NULL, ptp_date TEXT NOT NULL, ptp_amount INTEGER NOT NULL, PRIMARY KEY (ptp_id));`,
          `CREATE TABLE ptp_log (ptp_id INTEGER PRIMARY KEY, loan_id INTEGER NOT NULL, ptp_date TEXT NOT NULL, ptp_amount INTEGER NOT NULL); INSERT OR IGNORE INTO ptp_log (ptp_id, loan_id, ptp_date, ptp_amount) VALUES (1, 1, '2026-11-05', 100), (1, 2, '2026-11-05', 100), (2, NULL, '2026-11-05', 100); SELECT * FROM ptp_log;`
        ],
        wrong: [
          `CREATE TABLE ptp_log (ptp_id INTEGER, loan_id INTEGER NOT NULL, ptp_date TEXT NOT NULL, ptp_amount INTEGER NOT NULL);`,
          `CREATE TABLE ptp_log (ptp_id INTEGER PRIMARY KEY, loan_id INTEGER, ptp_date TEXT NOT NULL, ptp_amount INTEGER NOT NULL);`,
          `CREATE TABLE ptp_log (ptp_id INTEGER PRIMARY KEY, loan_id INTEGER NOT NULL, ptp_date TEXT, ptp_amount INTEGER NOT NULL);`,
          `CREATE TABLE ptp_log (ptp_id INTEGER PRIMARY KEY, loan_id INTEGER NOT NULL, ptp_date TEXT NOT NULL, ptp_amount INTEGER);`,
          `CREATE TABLE ptp_log (ptp_id INTEGER, loan_id INTEGER, ptp_date TEXT, ptp_amount INTEGER);`,
          `CREATE TABLE ptp_log (ptp_id INTEGER UNIQUE, loan_id INTEGER NOT NULL, ptp_date TEXT NOT NULL, ptp_amount INTEGER NOT NULL);`,
          `CREATE TABLE ptp_log (ptp_id TEXT PRIMARY KEY, loan_id TEXT NOT NULL, ptp_date INTEGER NOT NULL, ptp_amount TEXT NOT NULL);`
        ],
        traps: [
          { re: /^(?![\s\S]*\bPRIMARY\s+KEY\b)/i, msg: 'Your table has no <code>PRIMARY KEY</code>, so it let in a repeated ptp_id. Add it to the ptp_id column.' },
          { re: /^(?![\s\S]*(\bNOT\s+NULL\b[\s\S]*){3})/i, msg: 'Each of loan_id, ptp_date and ptp_amount needs its own <code>NOT NULL</code>. Your table let in rows missing one of these.' }
        ],
        hints: [
          `The shape is <code>CREATE TABLE ptp_log ( ... );</code> with columns separated by commas.`,
          `Each line is name, type, rule. The first is <code>ptp_id INTEGER PRIMARY KEY</code>.`,
          `The next is <code>loan_id INTEGER NOT NULL</code>, and the other two follow the same shape. There is no comma after the last column.`
        ],
        win: `A UAT check finds bad rows after the damage is done, and a constraint prevents them. When you raise a defect, asking "could the table have refused this?" is a question that gets a senior's attention.`,
        pattern: { sql: `CREATE TABLE table_name (\n  id_col INTEGER PRIMARY KEY,\n  col_a TEXT NOT NULL,\n  col_b INTEGER\n);`, note: 'Create a table that refuses missing values and repeated IDs' }
      },
      {
        id: '8.12',
        mode: 'state',
        title: 'Rules on a table: UNIQUE',
        newIdea: 'UNIQUE refuses a value that already exists in that column.',
        from: 'Fitri, Desk Call lead',
        teach: `<p><code>UNIQUE</code> refuses a value that is already in that column. A table has one primary key, and it can have many UNIQUE columns.</p><p>One detail matters. NULL means unknown, so two NULLs do not count as the same value. A UNIQUE column here can hold many NULLs, which suits an optional field like a phone number.</p>`,
        ex: [
          ['CREATE TEMP TABLE collector_emails (', 'Make a temporary table with'],
          ['  collector_id INTEGER PRIMARY KEY,', 'an ID that cannot repeat'],
          ['  email TEXT UNIQUE', 'and an email no two collectors can share,'],
          [');', 'and no other columns,'],
          ['INSERT OR IGNORE INTO collector_emails (collector_id, email)', 'then try to add rows, skipping any the rules refuse,'],
          [`VALUES (1, 'a@example.com'), (2, 'a@example.com'), (3, NULL), (4, NULL);`, 'where the second repeats an email and both NULLs are fine,'],
          ['SELECT *', 'and show every column'],
          ['FROM collector_emails;', 'of the rows that got in.']
        ],
        exState: true,
        bridge: 'Like a Data Validation rule using COUNTIF, which refuses any value already in the column.',
        task: `Level 7 found customers sharing a phone number. My new table should refuse that. Create <code>contact_list</code>: customer_id INTEGER as primary key, and phone TEXT that must be unique. Phone stays optional. You will see no rows, because CREATE only builds the table. I will then try six test rows, and four should get in.`,
        solution: `CREATE TABLE contact_list (
  customer_id INTEGER PRIMARY KEY,
  phone TEXT UNIQUE
);`,
        stateQuery: `DELETE FROM contact_list; INSERT OR IGNORE INTO contact_list (customer_id, phone) VALUES (85, '0800-555-0389'), (172, '0800-555-0389'), (85, '0800-555-9999'), (1, NULL), (2, NULL), (3, '0800-555-1111'); SELECT COUNT(*) AS test_rows_that_got_in, SUM(customer_id) AS sum_of_ids FROM contact_list`,
        requires: [
          { re: /\bcustomer_id\s+INT(?:EGER)?\s+(?:NOT\s+NULL\s+)?PRIMARY\s+KEY\b|\bPRIMARY\s+KEY\s*\(\s*customer_id\b/i, msg: 'The test rows came out right, and this mission asks for a primary key. Write <code>customer_id INTEGER PRIMARY KEY</code>, in place of UNIQUE.' }
        ],
        altSolutions: [
          `CREATE TEMP TABLE contact_list (customer_id INTEGER PRIMARY KEY, phone TEXT UNIQUE);`,
          `CREATE TABLE contact_list (customer_id INTEGER PRIMARY KEY, phone TEXT, UNIQUE (phone));`,
          `CREATE TABLE contact_list (customer_id INTEGER PRIMARY KEY, phone TEXT UNIQUE); INSERT OR IGNORE INTO contact_list (customer_id, phone) VALUES (1, 'a'), (2, 'a'), (3, NULL); SELECT * FROM contact_list;`
        ],
        wrong: [
          `CREATE TABLE contact_list (customer_id INTEGER PRIMARY KEY, phone TEXT);`,
          `CREATE TABLE contact_list (customer_id INTEGER PRIMARY KEY, phone TEXT NOT NULL UNIQUE);`,
          `CREATE TABLE contact_list (customer_id INTEGER, phone TEXT PRIMARY KEY);`,
          `CREATE TABLE contact_list (customer_id INTEGER, phone TEXT UNIQUE);`,
          `CREATE TABLE contact_list (customer_id INTEGER UNIQUE, phone TEXT UNIQUE);`
        ],
        traps: [
          { re: /\bphone\s+TEXT\s+(UNIQUE\s+)?NOT\s+NULL|\bphone\s+TEXT\s+NOT\s+NULL/i, msg: 'Phone is optional here, so leave out <code>NOT NULL</code>. <code>UNIQUE</code> alone still lets several customers have no phone.' },
          { re: /\bphone\s+TEXT\s+PRIMARY\s+KEY\b/i, msg: 'The primary key belongs on <code>customer_id</code>. Put <code>UNIQUE</code> on phone.' },
          { re: /^(?![\s\S]*\bUNIQUE\b)/i, msg: 'Nothing stops a repeated phone yet. Add <code>UNIQUE</code> to the phone column.' },
          { re: /^(?![\s\S]*\bPRIMARY\s+KEY\b)/i, msg: 'A repeated customer_id got in. Make it the <code>PRIMARY KEY</code>.' }
        ],
        hints: [
          `Two columns, each with one rule.`,
          `Start with <code>customer_id INTEGER PRIMARY KEY,</code>`,
          `The second column is <code>phone TEXT UNIQUE</code>. Leave out NOT NULL, since phone is optional.`
        ],
        win: `A constraint is also a business decision. A husband and wife can really share a phone, so confirm a rule with the business before you lock it in.`,
        atWork: `PostgreSQL and Oracle also allow many NULLs in a UNIQUE column. SQL Server allows only one. BigQuery has no UNIQUE constraint at all, so checks like the ones in Level 7 do that job there.`,
        pattern: { sql: `CREATE TABLE table_name (\n  id_col INTEGER PRIMARY KEY,\n  col_a TEXT UNIQUE\n);`, note: 'Refuse repeated values in a column' }
      },
      {
        id: '8.13',
        mode: 'state',
        title: 'Rules on a table: CHECK',
        newIdea: 'CHECK refuses a row when your own condition is false.',
        from: 'Reza, senior analyst',
        teach: `<p><code>CHECK</code> lets you write your own rule, using the same conditions you write in a WHERE, such as <code>amount &gt; 0</code>, <code>BETWEEN</code> or <code>IN</code>. Put it after the column type. A row is refused when the condition is false.</p><p>Watch for NULL. NULL means unknown, so the answer to <code>amount &gt; 0</code> is unknown, not false. CHECK refuses only false, so NULL gets through. When a value is required, add <code>NOT NULL</code> as well.</p>`,
        ex: [
          ['CREATE TEMP TABLE kol_log (', 'Make a temporary table with'],
          ['  loan_id INTEGER PRIMARY KEY,', 'an ID that cannot repeat'],
          ['  collectibility INTEGER NOT NULL CHECK (collectibility BETWEEN 1 AND 5)', 'and a required Kol grade from 1 to 5,'],
          [');', 'and no other columns,'],
          ['INSERT OR IGNORE INTO kol_log (loan_id, collectibility)', 'then try to add rows, skipping any the rules refuse,'],
          ['VALUES (1, 2), (2, 7), (3, 5);', 'where the second has a grade that does not exist,'],
          ['SELECT *', 'and show every column'],
          ['FROM kol_log;', 'of the rows that got in.']
        ],
        exState: true,
        bridge: 'Like a custom Data Validation formula in Excel, where a cell accepts only values that make the formula true.',
        task: `Three payments at or below zero got in. Stop that in the new table. Create <code>payment_log</code>: payment_id INTEGER as primary key, loan_id INTEGER, and amount INTEGER, which must be present and above zero. You will see no rows, because CREATE only builds the table. I will then try six test rows, and two should get in.`,
        solution: `CREATE TABLE payment_log (
  payment_id INTEGER PRIMARY KEY,
  loan_id INTEGER,
  amount INTEGER NOT NULL CHECK (amount > 0)
);`,
        stateQuery: `DELETE FROM payment_log; INSERT OR IGNORE INTO payment_log (payment_id, loan_id, amount) VALUES (1, 11, 2595000), (1, 41, 500000), (2, 11, 0), (3, 76, -250000), (4, 41, NULL), (5, 76, 1); SELECT COUNT(*) AS test_rows_that_got_in, SUM(payment_id) AS sum_of_ids FROM payment_log`,
        requires: [
          { re: /\bpayment_id\s+INT(?:EGER)?\s+(?:NOT\s+NULL\s+)?PRIMARY\s+KEY\b|\bPRIMARY\s+KEY\s*\(\s*payment_id\b/i, msg: 'The test rows came out right, and this mission asks for a primary key. Write <code>payment_id INTEGER PRIMARY KEY</code>, in place of UNIQUE.' }
        ],
        altSolutions: [
          `CREATE TEMP TABLE payment_log (payment_id INTEGER PRIMARY KEY, loan_id INTEGER, amount INTEGER NOT NULL CHECK (amount > 0));`,
          `CREATE TABLE payment_log (payment_id INTEGER PRIMARY KEY, loan_id INTEGER, amount INTEGER NOT NULL, CHECK (amount > 0));`,
          `CREATE TABLE payment_log (payment_id INTEGER PRIMARY KEY, loan_id INTEGER NOT NULL, amount INTEGER NOT NULL CHECK (amount >= 1));`,
          `CREATE TABLE payment_log (payment_id INTEGER PRIMARY KEY, loan_id INTEGER, amount INTEGER NOT NULL CHECK (amount > 0)); INSERT OR IGNORE INTO payment_log (payment_id, loan_id, amount) VALUES (1, 1, 100), (2, 1, -5); SELECT * FROM payment_log;`
        ],
        wrong: [
          `CREATE TABLE payment_log (payment_id INTEGER PRIMARY KEY, loan_id INTEGER, amount INTEGER CHECK (amount > 0));`,
          `CREATE TABLE payment_log (payment_id INTEGER PRIMARY KEY, loan_id INTEGER, amount INTEGER NOT NULL CHECK (amount >= 0));`,
          `CREATE TABLE payment_log (payment_id INTEGER PRIMARY KEY, loan_id INTEGER, amount INTEGER NOT NULL);`,
          `CREATE TABLE payment_log (payment_id INTEGER PRIMARY KEY, loan_id INTEGER, amount INTEGER NOT NULL CHECK (amount <> 0));`,
          `CREATE TABLE payment_log (payment_id INTEGER, loan_id INTEGER, amount INTEGER NOT NULL CHECK (amount > 0));`,
          `CREATE TABLE payment_log (payment_id INTEGER UNIQUE, loan_id INTEGER, amount INTEGER NOT NULL CHECK (amount > 0));`
        ],
        traps: [
          { re: /\bamount\s*>=\s*0\b/i, msg: 'Zero is not above zero. Use <code>amount &gt; 0</code>.' },
          { re: /\bamount\s*(<>|!=)\s*0\b/i, msg: 'This lets the negative payment in. Use <code>amount &gt; 0</code>.' },
          { re: /^(?![\s\S]*\bNOT\s+NULL\b)/i, msg: 'A NULL gets past a CHECK, so the row with no amount got in. Add <code>NOT NULL</code> as well.' },
          { re: /^(?![\s\S]*\bCHECK\b)/i, msg: 'Nothing refuses zero or negative amounts yet. Add <code>CHECK (amount &gt; 0)</code>.' },
          { re: /^(?![\s\S]*\bPRIMARY\s+KEY\b)/i, msg: 'Your table let in a repeated payment_id. Make it the <code>PRIMARY KEY</code>.' }
        ],
        hints: [
          `Three columns. Only the third needs new rules.`,
          `The rule goes in brackets after the type: <code>CHECK (amount &gt; 0)</code>.`,
          `The last column reads <code>amount INTEGER NOT NULL CHECK (amount &gt; 0)</code>.`
        ],
        win: `Rules in the table protect every system that writes to it, and a check in one app protects only that app. That is why you ask where a rule lives when you test a new system.`,
        atWork: `Oracle, SQL Server and PostgreSQL enforce CHECK this same way. Real payment tables sometimes book reversals as negative rows, so agree each rule with the business first.`,
        pattern: { sql: `CREATE TABLE table_name (\n  id_col INTEGER PRIMARY KEY,\n  amount INTEGER NOT NULL CHECK (amount > 0)\n);`, note: 'Write your own rule with CHECK' }
      },

      /* ---------- Speed ---------- */
      {
        id: '8.14',
        mode: 'state',
        title: 'Read the query plan',
        newIdea: 'EXPLAIN QUERY PLAN shows whether the database will read every row or jump to the ones it needs.',
        from: 'Reza, senior analyst',
        teach: `<p>You can see why a query is slow. Put <code>EXPLAIN QUERY PLAN</code> in front of a SELECT and you get the [[query plan]], the route the database intends to take.</p><p>Read the <code>detail</code> column. <b>SCAN</b> means it reads every row in the table. <b>SEARCH</b> means it jumps straight to the rows it needs. Ignore the other three columns.</p>`,
        ex: [
          ['EXPLAIN QUERY PLAN', 'Ask for the route the database would take'],
          ['SELECT activity_id, result', 'to get the ID and result'],
          ['FROM collection_activities', 'from activities'],
          ['WHERE loan_id = 102;', 'for one loan.']
        ],
        exNote: `The detail column says SCAN, so it would read all 2,166 rows to find one loan's activities.`,
        bridge: 'SCAN is reading a ledger line by line to find one account, and SEARCH is going straight to its page.',
        task: `Reports on one loan's payments feel slow. Put EXPLAIN QUERY PLAN in front of this query and run it: <code>SELECT payment_id, amount FROM payments WHERE loan_id = 102;</code> Read the detail column. You should see SCAN.`,
        solution: `EXPLAIN QUERY PLAN
SELECT payment_id, amount
FROM payments
WHERE loan_id = 102;`,
        stateCheck: { sql: `EXPLAIN QUERY PLAN SELECT payment_id, amount FROM payments WHERE loan_id = 102`, mustMatch: 'SCAN' },
        noTarget: true,
        requires: [
          { re: /\bEXPLAIN\s+QUERY\s+PLAN\s+SELECT\b[\s\S]*\bpayments\b[\s\S]*\bloan_id\b/i, msg: 'To see the route, put <code>EXPLAIN QUERY PLAN</code> directly in front of the SELECT on payments.' }
        ],
        altSolutions: [
          `EXPLAIN QUERY PLAN SELECT payment_id, amount FROM payments WHERE loan_id = 102;`,
          `explain query plan select payment_id, amount from payments where loan_id = 102`
        ],
        wrong: [
          `SELECT payment_id, amount FROM payments WHERE loan_id = 102;`,
          `EXPLAIN QUERY PLAN SELECT * FROM loans WHERE loan_id = 102;`
        ],
        hints: [
          `The query itself does not change. You add three words in front of it.`,
          `Those words are <code>EXPLAIN QUERY PLAN</code>.`,
          `<code>EXPLAIN QUERY PLAN SELECT payment_id, amount FROM payments WHERE loan_id = 102;</code>`
        ],
        win: `When someone says a report is slow, the plan is the first thing to look at. A SCAN on a table of millions of rows is a strong clue.`,
        atWork: `Oracle uses <code>EXPLAIN PLAN FOR</code>, SQL Server has <code>SET SHOWPLAN_ALL ON</code> or a graphical plan, and PostgreSQL uses <code>EXPLAIN</code>. BigQuery shows execution details after the run. The words differ too: PostgreSQL says Seq Scan, and Oracle says TABLE ACCESS FULL.`,
        pattern: { sql: `EXPLAIN QUERY PLAN\nSELECT col_a\nFROM table_name\nWHERE col_b = 1;`, note: 'See the route: SCAN reads every row, SEARCH jumps' }
      },
      {
        id: '8.15',
        mode: 'state',
        title: 'From SCAN to SEARCH',
        newIdea: 'CREATE INDEX builds a lookup on a column, so the database can jump to matching rows.',
        from: 'Reza, senior analyst',
        teach: `<p>An [[index]] is a sorted lookup on a column. <code>CREATE INDEX name ON table (column)</code> builds one. The database keeps it up to date and uses it whenever it helps, so your query stays the same.</p><p>The cost is extra storage and slightly slower writes, so index the columns you often filter or join on.</p>[[demo:index]]`,
        ex: [
          ['CREATE INDEX idx_activities_loan', 'Build an index named idx_activities_loan'],
          ['ON collection_activities (loan_id);', 'on the loan_id column of activities,'],
          ['EXPLAIN QUERY PLAN', 'then ask for the route'],
          ['SELECT activity_id, result', 'to get the ID and result'],
          ['FROM collection_activities', 'from activities'],
          ['WHERE loan_id = 102;', 'for one loan, which now says SEARCH.']
        ],
        exState: true,
        bridge: 'Like the index at the back of a textbook: you go to the page, with no need to read the whole book.',
        task: `That SCAN on <code>payments</code> needs fixing. Create an index named <code>idx_payments_loan</code> on <code>payments (loan_id)</code>. Then, below it, use EXPLAIN QUERY PLAN on the same query: <code>SELECT payment_id, amount FROM payments WHERE loan_id = 102;</code> You should see SEARCH.`,
        solution: `CREATE INDEX idx_payments_loan
ON payments (loan_id);

EXPLAIN QUERY PLAN
SELECT payment_id, amount
FROM payments
WHERE loan_id = 102;`,
        stateCheck: { sql: `EXPLAIN QUERY PLAN SELECT payment_id, amount FROM payments WHERE loan_id = 102`, mustMatch: 'SEARCH.*USING.*INDEX' },
        noTarget: true,
        requires: [
          { re: /\bCREATE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?idx_payments_loan\b/i, msg: 'The plan says SEARCH. The request names the index, so call it <code>idx_payments_loan</code>.' },
          { re: /\bCREATE\s+INDEX\b[\s\S]*\bEXPLAIN\s+QUERY\s+PLAN\s+SELECT\b[\s\S]*\bpayments\b/i, msg: 'The index is built. Now confirm it works: after the index, add <code>EXPLAIN QUERY PLAN</code> on the payments query and look for SEARCH.' }
        ],
        altSolutions: [
          `CREATE INDEX idx_payments_loan ON payments (loan_id, payment_date); EXPLAIN QUERY PLAN SELECT payment_id, amount FROM payments WHERE loan_id = 102;`
        ],
        wrong: [
          `CREATE INDEX idx_payments_loan ON payments (payment_date); EXPLAIN QUERY PLAN SELECT payment_id, amount FROM payments WHERE loan_id = 102;`,
          `EXPLAIN QUERY PLAN SELECT payment_id, amount FROM payments WHERE loan_id = 102;`,
          `CREATE INDEX idx_payments_loan ON payments (loan_id);`,
          `CREATE INDEX idx_payments_loan ON collection_activities (loan_id); EXPLAIN QUERY PLAN SELECT payment_id, amount FROM payments WHERE loan_id = 102;`,
          `CREATE INDEX foo ON payments (loan_id); EXPLAIN QUERY PLAN SELECT payment_id, amount FROM payments WHERE loan_id = 102;`,
          `CREATE INDEX idx_payments_loan ON payments (loan_id); EXPLAIN QUERY PLAN SELECT 1;`,
          `EXPLAIN QUERY PLAN SELECT payment_id, amount FROM payments WHERE loan_id = 102; CREATE INDEX idx_payments_loan ON payments (loan_id);`
        ],
        traps: [
          { re: /\bON\s+payments\s*\(\s*(?!loan_id\b)/i, msg: 'The filter is on <code>loan_id</code>, so that is the column to index.' },
          { re: /\bON\s+(?!payments\b)\w+\s*\(/i, msg: 'The index has to be on the table being searched, which is <code>payments</code>.' }
        ],
        hints: [
          `An index goes on the column in the WHERE.`,
          `<code>CREATE INDEX idx_payments_loan ON payments (loan_id);</code>`,
          `After that semicolon, add the same <code>EXPLAIN QUERY PLAN SELECT ...</code> you ran in the last mission.`
        ],
        win: `Nothing in the query changed, and it went from reading 4,436 rows to reading a few rows. On a table of millions of rows, that can turn a long wait into seconds.`,
        atWork: `In most banks you cannot create indexes on production yourself. You bring the slow query and its plan to the database team, and they decide.`,
        pattern: { sql: `CREATE INDEX idx_table_col\nON table_name (col_a);`, note: 'Make lookups on a column fast' }
      },
      {
        id: '8.16',
        type: 'fix',
        title: 'Write filters an index can use',
        newIdea: 'An index helps only when the filter compares the bare column, with no function around it.',
        from: 'Reza, senior analyst',
        teach: `<p>An index on <code>payment_date</code> is sorted by the full date. Wrap the column in a function, like <code>substr(payment_date, 1, 7)</code>, and the database has to calculate that value for every row, so it scans.</p><p>Compare the bare column with a range: from the first of the month, up to but not including the first of the next. The answer stays the same and the index works. Pros call this a [[sargable]] filter. With no index on the column, both forms scan, so the starter builds one.</p>`,
        ex: [
          ['CREATE INDEX idx_activities_date', 'Build an index named idx_activities_date'],
          ['ON collection_activities (activity_date);', 'on the activity date,'],
          ['EXPLAIN QUERY PLAN', 'then ask for the route'],
          ['SELECT COUNT(*) AS activities', 'to count activities'],
          ['FROM collection_activities', 'in the activities table'],
          [`WHERE activity_date >= '2026-09-01'`, 'from the first of September'],
          [`  AND activity_date < '2026-10-01';`, 'up to the first of October, which says SEARCH.']
        ],
        exState: true,
        bridge: 'A list sorted by name lets you jump to Budi, and asking for "third letter is d" means reading every line.',
        task: `This runs every morning and scans all of <code>payments</code>, even with the index on the first line. Rewrite the filter as a date range on the bare <code>payment_date</code> column. Keep the same two columns, for July 2026. To see SEARCH, put EXPLAIN QUERY PLAN in front of your SELECT and press Run. Then remove it and press Run again.`,
        starter: `-- The index the database team added. Keep this line.\nCREATE INDEX idx_payments_date ON payments (payment_date);\n\nSELECT COUNT(*) AS payments, SUM(amount) AS cash\nFROM payments\nWHERE substr(payment_date, 1, 7) = '2026-07';`,
        solution: `SELECT COUNT(*) AS payments, SUM(amount) AS cash
FROM payments
WHERE payment_date >= '2026-07-01'
  AND payment_date < '2026-08-01';`,
        requires: [
          { re: /^(?![\s\S]*\bWHERE\b[\s\S]*\b(?!AND\b|OR\b|NOT\b|IN\b|WHERE\b|BETWEEN\b)\w+\s*\([^()]*\bpayment_date\b)/i, msg: 'The numbers are right, but <code>payment_date</code> is still inside a function, and any function around the column stops the index. Compare the bare column.' },
          { re: /[<>]|\bBETWEEN\b/i, msg: 'The numbers are right. SQLite cannot use an index for this LIKE by default, so write a range with <code>&gt;=</code> and <code>&lt;</code>.' }
        ],
        altSolutions: [
          `SELECT COUNT(*) AS payments, SUM(amount) AS cash FROM payments WHERE payment_date BETWEEN '2026-07-01' AND '2026-07-31';`,
          `SELECT SUM(amount) AS cash, COUNT(*) AS payments FROM payments WHERE payment_date > '2026-06-30' AND payment_date <= '2026-07-31';`,
          `CREATE INDEX idx_payments_date ON payments (payment_date); SELECT COUNT(*) AS payments, SUM(amount) AS cash FROM payments WHERE payment_date >= '2026-07-01' AND payment_date < '2026-08-01';`,
          `SELECT COUNT(payment_date) AS payments, SUM(amount) AS cash FROM payments WHERE (payment_date >= '2026-07-01') AND (payment_date < '2026-08-01');`,
          `SELECT COUNT(*) AS payments, SUM(amount) AS cash FROM payments WHERE payment_date >= date('2026-07-01') AND payment_date < date('2026-08-01');`
        ],
        wrong: [
          `SELECT COUNT(*) AS payments, SUM(amount) AS cash FROM payments WHERE strftime('%Y-%m', payment_date) = '2026-07';`,
          `SELECT COUNT(*) AS payments, SUM(amount) AS cash FROM payments WHERE payment_date >= '2026-07-01' AND payment_date < '2026-07-31';`,
          `SELECT COUNT(*) AS payments, SUM(amount) AS cash FROM payments WHERE payment_date >= '2026-07-01' AND payment_date <= '2026-08-01';`,
          `SELECT COUNT(*) AS payments, SUM(amount) AS cash FROM payments WHERE payment_date LIKE '2026-07%';`,
          `SELECT COUNT(*) AS payments, SUM(amount) AS cash FROM payments WHERE payment_date >= '2026-07-01';`,
          `SELECT COUNT(*) AS payments, SUM(amount) AS cash FROM payments WHERE date(payment_date) >= '2026-07-01' AND date(payment_date) < '2026-08-01';`,
          `SELECT COUNT(*) AS payments, SUM(amount) AS cash FROM payments WHERE date(payment_date) BETWEEN '2026-07-01' AND '2026-07-31';`,
          `SELECT COUNT(*) AS payments, SUM(amount) AS cash FROM payments WHERE trim(payment_date) >= '2026-07-01' AND trim(payment_date) < '2026-08-01';`,
          `CREATE INDEX idx_payments_date ON payments (payment_date); EXPLAIN QUERY PLAN SELECT COUNT(*) AS payments, SUM(amount) AS cash FROM payments WHERE payment_date >= '2026-07-01' AND payment_date < '2026-08-01';`
        ],
        traps: [
          { re: /<\s*'2026-07-31'/i, msg: 'This drops the 31st of July, and there is a payment on that day. Use <code>&lt; \'2026-08-01\'</code>.' },
          { re: /<=\s*'2026-08-01'/i, msg: 'This pulls in the 1st of August as well. Use <code>&lt;</code> in place of <code>&lt;=</code>.' },
          { re: /^(?![\s\S]*<)(?![\s\S]*\bBETWEEN\b)[\s\S]*>=/i, msg: 'The range needs an end as well, or it runs on through October.' },
          { re: /\bEXPLAIN\b/i, msg: 'That shows the route, so look for SEARCH in the detail column. Then remove <code>EXPLAIN QUERY PLAN</code> and press Run again, so I get my two numbers.' }
        ],
        hints: [
          `You want the lower and upper edge of July, compared directly with <code>payment_date</code>.`,
          `Dates here are text written as YYYY-MM-DD, so they sort in date order, and <code>&gt;=</code> and <code>&lt;</code> compare them correctly.`,
          `<code>WHERE payment_date &gt;= '2026-07-01' AND payment_date &lt; '2026-08-01'</code>`
        ],
        win: `This one habit fixes a large share of slow reports. Any time you see a function wrapped around a filtered column, ask whether a range would do the job.`,
        atWork: `Real databases usually store dates as DATE or TIMESTAMP. With timestamps, <code>BETWEEN ... AND 2026-07-31</code> can miss rows timed after midnight on the 31st, so "before the first of next month" is the safer form.`,
        pattern: { sql: `WHERE date_col >= '2026-07-01'\n  AND date_col < '2026-08-01'`, note: 'A month filter an index can use' }
      },

      /* ---------- Report shapes ---------- */
      {
        id: '8.17',
        title: 'Months as columns',
        newIdea: 'One SUM(CASE ...) per month turns rows into a cross-tab, with months across the top.',
        from: 'Citra, Head of Collection',
        teach: `<p>Managers like a [[cross-tab]], with months across the top. GROUP BY alone gives one row per channel per month, which is long and hard to scan.</p><p>Write one <code>SUM(CASE WHEN ... THEN ... ELSE 0 END)</code> per month, and group by whatever goes down the side. Each CASE keeps only its own month's rows. You met this in Level 2 as the SUMIF of SQL. <code>strftime</code> is fine here, because it sits in a CASE and does not choose rows for the WHERE.</p>`,
        ex: [
          ['SELECT activity_type,', 'For each activity type, show'],
          [`  SUM(CASE WHEN strftime('%Y-%m', activity_date) = '2026-09' THEN 1 ELSE 0 END) AS sep_count,`, 'the count of its September activities'],
          [`  SUM(CASE WHEN strftime('%Y-%m', activity_date) = '2026-10' THEN 1 ELSE 0 END) AS oct_count`, 'and the count of its October activities'],
          ['FROM collection_activities', 'from the activities table,'],
          ['GROUP BY activity_type;', 'with one row per type.']
        ],
        bridge: 'This is a PivotTable with months dragged into Columns, written out by hand.',
        task: `For the monthly pack, I need cash by channel with months across the top. One row per channel, with columns channel, cash_aug, cash_sep and cash_oct: the total payment amount in August, September and October 2026. Keep the negative and zero amounts in, so do not filter on amount.`,
        solution: `SELECT channel,
  SUM(CASE WHEN strftime('%Y-%m', payment_date) = '2026-08' THEN amount ELSE 0 END) AS cash_aug,
  SUM(CASE WHEN strftime('%Y-%m', payment_date) = '2026-09' THEN amount ELSE 0 END) AS cash_sep,
  SUM(CASE WHEN strftime('%Y-%m', payment_date) = '2026-10' THEN amount ELSE 0 END) AS cash_oct
FROM payments
GROUP BY channel;`,
        altSolutions: [
          `SELECT channel, SUM(amount) FILTER (WHERE payment_date >= '2026-08-01' AND payment_date < '2026-09-01') AS cash_aug, SUM(amount) FILTER (WHERE payment_date >= '2026-09-01' AND payment_date < '2026-10-01') AS cash_sep, SUM(amount) FILTER (WHERE payment_date >= '2026-10-01' AND payment_date < '2026-11-01') AS cash_oct FROM payments GROUP BY channel;`,
          `SELECT channel, SUM(CASE WHEN substr(payment_date, 1, 7) = '2026-08' THEN amount END) AS cash_aug, SUM(CASE WHEN substr(payment_date, 1, 7) = '2026-09' THEN amount END) AS cash_sep, SUM(CASE WHEN substr(payment_date, 1, 7) = '2026-10' THEN amount END) AS cash_oct FROM payments GROUP BY channel ORDER BY channel;`
        ],
        wrong: [
          `SELECT channel, strftime('%Y-%m', payment_date) AS month, SUM(amount) AS cash FROM payments WHERE payment_date >= '2026-08-01' GROUP BY channel, month;`,
          `SELECT channel, SUM(CASE WHEN strftime('%Y-%m', payment_date) = '2026-08' THEN 1 ELSE 0 END) AS cash_aug, SUM(CASE WHEN strftime('%Y-%m', payment_date) = '2026-09' THEN 1 ELSE 0 END) AS cash_sep, SUM(CASE WHEN strftime('%Y-%m', payment_date) = '2026-10' THEN 1 ELSE 0 END) AS cash_oct FROM payments GROUP BY channel;`,
          `SELECT channel, SUM(CASE WHEN strftime('%Y-%m', payment_date) = '2026-08' THEN amount ELSE 0 END) AS cash_aug, SUM(CASE WHEN strftime('%Y-%m', payment_date) = '2026-09' THEN amount ELSE 0 END) AS cash_sep, SUM(CASE WHEN strftime('%Y-%m', payment_date) = '2026-10' THEN amount ELSE 0 END) AS cash_oct FROM payments WHERE amount > 0 GROUP BY channel;`,
          `SELECT channel, SUM(CASE WHEN strftime('%m', payment_date) = '2026-08' THEN amount ELSE 0 END) AS cash_aug, SUM(CASE WHEN strftime('%m', payment_date) = '2026-09' THEN amount ELSE 0 END) AS cash_sep, SUM(CASE WHEN strftime('%m', payment_date) = '2026-10' THEN amount ELSE 0 END) AS cash_oct FROM payments GROUP BY channel;`,
          `SELECT SUM(CASE WHEN strftime('%Y-%m', payment_date) = '2026-08' THEN amount ELSE 0 END) AS cash_aug, SUM(CASE WHEN strftime('%Y-%m', payment_date) = '2026-09' THEN amount ELSE 0 END) AS cash_sep, SUM(CASE WHEN strftime('%Y-%m', payment_date) = '2026-10' THEN amount ELSE 0 END) AS cash_oct, COUNT(*) AS rows_count FROM payments;`
        ],
        traps: [
          { re: /\bGROUP\s+BY\s+\w+\s*,/i, msg: 'Grouping by the month as well gives one row per channel per month. Group by <code>channel</code> only, and let each CASE pick its month.' },
          { re: /strftime\s*\(\s*'%m'/i, msg: '<code>%m</code> gives only the month, like 08, and that never equals 2026-08. Use <code>%Y-%m</code>.' },
          { re: /\bTHEN\s+1\b/i, msg: '<code>THEN 1</code> counts payments. This request wants the total, so write <code>THEN amount</code>.' },
          { re: /\bWHERE\b[^;]*\bamount\b/i, msg: 'The request keeps the negative and zero amounts, so leave <code>amount</code> out of the filter.' }
        ],
        hints: [
          `You need four columns: <code>channel</code> and three SUMs. Group by channel only.`,
          `Each SUM wraps a CASE that gives the amount for its own month and 0 for any other month.`,
          `The first is <code>SUM(CASE WHEN strftime('%Y-%m', payment_date) = '2026-08' THEN amount ELSE 0 END) AS cash_aug</code>.`
        ],
        win: `This is the shape senior managers read. The months are typed by hand, so next month's pack needs one more line, and pros keep that in mind when they plan a recurring report.`,
        atWork: `This CASE method works on every database. Oracle, SQL Server and BigQuery also have a <code>PIVOT</code> keyword, and each writes it a little differently.`,
        pattern: { sql: `SELECT col_a,\n  SUM(CASE WHEN month_col = '2026-09' THEN amount ELSE 0 END) AS sep,\n  SUM(CASE WHEN month_col = '2026-10' THEN amount ELSE 0 END) AS oct\nFROM table_name\nGROUP BY col_a;`, note: 'Cross-tab: months as columns' }
      },
      {
        id: '8.18',
        title: 'Everyone under a manager',
        newIdea: 'A recursive CTE walks a hierarchy, one level at a time, until a step finds nobody.',
        from: 'Citra, Head of Collection',
        teach: `<p>You used <code>WITH RECURSIVE</code> in Level 7 to count through dates. It also walks a [[hierarchy]]. Start with one person's direct reports, at depth 1. Then join collectors to the CTE to find the reports of those people, at depth + 1. It stops when a step finds nobody.</p>`,
        ex: [
          ['WITH RECURSIVE team_tree AS (', 'Build a list called team_tree that'],
          ['  SELECT collector_id, collector_name, 1 AS depth', 'starts with the ID and name at depth 1'],
          ['  FROM collectors', 'taken from collectors'],
          ['  WHERE supervisor_id = 1', 'for everyone reporting to collector 1,'],
          ['  UNION ALL', 'then keeps adding'],
          ['  SELECT k.collector_id, k.collector_name, t.depth + 1', 'each person, one level deeper,'],
          ['  FROM collectors k', 'from collectors'],
          ['  JOIN team_tree t ON k.supervisor_id = t.collector_id', 'whose boss is already in the list,'],
          [')', 'until a step finds nobody,'],
          ['SELECT collector_id, collector_name, depth', 'and show each ID, name and depth'],
          ['FROM team_tree', 'from that list,'],
          ['ORDER BY depth, collector_id', 'top of the tree first,'],
          ['LIMIT 8;', 'first 8 rows only.']
        ],
        bridge: 'Like tracing an org chart box by box, or an account roll-up in a chart of accounts, down to the lowest level.',
        task: `Budi Anggraini (collector 3) is leaving, and I need everyone under him, at every level, so we can reassign their loans. Show collector_id, collector_name and depth, where his direct reports have depth 1 and their reports have depth 2. Leave Budi himself out.`,
        starter: `WITH RECURSIVE team_tree AS (\n  SELECT collector_id, collector_name, 1 AS depth\n  FROM collectors\n  WHERE supervisor_id = ____\n  UNION ALL\n  SELECT k.collector_id, k.collector_name, t.depth + ____\n  FROM collectors k\n  JOIN team_tree t ON k.supervisor_id = ____\n)\nSELECT collector_id, collector_name, depth\nFROM team_tree;`,
        fill: ['3', '1', 't.collector_id'],
        solution: `WITH RECURSIVE team_tree AS (
  SELECT collector_id, collector_name, 1 AS depth
  FROM collectors
  WHERE supervisor_id = 3
  UNION ALL
  SELECT k.collector_id, k.collector_name, t.depth + 1
  FROM collectors k
  JOIN team_tree t
    ON k.supervisor_id = t.collector_id
)
SELECT collector_id, collector_name, depth
FROM team_tree;`,
        requires: [
          { re: /\bWITH\s+RECURSIVE\b/i, msg: 'The rows are right today, because this tree is two levels deep. Add a third level and your query misses it. Use <code>WITH RECURSIVE</code>, which handles any depth.' }
        ],
        altSolutions: [
          `WITH RECURSIVE team_tree AS (SELECT collector_id, collector_name, 0 AS depth FROM collectors WHERE collector_id = 3 UNION ALL SELECT k.collector_id, k.collector_name, t.depth + 1 FROM collectors k JOIN team_tree t ON k.supervisor_id = t.collector_id) SELECT collector_id, collector_name, depth FROM team_tree WHERE depth > 0 ORDER BY depth, collector_id;`,
          `WITH RECURSIVE team_tree AS (SELECT collector_id, collector_name, 1 AS depth FROM collectors WHERE supervisor_id = 3 UNION SELECT k.collector_id, k.collector_name, t.depth + 1 FROM team_tree t JOIN collectors k ON t.collector_id = k.supervisor_id) SELECT * FROM team_tree;`
        ],
        wrong: [
          `SELECT collector_id, collector_name, 1 AS depth FROM collectors WHERE supervisor_id = 3;`,
          `WITH RECURSIVE team_tree AS (SELECT collector_id, collector_name, 0 AS depth FROM collectors WHERE collector_id = 3 UNION ALL SELECT k.collector_id, k.collector_name, t.depth + 1 FROM collectors k JOIN team_tree t ON k.supervisor_id = t.collector_id) SELECT collector_id, collector_name, depth FROM team_tree;`,
          `WITH RECURSIVE team_tree AS (SELECT collector_id, collector_name, 0 AS depth FROM collectors WHERE supervisor_id = 3 UNION ALL SELECT k.collector_id, k.collector_name, t.depth + 1 FROM collectors k JOIN team_tree t ON k.supervisor_id = t.collector_id) SELECT collector_id, collector_name, depth FROM team_tree;`,
          `SELECT k.collector_id, k.collector_name, 1 AS depth FROM collectors k WHERE k.supervisor_id = 3 UNION ALL SELECT k2.collector_id, k2.collector_name, 2 FROM collectors k JOIN collectors k2 ON k2.supervisor_id = k.collector_id WHERE k.supervisor_id = 3;`
        ],
        traps: [
          { re: /^(?![\s\S]*\bRECURSIVE\b)/i, msg: 'That finds a fixed number of levels. <code>WITH RECURSIVE</code> keeps going until nobody is left.' },
          { re: /\b0\s+AS\s+depth\b[\s\S]*\bsupervisor_id\s*=\s*3\b/i, msg: 'Direct reports should have depth 1, so start with <code>1 AS depth</code>.' },
          { re: /\bON\s+k\.collector_id\s*=\s*\w+\.supervisor_id\b/i, msg: 'This join walks up to the boss. To walk down, match <code>k.supervisor_id</code> to the <code>collector_id</code> already in your CTE.' },
          { re: /\bcollector_id\s*=\s*3\b(?![\s\S]*\bdepth\s*>)/i, msg: 'Starting from Budi puts him in the result, so either filter with <code>WHERE depth &gt; 0</code> or start from <code>supervisor_id = 3</code>.' }
        ],
        hints: [
          `The first blank is Budi's ID, so the walk starts with everyone whose <code>supervisor_id</code> is 3.`,
          `Each step goes one level deeper, so the second blank adds 1 to depth.`,
          `The last blank finds people whose boss is already in the list, which is <code>t.collector_id</code>. There should be 12 rows.`
        ],
        win: `Org charts, account roll-ups and agency structures are all hierarchies, and this one pattern handles them at any depth. A fixed number of JOINs breaks the day the tree grows a level.`,
        atWork: `PostgreSQL and BigQuery write <code>WITH RECURSIVE</code>. SQL Server and Oracle write plain <code>WITH</code>. Oracle also needs the column names after the CTE name, as in <code>WITH tree (id_col, depth) AS (...)</code>, and it has its own <code>CONNECT BY</code>.`,
        pattern: { sql: `WITH RECURSIVE tree AS (\n  SELECT id_col, 1 AS depth\n  FROM people\n  WHERE boss_id = 3\n  UNION ALL\n  SELECT p.id_col, t.depth + 1\n  FROM people p\n  JOIN tree t ON p.boss_id = t.id_col\n)\nSELECT *\nFROM tree;`, note: 'Everyone under a manager, at any depth' }
      },

      /* ---------- Thinking like an engineer ---------- */
      {
        id: '8.19',
        type: 'quiz',
        title: 'One fact, one place',
        newIdea: 'In a normalized design, each fact is stored once and other tables point to it with a key.',
        teach: `<p>Bank Kenari keeps a customer's phone in <code>customers</code>, and each loan holds only a <code>customer_id</code>. This design is called [[normalized]]. Every fact lives in one place, and a [[foreign key]] points to it.</p><p>The price is that you write JOINs. The gain is one place to update, and only one correct version.</p>`,
        bridge: 'Like one customer master sheet that others look up with XLOOKUP, in place of retyping the phone on every sheet.',
        question: `Gita Saputra holds three loans. A colleague suggests dropping <code>customers</code> and copying her phone onto each loan row, to avoid JOINs. What goes wrong when she changes her number?`,
        code: `SELECT l.loan_id, l.product, c.full_name, c.phone\nFROM loans l\nJOIN customers c ON c.customer_id = l.customer_id\nWHERE l.customer_id = 4;`,
        showCodeResult: true,
        check: { sql: `SELECT COUNT(*) FROM loans WHERE customer_id = 4`, equals: 3 },
        choices: [
          { t: 'The number must change on three rows, and missing one leaves two phone numbers for one person.', correct: true, why: 'Yes. Copies stop matching over time. With one row in customers, one change fixes it everywhere.' },
          { t: 'The database refuses to store the same phone on three rows.', why: 'It would store them without complaint. That is the trouble, because nothing keeps the copies matching later.' },
          { t: 'Nothing goes wrong, because one UPDATE can change all three rows.', why: 'One careful UPDATE can do it, today. Every system and script that writes this table has to remember it forever, and a single miss gives a collector the wrong number.' },
          { t: 'Her loans are deleted when the phone changes.', why: 'Changing a phone does not remove loans. The risk here is two conflicting phone numbers for one person.' }
        ],
        win: `An old phone number costs real calls. You will also meet reporting tables that copy facts on purpose so reads are faster, called denormalized tables, and the normalized tables stay the main record.`
      },
      {
        id: '8.20',
        title: 'Why snapshots exist',
        newIdea: 'A snapshot table saves history that the current table overwrites.',
        from: 'Citra, Head of Collection',
        teach: `<p>The <code>loans</code> table holds each loan as it is <b>today</b>. When DPD changes, the old value is overwritten and gone. A [[snapshot]] table saves a copy at each month end, so the past stays readable.</p><p>The [[grain]] of <code>loan_snapshots</code> is one row per loan per month. That is why you never add up its balances across months.</p>`,
        ex: [
          [`SELECT snapshot_month, dpd, collectibility, outstanding`, `Show each month's DPD, grade and balance`],
          [`FROM loan_snapshots`, `from the snapshots,`],
          [`WHERE loan_id = 84`, `for loan 84,`],
          [`ORDER BY snapshot_month DESC`, `newest month first,`],
          [`LIMIT 5;`, `and stop after 5 rows.`]
        ],
        exNote: `Loan 84 was Kol 1 in June and is far overdue now. The <code>loans</code> table only knows the second part.`,
        bridge: 'Like keeping each month-end trial balance, because today\'s ledger balance cannot tell you what June looked like.',
        task: `How many loans were [[Kol 2]] at the end of June 2026? Give me one row and one column, <code>kol_2_loans</code>.`,
        solution: `SELECT COUNT(*) AS kol_2_loans
FROM loan_snapshots
WHERE snapshot_month = '2026-06'
  AND collectibility = 2;`,
        altSolutions: [
          `SELECT SUM(CASE WHEN collectibility = 2 THEN 1 ELSE 0 END) AS kol_2_loans FROM loan_snapshots WHERE snapshot_month = '2026-06';`,
          `SELECT COUNT(loan_id) AS kol_2_loans FROM loan_snapshots WHERE collectibility = 2 AND snapshot_month = '2026-06';`
        ],
        wrong: [
          `SELECT COUNT(*) AS kol_2_loans FROM loans WHERE collectibility = 2;`,
          `SELECT COUNT(*) AS kol_2_loans FROM loans WHERE collectibility = 2 AND disbursed_date BETWEEN '2026-06-01' AND '2026-06-30';`,
          `SELECT COUNT(*) AS kol_2_loans FROM loan_snapshots WHERE collectibility = 2;`,
          `SELECT COUNT(*) AS kol_2_loans FROM loan_snapshots WHERE snapshot_month = '2026-06';`
        ],
        traps: [
          { re: /\bFROM\s+loans\b/i, msg: '<code>loans</code> stores only the latest value. Grades move every month, so today\'s grade answers a different question. Read <code>loan_snapshots</code>.' },
          { re: /^(?![\s\S]*2026-06)/i, msg: 'Without a month filter, this counts loan-months across the whole year. Filter on <code>snapshot_month = \'2026-06\'</code>.' },
          { re: /collection_activities/i, msg: 'Activities record contact attempts, and they hold no Kol grade. Read <code>loan_snapshots</code>.' }
        ],
        hints: [
          `Which table still remembers June? It has one row per loan per month.`,
          `Filter on two columns, the month and the grade.`,
          `<code>WHERE snapshot_month = '2026-06' AND collectibility = 2</code>, with <code>COUNT(*)</code> in the <code>SELECT</code>.`
        ],
        win: `Today's table cannot answer this, and the snapshots can: 53 loans in June. Trends, loans moving between DPD ranges, and [[roll rates|roll rate]] all need the past, so they all read snapshots.`,
        pattern: { sql: `SELECT COUNT(*) AS row_count\nFROM snapshot_table\nWHERE snapshot_month = '2026-06'\n  AND col_a = 2;`, note: 'Look back in time with a snapshot table' }
      },
      {
        id: '8.21',
        type: 'quiz',
        title: 'Why typed text stays out of SQL',
        newIdea: 'Apps send typed text as a parameter, because text pasted into SQL can run as SQL.',
        teach: `<p>Apps build queries behind every search box. If an app pastes typed text straight into the SQL, that text can change the query. This attack is called [[SQL injection]].</p><p>A normal search: <code>WHERE full_name = '<b>Gita</b>'</code></p><p>An attack: <code>WHERE full_name = '<b>x' OR '1' = '1</b>'</code></p><p>The typed quote closes the name early, so the rest runs as SQL. 1 = 1 is always true, so every row comes back.</p><p>The fix is a [[parameter]]. The SQL is sent with a placeholder, <code>WHERE full_name = ?</code>, and the typed text is sent separately. The database treats it only as a value, whatever it contains.</p>`,
        bridge: 'Like formatting an input cell as Text, so whatever is typed stays text and never runs as a formula.',
        question: `A search screen pastes the typed name into its SQL. Someone types the text in bold above, and the database receives the query below. What is the right fix?`,
        code: `SELECT COUNT(*) AS rows_returned\nFROM customers\nWHERE full_name = 'x' OR '1' = '1';`,
        showCodeResult: true,
        check: { sql: `SELECT COUNT(*) FROM customers WHERE full_name = 'x' OR '1' = '1'`, equals: 423 },
        choices: [
          { t: 'Send the typed text as a parameter, so it can only ever be a value.', correct: true, why: 'Yes. Every customer came back because the typed text became part of the WHERE. With a parameter, the database looks for a person literally named that, and finds nobody.' },
          { t: 'Block the word OR in the search box.', why: 'An attacker has many other ways to write this, and real names can contain those letters. Block lists keep losing.' },
          { t: 'Hide the result when too many rows come back.', why: 'By then the query has already run. A worse input could change or delete data, and hiding the result would not stop that.' },
          { t: 'Remind staff to type carefully.', why: 'This is an attack, so care has nothing to do with it. The system has to be safe whatever anyone types.' }
        ],
        win: `In UAT on a test system, try a name with a single quote, such as Ma'ruf. An error or a strange result is a strong sign that text is being pasted into SQL, so raise a defect.`
      },
      {
        id: '8.22',
        title: 'Good manners on shared data',
        newIdea: 'When exploring shared data, start small: staging first, few columns, a filter and a LIMIT.',
        from: 'Reza, senior analyst',
        teach: `<p>At work, many people share one database, and a careless query can slow it down for everyone. A few habits help everyone:</p><ul><li>Use [[staging]] first when it has what you need.</li><li>Name your columns in place of <code>SELECT *</code>.</li><li>Filter on a column with an index, such as a date or ID, so you avoid scanning a whole table.</li><li>Add <code>LIMIT</code> while exploring.</li></ul>`,
        ex: [
          [`SELECT activity_id, activity_date, result`, `Show three named columns`],
          [`FROM collection_activities`, `from the activities table,`],
          [`WHERE activity_date >= '2026-10-20'`, `from 20 October on,`],
          [`ORDER BY activity_date, activity_id`, `earliest first,`],
          [`LIMIT 5;`, `and stop after 5 rows.`]
        ],
        bridge: 'Like previewing the first rows of a huge export, before you try opening the whole file and freeze your laptop.',
        task: `Treat <code>payments</code> as a [[production]] table you have never seen, holding years of data. Take a first look: <code>loan_id</code>, <code>payment_date</code> and <code>amount</code> for payments on or after 2026-10-01, sorted by <code>payment_date</code> and then <code>payment_id</code>, stopping at 20 rows.`,
        solution: `SELECT loan_id, payment_date, amount
FROM payments
WHERE payment_date >= '2026-10-01'
ORDER BY payment_date, payment_id
LIMIT 20;`,
        altSolutions: [
          `SELECT loan_id, payment_date, amount FROM payments WHERE payment_date > '2026-09-30' ORDER BY payment_date, payment_id LIMIT 20;`
        ],
        requires: [
          { re: /\bLIMIT\s+20\b/i, msg: 'The rows are right. A first look on shared data ends with <code>LIMIT 20</code>, so add it.' },
          { re: /\bWHERE\b[\s\S]*payment_date/i, msg: 'The rows are right. Filter on the date, so the database skips the years you do not need.' }
        ],
        wrong: [
          `SELECT loan_id, payment_date, amount FROM payments WHERE payment_date >= '2026-10-01' ORDER BY payment_date, payment_id;`,
          `SELECT * FROM payments WHERE payment_date >= '2026-10-01' ORDER BY payment_date, payment_id LIMIT 20;`,
          `SELECT loan_id, payment_date, amount FROM payments ORDER BY payment_date, payment_id LIMIT 20;`,
          `SELECT loan_id, payment_date, amount FROM payments WHERE payment_date >= '2026-10-01' ORDER BY amount DESC LIMIT 20;`
        ],
        traps: [
          { re: /\bSELECT\s+\*/i, msg: 'This asks for every column. Name the three you need, which also shows the next reader what you were looking for.' },
          { re: /^(?![\s\S]*\bLIMIT\b)/i, msg: 'You do not yet know how many rows a month holds, so add a <code>LIMIT</code> while you look around.' },
          { re: /\bORDER\s+BY\s+amount\b/i, msg: 'The request sorts by date. Sorting a big table by amount is heavy work when you are only looking around.' }
        ],
        hints: [
          `Name the three columns, then add the date filter in <code>WHERE</code>.`,
          `Sort with <code>ORDER BY payment_date, payment_id</code>. The sort column does not have to be in your list.`,
          `Finish with <code>LIMIT 20</code>.`
        ],
        win: `Database teams can see heavy queries, so careful habits build trust with them. Before a heavy job, ask when it is safe to run.`,
        atWork: `On BigQuery, <code>LIMIT</code> usually does not reduce the data scanned or the cost. Choosing fewer columns and filtering on the date column the table is split by does.`,
        pattern: { sql: `SELECT col_a, col_b\nFROM table_name\nWHERE date_col >= '2026-10-01'\nLIMIT 20;`, note: 'A first look at a big shared table' }
      },
      {
        id: '8.23',
        type: 'quiz',
        title: 'Never fix production by hand',
        newIdea: 'Your job is to prove and report a production data problem, and the fix goes through the change process.',
        teach: `<p>In [[production]], real customers and real money depend on the data. An analyst's login should normally be [[read-only]]. Even with write access, a hand edit skips review, approval and the [[audit trail]].</p><p>Your strength is evidence. You can show exactly which rows are wrong and why, then raise it through the [[change process]], so the team that owns the system fixes it properly, tested in [[staging]] first. Your bank's own procedure sets the exact steps.</p>`,
        bridge: 'Like a posted journal, which you never overwrite. You raise a correcting entry, with approval and a paper trail.',
        question: `Your rule check finds six loans with the wrong Kol in production. Your script fixed them on a test copy, and you happen to have write access. A manager says "get it fixed today." What do you do?`,
        choices: [
          { t: 'Raise a defect with the query, expected versus actual, the count and the loan IDs, and send the fix through the change process, flagged as urgent.', correct: true, why: 'Yes. The team that owns the system can approve, test and log the fix. They also look for the cause, because the system that set those grades may write them wrong again on the next batch.' },
          { t: 'Run the script in production inside a transaction, because ROLLBACK makes it safe.', why: 'A transaction protects you from a bad statement. It gives you no approval, no review and no record of why the data changed.' },
          { t: 'Run the update now, and tell everyone afterwards.', why: 'Speed feels helpful here, but a change nobody approved is the problem auditors look for. It also hides the fault that caused the wrong grades.' },
          { t: 'Export the six loans to Excel and correct them there.', why: 'The system stays wrong, and now there is a second version of the data on your laptop, with customer data in it.' }
        ],
        win: `Kol feeds reports the bank relies on, so auditors will ask who changed it and why, and a logged change answers that where a hand edit cannot. Saying "I can prove it, and here is the ticket" is how analysts build trust.`
      },
      {
        id: '8.24',
        title: 'Share a sample safely',
        newIdea: '|| joins text, so you can show a value with its middle hidden.',
        from: 'Maya, UAT lead',
        teach: `<p>A [[defect]] report needs sample rows, and a sample often travels by email or chat. Your bank's data rules decide what may leave, so check them first. A safe habit is to keep the IDs and hide what identifies the person.</p><p><code>||</code> joins text, like <code>&amp;</code> in Excel. <code>substr(phone, -4)</code> counts from the end, so it gives the last 4 characters.</p>`,
        ex: [
          [`SELECT branch_name,`, `Show each branch's name`],
          [`  substr(branch_name, 1, 3) || '...' || substr(branch_name, -3) AS short_name`, `and a short name, joining its first 3 characters, three dots and its last 3,`],
          [`FROM branches`, `from the branches table,`],
          [`LIMIT 3;`, `and stop after 3 rows.`]
        ],
        bridge: 'Like =LEFT(A2,4)&"-****-"&RIGHT(A2,4) in Excel.',
        task: `IT needs a sample of customers who share a phone number, without the real details. For each customer whose <code>phone</code> is on more than one row: <code>customer_id</code>, <code>masked_name</code> (first letter of <code>full_name</code>, then <code>***</code>) and <code>masked_phone</code> (first 4 characters, then <code>-****-</code>, then last 4).`,
        solution: `SELECT customer_id,
  substr(full_name, 1, 1) || '***' AS masked_name,
  substr(phone, 1, 4) || '-****-' || substr(phone, -4) AS masked_phone
FROM customers
WHERE phone IN (
  SELECT phone
  FROM customers
  GROUP BY phone
  HAVING COUNT(*) > 1
);`,
        altSolutions: [
          `WITH shared AS (SELECT phone FROM customers GROUP BY phone HAVING COUNT(*) > 1) SELECT c.customer_id, substr(c.full_name, 1, 1) || '***' AS masked_name, substr(c.phone, 1, 4) || '-****-' || substr(c.phone, length(c.phone) - 3) AS masked_phone FROM customers c JOIN shared s ON s.phone = c.phone;`
        ],
        requires: [{ re: /\|\|/, msg: 'The result is right. This mission practices joining text, so build the masks with <code>||</code>.' }],
        wrong: [
          `SELECT customer_id, full_name AS masked_name, phone AS masked_phone FROM customers WHERE phone IN (SELECT phone FROM customers GROUP BY phone HAVING COUNT(*) > 1);`,
          `SELECT customer_id, substr(full_name, 1, 1) || '***' AS masked_name, substr(phone, 1, 4) || '-****-' || substr(phone, -4) AS masked_phone FROM customers;`,
          `SELECT customer_id, substr(full_name, 1, 1) || '***' AS masked_name, substr(phone, 1, 4) || '-****-' || substr(phone, 4) AS masked_phone FROM customers WHERE phone IN (SELECT phone FROM customers GROUP BY phone HAVING COUNT(*) > 1);`
        ],
        traps: [
          { re: /substr\s*\(\s*\w*\.?phone\s*,\s*4\s*\)/i, msg: 'A positive start counts from the front, so this keeps most of the number. <code>substr(phone, -4)</code> counts from the end.' },
          { re: /^(?![\s\S]*\bHAVING\b)(?![\s\S]*\bOVER\b)/i, msg: 'The sample is only customers sharing a phone. Find those with <code>GROUP BY phone HAVING COUNT(*) &gt; 1</code> in a subquery.' }
        ],
        hints: [
          `You found these customers in Level 7. Use <code>WHERE phone IN (...)</code> with a subquery that groups by <code>phone</code>.`,
          `<code>masked_name</code> is <code>substr(full_name, 1, 1) || '***'</code>.`,
          `<code>masked_phone</code> joins three pieces: <code>substr(phone, 1, 4) || '-****-' || substr(phone, -4)</code>.`
        ],
        win: `IT can still see that customers 85 and 172 share a phone ending 0389, and no name or full number has left your desk. Check your bank's data rules each time, because a masked sample can still count as personal data.`,
        atWork: `Oracle, PostgreSQL and BigQuery all have a form of <code>||</code>. SQL Server uses <code>+</code> or <code>CONCAT</code>, and <code>RIGHT(phone, 4)</code> for the last characters.`,
        pattern: { sql: `SELECT id,\n  substr(col_a, 1, 4) || '-****-' || substr(col_a, -4) AS masked_a\nFROM table_name;`, note: 'Mask a value before you share a sample' }
      },

      /* ---------- Putting it together ---------- */
      {
        id: '8.25',
        type: 'fix',
        title: 'Review a query like a senior',
        newIdea: 'A good review checks that the answer is correct first, then makes the query readable.',
        from: 'Tasya, fellow trainee',
        teach: `<p>Seniors review in a fixed order. <b>Correct first:</b> check that it answers the request and that every number is right. <b>Then readable:</b> an explicit <code>JOIN ... ON</code>, short aliases, named columns, one clause per line.</p><p><code>FROM a, b</code> with the link in WHERE is an old way to write a JOIN. It still runs, but forget the link and every row pairs with every row, as in Level 3. That is why reviewers ask for <code>JOIN ... ON</code>. <code>ORDER BY 4</code> means sort by the fourth column, and the next reader has to count to find it, so sort by a name.</p>`,
        ex: [
          ['SELECT b.region,', 'For each region, show its name,'],
          ['  COUNT(*) AS loans,', 'its number of loans'],
          [`  ROUND(100.0 * SUM(CASE WHEN l.product = 'KTA' THEN 1 ELSE 0 END) / COUNT(*), 2) AS kta_pct`, 'and the percent that are KTA,'],
          ['FROM loans l', 'from loans'],
          ['JOIN branches b ON b.branch_id = l.branch_id', 'matched to their branch,'],
          [`WHERE l.status <> 'Written Off'`, 'leaving out write-offs,'],
          ['GROUP BY b.region', 'with one row per region,'],
          ['ORDER BY kta_pct DESC;', 'highest share first.']
        ],
        bridge: 'Like reviewing a colleague\'s workbook, where you check that the totals tie out before you tidy the labels.',
        task: `Reza asked me to send this to Citra, and I would like you to review it first. It should show NPL share per product for Payroll customers, excluding Written Off loans. Fix the numbers, then tidy it: JOIN with ON, aliases, and columns product, loans, outstanding, npl_ratio_pct (2 decimals), highest first.`,
        starter: `select product, count(*), sum(loans.outstanding),
round(100.0 * sum(case when collectibility > 3 then loans.outstanding else 0 end) / sum(loans.outstanding), 2)
from loans, customers
where loans.customer_id = customers.customer_id
and employment = 'Payroll'
group by product
order by 4 desc;`,
        solution: `SELECT l.product,
  COUNT(*) AS loans,
  SUM(l.outstanding) AS outstanding,
  ROUND(100.0 * SUM(CASE WHEN l.collectibility >= 3 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) AS npl_ratio_pct
FROM loans l
JOIN customers c
  ON c.customer_id = l.customer_id
WHERE c.employment = 'Payroll'
  AND l.status <> 'Written Off'
GROUP BY l.product
ORDER BY npl_ratio_pct DESC;`,
        ordered: 'npl_ratio_pct',
        requires: [
          { re: /\bJOIN\b[\s\S]*\bON\b/i, msg: 'The numbers are right. Now finish the review: replace <code>FROM loans, customers</code> with an explicit <code>JOIN ... ON</code>.' },
          { re: /\bFROM\s+\w+\s+(?:AS\s+)?\w+\s+(?:INNER\s+|LEFT\s+)?JOIN\s+\w+\s+(?:AS\s+)?\w+\s+ON\b/i, msg: 'The numbers are right. Now give each table a short alias: <code>FROM loans l JOIN customers c ON ...</code>' },
          { re: /\bAS\s+loans\b/i, msg: 'The numbers are right. Name the count too, with <code>AS loans</code>.' },
          { re: /\bAS\s+outstanding\b/i, msg: 'The numbers are right. Name the total too, with <code>AS outstanding</code>.' },
          { re: /\bAS\s+npl_ratio_pct\b/i, msg: 'The numbers are right. Name the computed columns too, ending with <code>AS npl_ratio_pct</code>, so the next reader knows what they are.' },
          { re: /^(?![\s\S]*\bORDER\s+BY\s+\d)/i, msg: 'The numbers are right. Sort by a name in place of a column number: <code>ORDER BY npl_ratio_pct DESC</code>.' }
        ],
        altSolutions: [
          `WITH product_totals AS (SELECT l.product, COUNT(*) AS loans, SUM(l.outstanding) AS outstanding, SUM(CASE WHEN l.collectibility >= 3 THEN l.outstanding ELSE 0 END) AS npl_balance FROM loans l JOIN customers c ON c.customer_id = l.customer_id WHERE c.employment = 'Payroll' AND l.status <> 'Written Off' GROUP BY l.product) SELECT t.product, t.loans, t.outstanding, ROUND(100.0 * t.npl_balance / t.outstanding, 2) AS npl_ratio_pct FROM product_totals t ORDER BY npl_ratio_pct DESC;`,
          `SELECT l.product, COUNT(*) AS loans, SUM(l.outstanding) AS outstanding, ROUND(SUM(CASE WHEN l.collectibility IN (3, 4, 5) THEN l.outstanding ELSE 0 END) * 100.0 / SUM(l.outstanding), 2) AS npl_ratio_pct FROM customers c INNER JOIN loans l ON l.customer_id = c.customer_id WHERE c.employment = 'Payroll' AND l.status IN ('Active', 'Restructured') GROUP BY l.product ORDER BY npl_ratio_pct DESC;`
        ],
        wrong: [
          `SELECT l.product, COUNT(*) AS loans, SUM(l.outstanding) AS outstanding, ROUND(100.0 * SUM(CASE WHEN l.collectibility > 3 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) AS npl_ratio_pct FROM loans l JOIN customers c ON c.customer_id = l.customer_id WHERE c.employment = 'Payroll' AND l.status <> 'Written Off' GROUP BY l.product ORDER BY npl_ratio_pct DESC;`,
          `SELECT l.product, COUNT(*) AS loans, SUM(l.outstanding) AS outstanding, ROUND(100.0 * SUM(CASE WHEN l.collectibility >= 3 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) AS npl_ratio_pct FROM loans l JOIN customers c ON c.customer_id = l.customer_id WHERE c.employment = 'Payroll' GROUP BY l.product ORDER BY npl_ratio_pct DESC;`,
          `SELECT l.product, COUNT(*) AS loans, SUM(l.outstanding) AS outstanding, ROUND(100.0 * SUM(CASE WHEN l.collectibility >= 3 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) AS npl_ratio_pct FROM loans l JOIN customers c ON c.customer_id = l.customer_id WHERE c.employment = 'Payroll' AND l.status <> 'Written Off' GROUP BY l.product ORDER BY npl_ratio_pct ASC;`,
          `SELECT product, COUNT(*) AS loans, SUM(loans.outstanding) AS outstanding, ROUND(100.0 * SUM(CASE WHEN collectibility >= 3 THEN loans.outstanding ELSE 0 END) / SUM(loans.outstanding), 2) AS npl_ratio_pct FROM loans, customers WHERE loans.customer_id = customers.customer_id AND employment = 'Payroll' AND status <> 'Written Off' GROUP BY product ORDER BY npl_ratio_pct DESC;`,
          `SELECT l.product, COUNT(*), SUM(l.outstanding), ROUND(100.0 * SUM(CASE WHEN l.collectibility >= 3 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) FROM loans l JOIN customers c ON c.customer_id = l.customer_id WHERE c.employment = 'Payroll' AND l.status <> 'Written Off' GROUP BY l.product ORDER BY 4 DESC;`,
          `SELECT product, COUNT(*) AS loans, SUM(outstanding) AS outstanding, ROUND(100.0 * SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) / SUM(outstanding), 2) AS npl_ratio_pct FROM loans JOIN customers ON loans.customer_id = customers.customer_id WHERE employment = 'Payroll' AND status <> 'Written Off' GROUP BY product ORDER BY npl_ratio_pct DESC;`,
          `SELECT l.product, COUNT(*) AS loans, SUM(l.outstanding) AS outstanding, ROUND(100.0 * SUM(CASE WHEN l.collectibility >= 3 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) AS npl_ratio_pct FROM loans l JOIN customers c ON c.customer_id = l.customer_id WHERE c.employment = 'Payroll' AND l.status <> 'Written Off' GROUP BY l.product ORDER BY 4 DESC;`
        ],
        traps: [
          { re: /^(?![\s\S]*\bstatus\b)/i, msg: 'The request excludes Written Off loans, and this draft counts them. Add a filter on <code>status</code>.' },
          { re: /collectibility\s*>\s*3/i, msg: 'NPL includes Kol 3, and <code>&gt; 3</code> starts at Kol 4. Write <code>&gt;= 3</code>.' }
        ],
        hints: [
          `There are two number bugs. The draft includes write-offs, and its NPL test leaves out one grade. Fix those first.`,
          `Add <code>l.status &lt;&gt; 'Written Off'</code> to the filter, and test <code>l.collectibility &gt;= 3</code>.`,
          `Then tidy: <code>FROM loans l JOIN customers c ON c.customer_id = l.customer_id</code>, an <code>AS</code> name on each computed column, and <code>ORDER BY npl_ratio_pct DESC</code>.`
        ],
        win: `The draft ran with no error and put KPR on top at 13.63%, when Kartu Kredit is worst at 11.74% once write-offs are out and Kol 3 is in. That is why the numbers come first in a review.`,
        pattern: { sql: `-- Review order:\n-- 1. Right rows? Right filters?\n-- 2. Right numbers? 100.0, NULLs, fan-out\n-- 3. JOIN ... ON, aliases, AS names\n-- 4. One clause per line`, note: 'How a senior reviews a query' }
      },
      {
        id: '8.26',
        type: 'quiz',
        title: 'Other databases: the first N rows',
        newIdea: 'The core of SQL carries over, and row limits are written differently on each database.',
        teach: `<p>Almost everything you have learned works elsewhere, because the core of SQL is shared. Each [[dialect]] differs in the details, and row limits are the first thing you will hit.</p><table class="plain"><tr><th>Database</th><th>First 10 rows</th></tr><tr><td>SQLite, PostgreSQL, BigQuery</td><td><code>LIMIT 10</code></td></tr><tr><td>Oracle</td><td><code>FETCH FIRST 10 ROWS ONLY</code></td></tr><tr><td>SQL Server</td><td><code>SELECT TOP 10 ...</code></td></tr></table>`,
        bridge: 'Like moving between Excel and Google Sheets, where the thinking is the same and a few formulas have different names.',
        question: `Suppose your reporting database is Oracle. This query from the lab fails there. Which version gives the 10 largest loans?`,
        code: `SELECT loan_id, outstanding\nFROM loans\nORDER BY outstanding DESC\nLIMIT 10;`,
        choices: [
          { t: 'SELECT loan_id, outstanding FROM loans ORDER BY outstanding DESC FETCH FIRST 10 ROWS ONLY;', correct: true, why: 'Yes. This works on Oracle 12c and later. Older versions use ROWNUM around a subquery, so ask which version you are on.' },
          { t: 'SELECT TOP 10 loan_id, outstanding FROM loans ORDER BY outstanding DESC;', why: 'That is SQL Server. Oracle does not know TOP.' },
          { t: 'SELECT loan_id, outstanding FROM loans WHERE ROWNUM <= 10 ORDER BY outstanding DESC;', why: 'A classic trap. It runs, but it takes any 10 rows first and sorts those afterwards, so you get the wrong loans and no error.' },
          { t: 'The same query, because LIMIT works everywhere.', why: 'LIMIT works on SQLite, PostgreSQL and BigQuery. Oracle and SQL Server have their own forms, so this one stops with an error.' }
        ],
        win: `Find out which database your bank uses on day one. You now know what needs translating, and the dialect table in your Cheat sheet has the exact spelling.`
      },
      {
        id: '8.27',
        type: 'quiz',
        title: 'Other databases: dates and text',
        newIdea: 'Date and text functions have different names on each database, so translate them first.',
        teach: `<p>Date and text functions are the next things to change. In SQLite, <code>||</code> sticks text together, like <code>&amp;</code> in Excel. So <code>a || b</code> is Excel's <code>=A1&amp;B1</code>, and CONCAT works the same in Excel. Use this table as a start, and your Cheat sheet has more.</p><table class="plain"><tr><th>Database</th><th>Year and month</th><th>Stick text together</th></tr><tr><td>SQLite</td><td><code>strftime('%Y-%m', date_col)</code></td><td><code>text_a || text_b</code></td></tr><tr><td>Oracle, PostgreSQL</td><td><code>TO_CHAR(date_col, 'YYYY-MM')</code></td><td><code>text_a || text_b</code></td></tr><tr><td>SQL Server</td><td><code>FORMAT(date_col, 'yyyy-MM')</code></td><td><code>CONCAT(text_a, text_b)</code></td></tr><tr><td>BigQuery</td><td><code>FORMAT_DATE('%Y-%m', date_col)</code></td><td><code>CONCAT(text_a, text_b)</code></td></tr></table>`,
        bridge: 'Like & or CONCAT for text and TEXT(date, "yyyy-mm") for dates in Excel, where the format letters depend on the tool.',
        question: `A report is moving to SQL Server, where payment_date is a DATE column. Which version of this label works there?`,
        code: `SELECT loan_id || ' / ' || strftime('%Y-%m', payment_date) AS label\nFROM payments\nLIMIT 3;`,
        showCodeResult: true,
        choices: [
          { t: `SELECT TOP 3 CONCAT(loan_id, ' / ', FORMAT(payment_date, 'yyyy-MM')) AS label FROM payments;`, correct: true, why: 'Yes. CONCAT sticks the text together and FORMAT gives the month. Mind the capitals, because in FORMAT, MM is the month and mm is minutes.' },
          { t: `SELECT TOP 3 loan_id || ' / ' || TO_CHAR(payment_date, 'YYYY-MM') AS label FROM payments;`, why: 'The || and TO_CHAR parts are Oracle and PostgreSQL style. TO_CHAR does not exist on SQL Server.' },
          { t: `SELECT CONCAT(CAST(loan_id AS STRING), ' / ', FORMAT_DATE('%Y-%m', payment_date)) AS label FROM payments LIMIT 3;`, why: 'This is BigQuery style. SQL Server has no FORMAT_DATE, and it uses TOP where this uses LIMIT.' },
          { t: `The same query, because strftime is standard SQL.`, why: 'strftime belongs to SQLite. Standard SQL covers the core of the language, and date functions are where products differ most.' }
        ],
        win: `When a query moves, check three things first: row limits, date functions and text functions. They cause most of the errors, and each is a quick lookup in the Cheat sheet.`
      },
      {
        id: '8.28',
        mode: 'state',
        checkpoint: true,
        title: 'Checkpoint: a safe data fix',
        newIdea: 'A safe change has five steps: inspect, begin, change, verify, commit.',
        from: 'Citra, Head of Collection',
        teach: `<p>Every data change follows one routine:</p><ul><li><b>Inspect:</b> SELECT the rows and read them.</li><li><b>Begin:</b> open a transaction.</li><li><b>Change:</b> UPDATE only those rows.</li><li><b>Verify:</b> SELECT again and check.</li><li><b>Commit:</b> keep it, or ROLLBACK if anything looks wrong.</li></ul><p>The rule: Kol 1 is 0 DPD, Kol 2 is 1 to 90, Kol 3 is 91 to 120, Kol 4 is 121 to 180, Kol 5 is above 180. <code>CASE</code> also works inside <code>SET</code>, the same way it works in <code>SELECT</code>.</p>`,
        bridge: 'Like posting an adjustment, where you review the items, draft the entry, check that it balances, then post it.',
        task: `The Kol rule check finds six wrong loans. On this test copy, first run your rule check alone and read the six rows. Then write the full fix and press Run once: that SELECT, BEGIN, UPDATE only those loans to the right grade, SELECT again to confirm none are left, then COMMIT.`,
        solution: `SELECT loan_id, dpd, collectibility
FROM loans
WHERE collectibility <> ${KOL_RULE};

BEGIN;

UPDATE loans
SET collectibility = CASE WHEN dpd <= 120 THEN 3 ELSE 5 END
WHERE loan_id IN (84, 331, 336, 349, 386, 445);

SELECT COUNT(*) AS still_wrong
FROM loans
WHERE collectibility <> ${KOL_RULE};

COMMIT;`,
        stateQuery: `SELECT collectibility, COUNT(*) AS loans, SUM(dpd) AS total_dpd, SUM(outstanding) AS outstanding, SUM(status = 'Active') AS active_loans FROM loans GROUP BY collectibility`,
        requires: [
          { re: /\bSELECT\b[^;]*\bFROM\s+loans\b[^;]*;[\s\S]*\bBEGIN\b/i, msg: 'The data is right. Now add step one: a SELECT from <code>loans</code> above <code>BEGIN</code>, so you read the six loans before you change them.' },
          { re: /\bBEGIN\b[\s\S]*\bUPDATE\b/i, msg: 'The data is right, but the UPDATE ran with no safety net. Put <code>BEGIN</code> before it.' },
          { re: /\bUPDATE\b[^;]*\bWHERE\b/i, msg: 'The result is the same, but this UPDATE rewrote all 502 rows. Add a <code>WHERE</code> so you touch only the six you inspected.' },
          { re: /\bUPDATE\b[\s\S]*;\s*SELECT\b[^;]*\bFROM\s+loans\b[^;]*;[\s\S]*\bCOMMIT\b/i, msg: 'The data is right. Add the verify step: a separate SELECT from <code>loans</code> after the UPDATE and before <code>COMMIT</code>, and end with COMMIT so the fix is kept.' }
        ],
        altSolutions: [
          `SELECT loan_id, dpd, collectibility FROM loans WHERE loan_id IN (84, 331, 336, 349, 386, 445); BEGIN; UPDATE loans SET collectibility = 3 WHERE loan_id IN (84, 331, 336, 349); UPDATE loans SET collectibility = 5 WHERE loan_id IN (386, 445); SELECT loan_id, dpd, collectibility FROM loans WHERE loan_id IN (84, 331, 336, 349, 386, 445); COMMIT;`,
          `SELECT * FROM loans WHERE collectibility <> ${KOL_RULE}; BEGIN TRANSACTION; UPDATE loans SET collectibility = ${KOL_RULE} WHERE collectibility <> ${KOL_RULE}; SELECT COUNT(*) FROM loans WHERE collectibility <> ${KOL_RULE}; COMMIT;`
        ],
        wrong: [
          `SELECT * FROM loans WHERE collectibility <> ${KOL_RULE}; BEGIN; UPDATE loans SET collectibility = ${KOL_RULE}; SELECT COUNT(*) FROM loans WHERE collectibility <> ${KOL_RULE}; COMMIT;`,
          `UPDATE loans SET collectibility = ${KOL_RULE} WHERE collectibility <> ${KOL_RULE};`,
          `SELECT * FROM loans WHERE collectibility <> ${KOL_RULE}; BEGIN; UPDATE loans SET collectibility = 3 WHERE loan_id IN (84, 331, 336, 349); SELECT COUNT(*) FROM loans WHERE collectibility <> ${KOL_RULE}; COMMIT;`,
          `SELECT * FROM loans WHERE collectibility <> ${KOL_RULE}; BEGIN; UPDATE loans SET collectibility = 3 WHERE loan_id IN (84, 331, 336, 349, 386, 445); SELECT COUNT(*) FROM loans WHERE collectibility <> ${KOL_RULE}; COMMIT;`,
          `SELECT * FROM loans WHERE collectibility <> ${KOL_RULE}; BEGIN; UPDATE loans SET collectibility = ${KOL_RULE} WHERE collectibility <> ${KOL_RULE}; SELECT COUNT(*) FROM loans WHERE collectibility <> ${KOL_RULE};`,
          `SELECT * FROM loans WHERE collectibility <> ${KOL_RULE}; BEGIN; UPDATE loans SET collectibility = ${KOL_RULE} WHERE collectibility <> ${KOL_RULE}; SELECT COUNT(*) FROM loans WHERE collectibility <> ${KOL_RULE}; ROLLBACK;`,
          `SELECT * FROM loans WHERE collectibility <> ${KOL_RULE}; BEGIN; UPDATE loans SET collectibility = ${KOL_RULE} WHERE loan_id IN (SELECT loan_id FROM loans WHERE collectibility <> ${KOL_RULE}); COMMIT;`,
          `SELECT 1; BEGIN; UPDATE loans SET collectibility = ${KOL_RULE} WHERE collectibility <> ${KOL_RULE}; SELECT 1; COMMIT;`,
          `SELECT * FROM loans WHERE collectibility <> ${KOL_RULE}; BEGIN; UPDATE loans SET collectibility = ${KOL_RULE}, status = 'Restructured' WHERE collectibility <> ${KOL_RULE}; SELECT COUNT(*) FROM loans WHERE collectibility <> ${KOL_RULE}; COMMIT;`,
          `SELECT * FROM loans WHERE collectibility <> ${KOL_RULE};`
        ],
        traps: [
          { re: /\bROLLBACK\b/i, msg: '<code>ROLLBACK</code> undoes the fix. Once your verify step looks right, end with <code>COMMIT</code>.' },
          { re: /^(?![\s\S]*\bUPDATE\b)/i, msg: 'You have read the six rows. Now write the full fix and press Run once, with those loans in the UPDATE.' },
          { re: /\bSET\s+collectibility\s*=\s*\d[\s\S]*;(?![\s\S]*\bUPDATE\b)/i, msg: 'Check the grade for each loan. Two of the six are above 180 DPD, and they belong in Kol 5, while the other four belong in Kol 3.' }
        ],
        hints: [
          `Your inspect query is the rule check from Level 7: <code>WHERE collectibility &lt;&gt; CASE WHEN dpd = 0 THEN 1 ... END</code>.`,
          `Four loans are between 91 and 120 DPD, and they go to Kol 3. Two are above 180 DPD, and they go to Kol 5. Two UPDATEs work well, one for each grade.`,
          `CASE also works inside SET, the same way it works in SELECT: <code>CASE WHEN dpd &lt;= 120 THEN 3 ELSE 5 END</code>, with a <code>WHERE loan_id IN (...)</code> listing the six. Your verify query is the inspect query again, and it should now find nothing.`
        ],
        win: `Level 8 cleared, and you can now say exactly how a data fix was done: what you saw, what you changed and how you proved it. That record is what makes a change safe, on a test copy or in a change ticket.`,
        pattern: { sql: `-- 1. Inspect\nSELECT id_col, col_a FROM table_name WHERE condition;\n-- 2. Begin\nBEGIN;\n-- 3. Change\nUPDATE table_name SET col_a = 1 WHERE condition;\n-- 4. Verify\nSELECT COUNT(*) FROM table_name WHERE condition;\n-- 5. Commit (or ROLLBACK)\nCOMMIT;`, note: 'The safe data fix, start to finish' }
      }
    ]
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
