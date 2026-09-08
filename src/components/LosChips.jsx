import React from 'react';
import { Chip } from '../ui.jsx';
import { LOS_PRODUCT, STAGE, VERDICT } from '../format.js';

/* The three origination badges, in one place so the pipeline, the board and the
   application file always colour a stage or a verdict the same way. */

export const StageChip = ({ stage }) => <Chip cls={(STAGE[stage] || {}).cls || 'chip-slate'}>{stage}</Chip>;

export const ProductChip = ({ product, label }) => (
  <Chip cls={(LOS_PRODUCT[product] || {}).cls || 'chip-slate'}>{label || (LOS_PRODUCT[product] || {}).label || product}</Chip>
);

export const VerdictChip = ({ verdict }) => {
  const v = VERDICT[verdict];
  return <Chip cls={v ? v.cls : 'chip-slate'}>{v ? v.label : String(verdict || '').replace(/_/g, ' ')}</Chip>;
};
