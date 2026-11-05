/*
 * Bank Kenari: the made-up collection database behind the lab.
 *
 * Everything here is invented. The generator is seeded, so the browser, the
 * Web Worker and the Node test harness all build exactly the same rows.
 * Classic script in the browser (window.KenariData), CommonJS in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KenariData = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const AS_OF = '2026-10-31';
  const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];

  /* Shown in the UI. Order is the order a beginner meets them. */
  const SCHEMA = [
    {
      t: 'branches', d: 'Bank branches. KC is a main branch and KCP is a smaller sub-branch.',
      c: [['branch_id', 'unique ID'], ['branch_name', 'branch name'], ['city', 'city'], ['region', 'region']]
    },
    {
      t: 'collectors', d: 'People and agencies who work overdue loans, plus their managers.',
      c: [['collector_id', 'unique ID'], ['collector_name', 'name'], ['team', 'Desk Call, Field, Agency, Management'], ['branch_id', 'links to branches'], ['supervisor_id', 'links to another collector, their boss'], ['hired_date', 'start date']]
    },
    {
      t: 'customers', d: 'Borrowers. City is typed by hand, so it can be messy.',
      c: [['customer_id', 'unique ID'], ['full_name', 'name'], ['city', 'home city'], ['phone', 'phone, can be NULL'], ['email', 'email, can be NULL'], ['employment', 'Payroll, Non-Payroll, Self-employed'], ['joined_date', 'became a customer']]
    },
    {
      t: 'loans', d: 'One row per loan, as it stood on 31 Oct 2026.',
      c: [['loan_id', 'unique ID'], ['customer_id', 'links to customers'], ['branch_id', 'links to branches'], ['product', 'KPR home, KKB vehicle, KTA personal, Kartu Kredit card'], ['disbursed_date', 'when the money went out'], ['principal', 'original amount, Rp'], ['outstanding', 'balance still owed, Rp'], ['installment', 'monthly payment, Rp'], ['interest_rate', 'percent per year'], ['dpd', 'days past due'], ['collectibility', 'Kol grade, 1 to 5'], ['status', 'Active, Restructured, Written Off'], ['write_off_date', 'date written off, else NULL']]
    },
    {
      t: 'payments', d: 'Money received on loans.',
      c: [['payment_id', 'unique ID'], ['loan_id', 'links to loans'], ['payment_date', 'date'], ['amount', 'Rp'], ['channel', 'Auto-debit, Mobile, ATM, Teller, Collector']]
    },
    {
      t: 'collection_activities', d: 'One row per contact attempt on an overdue loan.',
      c: [['activity_id', 'unique ID'], ['loan_id', 'links to loans'], ['collector_id', 'links to collectors, NULL if automatic'], ['activity_date', 'date'], ['activity_type', 'Auto SMS, Call, WhatsApp, Visit, SP Letter'], ['result', 'PTP, Contacted, No Answer, Paid, and others'], ['ptp_date', 'promised pay date, NULL unless PTP'], ['ptp_amount', 'promised Rp, NULL unless PTP']]
    },
    {
      t: 'loan_snapshots', d: 'Each loan at each month end, Jan to Oct 2026. Use it to look back in time.',
      c: [['snapshot_month', 'for example 2026-10'], ['loan_id', 'links to loans'], ['dpd', 'days past due then'], ['collectibility', 'Kol grade then'], ['outstanding', 'balance then, Rp']]
    },
    {
      t: 'loan_assignments', d: 'Which collector holds which loan, and from when to when.',
      c: [['assignment_id', 'unique ID'], ['loan_id', 'links to loans'], ['collector_id', 'links to collectors'], ['assigned_date', 'start date'], ['unassigned_date', 'end date, NULL if still assigned']]
    },
    {
      t: 'batch_runs', d: 'Nightly data feeds into the collection system.',
      c: [['run_id', 'unique ID'], ['run_date', 'date of the run'], ['feed_name', 'CORE_LOANS or PAYMENTS'], ['rows_sent', 'rows the source sent'], ['rows_loaded', 'rows that arrived'], ['status', 'SUCCESS or FAILED'], ['finished_time', 'time it finished, HH:MM']]
    }
  ];

  const LINKS = [
    'loans.customer_id → customers.customer_id',
    'loans.branch_id → branches.branch_id',
    'collectors.branch_id → branches.branch_id',
    'collectors.supervisor_id → collectors.collector_id',
    'payments.loan_id → loans.loan_id',
    'collection_activities.loan_id → loans.loan_id',
    'collection_activities.collector_id → collectors.collector_id',
    'loan_snapshots.loan_id → loans.loan_id',
    'loan_assignments.loan_id → loans.loan_id',
    'loan_assignments.collector_id → collectors.collector_id'
  ];

  /* Exact-capital text values. Used to spot 'kta' when the data says 'KTA'. */
  const VALUES = ['KPR', 'KKB', 'KTA', 'Kartu Kredit', 'Active', 'Restructured', 'Written Off', 'Desk Call', 'Field', 'Agency', 'Management', 'Auto SMS', 'Call', 'WhatsApp', 'Visit', 'SP Letter', 'PTP', 'Contacted', 'No Answer', 'Wrong Number', 'Refused', 'Paid', 'Not Home', 'Delivered', 'Returned', 'Sent', 'Auto-debit', 'Mobile', 'ATM', 'Teller', 'Collector', 'Payroll', 'Non-Payroll', 'Self-employed', 'SUCCESS', 'FAILED', 'CORE_LOANS', 'PAYMENTS', 'Jabodetabek', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Bali Nusra', 'Sumatera', 'Sulawesi'];

  const DDL = `
    CREATE TABLE branches(branch_id INTEGER PRIMARY KEY, branch_name TEXT, city TEXT, region TEXT);
    CREATE TABLE collectors(collector_id INTEGER PRIMARY KEY, collector_name TEXT, team TEXT, branch_id INTEGER, supervisor_id INTEGER, hired_date TEXT);
    CREATE TABLE customers(customer_id INTEGER PRIMARY KEY, full_name TEXT, city TEXT, phone TEXT, email TEXT, employment TEXT, joined_date TEXT);
    CREATE TABLE loans(loan_id INTEGER PRIMARY KEY, customer_id INTEGER, branch_id INTEGER, product TEXT, disbursed_date TEXT, principal INTEGER, outstanding INTEGER, installment INTEGER, interest_rate REAL, dpd INTEGER, collectibility INTEGER, status TEXT, write_off_date TEXT);
    CREATE TABLE payments(payment_id INTEGER PRIMARY KEY, loan_id INTEGER, payment_date TEXT, amount INTEGER, channel TEXT);
    CREATE TABLE collection_activities(activity_id INTEGER PRIMARY KEY, loan_id INTEGER, collector_id INTEGER, activity_date TEXT, activity_type TEXT, result TEXT, ptp_date TEXT, ptp_amount INTEGER);
    CREATE TABLE loan_snapshots(snapshot_month TEXT, loan_id INTEGER, dpd INTEGER, collectibility INTEGER, outstanding INTEGER);
    CREATE TABLE loan_assignments(assignment_id INTEGER PRIMARY KEY, loan_id INTEGER, collector_id INTEGER, assigned_date TEXT, unassigned_date TEXT);
    CREATE TABLE batch_runs(run_id INTEGER PRIMARY KEY, run_date TEXT, feed_name TEXT, rows_sent INTEGER, rows_loaded INTEGER, status TEXT, finished_time TEXT);
  `;

  /**
   * Fill a database. `db` needs exec(sql) and prepare(sql) -> {run(paramsArray), free()}.
   * Use sqljsAdapter or nodeAdapter below.
   */
  function build(db) {
    let s = 20261104;
    const R = () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const int = (a, b) => a + Math.floor(R() * (b - a + 1));
    const pick = (a) => a[Math.floor(R() * a.length)];
    const weighted = (pairs) => { let x = R(); for (const [v, w] of pairs) { if (x < w) return v; x -= w; } return pairs[pairs.length - 1][0]; };
    const pad = (n, w) => String(n).padStart(w || 2, '0');
    const dayMs = 864e5;
    const toMs = (iso) => Date.parse(iso + 'T00:00:00Z');
    const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);
    const addDays = (iso, n) => toIso(toMs(iso) + n * dayMs);
    const randDate = (a, b) => addDays(a, int(0, Math.round((toMs(b) - toMs(a)) / dayMs)));
    const lastDay = (m) => toIso(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0));
    const round = (v, to) => Math.round(v / to) * to;
    const kol = (d) => (d === 0 ? 1 : d <= 90 ? 2 : d <= 120 ? 3 : d <= 180 ? 4 : 5);

    db.exec('BEGIN;');
    db.exec(DDL);

    /* Branches */
    const BR = [
      ['KC Jakarta Sudirman', 'Jakarta', 'Jabodetabek', 0.000],
      ['KCP Kelapa Gading', 'Jakarta', 'Jabodetabek', 0.005],
      ['KCP Bekasi Timur', 'Bekasi', 'Jabodetabek', 0.010],
      ['KC Bandung Dago', 'Bandung', 'Jawa Barat', 0.000],
      ['KCP Cimahi', 'Cimahi', 'Jawa Barat', 0.008],
      ['KC Semarang Simpang Lima', 'Semarang', 'Jawa Tengah', 0.012],
      ['KC Surabaya Darmo', 'Surabaya', 'Jawa Timur', 0.000],
      ['KCP Malang Ijen', 'Malang', 'Jawa Timur', 0.006],
      ['KC Denpasar Renon', 'Denpasar', 'Bali Nusra', 0.016],
      ['KC Medan Merdeka', 'Medan', 'Sumatera', 0.010],
      ['KCP Palembang Ilir', 'Palembang', 'Sumatera', 0.028],
      ['KC Makassar Losari', 'Makassar', 'Sulawesi', 0.008]
    ];
    const stB = db.prepare('INSERT INTO branches VALUES (?,?,?,?)');
    BR.forEach((b, i) => stB.run([i + 1, b[0], b[1], b[2]]));
    stB.free();

    /* Names: invented combinations, each used once */
    const FIRST = 'Dewi Agus Siti Budi Rina Putu Made Yusuf Ayu Hendra Nur Rizky Fitri Andi Wulan Dimas Sri Eko Maya Bayu Lestari Joko Indah Fajar Ratna Teguh Citra Arif Mega Gita Yohanes Maria Ketut Nia Rudi Intan Wahyu Tika Gilang Sari'.split(' ');
    const LAST = 'Wijaya Santoso Hidayat Pratama Saputra Kusuma Siregar Nasution Lubis Wibowo Utami Rahayu Permata Setiawan Gunawan Halim Tanjung Harahap Sihombing Pangestu Manurung Sinaga Purnomo Suryadi Anggraini Maharani Firmansyah Ramadhan Kurniawan Hartono Nugroho Wahyudi Sutanto Mahendra Tampubolon Daulay Latuconsina Mokoginta Pattinama Rumbewas'.split(' ');
    const used = new Set();
    const name = () => { let n; do { n = pick(FIRST) + ' ' + pick(LAST); } while (used.has(n)); used.add(n); return n; };

    /* Customers. The last 12 regular customers are new and have no loans yet. */
    const N_CUST = 420, LOAN_CUST = 408;
    const stC = db.prepare('INSERT INTO customers VALUES (?,?,?,?,?,?,?)');
    const custs = [null];
    for (let i = 1; i <= N_CUST; i++) {
      const bi = int(0, BR.length - 1), n = name();
      const cleanCity = BR[bi][1];
      let city = cleanCity;
      const x = R();
      if (x < 0.03) city = city.toUpperCase();
      else if (x < 0.05) city = city.toLowerCase();
      else if (x < 0.07) city = city + ' ';
      const phone = R() < 0.11 ? null : '0800-555-' + pad(int(0, 9999), 4);
      const email = R() < 0.30 ? null : n.toLowerCase().replace(' ', '.') + '@example.com';
      const employment = weighted([['Payroll', 0.5], ['Non-Payroll', 0.3], ['Self-employed', 0.2]]);
      const joined = i > LOAN_CUST ? randDate('2026-08-01', AS_OF) : randDate('2015-01-01', '2024-12-31');
      stC.run([i, n, city, phone, email, employment, joined]);
      custs.push({ id: i, branch: bi + 1, name: n, city, phone, email, employment, joined });
    }
    /* Planted: the same person entered twice, in capitals, with the same phone */
    let dupCust = N_CUST;
    for (const c of custs) {
      if (!c || !c.phone || c.id % 97 !== 13) continue;
      dupCust++;
      stC.run([dupCust, c.name.toUpperCase(), c.city, c.phone, null, c.employment, randDate('2025-01-01', AS_OF)]);
      if (dupCust === N_CUST + 3) break;
    }
    stC.free();

    /* Collectors, with a four-level reporting line */
    const stK = db.prepare('INSERT INTO collectors VALUES (?,?,?,?,?,?)');
    let kid = 0;
    const addK = (team, branch, sup, hired) => { kid++; stK.run([kid, name(), team, branch, sup, hired]); return kid; };
    const head = addK('Management', 1, null, '2012-02-01');
    const deskLead = addK('Desk Call', 1, head, '2015-06-15');
    const fieldLead = addK('Field', 1, head, '2014-09-01');
    const agencyLead = addK('Agency', 1, head, '2016-03-07');
    const fieldWest = addK('Field', 4, fieldLead, '2017-01-16');
    const fieldEast = addK('Field', 7, fieldLead, '2017-08-21');
    const staff = { 'Desk Call': [], Field: [], Agency: [] };
    for (let i = 0; i < 12; i++) staff['Desk Call'].push(addK('Desk Call', i % 2 ? 1 : 7, deskLead, randDate('2018-01-01', '2024-12-31')));
    for (let i = 0; i < 9; i++) staff.Field.push(addK('Field', int(1, BR.length), i % 2 ? fieldEast : fieldWest, randDate('2018-01-01', '2024-12-31')));
    for (let i = 0; i < 4; i++) staff.Agency.push(addK('Agency', pick([1, 4, 7, 10]), agencyLead, randDate('2019-01-01', '2024-12-31')));
    addK('Field', 12, fieldEast, '2026-10-20');
    addK('Desk Call', 4, deskLead, '2026-10-27');
    stK.free();

    /* Loans and everything that happens to them, month by month */
    const stS = db.prepare('INSERT INTO loan_snapshots VALUES (?,?,?,?,?)');
    const stA = db.prepare('INSERT INTO collection_activities VALUES (?,?,?,?,?,?,?,?)');
    const stP = db.prepare('INSERT INTO payments VALUES (?,?,?,?,?)');
    const stG = db.prepare('INSERT INTO loan_assignments VALUES (?,?,?,?,?)');
    const PRODUCTS = {
      KPR: { min: 200e6, max: 900e6, tenor: 180, rmin: 96, rmax: 132, risk: -0.012 },
      KKB: { min: 80e6, max: 350e6, tenor: 60, rmin: 48, rmax: 84, risk: -0.004 },
      KTA: { min: 10e6, max: 150e6, tenor: 36, rmin: 112, rmax: 178, risk: 0.012 },
      'Kartu Kredit': { min: 5e6, max: 50e6, tenor: 36, rmin: 200, rmax: 270, risk: 0.016 }
    };
    const EMP_RISK = { Payroll: -0.008, 'Non-Payroll': 0.006, 'Self-employed': 0.016 };
    let lid = 0, aid = 0, pid = 0, gid = 0;
    const loanRows = [], openAsg = [], dupActs = [];
    const dayIn = (m) => m + '-' + pad(int(1, 28));
    const closeAsg = (g, end) => stG.run([g.id, g.loan, g.k, g.from, end]);

    for (let c = 1; c <= LOAN_CUST; c++) {
      const cu = custs[c];
      const nLoans = R() < 0.04 ? 3 : R() < 0.2 ? 2 : 1;
      for (let li = 0; li < nLoans; li++) {
        lid++;
        const prod = weighted([['KTA', 0.3], ['Kartu Kredit', 0.3], ['KKB', 0.25], ['KPR', 0.15]]);
        const P = PRODUCTS[prod];
        const principal = round(P.min + R() * R() * (P.max - P.min), 1e5);
        let os = round(principal * (0.3 + R() * 0.65), 1000);
        const minOs = round(principal * 0.05, 1000);
        const inst = round(principal / P.tenor, 1000);
        const rate = int(P.rmin, P.rmax) / 10;
        const disbursed = randDate('2021-01-01', '2025-12-31');
        const enter = 0.03 + P.risk + EMP_RISK[cu.employment] + BR[cu.branch - 1][3] + (disbursed >= '2024-01-01' ? 0.012 : 0);
        const f = R();
        let d = f < 0.8 ? 0 : f < 0.91 ? int(1, 90) : f < 0.95 ? int(91, 180) : int(181, 330);
        const quiet = R() < 0.06;
        let status = 'Active', wo = null, asg = null;

        for (const m of MONTHS) {
          const firstDay = m + '-01', end = lastDay(m);
          const written = wo !== null;
          const startD = d;
          let kept = false;

          /* Payments */
          if (written) {
            if (R() < 0.1) { pid++; stP.run([pid, lid, dayIn(m), round(os * (0.01 + R() * 0.04), 1000), 'Collector']); }
          } else if (d === 0) {
            const channel = cu.employment === 'Payroll'
              ? weighted([['Auto-debit', 0.7], ['Mobile', 0.2], ['ATM', 0.1]])
              : weighted([['Auto-debit', 0.25], ['Mobile', 0.4], ['ATM', 0.2], ['Teller', 0.15]]);
            pid++; stP.run([pid, lid, dayIn(m), inst, channel]);
          } else if (R() < 0.18) {
            pid++; stP.run([pid, lid, dayIn(m), round(inst * (0.3 + R() * 0.7), 1000), weighted([['Collector', 0.45], ['Mobile', 0.3], ['Teller', 0.15], ['ATM', 0.1]])]);
          }

          /* Assignment follows the DPD bucket */
          if (d > 0 && !quiet) {
            const team = d <= 90 ? 'Desk Call' : d <= 180 ? 'Field' : (lid % 5 < 2 ? 'Agency' : 'Field');
            if (!asg || asg.team !== team) {
              if (asg) closeAsg(asg, addDays(firstDay, -1));
              gid++;
              asg = { id: gid, loan: lid, k: pick(staff[team]), team, from: firstDay };
            }
          } else if (asg) {
            closeAsg(asg, addDays(firstDay, -1));
            asg = null;
          }

          /* Contact attempts */
          if (d > 0 && !quiet) {
            if (!written && d <= 30 && R() < 0.6) {
              aid++; stA.run([aid, lid, null, dayIn(m), 'Auto SMS', 'Sent', null, null]);
            }
            const tries = written ? int(0, 1) : d <= 30 ? int(0, 2) : d <= 90 ? int(1, 4) : int(1, 5);
            for (let t = 0; t < tries; t++) {
              let type;
              if (asg.team === 'Desk Call') type = weighted([['Call', 0.6], ['WhatsApp', 0.25], ['SP Letter', d > 30 ? 0.15 : 0]]);
              else if (asg.team === 'Field') type = weighted([['Visit', 0.6], ['Call', 0.2], ['SP Letter', 0.2]]);
              else type = weighted([['Visit', 0.5], ['Call', 0.5]]);
              let res, ptpD = null, ptpA = null;
              if (type === 'SP Letter') res = weighted([['Delivered', 0.85], ['Returned', 0.15]]);
              else if (type === 'Visit') res = weighted([['PTP', 0.3], ['Contacted', 0.25], ['Not Home', 0.25], ['Refused', 0.12], ['Paid', 0.08]]);
              else res = weighted([['No Answer', 0.36], ['PTP', 0.24], ['Contacted', 0.2], ['Wrong Number', 0.09], ['Refused', 0.07], ['Paid', 0.04]]);
              const day = dayIn(m);
              if (res === 'PTP') {
                ptpD = addDays(day, int(3, 14));
                ptpA = round(inst * (1 + R()), 1000);
                if (R() < (cu.employment === 'Payroll' ? 0.6 : 0.5)) {
                  const payDay = addDays(day, int(1, 3));
                  if (payDay <= AS_OF) {
                    pid++; stP.run([pid, lid, payDay, R() < 0.2 ? round(ptpA * 0.5, 1000) : ptpA, weighted([['Collector', 0.6], ['Mobile', 0.3], ['Teller', 0.1]])]);
                    kept = true;
                  }
                }
              }
              const k = R() < 0.85 ? asg.k : pick(staff[asg.team]);
              aid++; stA.run([aid, lid, k, day, type, res, ptpD, ptpA]);
              if (aid % 397 === 0 && dupActs.length < 5) dupActs.push([lid, k, day, type, res, ptpD, ptpA]);
            }
          }

          /* Month end: does the loan cure, stay, or roll forward? */
          if (written) {
            d += 30;
          } else if (d === 0) {
            if (R() < enter) d = int(1, 29);
          } else {
            const x = R();
            const cure = (d <= 90 ? 0.24 : d <= 180 ? 0.07 : 0.02) + (kept ? 0.18 : 0);
            if (x < cure) {
              d = 0;
              if (startD > 90 && R() < 0.5) status = 'Restructured';
            } else if (x >= cure + 0.14) {
              d += 30;
            }
            if (d > 360) { wo = end; status = 'Written Off'; }
          }
          if (d === 0) os = Math.max(minOs, round(os - inst * 0.6, 1000));
          stS.run([m, lid, d, kol(d), os]);
        }
        if (asg) openAsg.push(asg);
        loanRows.push({ id: lid, customer: c, branch: cu.branch, product: prod, disbursed, principal, os, inst, rate, d, k: kol(d), status, wo });
      }
    }

    /* Planted problems for the System checks level */
    /* 1. Stored Kol grade disagrees with DPD */
    let bad = 0;
    for (const l of loanRows) {
      if (bad < 4 && l.d >= 91 && l.d <= 120) { l.k = 2; bad++; }
      else if (bad >= 4 && bad < 7 && l.d >= 181 && l.d <= 240) { l.k = 4; bad++; }
    }
    /* 2. Status says written off, date is missing */
    let woBad = 0;
    for (const l of loanRows) { if (l.status === 'Written Off' && l.id % 3 === 0 && woBad < 2) { l.wo = null; woBad++; } }
    /* 3. Balance above the original amount */
    let high = 0;
    for (const l of loanRows) { if (l.status === 'Active' && l.id % 89 === 7 && high < 3) { l.os = l.principal + round(l.principal * 0.02, 1000); high++; } }

    const stL = db.prepare('INSERT INTO loans VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const l of loanRows) stL.run([l.id, l.customer, l.branch, l.product, l.disbursed, l.principal, l.os, l.inst, l.rate, l.d, l.k, l.status, l.wo]);
    stL.free();

    /* 4. The same activity logged twice */
    for (const a of dupActs) { aid++; stA.run([aid, a[0], a[1], a[2], a[3], a[4], a[5], a[6]]); }
    /* 5. Activities pointing at loans that do not exist */
    [90001, 90002, 90003].forEach((orphan, i) => { aid++; stA.run([aid, orphan, staff['Desk Call'][i], '2026-08-1' + i, 'Call', 'No Answer', null, null]); });
    /* 6. PTP rows missing their date or amount, and promises dated before the call */
    const ptpFix = [
      ['UPDATE collection_activities SET ptp_date = NULL WHERE activity_id IN (SELECT activity_id FROM collection_activities WHERE result = \'PTP\' ORDER BY activity_id LIMIT 3)'],
      ['UPDATE collection_activities SET ptp_amount = NULL WHERE activity_id IN (SELECT activity_id FROM collection_activities WHERE result = \'PTP\' AND ptp_date IS NOT NULL ORDER BY activity_id LIMIT 2)'],
      ['UPDATE collection_activities SET ptp_date = date(activity_date, \'-2 days\') WHERE activity_id IN (SELECT activity_id FROM collection_activities WHERE result = \'PTP\' AND ptp_amount IS NOT NULL ORDER BY activity_id DESC LIMIT 2)']
    ];
    /* 7. Payments that cannot be right */
    pid++; stP.run([pid, loanRows[10].id, '2026-09-14', 0, 'Teller']);
    pid++; stP.run([pid, loanRows[40].id, '2026-10-02', 0, 'Mobile']);
    pid++; stP.run([pid, loanRows[75].id, '2026-10-09', -250000, 'Teller']);

    /* Open assignments, with two kinds of planted fault */
    let doubled = 0, dropped = 0;
    for (const g of openAsg) {
      if (g.loan % 37 === 5 && dropped < 6) { closeAsg(g, '2026-10-15'); dropped++; continue; }
      closeAsg(g, null);
      if (g.loan % 41 === 3 && doubled < 4) {
        gid++; doubled++;
        const other = staff[g.team].find((k) => k !== g.k);
        stG.run([gid, g.loan, other, '2026-10-05', null]);
      }
    }

    /* Nightly feeds, with missing runs, short loads, failures and late finishes */
    const stR = db.prepare('INSERT INTO batch_runs VALUES (?,?,?,?,?,?,?)');
    let rid = 0;
    const totalDays = Math.round((toMs(AS_OF) - toMs('2026-01-01')) / dayMs);
    for (let i = 0; i <= totalDays; i++) {
      const date = addDays('2026-01-01', i);
      for (const feed of ['CORE_LOANS', 'PAYMENTS']) {
        const sent = feed === 'CORE_LOANS' ? 530 + int(0, 12) : int(8, 64);
        const lateRoll = R();
        const time = pad(5, 2) + ':' + pad(int(0, 45));
        if ((feed === 'CORE_LOANS' && date === '2026-03-29') || (feed === 'PAYMENTS' && date === '2026-08-17')) continue;
        rid++;
        let loaded = sent, status = 'SUCCESS', finished = time;
        if ((feed === 'CORE_LOANS' && ['2026-02-11', '2026-06-03', '2026-09-22'].includes(date)) || (feed === 'PAYMENTS' && ['2026-05-19', '2026-10-07'].includes(date))) {
          loaded = sent - int(1, 7);
        }
        if ((feed === 'CORE_LOANS' && date === '2026-07-14') || (feed === 'PAYMENTS' && date === '2026-04-02')) { loaded = 0; status = 'FAILED'; }
        if (['2026-01-20', '2026-03-05', '2026-08-30', '2026-10-12'].includes(date) && feed === 'CORE_LOANS') finished = '07:' + pad(int(5, 55));
        void lateRoll;
        stR.run([rid, date, feed, sent, loaded, status, finished]);
      }
    }
    stR.free();
    stA.free(); stP.free(); stS.free(); stG.free();

    /* Apply the fix-ups that need SQL */
    ptpFix.forEach((q) => db.exec(q[0]));
    /* 8. Snapshots that disagree with the loans table, and months that never arrived */
    const fixKkb = loanRows.find((l) => l.product === 'KKB' && l.os > 50e6 && l.status === 'Active');
    const fixKta = loanRows.find((l) => l.product === 'KTA' && l.os > 20e6 && l.status === 'Active');
    db.exec(`UPDATE loan_snapshots SET outstanding = outstanding + 1250000 WHERE loan_id = ${fixKkb.id} AND snapshot_month = '2026-10'`);
    db.exec(`UPDATE loan_snapshots SET outstanding = outstanding - 500000 WHERE loan_id = ${fixKta.id} AND snapshot_month = '2026-10'`);
    db.exec(`DELETE FROM loan_snapshots WHERE snapshot_month = '2026-07' AND loan_id IN (${loanRows[20].id}, ${loanRows[120].id}, ${loanRows[220].id})`);
    db.exec(`DELETE FROM loan_snapshots WHERE snapshot_month = '2026-04' AND loan_id IN (${loanRows[60].id}, ${loanRows[160].id})`);
    /* Balance-above-principal loans keep their snapshots in step, so only two products fail the reconciliation */
    db.exec(`UPDATE loan_snapshots SET outstanding = (SELECT l.outstanding FROM loans l WHERE l.loan_id = loan_snapshots.loan_id) WHERE snapshot_month = '2026-10' AND loan_id IN (SELECT loan_id FROM loans WHERE outstanding > principal)`);

    db.exec('COMMIT;');
  }

  const sqljsAdapter = (d) => ({
    exec: (sql) => d.run(sql),
    prepare: (sql) => { const st = d.prepare(sql); return { run: (a) => { st.run(a); }, free: () => st.free() }; }
  });
  const nodeAdapter = (d) => ({
    exec: (sql) => d.exec(sql),
    prepare: (sql) => { const st = d.prepare(sql); return { run: (a) => { st.run(...a); }, free: () => {} }; }
  });

  return { AS_OF, MONTHS, SCHEMA, LINKS, VALUES, build, sqljsAdapter, nodeAdapter };
});
