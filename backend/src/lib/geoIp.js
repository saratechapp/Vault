// Best-effort country of the request, from whatever geo header the fronting
// CDN/proxy already added. No network call, no dependency, no PII stored —
// just a 2-letter country code or null. Present behind Cloudflare / Vercel /
// App Engine / Fastly; absent on a bare origin (then pricing falls through
// to the browser-locale hint and finally the configured default currency).
const COUNTRY_HEADERS = [
  'cf-ipcountry',
  'x-vercel-ip-country',
  'x-appengine-country',
  'fastly-geo-country',
  'x-geo-country',
  'x-country-code',
];

function countryFromHeaders(req) {
  if (!req || !req.headers) return null;
  for (const h of COUNTRY_HEADERS) {
    const raw = req.headers[h];
    if (!raw || typeof raw !== 'string') continue;
    const cc = raw.trim().slice(0, 2).toUpperCase();
    // Some proxies send "XX" / "T1" (Tor) / "ZZ" for unknown — reject those.
    if (/^[A-Z]{2}$/.test(cc) && cc !== 'XX' && cc !== 'ZZ' && cc !== 'T1') return cc;
  }
  return null;
}

module.exports = { countryFromHeaders, COUNTRY_HEADERS };
