import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar.jsx';
import { Topbar } from '../components/Topbar.jsx';
import { PinLockScreen } from '../components/PinLockScreen.jsx';
import { IdleLogoutManager } from '../components/IdleLogoutManager.jsx';
import { ProductTour } from '../components/tour/ProductTour.jsx';
import { NewTransactionProvider } from '../context/NewTransactionContext.jsx';
import { AccountsGateProvider } from '../context/AccountsGateContext.jsx';
import { AssistantProvider } from '../context/AssistantContext.jsx';
import { FloatingAssistant } from '../components/assistant/FloatingAssistant.jsx';
import { ImpersonationBanner } from '../components/ImpersonationBanner.jsx';
import { FeedbackPromptController } from '../components/feedback/FeedbackPromptController.jsx';
import { hasPin, isUnlocked } from '../lib/pin.js';

export function AppLayout() {
  const [unlocked, setUnlocked] = useState(() => !hasPin() || isUnlocked());
  const location = useLocation();

  if (!unlocked) {
    return <PinLockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <AccountsGateProvider>
      <NewTransactionProvider>
        <ImpersonationBanner />
        <div className="relative flex min-h-screen">
          <div className="pointer-events-none absolute -top-40 left-1/3 h-[500px] w-[900px] rounded-full bg-brand-700/10 blur-[140px] dark:bg-brand-700/15" />
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="mx-auto w-full max-w-[1600px] flex-1 px-8 py-6">
              <Outlet />
            </main>
          </div>
        </div>
        <IdleLogoutManager />
        <ProductTour active={location.pathname === '/app/dashboard'} />
        <AssistantProvider>
          <FloatingAssistant />
          <FeedbackPromptController />
        </AssistantProvider>
      </NewTransactionProvider>
    </AccountsGateProvider>
  );
}

export default AppLayout;
