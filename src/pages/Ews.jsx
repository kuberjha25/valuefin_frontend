import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Ban, CheckCircle2, FilePlus2, Plus, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, ErrorNote, Field, KV, Modal, PageHead, Spinner, Stat, Tabs, useToast } from '../ui.jsx';
import { useLoad, useLocal } from '../hooks.js';
import { fmtAgo, fmtDate } from '../format.js';

const SEV = { high: { cls: 'chip-bad', edge: 'border-l-state-bad' }, medium: { cls: 'chip-warn', edge: 'border-l-neon-amber' },
  low: { cls: 'chip-cyan', edge: 'border-l-neon-cyan' } };
const SUGGESTED = ['Updated bank statement, last 30 days', 'Latest monthly MIS', 'GST returns, latest filed',
  'Written explanation from the founder', 'Repayment plan in writing', 'Collection account statement'];

/* Rules that watch the book, plus events staff log by hand. An alert is never
   closed by the machine that raised it — clearing one is a person's decision
   with a written resolution against their name. */
export default function Ews() {
  const me = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const canAct = me.role === 'director' || me.role === 'manager';
  const isDirector = me.role === 'director';

  const [status, setStatus] = useLocal('ews.status', 'open');
  const [busy, setBusy] = useState(false);
  const [logging, setLogging] = useState(false);
  const [resolving, setResolving] = useState(null);
  const [asking, setAsking] = useState(null);
  const [stopping, setStopping] = useState(null);

  const { data, error, loading, reload } = useLoad(() => api.ews({ status: status || undefined }), [status]);
  const { data: borrowers } = useLoad(() => api.borrowers({}), []);

  const act = async (fn, msg) => {
    setBusy(true);
    try { await fn(); if (msg) toast(msg); await reload(); }
    catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  const scan = () => act(async () => {
    const r = await api.scanEws();
    toast(r.raised ? r.raised + ' new alert(s) raised.' : 'Rules re-run — nothing new.');
  });

  const counts = (data && data.counts) || {};
  const alerts = (data && data.alerts) || [];
  const stopped = (data && data.stoppedBorrowers) || [];

  return (
    <div className="space-y-5">
      <PageHead icon={ShieldAlert} title="Early warning"
        subtitle="Rules that run against the book — overdue tranches, limits nearly full, reviews past due, missing MIS, revenue falling away, runway thinning — plus anything staff log by hand.">
        <button className="btn" onClick={scan} disabled={busy}>{busy ? <Spinner /> : <RefreshCw size={15} />} Re-run the rules</button>
        {canAct && <button className="btn btn-p" onClick={() => setLogging(true)}><Plus size={15} /> Log an event</button>}
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={AlertTriangle} label="Open" value={counts.open || 0} accent={counts.open ? 'amber' : 'lime'}
          sub={(counts.high || 0) + ' of them high severity'} />
        <Stat icon={ShieldCheck} label="Picked up" value={counts.acknowledged || 0} accent="cyan" sub="someone is on it" />
        <Stat icon={CheckCircle2} label="Resolved" value={counts.resolved || 0} accent="violet" sub="closed with a written resolution" />
        <Stat icon={Ban} label="Drawdowns stopped" value={stopped.length} accent={stopped.length ? 'pink' : 'lime'}
          sub={stopped.length ? stopped.map((b) => b.name).join(', ') : 'no borrower is blocked'} />
      </div>

      {!!stopped.length && (
        <div className="rounded-2xl border border-state-bad/30 bg-state-bad/[.08] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-rose-100">
            <Ban size={16} className="shrink-0" />
            <b>No further money goes out to:</b>
            {stopped.map((b) => (
              <button key={b.id} className="chip-bad hover:underline" onClick={() => nav('/borrowers/' + b.id)}>{b.name}</button>
            ))}
            {isDirector && <span className="text-[12px] text-rose-200/70">Only a Director can lift a stop.</span>}
          </div>
        </div>
      )}

      <Card>
        <div className="mb-4">
          <Tabs value={status} onChange={setStatus} tabs={[
            ['open', 'Open', counts.open || 0],
            ['acknowledged', 'Picked up', counts.acknowledged || 0],
            ['resolved', 'Resolved', counts.resolved || 0],
            ['', 'Everything']
          ]} />
        </div>

        {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote>
          : loading ? <p className="py-10 text-center text-sm text-slate-500"><Spinner /> Loading…</p>
            : !alerts.length ? (
              <Empty icon={ShieldCheck} title={status === 'open' ? 'Nothing is warning' : 'Nothing here'}>
                {status === 'open'
                  ? 'Every rule is quiet and no events have been logged. Re-run the rules to check again.'
                  : 'No alerts in this state.'}
              </Empty>
            ) : (
              <div className="space-y-2.5">
                {alerts.map((a) => (
                  <div key={a.id} className={'rounded-2xl border border-l-4 border-white/8 bg-white/[.03] px-4 py-3 ' + (SEV[a.severity] || SEV.low).edge}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip cls={(SEV[a.severity] || SEV.low).cls}>{a.severity}</Chip>
                      <button className="font-semibold text-slate-100 hover:text-neon-violet" onClick={() => nav('/borrowers/' + a.borrowerId)}>
                        {a.borrowerName}
                      </button>
                      <Chip cls="chip-slate">{a.auto ? 'rule' : 'logged by ' + a.raisedBy}</Chip>
                      <span className="text-[11px] text-slate-500" title={fmtDate(a.createdAt, true)}>{fmtAgo(a.createdAt)}</span>
                      <span className="ml-auto">
                        {a.status === 'open' ? <Chip cls="chip-warn">open</Chip>
                          : a.status === 'acknowledged' ? <Chip cls="chip-cyan">picked up by {a.acknowledgedBy}</Chip>
                            : <Chip cls="chip-good">resolved by {a.resolvedBy}</Chip>}
                      </span>
                    </div>

                    <p className="mt-2 text-[13.5px] leading-snug text-slate-200">{a.message}</p>

                    {!!a.requestedDocs.length && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] uppercase tracking-wide text-slate-500">Asked for:</span>
                        {a.requestedDocs.map((d, i) => <Chip key={i} cls="chip-slate">{d.label}</Chip>)}
                      </div>
                    )}

                    {a.status === 'resolved' && a.resolution && (
                      <p className="mt-2 rounded-xl border border-state-good/20 bg-state-good/[.05] px-3 py-2 text-[12px] text-emerald-100">
                        {a.resolution}
                      </p>
                    )}

                    {a.status !== 'resolved' && canAct && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {a.status === 'open' && (
                          <button className="btn btn-xs" disabled={busy}
                            onClick={() => act(() => api.acknowledgeEws(a.id), 'Picked up — it is yours now.')}>
                            I am on it
                          </button>
                        )}
                        <button className="btn btn-xs" onClick={() => setAsking(a)}><FilePlus2 size={12} /> Ask for documents</button>
                        <button className="btn btn-xs btn-p" onClick={() => setResolving(a)}>Resolve</button>
                        {isDirector && (
                          <button className="btn btn-xs btn-d ml-auto" onClick={() => setStopping({ alert: a, stop: true })}>
                            <Ban size={12} /> Stop drawdowns
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
      </Card>

      {isDirector && !!stopped.length && (
        <Card title="Lift a drawdown stop" subtitle="Once the concern behind it has actually been dealt with.">
          <div className="flex flex-wrap gap-2">
            {stopped.map((b) => (
              <button key={b.id} className="btn btn-xs" disabled={busy}
                onClick={() => act(() => api.setDrawdownStop(b.id, false, ''), 'Stop lifted for ' + b.name + '.')}>
                Lift the stop on {b.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      {logging && (
        <LogEventModal borrowers={borrowers || []} onClose={() => setLogging(false)}
          onSave={async (body) => { await act(() => api.raiseEws(body), 'Event logged.'); setLogging(false); }} />
      )}
      {resolving && (
        <ResolveModal alert={resolving} onClose={() => setResolving(null)}
          onSave={async (text) => { await act(() => api.resolveEws(resolving.id, text), 'Resolved.'); setResolving(null); }} />
      )}
      {asking && (
        <AskModal alert={asking} onClose={() => setAsking(null)}
          onSave={async (docs) => { await act(() => api.requestEwsDocuments(asking.id, docs), 'Requested.'); setAsking(null); }} />
      )}
      {stopping && (
        <StopModal alert={stopping.alert} onClose={() => setStopping(null)}
          onSave={async (reason) => {
            await act(() => api.setDrawdownStop(stopping.alert.borrowerId, true, reason), 'Drawdowns stopped.');
            setStopping(null);
          }} />
      )}
    </div>
  );
}

function LogEventModal({ borrowers, onClose, onSave }) {
  const [f, setF] = useState({ borrowerId: '', severity: 'medium', message: '', docs: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal title="Log an early-warning event" size="lg" onClose={onClose}
      subtitle="Anything the rules cannot see — a bounce reported by the bank, a GST notice, an investor stepping back."
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p" disabled={!f.borrowerId || !f.message.trim()}
          onClick={() => onSave({ borrowerId: +f.borrowerId, severity: f.severity, message: f.message,
            requestedDocs: f.docs.split('\n').map((x) => x.trim()).filter(Boolean) })}>Log it</button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Borrower">
          <select className="inp" value={f.borrowerId} onChange={set('borrowerId')}>
            <option value="">— select —</option>
            {borrowers.map((b) => <option key={b.borrowerId} value={b.borrowerId}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Severity" hint="High means it should be dealt with today.">
          <select className="inp" value={f.severity} onChange={set('severity')}>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </Field>
        <Field label="What happened" className="sm:col-span-2">
          <textarea className="inp min-h-24" value={f.message} onChange={set('message')}
            placeholder="e.g. NACH mandate bounced on 14 August for ₹2,10,000 — bank cited insufficient funds." />
        </Field>
        <Field label="Documents to ask for" className="sm:col-span-2" hint="One per line. Optional.">
          <textarea className="inp min-h-20" value={f.docs} onChange={set('docs')} placeholder="Updated bank statement, last 30 days" />
        </Field>
      </div>
    </Modal>
  );
}

function ResolveModal({ alert, onClose, onSave }) {
  const [text, setText] = useState('');
  return (
    <Modal title="Resolve this alert" subtitle={alert.borrowerName} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p" disabled={!text.trim()} onClick={() => onSave(text)}>Resolve</button>
      </>}>
      <KV k="The alert" v={alert.message} />
      <div className="mt-4">
        <Field label="What was actually done about it"
          hint="This is the record. A rule going quiet is not the same as the risk being dealt with.">
          <textarea className="inp min-h-28" autoFocus value={text} onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Spoke to the promoter on 18 Aug; ₹2.1 L cleared by RTGS the same day and the mandate re-registered." />
        </Field>
      </div>
    </Modal>
  );
}

function AskModal({ alert, onClose, onSave }) {
  const [picked, setPicked] = useState([]);
  const [extra, setExtra] = useState('');
  const toggle = (d) => setPicked((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));
  const all = picked.concat(extra.split('\n').map((x) => x.trim()).filter(Boolean));
  return (
    <Modal title="Ask the borrower for documents" subtitle={alert.borrowerName} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p" disabled={!all.length} onClick={() => onSave(all)}>Request {all.length || ''}</button>
      </>}>
      <div className="space-y-1">
        {SUGGESTED.map((d) => (
          <label key={d} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-slate-300 hover:bg-white/[.04]">
            <input type="checkbox" checked={picked.includes(d)} onChange={() => toggle(d)} /> {d}
          </label>
        ))}
      </div>
      <div className="mt-4">
        <Field label="Anything else" hint="One per line."><textarea className="inp min-h-20" value={extra} onChange={(e) => setExtra(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function StopModal({ alert, onClose, onSave }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Stop all drawdowns" subtitle={alert.borrowerName} size="sm" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-d" disabled={!reason.trim()} onClick={() => onSave(reason)}>Stop drawdowns</button>
      </>}>
      <p className="text-sm leading-relaxed text-slate-300">
        No further money goes out to <b className="text-slate-100">{alert.borrowerName}</b> — no fresh drawdown, no
        rotation — until a Director lifts it.
      </p>
      <div className="mt-4">
        <Field label="Reason"><textarea className="inp min-h-24" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
