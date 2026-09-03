import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check, ScanLine, Store, Tag, IndianRupee, CalendarDays, Sparkles } from 'lucide-react';

// Visualises the AI bill scanner: a receipt image on the left, an animated
// scan pass, then the structured fields the model extracts appear one by one
// on the right and resolve into a created transaction. The extracted values
// match the app's real scanner output shape (merchant / category / amount /
// date). Loops gently; under prefers-reduced-motion it renders the finished
// state with no motion.
const FIELDS = [
  { icon: Store, label: 'Merchant', value: 'Starbucks' },
  { icon: Tag, label: 'Category', value: 'Food & Drink' },
  { icon: IndianRupee, label: 'Amount', value: '₹485.00' },
  { icon: CalendarDays, label: 'Date', value: 'Sep 3, 2026' },
];

const RECEIPT_LINES = [
  ['Caffè Latte (Grande)', '₹320.00'],
  ['Butter Croissant', '₹165.00'],
  ['Subtotal', '₹485.00'],
  ['GST', 'incl.'],
  ['TOTAL', '₹485.00'],
];

// step 1 scanning → 2..5 reveal field (step-1) → 6 done, then loops back to 1.
// Starts (and rests, under reduced motion) on 6 = the finished state, so it
// never renders as an empty card if the animation timer is slow to start.
const DONE = 6;

export function AiScanShowcase({ className = '' }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(DONE);
  const ref = useRef(null);
  const running = useRef(false);

  useEffect(() => {
    if (reduce) return undefined;
    const node = ref.current;
    if (!node) return undefined;

    let timer;
    const advance = () => {
      setStep((s) => (s >= DONE ? 1 : s + 1));
      timer = setTimeout(advance, 900);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !running.current) {
          running.current = true;
          setStep(1);
          timer = setTimeout(advance, 900);
        } else if (!entries[0].isIntersecting && running.current) {
          running.current = false;
          clearTimeout(timer);
          setStep(DONE);
        }
      },
      { threshold: 0.35 },
    );
    io.observe(node);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, [reduce]);

  const scanning = step === 1;
  const revealCount = step >= 2 ? Math.min(FIELDS.length, step - 1) : 0;
  const done = step >= DONE;

  return (
    <div ref={ref} className={`grid items-center gap-6 sm:grid-cols-[1fr_auto_1.1fr] ${className}`}>
      {/* Receipt */}
      <div className="relative mx-auto w-full max-w-[240px]">
        <div className="relative overflow-hidden rounded-xl border border-line bg-surface p-4 font-mono text-[11px] leading-relaxed text-muted shadow-md dark:bg-surface-2">
          <p className="text-center text-xs font-semibold tracking-wide text-fg">STARBUCKS COFFEE</p>
          <p className="mb-2 text-center text-[10px] text-subtle">MG Road · Bengaluru</p>
          <div className="space-y-1 border-y border-dashed border-line py-2">
            {RECEIPT_LINES.map(([a, b], i) => (
              <div key={i} className={`flex justify-between ${a === 'TOTAL' ? 'font-semibold text-fg' : ''}`}>
                <span>{a}</span><span>{b}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-subtle">03 Sep 2026 · 09:14</p>

          {scanning ? (
            <motion.div
              className="pointer-events-none absolute inset-x-0 h-14 bg-gradient-to-b from-transparent via-brand-500/30 to-transparent"
              initial={{ top: '-15%' }}
              animate={{ top: '100%' }}
              transition={{ duration: 0.9, ease: 'linear' }}
            />
          ) : null}
        </div>
        <span className="mt-2 flex items-center justify-center gap-1.5 text-xs text-subtle">
          <ScanLine size={13} /> Receipt / screenshot
        </span>
      </div>

      {/* Processing pulse */}
      <div className="flex flex-col items-center gap-2 py-2 text-brand-500 sm:py-0">
        <motion.span
          className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-500/30 bg-brand-500/10"
          animate={reduce ? undefined : { scale: scanning ? [1, 1.12, 1] : 1 }}
          transition={{ duration: 0.7, repeat: scanning ? Infinity : 0 }}
        >
          <Sparkles size={16} />
        </motion.span>
        <span className="text-[11px] font-semibold uppercase tracking-wide">AI</span>
        <div className="hidden h-px w-10 bg-gradient-to-r from-brand-500/50 to-transparent sm:block" />
      </div>

      {/* Extracted transaction */}
      <div className="rounded-xl border border-line bg-surface p-4 shadow-md dark:bg-surface-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-subtle">Extracted transaction</p>
          <AnimatePresence>
            {done ? (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success"
              >
                <Check size={11} /> Created
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
        <div className="mt-3 space-y-2">
          {FIELDS.map((f, i) => {
            const shown = i < revealCount || reduce || done;
            return (
              <motion.div
                key={f.label}
                className="flex items-center gap-3 rounded-lg border border-line px-3 py-2"
                initial={false}
                animate={{ opacity: shown ? 1 : 0.25, x: shown ? 0 : -6 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-500/10 text-brand-500">
                  <f.icon size={13} />
                </span>
                <span className="text-xs text-subtle">{f.label}</span>
                <span className="ml-auto text-sm font-semibold text-fg">
                  {shown ? f.value : '—'}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default AiScanShowcase;
