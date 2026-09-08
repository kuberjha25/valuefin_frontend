import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart } from 'lucide-react';
import { api } from '../api.js';
import { Card, Chip, Empty, ErrorNote, KV, Meter, PageHead, Spinner, Stat, Table, Td } from '../ui.jsx';
import { SMA } from './Accounts.jsx';
import { useLoad } from '../hooks.js';
import { fmt, fmtCr, pct } from '../format.js';

/* The three questions a credit committee opens with: what are we lent against,
   how much of it is going bad, and where is it concentrated. */
export default function PortfolioRisk() {
  const nav = useNavigate();
  const { data, error, loading, reload } = useLoad(() => api.risk(), []);

  if (loading) return <div className="py-16 text-center"><Spinner size={20} /></div>;
  if (error) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;
  if (!data) return null;

  const { caps, vcConcentration: vc } = data;
  const stressed = data.classification.filter((c) => c.key !== 'Standard').reduce((s, c) => s + c.outstanding, 0);

  return (
    <div className="space-y-5">
      <PageHead icon={PieChart} title="Portfolio & risk"
        subtitle="Product mix, RBI IRACP asset classification and the §7 concentration tests, computed live off the book as at today." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={PieChart} label="Live outstanding" value={fmtCr(data.totalOutstanding)} accent="violet" sub={'as at ' + data.asOf} />
        <Stat icon={PieChart} label="NPA ratio" value={pct(data.npaRatio, 2)} accent={data.npaRatio > 0 ? 'pink' : 'lime'}
          sub="outstanding more than ninety days past tenure" />
        <Stat icon={PieChart} label="Stressed but performing" value={fmtCr(stressed)} accent="amber"
          sub="anything in an SMA bucket" />
        <Stat icon={PieChart} label="Bullet share" value={pct(caps.bullet.pct)} accent="cyan"
          sub={'§7 caps this at ' + caps.bullet.limitPct + '% of the live book'}
          chart={<Meter value={caps.bullet.pct} max={caps.bullet.limitPct} />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Asset classification" subtitle="RBI IRACP — Standard, then SMA-0 to SMA-2, then non-performing">
          <Table cols={['Bucket', '#Tranches', '#Outstanding', '#Share']} rows={data.classification}
            render={(c) => (
              <>
                <Td><Chip cls={SMA[c.key] || 'chip-slate'}>{c.label}</Chip></Td>
                <Td r>{c.count}</Td>
                <Td r className={c.key === 'NPA' && c.outstanding > 0 ? 'font-semibold text-rose-300' : ''}>{fmt(c.outstanding)}</Td>
                <Td r className="text-slate-400">{c.share}%</Td>
              </>
            )} />
        </Card>

        <Card title="Product mix" subtitle="What the live book is lent against">
          <Table cols={['Product', '#Tranches', '#Outstanding', 'Share']} rows={data.productMix.map((p) => ({ ...p, id: p.key }))}
            empty="Nothing outstanding."
            render={(p) => (
              <>
                <td className="text-slate-200">{p.label}</td>
                <Td r>{p.count}</Td>
                <Td r>{fmt(p.outstanding)}</Td>
                <td className="w-32"><Meter value={p.share} max={100} /><span className="num mt-1 block text-[11px] text-slate-500">{p.share}%</span></td>
              </>
            )} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Largest exposures" subtitle="Outstanding principal by borrower">
          <Table cols={['Borrower', '#Outstanding', 'Share of book']} rows={data.topExposures.map((x) => ({ ...x, id: x.borrowerId }))}
            empty={<Empty title="No live exposure">Nothing is currently drawn.</Empty>}
            render={(x) => (
              <>
                <td>
                  <button className="text-left font-medium text-slate-200 hover:text-neon-violet" onClick={() => nav('/borrowers/' + x.borrowerId)}>
                    {x.name}
                  </button>
                </td>
                <Td r>{fmt(x.outstanding)}</Td>
                <td className="w-36"><Meter value={x.share} max={100} /><span className="num mt-1 block text-[11px] text-slate-500">{x.share}%</span></td>
              </>
            )} />
        </Card>

        <Card title="Ageing of open principal" subtitle="Days past tenure">
          <Table cols={['Bucket', '#Tranches', '#Outstanding']} rows={data.ageing.map((a) => ({ ...a, id: a.key }))}
            render={(a) => (
              <>
                <td className="text-slate-200">{a.label}</td>
                <Td r>{a.count}</Td>
                <Td r className={a.key !== 'current' && a.amount > 0 ? 'text-rose-300' : ''}>{fmt(a.amount)}</Td>
              </>
            )} />
        </Card>
      </div>

      <Card title="VC / investor concentration"
        subtitle={vc.active
          ? 'Deviation band above ' + vc.warnPct + '%, hard stop above ' + vc.maxPct + '% of the live book'
          : 'Advisory only — the caps activate once the live book reaches ' + fmtCr(vc.minBook)}>
        <Table cols={['Fund', 'Borrowers', '#Exposure', '#Share', 'Status']} rows={vc.rows.map((r) => ({ ...r, id: r.vc }))}
          empty={<Empty title="No live exposure carries a VC tag">Tag the backing fund on a borrower or an application.</Empty>}
          render={(r) => (
            <>
              <td className="font-medium text-slate-100">{r.vc}</td>
              <Td className="text-[12px] text-slate-500">{r.borrowers.join(', ')}</Td>
              <Td r>{fmt(r.exposure)}</Td>
              <Td r className="font-semibold text-slate-100">{r.pct}%</Td>
              <Td>
                <Chip cls={r.band === 'hard' ? 'chip-bad' : r.band === 'deviation' ? 'chip-warn' : 'chip-good'}>
                  {r.band === 'hard' ? 'above the hard cap' : r.band === 'deviation' ? 'deviation band' : 'within ' + vc.warnPct + '%'}
                </Chip>
              </Td>
            </>
          )} />
      </Card>

      <Card title="§7 caps" subtitle="Non-deviatable — the policy check enforces these as hard gates">
        <KV k={'Bullet aggregate ≤ ' + caps.bullet.limitPct + '% of the live book'}
          v={<span className={caps.bullet.pct > caps.bullet.limitPct ? 'text-rose-300' : 'text-emerald-300'}>
            {fmt(caps.bullet.outstanding)} · {caps.bullet.pct}%
          </span>} />
        <KV k={'Single borrower ≤ ' + caps.singleBorrower.limitPct + '% of Net Owned Funds'}
          v={caps.singleBorrower.active
            ? (caps.singleBorrower.breaches.length
              ? <span className="text-rose-300">{caps.singleBorrower.breaches.length} breach(es) against a cap of {fmt(caps.singleBorrower.cap)}</span>
              : <span className="text-emerald-300">within the cap of {fmt(caps.singleBorrower.cap)}</span>)
            : 'inactive — record Net Owned Funds under Settings to switch it on'} />
        {!!caps.singleBorrower.breaches.length && (
          <div className="mt-3 space-y-1.5">
            {caps.singleBorrower.breaches.map((b) => (
              <div key={b.borrowerId} className="rounded-xl border border-state-bad/25 bg-state-bad/[.06] px-3 py-2 text-[12px] text-rose-100">
                {b.name} is at {fmt(b.outstanding)}, above the {fmt(caps.singleBorrower.cap)} cap.
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
