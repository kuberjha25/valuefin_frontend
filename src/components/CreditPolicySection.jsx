import React, { useEffect, useState } from 'react';
import { Building2, Plus, Save, Scale, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { Card, Chip, Empty, ErrorNote, Field, KV, Spinner, Table, Td, useToast } from '../ui.jsx';
import { useLoad } from '../hooks.js';
import { fmt, fmtCr, LOS_PRODUCT } from '../format.js';

/* ============================================================================
   Credit-policy configuration, rendered as Settings cards.

   These are the numbers a Director is allowed to move — the penal spread, GST,
   the policy version stamped on every run, Net Owned Funds, the §7 concentration
   bands, the mandatory checklists and the scorecard weights. Everyone can read
   them, because they explain the gates that appear on an application; only a
   Director can save. A change applies to the next policy run — a check already
   on a file keeps the values it was run under.
   ========================================================================== */

const GROUPS = [
  ['common', 'Checklist — common to every product'],
  ['quick_cash', 'Checklist — Quick Cash'],
  ['rocket_fuel', 'Checklist — Rocket Fuel'],
  ['bullet', 'Checklist — Bullet']
];

export default function CreditPolicySection({ isDirector }) {
  const { data: cfg, error, loading, reload } = useLoad(() => api.settings(), []);
  const toast = useToast();

  if (loading) return <Card title="Credit policy"><p className="py-4 text-sm text-slate-500"><Spinner /> Loading…</p></Card>;
  if (error) return <Card title="Credit policy"><ErrorNote onRetry={reload}>{error}</ErrorNote></Card>;
  if (!cfg) return null;

  const shared = { cfg, isDirector, toast, reload };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <span className="grid h-8 w-8 place-items-center rounded-xl border border-neon-indigo/25 bg-neon-indigo/15">
          <Scale size={16} className="text-neon-violet" />
        </span>
        <h2 className="h2">Credit policy</h2>
        <Chip cls="chip-slate">v{cfg.policy.policyVersion}</Chip>
        {!isDirector && <Chip cls="chip-slate">read-only for your role</Chip>}
        <p className="w-full text-sm text-slate-400">
          The gates, caps, checklists and weights every application is measured against. Changes apply to the next
          policy run; a check already on a file keeps the values it used.
        </p>
      </div>

      <Defaults {...shared} />
      <Reference cfg={cfg} />
      <Checklists {...shared} />
      <Weights {...shared} />
      <InvestorTiers isDirector={isDirector} toast={toast} />
    </div>
  );
}

/* ---------------- defaults and the §7 caps ---------------- */
function Defaults({ cfg, isDirector, toast, reload }) {
  const [f, setF] = useState(() => ({ ...cfg.policy }));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF({ ...cfg.policy }); }, [cfg.policy]);
  const set = (key) => (e) => setF((s) => ({ ...s, [key]: e.target.value }));

  const save = async () => {
    setBusy(true);
    try {
      await api.savePolicy({
        policyVersion: String(f.policyVersion), penalDefault: +f.penalDefault, gstPct: +f.gstPct,
        nof: +f.nof, vcCapWarnPct: +f.vcCapWarnPct, vcCapMaxPct: +f.vcCapMaxPct, vcCapMinBook: +f.vcCapMinBook
      });
      toast('Credit-policy defaults saved.');
      reload();
    } catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Policy defaults" subtitle="Stamped onto every policy run and carried into each sanction.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Policy version" hint="Printed on the CAM, the sanction letter and every audit row.">
            <input className="inp" disabled={!isDirector} value={f.policyVersion} onChange={set('policyVersion')} />
          </Field>
          <Field label="Penal spread % p.a." hint="Added to the rate on principal past maturity.">
            <input className="inp" type="number" disabled={!isDirector} value={f.penalDefault} onChange={set('penalDefault')} />
          </Field>
          <Field label="GST % on processing fees">
            <input className="inp" type="number" disabled={!isDirector} value={f.gstPct} onChange={set('gstPct')} />
          </Field>
          <Field label="Net Owned Funds (₹)" hint="Setting this activates the §7 single-borrower cap of 5% of NOF.">
            <input className="inp" type="number" disabled={!isDirector} value={f.nof} onChange={set('nof')} />
          </Field>
        </div>
      </Card>

      <Card title="§7 concentration caps" subtitle="Non-deviatable, and only enforced once the book is large enough for a percentage to mean anything.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="VC deviation band from (%)">
            <input className="inp" type="number" disabled={!isDirector} value={f.vcCapWarnPct} onChange={set('vcCapWarnPct')} />
          </Field>
          <Field label="VC hard stop above (%)">
            <input className="inp" type="number" disabled={!isDirector} value={f.vcCapMaxPct} onChange={set('vcCapMaxPct')} />
          </Field>
          <Field label="Caps activate once the live book reaches (₹)" className="sm:col-span-2">
            <input className="inp" type="number" disabled={!isDirector} value={f.vcCapMinBook} onChange={set('vcCapMinBook')} />
          </Field>
        </div>
        <div className="mt-3">
          <KV k="Single borrower" v={+f.nof ? '≤ ' + fmtCr(+f.nof * 0.05) + ' — 5% of NOF' : 'inactive until NOF is set'} />
          <KV k="Bullet aggregate" v="≤ 25% of the live book" />
          <KV k="Activation floor" v={fmtCr(+f.vcCapMinBook || 0)} />
        </div>
        {isDirector && (
          <button className="btn btn-p mt-4 w-full" disabled={busy} onClick={save}>
            {busy ? <Spinner /> : <Save size={15} />} Save policy defaults
          </button>
        )}
      </Card>
    </div>
  );
}

/* ---------------- read-only policy reference ---------------- */
function Reference({ cfg }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Products" subtitle="Floors, ranges and ticket sizes are written policy — they are not editable here.">
        <Table cols={['Product', 'Floor', 'Range', '#Minimum', '#Maximum']} rows={cfg.catalogue.products}
          render={(p) => (
            <>
              <td>
                <b className="text-slate-100">{p.name}</b>
                <span className="mt-0.5 block text-[11px] text-slate-500">{(LOS_PRODUCT[p.key] || {}).blurb}</span>
              </td>
              <Td>{p.floor}%</Td>
              <Td>{p.rateRange.join('–')}%</Td>
              <Td r>{fmt(p.min)}</Td>
              <Td r>{fmt(p.max)}</Td>
            </>
          )} />
        <p className="mt-3 text-[11px] text-slate-500">
          No-go sectors: {cfg.catalogue.noGo.join(' · ')}. Any of them is an absolute hard stop.
        </p>
      </Card>

      <Card title="Approval authority (§8)" subtitle="Total group exposure after the loan decides who signs.">
        <Table cols={['Exposure up to', 'Authority']} rows={cfg.catalogue.approvalMatrix.map((t, i) => ({ ...t, id: i }))}
          render={(t) => (
            <>
              <Td>{t.max == null ? 'Above ₹1 Cr' : fmt(t.max)}</Td>
              <td className="text-slate-200">{t.authority}</td>
            </>
          )} />
        <p className="mt-3 text-[11px] text-slate-500">
          Pricing below a product floor goes to the Board regardless of size, and a §9 deviation is approved one level
          above the row that would otherwise apply. Compensating controls offered: {cfg.catalogue.deviationControls.length}.
        </p>
      </Card>
    </div>
  );
}

/* ---------------- document checklists ---------------- */
function Checklists({ cfg, isDirector, toast, reload }) {
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState('');

  const add = async (group) => {
    const label = String(drafts[group] || '').trim();
    if (!label) return;
    setBusy(group);
    try {
      await api.addChecklistItem(group, { label, mandatory: true });
      setDrafts((s) => ({ ...s, [group]: '' }));
      toast('Added to the checklist.');
      reload();
    } catch (e) { toast(e.message, 'err'); }
    finally { setBusy(''); }
  };
  const remove = async (group, key) => {
    try { await api.removeChecklistItem(group, key); toast('Removed.'); reload(); }
    catch (e) { toast(e.message, 'err'); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {GROUPS.map(([group, title]) => (
        <Card key={group} title={title}
          subtitle="A new application of this product starts with these rows; each mandatory one holds the file in Docs Pending.">
          <div className="divide-y divide-white/[.06]">
            {(cfg.docChecklist[group] || []).map((d) => (
              <div key={d.key} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 text-sm text-slate-200">{d.label}</span>
                {isDirector && (
                  <button className="btn btn-ghost btn-xs" onClick={() => remove(group, d.key)} aria-label={'Remove ' + d.label}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
            {!(cfg.docChecklist[group] || []).length && <p className="py-3 text-sm text-slate-500">Nothing on this list.</p>}
          </div>
          {isDirector && (
            <div className="mt-3 flex gap-2">
              <input className="inp" placeholder="Add a document label" value={drafts[group] || ''}
                onChange={(e) => setDrafts((s) => ({ ...s, [group]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') add(group); }} />
              <button className="btn shrink-0" disabled={busy === group} onClick={() => add(group)}>
                {busy === group ? <Spinner /> : <Plus size={14} />} Add
              </button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

/* ---------------- scorecard weights ---------------- */
function Weights({ cfg, isDirector, toast, reload }) {
  const [w, setW] = useState(() => JSON.parse(JSON.stringify(cfg.scoreWeights)));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setW(JSON.parse(JSON.stringify(cfg.scoreWeights))); }, [cfg.scoreWeights]);

  const set = (product, key, value) => setW((s) => ({
    ...s, [product]: s[product].map((row) => (row.key === key ? { ...row, weight: value } : row))
  }));
  const save = async () => {
    setBusy(true);
    try { await api.saveWeights(w); toast('Scorecard weights saved.'); reload(); }
    catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Card title="Scorecard weights"
      subtitle="These combine the component scores into the internal grade shown on the policy check and the CAM. Keep each product near 100 so the bands (A ≥ 80 · B ≥ 65 · C ≥ 50) stay meaningful."
      right={isDirector && (
        <button className="btn btn-xs" disabled={busy} onClick={save}>
          {busy ? <Spinner /> : <Save size={12} />} Save weights
        </button>
      )}>
      <div className="grid gap-5 lg:grid-cols-3">
        {Object.entries(w).map(([product, rows]) => {
          const total = rows.reduce((s, r) => s + (+r.weight || 0), 0);
          return (
            <div key={product} className="card-tight">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">
                  {(LOS_PRODUCT[product] || {}).label || product}
                </p>
                <Chip cls={total === 100 ? 'chip-good' : 'chip-warn'}>{total}%</Chip>
              </div>
              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.key} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 text-[13px] text-slate-300">{row.label}</span>
                    <input className="inp w-20 text-right" type="number" min="0" max="100" disabled={!isDirector}
                      value={row.weight} onChange={(e) => set(product, row.key, +e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------------- investor tiers ---------------- */
export function InvestorTiers({ isDirector, toast: parentToast }) {
  const ownToast = useToast();
  const toast = parentToast || ownToast;
  const { data, error, loading, reload } = useLoad(() => api.investors(), []);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { await api.addInvestor({ name: name.trim(), tier: 'neutral' }); setName(''); toast('Fund added.'); reload(); }
    catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };
  const grade = async (id, tier) => {
    try { await api.setInvestorTier(id, tier); reload(); }
    catch (e) { toast(e.message, 'err'); }
  };
  const remove = async (id) => {
    try { await api.deleteInvestor(id); toast('Removed.'); reload(); }
    catch (e) { toast(e.message, 'err'); }
  };

  return (
    <Card title="Investor tiers"
      subtitle="Feeds the Rocket Fuel scorecard: the lead investor named on an application is matched against this list. Anything ungraded scores neutral."
      right={isDirector && (
        <div className="flex gap-2">
          <input className="inp w-56" placeholder="Fund name" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
          <button className="btn shrink-0" disabled={busy} onClick={add}>{busy ? <Spinner /> : <Plus size={14} />} Add</button>
        </div>
      )}>
      {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
        <Table loading={loading} rows={data || []} cols={['Fund', 'Tier', 'Scores', '']}
          empty={<Empty icon={Building2} title="No funds graded yet">
            Add the funds you see most often, then grade them — tier 1 scores 90, tier 2 scores 70, neutral scores 50.
          </Empty>}
          render={(i) => (
            <>
              <td className="text-slate-100">{i.name}</td>
              <Td>
                {isDirector ? (
                  <select className="inp w-32" value={i.tier} onChange={(e) => grade(i.id, e.target.value)}>
                    <option value="1">Tier 1</option><option value="2">Tier 2</option><option value="neutral">Neutral</option>
                  </select>
                ) : (
                  <Chip cls={i.tier === '1' ? 'chip-good' : i.tier === '2' ? 'chip-cyan' : 'chip-slate'}>
                    {i.tier === 'neutral' ? 'Neutral' : 'Tier ' + i.tier}
                  </Chip>
                )}
              </Td>
              <Td className="text-slate-400">{i.tier === '1' ? '90 / 100' : i.tier === '2' ? '70 / 100' : '50 / 100'}</Td>
              <Td>{isDirector && (
                <button className="btn btn-ghost btn-xs" onClick={() => remove(i.id)} aria-label={'Remove ' + i.name}>
                  <Trash2 size={12} />
                </button>
              )}</Td>
            </>
          )} />
      )}
    </Card>
  );
}
