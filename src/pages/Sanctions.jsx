import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileSignature, FileText, Printer } from 'lucide-react';
import { api, openLetter } from '../api.js';
import { Card, Chip, Empty, ErrorNote, PageHead, Stat, Table, Td } from '../ui.jsx';
import { ProductChip } from '../components/LosChips.jsx';
import { useLoad } from '../hooks.js';
import { fmt, fmtCr, fmtDate } from '../format.js';

/* Everything that has been sanctioned, with the paperwork it generated. The
   letter and the agreement are produced from the sanction record itself, so
   they can never state terms the facility does not carry. */
export default function Sanctions() {
  const nav = useNavigate();
  const { data, error, loading, reload } = useLoad(() => api.applications({}), []);

  const sanctioned = (data || []).filter((a) => a.sanction)
    .sort((a, b) => String(b.sanction.sanctionDate).localeCompare(String(a.sanction.sanctionDate)));
  const total = sanctioned.reduce((s, a) => s + a.sanction.amount, 0);
  const thisYear = sanctioned.filter((a) => String(a.sanction.sanctionDate) >= new Date().getFullYear() + '-01-01');

  return (
    <div className="space-y-5">
      <PageHead icon={FileSignature} title="Sanctions & documents"
        subtitle="Every sanctioned facility with its letter and draft agreement. Download, get them signed, then file the signed copies back against the borrower." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FileSignature} label="Facilities sanctioned" value={sanctioned.length} accent="violet"
          sub={thisYear.length + ' this calendar year'} />
        <Stat icon={FileSignature} label="Total sanctioned" value={fmtCr(total)} accent="lime" sub="across every product" />
        <Stat icon={FileText} label="Awaiting sanction terms" value={(data || []).filter((a) => a.stage === 'Approved').length}
          accent="amber" sub="Director-approved, not yet opened" />
        <Stat icon={FileText} label="In origination" value={(data || []).filter((a) => !a.sanction && a.stage !== 'Declined').length}
          accent="cyan" sub="still working through the pipeline" />
      </div>

      <Card title="Sanctioned facilities">
        {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
          <Table loading={loading} rows={sanctioned}
            cols={['Application', 'Product', '#Sanctioned', 'Rate', 'Sanctioned on', 'Expires', 'Paperwork', '']}
            empty={<Empty icon={FileSignature} title="Nothing sanctioned yet">
              An application becomes a facility once the Director approves the CAM and the sanction terms are recorded.
            </Empty>}
            render={(a) => (
              <>
                <td>
                  <button className="group text-left" onClick={() => nav('/applications/' + a.id)}>
                    <span className="block font-semibold text-slate-100 transition group-hover:text-neon-violet">{a.legalName}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">{a.appCode} · {a.sanction.tenorDays}-day tranches</span>
                  </button>
                </td>
                <Td><ProductChip product={a.product} label={a.productName} /></Td>
                <Td r className="font-semibold text-slate-100">{fmt(a.sanction.amount)}</Td>
                <Td>
                  {a.sanction.rate}%
                  {!!a.sanction.pricingBump && <span className="mt-0.5 block text-[11px] text-neon-amber">incl. §9 +{a.sanction.pricingBump}%</span>}
                </Td>
                <Td className="whitespace-nowrap text-slate-500">{fmtDate(a.sanction.sanctionDate)}</Td>
                <Td className="whitespace-nowrap text-slate-500">{fmtDate(a.sanction.expiry)}</Td>
                <Td>
                  <span className="flex gap-1.5">
                    <button className="btn btn-xs" onClick={() => openLetter(a.id, 'sanction')} title="Sanction letter"><Printer size={12} /> Letter</button>
                    <button className="btn btn-xs" onClick={() => openLetter(a.id, 'agreement')} title="Draft facility agreement"><FileText size={12} /> Agreement</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => openLetter(a.id, 'sanction', true)} title="Download the letter"><Download size={12} /></button>
                  </span>
                </Td>
                <Td>
                  {a.borrowerId
                    ? <button className="btn btn-xs" onClick={() => nav('/borrowers/' + a.borrowerId)}>Borrower</button>
                    : <Chip cls="chip-slate">no borrower linked</Chip>}
                </Td>
              </>
            )} />
        )}
      </Card>

      <Card title="Getting a sanction signed">
        <ol className="space-y-2 text-sm text-slate-400">
          {['Download the letter and the draft agreement from the row above.',
            'Send them to the borrower and have both executed.',
            'Upload the signed copies against the borrower from the Document Docket — they file into the same folder as everything from origination.',
            'The Director approves the uploads, at which point the file is complete.'].map((t, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[.07] text-[10px] font-bold text-slate-400">{i + 1}</span>
              <span className="leading-snug">{t}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
