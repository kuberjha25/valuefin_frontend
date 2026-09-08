import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, ChevronRight, History, Inbox } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, ErrorNote, PageHead, Table, Td } from '../ui.jsx';
import { useLoad } from '../hooks.js';
import { fmtAgo, fmtDate } from '../format.js';

const KIND = {
  CAM: 'chip-violet',
  Deviation: 'chip-warn',
  Document: 'chip-cyan'
};

/* Everything waiting on a checker, from whichever table raised it. The row
   links to the screen that owns the record — the decision itself is always
   taken in context, never from the queue. */
export default function Approvals() {
  const me = useAuth();
  const nav = useNavigate();
  const { data, error, loading, reload } = useLoad(() => api.approvals(), []);
  const isDirector = me.role === 'director';

  const pending = (data && data.pending) || [];
  const recent = (data && data.recent) || [];

  return (
    <div className="space-y-5">
      <PageHead icon={BadgeCheck} title="Approvals"
        subtitle={isDirector
          ? 'Your queue — CAMs, §9 deviations and uploaded documents, oldest first. Open a row to decide it in context.'
          : 'What is currently with the Director. Read-only for your role; the decision is theirs to take.'}>
        <Chip cls={pending.length ? 'chip-warn' : 'chip-good'}>{pending.length} pending</Chip>
      </PageHead>

      <Card title="Waiting on a decision" subtitle={pending.length
        ? 'The oldest item has been waiting since ' + fmtDate(pending[0].ts, true)
        : 'Nothing is queued.'}>
        {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
          <Table loading={loading} rows={pending.map((p, i) => ({ ...p, id: p.ref + i }))}
            cols={['Item', 'Kind', 'Raised by', 'Waiting', '']}
            empty={<Empty icon={Inbox} title="Nothing pending">
              Every CAM, deviation and document has been dealt with.
            </Empty>}
            render={(p) => (
              <>
                <td>
                  <button className="group text-left" onClick={() => nav(p.link)}>
                    <span className="block font-semibold text-slate-100 transition group-hover:text-neon-violet">{p.title}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">{p.detail}</span>
                  </button>
                </td>
                <Td><Chip cls={KIND[p.kind] || 'chip-slate'}>{p.kind}</Chip></Td>
                <Td className="text-slate-400">{p.raisedBy || '—'}</Td>
                <Td className="whitespace-nowrap text-slate-500" title={fmtDate(p.ts, true)}>{fmtAgo(p.ts)}</Td>
                <Td>
                  <button className="btn btn-ghost btn-xs" onClick={() => nav(p.link)} aria-label={'Open ' + p.title}>
                    <ChevronRight size={16} />
                  </button>
                </Td>
              </>
            )} />
        )}
      </Card>

      <Card title="Recent decisions" subtitle="Straight from the audit trail — who decided what, and when.">
        <Table loading={loading} rows={recent} cols={['When', 'Who', 'Action', 'Summary']}
          empty={<Empty icon={History} title="No decisions yet">
            Approvals and rejections appear here as soon as the first one is taken.
          </Empty>}
          render={(r) => (
            <>
              <Td className="whitespace-nowrap text-slate-500" title={fmtDate(r.createdAt, true)}>{fmtAgo(r.createdAt)}</Td>
              <Td className="text-slate-300">{r.userName} <span className="text-slate-600">{r.role}</span></Td>
              <Td><Chip cls="chip-slate">{r.action.replace('application.', '').replace('document.', '')}</Chip></Td>
              <td className="text-slate-400">{r.summary}</td>
            </>
          )} />
      </Card>
    </div>
  );
}
