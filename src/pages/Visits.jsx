import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Plus } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, ErrorNote, Field, Modal, PageHead, Spinner, Stat, Table, Td, useToast } from '../ui.jsx';
import { useLoad } from '../hooks.js';
import { fmt, fmtCr, fmtDate, today } from '../format.js';

/* The quarterly cadence. Anyone with money out and no visit inside 92 days is
   due, and logging a visit answers the early-warning alert that says so. */
export default function Visits() {
  const me = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const canLog = me.role === 'director' || me.role === 'manager';
  const [logging, setLogging] = useState(false);

  const { data, error, loading, reload } = useLoad(() => api.visits({}), []);
  const visits = (data && data.visits) || [];
  const cadence = (data && data.cadence) || [];
  const due = cadence.filter((c) => c.due);
  const covered = cadence.filter((c) => c.outstanding > 0.5 && !c.due);

  return (
    <div className="space-y-5">
      <PageHead icon={MapPin} title="Site visits"
        subtitle="A borrower with money on the street is seen every quarter. Overdue ones are flagged here and raise an early-warning alert of their own.">
        {canLog && <button className="btn btn-p" onClick={() => setLogging(true)}><Plus size={15} /> Log a visit</button>}
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={MapPin} label="Due now" value={due.length} accent={due.length ? 'amber' : 'lime'}
          sub={due.length ? 'with ' + fmtCr(due.reduce((s, c) => s + c.outstanding, 0)) + ' outstanding' : 'the cadence is met'} />
        <Stat icon={MapPin} label="Within cadence" value={covered.length} accent="lime" sub="seen inside the last quarter" />
        <Stat icon={MapPin} label="Visits logged" value={visits.length} accent="violet" sub="across the whole book" />
        <Stat icon={MapPin} label="Last visit" value={visits.length ? fmtDate(visits[0].date) : '—'} accent="cyan"
          sub={visits.length ? visits[0].borrowerName : 'none logged yet'} />
      </div>

      {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
        <>
          <Card title="Cadence" subtitle="Every borrower with live exposure, and when they were last seen">
            <Table loading={loading} rows={cadence.map((c) => ({ ...c, id: c.borrowerId }))}
              cols={['Borrower', '#Outstanding', 'Last visit', 'Days since', 'Status', '']}
              empty={<Empty icon={MapPin} title="No borrowers on the book">Sanction a facility first.</Empty>}
              render={(c) => (
                <>
                  <td>
                    <button className="text-left font-medium text-slate-200 hover:text-neon-violet" onClick={() => nav('/borrowers/' + c.borrowerId)}>
                      {c.name}
                    </button>
                  </td>
                  <Td r className={c.outstanding > 0 ? 'text-slate-100' : 'text-slate-600'}>{fmt(c.outstanding)}</Td>
                  <Td className="whitespace-nowrap text-slate-500">{c.lastVisit ? fmtDate(c.lastVisit) : 'never'}</Td>
                  <Td className={c.daysSince > 92 ? 'text-neon-amber' : 'text-slate-500'}>
                    {c.daysSince == null ? '—' : c.daysSince + 'd'}
                  </Td>
                  <Td>{c.due ? <Chip cls="chip-warn">visit due</Chip>
                    : c.outstanding > 0.5 ? <Chip cls="chip-good">within cadence</Chip>
                      : <Chip cls="chip-slate">no exposure</Chip>}</Td>
                  <Td>{canLog && c.due && <button className="btn btn-xs" onClick={() => setLogging(c)}>Log a visit</button>}</Td>
                </>
              )} />
          </Card>

          <Card title="Visit log">
            <Table loading={loading} rows={visits} cols={['Date', 'Borrower', 'Visited by', 'What was seen']}
              empty={<Empty icon={MapPin} title="No visits logged yet">
                The first one you record answers the cadence alert for that borrower.
              </Empty>}
              render={(v) => (
                <>
                  <Td className="whitespace-nowrap text-slate-400">{fmtDate(v.date)}</Td>
                  <td>
                    <button className="text-left text-slate-200 hover:text-neon-violet" onClick={() => nav('/borrowers/' + v.borrowerId)}>
                      {v.borrowerName}
                    </button>
                  </td>
                  <Td className="text-slate-400">{v.visitedBy}</Td>
                  <td className="max-w-[34rem] text-[13px] text-slate-300">{v.notes}</td>
                </>
              )} />
          </Card>
        </>
      )}

      {logging && (
        <LogVisit borrowers={cadence} preset={logging.borrowerId} onClose={() => setLogging(false)}
          onDone={() => { setLogging(false); toast('Visit logged.'); reload(); }} />
      )}
    </div>
  );
}

function LogVisit({ borrowers, preset, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ borrowerId: preset ? String(preset) : '', date: today(), visitedBy: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    try { await api.logVisit({ ...f, borrowerId: +f.borrowerId }); onDone(); }
    catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  return (
    <Modal title="Log a site visit" size="lg" onClose={onClose}
      subtitle="What you saw is the point — stock on the floor, people at their desks, whether the story matches the numbers."
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-p" disabled={busy || !f.borrowerId || !f.notes.trim()} onClick={save}>
          {busy && <Spinner />}Log the visit
        </button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Borrower">
          <select className="inp" value={f.borrowerId} onChange={set('borrowerId')}>
            <option value="">— select —</option>
            {borrowers.map((b) => <option key={b.borrowerId} value={b.borrowerId}>{b.name}{b.due ? ' — due' : ''}</option>)}
          </select>
        </Field>
        <Field label="Visit date"><input className="inp" type="date" max={today()} value={f.date} onChange={set('date')} /></Field>
        <Field label="Visited by" className="sm:col-span-2" hint="Leave blank to record it against yourself.">
          <input className="inp" value={f.visitedBy} onChange={set('visitedBy')} />
        </Field>
        <Field label="What you saw" className="sm:col-span-2">
          <textarea className="inp min-h-32" value={f.notes} onChange={set('notes')}
            placeholder="e.g. Warehouse at Pinjore — roughly 60% stocked, dispatch running two shifts. Stock register matched the MIS to within a week. Promoter present." />
        </Field>
      </div>
    </Modal>
  );
}
