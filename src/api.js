/* API client. One place that knows the base URL, the cookie policy and how the
   server reports errors — every page calls through `api`. */
const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4001/api';

async function req(path, opts = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      credentials: 'include',
      ...opts,
      headers: opts.json ? { 'Content-Type': 'application/json', ...(opts.headers || {}) } : opts.headers,
      body: opts.json ? JSON.stringify(opts.json) : opts.body
    });
  } catch (e) {
    const err = new Error('Cannot reach the API on ' + BASE + '. Is the backend running?');
    err.offline = true;
    throw err;
  }
  if (!res.ok) {
    let msg = res.statusText || 'Request failed';
    try { msg = (await res.json()).error || msg; } catch (_) { /* non-JSON error body */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

const qs = (o = {}) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== '' && v != null && v !== false) p.set(k, v); });
  const s = p.toString();
  return s ? '?' + s : '';
};

export const api = {
  get: (p) => req(p),
  post: (p, json) => req(p, { method: 'POST', json }),
  put: (p, json) => req(p, { method: 'PUT', json }),
  del: (p) => req(p, { method: 'DELETE' }),
  upload: (p, form) => req(p, { method: 'POST', body: form }),

  /* ---- auth ---- */
  directory: () => req('/auth/directory'),
  login: (email, password) => req('/auth/login', { method: 'POST', json: { email, password } }),
  logout: () => req('/auth/logout', { method: 'POST', json: {} }),
  me: () => req('/auth/me'),
  changePassword: (current, next) => req('/auth/password', { method: 'POST', json: { current, next } }),
  sessions: () => req('/auth/sessions'),
  revokeOtherSessions: () => req('/auth/sessions/revoke-others', { method: 'POST', json: {} }),

  /* ---- borrowers ---- */
  borrowers: (f) => req('/borrowers' + qs(f)),
  borrower: (id) => req('/borrowers/' + id),
  /* Onboarding is multipart — the facility fields travel with the mandatory
     onboarding PDF so the borrower and its first document are created together. */
  createBorrower: (form) => req('/borrowers', { method: 'POST', body: form }),
  updateBorrower: (id, b) => req('/borrowers/' + id, { method: 'PUT', json: b }),
  deleteBorrower: (id) => req('/borrowers/' + id, { method: 'DELETE' }),
  addLimit: (id, body) => req('/borrowers/' + id + '/limit', { method: 'POST', json: body }),
  deleteLimit: (id, limitId) => req('/borrowers/' + id + '/limit/' + limitId, { method: 'DELETE' }),
  borrowerChecklist: (id) => req('/borrowers/' + id + '/checklist'),

  /* ---- drawdowns & payments ---- */
  drawdowns: (f) => req('/drawdowns' + qs(f)),
  createDrawdown: (d) => req('/drawdowns', { method: 'POST', json: d }),
  updateDrawdown: (id, d) => req('/drawdowns/' + id, { method: 'PUT', json: d }),
  rotateDrawdown: (id, body) => req('/drawdowns/' + id + '/rotate', { method: 'POST', json: body }),
  /* What closing a drawdown on a chosen date would cost, with the working. */
  settlement: (id, f) => req('/drawdowns/' + id + '/settlement' + qs(f)),
  deleteDrawdown: (id) => req('/drawdowns/' + id, { method: 'DELETE' }),

  payments: (f) => req('/payments' + qs(f)),
  previewPayment: (p) => req('/payments/preview', { method: 'POST', json: p }),
  createPayment: (p) => req('/payments', { method: 'POST', json: p }),
  updatePayment: (id, p) => req('/payments/' + id, { method: 'PUT', json: p }),
  deletePayment: (id) => req('/payments/' + id, { method: 'DELETE' }),

  /* ---- reports ---- */
  portfolio: () => req('/portfolio'),
  ledger: (f) => req('/ledger' + qs(f)),
  mis: (id, f) => req('/mis/' + id + qs(f)),
  search: (q) => req('/search' + qs({ q })),
  audit: (f) => req('/audit' + qs(f)),
  navBadges: () => req('/nav-badges'),
  pnl: (f) => req('/pnl' + qs(f)),
  risk: () => req('/risk'),
  approvals: () => req('/approvals'),

  /* ---- documents ---- */
  documents: (f) => req('/documents' + qs(f)),
  documentCounts: () => req('/documents/counts'),
  uploadDocument: (borrowerId, form) => req('/borrowers/' + borrowerId + '/documents', { method: 'POST', body: form }),
  decideDocument: (id, approve, reason) => req('/documents/' + id + '/decide', { method: 'POST', json: { approve, reason } }),
  deleteDocument: (id) => req('/documents/' + id, { method: 'DELETE' }),
  /* Reads the PDF — text layer first, Textract for scans — and summarises it. */
  analyseDocument: (id, refresh) => req('/documents/' + id + '/analyse' + (refresh ? '?refresh=1' : ''), { method: 'POST', json: {} }),

  /* ---- credit cases ---- */
  enhancements: () => req('/enhancements'),
  previewEnhancement: (body) => req('/enhancements/preview', { method: 'POST', json: body }),
  raiseEnhancement: (body) => req('/enhancements', { method: 'POST', json: body }),
  decideEnhancement: (id, approve, note) => req('/enhancements/' + id + '/decide', { method: 'POST', json: { approve, note } }),
  renewals: () => req('/renewals'),
  raiseRenewal: (body) => req('/renewals', { method: 'POST', json: body }),
  decideRenewal: (id, approve, note) => req('/renewals/' + id + '/decide', { method: 'POST', json: { approve, note } }),

  /* ---- capital deployment ---- */
  capital: () => req('/capital'),
  addFunding: (body) => req('/capital/funding', { method: 'POST', json: body }),
  deleteFunding: (id) => req('/capital/funding/' + id, { method: 'DELETE' }),
  addParked: (body) => req('/capital/parked', { method: 'POST', json: body }),
  deleteParked: (id) => req('/capital/parked/' + id, { method: 'DELETE' }),

  /* ---- disbursement queue ---- */
  disbursements: (f) => req('/disbursements' + qs(f)),
  requestDisbursement: (body) => req('/disbursements', { method: 'POST', json: body }),
  decideDisbursement: (id, approve, note) => req('/disbursements/' + id + '/decide', { method: 'POST', json: { approve, note } }),
  executeDisbursement: (id, valueDate) => req('/disbursements/' + id + '/disburse', { method: 'POST', json: { valueDate } }),
  withdrawDisbursement: (id) => req('/disbursements/' + id, { method: 'DELETE' }),

  /* ---- monitoring ---- */
  ews: (f) => req('/ews' + qs(f)),
  scanEws: () => req('/ews/scan', { method: 'POST', json: {} }),
  raiseEws: (body) => req('/ews', { method: 'POST', json: body }),
  acknowledgeEws: (id) => req('/ews/' + id + '/acknowledge', { method: 'POST', json: {} }),
  resolveEws: (id, resolution) => req('/ews/' + id + '/resolve', { method: 'POST', json: { resolution } }),
  requestEwsDocuments: (id, documents) => req('/ews/' + id + '/request-documents', { method: 'POST', json: { documents } }),
  setDrawdownStop: (id, stop, reason) => req('/borrowers/' + id + '/drawdown-stop', { method: 'POST', json: { stop, reason } }),
  visits: (f) => req('/visits' + qs(f)),
  logVisit: (body) => req('/visits', { method: 'POST', json: body }),
  borrowerMis: (f) => req('/borrower-mis' + qs(f)),
  fileBorrowerMis: (body) => req('/borrower-mis', { method: 'POST', json: body }),

  /* ---- notifications ---- */
  notifications: () => req('/notifications'),
  unreadCount: () => req('/notifications/unread-count'),
  readNotification: (id) => req('/notifications/' + id + '/read', { method: 'POST', json: {} }),
  readAllNotifications: () => req('/notifications/read-all', { method: 'POST', json: {} }),

  /* ---- team & admin ---- */
  users: () => req('/users'),
  createUser: (u) => req('/users', { method: 'POST', json: u }),
  updateUser: (id, u) => req('/users/' + id, { method: 'PUT', json: u }),
  resetUserPassword: (id, password) => req('/users/' + id + '/password', { method: 'POST', json: { password } }),
  deleteUser: (id) => req('/users/' + id, { method: 'DELETE' }),
  status: () => req('/admin/status'),
  resetData: () => req('/admin/reset', { method: 'POST', json: { confirm: 'RESET' } }),
  backupPreview: () => req('/admin/backup/preview'),
  /* ---- origination (LOS) ---- */
  applications: (f) => req('/applications' + qs(f)),
  applicationFunnel: () => req('/applications/funnel'),
  application: (id) => req('/applications/' + id),
  createApplication: (body) => req('/applications', { method: 'POST', json: body }),
  updateApplication: (id, body) => req('/applications/' + id, { method: 'PUT', json: body }),
  deleteApplication: (id) => req('/applications/' + id, { method: 'DELETE' }),

  uploadApplicationDoc: (id, form) => req('/applications/' + id + '/documents', { method: 'POST', body: form }),
  addApplicationDocRow: (id, body) => req('/applications/' + id + '/document-rows', { method: 'POST', json: body }),
  removeApplicationDocRow: (id, key) => req('/applications/' + id + '/document-rows/' + encodeURIComponent(key), { method: 'DELETE' }),

  addReceivable: (id, form) => req('/applications/' + id + '/receivables', { method: 'POST', body: form }),
  bulkReceivables: (id, text) => req('/applications/' + id + '/receivables/bulk', { method: 'POST', json: { text } }),
  removeReceivable: (id, paperId) => req('/applications/' + id + '/receivables/' + paperId, { method: 'DELETE' }),
  tenorSuggestion: (id, f) => req('/applications/' + id + '/tenor-suggestion' + qs(f)),

  saveEligibility: (id, body) => req('/applications/' + id + '/eligibility', { method: 'PUT', json: body }),
  runPolicyCheck: (id) => req('/applications/' + id + '/policy-check', { method: 'POST', json: {} }),

  raiseDeviation: (id, body) => req('/applications/' + id + '/deviation', { method: 'POST', json: body }),
  decideDeviation: (id, body) => req('/applications/' + id + '/deviation/decide', { method: 'POST', json: body }),

  startCam: (id) => req('/applications/' + id + '/cam/start', { method: 'POST', json: {} }),
  saveCam: (id, body) => req('/applications/' + id + '/cam', { method: 'PUT', json: body }),
  submitCam: (id, body) => req('/applications/' + id + '/cam/submit', { method: 'POST', json: body || {} }),
  decideCam: (id, approve, note) => req('/applications/' + id + '/cam/decide', { method: 'POST', json: { approve, note } }),
  reworkCam: (id) => req('/applications/' + id + '/cam/rework', { method: 'POST', json: {} }),

  declineApplication: (id, reason) => req('/applications/' + id + '/decline', { method: 'POST', json: { reason } }),
  reopenApplication: (id) => req('/applications/' + id + '/reopen', { method: 'POST', json: {} }),
  sanctionApplication: (id, body) => req('/applications/' + id + '/sanction', { method: 'POST', json: body }),

  /* ---- credit policy configuration ---- */
  settings: () => req('/settings'),
  savePolicy: (body) => req('/settings/policy', { method: 'PUT', json: body }),
  addChecklistItem: (group, body) => req('/settings/checklist/' + group, { method: 'POST', json: body }),
  removeChecklistItem: (group, key) => req('/settings/checklist/' + group + '/' + encodeURIComponent(key), { method: 'DELETE' }),
  saveWeights: (body) => req('/settings/weights', { method: 'PUT', json: body }),
  investors: () => req('/settings/investors'),
  addInvestor: (body) => req('/settings/investors', { method: 'POST', json: body }),
  setInvestorTier: (id, tier) => req('/settings/investors/' + id, { method: 'PUT', json: { tier } }),
  deleteInvestor: (id) => req('/settings/investors/' + id, { method: 'DELETE' }),

  health: () => req('/health')
};

/* ---- Phase 1 underwriting (/api/uw). Amounts go up as rupee strings and come
   back as integer paise, so no figure passes through floating point. ---- */
const C = (id) => '/uw/cases/' + id;
export const uw = {
  meta: () => req('/uw/meta'),
  cases: (f) => req('/uw/cases' + qs(f)),
  createCase: (b) => api.post('/uw/cases', b),
  case: (id) => req(C(id)),
  updateCase: (id, b) => api.put(C(id), b),
  updateParty: (id, b) => api.put(C(id) + '/party', b),
  setTerms: (id, b) => api.put(C(id) + '/terms', b),
  readiness: (id) => req(C(id) + '/readiness'),
  checklist: (id) => req(C(id) + '/checklist'),
  markNa: (id, itemId, reason) => api.post(C(id) + '/checklist/' + itemId + '/not-applicable', { reason }),
  clearNa: (id, itemId) => api.del(C(id) + '/checklist/' + itemId + '/not-applicable'),
  history: (id) => req(C(id) + '/history'),
  snapshot: (id, sid) => req(C(id) + '/snapshots/' + sid),

  upload: (id, form) => api.upload(C(id) + '/documents', form),
  documents: (id) => req(C(id) + '/documents'),
  units: (id, vid, f) => req(C(id) + '/versions/' + vid + '/units' + qs(f)),
  classify: (id, vid, b) => api.put(C(id) + '/versions/' + vid + '/classification', b),
  reextract: (id, vid) => api.post(C(id) + '/versions/' + vid + '/extract', {}),

  facts: (id, all) => req(C(id) + '/facts' + (all ? '?all=1' : '')),
  addFact: (id, b) => api.post(C(id) + '/facts', b),
  correctFact: (id, fid, b) => api.post(C(id) + '/facts/' + fid + '/correct', b),
  reviewFact: (id, fid, status, note) => api.post(C(id) + '/facts/' + fid + '/review', { status, note }),
  factHistory: (id, fid) => req(C(id) + '/facts/' + fid + '/history'),

  run: (id) => api.post(C(id) + '/run', {}),
  results: (id) => req(C(id) + '/results'),
  resolveRecon: (id, rid, b) => api.post(C(id) + '/recons/' + rid + '/resolve', b),
  disposition: (id, code, b) => api.post(C(id) + '/rules/' + encodeURIComponent(code) + '/disposition', b),
  withdrawDisposition: (id, code, kind) => api.del(C(id) + '/rules/' + encodeURIComponent(code) + '/disposition/' + kind),

  bank: (id) => req(C(id) + '/bank'),
  addAccount: (id, b) => api.post(C(id) + '/bank/accounts', b),
  previewImport: (id, b) => api.post(C(id) + '/bank/import/preview', b),
  commitImport: (id, b) => api.post(C(id) + '/bank/import/commit', b),
  ackStatement: (id, sid, note) => api.post(C(id) + '/bank/statements/' + sid + '/acknowledge', { note }),
  deleteStatement: (id, sid) => api.del(C(id) + '/bank/statements/' + sid),
  transactions: (id, f) => req(C(id) + '/bank/transactions' + qs(f)),
  classifyTxns: (id, b) => api.post(C(id) + '/bank/transactions/classify', b),

  checks: (id) => req(C(id) + '/checks'),
  addCheck: (id, b) => api.post(C(id) + '/checks', b),
  completeCheck: (id, cid, b) => api.post(C(id) + '/checks/' + cid + '/complete', b),
  claims: (id) => req(C(id) + '/claims'),
  addClaim: (id, b) => api.post(C(id) + '/claims', b),
  updateClaim: (id, cid, b) => api.put(C(id) + '/claims/' + cid, b),
  questions: (id) => req(C(id) + '/questions'),
  askQuestion: (id, b) => api.post(C(id) + '/questions', b),
  answerQuestion: (id, qid, b) => api.post(C(id) + '/questions/' + qid + '/answer', b),
  closeQuestion: (id, qid) => api.post(C(id) + '/questions/' + qid + '/close', {}),

  memo: (id) => req(C(id) + '/memo'),
  saveMemo: (id, section, body) => api.put(C(id) + '/memo/' + section, { body }),
  validateMemo: (id, sections) => api.post(C(id) + '/memo/validate', { sections }),
  submit: (id, rationale) => api.post(C(id) + '/submit', { rationale }),
  check: (id, action, rationale) => api.post(C(id) + '/check', { action, rationale }),
  sanction: (id, b) => api.post(C(id) + '/sanction', b),

  config: () => req('/uw/config'),
  bookCreate: (kind, b) => api.post('/uw/config/' + kind, b),
  bookUpdate: (kind, itemId, b) => api.put('/uw/config/' + kind + '/' + itemId, b),
  bookDelete: (kind, itemId) => api.del('/uw/config/' + kind + '/' + itemId),
  bookSubmit: (kind, itemId) => api.post('/uw/config/' + kind + '/' + itemId + '/submit', {}),
  bookApprove: (kind, itemId, note) => api.post('/uw/config/' + kind + '/' + itemId + '/approve', { note }),
  bookReject: (kind, itemId, note) => api.post('/uw/config/' + kind + '/' + itemId + '/reject', { note }),
  bookRetire: (kind, itemId, note) => api.post('/uw/config/' + kind + '/' + itemId + '/retire', { note }),
  testRule: (b) => api.post('/uw/config/rules-test', b),
  addField: (b) => api.post('/uw/config-fields', b),
  updateField: (code, b) => api.put('/uw/config-fields/' + code, b),
  saveProduct: (b) => api.post('/uw/config-products', b),
  addChecklistItem: (b) => api.post('/uw/config-checklist', b),
  updateChecklistItem: (itemId, b) => api.put('/uw/config-checklist/' + itemId, b),
  addSource: (b) => api.post('/uw/config-sources', b),
  updateSource: (sid, b) => api.put('/uw/config-sources/' + sid, b),
  addBankRule: (b) => api.post('/uw/config-bank-rules', b),
  updateBankRule: (rid, b) => api.put('/uw/config-bank-rules/' + rid, b),
  saveSettings: (b) => api.put('/uw/config-settings', b)
};
export const uwFileUrl = (id, vid, download) => BASE + C(id) + '/versions/' + vid + '/file' + (download ? '?download=1' : '');
export const uwMemoUrl = (id, snapshotId) => BASE + C(id) + '/memo/export' + (snapshotId ? '?snapshot=' + snapshotId : '');

/* Generated origination paperwork opens as a printable page in a new tab. */
export const letterUrl = (id, kind, download) =>
  BASE + '/applications/' + id + '/letter/' + kind + (download ? '?download=1' : '');
export const openLetter = (id, kind, download) => window.open(letterUrl(id, kind, download), '_blank', 'noopener');

export const backupUrl = () => BASE + '/admin/backup';
export const fileUrl = (id, download) => BASE + '/documents/' + id + '/file' + (download ? '?download=1' : '');
export const openFile = (id) => window.open(fileUrl(id), '_blank', 'noopener');

/* Client-side CSV download — BOM included so Excel reads ₹ and en-dashes. */
export function downloadCSV(filename, header, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
