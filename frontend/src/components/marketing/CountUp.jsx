import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

// Counts up to `value` once, the first time it scrolls into view. Falls back
// to the final value immediately under prefers-reduced-motion. `format` maps
// the running number to a display string (e.g. currency).
export function CountUp({ value, duration = 1400, decimals = 0, prefix = '', suffix = '', format, className = '' }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) { setDisplay(value); return undefined; }
    const node = ref.current;
    if (!node) return undefined;

    let raf = 0;
    let start = 0;
    let done = false;

    const tick = (now) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !done) {
          done = true;
          raf = requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, duration, reduce]);

  const text = format
    ? format(display)
    : `${prefix}${display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

  return <span ref={ref} className={className}>{text}</span>;
}

export default CountUp;
