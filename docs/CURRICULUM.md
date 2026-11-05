# Curriculum

Generated from the lesson files by `scripts/curriculum.mjs`. 10 levels, 198 missions, from never having seen SQL to professional collection analytics.

## Level 0: Start Here (rank: Day One)

Run a query, read the result, and fix your first error.

| Mission | Type | Title | New idea |
| --- | --- | --- | --- |
| 0.1 | write | Press the button | A query is a question, and the answer is a table. |
| 0.2 | quiz | Read the result | One row is one thing, and one column is one fact about it. |
| 0.3 | write | Ask for a different table | The word after FROM picks the table. |
| 0.4 | write | Ask for one column | After SELECT, name the columns you want. |
| 0.5 | write | Ask for two columns | Put a comma between column names. |
| 0.6 | order | Put the query in order | SELECT comes first, then FROM. |
| 0.7 | fix | Errors are normal | An error means "I did not understand", and nothing is broken. |
| 0.8 | fix | The column that does not exist | Names must match exactly. |

## Level 1: Pull and Filter (rank: Data Reader)

Pull exactly the rows and columns someone asks for, then filter, sort and cut them to size.

| Mission | Type | Title | New idea |
| --- | --- | --- | --- |
| 1.1 | write | Your first query from blanks | You can build a whole query by filling in what you want and where it lives. |
| 1.2 | write | Keep only the rows you need | WHERE keeps only the rows that pass a test. |
| 1.3 | write | The loan grade, Kol | Kol is a loan's quality grade, stored as a number from 1 to 5. |
| 1.4 | write | Filter with text | Text goes in single quotes and must match exactly, capitals included. |
| 1.5 | write | More than, less than | Tests can use > < >= <= and <> as well as =. |
| 1.6 | write | Two tests with AND | AND keeps a row only when both tests pass. |
| 1.7 | write | Either test with OR | OR keeps a row when at least one test passes. |
| 1.8 | write | A neater OR with IN | IN checks a column against a list of values. |
| 1.9 | write | Number ranges with BETWEEN | BETWEEN keeps values inside a range, and both ends count. |
| 1.10 | write | Date ranges with BETWEEN | Dates here are text written year-month-day, so BETWEEN works on them too. |
| 1.11 | write | Flip a test with NOT | NOT in front of a test flips it. |
| 1.12 | write | Leave out a list with NOT IN | NOT IN leaves out a whole list of values. |
| 1.13 | write | Sort with ORDER BY | ORDER BY sorts the rows, ASC for low to high and DESC for high to low. |
| 1.14 | write | Top N with LIMIT | LIMIT stops the result after a set number of rows. |
| 1.15 | write | Missing values and IS NULL | NULL means no value was recorded, and you find it with IS NULL. |
| 1.16 | write | Search text with LIKE | LIKE matches a text pattern, and % stands for any text. |
| 1.17 | write | Each value once with DISTINCT | SELECT DISTINCT removes repeated rows from the result. |
| 1.18 | write | Math in a column | A column in SELECT can be a calculation, worked out once per row. |
| 1.19 | write | Name a column with AS | AS gives a column a clear name in the result. |
| 1.20 | order | Build a full query in order | Clauses always go in the same order: SELECT, FROM, WHERE, ORDER BY, LIMIT. |
| 1.21 | write | Type a query from empty | You can type a whole query yourself, starting from an empty editor. |
| 1.22 | checkpoint | Checkpoint: the KKB priority list | Put filters, sorting and LIMIT together with no help from a starter. |

## Level 2: Summarize (rank: Report Builder)

Count, total, group and label data, then build a DPD bucket report that ties back to its control total.

| Mission | Type | Title | New idea |
| --- | --- | --- | --- |
| 2.1 | write | Count the rows | COUNT(*) gives back one number, the number of rows. |
| 2.2 | write | Add up a column | SUM adds up a column into one total. |
| 2.3 | write | Smallest, largest, average | MIN, MAX and AVG work the same way as SUM. |
| 2.4 | write | Filter first, then count | WHERE runs first, so an aggregate only sees the rows that pass. |
| 2.5 | write | Loans versus customers | COUNT(DISTINCT column) counts each different value once. |
| 2.6 | write | One row per group | GROUP BY makes one result row for each different value in a column. |
| 2.7 | write | Several measures per group | A grouped query can show several aggregates, each worked out per group. |
| 2.8 | write | Round the numbers | ROUND(value, decimals) trims a number to the decimals you choose. |
| 2.9 | write | Sort by a measure | ORDER BY can sort on a calculated column, using its AS name. |
| 2.10 | write | Group by two columns | GROUP BY with two columns makes one row per combination of their values. |
| 2.11 | write | Filter the groups | HAVING tests each group after it is counted, while WHERE tests rows before. |
| 2.12 | write | The order clauses run | The database behaves as if it runs clauses in a different order from how you write them. |
| 2.13 | quiz | WHERE or HAVING? | Test a fact on one row with WHERE, and a number about a group with HAVING. |
| 2.14 | quiz | Both filters in one request | Before you type, split a request into tests on rows and tests on groups. |
| 2.15 | write | Group by month | strftime('%Y-%m', date) turns a date into its year and month, ready to group. |
| 2.16 | write | Label rows with CASE | CASE WHEN turns a rule into a label, checked from top to bottom. |
| 2.17 | write | Count by label | You can GROUP BY a CASE label, using its AS name. |
| 2.18 | write | Sort labels in business order | ORDER BY MIN(column) puts labels in their real order when the alphabet gets it wrong. |
| 2.19 | write | SUMIF in SQL | SUM(CASE WHEN ... THEN value ELSE 0 END) adds up only the rows that pass a test. |
| 2.20 | write | A ratio that keeps its decimals | Put 100.0 first, because dividing two whole numbers drops the decimals. |
| 2.21 | write | COUNT(*) versus COUNT(column) | COUNT(*) counts rows, and COUNT(column) counts only rows where that column has a value. |
| 2.22 | write | NULL in math and in SUM | Math on one row with NULL gives NULL, while SUM skips NULL. |
| 2.23 | write | Swap NULL with COALESCE | COALESCE swaps a NULL for a value you choose. |
| 2.24 | quiz | Predict the row count | A grouped result has one row per group that survives the filters. |
| 2.25 | checkpoint | Checkpoint: DPD bucket report | Put it together: labels, several measures, a filter and business order. |

## Level 3: Combine Tables (rank: Table Connector)

Join tables on their keys, keep or find the rows with no match, and stack lists into one.

| Mission | Type | Title | New idea |
| --- | --- | --- | --- |
| 3.1 | quiz | Why the bank splits its data | Tables are linked by a key, a column that points to a row in another table. |
| 3.2 | write | Your first JOIN | JOIN brings in a second table, and ON says which rows belong together. |
| 3.3 | fix | Short names for tables | A table can have a short name, and you put that name in front of each column. |
| 3.4 | write | Join first, then group | After a JOIN you can group by a column from one table and add up a column from the other. |
| 3.5 | write | Walk through three tables | Each extra JOIN adds one more table with its own ON, so you can walk from link to link. |
| 3.6 | quiz | How many rows will this return? | A JOIN returns one row per match, so one loan with many activities becomes many rows. |
| 3.7 | write | Keep the rows with no match | LEFT JOIN keeps every row of the left-side table and shows NULL where nothing matches. |
| 3.8 | write | Find what is missing | LEFT JOIN plus IS NULL on the right-side table finds the rows that have no match. |
| 3.9 | write | Counting zeros | After a LEFT JOIN, COUNT of a right-side column gives a true zero for rows with no match. |
| 3.10 | write | ON with two conditions | ON can hold more than one condition, joined with AND. |
| 3.11 | write | A table joined to itself | A table can join to itself, using two aliases to tell the copies apart. |
| 3.12 | write | Stack two lists | UNION ALL stacks the rows of one query under the rows of another. |
| 3.13 | fix | The JOIN with no ON | A JOIN with no ON pairs every row with every row, so the row count explodes. |
| 3.14 | write | Write the JOINs yourself | You can write a whole JOIN query from an empty editor, one table at a time. |
| 3.15 | write | Keep going after a LEFT JOIN | After a LEFT JOIN, the next join must also be a LEFT JOIN, or the NULL rows drop. |
| 3.16 | checkpoint | Checkpoint: the daily call list | One real request that uses everything in this level. |

## Level 4: Work in Steps (rank: Query Planner)

Break a hard question into named steps, and read a long query without panic.

| Mission | Type | Title | New idea |
| --- | --- | --- | --- |
| 4.1 | write | A query inside a query | A subquery in brackets can work out one value for the outer query to use. |
| 4.2 | write | A subquery that returns a list | IN can read its list from a subquery. |
| 4.3 | write | An inner query that uses the outer query | An inner query can use a column from the outer query, so it runs again for each row. |
| 4.4 | write | EXISTS: is there at least one? | EXISTS keeps a row when its subquery finds at least one match for that row. |
| 4.5 | write | NOT EXISTS: find what is missing | NOT EXISTS keeps a row when its subquery finds no match. |
| 4.6 | write | A subquery as a temporary table | A subquery in FROM acts as a table you built a moment ago. |
| 4.7 | write | Name a step with WITH | WITH gives a step a name, and the query below it can read that step like a table. |
| 4.8 | write | Chain two steps together | A later CTE can read from an earlier one, with a comma between them. |
| 4.9 | write | Work out the ratio in the last step | In a chain, work out a ratio in the last step, once its two columns exist. |
| 4.10 | write | A subquery as an extra column | A subquery in the SELECT list adds one column, worked out fresh for each row. |
| 4.11 | write | Compare a row with its own group | A correlated subquery in WHERE compares each row with a figure from its own group. |
| 4.12 | quiz | Read a long query top-down | Read the step names first, then the final SELECT, then each step. |
| 4.13 | fix | Turn a nested query into steps | Each nested subquery can move up to become a named step, with the result unchanged. |
| 4.14 | quiz | Grain: what is one row? | The grain is what one row means, and it decides whether adding up a column makes sense. |
| 4.15 | checkpoint | Customer exposure report | Plan the report in steps, then build it with no starter. |

## Level 5: Rank and Compare (rank: Trend Analyst)

Use window functions to rank within groups, pick the latest row, and build monthly trends a manager can act on.

| Mission | Type | Title | New idea |
| --- | --- | --- | --- |
| 5.1 | write | Keep the rows, add a total | OVER () calculates across all the rows and keeps every row in the result. |
| 5.2 | write | Share of the total | Divide a row by a window total to get its percent of the whole. |
| 5.3 | write | Number the rows | ROW_NUMBER() gives each row 1, 2, 3 in the order you choose inside OVER. |
| 5.4 | write | Ties: RANK and DENSE_RANK | RANK and DENSE_RANK give tied rows the same position, and differ in what comes next. |
| 5.5 | write | Rank inside each group | PARTITION BY restarts the window function for each group. |
| 5.6 | write | Top one per group | To filter on a window function, calculate it in a CTE and filter in the next step. |
| 5.7 | write | Latest row per group | Sort dates newest first inside OVER, and row 1 is the latest row per group. |
| 5.8 | quiz | Which ranking do you need? | RANK can return more rows than the top N you asked for, and ROW_NUMBER never does. |
| 5.9 | write | Running total | ORDER BY inside OVER makes SUM add up from the first row to the current row. |
| 5.10 | write | Moving average | ROWS BETWEEN sets exactly which rows the window looks at. |
| 5.11 | write | Compare with last month: LAG | LAG reads a value from the row before the current one. |
| 5.12 | write | Look ahead: LEAD | LEAD reads a value from the row after the current one. |
| 5.13 | write | Days between dates | Subtract two julianday() values to get the number of days between two dates. |
| 5.14 | write | Find the long gaps | PARTITION BY keeps LEAD inside one loan, so a gap never crosses into the next loan. |
| 5.15 | write | Equal-sized groups: NTILE | NTILE(n) sorts the rows and splits them into n groups of nearly equal size. |
| 5.16 | write | Cut a number out of text | substr cuts text by position, and CAST turns the piece into a number. |
| 5.17 | quiz | Spot the run | Month number minus row number stays the same throughout an unbroken run. |
| 5.18 | write | Gaps and islands | GROUP BY the month-minus-row-number label to measure each unbroken run. |
| 5.19 | checkpoint | Checkpoint: monthly NPL trend | Combine several window functions into one management report. |

## Level 6: Debug a Colleague's Query (rank: Bug Hunter)

Find and fix the bugs that run without complaint and quietly give the wrong number.

| Mission | Type | Title | New idea |
| --- | --- | --- | --- |
| 6.1 | fix | On-time loans on the overdue list | AND runs before OR, so mixed conditions need brackets. |
| 6.2 | fix | A total bigger than the whole book | A JOIN that repeats a loan makes SUM count its balance again each time. |
| 6.3 | fix | Counted activities, wanted loans | COUNT(*) counts rows and COUNT(DISTINCT col) counts different things, so decide which one the request wants. |
| 6.4 | fix | The collectors who vanished | A WHERE test on the table after LEFT JOIN removes the unmatched rows, so that test belongs in ON. |
| 6.5 | fix | NOT IN returned nothing | One NULL in a NOT IN list makes the whole test fail for every row. |
| 6.6 | fix | Jakarta, four times | Clean hand-typed text with UPPER and TRIM before you group by it. |
| 6.7 | fix | The date that sorts wrong | Text dates only compare correctly when every date is typed as YYYY-MM-DD with its zeros. |
| 6.8 | fix | Every percentage is zero | Whole number divided by whole number drops the decimals, so bring in a decimal first. |
| 6.9 | fix | The average of averages | An overall ratio is total over total, and averaging smaller ratios gives a different number. |
| 6.10 | fix | The column left out of GROUP BY | Every SELECT column must be in GROUP BY or inside SUM, COUNT or a similar function, or SQLite picks a value with no warning. |
| 6.11 | fix | A top 10 that is not the top 10 | LIMIT cuts whatever order the rows are in, so a top N needs ORDER BY. |
| 6.12 | fix | The change that crosses loans | Without PARTITION BY, LAG reads the row before even when it belongs to another loan. |
| 6.13 | quiz | Spot the bug: too much money | When a total looks too big, walk through the JOINs and look for one that repeats rows. |
| 6.14 | quiz | Spot the bug: missing branches | When rows you expected are missing, check whether a WHERE is undoing a LEFT JOIN. |
| 6.15 | quiz | Spot the bug: the busiest collector | A name beside a total may have nothing to do with that total. |
| 6.16 | checkpoint | Checkpoint: three bugs in one report | Real reports hide several bugs at once, so review with a checklist. |

## Level 7: System Checks (rank: System Checker)

Prove with SQL whether a collection system is right, and write up what you find so it gets fixed.

| Mission | Type | Title | New idea |
| --- | --- | --- | --- |
| 7.1 | write | Test a business rule | A system check is a query that returns only the rows breaking a rule. |
| 7.2 | write | Work out the expected grade | Use CASE to work out the value a row should have, then compare it with the stored value. |
| 7.3 | quiz | Can you trust zero rows? | Zero rows is a pass only if the check looked at the right rows. |
| 7.4 | write | Profile a table you have never seen | One query can size up a new table: its rows, filled values, distinct values and range. |
| 7.5 | write | Find duplicates | Group by the columns that define "the same event", then keep groups with more than one row. |
| 7.6 | write | Orphan records | Start from the child table and LEFT JOIN the parent, and a NULL parent marks an orphan. |
| 7.7 | write | Required fields | A field can be required only when another column has a certain value. |
| 7.8 | write | Impossible dates | Compare two columns in the same row to catch values that cannot both be true. |
| 7.9 | write | Impossible amounts | Check a number column against the range of values it can sensibly hold. |
| 7.10 | write | Suspicious, or wrong? | A value that looks wrong is reported as a question until the business confirms the rule. |
| 7.11 | write | Reconcile two totals | Calculate the same total from two sources side by side and show the difference. |
| 7.12 | write | Drill down to the loans | Move from a total that disagrees to the exact rows causing it. |
| 7.13 | write | EXCEPT, the shorter way | EXCEPT returns rows from the first query that the second query does not have. |
| 7.14 | write | The two-way break report | Wrap each EXCEPT in brackets, so you can label its side and stack both directions. |
| 7.15 | write | Completeness: count what arrived | Compare how many rows exist with how many should exist. |
| 7.16 | write | Completeness: name the gap | CROSS JOIN builds every combination that should exist, ready to compare with what does. |
| 7.17 | write | A status can lie | Compare what was sent with what was loaded, whatever the status says. |
| 7.18 | write | On time, not only complete | A feed can load every row and still arrive too late to be useful. |
| 7.19 | write | The next date | date() moves a date forward by the step you name. |
| 7.20 | write | Build a calendar | WITH RECURSIVE builds a list of dates, one row at a time. |
| 7.21 | write | Find the missing runs | Join a calendar to the log to find jobs that never ran at all. |
| 7.22 | write | Overdue with no collector | Test an allocation rule using only the rows that are active today. |
| 7.23 | write | Two collectors on one loan | Test a rule from the other side: too many active rows as well as too few. |
| 7.24 | write | Who held the loan that day | An assignment covers a date when it started on or before that date and had not ended before it. |
| 7.25 | write | Right team for the bucket | Test that the right team holds a loan, as well as how many people hold it. |
| 7.26 | write | Near-duplicate customers | Join a table to itself with < to list each matching pair once. |
| 7.27 | write | Build a test pack | UNION ALL stacks one count per check into a single pass or fail table. |
| 7.28 | quiz | From query to defect report | A good defect report lets someone else reproduce the problem with no follow-up questions. |
| 7.29 | checkpoint | Checkpoint: a check from a spec | Turn a written spec into a query on your own. |

## Level 8: Pro Toolkit (rank: Database Operator)

Change data with a safety net, read a query plan, review SQL like a senior and behave well around production.

| Mission | Type | Title | New idea |
| --- | --- | --- | --- |
| 8.1 | write | Save a working list | CREATE TEMP TABLE saves a query result as a table you can query again. |
| 8.2 | write | Add a row with INSERT | INSERT INTO adds a new row to a table. |
| 8.3 | write | Change a row with UPDATE | UPDATE changes existing rows, and its WHERE decides which ones. |
| 8.4 | write | DELETE, with a SELECT first | Before any DELETE, run a SELECT with the same WHERE and read what it finds. |
| 8.5 | write | Remove duplicates, keep one | To remove duplicates, name the row to keep in each group and delete all the others. |
| 8.6 | write | Undo with ROLLBACK | After BEGIN, ROLLBACK undoes every change back to that point. |
| 8.7 | write | Keep changes with COMMIT | COMMIT makes every change since BEGIN permanent, all together. |
| 8.8 | write | Save a report as a view | CREATE VIEW saves a query under a name, and it reruns each time you read it. |
| 8.9 | write | Before and after a release | Save the pack before a change, run it again after, and join the two to see what moved. |
| 8.10 | write | Build your own table | CREATE TABLE lists each column with its type, and PRIMARY KEY marks the column that identifies a row. |
| 8.11 | write | Rules on a table: required values | NOT NULL makes a column refuse a row with no value. |
| 8.12 | write | Rules on a table: UNIQUE | UNIQUE refuses a value that already exists in that column. |
| 8.13 | write | Rules on a table: CHECK | CHECK refuses a row when your own condition is false. |
| 8.14 | write | Read the query plan | EXPLAIN QUERY PLAN shows whether the database will read every row or jump to the ones it needs. |
| 8.15 | write | From SCAN to SEARCH | CREATE INDEX builds a lookup on a column, so the database can jump to matching rows. |
| 8.16 | fix | Write filters an index can use | An index helps only when the filter compares the bare column, with no function around it. |
| 8.17 | write | Months as columns | One SUM(CASE ...) per month turns rows into a cross-tab, with months across the top. |
| 8.18 | write | Everyone under a manager | A recursive CTE walks a hierarchy, one level at a time, until a step finds nobody. |
| 8.19 | quiz | One fact, one place | In a normalized design, each fact is stored once and other tables point to it with a key. |
| 8.20 | write | Why snapshots exist | A snapshot table saves history that the current table overwrites. |
| 8.21 | quiz | Why typed text stays out of SQL | Apps send typed text as a parameter, because text pasted into SQL can run as SQL. |
| 8.22 | write | Good manners on shared data | When exploring shared data, start small: staging first, few columns, a filter and a LIMIT. |
| 8.23 | quiz | Never fix production by hand | Your job is to prove and report a production data problem, and the fix goes through the change process. |
| 8.24 | write | Share a sample safely | \|\| joins text, so you can show a value with its middle hidden. |
| 8.25 | fix | Review a query like a senior | A good review checks that the answer is correct first, then makes the query readable. |
| 8.26 | quiz | Other databases: the first N rows | The core of SQL carries over, and row limits are written differently on each database. |
| 8.27 | quiz | Other databases: dates and text | Date and text functions have different names on each database, so translate them first. |
| 8.28 | checkpoint | Checkpoint: a safe data fix | A safe change has five steps: inspect, begin, change, verify, commit. |

## Level 9: Collection Analytics and Final Exam (rank: SQL Pro)

Build the measures a collection unit reads every month, then show what you can do on your own.

| Mission | Type | Title | New idea |
| --- | --- | --- | --- |
| 9.1 | write | PAR 30 and PAR 90 by branch | PAR is the balance of loans past a set number of days, divided by the total balance. |
| 9.2 | write | Bucket migration matrix | A migration matrix counts loans by where they started and where they ended. |
| 9.3 | write | Roll rate per bucket | Number the buckets, so "moved to a worse bucket" becomes a plain greater-than. |
| 9.4 | write | Cure rate by product | Cure rate is the share of overdue loans that are current one month later. |
| 9.5 | write | Collection efficiency | Collection efficiency compares the cash that came in with the cash that was due. |
| 9.6 | write | Flag each promise kept or not | EXISTS can sit inside CASE, so each promise gets a 1 or a 0. |
| 9.7 | write | PTP kept rate by collector | A kept rate counts only promises already due, because a promise due next week is neither kept nor broken. |
| 9.8 | write | Broken promises nobody chased | date(ptp_date, '+7 day') sets a follow-up deadline, and NOT EXISTS finds promises nobody chased by then. |
| 9.9 | write | Contact rate by team | A contact rate depends on a written rule for what counts as an attempt and as reaching someone. |
| 9.10 | write | Stale cases | The latest-row pattern and julianday together show how long a case has gone untouched. |
| 9.11 | write | Vintage analysis | Find each loan's worst month first, then group the loans by the year the bank paid them out. |
| 9.12 | write | Recovery rate by product | Recovery rate is the cash received after write-off, against the balance written off. |
| 9.13 | write | Collector scorecard | Give each measure its own CTE, join them all to one list of people, then RANK inside each team. |
| 9.14 | write | The book as it stood | A month-end report takes each loan off the book in its write-off month, whatever its status says today. |
| 9.15 | write | NPL roll-forward | A roll-forward explains a change in balance line by line, from opening to closing. |
| 9.16 | quiz | Turn a request into a spec | A vague request becomes a spec when you ask about the period, the loans and the definition. |
| 9.17 | exam | Exam: monthly collection pack | No new SQL here. This exam combines month-end balances, cash and a change from the prior month. |
| 9.18 | exam | Exam: system test pack | No new SQL here. This exam proves in one query whether a new system version is fit to go live. |
| 9.19 | exam | Exam: production bug | No new SQL here. This exam asks you to find every bug in a long query that runs without an error. |
| 9.20 | exam | Exam: the safe fix | No new SQL here. This exam asks you to change data safely, from the first look to the commit. |

