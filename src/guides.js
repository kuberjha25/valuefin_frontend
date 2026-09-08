/* ============================================================================
   The first-visit walkthrough for each screen.

   One entry per route: a title and the steps, written in the order the work
   happens on that screen. `match` is checked longest-prefix-first so a detail
   route can carry its own guide without repeating the list route's.
   ========================================================================== */

const GUIDES = [
  {
    match: '/applications/new', id: 'application-new', title: 'Raising an application',
    steps: [
      { heading: 'Start with the proposal, not the borrower',
        body: 'Nothing is created on the live book yet. The borrower record and its facility are only opened at sanction, once the Director has approved the CAM.' },
      { heading: 'Fill what the policy will need',
        body: 'Product, amount, tenure and sector decide which gates run. A sector marked no-go is an absolute hard stop, so pick it honestly.' },
      { heading: 'Tag the backing fund',
        body: 'Every borrower carries its VC or investor tags. They drive the §7 concentration cap, which is tested against the live book on every policy run.' }
    ]
  },
  {
    match: '/applications/', id: 'application-detail', title: 'Working an application',
    steps: [
      { heading: 'Four tabs, in order',
        body: 'Overview & documents, then policy eligibility, then the CAM, then sanction. Each one unlocks the next — the file cannot skip a step.' },
      { heading: 'The checklist moves the file on',
        body: 'Upload against each mandatory row. When the last one is in, the file moves itself from Docs Pending to Policy Check.' },
      { heading: 'The rate is built, never typed',
        body: 'Product floor plus a quality adjustment (±2%) and a structure adjustment (±1%), each with a written justification. Below the floor is a Board decision.' },
      { heading: 'Run the check, then read the working',
        body: 'Every sizing cap is shown with the one that binds, every gate with its required and actual value, and the internal grade with its component breakdown.' },
      { heading: 'A failed gate is not the end',
        body: 'Raise a §9 deviation with at least one compensating control. The Director prices it at +1% or +2%. Two per file — a third is a decline.' },
      { heading: 'Sanction opens the facility',
        body: 'Recording the sanction terms creates the borrower and its facility on the live book, and every document filed here follows the borrower across.' }
    ]
  },
  {
    match: '/applications', id: 'applications', title: 'Applications & pipeline',
    steps: [
      { heading: 'The funnel is the shape of the book to come',
        body: 'Each bar is a stage, from Docs Pending through to Sanctioned. Click one to filter the list to it.' },
      { heading: 'Three ways to read the same pipeline',
        body: 'The list for detail, the pipeline board to see where files are stuck, and the docs-pending queue for anything waiting on a borrower.' },
      { heading: 'Open a file to work it',
        body: 'Everything — the checklist, the policy run, the CAM and the sanction terms — lives on the application itself.' }
    ]
  },
  {
    match: '/approvals', id: 'approvals', title: 'Approvals',
    steps: [
      { heading: 'Everything waiting on a checker, in one queue',
        body: 'CAMs, §9 deviations and uploaded documents all surface here, oldest first, so nothing sits unnoticed on a screen nobody opened.' },
      { heading: 'Decisions are recorded, not just applied',
        body: 'Every approval and rejection carries the decider, the timestamp and the comment onto the audit trail.' }
    ]
  },
  {
    match: '/accounts', id: 'accounts', title: 'Loan accounts',
    steps: [
      { heading: 'Facilities, and the tranches drawn against them',
        body: 'A facility is the sanctioned limit; a tranche is money actually on the street. Both views are here, and the tiles read off the live book.' },
      { heading: 'Classification is computed, not typed',
        body: 'Days past tenure decide the bucket — Standard, then SMA-0 to SMA-2, then non-performing on the ninety-first day, per RBI IRACP.' }
    ]
  },
  {
    match: '/rotation', id: 'rotation', title: 'Drawdowns & rotation',
    steps: [
      { heading: 'Two ways money goes back out',
        body: 'Headroom that was sanctioned but never drawn, and tranches at maturity that can be rolled forward instead of called back.' },
      { heading: 'A rotation is one step, not two',
        body: 'The old tranche is settled and the new one opened in the same transaction, so the limit is never briefly double-counted.' },
      { heading: 'Interest: collect it or roll it',
        body: 'Tick to capitalise and the accrued interest joins the new principal; leave it and the interest is collected in cash.' }
    ]
  },
  {
    match: '/repayments', id: 'repayments', title: 'Repayments & accruals',
    steps: [
      { heading: 'What the book has earned today',
        body: 'Interest runs daily on outstanding principal from the disbursal day, on a 365-day year. Past maturity the penal spread runs on top.' },
      { heading: 'Interest clears before principal',
        body: 'Every receipt is applied to interest first — including any penal and anything carried from an earlier short payment — and only then to principal.' }
    ]
  },
  {
    match: '/closure', id: 'closure', title: 'Interest & closure calculator',
    steps: [
      { heading: 'Any date, including early',
        body: 'Pick a tranche and a date and the settlement is worked out line by line, so the borrower can be shown how the figure was reached.' },
      { heading: 'The advance window is a choice',
        body: 'Closing before the advance interest is used up, you can refund the unused days or keep them earned. The default keeps them.' },
      { heading: 'Recording it is an ordinary receipt',
        body: 'The closure posts as a payment for that amount, so the same waterfall and replay logic applies as to anything else.' }
    ]
  },
  {
    match: '/sanctions', id: 'sanctions', title: 'Sanctions & documents',
    steps: [
      { heading: 'Everything that became a facility',
        body: 'The letter and the draft agreement are generated from the sanction record itself, so they can never state terms the facility does not carry.' },
      { heading: 'Signed copies come back to the docket',
        body: 'Download, get them executed, then upload the signed copies against the borrower — they file into the same folder as everything from origination.' }
    ]
  },
  {
    match: '/reports/pnl', id: 'pnl', title: 'P&L',
    steps: [
      { heading: 'Cash basis, and only three lines',
        body: 'Processing fees and advance interest are recognised at disbursal; interest is recognised when a receipt arrives.' },
      { heading: 'GST is never income',
        body: 'It is collected on the desk\'s behalf and owed onward, so it sits on its own line, outside the total.' }
    ]
  },
  {
    match: '/reports/portfolio', id: 'portfolio-risk', title: 'Portfolio & risk',
    steps: [
      { heading: 'What the book is lent against',
        body: 'Product mix and the largest exposures, both as a share of live outstanding.' },
      { heading: 'How much of it is going bad',
        body: 'The IRACP classification and the ageing of open principal, computed as at today rather than stored.' },
      { heading: 'Where it is concentrated',
        body: 'VC exposure against the §7 bands, the Bullet share of the book, and the single-borrower cap once Net Owned Funds is recorded.' }
    ]
  },
  {
    match: '/data', id: 'data-backup', title: 'Data & backup',
    steps: [
      { heading: 'The lending record, not a credentials dump',
        body: 'Every business table exports, including the audit trail. Password hashes and live sessions are deliberately left out.' },
      { heading: 'The PDFs are not in the file',
        body: 'Copy the backend data folder at the same moment. A JSON without its folder restores the ledger but leaves every document link broken.' }
    ]
  },
  {
    match: '/enhancement', id: 'enhancement', title: 'Limit enhancement',
    steps: [
      { heading: 'A limit is earned, not typed over',
        body: "Proposing an increase re-runs the product's own sizing caps against today's figures, and the case carries the result on its face." },
      { heading: 'The Director decides, and it lands as a dated event',
        body: 'Approving writes a limit event, which is what the engine already reads for both the current limit and the review clock.' },
      { heading: 'More than double goes to the Board',
        body: 'Any single step above 2× the original sanction is flagged, however comfortable the sizing looks.' }
    ]
  },
  {
    match: '/renewals', id: 'renewals', title: 'Loan renewals',
    steps: [
      { heading: 'Nothing rolls on by default',
        body: 'Facilities appear here forty-five days before their review, and stay until a decision is taken.' },
      { heading: 'The gates are computed, not claimed',
        body: 'Overdue tranches, high-severity warnings in the last six months, a drawdown stop, over-drawing — all read off the book.' },
      { heading: 'A failed gate is a deviation, not a wall',
        body: 'It can still be renewed, but only with a written note that stays on the case for whoever reads it later.' }
    ]
  },
  {
    match: '/reports/capital', id: 'capital', title: 'Capital deployment',
    steps: [
      { heading: 'The gap is the point',
        body: 'Capital raised against capital actually lent. Anything parked or idle is paying its funding rate and earning almost nothing.' },
      { heading: 'Parked balances are snapshots, not additions',
        body: 'An entry sets that bucket as at its date. Broke a deposit? Record it again at zero rather than deleting the history.' },
      { heading: 'Every month is rebuilt, not stored',
        body: 'Month ends are reconstructed from the dated entries and the loan book, so a correction to an old entry fixes every month after it.' }
    ]
  },
  {
    match: '/disbursements', id: 'disbursements', title: 'Disbursement queue',
    steps: [
      { heading: 'Three people, three steps',
        body: 'A Manager raises the request, a Director approves it, and only the Accounts team pays it out. Nobody does two of the three.' },
      { heading: 'The tranche is created when the money moves',
        body: 'Not when the request is raised, and not when it is approved — at the moment Accounts value-dates the payout. Nothing sits half-disbursed.' },
      { heading: 'Checked twice',
        body: 'Headroom and any drawdown stop are tested when the request is raised and again at payout, because the book can move in between.' }
    ]
  },
  {
    match: '/ews', id: 'ews', title: 'Early warning',
    steps: [
      { heading: 'Rules that watch the book for you',
        body: 'Overdue tranches, limits nearly full, reviews past due, missing MIS, revenue falling away, runway thinning. They re-run on demand and never stack duplicates.' },
      { heading: 'Log what the rules cannot see',
        body: 'A bounce the bank told you about, a GST notice, an investor stepping back — record it against the borrower with a severity.' },
      { heading: 'Closing one is a decision, not a click',
        body: 'Resolving an alert takes a written account of what was actually done. A rule going quiet is not the same as the risk being dealt with.' },
      { heading: 'The hard stop',
        body: 'A Director can stop every drawdown to a borrower outright — no fresh money, no rotation — until they lift it themselves.' }
    ]
  },
  {
    match: '/visits', id: 'visits', title: 'Site visits',
    steps: [
      { heading: 'Quarterly, for anyone with money out',
        body: 'Ninety-two days without a visit and the borrower shows as due here, and raises an early-warning alert of its own.' },
      { heading: 'Write what you saw',
        body: 'Stock on the floor, people at their desks, whether the story matches the numbers. Logging a visit closes the alert that asked for it.' }
    ]
  },
  {
    match: '/borrower-mis', id: 'borrower-mis', title: 'Borrower MIS',
    steps: [
      { heading: 'Revenue, burn and closing cash, monthly',
        body: 'One row per borrower per month. Re-filing a month corrects it rather than adding a second row.' },
      { heading: 'Runway is derived, not declared',
        body: 'Closing cash over burn — the figure the policy actually stops a drawdown on, so it is computed here rather than taken on trust.' },
      { heading: 'It feeds the warnings',
        body: 'A missing month blocks the next Rocket Fuel drawdown; a fall of more than 20% against the trailing three months, or runway under six, raises an alert.' }
    ]
  },
  {
    match: '/borrowers/', id: 'borrower-detail', title: 'The borrower file',
    steps: [
      { heading: 'Everything about one facility',
        body: 'The tiles are live: limit, outstanding, interest earned, accrued but unbilled, and the IRR with open drawdowns marked to today.' },
      { heading: 'Drawdowns, payments and the ledger',
        body: 'Record a disbursal or a receipt from here. The waterfall applies interest before principal, and the account is replayed from its own history so it can never drift.' }
    ]
  },
  {
    match: '/borrowers', id: 'borrowers', title: 'Borrowers',
    steps: [
      { heading: 'The live book',
        body: 'Every facility with its utilisation and yield. Filter by exposure to find the ones that are overdue or sitting idle.' },
      { heading: 'Open a row to act',
        body: 'Drawdowns, payments, limit enhancements and documents all live inside the borrower file.' }
    ]
  },
  {
    match: '/settings', id: 'settings', title: 'Settings & checklists',
    steps: [
      { heading: 'Your account and your sessions',
        body: 'Change your password here — it signs out every other device you are logged in on.' },
      { heading: 'The credit policy lives here too',
        body: 'Penal spread, GST, Net Owned Funds and the §7 concentration bands. Setting NOF activates the single-borrower cap of 5%.' },
      { heading: 'Checklists and weights are policy, not code',
        body: 'What you add to a checklist becomes mandatory on the next application of that product. Weight changes apply to the next policy run — a check already on a file keeps the values it used.' }
    ]
  },
  {
    match: '/documents', id: 'documents', title: 'Document docket',
    steps: [
      { heading: 'Every upload across the platform',
        body: 'Origination files appear under the applicant until the file is sanctioned, then follow the borrower across without being moved on disk.' },
      { heading: 'Uploads wait for the Director',
        body: 'A document counts as filed only once it is approved, and the uploader is told either way.' },
      { heading: 'Let the desk read the document',
        body: 'Open a PDF and switch to “What we read”. A digital statement is read from its own text layer, free and in milliseconds; only a scan goes to Textract. You get the period, the inflow, the balance behaviour, anything that bounced, and where the money comes from — as bullet points you can act on.' }
    ]
  },
  {
    match: '/activity', id: 'activity', title: 'Audit trail',
    steps: [
      { heading: 'Append-only, by design',
        body: 'Every state change writes one row: who, what, when, and the full input and output snapshot. Nothing here can be edited or removed.' },
      { heading: 'Filter down to a single decision',
        body: 'Narrow by action, user or entity when you need to reconstruct how a particular file was decided.' }
    ]
  },
  {
    match: '/', id: 'dashboard', title: 'Dashboard',
    steps: [
      { heading: 'The desk at a glance',
        body: 'Sanctioned, outstanding, income booked and accrued but unbilled — all computed live from the ledger rather than stored.' },
      { heading: 'Needs attention comes first',
        body: 'Overdue drawdowns, maturities inside a week, facilities near their limit and renewals coming due are ranked by severity.' },
      { heading: 'The sidebar follows the work',
        body: 'Origination at the top, servicing below it, then monitoring and reports. A number on an item means something is queued there for you.' }
    ]
  }
];

export function guideFor(pathname) {
  const hit = GUIDES.find((g) => (g.match === '/' ? pathname === '/' : pathname.startsWith(g.match)));
  return hit || null;
}

export default GUIDES;
