import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

// Generic hover/focus tooltip. Distinct from ChartTooltip.jsx, which is a
// Recharts-specific content renderer, not a standalone hoverable element.
const GAP = 8;
const VIEWPORT_MARGIN = 8;

// Picks the requested side if it fits in the viewport, otherwise flips to
// whichever side actually has room, then clamps so the bubble never renders
// off-screen. Position is computed in viewport coordinates because the
// bubble is portaled straight to <body> — see the component comment below
// for why that's necessary.
function computePosition(side, anchorRect, bubbleSize) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceTop = anchorRect.top;
  const spaceBottom = vh - anchorRect.bottom;
  const spaceLeft = anchorRect.left;
  const spaceRight = vw - anchorRect.right;

  let placement = side;
  const fits = {
    top: spaceTop >= bubbleSize.height + GAP,
    bottom: spaceBottom >= bubbleSize.height + GAP,
    left: spaceLeft >= bubbleSize.width + GAP,
    right: spaceRight >= bubbleSize.width + GAP,
  };
  if (!fits[placement]) {
    placement = fits.bottom ? 'bottom' : fits.top ? 'top' : fits.right ? 'right' : fits.left ? 'left' : placement;
  }

  let top;
  let left;
  if (placement === 'top') {
    top = anchorRect.top - GAP - bubbleSize.height;
    left = anchorRect.left + anchorRect.width / 2 - bubbleSize.width / 2;
  } else if (placement === 'bottom') {
    top = anchorRect.bottom + GAP;
    left = anchorRect.left + anchorRect.width / 2 - bubbleSize.width / 2;
  } else if (placement === 'left') {
    left = anchorRect.left - GAP - bubbleSize.width;
    top = anchorRect.top + anchorRect.height / 2 - bubbleSize.height / 2;
  } else {
    left = anchorRect.right + GAP;
    top = anchorRect.top + anchorRect.height / 2 - bubbleSize.height / 2;
  }

  top = Math.min(Math.max(top, VIEWPORT_MARGIN), vh - bubbleSize.height - VIEWPORT_MARGIN);
  left = Math.min(Math.max(left, VIEWPORT_MARGIN), vw - bubbleSize.width - VIEWPORT_MARGIN);
  return { top, left };
}

// `interactive` keeps the bubble hoverable/clickable (pointer-events enabled,
// no conflicting `role="tooltip"`) for cases like a disabled button
// explaining why, with a link to fix it, or a longer explanation with its
// own paragraphs. Plain short hover labels don't need it.
//
// The bubble is portaled to document.body and positioned with `fixed` +
// getBoundingClientRect, not rendered inline as an absolutely-positioned
// child. A plain inline bubble gets silently clipped by *any* ancestor with
// overflow:hidden/auto on its way up to the viewport — the bill modal's body
// is exactly such an ancestor (scrollable, `overflow-y-auto`, which per the
// CSS overflow-pairing rule also clips the x-axis), so a tooltip opened near
// its edges was rendering partly or fully off-screen. Portaling escapes that
// entirely; computePosition() then clamps to the real viewport and flips
// side if the requested one doesn't fit.
//
// Because the bubble is no longer a DOM descendant of the trigger once
// portaled, hovering from the trigger onto the bubble itself needs its own
// open/close handlers (a plain descendant would never fire the wrapper's
// mouseleave, but siblings-under-body do).
export function Tooltip({ label, side = 'top', interactive = false, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const bubbleRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }
    const update = () => {
      if (!triggerRef.current) return;
      const anchorRect = triggerRef.current.getBoundingClientRect();
      const bubbleRect = bubbleRef.current?.getBoundingClientRect();
      const size = bubbleRect ? { width: bubbleRect.width, height: bubbleRect.height } : { width: 240, height: 60 };
      setPos(computePosition(side, anchorRect, size));
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, side]);

  if (!label) return children;

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.span
              ref={bubbleRef}
              role={interactive ? undefined : 'tooltip'}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.12 }}
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
              style={{
                position: 'fixed',
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                visibility: pos ? 'visible' : 'hidden',
              }}
              className={`z-[200] w-[240px] rounded-lg bg-fg px-3 py-2 text-xs font-medium leading-relaxed text-app shadow-lg ${
                interactive ? '' : 'pointer-events-none'
              }`}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  );
}

export default Tooltip;
