import { vi } from 'vitest';

// Minimal stand-in for admin/src/lib/supabaseClient.js's exported `supabase`
// client, covering only the methods actually called anywhere in admin/src
// (auth.getSession / onAuthStateChange / signInWithPassword / signOut).
// Pass `overrides` to replace/extend individual methods per test, e.g.:
//   vi.mock('../../lib/supabaseClient.js', () => ({
//     supabase: createMockSupabaseClient({
//       auth: { getSession: vi.fn().mockResolvedValue({ data: { session: fakeSession }, error: null }) },
//     }),
//   }));
export function createMockSupabaseClient(overrides = {}) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      ...overrides.auth,
    },
    ...overrides,
  };
}
