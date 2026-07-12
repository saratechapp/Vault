import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { categoriesApi, accountsApi, templatesApi, transactionsApi } from '../lib/api.js';
import NewTransactionModal from '../components/NewTransactionModal.jsx';

const NewTransactionContext = createContext(null);
export const TX_CREATED_EVENT = 'wallet:tx-created';

export function notifyTxCreated() {
  window.dispatchEvent(new CustomEvent(TX_CREATED_EVENT));
}

export function NewTransactionProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);
  const [prefillTxn, setPrefillTxn] = useState(null);
  const [pickers, setPickers] = useState({ categories: [], accounts: [], templates: [], transactions: [] });

  // Always refetch on open — templates/categories/accounts can be added or
  // edited elsewhere (Settings, Accounts) between opens, so a cached
  // snapshot would silently hide anything created after the first load.
  const loadPickers = useCallback(async () => {
    try {
      const [categories, accounts, templates, transactions] = await Promise.all([
        categoriesApi.list(),
        accountsApi.list(),
        templatesApi.list(),
        transactionsApi.list(),
      ]);
      setPickers({ categories: categories || [], accounts: accounts || [], templates: templates || [], transactions: transactions || [] });
    } catch {
      // keep the previous snapshot on failure
    }
  }, []);

  const open = useCallback(() => {
    setEditingTxn(null);
    setPrefillTxn(null);
    setIsOpen(true);
    loadPickers();
  }, [loadPickers]);

  const openForEdit = useCallback(
    (txn) => {
      setEditingTxn(txn);
      setPrefillTxn(null);
      setIsOpen(true);
      loadPickers();
    },
    [loadPickers]
  );

  // Opens a blank (create, not edit) form with some fields pre-set — used by
  // AI action buttons like "Move to savings" so the user still reviews and
  // confirms before anything is saved, rather than the AI moving money itself.
  const openPrefilled = useCallback(
    (fields) => {
      setEditingTxn(null);
      setPrefillTxn(fields);
      setIsOpen(true);
      loadPickers();
    },
    [loadPickers]
  );

  const close = useCallback(() => setIsOpen(false), []);

  const handleSaved = useCallback(() => {
    notifyTxCreated();
    loadPickers();
  }, [loadPickers]);

  const value = useMemo(
    () => ({ isOpen, open, openForEdit, openPrefilled, close, pickers }),
    [isOpen, open, openForEdit, openPrefilled, close, pickers]
  );

  return (
    <NewTransactionContext.Provider value={value}>
      {children}
      <NewTransactionModal
        open={isOpen}
        onClose={close}
        editingTxn={editingTxn}
        prefillTxn={prefillTxn}
        categories={pickers.categories}
        accounts={pickers.accounts}
        templates={pickers.templates}
        transactions={pickers.transactions}
        onSaved={handleSaved}
      />
    </NewTransactionContext.Provider>
  );
}

export function useNewTransaction() {
  const ctx = useContext(NewTransactionContext);
  if (!ctx) throw new Error('useNewTransaction must be used within a NewTransactionProvider');
  return ctx;
}

export function useTxCreatedListener(fn) {
  useEffect(() => {
    window.addEventListener(TX_CREATED_EVENT, fn);
    return () => window.removeEventListener(TX_CREATED_EVENT, fn);
  }, [fn]);
}
