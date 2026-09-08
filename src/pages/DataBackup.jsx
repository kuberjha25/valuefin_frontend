import React, { useState } from 'react';
import { Database, Download, ShieldAlert } from 'lucide-react';
import { api, backupUrl } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, ErrorNote, KV, PageHead, Spinner, Table, Td } from '../ui.jsx';
import { useLoad } from '../hooks.js';
import { fmtNum } from '../format.js';

const LABEL = {
  borrowers: 'Borrowers', limit_history: 'Limit enhancements', drawdowns: 'Drawdowns', payments: 'Payments',
  credit_applications: 'Applications', documents: 'Document records', investors: 'Investor tiers',
  app_settings: 'Credit-policy settings', audit_log: 'Audit trail', users: 'Staff accounts'
};

/* A backup is the lending record, not a credentials dump: staff export without
   their password hashes, and live sessions are left behind entirely. The audit
   trail travels with it, because a record is only examinable if its history
   comes too. */
export default function DataBackup() {
  const me = useAuth();
  const isDirector = me.role === 'director';
  const [taking, setTaking] = useState(false);
  const { data, error, loading, reload } = useLoad(
    () => (me.role === 'director' ? api.backupPreview() : Promise.resolve(null)), []);

  if (!isDirector) {
    return (
      <div className="space-y-5">
        <PageHead icon={Database} title="Data & backup" subtitle="Exporting the book is a Director control." />
        <Card><Empty icon={ShieldAlert} title="Only a Director can take a backup">
          A backup contains the whole lending record, so the export is restricted.
        </Empty></Card>
      </div>
    );
  }

  const take = () => {
    setTaking(true);
    window.location.href = backupUrl();
    setTimeout(() => setTaking(false), 2500);
  };

  const rows = data ? Object.entries(data.tables).map(([k, n]) => ({ id: k, table: k, label: LABEL[k] || k, count: n })) : [];

  return (
    <div className="space-y-5">
      <PageHead icon={Database} title="Data & backup"
        subtitle="The whole book as one JSON file — every borrower, drawdown, payment, application and audit row, in the order a restore would replay them.">
        <button className="btn btn-p" onClick={take} disabled={taking || !data}>
          {taking ? <Spinner /> : <Download size={15} />} Download backup
        </button>
      </PageHead>

      {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <Card title="What the file will contain" subtitle={data ? fmtNum(data.total) + ' rows in total' : 'Counting…'}>
            <Table loading={loading} rows={rows} cols={['Table', '#Rows']}
              render={(r) => (
                <>
                  <td className="text-slate-200">{r.label}
                    <span className="mt-0.5 block font-mono text-[10px] text-slate-600">{r.table}</span>
                  </td>
                  <Td r className={r.count ? 'text-slate-100' : 'text-slate-600'}>{fmtNum(r.count)}</Td>
                </>
              )} />
          </Card>

          <div className="space-y-5">
            <Card title="What it deliberately leaves out">
              <KV k="Password hashes" v={<Chip cls="chip-good">excluded</Chip>} />
              <KV k="Active sessions" v={<Chip cls="chip-good">excluded</Chip>} />
              <KV k="Stored PDFs" v={data ? fmtNum(data.storedFiles) + ' files stay on disk' : '—'} />
              <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
                Staff accounts export with their name, email and role but never their password hash, so the file can be
                handed to an auditor without handing over the means to sign in. The uploaded PDFs are not inlined —
                they live under <span className="font-mono text-[11px]">backend/data/customers</span> and are backed up
                by copying that folder alongside this file.
              </p>
            </Card>

            <Card title="Keeping a usable backup">
              <ol className="space-y-2 text-sm text-slate-400">
                {['Download the JSON — it is a point-in-time copy, so take one before any large change.',
                  'Copy the backend/data folder at the same moment, so the records and the files they point at match.',
                  'Keep both together. A JSON without its folder restores the ledger but leaves every document link broken.'].map((t, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[.07] text-[10px] font-bold text-slate-400">{i + 1}</span>
                    <span className="leading-snug">{t}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
