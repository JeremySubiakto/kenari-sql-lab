/* Level 9: the analyses a collection unit runs every month, then four exams. */
(function (root) {
  /* The five DPD buckets, written the same way in every solution on this level. */
  const bucket = (col) => `CASE
      WHEN ${col} = 0 THEN 'Current'
      WHEN ${col} <= 30 THEN '1-30'
      WHEN ${col} <= 60 THEN '31-60'
      WHEN ${col} <= 90 THEN '61-90'
      ELSE '90+'
    END`;
  const bucketNo = (col) => `CASE
      WHEN ${col} = 0 THEN 0
      WHEN ${col} <= 30 THEN 1
      WHEN ${col} <= 60 THEN 2
      WHEN ${col} <= 90 THEN 3
      ELSE 4
    END`;
  const oneLine = (s) => s.replace(/\s+/g, ' ');
  const B = (col) => oneLine(bucket(col));
  const BN = (col) => oneLine(bucketNo(col));

  /* The checker's own division trap misses a formula holding a dotted alias, so rate missions add this one. */
  const WHOLE_NUMBER_TRAP = { re: /\b100\s*\*|\*\s*100\b(?!\.)/, msg: 'Both sides of this division are whole numbers, so the decimals get dropped. Write <code>100.0</code> to keep them.' };

  /* No usable row in this data sits exactly on a DPD limit, so these slips return the right numbers. requires catches them. */
  const ON_THE_LIMIT = (limits) => {
    const n = limits.join('|');
    const justUnder = limits.map((x) => x - 1).join('|');
    const a = limits[0];
    return {
      re: new RegExp(`^(?![\\s\\S]*(dpd\\w*\\s*\\)?\\s*(>=|<)\\s*(${n})\\b|\\b(${n})\\s*(<=|>)\\s*[\\w.]*dpd|dpd\\w*\\s+BETWEEN\\s+(${n})\\s+AND\\b|dpd\\w*\\s+BETWEEN\\s+\\d+\\s+AND\\s+(${justUnder})\\b))`, 'i'),
      msg: `The numbers match only because no loan in this data sits exactly on a limit. Above ${a} starts at ${a + 1}, and up to ${a} includes ${a}. At work real loans sit on those limits, so write <code>&gt; ${a}</code> or <code>&lt;= ${a}</code>.`
    };
  };

  /* SUM(DISTINCT) only works here because no two of these loans share a balance. Level 6 teaches why it is wrong. */
  const NO_SUM_DISTINCT = { re: /^(?![\s\S]*SUM\s*\(\s*DISTINCT)/i, msg: '<code>SUM(DISTINCT ...)</code> merges different loans that have the same balance. The numbers match only because no two of these loans do. Bring the other table down to one row per loan first.' };

  /* loans.dpd equals the 2026-10 snapshot today, so skipping the self-join returns the right numbers. */
  const OCT_FROM_SNAPSHOT = { re: /'2026-10'/, msg: 'The numbers match because <code>loans.dpd</code> equals the 2026-10 snapshot today. Read the later month from <code>loan_snapshots</code>, so the same query works for any two months.' };

  /* Pieces repeated across the attempts for the matrix and roll rate missions. */
  const MOVES = `FROM loan_snapshots s9 JOIN loan_snapshots s10 ON s10.loan_id = s9.loan_id AND s10.snapshot_month = '2026-10' JOIN loans l ON l.loan_id = s9.loan_id WHERE s9.snapshot_month = '2026-09' AND l.status <> 'Written Off'`;

  /* The same buckets with their limits one day out, for the attempts that must not pass. */
  const B_OFF = (col) => `CASE WHEN ${col} = 0 THEN 'Current' WHEN ${col} < 30 THEN '1-30' WHEN ${col} < 60 THEN '31-60' WHEN ${col} < 90 THEN '61-90' ELSE '90+' END`;
  const BN_OFF = (col) => `CASE WHEN ${col} = 0 THEN 0 WHEN ${col} < 30 THEN 1 WHEN ${col} < 60 THEN 2 WHEN ${col} < 90 THEN 3 ELSE 4 END`;
  const ROLL_RATE_OUT = `SELECT sep_bucket, COUNT(*) AS loans, SUM(rolled) AS rolled, ROUND(100.0 * SUM(rolled) / COUNT(*), 1) AS roll_rate_pct FROM moves WHERE sep_bucket <> '90+' GROUP BY sep_bucket ORDER BY MIN(sep_dpd);`;

  /* The kept test, used by the PTP mission's attempts. */
  const KEPT = `EXISTS (SELECT 1 FROM payments p WHERE p.loan_id = a.loan_id AND p.payment_date BETWEEN a.activity_date AND a.ptp_date)`;

  /* A loan is on the book until the month of its write_off_date. A written-off loan with no date fails the second test, so it stays out. */
  const ON_BOOK = `WHERE l.status <> 'Written Off' OR substr(l.write_off_date, 1, 7) > s.snapshot_month`;

  /* Each exam's parts, so a wrong attempt can break exactly one thing. */
  const PACK_BOOK = (filter) => `SELECT s.snapshot_month, COUNT(*) AS loans, SUM(s.outstanding) AS book_balance, SUM(CASE WHEN s.collectibility >= 3 THEN s.outstanding ELSE 0 END) AS npl_balance, SUM(CASE WHEN s.dpd > 30 THEN s.outstanding ELSE 0 END) AS par_30_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id ${filter} GROUP BY s.snapshot_month`;
  const PACK_OUT = `SELECT b.snapshot_month, b.loans, b.book_balance, b.npl_balance, b.npl_balance - LAG(b.npl_balance) OVER (ORDER BY b.snapshot_month) AS npl_change, ROUND(100.0 * b.par_30_balance / b.book_balance, 2) AS par_30_pct, c.cash_collected FROM book b LEFT JOIN cash c ON c.snapshot_month = b.snapshot_month ORDER BY b.snapshot_month;`;

  const KOL_RULE = `CASE WHEN l.dpd = 0 THEN 1 WHEN l.dpd <= 90 THEN 2 WHEN l.dpd <= 120 THEN 3 WHEN l.dpd <= 180 THEN 4 ELSE 5 END`;
  const PACK_HEAD = `WITH RECURSIVE calendar(run_date) AS (SELECT '2026-01-01' UNION ALL SELECT date(run_date, '+1 day') FROM calendar WHERE run_date < '2026-10-31'), feeds AS (SELECT DISTINCT feed_name FROM batch_runs)`;
  const CHECK_KOL = `SELECT 'kol_vs_dpd' AS check_name, COUNT(*) AS rows_tested, SUM(CASE WHEN l.collectibility <> ${KOL_RULE} THEN 1 ELSE 0 END) AS failed_rows FROM loans l`;
  const CHECK_NO_COLLECTOR = `SELECT 'overdue_no_collector', COUNT(*), SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM loan_assignments g WHERE g.loan_id = l.loan_id AND g.unassigned_date IS NULL) THEN 1 ELSE 0 END) FROM loans l WHERE l.dpd > 0 AND l.status <> 'Written Off'`;
  const CHECK_DOUBLE = `SELECT 'double_assigned_loans', COUNT(*), SUM(CASE WHEN h.active_rows >= 2 THEN 1 ELSE 0 END) FROM (SELECT g.loan_id, COUNT(*) AS active_rows FROM loan_assignments g WHERE g.unassigned_date IS NULL GROUP BY g.loan_id) h`;
  const CHECK_GAPS = `SELECT 'snapshot_gaps', COUNT(*), SUM(CASE WHEN m.months < 10 THEN 1 ELSE 0 END) FROM (SELECT s.loan_id, COUNT(*) AS months FROM loan_snapshots s GROUP BY s.loan_id) m`;
  const CHECK_BREAKS = `SELECT 'balance_breaks', (SELECT COUNT(*) FROM loans), COUNT(*) FROM (SELECT l.loan_id, l.outstanding FROM loans l EXCEPT SELECT s.loan_id, s.outstanding FROM loan_snapshots s WHERE s.snapshot_month = '2026-10') breaks`;
  const CHECK_RUNS = `SELECT 'missing_feed_runs', COUNT(*), SUM(CASE WHEN r.run_id IS NULL THEN 1 ELSE 0 END) FROM calendar d CROSS JOIN feeds f LEFT JOIN batch_runs r ON r.run_date = d.run_date AND r.feed_name = f.feed_name`;
  const CHECK_LOADED = `SELECT 'loaded_above_sent', COUNT(*), SUM(CASE WHEN r.rows_loaded > r.rows_sent THEN 1 ELSE 0 END) FROM batch_runs r`;
  const PACK_CHECKS = [CHECK_KOL, CHECK_NO_COLLECTOR, CHECK_DOUBLE, CHECK_GAPS, CHECK_BREAKS, CHECK_RUNS, CHECK_LOADED];
  /* The whole pack, with one check swapped out when a wrong attempt needs that. */
  const PACK = (swap = {}) => `${PACK_HEAD} ${PACK_CHECKS.map((c, i) => swap[i] || c).join(' UNION ALL ')};`;

  /* The scorecard's measures, each down to one row per collector. */
  const SCORE_CTES = `WITH cases AS (SELECT g.collector_id, COUNT(g.assignment_id) AS active_cases FROM loan_assignments g WHERE g.unassigned_date IS NULL GROUP BY g.collector_id), work AS (SELECT a.collector_id, COUNT(a.activity_id) AS attempts FROM collection_activities a WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit') GROUP BY a.collector_id), kept AS (SELECT a.collector_id, COUNT(a.activity_id) AS kept_promises FROM collection_activities a WHERE a.result = 'PTP' AND a.ptp_date <= '2026-10-31' AND a.ptp_date >= a.activity_date AND ${KEPT} GROUP BY a.collector_id)`;
  const CREDITED = `credited AS (SELECT g.collector_id, SUM(p.amount) AS cash_credited FROM payments p JOIN loan_assignments g ON g.loan_id = p.loan_id AND g.assigned_date <= p.payment_date AND (g.unassigned_date IS NULL OR g.unassigned_date >= p.payment_date) WHERE p.channel = 'Collector' GROUP BY g.collector_id)`;
  const SCORE_JOINS = `FROM collectors k LEFT JOIN cases ca ON ca.collector_id = k.collector_id LEFT JOIN work wk ON wk.collector_id = k.collector_id LEFT JOIN kept kp ON kp.collector_id = k.collector_id LEFT JOIN credited cr ON cr.collector_id = k.collector_id`;
  const SCORE_COLS = `k.team, k.collector_name, COALESCE(ca.active_cases, 0) AS active_cases, COALESCE(wk.attempts, 0) AS attempts, COALESCE(kp.kept_promises, 0) AS kept_promises, COALESCE(cr.cash_credited, 0) AS cash_credited`;

  /* The production bug exam. Each wrong attempt below leaves exactly one of the five bugs in. */
  const BUG_SQL = (o = {}) => {
    const latest = o.latestMax
      ? `latest AS (SELECT a.loan_id, MAX(a.activity_date) AS activity_date, 1 AS rn FROM collection_activities a WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit') GROUP BY a.loan_id)`
      : `latest AS (SELECT a.loan_id, a.activity_date, ROW_NUMBER() OVER (${o.noPartition ? '' : 'PARTITION BY a.loan_id '}ORDER BY a.activity_date DESC, a.activity_id DESC) AS rn FROM collection_activities a WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit'))`;
    const cash = o.fanOut ? '' : `oct_cash AS (SELECT p.loan_id, SUM(p.amount) AS cash FROM payments p WHERE p.payment_date >= '2026-10-01' GROUP BY p.loan_id), `;
    const cashCol = o.fanOut ? 'COALESCE(SUM(p.amount), 0)' : 'COALESCE(SUM(oc.cash), 0)';
    const cashJoin = o.fanOut ? `LEFT JOIN payments p ON p.loan_id = l.loan_id AND p.payment_date >= '2026-10-01'` : `LEFT JOIN oct_cash oc ON oc.loan_id = l.loan_id`;
    const loansOn = o.statusInWhere ? '' : ` AND l.status <> 'Written Off'`;
    const whereExtra = o.statusInWhere ? ` AND l.status <> 'Written Off'` : '';
    const pct = o.avgRatios ? `ROUND(AVG(100.0 * c.stale_cases / c.active_cases) OVER (), 1)` : `ROUND(100.0 * SUM(c.stale_cases) OVER () / SUM(c.active_cases) OVER (), 1)`;
    const list = `SELECT a.collector_id FROM collection_activities a WHERE a.activity_date >= '2026-10-01'`;
    const silent = o.notIn
      ? `CASE WHEN c.collector_id NOT IN (${list}) THEN 1 ELSE 0 END`
      : o.listFilter
        ? `CASE WHEN c.collector_id NOT IN (${list} AND a.collector_id IS NOT NULL) THEN 1 ELSE 0 END`
        : `CASE WHEN NOT EXISTS (SELECT 1 FROM collection_activities a WHERE a.collector_id = c.collector_id AND a.activity_date >= '2026-10-01') THEN 1 ELSE 0 END`;
    return `WITH ${latest}, ${cash}cases AS (SELECT k.collector_id, k.collector_name, COUNT(l.loan_id) AS active_cases, COALESCE(SUM(l.outstanding), 0) AS active_balance, ${cashCol} AS oct_cash, SUM(CASE WHEN l.loan_id IS NOT NULL AND (lc.activity_date IS NULL OR lc.activity_date < '2026-10-15') THEN 1 ELSE 0 END) AS stale_cases FROM collectors k LEFT JOIN loan_assignments g ON g.collector_id = k.collector_id AND g.unassigned_date IS NULL LEFT JOIN loans l ON l.loan_id = g.loan_id${loansOn} LEFT JOIN latest lc ON lc.loan_id = l.loan_id AND lc.rn = 1 ${cashJoin} WHERE k.team = 'Field'${whereExtra} GROUP BY k.collector_id, k.collector_name) SELECT c.collector_name, c.active_cases, c.active_balance, c.oct_cash, c.stale_cases, ${pct} AS team_stale_pct, ${silent} AS silent_in_oct FROM cases c ORDER BY c.active_balance DESC;`;
  };

  (root.KENARI_LEVELS = root.KENARI_LEVELS || []).push({
    n: 9,
    title: 'Collection Analytics and Final Exam',
    rank: 'SQL Pro',
    tagline: 'The numbers a collection unit runs on, then the final exam.',
    goal: 'Build the measures a collection unit reads every month, then show what you can do on your own.',
    terms: {
      'migration matrix': 'A cross-tab showing how many loans moved from each bucket at one date to each bucket at a later date.',
      'contact rate': 'The share of contact attempts that reached someone. Each bank sets its own exact rule.',
      'scorecard': 'A report with several measures side by side, one row per person or team.',
      'arrears': 'Payments that are late and still unpaid.',
      'disbursed': 'Paid out to the borrower.',
      'roll-forward': 'A table that walks a balance from opening to closing, one movement per line.',
      'collection efficiency': 'Cash collected as a percent of the amount due. Each bank sets its own exact rule.'
    },
    lessons: [
      {
        id: '9.1',
        title: 'PAR 30 and PAR 90 by branch',
        newIdea: 'PAR is the balance of loans past a set number of days, divided by the total balance.',
        from: 'Citra, Head of Collection',
        teach: `<p>[[PAR]] stands for portfolio at risk, where portfolio means the [[book]]. PAR 30 is the outstanding balance of loans more than 30 days past due, as a percent of all outstanding balance. PAR 90 uses 90 days instead. The full balance of a late loan counts, so a Rp 100 million loan with one late Rp 2 million installment counts as Rp 100 million at risk.</p><p>Written-off loans stay out here, because they have left the balance sheet.</p>`,
        ex: [
          [`SELECT product,`, `For each product, show its name,`],
          [`  SUM(outstanding) AS total_outstanding,`, `its total balance,`],
          [`  ROUND(100.0 * SUM(CASE WHEN dpd > 60 THEN outstanding ELSE 0 END) / SUM(outstanding), 2) AS par_60_pct`, `and the percent of that balance more than 60 days late,`],
          [`FROM loans`, `from the loans table,`],
          [`WHERE status <> 'Written Off'`, `leaving out written-off loans,`],
          [`GROUP BY product`, `with one row per product`],
          [`ORDER BY par_60_pct DESC;`, `and the highest PAR first.`]
        ],
        exNote: `This is a general definition. Your bank's may differ.`,
        bridge: 'Like SUMIF of the late balances divided by SUM of all balances, for each branch.',
        task: `Which branches carry the most risk? For each <code>branch_name</code>, show <code>total_outstanding</code>, <code>par_30_pct</code> (<code>dpd</code> above 30) and <code>par_90_pct</code> (<code>dpd</code> above 90), both rounded to 2 decimals. Leave out written-off loans. Highest PAR 30 first.`,
        solution: `SELECT b.branch_name,
  SUM(l.outstanding) AS total_outstanding,
  ROUND(100.0 * SUM(CASE WHEN l.dpd > 30 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) AS par_30_pct,
  ROUND(100.0 * SUM(CASE WHEN l.dpd > 90 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) AS par_90_pct
FROM loans l
JOIN branches b
  ON b.branch_id = l.branch_id
WHERE l.status <> 'Written Off'
GROUP BY b.branch_name
ORDER BY par_30_pct DESC;`,
        ordered: 'par_30_pct',
        altSolutions: [
          `WITH totals AS (SELECT l.branch_id, SUM(l.outstanding) AS total_outstanding, SUM(CASE WHEN l.dpd > 30 THEN l.outstanding ELSE 0 END) AS late_30, SUM(CASE WHEN l.dpd > 90 THEN l.outstanding ELSE 0 END) AS late_90 FROM loans l WHERE l.status <> 'Written Off' GROUP BY l.branch_id) SELECT b.branch_name, t.total_outstanding, ROUND(100.0 * t.late_30 / t.total_outstanding, 2) AS par_30_pct, ROUND(100.0 * t.late_90 / t.total_outstanding, 2) AS par_90_pct FROM totals t JOIN branches b ON b.branch_id = t.branch_id ORDER BY par_30_pct DESC;`,
          `SELECT b.branch_name, SUM(l.outstanding) AS total_outstanding, ROUND(SUM(l.outstanding) FILTER (WHERE l.dpd > 30) * 100.0 / SUM(l.outstanding), 2) AS par_30_pct, ROUND(SUM(l.outstanding) FILTER (WHERE l.dpd > 90) * 100.0 / SUM(l.outstanding), 2) AS par_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.status <> 'Written Off' GROUP BY b.branch_id, b.branch_name ORDER BY 3 DESC;`
        ],
        precision: 4,
        requires: [ON_THE_LIMIT([30, 90])],
        wrong: [
          `SELECT b.branch_name, SUM(l.outstanding) AS total_outstanding, ROUND(100.0 * SUM(CASE WHEN l.dpd > 30 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) AS par_30_pct, ROUND(100.0 * SUM(CASE WHEN l.dpd > 90 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) AS par_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id GROUP BY b.branch_name ORDER BY par_30_pct DESC;`,
          `SELECT b.branch_name, SUM(l.outstanding) AS total_outstanding, ROUND(100.0 * SUM(CASE WHEN l.dpd > 30 THEN 1 ELSE 0 END) / COUNT(*), 2) AS par_30_pct, ROUND(100.0 * SUM(CASE WHEN l.dpd > 90 THEN 1 ELSE 0 END) / COUNT(*), 2) AS par_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.status <> 'Written Off' GROUP BY b.branch_name ORDER BY par_30_pct DESC;`,
          `SELECT b.branch_name, SUM(l.outstanding) AS total_outstanding, 100 * SUM(CASE WHEN l.dpd > 30 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding) AS par_30_pct, 100 * SUM(CASE WHEN l.dpd > 90 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding) AS par_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.status <> 'Written Off' GROUP BY b.branch_name ORDER BY par_30_pct DESC;`,
          `SELECT b.branch_name, SUM(l.outstanding) AS total_outstanding, ROUND(100.0 * SUM(CASE WHEN l.dpd > 30 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) AS par_30_pct, ROUND(100.0 * SUM(CASE WHEN l.dpd > 90 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) AS par_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.status <> 'Written Off' AND l.dpd > 30 GROUP BY b.branch_name ORDER BY par_30_pct DESC;`,
          `SELECT b.branch_name, SUM(l.outstanding) AS total_outstanding, ROUND(100.0 * SUM(CASE WHEN l.dpd > 30 THEN l.outstanding ELSE 0 END) / (SELECT SUM(outstanding) FROM loans WHERE status <> 'Written Off'), 2) AS par_30_pct, ROUND(100.0 * SUM(CASE WHEN l.dpd > 90 THEN l.outstanding ELSE 0 END) / (SELECT SUM(outstanding) FROM loans WHERE status <> 'Written Off'), 2) AS par_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.status <> 'Written Off' GROUP BY b.branch_name ORDER BY par_30_pct DESC;`,
          `SELECT b.branch_name, SUM(l.outstanding) AS total_outstanding, ROUND(100.0 * SUM(CASE WHEN l.dpd >= 30 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) AS par_30_pct, ROUND(100.0 * SUM(CASE WHEN l.dpd >= 90 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2) AS par_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.status <> 'Written Off' GROUP BY b.branch_name ORDER BY par_30_pct DESC;`,
          `SELECT b.branch_name, SUM(l.outstanding) AS total_outstanding, 100.0 * SUM(CASE WHEN l.dpd > 30 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding) AS par_30_pct, 100.0 * SUM(CASE WHEN l.dpd > 90 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding) AS par_90_pct FROM loans l JOIN branches b ON b.branch_id = l.branch_id WHERE l.status <> 'Written Off' GROUP BY b.branch_name ORDER BY par_30_pct DESC;`
        ],
        traps: [
          { re: /WHERE[^;]*\bdpd\s*>\s*\d/i, msg: 'A <code>dpd</code> test in <code>WHERE</code> removes the healthy balance too, so the bottom of the fraction shrinks. Keep the test inside the <code>CASE</code>.' },
          { re: /THEN\s+1\b/i, msg: 'This counts loans, and PAR is about balance. Add up <code>outstanding</code> inside the <code>CASE</code>, and divide by <code>SUM(outstanding)</code>.' },
          { re: /\(\s*SELECT\s+SUM/i, msg: 'Each branch needs its own total on the bottom of the fraction, so a total for the whole book makes every percent too small.' },
          { re: /^(?![\s\S]*Written Off)/i, msg: 'Written-off loans have left the balance sheet, so they stay out of PAR. Add <code>status &lt;&gt; \'Written Off\'</code> in <code>WHERE</code>.' },
          WHOLE_NUMBER_TRAP
        ],
        hints: [
          `PAR is a fraction. The top is the balance on late loans, and the bottom is the balance on all loans in that branch.`,
          `Join <code>loans</code> to <code>branches</code>, remove written-off loans in <code>WHERE</code>, and group by <code>branch_name</code>. Keep the <code>dpd</code> test inside the <code>CASE</code>.`,
          `The PAR 30 column is <code>ROUND(100.0 * SUM(CASE WHEN l.dpd &gt; 30 THEN l.outstanding ELSE 0 END) / SUM(l.outstanding), 2)</code>. PAR 90 changes one number.`
        ],
        win: `KC Semarang Simpang Lima tops PAR 30 at 16%, and KC Bandung Dago has the worst PAR 90 at 11.43%. The two answer different questions, since PAR 30 warns early and PAR 90 shows what has already turned bad.`,
        pattern: { sql: `ROUND(100.0 * SUM(CASE WHEN dpd > 30 THEN outstanding ELSE 0 END)\n  / SUM(outstanding), 2) AS par_30_pct`, note: 'PAR: late balance as a percent of total balance' }
      },
      {
        id: '9.2',
        title: 'Bucket migration matrix',
        newIdea: 'A migration matrix counts loans by where they started and where they ended.',
        from: 'Dimas, Portfolio Analyst',
        teach: `<p>A [[migration matrix]] shows if the book is getting better or worse, and where. Each row is where loans started, and each column is where they ended.</p><p>The self-join is written for you. Label both months with a [[bucket]], then pivot with <code>SUM(CASE ...)</code>. The starter sorts with <code>MIN</code> of the starting <code>dpd</code>, because labels do not sort in bucket order.</p>`,
        ex: [
          [`WITH moves AS (`, `First make a step called moves`],
          [`  SELECT s8.collectibility AS kol_aug,`, `with each loan's Kol in August`],
          [`    s9.collectibility AS kol_sep`, `and its Kol in September,`],
          [`  FROM loan_snapshots s8`, `starting from the snapshot rows`],
          [`  JOIN loan_snapshots s9 ON s9.loan_id = s8.loan_id AND s9.snapshot_month = '2026-09'`, `paired with the same loan's September row`],
          [`  JOIN loans l ON l.loan_id = s8.loan_id`, `and its row in loans,`],
          [`  WHERE s8.snapshot_month = '2026-08' AND l.status <> 'Written Off'`, `using August as the start and no written-off loans,`],
          [`)`, `and then,`],
          [`SELECT kol_aug,`, `for each August grade,`],
          [`  SUM(CASE WHEN kol_sep <= 2 THEN 1 ELSE 0 END) AS to_kol_1_2,`, `count the loans that ended in Kol 1 or 2,`],
          [`  SUM(CASE WHEN kol_sep = 3 THEN 1 ELSE 0 END) AS to_kol_3,`, `those that ended in Kol 3,`],
          [`  SUM(CASE WHEN kol_sep = 4 THEN 1 ELSE 0 END) AS to_kol_4,`, `those that ended in Kol 4`],
          [`  SUM(CASE WHEN kol_sep = 5 THEN 1 ELSE 0 END) AS to_kol_5`, `and those that ended in Kol 5,`],
          [`FROM moves`, `reading from that step,`],
          [`GROUP BY kol_aug`, `with one row per August grade`],
          [`ORDER BY kol_aug;`, `from best grade to worst.`]
        ],
        exNote: `Read one row. Of the Kol 3 loans in August, 2 stayed in Kol 3 and 9 moved to Kol 4. This is a general definition. Your bank's may differ.`,
        bridge: 'Like a PivotTable with last month in Rows, this month in Columns, and a count in Values.',
        task: `Did the book get worse last month? Show how loans moved from the 2026-09 to the 2026-10 snapshot, no written-off loans. One row per <code>sep_bucket</code>, in order from Current to 90+. Columns <code>to_current</code>, <code>to_1_30</code>, <code>to_31_60</code>, <code>to_61_90</code>, <code>to_90_plus</code> hold loan counts. Labels: <code>dpd</code> 0 is <code>Current</code>, then <code>1-30</code>, <code>31-60</code>, <code>61-90</code>, <code>90+</code>.`,
        starter: `WITH moves AS (
  SELECT s9.dpd AS sep_dpd,
    -- add sep_bucket and oct_bucket here, one CASE for each month
  FROM loan_snapshots s9
  JOIN loan_snapshots s10
    ON s10.loan_id = s9.loan_id
    AND s10.snapshot_month = '2026-10'
  JOIN loans l
    ON l.loan_id = s9.loan_id
  WHERE s9.snapshot_month = '2026-09'
    AND l.status <> 'Written Off'
)
SELECT sep_bucket,
  -- add one SUM(CASE ...) for each column here
FROM moves
GROUP BY sep_bucket
ORDER BY MIN(sep_dpd);`,
        solution: `WITH moves AS (
  SELECT s9.dpd AS sep_dpd,
    ${bucket('s9.dpd')} AS sep_bucket,
    ${bucket('s10.dpd')} AS oct_bucket
  FROM loan_snapshots s9
  JOIN loan_snapshots s10
    ON s10.loan_id = s9.loan_id
    AND s10.snapshot_month = '2026-10'
  JOIN loans l
    ON l.loan_id = s9.loan_id
  WHERE s9.snapshot_month = '2026-09'
    AND l.status <> 'Written Off'
)
SELECT sep_bucket,
  SUM(CASE WHEN oct_bucket = 'Current' THEN 1 ELSE 0 END) AS to_current,
  SUM(CASE WHEN oct_bucket = '1-30' THEN 1 ELSE 0 END) AS to_1_30,
  SUM(CASE WHEN oct_bucket = '31-60' THEN 1 ELSE 0 END) AS to_31_60,
  SUM(CASE WHEN oct_bucket = '61-90' THEN 1 ELSE 0 END) AS to_61_90,
  SUM(CASE WHEN oct_bucket = '90+' THEN 1 ELSE 0 END) AS to_90_plus
FROM moves
GROUP BY sep_bucket
ORDER BY MIN(sep_dpd);`,
        ordered: 'sep_bucket',
        altSolutions: [
          `SELECT ${B('s9.dpd')} AS sep_bucket, SUM(CASE WHEN s10.dpd = 0 THEN 1 ELSE 0 END) AS to_current, SUM(CASE WHEN s10.dpd BETWEEN 1 AND 30 THEN 1 ELSE 0 END) AS to_1_30, SUM(CASE WHEN s10.dpd BETWEEN 31 AND 60 THEN 1 ELSE 0 END) AS to_31_60, SUM(CASE WHEN s10.dpd BETWEEN 61 AND 90 THEN 1 ELSE 0 END) AS to_61_90, SUM(CASE WHEN s10.dpd > 90 THEN 1 ELSE 0 END) AS to_90_plus ${MOVES} GROUP BY sep_bucket ORDER BY MIN(s9.dpd);`,
          `WITH moves AS (SELECT ${B('s9.dpd')} AS sep_bucket, ${B('s10.dpd')} AS oct_bucket ${MOVES}) SELECT sep_bucket, COUNT(*) FILTER (WHERE oct_bucket = 'Current') AS to_current, COUNT(*) FILTER (WHERE oct_bucket = '1-30') AS to_1_30, COUNT(*) FILTER (WHERE oct_bucket = '31-60') AS to_31_60, COUNT(*) FILTER (WHERE oct_bucket = '61-90') AS to_61_90, COUNT(*) FILTER (WHERE oct_bucket = '90+') AS to_90_plus FROM moves GROUP BY sep_bucket ORDER BY CASE sep_bucket WHEN 'Current' THEN 0 WHEN '1-30' THEN 1 WHEN '31-60' THEN 2 WHEN '61-90' THEN 3 ELSE 4 END;`
        ],
        requires: [ON_THE_LIMIT([30, 60, 90]), OCT_FROM_SNAPSHOT],
        wrong: [
          `SELECT ${B('s9.dpd')} AS sep_bucket, SUM(CASE WHEN s10.dpd = 0 THEN 1 ELSE 0 END) AS to_current, SUM(CASE WHEN s10.dpd BETWEEN 1 AND 30 THEN 1 ELSE 0 END) AS to_1_30, SUM(CASE WHEN s10.dpd BETWEEN 31 AND 60 THEN 1 ELSE 0 END) AS to_31_60, SUM(CASE WHEN s10.dpd BETWEEN 61 AND 90 THEN 1 ELSE 0 END) AS to_61_90, SUM(CASE WHEN s10.dpd > 90 THEN 1 ELSE 0 END) AS to_90_plus FROM loan_snapshots s9 JOIN loan_snapshots s10 ON s10.loan_id = s9.loan_id AND s10.snapshot_month = '2026-10' WHERE s9.snapshot_month = '2026-09' GROUP BY sep_bucket ORDER BY MIN(s9.dpd);`,
          `SELECT ${B('s9.dpd')} AS sep_bucket, SUM(CASE WHEN s10.dpd = 0 THEN 1 ELSE 0 END) AS to_current, SUM(CASE WHEN s10.dpd BETWEEN 1 AND 30 THEN 1 ELSE 0 END) AS to_1_30, SUM(CASE WHEN s10.dpd BETWEEN 31 AND 60 THEN 1 ELSE 0 END) AS to_31_60, SUM(CASE WHEN s10.dpd BETWEEN 61 AND 90 THEN 1 ELSE 0 END) AS to_61_90, SUM(CASE WHEN s10.dpd > 90 THEN 1 ELSE 0 END) AS to_90_plus ${MOVES} GROUP BY sep_bucket ORDER BY sep_bucket;`,
          `SELECT ${B('s10.dpd')} AS sep_bucket, SUM(CASE WHEN s9.dpd = 0 THEN 1 ELSE 0 END) AS to_current, SUM(CASE WHEN s9.dpd BETWEEN 1 AND 30 THEN 1 ELSE 0 END) AS to_1_30, SUM(CASE WHEN s9.dpd BETWEEN 31 AND 60 THEN 1 ELSE 0 END) AS to_31_60, SUM(CASE WHEN s9.dpd BETWEEN 61 AND 90 THEN 1 ELSE 0 END) AS to_61_90, SUM(CASE WHEN s9.dpd > 90 THEN 1 ELSE 0 END) AS to_90_plus ${MOVES} GROUP BY sep_bucket ORDER BY MIN(s10.dpd);`,
          `SELECT ${B('s9.dpd')} AS sep_bucket, SUM(CASE WHEN l.dpd = 0 THEN 1 ELSE 0 END) AS to_current, SUM(CASE WHEN l.dpd BETWEEN 1 AND 29 THEN 1 ELSE 0 END) AS to_1_30, SUM(CASE WHEN l.dpd BETWEEN 30 AND 60 THEN 1 ELSE 0 END) AS to_31_60, SUM(CASE WHEN l.dpd > 60 THEN 1 ELSE 0 END) AS to_61_90, 0 AS to_90_plus ${MOVES} GROUP BY sep_bucket ORDER BY MIN(s9.dpd);`,
          `WITH moves AS (SELECT s9.dpd AS sep_dpd, ${B_OFF('s9.dpd')} AS sep_bucket, ${B_OFF('s10.dpd')} AS oct_bucket ${MOVES}) SELECT sep_bucket, SUM(CASE WHEN oct_bucket = 'Current' THEN 1 ELSE 0 END) AS to_current, SUM(CASE WHEN oct_bucket = '1-30' THEN 1 ELSE 0 END) AS to_1_30, SUM(CASE WHEN oct_bucket = '31-60' THEN 1 ELSE 0 END) AS to_31_60, SUM(CASE WHEN oct_bucket = '61-90' THEN 1 ELSE 0 END) AS to_61_90, SUM(CASE WHEN oct_bucket = '90+' THEN 1 ELSE 0 END) AS to_90_plus FROM moves GROUP BY sep_bucket ORDER BY MIN(sep_dpd);`,
          `WITH moves AS (SELECT s9.dpd AS sep_dpd, ${B('s9.dpd')} AS sep_bucket, ${B('l.dpd')} AS oct_bucket FROM loan_snapshots s9 JOIN loans l ON l.loan_id = s9.loan_id WHERE s9.snapshot_month = '2026-09' AND l.status <> 'Written Off') SELECT sep_bucket, SUM(CASE WHEN oct_bucket = 'Current' THEN 1 ELSE 0 END) AS to_current, SUM(CASE WHEN oct_bucket = '1-30' THEN 1 ELSE 0 END) AS to_1_30, SUM(CASE WHEN oct_bucket = '31-60' THEN 1 ELSE 0 END) AS to_31_60, SUM(CASE WHEN oct_bucket = '61-90' THEN 1 ELSE 0 END) AS to_61_90, SUM(CASE WHEN oct_bucket = '90+' THEN 1 ELSE 0 END) AS to_90_plus FROM moves GROUP BY sep_bucket ORDER BY MIN(sep_dpd);`
        ],
        traps: [
          { re: /ORDER\s+BY\s+(\w+\.)?sep_bucket/i, msg: 'Sorting by the label puts <code>Current</code> last, because digits sort before letters. Sort by <code>MIN</code> of the September <code>dpd</code>.' },
          { re: /^(?![\s\S]*Written Off)/i, msg: 'Written-off loans are still in the snapshots. Join to <code>loans</code> and remove them with <code>status &lt;&gt; \'Written Off\'</code>.' },
          { re: /^(?![\s\S]*'2026-10')/i, msg: 'This needs two rows per loan, September and October. Join <code>loan_snapshots</code> to itself on <code>loan_id</code>, and put the October month in the <code>ON</code>.' }
        ],
        hints: [
          `The starter pairs each loan's September and October rows. Add two labels to the <code>moves</code> step.`,
          `Write one <code>CASE</code> on <code>s9.dpd</code> named <code>sep_bucket</code>, and the same <code>CASE</code> on <code>s10.dpd</code> named <code>oct_bucket</code>.`,
          `Under <code>SELECT sep_bucket,</code> add one <code>SUM(CASE WHEN oct_bucket = 'Current' THEN 1 ELSE 0 END) AS to_current</code> for each column.`
        ],
        win: `Read the matrix along the diagonal, where loans stayed put, with cells to its right worse and cells to its left better. All 5 loans that went from 90+ to Current are [[Restructured|restructuring]], so ask whether they paid their late amounts before you report this as good news.`,
        atWork: `Oracle, SQL Server and BigQuery have a <code>PIVOT</code> keyword. <code>SUM(CASE ...)</code> works on all of them and on PostgreSQL, so it is the safe one to know. New loan terms can reset the days past due, so a restructured loan at Current may not have paid. This filter also uses today's status, so the 5 loans written off on 31 October drop out of the 90+ row. Real matrices usually show write-off as its own end column, and pick the starting loans by their status at the start date.`,
        pattern: { sql: `WITH moves AS (\n  -- one row per loan: start_bucket, end_bucket\n)\nSELECT start_bucket,\n  SUM(CASE WHEN end_bucket = 'A' THEN 1 ELSE 0 END) AS to_a,\n  SUM(CASE WHEN end_bucket = 'B' THEN 1 ELSE 0 END) AS to_b\nFROM moves\nGROUP BY start_bucket;`, note: 'Migration matrix: start as rows, end as columns' }
      },
      {
        id: '9.3',
        title: 'Roll rate per bucket',
        newIdea: 'Number the buckets, so "moved to a worse bucket" becomes a plain greater-than.',
        from: 'Nadia, Credit Risk',
        teach: `<p>A [[roll rate]] takes the loans that started in a bucket and asks what share moved to any worse bucket by the next month.</p><p>Text labels cannot say which bucket is worse. So keep a number beside each label, from 0 for Current up to 4 for 90+. Worse then means the October number is greater than the September number.</p>`,
        ex: [
          [`WITH moves AS (`, `First make a step called moves`],
          [`  SELECT CASE WHEN s8.dpd = 0 THEN 'Clean' WHEN s8.dpd <= 90 THEN 'Late' ELSE 'Bad' END AS stage,`, `with each loan's August stage,`],
          [`    CASE WHEN s8.dpd = 0 THEN 0 WHEN s8.dpd <= 90 THEN 1 ELSE 2 END AS aug_no,`, `the matching number for August`],
          [`    CASE WHEN s9.dpd = 0 THEN 0 WHEN s9.dpd <= 90 THEN 1 ELSE 2 END AS sep_no`, `and the number for September,`],
          [`  FROM loan_snapshots s8`, `starting from the snapshot rows`],
          [`  JOIN loan_snapshots s9 ON s9.loan_id = s8.loan_id AND s9.snapshot_month = '2026-09'`, `paired with the same loan's September row`],
          [`  JOIN loans l ON l.loan_id = s8.loan_id`, `and its row in loans,`],
          [`  WHERE s8.snapshot_month = '2026-08' AND l.status <> 'Written Off'`, `using August as the start and no written-off loans,`],
          [`)`, `and then,`],
          [`SELECT stage,`, `for each August stage, show its name,`],
          [`  COUNT(*) AS loans,`, `how many loans started there,`],
          [`  SUM(CASE WHEN sep_no > aug_no THEN 1 ELSE 0 END) AS rolled`, `and how many had a higher number a month later,`],
          [`FROM moves`, `reading from that step,`],
          [`GROUP BY stage`, `with one row per stage,`],
          [`ORDER BY MIN(aug_no);`, `from best stage to worst.`]
        ],
        exNote: `This is a general definition. Your bank's may differ.`,
        bridge: 'Like adding a sort-order helper column in Excel, so that a comparison works on numbers.',
        task: `Which bucket should we call first? Roll rates from the 2026-09 to the 2026-10 snapshot, no written-off loans. Buckets: <code>Current</code>, <code>1-30</code>, <code>31-60</code>, <code>61-90</code>, <code>90+</code>. One row per <code>sep_bucket</code> in that order, leaving out 90+ since nothing is worse: <code>loans</code>, <code>rolled</code> (now in any worse bucket), <code>roll_rate_pct</code> (percent, 1 decimal).`,
        starter: `WITH moves AS (
  SELECT
    -- add sep_bucket, sep_no and oct_no here
  FROM loan_snapshots s9
  JOIN loan_snapshots s10
    ON s10.loan_id = s9.loan_id
    AND s10.snapshot_month = '2026-10'
  JOIN loans l
    ON l.loan_id = s9.loan_id
  WHERE s9.snapshot_month = '2026-09'
    AND l.status <> 'Written Off'
)
-- read from moves here, with one row per sep_bucket`,
        solution: `WITH moves AS (
  SELECT ${bucket('s9.dpd')} AS sep_bucket,
    ${bucketNo('s9.dpd')} AS sep_no,
    ${bucketNo('s10.dpd')} AS oct_no
  FROM loan_snapshots s9
  JOIN loan_snapshots s10
    ON s10.loan_id = s9.loan_id
    AND s10.snapshot_month = '2026-10'
  JOIN loans l
    ON l.loan_id = s9.loan_id
  WHERE s9.snapshot_month = '2026-09'
    AND l.status <> 'Written Off'
)
SELECT sep_bucket,
  COUNT(*) AS loans,
  SUM(CASE WHEN oct_no > sep_no THEN 1 ELSE 0 END) AS rolled,
  ROUND(100.0 * SUM(CASE WHEN oct_no > sep_no THEN 1 ELSE 0 END) / COUNT(*), 1) AS roll_rate_pct
FROM moves
WHERE sep_no < 4
GROUP BY sep_bucket
ORDER BY MIN(sep_no);`,
        ordered: 'sep_bucket',
        altSolutions: [
          `SELECT ${B('s9.dpd')} AS sep_bucket, COUNT(*) AS loans, SUM(CASE WHEN ${BN('s10.dpd')} > ${BN('s9.dpd')} THEN 1 ELSE 0 END) AS rolled, ROUND(100.0 * SUM(CASE WHEN ${BN('s10.dpd')} > ${BN('s9.dpd')} THEN 1 ELSE 0 END) / COUNT(*), 1) AS roll_rate_pct ${MOVES} AND s9.dpd <= 90 GROUP BY sep_bucket ORDER BY MIN(s9.dpd);`,
          `WITH moves AS (SELECT s9.dpd AS d9, s10.dpd AS d10 ${MOVES} AND s9.dpd <= 90), flagged AS (SELECT d9, ${B('d9')} AS sep_bucket, CASE WHEN (d9 = 0 AND d10 > 0) OR (d9 BETWEEN 1 AND 30 AND d10 > 30) OR (d9 BETWEEN 31 AND 60 AND d10 > 60) OR (d9 BETWEEN 61 AND 90 AND d10 > 90) THEN 1 ELSE 0 END AS rolled FROM moves) SELECT sep_bucket, COUNT(*) AS loans, SUM(rolled) AS rolled, ROUND(100.0 * SUM(rolled) / COUNT(*), 1) AS roll_rate_pct FROM flagged GROUP BY sep_bucket ORDER BY MIN(d9);`,
          `WITH bucketed AS (SELECT s.snapshot_month, s.loan_id, ${B('s.dpd')} AS dpd_bucket, ${BN('s.dpd')} AS bucket_no FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE l.status <> 'Written Off') SELECT sep.dpd_bucket AS sep_bucket, COUNT(*) AS loans, SUM(CASE WHEN oct.bucket_no > sep.bucket_no THEN 1 ELSE 0 END) AS rolled, ROUND(100.0 * SUM(CASE WHEN oct.bucket_no > sep.bucket_no THEN 1 ELSE 0 END) / COUNT(*), 1) AS roll_rate_pct FROM bucketed sep JOIN bucketed oct ON oct.loan_id = sep.loan_id AND oct.snapshot_month = '2026-10' WHERE sep.snapshot_month = '2026-09' AND sep.dpd_bucket <> '90+' GROUP BY sep.dpd_bucket, sep.bucket_no ORDER BY sep.bucket_no;`
        ],
        requires: [
          { re: /^(?![\s\S]*dpd\w*\s*>\s*[\w.]*dpd)/i, msg: 'DPD going up does not always mean a worse bucket, since a loan can go from 10 to 25 days and stay in 1-30. The numbers match only because no loan here does that. Compare bucket numbers.' },
          { re: /^(?![\s\S]*(\+\s*1\b|-\s*[\w.]+\s*=\s*1\b|\bEND\s*=\s*1\b))/i, msg: 'A roll is a move to any worse bucket, and a loan can skip one. The numbers match only because no loan here does that. Use <code>&gt;</code> on the bucket numbers.' },
          ON_THE_LIMIT([30, 60, 90]),
          OCT_FROM_SNAPSHOT
        ],
        wrong: [
          `SELECT ${B('s9.dpd')} AS sep_bucket, COUNT(*) AS loans, SUM(CASE WHEN ${B('s10.dpd')} <> ${B('s9.dpd')} THEN 1 ELSE 0 END) AS rolled, ROUND(100.0 * SUM(CASE WHEN ${B('s10.dpd')} <> ${B('s9.dpd')} THEN 1 ELSE 0 END) / COUNT(*), 1) AS roll_rate_pct ${MOVES} AND s9.dpd <= 90 GROUP BY sep_bucket ORDER BY MIN(s9.dpd);`,
          `SELECT ${B('s9.dpd')} AS sep_bucket, COUNT(*) AS loans, SUM(CASE WHEN ${BN('s10.dpd')} > ${BN('s9.dpd')} THEN 1 ELSE 0 END) AS rolled, ROUND(100.0 * SUM(CASE WHEN ${BN('s10.dpd')} > ${BN('s9.dpd')} THEN 1 ELSE 0 END) / COUNT(*), 1) AS roll_rate_pct ${MOVES} GROUP BY sep_bucket ORDER BY MIN(s9.dpd);`,
          `SELECT ${B('s9.dpd')} AS sep_bucket, COUNT(*) AS loans, SUM(CASE WHEN ${BN('s10.dpd')} > ${BN('s9.dpd')} THEN 1 ELSE 0 END) AS rolled, 100 * SUM(CASE WHEN ${BN('s10.dpd')} > ${BN('s9.dpd')} THEN 1 ELSE 0 END) / COUNT(*) AS roll_rate_pct ${MOVES} AND s9.dpd <= 90 GROUP BY sep_bucket ORDER BY MIN(s9.dpd);`,
          `WITH moves AS (SELECT s9.dpd AS sep_dpd, ${B('s9.dpd')} AS sep_bucket, CASE WHEN s10.dpd > s9.dpd THEN 1 ELSE 0 END AS rolled ${MOVES}) ${ROLL_RATE_OUT}`,
          `WITH moves AS (SELECT s9.dpd AS sep_dpd, ${B('s9.dpd')} AS sep_bucket, CASE WHEN ${BN('s10.dpd')} = ${BN('s9.dpd')} + 1 THEN 1 ELSE 0 END AS rolled ${MOVES}) ${ROLL_RATE_OUT}`,
          `WITH moves AS (SELECT s9.dpd AS sep_dpd, ${B_OFF('s9.dpd')} AS sep_bucket, CASE WHEN ${BN_OFF('s10.dpd')} > ${BN_OFF('s9.dpd')} THEN 1 ELSE 0 END AS rolled ${MOVES}) ${ROLL_RATE_OUT}`,
          `WITH moves AS (SELECT s9.dpd AS sep_dpd, ${B('s9.dpd')} AS sep_bucket, CASE WHEN ${BN('l.dpd')} > ${BN('s9.dpd')} THEN 1 ELSE 0 END AS rolled FROM loan_snapshots s9 JOIN loans l ON l.loan_id = s9.loan_id WHERE s9.snapshot_month = '2026-09' AND l.status <> 'Written Off') ${ROLL_RATE_OUT}`
        ],
        traps: [
          { re: /<>\s*(sep|s9|\w*)\.?(dpd_bucket|sep_bucket)|(oct_bucket|dpd_bucket)\s*<>\s*\w*\.?(sep_bucket|dpd_bucket)/i, msg: 'A different bucket can also be a better bucket. A roll rate only counts moves to a worse one, so compare bucket numbers with <code>&gt;</code>.' },
          { re: /END\s*<>\s*CASE/i, msg: 'A different bucket can also be a better bucket. A roll rate only counts moves to a worse one, so compare bucket numbers with <code>&gt;</code>.' },
          { re: /^(?![\s\S]*(<>\s*'90\+'|\b(AND|WHERE)\s+(\w+\.)?\w*dpd\s*<=\s*90|_no\s*(<\s*4|<=\s*3)))/i, msg: 'Nothing is worse than 90+, so that bucket has no roll rate. Leave its row out in <code>WHERE</code>.' },
          WHOLE_NUMBER_TRAP
        ],
        hints: [
          `The starter holds the same join as the matrix mission. Add <code>sep_bucket</code>, <code>sep_no</code> and <code>oct_no</code> where the comment is.`,
          `Number the buckets from 0 for Current to 4 for 90+. Write one <code>CASE</code> per month, with the same limits as the label.`,
          `Read from <code>moves</code>. Add <code>WHERE sep_no &lt; 4</code>, group by <code>sep_bucket</code>, and sort by <code>MIN(sep_no)</code>.`,
          `The rolled column is <code>SUM(CASE WHEN oct_no &gt; sep_no THEN 1 ELSE 0 END)</code>.`
        ],
        win: `Only 4.6% of Current loans rolled, and 72% of the 1-30 bucket did, so most loans that are a little late get later, which is why teams call them early. Risk teams also multiply roll rates together to estimate future losses.`,
        atWork: `Many banks work out roll rates on balance in place of loan counts, and each bank has its own bucket list.`,
        pattern: { sql: `SUM(CASE WHEN oct_no > sep_no THEN 1 ELSE 0 END) AS rolled`, note: 'Roll rate: numbered buckets turn "worse" into a greater-than' },
      },
      {
        id: '9.4',
        title: 'Cure rate by product',
        newIdea: 'Cure rate is the share of overdue loans that are current one month later.',
        from: 'Fitri, Desk Call lead',
        teach: `<p>A [[cure]] is when an overdue loan becomes current again. Cure rate starts from the loans overdue at one month end, and asks what share show 0 [[DPD]] at the next.</p><p>The bottom of the fraction matters most here. Only loans overdue at the start belong in it, so a loan that was current in both months counts nowhere.</p>`,
        ex: [
          [`SELECT c.employment,`, `For each employment type, show its name,`],
          [`  COUNT(*) AS overdue_aug,`, `how many loans were overdue at the end of August`],
          [`  SUM(CASE WHEN s9.dpd = 0 THEN 1 ELSE 0 END) AS cured_sep`, `and how many of those were current at the end of September,`],
          [`FROM loan_snapshots s8`, `starting from the snapshot rows`],
          [`JOIN loan_snapshots s9 ON s9.loan_id = s8.loan_id AND s9.snapshot_month = '2026-09'`, `paired with the same loan's September row,`],
          [`JOIN loans l ON l.loan_id = s8.loan_id`, `then its loan`],
          [`JOIN customers c ON c.customer_id = l.customer_id`, `and its customer,`],
          [`WHERE s8.snapshot_month = '2026-08'`, `keeping August as the start,`],
          [`  AND s8.dpd > 0`, `only loans overdue at that point,`],
          [`  AND l.status <> 'Written Off'`, `and no written-off loans,`],
          [`GROUP BY c.employment;`, `with one row per employment type.`]
        ],
        exNote: `This is a general definition. Your bank's may differ.`,
        bridge: 'Like taking last month\'s overdue list and marking who has cleared their late payments this month.',
        task: `Which products cure best? Start from loans with <code>dpd</code> above 0 in the 2026-09 snapshot, not written off. Per <code>product</code>, show <code>overdue_sep</code>, <code>cured_oct</code> (<code>dpd</code> is 0 in the 2026-10 snapshot) and <code>cure_rate_pct</code> (percent, 1 decimal). Highest rate first.`,
        solution: `SELECT l.product,
  COUNT(*) AS overdue_sep,
  SUM(CASE WHEN s10.dpd = 0 THEN 1 ELSE 0 END) AS cured_oct,
  ROUND(100.0 * SUM(CASE WHEN s10.dpd = 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS cure_rate_pct
FROM loan_snapshots s9
JOIN loan_snapshots s10
  ON s10.loan_id = s9.loan_id
  AND s10.snapshot_month = '2026-10'
JOIN loans l
  ON l.loan_id = s9.loan_id
WHERE s9.snapshot_month = '2026-09'
  AND s9.dpd > 0
  AND l.status <> 'Written Off'
GROUP BY l.product
ORDER BY cure_rate_pct DESC;`,
        ordered: 'cure_rate_pct',
        altSolutions: [
          `WITH overdue AS (SELECT s9.loan_id FROM loan_snapshots s9 JOIN loans l ON l.loan_id = s9.loan_id WHERE s9.snapshot_month = '2026-09' AND s9.dpd > 0 AND l.status <> 'Written Off'), cured AS (SELECT o.loan_id FROM overdue o JOIN loan_snapshots s10 ON s10.loan_id = o.loan_id WHERE s10.snapshot_month = '2026-10' AND s10.dpd = 0) SELECT l.product, COUNT(o.loan_id) AS overdue_sep, COUNT(k.loan_id) AS cured_oct, ROUND(100.0 * COUNT(k.loan_id) / COUNT(o.loan_id), 1) AS cure_rate_pct FROM overdue o JOIN loans l ON l.loan_id = o.loan_id LEFT JOIN cured k ON k.loan_id = o.loan_id GROUP BY l.product ORDER BY cure_rate_pct DESC;`,
          `SELECT l.product, COUNT(*) AS overdue_sep, COUNT(*) FILTER (WHERE s10.dpd = 0) AS cured_oct, ROUND(COUNT(*) FILTER (WHERE s10.dpd = 0) * 100.0 / COUNT(*), 1) AS cure_rate_pct FROM loan_snapshots s9 JOIN loan_snapshots s10 ON s10.loan_id = s9.loan_id JOIN loans l ON l.loan_id = s9.loan_id WHERE s9.snapshot_month = '2026-09' AND s10.snapshot_month = '2026-10' AND s9.dpd > 0 AND l.status <> 'Written Off' GROUP BY l.product ORDER BY 4 DESC;`
        ],
        requires: [OCT_FROM_SNAPSHOT],
        wrong: [
          `SELECT l.product, COUNT(*) AS overdue_sep, SUM(CASE WHEN s10.dpd = 0 THEN 1 ELSE 0 END) AS cured_oct, ROUND(100.0 * SUM(CASE WHEN s10.dpd = 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS cure_rate_pct FROM loan_snapshots s9 JOIN loan_snapshots s10 ON s10.loan_id = s9.loan_id AND s10.snapshot_month = '2026-10' JOIN loans l ON l.loan_id = s9.loan_id WHERE s9.snapshot_month = '2026-09' AND s9.dpd > 0 GROUP BY l.product ORDER BY cure_rate_pct DESC;`,
          `SELECT l.product, COUNT(*) AS overdue_sep, SUM(CASE WHEN s10.dpd = 0 THEN 1 ELSE 0 END) AS cured_oct, ROUND(100.0 * SUM(CASE WHEN s10.dpd = 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS cure_rate_pct FROM loan_snapshots s9 JOIN loan_snapshots s10 ON s10.loan_id = s9.loan_id AND s10.snapshot_month = '2026-10' JOIN loans l ON l.loan_id = s9.loan_id WHERE s9.snapshot_month = '2026-09' AND l.status <> 'Written Off' GROUP BY l.product ORDER BY cure_rate_pct DESC;`,
          `SELECT l.product, COUNT(*) AS overdue_sep, SUM(CASE WHEN s10.dpd = 0 THEN 1 ELSE 0 END) AS cured_oct, ROUND(100.0 * SUM(CASE WHEN s10.dpd = 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS cure_rate_pct FROM loan_snapshots s9 JOIN loan_snapshots s10 ON s10.loan_id = s9.loan_id AND s10.snapshot_month = '2026-10' JOIN loans l ON l.loan_id = s9.loan_id WHERE s9.snapshot_month = '2026-09' AND s9.dpd > 0 AND s10.dpd = 0 AND l.status <> 'Written Off' GROUP BY l.product ORDER BY cure_rate_pct DESC;`,
          `SELECT l.product, COUNT(*) AS overdue_sep, SUM(CASE WHEN l.dpd = 0 THEN 1 ELSE 0 END) AS cured_oct, ROUND(100.0 * SUM(CASE WHEN l.dpd = 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS cure_rate_pct FROM loan_snapshots s9 JOIN loans l ON l.loan_id = s9.loan_id WHERE s9.snapshot_month = '2026-09' AND s9.dpd > 0 AND l.status <> 'Written Off' GROUP BY l.product ORDER BY cure_rate_pct DESC;`
        ],
        traps: [
          { re: /WHERE[^;]*s10\.dpd\s*=\s*0/i, msg: 'With the October test in <code>WHERE</code>, only cured loans remain, so every rate comes out 100%. Keep it inside the <code>CASE</code>.' },
          { re: /^(?![\s\S]*Written Off)/i, msg: 'Written-off loans belong out of this rate, since they have left the book. Join to <code>loans</code> and filter on <code>status</code>.' },
          { re: /^(?![\s\S]*dpd\s*(>\s*0|<>\s*0|>=\s*1))/i, msg: 'The bottom of the fraction is only loans overdue in September. Add <code>s9.dpd &gt; 0</code> in <code>WHERE</code>.' },
          WHOLE_NUMBER_TRAP
        ],
        hints: [
          `Start from the 2026-09 snapshot rows where <code>dpd</code> is above 0. Those loans are the bottom of your fraction.`,
          `Join the same table again for 2026-10, on <code>loan_id</code>, and join <code>loans</code> for <code>product</code> and <code>status</code>.`,
          `<code>COUNT(*)</code> gives <code>overdue_sep</code>, and <code>SUM(CASE WHEN s10.dpd = 0 THEN 1 ELSE 0 END)</code> gives <code>cured_oct</code>. Divide them with <code>100.0</code> in front.`
        ],
        win: `KPR cures best at 50%, on only 10 loans, and KTA is lowest at 6.7%. Careful analysts show Restructured cures separately, since 5 of the 17 cures are Restructured and new terms can bring a loan current without the [[arrears]] being paid.`,
        atWork: `Some banks count a cure only when the loan stays current for a while, so their rate comes out lower.`,
        pattern: { sql: `SELECT product,\n  COUNT(*) AS overdue_start,\n  SUM(CASE WHEN end_dpd = 0 THEN 1 ELSE 0 END) AS cured\nFROM start_month_joined_to_end_month\nWHERE start_dpd > 0\nGROUP BY product;`, note: 'Cure rate: overdue at the start, current at the end' }
      },
      {
        id: '9.5',
        title: 'Collection efficiency',
        newIdea: 'Collection efficiency compares the cash that came in with the cash that was due.',
        from: 'Bu Ratna, Portfolio Manager',
        teach: `<p>[[Collection efficiency|collection efficiency]] compares the cash that came in with the cash that was due. A simple version takes one month's [[installment]] as what was due on each loan, so 100% means the loans paid what they owed that month.</p><p>Total the cash per loan in a [[CTE]] first, or a loan with three payments counts its installment three times ([[fan-out]]). Then <code>LEFT JOIN</code> it, so a loan that paid nothing stays in with a zero.</p>`,
        ex: [
          [`WITH cash AS (`, `First make a step called cash`],
          [`  SELECT p.loan_id, SUM(p.amount) AS sep_cash`, `with each loan's total cash`],
          [`  FROM payments p`, `from the payments`],
          [`  WHERE p.payment_date BETWEEN '2026-09-01' AND '2026-09-30'`, `made in September,`],
          [`    AND p.amount > 0`, `above zero,`],
          [`  GROUP BY p.loan_id`, `one row per loan,`],
          [`)`, `and then,`],
          [`SELECT l.product,`, `for each product, show its name,`],
          [`  SUM(l.installment) AS installment_due,`, `the installments due`],
          [`  COALESCE(SUM(ca.sep_cash), 0) AS cash_collected`, `and the cash collected, or 0 if none,`],
          [`FROM loans l`, `from the loans table,`],
          [`LEFT JOIN cash ca ON ca.loan_id = l.loan_id`, `keeping loans that paid nothing,`],
          [`WHERE l.status <> 'Written Off'`, `leaving out written-off loans,`],
          [`GROUP BY l.product;`, `with one row per product.`]
        ],
        exNote: `This is a general definition. Your bank's may differ.`,
        bridge: 'Like a collection ratio on receivables, cash received against the amount billed for the period.',
        task: `Are the late buckets paying? Start from the 2026-09 snapshot, loans not written off. One row per <code>sep_bucket</code> (<code>Current</code>, <code>1-30</code>, <code>31-60</code>, <code>61-90</code>, <code>90+</code>, in that order): <code>installment_due</code> (sum of <code>installment</code>), <code>cash_collected</code> (payments above 0 in October 2026, 0 if none), <code>efficiency_pct</code> (percent, 1 decimal).`,
        solution: `WITH cash AS (
  SELECT p.loan_id, SUM(p.amount) AS oct_cash
  FROM payments p
  WHERE p.payment_date BETWEEN '2026-10-01' AND '2026-10-31'
    AND p.amount > 0
  GROUP BY p.loan_id
)
SELECT ${bucket('s.dpd')} AS sep_bucket,
  SUM(l.installment) AS installment_due,
  COALESCE(SUM(ca.oct_cash), 0) AS cash_collected,
  ROUND(100.0 * COALESCE(SUM(ca.oct_cash), 0) / SUM(l.installment), 1) AS efficiency_pct
FROM loan_snapshots s
JOIN loans l
  ON l.loan_id = s.loan_id
LEFT JOIN cash ca
  ON ca.loan_id = s.loan_id
WHERE s.snapshot_month = '2026-09'
  AND l.status <> 'Written Off'
GROUP BY sep_bucket
ORDER BY MIN(s.dpd);`,
        ordered: 'sep_bucket',
        altSolutions: [
          `WITH cash AS (SELECT loan_id, SUM(amount) AS oct_cash FROM payments WHERE strftime('%Y-%m', payment_date) = '2026-10' AND amount > 0 GROUP BY loan_id), start AS (SELECT s.loan_id, s.dpd, l.installment, ${B('s.dpd')} AS sep_bucket FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE s.snapshot_month = '2026-09' AND l.status <> 'Written Off') SELECT st.sep_bucket, SUM(st.installment) AS installment_due, SUM(COALESCE(ca.oct_cash, 0)) AS cash_collected, ROUND(100.0 * SUM(COALESCE(ca.oct_cash, 0)) / SUM(st.installment), 1) AS efficiency_pct FROM start st LEFT JOIN cash ca ON ca.loan_id = st.loan_id GROUP BY st.sep_bucket ORDER BY MIN(st.dpd);`
        ],
        requires: [ON_THE_LIMIT([30, 60, 90]), NO_SUM_DISTINCT],
        wrong: [
          `SELECT ${B('s.dpd')} AS sep_bucket, SUM(l.installment) AS installment_due, COALESCE(SUM(p.amount), 0) AS cash_collected, ROUND(100.0 * COALESCE(SUM(p.amount), 0) / SUM(l.installment), 1) AS efficiency_pct FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id LEFT JOIN payments p ON p.loan_id = s.loan_id AND p.payment_date BETWEEN '2026-10-01' AND '2026-10-31' AND p.amount > 0 WHERE s.snapshot_month = '2026-09' AND l.status <> 'Written Off' GROUP BY sep_bucket ORDER BY MIN(s.dpd);`,
          `WITH cash AS (SELECT p.loan_id, SUM(p.amount) AS oct_cash FROM payments p WHERE p.payment_date BETWEEN '2026-10-01' AND '2026-10-31' AND p.amount > 0 GROUP BY p.loan_id) SELECT ${B('s.dpd')} AS sep_bucket, SUM(l.installment) AS installment_due, COALESCE(SUM(ca.oct_cash), 0) AS cash_collected, ROUND(100.0 * COALESCE(SUM(ca.oct_cash), 0) / SUM(l.installment), 1) AS efficiency_pct FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id JOIN cash ca ON ca.loan_id = s.loan_id WHERE s.snapshot_month = '2026-09' AND l.status <> 'Written Off' GROUP BY sep_bucket ORDER BY MIN(s.dpd);`,
          `WITH cash AS (SELECT p.loan_id, SUM(p.amount) AS oct_cash FROM payments p WHERE p.payment_date BETWEEN '2026-10-01' AND '2026-10-31' AND p.amount > 0 GROUP BY p.loan_id) SELECT ${B('s.dpd')} AS sep_bucket, SUM(l.installment) AS installment_due, COALESCE(SUM(ca.oct_cash), 0) AS cash_collected, ROUND(100.0 * COALESCE(SUM(ca.oct_cash), 0) / SUM(l.installment), 1) AS efficiency_pct FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id LEFT JOIN cash ca ON ca.loan_id = s.loan_id WHERE s.snapshot_month = '2026-09' GROUP BY sep_bucket ORDER BY MIN(s.dpd);`,
          `WITH cash AS (SELECT p.loan_id, SUM(p.amount) AS oct_cash FROM payments p WHERE p.payment_date BETWEEN '2026-10-01' AND '2026-10-31' AND p.amount > 0 GROUP BY p.loan_id) SELECT ${B('s.dpd')} AS sep_bucket, SUM(l.installment) AS installment_due, COALESCE(SUM(ca.oct_cash), 0) AS cash_collected, ROUND(100.0 * COALESCE(SUM(ca.oct_cash), 0) / SUM(l.installment), 1) AS efficiency_pct FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id LEFT JOIN cash ca ON ca.loan_id = s.loan_id WHERE s.snapshot_month = '2026-09' AND l.status <> 'Written Off' GROUP BY sep_bucket ORDER BY sep_bucket;`
        ],
        traps: [
          { re: /LEFT\s+JOIN\s+payments/i, msg: 'A loan with two payments becomes two rows here, so its installment counts twice. Total the cash per loan in a CTE first.' },
          { re: /^(?![\s\S]*LEFT\s+JOIN)/i, msg: 'A plain JOIN drops loans that paid nothing, and those are the ones that matter here. Use a <code>LEFT JOIN</code>.' },
          { re: /^(?![\s\S]*Written Off)/i, msg: 'Written-off loans have left the book, so nothing is due on them here. Filter on <code>status</code>.' },
          { re: /ORDER\s+BY\s+(\w+\.)?sep_bucket/i, msg: 'Sorting by the label puts <code>Current</code> last, because digits sort before letters. Sort by <code>MIN(s.dpd)</code>.' },
          WHOLE_NUMBER_TRAP
        ],
        hints: [
          `Payments have many rows per loan, so start with a CTE holding one row per loan: its October cash above 0.`,
          `Start the main query from the 2026-09 rows of <code>loan_snapshots</code>, join <code>loans</code> for <code>installment</code> and <code>status</code>, and <code>LEFT JOIN</code> your CTE.`,
          `Group by the bucket <code>CASE</code>, and sort by <code>MIN(s.dpd)</code>. Use <code>COALESCE(SUM(ca.oct_cash), 0)</code> for the cash.`
        ],
        win: `Current loans paid 100% of what was due, the 1-30 bucket only 24%, and the 90+ bucket 50.2%. A high rate on an old bucket can come from one large settlement, so look at the loans behind it before you call a team strong.`,
        atWork: `Many banks compare cash with everything due, including arrears and fees, so their rate on late buckets comes out lower. Agree on what counts as due before you compare two teams.`,
        pattern: { sql: `WITH cash AS (\n  SELECT loan_id, SUM(amount) AS period_cash\n  FROM payments\n  WHERE payment_date BETWEEN '2026-10-01' AND '2026-10-31'\n  GROUP BY loan_id\n)\nSELECT l.product,\n  SUM(l.installment) AS installment_due,\n  COALESCE(SUM(ca.period_cash), 0) AS cash_collected\nFROM loans l\nLEFT JOIN cash ca\n  ON ca.loan_id = l.loan_id\nGROUP BY l.product;`, note: 'Collection efficiency: cash per loan first, then against the installment' }
      },
      {
        id: '9.6',
        title: 'Flag each promise kept or not',
        newIdea: 'EXISTS can sit inside CASE, so each promise gets a 1 or a 0.',
        from: 'Yusuf, Field team lead',
        teach: `<p>A [[PTP]] is worth something only when money arrives. A promise is kept when the loan has a payment between <code>activity_date</code> and <code>ptp_date</code>, both days included. The other promises are [[broken PTP]]s.</p><p>You used <code>EXISTS</code> in <code>WHERE</code>. It also works inside <code>CASE</code>, as <code>CASE WHEN EXISTS (...) THEN 1 ELSE 0 END</code>. <code>WHERE</code> would remove the broken promises, and you want to see them. A loan with two payments still gets one 1.</p>`,
        ex: [
          [`SELECT a.activity_id,`, `For each promise, show its id,`],
          [`  a.activity_date,`, `the day it was made,`],
          [`  a.ptp_date,`, `the day money was promised,`],
          [`  CASE WHEN EXISTS (`, `and a 1 when there is`],
          [`    SELECT 1 FROM payments p`, `a payment`],
          [`    WHERE p.loan_id = a.loan_id`, `on the same loan`],
          [`      AND p.payment_date BETWEEN a.activity_date AND a.ptp_date`, `between those two days,`],
          [`  ) THEN 1 ELSE 0 END AS kept`, `or a 0 when there is none,`],
          [`FROM collection_activities a`, `from the activities,`],
          [`WHERE a.result = 'PTP'`, `keeping only promises`],
          [`  AND a.loan_id = 118;`, `on loan 118.`]
        ],
        exNote: `Five of the six promises on loan 118 show a 0, so a long list of promises can still bring in no money. <code>BETWEEN</code> takes columns at its ends as well as fixed values. This is a general definition. Your bank's may differ.`,
        bridge: 'Like matching a promise list to the bank statement, then marking each promise paid or unpaid.',
        task: `Which promises from last month's visits were kept? For each row with <code>result</code> 'PTP', <code>activity_type</code> Visit and <code>activity_date</code> in September 2026, show <code>activity_id</code>, <code>loan_id</code>, <code>ptp_date</code> and <code>kept</code>: 1 if the loan has any payment from <code>activity_date</code> to <code>ptp_date</code>, both days included, otherwise 0. Keep the broken promises.`,
        solution: `SELECT a.activity_id,
  a.loan_id,
  a.ptp_date,
  CASE WHEN EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.loan_id = a.loan_id
      AND p.payment_date BETWEEN a.activity_date AND a.ptp_date
  ) THEN 1 ELSE 0 END AS kept
FROM collection_activities a
WHERE a.result = 'PTP'
  AND a.activity_type = 'Visit'
  AND a.activity_date BETWEEN '2026-09-01' AND '2026-09-30';`,
        altSolutions: [
          `SELECT a.activity_id, a.loan_id, a.ptp_date, ${KEPT} AS kept FROM collection_activities a WHERE a.result = 'PTP' AND a.activity_type = 'Visit' AND substr(a.activity_date, 1, 7) = '2026-09';`,
          `SELECT a.activity_id, a.loan_id, a.ptp_date, CASE WHEN (SELECT COUNT(*) FROM payments p WHERE p.loan_id = a.loan_id AND p.payment_date >= a.activity_date AND p.payment_date <= a.ptp_date) > 0 THEN 1 ELSE 0 END AS kept FROM collection_activities a WHERE a.result = 'PTP' AND a.activity_type = 'Visit' AND a.activity_date >= '2026-09-01' AND a.activity_date < '2026-10-01';`,
          `SELECT a.activity_id, a.loan_id, a.ptp_date, MAX(CASE WHEN p.payment_id IS NOT NULL THEN 1 ELSE 0 END) AS kept FROM collection_activities a LEFT JOIN payments p ON p.loan_id = a.loan_id AND p.payment_date BETWEEN a.activity_date AND a.ptp_date WHERE a.result = 'PTP' AND a.activity_type = 'Visit' AND substr(a.activity_date, 1, 7) = '2026-09' GROUP BY a.activity_id, a.loan_id, a.ptp_date;`
        ],
        wrong: [
          `SELECT a.activity_id, a.loan_id, a.ptp_date, 1 AS kept FROM collection_activities a WHERE a.result = 'PTP' AND a.activity_type = 'Visit' AND a.activity_date BETWEEN '2026-09-01' AND '2026-09-30' AND ${KEPT};`,
          `SELECT a.activity_id, a.loan_id, a.ptp_date, CASE WHEN p.payment_id IS NOT NULL THEN 1 ELSE 0 END AS kept FROM collection_activities a LEFT JOIN payments p ON p.loan_id = a.loan_id AND p.payment_date BETWEEN a.activity_date AND a.ptp_date WHERE a.result = 'PTP' AND a.activity_type = 'Visit' AND a.activity_date BETWEEN '2026-09-01' AND '2026-09-30';`,
          `SELECT a.activity_id, a.loan_id, a.ptp_date, CASE WHEN EXISTS (SELECT 1 FROM payments p WHERE p.loan_id = a.loan_id AND p.payment_date >= a.activity_date) THEN 1 ELSE 0 END AS kept FROM collection_activities a WHERE a.result = 'PTP' AND a.activity_type = 'Visit' AND a.activity_date BETWEEN '2026-09-01' AND '2026-09-30';`,
          `SELECT a.activity_id, a.loan_id, a.ptp_date, CASE WHEN EXISTS (SELECT 1 FROM payments p WHERE p.payment_date BETWEEN a.activity_date AND a.ptp_date) THEN 1 ELSE 0 END AS kept FROM collection_activities a WHERE a.result = 'PTP' AND a.activity_type = 'Visit' AND a.activity_date BETWEEN '2026-09-01' AND '2026-09-30';`,
          `SELECT a.activity_id, a.loan_id, a.ptp_date, CASE WHEN ${KEPT} THEN 1 ELSE 0 END AS kept FROM collection_activities a WHERE a.result = 'PTP' AND a.activity_date BETWEEN '2026-09-01' AND '2026-09-30';`
        ],
        traps: [
          { re: /^(?![\s\S]*(CASE\s+WHEN\s+EXISTS|SELECT\s+COUNT))[\s\S]*\bWHERE\b[\s\S]*\bEXISTS\b/i, msg: 'In <code>WHERE</code>, <code>EXISTS</code> removes the broken promises, and they need to stay. Move it into a column, as <code>CASE WHEN EXISTS (...) THEN 1 ELSE 0 END</code>.' },
          { re: /LEFT\s+JOIN\s+payments(?![\s\S]*\bMAX\b)/i, msg: 'A promise with two payments makes two rows here. Use <code>EXISTS</code>, which gives one yes or no per promise.' },
          { re: /^(?![\s\S]*(BETWEEN\s+(a\.)?activity_date|payment_date\s*<=?\s*(a\.)?ptp_date))/i, msg: 'A payment long after the promised date did not keep the promise. The test needs an end as well, at <code>ptp_date</code>.' },
          { re: /EXISTS\s*\(\s*SELECT\s+[^()]*\bFROM\s+payments\b(?![^()]*loan_id)/i, msg: 'The test has to look at this loan\'s payments only. Add <code>p.loan_id = a.loan_id</code> inside the <code>EXISTS</code>.' }
        ],
        hints: [
          `Start with one row per promise. Filter on <code>result</code>, <code>activity_type</code> and the September dates in <code>WHERE</code>, so the broken promises stay in.`,
          `Add a column named <code>kept</code> with <code>CASE WHEN EXISTS (...) THEN 1 ELSE 0 END</code>.`,
          `Inside the <code>EXISTS</code>, match <code>p.loan_id = a.loan_id</code> and test <code>p.payment_date BETWEEN a.activity_date AND a.ptp_date</code>.`
        ],
        win: `One row per promise with a 1 or a 0 is the building block of a kept rate. You can add the flags, count them and check any single promise by hand, and a percent alone never lets you do that.`,
        pattern: { sql: `CASE WHEN EXISTS (\n  SELECT 1\n  FROM payments p\n  WHERE p.loan_id = a.loan_id\n    AND p.payment_date BETWEEN a.activity_date AND a.ptp_date\n) THEN 1 ELSE 0 END AS kept`, note: 'PTP kept flag: one yes or no per promise' }
      },
      {
        id: '9.7',
        title: 'PTP kept rate by collector',
        newIdea: 'A kept rate counts only promises already due, because a promise due next week is neither kept nor broken.',
        from: 'Citra, Head of Collection',
        teach: `<p>A kept rate is promises kept divided by promises due. Count only promises due by 2026-10-31. A promise due next week has been neither kept nor broken, so it stays out of the top and the bottom of the fraction.</p><p>Build on your flag. Put one row per promise in a CTE, with its 1 or 0, then <code>SUM</code> the flag and <code>COUNT(*)</code> the rows.</p>`,
        ex: [
          [`WITH due AS (`, `First make a step called due`],
          [`  SELECT a.activity_type,`, `with each promise's contact type`],
          [`    CASE WHEN EXISTS (`, `and a 1 when there is`],
          [`      SELECT 1 FROM payments p`, `a payment`],
          [`      WHERE p.loan_id = a.loan_id`, `on the same loan`],
          [`        AND p.payment_date BETWEEN a.activity_date AND a.ptp_date`, `between the contact date and the promised date,`],
          [`    ) THEN 1 ELSE 0 END AS kept`, `or a 0 when there is none,`],
          [`  FROM collection_activities a`, `taken from the activities,`],
          [`  WHERE a.result = 'PTP'`, `keeping only promises`],
          [`    AND a.ptp_date <= '2026-10-31'`, `that have already come due,`],
          [`)`, `and then,`],
          [`SELECT activity_type,`, `for each contact type, show its name,`],
          [`  COUNT(*) AS promises_due,`, `the promises due`],
          [`  SUM(kept) AS promises_kept`, `and how many were kept,`],
          [`FROM due`, `reading from that step,`],
          [`GROUP BY activity_type;`, `with one row per contact type.`]
        ],
        exNote: `This example still holds 2 bad rows where the promised date falls before the activity. Your task removes them. This is a general definition. Your bank's may differ.`,
        bridge: 'Like measuring on-time payment only on invoices that have reached their due date.',
        task: `I want to coach collectors on their promises. Per <code>collector_name</code> with at least one such promise: <code>promises_due</code>, <code>promises_kept</code>, <code>kept_rate_pct</code> (percent, 1 decimal), highest rate first. Count <code>result</code> 'PTP' rows with <code>ptp_date</code> on or before 2026-10-31, dropping any with <code>ptp_date</code> before <code>activity_date</code>. Kept means any payment on that loan from <code>activity_date</code> to <code>ptp_date</code>, both days included.`,
        solution: `WITH due AS (
  SELECT a.collector_id,
    CASE WHEN EXISTS (
      SELECT 1
      FROM payments p
      WHERE p.loan_id = a.loan_id
        AND p.payment_date BETWEEN a.activity_date AND a.ptp_date
    ) THEN 1 ELSE 0 END AS kept
  FROM collection_activities a
  WHERE a.result = 'PTP'
    AND a.ptp_date <= '2026-10-31'
    AND a.ptp_date >= a.activity_date
)
SELECT k.collector_name,
  COUNT(*) AS promises_due,
  SUM(d.kept) AS promises_kept,
  ROUND(100.0 * SUM(d.kept) / COUNT(*), 1) AS kept_rate_pct
FROM due d
JOIN collectors k
  ON k.collector_id = d.collector_id
GROUP BY k.collector_name
ORDER BY kept_rate_pct DESC;`,
        ordered: 'kept_rate_pct',
        altSolutions: [
          `SELECT k.collector_name, COUNT(DISTINCT a.activity_id) AS promises_due, COUNT(DISTINCT CASE WHEN p.payment_id IS NOT NULL THEN a.activity_id END) AS promises_kept, ROUND(100.0 * COUNT(DISTINCT CASE WHEN p.payment_id IS NOT NULL THEN a.activity_id END) / COUNT(DISTINCT a.activity_id), 1) AS kept_rate_pct FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id LEFT JOIN payments p ON p.loan_id = a.loan_id AND p.payment_date BETWEEN a.activity_date AND a.ptp_date WHERE a.result = 'PTP' AND a.ptp_date <= '2026-10-31' AND a.activity_date <= a.ptp_date GROUP BY k.collector_id, k.collector_name ORDER BY kept_rate_pct DESC;`,
          `SELECT k.collector_name, COUNT(*) AS promises_due, SUM(${KEPT}) AS promises_kept, ROUND(100.0 * SUM(${KEPT}) / COUNT(*), 1) AS kept_rate_pct FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE a.result = 'PTP' AND a.ptp_date BETWEEN a.activity_date AND '2026-10-31' GROUP BY k.collector_name ORDER BY kept_rate_pct DESC;`
        ],
        wrong: [
          `SELECT k.collector_name, COUNT(*) AS promises_due, COUNT(p.payment_id) AS promises_kept, ROUND(100.0 * COUNT(p.payment_id) / COUNT(*), 1) AS kept_rate_pct FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id LEFT JOIN payments p ON p.loan_id = a.loan_id AND p.payment_date BETWEEN a.activity_date AND a.ptp_date WHERE a.result = 'PTP' AND a.ptp_date <= '2026-10-31' AND a.ptp_date >= a.activity_date GROUP BY k.collector_name ORDER BY kept_rate_pct DESC;`,
          `SELECT k.collector_name, COUNT(*) AS promises_due, SUM(${KEPT}) AS promises_kept, ROUND(100.0 * SUM(${KEPT}) / COUNT(*), 1) AS kept_rate_pct FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE a.result = 'PTP' AND a.ptp_date >= a.activity_date GROUP BY k.collector_name ORDER BY kept_rate_pct DESC;`,
          `SELECT k.collector_name, COUNT(*) AS promises_due, SUM(${KEPT}) AS promises_kept, ROUND(100.0 * SUM(${KEPT}) / COUNT(*), 1) AS kept_rate_pct FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE a.result = 'PTP' AND a.ptp_date <= '2026-10-31' GROUP BY k.collector_name ORDER BY kept_rate_pct DESC;`,
          `SELECT k.collector_name, COUNT(*) AS promises_due, SUM(EXISTS (SELECT 1 FROM payments p WHERE p.loan_id = a.loan_id AND p.payment_date >= a.activity_date)) AS promises_kept, ROUND(100.0 * SUM(EXISTS (SELECT 1 FROM payments p WHERE p.loan_id = a.loan_id AND p.payment_date >= a.activity_date)) / COUNT(*), 1) AS kept_rate_pct FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE a.result = 'PTP' AND a.ptp_date <= '2026-10-31' AND a.ptp_date >= a.activity_date GROUP BY k.collector_name ORDER BY kept_rate_pct DESC;`,
          `SELECT k.collector_name, COUNT(*) AS promises_due, SUM(CASE WHEN a.ptp_amount > 0 THEN 1 ELSE 0 END) AS promises_kept, ROUND(100.0 * SUM(CASE WHEN a.ptp_amount > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS kept_rate_pct FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE a.result = 'PTP' AND a.ptp_date <= '2026-10-31' AND a.ptp_date >= a.activity_date GROUP BY k.collector_name ORDER BY kept_rate_pct DESC;`,
          `WITH due AS (SELECT a.collector_id, CASE WHEN ${KEPT} THEN 1 ELSE 0 END AS kept FROM collection_activities a WHERE a.result = 'PTP' AND a.ptp_date <= '2026-10-31' AND a.ptp_date >= a.activity_date) SELECT k.collector_name, COUNT(d.collector_id) AS promises_due, COALESCE(SUM(d.kept), 0) AS promises_kept, ROUND(100.0 * SUM(d.kept) / COUNT(d.collector_id), 1) AS kept_rate_pct FROM collectors k LEFT JOIN due d ON d.collector_id = k.collector_id GROUP BY k.collector_name ORDER BY kept_rate_pct DESC;`
        ],
        traps: [
          { re: /COUNT\s*\(\s*(p\.)?payment_id\s*\)/i, msg: 'A promise with two payments makes two rows here, so it counts twice. Use <code>EXISTS</code>, which gives one yes or no per promise.' },
          { re: /^(?![\s\S]*'2026-10-31')/i, msg: 'Some promises are not due yet, and they are not broken. Keep only <code>ptp_date &lt;= \'2026-10-31\'</code>.' },
          { re: /^(?![\s\S]*(ptp_date\s*>=?\s*(a\.)?activity_date|activity_date\s*<=?\s*(a\.)?ptp_date|ptp_date\s+BETWEEN\s+(a\.)?activity_date))/i, msg: 'Two promises are dated before the activity, which is bad data. Remove them with <code>a.ptp_date &gt;= a.activity_date</code> in <code>WHERE</code>.' },
          { re: /^(?![\s\S]*\bpayments\b)/i, msg: 'Having a promised amount says nothing about money arriving. The kept test has to look in the <code>payments</code> table.' },
          { re: /payment_date\s*>=?\s*(a\.)?activity_date(?![\s\S]*payment_date\s*<=?)/i, msg: 'A payment long after the promised date did not keep the promise. The test needs an end as well, at <code>ptp_date</code>.' },
          WHOLE_NUMBER_TRAP
        ],
        hints: [
          `You already have the flag from the last mission. Put it in a CTE with one row per promise, and keep <code>collector_id</code>.`,
          `In that CTE, filter on <code>result</code> and on both date rules in <code>WHERE</code>. That leaves only promises already due.`,
          `Then join to <code>collectors</code>, group by <code>collector_name</code>, and use <code>COUNT(*)</code> and <code>SUM(kept)</code> for the two counts.`,
          `The rate is <code>ROUND(100.0 * SUM(d.kept) / COUNT(*), 1)</code>.`
        ],
        win: `A big PTP count can hide a weak kept rate, so managers look at both. Before you send this, ask whether both PTP rows on loan 269 are real, because they have the same collector and day with different dates and amounts, and each row moves that collector's rate.`,
        atWork: `Some banks also require the full promised amount before a promise counts as kept, so their rate comes out lower.`,
        pattern: { sql: `WITH due AS (\n  SELECT a.collector_id,\n    CASE WHEN EXISTS (...) THEN 1 ELSE 0 END AS kept\n  FROM collection_activities a\n  WHERE a.result = 'PTP'\n    AND a.ptp_date <= '2026-10-31'\n)\nSELECT collector_id,\n  COUNT(*) AS promises_due,\n  SUM(kept) AS promises_kept\nFROM due\nGROUP BY collector_id;`, note: 'Kept rate: flag each promise already due, then add the flags' },
      },
      {
        id: '9.8',
        title: 'Broken promises nobody chased',
        newIdea: "date(ptp_date, '+7 day') sets a follow-up deadline, and NOT EXISTS finds promises nobody chased by then.",
        from: 'Fitri, Desk Call lead',
        teach: `<p>A kept rate tells you what happened. A lead also needs to know what to do next, and a [[broken PTP]] with no follow-up is money nobody is asking for.</p><p>This request uses a sample rule, 7 days after the promised date. <code>date(ptp_date, '+7 day')</code> gives that deadline, and <code>NOT EXISTS</code> finds promises with no activity before it.</p><p>Check the amount too. A payment can arrive and still fall short of <code>ptp_amount</code>.</p>`,
        ex: [
          [`SELECT a.activity_id, a.ptp_date,`, `Show each promise and its promised date,`],
          [`  date(a.ptp_date, '+7 day') AS chase_by`, `plus the deadline to chase it,`],
          [`FROM collection_activities a`, `from the activities,`],
          [`WHERE a.result = 'PTP'`, `keeping only promises`],
          [`  AND a.loan_id = 118`, `on loan 118`],
          [`  AND NOT EXISTS (`, `where there is no`],
          [`    SELECT 1 FROM collection_activities f`, `other activity`],
          [`    WHERE f.loan_id = a.loan_id`, `on the same loan`],
          [`      AND f.activity_date > a.ptp_date`, `after the promised date`],
          [`      AND f.activity_date <= date(a.ptp_date, '+7 day')`, `and by the deadline,`],
          [`  );`, `which ends the test.`]
        ],
        exNote: `Four of this loan's promises had no contact in the week after they fell due. This is a general definition. Your bank's may differ.`,
        bridge: 'Like an aged debtors list with a column showing which overdue invoices have had no reminder sent.',
        task: `Per <code>collector_name</code>, for <code>result</code> 'PTP' rows with <code>ptp_date</code> from <code>activity_date</code> up to 2026-10-24: <code>promises_due</code>; <code>kept_in_full</code> (payments from <code>activity_date</code> to <code>ptp_date</code> total at least <code>ptp_amount</code>); <code>broken</code> (no payment then); <code>not_chased</code> (broken, with no activity on the loan in the 7 days after <code>ptp_date</code>). Most not chased first.`,
        solution: `WITH promises AS (
  SELECT a.loan_id, a.collector_id, a.ptp_date, a.ptp_amount,
    (
      SELECT SUM(p.amount)
      FROM payments p
      WHERE p.loan_id = a.loan_id
        AND p.payment_date BETWEEN a.activity_date AND a.ptp_date
    ) AS paid
  FROM collection_activities a
  WHERE a.result = 'PTP'
    AND a.ptp_date >= a.activity_date
    AND a.ptp_date <= '2026-10-24'
)
SELECT k.collector_name,
  COUNT(*) AS promises_due,
  SUM(CASE WHEN pr.paid >= pr.ptp_amount THEN 1 ELSE 0 END) AS kept_in_full,
  SUM(CASE WHEN pr.paid IS NULL THEN 1 ELSE 0 END) AS broken,
  SUM(CASE WHEN pr.paid IS NULL AND NOT EXISTS (
    SELECT 1
    FROM collection_activities f
    WHERE f.loan_id = pr.loan_id
      AND f.activity_date > pr.ptp_date
      AND f.activity_date <= date(pr.ptp_date, '+7 day')
  ) THEN 1 ELSE 0 END) AS not_chased
FROM promises pr
JOIN collectors k
  ON k.collector_id = pr.collector_id
GROUP BY k.collector_name
ORDER BY not_chased DESC;`,
        ordered: 'not_chased',
        altSolutions: [
          `WITH promises AS (SELECT a.activity_id, a.loan_id, a.collector_id, a.ptp_date, a.ptp_amount, CASE WHEN EXISTS (SELECT 1 FROM payments p WHERE p.loan_id = a.loan_id AND p.payment_date BETWEEN a.activity_date AND a.ptp_date) THEN 0 ELSE 1 END AS is_broken, (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.loan_id = a.loan_id AND p.payment_date BETWEEN a.activity_date AND a.ptp_date) AS paid FROM collection_activities a WHERE a.result = 'PTP' AND a.ptp_date BETWEEN a.activity_date AND '2026-10-24'), flagged AS (SELECT pr.*, CASE WHEN pr.is_broken = 1 AND NOT EXISTS (SELECT 1 FROM collection_activities f WHERE f.loan_id = pr.loan_id AND f.activity_date > pr.ptp_date AND f.activity_date <= date(pr.ptp_date, '+7 days')) THEN 1 ELSE 0 END AS unchased FROM promises pr) SELECT k.collector_name, COUNT(*) AS promises_due, SUM(CASE WHEN fl.paid >= fl.ptp_amount THEN 1 ELSE 0 END) AS kept_in_full, SUM(fl.is_broken) AS broken, SUM(fl.unchased) AS not_chased FROM flagged fl JOIN collectors k ON k.collector_id = fl.collector_id GROUP BY k.collector_name ORDER BY not_chased DESC;`
        ],
        wrong: [
          `WITH promises AS (SELECT a.loan_id, a.collector_id, a.ptp_date, a.ptp_amount, (SELECT SUM(p.amount) FROM payments p WHERE p.loan_id = a.loan_id AND p.payment_date BETWEEN a.activity_date AND a.ptp_date) AS paid FROM collection_activities a WHERE a.result = 'PTP' AND a.ptp_date >= a.activity_date AND a.ptp_date <= '2026-10-31') SELECT k.collector_name, COUNT(*) AS promises_due, SUM(CASE WHEN pr.paid >= pr.ptp_amount THEN 1 ELSE 0 END) AS kept_in_full, SUM(CASE WHEN pr.paid IS NULL THEN 1 ELSE 0 END) AS broken, SUM(CASE WHEN pr.paid IS NULL AND NOT EXISTS (SELECT 1 FROM collection_activities f WHERE f.loan_id = pr.loan_id AND f.activity_date > pr.ptp_date AND f.activity_date <= date(pr.ptp_date, '+7 day')) THEN 1 ELSE 0 END) AS not_chased FROM promises pr JOIN collectors k ON k.collector_id = pr.collector_id GROUP BY k.collector_name ORDER BY not_chased DESC;`,
          `WITH promises AS (SELECT a.loan_id, a.collector_id, a.ptp_date, a.ptp_amount, (SELECT SUM(p.amount) FROM payments p WHERE p.loan_id = a.loan_id AND p.payment_date BETWEEN a.activity_date AND a.ptp_date) AS paid FROM collection_activities a WHERE a.result = 'PTP' AND a.ptp_date >= a.activity_date AND a.ptp_date <= '2026-10-24') SELECT k.collector_name, COUNT(*) AS promises_due, SUM(CASE WHEN pr.paid IS NOT NULL THEN 1 ELSE 0 END) AS kept_in_full, SUM(CASE WHEN pr.paid IS NULL THEN 1 ELSE 0 END) AS broken, SUM(CASE WHEN pr.paid IS NULL AND NOT EXISTS (SELECT 1 FROM collection_activities f WHERE f.loan_id = pr.loan_id AND f.activity_date > pr.ptp_date AND f.activity_date <= date(pr.ptp_date, '+7 day')) THEN 1 ELSE 0 END) AS not_chased FROM promises pr JOIN collectors k ON k.collector_id = pr.collector_id GROUP BY k.collector_name ORDER BY not_chased DESC;`,
          `WITH promises AS (SELECT a.loan_id, a.collector_id, a.ptp_date, a.ptp_amount, (SELECT SUM(p.amount) FROM payments p WHERE p.loan_id = a.loan_id AND p.payment_date BETWEEN a.activity_date AND a.ptp_date) AS paid FROM collection_activities a WHERE a.result = 'PTP' AND a.ptp_date >= a.activity_date AND a.ptp_date <= '2026-10-24') SELECT k.collector_name, COUNT(*) AS promises_due, SUM(CASE WHEN pr.paid >= pr.ptp_amount THEN 1 ELSE 0 END) AS kept_in_full, SUM(CASE WHEN pr.paid IS NULL THEN 1 ELSE 0 END) AS broken, SUM(CASE WHEN pr.paid IS NULL AND NOT EXISTS (SELECT 1 FROM collection_activities f WHERE f.loan_id = pr.loan_id AND f.activity_date > pr.ptp_date) THEN 1 ELSE 0 END) AS not_chased FROM promises pr JOIN collectors k ON k.collector_id = pr.collector_id GROUP BY k.collector_name ORDER BY not_chased DESC;`,
          `WITH promises AS (SELECT a.loan_id, a.collector_id, a.ptp_date, a.ptp_amount, (SELECT SUM(p.amount) FROM payments p WHERE p.loan_id = a.loan_id AND p.payment_date BETWEEN a.activity_date AND a.ptp_date) AS paid FROM collection_activities a WHERE a.result = 'PTP' AND a.ptp_date >= a.activity_date AND a.ptp_date <= '2026-10-24') SELECT k.collector_name, COUNT(*) AS promises_due, SUM(CASE WHEN pr.paid >= pr.ptp_amount THEN 1 ELSE 0 END) AS kept_in_full, SUM(CASE WHEN pr.paid IS NULL THEN 1 ELSE 0 END) AS broken, SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM collection_activities f WHERE f.loan_id = pr.loan_id AND f.activity_date > pr.ptp_date AND f.activity_date <= date(pr.ptp_date, '+7 day')) THEN 1 ELSE 0 END) AS not_chased FROM promises pr JOIN collectors k ON k.collector_id = pr.collector_id GROUP BY k.collector_name ORDER BY not_chased DESC;`
        ],
        traps: [
          { re: /^(?![\s\S]*2026-10-24)/i, msg: 'Use promises due by 2026-10-24, so every promise has had its full 7 days to be chased.' },
          { re: /^(?![\s\S]*\+7\s*days?)/i, msg: 'The follow-up has a deadline. Compare the activity date with <code>date(ptp_date, \'+7 day\')</code>.' },
          { re: /^(?![\s\S]*ptp_amount\s*(<=|<)|[\s\S]*(>=|>)\s*\w*\.?ptp_amount)/i, msg: '<code>kept_in_full</code> compares the total paid in the window with <code>ptp_amount</code>.' },
          { re: /JOIN\s+payments/i, msg: 'A promise with two payments makes two rows here, so it counts twice. Total the payments per promise with a subquery.' }
        ],
        hints: [
          `Start with a CTE holding one row per promise, with a subquery column for the total paid between <code>activity_date</code> and <code>ptp_date</code>. It is NULL when there is no payment.`,
          `<code>kept_in_full</code> tests <code>paid &gt;= ptp_amount</code>, and <code>broken</code> tests <code>paid IS NULL</code>.`,
          `<code>not_chased</code> is a <code>CASE</code> with <code>paid IS NULL AND NOT EXISTS (...)</code>. Inside, look for an activity on the same loan after <code>ptp_date</code> and on or before <code>date(ptp_date, '+7 day')</code>.`
        ],
        win: `Of 421 promises due by 24 October, 191 were paid in full and 161 were broken, and 102 of the broken ones saw no contact in the next 7 days. These customers already agreed to pay, so this list is a good place to start the week.`,
        atWork: `Some banks count any activity as a follow-up, as this does, and some count only a real conversation. Letters and automatic messages may not satisfy your rule, so ask.`,
        pattern: { sql: `SUM(CASE WHEN paid IS NULL AND NOT EXISTS (\n  SELECT 1\n  FROM collection_activities f\n  WHERE f.loan_id = pr.loan_id\n    AND f.activity_date > pr.ptp_date\n    AND f.activity_date <= date(pr.ptp_date, '+7 day')\n) THEN 1 ELSE 0 END) AS not_chased`, note: 'Broken promises with no follow-up by a deadline' }
      },
      {
        id: '9.9',
        title: 'Contact rate by team',
        newIdea: 'A contact rate depends on a written rule for what counts as an attempt and as reaching someone.',
        from: 'Yusuf, Field team lead',
        teach: `<p>[[Contact rate|contact rate]] is the share of attempts that reached someone. The SQL is short, and the definition is the real work. So read the <code>result</code> values first. One general rule looks like this.</p><ul><li>Attempts are Call, WhatsApp and Visit. Letters and Auto SMS go one way.</li><li>Reached means Contacted, PTP, Paid or Refused.</li><li>No Answer, Not Home and Wrong Number reached nobody.</li><li>Delivered, Returned and Sent appear only on letters and SMS, so the attempt filter removes them.</li></ul><p>Agree on the rule with your manager before you share the number.</p>`,
        ex: [
          [`SELECT a.activity_type,`, `For each way of trying, show its name,`],
          [`  COUNT(*) AS attempts,`, `how many attempts were made`],
          [`  ROUND(100.0 * SUM(CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid', 'Refused') THEN 1 ELSE 0 END) / COUNT(*), 1) AS contact_rate_pct`, `and the percent of them that reached someone,`],
          [`FROM collection_activities a`, `from the activities,`],
          [`WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit')`, `using two-way attempts only,`],
          [`GROUP BY a.activity_type`, `with one row per type`],
          [`ORDER BY contact_rate_pct DESC;`, `and the best rate first.`]
        ],
        exNote: `This is a general definition. Your bank's may differ.`,
        bridge: 'Like COUNTIFS for the reached results divided by COUNTIFS for the attempts, for each team.',
        task: `Compare the teams. For each <code>team</code> with at least one attempt, show <code>attempts</code>, <code>reached</code> and <code>contact_rate_pct</code> (percent, 1 decimal), highest rate first. Attempts are <code>activity_type</code> Call, WhatsApp or Visit only, counting every such row even if its loan is missing. Reached means <code>result</code> is Contacted, PTP, Paid or Refused.`,
        solution: `SELECT k.team,
  COUNT(*) AS attempts,
  SUM(CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid', 'Refused') THEN 1 ELSE 0 END) AS reached,
  ROUND(100.0 * SUM(CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid', 'Refused') THEN 1 ELSE 0 END) / COUNT(*), 1) AS contact_rate_pct
FROM collection_activities a
JOIN collectors k
  ON k.collector_id = a.collector_id
WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit')
GROUP BY k.team
ORDER BY contact_rate_pct DESC;`,
        ordered: 'contact_rate_pct',
        altSolutions: [
          `WITH attempts AS (SELECT k.team, CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid', 'Refused') THEN 1 ELSE 0 END AS was_reached FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE a.activity_type <> 'SP Letter' AND a.activity_type <> 'Auto SMS') SELECT team, COUNT(*) AS attempts, SUM(was_reached) AS reached, ROUND(100.0 * SUM(was_reached) / COUNT(*), 1) AS contact_rate_pct FROM attempts GROUP BY team ORDER BY contact_rate_pct DESC;`,
          `SELECT k.team, COUNT(*) AS attempts, SUM(CASE WHEN a.result NOT IN ('No Answer', 'Not Home', 'Wrong Number') THEN 1 ELSE 0 END) AS reached, ROUND(SUM(CASE WHEN a.result NOT IN ('No Answer', 'Not Home', 'Wrong Number') THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS contact_rate_pct FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit') GROUP BY k.team ORDER BY 4 DESC;`
        ],
        wrong: [
          `SELECT k.team, COUNT(*) AS attempts, SUM(CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid', 'Refused') THEN 1 ELSE 0 END) AS reached, ROUND(100.0 * SUM(CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid', 'Refused') THEN 1 ELSE 0 END) / COUNT(*), 1) AS contact_rate_pct FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id GROUP BY k.team ORDER BY contact_rate_pct DESC;`,
          `SELECT k.team, COUNT(*) AS attempts, SUM(CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid') THEN 1 ELSE 0 END) AS reached, ROUND(100.0 * SUM(CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid') THEN 1 ELSE 0 END) / COUNT(*), 1) AS contact_rate_pct FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit') GROUP BY k.team ORDER BY contact_rate_pct DESC;`,
          `SELECT k.team, COUNT(*) AS attempts, SUM(CASE WHEN a.result = 'Contacted' THEN 1 ELSE 0 END) AS reached, ROUND(100.0 * SUM(CASE WHEN a.result = 'Contacted' THEN 1 ELSE 0 END) / COUNT(*), 1) AS contact_rate_pct FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit') GROUP BY k.team ORDER BY contact_rate_pct DESC;`,
          `SELECT k.team, COUNT(*) AS attempts, SUM(CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid', 'Refused') THEN 1 ELSE 0 END) AS reached, ROUND(100.0 * SUM(CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid', 'Refused') THEN 1 ELSE 0 END) / COUNT(*), 1) AS contact_rate_pct FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit') AND a.result IN ('Contacted', 'PTP', 'Paid', 'Refused') GROUP BY k.team ORDER BY contact_rate_pct DESC;`,
          `SELECT k.team, COUNT(a.activity_id) AS attempts, SUM(CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid', 'Refused') THEN 1 ELSE 0 END) AS reached, ROUND(100.0 * SUM(CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid', 'Refused') THEN 1 ELSE 0 END) / COUNT(a.activity_id), 1) AS contact_rate_pct FROM collectors k LEFT JOIN collection_activities a ON a.collector_id = k.collector_id AND a.activity_type IN ('Call', 'WhatsApp', 'Visit') GROUP BY k.team ORDER BY contact_rate_pct DESC;`,
          `SELECT k.team, COUNT(*) AS attempts, SUM(CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid', 'Refused') THEN 1 ELSE 0 END) AS reached, ROUND(100.0 * SUM(CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid', 'Refused') THEN 1 ELSE 0 END) / COUNT(*), 1) AS contact_rate_pct FROM collection_activities a JOIN collectors k ON k.collector_id = a.collector_id JOIN loans l ON l.loan_id = a.loan_id WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit') GROUP BY k.team ORDER BY contact_rate_pct DESC;`
        ],
        traps: [
          { re: /^(?![\s\S]*activity_type)/i, msg: 'Without a filter on <code>activity_type</code>, letters count as attempts, and a letter can never reach anyone in this rule.' },
          { re: /JOIN\s+loans\b/i, msg: 'Three activities point at loans that do not exist, so joining to <code>loans</code> loses them. This rate only needs <code>collectors</code>.' },
          { re: /WHERE[\s\S]*\bresult\s+IN\b[\s\S]*GROUP\s+BY/i, msg: 'A <code>result</code> test in <code>WHERE</code> removes the failed attempts, so every rate comes out 100%. Keep it inside the <code>CASE</code>.' },
          { re: /'Delivered'|'Sent'/i, msg: 'Delivered and Sent belong to letters and SMS, which go one way. They stay out of this rate.' },
          { re: /^(?![\s\S]*'Refused')(?![\s\S]*NOT\s+IN)/i, msg: 'Check your list of reached results. A borrower who refuses was still reached, so Refused belongs in it, along with Contacted, PTP and Paid.' },
          WHOLE_NUMBER_TRAP
        ],
        hints: [
          `The rate needs a team name, so join <code>collection_activities</code> to <code>collectors</code>.`,
          `Filter <code>activity_type</code> in <code>WHERE</code>, since those rows are out of the rate altogether. Test <code>result</code> inside a <code>CASE</code>, since failed attempts must stay in the count.`,
          `The <code>reached</code> column is <code>SUM(CASE WHEN a.result IN ('Contacted', 'PTP', 'Paid', 'Refused') THEN 1 ELSE 0 END)</code>. Divide it by <code>COUNT(*)</code>, with <code>100.0</code> in front.`
        ],
        win: `Field reaches 71% of its attempts and Desk Call 54.2%, and a visit costs far more than a call, so read this rate beside the cost of each attempt. Desk Call's 747 attempts include 3 on loan numbers that do not exist, so raise those before you share this.`,
        atWork: `Many banks also track right party contact, which counts only reaching the borrower. A spouse answering the phone may count as contact and fail that test. This data cannot separate the two.`,
        pattern: { sql: `SUM(CASE WHEN result IN ('Contacted', 'PTP', 'Paid', 'Refused') THEN 1 ELSE 0 END)\n  * 100.0 / COUNT(*)`, note: 'Contact rate: test results inside CASE, and attempt types in WHERE' }
      },
      {
        id: '9.10',
        title: 'Stale cases',
        newIdea: 'The latest-row pattern and julianday together show how long a case has gone untouched.',
        from: 'Budi, Field Collection lead',
        teach: `<p>A loan with nobody chasing it gets later without anyone noticing. To find these, you need each loan's latest attempt, and you met that pattern in Level 5: <code>ROW_NUMBER</code> with <code>PARTITION BY</code>, keeping <code>rn = 1</code>.</p><p>A loan with no attempts has no row at all, so <code>LEFT JOIN</code> keeps it, and <code>julianday</code> gives the days since the rest. Put <code>rn = 1</code> in the <code>ON</code>, as you did for active assignments.</p>`,
        ex: [
          [`WITH ranked AS (`, `First make a step called ranked`],
          [`  SELECT p.loan_id, p.payment_date,`, `with each payment's loan and date,`],
          [`    ROW_NUMBER() OVER (PARTITION BY p.loan_id ORDER BY p.payment_date DESC, p.payment_id DESC) AS rn`, `numbered inside each loan with the latest as 1,`],
          [`  FROM payments p`, `from the payments,`],
          [`)`, `and then`],
          [`SELECT l.loan_id, rk.payment_date AS last_payment,`, `show each loan and its last payment,`],
          [`  julianday('2026-10-31') - julianday(rk.payment_date) AS days_since`, `with the days from then to 2026-10-31,`],
          [`FROM loans l`, `from the loans table,`],
          [`LEFT JOIN ranked rk ON rk.loan_id = l.loan_id AND rk.rn = 1`, `keeping loans with no payment,`],
          [`WHERE l.collectibility = 4`, `for Kol 4 loans,`],
          [`ORDER BY l.loan_id`, `in loan ID order,`],
          [`LIMIT 5;`, `and stop after 5 rows.`]
        ],
        bridge: 'Like a last-contact column on a debtor list, where a blank means nobody has ever called.',
        task: `Which cases has nobody touched? For loans with <code>dpd</code> above 0, not written off, find the latest Call, WhatsApp or Visit with <code>ROW_NUMBER</code>. Keep loans with no attempt, or more than 30 days since it, counting to 2026-10-31. Show <code>loan_id</code>, <code>dpd</code>, <code>outstanding</code>, <code>last_contact</code> and <code>days_since</code>, largest balance first.`,
        solution: `WITH ranked AS (
  SELECT a.loan_id, a.activity_date,
    ROW_NUMBER() OVER (PARTITION BY a.loan_id ORDER BY a.activity_date DESC, a.activity_id DESC) AS rn
  FROM collection_activities a
  WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit')
)
SELECT l.loan_id, l.dpd, l.outstanding,
  rk.activity_date AS last_contact,
  julianday('2026-10-31') - julianday(rk.activity_date) AS days_since
FROM loans l
LEFT JOIN ranked rk
  ON rk.loan_id = l.loan_id
  AND rk.rn = 1
WHERE l.dpd > 0
  AND l.status <> 'Written Off'
  AND (
    rk.activity_date IS NULL
    OR julianday('2026-10-31') - julianday(rk.activity_date) > 30
  )
ORDER BY l.outstanding DESC;`,
        ordered: 'outstanding',
        altSolutions: [
          `WITH ranked AS (SELECT a.loan_id, a.activity_date, ROW_NUMBER() OVER (PARTITION BY a.loan_id ORDER BY a.activity_date DESC) AS rn FROM collection_activities a WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit')), latest AS (SELECT loan_id, activity_date FROM ranked WHERE rn = 1) SELECT l.loan_id, l.dpd, l.outstanding, la.activity_date AS last_contact, julianday('2026-10-31') - julianday(la.activity_date) AS days_since FROM loans l LEFT JOIN latest la ON la.loan_id = l.loan_id WHERE l.dpd > 0 AND l.status <> 'Written Off' AND (la.activity_date IS NULL OR la.activity_date < date('2026-10-31', '-30 day')) ORDER BY l.outstanding DESC;`
        ],
        requires: [{ re: /\bROW_NUMBER\b/i, msg: 'The result is right. This mission practices the latest-row pattern from Level 5, so build it with <code>ROW_NUMBER</code>.' }],
        wrong: [
          `WITH ranked AS (SELECT a.loan_id, a.activity_date, ROW_NUMBER() OVER (ORDER BY a.activity_date DESC, a.activity_id DESC) AS rn FROM collection_activities a WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit')) SELECT l.loan_id, l.dpd, l.outstanding, rk.activity_date AS last_contact, julianday('2026-10-31') - julianday(rk.activity_date) AS days_since FROM loans l LEFT JOIN ranked rk ON rk.loan_id = l.loan_id AND rk.rn = 1 WHERE l.dpd > 0 AND l.status <> 'Written Off' AND (rk.activity_date IS NULL OR julianday('2026-10-31') - julianday(rk.activity_date) > 30) ORDER BY l.outstanding DESC;`,
          `WITH ranked AS (SELECT a.loan_id, a.activity_date, ROW_NUMBER() OVER (PARTITION BY a.loan_id ORDER BY a.activity_date DESC, a.activity_id DESC) AS rn FROM collection_activities a WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit')) SELECT l.loan_id, l.dpd, l.outstanding, rk.activity_date AS last_contact, julianday('2026-10-31') - julianday(rk.activity_date) AS days_since FROM loans l JOIN ranked rk ON rk.loan_id = l.loan_id AND rk.rn = 1 WHERE l.dpd > 0 AND l.status <> 'Written Off' AND julianday('2026-10-31') - julianday(rk.activity_date) > 30 ORDER BY l.outstanding DESC;`,
          `WITH ranked AS (SELECT a.loan_id, a.activity_date, ROW_NUMBER() OVER (PARTITION BY a.loan_id ORDER BY a.activity_date, a.activity_id) AS rn FROM collection_activities a WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit')) SELECT l.loan_id, l.dpd, l.outstanding, rk.activity_date AS last_contact, julianday('2026-10-31') - julianday(rk.activity_date) AS days_since FROM loans l LEFT JOIN ranked rk ON rk.loan_id = l.loan_id AND rk.rn = 1 WHERE l.dpd > 0 AND l.status <> 'Written Off' AND (rk.activity_date IS NULL OR julianday('2026-10-31') - julianday(rk.activity_date) > 30) ORDER BY l.outstanding DESC;`,
          `WITH ranked AS (SELECT a.loan_id, a.activity_date, ROW_NUMBER() OVER (PARTITION BY a.loan_id ORDER BY a.activity_date DESC, a.activity_id DESC) AS rn FROM collection_activities a) SELECT l.loan_id, l.dpd, l.outstanding, rk.activity_date AS last_contact, julianday('2026-10-31') - julianday(rk.activity_date) AS days_since FROM loans l LEFT JOIN ranked rk ON rk.loan_id = l.loan_id AND rk.rn = 1 WHERE l.dpd > 0 AND l.status <> 'Written Off' AND (rk.activity_date IS NULL OR julianday('2026-10-31') - julianday(rk.activity_date) > 30) ORDER BY l.outstanding DESC;`
        ],
        traps: [
          { re: /ROW_NUMBER\s*\(\s*\)\s*OVER\s*\(\s*ORDER/i, msg: 'With no <code>PARTITION BY</code>, one list covers every loan, so only one loan gets an <code>rn</code> of 1. Add <code>PARTITION BY a.loan_id</code>.' },
          { re: /\bFROM\s+loans\s+l\s+JOIN\s+ranked|\bJOIN\s+ranked(?![\s\S]*LEFT)/i, msg: 'A plain JOIN drops loans with no attempt at all, and those are the stalest. Use a <code>LEFT JOIN</code>.' },
          { re: /^(?![\s\S]*activity_type)/i, msg: 'An Auto SMS or a letter is not somebody working the case. Count only Call, WhatsApp and Visit.' },
          { re: /WHERE[\s\S]*\brn\s*=\s*1/i, msg: 'In <code>WHERE</code>, <code>rn = 1</code> removes loans with no attempt, because their <code>rn</code> is NULL. Move it into the <code>ON</code>.' }
        ],
        hints: [
          `Start with a CTE numbering each loan's attempts, latest first, with <code>PARTITION BY a.loan_id</code>.`,
          `Start the main query from <code>loans</code>, and <code>LEFT JOIN</code> the CTE with <code>rn = 1</code> in the <code>ON</code>.`,
          `<code>days_since</code> is <code>julianday('2026-10-31') - julianday(rk.activity_date)</code>. In <code>WHERE</code>, put <code>activity_date IS NULL OR</code> that sum above 30 in brackets.`
        ],
        win: `Thirty-three overdue loans have had no call, message or visit in over 30 days, and 19 of them have had none at all. Loan 325 tops the list at Rp 300 million, with its last contact on 24 January.`,
        pattern: { sql: `WITH ranked AS (\n  SELECT id, event_date,\n    ROW_NUMBER() OVER (PARTITION BY id ORDER BY event_date DESC) AS rn\n  FROM table_name\n)\nSELECT p.id, r.event_date,\n  julianday('2026-10-31') - julianday(r.event_date) AS days_since\nFROM parent_table p\nLEFT JOIN ranked r\n  ON r.id = p.id\n  AND r.rn = 1;`, note: 'Latest row per group, and how long ago it was' }
      },
      {
        id: '9.11',
        title: 'Vintage analysis',
        newIdea: 'Find each loan\'s worst month first, then group the loans by the year the bank paid them out.',
        from: 'Rudi, Credit Risk',
        teach: `<p>A [[vintage]] is a group of loans [[disbursed]] in the same period. Comparing vintages shows whether newer lending is behaving better or worse than older lending.</p><p>A general measure is the share of a vintage's loans that were ever past 90 days. "Ever" needs one row per loan first, so take <code>MAX(dpd)</code> per loan in a CTE, then count loans. <code>strftime('%Y', a_date)</code> gives the year, the same way <code>'%Y-%m'</code> gave the month.</p><p>Keep written-off loans in this time. They are the worst results of a vintage, and leaving them out makes old lending look better than it was.</p>`,
        ex: [
          [`WITH worst AS (`, `First make a step called worst`],
          [`  SELECT s.loan_id, MAX(s.dpd) AS worst_dpd`, `with each loan's highest DPD`],
          [`  FROM loan_snapshots s`, `across its snapshots,`],
          [`  GROUP BY s.loan_id`, `one row per loan,`],
          [`)`, `and then,`],
          [`SELECT l.product,`, `for each product, show its name,`],
          [`  COUNT(*) AS loans,`, `how many loans it has`],
          [`  SUM(CASE WHEN w.worst_dpd > 30 THEN 1 ELSE 0 END) AS ever_30`, `and how many were ever more than 30 days late,`],
          [`FROM loans l`, `from the loans table`],
          [`JOIN worst w ON w.loan_id = l.loan_id`, `joined to that step,`],
          [`GROUP BY l.product;`, `with one row per product.`]
        ],
        exNote: `This is a general definition. Your bank's may differ.`,
        bridge: 'Like an aged receivables list grouped by the month each invoice was raised.',
        task: `Is newer lending worse? Using all loans, written-off ones included, per <code>disbursed_year</code> (the year of <code>disbursed_date</code>), oldest first: <code>loans</code>, <code>ever_90</code> (loans with <code>dpd</code> above 90 in any snapshot) and <code>ever_90_pct</code> (percent of the year's loans, 1 decimal).`,
        solution: `WITH worst AS (
  SELECT s.loan_id, MAX(s.dpd) AS worst_dpd
  FROM loan_snapshots s
  GROUP BY s.loan_id
)
SELECT strftime('%Y', l.disbursed_date) AS disbursed_year,
  COUNT(*) AS loans,
  SUM(CASE WHEN w.worst_dpd > 90 THEN 1 ELSE 0 END) AS ever_90,
  ROUND(100.0 * SUM(CASE WHEN w.worst_dpd > 90 THEN 1 ELSE 0 END) / COUNT(*), 1) AS ever_90_pct
FROM loans l
JOIN worst w
  ON w.loan_id = l.loan_id
GROUP BY disbursed_year
ORDER BY disbursed_year;`,
        ordered: 'disbursed_year',
        altSolutions: [
          `SELECT substr(l.disbursed_date, 1, 4) AS disbursed_year, COUNT(*) AS loans, SUM(CASE WHEN EXISTS (SELECT 1 FROM loan_snapshots s WHERE s.loan_id = l.loan_id AND s.dpd > 90) THEN 1 ELSE 0 END) AS ever_90, ROUND(100.0 * SUM(CASE WHEN EXISTS (SELECT 1 FROM loan_snapshots s WHERE s.loan_id = l.loan_id AND s.dpd > 90) THEN 1 ELSE 0 END) / COUNT(*), 1) AS ever_90_pct FROM loans l GROUP BY disbursed_year ORDER BY disbursed_year;`,
          `SELECT strftime('%Y', l.disbursed_date) AS disbursed_year, COUNT(DISTINCT l.loan_id) AS loans, COUNT(DISTINCT CASE WHEN s.dpd > 90 THEN l.loan_id END) AS ever_90, ROUND(100.0 * COUNT(DISTINCT CASE WHEN s.dpd > 90 THEN l.loan_id END) / COUNT(DISTINCT l.loan_id), 1) AS ever_90_pct FROM loans l LEFT JOIN loan_snapshots s ON s.loan_id = l.loan_id GROUP BY disbursed_year ORDER BY 1;`
        ],
        requires: [ON_THE_LIMIT([90])],
        wrong: [
          `SELECT strftime('%Y', l.disbursed_date) AS disbursed_year, COUNT(*) AS loans, SUM(CASE WHEN s.dpd > 90 THEN 1 ELSE 0 END) AS ever_90, ROUND(100.0 * SUM(CASE WHEN s.dpd > 90 THEN 1 ELSE 0 END) / COUNT(*), 1) AS ever_90_pct FROM loans l JOIN loan_snapshots s ON s.loan_id = l.loan_id GROUP BY disbursed_year ORDER BY disbursed_year;`,
          `SELECT strftime('%Y', l.disbursed_date) AS disbursed_year, COUNT(*) AS loans, SUM(CASE WHEN l.dpd > 90 THEN 1 ELSE 0 END) AS ever_90, ROUND(100.0 * SUM(CASE WHEN l.dpd > 90 THEN 1 ELSE 0 END) / COUNT(*), 1) AS ever_90_pct FROM loans l GROUP BY disbursed_year ORDER BY disbursed_year;`,
          `WITH worst AS (SELECT s.loan_id, MAX(s.dpd) AS worst_dpd FROM loan_snapshots s GROUP BY s.loan_id) SELECT strftime('%Y', l.disbursed_date) AS disbursed_year, COUNT(*) AS loans, SUM(CASE WHEN w.worst_dpd > 90 THEN 1 ELSE 0 END) AS ever_90, ROUND(100.0 * SUM(CASE WHEN w.worst_dpd > 90 THEN 1 ELSE 0 END) / COUNT(*), 1) AS ever_90_pct FROM loans l JOIN worst w ON w.loan_id = l.loan_id WHERE l.status <> 'Written Off' GROUP BY disbursed_year ORDER BY disbursed_year;`,
          `WITH worst AS (SELECT s.loan_id, MAX(s.dpd) AS worst_dpd FROM loan_snapshots s GROUP BY s.loan_id) SELECT strftime('%Y', l.disbursed_date) AS disbursed_year, COUNT(*) AS loans, SUM(CASE WHEN w.worst_dpd > 90 THEN 1 ELSE 0 END) AS ever_90, ROUND(100.0 * SUM(CASE WHEN w.worst_dpd > 90 THEN 1 ELSE 0 END) / (SELECT COUNT(*) FROM loans), 1) AS ever_90_pct FROM loans l JOIN worst w ON w.loan_id = l.loan_id GROUP BY disbursed_year ORDER BY disbursed_year;`,
          `WITH worst AS (SELECT s.loan_id, MAX(s.dpd) AS worst_dpd FROM loan_snapshots s GROUP BY s.loan_id) SELECT strftime('%Y', l.disbursed_date) AS disbursed_year, COUNT(*) AS loans, SUM(CASE WHEN w.worst_dpd >= 90 THEN 1 ELSE 0 END) AS ever_90, ROUND(100.0 * SUM(CASE WHEN w.worst_dpd >= 90 THEN 1 ELSE 0 END) / COUNT(*), 1) AS ever_90_pct FROM loans l JOIN worst w ON w.loan_id = l.loan_id GROUP BY disbursed_year ORDER BY disbursed_year;`
        ],
        traps: [
          { re: /JOIN\s+loan_snapshots/i, msg: 'Each loan has about 10 snapshot rows, so this JOIN counts loan-months in place of loans. Reduce the snapshots to one row per loan first.' },
          { re: /^(?![\s\S]*loan_snapshots)/i, msg: '<code>loans.dpd</code> only says how late a loan is today. "Ever" needs the history in <code>loan_snapshots</code>.' },
          { re: /Written Off/i, msg: 'Keep written-off loans in this one. They are part of the story, and removing them flatters every vintage.' },
          { re: /\(\s*SELECT\s+COUNT\s*\(\s*\*\s*\)\s+FROM\s+loans\s*\)/i, msg: 'The percent is out of each year\'s own loans, so divide by <code>COUNT(*)</code> of the group.' },
          WHOLE_NUMBER_TRAP
        ],
        hints: [
          `"Ever past 90" is a question about one loan. Answer it per loan first.`,
          `Make a CTE from <code>loan_snapshots</code> with <code>loan_id</code> and <code>MAX(dpd)</code>, grouped by <code>loan_id</code>.`,
          `Join it to <code>loans</code>, then group by <code>strftime('%Y', l.disbursed_date)</code>. Count with <code>SUM(CASE WHEN w.worst_dpd &gt; 90 THEN 1 ELSE 0 END)</code>.`
        ],
        win: `The 2025 vintage is the youngest and already the worst, at 25.8%, which is the kind of early warning a credit team wants. Before you present this, check loan 295, whose 495 DPD is larger than its age of 414 days, and loan 273, whose 374 DPD came only 392 days after disbursement, too soon for a first due date.`,
        atWork: `Our snapshots start in January 2026, so older vintages may have had earlier bad months this cannot see. Without loans 273 and 295, 2025 is 24.2%, still the worst. Full vintage reports usually track each group by months since disbursement, so a one-year-old vintage is compared with others at the same age. That needs more history than this practice data holds. Banks also choose their own day limit and time period. SQL Server and older Oracle versions reject <code>GROUP BY</code> on a <code>SELECT</code> alias such as <code>disbursed_year</code>, so repeat the full expression there.`,
        pattern: { sql: `WITH worst AS (\n  SELECT loan_id, MAX(dpd) AS worst_dpd\n  FROM loan_snapshots\n  GROUP BY loan_id\n)\nSELECT strftime('%Y', l.disbursed_date) AS disbursed_year,\n  COUNT(*) AS loans,\n  SUM(CASE WHEN w.worst_dpd > 90 THEN 1 ELSE 0 END) AS ever_90\nFROM loans l\nJOIN worst w ON w.loan_id = l.loan_id\nGROUP BY disbursed_year;`, note: 'Vintage: one row per loan first, then group by year' }
      },
      {
        id: '9.12',
        title: 'Recovery rate by product',
        newIdea: 'Recovery rate is the cash received after write-off, against the balance written off.',
        from: 'Ayu, Recovery team lead',
        teach: `<p>A [[write-off]] removes a loan from the balance sheet, and collection continues. [[Recovery|recovery]] is the money collected after that. A general recovery rate is cash after the write-off date divided by the balance at write-off.</p><p>In this data, <code>outstanding</code> stays frozen after write-off, so it is the balance at write-off. A loan can have several payments, so total them per loan first, or the balance is added again for each payment ([[fan-out]]). Many loans have recovered nothing yet, and they stay in with a zero.</p>`,
        ex: [
          [`WITH recovered AS (`, `First make a step called recovered`],
          [`  SELECT p.loan_id, SUM(p.amount) AS cash_after`, `with each loan's total cash`],
          [`  FROM payments p`, `from the payments`],
          [`  JOIN loans l ON l.loan_id = p.loan_id`, `joined to their loan,`],
          [`  WHERE p.payment_date > l.write_off_date`, `counting only money after the write-off,`],
          [`  GROUP BY p.loan_id`, `one row per loan,`],
          [`)`, `and then,`],
          [`SELECT substr(l.write_off_date, 1, 7) AS write_off_month,`, `for each write-off month, show the month,`],
          [`  SUM(l.outstanding) AS balance_written_off,`, `the balance written off`],
          [`  COALESCE(SUM(rec.cash_after), 0) AS recovered`, `and the cash recovered, or 0 if none,`],
          [`FROM loans l`, `from the loans table,`],
          [`LEFT JOIN recovered rec ON rec.loan_id = l.loan_id`, `keeping loans with no recovery,`],
          [`WHERE l.status = 'Written Off'`, `for written-off loans`],
          [`  AND l.write_off_date IS NOT NULL`, `that have a date,`],
          [`GROUP BY write_off_month`, `with one row per month,`],
          [`ORDER BY write_off_month;`, `oldest first.`]
        ],
        exNote: `This is a general definition. Your bank's may differ.`,
        bridge: 'Like bad debts recovered in accounting, meaning cash received on balances already written off.',
        task: `I need to report what we got back on written-off loans. Per <code>product</code>, for written-off loans that have a <code>write_off_date</code>, show <code>loans_written_off</code>, <code>balance_written_off</code>, <code>recovered</code> (payments dated after the write-off date, 0 if none) and <code>recovery_pct</code> (recovered as a percent of balance, 2 decimals). Highest rate first.`,
        solution: `WITH recovered AS (
  SELECT p.loan_id, SUM(p.amount) AS cash_after
  FROM payments p
  JOIN loans l
    ON l.loan_id = p.loan_id
  WHERE p.payment_date > l.write_off_date
  GROUP BY p.loan_id
)
SELECT l.product,
  COUNT(l.loan_id) AS loans_written_off,
  SUM(l.outstanding) AS balance_written_off,
  COALESCE(SUM(rec.cash_after), 0) AS recovered,
  ROUND(100.0 * COALESCE(SUM(rec.cash_after), 0) / SUM(l.outstanding), 2) AS recovery_pct
FROM loans l
LEFT JOIN recovered rec
  ON rec.loan_id = l.loan_id
WHERE l.status = 'Written Off'
  AND l.write_off_date IS NOT NULL
GROUP BY l.product
ORDER BY recovery_pct DESC;`,
        ordered: 'recovery_pct',
        altSolutions: [
          `WITH per_loan AS (SELECT l.product, l.outstanding, (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.loan_id = l.loan_id AND p.payment_date > l.write_off_date) AS cash_after FROM loans l WHERE l.status = 'Written Off' AND l.write_off_date IS NOT NULL) SELECT product, COUNT(*) AS loans_written_off, SUM(outstanding) AS balance_written_off, SUM(cash_after) AS recovered, ROUND(100.0 * SUM(cash_after) / SUM(outstanding), 2) AS recovery_pct FROM per_loan GROUP BY product ORDER BY recovery_pct DESC;`,
          `WITH written_off AS (SELECT l.loan_id, l.product, l.outstanding, l.write_off_date FROM loans l WHERE l.write_off_date IS NOT NULL), recovered AS (SELECT w.loan_id, SUM(p.amount) AS cash_after FROM written_off w JOIN payments p ON p.loan_id = w.loan_id AND p.payment_date > w.write_off_date GROUP BY w.loan_id) SELECT w.product, COUNT(*) AS loans_written_off, SUM(w.outstanding) AS balance_written_off, COALESCE(SUM(r.cash_after), 0) AS recovered, ROUND(COALESCE(SUM(r.cash_after), 0) * 100.0 / SUM(w.outstanding), 2) AS recovery_pct FROM written_off w LEFT JOIN recovered r ON r.loan_id = w.loan_id GROUP BY w.product ORDER BY 5 DESC;`
        ],
        precision: 4,
        requires: [NO_SUM_DISTINCT],
        wrong: [
          `WITH recovered AS (SELECT p.loan_id, SUM(p.amount) AS cash_after FROM payments p JOIN loans l ON l.loan_id = p.loan_id WHERE p.payment_date > l.write_off_date GROUP BY p.loan_id) SELECT l.product, COUNT(*) AS loans_written_off, SUM(l.outstanding) AS balance_written_off, SUM(r.cash_after) AS recovered, ROUND(100.0 * SUM(r.cash_after) / SUM(l.outstanding), 2) AS recovery_pct FROM loans l JOIN recovered r ON r.loan_id = l.loan_id WHERE l.status = 'Written Off' AND l.write_off_date IS NOT NULL GROUP BY l.product ORDER BY recovery_pct DESC;`,
          `SELECT l.product, COUNT(*) AS loans_written_off, SUM(l.outstanding) AS balance_written_off, COALESCE(SUM(p.amount), 0) AS recovered, ROUND(100.0 * COALESCE(SUM(p.amount), 0) / SUM(l.outstanding), 2) AS recovery_pct FROM loans l LEFT JOIN payments p ON p.loan_id = l.loan_id AND p.payment_date > l.write_off_date WHERE l.status = 'Written Off' AND l.write_off_date IS NOT NULL GROUP BY l.product ORDER BY recovery_pct DESC;`,
          `WITH recovered AS (SELECT p.loan_id, SUM(p.amount) AS cash_after FROM payments p GROUP BY p.loan_id) SELECT l.product, COUNT(*) AS loans_written_off, SUM(l.outstanding) AS balance_written_off, COALESCE(SUM(r.cash_after), 0) AS recovered, ROUND(100.0 * COALESCE(SUM(r.cash_after), 0) / SUM(l.outstanding), 2) AS recovery_pct FROM loans l LEFT JOIN recovered r ON r.loan_id = l.loan_id WHERE l.status = 'Written Off' AND l.write_off_date IS NOT NULL GROUP BY l.product ORDER BY recovery_pct DESC;`,
          `WITH recovered AS (SELECT p.loan_id, SUM(p.amount) AS cash_after FROM payments p JOIN loans l ON l.loan_id = p.loan_id WHERE p.payment_date > l.write_off_date GROUP BY p.loan_id) SELECT l.product, COUNT(*) AS loans_written_off, SUM(l.outstanding) AS balance_written_off, COALESCE(SUM(r.cash_after), 0) AS recovered, ROUND(100.0 * COALESCE(SUM(r.cash_after), 0) / SUM(l.outstanding), 2) AS recovery_pct FROM loans l LEFT JOIN recovered r ON r.loan_id = l.loan_id WHERE l.status = 'Written Off' GROUP BY l.product ORDER BY recovery_pct DESC;`,
          `WITH recovered AS (SELECT p.loan_id, SUM(p.amount) AS cash_after FROM payments p JOIN loans l ON l.loan_id = p.loan_id WHERE p.payment_date > l.write_off_date GROUP BY p.loan_id) SELECT l.product, COUNT(*) AS loans_written_off, SUM(l.outstanding) AS balance_written_off, SUM(r.cash_after) AS recovered, ROUND(100.0 * SUM(r.cash_after) / SUM(l.outstanding), 2) AS recovery_pct FROM loans l LEFT JOIN recovered r ON r.loan_id = l.loan_id WHERE l.status = 'Written Off' AND l.write_off_date IS NOT NULL GROUP BY l.product ORDER BY recovery_pct DESC;`,
          `SELECT l.product, COUNT(DISTINCT l.loan_id) AS loans_written_off, SUM(DISTINCT l.outstanding) AS balance_written_off, COALESCE(SUM(p.amount), 0) AS recovered, ROUND(100.0 * COALESCE(SUM(p.amount), 0) / SUM(DISTINCT l.outstanding), 2) AS recovery_pct FROM loans l LEFT JOIN payments p ON p.loan_id = l.loan_id AND p.payment_date > l.write_off_date WHERE l.status = 'Written Off' AND l.write_off_date IS NOT NULL GROUP BY l.product ORDER BY recovery_pct DESC;`,
          `WITH recovered AS (SELECT p.loan_id, SUM(p.amount) AS cash_after FROM payments p JOIN loans l ON l.loan_id = p.loan_id WHERE p.payment_date > l.write_off_date GROUP BY p.loan_id) SELECT l.product, COUNT(*) AS loans_written_off, SUM(l.outstanding) AS balance_written_off, COALESCE(SUM(r.cash_after), 0) AS recovered, 100.0 * COALESCE(SUM(r.cash_after), 0) / SUM(l.outstanding) AS recovery_pct FROM loans l LEFT JOIN recovered r ON r.loan_id = l.loan_id WHERE l.status = 'Written Off' AND l.write_off_date IS NOT NULL GROUP BY l.product ORDER BY recovery_pct DESC;`
        ],
        traps: [
          { re: /^(?![\s\S]*LEFT\s+JOIN)(?![\s\S]*\(\s*SELECT\s+COALESCE)/i, msg: 'A plain JOIN drops loans with no recovery, and KPR loses all of its rows. Use a <code>LEFT JOIN</code>, so a zero stays a zero.' },
          { re: /LEFT\s+JOIN\s+payments/i, msg: 'A loan with two recovery payments becomes two rows here, so its balance is added twice. Total the payments per loan in a CTE first.' },
          { re: /^(?![\s\S]*(write_off_date\s*<|>\s*(l\.|w\.)?write_off_date))/i, msg: 'Payments from before the write-off are normal collections. Recovery only counts <code>payment_date &gt; write_off_date</code>.' },
          { re: /^(?![\s\S]*COALESCE)/i, msg: 'A product with no recovery shows NULL here, and the request says 0. Wrap the total in <code>COALESCE(..., 0)</code>.' },
          { re: /^(?![\s\S]*write_off_date\s+IS\s+NOT\s+NULL)/i, msg: 'Two written-off loans have no <code>write_off_date</code>, so their balance cannot be matched to any recovery. Leave them out with <code>write_off_date IS NOT NULL</code>.' },
          WHOLE_NUMBER_TRAP
        ],
        hints: [
          `Payments and balances live on different rows, so total the payments per loan before you touch the balances.`,
          `In a CTE, join <code>payments</code> to <code>loans</code>, keep <code>p.payment_date &gt; l.write_off_date</code>, and group by <code>p.loan_id</code>.`,
          `Start the main query from <code>loans</code> with a <code>LEFT JOIN</code> to that CTE. Filter on <code>status</code> and on <code>write_off_date IS NOT NULL</code>, and group by <code>product</code>.`,
          `Use <code>COALESCE(SUM(rec.cash_after), 0)</code>, so that KPR shows 0.`
        ],
        win: `KPR shows 0% on over Rp 1 billion, which is worth a question, though five of these loans were written off as recently as 31 October and have had no time to recover. Recovery often runs for years, so compare write-offs of a similar age before judging a team or a product.`,
        atWork: `Many real systems store the balance at write-off in its own record, because the live balance can keep changing. Find that field, and ask how your bank treats legal and agency costs. Banks may also deduct collection costs or use a set time period.`,
        pattern: { sql: `WITH recovered AS (\n  SELECT p.loan_id, SUM(p.amount) AS cash_after\n  FROM payments p\n  JOIN loans l ON l.loan_id = p.loan_id\n  WHERE p.payment_date > l.write_off_date\n  GROUP BY p.loan_id\n)\nSELECT ...,\n  COALESCE(SUM(rec.cash_after), 0) AS recovered\nFROM loans l\nLEFT JOIN recovered rec ON rec.loan_id = l.loan_id`, note: 'Recovery: total cash per loan first, then LEFT JOIN to keep the zeros' }
      },
      {
        id: '9.13',
        title: 'Collector scorecard',
        newIdea: 'Give each measure its own CTE, join them all to one list of people, then RANK inside each team.',
        from: 'Citra, Head of Collection',
        teach: `<p>A [[scorecard]] puts several measures side by side, one row per person. Joining assignments and activities directly would multiply rows and cause [[fan-out]].</p><p>So give each measure its own [[CTE]], one row per collector. Then start from the full list of collectors, <code>LEFT JOIN</code> each step, and use <code>COALESCE</code> to turn missing values into zeros. Rank last, with <code>PARTITION BY</code>, so each team has its own ranking. Agree on the measures first.</p>`,
        ex: [
          [`WITH book AS (`, `First make a step called book`],
          [`  SELECT l.branch_id, COUNT(l.loan_id) AS loans`, `with the number of loans per branch`],
          [`  FROM loans l`, `from the loans table,`],
          [`  WHERE l.status <> 'Written Off'`, `leaving out write-offs,`],
          [`  GROUP BY l.branch_id`, `one row per branch,`],
          [`),`, `and next`],
          [`staff AS (`, `make a step called staff`],
          [`  SELECT k.branch_id, COUNT(k.collector_id) AS people`, `with the number of people per branch`],
          [`  FROM collectors k`, `from the collectors table,`],
          [`  GROUP BY k.branch_id`, `one row per branch,`],
          [`)`, `and then`],
          [`SELECT b.branch_name,`, `show each branch's name,`],
          [`  COALESCE(bk.loans, 0) AS loans,`, `its loans or a zero,`],
          [`  COALESCE(st.people, 0) AS people,`, `its people or a zero,`],
          [`  RANK() OVER (ORDER BY COALESCE(bk.loans, 0) DESC) AS loan_rank`, `and its rank by loans, with ties sharing a rank,`],
          [`FROM branches b`, `starting from every branch,`],
          [`LEFT JOIN book bk ON bk.branch_id = b.branch_id`, `adding the first step`],
          [`LEFT JOIN staff st ON st.branch_id = b.branch_id`, `and the second step,`],
          [`ORDER BY loan_rank;`, `with the top rank first.`]
        ],
        exNote: `This is a general definition. Your bank's may differ.`,
        bridge: 'Like a summary sheet that pulls one column each from several helper sheets, using one lookup per measure.',
        task: `I compare Field and Agency next week. One row per collector in those teams, 0 where they have nothing: <code>team</code>, <code>collector_name</code>, <code>active_cases</code> (no <code>unassigned_date</code>), <code>attempts</code> (Call, WhatsApp, Visit), <code>kept_promises</code> (kept rate rule), <code>cash_credited</code> (Collector channel payments on loans they held that day), <code>kept_rank</code> (RANK within team, most first). Sort by team, then rank.`,
        solution: `WITH cases AS (
  SELECT g.collector_id, COUNT(g.assignment_id) AS active_cases
  FROM loan_assignments g
  WHERE g.unassigned_date IS NULL
  GROUP BY g.collector_id
),
work AS (
  SELECT a.collector_id, COUNT(a.activity_id) AS attempts
  FROM collection_activities a
  WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit')
  GROUP BY a.collector_id
),
kept AS (
  SELECT a.collector_id, COUNT(a.activity_id) AS kept_promises
  FROM collection_activities a
  WHERE a.result = 'PTP'
    AND a.ptp_date <= '2026-10-31'
    AND a.ptp_date >= a.activity_date
    AND EXISTS (
      SELECT 1
      FROM payments p
      WHERE p.loan_id = a.loan_id
        AND p.payment_date BETWEEN a.activity_date AND a.ptp_date
    )
  GROUP BY a.collector_id
),
credited AS (
  SELECT g.collector_id, SUM(p.amount) AS cash_credited
  FROM payments p
  JOIN loan_assignments g
    ON g.loan_id = p.loan_id
    AND g.assigned_date <= p.payment_date
    AND (g.unassigned_date IS NULL OR g.unassigned_date >= p.payment_date)
  WHERE p.channel = 'Collector'
  GROUP BY g.collector_id
)
SELECT k.team,
  k.collector_name,
  COALESCE(ca.active_cases, 0) AS active_cases,
  COALESCE(wk.attempts, 0) AS attempts,
  COALESCE(kp.kept_promises, 0) AS kept_promises,
  COALESCE(cr.cash_credited, 0) AS cash_credited,
  RANK() OVER (PARTITION BY k.team ORDER BY COALESCE(kp.kept_promises, 0) DESC) AS kept_rank
FROM collectors k
LEFT JOIN cases ca
  ON ca.collector_id = k.collector_id
LEFT JOIN work wk
  ON wk.collector_id = k.collector_id
LEFT JOIN kept kp
  ON kp.collector_id = k.collector_id
LEFT JOIN credited cr
  ON cr.collector_id = k.collector_id
WHERE k.team IN ('Field', 'Agency')
ORDER BY k.team, kept_rank;`,
        ordered: 'kept_rank',
        altSolutions: [
          `${SCORE_CTES}, ${CREDITED}, scored AS (SELECT ${SCORE_COLS} ${SCORE_JOINS} WHERE k.team IN ('Field', 'Agency')) SELECT team, collector_name, active_cases, attempts, kept_promises, cash_credited, RANK() OVER (PARTITION BY team ORDER BY kept_promises DESC) AS kept_rank FROM scored ORDER BY team, kept_rank;`,
          `${SCORE_CTES}, credited AS (SELECT k.collector_id, SUM(p.amount) AS cash_credited FROM collectors k JOIN loan_assignments g ON g.collector_id = k.collector_id JOIN payments p ON p.loan_id = g.loan_id AND p.channel = 'Collector' AND p.payment_date BETWEEN g.assigned_date AND COALESCE(g.unassigned_date, '9999-12-31') GROUP BY k.collector_id) SELECT ${SCORE_COLS}, RANK() OVER (PARTITION BY k.team ORDER BY COALESCE(kp.kept_promises, 0) DESC) AS kept_rank ${SCORE_JOINS} WHERE k.team IN ('Field', 'Agency') ORDER BY k.team, kept_rank;`
        ],
        wrong: [
          `${SCORE_CTES}, ${CREDITED} SELECT ${SCORE_COLS}, RANK() OVER (ORDER BY COALESCE(kp.kept_promises, 0) DESC) AS kept_rank ${SCORE_JOINS} WHERE k.team IN ('Field', 'Agency') ORDER BY k.team, kept_rank;`,
          `${SCORE_CTES}, ${CREDITED} SELECT ${SCORE_COLS}, DENSE_RANK() OVER (PARTITION BY k.team ORDER BY COALESCE(kp.kept_promises, 0) DESC) AS kept_rank ${SCORE_JOINS} WHERE k.team IN ('Field', 'Agency') ORDER BY k.team, kept_rank;`,
          `${SCORE_CTES}, credited AS (SELECT g.collector_id, SUM(p.amount) AS cash_credited FROM payments p JOIN loan_assignments g ON g.loan_id = p.loan_id AND g.unassigned_date IS NULL WHERE p.channel = 'Collector' GROUP BY g.collector_id) SELECT ${SCORE_COLS}, RANK() OVER (PARTITION BY k.team ORDER BY COALESCE(kp.kept_promises, 0) DESC) AS kept_rank ${SCORE_JOINS} WHERE k.team IN ('Field', 'Agency') ORDER BY k.team, kept_rank;`,
          `${SCORE_CTES}, credited AS (SELECT g.collector_id, SUM(p.amount) AS cash_credited FROM payments p JOIN loan_assignments g ON g.loan_id = p.loan_id AND g.assigned_date <= p.payment_date AND g.unassigned_date IS NULL OR g.unassigned_date >= p.payment_date WHERE p.channel = 'Collector' GROUP BY g.collector_id) SELECT ${SCORE_COLS}, RANK() OVER (PARTITION BY k.team ORDER BY COALESCE(kp.kept_promises, 0) DESC) AS kept_rank ${SCORE_JOINS} WHERE k.team IN ('Field', 'Agency') ORDER BY k.team, kept_rank;`,
          `${SCORE_CTES}, ${CREDITED} SELECT ${SCORE_COLS}, RANK() OVER (PARTITION BY k.team ORDER BY COALESCE(kp.kept_promises, 0) DESC) AS kept_rank FROM collectors k JOIN cases ca ON ca.collector_id = k.collector_id JOIN work wk ON wk.collector_id = k.collector_id JOIN kept kp ON kp.collector_id = k.collector_id LEFT JOIN credited cr ON cr.collector_id = k.collector_id WHERE k.team IN ('Field', 'Agency') ORDER BY k.team, kept_rank;`,
          `${SCORE_CTES}, ${CREDITED} SELECT ${SCORE_COLS}, RANK() OVER (PARTITION BY k.team ORDER BY COALESCE(kp.kept_promises, 0) DESC) AS kept_rank ${SCORE_JOINS} WHERE k.team = 'Field' ORDER BY k.team, kept_rank;`
        ],
        traps: [
          { re: /DENSE_RANK|ROW_NUMBER/i, msg: 'The request says <code>RANK</code>. <code>DENSE_RANK</code> leaves no gap after a tie, and <code>ROW_NUMBER</code> breaks ties at random, so they give different numbers here.' },
          { re: /RANK\s*\(\s*\)\s*OVER\s*\(\s*ORDER/i, msg: 'This ranks everyone in one list. The request ranks within each team, so add <code>PARTITION BY k.team</code>.' },
          { re: /\bFROM\s+collectors\s+k\s+JOIN\b/i, msg: 'A plain JOIN from <code>collectors</code> drops people with no activity. Those zeros need to stay on a scorecard, so use <code>LEFT JOIN</code> and <code>COALESCE</code>.' },
          { re: /LEFT\s+JOIN\s+(loan_assignments|collection_activities)[\s\S]*LEFT\s+JOIN\s+(loan_assignments|collection_activities)/i, msg: 'Joining two many-row tables at once multiplies them against each other. Give each measure its own CTE, one row per collector.' },
          { re: /^(?![\s\S]*unassigned_date\s+IS\s+NULL)/i, msg: 'An active case has no end date. Count only assignments where <code>unassigned_date IS NULL</code>.' },
          { re: /^(?![\s\S]*assigned_date\s*<=|[\s\S]*BETWEEN\s+g\.assigned_date)/i, msg: 'Cash goes to whoever held the loan on the payment date, so test the date range from Level 7 in the <code>ON</code>.' }
        ],
        hints: [
          `Write four small CTEs, each with <code>collector_id</code> and one measure, grouped by <code>collector_id</code>.`,
          `The promises CTE reuses the rule from the kept rate mission. The cash CTE joins <code>payments</code> to <code>loan_assignments</code> with the date range from Level 7, for the <code>Collector</code> channel.`,
          `In the main query, start <code>FROM collectors k</code>, use <code>LEFT JOIN</code> for each CTE, and filter <code>k.team IN ('Field', 'Agency')</code>.`,
          `Wrap each measure in <code>COALESCE(..., 0)</code>, and finish with <code>RANK() OVER (PARTITION BY k.team ORDER BY COALESCE(kp.kept_promises, 0) DESC)</code>.`
        ],
        win: `Five people show all zeros, four team leads and one newcomer who joined on 20 October, and a plain JOIN would have hidden them, so check who belongs on a scorecard. Budi Daulay brings in the most cash with only the second-most kept promises in Field, so read the measures together, and check what kind of loans each person holds before you read a rank as performance.`,
        atWork: `NULLs sort differently by database. On Oracle and PostgreSQL they come first in <code>DESC</code>, so always use <code>COALESCE</code> inside the <code>ORDER BY</code> of a rank.`,
        pattern: { sql: `WITH measure_a AS (\n  SELECT person_id, COUNT(some_id) AS a FROM ... GROUP BY person_id\n),\nmeasure_b AS (\n  SELECT person_id, COUNT(some_id) AS b FROM ... GROUP BY person_id\n)\nSELECT p.name,\n  COALESCE(x.a, 0) AS a,\n  COALESCE(y.b, 0) AS b,\n  RANK() OVER (ORDER BY COALESCE(y.b, 0) DESC) AS b_rank\nFROM people p\nLEFT JOIN measure_a x ON x.person_id = p.person_id\nLEFT JOIN measure_b y ON y.person_id = p.person_id;`, note: 'Scorecard: one CTE per measure, LEFT JOIN each to the full list, then rank' }
      },
      {
        id: '9.14',
        title: 'The book as it stood',
        newIdea: "A month-end report takes each loan off the book in its write-off month, whatever its status says today.",
        from: 'Dimas, Portfolio Analyst',
        teach: `<p>The [[book]] filter you have used, <code>status &lt;&gt; 'Written Off'</code>, describes today. A loan written off in June was on the book in May, and that filter removes it from May too.</p><p>A report of the past needs the date. A loan stays until the month of its <code>write_off_date</code>. Written-off loans with no date stay out of every month, since nobody can say when they left.</p>`,
        ex: [
          [`SELECT COUNT(*) AS loans,`, `Show how many loans`],
          [`  SUM(s.outstanding) AS book_balance`, `and how much balance were on the book,`],
          [`FROM loan_snapshots s`, `from the snapshots`],
          [`JOIN loans l ON l.loan_id = s.loan_id`, `joined to each loan,`],
          [`WHERE s.snapshot_month = '2026-06'`, `at the end of June,`],
          [`  AND (l.status <> 'Written Off'`, `keeping a loan that is not written off today`],
          [`    OR substr(l.write_off_date, 1, 7) > s.snapshot_month);`, `or one written off after that month.`]
        ],
        exNote: `Six loans were written off on 30 June, so they are already out of this number. Your task does this for every month.`,
        bridge: 'Like a balance sheet as at a date, which ignores everything that happened after it.',
        task: `I need the book as it stood at each month end. Per <code>snapshot_month</code>, oldest first: <code>loans</code> and <code>book_balance</code>. A loan leaves the book in the month of its <code>write_off_date</code>. Written-off loans with no date stay out of every month.`,
        solution: `SELECT s.snapshot_month,
  COUNT(*) AS loans,
  SUM(s.outstanding) AS book_balance
FROM loan_snapshots s
JOIN loans l
  ON l.loan_id = s.loan_id
WHERE l.status <> 'Written Off'
  OR substr(l.write_off_date, 1, 7) > s.snapshot_month
GROUP BY s.snapshot_month
ORDER BY s.snapshot_month;`,
        ordered: 'snapshot_month',
        altSolutions: [
          `SELECT s.snapshot_month, COUNT(*) AS loans, SUM(s.outstanding) AS book_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE l.status <> 'Written Off' OR strftime('%Y-%m', l.write_off_date) > s.snapshot_month GROUP BY s.snapshot_month ORDER BY s.snapshot_month;`,
          `SELECT s.snapshot_month, COUNT(*) AS loans, SUM(s.outstanding) AS book_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE l.status <> 'Written Off' OR l.write_off_date >= date(s.snapshot_month || '-01', '+1 month') GROUP BY s.snapshot_month ORDER BY s.snapshot_month;`
        ],
        wrong: [
          `SELECT s.snapshot_month, COUNT(*) AS loans, SUM(s.outstanding) AS book_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE l.status <> 'Written Off' GROUP BY s.snapshot_month ORDER BY s.snapshot_month;`,
          `SELECT s.snapshot_month, COUNT(*) AS loans, SUM(s.outstanding) AS book_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE l.write_off_date IS NULL OR substr(l.write_off_date, 1, 7) > s.snapshot_month GROUP BY s.snapshot_month ORDER BY s.snapshot_month;`,
          `SELECT s.snapshot_month, COUNT(*) AS loans, SUM(s.outstanding) AS book_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE l.status <> 'Written Off' OR l.write_off_date > s.snapshot_month GROUP BY s.snapshot_month ORDER BY s.snapshot_month;`,
          `SELECT s.snapshot_month, COUNT(*) AS loans, SUM(s.outstanding) AS book_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id WHERE l.status <> 'Written Off' OR substr(l.write_off_date, 1, 7) >= s.snapshot_month GROUP BY s.snapshot_month ORDER BY s.snapshot_month;`,
          `SELECT s.snapshot_month, COUNT(*) AS loans, SUM(s.outstanding) AS book_balance FROM loan_snapshots s GROUP BY s.snapshot_month ORDER BY s.snapshot_month;`
        ],
        traps: [
          { re: /^(?![\s\S]*write_off_date)/i, msg: 'Today\'s <code>status</code> alone removes a loan from every month, even months it was still on the book. Use <code>write_off_date</code> to keep it until the month it left.' },
          { re: /^(?![\s\S]*status)[\s\S]*write_off_date\s+IS\s+NULL/i, msg: 'This keeps the two written-off loans that have no date. They stay out of every month, so test <code>status</code> as well.' },
          { re: /\bwrite_off_date\s*>=?\s*(\w+\.)?snapshot_month/i, msg: 'A full date such as 2026-06-15 sorts after the month 2026-06, so the loan stays in its write-off month. Compare month with month, using <code>substr(write_off_date, 1, 7)</code>.' }
        ],
        hints: [
          `Group the snapshot rows by <code>snapshot_month</code>, and join <code>loans</code> for <code>status</code> and <code>write_off_date</code>.`,
          `A row stays if the loan is not Written Off today, or if it was written off in a later month than this row.`,
          `<code>WHERE l.status &lt;&gt; 'Written Off' OR substr(l.write_off_date, 1, 7) &gt; s.snapshot_month</code>`
        ],
        win: `The book falls from 500 loans in January to 479 in October as write-offs leave it. A filter on today's status would show the NPL share climbing from 3.28% in January to 6.10% in September, when the book as it stood fell from 9.34% to 7.86%.`,
        atWork: `This filter compares two columns row by row, so no index was going to pick these rows, and <code>substr</code> costs nothing here. The rule from Level 8 is about a function around a column you filter by a fixed value. October comes to Rp 750,000 above <code>SUM(outstanding)</code> in <code>loans</code>, which is the break you reconciled in Level 7.`,
        pattern: { sql: `SELECT s.snapshot_month,\n  COUNT(*) AS loans,\n  SUM(s.outstanding) AS book_balance\nFROM loan_snapshots s\nJOIN loans l\n  ON l.loan_id = s.loan_id\nWHERE l.status <> 'Written Off'\n  OR substr(l.write_off_date, 1, 7) > s.snapshot_month\nGROUP BY s.snapshot_month;`, note: 'The book as it stood at each month end' }
      },
      {
        id: '9.15',
        title: 'NPL roll-forward',
        newIdea: 'A roll-forward explains a change in balance line by line, from opening to closing.',
        from: 'Citra, Head of Collection',
        teach: `<p>A change in a number always gets one question: why? A [[roll-forward]] answers it. Start from the opening balance, show each movement on its own line, and finish on the closing balance. If the lines do not add up to the closing number, something is missing.</p><p>Put one row per loan in a CTE, with its grade and balance in both months. Then each line is one <code>SELECT</code> from that step, stacked with <code>UNION ALL</code>.</p>`,
        ex: [
          [`WITH moves AS (`, `First make a step called moves`],
          [`  SELECT s8.collectibility AS kol_aug, s9.collectibility AS kol_sep`, `with each loan's grade in August and in September,`],
          [`  FROM loan_snapshots s8`, `starting from the snapshot rows`],
          [`  JOIN loan_snapshots s9 ON s9.loan_id = s8.loan_id AND s9.snapshot_month = '2026-09'`, `paired with the same loan's September row,`],
          [`  WHERE s8.snapshot_month = '2026-08'`, `using August as the start,`],
          [`)`, `and then`],
          [`SELECT 1 AS line_no, 'Opening' AS line, COUNT(*) AS loans FROM moves WHERE kol_aug >= 3`, `count the NPL loans in August,`],
          [`UNION ALL`, `stack underneath`],
          [`SELECT 2, 'Closing', COUNT(*) FROM moves WHERE kol_sep >= 3`, `the NPL loans in September,`],
          [`ORDER BY line_no;`, `in line order.`]
        ],
        exNote: `These two lines are only the ends. Your task fills in what moved between them.`,
        bridge: 'Like an allowance or fixed asset roll-forward: opening balance, additions, deductions, closing balance.',
        task: `Why did NPL fall in October? Using the 2026-09 and 2026-10 snapshots, the book as it stood, with <code>line_no</code>, <code>line</code>, <code>loans</code> and <code>amount</code> (minus for a fall): 1 <code>Opening</code>, 2 <code>Written off</code>, 3 <code>Left NPL</code> (still on the book), all at September balances; 4 <code>Entered NPL</code>, 5 <code>Closing</code>, at October balances.`,
        solution: `WITH moves AS (
  SELECT l.status,
    s9.collectibility AS kol_sep,
    s9.outstanding AS bal_sep,
    s10.collectibility AS kol_oct,
    s10.outstanding AS bal_oct
  FROM loans l
  JOIN loan_snapshots s9
    ON s9.loan_id = l.loan_id
    AND s9.snapshot_month = '2026-09'
  JOIN loan_snapshots s10
    ON s10.loan_id = l.loan_id
    AND s10.snapshot_month = '2026-10'
  WHERE l.status <> 'Written Off'
    OR substr(l.write_off_date, 1, 7) = '2026-10'
)
SELECT 1 AS line_no, 'Opening' AS line, COUNT(*) AS loans, SUM(bal_sep) AS amount
FROM moves
WHERE kol_sep >= 3
UNION ALL
SELECT 2, 'Written off', COUNT(*), -SUM(bal_sep)
FROM moves
WHERE kol_sep >= 3
  AND status = 'Written Off'
UNION ALL
SELECT 3, 'Left NPL', COUNT(*), -SUM(bal_sep)
FROM moves
WHERE kol_sep >= 3
  AND kol_oct < 3
  AND status <> 'Written Off'
UNION ALL
SELECT 4, 'Entered NPL', COUNT(*), SUM(bal_oct)
FROM moves
WHERE kol_sep < 3
  AND kol_oct >= 3
  AND status <> 'Written Off'
UNION ALL
SELECT 5, 'Closing', COUNT(*), SUM(bal_oct)
FROM moves
WHERE kol_oct >= 3
  AND status <> 'Written Off'
ORDER BY line_no;`,
        ordered: 'line_no',
        altSolutions: [
          `WITH moves AS (SELECT l.status, s9.collectibility AS kol_sep, s9.outstanding AS bal_sep, s10.collectibility AS kol_oct, s10.outstanding AS bal_oct FROM loans l JOIN loan_snapshots s9 ON s9.loan_id = l.loan_id AND s9.snapshot_month = '2026-09' JOIN loan_snapshots s10 ON s10.loan_id = l.loan_id AND s10.snapshot_month = '2026-10' WHERE l.status <> 'Written Off' OR substr(l.write_off_date, 1, 7) >= '2026-10'), lines AS (SELECT CASE WHEN kol_sep >= 3 AND status = 'Written Off' THEN 2 WHEN kol_sep >= 3 AND kol_oct < 3 THEN 3 WHEN kol_sep < 3 AND kol_oct >= 3 AND status <> 'Written Off' THEN 4 END AS line_no, bal_sep, bal_oct FROM moves) SELECT 1 AS line_no, 'Opening' AS line, COUNT(*) AS loans, SUM(bal_sep) AS amount FROM moves WHERE kol_sep >= 3 UNION ALL SELECT line_no, CASE line_no WHEN 2 THEN 'Written off' WHEN 3 THEN 'Left NPL' ELSE 'Entered NPL' END, COUNT(*), CASE line_no WHEN 4 THEN SUM(bal_oct) ELSE -SUM(bal_sep) END FROM lines WHERE line_no IS NOT NULL GROUP BY line_no UNION ALL SELECT 5, 'Closing', COUNT(*), SUM(bal_oct) FROM moves WHERE kol_oct >= 3 AND status <> 'Written Off' ORDER BY line_no;`
        ],
        wrong: [
          `WITH moves AS (SELECT l.status, s9.collectibility AS kol_sep, s9.outstanding AS bal_sep, s10.collectibility AS kol_oct, s10.outstanding AS bal_oct FROM loans l JOIN loan_snapshots s9 ON s9.loan_id = l.loan_id AND s9.snapshot_month = '2026-09' JOIN loan_snapshots s10 ON s10.loan_id = l.loan_id AND s10.snapshot_month = '2026-10' WHERE l.status <> 'Written Off') SELECT 1 AS line_no, 'Opening' AS line, COUNT(*) AS loans, SUM(bal_sep) AS amount FROM moves WHERE kol_sep >= 3 UNION ALL SELECT 2, 'Written off', COUNT(*), -SUM(bal_sep) FROM moves WHERE kol_sep >= 3 AND status = 'Written Off' UNION ALL SELECT 3, 'Left NPL', COUNT(*), -SUM(bal_sep) FROM moves WHERE kol_sep >= 3 AND kol_oct < 3 AND status <> 'Written Off' UNION ALL SELECT 4, 'Entered NPL', COUNT(*), SUM(bal_oct) FROM moves WHERE kol_sep < 3 AND kol_oct >= 3 AND status <> 'Written Off' UNION ALL SELECT 5, 'Closing', COUNT(*), SUM(bal_oct) FROM moves WHERE kol_oct >= 3 AND status <> 'Written Off' ORDER BY line_no;`,
          `WITH moves AS (SELECT l.status, s9.collectibility AS kol_sep, s9.outstanding AS bal_sep, s10.collectibility AS kol_oct, s10.outstanding AS bal_oct FROM loans l JOIN loan_snapshots s9 ON s9.loan_id = l.loan_id AND s9.snapshot_month = '2026-09' JOIN loan_snapshots s10 ON s10.loan_id = l.loan_id AND s10.snapshot_month = '2026-10' WHERE l.status <> 'Written Off' OR substr(l.write_off_date, 1, 7) = '2026-10') SELECT 1 AS line_no, 'Opening' AS line, COUNT(*) AS loans, SUM(bal_sep) AS amount FROM moves WHERE kol_sep >= 3 UNION ALL SELECT 2, 'Written off', COUNT(*), SUM(bal_sep) FROM moves WHERE kol_sep >= 3 AND status = 'Written Off' UNION ALL SELECT 3, 'Left NPL', COUNT(*), SUM(bal_sep) FROM moves WHERE kol_sep >= 3 AND kol_oct < 3 AND status <> 'Written Off' UNION ALL SELECT 4, 'Entered NPL', COUNT(*), SUM(bal_oct) FROM moves WHERE kol_sep < 3 AND kol_oct >= 3 AND status <> 'Written Off' UNION ALL SELECT 5, 'Closing', COUNT(*), SUM(bal_oct) FROM moves WHERE kol_oct >= 3 AND status <> 'Written Off' ORDER BY line_no;`,
          `WITH moves AS (SELECT l.status, s9.collectibility AS kol_sep, s9.outstanding AS bal_sep, s10.collectibility AS kol_oct, s10.outstanding AS bal_oct FROM loans l JOIN loan_snapshots s9 ON s9.loan_id = l.loan_id AND s9.snapshot_month = '2026-09' JOIN loan_snapshots s10 ON s10.loan_id = l.loan_id AND s10.snapshot_month = '2026-10' WHERE l.status <> 'Written Off' OR substr(l.write_off_date, 1, 7) = '2026-10') SELECT 1 AS line_no, 'Opening' AS line, COUNT(*) AS loans, SUM(bal_sep) AS amount FROM moves WHERE kol_sep >= 3 UNION ALL SELECT 2, 'Written off', COUNT(*), -SUM(bal_sep) FROM moves WHERE kol_sep >= 3 AND status = 'Written Off' UNION ALL SELECT 3, 'Left NPL', COUNT(*), -SUM(bal_sep) FROM moves WHERE kol_sep >= 3 AND kol_oct < 3 AND status <> 'Written Off' UNION ALL SELECT 4, 'Entered NPL', COUNT(*), SUM(bal_oct) FROM moves WHERE kol_sep < 3 AND kol_oct >= 3 AND status <> 'Written Off' UNION ALL SELECT 5, 'Closing', COUNT(*), SUM(bal_oct) FROM moves WHERE kol_oct >= 3 ORDER BY line_no;`
        ],
        traps: [
          { re: /^(?![\s\S]*write_off_date)/i, msg: 'Today\'s status has already removed the loans written off in October, so the opening balance is too small. Keep them in with <code>write_off_date</code>, as in the last mission.' },
          { re: /'Written off'\s*,\s*COUNT\s*\(\s*\*\s*\)\s*,\s*SUM|'Left NPL'\s*,\s*COUNT\s*\(\s*\*\s*\)\s*,\s*SUM/i, msg: 'Movements down the balance need a minus sign, so the column adds up: <code>-SUM(bal_sep)</code>.' },
          { re: /\bJOIN\s+payments\b/i, msg: 'The roll-forward moves balances between grades, so it does not need <code>payments</code>.' }
        ],
        hints: [
          `Build the CTE first: one row per loan, with <code>status</code>, its Kol and balance in September, and its Kol and balance in October. Keep loans on the book in September.`,
          `Each line is <code>SELECT line_no, label, COUNT(*), amount FROM moves WHERE ...</code>. Run each one alone before you stack them.`,
          `Opening is <code>kol_sep &gt;= 3</code>. Written off adds <code>status = 'Written Off'</code>. Left NPL is <code>kol_sep &gt;= 3 AND kol_oct &lt; 3</code> and not written off. Entered NPL is the reverse. Closing is <code>kol_oct &gt;= 3</code> and not written off.`,
          `Check it by hand: 2,582,534,000 minus 617,228,000 minus 685,393,000 plus 73,676,000 should be the closing balance.`
        ],
        win: `NPL fell Rp 1.23 billion in October because 5 loans were written off (Rp 617 million) and 5 Restructured loans left NPL (Rp 685 million), while 5 new loans came in. Very little of that fall is cash, and a head of collection needs to know that before someone asks.`,
        atWork: `A full roll-forward also has a line for balance changes on loans that stay in NPL. In this month that line is 0, so it is left out here. Put <code>line_no</code> in your report, because no database promises to keep the order of <code>UNION ALL</code> without an <code>ORDER BY</code>.`,
        pattern: { sql: `SELECT 1 AS line_no, 'Opening' AS line, SUM(bal_start) AS amount FROM moves WHERE ...\nUNION ALL\nSELECT 2, 'Went out', -SUM(bal_start) FROM moves WHERE ...\nUNION ALL\nSELECT 3, 'Came in', SUM(bal_end) FROM moves WHERE ...\nUNION ALL\nSELECT 4, 'Closing', SUM(bal_end) FROM moves WHERE ...\nORDER BY line_no;`, note: 'Roll-forward: opening, movements, closing' }
      },
      {
        id: '9.16',
        type: 'quiz',
        title: 'Turn a request into a spec',
        newIdea: 'A vague request becomes a spec when you ask about the period, the loans and the definition.',
        teach: `<p>Every task in this course told you the rows and columns. At work, you write that part yourself. A short [[spec]] says the period, the loans in scope, how each number is defined, and who will read it.</p><p>Ask before you write any SQL. One question now saves rebuilding the report later.</p>`,
        bridge: 'Like agreeing the scope of an audit request before you pull any ledgers.',
        question: `Citra stops by your desk and says, "How is recovery going?" You know <code>payments</code> and <code>write_off_date</code> well. What do you do first?`,
        choices: [
          { t: 'Ask which period she means, which written-off loans count, and whether costs come off the cash.', correct: true, why: 'Yes. Each of those changes the number. Write the answers down and read them back, and you have a spec she can agree to.' },
          { t: 'Run the recovery rate from this level and send it to her.', why: 'That answers your own reading of the question. If she meant this year\'s write-offs net of agency fees, you rebuild it, and she may have repeated the wrong figure by then.' },
          { t: 'Ask her which tables and columns she wants.', why: 'She knows the business question, and the tables are your part. Ask about meaning, such as the period and the definition.' },
          { t: 'Send every payment made after write-off, so she can decide.', why: 'A long list moves the work to her, and it has already chosen a period and a base without saying so.' }
        ],
        win: `A written spec also protects you. When someone questions the number, you can show what was agreed and change one line.`
      },
      {
        id: '9.17',
        exam: true,
        title: 'Exam: monthly collection pack',
        newIdea: 'No new SQL here. This exam combines month-end balances, cash and a change from the prior month.',
        from: 'Citra, Head of Collection',
        teach: `<p>The final exam has four parts, and you have used every piece before. There are no hints and no preview. Run as many times as you need, with no penalty and no time limit. Your Cheat sheet and earlier missions stay open. The model answer appears once you clear it.</p><p>A pack is the numbers I read each month, so each month must show the book as it stood then. A loan leaves the book in the month of its <code>write_off_date</code>. Written-off loans with no date stay out of every month. Your 2026-10 <code>book_balance</code> should come close to <code>SUM(outstanding)</code> for loans not Written Off.</p>`,
        bridge: 'Like the monthly management pack you would build from a loan listing and a cash book.',
        task: `Per <code>snapshot_month</code>, oldest first, for loans on the book that month: <code>loans</code>, <code>book_balance</code>, <code>npl_balance</code> (Kol 3 or worse), <code>npl_change</code> from the prior month (empty for the first month), <code>par_30_pct</code> (<code>dpd</code> above 30, percent of <code>book_balance</code>, 2 decimals). Add <code>cash_collected</code>: payments above 0 in that calendar month, written-off loans included.`,
        solution: `WITH book AS (
  SELECT s.snapshot_month,
    COUNT(s.loan_id) AS loans,
    SUM(s.outstanding) AS book_balance,
    SUM(CASE WHEN s.collectibility >= 3 THEN s.outstanding ELSE 0 END) AS npl_balance,
    SUM(CASE WHEN s.dpd > 30 THEN s.outstanding ELSE 0 END) AS par_30_balance
  FROM loan_snapshots s
  JOIN loans l
    ON l.loan_id = s.loan_id
  WHERE l.status <> 'Written Off'
    OR substr(l.write_off_date, 1, 7) > s.snapshot_month
  GROUP BY s.snapshot_month
),
cash AS (
  SELECT strftime('%Y-%m', p.payment_date) AS snapshot_month,
    SUM(p.amount) AS cash_collected
  FROM payments p
  WHERE p.amount > 0
  GROUP BY strftime('%Y-%m', p.payment_date)
)
SELECT bk.snapshot_month,
  bk.loans,
  bk.book_balance,
  bk.npl_balance,
  bk.npl_balance - LAG(bk.npl_balance) OVER (ORDER BY bk.snapshot_month) AS npl_change,
  ROUND(100.0 * bk.par_30_balance / bk.book_balance, 2) AS par_30_pct,
  ca.cash_collected
FROM book bk
LEFT JOIN cash ca
  ON ca.snapshot_month = bk.snapshot_month
ORDER BY bk.snapshot_month;`,
        precision: 4,
        ordered: 'snapshot_month',
        altSolutions: [
          `WITH book AS (${PACK_BOOK(ON_BOOK)}) SELECT b.snapshot_month, b.loans, b.book_balance, b.npl_balance, b.npl_balance - LAG(b.npl_balance) OVER (ORDER BY b.snapshot_month) AS npl_change, ROUND(100.0 * b.par_30_balance / b.book_balance, 2) AS par_30_pct, (SELECT SUM(p.amount) FROM payments p WHERE p.amount > 0 AND substr(p.payment_date, 1, 7) = b.snapshot_month) AS cash_collected FROM book b ORDER BY b.snapshot_month;`,
          `WITH book AS (${PACK_BOOK(ON_BOOK)}), cash AS (SELECT substr(p.payment_date, 1, 7) AS m, SUM(CASE WHEN p.amount > 0 THEN p.amount ELSE 0 END) AS cash_collected FROM payments p GROUP BY m), trend AS (SELECT snapshot_month, loans, book_balance, npl_balance, LAG(npl_balance) OVER (ORDER BY snapshot_month) AS prior_npl, par_30_balance FROM book) SELECT t.snapshot_month, t.loans, t.book_balance, t.npl_balance, t.npl_balance - t.prior_npl AS npl_change, ROUND(t.par_30_balance * 100.0 / t.book_balance, 2) AS par_30_pct, c.cash_collected FROM trend t JOIN cash c ON c.m = t.snapshot_month ORDER BY t.snapshot_month;`,
          `WITH book AS (${PACK_BOOK(`WHERE NOT (l.status = 'Written Off' AND (l.write_off_date IS NULL OR strftime('%Y-%m', l.write_off_date) <= s.snapshot_month))`)}), cash AS (SELECT strftime('%Y-%m', p.payment_date) AS snapshot_month, SUM(p.amount) AS cash_collected FROM payments p WHERE p.amount > 0 GROUP BY 1) ${PACK_OUT}`
        ],
        requires: [ON_THE_LIMIT([30])],
        wrong: [
          `SELECT s.snapshot_month, COUNT(*) AS loans, SUM(s.outstanding) AS book_balance, SUM(CASE WHEN s.collectibility >= 3 THEN s.outstanding ELSE 0 END) AS npl_balance, SUM(CASE WHEN s.collectibility >= 3 THEN s.outstanding ELSE 0 END) - LAG(SUM(CASE WHEN s.collectibility >= 3 THEN s.outstanding ELSE 0 END)) OVER (ORDER BY s.snapshot_month) AS npl_change, ROUND(100.0 * SUM(CASE WHEN s.dpd > 30 THEN s.outstanding ELSE 0 END) / SUM(s.outstanding), 2) AS par_30_pct, SUM(p.amount) AS cash_collected FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id LEFT JOIN payments p ON p.loan_id = s.loan_id AND strftime('%Y-%m', p.payment_date) = s.snapshot_month AND p.amount > 0 ${ON_BOOK} GROUP BY s.snapshot_month ORDER BY s.snapshot_month;`,
          `WITH book AS (${PACK_BOOK('')}), cash AS (SELECT strftime('%Y-%m', p.payment_date) AS snapshot_month, SUM(p.amount) AS cash_collected FROM payments p WHERE p.amount > 0 GROUP BY 1) ${PACK_OUT}`,
          `WITH book AS (${PACK_BOOK(ON_BOOK)}), cash AS (SELECT strftime('%Y-%m', p.payment_date) AS snapshot_month, SUM(p.amount) AS cash_collected FROM payments p GROUP BY 1) ${PACK_OUT}`,
          `WITH book AS (${PACK_BOOK(ON_BOOK)}), cash AS (SELECT strftime('%Y-%m', p.payment_date) AS snapshot_month, SUM(p.amount) AS cash_collected FROM payments p JOIN loans l ON l.loan_id = p.loan_id WHERE p.amount > 0 AND l.status <> 'Written Off' GROUP BY 1) ${PACK_OUT}`,
          `WITH book AS (${PACK_BOOK(ON_BOOK)}), cash AS (SELECT strftime('%Y-%m', p.payment_date) AS snapshot_month, SUM(p.amount) AS cash_collected FROM payments p WHERE p.amount > 0 GROUP BY 1) SELECT b.snapshot_month, b.loans, b.book_balance, b.npl_balance, b.npl_balance - LEAD(b.npl_balance) OVER (ORDER BY b.snapshot_month) AS npl_change, ROUND(100.0 * b.par_30_balance / b.book_balance, 2) AS par_30_pct, c.cash_collected FROM book b LEFT JOIN cash c ON c.snapshot_month = b.snapshot_month ORDER BY b.snapshot_month;`,
          /* Today's status used for every past month */
          `WITH book AS (${PACK_BOOK(`WHERE l.status <> 'Written Off'`)}), cash AS (SELECT strftime('%Y-%m', p.payment_date) AS snapshot_month, SUM(p.amount) AS cash_collected FROM payments p WHERE p.amount > 0 GROUP BY 1) ${PACK_OUT}`,
          /* The two written-off loans with no date left in */
          `WITH book AS (${PACK_BOOK(`WHERE l.write_off_date IS NULL OR substr(l.write_off_date, 1, 7) > s.snapshot_month`)}), cash AS (SELECT strftime('%Y-%m', p.payment_date) AS snapshot_month, SUM(p.amount) AS cash_collected FROM payments p WHERE p.amount > 0 GROUP BY 1) ${PACK_OUT}`,
          /* The loan kept in its write-off month */
          `WITH book AS (${PACK_BOOK(`WHERE l.status <> 'Written Off' OR substr(l.write_off_date, 1, 7) >= s.snapshot_month`)}), cash AS (SELECT strftime('%Y-%m', p.payment_date) AS snapshot_month, SUM(p.amount) AS cash_collected FROM payments p WHERE p.amount > 0 GROUP BY 1) ${PACK_OUT}`,
          /* A full date compared with a month, which keeps the loan in its write-off month */
          `WITH book AS (${PACK_BOOK(`WHERE l.status <> 'Written Off' OR l.write_off_date > s.snapshot_month`)}), cash AS (SELECT strftime('%Y-%m', p.payment_date) AS snapshot_month, SUM(p.amount) AS cash_collected FROM payments p WHERE p.amount > 0 GROUP BY 1) ${PACK_OUT}`,
          /* 0 in place of an empty first month */
          `WITH book AS (${PACK_BOOK(ON_BOOK)}), cash AS (SELECT strftime('%Y-%m', p.payment_date) AS snapshot_month, SUM(p.amount) AS cash_collected FROM payments p WHERE p.amount > 0 GROUP BY 1) SELECT b.snapshot_month, b.loans, b.book_balance, b.npl_balance, COALESCE(b.npl_balance - LAG(b.npl_balance) OVER (ORDER BY b.snapshot_month), 0) AS npl_change, ROUND(100.0 * b.par_30_balance / b.book_balance, 2) AS par_30_pct, c.cash_collected FROM book b LEFT JOIN cash c ON c.snapshot_month = b.snapshot_month ORDER BY b.snapshot_month;`,
          /* No ROUND on the percent */
          `WITH book AS (${PACK_BOOK(ON_BOOK)}), cash AS (SELECT strftime('%Y-%m', p.payment_date) AS snapshot_month, SUM(p.amount) AS cash_collected FROM payments p WHERE p.amount > 0 GROUP BY 1) SELECT b.snapshot_month, b.loans, b.book_balance, b.npl_balance, b.npl_balance - LAG(b.npl_balance) OVER (ORDER BY b.snapshot_month) AS npl_change, 100.0 * b.par_30_balance / b.book_balance AS par_30_pct, c.cash_collected FROM book b LEFT JOIN cash c ON c.snapshot_month = b.snapshot_month ORDER BY b.snapshot_month;`,
          /* DPD limit one day out */
          `WITH book AS (SELECT s.snapshot_month, COUNT(*) AS loans, SUM(s.outstanding) AS book_balance, SUM(CASE WHEN s.collectibility >= 3 THEN s.outstanding ELSE 0 END) AS npl_balance, SUM(CASE WHEN s.dpd >= 30 THEN s.outstanding ELSE 0 END) AS par_30_balance FROM loan_snapshots s JOIN loans l ON l.loan_id = s.loan_id ${ON_BOOK} GROUP BY s.snapshot_month), cash AS (SELECT strftime('%Y-%m', p.payment_date) AS snapshot_month, SUM(p.amount) AS cash_collected FROM payments p WHERE p.amount > 0 GROUP BY 1) ${PACK_OUT}`
        ],
        win: `You built the pack the head of a unit reads, with each month as it stood. April and July hold 2 and 3 fewer loans because snapshots are missing, and explaining that before someone asks is what makes a pack trusted.`,
      },
      {
        id: '9.18',
        phone: [[`in the table above`, `in the table in the Brief`]],
        exam: true,
        title: 'Exam: system test pack',
        newIdea: 'No new SQL here. This exam proves in one query whether a new system version is fit to go live.',
        from: 'Maya, UAT lead',
        teach: `<p>The new version goes live if it passes, and the meeting needs one result. Active assignments have no <code>unassigned_date</code>.</p><table class="plain"><tr><th>check_name</th><th>Tests</th><th>Fails when</th></tr><tr><td><code>kol_vs_dpd</code></td><td>All loans</td><td>Kol breaks the rule: <code>dpd</code> 0 is Kol 1, 1-90 Kol 2, 91-120 Kol 3, 121-180 Kol 4, above 180 Kol 5</td></tr><tr><td><code>overdue_no_collector</code></td><td>Loans with <code>dpd</code> above 0, not Written Off</td><td>No active assignment</td></tr><tr><td><code>double_assigned_loans</code></td><td>Loans with an active assignment</td><td>2+ of them</td></tr><tr><td><code>snapshot_gaps</code></td><td>Loans with snapshots</td><td>Fewer than 10 rows</td></tr><tr><td><code>balance_breaks</code></td><td>All loans</td><td><code>EXCEPT</code> finds its <code>loan_id</code> and <code>outstanding</code> missing from the 2026-10 snapshot</td></tr><tr><td><code>missing_feed_runs</code></td><td>Each date from 2026-01-01 to 2026-10-31, per [[feed]]</td><td>No <code>batch_runs</code> row</td></tr><tr><td><code>loaded_above_sent</code></td><td>All runs</td><td><code>rows_loaded</code> exceeds <code>rows_sent</code></td></tr></table>`,
        bridge: 'Like an audit checklist where each line shows its test name and the number of exceptions.',
        task: `Write one query with three columns, <code>check_name</code>, <code>rows_tested</code> and <code>failed_rows</code>, and one row for each of the seven checks in the table above. Use the exact names. A check with no failures must still appear, showing 0. All your <code>WITH</code> steps go once at the very top, before the first <code>SELECT</code>.`,
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
SELECT 'kol_vs_dpd' AS check_name,
  COUNT(*) AS rows_tested,
  SUM(CASE WHEN l.collectibility <> CASE
      WHEN l.dpd = 0 THEN 1
      WHEN l.dpd <= 90 THEN 2
      WHEN l.dpd <= 120 THEN 3
      WHEN l.dpd <= 180 THEN 4
      ELSE 5
    END THEN 1 ELSE 0 END) AS failed_rows
FROM loans l
UNION ALL
SELECT 'overdue_no_collector',
  COUNT(*),
  SUM(CASE WHEN NOT EXISTS (
      SELECT 1
      FROM loan_assignments g
      WHERE g.loan_id = l.loan_id
        AND g.unassigned_date IS NULL
    ) THEN 1 ELSE 0 END)
FROM loans l
WHERE l.dpd > 0
  AND l.status <> 'Written Off'
UNION ALL
SELECT 'double_assigned_loans',
  COUNT(*),
  SUM(CASE WHEN h.active_rows >= 2 THEN 1 ELSE 0 END)
FROM (
  SELECT g.loan_id, COUNT(*) AS active_rows
  FROM loan_assignments g
  WHERE g.unassigned_date IS NULL
  GROUP BY g.loan_id
) h
UNION ALL
SELECT 'snapshot_gaps',
  COUNT(*),
  SUM(CASE WHEN m.months < 10 THEN 1 ELSE 0 END)
FROM (
  SELECT s.loan_id, COUNT(*) AS months
  FROM loan_snapshots s
  GROUP BY s.loan_id
) m
UNION ALL
SELECT 'balance_breaks',
  (SELECT COUNT(*) FROM loans),
  COUNT(*)
FROM (
  SELECT l.loan_id, l.outstanding
  FROM loans l
  EXCEPT
  SELECT s.loan_id, s.outstanding
  FROM loan_snapshots s
  WHERE s.snapshot_month = '2026-10'
) breaks
UNION ALL
SELECT 'missing_feed_runs',
  COUNT(*),
  SUM(CASE WHEN NOT EXISTS (
      SELECT 1
      FROM batch_runs r
      WHERE r.run_date = d.run_date
        AND r.feed_name = f.feed_name
    ) THEN 1 ELSE 0 END)
FROM calendar d
CROSS JOIN feeds f
UNION ALL
SELECT 'loaded_above_sent',
  COUNT(*),
  SUM(CASE WHEN r.rows_loaded > r.rows_sent THEN 1 ELSE 0 END)
FROM batch_runs r;`,
        altSolutions: [
          PACK(),
          `${PACK_HEAD} SELECT 'kol_vs_dpd' AS check_name, (SELECT COUNT(*) FROM loans) AS rows_tested, (SELECT COUNT(*) FROM loans l WHERE l.collectibility <> ${KOL_RULE}) AS failed_rows UNION ALL SELECT 'overdue_no_collector', (SELECT COUNT(*) FROM loans WHERE dpd > 0 AND status <> 'Written Off'), (SELECT COUNT(*) FROM loans l LEFT JOIN loan_assignments g ON g.loan_id = l.loan_id AND g.unassigned_date IS NULL WHERE l.dpd > 0 AND l.status <> 'Written Off' AND g.assignment_id IS NULL) UNION ALL SELECT 'double_assigned_loans', (SELECT COUNT(DISTINCT loan_id) FROM loan_assignments WHERE unassigned_date IS NULL), (SELECT COUNT(*) FROM (SELECT loan_id FROM loan_assignments WHERE unassigned_date IS NULL GROUP BY loan_id HAVING COUNT(*) >= 2)) UNION ALL SELECT 'snapshot_gaps', (SELECT COUNT(DISTINCT loan_id) FROM loan_snapshots), (SELECT COUNT(*) FROM (SELECT loan_id FROM loan_snapshots GROUP BY loan_id HAVING COUNT(*) < 10)) UNION ALL SELECT 'balance_breaks', (SELECT COUNT(*) FROM loans), (SELECT COUNT(*) FROM (SELECT loan_id, outstanding FROM loans EXCEPT SELECT loan_id, outstanding FROM loan_snapshots WHERE snapshot_month = '2026-10')) UNION ALL SELECT 'missing_feed_runs', (SELECT COUNT(*) FROM calendar CROSS JOIN feeds), (SELECT COUNT(*) FROM calendar d CROSS JOIN feeds f WHERE NOT EXISTS (SELECT 1 FROM batch_runs r WHERE r.run_date = d.run_date AND r.feed_name = f.feed_name)) UNION ALL SELECT 'loaded_above_sent', (SELECT COUNT(*) FROM batch_runs), (SELECT COUNT(*) FROM batch_runs WHERE rows_loaded > rows_sent);`
        ],
        requires: [
          ON_THE_LIMIT([90, 120, 180]),
          { re: /\bFROM\s+loans\b/i, msg: 'The numbers match, and they have to come from the data. Count <code>kol_vs_dpd</code> and <code>overdue_no_collector</code> from <code>loans</code>.' },
          { re: /\bloan_assignments\b/i, msg: 'The numbers match, and they have to come from the data. Test <code>overdue_no_collector</code> and <code>double_assigned_loans</code> against <code>loan_assignments</code>.' },
          { re: /\bloan_snapshots\b/i, msg: 'The numbers match, and they have to come from the data. Count <code>snapshot_gaps</code> and <code>balance_breaks</code> from <code>loan_snapshots</code>.' },
          { re: /\bEXCEPT\b/i, msg: 'The numbers match. <code>balance_breaks</code> asks for <code>EXCEPT</code>, so compare the two tables that way.' },
          { re: /\bbatch_runs\b/i, msg: 'The numbers match, and they have to come from the data. Test <code>missing_feed_runs</code> and <code>loaded_above_sent</code> against <code>batch_runs</code>.' },
          { re: /\bRECURSIVE\b/i, msg: 'Right result. Dates taken from the log would miss a night when both feeds failed to run, so build the calendar with <code>WITH RECURSIVE</code>.' }
        ],
        wrong: [
          `SELECT 'kol_vs_dpd' AS check_name, 502 AS rows_tested, 6 AS failed_rows UNION ALL SELECT 'overdue_no_collector', 91, 25 UNION ALL SELECT 'double_assigned_loans', 103, 4 UNION ALL SELECT 'snapshot_gaps', 502, 5 UNION ALL SELECT 'balance_breaks', 502, 2 UNION ALL SELECT 'missing_feed_runs', 608, 2 UNION ALL SELECT 'loaded_above_sent', 606, 0;`,
          `SELECT 'kol_vs_dpd' AS check_name, COUNT(*) AS rows_tested, 6 AS failed_rows FROM loans UNION ALL SELECT 'overdue_no_collector', 91, 25 UNION ALL SELECT 'double_assigned_loans', 103, 4 UNION ALL SELECT 'snapshot_gaps', 502, 5 UNION ALL SELECT 'balance_breaks', 502, 2 UNION ALL SELECT 'missing_feed_runs', 608, 608 - (SELECT COUNT(*) FROM batch_runs) UNION ALL SELECT 'loaded_above_sent', 606, 0;`,
          `${PACK_HEAD} SELECT 'kol_vs_dpd' AS check_name, COUNT(*) AS failed_rows FROM loans l WHERE l.collectibility <> ${KOL_RULE} UNION ALL SELECT 'loaded_above_sent', COUNT(*) FROM batch_runs r WHERE r.rows_loaded > r.rows_sent;`,
          PACK({ 0: `SELECT 'kol_vs_dpd' AS check_name, COUNT(*) AS rows_tested, SUM(CASE WHEN l.collectibility <> CASE WHEN l.dpd = 0 THEN 1 WHEN l.dpd <= 30 THEN 2 WHEN l.dpd <= 120 THEN 3 WHEN l.dpd <= 180 THEN 4 ELSE 5 END THEN 1 ELSE 0 END) AS failed_rows FROM loans l` }),
          PACK({ 1: `SELECT 'overdue_no_collector', COUNT(*), SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM loan_assignments g WHERE g.loan_id = l.loan_id AND g.unassigned_date IS NULL) THEN 1 ELSE 0 END) FROM loans l WHERE l.dpd > 0` }),
          PACK({ 1: `SELECT 'overdue_no_collector', COUNT(*), SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM loan_assignments g WHERE g.loan_id = l.loan_id) THEN 1 ELSE 0 END) FROM loans l WHERE l.dpd > 0 AND l.status <> 'Written Off'` }),
          PACK({ 2: `SELECT 'double_assigned_loans', COUNT(*), SUM(CASE WHEN h.active_rows >= 2 THEN 1 ELSE 0 END) FROM (SELECT g.loan_id, COUNT(*) AS active_rows FROM loan_assignments g GROUP BY g.loan_id) h` }),
          PACK({ 3: `SELECT 'snapshot_gaps', COUNT(*), SUM(CASE WHEN m.months <= 10 THEN 1 ELSE 0 END) FROM (SELECT s.loan_id, COUNT(*) AS months FROM loan_snapshots s GROUP BY s.loan_id) m` }),
          PACK({ 4: `SELECT 'balance_breaks', (SELECT COUNT(*) FROM loans), COUNT(*) FROM (SELECT l.loan_id, l.outstanding FROM loans l EXCEPT SELECT s.loan_id, s.outstanding FROM loan_snapshots s) breaks` }),
          PACK({ 5: `SELECT 'missing_feed_runs', COUNT(*), SUM(CASE WHEN r.run_id IS NULL THEN 1 ELSE 0 END) FROM calendar d CROSS JOIN feeds f LEFT JOIN batch_runs r ON r.run_date = d.run_date` }),
          PACK({ 6: `SELECT 'loaded_above_sent', COUNT(*), SUM(CASE WHEN r.rows_loaded < r.rows_sent THEN 1 ELSE 0 END) FROM batch_runs r` })
        ],
        win: `A 0 beside a <code>rows_tested</code> above 0 is a pass you can defend, because it shows the check looked at real rows. That one result is a test pack you can rerun after every release, and it is what a go-live meeting needs to see.`,
      },
      {
        id: '9.19',
        exam: true,
        type: 'fix',
        title: 'Exam: production bug',
        newIdea: 'No new SQL here. This exam asks you to find every bug in a long query that runs without an error.',
        from: 'Budi, Field Collection lead',
        teach: `<p>A colleague's Field case report went to Citra, and I can see the numbers are wrong. It runs with no error message, and it has five bugs from across this course. Test each step before you trust it. To test a step, copy its inner <code>SELECT</code> and run it alone.</p>`,
        bridge: 'Like auditing a colleague\'s workbook, where every formula calculates and the totals still do not tie.',
        task: `One row per Field collector, zeros included, largest balance first. Cases are active assignments on loans not written off: <code>active_cases</code>, <code>active_balance</code>, <code>oct_cash</code> (payments from 2026-10-01), <code>stale_cases</code> (last Call, WhatsApp or Visit before 2026-10-15, or none), <code>team_stale_pct</code> (all stale cases as a percent of all cases, 1 decimal), <code>silent_in_oct</code> (1 if they logged nothing from 2026-10-01). Fix every bug.`,
        starter: `WITH latest AS (
  SELECT a.loan_id, a.activity_date,
    ROW_NUMBER() OVER (ORDER BY a.activity_date DESC, a.activity_id DESC) AS rn
  FROM collection_activities a
  WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit')
),
cases AS (
  SELECT k.collector_id, k.collector_name,
    COUNT(l.loan_id) AS active_cases,
    COALESCE(SUM(l.outstanding), 0) AS active_balance,
    COALESCE(SUM(p.amount), 0) AS oct_cash,
    SUM(CASE WHEN l.loan_id IS NOT NULL
      AND (lc.activity_date IS NULL OR lc.activity_date < '2026-10-15') THEN 1 ELSE 0 END) AS stale_cases
  FROM collectors k
  LEFT JOIN loan_assignments g
    ON g.collector_id = k.collector_id
    AND g.unassigned_date IS NULL
  LEFT JOIN loans l
    ON l.loan_id = g.loan_id
  LEFT JOIN latest lc
    ON lc.loan_id = l.loan_id
    AND lc.rn = 1
  LEFT JOIN payments p
    ON p.loan_id = l.loan_id
    AND p.payment_date >= '2026-10-01'
  WHERE k.team = 'Field'
    AND l.status <> 'Written Off'
  GROUP BY k.collector_id, k.collector_name
)
SELECT c.collector_name,
  c.active_cases,
  c.active_balance,
  c.oct_cash,
  c.stale_cases,
  ROUND(AVG(100.0 * c.stale_cases / c.active_cases) OVER (), 1) AS team_stale_pct,
  CASE WHEN c.collector_id NOT IN (
    SELECT a.collector_id
    FROM collection_activities a
    WHERE a.activity_date >= '2026-10-01'
  ) THEN 1 ELSE 0 END AS silent_in_oct
FROM cases c
ORDER BY c.active_balance DESC;`,
        solution: `WITH latest AS (
  SELECT a.loan_id, a.activity_date,
    ROW_NUMBER() OVER (PARTITION BY a.loan_id ORDER BY a.activity_date DESC, a.activity_id DESC) AS rn
  FROM collection_activities a
  WHERE a.activity_type IN ('Call', 'WhatsApp', 'Visit')
),
oct_cash AS (
  SELECT p.loan_id, SUM(p.amount) AS cash
  FROM payments p
  WHERE p.payment_date >= '2026-10-01'
  GROUP BY p.loan_id
),
cases AS (
  SELECT k.collector_id, k.collector_name,
    COUNT(l.loan_id) AS active_cases,
    COALESCE(SUM(l.outstanding), 0) AS active_balance,
    COALESCE(SUM(oc.cash), 0) AS oct_cash,
    SUM(CASE WHEN l.loan_id IS NOT NULL
      AND (lc.activity_date IS NULL OR lc.activity_date < '2026-10-15') THEN 1 ELSE 0 END) AS stale_cases
  FROM collectors k
  LEFT JOIN loan_assignments g
    ON g.collector_id = k.collector_id
    AND g.unassigned_date IS NULL
  LEFT JOIN loans l
    ON l.loan_id = g.loan_id
    AND l.status <> 'Written Off'
  LEFT JOIN latest lc
    ON lc.loan_id = l.loan_id
    AND lc.rn = 1
  LEFT JOIN oct_cash oc
    ON oc.loan_id = l.loan_id
  WHERE k.team = 'Field'
  GROUP BY k.collector_id, k.collector_name
)
SELECT c.collector_name,
  c.active_cases,
  c.active_balance,
  c.oct_cash,
  c.stale_cases,
  ROUND(100.0 * SUM(c.stale_cases) OVER () / SUM(c.active_cases) OVER (), 1) AS team_stale_pct,
  CASE WHEN NOT EXISTS (
    SELECT 1
    FROM collection_activities a
    WHERE a.collector_id = c.collector_id
      AND a.activity_date >= '2026-10-01'
  ) THEN 1 ELSE 0 END AS silent_in_oct
FROM cases c
ORDER BY c.active_balance DESC;`,
        ordered: 'active_balance',
        altSolutions: [
          BUG_SQL(),
          BUG_SQL({ listFilter: true }),
          BUG_SQL({ latestMax: true })
        ],
        precision: 4,
        requires: [NO_SUM_DISTINCT],
        wrong: [
          BUG_SQL({ noPartition: true }),
          BUG_SQL({ statusInWhere: true }),
          BUG_SQL({ notIn: true }),
          BUG_SQL({ avgRatios: true }),
          BUG_SQL({ fanOut: true }),
          BUG_SQL({ noPartition: true, statusInWhere: true, notIn: true, avgRatios: true, fanOut: true }),
          BUG_SQL().replace('ORDER BY c.active_balance DESC', 'ORDER BY c.collector_name')
        ],
        win: `Five bugs, and not one error message. Every number that leaves your desk should tie back to a total you trust, and that habit is what makes someone a pro.`,
      },
      {
        id: '9.20',
        mode: 'state',
        exam: true,
        title: 'Exam: the safe fix',
        newIdea: 'No new SQL here. This exam asks you to change data safely, from the first look to the commit.',
        from: 'Bu Ratih, Head of Collection Operations',
        teach: `<p>Part four, the last one. Your test pack found four loans with two active assignments. Each has a newer row dated 2026-10-05, and the older row was never closed. A change like this runs in the same order every time: inspect, begin, change, verify, commit.</p>`,
        bridge: 'Like posting a correcting entry, where you list the items, post, check that the ledger now ties, then close the batch.',
        task: `On this test copy, close the older active assignment on each of those loans, setting <code>unassigned_date</code> to 2026-10-04, the day before the newer one started. Press Run once for all of it: a SELECT of the rows, BEGIN, the UPDATE, a SELECT proving no loan has two left, then COMMIT.`,
        solution: `SELECT g.assignment_id, g.loan_id, g.collector_id, g.assigned_date
FROM loan_assignments g
WHERE g.unassigned_date IS NULL
  AND g.loan_id IN (
    SELECT loan_id
    FROM loan_assignments
    WHERE unassigned_date IS NULL
    GROUP BY loan_id
    HAVING COUNT(*) > 1
  )
ORDER BY g.loan_id, g.assigned_date;

BEGIN;

UPDATE loan_assignments
SET unassigned_date = '2026-10-04'
WHERE assignment_id IN (2, 55, 145, 203);

SELECT loan_id, COUNT(*) AS active_rows
FROM loan_assignments
WHERE unassigned_date IS NULL
GROUP BY loan_id
HAVING COUNT(*) > 1;

COMMIT;`,
        stateQuery: `SELECT assignment_id, loan_id, collector_id, assigned_date, unassigned_date FROM loan_assignments`,
        altSolutions: [
          `SELECT * FROM loan_assignments WHERE loan_id IN (3, 85, 249, 331) AND unassigned_date IS NULL; BEGIN; UPDATE loan_assignments SET unassigned_date = '2026-10-04' WHERE unassigned_date IS NULL AND assigned_date < '2026-10-05' AND loan_id IN (SELECT loan_id FROM loan_assignments WHERE unassigned_date IS NULL GROUP BY loan_id HAVING COUNT(*) > 1); SELECT COUNT(*) FROM loan_assignments WHERE loan_id IN (3, 85, 249, 331) AND unassigned_date IS NULL; COMMIT;`,
          `SELECT assignment_id, loan_id FROM loan_assignments WHERE unassigned_date IS NULL AND loan_id IN (3, 85, 249, 331); BEGIN; UPDATE loan_assignments SET unassigned_date = '2026-10-04' WHERE assignment_id = 2; UPDATE loan_assignments SET unassigned_date = '2026-10-04' WHERE assignment_id = 55; UPDATE loan_assignments SET unassigned_date = '2026-10-04' WHERE assignment_id = 145; UPDATE loan_assignments SET unassigned_date = '2026-10-04' WHERE assignment_id = 203; SELECT loan_id, COUNT(*) FROM loan_assignments WHERE unassigned_date IS NULL GROUP BY loan_id HAVING COUNT(*) > 1; COMMIT;`
        ],
        requires: [
          { re: /\bSELECT\b[^;]*\bFROM\s+loan_assignments\b[^;]*;[\s\S]*\bBEGIN\b/i, msg: 'The data is right. Now add step one: a SELECT from <code>loan_assignments</code> above <code>BEGIN</code>, so you read the rows before you change them.' },
          { re: /\bBEGIN\b[\s\S]*\bUPDATE\b/i, msg: 'The data is right, but the UPDATE ran with no safety net. Put <code>BEGIN</code> before it.' },
          { re: /\bUPDATE\b[^;]*\bWHERE\b/i, msg: 'Add a <code>WHERE</code> to the UPDATE, so you touch only the rows you inspected.' },
          { re: /\bUPDATE\b[\s\S]*;\s*SELECT\b[^;]*\bFROM\s+loan_assignments\b[^;]*;[\s\S]*\bCOMMIT\b/i, msg: 'The data is right. Add the verify step: a separate SELECT from <code>loan_assignments</code> after the UPDATE and before <code>COMMIT</code>, and end with COMMIT so the fix is kept.' }
        ],
        wrong: [
          `SELECT * FROM loan_assignments WHERE unassigned_date IS NULL; BEGIN; UPDATE loan_assignments SET unassigned_date = '2026-10-04' WHERE assignment_id IN (332, 333, 334, 335); SELECT COUNT(*) FROM loan_assignments WHERE unassigned_date IS NULL; COMMIT;`,
          `SELECT * FROM loan_assignments WHERE unassigned_date IS NULL; BEGIN; UPDATE loan_assignments SET unassigned_date = '2026-10-04' WHERE unassigned_date IS NULL; SELECT COUNT(*) FROM loan_assignments WHERE unassigned_date IS NULL; COMMIT;`,
          `SELECT * FROM loan_assignments WHERE unassigned_date IS NULL; BEGIN; UPDATE loan_assignments SET unassigned_date = '2026-10-05' WHERE assignment_id IN (2, 55, 145, 203); SELECT COUNT(*) FROM loan_assignments WHERE unassigned_date IS NULL; COMMIT;`,
          `SELECT * FROM loan_assignments WHERE unassigned_date IS NULL; BEGIN; UPDATE loan_assignments SET unassigned_date = '2026-10-04' WHERE assignment_id IN (2, 55, 145, 203); SELECT COUNT(*) FROM loan_assignments WHERE unassigned_date IS NULL; ROLLBACK;`,
          `UPDATE loan_assignments SET unassigned_date = '2026-10-04' WHERE assignment_id IN (2, 55, 145, 203);`,
          `SELECT * FROM loan_assignments WHERE unassigned_date IS NULL; BEGIN; UPDATE loan_assignments SET unassigned_date = '2026-10-04' WHERE loan_id IN (3, 85, 249, 331) AND unassigned_date IS NULL; SELECT COUNT(*) FROM loan_assignments WHERE unassigned_date IS NULL; COMMIT;`
        ],
        win: `Four loans now have one holder each, and you can say exactly what you saw, what you changed and how you proved it. You started by pressing one button, and you have earned the rank of SQL Pro.`
      },
    ]
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
