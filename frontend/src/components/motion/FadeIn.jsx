import { motion } from 'framer-motion';
import { EASE, DURATION } from './transitions.js';

// Simple opacity-only entrance. Use for content where movement would be
// distracting (e.g. text following a SlideUp title).
export function FadeIn({ children, delay = 0, duration = DURATION.base, className, as = 'div', ...rest }) {
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
