import { vi } from 'vitest';

// Minimal stand-in for frontend/src/lib/supabaseClient.js's exported
// `supabase` client, covering only the methods actually called anywhere in
// frontend/src (auth.getSession / onAuthStateChange / signInWithPassword /
// signOut / signInWithOAuth / updateUser / resetPasswordForEmail). Pass
// `overrides` to replace/extend individual methods per test, e.g.:
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
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
      ...overrides.auth,
    },
    ...overrides,
  };
}
