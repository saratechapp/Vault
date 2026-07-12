// Lazy, memoized access to the data the assistant reasons over. Every value
// here is already served by an existing authenticated endpoint (dashboard,
// AI insights engine, reports, raw entity lists) — this module adds no new
// backend surface, it just avoids re-fetching the same thing for every
// question asked in one sitting.
//
// Cache is invalidated by the same app-wide events other consumers already
// dispatch (new transaction saved, account added/removed) so the assistant
// never answers from stale data after the user acts on its suggestions.
import {
  dashboardApi, aiApi, reportsApi, categoriesApi, accountsApi,
  budgetsApi, billsApi, goalsApi, transactionsApi,
} from '../api.js';
import { TX_CREATED_EVENT } from '../../context/NewTransactionContext.jsx';
import { ACCOUNTS_CHANGED_EVENT } from '../../context/AccountsGateContext.jsx';

const TTL_MS = 60_000;

const singletons = {
  dashboard: null, insights: null, reports: null,
  categories: null, accounts: null, budgets: null, bills: null, goals: null,
};
const transactionsCache = new Map(); // paramsKey -> { at, promise }
const monthlyReportCache = new Map(); // "YYYY-M" -> { at, promise }

function cached(key, fetcher) {
  const entry = singletons[key];
  if (entry && Date.now() - entry.at < TTL_MS) return entry.promise;
  const promise = fetcher().catch((err) => {
    singletons[key] = null; // don't cache failures
    throw err;
  });
  singletons[key] = { at: Date.now(), promise };
  return promise;
}

export const assistantData = {
  dashboard: () => cached('dashboard', dashboardApi.get),
  insights: () => cached('insights', aiApi.insights),
  reports: () => cached('reports', reportsApi.get),
  categories: () => cached('categories', categoriesApi.list),
  accounts: () => cached('accounts', accountsApi.list),
  budgets: () => cached('budgets', () => budgetsApi.list()),
  bills: () => cached('bills', billsApi.list),
  goals: () => cached('goals', goalsApi.list),
  // Raw transactions are queried with different filters per question
  // ("June vs July", "grocery spending") — keyed by params so repeat asks
  // in the same session don't refetch, but distinct filters don't collide.
  transactions: (params = {}) => {
    const key = JSON.stringify(params);
    const entry = transactionsCache.get(key);
    if (entry && Date.now() - entry.at < TTL_MS) return entry.promise;
    const promise = transactionsApi.list(params).catch((err) => {
      transactionsCache.delete(key);
      throw err;
    });
    transactionsCache.set(key, { at: Date.now(), promise });
    return promise;
  },
  // month: "YYYY-M" (1-indexed month, matches aiApi.monthlyReport's contract)
  monthlyReport: (month) => {
    const entry = monthlyReportCache.get(month);
    if (entry && Date.now() - entry.at < TTL_MS) return entry.promise;
    const promise = aiApi.monthlyReport(month).catch((err) => {
      monthlyReportCache.delete(month);
      throw err;
    });
    monthlyReportCache.set(month, { at: Date.now(), promise });
    return promise;
  },
};

export function invalidateAssistantData() {
  Object.keys(singletons).forEach((k) => { singletons[k] = null; });
  transactionsCache.clear();
  monthlyReportCache.clear();
}

if (typeof window !== 'undefined') {
  window.addEventListener(TX_CREATED_EVENT, invalidateAssistantData);
  window.addEventListener(ACCOUNTS_CHANGED_EVENT, invalidateAssistantData);
}
