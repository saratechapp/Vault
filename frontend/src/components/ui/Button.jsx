import { useMemo } from 'react';
import { motion } from 'framer-motion';

const SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10 p-0',
};

const VARIANTS = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  outline: 'btn-outline',
  danger: 'btn-danger',
};

export function Button({
  as: Comp = 'button',
  variant = 'primary',
  size = 'md',
  leftIcon = null,
  rightIcon = null,
  fullWidth = false,
  className = '',
  children,
  ...rest
}) {
  // Polymorphic-safe: framer-motion needs a motion-capable element. Plain
  // tags (button, a, ...) use its built-in motion.* primitives; custom
  // components (e.g. react-router's Link) get wrapped via motion(Comp).
  // Memoized per Comp identity so this doesn't re-wrap on every render.
  // Only whileHover — tap feedback is already handled by .btn's own
  // active:scale-[0.98] in index.css; adding whileTap here too would fight
  // that CSS transform instead of complementing it.
  const MotionComp = useMemo(() => (typeof Comp === 'string' ? motion[Comp] || motion.button : motion(Comp)), [Comp]);
  return (
    <MotionComp
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className={`${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </MotionComp>
  );
}

export default Button;
