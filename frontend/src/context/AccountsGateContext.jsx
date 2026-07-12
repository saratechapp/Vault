import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { accountsApi } from '../lib/api.js';

const AccountsGateContext = createContext(null);
export const ACCOUNTS_CHANGED_EVENT = 'wallet:accounts-changed';

// Fired whenever an account is created/deleted so every consumer (the
// mandatory-account gate on Budgets/Bills/Goals/Debts, the disabled
// Add-transaction/Import buttons, the product tour) re-checks in lockstep
// instead of each polling accountsApi independently.
export function notifyAccountsChanged() {
  window.dispatchEvent(new CustomEvent(ACCOUNTS_CHANGED_EVENT));
}

export function AccountsGateProvider({ children }) {
  // null = not loaded yet; distinguishes "still checking" from "checked, zero"
  // so gated pages can show a loading state instead of flashing the gate.
  const [accountCount, setAccountCount] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const list = await accountsApi.list();
      setAccountCount((list || []).length);
    } catch {
      // best-effort — keep the previous count on a transient failure
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    window.addEventListener(ACCOUNTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(ACCOUNTS_CHANGED_EVENT, refresh);
  }, [refresh]);

  const loaded = accountCount !== null;
  const hasAccounts = accountCount !== null && accountCount > 0;

  const value = useMemo(
    () => ({ loaded, hasAccounts, accountCount: accountCount ?? 0, refresh }),
    [loaded, hasAccounts, accountCount, refresh]
  );

  return <AccountsGateContext.Provider value={value}>{children}</AccountsGateContext.Provider>;
}

export function useAccountsGate() {
  const ctx = useContext(AccountsGateContext);
  if (!ctx) throw new Error('useAccountsGate must be used within an AccountsGateProvider');
  return ctx;
}
