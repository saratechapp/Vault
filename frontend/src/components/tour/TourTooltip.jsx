import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Button } from '../ui/index.js';

const GAP = 18;
const MARGIN = 12;
const FALLBACK_SIZE = { width: 340, height: 190 };

// Picks whichever side of the anchor rect has room for the tooltip
// (bottom → top → right → left), then clamps the result back inside the
// viewport so it never renders off-screen for an edge-hugging target.
function computePosition(anchor, size, vw, vh) {
  const spaceBottom = vh - anchor.y - anchor.height;
  const spaceTop = anchor.y;
  const spaceRight = vw - anchor.x - anchor.width;
  const spaceLeft = anchor.x;

  let placement = 'bottom';
  if (spaceBottom >= size.height + GAP) placement = 'bottom';
  else if (spaceTop >= size.height + GAP) placement = 'top';
  else if (spaceRight >= size.width + GAP) placement = 'right';
  else if (spaceLeft >= size.width + GAP) placement = 'left';
  else placement = spaceBottom >= spaceTop ? 'bottom' : 'top';

  let top;
  let left;
  if (placement === 'bottom') {
    top = anchor.y + anchor.height + GAP;
    left = anchor.x + anchor.width / 2 - size.width / 2;
  } else if (placement === 'top') {
    top = anchor.y - GAP - size.height;
    left = anchor.x + anchor.width / 2 - size.width / 2;
  } else if (placement === 'right') {
    top = anchor.y + anchor.height / 2 - size.height / 2;
    left = anchor.x + anchor.width + GAP;
  } else {
    top = anchor.y + anchor.height / 2 - size.height / 2;
    left = anchor.x - GAP - size.width;
  }

  top = Math.min(Math.max(top, MARGIN), vh - size.height - MARGIN);
  left = Math.min(Math.max(left, MARGIN), vw - size.width - MARGIN);
  return { top, left, placement };
}

const SLIDE_FROM = {
  bottom: { y: -10 },
  top: { y: 10 },
  left: { x: 10 },
  right: { x: -10 },
};

// Bounding box of every highlighted rect — a step with two spotlighted
// elements (e.g. the sidebar link + the dashboard CTA) anchors the tooltip
// to the pair as a whole, not just the first one, so it can't end up
// overlapping the second cutout.
function unionRect(rects) {
  if (!rects.length) return null;
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function TourTooltip({ step, stepIndex, total, rects, onNext, onPrev, onSkip }) {
  const ref = useRef(null);
  const [size, setSize] = useState(FALLBACK_SIZE);
  const [pos, setPos] = useState(null);
  // Memoized so this stays referentially stable across renders where `rects`
  // itself didn't change — otherwise a fresh object every render would
  // retrigger the position effect below on every render, forever.
  const anchorRect = useMemo(() => unionRect(rects), [rects]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
  }, [step]);

  useLayoutEffect(() => {
    if (!anchorRect) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos(computePosition(anchorRect, size, vw, vh));
  }, [anchorRect, size]);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;
  const placement = pos?.placement || 'bottom';

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-label={`Product tour step ${stepIndex + 1} of ${total}`}
      className="fixed z-[102] w-[340px] max-w-[90vw] rounded-2xl border border-line bg-surface p-5 shadow-glow"
      initial={{ opacity: 0, ...SLIDE_FROM[placement] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, ...SLIDE_FROM[placement] }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-brand-500/15 px-2.5 py-1 text-[11px] font-semibold text-brand-500">
          Step {stepIndex + 1} of {total}
        </span>
        <button
          type="button"
          onClick={onSkip}
          aria-label="Skip tour"
          className="rounded-lg p-1 text-subtle transition hover:bg-tint/[0.06] hover:text-fg"
        >
          <X size={15} />
        </button>
      </div>

      <h3 className="mt-3 font-display text-base font-bold text-fg">{step.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>

      <div className="mt-5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-semibold text-subtle transition hover:text-fg"
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={onPrev}>
              Previous
            </Button>
          )}
          <Button size="sm" rightIcon={!isLast ? <ArrowRight size={14} /> : null} onClick={onNext}>
            {isLast ? 'Finish' : 'Next'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default TourTooltip;
