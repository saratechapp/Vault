// Live FX rates via Fawaz Ahmed's free currency API, with a jsDelivr primary
// host and a Cloudflare-Pages fallback, cached in localStorage for 1 hour.

const CACHE_KEY = 'wallet_fx_v1';
const CACHE_TTL_MS = 60 * 60 * 1000;

function primaryUrl(base) {
  return `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`;
}
function fallbackUrl(base) {
  return `https://latest.currency-api.pages.dev/v1/currencies/${base.toLowerCase()}.json`;
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}
function writeCache(cache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export async function fetchRates(base, { force = false } = {}) {
  const baseLower = base.toLowerCase();
  const cache = readCache();
  const entry = cache[baseLower];
  if (!force && entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
    return entry.rates;
  }

  let data;
  try {
    const res = await fetch(primaryUrl(baseLower));
    if (!res.ok) throw new Error('primary fx host failed');
    data = await res.json();
  } catch {
    const res = await fetch(fallbackUrl(baseLower));
    if (!res.ok) throw new Error('fx fetch failed');
    data = await res.json();
  }

  const rates = data[baseLower] || {};
  cache[baseLower] = { rates, fetchedAt: Date.now() };
  writeCache(cache);
  return rates;
}
