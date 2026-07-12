# Wallet App — Production Standards

This app is being published publicly as a **paid product**. All work in this repo must follow these standards unless the user explicitly asks for an exception.

## Non-negotiable: don't break existing behavior
Every change (feature, optimization, refactor, bug fix, UI tweak) must preserve existing business logic, calculations, user flows, API contracts, and UI behavior exactly, unless the user explicitly asked to change that specific thing. Regression-check the affected area before calling work done (see the `verify` skill).

## Security (OWASP Top 10 + industry baseline)
- Encrypt sensitive data at rest and in transit (TLS/HTTPS). Backend already encrypts the data file with AES-256-GCM (`backend/crypto.js`) — keep that pattern for any new persisted secrets.
- Auth: hashed passwords (scrypt, already in place), random session tokens, ownership checks on every resource (`ownsAccount` pattern) so users only ever touch their own data.
- Validate and sanitize all input server-side (never trust client-side validation alone).
- Rate limit and authenticate every API endpoint; never expose secrets/keys/tokens to the client bundle.
- Guard against XSS, CSRF, injection, SSRF, IDOR, clickjacking, session hijacking, brute force, API abuse.
- Use secure HTTP headers and CSP; keep dependencies patched and periodically check for known CVEs.
- Log and monitor suspicious activity (auth failures, unusual access patterns).

## Performance & scalability
- Minimize API calls, DB reads, and re-renders. Use pagination, lazy loading, code splitting, and caching where it doesn't complicate the code beyond what's justified.
- Design for concurrent users and growing data volume — flag when a change works fine at demo scale but won't hold up under real concurrent load or a much larger dataset.

## Code quality
- Reuse existing components/hooks/services/utils instead of duplicating logic.
- Keep the current modular structure (`frontend/src`, `backend/server.js` + `backend/crypto.js`); don't introduce parallel patterns for the same problem.
- No speculative abstractions or unused scaffolding — see the general "don't over-engineer" guidance already in force for this assistant.

## Stack notes (so security/scale recommendations stay grounded in reality)
- Frontend: React 18 + Vite + Tailwind + react-router + recharts, plain JavaScript (JSX), no TypeScript.
- Backend: Node/Express, CommonJS, **no real database** — a single JSON file (`backend/sampledata.json`) encrypted at rest, loaded fully into memory and rewritten on every write. This is the biggest structural gap versus "scales to high concurrent traffic" — treat it as a known limitation to raise, not silently work around, when relevant. Migration to a real DB was explicitly deferred by the user (2026-07-08) — hardening was done around this constraint, not by fixing it.
- Auth is custom (scrypt password hashing + bearer session tokens + optional Google Sign-In), not a third-party auth provider. Token is kept in `localStorage` on the frontend (`frontend/src/lib/api.js`, `AuthContext.jsx`) — an accepted tradeoff (simpler than cookie+CSRF-token auth) mitigated by helmet's headers and the absence of any `dangerouslySetInnerHTML`/`eval` in the codebase. Revisit only if that changes.
- Security hardening already in place (added 2026-07-08): `helmet()` headers, CORS allowlist via `CORS_ORIGIN` env var (comma-separated; unset = allow-all, fine for dev only), rate limiting (`express-rate-limit`: 20 req/15min on `/api/auth/*`, 300 req/15min on the rest of `/api`), `TRUST_PROXY` env var for correct client IP behind a reverse proxy, a global JSON/error handler that never leaks stack traces to clients, and `securityLog()` calls on auth failures/invalid tokens/rate-limit hits (currently console-based — wire to a real log sink before scaling past a single instance).
- Before production deploy: set `CORS_ORIGIN` to the real frontend origin(s), set `TRUST_PROXY` if behind a proxy/load balancer, and terminate TLS at the proxy or directly (the app itself doesn't enforce HTTPS).
- Dependency scanning is manual (`npm audit`) — no CI/Dependabot wired up yet.

When a request conflicts with reality (e.g., "must handle high concurrent traffic" while still on a single JSON file), say so explicitly and propose the smallest change that meaningfully closes the gap, rather than quietly pretending the requirement is already met.
