import { lazy, Suspense } from 'react';
import { FloatingAssistantButton } from './FloatingAssistantButton.jsx';

// The panel (chat history, framer-motion, provider logic) is meaningfully
// heavier than the button — code-split so it never adds to the initial
// dashboard bundle and only loads once someone actually opens the assistant.
const AssistantPanel = lazy(() => import('./AssistantPanel.jsx'));

export function FloatingAssistant() {
  return (
    <>
      <FloatingAssistantButton />
      <Suspense fallback={null}>
        <AssistantPanel />
      </Suspense>
    </>
  );
}

export default FloatingAssistant;
