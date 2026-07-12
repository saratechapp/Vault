import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { Bot, Minus, RotateCcw, X, Send, Sparkles } from 'lucide-react';
import { useAssistant } from '../../context/AssistantContext.jsx';
import { assistantData } from '../../lib/assistant/dataStore.js';
import { ChatMessage } from './ChatMessage.jsx';
import { SuggestionChips, EmptyStateQuickActions } from './SuggestionChips.jsx';
import { WelcomeSnapshot } from './WelcomeSnapshot.jsx';
import { Chip, IconButton, Skeleton } from '../ui/index.js';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

function healthTone(score) {
  if (score == null) return 'neutral';
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

function timeAgo(ts) {
  if (!ts) return null;
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-500">
        <Bot size={15} />
      </span>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-line bg-surface-2 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-subtle" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

function MinimizedBar({ onRestore }) {
  return (
    <motion.button
      type="button"
      onClick={onRestore}
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className="glass-strong fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-fg shadow-glow sm:bottom-8 sm:right-8"
    >
      <Bot size={16} className="text-brand-500" />
      Financial Assistant
    </motion.button>
  );
}

function Header({ health, lastUpdatedAt, onClear, onMinimize, onClose }) {
  const dateLabel = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const ago = timeAgo(lastUpdatedAt);
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
          <Bot size={17} />
        </span>
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold leading-tight text-fg">Financial Assistant</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            {health ? (
              <Chip tone={healthTone(health.score)}>
                <Sparkles size={10} /> Health {health.score} · {health.grade}
              </Chip>
            ) : (
              <Skeleton className="h-[18px] w-24 rounded-full" />
            )}
            <span className="text-[10px] text-subtle">{dateLabel}{ago ? ` · Updated ${ago}` : ''}</span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton icon={RotateCcw} label="Clear conversation" title="Clear conversation" onClick={onClear} />
        <IconButton icon={Minus} label="Minimize" title="Minimize" onClick={onMinimize} />
        <IconButton icon={X} label="Close" title="Close" onClick={onClose} />
      </div>
    </div>
  );
}

export function AssistantPanel() {
  const { isOpen, isMinimized, messages, isThinking, hasData, lastUpdatedAt, close, minimize, open, send, sendChip, clearConversation } = useAssistant();
  const [input, setInput] = useState('');
  const [health, setHealth] = useState(null);
  const scrollRef = useRef(null);
  const isMobile = useIsMobile();
  const dragControls = useDragControls();

  useEffect(() => {
    if (!isOpen) return;
    assistantData.dashboard().then((d) => setHealth({ score: d.healthScore, grade: d.healthGrade })).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

  if (!isOpen) return null;
  if (isMinimized) return createPortal(<AnimatePresence>{isMinimized && <MinimizedBar onRestore={open} />}</AnimatePresence>, document.body);

  const showWelcomeChips = messages.length === 1;

  const submit = (e) => {
    e.preventDefault();
    send(input);
    setInput('');
  };

  const body = (
    <>
      <Header health={health} lastUpdatedAt={lastUpdatedAt} onClear={clearConversation} onMinimize={minimize} onClose={close} />

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {showWelcomeChips && <WelcomeSnapshot />}

        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} onFollowUp={sendChip} />
        ))}
        {isThinking && <TypingIndicator />}

        {showWelcomeChips && !isThinking && (
          !hasData ? (
            <div className="space-y-3 rounded-2xl border border-dashed border-line px-4 py-5">
              <div>
                <p className="font-display text-sm font-semibold text-fg">Welcome!</p>
                <p className="mt-1 text-sm text-muted">
                  Start by adding an account and recording your first transaction. Once you have financial data, I'll provide insights and recommendations.
                </p>
              </div>
              <EmptyStateQuickActions />
            </div>
          ) : (
            <SuggestionChips onPick={send} />
          )
        )}
      </div>

      <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-3">
        <input
          className="input"
          placeholder="Ask about your spending, budgets, bills…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={!input.trim()} className="btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-0">
          <Send size={16} />
        </button>
      </form>
    </>
  );

  if (isMobile) {
    return createPortal(
      <AnimatePresence>
        <motion.div
          key="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        />
        <motion.div
          key="sheet"
          role="dialog"
          aria-label="Financial Assistant"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            if (info.offset.y > 120 || info.velocity.y > 600) close();
          }}
          style={{ height: '88vh' }}
          className="fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-[24px] border-t border-line-strong bg-surface shadow-xl"
        >
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 active:cursor-grabbing"
          >
            <div className="h-1.5 w-10 rounded-full bg-line-strong" />
          </div>
          {body}
        </motion.div>
      </AnimatePresence>,
      document.body
    );
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="panel"
        role="dialog"
        aria-label="Financial Assistant"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed z-40 flex w-[440px] max-w-[calc(100vw-32px)] flex-col rounded-[24px] border border-line-strong bg-surface/95 shadow-xl shadow-glow backdrop-blur-xl"
        style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))', right: 'max(1.5rem, env(safe-area-inset-right))', maxHeight: 'min(720px, calc(100vh - 96px))' }}
      >
        {body}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

export default AssistantPanel;
