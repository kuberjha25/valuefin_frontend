import React, { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Lock, TriangleAlert } from 'lucide-react';
import { uw } from '../../api.js';
import { useAuth } from '../../App.jsx';
import { Card, Chip, ErrorNote, PageHead, Skeleton, Tabs } from '../../ui.jsx';
import { useLoad, useLocal } from '../../hooks.js';
import { fmtDate } from '../../format.js';
import { CASE_STATUS, rupees } from '../../uwFormat.js';
import Overview from './tabs/Overview.jsx';
import Upload from './tabs/Upload.jsx';
import Evidence from './tabs/Evidence.jsx';
import Analysis from './tabs/Analysis.jsx';
import Investigation from './tabs/Investigation.jsx';
import PolicyMemo from './tabs/PolicyMemo.jsx';
import Approval from './tabs/Approval.jsx';

/* The seven screens of spec §10, as tabs of one case. */
const TABS = [
  ['overview', 'Case'],
  ['upload', 'Upload & coverage'],
  ['evidence', 'Evidence review'],
  ['analysis', 'Analysis'],
  ['investigation', 'Investigation'],
  ['memo', 'Policy & memo'],
  ['approval', 'Approval']
];

export default function CaseWorkspace() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const me = useAuth();
  const [tab, setTab] = useLocal('uw.case.tab', 'overview');
  const { data, error, loading, reload } = useLoad(() => uw.case(id), [id]);
  const { data: meta } = useLoad(() => uw.meta(), []);
  const { data: ready, reload: reloadReady } = useLoad(() => uw.readiness(id), [id]);
  const [tick, setTick] = useState(0);

  /* Anything that changes the case refreshes the header, the readiness gates
     and the active tab's own data. */
  const refresh = useCallback(() => { reload(); reloadReady(); setTick((t) => t + 1); }, [reload, reloadReady]);

  if (error) return <Card><ErrorNote onRetry={reload}>{error}</ErrorNote></Card>;
  if (!data || !meta) return <div className="space-y-4"><Skeleton className="h-10 w-80" /><Skeleton className="h-64" /></div>;

  const c = data.case;
  const st = CASE_STATUS[c.status] || {};
  const blocking = ready ? ready.gates.filter((g) => g.severity === 'block' && !g.ok).length : null;
  const shared = { id, c, party: data.party, detail: data, meta, me, editable: data.editable, refresh, tick, ready, setTab };

  return (
    <div className="space-y-5">
      <Link to="/uw/cases" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-200"><ArrowLeft size={14} /> All cases</Link>
      <PageHead title={data.party.legalName}
        subtitle={<span className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-400">
          <span className="font-mono text-slate-300">{c.caseCode}</span>
          <span>{c.product}</span>
          <span>requested {rupees(c.requestedPaise)} for {c.tenorDays} days</span>
          <span>revision {c.revision}</span>
          <span>analyst {c.analystName || '—'}</span>
          {c.dueDate && <span>due {fmtDate(c.dueDate)}</span>}
        </span>}>
        <Chip cls={st.cls}>{st.label || c.status}</Chip>
      </PageHead>

      {!data.editable && (
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-slate-300">
          <Lock size={16} className="mt-0.5 shrink-0 text-slate-400" />
          {['submitted', 'recommended'].includes(c.status)
            ? 'The submitted snapshot is frozen while the case is under review. Uploading new evidence starts a new revision and review cycle.'
            : 'This case has been decided and is locked. Open a new case linked to it for a renewal or change.'}
        </div>
      )}
      {loading ? null : ready && (
        <button onClick={() => setTab('approval')}
          className={'flex w-full items-center gap-2 rounded-2xl border px-4 py-2.5 text-left text-sm transition hover:bg-white/[.04] '
            + (blocking ? 'border-neon-amber/30 text-amber-100' : 'border-state-good/30 text-emerald-200')}>
          {blocking ? <TriangleAlert size={16} /> : <CheckCircle2 size={16} />}
          {blocking ? blocking + ' item(s) block submission — see Approval.' : 'All submission gates pass.'}
        </button>
      )}

      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'overview' && <Overview {...shared} />}
      {tab === 'upload' && <Upload {...shared} />}
      {tab === 'evidence' && <Evidence {...shared} />}
      {tab === 'analysis' && <Analysis {...shared} />}
      {tab === 'investigation' && <Investigation {...shared} />}
      {tab === 'memo' && <PolicyMemo {...shared} />}
      {tab === 'approval' && <Approval {...shared} />}
    </div>
  );
}
