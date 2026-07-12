
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Sparkles } from 'lucide-react';
import { useAssistant } from '../../context/AssistantContext.jsx';

export function FloatingAssistantButton() {
  const { isOpen, toggle, badgeCount } = useAssistant();
  const [ripple, setRipple] = useState(0);

  return (
    <AnimatePresence>
      {!isOpen && (
        <motion.button
          type="button"
          onClick={() => {
            setRipple((r) => r + 1);
            toggle();
          }}
          aria-label="Open Financial Assistant"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
          whileHover={{ y: -3, scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed z-40 flex h-14 w-14 items-center justify-center gap-2 rounded-full border border-white/20 text-white shadow-glow backdrop-blur-md sm:w-auto sm:justify-start sm:px-5"
          style={{
            background: 'linear-gradient(135deg, rgba(127,58,239,0.9), rgba(101,31,214,0.85))',
            bottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))',
            right: 'max(1.5rem, calc(env(safe-area-inset-right) + 1rem))',
          }}
        >
          {badgeCount > 0 && (
            <motion.span
              className="absolute inset-0 rounded-full bg-brand-500/60"
              animate={{ scale: [1, 1.05, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {ripple > 0 && (
            <motion.span
              key={ripple}
              className="pointer-events-none absolute inset-0 rounded-full bg-white/40"
              initial={{ opacity: 0.5, scale: 0.4 }}
              animate={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          )}
          <Bot size={24} className="relative shrink-0" />
          <span className="relative hidden items-center gap-1 whitespace-nowrap text-sm font-semibold sm:inline-flex">
            AI Insights
          </span>
          {badgeCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-app">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default FloatingAssistantButton;
