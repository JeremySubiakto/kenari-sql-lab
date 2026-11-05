/* Level 5: window functions. Ranking, comparing and trends that keep every row. */
(function (root) {
  (root.KENARI_LEVELS = root.KENARI_LEVELS || []).push({
    n: 5,
    title: 'Rank and Compare',
    rank: 'Trend Analyst',
    tagline: 'Rank, compare and spot trends while keeping every row.',
    goal: 'Use window functions to rank within groups, pick the latest row, and build monthly trends a manager can act on.',
    terms: {
      'running total': 'A sum that grows row by row, like the balance column in a ledger.',
      'moving average': 'An average over a short sliding span, such as the last 3 months, used to smooth out bumps.',
      'frame': 'The exact rows a window function looks at for the current row.',
      'quartile': 'One of four equal-sized groups of sorted rows.',
      'gaps and islands': 'A classic SQL problem: finding unbroken runs (islands) and the breaks between them (gaps).'
    },
    lessons: [
      {
        id: '5.1',
        title: 'Keep the rows, add a total',
        newIdea: 'OVER () calculates across all the rows and keeps every row in the result.',
        from: 'Citra, Head of Collection',
        teach: `<p>So far, <code>GROUP BY</code> has squeezed many rows into one. A [[window function]] does a calculation across many rows and keeps every row in the result. It is called a window because each row can look out at other rows.</p><p>You make one by adding <code>OVER ()</code> after a function such as <code>SUM</code>. The empty brackets mean "use all the rows". The total then appears beside each row.</p>[[demo:window]]`,
        ex: [
          ['SELECT loan_id, product, outstanding,', 'Show each loan\'s ID, product and balance,'],
          ['  SUM(outstanding) OVER () AS all_loans_total', 'add the balance of all loans beside every row,'],
          ['FROM loans', 'from the loans table,'],
          ['ORDER BY loan_id', 'in loan ID order,'],
          ['LIMIT 5;', 'and show the first 5.']
        ],
        exNote: 'There is no GROUP BY, so every row stays. LIMIT trims only what you see, and the total still covers every loan.',
        bridge: 'Like a helper column with =SUM($B$2:$B$5) beside every row.',
        task: `For our review of all loans, put each product's total beside the [[book]] total. Leave out written-off loans. Columns: <code>product</code>, <code>product_total</code>, <code>book_total</code>. One row per product. Fill in the two blanks.`,
        starter: `WITH product_totals AS (\n  SELECT product, SUM(outstanding) AS product_total\n  FROM loans\n  WHERE status <> 'Written Off'\n  GROUP BY product\n)\nSELECT product, product_total,\n  ____(product_total) ____ () AS book_total\nFROM product_totals;`,
        fill: ['SUM', 'OVER'],
        solution: `WITH product_totals AS (
  SELECT product, SUM(outstanding) AS product_total
  FROM loans
  WHERE status <> 'Written Off'
  GROUP BY product
)
SELECT product, product_total,
  SUM(product_total) OVER () AS book_total
FROM product_totals;`,
        altSolutions: [
          `SELECT product, SUM(outstanding) AS outstanding,
  SUM(SUM(outstanding)) OVER () AS book_total
FROM loans
WHERE status <> 'Written Off'
GROUP BY product;`
        ],
        wrong: [
          `SELECT SUM(outstanding) AS book_total FROM loans WHERE status <> 'Written Off';`,
          `SELECT product, SUM(outstanding) AS outstanding, SUM(outstanding) AS book_total FROM loans WHERE status <> 'Written Off' GROUP BY product;`,
          `WITH product_totals AS (SELECT product, SUM(outstanding) AS product_total FROM loans GROUP BY product) SELECT product, product_total, SUM(product_total) OVER () AS book_total FROM product_totals;`,
          `WITH product_totals AS (SELECT product, SUM(outstanding) AS product_total FROM loans WHERE status <> 'Written Off' GROUP BY product) SELECT product, SUM(product_total) OVER () AS product_total, product_total AS book_total FROM product_totals;`,
          `SELECT product, outstanding, SUM(outstanding) OVER () AS book_total FROM loans WHERE status <> 'Written Off';`
        ],
        traps: [
          { re: /^(?![\s\S]*Written Off)/i, msg: 'Written-off loans have left the book, so keep <code>WHERE status &lt;&gt; \'Written Off\'</code> in the first step.' },
          { re: /^(?![\s\S]*GROUP\s+BY)/i, msg: 'One row per product needs <code>GROUP BY product</code>. Without it you get one row per loan.' },
          { re: /^(?![\s\S]*\bOVER\b)/i, msg: 'Without <code>OVER ()</code>, <code>SUM</code> only adds up inside each product. Add it so <code>book_total</code> covers all the products.' },
          { re: /OVER\s*\(\s*(ORDER|PARTITION)/i, msg: 'Leave the brackets after <code>OVER</code> empty for this one. Anything inside them changes which rows it looks at.' }
        ],
        requires: [
          { re: /\bOVER\b/i, msg: 'Your numbers are right. This mission is about window functions, so get <code>book_total</code> with <code>SUM(...) OVER ()</code>.' },
          { re: /\bOVER\s*\(\s*\)\s*(AS\s+)?book_total\b/i, msg: 'The numbers are all there, and the names look swapped. <code>book_total</code> should be the <code>SUM(...) OVER ()</code> column.' }
        ],
        hints: [
          `The first step is already done. You only need the function and the keyword that keeps the rows.`,
          `The function that adds things up is <code>SUM</code>. The keyword that makes it a window function goes before the empty brackets.`,
          `The line should read <code>SUM(product_total) OVER () AS book_total</code>.`
        ],
        win: `Parts and the whole now sit on one row, so a reviewer can see at once that the products add up to the book. Pasting a total in by hand goes out of date, and this one never does.`,
        pattern: { sql: `SELECT col_a, amount,\n  SUM(amount) OVER () AS grand_total\nFROM table_name;`, note: 'Put a grand total beside every row' },
        atWork: `Window functions work the same way in Oracle, SQL Server, BigQuery and PostgreSQL, so this skill moves with you.`
      },
      {
        id: '5.2',
        title: 'Share of the total',
        newIdea: 'Divide a row by a window total to get its percent of the whole.',
        from: 'Dian, Finance',
        teach: `<p>With the total sitting on every row, a percentage needs one division. Take this row's amount, divide it by the total, and multiply by 100.</p><p>Write <code>100.0</code> with the decimal point. Whole numbers divided by whole numbers lose their decimals in SQLite, as you saw in Level 2.</p>`,
        ex: [
          ['WITH kol_counts AS (', 'First build a step called kol_counts'],
          ['  SELECT collectibility, COUNT(*) AS loan_count', 'holding each Kol grade and its number of loans'],
          ['  FROM loans', 'from the loans table,'],
          [`  WHERE status <> 'Written Off'`, 'leaving out written-off loans,'],
          ['  GROUP BY collectibility', 'with one row per grade.'],
          [')', 'With that ready,'],
          ['SELECT collectibility, loan_count,', 'show each grade and its loan count,'],
          ['  ROUND(100.0 * loan_count / SUM(loan_count) OVER (), 1) AS pct_of_loans', 'work out its percent of all loans to 1 decimal,'],
          ['FROM kol_counts', 'read from that step,'],
          ['ORDER BY pct_of_loans DESC;', 'and put the biggest share first.']
        ],
        bridge: 'Like =B2/SUM($B$2:$B$13) in Excel, formatted as a percent.',
        task: `Which branches carry most of the [[book]]? Written-off loans stay out. Show <code>branch_name</code>, <code>outstanding</code> and <code>pct_of_book</code>, the branch's percent of the book rounded to 2 decimals. Sort by <code>pct_of_book</code>, highest first. Add the missing column.`,
        starter: `WITH branch_totals AS (\n  SELECT b.branch_name, SUM(l.outstanding) AS outstanding\n  FROM loans l\n  JOIN branches b ON b.branch_id = l.branch_id\n  WHERE l.status <> 'Written Off'\n  GROUP BY b.branch_name\n)\nSELECT branch_name, outstanding,\n  -- add pct_of_book here\nFROM branch_totals\nORDER BY pct_of_book DESC;`,
        solution: `WITH branch_totals AS (
  SELECT b.branch_name, SUM(l.outstanding) AS outstanding
  FROM loans l
  JOIN branches b
    ON b.branch_id = l.branch_id
  WHERE l.status <> 'Written Off'
  GROUP BY b.branch_name
)
SELECT branch_name, outstanding,
  ROUND(100.0 * outstanding / SUM(outstanding) OVER (), 2) AS pct_of_book
FROM branch_totals
ORDER BY pct_of_book DESC;`,
        ordered: 'pct_of_book',
        precision: 4,
        altSolutions: [
          `SELECT b.branch_name, SUM(l.outstanding) AS outstanding,
  ROUND(100.0 * SUM(l.outstanding) / SUM(SUM(l.outstanding)) OVER (), 2) AS pct_of_book
FROM loans l
JOIN branches b ON b.branch_id = l.branch_id
WHERE l.status <> 'Written Off'
GROUP BY b.branch_name
ORDER BY pct_of_book DESC;`,
          `WITH branch_totals AS (
  SELECT b.branch_name, SUM(l.outstanding) AS outstanding
  FROM loans l
  JOIN branches b ON b.branch_id = l.branch_id
  WHERE l.status <> 'Written Off'
  GROUP BY b.branch_name
)
SELECT branch_name, outstanding,
  ROUND(outstanding * 100.0 / SUM(outstanding) OVER (), 2) AS pct_of_book
FROM branch_totals
ORDER BY pct_of_book DESC;`
        ],
        wrong: [
          `WITH branch_totals AS (SELECT b.branch_name, SUM(l.outstanding) AS outstanding FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.status <> 'Written Off' GROUP BY b.branch_name) SELECT branch_name, outstanding, ROUND(100 * outstanding / SUM(outstanding) OVER (), 2) AS pct_of_book FROM branch_totals ORDER BY pct_of_book DESC;`,
          `WITH branch_totals AS (SELECT b.branch_name, SUM(l.outstanding) AS outstanding FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.status <> 'Written Off' GROUP BY b.branch_name) SELECT branch_name, outstanding, ROUND(100.0 * outstanding / SUM(outstanding), 2) AS pct_of_book FROM branch_totals;`,
          `WITH branch_totals AS (SELECT b.branch_name, SUM(l.outstanding) AS outstanding FROM loans l JOIN branches b ON b.branch_id = l.branch_id GROUP BY b.branch_name) SELECT branch_name, outstanding, ROUND(100.0 * outstanding / SUM(outstanding) OVER (), 2) AS pct_of_book FROM branch_totals ORDER BY pct_of_book DESC;`,
          `WITH branch_totals AS (SELECT b.branch_name, SUM(l.outstanding) AS outstanding FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.status <> 'Written Off' GROUP BY b.branch_name) SELECT branch_name, outstanding, ROUND(100.0 * outstanding / SUM(outstanding) OVER (), 1) AS pct_of_book FROM branch_totals ORDER BY pct_of_book DESC;`,
          `WITH branch_totals AS (SELECT b.branch_name, SUM(l.outstanding) AS outstanding FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.status <> 'Written Off' GROUP BY b.branch_name) SELECT branch_name, outstanding, ROUND(100.0 * outstanding / SUM(outstanding) OVER (), 2) AS pct_of_book FROM branch_totals ORDER BY pct_of_book;`,
          `WITH branch_totals AS (SELECT b.branch_name, SUM(l.outstanding) AS outstanding FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.status <> 'Written Off' GROUP BY b.branch_name) SELECT branch_name, outstanding, 100.0 * outstanding / SUM(outstanding) OVER () AS pct_of_book FROM branch_totals ORDER BY pct_of_book DESC;`
        ],
        traps: [
          { re: /SUM\(\s*outstanding\s*\)\s*,\s*2\s*\)/i, msg: 'The total needs <code>OVER ()</code> after it. Without that, <code>SUM</code> squeezes everything into one row.' },
          { re: /^(?![\s\S]*Written Off)/i, msg: 'The book leaves out written-off loans, so keep that filter in the first step.' }
        ],
        requires: [{ re: /\bOVER\b/i, msg: 'Your percentages are right. Now get the total with <code>SUM(...) OVER ()</code>, which is what this mission practices.' }],
        hints: [
          `A percent of the whole is this row's amount, divided by the total, times 100.`,
          `The total is <code>SUM(outstanding) OVER ()</code>. Use <code>100.0</code> so the decimals stay.`,
          `Wrap it all in <code>ROUND(..., 2)</code>: <code>ROUND(100.0 * outstanding / SUM(outstanding) OVER (), 2) AS pct_of_book</code>.`
        ],
        win: `Banks watch how much of the book sits in only a few branches, which is called concentration, and here the top 3 branches hold about 36 percent. A useful check is that the percentages add up to about 100.`,
        pattern: { sql: `SELECT col_a, amount,\n  ROUND(100.0 * amount / SUM(amount) OVER (), 2) AS pct\nFROM table_name;`, note: 'Each row as a percent of the total' }
      },
      {
        id: '5.3',
        title: 'Number the rows',
        newIdea: 'ROW_NUMBER() gives each row 1, 2, 3 in the order you choose inside OVER.',
        from: 'Citra, Head of Collection',
        teach: `<p><code>ROW_NUMBER()</code> gives each row a number, with no repeats. The <code>ORDER BY</code> inside <code>OVER</code> decides who gets number 1. So the brackets are no longer empty.</p><p>The <code>ORDER BY</code> at the end of the query is separate. It sorts the result, and <code>LIMIT</code> then keeps the first rows of that sort. So you need both.</p>`,
        ex: [
          [`SELECT`, `Show`],
          [`  ROW_NUMBER() OVER (ORDER BY amount DESC) AS rn,`, `a number for each payment, with the largest as 1,`],
          [`  payment_id, channel, amount`, `then its ID, channel and amount`],
          [`FROM payments`, `from the payments table,`],
          [`ORDER BY rn`, `sorted in number order,`],
          [`LIMIT 5;`, `and stop after the first 5.`]
        ],
        bridge: 'Like sorting a sheet, then typing 1, 2, 3 down a new column.',
        task: `I need our largest problem loans for Monday's meeting. Number the 10 biggest [[NPL]] loans by outstanding, biggest as 1. NPL here means Kol 3 or worse and not written off. Columns: <code>rn</code>, <code>loan_id</code>, <code>product</code>, <code>outstanding</code>.`,
        starter: `SELECT\n  ____() OVER (ORDER BY ____ DESC) AS rn,\n  loan_id, product, outstanding\nFROM loans\nWHERE collectibility >= 3\n  AND status <> 'Written Off'\nORDER BY rn\nLIMIT 10;`,
        fill: ['ROW_NUMBER', 'outstanding'],
        solution: `SELECT
  ROW_NUMBER() OVER (ORDER BY outstanding DESC) AS rn,
  loan_id, product, outstanding
FROM loans
WHERE collectibility >= 3
  AND status <> 'Written Off'
ORDER BY rn
LIMIT 10;`,
        ordered: 'rn',
        altSolutions: [
          `SELECT ROW_NUMBER() OVER (ORDER BY outstanding DESC) AS rn, loan_id, product, outstanding
FROM loans
WHERE collectibility IN (3, 4, 5) AND status <> 'Written Off'
ORDER BY outstanding DESC
LIMIT 10;`
        ],
        wrong: [
          `SELECT ROW_NUMBER() OVER (ORDER BY outstanding) AS rn, loan_id, product, outstanding FROM loans WHERE collectibility >= 3 AND status <> 'Written Off' ORDER BY rn LIMIT 10;`,
          `SELECT ROW_NUMBER() OVER (ORDER BY outstanding DESC) AS rn, loan_id, product, outstanding FROM loans WHERE collectibility >= 3 ORDER BY rn LIMIT 10;`,
          `SELECT ROW_NUMBER() OVER (ORDER BY outstanding DESC) AS rn, loan_id, product, outstanding FROM loans WHERE collectibility >= 3 AND status <> 'Written Off' ORDER BY rn;`,
          `SELECT ROW_NUMBER() OVER (ORDER BY outstanding DESC) AS rn, loan_id, product, outstanding FROM loans WHERE status <> 'Written Off' ORDER BY rn LIMIT 10;`
        ],
        traps: [
          { re: /OVER\s*\(\s*ORDER\s+BY\s+outstanding\s*(ASC\s*)?\)/i, msg: 'This numbers the smallest loan as 1. Add <code>DESC</code> inside <code>OVER</code> so the biggest comes first.' },
          { re: /^(?![\s\S]*Written Off)/i, msg: 'Written-off loans do not count as NPL here, so filter them out.' },
          { re: /^(?![\s\S]*LIMIT)/i, msg: 'The request is for 10 loans, so finish with <code>LIMIT 10</code>.' },
          { re: /^(?![\s\S]*collectibility)/i, msg: 'NPL means Kol 3 or worse, so filter on <code>collectibility &gt;= 3</code>.' }
        ],
        requires: [{ re: /ROW_NUMBER/i, msg: 'Your result is right, and this mission is about <code>ROW_NUMBER()</code>. Use it for the numbering column.' }],
        hints: [
          `The function that hands out 1, 2, 3 is <code>ROW_NUMBER()</code>.`,
          `The number should follow the loan size, so the column inside <code>OVER</code> is <code>outstanding</code>.`,
          `The line should read <code>ROW_NUMBER() OVER (ORDER BY outstanding DESC) AS rn,</code>`
        ],
        win: `A handful of large accounts can move the whole NPL number, so they usually get senior attention first. The numbers also let people in the meeting say "loan number 3" and look at the same row.`,
        pattern: { sql: `SELECT\n  ROW_NUMBER() OVER (ORDER BY amount DESC) AS rn,\n  col_a\nFROM table_name\nORDER BY rn;`, note: 'Number rows in a chosen order' },
        atWork: `<code>ROW_NUMBER()</code> is written the same way on Oracle, SQL Server, BigQuery and PostgreSQL. Only the <code>LIMIT</code> line may change.`
      },
      {
        id: '5.4',
        title: 'Ties: RANK and DENSE_RANK',
        newIdea: 'RANK and DENSE_RANK give tied rows the same position, and differ in what comes next.',
        from: 'Citra, Head of Collection',
        teach: `<p>A [[PTP]] is a borrower's promise to pay, and securing one is a key collection result. If two collectors have the same PTP count, they should share a position. <code>ROW_NUMBER</code> cannot do that. <code>RANK</code> and <code>DENSE_RANK</code> can.</p><table class="plain"><tr><th>Score</th><th>ROW_NUMBER</th><th>RANK</th><th>DENSE_RANK</th></tr><tr><td>30</td><td>1</td><td>1</td><td>1</td></tr><tr><td>20</td><td>2</td><td>2</td><td>2</td></tr><tr><td>20</td><td>3</td><td>2</td><td>2</td></tr><tr><td>10</td><td>4</td><td>4</td><td>3</td></tr></table><p>After a tie, <code>RANK</code> skips a number. <code>DENSE_RANK</code> does not.</p>`,
        ex: [
          ['WITH npl_counts AS (', 'First build a step called npl_counts'],
          ['  SELECT b.branch_name, COUNT(*) AS npl_loans', 'holding each branch and its number of NPL loans'],
          ['  FROM loans l', 'from the loans table,'],
          ['  JOIN branches b ON b.branch_id = l.branch_id', 'with branch names joined on,'],
          ['  WHERE l.collectibility >= 3', 'keeping Kol 3 or worse'],
          [`    AND l.status <> 'Written Off'`, 'that are not written off,'],
          ['  GROUP BY b.branch_name', 'with one row per branch.'],
          [')', 'With that ready,'],
          ['SELECT branch_name, npl_loans,', 'show each branch and its count,'],
          ['  RANK() OVER (ORDER BY npl_loans DESC) AS with_gaps,', 'a rank that skips numbers after a tie,'],
          ['  DENSE_RANK() OVER (ORDER BY npl_loans DESC) AS no_gaps', 'and a rank that never skips,'],
          ['FROM npl_counts', 'read from that step,'],
          ['ORDER BY npl_loans DESC;', 'with the highest count first.']
        ],
        exNote: 'Two branches tie at 4 loans, so both get 3. The next branch is 5 with RANK and 4 with DENSE_RANK.',
        bridge: 'RANK works like =RANK.EQ(B2,$B$2:$B$26) in Excel, and Excel has no single function for DENSE_RANK.',
        task: `Build my PTP ranking of collectors, across all teams. A PTP is a row in <code>collection_activities</code> with result <code>'PTP'</code>. Show <code>collector_name</code>, <code>ptps</code>, <code>ptp_rank</code> (use RANK) and <code>ptp_dense_rank</code> (use DENSE_RANK), most PTPs ranked 1. Sort by <code>ptps</code>, highest first. Fill in the blanks.`,
        starter: `WITH ptp_counts AS (\n  SELECT k.collector_name, COUNT(*) AS ptps\n  FROM collection_activities a\n  JOIN collectors k ON k.collector_id = a.collector_id\n  WHERE a.result = 'PTP'\n  GROUP BY k.collector_name\n)\nSELECT collector_name, ptps,\n  ____() OVER (ORDER BY ptps DESC) AS ptp_rank,\n  ____() OVER (ORDER BY ptps DESC) AS ptp_dense_rank\nFROM ptp_counts\nORDER BY ptps DESC;`,
        fill: ['RANK', 'DENSE_RANK'],
        solution: `WITH ptp_counts AS (
  SELECT k.collector_name, COUNT(*) AS ptps
  FROM collection_activities a
  JOIN collectors k
    ON k.collector_id = a.collector_id
  WHERE a.result = 'PTP'
  GROUP BY k.collector_name
)
SELECT collector_name, ptps,
  RANK() OVER (ORDER BY ptps DESC) AS ptp_rank,
  DENSE_RANK() OVER (ORDER BY ptps DESC) AS ptp_dense_rank
FROM ptp_counts
ORDER BY ptps DESC;`,
        ordered: 'ptps',
        altSolutions: [
          `SELECT k.collector_name, COUNT(*) AS ptps,
  RANK() OVER (ORDER BY COUNT(*) DESC) AS ptp_rank,
  DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS ptp_dense_rank
FROM collection_activities a
JOIN collectors k ON k.collector_id = a.collector_id
WHERE a.result = 'PTP'
GROUP BY k.collector_name
ORDER BY ptps DESC;`
        ],
        wrong: [
          `WITH ptp_counts AS (SELECT k.collector_name, COUNT(*) AS ptps FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE a.result = 'PTP' GROUP BY k.collector_name) SELECT collector_name, ptps, ROW_NUMBER() OVER (ORDER BY ptps DESC) AS ptp_rank, DENSE_RANK() OVER (ORDER BY ptps DESC) AS ptp_dense_rank FROM ptp_counts ORDER BY ptps DESC;`,
          `WITH ptp_counts AS (SELECT k.collector_name, COUNT(*) AS ptps FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE a.result = 'PTP' GROUP BY k.collector_name) SELECT collector_name, ptps, RANK() OVER (ORDER BY ptps) AS ptp_rank, DENSE_RANK() OVER (ORDER BY ptps) AS ptp_dense_rank FROM ptp_counts ORDER BY ptps DESC;`,
          `WITH ptp_counts AS (SELECT k.collector_name, COUNT(*) AS ptps FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id GROUP BY k.collector_name) SELECT collector_name, ptps, RANK() OVER (ORDER BY ptps DESC) AS ptp_rank, DENSE_RANK() OVER (ORDER BY ptps DESC) AS ptp_dense_rank FROM ptp_counts ORDER BY ptps DESC;`,
          `WITH ptp_counts AS (SELECT k.collector_name, COUNT(*) AS ptps FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE a.result = 'PTP' GROUP BY k.collector_name) SELECT collector_name, ptps, DENSE_RANK() OVER (ORDER BY ptps DESC) AS ptp_rank, RANK() OVER (ORDER BY ptps DESC) AS ptp_dense_rank FROM ptp_counts ORDER BY ptps DESC;`,
          `WITH ptp_counts AS (SELECT k.collector_name, COUNT(*) AS ptps FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE a.result = 'PTP' AND k.team = 'Desk Call' GROUP BY k.collector_name) SELECT collector_name, ptps, RANK() OVER (ORDER BY ptps DESC) AS ptp_rank, DENSE_RANK() OVER (ORDER BY ptps DESC) AS ptp_dense_rank FROM ptp_counts ORDER BY ptps DESC;`
        ],
        traps: [
          { re: /ROW_NUMBER/i, msg: '<code>ROW_NUMBER</code> gives tied collectors different numbers, and that would be unfair here. This table needs <code>RANK</code> and <code>DENSE_RANK</code>.' },
          { re: /(RANK)\s*\(\s*\)\s*OVER\s*\(\s*ORDER\s+BY\s+(ptps|COUNT\(\*\))\s*(ASC\s*)?\)/i, msg: 'The most PTPs should rank 1, so add <code>DESC</code> inside <code>OVER</code>.' },
          { re: /^(?![\s\S]*'PTP')/i, msg: 'This counts every activity. Count only the rows where <code>result = \'PTP\'</code>.' },
          { re: /\bteam\s*(=|IN\b)/i, msg: 'The request covers all teams, so leave out the team filter.' }
        ],
        requires: [
          { re: /\bRANK\s*\(\s*\)\s*OVER\s*\((?:[^()]|\([^()]*\))*\)\s*(AS\s+)?ptp_rank\b/i, msg: 'The numbers are right, and the two functions look swapped. <code>ptp_rank</code> should use <code>RANK</code>, which skips a number after a tie. <code>ptp_dense_rank</code> should use <code>DENSE_RANK</code>, which does not.' },
          { re: /\bDENSE_RANK\s*\(\s*\)\s*OVER\s*\((?:[^()]|\([^()]*\))*\)\s*(AS\s+)?ptp_dense_rank\b/i, msg: 'The numbers are right, and the two functions look swapped. <code>ptp_rank</code> should use <code>RANK</code>, which skips a number after a tie. <code>ptp_dense_rank</code> should use <code>DENSE_RANK</code>, which does not.' }
        ],
        hints: [
          `Each blank is the name of a ranking function, and each one matches its column name.`,
          `<code>ptp_rank</code> should skip a number after a tie. <code>ptp_dense_rank</code> should not.`,
          `The first blank is <code>RANK</code> and the second is <code>DENSE_RANK</code>.`
        ],
        win: `With RANK, a collector ranked 6 knows five people did better, and a ranking is only fair if ties are handled well, so state which function you used. PTPs secured are one measure of effort, and whether the promises were kept is a separate question.`,
        atWork: `Check for duplicate rows before a table like this affects anyone's pay. You will learn how in Level 7.`,
        pattern: { sql: `SELECT col_a, score,\n  RANK() OVER (ORDER BY score DESC) AS rnk,\n  DENSE_RANK() OVER (ORDER BY score DESC) AS dense_rnk\nFROM table_name;`, note: 'Rankings where ties share a position' }
      },
      {
        id: '5.5',
        title: 'Rank inside each group',
        newIdea: 'PARTITION BY restarts the window function for each group.',
        from: 'Dimas, Portfolio Analyst',
        teach: `<p><code>PARTITION BY</code> splits the rows into groups, and the window function starts again inside each one. Each group is called a [[partition]].</p><p>It looks like <code>GROUP BY</code>, and the big difference is that every row stays. <code>PARTITION BY</code> always comes first inside the brackets, then <code>ORDER BY</code>.</p>`,
        ex: [
          [`SELECT channel, payment_id, amount,`, `Show each payment's channel, ID and amount,`],
          [`  RANK() OVER (PARTITION BY channel ORDER BY amount DESC) AS rank_in_channel`, `plus its rank by amount, restarting at 1 for each channel,`],
          [`FROM payments`, `from the payments table,`],
          [`WHERE channel IN ('Collector', 'Teller')`, `for these two channels only,`],
          [`  AND payment_date BETWEEN '2026-10-01' AND '2026-10-07'`, `in the first week of October,`],
          [`ORDER BY channel, rank_in_channel;`, `sorted by channel and then by rank.`]
        ],
        bridge: 'In Excel, =COUNTIFS($A:$A,A2,$C:$C,">"&C2)+1 counts the bigger loans in the same product, and PARTITION BY does this in a few words.',
        task: `A [[KPR]] loan and a Kartu Kredit (credit card) balance differ hugely in size, so rank each product separately. Rank [[NPL]] loans (Kol 3 or worse, not written off) by outstanding inside each product, biggest as 1, using RANK. Columns: <code>product</code>, <code>loan_id</code>, <code>outstanding</code>, <code>rank_in_product</code>. Sort by product, then rank. Add the missing column.`,
        starter: `SELECT product, loan_id, outstanding,
  -- add rank_in_product here
FROM loans
WHERE collectibility >= 3
  AND status <> 'Written Off'
ORDER BY product, rank_in_product;`,
        solution: `SELECT product, loan_id, outstanding,
  RANK() OVER (PARTITION BY product ORDER BY outstanding DESC) AS rank_in_product
FROM loans
WHERE collectibility >= 3
  AND status <> 'Written Off'
ORDER BY product, rank_in_product;`,
        ordered: 'rank_in_product',
        wrong: [
          `SELECT product, loan_id, outstanding, ROW_NUMBER() OVER (PARTITION BY product ORDER BY outstanding DESC) AS rank_in_product FROM loans WHERE collectibility >= 3 AND status <> 'Written Off' ORDER BY product, rank_in_product;`,
          `SELECT product, loan_id, outstanding, RANK() OVER (PARTITION BY product ORDER BY outstanding DESC) AS rank_in_product FROM loans WHERE collectibility >= 3 AND status <> 'Written Off' ORDER BY loan_id;`,
          `SELECT product, loan_id, outstanding, RANK() OVER (ORDER BY outstanding DESC) AS rank_in_product FROM loans WHERE collectibility >= 3 AND status <> 'Written Off' ORDER BY product, rank_in_product;`,
          `SELECT product, loan_id, outstanding, RANK() OVER (PARTITION BY product ORDER BY outstanding) AS rank_in_product FROM loans WHERE collectibility >= 3 AND status <> 'Written Off' ORDER BY product, rank_in_product;`,
          `SELECT product, loan_id, outstanding, RANK() OVER (PARTITION BY product ORDER BY outstanding DESC) AS rank_in_product FROM loans WHERE collectibility >= 3 ORDER BY product, rank_in_product;`
        ],
        traps: [
          { re: /PARTITION\s+BY\s+ORDER/i, msg: 'After <code>PARTITION BY</code>, name the column to split by, such as <code>product</code>.' },
          { re: /^(?![\s\S]*PARTITION\s+BY)/i, msg: 'Without <code>PARTITION BY product</code>, you get one ranking across all products. Each product should start again at 1.' },
          { re: /OVER\s*\([^)]*ORDER\s+BY\s+outstanding\s*(ASC\s*)?\)/i, msg: 'The biggest loan should rank 1, so add <code>DESC</code> inside <code>OVER</code>.' },
          { re: /OVER\s*\(\s*ORDER\s+BY[^)]*PARTITION/i, msg: 'Inside the brackets, <code>PARTITION BY</code> comes before <code>ORDER BY</code>.' },
          { re: /^(?![\s\S]*Written Off)/i, msg: 'Written-off loans do not count as NPL here, so filter them out.' }
        ],
        requires: [
          { re: /PARTITION\s+BY/i, msg: 'Your result is right, and this mission practices <code>PARTITION BY</code>. Use it inside <code>OVER</code>.' },
          { re: /\bRANK\s*\(\s*\)\s*OVER/i, msg: 'Your numbers match today, because no two loans here tie. The request asks for <code>RANK</code>, so tied loans would share a position. Use it for <code>rank_in_product</code>.' }
        ],
        hints: [
          `The window function needs to start again for each product.`,
          `Inside <code>OVER</code>, write <code>PARTITION BY product</code> first, then <code>ORDER BY outstanding DESC</code>.`,
          `The line should read <code>RANK() OVER (PARTITION BY product ORDER BY outstanding DESC) AS rank_in_product</code>.`
        ],
        win: `Ranking each product separately is what makes this list useful. In a single list, the larger home, vehicle and personal loans would push every Kartu Kredit balance off the first page.`,
        pattern: { sql: `SELECT grp, col_a, amount,\n  RANK() OVER (PARTITION BY grp ORDER BY amount DESC) AS rnk\nFROM table_name;`, note: 'Rank inside each group' }
      },
      {
        id: '5.6',
        title: 'Top one per group',
        newIdea: 'To filter on a window function, calculate it in a CTE and filter in the next step.',
        from: 'Citra, Head of Collection',
        teach: `<p>You now have a rank per group. To keep only rank 1, you might try <code>WHERE</code> on it, and the database would refuse. <code>WHERE</code> runs before window functions, so it cannot see them yet. You may see an error such as "misuse of window function". That is the database telling you it needs two steps.</p><p>The fix is two steps. Calculate the number inside a [[CTE]], then filter in the query that reads it. Use <code>ROW_NUMBER</code> when you want exactly one row per group.</p>`,
        ex: [
          [`WITH ranked AS (`, `First build a step called ranked`],
          [`  SELECT channel, payment_id, amount,`, `holding each payment's channel, ID and amount,`],
          [`    ROW_NUMBER() OVER (PARTITION BY channel ORDER BY amount DESC, payment_id) AS rn`, `numbered inside each channel with the largest as 1 and the lower ID winning a tie,`],
          [`  FROM payments`, `from the payments table.`],
          [`)`, `With that ready,`],
          [`SELECT channel, payment_id, amount`, `show the channel, ID and amount`],
          [`FROM ranked`, `from that step,`],
          [`WHERE rn = 1;`, `keeping only the largest payment in each channel.`]
        ],
        bridge: 'Like adding a rank helper column in Excel, then filtering it to 1.',
        task: `For my summary slide, I need the single largest [[NPL]] loan in each product. NPL means Kol 3 or worse, not written off. Columns: <code>product</code>, <code>loan_id</code>, <code>outstanding</code>. One row per product.`,
        starter: `WITH ranked AS (\n  SELECT product, loan_id, outstanding,\n    -- add rn here: one numbering per product, biggest first\n  FROM loans\n  WHERE collectibility >= 3\n    AND status <> 'Written Off'\n)\nSELECT product, loan_id, outstanding\nFROM ranked\n-- keep only the top row of each product\n;`,
        solution: `WITH ranked AS (
  SELECT product, loan_id, outstanding,
    ROW_NUMBER() OVER (PARTITION BY product ORDER BY outstanding DESC) AS rn
  FROM loans
  WHERE collectibility >= 3
    AND status <> 'Written Off'
)
SELECT product, loan_id, outstanding
FROM ranked
WHERE rn = 1;`,
        altSolutions: [
          `WITH ranked AS (
  SELECT product, loan_id, outstanding,
    RANK() OVER (PARTITION BY product ORDER BY outstanding DESC) AS rnk
  FROM loans
  WHERE collectibility >= 3 AND status <> 'Written Off'
)
SELECT product, loan_id, outstanding
FROM ranked
WHERE rnk = 1;`,
          `SELECT product, loan_id, outstanding
FROM (
  SELECT product, loan_id, outstanding,
    ROW_NUMBER() OVER (PARTITION BY product ORDER BY outstanding DESC) AS rn
  FROM loans
  WHERE collectibility >= 3 AND status <> 'Written Off'
)
WHERE rn = 1;`
        ],
        wrong: [
          `SELECT product, loan_id, outstanding FROM loans WHERE collectibility >= 3 AND status <> 'Written Off' AND ROW_NUMBER() OVER (PARTITION BY product ORDER BY outstanding DESC) = 1;`,
          `SELECT product, loan_id, outstanding, ROW_NUMBER() OVER (PARTITION BY product ORDER BY outstanding DESC) AS rn FROM loans WHERE collectibility >= 3 AND status <> 'Written Off' AND rn = 1;`,
          `SELECT product, loan_id, outstanding FROM loans WHERE collectibility >= 3 AND status <> 'Written Off' ORDER BY outstanding DESC LIMIT 4;`,
          `WITH ranked AS (SELECT product, loan_id, outstanding, ROW_NUMBER() OVER (PARTITION BY product ORDER BY outstanding) AS rn FROM loans WHERE collectibility >= 3 AND status <> 'Written Off') SELECT product, loan_id, outstanding FROM ranked WHERE rn = 1;`,
          `WITH ranked AS (SELECT product, loan_id, outstanding, ROW_NUMBER() OVER (PARTITION BY product ORDER BY outstanding DESC) AS rn FROM loans WHERE status <> 'Written Off') SELECT product, loan_id, outstanding FROM ranked WHERE rn = 1;`,
          `SELECT product, loan_id, MAX(outstanding) AS outstanding FROM loans WHERE collectibility >= 3 AND status <> 'Written Off' GROUP BY product;`
        ],
        traps: [
          { re: /\bWHERE\b[^;()]*\b(ROW_NUMBER|RANK|DENSE_RANK)\s*\(/i, msg: '<code>WHERE</code> runs before window functions, so it cannot use one. Calculate the number in a CTE, then filter in the next step.' },
          { re: /LIMIT\s+\d/i, msg: '<code>LIMIT</code> keeps the top rows overall, and the top 4 here may all come from two products. You need the top row inside each product.' },
          { re: /OVER\s*\([^)]*ORDER\s+BY\s+outstanding\s*(ASC\s*)?\)/i, msg: 'This puts the smallest loan first. Add <code>DESC</code> inside <code>OVER</code>.' },
          { re: /\bAS\s+(\w+)\b[^()]*\bWHERE\b[^()]*\b\1\s*(=|<)/i, msg: 'A column name made in <code>SELECT</code> is not ready yet when <code>WHERE</code> runs, and that applies to window columns too. Move the numbering into a CTE and filter in the next step.' },
          { re: /^(?![\s\S]*(collectibility))/i, msg: 'NPL means Kol 3 or worse, so filter on <code>collectibility &gt;= 3</code> as well.' }
        ],
        requires: [{ re: /\bOVER\b/i, msg: 'Your result is right, and this mission practices the window pattern. Rebuild it with <code>ROW_NUMBER() OVER (PARTITION BY ...)</code>, because it also handles top 3 and latest row. <code>MAX</code> cannot do those.' }],
        hints: [
          `In the first step, add a number that restarts for each product, with the biggest loan as 1.`,
          `That column is <code>ROW_NUMBER() OVER (PARTITION BY product ORDER BY outstanding DESC) AS rn</code>.`,
          `Finish the query with <code>WHERE rn = 1</code> after <code>FROM ranked</code>.`
        ],
        win: `This is one of the most useful patterns in SQL. Change <code>rn = 1</code> to <code>rn &lt;= 3</code> and you have the top 3 per product, with no other changes.`,
        pattern: { sql: `WITH ranked AS (\n  SELECT grp, col_a, amount,\n    ROW_NUMBER() OVER (PARTITION BY grp ORDER BY amount DESC) AS rn\n  FROM table_name\n)\nSELECT grp, col_a, amount\nFROM ranked\nWHERE rn = 1;`, note: 'Top row per group' },
        atWork: `BigQuery has a shortcut called <code>QUALIFY</code> that filters on a window function directly. The CTE pattern here works on Oracle, SQL Server, BigQuery and PostgreSQL alike, so learn it first.`
      },
      {
        id: '5.7',
        title: 'Latest row per group',
        newIdea: 'Sort dates newest first inside OVER, and row 1 is the latest row per group.',
        from: 'Budi, Field Collection lead',
        teach: `<p>"The latest row for each thing" comes up constantly: last call per loan, last payment per customer, latest status per case. It is the top-one pattern with a date in charge.</p><p>Order by date, newest first, so the newest row gets number 1. Two rows can share a date, so add an ID as a second sort column. Then the same row wins every time.</p>`,
        ex: [
          ['WITH ranked AS (', 'First build a step called ranked'],
          ['  SELECT feed_name, run_date, rows_loaded, status,', 'holding each [[batch]] run, its feed (the data file loaded each night), date, rows and status,'],
          ['    ROW_NUMBER() OVER (PARTITION BY feed_name ORDER BY run_date DESC, run_id DESC) AS rn', 'numbered inside each feed with the newest run as 1, and the ID settling any tie,'],
          ['  FROM batch_runs', 'from the batch_runs table.'],
          [')', 'With that ready,'],
          ['SELECT feed_name, run_date, rows_loaded, status', 'show the feed, date, rows and status'],
          ['FROM ranked', 'from that step,'],
          ['WHERE rn = 1;', 'keeping only the latest run of each feed.']
        ],
        bridge: 'Like sorting by date, newest first, then Remove Duplicates on the loan ID.',
        task: `Case review tomorrow. For each [[Kol 5]] loan that is not written off, show the most recent activity: <code>loan_id</code>, <code>activity_date</code>, <code>activity_type</code>, <code>result</code>. One row per loan. Activities are in <code>collection_activities</code>. Kol and status are in <code>loans</code>. Loans with no activity at all will not appear, and that is fine.`,
        solution: `WITH ranked AS (
  SELECT a.loan_id, a.activity_date, a.activity_type, a.result,
    ROW_NUMBER() OVER (
      PARTITION BY a.loan_id
      ORDER BY a.activity_date DESC, a.activity_id DESC
    ) AS rn
  FROM collection_activities a
  JOIN loans l
    ON l.loan_id = a.loan_id
  WHERE l.collectibility = 5
    AND l.status <> 'Written Off'
)
SELECT loan_id, activity_date, activity_type, result
FROM ranked
WHERE rn = 1;`,
        altSolutions: [
          `WITH ranked AS (
  SELECT a.loan_id, a.activity_date, a.activity_type, a.result,
    ROW_NUMBER() OVER (PARTITION BY a.loan_id ORDER BY a.activity_date DESC) AS rn
  FROM collection_activities a
  JOIN loans l ON l.loan_id = a.loan_id
  WHERE l.collectibility = 5 AND l.status <> 'Written Off'
)
SELECT loan_id, activity_date, activity_type, result
FROM ranked
WHERE rn = 1;`,
          `WITH ranked AS (
  SELECT loan_id, activity_date, activity_type, result,
    RANK() OVER (PARTITION BY loan_id ORDER BY activity_date DESC) AS rnk
  FROM collection_activities
  WHERE loan_id IN (SELECT loan_id FROM loans WHERE collectibility = 5 AND status <> 'Written Off')
)
SELECT loan_id, activity_date, activity_type, result
FROM ranked
WHERE rnk = 1;`
        ],
        wrong: [
          `WITH ranked AS (SELECT a.loan_id, a.activity_date, a.activity_type, a.result, ROW_NUMBER() OVER (PARTITION BY a.loan_id ORDER BY a.activity_date) AS rn FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id WHERE l.collectibility = 5 AND l.status <> 'Written Off') SELECT loan_id, activity_date, activity_type, result FROM ranked WHERE rn = 1;`,
          `WITH ranked AS (SELECT a.loan_id, a.activity_date, a.activity_type, a.result, ROW_NUMBER() OVER (ORDER BY a.activity_date DESC) AS rn FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id WHERE l.collectibility = 5 AND l.status <> 'Written Off') SELECT loan_id, activity_date, activity_type, result FROM ranked WHERE rn = 1;`,
          `WITH ranked AS (SELECT a.loan_id, a.activity_date, a.activity_type, a.result, ROW_NUMBER() OVER (PARTITION BY a.loan_id ORDER BY a.activity_date DESC) AS rn FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id WHERE l.collectibility = 5) SELECT loan_id, activity_date, activity_type, result FROM ranked WHERE rn = 1;`,
          `SELECT a.loan_id, MAX(a.activity_date) AS activity_date, a.activity_type, a.result FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id WHERE l.collectibility = 5 AND l.status <> 'Written Off' GROUP BY a.loan_id;`,
          `WITH ranked AS (SELECT a.loan_id, a.activity_date, a.activity_type, a.result, ROW_NUMBER() OVER (PARTITION BY a.loan_id ORDER BY a.activity_date DESC, a.activity_id DESC) AS rn FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id WHERE l.collectibility = 5 AND l.status = 'Active') SELECT loan_id, activity_date, activity_type, result FROM ranked WHERE rn = 1;`
        ],
        traps: [
          { re: /OVER\s*\([^)]*ORDER\s+BY\s+(a\.)?activity_date\s*(ASC\s*)?\)/i, msg: 'This gives number 1 to the oldest activity. Add <code>DESC</code> so the newest comes first.' },
          { re: /^(?![\s\S]*PARTITION\s+BY)/i, msg: 'Without <code>PARTITION BY</code> you get one row for the whole list. You need one numbering per loan.' },
          { re: /^(?![\s\S]*Written Off)/i, msg: 'The request leaves out written-off loans, so filter on <code>status</code> as well as Kol.' }
        ],
        requires: [
          { re: /\bOVER\b/i, msg: 'Your result is right. This mission practices the window pattern, which also handles the latest 3 rows and works the same on every major database. Rebuild it with <code>ROW_NUMBER() OVER (...)</code>.' },
          { re: /^(?![\s\S]*status\s*=\s*'Active')/i, msg: 'Your rows match today, and the request is broader than <code>status = \'Active\'</code>. Restructured loans are on the book too, so write <code>status &lt;&gt; \'Written Off\'</code>.' }
        ],
        hints: [
          `Use the same two steps as the last mission, with a <code>JOIN</code> to <code>loans</code> in the first step.`,
          `The numbering restarts per loan, with the newest date first: <code>PARTITION BY a.loan_id ORDER BY a.activity_date DESC, a.activity_id DESC</code>. The ID is there in case two activities share a date.`,
          `In the first step, add <code>ROW_NUMBER() OVER (PARTITION BY a.loan_id ORDER BY a.activity_date DESC, a.activity_id DESC) AS rn</code>. In the second, keep <code>WHERE rn = 1</code>.`
        ],
        win: `You will use this pattern often. Here it also shows that the bank has 14 Kol 5 loans on the book and this list has 13, so one has no logged activity at all, and that deserves a question.`,
        pattern: { sql: `WITH ranked AS (\n  SELECT grp, event_date, col_a,\n    ROW_NUMBER() OVER (\n      PARTITION BY grp\n      ORDER BY event_date DESC, id DESC\n    ) AS rn\n  FROM table_name\n)\nSELECT grp, event_date, col_a\nFROM ranked\nWHERE rn = 1;`, note: 'Latest row per group' }
      },
      {
        id: '5.8',
        type: 'quiz',
        title: 'Which ranking do you need?',
        newIdea: 'RANK can return more rows than the top N you asked for, and ROW_NUMBER never does.',
        teach: `<p>Choosing a ranking function is a business choice.</p><ul><li><code>ROW_NUMBER</code> always gives exactly N rows. If two rows tie at the last place, the database picks one with no real reason. Add a second sort column so it always picks the same one.</li><li><code>RANK</code> keeps tied rows together, so "top 4" can come back with more than 4 rows.</li></ul>`,
        bridge: 'In Excel, filter a RANK.EQ column to 4 or less. Two rows ranked 4 both stay, so you see 5 rows.',
        question: `The top of the PTP table reads 34, 29, 27, 26, 26, 24. How many rows will this query return?`,
        code: `WITH ptp_counts AS (
  SELECT collector_id, COUNT(*) AS ptps
  FROM collection_activities
  WHERE result = 'PTP'
  GROUP BY collector_id
),
ranked AS (
  SELECT collector_id, ptps,
    RANK() OVER (ORDER BY ptps DESC) AS ptp_rank
  FROM ptp_counts
)
SELECT collector_id, ptps, ptp_rank
FROM ranked
WHERE ptp_rank <= 4;`,
        check: { sql: `WITH ptp_counts AS (SELECT collector_id, COUNT(*) AS ptps FROM collection_activities WHERE result = 'PTP' GROUP BY collector_id), ranked AS (SELECT collector_id, ptps, RANK() OVER (ORDER BY ptps DESC) AS ptp_rank FROM ptp_counts) SELECT COUNT(*) FROM ranked WHERE ptp_rank <= 4;`, equals: 5 },
        choices: [
          { t: '4 rows', why: 'That is what ROW_NUMBER would give. With RANK, both collectors on 26 are ranked 4, and both pass the filter.' },
          { t: '5 rows', correct: true, why: 'Yes. The ranks are 1, 2, 3, 4, 4, and the next one is 6. Both people on 26 share rank 4, so both stay.' },
          { t: '6 rows', why: 'The collector on 24 gets rank 6 under RANK, because the tie used up position 5. That row fails the filter.' },
          { t: 'An error, because a window function cannot be filtered', why: 'WHERE cannot use a window function directly. Here the rank was calculated in an earlier step, so filtering it works fine.' }
        ],
        win: `Before you keep only the top N, ask what should happen to ties. If a manager gives a bonus to the top 4, a tie matters to real people, so it is worth asking.`
      },
      {
        id: '5.9',
        title: 'Running total',
        newIdea: 'ORDER BY inside OVER makes SUM add up from the first row to the current row.',
        from: 'Dian, Finance',
        teach: `<p>Put <code>ORDER BY</code> inside the brackets of <code>SUM() OVER</code> and it stops being one grand total. It becomes a [[running total]]: each row adds everything so far.</p><p>On one year of data like this, that is a year-to-date figure, which managers ask for all the time.</p>`,
        ex: [
          ['WITH by_date AS (', 'First build a step called by_date'],
          ['  SELECT write_off_date, SUM(outstanding) AS written_off', 'holding each write-off date and the balance written off,'],
          ['  FROM loans', 'from the loans table,'],
          ['  WHERE write_off_date IS NOT NULL', 'for loans that have a write-off date,'],
          ['  GROUP BY write_off_date', 'with one row per date.'],
          [')', 'With that ready,'],
          ['SELECT write_off_date, written_off,', 'show each date and its amount,'],
          ['  SUM(written_off) OVER (ORDER BY write_off_date) AS running_total', 'add everything up to and including that date,'],
          ['FROM by_date', 'read from that step,'],
          ['ORDER BY write_off_date;', 'with the earliest date first.']
        ],
        exNote: 'Write-offs in this data happen at month end, so each date stands for one month.',
        bridge: 'The balance column of a ledger: last balance plus this line.',
        task: `Show cash received year to date. Use every row in <code>payments</code>. One row per month: <code>pay_month</code> (like <code>2026-01</code>), <code>cash</code> (that month's total) and <code>running_total</code> (all cash so far). Earliest month first. Fill in the blanks.`,
        starter: `WITH monthly AS (\n  SELECT strftime('%Y-%m', payment_date) AS pay_month,\n    SUM(amount) AS cash\n  FROM payments\n  GROUP BY pay_month\n)\nSELECT pay_month, cash,\n  SUM(cash) OVER (____ BY ____) AS running_total\nFROM monthly\nORDER BY pay_month;`,
        fill: ['ORDER', 'pay_month'],
        solution: `WITH monthly AS (
  SELECT strftime('%Y-%m', payment_date) AS pay_month,
    SUM(amount) AS cash
  FROM payments
  GROUP BY pay_month
)
SELECT pay_month, cash,
  SUM(cash) OVER (ORDER BY pay_month) AS running_total
FROM monthly
ORDER BY pay_month;`,
        ordered: 'pay_month',
        altSolutions: [
          `SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS cash,
  SUM(SUM(amount)) OVER (ORDER BY strftime('%Y-%m', payment_date)) AS running_total
FROM payments
GROUP BY pay_month
ORDER BY pay_month;`,
          `WITH monthly AS (
  SELECT substr(payment_date, 1, 7) AS pay_month, SUM(amount) AS cash
  FROM payments
  GROUP BY pay_month
)
SELECT pay_month, cash,
  SUM(cash) OVER (ORDER BY pay_month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total
FROM monthly
ORDER BY pay_month;`
        ],
        wrong: [
          `WITH monthly AS (SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS cash FROM payments GROUP BY pay_month) SELECT pay_month, cash, SUM(cash) OVER () AS running_total FROM monthly ORDER BY pay_month;`,
          `WITH monthly AS (SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS cash FROM payments GROUP BY pay_month) SELECT pay_month, cash, SUM(cash) OVER (ORDER BY pay_month DESC) AS running_total FROM monthly ORDER BY pay_month;`,
          `WITH monthly AS (SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS cash FROM payments GROUP BY pay_month) SELECT pay_month, cash, SUM(cash) OVER (PARTITION BY pay_month) AS running_total FROM monthly ORDER BY pay_month;`,
          `WITH monthly AS (SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS cash FROM payments WHERE amount > 0 GROUP BY pay_month) SELECT pay_month, cash, SUM(cash) OVER (ORDER BY pay_month) AS running_total FROM monthly ORDER BY pay_month;`
        ],
        traps: [
          { re: /\bamount\s*(>|>=|<>|!=)/i, msg: 'The request says to use every row in <code>payments</code>, so keep the negative row and the zero rows in. That filter is what moved your numbers.' },
          { re: /OVER\s*\(\s*\)/i, msg: 'Empty brackets give the grand total on every row. A running total needs <code>ORDER BY</code> inside them.' },
          { re: /OVER\s*\(\s*ORDER\s+BY\s+[^)]*DESC/i, msg: '<code>DESC</code> starts adding from the last month and works backward. Use the normal order inside <code>OVER</code>.' },
          { re: /OVER\s*\(\s*PARTITION\s+BY\s+pay_month/i, msg: '<code>PARTITION BY</code> restarts for each month, so nothing carries over. Use <code>ORDER BY</code> instead.' }
        ],
        requires: [{ re: /\bOVER\b/i, msg: 'Your numbers are right. This mission practices <code>SUM(...) OVER (ORDER BY ...)</code>, so use that for the running total.' }],
        hints: [
          `The sum should grow month by month, so the window needs an order.`,
          `Inside the brackets, sort by the month column. The blank before <code>BY</code> is the sorting keyword.`,
          `The line should read <code>SUM(cash) OVER (ORDER BY pay_month) AS running_total</code>.`
        ],
        win: `The last running total should equal the plain <code>SUM(amount)</code> of the whole table. Checking that takes seconds, and it is a good habit for any cumulative figure you send out.`,
        pattern: { sql: `SELECT period, amount,\n  SUM(amount) OVER (ORDER BY period) AS running_total\nFROM table_name\nORDER BY period;`, note: 'Running total' },
        atWork: `With only <code>ORDER BY</code>, most databases treat rows with the same sort value as one block and add them together. If your sort column can repeat, order by something unique as well, or the running total can jump. Across several years, add <code>PARTITION BY</code> on the year inside <code>OVER</code> so the total restarts each January.`
      },
      {
        id: '5.10',
        title: 'Moving average',
        newIdea: 'ROWS BETWEEN sets exactly which rows the window looks at.',
        from: 'Dian, Finance',
        teach: `<p>A [[moving average]] smooths out bumpy months, so the trend is easier to see. To build one, you control the [[frame]], which is the set of rows the window looks at.</p><p><code>ROWS BETWEEN 1 PRECEDING AND CURRENT ROW</code> means the row before plus this row. Change the number to widen it. The first months do not have that many months before them, so they average only the months available.</p>`,
        ex: [
          ['WITH monthly AS (', 'First build a step called monthly'],
          [`  SELECT strftime('%Y-%m', activity_date) AS act_month,`, 'holding each month'],
          ['    COUNT(*) AS activities', 'and its number of activities'],
          ['  FROM collection_activities', 'from the collection_activities table,'],
          ['  GROUP BY act_month', 'with one row per month.'],
          [')', 'With that ready,'],
          ['SELECT act_month, activities,', 'show each month and its count,'],
          ['  AVG(activities) OVER (', 'add an average'],
          ['    ORDER BY act_month', 'going through the months in order,'],
          ['    ROWS BETWEEN 1 PRECEDING AND CURRENT ROW', 'covering the month before and this month,'],
          ['  ) AS moving_avg_2m', 'and name it moving_avg_2m,'],
          ['FROM monthly', 'read from that step,'],
          ['ORDER BY act_month;', 'with the earliest month first.']
        ],
        bridge: 'Like =AVERAGE(B2:B4) dragged down a column, so the range slides with each row.',
        task: `Monthly cash jumps around too much for my chart. Using every row in <code>payments</code>, show <code>pay_month</code>, <code>cash</code> and <code>moving_avg_3m</code>: the average of this month and the two before, rounded to whole rupiah. Earliest month first. Add the missing column.`,
        starter: `WITH monthly AS (
  SELECT strftime('%Y-%m', payment_date) AS pay_month,
    SUM(amount) AS cash
  FROM payments
  GROUP BY pay_month
)
SELECT pay_month, cash,
  -- add moving_avg_3m here
FROM monthly
ORDER BY pay_month;`,
        solution: `WITH monthly AS (
  SELECT strftime('%Y-%m', payment_date) AS pay_month,
    SUM(amount) AS cash
  FROM payments
  GROUP BY pay_month
)
SELECT pay_month, cash,
  ROUND(AVG(cash) OVER (
    ORDER BY pay_month
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  ), 0) AS moving_avg_3m
FROM monthly
ORDER BY pay_month;`,
        ordered: 'pay_month',
        altSolutions: [
          `WITH monthly AS (
  SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS cash
  FROM payments
  GROUP BY pay_month
)
SELECT pay_month, cash,
  ROUND(AVG(cash) OVER (ORDER BY pay_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)) AS moving_avg_3m
FROM monthly
ORDER BY pay_month;`,
          `WITH monthly AS (
  SELECT substr(payment_date, 1, 7) AS pay_month, SUM(amount) AS cash
  FROM payments
  GROUP BY pay_month
)
SELECT pay_month, cash,
  ROUND(AVG(cash) OVER (ORDER BY pay_month ROWS 2 PRECEDING), 0) AS moving_avg_3m
FROM monthly
ORDER BY pay_month;`
        ],
        wrong: [
          `WITH monthly AS (SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS cash FROM payments GROUP BY pay_month) SELECT pay_month, cash, ROUND(AVG(cash) OVER (ORDER BY pay_month ROWS BETWEEN 3 PRECEDING AND CURRENT ROW)) AS moving_avg_3m FROM monthly ORDER BY pay_month;`,
          `WITH monthly AS (SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS cash FROM payments GROUP BY pay_month) SELECT pay_month, cash, ROUND(AVG(cash) OVER (ORDER BY pay_month)) AS moving_avg_3m FROM monthly ORDER BY pay_month;`,
          `WITH monthly AS (SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS cash FROM payments GROUP BY pay_month) SELECT pay_month, cash, ROUND(AVG(cash) OVER (ORDER BY pay_month ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)) AS moving_avg_3m FROM monthly ORDER BY pay_month;`,
          `WITH monthly AS (SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS cash FROM payments GROUP BY pay_month) SELECT pay_month, cash, ROUND(SUM(cash) OVER (ORDER BY pay_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)) AS moving_avg_3m FROM monthly ORDER BY pay_month;`,
          `WITH monthly AS (SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS cash FROM payments GROUP BY pay_month) SELECT pay_month, cash, ROUND(AVG(cash) OVER (ORDER BY pay_month ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING), 0) AS moving_avg_3m FROM monthly ORDER BY pay_month;`,
          `WITH monthly AS (SELECT strftime('%Y-%m', payment_date) AS pay_month, SUM(amount) AS cash FROM payments WHERE amount > 0 GROUP BY pay_month) SELECT pay_month, cash, ROUND(AVG(cash) OVER (ORDER BY pay_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 0) AS moving_avg_3m FROM monthly ORDER BY pay_month;`
        ],
        traps: [
          { re: /\bamount\s*(>|>=|<>|!=)/i, msg: 'The request says to use every row in <code>payments</code>, so keep the negative row and the zero rows in. That filter is what moved your numbers.' },
          { re: /\bFOLLOWING\b/i, msg: 'This looks ahead to future months. The request is this month and the two before.' },
          { re: /ROUND\s*\(\s*AVG\s*\(\s*\w+\s*\)\s*(,\s*\d+\s*)?\)\s*OVER/i, msg: '<code>OVER</code> belongs to <code>AVG</code>, so keep it inside <code>ROUND</code>: <code>ROUND(AVG(cash) OVER (...), 0)</code>.' },
          { re: /\b3\s+PRECEDING/i, msg: 'Three preceding rows plus the current row is 4 months. For a 3-month average you need <code>2 PRECEDING</code>.' },
          { re: /\b1\s+PRECEDING\s+AND\s+CURRENT/i, msg: 'One preceding row plus the current row is only 2 months. For a 3-month average you need <code>2 PRECEDING</code>.' },
          { re: /AVG\s*\(\s*cash\s*\)\s*OVER\s*\(\s*ORDER\s+BY\s+pay_month\s*\)/i, msg: 'With no frame, this averages every month so far. Add <code>ROWS BETWEEN 2 PRECEDING AND CURRENT ROW</code>.' },
          { re: /\bSUM\s*\(\s*cash\s*\)\s*OVER/i, msg: 'This adds the three months together. A moving average needs <code>AVG</code>.' }
        ],
        hints: [
          `The frame should cover three rows, and the current row counts as one of them.`,
          `Write <code>AVG(cash) OVER (...)</code>, with <code>ORDER BY pay_month</code> and then the frame inside the brackets. Wrap it all in <code>ROUND(..., 0)</code>.`,
          `The frame line is <code>ROWS BETWEEN 2 PRECEDING AND CURRENT ROW</code>.`
        ],
        win: `A moving average lets a manager tell one bad month apart from a real slowdown. When you share one, say how many months it covers and that the first months average fewer.`,
        pattern: { sql: `SELECT period, amount,\n  AVG(amount) OVER (\n    ORDER BY period\n    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW\n  ) AS moving_avg\nFROM table_name;`, note: 'Moving average over 3 rows' },
        atWork: `<code>ROWS</code> counts rows, and calendar months are a different thing. If a month has no row at all, your "3 months" quietly covers 4. On real data, check that no period is missing first.`
      },
      {
        id: '5.11',
        title: 'Compare with last month: LAG',
        newIdea: 'LAG reads a value from the row before the current one.',
        from: 'Citra, Head of Collection',
        teach: `<p><code>LAG(column)</code> looks back one row and brings that row's value onto this row. The <code>ORDER BY</code> inside <code>OVER</code> decides what "back" means. Subtract it, and you have the change from last period.</p><p>The first row has nothing before it, so its <code>LAG</code> is [[NULL]], and so is its change. That is correct, because there is no earlier month to compare with.</p>`,
        ex: [
          ['WITH monthly AS (', 'First build a step called monthly'],
          [`  SELECT strftime('%Y-%m', payment_date) AS pay_month,`, 'holding each month'],
          ['    SUM(amount) AS collector_cash', 'and the cash received'],
          ['  FROM payments', 'from the payments table,'],
          [`  WHERE channel = 'Collector'`, 'through the Collector channel only,'],
          ['  GROUP BY pay_month', 'with one row per month.'],
          [')', 'With that ready,'],
          ['SELECT pay_month, collector_cash,', 'show each month and its cash,'],
          ['  collector_cash - LAG(collector_cash) OVER (ORDER BY pay_month) AS change', 'subtract the month before to get the change,'],
          ['FROM monthly', 'read from that step,'],
          ['ORDER BY pay_month;', 'with the earliest month first.']
        ],
        bridge: 'Like =B3-B2 dragged down a column: this period minus the one above.',
        task: `Show how the [[NPL]] balance of loans on the book today moved, month by month. A loan counts in a month if its snapshot that month shows Kol 3 or worse. Leave out any loan whose <code>status</code> in <code>loans</code> is Written Off. Columns: <code>snapshot_month</code>, <code>npl_balance</code>, <code>change_from_prior</code>. January's change stays NULL. Add the missing column.`,
        starter: `WITH monthly AS (
  SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance
  FROM loan_snapshots s
  JOIN loans l
    ON l.loan_id = s.loan_id
  WHERE s.collectibility >= 3
    AND l.status <> 'Written Off'
  GROUP BY s.snapshot_month
)
SELECT snapshot_month, npl_balance,
  -- add change_from_prior here
FROM monthly
ORDER BY snapshot_month;`,
        solution: `WITH monthly AS (
  SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance
  FROM loan_snapshots s
  JOIN loans l
    ON l.loan_id = s.loan_id
  WHERE s.collectibility >= 3
    AND l.status <> 'Written Off'
  GROUP BY s.snapshot_month
)
SELECT snapshot_month, npl_balance,
  npl_balance - LAG(npl_balance) OVER (ORDER BY snapshot_month) AS change_from_prior
FROM monthly
ORDER BY snapshot_month;`,
        ordered: 'snapshot_month',
        altSolutions: [
          `SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance,
  SUM(s.outstanding) - LAG(SUM(s.outstanding)) OVER (ORDER BY s.snapshot_month) AS change_from_prior
FROM loan_snapshots s
JOIN loans l ON l.loan_id = s.loan_id
WHERE s.collectibility >= 3 AND l.status <> 'Written Off'
GROUP BY s.snapshot_month
ORDER BY s.snapshot_month;`,
          `WITH monthly AS (
  SELECT snapshot_month, SUM(outstanding) AS npl_balance
  FROM loan_snapshots
  WHERE collectibility IN (3, 4, 5)
    AND loan_id NOT IN (SELECT loan_id FROM loans WHERE status = 'Written Off')
  GROUP BY snapshot_month
)
SELECT snapshot_month, npl_balance,
  npl_balance - LAG(npl_balance, 1) OVER (ORDER BY snapshot_month) AS change_from_prior
FROM monthly
ORDER BY snapshot_month;`
        ],
        wrong: [
          `WITH monthly AS (SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.collectibility >= 3 AND l.status <> 'Written Off' GROUP BY s.snapshot_month) SELECT snapshot_month, npl_balance, LAG(npl_balance) OVER (ORDER BY snapshot_month) - npl_balance AS change_from_prior FROM monthly ORDER BY snapshot_month;`,
          `WITH monthly AS (SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.collectibility >= 3 AND l.status <> 'Written Off' GROUP BY s.snapshot_month) SELECT snapshot_month, npl_balance, npl_balance - LAG(npl_balance) OVER (ORDER BY snapshot_month DESC) AS change_from_prior FROM monthly ORDER BY snapshot_month;`,
          `WITH monthly AS (SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance FROM loan_snapshots s WHERE s.collectibility >= 3 GROUP BY s.snapshot_month) SELECT snapshot_month, npl_balance, npl_balance - LAG(npl_balance) OVER (ORDER BY snapshot_month) AS change_from_prior FROM monthly ORDER BY snapshot_month;`,
          `WITH monthly AS (SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.collectibility >= 3 AND l.status <> 'Written Off' GROUP BY s.snapshot_month) SELECT snapshot_month, npl_balance, COALESCE(npl_balance - LAG(npl_balance) OVER (ORDER BY snapshot_month), 0) AS change_from_prior FROM monthly ORDER BY snapshot_month;`,
          `WITH monthly AS (SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.collectibility >= 3 AND l.status <> 'Written Off' GROUP BY s.snapshot_month) SELECT snapshot_month, npl_balance, npl_balance - LEAD(npl_balance) OVER (ORDER BY snapshot_month) AS change_from_prior FROM monthly ORDER BY snapshot_month;`
        ],
        traps: [
          { re: /LAG\s*\([^)]*\)\s*OVER\s*\([^)]*\)\s*-\s*\w*npl_balance/i, msg: 'The subtraction is backward. Change is this month minus last month, so a rising balance shows as a positive number.' },
          { re: /OVER\s*\(\s*ORDER\s+BY\s+[^)]*DESC/i, msg: '<code>DESC</code> makes LAG read the next month in the calendar. Keep the normal order inside <code>OVER</code>.' },
          { re: /COALESCE/i, msg: 'January has no prior month, so an honest answer is NULL. A 0 would claim the balance did not change.' },
          { re: /\bLEAD\s*\(/i, msg: '<code>LEAD</code> looks at the next month. The prior month needs <code>LAG</code>.' },
          { re: /^(?![\s\S]*Written Off)/i, msg: 'Snapshots have no status column, so join to <code>loans</code> and leave out written-off loans.' }
        ],
        requires: [{ re: /\bLAG\b/i, msg: 'Your numbers are right. This mission practices <code>LAG</code>, so use it for the change column.' }],
        hints: [
          `The function that looks one row back is <code>LAG</code>.`,
          `You want last month's balance, in month order. So <code>LAG</code> reads <code>npl_balance</code>, and <code>OVER</code> sorts by <code>snapshot_month</code>.`,
          `The line should read <code>npl_balance - LAG(npl_balance) OVER (ORDER BY snapshot_month) AS change_from_prior</code>.`
        ],
        win: `"How does this compare with last month?" is the first question in almost every review. A rise can mean loans moving into NPL, and a fall can mean payments or loans returning to current, including after a [[restructure|restructuring]].`,
        pattern: { sql: `SELECT period, amount,\n  amount - LAG(amount) OVER (ORDER BY period) AS change\nFROM table_name\nORDER BY period;`, note: 'Change from the prior period' },
        atWork: `Write-offs also lower NPL on a real report, but this query has already removed them. Filtering on today's status drops a written-off loan from every month, even months before its write-off. That keeps this query short, and in this data it changes the direction of the trend. A report of NPL as it stood each month removes each loan only from its write-off month onward, so ask how your bank defines it.`
      },
      {
        id: '5.12',
        title: 'Look ahead: LEAD',
        newIdea: 'LEAD reads a value from the row after the current one.',
        from: 'Budi, Field Collection lead',
        teach: `<p><code>LEAD</code> is the opposite of <code>LAG</code>. It looks forward one row and brings that value onto this row. The last row has nothing after it, so its <code>LEAD</code> is [[NULL]].</p><p>Row order in a table means nothing, so always order by the date. An ID can run in a different order from the dates.</p>`,
        ex: [
          ['SELECT payment_date, amount,', 'Show each payment\'s date and amount,'],
          ['  LEAD(payment_date) OVER (ORDER BY payment_date) AS next_payment_date', 'bring in the date of the next payment,'],
          ['FROM payments', 'from the payments table,'],
          ['WHERE loan_id = 1', 'for loan 1 only,'],
          ['ORDER BY payment_date;', 'with the earliest payment first.']
        ],
        bridge: 'Like a helper column in Excel with =A3 on row 2, pointing one row down.',
        task: `Walk me through what happened on loan 395. For each of its activities, show <code>activity_date</code>, <code>activity_type</code> and <code>next_activity_date</code>, the date of the next activity on that loan. Earliest first. The last row's next date stays NULL. Fill in the blanks.`,
        starter: `SELECT activity_date, activity_type,\n  ____(activity_date) OVER (ORDER BY ____) AS next_activity_date\nFROM collection_activities\nWHERE loan_id = 395\nORDER BY activity_date;`,
        fill: ['LEAD', 'activity_date'],
        solution: `SELECT activity_date, activity_type,
  LEAD(activity_date) OVER (ORDER BY activity_date) AS next_activity_date
FROM collection_activities
WHERE loan_id = 395
ORDER BY activity_date;`,
        ordered: 'activity_date',
        altSolutions: [
          `SELECT activity_date, activity_type,
  LEAD(activity_date, 1) OVER (PARTITION BY loan_id ORDER BY activity_date) AS next_activity_date
FROM collection_activities
WHERE loan_id = 395
ORDER BY activity_date;`
        ],
        wrong: [
          `SELECT activity_date, activity_type, LAG(activity_date) OVER (ORDER BY activity_date) AS next_activity_date FROM collection_activities WHERE loan_id = 395 ORDER BY activity_date;`,
          `SELECT activity_date, activity_type, LEAD(activity_date) OVER (ORDER BY activity_id) AS next_activity_date FROM collection_activities WHERE loan_id = 395 ORDER BY activity_date;`,
          `SELECT activity_date, activity_type, LEAD(activity_date) OVER (ORDER BY activity_date DESC) AS next_activity_date FROM collection_activities WHERE loan_id = 395 ORDER BY activity_date;`,
          `SELECT activity_date, activity_type, LEAD(activity_date) OVER (ORDER BY activity_date) AS next_activity_date FROM collection_activities ORDER BY activity_date;`,
          `SELECT activity_date, activity_type, (SELECT MIN(x.activity_date) FROM collection_activities x WHERE x.loan_id = 395 AND x.activity_date > a.activity_date) AS next_activity_date FROM collection_activities a WHERE loan_id = 395 ORDER BY activity_date;`
        ],
        traps: [
          { re: /\bLAG\s*\(/i, msg: '<code>LAG</code> looks back. The next activity is forward, so use <code>LEAD</code>.' },
          { re: /OVER\s*\(\s*(PARTITION\s+BY\s+\w+\s+)?ORDER\s+BY\s+activity_id/i, msg: 'On this loan, activity IDs do not run in date order. Order by <code>activity_date</code> so "next" means next in time.' },
          { re: /OVER\s*\([^)]*DESC/i, msg: '<code>DESC</code> flips time, so "next" would mean the earlier date. Keep the normal order inside <code>OVER</code>.' },
          { re: /^(?![\s\S]*\b395\b)/i, msg: 'This request is about one loan, so keep <code>WHERE loan_id = 395</code>.' }
        ],
        requires: [{ re: /\bLEAD\s*\(/i, msg: 'Your dates are right. This mission practices <code>LEAD</code>, so use it for <code>next_activity_date</code>.' }],
        hints: [
          `Looking forward one row is the job of <code>LEAD</code>.`,
          `You want the date from the next row, with rows in date order. So the <code>ORDER BY</code> blank is <code>activity_date</code> too.`,
          `The line should read <code>LEAD(activity_date) OVER (ORDER BY activity_date) AS next_activity_date</code>.`
        ],
        win: `Reading a loan's activity in true date order is how you rebuild the story of a case. System logs often store rows in the order they arrived, which can differ from the order things happened.`,
        pattern: { sql: `SELECT event_date,\n  LEAD(event_date) OVER (ORDER BY event_date) AS next_date\nFROM table_name\nORDER BY event_date;`, note: 'Bring in the next row\'s value' }
      },
      {
        id: '5.13',
        title: 'Days between dates',
        newIdea: 'Subtract two julianday() values to get the number of days between two dates.',
        from: 'Budi, Field Collection lead',
        teach: `<p>Dates here are text, and subtracting text gives nonsense. <code>julianday(date)</code> turns a date into a plain day number. Subtract two of those and you get the days between them.</p><p>Put the later date first, and the answer comes out positive.</p>`,
        ex: [
          ['SELECT loan_id, disbursed_date,', 'Show each loan and the day its money went out,'],
          [`  julianday('2026-10-31') - julianday(disbursed_date) AS days_since_disbursed`, 'work out the days from then to 2026-10-31, the last day in this data,'],
          ['FROM loans', 'from the loans table,'],
          ['ORDER BY loan_id', 'in loan ID order,'],
          ['LIMIT 5;', 'and stop after 5 rows.']
        ],
        bridge: 'Excel stores each date as a serial number, which is why =B2-A2 works, and julianday gives SQLite the same kind of day number.',
        task: `Back to loan 395. The next date is ready in the first step. Add <code>gap_days</code>, the days from each activity to the next. Columns: <code>activity_date</code>, <code>next_activity_date</code>, <code>gap_days</code>. Earliest first. The last row's gap stays NULL. Add the missing column.`,
        starter: `WITH timeline AS (
  SELECT activity_date,
    LEAD(activity_date) OVER (ORDER BY activity_date) AS next_activity_date
  FROM collection_activities
  WHERE loan_id = 395
)
SELECT activity_date, next_activity_date,
  -- add gap_days here
FROM timeline
ORDER BY activity_date;`,
        solution: `WITH timeline AS (
  SELECT activity_date,
    LEAD(activity_date) OVER (ORDER BY activity_date) AS next_activity_date
  FROM collection_activities
  WHERE loan_id = 395
)
SELECT activity_date, next_activity_date,
  julianday(next_activity_date) - julianday(activity_date) AS gap_days
FROM timeline
ORDER BY activity_date;`,
        ordered: 'activity_date',
        altSolutions: [
          `SELECT activity_date,
  LEAD(activity_date) OVER (ORDER BY activity_date) AS next_activity_date,
  julianday(LEAD(activity_date) OVER (ORDER BY activity_date)) - julianday(activity_date) AS gap_days
FROM collection_activities
WHERE loan_id = 395
ORDER BY activity_date;`
        ],
        wrong: [
          `WITH timeline AS (SELECT activity_date, LEAD(activity_date) OVER (ORDER BY activity_date) AS next_activity_date FROM collection_activities WHERE loan_id = 395) SELECT activity_date, next_activity_date, next_activity_date - activity_date AS gap_days FROM timeline ORDER BY activity_date;`,
          `WITH timeline AS (SELECT activity_date, LEAD(activity_date) OVER (ORDER BY activity_date) AS next_activity_date FROM collection_activities WHERE loan_id = 395) SELECT activity_date, next_activity_date, julianday(activity_date) - julianday(next_activity_date) AS gap_days FROM timeline ORDER BY activity_date;`,
          `WITH timeline AS (SELECT activity_date, LEAD(activity_date) OVER (ORDER BY activity_date) AS next_activity_date FROM collection_activities WHERE loan_id = 395) SELECT activity_date, next_activity_date, strftime('%j', next_activity_date) - strftime('%j', activity_date) AS gap_days FROM timeline ORDER BY activity_date;`
        ],
        traps: [
          { re: /^(?![\s\S]*julianday)/i, msg: 'Dates are text, so subtracting them directly does not give days. Wrap each one in <code>julianday()</code> first.' },
          { re: /julianday\(\s*activity_date\s*\)\s*-\s*julianday\(\s*next_activity_date/i, msg: 'Put the later date first, so the gap comes out as a positive number of days.' }
        ],
        requires: [{ re: /\bjulianday\s*\(/i, msg: 'Your day counts are right. This mission practices <code>julianday()</code>, so use it for <code>gap_days</code>.' }],
        hints: [
          `Dates are text, so each one needs turning into a day number before you subtract.`,
          `Use <code>julianday</code> from the example, once on each date, with the later date first.`,
          `The line should read <code>julianday(next_activity_date) - julianday(activity_date) AS gap_days</code>.`
        ],
        win: `Day counts drive much of collection work, such as how long since the last contact or how long a promise has been open. Loan 395 went from late February to early June with no activity, and now a query can show that.`,
        pattern: { sql: `julianday(later_date) - julianday(earlier_date) AS days_between`, note: 'Days between two dates' },
        atWork: `Date math differs a lot between databases. Oracle and PostgreSQL subtract dates directly with <code>a - b</code>. SQL Server uses <code>DATEDIFF(day, b, a)</code>, and BigQuery uses <code>DATE_DIFF(a, b, DAY)</code>. The Cheat sheet lists them.`
      },
      {
        id: '5.14',
        title: 'Find the long gaps',
        newIdea: 'PARTITION BY keeps LEAD inside one loan, so a gap never crosses into the next loan.',
        from: 'Budi, Field Collection lead',
        teach: `<p>Now use it across many loans. Without <code>PARTITION BY</code>, the last activity of one loan would take the first date of the next loan as its "next" date.</p><p>A column made in <code>SELECT</code> is not ready in the same <code>SELECT</code>. So build the next date in a [[CTE]], then work out and filter the gap in the next step, as in mission 5.6.</p>`,
        ex: [
          ['SELECT loan_id, payment_date,', 'Show each payment\'s loan and date,'],
          ['  LEAD(payment_date) OVER (PARTITION BY loan_id ORDER BY payment_date) AS next_payment_date', 'bring in the next payment date on the same loan,'],
          ['FROM payments', 'from the payments table,'],
          ['WHERE loan_id IN (2, 13)', 'for these two loans only,'],
          ['ORDER BY loan_id, payment_date;', 'sorted by loan and then by date.']
        ],
        exNote: 'Each loan\'s last payment shows NULL, because there is no later payment on that loan.',
        bridge: 'Like sorting by loan and date in Excel, then =IF(A3=A2,C3,"") so the next date stays inside the same loan.',
        task: `I want to see where we stopped contacting our worst loans. For [[Kol 5]] loans not written off, list every gap of more than 30 days between one activity and the next on the same loan. Columns: <code>loan_id</code>, <code>activity_date</code>, <code>next_activity_date</code>, <code>gap_days</code>. Biggest gap first.`,
        starter: `WITH timeline AS (\n  SELECT a.loan_id, a.activity_date,\n    -- add next_activity_date here, restarting for each loan\n  FROM collection_activities a\n  JOIN loans l ON l.loan_id = a.loan_id\n  WHERE l.collectibility = 5\n    AND l.status <> 'Written Off'\n)\nSELECT loan_id, activity_date, next_activity_date,\n  -- add gap_days here\nFROM timeline\n-- keep only gaps of more than 30 days\nORDER BY gap_days DESC;`,
        solution: `WITH timeline AS (
  SELECT a.loan_id, a.activity_date,
    LEAD(a.activity_date) OVER (
      PARTITION BY a.loan_id
      ORDER BY a.activity_date
    ) AS next_activity_date
  FROM collection_activities a
  JOIN loans l
    ON l.loan_id = a.loan_id
  WHERE l.collectibility = 5
    AND l.status <> 'Written Off'
)
SELECT loan_id, activity_date, next_activity_date,
  julianday(next_activity_date) - julianday(activity_date) AS gap_days
FROM timeline
WHERE julianday(next_activity_date) - julianday(activity_date) > 30
ORDER BY gap_days DESC;`,
        ordered: 'gap_days',
        altSolutions: [
          `WITH timeline AS (
  SELECT a.loan_id, a.activity_date,
    LEAD(a.activity_date) OVER (PARTITION BY a.loan_id ORDER BY a.activity_date) AS next_activity_date
  FROM collection_activities a
  WHERE a.loan_id IN (SELECT loan_id FROM loans WHERE collectibility = 5 AND status <> 'Written Off')
),
gaps AS (
  SELECT loan_id, activity_date, next_activity_date,
    CAST(julianday(next_activity_date) - julianday(activity_date) AS INTEGER) AS gap_days
  FROM timeline
)
SELECT loan_id, activity_date, next_activity_date, gap_days
FROM gaps
WHERE gap_days > 30
ORDER BY gap_days DESC;`,
          `WITH timeline AS (
  SELECT a.loan_id, a.activity_date,
    LEAD(a.activity_date) OVER (PARTITION BY a.loan_id ORDER BY a.activity_date) AS next_activity_date
  FROM collection_activities a
  JOIN loans l ON l.loan_id = a.loan_id
  WHERE l.collectibility = 5 AND l.status <> 'Written Off'
)
SELECT loan_id, activity_date, next_activity_date,
  julianday(next_activity_date) - julianday(activity_date) AS gap_days
FROM timeline
WHERE gap_days > 30
ORDER BY gap_days DESC;`
        ],
        wrong: [
          `WITH timeline AS (SELECT a.loan_id, a.activity_date, LEAD(a.activity_date) OVER (ORDER BY a.activity_date) AS next_activity_date FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id WHERE l.collectibility = 5 AND l.status <> 'Written Off') SELECT loan_id, activity_date, next_activity_date, julianday(next_activity_date) - julianday(activity_date) AS gap_days FROM timeline WHERE julianday(next_activity_date) - julianday(activity_date) > 30 ORDER BY gap_days DESC;`,
          `WITH timeline AS (SELECT a.loan_id, a.activity_date, LEAD(a.activity_date) OVER (PARTITION BY a.loan_id ORDER BY a.activity_date) AS next_activity_date FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id WHERE l.collectibility = 5 AND l.status <> 'Written Off') SELECT loan_id, activity_date, next_activity_date, next_activity_date - activity_date AS gap_days FROM timeline WHERE next_activity_date - activity_date > 30 ORDER BY gap_days DESC;`,
          `WITH timeline AS (SELECT a.loan_id, a.activity_date, LEAD(a.activity_date) OVER (PARTITION BY a.loan_id ORDER BY a.activity_date) AS next_activity_date FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id WHERE l.collectibility = 5 AND l.status <> 'Written Off') SELECT loan_id, activity_date, next_activity_date, julianday(next_activity_date) - julianday(activity_date) AS gap_days FROM timeline WHERE julianday(next_activity_date) - julianday(activity_date) >= 30 ORDER BY gap_days DESC;`,
          `WITH timeline AS (SELECT a.loan_id, a.activity_date, LEAD(a.activity_date) OVER (PARTITION BY a.loan_id ORDER BY a.activity_date) AS next_activity_date FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id WHERE l.collectibility = 5) SELECT loan_id, activity_date, next_activity_date, julianday(next_activity_date) - julianday(activity_date) AS gap_days FROM timeline WHERE julianday(next_activity_date) - julianday(activity_date) > 30 ORDER BY gap_days DESC;`,
          `WITH timeline AS (SELECT a.loan_id, a.activity_date, LEAD(a.activity_date) OVER (PARTITION BY a.loan_id ORDER BY a.activity_date) AS next_activity_date FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id WHERE l.collectibility = 5 AND l.status <> 'Written Off') SELECT loan_id, activity_date, next_activity_date, julianday(activity_date) - julianday(next_activity_date) AS gap_days FROM timeline WHERE julianday(activity_date) - julianday(next_activity_date) < -30 ORDER BY gap_days DESC;`,
          `WITH timeline AS (SELECT a.loan_id, a.activity_date, LEAD(a.activity_date) OVER (PARTITION BY a.loan_id ORDER BY a.activity_date) AS n FROM collection_activities a JOIN loans l ON l.loan_id = a.loan_id WHERE l.collectibility = 5 AND l.status <> 'Written Off') SELECT loan_id, n AS activity_date, activity_date AS next_activity_date, julianday(n) - julianday(activity_date) AS gap_days FROM timeline WHERE julianday(n) - julianday(activity_date) > 30 ORDER BY gap_days DESC;`
        ],
        traps: [
          { re: /AS\s+next_activity_date\s*,[^()]*julianday\s*\(\s*next_activity_date/i, msg: 'A column made in <code>SELECT</code> is not ready in the same <code>SELECT</code>. Build <code>next_activity_date</code> in the first step, and work out the gap in the second.' },
          { re: /^(?![\s\S]*julianday)/i, msg: 'Dates are text, so subtracting them directly does not give days. Wrap each one in <code>julianday()</code> first.' },
          { re: /^(?![\s\S]*PARTITION\s+BY)/i, msg: 'Without <code>PARTITION BY</code>, the next row can belong to a different loan. Restart the window for each loan.' },
          { re: />=\s*30\b/, msg: 'The request says more than 30 days, so use <code>&gt; 30</code>. A gap of exactly 30 days stays out.' },
          { re: /julianday\(\s*(a\.)?activity_date\s*\)\s*-\s*julianday\(\s*(a\.)?next_activity_date/i, msg: 'Put the later date first, so the gap comes out as a positive number of days.' },
          { re: /^(?![\s\S]*Written Off)/i, msg: 'The request leaves out written-off loans, so filter on <code>status</code> as well as Kol.' }
        ],
        requires: [
          { re: /^(?![\s\S]*\bactivity_date\s+AS\s+next_activity_date\b)/i, msg: 'The dates are there, and the names look swapped. <code>activity_date</code> should be the earlier date, and <code>next_activity_date</code> should be the date from <code>LEAD</code>.' }
        ],
        hints: [
          `The first comment needs <code>LEAD</code> restarted for each loan. The second needs the same subtraction as the last mission.`,
          `The first step adds <code>LEAD(a.activity_date) OVER (PARTITION BY a.loan_id ORDER BY a.activity_date) AS next_activity_date</code>.`,
          `In the second step, the gap is <code>julianday(next_activity_date) - julianday(activity_date) AS gap_days</code>. A name made in <code>SELECT</code> is not reliable in <code>WHERE</code>, so repeat the formula there: <code>WHERE julianday(next_activity_date) - julianday(activity_date) &gt; 30</code>.`
        ],
        win: `A long gap on a hard case is worth a question, though some have good reasons, such as a promise still running. Use a list like this to start a conversation with the team, and check the facts before calling anything a failure.`,
        pattern: { sql: `WITH timeline AS (\n  SELECT id, event_date,\n    LEAD(event_date) OVER (\n      PARTITION BY id\n      ORDER BY event_date\n    ) AS next_date\n  FROM table_name\n)\nSELECT id, event_date, next_date,\n  julianday(next_date) - julianday(event_date) AS gap_days\nFROM timeline\nWHERE julianday(next_date) - julianday(event_date) > 30;`, note: 'Find long gaps between events, per group' },
        atWork: `SQLite lets you write <code>WHERE gap_days &gt; 30</code>. Other databases do not, so repeat the formula or add a CTE step, as the solution does.`
      },
      {
        id: '5.15',
        title: 'Equal-sized groups: NTILE',
        newIdea: 'NTILE(n) sorts the rows and splits them into n groups of nearly equal size.',
        from: 'Dimas, Portfolio Analyst',
        teach: `<p><code>NTILE(4)</code> sorts the rows, then cuts them into 4 blocks of nearly equal size, numbered 1 to 4. Each group is a [[quartile]]. If the rows do not divide evenly, the first groups get one extra.</p><p>The groups are equal in count, and their money can be very different. That difference is usually the point of the analysis.</p>`,
        ex: [
          [`SELECT payment_id, amount,`, `Show each payment's ID and amount,`],
          [`  NTILE(3) OVER (ORDER BY amount DESC) AS size_group`, `and cut them into 3 groups, largest payments in group 1,`],
          [`FROM payments`, `from the payments table,`],
          [`WHERE channel = 'Collector'`, `for the Collector channel only,`],
          [`  AND payment_date BETWEEN '2026-10-01' AND '2026-10-31'`, `in October,`],
          [`ORDER BY amount DESC;`, `with the largest payment first.`]
        ],
        exNote: 'There are 29 payments, so the groups hold 10, 10 and 9.',
        bridge: 'Like sorting a list and cutting it into four equal blocks of rows.',
        task: `How much of our overdue balance sits in the biggest loans? Take loans with <code>dpd</code> above 0, not written off, and split them into 4 groups by outstanding, biggest in group 1. Per group show <code>size_group</code>, <code>loan_count</code>, <code>smallest</code>, <code>largest</code>, <code>total_outstanding</code>. Add the missing column.`,
        starter: `WITH sized AS (
  SELECT outstanding,
    -- add size_group here
  FROM loans
  WHERE dpd > 0
    AND status <> 'Written Off'
)
SELECT size_group,
  COUNT(*) AS loan_count,
  MIN(outstanding) AS smallest,
  MAX(outstanding) AS largest,
  SUM(outstanding) AS total_outstanding
FROM sized
GROUP BY size_group
ORDER BY size_group;`,
        solution: `WITH sized AS (
  SELECT outstanding,
    NTILE(4) OVER (ORDER BY outstanding DESC) AS size_group
  FROM loans
  WHERE dpd > 0
    AND status <> 'Written Off'
)
SELECT size_group,
  COUNT(*) AS loan_count,
  MIN(outstanding) AS smallest,
  MAX(outstanding) AS largest,
  SUM(outstanding) AS total_outstanding
FROM sized
GROUP BY size_group
ORDER BY size_group;`,
        ordered: 'size_group',
        wrong: [
          `WITH sized AS (SELECT outstanding, NTILE(4) OVER (ORDER BY outstanding) AS size_group FROM loans WHERE dpd > 0 AND status <> 'Written Off') SELECT size_group, COUNT(*) AS loan_count, MIN(outstanding) AS smallest, MAX(outstanding) AS largest, SUM(outstanding) AS total_outstanding FROM sized GROUP BY size_group ORDER BY size_group;`,
          `WITH sized AS (SELECT outstanding, NTILE(4) OVER (ORDER BY outstanding DESC) AS size_group FROM loans WHERE dpd > 0) SELECT size_group, COUNT(*) AS loan_count, MIN(outstanding) AS smallest, MAX(outstanding) AS largest, SUM(outstanding) AS total_outstanding FROM sized GROUP BY size_group ORDER BY size_group;`,
          `WITH sized AS (SELECT outstanding, NTILE(5) OVER (ORDER BY outstanding DESC) AS size_group FROM loans WHERE dpd > 0 AND status <> 'Written Off') SELECT size_group, COUNT(*) AS loan_count, MIN(outstanding) AS smallest, MAX(outstanding) AS largest, SUM(outstanding) AS total_outstanding FROM sized GROUP BY size_group ORDER BY size_group;`,
          `WITH sized AS (SELECT outstanding, NTILE(4) OVER (ORDER BY dpd DESC) AS size_group FROM loans WHERE dpd > 0 AND status <> 'Written Off') SELECT size_group, COUNT(*) AS loan_count, MIN(outstanding) AS smallest, MAX(outstanding) AS largest, SUM(outstanding) AS total_outstanding FROM sized GROUP BY size_group ORDER BY size_group;`,
          `WITH sized AS (SELECT outstanding, NTILE(4) OVER (ORDER BY outstanding DESC) AS size_group FROM loans WHERE dpd > 0 AND status <> 'Written Off') SELECT size_group, COUNT(*) AS loan_count, MAX(outstanding) AS smallest, MIN(outstanding) AS largest, SUM(outstanding) AS total_outstanding FROM sized GROUP BY size_group ORDER BY size_group;`
        ],
        traps: [
          { re: /NTILE\s*\(\s*4\s*\)\s*OVER\s*\(\s*ORDER\s+BY\s+outstanding\s*(ASC\s*)?\)/i, msg: 'This puts the smallest loans in group 1. Add <code>DESC</code> so the biggest come first.' },
          { re: /NTILE\s*\(\s*[^4\s]/i, msg: 'The request is for 4 groups, so write <code>NTILE(4)</code>.' },
          { re: /OVER\s*\(\s*ORDER\s+BY\s+dpd/i, msg: 'The groups are by size of balance, so sort on <code>outstanding</code>.' },
          { re: /^(?![\s\S]*Written Off)/i, msg: 'The request leaves out written-off loans, so keep that filter in the first step.' }
        ],
        requires: [
          { re: /\bMIN\s*\(\s*(\w+\.)?outstanding\s*\)\s*(AS\s+)?smallest\b/i, msg: 'The numbers are right, and the names look swapped. <code>smallest</code> should be <code>MIN(outstanding)</code>.' },
          { re: /\bMAX\s*\(\s*(\w+\.)?outstanding\s*\)\s*(AS\s+)?largest\b/i, msg: 'The numbers are right, and the names look swapped. <code>largest</code> should be <code>MAX(outstanding)</code>.' }
        ],
        hints: [
          `The function that cuts rows into groups is <code>NTILE</code>, and it takes the number of groups.`,
          `Sort by the loan balance, biggest first, so group 1 holds the largest loans.`,
          `The line should read <code>NTILE(4) OVER (ORDER BY outstanding DESC) AS size_group</code>.`
        ],
        win: `Here, the top quarter of overdue loans holds about 70 percent of the overdue balance. That is why many collection teams give the largest balances more senior attention, while automation and desk calls cover the rest.`,
        pattern: { sql: `SELECT col_a, amount,\n  NTILE(4) OVER (ORDER BY amount DESC) AS size_group\nFROM table_name;`, note: 'Split rows into 4 equal-sized groups' }
      },
      {
        id: '5.16',
        title: 'Cut a number out of text',
        newIdea: 'substr cuts text by position, and CAST turns the piece into a number.',
        from: 'Dimas, Portfolio Analyst',
        teach: `<p>A month here is text, such as "2026-10", and sometimes you need its number. <code>substr(snapshot_month, 6, 2)</code> takes 2 characters starting at position 6, so "2026-10" gives "10".</p><p>That piece is still text. <code>CAST(... AS INTEGER)</code> turns it into a number you can do math with.</p>`,
        ex: [
          [`SELECT DISTINCT substr(disbursed_date, 1, 4) AS year_text,`, `Show each disbursement year as text,`],
          [`  CAST(substr(disbursed_date, 1, 4) AS INTEGER) AS year_no`, `and the same year as a number,`],
          [`FROM loans`, `from the loans table,`],
          [`ORDER BY year_no;`, `oldest first.`]
        ],
        bridge: 'Like =VALUE(MID(A2,6,2)) in Excel.',
        task: `I want to do math on our snapshot months. Show each <code>snapshot_month</code> once, with <code>month_no</code>, its last two characters as a whole number. Earliest month first.`,
        solution: `SELECT DISTINCT snapshot_month,
  CAST(substr(snapshot_month, 6, 2) AS INTEGER) AS month_no
FROM loan_snapshots
ORDER BY snapshot_month;`,
        ordered: 'snapshot_month',
        altSolutions: [
          `SELECT snapshot_month, CAST(substr(snapshot_month, 6, 2) AS INTEGER) AS month_no FROM loan_snapshots GROUP BY snapshot_month ORDER BY snapshot_month;`,
          `SELECT DISTINCT snapshot_month, CAST(substr(snapshot_month, -2) AS INTEGER) AS month_no FROM loan_snapshots ORDER BY snapshot_month;`
        ],
        wrong: [
          `SELECT snapshot_month, CAST(substr(snapshot_month, 6, 2) AS INTEGER) AS month_no FROM loan_snapshots ORDER BY snapshot_month;`,
          `SELECT DISTINCT snapshot_month, CAST(substr(snapshot_month, 5, 2) AS INTEGER) AS month_no FROM loan_snapshots ORDER BY snapshot_month;`,
          `SELECT DISTINCT snapshot_month, substr(snapshot_month, 6, 2) AS month_no FROM loan_snapshots ORDER BY snapshot_month;`
        ],
        traps: [
          { re: /substr\s*\(\s*\w*\.?snapshot_month\s*,\s*5\b/i, msg: 'Position 5 is the dash. The month starts at position 6.' },
          { re: /^(?![\s\S]*\b(DISTINCT|GROUP\s+BY)\b)/i, msg: 'Each month has about 500 rows here, so ask for each month once with <code>DISTINCT</code>.' },
          { re: /^(?![\s\S]*\bCAST\b)/i, msg: 'The piece is still text, so "10" would show the same and sort as text. Wrap it in <code>CAST(... AS INTEGER)</code>.' }
        ],
        hints: [
          `Count the characters in 2026-10. The month starts at position 6.`,
          `Use <code>substr(snapshot_month, 6, 2)</code>, then wrap it in <code>CAST(... AS INTEGER)</code>.`,
          `Start with <code>SELECT DISTINCT snapshot_month,</code> and name the second column <code>AS month_no</code>.`
        ],
        win: `Text that holds a number is common in bank files, such as month keys and account codes. Next you use this month number to find runs of overdue months.`,
        pattern: { sql: `SELECT CAST(substr(col_a, 6, 2) AS INTEGER) AS part_no\nFROM table_name;`, note: 'Cut part of a text value and make it a number' }
      },
      {
        id: '5.17',
        type: 'quiz',
        title: 'Spot the run',
        newIdea: 'Month number minus row number stays the same throughout an unbroken run.',
        teach: `<p>Risk wants to know if a loan stayed overdue for months, or was late in two short bursts. A <b>run</b> means months in a row with no break, and finding runs is called the [[gaps and islands]] problem.</p><p>Take overdue months 2, 3, 4, then 7, 8. Number them 1, 2, 3, 4, 5 with <code>ROW_NUMBER</code>. Month minus number gives 1, 1, 1, 3, 3. The same result means the same run.</p>`,
        bridge: 'Like a helper column of month minus row count, then a PivotTable on that column.',
        question: `This is loan 75, overdue months only. Look at <code>run_id</code>. How many unbroken overdue runs does this loan have?`,
        code: `WITH overdue_months AS (
  SELECT snapshot_month, dpd,
    CAST(substr(snapshot_month, 6, 2) AS INTEGER) AS month_no,
    ROW_NUMBER() OVER (ORDER BY snapshot_month) AS rn
  FROM loan_snapshots
  WHERE loan_id = 75
    AND dpd > 0
)
SELECT snapshot_month, dpd, month_no, rn,
  month_no - rn AS run_id
FROM overdue_months
ORDER BY snapshot_month;`,
        showCodeResult: true,
        check: { sql: `WITH overdue_months AS (SELECT CAST(substr(snapshot_month, 6, 2) AS INTEGER) AS month_no, ROW_NUMBER() OVER (ORDER BY snapshot_month) AS rn FROM loan_snapshots WHERE loan_id = 75 AND dpd > 0) SELECT COUNT(DISTINCT month_no - rn) FROM overdue_months;`, equals: 2 },
        choices: [
          { t: 'One run of 8 months', why: 'There are 8 overdue months, and they are not all connected. June is missing from the list, because the loan was current that month.' },
          { t: 'Two runs of 4 months each', correct: true, why: 'Yes. run_id is 1 for February to May and 2 for July to October. June was current, and that gap is what moved the number.' },
          { t: 'Two runs, one of 5 months and one of 3', why: 'Count the rows for each run_id. Four rows have run_id 1, and four have run_id 2.' },
          { t: 'Eight runs, one per month', why: 'Each month has its own rn, and run_id is the difference. It only changes after a gap, so it covers several months at a time.' }
        ],
        win: `The values of run_id mean nothing by themselves. They only work as a label, and once you have a label, plain <code>GROUP BY</code> can measure each run.`
      },
      {
        id: '5.18',
        title: 'Gaps and islands',
        newIdea: 'GROUP BY the month-minus-row-number label to measure each unbroken run.',
        from: 'Dimas, Portfolio Analyst',
        teach: `<p>Now use the trick on every loan, in three steps.</p><ul><li><b>Step 1</b>: keep the overdue months and number them per loan.</li><li><b>Step 2</b>: group by loan and <code>month_no - rn</code>, then count the months in each run.</li><li><b>Step 3</b>: take the longest run per loan.</li></ul>`,
        ex: [
          ['WITH overdue_months AS (', 'First build a step called overdue_months'],
          ['  SELECT snapshot_month,', 'holding each month,'],
          ['    CAST(substr(snapshot_month, 6, 2) AS INTEGER) AS month_no,', 'its month as a number,'],
          ['    ROW_NUMBER() OVER (ORDER BY snapshot_month) AS rn', 'and a number 1, 2, 3 for the overdue months,'],
          ['  FROM loan_snapshots', 'from the snapshots table,'],
          ['  WHERE loan_id = 343', 'for loan 343 only,'],
          ['    AND dpd > 0', 'keeping overdue months.'],
          [')', 'With that ready,'],
          ['SELECT month_no - rn AS run_id,', 'label each run,'],
          ['  COUNT(*) AS run_months,', 'count its months,'],
          ['  MIN(snapshot_month) AS first_month,', 'find where it starts'],
          ['  MAX(snapshot_month) AS last_month', 'and where it ends,'],
          ['FROM overdue_months', 'read from that step,'],
          ['GROUP BY month_no - rn;', 'with one row per run.']
        ],
        bridge: 'Like using a helper column as the row field of a PivotTable, with a count of months as the value.',
        task: `Risk wants loans that stayed overdue for a long time. For loans not written off, show each loan's longest run of overdue months (<code>dpd</code> above 0). Keep loans with a run of 6 months or more. Columns: <code>loan_id</code>, <code>longest_run</code>. Longest first. Fill in the blanks.`,
        starter: `-- Step 1: overdue months, numbered per loan\nWITH overdue_months AS (\n  SELECT s.loan_id,\n    CAST(substr(s.snapshot_month, 6, 2) AS INTEGER) AS month_no,\n    ROW_NUMBER() OVER (PARTITION BY s.loan_id ORDER BY s.snapshot_month) AS rn\n  FROM loan_snapshots s\n  JOIN loans l ON l.loan_id = s.loan_id\n  WHERE s.dpd > 0\n    AND l.status <> 'Written Off'\n),\n-- Step 2: one row per unbroken run\nruns AS (\n  SELECT loan_id, COUNT(*) AS run_months\n  FROM overdue_months\n  GROUP BY loan_id, ____\n)\n-- Step 3: the longest run per loan\nSELECT loan_id, ____(run_months) AS longest_run\nFROM runs\nGROUP BY loan_id\nHAVING ____ >= 6\nORDER BY longest_run DESC;`,
        fill: ['month_no - rn', 'MAX', 'MAX(run_months)'],
        solution: `WITH overdue_months AS (
  SELECT s.loan_id,
    CAST(substr(s.snapshot_month, 6, 2) AS INTEGER) AS month_no,
    ROW_NUMBER() OVER (PARTITION BY s.loan_id ORDER BY s.snapshot_month) AS rn
  FROM loan_snapshots s
  JOIN loans l
    ON l.loan_id = s.loan_id
  WHERE s.dpd > 0
    AND l.status <> 'Written Off'
),
runs AS (
  SELECT loan_id, COUNT(*) AS run_months
  FROM overdue_months
  GROUP BY loan_id, month_no - rn
)
SELECT loan_id, MAX(run_months) AS longest_run
FROM runs
GROUP BY loan_id
HAVING MAX(run_months) >= 6
ORDER BY longest_run DESC;`,
        ordered: 'longest_run',
        altSolutions: [
          `WITH numbered AS (
  SELECT s.loan_id, s.dpd,
    ROW_NUMBER() OVER (PARTITION BY s.loan_id ORDER BY s.snapshot_month) AS r1,
    ROW_NUMBER() OVER (PARTITION BY s.loan_id, s.dpd > 0 ORDER BY s.snapshot_month) AS r2
  FROM loan_snapshots s
  JOIN loans l ON l.loan_id = s.loan_id
  WHERE l.status <> 'Written Off'
),
runs AS (
  SELECT loan_id, COUNT(*) AS run_months
  FROM numbered
  WHERE dpd > 0
  GROUP BY loan_id, r1 - r2
)
SELECT loan_id, MAX(run_months) AS longest_run
FROM runs
GROUP BY loan_id
HAVING MAX(run_months) >= 6
ORDER BY longest_run DESC;`
        ],
        wrong: [
          `SELECT s.loan_id, COUNT(*) AS longest_run FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.dpd > 0 AND l.status <> 'Written Off' GROUP BY s.loan_id HAVING COUNT(*) >= 6 ORDER BY longest_run DESC;`,
          `WITH overdue_months AS (SELECT s.loan_id, CAST(substr(s.snapshot_month, 6, 2) AS INTEGER) AS month_no, ROW_NUMBER() OVER (ORDER BY s.snapshot_month) AS rn FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.dpd > 0 AND l.status <> 'Written Off'), runs AS (SELECT loan_id, COUNT(*) AS run_months FROM overdue_months GROUP BY loan_id, month_no - rn) SELECT loan_id, MAX(run_months) AS longest_run FROM runs GROUP BY loan_id HAVING MAX(run_months) >= 6 ORDER BY longest_run DESC;`,
          `WITH overdue_months AS (SELECT s.loan_id, CAST(substr(s.snapshot_month, 6, 2) AS INTEGER) AS month_no, ROW_NUMBER() OVER (PARTITION BY s.loan_id ORDER BY s.snapshot_month) AS rn FROM loan_snapshots s WHERE s.dpd > 0), runs AS (SELECT loan_id, COUNT(*) AS run_months FROM overdue_months GROUP BY loan_id, month_no - rn) SELECT loan_id, MAX(run_months) AS longest_run FROM runs GROUP BY loan_id HAVING MAX(run_months) >= 6 ORDER BY longest_run DESC;`,
          `WITH overdue_months AS (SELECT s.loan_id, CAST(substr(s.snapshot_month, 6, 2) AS INTEGER) AS month_no, ROW_NUMBER() OVER (PARTITION BY s.loan_id ORDER BY s.snapshot_month) AS rn FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.dpd > 0 AND l.status <> 'Written Off'), runs AS (SELECT loan_id, COUNT(*) AS run_months FROM overdue_months GROUP BY loan_id) SELECT loan_id, MAX(run_months) AS longest_run FROM runs GROUP BY loan_id HAVING MAX(run_months) >= 6 ORDER BY longest_run DESC;`,
          `WITH overdue_months AS (SELECT s.loan_id, CAST(substr(s.snapshot_month, 6, 2) AS INTEGER) AS month_no, ROW_NUMBER() OVER (PARTITION BY s.loan_id ORDER BY s.snapshot_month) AS rn FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.dpd > 0 AND l.status <> 'Written Off'), runs AS (SELECT loan_id, COUNT(*) AS run_months FROM overdue_months GROUP BY loan_id, month_no - rn) SELECT loan_id, SUM(run_months) AS longest_run FROM runs GROUP BY loan_id HAVING SUM(run_months) >= 6 ORDER BY longest_run DESC;`
        ],
        traps: [
          { re: /GROUP\s+BY\s+loan_id\s*,\s*run_id/i, msg: 'Write <code>month_no - rn</code> here. There is no <code>run_id</code> column in this query.' },
          { re: /^(?![\s\S]*(month_no\s*-\s*rn|r1\s*-\s*r2))/i, msg: 'Counting every overdue month adds separate runs together. Group by <code>month_no - rn</code> as well, so each unbroken run stays apart.' },
          { re: /SUM\s*\(\s*run_months\s*\)/i, msg: '<code>SUM</code> adds a loan\'s runs together. You want the longest single run, which is <code>MAX</code>.' },
          { re: /ROW_NUMBER\s*\(\s*\)\s*OVER\s*\(\s*ORDER/i, msg: 'The numbering has to restart for each loan, so add <code>PARTITION BY s.loan_id</code> inside <code>OVER</code>.' },
          { re: /^(?![\s\S]*Written Off)/i, msg: 'The request leaves out written-off loans, so keep the join to <code>loans</code> and its filter.' }
        ],
        hints: [
          `The first blank is the subtraction from the last mission, month number minus row number. Step 1 has no <code>run_id</code> column, so write the subtraction itself.`,
          `Step 3 needs the longest run, so the function is <code>MAX</code>. The <code>HAVING</code> tests that same value.`,
          `The blanks are <code>month_no - rn</code>, <code>MAX</code> and <code>MAX(run_months)</code>.`
        ],
        win: `Gaps and islands is a true senior skill. It separates a loan that was late in two short runs from one that stayed overdue for months, and those two borrowers often need different handling.`,
        pattern: { sql: `WITH numbered AS (\n  SELECT id, period_no,\n    ROW_NUMBER() OVER (PARTITION BY id ORDER BY period_no) AS rn\n  FROM table_name\n  WHERE flag = 1\n)\nSELECT id, period_no - rn AS run_id, COUNT(*) AS run_length\nFROM numbered\nGROUP BY id, period_no - rn;`, note: 'Gaps and islands: measure unbroken runs' },
        atWork: `This data covers one year, so the month number is enough. Across several years, use year times 12 plus month, or December to January looks like a gap. A missing snapshot also looks like a gap, so check for missing months first.`
      },
      {
        id: '5.19',
        title: 'Checkpoint: monthly NPL trend',
        newIdea: 'Combine several window functions into one management report.',
        from: 'Citra, Head of Collection',
        checkpoint: true,
        teach: `<p>This one is yours from a blank editor. It uses a first step, then three window ideas from this level on the same rows.</p><p>Build it one column at a time, and run it after each column. That is how pros write long queries too.</p>`,
        bridge: 'Like a monthly trend sheet: value, variance, rolling average and a rank column.',
        task: `Show me how the [[NPL]] balance of loans on the book today got here. Count a loan in a month if its snapshot shows Kol 3 or worse and its <code>status</code> in <code>loans</code> is not Written Off. Earliest month first:<ul><li><code>snapshot_month</code></li><li><code>npl_balance</code></li><li><code>change_from_prior</code> (January stays NULL)</li><li><code>moving_avg_3m</code> (this month and two before, whole rupiah)</li><li><code>balance_rank</code> (RANK, highest balance is 1)</li></ul>`,
        solution: `WITH monthly AS (
  SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance
  FROM loan_snapshots s
  JOIN loans l
    ON l.loan_id = s.loan_id
  WHERE s.collectibility >= 3
    AND l.status <> 'Written Off'
  GROUP BY s.snapshot_month
)
SELECT snapshot_month, npl_balance,
  npl_balance - LAG(npl_balance) OVER (ORDER BY snapshot_month) AS change_from_prior,
  ROUND(AVG(npl_balance) OVER (
    ORDER BY snapshot_month
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  ), 0) AS moving_avg_3m,
  RANK() OVER (ORDER BY npl_balance DESC) AS balance_rank
FROM monthly
ORDER BY snapshot_month;`,
        ordered: 'snapshot_month',
        altSolutions: [
          `SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance,
  SUM(s.outstanding) - LAG(SUM(s.outstanding)) OVER (ORDER BY s.snapshot_month) AS change_from_prior,
  ROUND(AVG(SUM(s.outstanding)) OVER (ORDER BY s.snapshot_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 0) AS moving_avg_3m,
  RANK() OVER (ORDER BY SUM(s.outstanding) DESC) AS balance_rank
FROM loan_snapshots s
JOIN loans l ON l.loan_id = s.loan_id
WHERE s.collectibility >= 3 AND l.status <> 'Written Off'
GROUP BY s.snapshot_month
ORDER BY s.snapshot_month;`,
          `WITH monthly AS (
  SELECT snapshot_month, SUM(outstanding) AS npl_balance
  FROM loan_snapshots
  WHERE collectibility IN (3, 4, 5)
    AND loan_id NOT IN (SELECT loan_id FROM loans WHERE status = 'Written Off')
  GROUP BY snapshot_month
),
with_prior AS (
  SELECT snapshot_month, npl_balance,
    LAG(npl_balance) OVER (ORDER BY snapshot_month) AS prior_balance
  FROM monthly
)
SELECT snapshot_month, npl_balance,
  npl_balance - prior_balance AS change_from_prior,
  ROUND(AVG(npl_balance) OVER (ORDER BY snapshot_month ROWS 2 PRECEDING)) AS moving_avg_3m,
  RANK() OVER (ORDER BY npl_balance DESC) AS balance_rank
FROM with_prior
ORDER BY snapshot_month;`
        ],
        wrong: [
          `WITH monthly AS (SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance FROM loan_snapshots s WHERE s.collectibility >= 3 GROUP BY s.snapshot_month) SELECT snapshot_month, npl_balance, npl_balance - LAG(npl_balance) OVER (ORDER BY snapshot_month) AS change_from_prior, ROUND(AVG(npl_balance) OVER (ORDER BY snapshot_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)) AS moving_avg_3m, RANK() OVER (ORDER BY npl_balance DESC) AS balance_rank FROM monthly ORDER BY snapshot_month;`,
          `WITH monthly AS (SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.collectibility >= 3 AND l.status <> 'Written Off' GROUP BY s.snapshot_month) SELECT snapshot_month, npl_balance, npl_balance - LAG(npl_balance) OVER (ORDER BY snapshot_month) AS change_from_prior, ROUND(AVG(npl_balance) OVER (ORDER BY snapshot_month)) AS moving_avg_3m, RANK() OVER (ORDER BY npl_balance DESC) AS balance_rank FROM monthly ORDER BY snapshot_month;`,
          `WITH monthly AS (SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.collectibility >= 3 AND l.status <> 'Written Off' GROUP BY s.snapshot_month) SELECT snapshot_month, npl_balance, COALESCE(npl_balance - LAG(npl_balance) OVER (ORDER BY snapshot_month), 0) AS change_from_prior, ROUND(AVG(npl_balance) OVER (ORDER BY snapshot_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)) AS moving_avg_3m, RANK() OVER (ORDER BY npl_balance DESC) AS balance_rank FROM monthly ORDER BY snapshot_month;`,
          `WITH monthly AS (SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.collectibility >= 3 AND l.status <> 'Written Off' GROUP BY s.snapshot_month) SELECT snapshot_month, npl_balance, npl_balance - LAG(npl_balance) OVER (ORDER BY snapshot_month) AS change_from_prior, ROUND(AVG(npl_balance) OVER (ORDER BY snapshot_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)) AS moving_avg_3m, RANK() OVER (ORDER BY npl_balance) AS balance_rank FROM monthly ORDER BY snapshot_month;`,
          `WITH monthly AS (SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.collectibility >= 3 AND l.status <> 'Written Off' GROUP BY s.snapshot_month) SELECT snapshot_month, npl_balance, npl_balance - LAG(npl_balance) OVER (ORDER BY snapshot_month) AS change_from_prior, ROUND(AVG(npl_balance) OVER (ORDER BY snapshot_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)) AS moving_avg_3m, RANK() OVER (ORDER BY npl_balance DESC) AS balance_rank FROM monthly ORDER BY balance_rank;`,
          `WITH monthly AS (SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.collectibility >= 3 AND l.status <> 'Written Off' GROUP BY s.snapshot_month) SELECT snapshot_month, npl_balance, npl_balance - LAG(npl_balance) OVER (ORDER BY snapshot_month) AS change_from_prior, ROUND(AVG(npl_balance) OVER (ORDER BY snapshot_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 0) AS moving_avg_3m, ROW_NUMBER() OVER (ORDER BY npl_balance DESC) AS balance_rank FROM monthly ORDER BY snapshot_month;`,
          `WITH monthly AS (SELECT s.snapshot_month, SUM(s.outstanding) AS npl_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.collectibility >= 3 AND l.status <> 'Written Off' GROUP BY s.snapshot_month) SELECT m.snapshot_month, m.npl_balance, m.npl_balance - (SELECT x.npl_balance FROM monthly x WHERE x.snapshot_month < m.snapshot_month ORDER BY x.snapshot_month DESC LIMIT 1) AS change_from_prior, (SELECT ROUND(AVG(y.npl_balance), 0) FROM (SELECT x.npl_balance FROM monthly x WHERE x.snapshot_month <= m.snapshot_month ORDER BY x.snapshot_month DESC LIMIT 3) y) AS moving_avg_3m, (SELECT COUNT(*) + 1 FROM monthly x WHERE x.npl_balance > m.npl_balance) AS balance_rank FROM monthly m ORDER BY m.snapshot_month;`
        ],
        traps: [
          { re: /ROUND\s*\(\s*AVG\s*\(\s*\w+\s*\)\s*(,\s*\d+\s*)?\)\s*OVER/i, msg: '<code>OVER</code> belongs to <code>AVG</code>, so keep it inside <code>ROUND</code>: <code>ROUND(AVG(npl_balance) OVER (...), 0)</code>.' },
          { re: /^(?![\s\S]*Written Off)/i, msg: 'Snapshots keep written-off loans at Kol 5, and this request is about loans on the book today. Join to <code>loans</code> and leave them out.' },
          { re: /^(?![\s\S]*(PRECEDING))/i, msg: 'A 3-month average needs a frame: <code>ROWS BETWEEN 2 PRECEDING AND CURRENT ROW</code>.' },
          { re: /COALESCE/i, msg: 'January has no prior month, so its change stays NULL. A 0 would claim the balance did not move.' },
          { re: /RANK\s*\(\s*\)\s*OVER\s*\(\s*ORDER\s+BY\s+\w*npl_balance\s*(ASC\s*)?\)/i, msg: 'The highest balance should rank 1, so add <code>DESC</code> inside the rank\'s <code>OVER</code>.' }
        ],
        requires: [
          { re: /\bLAG\s*\(/i, msg: 'Your numbers are right. This checkpoint reviews window functions, so use <code>LAG</code> for <code>change_from_prior</code>.' },
          { re: /\bPRECEDING\b/i, msg: 'Your numbers are right. This checkpoint reviews window functions, so build <code>moving_avg_3m</code> with <code>ROWS BETWEEN 2 PRECEDING AND CURRENT ROW</code>.' },
          { re: /\bRANK\s*\(\s*\)\s*OVER/i, msg: 'Your numbers match today, because no two months tie. The request asks for <code>RANK</code>, so tied months would share a position. Use it for <code>balance_rank</code>.' }
        ],
        hints: [
          `Start with a CTE giving one row per month and its NPL balance. Run it and check that you get 10 rows.`,
          `Then add one column at a time: <code>LAG</code> for the change, <code>AVG</code> with a frame for the average, and <code>RANK</code> for the rank.`,
          `The frame is <code>ROWS BETWEEN 2 PRECEDING AND CURRENT ROW</code>, and <code>OVER</code> stays inside <code>ROUND</code>: <code>ROUND(AVG(npl_balance) OVER (...), 0)</code>. The rank orders by <code>npl_balance DESC</code>, and the final query sorts by <code>snapshot_month</code>.`
        ],
        win: `Level 5 done: one query now shows the balance, how it moved, the smoother trend and its highest month. October falls by about Rp 612 million here because five [[restructured|restructuring]] loans moved back to [[Kol 1]], so always ask which loans drove a change, since this fall may not be cash collected.`,
        atWork: `This is the history of loans on the book today. The NPL reported at the time would also include loans written off later, and Level 9 shows you that version.`,
        pattern: { sql: `SELECT period, amount,\n  amount - LAG(amount) OVER (ORDER BY period) AS change,\n  AVG(amount) OVER (\n    ORDER BY period\n    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW\n  ) AS moving_avg\nFROM monthly\nORDER BY period;`, note: 'A monthly trend report' }
      }
    ]
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
