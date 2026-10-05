/* Underwriting vocabulary and formatting. Money arrives as integer paise from
   the API; it is formatted from the integer, never re-computed in floating point. */

/* paise (integer) -> "₹12,34,567.89" */
export function rupees(paise, { dp = 2 } = {}) {
  if (paise == null || paise === '') return '—';
  const neg = String(paise).startsWith('-');
  const digits = String(paise).replace('-', '').padStart(3, '0');
  const whole = digits.slice(0, -2).replace(/^0+(?=\d)/, '');
  const frac = digits.slice(-2);
  const grouped = whole.length > 3 ? whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + whole.slice(-3) : whole;
  return (neg ? '-' : '') + '₹' + grouped + (dp ? '.' + frac : '');
}

/* Compact headline: ₹4.5 Cr / ₹12.3 L (display only). */
export function rupeesShort(paise) {
  if (paise == null) return '—';
  const r = Number(paise) / 100;
  const a = Math.abs(r);
  if (a >= 1e7) return '₹' + (r / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' Cr';
  if (a >= 1e5) return '₹' + (r / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' L';
  return rupees(paise, { dp: 0 });
}

/* Decimal string from the engine -> fixed places, without float accumulation. */
export function dec(s, dp = 2) {
  if (s == null) return '—';
  const n = Number(s);
  return isFinite(n) ? n.toFixed(dp) : String(s);
}

export const label = (s) => String(s || '').replace(/_/g, ' ');

export const CASE_STATUS = {
  open: { label: 'Open — analyst', cls: 'chip-cyan' },
  sent_back: { label: 'Sent back', cls: 'chip-warn' },
  submitted: { label: 'With checker', cls: 'chip-violet' },
  recommended: { label: 'With sanction authority', cls: 'chip-pink' },
  approved: { label: 'Approved', cls: 'chip-good' },
  approved_modified: { label: 'Approved (modified)', cls: 'chip-good' },
  declined: { label: 'Declined', cls: 'chip-bad' }
};

export const INTAKE = {
  accepted: 'chip-good', quarantined: 'chip-bad', duplicate: 'chip-slate'
};
export const EXTRACTION = {
  done: 'chip-good', pending: 'chip-slate', ocr_required: 'chip-warn', unreadable: 'chip-bad',
  not_applicable: 'chip-slate', failed: 'chip-bad'
};
export const CHECKLIST_STATE = {
  received: { label: 'Received', cls: 'chip-good' },
  missing: { label: 'Missing', cls: 'chip-bad' },
  received_unreadable: { label: 'Received but unreadable', cls: 'chip-bad' },
  period_incomplete: { label: 'Period incomplete', cls: 'chip-warn' },
  not_applicable: { label: 'Not applicable', cls: 'chip-slate' }
};
export const OUTCOME = {
  computed: 'chip-good', not_computable: 'chip-warn',
  within_tolerance: 'chip-good', outside_tolerance: 'chip-bad', tolerance_not_configured: 'chip-warn',
  triggered: 'chip-bad', not_triggered: 'chip-good', not_evaluable: 'chip-warn'
};
export const RULE_CLASS = {
  hard_stop: { label: 'Hard stop', cls: 'chip-bad' },
  committee_exception: { label: 'Committee exception', cls: 'chip-warn' },
  warning: { label: 'Warning', cls: 'chip-slate' }
};
export const CHECK_STATUS = {
  pending: 'chip-slate', match_found: 'chip-violet', no_match: 'chip-good', failed: 'chip-bad', manual_review_required: 'chip-warn'
};
export const BOOK_STATUS = {
  draft: 'chip-slate', pending_approval: 'chip-warn', approved: 'chip-good', retired: 'chip-slate'
};

/* How an engine value is shown, by the formula's declared format. */
export function fmtMeasure(value, format) {
  if (value == null) return '—';
  if (format === 'percent') return dec(value, 2) + '%';
  if (format === 'ratio') return dec(value, 2) + 'x';
  if (format === 'days') return dec(value, 0) + ' days';
  if (format === 'amount') {
    const n = Number(value);
    return isFinite(n) ? rupees(Math.round(n * 100)) : String(value);
  }
  return dec(value, 2);
}
