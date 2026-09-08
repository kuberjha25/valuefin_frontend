import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Building2, CalendarClock, CheckCircle2, Download, FileText, Gavel,
  Paperclip, Pencil, Plus, Printer, ScanText, ShieldCheck, Sparkles, Trash2, Upload as UploadIcon, X, XCircle
} from 'lucide-react';
import { api, openFile, openLetter } from '../api.js';
import { useAuth } from '../App.jsx';
import {
  Card, Chip, Empty, ErrorNote, Field, KV, Meter, Modal, PageHead, Skeleton, Spinner, Table, Tabs, Td, useToast
} from '../ui.jsx';
import { ProductChip, StageChip, VerdictChip } from '../components/LosChips.jsx';
import StatementAnalysis, { eligibilityFromStatement, shortPeriodWarning } from '../components/StatementAnalysis.jsx';
import { useLoad } from '../hooks.js';
import { fmt, fmtCr, fmtDate, today } from '../format.js';

const num = (v) => Number(v) || 0;
const SETTLED = ['Sanctioned', 'Disbursed'];

export function ApplicationDetail() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const me = useAuth();
  const nav = useNavigate();
  const toast = useToast();

  const { data: app, error, loading, reload } = useLoad(() => api.application(id), [id]);
  const { data: cfg } = useLoad(() => api.settings(), []);
  const [tab, setTab] = useState('file');
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);

  const isDirector = me.role === 'director';
  const canWrite = isDirector || me.role === 'manager';

  /* One place that runs an action, reports it and refreshes the file, so every
     button on this screen behaves the same way on success and on failure. */
  const act = async (fn, msg) => {
    setBusy(true);
    try { const r = await fn(); if (msg) toast(msg); await reload(); return r; }
    catch (e) { toast(e.message, 'err'); return null; }
    finally { setBusy(false); }
  };

  if (error) {
    return (
      <Card>
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
        <div className="mt-4 text-center"><Link className="btn" to="/applications"><ArrowLeft size={15} /> All applications</Link></div>
      </Card>
    );
  }
  if (loading || !app) return <DetailSkeleton />;

  const rc = app.policyCheck;
  const dev = app.deviation;
  const locked = SETTLED.includes(app.stage);
  const editable = canWrite && !locked && (isDirector || !['CAM Pending', 'Approved'].includes(app.stage));
  const filed = app.documents.filter((d) => d.status === 'uploaded').length;

  /* Numbered because the file genuinely moves through them in order — each one
     unlocks the next. */
  const TABS = [
    ['file', '1 · Overview & documents', app.documents.length],
    ['elig', '2 · Policy eligibility'],
    ['cam', '3 · CAM'],
    ['sanction', '4 · Sanction & disbursement']
  ];
  const shared = { app, cfg, me, canWrite, isDirector, editable, busy, act, toast };

  return (
    <div className="space-y-5">
      <Link to="/applications" className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-200">
        <ArrowLeft size={14} /> All applications
      </Link>

      <PageHead title={app.legalName}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
          <span className="font-mono text-[12px] text-slate-300">{app.appCode}</span>
          <span className="flex items-center gap-1.5"><Building2 size={13} /> {app.sector || 'Sector not set'}</span>
          <span>requested {fmt(app.requestedAmount)}</span>
          <span>{app.tenorDays} day tenure</span>
          <span className="flex items-center gap-1.5"><CalendarClock size={13} /> raised {fmtDate(app.createdAt)} by {app.createdBy}</span>
        </span>}>
        {app.borrowerId && <button className="btn" onClick={() => nav('/borrowers/' + app.borrowerId)}><Building2 size={15} /> Borrower</button>}
        {rc && <button className="btn" onClick={() => openLetter(app.id, 'cam')}><Printer size={15} /> CAM</button>}
        {app.sanction && <button className="btn" onClick={() => openLetter(app.id, 'sanction')}><FileText size={15} /> Sanction letter</button>}
        {editable && app.stage !== 'Declined' && (
          <button className="btn btn-icon text-rose-300" title="Decline application" onClick={() => setDeclining(true)}>
            <XCircle size={15} />
          </button>
        )}
      </PageHead>

      <div className="flex flex-wrap items-center gap-2">
        <StageChip stage={app.stage} />
        <ProductChip product={app.product} label={app.productName} />
        {rc && <VerdictChip verdict={rc.verdict} />}
        {dev && <Chip cls={dev.status === 'approved' ? 'chip-good' : dev.status === 'pending' ? 'chip-warn' : 'chip-bad'}>
          Deviation {dev.n}/2 {dev.status}
        </Chip>}
        {app.vcs.map((v) => <Chip key={v} cls="chip-violet">{v}</Chip>)}
        {(app.companyPan || app.gstin) && <Chip cls="chip-slate">{[app.companyPan, app.gstin].filter(Boolean).join(' · ')}</Chip>}
        {app.promoterName && <Chip cls="chip-slate">{app.promoterName}{app.promoterMobile ? ' · ' + app.promoterMobile : ''}</Chip>}
      </div>

      {app.stage === 'Declined' && (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-state-bad/30 bg-state-bad/[.08] px-4 py-3">
          <XCircle size={17} className="mt-0.5 shrink-0 text-rose-300" />
          <div className="min-w-0 flex-1 text-sm text-rose-100"><b>Declined.</b> {app.declineReason || 'No reason recorded.'}</div>
          {isDirector && <button className="btn btn-xs" disabled={busy}
            onClick={() => act(() => api.reopenApplication(id), 'Reopened.')}>Reopen</button>}
        </div>
      )}

      {/* ---- summary ---- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Requested" value={fmtCr(app.requestedAmount)} sub={app.tenureValue + ' ' + app.tenureUnit + ' tenure'} />
        <MiniStat label="Policy-eligible" value={rc ? fmtCr(rc.eligible) : '—'} tone="text-neon-cyan"
          chart={rc ? <Meter value={Math.min(rc.eligible, app.requestedAmount)} max={app.requestedAmount || 1}
            label={rc.eligible >= app.requestedAmount
              ? 'covers the request in full'
              : fmtCr(app.requestedAmount - rc.eligible) + ' short of the request'} /> : null}
          sub={rc ? null : 'policy check not run yet'} />
        <MiniStat label="Rate" value={rc ? rc.rate.final + '%' : (app.rate.final ? app.rate.final + '%' : '—')}
          sub={rc ? rc.rate.floor + '% floor · ' + (rc.rate.qAdj >= 0 ? '+' : '') + rc.rate.qAdj + '% quality · '
            + (rc.rate.sAdj >= 0 ? '+' : '') + rc.rate.sAdj + '% structure' : 'built on the Eligibility tab'} />
        <MiniStat label="Internal grade" value={rc ? rc.score.grade : '—'} tone="text-emerald-300"
          sub={rc ? rc.score.finalScore + ' / 100 · indicative PD ' + rc.score.pd : 'graded by the policy check'} />
        <MiniStat label="Documents filed" value={filed + ' / ' + app.documents.length}
          tone={app.missingDocs ? 'text-neon-amber' : 'text-slate-100'}
          sub={app.missingDocs ? app.missingDocs + ' mandatory row(s) outstanding' : 'checklist complete'} />
        <MiniStat label={app.product === 'quick_cash' ? 'Paper tagged' : 'Deviations used'}
          value={app.product === 'quick_cash' ? fmtCr(app.receivableTotal) : app.devCount + ' / 2'}
          sub={app.product === 'quick_cash'
            ? app.receivables.length + ' receivable(s) behind the facility'
            : (dev ? 'latest ' + dev.status : 'none raised')} />
        <MiniStat label="Approval authority" value={rc ? rc.authority : '—'} sub={rc ? 'per the §8 matrix' : 'set by the policy check'} />
        <MiniStat label={app.sanction ? 'Sanctioned limit' : 'Last updated'}
          value={app.sanction ? fmtCr(app.sanction.amount) : fmtDate(app.updatedAt)}
          tone={app.sanction ? 'text-emerald-300' : 'text-slate-100'}
          sub={app.sanction ? 'expires ' + fmtDate(app.sanction.expiry) : 'stage ' + app.stage} />
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'file' && <FileTab {...shared} />}
      {tab === 'elig' && <EligibilityTab {...shared} />}
      {tab === 'cam' && <CamTab {...shared} />}
      {tab === 'sanction' && <SanctionTab {...shared} />}

      {declining && (
        <DeclineModal onClose={() => setDeclining(false)}
          onConfirm={async (reason) => { await act(() => api.declineApplication(id, reason), 'Application declined.'); setDeclining(false); }} />
      )}
    </div>
  );
}

const MiniStat = ({ label, value, sub, tone = 'text-slate-100', chart }) => (
  <div className="card-tight">
    <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{label}</p>
    <p className={'font-display text-xl font-bold leading-tight num mt-0.5 ' + tone}>{value}</p>
    {chart ? <div className="mt-2">{chart}</div> : sub ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{sub}</p> : null}
  </div>
);

const DetailSkeleton = () => (
  <div className="space-y-5">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-10 w-80" />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
    </div>
    <Skeleton className="h-72" />
  </div>
);

/* ============================================================================
   Documents — the proposal and the mandatory checklist
   ========================================================================== */
function FileTab({ app, editable, busy, act, toast }) {
  const [editing, setEditing] = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  const [reading, setReading] = useState(null);
  const fileFor = (docId) => (app.files || []).find((f) => f.id === docId);

  const upload = async (docKey, file) => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('docKey', docKey);
    await act(() => api.uploadApplicationDoc(app.id, form), 'Filed — it is in the docket and with the Director.');
  };

  return (
    <div className="space-y-5">
      <Card title="Proposal"
        right={editable && <button className="btn btn-xs" onClick={() => setEditing(true)}><Pencil size={12} /> Edit</button>}>
        <div className="grid gap-x-8 sm:grid-cols-2">
          <KV k="Entity type" v={app.entityType || '—'} />
          <KV k="Sector" v={app.sector || '—'} />
          <KV k="Requested" v={fmt(app.requestedAmount)} />
          <KV k="Tenure" v={app.tenureValue + ' ' + app.tenureUnit + ' (' + app.tenorDays + ' days)'} />
          <KV k="Promoter" v={(app.promoterName || '—') + (app.promoterMobile ? ' · ' + app.promoterMobile : '')} />
          <KV k="Company PAN / GSTIN" v={[app.companyPan, app.gstin].filter(Boolean).join(' · ') || '—'} />
          <KV k="Purpose" v={app.purpose || '—'} />
          <KV k="Repayment source" v={app.repaymentSource || '—'} />
        </div>
      </Card>

      <Card title="Document checklist"
        subtitle={app.missingDocs
          ? app.missingDocs + ' mandatory document(s) outstanding — the file moves on once they are all in'
          : 'Complete — every mandatory document is on file'}
        right={editable && <button className="btn btn-xs" onClick={() => setAddingRow(true)}><Plus size={12} /> Add row</button>}>
        <Table cols={['Document', 'Required', 'Filed', 'Review', '']} rows={app.documents}
          empty={<Empty title="No checklist on this file">Checklists are configured under Settings → credit policy.</Empty>}
          render={(d) => {
            const doc = fileFor(d.documentId);
            return (
              <>
                <td className="text-slate-200">{d.label}</td>
                <Td>{d.mandatory ? <Chip cls="chip-slate">mandatory</Chip> : <span className="text-slate-500">optional</span>}</Td>
                <Td className="whitespace-nowrap text-slate-500">
                  {doc ? doc.uploadedBy + ' · ' + fmtDate(doc.uploadedAt) : <Chip cls={d.mandatory ? 'chip-warn' : 'chip-slate'}>pending</Chip>}
                </Td>
                <Td>{doc
                  ? <Chip cls={doc.status === 'approved' ? 'chip-good' : doc.status === 'rejected' ? 'chip-bad' : 'chip-warn'}>{doc.status}</Chip>
                  : <span className="text-slate-600">—</span>}</Td>
                <Td>
                  <span className="flex items-center justify-end gap-1.5">
                    {doc && <button className="btn btn-xs" onClick={() => openFile(doc.id)}><FileText size={12} /> View</button>}
                    {doc && (
                      <button className="btn btn-xs" onClick={() => setReading(doc)} title="Read this document">
                        <ScanText size={12} /> {doc.analysis ? 'Read' : 'Analyse'}
                      </button>
                    )}
                    {editable && <UploadButton busy={busy} label={doc ? 'Replace' : 'Upload'} onPick={(file) => upload(d.key, file)} />}
                    {editable && d.extra && (
                      <button className="btn btn-ghost btn-xs" disabled={busy}
                        onClick={() => act(() => api.removeApplicationDocRow(app.id, d.key), 'Row removed.')}><Trash2 size={12} /></button>
                    )}
                  </span>
                </Td>
              </>
            );
          }} />
      </Card>

      {!!(app.files || []).length && (
        <Card title="Everything filed against this application" subtitle={app.files.length + ' file(s) in the docket'}>
          <Table cols={['Document', 'Tag', 'Category', 'Uploaded', 'Status', '']} rows={app.files}
            render={(f) => (
              <>
                <td className="text-slate-200">{f.title}</td>
                <Td className="font-mono text-[11px] text-slate-500">{f.docKey || '—'}</Td>
                <Td><Chip cls="chip-slate">{f.category}</Chip></Td>
                <Td className="whitespace-nowrap text-slate-500">{f.uploadedBy} · {fmtDate(f.uploadedAt)}</Td>
                <Td><Chip cls={f.status === 'approved' ? 'chip-good' : f.status === 'rejected' ? 'chip-bad' : 'chip-warn'}>{f.status}</Chip></Td>
                <Td>
                  <span className="flex items-center justify-end gap-1.5">
                    <button className="btn btn-ghost btn-xs" onClick={() => setReading(f)} title="Read this document">
                      <ScanText size={14} />
                    </button>
                    <button className="btn btn-ghost btn-xs" onClick={() => openFile(f.id)} title="Open the PDF">
                      <FileText size={14} />
                    </button>
                  </span>
                </Td>
              </>
            )} />
        </Card>
      )}

      {reading && (
        <ReadDocument app={app} doc={reading} editable={editable} act={act} toast={toast}
          onClose={() => setReading(null)}
          onAnalysed={(updated) => { setReading(updated); act(async () => updated); }} />
      )}

      {editing && <EditModal app={app} onClose={() => setEditing(false)}
        onSave={async (body) => { await act(() => api.updateApplication(app.id, body), 'Application updated.'); setEditing(false); }} />}
      {addingRow && <AddRowModal onClose={() => setAddingRow(false)}
        onSave={async (body) => { await act(() => api.addApplicationDocRow(app.id, body), 'Checklist row added.'); setAddingRow(false); }} />}
    </div>
  );
}

function UploadButton({ label, onPick, busy }) {
  const ref = useRef(null);
  return (
    <>
      <button className="btn btn-xs" disabled={busy} onClick={() => ref.current && ref.current.click()}>
        <UploadIcon size={12} /> {label}
      </button>
      <input ref={ref} type="file" accept="application/pdf" className="hidden"
        onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; onPick(f); }} />
    </>
  );
}

/* ============================================================================
   Eligibility — gate inputs, the paper behind the file, the rate build
   ========================================================================== */
const ADJ = (from, to) => {
  const out = [];
  for (let v = from; v <= to + 0.001; v += 0.5) out.push(+v.toFixed(1));
  return out;
};

function EligibilityTab({ app, cfg, isDirector, editable, busy, act, toast }) {
  const [x, setX] = useState(() => ({ ...app.eligibility }));
  const [rate, setRate] = useState(() => ({
    qAdj: num(app.rate.qAdj), sAdj: num(app.rate.sAdj),
    qComment: app.rate.qComment || '', sComment: app.rate.sComment || '', tenorComment: app.rate.tenorComment || ''
  }));
  const [amount, setAmount] = useState(String(app.requestedAmount));
  const [tenure, setTenure] = useState({ value: String(app.tenureValue), unit: app.tenureUnit });
  const [adding, setAdding] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [deviating, setDeviating] = useState(false);
  const [decideDev, setDecideDev] = useState(null);

  const product = cfg && cfg.catalogue.products.find((p) => p.key === app.product);
  const floor = product ? product.floor : 0;
  const finalRate = +(floor + num(rate.qAdj) + num(rate.sAdj)).toFixed(2);
  const set = (key) => (e) => setX((s) => ({ ...s, [key]: e.target.value }));
  const setNum = (key) => (e) => setX((s) => ({ ...s, [key]: e.target.value === '' ? '' : +e.target.value }));
  const payload = () => ({ eligibility: x, rate, requestedAmount: +amount, tenureValue: +tenure.value, tenureUnit: tenure.unit });

  const runCheck = async () => {
    if (!await act(() => api.saveEligibility(app.id, payload()))) return;
    const done = await act(() => api.runPolicyCheck(app.id));
    if (done) toast('Policy check complete — ' + String(done.policyCheck.verdict).replace(/_/g, ' ') + '.');
  };

  const rc = app.policyCheck;
  const dev = app.deviation;
  const canProceed = rc && (['PASS', 'APPROVE_LOWER'].includes(rc.verdict) || (dev && dev.status === 'approved'));

  return (
    <div className="space-y-5">
      <Card title={'Gate inputs — ' + app.productName}
        subtitle="Every gate and cap is tested against these; the check snapshots them onto the file.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Promoter CIBIL">
            <input className="inp" type="number" disabled={!editable} value={x.cibil ?? ''} onChange={setNum('cibil')} placeholder="700" />
          </Field>
          <Field label="Operating history (years)">
            <input className="inp" type="number" step="0.5" disabled={!editable} value={x.opYears ?? ''} onChange={setNum('opYears')} />
          </Field>
          <Field label="Wilful default on record?" hint="A hard stop — no deviation is possible.">
            <select className="inp" disabled={!editable} value={x.wilfulDefault ? '1' : ''}
              onChange={(e) => setX((s) => ({ ...s, wilfulDefault: !!e.target.value }))}>
              <option value="">No</option><option value="1">Yes</option>
            </select>
          </Field>
          <Field label="Requested amount (₹)">
            <input className="inp" type="number" disabled={!editable} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Tenure">
            <input className="inp" type="number" disabled={!editable} value={tenure.value}
              onChange={(e) => setTenure((s) => ({ ...s, value: e.target.value }))} />
          </Field>
          <Field label="Tenure unit">
            <select className="inp" disabled={!editable} value={tenure.unit}
              onChange={(e) => setTenure((s) => ({ ...s, unit: e.target.value }))}>
              <option value="days">Days</option><option value="months">Months</option>
            </select>
          </Field>

          {app.product === 'quick_cash' && <>
            <Field label="Anchor listed or marquee?" hint="Sets coverage at 1.10× rather than 1.20×.">
              <select className="inp" disabled={!editable} value={x.anchorListed ? '1' : ''}
                onChange={(e) => setX((s) => ({ ...s, anchorListed: !!e.target.value }))}>
                <option value="">No — 1.20× coverage</option><option value="1">Yes — 1.10× coverage</option>
              </select>
            </Field>
            <Field label="Receivable quality">
              <select className="inp" disabled={!editable} value={x.receivableType || 'other'} onChange={set('receivableType')}>
                <option value="platform">Platform settlement</option>
                <option value="corporate">Corporate counterparty</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Instrument bounces, last 12 months">
              <input className="inp" type="number" disabled={!editable} value={x.bounces12m ?? 0} onChange={setNum('bounces12m')} />
            </Field>
          </>}

          {app.product === 'rocket_fuel' && <>
            <Field label="Reason for funding (§4B)">
              <select className="inp" disabled={!editable} value={x.fundingReason || ''} onChange={set('fundingReason')}>
                <option value="">— select —</option>
                {['Inventory purchase', 'General working capital', 'Growth spend (marketing / expansion)', 'Bridge to next round']
                  .map((v) => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Last institutional round (₹)">
              <input className="inp" type="number" disabled={!editable} value={x.roundSize ?? ''} onChange={setNum('roundSize')} />
            </Field>
            <Field label="Round age (months)">
              <input className="inp" type="number" disabled={!editable} value={x.roundAgeMonths ?? ''} onChange={setNum('roundAgeMonths')} />
            </Field>
            <Field label="Lead investor" hint="Matched against the graded fund list.">
              <input className="inp" disabled={!editable} value={x.leadInvestor || ''} onChange={set('leadInvestor')} />
            </Field>
            <Field label="Current runway (months)">
              <input className="inp" type="number" step="0.5" disabled={!editable} value={x.runwayMonths ?? ''} onChange={setNum('runwayMonths')} />
            </Field>
            <Field label="Average monthly revenue, trailing 6 months (₹)">
              <input className="inp" type="number" disabled={!editable} value={x.avgMonthlyRevenue ?? ''} onChange={setNum('avgMonthlyRevenue')} />
            </Field>
            <Field label="Monthly burn (₹)">
              <input className="inp" type="number" disabled={!editable} value={x.monthlyBurn ?? ''} onChange={setNum('monthlyBurn')} />
            </Field>
            <Field label="Existing external debt (₹)" hint="§4B cap 4: debt after our loan ≤ 1× the round.">
              <input className="inp" type="number" disabled={!editable} value={x.existingDebt ?? 0} onChange={setNum('existingDebt')} />
            </Field>
          </>}

          {app.product === 'bullet' && <>
            <Field label="Average monthly net cash surplus (₹)">
              <input className="inp" type="number" disabled={!editable} value={x.netCashSurplus ?? ''} onChange={setNum('netCashSurplus')} />
            </Field>
            <Field label="Primary exit (named)">
              <input className="inp" disabled={!editable} value={x.exitPrimary || ''} onChange={set('exitPrimary')}
                placeholder="e.g. Series-A tranche 2 — Fund X" />
            </Field>
            <Field label="Primary exit quality">
              <select className="inp" disabled={!editable} value={x.exitPrimaryQuality || 'likely'} onChange={set('exitPrimaryQuality')}>
                <option value="confirmed">Confirmed in writing</option>
                <option value="likely">Likely / verbal</option>
                <option value="weak">Weak</option>
              </select>
            </Field>
            <Field label="Backup exit (named)">
              <input className="inp" disabled={!editable} value={x.exitBackup || ''} onChange={set('exitBackup')}
                placeholder="e.g. promoter infusion / asset sale" />
            </Field>
            <Field label="Exit value (₹)" hint="§4C: the named exit must cover at least 1.5× the loan.">
              <input className="inp" type="number" disabled={!editable} value={x.exitAmount ?? ''} onChange={setNum('exitAmount')} />
            </Field>
          </>}
        </div>
      </Card>

      {app.product === 'quick_cash' && (
        <Card title="Receivables behind this facility"
          subtitle="§4A: Quick Cash is sized off tagged paper — PO at the 75% tier, invoice, bill and settlement at 90%."
          right={editable && <div className="flex gap-2">
            <button className="btn btn-xs" onClick={() => setAdding(true)}><Plus size={12} /> Add paper</button>
            <button className="btn btn-xs" onClick={() => setBulk(true)}><Paperclip size={12} /> Bulk import</button>
          </div>}>
          <Table cols={['Kind', 'Number', 'Buyer', '#Value', 'Dated', 'Due', 'Document', '']} rows={app.receivables}
            empty={<Empty title="No paper tagged yet">Quick Cash cannot be sized until at least one receivable is on the file.</Empty>}
            render={(p) => (
              <>
                <Td><Chip cls={p.kind === 'PO' ? 'chip-slate' : 'chip-cyan'}>{p.kind}</Chip></Td>
                <Td className="font-mono text-[11px] font-semibold text-slate-200">{p.number}</Td>
                <Td>{p.buyer || '—'}</Td>
                <Td r>{fmt(p.value)}</Td>
                <Td className="whitespace-nowrap text-slate-500">{fmtDate(p.date)}</Td>
                <Td className="whitespace-nowrap text-slate-500">{p.dueDate ? fmtDate(p.dueDate) : '—'}</Td>
                <Td>{p.documentId
                  ? <button className="btn btn-xs" onClick={() => openFile(p.documentId)}><FileText size={12} /> View</button>
                  : <span className="text-slate-600">none</span>}</Td>
                <Td>{editable && <button className="btn btn-ghost btn-xs" disabled={busy}
                  onClick={() => act(() => api.removeReceivable(app.id, p.id), 'Receivable removed.')}><Trash2 size={12} /></button>}</Td>
              </>
            )}
            footer={app.receivables.length ? (
              <tr className="border-t border-white/10">
                <td colSpan={3} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {app.receivables.length} receivable(s) tagged
                </td>
                <td className="num px-3 text-right font-semibold text-white">{fmt(app.receivableTotal)}</td>
                <td colSpan={4} />
              </tr>
            ) : null} />
        </Card>
      )}

      <Card title="Rate build"
        subtitle="§5: the rate is never typed in — the product floor plus a justified quality and structure adjustment.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Product floor">
            <p className="num font-display text-xl font-bold text-white">{floor}% p.a.</p>
          </Field>
          <Field label="Quality adjustment (±2%)">
            <select className="inp" disabled={!editable} value={rate.qAdj}
              onChange={(e) => setRate((s) => ({ ...s, qAdj: +e.target.value }))}>
              {ADJ(-2, 2).map((v) => <option key={v} value={v}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</option>)}
            </select>
          </Field>
          <Field label="Quality justification"
            error={rate.qAdj !== 0 && !rate.qComment.trim() ? 'Mandatory whenever the adjustment is not zero.' : null}>
            <input className="inp" disabled={!editable} value={rate.qComment}
              onChange={(e) => setRate((s) => ({ ...s, qComment: e.target.value }))}
              placeholder="e.g. CIBIL 742, listed anchor, clean banking" />
          </Field>
          <Field label="Structure adjustment (±1%)">
            <select className="inp" disabled={!editable} value={rate.sAdj}
              onChange={(e) => setRate((s) => ({ ...s, sAdj: +e.target.value }))}>
              {ADJ(-1, 1).map((v) => <option key={v} value={v}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</option>)}
            </select>
          </Field>
          <Field label="Structure justification"
            error={rate.sAdj !== 0 && !rate.sComment.trim() ? 'Mandatory whenever the adjustment is not zero.' : null}>
            <input className="inp" disabled={!editable} value={rate.sComment}
              onChange={(e) => setRate((s) => ({ ...s, sComment: e.target.value }))}
              placeholder="e.g. escrow on collections, advance interest" />
          </Field>
          <Field label="Final rate">
            <p className="num font-display text-xl font-bold text-white">{finalRate}% p.a.</p>
            {finalRate < floor && <p className="mt-1 text-[11px] text-neon-amber">Below the floor — a Board decision (§5.3).</p>}
          </Field>
          <Field label="Tenure justification" className="sm:col-span-2 xl:col-span-3"
            error={!rate.tenorComment.trim() ? 'Mandatory before the policy check will run.' : null}>
            <input className="inp" disabled={!editable} value={rate.tenorComment}
              onChange={(e) => setRate((s) => ({ ...s, tenorComment: e.target.value }))}
              placeholder="e.g. matches the PO payment cycle of 75–90 days" />
          </Field>
        </div>
        {editable && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="btn" disabled={busy}
              onClick={() => act(() => api.saveEligibility(app.id, payload()), 'Gate inputs saved.')}>Save inputs</button>
            <button className="btn btn-p" disabled={busy} onClick={runCheck}>
              {busy ? <Spinner /> : <ShieldCheck size={15} />} Run policy check
            </button>
            <p className="text-[11px] text-slate-500">
              Snapshots every input, cap, gate and the verdict onto the file and the audit trail.
            </p>
          </div>
        )}
      </Card>

      {rc && <PolicyResult app={app} rc={rc} />}

      {rc && (
        <Card title="What happens next">
          <div className="flex flex-wrap gap-2">
            {editable && canProceed && !['CAM', 'CAM Pending', 'Approved'].includes(app.stage) && (
              <button className="btn btn-p" disabled={busy}
                onClick={() => act(() => api.startCam(app.id), 'Moved to CAM — write it up on the CAM tab.')}>
                Proceed to CAM
              </button>
            )}
            {editable && !canProceed && (!dev || dev.status === 'rejected') && app.devCount < 2 && (
              <button className="btn btn-p" disabled={busy} onClick={() => setDeviating(true)}>
                <Gavel size={15} /> Raise a deviation ({app.devCount} of 2 used)
              </button>
            )}
            {app.devCount >= 2 && (!dev || dev.status !== 'approved') && (
              <Chip cls="chip-bad">§9: both deviations are used — a third is a decline</Chip>
            )}
            {canProceed && ['CAM', 'CAM Pending', 'Approved'].includes(app.stage) && (
              <Chip cls="chip-good">Cleared to proceed — continue on the CAM tab</Chip>
            )}
          </div>
        </Card>
      )}

      {dev && <DeviationCard app={app} isDirector={isDirector} busy={busy} onDecide={(approve) => setDecideDev({ approve })} />}

      {adding && <ReceivableModal onClose={() => setAdding(false)}
        onSave={async (form) => { await act(() => api.addReceivable(app.id, form), 'Receivable tagged.'); setAdding(false); }} />}
      {bulk && <BulkReceivableModal onClose={() => setBulk(false)}
        onSave={async (text) => {
          const r = await act(() => api.bulkReceivables(app.id, text));
          if (r) {
            toast(r.imported + ' receivable(s) imported' + (r.duplicates ? ', ' + r.duplicates + ' duplicate(s) skipped' : '') + '.');
            setBulk(false);
          }
        }} />}
      {deviating && <DeviationModal controls={cfg ? cfg.catalogue.deviationControls : []} n={app.devCount + 1}
        onClose={() => setDeviating(false)}
        onSave={async (body) => { await act(() => api.raiseDeviation(app.id, body), 'Deviation sent to the Director.'); setDeviating(false); }} />}
      {decideDev && <DecideDeviationModal deviation={dev} approve={decideDev.approve} onClose={() => setDecideDev(null)}
        onSave={async (body) => {
          await act(() => api.decideDeviation(app.id, body), 'Deviation ' + (body.approve ? 'approved' : 'rejected') + '.');
          setDecideDev(null);
        }} />}
    </div>
  );
}

function PolicyResult({ app, rc }) {
  const gap = (value) => {
    const g = value - num(app.requestedAmount);
    return g >= 0
      ? <span className="text-emerald-300">headroom {fmtCr(g)}</span>
      : <span className="text-rose-300">short by {fmtCr(-g)}</span>;
  };
  const tone = {
    PASS: 'border-state-good/30 bg-state-good/[.07]',
    APPROVE_LOWER: 'border-neon-amber/30 bg-neon-amber/[.07]',
    DEVIATION_REQUIRED: 'border-neon-amber/30 bg-neon-amber/[.07]',
    DECLINE: 'border-state-bad/30 bg-state-bad/[.07]'
  }[rc.verdict];

  return (
    <Card title="Policy check" subtitle={'Credit Policy v' + rc.policyVersion + ' · run ' + fmtDate(rc.ts, true)}>
      <div className={'rounded-2xl border px-4 py-3 ' + tone}>
        <div className="flex flex-wrap items-center gap-2">
          <VerdictChip verdict={rc.verdict} />
          <span className="num text-sm font-semibold text-slate-100">eligible {fmt(rc.eligible)}</span>
        </div>
        <p className="mt-1.5 text-sm text-slate-300">{rc.reason}</p>
      </div>

      <div className="mt-4 grid gap-5 xl:grid-cols-2">
        <div>
          <p className="ctitle mb-2">Sizing caps · against {fmt(app.requestedAmount)} requested</p>
          <Table cols={['Cap', '#Value']} rows={rc.caps.map((c, i) => ({ ...c, id: i }))}
            render={(c) => (
              <>
                <td className={c.label === rc.binding ? 'font-semibold text-slate-100' : 'text-slate-300'}>
                  {c.label}
                  {c.label === rc.binding && <Chip cls="chip-violet ml-1.5">binding</Chip>}
                </td>
                <Td r>
                  <b className="text-slate-100">{fmt(c.value)}</b>
                  <span className="mt-0.5 block text-[11px]">{gap(c.value)}</span>
                </Td>
              </>
            )}
            footer={<tr className="border-t border-white/10">
              <td className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Eligible — lowest cap, rounded down to ₹1 L
              </td>
              <td className="num px-3 text-right font-display text-lg font-bold text-white">{fmt(rc.eligible)}</td>
            </tr>} />

          <div className="mt-3">
            <KV k="Internal score" v={rc.score.finalScore + ' / 100 · grade ' + rc.score.grade + ' · PD ' + rc.score.pd} />
            <KV k="Approval authority" v={rc.authority} />
            <KV k="Rate build" v={rc.rate.floor + '% floor '
              + (rc.rate.qAdj >= 0 ? '+' : '') + rc.rate.qAdj + '% quality '
              + (rc.rate.sAdj >= 0 ? '+' : '') + rc.rate.sAdj + '% structure = ' + rc.rate.final + '%'} />
          </div>

          <details className="mt-3 rounded-2xl border border-white/8 bg-white/[.025] px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-neon-violet">Grade basis — component breakdown</summary>
            <Table cols={['Component', '#Weight', '#Score', '#Weighted']} rows={rc.score.breakdown}
              render={(b) => (
                <>
                  <td className="text-slate-300">{b.label}</td>
                  <Td r>{b.weight}%</Td>
                  <Td r>{b.score}</Td>
                  <Td r className="font-semibold text-slate-100">{(b.score * b.weight / 100).toFixed(1)}</Td>
                </>
              )} />
            <p className="mt-2 text-[11px] text-slate-500">
              Grades: A ≥ 80 · B ≥ 65 · C ≥ 50 · below 50 is D. The weights used are snapshotted with the check.
            </p>
          </details>
        </div>

        <div>
          <p className="ctitle mb-2">Minimum gates and §7 caps</p>
          <div className="space-y-1.5">
            {rc.gates.map((g, i) => (
              <div key={i} className={'rounded-xl border px-3 py-2 text-[13px] '
                + (g.pass ? 'border-state-good/20 bg-state-good/[.05]' : 'border-state-bad/25 bg-state-bad/[.06]')}>
                <div className="flex items-start gap-2">
                  {g.pass
                    ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-300" />
                    : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rose-300" />}
                  <span className="flex-1 text-slate-200">{g.label}</span>
                  {!g.pass && g.hard && <Chip cls="chip-bad">hard stop</Chip>}
                </div>
                <p className="mt-0.5 pl-6 text-[11px] text-slate-500">required {g.required} · actual {g.actual}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function DeviationCard({ app, isDirector, busy, onDecide }) {
  const d = app.deviation;
  const chip = d.status === 'pending' ? <Chip cls="chip-warn">with the Director</Chip>
    : d.status === 'approved' ? <Chip cls="chip-good">approved by {d.decidedBy}</Chip>
      : <Chip cls="chip-bad">rejected</Chip>;
  return (
    <Card title={'Deviation ' + d.n + ' of 2'} subtitle="§9: one compensating control minimum, priced at +1% to +2%." right={chip}>
      <KV k="Gate(s) and reason" v={d.reason} />
      <KV k="Compensating controls" v={d.compensating} />
      <KV k="Raised" v={d.raisedBy + ' · ' + fmtDate(d.ts, true)} />
      {d.checkerComment && <KV k="Director comment" v={d.checkerComment} />}
      {d.status === 'approved' && (
        <KV k="§9 pricing" v={d.pricingBump ? '+' + d.pricingBump + '% on the sanction rate' : 'no bump — see the comment'} />
      )}
      {isDirector && d.status === 'pending' && (
        <div className="mt-4 flex gap-2">
          <button className="btn btn-p" disabled={busy} onClick={() => onDecide(true)}><CheckCircle2 size={15} /> Approve</button>
          <button className="btn btn-d" disabled={busy} onClick={() => onDecide(false)}><XCircle size={15} /> Reject</button>
        </div>
      )}
    </Card>
  );
}

/* ============================================================================
   CAM
   ========================================================================== */
const CAM_SECTIONS = [
  ['pdNotes', 'Personal discussion (PD) notes', 'What the promoter said, what you verified, and what you saw.'],
  ['bizMgmt', 'Business & management assessment', ''],
  ['repaymentTools', 'Repayment tools / source of repayment', ''],
  ['finAssessment', 'Financial assessment', ''],
  ['risks', 'Key risks & mitigation', ''],
  ['conditionsPrecedent', 'Conditions precedent', 'One per line — these print on the sanction letter.']
];

function CamTab({ app, isDirector, canWrite, busy, act, toast }) {
  const cam = app.cam || {};
  const [draft, setDraft] = useState(() => CAM_SECTIONS.reduce((m, [k]) => ({ ...m, [k]: cam[k] || '' }), {}));
  const [deciding, setDeciding] = useState(null);
  const readOnly = !canWrite || cam.status === 'pending' || cam.status === 'approved' || SETTLED.includes(app.stage);

  useEffect(() => {
    setDraft(CAM_SECTIONS.reduce((m, [k]) => ({ ...m, [k]: (app.cam || {})[k] || '' }), {}));
  }, [app.cam]);

  const missing = !String(draft.pdNotes || '').trim() || !String(draft.repaymentTools || '').trim();
  const statusChip = cam.status === 'pending' ? <Chip cls="chip-warn">awaiting the Director</Chip>
    : cam.status === 'approved' ? <Chip cls="chip-good">approved by {cam.decidedBy}</Chip>
      : cam.status === 'rejected' ? <Chip cls="chip-bad">rejected</Chip>
        : <Chip cls="chip-slate">draft</Chip>;

  return (
    <div className="space-y-5">
      {!app.policyCheck && (
        <div className="rounded-2xl border border-neon-amber/30 bg-neon-amber/[.07] px-4 py-3 text-sm text-amber-100">
          Run the policy check first — the CAM embeds its snapshot.
        </div>
      )}

      {app.policyCheck && (
        <Card title="Credit snapshot" subtitle="Carried from the policy check — the CAM cannot disagree with it.">
          <div className="grid gap-x-8 sm:grid-cols-2">
            <KV k="Requested / eligible" v={fmtCr(app.requestedAmount) + ' · ' + fmtCr(app.policyCheck.eligible)} />
            <KV k="Rate" v={app.policyCheck.rate.final + '% p.a.'} />
            <KV k="Tenure" v={app.tenorDays + ' days'} />
            <KV k="Binding cap" v={app.policyCheck.binding} />
            <KV k="Grade" v={'Grade ' + app.policyCheck.score.grade + ' (' + app.policyCheck.score.finalScore + '/100)'} />
            <KV k="Approval authority" v={app.policyCheck.authority} />
          </div>
        </Card>
      )}

      <Card title="Credit Appraisal Memorandum" right={statusChip}
        subtitle={cam.comment ? 'Director: ' + cam.comment : 'PD notes and repayment tools are mandatory before it goes up.'}>
        <div className="space-y-4">
          {CAM_SECTIONS.map(([key, label, hint]) => (
            <Field key={key} label={label} hint={hint}>
              <textarea className="inp min-h-24" disabled={readOnly} value={draft[key]}
                onChange={(e) => setDraft((s) => ({ ...s, [key]: e.target.value }))} />
            </Field>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!readOnly && <button className="btn" disabled={busy}
            onClick={() => act(() => api.saveCam(app.id, draft), 'CAM draft saved.')}>Save draft</button>}
          {!readOnly && (
            <button className="btn btn-p" disabled={busy || missing}
              onClick={() => act(() => api.submitCam(app.id, draft), 'CAM sent to the Director.')}>Send to the Director</button>
          )}
          <button className="btn" onClick={() => openLetter(app.id, 'cam')}><Printer size={15} /> Generate CAM</button>
          {cam.status === 'rejected' && canWrite && (
            <button className="btn" disabled={busy}
              onClick={() => act(() => api.reworkCam(app.id), 'Reopened for rework.')}>Rework</button>
          )}
          {isDirector && app.stage === 'CAM Pending' && <>
            <button className="btn btn-p" disabled={busy} onClick={() => setDeciding(true)}><CheckCircle2 size={15} /> Approve</button>
            <button className="btn btn-d" disabled={busy} onClick={() => setDeciding(false)}><XCircle size={15} /> Decline</button>
          </>}
        </div>
      </Card>

      {deciding != null && (
        <DecideCamModal approve={deciding} app={app} onClose={() => setDeciding(null)}
          onSave={async (approve, note) => {
            await act(() => api.decideCam(app.id, approve, note), approve ? 'Application approved.' : 'Application declined.');
            setDeciding(null);
            if (approve) toast('Record the sanction terms on the Sanction tab to open the facility.');
          }} />
      )}
    </div>
  );
}

/* ============================================================================
   Sanction
   ========================================================================== */
function SanctionTab({ app, cfg, canWrite, busy, act }) {
  const nav = useNavigate();
  const rc = app.policyCheck || {};
  const approvedDeviation = app.deviation && app.deviation.status === 'approved';
  const [f, setF] = useState(() => ({
    amount: String(Math.min(num(app.requestedAmount), num(rc.eligible) || num(app.requestedAmount))),
    tenorDays: String(app.tenorDays),
    pfPct: '1',
    penalPct: String(cfg ? cfg.policy.penalDefault : 24),
    sanctionDate: today(),
    expiry: ''
  }));
  const set = (key) => (e) => setF((s) => ({ ...s, [key]: e.target.value }));

  if (app.sanction) {
    const s = app.sanction;
    return (
      <Card title="Facility" subtitle="Sanctioned and live on the book — servicing now runs through the ledger.">
        <div className="grid gap-x-8 sm:grid-cols-2">
          <KV k="Sanctioned limit" v={fmt(s.amount)} />
          <KV k="Rate" v={s.rate + '% p.a.' + (s.pricingBump ? ' (incl. §9 +' + s.pricingBump + '%)' : '')} />
          <KV k="Tenor per tranche" v={s.tenorDays + ' days'} />
          <KV k="Processing fee" v={s.pfPct + '% + GST ' + s.gstPct + '%'} />
          <KV k="Penal spread" v={s.penalPct + '% p.a. past maturity'} />
          <KV k="Sanction date" v={fmtDate(s.sanctionDate)} />
          <KV k="Facility validity" v={fmtDate(s.expiry)} />
          <KV k="Sanctioned by" v={s.sanctionedBy + ' · ' + fmtDate(s.sanctionedAt, true)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn" onClick={() => openLetter(app.id, 'sanction')}><Printer size={15} /> Sanction letter</button>
          <button className="btn" onClick={() => openLetter(app.id, 'sanction', true)}><Download size={15} /> Download</button>
          <button className="btn" onClick={() => openLetter(app.id, 'agreement')}><FileText size={15} /> Draft agreement</button>
          {app.borrowerId && <button className="btn btn-p" onClick={() => nav('/borrowers/' + app.borrowerId)}>Open the borrower</button>}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Download the letter and the agreement, get them signed, then upload the signed copies against the borrower —
          they file into the same docket as everything on this application.
        </p>
      </Card>
    );
  }

  if (app.stage !== 'Approved') {
    return (
      <Card>
        <Empty icon={ShieldCheck} title="Sanction unlocks once the Director approves the CAM">
          This file is at <b>{app.stage}</b>. Complete the checklist, run the policy check, write the CAM and send it up.
        </Empty>
      </Card>
    );
  }

  const eligible = num(rc.eligible);
  const over = eligible > 0 && +f.amount > eligible;

  return (
    <Card title="Sanction terms"
      subtitle="Recording these creates the borrower and its facility on the live book, and moves every document filed here across.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Sanctioned amount (₹)" hint={eligible ? 'Policy-eligible ' + fmt(eligible) : null}
          error={over && !approvedDeviation ? 'Above the policy-eligible amount — this needs an approved deviation.' : null}>
          <input className="inp" type="number" value={f.amount} onChange={set('amount')} />
        </Field>
        <Field label="Rate (from the rate build)">
          <p className="num font-display text-xl font-bold text-white">
            {(num(rc.rate && rc.rate.final) + (approvedDeviation ? num(app.deviation.pricingBump) : 0)).toFixed(2)}% p.a.
          </p>
          {approvedDeviation && !!num(app.deviation.pricingBump) && (
            <p className="mt-1 text-[11px] text-slate-500">Includes the §9 bump of +{app.deviation.pricingBump}%.</p>
          )}
        </Field>
        <Field label="Tenor per tranche (days)">
          <input className="inp" type="number" value={f.tenorDays} onChange={set('tenorDays')} />
        </Field>
        <Field label="Processing fee % (per drawdown)">
          <input className="inp" type="number" step="0.1" value={f.pfPct} onChange={set('pfPct')} />
        </Field>
        <Field label="Penal spread % p.a. (past maturity)">
          <input className="inp" type="number" value={f.penalPct} onChange={set('penalPct')} />
        </Field>
        <Field label="Sanction date" hint="Back-datable, so an existing book can be migrated.">
          <input className="inp" type="date" value={f.sanctionDate} onChange={set('sanctionDate')} />
        </Field>
        <Field label="Facility validity / expiry" hint="Defaults to one year from the sanction date.">
          <input className="inp" type="date" value={f.expiry} onChange={set('expiry')} />
        </Field>
      </div>

      {canWrite && (
        <button className="btn btn-p mt-4" disabled={busy || !(+f.amount > 0) || (over && !approvedDeviation)}
          onClick={() => act(() => api.sanctionApplication(app.id, {
            amount: +f.amount, tenorDays: +f.tenorDays, pfPct: +f.pfPct, penalPct: +f.penalPct,
            sanctionDate: f.sanctionDate, expiry: f.expiry || undefined
          }), 'Sanctioned — the facility is live in the ledger.')}>
          {busy && <Spinner />}Mark sanctioned
        </button>
      )}
    </Card>
  );
}

/* ============================================================================
   Reading a filed document, and carrying what it says into the gate inputs.

   The statement is the evidence behind two of the policy's numbers — banking
   conduct and, for growth capital, the revenue and burn the sizing runs off.
   Copying them across by hand invites a typo that nobody can trace back, so the
   figures move in one step, with what is about to be written shown first and
   the source document recorded alongside them.
   ========================================================================== */
function ReadDocument({ app, doc, editable, act, toast, onClose, onAnalysed }) {
  const [busy, setBusy] = useState(false);
  const rows = eligibilityFromStatement(doc.analysis, app.product);
  const warning = shortPeriodWarning(doc.analysis);
  const canCopy = editable && rows.length > 0 && doc.analysis && doc.analysis.kind === 'bank_statement';

  const copy = async () => {
    setBusy(true);
    try {
      const eligibility = { ...(app.eligibility || {}) };
      rows.forEach((r) => { eligibility[r.key] = r.value; });
      /* Recorded on the inputs themselves, so a later reader can see which
         statement the figures came from without digging through the trail. */
      eligibility.statementSource = {
        documentId: doc.id, title: doc.title,
        period: doc.analysis.summary.period.from + ' to ' + doc.analysis.summary.period.to,
        readAt: doc.analysis.at
      };
      await act(() => api.saveEligibility(app.id, { eligibility }),
        rows.length + ' figure(s) copied into the gate inputs.');
      toast('Re-run the policy check to score against them.', 'info');
      onClose();
    } catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal size="xl" title={doc.title}
      subtitle={'Filed ' + fmtDate(doc.uploadedAt, true) + ' by ' + doc.uploadedBy +
        (doc.analysis ? ' · read ' + fmtDate(doc.analysis.at, true) : '')}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={() => openFile(doc.id)}><FileText size={15} /> Open the PDF</button>
        <button className="btn" onClick={onClose}>Close</button>
        {canCopy && (
          <button className="btn btn-p" disabled={busy} onClick={copy}>
            {busy ? <Spinner /> : <Sparkles size={15} />} Copy into eligibility
          </button>
        )}
      </>}>
      <div className="max-h-[64vh] space-y-4 overflow-y-auto pr-1">
        <StatementAnalysis doc={doc} onAnalysed={onAnalysed} />

        {canCopy && (
          <Card title="What this would set on the gate inputs"
            subtitle={'Only the fields ' + app.productName + " reads are offered — the rest of the policy is untouched."}>
            <Table cols={['Gate input', '#Currently', '#From this statement', 'Basis']}
              rows={rows.map((r) => ({ ...r, id: r.key }))}
              render={(r) => {
                const current = (app.eligibility || {})[r.key];
                const changed = String(current ?? '') !== String(r.value);
                return (
                  <>
                    <td className="text-slate-200">{r.label}</td>
                    <Td r className="text-slate-500">{current == null || current === '' ? '—' : fmt(current)}</Td>
                    <Td r className={changed ? 'font-semibold text-neon-violet' : 'text-slate-400'}>{fmt(r.value)}</Td>
                    <td className="text-[11px] text-slate-500">{r.from}</td>
                  </>
                );
              }} />
            {warning && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-neon-amber/25 bg-neon-amber/[.06] px-3 py-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-neon-amber" />
                <p className="text-[12px] leading-snug text-amber-100">{warning}</p>
              </div>
            )}
            <p className="mt-3 text-[11px] text-slate-500">
              Copying updates the inputs only. The verdict does not move until the policy check is run again.
            </p>
          </Card>
        )}

        {doc.analysis && !canCopy && rows.length > 0 && !editable && (
          <p className="text-[12px] text-slate-500">
            The figures above can be carried into the gate inputs while the file is still open for editing.
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ============================================================================
   modals
   ========================================================================== */
function EditModal({ app, onClose, onSave }) {
  const [f, setF] = useState({
    legalName: app.legalName, entityType: app.entityType, sector: app.sector, purpose: app.purpose,
    repaymentSource: app.repaymentSource, promoterName: app.promoterName, promoterMobile: app.promoterMobile,
    companyPan: app.companyPan, gstin: app.gstin, vcs: app.vcs
  });
  const [vc, setVc] = useState('');
  const set = (key) => (e) => setF((s) => ({ ...s, [key]: e.target.value }));
  const addVc = () => {
    const v = vc.trim();
    if (v && !f.vcs.includes(v)) setF((s) => ({ ...s, vcs: [...s.vcs, v] }));
    setVc('');
  };
  return (
    <Modal title="Edit application" subtitle={app.appCode} size="lg" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p" onClick={() => onSave(f)}>Save changes</button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Legal entity name" className="sm:col-span-2"><input className="inp" value={f.legalName} onChange={set('legalName')} /></Field>
        <Field label="Entity type"><input className="inp" value={f.entityType} onChange={set('entityType')} /></Field>
        <Field label="Sector"><input className="inp" value={f.sector} onChange={set('sector')} /></Field>
        <Field label="Promoter"><input className="inp" value={f.promoterName} onChange={set('promoterName')} /></Field>
        <Field label="Promoter mobile"><input className="inp" value={f.promoterMobile} onChange={set('promoterMobile')} /></Field>
        <Field label="Company PAN"><input className="inp uppercase" value={f.companyPan} onChange={set('companyPan')} /></Field>
        <Field label="GSTIN"><input className="inp uppercase" value={f.gstin} onChange={set('gstin')} /></Field>
        <Field label="Purpose" className="sm:col-span-2"><textarea className="inp min-h-20" value={f.purpose} onChange={set('purpose')} /></Field>
        <Field label="Repayment source" className="sm:col-span-2"><textarea className="inp min-h-20" value={f.repaymentSource} onChange={set('repaymentSource')} /></Field>
        <Field label="VC / investor tags" className="sm:col-span-2">
          <div className="flex gap-2">
            <input className="inp" value={vc} onChange={(e) => setVc(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVc(); } }} />
            <button type="button" className="btn shrink-0" onClick={addVc}><Plus size={14} /></button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {f.vcs.map((v) => (
              <button key={v} type="button" className="chip-violet"
                onClick={() => setF((s) => ({ ...s, vcs: s.vcs.filter((x) => x !== v) }))}>{v} <X size={11} /></button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function AddRowModal({ onClose, onSave }) {
  const [label, setLabel] = useState('');
  const [mandatory, setMandatory] = useState(false);
  return (
    <Modal title="Add a document row" subtitle="For anything the standard checklist does not cover." onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p" disabled={!label.trim()} onClick={() => onSave({ label, mandatory })}>Add row</button>
      </>}>
      <Field label="Label">
        <input className="inp" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Udyam certificate" />
      </Field>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />
        Mandatory — the file stays in Docs Pending until it is uploaded
      </label>
    </Modal>
  );
}

function ReceivableModal({ onClose, onSave }) {
  const [f, setF] = useState({ kind: 'PO', number: '', buyer: '', value: '', date: today(), dueDate: '' });
  const [file, setFile] = useState(null);
  const set = (key) => (e) => setF((s) => ({ ...s, [key]: e.target.value }));
  const submit = () => {
    const form = new FormData();
    Object.entries(f).forEach(([k, v]) => { if (v) form.append(k, v); });
    if (file) form.append('file', file);
    onSave(form);
  };
  return (
    <Modal title="Tag a receivable" subtitle="PO sizes at the 75% tier; invoice, bill and platform settlement at 90%." onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p" disabled={!f.number.trim() || !(+f.value > 0)} onClick={submit}>Add receivable</button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind">
          <select className="inp" value={f.kind} onChange={set('kind')}>
            {['PO', 'Invoice', 'Bill', 'Platform', 'Other'].map((k) => <option key={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Number"><input className="inp" autoFocus value={f.number} onChange={set('number')} placeholder="PO-1024" /></Field>
        <Field label="Buyer / counterparty"><input className="inp" value={f.buyer} onChange={set('buyer')} /></Field>
        <Field label="Value (₹)"><input className="inp" type="number" value={f.value} onChange={set('value')} /></Field>
        <Field label="Dated"><input className="inp" type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Payment due date" hint="Drives the suggested tenor: due date + 30-day grace, capped at 120 days.">
          <input className="inp" type="date" value={f.dueDate} onChange={set('dueDate')} />
        </Field>
        <Field label="Attach the paper (PDF)" className="sm:col-span-2">
          <input className="inp" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0] || null)} />
        </Field>
      </div>
    </Modal>
  );
}

const TEMPLATE = 'Kind,Number,Buyer,Value,Date,DueDate\nPO,PO-1024,FirstCry,2500000,2026-06-15,2026-09-13\nInvoice,INV-88,Nykaa,1200000,2026-06-20,2026-08-04';

function BulkReceivableModal({ onClose, onSave }) {
  const [text, setText] = useState('');
  const readFile = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setText(String(r.result || ''));
    r.readAsText(file);
  };
  return (
    <Modal title="Bulk import receivables" size="lg" onClose={onClose}
      subtitle="Column order: Kind, Number, Buyer, Value, Date (YYYY-MM-DD), DueDate. Anything already tagged is skipped."
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p" disabled={!text.trim()} onClick={() => onSave(text)}>Import</button>
      </>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-xs" onClick={() => setText(TEMPLATE)}>Paste the template</button>
          <label className="btn btn-xs cursor-pointer">
            <UploadIcon size={12} /> Choose a CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => readFile(e.target.files[0])} />
          </label>
        </div>
        <Field label="Rows">
          <textarea className="inp min-h-40 font-mono text-[12px]" value={text} onChange={(e) => setText(e.target.value)} placeholder={TEMPLATE} />
        </Field>
      </div>
    </Modal>
  );
}

function DeviationModal({ controls, n, onClose, onSave }) {
  const [reason, setReason] = useState('');
  const [picked, setPicked] = useState([]);
  const [note, setNote] = useState('');
  const toggle = (c) => setPicked((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  const ready = reason.trim() && (picked.length || note.trim());
  return (
    <Modal title={'Raise deviation ' + n + ' of 2'} size="lg" onClose={onClose}
      subtitle="§9: at least one compensating control, approval one level above the §8 matrix, priced at +1% to +2%."
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p" disabled={!ready} onClick={() => onSave({ reason, controls: picked, note })}>
          Send to the Director
        </button>
      </>}>
      <div className="space-y-4">
        <Field label="Gate(s) being deviated and why">
          <textarea className="inp min-h-24" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div>
          <span className="lbl">Compensating controls</span>
          <div className="space-y-1">
            {(controls || []).map((c) => (
              <label key={c} className="flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-sm text-slate-300 hover:bg-white/[.04]">
                <input type="checkbox" className="mt-1" checked={picked.includes(c)} onChange={() => toggle(c)} />
                {c}
              </label>
            ))}
          </div>
        </div>
        <Field label="Further detail">
          <textarea className="inp min-h-20" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. personal guarantee of both promoters plus post-dated cheques for the full tenor" />
        </Field>
      </div>
    </Modal>
  );
}

function DecideDeviationModal({ deviation, approve, onClose, onSave }) {
  const [comment, setComment] = useState('');
  const [bump, setBump] = useState('1');
  return (
    <Modal title={(approve ? 'Approve' : 'Reject') + ' the deviation'} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className={approve ? 'btn btn-p' : 'btn btn-d'} disabled={!approve && !comment.trim()}
          onClick={() => onSave({ approve, comment, pricingBump: +bump })}>Confirm</button>
      </>}>
      <KV k="Reason" v={deviation.reason} />
      <KV k="Compensating controls" v={deviation.compensating} />
      <div className="mt-4 space-y-4">
        {approve && (
          <Field label="§9 pricing bump on the sanction rate">
            <select className="inp" value={bump} onChange={(e) => setBump(e.target.value)}>
              <option value="1">+1%</option><option value="2">+2%</option>
              <option value="0">No bump — record why in the comment</option>
            </select>
          </Field>
        )}
        <Field label={approve ? 'Director comment' : 'Reason for rejection'}>
          <textarea className="inp min-h-24" autoFocus value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function DecideCamModal({ approve, app, onClose, onSave }) {
  const [note, setNote] = useState('');
  return (
    <Modal title={approve ? 'Approve the CAM' : 'Decline the application'} subtitle={app.appCode + ' · ' + app.legalName}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className={approve ? 'btn btn-p' : 'btn btn-d'} disabled={!approve && !note.trim()}
          onClick={() => onSave(approve, note)}>{approve ? 'Approve' : 'Decline'}</button>
      </>}>
      <Field label={approve ? 'Decision note (optional)' : 'Reason for declining'}>
        <textarea className="inp min-h-24" autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}

function DeclineModal({ onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Decline this application" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-d" disabled={!reason.trim()} onClick={() => onConfirm(reason)}>Decline</button>
      </>}>
      <Field label="Reason (recorded on the file and the audit trail)">
        <textarea className="inp min-h-24" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}

export default ApplicationDetail;
