import { motion } from 'framer-motion';
import { EASE, DURATION } from './transitions.js';

// Fade + rise — the workhorse entrance for headlines, cards, and hero content.
export function SlideUp({ children, delay = 0, distance = 16, duration = DURATION.base, className, as = 'div', ...rest }) {
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

// Same motion, but slides in from the side — for split layouts (e.g. auth
// pages' form vs. decorative panel).
export function SlideIn({ children, delay = 0, distance = 24, from = 'left', duration = DURATION.base, className, ...rest }) {
  const x = from === 'left' ? -distance : distance;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
