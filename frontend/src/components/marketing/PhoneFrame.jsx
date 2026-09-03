// A lightweight CSS phone bezel for the marketing pages. No images — it's a
// styled div so it stays crisp at any size and follows the app's theme tokens.
// `float` opts into a gentle idle bob (disabled under prefers-reduced-motion).
import { motion, useReducedMotion } from 'framer-motion';

export function PhoneFrame({ children, className = '', float = false, floatDelay = 0, label }) {
  const reduce = useReducedMotion();
  const animate = float && !reduce ? { y: [0, -10, 0] } : undefined;

  return (
    <motion.div
      className={`relative w-full max-w-[260px] ${className}`}
      animate={animate}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: floatDelay }}
    >
      <div className="relative rounded-[2.25rem] border border-line-strong bg-surface p-2 shadow-xl dark:bg-surface-2">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto mt-2 h-5 w-24 rounded-full bg-app" />
        <div className="relative overflow-hidden rounded-[1.75rem] border border-line bg-app">
          {children}
        </div>
      </div>
      {label ? (
        <p className="mt-3 text-center text-xs font-medium text-subtle">{label}</p>
      ) : null}
    </motion.div>
  );
}

export default PhoneFrame;
