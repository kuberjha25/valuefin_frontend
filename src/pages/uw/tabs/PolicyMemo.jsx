import React, { useEffect, useState } from 'react';
import { ExternalLink, Save, TriangleAlert } from 'lucide-react';
import { uw, uwMemoUrl } from '../../../api.js';
import { Card, Chip, Field, Modal, Spinner, Table, Td } from '../../../ui.jsx';
import { useDebounced, useLoad } from '../../../hooks.js';
import { OUTCOME, RULE_CLASS, fmtMeasure, label, rupees } from '../../../uwFormat.js';
import { useAction } from './common.jsx';
import { factValue } from './Evidence.jsx';

export default function PolicyMemo({ id, c, meta, me, editable, refresh, tick }) {
  const { data: res, reload } = useLoad(() => uw.results(id), [id, tick]);
  const [disp, setDisp] = useState(null);
  const [busy, run] = useAction(() => { reload(); refresh(); });
  const has = (r, kind) => res && res.dispositions.find((d) => d.ruleCode === r.ruleCode && d.ruleVersion === r.ruleVersion && d.kind === kind);
  const ruleDef = (r) => (res && res.ruleDefs.find((x) => x.id === r.ruleId)) || {};

  return (
    <div className="space-y-5">
      <Card title="Policy rules" subtitle="Approved, effective-dated rules with credit-owner thresholds. Hard stops block submission unless the approved policy allows an override; committee exceptions need an assigned reviewer and rationale; warnings stay visible in the memo.">
        <Table rows={(res && res.rules) || []} loading={!res} cols={['Class', 'Rule', 'Outcome', 'Detail', 'Disposition', '']}
          empty="No approved rules in force. Rules are configured in the Credit Logic Book."
          render={(r) => {
            const cls = RULE_CLASS[r.ruleClass] || {};
            const ov = has(r, 'override'), er = has(r, 'exception_review');
            const d = ov || er;
            return (<>
              <Td><Chip cls={cls.cls}>{cls.label}</Chip></Td>
              <Td className="text-slate-200">{ruleDef(r).label || r.ruleCode}<span className="block font-mono text-[10px] text-slate-600">{r.ruleCode} v{r.ruleVersion}</span></Td>
              <Td><Chip cls={OUTCOME[r.outcome]}>{label(r.outcome)}</Chip></Td>
              <Td className="max-w-sm text-[12px] text-slate-400">{r.detail}</Td>
              <Td className="max-w-xs text-[12px]">{d ? <><Chip cls="chip-violet">{label(d.kind)}</Chip><span className="block text-slate-300">{d.reviewerName}: {d.rationale}</span></> : <span className="text-slate-600">—</span>}</Td>
              <Td><span className="flex justify-end gap-1">
                {editable && r.outcome !== 'not_triggered' && r.ruleClass === 'committee_exception' && !er && <button className="btn btn-xs" onClick={() => setDisp({ r, kind: 'exception_review' })}>Assign reviewer</button>}
                {editable && r.outcome !== 'not_triggered' && r.ruleClass === 'hard_stop' && !ov && ruleDef(r).overridable && me.role === 'director' && <button className="btn btn-xs btn-d" onClick={() => setDisp({ r, kind: 'override' })}>Override</button>}
                {editable && d && <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => run(() => uw.withdrawDisposition(id, r.ruleCode, d.kind), 'Withdrawn.')}>Withdraw</button>}
              </span></Td>
            </>);
          }} />
      </Card>

      <Terms id={id} c={c} editable={editable} onSaved={refresh} />
      <MemoEditor id={id} meta={meta} editable={editable} res={res} tick={tick} onSaved={refresh} />

      {disp && <DispositionModal id={id} meta={meta} d={disp} onClose={() => setDisp(null)} onSaved={() => { setDisp(null); reload(); refresh(); }} />}
    </div>
  );
}

function Terms({ id, c, editable, onSaved }) {
  const t = c.terms || {};
  const [busy, run] = useAction(onSaved);
  const [f, setF] = useState({
    amount: t.amountPaise != null ? (t.amountPaise / 100).toFixed(2) : '', tenorDays: t.tenorDays ? String(t.tenorDays) : String(c.tenorDays),
    ratePct: t.ratePct || '', fees: t.fees || '', security: t.security || '', repayment: t.repayment || '', conditions: t.conditions || ''
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Card title="Proposed terms" subtitle={t.amountPaise != null ? 'Recorded: ' + rupees(t.amountPaise) + ' for ' + t.tenorDays + ' days' + (t.ratePct ? ' at ' + t.ratePct + '%' : '') : 'Not recorded yet — required before submission.'}
      right={editable && <button className="btn btn-p btn-xs" disabled={busy || !f.amount.trim()} onClick={() => run(() => uw.setTerms(id, { ...f, tenorDays: Number(f.tenorDays) }), 'Terms saved.')}><Save size={12} /> Save terms</button>}>
      <fieldset disabled={!editable} className="grid gap-3 sm:grid-cols-3">
        <Field label="Amount (₹)"><input className="inp" value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Tenor (days)"><input className="inp" type="number" value={f.tenorDays} onChange={set('tenorDays')} /></Field>
        <Field label="Rate (% p.a.)"><input className="inp" value={f.ratePct} onChange={set('ratePct')} /></Field>
        <Field label="Fees"><input className="inp" value={f.fees} onChange={set('fees')} /></Field>
        <Field label="Security"><input className="inp" value={f.security} onChange={set('security')} /></Field>
        <Field label="Repayment / collections routing"><input className="inp" value={f.repayment} onChange={set('repayment')} /></Field>
        <Field label="Conditions" className="sm:col-span-3"><textarea className="inp min-h-16" value={f.conditions} onChange={set('conditions')} /></Field>
      </fieldset>
    </Card>
  );
}

function MemoEditor({ id, meta, editable, res, tick, onSaved }) {
  const { data, reload } = useLoad(() => uw.memo(id), [id, tick]);
  const { data: facts } = useLoad(() => uw.facts(id), [id, tick]);
  const [sections, setSections] = useState(null);
  const [active, setActive] = useState('summary');
  const [validation, setValidation] = useState(null);
  const [busy, run] = useAction(() => { reload(); onSaved(); });
  useEffect(() => { if (data && !sections) { setSections(data.sections || {}); setValidation(data.validation); } }, [data, sections]);
  const debounced = useDebounced(sections, 700);
  useEffect(() => {
    if (!debounced) return;
    let live = true;
    uw.validateMemo(id, debounced).then((v) => { if (live) setValidation(v); }).catch(() => {});
    return () => { live = false; };
  }, [debounced, id]);

  if (!sections) return <Card><Spinner /></Card>;
  const dirty = (k) => (sections[k] || '') !== ((data.sections || {})[k] || '');
  const insert = (tok) => setSections((s) => ({ ...s, [active]: (s[active] || '') + (s[active] && !/\s$/.test(s[active]) ? ' ' : '') + tok }));
  const errs = (validation && validation.errors) || [];
  const warns = (validation && validation.warnings) || [];
  const fmtOf = new Map(((res && res.formulaDefs) || []).map((f) => [f.id, (f.definition || {}).format]));

  return (
    <Card title="Credit memo" subtitle="Write the analysis; every ₹ amount, % and multiple must be followed by a citation, and must match the cited fact or calculation. Amounts that are not in the fact or calculation store are rejected."
      right={<a className="btn btn-xs" href={uwMemoUrl(id)} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Draft export</a>}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {meta.memoSections.map((s) => {
              const n = errs.filter((e) => e.section === s.key).length;
              return (
                <button key={s.key} className={'tab ' + (active === s.key ? 'tab-on' : '')} onClick={() => setActive(s.key)}>
                  {s.label}{dirty(s.key) ? ' •' : ''}{n ? <span className="ml-1 text-rose-300">({n})</span> : null}
                </button>
              );
            })}
          </div>
          <textarea className="inp min-h-[22rem] font-mono text-[13px]" value={sections[active] || ''} disabled={!editable}
            onChange={(e) => setSections((s) => ({ ...s, [active]: e.target.value }))}
            placeholder={'e.g. Revenue was ₹12.35 Cr [[fact:12]] with a gross margin of 32.40% [[calc:gross_margin:2025-03-31:audited]].'} />
          <div className="mt-2 flex items-center gap-2">
            {editable && <button className="btn btn-p" disabled={busy || !dirty(active)} onClick={() => run(() => uw.saveMemo(id, active, sections[active] || ''), 'Section saved.')}>{busy && <Spinner />}<Save size={14} /> Save section</button>}
            <span className="text-[12px] text-slate-500">{errs.length ? errs.length + ' problem(s)' : 'No citation problems'}{warns.length ? ' · ' + warns.length + ' warning(s)' : ''}</span>
          </div>
          {!!errs.length && <div className="mt-3 space-y-1">{errs.map((e, i) => <p key={i} className="flex gap-1.5 text-[12px] text-rose-200"><TriangleAlert size={13} className="mt-0.5 shrink-0" /> <b>{e.sectionLabel}:</b> {e.message}</p>)}</div>}
          {!!warns.length && <div className="mt-2 space-y-1">{warns.map((e, i) => <p key={i} className="text-[12px] text-amber-200">{e.sectionLabel}: {e.message}</p>)}</div>}
        </div>

        <div className="space-y-4">
          <div>
            <p className="lbl">Facts — click to cite</p>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10">
              {(facts || []).filter((f) => ['approved', 'provisional'].includes(f.reviewStatus)).map((f) => (
                <button key={f.id} disabled={!editable} onClick={() => insert(factValue(f) + ' [[fact:' + f.id + ']]')}
                  className="block w-full border-b border-white/[.05] px-3 py-1.5 text-left text-[12px] text-slate-300 hover:bg-white/[.05]">
                  <span className="text-slate-500">#{f.id}</span> {f.fieldLabel} · <b className="text-slate-100">{factValue(f)}</b> <span className="text-slate-500">{f.basis} {f.periodEnd}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="lbl">Calculations — click to cite</p>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10">
              {((res && res.calcs) || []).filter((r) => r.status === 'computed').map((r) => {
                const shown = fmtMeasure(r.value, fmtOf.get(r.formulaId));
                const tok = '[[calc:' + r.formulaCode + ':' + r.periodEnd + ':' + r.basis + ']]';
                return (
                  <button key={r.id} disabled={!editable} onClick={() => insert(shown + ' ' + tok)}
                    className="block w-full border-b border-white/[.05] px-3 py-1.5 text-left text-[12px] text-slate-300 hover:bg-white/[.05]">
                    {r.formulaCode} · <b className="text-slate-100">{shown}</b> <span className="text-slate-500">{r.basis} {r.periodEnd}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-slate-500">Other citations: [[doc:FILE-ID]] or [[doc:FILE-ID:p3]], [[txn:ID]], [[check:ID]], [[recon:CODE:DATE]].</p>
        </div>
      </div>
    </Card>
  );
}

function DispositionModal({ id, meta, d, onClose, onSaved }) {
  const [busy, run] = useAction();
  const [rationale, setRationale] = useState('');
  const reviewers = meta.users.filter((u) => u.role === 'director' || u.role === 'manager');
  const [reviewerId, setReviewerId] = useState(reviewers[0] ? reviewers[0].id : '');
  const isOverride = d.kind === 'override';
  return (
    <Modal title={(isOverride ? 'Override hard stop ' : 'Committee exception ') + d.r.ruleCode} subtitle={d.r.detail} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className={'btn ' + (isOverride ? 'btn-d' : 'btn-p')} disabled={busy || !rationale.trim()}
        onClick={async () => { if (await run(() => uw.disposition(id, d.r.ruleCode, { kind: d.kind, rationale, reviewerId: isOverride ? undefined : Number(reviewerId) }), 'Recorded.')) onSaved(); }}>Record</button></>}>
      <div className="space-y-3">
        {!isOverride && <Field label="Assigned reviewer"><select className="inp" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>{reviewers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}</select></Field>}
        <Field label="Rationale" hint={isOverride ? 'The approved policy allows this hard stop to be overridden by a Director. The reason goes into the memo and the decision snapshot.' : 'Why the exception is acceptable and what mitigates it.'}>
          <textarea className="inp min-h-24" value={rationale} onChange={(e) => setRationale(e.target.value)} autoFocus />
        </Field>
      </div>
    </Modal>
  );
}
