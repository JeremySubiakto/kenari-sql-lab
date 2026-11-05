/*
 * Reference material for the Cheat sheet and for tap-to-define glossary terms.
 * A level file can add more terms through its own `terms` field.
 * Classic script in the browser (window.KenariRef), CommonJS in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KenariRef = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GLOSSARY = {
    /* SQL words */
    'SQL': 'Structured Query Language: the language for asking a database questions.',
    'database': 'An organized set of tables. Think of a workbook.',
    'table': 'One set of related rows and columns. Think of one sheet in a workbook.',
    'row': 'One record in a table, such as one loan. Reads across.',
    'column': 'One kind of information, such as the balance. Reads down.',
    'query': 'A request you write in SQL. The database answers with a table.',
    'result': 'The table a query gives back.',
    'clause': 'One part of a query, such as the WHERE part.',
    'NULL': 'No value recorded. It is not zero and not blank text. It means unknown.',
    'alias': 'A temporary short name for a column or a table. Columns usually get theirs with AS.',
    'key': 'A column that identifies a row, or points to a row in another table.',
    'primary key': 'The column that uniquely identifies each row in a table, such as loan_id.',
    'foreign key': 'A column pointing to the primary key of another table, such as loans.customer_id.',
    'aggregate': 'A function that squeezes many rows into one number: COUNT, SUM, AVG, MIN, MAX.',
    'grain': 'What one row of a table or result represents, such as one loan per month.',
    'subquery': 'A query inside another query.',
    'CTE': 'Common table expression: a named step in a query, written with WITH. Like a helper sheet.',
    'window function': 'A calculation that looks at neighboring rows and keeps every row. RANK and LAG are examples.',
    'partition': 'A group of rows that a window function works inside.',
    'fan-out': 'When a JOIN repeats rows, so totals come out too big.',
    'anti-join': 'Finding rows in one table with no match in another.',
    'self-join': 'Joining a table to itself, such as staff to their bosses.',
    'transaction': 'A group of changes that succeed or fail together.',
    'index': 'A lookup structure that helps the database find rows without reading the whole table.',
    'view': 'A saved query that you can use like a table.',
    'schema': 'The structure of a database: its tables, columns and links.',
    'dialect': 'One database product\'s version of SQL. The basics match, and details differ.',
    'SQLite': 'The small database engine running in this lab, inside your browser.',

    /* Banking and collection words */
    'DPD': 'Days past due: how many days a payment is late.',
    'Kol': 'Collectibility, the regulator\'s loan quality grade, from Kol 1 (Lancar, current) to Kol 5 (Macet, more than 180 days late).',
    'Kol 1': 'Lancar: current, with no arrears.',
    'Kol 2': 'Dalam Perhatian Khusus: 1 to 90 days past due.',
    'Kol 3': 'Kurang Lancar: 91 to 120 days past due.',
    'Kol 4': 'Diragukan: 121 to 180 days past due.',
    'Kol 5': 'Macet: more than 180 days past due.',
    'NPL': 'Non-performing loan: a loan in Kol 3, 4 or 5.',
    'outstanding': 'The balance the borrower still owes.',
    'principal': 'The original amount lent.',
    'installment': 'The regular monthly payment on a loan.',
    'bucket': 'A DPD range used to group overdue loans, such as 1-30 or 31-60.',
    'roll rate': 'The share of loans that moved into a worse bucket or grade between two dates.',
    'cure': 'When an overdue loan becomes current again.',
    'PTP': 'Promise to pay: a borrower\'s commitment to pay a set amount by a set date.',
    'broken PTP': 'A promise to pay that was not met.',
    'desk call': 'Collection by phone or message, usually for early-stage cases.',
    'field collection': 'A collector visits the borrower in person.',
    'agency': 'An outside company that collects for the bank.',
    'SP': 'Surat Peringatan, a formal warning letter (SP1, SP2, SP3).',
    'skip tracing': 'Finding contact details for a borrower you cannot reach.',
    'restructuring': 'Changing a loan\'s terms, such as a longer tenor, so the borrower can keep paying.',
    'write-off': 'Hapus buku: removing a loan from the balance sheet. Collection continues.',
    'recovery': 'Money collected on loans after write-off.',
    'KPR': 'Kredit Pemilikan Rumah: a home loan.',
    'KKB': 'Kredit Kendaraan Bermotor: a vehicle loan.',
    'KTA': 'Kredit Tanpa Agunan: an unsecured personal loan.',
    'KC': 'Kantor Cabang: a main branch.',
    'KCP': 'Kantor Cabang Pembantu: a smaller sub-branch.',
    'UAT': 'User acceptance testing: checking that a system does what the business needs before it goes live.',
    'reconciliation': 'Comparing two sources that should agree and explaining any difference.',
    'orphan': 'A row pointing to something that does not exist.',
    'batch': 'A scheduled job that moves or processes data in bulk, often overnight.',
    'vintage': 'A group of loans disbursed in the same period, tracked together over time.',
    'PAR': 'Portfolio at risk: the share of outstanding balance on loans past a set number of days overdue.',
    'exposure': 'How much money the bank could lose on a loan or borrower.'
  };

  const EXCEL_MAP = [
    ['Workbook', 'Database'],
    ['Sheet', 'Table'],
    ['Filter dropdown', 'WHERE'],
    ['Sort', 'ORDER BY'],
    ['Remove Duplicates', 'SELECT DISTINCT'],
    ['Filter to (Blanks)', 'IS NULL'],
    ['Formula column', 'SELECT a - b AS c'],
    ['COUNTA, SUM, AVERAGE', 'COUNT, SUM, AVG'],
    ['PivotTable rows', 'GROUP BY'],
    ['PivotTable values', 'COUNT, SUM, AVG'],
    ['Filter on pivot values', 'HAVING'],
    ['IF, IFS', 'CASE WHEN'],
    ['COUNTIF, SUMIF', 'SUM(CASE WHEN ... END)'],
    ['XLOOKUP', 'JOIN'],
    ['#N/A after a lookup', 'LEFT JOIN ... IS NULL'],
    ['Paste one list under another', 'UNION ALL'],
    ['Helper sheet', 'WITH (a CTE)'],
    ['RANK', 'RANK() OVER (...)'],
    ['Running balance', 'SUM() OVER (ORDER BY ...)'],
    ['Prior-period variance', 'LAG() OVER (ORDER BY ...)'],
    ['Cross-tab PivotTable', 'SUM(CASE WHEN ...) per column'],
    ['Reconciliation', 'Two CTEs joined, compare totals']
  ];

  const DIALECTS = {
    head: ['Task', 'SQLite (this lab)', 'Oracle', 'SQL Server', 'BigQuery', 'PostgreSQL'],
    rows: [
      ['First 10 rows', 'LIMIT 10', 'FETCH FIRST 10 ROWS ONLY', 'SELECT TOP 10 ...', 'LIMIT 10', 'LIMIT 10'],
      ['Year and month', "strftime('%Y-%m', d)", "TO_CHAR(d, 'YYYY-MM')", "FORMAT(d, 'yyyy-MM')", "FORMAT_DATE('%Y-%m', d)", "TO_CHAR(d, 'YYYY-MM')"],
      ['Start of month', "date(d, 'start of month')", "TRUNC(d, 'MM')", 'DATEFROMPARTS(YEAR(d), MONTH(d), 1)', 'DATE_TRUNC(d, MONTH)', "DATE_TRUNC('month', d)"],
      ['Today', "date('now')", 'TRUNC(SYSDATE)', 'CAST(GETDATE() AS date)', 'CURRENT_DATE()', 'CURRENT_DATE'],
      ['Days between dates', 'julianday(a) - julianday(b)', 'a - b', 'DATEDIFF(day, b, a)', 'DATE_DIFF(a, b, DAY)', 'a - b'],
      ['Add 7 days', "date(d, '+7 days')", 'd + 7', 'DATEADD(day, 7, d)', 'DATE_ADD(d, INTERVAL 7 DAY)', "d + INTERVAL '7 days'"],
      ['Stick text together', 'a || b', 'a || b', 'CONCAT(a, b)', 'CONCAT(a, b)', 'a || b'],
      ['Replace NULL', 'COALESCE(x, 0)', 'COALESCE(x, 0) or NVL(x, 0)', 'COALESCE(x, 0) or ISNULL(x, 0)', 'COALESCE(x, 0) or IFNULL(x, 0)', 'COALESCE(x, 0)'],
      ['Whole-number division', '1 / 2 gives 0', '1 / 2 gives 0.5', '1 / 2 gives 0', '1 / 2 gives 0.5', '1 / 2 gives 0'],
      ['Query plan', 'EXPLAIN QUERY PLAN ...', 'EXPLAIN PLAN FOR ...', 'SET SHOWPLAN_ALL ON', 'Execution details in the console', 'EXPLAIN ...']
    ]
  };

  return { GLOSSARY, EXCEL_MAP, DIALECTS };
});
