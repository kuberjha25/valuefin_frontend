import React, { useState } from 'react';
import { CheckCircle2, CircleAlert, ExternalLink, Info, Send } from 'lucide-react';
import { uw, uwMemoUrl } from '../../../api.js';
import { Card, Chip, Field, Spinner } from '../../../ui.jsx';
import { fmtDate } from '../../../format.js';
import { CASE_STATUS, label, rupees } from '../../../uwFormat.js';
import { useAction } from './common.jsx';

export default function Approval({ id, c, detail, me, ready, editable, refresh }) {
  const [busy, run] = useAction(refresh);
  const [text, setText] = useState('');
  const [mod, setMod] = useState({ amount: c.terms && c.terms.amountPaise != null ? (c.terms.amountPaise / 100).toFixed(2) : '', tenorDays: String((c.terms && c.terms.tenorDays) || c.tenorDays), ratePct: (c.terms && c.terms.ratePct) || '', conditions: '' });
  const sub = [...detail.decisions].reverse().find((d) => d.revision === c.revision && d.action === 'submit');
  const chk = [...detail.decisions].reverse().find((d) => d.revision === c.revision && d.stage === 'checker' && d.action === 'recommend');
  const lastSnap = detail.snapshots[detail.snapshots.length - 1];
  const st = CASE_STATUS[c.status] || {};
  const gates = ready ? ready.gates : [];
  const blocks = gates.filter((g) => g.severity === 'block');
  const warns = gates.filter((g) => g.severity === 'warn' && !g.ok);
  const done = (r) => { if (r) setText(''); };

  return (
    <div className="space-y-5">
      <Card title="Where this case is" subtitle="Analyst recommendation, checker comments and the sanction decision are separate records. Approval records a sanction decision only — it never creates a disbursement instruction.">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Chip cls={st.cls}>{st.label}</Chip>
          <span className="text-slate-400">revision {c.revision}</span>
          {sub && <span className="text-slate-400">submitted by {sub.actorName} · {fmtDate(sub.createdAt, true)}</span>}
          {chk && <span className="text-slate-400">checked by {chk.actorName}</span>}
          {lastSnap && <a className="btn btn-xs" href={uwMemoUrl(id, lastSnap.id)} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Memo as submitted (r{lastSnap.revision})</a>}
        </div>
      </Card>

      {editable && (
        <Card title="Submission gates" subtitle="Computed live from the evidence. Blocking items must be cleared; warnings carry into the memo and the review queue.">
          {!ready ? <Spinner /> : (
            <div className="space-y-1.5">
              {blocks.map((g) => (
                <p key={g.key} className={'flex gap-2 text-sm ' + (g.ok ? 'text-emerald-200' : 'text-rose-200')}>
                  {g.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <CircleAlert size={15} className="mt-0.5 shrink-0" />}{g.message}
                </p>
              ))}
              {warns.map((g) => <p key={g.key} className="flex gap-2 text-sm text-amber-200"><Info size={15} className="mt-0.5 shrink-0" />{g.message}</p>)}
            </div>
          )}
          <div className="mt-5 border-t border-white/10 pt-4">
            <Field label="Analyst recommendation" hint="Submitting freezes the evidence and policy snapshot (SHA-256 sealed) and sends the case to a checker.">
              <textarea className="inp min-h-24" value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <button className="btn btn-p mt-3" disabled={busy || !ready || !ready.ready || !text.trim()}
              onClick={async () => done(await run(() => uw.submit(id, text), 'Submitted to the checker.'))}>{busy ? <Spinner /> : <Send size={14} />} Submit to checker</button>
          </div>
        </Card>
      )}

      {c.status === 'submitted' && (
        <Card title="Checker" subtitle="A Manager or Director other than the person who submitted.">
          {!['manager', 'director'].includes(me.role) ? <p className="text-sm text-slate-400">Waiting for a Manager or Director.</p>
            : sub && sub.actorId === me.id ? <p className="text-sm text-slate-400">You submitted this revision — another Manager or Director must check it.</p> : (<>
              <Field label="Checker comments"><textarea className="inp min-h-24" value={text} onChange={(e) => setText(e.target.value)} /></Field>
              <div className="mt-3 flex gap-2">
                <button className="btn btn-p" disabled={busy || !text.trim()} onClick={async () => done(await run(() => uw.check(id, 'recommend', text), 'Recommended to the sanction authority.'))}>Recommend</button>
                <button className="btn" disabled={busy || !text.trim()} onClick={async () => done(await run(() => uw.check(id, 'send_back', text), 'Sent back to the analyst.'))}>Send back</button>
              </div>
            </>)}
        </Card>
      )}

      {c.status === 'recommended' && (
        <Card title="Sanction authority" subtitle="A Director other than the submitter, and other than the checker unless no other Director is available.">
          {me.role !== 'director' ? <p className="text-sm text-slate-400">Waiting for a Director.</p>
            : sub && sub.actorId === me.id ? <p className="text-sm text-slate-400">You submitted this revision — another Director must decide it.</p> : (<>
              <p className="mb-3 text-sm text-slate-300">Proposed: {c.terms ? rupees(c.terms.amountPaise) + ' for ' + c.terms.tenorDays + ' days' + (c.terms.ratePct ? ' at ' + c.terms.ratePct + '%' : '') : '—'}</p>
              <Field label="Decision rationale"><textarea className="inp min-h-24" value={text} onChange={(e) => setText(e.target.value)} /></Field>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <Field label="Modified amount (₹)"><input className="inp" value={mod.amount} onChange={(e) => setMod((s) => ({ ...s, amount: e.target.value }))} /></Field>
                <Field label="Tenor (days)"><input className="inp" type="number" value={mod.tenorDays} onChange={(e) => setMod((s) => ({ ...s, tenorDays: e.target.value }))} /></Field>
                <Field label="Rate (%)"><input className="inp" value={mod.ratePct} onChange={(e) => setMod((s) => ({ ...s, ratePct: e.target.value }))} /></Field>
                <Field label="Conditions"><input className="inp" value={mod.conditions} onChange={(e) => setMod((s) => ({ ...s, conditions: e.target.value }))} /></Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn btn-p" disabled={busy || !text.trim()} onClick={async () => done(await run(() => uw.sanction(id, { action: 'approve', rationale: text }), 'Approved.'))}>Approve as proposed</button>
                <button className="btn" disabled={busy || !text.trim() || !mod.amount.trim()} onClick={async () => done(await run(() => uw.sanction(id, { action: 'approve_modified', rationale: text, terms: { ...mod, tenorDays: Number(mod.tenorDays) } }), 'Approved with modified terms.'))}>Approve with the modified terms</button>
                <button className="btn btn-d" disabled={busy || !text.trim()} onClick={async () => done(await run(() => uw.sanction(id, { action: 'decline', rationale: text }), 'Declined.'))}>Decline</button>
                <button className="btn" disabled={busy || !text.trim()} onClick={async () => done(await run(() => uw.sanction(id, { action: 'send_back', rationale: text }), 'Sent back.'))}>Send back</button>
              </div>
            </>)}
        </Card>
      )}

      <Card title="Decisions">
        {!detail.decisions.length ? <p className="text-sm text-slate-500">None yet.</p> : detail.decisions.slice().reverse().map((d) => (
          <div key={d.id} className="border-b border-white/[.06] py-2 text-sm last:border-0">
            <Chip cls={d.action.startsWith('approve') ? 'chip-good' : d.action === 'decline' ? 'chip-bad' : 'chip-slate'}>{label(d.stage)} · {label(d.action)}</Chip>
            <span className="ml-2 text-slate-400">r{d.revision} · {d.actorName} · {fmtDate(d.createdAt, true)}</span>
            <p className="mt-1 whitespace-pre-wrap text-slate-300">{d.rationale}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}
