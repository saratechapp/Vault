import { useEffect, useState } from 'react';

function toPlainRect(domRect) {
  return { x: domRect.left, y: domRect.top, width: domRect.width, height: domRect.height };
}

function rectsRoughlyEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((r, i) => (
    Math.abs(r.x - b[i].x) < 0.5
    && Math.abs(r.y - b[i].y) < 0.5
    && Math.abs(r.width - b[i].width) < 0.5
    && Math.abs(r.height - b[i].height) < 0.5
  ));
}

// Tracks the live viewport position of one or more target elements while a
// tour step is active. Uses a rAF loop rather than scroll/resize listeners
// so the spotlight glides smoothly along with the auto-scroll-into-view
// (and with any layout shift from async dashboard data loading in) instead
// of jumping once a listener fires.
export function useTourTargets(selectors, active) {
  const [rects, setRects] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active || !selectors?.length) {
      setRects([]);
      setReady(false);
      return undefined;
    }

    let raf;
    let cancelled = false;
    let scrolled = false;

    const measure = () => {
      if (cancelled) return;
      const els = selectors.map((sel) => document.querySelector(sel)).filter(Boolean);

      if (!scrolled && els[0]) {
        scrolled = true;
        els[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const next = els.map((el) => toPlainRect(el.getBoundingClientRect()));
      setRects((prev) => (rectsRoughlyEqual(prev, next) ? prev : next));
      if (els.length) setReady(true);
      raf = requestAnimationFrame(measure);
    };

    raf = requestAnimationFrame(measure);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [selectors, active]);

  return { rects, ready };
}
