import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useToast } from '../../../ui.jsx';

/* Run an API action with one busy flag, a toast and a refresh, so every
   button in the workspace behaves the same on success and on failure. */
export function useAction(refresh) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const r = await fn();
      if (r && r.analysis === 'stale') toast('Saved, but the analysis re-run failed: ' + r.analysisError, 'err');
      else if (okMsg) toast(okMsg);
      if (refresh) refresh();
      return r || true;
    } catch (e) { toast(e.message, 'err'); return null; }
    finally { setBusy(false); }
  };
  return [busy, run];
}

/* Evidence references: [{ type: fact|doc|txn|check, id }]. */
export function RefPicker({ value, onChange }) {
  const [type, setType] = useState('fact');
  const [rid, setRid] = useState('');
  const add = () => {
    const n = Number(rid);
    if (!Number.isInteger(n) || n <= 0) return;
    if (!value.some((r) => r.type === type && r.id === n)) onChange([...value, { type, id: n }]);
    setRid('');
  };
  return (
    <div>
      <div className="flex gap-2">
        <select className="inp w-28" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="fact">Fact</option><option value="doc">File version</option><option value="txn">Transaction</option><option value="check">Public check</option>
        </select>
        <input className="inp" value={rid} onChange={(e) => setRid(e.target.value)} placeholder="ID number" inputMode="numeric"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="btn shrink-0" onClick={add}><Plus size={14} /> Add</button>
      </div>
      {!!value.length && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((r) => (
            <button key={r.type + r.id} type="button" className="chip-violet" onClick={() => onChange(value.filter((x) => x !== r))}>
              {r.type} #{r.id} <X size={11} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const RefList = ({ refs }) => (refs && refs.length
  ? <span className="text-[11px] text-slate-400">{refs.map((r) => r.type + ' #' + r.id).join(', ')}</span>
  : <span className="text-[11px] text-slate-600">no evidence cited</span>);
