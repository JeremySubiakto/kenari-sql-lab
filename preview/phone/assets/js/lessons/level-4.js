/* Level 4: break hard questions into small steps, and read long queries calmly. */
(function (root) {
  (root.KENARI_LEVELS = root.KENARI_LEVELS || []).push({
    n: 4,
    title: 'Work in Steps',
    rank: 'Query Planner',
    tagline: 'Turn one hard question into a few small steps.',
    goal: 'Break a hard question into named steps, and read a long query without panic.',
    terms: {
      'inner query': 'The query inside the brackets. It is also called a subquery.',
      'outer query': 'The main query. It holds a subquery inside brackets.',
      'EXISTS': 'A test that is true when a subquery finds at least one row.',
      'correlated subquery': 'A subquery that uses a value from the outer query, so it runs again for each row.'
    },
    lessons: [
      {
        id: '4.1',
        title: 'A query inside a query',
        newIdea: 'A subquery in brackets can work out one value for the outer query to use.',
        from: 'Fitri, Desk Call lead',
        teach: `<p>Sometimes a filter needs a number you do not have yet, like an average. You could run one query, copy the number and type it into a second query. That typed number goes out of date as soon as the data changes.</p><p>A [[subquery]] does both jobs in one query. Write the first query in brackets, in the place where the number belongs. We call the query in brackets the [[inner query]], and the query around it the [[outer query]]. The database runs the inner query first, then uses its one value in the outer query.</p>`,
        ex: [
          ['SELECT loan_id, product, dpd', 'Show the loan, its product and its days past due'],
          ['FROM loans', 'from the loans table,'],
          ['WHERE dpd = (', 'keeping only loans whose days past due equal'],
          ['  SELECT MAX(dpd)', 'the highest value'],
          ['  FROM loans', 'anywhere in the loans table,'],
          [');', 'which the database works out first.']
        ],
        exNote: `The part in brackets could run alone. It returns one number, 617.`,
        bridge: 'Like a filter that reads from a cell holding =AVERAGE(...), in place of a number you typed.',
        task: `I want my senior callers on the larger [[KTA]] loans. Show <code>loan_id</code>, <code>customer_id</code> and <code>outstanding</code> for KTA loans whose <code>outstanding</code> is above the average <code>outstanding</code> of all KTA loans. Largest first.`,
        starter: `SELECT loan_id, customer_id, outstanding
FROM loans
WHERE product = 'KTA'
  AND outstanding > (
    SELECT ____(outstanding)
    FROM loans
    WHERE product = ____
  )
ORDER BY outstanding DESC;`,
        fill: ['AVG', `'KTA'`],
        solution: `SELECT loan_id, customer_id, outstanding
FROM loans
WHERE product = 'KTA'
  AND outstanding > (
    SELECT AVG(outstanding)
    FROM loans
    WHERE product = 'KTA'
  )
ORDER BY outstanding DESC;`,
        ordered: 'outstanding',
        hints: [
          `The average is the number you do not have yet, so the subquery works it out.`,
          `The first blank is the function for an average. The second blank is the product the inner query keeps.`,
          `The first blank is <code>AVG</code>. The second is <code>'KTA'</code>, with its single quotes.`
        ],
        requires: [{ re: /\(\s*SELECT\b/i, msg: `The result is right today, and that typed number will go out of date. Write the average as a subquery in brackets, so it is worked out fresh on every run.` },
          { re: /^(?![\s\S]*\(\s*SELECT\b(?:[^()]|\([^()]*\))*?\b(status|dpd)\b)/i, msg: `The rows match today, and the request says the average of all KTA loans. Take the status or DPD filter out of the brackets.` }
        ],
        traps: [
          { re: /WHERE[^()]*\bAVG\s*\(/i, msg: `<code>AVG</code> cannot sit directly in <code>WHERE</code>. Wrap it in its own query, in brackets: <code>(SELECT AVG(outstanding) FROM loans WHERE ...)</code>.` },
          { re: />\s*\(\s*SELECT\s+AVG\s*\(\s*outstanding\s*\)\s*FROM\s+loans\s*\)/i, msg: `Your subquery averages every product, and home loans make that number much bigger. Add <code>WHERE product = 'KTA'</code> inside the brackets too.` },
          { re: /^(?![\s\S]*product\s*=\s*'KTA'[\s\S]*product\s*=\s*'KTA')[\s\S]*\(\s*SELECT[\s\S]*product\s*=\s*'KTA'/i, msg: `The average in brackets covers KTA, and the outer query still reads every product. Add <code>product = 'KTA'</code> to the outer <code>WHERE</code> too.` }
        ],
        wrong: [
          `SELECT loan_id, customer_id, outstanding FROM loans WHERE product = 'KTA' AND outstanding > (SELECT AVG(outstanding) FROM loans) ORDER BY outstanding DESC;`,
          `SELECT loan_id, customer_id, outstanding FROM loans WHERE outstanding > (SELECT AVG(outstanding) FROM loans WHERE product = 'KTA') ORDER BY outstanding DESC;`,
          `SELECT loan_id, customer_id, outstanding FROM loans WHERE product = 'KTA' AND outstanding > (SELECT AVG(outstanding) FROM loans WHERE product = 'KTA');`,
          `SELECT loan_id, customer_id, outstanding FROM loans WHERE product = 'KTA' AND outstanding > 24643677 ORDER BY outstanding DESC;`,
          `SELECT loan_id, customer_id, outstanding FROM loans WHERE product = 'KTA' AND outstanding > (SELECT AVG(outstanding) FROM loans WHERE product = 'KTA' AND status <> 'Written Off') ORDER BY outstanding DESC;`
        ],
        altSolutions: [
          `SELECT loan_id, customer_id, outstanding FROM loans WHERE outstanding > (SELECT AVG(outstanding) FROM loans WHERE product = 'KTA') AND product = 'KTA' ORDER BY outstanding DESC;`,
          `SELECT l.loan_id, l.customer_id, l.outstanding FROM loans l WHERE l.product = 'KTA' AND l.outstanding > (SELECT SUM(x.outstanding) * 1.0 / COUNT(*) FROM loans x WHERE x.product = 'KTA') ORDER BY l.outstanding DESC;`
        ],
        pattern: { sql: `SELECT col_a\nFROM table_name\nWHERE col_b > (\n  SELECT AVG(col_b)\n  FROM table_name\n);`, note: 'Compare each row with one calculated value' },
        atWork: `A subquery used like this must return one value. If it returns several rows, SQLite quietly uses the first one. Oracle, SQL Server, BigQuery and PostgreSQL raise an error.`,
        win: `Nothing here was typed by hand, so the query stays correct when tomorrow's data arrives. A number pasted into a query is a common reason a monthly report goes wrong without anyone noticing.`
      },
      {
        id: '4.2',
        title: 'A subquery that returns a list',
        newIdea: 'IN can read its list from a subquery.',
        from: 'Fitri, Desk Call lead',
        teach: `<p>You have written <code>IN ('Field', 'Agency')</code> with a typed list. A [[subquery]] can build that list for you from another table. It must return one column, holding the same kind of value as the column before <code>IN</code>.</p><p>IN also keeps each row once, however many times its value appears in the list. A JOIN would repeat the row for every match.</p>`,
        ex: [
          ['SELECT customer_id, full_name', `Show each customer's ID and name`],
          ['FROM customers', 'from the customers table,'],
          ['WHERE customer_id IN (', 'keeping only customers found in'],
          ['  SELECT customer_id', 'the list of customer IDs'],
          ['  FROM loans', 'taken from the loans table'],
          ['  WHERE collectibility = 5', 'for loans graded Kol 5,'],
          [')', 'which ends the list,'],
          ['LIMIT 5;', 'and stop after 5 rows, to keep this preview short.']
        ],
        bridge: 'Like filtering with a list copied from another sheet, except this list rebuilds itself on every run.',
        task: `Wrong numbers waste calls, so these cases go to [[skip tracing]]. Show <code>loan_id</code>, <code>customer_id</code>, <code>product</code> and <code>dpd</code> for each overdue loan (<code>dpd</code> above 0) with at least one activity whose <code>result</code> is <code>'Wrong Number'</code>, dated 1 September 2026 or later. Each loan appears once.`,
        starter: `SELECT loan_id, customer_id, product, dpd
FROM loans
WHERE dpd > 0
  AND loan_id IN (
    -- Write the inner query here. It returns one column: loan_id.
  );`,
        solution: `SELECT loan_id, customer_id, product, dpd
FROM loans
WHERE dpd > 0
  AND loan_id IN (
    SELECT loan_id
    FROM collection_activities
    WHERE result = 'Wrong Number'
      AND activity_date >= '2026-09-01'
  );`,
        hints: [
          `Write the inner query first and think of it alone. Which table records the result of each contact attempt?`,
          `The inner query reads <code>collection_activities</code> and selects only <code>loan_id</code>. It needs two filters, one on <code>result</code> and one on <code>activity_date</code>.`,
          `Inside the brackets: <code>SELECT loan_id FROM collection_activities WHERE result = 'Wrong Number' AND activity_date >= '2026-09-01'</code>`
        ],
        requires: [
          { re: /\bIN\s*\(\s*SELECT\b/i, msg: `The list is right. This mission practices the other way to write it, so try <code>WHERE loan_id IN (SELECT ...)</code>, which needs no DISTINCT.` },
          { re: /^(?![\s\S]*\bactivity_date\s*>\s*'2026-09-01')/i, msg: `The rows match today, because no wrong number on an overdue loan falls on that date. The request says 1 September or later, so use <code>&gt;=</code> to include it.` }
        ],
        traps: [
          { re: /^(?![\s\S]*\bdpd\s*(>|<>|!=))/i, msg: `Some of these loans are not overdue. Add <code>dpd &gt; 0</code> to the outer <code>WHERE</code>.` },
          { re: /^(?![\s\S]*\bactivity_date\b)/i, msg: `This covers wrong numbers from any date. Add a filter inside the brackets for <code>activity_date</code> from <code>'2026-09-01'</code> onward.` },
          { re: /\bJOIN\b/i, msg: `A JOIN gives one row per matching activity, so a loan with two wrong numbers appears twice. <code>IN</code> keeps each loan once.` },
          { re: /\bIN\s*\(\s*SELECT\s+(\*|[\w.]+\s*,)/i, msg: `The list inside <code>IN</code> must have exactly one column. Select only <code>loan_id</code>.` },
          { re: /\bIN\s*\(\s*SELECT\s+(\w+\.)?(activity_id|customer_id|collector_id)\b/i, msg: `The list holds a different kind of ID from the column before <code>IN</code>. You are matching on <code>loan_id</code>, so select <code>loan_id</code>.` }
        ],
        wrong: [
          `SELECT l.loan_id, l.customer_id, l.product, l.dpd FROM loans l JOIN collection_activities a ON a.loan_id = l.loan_id WHERE l.dpd > 0 AND a.result = 'Wrong Number' AND a.activity_date >= '2026-09-01';`,
          `SELECT loan_id, customer_id, product, dpd FROM loans WHERE dpd > 0 AND loan_id IN (SELECT loan_id FROM collection_activities WHERE result = 'Wrong Number');`,
          `SELECT loan_id, customer_id, product, dpd FROM loans WHERE dpd > 0 AND loan_id IN (SELECT activity_id FROM collection_activities WHERE result = 'Wrong Number' AND activity_date >= '2026-09-01');`,
          `SELECT loan_id, customer_id, product, dpd FROM loans WHERE dpd > 0 AND loan_id IN (SELECT loan_id FROM collection_activities WHERE result = 'Wrong Number' AND activity_date >= '2026-10-01');`,
          `SELECT loan_id, customer_id, product, dpd FROM loans WHERE loan_id IN (SELECT loan_id FROM collection_activities WHERE result = 'Wrong Number' AND activity_date >= '2026-09-01');`,
          `SELECT loan_id, customer_id, product, dpd FROM loans WHERE dpd > 0 AND loan_id IN (SELECT loan_id FROM collection_activities WHERE result = 'Wrong Number' AND activity_date > '2026-09-01');`
        ],
        altSolutions: [
          `SELECT loan_id, customer_id, product, dpd FROM loans WHERE dpd > 0 AND loan_id IN (SELECT a.loan_id FROM collection_activities a WHERE a.result = 'Wrong Number' AND a.activity_date > '2026-08-31');`,
          `SELECT loan_id, customer_id, product, dpd FROM loans WHERE loan_id IN (SELECT DISTINCT loan_id FROM collection_activities WHERE result = 'Wrong Number' AND activity_date BETWEEN '2026-09-01' AND '2026-10-31') AND dpd <> 0;`
        ],
        pattern: { sql: `SELECT col_a\nFROM table_a\nWHERE id IN (\n  SELECT id\n  FROM table_b\n  WHERE col_b = 'value'\n);`, note: 'Filter using a list from another table' },
        win: `Those 10 loans can go to the team that finds better contact details. Turning a log of events into a clean list of cases is something you will do constantly in collection.`
      },
      {
        id: '4.3',
        title: 'An inner query that uses the outer query',
        newIdea: 'An inner query can use a column from the outer query, so it runs again for each row.',
        from: 'Fitri, Desk Call lead',
        teach: `<p>The inner queries so far could run alone. This one cannot, because it uses a column from the outer query, <code>l.loan_id</code>. The database runs it again for each row of the outer query, using that row's value. Here that means once per loan, with that loan's ID.</p><p>A subquery like this is a [[correlated subquery]]. The line that links the two queries is the important one.</p>`,
        ex: [
          [`SELECT l.loan_id, l.product`, `Show each loan's ID and product`],
          [`FROM loans l`, `from the loans table,`],
          [`WHERE (`, `keeping a loan only if`],
          [`  SELECT COUNT(*)`, `the number of rows`],
          [`  FROM loan_assignments g`, `in the assignments table`],
          [`  WHERE g.loan_id = l.loan_id`, `for the loan we are checking now`],
          [`) >= 3;`, `is 3 or more.`]
        ],
        exNote: `Run the part in brackets alone and you get an error, <code>no such column: l.loan_id</code>. It only works with a loan to check.`,
        bridge: 'Like COUNTIF in a helper column, where each row counts the matches for its own ID.',
        task: `Customers with several loans get calls from several people, and I want to review them. Show <code>customer_id</code>, <code>full_name</code> and <code>city</code> for each customer with 3 or more rows in <code>loans</code>.`,
        starter: `SELECT c.customer_id, c.full_name, c.city
FROM customers c
WHERE (
  SELECT ____(*)
  FROM loans l
  WHERE l.customer_id = ____
) >= 3;`,
        fill: ['COUNT', 'c.customer_id'],
        solution: `SELECT c.customer_id, c.full_name, c.city
FROM customers c
WHERE (
  SELECT COUNT(*)
  FROM loans l
  WHERE l.customer_id = c.customer_id
) >= 3;`,
        hints: [
          `For each customer, the inner query counts that customer's loans.`,
          `The first blank is the function that counts rows. The second blank is the outer customer's ID, the one that carries the alias <code>c</code>.`,
          `The blanks are <code>COUNT</code> and <code>c.customer_id</code>.`
        ],
        requires: [{ re: /\(\s*SELECT\b[\s\S]*\b(c|customers)\.customer_id\b/i, msg: `The customers are right. This mission practices an inner query that uses the outer query, so try counting inside brackets with <code>WHERE l.customer_id = c.customer_id</code>.` }],
        traps: [
          { re: /\(\s*SELECT\s+COUNT\s*\(\s*\*\s*\)\s*FROM\s+loans(\s+\w+)?\s*\)/i, msg: `Nothing in the brackets links to the outer customer, so every customer gets the same count. Add <code>WHERE l.customer_id = c.customer_id</code>.` },
          { re: /\bl\.customer_id\s*=\s*(l\.)?customer_id\b|WHERE\s+customer_id\s*=\s*customer_id\b/i, msg: `Inside the brackets, a plain <code>customer_id</code> means the inner table, so this compares a column with itself. Write the outer customer with its alias: <code>c.customer_id</code>.` },
          { re: /\)\s*>\s*3\b/, msg: `"3 or more" includes 3, so use <code>&gt;= 3</code>.` }
        ],
        wrong: [
          `SELECT c.customer_id, c.full_name, c.city FROM customers c WHERE (SELECT COUNT(*) FROM loans l) >= 3;`,
          `SELECT c.customer_id, c.full_name, c.city FROM customers c WHERE (SELECT COUNT(*) FROM loans l WHERE l.customer_id = customer_id) >= 3;`,
          `SELECT c.customer_id, c.full_name, c.city FROM customers c WHERE (SELECT COUNT(*) FROM loans l WHERE l.customer_id = c.customer_id) > 3;`,
          `SELECT c.customer_id, c.full_name, c.city FROM customers c JOIN loans l ON l.customer_id = c.customer_id GROUP BY c.customer_id, c.full_name, c.city HAVING COUNT(*) >= 3;`
        ],
        altSolutions: [
          `SELECT customer_id, full_name, city FROM customers WHERE (SELECT COUNT(*) FROM loans WHERE loans.customer_id = customers.customer_id) >= 3;`,
          `SELECT c.customer_id, c.full_name, c.city FROM customers c WHERE 3 <= (SELECT COUNT(l.loan_id) FROM loans l WHERE l.customer_id = c.customer_id);`
        ],
        pattern: { sql: `SELECT a.col_a\nFROM table_a a\nWHERE (\n  SELECT COUNT(*)\n  FROM table_b b\n  WHERE b.id = a.id\n) >= 2;`, note: 'Run an inner query again for each row' },
        win: `A count like this answers "how many does this one have?" and still gives one row per customer. The next missions build on this link between the two queries.`,
      },
      {
        id: '4.4',
        title: 'EXISTS: is there at least one?',
        newIdea: 'EXISTS keeps a row when its subquery finds at least one match for that row.',
        from: 'Ayu, Recovery team lead',
        teach: `<p>[[EXISTS]] asks a yes or no question about each row. It is true when the inner query finds at least one row.</p><p>The inner query links to the outer query, as in the last mission, so it runs again for each row. It needs a SELECT, but only "did a row come back?" matters, so people write <code>SELECT 1</code>.</p>`,
        ex: [
          [`SELECT k.collector_name`, `Show each person's name`],
          [`FROM collectors k`, `from the collectors table,`],
          [`WHERE k.team = 'Agency'`, `for the Agency team,`],
          [`  AND EXISTS (`, `keeping a person only if this finds at least one row:`],
          [`    SELECT 1`, `the value here does not matter,`],
          [`    FROM loan_assignments g`, `looking in the assignments table`],
          [`    WHERE g.collector_id = k.collector_id`, `for a loan held by the person we are checking now`],
          [`      AND g.unassigned_date IS NULL`, `that is still active,`],
          [`  );`, `which ends the test.`]
        ],
        exNote: `Eko Hartono leads the agencies and holds no loans himself, so he is not in this list.`,
        bridge: 'Like a helper column with COUNTIF(range, this_row) > 0, filtered to TRUE.',
        task: `I am reviewing every customer with a [[write-off]]. Show <code>customer_id</code>, <code>full_name</code> and <code>phone</code> for each customer who has at least one loan with <code>status</code> <code>'Written Off'</code>. Use <code>EXISTS</code>.`,
        starter: `SELECT c.customer_id, c.full_name, c.phone
FROM customers c
WHERE EXISTS (
  SELECT 1
  FROM ____ l
  WHERE l.customer_id = ____
    AND l.status = 'Written Off'
);`,
        fill: ['loans', 'c.customer_id'],
        solution: `SELECT c.customer_id, c.full_name, c.phone
FROM customers c
WHERE EXISTS (
  SELECT 1
  FROM loans l
  WHERE l.customer_id = c.customer_id
    AND l.status = 'Written Off'
);`,
        hints: [
          `For each customer, the inner query looks for one of their written-off loans.`,
          `The first blank is the table that holds loans. The second blank is the outer customer's ID, the one that carries the alias <code>c</code>.`,
          `The blanks are <code>loans</code> and <code>c.customer_id</code>.`
        ],
        requires: [{ re: /\bEXISTS\b/i, msg: `The customers are right. This mission practices <code>EXISTS</code>, so try writing the test as <code>WHERE EXISTS (SELECT 1 FROM loans l WHERE ...)</code>.` }],
        traps: [
          { re: /\bNOT\s+EXISTS\b/i, msg: `<code>NOT EXISTS</code> keeps customers with no written-off loan. This request wants customers with at least one, so remove the <code>NOT</code>.` },
          { re: /\bl\.customer_id\s*=\s*l\.customer_id\b/i, msg: `This compares the loan's customer with itself, which is always true. The right side should be the outer row, <code>c.customer_id</code>.` },
          { re: /\bEXISTS\s*\((?![\s\S]*\b(c|customers)\.customer_id)/i, msg: `Nothing inside the brackets links to the outer customer. Without that link, the test gives the same answer for every customer.` }
        ],
        wrong: [
          `SELECT c.customer_id, c.full_name, c.phone FROM customers c WHERE EXISTS (SELECT 1 FROM loans l WHERE l.status = 'Written Off');`,
          `SELECT c.customer_id, c.full_name, c.phone FROM customers c WHERE EXISTS (SELECT 1 FROM loans l WHERE l.customer_id = l.customer_id AND l.status = 'Written Off');`,
          `SELECT c.customer_id, c.full_name, c.phone FROM customers c WHERE NOT EXISTS (SELECT 1 FROM loans l WHERE l.customer_id = c.customer_id AND l.status = 'Written Off');`,
          `SELECT c.customer_id, c.full_name, c.phone FROM customers c WHERE c.customer_id IN (SELECT customer_id FROM loans WHERE status = 'Written Off');`
        ],
        altSolutions: [
          `SELECT customer_id, full_name, phone FROM customers WHERE EXISTS (SELECT * FROM loans WHERE loans.customer_id = customers.customer_id AND loans.status = 'Written Off');`,
          `SELECT c.customer_id, c.full_name, c.phone FROM customers c WHERE EXISTS (SELECT l.loan_id FROM loans l WHERE l.status = 'Written Off' AND c.customer_id = l.customer_id);`
        ],
        pattern: { sql: `SELECT a.col_a\nFROM table_a a\nWHERE EXISTS (\n  SELECT 1\n  FROM table_b b\n  WHERE b.id = a.id\n);`, note: 'Keep rows that have at least one match' },
        win: `IN and EXISTS often return the same rows, and you will see both at work. EXISTS can stop at the first match, so on large tables it can be faster.`
      },
      {
        id: '4.5',
        title: 'NOT EXISTS: find what is missing',
        newIdea: 'NOT EXISTS keeps a row when its subquery finds no match.',
        from: 'Dimas, Portfolio Analyst',
        teach: `<p>Put <code>NOT</code> in front of [[EXISTS]] and the test flips. A row stays only when the subquery finds nothing.</p><p>In mission 3.8 you found missing rows with an [[anti-join]], a LEFT JOIN plus <code>IS NULL</code>. NOT EXISTS gives the same answer and reads closer to the request, "customers where no loan exists". You will see both at work, so it helps to read both.</p>`,
        ex: [
          [`SELECT k.collector_name, k.team`, `Show each person's name and team`],
          [`FROM collectors k`, `from the collectors table,`],
          [`WHERE NOT EXISTS (`, `keeping a person only if this finds no row:`],
          [`  SELECT 1`, `the value here does not matter,`],
          [`  FROM loan_assignments g`, `looking in the assignments table`],
          [`  WHERE g.collector_id = k.collector_id`, `for a loan held by the person we are checking now,`],
          [`);`, `which ends the test.`]
        ],
        bridge: 'A lookup that returns #N/A marks what is missing, and NOT EXISTS keeps exactly those rows.',
        task: `A customer record with no loan behind it may be a leftover or a load error. Find the customers who hold no loan at all so I can check them. Show <code>customer_id</code>, <code>full_name</code> and <code>city</code>. Use <code>NOT EXISTS</code>.`,
        starter: `SELECT c.customer_id, c.full_name, c.city
FROM customers c
WHERE NOT EXISTS (
  -- Look in loans for a row belonging to this customer.
);`,
        solution: `SELECT c.customer_id, c.full_name, c.city
FROM customers c
WHERE NOT EXISTS (
  SELECT 1
  FROM loans l
  WHERE l.customer_id = c.customer_id
);`,
        hints: [
          `Describe what must not exist. It is a loan row belonging to this customer.`,
          `Inside the brackets, select from <code>loans</code> and link its <code>customer_id</code> to the outer customer.`,
          `Inside the brackets: <code>SELECT 1 FROM loans l WHERE l.customer_id = c.customer_id</code>`
        ],
        requires: [{ re: /\bNOT\s+EXISTS\b/i, msg: `The customers are right. This mission practices <code>NOT EXISTS</code>, so try writing the same test that way.` }],
        traps: [
          { re: /^(?![\s\S]*\bNOT\b)[\s\S]*\bEXISTS\b/i, msg: `<code>EXISTS</code> keeps the customers who do have a loan. This request wants the others, so write <code>NOT EXISTS</code>.` },
          { re: /\bNOT\s+EXISTS\s*\((?![\s\S]*\b(c|customers)\.customer_id)/i, msg: `Nothing inside the brackets links to the outer customer. The loans table has rows, so "no loan exists" is false for everyone and you get nothing back. Add <code>WHERE l.customer_id = c.customer_id</code>.` }
        ],
        wrong: [
          `SELECT c.customer_id, c.full_name, c.city FROM customers c WHERE NOT EXISTS (SELECT 1 FROM loans l);`,
          `SELECT c.customer_id, c.full_name, c.city FROM customers c WHERE EXISTS (SELECT 1 FROM loans l WHERE l.customer_id = c.customer_id);`,
          `SELECT c.customer_id, c.full_name, c.city FROM customers c LEFT JOIN loans l ON l.customer_id = c.customer_id WHERE l.loan_id IS NULL;`
        ],
        altSolutions: [
          `SELECT customer_id, full_name, city FROM customers WHERE NOT EXISTS (SELECT * FROM loans WHERE loans.customer_id = customers.customer_id);`
        ],
        pattern: { sql: `SELECT a.col_a\nFROM table_a a\nWHERE NOT EXISTS (\n  SELECT 1\n  FROM table_b b\n  WHERE b.id = a.id\n);`, note: 'Keep rows that have no match' },
        win: `"This should have a match and does not" is one of the first things a system check looks for. You now have two ways to write it, and you can read both in a colleague's query.`
      },
      {
        id: '4.6',
        title: 'A subquery as a temporary table',
        newIdea: 'A subquery in FROM acts as a table you built a moment ago.',
        from: 'Citra, Head of Collection',
        teach: `<p>The result of any query is a table, so you can query that result. Put a [[subquery]] after <code>FROM</code>, give it a name, and read from it like any other table.</p><p>This solves a common problem. You want the average of the per-loan counts. <code>AVG(COUNT(*))</code> raises an error here, because a SELECT cannot do two calculations stacked like that. So use two queries. The inner query counts per loan, and the outer query averages those counts.</p>`,
        ex: [
          ['SELECT ROUND(AVG(loan_total), 0) AS avg_per_loan', 'Show the average of the per-loan totals, rounded to a whole number,'],
          ['FROM (', 'reading from a temporary table'],
          ['  SELECT loan_id, SUM(amount) AS loan_total', 'that holds each loan and its total paid'],
          ['  FROM payments', 'from the payments table,'],
          [`  WHERE channel = 'Collector'`, 'counting only money received through a collector,'],
          ['  GROUP BY loan_id', 'with one row per loan,'],
          [') per_loan;', 'and that temporary table is named per_loan.']
        ],
        bridge: 'Like building a PivotTable, then running AVERAGE over its values column.',
        task: `I want to know how much effort each overdue case gets. Among overdue loans (<code>dpd</code> above 0) with at least one activity, find the average number of activities per loan. Return one number named <code>avg_activities</code>, rounded to 2 decimals.`,
        starter: `SELECT ROUND(AVG(____), 2) AS avg_activities
FROM (
  SELECT a.loan_id, COUNT(*) AS activity_count
  FROM collection_activities a
  JOIN loans l
    ON l.loan_id = a.loan_id
  WHERE l.dpd > 0
  GROUP BY ____
) per_loan;`,
        fill: ['activity_count', 'a.loan_id'],
        solution: `SELECT ROUND(AVG(activity_count), 2) AS avg_activities
FROM (
  SELECT a.loan_id, COUNT(*) AS activity_count
  FROM collection_activities a
  JOIN loans l
    ON l.loan_id = a.loan_id
  WHERE l.dpd > 0
  GROUP BY a.loan_id
) per_loan;`,
        hints: [
          `The inner query makes one row per loan. The outer query averages one of its columns.`,
          `The first blank is the name the inner query gave its count. The second blank makes one row per loan.`,
          `The blanks are <code>activity_count</code> and <code>a.loan_id</code>.`
        ],
        requires: [{ re: /\bFROM\s*\(\s*SELECT\b/i, msg: `The number is right. This mission practices a subquery in <code>FROM</code>, which also works for questions that a single division cannot answer. Try writing it with one count per loan on the inside.` }],
        traps: [
          { re: /\bAVG\s*\(\s*COUNT\s*\(/i, msg: `A SELECT here cannot stack two calculations like <code>AVG(COUNT(*))</code>. Count in the inner query and average in the outer query.` },
          { re: /^(?![\s\S]*\bdpd\b)/i, msg: `This covers every loan with an activity. The request is about overdue loans, so add <code>WHERE l.dpd &gt; 0</code> inside the brackets.` },
          { re: /\bFROM\s*\(\s*SELECT\b(?![\s\S]*\bGROUP\s+BY\b)/i, msg: `Without <code>GROUP BY</code>, the inner query puts all the loans into one row. Group by the loan to get one count per loan.` },
          { re: /\/\s*COUNT\s*\(\s*DISTINCT\b/i, msg: `Dividing one whole count by another drops the decimals, so 13.13 comes out as 13. A subquery in <code>FROM</code> avoids this, because on SQLite <code>AVG</code> keeps its decimals.` },
          { re: /\bLEFT\s+JOIN\b/i, msg: `A LEFT JOIN keeps overdue loans with zero activities, and this request covers only loans with at least one.` }
        ],
        wrong: [
          `SELECT ROUND(AVG(activity_count), 2) AS avg_activities FROM (SELECT l.loan_id, COUNT(a.activity_id) AS activity_count FROM loans l LEFT JOIN collection_activities a ON a.loan_id = l.loan_id WHERE l.dpd > 0 GROUP BY l.loan_id) per_loan;`,
          `SELECT ROUND(AVG(activity_count), 2) AS avg_activities FROM (SELECT a.loan_id, COUNT(*) AS activity_count FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id GROUP BY a.loan_id) per_loan;`,
          `SELECT ROUND(AVG(activity_count), 2) AS avg_activities FROM (SELECT a.loan_id, COUNT(*) AS activity_count FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id WHERE l.dpd > 0) per_loan;`,
          `SELECT COUNT(*) / COUNT(DISTINCT a.loan_id) AS avg_activities FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id WHERE l.dpd > 0;`
        ],
        altSolutions: [
          `SELECT ROUND(AVG(activity_count), 2) AS avg_activities FROM (SELECT loan_id, COUNT(*) AS activity_count FROM collection_activities WHERE loan_id IN (SELECT loan_id FROM loans WHERE dpd > 0) GROUP BY loan_id);`,
          `SELECT ROUND(AVG(n), 2) AS avg_activities FROM (SELECT l.loan_id, COUNT(a.activity_id) AS n FROM loans l JOIN collection_activities a ON a.loan_id = l.loan_id WHERE l.dpd > 0 GROUP BY l.loan_id) per_loan;`
        ],
        pattern: { sql: `SELECT AVG(row_count)\nFROM (\n  SELECT id, COUNT(*) AS row_count\n  FROM table_name\n  GROUP BY id\n) per_id;`, note: 'Group once, then calculate on the groups' },
        atWork: `Always give a subquery in FROM a name, because SQL Server and many other databases require one. We leave out AS here, because Oracle rejects it and every other database accepts this form. On SQL Server, AVG of a COUNT gives a whole number, so write <code>AVG(activity_count * 1.0)</code>. Oracle allows <code>AVG(COUNT(*))</code> with GROUP BY, and the two-query form works everywhere.`,
        win: `The 15 overdue loans with no activity are not in this average, so mention them when you send the number. Good analysts always say what a figure leaves out.`
      },
      {
        id: '4.7',
        title: 'Name a step with WITH',
        newIdea: 'WITH gives a step a name, and the query below it can read that step like a table.',
        from: 'Rudi, Credit Risk',
        teach: `<p>A subquery in FROM works, but you have to read it from the inside out. A [[CTE]] moves that step to the top and gives it a name. The query then reads from top to bottom, in the order you think about it.</p><p>Write <code>WITH name AS ( ... )</code>, then your main SELECT straight after it.</p>`,
        ex: [
          ['WITH collector_load AS (', 'First make a step called collector_load'],
          ['  SELECT collector_id, COUNT(*) AS activity_count', 'that counts activities for each collector'],
          ['  FROM collection_activities', 'from the activity log,'],
          ['  GROUP BY collector_id', 'with one row per collector,'],
          [')', 'and then'],
          ['SELECT k.collector_name, cl.activity_count', 'show each name and count'],
          ['FROM collector_load cl', 'reading from that step,'],
          ['JOIN collectors k ON k.collector_id = cl.collector_id', 'matched to the collectors table for the names,'],
          ['WHERE cl.activity_count > 100', 'keeping people above 100 activities,'],
          ['ORDER BY cl.activity_count DESC;', 'busiest first.']
        ],
        bridge: 'Like a helper sheet with a clear tab name, which your final sheet reads from.',
        task: `Show our largest borrowers. For each customer, add up <code>outstanding</code> across all their loans, whatever the status. Show <code>customer_id</code>, <code>full_name</code> and <code>total_outstanding</code> for customers above Rp 450,000,000, largest first. Use <code>WITH</code>.`,
        starter: `WITH customer_totals AS (
  SELECT customer_id, ____(outstanding) AS total_outstanding
  FROM loans
  GROUP BY ____
)
SELECT c.customer_id, c.full_name, t.total_outstanding
FROM ____ t
JOIN customers c
  ON c.customer_id = t.customer_id
WHERE t.total_outstanding > 450000000
ORDER BY t.total_outstanding DESC;`,
        fill: ['SUM', 'customer_id', 'customer_totals'],
        solution: `WITH customer_totals AS (
  SELECT customer_id, SUM(outstanding) AS total_outstanding
  FROM loans
  GROUP BY customer_id
)
SELECT c.customer_id, c.full_name, t.total_outstanding
FROM customer_totals t
JOIN customers c
  ON c.customer_id = t.customer_id
WHERE t.total_outstanding > 450000000
ORDER BY t.total_outstanding DESC;`,
        ordered: 'total_outstanding',
        hints: [
          `The step makes one row per customer with their total. The main query adds the name and applies the limit.`,
          `The first two blanks are the adding function and the grouping column. The last blank is the name of your step.`,
          `The blanks are <code>SUM</code>, <code>customer_id</code> and <code>customer_totals</code>.`
        ],
        requires: [{ re: /\bWITH\b/i, msg: `The result is right. This mission practices named steps, so move the per-customer totals into <code>WITH customer_totals AS ( ... )</code> and read from that.` },
          { re: /^(?![\s\S]*\bGROUP\s+BY\s+(\w+\.)?full_name\b(?!\s*,))/i, msg: `The rows match today, because no two customers here share a name. In a real bank they can, so group by <code>customer_id</code>.` }
        ],
        traps: [
          { re: /\)\s*,\s*SELECT\b/i, msg: `Take out the comma before the main <code>SELECT</code>. Commas only go between steps.` },
          { re: /\bprincipal\b/i, msg: `<code>principal</code> is the original amount lent. This request wants what is still owed, which is <code>outstanding</code>.` },
          { re: /^(?![\s\S]*450000000)(?![\s\S]*450[,.]000)/i, msg: `The request only wants customers above Rp 450,000,000, so filter on the total.` },
          { re: /450[,.]000/, msg: `Type large numbers with no commas or dots: <code>450000000</code>.` },
          { re: /\bstatus\b/i, msg: `This request covers all of a customer's loans, whatever the status, so no filter on <code>status</code> is needed. Written-off loans count here, because the customer still owes the money.` }
        ],
        wrong: [
          `WITH customer_totals AS (SELECT customer_id, SUM(outstanding) AS total_outstanding FROM loans WHERE status <> 'Written Off' GROUP BY customer_id) SELECT c.customer_id, c.full_name, t.total_outstanding FROM customer_totals t JOIN customers c ON c.customer_id = t.customer_id WHERE t.total_outstanding > 450000000 ORDER BY t.total_outstanding DESC;`,
          `WITH customer_totals AS (SELECT c.customer_id, c.full_name, SUM(l.outstanding) AS total_outstanding FROM loans l JOIN customers c ON c.customer_id = l.customer_id GROUP BY c.full_name) SELECT customer_id, full_name, total_outstanding FROM customer_totals WHERE total_outstanding > 450000000 ORDER BY total_outstanding DESC;`,
          `WITH customer_totals AS (SELECT customer_id, SUM(principal) AS total_outstanding FROM loans GROUP BY customer_id) SELECT c.customer_id, c.full_name, t.total_outstanding FROM customer_totals t JOIN customers c ON c.customer_id = t.customer_id WHERE t.total_outstanding > 450000000 ORDER BY t.total_outstanding DESC;`,
          `SELECT c.customer_id, c.full_name, SUM(l.outstanding) AS total_outstanding FROM loans l JOIN customers c ON c.customer_id = l.customer_id GROUP BY c.customer_id, c.full_name HAVING SUM(l.outstanding) > 450000000 ORDER BY total_outstanding DESC;`,
          `WITH customer_totals AS (SELECT customer_id, SUM(outstanding) AS total_outstanding FROM loans GROUP BY customer_id) SELECT c.customer_id, c.full_name, t.total_outstanding FROM customer_totals t JOIN customers c ON c.customer_id = t.customer_id ORDER BY t.total_outstanding DESC;`
        ],
        altSolutions: [
          `WITH customer_totals AS (SELECT customer_id, SUM(outstanding) AS total_outstanding FROM loans GROUP BY customer_id HAVING SUM(outstanding) > 450000000) SELECT c.customer_id, c.full_name, t.total_outstanding FROM customer_totals t JOIN customers c ON c.customer_id = t.customer_id ORDER BY t.total_outstanding DESC;`,
          `WITH big AS (SELECT customer_id, SUM(outstanding) AS total_outstanding FROM loans GROUP BY customer_id) SELECT customers.customer_id, customers.full_name, big.total_outstanding FROM customers JOIN big ON big.customer_id = customers.customer_id WHERE big.total_outstanding > 450000000 ORDER BY 3 DESC;`
        ],
        pattern: { sql: `WITH step_name AS (\n  SELECT id, SUM(col_a) AS total\n  FROM table_name\n  GROUP BY id\n)\nSELECT id, total\nFROM step_name\nWHERE total > 100;`, note: 'Name a step, then read from it' },
        atWork: `CTEs work the same way in Oracle, SQL Server, BigQuery and PostgreSQL. On SQL Server, the statement before a WITH must end with a semicolon.`,
        win: `This total is the customer's [[exposure]], and it counts written-off loans because the customer still owes that money and collection continues. Risk teams often count only [[on-book]] loans as exposure, so always say which one you mean.`
      },
      {
        id: '4.8',
        title: 'Chain two steps together',
        newIdea: 'A later CTE can read from an earlier one, with a comma between them.',
        from: 'Citra, Head of Collection',
        teach: `<p>Several [[CTE]]s let you solve a hard question one small piece at a time. Each step can read any step above it. Put a comma after each step except the last, and write <code>WITH</code> only once.</p><p>In this task, [[NPL]] means Kol 3, 4 or 5. This report is about the balance sheet, so written-off loans stay out. The first step removes them, so you are left with [[on-book]] loans.</p>`,
        ex: [
          ['WITH serious_loans AS (', 'Make a first step called serious_loans'],
          ['  SELECT product, outstanding', `that keeps each loan's product and balance`],
          ['  FROM loans', 'from the loans table,'],
          ['  WHERE dpd > 90', 'for loans over 90 days past due'],
          [`    AND status <> 'Written Off'`, 'that are [[on-book]],'],
          ['),', 'and after a comma,'],
          ['product_totals AS (', 'make a second step called product_totals'],
          ['  SELECT product, SUM(outstanding) AS total_outstanding', 'that adds up those balances'],
          ['  FROM serious_loans', 'reading from the first step,'],
          ['  GROUP BY product', 'with one row per product,'],
          [')', 'and finally'],
          ['SELECT product, total_outstanding', 'show the product and its balance'],
          ['FROM product_totals;', 'from the second step.']
        ],
        exNote: `Each step reads the one above it, so you can check them one at a time.`,
        bridge: 'Like sheets that feed each other, where Data feeds Workings and Workings feeds Summary.',
        task: `Per branch, I need the [[on-book]] balance and the NPL balance. Finish the second step, <code>branch_totals</code>. It reads <code>on_book_loans</code>, one row per <code>branch_id</code>, with <code>total_outstanding</code> and <code>npl_balance</code> (<code>collectibility</code> 3 or higher). Both totals share one row, so a WHERE on collectibility would reduce both. Use the SUMIF pattern from Level 2. Show <code>branch_name</code> and both totals.`,
        starter: `WITH on_book_loans AS (
  SELECT branch_id, collectibility, outstanding
  FROM loans
  WHERE status <> 'Written Off'
),
branch_totals AS (
  -- SELECT branch_id, SUM(...) AS total_outstanding,
  --   SUM(CASE WHEN ... THEN ... ELSE 0 END) AS npl_balance
  -- FROM on_book_loans GROUP BY branch_id
)
SELECT b.branch_name, t.total_outstanding, t.npl_balance
FROM branch_totals t
JOIN branches b
  ON b.branch_id = t.branch_id;`,
        solution: `WITH on_book_loans AS (
  SELECT branch_id, collectibility, outstanding
  FROM loans
  WHERE status <> 'Written Off'
),
branch_totals AS (
  SELECT branch_id,
    SUM(outstanding) AS total_outstanding,
    SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) AS npl_balance
  FROM on_book_loans
  GROUP BY branch_id
)
SELECT b.branch_name, t.total_outstanding, t.npl_balance
FROM branch_totals t
JOIN branches b
  ON b.branch_id = t.branch_id;`,
        hints: [
          `The second step is a normal GROUP BY query. Its FROM names the first step, as if that were a table.`,
          `The first total is a plain <code>SUM(outstanding)</code>. The NPL total needs <code>CASE</code> inside <code>SUM</code>, the same SUMIF idea from Level 2.`,
          `Inside the brackets: <code>SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) AS npl_balance FROM on_book_loans GROUP BY branch_id</code>`
        ],
        requires: [{ re: /\bWITH\b[\s\S]*\)\s*,\s*\w+\s+AS\s*\(/i, msg: `The numbers are right. This mission practices chaining, so keep two named steps: <code>on_book_loans</code>, then <code>branch_totals</code> reading from it.` }],
        traps: [
          { re: /branch_totals\s+AS\s*\([\s\S]*?\bWHERE\b[\s\S]*?collectibility/i, msg: `A WHERE here removes rows from both totals. Keep every row, and put the test inside CASE: <code>SUM(CASE WHEN collectibility &gt;= 3 THEN outstanding ELSE 0 END)</code>.` },
          { re: /branch_totals\s+AS\s*\([\s\S]*?\bFROM\s+loans\b/i, msg: `This step reads <code>loans</code> again, so written-off loans come back. Read from <code>on_book_loans</code>.` },
          { re: /\)\s*,\s*SELECT\b/i, msg: `Take out the comma before the main <code>SELECT</code>. Commas only go between steps.` },
          { re: /\)\s*,?\s*WITH\b/i, msg: `Write <code>WITH</code> only once, at the very start. Later steps start with their name.` },
          { re: /^(?![\s\S]*\bstatus\b)/i, msg: `Written-off loans are still in this total. The first step should keep <code>WHERE status &lt;&gt; 'Written Off'</code>.` },
          { re: /collectibility\s*>\s*3\b/i, msg: `NPL means Kol 3, 4 or 5, so Kol 3 counts. Use <code>&gt;= 3</code>.` },
          { re: /THEN\s+1\b/i, msg: `<code>THEN 1</code> counts loans. This request wants the balance, so use <code>THEN outstanding</code>.` }
        ],
        wrong: [
          `WITH branch_totals AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) AS npl_balance FROM loans WHERE status <> 'Written Off' GROUP BY branch_id) SELECT b.branch_name, t.total_outstanding, t.npl_balance FROM branch_totals t JOIN branches b ON b.branch_id = t.branch_id;`,
          `WITH on_book_loans AS (SELECT branch_id, collectibility, outstanding FROM loans), branch_totals AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) AS npl_balance FROM on_book_loans GROUP BY branch_id) SELECT b.branch_name, t.total_outstanding, t.npl_balance FROM branch_totals t JOIN branches b ON b.branch_id = t.branch_id;`,
          `WITH on_book_loans AS (SELECT branch_id, collectibility, outstanding FROM loans WHERE status <> 'Written Off'), branch_totals AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(CASE WHEN collectibility > 3 THEN outstanding ELSE 0 END) AS npl_balance FROM on_book_loans GROUP BY branch_id) SELECT b.branch_name, t.total_outstanding, t.npl_balance FROM branch_totals t JOIN branches b ON b.branch_id = t.branch_id;`,
          `WITH on_book_loans AS (SELECT branch_id, collectibility, outstanding FROM loans WHERE status <> 'Written Off'), branch_totals AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(CASE WHEN collectibility >= 3 THEN 1 ELSE 0 END) AS npl_balance FROM on_book_loans GROUP BY branch_id) SELECT b.branch_name, t.total_outstanding, t.npl_balance FROM branch_totals t JOIN branches b ON b.branch_id = t.branch_id;`,
          `WITH on_book_loans AS (SELECT branch_id, collectibility, outstanding FROM loans WHERE status <> 'Written Off'), branch_totals AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(outstanding) AS npl_balance FROM on_book_loans WHERE collectibility >= 3 GROUP BY branch_id) SELECT b.branch_name, t.total_outstanding, t.npl_balance FROM branch_totals t JOIN branches b ON b.branch_id = t.branch_id;`,
          `WITH on_book_loans AS (SELECT branch_id, collectibility, outstanding FROM loans WHERE status <> 'Written Off'), branch_totals AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) AS npl_balance FROM loans GROUP BY branch_id) SELECT b.branch_name, t.total_outstanding, t.npl_balance FROM branch_totals t JOIN branches b ON b.branch_id = t.branch_id;`
        ],
        altSolutions: [
          `WITH on_book_loans AS (SELECT branch_id, collectibility, outstanding FROM loans WHERE status <> 'Written Off'), branch_totals AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(outstanding) FILTER (WHERE collectibility IN (3, 4, 5)) AS npl_balance FROM on_book_loans GROUP BY branch_id) SELECT b.branch_name, t.total_outstanding, t.npl_balance FROM branch_totals t JOIN branches b ON b.branch_id = t.branch_id;`,
          `WITH on_book_loans AS (SELECT branch_id, collectibility, outstanding FROM loans WHERE status <> 'Written Off'), branch_totals AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(iif(collectibility >= 3, outstanding, 0)) AS npl_balance FROM on_book_loans GROUP BY branch_id) SELECT b.branch_name, t.total_outstanding, t.npl_balance FROM branches b JOIN branch_totals t ON t.branch_id = b.branch_id ORDER BY b.branch_name;`
        ],
        pattern: { sql: `WITH step_one AS (\n  SELECT id, col_a\n  FROM table_name\n  WHERE col_b = 'value'\n),\nstep_two AS (\n  SELECT id, SUM(col_a) AS total\n  FROM step_one\n  GROUP BY id\n)\nSELECT id, total\nFROM step_two;`, note: 'One step feeds the next. Comma between steps.' },
        win: `Each step can be checked by itself, so you can find a wrong number quickly. Large reports are often built this way, as one small step after another.`
      },
      {
        id: '4.9',
        title: 'Work out the ratio in the last step',
        newIdea: 'In a chain, work out a ratio in the last step, once its two columns exist.',
        from: 'Citra, Head of Collection',
        teach: `<p>As you saw in Level 2, write <code>100.0 * part / whole</code>, so the decimals survive the division.</p><p>In a chain, work out a ratio in the last step. The earlier steps build its two columns, and the last step divides one by the other. Each step then stays small enough to check alone.</p>`,
        ex: [
          [`WITH type_totals AS (`, `Make a step called type_totals`],
          [`  SELECT activity_type, COUNT(*) AS activities,`, `that counts activities for each type`],
          [`    SUM(CASE WHEN result = 'PTP' THEN 1 ELSE 0 END) AS ptps`, `and the ones that ended in a [[PTP]]`],
          [`  FROM collection_activities`, `from the activity log,`],
          [`  GROUP BY activity_type`, `with one row per type,`],
          [`)`, `and then`],
          [`SELECT activity_type,`, `show each type`],
          [`  ROUND(100.0 * ptps / activities, 2) AS ptp_share_pct`, `with its PTP share as a percent, to 2 decimals,`],
          [`FROM type_totals;`, `reading from that step.`]
        ],
        bridge: 'Excel keeps the decimals in =A1/B1*100, but in SQLite that order gives 0, so write 100.0 first.',
        task: `Now the ratio itself. Both steps are ready in the editor. Leaving out Written Off loans, show <code>branch_name</code> and <code>npl_ratio_pct</code> for each branch. The ratio is the balance with <code>collectibility</code> 3 or higher as a percent of the branch's total balance, rounded to 2 decimals. Highest ratio first.`,
        starter: `WITH on_book_loans AS (
  SELECT branch_id, collectibility, outstanding
  FROM loans
  WHERE status <> 'Written Off'
),
branch_totals AS (
  SELECT branch_id,
    SUM(outstanding) AS total_outstanding,
    SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) AS npl_balance
  FROM on_book_loans
  GROUP BY branch_id
)
SELECT b.branch_name,
  -- Your ratio here, named npl_ratio_pct
FROM branch_totals t
JOIN branches b
  ON b.branch_id = t.branch_id
-- Sort here, highest first
;`,
        solution: `WITH on_book_loans AS (
  SELECT branch_id, collectibility, outstanding
  FROM loans
  WHERE status <> 'Written Off'
),
branch_totals AS (
  SELECT branch_id,
    SUM(outstanding) AS total_outstanding,
    SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) AS npl_balance
  FROM on_book_loans
  GROUP BY branch_id
)
SELECT b.branch_name,
  ROUND(100.0 * t.npl_balance / t.total_outstanding, 2) AS npl_ratio_pct
FROM branch_totals t
JOIN branches b
  ON b.branch_id = t.branch_id
ORDER BY npl_ratio_pct DESC;`,
        ordered: 'npl_ratio_pct',
        hints: [
          `Both steps are ready. Only the final SELECT changes.`,
          `The final SELECT divides <code>npl_balance</code> by <code>total_outstanding</code>. Put <code>100.0 *</code> at the front, and wrap it all in <code>ROUND(..., 2)</code>.`,
          `The ratio column: <code>ROUND(100.0 * t.npl_balance / t.total_outstanding, 2) AS npl_ratio_pct</code>, then <code>ORDER BY npl_ratio_pct DESC</code>.`
        ],
        traps: [
          { re: /\/\s*(\w+\.)?total_outstanding\s*\)\s*\*\s*100|100(\.0)?\s*\*\s*\(\s*(\w+\.)?npl_balance\s*\//i, msg: `The brackets make the division run first, and two whole numbers give 0. Remove the brackets: <code>100.0 * t.npl_balance / t.total_outstanding</code>.` },
          { re: /\*\s*100\s*\//, msg: `Here every number is whole, so the decimals are dropped. Write <code>100.0</code> in place of <code>100</code>.` },
          { re: /\b100\s*\*/, msg: `<code>100 *</code> keeps everything in whole numbers, so 11.43 comes out as 11. Write <code>100.0 *</code>.` },
          { re: /^(?![\s\S]*\bstatus\b)/i, msg: `Written-off loans are still in this ratio. Add <code>WHERE status &lt;&gt; 'Written Off'</code> to your first step.` },
          { re: /\/\s*(\w+\.)?total_outstanding\s*\*\s*100\b/i, msg: `The division happens first here. Two whole numbers give 0, and 0 times 100 is still 0. Put <code>100.0 *</code> at the front.` },
          { re: /\bTHEN\s+1\b/i, msg: `<code>THEN 1</code> counts loans, and the ratio here is based on balances. Use <code>THEN outstanding</code>.` },
          { re: /collectibility\s*>\s*3\b/i, msg: `NPL means Kol 3, 4 or 5, so Kol 3 counts. Use <code>&gt;= 3</code>.` }
        ],
        wrong: [
          `WITH t AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) AS npl_balance FROM loans WHERE status <> 'Written Off' GROUP BY branch_id) SELECT b.branch_name, ROUND(100 * t.npl_balance / t.total_outstanding, 2) AS npl_ratio_pct FROM t JOIN branches b ON b.branch_id = t.branch_id ORDER BY npl_ratio_pct DESC;`,
          `WITH t AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) AS npl_balance FROM loans WHERE status <> 'Written Off' GROUP BY branch_id) SELECT b.branch_name, ROUND(t.npl_balance / t.total_outstanding * 100, 2) AS npl_ratio_pct FROM t JOIN branches b ON b.branch_id = t.branch_id ORDER BY npl_ratio_pct DESC;`,
          `WITH t AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) AS npl_balance FROM loans GROUP BY branch_id) SELECT b.branch_name, ROUND(100.0 * t.npl_balance / t.total_outstanding, 2) AS npl_ratio_pct FROM t JOIN branches b ON b.branch_id = t.branch_id ORDER BY npl_ratio_pct DESC;`,
          `WITH t AS (SELECT branch_id, COUNT(*) AS total_outstanding, SUM(CASE WHEN collectibility >= 3 THEN 1 ELSE 0 END) AS npl_balance FROM loans WHERE status <> 'Written Off' GROUP BY branch_id) SELECT b.branch_name, ROUND(100.0 * t.npl_balance / t.total_outstanding, 2) AS npl_ratio_pct FROM t JOIN branches b ON b.branch_id = t.branch_id ORDER BY npl_ratio_pct DESC;`,
          `WITH t AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) AS npl_balance FROM loans WHERE status <> 'Written Off' GROUP BY branch_id) SELECT b.branch_name, ROUND(100.0 * t.npl_balance / t.total_outstanding, 2) AS npl_ratio_pct FROM t JOIN branches b ON b.branch_id = t.branch_id ORDER BY npl_ratio_pct;`,
          `WITH t AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) AS npl_balance FROM loans WHERE status <> 'Written Off' GROUP BY branch_id) SELECT b.branch_name, ROUND(t.npl_balance * 100 / t.total_outstanding, 2) AS npl_ratio_pct FROM t JOIN branches b ON b.branch_id = t.branch_id ORDER BY npl_ratio_pct DESC;`,
          `WITH t AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) AS npl_balance FROM loans WHERE status <> 'Written Off' GROUP BY branch_id) SELECT b.branch_name, ROUND((t.npl_balance / t.total_outstanding) * 100, 2) AS npl_ratio_pct FROM t JOIN branches b ON b.branch_id = t.branch_id ORDER BY npl_ratio_pct DESC;`,
          `WITH t AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(CASE WHEN collectibility >= 3 THEN outstanding ELSE 0 END) AS npl_balance FROM loans WHERE status <> 'Written Off' GROUP BY branch_id) SELECT b.branch_name, ROUND(100.0 * (t.npl_balance / t.total_outstanding), 2) AS npl_ratio_pct FROM t JOIN branches b ON b.branch_id = t.branch_id ORDER BY npl_ratio_pct DESC;`
        ],
        altSolutions: [
          `SELECT b.branch_name, ROUND(100.0 * SUM(CASE WHEN l.collectibility >= 3 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) AS npl_ratio_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.status <> 'Written Off' GROUP BY b.branch_name ORDER BY npl_ratio_pct DESC;`,
          `WITH t AS (SELECT branch_id, SUM(outstanding) AS total_outstanding, SUM(CASE WHEN collectibility IN (3, 4, 5) THEN outstanding ELSE 0 END) AS npl_balance FROM loans WHERE status <> 'Written Off' GROUP BY branch_id) SELECT b.branch_name, ROUND(t.npl_balance * 100.0 / t.total_outstanding, 2) AS npl_ratio_pct FROM t JOIN branches b ON b.branch_id = t.branch_id ORDER BY 2 DESC;`,
          `WITH on_book_loans AS (SELECT branch_id, collectibility, outstanding FROM loans WHERE status <> 'Written Off'), npl AS (SELECT branch_id, SUM(outstanding) AS npl_balance FROM on_book_loans WHERE collectibility >= 3 GROUP BY branch_id), total AS (SELECT branch_id, SUM(outstanding) AS total_outstanding FROM on_book_loans GROUP BY branch_id) SELECT b.branch_name, ROUND(100.0 * n.npl_balance / a.total_outstanding, 2) AS npl_ratio_pct FROM total a JOIN npl n ON n.branch_id = a.branch_id JOIN branches b ON b.branch_id = a.branch_id ORDER BY npl_ratio_pct DESC;`
        ],
        pattern: { sql: `SELECT id,\n  ROUND(100.0 * part / whole, 2) AS share_pct\nFROM step_name\nORDER BY share_pct DESC;`, note: 'A percent that keeps its decimals' },
        atWork: `Whole-number division differs by database. For 1 / 2, SQLite, SQL Server and PostgreSQL give 0, while Oracle and BigQuery give 0.5. Writing <code>100.0</code> is safe on all of them.`,
        win: `KC Bandung Dago tops this list at 11.43%, while KCP Bekasi Timur has the biggest balance and only 1.55%. Banks can calculate NPL ratios in different ways, so say which way you used.`
      },
      {
        id: '4.10',
        title: 'A subquery as an extra column',
        newIdea: 'A subquery in the SELECT list adds one column, worked out fresh for each row.',
        from: 'Budi, Field Collection lead',
        teach: `<p>You have already written inner queries that use a column from the outer query. A [[correlated subquery]] can also sit in the SELECT list. It adds one extra column, and it must return one value for each row.</p><p>When nothing matches, the column shows NULL, which is useful information too.</p>`,
        ex: [
          ['SELECT l.loan_id, l.write_off_date,', 'Show each loan and its write-off date,'],
          ['  (', 'plus one extra column that holds'],
          ['    SELECT MAX(p.payment_date)', 'the latest payment date'],
          ['    FROM payments p', 'in the payments table'],
          ['    WHERE p.loan_id = l.loan_id', 'for this particular loan,'],
          ['  ) AS last_payment_date', 'named last_payment_date,'],
          ['FROM loans l', 'from the loans table,'],
          [`WHERE l.status = 'Written Off'`, 'for written-off loans only,'],
          ['LIMIT 5;', 'and stop after 5 rows, to keep this preview short.']
        ],
        exNote: `Loans 9 and 140 have no payments, so <code>last_payment_date</code> is NULL. Loan 9 also has no write-off date, which looks like a data problem. Finding problems like that comes later in the course.`,
        bridge: 'Like MAXIFS in a helper column, except that with no match Excel shows 0 and SQL shows NULL.',
        task: `For every serious case, I want to see when we last tried to contact the customer. For each loan more than 90 days past due and not Written Off, show <code>loan_id</code>, <code>product</code>, <code>dpd</code> and <code>last_activity_date</code>, the date of its most recent activity. Keep loans with no activity, showing NULL as the date. Oldest contact first.`,
        starter: `SELECT l.loan_id, l.product, l.dpd,
  (
    SELECT ____(a.activity_date)
    FROM collection_activities a
    WHERE a.loan_id = ____
  ) AS last_activity_date
FROM loans l
WHERE l.dpd > 90
  AND l.status <> 'Written Off'
ORDER BY last_activity_date;`,
        fill: ['MAX', 'l.loan_id'],
        solution: `SELECT l.loan_id, l.product, l.dpd,
  (
    SELECT MAX(a.activity_date)
    FROM collection_activities a
    WHERE a.loan_id = l.loan_id
  ) AS last_activity_date
FROM loans l
WHERE l.dpd > 90
  AND l.status <> 'Written Off'
ORDER BY last_activity_date;`,
        ordered: 'last_activity_date',
        hints: [
          `For dates stored like 2026-10-31, the most recent date is the largest one.`,
          `The first blank is the function that finds the largest value. The second blank is the outer loan's ID.`,
          `The blanks are <code>MAX</code> and <code>l.loan_id</code>.`
        ],
        requires: [{ re: /^(?![\s\S]*\bdpd\s*>=\s*90\b)/i, msg: `The rows match today, because no loan sits at exactly 90 days. The request says more than 90, so use <code>dpd &gt; 90</code>.` }],
        traps: [
          { re: /\(\s*SELECT\s+MAX\s*\(\s*(\w+\.)?activity_date\s*\)\s*FROM\s+collection_activities(\s+\w+)?\s*\)/i, msg: `Nothing in the brackets links to the outer loan, so every row shows the same date. Add <code>WHERE a.loan_id = l.loan_id</code>.` },
          { re: /^(?![\s\S]*\bstatus\b)/i, msg: `The request leaves out Written Off loans, so keep <code>l.status &lt;&gt; 'Written Off'</code> in the outer <code>WHERE</code>.` },
          { re: /\ba\.loan_id\s*=\s*(a\.)?loan_id\b/i, msg: `Inside the brackets, a plain <code>loan_id</code> means the inner table, so this compares a column with itself. Write the outer loan with its alias: <code>l.loan_id</code>.` },
          { re: /\bMIN\s*\(\s*(a\.)?activity_date/i, msg: `<code>MIN</code> finds the earliest date. The most recent date is the largest, so use <code>MAX</code>.` },
          { re: /^(?![\s\S]*\bLEFT\s+JOIN\b)[\s\S]*\bJOIN\s+collection_activities\b/i, msg: `A plain JOIN drops the loans with no activity, and those are the most worrying ones. A correlated subquery keeps them with NULL.` }
        ],
        wrong: [
          `SELECT l.loan_id, l.product, l.dpd, (SELECT MAX(a.activity_date) FROM collection_activities a) AS last_activity_date FROM loans l WHERE l.dpd > 90 AND l.status <> 'Written Off' ORDER BY last_activity_date;`,
          `SELECT l.loan_id, l.product, l.dpd, (SELECT MIN(a.activity_date) FROM collection_activities a WHERE a.loan_id = l.loan_id) AS last_activity_date FROM loans l WHERE l.dpd > 90 AND l.status <> 'Written Off' ORDER BY last_activity_date;`,
          `SELECT l.loan_id, l.product, l.dpd, MAX(a.activity_date) AS last_activity_date FROM loans l JOIN collection_activities a ON a.loan_id = l.loan_id WHERE l.dpd > 90 AND l.status <> 'Written Off' GROUP BY l.loan_id, l.product, l.dpd ORDER BY last_activity_date;`,
          `SELECT l.loan_id, l.product, l.dpd, (SELECT MAX(a.activity_date) FROM collection_activities a WHERE a.loan_id = l.loan_id) AS last_activity_date FROM loans l WHERE l.dpd > 90 ORDER BY last_activity_date;`,
          `SELECT l.loan_id, l.product, l.dpd, (SELECT MAX(a.activity_date) FROM collection_activities a WHERE a.loan_id = l.loan_id) AS last_activity_date FROM loans l WHERE l.dpd > 90 AND l.status <> 'Written Off';`,
          `SELECT l.loan_id, l.product, l.dpd, (SELECT MAX(a.activity_date) FROM collection_activities a WHERE a.loan_id = loan_id) AS last_activity_date FROM loans l WHERE l.dpd > 90 AND l.status <> 'Written Off' ORDER BY last_activity_date;`,
          `SELECT l.loan_id, l.product, l.dpd, (SELECT MAX(a.activity_date) FROM collection_activities a WHERE a.loan_id = l.loan_id) AS last_activity_date FROM loans l WHERE l.dpd >= 90 AND l.status <> 'Written Off' ORDER BY last_activity_date;`
        ],
        altSolutions: [
          `SELECT l.loan_id, l.product, l.dpd, MAX(a.activity_date) AS last_activity_date FROM loans l LEFT JOIN collection_activities a ON a.loan_id = l.loan_id WHERE l.dpd > 90 AND l.status <> 'Written Off' GROUP BY l.loan_id, l.product, l.dpd ORDER BY last_activity_date;`,
          `SELECT l.loan_id, l.product, l.dpd, (SELECT a.activity_date FROM collection_activities a WHERE a.loan_id = l.loan_id ORDER BY a.activity_date DESC LIMIT 1) AS last_activity_date FROM loans l WHERE l.dpd > 90 AND l.status <> 'Written Off' ORDER BY 4;`
        ],
        pattern: { sql: `SELECT a.id,\n  (\n    SELECT MAX(b.date_col)\n    FROM table_b b\n    WHERE b.id = a.id\n  ) AS latest_date\nFROM table_a a;`, note: 'Look up one value for each row' },
        atWork: `On a large table a correlated subquery may run once per outer row, which can be slow. If a report runs slowly, joining to a grouped CTE is often faster. SQLite sorts NULL first in this list, while Oracle and PostgreSQL sort it last.`,
        win: `Loans 251 and 272 are at the top with NULL, over 90 days late with no contact on record, so a supervisor wants them first. A plain JOIN would have hidden them.`
      },
      {
        id: '4.11',
        title: 'Compare a row with its own group',
        newIdea: 'A correlated subquery in WHERE compares each row with a figure from its own group.',
        from: 'Budi, Field Collection lead',
        teach: `<p>Rp 30 million is a very large credit card balance and a small home loan. One average across all loans hides that.</p><p>A [[correlated subquery]] in WHERE works out the average for each row's own product. The same table appears twice, so give each copy its own alias, like <code>l</code> and <code>l2</code>, and write the alias on both sides of the link. Inside the brackets, a plain <code>product</code> means the inner copy, so <code>l2.product = product</code> compares a column with itself and is always true.</p>`,
        ex: [
          ['SELECT k.collector_name, k.team, k.hired_date', `Show each person's name, team and start date`],
          ['FROM collectors k', 'from the collectors table,'],
          ['WHERE k.hired_date = (', 'keeping a person only if their start date equals'],
          ['  SELECT MIN(k2.hired_date)', 'the earliest start date'],
          ['  FROM collectors k2', 'in a second copy of the same table'],
          ['  WHERE k2.team = k.team', `among people on that person's own team,`],
          [');', 'which gives the longest-serving person per team.']
        ],
        bridge: 'Like comparing each row with AVERAGEIF(product_column, this_row_product).',
        task: `Show cases that are big for their product. For loans more than 90 days past due and not Written Off, show <code>loan_id</code>, <code>product</code>, <code>outstanding</code> and <code>dpd</code> where <code>outstanding</code> is above the average of every loan of that same product, whatever its status or DPD.`,
        starter: `SELECT l.loan_id, l.product, l.outstanding, l.dpd
FROM loans l
WHERE l.dpd > 90
  AND l.status <> 'Written Off'
  AND l.outstanding > (
    -- The average for this loan's own product goes here.
  );`,
        solution: `SELECT l.loan_id, l.product, l.outstanding, l.dpd
FROM loans l
WHERE l.dpd > 90
  AND l.status <> 'Written Off'
  AND l.outstanding > (
    SELECT AVG(l2.outstanding)
    FROM loans l2
    WHERE l2.product = l.product
  );`,
        hints: [
          `The inner query reads <code>loans</code> a second time, under a new alias. It keeps only rows with the same product as the outer loan.`,
          `The link line compares the inner product with the outer one: <code>l2.product = l.product</code>.`,
          `Inside the brackets: <code>SELECT AVG(l2.outstanding) FROM loans l2 WHERE l2.product = l.product</code>`
        ],
        requires: [
          { re: /^(?![\s\S]*\(\s*SELECT\b(?:[^()]|\([^()]*\))*?\b(status|dpd)\b)/i, msg: `The rows match today, and the request says every loan of that product, whatever its status or DPD. Keep the DPD and status filters on the outer query only.` },
          { re: /^(?![\s\S]*\bdpd\s*>=\s*90\b)/i, msg: `The rows match today, because no loan sits at exactly 90 days. The request says more than 90, so use <code>dpd &gt; 90</code>.` }
        ],
        traps: [
          { re: /^(?![\s\S]*\bstatus\b)/i, msg: `The request leaves out Written Off loans, so keep <code>l.status &lt;&gt; 'Written Off'</code> in the outer <code>WHERE</code>.` },
          { re: /\bAVG\s*\(\s*(\w+\.)?outstanding\s*\)\s*FROM\s+loans(\s+\w+)?\s*\)/i, msg: `This average covers all loans, so home loans make it much bigger. Add a line that links the inner product to the outer loan's product.` },
          { re: /\b(?!l\.product)(\w+)\.product\s*=\s*(\1\.)?product\b|WHERE\s+product\s*=\s*product\b/i, msg: `This compares a column with itself, which is always true. The right side should be the outer row: <code>l.product</code>.` },
          { re: /\(\s*SELECT\b(?:[^()]|\([^()]*\))*?\b(status|dpd)\b/i, msg: `The average should cover every loan of the product. Keep the DPD and status filters on the outer query only.` }
        ],
        wrong: [
          `SELECT l.loan_id, l.product, l.outstanding, l.dpd FROM loans l WHERE l.dpd > 90 AND l.status <> 'Written Off' AND l.outstanding > (SELECT AVG(l2.outstanding) FROM loans l2);`,
          `SELECT l.loan_id, l.product, l.outstanding, l.dpd FROM loans l WHERE l.dpd > 90 AND l.status <> 'Written Off' AND l.outstanding > (SELECT AVG(l2.outstanding) FROM loans l2 WHERE l2.product = l2.product);`,
          `SELECT l.loan_id, l.product, l.outstanding, l.dpd FROM loans l WHERE l.dpd > 90 AND l.status <> 'Written Off' AND l.outstanding > (SELECT AVG(l2.outstanding) FROM loans l2 WHERE l2.product = l.product AND l2.dpd > 90);`,
          `SELECT l.loan_id, l.product, l.outstanding, l.dpd FROM loans l WHERE l.dpd > 90 AND l.outstanding > (SELECT AVG(l2.outstanding) FROM loans l2 WHERE l2.product = l.product);`,
          `SELECT l.loan_id, l.product, l.outstanding, l.dpd FROM loans l WHERE l.dpd > 90 AND l.status <> 'Written Off' AND l.outstanding > (SELECT AVG(l2.outstanding) FROM loans l2 WHERE l2.product = l.product AND l2.status <> 'Written Off');`,
          `SELECT l.loan_id, l.product, l.outstanding, l.dpd FROM loans l WHERE l.dpd >= 90 AND l.status <> 'Written Off' AND l.outstanding > (SELECT AVG(l2.outstanding) FROM loans l2 WHERE l2.product = l.product);`,
          `SELECT l.loan_id, l.product, l.outstanding, l.dpd FROM loans l WHERE l.dpd > 90 AND l.status <> 'Written Off' AND l.outstanding > (SELECT AVG(l2.outstanding) FROM loans l2 WHERE l2.product = product);`
        ],
        altSolutions: [
          `SELECT l.loan_id, l.product, l.outstanding, l.dpd FROM loans l WHERE l.dpd > 90 AND l.status <> 'Written Off' AND l.outstanding > (SELECT AVG(outstanding) FROM loans WHERE product = l.product);`,
          `WITH product_avg AS (SELECT product, AVG(outstanding) AS avg_outstanding FROM loans GROUP BY product) SELECT l.loan_id, l.product, l.outstanding, l.dpd FROM loans l JOIN product_avg x ON x.product = l.product WHERE l.dpd > 90 AND l.status <> 'Written Off' AND l.outstanding > x.avg_outstanding;`,
          `SELECT l.loan_id, l.product, l.outstanding, l.dpd FROM loans l JOIN (SELECT product, AVG(outstanding) AS avg_outstanding FROM loans GROUP BY product) x ON x.product = l.product WHERE l.dpd > 90 AND l.status <> 'Written Off' AND l.outstanding > x.avg_outstanding;`
        ],
        pattern: { sql: `SELECT a.id, a.col_a\nFROM table_name a\nWHERE a.col_a > (\n  SELECT AVG(a2.col_a)\n  FROM table_name a2\n  WHERE a2.group_col = a.group_col\n);`, note: 'Compare each row with its own group' },
        win: `Comparing a case with others of its own kind is fairer than one figure for all loans. With one figure for everything, this list would hold only home loans and vehicle loans.`
      },
      {
        id: '4.12',
        type: 'quiz',
        title: 'Read a long query top-down',
        newIdea: 'Read the step names first, then the final SELECT, then each step.',
        teach: `<p>A long query becomes manageable once you have a routine.</p><ul><li>Read only the step names, to get the story.</li><li>Read the final SELECT, to see what comes out.</li><li>Read each step, and ask what one row means there.</li></ul><p>Good step names do half the work for you. You never have to take in every line at once.</p>`,
        bridge: 'Like reading a workbook by its tab names and summary sheet before opening the workings.',
        question: `A colleague left this report with no notes. Which business question does it answer?`,
        code: `WITH overdue AS (
  SELECT loan_id, branch_id, outstanding
  FROM loans
  WHERE dpd > 0
    AND status <> 'Written Off'
),
last_contact AS (
  SELECT loan_id, MAX(activity_date) AS last_date
  FROM collection_activities
  GROUP BY loan_id
),
no_recent_contact AS (
  SELECT o.loan_id, o.branch_id, o.outstanding
  FROM overdue o
  LEFT JOIN last_contact t ON t.loan_id = o.loan_id
  WHERE t.last_date IS NULL
    OR t.last_date < '2026-10-01'
)
SELECT b.branch_name,
  COUNT(*) AS loans_no_contact,
  SUM(s.outstanding) AS balance_no_contact
FROM no_recent_contact s
JOIN branches b ON b.branch_id = s.branch_id
GROUP BY b.branch_name
ORDER BY balance_no_contact DESC;`,
        showCodeResult: true,
        choices: [
          { t: 'Per branch, how many on-book overdue loans have had no activity since 1 October 2026, and how much balance do they hold?', correct: true, why: 'Yes. <code>overdue</code> picks the cases, <code>last_contact</code> finds each loan\'s latest activity, <code>no_recent_contact</code> keeps those with no activity since 1 October, and the final SELECT adds them up per branch.' },
          { t: 'Per branch, how many activities were logged before 1 October 2026, and how much balance do those loans hold?', why: 'Activities are only used to find each loan\'s latest date. The final <code>COUNT(*)</code> reads <code>no_recent_contact</code>, which has one row per loan.' },
          { t: 'Per branch, how many on-book overdue loans have made no payment since 1 October 2026, and how much balance do they hold?', why: 'Look at where <code>last_contact</code> reads from. It uses <code>collection_activities</code>, so this is about contact attempts. Payments are in a different table.' },
          { t: 'Per branch, how many on-book overdue loans were contacted during October 2026, and how much balance do they hold?', why: 'This is the reverse. The filter keeps a NULL date or a date before 1 October, so these loans were not contacted in October.' }
        ],
        win: `Reading code is a large part of the job, since you will receive old reports with no notes. Writing the business question in your own words is the fastest way to check that a query does what its author intended.`
      },
      {
        id: '4.13',
        type: 'fix',
        title: 'Turn a nested query into steps',
        newIdea: 'Each nested subquery can move up to become a named step, with the result unchanged.',
        from: 'Reza, senior analyst',
        teach: `<p>Nested queries read from the inside out, which makes them hard to review. To rewrite one, find the innermost SELECT and make it your first step. Then keep moving outward, until no SELECT sits inside a FROM.</p><p>A [[CTE]] also lets you test as you go. Change the final SELECT to <code>SELECT * FROM step_name</code> to look at one step by itself.</p>`,
        ex: [
          ['WITH per_loan AS (', 'Make a step called per_loan'],
          ['  SELECT loan_id, SUM(amount) AS loan_total', 'that holds each loan and its total paid'],
          ['  FROM payments', 'from the payments table,'],
          [`  WHERE channel = 'Collector'`, 'counting only money received through a collector,'],
          ['  GROUP BY loan_id', 'with one row per loan,'],
          [')', 'and then'],
          ['SELECT ROUND(AVG(loan_total), 0) AS avg_per_loan', 'show the average of those totals, rounded to a whole number,'],
          ['FROM per_loan;', 'reading from that step.']
        ],
        exNote: `This is the example from mission 4.6, with its inner query moved to the top. The answer does not change.`,
        bridge: 'Like replacing one giant nested IF with helper columns that each do one job.',
        task: `This works, but nobody can review it. Rewrite it with <code>WITH</code>, using one or more named steps, so no SELECT sits inside a FROM. Late here means more than 30 days past due. The result must stay the same: <code>branch_name</code>, <code>late_loan_count</code>, <code>late_balance</code>, largest balance first.`,
        starter: `SELECT b.branch_name, x.late_loan_count, x.late_balance
FROM (
  SELECT y.branch_id, COUNT(*) AS late_loan_count, SUM(y.outstanding) AS late_balance
  FROM (
    SELECT branch_id, outstanding
    FROM loans
    WHERE dpd > 30
      AND status <> 'Written Off'
  ) y
  GROUP BY y.branch_id
) x
JOIN branches b
  ON b.branch_id = x.branch_id
ORDER BY x.late_balance DESC;`,
        solution: `WITH late_loans AS (
  SELECT branch_id, outstanding
  FROM loans
  WHERE dpd > 30
    AND status <> 'Written Off'
),
branch_totals AS (
  SELECT branch_id, COUNT(*) AS late_loan_count, SUM(outstanding) AS late_balance
  FROM late_loans
  GROUP BY branch_id
)
SELECT b.branch_name, t.late_loan_count, t.late_balance
FROM branch_totals t
JOIN branches b
  ON b.branch_id = t.branch_id
ORDER BY t.late_balance DESC;`,
        ordered: 'late_balance',
        hints: [
          `The innermost SELECT, the one aliased <code>y</code>, becomes your first step. Give it a name that says what it holds.`,
          `The middle SELECT, aliased <code>x</code>, becomes your second step. Its FROM now names your first step. The aliases <code>y</code> and <code>x</code> are gone, so remove <code>y.</code> and <code>x.</code> from the column names.`,
          `Start with <code>WITH late_loans AS (SELECT branch_id, outstanding FROM loans WHERE dpd > 30 AND status &lt;&gt; 'Written Off'), branch_totals AS (...)</code>. The final SELECT reads from <code>branch_totals</code>.`
        ],
        requires: [
          { re: /\bWITH\b/i, msg: `The result matches, and the query is still nested. Move each inner SELECT to the top with <code>WITH</code>.` },
          { re: /^(?![\s\S]*(\bFROM|\bJOIN|,)\s*\(\s*SELECT\b)/i, msg: `The result matches, and one SELECT is still inside a FROM or a JOIN. Move it up into its own named step.` },
          { re: /\bWITH\s+(\w+)\s+AS\s*\([\s\S]*(?:\bFROM\s+|\bJOIN\s+|,\s*)\1\b/i, msg: `The result matches, and nothing reads your first step. Have the next step or the final SELECT read from it.` }
        ],
        traps: [
          { re: /\b[xy]\.\w+/, msg: `The aliases <code>x</code> and <code>y</code> belonged to the nested version. If your steps have new names, drop <code>y.</code> and <code>x.</code>, or give each step a short alias.` },
          { re: /\)\s*,\s*SELECT\b/i, msg: `Take out the comma before the main <code>SELECT</code>. Commas only go between steps.` },
          { re: /\)\s*,?\s*WITH\b/i, msg: `Write <code>WITH</code> only once, at the very start. Later steps start with their name.` },
          { re: /\)\s+(?!SELECT\b)\w+\s+AS\s*\(/i, msg: `Put a comma between two steps, right after the closing bracket.` },
          { re: /\bdpd\s*>\s*(?!30\b)\d+/i, msg: `Keep the filter from the original query, <code>dpd &gt; 30</code>. A rewrite should change the shape and leave the numbers alone.` },
          { re: /^(?![\s\S]*\bstatus\b)/i, msg: `The original query leaves out Written Off loans. Keep that filter, because a rewrite should leave the numbers alone.` }
        ],
        wrong: [
          `WITH late_loans AS (SELECT branch_id, outstanding FROM loans WHERE dpd > 0 AND status <> 'Written Off'), branch_totals AS (SELECT branch_id, COUNT(*) AS late_loan_count, SUM(outstanding) AS late_balance FROM late_loans GROUP BY branch_id) SELECT b.branch_name, t.late_loan_count, t.late_balance FROM branch_totals t JOIN branches b ON b.branch_id = t.branch_id ORDER BY t.late_balance DESC;`,
          `WITH late_loans AS (SELECT branch_id, outstanding FROM loans WHERE dpd > 30), branch_totals AS (SELECT branch_id, COUNT(*) AS late_loan_count, SUM(outstanding) AS late_balance FROM late_loans GROUP BY branch_id) SELECT b.branch_name, t.late_loan_count, t.late_balance FROM branch_totals t JOIN branches b ON b.branch_id = t.branch_id ORDER BY t.late_balance DESC;`,
          `WITH branch_totals AS (SELECT y.branch_id, COUNT(*) AS late_loan_count, SUM(y.outstanding) AS late_balance FROM (SELECT branch_id, outstanding FROM loans WHERE dpd > 30 AND status <> 'Written Off') y GROUP BY y.branch_id) SELECT b.branch_name, t.late_loan_count, t.late_balance FROM branch_totals t JOIN branches b ON b.branch_id = t.branch_id ORDER BY t.late_balance DESC;`,
          `WITH late_loans AS (SELECT branch_id, outstanding FROM loans WHERE dpd > 30 AND status <> 'Written Off'), branch_totals AS (SELECT branch_id, COUNT(*) AS late_loan_count, SUM(outstanding) AS late_balance FROM late_loans GROUP BY branch_id) SELECT b.branch_name, t.late_loan_count, t.late_balance FROM branch_totals t JOIN branches b ON b.branch_id = t.branch_id;`,
          `WITH late_loans AS (SELECT branch_id, outstanding FROM loans WHERE dpd > 30 AND status <> 'Written Off') SELECT b.branch_name, x.late_loan_count, x.late_balance FROM branches b JOIN (SELECT branch_id, COUNT(*) AS late_loan_count, SUM(outstanding) AS late_balance FROM late_loans GROUP BY branch_id) x ON b.branch_id = x.branch_id ORDER BY x.late_balance DESC;`,
          `WITH unused AS (SELECT 1) SELECT b.branch_name, COUNT(*) AS late_loan_count, SUM(l.outstanding) AS late_balance FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.dpd > 30 AND l.status <> 'Written Off' GROUP BY b.branch_name ORDER BY late_balance DESC;`
        ],
        altSolutions: [
          `WITH branch_totals AS (SELECT branch_id, COUNT(*) AS late_loan_count, SUM(outstanding) AS late_balance FROM loans WHERE dpd > 30 AND status <> 'Written Off' GROUP BY branch_id) SELECT b.branch_name, t.late_loan_count, t.late_balance FROM branch_totals t JOIN branches b ON b.branch_id = t.branch_id ORDER BY t.late_balance DESC;`,
          `WITH late_loans AS (SELECT branch_id, outstanding FROM loans WHERE dpd > 30 AND status <> 'Written Off'), branch_totals AS (SELECT branch_id, COUNT(*) AS late_loan_count, SUM(outstanding) AS late_balance FROM late_loans GROUP BY branch_id), named AS (SELECT b.branch_name, t.late_loan_count, t.late_balance FROM branch_totals t JOIN branches b ON b.branch_id = t.branch_id) SELECT branch_name, late_loan_count, late_balance FROM named ORDER BY late_balance DESC;`
        ],
        pattern: { sql: `-- Nested: FROM (SELECT ... FROM (SELECT ...))\nWITH inner_step AS (\n  SELECT ...\n),\nouter_step AS (\n  SELECT ...\n  FROM inner_step\n)\nSELECT ...\nFROM outer_step;`, note: 'Turn nesting into named steps, innermost first' },
        win: `Same numbers, and now anyone can check each step alone. Bank reports get reviewed and handed over, so SQL that others can read is worth as much as SQL that runs.`
      },
      {
        id: '4.14',
        type: 'quiz',
        title: 'Grain: what is one row?',
        newIdea: 'The grain is what one row means, and it decides whether adding up a column makes sense.',
        teach: `<p>The [[grain]] of a table is what one row stands for. Check it before every SUM.</p><table class="plain"><tr><th>Table</th><th>One row is</th></tr><tr><td><code>loans</code></td><td>one loan</td></tr><tr><td><code>payments</code></td><td>one payment</td></tr><tr><td><code>loan_snapshots</code></td><td>one loan, one month</td></tr></table><p>Adding payments makes sense, because each one is new money. Adding a balance across months counts the same money again and again.</p>`,
        ex: [
          ['SELECT snapshot_month, loan_id, outstanding', 'Show the month, the loan and its balance'],
          ['FROM loan_snapshots', 'from the monthly snapshots,'],
          ['WHERE loan_id = 1', 'for loan 1 alone,'],
          ['ORDER BY snapshot_month', 'earliest month first,'],
          ['LIMIT 3;', 'and stop after 3 rows, to keep this preview short.']
        ],
        exNote: `One loan, many rows. Each row is that loan's balance at one month end.`,
        bridge: 'Balance sheet figures are positions you never add across months, while income statement figures are flows you can add.',
        question: `A colleague wants the total balance across all loans today and runs this query. It returns about Rp 357.8 billion, while <code>SUM(outstanding)</code> on the <code>loans</code> table gives about Rp 34.7 billion. Why is it so much bigger?`,
        code: `SELECT SUM(outstanding) AS total_outstanding
FROM loan_snapshots;`,
        showCodeResult: true,
        check: { sql: `SELECT SUM(outstanding) FROM loan_snapshots`, equals: 357808635000 },
        choices: [
          { t: 'One row here is one loan per month, so each loan\'s balance is added up to ten times, once per month end.', correct: true, why: 'Yes. Ten months of positions were added together. To get today\'s total from this table, keep one month: <code>WHERE snapshot_month = \'2026-10\'</code>. That total still includes written-off loans, so join to <code>loans</code> and filter on <code>status</code> when you want on-book loans only.' },
          { t: 'The snapshots hold many loans that are missing from the loans table.', why: 'Both tables cover the same 502 loans. The extra money comes from the same loans appearing again each month.' },
          { t: 'NULL values in outstanding are pushing the total up.', why: '<code>SUM</code> skips NULL values, so they could never make a total bigger.' },
          { t: 'It needs SUM(DISTINCT outstanding) to remove the repeats.', why: 'DISTINCT removes equal amounts, which is a different thing. Two loans with the same balance would lose one, and a balance that changes each month would still count every month.' }
        ],
        win: `"What is one row?" is the question that stops a report being ten times too big. Ask it about every table and every step before you trust a SUM.`
      },
      {
        id: '4.15',
        checkpoint: true,
        title: 'Customer exposure report',
        newIdea: 'Plan the report in steps, then build it with no starter.',
        from: 'Rudi, Credit Risk',
        teach: `<p>No starter this time. Plan in words before you type. Decide what one row of the answer is, which step builds that row, and which step filters it.</p><p>A customer's [[exposure]] is the money they owe across all their loans. Written-off loans count here. They have left the balance sheet, and the customer still owes the money, so collection continues. Risk teams often count only [[on-book]] loans, so say which one you mean.</p><p>Trouble on one loan often signals trouble on the others, so risk teams look at the whole customer. A higher [[Kol]] number is a worse grade.</p>`,
        bridge: 'Like a PivotTable by customer with Count, Sum and Max, filtered on its values, plus a lookup for the name.',
        task: `Build my exposure report. For each customer, using all their loans whatever the status, show <code>customer_id</code>, <code>full_name</code>, <code>loans_held</code>, <code>total_outstanding</code> and <code>worst_kol</code> (their highest <code>collectibility</code>). Keep customers with two or more loans and a <code>worst_kol</code> of 2 or higher. Largest <code>total_outstanding</code> first.`,
        solution: `WITH customer_exposure AS (
  SELECT customer_id,
    COUNT(*) AS loans_held,
    SUM(outstanding) AS total_outstanding,
    MAX(collectibility) AS worst_kol
  FROM loans
  GROUP BY customer_id
),
watch_list AS (
  SELECT customer_id, loans_held, total_outstanding, worst_kol
  FROM customer_exposure
  WHERE loans_held >= 2
    AND worst_kol >= 2
)
SELECT c.customer_id, c.full_name, w.loans_held, w.total_outstanding, w.worst_kol
FROM watch_list w
JOIN customers c
  ON c.customer_id = w.customer_id
ORDER BY w.total_outstanding DESC;`,
        ordered: 'total_outstanding',
        hints: [
          `One row of the answer is one customer. Start with a step that groups <code>loans</code> by <code>customer_id</code>.`,
          `That step needs <code>COUNT(*)</code>, <code>SUM(outstanding)</code> and <code>MAX(collectibility)</code>. Filter on those new columns in a later step, then join <code>customers</code> for the name.`,
          `Final part: <code>WHERE loans_held >= 2 AND worst_kol >= 2</code>, join <code>customers</code> on <code>customer_id</code>, then <code>ORDER BY total_outstanding DESC</code>.`
        ],
        requires: [{ re: /^(?![\s\S]*\bGROUP\s+BY\s+(\w+\.)?full_name\b(?!\s*,))/i, msg: `The rows match today, because no two customers here share a name. In a real bank they can, so group by <code>customer_id</code>.` }],
        traps: [
          { re: /\bWHERE\b(?:(?!\bGROUP\s+BY\b)[\s\S])*\bcollectibility\b(?:(?!\bWHERE\b)[\s\S])*\bGROUP\s+BY\b/i, msg: `This removes Kol 1 loans before counting, so <code>loans_held</code> and <code>total_outstanding</code> come out too small. Filter after grouping, on <code>worst_kol</code>.` },
          { re: /^(?![\s\S]*(worst_kol|collectibility\s*\)?)\s*(>|<>|!=|IN\b|BETWEEN\b))/i, msg: `Check that you keep only customers with a <code>worst_kol</code> of 2 or higher.` },
          { re: /\bMIN\s*\(\s*(\w+\.)?collectibility/i, msg: `Kol 5 is the worst grade, so the worst of a customer's loans is the highest number. Use <code>MAX</code>.` },
          { re: /\bstatus\b/i, msg: `This report covers all of a customer's loans, whatever the status, so no filter on <code>status</code> is needed. Written-off loans count here, because the customer still owes the money.` },
          { re: /\bloans_held\s*>\s*2\b|\bCOUNT\s*\(\s*\*\s*\)\s*>\s*2\b/i, msg: `"Two or more" includes exactly two, so use <code>&gt;= 2</code>.` },
          { re: /\bworst_kol\s*>\s*2\b/i, msg: `"2 or higher" includes Kol 2, so use <code>&gt;= 2</code>.` },
          { re: /\bJOIN\s+(collection_activities|payments|loan_snapshots)\b/i, msg: `That table has many rows per loan, so joining it repeats each balance and inflates your total. <code>loans</code> and <code>customers</code> are all you need.` }
        ],
        wrong: [
          `WITH e AS (SELECT customer_id, COUNT(*) AS loans_held, SUM(outstanding) AS total_outstanding, MAX(collectibility) AS worst_kol FROM loans WHERE status <> 'Written Off' GROUP BY customer_id) SELECT c.customer_id, c.full_name, e.loans_held, e.total_outstanding, e.worst_kol FROM e JOIN customers c ON c.customer_id = e.customer_id WHERE e.loans_held >= 2 AND e.worst_kol >= 2 ORDER BY e.total_outstanding DESC;`,
          `WITH e AS (SELECT customer_id, COUNT(*) AS loans_held, SUM(outstanding) AS total_outstanding, MAX(collectibility) AS worst_kol FROM loans GROUP BY customer_id) SELECT c.customer_id, c.full_name, e.loans_held, e.total_outstanding, e.worst_kol FROM e JOIN customers c ON c.customer_id = e.customer_id WHERE e.loans_held >= 2 ORDER BY e.total_outstanding DESC;`,
          `WITH e AS (SELECT customer_id, COUNT(*) AS loans_held, SUM(outstanding) AS total_outstanding, MIN(collectibility) AS worst_kol FROM loans GROUP BY customer_id) SELECT c.customer_id, c.full_name, e.loans_held, e.total_outstanding, e.worst_kol FROM e JOIN customers c ON c.customer_id = e.customer_id WHERE e.loans_held >= 2 AND e.worst_kol >= 2 ORDER BY e.total_outstanding DESC;`,
          `WITH e AS (SELECT customer_id, COUNT(*) AS loans_held, SUM(outstanding) AS total_outstanding, MAX(collectibility) AS worst_kol FROM loans GROUP BY customer_id) SELECT c.customer_id, c.full_name, e.loans_held, e.total_outstanding, e.worst_kol FROM e JOIN customers c ON c.customer_id = e.customer_id WHERE e.loans_held > 2 AND e.worst_kol >= 2 ORDER BY e.total_outstanding DESC;`,
          `WITH e AS (SELECT customer_id, COUNT(*) AS loans_held, SUM(outstanding) AS total_outstanding, MAX(collectibility) AS worst_kol FROM loans GROUP BY customer_id) SELECT c.customer_id, c.full_name, e.loans_held, e.total_outstanding, e.worst_kol FROM e JOIN customers c ON c.customer_id = e.customer_id WHERE e.loans_held >= 2 AND e.worst_kol >= 2;`,
          `SELECT c.customer_id, c.full_name, COUNT(*) AS loans_held, SUM(l.outstanding) AS total_outstanding, MAX(l.collectibility) AS worst_kol FROM loans l JOIN customers c ON c.customer_id = l.customer_id LEFT JOIN collection_activities a ON a.loan_id = l.loan_id GROUP BY c.customer_id, c.full_name HAVING COUNT(*) >= 2 AND MAX(l.collectibility) >= 2 ORDER BY total_outstanding DESC;`,
          `SELECT c.customer_id, c.full_name, COUNT(*) AS loans_held, SUM(l.outstanding) AS total_outstanding, MAX(l.collectibility) AS worst_kol FROM loans l JOIN customers c ON c.customer_id = l.customer_id WHERE l.collectibility >= 2 GROUP BY c.customer_id, c.full_name HAVING COUNT(*) >= 2 ORDER BY total_outstanding DESC;`,
          `SELECT c.customer_id, c.full_name, COUNT(*) AS loans_held, SUM(l.outstanding) AS total_outstanding, MAX(l.collectibility) AS worst_kol FROM loans l JOIN customers c ON c.customer_id = l.customer_id GROUP BY c.full_name HAVING COUNT(*) >= 2 AND MAX(l.collectibility) >= 2 ORDER BY total_outstanding DESC;`
        ],
        altSolutions: [
          `WITH e AS (SELECT customer_id, COUNT(*) AS loans_held, SUM(outstanding) AS total_outstanding, MAX(collectibility) AS worst_kol FROM loans GROUP BY customer_id) SELECT c.customer_id, c.full_name, e.loans_held, e.total_outstanding, e.worst_kol FROM e JOIN customers c ON c.customer_id = e.customer_id WHERE e.loans_held >= 2 AND e.worst_kol >= 2 ORDER BY e.total_outstanding DESC;`,
          `SELECT c.customer_id, c.full_name, COUNT(*) AS loans_held, SUM(l.outstanding) AS total_outstanding, MAX(l.collectibility) AS worst_kol FROM loans l JOIN customers c ON c.customer_id = l.customer_id GROUP BY c.customer_id, c.full_name HAVING COUNT(*) >= 2 AND MAX(l.collectibility) >= 2 ORDER BY total_outstanding DESC;`,
          `WITH e AS (SELECT customer_id, COUNT(*) AS loans_held, SUM(outstanding) AS total_outstanding, MAX(collectibility) AS worst_kol FROM loans GROUP BY customer_id HAVING COUNT(*) > 1 AND MAX(collectibility) > 1) SELECT e.customer_id, c.full_name, e.loans_held, e.total_outstanding, e.worst_kol FROM e JOIN customers c ON c.customer_id = e.customer_id ORDER BY 4 DESC;`,
          `SELECT c.customer_id, c.full_name, e.loans_held, e.total_outstanding, e.worst_kol FROM (SELECT customer_id, COUNT(*) AS loans_held, SUM(outstanding) AS total_outstanding, MAX(collectibility) AS worst_kol FROM loans GROUP BY customer_id) AS e JOIN customers c ON c.customer_id = e.customer_id WHERE e.loans_held >= 2 AND e.worst_kol >= 2 ORDER BY e.total_outstanding DESC;`
        ],
        pattern: { sql: `WITH per_customer AS (\n  SELECT id, COUNT(*) AS items, SUM(col_a) AS total, MAX(col_b) AS worst\n  FROM table_name\n  GROUP BY id\n),\nfiltered AS (\n  SELECT id, items, total, worst\n  FROM per_customer\n  WHERE items >= 2\n)\nSELECT n.name, f.items, f.total, f.worst\nFROM filtered f\nJOIN names n ON n.id = f.id\nORDER BY f.total DESC;`, note: 'Build, filter, then add the names' },
        win: `Level 4 done, and you planned a real report in steps and built it from nothing. Risk and collection teams use lists like this to see a customer as a whole, because a current loan beside a Kol 5 loan may be the next one to become overdue.`
      }
    ]
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
