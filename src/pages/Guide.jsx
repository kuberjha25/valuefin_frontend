import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LifeBuoy, Users, Banknote, Wallet2, BookOpenText, FileBarChart2, FolderCheck, ArrowRight,
  RefreshCw, ArrowUpDown, Calculator, ScrollText, Command, ListChecks
} from 'lucide-react';
import { useAuth } from '../App.jsx';
import { Card, Chip, PageHead, Table, Tabs, Td } from '../ui.jsx';
import { ROLE } from '../format.js';
import { CHECKLIST_GROUPS } from '../components/DocumentPanel.jsx';

/* ============================================================================
   The reference.

   Every number this desk produces, and the arithmetic behind it. Written from
   the code rather than about it: where a formula appears here it is the formula
   that actually runs, so a figure on any screen can be reconstructed by hand
   and checked. Conventions that catch people out — inclusive day counts, a
   365-day year, interest before principal — are stated plainly rather than
   left to be discovered.
   ========================================================================== */

const SECTIONS = [
  ['roles', 'Roles & approvals'],
  ['money', 'Money maths'],
  ['servicing', 'Servicing'],
  ['policy', 'Credit policy'],
  ['monitoring', 'Monitoring'],
  ['treasury', 'Treasury & reports'],
  ['documents', 'Reading documents']
];

export default function Guide() {
  const user = useAuth();
  const [tab, setTab] = useState('roles');

  return (
    <div className="max-w-5xl space-y-5">
      <PageHead icon={LifeBuoy} title="How the desk computes everything"
        subtitle="Every figure on every screen, and the arithmetic behind it. These are the formulas that actually run — anything here can be reconstructed by hand and checked against what the system shows." />

      <Tabs value={tab} onChange={setTab} tabs={SECTIONS} />

      {tab === 'roles' && <Roles user={user} />}
      {tab === 'money' && <MoneyMaths />}
      {tab === 'servicing' && <Servicing />}
      {tab === 'policy' && <Policy />}
      {tab === 'monitoring' && <Monitoring />}
      {tab === 'treasury' && <Treasury />}
      {tab === 'documents' && <Documents />}
    </div>
  );
}

/* ---------------- shared bits ---------------- */
const Formula = ({ children, note }) => (
  <div className="my-2.5 rounded-xl border border-white/8 bg-ink-900/70 px-3.5 py-2.5">
    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-neon-cyan">{children}</pre>
    {note && <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{note}</p>}
  </div>
);

const Def = ({ term, children }) => (
  <div className="flex flex-col gap-1 border-b border-white/[.06] py-2.5 last:border-0 sm:flex-row sm:gap-4">
    <span className="w-full shrink-0 text-[13px] font-semibold text-slate-200 sm:w-52">{term}</span>
    <span className="flex-1 text-[13px] leading-relaxed text-slate-400">{children}</span>
  </div>
);

const Warn = ({ children }) => (
  <div className="my-3 rounded-xl border border-neon-amber/25 bg-neon-amber/[.06] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-100">
    {children}
  </div>
);

const Worked = ({ title, children }) => (
  <div className="my-3 rounded-2xl border border-neon-indigo/20 bg-neon-indigo/[.05] px-4 py-3">
    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-neon-violet">{title}</p>
    <div className="font-mono text-[12px] leading-relaxed text-slate-300">{children}</div>
  </div>
);

/* ============================================================================
   roles
   ========================================================================== */
function Roles({ user }) {
  const nav = useNavigate();
  return (
    <>
      <Card title="Who may do what">
        <div className="space-y-2.5">
          {['director', 'manager', 'analyst', 'accounts'].map((r) => (
            <div key={r} className={'flex items-start gap-3 rounded-2xl border px-3.5 py-3 ' +
              (user.role === r ? 'border-neon-indigo/35 bg-neon-indigo/[.08]' : 'border-white/[.07] bg-white/[.03]')}>
              <span className="w-24 shrink-0"><Chip cls={ROLE[r].cls}>{ROLE[r].label}</Chip></span>
              <p className="flex-1 text-[13px] leading-relaxed text-slate-400">{ROLE[r].blurb}</p>
              {user.role === r && <Chip cls="chip-violet">you</Chip>}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Separation of duties" subtitle="Where the desk deliberately refuses to let one person do both halves">
        <Table cols={['Action', 'Raised by', 'Approved by', 'Executed by']} rows={[
          { id: 1, a: 'Credit application (CAM)', r: 'Manager', ap: 'Director', e: 'Manager records the sanction' },
          { id: 2, a: '§9 deviation', r: 'Manager', ap: 'Director', e: 'Prices into the sanction rate' },
          { id: 3, a: 'Disbursement', r: 'Manager', ap: 'Director', e: 'Accounts value-dates it' },
          { id: 4, a: 'Limit enhancement', r: 'Manager', ap: 'Director', e: 'Applied on approval' },
          { id: 5, a: 'Renewal', r: 'Manager', ap: 'Director', e: 'Applied on approval' },
          { id: 6, a: 'Document', r: 'Anyone who can write', ap: 'Director', e: '—' },
          { id: 7, a: 'Drawdown stop', r: '—', ap: 'Director only', e: 'Blocks every payout' }
        ]} render={(r) => (<>
          <td className="text-slate-200">{r.a}</td><Td>{r.r}</Td><Td>{r.ap}</Td><Td className="text-slate-500">{r.e}</Td>
        </>)} />
        <div className="mt-4">
          <Def term="Maker ≠ checker">
            A Director who raised a request cannot approve it — unless they are the only active Director, in which case a
            one-person desk would otherwise deadlock on its own work.
          </Def>
          <Def term="Payments and receipts">
            Recording a receipt is direct entry, not an approval flow. It is a fact being written down, not a decision;
            the audit trail carries who wrote it.
          </Def>
          <Def term="Everything is on the trail">
            Every state change writes one append-only row: who, what, when, and the full before-and-after snapshot.
            Nothing on <button className="text-neon-violet hover:underline" onClick={() => nav('/activity')}>Audit Trail</button> can
            be edited or deleted.
          </Def>
        </div>
      </Card>

      <Card title="How the numbers work" right={<Calculator size={16} className="text-neon-violet" />}>
        <div className="space-y-2.5 text-[13px] leading-relaxed text-slate-400">
          <p><b className="text-slate-200">Day count</b> is inclusive of both the debit date and the as-at date. Interest uses a 365-day year, so the daily rate is the annual rate ÷ 365.</p>
          <p><b className="text-slate-200">Advance interest</b> is collected upfront at disbursal and covers the first part of the tenure — 30 days, 1 month, 2 months, a custom number of days, or none.</p>
          <p><b className="text-slate-200">Net disbursed</b> = amount − advance interest − processing fee − GST on the fee. The full amount, not the net, is booked as outstanding principal.</p>
          <p><b className="text-slate-200">Overdue</b> days beyond tenure accrue at the interest rate <b className="text-slate-200">plus</b> the penal charge, on the outstanding principal.</p>
          <p><b className="text-slate-200">The waterfall</b> settles accrued interest (including penal and any carried overhang) before it touches principal. What a payment cannot cover is carried forward.</p>
          <p><b className="text-slate-200">IRR</b> is annualised across all of a borrower's cash flows by Newton-Raphson. Open drawdowns are marked to today at outstanding + accrued interest, so the figure reflects yield earned so far rather than treating a performing loan as a loss.</p>
        </div>
      </Card>

      <Card title="Documents & approval" right={<FolderCheck size={16} className="text-neon-violet" />}>
        <div className="space-y-2.5 text-[13px] leading-relaxed text-slate-400">
          <p>Upload a PDF from a borrower's page or the Documents tab. It is stored in that borrower's folder on the server and marked <Chip cls="chip-warn">Pending review</Chip>.</p>
          <p>The <b className="text-slate-200">Director</b> previews it inline and approves or rejects — a reason is required to reject, and the uploader is notified either way. Watch the bell in the top bar.</p>
          <p>Only genuine PDFs are accepted: the server checks the file's own bytes, not just its name. An uploader can withdraw their own pending upload; anything already reviewed is the Director's to remove.</p>
        </div>
      </Card>

      <Card title="Onboarding checklist" right={<ListChecks size={16} className="text-neon-violet" />}>
        <p className="text-[13px] leading-relaxed text-slate-400">
          Every borrower is expected to file the same fixed set of{' '}
          <b className="text-slate-200">{CHECKLIST_GROUPS.reduce((n, g) => n + g.items.length, 0)} documents</b>:{' '}
          {CHECKLIST_GROUPS.map((g, i) => (
            <span key={g.key}>
              <b className="text-slate-200">{g.items.length}</b> under &ldquo;{g.title}&rdquo;{i < CHECKLIST_GROUPS.length - 1 ? ', ' : '.'}
            </span>
          ))}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
          Tag an upload against one of these when filing it, and the checklist tracks what's filed, pending review or still
          missing. See the full list and a borrower's live progress on the{' '}
          <button className="font-semibold text-neon-violet hover:underline" onClick={() => nav('/documents')}>Documents</button> page,
          or on a borrower's own Documents tab.
        </p>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2">
        <Card title="Audit trail" right={<ScrollText size={16} className="text-neon-violet" />}>
          <p className="text-[13px] leading-relaxed text-slate-400">
            Every create, edit, approval, reversal and sign-in is written to an append-only log with the user, the role, the
            IP and a summary. Open <button className="font-semibold text-neon-violet hover:underline" onClick={() => nav('/activity')}>Activity</button> to
            read or export it. Nothing in it can be edited or deleted from the app.
          </p>
        </Card>
        <Card title="Getting around faster" right={<Command size={16} className="text-neon-violet" />}>
          <p className="text-[13px] leading-relaxed text-slate-400">
            Press <span className="kbd">⌘</span> <span className="kbd">K</span> (or <span className="kbd">Ctrl</span> <span className="kbd">K</span>) anywhere to jump to a
            borrower, a PO reference, a document or a page. Arrow keys move, <span className="kbd">↵</span> opens, <span className="kbd">esc</span> closes.
          </p>
        </Card>
      </div>

      <Card title="The PML reference example">
        <p className="text-[13px] leading-relaxed text-slate-400">
          <b className="text-slate-200">PML Pvt Ltd</b> ships as a worked example: a PO-Finance facility with a ₹1 Cr base limit and a
          ₹25 L enhancement, one fully repaid cycle and one running drawdown with a part payment — so the ledger, MIS and dashboard
          are populated from the first sign-in. Every figure on it was produced by the same engine your own borrowers use.
          Delete it from its own page whenever you no longer need it, or restore it from{' '}
          <button className="font-semibold text-neon-violet hover:underline" onClick={() => nav('/settings')}>Settings → Danger zone</button>.
        </p>
      </Card>
    </>
  );
}

/* ============================================================================
   money maths
   ========================================================================== */
function MoneyMaths() {
  return (
    <>
      <Card title="Conventions" subtitle="Get these wrong and every downstream number is wrong">
        <Def term="Day count">
          <b className="text-slate-200">Inclusive of both ends.</b> A drawdown debited on the 1st and settled on the 1st
          counts as one day, not zero.
          <Formula>{`days = round((toDate − fromDate) / 86,400,000) + 1`}</Formula>
        </Def>
        <Def term="Daily rate">
          A 365-day year throughout — never 360, never actual/actual.
          <Formula>{`dailyRate = annualRate ÷ 100 ÷ 365`}</Formula>
        </Def>
        <Def term="Tenure in days">
          Months are converted at 30.4375 days — the mean Gregorian month — so a 3-month tenure is 91 days, not 90.
          <Formula>{`tenureDays = unit === 'months' ? round(tenure × 30.4375) : tenure`}</Formula>
        </Def>
        <Def term="Maturity">
          <Formula>{`dueDate = debitDate + (tenureDays − 1)`}</Formula>
          The −1 is the same inclusive convention: a 90-day tranche debited on the 1st matures on the 90th day, not the 91st.
        </Def>
        <Def term="Rounding">
          Money is held to 2 decimal places at every step. A tranche is treated as closed when its outstanding falls
          below half a paisa (0.005), so floating-point dust can never leave an account a fraction of a rupee open.
        </Def>
      </Card>

      <Card title="What is deducted at disbursal">
        <Def term="Advance interest">
          Interest for an opening window, taken upfront. Five modes:
          <Formula>{`none    →  0
30d     →  amount × dailyRate × 30            window = 30 days
1 month →  amount × (rate ÷ 100 ÷ 12)         window = 30 days
2 months→  amount × (rate ÷ 100 ÷ 12) × 2     window = 61 days
custom  →  amount × dailyRate × days          window = days`}</Formula>
          <Warn>
            <b>30d and 1 month are not the same number.</b> 30d prices thirty days at the daily rate (rate ÷ 365 × 30);
            1 month prices a twelfth of the year (rate ÷ 12). On ₹10,00,000 at 18% that is ₹14,795 against ₹15,000 — the
            monthly convention is dearer, because a twelfth of a year is 30.4 days, not 30.
          </Warn>
        </Def>
        <Def term="Processing fee and GST">
          <Formula>{`fee = amount × feePct ÷ 100
gst = fee × gstPct ÷ 100          — GST is charged on the fee, not on the loan`}</Formula>
        </Def>
        <Def term="Net disbursed">
          <Formula>{`netDisbursed = amount − advanceInterest − fee − gst`}</Formula>
          <b className="text-slate-200">Outstanding principal starts at the full amount</b>, not the net. The borrower owes
          what was lent; the deductions are income taken at the front.
        </Def>

        <Worked title="Worked example — ₹10,00,000 at 18%, 30d advance, 1.5% fee, 18% GST">{`advance = 1,000,000 × (18 ÷ 100 ÷ 365) × 30   = 14,794.52
fee     = 1,000,000 × 1.5 ÷ 100               = 15,000.00
gst     = 15,000 × 18 ÷ 100                   =  2,700.00
                                                ──────────
net into the borrower's account               = 967,505.48
outstanding principal on the book             = 1,000,000.00`}</Worked>
      </Card>

      <Card title="Interest accrual — PO Finance">
        <p className="text-[13px] leading-relaxed text-slate-400">
          Interest runs on <b className="text-slate-200">outstanding principal</b>, which falls as principal is repaid. The
          advance window is already paid for, so charging restarts only after it.
        </p>
        <Formula note="wT caps the normal-rate window at the tenure: once past maturity, the penal rate takes over rather than running alongside.">{`days = daysBetween(debitDate, asOfDate)          — inclusive
wT   = min(days, tenureDays)
exD  = max(0, wT − advanceDays)                  — days charged at the normal rate
exI  = outstandingPrincipal × dailyRate(rate) × exD

odD  = max(0, days − tenureDays)                 — days past maturity
penal = outstandingPrincipal × dailyRate(rate + penalRate) × odD

interestDue = exI + penal + carriedOverhang`}</Formula>
        <Warn>
          Past maturity the whole <b>rate + penal spread</b> applies to the overdue days — the penal charge is not an
          add-on to a rate that keeps running. A ₹5,00,000 tranche at 18% with a 6% penal spread costs 24% p.a. for every
          overdue day.
        </Warn>

        <Worked title="Worked example — ₹5,00,000 at 18%, 90-day tenure, 30d advance, settled on day 120">{`wT    = min(120, 90) = 90
exD   = 90 − 30 = 60 days at 18%
exI   = 500,000 × (18 ÷ 36,500) × 60      = 14,794.52

odD   = 120 − 90 = 30 days at 18% + 6%
penal = 500,000 × (24 ÷ 36,500) × 30      =  9,863.01
                                            ─────────
interest due                              = 24,657.53
plus principal                            = 500,000.00
total to settle                           = 524,657.53`}</Worked>
      </Card>

      <Card title="Interest accrual — Interest-Only">
        <p className="text-[13px] leading-relaxed text-slate-400">
          Interest runs on the <b className="text-slate-200">full original principal</b> throughout, because nothing amortises
          — the principal is repaid as a bullet at the end. Interest already collected is netted off rather than re-charged.
        </p>
        <Formula>{`billableDays = max(0, days − advanceDays)
accrued      = originalPrincipal × dailyRate(rate) × billableDays
interestDue  = max(0, accrued − interestAlreadyCollected)`}</Formula>
      </Card>

      <Card title="The receipt waterfall">
        <p className="text-[13px] leading-relaxed text-slate-400">
          Every receipt clears <b className="text-slate-200">interest before principal</b> — and within interest, the penal
          charge and anything carried forward settle first, because they are part of the same accrued figure.
        </p>
        <Formula>{`interestDue = normalInterest + penal + carriedOverhang

if (received ≥ interestDue)
    → interest is cleared in full
    → the remainder reduces principal, capped at the outstanding
else
    → the whole receipt goes to interest
    → the shortfall becomes carriedOverhang and rides on the next accrual

closed when outstanding < 0.005 and carriedOverhang < 0.005`}</Formula>

        <Worked title="Part payment — ₹20,000 received against ₹24,657 of interest due">{`intAdj      = 20,000.00        (the whole receipt)
prinAdj     =      0.00        (nothing left for principal)
overhang    =  4,657.53        (carried, and accrues no interest of its own)
outstanding = unchanged`}</Worked>

        <Def term="Why replay, not adjust">
          Editing, back-dating or deleting a receipt does not patch the balance. The drawdown is
          <b className="text-slate-200"> re-derived from its entire payment history</b>, ordered by date then by id, as if
          the payments had always arrived that way. A receipt inserted three months back therefore re-prices every receipt
          after it, and the account can never drift from its own history.
        </Def>
      </Card>
    </>
  );
}

/* ============================================================================
   servicing
   ========================================================================== */
function Servicing() {
  return (
    <>
      <Card title="Asset classification — RBI IRACP">
        <p className="text-[13px] leading-relaxed text-slate-400">
          Days past the tenure decide the bucket. Nothing is typed in; the classification is recomputed on every read.
        </p>
        <Formula>{`overdueDays = max(0, daysElapsed − tenureDays)`}</Formula>
        <Table cols={['Overdue days', 'Bucket', 'What it means']} rows={[
          { id: 1, d: '0', b: 'Standard', m: 'Within its tenure' },
          { id: 2, d: '1 – 30', b: 'SMA-0', m: 'Past due but early' },
          { id: 3, d: '31 – 60', b: 'SMA-1', m: 'Special mention' },
          { id: 4, d: '61 – 90', b: 'SMA-2', m: 'The last bucket before non-performing' },
          { id: 5, d: '91 and over', b: 'NPA', m: 'Non-performing' }
        ]} render={(r) => (<>
          <Td className="font-mono text-[12px]">{r.d}</Td>
          <Td><Chip cls={{ Standard: 'chip-good', 'SMA-0': 'chip-cyan', 'SMA-1': 'chip-warn', 'SMA-2': 'chip-warn', NPA: 'chip-bad' }[r.b]}>{r.b}</Chip></Td>
          <Td className="text-slate-400">{r.m}</Td>
        </>)} />
        <p className="mt-3 text-[12px] text-slate-500">
          Interest-Only tranches are not aged this way — they have no amortisation schedule to fall behind, so their
          discipline is measured on whether the periodic interest arrives.
        </p>
      </Card>

      <Card title="Settlement on any date">
        <Formula>{`PO Finance
  total = outstandingPrincipal
        + normalInterest + penal + carriedOverhang
        − advanceRefund

  unusedAdvanceDays = max(0, advanceDays − daysElapsed)
  advanceRefund     = originalPrincipal × dailyRate × unusedAdvanceDays   (refund mode only)

Interest-Only
  total = outstandingPrincipal
        + max(0, accrued − collected)
        − overCollectedInterest                                            (refund mode only)`}</Formula>
        <Def term="The advance window boundary">
          On day 30 of a 30-day window nothing is unused — the window covers days 1 to 30 inclusive. Charging at the normal
          rate begins on day 31.
        </Def>
        <Def term="Refund or keep">
          Refunding the unused days is a commercial choice, not an obligation. The default keeps the advance earned.
        </Def>
        <Def term="Recording a closure">
          Posts an ordinary receipt for the settlement figure. There is no separate closure path, so a closure and a normal
          payment can never diverge in how they are allocated.
        </Def>
      </Card>

      <Card title="Rotation">
        <p className="text-[13px] leading-relaxed text-slate-400">
          Rolling a maturing tranche forward, in one transaction, so the limit is never briefly counted twice.
        </p>
        <Formula>{`settlement    = outstandingPrincipal + accruedInterest
newPrincipal  = outstandingPrincipal + (capitaliseInterest ? accruedInterest : 0)`}</Formula>
        <Def term="What happens">
          The old tranche is settled with a receipt for its full position and marked Repaid; a fresh tranche opens with its
          own tenure clock, advance window and fee. The new one records which tranche it replaced.
        </Def>
        <Def term="Capitalise, or collect">
          Capitalising rolls the accrued interest into the new principal — it then earns interest itself. Leaving it off
          means the interest is collected in cash and only the principal rolls forward.
        </Def>
      </Card>

      <Card title="Limits and utilisation">
        <Formula>{`currentLimit = baseLimit + Σ(limit events)
outstanding  = Σ(outstanding principal of every open tranche)
available    = currentLimit − outstanding
utilisation  = outstanding ÷ currentLimit × 100`}</Formula>
        <Def term="Limit events">
          Enhancements and renewals both write a dated limit event — an enhancement with an amount, a renewal with zero.
          That single mechanism drives both the current limit and the review clock.
        </Def>
        <Def term="Headroom is checked twice">
          When a disbursement is requested, and again when Accounts pays it out, because the book can move in between.
        </Def>
      </Card>

      <Card title="Yield — IRR">
        <p className="text-[13px] leading-relaxed text-slate-400">
          The annualised return actually earned on a borrower, solved by Newton-Raphson over daily-discounted cash flows.
        </p>
        <Formula>{`NPV(r) = Σ  cashFlow ÷ (1 + r) ^ (daysFromStart ÷ 365)     solve NPV(r) = 0

cash out  −principal            at the debit date
cash in   +fee, +advance        at the debit date
cash in   +every receipt        at its own date
mark      +outstanding + accrued interest, dated today, for open tranches`}</Formula>
        <Def term="Why open tranches are marked to today">
          Without it, a perfectly performing loan that has not yet matured would read as a total loss. Marking it at what
          it is currently worth makes the IRR the yield earned so far, rather than a prediction.
        </Def>
      </Card>

      <Card title="Ageing and the review clock">
        <Formula>{`ageing buckets   within tenure · 1–30 · 31–60 · 61–90 · 90+   by overdue days
reviewDate       latest of (sanction date, any limit event) + 1 year
daysLeft         daysBetween(today, reviewDate) − 1
                 overdue below 0 · warning at 30 or fewer · shown from 45 days out`}</Formula>
      </Card>
    </>
  );
}

/* ============================================================================
   credit policy
   ========================================================================== */
function Policy() {
  return (
    <>
      <Card title="The three products" subtitle="Floors, bands and ticket sizes are written policy — not editable from the app">
        <Table cols={['Product', 'Floor', 'Band', '#Minimum', '#Maximum', 'Tenor']} rows={[
          { id: 1, p: 'Quick Cash', f: '16%', b: '16–19%', mn: '₹25 L', mx: '₹1 Cr', t: '30–120 days' },
          { id: 2, p: 'Rocket Fuel', f: '18%', b: '18–22%', mn: '₹10 L', mx: '₹75 L', t: '3–6 months' },
          { id: 3, p: 'Bullet', f: '20%', b: '20–24%', mn: '₹10 L', mx: '₹50 L', t: '3–12 months' }
        ]} render={(r) => (<>
          <td className="font-semibold text-slate-100">{r.p}</td>
          <Td>{r.f}</Td><Td>{r.b}</Td><Td r>{r.mn}</Td><Td r>{r.mx}</Td><Td className="text-slate-400">{r.t}</Td>
        </>)} />
      </Card>

      <Card title="Sizing — how much the policy will lend">
        <p className="text-[13px] leading-relaxed text-slate-400">
          Each product is sized off several independent caps. <b className="text-slate-200">The lowest one binds</b>, and the
          eligible amount is that cap rounded <i>down</i> to the nearest lakh. Below the product minimum is an automatic decline.
        </p>
        <Formula>{`eligible = floor(min(all caps) ÷ 100,000) × 100,000`}</Formula>

        <p className="ctitle mt-5 mb-1">Quick Cash — §4A</p>
        <Formula note="Coverage is 1.10× for a listed or marquee anchor, 1.20× for anyone else — a weaker buyer has to over-collateralise.">{`cap 1  LTV tiers      = (PO paper × 0.75) + (invoice / bill / settlement × 0.90)
cap 2  coverage      = totalPaper ÷ (coverage × (1 + rate × tenorDays ÷ 365))
cap 3  product ceiling = ₹1 Cr`}</Formula>

        <Worked title="Worked example — ₹60 L of POs, ₹20 L of invoices, listed anchor, 90 days at 17%">{`LTV       = (6,000,000 × 0.75) + (2,000,000 × 0.90)  = 6,300,000
coverage  = 8,000,000 ÷ (1.10 × (1 + 0.17 × 90/365))  = 6,980,135
ceiling                                               = 10,000,000
                                                        ──────────
binding cap = LTV                                     = 6,300,000
eligible (rounded down to a lakh)                     = ₹63,00,000`}</Worked>

        <p className="ctitle mt-5 mb-1">Rocket Fuel — §4B</p>
        <Formula note="Runway protection is the conservative test: after repaying principal and interest at maturity, three months of burn must still be left.">{`cap 1  revenue     = 3 × average monthly revenue (trailing 6 months)
cap 2  round        = 0.15 × last institutional round
cap 3  runway       = burn × max(0, runwayMonths − 3) ÷ (1 + rate × tenorMonths ÷ 12)
cap 4  leverage     = max(0, roundSize × 1.0 − existing external debt)
cap 5  product ceiling = ₹75 L`}</Formula>

        <p className="ctitle mt-5 mb-1">Bullet — §4C</p>
        <Formula note="Monthly interest may not exceed 40% of the monthly surplus — the borrower has to be able to service it out of ordinary cash flow, not out of the exit.">{`cap 1  serviceability = (0.40 × monthly net cash surplus) ÷ (rate ÷ 12)
cap 2  product ceiling = ₹50 L`}</Formula>
      </Card>

      <Card title="The rate build — §5">
        <Formula>{`finalRate = productFloor + qualityAdjustment + structureAdjustment
              quality   ranges −2% to +2%
              structure ranges −1% to +1%`}</Formula>
        <Def term="Never typed in">
          There is no field for the rate. Both adjustments carry a mandatory written justification whenever they are not
          zero, and the tenure carries one always.
        </Def>
        <Def term="Below the floor">
          Any rate below the product floor is a Board decision regardless of ticket size.
        </Def>
      </Card>

      <Card title="The scorecard">
        <p className="text-[13px] leading-relaxed text-slate-400">
          Component scores are policy; the weights that combine them are a Director setting. Every check snapshots the
          weights it used, so an old file keeps the grade it was actually given.
        </p>
        <Formula>{`finalScore = Σ(componentScore × weight) ÷ Σ(weight)

grade    A ≥ 80   ·   B ≥ 65   ·   C ≥ 50   ·   D below 50
PD       0.5–1%       1–2.5%       2.5–5%       over 5%`}</Formula>

        <p className="ctitle mt-4 mb-1">How each component scores, out of 100</p>
        <Formula>{`shared
  CIBIL            (score − 650) ÷ 200 × 100, clamped 0–100   — 650 scores 0, 850 scores 100
  operating years  years ÷ 5 × 100, clamped

Quick Cash
  receivable       platform settlement 90 · corporate 70 · other 50
  counterparty     listed or marquee anchor 85 · other 60
  banking conduct  any bounce in 12 months 35 · clean 75

Rocket Fuel
  round            round ÷ ₹10 Cr × 60  +  max(0, 18 − ageMonths) ÷ 18 × 40, clamped
  investor         graded tier 1 → 90 · tier 2 → 70 · ungraded 50
  runway           months ÷ 18 × 100, clamped
  revenue          monthly revenue ÷ ₹50 L × 100, clamped

Bullet
  primary exit     confirmed in writing 90 · likely or verbal 65 · weak 40
  backup exit      named 70 · none 0
  surplus          100 − (monthlyInterest ÷ (0.40 × surplus)) × 60, clamped`}</Formula>
      </Card>

      <Card title="Gates, caps and deviations">
        <Def term="Hard stops — no deviation possible">
          A no-go sector, a wilful-default record, a Bullet without both exits named, and every §7 concentration cap.
        </Def>
        <Def term="§7 concentration">
          <Formula>{`VC concentration     ≤ 15% of the live book        deviation band 15–20%, hard above 20%
single borrower      ≤ 5% of Net Owned Funds       active only once NOF is recorded
Bullet aggregate     ≤ 25% of the live book

all three activate only once the live book reaches ₹2 Cr — a percentage of a
small book is noise, so below that they report as advisory`}</Formula>
        </Def>
        <Def term="§8 approval authority">
          Read against <b className="text-slate-200">total group exposure after the loan</b>, not the loan alone.
          <Formula>{`up to ₹25 L      Credit Officer + 1 Director
up to ₹50 L      Credit Officer + 2 Directors
up to ₹1 Cr      Credit Committee
above ₹1 Cr      Board of Directors
below the floor  Board of Directors, at any size`}</Formula>
        </Def>
        <Def term="§9 deviations">
          At most two per file — a third is a decline. Each needs at least one compensating control, and the Director
          prices the accepted risk at +1% or +2% on the sanction rate, or records why not.
        </Def>
        <Def term="The verdict, in order">
          <Formula>{`any hard stop failed           → DECLINE
eligible < product minimum     → DECLINE
any soft gate failed           → DEVIATION REQUIRED
eligible < requested           → APPROVE AT A LOWER AMOUNT
otherwise                      → PASS`}</Formula>
        </Def>
      </Card>
    </>
  );
}

/* ============================================================================
   monitoring
   ========================================================================== */
function Monitoring() {
  return (
    <>
      <Card title="The early-warning rules"
        subtitle="Each runs against the book; none of them is asserted by a person">
        <Table cols={['Rule', 'Fires when', 'Severity']} rows={[
          { id: 1, r: 'Overdue tranche', w: 'any open tranche past its tenure', s: 'high past 30 days, else medium' },
          { id: 2, r: 'Utilisation', w: 'drawn to 95% or more of the sanctioned limit', s: 'high at 100% or over' },
          { id: 3, r: 'Review overdue', w: 'the annual review date has passed', s: 'medium' },
          { id: 4, r: 'Site visit due', w: 'money out and no visit in 92 days', s: 'low' },
          { id: 5, r: 'MIS missing', w: 'a Rocket Fuel borrower has not filed last month', s: 'medium' },
          { id: 6, r: 'Revenue drop', w: 'latest month below 80% of the trailing 3-month average', s: 'high' },
          { id: 7, r: 'Runway thin', w: 'closing cash ÷ burn below 6 months', s: 'high below 3, else medium' }
        ]} render={(r) => (<>
          <td className="font-medium text-slate-200">{r.r}</td>
          <Td className="text-slate-400">{r.w}</Td>
          <Td className="text-slate-500">{r.s}</Td>
        </>)} />

        <Formula>{`revenue drop     latestMonthRevenue < (previous 3 months average) × 0.80
runway           closingCash ÷ burn, in months
visit cadence    daysSinceLastVisit > 92`}</Formula>

        <Def term="Raising is idempotent">
          Each rule owns a key per borrower. A condition still true tomorrow <b className="text-slate-200">refreshes</b> the
          alert it already raised — updating the live numbers in its wording — rather than stacking a second one. Severity
          only ever ratchets upward.
        </Def>
        <Def term="Nothing closes itself">
          A rule going quiet is not the same as the risk being dealt with, so an alert is only ever resolved by a person,
          with a written account of what was actually done. The two exceptions are mechanical: logging a visit closes the
          visit alert, and filing a month closes the missing-MIS alert, because those are precisely what was asked for.
        </Def>
        <Def term="The drawdown stop">
          A Director can block every payout to a borrower. It is enforced when a request is raised
          <b className="text-slate-200"> and again</b> when Accounts tries to pay it, not merely displayed.
        </Def>
      </Card>

      <Card title="Renewal gates">
        <p className="text-[13px] leading-relaxed text-slate-400">
          Computed off the book, never claimed by the person asking for the renewal. A failed gate does not block the
          renewal — it demands a written deviation that stays on the case.
        </p>
        <Formula>{`gate 1   no tranche currently past its tenure
gate 2   no high-severity alert raised in the last 183 days
gate 3   no drawdown stop in force
gate 4   utilisation at or below 100%

rate cut capped at 100 bps, and never below the product floor`}</Formula>
      </Card>

      <Card title="Limit enhancement">
        <Formula>{`the product's own sizing caps run again on today's figures
board approval required when   newLimit > 2 × the original sanction
approving writes a dated limit event, which moves both the current
limit and the review clock`}</Formula>
      </Card>
    </>
  );
}

/* ============================================================================
   treasury & reports
   ========================================================================== */
function Treasury() {
  return (
    <>
      <Card title="P&L — what counts as income, and when">
        <Formula>{`processing fees      recognised at disbursal, net of GST
advance interest     recognised at disbursal
interest collected   recognised when a receipt arrives

total income = fees + advance interest + interest collected`}</Formula>
        <Warn>
          <b>GST is never income.</b> It is collected on the desk's behalf and owed onward, so it sits on its own line
          outside the total. Fees are quoted net of it everywhere in the app.
        </Warn>
        <Def term="Cash basis">
          Income is recognised when the money arrives, not as it accrues. What has been earned on the live book but not
          yet received is reported separately as <b className="text-slate-200">accrued, unbilled</b>.
        </Def>
      </Card>

      <Card title="Capital deployment">
        <Formula>{`capital raised, net = Σ(entries in) − Σ(entries out)         up to that date

blended cost        = Σ(amount × rate) ÷ Σ(amount)
                      over interest-bearing entries only — nil-rate director
                      capital would otherwise flatter the average

parked              the latest snapshot per bucket on or before the date
                      (an entry SETS the bucket, it does not add to it)

lent out            Σ max(0, principal − principal repaid) for every drawdown
                      debited on or before the date

idle                = max(0, capital − lent − parked)
utilisation         = lent ÷ capital × 100`}</Formula>
        <Def term="Months are rebuilt, not stored">
          Every month end is reconstructed from the dated entries and the loan book, so correcting an old entry fixes
          every month after it rather than leaving history wrong.
        </Def>
        <Def term="Why idle matters">
          Capital raised at 12.5% and left in a current account earns nothing while still costing 12.5%. The screen puts a
          rupee figure on that gap rather than leaving it to be inferred.
        </Def>
      </Card>

      <Card title="Portfolio & risk">
        <Formula>{`NPA ratio      = outstanding in NPA ÷ total live outstanding × 100
product mix    outstanding by product, as a share of the live book
top exposures  outstanding by borrower, as a share of the live book
VC bands       exposure of every borrower carrying that tag, summed`}</Formula>
        <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">
          All of it is computed as at today from the ledger. Nothing on that screen is a stored figure that could go stale.
        </p>
      </Card>
    </>
  );
}

/* ============================================================================
   documents
   ========================================================================== */
function Documents() {
  return (
    <>
      <Card title="How a PDF is read">
        <Formula>{`1. the text layer      most statements a bank emails already carry their text
                       — exact, free, and a few milliseconds

2. Amazon Textract     only for pages that come back with fewer than 40
                       characters, which in practice means a scan or a photo`}</Formula>
        <Def term="Why the text layer first">
          Reading text that is already there has no recognition error to second-guess, and costs nothing. Recognition is
          approximate and billed per page, so it is used only where there is no alternative — and the result records which
          pages needed it, so a reader knows how much to trust them.
        </Def>
        <Def term="Why Textract rather than a local engine">
          Three things a regulated lender needs. It runs in the same region as the rest of the desk, so a borrower's KYC
          never leaves the country. It can be reached over a VPC endpoint, so the bytes never leave the AWS network at
          all. And its table analysis returns a statement as rows and cells rather than a wall of text — which is the
          whole difficulty in reading a scanned statement.
        </Def>
        <Def term="What it costs">
          Nothing for a digital statement, because none of its pages are sent. Only scanned pages are billed, one page at
          a time, and a document that has already been read is never read again unless a re-read is asked for.
        </Def>
      </Card>

      <Card title="How a bank statement is understood">
        <p className="text-[13px] leading-relaxed text-slate-400">
          Deliberately bank-agnostic. Rather than a template per bank, a row is recognised by its shape, and which way the
          money went is decided by <b className="text-slate-200">which way the running balance moved</b>.
        </p>
        <Formula note="This is also the self-check: if the balances do not chain on at least 90% of rows, the rows were misread and the summary says the totals are indicative.">{`for each row:   delta = thisBalance − previousBalance
                credit when delta is positive, debit when negative
                verified when |delta| equals the printed amount, within 5 paise`}</Formula>
        <Def term="A recognised page keeps its shape">
          Textract returns tables as rows and cells, so a recognised statement is rebuilt row by row and column by column
          before the same parser reads it. A page with no table falls back to its lines, top to bottom. Either way the
          parser downstream cannot tell how the text arrived.
        </Def>
        <Def term="What it works out">
          <Formula>{`period, opening and closing balance
total credits and debits, with counts
average monthly inflow   = total credits ÷ months covered
average balance          = mean of every running balance in the period
returned instruments     narrations matching return, bounce, dishonour,
                           insufficient, ECS/NACH RTN and the like
EMI and mandate outflow, salary-type credits, bank charges
counterparty concentration — who the money actually comes from
month-by-month inflow and outflow`}</Formula>
        </Def>
        <Def term="Reconciliation">
          Where a bank prints its own summary block, the parsed totals are checked against it and the result is shown —
          credits, debits and closing balance each either agree or do not.
        </Def>
      </Card>

      <Card title="Carrying the figures into a credit file">
        <Formula>{`Quick Cash     bounces in 12 months        ← returned instruments
Rocket Fuel    average monthly revenue    ← total credits ÷ months
               monthly burn               ← total debits ÷ months
Bullet         monthly net cash surplus   ← (credits − debits) ÷ months`}</Formula>
        <Warn>
          A five-month statement cannot answer a twelve-month question. Where the period is shorter than a year the app
          says so, and the bounce count is presented as a <b>floor</b> rather than the full picture.
        </Warn>
        <Def term="The source travels with the number">
          Copied figures record the document, its period and when it was read — on the inputs themselves and on the audit
          trail — so months later, “where did this ₹28,470 come from” has an answer on the file.
        </Def>
        <Def term="Copying does not decide anything">
          It updates the inputs only. The verdict does not move until the policy check is run again.
        </Def>
      </Card>

      <Card title="Where documents live">
        <Def term="During origination">
          Filed against the application, in its own folder, because no borrower exists yet.
        </Def>
        <Def term="At sanction">
          Every one of them inherits the new borrower — the rows are re-pointed, the files are not moved, so a link filed
          during origination never breaks.
        </Def>
        <Def term="Approval">
          A document counts as filed only once a Director approves it, and the uploader is told either way.
        </Def>
      </Card>
    </>
  );
}
