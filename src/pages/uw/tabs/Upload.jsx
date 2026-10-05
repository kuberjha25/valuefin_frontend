import React, { useRef, useState } from 'react';
import { CheckCircle2, Download, FileText, FolderUp, RefreshCw, Tag, Upload as UploadIcon, Undo2 } from 'lucide-react';
import { uw, uwFileUrl } from '../../../api.js';
import { Card, Chip, Field, Modal, Spinner, Table, Td, useToast } from '../../../ui.jsx';
import { useLoad } from '../../../hooks.js';
import { fmtBytes, fmtDate } from '../../../format.js';
import { CHECKLIST_STATE, EXTRACTION, INTAKE, label } from '../../../uwFormat.js';
import { useAction } from './common.jsx';

export default function Upload({ id, meta, editable, c, refresh, tick }) {
  const { data: docs, reload } = useLoad(() => uw.documents(id), [id, tick]);
  const { data: list, reload: reloadList } = useLoad(() => uw.checklist(id), [id, tick]);
  const [report, setReport] = useState(null);
  const [classifying, setClassifying] = useState(null);
  const [na, setNa] = useState(null);
  const [busy, run] = useAction(() => { refresh(); reload(); reloadList(); });
  const canUpload = editable || ['submitted', 'recommended'].includes(c.status);

  const docTypeLabel = (k) => (meta.docTypes.find((d) => d.key === k) || {}).label || k;
  const rows = docs || [];
  const tally = rows.reduce((t, d) => { t[d.intakeStatus] = (t[d.intakeStatus] || 0) + 1; return t; }, {});

  return (
    <div className="space-y-5">
      {canUpload && <Dropzone id={id} meta={meta} c={c} onDone={(r) => { setReport(r); refresh(); reload(); reloadList(); }} />}

      {report && (
        <Card title="Upload report" subtitle={report.reopened ? 'The case was under review — a new revision has been opened.' : 'Each file was hashed, type-checked from its bytes and stored unchanged.'}
          right={<button className="btn btn-xs" onClick={() => setReport(null)}>Dismiss</button>}>
          <Table rows={report.report} cols={['File', 'Intake', 'Extraction', 'Reason / action']}
            render={(r) => (<>
              <Td className="text-slate-200">{r.sourcePath || r.name}</Td>
              <Td><Chip cls={INTAKE[r.intake]}>{r.intake}</Chip></Td>
              <Td>{r.extraction ? <Chip cls={EXTRACTION[r.extraction]}>{label(r.extraction)}</Chip> : '—'}</Td>
              <Td className="max-w-lg text-[12px] text-slate-400">{[r.reason, r.action, r.extractionDetail].filter(Boolean).join(' — ') || (r.duplicateOfVersionId ? 'Same bytes as file version #' + r.duplicateOfVersionId : '')}</Td>
            </>)} />
        </Card>
      )}

      <Card title="Coverage checklist" subtitle={'Configured for product "' + c.product + '"' + (c.vintageYears != null ? ' and ' + c.vintageYears + ' years of vintage' : '') + '. Only confirmed classifications count.'}>
        <Table rows={list || []} loading={!list} cols={['Item', 'Required', 'State', 'Detail', '']}
          render={(it) => {
            const s = CHECKLIST_STATE[it.state] || {};
            return (<>
              <Td className="text-slate-200">{it.label}<span className="block text-[11px] text-slate-500">{docTypeLabel(it.docType)}{it.periodRule !== 'none' ? ' · ' + it.periodsRequired + ' ' + (it.periodRule === 'annual' ? 'year(s)' : 'month(s)') : ''}{it.auditedOnly ? ' · audited only' : ''}</span></Td>
              <Td>{it.mandatory ? <Chip cls="chip-slate">mandatory</Chip> : <span className="text-slate-500">optional</span>}</Td>
              <Td><Chip cls={s.cls}>{s.label || it.state}</Chip></Td>
              <Td className="max-w-md text-[12px] text-slate-400">{it.detail}{it.markedBy ? ' — ' + it.markedBy : ''}{it.versions.length ? <span className="block text-slate-500">{it.versions.map((v) => v.name).join(', ')}</span> : null}</Td>
              <Td>{editable && !it.automatic && (it.state === 'not_applicable'
                ? <button className="btn btn-xs" disabled={busy} onClick={() => run(() => uw.clearNa(id, it.itemId), 'Cleared.')}><Undo2 size={12} /> Undo</button>
                : it.state !== 'received' && <button className="btn btn-xs" onClick={() => setNa(it)}>Not applicable</button>)}</Td>
            </>);
          }} />
      </Card>

      <Card title="Documents" subtitle={rows.length + ' file version(s) · ' + Object.entries(tally).map(([k, v]) => v + ' ' + k).join(' · ')}>
        <Table rows={rows} loading={!docs} cols={['File', 'Intake', 'Extraction', 'Classification', '']}
          empty="Nothing uploaded yet."
          render={(d) => (<>
            <Td>
              <span className="block text-slate-100">{d.originalName} <span className="text-[11px] text-slate-500">v{d.version} · #{d.id}</span></span>
              <span className="block text-[11px] text-slate-500">{d.sourcePath && d.sourcePath !== d.originalName ? d.sourcePath + ' · ' : ''}{d.detectedType} · {fmtBytes(d.sizeBytes || 0)} · {d.uploadedBy} · {fmtDate(d.receivedAt, true)}</span>
              {d.sha256 && <span className="block font-mono text-[10px] text-slate-600">SHA-256 {d.sha256.slice(0, 20)}…</span>}
            </Td>
            <Td>
              <Chip cls={INTAKE[d.intakeStatus]}>{d.intakeStatus}</Chip>
              <span className={'mt-1 block text-[11px] ' + (d.scanStatus === 'clean' ? 'text-emerald-300' : 'text-slate-500')}>scan: {label(d.scanStatus)}</span>
              {d.quarantineReason && <span className="mt-1 block max-w-xs text-[11px] text-rose-300">{d.quarantineReason}</span>}
              {d.recoverableAction && <span className="mt-1 block max-w-xs text-[11px] text-amber-200">Fix: {d.recoverableAction}</span>}
              {d.duplicateOfId && <span className="mt-1 block text-[11px] text-slate-500">same bytes as #{d.duplicateOfId}</span>}
            </Td>
            <Td>
              <Chip cls={EXTRACTION[d.extractionStatus]}>{label(d.extractionStatus)}</Chip>
              {d.pageCount ? <span className="block text-[11px] text-slate-500">{d.pageCount} page(s)</span> : null}
              {d.unitCount ? <span className="block text-[11px] text-slate-500">{d.unitCount} line(s)/cell(s)</span> : null}
              {d.extractionDetail && <span className="block max-w-xs text-[11px] text-slate-400">{d.extractionDetail}</span>}
            </Td>
            <Td>
              <span className="block text-slate-200">{docTypeLabel(d.docType)}</span>
              <span className="block text-[11px] text-slate-500">
                {d.classificationConfirmed ? <span className="text-emerald-300">confirmed</span> : <span className="text-amber-300">suggested — confirm</span>}
                {d.auditStatus !== 'unknown' ? ' · ' + d.auditStatus : ''}
                {d.periodEnd ? ' · ' + (d.periodStart ? d.periodStart + ' to ' : 'as at ') + d.periodEnd : ''}
              </span>
              {d.entityName && <span className={'block text-[11px] ' + (d.entityMatch === 'mismatch' ? 'text-rose-300' : 'text-slate-500')}>entity: {d.entityName}{d.entityMatch === 'mismatch' ? ' — does not match' : ''}</span>}
            </Td>
            <Td>
              <span className="flex flex-wrap justify-end gap-1.5">
                {d.hasObject && <a className="btn btn-xs" href={uwFileUrl(id, d.id, !['pdf', 'image'].includes(d.detectedType))} target="_blank" rel="noopener noreferrer">
                  {['pdf', 'image'].includes(d.detectedType) ? <FileText size={12} /> : <Download size={12} />} Open</a>}
                {editable && d.intakeStatus !== 'duplicate' && d.detectedType !== 'zip' && <button className="btn btn-xs" onClick={() => setClassifying(d)}><Tag size={12} /> Classify</button>}
                {editable && d.intakeStatus === 'accepted' && ['failed', 'pending'].includes(d.extractionStatus) && !d.factRefs &&
                  <button className="btn btn-xs" disabled={busy} onClick={() => run(() => uw.reextract(id, d.id), 'Extraction re-run.')}><RefreshCw size={12} /> Re-extract</button>}
              </span>
            </Td>
          </>)} />
      </Card>

      {classifying && <ClassifyModal id={id} meta={meta} v={classifying} onClose={() => setClassifying(null)} onSaved={() => { setClassifying(null); refresh(); reload(); reloadList(); }} />}
      {na && <NaModal it={na} onClose={() => setNa(null)} onSave={async (reason) => { const r = await run(() => uw.markNa(id, na.itemId, reason), 'Marked not applicable.'); if (r) setNa(null); }} busy={busy} />}
    </div>
  );
}

function Dropzone({ id, meta, c, onDone }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const dirRef = useRef(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState('upload');
  const max = meta.limits.maxBatchFiles;

  /* Folders can hold more files than one request allows, so they go up in batches. */
  const send = async (files) => {
    if (!files.length) return;
    if (['submitted', 'recommended'].includes(c.status) && !window.confirm('This case is under review. Uploading new evidence opens a new revision and sends it back to the analyst. Continue?')) return;
    setBusy(true);
    const all = { report: [], reopened: false };
    try {
      for (let i = 0; i < files.length; i += max) {
        const form = new FormData();
        files.slice(i, i + max).forEach((f) => form.append('files', f, f.webkitRelativePath || f.name));
        form.append('source', source);
        const r = await uw.upload(id, form);
        all.report.push(...r.report);
        all.reopened = all.reopened || r.reopened;
      }
      toast(all.report.length + ' file(s) processed.');
      onDone(all);
    } catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); send(Array.from(e.dataTransfer.files || [])); }}
      className={'rounded-3xl border-2 border-dashed px-6 py-8 text-center transition ' + (over ? 'border-neon-violet bg-neon-indigo/10' : 'border-white/12 bg-white/[.02]')}>
      {busy ? <p className="text-sm text-slate-300"><Spinner /> Hashing, checking and extracting…</p> : (<>
        <UploadIcon className="mx-auto mb-2 text-slate-500" size={22} />
        <p className="text-sm text-slate-200">Drop PDFs, scans, Excel, CSV, images or ZIPs here</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Up to {meta.limits.maxFileMb} MB per file · ZIPs up to {meta.limits.zipMaxTotalMb} MB expanded, {meta.limits.zipMaxEntries} files, {meta.limits.zipMaxDepth} level(s) deep ·
          malware scan: {meta.services.malwareScan.configured ? meta.services.malwareScan.note : 'not configured'} · OCR: not configured
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <select className="inp w-48" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
            <option value="upload">Borrower evidence</option>
            <option value="borrower_response">Borrower response</option>
            <option value="public_check">Public check snapshot</option>
          </select>
          <button className="btn btn-p" onClick={() => fileRef.current.click()}><UploadIcon size={14} /> Choose files</button>
          <button className="btn" onClick={() => dirRef.current.click()}><FolderUp size={14} /> Choose folder</button>
        </div>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files); e.target.value = ''; send(f); }} />
        <input ref={dirRef} type="file" multiple webkitdirectory="" directory="" className="hidden" onChange={(e) => { const f = Array.from(e.target.files); e.target.value = ''; send(f); }} />
      </>)}
    </div>
  );
}

function ClassifyModal({ id, meta, v, onClose, onSaved }) {
  const [busy, run] = useAction();
  const { data: bank } = useLoad(() => uw.bank(id), [id]);
  const [f, setF] = useState({
    docType: v.docType === 'unclassified' ? '' : v.docType, auditStatus: v.auditStatus, periodStart: v.periodStart || '', periodEnd: v.periodEnd || '',
    entityName: v.entityName || '', bankAccountId: v.bankAccountId || ''
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const save = async () => {
    const r = await run(() => uw.classify(id, v.id, { ...f, periodStart: f.periodStart || null, periodEnd: f.periodEnd || null, bankAccountId: f.bankAccountId || null }), 'Classification confirmed.');
    if (r) onSaved();
  };
  return (
    <Modal title="Classify document" subtitle={v.originalName} onClose={onClose} size="lg"
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy || !f.docType} onClick={save}>{busy && <Spinner />}<CheckCircle2 size={14} /> Confirm</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Document type"><select className="inp" value={f.docType} onChange={set('docType')}><option value="">— select —</option>
          {meta.docTypes.filter((d) => d.key !== 'unclassified').map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select></Field>
        <Field label="Audit status"><select className="inp" value={f.auditStatus} onChange={set('auditStatus')}>{meta.auditStatuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>
        <Field label="Period start" hint="Blank for an 'as at' document."><input className="inp" type="date" value={f.periodStart} onChange={set('periodStart')} /></Field>
        <Field label="Period end / as at / statement end"><input className="inp" type="date" value={f.periodEnd} onChange={set('periodEnd')} /></Field>
        <Field label="Entity named on the document" hint="Checked against the borrower's legal name and aliases."><input className="inp" value={f.entityName} onChange={set('entityName')} /></Field>
        <Field label="Bank account (statements)"><select className="inp" value={f.bankAccountId} onChange={set('bankAccountId')}><option value="">—</option>
          {((bank && bank.accounts) || []).map((a) => <option key={a.account.id} value={a.account.id}>{a.account.alias}</option>)}</select></Field>
      </div>
    </Modal>
  );
}

function NaModal({ it, onClose, onSave, busy }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Mark not applicable" subtitle={it.label} onClose={onClose} size="sm"
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy || !reason.trim()} onClick={() => onSave(reason)}>Save</button></>}>
      <Field label="Reason" hint="Recorded on the audit trail and carried into the snapshot."><textarea className="inp min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
    </Modal>
  );
}
