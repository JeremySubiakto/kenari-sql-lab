/* Level 3: pull one answer out of several tables. The hardest step for most beginners, so it goes slowly. */
(function (root) {
  (root.KENARI_LEVELS = root.KENARI_LEVELS || []).push({
    n: 3,
    title: 'Combine Tables',
    rank: 'Table Connector',
    tagline: 'One answer, pulled from several tables.',
    goal: 'Join tables on their keys, keep or find the rows with no match, and stack lists into one.',
    terms: {
      'JOIN': 'Puts two tables side by side, pairing the rows that ON says belong together. Rows with no match are dropped.',
      'LEFT JOIN': 'A JOIN that keeps every row of the left-side table, showing NULL where the right-side table has no match.',
      'alias': 'A temporary short name for a column or a table. Columns use AS. For tables, AS is optional.',
      'UNION ALL': 'Stacks the rows of one query under the rows of another, keeping every row.',
      'cross join': 'Pairing every row of one table with every row of another. It is what a JOIN does when it has no ON.',
      'snapshot': 'A saved copy of how a record looked at one point in time, such as each loan at month end.'
    },
    lessons: [
      {
        id: '3.1',
        type: 'quiz',
        title: 'Why the bank splits its data',
        newIdea: 'Tables are linked by a key, a column that points to a row in another table.',
        teach: `<p>One customer can hold several loans. In the rows below, loans 1 and 2 belong to the same customer. Imagine the name and phone on every loan row. A customer changes phone, and you must edit many rows. You may miss some.</p><p>So the bank stores each customer once, in <code>customers</code>, and each loan points to its customer. That pointer is a [[key]]. A [[primary key]] identifies each row of its own table, like <code>branch_id</code> in <code>branches</code>. A [[foreign key]] points to that row from another table, like <code>branch_id</code> in <code>loans</code>.</p>`,
        bridge: 'Like a loan sheet holding a customer ID that you look up on a customer master sheet.',
        question: `Here are three rows of <code>loans</code>. Which column links a loan to its row in <code>customers</code>?`,
        code: `SELECT loan_id, customer_id, branch_id, product, outstanding\nFROM loans\nLIMIT 3;`,
        showCodeResult: true,
        check: { sql: `SELECT COUNT(*) FROM loans WHERE customer_id IN (SELECT customer_id FROM customers)`, equals: 502 },
        choices: [
          { t: '<code>customer_id</code>', correct: true, why: 'Yes. The same ID sits in both tables, so each loan points to exactly one customer. In <code>loans</code> it is a foreign key, and in <code>customers</code> it is the primary key.' },
          { t: '<code>loan_id</code>', why: '<code>loan_id</code> identifies the loan itself. It is the primary key of <code>loans</code>, and <code>customers</code> has no such column.' },
          { t: '<code>branch_id</code>', why: 'This one is a foreign key too, and it points to <code>branches</code>. It tells you which branch the loan belongs to, and nothing about who holds it.' },
          { t: '<code>full_name</code>', why: 'That column lives in <code>customers</code>, and <code>loans</code> does not have it. Names also make poor links, because two people can share a name and spellings change.' }
        ],
        win: `On any new system, finding the keys is your first job. Once you know them, you can reach almost any fact from any table.`
      },
      {
        id: '3.2',
        title: 'Your first JOIN',
        newIdea: 'JOIN brings in a second table, and ON says which rows belong together.',
        from: 'Citra, Head of Collection',
        teach: `<p>[[JOIN]] brings a second table in. <code>ON</code> says which rows belong together, usually the ones where two [[key]] columns hold the same value. Each loan finds its customer, and columns from both tables sit on one row.</p><p>In <code>ON</code>, write the table name, a dot, then the column, like <code>loans.customer_id</code>, because both tables have that column.</p><p>A row that finds no match drops out of the result. Mission 3.7 shows how to keep it.</p>[[demo:join]]`,
        bridge: 'Like XLOOKUP pulling a customer\'s name and phone onto every loan row.',
        ex: [
          ['SELECT collector_name, city', 'Show each collector\'s name and their branch\'s city,'],
          ['FROM collectors', 'starting from the collectors table,'],
          ['JOIN branches', 'bringing in the branches table,'],
          ['  ON collectors.branch_id = branches.branch_id', 'pairing rows where the two branch IDs are equal,'],
          [`WHERE team = 'Agency';`, 'and keeping only the Agency team.']
        ],
        task: `I need the Kol 5 list with names on it. Fill in the blanks so each loan finds its customer. Show <code>loan_id</code>, <code>full_name</code>, <code>phone</code> and <code>outstanding</code> for every loan with <code>collectibility = 5</code>.`,
        starter: `SELECT loan_id, full_name, phone, outstanding\nFROM loans\nJOIN customers\n  ON ____ = ____\nWHERE collectibility = 5;`,
        fill: [`loans.customer_id`, `customers.customer_id`],
        solution: `SELECT loan_id, full_name, phone, outstanding\nFROM loans\nJOIN customers\n  ON loans.customer_id = customers.customer_id\nWHERE collectibility = 5;`,
        altSolutions: [
          `SELECT loan_id, full_name, phone, outstanding\nFROM customers\nJOIN loans\n  ON customers.customer_id = loans.customer_id\nWHERE collectibility = 5;`,
          `SELECT loan_id, full_name, phone, outstanding\nFROM loans\nINNER JOIN customers\n  ON customers.customer_id = loans.customer_id\nWHERE collectibility = 5;`
        ],
        wrong: [
          `SELECT loan_id, full_name, phone, outstanding\nFROM loans\nJOIN customers\n  ON loans.loan_id = customers.customer_id\nWHERE collectibility = 5;`,
          `SELECT loan_id, full_name, phone, outstanding\nFROM loans\nJOIN customers\nWHERE collectibility = 5;`,
          `SELECT loan_id, full_name, phone, outstanding\nFROM loans\nJOIN customers\n  ON loans.customer_id = customers.customer_id;`
        ],
        traps: [
          { re: /loans\.loan_id\s*=\s*customers\.customer_id|customers\.customer_id\s*=\s*loans\.loan_id/i, msg: 'Loan 5 and customer 5 share a number by chance, and they have nothing to do with each other. Match <code>customer_id</code> to <code>customer_id</code>.' }
        ],
        hints: [
          `Ask which column appears in both tables and means the same thing. You found it in the last mission.`,
          `Both blanks hold the same column name, <code>customer_id</code>, each with a different table in front.`,
          `The line should read <code>ON loans.customer_id = customers.customer_id</code>`
        ],
        atWork: `<code>JOIN</code> on its own means <code>INNER JOIN</code> on every major database. Many companies write <code>INNER JOIN</code> in full. They do the same thing.`,
        win: `Six of these borrowers have no phone on file, so a list like this also tells you who needs [[skip tracing]]. Most real requests need a JOIN, because the money and the names live in different tables.`,
        pattern: { sql: `SELECT col_a, col_b\nFROM table_a\nJOIN table_b\n  ON table_a.key = table_b.key;`, note: 'Join two tables on a shared key' }
      },
      {
        id: '3.3',
        type: 'fix',
        title: 'Short names for tables',
        newIdea: 'A table can have a short name, and you put that name in front of each column.',
        from: 'Yusuf, Field team lead',
        teach: `<p>If a column exists in both tables, the database reports an <b>ambiguous column</b>. Ambiguous means it could be either one, and the database will not guess.</p><p>The fix is an [[alias]], a short name for each table, written after it in <code>FROM</code> and <code>JOIN</code>. Then put it in front of each column, like <code>l.branch_id</code>. <code>AS</code> is optional here. Any short name works, and this course uses the first letter when it can.</p><p>Once a table has a short name, the long name stops working in that query. The error then says <code>no such column: loans.branch_id</code>, even though the column is still there. Use <code>l.branch_id</code>.</p>`,
        bridge: 'Like Sheet1!B2 and Sheet2!B2 in Excel, where the prefix says which sheet you mean.',
        ex: [
          ['SELECT l.loan_id, l.customer_id, c.full_name', 'Show the loan ID and customer ID from loans, and the name from customers,'],
          ['FROM loans l', 'starting from loans, which we call l,'],
          ['JOIN customers c', 'bringing in customers, which we call c,'],
          ['  ON l.customer_id = c.customer_id', 'pairing rows where the customer IDs are equal,'],
          ['WHERE l.collectibility = 3;', 'and keeping only Kol 3 loans.']
        ],
        task: `My list of [[Kol 4]] loans fails. Run it and read the error. Give <code>loans</code> the short name <code>l</code> and <code>branches</code> the short name <code>b</code>, then put the matching one in front of every column. Keep the same four columns. For <code>branch_id</code>, either <code>l</code> or <code>b</code> works, because the two values are equal after this JOIN.`,
        starter: `SELECT loan_id, branch_id, branch_name, outstanding\nFROM loans\nJOIN branches\n  ON loans.branch_id = branches.branch_id\nWHERE collectibility = 4;`,
        starterErrors: true,
        solution: `SELECT l.loan_id, l.branch_id, b.branch_name, l.outstanding\nFROM loans l\nJOIN branches b\n  ON l.branch_id = b.branch_id\nWHERE l.collectibility = 4;`,
        altSolutions: [
          `SELECT l.loan_id, b.branch_id, b.branch_name, l.outstanding\nFROM loans AS l\nJOIN branches AS b\n  ON b.branch_id = l.branch_id\nWHERE l.collectibility = 4;`
        ],
        wrong: [
          `SELECT l.loan_id, b.branch_name, l.outstanding\nFROM loans l\nJOIN branches b\n  ON l.branch_id = b.branch_id\nWHERE l.collectibility = 4;`,
          `SELECT l.loan_id, l.branch_id, b.branch_name, l.outstanding\nFROM loans l\nJOIN branches b\n  ON l.branch_id = b.branch_id;`,
          `SELECT loans.loan_id, loans.branch_id, branches.branch_name, loans.outstanding\nFROM loans\nJOIN branches\n  ON loans.branch_id = branches.branch_id\nWHERE collectibility = 4;`
        ],
        requires: [
          { re: /\bloans\s+(AS\s+)?(?!JOIN\b|LEFT\b|RIGHT\b|INNER\b|CROSS\b|ON\b|USING\b|WHERE\b|GROUP\b|ORDER\b|LIMIT\b)[a-z_]\w*/i, msg: 'That works. Long table names get tiring in bigger queries, though, so now give the tables short names, like <code>FROM loans l</code> and <code>JOIN branches b</code>.' },
          { re: /\bbranches\s+(AS\s+)?(?!JOIN\b|LEFT\b|RIGHT\b|INNER\b|CROSS\b|ON\b|USING\b|WHERE\b|GROUP\b|ORDER\b|LIMIT\b)[a-z_]\w*/i, msg: 'The result is right, and <code>loans</code> has its short name. Now give <code>branches</code> one too, like <code>JOIN branches b</code>.' },
          { re: /\bSELECT\s+(?:\w+\.\w+(?:\s+(?:AS\s+)?\w+)?\s*,\s*){3}\w+\.\w+/i, msg: 'The result is right. Now put a short name in front of all four columns in <code>SELECT</code>, so anyone can see where each one comes from.' },
          { re: /\b\w+\.collectibility\b/i, msg: 'The result is right. One column is left, in <code>WHERE</code>. Write <code>l.collectibility</code> so every column has its short name.' }
        ],
        traps: [
          { re: /(?=[\s\S]*\bloans\s+(AS\s+)?l\b)(?=[\s\S]*\bloans\.)/i, msg: 'Once <code>loans</code> is called <code>l</code>, the long name stops working in this query. Write <code>l.branch_id</code> everywhere.' },
          { re: /(?=[\s\S]*\bbranches\s+(AS\s+)?b\b)(?=[\s\S]*\bbranches\.)/i, msg: 'Once <code>branches</code> is called <code>b</code>, the long name stops working in this query. Write <code>b.branch_name</code> everywhere.' }
        ],
        hints: [
          `The error names the column that lives in both tables. Which one is it?`,
          `Add the short names first: <code>FROM loans l</code> and <code>JOIN branches b</code>. Then fix the <code>ON</code> line to use them.`,
          `If the error now says <code>no such column: loans.branch_id</code>, the column is still there. The long name stopped working, so write <code>l.branch_id</code>.`,
          `The first line becomes <code>SELECT l.loan_id, l.branch_id, b.branch_name, l.outstanding</code>`
        ],
        atWork: `Oracle rejects <code>AS</code> before a table alias, so <code>FROM loans l</code> is the form that works everywhere.`,
        win: `The fix makes the query easier to read too, because anyone can see where each column comes from. Pros put a short name in front of every column once a query has two tables.`,
        pattern: { sql: `SELECT l.col_a, b.col_b\nFROM loans l\nJOIN branches b\n  ON l.branch_id = b.branch_id;`, note: 'Short table names, in front of every column' }
      },
      {
        id: '3.4',
        title: 'Join first, then group',
        newIdea: 'After a JOIN you can group by a column from one table and add up a column from the other.',
        from: 'Bu Ratna, Portfolio Manager',
        teach: `<p>Think of a joined result as one wide table. <code>WHERE</code>, <code>GROUP BY</code>, <code>SUM</code> and <code>ORDER BY</code> all work on it the way you already know.</p><p>The database joins first, then filters, then groups. So you can group by a name from one table and add up money from another.</p>`,
        bridge: 'Like adding a looked-up column to your data, then pivoting on it.',
        ex: [
          ['SELECT b.branch_name, COUNT(*) AS collector_count', 'For each branch name, count the collectors,'],
          ['FROM collectors k', 'starting from collectors, which we call k because c is taken by customers,'],
          ['JOIN branches b', 'bringing in branches, which we call b,'],
          ['  ON k.branch_id = b.branch_id', 'pairing rows on the branch ID,'],
          ['GROUP BY b.branch_name', 'with one row per branch name,'],
          ['ORDER BY collector_count DESC;', 'and the biggest team first.']
        ],
        task: `For the regional review, show <code>branch_name</code> and <code>total_outstanding</code> (the sum of <code>outstanding</code>) for each branch. Leave out loans with status <code>'Written Off'</code>, because they have left the balance sheet. Largest total first.`,
        starter: `-- Add the total, then WHERE, GROUP BY and ORDER BY.\nSELECT b.branch_name\nFROM loans l\nJOIN branches b\n  ON l.branch_id = b.branch_id`,
        solution: `SELECT b.branch_name, SUM(l.outstanding) AS total_outstanding\nFROM loans l\nJOIN branches b\n  ON l.branch_id = b.branch_id\nWHERE l.status <> 'Written Off'\nGROUP BY b.branch_name\nORDER BY total_outstanding DESC;`,
        ordered: 'total_outstanding',
        altSolutions: [
          `SELECT b.branch_name, SUM(l.outstanding) AS total_outstanding\nFROM branches b\nJOIN loans l\n  ON b.branch_id = l.branch_id\nWHERE l.status IN ('Active', 'Restructured')\nGROUP BY b.branch_id, b.branch_name\nORDER BY SUM(l.outstanding) DESC;`
        ],
        wrong: [
          `SELECT b.branch_name, SUM(l.outstanding) AS total_outstanding\nFROM loans l\nJOIN branches b\n  ON l.branch_id = b.branch_id\nGROUP BY b.branch_name\nORDER BY total_outstanding DESC;`,
          `SELECT b.city, SUM(l.outstanding) AS total_outstanding\nFROM loans l\nJOIN branches b\n  ON l.branch_id = b.branch_id\nWHERE l.status <> 'Written Off'\nGROUP BY b.city\nORDER BY total_outstanding DESC;`,
          `SELECT b.branch_name, COUNT(*) AS total_outstanding\nFROM loans l\nJOIN branches b\n  ON l.branch_id = b.branch_id\nWHERE l.status <> 'Written Off'\nGROUP BY b.branch_name\nORDER BY total_outstanding DESC;`,
          `SELECT b.branch_name, SUM(l.outstanding) AS total_outstanding\nFROM loans l\nJOIN branches b\n  ON l.branch_id = b.branch_id\nWHERE l.status <> 'Written Off'\nGROUP BY b.branch_name\nORDER BY total_outstanding;`,
          `SELECT b.branch_name, SUM(l.outstanding) AS total_outstanding\nFROM loans l\nJOIN branches b\n  ON l.branch_id = b.branch_id\nWHERE l.status = 'Active'\nGROUP BY b.branch_name\nORDER BY total_outstanding DESC;`
        ],
        traps: [
          { re: /^(?![\s\S]*\b(status|write_off_date)\b)[\s\S]*$/i, msg: 'Written-off loans are still in your total. Add <code>WHERE l.status &lt;&gt; \'Written Off\'</code>.' },
          { re: /\bstatus\s*(=\s*'Active'|IN\s*\(\s*'Active'\s*\))/i, msg: 'This also removes Restructured loans, and they are still on the book. Leave out only Written Off, with <code>l.status &lt;&gt; \'Written Off\'</code>.' },
          { re: /GROUP\s+BY\s+(b\.)?city/i, msg: 'Jakarta has two branches, so grouping by city merges them. The request is per branch.' }
        ],
        hints: [
          `The clause order stays the same. <code>WHERE</code> and <code>GROUP BY</code> come after the <code>ON</code> line.`,
          `Add <code>SUM(l.outstanding) AS total_outstanding</code> to the <code>SELECT</code>, then <code>WHERE</code>, <code>GROUP BY b.branch_name</code> and <code>ORDER BY</code>.`,
          `The last three lines are <code>WHERE l.status &lt;&gt; 'Written Off'</code>, <code>GROUP BY b.branch_name</code> and <code>ORDER BY total_outstanding DESC;</code>`
        ],
        win: `KCP Bekasi Timur carries the largest balance. Keep the control-total habit here, because every loan has a branch and the 12 totals should add up to Rp 32.3 billion, the on-book total from Level 2.`,
        pattern: { sql: `SELECT b.branch_name, SUM(l.outstanding) AS total\nFROM loans l\nJOIN branches b\n  ON l.branch_id = b.branch_id\nGROUP BY b.branch_name;`, note: 'Join, then group by a name from the other table' }
      },
      {
        id: '3.5',
        title: 'Walk through three tables',
        newIdea: 'Each extra JOIN adds one more table with its own ON, so you can walk from link to link.',
        from: 'Dian, Finance',
        teach: `<p>A payment knows its loan. A loan knows its branch. A branch knows its region. No single table holds both the cash and the region, so you walk the links, one <code>JOIN</code> at a time.</p><p>Each <code>JOIN</code> gets its own <code>ON</code>, and that <code>ON</code> connects the new table to one you already have.</p>`,
        bridge: 'Like two XLOOKUPs in a row, from payment to loan and then from loan to branch.',
        ex: [
          ['SELECT b.region, COUNT(*) AS activity_count', 'For each region, count the activities,'],
          ['FROM collection_activities a', 'starting from activities, which we call a,'],
          ['JOIN collectors k', 'bringing in the collector who did each one,'],
          ['  ON a.collector_id = k.collector_id', 'matched on collector ID,'],
          ['JOIN branches b', 'then bringing in that collector\'s branch,'],
          ['  ON k.branch_id = b.branch_id', 'matched on branch ID,'],
          ['GROUP BY b.region;', 'with one row per region.']
        ],
        exNote: `This counts 2,045 of the 2,166 activities. The other 121 are Auto SMS rows with no collector, so they find no match and drop out. You will learn to keep rows like that in mission 3.7.`,
        task: `I need cash received by region. Payments have no region, so walk from <code>payments</code> to <code>loans</code> to <code>branches</code>. Show <code>region</code> and <code>total_received</code> (the sum of payment <code>amount</code>), largest first. Fill in the blanks.`,
        starter: `SELECT b.region, SUM(p.amount) AS total_received\nFROM payments p\nJOIN loans l\n  ON ____ = ____\nJOIN branches b\n  ON ____ = ____\nGROUP BY b.region\nORDER BY total_received DESC;`,
        fill: [`p.loan_id`, `l.loan_id`, `l.branch_id`, `b.branch_id`],
        solution: `SELECT b.region, SUM(p.amount) AS total_received\nFROM payments p\nJOIN loans l\n  ON p.loan_id = l.loan_id\nJOIN branches b\n  ON l.branch_id = b.branch_id\nGROUP BY b.region\nORDER BY total_received DESC;`,
        ordered: 'total_received',
        altSolutions: [
          `SELECT b.region, SUM(p.amount) AS total_received\nFROM branches b\nJOIN loans l\n  ON l.branch_id = b.branch_id\nJOIN payments p\n  ON p.loan_id = l.loan_id\nGROUP BY b.region\nORDER BY 2 DESC;`
        ],
        wrong: [
          `SELECT b.region, SUM(p.amount) AS total_received\nFROM payments p\nJOIN branches b\n  ON p.loan_id = b.branch_id\nGROUP BY b.region\nORDER BY total_received DESC;`,
          `SELECT b.region, COUNT(p.amount) AS total_received\nFROM payments p\nJOIN loans l\n  ON p.loan_id = l.loan_id\nJOIN branches b\n  ON l.branch_id = b.branch_id\nGROUP BY b.region\nORDER BY total_received DESC;`,
          `SELECT b.branch_name, SUM(p.amount) AS total_received\nFROM payments p\nJOIN loans l\n  ON p.loan_id = l.loan_id\nJOIN branches b\n  ON l.branch_id = b.branch_id\nGROUP BY b.branch_name\nORDER BY total_received DESC;`,
          `SELECT b.region, SUM(p.amount) AS total_received\nFROM payments p\nJOIN loans l\n  ON p.loan_id = l.branch_id\nJOIN branches b\n  ON l.branch_id = b.branch_id\nGROUP BY b.region\nORDER BY total_received DESC;`,
          `SELECT b.region, SUM(p.amount) AS total_received\nFROM payments p\nJOIN loans l\n  ON p.loan_id = l.loan_id\nJOIN branches b\n  ON l.branch_id = b.branch_id\nWHERE p.amount > 0\nGROUP BY b.region\nORDER BY total_received DESC;`
        ],
        traps: [
          { re: /p\.loan_id\s*=\s*(b\.branch_id|l\.branch_id)|(b\.branch_id|l\.branch_id)\s*=\s*p\.loan_id/i, msg: 'A loan ID and a branch ID are different kinds of number, so this pairs rows at random. Payments connect to <code>loans</code> through <code>loan_id</code>, and loans connect to <code>branches</code> through <code>branch_id</code>.' },
          { re: /\bamount\s*(>|>=|<>|!=)|[<>]=?\s*(p\.)?amount\b/i, msg: 'This request adds up every payment row, including the few with an amount of zero or below. Remove the filter on <code>amount</code>.' }
        ],
        hints: [
          `Each <code>ON</code> connects the new table to one you already have, using a column they share.`,
          `The first <code>ON</code> uses <code>loan_id</code>. The second uses <code>branch_id</code>.`,
          `The two lines are <code>ON p.loan_id = l.loan_id</code> and <code>ON l.branch_id = b.branch_id</code>.`
        ],
        win: `Jabodetabek brought in the most cash. Walking links is the core skill of this level, because a large share of real questions need three or four tables.`,
        pattern: { sql: `SELECT b.region, SUM(p.amount) AS total\nFROM payments p\nJOIN loans l\n  ON p.loan_id = l.loan_id\nJOIN branches b\n  ON l.branch_id = b.branch_id\nGROUP BY b.region;`, note: 'Walk through three tables, one JOIN per link' }
      },
      {
        id: '3.6',
        type: 'quiz',
        title: 'How many rows will this return?',
        newIdea: 'A JOIN returns one row per match, so one loan with many activities becomes many rows.',
        teach: `<p>A JOIN returns one row for every match. Below, loan 18 has 4 activities, so it comes back as 4 rows, and its <code>outstanding</code> repeats on each one.</p><p>Adding up that repeated balance would count the same money 4 times. That problem is called [[fan-out]], and Level 6 returns to it. Your payment total in mission 3.5 was safe, because each payment appears once and only the loan details repeat. For now, get used to asking how many rows to expect.</p>`,
        bridge: 'XLOOKUP returns only the first match, and JOIN returns every match, like a ledger that shows every posting.',
        ex: [
          ['SELECT l.loan_id, l.outstanding, a.activity_date', 'Show the loan, its balance and each activity date,'],
          ['FROM loans l', 'starting from loans,'],
          ['JOIN collection_activities a', 'bringing in the activities,'],
          ['  ON a.loan_id = l.loan_id', 'matched on loan ID,'],
          ['WHERE l.loan_id = 18;', 'for loan 18 only.']
        ],
        question: `Loan 2 has 1 row in <code>loans</code> and 24 rows in <code>collection_activities</code>. How many rows does this query return?`,
        code: `SELECT l.loan_id, l.outstanding, a.activity_date\nFROM loans l\nJOIN collection_activities a\n  ON a.loan_id = l.loan_id\nWHERE l.loan_id = 2;`,
        check: { sql: `SELECT COUNT(*) FROM loans l JOIN collection_activities a ON a.loan_id = l.loan_id WHERE l.loan_id = 2`, equals: 24 },
        choices: [
          { t: '1', why: 'A JOIN does not squeeze rows together. Every match gets its own row. You would need <code>GROUP BY</code> to get back to one row.' },
          { t: '24', correct: true, why: 'Yes. Each of the 24 activities finds loan 2, so there are 24 rows, with the loan\'s balance repeated on every one.' },
          { t: '25', why: 'That would be stacking the rows, 1 on top of 24. A JOIN pairs rows side by side. Stacking comes later, in mission 3.12.' },
          { t: '48', why: 'There is only one loan row to pair with, so nothing doubles here. 24 matches give 24 rows.' }
        ],
        win: `Before trusting a joined result, ask what one row now means. Here one row means one activity, so counting rows counts activities.`
      },
      {
        id: '3.7',
        title: 'Keep the rows with no match',
        newIdea: 'LEFT JOIN keeps every row of the left-side table and shows NULL where nothing matches.',
        from: 'Dimas, Portfolio Analyst',
        teach: `<p>A plain JOIN drops rows with no match. That hurts when the rows with no match are the ones you care about.</p><p>[[LEFT JOIN]] keeps every row of the left-side table, the one named in <code>FROM</code>. The table after <code>LEFT JOIN</code> is the right-side table. Where nothing matches, its columns show [[NULL]].</p>[[demo:join-left]]`,
        bridge: 'XLOOKUP keeps the row and shows #N/A. LEFT JOIN also keeps the row, and shows NULL.',
        ex: [
          ['SELECT b.branch_name, k.collector_name', 'Show each branch and its collectors,'],
          ['FROM branches b', 'keeping every row of branches,'],
          ['LEFT JOIN collectors k', 'bringing in collectors where they exist,'],
          ['  ON k.branch_id = b.branch_id', 'matched on branch ID,'],
          [`WHERE b.region = 'Jawa Barat';`, 'for the Jawa Barat region only.']
        ],
        exNote: `KCP Cimahi has no collector based there, so it shows NULL. A plain JOIN would hide that branch completely.`,
        task: `I am spot-checking customer records. To keep the list short, use <code>customer_id</code> 400 or higher. Show <code>customer_id</code>, <code>full_name</code> and <code>loan_id</code>. A customer with two loans gets two rows. A customer with no loan must still appear, with NULL. Fill in the blanks.`,
        starter: `SELECT c.customer_id, c.full_name, l.loan_id\nFROM ____ c\n____ loans l\n  ON l.customer_id = c.customer_id\nWHERE c.customer_id >= 400;`,
        fill: [`customers`, `LEFT JOIN`],
        solution: `SELECT c.customer_id, c.full_name, l.loan_id\nFROM customers c\nLEFT JOIN loans l\n  ON l.customer_id = c.customer_id\nWHERE c.customer_id >= 400;`,
        altSolutions: [
          `SELECT c.customer_id, c.full_name, l.loan_id\nFROM loans l\nRIGHT JOIN customers c\n  ON l.customer_id = c.customer_id\nWHERE c.customer_id >= 400;`,
          `SELECT c.customer_id, c.full_name, l.loan_id\nFROM customers c\nLEFT OUTER JOIN loans l\n  ON c.customer_id = l.customer_id\nWHERE c.customer_id > 399\nORDER BY c.customer_id;`
        ],
        wrong: [
          `SELECT c.customer_id, c.full_name, l.loan_id\nFROM customers c\nJOIN loans l\n  ON l.customer_id = c.customer_id\nWHERE c.customer_id >= 400;`,
          `SELECT c.customer_id, c.full_name, l.loan_id\nFROM loans l\nLEFT JOIN customers c\n  ON l.customer_id = c.customer_id\nWHERE c.customer_id >= 400;`,
          `SELECT c.customer_id, c.full_name, l.loan_id\nFROM customers c\nLEFT JOIN loans l\n  ON l.customer_id = c.customer_id;`
        ],
        traps: [
          { re: /\bFROM\s+loans\b[\s\S]*\bLEFT\s+(OUTER\s+)?JOIN\s+customers\b/i, msg: 'The table in <code>FROM</code> is the one that keeps all its rows. You want to keep every customer, so <code>customers</code> goes in <code>FROM</code>.' },
          { re: /^(?![\s\S]*\b(LEFT|RIGHT)\s+(OUTER\s+)?JOIN\b)[\s\S]*\bJOIN\b/i, msg: 'A plain <code>JOIN</code> drops the customers with no loan. Those are the rows this request wants to see, so use <code>LEFT JOIN</code>.' }
        ],
        hints: [
          `Which table must keep all its rows? That table goes in <code>FROM</code>.`,
          `You want every customer, so <code>customers</code> goes in the first blank. The second blank is the kind of join.`,
          `The two lines are <code>FROM customers c</code> and <code>LEFT JOIN loans l</code>.`
        ],
        atWork: `<code>LEFT OUTER JOIN</code> means the same as <code>LEFT JOIN</code> on every major database.`,
        win: `Fifteen of these customers hold no loan. That can be perfectly normal, for example someone who only holds savings, so check before calling it a data problem.`,
        pattern: { sql: `SELECT a.col_a, b.col_a\nFROM keep_all_of_this a\nLEFT JOIN maybe_match b\n  ON b.key = a.key;`, note: 'Keep every left row, with NULL if no match' }
      },
      {
        id: '3.8',
        title: 'Find what is missing',
        newIdea: 'LEFT JOIN plus IS NULL on the right-side table finds the rows that have no match.',
        from: 'Budi, Field Collection lead',
        teach: `<p>You have seen that a row with no match gets NULL on the right side. Filter on that NULL, and only the unmatched rows remain. This is called an [[anti-join]].</p><p>Test the ID of the right-side table, such as <code>activity_id</code>. Every real row has one, so NULL there means no match. Do not test <code>collector_id</code>. Auto SMS rows are real activities with no collector, so NULL there does not mean no match.</p>`,
        bridge: 'Like filtering a lookup column to #N/A to see what did not reconcile.',
        ex: [
          ['SELECT b.branch_name, b.region', 'Show each branch and its region,'],
          ['FROM branches b', 'starting from every branch,'],
          ['LEFT JOIN collectors k', 'bringing in any collectors,'],
          ['  ON k.branch_id = b.branch_id', 'matched on branch ID,'],
          ['WHERE k.collector_id IS NULL;', 'and keeping only branches where no collector was found.']
        ],
        task: `Which overdue loans have had no contact at all? Show <code>loan_id</code>, <code>product</code>, <code>dpd</code> and <code>outstanding</code> for loans with <code>dpd &gt; 0</code> that have no row at all in <code>collection_activities</code>. Longest overdue first.`,
        starter: `SELECT l.loan_id, l.product, l.dpd, l.outstanding\nFROM loans l\nLEFT JOIN collection_activities a\n  ON a.loan_id = l.loan_id\n-- Add WHERE and ORDER BY here`,
        solution: `SELECT l.loan_id, l.product, l.dpd, l.outstanding\nFROM loans l\nLEFT JOIN collection_activities a\n  ON a.loan_id = l.loan_id\nWHERE l.dpd > 0\n  AND a.activity_id IS NULL\nORDER BY l.dpd DESC;`,
        ordered: 'dpd',
        altSolutions: [
          `SELECT l.loan_id, l.product, l.dpd, l.outstanding\nFROM loans l\nLEFT JOIN collection_activities a\n  ON a.loan_id = l.loan_id\nWHERE a.loan_id IS NULL\n  AND l.dpd > 0\nORDER BY l.dpd DESC;`,
          `SELECT l.loan_id, l.product, l.dpd, l.outstanding\nFROM loans l\nWHERE l.dpd > 0\n  AND l.loan_id NOT IN (SELECT loan_id FROM collection_activities)\nORDER BY l.dpd DESC;`,
          `SELECT l.loan_id, l.product, l.dpd, l.outstanding\nFROM loans l\nWHERE l.dpd > 0\n  AND NOT EXISTS (SELECT 1 FROM collection_activities a WHERE a.loan_id = l.loan_id)\nORDER BY l.dpd DESC;`
        ],
        wrong: [
          `SELECT l.loan_id, l.product, l.dpd, l.outstanding\nFROM loans l\nLEFT JOIN collection_activities a\n  ON a.loan_id = l.loan_id\nWHERE l.dpd > 0\n  AND a.collector_id IS NULL\nORDER BY l.dpd DESC;`,
          `SELECT l.loan_id, l.product, l.dpd, l.outstanding\nFROM loans l\nLEFT JOIN collection_activities a\n  ON a.loan_id = l.loan_id\nWHERE a.activity_id IS NULL\nORDER BY l.dpd DESC;`,
          `SELECT l.loan_id, l.product, l.dpd, l.outstanding\nFROM loans l\nJOIN collection_activities a\n  ON a.loan_id = l.loan_id\nWHERE l.dpd > 0\n  AND a.activity_id IS NULL\nORDER BY l.dpd DESC;`,
          `SELECT l.loan_id, l.product, l.dpd, l.outstanding\nFROM loans l\nLEFT JOIN collection_activities a\n  ON a.loan_id = l.loan_id\nWHERE l.dpd > 0\n  AND a.activity_id IS NULL\nORDER BY l.dpd;`
        ],
        traps: [
          { re: /^(?![\s\S]*\b(LEFT|RIGHT)\s+(OUTER\s+)?JOIN\b)[\s\S]*\bJOIN\b/i, msg: 'A plain <code>JOIN</code> keeps only loans that found an activity, so no row can show NULL here. Use <code>LEFT JOIN</code>.' },
          { re: /a\.collector_id\s+IS\s+NULL/i, msg: '<code>collector_id</code> is also NULL on real Auto SMS rows, so this catches loans that do have activity. Test <code>a.activity_id</code>, which is never empty on a real row.' },
          { re: /IS\s+NOT\s+NULL/i, msg: '<code>IS NOT NULL</code> keeps the loans that found a match. You want the ones that did not.' },
          { re: /^(?![\s\S]*(dpd\s*(>|>=|<>|!=|BETWEEN)|[<>]=?\s*(l\.)?dpd\b|collectibility))[\s\S]*$/i, msg: 'Healthy loans have no activity either. Add <code>l.dpd &gt; 0</code> so only overdue loans remain.' }
        ],
        hints: [
          `Two tests go in <code>WHERE</code>: the loan is overdue, and no activity was found.`,
          `The second test looks at a column from <code>a</code> that is never empty on a real row, such as <code>activity_id</code>.`,
          `Write <code>WHERE l.dpd &gt; 0 AND a.activity_id IS NULL</code>, then <code>ORDER BY l.dpd DESC;</code>`
        ],
        win: `Two of these 15 loans are more than 300 days overdue with no contact on record. No total on any report would show you this, because the problem is rows that are absent.`,
        pattern: { sql: `SELECT a.col_a, a.col_b\nFROM table_a a
\nLEFT JOIN table_b b\n  ON b.key = a.key\nWHERE b.id IS NULL;`, note: 'Anti-join: rows in A with no match in B' }
      },
      {
        id: '3.9',
        title: 'Counting zeros',
        newIdea: 'After a LEFT JOIN, COUNT of a right-side column gives a true zero for rows with no match.',
        from: 'Fitri, Desk Call lead',
        teach: `<p>You already know <code>COUNT(column)</code> skips NULL, and <code>COUNT(*)</code> counts every row. After a [[LEFT JOIN]], that difference matters.</p><p>Hendra Pangestu, a new collector, has no activities, but his row still exists, with NULL on the right side. <code>COUNT(*)</code> gives him 1. <code>COUNT(a.activity_id)</code> gives him 0, which is true.</p>`,
        bridge: 'Like a COUNTIF beside each name on a staff list, where a person with no activities shows 0 and stays on the list.',
        ex: [
          ['SELECT b.branch_name, COUNT(k.collector_id) AS collector_count', 'For each branch, count the collectors found,'],
          ['FROM branches b', 'keeping every branch,'],
          ['LEFT JOIN collectors k', 'bringing in collectors where they exist,'],
          ['  ON k.branch_id = b.branch_id', 'matched on branch ID,'],
          ['GROUP BY b.branch_name', 'with one row per branch,'],
          ['ORDER BY collector_count;', 'and the fewest first.']
        ],
        exNote: `Here collectors is on the right side, so we count a collector column. In your task, check which table is on the right side.`,
        task: `I want activity counts for all 33 people, zeros included. Show <code>collector_name</code>, <code>team</code> and <code>activity_count</code>, fewest first. Fill in the <code>COUNT</code>, and write the <code>LEFT JOIN</code> and its <code>ON</code> yourself.`,
        starter: `SELECT k.collector_name, k.team, COUNT(____) AS activity_count\nFROM collectors k\n-- Write the LEFT JOIN and its ON in place of the blank below.\n____\nGROUP BY k.collector_name, k.team\nORDER BY activity_count;`,
        fill: [`a.activity_id`, `LEFT JOIN collection_activities a\n  ON a.collector_id = k.collector_id`],
        solution: `SELECT k.collector_name, k.team, COUNT(a.activity_id) AS activity_count\nFROM collectors k\nLEFT JOIN collection_activities a\n  ON a.collector_id = k.collector_id\nGROUP BY k.collector_name, k.team\nORDER BY activity_count;`,
        ordered: 'activity_count',
        altSolutions: [
          `SELECT k.collector_name, k.team, COUNT(a.collector_id) AS activity_count\nFROM collectors k\nLEFT JOIN collection_activities a\n  ON k.collector_id = a.collector_id\nGROUP BY k.collector_id, k.collector_name, k.team\nORDER BY COUNT(a.collector_id);`
        ],
        wrong: [
          `SELECT k.collector_name, k.team, COUNT(*) AS activity_count\nFROM collectors k\nLEFT JOIN collection_activities a\n  ON a.collector_id = k.collector_id\nGROUP BY k.collector_name, k.team\nORDER BY activity_count;`,
          `SELECT k.collector_name, k.team, COUNT(k.collector_id) AS activity_count\nFROM collectors k\nLEFT JOIN collection_activities a\n  ON a.collector_id = k.collector_id\nGROUP BY k.collector_name, k.team\nORDER BY activity_count;`,
          `SELECT k.collector_name, k.team, COUNT(a.activity_id) AS activity_count\nFROM collectors k\nJOIN collection_activities a\n  ON a.collector_id = k.collector_id\nGROUP BY k.collector_name, k.team\nORDER BY activity_count;`,
          `SELECT k.collector_name, k.team, COUNT(a.activity_id) AS activity_count\nFROM collectors k\nLEFT JOIN collection_activities a\n  ON a.collector_id = k.collector_id\nGROUP BY k.collector_name, k.team\nORDER BY activity_count DESC;`
        ],
        traps: [
          { re: /COUNT\s*\(\s*k\./i, msg: '<code>k</code> is the left-side table, so its columns are never NULL here, and an unmatched collector still counts 1. Count a column from <code>a</code>.' },
          { re: /^(?![\s\S]*\b(LEFT|RIGHT)\s+(OUTER\s+)?JOIN\b)[\s\S]*\bJOIN\b/i, msg: 'A plain <code>JOIN</code> drops everyone with no activity, so the zeros vanish. Use <code>LEFT JOIN</code>.' }
        ],
        hints: [
          `One blank needs a column that is NULL when no activity was found. The other needs a join that keeps everyone, with its own <code>ON</code>.`,
          `Count a column from <code>a</code>. Then bring in <code>collection_activities a</code> with <code>LEFT JOIN</code>, matching on <code>collector_id</code>.`,
          `The first blank is <code>a.activity_id</code>. The second takes two lines, <code>LEFT JOIN collection_activities a</code> and <code>ON a.collector_id = k.collector_id</code>.`
        ],
        win: `Eight people show zero. Six are supervisors and two joined in late October, so a zero is a reason to ask a question before anyone calls it poor performance.`,
        pattern: { sql: `SELECT a.name, COUNT(b.id) AS n\nFROM table_a a\nLEFT JOIN table_b b\n  ON b.a_id = a.id\nGROUP BY a.name;`, note: 'Count matches, keeping the zeros' }
      },
      {
        id: '3.10',
        title: 'ON with two conditions',
        newIdea: 'ON can hold more than one condition, joined with AND.',
        from: 'Pak Wayan, Branch Manager Denpasar',
        teach: `<p>A loan has one [[snapshot]] per month, so matching on <code>loan_id</code> alone returns up to ten rows per loan. To get one month, add a second condition to <code>ON</code> with <code>AND</code>.</p><p>With a [[LEFT JOIN]], put the month test in <code>ON</code>. Then a loan with no row for that month stays, with NULL. In <code>WHERE</code>, that loan disappears.</p>`,
        bridge: 'Like SUMIFS with two criteria, loan ID and month, instead of one.',
        ex: [
          ['SELECT l.loan_id, l.dpd AS dpd_now, s.dpd AS dpd_sep', 'Show each loan\'s DPD today and at September month end,'],
          ['FROM loans l', 'starting from loans,'],
          ['JOIN loan_snapshots s', 'bringing in the snapshots, which we call s,'],
          ['  ON s.loan_id = l.loan_id', 'matched on loan ID,'],
          [`  AND s.snapshot_month = '2026-09'`, 'and for the 2026-09 month only,'],
          ['WHERE l.collectibility = 3;', 'for today\'s Kol 3 loans.']
        ],
        task: `How has DPD changed at my branch since July? For loans with <code>branch_id = 9</code>, show <code>loan_id</code>, <code>dpd_now</code> (from <code>loans</code>) and <code>dpd_jul</code> (from the <code>2026-07</code> snapshot). Every loan at the branch must appear, with NULL if it has no July snapshot.`,
        starter: `SELECT l.loan_id, l.dpd AS dpd_now, s.dpd AS dpd_jul\nFROM loans l\nLEFT JOIN loan_snapshots s\n  ON s.loan_id = ____\n  AND s.snapshot_month = ____\nWHERE l.branch_id = 9;`,
        fill: [`l.loan_id`, `'2026-07'`],
        solution: `SELECT l.loan_id, l.dpd AS dpd_now, s.dpd AS dpd_jul\nFROM loans l\nLEFT JOIN loan_snapshots s\n  ON s.loan_id = l.loan_id\n  AND s.snapshot_month = '2026-07'\nWHERE l.branch_id = 9;`,
        altSolutions: [
          `SELECT l.loan_id, l.dpd AS dpd_now, s.dpd AS dpd_jul\nFROM loans l\nLEFT JOIN loan_snapshots s\n  ON s.snapshot_month = '2026-07'\n  AND l.loan_id = s.loan_id\nWHERE l.branch_id = 9\nORDER BY l.loan_id;`
        ],
        wrong: [
          `SELECT l.loan_id, l.dpd AS dpd_now, s.dpd AS dpd_jul\nFROM loans l\nLEFT JOIN loan_snapshots s\n  ON s.loan_id = l.loan_id\nWHERE l.branch_id = 9\n  AND s.snapshot_month = '2026-07';`,
          `SELECT l.loan_id, l.dpd AS dpd_now, s.dpd AS dpd_jul\nFROM loans l\nLEFT JOIN loan_snapshots s\n  ON s.loan_id = l.loan_id\nWHERE l.branch_id = 9;`,
          `SELECT l.loan_id, l.dpd AS dpd_now, s.dpd AS dpd_jul\nFROM loans l\nJOIN loan_snapshots s\n  ON s.loan_id = l.loan_id\n  AND s.snapshot_month = '2026-07'\nWHERE l.branch_id = 9;`,
          `SELECT l.loan_id, l.dpd AS dpd_now, s.dpd AS dpd_jul\nFROM loans l\nLEFT JOIN loan_snapshots s\n  ON s.loan_id = l.loan_id\n  AND s.snapshot_month = '2026-06'\nWHERE l.branch_id = 9;`,
          `SELECT l.loan_id, s.dpd AS dpd_now, l.dpd AS dpd_jul\nFROM loans l\nLEFT JOIN loan_snapshots s\n  ON s.loan_id = l.loan_id\n  AND s.snapshot_month = '2026-07'\nWHERE l.branch_id = 9;`
        ],
        requires: [
          { re: /^(?![\s\S]*\b(l|loans)\.dpd\s+(AS\s+)?dpd_jul\b)(?![\s\S]*\b(s|loan_snapshots)\.dpd\s+(AS\s+)?dpd_now\b)[\s\S]*$/i, msg: 'The numbers are right, but the labels are swapped. <code>dpd_now</code> comes from <code>loans</code>, and <code>dpd_jul</code> comes from the July snapshot. Swapped labels reverse the story in a report.' }
        ],
        traps: [
          { re: /^(?![\s\S]*\b(LEFT|RIGHT)\s+(OUTER\s+)?JOIN\b)[\s\S]*\bJOIN\b/i, msg: 'A plain <code>JOIN</code> drops the loans with no July snapshot, and the request wants them kept. Use <code>LEFT JOIN</code>.' },
          { re: /\bWHERE\b[\s\S]*snapshot_month/i, msg: 'In <code>WHERE</code>, the month test removes the loans with no July snapshot, because their month is NULL. Move it up into <code>ON</code>.' },
          { re: /^(?![\s\S]*snapshot_month)[\s\S]*$/, msg: 'With no month in the query, each loan brings back all its monthly snapshots. Add the month to <code>ON</code> with <code>AND</code>.' }
        ],
        hints: [
          `The first blank completes the loan match. The second says which month.`,
          `A month is text, so it needs single quotes.`,
          `The blanks are <code>l.loan_id</code> and <code>'2026-07'</code>.`
        ],
        win: `Loans 121 and 221 have no July snapshot, a gap that quietly breaks month-on-month reports. Move the month test down to <code>WHERE</code> and you get 31 rows instead of 33, because those two loans disappear.`,
        pattern: { sql: `SELECT l.loan_id, s.dpd\nFROM loans l\nLEFT JOIN loan_snapshots s\n  ON s.loan_id = l.loan_id\n  AND s.snapshot_month = '2026-09';`, note: 'Match one month: a second condition in ON' }
      },
      {
        id: '3.11',
        title: 'A table joined to itself',
        newIdea: 'A table can join to itself, using two aliases to tell the copies apart.',
        from: 'Eko, Agency lead',
        teach: `<p>In <code>collectors</code>, <code>supervisor_id</code> points to another row's <code>collector_id</code> in the same table. To read the boss's name, you join the table to itself. This is a [[self-join]].</p><p>Picture two copies of the table. The [[alias]] names them, so here <code>k</code> is the staff member and <code>boss</code> is the copy where you look up their supervisor. Each copy needs its own name, or the database cannot tell them apart. Two aliases make this clearest.</p>`,
        bridge: 'Like looking up a supervisor ID on the same staff sheet to get the supervisor\'s name.',
        ex: [
          ['SELECT boss.collector_name AS boss_name, COUNT(*) AS team_size', 'For each boss, count the people under them,'],
          ['FROM collectors k', 'starting from the staff copy,'],
          ['JOIN collectors boss', 'bringing in the boss copy,'],
          ['  ON k.supervisor_id = boss.collector_id', 'pairing each person with the row of their supervisor,'],
          ['GROUP BY boss.collector_name', 'with one row per boss,'],
          ['ORDER BY team_size DESC;', 'and the biggest team first.']
        ],
        task: `I am drawing the org chart. Show <code>collector_name</code> and <code>boss_name</code> for all 33 people. Anyone with no boss must still appear, with NULL. Fill in the blanks.`,
        starter: `SELECT k.collector_name, boss.collector_name AS boss_name\nFROM collectors k\nLEFT JOIN collectors boss\n  ON ____ = ____;`,
        fill: [`k.supervisor_id`, `boss.collector_id`],
        solution: `SELECT k.collector_name, boss.collector_name AS boss_name\nFROM collectors k\nLEFT JOIN collectors boss\n  ON k.supervisor_id = boss.collector_id;`,
        altSolutions: [
          `SELECT staff.collector_name, sup.collector_name AS boss_name\nFROM collectors AS staff\nLEFT JOIN collectors AS sup\n  ON sup.collector_id = staff.supervisor_id\nORDER BY staff.collector_name;`
        ],
        wrong: [
          `SELECT k.collector_name, boss.collector_name AS boss_name\nFROM collectors k\nJOIN collectors boss\n  ON k.supervisor_id = boss.collector_id;`,
          `SELECT k.collector_name, boss.collector_name AS boss_name\nFROM collectors k\nLEFT JOIN collectors boss\n  ON k.collector_id = boss.supervisor_id;`,
          `SELECT k.collector_name, boss.collector_name AS boss_name\nFROM collectors k\nLEFT JOIN collectors boss\n  ON k.collector_id = boss.collector_id;`,
          `SELECT collector_name, collector_name AS boss_name\nFROM collectors;`,
          `SELECT boss.collector_name AS collector_name, k.collector_name AS boss_name\nFROM collectors k\nLEFT JOIN collectors boss\n  ON k.supervisor_id = boss.collector_id;`
        ],
        requires: [
          { re: /^(?![\s\S]*\bk\.collector_name\s+(AS\s+)?boss_name\b)(?![\s\S]*\bboss\.collector_name\s+(AS\s+)?collector_name\b)[\s\S]*$/i, msg: 'The names are right, but the labels are swapped. <code>collector_name</code> holds the staff member, from <code>k</code>, and <code>boss_name</code> holds the boss, from <code>boss</code>. Swapped labels turn the org chart upside down.' }
        ],
        traps: [
          { re: /^(?![\s\S]*\b(LEFT|RIGHT)\s+(OUTER\s+)?JOIN\b)[\s\S]*\bJOIN\b/i, msg: 'A plain <code>JOIN</code> drops the person with no boss, because NULL matches nothing. Use <code>LEFT JOIN</code>.' },
          { re: /k\.collector_id\s*=\s*boss\.supervisor_id|boss\.supervisor_id\s*=\s*k\.collector_id/i, msg: 'This direction is reversed, so it finds the people each person manages. The staff member holds the pointer, so <code>k.supervisor_id</code> points to <code>boss.collector_id</code>.' },
          { re: /k\.collector_id\s*=\s*boss\.collector_id|boss\.collector_id\s*=\s*k\.collector_id/i, msg: 'This matches every person to their own row, so everyone becomes their own boss. Start from <code>k.supervisor_id</code>.' }
        ],
        hints: [
          `Which copy holds the pointer? The staff member, <code>k</code>, holds their supervisor's ID.`,
          `That pointer has to equal the ID of the boss row, in the <code>boss</code> copy.`,
          `Write <code>ON k.supervisor_id = boss.collector_id;</code>`
        ],
        win: `Citra Ramadhan, who runs the unit, is the only NULL. Once you can read this link, you can add up any collector's numbers under their supervisor.`,
        pattern: { sql: `SELECT k.collector_name, boss.collector_name AS boss_name\nFROM collectors k\nLEFT JOIN collectors boss\n  ON k.supervisor_id = boss.collector_id;`, note: 'Self-join: two aliases on one table' }
      },
      {
        id: '3.12',
        title: 'Stack two lists',
        newIdea: 'UNION ALL stacks the rows of one query under the rows of another.',
        from: 'Fitri, Desk Call lead',
        teach: `<p>JOIN puts tables side by side. [[UNION ALL]] puts one list under another.</p><ul><li>Each <code>SELECT</code> needs the same number of columns, in the same order.</li><li>Column names come from the first <code>SELECT</code>.</li><li>One <code>ORDER BY</code> goes at the very end.</li></ul><p>Text in quotes, like <code>'Payment'</code>, fills a whole column with that word. It shows which list a row came from.</p>`,
        bridge: 'Like pasting one list under another on a single sheet, then sorting by date.',
        ex: [
          [`SELECT a.activity_date AS event_date, 'Activity' AS event_kind`, 'Show each activity date with the label Activity,'],
          ['FROM collection_activities a', 'from the activities table,'],
          ['WHERE a.loan_id = 18', 'for loan 18 only,'],
          ['UNION ALL', 'then stack underneath it'],
          [`SELECT p.payment_date, 'Payment'`, 'each payment date with the label Payment,'],
          ['FROM payments p', 'from the payments table,'],
          ['WHERE p.loan_id = 18', 'also for loan 18 only,'],
          ['ORDER BY event_date;', 'and sort the whole stack by date.']
        ],
        task: `Before I call this customer, give me loan 214's history as one list. Show <code>event_date</code>, <code>event_kind</code> (exactly <code>Activity</code> or <code>Payment</code>) and <code>detail</code> (<code>activity_type</code> or <code>channel</code>). Keep repeated rows. Oldest first. Fill in the blanks.`,
        starter: `SELECT a.activity_date AS event_date, 'Activity' AS event_kind, a.activity_type AS detail\nFROM collection_activities a\nWHERE a.loan_id = 214\n____\nSELECT ____, 'Payment', p.channel\nFROM payments p\nWHERE p.loan_id = 214\nORDER BY ____;`,
        fill: [`UNION ALL`, `p.payment_date`, `event_date`],
        solution: `SELECT a.activity_date AS event_date, 'Activity' AS event_kind, a.activity_type AS detail\nFROM collection_activities a\nWHERE a.loan_id = 214\nUNION ALL\nSELECT p.payment_date, 'Payment', p.channel\nFROM payments p\nWHERE p.loan_id = 214\nORDER BY event_date;`,
        ordered: 'event_date',
        altSolutions: [
          `SELECT p.payment_date AS event_date, 'Payment' AS event_kind, p.channel AS detail\nFROM payments p\nWHERE p.loan_id = 214\nUNION ALL\nSELECT a.activity_date, 'Activity', a.activity_type\nFROM collection_activities a\nWHERE a.loan_id = 214\nORDER BY 1;`
        ],
        wrong: [
          `SELECT a.activity_date AS event_date, 'Activity' AS event_kind, a.activity_type AS detail\nFROM collection_activities a\nWHERE a.loan_id = 214\nUNION\nSELECT p.payment_date, 'Payment', p.channel\nFROM payments p\nWHERE p.loan_id = 214\nORDER BY event_date;`,
          `SELECT a.activity_date AS event_date, 'Activity' AS event_kind, a.activity_type AS detail\nFROM collection_activities a\nWHERE a.loan_id = 214\nUNION ALL\nSELECT p.payment_date, 'Payment', p.channel\nFROM payments p\nORDER BY event_date;`,
          `SELECT a.activity_date AS event_date, 'Activity' AS event_kind, a.activity_type AS detail\nFROM collection_activities a\nWHERE a.loan_id = 214\nORDER BY event_date;`,
          `SELECT a.activity_date AS event_date, 'Activity' AS event_kind, a.activity_type AS detail\nFROM collection_activities a\nWHERE a.loan_id = 214\nUNION ALL\nSELECT p.payment_date, 'Payment', p.channel\nFROM payments p\nWHERE p.loan_id = 214\nORDER BY event_date DESC;`
        ],
        traps: [
          { re: /\bUNION\b(?!\s+ALL\b)/i, msg: 'Plain <code>UNION</code> removes rows that look the same. Here it drops 2 of 15 rows, including a real call on 3 May by a different collector. Use <code>UNION ALL</code>.' },
          { re: /^(?:(?!WHERE)[\s\S])*WHERE[^;]*UNION\s+ALL(?:(?!WHERE)[\s\S])*$/i, msg: 'Each <code>SELECT</code> needs its own <code>WHERE</code>. The second one here brings in payments for every loan.' }
        ],
        hints: [
          `The first blank goes between the two queries and stacks them.`,
          `The second blank is the payment table's date column. The last blank is the name the first <code>SELECT</code> gave the date.`,
          `The blanks are <code>UNION ALL</code>, <code>p.payment_date</code> and <code>event_date</code>.`
        ],
        atWork: `Plain <code>UNION</code> removes repeated rows, so it can hide real ones. Reach for <code>UNION ALL</code> first. Most other databases also require matching data types in each column of the stack. SQLite does not check, so a list that runs here could raise an error at work. Sort the stack by the output name, such as <code>event_date</code>, because many databases reject a table-prefixed column here.`,
        win: `The story now reads in order, with two WhatsApp rows on 8 April and a Collector payment on 9 April. Add the <code>result</code> column and you would see the promise to pay too, and a good collector reads a history like this before picking up the phone.`,
        pattern: { sql: `SELECT date_a AS event_date, 'A' AS kind\nFROM table_a\nUNION ALL\nSELECT date_b, 'B'\nFROM table_b\nORDER BY event_date;`, note: 'Stack two lists into one dated list' }
      },
      {
        id: '3.13',
        type: 'fix',
        title: 'The JOIN with no ON',
        newIdea: 'A JOIN with no ON pairs every row with every row, so the row count explodes.',
        from: 'Tasya, fellow trainee',
        teach: `<p>Without <code>ON</code>, a JOIN has no rule for which rows belong together, so it pairs every row with every row. That is a [[cross join]].</p><p>The example below pairs 502 loans with 12 branches, giving 6,024 rows. SQLite raises no error, so the row count is your only warning. Check it after every join, and ask whether it makes sense.</p>`,
        bridge: 'Like a multiplication table in Excel, with 4 rows down and 12 columns across, giving 48 cells.',
        ex: [
          ['SELECT COUNT(*) AS row_count', 'Count the rows,'],
          ['FROM loans l', 'starting from loans,'],
          ['JOIN branches b;', 'paired with branches with no ON, so every loan meets every branch.']
        ],
        task: `There are only 4 Kol 3 loans, and my list shows 48 rows. Run it and see. Fix it so each loan appears once, with its own branch. Keep <code>loan_id</code>, <code>branch_name</code> and <code>dpd</code>.`,
        starter: `SELECT l.loan_id, b.branch_name, l.dpd\nFROM loans l\nJOIN branches b\nWHERE l.collectibility = 3;`,
        solution: `SELECT l.loan_id, b.branch_name, l.dpd\nFROM loans l\nJOIN branches b\n  ON l.branch_id = b.branch_id\nWHERE l.collectibility = 3;`,
        altSolutions: [
          `SELECT l.loan_id, b.branch_name, l.dpd\nFROM loans l\nJOIN branches b\nWHERE l.collectibility = 3\n  AND l.branch_id = b.branch_id;`,
          `SELECT l.loan_id, b.branch_name, l.dpd\nFROM loans l\nJOIN branches b\n  USING (branch_id)\nWHERE l.collectibility = 3;`
        ],
        wrong: [
          `SELECT DISTINCT l.loan_id, b.branch_name, l.dpd\nFROM loans l\nJOIN branches b\nWHERE l.collectibility = 3;`,
          `SELECT l.loan_id, b.branch_name, l.dpd\nFROM loans l\nJOIN branches b\nWHERE l.collectibility = 3\nLIMIT 4;`,
          `SELECT l.loan_id, b.branch_name, l.dpd\nFROM loans l\nJOIN branches b\nWHERE l.collectibility = 3\nGROUP BY l.loan_id;`
        ],
        traps: [
          { re: /\bDISTINCT\b/i, msg: '<code>DISTINCT</code> cannot help, because each pairing of a loan and a branch is a different row. The JOIN needs an <code>ON</code>.' },
          { re: /\bLIMIT\b/i, msg: '<code>LIMIT</code> hides rows and leaves the wrong branch on them. The JOIN needs an <code>ON</code>.' },
          { re: /\bGROUP\s+BY\b/i, msg: 'Grouping gives 4 rows, but the database picks one of the 12 branches for each loan with no rule behind it. The JOIN needs an <code>ON</code>.' }
        ],
        hints: [
          `Look at the <code>JOIN</code> line. What is missing right under it?`,
          `Both tables have a <code>branch_id</code>. Add an <code>ON</code> line that matches them.`,
          `Add <code>ON l.branch_id = b.branch_id</code> right after <code>JOIN branches b</code>.`
        ],
        atWork: `Oracle, SQL Server, PostgreSQL and BigQuery all reject a plain <code>JOIN</code> with no <code>ON</code>. The old comma style, <code>FROM loans, branches</code>, is accepted everywhere, so the same accident can still happen.`,
        win: `Row counts are the fastest bug detector you have. If you know there are 4 Kol 3 loans and the list shows 48, you can catch the mistake before the list reaches anyone.`,
        pattern: { sql: `-- Row count far too big after a JOIN?\n-- Check that every JOIN has an ON.`, note: 'A JOIN with no ON multiplies rows' }
      },
      {
        id: '3.14',
        title: 'Write the JOINs yourself',
        newIdea: 'You can write a whole JOIN query from an empty editor, one table at a time.',
        from: 'Dian, Finance',
        teach: `<p>There is no new SQL here. Until now, part of each JOIN was already written for you. This time the editor is empty.</p><p>Work in the same order every time. Start from the table whose rows you want. Add one table with its <code>ON</code>. Run it and check the row count. Then add the next table.</p>`,
        bridge: 'Like building a working file yourself, adding one lookup column at a time and checking it before the next.',
        ex: [
          ['SELECT a.activity_date, c.full_name, k.collector_name', 'Show the visit date, the customer and the collector,'],
          ['FROM collection_activities a', 'starting from activities, because we want one row per visit,'],
          ['JOIN loans l', 'bringing in the loan each visit was for,'],
          ['  ON l.loan_id = a.loan_id', 'matched on loan ID,'],
          ['JOIN customers c', 'then the customer who holds that loan,'],
          ['  ON c.customer_id = l.customer_id', 'matched on customer ID,'],
          ['JOIN collectors k', 'then the collector who made the visit,'],
          ['  ON k.collector_id = a.collector_id', 'matched on collector ID,'],
          [`WHERE a.activity_type = 'Visit'`, 'keeping only visits,'],
          [`  AND a.activity_date >= '2026-10-27';`, 'from 27 October onward.']
        ],
        task: `I am matching field cash to the ledger. List every payment through the <code>Collector</code> channel in October 2026. Show <code>payment_date</code>, <code>full_name</code>, <code>branch_name</code> and <code>amount</code>, oldest first. Write it from an empty editor, one JOIN at a time.`,
        solution: `SELECT p.payment_date, c.full_name, b.branch_name, p.amount\nFROM payments p\nJOIN loans l\n  ON l.loan_id = p.loan_id\nJOIN customers c\n  ON c.customer_id = l.customer_id\nJOIN branches b\n  ON b.branch_id = l.branch_id\nWHERE p.payment_date BETWEEN '2026-10-01' AND '2026-10-31'\n  AND p.channel = 'Collector'\nORDER BY p.payment_date;`,
        ordered: 'payment_date',
        altSolutions: [
          `SELECT p.payment_date, c.full_name, b.branch_name, p.amount\nFROM customers c\nJOIN loans l\n  ON c.customer_id = l.customer_id\nJOIN payments p\n  ON l.loan_id = p.loan_id\nJOIN branches b\n  ON l.branch_id = b.branch_id\nWHERE p.channel = 'Collector'\n  AND p.payment_date >= '2026-10-01'\n  AND p.payment_date <= '2026-10-31'\nORDER BY p.payment_date ASC;`,
          `SELECT p.payment_date, c.full_name, b.branch_name, p.amount\nFROM payments p\nJOIN loans l\n  ON l.loan_id = p.loan_id\nJOIN customers c\n  ON c.customer_id = l.customer_id\nJOIN branches b\n  ON b.branch_id = l.branch_id\nWHERE p.payment_date LIKE '2026-10%'\n  AND p.channel = 'Collector'\nORDER BY 1;`
        ],
        wrong: [
          `SELECT p.payment_date, c.full_name, b.branch_name, p.amount\nFROM payments p\nJOIN loans l\n  ON l.loan_id = p.loan_id\nJOIN customers c\n  ON c.customer_id = l.customer_id\nJOIN branches b\n  ON b.branch_id = l.branch_id\nWHERE p.payment_date BETWEEN '2026-10-01' AND '2026-10-31'\nORDER BY p.payment_date;`,
          `SELECT p.payment_date, c.full_name, b.branch_name, p.amount\nFROM payments p\nJOIN loans l\n  ON l.loan_id = p.loan_id\nJOIN customers c\n  ON c.customer_id = l.customer_id\nJOIN branches b\n  ON b.branch_id = l.branch_id\nWHERE p.channel = 'Collector'\nORDER BY p.payment_date;`,
          `SELECT p.payment_date, c.full_name, b.branch_name, p.amount\nFROM payments p\nJOIN loans l\n  ON l.loan_id = p.loan_id\nJOIN customers c\n  ON c.customer_id = p.loan_id\nJOIN branches b\n  ON b.branch_id = l.branch_id\nWHERE p.payment_date BETWEEN '2026-10-01' AND '2026-10-31'\n  AND p.channel = 'Collector'\nORDER BY p.payment_date;`,
          `SELECT p.payment_date, c.full_name, b.branch_name, p.amount\nFROM payments p\nJOIN loans l\n  ON l.loan_id = p.loan_id\nJOIN customers c\n  ON c.customer_id = l.customer_id\nJOIN branches b\n  ON b.branch_id = l.branch_id\nWHERE p.payment_date BETWEEN '2026-10-01' AND '2026-10-31'\n  AND p.channel = 'Collector'\nORDER BY p.payment_date DESC;`
        ],
        traps: [
          { re: /\b(p\.loan_id\s*=\s*c\.customer_id|c\.customer_id\s*=\s*p\.loan_id|p\.loan_id\s*=\s*b\.branch_id|b\.branch_id\s*=\s*p\.loan_id)\b/i, msg: 'These two IDs are different kinds of number, so this pairs rows at random. Payments connect to <code>loans</code> through <code>loan_id</code>, and <code>loans</code> holds the keys for customers and branches.' },
          { re: /^(?![\s\S]*'Collector')[\s\S]*$/i, msg: 'Payments from every channel are in your list. Keep only <code>p.channel = \'Collector\'</code>.' },
          { re: /^(?![\s\S]*2026-10)[\s\S]*$/i, msg: 'Payments from every month are in your list. Keep only October 2026.' }
        ],
        hints: [
          `Start with <code>FROM payments p</code>. A payment knows its loan, so <code>loans</code> comes next.`,
          `<code>loans</code> holds both keys you need next, <code>customer_id</code> for customers and <code>branch_id</code> for branches.`,
          `The three joins are <code>JOIN loans l ON l.loan_id = p.loan_id</code>, <code>JOIN customers c ON c.customer_id = l.customer_id</code> and <code>JOIN branches b ON b.branch_id = l.branch_id</code>.`,
          `Finish with <code>WHERE p.payment_date BETWEEN '2026-10-01' AND '2026-10-31' AND p.channel = 'Collector'</code>, then <code>ORDER BY p.payment_date;</code>`
        ],
        win: `Siti Tampubolon appears twice on 7 October with the same amount, and those are payments on two different loans, 382 and 383. Two rows that look the same are not always a mistake, so check the IDs before you call them duplicates.`,
        pattern: { sql: `SELECT p.col_a, c.col_a, b.col_a\nFROM payments p\nJOIN loans l\n  ON l.loan_id = p.loan_id\nJOIN customers c\n  ON c.customer_id = l.customer_id\nJOIN branches b\n  ON b.branch_id = l.branch_id;`, note: 'Reach two tables through one middle table' }
      },
      {
        id: '3.15',
        title: 'Keep going after a LEFT JOIN',
        newIdea: 'After a LEFT JOIN, the next join must also be a LEFT JOIN, or the NULL rows drop.',
        from: 'Yusuf, Field team lead',
        teach: `<p>Loans have no collector column. <code>loan_assignments</code> says which collector holds which loan, so you walk from loans to assignments, then to collectors. An assignment is active while its <code>unassigned_date</code> is NULL. This course calls the table <code>g</code>, because <code>a</code> is taken by activities.</p><p>A loan with no active assignment has NULL in <code>g.collector_id</code>. NULL matches nothing, so a plain JOIN to <code>collectors</code> would drop that loan. Use [[LEFT JOIN]] again.</p>`,
        bridge: 'Like a second XLOOKUP reading the #N/A from the first, where you still want the row to stay.',
        ex: [
          ['SELECT c.customer_id, l.loan_id, b.branch_name', 'Show each customer, their loan and its branch,'],
          ['FROM customers c', 'keeping every customer,'],
          ['LEFT JOIN loans l', 'bringing in loans where they exist,'],
          ['  ON l.customer_id = c.customer_id', 'matched on customer ID,'],
          ['LEFT JOIN branches b', 'then bringing in the branch, still keeping every row,'],
          ['  ON b.branch_id = l.branch_id', 'matched on branch ID,'],
          ['WHERE c.customer_id >= 400;', 'for customer_id 400 or higher.']
        ],
        exNote: `This is the customer list from mission 3.7, with 27 rows. Make the last join a plain JOIN and the 15 customers with no loan vanish, leaving 12 rows.`,
        task: `I am reviewing who holds my Kol 4 loans. Show <code>loan_id</code>, <code>dpd</code> and <code>collector_name</code> from the active assignment (<code>unassigned_date</code> is NULL). A loan with no active collector stays, with NULL. Fill in the blanks.`,
        starter: `SELECT l.loan_id, l.dpd, k.collector_name\nFROM loans l\nLEFT JOIN loan_assignments g\n  ON g.loan_id = ____\n  AND g.unassigned_date IS NULL\n____ collectors k\n  ON k.collector_id = ____\nWHERE l.collectibility = 4;`,
        fill: [`l.loan_id`, `LEFT JOIN`, `g.collector_id`],
        solution: `SELECT l.loan_id, l.dpd, k.collector_name\nFROM loans l\nLEFT JOIN loan_assignments g\n  ON g.loan_id = l.loan_id\n  AND g.unassigned_date IS NULL\nLEFT JOIN collectors k\n  ON k.collector_id = g.collector_id\nWHERE l.collectibility = 4;`,
        altSolutions: [
          `SELECT l.loan_id, l.dpd, k.collector_name\nFROM loans AS l\nLEFT OUTER JOIN loan_assignments AS g\n  ON l.loan_id = g.loan_id\n  AND g.unassigned_date IS NULL\nLEFT OUTER JOIN collectors AS k\n  ON g.collector_id = k.collector_id\nWHERE l.collectibility = 4\nORDER BY l.dpd DESC;`
        ],
        wrong: [
          `SELECT l.loan_id, l.dpd, k.collector_name\nFROM loans l\nLEFT JOIN loan_assignments g\n  ON g.loan_id = l.loan_id\n  AND g.unassigned_date IS NULL\nJOIN collectors k\n  ON k.collector_id = g.collector_id\nWHERE l.collectibility = 4;`,
          `SELECT l.loan_id, l.dpd, k.collector_name\nFROM loans l\nJOIN loan_assignments g\n  ON g.loan_id = l.loan_id\n  AND g.unassigned_date IS NULL\nJOIN collectors k\n  ON k.collector_id = g.collector_id\nWHERE l.collectibility = 4;`,
          `SELECT l.loan_id, l.dpd, k.collector_name\nFROM loans l\nLEFT JOIN loan_assignments g\n  ON g.loan_id = l.loan_id\nLEFT JOIN collectors k\n  ON k.collector_id = g.collector_id\nWHERE l.collectibility = 4;`
        ],
        traps: [
          { re: /LEFT\s+(?:OUTER\s+)?JOIN\s+loan_assignments\b(?:(?!\b(?:LEFT\s+|OUTER\s+|RIGHT\s+)?JOIN\b)[\s\S])*\bJOIN\s+collectors\b/i, msg: 'A plain <code>JOIN</code> to <code>collectors</code> throws away the NULL rows the LEFT JOIN kept, because NULL matches nothing. Make this one a <code>LEFT JOIN</code> too.' },
          { re: /^(?![\s\S]*\b(LEFT|RIGHT)\s+(OUTER\s+)?JOIN\b)[\s\S]*\bJOIN\b/i, msg: 'A plain <code>JOIN</code> drops the loan with no active collector, and the request wants it kept. Use <code>LEFT JOIN</code> for both joins.' },
          { re: /^(?![\s\S]*unassigned_date)[\s\S]*$/i, msg: 'Ended assignments are coming through too. Only rows where <code>unassigned_date</code> is NULL are active.' }
        ],
        hints: [
          `Loans connect to <code>loan_assignments</code> through <code>loan_id</code>, and assignments connect to <code>collectors</code> through <code>collector_id</code>.`,
          `<code>g.collector_id</code> is NULL for a loan with no active assignment. Which kind of join keeps that loan?`,
          `The blanks are <code>l.loan_id</code>, <code>LEFT JOIN</code> and <code>g.collector_id</code>.`
        ],
        win: `Loan 272 is 178 days overdue with no collector. It was also on your no-activity list in mission 3.8, so two separate checks now point at the same loan.`,
        pattern: { sql: `SELECT a.col_a, c.col_a\nFROM table_a a\nLEFT JOIN middle_table b\n  ON b.a_id = a.id\n  AND b.end_date IS NULL\nLEFT JOIN table_c c\n  ON c.id = b.c_id;`, note: 'After a LEFT JOIN, keep joining with LEFT JOIN' }
      },
      {
        id: '3.16',
        checkpoint: true,
        title: 'Checkpoint: the daily call list',
        newIdea: 'One real request that uses everything in this level.',
        from: 'Fitri, Desk Call lead',
        teach: `<p>This is everything from this level, in one request, with no starter.</p><p>Take it one table at a time. Start from the loans you want, then bring in each table you need. For each join, decide whether a row with no match should drop or stay with NULL.</p>`,
        bridge: 'Like building one working file from four master sheets, one lookup at a time.',
        task: `Build today's call list, with every Kol 2 loan. Show <code>loan_id</code>, <code>full_name</code>, <code>phone</code>, <code>branch_name</code>, <code>dpd</code> and <code>collector_name</code>. The collector comes from <code>loan_assignments</code>, using only active rows (<code>unassigned_date</code> is NULL). A loan with no active collector stays, with NULL. A loan with two active collectors shows two rows. Longest overdue first.`,
        solution: `SELECT l.loan_id, c.full_name, c.phone, b.branch_name, l.dpd, k.collector_name\nFROM loans l\nJOIN customers c\n  ON c.customer_id = l.customer_id\nJOIN branches b\n  ON b.branch_id = l.branch_id\nLEFT JOIN loan_assignments g\n  ON g.loan_id = l.loan_id\n  AND g.unassigned_date IS NULL\nLEFT JOIN collectors k\n  ON k.collector_id = g.collector_id\nWHERE l.collectibility = 2\nORDER BY l.dpd DESC;`,
        ordered: 'dpd',
        altSolutions: [
          `SELECT l.loan_id, c.full_name, c.phone, b.branch_name, l.dpd, k.collector_name\nFROM loans l\nLEFT JOIN customers c\n  ON l.customer_id = c.customer_id\nLEFT JOIN branches b\n  ON l.branch_id = b.branch_id\nLEFT JOIN loan_assignments g\n  ON l.loan_id = g.loan_id\n  AND g.unassigned_date IS NULL\nLEFT JOIN collectors k\n  ON g.collector_id = k.collector_id\nWHERE l.collectibility = 2\nORDER BY l.dpd DESC, l.loan_id;`
        ],
        wrong: [
          `SELECT l.loan_id, c.full_name, c.phone, b.branch_name, l.dpd, k.collector_name\nFROM loans l\nJOIN customers c\n  ON c.customer_id = l.customer_id\nJOIN branches b\n  ON b.branch_id = l.branch_id\nJOIN loan_assignments g\n  ON g.loan_id = l.loan_id\n  AND g.unassigned_date IS NULL\nJOIN collectors k\n  ON k.collector_id = g.collector_id\nWHERE l.collectibility = 2\nORDER BY l.dpd DESC;`,
          `SELECT l.loan_id, c.full_name, c.phone, b.branch_name, l.dpd, k.collector_name\nFROM loans l\nJOIN customers c\n  ON c.customer_id = l.customer_id\nJOIN branches b\n  ON b.branch_id = l.branch_id\nLEFT JOIN loan_assignments g\n  ON g.loan_id = l.loan_id\nLEFT JOIN collectors k\n  ON k.collector_id = g.collector_id\nWHERE l.collectibility = 2\n  AND g.unassigned_date IS NULL\nORDER BY l.dpd DESC;`,
          `SELECT l.loan_id, c.full_name, c.phone, b.branch_name, l.dpd, k.collector_name\nFROM loans l\nJOIN customers c\n  ON c.customer_id = l.customer_id\nJOIN branches b\n  ON b.branch_id = l.branch_id\nLEFT JOIN loan_assignments g\n  ON g.loan_id = l.loan_id\nLEFT JOIN collectors k\n  ON k.collector_id = g.collector_id\nWHERE l.collectibility = 2\nORDER BY l.dpd DESC;`,
          `SELECT l.loan_id, c.full_name, c.phone, b.branch_name, l.dpd, k.collector_name\nFROM loans l\nJOIN customers c\n  ON c.customer_id = l.customer_id\nJOIN branches b\n  ON b.branch_id = l.branch_id\nLEFT JOIN loan_assignments g\n  ON g.loan_id = l.loan_id\n  AND g.unassigned_date IS NULL\nJOIN collectors k\n  ON k.collector_id = g.collector_id\nWHERE l.collectibility = 2\nORDER BY l.dpd DESC;`,
          `SELECT l.loan_id, c.full_name, c.phone, b.branch_name, l.dpd, k.collector_name\nFROM loans l\nJOIN customers c\n  ON c.customer_id = l.customer_id\nJOIN branches b\n  ON b.branch_id = l.branch_id\nLEFT JOIN loan_assignments g\n  ON g.loan_id = l.loan_id\n  AND g.unassigned_date IS NULL\nLEFT JOIN collectors k\n  ON k.collector_id = g.collector_id\nWHERE l.collectibility = 2\nORDER BY l.dpd;`
        ],
        traps: [
          { re: /\bWHERE\b[\s\S]*unassigned_date/i, msg: 'In <code>WHERE</code>, this test drops loans whose only assignments have ended. Move it into the <code>ON</code> of <code>loan_assignments</code>, as you did with the snapshot month.' },
          { re: /^(?![\s\S]*unassigned_date)[\s\S]*$/i, msg: 'Ended assignments are coming through too. Only rows where <code>unassigned_date</code> is NULL are active.' },
          { re: /^(?![\s\S]*\b(LEFT|RIGHT)\s+(OUTER\s+)?JOIN\b)[\s\S]*\bJOIN\b/i, msg: 'A plain <code>JOIN</code> to the assignments drops every loan with no active collector. Those loans still need calling, so use <code>LEFT JOIN</code>.' },
          { re: /LEFT\s+(?:OUTER\s+)?JOIN\s+loan_assignments\b(?:(?!\b(?:LEFT\s+|OUTER\s+|RIGHT\s+)?JOIN\b)[\s\S])*\bJOIN\s+collectors\b/i, msg: 'A plain <code>JOIN</code> to <code>collectors</code> throws away the NULL rows the LEFT JOIN kept, because NULL matches nothing. Make this one a <code>LEFT JOIN</code> too.' }
        ],
        hints: [
          `Start with <code>FROM loans l</code>. Add customers and branches next. Each one has a key in <code>loans</code>, and a plain <code>JOIN</code> is fine because they always match.`,
          `Loans have no collector column. Go through <code>loan_assignments</code>, then to <code>collectors</code>, using <code>LEFT JOIN</code> for both.`,
          `Call <code>loan_assignments</code> <code>g</code>. Its <code>ON</code> has two conditions, <code>g.loan_id = l.loan_id AND g.unassigned_date IS NULL</code>.`,
          `Then write <code>LEFT JOIN collectors k ON k.collector_id = g.collector_id</code>. Finish with <code>WHERE l.collectibility = 2</code> and <code>ORDER BY l.dpd DESC;</code>`
        ],
        win: `Level 3 done. This list also shows that 22 Kol 2 loans have no active collector and that loans 3, 249 and 331 have two, and a good analyst raises both with the person who assigns loans to collectors.`,
        pattern: { sql: `SELECT l.loan_id, c.full_name, k.collector_name\nFROM loans l\nJOIN customers c\n  ON c.customer_id = l.customer_id\nLEFT JOIN loan_assignments g\n  ON g.loan_id = l.loan_id\n  AND g.unassigned_date IS NULL\nLEFT JOIN collectors k\n  ON k.collector_id = g.collector_id;`, note: 'Loans with their current collector, keeping the unassigned' }
      }
    ]
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
