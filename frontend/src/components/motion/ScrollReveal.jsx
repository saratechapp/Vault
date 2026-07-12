import { motion } from 'framer-motion';
import { EASE, DURATION } from './transitions.js';

// Fires once when scrolled into view, instead of on mount — for landing-page
// sections below the fold. `once: true` so it doesn't replay on scroll-back,
// which reads as jittery rather than premium.
export function ScrollReveal({ children, delay = 0, distance = 24, amount = 0.3, className, ...rest }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: DURATION.slow, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
