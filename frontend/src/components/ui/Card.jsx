import { motion } from 'framer-motion';

const PADDING = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-6', xl: 'p-8' };

// `hover` = existing CSS-only border/shadow change (unchanged behavior).
// `lift` = new opt-in Framer Motion rise-on-hover, for landing-page and
// dashboard cards that should feel more interactive; off by default so no
// existing Card usage anywhere in the app changes appearance.
export function Card({ as: Comp = 'div', strong = false, padding = 'md', hover = false, lift = false, className = '', children, ...rest }) {
  const classes = `${strong ? 'card-strong' : 'card'} ${PADDING[padding] ?? PADDING.md} ${hover ? 'transition hover:border-line-strong hover:shadow-card' : ''} ${className}`;
  if (!lift) {
    return (
      <Comp className={classes} {...rest}>
        {children}
      </Comp>
    );
  }
  return (
    <motion.div
      className={classes}
      whileHover={{ y: -4, boxShadow: '0 20px 60px -16px rgba(15,23,42,0.35)' }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({ title, subtitle, right, className = '' }) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-4 ${className}`}>
      <div>
        {title && <h3 className="font-display text-base font-semibold text-fg">{title}</h3>}
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export default Card;
