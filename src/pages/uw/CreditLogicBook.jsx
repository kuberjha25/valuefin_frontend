import React, { useState } from 'react';
import { BookCheck, Plus, X } from 'lucide-react';
import { uw } from '../../api.js';
import { useAuth } from '../../App.jsx';
import { Card, Chip, ErrorNote, Field, Modal, PageHead, Spinner, Table, Tabs, Td } from '../../ui.jsx';
import { useLoad, useLocal } from '../../hooks.js';
import { fmtDate } from '../../format.js';
import { BOOK_STATUS, RULE_CLASS, label, rupees } from '../../uwFormat.js';
import { useAction } from './tabs/common.jsx';

const SECTIONS = [['formulas', 'Formulas'], ['reconciliations', 'Reconciliations'], ['rules', 'Policy rules'], ['checklist', 'Checklist'],
  ['sources', 'Public sources'], ['bank', 'Bank rules'], ['fields', 'Field codes & products'], ['settings', 'Settings']];

export default function CreditLogicBook() {
  const me = useAuth();
  const [tab, setTab] = useLocal('uw.book.tab', 'formulas');
  const { data: cfg, error, reload } = useLoad(() => uw.config(), []);
  const { data: meta } = useLoad(() => uw.meta(), []);
  const canEdit = ['manager', 'director'].includes(me.role);
  if (error) return <Card><ErrorNote onRetry={reload}>{error}</ErrorNote></Card>;
  if (!cfg || !meta) return <Card><Spinner /></Card>;
  const shared = { cfg, meta, me, canEdit, reload };
  return (
    <div className="space-y-5">
      <PageHead icon={BookCheck} title="Credit Logic Book"
        subtitle="Every measure, reconciliation and policy rule the engine runs. Versioned and effective-dated; a change only takes effect after two different Managers/Directors sign it. Thresholds are supplied by the credit owner — nothing is pre-filled." />
      <Tabs tabs={SECTIONS} value={tab} onChange={setTab} />
      {['formulas', 'reconciliations', 'rules'].includes(tab) && <BookSection kind={tab} {...shared} />}
      {tab === 'checklist' && <Checklist {...shared} />}
      {tab === 'sources' && <Sources {...shared} />}
      {tab === 'bank' && <BankRules {...shared} />}
      {tab === 'fields' && <Fields {...shared} />}
      {tab === 'settings' && <Settings {...shared} />}
    </div>
  );
}

/* ---------------- versioned items with dual approval ---------------- */
function BookSection({ kind, cfg, meta, me, canEdit, reload }) {
  const items = cfg[kind];
  const [editing, setEditing] = useState(null);
  const [busy, run] = useAction(reload);
  const noun = { formulas: 'formula', reconciliations: 'reconciliation', rules: 'rule' }[kind];
  const describe = (it) => {
    if (kind === 'formulas') {
      const d = it.definition || {};
      const side = (ts) => (ts || []).map((t, i) => (i || t.sign < 0 ? (t.sign < 0 ? ' − ' : ' + ') : '') + t.field + (t.offset ? '[prior]' : '')).join('');
      return '(' + side(d.numerator) + ')' + (d.denominator && d.denominator.length ? ' ÷ (' + side(d.denominator) + ')' : '') + (d.multiplier !== '1' ? ' × ' + d.multiplier : '') + ' · ' + d.format + ' · basis ' + d.basis + (d.periodMonths ? ' · ' + d.periodMonths + '-month periods' : '') + (d.denominatorMustBePositive ? ' · denominator > 0' : '');
    }
    if (kind === 'reconciliations') {
      const d = it.definition || {};
      const side = (s) => s.terms.map((t, i) => (i ? (t.sign < 0 ? ' − ' : ' + ') : '') + t.field).join('') + (s.basis ? ' [' + s.basis + ']' : '');
      return side(d.left) + '  vs  ' + side(d.right) + ' · tolerance ' + ([it.tolerancePct != null ? '±' + it.tolerancePct + '%' : null, it.toleranceAbsPaise != null ? '±' + rupees(it.toleranceAbsPaise) : null].filter(Boolean).join(d.toleranceMode === 'either' ? ' or ' : ' and ') || 'NOT SET');
    }
    return it.metric + ' ' + it.operator + ' ' + (it.threshold == null ? 'THRESHOLD NOT SET' : Array.isArray(it.threshold) ? '[' + it.threshold.join(', ') + ']' : it.threshold) + (it.overridable ? ' · overridable' : '') + (it.products ? ' · products ' + it.products.join(', ') : '');
  };
  const hasOpen = (code) => items.some((x) => x.code === code && ['draft', 'pending_approval'].includes(x.status));

  return (
    <Card title={label(kind)} subtitle={'Approval = two distinct signatures; the author\'s submission counts as the first. Approving re-runs every case still with an analyst.'}
      right={canEdit && <button className="btn btn-p btn-xs" onClick={() => setEditing({ isNew: true })}><Plus size={12} /> New {noun}</button>}>
      <Table rows={items} cols={['Code', 'Definition', 'Status', 'Approvals', '']}
        render={(it) => (<>
          <Td className="text-slate-200">{it.label}<span className="block font-mono text-[10px] text-slate-500">{it.code} v{it.version}{kind === 'rules' ? ' · ' + (RULE_CLASS[it.ruleClass] || {}).label : ''}{kind === 'reconciliations' ? ' · ' + label(it.controlArea) : ''}</span></Td>
          <Td className="max-w-xl font-mono text-[11px] text-slate-400">{describe(it)}{it.notes && <span className="mt-1 block font-sans text-slate-500">{it.notes}</span>}
            {it.tests && <span className="mt-1 block font-sans">{it.tests.map((t, i) => <Chip key={i} cls={t.pass ? 'chip-good' : 'chip-bad'} className="mr-1">{(t.label || t.value) + ' → ' + t.actual}</Chip>)}</span>}</Td>
          <Td><Chip cls={BOOK_STATUS[it.status]}>{label(it.status)}</Chip>{it.effectiveNow && <span className="block text-[10px] text-emerald-300">in force</span>}{it.effectiveFrom && <span className="block text-[10px] text-slate-500">from {fmtDate(it.effectiveFrom)}{it.effectiveTo ? ' to ' + fmtDate(it.effectiveTo) : ''}</span>}</Td>
          <Td className="text-[11px] text-slate-400">{it.approvals.map((a) => a.approverName).join(', ') || '—'}<span className="block text-slate-600">by {it.createdBy}</span></Td>
          <Td>{canEdit && <span className="flex flex-wrap justify-end gap-1">
            {it.status === 'draft' && <button className="btn btn-xs" onClick={() => setEditing(it)}>Edit</button>}
            {it.status === 'draft' && <button className="btn btn-xs btn-p" disabled={busy} onClick={() => run(() => uw.bookSubmit(kind, it.id), 'Submitted for approval.')}>Submit</button>}
            {it.status === 'draft' && <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => window.confirm('Delete this draft?') && run(() => uw.bookDelete(kind, it.id), 'Draft deleted.')}><X size={12} /></button>}
            {it.status === 'pending_approval' && !it.approvals.some((a) => a.approverId === me.id) && <button className="btn btn-xs btn-p" disabled={busy} onClick={() => run(() => uw.bookApprove(kind, it.id, ''), 'Approved.')}>Approve</button>}
            {it.status === 'pending_approval' && <button className="btn btn-xs" disabled={busy} onClick={() => { const n = window.prompt('Reason for sending back to draft:'); if (n) run(() => uw.bookReject(kind, it.id, n), 'Sent back to draft.'); }}>Send back</button>}
            {it.status === 'approved' && !hasOpen(it.code) && <button className="btn btn-xs" onClick={() => setEditing({ ...it, isNew: true, newVersionOf: it.code })}>New version</button>}
            {it.status === 'approved' && me.role === 'director' && <button className="btn btn-xs" disabled={busy} onClick={() => { const n = window.prompt('Reason for retiring:'); if (n) run(() => uw.bookRetire(kind, it.id, n), 'Retired.'); }}>Retire</button>}
          </span>}</Td>
        </>)} />
      {editing && <ItemEditor kind={kind} item={editing} cfg={cfg} meta={meta} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </Card>
  );
}

function TermsEditor({ terms, onChange, fields, allowOffset }) {
  const numeric = fields.filter((f) => f.active && ['money', 'number', 'percent'].includes(f.valueType) && f.periodKind !== 'none');
  return (
    <div className="space-y-2">
      {terms.map((t, i) => (
        <div key={i} className="flex gap-2">
          <select className="inp w-20" value={t.sign} onChange={(e) => onChange(terms.map((x, j) => (j === i ? { ...x, sign: Number(e.target.value) } : x)))}><option value={1}>+</option><option value={-1}>−</option></select>
          <select className="inp" value={t.field} onChange={(e) => onChange(terms.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))}>
            <option value="">— field —</option>{numeric.map((f) => <option key={f.code} value={f.code}>{f.label} ({f.periodKind})</option>)}
          </select>
          {allowOffset && <select className="inp w-36" value={t.offset || 0} onChange={(e) => onChange(terms.map((x, j) => (j === i ? { ...x, offset: Number(e.target.value) } : x)))}><option value={0}>this period</option><option value={-1}>prior period</option></select>}
          <button className="btn btn-ghost btn-icon" onClick={() => onChange(terms.filter((_, j) => j !== i))}><X size={14} /></button>
        </div>
      ))}
      <button className="btn btn-xs" onClick={() => onChange([...terms, { field: '', sign: 1, offset: 0 }])}><Plus size={12} /> Term</button>
    </div>
  );
}

function ItemEditor({ kind, item, cfg, meta, onClose, onSaved }) {
  const [busy, run] = useAction();
  const d = item.definition || {};
  const [f, setF] = useState({
    code: item.code || '', label: item.label || '', notes: item.notes || '', effectiveFrom: item.isNew ? '' : (item.effectiveFrom || ''),
    // formulas
    numerator: d.numerator || [{ field: '', sign: 1, offset: 0 }], denominator: d.denominator || [], multiplier: d.multiplier || '1', format: d.format || 'ratio',
    basis: d.basis || 'same', periodMonths: d.periodMonths || '', denominatorMustBePositive: d.denominatorMustBePositive !== false,
    // reconciliations
    controlArea: item.controlArea || 'revenue', left: d.left || { terms: [{ field: '', sign: 1 }], basis: null }, right: d.right || { terms: [{ field: '', sign: 1 }], basis: null },
    toleranceMode: d.toleranceMode || 'both', tolerancePct: item.tolerancePct || '', toleranceAbs: item.toleranceAbsPaise != null ? (item.toleranceAbsPaise / 100).toFixed(2) : '',
    // rules
    ruleClass: item.ruleClass || 'warning', metric: item.metric || '', operator: item.operator || 'gt',
    threshold: Array.isArray(item.threshold) ? item.threshold.join(', ') : (item.threshold == null ? '' : String(item.threshold)),
    products: item.products || [], overridable: !!item.overridable, testCases: item.testCases || [], effectiveTo: item.isNew ? '' : (item.effectiveTo || '')
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const listOp = ['in', 'not_in'].includes(f.operator);

  const body = () => {
    const b = { code: f.code, label: f.label, notes: f.notes, effectiveFrom: f.effectiveFrom || null };
    if (kind === 'formulas') b.definition = { numerator: f.numerator, denominator: f.denominator, multiplier: f.multiplier, format: f.format, basis: f.basis, periodMonths: f.periodMonths || null, denominatorMustBePositive: f.denominatorMustBePositive };
    if (kind === 'reconciliations') Object.assign(b, { controlArea: f.controlArea, tolerancePct: f.tolerancePct, toleranceAbs: f.toleranceAbs, definition: { left: f.left, right: f.right, toleranceMode: f.toleranceMode } });
    if (kind === 'rules') {
      const thr = f.threshold.trim() === '' ? null : listOp ? f.threshold.split(',').map((x) => x.trim()).filter(Boolean) : f.threshold.trim();
      Object.assign(b, { ruleClass: f.ruleClass, metric: f.metric, operator: f.operator, threshold: thr, products: f.products, overridable: f.overridable, testCases: f.testCases, effectiveTo: f.effectiveTo || null });
    }
    return b;
  };
  const save = async () => {
    const r = await run(() => (item.isNew ? uw.bookCreate(kind, body()) : uw.bookUpdate(kind, item.id, body())), 'Draft saved.');
    if (r) onSaved();
  };
  const side = (k) => (
    <div className="rounded-2xl border border-white/10 p-3">
      <p className="lbl">{k === 'left' ? 'Left side' : 'Right side'}</p>
      <TermsEditor terms={f[k].terms} fields={cfg.fieldCodes.filter((x) => x.valueType === 'money')} onChange={(terms) => setF((s) => ({ ...s, [k]: { ...s[k], terms } }))} />
      <Field label="Basis" className="mt-2"><select className="inp" value={f[k].basis || ''} onChange={(e) => setF((s) => ({ ...s, [k]: { ...s[k], basis: e.target.value || null } }))}>
        <option value="">Same basis on both sides (when neither names one)</option>{meta.bases.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select></Field>
    </div>
  );

  return (
    <Modal title={item.isNew ? (item.newVersionOf ? 'New version of ' + item.code : 'New draft') : 'Edit draft ' + item.code + ' v' + item.version} size="xl" onClose={onClose}
      subtitle="Saved as a draft. It runs only after it is submitted and approved by a second person."
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy} onClick={save}>{busy && <Spinner />}Save draft</button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Code"><input className="inp font-mono" value={f.code} onChange={set('code')} disabled={!item.isNew || !!item.newVersionOf} /></Field>
        <Field label="Label" className="sm:col-span-2"><input className="inp" value={f.label} onChange={set('label')} /></Field>
        <Field label="Effective from (blank = on approval)"><input className="inp" type="date" value={f.effectiveFrom} onChange={set('effectiveFrom')} /></Field>
        {kind === 'rules' && <Field label="Effective to"><input className="inp" type="date" value={f.effectiveTo} onChange={set('effectiveTo')} /></Field>}
      </div>

      {kind === 'formulas' && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div><p className="lbl">Numerator</p><TermsEditor terms={f.numerator} fields={cfg.fieldCodes} allowOffset onChange={(v) => setF((s) => ({ ...s, numerator: v }))} /></div>
          <div><p className="lbl">Denominator (leave empty for an amount)</p><TermsEditor terms={f.denominator} fields={cfg.fieldCodes} allowOffset onChange={(v) => setF((s) => ({ ...s, denominator: v }))} /></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-5">
            <Field label="Multiplier"><input className="inp" value={f.multiplier} onChange={set('multiplier')} /></Field>
            <Field label="Format"><select className="inp" value={f.format} onChange={set('format')}>{cfg.formats.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Basis"><select className="inp" value={f.basis} onChange={set('basis')}><option value="same">Same basis for all inputs</option>{meta.bases.map((x) => <option key={x} value={x}>{label(x)} only</option>)}</select></Field>
            <Field label="Period length (months)"><input className="inp" type="number" min="1" max="12" value={f.periodMonths} onChange={set('periodMonths')} placeholder="any" /></Field>
            <label className="flex items-center gap-2 pt-6 text-sm text-slate-300"><input type="checkbox" checked={f.denominatorMustBePositive} onChange={set('denominatorMustBePositive')} /> Denominator must be &gt; 0</label>
          </div>
          <p className="text-[11px] text-slate-500 lg:col-span-2">Missing values: any missing, conflicting or zero-denominator input makes the measure "not computable" for that period.</p>
        </div>
      )}

      {kind === 'reconciliations' && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">{side('left')}{side('right')}</div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Control area"><select className="inp" value={f.controlArea} onChange={set('controlArea')}>{meta.controlAreas.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select></Field>
            <Field label="Tolerance ± %"><input className="inp" value={f.tolerancePct} onChange={set('tolerancePct')} placeholder="credit owner" /></Field>
            <Field label="Tolerance ± ₹"><input className="inp" value={f.toleranceAbs} onChange={set('toleranceAbs')} placeholder="credit owner" /></Field>
            <Field label="When both are set"><select className="inp" value={f.toleranceMode} onChange={set('toleranceMode')}><option value="both">Within both</option><option value="either">Within either</option></select></Field>
          </div>
        </div>
      )}

      {kind === 'rules' && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Class"><select className="inp" value={f.ruleClass} onChange={set('ruleClass')}>{meta.ruleClasses.map((x) => <option key={x} value={x}>{RULE_CLASS[x].label}</option>)}</select></Field>
            <Field label="Metric" className="sm:col-span-2" hint="A case metric, or formula:CODE@basis / fact:FIELD@basis (basis = a named basis or 'latest').">
              <input className="inp font-mono" list="uw-metrics" value={f.metric} onChange={set('metric')} />
              <datalist id="uw-metrics">
                {meta.caseMetrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                {cfg.formulas.filter((x) => x.status === 'approved').map((x) => <option key={x.code} value={'formula:' + x.code + '@audited'} />)}
              </datalist>
            </Field>
            <Field label="Operator"><select className="inp" value={f.operator} onChange={set('operator')}>{meta.operators.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select></Field>
            <Field label={listOp ? 'Threshold list (comma-separated)' : 'Threshold'} hint="Supplied by the credit owner." className="sm:col-span-2"><input className="inp" value={f.threshold} onChange={set('threshold')} /></Field>
            <Field label="Applies to products" hint="None selected = all products.">
              <div className="flex flex-wrap gap-2 pt-1">{meta.products.map((p) => (
                <label key={p.key} className="flex items-center gap-1 text-sm text-slate-300"><input type="checkbox" checked={f.products.includes(p.key)}
                  onChange={(e) => setF((s) => ({ ...s, products: e.target.checked ? [...s.products, p.key] : s.products.filter((x) => x !== p.key) }))} /> {p.label}</label>
              ))}</div>
            </Field>
            {f.ruleClass === 'hard_stop' && <label className="flex items-center gap-2 pt-6 text-sm text-slate-300"><input type="checkbox" checked={f.overridable} onChange={set('overridable')} /> A Director may override (authorised mechanism)</label>}
          </div>
          <div>
            <p className="lbl">Test cases (all must pass before approval)</p>
            {f.testCases.map((t, i) => (
              <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_12rem_auto] gap-2">
                <input className="inp" placeholder="Label" value={t.label || ''} onChange={(e) => setF((s) => ({ ...s, testCases: s.testCases.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))} />
                <input className="inp" placeholder="Metric value" value={t.value} onChange={(e) => setF((s) => ({ ...s, testCases: s.testCases.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) }))} />
                <select className="inp" value={t.expected} onChange={(e) => setF((s) => ({ ...s, testCases: s.testCases.map((x, j) => (j === i ? { ...x, expected: e.target.value } : x)) }))}><option value="triggered">expect triggered</option><option value="not_triggered">expect not triggered</option></select>
                <button className="btn btn-ghost btn-icon" onClick={() => setF((s) => ({ ...s, testCases: s.testCases.filter((_, j) => j !== i) }))}><X size={14} /></button>
              </div>
            ))}
            <button className="btn btn-xs" onClick={() => setF((s) => ({ ...s, testCases: [...s.testCases, { label: '', value: '', expected: 'triggered' }] }))}><Plus size={12} /> Test case</button>
          </div>
        </div>
      )}
      <Field label="Notes" className="mt-4"><textarea className="inp min-h-16" value={f.notes} onChange={set('notes')} /></Field>
    </Modal>
  );
}

/* ---------------- checklist ---------------- */
function Checklist({ cfg, meta, canEdit, reload }) {
  const [editing, setEditing] = useState(null);
  const docLabel = (k) => (meta.docTypes.find((d) => d.key === k) || {}).label || k;
  return (
    <Card title="Document checklist" subtitle="By product (blank = every product), borrower vintage and required periods. Annual requirements are capped at the borrower's vintage."
      right={canEdit && <button className="btn btn-p btn-xs" onClick={() => setEditing({})}><Plus size={12} /> Item</button>}>
      <Table rows={cfg.checklist} cols={['Item', 'Product', 'Satisfied by', 'Periods', 'Rules', '']}
        render={(it) => (<>
          <Td className={it.active ? 'text-slate-200' : 'text-slate-600 line-through'}>{it.label}<span className="block font-mono text-[10px] text-slate-600">{it.key}</span></Td>
          <Td>{it.product || 'all'}</Td><Td>{docLabel(it.docType)}{it.auditedOnly ? ' (audited)' : ''}</Td>
          <Td>{it.periodRule === 'none' ? '—' : it.periodsRequired + ' ' + (it.periodRule === 'annual' ? 'year(s)' : 'month(s)')}</Td>
          <Td className="text-[12px] text-slate-400">{it.mandatory ? 'mandatory' : 'optional'}{it.minVintageYears != null ? ' · from ' + it.minVintageYears + ' yrs vintage' : ''}</Td>
          <Td>{canEdit && <button className="btn btn-xs" onClick={() => setEditing(it)}>Edit</button>}</Td>
        </>)} />
      {editing && <ChecklistModal it={editing} meta={meta} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </Card>
  );
}

function ChecklistModal({ it, meta, onClose, onSaved }) {
  const [busy, run] = useAction();
  const [f, setF] = useState({ product: it.product || '', key: it.key || '', label: it.label || '', docType: it.docType || 'other', mandatory: it.mandatory !== false,
    minVintageYears: it.minVintageYears ?? '', periodRule: it.periodRule || 'none', periodsRequired: it.periodsRequired || '', auditedOnly: !!it.auditedOnly, sortOrder: it.sortOrder || 0, active: it.active !== false });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const save = async () => { if (await run(() => (it.id ? uw.updateChecklistItem(it.id, f) : uw.addChecklistItem({ ...f, product: f.product || null })), 'Saved.')) onSaved(); };
  return (
    <Modal title={it.id ? 'Edit checklist item' : 'New checklist item'} onClose={onClose} size="lg"
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy} onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Key"><input className="inp font-mono" value={f.key} onChange={set('key')} disabled={!!it.id} /></Field>
        <Field label="Label" className="sm:col-span-2"><input className="inp" value={f.label} onChange={set('label')} /></Field>
        <Field label="Product"><select className="inp" value={f.product} onChange={set('product')} disabled={!!it.id}><option value="">All products</option>{meta.products.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></Field>
        <Field label="Satisfied by document type"><select className="inp" value={f.docType} onChange={set('docType')}>{meta.docTypes.filter((d) => d.key !== 'unclassified').map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select></Field>
        <Field label="Minimum vintage (years)"><input className="inp" type="number" value={f.minVintageYears} onChange={set('minVintageYears')} /></Field>
        <Field label="Period rule"><select className="inp" value={f.periodRule} onChange={set('periodRule')}><option value="none">None</option><option value="annual">Annual periods</option><option value="monthly">Continuous months</option></select></Field>
        {f.periodRule !== 'none' && <Field label={f.periodRule === 'annual' ? 'Years required' : 'Months required'}><input className="inp" type="number" value={f.periodsRequired} onChange={set('periodsRequired')} /></Field>}
        <Field label="Sort order"><input className="inp" type="number" value={f.sortOrder} onChange={set('sortOrder')} /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={f.mandatory} onChange={set('mandatory')} /> Mandatory</label>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={f.auditedOnly} onChange={set('auditedOnly')} /> Audited copies only</label>
        {it.id && <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={f.active} onChange={set('active')} /> Active</label>}
      </div>
    </Modal>
  );
}

/* ---------------- public sources ---------------- */
function Sources({ cfg, canEdit, reload }) {
  const [editing, setEditing] = useState(null);
  return (
    <Card title="Public source registry" subtitle="Each portal's access method and whether automated use is permitted. Phase 1 uses manual analyst searches only; no CAPTCHA bypass or private logins."
      right={canEdit && <button className="btn btn-p btn-xs" onClick={() => setEditing({})}><Plus size={12} /> Source</button>}>
      <Table rows={cfg.sources} cols={['Source', 'Searched by', 'Access', 'Owner / refresh', 'Fallback', '']}
        render={(s) => (<>
          <Td className={s.active ? 'text-slate-200' : 'text-slate-600'}>{s.name}<span className="block text-[11px] text-slate-500">{s.jurisdiction}{s.url ? ' · ' + s.url : ' · URL to be confirmed'}</span>{s.notes && <span className="block text-[11px] text-slate-500">{s.notes}</span>}</Td>
          <Td className="text-[12px]">{s.searchIdentifiers}</Td>
          <Td><Chip cls={s.accessMethod === 'manual' ? 'chip-slate' : 'chip-cyan'}>{s.accessMethod}</Chip><span className="block text-[11px] text-slate-500">automated use {s.automatedUsePermitted ? 'permitted' : 'not permitted'}</span></Td>
          <Td className="text-[12px] text-slate-400">{s.owner || '—'}{s.refreshDate ? ' · ' + fmtDate(s.refreshDate) : ''}</Td>
          <Td className="max-w-xs text-[11px] text-slate-500">{s.fallback}</Td>
          <Td>{canEdit && <button className="btn btn-xs" onClick={() => setEditing(s)}>Edit</button>}</Td>
        </>)} />
      {editing && <SourceModal s={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </Card>
  );
}

function SourceModal({ s, onClose, onSaved }) {
  const [busy, run] = useAction();
  const [f, setF] = useState({ name: s.name || '', jurisdiction: s.jurisdiction || 'India', url: s.url || '', searchIdentifiers: s.searchIdentifiers || '', accessMethod: s.accessMethod || 'manual',
    automatedUsePermitted: !!s.automatedUsePermitted, owner: s.owner || '', refreshDate: s.refreshDate || '', fallback: s.fallback || '', notes: s.notes || '', active: s.active !== false });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const save = async () => { if (await run(() => (s.id ? uw.updateSource(s.id, f) : uw.addSource(f)), 'Saved.')) onSaved(); };
  return (
    <Modal title={s.id ? 'Edit source' : 'New source'} size="lg" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy} onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className="inp" value={f.name} onChange={set('name')} /></Field>
        <Field label="Jurisdiction"><input className="inp" value={f.jurisdiction} onChange={set('jurisdiction')} /></Field>
        <Field label="URL" className="sm:col-span-2"><input className="inp" value={f.url} onChange={set('url')} /></Field>
        <Field label="Search identifiers"><input className="inp" value={f.searchIdentifiers} onChange={set('searchIdentifiers')} /></Field>
        <Field label="Access method"><select className="inp" value={f.accessMethod} onChange={set('accessMethod')}><option value="manual">Manual</option><option value="automated">Automated</option></select></Field>
        <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2"><input type="checkbox" checked={f.automatedUsePermitted} onChange={set('automatedUsePermitted')} /> Automated use permitted under the site's terms (checked and documented)</label>
        <Field label="Owner"><input className="inp" value={f.owner} onChange={set('owner')} /></Field>
        <Field label="Refresh date"><input className="inp" type="date" value={f.refreshDate} onChange={set('refreshDate')} /></Field>
        <Field label="Fallback" className="sm:col-span-2"><input className="inp" value={f.fallback} onChange={set('fallback')} /></Field>
        <Field label="Notes" className="sm:col-span-2"><textarea className="inp min-h-16" value={f.notes} onChange={set('notes')} /></Field>
        {s.id && <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={f.active} onChange={set('active')} /> Active</label>}
      </div>
    </Modal>
  );
}

/* ---------------- bank keyword rules ---------------- */
function BankRules({ cfg, meta, canEdit, reload }) {
  const [busy, run] = useAction(reload);
  const [f, setF] = useState({ pattern: '', direction: 'credit', category: 'operating', counterparty: '', setsReturn: false, priority: 100 });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const cats = f.direction === 'credit' ? meta.creditCategories : f.direction === 'debit' ? meta.debitCategories : meta.creditCategories.filter((c) => meta.debitCategories.includes(c));
  return (
    <Card title="Bank classification rules" subtitle="Narration-contains keyword rules that suggest a category. Analyst decisions always win; changing rules re-classifies every case still with an analyst.">
      {canEdit && (
        <div className="mb-4 grid gap-2 sm:grid-cols-7">
          <Field label="Narration contains" className="sm:col-span-2"><input className="inp" value={f.pattern} onChange={set('pattern')} /></Field>
          <Field label="Direction"><select className="inp" value={f.direction} onChange={(e) => setF((s) => ({ ...s, direction: e.target.value, category: 'unknown' }))}><option value="credit">Receipt</option><option value="debit">Payment</option><option value="any">Either</option></select></Field>
          <Field label="Category"><select className="inp" value={f.category} onChange={set('category')}>{cats.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></Field>
          <Field label="Counterparty"><input className="inp" value={f.counterparty} onChange={set('counterparty')} /></Field>
          <Field label="Priority"><input className="inp" type="number" value={f.priority} onChange={set('priority')} /></Field>
          <div className="flex items-end gap-2"><label className="flex items-center gap-1 pb-2 text-[12px] text-slate-300"><input type="checkbox" checked={f.setsReturn} onChange={set('setsReturn')} /> Return</label>
            <button className="btn btn-p mb-0.5" disabled={busy || f.pattern.trim().length < 3} onClick={() => run(() => uw.addBankRule(f), 'Rule added — open cases re-classified.')}>Add</button></div>
        </div>
      )}
      <Table rows={cfg.bankRules} cols={['Pattern', 'Direction', 'Category', 'Counterparty', 'Priority', '']} empty="No rules — every transaction starts as unknown."
        render={(r) => (<>
          <Td className={'font-mono ' + (r.active ? 'text-slate-200' : 'text-slate-600 line-through')}>{r.pattern}</Td><Td>{r.direction}</Td>
          <Td>{label(r.category)}{r.setsReturn && <Chip cls="chip-bad" className="ml-1">return</Chip>}</Td><Td>{r.counterparty || '—'}</Td><Td>{r.priority}</Td>
          <Td>{canEdit && <button className="btn btn-xs" disabled={busy} onClick={() => run(() => uw.updateBankRule(r.id, { active: !r.active }), r.active ? 'Rule disabled.' : 'Rule enabled.')}>{r.active ? 'Disable' : 'Enable'}</button>}</Td>
        </>)} />
    </Card>
  );
}

/* ---------------- field codes and products ---------------- */
function Fields({ cfg, meta, canEdit, reload }) {
  const [busy, run] = useAction(reload);
  const [f, setF] = useState({ code: '', label: '', valueType: 'money', periodKind: 'flow', category: 'other' });
  const [p, setP] = useState({ key: '', label: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <div className="space-y-5">
      <Card title="Products" subtitle="Products drive which checklist items apply.">
        <div className="mb-3 flex flex-wrap gap-2">{cfg.products.map((x) => <Chip key={x.key} cls={x.active ? 'chip-violet' : 'chip-slate'}>{x.label} ({x.key})</Chip>)}</div>
        {canEdit && <div className="flex flex-wrap items-end gap-2">
          <Field label="Key" className="w-40"><input className="inp font-mono" value={p.key} onChange={(e) => setP((s) => ({ ...s, key: e.target.value }))} /></Field>
          <Field label="Label" className="w-64"><input className="inp" value={p.label} onChange={(e) => setP((s) => ({ ...s, label: e.target.value }))} /></Field>
          <button className="btn btn-p mb-0.5" disabled={busy || !p.key || !p.label} onClick={async () => { if (await run(() => uw.saveProduct(p), 'Product saved.')) setP({ key: '', label: '' }); }}>Save product</button>
        </div>}
      </Card>
      <Card title="Field codes" subtitle="Typed facts recorded from evidence. Type and period kind are fixed once created (flow = a period figure, stock = an as-at balance).">
        {canEdit && <div className="mb-4 grid gap-2 sm:grid-cols-6">
          <Field label="Code"><input className="inp font-mono" value={f.code} onChange={set('code')} /></Field>
          <Field label="Label" className="sm:col-span-2"><input className="inp" value={f.label} onChange={set('label')} /></Field>
          <Field label="Type"><select className="inp" value={f.valueType} onChange={set('valueType')}>{['money', 'number', 'percent', 'text', 'date'].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Period kind"><select className="inp" value={f.periodKind} onChange={set('periodKind')}>{['flow', 'stock', 'none'].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <div className="flex items-end"><button className="btn btn-p mb-0.5" disabled={busy || !f.code || !f.label} onClick={async () => { if (await run(() => uw.addField(f), 'Field added.')) setF((s) => ({ ...s, code: '', label: '' })); }}>Add</button></div>
        </div>}
        <Table rows={cfg.fieldCodes} cols={['Code', 'Label', 'Type', 'Period', 'Category', '']}
          render={(x) => (<>
            <Td className="font-mono text-[12px]">{x.code}</Td><Td className={x.active ? '' : 'text-slate-600 line-through'}>{x.label}</Td><Td>{x.valueType}</Td><Td>{x.periodKind}</Td><Td>{label(x.category)}</Td>
            <Td>{canEdit && <button className="btn btn-xs" disabled={busy} onClick={() => run(() => uw.updateField(x.code, { active: !x.active }), 'Updated.')}>{x.active ? 'Deactivate' : 'Activate'}</button>}</Td>
          </>)} />
      </Card>
    </div>
  );
}

/* ---------------- settings ---------------- */
function Settings({ cfg, me, reload }) {
  const [busy, run] = useAction(reload);
  const s = cfg.settings || {};
  const [days, setDays] = useState(String(s.transfer_match_days ?? 0));
  const [thr, setThr] = useState(s.bank_review_threshold_paise == null ? '' : (s.bank_review_threshold_paise / 100).toFixed(2));
  const isDirector = me.role === 'director';
  return (
    <Card title="Underwriting settings" subtitle="Director only. Changes re-run every case still with an analyst.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Inter-account transfer window (days)" hint="A debit on one supplied account and a same-amount credit on another within this many days is paired as an internal transfer — only when the match is unique. 0 = same value date.">
          <input className="inp" type="number" min="0" max="10" value={days} onChange={(e) => setDays(e.target.value)} disabled={!isDirector} />
        </Field>
        <Field label="Bank verification threshold (₹)" hint="Financing, unknown and auto-matched receipts at or above this need analyst verification before submission. Blank = every such receipt (most conservative).">
          <input className="inp" value={thr} onChange={(e) => setThr(e.target.value)} disabled={!isDirector} placeholder="blank = all" />
        </Field>
      </div>
      {isDirector && <button className="btn btn-p mt-4" disabled={busy} onClick={() => run(() => uw.saveSettings({ transferMatchDays: Number(days), bankReviewThreshold: thr.trim() === '' ? null : thr }), 'Settings saved.')}>Save settings</button>}
    </Card>
  );
}
