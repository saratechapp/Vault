import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getAssistantProvider } from '../lib/assistant/provider.js';
import { assistantData } from '../lib/assistant/dataStore.js';

const AssistantContext = createContext(null);
let seq = 0;
const nextId = () => `msg_${Date.now()}_${seq++}`;

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  timestamp: Date.now(),
  response: {
    text: "I'm your Financial Assistant — I can analyze your spending, budgets, bills, savings goals, accounts, and financial health, all locally within the application.",
  },
};

export function AssistantProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [isThinking, setIsThinking] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);
  const [hasData, setHasData] = useState(true); // optimistic until checked, avoids an empty-state flash
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const provider = useRef(getAssistantProvider());

  // Badge + empty-state check run once, after first paint, off the render
  // path — the spec calls for "do not block dashboard rendering."
  useEffect(() => {
    const run = () => {
      assistantData.dashboard().then((d) => {
        setHasData((d.recentTransactions || []).length > 0);
        setLastUpdatedAt(Date.now());
      }).catch(() => {});
      assistantData.insights().then((i) => {
        setBadgeCount(Math.min(9, (i.recommendations || []).length));
        setLastUpdatedAt(Date.now());
      }).catch(() => {});
    };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(run, { timeout: 4000 }) : setTimeout(run, 1200);
    return () => {
      if (window.cancelIdleCallback && typeof idle === 'number') window.cancelIdleCallback(idle);
      else clearTimeout(idle);
    };
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    setIsMinimized(false);
    setBadgeCount(0);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);
  const minimize = useCallback(() => setIsMinimized(true), []);
  const toggle = useCallback(() => {
    setIsOpen((was) => {
      if (!was) setBadgeCount(0);
      return !was;
    });
    setIsMinimized(false);
  }, []);

  const clearConversation = useCallback(() => setMessages([WELCOME_MESSAGE]), []);

  const ask = useCallback(async ({ displayText, message, intentId, args }) => {
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text: displayText, timestamp: Date.now() }]);
    setIsThinking(true);
    try {
      const response = await provider.current.answer({ message, intentId, args });
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', response, timestamp: Date.now() }]);
      setLastUpdatedAt(Date.now());
    } finally {
      setIsThinking(false);
    }
  }, []);

  const send = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    ask({ displayText: trimmed, message: trimmed });
  }, [ask]);

  // A follow-up/suggestion chip carries either a fixed {intentId, args} (safe,
  // unambiguous — used when a handler already knows exactly what it means,
  // e.g. "Compare with last month" after a category breakdown) or a plain
  // {message} that re-enters the same free-text matching a typed question would.
  const sendChip = useCallback((chip) => {
    if (chip.intentId) ask({ displayText: chip.label, intentId: chip.intentId, args: chip.args });
    else ask({ displayText: chip.label, message: chip.message || chip.label });
  }, [ask]);

  const value = useMemo(
    () => ({ isOpen, isMinimized, messages, isThinking, badgeCount, hasData, lastUpdatedAt, open, close, minimize, toggle, send, sendChip, clearConversation }),
    [isOpen, isMinimized, messages, isThinking, badgeCount, hasData, lastUpdatedAt, open, close, minimize, toggle, send, sendChip, clearConversation]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant must be used within an AssistantProvider');
  return ctx;
}
