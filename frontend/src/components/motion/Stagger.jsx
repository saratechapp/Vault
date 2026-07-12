import { motion } from 'framer-motion';
import { EASE, DURATION } from './transitions.js';

// Container + item pair for grids/lists where children should reveal in a
// cascade rather than all at once (feature grids, KPI rows, FAQ items).
// Usage: <Stagger><StaggerItem/><StaggerItem/>...</Stagger>
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE } },
};

export function Stagger({ children, className, viewport = true, as = 'div', ...rest }) {
  const MotionTag = motion[as] || motion.div;
  const viewportProps = viewport
    ? { whileInView: 'show', viewport: { once: true, amount: 0.2 } }
    : { animate: 'show' };
  return (
    <MotionTag className={className} variants={containerVariants} initial="hidden" {...viewportProps} {...rest}>
      {children}
    </MotionTag>
  );
}

export function StaggerItem({ children, className, as = 'div', ...rest }) {
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag className={className} variants={itemVariants} {...rest}>
      {children}
    </MotionTag>
  );
}
