import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Pencil, Plus, X } from 'lucide-react';
import { uw, uwMemoUrl } from '../../../api.js';
import { Card, Chip, Field, KV, Modal, Spinner, Table, Td } from '../../../ui.jsx';
import { useLoad } from '../../../hooks.js';
import { fmtDate } from '../../../format.js';
import { label, rupees } from '../../../uwFormat.js';
import { useAction } from './common.jsx';

const IDENTITY = { unverified: 'chip-slate', matched: 'chip-good', mismatch: 'chip-bad', manual_review: 'chip-warn' };

export default function Overview({ id, c, party, detail, meta, editable, refresh, tick }) {
  const [editFacility, setEditFacility] = useState(false);
  const [editParty, setEditParty] = useState(false);
  const { data: history } = useLoad(() => uw.history(id), [id, tick]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Application and facility" right={editable && <button className="btn btn-xs" onClick={() => setEditFacility(true)}><Pencil size={12} /> Edit</button>}>
          <KV k="Product" v={(meta.products.find((p) => p.key === c.product) || {}).label || c.product} />
          <KV k="Requested" v={rupees(c.requestedPaise) + ' · ' + c.tenorDays + ' days'} />
          <KV k="Sector" v={c.sector || '—'} />
          <KV k="Borrower vintage" v={c.vintageYears == null ? '—' : c.vintageYears + ' years'} />
          <KV k="Purpose" v={c.purpose} />
          <KV k="Repayment source" v={c.repaymentSource} />
          <KV k="Due" v={c.dueDate ? fmtDate(c.dueDate) : '—'} />
          {c.parentCaseId && <KV k="Parent case" v={<Link className="text-neon-violet" to={'/uw/cases/' + c.parentCaseId}>#{c.parentCaseId}</Link>} />}
          <KV k="Opened" v={fmtDate(c.createdAt, true) + ' by ' + c.createdBy} />
        </Card>

        <Card title="Borrower and group" right={editable && <button className="btn btn-xs" onClick={() => setEditParty(true)}><Pencil size={12} /> Edit</button>}>
          <KV k="Legal name" v={party.legalName} />
          <KV k="CIN / PAN / GSTIN" v={[party.cin, party.pan, party.gstin].filter(Boolean).join(' · ') || '—'} />
          <KV k="Aliases" v={party.aliases.join(', ') || '—'} />
          <KV k="Directors" v={party.directors.map((d) => d.name + (d.din ? ' (DIN ' + d.din + ')' : '')).join(', ') || '—'} />
          <KV k="Related entities" v={party.related.map((r) => r.name + (r.relation ? ' — ' + r.relation : '')).join(', ') || '—'} />
          <KV k="Identity match" v={<Chip cls={IDENTITY[party.identityState]}>{label(party.identityState)}</Chip>} />
          {party.identityNote && <p className="mt-2 text-xs text-slate-400">{party.identityNote}</p>}
        </Card>
      </div>

      <Card title="Revision history" subtitle="Every submission freezes an evidence and policy snapshot; decisions point at it.">
        <Table rows={detail.decisions} cols={['Revision', 'Stage', 'Action', 'By', 'When', 'Rationale']}
          empty="No submissions yet."
          render={(d) => (<>
            <Td>r{d.revision}</Td><Td>{label(d.stage)}</Td><Td><Chip cls={d.action.startsWith('approve') ? 'chip-good' : d.action === 'decline' ? 'chip-bad' : 'chip-slate'}>{label(d.action)}</Chip></Td>
            <Td className="text-slate-400">{d.actorName}</Td><Td className="whitespace-nowrap text-slate-500">{fmtDate(d.createdAt, true)}</Td>
            <Td className="max-w-md text-slate-300">{d.rationale}{d.terms && d.terms.amountPaise != null && <span className="block text-[11px] text-slate-500">terms: {rupees(d.terms.amountPaise)} · {d.terms.tenorDays} days{d.terms.ratePct ? ' · ' + d.terms.ratePct + '%' : ''}</span>}</Td>
          </>)} />
        {!!detail.snapshots.length && (
          <div className="mt-4 space-y-1.5">
            <p className="lbl">Frozen snapshots</p>
            {detail.snapshots.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Chip cls="chip-violet">r{s.revision}</Chip>
                <span className="font-mono text-[11px] text-slate-500">SHA-256 {s.sha256.slice(0, 16)}…</span>
                <span className="text-slate-500">{s.createdBy} · {fmtDate(s.createdAt, true)}</span>
                <a className="btn btn-xs" href={uwMemoUrl(id, s.id)} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Memo as submitted</a>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Audit trail" subtitle="Uploads, views, extraction, corrections, rule changes, checks, submissions and decisions on this case.">
        <Table rows={(history || []).slice(0, 200)} loading={!history} cols={['When', 'Who', 'Action', 'Summary']}
          render={(h) => (<>
            <Td className="whitespace-nowrap text-slate-500">{fmtDate(h.createdAt, true)}</Td>
            <Td className="text-slate-400">{h.userName}</Td>
            <Td className="font-mono text-[11px] text-slate-400">{h.action}</Td>
            <Td className="text-slate-300">{h.summary}</Td>
          </>)} />
      </Card>

      {editFacility && <FacilityModal c={c} meta={meta} onClose={() => setEditFacility(false)} onSaved={() => { setEditFacility(false); refresh(); }} />}
      {editParty && <PartyModal id={id} party={party} onClose={() => setEditParty(false)} onSaved={() => { setEditParty(false); refresh(); }} />}
    </div>
  );
}

function FacilityModal({ c, meta, onClose, onSaved }) {
  const [busy, run] = useAction();
  const [f, setF] = useState({
    product: c.product, requestedAmount: (c.requestedPaise / 100).toFixed(2), tenorDays: String(c.tenorDays), sector: c.sector,
    vintageYears: c.vintageYears == null ? '' : String(c.vintageYears), purpose: c.purpose, repaymentSource: c.repaymentSource,
    dueDate: c.dueDate || '', analystId: c.analystId || ''
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const save = async () => {
    const r = await run(() => uw.updateCase(c.id, { ...f, tenorDays: Number(f.tenorDays), analystId: f.analystId || null, dueDate: f.dueDate || null }), 'Facility updated.');
    if (r) onSaved();
  };
  return (
    <Modal title="Edit facility" onClose={onClose} size="lg"
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy} onClick={save}>{busy && <Spinner />}Save</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product"><select className="inp" value={f.product} onChange={set('product')}>{meta.products.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></Field>
        <Field label="Requested amount (₹)"><input className="inp" value={f.requestedAmount} onChange={set('requestedAmount')} /></Field>
        <Field label="Tenor (days)"><input className="inp" type="number" value={f.tenorDays} onChange={set('tenorDays')} /></Field>
        <Field label="Sector"><input className="inp" value={f.sector} onChange={set('sector')} /></Field>
        <Field label="Vintage (years)"><input className="inp" type="number" step="0.5" value={f.vintageYears} onChange={set('vintageYears')} /></Field>
        <Field label="Due date"><input className="inp" type="date" value={f.dueDate} onChange={set('dueDate')} /></Field>
        <Field label="Analyst"><select className="inp" value={f.analystId} onChange={set('analystId')}><option value="">—</option>{meta.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Purpose" className="sm:col-span-2"><textarea className="inp min-h-16" value={f.purpose} onChange={set('purpose')} /></Field>
        <Field label="Repayment source" className="sm:col-span-2"><textarea className="inp min-h-16" value={f.repaymentSource} onChange={set('repaymentSource')} /></Field>
      </div>
    </Modal>
  );
}

function PartyModal({ id, party, onClose, onSaved }) {
  const [busy, run] = useAction();
  const [p, setP] = useState({ ...party, aliases: [...party.aliases], directors: party.directors.map((d) => ({ ...d })), related: party.related.map((r) => ({ ...r })) });
  const set = (k) => (e) => setP((s) => ({ ...s, [k]: e.target.value }));
  const listEdit = (key, idx, field) => (e) => setP((s) => ({ ...s, [key]: s[key].map((x, i) => (i === idx ? { ...x, [field]: e.target.value } : x)) }));
  const save = async () => {
    const r = await run(() => uw.updateParty(id, {
      legalName: p.legalName, entityType: p.entityType, cin: p.cin, pan: p.pan, gstin: p.gstin,
      aliases: p.aliases.filter((a) => a.trim()), directors: p.directors.filter((d) => d.name.trim()), related: p.related.filter((r) => r.name.trim()),
      identityState: p.identityState, identityNote: p.identityNote
    }), 'Identity updated.');
    if (r) onSaved();
  };
  return (
    <Modal title="Borrower and group" size="xl" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy} onClick={save}>{busy && <Spinner />}Save</button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Legal name" className="sm:col-span-3"><input className="inp" value={p.legalName} onChange={set('legalName')} /></Field>
        <Field label="CIN"><input className="inp uppercase" value={p.cin} onChange={set('cin')} /></Field>
        <Field label="PAN"><input className="inp uppercase" value={p.pan} onChange={set('pan')} /></Field>
        <Field label="GSTIN"><input className="inp uppercase" value={p.gstin} onChange={set('gstin')} /></Field>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div>
          <p className="lbl">Aliases</p>
          {p.aliases.map((a, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <input className="inp" value={a} onChange={(e) => setP((s) => ({ ...s, aliases: s.aliases.map((x, j) => (j === i ? e.target.value : x)) }))} />
              <button className="btn btn-ghost btn-icon" onClick={() => setP((s) => ({ ...s, aliases: s.aliases.filter((_, j) => j !== i) }))}><X size={14} /></button>
            </div>
          ))}
          <button className="btn btn-xs" onClick={() => setP((s) => ({ ...s, aliases: [...s.aliases, ''] }))}><Plus size={12} /> Alias</button>
        </div>
        <div>
          <p className="lbl">Directors</p>
          {p.directors.map((d, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_6rem_auto] gap-2">
              <input className="inp" placeholder="Name" value={d.name} onChange={listEdit('directors', i, 'name')} />
              <input className="inp" placeholder="DIN" value={d.din || ''} onChange={listEdit('directors', i, 'din')} />
              <button className="btn btn-ghost btn-icon" onClick={() => setP((s) => ({ ...s, directors: s.directors.filter((_, j) => j !== i) }))}><X size={14} /></button>
            </div>
          ))}
          <button className="btn btn-xs" onClick={() => setP((s) => ({ ...s, directors: [...s.directors, { name: '', din: '', pan: '' }] }))}><Plus size={12} /> Director</button>
        </div>
        <div>
          <p className="lbl">Related entities</p>
          {p.related.map((r, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_7rem_auto] gap-2">
              <input className="inp" placeholder="Name" value={r.name} onChange={listEdit('related', i, 'name')} />
              <input className="inp" placeholder="Relation" value={r.relation || ''} onChange={listEdit('related', i, 'relation')} />
              <button className="btn btn-ghost btn-icon" onClick={() => setP((s) => ({ ...s, related: s.related.filter((_, j) => j !== i) }))}><X size={14} /></button>
            </div>
          ))}
          <button className="btn btn-xs" onClick={() => setP((s) => ({ ...s, related: [...s.related, { name: '', relation: '', identifier: '' }] }))}><Plus size={12} /> Related entity</button>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Field label="Identity match state">
          <select className="inp" value={p.identityState} onChange={set('identityState')}>
            {['unverified', 'matched', 'mismatch', 'manual_review'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </Field>
        <Field label="Identity note" className="sm:col-span-2" hint="Required when the identity state changes — what was matched against what.">
          <input className="inp" value={p.identityNote} onChange={set('identityNote')} />
        </Field>
      </div>
    </Modal>
  );
}

