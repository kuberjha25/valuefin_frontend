import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { uw } from '../../../api.js';
import { Card, Chip, Empty, Field, Modal, Spinner, Table, Tabs, Td } from '../../../ui.jsx';
import { useLoad } from '../../../hooks.js';
import { fmtDate } from '../../../format.js';
import { OUTCOME, dec, fmtMeasure, label, rupees } from '../../../uwFormat.js';
import { RefList, RefPicker, useAction } from './common.jsx';
import Bank from './Bank.jsx';

export default function Analysis(props) {
  const { id, editable, refresh, tick } = props;
  const [sub, setSub] = useState('financials');
  const { data: res, reload } = useLoad(() => uw.results(id), [id, tick]);
  const [busy, run] = useAction(() => { reload(); refresh(); });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={sub} onChange={setSub} tabs={[['financials', 'Financial measures'], ['recon', 'Reconciliations'], ['bank', 'Bank']]} />
        <span className="ml-auto text-[12px] text-slate-500">
          {res && res.run ? 'Run #' + res.run.id + ' · ' + fmtDate(res.run.createdAt, true) + ' · ' + res.run.reason : 'Not run yet'}
          {res && res.stale && <Chip cls="chip-warn" className="ml-2">out of date</Chip>}
        </span>
        {editable && <button className="btn btn-xs" disabled={busy} onClick={() => run(() => uw.run(id), 'Analysis re-run.')}>{busy ? <Spinner /> : <Play size={12} />} Re-run</button>}
      </div>
      {sub === 'financials' && <Financials res={res} />}
      {sub === 'recon' && <Recons id={id} res={res} editable={editable} onChange={() => { reload(); refresh(); }} />}
      {sub === 'bank' && <Bank {...props} />}
    </div>
  );
}

function Financials({ res }) {
  if (!res) return <Card><Spinner /></Card>;
  const fmt = new Map((res.formulaDefs || []).map((f) => [f.id, f]));
  const used = (res.run && res.run.versions && res.run.versions.formulas) || [];
  if (!used.length) {
    return <Card><Empty title="No approved formulas">Calculations run only on Credit Logic Book formulas approved by two people. <Link className="text-neon-violet" to="/uw/book">Open the Credit Logic Book</Link>.</Empty></Card>;
  }
  return (
    <Card title="Financial measures" subtitle={'Computed from reviewed (or explicitly provisional) facts with ' + used.length + ' approved formula version(s). "Not computable" is shown instead of a made-up zero.'}>
      <Table rows={res.calcs} cols={['Measure', 'Period', 'Basis', '#Value', 'Inputs', 'Note']}
        empty="No facts yet for the approved formulas."
        render={(r) => {
          const f = fmt.get(r.formulaId) || {};
          const d = f.definition || {};
          return (<>
            <Td className="text-slate-200">{f.label || r.formulaCode}<span className="block font-mono text-[10px] text-slate-600">{r.formulaCode} v{r.formulaVersion}</span></Td>
            <Td className="text-[12px] text-slate-400">{(r.periodStart ? r.periodStart + ' → ' : 'as at ') + r.periodEnd}</Td>
            <Td>{label(r.basis)}</Td>
            <Td r>{r.status === 'computed'
              ? <span className="font-semibold text-slate-100">{fmtMeasure(r.value, d.format)}{r.provisional && <Chip cls="chip-warn" className="ml-1">provisional</Chip>}</span>
              : <Chip cls={OUTCOME.not_computable}>not computable</Chip>}</Td>
            <Td className="text-[11px] text-slate-500">facts {r.inputFactIds.map((x) => '#' + x).join(', ') || '—'}{r.numerator != null && <span className="block">num {dec(r.numerator, 2)}{r.denominator != null ? ' / den ' + dec(r.denominator, 2) : ''}</span>}</Td>
            <Td className="max-w-xs text-[12px] text-amber-200">{r.rationale}</Td>
          </>);
        }} />
      <p className="mt-3 text-[11px] text-slate-500">Cite a value in the memo as [[calc:CODE:PERIOD-END:basis]], e.g. [[calc:{res.calcs[0] ? res.calcs[0].formulaCode + ':' + res.calcs[0].periodEnd + ':' + res.calcs[0].basis : 'gross_margin:2025-03-31:audited'}]].</p>
    </Card>
  );
}

function Recons({ id, res, editable, onChange }) {
  const [resolving, setResolving] = useState(null);
  if (!res) return <Card><Spinner /></Card>;
  const defs = new Map((res.reconDefs || []).map((d) => [d.id, d]));
  return (
    <Card title="Reconciliations" subtitle="Left vs right on comparable periods and bases, with absolute and percentage gaps against the configured tolerance. An explanation needs supporting evidence, otherwise the difference stays unresolved.">
      <Table rows={res.recons} cols={['Check', 'Comparable basis', '#Left', '#Right', '#Gap', 'Tolerance', 'Outcome', 'Resolution', '']}
        empty={<Empty title="No reconciliations">They run once a definition is approved and both sides have facts for the same period.</Empty>}
        render={(r) => {
          const d = defs.get(r.defId) || {};
          return (<>
            <Td className="text-slate-200">{d.label || r.defCode}<span className="block font-mono text-[10px] text-slate-600">{r.defCode} v{r.defVersion} · {label(d.controlArea)}</span></Td>
            <Td className="max-w-[12rem] text-[12px] text-slate-400">{r.comparableBasis}</Td>
            <Td r>{rupees(r.leftPaise)}<span className="block text-[10px] text-slate-500">{r.leftFactIds.map((x) => '#' + x).join(', ')}</span></Td>
            <Td r>{rupees(r.rightPaise)}<span className="block text-[10px] text-slate-500">{r.rightFactIds.map((x) => '#' + x).join(', ')}</span></Td>
            <Td r>{rupees(r.gapPaise)}{r.gapPct != null && <span className="block text-[10px] text-slate-500">{dec(r.gapPct, 2)}%</span>}</Td>
            <Td className="text-[12px] text-slate-400">{[r.tolerancePct != null ? '±' + dec(r.tolerancePct, 2) + '%' : null, r.toleranceAbsPaise != null ? '±' + rupees(r.toleranceAbsPaise) : null].filter(Boolean).join(' & ') || 'not set'}</Td>
            <Td><Chip cls={OUTCOME[r.outcome]}>{label(r.outcome)}</Chip>{r.rationale && <span className="block max-w-[14rem] text-[11px] text-slate-400">{r.rationale}</span>}</Td>
            <Td className="max-w-[16rem] text-[12px]">{r.resolution === 'none' ? <span className="text-slate-600">—</span> : <>
              <Chip cls={r.resolution === 'explained' ? 'chip-good' : 'chip-warn'}>{r.resolution}</Chip>
              <span className="block text-slate-300">{r.explanation}</span><RefList refs={r.evidenceRefs} />
            </>}</Td>
            <Td>{editable && ['outside_tolerance', 'tolerance_not_configured', 'not_computable'].includes(r.outcome) && <button className="btn btn-xs" onClick={() => setResolving(r)}>Resolve</button>}</Td>
          </>);
        }} />
      {resolving && <ResolveModal id={id} r={resolving} onClose={() => setResolving(null)} onSaved={() => { setResolving(null); onChange(); }} />}
    </Card>
  );
}

function ResolveModal({ id, r, onClose, onSaved }) {
  const [busy, run] = useAction();
  const [resolution, setResolution] = useState(r.resolution === 'none' ? 'explained' : r.resolution);
  const [explanation, setExplanation] = useState(r.explanation || '');
  const [refs, setRefs] = useState(r.evidenceRefs || []);
  const save = async () => { const x = await run(() => uw.resolveRecon(id, r.id, { resolution, explanation, evidenceRefs: refs }), 'Saved.'); if (x) onSaved(); };
  return (
    <Modal title={'Resolve ' + r.defCode} subtitle={r.comparableBasis} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy || !explanation.trim()} onClick={save}>{busy && <Spinner />}Save</button></>}>
      <div className="space-y-4">
        <Field label="Resolution">
          <select className="inp" value={resolution} onChange={(e) => setResolution(e.target.value)}>
            <option value="explained">Explained — with supporting evidence</option>
            <option value="unresolved">Unresolved — carry into the memo</option>
          </select>
        </Field>
        <Field label="Explanation"><textarea className="inp min-h-20" value={explanation} onChange={(e) => setExplanation(e.target.value)} /></Field>
        <Field label="Supporting evidence" hint={resolution === 'explained' ? 'Required: the fact, file, transaction or check that supports the explanation.' : 'Optional.'}>
          <RefPicker value={refs} onChange={setRefs} />
        </Field>
      </div>
    </Modal>
  );
}
