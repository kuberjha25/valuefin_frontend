import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, HelpCircle, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

/* ============================================================================
   First-visit page guide.

   The first time someone opens a screen, its steps are walked one at a time —
   what the screen is for, then each thing they can do on it, in the order the
   work happens. Dismissing or finishing marks that screen as seen, so it never
   interrupts twice; the ? button in the corner replays it on demand.

   "Seen" lives in localStorage per screen key, so it is per person and per
   browser rather than a server-side flag on the account.
   ========================================================================== */

const KEY = 'vf.guide.';
const seen = (key) => {
  try { return localStorage.getItem(KEY + key) === '1'; }
  catch (_) { return true; }                 // private mode — never nag
};
const markSeen = (key) => { try { localStorage.setItem(KEY + key, '1'); } catch (_) { /* ignore */ } };

export function resetGuides() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(KEY)).forEach((k) => localStorage.removeItem(k));
  } catch (_) { /* ignore */ }
}

export default function PageGuide({ id, title, steps = [] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const loc = useLocation();

  /* Opens itself once per screen. Re-checked on navigation so moving between
     two screens that both carry a guide shows each of them in turn. */
  useEffect(() => {
    if (!steps.length) return;
    if (seen(id)) { setOpen(false); return; }
    setStep(0);
    setOpen(true);
  }, [id, loc.pathname, steps.length]);

  if (!steps.length) return null;

  const close = () => { markSeen(id); setOpen(false); };
  const replay = () => { setStep(0); setOpen(true); };
  const last = step >= steps.length - 1;
  const current = steps[step] || {};

  return (
    <>
      <button onClick={replay} title={'How this screen works: ' + title}
        className="fixed bottom-5 left-5 z-[120] grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-ink-850/95 text-slate-400 shadow-lift backdrop-blur-xl transition hover:border-neon-indigo/40 hover:text-neon-violet no-print"
        aria-label="Show the guide for this screen">
        <HelpCircle size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[170] flex items-end justify-center bg-ink-950/60 p-4 backdrop-blur-[2px] sm:items-center no-print"
          role="dialog" aria-modal="true" aria-label={'Guide: ' + title}>
          <div className="w-full max-w-lg animate-popIn overflow-hidden rounded-3xl border border-white/12 bg-ink-850/97 shadow-lift">
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-neon-violet">
                  Step {step + 1} of {steps.length}
                </p>
                <h3 className="mt-0.5 font-display text-base font-bold text-white">{title}</h3>
              </div>
              <button className="btn btn-ghost btn-icon shrink-0" onClick={close} aria-label="Skip the guide"><X size={17} /></button>
            </header>

            <div className="px-5 py-5">
              <p className="font-display text-[15px] font-semibold text-slate-100">{current.heading}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{current.body}</p>

              <div className="mt-4 flex gap-1.5">
                {steps.map((s, i) => (
                  <button key={i} onClick={() => setStep(i)} aria-label={'Step ' + (i + 1)}
                    className={'h-1.5 flex-1 rounded-full transition ' + (i <= step ? 'bg-neon-violet' : 'bg-white/[.1]')} />
                ))}
              </div>
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-white/10 px-5 py-4">
              <button className="btn btn-ghost btn-xs" onClick={close}>Skip</button>
              <div className="flex gap-2">
                {step > 0 && <button className="btn" onClick={() => setStep((s) => s - 1)}>Back</button>}
                <button className="btn btn-p" onClick={() => (last ? close() : setStep((s) => s + 1))}>
                  {last ? <><Check size={15} /> Got it</> : <>Next <ArrowRight size={15} /></>}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
