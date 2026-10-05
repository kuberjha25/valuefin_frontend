import React, { useState } from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import { uw } from '../../../api.js';
import { Card, Chip, Field, Modal, Spinner, Table, Td } from '../../../ui.jsx';
import { useLoad } from '../../../hooks.js';
import { fmtDate } from '../../../format.js';
import { CHECK_STATUS, label } from '../../../uwFormat.js';
import { RefList, RefPicker, useAction } from './common.jsx';

const SUPPORT = { supported: 'chip-good', partially_supported: 'chip-cyan', unsupported: 'chip-warn', contradicted: 'chip-bad', unverified: 'chip-slate' };

export default function Investigation({ id, meta, party, editable, refresh, tick }) {
  const { data: checks, reload: rc } = useLoad(() => uw.checks(id), [id, tick]);
  const { data: claims, reload: rcl } = useLoad(() => uw.claims(id), [id, tick]);
  const { data: questions, reload: rq } = useLoad(() => uw.questions(id), [id, tick]);
  const [addCheck, setAddCheck] = useState(false);
  const [completing, setCompleting] = useState(null);
  const [claim, setClaim] = useState(null);
  const [asking, setAsking] = useState(false);
  const [answering, setAnswering] = useState(null);
  const [busy, run] = useAction(() => { rq(); refresh(); });
  const sourceOf = (sid) => meta.sources.find((s) => s.id === sid) || {};

  return (
    <div className="space-y-5">
      <Card title="Public check tasks" subtitle="Phase 1 performs no automated website access: each check is searched by the analyst and recorded with the query, time, result and a snapshot or attestation. A failed search is recorded as failed — never as clear."
        right={editable && <button className="btn btn-xs" onClick={() => setAddCheck(true)}><Plus size={12} /> Check</button>}>
        <Table rows={checks || []} loading={!checks} cols={['Source', 'Search', 'Outcome', 'Result', '']} empty="No checks yet."
          render={(x) => {
            const s = sourceOf(x.sourceId);
            return (<>
              <Td className="text-slate-200">{x.sourceName}{s.url && <a className="mt-0.5 flex items-center gap-1 text-[11px] text-neon-violet" href={s.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={11} /> open source</a>}</Td>
              <Td className="text-[12px] text-slate-300">{x.searchTerms}{x.queryUsed && <span className="block text-slate-500">query: {x.queryUsed}</span>}</Td>
              <Td><Chip cls={CHECK_STATUS[x.status]}>{label(x.status)}</Chip>{x.critical && <Chip cls="chip-bad" className="ml-1">critical</Chip>}
                {x.searchedAt && <span className="block text-[11px] text-slate-500">{fmtDate(x.searchedAt, true)} · {x.completedBy}</span>}</Td>
              <Td className="max-w-md text-[12px] text-slate-300">
                {x.resultUrl && <a className="block truncate text-neon-violet" href={x.resultUrl} target="_blank" rel="noopener noreferrer">{x.resultTitle || x.resultUrl}</a>}
                {x.matchConfidence && <span className="block text-slate-500">identity match: {x.matchConfidence}</span>}
                {x.analystNote && <span className="block">{x.analystNote}</span>}
                {x.snapshotVersionId && <span className="block text-slate-500">snapshot: file #{x.snapshotVersionId}</span>}
              </Td>
              <Td>{editable && <button className="btn btn-xs" onClick={() => setCompleting(x)}>{x.status === 'pending' ? 'Record result' : 'Update'}</button>}</Td>
            </>);
          }} />
      </Card>

      <Card title="Claim ledger" subtitle="Statements the memo relies on, each with its evidence and support state."
        right={editable && <button className="btn btn-xs" onClick={() => setClaim({})}><Plus size={12} /> Claim</button>}>
        <Table rows={claims || []} loading={!claims} cols={['#', 'Category', 'Claim', 'Support', 'Evidence', '']} empty="No claims recorded."
          render={(x) => (<>
            <Td className="text-slate-500">{x.id}</Td><Td>{x.category}</Td>
            <Td className="max-w-lg text-slate-200">{x.statement}{x.uncertainty && <span className="block text-[11px] text-amber-200">{x.uncertainty}</span>}</Td>
            <Td><Chip cls={SUPPORT[x.supportState]}>{label(x.supportState)}</Chip></Td>
            <Td><RefList refs={x.evidenceRefs} /></Td>
            <Td>{editable && <button className="btn btn-xs" onClick={() => setClaim(x)}>Edit</button>}</Td>
          </>)} />
      </Card>

      <Card title="Borrower questions" subtitle="Questions for the borrower and their responses (with any attached file)."
        right={editable && <button className="btn btn-xs" onClick={() => setAsking(true)}><Plus size={12} /> Question</button>}>
        <Table rows={questions || []} loading={!questions} cols={['#', 'Question', 'Response', 'Status', '']} empty="No questions raised."
          render={(x) => (<>
            <Td className="text-slate-500">{x.id}</Td>
            <Td className="max-w-md text-slate-200">{x.question}<span className="block text-[11px] text-slate-500">{x.askedBy} · {fmtDate(x.askedAt)}</span><RefList refs={x.relatedRefs} /></Td>
            <Td className="max-w-md text-[12px] text-slate-300">{x.response || '—'}{x.responseVersionId && <span className="block text-slate-500">attachment: file #{x.responseVersionId}</span>}</Td>
            <Td><Chip cls={x.status === 'open' ? 'chip-warn' : x.status === 'answered' ? 'chip-good' : 'chip-slate'}>{x.status}</Chip></Td>
            <Td><span className="flex justify-end gap-1">
              {editable && x.status !== 'closed' && <button className="btn btn-xs" onClick={() => setAnswering(x)}>Record response</button>}
              {editable && x.status === 'answered' && <button className="btn btn-xs" disabled={busy} onClick={() => run(() => uw.closeQuestion(id, x.id), 'Closed.')}>Close</button>}
            </span></Td>
          </>)} />
      </Card>

      {addCheck && <AddCheck id={id} meta={meta} party={party} onClose={() => setAddCheck(false)} onSaved={() => { setAddCheck(false); rc(); refresh(); }} />}
      {completing && <CompleteCheck id={id} x={completing} onClose={() => setCompleting(null)} onSaved={() => { setCompleting(null); rc(); refresh(); }} />}
      {claim && <ClaimModal id={id} x={claim} onClose={() => setClaim(null)} onSaved={() => { setClaim(null); rcl(); }} />}
      {asking && <AskModal id={id} onClose={() => setAsking(false)} onSaved={() => { setAsking(false); rq(); refresh(); }} />}
      {answering && <AnswerModal id={id} x={answering} onClose={() => setAnswering(null)} onSaved={() => { setAnswering(null); rq(); refresh(); }} />}
    </div>
  );
}

function AddCheck({ id, meta, party, onClose, onSaved }) {
  const [busy, run] = useAction();
  const sources = meta.sources.filter((s) => s.active);
  const [sourceId, setSourceId] = useState(sources[0] ? sources[0].id : '');
  const [terms, setTerms] = useState([party.gstin, party.pan, party.cin, party.legalName].filter(Boolean)[0] || '');
  const [assignedToId, setAssignedToId] = useState('');
  const src = sources.find((s) => s.id === Number(sourceId)) || {};
  return (
    <Modal title="Add a public check" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy || !sourceId || !terms.trim()}
        onClick={async () => { if (await run(() => uw.addCheck(id, { sourceId: Number(sourceId), searchTerms: terms, assignedToId: assignedToId || null }), 'Check added.')) onSaved(); }}>Add</button></>}>
      <div className="space-y-3">
        <Field label="Source"><select className="inp" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        {src.searchIdentifiers && <p className="text-[12px] text-slate-500">Searched by: {src.searchIdentifiers}</p>}
        <Field label="Search terms" hint={'Identifiers and aliases on file: ' + [party.legalName, ...party.aliases, party.cin, party.pan, party.gstin].filter(Boolean).join(' · ')}>
          <input className="inp" value={terms} onChange={(e) => setTerms(e.target.value)} />
        </Field>
        <Field label="Assign to"><select className="inp" value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}><option value="">—</option>{meta.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
      </div>
    </Modal>
  );
}

function CompleteCheck({ id, x, onClose, onSaved }) {
  const [busy, run] = useAction();
  const { data: docs } = useLoad(() => uw.documents(id), [id]);
  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const [f, setF] = useState({
    status: x.status === 'pending' ? 'no_match' : x.status, searchedAt: now.toISOString().slice(0, 16), queryUsed: x.queryUsed || x.searchTerms,
    resultUrl: x.resultUrl || '', resultTitle: x.resultTitle || '', analystNote: x.analystNote || '', matchConfidence: x.matchConfidence || '',
    critical: x.critical, snapshotVersionId: x.snapshotVersionId || ''
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const snaps = (docs || []).filter((d) => d.intakeStatus === 'accepted');
  const save = async () => { if (await run(() => uw.completeCheck(id, x.id, { ...f, snapshotVersionId: f.snapshotVersionId || null, matchConfidence: f.matchConfidence || null }), 'Check recorded.')) onSaved(); };
  return (
    <Modal title={'Record ' + x.sourceName + ' check'} subtitle={x.searchTerms} size="lg" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy} onClick={save}>{busy && <Spinner />}Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Outcome"><select className="inp" value={f.status} onChange={set('status')}>
          <option value="match_found">Match found</option><option value="no_match">No match (search completed)</option>
          <option value="failed">Failed — site unavailable / blocked</option><option value="manual_review_required">Manual review required</option></select></Field>
        <Field label="Searched at"><input className="inp" type="datetime-local" value={f.searchedAt} onChange={set('searchedAt')} /></Field>
        <Field label="Exact query used" className="sm:col-span-2"><input className="inp" value={f.queryUsed} onChange={set('queryUsed')} /></Field>
        {f.status === 'match_found' && <>
          <Field label="Result URL"><input className="inp" value={f.resultUrl} onChange={set('resultUrl')} placeholder="https://…" /></Field>
          <Field label="Result title"><input className="inp" value={f.resultTitle} onChange={set('resultTitle')} /></Field>
          <Field label="Identity match confidence"><select className="inp" value={f.matchConfidence} onChange={set('matchConfidence')}><option value="">—</option><option value="exact">Exact (identifier match)</option><option value="probable">Probable</option><option value="possible">Possible</option></select></Field>
          <label className="flex items-center gap-2 pt-6 text-sm text-rose-200"><input type="checkbox" checked={f.critical} onChange={set('critical')} /> Verified critical event</label>
        </>}
        <Field label="Snapshot file" hint="Upload it on Upload & coverage with source 'Public check snapshot'."><select className="inp" value={f.snapshotVersionId} onChange={set('snapshotVersionId')}><option value="">—</option>{snaps.map((d) => <option key={d.id} value={d.id}>#{d.id} {d.originalName}</option>)}</select></Field>
        <Field label={f.status === 'failed' || f.status === 'manual_review_required' ? 'What happened' : 'Attestation / note'} className="sm:col-span-2"
          hint="Required without a snapshot: what was searched and what was seen.">
          <textarea className="inp min-h-20" value={f.analystNote} onChange={set('analystNote')} /></Field>
      </div>
    </Modal>
  );
}

function ClaimModal({ id, x, onClose, onSaved }) {
  const [busy, run] = useAction();
  const [f, setF] = useState({ category: x.category || 'business', statement: x.statement || '', supportState: x.supportState || 'unverified', uncertainty: x.uncertainty || '' });
  const [refs, setRefs] = useState(x.evidenceRefs || []);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const save = async () => { if (await run(() => (x.id ? uw.updateClaim(id, x.id, { ...f, evidenceRefs: refs }) : uw.addClaim(id, { ...f, evidenceRefs: refs })), 'Claim saved.')) onSaved(); };
  return (
    <Modal title={x.id ? 'Edit claim #' + x.id : 'New claim'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy || !f.statement.trim()} onClick={save}>Save</button></>}>
      <div className="space-y-3">
        <Field label="Category"><input className="inp" value={f.category} onChange={set('category')} /></Field>
        <Field label="Claim"><textarea className="inp min-h-20" value={f.statement} onChange={set('statement')} /></Field>
        <Field label="Support"><select className="inp" value={f.supportState} onChange={set('supportState')}>{['supported', 'partially_supported', 'unsupported', 'contradicted', 'unverified'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>
        <Field label="Uncertainty"><input className="inp" value={f.uncertainty} onChange={set('uncertainty')} /></Field>
        <Field label="Evidence" hint="Supported, partially supported and contradicted claims must cite evidence."><RefPicker value={refs} onChange={setRefs} /></Field>
      </div>
    </Modal>
  );
}

function AskModal({ id, onClose, onSaved }) {
  const [busy, run] = useAction();
  const [question, setQuestion] = useState('');
  const [refs, setRefs] = useState([]);
  return (
    <Modal title="Question for the borrower" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy || !question.trim()} onClick={async () => { if (await run(() => uw.askQuestion(id, { question, relatedRefs: refs }), 'Question recorded.')) onSaved(); }}>Save</button></>}>
      <div className="space-y-3">
        <Field label="Question"><textarea className="inp min-h-24" value={question} onChange={(e) => setQuestion(e.target.value)} autoFocus /></Field>
        <Field label="Related evidence (optional)"><RefPicker value={refs} onChange={setRefs} /></Field>
      </div>
    </Modal>
  );
}

function AnswerModal({ id, x, onClose, onSaved }) {
  const [busy, run] = useAction();
  const { data: docs } = useLoad(() => uw.documents(id), [id]);
  const [response, setResponse] = useState(x.response || '');
  const [versionId, setVersionId] = useState(x.responseVersionId || '');
  return (
    <Modal title="Borrower's response" subtitle={x.question} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy || !response.trim()} onClick={async () => { if (await run(() => uw.answerQuestion(id, x.id, { response, responseVersionId: versionId || null }), 'Response recorded.')) onSaved(); }}>Save</button></>}>
      <div className="space-y-3">
        <Field label="Response"><textarea className="inp min-h-24" value={response} onChange={(e) => setResponse(e.target.value)} autoFocus /></Field>
        <Field label="Attachment" hint="Upload it first with source 'Borrower response'."><select className="inp" value={versionId} onChange={(e) => setVersionId(e.target.value)}><option value="">—</option>{(docs || []).filter((d) => d.intakeStatus === 'accepted').map((d) => <option key={d.id} value={d.id}>#{d.id} {d.originalName}</option>)}</select></Field>
      </div>
    </Modal>
  );
}
